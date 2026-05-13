import { Events } from 'discord.js';

import { logger } from '@utils/logger';

import type { BotEvent } from '@flight-types/Event';

const event: BotEvent<Events.InteractionCreate> = {
  name: Events.InteractionCreate,
  async execute(client, interaction) {
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command?.autocomplete) return;

      try {
        await command.autocomplete(interaction, client);
      } catch (error) {
        logger.error({ error, command: interaction.commandName }, 'Erro no autocomplete');
      }
      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn({ command: interaction.commandName }, 'Comando não encontrado');
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      logger.error({ error, command: interaction.commandName }, 'Erro ao executar comando');
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply('Ocorreu um erro ao executar este comando.');
        } else {
          await interaction.reply('Ocorreu um erro ao executar este comando.');
        }
      } catch (replyError) {
        logger.error({ replyError }, 'Erro ao enviar mensagem de erro ao usuario');
      }
    }
  },
};

export default event;
