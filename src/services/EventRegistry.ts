import type { ClientEvents } from 'discord.js';

import { events } from '@events/index';
import { logger } from '@utils/logger';

import type { FlightHunterClient } from '@bot/Client';
import type { BotEvent } from '@flight-types/Event';

export async function loadEvents(client: FlightHunterClient): Promise<void> {
  events.forEach((event) => registerEvent(client, event));
  logger.info({ count: events.length }, 'Eventos carregados');
}

function registerEvent<K extends keyof ClientEvents>(
  client: FlightHunterClient,
  event: BotEvent<K>,
): void {
  const callback = (...args: ClientEvents[K]) => {
    void Promise.resolve(event.execute(client, ...args)).catch((error: unknown) => {
      logger.error({ error, event: event.name }, 'Erro em evento Discord');
    });
  };

  if (event.once) {
    client.once(event.name, callback);
    return;
  }

  client.on(event.name, callback);
}
