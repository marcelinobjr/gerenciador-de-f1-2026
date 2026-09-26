import type { ClimateProfile } from '@/types/climate'

/**
 * Catálogo Canônico de Perfis Climatológicos (Camada A) dos 24 GPs da Temporada F1 2026.
 *
 * Princípios aplicados:
 * - 100% de cobertura dos 24 GPs canônicos
 * - circuitId compatível com CIRCUIT_PERFORMANCE_PROFILES ('circuit_01' .. 'circuit_24')
 * - round 1..24
 * - Diferenças plausíveis, consistentes e esportivamente interessantes entre os circuitos:
 *   * Sakhir (Bahrein) e Lusail (Catar): quente e muito seco (rainProbability ~ 0.03 a 0.05)
 *   * Spa-Francorchamps: alta variabilidade, chuva frequente (rainProbability ~ 0.48, variability ~ 0.65)
 *   * Silverstone: mais frio, chuva possível (rainProbability ~ 0.38, avgAirTemp ~ 20°C)
 *   * Singapura: quente/úmido tropical, tempestades passageiras (avgAirTemp ~ 30°C, rainProbability ~ 0.35)
 *   * Interlagos (São Paulo): alta variabilidade, frentes frias e mudanças repentinas (rainProbability ~ 0.42, variability ~ 0.60)
 *   * Las Vegas: noturno e frio (avgAirTemp ~ 13°C)
 *   * Abu Dhabi: final de campeonato quente e seco (avgAirTemp ~ 27°C, rainProbability ~ 0.04)
 * - rainIntensityDistribution somando exatamente 1.00 para cada GP
 */
export const CLIMATE_PROFILES: ClimateProfile[] = [
  {
    circuitId: 'circuit_01',
    round: 1,
    gpName: 'Grande Prêmio da Austrália',
    circuitName: 'Circuito de Albert Park, Melbourne',
    country: 'Austrália',
    avgAirTempC: 22,
    tempVariationC: 4,
    rainProbability: 0.22,
    weatherVariability: 0.3,
    rainIntensityDistribution: { light: 0.55, medium: 0.35, heavy: 0.1 },
    transitionProbability: 0.28,
  },
  {
    circuitId: 'circuit_02',
    round: 2,
    gpName: 'Grande Prêmio da China',
    circuitName: 'Circuito Internacional de Xangai',
    country: 'China',
    avgAirTempC: 19,
    tempVariationC: 5,
    rainProbability: 0.28,
    weatherVariability: 0.35,
    rainIntensityDistribution: { light: 0.5, medium: 0.35, heavy: 0.15 },
    transitionProbability: 0.3,
  },
  {
    circuitId: 'circuit_03',
    round: 3,
    gpName: 'Grande Prêmio do Japão',
    circuitName: 'Circuito de Suzuka',
    country: 'Japão',
    avgAirTempC: 18,
    tempVariationC: 4,
    rainProbability: 0.34,
    weatherVariability: 0.4,
    rainIntensityDistribution: { light: 0.45, medium: 0.35, heavy: 0.2 },
    transitionProbability: 0.38,
  },
  {
    circuitId: 'circuit_04',
    round: 4,
    gpName: 'Grande Prêmio do Bahrein',
    circuitName: 'Circuito Internacional do Bahrein, Sakhir',
    country: 'Bahrein',
    avgAirTempC: 28,
    tempVariationC: 3,
    rainProbability: 0.03,
    weatherVariability: 0.05,
    rainIntensityDistribution: { light: 0.8, medium: 0.15, heavy: 0.05 },
    transitionProbability: 0.05,
  },
  {
    circuitId: 'circuit_05',
    round: 5,
    gpName: 'Grande Prêmio da Arábia Saudita',
    circuitName: 'Circuito de Corniche de Jeddah',
    country: 'Arábia Saudita',
    avgAirTempC: 29,
    tempVariationC: 3,
    rainProbability: 0.04,
    weatherVariability: 0.06,
    rainIntensityDistribution: { light: 0.75, medium: 0.2, heavy: 0.05 },
    transitionProbability: 0.06,
  },
  {
    circuitId: 'circuit_06',
    round: 6,
    gpName: 'Grande Prêmio de Miami',
    circuitName: 'Autódromo Internacional de Miami',
    country: 'Estados Unidos',
    avgAirTempC: 29,
    tempVariationC: 3,
    rainProbability: 0.3,
    weatherVariability: 0.42,
    rainIntensityDistribution: { light: 0.4, medium: 0.35, heavy: 0.25 },
    transitionProbability: 0.38,
  },
  {
    circuitId: 'circuit_07',
    round: 7,
    gpName: 'Grande Prêmio do Canadá',
    circuitName: 'Circuito Gilles Villeneuve, Montreal',
    country: 'Canadá',
    avgAirTempC: 21,
    tempVariationC: 5,
    rainProbability: 0.36,
    weatherVariability: 0.45,
    rainIntensityDistribution: { light: 0.45, medium: 0.4, heavy: 0.15 },
    transitionProbability: 0.4,
  },
  {
    circuitId: 'circuit_08',
    round: 8,
    gpName: 'Grande Prêmio de Mônaco',
    circuitName: 'Circuito de Mônaco, Monte Carlo',
    country: 'Mônaco',
    avgAirTempC: 23,
    tempVariationC: 3,
    rainProbability: 0.24,
    weatherVariability: 0.3,
    rainIntensityDistribution: { light: 0.55, medium: 0.35, heavy: 0.1 },
    transitionProbability: 0.25,
  },
  {
    circuitId: 'circuit_09',
    round: 9,
    gpName: 'Grande Prêmio da Espanha (Barcelona)',
    circuitName: 'Circuito de Barcelona-Catalunha',
    country: 'Espanha',
    avgAirTempC: 26,
    tempVariationC: 4,
    rainProbability: 0.15,
    weatherVariability: 0.2,
    rainIntensityDistribution: { light: 0.6, medium: 0.3, heavy: 0.1 },
    transitionProbability: 0.18,
  },
  {
    circuitId: 'circuit_10',
    round: 10,
    gpName: 'Grande Prêmio da Áustria',
    circuitName: 'Red Bull Ring, Spielberg',
    country: 'Áustria',
    avgAirTempC: 22,
    tempVariationC: 5,
    rainProbability: 0.38,
    weatherVariability: 0.48,
    rainIntensityDistribution: { light: 0.4, medium: 0.4, heavy: 0.2 },
    transitionProbability: 0.44,
  },
  {
    circuitId: 'circuit_11',
    round: 11,
    gpName: 'Grande Prêmio da Grã-Bretanha',
    circuitName: 'Circuito de Silverstone',
    country: 'Reino Unido',
    avgAirTempC: 20,
    tempVariationC: 4,
    rainProbability: 0.38,
    weatherVariability: 0.48,
    rainIntensityDistribution: { light: 0.5, medium: 0.35, heavy: 0.15 },
    transitionProbability: 0.45,
  },
  {
    circuitId: 'circuit_12',
    round: 12,
    gpName: 'Grande Prêmio da Bélgica',
    circuitName: 'Circuito de Spa-Francorchamps',
    country: 'Bélgica',
    avgAirTempC: 19,
    tempVariationC: 5,
    rainProbability: 0.48,
    weatherVariability: 0.65,
    rainIntensityDistribution: { light: 0.4, medium: 0.4, heavy: 0.2 },
    transitionProbability: 0.58,
  },
  {
    circuitId: 'circuit_13',
    round: 13,
    gpName: 'Grande Prêmio da Hungria',
    circuitName: 'Hungaroring, Budapeste',
    country: 'Hungria',
    avgAirTempC: 30,
    tempVariationC: 4,
    rainProbability: 0.18,
    weatherVariability: 0.25,
    rainIntensityDistribution: { light: 0.45, medium: 0.35, heavy: 0.2 },
    transitionProbability: 0.22,
  },
  {
    circuitId: 'circuit_14',
    round: 14,
    gpName: 'Grande Prêmio dos Países Baixos',
    circuitName: 'Circuito de Zandvoort',
    country: 'Holanda',
    avgAirTempC: 20,
    tempVariationC: 4,
    rainProbability: 0.4,
    weatherVariability: 0.5,
    rainIntensityDistribution: { light: 0.5, medium: 0.35, heavy: 0.15 },
    transitionProbability: 0.46,
  },
  {
    circuitId: 'circuit_15',
    round: 15,
    gpName: 'Grande Prêmio da Itália',
    circuitName: 'Autodromo Nazionale Monza',
    country: 'Itália',
    avgAirTempC: 27,
    tempVariationC: 4,
    rainProbability: 0.2,
    weatherVariability: 0.25,
    rainIntensityDistribution: { light: 0.55, medium: 0.3, heavy: 0.15 },
    transitionProbability: 0.22,
  },
  {
    circuitId: 'circuit_16',
    round: 16,
    gpName: 'Grande Prêmio de Madri',
    circuitName: 'Circuito Madring, Madrid',
    country: 'Espanha',
    avgAirTempC: 26,
    tempVariationC: 4,
    rainProbability: 0.14,
    weatherVariability: 0.18,
    rainIntensityDistribution: { light: 0.6, medium: 0.3, heavy: 0.1 },
    transitionProbability: 0.16,
  },
  {
    circuitId: 'circuit_17',
    round: 17,
    gpName: 'Grande Prêmio do Azerbaijão',
    circuitName: 'Circuito de Rua de Baku',
    country: 'Azerbaijão',
    avgAirTempC: 24,
    tempVariationC: 3,
    rainProbability: 0.1,
    weatherVariability: 0.15,
    rainIntensityDistribution: { light: 0.65, medium: 0.25, heavy: 0.1 },
    transitionProbability: 0.12,
  },
  {
    circuitId: 'circuit_18',
    round: 18,
    gpName: 'Grande Prêmio de Singapura',
    circuitName: 'Circuito de Rua de Marina Bay',
    country: 'Singapura',
    avgAirTempC: 30,
    tempVariationC: 2,
    rainProbability: 0.35,
    weatherVariability: 0.45,
    rainIntensityDistribution: { light: 0.3, medium: 0.4, heavy: 0.3 },
    transitionProbability: 0.42,
  },
  {
    circuitId: 'circuit_19',
    round: 19,
    gpName: 'Grande Prêmio dos Estados Unidos',
    circuitName: 'Circuito das Américas, Austin',
    country: 'Estados Unidos',
    avgAirTempC: 26,
    tempVariationC: 4,
    rainProbability: 0.24,
    weatherVariability: 0.3,
    rainIntensityDistribution: { light: 0.5, medium: 0.35, heavy: 0.15 },
    transitionProbability: 0.26,
  },
  {
    circuitId: 'circuit_20',
    round: 20,
    gpName: 'Grande Prêmio do México',
    circuitName: 'Autódromo Hermanos Rodríguez, Cidade do México',
    country: 'México',
    avgAirTempC: 22,
    tempVariationC: 4,
    rainProbability: 0.26,
    weatherVariability: 0.32,
    rainIntensityDistribution: { light: 0.5, medium: 0.35, heavy: 0.15 },
    transitionProbability: 0.28,
  },
  {
    circuitId: 'circuit_21',
    round: 21,
    gpName: 'Grande Prêmio de São Paulo',
    circuitName: 'Autódromo José Carlos Pace, Interlagos',
    country: 'Brasil',
    avgAirTempC: 24,
    tempVariationC: 5,
    rainProbability: 0.42,
    weatherVariability: 0.6,
    rainIntensityDistribution: { light: 0.35, medium: 0.45, heavy: 0.2 },
    transitionProbability: 0.55,
  },
  {
    circuitId: 'circuit_22',
    round: 22,
    gpName: 'Grande Prêmio de Las Vegas',
    circuitName: 'Circuito da Las Vegas Strip',
    country: 'Estados Unidos',
    avgAirTempC: 13,
    tempVariationC: 4,
    rainProbability: 0.08,
    weatherVariability: 0.1,
    rainIntensityDistribution: { light: 0.7, medium: 0.25, heavy: 0.05 },
    transitionProbability: 0.08,
  },
  {
    circuitId: 'circuit_23',
    round: 23,
    gpName: 'Grande Prêmio do Catar',
    circuitName: 'Circuito Internacional de Lusail',
    country: 'Catar',
    avgAirTempC: 27,
    tempVariationC: 3,
    rainProbability: 0.05,
    weatherVariability: 0.08,
    rainIntensityDistribution: { light: 0.75, medium: 0.2, heavy: 0.05 },
    transitionProbability: 0.07,
  },
  {
    circuitId: 'circuit_24',
    round: 24,
    gpName: 'Grande Prêmio de Abu Dhabi',
    circuitName: 'Circuito de Yas Marina',
    country: 'Emirados Árabes Unidos',
    avgAirTempC: 27,
    tempVariationC: 3,
    rainProbability: 0.04,
    weatherVariability: 0.06,
    rainIntensityDistribution: { light: 0.8, medium: 0.15, heavy: 0.05 },
    transitionProbability: 0.05,
  },
]

/**
 * Mapa rápido indexado por circuitId estável ('circuit_01' .. 'circuit_24')
 */
export const CLIMATE_PROFILES_BY_CIRCUIT_ID: Record<string, ClimateProfile> =
  CLIMATE_PROFILES.reduce<Record<string, ClimateProfile>>((acc, item) => {
    acc[item.circuitId] = item
    return acc
  }, {})

/**
 * Mapa rápido indexado por round (1..24)
 */
export const CLIMATE_PROFILES_BY_ROUND: Record<number, ClimateProfile> = CLIMATE_PROFILES.reduce<
  Record<number, ClimateProfile>
>((acc, item) => {
  acc[item.round] = item
  return acc
}, {})

/**
 * Aliases de normalização de nomes/pistas para circuitId
 */
const CLIMATE_NAME_ALIASES: Record<string, string> = {
  australia: 'circuit_01',
  melbourne: 'circuit_01',
  'albert park': 'circuit_01',
  china: 'circuit_02',
  xangai: 'circuit_02',
  shanghai: 'circuit_02',
  japao: 'circuit_03',
  japan: 'circuit_03',
  suzuka: 'circuit_03',
  bahrein: 'circuit_04',
  bahrain: 'circuit_04',
  sakhir: 'circuit_04',
  jeddah: 'circuit_05',
  'saudi arabia': 'circuit_05',
  'arabia saudita': 'circuit_05',
  miami: 'circuit_06',
  canada: 'circuit_07',
  montreal: 'circuit_07',
  'gilles villeneuve': 'circuit_07',
  monaco: 'circuit_08',
  'monte carlo': 'circuit_08',
  espanha: 'circuit_09',
  spain: 'circuit_09',
  barcelona: 'circuit_09',
  catalunha: 'circuit_09',
  austria: 'circuit_10',
  spielberg: 'circuit_10',
  'red bull ring': 'circuit_10',
  silverstone: 'circuit_11',
  'gra-bretanha': 'circuit_11',
  britain: 'circuit_11',
  spa: 'circuit_12',
  'spa-francorchamps': 'circuit_12',
  belgica: 'circuit_12',
  belgium: 'circuit_12',
  hungria: 'circuit_13',
  hungary: 'circuit_13',
  budapeste: 'circuit_13',
  hungaroring: 'circuit_13',
  holanda: 'circuit_14',
  netherlands: 'circuit_14',
  zandvoort: 'circuit_14',
  'paises baixos': 'circuit_14',
  monza: 'circuit_15',
  italia: 'circuit_15',
  italy: 'circuit_15',
  madrid: 'circuit_16',
  madri: 'circuit_16',
  madring: 'circuit_16',
  baku: 'circuit_17',
  azerbaijao: 'circuit_17',
  azerbaijan: 'circuit_17',
  singapura: 'circuit_18',
  singapore: 'circuit_18',
  'marina bay': 'circuit_18',
  austin: 'circuit_19',
  cota: 'circuit_19',
  eua: 'circuit_19',
  'estados unidos': 'circuit_19',
  usa: 'circuit_19',
  mexico: 'circuit_20',
  'hermanos rodriguez': 'circuit_20',
  interlagos: 'circuit_21',
  brasil: 'circuit_21',
  brazil: 'circuit_21',
  'sao paulo': 'circuit_21',
  'são paulo': 'circuit_21',
  'las vegas': 'circuit_22',
  vegas: 'circuit_22',
  catar: 'circuit_23',
  qatar: 'circuit_23',
  lusail: 'circuit_23',
  'abu dhabi': 'circuit_24',
  'yas marina': 'circuit_24',
}

/**
 * Consulta ou resolve o ClimateProfile canônico de um GP.
 * Nunca retorna undefined silencioso se puder ser resolvido.
 * Caso passe query inválida, lança erro ou faz fallback seguro apenas como defesa técnica.
 */
export function getClimateProfile(query: {
  circuitId?: string
  round?: number
  circuitName?: string
  country?: string
}): ClimateProfile {
  // 1. Por circuitId direto
  if (query.circuitId) {
    const raw = query.circuitId.trim().toLowerCase()
    if (CLIMATE_PROFILES_BY_CIRCUIT_ID[raw]) {
      return CLIMATE_PROFILES_BY_CIRCUIT_ID[raw]
    }
    const aliased = CLIMATE_NAME_ALIASES[raw]
    if (aliased && CLIMATE_PROFILES_BY_CIRCUIT_ID[aliased]) {
      return CLIMATE_PROFILES_BY_CIRCUIT_ID[aliased]
    }
  }

  // 2. Por round numérico (1..24)
  if (typeof query.round === 'number') {
    const safeRound = Math.max(1, Math.min(24, query.round))
    if (CLIMATE_PROFILES_BY_ROUND[safeRound]) {
      return CLIMATE_PROFILES_BY_ROUND[safeRound]
    }
  }

  // 3. Por correspondência textual em circuitName
  if (query.circuitName) {
    const clean = query.circuitName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()

    for (const [alias, id] of Object.entries(CLIMATE_NAME_ALIASES)) {
      if (clean.includes(alias)) {
        return CLIMATE_PROFILES_BY_CIRCUIT_ID[id]
      }
    }

    const byName = CLIMATE_PROFILES.find((p) => {
      const pClean = p.circuitName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      return pClean.includes(clean) || clean.includes(pClean)
    })
    if (byName) return byName
  }

  // 4. Por país
  if (query.country) {
    const cleanCountry = query.country
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()

    for (const [alias, id] of Object.entries(CLIMATE_NAME_ALIASES)) {
      if (cleanCountry.includes(alias)) {
        return CLIMATE_PROFILES_BY_CIRCUIT_ID[id]
      }
    }

    const byCountry = CLIMATE_PROFILES.find((p) => {
      const cClean = p.country
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      return cClean === cleanCountry || cleanCountry.includes(cClean)
    })
    if (byCountry) return byCountry
  }

  // Defesa técnica final caso todos os campos sejam vazios/inválidos
  return CLIMATE_PROFILES[0]
}
