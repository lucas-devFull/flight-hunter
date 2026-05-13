import { buildGoogleFlightsUrl } from '@utils/googleFlights';
import { logger } from '@utils/logger';

import type { FlightPromotion } from '@flight-types/FlightPromotion';
import type { FlightProvider, PromotionSearchCriteria } from '@flight-types/FlightProvider';

/** Mapa de aeroportos/cidades com skyId e entityId para a Sky Scrapper API */
const SKY_PLACES: Record<string, { skyId: string; entityId: string; city: string; country: string; countryCode: string }> = {
  GRU: { skyId: 'GRU', entityId: '95673332', city: 'Sao Paulo', country: 'Brasil', countryCode: 'BR' },
  GIG: { skyId: 'GIG', entityId: '95673347', city: 'Rio de Janeiro', country: 'Brasil', countryCode: 'BR' },
  VCP: { skyId: 'VCP', entityId: '95673333', city: 'Campinas', country: 'Brasil', countryCode: 'BR' },
  BSB: { skyId: 'BSB', entityId: '95673410', city: 'Brasilia', country: 'Brasil', countryCode: 'BR' },
  CNF: { skyId: 'CNF', entityId: '95673408', city: 'Belo Horizonte', country: 'Brasil', countryCode: 'BR' },
  LIS: { skyId: 'LIS', entityId: '95565055', city: 'Lisboa', country: 'Portugal', countryCode: 'PT' },
  MAD: { skyId: 'MAD', entityId: '95565077', city: 'Madrid', country: 'Espanha', countryCode: 'ES' },
  BCN: { skyId: 'BCN', entityId: '95565085', city: 'Barcelona', country: 'Espanha', countryCode: 'ES' },
  CDG: { skyId: 'CDG', entityId: '95565041', city: 'Paris', country: 'Franca', countryCode: 'FR' },
  FCO: { skyId: 'FCO', entityId: '95565065', city: 'Roma', country: 'Italia', countryCode: 'IT' },
  LHR: { skyId: 'LHR', entityId: '95565050', city: 'Londres', country: 'Inglaterra', countryCode: 'GB' },
  MIA: { skyId: 'MIAA', entityId: '27536644', city: 'Miami', country: 'Estados Unidos', countryCode: 'US' },
  JFK: { skyId: 'JFK', entityId: '95565058', city: 'New York', country: 'Estados Unidos', countryCode: 'US' },
  MCO: { skyId: 'MCO', entityId: '95673454', city: 'Orlando', country: 'Estados Unidos', countryCode: 'US' },
  SCL: { skyId: 'SCL', entityId: '95673318', city: 'Santiago', country: 'Chile', countryCode: 'CL' },
  EZE: { skyId: 'EZE', entityId: '95673318', city: 'Buenos Aires', country: 'Argentina', countryCode: 'AR' },
  BOG: { skyId: 'BOG', entityId: '95673679', city: 'Bogota', country: 'Colombia', countryCode: 'CO' },
  LIM: { skyId: 'LIM', entityId: '95673491', city: 'Lima', country: 'Peru', countryCode: 'PE' },
  CUN: { skyId: 'CUN', entityId: '95673387', city: 'Cancun', country: 'Mexico', countryCode: 'MX' },
};

const INTL_DESTINATIONS = ['LIS', 'MAD', 'BCN', 'CDG', 'FCO', 'LHR', 'MIA', 'JFK', 'MCO', 'SCL', 'EZE', 'BOG', 'LIM', 'CUN'];
const ORIGINS = ['GRU', 'GIG', 'VCP', 'BSB', 'CNF'];

interface SkyLeg {
  origin: { displayCode: string; city?: string; name?: string };
  destination: { displayCode: string; city?: string; name?: string };
  durationInMinutes: number;
  stopCount: number;
  departure: string;
  arrival: string;
  carriers?: { marketing?: Array<{ name?: string; logoUrl?: string }> };
  segments?: Array<{ origin: { displayCode: string }; destination: { displayCode: string } }>;
}

interface SkyItinerary {
  id: string;
  price: { raw: number; formatted: string };
  legs: SkyLeg[];
  score?: number;
}

interface SkyResponse {
  status: boolean;
  data?: {
    itineraries?: SkyItinerary[];
    context?: { totalResults?: number };
  };
  message?: string;
}

export class SkyScrapperProvider implements FlightProvider {
  readonly name = 'Sky Scrapper';

  private readonly apiKey: string;
  private readonly baseUrl = 'https://sky-scrapper.p.rapidapi.com';
  private requestsThisMonth = 0;
  private monthStart = 0;
  private readonly maxRequestsPerMonth = 50; // free plan ~50 requests
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

    const origins = criteria.origins || ['GRU'];
    const limit = criteria.limit || 5;
    const destinations = this.getDestinations(criteria);
    const origin = origins[0] as string;
    const originPlace = SKY_PLACES[origin];
    if (!originPlace) return [];

    const allPromotions: FlightPromotion[] = [];

    for (const destCode of destinations.slice(0, 3)) {
      if (this.isLimitReached()) break;
      const destPlace = SKY_PLACES[destCode];
      if (!destPlace) continue;

      const daysAhead = 30 + Math.floor(Math.random() * 60);
      const date = this.getFutureDate(daysAhead);

      const response = await this.searchFlights(originPlace, destPlace, date);
      if (!response?.data?.itineraries) continue;

      for (const itinerary of response.data.itineraries.slice(0, 3)) {
        const promo = this.toFlightPromotion(itinerary, origin, destCode, destPlace);
        if (promo) allPromotions.push(promo);
      }

      if (allPromotions.length >= limit) break;
    }

    return allPromotions.slice(0, limit);
  }

  async searchFlights(
    origin: { skyId: string; entityId: string },
    destination: { skyId: string; entityId: string },
    date: string,
    returnDate?: string,
  ): Promise<SkyResponse | null> {
    const params = new URLSearchParams({
      originSkyId: origin.skyId,
      destinationSkyId: destination.skyId,
      originEntityId: origin.entityId,
      destinationEntityId: destination.entityId,
      cabinClass: 'economy',
      adults: '1',
      sortBy: 'price_high',
      currency: 'BRL',
      market: 'pt-BR',
      countryCode: 'BR',
      date,
    });
    if (returnDate) params.set('returnDate', returnDate);

    return this.request(`/api/v2/flights/searchFlights?${params}`);
  }

  private async request(path: string): Promise<SkyResponse | null> {
    if (Date.now() < this.rateLimitedUntil) return null;
    this.resetMonthlyCounterIfNeeded();
    if (this.requestsThisMonth >= this.maxRequestsPerMonth) {
      this.limitReached = true;
      return null;
    }

    try {
      const url = `${this.baseUrl}${path}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': 'sky-scrapper.p.rapidapi.com',
          'x-rapidapi-key': this.apiKey,
        },
      });

      this.requestsThisMonth++;

      if (response.status === 429) {
        this.limitReached = true;
        this.rateLimitedUntil = Date.now() + 3_600_000;
        logger.warn('[SkyScrapper] Limite atingido (429)');
        return null;
      }

      if (!response.ok) {
        logger.error({ status: response.status }, '[SkyScrapper] Erro HTTP');
        return null;
      }

      return await response.json() as SkyResponse;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, '[SkyScrapper] Erro');
      return null;
    }
  }

  private getDestinations(criteria: PromotionSearchCriteria): string[] {
    // Se destinos específicos foram passados (código IATA), usar diretamente
    if (criteria.destinations && criteria.destinations.length > 0) {
      return criteria.destinations.map(d => d.toUpperCase());
    }

    if (criteria.destinationCountryCodes && criteria.destinationCountryCodes.length > 0) {
      return INTL_DESTINATIONS.filter(code => {
        const place = SKY_PLACES[code];
        return place && criteria.destinationCountryCodes!.includes(place.countryCode);
      });
    }
    return [...INTL_DESTINATIONS].sort(() => Math.random() - 0.5);
  }

  private toFlightPromotion(
    itinerary: SkyItinerary,
    origin: string,
    destCode: string,
    destPlace: { city: string; country: string; countryCode: string },
  ): FlightPromotion | null {
    const leg = itinerary.legs?.[0];
    if (!leg) return null;

    const price = itinerary.price?.raw;
    if (!price || price < 100) return null;

    const returnLeg = itinerary.legs.length > 1 ? itinerary.legs[1] : null;
    const airline = leg.carriers?.marketing?.[0]?.name || null;
    const stops = leg.stopCount ?? 0;
    const durationMinutes = leg.durationInMinutes || null;
    const departureDate = leg.departure?.split('T')[0] || '';
    const returnDate = returnLeg?.departure?.split('T')[0] || null;

    // Extrair cidades de escala
    const stopoverCities: string[] = [];
    if (leg.segments && leg.segments.length > 1) {
      for (let i = 0; i < leg.segments.length - 1; i++) {
        const segDest = leg.segments[i].destination.displayCode;
        if (segDest !== destCode) stopoverCities.push(segDest);
      }
    }

    const score = Math.min(100, Math.round((itinerary.score || 5) * 10));

    return {
      id: `sky-${origin}-${destCode}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      provider: this.name,
      origin,
      originName: leg.origin?.city || leg.origin?.name || origin,
      destination: destPlace.city,
      destinationCode: destCode,
      destinationCountryCode: destPlace.countryCode,
      destinationCountry: destPlace.country,
      price,
      currency: 'BRL',
      departureDate,
      returnDate,
      airline,
      stops,
      stopoverCities: stopoverCities.length > 0 ? stopoverCities : null,
      durationMinutes,
      summary: `${origin} → ${destCode} via ${airline || 'Diversas'}${stops > 0 ? ` (${stops} escala${stops > 1 ? 's' : ''})` : ''}`,
      bookingUrl: null,
      googleFlightsUrl: buildGoogleFlightsUrl({
        origin,
        destinationCode: destCode,
        destinationName: destPlace.city,
        departureDate,
        returnDate,
      }),
      score,
      isCrazyDeal: score > 90,
      channels: ['international'],
    };
  }

  private getFutureDate(daysAhead: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date.toISOString().split('T')[0];
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

export { SKY_PLACES, INTL_DESTINATIONS as SKY_DESTINATIONS, ORIGINS as SKY_ORIGINS };
