/**
 * src/lib/race/practiceSessionIntegrator.ts
 *
 * Integração pura e canônica dos Treinos Livres com acerto persistido conforme
 * regras R07/R08 (arquivo 01), fórmulas (arquivo 03) e vetores RF04..RF08 (arquivo 02).
 *
 * RACE-TL-01:
 * - TL1: 24 voltas planejadas, max ganho 40, offset 1.5s, soft prob 0.3
 * - TL2: 26 voltas planejadas, max ganho 40, offset 0.8s, soft prob 0.5
 * - TL3: 18 voltas planejadas, max ganho 30, offset 0.2s, soft prob 0.8
 * - Acerto acumulado limitado a 100
 * - Bônus quali: 100 de acerto = 0.250 s
 * - Bônus corrida: 100 de acerto = 0.150 s/volta
 */

import { calculatePracticeSetupGain, applySetupCap } from './pureRaceEngine'
import type { VersionedRaceConfig } from './types'

export interface PracticeSessionTableEntry {
  session: 'TL1' | 'TL2' | 'TL3'
  laps: number
  max_setup_gain: number
  time_offset_sec: number
  soft_tyre_prob: number
}

export interface SessionParticipant {
  teamId: string
  carIndex: 1 | 2
  driverId: string
  driverName?: string
  isReserve?: boolean
  consistency: number // 1..100
}

export interface PracticeSessionResultItem {
  teamId: string
  carIndex: 1 | 2
  driverId: string
  isReserve: boolean
  lapsCompleted: number
  plannedLaps: number
  tyreCompound: string
  sessionGain: number
  accumulatedSetup: number
  qualifyingBonusSeconds: number
  raceBonusSecondsPerLap: number
  bestLapTimeMs?: number
  longRunPaceMs?: number
}

export interface PersistedWeekendSetupState {
  version: string
  sha256?: string
  careerId: string
  seasonId: string
  round: number
  isSprint: boolean
  lastCompletedSession: 'TL1' | 'TL2' | 'TL3' | null
  carSetups: Record<
    string, // key: `${teamId}_car${carIndex}`
    {
      teamId: string
      carIndex: 1 | 2
      accumulatedSetup: number // 0..100
      qualifyingBonusSeconds: number
      raceBonusSecondsPerLap: number
      sessions: {
        session: 'TL1' | 'TL2' | 'TL3'
        driverId: string
        isReserve: boolean
        lapsCompleted: number
        plannedLaps: number
        sessionGain: number
        accumulatedSetup: number
        tyreCompound: string
        timestamp: string
      }[]
    }
  >
}

/**
 * Retorna as regras de sessão da configuração versionada ou o fallback canônico v1.
 */
export function getPracticeSessionRules(
  config: VersionedRaceConfig,
  session: 'TL1' | 'TL2' | 'TL3',
): PracticeSessionTableEntry {
  const tables = config.tables as { practices?: PracticeSessionTableEntry[] } | undefined
  if (tables?.practices && Array.isArray(tables.practices)) {
    const found = tables.practices.find((p) => p.session === session)
    if (found) return found
  }
  // Fallback padrão R07 / R08 do pacote oficial v1
  switch (session) {
    case 'TL1':
      return {
        session: 'TL1',
        laps: 24,
        max_setup_gain: 40,
        time_offset_sec: 1.5,
        soft_tyre_prob: 0.3,
      }
    case 'TL2':
      return {
        session: 'TL2',
        laps: 26,
        max_setup_gain: 40,
        time_offset_sec: 0.8,
        soft_tyre_prob: 0.5,
      }
    case 'TL3':
      return {
        session: 'TL3',
        laps: 18,
        max_setup_gain: 30,
        time_offset_sec: 0.2,
        soft_tyre_prob: 0.8,
      }
  }
}

/**
 * Determina o sorteio determinístico de composto para o TL a partir de um valor uniforme [0, 1).
 */
export function resolvePracticeCompound(
  softTyreProb: number,
  drawUniform: number,
): 'Macio' | 'Médio' {
  return drawUniform < softTyreProb ? 'Macio' : 'Médio'
}

/**
 * Simula a quantidade de voltas completadas a partir de um sorteio uniforme ou voltas fornecidas.
 * Variação conforme configuração practice_lap_count_variation (15%).
 */
export function calculateCompletedLaps(
  plannedLaps: number,
  lapCountVariation: number,
  drawUniformVariation: number, // 0..1
): number {
  if (plannedLaps <= 0) return 0
  // Multiplicador no intervalo [1 - var, 1 + var]
  const factor = 1 - lapCountVariation + 2 * lapCountVariation * drawUniformVariation
  return Math.max(0, Math.round(plannedLaps * factor))
}

/**
 * Calcula a execução pura de uma sessão de TL para um participante específico.
 */
export function executePracticeForCar(inputs: {
  config: VersionedRaceConfig
  session: 'TL1' | 'TL2' | 'TL3'
  previousSetup: number
  driverConsistency: number
  lapsCompleted: number
  randomSetupDraw?: number // [0, 1) se não fornecido usa 0.5
  compoundDraw?: number // [0, 1) se não fornecido usa 0.5
}): {
  sessionGain: number
  accumulatedSetup: number
  qualifyingBonusSeconds: number
  raceBonusSecondsPerLap: number
  compoundUsed: string
  plannedLaps: number
} {
  const sessionRules = getPracticeSessionRules(inputs.config, inputs.session)
  const drawSetup = inputs.randomSetupDraw ?? 0.5
  const drawCompound = inputs.compoundDraw ?? 0.5

  const compoundUsed = resolvePracticeCompound(sessionRules.soft_tyre_prob, drawCompound)

  const gainResult = calculatePracticeSetupGain({
    planned_laps: sessionRules.laps,
    completed_laps: inputs.lapsCompleted,
    max_gain: sessionRules.max_setup_gain,
    consistency: inputs.driverConsistency,
    uniform_setup_draw: drawSetup,
  })

  const capped = applySetupCap({
    previous_setup: inputs.previousSetup,
    session_gain: gainResult.gain,
  })

  // Bônus canônicos derivados da fonte:
  // 100 de acerto = max_setup_qualifying_bonus_seconds (0.25 s)
  // 100 de acerto = max_setup_race_bonus_seconds_per_lap (0.15 s/volta)
  const maxQualiBonus = inputs.config.parameters?.max_setup_qualifying_bonus_seconds ?? 0.25
  const maxRaceBonus = inputs.config.parameters?.max_setup_race_bonus_seconds_per_lap ?? 0.15

  const qualifyingBonusSeconds = (capped.new_setup / 100) * maxQualiBonus
  const raceBonusSecondsPerLap = (capped.new_setup / 100) * maxRaceBonus

  return {
    sessionGain: gainResult.gain,
    accumulatedSetup: capped.new_setup,
    qualifyingBonusSeconds,
    raceBonusSecondsPerLap,
    compoundUsed,
    plannedLaps: sessionRules.laps,
  }
}
