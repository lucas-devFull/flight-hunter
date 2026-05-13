import { buildGoogleFlightsUrl } from '@utils/googleFlights';
import { logger } from '@utils/logger';

import type { FlightPromotion } from '@flight-types/FlightPromotion';
import type { FlightProvider, PromotionSearchCriteria } from '@flight-types/FlightProvider';

interface FlightApiLeg {
  id: string;
  origin_place_id: number;
  destination_place_id: number;
  departure: string;
  arrival: string;
  duration: number;
  stop_count: number;
  segment_ids: string[];
  marketing_carrier_ids: number[];
}

interface FlightApiPricingOption {
  price: { amount: number };
  agent_ids: string[];
  items?: Array<{ url?: string; agent_id?: string }>;
}

interface FlightApiItinerary {
  id: string;
  leg_ids: string[];
  pricing_options: FlightApiPricingOption[];
  cheapest_price?: { amount: number };
  score?: number;
}

interface FlightApiCarrier {
  id: number;
  name: string;
  alt_id?: string;
}

interface FlightApiPlace {
  id: number;
  name: string;
  iata?: string;
  type?: string;
}

interface FlightApiResponse {
  itineraries?: FlightApiItinerary[];
  legs?: FlightApiLeg[];
  carriers?: FlightApiCarrier[];
  places?: FlightApiPlace[];
  agents?: Array<{ id: string; name: string }>;
}

/** Origens pré-programadas */
const ORIGINS = ['GRU', 'GIG', 'VCP', 'BSB', 'CNF'] as const;

export class FlightApiProvider implements FlightProvider {
  readonly name = 'FlightAPI';

  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.flightapi.io';

  // Free plan: 100 requests/30 dias (cada request = 2 créditos)
  // Na prática são 50 buscas efetivas
  private requestsThisMonth = 0;
  private monthStart = 0;
  private readonly maxRequestsPerMonth = 50;
  private rateLimitedUntil = 0;
  private limitReached = false;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  isLimitReached(): boolean {
    this.resetMonthlyCounterIfNeeded();
    return this.limitReached || this.requestsThisMonth >= this.maxRequestsPerMonth;
  }

  getRemainingRequests(): number {
    this.resetMonthlyCounterIfNeeded();
    return Math.max(0, this.maxRequestsPerMonth - this.requestsThisMonth);
  }

  async fetchPromotions(criteria: PromotionSearchCriteria = {}): Promise<FlightPromotion[]> {
    if (criteria.channel === 'brazil') return [];
    if (this.isLimitReached()) return [];

    const origin = (criteria.origins?.[0] || 'GRU') as string;
    const limit = criteria.limit || 5;

    // Se destino específico foi passado, buscar diretamente
    const destinations = criteria.destinations && criteria.destinations.length > 0
      ? criteria.destinations
      : [];

    if (destinations.length === 0) {
      logger.info({ origin, limit }, '[FlightAPI] Sem destino específico, pulando (discovery não suportado)');
      return [];
    }

    const daysAhead = 30 + Math.floor(Math.random() * 60);
    const depDate = criteria.dateFrom || this.getFutureDate(daysAhead);
    const retDate = criteria.dateTo || this.getFutureDate(daysAhead + 10);

    logger.info({ origin, destinations, limit, remaining: this.getRemainingRequests() }, '[FlightAPI] Buscando');

    const allPromotions: FlightPromotion[] = [];

    for (const dest of destinations.slice(0, 2)) {
      if (this.isLimitReached()) break;

      const response = await this.searchRoundTrip(origin, dest, depDate, retDate);
      if (response) {
        const promos = this.parseResponse(response, origin, dest, true);
        allPromotions.push(...promos);
      }

      if (allPromotions.length >= limit) break;
    }

    return allPromotions.slice(0, limit);
  }

  async searchRoundTrip(from: string, to: string, depDate: string, retDate: string): Promise<FlightApiResponse | null> {
    const path = `/roundtrip/${this.apiKey}/${from}/${to}/${depDate}/${retDate}/1/0/0/Economy/BRL`;
    return this.request(path);
  }

  async searchOneWay(from: string, to: string, depDate: string): Promise<FlightApiResponse | null> {
    const path = `/onewaytrip/${this.apiKey}/${from}/${to}/${depDate}/1/0/0/Economy/BRL`;
    return this.request(path);
  }

  parseResponse(response: FlightApiResponse, origin: string, destination: string, isRoundTrip: boolean): FlightPromotion[] {
    if (!response.itineraries || response.itineraries.length === 0) return [];

    const legsMap = new Map<string, FlightApiLeg>();
    for (const leg of response.legs || []) legsMap.set(leg.id, leg);

    const carriersMap = new Map<number, string>();
    for (const carrier of response.carriers || []) carriersMap.set(carrier.id, carrier.name);

    const placesMap = new Map<number, FlightApiPlace>();
    for (const place of response.places || []) placesMap.set(place.id, place);

    const promotions: FlightPromotion[] = [];

    for (const itinerary of response.itineraries.slice(0, 5)) {
      const price = itinerary.cheapest_price?.amount || itinerary.pricing_options?.[0]?.price?.amount;
      if (!price || price < 50) continue;

      const outboundLegId = itinerary.leg_ids[0];
      const returnLegId = itinerary.leg_ids.length > 1 ? itinerary.leg_ids[1] : null;
      const outboundLeg = outboundLegId ? legsMap.get(outboundLegId) : null;
      const returnLeg = returnLegId ? legsMap.get(returnLegId) : null;

      if (!outboundLeg) continue;

      const airline = outboundLeg.marketing_carrier_ids?.[0]
        ? carriersMap.get(outboundLeg.marketing_carrier_ids[0]) || null
        : null;

      const stops = outboundLeg.stop_count ?? 0;
      const durationMinutes = outboundLeg.duration || null;

      const departureDate = outboundLeg.departure?.split('T')[0] || '';
      const returnDate = returnLeg?.departure?.split('T')[0] || null;

      // Extrair booking URL do deeplink
      const bookingItem = itinerary.pricing_options?.[0]?.items?.[0];
      const bookingUrl = bookingItem?.url
        ? (bookingItem.url.startsWith('http') ? bookingItem.url : `https://www.skyscanner.com${bookingItem.url}`)
        : null;

      // Resolver nomes de lugares
      const destPlace = placesMap.get(outboundLeg.destination_place_id);
      const destName = destPlace?.name || destination;

      const score = Math.min(100, Math.round((itinerary.score || 5) * 20));

      promotions.push({
        id: `flightapi-${origin}-${destination}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        provider: this.name,
        origin,
        originName: origin,
        destination: destName,
        destinationCode: destination,
        destinationCountryCode: '',
        destinationCountry: '',
        price,
        currency: 'BRL',
        departureDate,
        returnDate,
        airline,
        stops,
        stopoverCities: null,
        durationMinutes,
        summary: `${origin} → ${destination} via ${airline || 'Diversas'}${stops > 0 ? ` (${stops} escala${stops > 1 ? 's' : ''})` : ''} • ${isRoundTrip ? 'ida e volta' : 'somente ida'}`,
        bookingUrl,
        googleFlightsUrl: buildGoogleFlightsUrl({
          origin,
          destinationCode: destination,
          destinationName: destName,
          departureDate,
          returnDate,
        }),
        score,
        isCrazyDeal: score > 90,
        channels: ['international'],
      });
    }

    return promotions;
  }

  private async request(path: string): Promise<FlightApiResponse | null> {
    if (Date.now() < this.rateLimitedUntil) return null;
    this.resetMonthlyCounterIfNeeded();

    if (this.requestsThisMonth >= this.maxRequestsPerMonth) {
      this.limitReached = true;
      return null;
    }

    try {
      const url = `${this.baseUrl}${path}`;
      logger.debug({ url: url.replace(this.apiKey, '***') }, '[FlightAPI] Request');

      const response = await fetch(url);
      this.requestsThisMonth++;

      if (response.status === 429) {
        this.limitReached = true;
        this.rateLimitedUntil = Date.now() + 3_600_000;
        logger.warn('[FlightAPI] Limite atingido (429)');
        return null;
      }

      if (response.status === 410) {
        logger.info('[FlightAPI] Nenhum voo encontrado (410)');
        return null;
      }

      if (response.status === 404) {
        logger.info('[FlightAPI] Rota ou data sem resultados (404)');
        return null;
      }

      if (!response.ok) {
        logger.error({ status: response.status }, '[FlightAPI] Erro HTTP');
        return null;
      }

      return await response.json() as FlightApiResponse;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, '[FlightAPI] Erro');
      return null;
    }
  }

  private getFutureDate(daysAhead: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  }

  private resetMonthlyCounterIfNeeded(): void {
    const currentMonth = new Date().getMonth();
    if (currentMonth !== this.monthStart) {
      this.monthStart = currentMonth;
      this.requestsThisMonth = 0;
      this.limitReached = false;
    }
  }
}

export { ORIGINS as FLIGHTAPI_ORIGINS };
