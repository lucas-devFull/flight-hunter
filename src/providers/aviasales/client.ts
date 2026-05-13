import { logger } from '@utils/logger';

import type {
  AviasalesCheapResponse,
  AviasalesCalendarResponse,
  AviasalesLatestResponse,
} from './types/deal.types';

const BASE_URL = 'https://api.travelpayouts.com';

/** Rate limiting e retry para a Aviasales Data API */
export class AviasalesClient {
  private readonly token: string;
  private lastRequestTime = 0;
  private readonly minIntervalMs = 300; // 300ms entre requests
  private rateLimitedUntil = 0;

  constructor(token: string) {
    this.token = token;
  }

  async fetchCheap(origin: string, destination?: string): Promise<AviasalesCheapResponse | null> {
    const params = new URLSearchParams({
      origin,
      currency: 'BRL',
      token: this.token,
    });
    if (destination) params.set('destination', destination);

    return this.request<AviasalesCheapResponse>(`/v1/prices/cheap?${params}`);
  }

  async fetchLatest(origin: string, destination?: string): Promise<AviasalesLatestResponse | null> {
    const params = new URLSearchParams({
      origin,
      currency: 'BRL',
      token: this.token,
      limit: '30',
      sorting: 'price',
    });
    if (destination) params.set('destination', destination);

    return this.request<AviasalesLatestResponse>(`/v2/prices/latest?${params}`);
  }

  async fetchCalendar(origin: string, destination: string): Promise<AviasalesCalendarResponse | null> {
    const params = new URLSearchParams({
      origin,
      destination,
      currency: 'BRL',
      token: this.token,
    });

    return this.request<AviasalesCalendarResponse>(`/v1/prices/calendar?${params}`);
  }

  private async request<T>(path: string): Promise<T | null> {
    if (Date.now() < this.rateLimitedUntil) {
      logger.debug('[Aviasales] Ainda em rate limit, pulando');
      return null;
    }

    await this.throttle();

    try {
      const url = `${BASE_URL}${path}`;
      logger.debug({ url }, '[Aviasales] Request');

      const response = await fetch(url, {
        headers: {
          'X-Access-Token': this.token,
          'Accept': 'application/json',
        },
      });

      this.lastRequestTime = Date.now();

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60_000;
        this.rateLimitedUntil = Date.now() + waitMs;
        logger.warn({ waitMs }, '[Aviasales] Rate limit 429');
        return null;
      }

      if (response.status === 403 || response.status === 401) {
        logger.error({ status: response.status }, '[Aviasales] Token invalido ou sem acesso');
        this.rateLimitedUntil = Date.now() + 3_600_000;
        return null;
      }

      if (!response.ok) {
        logger.error({ status: response.status }, '[Aviasales] Erro HTTP');
        return null;
      }

      return await response.json() as T;
    } catch (error) {
      logger.error({ error }, '[Aviasales] Erro de rede');
      return null;
    }
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
  }
}
