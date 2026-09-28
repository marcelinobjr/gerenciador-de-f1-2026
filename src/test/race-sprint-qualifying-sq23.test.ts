/**
 * src/test/race-sprint-qualifying-sq23.test.ts
 *
 * APEX GP MANAGER — RACE-SPRINT-SLOTS-01B2: SUÍTE DE TESTES SQ23-01 A SQ23-20
 *
 * TESTES OBRIGATÓRIOS:
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
 * SQ23-20 — MAIN INTACTO: Q1/Q2/Q3 principal permanecem semanticamente independentes do resultado Sprint.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  raceQualifyingOrchestratorService,
  buildQualifyingStorageKey,
  buildGlobalSprintQualifyingStorageKey,
  buildSprintStartingGridStorageKey,
  type QualifyingDriverInput,
  type QualifyingPhaseExecutionState,
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

describe('RACE-SPRINT-SLOTS-01B2 — Homologação SQ2, SQ3, Resultado e Grid Sprint (SQ23-01 a SQ23-20)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage = new LocalStorageMock() as any
    }
    raceQualifyingOrchestratorService.clearMemoryCache()
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
  })

  // Helper para preparar SQ1 executado no slot 2
  async function setupSQ1(
    careerId: string,
    seasonId: string,
    round = 2,
    baseSetup = 32.81,
    wet = false,
  ) {
    const slotState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId,
      seasonId,
      round,
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1) // vai para slot 2
    await canonicalWeekendSlotPersistenceService.saveSlotState(slotState)

    const participants = createCanonical24Participants(baseSetup)
    const sq1State = await raceQualifyingOrchestratorService.executeSQ1({
      careerId,
      seasonId,
      round,
      participants,
      wet,
    })
    return { slotState, participants, sq1State }
  }

  // =========================================================================
  // SQ23-01 — HERANÇA SQ2
  // =========================================================================
  it('SQ23-01 — HERANÇA SQ2: SQ2 recebe exatamente 18 classificados do SQ1; 6 eliminados não aparecem', async () => {
    const careerId = 'career_sq23_01'
    const seasonId = 'season_2026'
    const round = 2
    const { sq1State } = await setupSQ1(careerId, seasonId, round)

    const sq2State = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })

    expect(sq2State.totalParticipants).toBe(18)
    expect(sq2State.results).toHaveLength(18)

    const sq2DriverIds = sq2State.results.map((r) => r.driverId)
    // Todos os 18 do SQ2 devem estar em sq1State.classifiedDriverIds
    expect(sq2DriverIds.sort()).toEqual([...sq1State.classifiedDriverIds].sort())

    // Nenhum dos 6 eliminados do SQ1 pode estar no SQ2
    for (const elimId of sq1State.eliminatedDriverIds) {
      expect(sq2DriverIds).not.toContain(elimId)
    }
  })

  // =========================================================================
  // SQ23-02 — CORTE SQ2
  // =========================================================================
  it('SQ23-02 — CORTE SQ2: 18 → 10 classificados → 8 eliminados; conclui em READY_FOR_SQ3', async () => {
    const careerId = 'career_sq23_02'
    const seasonId = 'season_2026'
    const round = 2
    await setupSQ1(careerId, seasonId, round)

    const sq2State = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })

    expect(sq2State.advancingCount).toBe(10)
    expect(sq2State.eliminatedCount).toBe(8)
    expect(sq2State.classifiedDriverIds).toHaveLength(10)
    expect(sq2State.eliminatedDriverIds).toHaveLength(8)
    expect(sq2State.status).toBe('READY_FOR_SQ3')

    // Top 10 classificados (P1..P10), P11..P18 eliminados
    const classified = sq2State.results.filter((r) => r.isClassified)
    const eliminated = sq2State.results.filter((r) => r.isEliminated)
    expect(classified).toHaveLength(10)
    expect(eliminated).toHaveLength(8)
    classified.forEach((r) => expect(r.position).toBeLessThanOrEqual(10))
    eliminated.forEach((r) => expect(r.position).toBeGreaterThanOrEqual(11))
  })

  // =========================================================================
  // SQ23-03 — HERANÇA SQ3
  // =========================================================================
  it('SQ23-03 — HERANÇA SQ3: SQ3 recebe exatamente os 10 classificados do SQ2', async () => {
    const careerId = 'career_sq23_03'
    const seasonId = 'season_2026'
    const round = 2
    await setupSQ1(careerId, seasonId, round)
    const sq2State = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })

    const sq3State = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })

    expect(sq3State.totalParticipants).toBe(10)
    expect(sq3State.results).toHaveLength(10)

    const sq3DriverIds = sq3State.results.map((r) => r.driverId)
    expect(sq3DriverIds.sort()).toEqual([...sq2State.classifiedDriverIds].sort())

    for (const elimId of sq2State.eliminatedDriverIds) {
      expect(sq3DriverIds).not.toContain(elimId)
    }
  })

  // =========================================================================
  // SQ23-04 — SQ3
  // =========================================================================
  it('SQ23-04 — SQ3: 10 participantes, 10 posições únicas P1..P10, status SPRINT_QUALIFYING_COMPLETE', async () => {
    const careerId = 'career_sq23_04'
    const seasonId = 'season_2026'
    const round = 2
    await setupSQ1(careerId, seasonId, round)
    await raceQualifyingOrchestratorService.executeSQ2({ careerId, seasonId, round })

    const sq3State = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })

    expect(sq3State.results).toHaveLength(10)
    const positions = sq3State.results.map((r) => r.position).sort((a, b) => a - b)
    expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

    const driverIds = new Set(sq3State.results.map((r) => r.driverId))
    expect(driverIds.size).toBe(10)

    expect(sq3State.status).toBe('SPRINT_QUALIFYING_COMPLETE')
    expect(sq3State.isCompleted).toBe(true)
  })

  // =========================================================================
  // SQ23-05 — SEM RESSURREIÇÃO
  // =========================================================================
  it('SQ23-05 — SEM RESSURREIÇÃO: eliminados do SQ1 e SQ2 nunca reaparecem em fases posteriores', async () => {
    const careerId = 'career_sq23_05'
    const seasonId = 'season_2026'
    const round = 2
    const { sq1State } = await setupSQ1(careerId, seasonId, round)
    const sq2State = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })
    const sq3State = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })

    const sq1Elim = new Set(sq1State.eliminatedDriverIds)
    const sq2Elim = new Set(sq2State.eliminatedDriverIds)

    // Nenhum eliminado de SQ1 em SQ2
    sq2State.results.forEach((r) => {
      expect(sq1Elim.has(r.driverId)).toBe(false)
    })

    // Nenhum eliminado de SQ1 ou SQ2 em SQ3
    sq3State.results.forEach((r) => {
      expect(sq1Elim.has(r.driverId)).toBe(false)
      expect(sq2Elim.has(r.driverId)).toBe(false)
    })
  })

  // =========================================================================
  // SQ23-06 — SETUP
  // =========================================================================
  it('SQ23-06 — SETUP: SQ2 e SQ3 usam setup 32.81; bônus 82.025 ms uma vez por tentativa; setup permanece 32.81', async () => {
    const careerId = 'career_sq23_06'
    const seasonId = 'season_2026'
    const round = 2
    const baseSetup = 32.81
    const expectedBonusMs = 32.81 * 2.5 // 82.025 ms
    await setupSQ1(careerId, seasonId, round, baseSetup)

    const sq2State = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })
    sq2State.results.forEach((r) => {
      expect(r.setup).toBe(32.81)
      expect(r.bonusMs).toBeCloseTo(expectedBonusMs, 5)
      r.attempts.forEach((att) => {
        expect(att.bonusMs).toBeCloseTo(expectedBonusMs, 5)
      })
    })

    const sq3State = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })
    sq3State.results.forEach((r) => {
      expect(r.setup).toBe(32.81)
      expect(r.bonusMs).toBeCloseTo(expectedBonusMs, 5)
      r.attempts.forEach((att) => {
        expect(att.bonusMs).toBeCloseTo(expectedBonusMs, 5)
      })
    })
  })

  // =========================================================================
  // SQ23-07 — COMPOSTOS SECO
  // =========================================================================
  it('SQ23-07 — COMPOSTOS SECO: SQ2 usa Médio (+650 ms da config); SQ3 usa Macio (sem +650 ms)', async () => {
    const careerId = 'career_sq23_07'
    const seasonId = 'season_2026'
    const round = 2
    await setupSQ1(careerId, seasonId, round, 32.81, false)

    const sq2State = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
      wet: false,
    })
    sq2State.results.forEach((r) => {
      expect(r.compoundUsed).toBe('MEDIUM')
      expect(r.compoundDeltaMs).toBe(650)
      r.attempts.forEach((att) => {
        expect(att.compoundUsed).toBe('MEDIUM')
        expect(att.compoundDeltaMs).toBe(650)
      })
    })

    const sq3State = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
      wet: false,
    })
    sq3State.results.forEach((r) => {
      expect(r.compoundUsed).toBe('SOFT')
      expect(r.compoundDeltaMs).toBe(0)
      r.attempts.forEach((att) => {
        expect(att.compoundUsed).toBe('SOFT')
        expect(att.compoundDeltaMs).toBe(0)
      })
    })
  })

  // =========================================================================
  // SQ23-08 — CHUVA
  // =========================================================================
  it('SQ23-08 — CHUVA: em pista molhada (wet=true), ajuste Médio/Macio deste canal é zero para SQ2 e SQ3', async () => {
    const careerId = 'career_sq23_08'
    const seasonId = 'season_2026'
    const round = 2
    await setupSQ1(careerId, seasonId, round, 32.81, true)

    const sq2State = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
      wet: true,
    })
    sq2State.results.forEach((r) => {
      expect(r.compoundDeltaMs).toBe(0)
      r.attempts.forEach((att) => {
        expect(att.compoundDeltaMs).toBe(0)
      })
    })

    const sq3State = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
      wet: true,
    })
    sq3State.results.forEach((r) => {
      expect(r.compoundDeltaMs).toBe(0)
      r.attempts.forEach((att) => {
        expect(att.compoundDeltaMs).toBe(0)
      })
    })
  })

  // =========================================================================
  // SQ23-09 — RNG
  // =========================================================================
  it('SQ23-09 — RNG: SQ1, SQ2, SQ3 e MAIN possuem namespaces distintos gerando sorteios independentes', async () => {
    const careerId = 'career_sq23_09'
    const seasonId = 'season_2026'
    const round = 2
    const { sq1State } = await setupSQ1(careerId, seasonId, round)
    const sq2State = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })
    const sq3State = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })

    // Pega o piloto pole do SQ3
    const poleDriverId = sq3State.results[0].driverId
    const sq1Att1 = sq1State.results.find((r) => r.driverId === poleDriverId)?.attempts[0]
    const sq2Att1 = sq2State.results.find((r) => r.driverId === poleDriverId)?.attempts[0]
    const sq3Att1 = sq3State.results.find((r) => r.driverId === poleDriverId)?.attempts[0]

    expect(sq1Att1).toBeDefined()
    expect(sq2Att1).toBeDefined()
    expect(sq3Att1).toBeDefined()

    // Os draws normais Z entre as fases para o mesmo piloto devem ser distintos
    expect(sq1Att1?.normalDrawZ).not.toBe(sq2Att1?.normalDrawZ)
    expect(sq2Att1?.normalDrawZ).not.toBe(sq3Att1?.normalDrawZ)
    expect(sq1Att1?.normalDrawZ).not.toBe(sq3Att1?.normalDrawZ)
  })

  // =========================================================================
  // SQ23-10 — IDEMPOTÊNCIA
  // =========================================================================
  it('SQ23-10 — IDEMPOTÊNCIA: SQ2 e SQ3 reexecutados não recalculam tempos nem alteram resultados', async () => {
    const careerId = 'career_sq23_10'
    const seasonId = 'season_2026'
    const round = 2
    await setupSQ1(careerId, seasonId, round)

    const sq2Run1 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })
    const sq2Run2 = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })
    expect(sq2Run1.results).toEqual(sq2Run2.results)
    expect(sq2Run1.classifiedDriverIds).toEqual(sq2Run2.classifiedDriverIds)

    const sq3Run1 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })
    const sq3Run2 = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })
    expect(sq3Run1.results).toEqual(sq3Run2.results)
    expect(sq3Run1.classifiedDriverIds).toEqual(sq3Run2.classifiedDriverIds)
  })

  // =========================================================================
  // SQ23-11 — RELOAD
  // =========================================================================
  it('SQ23-11 — RELOAD: fluxo com reload entre SQ2 e SQ3 produz resultados idênticos ao fluxo contínuo', async () => {
    const careerId = 'career_sq23_11'
    const seasonId = 'season_2026'
    const round = 2
    await setupSQ1(careerId, seasonId, round)

    // Executa SQ2
    const sq2Original = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })

    // Simula reload: descarta memória cache
    raceQualifyingOrchestratorService.clearMemoryCache()
    canonicalWeekendSlotPersistenceService.clearMemoryCache()

    // Carrega SQ2 da persistência
    const sq2Reloaded = await raceQualifyingOrchestratorService.loadPersistedSQ2State(
      careerId,
      seasonId,
      round,
    )
    expect(sq2Reloaded).not.toBeNull()
    expect(sq2Reloaded?.results).toEqual(sq2Original.results)

    // Executa SQ3 após o reload
    const sq3AfterReload = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })
    expect(sq3AfterReload.isCompleted).toBe(true)
    expect(sq3AfterReload.results).toHaveLength(10)
  })

  // =========================================================================
  // SQ23-12 — ORDEM
  // =========================================================================
  it('SQ23-12 — ORDEM: SQ3 antes de SQ2 concluído (READY_FOR_SQ3) é rejeitado sem efeitos colaterais', async () => {
    const careerId = 'career_sq23_12'
    const seasonId = 'season_2026'
    const round = 2
    await setupSQ1(careerId, seasonId, round)

    // Tenta chamar SQ3 diretamente sem ter executado SQ2
    await expect(
      raceQualifyingOrchestratorService.executeSQ3({ careerId, seasonId, round }),
    ).rejects.toThrow(/Ordem de sessões violada: SQ3 só pode ser iniciado após a conclusão do SQ2/)

    // SQ3 não deve estar persistido
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
  it('SQ23-13 — FALHA PARCIAL: se resultados foram salvos mas status falhou, retry recupera tempos sem recalcular', async () => {
    const careerId = 'career_sq23_13'
    const seasonId = 'season_2026'
    const round = 2
    await setupSQ1(careerId, seasonId, round)

    // Executa SQ2 normalmente
    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({ careerId, seasonId, round })

    // Simula estado de falha parcial persistido: status quebrado
    const corruptedState: QualifyingPhaseExecutionState = {
      ...sq2,
      status: 'SQ2' as any,
      isCompleted: false,
    }
    await raceQualifyingOrchestratorService.persistPhaseState(corruptedState)
    raceQualifyingOrchestratorService.clearMemoryCache()

    // Ao executar novamente SQ2, ele detecta os resultados existentes, recupera e apenas atualiza o status
    const recovered = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })
    expect(recovered.isCompleted).toBe(true)
    expect(recovered.status).toBe('READY_FOR_SQ3')
    expect(recovered.results[0].bestTimeMs).toBe(sq2.results[0].bestTimeMs)
  })

  // =========================================================================
  // SQ23-14 — RESULTADO GLOBAL
  // =========================================================================
  it('SQ23-14 — RESULTADO GLOBAL: SPRINT_QUALIFYING_RESULT tem P1–10 SQ3, P11–18 eliminados SQ2, P19–24 eliminados SQ1', async () => {
    const careerId = 'career_sq23_14'
    const seasonId = 'season_2026'
    const round = 2
    const { sq1State } = await setupSQ1(careerId, seasonId, round)
    const sq2State = await raceQualifyingOrchestratorService.executeSQ2({
      careerId,
      seasonId,
      round,
    })
    const sq3State = await raceQualifyingOrchestratorService.executeSQ3({
      careerId,
      seasonId,
      round,
    })

    const result = await raceQualifyingOrchestratorService.buildSprintQualifyingResult({
      careerId,
      seasonId,
      round,
    })

    expect(result.status).toBe('SPRINT_QUALIFYING_RESULT_READY')
    expect(result.totalParticipants).toBe(24)
    expect(result.results).toHaveLength(24)

    // P1–P10 do SQ3
    for (let p = 1; p <= 10; p++) {
      const entry = result.results[p - 1]
      expect(entry.position).toBe(p)
      expect(entry.eliminationPhase).toBe('SQ3')
      expect(sq3State.results.map((r) => r.driverId)).toContain(entry.driverId)
    }

    // P11–P18 dos eliminados do SQ2
    for (let p = 11; p <= 18; p++) {
      const entry = result.results[p - 1]
      expect(entry.position).toBe(p)
      expect(entry.eliminationPhase).toBe('SQ2')
      expect(sq2State.eliminatedDriverIds).toContain(entry.driverId)
    }

    // P19–P24 dos eliminados do SQ1
    for (let p = 19; p <= 24; p++) {
      const entry = result.results[p - 1]
      expect(entry.position).toBe(p)
      expect(entry.eliminationPhase).toBe('SQ1')
      expect(sq1State.eliminatedDriverIds).toContain(entry.driverId)
    }
  })

  // =========================================================================
  // SQ23-15 — BIJEÇÃO
  // =========================================================================
  it('SQ23-15 — BIJEÇÃO: 24 pilotos, 24 cars/entries, posições P1–P24 contínuas, zero duplicações ou ausências', async () => {
    const careerId = 'career_sq23_15'
    const seasonId = 'season_2026'
    const round = 2
    const { participants } = await setupSQ1(careerId, seasonId, round)
    await raceQualifyingOrchestratorService.executeSQ2({ careerId, seasonId, round })
    await raceQualifyingOrchestratorService.executeSQ3({ careerId, seasonId, round })

    const result = await raceQualifyingOrchestratorService.buildSprintQualifyingResult({
      careerId,
      seasonId,
      round,
    })

    const driverIds = result.results.map((r) => r.driverId)
    const uniqueDrivers = new Set(driverIds)
    expect(uniqueDrivers.size).toBe(24)

    const positions = result.results.map((r) => r.position)
    const expectedPositions = Array.from({ length: 24 }, (_, i) => i + 1)
    expect(positions).toEqual(expectedPositions)

    // Todos os participantes originais estão presentes
    const origDriverIds = participants.map((p) => p.driverId)
    for (const dId of origDriverIds) {
      expect(uniqueDrivers.has(dId)).toBe(true)
    }
  })

  // =========================================================================
  // SQ23-16 — ZERO RNG NA CONSOLIDAÇÃO
  // =========================================================================
  it('SQ23-16 — ZERO RNG NA CONSOLIDAÇÃO: construir resultado e grid Sprint não consome RNG nem altera tempos de SQ1/2/3', async () => {
    const careerId = 'career_sq23_16'
    const seasonId = 'season_2026'
    const round = 2
    await setupSQ1(careerId, seasonId, round)
    const sq2 = await raceQualifyingOrchestratorService.executeSQ2({ careerId, seasonId, round })
    const sq3 = await raceQualifyingOrchestratorService.executeSQ3({ careerId, seasonId, round })

    const result1 = await raceQualifyingOrchestratorService.buildSprintQualifyingResult({
      careerId,
      seasonId,
      round,
    })
    const grid1 = await raceQualifyingOrchestratorService.buildSprintStartingGrid({
      careerId,
      seasonId,
      round,
    })

    // Limpa cache de memória e reconstrói
    raceQualifyingOrchestratorService.clearMemoryCache()
    const result2 = await raceQualifyingOrchestratorService.buildSprintQualifyingResult({
      careerId,
      seasonId,
      round,
    })
    const grid2 = await raceQualifyingOrchestratorService.buildSprintStartingGrid({
      careerId,
      seasonId,
      round,
    })

    expect(result1.results).toEqual(result2.results)
    expect(grid1.grid).toEqual(grid2.grid)
    expect(result1.poleTimeMs).toBe(sq3.results[0].bestTimeMs)
  })

  // =========================================================================
  // SQ23-17 — GRID SPRINT
  // =========================================================================
  it('SQ23-17 — GRID SPRINT: SPRINT_STARTING_GRID nasce exclusivamente do SPRINT_QUALIFYING_RESULT', async () => {
    const careerId = 'career_sq23_17'
    const seasonId = 'season_2026'
    const round = 2
    await setupSQ1(careerId, seasonId, round)
    await raceQualifyingOrchestratorService.executeSQ2({ careerId, seasonId, round })
    await raceQualifyingOrchestratorService.executeSQ3({ careerId, seasonId, round })

    const sprintResult = await raceQualifyingOrchestratorService.buildSprintQualifyingResult({
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

    // O grid espelha o resultado esportivo da Sprint
    sprintGrid.grid.forEach((g, idx) => {
      const matchQuali = sprintResult.results[idx]
      expect(g.gridPosition).toBe(idx + 1)
      expect(g.qualifyingPosition).toBe(matchQuali.position)
      expect(g.driverId).toBe(matchQuali.driverId)
      expect(g.qualifyingTimeMs).toBe(matchQuali.phaseBestTimeMs)
    })
  })

  // =========================================================================
  // SQ23-18 — ISOLAMENTO
  // =========================================================================
  it('SQ23-18 — ISOLAMENTO: SPRINT_STARTING_GRID e MAIN STARTING_GRID coexistem sem sobrescrever um ao outro', async () => {
    const careerId = 'career_sq23_18'
    const seasonId = 'season_2026'
    const round = 2
    const { participants } = await setupSQ1(careerId, seasonId, round)
    await raceQualifyingOrchestratorService.executeSQ2({ careerId, seasonId, round })
    await raceQualifyingOrchestratorService.executeSQ3({ careerId, seasonId, round })

    const sprintGrid = await raceQualifyingOrchestratorService.buildSprintStartingGrid({
      careerId,
      seasonId,
      round,
    })

    // Executa também a quali principal para gerar STARTING_GRID normal
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

    // Prova que ambos coexistem
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

    const sprintKey = buildSprintStartingGridStorageKey(careerId, seasonId, round)
    expect(sprintKey).toContain('sprint_starting_grid')
  })

  // =========================================================================
  // SQ23-19 — TRANSIÇÃO
  // =========================================================================
  it('SQ23-19 — TRANSIÇÃO: após grid Sprint válido, transiciona slot 2 → slot 3 / SPRINT_RACE sem executar a corrida', async () => {
    const careerId = 'career_sq23_19'
    const seasonId = 'season_2026'
    const round = 2
    await setupSQ1(careerId, seasonId, round)
    await raceQualifyingOrchestratorService.executeSQ2({ careerId, seasonId, round })
    await raceQualifyingOrchestratorService.executeSQ3({ careerId, seasonId, round })
    await raceQualifyingOrchestratorService.buildSprintQualifyingResult({
      careerId,
      seasonId,
      round,
    })
    await raceQualifyingOrchestratorService.buildSprintStartingGrid({ careerId, seasonId, round })

    // Realiza a transição canônica
    const slotStateAfter = await raceQualifyingOrchestratorService.transitionToSprintRaceSlot({
      careerId,
      seasonId,
      round,
    })

    expect(slotStateAfter.currentSlot).toBe(3)
    expect(slotStateAfter.slotType).toBe('SPRINT')
    expect(slotStateAfter.slotStatus).toBe('AVAILABLE')
    expect(slotStateAfter.slots[2].status).toBe('COMPLETED')
    expect(slotStateAfter.slots[3].status).toBe('AVAILABLE')
  })

  // =========================================================================
  // SQ23-20 — MAIN INTACTO
  // =========================================================================
  it('SQ23-20 — MAIN INTACTO: Q1/Q2/Q3 principal permanecem semanticamente independentes da Sprint', async () => {
    const careerId = 'career_sq23_20'
    const seasonId = 'season_2026'
    const round = 2
    const { participants } = await setupSQ1(careerId, seasonId, round)
    await raceQualifyingOrchestratorService.executeSQ2({ careerId, seasonId, round })
    await raceQualifyingOrchestratorService.executeSQ3({ careerId, seasonId, round })
    await raceQualifyingOrchestratorService.buildSprintStartingGrid({ careerId, seasonId, round })

    // Executa Q1 principal
    const q1 = await raceQualifyingOrchestratorService.executeQ1({
      careerId,
      seasonId,
      round,
      participants,
      forceBypassPracticeCheck: true,
    })

    expect(q1.phase).toBe('Q1')
    expect(q1.variant).toBe('MAIN_QUALIFYING')
    expect(q1.status).toBe('READY_FOR_Q2')
    expect(q1.totalParticipants).toBe(24)

    // Os eliminados do SQ1/SQ2 podem estar normalmente classificados no Q1 principal!
    const sq1State = await raceQualifyingOrchestratorService.loadPersistedSQ1State(
      careerId,
      seasonId,
      round,
    )
    const elimFromSq1 = sq1State!.eliminatedDriverIds[0]
    // O piloto elimFromSq1 participou normalmente do Q1 principal
    const inQ1 = q1.results.find((r) => r.driverId === elimFromSq1)
    expect(inQ1).toBeDefined()
  })
})
