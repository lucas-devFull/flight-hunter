import { describe, it, expect } from 'vitest';
import { ProviderRegistry, type ProviderConfig } from '@services/ProviderRegistry';
import { RateLimiter } from '@services/RateLimiter';
import type { FlightProvider } from '@flight-types/FlightProvider';

/**
 * Unit tests for RateLimiter
 * Validates: Requirements 1.2, 1.3, 1.5, 1.7, 8.5
 */

const mockFlightProvider: FlightProvider = {
  name: 'mock',
  fetchPromotions: async () => [],
};

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
    limits: { maxRequests, cycle, reservedForInteractive },
  };
}

describe('RateLimiter — Unit Tests', () => {
  describe('Edge case: reset at the exact cycle boundary', () => {
    it('daily cycle: resets when time is exactly at midnight of the next day', () => {
      const baseTime = new Date(2024, 5, 15, 10, 30, 0, 0); // June 15, 2024 10:30 local
      let currentTime = baseTime;

      const config = makeConfig('provider-a', 10, 'daily');
      const registry = new ProviderRegistry([config]);
      const rateLimiter = new RateLimiter(registry, () => currentTime);

      // Consume some requests
      rateLimiter.consume('provider-a');
      rateLimiter.consume('provider-a');
      rateLimiter.consume('provider-a');

      expect(rateLimiter.getProviderUsage('provider-a')!.used).toBe(3);

      // Advance to exactly midnight of the next day (the boundary)
      currentTime = new Date(2024, 5, 16, 0, 0, 0, 0); // June 16, 2024 00:00:00.000

      const usage = rateLimiter.getProviderUsage('provider-a')!;
      expect(usage.used).toBe(0);
      expect(usage.remaining).toBe(10);
    });

    it('monthly cycle: resets when time is exactly at midnight of the 1st of next month', () => {
      const baseTime = new Date(2024, 5, 20, 14, 0, 0, 0); // June 20, 2024
      let currentTime = baseTime;

      const config = makeConfig('provider-b', 50, 'monthly');
      const registry = new ProviderRegistry([config]);
      const rateLimiter = new RateLimiter(registry, () => currentTime);

      // Consume some requests
      for (let i = 0; i < 25; i++) {
        rateLimiter.consume('provider-b');
      }

      expect(rateLimiter.getProviderUsage('provider-b')!.used).toBe(25);

      // Advance to exactly midnight of July 1st (the boundary)
      currentTime = new Date(2024, 6, 1, 0, 0, 0, 0); // July 1, 2024 00:00:00.000

      const usage = rateLimiter.getProviderUsage('provider-b')!;
      expect(usage.used).toBe(0);
      expect(usage.remaining).toBe(50);
    });

    it('daily cycle: does NOT reset one millisecond before midnight', () => {
      const baseTime = new Date(2024, 5, 15, 10, 0, 0, 0); // June 15, 2024
      let currentTime = baseTime;

      const config = makeConfig('provider-c', 10, 'daily');
      const registry = new ProviderRegistry([config]);
      const rateLimiter = new RateLimiter(registry, () => currentTime);

      rateLimiter.consume('provider-c');
      rateLimiter.consume('provider-c');

      // Advance to 23:59:59.999 of the same day — should NOT reset
      currentTime = new Date(2024, 5, 15, 23, 59, 59, 999);

      const usage = rateLimiter.getProviderUsage('provider-c')!;
      expect(usage.used).toBe(2);
      expect(usage.remaining).toBe(8);
    });

    it('monthly cycle: does NOT reset on the last day of the month', () => {
      const baseTime = new Date(2024, 5, 10, 8, 0, 0, 0); // June 10, 2024
      let currentTime = baseTime;

      const config = makeConfig('provider-d', 30, 'monthly');
      const registry = new ProviderRegistry([config]);
      const rateLimiter = new RateLimiter(registry, () => currentTime);

      for (let i = 0; i < 15; i++) {
        rateLimiter.consume('provider-d');
      }

      // Advance to June 30 23:59:59.999 — should NOT reset (next month starts July 1)
      currentTime = new Date(2024, 5, 30, 23, 59, 59, 999);

      const usage = rateLimiter.getProviderUsage('provider-d')!;
      expect(usage.used).toBe(15);
      expect(usage.remaining).toBe(15);
    });
  });

  describe('Behavior with 0 requests remaining', () => {
    it('isAvailable returns false when all requests are consumed (interactive)', () => {
      const config = makeConfig('provider-e', 5, 'monthly', 0);
      const registry = new ProviderRegistry([config]);
      const rateLimiter = new RateLimiter(registry);

      for (let i = 0; i < 5; i++) {
        rateLimiter.consume('provider-e');
      }

      expect(rateLimiter.isAvailable('provider-e', 'interactive')).toBe(false);
    });

    it('remaining is 0 and available is false in usage report', () => {
      const config = makeConfig('provider-f', 3, 'daily', 0);
      const registry = new ProviderRegistry([config]);
      const rateLimiter = new RateLimiter(registry);

      for (let i = 0; i < 3; i++) {
        rateLimiter.consume('provider-f');
      }

      const usage = rateLimiter.getProviderUsage('provider-f')!;
      expect(usage.remaining).toBe(0);
      expect(usage.available).toBe(false);
      expect(usage.used).toBe(3);
      expect(usage.limit).toBe(3);
    });

    it('consuming beyond the limit still tracks used count but remaining stays at 0', () => {
      const config = makeConfig('provider-g', 2, 'monthly', 0);
      const registry = new ProviderRegistry([config]);
      const rateLimiter = new RateLimiter(registry);

      // Consume beyond limit
      rateLimiter.consume('provider-g');
      rateLimiter.consume('provider-g');
      rateLimiter.consume('provider-g'); // over limit

      const usage = rateLimiter.getProviderUsage('provider-g')!;
      expect(usage.used).toBe(3);
      expect(usage.remaining).toBe(0);
      expect(usage.available).toBe(false);
    });

    it('getUsage() reports all providers including exhausted ones', () => {
      const configs: ProviderConfig[] = [
        makeConfig('active', 10, 'monthly', 0),
        makeConfig('exhausted', 2, 'monthly', 0),
      ];
      // Assign different priorities so both are registered
      configs[0].priority = 1;
      configs[1].priority = 2;

      const registry = new ProviderRegistry(configs);
      const rateLimiter = new RateLimiter(registry);

      rateLimiter.consume('exhausted');
      rateLimiter.consume('exhausted');

      const allUsage = rateLimiter.getUsage();
      expect(allUsage).toHaveLength(2);

      const exhaustedUsage = allUsage.find((u) => u.name === 'exhausted')!;
      expect(exhaustedUsage.remaining).toBe(0);
      expect(exhaustedUsage.available).toBe(false);

      const activeUsage = allUsage.find((u) => u.name === 'active')!;
      expect(activeUsage.remaining).toBe(10);
      expect(activeUsage.available).toBe(true);
    });
  });

  describe('Cron does not consume quota reserved for interactive', () => {
    it('cron becomes unavailable before interactive when reservation exists', () => {
      // limit=10, reservedForInteractive=3 → cron threshold = 7
      const config = makeConfig('provider-h', 10, 'monthly', 3);
      const registry = new ProviderRegistry([config]);
      const rateLimiter = new RateLimiter(registry);

      // Consume 7 requests (the cron threshold)
      for (let i = 0; i < 7; i++) {
        expect(rateLimiter.isAvailable('provider-h', 'cron')).toBe(true);
        rateLimiter.consume('provider-h');
      }

      // Cron should now be unavailable
      expect(rateLimiter.isAvailable('provider-h', 'cron')).toBe(false);

      // Interactive should still be available (3 reserved requests remain)
      expect(rateLimiter.isAvailable('provider-h', 'interactive')).toBe(true);
    });

    it('interactive can use the full quota including reserved portion', () => {
      // limit=10, reservedForInteractive=3
      const config = makeConfig('provider-i', 10, 'monthly', 3);
      const registry = new ProviderRegistry([config]);
      const rateLimiter = new RateLimiter(registry);

      // Consume all 10 requests
      for (let i = 0; i < 10; i++) {
        expect(rateLimiter.isAvailable('provider-i', 'interactive')).toBe(true);
        rateLimiter.consume('provider-i');
      }

      // Now interactive should also be unavailable
      expect(rateLimiter.isAvailable('provider-i', 'interactive')).toBe(false);
    });

    it('cron threshold is exactly limit - reservedForInteractive', () => {
      // limit=20, reservedForInteractive=8 → cron threshold = 12
      const config = makeConfig('provider-j', 20, 'monthly', 8);
      const registry = new ProviderRegistry([config]);
      const rateLimiter = new RateLimiter(registry);

      // Consume 11 requests — cron should still be available
      for (let i = 0; i < 11; i++) {
        rateLimiter.consume('provider-j');
      }
      expect(rateLimiter.isAvailable('provider-j', 'cron')).toBe(true);

      // Consume 1 more (total 12) — cron should now be unavailable
      rateLimiter.consume('provider-j');
      expect(rateLimiter.isAvailable('provider-j', 'cron')).toBe(false);

      // Interactive still has 8 remaining
      expect(rateLimiter.isAvailable('provider-j', 'interactive')).toBe(true);
      expect(rateLimiter.getProviderUsage('provider-j')!.remaining).toBe(8);
    });

    it('with reservedForInteractive=0, cron and interactive have the same threshold', () => {
      const config = makeConfig('provider-k', 5, 'monthly', 0);
      const registry = new ProviderRegistry([config]);
      const rateLimiter = new RateLimiter(registry);

      for (let i = 0; i < 5; i++) {
        expect(rateLimiter.isAvailable('provider-k', 'cron')).toBe(true);
        expect(rateLimiter.isAvailable('provider-k', 'interactive')).toBe(true);
        rateLimiter.consume('provider-k');
      }

      // Both should be unavailable at the same time
      expect(rateLimiter.isAvailable('provider-k', 'cron')).toBe(false);
      expect(rateLimiter.isAvailable('provider-k', 'interactive')).toBe(false);
    });

    it('after cycle reset, cron quota reservation is restored', () => {
      const baseTime = new Date(2024, 5, 15, 10, 0, 0, 0);
      let currentTime = baseTime;

      // limit=10, reservedForInteractive=4 → cron threshold = 6
      const config = makeConfig('provider-l', 10, 'daily', 4);
      const registry = new ProviderRegistry([config]);
      const rateLimiter = new RateLimiter(registry, () => currentTime);

      // Exhaust cron quota
      for (let i = 0; i < 6; i++) {
        rateLimiter.consume('provider-l');
      }
      expect(rateLimiter.isAvailable('provider-l', 'cron')).toBe(false);

      // Advance past daily reset
      currentTime = new Date(2024, 5, 16, 0, 0, 0, 0);

      // Cron should be available again with full quota
      expect(rateLimiter.isAvailable('provider-l', 'cron')).toBe(true);
      expect(rateLimiter.getProviderUsage('provider-l')!.used).toBe(0);
      expect(rateLimiter.getProviderUsage('provider-l')!.remaining).toBe(10);
    });
  });
});
