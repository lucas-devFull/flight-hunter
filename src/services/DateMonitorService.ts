import type { DateMonitorChannelKey } from '@config/flight';
import type { DateMonitor } from '@flight-types/DateMonitor';

interface CreateDateMonitorInput {
  userId: string;
  channelKey: DateMonitorChannelKey;
  origin: string;
  destinationCountryCode: string | null;
  maxPrice: number | null;
  dateFrom: string;
  dateTo: string;
  flexDays: number;
}

const monitors = new Map<string, DateMonitor>();

export class DateMonitorService {
  public create(input: CreateDateMonitorInput): DateMonitor {
    const monitor: DateMonitor = {
      ...input,
      createdAt: new Date().toISOString(),
      id: `${input.userId}:${Date.now()}`,
    };

    monitors.set(monitor.id, monitor);
    return monitor;
  }

  public listByUser(userId: string): DateMonitor[] {
    return [...monitors.values()].filter((monitor) => monitor.userId === userId);
  }

  public listAll(): DateMonitor[] {
    return [...monitors.values()];
  }

  public removeByUser(userId: string, monitorId?: string): number {
    const userMonitors = this.listByUser(userId);
    const removable = monitorId
      ? userMonitors.filter((monitor) => monitor.id === monitorId)
      : userMonitors;

    removable.forEach((monitor) => monitors.delete(monitor.id));
    return removable.length;
  }
}
