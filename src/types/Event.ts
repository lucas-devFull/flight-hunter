import type { ClientEvents } from 'discord.js';

import type { FlightHunterClient } from '@bot/Client';

export interface BotEvent<K extends keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute(client: FlightHunterClient, ...args: ClientEvents[K]): Promise<void> | void;
}
