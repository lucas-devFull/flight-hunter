import { describe, it, expect } from 'vitest';
import { ProviderRegistry, type ProviderConfig } from '@services/ProviderRegistry';
import type { FlightProvider } from '@flight-types/FlightProvider';

/**
 * Unit tests for ProviderRegistry
 * Validates: Requirements 1.1, 8.1, 8.2, 8.3, 8.4
 */

function createMockProvider(name: string): FlightProvider {
  return {
    name,
    fetchPromotions: async () => [],
  };
}

const defaultConfigs: ProviderConfig[] = [
  {
    name: 'Aviasales',
    priority: 1,
    provider: createMockProvider('Aviasales'),
    allocation: 'both',
    limits: { maxRequests: 1000, cycle: 'daily', reservedForInteractive: 100 },
  },
  {
    name: 'Kiwi',
    priority: 2,
    provider: createMockProvider('Kiwi'),
    allocation: 'interactive',
    limits: { maxRequests: 300, cycle: 'monthly', reservedForInteractive: 200 },
  },
  {
    name: 'SkyScrapper',
    priority: 3,
    provider: createMockProvider('SkyScrapper'),
    allocation: 'interactive',
    limits: { maxRequests: 50, cycle: 'monthly', reservedForInteractive: 30 },
  },
  {
    name: 'FlightAPI',
    priority: 4,
    provider: createMockProvider('FlightAPI'),
    allocation: 'interactive',
    limits: { maxRequests: 50, cycle: 'monthly', reservedForInteractive: 30 },
  },
  {
    name: 'Serper',
    priority: 5,
    provider: createMockProvider('Serper'),
    allocation: 'both',
    limits: { maxRequests: 80, cycle: 'daily', reservedForInteractive: 20 },
  },
];

describe('ProviderRegistry — Unit Tests', () => {
  describe('Default configuration with 5 providers', () => {
    it('registers all 5 providers', () => {
      const registry = new ProviderRegistry(defaultConfigs);
      const all = registry.getAll();

      expect(all).toHaveLength(5);
    });

    it('returns providers sorted by priority (ascending)', () => {
      const registry = new ProviderRegistry(defaultConfigs);
      const all = registry.getAll();

      expect(all[0].name).toBe('Aviasales');
      expect(all[0].priority).toBe(1);
      expect(all[1].name).toBe('Kiwi');
      expect(all[1].priority).toBe(2);
      expect(all[2].name).toBe('SkyScrapper');
      expect(all[2].priority).toBe(3);
      expect(all[3].name).toBe('FlightAPI');
      expect(all[3].priority).toBe(4);
      expect(all[4].name).toBe('Serper');
      expect(all[4].priority).toBe(5);
    });

    it('sorts correctly even when configs are provided out of order', () => {
      const shuffled = [defaultConfigs[4], defaultConfigs[2], defaultConfigs[0], defaultConfigs[3], defaultConfigs[1]];
      const registry = new ProviderRegistry(shuffled);
      const all = registry.getAll();

      expect(all[0].name).toBe('Aviasales');
      expect(all[1].name).toBe('Kiwi');
      expect(all[2].name).toBe('SkyScrapper');
      expect(all[3].name).toBe('FlightAPI');
      expect(all[4].name).toBe('Serper');
    });

    it('can retrieve each provider by name', () => {
      const registry = new ProviderRegistry(defaultConfigs);

      expect(registry.getByName('Aviasales')?.priority).toBe(1);
      expect(registry.getByName('Kiwi')?.priority).toBe(2);
      expect(registry.getByName('SkyScrapper')?.priority).toBe(3);
      expect(registry.getByName('FlightAPI')?.priority).toBe(4);
      expect(registry.getByName('Serper')?.priority).toBe(5);
    });

    it('returns undefined for unknown provider name', () => {
      const registry = new ProviderRegistry(defaultConfigs);

      expect(registry.getByName('NonExistent')).toBeUndefined();
    });
  });

  describe('Filter by context "cron"', () => {
    it('returns only providers with allocation "cron" or "both"', () => {
      const registry = new ProviderRegistry(defaultConfigs);
      const cronProviders = registry.getProviders('cron');

      expect(cronProviders).toHaveLength(2);
      expect(cronProviders[0].name).toBe('Aviasales');
      expect(cronProviders[1].name).toBe('Serper');
    });

    it('excludes providers with allocation "interactive"', () => {
      const registry = new ProviderRegistry(defaultConfigs);
      const cronProviders = registry.getProviders('cron');
      const names = cronProviders.map((p) => p.name);

      expect(names).not.toContain('Kiwi');
      expect(names).not.toContain('SkyScrapper');
      expect(names).not.toContain('FlightAPI');
    });

    it('returns cron providers sorted by priority', () => {
      const registry = new ProviderRegistry(defaultConfigs);
      const cronProviders = registry.getProviders('cron');

      expect(cronProviders[0].priority).toBe(1); // Aviasales
      expect(cronProviders[1].priority).toBe(5); // Serper
    });
  });

  describe('Filter by context "interactive"', () => {
    it('returns all providers except those exclusive to cron', () => {
      const registry = new ProviderRegistry(defaultConfigs);
      const interactiveProviders = registry.getProviders('interactive');

      // All 5 default providers are either 'interactive' or 'both', so all are returned
      expect(interactiveProviders).toHaveLength(5);
    });

    it('returns interactive providers sorted by priority', () => {
      const registry = new ProviderRegistry(defaultConfigs);
      const interactiveProviders = registry.getProviders('interactive');

      for (let i = 1; i < interactiveProviders.length; i++) {
        expect(interactiveProviders[i].priority).toBeGreaterThanOrEqual(
          interactiveProviders[i - 1].priority,
        );
      }
    });

    it('excludes a provider with allocation "cron" from interactive context', () => {
      const configsWithCronOnly: ProviderConfig[] = [
        ...defaultConfigs,
        {
          name: 'CronOnly',
          priority: 6,
          provider: createMockProvider('CronOnly'),
          allocation: 'cron',
          limits: { maxRequests: 100, cycle: 'daily', reservedForInteractive: 0 },
        },
      ];
      const registry = new ProviderRegistry(configsWithCronOnly);
      const interactiveProviders = registry.getProviders('interactive');
      const names = interactiveProviders.map((p) => p.name);

      expect(names).not.toContain('CronOnly');
      expect(interactiveProviders).toHaveLength(5);
    });

    it('includes providers with allocation "both" in interactive context', () => {
      const registry = new ProviderRegistry(defaultConfigs);
      const interactiveProviders = registry.getProviders('interactive');
      const names = interactiveProviders.map((p) => p.name);

      expect(names).toContain('Aviasales');
      expect(names).toContain('Serper');
    });
  });
});
