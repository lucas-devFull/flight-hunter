import { describe, it, expect, vi } from 'vitest';
import { PromotionService } from '@services/PromotionService';
import { ProviderRegistry, type ProviderConfig } from '@services/ProviderRegistry';
import { RateLimiter } from '@services/RateLimiter';
import { DateFallbackService } from '@services/DateFallbackService';
import type { FlightProvider } from '@flight-types/FlightProvider';
import type { FlightPromotion } from '@flight-types/FlightPromotion';
import type { FlightAnalysisService } from '@services/FlightAnalysisService';

/**
 * Teste de integração do fluxo completo do comando /promocoes.
 *
 * Testa o fluxo end-to-end na camada de serviço:
 * - ProviderRegistry com mock providers
 * - RateLimiter
 * - DateFallbackService com tempo fixo
 * - FlightAnalysisService mock
 * - PromotionService orquestrando tudo
 *
 * Validates: Requirements 1.4, 5.5, 5.6, 6.2, 6.4, 4.2, 9.1, 9.3
 */

function createMockPromotion(
  providerName: string,
  overrides: Partial<FlightPromotion> = {},
): FlightPromotion {
  return {
    id: `promo-${providerName}-${Math.random().toString(36).slice(2, 8)}`,
    provider: providerName,
    origin: 'GRU',
    originName: 'São Paulo',
    destination: 'Lisboa',
    destinationCode: 'LIS',
    destinationCountryCode: 'PT',
    destinationCountry: 'Portugal',
    price: 2500,
    currency: 'BRL',
    departureDate: '2025-06-15',
    returnDate: '2025-06-25',
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
    ...overrides,
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

describe('Integration: /promocoes command flow', () => {
  describe('Sequential search: first provider empty, second returns results', () => {
    it('should call all providers and merge results from those that return data', async () => {
      const fetchA = vi.fn(async () => []);
      const fetchB = vi.fn(async () => [
        createMockPromotion('ProviderB', { id: 'b-1', stops: 1, departureDate: '2025-06-15' }),
        createMockPromotion('ProviderB', { id: 'b-2', stops: 0, departureDate: '2025-06-20' }),
      ]);
      const fetchC = vi.fn(async () => [
        createMockPromotion('ProviderC', { id: 'c-1', departureDate: '2025-07-01' }),
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
        destination: 'LIS',
        context: 'interactive',
      });

      // All providers should be called (new behavior: consult ALL)
      expect(fetchA).toHaveBeenCalledTimes(1);
      expect(fetchB).toHaveBeenCalledTimes(1);
      expect(fetchC).toHaveBeenCalledTimes(1);

      // Results from ProviderB and ProviderC are merged
      expect(result.promotions).toHaveLength(3);
      expect(result.providerUsed).toBe('ProviderB, ProviderC');
      expect(result.allProvidersExhausted).toBe(false);
    });
  });

  describe('Date fallback: no dates provided → fallback dates generated in correct range', () => {
    it('should generate departure date 30-90 days ahead and return date 7-14 days after departure', async () => {
      const fixedNow = new Date(2025, 0, 1); // Jan 1, 2025
      const fixedRandom = 0.0; // minimum random → min days

      const dateFallback = new DateFallbackService(
        () => fixedNow,
        () => fixedRandom,
      );

      const fetchA = vi.fn(async () => [createMockPromotion('ProviderA', { id: 'a-1' })]);

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
        // No dates provided
      });

      // With random=0.0: departure = Jan 1 + 30 + floor(0 * 61) = Jan 1 + 30 = Jan 31
      expect(result.datesUsed.departureFallback).toBe(true);
      expect(result.datesUsed.departureDate).toBe('2025-01-31');

      // Return = Jan 31 + 7 + floor(0 * 8) = Jan 31 + 7 = Feb 7
      expect(result.datesUsed.returnFallback).toBe(true);
      expect(result.datesUsed.returnDate).toBe('2025-02-07');

      // Verify the departure date is within 30-90 days from now
      const depDate = new Date(result.datesUsed.departureDate);
      const diffDays = Math.round((depDate.getTime() - fixedNow.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(30);
      expect(diffDays).toBeLessThanOrEqual(90);

      // Verify return date is 7-14 days after departure
      const retDate = new Date(result.datesUsed.returnDate!);
      const returnDiff = Math.round((retDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(returnDiff).toBeGreaterThanOrEqual(7);
      expect(returnDiff).toBeLessThanOrEqual(14);
    });

    it('should generate dates at the upper bound with random=1.0', async () => {
      const fixedNow = new Date(2025, 0, 1); // Jan 1, 2025
      // random just below 1.0 to get max days: floor(0.99 * 61) = 60, so departure = 30+60=90
      const fixedRandom = 0.99;

      const dateFallback = new DateFallbackService(
        () => fixedNow,
        () => fixedRandom,
      );

      const fetchA = vi.fn(async () => [createMockPromotion('ProviderA', { id: 'a-1' })]);

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
      });

      expect(result.datesUsed.departureFallback).toBe(true);
      expect(result.datesUsed.returnFallback).toBe(true);

      // Verify departure is within valid range
      const depDate = new Date(result.datesUsed.departureDate);
      const diffDays = Math.round((depDate.getTime() - fixedNow.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(30);
      expect(diffDays).toBeLessThanOrEqual(90);

      // Verify return is within valid range from departure
      const retDate = new Date(result.datesUsed.returnDate!);
      const returnDiff = Math.round((retDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(returnDiff).toBeGreaterThanOrEqual(7);
      expect(returnDiff).toBeLessThanOrEqual(14);
    });
  });

  describe('Stops filter: results with various stops → filtering works', () => {
    it('should filter promotions by maxStops at the command level', async () => {
      // Simulate what the command does: get results then filter
      // Each promotion has a different departure date to avoid deduplication
      const promotionsFromProvider = [
        createMockPromotion('ProviderA', { id: 'direct', stops: 0, departureDate: '2025-06-15' }),
        createMockPromotion('ProviderA', { id: 'one-stop', stops: 1, departureDate: '2025-06-16' }),
        createMockPromotion('ProviderA', { id: 'two-stops', stops: 2, departureDate: '2025-06-17' }),
        createMockPromotion('ProviderA', { id: 'three-stops', stops: 3, departureDate: '2025-06-18' }),
      ];

      const fetchA = vi.fn(async () => promotionsFromProvider);

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
        maxStops: 1,
        context: 'interactive',
      });

      // PromotionService returns all results (maxStops is passed to provider criteria)
      // The command layer applies the filter after receiving results
      const escalasMax = 1;
      const filtered = result.promotions.filter((p) => p.stops <= escalasMax);

      expect(filtered).toHaveLength(2);
      expect(filtered.every((p) => p.stops <= 1)).toBe(true);
      expect(filtered.map((p) => p.id)).toContain('direct');
      expect(filtered.map((p) => p.id)).toContain('one-stop');
      expect(filtered.map((p) => p.id)).not.toContain('two-stops');
      expect(filtered.map((p) => p.id)).not.toContain('three-stops');
    });

    it('should return only direct flights when escalas_max is 0', async () => {
      // Each promotion has a different departure date to avoid deduplication
      const promotionsFromProvider = [
        createMockPromotion('ProviderA', { id: 'direct-1', stops: 0, departureDate: '2025-06-15' }),
        createMockPromotion('ProviderA', { id: 'direct-2', stops: 0, departureDate: '2025-06-16' }),
        createMockPromotion('ProviderA', { id: 'one-stop', stops: 1, departureDate: '2025-06-17' }),
      ];

      const fetchA = vi.fn(async () => promotionsFromProvider);

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
        maxStops: 0,
        context: 'interactive',
      });

      const escalasMax = 0;
      const filtered = result.promotions.filter((p) => p.stops <= escalasMax);

      expect(filtered).toHaveLength(2);
      expect(filtered.every((p) => p.stops === 0)).toBe(true);
    });
  });

  describe('AI analysis: FlightAnalysisService is called and results are in aiAnalyses', () => {
    it('should call analyzePromotions after getting results and include analyses in result', async () => {
      const promotions = [
        createMockPromotion('ProviderA', { id: 'promo-1', destination: 'Lisboa', departureDate: '2025-06-15' }),
        createMockPromotion('ProviderA', { id: 'promo-2', destination: 'Lisboa', departureDate: '2025-06-20' }),
        createMockPromotion('ProviderA', { id: 'promo-3', destination: 'Lisboa', departureDate: '2025-06-25' }),
      ];

      const fetchA = vi.fn(async () => promotions);

      const configs: ProviderConfig[] = [
        createProviderConfig('ProviderA', 1, fetchA),
      ];

      const registry = new ProviderRegistry(configs);
      const rateLimiter = new RateLimiter(registry);
      const dateFallback = new DateFallbackService();

      const mockAnalysisService = {
        analyzePromotions: vi.fn(async (promos: FlightPromotion[]) => {
          const map = new Map<string, string>();
          for (const p of promos) {
            map.set(p.id, `✅ Boa oferta para ${p.destination}`);
          }
          return map;
        }),
        analyzePromotion: vi.fn(),
        isAvailable: vi.fn(() => true),
      } as unknown as FlightAnalysisService;

      const service = new PromotionService(
        registry,
        rateLimiter,
        dateFallback,
        mockAnalysisService,
      );

      const result = await service.findPromotions({
        origin: 'GRU',
        destination: 'LIS',
        context: 'interactive',
      });

      // Verify analyzePromotions was called with the promotions
      expect(mockAnalysisService.analyzePromotions).toHaveBeenCalledTimes(1);
      expect(mockAnalysisService.analyzePromotions).toHaveBeenCalledWith(promotions);

      // Verify aiAnalyses map is populated for each promotion
      expect(result.aiAnalyses).toBeDefined();
      expect(result.aiAnalyses!.size).toBe(3);
      expect(result.aiAnalyses!.get('promo-1')).toBe('✅ Boa oferta para Lisboa');
      expect(result.aiAnalyses!.get('promo-2')).toBe('✅ Boa oferta para Lisboa');
      expect(result.aiAnalyses!.get('promo-3')).toBe('✅ Boa oferta para Lisboa');
    });

    it('should still return promotions when AI analysis fails gracefully', async () => {
      const promotions = [
        createMockPromotion('ProviderA', { id: 'promo-1' }),
      ];

      const fetchA = vi.fn(async () => promotions);

      const configs: ProviderConfig[] = [
        createProviderConfig('ProviderA', 1, fetchA),
      ];

      const registry = new ProviderRegistry(configs);
      const rateLimiter = new RateLimiter(registry);
      const dateFallback = new DateFallbackService();

      const mockAnalysisService = {
        analyzePromotions: vi.fn(async () => {
          throw new Error('OpenAI quota exceeded');
        }),
        analyzePromotion: vi.fn(),
        isAvailable: vi.fn(() => true),
      } as unknown as FlightAnalysisService;

      const service = new PromotionService(
        registry,
        rateLimiter,
        dateFallback,
        mockAnalysisService,
      );

      const result = await service.findPromotions({
        origin: 'GRU',
        destination: 'LIS',
        context: 'interactive',
      });

      // Promotions should still be returned
      expect(result.promotions).toHaveLength(1);
      expect(result.providerUsed).toBe('ProviderA');
      // AI analyses should be undefined when service throws
      expect(result.aiAnalyses).toBeUndefined();
    });
  });

  describe('All providers exhausted: all rate-limited → allProvidersExhausted', () => {
    it('should return allProvidersExhausted when all providers are rate-limited', async () => {
      const fetchA = vi.fn(async () => [createMockPromotion('ProviderA')]);
      const fetchB = vi.fn(async () => [createMockPromotion('ProviderB')]);
      const fetchC = vi.fn(async () => [createMockPromotion('ProviderC')]);

      const configs: ProviderConfig[] = [
        createProviderConfig('ProviderA', 1, fetchA, {
          limits: { maxRequests: 2, cycle: 'daily', reservedForInteractive: 0 },
        }),
        createProviderConfig('ProviderB', 2, fetchB, {
          limits: { maxRequests: 3, cycle: 'daily', reservedForInteractive: 0 },
        }),
        createProviderConfig('ProviderC', 3, fetchC, {
          limits: { maxRequests: 1, cycle: 'daily', reservedForInteractive: 0 },
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
      rateLimiter.consume('ProviderC');

      const service = new PromotionService(registry, rateLimiter, dateFallback);

      const result = await service.findPromotions({
        origin: 'GRU',
        destination: 'LIS',
        context: 'interactive',
      });

      // No providers should be called since all are exhausted
      expect(fetchA).not.toHaveBeenCalled();
      expect(fetchB).not.toHaveBeenCalled();
      expect(fetchC).not.toHaveBeenCalled();

      // Result should indicate all exhausted
      expect(result.promotions).toHaveLength(0);
      expect(result.providerUsed).toBe('');
      expect(result.allProvidersExhausted).toBe(true);
    });
  });
});
