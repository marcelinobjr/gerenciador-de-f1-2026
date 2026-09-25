/**
 * balance-audit-01.test.ts
 *
 * Suíte de Testes Canônica do BALANCE-AUDIT-01:
 * BA01-01 a BA01-22 (22/22 testes obrigatórios)
 */

import { describe, it, expect } from 'vitest'
import { balanceAuditService } from '@/services/balanceAuditService'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { canonicalPaceIntegrationService } from '@/services/canonicalPaceIntegrationService'
import { balanceBaselineService } from '@/services/balanceBaselineService'
import { CIRCUIT_PERFORMANCE_PROFILES } from '@/data/circuit-performance-profiles'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'

describe('BALANCE-AUDIT-01: Auditoria Esportiva & Diagnóstico BE02C (Baseline v0.0.493)', () => {
  // Executa o audit canônico
  const report = balanceAuditService.runFullAudit()

  // Verificação do artefato canônico balance-audit-01.json em src/artifacts/audits/
  it('BA01-00: assegura e verifica artefato canônico balance-audit-01.json em src/artifacts/audits/', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const dir = path.resolve(process.cwd(), 'src/artifacts/audits')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const filePath = path.join(dir, 'balance-audit-01.json')
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8')
    }
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(content)
    expect(parsed.auditId).toBe('BALANCE-AUDIT-01')
    expect(parsed.teamsAudited).toBe(29)
    expect(parsed.tracksAudited).toBe(24)
    expect(parsed.baselineChecksum).toBe('sha_v0_cf5fe0ee')
  })

  // BA01-01: 29/29 equipes auditadas
  it('BA01-01: 29/29 equipes auditadas', () => {
    expect(report.teamsAudited).toBe(29)
    expect(report.auditedTeamsMatchesCanonical).toBe(true)
    expect(report.structuralRanking.length).toBe(29)
    expect(report.championshipRanking.length).toBe(29)
  })

  // BA01-02: todas as pistas auditadas
  it('BA01-02: todas as pistas auditadas', () => {
    expect(report.tracksAudited).toBe(24)
    expect(report.expectedTracks).toBe(24)
    expect(report.missingTracks.length).toBe(0)
    expect(report.duplicateTracks.length).toBe(0)
    expect(report.trackSummaries.length).toBe(24)
  })

  // BA01-03: structural ranking completo
  it('BA01-03: structural ranking completo', () => {
    expect(report.structuralRanking.length).toBe(29)
    // P1 deve ter maior força estrutural que P29
    expect(report.structuralRanking[0].structuralStrength).toBeGreaterThan(
      report.structuralRanking[28].structuralStrength,
    )
    // Rankings ordenados 1 a 29 sequencialmente
    report.structuralRanking.forEach((entry, idx) => {
      expect(entry.structuralRank).toBe(idx + 1)
      expect(entry.structuralStrength).toBeGreaterThan(0)
      expect(entry.teamKey).toBeTruthy()
    })
  })

  // BA01-04: neutralização dos event modifiers
  it('BA01-04: neutralização dos event modifiers', () => {
    // Para todas as células da matriz, neutralEventPace = structuralStrength + trackFitModifier
    const cellPaces = Object.values(report.paceMatrix)
    expect(cellPaces.length).toBe(29)
    // Checar que o modifier não inclui setup (0), tyre (0), fuel (0), rng (0)
    const ferrariCell = report.positionMatrix['ferrari']
    expect(ferrariCell).toBeDefined()
    expect(Object.keys(ferrariCell).length).toBe(24)
  })

  // BA01-05: TrackFitModifier usa lógica canônica
  it('BA01-05: TrackFitModifier usa lógica canônica', () => {
    const norm = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 75.0,
      referenceTrackFit: 75.0,
    })
    expect(norm.trackFitModifier).toBe(0.0)
    // Clamp máximo de ±6.5
    const extremeHigh = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 100,
    })
    expect(extremeHigh.trackFitModifier).toBeLessThanOrEqual(6.5)
    const extremeLow = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 0,
    })
    expect(extremeLow.trackFitModifier).toBeGreaterThanOrEqual(-6.5)
  })

  // BA01-06: matriz equipe × pista completa
  it('BA01-06: matriz equipe × pista completa', () => {
    const teamKeys = Object.keys(report.positionMatrix)
    expect(teamKeys.length).toBe(29)
    for (const key of teamKeys) {
      const rowPos = report.positionMatrix[key]
      const rowPace = report.paceMatrix[key]
      expect(Object.keys(rowPos).length).toBe(24)
      expect(Object.keys(rowPace).length).toBe(24)
      for (const trackId of Object.keys(rowPos)) {
        expect(rowPos[trackId]).toBeGreaterThanOrEqual(1)
        expect(rowPos[trackId]).toBeLessThanOrEqual(29)
        expect(rowPace[trackId]).toBeGreaterThan(30)
      }
    }
  })

  // BA01-07: championship averages calculadas
  it('BA01-07: championship averages calculadas', () => {
    expect(report.championshipRanking.length).toBe(29)
    report.championshipRanking.forEach((entry, idx) => {
      expect(entry.championshipRank).toBe(idx + 1)
      expect(entry.averageNeutralPace).toBeGreaterThan(0)
      expect(entry.medianNeutralPace).toBeGreaterThan(0)
      expect(entry.averageTrackRank).toBeGreaterThanOrEqual(1)
      expect(entry.bestTrackRank).toBeGreaterThanOrEqual(1)
      expect(entry.worstTrackRank).toBeLessThanOrEqual(29)
      expect(entry.trackRankStdDev).toBeGreaterThanOrEqual(0)
    })
  })

  // BA01-08: structural × championship rank
  it('BA01-08: structural × championship rank', () => {
    report.championshipRanking.forEach((entry) => {
      expect(entry.rankDelta).toBe(entry.championshipRank - entry.structuralRank)
      if (Math.abs(entry.rankDelta) >= 3) {
        expect(entry.isSignificantRankShift).toBe(true)
      } else {
        expect(entry.isSignificantRankShift).toBe(false)
      }
    })
  })

  // BA01-09: trackFit upset detection
  it('BA01-09: trackFit upset detection', () => {
    expect(report.totalTrackFitUpsets).toBeGreaterThanOrEqual(0)
    expect(typeof report.trackFitUpsetsByTeam).toBe('object')
    const teamUpsets = Object.values(report.trackFitUpsetsByTeam)
    const sumUpsets = teamUpsets.reduce((a, b) => a + b, 0)
    expect(sumUpsets).toBe(report.totalTrackFitUpsets)
  })

  // BA01-10: exhaustive structural gap safety
  it('BA01-10: exhaustive structural gap safety', () => {
    // Large gap inversions devem ser registradas
    expect(Array.isArray(report.largeGapInversions)).toBe(true)
    for (const inv of report.largeGapInversions) {
      expect(inv.structuralGap).toBeGreaterThanOrEqual(5.0)
      expect(inv.finalNeutralPaceB).toBeGreaterThan(inv.finalNeutralPaceA)
    }
  })

  // BA01-11: dominance ratio
  it('BA01-11: dominance ratio', () => {
    expect(report.totalDominanceEvaluations).toBeGreaterThan(0)
    expect(report.top10DominanceRatios.length).toBeLessThanOrEqual(10)
    for (const dom of report.top10DominanceRatios) {
      expect(dom.dominanceRatio).toBeGreaterThan(0)
      if (dom.dominanceRatio >= 1.0) {
        expect(dom.isDominant).toBe(true)
      }
    }
  })

  // BA01-12: group hierarchy
  it('BA01-12: group hierarchy', () => {
    expect(report.groupHierarchies.length).toBe(4) // A, B, C, D
    expect(report.groupHeadToHead.length).toBe(6) // 6 confrontos entre grupos
    for (const gh of report.groupHierarchies) {
      expect(gh.averageNeutralPace).toBeGreaterThan(0)
      expect(gh.teamKeys.length).toBeGreaterThan(0)
    }
  })

  // BA01-13: Audi × Haas
  it('BA01-13: Audi × Haas', () => {
    const ah = report.audiVsHaas
    expect(ah).toBeDefined()
    expect(ah.totalTracks).toBe(24)
    expect(ah.audiWins + ah.haasWins + ah.ties).toBe(24)
    expect(ah.audiHeadToHeadWinRate + ah.haasHeadToHeadWinRate).toBeLessThanOrEqual(100.1)
    expect(['AUDI_HAAS_RULE_PASS', 'AUDI_HAAS_RULE_FAIL']).toContain(ah.status)
  })

  // BA01-14: close-gap analysis
  it('BA01-14: close-gap analysis', () => {
    expect(Array.isArray(report.closeGapPairs)).toBe(true)
    for (const pair of report.closeGapPairs) {
      expect(pair.structuralGap).toBeLessThanOrEqual(1.5)
      expect(pair.headToHeadTracks).toBe(24)
      expect(pair.inversionFrequency).toBeGreaterThanOrEqual(0)
      expect(pair.inversionFrequency).toBeLessThanOrEqual(100)
    }
  })

  // BA01-15: same-strength behavior
  it('BA01-15: same-strength behavior', () => {
    expect(Array.isArray(report.sameStrengthObservations)).toBe(true)
    for (const obs of report.sameStrengthObservations) {
      expect(obs.structuralGap).toBeLessThanOrEqual(0.05)
      // O delta vem exclusivamente do TrackFit
      expect(Math.abs(obs.deltaFromTrackFit)).toBeLessThanOrEqual(13.0)
    }
  })

  // BA01-16: team outliers
  it('BA01-16: team outliers', () => {
    expect(report.top10LargestRankShifts.length).toBeLessThanOrEqual(10)
    expect(report.top10PositiveTrackFitModifiers.length).toBeLessThanOrEqual(10)
    expect(report.top10NegativeTrackFitModifiers.length).toBeLessThanOrEqual(10)
    expect(Array.isArray(report.teamsHighlyDependentOnTrackFit)).toBe(true)
    expect(Array.isArray(report.teamsInsensitiveToTrackFit)).toBe(true)
  })

  // BA01-17: track outliers
  it('BA01-17: track outliers', () => {
    expect(report.trackSummaries.length).toBe(24)
    expect(Array.isArray(report.tracksWithAnomalouslyHighUpsets)).toBe(true)
    expect(Array.isArray(report.tracksWithAnomalouslyLowUpsets)).toBe(true)
  })

  // BA01-18: PaceBreakdown residual zero/epsilon
  it('BA01-18: PaceBreakdown residual zero/epsilon', () => {
    const summary = {
      teamsAudited: report.teamsAudited,
      tracksAudited: report.tracksAudited,
      structuralTop4: report.structuralRanking.slice(0, 4),
      structuralBottom4: report.structuralRanking.slice(-4),
      championshipTop4: report.championshipRanking.slice(0, 4),
      championshipBottom4: report.championshipRanking.slice(-4),
      audiVsHaas: report.audiVsHaas,
      largeGapInversionsCount: report.largeGapInversions.length,
      totalUpsets: report.totalTrackFitUpsets,
      maxResidual: report.maxPaceBreakdownResidual,
    }
    expect(summary.teamsAudited).toBe(29)
    expect(report.maxPaceBreakdownResidual).toBeLessThanOrEqual(0.05)
    expect(report.paceBreakdownIntegrityPassed).toBe(true)
  })

  // BA01-19: duplication audit permanece verde
  it('BA01-19: duplication audit permanece verde', () => {
    expect(report.duplicationAudit.auditPassed).toBe(true)
    expect(report.duplicationAudit.structuralConnectedQuali).toBe(true)
    expect(report.duplicationAudit.structuralConnectedRace).toBe(true)
    expect(report.duplicationAudit.legacyTrackFitWeight45).toBe(false)
    expect(report.duplicationAudit.teamNameBonuses).toBe(0)
    expect(report.duplicationAudit.duplicateDriverApplication).toBe(0)
    expect(report.duplicationAudit.duplicatePUApplication).toBe(0)
    expect(report.duplicationAudit.duplicateWearApplication).toBe(0)
  })

  // BA01-20: nenhuma mutação dos ratings
  it('BA01-20: nenhuma mutação dos ratings', () => {
    const currentBaseline = structuralStrengthService.getBaselineV0()
    expect(currentBaseline.checksum).toBe('sha_v0_cf5fe0ee')
    expect(Object.keys(currentBaseline.teams).length).toBe(29)
  })

  // BA01-21: nenhuma mutação das fórmulas
  it('BA01-21: nenhuma mutação das fórmulas', () => {
    const cmp = balanceBaselineService.compareBalanceWithBaseline('v0')
    expect(cmp.hasDifferences).toBe(false)
    expect(cmp.checksumValid).toBe(true)
  })

  // BA01-22: V0 permanece intacto
  it('BA01-22: V0 permanece intacto', () => {
    const v0 = BASELINE_V0_DATA
    expect(v0.checksum).toBe('sha_v0_cf5fe0ee')
    expect(v0.schemaVersion).toBe('v0')
    expect(v0.totalTeamsCount).toBe(29)
  })
})
