import type { DateMonitorChannelKey } from '@config/flight';

export interface DateMonitor {
  id: string;
  userId: string;
  channelKey: DateMonitorChannelKey;
  origin: string;
  destinationCountryCode: string | null;
  maxPrice: number | null;
  dateFrom: string;
  dateTo: string;
  flexDays: number;
  createdAt: string;
}
