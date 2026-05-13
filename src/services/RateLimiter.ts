import type { ProviderRegistry } from '@services/ProviderRegistry';

export interface ProviderUsage {
  name: string;
  used: number;
  limit: number;
  remaining: number;
  available: boolean;
  cycle: 'daily' | 'monthly';
  resetAt: Date;
}

interface ProviderUsageState {
  providerName: string;
  requestsUsed: number;
  cycleStart: number; // timestamp do início do ciclo atual
}

export class RateLimiter {
  private readonly registry: ProviderRegistry;
  private readonly state: Map<string, ProviderUsageState> = new Map();
  private readonly _getNow: () => Date;

  constructor(registry: ProviderRegistry, getNow?: () => Date) {
    this.registry = registry;
    this._getNow = getNow ?? (() => new Date());

    // Initialize state for all registered providers
    for (const config of registry.getAll()) {
      this.state.set(config.name, {
        providerName: config.name,
        requestsUsed: 0,
        cycleStart: this._getNow().getTime(),
      });
    }
  }

  /** Verifica se o provider pode receber requisição */
  isAvailable(providerName: string, context: 'cron' | 'interactive'): boolean {
    const config = this.registry.getByName(providerName);
    if (!config) return false;

    this.resetIfNeeded(providerName);

    const usageState = this.state.get(providerName);
    if (!usageState) return false;

    const { maxRequests, reservedForInteractive } = config.limits;

    if (context === 'cron') {
      // Cron cannot use the reserved quota for interactive
      return usageState.requestsUsed < maxRequests - reservedForInteractive;
    }

    // Interactive can use the full quota
    return usageState.requestsUsed < maxRequests;
  }

  /** Registra uma requisição consumida */
  consume(providerName: string): void {
    const config = this.registry.getByName(providerName);
    if (!config) return;

    this.resetIfNeeded(providerName);

    const usageState = this.state.get(providerName);
    if (!usageState) return;

    usageState.requestsUsed++;
  }

  /** Retorna uso atual de todos os providers */
  getUsage(): ProviderUsage[] {
    const allConfigs = this.registry.getAll();
    const usages: ProviderUsage[] = [];

    for (const config of allConfigs) {
      const usage = this.getProviderUsage(config.name);
      if (usage) {
        usages.push(usage);
      }
    }

    return usages;
  }

  /** Retorna uso de um provider específico */
  getProviderUsage(providerName: string): ProviderUsage | undefined {
    const config = this.registry.getByName(providerName);
    if (!config) return undefined;

    this.resetIfNeeded(providerName);

    const usageState = this.state.get(providerName);
    if (!usageState) return undefined;

    const { maxRequests, cycle } = config.limits;
    const remaining = Math.max(0, maxRequests - usageState.requestsUsed);

    return {
      name: providerName,
      used: usageState.requestsUsed,
      limit: maxRequests,
      remaining,
      available: remaining > 0,
      cycle,
      resetAt: this.computeResetAt(usageState.cycleStart, cycle),
    };
  }

  /** Reseta contadores conforme ciclo (chamado internamente) */
  private resetIfNeeded(providerName: string): void {
    const config = this.registry.getByName(providerName);
    if (!config) return;

    const usageState = this.state.get(providerName);
    if (!usageState) return;

    const now = this._getNow();
    const cycleStart = new Date(usageState.cycleStart);
    const { cycle } = config.limits;

    if (cycle === 'daily') {
      // Reset if current time is past midnight of the next day from cycleStart
      const nextDay = new Date(cycleStart);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);

      if (now.getTime() >= nextDay.getTime()) {
        usageState.requestsUsed = 0;
        usageState.cycleStart = now.getTime();
      }
    } else if (cycle === 'monthly') {
      // Reset if current time is past the 1st of the next month from cycleStart
      const nextMonth = new Date(cycleStart);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);

      if (now.getTime() >= nextMonth.getTime()) {
        usageState.requestsUsed = 0;
        usageState.cycleStart = now.getTime();
      }
    }
  }

  /** Calcula a data de reset para o ciclo atual */
  private computeResetAt(cycleStartTimestamp: number, cycle: 'daily' | 'monthly'): Date {
    const cycleStart = new Date(cycleStartTimestamp);

    if (cycle === 'daily') {
      const nextDay = new Date(cycleStart);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      return nextDay;
    }

    // monthly
    const nextMonth = new Date(cycleStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth;
  }
}
