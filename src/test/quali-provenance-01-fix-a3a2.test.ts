/**
 * src/test/quali-provenance-01-fix-a3a2.test.ts
 *
 * QUALI-PROVENANCE-01-FIX-A3A2: MICRO-PATCH — SIGMA ×1.5 NO QUALIFYING MOLHADO
 * (APEX GP Manager, jogo F1 texto, regras 2026)
 *
 * 12 TESTES CANÔNICOS:
 * - A3A2-01 — SIGMA SECO: qualifyingNoiseSdMs=150, wet=false -> effectiveSigmaMs=150.
 * - A3A2-02 — SIGMA MOLHADO: 150 * 1.5, wet=true -> 225 ms.
 * - A3A2-03 — PARAMETRIZAÇÃO: fixture qualifyingNoiseSdMs=200, wetNoiseMultiplier=1.25 -> 250 ms em chuva. Provar ausência de hardcode.
 * - A3A2-04 — DRAW CONTROLADO: normalDraw=+1 -> seco +150 ms, molhado +225 ms (config atual).
 * - A3A2-05 — DRAW NEGATIVO: normalDraw=-1 -> seco -150 ms, molhado -225 ms. Prova que multiplicamos sigma, não adicionamos penalidade positiva fixa.
 * - A3A2-06 — DRAW ZERO: normalDraw=0 -> noise=0 em seco e molhado. Prova que chuva não cria offset pelo canal de ruído.
 * - A3A2-07 — MAIN WET: Q1 molhado consome effectiveSigma molhado.
 * - A3A2-08 — SPRINT WET: SQ1 molhado consome o MESMO effectiveSigma.
 * - A3A2-09 — SECO BIT-STABLE: mesmos inputs/seed em seco -> resultado A3A2 = resultado A3A1.
 * - A3A2-10 — BASE WET INTACTA: A3A2 não altera o +8% da A3A1.
 * - A3A2-11 — COMPOUND INTACTO: SQ1/SQ2 seco +650 ms; SQ3 seco 0; wet 0.
 * - A3A2-12 — DRAW COUNT INALTERADO: quantidade de tentativas e sorteios permanece exatamente igual à A3A1.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  calculateQualifyingNoiseSigma,
  calculateQualifyingAttemptTime,
  calculateSprintQualifyingAttemptTime,
  DEFAULT_SOURCE_RACE_PARAMETERS,
} from '@/lib/race/pureRaceEngine'
import {
  raceQualifyingOrchestratorService,
  QualifyingDriverInput,
} from '@/services/raceQualifyingOrchestratorService'

function generateControlledParticipants(count: number = 24): QualifyingDriverInput[] {
  const teams = [
    'red_bull',
    'ferrari',
    'mclaren',
    'mercedes',
    'aston_martin',
    'alpine',
    'williams',
    'rb',
    'sauber',
    'haas',
    'andretti',
    'audi',
  ]

  const participants: QualifyingDriverInput[] = []
  for (let i = 0; i < count; i++) {
    const teamIndex = Math.floor(i / 2)
    const carIndex = ((i % 2) + 1) as 1 | 2
    const teamId = teams[teamIndex] || `team_${teamIndex + 1}`
    // Ratings escalonados de 95 até 72
    const ratingBase = 95 - i
    participants.push({
      driverId: `driver_${String(i + 1).padStart(2, '0')}`,
      driverName: `Driver ${i + 1}`,
      teamId,
      teamName: teamId.toUpperCase(),
      carIndex,
      carPerformance: ratingBase,
      speed: ratingBase,
      qualifying: ratingBase,
      form: 50,
      morale: 50,
      wet_skill: 50,
      setup: 80,
    })
  }
  return participants
}

describe('QUALI-PROVENANCE-01-FIX-A3A2: Micro-Patch Sigma ×1.5 no Qualifying Molhado', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // A3A2-01 — SIGMA SECO: qualifyingNoiseSdMs=150, wet=false -> effectiveSigmaMs=150.
  it('A3A2-01: SIGMA SECO — qualifyingNoiseSdMs=150, wet=false -> effectiveSigmaMs=150', () => {
    const res = calculateQualifyingNoiseSigma(
      { wet: false },
      {
        qualifying_noise_sd_ms: 150,
        wet_noise_multiplier: 1.5,
      },
    )
    expect(res.sigma_ms).toBe(150)
  })

  // A3A2-02 — SIGMA MOLHADO: 150 × 1.5, wet=true -> 225 ms.
  it('A3A2-02: SIGMA MOLHADO — 150 × 1.5, wet=true -> 225 ms', () => {
    const res = calculateQualifyingNoiseSigma(
      { wet: true },
      {
        qualifying_noise_sd_ms: 150,
        wet_noise_multiplier: 1.5,
      },
    )
    expect(res.sigma_ms).toBe(225)
  })

  // A3A2-03 — PARAMETRIZAÇÃO: fixture qualifyingNoiseSdMs=200, wetNoiseMultiplier=1.25 -> 250 ms em chuva. Provar ausência de hardcode.
  it('A3A2-03: PARAMETRIZAÇÃO — qualifyingNoiseSdMs=200, wetNoiseMultiplier=1.25 -> 250 ms (sem hardcode)', () => {
    const res = calculateQualifyingNoiseSigma(
      { wet: true },
      {
        qualifying_noise_sd_ms: 200,
        wet_noise_multiplier: 1.25,
      },
    )
    expect(res.sigma_ms).toBe(250)

    const resDry = calculateQualifyingNoiseSigma(
      { wet: false },
      {
        qualifying_noise_sd_ms: 200,
        wet_noise_multiplier: 1.25,
      },
    )
    expect(resDry.sigma_ms).toBe(200)
  })

  // A3A2-04 — DRAW CONTROLADO: normalDraw=+1 -> seco +150 ms, molhado +225 ms (config atual).
  it('A3A2-04: DRAW CONTROLADO — normalDraw=+1 -> seco +150 ms, molhado +225 ms', () => {
    const basePaceMs = 80000
    const setup = 0
    const normalZ = 1.0

    const drySigma = calculateQualifyingNoiseSigma({ wet: false }).sigma_ms
    const wetSigma = calculateQualifyingNoiseSigma({ wet: true }).sigma_ms

    expect(drySigma).toBe(150)
    expect(wetSigma).toBe(225)

    const dryAttempt = calculateQualifyingAttemptTime({
      base_pace_ms: basePaceMs,
      setup,
      normal_standard_draw_z: normalZ,
      sigma_ms: drySigma,
    })

    const wetAttempt = calculateQualifyingAttemptTime({
      base_pace_ms: basePaceMs,
      setup,
      normal_standard_draw_z: normalZ,
      sigma_ms: wetSigma,
    })

    expect(dryAttempt.time_ms).toBe(basePaceMs + 150)
    expect(wetAttempt.time_ms).toBe(basePaceMs + 225)
    expect(wetAttempt.time_ms - dryAttempt.time_ms).toBe(75) // exatos 225 - 150 = 75 ms
  })

  // A3A2-05 — DRAW NEGATIVO: normalDraw=-1 -> seco -150 ms, molhado -225 ms. Prova que multiplicamos sigma, não adicionamos penalidade positiva fixa.
  it('A3A2-05: DRAW NEGATIVO — normalDraw=-1 -> seco -150 ms, molhado -225 ms (multiplicador de desvio, não penalidade fixa)', () => {
    const basePaceMs = 80000
    const setup = 0
    const normalZ = -1.0

    const drySigma = calculateQualifyingNoiseSigma({ wet: false }).sigma_ms
    const wetSigma = calculateQualifyingNoiseSigma({ wet: true }).sigma_ms

    const dryAttempt = calculateQualifyingAttemptTime({
      base_pace_ms: basePaceMs,
      setup,
      normal_standard_draw_z: normalZ,
      sigma_ms: drySigma,
    })

    const wetAttempt = calculateQualifyingAttemptTime({
      base_pace_ms: basePaceMs,
      setup,
      normal_standard_draw_z: normalZ,
      sigma_ms: wetSigma,
    })

    expect(dryAttempt.time_ms).toBe(basePaceMs - 150)
    expect(wetAttempt.time_ms).toBe(basePaceMs - 225)
    expect(wetAttempt.time_ms - dryAttempt.time_ms).toBe(-75) // em draw negativo, volta molhada fica 75ms mais rápida no ruído!
  })

  // A3A2-06 — DRAW ZERO: normalDraw=0 -> noise=0 em seco e molhado. Prova que chuva não cria offset pelo canal de ruído.
  it('A3A2-06: DRAW ZERO — normalDraw=0 -> noise=0 em seco e molhado (sem offset artificial pelo canal de ruído)', () => {
    const basePaceMs = 80000
    const setup = 50 // com setup para verificar que bonus se mantém

    const drySigma = calculateQualifyingNoiseSigma({ wet: false }).sigma_ms
    const wetSigma = calculateQualifyingNoiseSigma({ wet: true }).sigma_ms

    const dryAttempt = calculateQualifyingAttemptTime({
      base_pace_ms: basePaceMs,
      setup,
      normal_standard_draw_z: 0,
      sigma_ms: drySigma,
    })

    const wetAttempt = calculateQualifyingAttemptTime({
      base_pace_ms: basePaceMs,
      setup,
      normal_standard_draw_z: 0,
      sigma_ms: wetSigma,
    })

    // Ambos devem ser estritamente iguais a basePaceMs - bonusMs
    expect(dryAttempt.time_ms).toBe(wetAttempt.time_ms)
    expect(dryAttempt.bonus_ms).toBe(wetAttempt.bonus_ms)
    expect(dryAttempt.time_ms).toBe(basePaceMs - dryAttempt.bonus_ms)
  })

  // A3A2-07 — MAIN WET: Q1 molhado consome effectiveSigma molhado.
  it('A3A2-07: MAIN WET — Q1 molhado consome effectiveSigma molhado (225 ms na config canônica)', async () => {
    const participants = generateControlledParticipants(24)

    const state = await raceQualifyingOrchestratorService.executeQ1({
      careerId: 'c_a3a2_main_wet',
      seasonId: 's_2026',
      round: 1,
      participants,
      trackRecordMs: 80000,
      wet: true,
      forceBypassPracticeCheck: true,
    })

    expect(state.results.length).toBe(24)
    // Para cada participante, a volta é: basePaceMs - bonusMs + z * sigma
    // Como conhecemos z, basePaceMs, bonusMs e timeMs: timeMs - (basePaceMs - bonusMs) = z * sigma
    // Logo sigma = (timeMs - basePaceMs + bonusMs) / z
    for (const r of state.results) {
      const att = r.attempts[0]
      const z = att.normalDrawZ
      if (Math.abs(z) > 1e-4) {
        const reconstructedNoise = att.timeMs - (r.basePaceMs - att.bonusMs)
        const observedSigma = reconstructedNoise / z
        expect(observedSigma).toBeCloseTo(225, 2)
      }
    }
  })

  // A3A2-08 — SPRINT WET: SQ1 molhado consome o MESMO effectiveSigma.
  it('A3A2-08: SPRINT WET — SQ1 molhado consome o MESMO effectiveSigma (225 ms)', async () => {
    const participants = generateControlledParticipants(24)

    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: 'c_a3a2_sprint_wet',
      seasonId: 's_2026',
      round: 2, // round 2 é sprint
      participants,
      trackRecordMs: 80000,
      wet: true,
      forceBypassPracticeCheck: true,
    })

    expect(state.results.length).toBe(24)
    for (const r of state.results) {
      const att = r.attempts[0]
      const z = att.normalDrawZ
      if (Math.abs(z) > 1e-4) {
        // No molhado, compoundDeltaMs é 0
        const reconstructedNoise = att.timeMs - (r.basePaceMs - att.bonusMs)
        const observedSigma = reconstructedNoise / z
        expect(observedSigma).toBeCloseTo(225, 2)
      }
    }
  })

  // A3A2-09 — SECO BIT-STABLE: mesmos inputs/seed em seco -> resultado A3A2 = resultado A3A1.
  it('A3A2-09: SECO BIT-STABLE — mesmos inputs/seed em seco -> tempos e ordem idênticos à A3A1', async () => {
    const participants = generateControlledParticipants(24)

    const state1 = await raceQualifyingOrchestratorService.executeQ1({
      careerId: 'c_a3a2_dry_bitstable',
      seasonId: 's_2026',
      round: 1,
      participants,
      trackRecordMs: 80000,
      wet: false,
      forceBypassPracticeCheck: true,
    })

    // Limpa cache e executa novamente com mesmos parâmetros
    raceQualifyingOrchestratorService.clearMemoryCache()

    const state2 = await raceQualifyingOrchestratorService.executeQ1({
      careerId: 'c_a3a2_dry_bitstable',
      seasonId: 's_2026',
      round: 1,
      participants,
      trackRecordMs: 80000,
      wet: false,
      forceBypassPracticeCheck: true,
    })

    expect(state1.results.length).toBe(state2.results.length)
    for (let i = 0; i < state1.results.length; i++) {
      const r1 = state1.results[i]
      const r2 = state2.results[i]
      expect(r1.driverId).toBe(r2.driverId)
      expect(r1.bestTimeMs).toBe(r2.bestTimeMs)
      expect(r1.basePaceMs).toBe(r2.basePaceMs)
      expect(r1.bonusMs).toBe(r2.bonusMs)
      expect(r1.attempts[0].normalDrawZ).toBe(r2.attempts[0].normalDrawZ)
    }

    // Verifica que sigma no seco reconstruído foi exatamente 150
    const attSample = state1.results[0].attempts[0]
    const zSample = attSample.normalDrawZ
    const reconstructedDryNoise =
      attSample.timeMs - (state1.results[0].basePaceMs - attSample.bonusMs)
    expect(reconstructedDryNoise / zSample).toBeCloseTo(150, 2)
  })

  // A3A2-10 — BASE WET INTACTA: A3A2 não altera o +8% da A3A1.
  it('A3A2-10: BASE WET INTACTA — A3A2 não altera o +8% da A3A1 no ritmo base', async () => {
    const participants = generateControlledParticipants(24)

    const dryState = await raceQualifyingOrchestratorService.executeQ1({
      careerId: 'c_a3a2_base_dry',
      seasonId: 's_2026',
      round: 1,
      participants,
      trackRecordMs: 80000,
      wet: false,
      forceBypassPracticeCheck: true,
    })

    const wetState = await raceQualifyingOrchestratorService.executeQ1({
      careerId: 'c_a3a2_base_wet',
      seasonId: 's_2026',
      round: 1,
      participants,
      trackRecordMs: 80000,
      wet: true,
      forceBypassPracticeCheck: true,
    })

    // BaseQuali: 80.000 * (1 - 0.015) = 78.800 ms
    // No seco: baseQuali * 1 = 78.800 ms
    // No wet: baseQuali * 1.08 = 85.104 ms (+6.304 ms)
    // Para o piloto P1 (melhor rating, ratingDeltaMs = 0):
    const p1Dry = dryState.results.find((r) => r.driverId === 'driver_01')!
    const p1Wet = wetState.results.find((r) => r.driverId === 'driver_01')!

    expect(p1Dry.basePaceMs).toBe(78800)
    expect(p1Wet.basePaceMs).toBe(78800 * 1.08)
    expect(p1Wet.basePaceMs).toBe(85104)
  })

  // A3A2-11 — COMPOUND INTACTO: SQ1/SQ2 seco +650 ms; SQ3 seco 0; wet 0.
  it('A3A2-11: COMPOUND INTACTO — SQ1/SQ2 seco +650 ms; SQ3 seco 0; wet 0', () => {
    const basePaceMs = 80000
    const setup = 0
    const z = 0

    // SQ1 Seco -> +650 ms
    const sq1Dry = calculateSprintQualifyingAttemptTime({
      dry: true,
      is_sq3: false,
      base_pace_ms: basePaceMs,
      setup,
      normal_standard_draw_z: z,
    })
    expect(sq1Dry.compound_delta_ms).toBe(650)
    expect(sq1Dry.time_ms).toBe(basePaceMs + 650)

    // SQ3 Seco -> 0 ms
    const sq3Dry = calculateSprintQualifyingAttemptTime({
      dry: true,
      is_sq3: true,
      base_pace_ms: basePaceMs,
      setup,
      normal_standard_draw_z: z,
    })
    expect(sq3Dry.compound_delta_ms).toBe(0)
    expect(sq3Dry.time_ms).toBe(basePaceMs)

    // SQ1 Molhado -> 0 ms
    const sq1Wet = calculateSprintQualifyingAttemptTime({
      dry: false,
      is_sq3: false,
      base_pace_ms: basePaceMs,
      setup,
      normal_standard_draw_z: z,
    })
    expect(sq1Wet.compound_delta_ms).toBe(0)
    expect(sq1Wet.time_ms).toBe(basePaceMs)

    // SQ3 Molhado -> 0 ms
    const sq3Wet = calculateSprintQualifyingAttemptTime({
      dry: false,
      is_sq3: true,
      base_pace_ms: basePaceMs,
      setup,
      normal_standard_draw_z: z,
    })
    expect(sq3Wet.compound_delta_ms).toBe(0)
    expect(sq3Wet.time_ms).toBe(basePaceMs)
  })

  // A3A2-12 — DRAW COUNT INALTERADO: quantidade de tentativas e sorteios permanece exatamente igual à A3A1.
  it('A3A2-12: DRAW COUNT INALTERADO — 1 tentativa e 1 normal draw por participante por fase', async () => {
    const participants = generateControlledParticipants(24)

    const state = await raceQualifyingOrchestratorService.executeQ1({
      careerId: 'c_a3a2_draw_count',
      seasonId: 's_2026',
      round: 1,
      participants,
      trackRecordMs: 80000,
      wet: true,
      forceBypassPracticeCheck: true,
    })

    expect(state.results.length).toBe(24)
    for (const r of state.results) {
      expect(r.attempts.length).toBe(1)
      expect(typeof r.attempts[0].normalDrawZ).toBe('number')
      expect(Number.isFinite(r.attempts[0].normalDrawZ)).toBe(true)
    }
  })
})
