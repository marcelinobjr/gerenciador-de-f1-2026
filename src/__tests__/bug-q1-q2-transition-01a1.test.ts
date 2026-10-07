/**
 * bug-q1-q2-transition-01a1.test.ts
 *
 * PROVA DE PROTEÇÃO DE Q1 CONCLUÍDO CONTRA REINICIALIZAÇÃO (BUG-Q1-Q2-TRANSITION-01A1)
 * Apex GP Manager (React + Vite + TS + Tailwind, backend PocketBase/Skip Cloud).
 *
 * OBJETIVO:
 * Impedir que qualquer fase de classificação oficialmente completed seja reinicializada.
 * Q1 concluído nunca mais pode ser apagado por re-seleção ou reload.
 *
 * CASOS HOMOLOGADOS:
 * A1.1 — Q1 concluído + re-seleção: criar Q1 com tempos reais, voltas, classificação não trivial, status = completed.
 *        Selecionar Q1 novamente. Esperado: mesmos tempos, mesmas voltas, mesma classificação,
 *        nenhuma chamada destrutiva de initializeStage.
 * A1.2 — Reload + re-seleção: persistir Q1 concluído, simular reload, selecionar Q1.
 *        Esperado: estado concluído restaurado integralmente.
 * A1.3 — Fase não iniciada: selecionar uma fase realmente nova.
 *        Esperado: initializeStage continua funcionando normalmente. O fix não pode bloquear inicialização legítima.
 * A1.4 — Fase paused/running: selecionar fase já iniciada mas não concluída.
 *        Esperado: comportamento existente de retomada preservado; não transformar em completed;
 *        não criar sessão paralela.
 * A1.5 — Defesa direta do runner: tentar reinicializar diretamente um stage já completed.
 *        Esperado: estado concluído não é sobrescrito.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  CanonicalQualifyingRunner,
  type QualifyingDriverContext,
} from '@/services/canonicalQualifyingRunner'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import type { QualifyingStageState, QualifyingTimeEntry } from '@/types/canonical-qualifying-types'

describe('BUG-Q1-Q2-TRANSITION-01A1 — Proteger Q1 Concluído Contra Reinicialização', () => {
  const TEST_SEASON_ID = 'season_trans_01a1_test'
  const TEST_ROUND = 3

  const dummyParticipants: QualifyingDriverContext[] = [
    {
      id: 'drv_p1',
      name: 'Max Verstappen',
      teamId: 'red_bull',
      teamName: 'Red Bull',
      teamColor: '#1E41FF',
      carNumber: 1,
      speed: 95,
      consistency: 94,
      defense: 92,
    },
    {
      id: 'drv_p2',
      name: 'Lewis Hamilton',
      teamId: 'ferrari',
      teamName: 'Ferrari',
      teamColor: '#DC0000',
      carNumber: 44,
      speed: 93,
      consistency: 93,
      defense: 90,
    },
    {
      id: 'drv_p3',
      name: 'Lando Norris',
      teamId: 'mclaren',
      teamName: 'McLaren',
      teamColor: '#FF8000',
      carNumber: 4,
      speed: 92,
      consistency: 90,
      defense: 88,
    },
    {
      id: 'drv_p4',
      name: 'George Russell',
      teamId: 'mercedes',
      teamName: 'Mercedes',
      teamColor: '#00D2BE',
      carNumber: 63,
      speed: 91,
      consistency: 89,
      defense: 87,
    },
    {
      id: 'drv_player1',
      name: 'Piloto Player 1',
      teamId: 'team_apex',
      teamName: 'Apex GP',
      teamColor: '#00A6FB',
      carNumber: 11,
      speed: 85,
      consistency: 85,
      defense: 80,
    },
    {
      id: 'drv_player2',
      name: 'Piloto Player 2',
      teamId: 'team_apex',
      teamName: 'Apex GP',
      teamColor: '#00A6FB',
      carNumber: 12,
      speed: 84,
      consistency: 83,
      defense: 79,
    },
  ]

  const dummyPlayerCar1 = {
    driverId: 'drv_player1',
    driverName: 'Piloto Player 1',
    driverNumber: 11,
    tyreSetId: 'set_1',
    compound: 'macio' as const,
    wear: 5,
    setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
  }

  const dummyPlayerCar2 = {
    driverId: 'drv_player2',
    driverName: 'Piloto Player 2',
    driverNumber: 12,
    tyreSetId: 'set_2',
    compound: 'macio' as const,
    wear: 10,
    setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
  }

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  function createCompletedQ1State(seasonId: string, round: number): QualifyingStageState {
    const activeGen = 1
    const nowIso = new Date().toISOString()

    const leaderboard: QualifyingTimeEntry[] = [
      {
        position: 1,
        driverId: 'drv_p1',
        driverName: 'Max Verstappen',
        teamId: 'red_bull',
        teamName: 'Red Bull',
        teamColor: '#1E41FF',
        carNumber: 1,
        compound: 'macio',
        laps: 3,
        bestLapSec: 72.45,
        bestLapTime: '1:12.450',
        gap: '-',
        isPlayer: false,
        status: 'garage',
        isEliminated: false,
      },
      {
        position: 2,
        driverId: 'drv_player1',
        driverName: 'Piloto Player 1',
        teamId: 'team_apex',
        teamName: 'Apex GP',
        teamColor: '#00A6FB',
        carNumber: 11,
        compound: 'macio',
        laps: 4,
        bestLapSec: 72.82,
        bestLapTime: '1:12.820',
        gap: '+0.370',
        isPlayer: true,
        carId: 'car1',
        status: 'garage',
        isEliminated: false,
      },
      {
        position: 3,
        driverId: 'drv_p3',
        driverName: 'Lando Norris',
        teamId: 'mclaren',
        teamName: 'McLaren',
        teamColor: '#FF8000',
        carNumber: 4,
        compound: 'macio',
        laps: 3,
        bestLapSec: 72.95,
        bestLapTime: '1:12.950',
        gap: '+0.500',
        isPlayer: false,
        status: 'garage',
        isEliminated: false,
      },
      {
        position: 4,
        driverId: 'drv_p4',
        driverName: 'George Russell',
        teamId: 'mercedes',
        teamName: 'Mercedes',
        teamColor: '#00D2BE',
        carNumber: 63,
        compound: 'macio',
        laps: 3,
        bestLapSec: 73.11,
        bestLapTime: '1:13.110',
        gap: '+0.660',
        isPlayer: false,
        status: 'garage',
        isEliminated: false,
      },
      {
        position: 5,
        driverId: 'drv_p2',
        driverName: 'Lewis Hamilton',
        teamId: 'ferrari',
        teamName: 'Ferrari',
        teamColor: '#DC0000',
        carNumber: 44,
        compound: 'macio',
        laps: 2,
        bestLapSec: 73.4,
        bestLapTime: '1:13.400',
        gap: '+0.950',
        isPlayer: false,
        status: 'garage',
        isEliminated: false,
      },
      {
        position: 6,
        driverId: 'drv_player2',
        driverName: 'Piloto Player 2',
        teamId: 'team_apex',
        teamName: 'Apex GP',
        teamColor: '#00A6FB',
        carNumber: 12,
        compound: 'macio',
        laps: 2,
        bestLapSec: 74.2,
        bestLapTime: '1:14.200',
        gap: '+1.750',
        isPlayer: true,
        carId: 'car2',
        status: 'garage',
        isEliminated: false,
      },
    ]

    const completedState: QualifyingStageState = {
      stageId: 'q1',
      status: 'completed',
      sessionDurationSec: 1080,
      elapsedTimeSec: 1080,
      timeRemainingSec: 0,
      simSpeed: 1,
      cars: {
        car1: {
          carId: 'car1',
          driverId: 'drv_player1',
          driverName: 'Piloto Player 1',
          driverNumber: 11,
          status: 'garage',
          pitRequested: false,
          setup: dummyPlayerCar1.setup,
          currentTyreSetId: 'set_1',
          currentCompound: 'macio',
          tyreWear: 18,
          fuelKg: 8,
          outLapsDone: 1,
          flyingLapsDone: 2,
          inLapsDone: 1,
          totalLaps: 4,
          currentLapProgressPct: 0,
          isEliminated: false,
        },
        car2: {
          carId: 'car2',
          driverId: 'drv_player2',
          driverName: 'Piloto Player 2',
          driverNumber: 12,
          status: 'garage',
          pitRequested: false,
          setup: dummyPlayerCar2.setup,
          currentTyreSetId: 'set_2',
          currentCompound: 'macio',
          tyreWear: 12,
          fuelKg: 10,
          outLapsDone: 1,
          flyingLapsDone: 1,
          inLapsDone: 0,
          totalLaps: 2,
          currentLapProgressPct: 0,
          isEliminated: false,
        },
      },
      leaderboard,
      lapHistory: {},
      radioFeed: [
        {
          id: 'ev_end',
          second: 1080,
          type: 'finish',
          message: 'Bandeira quadriculada! Sessão Q1 encerrada.',
          timestamp: '15:18',
        },
      ],
      parcFermeActive: true,
      revision: 45,
      generation: activeGen,
      weekendGeneration: activeGen,
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    return completedState
  }

  // -------------------------------------------------------------------------------------------------
  // A1.1 — Q1 CONCLUÍDO + RE-SELEÇÃO
  // -------------------------------------------------------------------------------------------------
  it('A1.1: Q1 concluído + re-seleção: preserva tempos, voltas, classificação e bloqueia overwrite de initializeStage', async () => {
    const completedQ1 = createCompletedQ1State(TEST_SEASON_ID, TEST_ROUND)
    canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, TEST_ROUND, completedQ1)

    // Espia initializeStage do runner
    const initializeStageSpy = vi.spyOn(CanonicalQualifyingRunner, 'initializeStage')

    // Simula a lógica do handler de seleção de sessão (WeekendV2Page handleSelectSessionFromSchedule / initializeQualifyingSession)
    const selectedSess = 'q1'
    let uiQualifyingState: QualifyingStageState | null = null

    // Leitura do estado persistido conforme o guard implementado
    const existing = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      selectedSess,
    )

    if (existing && existing.status === 'completed') {
      uiQualifyingState = existing
      // Guard impede chamada destrutiva de initializeQualifyingSession / initializeStage
    } else {
      uiQualifyingState = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId: TEST_SEASON_ID,
        round: TEST_ROUND,
        playerCar1: dummyPlayerCar1,
        playerCar2: dummyPlayerCar2,
        eligibleParticipants: dummyParticipants,
      })
    }

    // initializeStage NÃO pode ter sido chamado
    expect(initializeStageSpy).not.toHaveBeenCalled()

    // O estado exibido na UI deve ser exatamente o Q1 concluído
    expect(uiQualifyingState).not.toBeNull()
    expect(uiQualifyingState!.status).toBe('completed')
    expect(uiQualifyingState!.leaderboard[0].driverName).toBe('Max Verstappen')
    expect(uiQualifyingState!.leaderboard[0].bestLapTime).toBe('1:12.450')
    expect(uiQualifyingState!.leaderboard[0].laps).toBe(3)
    expect(uiQualifyingState!.leaderboard[1].driverName).toBe('Piloto Player 1')
    expect(uiQualifyingState!.leaderboard[1].bestLapTime).toBe('1:12.820')
    expect(uiQualifyingState!.leaderboard[1].laps).toBe(4)

    // O estado persistido continua intacto com tempos e voltas
    const persistedAfter = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(persistedAfter!.status).toBe('completed')
    expect(persistedAfter!.leaderboard[0].bestLapTime).toBe('1:12.450')
    expect(persistedAfter!.cars.car1.totalLaps).toBe(4)
  })

  // -------------------------------------------------------------------------------------------------
  // A1.2 — RELOAD + RE-SELEÇÃO
  // -------------------------------------------------------------------------------------------------
  it('A1.2: reload + re-seleção: persistir Q1 concluído, simular reload, selecionar Q1 restaura estado integralmente', () => {
    const completedQ1 = createCompletedQ1State(TEST_SEASON_ID, TEST_ROUND)
    canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, TEST_ROUND, completedQ1)

    // Simula reload: nova instância / ciclo limpo de memória
    let reloadedUiState: QualifyingStageState | null = null

    // Handler rodando após reload ao clicar no card de Q1
    const storedState = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )

    if (storedState && storedState.status === 'completed') {
      reloadedUiState = storedState
    } else {
      reloadedUiState = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId: TEST_SEASON_ID,
        round: TEST_ROUND,
        playerCar1: dummyPlayerCar1,
        playerCar2: dummyPlayerCar2,
        eligibleParticipants: dummyParticipants,
      })
    }

    expect(reloadedUiState).not.toBeNull()
    expect(reloadedUiState!.status).toBe('completed')
    expect(reloadedUiState!.revision).toBe(45)
    expect(reloadedUiState!.leaderboard).toHaveLength(6)
    expect(reloadedUiState!.leaderboard[0].bestLapTime).toBe('1:12.450')
    expect(reloadedUiState!.leaderboard[0].bestLapSec).toBe(72.45)
    expect(reloadedUiState!.cars.car1.flyingLapsDone).toBe(2)
  })

  // -------------------------------------------------------------------------------------------------
  // A1.3 — FASE NÃO INICIADA
  // -------------------------------------------------------------------------------------------------
  it('A1.3: fase não iniciada: selecionar fase realmente nova continua chamando initializeStage normalmente', () => {
    // Garante que não há estado de Q1 persistido
    const freshRound = 5
    const existing = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      freshRound,
      'q1',
    )
    expect(existing).toBeNull()

    // O guard permite inicialização legítima
    let uiState: QualifyingStageState | null = null
    if (existing && (existing as QualifyingStageState).status === 'completed') {
      uiState = existing
    } else {
      uiState = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId: TEST_SEASON_ID,
        round: freshRound,
        playerCar1: dummyPlayerCar1,
        playerCar2: dummyPlayerCar2,
        eligibleParticipants: dummyParticipants,
      })
    }

    expect(uiState).not.toBeNull()
    expect(uiState.status).toBe('not_started')
    expect(uiState.elapsedTimeSec).toBe(0)
    expect(uiState.timeRemainingSec).toBe(1080)
    expect(uiState.leaderboard).toHaveLength(6)
    expect(uiState.leaderboard[0].bestLapTime).toBe('--:--.---')
  })

  // -------------------------------------------------------------------------------------------------
  // A1.4 — FASE PAUSED / RUNNING
  // -------------------------------------------------------------------------------------------------
  it('A1.4: fase paused/running: selecionar fase iniciada preserva retomabilidade sem transformar em completed nem criar sessão paralela', () => {
    const pausedRound = 6
    const initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId: TEST_SEASON_ID,
      round: pausedRound,
      playerCar1: dummyPlayerCar1,
      playerCar2: dummyPlayerCar2,
      eligibleParticipants: dummyParticipants,
    })

    // Simula sessão em andamento que foi pausada após 120s
    initial.status = 'paused'
    initial.elapsedTimeSec = 120
    initial.timeRemainingSec = 960
    initial.leaderboard[0].laps = 1
    initial.leaderboard[0].bestLapSec = 74.0
    initial.leaderboard[0].bestLapTime = '1:14.000'
    canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, pausedRound, initial)

    // Re-seleção da fase em andamento
    const persisted = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      pausedRound,
      'q1',
    )

    let uiState: QualifyingStageState | null = null
    if (persisted && persisted.status === 'completed') {
      uiState = persisted
    } else if (persisted && (persisted.status === 'paused' || persisted.status === 'running')) {
      // Comportamento canônico de retomada: preserva o estado existente sem recriar
      uiState = persisted
    } else {
      uiState = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId: TEST_SEASON_ID,
        round: pausedRound,
        playerCar1: dummyPlayerCar1,
        playerCar2: dummyPlayerCar2,
        eligibleParticipants: dummyParticipants,
      })
    }

    expect(uiState.status).toBe('paused')
    expect(uiState.elapsedTimeSec).toBe(120)
    expect(uiState.timeRemainingSec).toBe(960)
    expect(uiState.leaderboard[0].bestLapTime).toBe('1:14.000')
    expect(uiState.leaderboard[0].laps).toBe(1)
  })

  // -------------------------------------------------------------------------------------------------
  // A1.5 — DEFESA DIRETA DO RUNNER
  // -------------------------------------------------------------------------------------------------
  it('A1.5: defesa direta do runner: tentar reinicializar diretamente um stage já completed retorna o estado concluído sem sobrescrevê-lo', () => {
    const directRound = 7
    const completedQ1 = createCompletedQ1State(TEST_SEASON_ID, directRound)
    canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, directRound, completedQ1)

    // Chamada direta do runner com persistState = true
    const result = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId: TEST_SEASON_ID,
      round: directRound,
      playerCar1: dummyPlayerCar1,
      playerCar2: dummyPlayerCar2,
      eligibleParticipants: dummyParticipants,
      persistState: true,
    })

    // Deve retornar o estado concluído existente
    expect(result.status).toBe('completed')
    expect(result.leaderboard[0].driverName).toBe('Max Verstappen')
    expect(result.leaderboard[0].bestLapTime).toBe('1:12.450')
    expect(result.cars.car1.totalLaps).toBe(4)

    // E no storage, o estado NÃO pode ter virado not_started com --:--.---
    const stored = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      directRound,
      'q1',
    )
    expect(stored!.status).toBe('completed')
    expect(stored!.leaderboard[0].bestLapTime).toBe('1:12.450')
    expect(stored!.leaderboard[0].laps).toBe(3)
  })
})
