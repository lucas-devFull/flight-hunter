import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ProviderRegistry, type ProviderConfig } from '@services/ProviderRegistry';
import { RateLimiter } from '@services/RateLimiter';
import type { FlightProvider } from '@flight-types/FlightProvider';

const mockFlightProvider: FlightProvider = {
  name: 'mock-provider',
  fetchPromotions: async () => [],
};

/**
 * Helper: creates a ProviderConfig with a given limit and optional reservedForInteractive.
 */
function makeConfig(
  name: string,
  maxRequests: number,
  cycle: 'daily' | 'monthly' = 'monthly',
  reservedForInteractive: number = 0,
): ProviderConfig {
  return {
    name,
    priority: 1,
    provider: mockFlightProvider,
    allocation: 'both',
    limits: {
      maxRequests,
      cycle,
      reservedForInteractive,
    },
  };
}

/**
 * Feature: bot-refactor-providers-channels, Property 2: Invariante de Requisições Restantes
 *
 * Validates: Requirements 1.2, 1.7
 *
 * Para qualquer provider com limite L e após U chamadas a consume(),
 * o valor retornado por getProviderUsage().remaining deve ser igual a L - U,
 * e getProviderUsage().used deve ser igual a U.
 */
describe('Feature: bot-refactor-providers-channels, Property 2: Invariante de Requisições Restantes', () => {
  it('remaining = limit - used after N consume() calls', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (limit, consumeCalls) => {
          // Ensure consumeCalls does not exceed limit for this property
          const used = Math.min(consumeCalls, limit);

          const config = makeConfig('test-provider', limit);
          const registry = new ProviderRegistry([config]);
          const rateLimiter = new RateLimiter(registry);

          for (let i = 0; i < used; i++) {
            rateLimiter.consume('test-provider');
          }

          const usage = rateLimiter.getProviderUsage('test-provider');
          expect(usage).toBeDefined();
          expect(usage!.used).toBe(used);
          expect(usage!.remaining).toBe(limit - used);
          expect(usage!.limit).toBe(limit);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('remaining is never negative even when consuming beyond limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 100 }),
        (limit, consumeCalls) => {
          const config = makeConfig('test-provider', limit);
          const registry = new ProviderRegistry([config]);
          const rateLimiter = new RateLimiter(registry);

          for (let i = 0; i < consumeCalls; i++) {
            rateLimiter.consume('test-provider');
          }

          const usage = rateLimiter.getProviderUsage('test-provider');
          expect(usage).toBeDefined();
          expect(usage!.remaining).toBeGreaterThanOrEqual(0);
          expect(usage!.used).toBe(consumeCalls);
          expect(usage!.remaining).toBe(Math.max(0, limit - consumeCalls));
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: bot-refactor-providers-channels, Property 3: Indisponibilidade Após Limite
 *
 * Validates: Requirements 1.3
 *
 * Para qualquer provider com limite N, após exatamente N chamadas a consume(),
 * isAvailable() deve retornar false. Para qualquer número de chamadas menor que N,
 * isAvailable() deve retornar true.
 */
describe('Feature: bot-refactor-providers-channels, Property 3: Indisponibilidade Após Limite', () => {
  it('isAvailable() returns false after exactly N consume() calls (interactive context)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (limit) => {
          const config = makeConfig('test-provider', limit, 'monthly', 0);
          const registry = new ProviderRegistry([config]);
          const rateLimiter = new RateLimiter(registry);

          // Before reaching limit, should be available
          for (let i = 0; i < limit; i++) {
            expect(rateLimiter.isAvailable('test-provider', 'interactive')).toBe(true);
            rateLimiter.consume('test-provider');
          }

          // After exactly N calls, should be unavailable
          expect(rateLimiter.isAvailable('test-provider', 'interactive')).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('isAvailable() returns true for any number of calls less than N (interactive context)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        fc.integer({ min: 0, max: 99 }),
        (limit, callsBeforeLimit) => {
          const used = Math.min(callsBeforeLimit, limit - 1);

          const config = makeConfig('test-provider', limit, 'monthly', 0);
          const registry = new ProviderRegistry([config]);
          const rateLimiter = new RateLimiter(registry);

          for (let i = 0; i < used; i++) {
            rateLimiter.consume('test-provider');
          }

          expect(rateLimiter.isAvailable('test-provider', 'interactive')).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: bot-refactor-providers-channels, Property 5: Reset de Ciclo Restaura Disponibilidade
 *
 * Validates: Requirements 1.5
 *
 * Para qualquer provider que atingiu seu limite (isAvailable = false),
 * após avançar o tempo além do fim do ciclo (dia para daily, mês para monthly),
 * isAvailable() deve retornar true e remaining deve ser igual ao limite máximo.
 */
describe('Feature: bot-refactor-providers-channels, Property 5: Reset de Ciclo Restaura Disponibilidade', () => {
  it('daily cycle: availability is restored after advancing past next day boundary', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (limit) => {
          // Use a base time at the start of the day (local midnight) to avoid timezone issues
          const baseTime = new Date(2024, 5, 15, 0, 0, 0, 0); // June 15, 2024 midnight local
          let currentTime = baseTime;

          const config = makeConfig('test-provider', limit, 'daily', 0);
          const registry = new ProviderRegistry([config]);
          const rateLimiter = new RateLimiter(registry, () => currentTime);

          // Exhaust the limit
          for (let i = 0; i < limit; i++) {
            rateLimiter.consume('test-provider');
          }

          expect(rateLimiter.isAvailable('test-provider', 'interactive')).toBe(false);

          // Advance time past midnight of the next day (local time)
          currentTime = new Date(2024, 5, 16, 0, 0, 1, 0); // June 16, 2024 00:00:01 local

          expect(rateLimiter.isAvailable('test-provider', 'interactive')).toBe(true);

          const usage = rateLimiter.getProviderUsage('test-provider');
          expect(usage).toBeDefined();
          expect(usage!.remaining).toBe(limit);
          expect(usage!.used).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('monthly cycle: availability is restored after advancing past 1st of next month', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (limit) => {
          // Use a base time at the start of the day (local midnight) to avoid timezone issues
          const baseTime = new Date(2024, 5, 15, 0, 0, 0, 0); // June 15, 2024 midnight local
          let currentTime = baseTime;

          const config = makeConfig('test-provider', limit, 'monthly', 0);
          const registry = new ProviderRegistry([config]);
          const rateLimiter = new RateLimiter(registry, () => currentTime);

          // Exhaust the limit
          for (let i = 0; i < limit; i++) {
            rateLimiter.consume('test-provider');
          }

          expect(rateLimiter.isAvailable('test-provider', 'interactive')).toBe(false);

          // Advance time past 1st of next month (local time)
          currentTime = new Date(2024, 6, 1, 0, 0, 1, 0); // July 1, 2024 00:00:01 local

          expect(rateLimiter.isAvailable('test-provider', 'interactive')).toBe(true);

          const usage = rateLimiter.getProviderUsage('test-provider');
          expect(usage).toBeDefined();
          expect(usage!.remaining).toBe(limit);
          expect(usage!.used).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: bot-refactor-providers-channels, Property 15: Reserva de Quota para Comandos Interativos
 *
 * Validates: Requirements 8.5
 *
 * Para qualquer provider com limite L e reservedForInteractive = R,
 * quando o contexto é 'cron', isAvailable() deve retornar false quando used >= L - R.
 * Quando o contexto é 'interactive', isAvailable() deve retornar false apenas quando used >= L.
 */
describe('Feature: bot-refactor-providers-channels, Property 15: Reserva de Quota para Comandos Interativos', () => {
  it('cron context: isAvailable() returns false when used >= limit - reservedForInteractive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (limit, reserved) => {
          // Ensure reserved < limit
          const R = Math.min(reserved, limit - 1);
          const cronThreshold = limit - R;

          const config = makeConfig('test-provider', limit, 'monthly', R);
          const registry = new ProviderRegistry([config]);
          const rateLimiter = new RateLimiter(registry);

          // Consume up to the cron threshold
          for (let i = 0; i < cronThreshold; i++) {
            expect(rateLimiter.isAvailable('test-provider', 'cron')).toBe(true);
            rateLimiter.consume('test-provider');
          }

          // After reaching cron threshold, cron should be unavailable
          expect(rateLimiter.isAvailable('test-provider', 'cron')).toBe(false);

          // But interactive should still be available (has R more requests)
          expect(rateLimiter.isAvailable('test-provider', 'interactive')).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('interactive context: isAvailable() returns false only when used >= limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (limit, reserved) => {
          const R = Math.min(reserved, limit - 1);

          const config = makeConfig('test-provider', limit, 'monthly', R);
          const registry = new ProviderRegistry([config]);
          const rateLimiter = new RateLimiter(registry);

          // Consume all requests up to the full limit
          for (let i = 0; i < limit; i++) {
            expect(rateLimiter.isAvailable('test-provider', 'interactive')).toBe(true);
            rateLimiter.consume('test-provider');
          }

          // After reaching full limit, interactive should be unavailable
          expect(rateLimiter.isAvailable('test-provider', 'interactive')).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('cron threshold is exactly limit - reservedForInteractive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (limit, reserved) => {
          const R = Math.min(reserved, limit - 1);
          const cronThreshold = limit - R;

          const config = makeConfig('test-provider', limit, 'monthly', R);
          const registry = new ProviderRegistry([config]);
          const rateLimiter = new RateLimiter(registry);

          // Consume exactly cronThreshold - 1 requests
          for (let i = 0; i < cronThreshold - 1; i++) {
            rateLimiter.consume('test-provider');
          }

          // Should still be available for cron (one more request allowed)
          expect(rateLimiter.isAvailable('test-provider', 'cron')).toBe(true);

          // Consume one more
          rateLimiter.consume('test-provider');

          // Now cron should be unavailable
          expect(rateLimiter.isAvailable('test-provider', 'cron')).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
