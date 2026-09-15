/**
 * PERFIS TÉCNICOS DOS CIRCUITOS — F1 MANAGER 2026
 * Fonte Canônica: Planilha Oficial "F1_Manager_2026_Perfis_Tecnicos_Circuitos" (23 Rounds)
 *
 * REGRA CRÍTICA DE VALIDAÇÃO:
 * - Cada circuito deve somar EXATAMENTE 100 pontos percentuais nos 12 pesos técnicos.
 * - Se não somar 100, a função de validação dispara um erro explícito (nunca normaliza silenciosamente).
 * - IDs estáveis de circuito: circuit_01 a circuit_23.
 * - Lógica estritamente data-driven: sem condicionais hardcoded do tipo "if circuit === 'Monza'".
 * - Preparado para calendários futuros (novo circuito = novo perfil cadastrado).
 *
 * PARÂMETROS AUXILIARES:
 * - Ativos agora na Fase 0B:
 *     overtakingDifficulty (0-100): modula probabilidade e facilidade de ultrapassagem no motor de corrida.
 *     tyreSeverity (0-100): modula taxa de desgaste e severidade mecânica/térmica sobre os compostos.
 *     driverChallenge (0-100): modula sensibilidade e peso do piloto em voltas de qualificação/ritmo.
 * - Reservados para fases futuras (importados e estruturados, sem ativar mecânicas não testadas):
 *     safetyCarProbability (0-100): propensão inicial a SC/VSC para balanceamento do drama.
 *     rainSensitivity (0-100): sensibilidade à chuva e variação de aderência em pista molhada.
 */

import { TechnicalAttributeId } from '@/types/car-technical-model'

export type CircuitTechnicalCluster =
  | 'alta_velocidade_reta'
  | 'alta_carga_aero'
  | 'baixa_velocidade_tracao'
  | 'pneus_endurance'
  | 'balanceado'

export type CircuitTrackType = 'permanente' | 'urbana' | 'hibrida_urbana'

export interface CircuitTechnicalWeights {
  slowCorner: number
  mediumCorner: number
  fastCorner: number
  topSpeed: number
  acceleration: number
  braking: number
  traction: number
  tyreManagement: number
  aeroEfficiency: number
  cooling: number
  weight: number
  reliability: number
}

export interface CircuitAuxiliaryParams {
  /**
   * Dificuldade de ultrapassagem (0-100, 100 = muito difícil como Mônaco 95, 40 = Monza).
   * STATUS: ATIVO AGORA (integração com getCircuitOvertakeFactor e motor de corrida).
   */
  overtakingDifficulty: number

  /**
   * Severidade térmica e mecânica sobre os pneus (0-100, 100 = altíssima como Lusail 90, Sepang 85, Mônaco 45).
   * STATUS: ATIVO AGORA (integração com f1-tire-system e tyreManagement).
   */
  tyreSeverity: number

  /**
   * Propensão inicial para Safety Car / VSC (0-100).
   * STATUS: RESERVADO PARA FASE FUTURA (mantido para compatibilidade e calibração de drama).
   */
  safetyCarProbability: number

  /**
   * Sensibilidade à chuva e alterações abruptas de aderência (0-100).
   * STATUS: RESERVADO PARA FASE FUTURA (combinação climática expandida).
   */
  rainSensitivity: number

  /**
   * Desafio técnico e de precisão exigido do piloto (0-100).
   * STATUS: ATIVO AGORA (modula peso do piloto vs carro em circuitos de alta exigência).
   */
  driverChallenge: number
}

export interface CircuitPerformanceProfile {
  id: string // circuit_01 ... circuit_23
  round: number // 1 a 23
  country: string
  grandPrixName: string
  circuitName: string
  locationName: string
  startDate: string // DD/MM/YYYY
  endDate: string // DD/MM/YYYY
  hasSprint: boolean
  trackType: CircuitTrackType
  cluster: CircuitTechnicalCluster
  clusterLabel: string // "Balanceado / fluido", "Alta velocidade / reta", etc.
  weights: CircuitTechnicalWeights
  auxiliary: CircuitAuxiliaryParams
  sourceNotes: string
}

/**
 * 23 CIRCUITOS CANÔNICOS DO CALENDÁRIO 2026 CONFORME PLANILHA OFICIAL
 */
export const CIRCUIT_PERFORMANCE_PROFILES: CircuitPerformanceProfile[] = [
  // Round 1 - Australia
  {
    id: 'circuit_01',
    round: 1,
    country: 'Australia',
    grandPrixName: 'Australian GP',
    circuitName: 'Albert Park, Melbourne',
    locationName: 'Melbourne',
    startDate: '06/03/2026',
    endDate: '08/03/2026',
    hasSprint: false,
    trackType: 'hibrida_urbana',
    cluster: 'balanceado',
    clusterLabel: 'Balanceado / fluido',
    weights: {
      slowCorner: 8,
      mediumCorner: 10,
      fastCorner: 9,
      topSpeed: 9,
      acceleration: 9,
      braking: 9,
      traction: 9,
      tyreManagement: 7,
      aeroEfficiency: 10,
      cooling: 6,
      weight: 7,
      reliability: 7,
    },
    auxiliary: {
      overtakingDifficulty: 65,
      tyreSeverity: 55,
      safetyCarProbability: 60,
      rainSensitivity: 55,
      driverChallenge: 55,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 2 - China
  {
    id: 'circuit_02',
    round: 2,
    country: 'China',
    grandPrixName: 'Chinese GP',
    circuitName: 'Shanghai International Circuit',
    locationName: 'Shanghai',
    startDate: '13/03/2026',
    endDate: '15/03/2026',
    hasSprint: true,
    trackType: 'permanente',
    cluster: 'balanceado',
    clusterLabel: 'Balanceado / tração',
    weights: {
      slowCorner: 7,
      mediumCorner: 10,
      fastCorner: 7,
      topSpeed: 11,
      acceleration: 10,
      braking: 8,
      traction: 8,
      tyreManagement: 9,
      aeroEfficiency: 9,
      cooling: 7,
      weight: 7,
      reliability: 7,
    },
    auxiliary: {
      overtakingDifficulty: 55,
      tyreSeverity: 70,
      safetyCarProbability: 50,
      rainSensitivity: 55,
      driverChallenge: 50,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 3 - Japan
  {
    id: 'circuit_03',
    round: 3,
    country: 'Japan',
    grandPrixName: 'Japanese GP',
    circuitName: 'Suzuka Circuit',
    locationName: 'Suzuka',
    startDate: '27/03/2026',
    endDate: '29/03/2026',
    hasSprint: false,
    trackType: 'permanente',
    cluster: 'alta_carga_aero',
    clusterLabel: 'Alta carga / alta velocidade',
    weights: {
      slowCorner: 5,
      mediumCorner: 11,
      fastCorner: 12,
      topSpeed: 9,
      acceleration: 7,
      braking: 6,
      traction: 7,
      tyreManagement: 10,
      aeroEfficiency: 12,
      cooling: 7,
      weight: 6,
      reliability: 8,
    },
    auxiliary: {
      overtakingDifficulty: 75,
      tyreSeverity: 65,
      safetyCarProbability: 45,
      rainSensitivity: 60,
      driverChallenge: 65,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 4 - United States (Miami)
  {
    id: 'circuit_04',
    round: 4,
    country: 'United States',
    grandPrixName: 'Miami GP',
    circuitName: 'Miami International Autodrome',
    locationName: 'Miami',
    startDate: '01/05/2026',
    endDate: '03/05/2026',
    hasSprint: true,
    trackType: 'hibrida_urbana',
    cluster: 'alta_velocidade_reta',
    clusterLabel: 'Stop-and-go / reta',
    weights: {
      slowCorner: 8,
      mediumCorner: 7,
      fastCorner: 6,
      topSpeed: 11,
      acceleration: 11,
      braking: 10,
      traction: 9,
      tyreManagement: 7,
      aeroEfficiency: 8,
      cooling: 8,
      weight: 8,
      reliability: 7,
    },
    auxiliary: {
      overtakingDifficulty: 55,
      tyreSeverity: 65,
      safetyCarProbability: 75,
      rainSensitivity: 70,
      driverChallenge: 55,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 5 - Canada
  {
    id: 'circuit_05',
    round: 5,
    country: 'Canada',
    grandPrixName: 'Canadian GP',
    circuitName: 'Circuit Gilles-Villeneuve, Montréal',
    locationName: 'Montréal',
    startDate: '22/05/2026',
    endDate: '24/05/2026',
    hasSprint: true,
    trackType: 'hibrida_urbana',
    cluster: 'alta_velocidade_reta',
    clusterLabel: 'Baixa carga / frenagem',
    weights: {
      slowCorner: 8,
      mediumCorner: 5,
      fastCorner: 4,
      topSpeed: 12,
      acceleration: 12,
      braking: 12,
      traction: 10,
      tyreManagement: 6,
      aeroEfficiency: 6,
      cooling: 7,
      weight: 10,
      reliability: 8,
    },
    auxiliary: {
      overtakingDifficulty: 70,
      tyreSeverity: 55,
      safetyCarProbability: 75,
      rainSensitivity: 60,
      driverChallenge: 55,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 6 - Monaco
  {
    id: 'circuit_06',
    round: 6,
    country: 'Monaco',
    grandPrixName: 'Monaco GP',
    circuitName: 'Circuit de Monaco',
    locationName: 'Monte Carlo',
    startDate: '05/06/2026',
    endDate: '07/06/2026',
    hasSprint: false,
    trackType: 'urbana',
    cluster: 'baixa_velocidade_tracao',
    clusterLabel: 'Rua / máxima carga',
    weights: {
      slowCorner: 12,
      mediumCorner: 7,
      fastCorner: 3,
      topSpeed: 2,
      acceleration: 10,
      braking: 11,
      traction: 12,
      tyreManagement: 6,
      aeroEfficiency: 7,
      cooling: 10,
      weight: 11,
      reliability: 9,
    },
    auxiliary: {
      overtakingDifficulty: 95,
      tyreSeverity: 45,
      safetyCarProbability: 85,
      rainSensitivity: 55,
      driverChallenge: 45,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 7 - Spain (Barcelona)
  {
    id: 'circuit_07',
    round: 7,
    country: 'Spain',
    grandPrixName: 'Barcelona-Catalunya GP',
    circuitName: 'Circuit de Barcelona-Catalunya',
    locationName: 'Montmeló',
    startDate: '12/06/2026',
    endDate: '14/06/2026',
    hasSprint: false,
    trackType: 'permanente',
    cluster: 'alta_carga_aero',
    clusterLabel: 'Alta carga / balanceado',
    weights: {
      slowCorner: 7,
      mediumCorner: 11,
      fastCorner: 11,
      topSpeed: 7,
      acceleration: 7,
      braking: 7,
      traction: 7,
      tyreManagement: 10,
      aeroEfficiency: 12,
      cooling: 7,
      weight: 6,
      reliability: 8,
    },
    auxiliary: {
      overtakingDifficulty: 80,
      tyreSeverity: 70,
      safetyCarProbability: 35,
      rainSensitivity: 50,
      driverChallenge: 55,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 8 - Austria
  {
    id: 'circuit_08',
    round: 8,
    country: 'Austria',
    grandPrixName: 'Austrian GP',
    circuitName: 'Red Bull Ring, Spielberg',
    locationName: 'Spielberg',
    startDate: '26/06/2026',
    endDate: '28/06/2026',
    hasSprint: false,
    trackType: 'permanente',
    cluster: 'alta_velocidade_reta',
    clusterLabel: 'Reta / tração',
    weights: {
      slowCorner: 6,
      mediumCorner: 6,
      fastCorner: 7,
      topSpeed: 12,
      acceleration: 12,
      braking: 11,
      traction: 9,
      tyreManagement: 6,
      aeroEfficiency: 8,
      cooling: 7,
      weight: 9,
      reliability: 7,
    },
    auxiliary: {
      overtakingDifficulty: 45,
      tyreSeverity: 55,
      safetyCarProbability: 50,
      rainSensitivity: 50,
      driverChallenge: 45,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 9 - United Kingdom
  {
    id: 'circuit_09',
    round: 9,
    country: 'United Kingdom',
    grandPrixName: 'British GP',
    circuitName: 'Silverstone Circuit',
    locationName: 'Silverstone',
    startDate: '03/07/2026',
    endDate: '05/07/2026',
    hasSprint: true,
    trackType: 'permanente',
    cluster: 'alta_carga_aero',
    clusterLabel: 'Alta velocidade / aero',
    weights: {
      slowCorner: 5,
      mediumCorner: 10,
      fastCorner: 12,
      topSpeed: 10,
      acceleration: 9,
      braking: 6,
      traction: 7,
      tyreManagement: 10,
      aeroEfficiency: 12,
      cooling: 6,
      weight: 5,
      reliability: 8,
    },
    auxiliary: {
      overtakingDifficulty: 60,
      tyreSeverity: 65,
      safetyCarProbability: 50,
      rainSensitivity: 55,
      driverChallenge: 70,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 10 - Belgium
  {
    id: 'circuit_10',
    round: 10,
    country: 'Belgium',
    grandPrixName: 'Belgian GP',
    circuitName: 'Circuit de Spa-Francorchamps',
    locationName: 'Spa-Francorchamps',
    startDate: '17/07/2026',
    endDate: '19/07/2026',
    hasSprint: false,
    trackType: 'permanente',
    cluster: 'alta_velocidade_reta',
    clusterLabel: 'Alta velocidade / eficiência',
    weights: {
      slowCorner: 5,
      mediumCorner: 8,
      fastCorner: 11,
      topSpeed: 11,
      acceleration: 10,
      braking: 7,
      traction: 7,
      tyreManagement: 9,
      aeroEfficiency: 10,
      cooling: 7,
      weight: 6,
      reliability: 9,
    },
    auxiliary: {
      overtakingDifficulty: 55,
      tyreSeverity: 75,
      safetyCarProbability: 60,
      rainSensitivity: 80,
      driverChallenge: 80,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 11 - Hungary
  {
    id: 'circuit_11',
    round: 11,
    country: 'Hungary',
    grandPrixName: 'Hungarian GP',
    circuitName: 'Hungaroring, Budapest',
    locationName: 'Budapest',
    startDate: '24/07/2026',
    endDate: '26/07/2026',
    hasSprint: false,
    trackType: 'permanente',
    cluster: 'baixa_velocidade_tracao',
    clusterLabel: 'Alta carga / baixa velocidade',
    weights: {
      slowCorner: 10,
      mediumCorner: 10,
      fastCorner: 6,
      topSpeed: 3,
      acceleration: 7,
      braking: 8,
      traction: 10,
      tyreManagement: 11,
      aeroEfficiency: 10,
      cooling: 9,
      weight: 8,
      reliability: 8,
    },
    auxiliary: {
      overtakingDifficulty: 85,
      tyreSeverity: 75,
      safetyCarProbability: 40,
      rainSensitivity: 60,
      driverChallenge: 55,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 12 - Netherlands
  {
    id: 'circuit_12',
    round: 12,
    country: 'Netherlands',
    grandPrixName: 'Dutch GP',
    circuitName: 'Circuit Zandvoort',
    locationName: 'Zandvoort',
    startDate: '21/08/2026',
    endDate: '23/08/2026',
    hasSprint: true,
    trackType: 'permanente',
    cluster: 'alta_carga_aero',
    clusterLabel: 'Alta carga / técnico',
    weights: {
      slowCorner: 8,
      mediumCorner: 11,
      fastCorner: 9,
      topSpeed: 5,
      acceleration: 7,
      braking: 7,
      traction: 9,
      tyreManagement: 11,
      aeroEfficiency: 11,
      cooling: 7,
      weight: 7,
      reliability: 8,
    },
    auxiliary: {
      overtakingDifficulty: 85,
      tyreSeverity: 75,
      safetyCarProbability: 65,
      rainSensitivity: 60,
      driverChallenge: 70,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 13 - Italy
  {
    id: 'circuit_13',
    round: 13,
    country: 'Italy',
    grandPrixName: 'Italian GP',
    circuitName: 'Autodromo Nazionale Monza',
    locationName: 'Monza',
    startDate: '04/09/2026',
    endDate: '06/09/2026',
    hasSprint: false,
    trackType: 'permanente',
    cluster: 'alta_velocidade_reta',
    clusterLabel: 'Baixíssima carga / reta',
    weights: {
      slowCorner: 4,
      mediumCorner: 4,
      fastCorner: 6,
      topSpeed: 12,
      acceleration: 12,
      braking: 12,
      traction: 9,
      tyreManagement: 5,
      aeroEfficiency: 9,
      cooling: 7,
      weight: 11,
      reliability: 9,
    },
    auxiliary: {
      overtakingDifficulty: 40,
      tyreSeverity: 45,
      safetyCarProbability: 45,
      rainSensitivity: 55,
      driverChallenge: 50,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 14 - Spain (Madrid)
  {
    id: 'circuit_14',
    round: 14,
    country: 'Spain',
    grandPrixName: 'Spanish GP (Madrid)',
    circuitName: 'Madrid Street Circuit',
    locationName: 'Madrid',
    startDate: '11/09/2026',
    endDate: '13/09/2026',
    hasSprint: false,
    trackType: 'hibrida_urbana',
    cluster: 'balanceado',
    clusterLabel: 'Rua / balanceado',
    weights: {
      slowCorner: 8,
      mediumCorner: 8,
      fastCorner: 6,
      topSpeed: 10,
      acceleration: 9,
      braking: 9,
      traction: 9,
      tyreManagement: 8,
      aeroEfficiency: 8,
      cooling: 9,
      weight: 8,
      reliability: 8,
    },
    auxiliary: {
      overtakingDifficulty: 75,
      tyreSeverity: 65,
      safetyCarProbability: 70,
      rainSensitivity: 60,
      driverChallenge: 55,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 15 - Azerbaijan
  {
    id: 'circuit_15',
    round: 15,
    country: 'Azerbaijan',
    grandPrixName: 'Azerbaijan GP',
    circuitName: 'Baku City Circuit',
    locationName: 'Baku',
    startDate: '24/09/2026',
    endDate: '26/09/2026',
    hasSprint: false,
    trackType: 'urbana',
    cluster: 'alta_velocidade_reta',
    clusterLabel: 'Rua / reta extrema',
    weights: {
      slowCorner: 10,
      mediumCorner: 5,
      fastCorner: 4,
      topSpeed: 12,
      acceleration: 12,
      braking: 10,
      traction: 10,
      tyreManagement: 6,
      aeroEfficiency: 6,
      cooling: 8,
      weight: 9,
      reliability: 8,
    },
    auxiliary: {
      overtakingDifficulty: 65,
      tyreSeverity: 50,
      safetyCarProbability: 80,
      rainSensitivity: 55,
      driverChallenge: 45,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 16 - Malaysia (Sepang - Bahrain GP realocado)
  {
    id: 'circuit_16',
    round: 16,
    country: 'Malaysia',
    grandPrixName: 'Bahrain GP in Malaysia',
    circuitName: 'Sepang International Circuit',
    locationName: 'Sepang',
    startDate: '02/10/2026',
    endDate: '04/10/2026',
    hasSprint: false,
    trackType: 'permanente',
    cluster: 'pneus_endurance',
    clusterLabel: 'Alta carga térmica / balanceado',
    weights: {
      slowCorner: 5,
      mediumCorner: 8,
      fastCorner: 10,
      topSpeed: 10,
      acceleration: 8,
      braking: 7,
      traction: 7,
      tyreManagement: 11,
      aeroEfficiency: 9,
      cooling: 11,
      weight: 6,
      reliability: 8,
    },
    auxiliary: {
      overtakingDifficulty: 55,
      tyreSeverity: 85,
      safetyCarProbability: 55,
      rainSensitivity: 90,
      driverChallenge: 75,
    },
    sourceNotes: 'Bahrain GP realocado para Sepang - formula1.com/en/latest/article/...',
  },
  // Round 17 - Singapore
  {
    id: 'circuit_17',
    round: 17,
    country: 'Singapore',
    grandPrixName: 'Singapore GP',
    circuitName: 'Marina Bay Street Circuit',
    locationName: 'Marina Bay',
    startDate: '09/10/2026',
    endDate: '11/10/2026',
    hasSprint: true,
    trackType: 'urbana',
    cluster: 'baixa_velocidade_tracao',
    clusterLabel: 'Rua / tração / calor',
    weights: {
      slowCorner: 11,
      mediumCorner: 7,
      fastCorner: 3,
      topSpeed: 5,
      acceleration: 7,
      braking: 10,
      traction: 11,
      tyreManagement: 10,
      aeroEfficiency: 7,
      cooling: 11,
      weight: 9,
      reliability: 9,
    },
    auxiliary: {
      overtakingDifficulty: 90,
      tyreSeverity: 85,
      safetyCarProbability: 90,
      rainSensitivity: 90,
      driverChallenge: 75,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 18 - United States (Austin - COTA)
  {
    id: 'circuit_18',
    round: 18,
    country: 'United States',
    grandPrixName: 'United States GP',
    circuitName: 'Circuit of the Americas, Austin',
    locationName: 'Austin',
    startDate: '23/10/2026',
    endDate: '25/10/2026',
    hasSprint: false,
    trackType: 'permanente',
    cluster: 'balanceado',
    clusterLabel: 'Balanceado / técnico',
    weights: {
      slowCorner: 7,
      mediumCorner: 10,
      fastCorner: 9,
      topSpeed: 9,
      acceleration: 9,
      braking: 9,
      traction: 9,
      tyreManagement: 8,
      aeroEfficiency: 10,
      cooling: 7,
      weight: 6,
      reliability: 7,
    },
    auxiliary: {
      overtakingDifficulty: 60,
      tyreSeverity: 75,
      safetyCarProbability: 45,
      rainSensitivity: 65,
      driverChallenge: 55,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 19 - Mexico
  {
    id: 'circuit_19',
    round: 19,
    country: 'Mexico',
    grandPrixName: 'Mexico City GP',
    circuitName: 'Autódromo Hermanos Rodríguez',
    locationName: 'Mexico City',
    startDate: '30/10/2026',
    endDate: '01/11/2026',
    hasSprint: false,
    trackType: 'permanente',
    cluster: 'alta_velocidade_reta',
    clusterLabel: 'Reta / altitude / refrigeração',
    weights: {
      slowCorner: 8,
      mediumCorner: 6,
      fastCorner: 4,
      topSpeed: 11,
      acceleration: 10,
      braking: 9,
      traction: 9,
      tyreManagement: 8,
      aeroEfficiency: 7,
      cooling: 11,
      weight: 8,
      reliability: 9,
    },
    auxiliary: {
      overtakingDifficulty: 55,
      tyreSeverity: 65,
      safetyCarProbability: 50,
      rainSensitivity: 70,
      driverChallenge: 50,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 20 - Brazil
  {
    id: 'circuit_20',
    round: 20,
    country: 'Brazil',
    grandPrixName: 'São Paulo GP',
    circuitName: 'Autódromo José Carlos Pace, Interlagos',
    locationName: 'São Paulo',
    startDate: '06/11/2026',
    endDate: '08/11/2026',
    hasSprint: false,
    trackType: 'permanente',
    cluster: 'pneus_endurance',
    clusterLabel: 'Balanceado / tração',
    weights: {
      slowCorner: 7,
      mediumCorner: 7,
      fastCorner: 6,
      topSpeed: 9,
      acceleration: 10,
      braking: 9,
      traction: 10,
      tyreManagement: 10,
      aeroEfficiency: 9,
      cooling: 8,
      weight: 7,
      reliability: 8,
    },
    auxiliary: {
      overtakingDifficulty: 55,
      tyreSeverity: 75,
      safetyCarProbability: 65,
      rainSensitivity: 80,
      driverChallenge: 70,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 21 - United States (Las Vegas)
  {
    id: 'circuit_21',
    round: 21,
    country: 'United States',
    grandPrixName: 'Las Vegas GP',
    circuitName: 'Las Vegas Strip Circuit',
    locationName: 'Las Vegas',
    startDate: '19/11/2026',
    endDate: '21/11/2026',
    hasSprint: false,
    trackType: 'urbana',
    cluster: 'alta_velocidade_reta',
    clusterLabel: 'Rua / reta extrema',
    weights: {
      slowCorner: 8,
      mediumCorner: 5,
      fastCorner: 4,
      topSpeed: 12,
      acceleration: 12,
      braking: 12,
      traction: 9,
      tyreManagement: 7,
      aeroEfficiency: 6,
      cooling: 6,
      weight: 11,
      reliability: 8,
    },
    auxiliary: {
      overtakingDifficulty: 50,
      tyreSeverity: 45,
      safetyCarProbability: 70,
      rainSensitivity: 40,
      driverChallenge: 40,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 22 - Qatar
  {
    id: 'circuit_22',
    round: 22,
    country: 'Qatar',
    grandPrixName: 'Qatar GP',
    circuitName: 'Lusail International Circuit',
    locationName: 'Lusail',
    startDate: '27/11/2026',
    endDate: '29/11/2026',
    hasSprint: false,
    trackType: 'permanente',
    cluster: 'pneus_endurance',
    clusterLabel: 'Alta velocidade / pneus',
    weights: {
      slowCorner: 3,
      mediumCorner: 8,
      fastCorner: 12,
      topSpeed: 9,
      acceleration: 8,
      braking: 6,
      traction: 6,
      tyreManagement: 12,
      aeroEfficiency: 11,
      cooling: 10,
      weight: 6,
      reliability: 9,
    },
    auxiliary: {
      overtakingDifficulty: 70,
      tyreSeverity: 90,
      safetyCarProbability: 40,
      rainSensitivity: 55,
      driverChallenge: 65,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
  // Round 23 - United Arab Emirates
  {
    id: 'circuit_23',
    round: 23,
    country: 'United Arab Emirates',
    grandPrixName: 'Abu Dhabi GP',
    circuitName: 'Yas Marina Circuit',
    locationName: 'Abu Dhabi',
    startDate: '04/12/2026',
    endDate: '06/12/2026',
    hasSprint: false,
    trackType: 'permanente',
    cluster: 'balanceado',
    clusterLabel: 'Tração / reta / frenagem',
    weights: {
      slowCorner: 8,
      mediumCorner: 8,
      fastCorner: 5,
      topSpeed: 10,
      acceleration: 10,
      braking: 9,
      traction: 9,
      tyreManagement: 8,
      aeroEfficiency: 8,
      cooling: 9,
      weight: 8,
      reliability: 8,
    },
    auxiliary: {
      overtakingDifficulty: 55,
      tyreSeverity: 65,
      safetyCarProbability: 45,
      rainSensitivity: 45,
      driverChallenge: 40,
    },
    sourceNotes: 'Estimativa de game design MBJ/OpenAI - formula1.com/en/racing/2026',
  },
]

// ============================================================================
// VALIDAÇÃO AUTOMÁTICA DOS PESOS (Soma obrigatória = 100)
// ============================================================================

export interface CircuitValidationResult {
  valid: boolean
  errors: string[]
  circuitChecks: Array<{
    id: string
    round: number
    name: string
    sum: number
    status: 'OK' | 'ERRO'
    maxAttribute: TechnicalAttributeId
    maxValue: number
  }>
}

/**
 * Valida se todos os perfis de circuito cadastrados somam exatamente 100 pontos.
 * Se algum circuito violar a regra, retorna valid: false com o detalhe de erro.
 * Pode ser chamado com throwIfInvalid=true para travar dev/testes imediatamente.
 */
export function validateCircuitPerformanceProfiles(
  throwIfInvalid = false,
): CircuitValidationResult {
  const errors: string[] = []
  const circuitChecks: CircuitValidationResult['circuitChecks'] = []

  for (const profile of CIRCUIT_PERFORMANCE_PROFILES) {
    const w = profile.weights
    const sum =
      w.slowCorner +
      w.mediumCorner +
      w.fastCorner +
      w.topSpeed +
      w.acceleration +
      w.braking +
      w.traction +
      w.tyreManagement +
      w.aeroEfficiency +
      w.cooling +
      w.weight +
      w.reliability

    // Identificar o maior peso do traçado
    let maxAttr: TechnicalAttributeId = 'slowCorner'
    let maxVal = -Infinity
    for (const [key, val] of Object.entries(w)) {
      if (val > maxVal) {
        maxVal = val
        maxAttr = key as TechnicalAttributeId
      }
    }

    const isOk = Math.round(sum) === 100
    circuitChecks.push({
      id: profile.id,
      round: profile.round,
      name: profile.circuitName,
      sum,
      status: isOk ? 'OK' : 'ERRO',
      maxAttribute: maxAttr,
      maxValue: maxVal,
    })

    if (!isOk) {
      errors.push(
        `[Circuito Inválido] ${profile.id} (${profile.circuitName}) soma ${sum} pesos em vez de exatamente 100.`,
      )
    }
  }

  const valid = errors.length === 0
  if (!valid && throwIfInvalid) {
    throw new Error(`Erro fatal na base canônica de circuitos: \n${errors.join('\n')}`)
  }

  return {
    valid,
    errors,
    circuitChecks,
  }
}

// Execução imediata de sanidade durante o carregamento do módulo
const _initialValidation = validateCircuitPerformanceProfiles(false)
if (!_initialValidation.valid) {
  // eslint-disable-next-line no-console
  console.error(
    '[circuit-performance-profiles] Erros de validação detectados:',
    _initialValidation.errors,
  )
}

// ============================================================================
// HELPERS DE RESOLUÇÃO DATA-DRIVEN
// ============================================================================

/**
 * Busca perfil de circuito por ID estável ('circuit_01' a 'circuit_23')
 */
export function getCircuitProfileById(id?: string): CircuitPerformanceProfile | undefined {
  if (!id) return undefined
  return CIRCUIT_PERFORMANCE_PROFILES.find((c) => c.id === id)
}

/**
 * Busca perfil de circuito por Round do calendário (1 a 23)
 */
export function getCircuitProfileByRound(round?: number): CircuitPerformanceProfile {
  if (!round || round < 1) return CIRCUIT_PERFORMANCE_PROFILES[0]
  const found = CIRCUIT_PERFORMANCE_PROFILES.find((c) => c.round === round)
  return found || CIRCUIT_PERFORMANCE_PROFILES[0]
}

/**
 * Resolve o perfil do circuito de maneira data-driven e tolerante a partir de:
 * 1. circuit_id explícito
 * 2. round numérico
 * 3. correspondência por texto de nome/país/local
 */
export function resolveCircuitProfile(query?: {
  circuitId?: string
  round?: number
  circuitName?: string
  country?: string
}): CircuitPerformanceProfile {
  if (query?.circuitId) {
    const p = getCircuitProfileById(query.circuitId)
    if (p) return p
  }

  if (
    typeof query?.round === 'number' &&
    query.round >= 1 &&
    query.round <= CIRCUIT_PERFORMANCE_PROFILES.length
  ) {
    const p = getCircuitProfileByRound(query.round)
    if (p) return p
  }

  if (query?.circuitName) {
    const q = query.circuitName.toLowerCase()
    const found = CIRCUIT_PERFORMANCE_PROFILES.find((c) => {
      const matchName =
        c.circuitName.toLowerCase().includes(q) || q.includes(c.circuitName.toLowerCase())
      const matchGp =
        c.grandPrixName.toLowerCase().includes(q) || q.includes(c.grandPrixName.toLowerCase())
      const matchLoc =
        c.locationName.toLowerCase().includes(q) || q.includes(c.locationName.toLowerCase())
      return matchName || matchGp || matchLoc
    })
    if (found) return found
  }

  if (query?.country) {
    const cLower = query.country.toLowerCase()
    const found = CIRCUIT_PERFORMANCE_PROFILES.find((c) => c.country.toLowerCase() === cLower)
    if (found) return found
  }

  // Fallback seguro: primeiro circuito (Albert Park)
  return CIRCUIT_PERFORMANCE_PROFILES[0]
}
