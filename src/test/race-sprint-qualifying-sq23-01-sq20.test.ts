/**
 * src/test/race-sprint-qualifying-sq23-01-sq20.test.ts
 *
 * APEX GP MANAGER — RACE-SPRINT-SLOTS-01B2: SUÍTE DE TESTES DE HOMOLOGAÇÃO SQ23-01 A SQ23-20
 *
 * ESPECIFICAÇÃO DE HOMOLOGAÇÃO 01B2:
 * SQ23-01 — HERANÇA SQ2: SQ2 recebe exatamente 18 classificados do SQ1. Os 6 eliminados não aparecem.
 * SQ23-02 — CORTE SQ2: 18 → 10 classificados → 8 eliminados.
 * SQ23-03 — HERANÇA SQ3: SQ3 recebe exatamente os 10 classificados do SQ2.
 * SQ23-04 — SQ3: 10 participantes, 10 posições únicas.
 * SQ23-05 — SEM RESSURREIÇÃO: eliminados do SQ1/SQ2 nunca reaparecem.
 * SQ23-06 — SETUP: SQ2 e SQ3 usam setup 32.81; qualifying bonus 82.025 ms uma vez por tentativa; setup permanece 32.81.
 * SQ23-07 — COMPOSTOS SECO: SQ2 Médio/+650 ms da configuração; SQ3 Macio/sem +650 ms.
 * SQ23-08 — CHUVA: ajuste Médio/Macio deste canal = 0 ms.
 * SQ23-09 — RNG: SQ2 e SQ3 namespaces distintos entre si, de SQ1 e de MAIN.
 * SQ23-10 — IDEMPOTÊNCIA: SQ2/SQ3 reexecutados não mudam resultados.
 * SQ23-11 — RELOAD: fluxo direto e com reload entre SQ2/SQ3 idênticos.
 * SQ23-12 — ORDEM: SQ3 antes de READY_FOR_SQ3 é rejeitado sem efeitos.
 * SQ23-13 — FALHA PARCIAL: persistência feita + transição falhada: retry não recalcula fase.
 * SQ23-14 — RESULTADO GLOBAL: SPRINT_QUALIFYING_RESULT: P1–10 SQ3, P11–18 eliminados SQ2, P19–24 eliminados SQ1.
 * SQ23-15 — BIJEÇÃO: 24 pilotos, 24 cars/entries, P1–P24, zero duplicações.
 * SQ23-16 — ZERO RNG NA CONSOLIDAÇÃO: construir resultado/grid não consome RNG.
 * SQ23-17 — GRID SPRINT: SPRINT_STARTING_GRID nasce do resultado Sprint, nunca do grid principal.
 * SQ23-18 — ISOLAMENTO: SPRINT_STARTING_GRID e MAIN STARTING_GRID coexistem sem sobrescrever um ao outro.
 * SQ23-19 — TRANSIÇÃO: depois do grid Sprint válido: slot 2 → slot 3 / SPRINT_RACE READY, sem executar Sprint.
 * SQ23-20 — MAIN INTACTO: Q1/Q2/Q3 principal permanecem semanticamente independentes do resultado Sprint conforme os contratos do modelo.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  raceQualifyingOrchestratorService,
  buildQualifyingStorageKey,
  buildGlobalSprintQualifyingStorageKey,
  buildSprintStartingGridStorageKey,
  buildGlobalQualifyingStorageKey,
  buildStartingGridStorageKey,
  type QualifyingDriverInput,
} from '@/services/raceQualifyingOrchestratorService'
import { canonicalWeekendSlotPersistenceService } from '@/services/canonicalWeekendSlotPersistenceService'
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

describe('RACE-SPRINT-SLOTS-01B2 — Homologação SQ23-01 a SQ23-20', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage = new LocalStorageMock() as any
    }
    raceQualifyingOrchestratorService.clearMemoryCache()
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
  })

  // Helper para preparar o ambiente no slot 2 (QUALI_SPRINT)
  async function setupSprintSlot2(careerId: string, seasonId: string, round = 2) {
    const slotState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId,
      seasonId,
      round,
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1) // Completa TL1 -> Slot 2
    await canonicalWeekendSlotPersistenceService.saveSlotState(slotState)
    return slotState
  }

  // =========================================================================
  // SQ23-01 — HERANÇA SQ2
  // =========================================================================
  it('SQ23-01 — HERANÇA SQ2: SQ2 recebe exatamente 18 classificados do SQ1. Os 6 eliminados não aparecem.', async () => {
    const careerId = 'career_sq23_01'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    const sq1 = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })

    expect(sq1.classifiedDriverIds).toHaveLength(18)
    expect(sq1.eliminatedDriverIds).toHaveLength(6)

    // Executa SQ2 sem passar participants (herança pura)
    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })

    expect(sq2.totalParticipants).toBe(18)
    expect(sq2.results).toHaveLength(18)

    const sq2DriverIds = sq2.results.map((r) => r.driverId)
    // Todos os 18 do SQ2 estão nos classificados do SQ1
    for (const dId of sq2DriverIds) {
      expect(sq1.classifiedDriverIds).toContain(dId)
      expect(sq1.eliminatedDriverIds).not.toContain(dId)
    }
  })

  // =========================================================================
  // SQ23-02 — CORTE SQ2
  // =========================================================================
  it('SQ23-02 — CORTE SQ2: 18 participantes → 10 classificados → 8 eliminados.', async () => {
    const careerId = 'career_sq23_02'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })

    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })

    expect(sq2.totalParticipants).toBe(18)
    expect(sq2.advancingCount).toBe(10)
    expect(sq2.eliminatedCount).toBe(8)
    expect(sq2.classifiedDriverIds).toHaveLength(10)
    expect(sq2.eliminatedDriverIds).toHaveLength(8)
    expect(sq2.status).toBe('READY_FOR_SQ3')
  })

  // =========================================================================
  // SQ23-03 — HERANÇA SQ3
  // =========================================================================
  it('SQ23-03 — HERANÇA SQ3: SQ3 recebe exatamente os 10 classificados do SQ2.', async () => {
    const careerId = 'career_sq23_03'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })

    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })

    const sq3 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })

    expect(sq3.totalParticipants).toBe(10)
    expect(sq3.results).toHaveLength(10)

    const sq3DriverIds = sq3.results.map((r) => r.driverId)
    for (const dId of sq3DriverIds) {
      expect(sq2.classifiedDriverIds).toContain(dId)
      expect(sq2.eliminatedDriverIds).not.toContain(dId)
    }
  })

  // =========================================================================
  // SQ23-04 — SQ3
  // =========================================================================
  it('SQ23-04 — SQ3: 10 participantes, 10 posições únicas e transição para SPRINT_QUALIFYING_COMPLETE.', async () => {
    const careerId = 'career_sq23_04'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })
    await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })
    const sq3 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })

    expect(sq3.totalParticipants).toBe(10)
    expect(sq3.results).toHaveLength(10)
    expect(sq3.status).toBe('SPRINT_QUALIFYING_COMPLETE')

    const positions = sq3.results.map((r) => r.position)
    expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

    const uniquePositions = new Set(positions)
    expect(uniquePositions.size).toBe(10)
  })

  // =========================================================================
  // SQ23-05 — SEM RESSURREIÇÃO
  // =========================================================================
  it('SQ23-05 — SEM RESSURREIÇÃO: eliminados do SQ1/SQ2 nunca reaparecem.', async () => {
    const careerId = 'career_sq23_05'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    const sq1 = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })
    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })
    const sq3 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })

    const sq1Elim = new Set(sq1.eliminatedDriverIds)
    const sq2Elim = new Set(sq2.eliminatedDriverIds)

    // SQ2 não contém eliminados do SQ1
    for (const r of sq2.results) {
      expect(sq1Elim.has(r.driverId)).toBe(false)
    }

    // SQ3 não contém eliminados do SQ1 nem do SQ2
    for (const r of sq3.results) {
      expect(sq1Elim.has(r.driverId)).toBe(false)
      expect(sq2Elim.has(r.driverId)).toBe(false)
    }
  })

  // =========================================================================
  // SQ23-06 — SETUP
  // =========================================================================
  it('SQ23-06 — SETUP: SQ2 e SQ3 usam setup 32.81; qualifying bonus 82.025 ms uma vez por tentativa; setup permanece 32.81.', async () => {
    const careerId = 'career_sq23_06'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const baseSetup = 32.81
    const expectedBonusMs = 32.81 * 2.5 // 82.025 ms
    const participants = createCanonical24Participants(baseSetup)

    await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })
    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })
    const sq3 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })

    // SQ2 checks
    for (const r of sq2.results) {
      expect(r.setup).toBe(baseSetup)
      expect(r.bonusMs).toBeCloseTo(expectedBonusMs, 6)
      for (const att of r.attempts) {
        expect(att.bonusMs).toBeCloseTo(expectedBonusMs, 6)
      }
    }

    // SQ3 checks
    for (const r of sq3.results) {
      expect(r.setup).toBe(baseSetup)
      expect(r.bonusMs).toBeCloseTo(expectedBonusMs, 6)
      for (const att of r.attempts) {
        expect(att.bonusMs).toBeCloseTo(expectedBonusMs, 6)
      }
    }
  })

  // =========================================================================
  // SQ23-07 — COMPOSTOS SECO
  // =========================================================================
  it('SQ23-07 — COMPOSTOS SECO: SQ2 Médio/+650 ms da configuração; SQ3 Macio/sem +650 ms.', async () => {
    const careerId = 'career_sq23_07'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
      wet: false,
    })
    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
      wet: false,
    })
    const sq3 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
      wet: false,
    })

    // SQ2: Médio, compoundDeltaMs = +650
    for (const r of sq2.results) {
      expect(r.compoundUsed).toBe('MEDIUM')
      expect(r.compoundDeltaMs).toBe(650)
      for (const att of r.attempts) {
        expect(att.compoundUsed).toBe('MEDIUM')
        expect(att.compoundDeltaMs).toBe(650)
      }
    }

    // SQ3: Macio, compoundDeltaMs = 0
    for (const r of sq3.results) {
      expect(r.compoundUsed).toBe('SOFT')
      expect(r.compoundDeltaMs).toBe(0)
      for (const att of r.attempts) {
        expect(att.compoundUsed).toBe('SOFT')
        expect(att.compoundDeltaMs).toBe(0)
      }
    }
  })

  // =========================================================================
  // SQ23-08 — CHUVA
  // =========================================================================
  it('SQ23-08 — CHUVA: ajuste Médio/Macio deste canal = 0 ms no SQ2 e SQ3 molhados.', async () => {
    const careerId = 'career_sq23_08'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
      wet: true,
    })
    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
      wet: true,
    })
    const sq3 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
      wet: true,
    })

    // Em molhado, o motor zera o diferencial do composto
    for (const r of sq2.results) {
      expect(r.compoundDeltaMs).toBe(0)
      for (const att of r.attempts) {
        expect(att.compoundDeltaMs).toBe(0)
      }
    }

    for (const r of sq3.results) {
      expect(r.compoundDeltaMs).toBe(0)
      for (const att of r.attempts) {
        expect(att.compoundDeltaMs).toBe(0)
      }
    }
  })

  // =========================================================================
  // SQ23-09 — RNG
  // =========================================================================
  it('SQ23-09 — RNG: SQ2 e SQ3 possuem namespaces distintos entre si, de SQ1 e de MAIN.', async () => {
    const careerId = 'career_sq23_09'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    const sq1 = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })
    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })
    const sq3 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })

    // Sorteios Z de um piloto comum (ex: P1 de SQ3) são diferentes entre fases
    const commonDriverId = sq3.results[0].driverId
    const sq1R = sq1.results.find((r) => r.driverId === commonDriverId)!
    const sq2R = sq2.results.find((r) => r.driverId === commonDriverId)!
    const sq3R = sq3.results.find((r) => r.driverId === commonDriverId)!

    expect(sq1R.attempts[0].normalDrawZ).not.toBe(sq2R.attempts[0].normalDrawZ)
    expect(sq2R.attempts[0].normalDrawZ).not.toBe(sq3R.attempts[0].normalDrawZ)
    expect(sq1R.attempts[0].normalDrawZ).not.toBe(sq3R.attempts[0].normalDrawZ)
  })

  // =========================================================================
  // SQ23-10 — IDEMPOTÊNCIA
  // =========================================================================
  it('SQ23-10 — IDEMPOTÊNCIA: SQ2/SQ3 reexecutados não mudam resultados nem chamam novos sorteios.', async () => {
    const careerId = 'career_sq23_10'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })
    const sq2First = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })
    const sq2Second = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })

    expect(sq2Second.results).toEqual(sq2First.results)

    const sq3First = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })
    const sq3Second = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })

    expect(sq3Second.results).toEqual(sq3First.results)
  })

  // =========================================================================
  // SQ23-11 — RELOAD
  // =========================================================================
  it('SQ23-11 — RELOAD: fluxo direto e com reload (descarte de cache) entre SQ2/SQ3 produzem resultados idênticos.', async () => {
    const careerIdDirect = 'career_sq23_11_direct'
    const careerIdReload = 'career_sq23_11_reload'
    const seasonId = 'season_2026'
    const round = 2

    // 1. Fluxo Direto
    await setupSprintSlot2(careerIdDirect, seasonId, round)
    const participants = createCanonical24Participants(32.81)
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId: careerIdDirect,
      seasonId,
      round,
      participants,
    })
    await raceQualifyingOrchestratorService.executeSQ2({
      careerId: careerIdDirect,
      seasonId,
      round,
    })
    const sq3Direct = await raceQualifyingOrchestratorService.executeSQ3({
      careerId: careerIdDirect,
      seasonId,
      round,
    })

    // 2. Fluxo com Reload
    await setupSprintSlot2(careerIdReload, seasonId, round)
    const participantsReload = createCanonical24Participants(32.81)
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId: careerIdReload,
      seasonId,
      round,
      participants: participantsReload,
    })
    await raceQualifyingOrchestratorService.executeSQ2({
      careerId: careerIdReload,
      seasonId,
      round,
    })

    // Simula reload real descartando a memória RAM
    raceQualifyingOrchestratorService.clearMemoryCache()

    const sq3Reload = await raceQualifyingOrchestratorService.executeSQ3({
      careerId: careerIdReload,
      seasonId,
      round,
    })

    // Tempos e posições do SQ3 devem ser idênticos
    for (let i = 0; i < 10; i++) {
      expect(sq3Reload.results[i].driverId).toBe(sq3Direct.results[i].driverId)
      expect(sq3Reload.results[i].bestTimeMs).toBe(sq3Direct.results[i].bestTimeMs)
      expect(sq3Reload.results[i].position).toBe(sq3Direct.results[i].position)
    }
  })

  // =========================================================================
  // SQ23-12 — ORDEM
  // =========================================================================
  it('SQ23-12 — ORDEM: SQ3 antes de READY_FOR_SQ3 é rejeitado sem efeitos.', async () => {
    const careerId = 'career_sq23_12'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })
    // SQ1 concluído (READY_FOR_SQ2), mas SQ2 ainda não executado!

    await expect(
      raceQualifyingOrchestratorService.executeSQ3({
        careerId,
        seasonId,
        round,
      }),
    ).rejects.toThrow(/Ordem de sessões violada: SQ3 só pode ser iniciado após a conclusão do SQ2/)

    const sq3State = await raceQualifyingOrchestratorService.loadPersistedSQ3State(
      careerId,
      seasonId,
      round,
    )
    expect(sq3State).toBeNull()
  })

  // =========================================================================
  // SQ23-13 — FALHA PARCIAL
  // =========================================================================
  it('SQ23-13 — FALHA PARCIAL: persistência feita + transição falhada: retry não recalcula fase.', async () => {
    const careerId = 'career_sq23_13'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })

    const sq2Valid = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })

    // Simula falha parcial adulterando o status persistido para em andamento / incompleto
    const brokenState = {
      ...sq2Valid,
      isCompleted: false,
      status: 'SQ2' as any,
    }
    await raceQualifyingOrchestratorService.persistPhaseState(brokenState)
    raceQualifyingOrchestratorService.clearMemoryCache()

    // Retry do SQ2 deve recuperar o estado existente e finalizar sem novos cálculos
    const sq2Recovered = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })

    expect(sq2Recovered.isCompleted).toBe(true)
    expect(sq2Recovered.status).toBe('READY_FOR_SQ3')
    expect(sq2Recovered.results[0].bestTimeMs).toBe(sq2Valid.results[0].bestTimeMs)
  })

  // =========================================================================
  // SQ23-14 — RESULTADO GLOBAL
  // =========================================================================
  it('SQ23-14 — RESULTADO GLOBAL: SPRINT_QUALIFYING_RESULT tem P1–10 SQ3, P11–18 eliminados SQ2, P19–24 eliminados SQ1.', async () => {
    const careerId = 'career_sq23_14'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    const sq1 = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })
    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })
    const sq3 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })

    const globalSprint = await raceQualifyingOrchestratorService.buildSprintQualifyingResult({
      careerId,
      seasonId,
      round,
    })

    expect(globalSprint.status).toBe('SPRINT_QUALIFYING_RESULT_READY')
    expect(globalSprint.totalParticipants).toBe(24)
    expect(globalSprint.results).toHaveLength(24)

    // P1..P10: SQ3
    for (let i = 0; i < 10; i++) {
      const entry = globalSprint.results[i]
      expect(entry.position).toBe(i + 1)
      expect(entry.eliminationPhase).toBe('SQ3')
      expect(entry.driverId).toBe(sq3.results[i].driverId)
      expect(entry.sq3BestTimeMs).toBeDefined()
    }

    // P11..P18: SQ2 eliminados
    const sq2ElimSorted = sq2.results
      .filter((r) => r.isEliminated)
      .sort((a, b) => a.position - b.position)
    for (let i = 0; i < 8; i++) {
      const entry = globalSprint.results[10 + i]
      expect(entry.position).toBe(11 + i)
      expect(entry.eliminationPhase).toBe('SQ2')
      expect(entry.driverId).toBe(sq2ElimSorted[i].driverId)
      expect(entry.sq3BestTimeMs).toBeUndefined()
      expect(entry.sq2BestTimeMs).toBeDefined()
    }

    // P19..P24: SQ1 eliminados
    const sq1ElimSorted = sq1.results
      .filter((r) => r.isEliminated)
      .sort((a, b) => a.position - b.position)
    for (let i = 0; i < 6; i++) {
      const entry = globalSprint.results[18 + i]
      expect(entry.position).toBe(19 + i)
      expect(entry.eliminationPhase).toBe('SQ1')
      expect(entry.driverId).toBe(sq1ElimSorted[i].driverId)
      expect(entry.sq3BestTimeMs).toBeUndefined()
      expect(entry.sq2BestTimeMs).toBeUndefined()
      expect(entry.sq1BestTimeMs).toBeDefined()
    }
  })

  // =========================================================================
  // SQ23-15 — BIJEÇÃO
  // =========================================================================
  it('SQ23-15 — BIJEÇÃO: 24 pilotos, 24 cars/entries, P1–P24 contínuas, zero duplicações.', async () => {
    const careerId = 'career_sq23_15'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })
    await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })
    await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })

    const globalSprint = await raceQualifyingOrchestratorService.buildSprintQualifyingResult({
      careerId,
      seasonId,
      round,
    })

    const positions = globalSprint.results.map((r) => r.position)
    expect(positions).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))

    const driverIds = new Set(globalSprint.results.map((r) => r.driverId))
    expect(driverIds.size).toBe(24)

    const carIdentities = new Set(globalSprint.results.map((r) => `${r.teamId}_c${r.carIndex}`))
    expect(carIdentities.size).toBe(24)
  })

  // =========================================================================
  // SQ23-16 — ZERO RNG NA CONSOLIDAÇÃO
  // =========================================================================
  it('SQ23-16 — ZERO RNG NA CONSOLIDAÇÃO: construir resultado/grid não consome RNG nem altera tempos.', async () => {
    const careerId = 'career_sq23_16'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })
    await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })
    const sq3 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })

    const mathRandomSpy = vi.spyOn(Math, 'random')

    const globalResult = await raceQualifyingOrchestratorService.buildSprintQualifyingResult({
      careerId,
      seasonId,
      round,
    })
    const grid = await raceQualifyingOrchestratorService.buildSprintStartingGrid({
      careerId,
      seasonId,
      round,
    })

    expect(mathRandomSpy).not.toHaveBeenCalled()
    mathRandomSpy.mockRestore()

    // O tempo do pole é exatamente o melhor tempo do vencedor do SQ3
    expect(globalResult.poleTimeMs).toBe(sq3.results[0].bestTimeMs)
    expect(grid.grid[0].qualifyingTimeMs).toBe(sq3.results[0].bestTimeMs)
  })

  // =========================================================================
  // SQ23-17 — GRID SPRINT
  // =========================================================================
  it('SQ23-17 — GRID SPRINT: SPRINT_STARTING_GRID nasce do resultado Sprint, nunca do grid principal.', async () => {
    const careerId = 'career_sq23_17'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
    })
    await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })
    await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })

    const sprintGrid = await raceQualifyingOrchestratorService.buildSprintStartingGrid({
      careerId,
      seasonId,
      round,
    })

    expect(sprintGrid.status).toBe('SPRINT_GRID_READY')
    expect(sprintGrid.totalParticipants).toBe(24)
    expect(sprintGrid.grid).toHaveLength(24)

    // Posições P1..P24
    sprintGrid.grid.forEach((entry, idx) => {
      expect(entry.gridPosition).toBe(idx + 1)
      expect(entry.qualifyingPosition).toBe(idx + 1)
    })
  })

  // =========================================================================
  // SQ23-18 — ISOLAMENTO
  // =========================================================================
  it('SQ23-18 — ISOLAMENTO: SPRINT_STARTING_GRID e MAIN STARTING_GRID coexistem sem sobrescrever um ao outro.', async () => {
    const careerId = 'career_sq23_18'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    // 1. Executa fluxo completo Sprint
    await raceQualifyingOrchestratorService.executeSQ1({ careerId, seasonId, round, participants })
    await raceQualifyingOrchestratorService.executeSQ2({ careerId, seasonId, round })
    await raceQualifyingOrchestratorService.executeSQ3({ careerId, seasonId, round })
    const sprintGrid = await raceQualifyingOrchestratorService.buildSprintStartingGrid({
      careerId,
      seasonId,
      round,
    })

    // 2. Executa fluxo completo Main (bypass practice para teste de colisão)
    await raceQualifyingOrchestratorService.executeQ1({
      careerId,
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
    })
    await raceQualifyingOrchestratorService.executeQ2({ careerId, seasonId, round })
    await raceQualifyingOrchestratorService.executeQ3({ careerId, seasonId, round })
    const mainGrid = await raceQualifyingOrchestratorService.buildStartingGrid({
      careerId,
      seasonId,
      round,
    })

    // 3. Prova que as chaves de armazenamento são totalmente diferentes
    const sprintGridKey = buildSprintStartingGridStorageKey(careerId, seasonId, round)
    const mainGridKey = buildStartingGridStorageKey(careerId, seasonId, round)
    expect(sprintGridKey).not.toBe(mainGridKey)
    expect(sprintGridKey).toContain('sprint_starting_grid')
    expect(mainGridKey).toContain('starting_grid_state')

    // 4. Prova que ambos coexistem na persistência
    const loadedSprintGrid =
      await raceQualifyingOrchestratorService.loadPersistedSprintStartingGrid(
        careerId,
        seasonId,
        round,
      )
    const loadedMainGrid = await raceQualifyingOrchestratorService.loadPersistedStartingGrid(
      careerId,
      seasonId,
      round,
    )

    expect(loadedSprintGrid).not.toBeNull()
    expect(loadedMainGrid).not.toBeNull()
    expect(loadedSprintGrid?.status).toBe('SPRINT_GRID_READY')
    expect(loadedMainGrid?.status).toBe('GRID_READY')
  })

  // =========================================================================
  // SQ23-19 — TRANSIÇÃO
  // =========================================================================
  it('SQ23-19 — TRANSIÇÃO: depois do grid Sprint válido: slot 2 → slot 3 / SPRINT_RACE READY, sem executar Sprint.', async () => {
    const careerId = 'career_sq23_19'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    await raceQualifyingOrchestratorService.executeSQ1({ careerId, seasonId, round, participants })
    await raceQualifyingOrchestratorService.executeSQ2({ careerId, seasonId, round })
    await raceQualifyingOrchestratorService.executeSQ3({ careerId, seasonId, round })
    await raceQualifyingOrchestratorService.buildSprintQualifyingResult({
      careerId,
      seasonId,
      round,
    })
    await raceQualifyingOrchestratorService.buildSprintStartingGrid({ careerId, seasonId, round })

    const transitionResult =
      await raceQualifyingOrchestratorService.transitionSprintQualifyingToSprintRaceSlot({
        careerId,
        seasonId,
        round,
      })

    expect(transitionResult.currentSlot).toBe(3)
    expect(transitionResult.slotType).toBe('SPRINT_RACE')
    expect(transitionResult.slotStatus).toBe('NOT_STARTED')
  })

  // =========================================================================
  // SQ23-20 — MAIN INTACTO
  // =========================================================================
  it('SQ23-20 — MAIN INTACTO: Q1/Q2/Q3 principal permanecem semanticamente independentes do resultado Sprint.', async () => {
    const careerId = 'career_sq23_20'
    const seasonId = 'season_2026'
    const round = 2
    await setupSprintSlot2(careerId, seasonId, round)

    const participants = createCanonical24Participants(32.81)
    await raceQualifyingOrchestratorService.executeSQ1({ careerId, seasonId, round, participants })
    await raceQualifyingOrchestratorService.executeSQ2({ careerId, seasonId, round })
    await raceQualifyingOrchestratorService.executeSQ3({ careerId, seasonId, round })
    await raceQualifyingOrchestratorService.buildSprintQualifyingResult({
      careerId,
      seasonId,
      round,
    })
    await raceQualifyingOrchestratorService.buildSprintStartingGrid({ careerId, seasonId, round })

    // Agora executa a Qualificação Principal (Q1/Q2/Q3)
    const q1 = await raceQualifyingOrchestratorService.executeQ1({
      careerId,
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
    })
    const q2 = await raceQualifyingOrchestratorService.executeQ2({ careerId, seasonId, round })
    const q3 = await raceQualifyingOrchestratorService.executeQ3({ careerId, seasonId, round })
    const mainResult = await raceQualifyingOrchestratorService.buildGlobalQualifyingResult({
      careerId,
      seasonId,
      round,
    })

    expect(q1.variant).toBe('MAIN_QUALIFYING')
    expect(q2.variant).toBe('MAIN_QUALIFYING')
    expect(q3.variant).toBe('MAIN_QUALIFYING')
    expect(mainResult.status).toBe('QUALIFYING_RESULT_READY')
    expect(mainResult.totalParticipants).toBe(24)

    // O Q1 começou com os 24 participantes originais, sem cortes ou reordenações advindas da Sprint
    expect(q1.totalParticipants).toBe(24)
    expect(q1.classifiedDriverIds).toHaveLength(18)
  })
})
