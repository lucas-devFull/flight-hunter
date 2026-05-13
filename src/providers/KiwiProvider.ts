import { buildGoogleFlightsUrl } from '@utils/googleFlights';
import { logger } from '@utils/logger';

import type { FlightPromotion } from '@flight-types/FlightPromotion';
import type { FlightProvider, PromotionSearchCriteria } from '@flight-types/FlightProvider';

/** Formato de resposta da Kiwi via RapidAPI */
interface KiwiItinerary {
  id: string;
  price: { amount: number; currencyCode: string };
  legs: KiwiLeg[];
  bookingOptions?: Array<{ url?: string }>;
  totalDuration?: number;
}

interface KiwiLeg {
  origin: { code: string; city?: string; name?: string };
  destination: { code: string; city?: string; name?: string };
  departure: string;
  arrival: string;
  duration: number;
  carriers?: Array<{ name?: string; code?: string }>;
  segments?: Array<{
    origin: { code: string };
    destination: { code: string };
  }>;
  stopCount?: number;
}

interface KiwiResponse {
  itineraries?: KiwiItinerary[];
  error?: string;
  message?: string;
}

/** Destinos internacionais no formato Kiwi */
const KIWI_DESTINATIONS: Array<{ kiwiId: string; code: string; city: string; country: string; countryCode: string }> = [
  { kiwiId: 'City:lisbon_pt', code: 'LIS', city: 'Lisboa', country: 'Portugal', countryCode: 'PT' },
  { kiwiId: 'City:madrid_es', code: 'MAD', city: 'Madrid', country: 'Espanha', countryCode: 'ES' },
  { kiwiId: 'City:barcelona_es', code: 'BCN', city: 'Barcelona', country: 'Espanha', countryCode: 'ES' },
  { kiwiId: 'City:paris_fr', code: 'CDG', city: 'Paris', country: 'Franca', countryCode: 'FR' },
  { kiwiId: 'City:rome_it', code: 'FCO', city: 'Roma', country: 'Italia', countryCode: 'IT' },
  { kiwiId: 'City:london_gb', code: 'LHR', city: 'Londres', country: 'Inglaterra', countryCode: 'GB' },
  { kiwiId: 'City:miami_fl_us', code: 'MIA', city: 'Miami', country: 'Estados Unidos', countryCode: 'US' },
  { kiwiId: 'City:new-york-city_ny_us', code: 'JFK', city: 'New York', country: 'Estados Unidos', countryCode: 'US' },
  { kiwiId: 'City:orlando_fl_us', code: 'MCO', city: 'Orlando', country: 'Estados Unidos', countryCode: 'US' },
  { kiwiId: 'City:santiago_cl', code: 'SCL', city: 'Santiago', country: 'Chile', countryCode: 'CL' },
  { kiwiId: 'City:buenos-aires_ar', code: 'EZE', city: 'Buenos Aires', country: 'Argentina', countryCode: 'AR' },
  { kiwiId: 'City:bogota_co', code: 'BOG', city: 'Bogota', country: 'Colombia', countryCode: 'CO' },
  { kiwiId: 'City:lima_pe', code: 'LIM', city: 'Lima', country: 'Peru', countryCode: 'PE' },
  { kiwiId: 'City:cancun_mx', code: 'CUN', city: 'Cancun', country: 'Mexico', countryCode: 'MX' },
];

export class KiwiProvider implements FlightProvider {
  readonly name = 'Kiwi';

  private readonly apiKey: string;
  private readonly baseUrl = 'https://kiwi-com-cheap-flights.p.rapidapi.com';
  private requestsThisMonth = 0;
  private monthStart = 0;
  private readonly maxRequestsPerMonth = 300;
  private rateLimitedUntil = 0;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchPromotions(criteria: PromotionSearchCriteria = {}): Promise<FlightPromotion[]> {
    // Kiwi só busca internacionais
    if (criteria.channel === 'brazil') return [];

    this.resetMonthlyCounterIfNeeded();
    if (this.requestsThisMonth >= this.maxRequestsPerMonth) {
      logger.warn({ used: this.requestsThisMonth }, '[Kiwi] Limite mensal atingido');
      return [];
    }

    const origins = criteria.origins || ['GRU'];
    const limit = criteria.limit || 5;
    const destinations = this.getDestinations(criteria);

    logger.info(
      { origins: origins.slice(0, 1), destinations: destinations.slice(0, 3).map(d => d.city), requestsUsed: this.requestsThisMonth },
      '[Kiwi] Iniciando busca',
    );

    const allPromotions: FlightPromotion[] = [];

    for (const dest of destinations.slice(0, 3)) {
      if (this.requestsThisMonth >= this.maxRequestsPerMonth) break;
      if (Date.now() < this.rateLimitedUntil) break;

      const origin = origins[0];
      const result = await this.searchRoundTrip(origin, dest.kiwiId);
      if (!result?.itineraries) continue;

      for (const itinerary of result.itineraries.slice(0, 3)) {
        const promo = this.toFlightPromotion(itinerary, origin, dest);
        if (promo) allPromotions.push(promo);
      }

      if (allPromotions.length >= limit) break;
    }

    logger.info({ total: allPromotions.length }, '[Kiwi] Busca finalizada');
    return allPromotions.slice(0, limit);
  }

  async searchRoundTrip(origin: string, destinationKiwiId: string): Promise<KiwiResponse | null> {
    const params = new URLSearchParams({
      source: `Airport:${origin}`,
      destination: destinationKiwiId,
      currency: 'brl',
      locale: 'pt',
      adults: '1',
      children: '0',
      infants: '0',
      handbags: '1',
      holdbags: '0',
      cabinClass: 'ECONOMY',
      sortBy: 'PRICE',
      sortOrder: 'ASCENDING',
      limit: '5',
      transportTypes: 'FLIGHT',
    });

    return this.request(`/round-trip?${params}`);
  }

  async searchOneWay(origin: string, destinationKiwiId: string): Promise<KiwiResponse | null> {
    const params = new URLSearchParams({
      source: `Airport:${origin}`,
      destination: destinationKiwiId,
      currency: 'brl',
      locale: 'pt',
      adults: '1',
      children: '0',
      infants: '0',
      handbags: '1',
      holdbags: '0',
      cabinClass: 'ECONOMY',
      sortBy: 'PRICE',
      sortOrder: 'ASCENDING',
      limit: '5',
      transportTypes: 'FLIGHT',
    });

    return this.request(`/one-way?${params}`);
  }

  private async request(path: string): Promise<KiwiResponse | null> {
    if (Date.now() < this.rateLimitedUntil) {
      logger.debug('[Kiwi] Rate limited, pulando');
      return null;
    }

    this.resetMonthlyCounterIfNeeded();
    if (this.requestsThisMonth >= this.maxRequestsPerMonth) return null;

    try {
      const url = `${this.baseUrl}${path}`;
      logger.debug({ url }, '[Kiwi] Request');

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': 'kiwi-com-cheap-flights.p.rapidapi.com',
          'x-rapidapi-key': this.apiKey,
        },
      });

      this.requestsThisMonth++;

      if (response.status === 429) {
        this.rateLimitedUntil = Date.now() + 60_000;
        logger.warn('[Kiwi] Rate limit 429');
        return null;
      }

      if (response.status === 403 || response.status === 401) {
        this.rateLimitedUntil = Date.now() + 3_600_000;
        logger.error({ status: response.status }, '[Kiwi] API key invalida ou sem acesso');
        return null;
      }

      if (!response.ok) {
        logger.error({ status: response.status }, '[Kiwi] Erro HTTP');
        return null;
      }

      return await response.json() as KiwiResponse;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, '[Kiwi] Erro de rede');
      return null;
    }
  }

  private getDestinations(criteria: PromotionSearchCriteria) {
    // Se destinos específicos foram passados (código IATA), buscar na lista Kiwi
    if (criteria.destinations && criteria.destinations.length > 0) {
      const matched = KIWI_DESTINATIONS.filter(d =>
        criteria.destinations!.some(code => code.toUpperCase() === d.code.toUpperCase()),
      );
      if (matched.length > 0) return matched;
    }

    if (criteria.destinationCountryCodes && criteria.destinationCountryCodes.length > 0) {
      return KIWI_DESTINATIONS.filter(d => criteria.destinationCountryCodes!.includes(d.countryCode));
    }
    return [...KIWI_DESTINATIONS].sort(() => Math.random() - 0.5);
  }

  private toFlightPromotion(
    itinerary: KiwiItinerary,
    origin: string,
    dest: typeof KIWI_DESTINATIONS[number],
  ): FlightPromotion | null {
    if (!itinerary.legs || itinerary.legs.length === 0) return null;

    const outboundLeg = itinerary.legs[0];
    const returnLeg = itinerary.legs.length > 1 ? itinerary.legs[1] : null;

    const price = itinerary.price?.amount;
    if (!price || price < 100) return null;

    const airline = outboundLeg.carriers?.[0]?.name || null;
    const stops = outboundLeg.stopCount ?? (outboundLeg.segments ? outboundLeg.segments.length - 1 : 0);
    const durationMinutes = outboundLeg.duration ? Math.round(outboundLeg.duration / 60) : null;

    // Extrair cidades de escala
    const stopoverCities: string[] = [];
    if (outboundLeg.segments && outboundLeg.segments.length > 1) {
      for (let i = 0; i < outboundLeg.segments.length - 1; i++) {
        const seg = outboundLeg.segments[i];
        if (seg.destination.code !== dest.code) {
          stopoverCities.push(seg.destination.code);
        }
      }
    }

    const departureDate = outboundLeg.departure?.split('T')[0] || '';
    const returnDate = returnLeg?.departure?.split('T')[0] || null;

    const bookingUrl = itinerary.bookingOptions?.[0]?.url || null;
    const score = this.calculateScore(price, stops, durationMinutes);

    return {
      id: `kiwi-${origin}-${dest.code}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      provider: this.name,
      origin,
      originName: outboundLeg.origin?.city || origin,
      destination: dest.city,
      destinationCode: dest.code,
      destinationCountryCode: dest.countryCode,
      destinationCountry: dest.country,
      price,
      currency: 'BRL',
      departureDate,
      returnDate,
      airline,
      stops,
      stopoverCities: stopoverCities.length > 0 ? stopoverCities : null,
      durationMinutes,
      summary: `${origin} → ${dest.code} via ${airline || 'Diversas'}${stops > 0 ? ` (${stops} escala${stops > 1 ? 's' : ''})` : ''} • ${returnDate ? 'ida e volta' : 'somente ida'}`,
      bookingUrl,
      googleFlightsUrl: buildGoogleFlightsUrl({
        origin,
        destinationCode: dest.code,
        destinationName: dest.city,
        departureDate,
        returnDate,
      }),
      score,
      isCrazyDeal: score > 90,
      channels: ['international'],
    };
  }

  private calculateScore(price: number, stops: number, duration: number | null): number {
    const priceScore = Math.max(0, Math.min(50, Math.round(((6000 - price) / 6000) * 50)));
    const stopScore = stops === 0 ? 25 : stops === 1 ? 15 : 5;
    const durationScore = duration ? Math.max(0, 25 - Math.floor(duration / 120)) : 10;
    return Math.min(100, priceScore + stopScore + durationScore);
  }

  private resetMonthlyCounterIfNeeded(): void {
    const currentMonth = new Date().getMonth();
    if (currentMonth !== this.monthStart) {
      this.monthStart = currentMonth;
      this.requestsThisMonth = 0;
    }
  }
}

export { KIWI_DESTINATIONS };
