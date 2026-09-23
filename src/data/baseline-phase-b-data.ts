import { auditTeamPerformanceBaseline } from './services/teamPerformanceBaselineAuditService'

export function computeAfterBReport() {
  return auditTeamPerformanceBaseline({
    seed: 20260315,
    qualifyingIterations: 1000,
    raceIterations: 1000,
    totalRaceLaps: 30,
    phase: 'FASE_B_AFTER',
  })
}
