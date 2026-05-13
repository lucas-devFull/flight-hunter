/** Estrutura padronizada de deal vinda da Aviasales Data API */
export interface AviasalesDeal {
  provider: 'aviasales';
  origin: string;
  destination: string;
  originCity?: string;
  destinationCity?: string;
  departureAt: string;
  returnAt?: string;
  airline?: string;
  price: number;
  currency: string;
  transfers?: number;
  foundAt: string;
  tripDays?: number;
  score?: number;
  tags?: string[];
  validation?: {
    status: 'pending' | 'validated' | 'expired';
    checkedAt?: string;
  };
  metadata?: {
    searchCount?: number;
    popularity?: number;
    historicalLow?: boolean;
  };
  source: string;
}

/** Resposta do endpoint /v1/prices/cheap */
export interface AviasalesCheapResponse {
  success: boolean;
  data: Record<string, Record<string, AviasalesCheapFlight>>;
  currency: string;
}

export interface AviasalesCheapFlight {
  price: number;
  airline: string;
  flight_number: number;
  departure_at: string;
  return_at: string;
  expires_at: string;
  number_of_changes?: number;
  duration?: number;
  duration_to?: number;
  duration_back?: number;
}

/** Resposta do endpoint /v2/prices/latest */
export interface AviasalesLatestResponse {
  success: boolean;
  data: AviasalesLatestFlight[];
  currency: string;
}

export interface AviasalesLatestFlight {
  origin: string;
  destination: string;
  depart_date: string;
  return_date: string;
  gate: string;
  found_at: string;
  trip_class: number;
  value: number;
  number_of_changes: number;
  duration: number;
  distance: number;
  show_to_affiliates: boolean;
  actual: boolean;
}

/** Resposta do endpoint /v1/prices/calendar */
export interface AviasalesCalendarResponse {
  success: boolean;
  data: Record<string, AviasalesCalendarFlight>;
  currency: string;
}

export interface AviasalesCalendarFlight {
  origin: string;
  destination: string;
  price: number;
  airline: string;
  flight_number: number;
  departure_at: string;
  return_at: string;
  expires_at: string;
  number_of_changes: number;
}
