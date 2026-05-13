import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import { DateMonitorService } from '@services/DateMonitorService';

import type { Command } from '@flight-types/Command';

const dateMonitorService = new DateMonitorService();

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('parar-monitoramento')
    .setDescription('Remove seus monitoramentos por data.')
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('ID opcional de um monitoramento. Sem ID, remove todos.')
        .setRequired(false),
    ),
  async execute(interaction) {
    const monitorId = interaction.options.getString('id') ?? undefined;
    const removed = dateMonitorService.removeByUser(interaction.user.id, monitorId);

    if (removed === 0) {
      await interaction.reply({
        content: 'Nenhum monitoramento encontrado para remover.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: `${removed} monitoramento(s) removido(s).`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
