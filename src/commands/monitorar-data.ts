import { SlashCommandBuilder, MessageFlags } from 'discord.js';

import {
  DATE_MONITOR_CHANNEL_CHOICES,
  PRIORITY_COUNTRIES,
  isDateMonitorChannelKey,
  isMonitoredAirportCode,
} from '@config/flight';
import { searchOrigins } from '@config/destinations';
import { DateMonitorService } from '@services/DateMonitorService';
import { daysBetween, isIsoDateOnly } from '@utils/dateRange';

import type { Command } from '@flight-types/Command';

const dateMonitorService = new DateMonitorService();
const MAX_RANGE_DAYS = 370;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('monitorar-data')
    .setDescription('Cria um monitoramento de voos para datas especificas.')
    .addStringOption((option) =>
      option
        .setName('origem')
        .setDescription('Aeroporto de origem (código IATA ou cidade)')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName('data_ida')
        .setDescription('Data de ida no formato YYYY-MM-DD')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('data_volta')
        .setDescription('Data de volta no formato YYYY-MM-DD')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('pais')
        .setDescription('Pais prioritario opcional')
        .setRequired(false)
        .addChoices(
          ...PRIORITY_COUNTRIES.map((country) => ({ name: country.name, value: country.code })),
        ),
    )
    .addNumberOption((option) =>
      option
        .setName('preco_maximo')
        .setDescription('Preco maximo em BRL para alertar')
        .setMinValue(1)
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName('flex')
        .setDescription('Dias de flexibilidade antes/depois das datas')
        .setMinValue(0)
        .setMaxValue(15)
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName('canal')
        .setDescription('Canal de datas especificas que recebera os alertas')
        .setRequired(false)
        .addChoices(...DATE_MONITOR_CHANNEL_CHOICES),
    ),
  async execute(interaction) {
    const origin = interaction.options.getString('origem', true).toUpperCase();
    const dateFrom = interaction.options.getString('data_ida', true);
    const dateTo = interaction.options.getString('data_volta', true);
    const destinationCountryCode = interaction.options.getString('pais');
    const maxPrice = interaction.options.getNumber('preco_maximo');
    const flexDays = interaction.options.getInteger('flex') ?? 0;
    const channelKeyInput = interaction.options.getString('canal') ?? 'specificDates';

    if (!isDateMonitorChannelKey(channelKeyInput)) {
      await interaction.reply({
        content: 'Canal de datas especificas invalido.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!isMonitoredAirportCode(origin)) {
      await interaction.reply({
        content: `Aeroporto ${origin} ainda nao esta na lista monitorada.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!isIsoDateOnly(dateFrom) || !isIsoDateOnly(dateTo)) {
      await interaction.reply({
        content: 'Use datas no formato YYYY-MM-DD. Exemplo: 2026-09-05.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const rangeDays = daysBetween(dateFrom, dateTo);

    if (rangeDays < 0 || rangeDays > MAX_RANGE_DAYS) {
      await interaction.reply({
        content:
          'A data de volta precisa vir depois da ida e o periodo deve ter no maximo 370 dias.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const monitor = dateMonitorService.create({
      channelKey: channelKeyInput,
      dateFrom,
      dateTo,
      destinationCountryCode,
      flexDays,
      maxPrice,
      origin,
      userId: interaction.user.id,
    });

    await interaction.reply({
      content: [
        `Monitoramento criado: \`${monitor.id}\``,
        `Origem: ${origin}`,
        `Datas: ${dateFrom} -> ${dateTo}${flexDays > 0 ? ` com flex de ${flexDays} dia(s)` : ''}`,
        destinationCountryCode ? `Pais: ${destinationCountryCode}` : 'Pais: qualquer prioridade',
        maxPrice ? `Preco maximo: R$ ${maxPrice}` : 'Preco maximo: sem limite',
        `Canal: ${channelKeyInput}`,
        'Os alertas aparecem no canal escolhido quando o job encontrar algo compativel.',
      ].join('\n'),
      flags: MessageFlags.Ephemeral,
    });
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);

    if (focused.name === 'origem') {
      const results = searchOrigins(focused.value);
      const choices = results.map((d) => ({
        name: `${d.airport} (${d.code}) - ${d.city}`,
        value: d.code,
      }));
      await interaction.respond(choices);
    }
  },
};

export default command;
