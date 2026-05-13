import { env } from '@config/env';
import { logger } from '@utils/logger';

import type { FlightPromotion } from '@flight-types/FlightPromotion';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
  error?: { message?: string; code?: string };
}

/**
 * Usa a API do OpenAI (GPT) para analisar se uma passagem é boa ou não.
 * Retorna uma string curta com a análise ou mensagem de indisponibilidade.
 */
export class FlightAnalysisService {
  private readonly apiKey: string | undefined;
  private readonly baseUrl = 'https://api.openai.com/v1/chat/completions';
  private lastError: 'quota' | 'ratelimit' | 'auth' | 'error' | null = null;

  constructor() {
    this.apiKey = env.OPENAI_API_KEY;
  }

  public isAvailable(): boolean {
    return !!this.apiKey;
  }

  private getErrorMessage(): string {
    switch (this.lastError) {
      case 'quota':
        return '🤖 IA sem créditos no momento (quota OpenAI esgotada)';
      case 'ratelimit':
        return '🤖 IA temporariamente indisponível (rate limit)';
      case 'auth':
        return '🤖 IA com chave inválida — verificar configuração';
      default:
        return '🤖 IA não pôde ser acessada no momento';
    }
  }

  public async analyzePromotion(promotion: FlightPromotion): Promise<string> {
    if (!this.apiKey) {
      return '🤖 IA indisponível (chave não configurada)';
    }

    try {
      const prompt = this.buildPrompt(promotion);
      const response = await this.callOpenAI(prompt);
      return response || '🤖 IA não conseguiu analisar esta oferta';
    } catch (error) {
      logger.error({ error }, '[GPT] Erro ao analisar promoção');
      return '🤖 IA não pôde ser acessada no momento';
    }
  }

  public async analyzePromotions(promotions: FlightPromotion[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    if (!this.apiKey) {
      for (const p of promotions) {
        results.set(p.id, '🤖 IA indisponível (chave não configurada)');
      }
      return results;
    }

    // Analisar todas de uma vez em um único prompt para economizar tokens
    try {
      const prompt = this.buildBatchPrompt(promotions);
      const response = await this.callOpenAI(prompt);

      if (response) {
        logger.info({ responseLength: response.length }, '[GPT] Análise recebida com sucesso');
        const lines = response.split('\n').filter(l => l.trim());
        for (let i = 0; i < promotions.length; i++) {
          results.set(promotions[i].id, lines[i] || '🤖 Sem análise para este voo');
        }
      } else {
        // callOpenAI retornou null — já logou o motivo
        const msg = this.getErrorMessage();
        for (const p of promotions) {
          results.set(p.id, msg);
        }
      }
    } catch (error) {
      logger.error({ error }, '[GPT] Exceção ao analisar promoções');
      for (const p of promotions) {
        results.set(p.id, '🤖 IA não pôde ser acessada no momento');
      }
    }

    return results;
  }

  private buildPrompt(promotion: FlightPromotion): string {
    return `Analise esta passagem aérea e diga em UMA frase curta (máx 80 caracteres) se é uma boa oferta ou não. Considere preços médios do mercado brasileiro.

Rota: ${promotion.origin} → ${promotion.destinationCode} (${promotion.destination}, ${promotion.destinationCountry})
Preço: R$ ${promotion.price}
Companhia: ${promotion.airline || 'Não informada'}
Paradas: ${promotion.stops}
Data ida: ${promotion.departureDate}
Data volta: ${promotion.returnDate || 'Somente ida'}

Responda APENAS com a frase de análise, começando com um emoji (✅ boa, 🔥 excelente, ⚠️ mediana, ❌ cara).`;
  }

  private buildBatchPrompt(promotions: FlightPromotion[]): string {
    const items = promotions.map((p, i) =>
      `${i + 1}. ${p.origin}→${p.destinationCode} (${p.destination}) R$${p.price} ${p.airline || ''} ${p.stops} paradas`,
    ).join('\n');

    return `Analise cada passagem aérea abaixo e diga em UMA frase curta (máx 80 chars) se é boa oferta. Considere preços médios do mercado brasileiro para cada destino.

${items}

Responda UMA linha por passagem, na mesma ordem. Comece cada linha com emoji (✅ boa, 🔥 excelente, ⚠️ mediana, ❌ cara).`;
  }

  private async callOpenAI(prompt: string): Promise<string | null> {
    logger.info('[GPT] Chamando OpenAI API...');

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um especialista em passagens aéreas do Brasil. Responda de forma ultra concisa.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    logger.info({ status: response.status }, '[GPT] Resposta recebida');

    // Rate limit ou créditos esgotados
    if (response.status === 429) {
      const errorText = await response.text().catch(() => '');
      const isQuota = errorText.includes('insufficient_quota');
      logger.warn({ status: 429, isQuota, body: errorText }, '[GPT] Rate limit ou quota esgotada');
      this.lastError = isQuota ? 'quota' : 'ratelimit';
      return null;
    }

    // Sem créditos / billing / chave inválida
    if (response.status === 402 || response.status === 401) {
      const errorText = await response.text().catch(() => '');
      logger.warn({ status: response.status, body: errorText }, '[GPT] Creditos esgotados ou chave invalida');
      this.lastError = response.status === 401 ? 'auth' : 'quota';
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      logger.error({ status: response.status, body: errorText }, '[GPT] Erro HTTP');
      this.lastError = 'error';
      return null;
    }

    const data: ChatCompletionResponse = await response.json();

    if (data.error) {
      logger.error({ error: data.error }, '[GPT] Erro na resposta');
      return null;
    }

    return data.choices?.[0]?.message?.content?.trim() || null;
  }
}
