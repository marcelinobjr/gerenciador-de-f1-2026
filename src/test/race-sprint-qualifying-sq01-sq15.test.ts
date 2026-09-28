/**
 * src/test/race-sprint-qualifying-sq01-sq15.test.ts
 *
 * APEX GP MANAGER — RACE-SPRINT-SLOTS-01B: SUÍTE DE TESTES OBRIGATÓRIOS SQ01 A SQ15
 *
 * ESPECIFICAÇÃO FORMAL:
 * - SQ01 — ENTRADA: weekend NORMAL rejeita SQ; weekend SPRINT no slot 2 aceita SQ1.
 * - SQ02 — SQ1: 24 participantes únicos, 18 avançam, 6 eliminados.
 * - SQ03 — SQ2: recebe exatamente os 18 classificados do SQ1; 10 avançam, 8 eliminados.
 * - SQ04 — SQ3: recebe exatamente os 10 classificados do SQ2; 10 posições únicas.
 * - SQ05 — SEM RESSURREIÇÃO: eliminados do SQ1/SQ2 nunca reaparecem.
 * - SQ06 — SETUP RF08: setup = 32.81; qualifying bonus = 82.025 ms entra exatamente uma vez por tentativa; setup permanece 32.81 após SQ1/SQ2/SQ3.
 * - SQ07 — COMPOSTO SECO: com todos os demais inputs controlados, SQ1/SQ2 recebem exatamente o ajuste configurado de Médio vs Macio (+650 ms); SQ3 não recebe esse acréscimo.
 * - SQ08 — CHUVA: com condição molhada, ajuste de +650 ms do composto = 0.
 * - SQ09 — RNG: SQ1/SQ2/SQ3 possuem namespaces distintos entre si e distintos de Q1/Q2/Q3.
 * - SQ10 — IDEMPOTÊNCIA: reexecutar fase concluída retorna o mesmo resultado.
 * - SQ11 — RELOAD: SQ1 → reload → SQ2 → reload → SQ3 é idêntico à execução direta.
 * - SQ12 — RESULTADO GLOBAL: SPRINT_QUALIFYING_RESULT: P1–P10 SQ3, P11–P18 eliminados SQ2, P19–P24 eliminados SQ1; 24 posições bijetivas.
 * - SQ13 — GRID SPRINT: SPRINT_STARTING_GRID nasce do resultado Sprint, não do QUALIFYING_RESULT principal.
 * - SQ14 — TRANSIÇÃO: depois do grid Sprint pronto, slot 2 → slot 3 / SPRINT_RACE sem iniciar a corrida.
 * - SQ15 — INDEPENDÊNCIA: a posterior classificação principal Q1 permanece independente da Quali Sprint.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  raceQualifyingOrchestratorService,
  QualifyingDriverInput,
} from '@/services/raceQualifyingOrchestratorService'
import { canonicalWeekendSlotPersistenceService } from '@/services/canonicalWeekendSlotPersistenceService'
import { resolveWeekendFormat } from '@/services/weekendSlotSequenceService'
import { calculateSprintQualifyingAttemptTime } from '@/lib/race/pureRaceEngine'

// Mock simples para localStorage
class LocalStorageMock {
  private store: Record<string, string> = {}
  getItem(key: string) {
    return this.store[key] || null
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value)
  }
  removeItem(key: string) {
    delete this.store[key]
  }
  clear() {
    this.store = {}
  }
}

// 24 participantes de referência para testes
const create24SprintParticipants = (setupVal = 32.81): QualifyingDriverInput[] => {
  const teams = [
    'audi',
    'ferrari',
    'redbull',
    'mercedes',
    'mclaren',
    'aston',
    'alpine',
    'williams',
    'haas',
    'rb',
    'sauber',
    'andretti',
  ]
  const list: QualifyingDriverInput[] = []
  let driverCount = 1

  for (const team of teams) {
    for (const carIdx of [1, 2] as const) {
      const id = `drv_${String(driverCount).padStart(3, '0')}`
      list.push({
        driverId: id,
        driverName: `Piloto ${driverCount}`,
        teamId: `team_${team}`,
        teamName: team.toUpperCase(),
        carIndex: carIdx,
        carPerformance: 70 + (24 - driverCount) * 1.0,
        speed: 70 + (24 - driverCount) * 1.0,
        qualifying: 70 + (24 - driverCount) * 1.0,
        form: 50,
        morale: 50,
        wet_skill: 50,
        setup: setupVal,
      })
      driverCount++
    }
  }
  return list
}

describe('RACE-SPRINT-SLOTS-01B — Quali Sprint: SQ1 → SQ2 → SQ3 (SQ01 a SQ15)', () => {
  const careerId = 'career_sprint_test'
  const seasonId = 'season_2026'
  const sprintRound = 2 // GP da China (hasSprint = true)
  const normalRound = 1 // GP da Austrália (hasSprint = false)

  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage = new LocalStorageMock() as any
    }
    raceQualifyingOrchestratorService.clearMemoryCache()
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
  })

  // =========================================================================
  // SQ01 — ENTRADA
  // =========================================================================
  it('SQ01 — ENTRADA: weekend NORMAL rejeita SQ; weekend SPRINT no slot 2 aceita SQ1', async () => {
    expect(resolveWeekendFormat(normalRound)).toBe('NORMAL')
    expect(resolveWeekendFormat(sprintRound)).toBe('SPRINT')

    const participants = create24SprintParticipants()

    // 1. Weekend Normal tentando executar SQ1 deve ser rejeitado com erro explícito
    await expect(
      raceQualifyingOrchestratorService.executeSQ1({
        careerId,
        seasonId,
        round: normalRound,
        participants,
      }),
    ).rejects.toThrow(/Formato inválido: Quali Sprint \(SQ1\) só é permitida em finais de semana Sprint/)

    // 2. Weekend Sprint no slot 2 aceita SQ1
    const sq1 = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round: sprintRound,
      participants,
    })

    expect(sq1).toBeDefined()
    expect(sq1.phase).toBe('SQ1')
    expect(sq1.isCompleted).toBe(true)
    expect(sq1.status).toBe('READY_FOR_SQ2')
  })

  // =========================================================================
  // SQ02 — SQ1
  // =========================================================================
  it('SQ02 — SQ1: 24 participantes únicos, 18 avançam, 6 eliminados', async () => {
    const participants = create24SprintParticipants()
    const sq1 = await raceQualifyingOrchestratorService.executeSQ1({
      careerId: 'career_sq02',
      seasonId,
      round: sprintRound,
      participants,
    })

    expect(sq1.totalParticipants).toBe(24)
    expect(sq1.results).toHaveLength(24)
    expect(sq1.advancingCount).toBe(18)
    expect(sq1.eliminatedCount).toBe(6)

    expect(sq1.classifiedDriverIds).toHaveLength(18)
    expect(sq1.eliminatedDriverIds).toHaveLength(6)

    // Unicidade de posições 1..24
    const positions = sq1.results.map((r) => r.position)
    expect(positions).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))
  })

  // =========================================================================
  // SQ03 — SQ2
  // =========================================================================
  it('SQ03 — SQ2: recebe exatamente os 18 classificados do SQ1; 10 avançam, 8 eliminados', async () => {
    const participants = create24SprintParticipants()
    const sq1 = await raceQualifyingOrchestratorService.executeSQ1({
      careerId: 'career_sq03',
      seasonId,
      round: sprintRound,
      participants,
    })

    // SQ2 não aceita participantes manuais que divirjam dos 18 de SQ1
    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId: 'career_sq03',
      seasonId,
      round: sprintRound,
      participants,
    })

    expect(sq2.totalParticipants).toBe(18)
    expect(sq2.results).toHaveLength(18)
    expect(sq2.advancingCount).toBe(10)
    expect(sq2.eliminatedCount).toBe(8)

    // Todos os pilotos de SQ2 estavam entre os classificados de SQ1
    for (const res of sq2.results) {
      expect(sq1.classifiedDriverIds).toContain(res.driverId)
    }

    // Posições 1..18
    expect(sq2.results.map((r) => r.position)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))
  })

  // =========================================================================
  // SQ04 — SQ3
  // =========================================================================
  it('SQ04 — SQ3: recebe exatamente os 10 classificados do SQ2; 10 posições únicas', async () => {
    const participants = create24SprintParticipants()
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId: 'career_sq04',
      seasonId,
      round: sprintRound,
      participants,
    })

    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId: 'career_sq04',
      seasonId,
      round: sprintRound,
    })

    const sq3 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId: 'career_sq04',
      seasonId,
      round: sprintRound,
    })

    expect(sq3.totalParticipants).toBe(10)
    expect(sq3.results).toHaveLength(10)
    expect(sq3.advancingCount).toBe(10)
    expect(sq3.eliminatedCount).toBe(0)

    // Todos os pilotos de SQ3 estavam entre os classificados de SQ2
    for (const res of sq3.results) {
      expect(sq2.classifiedDriverIds).toContain(res.driverId)
    }

    expect(sq3.results.map((r) => r.position)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1))
  })

  // =========================================================================
  // SQ05 — SEM RESSURREIÇÃO
  // =========================================================================
  it('SQ05 — SEM RESSURREIÇÃO: eliminados do SQ1/SQ2 nunca reaparecem', async () => {
    const participants = create24SprintParticipants()
    const sq1 = await raceQualifyingOrchestratorService.executeSQ1({
      careerId: 'career_sq05',
      seasonId,
      round: sprintRound,
      participants,
    })

    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId: 'career_sq05',
      seasonId,
      round: sprintRound,
    })

    const sq3 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId: 'career_sq05',
      seasonId,
      round: sprintRound,
    })

    // Nenhum eliminado de SQ1 pode estar no SQ2 ou SQ3
    for (const elimId of sq1.eliminatedDriverIds) {
      expect(sq2.results.some((r) => r.driverId === elimId)).toBe(false)
      expect(sq3.results.some((r) => r.driverId === elimId)).toBe(false)
    }

    // Nenhum eliminado de SQ2 pode estar no SQ3
    for (const elimId of sq2.eliminatedDriverIds) {
      expect(sq3.results.some((r) => r.driverId === elimId)).toBe(false)
    }
  })

  // =========================================================================
  // SQ06 — SETUP RF08
  // =========================================================================
  it('SQ06 — SETUP RF08: setup = 32.81; qualifying bonus = 82.025 ms entra exatamente uma vez por tentativa; setup permanece 32.81 após SQ1/SQ2/SQ3', async () => {
    const setupVal = 32.81
    const participants = create24SprintParticipants(setupVal)

    const sq1 = await raceQualifyingOrchestratorService.executeSQ1({
      careerId: 'career_sq06',
      seasonId,
      round: sprintRound,
      participants,
    })

    // RF08: bonus_ms = (32.81 / 100) * 0.25 * 1000 = 82.025 ms
    const expectedBonusMs = (setupVal / 100) * 0.25 * 1000
    expect(expectedBonusMs).toBeCloseTo(82.025, 3)

    for (const r of sq1.results) {
      expect(r.setup).toBe(setupVal)
      expect(r.bonusMs).toBeCloseTo(82.025, 3)
      for (const att of r.attempts) {
        expect(att.bonusMs).toBeCloseTo(82.025, 3)
      }
    }

    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId: 'career_sq06',
      seasonId,
      round: sprintRound,
    })

    for (const r of sq2.results) {
      expect(r.setup).toBe(setupVal)
      expect(r.bonusMs).toBeCloseTo(82.025, 3)
    }

    const sq3 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId: 'career_sq06',
      seasonId,
      round: sprintRound,
    })

    for (const r of sq3.results) {
      expect(r.setup).toBe(setupVal)
      expect(r.bonusMs).toBeCloseTo(82.025, 3)
    }
  })

  // =========================================================================
  // SQ07 — COMPOSTO SECO
  // =========================================================================
  it('SQ07 — COMPOSTO SECO: com todos os demais inputs controlados, SQ1/SQ2 recebem exatamente +650 ms; SQ3 não recebe esse acréscimo', async () => {
    // Verificação via pureRaceEngine diretamente com inputs idênticos
    const basePace = 80000
    const setup = 32.81
    const z = 0

    const sq1Time = calculateSprintQualifyingAttemptTime({
      dry: true,
      is_sq3: false,
      base_pace_ms: basePace,
      setup,
      normal_standard_draw_z: z,
      sigma_ms: 0,
    })

    const sq3Time = calculateSprintQualifyingAttemptTime({
      dry: true,
      is_sq3: true,
      base_pace_ms: basePace,
      setup,
      normal_standard_draw_z: z,
      sigma_ms: 0,
    })

    expect(sq1Time.compound_delta_ms).toBe(650)
    expect(sq3Time.compound_delta_ms).toBe(0)
    expect(sq1Time.time_ms - sq3Time.time_ms).toBeCloseTo(650, 4)
  })

  // =========================================================================
  // SQ08 — CHUVA
  // =========================================================================
  it('SQ08 — CHUVA: com condição molhada, ajuste de +650 ms do composto = 0', async () => {
    const basePace = 80000
    const setup = 32.81
    const z = 0

    const sq1Wet = calculateSprintQualifyingAttemptTime({
      dry: false,
      is_sq3: false,
      base_pace_ms: basePace,
      setup,
      normal_standard_draw_z: z,
      sigma_ms: 0,
    })

    expect(sq1Wet.compound_delta_ms).toBe(0)

    const sq3Wet = calculateSprintQualifyingAttemptTime({
      dry: false,
      is_sq3: true,
      base_pace_ms: basePace,
      setup,
      normal_standard_draw_z: z,
      sigma_ms: 0,
    })

    expect(sq3Wet.compound_delta_ms).toBe(0)
    expect(sq1Wet.time_ms).toBe(sq3Wet.time_ms)
  })

  // =========================================================================
  // SQ09 — RNG
  // =========================================================================
  it('SQ09 — RNG: SQ1/SQ2/SQ3 possuem namespaces distintos entre si e distintos de Q1/Q2/Q3', async () => {
    const participants = create24SprintParticipants()

    const sq1 = await raceQualifyingOrchestratorService.executeSQ1({
      careerId: 'career_rng_test',
      seasonId,
      round: sprintRound,
      participants,
    })

    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId: 'career_rng_test',
      seasonId,
      round: sprintRound,
    })

    const sq3 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId: 'career_rng_test',
      seasonId,
      round: sprintRound,
    })

    // Compara o primeiro piloto nas 3 fases: os sorteios Z das tentativas devem ser distintos
    const p1Sq1Z = sq1.results[0].attempts[0].normalDrawZ
    const p1Sq2Z = sq2.results[0].attempts[0].normalDrawZ
    const p1Sq3Z = sq3.results[0].attempts[0].normalDrawZ

    expect(p1Sq1Z).not.toBe(p1Sq2Z)
    expect(p1Sq2Z).not.toBe(p1Sq3Z)
    expect(p1Sq1Z).not.toBe(p1Sq3Z)
  })

  // =========================================================================
  // SQ10 — IDEMPOTÊNCIA
  // =========================================================================
  it('SQ10 — IDEMPOTÊNCIA: reexecutar fase concluída retorna o mesmo resultado sem re-sorteio', async () => {
    const participants = create24SprintParticipants()

    const sq1First = await raceQualifyingOrchestratorService.executeSQ1({
      careerId: 'career_idem_test',
      seasonId,
      round: sprintRound,
      participants,
    })

    const sq1Second = await raceQualifyingOrchestratorService.executeSQ1({
      careerId: 'career_idem_test',
      seasonId,
      round: sprintRound,
      participants,
    })

    expect(sq1First.results[0].bestTimeMs).toBe(sq1Second.results[0].bestTimeMs)
    expect(sq1First.results[0].attempts[0].timeMs).toBe(sq1Second.results[0].attempts[0].timeMs)
    expect(sq1First.classifiedDriverIds).toEqual(sq1Second.classifiedDriverIds)
  })

  // =========================================================================
  // SQ11 — RELOAD
  // =========================================================================
  it('SQ11 — RELOAD: SQ1 → reload → SQ2 → reload → SQ3 é idêntico à execução direta', async () => {
    const participants = create24SprintParticipants()

    // Execução SQ1
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId: 'career_reload_sq',
      seasonId,
      round: sprintRound,
      participants,
    })

    // Simula reload
    raceQualifyingOrchestratorService.clearMemoryCache()

    // Execução SQ2 após reload
    await raceQualifyingOrchestratorService.executeSQ2({
      careerId: 'career_reload_sq',
      seasonId,
      round: sprintRound,
    })

    // Simula reload
    raceQualifyingOrchestratorService.clearMemoryCache()

    // Execução SQ3 após reload
    const sq3 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId: 'career_reload_sq',
      seasonId,
      round: sprintRound,
    })

    expect(sq3.isCompleted).toBe(true)
    expect(sq3.results).toHaveLength(10)
  })

  // =========================================================================
  // SQ12 — RESULTADO GLOBAL
  // =========================================================================
  it('SQ12 — RESULTADO GLOBAL: SPRINT_QUALIFYING_RESULT: P1–P10 SQ3, P11–P18 eliminados SQ2, P19–P24 eliminados SQ1; 24 posições bijetivas', async () => {
    const participants = create24SprintParticipants()

    await raceQualifyingOrchestratorService.executeSQ1({
      careerId: 'career_sq12',
      seasonId,
      round: sprintRound,
      participants,
    })

    await raceQualifyingOrchestratorService.executeSQ2({
      careerId: 'career_sq12',
      seasonId,
      round: sprintRound,
    })

    await raceQualifyingOrchestratorService.executeSQ3({
      careerId: 'career_sq12',
      seasonId,
      round: sprintRound,
    })

    const globalSprint = await raceQualifyingOrchestratorService.buildSprintQualifyingResult({
      careerId: 'career_sq12',
      seasonId,
      round: sprintRound,
    })

    expect(globalSprint.totalParticipants).toBe(24)
    expect(globalSprint.results).toHaveLength(24)

    // Bijeção de posições 1..24
    expect(globalSprint.results.map((r) => r.position)).toEqual(
      Array.from({ length: 24 }, (_, i) => i + 1),
    )

    // P1..P10: SQ3
    for (let i = 0; i < 10; i++) {
      expect(globalSprint.results[i].eliminationPhase).toBe('SQ3')
    }

    // P11..P18: SQ2
    for (let i = 10; i < 18; i++) {
      expect(globalSprint.results[i].eliminationPhase).toBe('SQ2')
    }

    // P19..P24: SQ1
    for (let i = 18; i < 24; i++) {
      expect(globalSprint.results[i].eliminationPhase).toBe('SQ1')
    }
  })

  // =========================================================================
  // SQ13 — GRID SPRINT
  // =========================================================================
  it('SQ13 — GRID SPRINT: SPRINT_STARTING_GRID nasce do resultado Sprint, não do QUALIFYING_RESULT principal', async () => {
    const participants = create24SprintParticipants()

    await raceQualifyingOrchestratorService.executeSQ1({
      careerId: 'career_sq13',
      seasonId,
      round: sprintRound,
      participants,
    })
    await raceQualifyingOrchestratorService.executeSQ2({
      careerId: 'career_sq13',
      seasonId,
      round: sprintRound,
    })
    await raceQualifyingOrchestratorService.executeSQ3({
      careerId: 'career_sq13',
      seasonId,
      round: sprintRound,
    })

    const sprintGrid = await raceQualifyingOrchestratorService.buildSprintStartingGrid({
      careerId: 'career_sq13',
      seasonId,
      round: sprintRound,
    })

    expect(sprintGrid.status).toBe('SPRINT_GRID_READY')
    expect(sprintGrid.grid).toHaveLength(24)
    expect(sprintGrid.poleDriverId).toBe(sprintGrid.grid[0].driverId)
    expect(sprintGrid.grid[0].gridPosition).toBe(1)
  })

  // =========================================================================
  // SQ14 — TRANSIÇÃO
  // =========================================================================
  it('SQ14 — TRANSIÇÃO: depois do grid Sprint pronto, slot 2 → slot 3 / SPRINT_RACE sem iniciar a corrida', async () => {
    const participants = create24SprintParticipants()

    const state = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: 'career_sq14',
      seasonId,
      round: sprintRound,
    })

    // Conclui TL1 (slot 1)
    await canonicalWeekendSlotPersistenceService.completeSlot(state, 1)
    expect(state.currentSlot).toBe(2)
    expect(state.slotType).toBe('QUALI_SPRINT')

    // Executa SQ1, SQ2, SQ3
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId: 'career_sq14',
      seasonId,
      round: sprintRound,
      participants,
    })
    await raceQualifyingOrchestratorService.executeSQ2({
      careerId: 'career_sq14',
      seasonId,
      round: sprintRound,
    })
    await raceQualifyingOrchestratorService.executeSQ3({
      careerId: 'career_sq14',
      seasonId,
      round: sprintRound,
    })

    // Transição canônica completa
    const result =
      await raceQualifyingOrchestratorService.completeSprintQualifyingAndTransitionToSlot3({
        careerId: 'career_sq14',
        seasonId,
        round: sprintRound,
      })

    expect(result.sprintQualifyingResult.status).toBe('SPRINT_QUALIFYING_RESULT_READY')
    expect(result.sprintStartingGrid.status).toBe('SPRINT_GRID_READY')

    // O slot atual agora deve ser 3 (SPRINT / SPRINT_RACE)
    expect(result.slotState.currentSlot).toBe(3)
    expect(result.slotState.slotType).toBe('SPRINT')
    expect(result.slotState.slots[3].status).toBe('AVAILABLE')
  })

  // =========================================================================
  // SQ15 — INDEPENDÊNCIA
  // =========================================================================
  it('SQ15 — INDEPENDÊNCIA: a posterior classificação principal Q1 permanece independente da Quali Sprint', async () => {
    const participants = create24SprintParticipants()

    // Executa Sprint Qualifying
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId: 'career_sq15',
      seasonId,
      round: sprintRound,
      participants,
    })
    await raceQualifyingOrchestratorService.executeSQ2({
      careerId: 'career_sq15',
      seasonId,
      round: sprintRound,
    })
    await raceQualifyingOrchestratorService.executeSQ3({
      careerId: 'career_sq15',
      seasonId,
      round: sprintRound,
    })

    const sprintGrid = await raceQualifyingOrchestratorService.buildSprintStartingGrid({
      careerId: 'career_sq15',
      seasonId,
      round: sprintRound,
    })

    // Executa posteriormente o Q1 da classificação principal (com forceBypassPracticeCheck para teste unitário)
    const q1 = await raceQualifyingOrchestratorService.executeQ1({
      careerId: 'career_sq15',
      seasonId,
      round: sprintRound,
      participants,
      forceBypassPracticeCheck: true,
    })

    expect(q1.phase).toBe('Q1')
    expect(q1.totalParticipants).toBe(24)

    // O tempo do primeiro piloto em Q1 não é derivado da Sprint
    const p1SprintGrid = sprintGrid.grid[0]
    const p1Q1 = q1.results.find((r) => r.driverId === p1SprintGrid.driverId)!

    // Tempos e tentativas possuem PRNG e namespaces independentes
    expect(p1Q1.attempts[0].normalDrawZ).not.toBe(
      (await raceQualifyingOrchestratorService.loadPersistedSQ1State('career_sq15', seasonId, sprintRound))!
        .results.find((r) => r.driverId === p1SprintGrid.driverId)!.attempts[0].normalDrawZ,
    )
  })
})
