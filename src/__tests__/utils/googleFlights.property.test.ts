import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildGoogleFlightsUrl } from '@utils/googleFlights';

/**
 * Property-based tests for buildGoogleFlightsUrl
 *
 * Feature: bot-refactor-providers-channels, Property 18: Parâmetros Corretos na URL do Google Flights
 * Validates: Requirements 10.2, 10.4
 */

/**
 * Arbitrary that generates a 3-letter uppercase IATA-like code.
 */
function iataCodeArb(): fc.Arbitrary<string> {
  const upperChar = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
  return fc.tuple(upperChar, upperChar, upperChar).map(([a, b, c]) => a + b + c);
}

/**
 * Arbitrary that generates a valid future date string in YYYY-MM-DD format.
 */
function futureDateArb(): fc.Arbitrary<string> {
  return fc.integer({ min: 1, max: 730 }).map((days) => {
    const d = new Date('2025-01-01');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  });
}

/**
 * Arbitrary that generates a GoogleFlightsLinkInput with random origin, destination, and dates.
 */
function googleFlightsInputArb() {
  return fc.record({
    origin: iataCodeArb(),
    destinationCode: iataCodeArb(),
    destinationName: fc.string({ minLength: 3, maxLength: 30 }),
    departureDate: futureDateArb(),
    returnDate: fc.option(futureDateArb(), { nil: null }),
  });
}

describe('Feature: bot-refactor-providers-channels, Property 18: Parâmetros Corretos na URL do Google Flights', () => {
  /**
   * **Validates: Requirements 10.2, 10.4**
   *
   * For any valid origin, destination, and dates, the generated URL must start
   * with the Google Flights base URL.
   */
  it('generated URL starts with https://www.google.com/travel/flights', () => {
    fc.assert(
      fc.property(googleFlightsInputArb(), (input) => {
        const url = buildGoogleFlightsUrl(input);
        expect(url).toMatch(/^https:\/\/www\.google\.com\/travel\/flights/);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.2, 10.4**
   *
   * For any valid input, the generated URL must be a valid URL (parseable by URL constructor).
   */
  it('generated URL is a valid URL', () => {
    fc.assert(
      fc.property(googleFlightsInputArb(), (input) => {
        const url = buildGoogleFlightsUrl(input);
        expect(() => new URL(url)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.2, 10.4**
   *
   * For any valid input, the origin code must be present in the decoded tfs parameter,
   * since it is encoded in the protobuf payload as a string field.
   */
  it('origin code is present in the decoded tfs parameter', () => {
    fc.assert(
      fc.property(googleFlightsInputArb(), (input) => {
        const url = buildGoogleFlightsUrl(input);
        const parsedUrl = new URL(url);
        const tfs = parsedUrl.searchParams.get('tfs');
        expect(tfs).not.toBeNull();

        // Decode base64url to binary, then check that origin IATA code bytes are present
        const decoded = base64UrlDecode(tfs!);
        const originBytes = new TextEncoder().encode(input.origin);
        expect(containsBytes(decoded, originBytes)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.2, 10.4**
   *
   * For any valid input, the destination code must be present in the decoded tfs parameter.
   */
  it('destination code is present in the decoded tfs parameter', () => {
    fc.assert(
      fc.property(googleFlightsInputArb(), (input) => {
        const url = buildGoogleFlightsUrl(input);
        const parsedUrl = new URL(url);
        const tfs = parsedUrl.searchParams.get('tfs');
        expect(tfs).not.toBeNull();

        const decoded = base64UrlDecode(tfs!);
        const destBytes = new TextEncoder().encode(input.destinationCode);
        expect(containsBytes(decoded, destBytes)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.2, 10.4**
   *
   * For any valid input, the departure date (YYYY-MM-DD) must be present in the decoded tfs parameter.
   */
  it('departure date is present in the decoded tfs parameter', () => {
    fc.assert(
      fc.property(googleFlightsInputArb(), (input) => {
        const url = buildGoogleFlightsUrl(input);
        const parsedUrl = new URL(url);
        const tfs = parsedUrl.searchParams.get('tfs');
        expect(tfs).not.toBeNull();

        const decoded = base64UrlDecode(tfs!);
        const dateBytes = new TextEncoder().encode(input.departureDate);
        expect(containsBytes(decoded, dateBytes)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.4**
   *
   * When a return date is provided, it must be present in the decoded tfs parameter.
   */
  it('return date is present in the decoded tfs parameter when provided', () => {
    const inputWithReturn = fc.record({
      origin: iataCodeArb(),
      destinationCode: iataCodeArb(),
      destinationName: fc.string({ minLength: 3, maxLength: 30 }),
      departureDate: futureDateArb(),
      returnDate: futureDateArb(),
    });

    fc.assert(
      fc.property(inputWithReturn, (input) => {
        const url = buildGoogleFlightsUrl(input);
        const parsedUrl = new URL(url);
        const tfs = parsedUrl.searchParams.get('tfs');
        expect(tfs).not.toBeNull();

        const decoded = base64UrlDecode(tfs!);
        const returnDateBytes = new TextEncoder().encode(input.returnDate);
        expect(containsBytes(decoded, returnDateBytes)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.2, 10.4**
   *
   * The URL must contain the hl=pt-BR and curr=BRL query parameters.
   */
  it('URL contains hl=pt-BR and curr=BRL parameters', () => {
    fc.assert(
      fc.property(googleFlightsInputArb(), (input) => {
        const url = buildGoogleFlightsUrl(input);
        const parsedUrl = new URL(url);
        expect(parsedUrl.searchParams.get('hl')).toBe('pt-BR');
        expect(parsedUrl.searchParams.get('curr')).toBe('BRL');
      }),
      { numRuns: 100 },
    );
  });
});

// --- Helper functions ---

/**
 * Decodes a base64url-encoded string to a Uint8Array.
 */
function base64UrlDecode(str: string): Uint8Array {
  // Restore standard base64 characters
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Checks if a byte sequence (needle) is contained within another byte sequence (haystack).
 */
function containsBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length === 0) return true;
  if (needle.length > haystack.length) return false;

  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let found = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        found = false;
        break;
      }
    }
    if (found) return true;
  }
  return false;
}
