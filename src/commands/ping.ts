import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import type { Command } from '@flight-types/Command';

const command: Command = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Verifica se o bot está online'),
  async execute(interaction) {
    const latency = Date.now() - interaction.createdTimestamp;

    await interaction.reply({
      content: `Pong! FlightHunter online. Latencia: ${latency}ms.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
