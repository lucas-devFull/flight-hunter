# ✈️ FlightHunter Discord Bot

Bot inteligente de monitoramento de passagens aéreas e promoções de viagens.

O sistema monitora múltiplas APIs e buscadores como:

* Google Flights
* Kiwi Tequila API
* Amadeus
* Skyscanner
* Kayak
* Booking.com
* Decolar
* Companhias aéreas oficiais

O objetivo é encontrar automaticamente:

* Passagens baratas
* Promoções internacionais
* Destinos aleatórios baratos
* Alertas personalizados por data
* Voos saindo de SP, RJ e PR

---

# 🌍 Países Prioritários

O bot monitora principalmente:

* Japão
* Espanha
* Colômbia
* Peru
* Itália
* China
* Tailândia
* Estados Unidos

## Regras especiais

### Espanha

Prioridade para:

* Madrid
* Barcelona

### Estados Unidos

Monitoramento para qualquer cidade:

* Miami
* Orlando
* Nova York
* Los Angeles
* Chicago
* etc

---

# 🛫 Aeroportos Monitorados

## São Paulo

| Cidade                | Código |
| --------------------- | ------ |
| Guarulhos             | GRU    |
| Congonhas             | CGH    |
| Viracopos             | VCP    |
| Ribeirão Preto        | RAO    |
| São José do Rio Preto | SJP    |
| Presidente Prudente   | PPB    |
| Bauru                 | JTC    |
| Marília               | MII    |

---

## Rio de Janeiro

| Cidade                | Código |
| --------------------- | ------ |
| Galeão                | GIG    |
| Santos Dumont         | SDU    |
| Cabo Frio             | CFB    |
| Campos dos Goytacazes | CAW    |

---

## Paraná

| Cidade        | Código |
| ------------- | ------ |
| Curitiba      | CWB    |
| Londrina      | LDB    |
| Maringá       | MGF    |
| Foz do Iguaçu | IGU    |
| Cascavel      | CAC    |

---

# 📁 Estrutura de Canais

## #internacional

Canal para promoções internacionais.

Exemplos:

* Japão
* Espanha
* Itália
* EUA
* Tailândia

---

## #brasil

Canal para promoções nacionais.

Exemplos:

* Recife
* Maceió
* Salvador
* Gramado
* Fortaleza

---

## #voos-malucos

Canal para promoções inesperadas.

Exemplos:

* Erros tarifários
* Destinos aleatórios
* Preços absurdamente baixos
* Rotas diferentes

---

## #datas-especificas

Canal para monitoramento personalizado.

O usuário define datas específicas e o bot monitora continuamente.

---

# ⚙️ Comandos

---

# 🌎 Promoções

## /promocoes

Busca promoções gerais.

### Exemplo

```bash
/promocoes
```

---

## /promocoes-pais

Busca promoções para um país específico.

### Exemplo

```bash
/promocoes-pais japao
```

ou

```bash
/promocoes-pais espanha
```

---

# 📅 Monitoramento por Datas

## /monitorar-data

Monitora passagens em um período específico.

### Exemplo

```bash
/monitorar-data 2026-09-05 2026-09-20
```

---

## Datas flexíveis

Permite procurar voos próximos das datas.

### Exemplo

```bash
/monitorar-data 2026-09-05 2026-09-20 flex 3
```

### Resultado

O bot irá procurar:

* 02/09 até 23/09
* ±3 dias

---

## /minhas-datas

Mostra monitoramentos ativos.

### Exemplo

```bash
/minhas-datas
```

---

## /alterar-data

Atualiza datas monitoradas.

### Exemplo

```bash
/alterar-data 2026-10-01 2026-10-15
```

---

## /parar-monitoramento

Remove monitoramento ativo.

### Exemplo

```bash
/parar-monitoramento
```

---

# 💰 Filtro de Preço

## /monitorar-preco

Monitora um país com preço máximo.

### Exemplo

```bash
/monitorar-preco japao 5000
```

---

# 🔥 Exemplo de Alerta

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

# 🧠 Regras Inteligentes

O bot:

* Remove voos duplicados
* Evita spam
* Prioriza links confiáveis
* Busca menor preço disponível
* Prioriza aeroportos maiores
* Aceita escalas
* Aceita low-cost
* Aceita ida ou ida e volta
* Usa múltiplas APIs simultaneamente

---

# 🛠️ Stack do Projeto

## Backend

* Node.js
* TypeScript

---

## Discord

* discord.js

---

## APIs

* Google Flights
* Kiwi API
* Amadeus
* Skyscanner
* Kayak
* Booking.com
* Decolar

---

## Infra

* Redis
* PostgreSQL
* BullMQ

---

# 📁 Estrutura do Projeto

```txt
src/
  bot/
  commands/
  jobs/
  providers/
  services/
  cache/
  database/
  utils/
```

---

# 📁 Estrutura de Providers

```txt
providers/
  kiwi.ts
  amadeus.ts
  googleFlights.ts
  skyscanner.ts
  kayak.ts
  booking.ts
```

---

# 📁 Estrutura de Jobs

```txt
jobs/
  internationalDeals.ts
  brazilDeals.ts
  randomDeals.ts
  monitoredDates.ts
```

---

# 🚀 Roadmap Futuro

## v1

* Promoções automáticas
* Discord embeds
* Monitoramento por datas
* Multi providers

---

## v2

* IA de previsão de preços
* Score de promoção
* Alertas personalizados
* Heatmap de preços
* Histórico de valores

---

## v3

* Hotéis
* Pacotes
* Milhas
* Telegram
* Web dashboard
* Aplicativo mobile

---

# 🔐 Links Confiáveis

O bot prioriza:

* Google Flights
* Skyscanner
* Booking.com
* Kayak
* Decolar
* Sites oficiais das companhias

---

# 🧠 Objetivo do Sistema

Criar um agregador inteligente de promoções aéreas focado em:

* baixo custo
* flexibilidade
* múltiplas fontes
* promoções reais
* monitoramento contínuo
* personalização

