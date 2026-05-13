import type { FlightPromotion } from '@flight-types/FlightPromotion';
import { MONITORED_AIRPORT_CODES } from '@config/flight';

export type RoutableChannel = 'geral' | 'international' | 'brazil' | 'crazy';

/**
 * Set of known Brazilian airport IATA codes used for origin classification.
 * All predefined origins in the bot are Brazilian airports.
 */
const BRAZILIAN_AIRPORT_CODES: ReadonlySet<string> = new Set(MONITORED_AIRPORT_CODES);

export class ChannelRouter {
  /**
   * Classifies a promotion and returns the destination channels.
   * Always includes 'geral'. Adds 'international', 'brazil', or 'crazy' based on routing rules.
   */
  route(promotion: FlightPromotion): RoutableChannel[] {
    const channels: RoutableChannel[] = ['geral'];

    if (promotion.isCrazyDeal) {
      channels.push('crazy');
    }

    if (this.isInternational(promotion)) {
      channels.push('international');
    }

    if (this.isDomestic(promotion)) {
      channels.push('brazil');
    }

    return channels;
  }

  /**
   * Filters promotions that belong to a specific channel.
   */
  filterForChannel(channel: RoutableChannel, promotions: FlightPromotion[]): FlightPromotion[] {
    return promotions.filter((promotion) => this.route(promotion).includes(channel));
  }

  /**
   * Determines if a flight is domestic (origin in Brazil AND destination in Brazil).
   */
  private isDomestic(promotion: FlightPromotion): boolean {
    return this.isOriginBrazilian(promotion.origin) && (
      promotion.destinationCountryCode === 'BR' ||
      BRAZILIAN_AIRPORT_CODES.has(promotion.destinationCode?.toUpperCase() ?? '')
    );
  }

  /**
   * Determines if a flight is international (origin in Brazil AND destination outside Brazil).
   * Only classifies as international if we know for sure the destination is not Brazil.
   */
  private isInternational(promotion: FlightPromotion): boolean {
    if (!this.isOriginBrazilian(promotion.origin)) return false;
    // If destinationCountryCode is empty/unknown, check if destination code is a known BR airport
    if (!promotion.destinationCountryCode) {
      return !BRAZILIAN_AIRPORT_CODES.has(promotion.destinationCode?.toUpperCase() ?? '');
    }
    return promotion.destinationCountryCode !== 'BR';
  }

  /**
   * Checks if an airport code belongs to a known Brazilian airport.
   * Since all predefined origins in the bot are Brazilian, this is a safety check.
   */
  private isOriginBrazilian(originCode: string): boolean {
    return BRAZILIAN_AIRPORT_CODES.has(originCode.toUpperCase());
  }
}
