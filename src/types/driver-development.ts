/**
 * Tipos e Definições do Sistema de Homologação de Pilotos,
 * Academia, Test Drivers e Testes Privados FIA (F1 Manager 2026).
 *
 * Referência funcional: Documento "F1_Manager_2026_Sistema_Homologacao_Pilotos" (13 páginas)
 */

export type DriverRole = 'titular' | 'reserva' | 'test_driver' | 'academia'

/**
 * Status de licença regulamentar FIA:
 * Nível C: Autorização de Teste (simulador, testes privados, desenvolvimento; NÃO pode disputar GP)
 * Nível B: Licença Provisória (testes, sessões permitidas, função de reserva; NÃO titular pleno sem homologação final)
 * Nível A: Super Licença (elegível a ser contratado/escalado como titular de F1)
 */
export type DriverLicenseStatus = 'nivel_c' | 'nivel_b' | 'nivel_a'

/**
 * Status de homologação do piloto:
 * - nao_iniciado: Ainda não ingressou no programa FIA
 * - em_andamento: Programa ativo, realizando testes
 * - aprovado_provisoria: Licença Nível B concedida
 * - superlicenca_concedida: Licença Nível A concedida
 * - teste_adicional: Nota entre 65 e 74, requer mais uma sessão
 * - reprovado: Nota < 65 no ciclo atual
 */
export type HomologationPhase =
  | 'nao_iniciado'
  | 'em_andamento'
  | 'aprovado_provisoria'
  | 'superlicenca_concedida'
  | 'teste_adicional'
  | 'reprovado'

/**
 * 6 Tipos de Teste (arquitetura extensível):
 * - desenvolvimento: Validar carro/peças, feedback técnico, correlação, conhecimento do carro
 * - avaliacao: Medir capacidade do piloto (ritmo, consistência, adaptação, controle)
 * - homologacao: Quilometragem e notas que contam para o Programa FIA
 * - preparacao: Experiência, conhecimento de circuito, confiança
 * - rookie_test: Experiência e avaliação de potencial de jovens
 * - comparativo: Comparar 2 pilotos (avaliação interna, diretoria, rumores, pressão)
 */
export type DriverTestType =
  | 'desenvolvimento'
  | 'avaliacao'
  | 'homologacao'
  | 'preparacao'
  | 'rookie_test'
  | 'comparativo'

export interface DriverTestTypeConfig {
  id: DriverTestType
  name: string
  description: string
  primaryObjective: string
  possibleBenefits: string
  baseCost: number
  standardKm: number
  requiresSecondDriver?: boolean
}

export interface HomologationSystemConfig {
  openingFee: number // R$ 2.500.000 (abertura do programa FIA)
  minValidTests: number // 4 testes válidos
  minKmPerTest: number // 300 km por teste válido
  baseOperatingCostPerTest: number // R$ 1.200.000
  expectedDurationWeeksMin: number // 6
  expectedDurationWeeksMax: number // 10

  // Pesos da avaliação por teste válido (total 100%)
  weights: {
    pace: number // 30% (Ritmo: velocidade e proximidade do potencial)
    consistency: number // 25% (Consistência: capacidade de repetir performance)
    carControl: number // 20% (Controle do carro: erros, estabilidade, condições variadas)
    technicalFeedback: number // 15% (Feedback técnico: utilidade para setup/desenvolvimento)
    disciplineSafety: number // 10% (Disciplina / segurança: incidentes e comportamento)
  }

  // Faixas de nota consolidada
  scoreThresholds: {
    superLicenseMin: number // 85 (85-100: Super Licença Nível A)
    provisionalLicenseMin: number // 75 (75-84: Licença Provisória Nível B)
    additionalTestMin: number // 65 (65-74: Teste adicional obrigatório)
    // < 65: Programa não aprovado naquele momento
  }

  // Limite operacional de Test Drivers simultâneos
  maxTestDriversPerTeam: number // 2
}

/** Configuração balanceada padrão conforme especificação central (nunca hardcoded na UI) */
export const HOMOLOGATION_CONFIG: HomologationSystemConfig = {
  openingFee: 2500000,
  minValidTests: 4,
  minKmPerTest: 300,
  baseOperatingCostPerTest: 1200000,
  expectedDurationWeeksMin: 6,
  expectedDurationWeeksMax: 10,
  weights: {
    pace: 0.3,
    consistency: 0.25,
    carControl: 0.2,
    technicalFeedback: 0.15,
    disciplineSafety: 0.1,
  },
  scoreThresholds: {
    superLicenseMin: 85,
    provisionalLicenseMin: 75,
    additionalTestMin: 65,
  },
  maxTestDriversPerTeam: 2,
}

export const DRIVER_TEST_TYPES_CONFIG: Record<DriverTestType, DriverTestTypeConfig> = {
  desenvolvimento: {
    id: 'desenvolvimento',
    name: 'Desenvolvimento & P&D',
    description: 'Validação de aerodinâmica, suspensão e peças novas em pista com telemetria.',
    primaryObjective: 'Validar carro e novas peças técnicas',
    possibleBenefits:
      'Feedback técnico refinado, correlação simulação-pista e compreensão profunda do chassi.',
    baseCost: 1100000,
    standardKm: 340,
  },
  avaliacao: {
    id: 'avaliacao',
    name: 'Avaliação de Capacidade',
    description: 'Bateria intensiva cronometrada para medir a habilidade pura do piloto.',
    primaryObjective: 'Medir capacidade real do piloto em condições variadas',
    possibleBenefits:
      'Medição precisa de ritmo puro, consistência e capacidade de adaptação imediata.',
    baseCost: 1050000,
    standardKm: 310,
  },
  homologacao: {
    id: 'homologacao',
    name: 'Homologação FIA',
    description: 'Sessão oficial auditada pela FIA para cumprimento dos requisitos regulamentares.',
    primaryObjective: 'Cumprir programa oficial de quilometragem e notas para licença FIA',
    possibleBenefits:
      'Quilometragem auditada e notas computadas diretamente para o relatório de homologação.',
    baseCost: 1200000,
    standardKm: 330,
  },
  preparacao: {
    id: 'preparacao',
    name: 'Preparação & Aclimação',
    description:
      'Foco na simulação de corridas completas, conhecimento de traçado e procedimentos de equipe.',
    primaryObjective: 'Adaptar o piloto à equipe, volantes e rotinas de fim de semana',
    possibleBenefits: 'Ganho expressivo de experiência, adaptação à F1 e confiança.',
    baseCost: 950000,
    standardKm: 320,
  },
  rookie_test: {
    id: 'rookie_test',
    name: 'Rookie Test',
    description:
      'Sessão voltada exclusivamente a jovens talentos para acelerar curva de aprendizado.',
    primaryObjective: 'Desenvolver jovens pilotos e validar projeções de potencial',
    possibleBenefits: 'Desbloqueio de potencial oculto, experiência e salto na progressão técnica.',
    baseCost: 850000,
    standardKm: 300,
  },
  comparativo: {
    id: 'comparativo',
    name: 'Teste Comparativo',
    description:
      'Confronto em pista entre dois pilotos sob as mesmas condições e carga de combustível.',
    primaryObjective: 'Comparar diretamente dois pilotos (ex: Titular vs Test Driver / Jovem)',
    possibleBenefits:
      'Avaliação interna de hierarquia, relatório para a diretoria, rumores e pressão sobre titular.',
    baseCost: 1600000,
    standardKm: 320,
    requiresSecondDriver: true,
  },
}

/**
 * Registro de teste executado no histórico
 */
export interface DriverTestResult {
  id: string
  team_id: string
  driver_id: string
  driver_name: string
  test_type: DriverTestType
  circuit: string
  date: string
  km: number
  cost: number
  isValidForHomologation: boolean // true se km >= 300 e tipo contar para homologação

  // Notas detalhadas por critério (0-100)
  scorePace: number // 30%
  scoreConsistency: number // 25%
  scoreCarControl: number // 20%
  scoreTechnicalFeedback: number // 15%
  scoreDisciplineSafety: number // 10%
  finalScore: number // Média ponderada 0-100

  // Detalhes operacionais e esportivos
  bestLapTime: string // ex: "1:29.401"
  incidents: string[]
  experienceGained: number
  technicalFeedbackGain: number
  feedbackSummary: string

  // Para teste comparativo
  secondDriverId?: string
  secondDriverName?: string
  secondDriverRole?: DriverRole
  secondDriverBestLapTime?: string
  comparisonDeltaSec?: number // >0 piloto 1 mais rápido, <0 piloto 2 mais rápido
  comparisonSummary?: string

  created?: string
}

/**
 * Programa ativo de Homologação FIA de um piloto
 */
export interface DriverHomologationProgram {
  driver_id: string
  team_id: string
  startDate: string
  phase: HomologationPhase
  completedValidTests: number // Meta: mínimo 4
  accumulatedHomologatedKm: number // Meta: >= 1.200 km
  testScores: number[] // Histórico de notas finais de cada teste válido
  averageScore: number // Média das notas dos testes válidos
  openingFeePaid: boolean
  totalSpent: number
  targetLicense: 'nivel_b' | 'nivel_a'
  isEligibleForFinalEvaluation: boolean
  finalEvaluationDate?: string
  verdictNotes?: string
}

/**
 * Vínculo de piloto de desenvolvimento / teste / academia com a equipe
 */
export interface DriverAffiliationModel {
  driver_id: string
  team_id: string
  role: DriverRole // 'titular' | 'reserva' | 'test_driver' | 'academia'
  isAcademy: boolean // Flag de vínculo formativo
  isTestDriver: boolean // Flag de contrato de piloto de testes
  testDriverSalaryAnnual?: number // Custo salarial específico do test driver
  academyStartDate?: string
  licenseStatus: DriverLicenseStatus // 'nivel_c' | 'nivel_b' | 'nivel_a'

  // Variável de assento do titular (Seat Security 0-100, padrão 80)
  seatSecurity?: number

  // Atributo específico de Feedback Técnico (0-100)
  technicalFeedback?: number

  // Progresso de desenvolvimento
  developmentProgress?: {
    lastEvolutionRound?: number
    potentialMax: number
    stagnationRisk: number // 0-100
    trackTimeKmTotal: number
    recentGainsSummary?: string
  }

  // Homologação ativa vinculada
  homologationProgram?: DriverHomologationProgram
}

// ==========================================
// IMPLEMENTAÇÃO Nº 8B — TIPOS CANÔNICOS DE ENVELHECIMENTO, PROGRESSÃO, DECLÍNIO E APOSENTADORIA
// ==========================================

export type DevelopmentCurveArchetype =
  | 'EARLY_BLOOMER' // Evolui cedo, atinge pico antecipado
  | 'NORMAL' // Curva tradicional balanceada
  | 'LATE_BLOOMER' // Evolução lenta no início, pico tardio
  | 'HIGH_VARIANCE' // Progresso irregular com oscilações
  | 'LONG_PRIME' // Pico prolongado, declínio lento

export type CareerStage =
  | 'EARLY_DEVELOPMENT' // Jovem em formação / desenvolvimento acelerado
  | 'DEVELOPMENT' // Em ascensão técnica
  | 'PEAK' // No auge / prime
  | 'STABLE' // Estável pós-pico
  | 'EARLY_DECLINE' // Início de declínio sutil
  | 'DECLINING' // Declínio ativo
  | 'VETERAN_STABLE' // Veterano resiliente focado em experiência/consistência
  | 'RETIRED' // Aposentado

export interface PeakWindow {
  startAge: number // ex: 26
  endAge: number // ex: 31
}

export interface DeclineProfile {
  paceDeclineRate: number // Declínio moderado de velocidade pura (0.3 - 1.2)
  consistencyDeclineRate: number // Declínio de consistência (0.1 - 0.6)
  physicalDeclineRate: number // Declínio de condicionamento físico (0.4 - 1.5)
  experienceRetentionFactor: number // Retenção/compensação por experiência (0.8 - 1.0)
  technicalFeedbackStability: number // Estabilidade do feedback técnico com a idade (0.9 - 1.0)
}

/**
 * Perfil de Desenvolvimento Individual e Persistente do Piloto (Regra 5 da 8B)
 */
export interface DriverDevelopmentProfile {
  driverId: string
  archetype: DevelopmentCurveArchetype
  growthRate: number // 0.6 a 1.4
  peakWindow: PeakWindow
  declineProfile: DeclineProfile
  adaptationRate: number // 0.5 a 1.5
  experienceModifier: number // Acumulador de experiência efetiva
  volatility: number // Variância controlada (-2 a +2)
  longevity: number // 0.5 a 1.5 (prolonga o prime e suaviza declínio)
  learningCeilingMultiplier: number // Modulador da capacidade de aproximação do ceiling
  // Histórico de temporadas para explicabilidade e UI
  currentStage: CareerStage
}

export type RetirementIntentState =
  | 'NO_THOUGHTS' // Sem pensamentos de aposentadoria
  | 'CONSIDERING' // Considerando o futuro / avaliando opções
  | 'LIKELY' // Provável aposentadoria ao término do contrato
  | 'ANNOUNCED' // Aposentadoria anunciada publicamente
  | 'RETIRED' // Efetivamente aposentado

export interface RetirementEvaluation {
  driverId: string
  driverName: string
  age: number
  currentState: RetirementIntentState
  score: number // 0 a 100 de propensão
  primaryFactors: string[] // ex: ["Idade avançada", "Sem vaga titular", "Declínio de ritmo"]
  announcedSeason?: number
  effectiveSeason?: number
}

export interface AttributeGainLoss {
  initial: number
  delta: number
  final: number
}

export interface DriverDevelopmentSeasonLedger {
  seasonYear: number
  driverId: string
  driverName: string
  age: number
  stage: CareerStage
  archetype: DevelopmentCurveArchetype
  attributes: {
    speed: AttributeGainLoss
    consistency: AttributeGainLoss
    rain: AttributeGainLoss
    defense: AttributeGainLoss
    technicalFeedback: AttributeGainLoss
  }
  experienceGained: number
  trackTimeHours: number
  primaryFactors: string[] // Explicabilidade (Regra 33)
  evolutionNarrative: string
}

export interface UniverseEcologyReport {
  seasonYear: number
  totalActiveDrivers: number
  titularDriversCount: number
  reserveDriversCount: number
  academyDriversCount: number
  freeAgentsCount: number
  retiredCount: number
  newGenerationsCount: number
  averageAge: number
  averageSpeed: number
  averageConsistency: number
  starsCount: number
  generationalCount: number
}
