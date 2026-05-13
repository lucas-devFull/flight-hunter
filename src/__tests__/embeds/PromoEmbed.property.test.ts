import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildPromotionEmbed } from '@embeds/PromoEmbed';
import { MONITORED_AIRPORT_CODES } from '@config/flight';
import type { FlightPromotion } from '@flight-types/FlightPromotion';

/**
 * Property-based tests for PromoEmbed
 *
 * Feature: bot-refactor-providers-channels, Property 17: Google Flights URL como Link Principal
 * Validates: Requirements 10.1, 10.3, 10.5
 */

const BRAZILIAN_ORIGINS = MONITORED_AIRPORT_CODES;

/**
 * Arbitrary that generates valid FlightPromotion objects with a filled googleFlightsUrl.
 */
function flightPromotionWithGoogleFlightsUrlArb(): fc.Arbitrary<FlightPromotion> {
  return fc.record({
    id: fc.uuid(),
    provider: fc.constantFrom('Aviasales', 'Kiwi', 'Serper', 'SkyScrapper', 'FlightAPI'),
    origin: fc.constantFrom(...BRAZILIAN_ORIGINS),
    originName: fc.string({ minLength: 3, maxLength: 20 }),
    destination: fc.string({ minLength: 3, maxLength: 30 }),
    destinationCode: fc.string({ minLength: 3, maxLength: 3 }).map((s) => s.toUpperCase()),
    destinationCountryCode: fc.constantFrom('US', 'PT', 'JP', 'ES', 'BR'),
    destinationCountry: fc.string({ minLength: 3, maxLength: 20 }),
    price: fc.integer({ min: 100, max: 20000 }),
    currency: fc.constant('BRL' as const),
    departureDate: fc.integer({ min: 1, max: 730 }).map((days) => {
      const d = new Date('2025-01-01');
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    }),
    returnDate: fc.option(
      fc.integer({ min: 1, max: 730 }).map((days) => {
        const d = new Date('2025-01-01');
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
      }),
      { nil: null },
    ),
    airline: fc.option(fc.constantFrom('LATAM', 'GOL', 'Azul', 'TAP', 'Iberia'), { nil: null }),
    stops: fc.integer({ min: 0, max: 3 }),
    stopoverCities: fc.option(
      fc.array(fc.string({ minLength: 3, maxLength: 15 }), { minLength: 0, maxLength: 3 }),
      { nil: null },
    ),
    durationMinutes: fc.option(fc.integer({ min: 60, max: 2400 }), { nil: null }),
    summary: fc.string({ minLength: 10, maxLength: 100 }),
    bookingUrl: fc.option(fc.webUrl(), { nil: null }),
    googleFlightsUrl: fc.webUrl(),
    score: fc.integer({ min: 0, max: 100 }),
    isCrazyDeal: fc.boolean(),
    channels: fc.subarray(['international', 'brazil', 'crazy'] as const, { minLength: 0, maxLength: 3 }),
  });
}

/**
 * Arbitrary that generates valid FlightPromotion objects WITHOUT googleFlightsUrl (empty string).
 * bookingUrl is always filled to serve as fallback.
 */
function flightPromotionWithoutGoogleFlightsUrlArb(): fc.Arbitrary<FlightPromotion> {
  return fc.record({
    id: fc.uuid(),
    provider: fc.constantFrom('Aviasales', 'Kiwi', 'Serper', 'SkyScrapper', 'FlightAPI'),
    origin: fc.constantFrom(...BRAZILIAN_ORIGINS),
    originName: fc.string({ minLength: 3, maxLength: 20 }),
    destination: fc.string({ minLength: 3, maxLength: 30 }),
    destinationCode: fc.string({ minLength: 3, maxLength: 3 }).map((s) => s.toUpperCase()),
    destinationCountryCode: fc.constantFrom('US', 'PT', 'JP', 'ES', 'BR'),
    destinationCountry: fc.string({ minLength: 3, maxLength: 20 }),
    price: fc.integer({ min: 100, max: 20000 }),
    currency: fc.constant('BRL' as const),
    departureDate: fc.integer({ min: 1, max: 730 }).map((days) => {
      const d = new Date('2025-01-01');
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    }),
    returnDate: fc.option(
      fc.integer({ min: 1, max: 730 }).map((days) => {
        const d = new Date('2025-01-01');
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
      }),
      { nil: null },
    ),
    airline: fc.option(fc.constantFrom('LATAM', 'GOL', 'Azul', 'TAP', 'Iberia'), { nil: null }),
    stops: fc.integer({ min: 0, max: 3 }),
    stopoverCities: fc.option(
      fc.array(fc.string({ minLength: 3, maxLength: 15 }), { minLength: 0, maxLength: 3 }),
      { nil: null },
    ),
    durationMinutes: fc.option(fc.integer({ min: 60, max: 2400 }), { nil: null }),
    summary: fc.string({ minLength: 10, maxLength: 100 }),
    bookingUrl: fc.webUrl(),
    googleFlightsUrl: fc.constant(''),
    score: fc.integer({ min: 0, max: 100 }),
    isCrazyDeal: fc.boolean(),
    channels: fc.subarray(['international', 'brazil', 'crazy'] as const, { minLength: 0, maxLength: 3 }),
  });
}

describe('Feature: bot-refactor-providers-channels, Property 17: Google Flights URL como Link Principal', () => {
  /**
   * **Validates: Requirements 10.1, 10.3**
   *
   * For any promotion with googleFlightsUrl filled, the embed must use that URL
   * as the main link (via .setURL()).
   */
  it('embed uses googleFlightsUrl as main URL when it is filled', () => {
    fc.assert(
      fc.property(flightPromotionWithGoogleFlightsUrlArb(), (promotion) => {
        const embed = buildPromotionEmbed(promotion);
        expect(embed.data.url).toBe(promotion.googleFlightsUrl);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.5**
   *
   * For any promotion without googleFlightsUrl (empty string), the embed must
   * fall back to using bookingUrl as the main link.
   */
  it('embed uses bookingUrl as fallback when googleFlightsUrl is empty', () => {
    fc.assert(
      fc.property(flightPromotionWithoutGoogleFlightsUrlArb(), (promotion) => {
        const embed = buildPromotionEmbed(promotion);
        expect(embed.data.url).toBe(promotion.bookingUrl);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.1, 10.3**
   *
   * When googleFlightsUrl is present, footer text must indicate Google Flights.
   */
  it('footer indicates Google Flights when googleFlightsUrl is filled', () => {
    fc.assert(
      fc.property(flightPromotionWithGoogleFlightsUrlArb(), (promotion) => {
        const embed = buildPromotionEmbed(promotion);
        expect(embed.data.footer?.text).toContain('Google Flights');
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.5**
   *
   * When googleFlightsUrl is empty, footer text must indicate provider site (not Google Flights as primary).
   */
  it('footer indicates provider site when googleFlightsUrl is empty', () => {
    fc.assert(
      fc.property(flightPromotionWithoutGoogleFlightsUrlArb(), (promotion) => {
        const embed = buildPromotionEmbed(promotion);
        expect(embed.data.footer?.text).toContain('site do provider');
      }),
      { numRuns: 100 },
    );
  });
});
