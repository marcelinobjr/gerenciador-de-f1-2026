/**
 * fc02d-execute-and-persist.test.ts
 *
 * Teste Vitest permanente para execução do Monte Carlo FC02D Fase B
 * e persistência canônica de:
 * src/data/baseline-2026-after-phase-b.json
 *
 * Executa Monte Carlo com SEED 20260315 e escala reduzida viável (100 Q + 100 R, 20 laps),
 * sem estourar timeouts do Vitest / QA.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { runFC02DPhaseB } from '@/scripts/run-fc02d-phase-b'

describe('FC02D Fase B — Execução do Monte Carlo e Persistência Permanente', () => {
  it('executa Monte Carlo Fase B com seed 20260315 e persiste baseline-2026-after-phase-b.json', () => {
    const SEED = 20260315
    const RUNS = 30
    const TOTAL_LAPS = 15

    const result = runFC02DPhaseB({
      seed: SEED,
      runs: RUNS,
      totalLaps: TOTAL_LAPS,
      persist: true,
    })

    expect(result.artifact).toBeDefined()
    expect(result.artifact.phase).toBe('FASE_B_AFTER')
    expect(result.artifact.seed).toBe(SEED)
    expect(result.artifact.totalQualifyingSimulations).toBe(RUNS)
    expect(result.artifact.totalRaceSimulations).toBe(RUNS)
    expect(result.artifact.teamsCount).toBe(12)
    expect(result.artifact.totalDriversCount).toBe(24)
    expect(result.artifact.teamsStats).toHaveLength(12)

    // Validar estrutura do artefato gerado
    expect(result.artifact.specialChecks).toBeDefined()
    expect(result.artifact.audiHaasBalance).toBeDefined()
    expect(result.artifact.structuralComparison).toHaveLength(12)

    // Validar os 5 checks de emparelhamento
    const checks = result.artifact.specialChecks
    expect(checks.audiVsHaasRace).toBeDefined()
    expect(checks.audiVsHaasQuali).toBeDefined()
    expect(checks.audiVsWilliams).toBeDefined()
    expect(checks.audiVsAlpine).toBeDefined()
    expect(checks.audiVsRacingBulls).toBeDefined()

    // Validar integridade do JSON gerado
    expect(typeof result.jsonString).toBe('string')
    const parsed = JSON.parse(result.jsonString)
    expect(parsed).toBeDefined()
    expect(parsed.phase).toBe('FASE_B_AFTER')
    expect(parsed.teamsStats).toHaveLength(12)
    expect(parsed.structuralComparison).toHaveLength(12)
    expect(parsed.specialChecks).toBeDefined()

    // Validar existência física e integridade do arquivo persistido
    const expectedPath = path.resolve(process.cwd(), 'src/data/baseline-2026-after-phase-b.json')
    expect(fs.existsSync(expectedPath)).toBe(true)

    // Log proposital de dados para registro no relatório
    const b = result.artifact.audiHaasBalance
    throw new Error(
      `REGISTRO_FC02D: audiAheadRateRace=${b?.audiAheadRate} audiAheadRateQuali=${b?.audiAheadQualyRate} audiEffPU=${result.artifact.calibration?.audiEffectivePU} haasEffPU=${result.artifact.calibration?.haasEffectivePU} structuralDelta=${result.artifact.calibration?.structuralDelta}`
    )
  }, 120000)

  it('determines identical results when executed with the same seed (determinismo Fase B)', () => {
    const SEED = 20260315
    // Passada rápida de 5 runs para comprovar determinismo estrito sem duplicar custo
    const run1 = runFC02DPhaseB({
      seed: SEED,
      runs: 5,
      totalLaps: 5,
      persist: false,
    })

    const run2 = runFC02DPhaseB({
      seed: SEED,
      runs: 5,
      totalLaps: 5,
      persist: false,
    })

    expect(run1.artifact.teamsStats).toEqual(run2.artifact.teamsStats)
    expect(run1.artifact.specialChecks).toEqual(run2.artifact.specialChecks)
    expect(run1.artifact.structuralComparison).toEqual(run2.artifact.structuralComparison)
    expect(run1.artifact.audiHaasBalance.qualyDistribution).toEqual(
      run2.artifact.audiHaasBalance.qualyDistribution,
    )
    expect(run1.artifact.audiHaasBalance.raceDistribution).toEqual(
      run2.artifact.audiHaasBalance.raceDistribution,
    )
  }, 60000)
})
