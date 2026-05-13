import { EmbedBuilder } from 'discord.js';

import { DISCORD_CHANNELS } from '@config/flight';

export function buildGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('FlightHunter Guide')
    .setDescription('Comandos disponiveis e como usar cada canal do servidor.')
    .addFields([
      {
        name: 'Comandos',
        value: [
          '`/ping` - verifica se o bot esta online.',
          '`/promocoes` - busca promocoes de voos com filtros opcionais.',
          '`/monitorar-data` - cria alerta para datas especificas.',
          '`/minhas-datas` - lista seus alertas por data.',
          '`/parar-monitoramento` - remove alertas por data.',
          '`/guide` - mostra este guia ou publica em um canal escolhido.',
        ].join('\n'),
      },
      {
        name: '📍 Parametros Obrigatorios',
        value: [
          '`origem` - aeroporto de partida (GRU, GIG, VCP, BSB, CNF, CGH, SDU, CWB).',
          '`destino` - codigo IATA ou cidade de destino.',
          'Ambos sao obrigatorios no comando `/promocoes`.',
        ].join('\n'),
      },
      {
        name: '📅 Datas (opcionais)',
        value: [
          '`data_ida` - data de ida no formato YYYY-MM-DD (opcional).',
          '`data_volta` - data de volta no formato YYYY-MM-DD (opcional).',
          'Voce nao precisa informar datas para buscar promocoes.',
        ].join('\n'),
      },
      {
        name: '🔄 Fallback de Datas',
        value: [
          'Quando o provider exige datas e voce nao informou:',
          '• **Ida**: o sistema gera uma data entre 30 e 90 dias a frente.',
          '• **Volta**: o sistema gera uma data entre 7 e 14 dias apos a ida.',
          'O resultado mostra se a data foi informada por voce ou gerada automaticamente.',
        ].join('\n'),
      },
      {
        name: 'Exemplos de /promocoes',
        value: [
          '`/promocoes origem:GRU destino:LIS` - sem datas (fallback automatico)',
          '`/promocoes origem:GRU destino:NRT data_ida:2025-03-15` - com data de ida',
          '`/promocoes origem:VCP destino:MAD data_ida:2025-04-01 data_volta:2025-04-15` - com ida e volta',
          '`/promocoes origem:GIG destino:MIA escalas_max:1` - maximo 1 escala',
        ].join('\n'),
      },
      {
        name: '🌍 Guia de Destinos — Internacional',
        value: [
          '`LIS` - Lisboa, Portugal (Aeroporto Humberto Delgado)',
          '`OPO` - Porto, Portugal (Aeroporto Francisco Sa Carneiro)',
          '`MAD` - Madrid, Espanha (Aeroporto Adolfo Suarez-Barajas)',
          '`BCN` - Barcelona, Espanha (Aeroporto El Prat)',
          '`FCO` - Roma, Italia (Aeroporto Leonardo da Vinci-Fiumicino)',
          '`MXP` - Milao, Italia (Aeroporto Malpensa)',
          '`CDG` - Paris, Franca (Aeroporto Charles de Gaulle)',
          '`LHR` - Londres, Reino Unido (Aeroporto Heathrow)',
          '`FRA` - Frankfurt, Alemanha (Aeroporto de Frankfurt)',
          '`AMS` - Amsterda, Holanda (Aeroporto Schiphol)',
        ].join('\n'),
      },
      {
        name: '🌎 Guia de Destinos — Americas',
        value: [
          '`MIA` - Miami, EUA (Aeroporto Internacional de Miami)',
          '`JFK` - Nova York, EUA (Aeroporto John F. Kennedy)',
          '`MCO` - Orlando, EUA (Aeroporto Internacional de Orlando)',
          '`LAX` - Los Angeles, EUA (Aeroporto Internacional de LA)',
          '`EZE` - Buenos Aires, Argentina (Aeroporto Ezeiza)',
          '`SCL` - Santiago, Chile (Aeroporto Arturo Merino Benitez)',
          '`BOG` - Bogota, Colombia (Aeroporto El Dorado)',
          '`LIM` - Lima, Peru (Aeroporto Jorge Chavez)',
          '`CUN` - Cancun, Mexico (Aeroporto Internacional de Cancun)',
          '`PTY` - Cidade do Panama (Aeroporto Tocumen)',
        ].join('\n'),
      },
      {
        name: '🌏 Guia de Destinos — Asia e Oriente',
        value: [
          '`NRT` - Toquio, Japao (Aeroporto Narita)',
          '`HND` - Toquio, Japao (Aeroporto Haneda)',
          '`ICN` - Seul, Coreia do Sul (Aeroporto Incheon)',
          '`BKK` - Bangkok, Tailandia (Aeroporto Suvarnabhumi)',
          '`DXB` - Dubai, Emirados Arabes (Aeroporto Internacional de Dubai)',
          '`DOH` - Doha, Catar (Aeroporto Hamad)',
          '`SIN` - Singapura (Aeroporto Changi)',
          '`PVG` - Xangai, China (Aeroporto Pudong)',
          '`DEL` - Nova Delhi, India (Aeroporto Indira Gandhi)',
          '`TLV` - Tel Aviv, Israel (Aeroporto Ben Gurion)',
        ].join('\n'),
      },
      {
        name: '🇧🇷 Origens Disponiveis (Brasil)',
        value: [
          '`GRU` - Sao Paulo (Aeroporto de Guarulhos)',
          '`CGH` - Sao Paulo (Aeroporto de Congonhas)',
          '`GIG` - Rio de Janeiro (Aeroporto Galeao)',
          '`SDU` - Rio de Janeiro (Aeroporto Santos Dumont)',
          '`VCP` - Campinas (Aeroporto de Viracopos)',
          '`BSB` - Brasilia (Aeroporto Juscelino Kubitschek)',
          '`CNF` - Belo Horizonte (Aeroporto de Confins)',
          '`CWB` - Curitiba (Aeroporto Afonso Pena)',
        ].join('\n'),
      },
      {
        name: '📢 Canais de Promocoes',
        value: [
          `${DISCORD_CHANNELS.geral.label} - recebe todas as promocoes (internacionais e domesticas).`,
          `${DISCORD_CHANNELS.international.label} - apenas voos saindo do Brasil para destinos internacionais.`,
          `${DISCORD_CHANNELS.brazil.label} - apenas voos domesticos (origem e destino dentro do Brasil).`,
          `${DISCORD_CHANNELS.crazy.label} - ofertas muito baratas, rotas inesperadas e oportunidades fora da curva.`,
        ].join('\n'),
      },
      {
        name: DISCORD_CHANNELS.specificDates.label,
        value: [
          'Canal geral de alertas criados com `/monitorar-data`.',
          'Exemplo geral: `/monitorar-data origem:GRU data_ida:2026-09-05 data_volta:2026-09-20 pais:Japao preco_maximo:5000 flex:3 canal:Geral - datas-especificas`',
          'Use `/minhas-datas` para ver alertas ativos e `/parar-monitoramento` para remover.',
          'No MVP os alertas ficam em memoria: se reiniciar o bot, voce precisa cadastrar de novo.',
        ].join('\n'),
      },
      {
        name: 'Canais pessoais de datas',
        value: [
          `${DISCORD_CHANNELS.specificDatesLucasBe.label} - alertas de Lucas BE.`,
          `${DISCORD_CHANNELS.specificDatesZu.label} - alertas de Zu.`,
          `${DISCORD_CHANNELS.specificDatesMacedoEste.label} - alertas de Macedo Este.`,
          'Use a opcao `canal` no `/monitorar-data` para escolher onde o alerta vai cair.',
        ].join('\n'),
      },
      {
        name: DISCORD_CHANNELS.guide.label,
        value: 'Canal fixo para deixar este guia visivel para todo mundo.',
      },
    ])
    .setColor(0x2563eb)
    .setFooter({ text: 'FlightHunter | Busca unificada com providers por prioridade' })
    .setTimestamp(new Date());
}
