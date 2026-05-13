# Design — Refatoração de Providers e Canais

## Visão Geral

Esta refatoração introduz um sistema centralizado de rate limiting com registro ordenado de providers, roteamento de promoções por canal (geral, internacional, brasil), um comando unificado `/promocoes` com busca sequencial por prioridade, sistema de fallback de datas, e alocação inteligente de providers entre cron jobs e comandos interativos.

A arquitetura atual possui providers independentes com rate limiting interno, comandos separados por provider (`/kiwi`, `/sky`, `/flightapi`), e lógica de canal dispersa. A refatoração centraliza essas responsabilidades em módulos dedicados.

## Arquitetura

```mermaid
graph TD
    subgraph "Camada de Comandos"
        CMD["/promocoes (unificado)"]
        GUIDE["/guide (atualizado)"]
    end

    subgraph "Camada de Serviços"
        PS[PromotionService]
        RL[RateLimiter]
        PR[ProviderRegistry]
        CR[ChannelRouter]
        DF[DateFallbackService]
    end

    subgraph "Camada de Providers"
        AV[AviasalesProvider]
        KW[KiwiProvider]
        SK[SkyScrapperProvider]
        FA[FlightApiProvider]
        SP[SerperProvider]
    end

    subgraph "Camada de Jobs"
        CJ[PromoJob (cron)]
    end

    subgraph "Canais Discord"
        CG[#geral]
        CI[#internacional]
        CB[#brasil]
        CM[#voos-malucos]
    end

    CMD --> PS
    CMD --> DF
    PS --> PR
    PS --> RL
    PR --> AV & KW & SK & FA & SP
    RL --> AV & KW & SK & FA & SP
    CJ --> PS
    CJ --> CR
    PS --> CR
    CR --> CG & CI & CB & CM
    GUIDE -.-> CMD
```

### Fluxo Principal — Comando Interativo

1. Usuário executa `/promocoes` com parâmetros (origem, destino, datas opcionais)
2. `DateFallbackService` gera datas se necessário
3. `PromotionService` consulta `ProviderRegistry` para obter a lista ordenada
4. Para cada provider na ordem, `RateLimiter` verifica disponibilidade
5. Primeiro provider disponível é consultado; se retorna resultados, para
6. Se não retorna, avança para o próximo provider
7. `ChannelRouter` classifica resultados e retorna ao usuário

### Fluxo Principal — Cron Job

1. `PromoJob` dispara no intervalo configurado
2. `ProviderRegistry` retorna providers alocados para cron (Aviasales, Serper)
3. `RateLimiter` verifica quotas reservando mínimo para comandos interativos
4. Resultados são classificados pelo `ChannelRouter`
5. `NotificationService` envia para canais apropriados

## Componentes e Interfaces

### ProviderRegistry

Responsável por manter a lista ordenada de providers e sua alocação (cron vs interativo).

```typescript
// src/services/ProviderRegistry.ts

export interface ProviderConfig {
  name: string;
  priority: number; // menor = maior prioridade
  provider: FlightProvider;
  allocation: 'cron' | 'interactive' | 'both';
  limits: {
    maxRequests: number;
    cycle: 'daily' | 'monthly';
    reservedForInteractive: number; // quota mínima reservada
  };
}

export class ProviderRegistry {
  private readonly providers: ProviderConfig[];

  constructor(configs: ProviderConfig[]);

  /** Retorna providers ordenados por prioridade para o contexto dado */
  getProviders(context: 'cron' | 'interactive'): ProviderConfig[];

  /** Retorna um provider específico pelo nome */
  getByName(name: string): ProviderConfig | undefined;

  /** Retorna todos os providers registrados */
  getAll(): readonly ProviderConfig[];
}
```

### RateLimiter

Controla requisições por provider, reseta contadores conforme ciclo, e reserva quotas.

```typescript
// src/services/RateLimiter.ts

export interface ProviderUsage {
  name: string;
  used: number;
  limit: number;
  remaining: number;
  available: boolean;
  cycle: 'daily' | 'monthly';
  resetAt: Date;
}

export class RateLimiter {
  constructor(registry: ProviderRegistry);

  /** Verifica se o provider pode receber requisição */
  isAvailable(providerName: string, context: 'cron' | 'interactive'): boolean;

  /** Registra uma requisição consumida */
  consume(providerName: string): void;

  /** Retorna uso atual de todos os providers */
  getUsage(): ProviderUsage[];

  /** Retorna uso de um provider específico */
  getProviderUsage(providerName: string): ProviderUsage | undefined;

  /** Reseta contadores conforme ciclo (chamado internamente) */
  private resetIfNeeded(providerName: string): void;
}
```

### ChannelRouter

Classifica promoções e determina para quais canais devem ser enviadas.

```typescript
// src/services/ChannelRouter.ts

import type { FlightPromotion } from '@flight-types/FlightPromotion';

export type RoutableChannel = 'geral' | 'international' | 'brazil' | 'crazy';

export class ChannelRouter {
  /** Classifica uma promoção e retorna os canais de destino */
  route(promotion: FlightPromotion): RoutableChannel[];

  /** Filtra promoções para um canal específico */
  filterForChannel(channel: RoutableChannel, promotions: FlightPromotion[]): FlightPromotion[];

  /** Determina se um voo é doméstico (origem e destino no Brasil) */
  private isDomestic(promotion: FlightPromotion): boolean;

  /** Determina se um voo é internacional (origem BR, destino fora) */
  private isInternational(promotion: FlightPromotion): boolean;
}
```

### DateFallbackService

Gera datas de fallback quando o provider exige mas o usuário não informou.

```typescript
// src/services/DateFallbackService.ts

export interface DateFallbackResult {
  departureDate: string;
  returnDate: string | null;
  departureFallback: boolean; // true se foi gerada
  returnFallback: boolean;    // true se foi gerada
}

export class DateFallbackService {
  /**
   * Resolve datas para busca.
   * Se data_ida não informada: gera entre 30-90 dias à frente.
   * Se data_volta não informada e provider exige: gera 7-14 dias após ida.
   */
  resolve(params: {
    departureDate?: string | null;
    returnDate?: string | null;
    providerRequiresDate: boolean;
    providerRequiresReturn: boolean;
  }): DateFallbackResult;

  /** Gera data futura aleatória entre minDays e maxDays */
  private generateFutureDate(minDays: number, maxDays: number): string;
}
```

### PromotionService (refatorado)

Orquestra a busca sequencial por providers.

```typescript
// src/services/PromotionService.ts (alterações)

export class PromotionService {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly rateLimiter: RateLimiter,
    private readonly dateFallback: DateFallbackService,
  );

  /**
   * Busca promoções consultando providers na ordem de prioridade.
   * Para ao obter resultados suficientes do primeiro provider disponível.
   */
  async findPromotions(criteria: PromotionSearchCriteria & {
    context: 'cron' | 'interactive';
  }): Promise<PromotionResult>;
}

export interface PromotionResult {
  promotions: FlightPromotion[];
  providerUsed: string;
  datesUsed: DateFallbackResult;
  allProvidersExhausted: boolean;
}
```

### Comando /promocoes (refatorado)

```typescript
// src/commands/promocoes.ts — parâmetros atualizados

// Parâmetros:
// - origem: string (obrigatório, choices da lista Origem_Predefinida)
// - destino: string (obrigatório, código IATA ou cidade)
// - data_ida: string (opcional, YYYY-MM-DD)
// - data_volta: string (opcional, YYYY-MM-DD)
// - escalas_max: integer (opcional, 0-3)
```

## Modelos de Dados

### ProviderConfig (configuração estática)

```typescript
// Configuração padrão do registry
const DEFAULT_PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    name: 'Aviasales',
    priority: 1,
    allocation: 'both',
    limits: { maxRequests: 1000, cycle: 'daily', reservedForInteractive: 100 },
  },
  {
    name: 'Kiwi',
    priority: 2,
    allocation: 'interactive',
    limits: { maxRequests: 300, cycle: 'monthly', reservedForInteractive: 200 },
  },
  {
    name: 'SkyScrapper',
    priority: 3,
    allocation: 'interactive',
    limits: { maxRequests: 50, cycle: 'monthly', reservedForInteractive: 30 },
  },
  {
    name: 'FlightAPI',
    priority: 4,
    allocation: 'interactive',
    limits: { maxRequests: 50, cycle: 'monthly', reservedForInteractive: 30 },
  },
  {
    name: 'Serper',
    priority: 5,
    allocation: 'both',
    limits: { maxRequests: 80, cycle: 'daily', reservedForInteractive: 20 },
  },
];
```

### ProviderUsageState (estado em memória)

```typescript
interface ProviderUsageState {
  providerName: string;
  requestsUsed: number;
  cycleStart: number; // timestamp do início do ciclo atual
  rateLimitedUntil: number; // timestamp até quando está bloqueado (429)
}
```

### ChannelRouting (tipo expandido)

```typescript
// Atualização do tipo PromotionChannelKey em src/config/flight.ts
export type PromotionChannelKey = 'geral' | 'international' | 'brazil' | 'crazy';

// Atualização do DISCORD_CHANNELS
export const DISCORD_CHANNELS = {
  geral: { name: 'geral', label: '#geral' },
  international: { name: 'internacional', label: '#internacional' },
  brazil: { name: 'brasil', label: '#brasil' },
  crazy: { name: 'voos-malucos', label: '#voos-malucos' },
  // ... canais de datas permanecem
} as const;
```

### FlightPromotion (sem alteração estrutural)

O tipo `FlightPromotion` existente já suporta `stopoverCities`, `stops`, e `channels`. A única mudança é que `channels` agora pode incluir `'geral'`.

### Origem_Predefinida (constante)

```typescript
// src/config/flight.ts — origens válidas para o comando
export const PREDEFINED_ORIGINS = ['GRU', 'GIG', 'VCP', 'BSB', 'CNF', 'CGH', 'SDU', 'CWB'] as const;
export type PredefinedOrigin = typeof PREDEFINED_ORIGINS[number];
```



## Propriedades de Corretude

*Uma propriedade é uma característica ou comportamento que deve ser verdadeiro em todas as execuções válidas de um sistema — essencialmente, uma declaração formal sobre o que o sistema deve fazer. Propriedades servem como ponte entre especificações legíveis por humanos e garantias de corretude verificáveis por máquina.*

### Propriedade 1: Ordenação do Registry por Prioridade

*Para qualquer* configuração válida do ProviderRegistry, o método `getProviders()` deve retornar providers ordenados pelo campo `priority` em ordem crescente (menor número = maior prioridade).

**Validates: Requirements 1.1**

### Propriedade 2: Invariante de Requisições Restantes

*Para qualquer* provider com limite L e após U chamadas a `consume()`, o valor retornado por `getProviderUsage().remaining` deve ser igual a L - U, e `getProviderUsage().used` deve ser igual a U.

**Validates: Requirements 1.2, 1.7**

### Propriedade 3: Indisponibilidade Após Limite

*Para qualquer* provider com limite N, após exatamente N chamadas a `consume()`, `isAvailable()` deve retornar `false`. Para qualquer número de chamadas menor que N, `isAvailable()` deve retornar `true`.

**Validates: Requirements 1.3**

### Propriedade 4: Busca Sequencial Para no Primeiro Sucesso

*Para qualquer* lista ordenada de providers onde o provider na posição K retorna resultados válidos, apenas os providers nas posições 0 até K (inclusive) devem ser consultados. Providers nas posições K+1 em diante não devem receber chamadas.

**Validates: Requirements 1.4, 5.5, 5.6**

### Propriedade 5: Reset de Ciclo Restaura Disponibilidade

*Para qualquer* provider que atingiu seu limite (isAvailable = false), após avançar o tempo além do fim do ciclo (dia para Serper, mês para os demais), `isAvailable()` deve retornar `true` e `remaining` deve ser igual ao limite máximo.

**Validates: Requirements 1.5**

### Propriedade 6: Todos Esgotados Retorna Erro

*Para qualquer* conjunto de providers onde todos possuem `used >= limit`, a busca deve retornar `allProvidersExhausted = true` e uma lista vazia de promoções.

**Validates: Requirements 1.6**

### Propriedade 7: Canal Geral Recebe Todas as Promoções

*Para qualquer* promoção válida (doméstica ou internacional), o resultado de `ChannelRouter.route()` deve sempre incluir `'geral'` na lista de canais.

**Validates: Requirements 2.1, 2.5**

### Propriedade 8: Roteamento Internacional Correto

*Para qualquer* promoção onde a origem está no Brasil e o destino está fora do Brasil, `ChannelRouter.route()` deve incluir `'international'`. Para qualquer promoção onde o destino está dentro do Brasil, `route()` não deve incluir `'international'`.

**Validates: Requirements 2.2**

### Propriedade 9: Roteamento Brasil Correto

*Para qualquer* promoção onde tanto a origem quanto o destino estão dentro do Brasil, `ChannelRouter.route()` deve incluir `'brazil'`. Para qualquer promoção onde o destino está fora do Brasil, `route()` não deve incluir `'brazil'`.

**Validates: Requirements 2.3**

### Propriedade 10: Validação de Origem

*Para qualquer* string que pertence à lista `PREDEFINED_ORIGINS`, a validação deve aceitar. Para qualquer string que não pertence à lista, a validação deve rejeitar. A validação deve ser case-insensitive.

**Validates: Requirements 3.1, 3.2**

### Propriedade 11: Filtro de Escalas Máximas

*Para qualquer* lista de promoções e qualquer valor `escalas_max = N`, o resultado filtrado deve conter apenas promoções onde `stops <= N`. Nenhuma promoção com `stops > N` deve aparecer no resultado.

**Validates: Requirements 4.2**

### Propriedade 12: Fallback de Data de Ida no Intervalo Correto

*Para qualquer* chamada a `DateFallbackService.resolve()` sem `departureDate` e com `providerRequiresDate = true`, a data gerada deve estar entre 30 e 90 dias a partir da data atual, e `departureFallback` deve ser `true`.

**Validates: Requirements 5.3, 6.2**

### Propriedade 13: Fallback de Data de Volta no Intervalo Correto

*Para qualquer* data de ida D e chamada a `resolve()` sem `returnDate` e com `providerRequiresReturn = true`, a data de volta gerada deve estar entre D+7 e D+14 dias, e `returnFallback` deve ser `true`.

**Validates: Requirements 5.4, 6.4**

### Propriedade 14: Datas Informadas São Preservadas

*Para qualquer* data válida fornecida pelo usuário como `departureDate` ou `returnDate`, o `DateFallbackService.resolve()` deve retornar exatamente a mesma data, com `departureFallback = false` e/ou `returnFallback = false` respectivamente.

**Validates: Requirements 6.1, 6.3**

### Propriedade 15: Reserva de Quota para Comandos Interativos

*Para qualquer* provider com limite L e `reservedForInteractive = R`, quando o contexto é `'cron'`, `isAvailable()` deve retornar `false` quando `used >= L - R`. Quando o contexto é `'interactive'`, `isAvailable()` deve retornar `false` apenas quando `used >= L`.

**Validates: Requirements 8.5**

## Tratamento de Erros

### Integração com IA (FlightAnalysisService)

O `FlightAnalysisService` já existe e é invocado após cada busca de provider para analisar se as promoções encontradas valem a pena. A integração ocorre em dois pontos:

1. **Comando interativo (`/promocoes`)**: Após obter resultados do provider, chama `analysisService.analyzePromotions(promotions)` e passa o resultado para o `PromoEmbed`.
2. **Cron Job**: Antes de enviar promoções aos canais, chama `analysisService.analyzePromotions(promotions)` para incluir a análise no embed.

```typescript
// Fluxo no PromotionService / comando
const promotions = await provider.fetchPromotions(criteria);
const analyses = await analysisService.analyzePromotions(promotions);
// analyses: Map<string, string> — id da promoção → texto da análise

// No embed
buildPromotionEmbed(promotion, analyses.get(promotion.id));
```

O `FlightAnalysisService` já implementa:
- Análise em lote (batch) para economizar tokens
- Fallback com mensagem informativa quando indisponível (quota, rate limit, chave inválida)
- Consideração de preço, destino, época e mercado brasileiro

Nenhuma alteração estrutural é necessária no `FlightAnalysisService`. A integração já existe no comando `/promocoes` atual. O que precisa ser garantido:
- O `PromoJob` (cron) também deve chamar `analyzePromotions` antes de enviar aos canais
- O campo `🤖 Análise IA` no `PromoEmbed` já existe e recebe o parâmetro `aiAnalysis`

### Links de Compra Seguros (Google Flights)

O utilitário `buildGoogleFlightsUrl` em `src/utils/googleFlights.ts` já gera URLs corretas do Google Flights com protobuf codificado em Base64. Todos os providers já populam o campo `googleFlightsUrl` na `FlightPromotion`.

A alteração necessária no `PromoEmbed`:
- O link principal (título do embed via `.setURL()`) deve **sempre** usar `googleFlightsUrl` como prioridade
- O `bookingUrl` do provider serve apenas como fallback caso `googleFlightsUrl` esteja vazio
- O footer deve indicar claramente que o link direciona para o Google Flights

```typescript
// PromoEmbed — lógica de URL atualizada
const mainUrl = promotion.googleFlightsUrl || promotion.bookingUrl || '';
const footerText = promotion.googleFlightsUrl
  ? 'Clique no título para ver no Google Flights (site seguro) | Preço pode variar'
  : 'Clique no título para ver no site do provider | Preço pode variar';
```

Validação dos parâmetros na URL:
- `origin`: código IATA do aeroporto de origem
- `destinationCode`: código IATA do aeroporto de destino
- `departureDate`: data de ida no formato YYYY-MM-DD
- `returnDate`: data de volta no formato YYYY-MM-DD (quando aplicável)

## Propriedades de Corretude Adicionais

### Propriedade 16: Análise de IA Executada para Cada Resultado de Provider

*Para qualquer* conjunto de promoções retornado por um provider, o `FlightAnalysisService.analyzePromotions()` deve ser chamado e retornar um `Map` com uma entrada para cada promoção (mesmo que seja mensagem de indisponibilidade).

**Validates: Requirements 9.1, 9.3, 9.4**

### Propriedade 17: Google Flights URL como Link Principal

*Para qualquer* promoção com `googleFlightsUrl` preenchida, o embed deve usar essa URL como link principal (`.setURL()`). Apenas quando `googleFlightsUrl` está vazia, o `bookingUrl` deve ser usado como fallback.

**Validates: Requirements 10.1, 10.3, 10.5**

### Propriedade 18: Parâmetros Corretos na URL do Google Flights

*Para qualquer* promoção com origem, destino e datas válidas, a URL gerada por `buildGoogleFlightsUrl` deve conter os códigos IATA de origem e destino e as datas no formato correto, decodificáveis do parâmetro `tfs`.

**Validates: Requirements 10.2, 10.4**

## Tratamento de Erros

### Erros de Rate Limiting

| Cenário | Comportamento |
|---------|--------------|
| Provider retorna HTTP 429 | Marca provider como indisponível por 60s, avança para próximo |
| Provider retorna HTTP 401/403 | Marca provider como indisponível por 1h (chave inválida) |
| Todos providers esgotados | Retorna mensagem amigável ao usuário |
| Timeout de rede | Log de erro, avança para próximo provider |

### Erros de Validação

| Cenário | Comportamento |
|---------|--------------|
| Origem inválida | Rejeita com mensagem listando origens válidas |
| Data em formato inválido | Rejeita com mensagem de formato esperado (YYYY-MM-DD) |
| Data no passado | Rejeita com mensagem informando que a data deve ser futura |
| escalas_max < 0 | Discord valida via MinValue(0) |

### Erros de Provider

| Cenário | Comportamento |
|---------|--------------|
| Provider retorna dados malformados | Log de warning, trata como "sem resultados", avança |
| Provider lança exceção | Captura, log de error, avança para próximo |
| Nenhum resultado de nenhum provider | Mensagem ao usuário sugerindo tentar mais tarde |

## Estratégia de Testes

### Testes Unitários

Testes unitários focam em exemplos específicos, edge cases e integrações:

- **ProviderRegistry**: Verificar configuração padrão, filtro por contexto (cron/interactive)
- **RateLimiter**: Edge cases de reset no limite exato do ciclo, comportamento com 0 requests
- **ChannelRouter**: Exemplos específicos (GRU→LIS = international, GRU→REC = brazil)
- **DateFallbackService**: Datas no limite (hoje + 30, hoje + 90), formato inválido
- **GuideEmbed**: Verificar presença de seções obrigatórias (origem/destino, datas, canais)
- **Integração**: Fluxo completo do comando com mock de providers

### Testes de Propriedade (Property-Based Testing)

Biblioteca: **fast-check** (TypeScript, compatível com o ecossistema do projeto)

Configuração:
- Mínimo 100 iterações por propriedade
- Cada teste deve referenciar a propriedade do design com tag no formato:
  `Feature: bot-refactor-providers-channels, Property {N}: {título}`

Propriedades a implementar:
1. Ordenação do registry (gerar configs aleatórias, verificar saída ordenada)
2. Invariante remaining = limit - used (gerar sequências de consume)
3. Indisponibilidade após limite (gerar limites aleatórios, consumir exatamente N vezes)
4. Busca sequencial para no primeiro sucesso (gerar listas de providers com mock)
5. Reset de ciclo (simular passagem de tempo)
6. Todos esgotados (gerar registry com todos no limite)
7. Canal geral recebe tudo (gerar promoções aleatórias)
8. Roteamento internacional (gerar promoções com destinos variados)
9. Roteamento brasil (gerar promoções domésticas e internacionais)
10. Validação de origem (gerar strings aleatórias e códigos válidos)
11. Filtro de escalas (gerar listas com stops variados e limites aleatórios)
12. Fallback de ida no intervalo (verificar range 30-90 dias)
13. Fallback de volta no intervalo (verificar range 7-14 dias após ida)
14. Datas preservadas (gerar datas válidas, verificar identidade)
15. Reserva de quota (gerar configs com reserva, verificar threshold por contexto)
16. Análise de IA executada para cada resultado (verificar Map com entrada para cada promoção)
17. Google Flights URL como link principal (verificar prioridade sobre bookingUrl)
18. Parâmetros corretos na URL do Google Flights (verificar origem, destino, datas no tfs)

### Estrutura de Arquivos de Teste

```
src/
  __tests__/
    services/
      ProviderRegistry.test.ts
      ProviderRegistry.property.test.ts
      RateLimiter.test.ts
      RateLimiter.property.test.ts
      ChannelRouter.test.ts
      ChannelRouter.property.test.ts
      DateFallbackService.test.ts
      DateFallbackService.property.test.ts
      PromotionService.test.ts
      FlightAnalysisService.test.ts
    commands/
      promocoes.test.ts
    embeds/
      PromoEmbed.test.ts
      PromoEmbed.property.test.ts
    utils/
      googleFlights.test.ts
      googleFlights.property.test.ts
```
