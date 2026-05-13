import { logger } from '@utils/logger';

import type { DateFallbackResult, DateFallbackService } from '@services/DateFallbackService';
import type { FlightAnalysisService } from '@services/FlightAnalysisService';
import type { ProviderRegistry } from '@services/ProviderRegistry';
import type { RateLimiter } from '@services/RateLimiter';
import type { FlightPromotion } from '@flight-types/FlightPromotion';
import type { PromotionSearchCriteria as ProviderSearchCriteria } from '@flight-types/FlightProvider';

export interface PromotionSearchCriteria {
  origin?: string;
  destination?: string;
  departureDate?: string | null;
  returnDate?: string | null;
  maxStops?: number;
  context: 'cron' | 'interactive';
}

export interface PromotionResult {
  promotions: FlightPromotion[];
  providerUsed: string;
  datesUsed: DateFallbackResult;
  allProvidersExhausted: boolean;
  aiAnalyses?: Map<string, string>;
}

export class PromotionService {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly rateLimiter: RateLimiter,
    private readonly dateFallback: DateFallbackService,
    private readonly analysisService?: FlightAnalysisService,
  ) {}

  /**
   * Busca promoções consultando TODOS os providers disponíveis e mesclando resultados.
   * Consulta cada provider que tem quota disponível, combina os resultados,
   * e só para quando todos foram consultados ou atingiram o limite.
   */
  public async findPromotions(criteria: PromotionSearchCriteria): Promise<PromotionResult> {
    const providers = this.registry.getProviders(criteria.context);

    if (providers.length === 0) {
      return {
        promotions: [],
        providerUsed: '',
        datesUsed: {
          departureDate: criteria.departureDate ?? '',
          returnDate: criteria.returnDate ?? null,
          departureFallback: false,
          returnFallback: false,
        },
        allProvidersExhausted: true,
      };
    }

    // Resolve dates once for all providers
    const datesUsed = this.dateFallback.resolve({
      departureDate: criteria.departureDate,
      returnDate: criteria.returnDate,
      providerRequiresDate: true,
      providerRequiresReturn: true,
    });

    // Build provider-specific search criteria
    const effectiveOrigin = criteria.origin || (criteria.context === 'interactive' ? 'GRU' : undefined);
    const providerCriteria: ProviderSearchCriteria = {
      origins: effectiveOrigin ? [effectiveOrigin] : undefined,
      destinations: criteria.destination ? [criteria.destination] : undefined,
      dateFrom: datesUsed.departureDate || undefined,
      dateTo: datesUsed.returnDate || undefined,
      maxStopovers: criteria.maxStops,
    };

    const allPromotions: FlightPromotion[] = [];
    const providersUsed: string[] = [];
    let allExhausted = true;

    // Consult ALL available providers and merge results
    for (const config of providers) {
      const available = this.rateLimiter.isAvailable(config.name, criteria.context);

      if (!available) {
        logger.info(
          { provider: config.name, context: criteria.context },
          '[PromotionService] Provider indisponível (rate limit), pulando',
        );
        continue;
      }

      allExhausted = false;

      try {
        logger.info(
          { provider: config.name, criteria: providerCriteria },
          '[PromotionService] Consultando provider',
        );

        const promotions = await config.provider.fetchPromotions(providerCriteria);
        this.rateLimiter.consume(config.name);

        // Filter by destination if specified (some providers return discovery results)
        const filtered = criteria.destination
          ? promotions.filter((p) =>
              p.destinationCode?.toUpperCase() === criteria.destination!.toUpperCase(),
            )
          : promotions;

        if (filtered.length > 0) {
          logger.info(
            { provider: config.name, count: filtered.length },
            '[PromotionService] Provider retornou resultados',
          );
          allPromotions.push(...filtered);
          providersUsed.push(config.name);
        } else {
          logger.info(
            { provider: config.name },
            '[PromotionService] Provider não retornou resultados',
          );
        }
      } catch (error) {
        this.rateLimiter.consume(config.name);
        logger.error(
          { error, provider: config.name },
          '[PromotionService] Provider falhou',
        );
      }
    }

    if (allPromotions.length === 0) {
      logger.warn('[PromotionService] Nenhum provider retornou resultados');
      return {
        promotions: [],
        providerUsed: '',
        datesUsed,
        allProvidersExhausted: allExhausted,
      };
    }

    // Deduplicate by route+date (keep best score)
    const deduped = this.deduplicatePromotions(allPromotions);

    // Sort by score descending
    deduped.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    // Call FlightAnalysisService
    let aiAnalyses: Map<string, string> | undefined;
    if (this.analysisService) {
      try {
        aiAnalyses = await this.analysisService.analyzePromotions(deduped);
      } catch (error) {
        logger.error({ error }, '[PromotionService] Erro ao analisar promoções com IA');
      }
    }

    return {
      promotions: deduped,
      providerUsed: providersUsed.join(', '),
      datesUsed,
      allProvidersExhausted: false,
      aiAnalyses,
    };
  }

  /**
   * Remove duplicatas por rota+data, mantendo a promoção com melhor score.
   */
  private deduplicatePromotions(promotions: FlightPromotion[]): FlightPromotion[] {
    const seen = new Map<string, FlightPromotion>();

    for (const promo of promotions) {
      const key = `${promo.origin}:${promo.destinationCode}:${promo.departureDate}`;
      const existing = seen.get(key);
      if (!existing || (promo.score ?? 0) > (existing.score ?? 0)) {
        seen.set(key, promo);
      }
    }

    return [...seen.values()];
  }
}
