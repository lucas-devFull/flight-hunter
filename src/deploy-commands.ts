import { REST, Routes } from 'discord.js';

import { commands } from '@commands/index';
import { env } from '@config/env';
import { logger } from '@utils/logger';

const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

async function deployCommands(): Promise<void> {
  const payload = commands.map((command) => command.data.toJSON());

  logger.info({ count: payload.length }, 'Registrando comandos de slash');

  await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
    body: payload,
  });

  logger.info('Comandos registrados com sucesso');
}

void deployCommands().catch((error) => {
  logger.error({ error }, 'Erro ao registrar comandos');
  process.exit(1);
});
