import type { PromotionChannelKey } from '@config/flight';

export interface FlightPromotion {
  id: string;
  provider: string;
  origin: string;
  originName: string;
  destination: string;
  destinationCode: string;
  destinationCountryCode: string;
  destinationCountry: string;
  price: number;
  currency: 'BRL';
  departureDate: string;
  returnDate: string | null;
  airline: string | null;
  stops: number;
  stopoverCities: string[] | null;
  durationMinutes: number | null;
  summary: string;
  bookingUrl: string | null;
  googleFlightsUrl: string;
  score: number;
  isCrazyDeal: boolean;
  channels: PromotionChannelKey[];
}
