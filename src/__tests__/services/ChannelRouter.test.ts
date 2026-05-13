import { describe, it, expect } from 'vitest';
import { ChannelRouter } from '@services/ChannelRouter';
import type { FlightPromotion } from '@flight-types/FlightPromotion';

/**
 * Unit tests for ChannelRouter
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */

const router = new ChannelRouter();

function createPromotion(overrides: Partial<FlightPromotion> = {}): FlightPromotion {
  return {
    id: 'test-promo-1',
    provider: 'Aviasales',
    origin: 'GRU',
    originName: 'Guarulhos',
    destination: 'Lisboa',
    destinationCode: 'LIS',
    destinationCountryCode: 'PT',
    destinationCountry: 'Portugal',
    price: 2500,
    currency: 'BRL',
    departureDate: '2025-03-15',
    returnDate: '2025-03-25',
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

describe('ChannelRouter — Unit Tests', () => {
  describe('International routing (GRU → LIS)', () => {
    it('routes GRU→LIS (Portugal, PT) to international + geral', () => {
      const promotion = createPromotion({
        origin: 'GRU',
        destinationCode: 'LIS',
        destinationCountryCode: 'PT',
        destinationCountry: 'Portugal',
      });

      const channels = router.route(promotion);

      expect(channels).toContain('geral');
      expect(channels).toContain('international');
      expect(channels).not.toContain('brazil');
    });
  });

  describe('Domestic routing (GRU → REC)', () => {
    it('routes GRU→REC (Brazil, BR) to brazil + geral', () => {
      const promotion = createPromotion({
        origin: 'GRU',
        destination: 'Recife',
        destinationCode: 'REC',
        destinationCountryCode: 'BR',
        destinationCountry: 'Brazil',
      });

      const channels = router.route(promotion);

      expect(channels).toContain('geral');
      expect(channels).toContain('brazil');
      expect(channels).not.toContain('international');
    });
  });

  describe('Crazy deal routing', () => {
    it('includes "crazy" channel when isCrazyDeal is true', () => {
      const promotion = createPromotion({
        isCrazyDeal: true,
        destinationCountryCode: 'PT',
      });

      const channels = router.route(promotion);

      expect(channels).toContain('crazy');
      expect(channels).toContain('geral');
      expect(channels).toContain('international');
    });

    it('does not include "crazy" channel when isCrazyDeal is false', () => {
      const promotion = createPromotion({
        isCrazyDeal: false,
      });

      const channels = router.route(promotion);

      expect(channels).not.toContain('crazy');
    });

    it('crazy deal to Brazil includes brazil + crazy + geral', () => {
      const promotion = createPromotion({
        isCrazyDeal: true,
        origin: 'GIG',
        destinationCode: 'SSA',
        destinationCountryCode: 'BR',
        destinationCountry: 'Brazil',
      });

      const channels = router.route(promotion);

      expect(channels).toContain('geral');
      expect(channels).toContain('crazy');
      expect(channels).toContain('brazil');
      expect(channels).not.toContain('international');
    });
  });

  describe('Geral channel always present', () => {
    it('always includes "geral" regardless of destination', () => {
      const international = createPromotion({ destinationCountryCode: 'JP' });
      const domestic = createPromotion({ destinationCountryCode: 'BR' });

      expect(router.route(international)).toContain('geral');
      expect(router.route(domestic)).toContain('geral');
    });
  });

  describe('filterForChannel', () => {
    it('filters promotions for a specific channel', () => {
      const promotions = [
        createPromotion({ id: '1', destinationCountryCode: 'PT' }),
        createPromotion({ id: '2', destinationCountryCode: 'BR' }),
        createPromotion({ id: '3', destinationCountryCode: 'JP' }),
      ];

      const international = router.filterForChannel('international', promotions);
      const brazil = router.filterForChannel('brazil', promotions);
      const geral = router.filterForChannel('geral', promotions);

      expect(international).toHaveLength(2); // PT and JP
      expect(brazil).toHaveLength(1); // BR
      expect(geral).toHaveLength(3); // all
    });

    it('returns empty array when no promotions match channel', () => {
      const promotions = [
        createPromotion({ id: '1', destinationCountryCode: 'BR', isCrazyDeal: false }),
      ];

      const crazy = router.filterForChannel('crazy', promotions);

      expect(crazy).toHaveLength(0);
    });
  });
});
