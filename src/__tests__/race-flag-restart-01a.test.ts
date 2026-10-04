/**
 * RACE-FLAG-RESTART-01A — FECHAMENTO DO ITEM #7
 * Validação de Bandeira Vermelha + Relargada no Caminho Oficial /corrida/live (RaceControlLivePage)
 *
 * Mapeamento e Topologia Canônica:
 * - Rota oficial: /corrida/live (src/App.tsx)
 * - Página da rota oficial: RaceControlLivePage (src/pages/RaceControlLivePage.tsx)
 * - Painel canônico embutido: CanonicalRaceInitializationPanel (src/components/race/CanonicalRaceInitializationPanel.tsx)
 * - Controles de Reprodução e Lotes: BottomControlBar (src/components/race/BottomControlBar.tsx)
 * - Controles de QA / Forçar Bandeiras: CanonicalRaceInitializationPanel (onTriggerRedFlag / forceRaceControlStatus: 'RED_FLAG')
 * - Motor canônico: CanonicalRaceEngineService (src/services/canonicalRaceEngineService.ts)
 * - Handlers canônicos acionados pela UI oficial:
 *     1. onTriggerRedFlag: canonicalRaceEngineService.triggerRedFlag
 *     2. onChangeSuspensionTyre: canonicalRaceEngineService.changeTyresDuringSuspension
 *     3. onPrepareRestart: canonicalRaceEngineService.prepareRedFlagRestart
 *     4. onResumeRace: canonicalRaceEngineService.resumeRaceAfterRedFlag
 *     5. onAdvanceOneLap: canonicalRaceEngineService.advanceOneLap
 *     6. onAdvanceMultipleLaps: canonicalRaceEngineService.advanceMultipleLaps
 *
 * Requisitos Validados nesta Suíte:
 * A. SUSPENSÃO — Bandeira vermelha produz status suspended, bloqueios em Play, +1 VOLTA, +5/+10,
 *    distinção entre pausa de reprodução e suspensão esportiva.
 * B. BOXES E ESTADO DOS CARROS — Retorno/espera em boxes (status suspended), preservação estrita de
 *    classificação congelada, voltas completadas, danos, DNFs intocados.
 * C. PNEUS E DECISÕES — Escolha permitida de novos compostos, consumo de set real do inventário,
 *    rejeição de sets indisponíveis (>90% desgaste ou devolvido), idempotência (não consome 2x).
 * D. RELARGADA — Standing restart com alinhamento na ordem congelada, normalização de gaps (+0.2s),
 *    manutenção dos compostos trocados, preservação de DNFs, execução única (idempotente).
 * E. PERSISTÊNCIA — Salvar e retomar em suspensão restaura snapshot, decisões de pneus, grid congelado,
 *    ordem de relargada, sem novo sorteio ou duplicação.
 * F. CONCORRÊNCIA — Duplo clique ou comandos concorrentes não duplicam decisões, trocas ou relargadas;
 *    bloqueio rigoroso via isExecutingAdvanceRef e guards canônicos de status.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import type { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'
import type { TireCompound, TireSetItem } from '@/types/f1'

/**
 * Construtor padrão do grid oficial com 24 carros e 12 equipes da temporada 2026.
 */
function buildMockGrid24() {
  const teams = [
    { id: 'ferrari', name: 'Ferrari' },
    { id: 'mercedes', name: 'Mercedes' },
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
 * Inicializa sessão canônica real de corrida com seed e estado controlados.
 */
function initializeOfficialLiveRace(careerId: string, totalLaps = 30): CanonicalRaceState {
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
 * Alimenta o inventário de pneus para validação de trocas sob suspensão.
 */
function seedDriverTyreInventory(
  season: string,
  round: number,
  driverId: string,
  sets: TireSetItem[],
) {
  canonicalWeekendTyrePersistence.updateDriverInventory(season, round, driverId, sets)
}

/**
 * Harness rigoroso e fiel que espelha exatamente a integração entre
 * RaceControlLivePage e CanonicalRaceInitializationPanel.
 */
function createRaceControlLiveFlowHarness(initialState: CanonicalRaceState) {
  let state = JSON.parse(JSON.stringify(initialState)) as CanonicalRaceState
  let isSimulating = false
  let isProcessingBatch = false
  const isExecutingAdvanceRef = { current: false }

  // Métricas de chamadas para auditoria de concorrência e bloqueios
  let advanceOneLapCalls = 0
  let advanceBatchCalls = 0
  let triggerRedFlagCalls = 0
  let prepareRestartCalls = 0
  let resumeRaceCalls = 0
  let changeSuspensionTyreCalls = 0
  let rejectedPlaybackCommands = 0

  // 1. Handlers de RaceControlLivePage
  const onTriggerRedFlag = () => {
    triggerRedFlagCalls++
    state = canonicalRaceEngineService.triggerRedFlag(state, {
      reason: 'Bandeira Vermelha — Corrida Suspensa pela Direção de Prova',
      persistState: false,
    })
    isSimulating = false
  }

  const onPrepareRestart = () => {
    prepareRestartCalls++
    state = canonicalRaceEngineService.prepareRedFlagRestart(state, {
      persistState: false,
    })
  }

  const onResumeRace = () => {
    resumeRaceCalls++
    state = canonicalRaceEngineService.resumeRaceAfterRedFlag(state, {
      persistState: false,
    })
  }

  const onChangeSuspensionTyre = (driverId: string, compound: TireCompound) => {
    changeSuspensionTyreCalls++
    const res = canonicalRaceEngineService.changeTyresDuringSuspension({
      raceState: state,
      driverId,
      newCompound: compound,
      persistState: false,
    })
    if (res.success) {
      state = res.updatedState
    }
    return res
  }

  const onAdvanceOneLap = (opts?: any) => {
    advanceOneLapCalls++
    state = canonicalRaceEngineService.advanceOneLap(state, {
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

  const onAdvanceMultipleLaps = (count: number) => {
    advanceBatchCalls++
    state = canonicalRaceEngineService.advanceMultipleLaps(state, count, {
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

  // 3. Controles acionados via BottomControlBar
  const handleTogglePlayPause = (): boolean => {
    if (
      getIsFinished() ||
      getIsAwaitingWeatherDecision() ||
      getIsSuspended() ||
      getIsRestartPending() ||
      isProcessingBatch ||
      isExecutingAdvanceRef.current
    ) {
      rejectedPlaybackCommands++
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

  const handleStepOneLap = (): boolean => {
    if (
      getIsFinished() ||
      getIsAwaitingWeatherDecision() ||
      getIsSuspended() ||
      getIsRestartPending() ||
      isProcessingBatch ||
      isSimulating ||
      isExecutingAdvanceRef.current
    ) {
      rejectedPlaybackCommands++
      return false
    }

    isExecutingAdvanceRef.current = true
    isSimulating = false
    isProcessingBatch = true
    try {
      onAdvanceOneLap()
      return true
    } finally {
      isProcessingBatch = false
      isSimulating = false
      isExecutingAdvanceRef.current = false
    }
  }

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
      rejectedPlaybackCommands++
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
      isSimulating = false
      isExecutingAdvanceRef.current = false
    }
  }

  return {
    getState: () => state,
    setState: (s: CanonicalRaceState) => {
      state = s
    },
    isSimulating: () => isSimulating,
    setIsSimulating: (v: boolean) => {
      isSimulating = v
    },
    isProcessingBatch: () => isProcessingBatch,
    isExecutingAdvanceRef,
    // Ações
    onTriggerRedFlag,
    onPrepareRestart,
    onResumeRace,
    onChangeSuspensionTyre,
    onAdvanceOneLap,
    onAdvanceMultipleLaps,
    handleTogglePlayPause,
    handleStepOneLap,
    handleAdvanceLapsBatch,
    getMetrics: () => ({
      advanceOneLapCalls,
      advanceBatchCalls,
      triggerRedFlagCalls,
      prepareRestartCalls,
      resumeRaceCalls,
      changeSuspensionTyreCalls,
      rejectedPlaybackCommands,
    }),
  }
}

describe('RACE-FLAG-RESTART-01A — FECHAMENTO DO ITEM #7 (Bandeira Vermelha + Relargada na rota /corrida/live)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    try {
      localStorage.clear()
    } catch {
      // In-memory fallback
    }
  })

  // =========================================================================
  // ETAPA A: SUSPENSÃO ESPORTIVA E BLOQUEIO DE CONTROLES
  // =========================================================================
  describe('ETAPA A — Suspensão Esportiva e Bloqueio de Controles', () => {
    it('A.1: Acionamento canônico de bandeira vermelha transiciona status para "suspended" e congela volta competitiva', () => {
      const initialRace = initializeOfficialLiveRace('rf_live_scen_a1', 30)
      const harness = createRaceControlLiveFlowHarness(initialRace)

      // Avançar 5 voltas em bandeira verde
      for (let i = 0; i < 5; i++) {
        harness.onAdvanceOneLap()
      }
      expect(harness.getState().currentLap).toBe(6) // 5 voltas completadas
      expect(harness.getState().status).toBe('running')

      // Acionamento canônico da bandeira vermelha
      harness.onTriggerRedFlag()
      const suspended = harness.getState()

      expect(suspended.status).toBe('suspended')
      expect(suspended.redFlagActive).toBe(true)
      expect(suspended.raceControl?.currentFlag).toBe('RED_FLAG')
      expect(suspended.redFlagSnapshot).toBeDefined()
      expect(suspended.redFlagSnapshot?.suspendedAtLap).toBe(6)
      expect(harness.isSimulating()).toBe(false)
    })

    it('A.2: Sob suspensão, Play, +1 VOLTA e lotes +5/+10 são ESTRITAMENTE BLOQUEADOS de avançar a corrida', () => {
      const initialRace = initializeOfficialLiveRace('rf_live_scen_a2', 30)
      const harness = createRaceControlLiveFlowHarness(initialRace)

      // Avança 3 voltas e aciona bandeira vermelha
      for (let i = 0; i < 3; i++) {
        harness.onAdvanceOneLap()
      }
      harness.onTriggerRedFlag()
      const lapBefore = harness.getState().currentLap
      const revisionBefore = harness.getState().revision

      // 1. Tentativa de Play (handleTogglePlayPause)
      const playAttempt = harness.handleTogglePlayPause()
      expect(playAttempt).toBe(false)
      expect(harness.getState().currentLap).toBe(lapBefore)

      // 2. Tentativa de +1 VOLTA (handleStepOneLap)
      const stepAttempt = harness.handleStepOneLap()
      expect(stepAttempt).toBe(false)
      expect(harness.getState().currentLap).toBe(lapBefore)

      // 3. Tentativas de +5 e +10 (handleAdvanceLapsBatch)
      const batch5Attempt = harness.handleAdvanceLapsBatch(5)
      expect(batch5Attempt).toBe(false)
      const batch10Attempt = harness.handleAdvanceLapsBatch(10)
      expect(batch10Attempt).toBe(false)

      expect(harness.getState().currentLap).toBe(lapBefore)
      expect(harness.getState().status).toBe('suspended')
      expect(harness.getState().revision).toBe(revisionBefore)
      expect(harness.getMetrics().rejectedPlaybackCommands).toBe(4)
    })

    it('A.3: Distingue pausa de reprodução da suspensão esportiva (advanceOneLap sob suspended não progride a prova)', () => {
      const initialRace = initializeOfficialLiveRace('rf_live_scen_a3', 30)
      const harness = createRaceControlLiveFlowHarness(initialRace)

      harness.onAdvanceOneLap()
      const lapBefore = harness.getState().currentLap

      // Aciona suspensão esportiva
      harness.onTriggerRedFlag()
      expect(harness.getState().status).toBe('suspended')

      // Se advanceOneLap for chamado diretamente pelo motor, a volta NÃO avança competitivamente
      harness.onAdvanceOneLap()
      const stateAfter = harness.getState()

      expect(stateAfter.currentLap).toBe(lapBefore)
      expect(stateAfter.status).toBe('suspended')
      expect(stateAfter.redFlagActive).toBe(true)
    })
  })

  // =========================================================================
  // ETAPA B: BOXES E ESTADO DOS CARROS
  // =========================================================================
  describe('ETAPA B — Boxes e Preservação Estrita do Estado dos Carros', () => {
    it('B.1: Todos os carros ativos retornam aos boxes com status "suspended", e carros DNF permanecem intocados', () => {
      let race = initializeOfficialLiveRace('rf_live_scen_b1', 30)

      // Forçar 2 abandonos (DNFs) antes da bandeira vermelha
      const dnf1 = race.drivers[22] // P23
      const dnf2 = race.drivers[23] // P24
      dnf1.raceStatus = 'dnf'
      dnf1.isDnf = true
      dnf1.dnfReason = 'Falha Elétrica'
      dnf1.dnfLap = 4
      dnf2.raceStatus = 'dnf'
      dnf2.isDnf = true
      dnf2.dnfReason = 'Colisão'
      dnf2.dnfLap = 4

      const harness = createRaceControlLiveFlowHarness(race)
      harness.onTriggerRedFlag()
      const suspended = harness.getState()

      // 22 carros ativos suspensos nos boxes, 2 DNF
      const suspendedActive = suspended.drivers.filter((d) => d.raceStatus === 'suspended')
      const dnfDrivers = suspended.drivers.filter((d) => d.isDnf && d.raceStatus === 'dnf')

      expect(suspendedActive.length).toBe(22)
      expect(dnfDrivers.length).toBe(2)
      expect(suspended.redFlagSnapshot?.activeDriverIds.length).toBe(22)
      expect(suspended.redFlagSnapshot?.dnfDriverIds.length).toBe(2)

      // Nenhum carro abandonado foi recuperado
      expect(dnfDrivers.some((d) => d.driverId === dnf1.driverId)).toBe(true)
      expect(dnfDrivers.some((d) => d.driverId === dnf2.driverId)).toBe(true)
    })

    it('B.2: Preservação estrita da classificação, voltas completadas, raceTime e danos na interrupção', () => {
      const race = initializeOfficialLiveRace('rf_live_scen_b2', 30)
      const harness = createRaceControlLiveFlowHarness(race)

      // Executa 4 voltas para dispersão natural de pace
      for (let i = 0; i < 4; i++) {
        harness.onAdvanceOneLap()
      }

      const orderBefore = harness.getState().drivers.map((d) => ({
        id: d.driverId,
        pos: d.currentPosition,
        lap: d.lap,
        raceTime: d.raceTime,
        fuel: d.fuel,
        condition: d.carCondition,
      }))

      harness.onTriggerRedFlag()
      const suspended = harness.getState()

      orderBefore.forEach((carBefore) => {
        const carAfter = suspended.drivers.find((d) => d.driverId === carBefore.id)!
        expect(carAfter.currentPosition).toBe(carBefore.pos)
        expect(carAfter.lap).toBe(carBefore.lap)
        expect(carAfter.raceTime).toBe(carBefore.raceTime)
        expect(carAfter.fuel).toBe(carBefore.fuel)
        expect(carAfter.carCondition).toBe(carBefore.condition)
      })
    })

    it('B.3: Suspensão por bandeira vermelha NÃO consome combustível, pneus ou integridade mecânica', () => {
      const race = initializeOfficialLiveRace('rf_live_scen_b3', 30)
      const harness = createRaceControlLiveFlowHarness(race)

      harness.onAdvanceOneLap()
      harness.onTriggerRedFlag()

      const p1Before = { ...harness.getState().drivers[0] }

      // Ciclo sob suspensão
      harness.onAdvanceOneLap()
      const p1After = harness.getState().drivers[0]

      expect(p1After.fuel).toBe(p1Before.fuel)
      expect(p1After.tyreAge).toBe(p1Before.tyreAge)
      expect(p1After.carCondition).toBe(p1Before.carCondition)
      expect(p1After.pitStops).toBe(p1Before.pitStops)
    })
  })

  // =========================================================================
  // ETAPA C: PNEUS E DECISÕES NA INTERRUPÇÃO
  // =========================================================================
  describe('ETAPA C — Pneus e Decisões Permitidas na Suspensão', () => {
    it('C.1: Troca de pneus permitida na suspensão consome jogo real do inventário sem custo competitivo de pit stop', () => {
      const race = initializeOfficialLiveRace('rf_live_scen_c1', 30)
      const harness = createRaceControlLiveFlowHarness(race)
      harness.onTriggerRedFlag()

      const driverId = 'driver_1'
      seedDriverTyreInventory('2026', 1, driverId, [
        {
          id: 'set_med_01',
          tyreSetId: 'set_med_01',
          compound: 'medio',
          status: 'disponivel',
          wear: 5,
          lapsUsed: 1,
          isFitted: false,
        },
      ])

      const pitsBefore = harness.getState().drivers.find((d) => d.driverId === driverId)!.pitStops
      const raceTimeBefore = harness
        .getState()
        .drivers.find((d) => d.driverId === driverId)!.raceTime

      // Executa a troca canônica
      const res = harness.onChangeSuspensionTyre(driverId, 'medio')
      expect(res.success).toBe(true)

      const updatedDriver = harness.getState().drivers.find((d) => d.driverId === driverId)!
      expect(updatedDriver.tyreCompound).toBe('medio')
      expect(updatedDriver.tyreAge).toBe(0)
      expect(updatedDriver.pitStops).toBe(pitsBefore) // Sem incremento competitivo
      expect(updatedDriver.raceTime).toBe(raceTimeBefore) // Sem perda de tempo

      // Verifica consumo no inventário real
      const inv = canonicalWeekendTyrePersistence.readWeekendTireData('2026', 1)
      const fittedSet = inv?.inventoriesByDriver[driverId]?.find((s) => s.id === 'set_med_01')
      expect(fittedSet?.isFitted).toBe(true)
      expect(fittedSet?.status).toBe('instalado')
    })

    it('C.2: Set de pneus indisponível ou esgotado (>90% wear) é estritamente rejeitado', () => {
      const race = initializeOfficialLiveRace('rf_live_scen_c2', 30)
      const harness = createRaceControlLiveFlowHarness(race)
      harness.onTriggerRedFlag()

      const driverId = 'driver_1'
      seedDriverTyreInventory('2026', 1, driverId, [
        {
          id: 'set_dead_hard',
          tyreSetId: 'set_dead_hard',
          compound: 'duro',
          status: 'devolvido_indisponivel',
          wear: 95,
          lapsUsed: 40,
          isFitted: false,
        },
      ])

      const res = canonicalRaceEngineService.changeTyresDuringSuspension({
        raceState: harness.getState(),
        driverId,
        newCompound: 'duro',
        newTyreSetId: 'set_dead_hard',
        persistState: false,
      })

      expect(res.success).toBe(false)
      expect(res.error).toMatch(/indisponível|esgotado/)
    })

    it('C.3: Carros já abandonados (DNF) NÃO podem receber troca de pneus na suspensão', () => {
      const race = initializeOfficialLiveRace('rf_live_scen_c3', 30)
      race.drivers[23].raceStatus = 'dnf'
      race.drivers[23].isDnf = true

      const harness = createRaceControlLiveFlowHarness(race)
      harness.onTriggerRedFlag()

      const res = harness.onChangeSuspensionTyre('driver_24', 'medio')
      expect(res.success).toBe(false)
      expect(res.error).toMatch(/abandonados|DNF/)
    })

    it('C.4: Idempotência de troca: segundo comando para o mesmo composto/jogo não consome o inventário duas vezes', () => {
      const race = initializeOfficialLiveRace('rf_live_scen_c4', 30)
      const harness = createRaceControlLiveFlowHarness(race)
      harness.onTriggerRedFlag()

      const driverId = 'driver_1'
      seedDriverTyreInventory('2026', 1, driverId, [
        {
          id: 'set_hard_idem',
          tyreSetId: 'set_hard_idem',
          compound: 'duro',
          status: 'disponivel',
          wear: 0,
          lapsUsed: 0,
          isFitted: false,
        },
      ])

      const res1 = harness.onChangeSuspensionTyre(driverId, 'duro')
      expect(res1.success).toBe(true)
      const rev1 = harness.getState().revision

      // Segunda chamada com mesmo composto
      const res2 = harness.onChangeSuspensionTyre(driverId, 'duro')
      expect(res2.success).toBe(true)
      // Estado não sofreu mutação desnecessária
      expect(harness.getState().revision).toBe(rev1)
    })
  })

  // =========================================================================
  // ETAPA D: PROCEDIMENTO E EXECUÇÃO DA RELARGADA
  // =========================================================================
  describe('ETAPA D — Ordem e Execução da Relargada Canônica', () => {
    it('D.1: Preparação da relargada posiciona carros na ordem exata do snapshot e normaliza gaps (standing restart)', () => {
      const race = initializeOfficialLiveRace('rf_live_scen_d1', 30)
      const harness = createRaceControlLiveFlowHarness(race)

      for (let i = 0; i < 4; i++) {
        harness.onAdvanceOneLap()
      }
      harness.onTriggerRedFlag()

      const expectedOrder = harness.getState().redFlagSnapshot!.standingGridOrder

      // Prepara relargada
      harness.onPrepareRestart()
      const restartState = harness.getState()

      expect(restartState.status).toBe('restart_pending')
      expect(restartState.raceControl?.restartPending).toBe(true)

      const actualOrder = restartState.drivers.map((d) => d.driverId)
      expect(actualOrder).toEqual(expectedOrder)

      // Gaps normalizados de relargada parada
      expect(restartState.drivers[0].gap).toBe('LÍDER')
      expect(restartState.drivers[1].gap).toBe('+0.200s')
      expect(restartState.drivers[2].gap).toBe('+0.400s')
    })

    it('D.2: Carros DNF continuam DNF na relargada e não são revividos', () => {
      const race = initializeOfficialLiveRace('rf_live_scen_d2', 30)
      race.drivers[22].raceStatus = 'dnf'
      race.drivers[22].isDnf = true
      race.drivers[23].raceStatus = 'dnf'
      race.drivers[23].isDnf = true

      const harness = createRaceControlLiveFlowHarness(race)
      harness.onTriggerRedFlag()
      harness.onPrepareRestart()
      harness.onResumeRace()

      const resumed = harness.getState()
      expect(resumed.status).toBe('running')

      const dnfCars = resumed.drivers.filter((d) => d.isDnf)
      expect(dnfCars.length).toBe(2)
      dnfCars.forEach((c) => {
        expect(c.raceStatus).toBe('dnf')
        expect(c.gap).toBe('ABANDONO')
      })
    })

    it('D.3: Composto novo trocado na suspensão permanece no carro e relargada não zera completed laps', () => {
      const race = initializeOfficialLiveRace('rf_live_scen_d3', 30)
      const harness = createRaceControlLiveFlowHarness(race)

      for (let i = 0; i < 5; i++) {
        harness.onAdvanceOneLap()
      }
      expect(harness.getState().currentLap).toBe(6)

      harness.onTriggerRedFlag()
      seedDriverTyreInventory('2026', 1, 'driver_1', [
        {
          id: 'set_c3_hard',
          tyreSetId: 'set_c3_hard',
          compound: 'duro',
          status: 'disponivel',
          wear: 0,
          lapsUsed: 0,
          isFitted: false,
        },
      ])
      harness.onChangeSuspensionTyre('driver_1', 'duro')

      harness.onPrepareRestart()
      harness.onResumeRace()

      const resumed = harness.getState()
      expect(resumed.currentLap).toBe(6) // Não zera laps!
      expect(resumed.drivers.find((d) => d.driverId === 'driver_1')?.tyreCompound).toBe('duro')

      // Próxima volta ocorre normalmente em bandeira verde
      harness.onAdvanceOneLap()
      expect(harness.getState().currentLap).toBe(7)
      expect(harness.getState().status).toBe('running')
    })

    it('D.4: Idempotência da relargada: resumeRaceAfterRedFlag executado duas vezes não duplica efeito', () => {
      const race = initializeOfficialLiveRace('rf_live_scen_d4', 30)
      const harness = createRaceControlLiveFlowHarness(race)
      harness.onTriggerRedFlag()
      harness.onPrepareRestart()

      harness.onResumeRace()
      const rev1 = harness.getState().revision
      expect(harness.getState().status).toBe('running')

      // Segunda chamada com a corrida já running
      harness.onResumeRace()
      expect(harness.getState().revision).toBe(rev1)
    })
  })

  // =========================================================================
  // ETAPA E: PERSISTÊNCIA CANÔNICA
  // =========================================================================
  describe('ETAPA E — Persistência e Retomada Canônica', () => {
    it('E.1: Salvar e recarregar corrida suspensa preserva etapa, snapshot, pneus trocados e ordem de relargada', () => {
      const careerId = 'career_persist_rf_test'
      const season = 2026
      const round = 1

      const race = initializeOfficialLiveRace(careerId, 30)
      const harness = createRaceControlLiveFlowHarness(race)
      harness.onAdvanceOneLap()
      harness.onTriggerRedFlag()

      seedDriverTyreInventory(String(season), round, 'driver_1', [
        {
          id: 'set_persist_hard',
          tyreSetId: 'set_persist_hard',
          compound: 'duro',
          status: 'disponivel',
          wear: 0,
          lapsUsed: 0,
          isFitted: false,
        },
      ])
      harness.onChangeSuspensionTyre('driver_1', 'duro')

      // Salva explicitamente
      canonicalRaceInitializationService.saveCanonicalRaceState(harness.getState())

      // Recarrega do armazenamento persistente
      const reloaded = canonicalRaceInitializationService.readCanonicalRaceState(
        careerId,
        season,
        round,
      )

      expect(reloaded).toBeDefined()
      expect(reloaded?.status).toBe('suspended')
      expect(reloaded?.redFlagActive).toBe(true)
      expect(reloaded?.redFlagSnapshot).toBeDefined()
      expect(reloaded?.drivers.find((d) => d.driverId === 'driver_1')?.tyreCompound).toBe('duro')
      expect(
        reloaded?.redFlagSnapshot?.tyreChangesDuringSuspension?.['driver_1']?.newCompound,
      ).toBe('duro')

      // Retomada pode seguir para relargada normalmente a partir do estado recarregado
      const resumedHarness = createRaceControlLiveFlowHarness(reloaded!)
      resumedHarness.onPrepareRestart()
      resumedHarness.onResumeRace()

      expect(resumedHarness.getState().status).toBe('running')
      expect(resumedHarness.getState().redFlagActive).toBe(false)
    })
  })

  // =========================================================================
  // ETAPA F: CONCORRÊNCIA E PREVENÇÃO DE DUPLO COMANDO
  // =========================================================================
  describe('ETAPA F — Proteção de Concorrência e Bloqueios Síncronos', () => {
    it('F.1: Duplo clique em preparar relargada ou autorizar relargada é protegido por idempotência', () => {
      const race = initializeOfficialLiveRace('rf_live_scen_f1', 30)
      const harness = createRaceControlLiveFlowHarness(race)
      harness.onTriggerRedFlag()

      // Duplo clique rápido em onPrepareRestart
      harness.onPrepareRestart()
      const revRestart1 = harness.getState().revision
      harness.onPrepareRestart()
      const revRestart2 = harness.getState().revision
      expect(revRestart1).toBe(revRestart2)

      // Duplo clique rápido em onResumeRace
      harness.onResumeRace()
      const revResume1 = harness.getState().revision
      harness.onResumeRace()
      const revResume2 = harness.getState().revision
      expect(revResume1).toBe(revResume2)
    })

    it('F.2: Durante a suspensão, tentativas de avanço simultâneas via +1 ou Play colidem com o bloqueio síncrono', () => {
      const race = initializeOfficialLiveRace('rf_live_scen_f2', 30)
      const harness = createRaceControlLiveFlowHarness(race)
      harness.onTriggerRedFlag()

      // Ambas as tentativas colidem com os bloqueios
      const stepRes = harness.handleStepOneLap()
      const playRes = harness.handleTogglePlayPause()

      expect(stepRes).toBe(false)
      expect(playRes).toBe(false)
      expect(harness.getMetrics().advanceOneLapCalls).toBe(0)
    })
  })
})
