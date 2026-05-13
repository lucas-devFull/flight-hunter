import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, channelMention } from 'discord.js';

import { buildGuideEmbed } from '@embeds/GuideEmbed';

import type { Command } from '@flight-types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('guide')
    .setDescription('Mostra os comandos do FlightHunter e explica os canais.')
    .addChannelOption((option) =>
      option
        .setName('canal')
        .setDescription('Canal onde publicar o guia, por exemplo #guide')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),
  async execute(interaction) {
    const channel = interaction.options.getChannel('canal');
    const embed = buildGuideEmbed();

    if (!channel) {
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    const resolvedChannel = await interaction.client.channels.fetch(channel.id);

    if (!resolvedChannel?.isSendable()) {
      await interaction.reply({
        content: 'Nao consigo enviar mensagens nesse canal. Escolha um canal de texto.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await resolvedChannel.send({ embeds: [embed] });
    await interaction.reply({
      content: `Guia publicado em ${channelMention(channel.id)}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
