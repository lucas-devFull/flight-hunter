import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PREDEFINED_ORIGINS, isPredefinedOrigin } from '@config/flight';

/**
 * Property-based tests for origin validation
 *
 * Validates: Requirements 3.1, 3.2
 */

describe('Feature: bot-refactor-providers-channels, Property 10: Validação de Origem', () => {
  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * For any string that belongs to PREDEFINED_ORIGINS (with any casing),
   * isPredefinedOrigin must return true.
   * For any string NOT in PREDEFINED_ORIGINS, isPredefinedOrigin must return false.
   * Validation must be case-insensitive.
   */

  it('isPredefinedOrigin accepts any predefined origin with random casing', () => {
    const predefinedOriginArb = fc
      .constantFrom(...PREDEFINED_ORIGINS)
      .chain((origin) =>
        fc.array(fc.boolean(), { minLength: origin.length, maxLength: origin.length }).map(
          (upperFlags) =>
            origin
              .split('')
              .map((char, i) => (upperFlags[i] ? char.toUpperCase() : char.toLowerCase()))
              .join(''),
        ),
      );

    fc.assert(
      fc.property(predefinedOriginArb, (code) => {
        expect(isPredefinedOrigin(code)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('isPredefinedOrigin rejects any string NOT in PREDEFINED_ORIGINS', () => {
    const predefinedSet = new Set(PREDEFINED_ORIGINS.map((o) => o.toUpperCase()));

    const nonOriginArb = fc
      .string({ minLength: 1, maxLength: 10 })
      .filter((s) => !predefinedSet.has(s.toUpperCase()));

    fc.assert(
      fc.property(nonOriginArb, (code) => {
        expect(isPredefinedOrigin(code)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('isPredefinedOrigin is case-insensitive: lowercase, uppercase, and mixed case all return true', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PREDEFINED_ORIGINS), (origin) => {
        expect(isPredefinedOrigin(origin.toLowerCase())).toBe(true);
        expect(isPredefinedOrigin(origin.toUpperCase())).toBe(true);
        // Mixed case: first char lower, rest upper
        const mixed = origin.charAt(0).toLowerCase() + origin.slice(1).toUpperCase();
        expect(isPredefinedOrigin(mixed)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('specific case-insensitivity examples: gru, GRU, Gru all return true', () => {
    expect(isPredefinedOrigin('gru')).toBe(true);
    expect(isPredefinedOrigin('GRU')).toBe(true);
    expect(isPredefinedOrigin('Gru')).toBe(true);
  });
});
