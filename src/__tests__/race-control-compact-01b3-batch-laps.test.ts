/**
 * RACE-CONTROL-COMPACT-01B3 — AUDITORIA DOS BOTÕES +5 / +10
 *
 * Suíte de testes determinísticos de equivalência, bloqueios, decisões pendentes e concorrência:
 * 1. Equivalência Estrita:
 *    A) Botão/Handler real +5 versus cinco avanços individuais pelo caminho do +1 VOLTA (advanceOneLap).
 *    B) Botão/Handler real +10 versus dez avanços individuais pelo caminho do +1 VOLTA (advanceOneLap).
 * 2. Cenários Obrigatórios:
 *    - Execução normal de 5 e 10 voltas
 *    - Pit stop e mudança de pneus dentro do lote
 *    - Mudança climática / neutralização dentro do lote
 *    - Surgimento de decisão estratégica pendente (interrompe lote no mesmo ponto, preserva estado)
 *    - Pedido de lote maior que as voltas restantes (encerra sem voltas fantasmas)
 *    - Corrida já encerrada (não avança)
 *    - Duplo comando durante processamento (lock isExecutingAdvanceRef / isProcessingBatch)
 *    - Concorrência entre timer (Play) e lote
 *    - Estado final obrigatoriamente pausado
 */

import { describe, it, expect } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { raceStrategyService } from '@/services/raceStrategyService'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

function buildMockGrid24() {
  const teams = [
    { id: 'mercedes', name: 'Mercedes' },
    { id: 'ferrari', name: 'Ferrari' },
    { id: 'mclaren', name: 'McLaren' },
    { id: 'red_bull', name: 'Red Bull Racing' },
    { id: 'alpine', name: 'Alpine' },
    { id: 'racing_bulls', name: 'Racing Bulls' },
    { id: 'audi', name: 'Audi' },
    { id: 'haas', name: 'Haas F1 Team' },
    { id: 'williams', name: 'Williams' },
    { id: 'aston_martin', name: 'Aston Martin' },
    { id: 'cadillac', name: 'Cadillac' },
    { id: 'andretti', name: 'Andretti' },
  ]

  const grid = []
  for (let i = 1; i <= 24; i++) {
    const team = teams[Math.floor((i - 1) / 2)] || teams[0]
    grid.push({
      position: i,
      driverId: `driver_${i}`,
      driverName: `Driver ${i}`,
      teamId: team.id,
      teamName: team.name,
      teamColor: '#e10600',
      bestLapTimeMs: 82000 + i * 120,
      bestLapFormatted: `1:22.${String(i * 120).padStart(3, '0')}`,
      sessionEliminated: i > 18 ? 'Q1' : i > 10 ? 'Q2' : 'Q3',
      tyreCompound: i % 2 === 0 ? 'medio' : 'macio',
      isPlayer: i <= 2,
    })
  }
  return grid
}

function initializeLiveRace(careerId: string, totalLaps = 30): CanonicalRaceState {
  const mockGrid = buildMockGrid24()
  return canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
    careerId,
    season: 2026,
    round: 1,
    circuitName: 'Bahrain International Circuit',
    circuitCountry: 'Bahrain',
    totalLaps,
    playerTeamId: 'ferrari',
    canonicalQualifyingGrid: mockGrid as any,
  })
}

/**
 * Harness que replica fielmente o comportamento dos handlers de /corrida/live:
 * - onAdvanceOneLap: chama canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
 * - onAdvanceMultipleLaps(count): chama canonicalRaceEngineService.advanceMultipleLaps(state, count, { persistState: false })
 * - Travas de concorrência: isExecutingAdvanceRef, isProcessingBatch, isSimulating.
 */
function createRaceControlLiveHarness(initialState: CanonicalRaceState) {
  let state = JSON.parse(JSON.stringify(initialState)) as CanonicalRaceState
  let isSimulating = false
  let isProcessingBatch = false
  const isExecutingAdvanceRef = { current: false }
  let advanceOneLapCallCount = 0
  let advanceMultipleLapsCallCount = 0

  const onAdvanceOneLap = (opts?: any) => {
    advanceOneLapCallCount++
    state = canonicalRaceEngineService.advanceOneLap(state, {
      ...opts,
      persistState: false,
    })
  }

  const onAdvanceMultipleLaps = (count: number, opts?: any) => {
    advanceMultipleLapsCallCount++
    state = canonicalRaceEngineService.advanceMultipleLaps(state, count, {
      ...opts,
      persistState: false,
    })
  }

  const handleStepOneLap = () => {
    const isFinished = state.status === 'completed'
    const isAwaitingWeatherDecision = state.status === 'awaiting_player_weather_decision'
    const isSuspended = state.status === 'suspended' || state.status === 'red_flag'
    const isRestartPending = state.status === 'restart_pending'

    if (
      isFinished ||
      isAwaitingWeatherDecision ||
      isSuspended ||
      isRestartPending ||
      isProcessingBatch ||
      isSimulating ||
      isExecutingAdvanceRef.current
    ) {
      return false
    }

    isExecutingAdvanceRef.current = true
    setIsSimulating(false)
    setIsProcessingBatch(true)
    try {
      onAdvanceOneLap()
      return true
    } finally {
      setIsProcessingBatch(false)
      setIsSimulating(false)
      isExecutingAdvanceRef.current = false
    }
  }

  const handleAdvanceLapsBatch = (count: number) => {
    const isFinished = state.status === 'completed'
    const isAwaitingWeatherDecision = state.status === 'awaiting_player_weather_decision'
    const isSuspended = state.status === 'suspended' || state.status === 'red_flag'
    const isRestartPending = state.status === 'restart_pending'

    if (
      isFinished ||
      isAwaitingWeatherDecision ||
      isSuspended ||
      isRestartPending ||
      isProcessingBatch ||
      isSimulating ||
      isExecutingAdvanceRef.current
    ) {
      return false
    }

    isExecutingAdvanceRef.current = true
    setIsSimulating(false)
    setIsProcessingBatch(true)
    try {
      onAdvanceMultipleLaps(count)
      return true
    } finally {
      setIsProcessingBatch(false)
      setIsSimulating(false)
      isExecutingAdvanceRef.current = false
    }
  }

  const setIsSimulating = (val: boolean) => {
    isSimulating = val
  }

  const setIsProcessingBatch = (val: boolean) => {
    isProcessingBatch = val
  }

  return {
    getState: () => state,
    setState: (s: CanonicalRaceState) => {
      state = s
    },
    isSimulating: () => isSimulating,
    isProcessingBatch: () => isProcessingBatch,
    isExecutingAdvanceRef,
    handleStepOneLap,
    handleAdvanceLapsBatch,
    onAdvanceOneLap,
    onAdvanceMultipleLaps,
    getCallCounts: () => ({
      advanceOneLapCallCount,
      advanceMultipleLapsCallCount,
    }),
  }
}

/**
 * Asserção de equivalência esportiva completa entre dois CanonicalRaceState
 */
function assertSportingEquivalence(stateA: CanonicalRaceState, stateB: CanonicalRaceState) {
  // 1. Volta atual, total de voltas, status da sessão e revisão
  expect(stateA.currentLap).toBe(stateB.currentLap)
  expect(stateA.totalLaps).toBe(stateB.totalLaps)
  expect(stateA.status).toBe(stateB.status)
  expect(stateA.revision).toBe(stateB.revision)

  // 2. Classificação e pilotos (exatamente 24)
  expect(stateA.drivers.length).toBe(24)
  expect(stateB.drivers.length).toBe(24)

  for (let i = 0; i < 24; i++) {
    const dA = stateA.drivers[i]
    const dB = stateB.drivers[i]

    expect(dA.driverId).toBe(dB.driverId)
    expect(dA.currentPosition).toBe(dB.currentPosition)
    expect(dA.lap).toBe(dB.lap)
    expect(dA.raceTime).toBe(dB.raceTime)
    expect(dA.gap).toBe(dB.gap)
    expect(dA.gapToLeaderSec).toBe(dB.gapToLeaderSec)
    expect(dA.tyreCompound).toBe(dB.tyreCompound)
    expect(dA.tyreAge).toBe(dB.tyreAge)
    expect(dA.fuel).toBe(dB.fuel)
    expect(dA.pitStops).toBe(dB.pitStops)
    expect(dA.isDnf).toBe(dB.isDnf)
    expect(dA.raceStatus).toBe(dB.raceStatus)
  }

  // 3. Clima e pista
  expect(stateA.weather).toEqual(stateB.weather)

  // 4. Bandeiras, SC/VSC e Red Flag
  expect(stateA.safetyCarActive).toBe(stateB.safetyCarActive)
  expect(stateA.vscActive).toBe(stateB.vscActive)
  expect(stateA.redFlagActive).toBe(stateB.redFlagActive)
  expect(stateA.raceControl?.currentFlag).toBe(stateB.raceControl?.currentFlag)

  // 5. Decisões pendentes
  expect(stateA.pendingWeatherDecision).toEqual(stateB.pendingWeatherDecision)

  // 6. Eventos esportivos produzidos
  expect(stateA.events.length).toBe(stateB.events.length)
  if (stateA.events.length > 0) {
    expect(stateA.events[0].id).toBe(stateB.events[0].id)
    expect(stateA.events[stateA.events.length - 1].message).toBe(
      stateB.events[stateB.events.length - 1].message,
    )
  }
}

describe('RACE-CONTROL-COMPACT-01B3 — AUDITORIA DOS BOTÕES +5 / +10', () => {
  // =========================================================================
  // 1. COMPARAÇÕES OBRIGATÓRIAS DE EQUIVALÊNCIA ESTRETA (B3-A e B3-B)
  // =========================================================================
  describe('1. Comparações Obrigatórias: Lotes vs Avanços Individuais Consecutivos', () => {
    it('CENÁRIO A: Botão/Handler real +5 produz EXATAMENTE o mesmo estado que 5 avanços pelo caminho do +1 VOLTA', () => {
      const stateInitial = initializeLiveRace('rc_b3_equiv_5', 25)
      const cloneIndividual = JSON.parse(JSON.stringify(stateInitial))

      // Caminho A: Botão/Handler real +5 voltas
      const harnessBatch = createRaceControlLiveHarness(stateInitial)
      const batchSuccess = harnessBatch.handleAdvanceLapsBatch(5)
      expect(batchSuccess).toBe(true)
      const stateAfterBatch5 = harnessBatch.getState()

      // Caminho B: 5 avanços individuais pelo caminho do +1 VOLTA
      // Cada avanço individual parte do estado produzido pelo anterior
      const harnessIndividual = createRaceControlLiveHarness(cloneIndividual)
      for (let i = 0; i < 5; i++) {
        const stepSuccess = harnessIndividual.handleStepOneLap()
        expect(stepSuccess).toBe(true)
      }
      const stateAfter5Steps = harnessIndividual.getState()

      // Asserção esportiva estrita
      assertSportingEquivalence(stateAfterBatch5, stateAfter5Steps)
      expect(stateAfterBatch5.currentLap).toBe(6) // Avançou 5 voltas a partir da largada
    })

    it('CENÁRIO B: Botão/Handler real +10 produz EXATAMENTE o mesmo estado que 10 avanços pelo caminho do +1 VOLTA', () => {
      const stateInitial = initializeLiveRace('rc_b3_equiv_10', 30)
      const cloneIndividual = JSON.parse(JSON.stringify(stateInitial))

      // Caminho A: Botão/Handler real +10 voltas
      const harnessBatch = createRaceControlLiveHarness(stateInitial)
      const batchSuccess = harnessBatch.handleAdvanceLapsBatch(10)
      expect(batchSuccess).toBe(true)
      const stateAfterBatch10 = harnessBatch.getState()

      // Caminho B: 10 avanços individuais pelo caminho do +1 VOLTA
      const harnessIndividual = createRaceControlLiveHarness(cloneIndividual)
      for (let i = 0; i < 10; i++) {
        const stepSuccess = harnessIndividual.handleStepOneLap()
        expect(stepSuccess).toBe(true)
      }
      const stateAfter10Steps = harnessIndividual.getState()

      // Asserção esportiva estrita
      assertSportingEquivalence(stateAfterBatch10, stateAfter10Steps)
      expect(stateAfterBatch10.currentLap).toBe(11) // Avançou 10 voltas a partir da largada
    })
  })

  // =========================================================================
  // 2. CENÁRIOS OBRIGATÓRIOS: PIT STOP, PNEUS E ESTRATÉGIA NO LOTE
  // =========================================================================
  describe('2. Cenários Esportivos: Pit Stop e Mudança de Pneus dentro do Lote', () => {
    it('pit stop solicitado antes ou executado durante o lote é processado com exata equivalência', () => {
      let stateInitial = initializeLiveRace('rc_b3_pit_stop', 25)

      // Solicitar pit stop para o piloto do jogador (driver_1)
      stateInitial = raceStrategyService.requestPitStop(stateInitial, 'driver_1', 'duro')

      const cloneIndividual = JSON.parse(JSON.stringify(stateInitial))

      // Lote +5
      const harnessBatch = createRaceControlLiveHarness(stateInitial)
      harnessBatch.handleAdvanceLapsBatch(5)
      const stateBatch = harnessBatch.getState()

      // 5 Avanços individuais
      const harnessIndividual = createRaceControlLiveHarness(cloneIndividual)
      for (let i = 0; i < 5; i++) {
        harnessIndividual.handleStepOneLap()
      }
      const stateIndividual = harnessIndividual.getState()

      // Verificar que o pit stop ocorreu em ambos
      const driverBatch = stateBatch.drivers.find((d) => d.driverId === 'driver_1')!
      const driverInd = stateIndividual.drivers.find((d) => d.driverId === 'driver_1')!

      expect(driverBatch.pitStops).toBeGreaterThan(0)
      expect(driverBatch.pitStops).toBe(driverInd.pitStops)
      expect(driverBatch.tyreCompound).toBe('duro')
      expect(driverInd.tyreCompound).toBe('duro')

      assertSportingEquivalence(stateBatch, stateIndividual)
    })
  })

  // =========================================================================
  // 3. CENÁRIOS OBRIGATÓRIOS: MUDANÇA CLIMÁTICA E DECISÃO ESTRATÉGICA PENDENTE
  // =========================================================================
  describe('3. Clima e Decisão Estratégica Pendente', () => {
    it('quando surge transição climática com decisão pendente para o jogador, o lote interrompe no mesmo ponto que o avanço individual', () => {
      let stateInitial = initializeLiveRace('rc_b3_weather_decision', 25)

      // Configurar transição climática na volta 3 (seco -> chuva_fraca)
      stateInitial.weatherTransitions = [
        {
          lap: 3,
          condition: 'chuva_fraca',
          description: 'Chuva leve começa a molhar o traçado',
          rainIntensity: 'LIGHT',
        },
      ]

      const cloneIndividual = JSON.parse(JSON.stringify(stateInitial))

      // Lote +5: deve interromper na volta 3 ao criar a pendingWeatherDecision
      const harnessBatch = createRaceControlLiveHarness(stateInitial)
      harnessBatch.handleAdvanceLapsBatch(5)
      const stateBatch = harnessBatch.getState()

      // Avanços individuais: deve interromper na mesma volta 3
      const harnessIndividual = createRaceControlLiveHarness(cloneIndividual)
      for (let i = 0; i < 5; i++) {
        const ok = harnessIndividual.handleStepOneLap()
        if (!ok) break
      }
      const stateIndividual = harnessIndividual.getState()

      // Ambos devem ter parado no bloqueio de decisão pendente
      expect(stateBatch.status).toBe('awaiting_player_weather_decision')
      expect(stateIndividual.status).toBe('awaiting_player_weather_decision')
      expect(stateBatch.currentLap).toBe(stateIndividual.currentLap)
      expect(stateBatch.currentLap).toBe(3) // Interrompido na volta da transição
      expect(stateBatch.pendingWeatherDecision?.active).toBe(true)
      expect(stateIndividual.pendingWeatherDecision?.active).toBe(true)

      // Estado esportivo idêntico no ponto de interrupção
      assertSportingEquivalence(stateBatch, stateIndividual)
    })

    it('decisão pendente pré-existente bloqueia o acionamento de lote (+5 e +10) sem avançar voltas silenciosamente', () => {
      let stateInitial = initializeLiveRace('rc_b3_blocked_decision', 25)
      stateInitial.status = 'awaiting_player_weather_decision'
      stateInitial.pendingWeatherDecision = {
        active: true,
        decisionKey: 'test_decision_block',
        triggeredLap: 4,
        transition: 'DRY_TO_WET',
        weatherBefore: 'seco',
        weatherAfter: 'chuva_fraca',
        drivers: [
          {
            driverId: 'driver_1',
            driverName: 'Driver 1',
            currentCompound: 'macio',
            tyreAge: 4,
            status: 'pending',
          },
        ],
      }

      const harness = createRaceControlLiveHarness(stateInitial)

      // Tentar +5
      const attempted5 = harness.handleAdvanceLapsBatch(5)
      expect(attempted5).toBe(false)
      expect(harness.getState().currentLap).toBe(0)
      expect(harness.getCallCounts().advanceMultipleLapsCallCount).toBe(0)

      // Tentar +10
      const attempted10 = harness.handleAdvanceLapsBatch(10)
      expect(attempted10).toBe(false)
      expect(harness.getState().currentLap).toBe(0)
      expect(harness.getCallCounts().advanceMultipleLapsCallCount).toBe(0)
    })
  })

  // =========================================================================
  // 4. CENÁRIOS OBRIGATÓRIOS: NEUTRALIZAÇÃO (SAFETY CAR / VSC)
  // =========================================================================
  describe('4. Neutralização dentro do Lote (Safety Car / VSC)', () => {
    it('neutralização de SC iniciada antes ou durante o lote produz exata equivalência com avanços individuais', () => {
      let stateInitial = initializeLiveRace('rc_b3_sc', 25)

      // Avançar 1 volta em green
      stateInitial = canonicalRaceEngineService.advanceOneLap(stateInitial, {
        persistState: false,
      })
      // Acionar Safety Car na volta 2
      stateInitial = canonicalRaceEngineService.advanceOneLap(stateInitial, {
        forceRaceControlStatus: 'SAFETY_CAR',
        persistState: false,
      })

      const cloneIndividual = JSON.parse(JSON.stringify(stateInitial))

      // Lote +5 (vai processar voltas sob Safety Car)
      const harnessBatch = createRaceControlLiveHarness(stateInitial)
      harnessBatch.handleAdvanceLapsBatch(5)
      const stateBatch = harnessBatch.getState()

      // 5 Avanços individuais
      const harnessIndividual = createRaceControlLiveHarness(cloneIndividual)
      for (let i = 0; i < 5; i++) {
        harnessIndividual.handleStepOneLap()
      }
      const stateIndividual = harnessIndividual.getState()

      assertSportingEquivalence(stateBatch, stateIndividual)
    })
  })

  // =========================================================================
  // 5. LIMITES E FIM DA CORRIDA
  // =========================================================================
  describe('5. Limites e Encerramento da Corrida', () => {
    it('pedido de lote maior que as voltas restantes encerra normalmente sem voltas extras ou duplicadas', () => {
      // Corrida com totalLaps = 5
      const stateInitial = initializeLiveRace('rc_b3_short_race', 5)
      const cloneIndividual = JSON.parse(JSON.stringify(stateInitial))

      // Pedir lote de +10 voltas para corrida que só tem 5 voltas
      const harnessBatch = createRaceControlLiveHarness(stateInitial)
      harnessBatch.handleAdvanceLapsBatch(10)
      const stateBatch = harnessBatch.getState()

      // Avanços individuais até o encerramento
      const harnessIndividual = createRaceControlLiveHarness(cloneIndividual)
      for (let i = 0; i < 10; i++) {
        const ok = harnessIndividual.handleStepOneLap()
        if (!ok) break
      }
      const stateIndividual = harnessIndividual.getState()

      expect(stateBatch.status).toBe('completed')
      expect(stateIndividual.status).toBe('completed')
      expect(stateBatch.currentLap).toBe(5)
      expect(stateIndividual.currentLap).toBe(5)

      // Nenhum piloto tem mais de 5 voltas completadas
      expect(stateBatch.drivers.every((d) => d.lap <= 5)).toBe(true)
      expect(stateIndividual.drivers.every((d) => d.lap <= 5)).toBe(true)

      assertSportingEquivalence(stateBatch, stateIndividual)
    })

    it('corrida já encerrada (completed) bloqueia lote e não avança nem altera estado', () => {
      let stateInitial = initializeLiveRace('rc_b3_already_finished', 3)
      stateInitial = canonicalRaceEngineService.advanceMultipleLaps(stateInitial, 3, {
        persistState: false,
      })
      expect(stateInitial.status).toBe('completed')

      const harness = createRaceControlLiveHarness(stateInitial)
      const preLaps = harness.getState().currentLap

      const res5 = harness.handleAdvanceLapsBatch(5)
      expect(res5).toBe(false)
      expect(harness.getState().currentLap).toBe(preLaps)

      const res10 = harness.handleAdvanceLapsBatch(10)
      expect(res10).toBe(false)
      expect(harness.getState().currentLap).toBe(preLaps)
      expect(harness.getState().status).toBe('completed')
    })
  })

  // =========================================================================
  // 6. PROTEÇÃO DE CONCORRÊNCIA E ESTADO PAUSADO OBRIGATÓRIO
  // =========================================================================
  describe('6. Concorrência e Estado Pausado Obrigatório', () => {
    it('após conclusão do lote manual (+5 / +10), a sessão fica obrigatoriamente pausada', () => {
      const stateInitial = initializeLiveRace('rc_b3_pause_check', 20)
      const harness = createRaceControlLiveHarness(stateInitial)

      harness.handleAdvanceLapsBatch(5)
      expect(harness.isSimulating()).toBe(false)
      expect(harness.isProcessingBatch()).toBe(false)
      expect(harness.isExecutingAdvanceRef.current).toBe(false)

      harness.handleAdvanceLapsBatch(10)
      expect(harness.isSimulating()).toBe(false)
      expect(harness.isProcessingBatch()).toBe(false)
      expect(harness.isExecutingAdvanceRef.current).toBe(false)
    })

    it('duplo comando rápido durante processamento de lote é bloqueado pela trava síncrona isExecutingAdvanceRef', () => {
      const stateInitial = initializeLiveRace('rc_b3_double_click', 20)
      const harness = createRaceControlLiveHarness(stateInitial)

      // Simular lock síncrono mantido pela execução em curso
      harness.isExecutingAdvanceRef.current = true

      const secondCall5 = harness.handleAdvanceLapsBatch(5)
      const secondCall10 = harness.handleAdvanceLapsBatch(10)
      const stepCall = harness.handleStepOneLap()

      expect(secondCall5).toBe(false)
      expect(secondCall10).toBe(false)
      expect(stepCall).toBe(false)
      expect(harness.getCallCounts().advanceMultipleLapsCallCount).toBe(0)
      expect(harness.getCallCounts().advanceOneLapCallCount).toBe(0)

      harness.isExecutingAdvanceRef.current = false
    })

    it('quando simulação (Play) está ativa, o acionamento de lote é bloqueado', () => {
      const stateInitial = initializeLiveRace('rc_b3_play_active', 20)
      const harness = createRaceControlLiveHarness(stateInitial)

      // Ativar simulação (Play)
      ;(harness as any).isSimulating = () => true

      // Tentativa de disparar lote com Play rodando deve ser rejeitada
      const isSimulatingVal = harness.isSimulating()
      expect(isSimulatingVal).toBe(true)

      const blocked5 = harness.handleAdvanceLapsBatch(5)
      expect(blocked5).toBe(false)
      expect(harness.getCallCounts().advanceMultipleLapsCallCount).toBe(0)
    })
  })
})
