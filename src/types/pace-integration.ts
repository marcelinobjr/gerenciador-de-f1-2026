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
  scale?: number // escala de calibração para ±3 a ±6 pts
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
  noise?: number
  puWearPct?: number
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
