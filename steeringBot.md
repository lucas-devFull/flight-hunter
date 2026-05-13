# ✈️ FlightHunter — Project Steering

Documentação estratégica do projeto dividida em pequenas docs.

---

# 📁 DOC INDEX

1. Vision.md
2. Architecture.md
3. Channels.md
4. Commands.md
5. Providers.md
6. Airports.md
7. Countries.md
8. Scheduler.md
9. Ranking.md
10. Cache.md
11. Database.md
12. DiscordEmbeds.md
13. Roadmap.md
14. Infra.md
15. Monetization.md
16. FutureIdeas.md

---

# 📄 Vision.md

## Objetivo

Criar um bot inteligente para Discord focado em:

* promoções aéreas
* monitoramento de voos
* datas específicas
* destinos flexíveis
* múltiplos providers
* links confiáveis

O sistema deve funcionar como um agregador inteligente semelhante a:

* Google Flights Alerts
* Hopper
* Skyscanner Alerts
* Melhores Destinos

Mas personalizado para:

* aeroportos de SP/RJ/PR
* destinos prioritários
* preços baixos
* monitoramento contínuo

---

## Objetivos principais

* Encontrar passagens baratas automaticamente
* Monitorar múltiplas APIs simultaneamente
* Evitar spam e duplicação
* Gerar alertas úteis
* Possuir arquitetura escalável
* Manter baixo custo operacional

---

# 📄 Architecture.md

## Arquitetura principal

```txt
Discord Bot
  ├── Commands
  ├── Jobs
  ├── Providers
  ├── Ranking Engine
  ├── Cache Layer
  ├── Database
  └── Notification System
```

---

## Estrutura de pastas

```txt
src/
  bot/         - cliente Discord
  commands/    - slash commands
  config/      - validação de ambiente e constantes
  embeds/      - criação de embeds Discord
  events/      - listeners do Discord
  jobs/        - jobs agendados (node-cron)
  providers/   - SerperFlightsProvider (único provider)
  services/    - lógica de domínio, ranking, notificações
  types/       - tipagens compartilhadas
  utils/       - logger, formatters, googleFlights URL builder
```

---

## Tecnologias

### Backend

* Node.js
* TypeScript
* tsup (build)
* tsx (dev com hot reload)

### Discord

* discord.js

### Scheduler

* node-cron

### API externa

* Serper Search API (google.serper.dev/search)

### Futuro (não implementado no MVP)

* PostgreSQL (banco)
* Redis (cache)
* BullMQ (filas)

---

# 📄 Channels.md

## #internacional

Promoções internacionais.

---

## #brasil

Promoções nacionais.

---

## #voos-malucos

Promoções inesperadas.

* erro tarifário
* preços absurdos
* destinos aleatórios

---

## #datas-especificas

Monitoramento personalizado.

---

# 📄 Commands.md

## /ping

Verifica se o bot está online e mostra latência.

---

## /promocoes

Busca promoções gerais com filtros opcionais.

### Opções

* `origem` - aeroporto de saída (GRU, VCP, GIG, etc.)
* `pais` - país prioritário (Japão, Espanha, etc.)
* `preco_maximo` - preço máximo em BRL
* `tipo_voo` - ida e volta ou somente ida
* `pessoas` - quantidade de passageiros

---

## /monitorar-data

Monitora período específico com alerta em canal escolhido.

### Exemplo

```bash
/monitorar-data 2026-09-05 2026-09-20 canal:Lucas BE
```

---

## /minhas-datas

Lista alertas ativos do usuário.

---

## /parar-monitoramento

Remove alertas por data.

---

## /guide

Publica guia de uso em um canal específico.

---

# 📄 Providers.md

## Provider atual

### Serper Search API

* Endpoint: `POST https://google.serper.dev/search`
* Busca por rotas específicas (ex: "passagem aerea GRU Madrid 2026-07-10")
* Extrai menor preço dos resultados orgânicos do Google
* Gera links diretos do Google Flights via protobuf (parâmetro `tfs`)
* Destinos pré-definidos em `KNOWN_DESTINATIONS` com código IATA e país
* Não existe endpoint `/flights` na Serper — apenas `/search`, `/images`, `/news`, `/places`, `/scholar`, `/autocomplete`

---

## Providers futuros (não implementados)

### APIs

* Kiwi API
* Amadeus API
* Skyscanner
* Kayak

---

### Companhias oficiais

* LATAM
* GOL
* Azul
* Iberia
* American Airlines

---

## Estratégia

O sistema atualmente:

1. Busca rotas específicas via Serper Search API
2. Extrai preços dos snippets orgânicos
3. Valida destinos contra lista conhecida (evita falsos positivos)
4. Gera links diretos do Google Flights com protobuf
5. Rankeia por menor preço

Futuro:

1. Consultar múltiplos providers
2. Normalizar resultados
3. Remover duplicados
4. Rankear promoções
5. Enviar melhores oportunidades

---

# 📄 Airports.md

## Aeroportos principais

```ts
const PRIMARY_AIRPORTS = [
  "GRU",
  "CGH",
  "VCP",
  "GIG",
  "SDU",
  "CWB"
];
```

---

## Aeroportos secundários

```ts
const SECONDARY_AIRPORTS = [
  "RAO",
  "SJP",
  "PPB",
  "JTC",
  "MII",
  "CFB",
  "CAW",
  "LDB",
  "MGF",
  "IGU",
  "CAC"
];
```

---

## Estratégia

### Tier 1

Busca a cada 30 min.

### Tier 2

Busca a cada 2h ou 4h.

---

# 📄 Countries.md

## Países prioritários

```ts
const PRIORITY_COUNTRIES = [
  "JP",
  "ES",
  "CO",
  "PE",
  "IT",
  "CN",
  "TH",
  "US"
];
```

---

## Regras especiais

### Espanha

Priorizar:

* Madrid
* Barcelona

---

### Estados Unidos

Aceitar qualquer cidade.

---

# 📄 Scheduler.md

## Frequências

| Job                    | Frequência |
| ---------------------- | ---------- |
| Internacional          | 30 min     |
| Brasil                 | 1h         |
| Voos malucos           | 1h         |
| Datas específicas      | 30 min     |
| Aeroportos secundários | 4h         |

---

## Estratégia

Evitar excesso de requests.

---

# 📄 Ranking.md

## Sistema de score

| Critério       | Peso |
| -------------- | ---- |
| menor preço    | 50   |
| site confiável | 25   |
| companhia      | 10   |
| duração        | 10   |
| escalas        | 5    |

---

## Objetivo

Priorizar:

* promoções reais
* links confiáveis
* menor preço

---

# 📄 Cache.md

## Tecnologia

* Redis

---

## Objetivos

* evitar spam
* evitar duplicados
* armazenar hashes
* cachear requests

---

## Exemplo

```txt
GRU-MAD-2890-2026-09-10
```

---

# 📄 Database.md

## Banco principal

* PostgreSQL

---

## Tabelas

### monitors

```sql
id
user_id
country
price_limit
date_from
date_to
active
created_at
```

---

### sent_deals

```sql
id
hash
provider
price
created_at
```

---

# 📄 DiscordEmbeds.md

## Estrutura

```txt
🔥 PROMOÇÃO ENCONTRADA

🇪🇸 Barcelona
🛫 Saindo: Campinas (VCP)

📅 04/09 → 17/09

💰 R$ 2.690

✈️ Iberia

🔗 Google Flights
🔗 Skyscanner
🔗 Booking.com
```

---

## Objetivo

Embeds limpos e rápidos de visualizar.

---

# 📄 Roadmap.md

## v1

* Discord bot
* APIs principais
* promoções automáticas
* monitoramento por datas

---

## v2

* IA previsão de preços
* histórico
* score de promoções
* heatmap

---

## v3

* hotéis
* pacotes
* dashboard web
* Telegram
* aplicativo mobile

---

# 📄 Infra.md

## Hospedagem

* Railway
* Render
* Fly.io

---

## Banco

* Neon
* Supabase

---

## Redis

* Upstash

---

## Objetivo

Manter custo próximo de zero no MVP.

---

# 📄 Monetization.md

## Possibilidades futuras

* Discord premium
* Telegram VIP
* SaaS
* afiliados
* anúncios
* planos pagos

---

## Links afiliados

Possível integração:

* Booking.com
* TravelPayouts
* Skyscanner

---

# 📄 FutureIdeas.md

## Ideias futuras

### IA de previsão

Exemplo:

```txt
Preço provavelmente cairá nos próximos 7 dias.
```

---

### Alertas de queda

```txt
🔥 CAIU R$ 780 DESDE ONTEM
```

---

### Heatmap de destinos

Mostrar:

* países mais baratos
* aeroportos mais baratos
* melhores meses

---

### Pacotes completos

* voo
* hotel
* seguro
* aluguel de carro

---

### Dashboard web

Painel para:

* filtros
* histórico
* analytics
* alertas

