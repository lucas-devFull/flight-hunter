/**
 * Gera links diretos para o Google Flights com origem, destino e datas
 * pré-preenchidos usando o parâmetro `tfs` (protobuf codificado em Base64).
 *
 * Estrutura do protobuf:
 *   field 3 (repeated FlightLeg):
 *     field 2: date (string YYYY-MM-DD)
 *     field 13: departure airport { field 2: IATA code }
 *     field 14: arrival airport { field 2: IATA code }
 */

interface GoogleFlightsLinkInput {
  origin: string;
  destinationCode: string;
  destinationName: string;
  departureDate: string;
  returnDate: string | null;
}

export function buildGoogleFlightsUrl(input: GoogleFlightsLinkInput): string {
  const legs: Array<{ date: string; from: string; to: string }> = [
    { date: input.departureDate, from: input.origin, to: input.destinationCode },
  ];

  if (input.returnDate) {
    legs.push({ date: input.returnDate, from: input.destinationCode, to: input.origin });
  }

  const tfs = encodeTfs(legs);

  return `https://www.google.com/travel/flights/search?tfs=${tfs}&hl=pt-BR&curr=BRL`;
}

// --- Protobuf manual encoding ---

function encodeTfs(legs: Array<{ date: string; from: string; to: string }>): string {
  const bytes: number[] = [];

  // field 1: varint 28 (trip type config)
  writeVarintField(bytes, 1, 28);
  // field 2: varint 2 (round trip = 2 legs, one-way = 1)
  writeVarintField(bytes, 2, legs.length > 1 ? 2 : 1);

  for (const leg of legs) {
    const legBytes = encodeLeg(leg.date, leg.from, leg.to);
    writeLengthDelimited(bytes, 3, legBytes);
  }

  // field 8: varint 1 (adults)
  writeVarintField(bytes, 8, 1);

  const uint8 = new Uint8Array(bytes);
  return base64UrlEncode(uint8);
}

function encodeLeg(date: string, from: string, to: string): number[] {
  const bytes: number[] = [];

  // field 2: date string
  writeStringField(bytes, 2, date);

  // field 13: departure airport message { field 2: IATA }
  const depAirport: number[] = [];
  writeStringField(depAirport, 2, from);
  writeLengthDelimited(bytes, 13, depAirport);

  // field 14: arrival airport message { field 2: IATA }
  const arrAirport: number[] = [];
  writeStringField(arrAirport, 2, to);
  writeLengthDelimited(bytes, 14, arrAirport);

  return bytes;
}

function writeVarintField(bytes: number[], fieldNumber: number, value: number): void {
  // tag = (fieldNumber << 3) | wireType(0 = varint)
  const tag = (fieldNumber << 3) | 0;
  writeVarint(bytes, tag);
  writeVarint(bytes, value);
}

function writeStringField(bytes: number[], fieldNumber: number, value: string): void {
  const encoded = new TextEncoder().encode(value);
  writeLengthDelimited(bytes, fieldNumber, Array.from(encoded));
}

function writeLengthDelimited(bytes: number[], fieldNumber: number, data: number[]): void {
  // tag = (fieldNumber << 3) | wireType(2 = length-delimited)
  const tag = (fieldNumber << 3) | 2;
  writeVarint(bytes, tag);
  writeVarint(bytes, data.length);
  bytes.push(...data);
}

function writeVarint(bytes: number[], value: number): void {
  let v = value >>> 0; // ensure unsigned
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v & 0x7f);
}

function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
