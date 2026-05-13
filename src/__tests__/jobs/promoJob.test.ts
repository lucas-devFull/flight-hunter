import { describe, it, expect, vi } from 'vitest';
import { ChannelRouter, type RoutableChannel } from '@services/ChannelRouter';
import { PromotionService } from '@services/PromotionService';
import { ProviderRegistry, type ProviderConfig } from '@services/ProviderRegistry';
import { RateLimiter } from '@services/RateLimiter';
import { DateFallbackService } from '@services/DateFallbackService';
import type { FlightProvider } from '@flight-types/FlightProvider';
import type { FlightPromotion } from '@flight-types/FlightPromotion';
import type { FlightAnalysisService } from '@services/FlightAnalysisService';

/**
 * Integration test: PromoJob with ChannelRouter
 *
 * Tests the routing logic that the PromoJob uses:
 * - ChannelRouter classifies promotions to correct channels
 * - 'geral' channel always receives ALL promotions
 * - 'international' channel only receives international flights
 * - 'brazil' channel only receives domestic flights
 * - 'crazy' channel only receives crazy deals
 * - AI analysis map is passed to the notification service
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 9.5
 */

function createPromotion(overrides: Partial<FlightPromotion> = {}): FlightPromotion {
  return {
    id: `promo-${Math.random().toString(36).slice(2, 8)}`,
    provider: 'Aviasales',
    origin: 'GRU',
    originName: 'Guarulhos',
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
    summary: 'GRU → LIS por R$2500',
    bookingUrl: null,
    googleFlightsUrl: 'https://www.google.com/travel/flights',
    score: 85,
    isCrazyDeal: false,
    channels: ['international'],
    ...overrides,
  };
}

function createProviderConfig(
  name: string,
  priority: number,
  fetchFn: FlightProvider['fetchPromotions'],
): ProviderConfig {
  return {
    name,
    priority,
    provider: { name, fetchPromotions: fetchFn },
    allocation: 'both',
    limits: {
      maxRequests: 1000,
      cycle: 'daily',
      reservedForInteractive: 100,
    },
  };
}

describe('Integration: PromoJob with ChannelRouter', () => {
  const channelRouter = new ChannelRouter();

  describe('Channel routing classification for different promotion types', () => {
    // Create promotions with different origin/destination combinations
    const internationalPromo = createPromotion({
      id: 'intl-gru-lis',
      origin: 'GRU',
      destination: 'Lisboa',
      destinationCode: 'LIS',
      destinationCountryCode: 'PT',
      destinationCountry: 'Portugal',
      isCrazyDeal: false,
    });

    const domesticPromo = createPromotion({
      id: 'dom-gru-rec',
      origin: 'GRU',
      destination: 'Recife',
      destinationCode: 'REC',
      destinationCountryCode: 'BR',
      destinationCountry: 'Brazil',
      isCrazyDeal: false,
    });

    const crazyDealPromo = createPromotion({
      id: 'crazy-gru-mad',
      origin: 'GRU',
      destination: 'Madrid',
      destinationCode: 'MAD',
      destinationCountryCode: 'ES',
      destinationCountry: 'Spain',
      isCrazyDeal: true,
    });

    it('international promotion (GRU → LIS) routes to international + geral', () => {
      const channels = channelRouter.route(internationalPromo);

      expect(channels).toContain('geral');
      expect(channels).toContain('international');
      expect(channels).not.toContain('brazil');
      expect(channels).not.toContain('crazy');
    });

    it('domestic promotion (GRU → REC) routes to brazil + geral', () => {
      const channels = channelRouter.route(domesticPromo);

      expect(channels).toContain('geral');
      expect(channels).toContain('brazil');
      expect(channels).not.toContain('international');
      expect(channels).not.toContain('crazy');
    });

    it('crazy deal promotion routes to crazy + international + geral', () => {
      const channels = channelRouter.route(crazyDealPromo);

      expect(channels).toContain('geral');
      expect(channels).toContain('crazy');
      expect(channels).toContain('international');
      expect(channels).not.toContain('brazil');
    });
  });

  describe('Geral channel receives ALL promotions', () => {
    it('geral channel always receives every promotion regardless of type', () => {
      const promotions = [
        createPromotion({ id: 'intl-1', destinationCountryCode: 'PT', isCrazyDeal: false }),
        createPromotion({ id: 'dom-1', destinationCountryCode: 'BR', isCrazyDeal: false }),
        createPromotion({ id: 'crazy-1', destinationCountryCode: 'JP', isCrazyDeal: true }),
        createPromotion({ id: 'intl-2', destinationCountryCode: 'US', isCrazyDeal: false }),
        createPromotion({ id: 'dom-2', destinationCountryCode: 'BR', isCrazyDeal: true }),
      ];

      const geralPromotions = channelRouter.filterForChannel('geral', promotions);

      expect(geralPromotions).toHaveLength(promotions.length);
      expect(geralPromotions.map((p) => p.id).sort()).toEqual(
        promotions.map((p) => p.id).sort(),
      );
    });
  });

  describe('International channel only receives international flights', () => {
    it('international channel receives only flights with destination outside BR', () => {
      const promotions = [
        createPromotion({ id: 'intl-pt', destinationCountryCode: 'PT' }),
        createPromotion({ id: 'dom-br', destinationCountryCode: 'BR' }),
        createPromotion({ id: 'intl-jp', destinationCountryCode: 'JP' }),
        createPromotion({ id: 'dom-br-2', destinationCountryCode: 'BR' }),
        createPromotion({ id: 'intl-us', destinationCountryCode: 'US' }),
      ];

      const internationalPromotions = channelRouter.filterForChannel('international', promotions);

      expect(internationalPromotions).toHaveLength(3);
      expect(internationalPromotions.map((p) => p.id).sort()).toEqual(
        ['intl-jp', 'intl-pt', 'intl-us'],
      );
      // None of the domestic ones should be here
      expect(internationalPromotions.every((p) => p.destinationCountryCode !== 'BR')).toBe(true);
    });
  });

  describe('Brazil channel only receives domestic flights', () => {
    it('brazil channel receives only flights with destination inside BR', () => {
      const promotions = [
        createPromotion({ id: 'intl-pt', destinationCountryCode: 'PT' }),
        createPromotion({ id: 'dom-br-1', destinationCountryCode: 'BR' }),
        createPromotion({ id: 'intl-jp', destinationCountryCode: 'JP' }),
        createPromotion({ id: 'dom-br-2', destinationCountryCode: 'BR' }),
      ];

      const brazilPromotions = channelRouter.filterForChannel('brazil', promotions);

      expect(brazilPromotions).toHaveLength(2);
      expect(brazilPromotions.map((p) => p.id).sort()).toEqual(['dom-br-1', 'dom-br-2']);
      expect(brazilPromotions.every((p) => p.destinationCountryCode === 'BR')).toBe(true);
    });
  });

  describe('Crazy channel only receives crazy deals', () => {
    it('crazy channel receives only promotions with isCrazyDeal=true', () => {
      const promotions = [
        createPromotion({ id: 'normal-1', isCrazyDeal: false, destinationCountryCode: 'PT' }),
        createPromotion({ id: 'crazy-1', isCrazyDeal: true, destinationCountryCode: 'JP' }),
        createPromotion({ id: 'normal-2', isCrazyDeal: false, destinationCountryCode: 'BR' }),
        createPromotion({ id: 'crazy-2', isCrazyDeal: true, destinationCountryCode: 'BR' }),
      ];

      const crazyPromotions = channelRouter.filterForChannel('crazy', promotions);

      expect(crazyPromotions).toHaveLength(2);
      expect(crazyPromotions.map((p) => p.id).sort()).toEqual(['crazy-1', 'crazy-2']);
      expect(crazyPromotions.every((p) => p.isCrazyDeal)).toBe(true);
    });
  });

  describe('PromoJob flow: ChannelRouter builds channel→promotions map correctly', () => {
    it('simulates the PromoJob routing logic with mixed promotions', () => {
      // Simulate what the PromoJob does: route each promotion and build a map
      const freshPromotions = [
        createPromotion({
          id: 'intl-1',
          origin: 'GRU',
          destinationCountryCode: 'PT',
          isCrazyDeal: false,
        }),
        createPromotion({
          id: 'dom-1',
          origin: 'GRU',
          destinationCountryCode: 'BR',
          isCrazyDeal: false,
        }),
        createPromotion({
          id: 'crazy-intl-1',
          origin: 'GIG',
          destinationCountryCode: 'ES',
          isCrazyDeal: true,
        }),
        createPromotion({
          id: 'crazy-dom-1',
          origin: 'VCP',
          destinationCountryCode: 'BR',
          isCrazyDeal: true,
        }),
      ];

      // Replicate the PromoJob channel routing logic
      const channelPromotionsMap = new Map<RoutableChannel, FlightPromotion[]>();

      for (const promotion of freshPromotions) {
        const channels = channelRouter.route(promotion);
        for (const channel of channels) {
          const existing = channelPromotionsMap.get(channel) ?? [];
          existing.push(promotion);
          channelPromotionsMap.set(channel, existing);
        }
      }

      // Geral receives ALL promotions
      expect(channelPromotionsMap.get('geral')).toHaveLength(4);

      // International receives only non-BR destinations
      const intlPromos = channelPromotionsMap.get('international')!;
      expect(intlPromos).toHaveLength(2);
      expect(intlPromos.map((p) => p.id).sort()).toEqual(['crazy-intl-1', 'intl-1']);

      // Brazil receives only BR destinations
      const brPromos = channelPromotionsMap.get('brazil')!;
      expect(brPromos).toHaveLength(2);
      expect(brPromos.map((p) => p.id).sort()).toEqual(['crazy-dom-1', 'dom-1']);

      // Crazy receives only crazy deals
      const crazyPromos = channelPromotionsMap.get('crazy')!;
      expect(crazyPromos).toHaveLength(2);
      expect(crazyPromos.map((p) => p.id).sort()).toEqual(['crazy-dom-1', 'crazy-intl-1']);
    });
  });

  describe('AI analysis integration: analyses map is available for notification', () => {
    it('PromotionService returns aiAnalyses map that would be passed to NotificationService', async () => {
      const promotions = [
        createPromotion({ id: 'promo-1', destinationCountryCode: 'PT', destinationCode: 'LIS', departureDate: '2025-06-15' }),
        createPromotion({ id: 'promo-2', destinationCountryCode: 'BR', destinationCode: 'REC', departureDate: '2025-06-20' }),
        createPromotion({ id: 'promo-3', destinationCountryCode: 'JP', destinationCode: 'NRT', isCrazyDeal: true, departureDate: '2025-06-25' }),
      ];

      const fetchFn = vi.fn(async () => promotions);

      const configs: ProviderConfig[] = [
        createProviderConfig('Aviasales', 1, fetchFn),
      ];

      const registry = new ProviderRegistry(configs);
      const rateLimiter = new RateLimiter(registry);
      const dateFallback = new DateFallbackService();

      const mockAnalysisService = {
        analyzePromotions: vi.fn(async (promos: FlightPromotion[]) => {
          const map = new Map<string, string>();
          for (const p of promos) {
            map.set(p.id, `🤖 Análise para ${p.destination}: preço competitivo`);
          }
          return map;
        }),
        analyzePromotion: vi.fn(),
        isAvailable: vi.fn(() => true),
      } as unknown as FlightAnalysisService;

      const promotionService = new PromotionService(
        registry,
        rateLimiter,
        dateFallback,
        mockAnalysisService,
      );

      // Simulate the cron context (as PromoJob does)
      const result = await promotionService.findPromotions({
        origin: 'GRU',
        destination: '',
        context: 'cron',
      });

      // Verify AI analysis was called
      expect(mockAnalysisService.analyzePromotions).toHaveBeenCalledTimes(1);
      expect(mockAnalysisService.analyzePromotions).toHaveBeenCalledWith(promotions);

      // Verify aiAnalyses map has an entry for each promotion
      expect(result.aiAnalyses).toBeDefined();
      expect(result.aiAnalyses!.size).toBe(3);
      expect(result.aiAnalyses!.has('promo-1')).toBe(true);
      expect(result.aiAnalyses!.has('promo-2')).toBe(true);
      expect(result.aiAnalyses!.has('promo-3')).toBe(true);

      // Simulate what PromoJob does: route promotions and pass aiAnalyses to NotificationService
      const channelPromotionsMap = new Map<RoutableChannel, FlightPromotion[]>();
      for (const promotion of result.promotions) {
        const channels = channelRouter.route(promotion);
        for (const channel of channels) {
          const existing = channelPromotionsMap.get(channel) ?? [];
          existing.push(promotion);
          channelPromotionsMap.set(channel, existing);
        }
      }

      // Verify that for each channel, the aiAnalyses map can provide analysis for each promotion
      for (const channelPromotions of channelPromotionsMap.values()) {
        for (const promotion of channelPromotions) {
          const analysis = result.aiAnalyses!.get(promotion.id);
          expect(analysis).toBeDefined();
          expect(analysis).toContain('Análise para');
        }
      }
    });

    it('PromoJob flow works even when AI analysis is unavailable', async () => {
      const promotions = [
        createPromotion({ id: 'promo-no-ai', destinationCountryCode: 'PT' }),
      ];

      const fetchFn = vi.fn(async () => promotions);

      const configs: ProviderConfig[] = [
        createProviderConfig('Aviasales', 1, fetchFn),
      ];

      const registry = new ProviderRegistry(configs);
      const rateLimiter = new RateLimiter(registry);
      const dateFallback = new DateFallbackService();

      const mockAnalysisService = {
        analyzePromotions: vi.fn(async () => {
          throw new Error('AI service unavailable');
        }),
        analyzePromotion: vi.fn(),
        isAvailable: vi.fn(() => false),
      } as unknown as FlightAnalysisService;

      const promotionService = new PromotionService(
        registry,
        rateLimiter,
        dateFallback,
        mockAnalysisService,
      );

      const result = await promotionService.findPromotions({
        origin: 'GRU',
        destination: '',
        context: 'cron',
      });

      // Promotions are still returned even without AI analysis
      expect(result.promotions).toHaveLength(1);
      expect(result.aiAnalyses).toBeUndefined();

      // Routing still works without AI analysis
      const channels = channelRouter.route(result.promotions[0]);
      expect(channels).toContain('geral');
      expect(channels).toContain('international');
    });
  });
});
