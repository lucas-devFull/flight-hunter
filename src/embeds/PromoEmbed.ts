import { EmbedBuilder } from 'discord.js';

import { formatCurrencyBRL, formatDateBR, formatDuration } from '@utils/formatters';

import type { FlightPromotion } from '@flight-types/FlightPromotion';

/** Mapa de código IATA de origem → sigla do estado */
const ORIGIN_STATES: Record<string, string> = {
  GRU: 'SP', CGH: 'SP', VCP: 'SP',
  GIG: 'RJ', SDU: 'RJ',
  BSB: 'DF',
  CNF: 'MG',
  CWB: 'PR', IGU: 'PR',
  POA: 'RS',
  FLN: 'SC',
  REC: 'PE',
  SSA: 'BA',
  FOR: 'CE',
  NAT: 'RN',
  MCZ: 'AL',
  MAO: 'AM',
  BEL: 'PA',
};

export function buildPromotionEmbed(promotion: FlightPromotion, aiAnalysis?: string, dateFallback?: boolean): EmbedBuilder {
  const dateLabel = promotion.returnDate
    ? `${formatDateBR(promotion.departureDate)} -> ${formatDateBR(promotion.returnDate)}`
    : `${formatDateBR(promotion.departureDate)} -> somente ida`;

  // Determinar o por que está boa a promoção
  let whyGood = '';
  if (promotion.isCrazyDeal) {
    whyGood = '🚨 **OFERTA MALUCA** - Preço muito abaixo do normal!';
  } else if (promotion.score >= 90) {
    whyGood = '⭐ **Excelente oportunidade** - Alta pontuação de qualidade';
  } else if (promotion.score >= 80) {
    whyGood = '👍 **Boa promoção** - Bom equilíbrio preço/qualidade';
  } else if (promotion.score >= 70) {
    whyGood = '✅ **Promoção interessante** - Preço competitivo';
  } else {
    whyGood = '📊 **Promoção encontrada** - Dentro dos padrões';
  }

  // Escalas com cidades de conexão
  let stopsLabel: string;
  if (promotion.stops === 0) {
    stopsLabel = '✅ Voo direto';
  } else {
    const stopsText = `${promotion.stops} escala${promotion.stops > 1 ? 's' : ''}`;
    if (promotion.stopoverCities && promotion.stopoverCities.length > 0) {
      stopsLabel = `⚠️ ${stopsText}\n📍 Conexão: ${promotion.stopoverCities.join(' → ')}`;
    } else {
      stopsLabel = `⚠️ ${stopsText}\n📍 Cidade(s) não informada(s)`;
    }
  }

  // Informações sobre a fonte
  const isSerper = promotion.provider === 'Serper Flights';
  const isAviasales = promotion.provider.startsWith('Aviasales');
  const priceNote = isSerper
    ? '\n⚠️ Estimativa (confirme no link)'
    : isAviasales
      ? '\n💡 Preço aproximado'
      : '';
  const sourceInfo = `Fonte: **${promotion.provider}** | Score: **${promotion.score}/100**`;

  const dateValue = dateFallback
    ? `${dateLabel}\n📅 Data gerada automaticamente`
    : dateLabel;

  // Rota com cidade + estado/país: "São Paulo, SP (GRU) → Lisboa, Portugal (LIS)"
  const originState = ORIGIN_STATES[promotion.origin.toUpperCase()] || '';
  const originLabel = promotion.originName && promotion.originName !== promotion.origin
    ? `${promotion.originName}${originState ? `, ${originState}` : ''} (${promotion.origin})`
    : promotion.origin;
  const destCountry = promotion.destinationCountry || '';
  const destLabel = promotion.destination && promotion.destination !== promotion.destinationCode
    ? `${promotion.destination}${destCountry ? `, ${destCountry}` : ''} (${promotion.destinationCode})`
    : promotion.destinationCode;
  const routeValue = `${originLabel} → ${destLabel}`;

  const fields = [
    { name: '💰 Preço', value: `${formatCurrencyBRL(promotion.price)}${priceNote}\n👤 por pessoa`, inline: true },
    { name: '🛫 Rota', value: routeValue, inline: true },
    { name: '📅 Datas', value: dateValue, inline: true },
    { name: '✈️ Companhia', value: promotion.airline ?? 'Não informado', inline: true },
    { name: '⏱️ Duração', value: formatDuration(promotion.durationMinutes), inline: true },
    { name: '🔄 Escalas', value: stopsLabel, inline: true },
  ];

  if (aiAnalysis) {
    fields.push({ name: '🤖 Análise IA', value: aiAnalysis, inline: false });
  }

  fields.push({ name: '🔍 Fonte da Promoção', value: sourceInfo, inline: false });

  // Link principal: Google Flights como prioridade, bookingUrl como fallback
  const mainUrl = promotion.googleFlightsUrl || promotion.bookingUrl || '';

  const footerText = promotion.googleFlightsUrl
    ? 'Clique no título para ver no Google Flights (site seguro) | Preço pode variar'
    : 'Clique no título para ver no site do provider | Preço pode variar';

  return new EmbedBuilder()
    .setTitle(
      `${promotion.isCrazyDeal ? '🚨 Oferta muito barata' : '✈️ Promoção encontrada'}: ${promotion.destination}`,
    )
    .setDescription(`${promotion.summary}\n\n${whyGood}`)
    .addFields(fields)
    .setURL(mainUrl)
    .setTimestamp(new Date())
    .setFooter({ text: footerText })
    .setColor(promotion.isCrazyDeal ? 0xf97316 : 0x1d8af0);
}
