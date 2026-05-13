import type { AviasalesCheapFlight, AviasalesDeal, AviasalesLatestFlight } from '../types/deal.types';

/** Mapa de cidades por código IATA */
const CITY_NAMES: Record<string, string> = {
  GRU: 'Sao Paulo', CGH: 'Sao Paulo', VCP: 'Campinas', GIG: 'Rio de Janeiro',
  SDU: 'Rio de Janeiro', BSB: 'Brasilia', CNF: 'Belo Horizonte', REC: 'Recife', FOR: 'Fortaleza',
  SAO: 'Sao Paulo', RIO: 'Rio de Janeiro', BHZ: 'Belo Horizonte', CWB: 'Curitiba',
  MIA: 'Miami', JFK: 'New York', MCO: 'Orlando', LAX: 'Los Angeles',
  LIS: 'Lisboa', MAD: 'Madrid', BCN: 'Barcelona', CDG: 'Paris', FCO: 'Roma', MXP: 'Milao',
  LHR: 'Londres', AMS: 'Amsterdam', FRA: 'Frankfurt',
  SCL: 'Santiago', EZE: 'Buenos Aires', BOG: 'Bogota', LIM: 'Lima', CUZ: 'Cusco',
  NRT: 'Tokyo', KIX: 'Osaka', BKK: 'Bangkok', HKT: 'Phuket',
  PEK: 'Beijing', PVG: 'Shanghai', CUN: 'Cancun', MEX: 'Cidade do Mexico',
};

function calcTripDays(departure: string, returnDate?: string): number | undefined {
  if (!returnDate) return undefined;
  const dep = new Date(departure);
  const ret = new Date(returnDate);
  const diff = Math.round((ret.getTime() - dep.getTime()) / 86_400_000);
  return diff > 0 ? diff : undefined;
}

/** Normaliza um voo do endpoint /v2/prices/latest para AviasalesDeal */
export function normalizeLatestFlight(flight: AviasalesLatestFlight): AviasalesDeal {
  return {
    provider: 'aviasales',
    origin: flight.origin,
    destination: flight.destination,
    originCity: CITY_NAMES[flight.origin],
    destinationCity: CITY_NAMES[flight.destination],
    departureAt: flight.depart_date,
    returnAt: flight.return_date || undefined,
    airline: flight.gate || undefined,
    price: flight.value,
    currency: 'BRL',
    transfers: flight.number_of_changes,
    foundAt: flight.found_at,
    tripDays: calcTripDays(flight.depart_date, flight.return_date),
    source: 'latest',
  };
}

/** Normaliza um voo do endpoint /v1/prices/cheap para AviasalesDeal */
export function normalizeCheapFlight(
  origin: string,
  destination: string,
  flight: AviasalesCheapFlight,
  transfers?: number,
): AviasalesDeal {
  return {
    provider: 'aviasales',
    origin,
    destination,
    originCity: CITY_NAMES[origin],
    destinationCity: CITY_NAMES[destination],
    departureAt: flight.departure_at,
    returnAt: flight.return_at || undefined,
    airline: flight.airline || undefined,
    price: flight.price,
    currency: 'BRL',
    transfers: transfers ?? flight.number_of_changes ?? 0,
    foundAt: new Date().toISOString(),
    tripDays: calcTripDays(flight.departure_at, flight.return_at),
    source: 'cheap',
  };
}
