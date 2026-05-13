import type { AviasalesDeal } from '../types/deal.types';

/** Thresholds de preço por região (BRL) */
const PRICE_THRESHOLDS: Record<string, number> = {
  domestic: 400,
  south_america: 1200,
  usa: 2500,
  europe: 3500,
  asia: 4500,
};

const SOUTH_AMERICA = ['SCL', 'EZE', 'BOG', 'LIM', 'CUZ', 'CTG', 'MVD', 'ASU'];
const USA = ['MIA', 'JFK', 'MCO', 'LAX', 'EWR', 'ORD', 'ATL'];
const EUROPE = ['LIS', 'MAD', 'BCN', 'CDG', 'FCO', 'MXP', 'LHR', 'AMS', 'FRA'];
const ASIA = ['NRT', 'KIX', 'BKK', 'HKT', 'PEK', 'PVG', 'ICN'];

function getRegion(destination: string): string {
  if (SOUTH_AMERICA.includes(destination)) return 'south_america';
  if (USA.includes(destination)) return 'usa';
  if (EUROPE.includes(destination)) return 'europe';
  if (ASIA.includes(destination)) return 'asia';
  return 'domestic';
}

/**
 * Calcula score de 0-100 para um deal.
 *
 * score = priceScore * 0.4 + transferScore * 0.3 + freshnessScore * 0.2 + tripDaysScore * 0.1
 */
export function scoreDeal(deal: AviasalesDeal): number {
  const region = getRegion(deal.destination);
  const threshold = PRICE_THRESHOLDS[region] ?? 3000;

  // Price score: quanto mais barato em relação ao threshold, melhor
  const priceRatio = deal.price / threshold;
  const priceScore = Math.max(0, Math.min(100, (1 - (priceRatio - 0.3)) * 100));

  // Transfer score: direto = 100, 1 parada = 70, 2+ = 40
  const transfers = deal.transfers ?? 0;
  const transferScore = transfers === 0 ? 100 : transfers === 1 ? 70 : 40;

  // Freshness: quão recente foi encontrado (últimas 24h = 100, 7d = 50, mais = 20)
  const hoursAgo = (Date.now() - new Date(deal.foundAt).getTime()) / 3_600_000;
  const freshnessScore = hoursAgo <= 24 ? 100 : hoursAgo <= 168 ? 50 : 20;

  // Trip days: viagens de 5-14 dias são ideais
  const tripDays = deal.tripDays ?? 7;
  const tripDaysScore = tripDays >= 5 && tripDays <= 14 ? 100 : tripDays >= 3 && tripDays <= 21 ? 70 : 40;

  const score = Math.round(
    priceScore * 0.4 +
    transferScore * 0.3 +
    freshnessScore * 0.2 +
    tripDaysScore * 0.1,
  );

  return Math.max(0, Math.min(100, score));
}

/** Verifica se o deal atinge threshold de "crazy deal" */
export function isCrazyDeal(deal: AviasalesDeal): boolean {
  const region = getRegion(deal.destination);
  const threshold = PRICE_THRESHOLDS[region] ?? 3000;
  return deal.price <= threshold * 0.6;
}
