import { env } from '@config/env';
import { AviasalesProvider } from '@providers/aviasales/provider';
import { FlightApiProvider } from '@providers/FlightApiProvider';
import { GoogleFlightsScraperProvider } from '@providers/GoogleFlightsScraperProvider';
import { KiwiProvider } from '@providers/KiwiProvider';
import { SerperFlightsProvider } from '@providers/SerperFlightsProvider';
import { SkyScrapperProvider } from '@providers/SkyScrapperProvider';
import { ProviderRegistry } from '@services/ProviderRegistry';
import { logger } from '@utils/logger';

import type { ProviderConfig } from '@services/ProviderRegistry';
import type { FlightProvider } from '@flight-types/FlightProvider';

/**
 * Creates ProviderConfig[] for use with ProviderRegistry.
 * Instantiates providers based on available env vars and assigns priorities/allocations.
 * Ordem de prioridade por precisão de preço:
 * 1. Google Flights Scraper (preço real do Google Flights)
 * 2. SkyScrapper (preço real do Skyscanner)
 * 3. Kiwi (preço real com link de compra)
 * 4. Aviasales (cache/histórico - bom para discovery)
 * 5. FlightAPI (preço real mas às vezes inflado)
 * 6. Serper (estimativa de snippets - apenas cron)
 */
export function createProviderConfigs(): ProviderConfig[] {
  const configs: ProviderConfig[] = [];

  if (env.GOOGLE_FLIGHTS_RAPIDAPI_KEY) {
    configs.push({
      name: 'Google Flights',
      priority: 1,
      provider: new GoogleFlightsScraperProvider(env.GOOGLE_FLIGHTS_RAPIDAPI_KEY),
      allocation: 'both',
      limits: { maxRequests: 50, cycle: 'monthly', reservedForInteractive: 30 },
    });
    logger.info('[ProviderFactory] Google Flights Scraper provider configurado (prioridade 1)');
  }

  if (env.SKYSCRAPPER_RAPIDAPI_KEY) {
    configs.push({
      name: 'SkyScrapper',
      priority: 2,
      provider: new SkyScrapperProvider(env.SKYSCRAPPER_RAPIDAPI_KEY),
      allocation: 'both',
      limits: { maxRequests: 50, cycle: 'monthly', reservedForInteractive: 30 },
    });
    logger.info('[ProviderFactory] SkyScrapper provider configurado (prioridade 2)');
  }

  if (env.KIWI_RAPIDAPI_KEY) {
    configs.push({
      name: 'Kiwi',
      priority: 3,
      provider: new KiwiProvider(env.KIWI_RAPIDAPI_KEY),
      allocation: 'both',
      limits: { maxRequests: 300, cycle: 'monthly', reservedForInteractive: 200 },
    });
    logger.info('[ProviderFactory] Kiwi provider configurado (prioridade 3)');
  }

  if (env.AVIASALES_TOKEN) {
    configs.push({
      name: 'Aviasales',
      priority: 4,
      provider: new AviasalesProvider(env.AVIASALES_TOKEN),
      allocation: 'both',
      limits: { maxRequests: 1000, cycle: 'daily', reservedForInteractive: 100 },
    });
    logger.info('[ProviderFactory] Aviasales provider configurado (prioridade 4)');
  }

  if (env.FLIGHTAPI_KEY) {
    configs.push({
      name: 'FlightAPI',
      priority: 5,
      provider: new FlightApiProvider(env.FLIGHTAPI_KEY),
      allocation: 'interactive',
      limits: { maxRequests: 50, cycle: 'monthly', reservedForInteractive: 30 },
    });
    logger.info('[ProviderFactory] FlightAPI provider configurado (prioridade 5)');
  }

  // Serper is always available (required env var)
  configs.push({
    name: 'Serper',
    priority: 6,
    provider: new SerperFlightsProvider(env.SERPER_API_KEY),
    allocation: 'cron',
    limits: { maxRequests: 80, cycle: 'daily', reservedForInteractive: 0 },
  });
  logger.info('[ProviderFactory] Serper provider configurado (prioridade 6 - apenas cron)');

  logger.info(
    { providers: configs.map((c) => c.name), count: configs.length },
    '[ProviderFactory] ProviderConfigs criados',
  );

  return configs;
}

/**
 * Creates a ProviderRegistry instance from the default provider configs.
 * Instantiates providers based on available env vars.
 */
export function createProviderRegistry(): ProviderRegistry {
  const configs = createProviderConfigs();
  const registry = new ProviderRegistry(configs);
  logger.info(
    { providers: configs.map((c) => c.name), count: configs.length },
    '[ProviderFactory] ProviderRegistry criado',
  );
  return registry;
}

/** Singleton instance of ProviderRegistry for shared use across PromotionService and PromoJob */
export const providerRegistry: ProviderRegistry = createProviderRegistry();

export function createFlightProviders(): readonly FlightProvider[] {
  const providers: FlightProvider[] = [];
  const mode = env.FLIGHT_PROVIDER;

  const useSerper = mode === 'serper' || mode === 'both' || mode === 'auto' || mode === 'all';
  const useAviasales = mode === 'aviasales' || mode === 'both' || mode === 'all' || (mode === 'auto' && !!env.AVIASALES_TOKEN);
  const useKiwi = !!env.KIWI_RAPIDAPI_KEY;
  const useFlightApi = !!env.FLIGHTAPI_KEY;
  const useSkyScrapper = !!env.SKYSCRAPPER_RAPIDAPI_KEY;

  if (useSerper) {
    providers.push(new SerperFlightsProvider(env.SERPER_API_KEY));
    logger.info('[ProviderFactory] Serper provider ativo');
  }

  if (useAviasales && env.AVIASALES_TOKEN) {
    providers.push(new AviasalesProvider(env.AVIASALES_TOKEN));
    logger.info('[ProviderFactory] Aviasales Data provider ativo');
  }

  if (useKiwi && env.KIWI_RAPIDAPI_KEY) {
    providers.push(new KiwiProvider(env.KIWI_RAPIDAPI_KEY));
    logger.info('[ProviderFactory] Kiwi provider ativo');
  }

  if (useFlightApi && env.FLIGHTAPI_KEY) {
    providers.push(new FlightApiProvider(env.FLIGHTAPI_KEY));
    logger.info('[ProviderFactory] FlightAPI provider ativo');
  }

  if (useSkyScrapper && env.SKYSCRAPPER_RAPIDAPI_KEY) {
    providers.push(new SkyScrapperProvider(env.SKYSCRAPPER_RAPIDAPI_KEY));
    logger.info('[ProviderFactory] Sky Scrapper provider ativo');
  }

  if (providers.length === 0) {
    logger.warn('[ProviderFactory] Nenhum provider configurado, usando Serper como fallback');
    providers.push(new SerperFlightsProvider(env.SERPER_API_KEY));
  }

  logger.info(
    { providers: providers.map((p) => p.name), mode },
    '[ProviderFactory] Providers inicializados',
  );

  return providers;
}
