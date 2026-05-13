const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function isIsoDateOnly(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  return Math.ceil((end.getTime() - start.getTime()) / DAY_IN_MS);
}

export function dateIsInsideFlexibleRange(
  date: string,
  dateFrom: string,
  dateTo: string,
  flexDays: number,
): boolean {
  const targetTime = new Date(`${date}T00:00:00.000Z`).getTime();
  const fromTime = new Date(`${dateFrom}T00:00:00.000Z`).getTime() - flexDays * DAY_IN_MS;
  const toTime = new Date(`${dateTo}T00:00:00.000Z`).getTime() + flexDays * DAY_IN_MS;

  return targetTime >= fromTime && targetTime <= toTime;
}
