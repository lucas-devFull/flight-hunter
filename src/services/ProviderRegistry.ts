import type { FlightProvider } from '@flight-types/FlightProvider';

export interface ProviderConfig {
  name: string;
  priority: number; // menor = maior prioridade
  provider: FlightProvider;
  allocation: 'cron' | 'interactive' | 'both';
  limits: {
    maxRequests: number;
    cycle: 'daily' | 'monthly';
    reservedForInteractive: number; // quota mínima reservada
  };
}

export class ProviderRegistry {
  private readonly providers: ProviderConfig[];

  constructor(configs: ProviderConfig[]) {
    this.providers = [...configs].sort((a, b) => a.priority - b.priority);
  }

  /** Retorna providers ordenados por prioridade para o contexto dado */
  getProviders(context: 'cron' | 'interactive'): ProviderConfig[] {
    return this.providers.filter((config) => {
      if (config.allocation === 'both') return true;
      return config.allocation === context;
    });
  }

  /** Retorna um provider específico pelo nome */
  getByName(name: string): ProviderConfig | undefined {
    return this.providers.find((config) => config.name === name);
  }

  /** Retorna todos os providers registrados */
  getAll(): readonly ProviderConfig[] {
    return this.providers;
  }
}
