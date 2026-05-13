import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DateFallbackService } from '@services/DateFallbackService';

function daysBetween(dateStrA: string, dateStrB: string): number {
  const [yA, mA, dA] = dateStrA.split('-').map(Number);
  const [yB, mB, dB] = dateStrB.split('-').map(Number);
  const a = new Date(yA, mA - 1, dA);
  const b = new Date(yB, mB - 1, dB);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Feature: bot-refactor-providers-channels, Property 12: Fallback de Data de Ida no Intervalo Correto
 *
 * Validates: Requirements 5.3, 6.2
 */
describe('Feature: bot-refactor-providers-channels, Property 12: Fallback de Data de Ida no Intervalo Correto', () => {
  it('generated departure date is between 30 and 90 days from current date', () => {
    const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0);
    const nowStr = formatDate(fixedNow);

    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.999999999, noNaN: true }),
        (randomValue) => {
          const service = new DateFallbackService(
            () => fixedNow,
            () => randomValue,
          );

          const result = service.resolve({
            departureDate: null,
            returnDate: null,
            providerRequiresDate: true,
            providerRequiresReturn: false,
          });

          expect(result.departureFallback).toBe(true);

          const days = daysBetween(nowStr, result.departureDate);
          expect(days).toBeGreaterThanOrEqual(30);
          expect(days).toBeLessThanOrEqual(90);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('departure date format is YYYY-MM-DD', () => {
    const fixedNow = new Date(2024, 0, 1, 0, 0, 0, 0);

    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.999999999, noNaN: true }),
        (randomValue) => {
          const service = new DateFallbackService(
            () => fixedNow,
            () => randomValue,
          );

          const result = service.resolve({
            departureDate: null,
            returnDate: null,
            providerRequiresDate: true,
            providerRequiresReturn: false,
          });

          expect(result.departureDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: bot-refactor-providers-channels, Property 13: Fallback de Data de Volta no Intervalo Correto
 *
 * Validates: Requirements 5.4, 6.4
 */
describe('Feature: bot-refactor-providers-channels, Property 13: Fallback de Data de Volta no Intervalo Correto', () => {
  it('generated return date is between D+7 and D+14 from departure date', () => {
    const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0);

    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.999999999, noNaN: true }),
        fc.double({ min: 0, max: 0.999999999, noNaN: true }),
        (randomForDeparture, randomForReturn) => {
          let callCount = 0;
          const service = new DateFallbackService(
            () => fixedNow,
            () => {
              callCount++;
              return callCount === 1 ? randomForDeparture : randomForReturn;
            },
          );

          const result = service.resolve({
            departureDate: null,
            returnDate: null,
            providerRequiresDate: true,
            providerRequiresReturn: true,
          });

          expect(result.returnFallback).toBe(true);
          expect(result.returnDate).not.toBeNull();

          const days = daysBetween(result.departureDate, result.returnDate!);
          expect(days).toBeGreaterThanOrEqual(7);
          expect(days).toBeLessThanOrEqual(14);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('return date is after departure date when departure is user-provided', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2024, max: 2026 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.double({ min: 0, max: 0.999999999, noNaN: true }),
        (year, month, day, randomValue) => {
          const departureDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const fixedNow = new Date(2024, 0, 1, 0, 0, 0, 0);

          const service = new DateFallbackService(
            () => fixedNow,
            () => randomValue,
          );

          const result = service.resolve({
            departureDate: departureDateStr,
            returnDate: null,
            providerRequiresDate: true,
            providerRequiresReturn: true,
          });

          expect(result.returnFallback).toBe(true);
          expect(result.returnDate).not.toBeNull();

          const days = daysBetween(departureDateStr, result.returnDate!);
          expect(days).toBeGreaterThanOrEqual(7);
          expect(days).toBeLessThanOrEqual(14);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: bot-refactor-providers-channels, Property 14: Datas Informadas São Preservadas
 *
 * Validates: Requirements 6.1, 6.3
 */
describe('Feature: bot-refactor-providers-channels, Property 14: Datas Informadas São Preservadas', () => {
  it('user-provided departureDate is preserved with departureFallback = false', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2024, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (year, month, day) => {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const fixedNow = new Date(2024, 0, 1, 0, 0, 0, 0);

          const service = new DateFallbackService(
            () => fixedNow,
            () => Math.random(),
          );

          const result = service.resolve({
            departureDate: dateStr,
            returnDate: null,
            providerRequiresDate: true,
            providerRequiresReturn: false,
          });

          expect(result.departureDate).toBe(dateStr);
          expect(result.departureFallback).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('user-provided returnDate is preserved with returnFallback = false', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2024, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 2024, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (depYear, depMonth, depDay, retYear, retMonth, retDay) => {
          const depDateStr = `${depYear}-${String(depMonth).padStart(2, '0')}-${String(depDay).padStart(2, '0')}`;
          const retDateStr = `${retYear}-${String(retMonth).padStart(2, '0')}-${String(retDay).padStart(2, '0')}`;
          const fixedNow = new Date(2024, 0, 1, 0, 0, 0, 0);

          const service = new DateFallbackService(
            () => fixedNow,
            () => Math.random(),
          );

          const result = service.resolve({
            departureDate: depDateStr,
            returnDate: retDateStr,
            providerRequiresDate: true,
            providerRequiresReturn: true,
          });

          expect(result.departureDate).toBe(depDateStr);
          expect(result.returnDate).toBe(retDateStr);
          expect(result.departureFallback).toBe(false);
          expect(result.returnFallback).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('user-provided dates are preserved regardless of providerRequires flags', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2024, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.boolean(),
        fc.boolean(),
        (year, month, day, requiresDate, requiresReturn) => {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const fixedNow = new Date(2024, 0, 1, 0, 0, 0, 0);

          const service = new DateFallbackService(
            () => fixedNow,
            () => Math.random(),
          );

          const result = service.resolve({
            departureDate: dateStr,
            returnDate: dateStr,
            providerRequiresDate: requiresDate,
            providerRequiresReturn: requiresReturn,
          });

          expect(result.departureDate).toBe(dateStr);
          expect(result.returnDate).toBe(dateStr);
          expect(result.departureFallback).toBe(false);
          expect(result.returnFallback).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
