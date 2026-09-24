/**
 * generate-baseline-after-b.ts
 *
 * Utilitário / script para gerar o artefato AFTER (Fase B) de auditoria:
 * - src/data/baseline-2026-after-phase-b.json
 *
 * Determinístico com seed 20260315 e 1.000 qualificações + 1.000 corridas (30 voltas).
 */

import { auditTeamPerformanceBaseline } from '../services/teamPerformanceBaselineAuditService'

export interface GenerateBaselineAfterBOptions {
  seed?: number
  qualifyingIterations?: number
  raceIterations?: number
  totalRaceLaps?: number
  dryRun?: boolean
}

export function generateBaselineAfterBArtifacts(options: GenerateBaselineAfterBOptions = {}) {
  const seed = options.seed ?? 20260315
  const qIters = options.qualifyingIterations ?? 1000
  const rIters = options.raceIterations ?? 1000
  const totalRaceLaps = options.totalRaceLaps ?? 30

  const report = auditTeamPerformanceBaseline({
    seed,
    qualifyingIterations: qIters,
    raceIterations: rIters,
    totalRaceLaps,
    phase: 'FASE_B_AFTER',
  })

  return {
    report,
    jsonString: JSON.stringify(report, null, 2),
  }
}
