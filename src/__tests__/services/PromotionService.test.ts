import { describe, it, expect, vi } from 'vitest';
import { PromotionService } from '@services/PromotionService';
import { ProviderRegistry, type ProviderConfig } from '@services/ProviderRegistry';
import { RateLimiter } from '@services/RateLimiter';
import { DateFallbackService } from '@services/DateFallbackService';
import type { FlightProvider } from '@flight-types/FlightProvider';
import type { FlightPromotion } from '@flight-types/FlightPromotion';
import type { FlightAnalysisService } from '@services/FlightAnalysisService';

/**
 * Testes unitários do PromotionService refatorado.
 *
 * Validates: Requirements 1.4, 1.6, 5.5, 5.6
 */

function createMockPromotion(providerName: string, index = 0): FlightPromotion {
  return {
    id: `promo-${providerName}-${index}`,
    provider: providerName,
    origin: 'GRU',
    originName: 'São Paulo',
    destination: 'Lisboa',
    destinationCode: 'LIS',
    destinationCountryCode: 'PT',
    destinationCountry: 'Portugal',
    price: 2500 + index * 100,
    currency: 'BRL',
    departureDate: '2025-06-15',
    returnDate: '2025-06-25',
    airline: 'TAP',
    stops: 0,
    stopoverCities: null,
    durationMinutes: 600,
    summary: `Promoção ${index} de ${providerName}`,
    bookingUrl: null,
    googleFlightsUrl: 'https://www.google.com/travel/flights',
    score: 80,
    isCrazyDeal: false,
    channels: ['international'],
  };
}

function createProviderConfig(
  name: string,
  priority: number,
  fetchFn: FlightProvider['fetchPromotions'],
  overrides?: Partial<ProviderConfig>,
): ProviderConfig {
  return {
    name,
    priority,
    provider: { name, fetchPromotions: fetchFn },
    allocation: 'both',
    limits: {
      maxRequests: 100,
      cycle: 'daily',
      reservedForInteractive: 0,
    },
    ...overrides,
  };
}

describe('PromotionService', () => {
  describe('Full flow: all providers are called and results are merged', () => {
    it('should call all providers and merge/deduplicate results', async () => {
      const fetchA = vi.fn(async () => [
        createMockPromotion('ProviderA', 0),
        { ...createMockPromotion('ProviderA', 1), departureDate: '2025-06-20' },
      ]);
      const fetchB = vi.fn(async () => [
        { ...createMockPromotion('ProviderB', 0), destinationCode: 'OPO', destination: 'Porto', departureDate: '2025-07-01' },
      ]);
      const fetchC = vi.fn(async () => [
        { ...createMockPromotion('ProviderC', 0), destinationCode: 'MAD', destination: 'Madrid', departureDate: '2025-07-10' },
      ]);

      const configs: ProviderConfig[] = [
        createProviderConfig('ProviderA', 1, fetchA),
        createProviderConfig('ProviderB', 2, fetchB),
        createProviderConfig('ProviderC', 3, fetchC),
      ];

      const registry = new ProviderRegistry(configs);
      const rateLimiter = new RateLimiter(registry);
      const dateFallback = new DateFallbackService();
      const service = new PromotionService(registry, rateLimiter, dateFallback);

      const result = await service.findPromotions({
        origin: 'GRU',
        destination: '',
        context: 'interactive',
      });

      // All providers should be called
      expect(fetchA).toHaveBeenCalledTimes(1);
      expect(fetchB).toHaveBeenCalledTimes(1);
      expect(fetchC).toHaveBeenCalledTimes(1);

      // Results are merged (4 unique route+date combos)
      expect(result.promotions).toHaveLength(4);
      expect(result.providerUsed).toBe('ProviderA, ProviderB, ProviderC');
      expect(result.allProvidersExhausted).toBe(false);
    });
  });

  describe('Provider unavailable (rate limited) is skipped, next provider is used', () => {
    it('should skip rate-limited provider and use the next available one', async () => {
      const fetchA = vi.fn(async () => [createMockPromotion('ProviderA', 0)]);
      const fetchB = vi.fn(async () => [createMockPromotion('ProviderB', 0)]);

      const configs: ProviderConfig[] = [
        createProviderConfig('ProviderA', 1, fetchA, {
          limits: { maxRequests: 5, cycle: 'daily', reservedForInteractive: 0 },
        }),
        createProviderConfig('ProviderB', 2, fetchB, {
          limits: { maxRequests: 100, cycle: 'daily', reservedForInteractive: 0 },
        }),
      ];

      const registry = new ProviderRegistry(configs);
      const rateLimiter = new RateLimiter(registry);
      const dateFallback = new DateFallbackService();

      // Exhaust ProviderA's quota
      for (let i = 0; i < 5; i++) {
        rateLimiter.consume('ProviderA');
      }

      const service = new PromotionService(registry, rateLimiter, dateFallback);

      const result = await service.findPromotions({
        origin: 'GRU',
        destination: 'LIS',
        context: 'interactive',
      });

      expect(result.promotions).toHaveLength(1);
      expect(result.providerUsed).toBe('ProviderB');
      expect(result.allProvidersExhausted).toBe(false);
      expect(fetchA).not.toHaveBeenCalled();
      expect(fetchB).toHaveBeenCalledTimes(1);
    });
  });

  describe('Provider throws error → skipped, next provider is used', () => {
    it('should catch provider error and advance to the next provider', async () => {
      const fetchA = vi.fn(async () => {
        throw new Error('Network timeout');
      });
      const fetchB = vi.fn(async () => [createMockPromotion('ProviderB', 0)]);

      const configs: ProviderConfig[] = [
        createProviderConfig('ProviderA', 1, fetchA),
        createProviderConfig('ProviderB', 2, fetchB),
      ];

      const registry = new ProviderRegistry(configs);
      const rateLimiter = new RateLimiter(registry);
      const dateFallback = new DateFallbackService();
      const service = new PromotionService(registry, rateLimiter, dateFallback);

      const result = await service.findPromotions({
        origin: 'GRU',
        destination: 'LIS',
        context: 'interactive',
      });

      expect(result.promotions).toHaveLength(1);
      expect(result.providerUsed).toBe('ProviderB');
      expect(result.allProvidersExhausted).toBe(false);
      expect(fetchA).toHaveBeenCalledTimes(1);
      expect(fetchB).toHaveBeenCalledTimes(1);
    });
  });

  describe('DateFallbackService integration: fallback dates are used when none provided', () => {
    it('should use DateFallbackService-generated dates when user provides no dates', async () => {
      const fixedNow = new Date(2025, 0, 15); // Jan 15, 2025
      const fixedRandom = 0.5; // deterministic random

      const dateFallback = new DateFallbackService(
        () => fixedNow,
        () => fixedRandom,
      );

      // Expected: departure = Jan 15 + 30 + floor(0.5 * 61) = Jan 15 + 60 = Mar 16, 2025
      // Expected: return = Mar 16 + 7 + floor(0.5 * 8) = Mar 16 + 11 = Mar 27, 2025

      let capturedCriteria: unknown = null;
      const fetchA = vi.fn(async (criteria) => {
        capturedCriteria = criteria;
        return [createMockPromotion('ProviderA', 0)];
      });

      const configs: ProviderConfig[] = [
        createProviderConfig('ProviderA', 1, fetchA),
      ];

      const registry = new ProviderRegistry(configs);
      const rateLimiter = new RateLimiter(registry);
      const service = new PromotionService(registry, rateLimiter, dateFallback);

      const result = await service.findPromotions({
        origin: 'GRU',
        destination: 'LIS',
        context: 'interactive',
        // No departureDate or returnDate provided
      });

      // Verify fallback dates were generated
      expect(result.datesUsed.departureFallback).toBe(true);
      expect(result.datesUsed.returnFallback).toBe(true);
      expect(result.datesUsed.departureDate).toBe('2025-03-16');
      expect(result.datesUsed.returnDate).toBe('2025-03-27');

      // Verify the provider received the fallback dates
      expect(capturedCriteria).toMatchObject({
        dateFrom: '2025-03-16',
        dateTo: '2025-03-27',
      });
    });

    it('should preserve user-provided dates and not generate fallbacks', async () => {
      const fetchA = vi.fn(async () => [createMockPromotion('ProviderA', 0)]);

      const configs: ProviderConfig[] = [
        createProviderConfig('ProviderA', 1, fetchA),
      ];

      const registry = new ProviderRegistry(configs);
      const rateLimiter = new RateLimiter(registry);
      const dateFallback = new DateFallbackService();
      const service = new PromotionService(registry, rateLimiter, dateFallback);

      const result = await service.findPromotions({
        origin: 'GRU',
        destination: 'LIS',
        departureDate: '2025-08-01',
        returnDate: '2025-08-15',
        context: 'interactive',
      });

      expect(result.datesUsed.departureFallback).toBe(false);
      expect(result.datesUsed.returnFallback).toBe(false);
      expect(result.datesUsed.departureDate).toBe('2025-08-01');
      expect(result.datesUsed.returnDate).toBe('2025-08-15');
    });
  });

  describe('FlightAnalysisService integration: aiAnalyses is populated', () => {
    it('should call analysisService and populate aiAnalyses when service is provided', async () => {
      const fetchA = vi.fn(async () => [
        createMockPromotion('ProviderA', 0),
        { ...createMockPromotion('ProviderA', 1), departureDate: '2025-06-20' },
      ]);

      const configs: ProviderConfig[] = [
        createProviderConfig('ProviderA', 1, fetchA),
      ];

      const registry = new ProviderRegistry(configs);
      const rateLimiter = new RateLimiter(registry);
      const dateFallback = new DateFallbackService();

      const mockAnalysisService = {
        analyzePromotions: vi.fn(async (promotions: FlightPromotion[]) => {
          const map = new Map<string, string>();
          for (const p of promotions) {
            map.set(p.id, `✅ Boa oferta para ${p.destination}`);
          }
          return map;
        }),
        analyzePromotion: vi.fn(),
        isAvailable: vi.fn(() => true),
      } as unknown as FlightAnalysisService;

      const service = new PromotionService(registry, rateLimiter, dateFallback, mockAnalysisService);

      const result = await service.findPromotions({
        origin: 'GRU',
        destination: 'LIS',
        context: 'interactive',
      });

      expect(result.aiAnalyses).toBeDefined();
      expect(result.aiAnalyses!.size).toBe(2);
      expect(result.aiAnalyses!.get('promo-ProviderA-0')).toBe('✅ Boa oferta para Lisboa');
      expect(result.aiAnalyses!.get('promo-ProviderA-1')).toBe('✅ Boa oferta para Lisboa');
      expect(mockAnalysisService.analyzePromotions).toHaveBeenCalledTimes(1);
    });

    it('should return undefined aiAnalyses when no analysis service is provided', async () => {
      const fetchA = vi.fn(async () => [createMockPromotion('ProviderA', 0)]);

      const configs: ProviderConfig[] = [
        createProviderConfig('ProviderA', 1, fetchA),
      ];

      const registry = new ProviderRegistry(configs);
      const rateLimiter = new RateLimiter(registry);
      const dateFallback = new DateFallbackService();
      const service = new PromotionService(registry, rateLimiter, dateFallback);

      const result = await service.findPromotions({
        origin: 'GRU',
        destination: 'LIS',
        context: 'interactive',
      });

      expect(result.aiAnalyses).toBeUndefined();
    });

    it('should still return promotions when analysis service throws an error', async () => {
      const fetchA = vi.fn(async () => [createMockPromotion('ProviderA', 0)]);

      const configs: ProviderConfig[] = [
        createProviderConfig('ProviderA', 1, fetchA),
      ];

      const registry = new ProviderRegistry(configs);
      const rateLimiter = new RateLimiter(registry);
      const dateFallback = new DateFallbackService();

      const mockAnalysisService = {
        analyzePromotions: vi.fn(async () => {
          throw new Error('OpenAI API error');
        }),
        analyzePromotion: vi.fn(),
        isAvailable: vi.fn(() => true),
      } as unknown as FlightAnalysisService;

      const service = new PromotionService(registry, rateLimiter, dateFallback, mockAnalysisService);

      const result = await service.findPromotions({
        origin: 'GRU',
        destination: 'LIS',
        context: 'interactive',
      });

      // Promotions should still be returned even if analysis fails
      expect(result.promotions).toHaveLength(1);
      expect(result.providerUsed).toBe('ProviderA');
      expect(result.aiAnalyses).toBeUndefined();
    });
  });

  describe('All providers return empty results → allProvidersExhausted = false (providers were available)', () => {
    it('should return allProvidersExhausted=false when providers are available but return empty arrays', async () => {
      const fetchA = vi.fn(async () => []);
      const fetchB = vi.fn(async () => []);
      const fetchC = vi.fn(async () => []);

      const configs: ProviderConfig[] = [
        createProviderConfig('ProviderA', 1, fetchA),
        createProviderConfig('ProviderB', 2, fetchB),
        createProviderConfig('ProviderC', 3, fetchC),
      ];

      const registry = new ProviderRegistry(configs);
      const rateLimiter = new RateLimiter(registry);
      const dateFallback = new DateFallbackService();
      const service = new PromotionService(registry, rateLimiter, dateFallback);

      const result = await service.findPromotions({
        origin: 'GRU',
        destination: 'LIS',
        context: 'interactive',
      });

      expect(result.promotions).toHaveLength(0);
      expect(result.providerUsed).toBe('');
      // Providers were available (not rate-limited), so allProvidersExhausted is false
      expect(result.allProvidersExhausted).toBe(false);
      // All providers should have been called
      expect(fetchA).toHaveBeenCalledTimes(1);
      expect(fetchB).toHaveBeenCalledTimes(1);
      expect(fetchC).toHaveBeenCalledTimes(1);
    });

    it('should return allProvidersExhausted when all providers are rate-limited', async () => {
      const fetchA = vi.fn(async () => [createMockPromotion('ProviderA', 0)]);
      const fetchB = vi.fn(async () => [createMockPromotion('ProviderB', 0)]);

      const configs: ProviderConfig[] = [
        createProviderConfig('ProviderA', 1, fetchA, {
          limits: { maxRequests: 2, cycle: 'daily', reservedForInteractive: 0 },
        }),
        createProviderConfig('ProviderB', 2, fetchB, {
          limits: { maxRequests: 3, cycle: 'daily', reservedForInteractive: 0 },
        }),
      ];

      const registry = new ProviderRegistry(configs);
      const rateLimiter = new RateLimiter(registry);
      const dateFallback = new DateFallbackService();

      // Exhaust all providers
      rateLimiter.consume('ProviderA');
      rateLimiter.consume('ProviderA');
      rateLimiter.consume('ProviderB');
      rateLimiter.consume('ProviderB');
      rateLimiter.consume('ProviderB');

      const service = new PromotionService(registry, rateLimiter, dateFallback);

      const result = await service.findPromotions({
        origin: 'GRU',
        destination: 'LIS',
        context: 'interactive',
      });

      expect(result.promotions).toHaveLength(0);
      expect(result.providerUsed).toBe('');
      expect(result.allProvidersExhausted).toBe(true);
      expect(fetchA).not.toHaveBeenCalled();
      expect(fetchB).not.toHaveBeenCalled();
    });

    it('should return allProvidersExhausted=false when mix of errors and empty results (providers were available)', async () => {
      const fetchA = vi.fn(async () => {
        throw new Error('Connection refused');
      });
      const fetchB = vi.fn(async () => []);

      const configs: ProviderConfig[] = [
        createProviderConfig('ProviderA', 1, fetchA),
        createProviderConfig('ProviderB', 2, fetchB),
      ];

      const registry = new ProviderRegistry(configs);
      const rateLimiter = new RateLimiter(registry);
      const dateFallback = new DateFallbackService();
      const service = new PromotionService(registry, rateLimiter, dateFallback);

      const result = await service.findPromotions({
        origin: 'GRU',
        destination: 'LIS',
        context: 'interactive',
      });

      expect(result.promotions).toHaveLength(0);
      expect(result.providerUsed).toBe('');
      // Providers were available (not rate-limited), so allProvidersExhausted is false
      expect(result.allProvidersExhausted).toBe(false);
      expect(fetchA).toHaveBeenCalledTimes(1);
      expect(fetchB).toHaveBeenCalledTimes(1);
    });
  });
});
