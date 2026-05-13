export interface Airport {
  code: string;
  name: string;
  city: string;
  state: 'SP' | 'RJ' | 'PR';
  tier: 1 | 2;
}

export interface PriorityCountry {
  code: string;
  name: string;
  emoji: string;
  priorityCities: readonly string[];
  crazyDealPrice: number;
}

export const DISCORD_CHANNELS = {
  geral: {
    name: 'geral',
    label: '#geral',
  },
  guide: {
    name: 'guide',
    label: '#guide',
  },
  international: {
    name: 'internacional',
    label: '#internacional',
  },
  brazil: {
    name: 'brasil',
    label: '#brasil',
  },
  crazy: {
    name: 'voos-malucos',
    label: '#voos-malucos',
  },
  specificDates: {
    name: 'datas-especificas',
    label: '#datas-especificas',
  },
  specificDatesLucasBe: {
    name: 'datas-especificas-lucas-be',
    label: '#datas-especificas-lucas-be',
  },
  specificDatesZu: {
    name: 'datas-especificas-zu',
    label: '#datas-especificas-zu',
  },
  specificDatesMacedoEste: {
    name: 'datas-especificas-macedo-este',
    label: '#datas-especificas-macedo-este',
  },
} as const;

export type DiscordChannelKey = keyof typeof DISCORD_CHANNELS;
export type PromotionChannelKey = 'geral' | 'international' | 'brazil' | 'crazy';
export type DateMonitorChannelKey =
  | 'specificDates'
  | 'specificDatesLucasBe'
  | 'specificDatesZu'
  | 'specificDatesMacedoEste';
export type AlertChannelKey = PromotionChannelKey | DateMonitorChannelKey;

export const PROMOTION_CHANNEL_KEYS = [
  'geral',
  'international',
  'brazil',
  'crazy',
] as const satisfies readonly PromotionChannelKey[];

export const DATE_MONITOR_CHANNEL_KEYS = [
  'specificDates',
  'specificDatesLucasBe',
  'specificDatesZu',
  'specificDatesMacedoEste',
] as const satisfies readonly DateMonitorChannelKey[];

export const DATE_MONITOR_CHANNEL_CHOICES = [
  { name: 'Geral - datas-especificas', value: 'specificDates' },
  { name: 'Lucas BE', value: 'specificDatesLucasBe' },
  { name: 'Zu', value: 'specificDatesZu' },
  { name: 'Macedo Este', value: 'specificDatesMacedoEste' },
] as const;

export function isDateMonitorChannelKey(value: string): value is DateMonitorChannelKey {
  return (DATE_MONITOR_CHANNEL_KEYS as readonly string[]).includes(value);
}

export const MONITORED_AIRPORTS = [
  { code: 'GRU', name: 'Guarulhos', city: 'Sao Paulo', state: 'SP', tier: 1 },
  { code: 'CGH', name: 'Congonhas', city: 'Sao Paulo', state: 'SP', tier: 1 },
  { code: 'VCP', name: 'Viracopos', city: 'Campinas', state: 'SP', tier: 1 },
  { code: 'GIG', name: 'Galeao', city: 'Rio de Janeiro', state: 'RJ', tier: 1 },
  { code: 'SDU', name: 'Santos Dumont', city: 'Rio de Janeiro', state: 'RJ', tier: 1 },
  { code: 'CWB', name: 'Afonso Pena', city: 'Curitiba', state: 'PR', tier: 1 },
  { code: 'RAO', name: 'Ribeirao Preto', city: 'Ribeirao Preto', state: 'SP', tier: 2 },
  {
    code: 'SJP',
    name: 'Sao Jose do Rio Preto',
    city: 'Sao Jose do Rio Preto',
    state: 'SP',
    tier: 2,
  },
  { code: 'PPB', name: 'Presidente Prudente', city: 'Presidente Prudente', state: 'SP', tier: 2 },
  { code: 'JTC', name: 'Bauru-Arealva', city: 'Bauru', state: 'SP', tier: 2 },
  { code: 'MII', name: 'Marilia', city: 'Marilia', state: 'SP', tier: 2 },
  { code: 'CFB', name: 'Cabo Frio', city: 'Cabo Frio', state: 'RJ', tier: 2 },
  {
    code: 'CAW',
    name: 'Campos dos Goytacazes',
    city: 'Campos dos Goytacazes',
    state: 'RJ',
    tier: 2,
  },
  { code: 'LDB', name: 'Londrina', city: 'Londrina', state: 'PR', tier: 2 },
  { code: 'MGF', name: 'Maringa', city: 'Maringa', state: 'PR', tier: 2 },
  { code: 'IGU', name: 'Foz do Iguacu', city: 'Foz do Iguacu', state: 'PR', tier: 2 },
  { code: 'CAC', name: 'Cascavel', city: 'Cascavel', state: 'PR', tier: 2 },
] as const satisfies readonly Airport[];

export const PRIMARY_AIRPORT_CHOICES = MONITORED_AIRPORTS.filter((airport) => airport.tier === 1).map(
  (airport) => ({ name: `${airport.code} - ${airport.name}`, value: airport.code }),
);

export const SECONDARY_AIRPORT_CHOICES = MONITORED_AIRPORTS.filter(
  (airport) => airport.tier === 2,
).map((airport) => ({ name: `${airport.code} - ${airport.name}`, value: airport.code }));

export const MONITORED_AIRPORT_CHOICES = MONITORED_AIRPORTS.map((airport) => ({
  name: `${airport.code} - ${airport.name}`,
  value: airport.code,
}));

export const PRIMARY_AIRPORT_CODES = MONITORED_AIRPORTS.filter((airport) => airport.tier === 1).map(
  (airport) => airport.code,
);

export const SECONDARY_AIRPORT_CODES = MONITORED_AIRPORTS.filter(
  (airport) => airport.tier === 2,
).map((airport) => airport.code);

export const MONITORED_AIRPORT_CODES = MONITORED_AIRPORTS.map((airport) => airport.code);

export const PRIORITY_COUNTRIES = [
  {
    code: 'JP',
    name: 'Japao',
    emoji: '🇯🇵',
    priorityCities: ['Tokyo', 'Osaka'],
    crazyDealPrice: 4200,
  },
  {
    code: 'ES',
    name: 'Espanha',
    emoji: '🇪🇸',
    priorityCities: ['Madrid', 'Barcelona'],
    crazyDealPrice: 2800,
  },
  {
    code: 'CO',
    name: 'Colombia',
    emoji: '🇨🇴',
    priorityCities: ['Bogota', 'Cartagena'],
    crazyDealPrice: 1400,
  },
  {
    code: 'PE',
    name: 'Peru',
    emoji: '🇵🇪',
    priorityCities: ['Lima', 'Cusco'],
    crazyDealPrice: 1500,
  },
  {
    code: 'IT',
    name: 'Italia',
    emoji: '🇮🇹',
    priorityCities: ['Rome', 'Milan'],
    crazyDealPrice: 3000,
  },
  {
    code: 'CN',
    name: 'China',
    emoji: '🇨🇳',
    priorityCities: ['Beijing', 'Shanghai'],
    crazyDealPrice: 4300,
  },
  {
    code: 'TH',
    name: 'Tailandia',
    emoji: '🇹🇭',
    priorityCities: ['Bangkok', 'Phuket'],
    crazyDealPrice: 4300,
  },
  { code: 'US', name: 'Estados Unidos', emoji: '🇺🇸', priorityCities: [], crazyDealPrice: 2200 },
] as const satisfies readonly PriorityCountry[];

export const PRIORITY_COUNTRY_CODES = PRIORITY_COUNTRIES.map((country) => country.code);

export function getAirportByCode(code: string): Airport | undefined {
  return MONITORED_AIRPORTS.find((airport) => airport.code === code.toUpperCase());
}

export function getPriorityCountryByCode(code: string): PriorityCountry | undefined {
  return PRIORITY_COUNTRIES.find((country) => country.code === code.toUpperCase());
}

export function isMonitoredAirportCode(code: string): boolean {
  return (MONITORED_AIRPORT_CODES as readonly string[]).includes(code.toUpperCase());
}

export const PREDEFINED_ORIGINS = ['GRU', 'GIG', 'VCP', 'BSB', 'CNF', 'CGH', 'SDU', 'CWB'] as const;
export type PredefinedOrigin = (typeof PREDEFINED_ORIGINS)[number];

export function isPredefinedOrigin(code: string): boolean {
  return (PREDEFINED_ORIGINS as readonly string[]).includes(code.toUpperCase());
}
