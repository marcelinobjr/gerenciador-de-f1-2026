/**
 * QUALI-PROVENANCE-01-FIX-A3B: Suíte Canônica de Formalização e Homologação de 1 Tentativa por Fase
 *
 * Testes A3B-01 a A3B-12:
 * - A3B-01: Q1 — cada participante executa exatamente 1 tentativa.
 * - A3B-02: Q2 — cada classificado executa exatamente 1 tentativa.
 * - A3B-03: Q3 — cada finalista executa exatamente 1 tentativa.
 * - A3B-04: SQ1 — 1 tentativa por participante.
 * - A3B-05: SQ2 — 1 tentativa por classificado.
 * - A3B-06: SQ3 — 1 tentativa por finalista.
 * - A3B-07: DRAW COUNT MAIN — fixture 24->18->10: Q1=24, Q2=18, Q3=10, total 52 tentativas.
 * - A3B-08: DRAW COUNT SPRINT — 24+18+10 = 52.
 * - A3B-09: SEM BEST-OF-TWO — fixture controlada prova que apenas o primeiro/único draw da fase determina o tempo; não há segundo draw selecionado por mínimo.
 * - A3B-10: DEFAULT CANÔNICO — sem override explícito, attemptsPerPhase = 1.
 * - A3B-11: OVERRIDE NÃO ATIVO — se suportado, provar que não está ativo na config canônica atual.
 * - A3B-12: RELOAD/IDEMPOTÊNCIA — reabrir sessão persistida não cria tentativa adicional.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  raceQualifyingOrchestratorService,
  QualifyingDriverInput,
} from '@/services/raceQualifyingOrchestratorService'
import { canonicalWeekendSlotPersistenceService } from '@/services/canonicalWeekendSlotPersistenceService'
import { DEFAULT_SOURCE_RACE_PARAMETERS } from '@/lib/race/pureRaceEngine'

// Fixture canônica de 24 participantes para Qualificação (MAIN e Sprint)
function createCanonical24Participants(): QualifyingDriverInput[] {
  const teams = [
    { id: 'ferrari', name: 'Ferrari', perf: 92 },
    { id: 'mclaren', name: 'McLaren', perf: 91 },
    { id: 'redbull', name: 'Red Bull Racing', perf: 90 },
    { id: 'mercedes', name: 'Mercedes', perf: 88 },
    { id: 'aston', name: 'Aston Martin', perf: 82 },
    { id: 'alpine', name: 'Alpine', perf: 80 },
    { id: 'williams', name: 'Williams', perf: 78 },
    { id: 'rb', name: 'Racing Bulls', perf: 77 },
    { id: 'sauber', name: 'Sauber', perf: 75 },
    { id: 'haas', name: 'Haas', perf: 74 },
    { id: 'audi', name: 'Audi F1 Team', perf: 76 },
    { id: 'andretti', name: 'Andretti Cadillac', perf: 73 },
  ]

  const participants: QualifyingDriverInput[] = []
  let dIdx = 1

  for (const team of teams) {
    for (let c = 1; c <= 2; c++) {
      const driverId = `drv_${team.id}_${c}`
      const driverName = `Driver ${dIdx}`
      participants.push({
        driverId,
        driverName,
        teamId: team.id,
        teamName: team.name,
        carIndex: c as 1 | 2,
        carPerformance: team.perf,
        speed: 75 + ((dIdx * 3) % 20),
        qualifying: 75 + ((dIdx * 5) % 20),
        form: 50,
        morale: 50,
        wet_skill: 50,
        setup: 15,
      })
      dIdx++
    }
  }

  return participants
}

describe('QUALI-PROVENANCE-01-FIX-A3B: Suíte Canônica de Formalização de 1 Tentativa por Fase', () => {
  beforeEach(() => {
    raceQualifyingOrchestratorService.clearMemoryCache()
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  // =========================================================================
  // A3B-01: Q1 — cada participante executa exatamente 1 tentativa
  // =========================================================================
  it('A3B-01: Q1 — cada participante executa exatamente 1 tentativa', async () => {
    const careerId = 'career_a3b_01'
    const seasonId = 'season_2026'
    const round = 1
    const participants = createCanonical24Participants()

    const q1State = await raceQualifyingOrchestratorService.executeQ1({
      careerId,
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
    })

    expect(q1State.results).toHaveLength(24)
    q1State.results.forEach((r) => {
      expect(r.attempts).toBeDefined()
      expect(r.attempts).toHaveLength(1)
      expect(r.attempts[0].attemptNumber).toBe(1)
      expect(r.bestTimeMs).toBe(r.attempts[0].timeMs)
      expect(typeof r.attempts[0].timeMs).toBe('number')
      expect(r.attempts[0].timeMs).toBeGreaterThan(0)
      expect(Number.isFinite(r.attempts[0].timeMs)).toBe(true)
    })
  })

  // =========================================================================
  // A3B-02: Q2 — cada classificado executa exatamente 1 tentativa
  // =========================================================================
  it('A3B-02: Q2 — cada classificado executa exatamente 1 tentativa', async () => {
    const careerId = 'career_a3b_02'
    const seasonId = 'season_2026'
    const round = 1
    const participants = createCanonical24Participants()

    await raceQualifyingOrchestratorService.executeQ1({
      careerId,
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
    })

    const q2State = await raceQualifyingOrchestratorService.executeQ2({
      careerId,
      seasonId,
      round,
    })

    expect(q2State.results).toHaveLength(18)
    q2State.results.forEach((r) => {
      expect(r.attempts).toHaveLength(1)
      expect(r.attempts[0].attemptNumber).toBe(1)
      expect(r.bestTimeMs).toBe(r.attempts[0].timeMs)
      expect(typeof r.attempts[0].timeMs).toBe('number')
      expect(r.attempts[0].timeMs).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // A3B-03: Q3 — cada finalista executa exatamente 1 tentativa
  // =========================================================================
  it('A3B-03: Q3 — cada finalista executa exatamente 1 tentativa', async () => {
    const careerId = 'career_a3b_03'
    const seasonId = 'season_2026'
    const round = 1
    const participants = createCanonical24Participants()

    await raceQualifyingOrchestratorService.executeQ1({
      careerId,
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
    })

    await raceQualifyingOrchestratorService.executeQ2({
      careerId,
      seasonId,
      round,
    })

    const q3State = await raceQualifyingOrchestratorService.executeQ3({
      careerId,
      seasonId,
      round,
    })

    expect(q3State.results).toHaveLength(10)
    q3State.results.forEach((r) => {
      expect(r.attempts).toHaveLength(1)
      expect(r.attempts[0].attemptNumber).toBe(1)
      expect(r.bestTimeMs).toBe(r.attempts[0].timeMs)
      expect(typeof r.attempts[0].timeMs).toBe('number')
      expect(r.attempts[0].timeMs).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // A3B-04: SQ1 — 1 tentativa por participante
  // =========================================================================
  it('A3B-04: SQ1 — 1 tentativa por participante', async () => {
    const careerId = 'career_a3b_04'
    const seasonId = 'season_2026'
    const round = 2 // round 2 é sprint
    const participants = createCanonical24Participants()

    const sq1State = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
    })

    expect(sq1State.results).toHaveLength(24)
    sq1State.results.forEach((r) => {
      expect(r.attempts).toHaveLength(1)
      expect(r.attempts[0].attemptNumber).toBe(1)
      expect(r.bestTimeMs).toBe(r.attempts[0].timeMs)
      expect(r.attempts[0].compoundUsed).toBe('MEDIUM')
      expect(typeof r.attempts[0].timeMs).toBe('number')
      expect(r.attempts[0].timeMs).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // A3B-05: SQ2 — 1 tentativa por classificado
  // =========================================================================
  it('A3B-05: SQ2 — 1 tentativa por classificado', async () => {
    const careerId = 'career_a3b_05'
    const seasonId = 'season_2026'
    const round = 2 // round 2 é sprint
    const participants = createCanonical24Participants()

    await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
    })

    const sq2State = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
      forceBypassPracticeCheck: true,
    })

    expect(sq2State.results).toHaveLength(18)
    sq2State.results.forEach((r) => {
      expect(r.attempts).toHaveLength(1)
      expect(r.attempts[0].attemptNumber).toBe(1)
      expect(r.bestTimeMs).toBe(r.attempts[0].timeMs)
      expect(r.attempts[0].compoundUsed).toBe('MEDIUM')
      expect(typeof r.attempts[0].timeMs).toBe('number')
      expect(r.attempts[0].timeMs).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // A3B-06: SQ3 — 1 tentativa por finalista
  // =========================================================================
  it('A3B-06: SQ3 — 1 tentativa por finalista', async () => {
    const careerId = 'career_a3b_06'
    const seasonId = 'season_2026'
    const round = 2 // round 2 é sprint
    const participants = createCanonical24Participants()

    await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
    })

    await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
      forceBypassPracticeCheck: true,
    })

    const sq3State = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
      forceBypassPracticeCheck: true,
    })

    expect(sq3State.results).toHaveLength(10)
    sq3State.results.forEach((r) => {
      expect(r.attempts).toHaveLength(1)
      expect(r.attempts[0].attemptNumber).toBe(1)
      expect(r.bestTimeMs).toBe(r.attempts[0].timeMs)
      expect(r.attempts[0].compoundUsed).toBe('SOFT')
      expect(typeof r.attempts[0].timeMs).toBe('number')
      expect(r.attempts[0].timeMs).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // A3B-07: DRAW COUNT MAIN — fixture 24->18->10: Q1=24, Q2=18, Q3=10, total 52 tentativas
  // =========================================================================
  it('A3B-07: DRAW COUNT MAIN — fixture 24->18->10: Q1=24, Q2=18, Q3=10, total 52 tentativas', async () => {
    const careerId = 'career_a3b_07'
    const seasonId = 'season_2026'
    const round = 1
    const participants = createCanonical24Participants()

    const q1 = await raceQualifyingOrchestratorService.executeQ1({
      careerId,
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
    })

    const q2 = await raceQualifyingOrchestratorService.executeQ2({
      careerId,
      seasonId,
      round,
    })

    const q3 = await raceQualifyingOrchestratorService.executeQ3({
      careerId,
      seasonId,
      round,
    })

    const countQ1Attempts = q1.results.reduce((acc, r) => acc + r.attempts.length, 0)
    const countQ2Attempts = q2.results.reduce((acc, r) => acc + r.attempts.length, 0)
    const countQ3Attempts = q3.results.reduce((acc, r) => acc + r.attempts.length, 0)
    const totalMainAttempts = countQ1Attempts + countQ2Attempts + countQ3Attempts

    expect(countQ1Attempts).toBe(24)
    expect(countQ2Attempts).toBe(18)
    expect(countQ3Attempts).toBe(10)
    expect(totalMainAttempts).toBe(52)
  })

  // =========================================================================
  // A3B-08: DRAW COUNT SPRINT — 24+18+10 = 52
  // =========================================================================
  it('A3B-08: DRAW COUNT SPRINT — 24+18+10 = 52', async () => {
    const careerId = 'career_a3b_08'
    const seasonId = 'season_2026'
    const round = 2
    const participants = createCanonical24Participants()

    const sq1 = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
    })

    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
      forceBypassPracticeCheck: true,
    })

    const sq3 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
      forceBypassPracticeCheck: true,
    })

    const countSq1Attempts = sq1.results.reduce((acc, r) => acc + r.attempts.length, 0)
    const countSq2Attempts = sq2.results.reduce((acc, r) => acc + r.attempts.length, 0)
    const countSq3Attempts = sq3.results.reduce((acc, r) => acc + r.attempts.length, 0)
    const totalSprintAttempts = countSq1Attempts + countSq2Attempts + countSq3Attempts

    expect(countSq1Attempts).toBe(24)
    expect(countSq2Attempts).toBe(18)
    expect(countSq3Attempts).toBe(10)
    expect(totalSprintAttempts).toBe(52)
  })

  // =========================================================================
  // A3B-09: SEM BEST-OF-TWO — fixture controlada prova que apenas o primeiro/único draw da fase
  // determina o tempo; não há segundo draw selecionado por mínimo
  // =========================================================================
  it('A3B-09: SEM BEST-OF-TWO — apenas o único draw da tentativa determina o tempo da fase', async () => {
    const careerId = 'career_a3b_09'
    const seasonId = 'season_2026'
    const round = 1
    const participants = createCanonical24Participants()

    const q1State = await raceQualifyingOrchestratorService.executeQ1({
      careerId,
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
    })

    for (const r of q1State.results) {
      // Exatamente 1 tentativa registrada
      expect(r.attempts.length).toBe(1)
      // O tempo final é estritamente o tempo do primeiro sorteio, sem min(attempt1, attempt2)
      expect(r.bestTimeMs).toBe(r.attempts[0].timeMs)
      // Não existe attemptNumber 2
      expect(r.attempts.some((a) => a.attemptNumber === 2)).toBe(false)
    }
  })

  // =========================================================================
  // A3B-10: DEFAULT CANÔNICO — sem override explícito, attemptsPerPhase = 1
  // =========================================================================
  it('A3B-10: DEFAULT CANÔNICO — sem override explícito, attemptsPerPhase opera estritamente com 1', async () => {
    const careerId = 'career_a3b_10'
    const seasonId = 'season_2026'
    const round = 1
    const participants = createCanonical24Participants()

    // Chamada canônica sem passar o parâmetro opcional attemptsPerPhase
    const q1State = await raceQualifyingOrchestratorService.executeQ1({
      careerId,
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
      // attemptsPerPhase intencionalmente omitido (undefined)
    })

    // Cada piloto no grid gerou exatamente 1 tentativa
    expect(q1State.results.every((r) => r.attempts.length === 1)).toBe(true)
    expect(q1State.results.every((r) => r.attempts[0].attemptNumber === 1)).toBe(true)
  })

  // =========================================================================
  // A3B-11: OVERRIDE NÃO ATIVO — a configuração canônica atual não possui override ativo
  // e se um override for explicitamente fornecido em ambiente isolado de teste, a arquitetura
  // suporta sem quebrar a baseline
  // =========================================================================
  it('A3B-11: OVERRIDE NÃO ATIVO — parâmetros da fonte não impõem >1 tentativa; suporte arquitetural a override testado de forma controlada', async () => {
    // 1. Provar que DEFAULT_SOURCE_RACE_PARAMETERS não define nem força attempts > 1
    expect((DEFAULT_SOURCE_RACE_PARAMETERS as any).attemptsPerPhase).toBeUndefined()
    expect((DEFAULT_SOURCE_RACE_PARAMETERS as any).effectiveAttemptsPerPhase).toBeUndefined()

    // 2. Provar que a arquitetura suporta override pontual de produto sem quebrar
    const careerId = 'career_a3b_11'
    const seasonId = 'season_2026'
    const round = 1
    const participants = createCanonical24Participants()

    const overriddenState = await raceQualifyingOrchestratorService.executeQ1({
      careerId,
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 2, // PRODUCT OVERRIDE EXPLÍCITO
    })

    expect(overriddenState.results[0].attempts).toHaveLength(2)
    expect(overriddenState.results[0].attempts[0].attemptNumber).toBe(1)
    expect(overriddenState.results[0].attempts[1].attemptNumber).toBe(2)
    expect(overriddenState.results[0].bestTimeMs).toBe(
      Math.min(
        overriddenState.results[0].attempts[0].timeMs,
        overriddenState.results[0].attempts[1].timeMs,
      ),
    )

    // 3. Provar que em outra chamada sem o override, a baseline permanece 1
    raceQualifyingOrchestratorService.clearMemoryCache()
    const baselineState = await raceQualifyingOrchestratorService.executeQ1({
      careerId: 'career_a3b_11_baseline',
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
    })
    expect(baselineState.results[0].attempts).toHaveLength(1)
  })

  // =========================================================================
  // A3B-12: RELOAD/IDEMPOTÊNCIA — reabrir sessão persistida não cria tentativa adicional
  // =========================================================================
  it('A3B-12: RELOAD/IDEMPOTÊNCIA — reabrir sessão persistida não cria tentativa adicional nem recalcula RNG', async () => {
    const careerId = 'career_a3b_12'
    const seasonId = 'season_2026'
    const round = 1
    const participants = createCanonical24Participants()

    // 1ª execução de Q1
    const q1Initial = await raceQualifyingOrchestratorService.executeQ1({
      careerId,
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
    })

    // Limpa apenas o cache em memória (simulando reload da aba / reabertura da tela)
    raceQualifyingOrchestratorService.clearMemoryCache()

    // 2ª execução (ou reload) do Q1 para o mesmo round/careerId
    const q1Reloaded = await raceQualifyingOrchestratorService.executeQ1({
      careerId,
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
    })

    // Deve ser idêntico em status e tempos
    expect(q1Reloaded.isCompleted).toBe(true)
    expect(q1Reloaded.results).toHaveLength(24)
    q1Reloaded.results.forEach((r, idx) => {
      const orig = q1Initial.results[idx]
      expect(r.driverId).toBe(orig.driverId)
      expect(r.bestTimeMs).toBe(orig.bestTimeMs)
      expect(r.attempts).toHaveLength(1) // Continua tendo exatamente 1 tentativa
      expect(r.attempts[0].timeMs).toBe(orig.attempts[0].timeMs)
      expect(r.attempts[0].normalDrawZ).toBe(orig.attempts[0].normalDrawZ)
    })
  })

  // =========================================================================
  // PROVAS COMPLEMENTARES DE HOMOLOGAÇÃO (CLOSE-2)
  // =========================================================================
  describe('HOMOLOGAÇÃO CLOSE-2: Bit-Stability, Integridade de Grids e Cortes', () => {
    it('CLOSE2-01: BIT-STABILITY — MAIN Seco, MAIN Molhado, Sprint Seco e Sprint Molhado são determinísticos e idênticos para mesmos inputs/seed', async () => {
      const participants = createCanonical24Participants()

      // 1. MAIN SECO
      const mainDry1 = await raceQualifyingOrchestratorService.executeQ1({
        careerId: 'c_bitstable_main_dry',
        seasonId: 's_2026',
        round: 1,
        participants,
        trackRecordMs: 80000,
        wet: false,
        forceBypassPracticeCheck: true,
      })
      raceQualifyingOrchestratorService.clearMemoryCache()
      const mainDry2 = await raceQualifyingOrchestratorService.executeQ1({
        careerId: 'c_bitstable_main_dry',
        seasonId: 's_2026',
        round: 1,
        participants,
        trackRecordMs: 80000,
        wet: false,
        forceBypassPracticeCheck: true,
      })
      expect(mainDry1.results.length).toBe(24)
      for (let i = 0; i < 24; i++) {
        expect(mainDry1.results[i].driverId).toBe(mainDry2.results[i].driverId)
        expect(mainDry1.results[i].bestTimeMs).toBe(mainDry2.results[i].bestTimeMs)
        expect(mainDry1.results[i].basePaceMs).toBe(mainDry2.results[i].basePaceMs)
        expect(mainDry1.results[i].bonusMs).toBe(mainDry2.results[i].bonusMs)
        expect(mainDry1.results[i].attempts[0].normalDrawZ).toBe(
          mainDry2.results[i].attempts[0].normalDrawZ,
        )
      }

      // 2. MAIN MOLHADO
      const mainWet1 = await raceQualifyingOrchestratorService.executeQ1({
        careerId: 'c_bitstable_main_wet',
        seasonId: 's_2026',
        round: 1,
        participants,
        trackRecordMs: 80000,
        wet: true,
        forceBypassPracticeCheck: true,
      })
      raceQualifyingOrchestratorService.clearMemoryCache()
      const mainWet2 = await raceQualifyingOrchestratorService.executeQ1({
        careerId: 'c_bitstable_main_wet',
        seasonId: 's_2026',
        round: 1,
        participants,
        trackRecordMs: 80000,
        wet: true,
        forceBypassPracticeCheck: true,
      })
      expect(mainWet1.results.length).toBe(24)
      for (let i = 0; i < 24; i++) {
        expect(mainWet1.results[i].driverId).toBe(mainWet2.results[i].driverId)
        expect(mainWet1.results[i].bestTimeMs).toBe(mainWet2.results[i].bestTimeMs)
        expect(mainWet1.results[i].basePaceMs).toBe(mainWet2.results[i].basePaceMs)
        expect(mainWet1.results[i].attempts[0].normalDrawZ).toBe(
          mainWet2.results[i].attempts[0].normalDrawZ,
        )
      }

      // 3. SPRINT SECO
      const sprintDry1 = await raceQualifyingOrchestratorService.executeSQ1({
        careerId: 'c_bitstable_sprint_dry',
        seasonId: 's_2026',
        round: 2,
        participants,
        trackRecordMs: 80000,
        wet: false,
        forceBypassPracticeCheck: true,
      })
      raceQualifyingOrchestratorService.clearMemoryCache()
      const sprintDry2 = await raceQualifyingOrchestratorService.executeSQ1({
        careerId: 'c_bitstable_sprint_dry',
        seasonId: 's_2026',
        round: 2,
        participants,
        trackRecordMs: 80000,
        wet: false,
        forceBypassPracticeCheck: true,
      })
      expect(sprintDry1.results.length).toBe(24)
      for (let i = 0; i < 24; i++) {
        expect(sprintDry1.results[i].driverId).toBe(sprintDry2.results[i].driverId)
        expect(sprintDry1.results[i].bestTimeMs).toBe(sprintDry2.results[i].bestTimeMs)
        expect(sprintDry1.results[i].basePaceMs).toBe(sprintDry2.results[i].basePaceMs)
        expect(sprintDry1.results[i].attempts[0].normalDrawZ).toBe(
          sprintDry2.results[i].attempts[0].normalDrawZ,
        )
      }

      // 4. SPRINT MOLHADO
      const sprintWet1 = await raceQualifyingOrchestratorService.executeSQ1({
        careerId: 'c_bitstable_sprint_wet',
        seasonId: 's_2026',
        round: 2,
        participants,
        trackRecordMs: 80000,
        wet: true,
        forceBypassPracticeCheck: true,
      })
      raceQualifyingOrchestratorService.clearMemoryCache()
      const sprintWet2 = await raceQualifyingOrchestratorService.executeSQ1({
        careerId: 'c_bitstable_sprint_wet',
        seasonId: 's_2026',
        round: 2,
        participants,
        trackRecordMs: 80000,
        wet: true,
        forceBypassPracticeCheck: true,
      })
      expect(sprintWet1.results.length).toBe(24)
      for (let i = 0; i < 24; i++) {
        expect(sprintWet1.results[i].driverId).toBe(sprintWet2.results[i].driverId)
        expect(sprintWet1.results[i].bestTimeMs).toBe(sprintWet2.results[i].bestTimeMs)
        expect(sprintWet1.results[i].basePaceMs).toBe(sprintWet2.results[i].basePaceMs)
        expect(sprintWet1.results[i].attempts[0].normalDrawZ).toBe(
          sprintWet2.results[i].attempts[0].normalDrawZ,
        )
      }
    })

    it('CLOSE2-02: INTEGRIDADE MAIN — cortes 24->18->10, QUALIFYING_RESULT e STARTING_GRID P1-P24 bijetivo sem NaN/Infinity', async () => {
      const careerId = 'c_integrity_main'
      const seasonId = 's_2026'
      const round = 1
      const participants = createCanonical24Participants()

      const q1 = await raceQualifyingOrchestratorService.executeQ1({
        careerId,
        seasonId,
        round,
        participants,
        trackRecordMs: 80000,
        forceBypassPracticeCheck: true,
      })
      expect(q1.results).toHaveLength(24)

      const q2 = await raceQualifyingOrchestratorService.executeQ2({
        careerId,
        seasonId,
        round,
      })
      expect(q2.results).toHaveLength(18)

      const q3 = await raceQualifyingOrchestratorService.executeQ3({
        careerId,
        seasonId,
        round,
      })
      expect(q3.results).toHaveLength(10)

      // Grid e resultado oficial
      const officialGrid = await raceQualifyingOrchestratorService.buildStartingGrid({
        careerId,
        seasonId,
        round,
      })
      expect(officialGrid).toBeDefined()
      expect(officialGrid!.entries).toHaveLength(24)

      const driverIds = new Set<string>()
      const positions = new Set<number>()

      officialGrid!.entries.forEach((e) => {
        expect(driverIds.has(e.driverId)).toBe(false)
        driverIds.add(e.driverId)

        expect(positions.has(e.gridPosition)).toBe(false)
        positions.add(e.gridPosition)

        expect(Number.isFinite(e.gridPosition)).toBe(true)
        expect(Number.isFinite(e.qualifyingPosition)).toBe(true)
        expect(Number.isNaN(e.gridPosition)).toBe(false)
        expect(Number.isNaN(e.qualifyingPosition)).toBe(false)
      })

      expect(driverIds.size).toBe(24)
      expect(positions.size).toBe(24)
      for (let p = 1; p <= 24; p++) {
        expect(positions.has(p)).toBe(true)
      }
    })

    it('CLOSE2-03: INTEGRIDADE SPRINT — cortes 24->18->10, SPRINT_QUALIFYING_RESULT e SPRINT_STARTING_GRID P1-P24 bijetivo sem NaN/Infinity', async () => {
      const careerId = 'c_integrity_sprint'
      const seasonId = 's_2026'
      const round = 2
      const participants = createCanonical24Participants()

      const sq1 = await raceQualifyingOrchestratorService.executeSQ1({
        careerId,
        seasonId,
        round,
        participants,
        trackRecordMs: 80000,
        forceBypassPracticeCheck: true,
      })
      expect(sq1.results).toHaveLength(24)

      const sq2 = await raceQualifyingOrchestratorService.executeSQ2({
        careerId,
        seasonId,
        round,
        forceBypassPracticeCheck: true,
      })
      expect(sq2.results).toHaveLength(18)

      const sq3 = await raceQualifyingOrchestratorService.executeSQ3({
        careerId,
        seasonId,
        round,
        forceBypassPracticeCheck: true,
      })
      expect(sq3.results).toHaveLength(10)

      const sprintGrid = await raceQualifyingOrchestratorService.buildSprintStartingGrid({
        careerId,
        seasonId,
        round,
      })
      expect(sprintGrid).toBeDefined()
      expect(sprintGrid!.entries).toHaveLength(24)

      const driverIds = new Set<string>()
      const positions = new Set<number>()

      sprintGrid!.entries.forEach((e) => {
        expect(driverIds.has(e.driverId)).toBe(false)
        driverIds.add(e.driverId)

        expect(positions.has(e.gridPosition)).toBe(false)
        positions.add(e.gridPosition)

        expect(Number.isFinite(e.gridPosition)).toBe(true)
        expect(Number.isFinite(e.qualifyingPosition)).toBe(true)
        expect(Number.isNaN(e.gridPosition)).toBe(false)
        expect(Number.isNaN(e.qualifyingPosition)).toBe(false)
      })

      expect(driverIds.size).toBe(24)
      expect(positions.size).toBe(24)
      for (let p = 1; p <= 24; p++) {
        expect(positions.has(p)).toBe(true)
      }
    })
  })
})
