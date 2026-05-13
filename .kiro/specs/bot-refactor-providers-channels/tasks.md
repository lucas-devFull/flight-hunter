# Plano de Implementação: Refatoração de Providers e Canais

## Visão Geral

Implementação incremental da refatoração: novos serviços centralizados (ProviderRegistry, RateLimiter, ChannelRouter, DateFallbackService), refatoração do PromotionService e comando `/promocoes`, remoção de comandos individuais, atualização de embeds e jobs, e testes de propriedade com fast-check.

## Tarefas

- [x] 1. Configurar infraestrutura de testes e dependências
  - [x] 1.1 Instalar fast-check e vitest como devDependencies
    - Adicionar `fast-check`, `vitest`, e `@vitest/coverage-v8` ao package.json
    - Criar `vitest.config.ts` com path aliases compatíveis com tsconfig.paths.json
    - Criar script `"test": "vitest --run"` no package.json
    - _Requisitos: Design — Estratégia de Testes_

  - [x] 1.2 Criar estrutura de diretórios de teste
    - Criar `src/__tests__/services/` e `src/__tests__/commands/` e `src/__tests__/embeds/`
    - _Requisitos: Design — Estrutura de Arquivos de Teste_

- [x] 2. Implementar ProviderRegistry
  - [x] 2.1 Criar interface ProviderConfig e classe ProviderRegistry
    - Criar `src/services/ProviderRegistry.ts`
    - Implementar interface `ProviderConfig` com campos: name, priority, provider, allocation, limits
    - Implementar `getProviders(context)` que retorna providers filtrados e ordenados por prioridade
    - Implementar `getByName(name)` e `getAll()`
    - _Requisitos: 1.1, 8.1, 8.2, 8.3, 8.4, 8.6_

  - [x] 2.2 Teste de propriedade — Ordenação do Registry por Prioridade
    - **Propriedade 1: Ordenação do Registry por Prioridade**
    - Gerar configs com prioridades aleatórias, verificar que `getProviders()` retorna em ordem crescente
    - **Valida: Requisito 1.1**

  - [x] 2.3 Testes unitários do ProviderRegistry
    - Testar configuração padrão com 5 providers
    - Testar filtro por contexto `cron` (retorna apenas Aviasales e Serper)
    - Testar filtro por contexto `interactive` (retorna todos exceto os exclusivos de cron)
    - _Requisitos: 1.1, 8.1, 8.2, 8.3, 8.4_

- [x] 3. Implementar RateLimiter
  - [x] 3.1 Criar classe RateLimiter
    - Criar `src/services/RateLimiter.ts`
    - Implementar interface `ProviderUsage` com campos: name, used, limit, remaining, available, cycle, resetAt
    - Implementar `isAvailable(providerName, context)` com lógica de reserva de quota
    - Implementar `consume(providerName)` para registrar uso
    - Implementar `getUsage()` e `getProviderUsage(providerName)`
    - Implementar reset automático por ciclo (diário/mensal)
    - _Requisitos: 1.2, 1.3, 1.5, 1.7, 8.5_

  - [x] 3.2 Teste de propriedade — Invariante de Requisições Restantes
    - **Propriedade 2: Invariante de Requisições Restantes**
    - Gerar sequências de `consume()`, verificar `remaining = limit - used`
    - **Valida: Requisitos 1.2, 1.7**

  - [x] 3.3 Teste de propriedade — Indisponibilidade Após Limite
    - **Propriedade 3: Indisponibilidade Após Limite**
    - Gerar limites aleatórios, consumir exatamente N vezes, verificar `isAvailable() = false`
    - **Valida: Requisito 1.3**

  - [x] 3.4 Teste de propriedade — Reset de Ciclo Restaura Disponibilidade
    - **Propriedade 5: Reset de Ciclo Restaura Disponibilidade**
    - Simular passagem de tempo além do ciclo, verificar que disponibilidade é restaurada
    - **Valida: Requisito 1.5**

  - [x] 3.5 Teste de propriedade — Reserva de Quota para Comandos Interativos
    - **Propriedade 15: Reserva de Quota para Comandos Interativos**
    - Gerar configs com reserva R, verificar threshold diferente por contexto
    - **Valida: Requisito 8.5**

  - [x] 3.6 Testes unitários do RateLimiter
    - Testar edge case de reset no limite exato do ciclo
    - Testar comportamento com 0 requests restantes
    - Testar que cron não consome quota reservada para interativo
    - _Requisitos: 1.2, 1.3, 1.5, 1.7, 8.5_

- [x] 4. Checkpoint — Verificar que ProviderRegistry e RateLimiter passam nos testes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implementar ChannelRouter
  - [x] 5.1 Criar classe ChannelRouter
    - Criar `src/services/ChannelRouter.ts`
    - Implementar tipo `RoutableChannel = 'geral' | 'international' | 'brazil' | 'crazy'`
    - Implementar `route(promotion)` que retorna canais de destino
    - Implementar `filterForChannel(channel, promotions)`
    - Implementar lógica: origem BR + destino fora BR = international; ambos BR = brazil; sempre inclui geral
    - Utilizar set de códigos brasileiros para classificação
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 5.2 Teste de propriedade — Canal Geral Recebe Todas as Promoções
    - **Propriedade 7: Canal Geral Recebe Todas as Promoções**
    - Gerar promoções aleatórias, verificar que `route()` sempre inclui `'geral'`
    - **Valida: Requisitos 2.1, 2.5**

  - [x] 5.3 Teste de propriedade — Roteamento Internacional Correto
    - **Propriedade 8: Roteamento Internacional Correto**
    - Gerar promoções com destinos variados, verificar classificação correta
    - **Valida: Requisito 2.2**

  - [x] 5.4 Teste de propriedade — Roteamento Brasil Correto
    - **Propriedade 9: Roteamento Brasil Correto**
    - Gerar promoções domésticas e internacionais, verificar classificação
    - **Valida: Requisito 2.3**

  - [x] 5.5 Testes unitários do ChannelRouter
    - Testar exemplos específicos: GRU→LIS = international+geral, GRU→REC = brazil+geral
    - Testar promoção com `isCrazyDeal = true` inclui `'crazy'`
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6. Implementar DateFallbackService
  - [x] 6.1 Criar classe DateFallbackService
    - Criar `src/services/DateFallbackService.ts`
    - Implementar interface `DateFallbackResult` com campos: departureDate, returnDate, departureFallback, returnFallback
    - Implementar `resolve(params)` com lógica de fallback
    - Gerar data de ida entre 30-90 dias à frente quando não informada e provider exige
    - Gerar data de volta entre 7-14 dias após ida quando não informada e provider exige
    - Preservar datas informadas pelo usuário
    - _Requisitos: 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 6.2 Teste de propriedade — Fallback de Data de Ida no Intervalo Correto
    - **Propriedade 12: Fallback de Data de Ida no Intervalo Correto**
    - Verificar que data gerada está entre 30 e 90 dias à frente
    - **Valida: Requisitos 5.3, 6.2**

  - [x] 6.3 Teste de propriedade — Fallback de Data de Volta no Intervalo Correto
    - **Propriedade 13: Fallback de Data de Volta no Intervalo Correto**
    - Verificar que data de volta está entre D+7 e D+14
    - **Valida: Requisitos 5.4, 6.4**

  - [x] 6.4 Teste de propriedade — Datas Informadas São Preservadas
    - **Propriedade 14: Datas Informadas São Preservadas**
    - Gerar datas válidas, verificar que `resolve()` retorna a mesma data com fallback=false
    - **Valida: Requisitos 6.1, 6.3**

  - [x] 6.5 Testes unitários do DateFallbackService
    - Testar datas no limite (hoje + 30, hoje + 90)
    - Testar formato inválido de data
    - Testar que `departureFallback` e `returnFallback` são corretos
    - _Requisitos: 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 7. Checkpoint — Verificar que ChannelRouter e DateFallbackService passam nos testes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Refatorar PromotionService com busca sequencial
  - [x] 8.1 Atualizar PromotionService para usar ProviderRegistry e RateLimiter
    - Alterar construtor para receber `ProviderRegistry`, `RateLimiter`, `DateFallbackService`
    - Implementar busca sequencial: iterar providers na ordem, parar ao obter resultados
    - Após obter resultados, chamar `FlightAnalysisService.analyzePromotions()` para análise de valor
    - Retornar `PromotionResult` com `providerUsed`, `datesUsed`, `allProvidersExhausted`
    - Chamar `rateLimiter.consume()` após cada consulta
    - Retornar mensagem de erro quando todos providers esgotados
    - _Requisitos: 1.4, 1.6, 5.5, 5.6, 8.1, 8.2, 8.3, 8.4, 9.1, 9.6_

  - [x] 8.2 Teste de propriedade — Busca Sequencial Para no Primeiro Sucesso
    - **Propriedade 4: Busca Sequencial Para no Primeiro Sucesso**
    - Gerar listas de providers com mock, verificar que apenas providers até K são consultados
    - **Valida: Requisitos 1.4, 5.5, 5.6**

  - [x] 8.3 Teste de propriedade — Todos Esgotados Retorna Erro
    - **Propriedade 6: Todos Esgotados Retorna Erro**
    - Gerar registry com todos no limite, verificar `allProvidersExhausted = true`
    - **Valida: Requisito 1.6**

  - [x] 8.4 Testes unitários do PromotionService refatorado
    - Testar fluxo completo com mock de providers
    - Testar que provider indisponível é pulado
    - Testar integração com DateFallbackService
    - _Requisitos: 1.4, 1.6, 5.5, 5.6_

- [x] 9. Atualizar configuração de origens e tipos
  - [x] 9.1 Adicionar PREDEFINED_ORIGINS e validação em src/config/flight.ts
    - Adicionar constante `PREDEFINED_ORIGINS = ['GRU', 'GIG', 'VCP', 'BSB', 'CNF', 'CGH', 'SDU', 'CWB']`
    - Adicionar tipo `PredefinedOrigin`
    - Adicionar função `isPredefinedOrigin(code: string): boolean` (case-insensitive)
    - Atualizar `PromotionChannelKey` para incluir `'geral'`
    - _Requisitos: 3.1, 3.2, 3.4_

  - [x] 9.2 Teste de propriedade — Validação de Origem
    - **Propriedade 10: Validação de Origem**
    - Gerar strings aleatórias e códigos válidos, verificar aceitação/rejeição
    - **Valida: Requisitos 3.1, 3.2**

  - [x] 9.3 Teste de propriedade — Filtro de Escalas Máximas
    - **Propriedade 11: Filtro de Escalas Máximas**
    - Gerar listas com stops variados e limites aleatórios, verificar filtro correto
    - **Valida: Requisito 4.2**

- [x] 10. Refatorar comando /promocoes
  - [x] 10.1 Reescrever src/commands/promocoes.ts com novos parâmetros
    - Parâmetros: `origem` (obrigatório, choices de PREDEFINED_ORIGINS), `destino` (obrigatório, código IATA)
    - Parâmetros opcionais: `data_ida`, `data_volta` (YYYY-MM-DD), `escalas_max` (0-3)
    - Usar `DateFallbackService` para resolver datas
    - Usar `PromotionService` refatorado com `context: 'interactive'`
    - Chamar `FlightAnalysisService.analyzePromotions()` e passar resultado para o embed
    - Usar `googleFlightsUrl` como link principal no embed (Google Flights)
    - Informar ao usuário qual data foi utilizada (informada ou gerada)
    - Filtrar por `escalas_max` se informado
    - Exibir informações de escala (quantidade e cidades) nos resultados
    - _Requisitos: 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.5, 9.1, 9.3, 10.1, 10.3_

- [x] 11. Remover comandos individuais de provider
  - [x] 11.1 Remover /kiwi, /sky, /flightapi e atualizar registros
    - Deletar `src/commands/kiwi.ts`
    - Deletar `src/commands/sky.ts`
    - Deletar `src/commands/flightapi.ts`
    - Atualizar `src/commands/index.ts` removendo imports e referências
    - _Requisitos: 5.7_

- [x] 12. Checkpoint — Verificar que comando /promocoes e remoções compilam corretamente
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Refatorar PromoJob para usar novos serviços
  - [x] 13.1 Atualizar src/jobs/promoJob.ts
    - Usar `ProviderRegistry` com `context: 'cron'` para obter providers alocados
    - Usar `RateLimiter` para verificar quotas (respeitando reserva para interativo)
    - Usar `ChannelRouter` para classificar promoções e enviar para canais corretos
    - Chamar `FlightAnalysisService.analyzePromotions()` antes de enviar promoções aos canais
    - Incluir análise de IA no embed enviado ao canal
    - Incluir voos com escalas nos resultados enviados
    - Enviar para canal `geral` além dos canais específicos
    - _Requisitos: 2.4, 4.4, 8.1, 8.2, 8.5, 9.5_

- [x] 14. Atualizar embeds
  - [x] 14.1 Atualizar GuideEmbed com informações de datas e canais
    - Adicionar seção explicando que `origem` e `destino` são obrigatórios
    - Adicionar seção explicando que `data_ida` e `data_volta` são opcionais
    - Explicar mecanismo de fallback (30-90 dias ida, 7-14 dias volta)
    - Mostrar exemplos de uso com e sem datas
    - Listar canais e explicar separação (geral, internacional, brasil)
    - Remover referências aos comandos `/kiwi`, `/sky`, `/flightapi`
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 14.2 Atualizar PromoEmbed para priorizar Google Flights e exibir análise IA
    - Alterar lógica de URL: usar `googleFlightsUrl` como link principal, `bookingUrl` como fallback
    - Atualizar footer para indicar que o link direciona para Google Flights (site seguro)
    - Garantir que o campo `🤖 Análise IA` exibe o resultado do FlightAnalysisService
    - Adicionar indicação visual quando data foi gerada por fallback (ex: "📅 Data gerada automaticamente")
    - Manter exibição de escalas e cidades de conexão (já existente)
    - _Requisitos: 6.5, 4.1, 4.3, 9.3, 9.4, 10.1, 10.3, 10.5, 10.6_

  - [x] 14.3 Teste de propriedade — Google Flights URL como Link Principal
    - **Propriedade 17: Google Flights URL como Link Principal**
    - Gerar promoções com e sem `googleFlightsUrl`, verificar que embed usa a URL correta
    - **Valida: Requisitos 10.1, 10.3, 10.5**

  - [x] 14.4 Teste de propriedade — Parâmetros Corretos na URL do Google Flights
    - **Propriedade 18: Parâmetros Corretos na URL do Google Flights**
    - Gerar promoções com origens, destinos e datas variadas, verificar que `buildGoogleFlightsUrl` gera URL com parâmetros corretos
    - **Valida: Requisitos 10.2, 10.4**

- [x] 15. Atualizar NotificationService para canal geral
  - [x] 15.1 Adicionar suporte ao canal 'geral' no NotificationService
    - Atualizar tipo `AlertChannelKey` para incluir `'geral'`
    - Adicionar env var `DISCORD_CHANNEL_GERAL_ID` no schema de env
    - Atualizar `DISCORD_CHANNELS` em flight.ts com entrada para `geral`
    - _Requisitos: 2.1, 2.5_

- [x] 16. Atualizar providerFactory para integrar com ProviderRegistry
  - [x] 16.1 Refatorar src/providers/providerFactory.ts
    - Criar função `createProviderRegistry()` que instancia `ProviderRegistry` com configs padrão
    - Manter compatibilidade: instanciar providers com base nas env vars disponíveis
    - Exportar instância singleton do registry para uso no PromotionService e PromoJob
    - _Requisitos: 8.6_

- [x] 17. Checkpoint — Verificar integração completa
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Testes de integração finais
  - [x] 18.1 Teste de integração do fluxo completo do comando /promocoes
    - Mock de providers, verificar busca sequencial, fallback de datas, filtro de escalas
    - Verificar que FlightAnalysisService é chamado após obter resultados
    - Verificar que análise IA aparece no embed
    - _Requisitos: 1.4, 5.5, 5.6, 6.2, 6.4, 4.2, 9.1, 9.3_

  - [x] 18.2 Teste de integração do PromoJob com ChannelRouter
    - Verificar que promoções são enviadas para canais corretos
    - Verificar que canal geral recebe todas as promoções
    - Verificar que análise IA é incluída nos embeds do cron
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 9.5_

  - [x] 18.3 Teste de propriedade — Análise de IA Executada para Cada Resultado
    - **Propriedade 16: Análise de IA Executada para Cada Resultado de Provider**
    - Gerar listas de promoções, verificar que `analyzePromotions` retorna Map com entrada para cada uma
    - **Valida: Requisitos 9.1, 9.3, 9.4**

  - [x] 18.4 Teste unitário — PromoEmbed com Google Flights URL
    - Verificar que embed usa `googleFlightsUrl` como link principal
    - Verificar fallback para `bookingUrl` quando `googleFlightsUrl` está vazio
    - Verificar footer indica Google Flights
    - _Requisitos: 10.1, 10.3, 10.5, 10.6_

- [x] 19. Checkpoint final — Garantir que todos os testes passam e o build compila
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude (fast-check)
- Testes unitários validam exemplos específicos e edge cases
