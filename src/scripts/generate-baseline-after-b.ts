/**
 * generate-baseline-after-b.ts
 *
 * Utilitário / script para gerar o artefato AFTER (Fase B) de auditoria:
 * - src/data/baseline-2026-after-phase-b.json
 *
 * Determinístico com seed 20260315 e 1.000 qualificações + 1.000 corridas (30 voltas).
 */

import {
  auditTeamPerformanceBaseline,
  auditAudiHaasBalance,
  TeamPerformanceBaselineReport,
  AudiHaasBalanceAuditReport,
} from '../services/teamPerformanceBaselineAuditService'

export interface GenerateBaselineAfterBOptions {
  seed?: number
  qualifyingIterations?: number
  raceIterations?: number
  totalRaceLaps?: number
  dryRun?: boolean
}

export interface BaselineAfterBCombinedArtifact {
  report: TeamPerformanceBaselineReport
  audiHaasBalance: AudiHaasBalanceAuditReport
  jsonString: string
}

export function generateBaselineAfterBArtifacts(
  options: GenerateBaselineAfterBOptions = {},
): BaselineAfterBCombinedArtifact {
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

  const audiHaasBalance = auditAudiHaasBalance({
    seed,
    simulations: rIters,
    totalLaps: totalRaceLaps,
    includeCircuits: true,
    includeIsolation: true,
  })

  const combinedPayload = {
    ...report,
    audiHaasDetailedAudit: audiHaasBalance,
  }

  return {
    report,
    audiHaasBalance,
    jsonString: JSON.stringify(combinedPayload, null, 2),
  }
}
