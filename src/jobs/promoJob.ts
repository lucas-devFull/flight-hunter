import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';

import { PRIMARY_AIRPORT_CODES } from '@config/flight';
import { env } from '@config/env';
import { ChannelRouter } from '@services/ChannelRouter';
import { DateMonitorService } from '@services/DateMonitorService';
import { FlightAnalysisService } from '@services/FlightAnalysisService';
import { NotificationService } from '@services/NotificationService';
import { PromotionService } from '@services/PromotionService';
import { ProviderRegistry } from '@services/ProviderRegistry';
import { RateLimiter } from '@services/RateLimiter';
import { DateFallbackService } from '@services/DateFallbackService';
import { createProviderConfigs } from '@providers/providerFactory';
import { dateIsInsideFlexibleRange } from '@utils/dateRange';
import { logger } from '@utils/logger';

import type { FlightHunterClient } from '@bot/Client';
import type { DateMonitorChannelKey } from '@config/flight';
import type { RoutableChannel } from '@services/ChannelRouter';
import type { FlightPromotion } from '@flight-types/FlightPromotion';

const sentPromotionIds = new Set<string>();
const MAX_SENT_CACHE_SIZE = 1000;

export function startPromotionJob(client: FlightHunterClient): ScheduledTask {
  if (!cron.validate(env.PROMOTION_JOB_CRON)) {
    throw new Error(`Cron invalido em PROMOTION_JOB_CRON: ${env.PROMOTION_JOB_CRON}`);
  }

  // Initialize services
  const providerConfigs = createProviderConfigs();
  const registry = new ProviderRegistry(providerConfigs);
  const rateLimiter = new RateLimiter(registry);
  const dateFallback = new DateFallbackService();
  const analysisService = new FlightAnalysisService();
  const promotionService = new PromotionService(registry, rateLimiter, dateFallback, analysisService);
  const channelRouter = new ChannelRouter();
  const notificationService = new NotificationService(client);
  const dateMonitorService = new DateMonitorService();

  return cron.schedule(
    env.PROMOTION_JOB_CRON,
    async () => {
      logger.info('Iniciando job de promoções');

      try {
        const deliveredIds = new Set<string>();

        // Search promotions using PromotionService with cron context
        // Use primary airports as origins for the cron job
        for (const origin of PRIMARY_AIRPORT_CODES) {
          const result = await promotionService.findPromotions({
            origin,
            destination: '',
            context: 'cron',
          });

          if (result.allProvidersExhausted) {
            logger.warn(
              { origin },
              '[PromoJob] Todos os providers esgotados para esta origem',
            );
            break; // No point trying other origins if all providers are exhausted
          }

          if (result.promotions.length === 0) {
            continue;
          }

          // Filter out already-sent promotions
          const freshPromotions = result.promotions.filter(
            (promotion) => !sentPromotionIds.has(promotion.id),
          );

          if (freshPromotions.length === 0) {
            continue;
          }

          // AI analysis is already included in result.aiAnalyses from PromotionService
          const aiAnalyses = result.aiAnalyses;

          // Use ChannelRouter to classify promotions and determine channels
          const channelPromotionsMap = new Map<RoutableChannel, FlightPromotion[]>();

          for (const promotion of freshPromotions) {
            const channels = channelRouter.route(promotion);
            for (const channel of channels) {
              const existing = channelPromotionsMap.get(channel) ?? [];
              existing.push(promotion);
              channelPromotionsMap.set(channel, existing);
            }
          }

          // Send to each channel (geral is always included by ChannelRouter)
          for (const [channelKey, channelPromotions] of channelPromotionsMap.entries()) {
            const toSend = channelPromotions.slice(0, 3);

            const delivered = await notificationService.sendPromotions(
              channelKey,
              toSend,
              aiAnalyses,
            );

            if (delivered > 0) {
              toSend.forEach((promotion) => deliveredIds.add(promotion.id));
            }
          }
        }

        // Handle monitored date promotions
        const monitoredDatePromotions = await findMonitoredDatePromotionsByChannel(
          promotionService,
          dateMonitorService,
          analysisService,
        );

        for (const [channelKey, { promotions, aiAnalyses }] of monitoredDatePromotions.entries()) {
          const delivered = await notificationService.sendPromotions(
            channelKey,
            promotions.slice(0, 3),
            aiAnalyses,
          );

          if (delivered > 0) {
            promotions.forEach((promotion) => deliveredIds.add(promotion.id));
          }
        }

        // Update sent cache
        deliveredIds.forEach((id) => sentPromotionIds.add(id));

        if (sentPromotionIds.size > MAX_SENT_CACHE_SIZE) {
          sentPromotionIds.clear();
        }

        logger.info({ delivered: deliveredIds.size }, 'Job de promoções finalizado com sucesso');
      } catch (error) {
        logger.error({ error }, 'Falha ao executar job de promoções');
      }
    },
    {
      timezone: env.DEFAULT_TIMEZONE,
    },
  );
}

interface MonitoredResult {
  promotions: FlightPromotion[];
  aiAnalyses?: Map<string, string>;
}

async function findMonitoredDatePromotionsByChannel(
  promotionService: PromotionService,
  dateMonitorService: DateMonitorService,
  analysisService: FlightAnalysisService,
): Promise<Map<DateMonitorChannelKey, MonitoredResult>> {
  const monitors = dateMonitorService.listAll();
  const matches = new Map<DateMonitorChannelKey, MonitoredResult>();

  for (const monitor of monitors) {
    const result = await promotionService.findPromotions({
      origin: monitor.origin,
      destination: '',
      departureDate: monitor.dateFrom,
      returnDate: monitor.dateTo,
      context: 'cron',
    });

    const monitorMatches = result.promotions.filter((promotion) => {
      const matchesDate = dateIsInsideFlexibleRange(
        promotion.departureDate,
        monitor.dateFrom,
        monitor.dateTo,
        monitor.flexDays,
      );
      const matchesPrice = monitor.maxPrice ? promotion.price <= monitor.maxPrice : true;

      return matchesDate && matchesPrice;
    });

    if (monitorMatches.length > 0) {
      // Run AI analysis on matched promotions
      let aiAnalyses: Map<string, string> | undefined;
      try {
        aiAnalyses = await analysisService.analyzePromotions(monitorMatches);
      } catch (error) {
        logger.error({ error }, '[PromoJob] Erro ao analisar promoções monitoradas com IA');
      }

      const existing = matches.get(monitor.channelKey);
      if (existing) {
        // Merge promotions and analyses
        existing.promotions.push(...monitorMatches);
        if (aiAnalyses) {
          if (!existing.aiAnalyses) {
            existing.aiAnalyses = aiAnalyses;
          } else {
            for (const [key, value] of aiAnalyses) {
              existing.aiAnalyses.set(key, value);
            }
          }
        }
      } else {
        matches.set(monitor.channelKey, {
          promotions: monitorMatches,
          aiAnalyses,
        });
      }
    }
  }

  return matches;
}
