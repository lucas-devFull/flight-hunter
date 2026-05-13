import type { FlightPromotion } from '@flight-types/FlightPromotion';

export type SearchChannel = 'international' | 'brazil' | 'all';

export interface PromotionSearchCriteria {
  channel?: SearchChannel;
  dateFrom?: string;
  dateTo?: string;
  origins?: readonly string[];
  destinations?: readonly string[];
  destinationCountryCodes?: readonly string[];
  limit?: number;
  maxStopovers?: number;
  daysAhead?: number;
}

export interface FlightProvider {
  readonly name: string;
  fetchPromotions(criteria?: PromotionSearchCriteria): Promise<FlightPromotion[]>;
}
