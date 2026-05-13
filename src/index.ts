import { FlightHunterClient } from '@bot/Client';
import { env } from '@config/env';
import { startPromotionJob } from '@jobs/promoJob';
import { loadCommands } from '@services/CommandRegistry';
import { loadEvents } from '@services/EventRegistry';
import { logger } from '@utils/logger';

const client = new FlightHunterClient();

async function main(): Promise<void> {
  await loadCommands(client);
  await loadEvents(client);

  await client.login(env.DISCORD_TOKEN);
  logger.info('Login realizado com sucesso');

  startPromotionJob(client);
}

main().catch((error) => {
  logger.error({ error }, 'Falha ao inicializar o FlightHunter');
  process.exit(1);
});
