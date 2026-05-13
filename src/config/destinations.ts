/**
 * Lista de destinos populares para autocomplete do comando /promocoes.
 * Cada entrada contém: código IATA, cidade, país, aeroporto e tags de busca.
 */

export interface Destination {
  code: string;
  city: string;
  country: string;
  airport: string;
  /** Termos extras para busca (país em português, variações) */
  tags: string[];
}

export const DESTINATIONS: readonly Destination[] = [
  // Europa
  { code: 'LIS', city: 'Lisboa', country: 'Portugal', airport: 'Humberto Delgado', tags: ['portugal', 'europa'] },
  { code: 'OPO', city: 'Porto', country: 'Portugal', airport: 'Francisco Sa Carneiro', tags: ['portugal', 'europa'] },
  { code: 'MAD', city: 'Madrid', country: 'Espanha', airport: 'Adolfo Suarez-Barajas', tags: ['espanha', 'spain', 'europa'] },
  { code: 'BCN', city: 'Barcelona', country: 'Espanha', airport: 'El Prat', tags: ['espanha', 'spain', 'europa'] },
  { code: 'FCO', city: 'Roma', country: 'Italia', airport: 'Leonardo da Vinci-Fiumicino', tags: ['italia', 'italy', 'europa'] },
  { code: 'MXP', city: 'Milao', country: 'Italia', airport: 'Malpensa', tags: ['italia', 'italy', 'europa', 'milan'] },
  { code: 'CDG', city: 'Paris', country: 'Franca', airport: 'Charles de Gaulle', tags: ['franca', 'france', 'europa'] },
  { code: 'ORY', city: 'Paris', country: 'Franca', airport: 'Orly', tags: ['franca', 'france', 'europa'] },
  { code: 'LHR', city: 'Londres', country: 'Reino Unido', airport: 'Heathrow', tags: ['inglaterra', 'uk', 'europa', 'london'] },
  { code: 'LGW', city: 'Londres', country: 'Reino Unido', airport: 'Gatwick', tags: ['inglaterra', 'uk', 'europa', 'london'] },
  { code: 'FRA', city: 'Frankfurt', country: 'Alemanha', airport: 'Frankfurt', tags: ['alemanha', 'germany', 'europa'] },
  { code: 'MUC', city: 'Munique', country: 'Alemanha', airport: 'Franz Josef Strauss', tags: ['alemanha', 'germany', 'europa', 'munich'] },
  { code: 'AMS', city: 'Amsterda', country: 'Holanda', airport: 'Schiphol', tags: ['holanda', 'netherlands', 'europa', 'amsterdam'] },
  { code: 'ZRH', city: 'Zurique', country: 'Suica', airport: 'Zurich', tags: ['suica', 'switzerland', 'europa'] },
  { code: 'VIE', city: 'Viena', country: 'Austria', airport: 'Vienna', tags: ['austria', 'europa'] },
  { code: 'PRG', city: 'Praga', country: 'Republica Tcheca', airport: 'Vaclav Havel', tags: ['tcheca', 'czech', 'europa'] },
  { code: 'DUB', city: 'Dublin', country: 'Irlanda', airport: 'Dublin', tags: ['irlanda', 'ireland', 'europa'] },
  { code: 'ATH', city: 'Atenas', country: 'Grecia', airport: 'Eleftherios Venizelos', tags: ['grecia', 'greece', 'europa'] },
  { code: 'IST', city: 'Istambul', country: 'Turquia', airport: 'Istanbul', tags: ['turquia', 'turkey', 'europa'] },

  // Americas
  { code: 'MIA', city: 'Miami', country: 'EUA', airport: 'Miami International', tags: ['eua', 'usa', 'estados unidos', 'florida', 'americas'] },
  { code: 'JFK', city: 'Nova York', country: 'EUA', airport: 'John F. Kennedy', tags: ['eua', 'usa', 'estados unidos', 'new york', 'americas'] },
  { code: 'EWR', city: 'Nova York', country: 'EUA', airport: 'Newark Liberty', tags: ['eua', 'usa', 'estados unidos', 'new york', 'americas'] },
  { code: 'MCO', city: 'Orlando', country: 'EUA', airport: 'Orlando International', tags: ['eua', 'usa', 'estados unidos', 'florida', 'disney', 'americas'] },
  { code: 'LAX', city: 'Los Angeles', country: 'EUA', airport: 'Los Angeles International', tags: ['eua', 'usa', 'estados unidos', 'california', 'americas'] },
  { code: 'SFO', city: 'Sao Francisco', country: 'EUA', airport: 'San Francisco International', tags: ['eua', 'usa', 'estados unidos', 'california', 'americas'] },
  { code: 'ATL', city: 'Atlanta', country: 'EUA', airport: 'Hartsfield-Jackson', tags: ['eua', 'usa', 'estados unidos', 'americas'] },
  { code: 'DFW', city: 'Dallas', country: 'EUA', airport: 'Dallas/Fort Worth', tags: ['eua', 'usa', 'estados unidos', 'texas', 'americas'] },
  { code: 'IAH', city: 'Houston', country: 'EUA', airport: 'George Bush Intercontinental', tags: ['eua', 'usa', 'estados unidos', 'texas', 'americas'] },
  { code: 'BOS', city: 'Boston', country: 'EUA', airport: 'Logan International', tags: ['eua', 'usa', 'estados unidos', 'americas'] },
  { code: 'EZE', city: 'Buenos Aires', country: 'Argentina', airport: 'Ezeiza', tags: ['argentina', 'americas'] },
  { code: 'SCL', city: 'Santiago', country: 'Chile', airport: 'Arturo Merino Benitez', tags: ['chile', 'americas'] },
  { code: 'BOG', city: 'Bogota', country: 'Colombia', airport: 'El Dorado', tags: ['colombia', 'americas'] },
  { code: 'LIM', city: 'Lima', country: 'Peru', airport: 'Jorge Chavez', tags: ['peru', 'americas'] },
  { code: 'CUN', city: 'Cancun', country: 'Mexico', airport: 'Cancun International', tags: ['mexico', 'americas', 'caribe'] },
  { code: 'MEX', city: 'Cidade do Mexico', country: 'Mexico', airport: 'Benito Juarez', tags: ['mexico', 'americas'] },
  { code: 'PTY', city: 'Cidade do Panama', country: 'Panama', airport: 'Tocumen', tags: ['panama', 'americas'] },
  { code: 'MVD', city: 'Montevideu', country: 'Uruguai', airport: 'Carrasco', tags: ['uruguai', 'uruguay', 'americas'] },
  { code: 'ASU', city: 'Assuncao', country: 'Paraguai', airport: 'Silvio Pettirossi', tags: ['paraguai', 'paraguay', 'americas'] },
  { code: 'HAV', city: 'Havana', country: 'Cuba', airport: 'Jose Marti', tags: ['cuba', 'caribe', 'americas'] },
  { code: 'UIO', city: 'Quito', country: 'Equador', airport: 'Mariscal Sucre', tags: ['equador', 'ecuador', 'americas'] },
  { code: 'CTG', city: 'Cartagena', country: 'Colombia', airport: 'Rafael Nunez', tags: ['colombia', 'caribe', 'americas'] },
  { code: 'YYZ', city: 'Toronto', country: 'Canada', airport: 'Pearson International', tags: ['canada', 'americas'] },
  { code: 'YUL', city: 'Montreal', country: 'Canada', airport: 'Trudeau International', tags: ['canada', 'americas'] },

  // Asia e Oriente Medio
  { code: 'NRT', city: 'Toquio', country: 'Japao', airport: 'Narita', tags: ['japao', 'japan', 'asia'] },
  { code: 'HND', city: 'Toquio', country: 'Japao', airport: 'Haneda', tags: ['japao', 'japan', 'asia'] },
  { code: 'KIX', city: 'Osaka', country: 'Japao', airport: 'Kansai', tags: ['japao', 'japan', 'asia'] },
  { code: 'ICN', city: 'Seul', country: 'Coreia do Sul', airport: 'Incheon', tags: ['coreia', 'korea', 'asia'] },
  { code: 'BKK', city: 'Bangkok', country: 'Tailandia', airport: 'Suvarnabhumi', tags: ['tailandia', 'thailand', 'asia'] },
  { code: 'SIN', city: 'Singapura', country: 'Singapura', airport: 'Changi', tags: ['singapura', 'singapore', 'asia'] },
  { code: 'HKG', city: 'Hong Kong', country: 'China', airport: 'Hong Kong International', tags: ['china', 'asia', 'hong kong'] },
  { code: 'PVG', city: 'Xangai', country: 'China', airport: 'Pudong', tags: ['china', 'asia', 'shanghai'] },
  { code: 'PEK', city: 'Pequim', country: 'China', airport: 'Capital International', tags: ['china', 'asia', 'beijing'] },
  { code: 'DEL', city: 'Nova Delhi', country: 'India', airport: 'Indira Gandhi', tags: ['india', 'asia'] },
  { code: 'DXB', city: 'Dubai', country: 'Emirados Arabes', airport: 'Dubai International', tags: ['emirados', 'uae', 'dubai', 'oriente medio'] },
  { code: 'DOH', city: 'Doha', country: 'Catar', airport: 'Hamad International', tags: ['catar', 'qatar', 'oriente medio'] },
  { code: 'TLV', city: 'Tel Aviv', country: 'Israel', airport: 'Ben Gurion', tags: ['israel', 'oriente medio'] },
  { code: 'JED', city: 'Jeddah', country: 'Arabia Saudita', airport: 'King Abdulaziz', tags: ['arabia', 'saudi', 'oriente medio'] },

  // Africa e Oceania
  { code: 'JNB', city: 'Joanesburgo', country: 'Africa do Sul', airport: 'O.R. Tambo', tags: ['africa do sul', 'south africa', 'africa'] },
  { code: 'CPT', city: 'Cidade do Cabo', country: 'Africa do Sul', airport: 'Cape Town International', tags: ['africa do sul', 'south africa', 'africa'] },
  { code: 'CAI', city: 'Cairo', country: 'Egito', airport: 'Cairo International', tags: ['egito', 'egypt', 'africa'] },
  { code: 'CMN', city: 'Casablanca', country: 'Marrocos', airport: 'Mohammed V', tags: ['marrocos', 'morocco', 'africa'] },
  { code: 'SYD', city: 'Sydney', country: 'Australia', airport: 'Kingsford Smith', tags: ['australia', 'oceania'] },
  { code: 'AKL', city: 'Auckland', country: 'Nova Zelandia', airport: 'Auckland', tags: ['nova zelandia', 'new zealand', 'oceania'] },

  // Brasil (destinos domésticos)
  { code: 'REC', city: 'Recife', country: 'Brasil', airport: 'Guararapes', tags: ['brasil', 'nordeste', 'domestico'] },
  { code: 'SSA', city: 'Salvador', country: 'Brasil', airport: 'Deputado Luis Eduardo Magalhaes', tags: ['brasil', 'nordeste', 'bahia', 'domestico'] },
  { code: 'FOR', city: 'Fortaleza', country: 'Brasil', airport: 'Pinto Martins', tags: ['brasil', 'nordeste', 'ceara', 'domestico'] },
  { code: 'NAT', city: 'Natal', country: 'Brasil', airport: 'Sao Goncalo do Amarante', tags: ['brasil', 'nordeste', 'domestico'] },
  { code: 'MCZ', city: 'Maceio', country: 'Brasil', airport: 'Zumbi dos Palmares', tags: ['brasil', 'nordeste', 'alagoas', 'domestico'] },
  { code: 'FLN', city: 'Florianopolis', country: 'Brasil', airport: 'Hercilio Luz', tags: ['brasil', 'sul', 'domestico'] },
  { code: 'POA', city: 'Porto Alegre', country: 'Brasil', airport: 'Salgado Filho', tags: ['brasil', 'sul', 'domestico'] },
  { code: 'MAO', city: 'Manaus', country: 'Brasil', airport: 'Eduardo Gomes', tags: ['brasil', 'norte', 'amazonas', 'domestico'] },
  { code: 'BEL', city: 'Belem', country: 'Brasil', airport: 'Val de Cans', tags: ['brasil', 'norte', 'para', 'domestico'] },
  { code: 'IGU', city: 'Foz do Iguacu', country: 'Brasil', airport: 'Cataratas', tags: ['brasil', 'parana', 'domestico'] },
] as const;

/**
 * Busca destinos que correspondem ao texto digitado pelo usuário.
 * Busca por código IATA, cidade, país, aeroporto e tags.
 * Retorna no máximo 25 resultados (limite do Discord).
 */
export function searchDestinations(query: string): Destination[] {
  if (!query || query.trim().length === 0) {
    // Retorna os destinos mais populares quando não há busca
    return DESTINATIONS.slice(0, 25) as unknown as Destination[];
  }

  const normalized = query.toLowerCase().trim();

  const results = DESTINATIONS.filter((dest) => {
    const searchable = [
      dest.code.toLowerCase(),
      dest.city.toLowerCase(),
      dest.country.toLowerCase(),
      dest.airport.toLowerCase(),
      ...dest.tags,
    ].join(' ');

    return searchable.includes(normalized);
  });

  return results.slice(0, 25) as unknown as Destination[];
}

/**
 * Aeroportos de origem disponíveis (Brasil).
 * Usados no autocomplete do parâmetro `origem` em todos os comandos.
 */
export const ORIGINS: readonly Destination[] = [
  { code: 'GRU', city: 'Sao Paulo', country: 'Brasil', airport: 'Guarulhos', tags: ['sao paulo', 'sp', 'brasil', 'sudeste'] },
  { code: 'CGH', city: 'Sao Paulo', country: 'Brasil', airport: 'Congonhas', tags: ['sao paulo', 'sp', 'brasil', 'sudeste'] },
  { code: 'GIG', city: 'Rio de Janeiro', country: 'Brasil', airport: 'Galeao', tags: ['rio', 'rj', 'brasil', 'sudeste'] },
  { code: 'SDU', city: 'Rio de Janeiro', country: 'Brasil', airport: 'Santos Dumont', tags: ['rio', 'rj', 'brasil', 'sudeste'] },
  { code: 'VCP', city: 'Campinas', country: 'Brasil', airport: 'Viracopos', tags: ['campinas', 'sp', 'brasil', 'sudeste'] },
  { code: 'BSB', city: 'Brasilia', country: 'Brasil', airport: 'Juscelino Kubitschek', tags: ['brasilia', 'df', 'brasil', 'centro-oeste'] },
  { code: 'CNF', city: 'Belo Horizonte', country: 'Brasil', airport: 'Confins', tags: ['belo horizonte', 'bh', 'mg', 'brasil', 'sudeste'] },
  { code: 'CWB', city: 'Curitiba', country: 'Brasil', airport: 'Afonso Pena', tags: ['curitiba', 'pr', 'brasil', 'sul'] },
  { code: 'POA', city: 'Porto Alegre', country: 'Brasil', airport: 'Salgado Filho', tags: ['porto alegre', 'rs', 'brasil', 'sul'] },
  { code: 'REC', city: 'Recife', country: 'Brasil', airport: 'Guararapes', tags: ['recife', 'pe', 'brasil', 'nordeste'] },
  { code: 'SSA', city: 'Salvador', country: 'Brasil', airport: 'Dep. Luis Eduardo Magalhaes', tags: ['salvador', 'ba', 'bahia', 'brasil', 'nordeste'] },
  { code: 'FOR', city: 'Fortaleza', country: 'Brasil', airport: 'Pinto Martins', tags: ['fortaleza', 'ce', 'ceara', 'brasil', 'nordeste'] },
  { code: 'FLN', city: 'Florianopolis', country: 'Brasil', airport: 'Hercilio Luz', tags: ['florianopolis', 'sc', 'brasil', 'sul'] },
  { code: 'NAT', city: 'Natal', country: 'Brasil', airport: 'Sao Goncalo do Amarante', tags: ['natal', 'rn', 'brasil', 'nordeste'] },
  { code: 'MCZ', city: 'Maceio', country: 'Brasil', airport: 'Zumbi dos Palmares', tags: ['maceio', 'al', 'alagoas', 'brasil', 'nordeste'] },
  { code: 'MAO', city: 'Manaus', country: 'Brasil', airport: 'Eduardo Gomes', tags: ['manaus', 'am', 'amazonas', 'brasil', 'norte'] },
  { code: 'BEL', city: 'Belem', country: 'Brasil', airport: 'Val de Cans', tags: ['belem', 'pa', 'para', 'brasil', 'norte'] },
  { code: 'IGU', city: 'Foz do Iguacu', country: 'Brasil', airport: 'Cataratas', tags: ['foz', 'iguacu', 'pr', 'parana', 'brasil', 'sul'] },
] as const;

/**
 * Busca origens que correspondem ao texto digitado pelo usuário.
 * Retorna no máximo 25 resultados (limite do Discord).
 */
export function searchOrigins(query: string): Destination[] {
  if (!query || query.trim().length === 0) {
    return ORIGINS.slice(0, 25) as unknown as Destination[];
  }

  const normalized = query.toLowerCase().trim();

  const results = ORIGINS.filter((origin) => {
    const searchable = [
      origin.code.toLowerCase(),
      origin.city.toLowerCase(),
      origin.country.toLowerCase(),
      origin.airport.toLowerCase(),
      ...origin.tags,
    ].join(' ');

    return searchable.includes(normalized);
  });

  return results.slice(0, 25) as unknown as Destination[];
}
