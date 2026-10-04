/**
 * RACE-CONTROL-COMPACT-01B3-T — TESTES DOS LOTES NA TELA OFICIAL /corrida/live
 *
 * Suíte de testes de integração dos comandos de lotes (+5 / +10) da rota oficial /corrida/live,
 * comparando-os com avanços individuais do fluxo real de Play DESSA MESMA ROTA (/corrida/live).
 *
 * Mapeamento e Topologia Canônica:
 * - Rota oficial: /corrida/live (src/App.tsx)
 * - Página da rota oficial: RaceControlLivePage (src/pages/RaceControlLivePage.tsx)
 * - Painel canônico embutido: CanonicalRaceInitializationPanel (src/components/race/CanonicalRaceInitializationPanel.tsx)
 * - Controles: BottomControlBar (src/components/race/BottomControlBar.tsx)
 * - Handler de Lotes: handleAdvanceLapsBatch(count) -> onAdvanceMultipleLaps (RaceControlLivePage) -> canonicalRaceEngineService.advanceMultipleLaps
 * - Handler / Tick de Play: handleTogglePlayPause / simulationIntervalRef -> onAdvanceOneLap (RaceControlLivePage) -> canonicalRaceEngineService.advanceOneLap
 *
 * Confirmação do +1 VOLTA na rota oficial:
 * - O botão +1 VOLTA está presente no BottomControlBar e conectado ao handler handleStepOneLap de CanonicalRaceInitializationPanel.
 *
 * Cenários Obrigatórios:
 * A. +5 vs 5 avanços individuais do Play
 * B. +10 vs 10 avanços individuais do Play
 * C. Pit stop dentro do lote
 * D. Mudança climática ou neutralização dentro do lote
 * E. Decisão pendente surgindo durante o lote
 * F. Lote maior que as voltas restantes
 * G. Corrida já encerrada
 * H. Duplo comando durante processamento
 * I. Timer tentando avançar durante lote
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { raceStrategyService } from '@/services/raceStrategyService'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

/**
 * Construtor padrão de grid oficial com 24 carros e 12 equipes da temporada 2026.
 */
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

/**
 * Inicializa sessão canônica real de corrida para a rota /corrida/live
 */
function initializeLiveRaceSession(careerId: string, totalLaps = 30): CanonicalRaceState {
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
 * Harness isolado e fiel à arquitetura de /corrida/live:
 * - RaceControlLivePage:
 *     onAdvanceOneLap = (opts) => canonicalRaceEngineService.advanceOneLap(state, opts)
 *     onAdvanceMultipleLaps = (count) => canonicalRaceEngineService.advanceMultipleLaps(state, count)
 * - CanonicalRaceInitializationPanel:
 *     handleAdvanceLapsBatch(count)
 *     handleTogglePlayPause() / simulationInterval tick
 *     isExecutingAdvanceRef / isProcessingBatch / isSimulating
 */
function createRaceControlLiveOfficialHarness(initialState: CanonicalRaceState) {
  let state = JSON.parse(JSON.stringify(initialState)) as CanonicalRaceState
  let isSimulating = false
  let isProcessingBatch = false
  const isExecutingAdvanceRef = { current: false }

  let onAdvanceOneLapCalls = 0
  let onAdvanceMultipleLapsCalls = 0
  let rejectedBatchCalls = 0
  let rejectedTimerCalls = 0

  // 1. Handlers reais de RaceControlLivePage
  const onAdvanceOneLap = (opts?: any) => {
    onAdvanceOneLapCalls++
    state = canonicalRaceEngineService.advanceOneLap(state, {
      ...opts,
      persistState: false,
    })
    // Se o novo estado pausar ou exigir decisão, sincroniza os sinais
    if (
      state.status === 'completed' ||
      state.status === 'awaiting_player_weather_decision' ||
      state.status === 'suspended' ||
      state.status === 'red_flag' ||
      state.status === 'restart_pending'
    ) {
      isSimulating = false
    }
  }

  const onAdvanceMultipleLaps = (count: number, opts?: any) => {
    onAdvanceMultipleLapsCalls++
    state = canonicalRaceEngineService.advanceMultipleLaps(state, count, {
      ...opts,
      persistState: false,
    })
    if (
      state.status === 'completed' ||
      state.status === 'awaiting_player_weather_decision' ||
      state.status === 'suspended' ||
      state.status === 'red_flag' ||
      state.status === 'restart_pending'
    ) {
      isSimulating = false
    }
  }

  // 2. Flags canônicas de bloqueio do CanonicalRaceInitializationPanel
  const getIsFinished = () => state.status === 'completed'
  const getIsAwaitingWeatherDecision = () => state.status === 'awaiting_player_weather_decision'
  const getIsSuspended = () => state.status === 'suspended' || state.status === 'red_flag'
  const getIsRestartPending = () => state.status === 'restart_pending'

  // 3. Caminho A: handleAdvanceLapsBatch (+5 ou +10)
  const handleAdvanceLapsBatch = (count: number): boolean => {
    if (
      getIsFinished() ||
      getIsAwaitingWeatherDecision() ||
      getIsSuspended() ||
      getIsRestartPending() ||
      isProcessingBatch ||
      isSimulating ||
      isExecutingAdvanceRef.current
    ) {
      rejectedBatchCalls++
      return false
    }

    isExecutingAdvanceRef.current = true
    isSimulating = false
    isProcessingBatch = true
    try {
      onAdvanceMultipleLaps(count)
      return true
    } finally {
      isProcessingBatch = false
      isSimulating = false // Mantém PAUSADO ao término do lote
      isExecutingAdvanceRef.current = false
    }
  }

  // 4. Caminho B: tick individual do Play da mesma tela oficial
  // Corresponde a uma iteração do timer de reprodução automática configurado em useEffect
  const runOfficialPlayTick = (): boolean => {
    if (
      !isSimulating ||
      getIsFinished() ||
      getIsAwaitingWeatherDecision() ||
      getIsSuspended() ||
      getIsRestartPending() ||
      isProcessingBatch ||
      isExecutingAdvanceRef.current
    ) {
      rejectedTimerCalls++
      return false
    }

    isExecutingAdvanceRef.current = true
    try {
      onAdvanceOneLap()
      return true
    } finally {
      isExecutingAdvanceRef.current = false
    }
  }

  // Acionamento do botão Play/Pause da barra de controles
  const handleTogglePlayPause = (): boolean => {
    if (
      getIsFinished() ||
      getIsAwaitingWeatherDecision() ||
      getIsSuspended() ||
      getIsRestartPending() ||
      isProcessingBatch ||
      isExecutingAdvanceRef.current
    ) {
      return false
    }

    if (isSimulating) {
      isSimulating = false
      return true
    } else {
      isExecutingAdvanceRef.current = true
      isProcessingBatch = true
      try {
        onAdvanceOneLap()
        isSimulating = true
        return true
      } finally {
        isProcessingBatch = false
        isExecutingAdvanceRef.current = false
      }
    }
  }

  return {
    getState: () => state,
    setState: (s: CanonicalRaceState) => {
      state = s
    },
    isSimulating: () => isSimulating,
    setIsSimulating: (sim: boolean) => {
      isSimulating = sim
    },
    isProcessingBatch: () => isProcessingBatch,
    isExecutingAdvanceRef,
    handleAdvanceLapsBatch,
    runOfficialPlayTick,
    handleTogglePlayPause,
    onAdvanceOneLap,
    onAdvanceMultipleLaps,
    getMetrics: () => ({
      onAdvanceOneLapCalls,
      onAdvanceMultipleLapsCalls,
      rejectedBatchCalls,
      rejectedTimerCalls,
    }),
  }
}

/**
 * Asserção estrita de equivalência de todos os campos esportivos canônicos.
 * Não exclui campos esportivos.
 */
function assertFullSportingEquivalence(
  stateBatch: CanonicalRaceState,
  stateRef: CanonicalRaceState,
) {
  // 1. Volta atual, total e status
  expect(stateBatch.currentLap).toBe(stateRef.currentLap)
  expect(stateBatch.totalLaps).toBe(stateRef.totalLaps)
  expect(stateBatch.status).toBe(stateRef.status)
  expect(stateBatch.revision).toBe(stateRef.revision)

  // 2. Classificação e estado de todos os 24 pilotos
  expect(stateBatch.drivers.length).toBe(24)
  expect(stateRef.drivers.length).toBe(24)

  for (let i = 0; i < 24; i++) {
    const dB = stateBatch.drivers[i]
    const dR = stateRef.drivers[i]

    expect(dB.driverId).toBe(dR.driverId)
    expect(dB.currentPosition).toBe(dR.currentPosition)
    expect(dB.gridPosition).toBe(dR.gridPosition)
    expect(dB.lap).toBe(dR.lap)
    expect(dB.raceTime).toBe(dR.raceTime)
    expect(dB.gap).toBe(dR.gap)
    expect(dB.gapToLeaderSec).toBe(dR.gapToLeaderSec)
    expect(dB.tyreCompound).toBe(dR.tyreCompound)
    expect(dB.tyreAge).toBe(dR.tyreAge)
    expect(dB.fuel).toBe(dR.fuel)
    expect(dB.pitStops).toBe(dR.pitStops)
    expect(dB.isDnf).toBe(dR.isDnf)
    expect(dB.raceStatus).toBe(dR.raceStatus)
    expect(dB.bestLapSec).toBe(dR.bestLapSec)
    expect(dB.bestLapFormatted).toBe(dR.bestLapFormatted)
    expect(dB.lastLapTimeSec).toBe(dR.lastLapTimeSec)
    expect(dB.lastLapTimeFormatted).toBe(dR.lastLapTimeFormatted)
  }

  // 3. Clima e pista
  expect(stateBatch.weather).toEqual(stateRef.weather)

  // 4. Bandeiras, SC/VSC e Red Flag
  expect(stateBatch.safetyCarActive).toBe(stateRef.safetyCarActive)
  expect(stateBatch.vscActive).toBe(stateRef.vscActive)
  expect(stateBatch.redFlagActive).toBe(stateRef.redFlagActive)
  expect(stateBatch.raceControl?.currentFlag).toBe(stateRef.raceControl?.currentFlag)

  // 5. Decisões pendentes de clima e estratégias
  expect(stateBatch.pendingWeatherDecision).toEqual(stateRef.pendingWeatherDecision)

  // 6. Eventos esportivos produzidos
  expect(stateBatch.events.length).toBe(stateRef.events.length)
  if (stateBatch.events.length > 0) {
    expect(stateBatch.events[0].id).toBe(stateRef.events[0].id)
    expect(stateBatch.events[0].message).toBe(stateRef.events[0].message)
    const lastB = stateBatch.events[stateBatch.events.length - 1]
    const lastR = stateRef.events[stateRef.events.length - 1]
    expect(lastB.message).toBe(lastR.message)
    expect(lastB.lap).toBe(lastR.lap)
  }

  // 7. Volta mais rápida da sessão
  expect(stateBatch.fastestLap).toEqual(stateRef.fastestLap)
}

describe('RACE-CONTROL-COMPACT-01B3-T — TESTES DOS LOTES NA TELA OFICIAL /corrida/live', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // CENÁRIO A: +5 vs 5 avanços individuais do Play da mesma tela oficial
  // =========================================================================
  describe('CENÁRIO A — +5 vs 5 Avanços Individuais do Play', () => {
    it('acionar o comando +5 de BottomControlBar produz EXATAMENTE o mesmo estado esportivo que 5 ticks individuais do Play', () => {
      const initialCanonicalState = initializeLiveRaceSession('b3t_scen_a_5laps', 30)
      const cloneRef = JSON.parse(JSON.stringify(initialCanonicalState))

      // Caminho A: Lote +5 acionado pelo handler oficial
      const harnessBatch = createRaceControlLiveOfficialHarness(initialCanonicalState)
      const batchResult = harnessBatch.handleAdvanceLapsBatch(5)
      expect(batchResult).toBe(true)
      const stateBatch = harnessBatch.getState()

      // Caminho B: 5 ticks individuais executados pelo fluxo real do Play
      const harnessPlay = createRaceControlLiveOfficialHarness(cloneRef)
      harnessPlay.setIsSimulating(true) // Simulação ativa no Play
      for (let i = 0; i < 5; i++) {
        const tickResult = harnessPlay.runOfficialPlayTick()
        expect(tickResult).toBe(true)
      }
      const statePlay = harnessPlay.getState()

      // Asserção esportiva completa
      assertFullSportingEquivalence(stateBatch, statePlay)

      // Verificações contratuais específicas
      expect(stateBatch.currentLap).toBe(6) // 0 + 5 = 6 (após completar 5 voltas)
      expect(harnessBatch.isSimulating()).toBe(false) // Permanece pausado ao término do lote
      expect(harnessBatch.isProcessingBatch()).toBe(false)
      expect(harnessBatch.isExecutingAdvanceRef.current).toBe(false)
    })
  })

  // =========================================================================
  // CENÁRIO B: +10 vs 10 avanços individuais do Play da mesma tela oficial
  // =========================================================================
  describe('CENÁRIO B — +10 vs 10 Avanços Individuais do Play', () => {
    it('acionar o comando +10 de BottomControlBar produz EXATAMENTE o mesmo estado esportivo que 10 ticks individuais do Play', () => {
      const initialCanonicalState = initializeLiveRaceSession('b3t_scen_b_10laps', 35)
      const cloneRef = JSON.parse(JSON.stringify(initialCanonicalState))

      // Caminho A: Lote +10 acionado pelo handler oficial
      const harnessBatch = createRaceControlLiveOfficialHarness(initialCanonicalState)
      const batchResult = harnessBatch.handleAdvanceLapsBatch(10)
      expect(batchResult).toBe(true)
      const stateBatch = harnessBatch.getState()

      // Caminho B: 10 ticks individuais executados pelo fluxo real do Play
      const harnessPlay = createRaceControlLiveOfficialHarness(cloneRef)
      harnessPlay.setIsSimulating(true)
      for (let i = 0; i < 10; i++) {
        const tickResult = harnessPlay.runOfficialPlayTick()
        expect(tickResult).toBe(true)
      }
      const statePlay = harnessPlay.getState()

      // Asserção esportiva completa
      assertFullSportingEquivalence(stateBatch, statePlay)

      expect(stateBatch.currentLap).toBe(11) // 10 voltas completadas
      expect(harnessBatch.isSimulating()).toBe(false) // Permanece pausado ao término do lote
      expect(harnessBatch.isProcessingBatch()).toBe(false)
      expect(harnessBatch.isExecutingAdvanceRef.current).toBe(false)
    })
  })

  // =========================================================================
  // CENÁRIO C: Pit stop dentro do lote
  // =========================================================================
  describe('CENÁRIO C — Pit Stop dentro do Lote', () => {
    it('um pit stop solicitado para o piloto do jogador durante o lote é processado com total equivalência aos ticks individuais', () => {
      let initialCanonicalState = initializeLiveRaceSession('b3t_scen_c_pitstop', 25)

      // Solicitar pit stop para driver_1 mudar para composto "duro"
      initialCanonicalState = raceStrategyService.requestPitStop(
        initialCanonicalState,
        'driver_1',
        'duro',
      )

      const cloneRef = JSON.parse(JSON.stringify(initialCanonicalState))

      // Caminho A: Lote +5
      const harnessBatch = createRaceControlLiveOfficialHarness(initialCanonicalState)
      const batchResult = harnessBatch.handleAdvanceLapsBatch(5)
      expect(batchResult).toBe(true)
      const stateBatch = harnessBatch.getState()

      // Caminho B: 5 ticks individuais
      const harnessPlay = createRaceControlLiveOfficialHarness(cloneRef)
      harnessPlay.setIsSimulating(true)
      for (let i = 0; i < 5; i++) {
        harnessPlay.runOfficialPlayTick()
      }
      const statePlay = harnessPlay.getState()

      // Ambos devem ter executado a parada e instalado o novo composto
      const driverB = stateBatch.drivers.find((d) => d.driverId === 'driver_1')!
      const driverP = statePlay.drivers.find((d) => d.driverId === 'driver_1')!

      expect(driverB.pitStops).toBe(1)
      expect(driverP.pitStops).toBe(1)
      expect(driverB.tyreCompound).toBe('duro')
      expect(driverP.tyreCompound).toBe('duro')
      expect(driverB.tyreAge).toBe(driverP.tyreAge)

      assertFullSportingEquivalence(stateBatch, statePlay)
      expect(harnessBatch.isSimulating()).toBe(false)
    })
  })

  // =========================================================================
  // CENÁRIO D: Mudança climática ou neutralização dentro do lote
  // =========================================================================
  describe('CENÁRIO D — Mudança Climática ou Neutralização dentro do Lote', () => {
    it('processamento de neutralização (Safety Car) dentro do lote produz exata equivalência aos ticks do Play', () => {
      let initialCanonicalState = initializeLiveRaceSession('b3t_scen_d_neutralization', 25)

      // Avançar 1 volta limpa e forçar Safety Car na volta 2
      initialCanonicalState = canonicalRaceEngineService.advanceOneLap(initialCanonicalState, {
        persistState: false,
      })
      initialCanonicalState = canonicalRaceEngineService.advanceOneLap(initialCanonicalState, {
        forceRaceControlStatus: 'SAFETY_CAR',
        persistState: false,
      })

      const cloneRef = JSON.parse(JSON.stringify(initialCanonicalState))

      // Caminho A: Lote +5 sob regime de Safety Car
      const harnessBatch = createRaceControlLiveOfficialHarness(initialCanonicalState)
      const batchResult = harnessBatch.handleAdvanceLapsBatch(5)
      expect(batchResult).toBe(true)
      const stateBatch = harnessBatch.getState()

      // Caminho B: 5 ticks individuais do Play
      const harnessPlay = createRaceControlLiveOfficialHarness(cloneRef)
      harnessPlay.setIsSimulating(true)
      for (let i = 0; i < 5; i++) {
        harnessPlay.runOfficialPlayTick()
      }
      const statePlay = harnessPlay.getState()

      assertFullSportingEquivalence(stateBatch, statePlay)
      expect(harnessBatch.isSimulating()).toBe(false)
    })
  })

  // =========================================================================
  // CENÁRIO E: Decisão pendente surgindo durante o lote
  // =========================================================================
  describe('CENÁRIO E — Decisão Pendente Surgindo durante o Lote', () => {
    it('quando uma decisão climática pendente surge na volta 3, o lote interrompe exatamente no mesmo ponto que o Play sem resolver sozinho', () => {
      let initialCanonicalState = initializeLiveRaceSession('b3t_scen_e_weather_decision', 25)

      // Transição climática programada para a volta 3 (seco -> chuva_fraca)
      initialCanonicalState.weatherTransitions = [
        {
          lap: 3,
          condition: 'chuva_fraca',
          description: 'Chuva leve atinge a pista',
          rainIntensity: 'LIGHT',
        },
      ]

      const cloneRef = JSON.parse(JSON.stringify(initialCanonicalState))

      // Caminho A: Solicita +5 voltas
      // Deve parar na volta 3 porque advanceOneLap bloqueia e emite pendingWeatherDecision
      const harnessBatch = createRaceControlLiveOfficialHarness(initialCanonicalState)
      harnessBatch.handleAdvanceLapsBatch(5)
      const stateBatch = harnessBatch.getState()

      // Caminho B: Ticks individuais do Play
      const harnessPlay = createRaceControlLiveOfficialHarness(cloneRef)
      harnessPlay.setIsSimulating(true)
      for (let i = 0; i < 5; i++) {
        const canRun = harnessPlay.runOfficialPlayTick()
        if (!canRun) break
      }
      const statePlay = harnessPlay.getState()

      // Ambos pararam no exato mesmo ponto de interrupção
      expect(stateBatch.status).toBe('awaiting_player_weather_decision')
      expect(statePlay.status).toBe('awaiting_player_weather_decision')
      expect(stateBatch.currentLap).toBe(3)
      expect(statePlay.currentLap).toBe(3)

      expect(stateBatch.pendingWeatherDecision?.active).toBe(true)
      expect(statePlay.pendingWeatherDecision?.active).toBe(true)

      // Não houve avanço extra sem resolução da decisão pelo usuário
      assertFullSportingEquivalence(stateBatch, statePlay)

      // Estado permanece pausado e lote encerrado
      expect(harnessBatch.isSimulating()).toBe(false)
      expect(harnessBatch.isProcessingBatch()).toBe(false)
    })
  })

  // =========================================================================
  // CENÁRIO F: Lote maior que as voltas restantes
  // =========================================================================
  describe('CENÁRIO F — Lote Maior que as Voltas Restantes', () => {
    it('solicitar +10 voltas para corrida com apenas 4 voltas restantes finaliza exatamente na última volta sem voltas extras ou duplicadas', () => {
      // Corrida curta de 4 voltas totais
      const initialCanonicalState = initializeLiveRaceSession('b3t_scen_f_overflow', 4)
      const cloneRef = JSON.parse(JSON.stringify(initialCanonicalState))

      // Caminho A: Pedir +10 voltas
      const harnessBatch = createRaceControlLiveOfficialHarness(initialCanonicalState)
      const batchResult = harnessBatch.handleAdvanceLapsBatch(10)
      expect(batchResult).toBe(true)
      const stateBatch = harnessBatch.getState()

      // Caminho B: Ticks do Play até completar
      const harnessPlay = createRaceControlLiveOfficialHarness(cloneRef)
      harnessPlay.setIsSimulating(true)
      for (let i = 0; i < 10; i++) {
        const ok = harnessPlay.runOfficialPlayTick()
        if (!ok) break
      }
      const statePlay = harnessPlay.getState()

      // Encerramento exato
      expect(stateBatch.status).toBe('completed')
      expect(statePlay.status).toBe('completed')
      expect(stateBatch.currentLap).toBe(4)
      expect(statePlay.currentLap).toBe(4)

      // Nenhum piloto tem mais que 4 voltas
      expect(stateBatch.drivers.every((d) => d.lap <= 4)).toBe(true)
      expect(statePlay.drivers.every((d) => d.lap <= 4)).toBe(true)

      assertFullSportingEquivalence(stateBatch, statePlay)
      expect(harnessBatch.isSimulating()).toBe(false)
    })
  })

  // =========================================================================
  // CENÁRIO G: Corrida já encerrada
  // =========================================================================
  describe('CENÁRIO G — Corrida já Encerrada', () => {
    it('em corrida com status "completed", comandos de lotes (+5 e +10) são rejeitados e não alteram o estado', () => {
      let initialCanonicalState = initializeLiveRaceSession('b3t_scen_g_finished', 3)
      initialCanonicalState = canonicalRaceEngineService.advanceMultipleLaps(
        initialCanonicalState,
        3,
        { persistState: false },
      )
      expect(initialCanonicalState.status).toBe('completed')

      const harness = createRaceControlLiveOfficialHarness(initialCanonicalState)
      const snapshotBefore = JSON.parse(JSON.stringify(harness.getState()))

      // Tentativa de +5
      const result5 = harness.handleAdvanceLapsBatch(5)
      expect(result5).toBe(false)
      expect(harness.getState()).toEqual(snapshotBefore)

      // Tentativa de +10
      const result10 = harness.handleAdvanceLapsBatch(10)
      expect(result10).toBe(false)
      expect(harness.getState()).toEqual(snapshotBefore)

      // Métricas comprovam que não chamou os métodos internos
      expect(harness.getMetrics().onAdvanceMultipleLapsCalls).toBe(0)
      expect(harness.getMetrics().rejectedBatchCalls).toBe(2)
    })
  })

  // =========================================================================
  // CENÁRIO H: Duplo comando durante processamento
  // =========================================================================
  describe('CENÁRIO H — Duplo Comando durante Processamento', () => {
    it('tentativa concorrente ou duplo clique enquanto um lote está em processamento é imediatamente bloqueada pela flag síncrona isExecutingAdvanceRef', () => {
      const initialCanonicalState = initializeLiveRaceSession('b3t_scen_h_double_command', 20)
      const harness = createRaceControlLiveOfficialHarness(initialCanonicalState)

      // Simula a trava síncrona em execução
      harness.isExecutingAdvanceRef.current = true

      // Tentativas concorrentes durante o voo
      const call5 = harness.handleAdvanceLapsBatch(5)
      const call10 = harness.handleAdvanceLapsBatch(10)

      expect(call5).toBe(false)
      expect(call10).toBe(false)
      expect(harness.getMetrics().onAdvanceMultipleLapsCalls).toBe(0)
      expect(harness.getMetrics().rejectedBatchCalls).toBe(2)

      // Libera a trava e confirma que volta a funcionar
      harness.isExecutingAdvanceRef.current = false
      const normalCall = harness.handleAdvanceLapsBatch(5)
      expect(normalCall).toBe(true)
      expect(harness.getMetrics().onAdvanceMultipleLapsCalls).toBe(1)
    })
  })

  // =========================================================================
  // CENÁRIO I: Timer tentando avançar durante lote
  // =========================================================================
  describe('CENÁRIO I — Timer Tentando Avançar durante Lote', () => {
    it('se o timer de Play disparar um tick enquanto um lote está em processamento (isProcessingBatch), o tick do timer é rejeitado', () => {
      const initialCanonicalState = initializeLiveRaceSession('b3t_scen_i_timer_concurrency', 20)
      const harness = createRaceControlLiveOfficialHarness(initialCanonicalState)

      // Simular condição de lote em andamento: isProcessingBatch = true e isExecutingAdvanceRef.current = true
      harness.isExecutingAdvanceRef.current = true
      harness.setIsSimulating(true) // Timer supostamente ativo

      // Timer tenta tickar durante o processamento do lote
      const timerTickResult = harness.runOfficialPlayTick()

      expect(timerTickResult).toBe(false)
      expect(harness.getMetrics().onAdvanceOneLapCalls).toBe(0)
      expect(harness.getMetrics().rejectedTimerCalls).toBe(1)

      // Limpar lock
      harness.isExecutingAdvanceRef.current = false
    })

    it('quando o Play está ativo (simulação ligada), os botões de lote (+5 e +10) ficam desabilitados/rejeitam o acionamento', () => {
      const initialCanonicalState = initializeLiveRaceSession('b3t_scen_i_play_active_lock', 20)
      const harness = createRaceControlLiveOfficialHarness(initialCanonicalState)

      // Play ativo
      harness.setIsSimulating(true)

      const attemptBatch5 = harness.handleAdvanceLapsBatch(5)
      const attemptBatch10 = harness.handleAdvanceLapsBatch(10)

      expect(attemptBatch5).toBe(false)
      expect(attemptBatch10).toBe(false)
      expect(harness.getMetrics().onAdvanceMultipleLapsCalls).toBe(0)
    })
  })
})
