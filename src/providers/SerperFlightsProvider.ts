import { buildGoogleFlightsUrl } from '@utils/googleFlights';
import { logger } from '@utils/logger';

import type { FlightPromotion } from '@flight-types/FlightPromotion';
import type { FlightProvider, PromotionSearchCriteria } from '@flight-types/FlightProvider';

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

interface SerperSearchResponse {
  searchParameters: { q: string };
  organic?: SerperOrganicResult[];
}

const KNOWN_DESTINATIONS = [
  { city: 'Madrid', code: 'MAD', country: 'ES' },
  { city: 'Barcelona', code: 'BCN', country: 'ES' },
  { city: 'Lisboa', code: 'LIS', country: 'PT' },
  { city: 'Paris', code: 'CDG', country: 'FR' },
  { city: 'Roma', code: 'FCO', country: 'IT' },
  { city: 'Milao', code: 'MXP', country: 'IT' },
  { city: 'Londres', code: 'LHR', country: 'GB' },
  { city: 'Tokyo', code: 'NRT', country: 'JP' },
  { city: 'Bangkok', code: 'BKK', country: 'TH' },
  { city: 'Bogota', code: 'BOG', country: 'CO' },
  { city: 'Lima', code: 'LIM', country: 'PE' },
  { city: 'Santiago', code: 'SCL', country: 'CL' },
  { city: 'Buenos Aires', code: 'EZE', country: 'AR' },
  { city: 'Miami', code: 'MIA', country: 'US' },
  { city: 'Nova York', code: 'JFK', country: 'US' },
  { city: 'Orlando', code: 'MCO', country: 'US' },
  { city: 'Cancun', code: 'CUN', country: 'MX' },
] as const;

const COUNTRY_DESTINATIONS: Record<string, typeof KNOWN_DESTINATIONS[number][]> = {};
for (const dest of KNOWN_DESTINATIONS) {
  if (!COUNTRY_DESTINATIONS[dest.country]) COUNTRY_DESTINATIONS[dest.country] = [];
  COUNTRY_DESTINATIONS[dest.country].push(dest);
}

const COUNTRY_NAMES: Record<string, string> = {
  JP: 'Japao', ES: 'Espanha', CO: 'Colombia', PE: 'Peru',
  IT: 'Italia', TH: 'Tailandia', US: 'Estados Unidos',
  FR: 'Franca', GB: 'Inglaterra', PT: 'Portugal', AR: 'Argentina',
  CL: 'Chile', MX: 'Mexico',
};

export class SerperFlightsProvider implements FlightProvider {
  readonly name = 'Serper Flights';

  private readonly apiKey: string;
  private readonly baseUrl = 'https://google.serper.dev/search';
  private lastRequestTime = 0;
  private readonly minIntervalMs = 1500;
  private requestsToday = 0;
  private requestsDayStart = 0;
  private readonly maxRequestsPerDay = 80;
  private rateLimited = false;
  private rateLimitedUntil = 0;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async fetchPromotions(criteria: PromotionSearchCriteria = {}): Promise<FlightPromotion[]> {
    const origins = criteria.origins || ['GRU', 'VCP', 'GIG'];
    const daysAhead = 30 + Math.floor(Math.random() * 60);
    const departureDate = criteria.dateFrom || this.getFutureDate(daysAhead);
    const returnDate = criteria.dateTo || this.getFutureDate(daysAhead + 7 + Math.floor(Math.random() * 14));
    const destinations = this.getDestinationsForCriteria(criteria);

    if (destinations.length === 0) return [];

    const requestLimit = criteria.limit || 10;
    const maxOrigins = Math.min(origins.length, 2);
    const maxDestinations = Math.min(destinations.length, 4);

    logger.info(
      { origins: origins.slice(0, maxOrigins), destinations: destinations.slice(0, maxDestinations).map(d => d.city), departureDate },
      '[Serper] Iniciando busca de voos',
    );

    const allPromotions: FlightPromotion[] = [];

    for (const origin of origins.slice(0, maxOrigins)) {
      for (const dest of destinations.slice(0, maxDestinations)) {
        // Buscar no Google Flights / Kayak / Skyscanner com query focada
        const query = `passagem ${origin} ${dest.code} ${dest.city} ida volta ${departureDate} preço BRL kayak skyscanner`;
        const response = await this.callSerperApi(query);
        if (!response) continue;

        const priceInfo = this.extractPriceInfo(response);
        if (!priceInfo) continue;

        const airline = this.extractAirlineFromResults(response);
        const stopsInfo = this.extractStopsInfo(response);

        allPromotions.push(this.buildPromotion({
          origin, dest, price: priceInfo.price, isRoundTrip: priceInfo.isRoundTrip,
          airline, stops: stopsInfo.stops, stopoverCities: stopsInfo.cities,
          departureDate, returnDate, link: this.extractBestLink(response),
        }));

        if (allPromotions.length >= requestLimit) break;
      }
      if (allPromotions.length >= requestLimit) break;
    }

    return allPromotions.slice(0, requestLimit);
  }

  private getDestinationsForCriteria(criteria: PromotionSearchCriteria): typeof KNOWN_DESTINATIONS[number][] {
    // Se destinos específicos foram passados (código IATA), buscar na lista
    if (criteria.destinations && criteria.destinations.length > 0) {
      const matched = KNOWN_DESTINATIONS.filter(d =>
        criteria.destinations!.some(code => code.toUpperCase() === d.code.toUpperCase()),
      );
      if (matched.length > 0) return matched;
      // Se o destino não está na lista conhecida, criar entrada genérica
      return criteria.destinations.map(code => ({
        code: code.toUpperCase(),
        city: code.toUpperCase(),
        country: '',
        countryCode: '',
      })) as unknown as typeof KNOWN_DESTINATIONS[number][];
    }

    if (criteria.channel === 'brazil') return [];

    if (criteria.destinationCountryCodes && criteria.destinationCountryCodes.length > 0) {
      const dests: typeof KNOWN_DESTINATIONS[number][] = [];
      for (const code of criteria.destinationCountryCodes) {
        const countryDests = COUNTRY_DESTINATIONS[code];
        if (countryDests) dests.push(...countryDests);
      }
      return dests.length > 0 ? dests : [...KNOWN_DESTINATIONS].slice(0, 6);
    }

    return [...KNOWN_DESTINATIONS].sort(() => Math.random() - 0.5).slice(0, 6);
  }

  private async callSerperApi(query: string): Promise<SerperSearchResponse | null> {
    if (this.rateLimited && Date.now() < this.rateLimitedUntil) return null;
    this.rateLimited = false;
    this.resetDailyCounterIfNeeded();
    if (this.requestsToday >= this.maxRequestsPerDay) return null;
    await this.throttle();

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'X-API-KEY': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, gl: 'br', hl: 'pt-br', num: 10 }),
      });
      this.lastRequestTime = Date.now();
      this.requestsToday++;

      if (response.status === 429) {
        this.rateLimited = true;
        this.rateLimitedUntil = Date.now() + 60_000;
        return null;
      }
      if (response.status === 403) {
        this.rateLimited = true;
        this.rateLimitedUntil = Date.now() + 3_600_000;
        return null;
      }
      if (!response.ok) return null;

      return await response.json() as SerperSearchResponse;
    } catch {
      return null;
    }
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
  }

  private resetDailyCounterIfNeeded(): void {
    const today = Math.floor(Date.now() / 86_400_000);
    if (today !== this.requestsDayStart) {
      this.requestsDayStart = today;
      this.requestsToday = 0;
    }
  }

  private extractPriceInfo(response: SerperSearchResponse): { price: number; isRoundTrip: boolean } | null {
    const candidates: Array<{ price: number; isRoundTrip: boolean; confidence: number }> = [];

    for (const result of response.organic || []) {
      const text = `${result.title} ${result.snippet}`;
      const matches = text.matchAll(/R\$\s?([\d.]+,?\d*)/g);

      for (const match of matches) {
        const raw = match[1];
        let price: number;
        if (raw.includes(',')) {
          price = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
        } else if (raw.includes('.') && raw.split('.').pop()!.length === 3) {
          price = parseFloat(raw.replace(/\./g, ''));
        } else {
          price = parseFloat(raw);
        }
        if (isNaN(price) || price < 200 || price > 25000) continue;

        const ctx = text.substring(Math.max(0, (match.index ?? 0) - 80), (match.index ?? 0) + match[0].length + 80).toLowerCase();
        const isRoundTrip = /ida\s*e?\s*volta|round\s*trip|i\/v/.test(ctx);
        const isOneWay = /somente?\s*ida|one\s*way|trecho/.test(ctx);

        let confidence = 50;
        if (isRoundTrip) confidence += 30;
        if (isOneWay) confidence -= 20;
        if (result.link.includes('google.com/travel')) confidence += 15;
        if (/skyscanner|kayak|decolar/.test(result.link)) confidence += 10;

        candidates.push({ price, isRoundTrip: isRoundTrip || !isOneWay, confidence });
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.confidence !== a.confidence ? b.confidence - a.confidence : a.price - b.price);
    return { price: candidates[0].price, isRoundTrip: candidates[0].isRoundTrip };
  }

  private extractAirlineFromResults(response: SerperSearchResponse): string | null {
    const airlines = [
      'LATAM', 'Gol', 'Azul', 'Iberia', 'American Airlines', 'United',
      'Delta', 'Air France', 'KLM', 'Lufthansa', 'TAP', 'Emirates',
      'Qatar Airways', 'Turkish Airlines', 'Copa Airlines', 'Avianca',
    ];
    for (const result of response.organic || []) {
      const text = `${result.title} ${result.snippet}`;
      for (const airline of airlines) {
        if (text.toLowerCase().includes(airline.toLowerCase())) return airline;
      }
    }
    return null;
  }

  private extractStopsInfo(response: SerperSearchResponse): { stops: number; cities: string[] } {
    const cities: string[] = [];
    let stops = -1;
    for (const result of response.organic || []) {
      const text = `${result.title} ${result.snippet}`;
      if (/direto|nonstop|sem\s*escala/i.test(text) && stops === -1) { stops = 0; continue; }
      const m = text.match(/(\d)\s*(?:parada|escala|stop|conex)/i);
      if (m) { const n = parseInt(m[1], 10); if (stops === -1 || n < stops) stops = n; }
      const conn = text.match(/(?:escala|conexão|parada)\s+(?:em|in)\s+(\w+)/i);
      if (conn && !cities.includes(conn[1])) cities.push(conn[1]);
    }
    return { stops: stops === -1 ? 0 : stops, cities: cities.slice(0, 2) };
  }

  private extractBestLink(response: SerperSearchResponse): string | null {
    const priority = ['kayak.com', 'skyscanner', 'google.com/travel', 'decolar', 'maxmilhas'];
    for (const domain of priority) {
      const match = response.organic?.find(r => r.link.includes(domain));
      if (match) return match.link;
    }
    return response.organic?.[0]?.link || null;
  }

  private buildPromotion(params: {
    origin: string; dest: typeof KNOWN_DESTINATIONS[number]; price: number;
    isRoundTrip: boolean; airline: string | null; stops: number;
    stopoverCities: string[]; departureDate: string; returnDate: string;
    link: string | null;
  }): FlightPromotion {
    const { origin, dest, price, isRoundTrip, airline, stops, stopoverCities, departureDate, returnDate, link } = params;
    const countryName = COUNTRY_NAMES[dest.country] || dest.country;
    const score = Math.max(0, Math.min(50, 50 - (price / 100)));
    const stopsText = stops > 0 ? ` (${stops} escala${stops > 1 ? 's' : ''}${stopoverCities.length ? ` em ${stopoverCities.join(', ')}` : ''})` : '';

    return {
      id: `serper-${origin}-${dest.code}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      provider: this.name,
      origin,
      originName: origin,
      destination: dest.city,
      destinationCode: dest.code,
      destinationCountryCode: dest.country,
      destinationCountry: countryName,
      price,
      currency: 'BRL',
      departureDate,
      returnDate: isRoundTrip ? returnDate : null,
      airline,
      stops,
      stopoverCities: stopoverCities.length > 0 ? stopoverCities : null,
      durationMinutes: null,
      summary: `${origin} → ${dest.code} via ${airline || 'Diversas'}${stopsText} • ${isRoundTrip ? 'ida e volta' : 'trecho'}`,
      bookingUrl: link,
      googleFlightsUrl: buildGoogleFlightsUrl({
        origin, destinationCode: dest.code, destinationName: dest.city,
        departureDate, returnDate: isRoundTrip ? returnDate : null,
      }),
      score: Math.round(score),
      isCrazyDeal: score > 95,
      channels: ['international'],
    };
  }

  private getFutureDate(daysAhead: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date.toISOString().split('T')[0];
  }
}
