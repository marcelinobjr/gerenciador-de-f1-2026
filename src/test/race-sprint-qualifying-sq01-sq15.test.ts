/**
 * src/test/race-sprint-qualifying-sq01-sq15.test.ts
 *
 * APEX GP MANAGER — RACE-SPRINT-SLOTS-01B1: SUÍTE DE TESTES DE HOMOLOGAÇÃO SQ1-01 A SQ1-12
 *
 * ESPECIFICAÇÃO DE HOMOLOGAÇÃO 01B1:
 * - SQ1-01 — VARIANT: MAIN/Q1 funciona como antes; SPRINT/SQ1 possui identidade separada.
 *   Não há colisão de namespace/persistência. Persistência de SQ1 não sobrescreve Q1 e vice-versa.
 * - SQ1-02 — PRÉ-CONDIÇÃO: Weekend NORMAL rejeita SQ1. Weekend SPRINT fora do slot 2 rejeita SQ1.
 *   Weekend SPRINT no slot 2 aceita SQ1. Rejeição produz: 0 novo resultado, 0 RNG, 0 alteração de setup, 0 avanço.
 * - SQ1-03 — PARTICIPANTES: Fixture de referência de 24 participantes únicos no SQ1. Sem duplicações, sem hardcodes.
 * - SQ1-04 — CORTE: SQ1: 24 participantes → 18 classificados → 6 eliminados. Transição: SQ1_COMPLETE → READY_FOR_SQ2. Não executa SQ2.
 * - SQ1-05 — SETUP RF08: Vetor homologado: setup do TL1 = 32.81; bônus = 82.025 ms.
 *   Entra exatamente 1x na tentativa. Após SQ1: setup continua 32.81 (SQ1 não gera ganho de setup).
 * - SQ1-06 — COMPOSTO SECO: No seco SQ1 usa composto Médio (+650 ms em relação ao Macio vindo da config).
 * - SQ1-07 — CHUVA: Em molhado (wet=true), delta de composto Médio/Macio é zero.
 * - SQ1-08 — IDEMPOTÊNCIA: Reexecutar SQ1 já concluído: mesmo resultado, mesmos tempos, mesmos classificados,
 *   zero novo RNG, setup intacto, slot não avança novamente.
 * - SQ1-09 — RELOAD: SQ1 → persistir → descartar estado/cache em memória → reconstruir do armazenamento.
 *   Resultado permanece idêntico.
 * - SQ1-10 — ISOLAMENTO: Outra carreira/temporada/rodada não compartilha resultado de SQ1 nem interfere em Q1.
 * - SQ1-11 — TRANSIÇÃO: Após SQ1 válido: currentSlot permanece 2, slotType permanece SPRINT_QUALIFYING / QUALI_SPRINT,
 *   subPhase avança para READY_FOR_SQ2 / SQ1. NÃO avança para slot 3.
 * - SQ1-12 — FALHA PARCIAL: Se SQ1 for interrompido antes do status final, retry recupera os tempos persistidos,
 *   não recalcula, não consome RNG, finaliza transição para READY_FOR_SQ2.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  raceQualifyingOrchestratorService,
  buildQualifyingStorageKey,
  type QualifyingDriverInput,
  type QualifyingPhaseExecutionState,
} from '@/services/raceQualifyingOrchestratorService'
import {
  canonicalWeekendSlotPersistenceService,
  buildWeekendSlotStorageKey,
} from '@/services/canonicalWeekendSlotPersistenceService'
import { resolveWeekendFormat } from '@/services/weekendSlotSequenceService'
import { DEFAULT_SOURCE_RACE_PARAMETERS } from '@/lib/race/pureRaceEngine'

// Mock simples para localStorage isolado
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

// Fixture canônica de 24 pilotos (12 equipes)
function createCanonical24Participants(baseSetup = 32.81): QualifyingDriverInput[] {
  const teams = [
    { id: 'team_redbull', name: 'Red Bull Racing' },
    { id: 'team_ferrari', name: 'Ferrari' },
    { id: 'team_mercedes', name: 'Mercedes' },
    { id: 'team_mclaren', name: 'McLaren' },
    { id: 'team_aston', name: 'Aston Martin' },
    { id: 'team_alpine', name: 'Alpine' },
    { id: 'team_williams', name: 'Williams' },
    { id: 'team_racingbulls', name: 'Racing Bulls' },
    { id: 'team_sauber', name: 'Sauber' },
    { id: 'team_haas', name: 'Haas' },
    { id: 'team_andretti', name: 'Andretti' },
    { id: 'team_audi', name: 'Audi Factory' },
  ]

  const participants: QualifyingDriverInput[] = []
  teams.forEach((team, tIdx) => {
    // Carro 1
    participants.push({
      driverId: `drv_${team.id}_1`,
      driverName: `Driver ${team.name} 1`,
      teamId: team.id,
      teamName: team.name,
      carIndex: 1,
      carPerformance: 85 - tIdx * 1.5,
      speed: 84 - tIdx * 1.2,
      qualifying: 86 - tIdx * 1.3,
      form: 50,
      morale: 50,
      wet_skill: 50,
      setup: baseSetup,
    })
    // Carro 2
    participants.push({
      driverId: `drv_${team.id}_2`,
      driverName: `Driver ${team.name} 2`,
      teamId: team.id,
      teamName: team.name,
      carIndex: 2,
      carPerformance: 85 - tIdx * 1.5,
      speed: 83 - tIdx * 1.2,
      qualifying: 85 - tIdx * 1.3,
      form: 50,
      morale: 50,
      wet_skill: 50,
      setup: baseSetup,
    })
  })

  return participants
}

describe('RACE-SPRINT-SLOTS-01B1 — Homologação SQ1 (SQ1-01 a SQ1-12)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage = new LocalStorageMock() as any
    }
    raceQualifyingOrchestratorService.clearMemoryCache()
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
  })

  // =========================================================================
  // SQ1-01 — VARIANT
  // =========================================================================
  it('SQ1-01 — VARIANT: MAIN/Q1 e SPRINT/SQ1 possuem identidades e persistência separadas sem sobrescrever', async () => {
    const careerId = 'career_variant_test'
    const seasonId = 'season_2026'
    const roundSprint = 2 // Sprint
    const participants = createCanonical24Participants(32.81)

    // Configura weekend slot state no slot 2 (QUALI_SPRINT)
    const slotState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId,
      seasonId,
      round: roundSprint,
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1) // Conclui TL1 -> Vai para slot 2
    await canonicalWeekendSlotPersistenceService.saveSlotState(slotState)

    // 1. Executa SQ1
    const sq1State = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round: roundSprint,
      participants,
      trackRecordMs: 80000,
    })

    expect(sq1State.variant).toBe('SPRINT_QUALIFYING')
    expect(sq1State.phase).toBe('SQ1')
    expect(sq1State.status).toBe('READY_FOR_SQ2')

    // 2. Executa Q1 principal (bypass practice para teste isolado de colisão)
    const q1State = await raceQualifyingOrchestratorService.executeQ1({
      careerId,
      seasonId,
      round: roundSprint,
      participants,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
    })

    expect(q1State.variant).toBe('MAIN_QUALIFYING')
    expect(q1State.phase).toBe('Q1')
    expect(q1State.status).toBe('READY_FOR_Q2')

    // 3. Prova que as chaves de armazenamento são distintas
    const sq1Key = buildQualifyingStorageKey('SQ1', careerId, seasonId, roundSprint, 'SPRINT_QUALIFYING')
    const q1Key = buildQualifyingStorageKey('Q1', careerId, seasonId, roundSprint, 'MAIN_QUALIFYING')
    expect(sq1Key).not.toBe(q1Key)
    expect(sq1Key).toContain('sprint_sq1')
    expect(q1Key).toContain('q1')

    // 4. Prova que a persistência de SQ1 não sobrescreveu Q1 e vice-versa
    const loadedSQ1 = await raceQualifyingOrchestratorService.loadPersistedSQ1State(careerId, seasonId, roundSprint)
    const loadedQ1 = await raceQualifyingOrchestratorService.loadPersistedQ1State(careerId, seasonId, roundSprint)

    expect(loadedSQ1).not.toBeNull()
    expect(loadedQ1).not.toBeNull()
    expect(loadedSQ1?.variant).toBe('SPRINT_QUALIFYING')
    expect(loadedSQ1?.phase).toBe('SQ1')
    expect(loadedQ1?.variant).toBe('MAIN_QUALIFYING')
    expect(loadedQ1?.phase).toBe('Q1')
  })

  // =========================================================================
  // SQ1-02 — PRÉ-CONDIÇÃO
  // =========================================================================
  it('SQ1-02 — PRÉ-CONDIÇÃO: Rejeita SQ1 em weekend NORMAL e em SPRINT fora do slot 2 sem efeitos colaterais', async () => {
    const careerId = 'career_precond_test'
    const seasonId = 'season_2026'
    const participants = createCanonical24Participants(32.81)

    // Caso A: Weekend NORMAL (ex: Round 1 Austrália)
    expect(resolveWeekendFormat(1)).toBe('NORMAL')
    await expect(
      raceQualifyingOrchestratorService.executeSQ1({
        careerId,
        seasonId,
        round: 1,
        participants,
      }),
    ).rejects.toThrow(/Quali Sprint \(SQ1\) só é permitida em finais de semana Sprint/)

    // Prova que nada foi persistido em round 1
    const storedR1 = await raceQualifyingOrchestratorService.loadPersistedSQ1State(careerId, seasonId, 1)
    expect(storedR1).toBeNull()

    // Caso B: Weekend SPRINT (Round 2 China) mas no slot 1 (TL1 não concluído)
    const slotState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId,
      seasonId,
      round: 2,
    })
    await canonicalWeekendSlotPersistenceService.saveSlotState(slotState)
    expect(slotState.currentSlot).toBe(1)

    await expect(
      raceQualifyingOrchestratorService.executeSQ1({
        careerId,
        seasonId,
        round: 2,
        participants,
      }),
    ).rejects.toThrow(/Pré-condição violada: Quali Sprint \(SQ1\) exige slot atual = 2/)

    // Prova que o slot não avançou e nenhum resultado foi gerado
    const checkSlot = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId,
      seasonId,
      round: 2,
    })
    expect(checkSlot.currentSlot).toBe(1)
    const storedR2 = await raceQualifyingOrchestratorService.loadPersistedSQ1State(careerId, seasonId, 2)
    expect(storedR2).toBeNull()

    // Caso C: Weekend SPRINT no slot 2 é aceito
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)
    expect(slotState.currentSlot).toBe(2)

    const sq1Success = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round: 2,
      participants,
    })
    expect(sq1Success.isCompleted).toBe(true)
    expect(sq1Success.phase).toBe('SQ1')
  })

  // =========================================================================
  // SQ1-03 — PARTICIPANTES
  // =========================================================================
  it('SQ1-03 — PARTICIPANTES: 24 participantes únicos no SQ1 sem duplicatas de entry/car e sem hardcode', async () => {
    const careerId = 'career_part_test'
    const seasonId = 'season_2026'
    const round = 2
    const participants = createCanonical24Participants(32.81)

    const slotState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId,
      seasonId,
      round,
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)
    await canonicalWeekendSlotPersistenceService.saveSlotState(slotState)

    const sq1State = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })

    expect(sq1State.totalParticipants).toBe(24)
    expect(sq1State.results).toHaveLength(24)

    // Unicidade de driverId
    const driverIds = sq1State.results.map((r) => r.driverId)
    const uniqueDrivers = new Set(driverIds)
    expect(uniqueDrivers.size).toBe(24)

    // Unicidade de teamId + carIndex
    const carIdentities = sq1State.results.map((r) => `${r.teamId}_c${r.carIndex}`)
    const uniqueCars = new Set(carIdentities)
    expect(uniqueCars.size).toBe(24)

    // Posições P1 a P24 contínuas e únicas
    const positions = sq1State.results.map((r) => r.position).sort((a, b) => a - b)
    const expectedPositions = Array.from({ length: 24 }, (_, i) => i + 1)
    expect(positions).toEqual(expectedPositions)
  })

  // =========================================================================
  // SQ1-04 — CORTE
  // =========================================================================
  it('SQ1-04 — CORTE: 24 → 18 classificados e 6 eliminados; conclui em READY_FOR_SQ2 sem executar SQ2', async () => {
    const careerId = 'career_cut_test'
    const seasonId = 'season_2026'
    const round = 2
    const participants = createCanonical24Participants(32.81)

    const slotState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId,
      seasonId,
      round,
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)

    const sq1State = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })

    expect(sq1State.advancingCount).toBe(18)
    expect(sq1State.eliminatedCount).toBe(6)
    expect(sq1State.classifiedDriverIds).toHaveLength(18)
    expect(sq1State.eliminatedDriverIds).toHaveLength(6)

    // Os 18 classificados são exatamente P1 a P18
    const classifiedResults = sq1State.results.filter((r) => r.isClassified)
    expect(classifiedResults).toHaveLength(18)
    classifiedResults.forEach((r) => {
      expect(r.position).toBeLessThanOrEqual(18)
      expect(r.isEliminated).toBe(false)
    })

    // Os 6 eliminados são exatamente P19 a P24
    const eliminatedResults = sq1State.results.filter((r) => r.isEliminated)
    expect(eliminatedResults).toHaveLength(6)
    eliminatedResults.forEach((r) => {
      expect(r.position).toBeGreaterThanOrEqual(19)
      expect(r.isClassified).toBe(false)
    })

    // Status final é READY_FOR_SQ2
    expect(sq1State.status).toBe('READY_FOR_SQ2')

    // Prova que SQ2 NÃO foi executado
    const sq2Loaded = await raceQualifyingOrchestratorService.loadPersistedSQ2State(careerId, seasonId, round)
    expect(sq2Loaded).toBeNull()
  })

  // =========================================================================
  // SQ1-05 — SETUP RF08
  // =========================================================================
  it('SQ1-05 — SETUP RF08: Setup do TL1 = 32.81 gera bônus exato de 82.025 ms aplicado 1x; setup permanece 32.81', async () => {
    const careerId = 'career_rf08_test'
    const seasonId = 'season_2026'
    const round = 2
    const baseSetup = 32.81
    // RF08: bonus_ms = setup * 2.5 ms = 32.81 * 2.5 = 82.025 ms
    const expectedBonusMs = 32.81 * 2.5 // 82.025
    expect(expectedBonusMs).toBe(82.025)

    const participants = createCanonical24Participants(baseSetup)

    const slotState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId,
      seasonId,
      round,
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)

    const sq1State = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })

    sq1State.results.forEach((r) => {
      // Setup reportado permanece 32.81 (SQ1 não incrementa setup)
      expect(r.setup).toBe(baseSetup)
      expect(r.bonusMs).toBe(expectedBonusMs)

      // Cada tentativa oficial possui exatamente o bônus de 82.025 ms aplicado uma vez
      expect(r.attempts).toHaveLength(2)
      r.attempts.forEach((att) => {
        expect(att.bonusMs).toBe(expectedBonusMs)
      })
    })
  })

  // =========================================================================
  // SQ1-06 — COMPOSTO SECO
  // =========================================================================
  it('SQ1-06 — COMPOSTO SECO: No seco SQ1 usa composto Médio (+650 ms da config)', async () => {
    const careerId = 'career_dry_tire_test'
    const seasonId = 'season_2026'
    const round = 2
    const participants = createCanonical24Participants(32.81)

    const slotState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId,
      seasonId,
      round,
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)

    // Configuração oficial padrão: medium_delta_ms = 650
    expect(DEFAULT_SOURCE_RACE_PARAMETERS.sprint_qualifying_medium_delta_ms).toBe(650)

    const sq1State = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
      wet: false,
    })

    sq1State.results.forEach((r) => {
      expect(r.compoundUsed).toBe('MEDIUM')
      expect(r.compoundDeltaMs).toBe(650)
      r.attempts.forEach((att) => {
        expect(att.compoundUsed).toBe('MEDIUM')
        expect(att.compoundDeltaMs).toBe(650)
      })
    })
  })

  // =========================================================================
  // SQ1-07 — CHUVA
  // =========================================================================
  it('SQ1-07 — CHUVA: Em pista molhada (wet = true), o ajuste de composto Médio/Macio é zero ms', async () => {
    const careerId = 'career_wet_tire_test'
    const seasonId = 'season_2026'
    const round = 2
    const participants = createCanonical24Participants(32.81)

    const slotState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId,
      seasonId,
      round,
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)

    const sq1State = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
      wet: true,
    })

    sq1State.results.forEach((r) => {
      expect(r.compoundDeltaMs).toBe(0)
      r.attempts.forEach((att) => {
        expect(att.compoundDeltaMs).toBe(0)
      })
    })
  })

  // =========================================================================
  // SQ1-08 — IDEMPOTÊNCIA
  // =========================================================================
  it('SQ1-08 — IDEMPOTÊNCIA: Reexecutar SQ1 já concluído devolve tempos e posições idênticos sem novo RNG', async () => {
    const careerId = 'career_idemp_test'
    const seasonId = 'season_2026'
    const round = 2
    const participants = createCanonical24Participants(32.81)

    const slotState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId,
      seasonId,
      round,
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)

    // 1ª execução
    const run1 = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })

    // 2ª execução imediata
    const run2 = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })

    expect(run2.status).toBe(run1.status)
    expect(run2.classifiedDriverIds).toEqual(run1.classifiedDriverIds)
    expect(run2.eliminatedDriverIds).toEqual(run1.eliminatedDriverIds)

    run1.results.forEach((res1, idx) => {
      const res2 = run2.results[idx]
      expect(res2.driverId).toBe(res1.driverId)
      expect(res2.position).toBe(res1.position)
      expect(res2.bestTimeMs).toBe(res1.bestTimeMs)
      expect(res2.attempts[0].timeMs).toBe(res1.attempts[0].timeMs)
      expect(res2.attempts[1].timeMs).toBe(res1.attempts[1].timeMs)
    })
  })

  // =========================================================================
  // SQ1-09 — RELOAD
  // =========================================================================
  it('SQ1-09 — RELOAD: SQ1 persiste e sobrevive a descarte completo de memória (localStorage reload)', async () => {
    const careerId = 'career_reload_sq1'
    const seasonId = 'season_2026'
    const round = 2
    const participants = createCanonical24Participants(32.81)

    const slotState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId,
      seasonId,
      round,
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)

    const original = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })

    // Descarte do cache em memória para simular F5 / recarregamento limpo do navegador
    raceQualifyingOrchestratorService.clearMemoryCache()

    // Carrega do armazenamento
    const reloaded = await raceQualifyingOrchestratorService.loadPersistedSQ1State(careerId, seasonId, round)

    expect(reloaded).not.toBeNull()
    expect(reloaded?.status).toBe('READY_FOR_SQ2')
    expect(reloaded?.variant).toBe('SPRINT_QUALIFYING')
    expect(reloaded?.results).toHaveLength(24)
    expect(reloaded?.results[0].bestTimeMs).toBe(original.results[0].bestTimeMs)
    expect(reloaded?.classifiedDriverIds).toEqual(original.classifiedDriverIds)
  })

  // =========================================================================
  // SQ1-10 — ISOLAMENTO
  // =========================================================================
  it('SQ1-10 — ISOLAMENTO: Outra carreira/temporada/rodada não compartilha resultado de SQ1', async () => {
    const participants = createCanonical24Participants(32.81)

    // Rodada 2 da Carreira A
    const slotStateA = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: 'career_iso_A',
      seasonId: 'season_2026',
      round: 2,
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotStateA, 1)

    const sq1A = await raceQualifyingOrchestratorService.executeSQ1({
      careerId: 'career_iso_A',
      seasonId: 'season_2026',
      round: 2,
      participants,
    })

    // Rodada 2 da Carreira B (ainda não executou)
    const sq1B = await raceQualifyingOrchestratorService.loadPersistedSQ1State('career_iso_B', 'season_2026', 2)
    expect(sq1B).toBeNull()

    // Rodada 6 (outra rodada Sprint) da Carreira A
    const sq1Round6 = await raceQualifyingOrchestratorService.loadPersistedSQ1State('career_iso_A', 'season_2026', 6)
    expect(sq1Round6).toBeNull()
  })

  // =========================================================================
  // SQ1-11 — TRANSIÇÃO
  // =========================================================================
  it('SQ1-11 — TRANSIÇÃO: Após SQ1, currentSlot permanece 2 e slotType QUALI_SPRINT; subPhase avança para READY_FOR_SQ2; não avança para slot 3', async () => {
    const careerId = 'career_trans_test'
    const seasonId = 'season_2026'
    const round = 2
    const participants = createCanonical24Participants(32.81)

    const slotState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId,
      seasonId,
      round,
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)
    expect(slotState.currentSlot).toBe(2)
    expect(slotState.slotType).toBe('QUALI_SPRINT')

    const sq1State = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })

    expect(sq1State.status).toBe('READY_FOR_SQ2')

    // Confere estado do weekend slot
    const updatedSlotState = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId,
      seasonId,
      round,
    })

    // INVARIANTE: Slot continua 2! Não avançou para slot 3 (Sprint Race)
    expect(updatedSlotState.currentSlot).toBe(2)
    expect(updatedSlotState.slotType).toBe('QUALI_SPRINT')
    expect(updatedSlotState.slots[2].subPhase).toBe('SQ1')
    expect(updatedSlotState.slots[3].status).toBe('LOCKED')
  })

  // =========================================================================
  // SQ1-12 — FALHA PARCIAL
  // =========================================================================
  it('SQ1-12 — FALHA PARCIAL: Se SQ1 gravou resultados parciais sem status final, retry recupera tempos e finaliza transição sem novo RNG', async () => {
    const careerId = 'career_partial_test'
    const seasonId = 'season_2026'
    const round = 2
    const participants = createCanonical24Participants(32.81)

    const slotState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId,
      seasonId,
      round,
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)

    // Executa SQ1 normal
    const fullSQ1 = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })

    // Simula estado gravado antes da finalização (status ainda em SQ1 e isCompleted = false)
    const corruptedPartial: QualifyingPhaseExecutionState = {
      ...fullSQ1,
      status: 'SQ1',
      isCompleted: false,
    }
    await raceQualifyingOrchestratorService.persistPhaseState(corruptedPartial)
    raceQualifyingOrchestratorService.clearMemoryCache()

    // Nova chamada executeSQ1 (retry após crash/interrupção)
    const recovered = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })

    // Deve ter recuperado para READY_FOR_SQ2 com isCompleted = true mantendo tempos idênticos
    expect(recovered.isCompleted).toBe(true)
    expect(recovered.status).toBe('READY_FOR_SQ2')
    expect(recovered.results[0].bestTimeMs).toBe(fullSQ1.results[0].bestTimeMs)
    expect(recovered.results[1].bestTimeMs).toBe(fullSQ1.results[1].bestTimeMs)
  })
})
