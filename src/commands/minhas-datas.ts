import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import { DateMonitorService } from '@services/DateMonitorService';

import type { Command } from '@flight-types/Command';

const dateMonitorService = new DateMonitorService();

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('minhas-datas')
    .setDescription('Lista seus monitoramentos ativos por data.'),
  async execute(interaction) {
    const monitors = dateMonitorService.listByUser(interaction.user.id);

    if (monitors.length === 0) {
      await interaction.reply({
        content: 'Voce ainda nao tem monitoramentos por data.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: monitors
        .map((monitor) =>
          [
            `ID: \`${monitor.id}\``,
            `${monitor.origin} | ${monitor.destinationCountryCode ?? 'qualquer pais'} | ${monitor.dateFrom} -> ${monitor.dateTo}`,
            `Canal: ${monitor.channelKey}`,
            `Flex: ${monitor.flexDays} dia(s) | Preco maximo: ${
              monitor.maxPrice ? `R$ ${monitor.maxPrice}` : 'sem limite'
            }`,
          ].join('\n'),
        )
        .join('\n\n'),
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
