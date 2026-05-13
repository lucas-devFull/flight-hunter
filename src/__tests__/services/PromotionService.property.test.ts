import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { PromotionService } from '@services/PromotionService';
import { ProviderRegistry, type ProviderConfig } from '@services/ProviderRegistry';
import { RateLimiter } from '@services/RateLimiter';
import { DateFallbackService } from '@services/DateFallbackService';
import type { FlightProvider } from '@flight-types/FlightProvider';
import type { FlightPromotion } from '@flight-types/FlightPromotion';

/**
 * Feature: bot-refactor-providers-channels, Property 4: Todos os Providers São Consultados e Resultados Mesclados
 *
 * Validates: Requirements 1.4, 5.5, 5.6
 *
 * Para qualquer lista de providers disponíveis, TODOS devem ser consultados
 * e seus resultados mesclados e deduplicados por rota+data (melhor score vence).
 */

function createMockPromotion(providerName: string, index: number): FlightPromotion {
  return {
    id: `promo-${providerName}-${index}`,
    provider: providerName,
    origin: 'GRU',
    originName: 'São Paulo',
    destination: 'Lisboa',
    destinationCode: 'LIS',
    destinationCountryCode: 'PT',
    destinationCountry: 'Portugal',
    price: 2500,
    currency: 'BRL',
    departureDate: `2025-03-${String(15 + index).padStart(2, '0')}`,
    returnDate: '2025-03-25',
    airline: 'TAP',
    stops: 0,
    stopoverCities: null,
    durationMinutes: 600,
    summary: `Promoção de ${providerName}`,
    bookingUrl: null,
    googleFlightsUrl: 'https://www.google.com/travel/flights',
    score: 80,
    isCrazyDeal: false,
    channels: ['international'],
  };
}

describe('Feature: bot-refactor-providers-channels, Property 4: Todos os Providers São Consultados e Resultados Mesclados', () => {
  it('all available providers are consulted and results are merged', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate number of providers (2 to 10)
        fc.integer({ min: 2, max: 10 }).chain((numProviders) =>
          // Generate which providers return results (subset of all providers)
          fc.array(fc.boolean(), { minLength: numProviders, maxLength: numProviders }).map(
            (hasResults) => ({ numProviders, hasResults }),
          ),
        ),
        async ({ numProviders, hasResults }) => {
          // Track which providers were called
          const callLog: string[] = [];

          // Create mock providers; each returns results based on hasResults[i]
          const configs: ProviderConfig[] = Array.from({ length: numProviders }, (_, i) => {
            const providerName = `provider-${i}`;
            const mockProvider: FlightProvider = {
              name: providerName,
              fetchPromotions: vi.fn(async () => {
                callLog.push(providerName);
                if (hasResults[i]) {
                  // Each provider returns a promotion with unique departure date to avoid dedup
                  return [createMockPromotion(providerName, i)];
                }
                return [];
              }),
            };

            return {
              name: providerName,
              priority: i + 1,
              provider: mockProvider,
              allocation: 'both' as const,
              limits: {
                maxRequests: 1000,
                cycle: 'daily' as const,
                reservedForInteractive: 0,
              },
            };
          });

          const registry = new ProviderRegistry(configs);
          const rateLimiter = new RateLimiter(registry);
          const dateFallback = new DateFallbackService();

          const service = new PromotionService(registry, rateLimiter, dateFallback);

          const result = await service.findPromotions({
            origin: 'GRU',
            destination: 'LIS',
            context: 'interactive',
          });

          // ALL providers should be called (none are rate-limited)
          expect(callLog).toHaveLength(numProviders);
          for (let i = 0; i < numProviders; i++) {
            expect(callLog).toContain(`provider-${i}`);
          }

          // Results should contain one promotion per provider that returned results
          const providersWithResults = hasResults.filter(Boolean).length;
          expect(result.promotions).toHaveLength(providersWithResults);

          // providerUsed should list all providers that returned results
          if (providersWithResults > 0) {
            const expectedProviders = hasResults
              .map((has, i) => (has ? `provider-${i}` : null))
              .filter(Boolean);
            for (const name of expectedProviders) {
              expect(result.providerUsed).toContain(name);
            }
            expect(result.allProvidersExhausted).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: bot-refactor-providers-channels, Property 6: Todos Esgotados Retorna Erro
 *
 * Validates: Requirements 1.6
 *
 * Para qualquer conjunto de providers onde todos possuem used >= limit,
 * a busca deve retornar allProvidersExhausted = true e uma lista vazia de promoções.
 */
describe('Feature: bot-refactor-providers-channels, Property 6: Todos Esgotados Retorna Erro', () => {
  it('returns allProvidersExhausted = true and empty promotions when all providers are exhausted', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 1 to 5 providers, each with a random limit between 1 and 10
        fc.integer({ min: 1, max: 5 }).chain((numProviders) =>
          fc.tuple(
            fc.constant(numProviders),
            fc.array(fc.integer({ min: 1, max: 10 }), {
              minLength: numProviders,
              maxLength: numProviders,
            }),
          ),
        ),
        async ([numProviders, limits]) => {
          // Create mock providers with fetchPromotions spies
          const fetchSpies: ReturnType<typeof vi.fn>[] = [];

          const configs: ProviderConfig[] = Array.from({ length: numProviders }, (_, i) => {
            const providerName = `provider-${i}`;
            const fetchFn = vi.fn(async () => {
              return [createMockPromotion(providerName, 0)];
            });
            fetchSpies.push(fetchFn);

            const mockProvider: FlightProvider = {
              name: providerName,
              fetchPromotions: fetchFn,
            };

            return {
              name: providerName,
              priority: i + 1,
              provider: mockProvider,
              allocation: 'both' as const,
              limits: {
                maxRequests: limits[i],
                cycle: 'daily' as const,
                reservedForInteractive: 0,
              },
            };
          });

          const registry = new ProviderRegistry(configs);
          const rateLimiter = new RateLimiter(registry);
          const dateFallback = new DateFallbackService();

          // Exhaust all providers by consuming exactly their limit
          for (let i = 0; i < numProviders; i++) {
            for (let j = 0; j < limits[i]; j++) {
              rateLimiter.consume(`provider-${i}`);
            }
          }

          const service = new PromotionService(registry, rateLimiter, dateFallback);

          // Execute the search
          const result = await service.findPromotions({
            origin: 'GRU',
            destination: 'LIS',
            context: 'interactive',
          });

          // Verify allProvidersExhausted is true
          expect(result.allProvidersExhausted).toBe(true);

          // Verify promotions is empty
          expect(result.promotions).toHaveLength(0);

          // Verify NO provider's fetchPromotions was called
          for (let i = 0; i < numProviders; i++) {
            expect(fetchSpies[i]).not.toHaveBeenCalled();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
