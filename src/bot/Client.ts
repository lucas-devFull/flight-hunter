import { Client, Collection, GatewayIntentBits } from 'discord.js';

import type { Command } from '@flight-types/Command';

export class FlightHunterClient extends Client {
  public readonly commands: Collection<string, Command>;

  constructor() {
    super({ intents: [GatewayIntentBits.Guilds] });
    this.commands = new Collection();
  }

  public registerCommand(command: Command): void {
    this.commands.set(command.data.name, command);
  }
}
