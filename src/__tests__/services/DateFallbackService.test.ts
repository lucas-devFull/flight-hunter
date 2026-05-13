import { describe, it, expect } from 'vitest';
import { DateFallbackService } from '@services/DateFallbackService';

/**
 * Unit tests for DateFallbackService
 * Validates: Requirements 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5
 */

/**
 * Helper: formats a Date as YYYY-MM-DD.
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper: calculates the difference in days between two YYYY-MM-DD date strings.
 */
function daysBetween(dateStrA: string, dateStrB: string): number {
  const [yA, mA, dA] = dateStrA.split('-').map(Number);
  const [yB, mB, dB] = dateStrB.split('-').map(Number);
  const a = new Date(yA, mA - 1, dA);
  const b = new Date(yB, mB - 1, dB);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

describe('DateFallbackService — Unit Tests', () => {
  describe('Dates at the boundary (today + 30, today + 90)', () => {
    it('generates exactly today + 30 when random returns 0', () => {
      const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0); // June 15, 2024
      const service = new DateFallbackService(
        () => fixedNow,
        () => 0, // Math.floor(0 * 61) = 0, so minDays + 0 = 30
      );

      const result = service.resolve({
        departureDate: null,
        returnDate: null,
        providerRequiresDate: true,
        providerRequiresReturn: false,
      });

      const nowStr = formatDate(fixedNow);
      const days = daysBetween(nowStr, result.departureDate);
      expect(days).toBe(30);
      expect(result.departureFallback).toBe(true);
    });

    it('generates exactly today + 90 when random returns value just below 1', () => {
      const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0); // June 15, 2024
      // maxDays - minDays + 1 = 90 - 30 + 1 = 61
      // To get 90 days: minDays + Math.floor(random * 61) = 30 + 60 = 90
      // Math.floor(random * 61) = 60 → random = 60/61 ≈ 0.9836...
      const service = new DateFallbackService(
        () => fixedNow,
        () => 60 / 61, // This gives Math.floor(60/61 * 61) = Math.floor(60) = 60
      );

      const result = service.resolve({
        departureDate: null,
        returnDate: null,
        providerRequiresDate: true,
        providerRequiresReturn: false,
      });

      const nowStr = formatDate(fixedNow);
      const days = daysBetween(nowStr, result.departureDate);
      expect(days).toBe(90);
      expect(result.departureFallback).toBe(true);
    });

    it('generates return date exactly D+7 when random returns 0', () => {
      const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0); // June 15, 2024
      const service = new DateFallbackService(
        () => fixedNow,
        () => 0, // Both departure and return will use 0
      );

      const result = service.resolve({
        departureDate: '2024-07-15',
        returnDate: null,
        providerRequiresDate: true,
        providerRequiresReturn: true,
      });

      const days = daysBetween('2024-07-15', result.returnDate!);
      expect(days).toBe(7);
      expect(result.returnFallback).toBe(true);
    });

    it('generates return date exactly D+14 when random returns value just below 1', () => {
      const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0); // June 15, 2024
      // maxDays - minDays + 1 = 14 - 7 + 1 = 8
      // To get 14 days: minDays + Math.floor(random * 8) = 7 + 7 = 14
      // Math.floor(random * 8) = 7 → random = 7/8 = 0.875
      const service = new DateFallbackService(
        () => fixedNow,
        () => 7 / 8,
      );

      const result = service.resolve({
        departureDate: '2024-07-15',
        returnDate: null,
        providerRequiresDate: true,
        providerRequiresReturn: true,
      });

      const days = daysBetween('2024-07-15', result.returnDate!);
      expect(days).toBe(14);
      expect(result.returnFallback).toBe(true);
    });
  });

  describe('Invalid date format handling', () => {
    it('preserves user-provided date string even if format is unusual', () => {
      const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0);
      const service = new DateFallbackService(
        () => fixedNow,
        () => 0.5,
      );

      // The service preserves whatever string the user provides
      const result = service.resolve({
        departureDate: '15/06/2024', // non-standard format
        returnDate: null,
        providerRequiresDate: true,
        providerRequiresReturn: false,
      });

      expect(result.departureDate).toBe('15/06/2024');
      expect(result.departureFallback).toBe(false);
    });

    it('handles empty string departureDate as falsy (triggers fallback)', () => {
      const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0);
      const service = new DateFallbackService(
        () => fixedNow,
        () => 0.5,
      );

      const result = service.resolve({
        departureDate: '',
        returnDate: null,
        providerRequiresDate: true,
        providerRequiresReturn: false,
      });

      // Empty string is falsy, so fallback should be generated
      expect(result.departureFallback).toBe(true);
      expect(result.departureDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('handles undefined departureDate (triggers fallback when required)', () => {
      const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0);
      const service = new DateFallbackService(
        () => fixedNow,
        () => 0.5,
      );

      const result = service.resolve({
        departureDate: undefined,
        returnDate: null,
        providerRequiresDate: true,
        providerRequiresReturn: false,
      });

      expect(result.departureFallback).toBe(true);
      expect(result.departureDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('departureFallback and returnFallback correctness', () => {
    it('departureFallback is false when user provides departureDate', () => {
      const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0);
      const service = new DateFallbackService(
        () => fixedNow,
        () => 0.5,
      );

      const result = service.resolve({
        departureDate: '2024-08-01',
        returnDate: null,
        providerRequiresDate: true,
        providerRequiresReturn: false,
      });

      expect(result.departureFallback).toBe(false);
      expect(result.departureDate).toBe('2024-08-01');
    });

    it('departureFallback is true when no departureDate and provider requires it', () => {
      const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0);
      const service = new DateFallbackService(
        () => fixedNow,
        () => 0.5,
      );

      const result = service.resolve({
        departureDate: null,
        returnDate: null,
        providerRequiresDate: true,
        providerRequiresReturn: false,
      });

      expect(result.departureFallback).toBe(true);
    });

    it('departureFallback is false when no departureDate and provider does NOT require it', () => {
      const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0);
      const service = new DateFallbackService(
        () => fixedNow,
        () => 0.5,
      );

      const result = service.resolve({
        departureDate: null,
        returnDate: null,
        providerRequiresDate: false,
        providerRequiresReturn: false,
      });

      expect(result.departureFallback).toBe(false);
      expect(result.departureDate).toBe('');
    });

    it('returnFallback is false when user provides returnDate', () => {
      const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0);
      const service = new DateFallbackService(
        () => fixedNow,
        () => 0.5,
      );

      const result = service.resolve({
        departureDate: '2024-08-01',
        returnDate: '2024-08-10',
        providerRequiresDate: true,
        providerRequiresReturn: true,
      });

      expect(result.returnFallback).toBe(false);
      expect(result.returnDate).toBe('2024-08-10');
    });

    it('returnFallback is true when no returnDate and provider requires it', () => {
      const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0);
      const service = new DateFallbackService(
        () => fixedNow,
        () => 0.5,
      );

      const result = service.resolve({
        departureDate: '2024-08-01',
        returnDate: null,
        providerRequiresDate: true,
        providerRequiresReturn: true,
      });

      expect(result.returnFallback).toBe(true);
      expect(result.returnDate).not.toBeNull();
    });

    it('returnFallback is false and returnDate is null when provider does NOT require return', () => {
      const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0);
      const service = new DateFallbackService(
        () => fixedNow,
        () => 0.5,
      );

      const result = service.resolve({
        departureDate: '2024-08-01',
        returnDate: null,
        providerRequiresDate: true,
        providerRequiresReturn: false,
      });

      expect(result.returnFallback).toBe(false);
      expect(result.returnDate).toBeNull();
    });

    it('both fallbacks are true when no dates provided and provider requires both', () => {
      const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0);
      const service = new DateFallbackService(
        () => fixedNow,
        () => 0.5,
      );

      const result = service.resolve({
        departureDate: null,
        returnDate: null,
        providerRequiresDate: true,
        providerRequiresReturn: true,
      });

      expect(result.departureFallback).toBe(true);
      expect(result.returnFallback).toBe(true);
      expect(result.departureDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.returnDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('both fallbacks are false when both dates are provided', () => {
      const fixedNow = new Date(2024, 5, 15, 0, 0, 0, 0);
      const service = new DateFallbackService(
        () => fixedNow,
        () => 0.5,
      );

      const result = service.resolve({
        departureDate: '2024-09-01',
        returnDate: '2024-09-10',
        providerRequiresDate: true,
        providerRequiresReturn: true,
      });

      expect(result.departureFallback).toBe(false);
      expect(result.returnFallback).toBe(false);
      expect(result.departureDate).toBe('2024-09-01');
      expect(result.returnDate).toBe('2024-09-10');
    });
  });
});
