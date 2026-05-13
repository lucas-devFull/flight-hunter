import { logger } from '@utils/logger';

interface AviasalesCity {
  code: string;
  name: string | null;
  name_translations: { en?: string };
  country_code: string;
}

/** Cache de nomes de cidades por código IATA */
let cityMap: Map<string, string> | null = null;
let loadPromise: Promise<void> | null = null;
let lastLoadAttempt = 0;

const RELOAD_INTERVAL_MS = 7 * 24 * 3_600_000; // 7 dias

/**
 * Retorna o nome legível de uma cidade pelo código IATA.
 * Carrega o mapa da API na primeira chamada e cacheia em memória.
 */
export async function getCityName(code: string): Promise<string> {
  await ensureLoaded();
  return cityMap?.get(code) || code;
}

/**
 * Versão síncrona — retorna do cache ou o próprio código se não carregou ainda.
 */
export function getCityNameSync(code: string): string {
  return cityMap?.get(code) || code;
}

/** Pré-carrega o mapa de cidades */
export async function preloadCities(): Promise<void> {
  await ensureLoaded();
}

async function ensureLoaded(): Promise<void> {
  if (cityMap && Date.now() - lastLoadAttempt < RELOAD_INTERVAL_MS) return;

  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = loadCities();
  await loadPromise;
  loadPromise = null;
}

async function loadCities(): Promise<void> {
  lastLoadAttempt = Date.now();

  try {
    const response = await fetch('https://api.travelpayouts.com/data/pt/cities.json');
    if (!response.ok) {
      logger.warn({ status: response.status }, '[Aviasales] Falha ao carregar cidades');
      return;
    }

    const data: AviasalesCity[] = await response.json();
    const map = new Map<string, string>();

    for (const city of data) {
      if (!city.code) continue;
      // Prioridade: nome em português > nome em inglês > código
      const name = city.name || city.name_translations?.en || city.code;
      map.set(city.code, name);
    }

    cityMap = map;
    logger.info({ total: map.size }, '[Aviasales] Mapa de cidades carregado');
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : error }, '[Aviasales] Erro ao carregar cidades');
  }
}
