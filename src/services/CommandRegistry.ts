import { commands } from '@commands/index';
import { logger } from '@utils/logger';

import type { FlightHunterClient } from '@bot/Client';

export async function loadCommands(client: FlightHunterClient): Promise<void> {
  for (const command of commands) {
    client.registerCommand(command);
  }

  logger.info({ count: commands.length }, 'Comandos carregados');
}
