import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { FlightAnalysisService } from '@services/FlightAnalysisService';
import type { FlightPromotion } from '@flight-types/FlightPromotion';

/**
 * Feature: bot-refactor-providers-channels, Property 16: Análise de IA Executada para Cada Resultado de Provider
 *
 * Validates: Requirements 9.1, 9.3, 9.4
 *
 * Para qualquer conjunto de promoções retornado por um provider, o
 * FlightAnalysisService.analyzePromotions() deve retornar um Map com uma entrada
 * para cada promoção (mesmo que seja mensagem de indisponibilidade).
 */

const IATA_CODES = ['GRU', 'GIG', 'LIS', 'CDG', 'JFK', 'MIA', 'EZE', 'SCL', 'LAX', 'FCO'];
const AIRLINES = ['LATAM', 'GOL', 'Azul', 'TAP', 'Air France', 'American Airlines', null];
const COUNTRIES = ['Brasil', 'Portugal', 'França', 'EUA', 'Argentina', 'Chile', 'Itália'];
const COUNTRY_CODES = ['BR', 'PT', 'FR', 'US', 'AR', 'CL', 'IT'];

/** Generate a date string in YYYY-MM-DD format within a valid range */
const dateStringArb = fc.integer({ min: 2025, max: 2026 }).chain(year =>
  fc.integer({ min: 1, max: 12 }).chain(month =>
    fc.integer({ min: 1, max: 28 }).map(day =>
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    ),
  ),
);

/** Arbitrary that generates a valid FlightPromotion */
const flightPromotionArb: fc.Arbitrary<FlightPromotion> = fc.record({
  id: fc.uuid(),
  provider: fc.constantFrom('Aviasales', 'Kiwi', 'SkyScrapper', 'FlightAPI', 'Serper'),
  origin: fc.constantFrom(...IATA_CODES),
  originName: fc.constant('São Paulo'),
  destination: fc.constantFrom('Lisboa', 'Paris', 'Nova York', 'Miami', 'Buenos Aires', 'Santiago', 'Roma'),
  destinationCode: fc.constantFrom(...IATA_CODES),
  destinationCountryCode: fc.constantFrom(...COUNTRY_CODES),
  destinationCountry: fc.constantFrom(...COUNTRIES),
  price: fc.integer({ min: 500, max: 15000 }),
  currency: fc.constant('BRL' as const),
  departureDate: dateStringArb,
  returnDate: fc.oneof(dateStringArb, fc.constant(null)),
  airline: fc.constantFrom(...AIRLINES),
  stops: fc.integer({ min: 0, max: 3 }),
  stopoverCities: fc.oneof(
    fc.array(fc.constantFrom('GRU', 'MIA', 'LIS', 'CDG'), { minLength: 1, maxLength: 3 }),
    fc.constant(null),
  ),
  durationMinutes: fc.oneof(fc.integer({ min: 60, max: 1800 }), fc.constant(null)),
  summary: fc.string({ minLength: 5, maxLength: 100 }),
  bookingUrl: fc.oneof(fc.constant('https://example.com/book'), fc.constant(null)),
  googleFlightsUrl: fc.constant('https://www.google.com/travel/flights'),
  score: fc.integer({ min: 0, max: 100 }),
  isCrazyDeal: fc.boolean(),
  channels: fc.subarray(['geral', 'international', 'brazil', 'crazy'] as const, { minLength: 1 }),
});

describe('Feature: bot-refactor-providers-channels, Property 16: Análise de IA Executada para Cada Resultado de Provider', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('analyzePromotions returns a Map with exactly one entry per promotion when API responds successfully', async () => {
    // Mock fetch to simulate a successful OpenAI response with one line per promotion
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{
          message: {
            content: Array.from({ length: 10 }, (_, i) => `✅ Boa oferta para voo ${i + 1}`).join('\n'),
          },
        }],
      }),
      text: async () => '',
    })) as unknown as typeof global.fetch;

    const service = new FlightAnalysisService();
    // Override the private apiKey to ensure the service considers itself available
    Object.defineProperty(service, 'apiKey', { value: 'test-key', writable: true });

    await fc.assert(
      fc.asyncProperty(
        fc.array(flightPromotionArb, { minLength: 1, maxLength: 10 }),
        async (promotions) => {
          const result = await service.analyzePromotions(promotions);

          // The result must be a Map
          expect(result).toBeInstanceOf(Map);

          // The Map must have exactly one entry per promotion
          expect(result.size).toBe(promotions.length);

          // Each promotion's id must be a key in the Map
          for (const promo of promotions) {
            expect(result.has(promo.id)).toBe(true);
          }

          // Each value must be a non-empty string
          for (const [, value] of result) {
            expect(typeof value).toBe('string');
            expect(value.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);

  it('analyzePromotions returns a Map with exactly one entry per promotion when service is unavailable (no API key)', async () => {
    const service = new FlightAnalysisService();
    // Override the private apiKey to simulate no key configured
    Object.defineProperty(service, 'apiKey', { value: undefined, writable: true });

    await fc.assert(
      fc.asyncProperty(
        fc.array(flightPromotionArb, { minLength: 1, maxLength: 10 }),
        async (promotions) => {
          const result = await service.analyzePromotions(promotions);

          // The result must be a Map
          expect(result).toBeInstanceOf(Map);

          // The Map must have exactly one entry per promotion
          expect(result.size).toBe(promotions.length);

          // Each promotion's id must be a key in the Map
          for (const promo of promotions) {
            expect(result.has(promo.id)).toBe(true);
          }

          // Each value must be a non-empty informative string
          for (const [, value] of result) {
            expect(typeof value).toBe('string');
            expect(value.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);

  it('analyzePromotions returns a Map with informative messages when API call fails (quota exceeded)', async () => {
    // Mock fetch to simulate an API error (quota exceeded)
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
      text: async () => JSON.stringify({
        error: { message: 'insufficient_quota', type: 'insufficient_quota', param: null, code: 'insufficient_quota' },
      }),
    })) as unknown as typeof global.fetch;

    const service = new FlightAnalysisService();
    // Override the private apiKey to ensure the service tries to call the API
    Object.defineProperty(service, 'apiKey', { value: 'test-key', writable: true });

    await fc.assert(
      fc.asyncProperty(
        fc.array(flightPromotionArb, { minLength: 1, maxLength: 10 }),
        async (promotions) => {
          const result = await service.analyzePromotions(promotions);

          // The result must be a Map
          expect(result).toBeInstanceOf(Map);

          // The Map must have exactly one entry per promotion (fallback messages)
          expect(result.size).toBe(promotions.length);

          // Each promotion's id must be a key in the Map
          for (const promo of promotions) {
            expect(result.has(promo.id)).toBe(true);
          }

          // Each value must be a non-empty informative string about unavailability
          for (const [, value] of result) {
            expect(typeof value).toBe('string');
            expect(value.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);
});
