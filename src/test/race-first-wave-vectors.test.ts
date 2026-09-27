/**
 * src/test/race-first-wave-vectors.test.ts
 *
 * Teste unitário rigoroso que carrega os vetores controlados de first_implementation_wave_vector_ids
 * diretamente do arquivo 02_RACE_CENARIOS_E_TESTES e verifica os cálculos das funções puras
 * contra os valores esperados.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  calculateEffectiveQualifyingDriver,
  calculateTrackQualifyingRating,
  calculateRaceExecutionPace,
  calculatePracticeSetupGain,
  calculateWeekendSetupProgression,
  applySetupCap,
  calculateQualifyingAttemptTime,
  calculateSprintQualifyingAttemptTime,
  calculateLapSigma,
  calculateWeatherBaseTimes,
} from '@/lib/race/pureRaceEngine'

interface VectorDef {
  id: string
  function_under_test: string
  nature: string
  inputs: Record<string, any>
  expected: Record<string, any>
  source_refs: string[]
  notes: string
}

describe('RACE-SOURCE-01A — First Implementation Wave Vectors (RF01..RF12, RF21, RF22, RF28)', () => {
  const filePath = path.resolve(process.cwd(), 'src/assets/02racecenariosetestes-f3097.json')
  const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const vectors: VectorDef[] = fileContent.controlled_test_vectors
  const firstWaveIds: string[] = fileContent.first_implementation_wave_vector_ids

  it('contains all 15 first wave vectors in file 02', () => {
    expect(firstWaveIds).toEqual([
      'RF01',
      'RF02',
      'RF03',
      'RF04',
      'RF05',
      'RF06',
      'RF07',
      'RF08',
      'RF09',
      'RF10',
      'RF11',
      'RF12',
      'RF21',
      'RF22',
      'RF28',
    ])
    for (const id of firstWaveIds) {
      const found = vectors.find((v) => v.id === id)
      expect(found, `Vector ${id} must exist`).toBeDefined()
    }
  })

  // RF01
  it('RF01: effective_qualifying_driver', () => {
    const v = vectors.find((x) => x.id === 'RF01')!
    const res = calculateEffectiveQualifyingDriver({
      speed: v.inputs.speed,
      qualifying: v.inputs.qualifying,
      form: v.inputs.form,
      morale: v.inputs.morale,
      wet_skill: v.inputs.wet_skill,
      wet: v.inputs.wet,
    })

    expect(res.qualifying_note).toBeCloseTo(v.expected.qualifying_note, 8)
    expect(res.effective_driver).toBeCloseTo(v.expected.effective_driver, 8)
  })

  // RF02
  it('RF02: track_qualifying_rating', () => {
    const v = vectors.find((x) => x.id === 'RF02')!
    const res = calculateTrackQualifyingRating({
      car: v.inputs.car,
      effective_driver: v.inputs.effective_driver,
      driver_weight: v.inputs.driver_weight,
    })

    expect(res.rating).toBeCloseTo(v.expected.rating, 8)
  })

  // RF03
  it('RF03: race_execution_pace', () => {
    const v = vectors.find((x) => x.id === 'RF03')!
    const res = calculateRaceExecutionPace({
      car: v.inputs.car,
      race_execution: v.inputs.race_execution,
      morale: v.inputs.morale,
      physical_condition: v.inputs.physical_condition,
    })

    expect(res.pace).toBeCloseTo(v.expected.pace, 8)
  })

  // RF04
  it('RF04: practice_setup_gain', () => {
    const v = vectors.find((x) => x.id === 'RF04')!
    const res = calculatePracticeSetupGain({
      planned_laps: v.inputs.planned_laps,
      completed_laps: v.inputs.completed_laps,
      max_gain: v.inputs.max_gain,
      consistency: v.inputs.consistency,
      uniform_setup_draw: v.inputs.uniform_setup_draw,
    })

    expect(res.gain).toBeCloseTo(v.expected.gain, 8)
  })

  // RF05
  it('RF05: practice_setup_gain_capped_exposure', () => {
    const v = vectors.find((x) => x.id === 'RF05')!
    const res = calculatePracticeSetupGain({
      planned_laps: v.inputs.planned_laps,
      completed_laps: v.inputs.completed_laps,
      max_gain: v.inputs.max_gain,
      consistency: v.inputs.consistency,
      uniform_setup_draw: v.inputs.uniform_setup_draw,
    })

    expect(res.gain).toBeCloseTo(v.expected.gain, 8)
  })

  // RF06
  it('RF06: practice_setup_gain_short_run', () => {
    const v = vectors.find((x) => x.id === 'RF06')!
    const res = calculatePracticeSetupGain({
      planned_laps: v.inputs.planned_laps,
      completed_laps: v.inputs.completed_laps,
      max_gain: v.inputs.max_gain,
      consistency: v.inputs.consistency,
      uniform_setup_draw: v.inputs.uniform_setup_draw,
    })

    expect(res.gain).toBeCloseTo(v.expected.gain, 8)
  })

  // RF07
  it('RF07: normal_weekend_setup', () => {
    const v = vectors.find((x) => x.id === 'RF07')!
    const res = calculateWeekendSetupProgression({
      consistency: v.inputs.consistency,
      completed_laps: v.inputs.completed_laps,
      uniform_setup_draws: v.inputs.uniform_setup_draws,
    })

    expect(res.after_TL1).toBeCloseTo(v.expected.after_TL1, 8)
    expect(res.after_TL2).toBeCloseTo(v.expected.after_TL2, 8)
    expect(res.after_TL3).toBeCloseTo(v.expected.after_TL3, 8)
    expect(res.qualifying_bonus_ms).toBeCloseTo(v.expected.qualifying_bonus_ms, 8)
    expect(res.race_bonus_s).toBeCloseTo(v.expected.race_bonus_s, 8)
  })

  // RF08
  it('RF08: sprint_weekend_setup', () => {
    const v = vectors.find((x) => x.id === 'RF08')!
    const res = calculateWeekendSetupProgression({
      consistency: v.inputs.consistency,
      completed_laps: v.inputs.completed_laps,
      uniform_setup_draws: v.inputs.uniform_setup_draws,
    })

    expect(res.after_TL1).toBeCloseTo(v.expected.after_TL1, 8)
    expect(res.final_setup).toBeCloseTo(v.expected.final_setup, 8)
    expect(res.qualifying_bonus_ms).toBeCloseTo(v.expected.qualifying_bonus_ms, 8)
    expect(res.race_bonus_s).toBeCloseTo(v.expected.race_bonus_s, 8)
  })

  // RF09
  it('RF09: setup_cap', () => {
    const v = vectors.find((x) => x.id === 'RF09')!
    const res = applySetupCap({
      previous_setup: v.inputs.previous_setup,
      session_gain: v.inputs.session_gain,
    })

    expect(res.new_setup).toBe(v.expected.new_setup)
  })

  // RF10
  it('RF10: qualifying_attempt', () => {
    const v = vectors.find((x) => x.id === 'RF10')!
    const res = calculateQualifyingAttemptTime({
      base_pace_ms: v.inputs.base_pace_ms,
      setup: v.inputs.setup,
      normal_standard_draw_z: v.inputs.normal_standard_draw_z,
      sigma_ms: v.inputs.sigma_ms,
    })

    expect(res.time_ms).toBeCloseTo(v.expected.time_ms, 8)
  })

  // RF11
  it('RF11: SQ1_medium_delta', () => {
    const v = vectors.find((x) => x.id === 'RF11')!
    const res = calculateSprintQualifyingAttemptTime({
      dry: v.inputs.dry,
      is_sq3: false,
      base_pace_ms: v.inputs.base_pace_ms,
      setup: v.inputs.setup,
      normal_standard_draw_z: v.inputs.normal_standard_draw_z,
    })

    expect(res.compound_delta_ms).toBe(v.expected.compound_delta_ms)
    expect(res.time_ms).toBeCloseTo(v.expected.time_ms, 8)
  })

  // RF12
  it('RF12: SQ3_no_medium_delta', () => {
    const v = vectors.find((x) => x.id === 'RF12')!
    const res = calculateSprintQualifyingAttemptTime({
      dry: v.inputs.dry,
      is_sq3: true,
      base_pace_ms: v.inputs.base_pace_ms,
      setup: v.inputs.setup,
      normal_standard_draw_z: v.inputs.normal_standard_draw_z,
    })

    expect(res.compound_delta_ms).toBe(v.expected.compound_delta_ms)
    expect(res.time_ms).toBeCloseTo(v.expected.time_ms, 8)
  })

  // RF21
  it('RF21: normal_lap_sigma', () => {
    const v = vectors.find((x) => x.id === 'RF21')!
    const res = calculateLapSigma({
      consistency: v.inputs.consistency,
      wet: v.inputs.wet,
    })

    expect(res.sigma_s).toBeCloseTo(v.expected.sigma_s, 8)
  })

  // RF22
  it('RF22: wet_lap_sigma', () => {
    const v = vectors.find((x) => x.id === 'RF22')!
    const res = calculateLapSigma({
      consistency: v.inputs.consistency,
      wet: v.inputs.wet,
    })

    expect(res.sigma_s).toBeCloseTo(v.expected.sigma_s, 8)
  })

  // RF28
  it('RF28: weather_base_times', () => {
    const v = vectors.find((x) => x.id === 'RF28')!
    const res = calculateWeatherBaseTimes({
      base_race_s: v.inputs.base_race_s,
    })

    expect(res.dry_s).toBeCloseTo(v.expected.dry_s, 8)
    expect(res.light_rain_s).toBeCloseTo(v.expected.light_rain_s, 8)
    expect(res.heavy_rain_s).toBeCloseTo(v.expected.heavy_rain_s, 8)
    expect(res.SC_source_s).toBeCloseTo(v.expected.SC_source_s, 8)
  })
})
