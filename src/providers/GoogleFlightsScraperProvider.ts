import { buildGoogleFlightsUrl } from '@utils/googleFlights';
import { logger } from '@utils/logger';

import type { FlightPromotion } from '@flight-types/FlightPromotion';
import type { FlightProvider, PromotionSearchCriteria } from '@flight-types/FlightProvider';

/**
 * Response types from the Google Flights Scraper API (RapidAPI - scrappa)
 */
interface GFSFlight {
  airline?: string;
  airline_logo?: string;
  departure_time?: string;
  arrival_time?: string;
  duration?: string;
  stops?: number | string;
  stop_details?: string;
  price?: number | string;
  trip_type?: string;
  booking_token?: string;
  flight_number?: string;
  origin?: string;
  destination?: string;
  departure_date?: string;
  return_date?: string;
  cabin_class?: string;
}

interface GFSResponse {
  status?: string;
  data?: {
    flights?: GFSFlight[];
    total_results?: number;
  };
  flights?: GFSFlight[];
  error?: string;
  message?: string;
}

/**
 * Google Flights Scraper Provider
 * Uses the scrappa/google-flights-scraper API on RapidAPI.
 * Returns real-time Google Flights data with actual prices.
 *
 * Endpoints used:
 * - GET /api/flights/round-trip (origin, destination, departure_date, return_date)
 * - GET /api/flights/one-way (origin, destination, departure_date)
 */
export class GoogleFlightsScraperProvider implements FlightProvider {
  readonly name = 'Google Flights';

  private readonly apiKey: string;
  private readonly baseUrl = 'https://google-flights-scraper.p.rapidapi.com';
  private readonly host = 'google-flights-scraper.p.rapidapi.com';

  private requestsThisMonth = 0;
  private monthStart = 0;
  private readonly maxRequestsPerMonth = 50; // Free tier limit (adjust based on plan)
  private rateLimitedUntil = 0;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchPromotions(criteria: PromotionSearchCriteria = {}): Promise<FlightPromotion[]> {
    if (criteria.channel === 'brazil') return [];
    if (this.isLimitReached()) return [];

    const origins = criteria.origins || ['GRU'];
    const origin = origins[0] as string;
    const limit = criteria.limit || 5;

    // This provider requires a specific destination
    const destinations = criteria.destinations || [];
    if (destinations.length === 0) {
      logger.info('[GoogleFlightsScraper] Sem destino específico, pulando (requer destino)');
      return [];
    }

    const daysAhead = 30 + Math.floor(Math.random() * 60);
    const departureDate = criteria.dateFrom || this.getFutureDate(daysAhead);
    const returnDate = criteria.dateTo || this.getFutureDate(daysAhead + 10);

    logger.info(
      { origin, destinations, departureDate, returnDate },
      '[GoogleFlightsScraper] Buscando voos',
    );

    const allPromotions: FlightPromotion[] = [];

    for (const dest of destinations.slice(0, 2)) {
      if (this.isLimitReached()) break;

      const flights = await this.searchRoundTrip(origin, dest, departureDate, returnDate, criteria.maxStopovers);
      if (!flights) continue;

      for (const flight of flights.slice(0, 5)) {
        const promo = this.toFlightPromotion(flight, origin, dest, departureDate, returnDate);
        if (promo) allPromotions.push(promo);
      }

      if (allPromotions.length >= limit) break;
    }

    logger.info({ total: allPromotions.length }, '[GoogleFlightsScraper] Busca finalizada');
    return allPromotions.slice(0, limit);
  }

  private async searchRoundTrip(
    origin: string,
    destination: string,
    departureDate: string,
    returnDate: string,
    maxStops?: number,
  ): Promise<GFSFlight[] | null> {
    const params = new URLSearchParams({
      origin,
      destination,
      departure_date: departureDate,
      return_date: returnDate,
      adults: '1',
      cabin_class: 'economy',
      sort_by: 'cheapest',
    });

    if (maxStops !== undefined) {
      const stopsParam = maxStops === 0 ? 'nonstop' : maxStops === 1 ? 'one_or_fewer' : 'two_or_fewer';
      params.set('max_stops', stopsParam);
    }

    const response = await this.request(`/api/flights/round-trip?${params}`);
    if (!response) return null;

    // Handle different response formats
    const flights = response.data?.flights || response.flights || [];
    return flights.length > 0 ? flights : null;
  }

  private async request(path: string): Promise<GFSResponse | null> {
    if (Date.now() < this.rateLimitedUntil) return null;
    this.resetMonthlyCounterIfNeeded();

    if (this.requestsThisMonth >= this.maxRequestsPerMonth) {
      logger.warn('[GoogleFlightsScraper] Limite mensal atingido');
      return null;
    }

    try {
      const url = `${this.baseUrl}${path}`;
      logger.debug({ url: url.slice(0, 100) }, '[GoogleFlightsScraper] Request');

      const response = await fetch(url, {
        headers: {
          'x-rapidapi-host': this.host,
          'x-rapidapi-key': this.apiKey,
        },
      });

      this.requestsThisMonth++;

      if (response.status === 429) {
        this.rateLimitedUntil = Date.now() + 3_600_000;
        logger.warn('[GoogleFlightsScraper] Rate limited (429)');
        return null;
      }

      if (response.status === 401 || response.status === 403) {
        logger.error({ status: response.status }, '[GoogleFlightsScraper] Auth error');
        return null;
      }

      if (!response.ok) {
        logger.error({ status: response.status }, '[GoogleFlightsScraper] HTTP error');
        return null;
      }

      return await response.json() as GFSResponse;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, '[GoogleFlightsScraper] Error');
      return null;
    }
  }

  private toFlightPromotion(
    flight: GFSFlight,
    origin: string,
    destination: string,
    departureDate: string,
    returnDate: string,
  ): FlightPromotion | null {
    const price = typeof flight.price === 'string'
      ? parseInt(flight.price.replace(/[^\d]/g, ''), 10)
      : flight.price;

    if (!price || price < 50) return null;

    const stops = typeof flight.stops === 'string'
      ? (flight.stops.toLowerCase().includes('nonstop') || flight.stops === '0' ? 0 : parseInt(flight.stops, 10) || 1)
      : (flight.stops ?? 0);

    const airline = flight.airline || null;
    const durationMinutes = this.parseDuration(flight.duration);

    // Parse stop cities from stop_details
    const stopoverCities = flight.stop_details
      ? flight.stop_details.split(',').map(s => s.trim()).filter(Boolean)
      : null;

    const score = this.calculateScore(price, stops, durationMinutes);

    return {
      id: `gfs-${origin}-${destination}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      provider: this.name,
      origin,
      originName: origin,
      destination,
      destinationCode: destination,
      destinationCountryCode: '',
      destinationCountry: '',
      price,
      currency: 'BRL',
      departureDate: flight.departure_date || departureDate,
      returnDate: flight.return_date || returnDate,
      airline,
      stops,
      stopoverCities,
      durationMinutes,
      summary: `${origin} → ${destination} via ${airline || 'Diversas'}${stops > 0 ? ` (${stops} escala${stops > 1 ? 's' : ''})` : ''} • ida e volta`,
      bookingUrl: null,
      googleFlightsUrl: buildGoogleFlightsUrl({
        origin,
        destinationCode: destination,
        destinationName: destination,
        departureDate: flight.departure_date || departureDate,
        returnDate: flight.return_date || returnDate,
      }),
      score,
      isCrazyDeal: score > 90,
      channels: ['international'],
    };
  }

  private parseDuration(duration?: string): number | null {
    if (!duration) return null;
    // Formats: "12h 30m", "12 hr 30 min", "750 min", "12:30"
    const hm = duration.match(/(\d+)\s*h(?:r|ours?)?\s*(\d+)?\s*m?/i);
    if (hm) return parseInt(hm[1], 10) * 60 + (parseInt(hm[2], 10) || 0);
    const minOnly = duration.match(/(\d+)\s*min/i);
    if (minOnly) return parseInt(minOnly[1], 10);
    const colon = duration.match(/(\d+):(\d+)/);
    if (colon) return parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10);
    return null;
  }

  private calculateScore(price: number, stops: number, duration: number | null): number {
    let score = 70;
    // Cheaper = better score
    if (price < 2000) score += 20;
    else if (price < 4000) score += 10;
    else if (price > 8000) score -= 10;
    // Direct flights get bonus
    if (stops === 0) score += 10;
    else if (stops > 1) score -= 5;
    // Shorter duration bonus
    if (duration && duration < 600) score += 5;
    return Math.max(0, Math.min(100, score));
  }

  private isLimitReached(): boolean {
    this.resetMonthlyCounterIfNeeded();
    return this.requestsThisMonth >= this.maxRequestsPerMonth;
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
    }
  }
}
