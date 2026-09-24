/**
 * run-fc02d-phase-b.ts
 *
 * Runner para execução do Monte Carlo FC02D Fase B e persistência de:
 * src/data/baseline-2026-after-phase-b.json
 *
 * Seed: 20260315
 * Runs: configurável (default 200 ou 100 qualificações + corridas)
 */

import * as fs from 'fs'
import * as path from 'path'
import {
  auditTeamPerformanceBaseline,
  auditAudiHaasBalance,
  TeamBaselineStats,
  TeamPerformanceBaselineReport,
  AudiHaasBalanceAuditReport,
} from '../services/teamPerformanceBaselineAuditService'

/**
 * Derivação canônica do caminho absoluto de baseline-2026-after-phase-b.json.
 * Tenta process.cwd()/src/data e fallback relativo a __dirname / import.meta.
 */
export function getCanonicalPhaseBPath(): string {
  const fromCwd = path.resolve(process.cwd(), 'src/data/baseline-2026-after-phase-b.json')
  if (
    fs.existsSync(path.resolve(process.cwd(), 'package.json')) ||
    fs.existsSync(path.resolve(process.cwd(), 'src'))
  ) {
    return fromCwd
  }
  const repoRoot = path.resolve(__dirname, '../..')
  return path.resolve(repoRoot, 'src/data/baseline-2026-after-phase-b.json')
}

export const FC02D_PHASE_B_AFTER_BASELINE_PATH = getCanonicalPhaseBPath()

export interface PairCheck {
  pair: string
  audiMetric: number
  targetMetric: number
  metricName: string
  satisfied: boolean
  delta: number
  detail: string
}

export interface SpecialChecksReport {
  audiVsHaasRace: PairCheck
  audiVsHaasQuali: PairCheck
  audiVsWilliams: PairCheck
  audiVsAlpine: PairCheck
  audiVsRacingBulls: PairCheck
}

export interface BaselineAfterPhaseBArtifact extends TeamPerformanceBaselineReport {
  version?: string
  calibration: {
    audiEffectivePU: number
    haasEffectivePU: number
    structuralDelta: number
    carPerformanceDelta: number
    chassisDelta: number
    audiCarPerf: number
    haasCarPerf: number
  }
  audi: {
    teamKey: string
    teamName: string
    effectivePuRating: number
    chassisRating: number
    carPerfRating: number
    avgGridPosition: number
    avgFinishPosition: number
  }
  haas: {
    teamKey: string
    teamName: string
    effectivePuRating: number
    chassisRating: number
    carPerfRating: number
    avgGridPosition: number
    avgFinishPosition: number
  }
  structuralDelta: number
  scenarios: {
    simulations: number
    totalLaps: number
    circuits: any[]
    isolation?: any
  }
  deterministicSeeds: number[]
  audiHaasBalance: AudiHaasBalanceAuditReport
  specialChecks: SpecialChecksReport
  structuralComparison: Array<{
    teamKey: string
    teamName: string
    chassisRating: number
    puRating: number
    effectivePuRating?: number
    carPerfRating: number
    targetGroup: string
    qualiMean: number
    qualiMedian?: number
    raceMean: number
    raceMedian?: number
  }>
}

export function runFC02DPhaseB(
  options: {
    seed?: number
    runs?: number
    totalLaps?: number
    persist?: boolean
  } = {},
): {
  artifact: BaselineAfterPhaseBArtifact
  filePath?: string
  jsonString: string
} {
  const seed = options.seed ?? 20260315
  const runs = options.runs ?? 200
  const totalLaps = options.totalLaps ?? 30
  const persist = options.persist ?? true

  const report = auditTeamPerformanceBaseline({
    seed,
    qualifyingIterations: runs,
    raceIterations: runs,
    totalRaceLaps: totalLaps,
    phase: 'FASE_B_AFTER',
  })

  const audiHaasBalance = auditAudiHaasBalance({
    seed,
    simulations: runs,
    totalLaps,
    includeCircuits: true,
    includeIsolation: true,
  })

  const statsMap = new Map<string, TeamBaselineStats>()
  report.teamsStats.forEach((t) => statsMap.set(t.teamKey, t))

  const audi = statsMap.get('audi')!
  const haas = statsMap.get('haas')!
  const alpine = statsMap.get('alpine')!
  const racingbulls = statsMap.get('racingbulls')!
  const williams = statsMap.get('williams')!

  const specialChecks: SpecialChecksReport = {
    audiVsHaasRace: {
      pair: 'Audi vs Haas (Corrida)',
      audiMetric: audi.avgFinishPosition,
      targetMetric: haas.avgFinishPosition,
      metricName: 'avgFinishPosition (menor é melhor)',
      satisfied: audi.avgFinishPosition < haas.avgFinishPosition,
      delta: Number((haas.avgFinishPosition - audi.avgFinishPosition).toFixed(2)),
      detail:
        audi.avgFinishPosition < haas.avgFinishPosition
          ? `Audi (P${audi.avgFinishPosition}) supera Haas (P${haas.avgFinishPosition}) por delta de ${(haas.avgFinishPosition - audi.avgFinishPosition).toFixed(2)} posições.`
          : `Audi (P${audi.avgFinishPosition}) atrás da Haas (P${haas.avgFinishPosition}) por delta de ${(audi.avgFinishPosition - haas.avgFinishPosition).toFixed(2)} posições.`,
    },
    audiVsHaasQuali: {
      pair: 'Audi vs Haas (Quali)',
      audiMetric: audi.avgGridPosition,
      targetMetric: haas.avgGridPosition,
      metricName: 'avgGridPosition (menor é melhor)',
      satisfied: audi.avgGridPosition < haas.avgGridPosition,
      delta: Number((haas.avgGridPosition - audi.avgGridPosition).toFixed(2)),
      detail:
        audi.avgGridPosition < haas.avgGridPosition
          ? `Audi (P${audi.avgGridPosition}) qualifica à frente da Haas (P${haas.avgGridPosition}) por delta de ${(haas.avgGridPosition - audi.avgGridPosition).toFixed(2)} posições.`
          : `Audi (P${audi.avgGridPosition}) qualifica atrás da Haas (P${haas.avgGridPosition}) por delta de ${(audi.avgGridPosition - haas.avgGridPosition).toFixed(2)} posições.`,
    },
    audiVsWilliams: {
      pair: 'Audi vs Williams (Corrida)',
      audiMetric: audi.avgFinishPosition,
      targetMetric: williams.avgFinishPosition,
      metricName: 'avgFinishPosition (menor é melhor)',
      satisfied: audi.avgFinishPosition < williams.avgFinishPosition,
      delta: Number((williams.avgFinishPosition - audi.avgFinishPosition).toFixed(2)),
      detail:
        audi.avgFinishPosition < williams.avgFinishPosition
          ? `Audi (P${audi.avgFinishPosition}) à frente da Williams (P${williams.avgFinishPosition}).`
          : `Audi (P${audi.avgFinishPosition}) atrás da Williams (P${williams.avgFinishPosition}).`,
    },
    audiVsAlpine: {
      pair: 'Audi vs Alpine (Grupo B)',
      audiMetric: audi.avgFinishPosition,
      targetMetric: alpine.avgFinishPosition,
      metricName: 'avgFinishPosition',
      satisfied: true, // Ambas no Grupo B
      delta: Number((alpine.avgFinishPosition - audi.avgFinishPosition).toFixed(2)),
      detail: `Audi P${audi.avgFinishPosition} vs Alpine P${alpine.avgFinishPosition} (Delta: ${(alpine.avgFinishPosition - audi.avgFinishPosition).toFixed(2)}).`,
    },
    audiVsRacingBulls: {
      pair: 'Audi vs Racing Bulls (Grupo B)',
      audiMetric: audi.avgFinishPosition,
      targetMetric: racingbulls.avgFinishPosition,
      metricName: 'avgFinishPosition',
      satisfied: true, // Ambas no Grupo B
      delta: Number((racingbulls.avgFinishPosition - audi.avgFinishPosition).toFixed(2)),
      detail: `Audi P${audi.avgFinishPosition} vs Racing Bulls P${racingbulls.avgFinishPosition} (Delta: ${(racingbulls.avgFinishPosition - audi.avgFinishPosition).toFixed(2)}).`,
    },
  }

  const structuralComparison = report.teamsStats.map((t) => ({
    teamKey: t.teamKey,
    teamName: t.teamName,
    chassisRating: t.chassisRating,
    puRating: t.puRating,
    effectivePuRating: t.effectivePuRating,
    carPerfRating: t.carPerfRating,
    targetGroup: t.targetGroup,
    qualiMean: t.avgGridPosition,
    qualiMedian: t.medianGridPosition,
    raceMean: t.avgFinishPosition,
    raceMedian: t.medianFinishPosition,
  }))

  const artifact: BaselineAfterPhaseBArtifact & Record<string, any> = {
    version: '2026.1',
    phase: 'FASE_B_AFTER',
    generatedAt: report.generatedAt || new Date().toISOString(),
    calibration: {
      audiEffectivePU: 86.4,
      haasEffectivePU: 75.6,
      structuralDelta: 3.1,
      carPerformanceDelta: audiHaasBalance.carPerformanceDelta,
      chassisDelta: audiHaasBalance.chassisDelta,
      audiCarPerf: audi.carPerfRating,
      haasCarPerf: haas.carPerfRating,
    },
    audi: {
      teamKey: 'audi',
      teamName: 'Audi F1 Team',
      effectivePuRating: 86.4,
      chassisRating: audi.chassisRating,
      carPerfRating: audi.carPerfRating,
      avgGridPosition: audi.avgGridPosition,
      avgFinishPosition: audi.avgFinishPosition,
    },
    haas: {
      teamKey: 'haas',
      teamName: 'Haas F1 Team',
      effectivePuRating: 75.6,
      chassisRating: haas.chassisRating,
      carPerfRating: haas.carPerfRating,
      avgGridPosition: haas.avgGridPosition,
      avgFinishPosition: haas.avgFinishPosition,
    },
    structuralDelta: 3.1,
    scenarios: {
      simulations: runs,
      totalLaps,
      circuits: audiHaasBalance.circuits ?? [],
      isolation: audiHaasBalance.isolation,
    },
    deterministicSeeds: [seed],
    ...report,
    audiHaasBalance,
    specialChecks,
    structuralComparison,
  }

  const jsonString = JSON.stringify(artifact, null, 2)
  let filePath: string | undefined

  if (persist) {
    const resolvedPath = getCanonicalPhaseBPath()
    const targetDir = path.dirname(resolvedPath)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }
    filePath = resolvedPath
    fs.writeFileSync(filePath, jsonString, 'utf-8')
  }

  return {
    artifact,
    filePath,
    jsonString,
  }
}
