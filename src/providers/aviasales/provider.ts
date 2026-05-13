import { buildGoogleFlightsUrl } from '@utils/googleFlights';
import { logger } from '@utils/logger';

import type { FlightPromotion } from '@flight-types/FlightPromotion';
import type { FlightProvider, PromotionSearchCriteria } from '@flight-types/FlightProvider';

import { AviasalesClient } from './client';
import { CACHE_TTL, MemoryCache } from './cache/cache.keys';
import { getCityNameSync, preloadCities } from './metadata/city-lookup';
import { normalizeCheapFlight, normalizeLatestFlight } from './normalizers/deal.normalizer';
import { isCrazyDeal, scoreDeal } from './scoring/score.engine';
import { validateDeal } from './validators/deal.validator';
import type { AviasalesDeal } from './types/deal.types';

/** Hubs brasileiros para scan */
const BRAZIL_HUBS = ['GRU', 'CGH', 'VCP', 'GIG', 'SDU', 'BSB', 'CNF', 'REC', 'FOR'] as const;

/** Destinos internacionais prioritários */
const INTERNATIONAL_DESTINATIONS = [
  'MIA', 'JFK', 'MCO', 'LAX',
  'LIS', 'MAD', 'BCN', 'CDG', 'FCO', 'MXP', 'LHR',
  'SCL', 'EZE', 'BOG', 'LIM',
  'NRT', 'BKK',
  'CUN',
] as const;

/** Destinos domésticos populares (códigos de cidade Aviasales) */
const DOMESTIC_DESTINATIONS = [
  'RIO', 'BHZ', 'CWB', 'POA', 'BSB', 'REC', 'FOR', 'SSA',
  'FLN', 'CGB', 'BEL', 'MAO', 'NAT', 'MCZ', 'IGU',
] as const;

/** Mapa IATA → país */
const DESTINATION_COUNTRY: Record<string, string> = {
  MIA: 'US', JFK: 'US', MCO: 'US', LAX: 'US',
  LIS: 'PT', MAD: 'ES', BCN: 'ES', CDG: 'FR', FCO: 'IT', MXP: 'IT', LHR: 'GB',
  SCL: 'CL', EZE: 'AR', BOG: 'CO', LIM: 'PE',
  NRT: 'JP', BKK: 'TH',
  CUN: 'MX',
};

const COUNTRY_NAMES: Record<string, string> = {
  US: 'Estados Unidos', PT: 'Portugal', ES: 'Espanha', FR: 'Franca',
  IT: 'Italia', GB: 'Inglaterra', CL: 'Chile', AR: 'Argentina',
  CO: 'Colombia', PE: 'Peru', JP: 'Japao', TH: 'Tailandia', MX: 'Mexico',
};

/** Códigos de cidade/aeroporto brasileiros */
const BRAZIL_CODES = new Set([
  'GRU', 'CGH', 'VCP', 'GIG', 'SDU', 'BSB', 'CNF', 'REC', 'FOR',
  'SAO', 'RIO', 'BHZ', 'CWB', 'POA', 'SSA', 'FLN', 'CGB', 'BEL',
  'MAO', 'NAT', 'MCZ', 'AJU', 'VIX', 'GYN', 'SLZ', 'THE', 'JPA',
  'IGU', 'LDB', 'MGF', 'RAO', 'UDI', 'JOI', 'NVT', 'CFB', 'CAW',
  'XAP', 'CAC', 'PFB', 'BPS', 'MOC', 'CGR', 'PMW', 'CXJ', 'PNZ',
  'PET', 'JDO', 'JDF', 'IOS', 'NVT', 'GYN', 'PPB', 'MII', 'JTC', 'SJP',
]);

export class AviasalesProvider implements FlightProvider {
  readonly name = 'Aviasales Data';

  private readonly client: AviasalesClient;
  private readonly resultsCache = new MemoryCache<AviasalesDeal[]>();

  constructor(token: string) {
    this.client = new AviasalesClient(token);
  }

  async fetchPromotions(criteria: PromotionSearchCriteria = {}): Promise<FlightPromotion[]> {
    const origins = criteria.origins || BRAZIL_HUBS.slice(0, 3);
    const limit = criteria.limit || 10;

    logger.info(
      { origins: origins.slice(0, 3), limit, channel: criteria.channel },
      '[Aviasales] Iniciando busca de promoções',
    );

    try {
      await preloadCities();
      return await this.doFetchPromotions(origins, limit, criteria);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      logger.error({ msg: errMsg, stack: errStack }, '[Aviasales] Erro no fetchPromotions');
      throw error;
    }
  }

  private async doFetchPromotions(
    origins: readonly string[],
    limit: number,
    criteria: PromotionSearchCriteria,
  ): Promise<FlightPromotion[]> {
    const allDeals: AviasalesDeal[] = [];
    const destinations = this.getDestinationsForCriteria(criteria);

    // Buscar via /v2/prices/latest para destinos específicos
    for (const origin of origins.slice(0, 3)) {
      for (const dest of destinations.slice(0, 8)) {
        const cacheKey = `latest:${origin}:${dest}`;
        const cached = this.resultsCache.get(cacheKey);
        if (cached) {
          allDeals.push(...cached);
          continue;
        }

        const response = await this.client.fetchLatest(origin, dest);
        if (!response?.success || !response.data) continue;

        const deals = response.data.map(normalizeLatestFlight);
        this.resultsCache.set(cacheKey, deals, CACHE_TTL.latestPrices);
        allDeals.push(...deals);
      }

      if (allDeals.length >= limit * 3) break;
    }

    // Buscar via /v1/prices/cheap para complementar
    for (const origin of origins.slice(0, 2)) {
      const cacheKeyCheap = `cheap:${origin}`;
      const cachedCheap = this.resultsCache.get(cacheKeyCheap);
      if (cachedCheap) {
        allDeals.push(...cachedCheap);
        continue;
      }

      const cheapResponse = await this.client.fetchCheap(origin);
      if (!cheapResponse?.success || !cheapResponse.data) continue;

      const cheapDeals: AviasalesDeal[] = [];
      for (const [dest, flights] of Object.entries(cheapResponse.data)) {
        for (const [transferKey, flight] of Object.entries(flights)) {
          const transfers = parseInt(transferKey, 10) || 0;
          cheapDeals.push(normalizeCheapFlight(origin, dest, flight, transfers));
        }
      }
      this.resultsCache.set(cacheKeyCheap, cheapDeals, CACHE_TTL.cheapPrices);
      allDeals.push(...cheapDeals);
    }

    // Pipeline: validate → score → deduplicate → filter → sort → limit
    const validated = allDeals.filter(validateDeal);
    const scored = validated.map((deal) => ({ ...deal, score: scoreDeal(deal) }));
    const deduplicated = this.deduplicate(scored);
    const filtered = this.filterByCriteria(deduplicated, criteria);
    const sorted = filtered.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const limited = sorted.slice(0, limit);

    logger.info(
      { total: allDeals.length, validated: validated.length, filtered: filtered.length, final: limited.length },
      '[Aviasales] Pipeline finalizado',
    );

    return limited.map((deal) => this.toFlightPromotion(deal));
  }

  private getDestinationsForCriteria(criteria: PromotionSearchCriteria): string[] {
    // Se destinos específicos foram passados (código IATA), usar diretamente
    if (criteria.destinations && criteria.destinations.length > 0) {
      return [...criteria.destinations];
    }

    if (criteria.destinationCountryCodes && criteria.destinationCountryCodes.length > 0) {
      return INTERNATIONAL_DESTINATIONS.filter(
        (dest) => criteria.destinationCountryCodes!.includes(DESTINATION_COUNTRY[dest] ?? ''),
      );
    }

    const channel = criteria.channel || 'all';
    if (channel === 'brazil') return [...DOMESTIC_DESTINATIONS];
    if (channel === 'international') return [...INTERNATIONAL_DESTINATIONS];
    return [...INTERNATIONAL_DESTINATIONS, ...DOMESTIC_DESTINATIONS.slice(0, 5)];
  }

  private filterByCriteria(deals: AviasalesDeal[], criteria: PromotionSearchCriteria): AviasalesDeal[] {
    const channel = criteria.channel || 'all';

    return deals.filter((deal) => {
      if (channel === 'international' && BRAZIL_CODES.has(deal.destination)) return false;
      if (channel === 'brazil' && !BRAZIL_CODES.has(deal.destination)) return false;

      if (criteria.dateFrom && new Date(deal.departureAt) < new Date(criteria.dateFrom)) return false;
      if (criteria.dateTo && new Date(deal.departureAt) > new Date(criteria.dateTo)) return false;
      if (criteria.maxStopovers !== undefined && (deal.transfers ?? 0) > criteria.maxStopovers) return false;
      if (criteria.destinationCountryCodes && criteria.destinationCountryCodes.length > 0) {
        const country = DESTINATION_COUNTRY[deal.destination];
        if (!country || !criteria.destinationCountryCodes.includes(country)) return false;
      }
      return true;
    });
  }

  private deduplicate(deals: AviasalesDeal[]): AviasalesDeal[] {
    const seen = new Set<string>();
    return deals.filter((deal) => {
      const key = `${deal.origin}:${deal.destination}:${deal.departureAt.split('T')[0]}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private toFlightPromotion(deal: AviasalesDeal): FlightPromotion {
    const destCity = deal.destinationCity || getCityNameSync(deal.destination);
    const originCity = deal.originCity || getCityNameSync(deal.origin);
    const destCountryCode = DESTINATION_COUNTRY[deal.destination] || '';
    const destCountry = COUNTRY_NAMES[destCountryCode] || destCountryCode;
    const score = deal.score ?? 50;
    const crazy = isCrazyDeal(deal);
    const departureDate = deal.departureAt.split('T')[0];
    const returnDate = deal.returnAt ? deal.returnAt.split('T')[0] : null;

    return {
      id: `aviasales-${deal.origin}-${deal.destination}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      provider: `${this.name} (${deal.source})`,
      origin: deal.origin,
      originName: originCity,
      destination: destCity,
      destinationCode: deal.destination,
      destinationCountryCode: destCountryCode,
      destinationCountry: destCountry,
      price: deal.price,
      currency: 'BRL',
      departureDate,
      returnDate,
      airline: deal.airline || null,
      stops: deal.transfers ?? 0,
      stopoverCities: null,
      durationMinutes: null,
      summary: `${originCity} → ${destCity} via ${deal.airline || 'Diversas'}${(deal.transfers ?? 0) > 0 ? ` (${deal.transfers} parada${(deal.transfers ?? 0) > 1 ? 's' : ''})` : ''}`,
      bookingUrl: this.buildBookingUrl(deal),
      googleFlightsUrl: buildGoogleFlightsUrl({
        origin: deal.origin,
        destinationCode: deal.destination,
        destinationName: destCity,
        departureDate,
        returnDate,
      }),
      score: Math.round(score),
      isCrazyDeal: crazy,
      channels: this.resolveChannels(deal, crazy),
    };
  }

  private resolveChannels(deal: AviasalesDeal, crazy: boolean): FlightPromotion['channels'] {
    const channels: FlightPromotion['channels'] = [];
    const isInternational = DESTINATION_COUNTRY[deal.destination] !== undefined
      && !BRAZIL_CODES.has(deal.destination);

    channels.push(isInternational ? 'international' : 'brazil');
    if (crazy) channels.push('crazy');
    return channels;
  }

  private buildBookingUrl(deal: AviasalesDeal): string {
    const depDate = new Date(deal.departureAt);
    const depDDMM = `${String(depDate.getDate()).padStart(2, '0')}${String(depDate.getMonth() + 1).padStart(2, '0')}`;
    let retDDMM = '';
    if (deal.returnAt) {
      const retDate = new Date(deal.returnAt);
      retDDMM = `${String(retDate.getDate()).padStart(2, '0')}${String(retDate.getMonth() + 1).padStart(2, '0')}`;
    }
    return `https://www.aviasales.com/search/${deal.origin}${depDDMM}${deal.destination}${retDDMM}1?currency=brl`;
  }
}
