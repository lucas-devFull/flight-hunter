import { Events } from 'discord.js';

import { logger } from '@utils/logger';

import type { BotEvent } from '@flight-types/Event';

const event: BotEvent<Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    if (!client.user?.tag) {
      return;
    }

    logger.info({ tag: client.user.tag }, 'Evento ready disparado');
  },
};

export default event;
