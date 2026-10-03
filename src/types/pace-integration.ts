/**
 * pace-integration.ts
 *
 * BALANCE-EQUATION-02C: Structural Strength -> Pace Integration Types
 * Camada canônica de decomposição e auditoria de ritmo para Qualifying e Race.
 */

export interface PaceBreakdown {
  structuralStrength: number // Base estrutural canônica (0-100)
  trackFitModifier: number // Modificador centrado em zero (aprox ±3 a ±6 pts)
  setupModifier: number // Modificador de evento (acerto, asa, balanço)
  driverEventModifier: number // Fatores de sessão do piloto (execution/rain/adaptation/push)
  tyreModifier: number // Modificador de composto e desgaste
  fuelModifier: number // Modificador de peso de combustível
  wearModifier: number // Modificador de desgaste de PU / fadiga mecânica
  weatherModifier: number // Modificador de chuva/pista
  rngModifier: number // Ruído determinístico ou aleatório pequeno
  finalPace: number // Score ou tempo resultante
  // Metadados adicionais para auditoria telemétrica
  sessionType: 'qualifying' | 'race' | 'practice'
  teamKey: string
  driverId: string
  lapTimeSec: number
  calculatedAt: string
}

export interface TrackFitNormalizationParams {
  rawTrackFitScore: number // 0 a 100
  referenceTrackFit?: number // neutro padrão = 75 (ou média canônica)
  scale?: number // escala de calibração para limites canônicos
  isSpecializedTrack?: boolean // Especialização de pista: clamp ±2.5 pts (vs normal ±2.0 pts)
  hasSpecialization?: boolean // Especialização de equipe/piloto: clamp ±2.5 pts
}

export interface QualifyingPaceIntegrationParams {
  teamKey: string
  driverId: string
  circuitProfile: any
  carTechnicalAttributes?: any
  driverAttributes: {
    speed: number
    consistency?: number
    rain?: number
    morale?: number
    physicalCondition?: number
    adaptation?: number
  }
  tyreCompound?: string
  tyreWearPct?: number
  fuelKg?: number
  setupEfficiency?: number // 0-100, padrão 80 (delta em torno de 0)
  weather?: string
  noise?: number // ruído direto em pontos de pace [-1.0, +1.0]
  seed?: number | string // seed determinístico opcional para geração de RNG calibrado
  hasSpecialization?: boolean // especialização relevante de equipe/piloto para TrackFit
  puWearPct?: number
  f1Starts?: number // largadas de F1 explícitas opcionais para simulação/testes
  pilot?: any // objeto do piloto opcional para fallback canônico de largadas
  qDriverExecutionOverride?: number // override opcional para testes analíticos diretos
}

export interface RacePaceIntegrationParams {
  teamKey: string
  driverId: string
  circuitProfile: any
  carTechnicalAttributes?: any
  driverAttributes: {
    speed: number
    racePace?: number
    consistency?: number
    tireManagement?: number
    rain?: number
    morale?: number
    physicalCondition?: number
  }
  paceMode?: 'PUSH' | 'NORMAL' | 'CONSERVE'
  tyreCompound?: string
  tyreAgeLaps?: number
  tyreWearPct?: number
  fuelKg?: number
  carCondition?: number // 0-100
  weather?: string
  rngNoise?: number
  seed?: number | string
  hasSpecialization?: boolean
  lap?: number
  gridPosition?: number
}

export interface PaceIntegrationAuditResult {
  structuralConnectedQuali: boolean
  structuralConnectedRace: boolean
  legacyTrackFitWeight45: boolean
  duplicateDriverApplication: number
  duplicatePUApplication: number
  duplicateWearApplication: number
  teamNameBonuses: number
  auditPassed: boolean
  divergences: string[]
}

export interface PracticePaceBreakdown {
  structural: number
  trackFit: number
  setup: number
  practiceExecution: number
  program: number
  tyre: number
  fuel: number
  wear: number
  weather: number
  rookieAdaptation: number
  rng: number
  finalPace: number
  lapTimeSec: number
  teamKey: string
  driverId: string
  calculatedAt: string
}

export interface PracticePaceIntegrationParams {
  teamKey: string
  driverId: string
  circuitProfile?: any
  carTechnicalAttributes?: any
  driverAttributes?: {
    speed?: number
    consistency?: number
    technical_feedback?: number
    technicalFeedback?: number
    f1_adaptation?: number
    adaptation?: number
    morale?: number
    experience?: number
    f1Starts?: number
    starts?: number
    rain?: number
  }
  tyreCompound?: string
  tyreWearPct?: number
  fuelKg?: number
  setupEfficiency?: number // neutro = 80 -> (eff - 80) * 0.05
  weather?: string
  puWearPct?: number
  program?: 'car_setup' | 'race_pace' | 'qualifying_sim' | 'tyre_knowledge' | string
  programModifier?: number // se fornecido, override numérico direto do programa
  isRookie?: boolean
  rookieModifier?: number // se fornecido, override numérico direto de novato/adaptação
  noise?: number // ruído direto
  seed?: number | string // seed determinístico
  hasSpecialization?: boolean
  careerId?: string
  seasonYear?: number | string
  round?: number
  session?: 'TL1' | 'TL2' | 'TL3' | 'FP1' | 'FP2' | 'FP3' | string
  attempt?: number
}
