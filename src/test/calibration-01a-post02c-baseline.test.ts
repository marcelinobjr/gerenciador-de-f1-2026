import { describe, it, expect } from 'vitest'
import {
  calibration01aBaselineService,
  Calibration01aArtifact,
} from '@/services/calibration01aBaselineService'
import { BALANCE_BASELINE_V0_CHECKSUM, BASELINE_V0_DATA } from '@/data/balance-baseline-v0'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { POST_02C_AUDIT_DATA } from '@/artifacts/audits/balanceAuditPost02cArtifact'

describe('CALIBRATION-01A — Baseline Pós-02C (Medição Only)', () => {
  const artifact = POST_02C_AUDIT_DATA

  // CAL01A-01: 29 equipes têm StructuralStrength
  it('CAL01A-01: 29 equipes têm StructuralStrength calculado e classificado', () => {
    expect(artifact.structuralRanking29).toBeDefined()
    expect(artifact.structuralRanking29.length).toBe(29)

    artifact.structuralRanking29.forEach((t, idx) => {
      expect(t.rank).toBe(idx + 1)
      expect(t.teamKey).toBeTruthy()
      expect(t.structuralStrengthScore).toBeGreaterThan(0)
      expect(t.technicalScore).toBeGreaterThan(0)
      expect(t.driverScore).toBeGreaterThan(0)
      expect(t.teamScore).toBeGreaterThan(0)
      expect(['COMPLETE', 'PARTIAL', 'DEFAULTED', 'MISSING']).toContain(t.dataQuality)
    })
  })

  // CAL01A-02: 12 equipes do grid têm neutral qualifying measurement
  it('CAL01A-02: 12 equipes do grid têm medição neutra de qualifying', () => {
    expect(artifact.grid2026Qualifying).toBeDefined()
    expect(artifact.grid2026Qualifying.length).toBe(12)

    artifact.grid2026Qualifying.forEach((q) => {
      expect(q.teamKey).toBeTruthy()
      expect(q.averagePosition).toBeGreaterThanOrEqual(1)
      expect(q.averagePosition).toBeLessThanOrEqual(24)
      expect(q.medianPosition).toBeGreaterThanOrEqual(1)
      expect(q.bestPosition).toBeGreaterThanOrEqual(1)
      expect(q.worstPosition).toBeLessThanOrEqual(24)
      expect(q.observedQualiRank).toBeGreaterThanOrEqual(1)
      expect(q.observedQualiRank).toBeLessThanOrEqual(12)
    })
  })

  // CAL01A-03: 12 equipes do grid têm clean race measurement
  it('CAL01A-03: 12 equipes do grid têm medição limpa de corrida', () => {
    expect(artifact.grid2026Race).toBeDefined()
    expect(artifact.grid2026Race.length).toBe(12)

    artifact.grid2026Race.forEach((r) => {
      expect(r.teamKey).toBeTruthy()
      expect(r.averageFinish).toBeGreaterThanOrEqual(1)
      expect(r.averageFinish).toBeLessThanOrEqual(24)
      expect(r.medianFinish).toBeGreaterThanOrEqual(1)
      expect(r.bestFinish).toBeGreaterThanOrEqual(1)
      expect(r.worstFinish).toBeLessThanOrEqual(24)
      expect(r.observedRaceRank).toBeGreaterThanOrEqual(1)
      expect(r.observedRaceRank).toBeLessThanOrEqual(12)
    })
  })

  // CAL01A-04: TrackFit analysis cobre 3 tipos de pista
  it('CAL01A-04: TrackFit analysis cobre pelo menos 3 tipos de pista (alta, travada, neutra)', () => {
    expect(artifact.trackFitAnalysis).toBeDefined()
    expect(artifact.trackFitAnalysis.tracksTested.neutral).toBeTruthy()
    expect(artifact.trackFitAnalysis.tracksTested.highSpeed).toBeTruthy()
    expect(artifact.trackFitAnalysis.tracksTested.lowSpeed).toBeTruthy()
    expect(artifact.trackFitAnalysis.teamsSensitivity.length).toBe(12)

    artifact.trackFitAnalysis.teamsSensitivity.forEach((t) => {
      expect(t.neutralTrackPace).toBeGreaterThan(0)
      expect(t.highSpeedPace).toBeGreaterThan(0)
      expect(t.lowSpeedPace).toBeGreaterThan(0)
      expect(Math.abs(t.trackFitDeltaHigh)).toBeLessThanOrEqual(6.5)
      expect(Math.abs(t.trackFitDeltaLow)).toBeLessThanOrEqual(6.5)
    })
  })

  // CAL01A-05: Structural->Quali correlation calculada
  it('CAL01A-05: Structural->Quali correlation calculada com Pearson e Spearman', () => {
    const corr = artifact.correlations.structuralVsQualiPace
    expect(corr).toBeDefined()
    expect(typeof corr.pearson).toBe('number')
    expect(typeof corr.spearman).toBe('number')
    expect(corr.pearson).toBeGreaterThan(0.6) // Correlação estrutural forte
    expect(corr.spearman).toBeGreaterThan(0.6)
  })

  // CAL01A-06: Structural->Race correlation calculada
  it('CAL01A-06: Structural->Race correlation calculada com Pearson e Spearman', () => {
    const corr = artifact.correlations.structuralVsRacePace
    expect(corr).toBeDefined()
    expect(typeof corr.pearson).toBe('number')
    expect(typeof corr.spearman).toBe('number')
    expect(corr.pearson).toBeGreaterThan(0.5) // Correlação positiva sólida com race pace
    expect(corr.spearman).toBeGreaterThan(0.5)
  })

  // CAL01A-07: Outliers identificados
  it('CAL01A-07: Outliers identificados e explicados para cada uma das 12 equipes', () => {
    expect(artifact.outliersDiagnosis).toBeDefined()
    expect(artifact.outliersDiagnosis.length).toBe(12)

    artifact.outliersDiagnosis.forEach((diag) => {
      expect(diag.teamKey).toBeTruthy()
      expect(diag.topContributors).toBeDefined()
      expect(diag.topContributors.length).toBe(3)
      expect(diag.detailedDiagnosis.length).toBeGreaterThan(15)
    })
  })

  // CAL01A-08: Zero team name bonus
  it('CAL01A-08: Zero team name bonus no sistema', () => {
    expect(artifact.auditCounters.teamNameBonuses).toBe(0)
    const audit = structuralStrengthService.auditStructuralStrengthSystem()
    expect(audit.teamNameBonuses).toBe(0)
  })

  // CAL01A-09: Zero duplicate driver application
  it('CAL01A-09: Zero duplicate driver application', () => {
    expect(artifact.auditCounters.duplicateDriverApplication).toBe(0)
  })

  // CAL01A-10: Zero duplicate PU application
  it('CAL01A-10: Zero duplicate PU application', () => {
    expect(artifact.auditCounters.duplicatePUApplication).toBe(0)
  })

  // CAL01A-11: Zero duplicate wear application
  it('CAL01A-11: Zero duplicate wear application', () => {
    expect(artifact.auditCounters.duplicateWearApplication).toBe(0)
    expect(artifact.auditCounters.duplicateTrackFitApplication).toBe(0)
  })

  // CAL01A-12: V0 permanece intacta (checksum sha_v0_cf5fe0ee)
  it('CAL01A-12: V0 permanece intacta com checksum canônico sha_v0_cf5fe0ee', () => {
    expect(BASELINE_V0_DATA.checksum).toBe('sha_v0_cf5fe0ee')
    expect(BALANCE_BASELINE_V0_CHECKSUM).toBe('sha_v0_cf5fe0ee')
    expect(artifact.metadata.v0Checksum).toBe('sha_v0_cf5fe0ee')
    expect(artifact.metadata.isV0Intact).toBe(true)
  })

  // CAL01A-13: Artifact parseia
  it('CAL01A-13: Artefato parseia como JSON e possui todas as seções obrigatórias', () => {
    expect(artifact.metadata.auditPhase).toBe('CALIBRATION-01A')
    expect(artifact.structuralRanking29.length).toBe(29)
    expect(artifact.grid2026Ranking12.length).toBe(12)
    expect(artifact.grid2026Qualifying.length).toBe(12)
    expect(artifact.grid2026Race.length).toBe(12)
    expect(artifact.driverNormalization).toBeDefined()
    expect(artifact.carNormalization).toBeDefined()
    expect(artifact.trackFitAnalysis).toBeDefined()
    expect(artifact.inversionsAnalysis).toBeDefined()
    expect(artifact.gapsAnalysis).toBeDefined()
    expect(artifact.correlations).toBeDefined()
    expect(artifact.outliersDiagnosis).toBeDefined()
    expect(artifact.samplePaceBreakdowns).toBeDefined()
    expect(artifact.calibration01bReadiness.isReady).toBe(true)
  })

  // CAL01A-14: Artifact é determinístico com mesma seed
  it('CAL01A-14: Medição é deterministicamente reprodutível com a mesma seed', () => {
    const run1 = calibration01aBaselineService.runFullMeasurement({
      qualiIterations: 10,
      raceIterations: 5,
      deterministicSeed: 99999,
    })
    const run2 = calibration01aBaselineService.runFullMeasurement({
      qualiIterations: 10,
      raceIterations: 5,
      deterministicSeed: 99999,
    })

    expect(run1.grid2026Qualifying[0].averagePosition).toBe(
      run2.grid2026Qualifying[0].averagePosition,
    )
    expect(run1.grid2026Race[0].averageFinish).toBe(run2.grid2026Race[0].averageFinish)
    expect(run1.structuralRanking29[0].structuralStrengthScore).toBe(
      run2.structuralRanking29[0].structuralStrengthScore,
    )
  })

  // CAL01A-15: Nenhum rating foi alterado
  it('CAL01A-15: Nenhum rating foi alterado e zero regras proibidas foram violadas', () => {
    expect(artifact.auditCounters.prohibitedRulesViolations).toBe(0)
    // Confirma que Audi > Haas na força estrutural
    const audi = artifact.structuralRanking29.find((t) => t.teamKey === 'audi')!
    const haas = artifact.structuralRanking29.find((t) => t.teamKey === 'haas')!
    expect(audi.structuralStrengthScore).toBeGreaterThan(haas.structuralStrengthScore)

    // Confirma Mercedes, Ferrari, McLaren, Red Bull no topo
    const top4 = artifact.structuralRanking29.slice(0, 4).map((t) => t.teamKey)
    expect(top4).toContain('mercedes')
    expect(top4).toContain('ferrari')
    expect(top4).toContain('mclaren')
    expect(top4).toContain('redbull')
  })
})
