import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const discordSnowflake = z
  .string()
  .regex(/^\d{17,20}$/, 'Use o ID numerico do Discord, nao token/public key');

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: discordSnowflake,
  DISCORD_GUILD_ID: discordSnowflake,
  FLIGHT_PROVIDER: z.enum(['auto', 'serper', 'aviasales', 'both', 'all']).default('auto'),
  SERPER_API_KEY: z.string().min(1, 'Chave da API Serper é obrigatória'),
  AVIASALES_TOKEN: z.string().optional(),
  KIWI_RAPIDAPI_KEY: z.string().optional(),
  FLIGHTAPI_KEY: z.string().optional(),
  SKYSCRAPPER_RAPIDAPI_KEY: z.string().optional(),
  GOOGLE_FLIGHTS_RAPIDAPI_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  PROMOTION_JOB_CRON: z.string().default('*/30 * * * *'),
  DISCORD_CHANNEL_GERAL_ID: z.string().optional(),
  DISCORD_CHANNEL_INTERNACIONAL_ID: z.string().optional(),
  DISCORD_CHANNEL_BRASIL_ID: z.string().optional(),
  DISCORD_CHANNEL_VOOS_MALUCOS_ID: z.string().optional(),
  DISCORD_CHANNEL_DATAS_ESPECIFICAS_ID: z.string().optional(),
  DISCORD_CHANNEL_DATAS_ESPECIFICAS_LUCAS_BE_ID: z.string().optional(),
  DISCORD_CHANNEL_DATAS_ESPECIFICAS_ZU_ID: z.string().optional(),
  DISCORD_CHANNEL_DATAS_ESPECIFICAS_MACEDO_ESTE_ID: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
  DEFAULT_TIMEZONE: z.string().default('America/Sao_Paulo'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
