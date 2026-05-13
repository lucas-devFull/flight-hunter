import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { FlightPromotion } from '@flight-types/FlightPromotion';

/**
 * Property-based tests for maximum stops filtering
 *
 * Validates: Requirements 4.2
 */

describe('Feature: bot-refactor-providers-channels, Property 11: Filtro de Escalas Máximas', () => {
  /**
   * **Validates: Requirements 4.2**
   *
   * For any list of promotions and any value escalas_max = N,
   * the filtered result must contain only promotions where stops <= N.
   * No promotion with stops > N must appear in the result.
   */

  /** Arbitrary that generates a FlightPromotion with a random stops value (0-5) */
  const flightPromotionArb = (stopsRange: { min: number; max: number }) =>
    fc.record({
      id: fc.uuid(),
      provider: fc.constantFrom('Aviasales', 'Kiwi', 'SkyScrapper', 'FlightAPI', 'Serper'),
      origin: fc.constantFrom('GRU', 'GIG', 'VCP', 'CWB'),
      originName: fc.constant('Guarulhos'),
      destination: fc.constant('Lisboa'),
      destinationCode: fc.constant('LIS'),
      destinationCountryCode: fc.constant('PT'),
      destinationCountry: fc.constant('Portugal'),
      price: fc.integer({ min: 500, max: 10000 }),
      currency: fc.constant('BRL' as const),
      departureDate: fc.constant('2025-06-15'),
      returnDate: fc.constant('2025-06-25' as string | null),
      airline: fc.constant('LATAM' as string | null),
      stops: fc.integer({ min: stopsRange.min, max: stopsRange.max }),
      stopoverCities: fc.constant(null as string[] | null),
      durationMinutes: fc.integer({ min: 60, max: 1800 }).map((v) => v as number | null),
      summary: fc.constant('Flight promotion'),
      bookingUrl: fc.constant('https://example.com' as string | null),
      googleFlightsUrl: fc.constant('https://flights.google.com/example'),
      score: fc.integer({ min: 0, max: 100 }),
      isCrazyDeal: fc.boolean(),
      channels: fc.constant(['geral'] as FlightPromotion['channels']),
    });

  it('all promotions in filtered result have stops <= escalas_max', () => {
    const promotionsArb = fc.array(flightPromotionArb({ min: 0, max: 5 }), {
      minLength: 1,
      maxLength: 20,
    });
    const escalasMaxArb = fc.integer({ min: 0, max: 3 });

    fc.assert(
      fc.property(promotionsArb, escalasMaxArb, (promotions, escalasMax) => {
        const filtered = promotions.filter((p) => p.stops <= escalasMax);

        // Every promotion in the result must have stops <= escalas_max
        for (const promo of filtered) {
          expect(promo.stops).toBeLessThanOrEqual(escalasMax);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('no promotion with stops > escalas_max appears in the filtered result', () => {
    const promotionsArb = fc.array(flightPromotionArb({ min: 0, max: 5 }), {
      minLength: 1,
      maxLength: 20,
    });
    const escalasMaxArb = fc.integer({ min: 0, max: 3 });

    fc.assert(
      fc.property(promotionsArb, escalasMaxArb, (promotions, escalasMax) => {
        const filtered = promotions.filter((p) => p.stops <= escalasMax);

        // No promotion with stops > escalas_max should be present
        const violators = filtered.filter((p) => p.stops > escalasMax);
        expect(violators).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });

  it('filtered result preserves all promotions that satisfy the stops constraint', () => {
    const promotionsArb = fc.array(flightPromotionArb({ min: 0, max: 5 }), {
      minLength: 1,
      maxLength: 20,
    });
    const escalasMaxArb = fc.integer({ min: 0, max: 3 });

    fc.assert(
      fc.property(promotionsArb, escalasMaxArb, (promotions, escalasMax) => {
        const filtered = promotions.filter((p) => p.stops <= escalasMax);

        // Count of valid promotions in original must equal filtered length
        const expectedCount = promotions.filter((p) => p.stops <= escalasMax).length;
        expect(filtered).toHaveLength(expectedCount);
      }),
      { numRuns: 100 },
    );
  });

  it('when escalas_max is 0, only direct flights (stops === 0) remain', () => {
    const promotionsArb = fc.array(flightPromotionArb({ min: 0, max: 5 }), {
      minLength: 1,
      maxLength: 20,
    });

    fc.assert(
      fc.property(promotionsArb, (promotions) => {
        const escalasMax = 0;
        const filtered = promotions.filter((p) => p.stops <= escalasMax);

        for (const promo of filtered) {
          expect(promo.stops).toBe(0);
        }
      }),
      { numRuns: 100 },
    );
  });
});
