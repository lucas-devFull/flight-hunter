import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

import { searchDestinations, searchOrigins } from '@config/destinations';
import { buildPromotionEmbed } from '@embeds/PromoEmbed';
import { DateFallbackService } from '@services/DateFallbackService';
import { FlightAnalysisService } from '@services/FlightAnalysisService';
import { PromotionService } from '@services/PromotionService';
import { ProviderRegistry } from '@services/ProviderRegistry';
import { RateLimiter } from '@services/RateLimiter';
import { createProviderConfigs } from '@providers/providerFactory';

import type { Command } from '@flight-types/Command';

// Instantiate services
const providerConfigs = createProviderConfigs();
const registry = new ProviderRegistry(providerConfigs);
const rateLimiter = new RateLimiter(registry);
const dateFallbackService = new DateFallbackService();
const analysisService = new FlightAnalysisService();
const promotionService = new PromotionService(registry, rateLimiter, dateFallbackService, analysisService);

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('promocoes')
    .setDescription('Busca promoções de voos. Sem parâmetros = descoberta de ofertas.')
    .addStringOption((option) =>
      option
        .setName('origem')
        .setDescription('Aeroporto de origem (opcional, padrão: GRU)')
        .setRequired(false)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName('destino')
        .setDescription('Aeroporto de destino (opcional, sem = descoberta de ofertas)')
        .setRequired(false)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName('data_ida')
        .setDescription('Data de ida (YYYY-MM-DD). Se não informada, será gerada automaticamente.')
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName('data_volta')
        .setDescription('Data de volta (YYYY-MM-DD). Se não informada, será gerada automaticamente.')
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName('escalas_max')
        .setDescription('Número máximo de escalas (0 = voo direto)')
        .setMinValue(0)
        .setMaxValue(3)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch {
      return;
    }

    const origemRaw = interaction.options.getString('origem');
    const destinoRaw = interaction.options.getString('destino');
    const dataIda = interaction.options.getString('data_ida') ?? undefined;
    const dataVolta = interaction.options.getString('data_volta') ?? undefined;
    const escalasMax = interaction.options.getInteger('escalas_max') ?? undefined;

    const origem = origemRaw?.toUpperCase() || undefined;
    const destino = destinoRaw?.toUpperCase() || undefined;

    // Validate date format if provided
    if (dataIda && !/^\d{4}-\d{2}-\d{2}$/.test(dataIda)) {
      await interaction.editReply(
        '❌ Formato de data inválido para `data_ida`. Use o formato YYYY-MM-DD (ex: 2025-03-15).',
      );
      return;
    }
    if (dataVolta && !/^\d{4}-\d{2}-\d{2}$/.test(dataVolta)) {
      await interaction.editReply(
        '❌ Formato de data inválido para `data_volta`. Use o formato YYYY-MM-DD (ex: 2025-03-22).',
      );
      return;
    }

    // Search promotions using the refactored PromotionService
    const result = await promotionService.findPromotions({
      origin: origem,
      destination: destino,
      departureDate: dataIda ?? null,
      returnDate: dataVolta ?? null,
      maxStops: escalasMax,
      context: 'interactive',
    });

    // Handle all providers exhausted
    if (result.allProvidersExhausted) {
      await interaction.editReply(
        '⚠️ Nenhum provider de voos está disponível no momento. Todos atingiram o limite de requisições.\n\nTente novamente mais tarde.',
      );
      return;
    }

    // Filter by escalas_max if provided
    let promotions = result.promotions;
    if (escalasMax !== undefined) {
      promotions = promotions.filter((p) => p.stops <= escalasMax);
    }

    // Build route label
    const routeLabel = origem && destino
      ? `${origem} → ${destino}`
      : origem
        ? `saindo de ${origem}`
        : destino
          ? `para ${destino}`
          : 'melhores ofertas';

    if (promotions.length === 0) {
      await interaction.editReply(
        `Nenhuma promoção encontrada para ${routeLabel}${escalasMax !== undefined ? ` com no máximo ${escalasMax} escala(s)` : ''}.\n\nTente novamente com outros parâmetros ou mais tarde.`,
      );
      return;
    }

    // Build date info message
    const { datesUsed } = result;
    const dateInfoParts: string[] = [];
    if (datesUsed.departureFallback) {
      dateInfoParts.push(`📅 Data de ida gerada automaticamente: **${datesUsed.departureDate}**`);
    } else if (datesUsed.departureDate) {
      dateInfoParts.push(`📅 Data de ida informada: **${datesUsed.departureDate}**`);
    }
    if (datesUsed.returnFallback) {
      dateInfoParts.push(`📅 Data de volta gerada automaticamente: **${datesUsed.returnDate}**`);
    } else if (datesUsed.returnDate) {
      dateInfoParts.push(`📅 Data de volta informada: **${datesUsed.returnDate}**`);
    }
    const dateInfo = dateInfoParts.length > 0 ? `\n${dateInfoParts.join('\n')}` : '';

    // Build embeds with AI analysis
    const aiAnalyses = result.aiAnalyses;
    const embeds = promotions.slice(0, 5).map((promotion) =>
      buildPromotionEmbed(promotion, aiAnalyses?.get(promotion.id)),
    );

    const filtersText = escalasMax !== undefined ? `\n🔄 Filtro: máximo ${escalasMax} escala(s)` : '';

    await interaction.editReply({
      content: `✈️ Encontrei **${promotions.length}** promoção(ões) — ${routeLabel} via **${result.providerUsed}**.${dateInfo}${filtersText}`,
      embeds,
    });
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const query = focused.value;

    let choices: { name: string; value: string }[];

    if (focused.name === 'origem') {
      const results = searchOrigins(query);
      choices = results.map((d) => ({
        name: `${d.airport} (${d.code}) - ${d.city}`,
        value: d.code,
      }));
    } else if (focused.name === 'destino') {
      const results = searchDestinations(query);
      choices = results.map((d) => ({
        name: `${d.code} - ${d.city}, ${d.country} (${d.airport})`,
        value: d.code,
      }));
    } else {
      choices = [];
    }

    await interaction.respond(choices);
  },
};

export default command;
