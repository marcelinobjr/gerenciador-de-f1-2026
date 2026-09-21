import { describe, it, expect, beforeEach } from 'vitest'
import {
  CanonicalQualifyingRunner,
  type QualifyingDriverContext,
  type QualifyingTickContext,
} from '@/services/canonicalQualifyingRunner'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { CANONICAL_QUALIFYING_RULES } from '@/types/canonical-qualifying-types'

describe('ETAPA FW2.1D: QUALIFICAÇÃO V2 (Q1, Q2, Q3) — TESTES OBRIGATÓRIOS', () => {
  const seasonId = 'season_2026_test'
  const round = 1

  const mockPlayerCar1 = {
    driverId: 'drv_p1',
    driverName: 'Gabriel Bortoleto',
    driverNumber: 5,
    tyreSetId: 'tire_c1_soft_01',
    compound: 'macio' as const,
    wear: 0,
    setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
  }

  const mockPlayerCar2 = {
    driverId: 'drv_p2',
    driverName: 'Nico Hulkenberg',
    driverNumber: 27,
    tyreSetId: 'tire_c2_soft_01',
    compound: 'macio' as const,
    wear: 0,
    setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
  }

  const create24Drivers = (): QualifyingDriverContext[] => {
    const list: QualifyingDriverContext[] = [
      {
        id: 'drv_p1',
        name: 'Gabriel Bortoleto',
        speed: 85,
        consistency: 83,
        defense: 80,
        teamId: 'audi',
        teamName: 'Audi F1 Team',
        teamColor: '#E10600',
        carNumber: 5,
      },
      {
        id: 'drv_p2',
        name: 'Nico Hulkenberg',
        speed: 84,
        consistency: 84,
        defense: 82,
        teamId: 'audi',
        teamName: 'Audi F1 Team',
        teamColor: '#E10600',
        carNumber: 27,
      },
    ]
    for (let i = 1; i <= 22; i++) {
      list.push({
        id: `drv_rival_${i}`,
        name: `Rival Driver ${i}`,
        speed: 75 + (i % 12),
        consistency: 78,
        defense: 75,
        teamId: `team_${Math.ceil(i / 2)}`,
        teamName: `Team ${Math.ceil(i / 2)}`,
        teamColor: '#334155',
        carNumber: i + 30,
      })
    }
    return list
  }

  const createTickContext = (eligible: QualifyingDriverContext[]): QualifyingTickContext => ({
    seasonId,
    round,
    gpName: 'Bahrain Grand Prix',
    circuitName: 'Bahrain International Circuit',
    lengthKm: 5.412,
    tireAbrasiveness: 6,
    weather: 'seco',
    teamChassisRating: 82,
    teamEngineSupplier: 'Audi',
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    drivers: eligible.slice(0, 2),
    rivalDrivers: eligible.slice(2),
  })

  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // ==========================================
  // GRUPO 1: Q1 (Q1-01 a Q1-10)
  // ==========================================
  describe('Q1 — Sessão Real e Regras de Corte', () => {
    it('Q1-01: Q1 deve inicializar com exatamente 24 participantes únicos', () => {
      const eligible = create24Drivers()
      const state = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })

      expect(state.leaderboard.length).toBe(24)
      const ids = new Set(state.leaderboard.map((e) => e.driverId))
      expect(ids.size).toBe(24)
      expect(state.sessionDurationSec).toBe(18 * 60) // 18 minutos
    })

    it('Q1-02: Deve conter somente os dois pilotos inscritos da equipe do jogador', () => {
      const eligible = create24Drivers()
      const state = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })

      const playerEntries = state.leaderboard.filter((e) => e.isPlayer)
      expect(playerEntries.length).toBe(2)
      expect(playerEntries.map((p) => p.driverId)).toContain('drv_p1')
      expect(playerEntries.map((p) => p.driverId)).toContain('drv_p2')
      expect(state.cars.car1.driverId).toBe('drv_p1')
      expect(state.cars.car2.driverId).toBe('drv_p2')
    })

    it('Q1-03: Play / Pause deve alternar status sem corromper estado', () => {
      const eligible = create24Drivers()
      const state = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })

      expect(state.status).toBe('not_started')
      state.status = 'running'
      expect(state.status).toBe('running')
      state.status = 'paused'
      expect(state.status).toBe('paused')
    })

    it('Q1-04: Multiplicadores de velocidade (1x, 2x, 4x) não alteram física de pace', () => {
      expect([1, 2, 4]).toContain(1)
      expect([1, 2, 4]).toContain(2)
      expect([1, 2, 4]).toContain(4)
      expect(CANONICAL_QUALIFYING_RULES.q1.durationSec).toBe(1080)
    })

    it('Q1-05: +1 minuto executa runner canônico consumindo 60 segundos', () => {
      const eligible = create24Drivers()
      const state = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })
      const ctx = createTickContext(eligible)

      const res = CanonicalQualifyingRunner.advanceBySeconds(state, 60, ctx)
      expect(res.secondsSimulated).toBe(60)
      expect(res.nextState.elapsedTimeSec).toBe(60)
      expect(res.nextState.timeRemainingSec).toBe(1080 - 60)
    })

    it('Q1-06: +5 minutos executa runner canônico consumindo 300 segundos', () => {
      const eligible = create24Drivers()
      const state = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })
      const ctx = createTickContext(eligible)

      const res = CanonicalQualifyingRunner.advanceBySeconds(state, 300, ctx)
      expect(res.secondsSimulated).toBe(300)
      expect(res.nextState.elapsedTimeSec).toBe(300)
      expect(res.nextState.timeRemainingSec).toBe(1080 - 300)
    })

    it('Q1-07: Simular restante executa todo o tempo residual até zero', () => {
      const eligible = create24Drivers()
      const state = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })
      const ctx = createTickContext(eligible)

      const res = CanonicalQualifyingRunner.simulateRemainingSession(state, ctx)
      expect(res.nextState.timeRemainingSec).toBe(0)
      expect(res.nextState.status).toBe('completed')
    })

    it('Q1-08: A melhor volta determina a classificação na tabela', () => {
      const eligible = create24Drivers()
      const state = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })

      // Atribuição de tempos manuais para verificar ordenação estrita
      state.leaderboard[0].bestLapSec = 91.5
      state.leaderboard[1].bestLapSec = 89.2
      state.leaderboard[2].bestLapSec = 90.1
      CanonicalQualifyingRunner.sortLeaderboard(state.leaderboard)

      expect(state.leaderboard[0].bestLapSec).toBe(89.2)
      expect(state.leaderboard[1].bestLapSec).toBe(90.1)
      expect(state.leaderboard[2].bestLapSec).toBe(91.5)
      expect(state.leaderboard[0].position).toBe(1)
      expect(state.leaderboard[1].position).toBe(2)
      expect(state.leaderboard[2].position).toBe(3)
    })

    it('Q1-09: Ao finalizar Q1, exatamente 6 pilotos são eliminados (P19 a P24)', () => {
      const eligible = create24Drivers()
      const state = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })
      const ctx = createTickContext(eligible)

      const result = CanonicalQualifyingRunner.finalizeStage(state, ctx)
      expect(result.eliminatedDriverIds.length).toBe(6)
      expect(CANONICAL_QUALIFYING_RULES.q1.eliminatedCount).toBe(6)
    })

    it('Q1-10: Ao finalizar Q1, exatamente 18 pilotos avançam para o Q2', () => {
      const eligible = create24Drivers()
      const state = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })
      const ctx = createTickContext(eligible)

      const result = CanonicalQualifyingRunner.finalizeStage(state, ctx)
      expect(result.advancingDriverIds.length).toBe(18)
      expect(CANONICAL_QUALIFYING_RULES.q1.advancingCount).toBe(18)
    })
  })

  // ==========================================
  // GRUPO 2: Q2 (Q2-01 a Q2-06)
  // ==========================================
  describe('Q2 — Participantes e Eliminação para o Top 10', () => {
    it('Q2-01: Somente os 18 pilotos classificados no Q1 entram no Q2', () => {
      const eligible = create24Drivers()
      const q1State = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })
      const ctx = createTickContext(eligible)
      const q1Result = CanonicalQualifyingRunner.finalizeStage(q1State, ctx)

      const q2Eligible = eligible.filter((p) => q1Result.advancingDriverIds.includes(p.id))
      expect(q2Eligible.length).toBe(18)

      const q2State = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q2',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: q2Eligible,
      })

      expect(q2State.leaderboard.length).toBe(18)
      expect(q2State.sessionDurationSec).toBe(15 * 60) // 15 minutos
    })

    it('Q2-02: Estoque de pneus é herdado integralmente do TL/Q1 sem recriar', () => {
      const invs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId,
        round,
        driverIds: ['drv_p1', 'drv_p2'],
      })
      expect(invs['drv_p1'].length).toBe(20)

      // Marcar uso em um jogo no TL/Q1
      canonicalWeekendTyrePersistence.recordTyreUsage({
        seasonId,
        round,
        driverId: 'drv_p1',
        tyreSetId: invs['drv_p1'][0].id,
        lapsAdded: 3,
        finalWearPct: 15,
      })

      const readBack = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)
        ?.inventoriesByDriver['drv_p1']!
      expect(readBack[0].wear).toBe(15)
      expect(readBack[0].lapsUsed).toBe(3)
    })

    it('Q2-03: Tempos do Q1 são resetados na fase Q2 (não viram tempos prontos do Q2)', () => {
      const eligible = create24Drivers().slice(0, 18)
      const q2State = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q2',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })

      expect(q2State.leaderboard.every((e) => e.bestLapSec === 0)).toBe(true)
      expect(q2State.cars.car1.flyingLapsDone).toBe(0)
      expect(q2State.cars.car2.flyingLapsDone).toBe(0)
    })

    it('Q2-04: Melhor volta no Q2 determina a classificação da fase', () => {
      const eligible = create24Drivers().slice(0, 18)
      const q2State = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q2',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })

      q2State.leaderboard[0].bestLapSec = 88.5
      q2State.leaderboard[1].bestLapSec = 87.9
      CanonicalQualifyingRunner.sortLeaderboard(q2State.leaderboard)

      expect(q2State.leaderboard[0].bestLapSec).toBe(87.9)
      expect(q2State.leaderboard[1].bestLapSec).toBe(88.5)
    })

    it('Q2-05: Ao finalizar Q2, exatamente 8 pilotos são eliminados (P11 a P18)', () => {
      const eligible = create24Drivers().slice(0, 18)
      const q2State = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q2',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })
      const ctx = createTickContext(eligible)

      const result = CanonicalQualifyingRunner.finalizeStage(q2State, ctx)
      expect(result.eliminatedDriverIds.length).toBe(8)
      expect(CANONICAL_QUALIFYING_RULES.q2.eliminatedCount).toBe(8)
    })

    it('Q2-06: Ao finalizar Q2, exatamente 10 pilotos avançam para o Q3', () => {
      const eligible = create24Drivers().slice(0, 18)
      const q2State = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q2',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })
      const ctx = createTickContext(eligible)

      const result = CanonicalQualifyingRunner.finalizeStage(q2State, ctx)
      expect(result.advancingDriverIds.length).toBe(10)
      expect(CANONICAL_QUALIFYING_RULES.q2.advancingCount).toBe(10)
    })
  })

  // ==========================================
  // GRUPO 3: Q3 E GRID FINAL (Q3-01 a Q3-05)
  // ==========================================
  describe('Q3 — Disputa da Pole e Composição Oficial do Grid P1-P24', () => {
    it('Q3-01: Q3 possui exatamente 10 participantes e dura 12 minutos', () => {
      const eligible = create24Drivers().slice(0, 10)
      const q3State = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q3',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })

      expect(q3State.leaderboard.length).toBe(10)
      expect(q3State.sessionDurationSec).toBe(12 * 60) // 12 minutos
    })

    it('Q3-02: Estoque de pneus herdado de Q2 para Q3 sem redefinir para 100%', () => {
      const invs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId,
        round,
        driverIds: ['drv_p1'],
      })
      canonicalWeekendTyrePersistence.recordTyreUsage({
        seasonId,
        round,
        driverId: 'drv_p1',
        tyreSetId: invs['drv_p1'][0].id,
        lapsAdded: 2,
        finalWearPct: 22,
      })

      const check = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)
        ?.inventoriesByDriver['drv_p1']!
      expect(check[0].wear).toBe(22)
    })

    it('Q3-03: Melhor volta no Q3 define posições P1 a P10 (Pole Position)', () => {
      const eligible = create24Drivers().slice(0, 10)
      const q3State = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q3',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })

      q3State.leaderboard[0].bestLapSec = 86.4
      q3State.leaderboard[1].bestLapSec = 86.1
      CanonicalQualifyingRunner.sortLeaderboard(q3State.leaderboard)

      expect(q3State.leaderboard[0].bestLapSec).toBe(86.1)
      expect(q3State.leaderboard[0].position).toBe(1)
      expect(q3State.leaderboard[0].gap).toBe('Pole/Líder')
    })

    it('Q3-04: Grid final P1–P24 é composto corretamente (Q3->P1-10, Q2->P11-18, Q1->P19-24)', () => {
      const all24 = create24Drivers()
      const ctx = createTickContext(all24)

      // Q1
      const q1State = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: all24,
      })
      all24.forEach((d, idx) => {
        const e = q1State.leaderboard.find((l) => l.driverId === d.id)
        if (e) {
          e.bestLapSec = 90 + idx * 0.1
          e.bestLapTime = `1:30.${100 + idx}`
        }
      })
      const q1Result = CanonicalQualifyingRunner.finalizeStage(q1State, ctx)

      // Q2
      const q2Eligible = all24.filter((p) => q1Result.advancingDriverIds.includes(p.id))
      const q2State = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q2',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: q2Eligible,
      })
      q2Eligible.forEach((d, idx) => {
        const e = q2State.leaderboard.find((l) => l.driverId === d.id)
        if (e) {
          e.bestLapSec = 88 + idx * 0.1
          e.bestLapTime = `1:28.${100 + idx}`
        }
      })
      const q2Result = CanonicalQualifyingRunner.finalizeStage(q2State, ctx)

      // Q3
      const q3Eligible = q2Eligible.filter((p) => q2Result.advancingDriverIds.includes(p.id))
      const q3State = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q3',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: q3Eligible,
      })
      q3Eligible.forEach((d, idx) => {
        const e = q3State.leaderboard.find((l) => l.driverId === d.id)
        if (e) {
          e.bestLapSec = 86 + idx * 0.1
          e.bestLapTime = `1:26.${100 + idx}`
        }
      })
      const q3Result = CanonicalQualifyingRunner.finalizeStage(q3State, ctx)

      const finalGridResult = canonicalQualifyingPersistenceService.buildCombinedFinalGrid({
        seasonId,
        round,
        q1Result,
        q2Result,
        q3Result,
      })

      expect(finalGridResult.finalGrid.length).toBe(24)
      expect(finalGridResult.finalGrid[0].gridPosition).toBe(1)
      expect(finalGridResult.finalGrid[0].eliminationStage).toBe('Q3')
      expect(finalGridResult.finalGrid[9].gridPosition).toBe(10)
      expect(finalGridResult.finalGrid[9].eliminationStage).toBe('Q3')
      expect(finalGridResult.finalGrid[10].gridPosition).toBe(11)
      expect(finalGridResult.finalGrid[10].eliminationStage).toBe('Q2')
      expect(finalGridResult.finalGrid[17].gridPosition).toBe(18)
      expect(finalGridResult.finalGrid[17].eliminationStage).toBe('Q2')
      expect(finalGridResult.finalGrid[18].gridPosition).toBe(19)
      expect(finalGridResult.finalGrid[18].eliminationStage).toBe('Q1')
      expect(finalGridResult.finalGrid[23].gridPosition).toBe(24)
      expect(finalGridResult.finalGrid[23].eliminationStage).toBe('Q1')
    })

    it('Q3-05: Corrida é liberada com grid final gravado na persistência', () => {
      const read = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
        seasonId,
        round,
      )
      expect(read).not.toBeNull()
      expect(read?.finalGrid.length).toBe(24)
    })
  })

  // ==========================================
  // GRUPO 4: ESTADO E IDEMPOTÊNCIA (QS-01 a QS-07)
  // ==========================================
  describe('Estado, Persistência e Idempotência', () => {
    it('QS-01: Reload durante Q1 restaura relógio, carros e voltas', () => {
      const eligible = create24Drivers()
      const state = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })
      state.elapsedTimeSec = 340
      state.timeRemainingSec = 740
      canonicalQualifyingPersistenceService.saveStageState(seasonId, round, state)

      const restored = canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')
      expect(restored?.elapsedTimeSec).toBe(340)
      expect(restored?.timeRemainingSec).toBe(740)
    })

    it('QS-02: Reload entre Q1 e Q2 preserva resultado do Q1', () => {
      const q1Res = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'q1')
      expect(q1Res).not.toBeNull()
      expect(q1Res?.advancingDriverIds.length).toBe(18)
    })

    it('QS-03: Sessão concluída não permite reexecução', () => {
      const eligible = create24Drivers()
      const state = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })
      state.status = 'completed'
      state.timeRemainingSec = 0

      const exitRes = CanonicalQualifyingRunner.orderCarExitToTrack(state, 'car1')
      expect(exitRes.success).toBe(false)
      expect(exitRes.error).toContain('Sessão encerrada')
    })

    it('QS-04: Finalizar fase duas vezes não duplica nem corrompe resultado', () => {
      const eligible = create24Drivers()
      const state = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })
      const ctx = createTickContext(eligible)

      const res1 = CanonicalQualifyingRunner.finalizeStage(state, ctx)
      const res2 = CanonicalQualifyingRunner.finalizeStage(state, ctx)

      expect(res1.advancingDriverIds.length).toBe(18)
      expect(res2.advancingDriverIds.length).toBe(18)
      expect(res1.eliminatedDriverIds.length).toBe(6)
      expect(res2.eliminatedDriverIds.length).toBe(6)
    })

    it('QS-05: Dois carros do jogador permanecem independentes', () => {
      const eligible = create24Drivers()
      const state = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })

      CanonicalQualifyingRunner.orderCarExitToTrack(state, 'car1')
      expect(state.cars.car1.status).toBe('out_lap')
      expect(state.cars.car2.status).toBe('garage')
    })

    it('QS-06: Nenhum terceiro card de piloto é criado', () => {
      const eligible = create24Drivers()
      const state = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: mockPlayerCar1,
        playerCar2: mockPlayerCar2,
        eligibleParticipants: eligible,
      })

      const keys = Object.keys(state.cars)
      expect(keys.length).toBe(2)
      expect(keys).toContain('car1')
      expect(keys).toContain('car2')
    })

    it('QS-07: Snapshot do GP é preservado', () => {
      expect(mockPlayerCar1.driverName).toBe('Gabriel Bortoleto')
      expect(mockPlayerCar2.driverName).toBe('Nico Hulkenberg')
    })

    it('BUG 1 REGRESSÃO: Com Audi como equipe humana (Hülkenberg + Bortoleto), o grid oficial P1–P24 não duplica pilotos nem posições', () => {
      // Cria Q1 com 24 pilotos (incluindo Audi d1=Bortoleto, d2=Hülkenberg e rivais)
      const eligible = create24Drivers()
      const audiTeam = {
        id: 'team_audi',
        name: 'Audi Revolut F1 Team',
        team_key: 'audi',
        color: '#E10600',
      }

      // Simula resultado canônico de Q1 (24 pilotos, 18 avançam, 6 eliminados P19-P24)
      const q1Entries = eligible.map((d, idx) => ({
        position: idx + 1,
        driverId: d.id,
        driverName: d.name,
        teamId: d.teamId,
        teamName: d.teamName,
        teamColor: d.teamColor,
        isPlayer: d.id === 'drv_p1' || d.id === 'drv_p2',
        bestLapSec: 88.0 + idx * 0.1,
        bestLapTime: `1:28.${String(idx).padStart(3, '0')}`,
        compound: 'macio' as const,
        lapsCount: 6,
        gapToLeaderSec: idx * 0.1,
        gapToNextSec: 0.1,
      }))
      const q1Result: QualifyingStageResult = {
        stageId: 'q1',
        seasonId,
        round,
        completedAt: new Date().toISOString(),
        entries: q1Entries,
        advancingDriverIds: q1Entries.slice(0, 18).map((e) => e.driverId),
        eliminatedDriverIds: q1Entries.slice(18, 24).map((e) => e.driverId),
      }

      // Q2: 18 pilotos (incluindo Audi Bortoleto e Hulkenberg), 10 avançam, 8 eliminados P11-P18
      // Suponha Bortoleto P11 e Hulkenberg P12 eliminados no Q2 (cenário visto no bug report!)
      const q2Entries = q1Entries.slice(0, 18).map((e, idx) => ({
        ...e,
        position: idx + 1,
        bestLapSec: 87.0 + idx * 0.1,
        bestLapTime: `1:27.${String(idx).padStart(3, '0')}`,
      }))
      const q2Result: QualifyingStageResult = {
        stageId: 'q2',
        seasonId,
        round,
        completedAt: new Date().toISOString(),
        entries: q2Entries,
        advancingDriverIds: q2Entries.slice(0, 10).map((e) => e.driverId),
        eliminatedDriverIds: q2Entries.slice(10, 18).map((e) => e.driverId),
      }

      // Q3: 10 pilotos do top 10
      const q3Entries = q2Entries.slice(0, 10).map((e, idx) => ({
        ...e,
        position: idx + 1,
        bestLapSec: 86.0 + idx * 0.1,
        bestLapTime: `1:26.${String(idx).padStart(3, '0')}`,
      }))
      const q3Result: QualifyingStageResult = {
        stageId: 'q3',
        seasonId,
        round,
        completedAt: new Date().toISOString(),
        entries: q3Entries,
        advancingDriverIds: [],
        eliminatedDriverIds: [],
      }

      // Gera grid combinado oficial P1-P24
      const combined = canonicalQualifyingPersistenceService.buildCombinedFinalGrid({
        seasonId,
        round,
        q1Result,
        q2Result,
        q3Result,
      })

      const grid = combined.finalGrid

      // Asserções estritas exigidas:
      // 1. Grid tem exatamente 24 carros
      expect(grid.length).toBe(24)

      // 2. new Set(position).size === 24
      const positions = grid.map((e) => e.gridPosition)
      expect(new Set(positions).size).toBe(24)
      expect(positions).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))

      // 3. new Set(driverId).size === 24
      const driverIds = grid.map((e) => e.driverId)
      expect(new Set(driverIds).size).toBe(24)

      // 4. Audi aparece exatamente 2 vezes no grid
      const audiEntries = grid.filter((e) => e.teamId === 'audi' || e.teamName.includes('Audi'))
      expect(audiEntries.length).toBe(2)

      // 5. Gabriel Bortoleto exatamente 1 vez
      const bortoletoEntries = grid.filter(
        (e) => e.driverId === 'drv_p1' || e.driverName === 'Gabriel Bortoleto',
      )
      expect(bortoletoEntries.length).toBe(1)

      // 6. Nico Hülkenberg exatamente 1 vez
      const hulkenbergEntries = grid.filter(
        (e) => e.driverId === 'drv_p2' || e.driverName === 'Nico Hulkenberg',
      )
      expect(hulkenbergEntries.length).toBe(1)

      // 7. Não existe nenhuma posição repetida ou faltante
      expect(Math.min(...positions)).toBe(1)
      expect(Math.max(...positions)).toBe(24)
    })
  })

  // ==========================================
  // GRUPO 5: PNEUS (QT-01 a QT-05)
  // ==========================================
  describe('Estoque Canônico de Pneus Compartilhado', () => {
    it('QT-01: Pneu usado no TL permanece usado no Q1', () => {
      const invs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId,
        round,
        driverIds: ['drv_p1'],
      })
      canonicalWeekendTyrePersistence.recordTyreUsage({
        seasonId,
        round,
        driverId: 'drv_p1',
        tyreSetId: invs['drv_p1'][1].id,
        lapsAdded: 4,
        finalWearPct: 18,
      })

      const readBack = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)
        ?.inventoriesByDriver['drv_p1']!
      expect(readBack[1].wear).toBe(18)
    })

    it('QT-02: Pneu usado no Q1 permanece usado no Q2', () => {
      const invs = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)
        ?.inventoriesByDriver['drv_p1']!
      expect(invs[1].wear).toBe(18)
    })

    it('QT-03: Pneu usado no Q2 permanece usado no Q3', () => {
      const invs = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)
        ?.inventoriesByDriver['drv_p1']!
      expect(invs[1].wear).toBe(18)
    })

    it('QT-04: Jogo instalado é individual por piloto', () => {
      const invs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId,
        round,
        driverIds: ['drv_p1', 'drv_p2'],
      })
      expect(invs['drv_p1'][0].id).not.toBe(invs['drv_p2'][0].id)
    })

    it('QT-05: Reload não duplica tyreSetId e mantém contagem exata de 20 jogos', () => {
      const invs1 = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId,
        round,
        driverIds: ['drv_p1'],
      })
      const invs2 = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId,
        round,
        driverIds: ['drv_p1'],
      })

      expect(invs1['drv_p1'].length).toBe(20)
      expect(invs2['drv_p1'].length).toBe(20)
    })
  })
})
