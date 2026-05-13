import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ProviderRegistry, type ProviderConfig } from '@services/ProviderRegistry';
import type { FlightProvider } from '@flight-types/FlightProvider';

/**
 * Feature: bot-refactor-providers-channels, Property 1: Ordenação do Registry por Prioridade
 *
 * Validates: Requirements 1.1
 *
 * Para qualquer configuração válida do ProviderRegistry, o método getProviders()
 * deve retornar providers ordenados pelo campo priority em ordem crescente
 * (menor número = maior prioridade).
 */

const mockFlightProvider: FlightProvider = {
  name: 'mock-provider',
  fetchPromotions: async () => [],
};

const providerConfigArb = (allocation: 'cron' | 'interactive' | 'both' = 'both') =>
  fc.record({
    name: fc.string({ minLength: 1, maxLength: 20 }),
    priority: fc.integer({ min: 1, max: 1000 }),
    provider: fc.constant(mockFlightProvider),
    allocation: fc.constant(allocation),
    limits: fc.record({
      maxRequests: fc.integer({ min: 1, max: 10000 }),
      cycle: fc.constantFrom('daily' as const, 'monthly' as const),
      reservedForInteractive: fc.integer({ min: 0, max: 1000 }),
    }),
  });

const providerConfigsArb = fc.array(providerConfigArb(), { minLength: 1, maxLength: 20 });

const mixedAllocationConfigsArb = fc.array(
  fc.oneof(
    providerConfigArb('cron'),
    providerConfigArb('interactive'),
    providerConfigArb('both'),
  ),
  { minLength: 1, maxLength: 20 },
);

describe('Feature: bot-refactor-providers-channels, Property 1: Ordenação do Registry por Prioridade', () => {
  it('getProviders("cron") returns providers sorted by priority in ascending order', () => {
    fc.assert(
      fc.property(mixedAllocationConfigsArb, (configs) => {
        const registry = new ProviderRegistry(configs);
        const result = registry.getProviders('cron');

        for (let i = 1; i < result.length; i++) {
          expect(result[i].priority).toBeGreaterThanOrEqual(result[i - 1].priority);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('getProviders("interactive") returns providers sorted by priority in ascending order', () => {
    fc.assert(
      fc.property(mixedAllocationConfigsArb, (configs) => {
        const registry = new ProviderRegistry(configs);
        const result = registry.getProviders('interactive');

        for (let i = 1; i < result.length; i++) {
          expect(result[i].priority).toBeGreaterThanOrEqual(result[i - 1].priority);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('getAll() returns all providers sorted by priority in ascending order', () => {
    fc.assert(
      fc.property(providerConfigsArb, (configs) => {
        const registry = new ProviderRegistry(configs);
        const result = registry.getAll();

        for (let i = 1; i < result.length; i++) {
          expect(result[i].priority).toBeGreaterThanOrEqual(result[i - 1].priority);
        }
      }),
      { numRuns: 100 },
    );
  });
});
