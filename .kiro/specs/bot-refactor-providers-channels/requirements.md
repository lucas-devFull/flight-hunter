# Documento de Requisitos — Refatoração de Providers e Canais

## Introdução

Refatoração do bot FlightHunter para implementar um sistema de rate limiting com lista ordenada de providers (melhor para pior), separação de comandos por canal (geral, internacional, brasil), comando unificado de promoções com busca sequencial por prioridade, datas com fallback, suporte a escalas, e análise de uso ideal de cada provider (comandos vs cron).

## Glossário

- **Rate_Limiter**: Módulo centralizado que controla o número de requisições por provider, respeitando limites individuais de cada API.
- **Provider_Registry**: Lista ordenada de providers do melhor para o pior, usada para determinar a ordem de consulta.
- **Canal_Geral**: Canal Discord que recebe qualquer promoção (internacional ou doméstica).
- **Canal_Internacional**: Canal Discord que recebe apenas promoções de voos saindo do Brasil para destinos fora do Brasil.
- **Canal_Brasil**: Canal Discord que recebe apenas promoções de voos domésticos (dentro do Brasil).
- **Origem_Predefinida**: Aeroportos/cidades brasileiros pré-configurados como pontos de partida (GRU, GIG, VCP, BSB, CNF, CGH, SDU, CWB).
- **Escala**: Parada intermediária em um voo entre origem e destino final.
- **Fallback_de_Data**: Data padrão gerada automaticamente quando o provider exige data mas o usuário não informou.
- **Provider**: Serviço externo de busca de voos (Aviasales, Kiwi, SkyScrapper, FlightAPI, Serper).
- **Comando_Promocoes**: Comando unificado `/promocoes` que consulta providers na ordem de prioridade.
- **Cron_Job**: Tarefa agendada que executa buscas automaticamente em intervalos definidos.
- **FlightAnalysisService**: Serviço que utiliza IA (OpenAI GPT) para analisar se uma passagem aérea está com bom preço, considerando destino, época e histórico.
- **Google_Flights_URL**: Link gerado pelo utilitário `googleFlights.ts` que direciona o usuário para o Google Flights com parâmetros de voo pré-preenchidos.

## Requisitos

### Requisito 1: Sistema de Rate Limiting Centralizado

**User Story:** Como administrador do bot, quero um sistema centralizado de rate limiting com lista ordenada de providers, para que o bot consulte sempre o melhor provider disponível sem ultrapassar limites de API.

#### Critérios de Aceitação

1. THE Provider_Registry SHALL manter uma lista ordenada de providers por prioridade (Aviasales > Kiwi > SkyScrapper > FlightAPI > Serper).
2. THE Rate_Limiter SHALL rastrear o número de requisições realizadas por cada provider individualmente.
3. WHEN um provider atinge seu limite de requisições, THE Rate_Limiter SHALL marcar o provider como indisponível e pular para o próximo na lista de prioridade.
4. WHEN uma busca é solicitada, THE Comando_Promocoes SHALL consultar providers na ordem definida pelo Provider_Registry, parando ao obter resultados suficientes.
5. THE Rate_Limiter SHALL resetar os contadores de cada provider conforme seu ciclo (diário para Serper, mensal para os demais).
6. IF todos os providers estiverem com limite atingido, THEN THE Sistema SHALL informar ao usuário que não há providers disponíveis no momento.
7. THE Rate_Limiter SHALL expor métodos para consultar requisições restantes de cada provider.

### Requisito 2: Separação de Canais por Tipo de Promoção

**User Story:** Como usuário do Discord, quero que cada canal receba apenas promoções relevantes ao seu escopo, para que eu encontre rapidamente o que me interessa.

#### Critérios de Aceitação

1. THE Canal_Geral SHALL receber qualquer promoção encontrada, independente de ser doméstica ou internacional.
2. THE Canal_Internacional SHALL receber apenas promoções de voos com origem no Brasil e destino fora do Brasil.
3. THE Canal_Brasil SHALL receber apenas promoções de voos com origem e destino dentro do Brasil.
4. WHEN o Cron_Job encontra uma promoção, THE Sistema SHALL classificar a promoção e enviá-la apenas para os canais compatíveis.
5. THE Sistema SHALL permitir que uma promoção apareça em mais de um canal (ex: Canal_Geral e Canal_Internacional simultaneamente).

### Requisito 3: Origens Predefinidas Obrigatórias

**User Story:** Como usuário, quero que a origem dos voos seja sempre de aeroportos brasileiros pré-configurados, para que as promoções sejam relevantes para mim.

#### Critérios de Aceitação

1. THE Sistema SHALL utilizar exclusivamente aeroportos da lista de Origem_Predefinida como pontos de partida para buscas.
2. WHEN o usuário executa o Comando_Promocoes com parâmetro de origem, THE Sistema SHALL validar que o código informado pertence à lista de Origem_Predefinida.
3. WHEN o usuário executa o Comando_Promocoes sem informar origem, THE Sistema SHALL utilizar GRU como origem padrão.
4. THE Sistema SHALL apresentar a lista de origens disponíveis como choices no comando Discord.

### Requisito 4: Suporte a Escalas (Layovers)

**User Story:** Como usuário, quero poder ver e filtrar voos com escalas, para que eu tenha mais opções de preço e rota.

#### Critérios de Aceitação

1. THE Comando_Promocoes SHALL exibir informações de escala (quantidade e cidades) nos resultados.
2. THE Comando_Promocoes SHALL oferecer um parâmetro opcional `escalas_max` para filtrar voos por número máximo de escalas.
3. WHEN um voo possui escalas, THE Sistema SHALL exibir as cidades de conexão no embed de resultado.
4. THE Cron_Job SHALL incluir voos com escalas nos resultados enviados aos canais.

### Requisito 5: Comando Unificado de Promoções com Busca Sequencial

**User Story:** Como usuário, quero um único comando `/promocoes` que busque voos consultando providers na ordem de prioridade, para que eu obtenha os melhores resultados disponíveis.

#### Critérios de Aceitação

1. THE Comando_Promocoes SHALL aceitar `origem` e `destino` como parâmetros obrigatórios.
2. THE Comando_Promocoes SHALL aceitar `data_ida` e `data_volta` como parâmetros opcionais.
3. WHEN `data_ida` não é informada, THE Sistema SHALL gerar uma data de fallback (30 a 90 dias à frente) caso o provider exija data.
4. WHEN `data_volta` não é informada, THE Sistema SHALL gerar uma data de retorno de fallback (7 a 14 dias após a ida) caso o provider exija data.
5. THE Comando_Promocoes SHALL consultar providers sequencialmente na ordem do Provider_Registry até obter resultados suficientes ou esgotar a lista.
6. WHEN um provider retorna resultados válidos, THE Comando_Promocoes SHALL parar de consultar os providers seguintes.
7. THE Comando_Promocoes SHALL remover os comandos individuais por provider (`/kiwi`, `/sky`, `/flightapi`) em favor do comando unificado.

### Requisito 6: Configuração de Datas com Fallback

**User Story:** Como usuário, quero que as datas sejam opcionais no comando mas que o sistema funcione mesmo quando o provider precisa de datas, para que eu não precise sempre informar datas.

#### Critérios de Aceitação

1. WHEN o usuário informa `data_ida`, THE Sistema SHALL utilizar a data informada na busca.
2. WHEN o usuário não informa `data_ida` e o provider exige data, THE Sistema SHALL gerar uma data entre 30 e 90 dias à frente como fallback.
3. WHEN o usuário informa `data_volta`, THE Sistema SHALL utilizar a data informada na busca.
4. WHEN o usuário não informa `data_volta` e o provider exige data de retorno, THE Sistema SHALL gerar uma data de 7 a 14 dias após a data de ida como fallback.
5. THE Sistema SHALL informar ao usuário no resultado qual data foi utilizada (informada ou gerada).

### Requisito 7: Atualização do Guide com Configuração de Datas

**User Story:** Como usuário, quero que o guia do bot explique claramente como as datas funcionam (obrigatórias vs opcionais, fallback), para que eu saiba como usar o comando corretamente.

#### Critérios de Aceitação

1. THE GuideEmbed SHALL exibir uma seção explicando que `origem` e `destino` são obrigatórios.
2. THE GuideEmbed SHALL exibir uma seção explicando que `data_ida` e `data_volta` são opcionais.
3. THE GuideEmbed SHALL explicar o mecanismo de fallback de datas (30-90 dias à frente para ida, 7-14 dias após ida para volta).
4. THE GuideEmbed SHALL mostrar exemplos de uso do comando com e sem datas.
5. THE GuideEmbed SHALL listar os canais e explicar a separação (geral, internacional, brasil).

### Requisito 8: Análise e Alocação de Providers (Comandos vs Cron)

**User Story:** Como administrador do bot, quero que cada provider seja utilizado no contexto mais adequado (comando interativo ou cron job), para otimizar o uso de requisições limitadas.

#### Critérios de Aceitação

1. THE Cron_Job SHALL utilizar preferencialmente Aviasales (alto volume, sem limite rígido por request) para buscas automáticas periódicas.
2. THE Cron_Job SHALL utilizar Serper como complemento para buscas automáticas (80 requests/dia permite uso frequente).
3. THE Comando_Promocoes SHALL utilizar Kiwi como provider prioritário para comandos interativos (300 requests/mês, respostas rápidas com link de compra).
4. THE Comando_Promocoes SHALL utilizar SkyScrapper e FlightAPI como fallback em comandos interativos (50 requests/mês cada, dados precisos).
5. WHILE o Cron_Job está executando, THE Rate_Limiter SHALL reservar uma quota mínima de requisições para comandos interativos.
6. THE Sistema SHALL configurar a alocação de providers via Provider_Registry sem necessidade de alterar código.

### Requisito 9: Integração com IA para Análise de Valor por Provider

**User Story:** Como usuário, quero que após cada busca de provider o sistema use IA para analisar se a viagem com aquele valor está valendo a pena ou não, para que eu tenha uma recomendação inteligente antes de comprar.

#### Critérios de Aceitação

1. WHEN um provider retorna resultados de voos, THE FlightAnalysisService SHALL analisar cada promoção retornada para determinar se o valor está valendo a pena.
2. THE FlightAnalysisService SHALL considerar preço, destino, época do ano e histórico de preços na análise de valor.
3. THE PromoEmbed SHALL exibir o resultado da análise de IA em um campo dedicado no embed de resultado.
4. IF o FlightAnalysisService estiver indisponível (sem chave, quota esgotada, erro), THEN THE Sistema SHALL exibir uma mensagem informativa no campo de análise e continuar exibindo a promoção normalmente.
5. WHEN o Cron_Job encontra promoções, THE FlightAnalysisService SHALL analisar as promoções antes de enviá-las aos canais.
6. THE FlightAnalysisService SHALL processar análises em lote (batch) para economizar tokens e requisições à API de IA.

### Requisito 10: Links de Compra Seguros via Google Flights

**User Story:** Como usuário, quero que o embed de promoção me direcione para sites seguros de compra (preferencialmente Google Flights), para que eu possa comprar com confiança.

#### Critérios de Aceitação

1. THE PromoEmbed SHALL utilizar a URL do Google Flights como link principal de compra no título do embed.
2. THE Sistema SHALL gerar URLs do Google Flights utilizando o utilitário `googleFlights.ts` com os parâmetros corretos (origem, destino, data de ida, data de volta).
3. WHEN a promoção possui `googleFlightsUrl` preenchida, THE PromoEmbed SHALL usar essa URL como link clicável no título do embed.
4. THE URL do Google Flights SHALL conter os parâmetros de voo corretos: aeroporto de origem, aeroporto de destino, data de ida e data de volta (quando aplicável).
5. IF a URL do Google Flights não puder ser gerada, THEN THE PromoEmbed SHALL utilizar o `bookingUrl` do provider como fallback.
6. THE PromoEmbed SHALL exibir no footer uma indicação de que o link direciona para o Google Flights (site seguro de comparação de preços).
