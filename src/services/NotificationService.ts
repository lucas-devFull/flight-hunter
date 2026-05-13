import type { SendableChannels } from 'discord.js';
import { ChannelType } from 'discord.js';

import { DISCORD_CHANNELS } from '@config/flight';
import { env } from '@config/env';
import { buildPromotionEmbed } from '@embeds/PromoEmbed';
import { logger } from '@utils/logger';

import type { AlertChannelKey } from '@config/flight';
import type { FlightHunterClient } from '@bot/Client';
import type { FlightPromotion } from '@flight-types/FlightPromotion';

const MAX_EMBEDS_PER_MESSAGE = 5;

export class NotificationService {
  public constructor(private readonly client: FlightHunterClient) {}

  public async sendPromotions(
    channelKey: AlertChannelKey,
    promotions: readonly FlightPromotion[],
    aiAnalyses?: Map<string, string>,
  ): Promise<number> {
    if (promotions.length === 0) {
      return 0;
    }

    const channel = await this.resolveChannel(channelKey);

    if (!channel) {
      logger.warn({ channel: DISCORD_CHANNELS[channelKey].name }, 'Canal Discord nao encontrado');
      return 0;
    }

    const selectedPromotions = promotions.slice(0, MAX_EMBEDS_PER_MESSAGE);
    const embeds = selectedPromotions.map((promotion) =>
      buildPromotionEmbed(promotion, aiAnalyses?.get(promotion.id)),
    );

    await channel.send({
      content: this.buildMessage(channelKey, selectedPromotions.length),
      embeds,
    });

    return selectedPromotions.length;
  }

  private async resolveChannel(channelKey: AlertChannelKey): Promise<SendableChannels | null> {
    const channelId = this.getChannelId(channelKey);

    if (channelId) {
      const channel = await this.client.channels.fetch(channelId).catch((error: unknown) => {
        logger.warn({ error, channelId }, 'Falha ao buscar canal por ID');
        return null;
      });

      if (channel?.isSendable()) {
        return channel;
      }
    }

    const channel = this.client.channels.cache.find(
      (cachedChannel) =>
        cachedChannel.type === ChannelType.GuildText &&
        cachedChannel.name === DISCORD_CHANNELS[channelKey].name,
    );

    if (channel?.isSendable()) {
      return channel;
    }

    return null;
  }

  private getChannelId(channelKey: AlertChannelKey): string | undefined {
    const channelIds: Record<AlertChannelKey, string | undefined> = {
      geral: env.DISCORD_CHANNEL_GERAL_ID,
      brazil: env.DISCORD_CHANNEL_BRASIL_ID,
      crazy: env.DISCORD_CHANNEL_VOOS_MALUCOS_ID,
      international: env.DISCORD_CHANNEL_INTERNACIONAL_ID,
      specificDates: env.DISCORD_CHANNEL_DATAS_ESPECIFICAS_ID,
      specificDatesLucasBe: env.DISCORD_CHANNEL_DATAS_ESPECIFICAS_LUCAS_BE_ID,
      specificDatesMacedoEste: env.DISCORD_CHANNEL_DATAS_ESPECIFICAS_MACEDO_ESTE_ID,
      specificDatesZu: env.DISCORD_CHANNEL_DATAS_ESPECIFICAS_ZU_ID,
    };

    return channelIds[channelKey];
  }

  private buildMessage(channelKey: AlertChannelKey, total: number): string {
    const channel = DISCORD_CHANNELS[channelKey];
    const noun = total === 1 ? 'promocao encontrada' : 'promocoes encontradas';

    return `${channel.label}: ${total} ${noun}.`;
  }
}
