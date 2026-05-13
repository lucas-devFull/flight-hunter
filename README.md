# FlightHunter

FlightHunter é um bot Discord para monitorar promoções aéreas, gerar links de voos e enviar alertas em canais segmentados.

## Integração com Serper API

O bot usa a **Serper API** (https://serper.dev) como único provider de voos.

**Provider:** `SerperFlightsProvider` — usa o endpoint `POST https://google.serper.dev/search` para buscar preços de passagens aéreas em resultados orgânicos do Google. A busca é feita por rotas específicas (ex: "passagem aerea GRU Madrid 2026-07-10") e o preço mais baixo é extraído dos snippets.

**Links do Google Flights:** gerados com protobuf codificado em Base64 no parâmetro `tfs`, abrindo diretamente na busca com origem, destino e datas pré-preenchidos.

A chave da API é configurada via variável de ambiente `SERPER_API_KEY`.

## Recursos do MVP

- Bot Discord online
- Slash commands `/ping`, `/promocoes`, `/monitorar-data`, `/minhas-datas`, `/parar-monitoramento`, `/guide`
- Embeds customizados
- Job automático com `node-cron` para verificar promoções (dados reais via Serper API)
- Links do Google Flights configurados automaticamente
- Suporte a múltiplos canais de Discord por nome ou ID

## Estrutura

- `src/bot` - cliente Discord e inicialização
- `src/commands` - slash commands
- `src/events` - listeners do Discord
- `src/jobs` - jobs agendados com node-cron
- `src/providers` - integrações com APIs externas orientadas por provider (atualmente Serper API)
- `src/services` - lógica do domínio, ranking, notificações e loaders
- `src/embeds` - criação de embeds do Discord
- `src/config` - validação de ambiente
- `src/utils` - utilitários e logger
- `src/types` - tipagens compartilhadas

## Scripts

- `pnpm dev` - executa em modo desenvolvimento com hot reload
- `pnpm build` - compila o projeto para `dist`
- `pnpm start` - inicia a versão construída
- `pnpm lint` - valida o código com ESLint
- `pnpm deploy:commands` - registra comandos de slash no Discord

## Configuração

1. Copie `.env.example` para `.env`
2. Preencha `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` e `DISCORD_GUILD_ID`
3. Obtenha uma chave de API em https://serper.dev e preencha `SERPER_API_KEY`
4. Opcionalmente configure os IDs dos canais em `DISCORD_CHANNEL_*_ID`
5. Execute `pnpm install`
6. Execute `pnpm deploy:commands`
7. Execute `pnpm dev`

A variável `FLIGHT_PROVIDER` no `.env` não é mais necessária — o Serper é o único provider.

## Comandos

- `/ping` - verifica se o bot esta online e mostra a latencia
- `/promocoes` - busca promocoes por origem, pais prioritario, preco maximo e limite de embeds
- `/monitorar-data` - cria alerta para canais de datas especificas
- `/minhas-datas` - lista seus alertas ativos por data
- `/parar-monitoramento` - remove alertas por data
- `/guide` - mostra os comandos e publica um guia de uso em um canal

## Arquitetura do MVP

O bot registra comandos e eventos por registries estaticos, o que funciona tanto no `tsx watch`
quanto no build ESM gerado pelo `tsup`. Providers externos implementam uma interface comum e o
`PromotionService` normaliza, remove duplicados e rankeia resultados antes do `NotificationService`
enviar embeds aos canais.

### Providers

| Provider | Fonte dos dados |
|----------|----------------|
| `SerperFlightsProvider` | 🌐 Preços reais via Serper Search API (endpoint `/search`) |

A `providerFactory.ts` instancia `SerperFlightsProvider` com a chave configurada em `SERPER_API_KEY`.
O provider busca rotas específicas (origem → destino conhecido), extrai o menor preço dos resultados
orgânicos e gera links diretos do Google Flights com protobuf (parâmetro `tfs`).

## Canais sugeridos

- `#guide`
- `#internacional`
- `#brasil`
- `#voos-malucos`
- `#datas-especificas`
- `#datas-especificas-lucas-be`
- `#datas-especificas-zu`
- `#datas-especificas-macedo-este`

Depois de criar `#guide`, rode `pnpm deploy:commands` e use `/guide canal:#guide` para publicar
um guia fixo com os comandos e a funcao de cada canal.

No `/monitorar-data`, use a opcao `canal` para escolher se o alerta vai para o canal geral,
Lucas BE, Zu ou Macedo Este.

## Países prioritários

Japão, Espanha, Colômbia, Peru, Itália, China, Tailândia, Estados Unidos