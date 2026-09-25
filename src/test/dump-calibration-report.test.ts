import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { POST_02C_AUDIT_DATA } from '@/artifacts/audits/balanceAuditPost02cArtifact'

describe('Dump Relatório CALIBRATION-01A', () => {
  it('imprime sumário formatado para relatório final', () => {
    const data = POST_02C_AUDIT_DATA
    console.log('=== METADATA ===')
    console.log(JSON.stringify(data.metadata, null, 2))
    console.log('=== GAPS ANALYSIS ===')
    console.log(JSON.stringify(data.gapsAnalysis, null, 2))
    console.log('=== CORRELATIONS ===')
    console.log(JSON.stringify(data.correlations, null, 2))
    console.log('=== INVERSIONS ===')
    console.log(JSON.stringify(data.inversionsAnalysis, null, 2))
    console.log('=== TRACKFIT SWING ===')
    console.log('Overall max swing:', data.trackFitAnalysis.overallMaxSwing)
    console.log('=== 12 GRID TEAMS CONSOLIDATED ===')
    console.table(data.grid2026Ranking12)
    console.log('=== OUTLIERS DIAGNOSIS ===')
    console.log(JSON.stringify(data.outliersDiagnosis, null, 2))
    expect(data.metadata.isV0Intact).toBe(true)

    // Escreve o relatório JSON diretamente para balance-audit-post02c.json
    const targetPath = path.resolve(
      process.cwd(),
      'src/artifacts/audits/balance-audit-post02c.json',
    )
    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf-8')
    expect(fs.existsSync(targetPath)).toBe(true)

    // Dump completo para extração fiel no relatório final
    console.warn('=== REAL NUMBERS FOR REPORT EXTRACTION ===')
    console.warn(
      'STRUCTURAL_29:',
      JSON.stringify(
        data.structuralRanking29.map((t) => ({
          rank: t.rank,
          teamKey: t.teamKey,
          teamName: t.teamName,
          structuralStrengthScore: t.structuralStrengthScore,
          isGrid2026: t.isGrid2026,
          dataQuality: t.dataQuality,
        })),
      ),
    )
    console.warn(
      'GRID_12_QUALI_RACE:',
      JSON.stringify(
        data.grid2026Ranking12.map((g) => ({
          teamKey: g.teamKey,
          teamName: g.teamName,
          structuralRank: g.structuralRank,
          structuralStrengthScore: g.structuralStrengthScore,
          qualiRank: g.qualiRank,
          raceRank: g.raceRank,
          desiredGroup: g.desiredGroup,
          observedGroup: g.observedGroup,
        })),
      ),
    )
    console.warn(
      'GRID_12_QUALI_DETAILS:',
      JSON.stringify(
        data.grid2026Qualifying.map((q) => ({
          teamKey: q.teamKey,
          observedQualiRank: q.observedQualiRank,
          averagePosition: q.averagePosition,
          medianPosition: q.medianPosition,
          bestPosition: q.bestPosition,
          worstPosition: q.worstPosition,
          poleFrequency: q.poleFrequency,
          q3Frequency: q.q3Frequency,
        })),
      ),
    )
    console.warn(
      'GRID_12_RACE_DETAILS:',
      JSON.stringify(
        data.grid2026Race.map((r) => ({
          teamKey: r.teamKey,
          observedRaceRank: r.observedRaceRank,
          averageFinish: r.averageFinish,
          medianFinish: r.medianFinish,
          bestFinish: r.bestFinish,
          worstFinish: r.worstFinish,
          winFrequency: r.winFrequency,
          podiumFrequency: r.podiumFrequency,
          pointsFrequency: r.pointsFrequency,
        })),
      ),
    )
    console.warn('GAPS_ANALYSIS:', JSON.stringify(data.gapsAnalysis))
    console.warn('CORRELATIONS:', JSON.stringify(data.correlations))
    console.warn('TRACKFIT_MAX_SWING:', data.trackFitAnalysis.overallMaxSwing)
    console.warn(
      'TRACKFIT_SENSITIVITY:',
      JSON.stringify(
        data.trackFitAnalysis.teamsSensitivity.map((s) => ({
          teamKey: s.teamKey,
          deltaHigh: s.trackFitDeltaHigh,
          deltaLow: s.trackFitDeltaLow,
          maxGain: s.maxGain,
          maxLoss: s.maxLoss,
        })),
      ),
    )
    console.warn('INVERSIONS_ANALYSIS:', JSON.stringify(data.inversionsAnalysis))
    console.warn(
      'OUTLIERS_DIAGNOSIS:',
      JSON.stringify(
        data.outliersDiagnosis.map((o) => ({
          teamKey: o.teamKey,
          status: o.status,
          sRank: o.structuralRank,
          qRank: o.qualiRank,
          rRank: o.raceRank,
          diagnosis: o.detailedDiagnosis,
        })),
      ),
    )
    console.warn('=== END REAL NUMBERS FOR REPORT EXTRACTION ===')
  })
})
