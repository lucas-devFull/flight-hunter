import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ChannelRouter } from '@services/ChannelRouter';
import { MONITORED_AIRPORT_CODES } from '@config/flight';
import type { FlightPromotion } from '@flight-types/FlightPromotion';

/**
 * Property-based tests for ChannelRouter
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.5
 */

const router = new ChannelRouter();

const BRAZILIAN_ORIGINS = MONITORED_AIRPORT_CODES;
const NON_BR_COUNTRY_CODES = ['US', 'PT', 'JP', 'ES', 'CO', 'PE', 'IT', 'CN', 'TH', 'FR', 'DE', 'AR'];

/**
 * Arbitrary that generates valid FlightPromotion objects.
 * Uses Brazilian airport codes from MONITORED_AIRPORT_CODES for origins.
 * Destination country code is configurable.
 */
function flightPromotionArb(options?: {
  originCodes?: string[];
  destinationCountryCodes?: string[];
  isCrazyDeal?: boolean;
}): fc.Arbitrary<FlightPromotion> {
  const origins = options?.originCodes ?? BRAZILIAN_ORIGINS;
  const countryCodes = options?.destinationCountryCodes ?? ['BR', ...NON_BR_COUNTRY_CODES];

  return fc.record({
    id: fc.uuid(),
    provider: fc.constantFrom('Aviasales', 'Kiwi', 'Serper'),
    origin: fc.constantFrom(...origins),
    originName: fc.string({ minLength: 3, maxLength: 20 }),
    destination: fc.string({ minLength: 3, maxLength: 30 }),
    destinationCode: fc.string({ minLength: 3, maxLength: 3 }).map((s) => s.toUpperCase()),
    destinationCountryCode: fc.constantFrom(...countryCodes),
    destinationCountry: fc.string({ minLength: 3, maxLength: 20 }),
    price: fc.integer({ min: 100, max: 20000 }),
    currency: fc.constant('BRL' as const),
    departureDate: fc.integer({ min: 0, max: 730 }).map((days) => {
      const d = new Date('2025-01-01');
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    }),
    returnDate: fc.option(
      fc.integer({ min: 0, max: 730 }).map((days) => {
        const d = new Date('2025-01-01');
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
      }),
      { nil: null },
    ),
    airline: fc.option(fc.constantFrom('LATAM', 'GOL', 'Azul', 'TAP', 'Iberia'), { nil: null }),
    stops: fc.integer({ min: 0, max: 3 }),
    stopoverCities: fc.option(fc.array(fc.string({ minLength: 3, maxLength: 15 }), { minLength: 0, maxLength: 3 }), { nil: null }),
    durationMinutes: fc.option(fc.integer({ min: 60, max: 2400 }), { nil: null }),
    summary: fc.string({ minLength: 10, maxLength: 100 }),
    bookingUrl: fc.option(fc.webUrl(), { nil: null }),
    googleFlightsUrl: fc.webUrl(),
    score: fc.integer({ min: 0, max: 100 }),
    isCrazyDeal: options?.isCrazyDeal !== undefined ? fc.constant(options.isCrazyDeal) : fc.boolean(),
    channels: fc.subarray(['international', 'brazil', 'crazy'] as const, { minLength: 0, maxLength: 3 }),
  });
}

describe('Feature: bot-refactor-providers-channels, Property 7: Canal Geral Recebe Todas as Promoções', () => {
  /**
   * **Validates: Requirements 2.1, 2.5**
   *
   * For any valid FlightPromotion, route() must always include 'geral' in the result.
   * The 'geral' channel receives all promotions regardless of destination or origin.
   */
  it('route() always includes "geral" for any promotion', () => {
    fc.assert(
      fc.property(flightPromotionArb(), (promotion) => {
        const channels = router.route(promotion);
        expect(channels).toContain('geral');
      }),
      { numRuns: 100 },
    );
  });

  it('route() includes "geral" as the first channel', () => {
    fc.assert(
      fc.property(flightPromotionArb(), (promotion) => {
        const channels = router.route(promotion);
        expect(channels[0]).toBe('geral');
      }),
      { numRuns: 100 },
    );
  });
});

describe('Feature: bot-refactor-providers-channels, Property 8: Roteamento Internacional Correto', () => {
  /**
   * **Validates: Requirement 2.2**
   *
   * When origin is a Brazilian airport AND destinationCountryCode !== 'BR',
   * route() must include 'international'.
   * When destinationCountryCode === 'BR', route() must NOT include 'international'.
   */
  it('route() includes "international" when origin is Brazilian and destination is not BR', () => {
    const internationalPromoArb = flightPromotionArb({
      originCodes: [...BRAZILIAN_ORIGINS],
      destinationCountryCodes: NON_BR_COUNTRY_CODES,
    });

    fc.assert(
      fc.property(internationalPromoArb, (promotion) => {
        const channels = router.route(promotion);
        expect(channels).toContain('international');
      }),
      { numRuns: 100 },
    );
  });

  it('route() does NOT include "international" when destinationCountryCode is BR', () => {
    const domesticPromoArb = flightPromotionArb({
      originCodes: [...BRAZILIAN_ORIGINS],
      destinationCountryCodes: ['BR'],
    });

    fc.assert(
      fc.property(domesticPromoArb, (promotion) => {
        const channels = router.route(promotion);
        expect(channels).not.toContain('international');
      }),
      { numRuns: 100 },
    );
  });
});

describe('Feature: bot-refactor-providers-channels, Property 9: Roteamento Brasil Correto', () => {
  /**
   * **Validates: Requirement 2.3**
   *
   * When origin is a Brazilian airport AND destinationCountryCode === 'BR',
   * route() must include 'brazil'.
   * When destinationCountryCode !== 'BR', route() must NOT include 'brazil'.
   */
  it('route() includes "brazil" when origin is Brazilian and destination is BR', () => {
    const domesticPromoArb = flightPromotionArb({
      originCodes: [...BRAZILIAN_ORIGINS],
      destinationCountryCodes: ['BR'],
    });

    fc.assert(
      fc.property(domesticPromoArb, (promotion) => {
        const channels = router.route(promotion);
        expect(channels).toContain('brazil');
      }),
      { numRuns: 100 },
    );
  });

  it('route() does NOT include "brazil" when destinationCountryCode is not BR', () => {
    const internationalPromoArb = flightPromotionArb({
      originCodes: [...BRAZILIAN_ORIGINS],
      destinationCountryCodes: NON_BR_COUNTRY_CODES,
    });

    fc.assert(
      fc.property(internationalPromoArb, (promotion) => {
        const channels = router.route(promotion);
        expect(channels).not.toContain('brazil');
      }),
      { numRuns: 100 },
    );
  });
});
