import { describe, it, expect } from 'vitest';
import { buildPromotionEmbed } from '@embeds/PromoEmbed';
import type { FlightPromotion } from '@flight-types/FlightPromotion';

/**
 * Unit tests for PromoEmbed — Google Flights URL handling
 *
 * Validates: Requirements 10.1, 10.3, 10.5, 10.6
 */

function createBasePromotion(overrides: Partial<FlightPromotion> = {}): FlightPromotion {
  return {
    id: 'test-promo-1',
    provider: 'Kiwi',
    origin: 'GRU',
    originName: 'São Paulo',
    destination: 'Lisboa',
    destinationCode: 'LIS',
    destinationCountryCode: 'PT',
    destinationCountry: 'Portugal',
    price: 2500,
    currency: 'BRL',
    departureDate: '2025-08-15',
    returnDate: '2025-08-25',
    airline: 'TAP',
    stops: 0,
    stopoverCities: null,
    durationMinutes: 600,
    summary: 'Voo direto GRU→LIS com ótimo preço',
    bookingUrl: 'https://www.kiwi.com/booking/123',
    googleFlightsUrl: 'https://www.google.com/travel/flights?tfs=abc123',
    score: 85,
    isCrazyDeal: false,
    channels: ['international'],
    ...overrides,
  };
}

describe('PromoEmbed — Google Flights URL', () => {
  describe('Req 10.1, 10.3: googleFlightsUrl como link principal', () => {
    it('deve usar googleFlightsUrl como URL do embed quando preenchida', () => {
      const promo = createBasePromotion({
        googleFlightsUrl: 'https://www.google.com/travel/flights?tfs=xyz789',
      });

      const embed = buildPromotionEmbed(promo);

      expect(embed.data.url).toBe('https://www.google.com/travel/flights?tfs=xyz789');
    });
  });

  describe('Req 10.5: fallback para bookingUrl quando googleFlightsUrl está vazio', () => {
    it('deve usar bookingUrl quando googleFlightsUrl é string vazia', () => {
      const promo = createBasePromotion({
        googleFlightsUrl: '',
        bookingUrl: 'https://www.kiwi.com/booking/456',
      });

      const embed = buildPromotionEmbed(promo);

      expect(embed.data.url).toBe('https://www.kiwi.com/booking/456');
    });

    it('deve lançar erro quando ambos googleFlightsUrl e bookingUrl estão vazios (Discord rejeita URL vazia)', () => {
      const promo = createBasePromotion({
        googleFlightsUrl: '',
        bookingUrl: null,
      });

      expect(() => buildPromotionEmbed(promo)).toThrow();
    });
  });

  describe('Req 10.6: footer indica Google Flights', () => {
    it('deve indicar Google Flights no footer quando googleFlightsUrl está presente', () => {
      const promo = createBasePromotion({
        googleFlightsUrl: 'https://www.google.com/travel/flights?tfs=abc',
      });

      const embed = buildPromotionEmbed(promo);

      expect(embed.data.footer?.text).toContain('Google Flights');
    });

    it('deve indicar site do provider no footer quando googleFlightsUrl está vazio', () => {
      const promo = createBasePromotion({
        googleFlightsUrl: '',
        bookingUrl: 'https://www.kiwi.com/booking/789',
      });

      const embed = buildPromotionEmbed(promo);

      expect(embed.data.footer?.text).toContain('site do provider');
      expect(embed.data.footer?.text).not.toContain('Google Flights');
    });
  });

  describe('Campo de análise IA e indicador de dateFallback', () => {
    it('deve exibir campo de análise IA quando aiAnalysis é fornecido', () => {
      const promo = createBasePromotion();
      const aiAnalysis = 'Preço excelente para Lisboa nesta época do ano.';

      const embed = buildPromotionEmbed(promo, aiAnalysis);

      const aiField = embed.data.fields?.find((f) => f.name.includes('Análise IA'));
      expect(aiField).toBeDefined();
      expect(aiField?.value).toBe(aiAnalysis);
    });

    it('não deve exibir campo de análise IA quando aiAnalysis não é fornecido', () => {
      const promo = createBasePromotion();

      const embed = buildPromotionEmbed(promo);

      const aiField = embed.data.fields?.find((f) => f.name.includes('Análise IA'));
      expect(aiField).toBeUndefined();
    });

    it('deve exibir indicador de data gerada automaticamente quando dateFallback=true', () => {
      const promo = createBasePromotion();

      const embed = buildPromotionEmbed(promo, undefined, true);

      const dateField = embed.data.fields?.find((f) => f.name.includes('Datas'));
      expect(dateField).toBeDefined();
      expect(dateField?.value).toContain('Data gerada automaticamente');
    });

    it('não deve exibir indicador de data gerada quando dateFallback=false', () => {
      const promo = createBasePromotion();

      const embed = buildPromotionEmbed(promo, undefined, false);

      const dateField = embed.data.fields?.find((f) => f.name.includes('Datas'));
      expect(dateField).toBeDefined();
      expect(dateField?.value).not.toContain('Data gerada automaticamente');
    });
  });
});
