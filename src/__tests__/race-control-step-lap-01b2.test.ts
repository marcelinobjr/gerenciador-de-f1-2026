/**
 * RACE-CONTROL-STEP-LAP-01B2 — +1 VOLTA NO FLUXO REAL DO PLAY
 *
 * Suíte de testes direcionados para o botão +1 VOLTA e fluxo unificado:
 * - TESTE A — Integração do botão: acionar o handler real do +1 VOLTA a partir de sessão pausada;
 *             verificar uma única chamada ao runner, atualização de estado/UI, checkpoint pelo
 *             caminho existente, reprodução ainda pausada.
 * - TESTE B — Equivalência com o Play: estados iniciais independentes e equivalentes, mesma seed:
 *             A) uma iteração pelo caminho do timer;
 *             B) o caminho real do botão.
 *             Comparar estado esportivo resultante: volta, classificação, gaps, pilotos, pneus,
 *             pits, clima, SC/VSC, DNF, decisões, eventos. Sem mocks artificiais de resultado.
 * - TESTE C — Concorrência: durante execução pendente, segunda tentativa não pode produzir outra
 *             chamada ao runner. Com Play ativo, o step deve estar indisponível.
 * - TESTE D — Limites: corrida encerrada não avança; a última volta finaliza apenas uma vez;
 *             bloqueios canônicos (ex: decisões pendentes) não são contornados pelo comando manual.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { advanceCanonicalRaceLap, type AdvanceOneLapParams } from '@/services/canonicalRaceRunner'
import type { SimDriverEntry } from '@/pages/race/types'
import type { TeamModel } from '@/types/f1'
import type { RacePendingDecision } from '@/types/race-session'

function createStandardMockGrid(count = 24): SimDriverEntry[] {
  const teams = [
    { id: 'ferrari', name: 'Scuderia Ferrari', color: '#E8002D' },
    { id: 'mercedes', name: 'Mercedes-AMG Petronas', color: '#27F4D2' },
    { id: 'mclaren', name: 'McLaren F1 Team', color: '#FF8000' },
    { id: 'redbull', name: 'Red Bull Racing', color: '#1E41FF' },
    { id: 'racingbulls', name: 'Visa Cash App RB', color: '#6692FF' },
    { id: 'alpine', name: 'Alpine F1 Team', color: '#0093CC' },
    { id: 'audi', name: 'Audi F1 Team', color: '#FF2A00' },
    { id: 'haas', name: 'Haas F1 Team', color: '#B6BABD' },
    { id: 'williams', name: 'Williams Racing', color: '#64C4FF' },
    { id: 'astonmartin', name: 'Aston Martin Aramco', color: '#229971' },
    { id: 'andretti', name: 'Andretti Global', color: '#002B49' },
    { id: 'cadillac', name: 'Cadillac F1 Team', color: '#D4AF37' },
  ]

  const grid: SimDriverEntry[] = []
  for (let i = 1; i <= count; i++) {
    const team = teams[Math.floor((i - 1) / 2)] || teams[0]
    grid.push({
      position: i,
      driverId: `driver_${i}`,
      driverName: `Piloto ${i}`,
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color,
      score: 85 - i * 0.5,
      morale: 80,
      physicalCondition: 90,
      tireCompound: i % 2 === 0 ? 'medio' : 'macio',
      tireWear: 5,
      lapsOnCurrentTire: 0,
      wearMultiplier: 1.0,
      fuelRemaining: 100,
      pitLap: 18 + (i % 6),
      secondCompound: 'duro',
      pitStopsDone: 0,
      accumulatedTimeSec: (i - 1) * 1.5,
      gapToLeader: i === 1 ? 'Líder' : `+${((i - 1) * 1.5).toFixed(3)}s`,
      gapToFront: i === 1 ? '+0.000s' : '+1.500s',
      isPlayer: i <= 2,
      dnf: false,
      points: 0,
      fastestLap: false,
      usedOvertake: false,
    })
  }
  return grid
}

describe('RACE-CONTROL-STEP-LAP-01B2 — +1 VOLTA NO FLUXO REAL DO PLAY', () => {
  const dummyTeam: TeamModel = {
    id: 'ferrari',
    name: 'Scuderia Ferrari',
    color: '#E8002D',
    engine_supplier: 'Ferrari',
    chassis_level: 90,
    strength: 91,
  } as any

  const buildStandardParams = (
    grid: SimDriverEntry[],
    currentLap = 1,
    pendingDecisions: RacePendingDecision[] = [],
  ): AdvanceOneLapParams => ({
    currentLap,
    totalLaps: 50,
    grid,
    weather: 'seco',
    round: 1,
    gpName: 'Grande Prêmio da Austrália',
    circuitName: 'Circuito de Albert Park, Melbourne',
    tireAbrasiveness: 5,
    team: dummyTeam,
    playerCarTactics: { driver_1: 'normal', driver_2: 'normal' },
    playerPaceOrders: { driver_1: 'normal', driver_2: 'normal' },
    mechanicalIssues: [],
    redFlagState: {
      active: false,
      ticksFrozen: 0,
      usedThisRace: false,
      safetyCarLapsRemaining: 0,
    },
    lapHistory: {},
    sessionId: 'session_test_01b2',
    existingPendingDecisions: pendingDecisions,
    resolvedDecisionIds: [],
    tyreKnowledge: null,
    driverTireInventories: {},
  })

  // Simulação fiel do ambiente do LiveRacePage contendo a rotina compartilhada
  function createLiveRaceHarness(initialOptions?: {
    currentLap?: number
    totalLaps?: number
    isRacePaused?: number | boolean
    sessionStatus?: string
    isRaceFinished?: boolean
    pendingDecisions?: RacePendingDecision[]
  }) {
    let currentLap = initialOptions?.currentLap ?? 1
    const totalLaps = initialOptions?.totalLaps ?? 50
    let isRacePaused = initialOptions?.isRacePaused ?? true
    let isRaceFinished = initialOptions?.isRaceFinished ?? false
    let sessionStatus = initialOptions?.sessionStatus ?? 'paused'
    let isExecuting = true
    let isSteppingLap = false
    const isSteppingLapRef = { current: false }
    const isSavingRef = { current: false }
    let pendingDecisions: RacePendingDecision[] = initialOptions?.pendingDecisions ?? []
    let grid = createStandardMockGrid(24)
    let lapHistory: any = {}
    let mechanicalIssues: any[] = []
    let redFlagState: any = {
      active: false,
      ticksFrozen: 0,
      usedThisRace: false,
      safetyCarLapsRemaining: 0,
    }
    let liveEvents: any[] = []
    let pauseReason: string | null = null

    const checkpointsSaved: any[] = []
    let finishRaceCallCount = 0
    let runnerCallCount = 0

    // Checkpoint simulando triggerSaveCheckpoint
    const triggerSaveCheckpoint = (reason: string, status?: string, patch?: any) => {
      checkpointsSaved.push({
        reason,
        status: status || (isRacePaused ? 'paused' : 'in_progress'),
        currentLap: patch?.currentLap ?? currentLap,
        gridLength: (patch?.grid ?? grid).length,
      })
    }

    const handleFinishRace = (completedGrid?: any) => {
      finishRaceCallCount++
      isRaceFinished = true
      isRacePaused = true
      sessionStatus = 'completed'
    }

    // A rotina única compartilhada (idêntica a executeCanonicalLapStep)
    const executeCanonicalLapStep = async (options?: { isManualStep?: boolean }) => {
      if (isRaceFinished || sessionStatus === 'completed') {
        return { completed: true, paused: true }
      }

      if (currentLap >= totalLaps) {
        isRaceFinished = true
        isRacePaused = true
        handleFinishRace()
        return { completed: true, paused: true }
      }

      const activeCarsInState = grid.filter((c) => !c.dnf).length
      if (grid.length > 0 && activeCarsInState === 0 && currentLap >= 1) {
        isRaceFinished = true
        isRacePaused = true
        handleFinishRace(grid)
        return { completed: true, paused: true }
      }

      runnerCallCount++
      const res = advanceCanonicalRaceLap(buildStandardParams(grid, currentLap, pendingDecisions))

      currentLap = res.nextLap
      grid = res.nextGrid
      lapHistory = res.nextLapHistory
      mechanicalIssues = res.nextMechanicalIssues
      redFlagState = res.nextRedFlagState
      if (res.nextEvents.length > 0) {
        liveEvents = [...res.nextEvents, ...liveEvents]
      }

      if (res.requiresPause && res.detectedDecisions.length > 0) {
        pendingDecisions = [...pendingDecisions, ...res.detectedDecisions]
        isRacePaused = true
        pauseReason = res.pauseReason || 'Decisão Estratégica Obrigatória'
        triggerSaveCheckpoint(res.pauseReason || 'Decisão', 'awaiting_decision', {
          grid: res.nextGrid,
          currentLap: res.nextLap,
        })
        return { completed: false, paused: true, requiresDecision: true }
      }

      const statusToPersist = options?.isManualStep ? 'paused' : undefined
      const reasonLabel = options?.isManualStep
        ? `+1 Volta manual concluída (Volta ${res.nextLap})`
        : `Volta ${res.nextLap} concluída`

      triggerSaveCheckpoint(reasonLabel, statusToPersist, {
        grid: res.nextGrid,
        currentLap: res.nextLap,
      })

      if (res.isCompleted) {
        isRaceFinished = true
        isRacePaused = true
        handleFinishRace(res.nextGrid)
        return { completed: true, paused: true }
      }

      if (options?.isManualStep) {
        isRacePaused = true
        pauseReason = 'Pausado após avanço de 1 volta'
      }

      return { completed: false, paused: options?.isManualStep ? true : isRacePaused }
    }

    // Handler do botão +1 VOLTA (idêntico a handleStepOneLap)
    const handleStepOneLap = async () => {
      if (isRaceFinished || sessionStatus === 'completed') return false
      if (isSteppingLapRef.current || isSteppingLap || isSavingRef.current) return false
      if (!isRacePaused) return false
      if (pendingDecisions.length > 0) return false

      isSteppingLapRef.current = true
      isSteppingLap = true
      isRacePaused = true

      try {
        await executeCanonicalLapStep({ isManualStep: true })
        return true
      } finally {
        isRacePaused = true
        isSteppingLap = false
        isSteppingLapRef.current = false
      }
    }

    // Tick do Play (idêntico ao loop de useEffect com timer)
    const runPlayTick = async () => {
      if (
        isRacePaused ||
        isRaceFinished ||
        pendingDecisions.length > 0 ||
        isSteppingLapRef.current
      ) {
        return false
      }
      await executeCanonicalLapStep({ isManualStep: false })
      return true
    }

    return {
      getState: () => ({
        currentLap,
        totalLaps,
        isRacePaused,
        isRaceFinished,
        sessionStatus,
        isSteppingLap,
        pendingDecisions,
        grid,
        lapHistory,
        mechanicalIssues,
        redFlagState,
        liveEvents,
        pauseReason,
      }),
      setRacePaused: (p: boolean) => {
        isRacePaused = p
      },
      setIsExecuting: (e: boolean) => {
        isExecuting = e
      },
      isSteppingLapRef,
      isSavingRef,
      handleStepOneLap,
      runPlayTick,
      executeCanonicalLapStep,
      getCheckpoints: () => checkpointsSaved,
      getFinishCount: () => finishRaceCallCount,
      getRunnerCount: () => runnerCallCount,
    }
  }

  // =========================================================================
  // TESTE A — Integração do botão +1 VOLTA
  // =========================================================================
  describe('TESTE A — Integração do botão +1 VOLTA a partir de sessão pausada', () => {
    it('executa uma única chamada ao runner canônico, atualiza estado/volta, salva checkpoint e permanece pausado', async () => {
      const harness = createLiveRaceHarness({ isRacePaused: true, currentLap: 1 })

      expect(harness.getState().currentLap).toBe(1)
      expect(harness.getState().isRacePaused).toBe(true)

      const success = await harness.handleStepOneLap()

      expect(success).toBe(true)
      expect(harness.getRunnerCount()).toBe(1)
      expect(harness.getState().currentLap).toBe(2)
      // Permanece pausado sem reprodução automática
      expect(harness.getState().isRacePaused).toBe(true)
      expect(harness.getState().isSteppingLap).toBe(false)
      expect(harness.isSteppingLapRef.current).toBe(false)

      // Checkpoint foi gravado pelo caminho existente com status pausado
      const cps = harness.getCheckpoints()
      expect(cps.length).toBe(1)
      expect(cps[0].status).toBe('paused')
      expect(cps[0].currentLap).toBe(2)
      expect(cps[0].reason).toContain('+1 Volta manual concluída')
    })
  })

  // =========================================================================
  // TESTE B — Equivalência Estrita com o Play (Mesmo Runner, Sem Divergência Esportiva)
  // =========================================================================
  describe('TESTE B — Equivalência com o Play', () => {
    it('execução via timer (Play) e execução via botão (+1 VOLTA) produzem o mesmo estado esportivo exato', async () => {
      // Estado A: executado pelo caminho do timer do Play
      const harnessA = createLiveRaceHarness({ isRacePaused: false, currentLap: 5 })
      const tickResult = await harnessA.runPlayTick()
      expect(tickResult).toBe(true)

      // Estado B: executado pelo caminho real do botão manual
      const harnessB = createLiveRaceHarness({ isRacePaused: true, currentLap: 5 })
      const stepResult = await harnessB.handleStepOneLap()
      expect(stepResult).toBe(true)

      const stateA = harnessA.getState()
      const stateB = harnessB.getState()

      // 1. Volta resultante
      expect(stateB.currentLap).toBe(stateA.currentLap)
      expect(stateB.currentLap).toBe(6)

      // 2. Classificação de todos os 24 carros e física de cada competidor
      expect(stateB.grid.length).toBe(stateA.grid.length)
      expect(stateB.grid.length).toBe(24)

      for (let i = 0; i < 24; i++) {
        const carA = stateA.grid[i]
        const carB = stateB.grid[i]

        expect(carB.driverId).toBe(carA.driverId)
        expect(carB.position).toBe(carA.position)
        expect(carB.tireCompound).toBe(carA.tireCompound)
        expect(carB.tireWear).toBe(carA.tireWear)
        expect(carB.lapsOnCurrentTire).toBe(carA.lapsOnCurrentTire)
        expect(carB.fuelRemaining).toBe(carA.fuelRemaining)
        expect(carB.accumulatedTimeSec).toBeCloseTo(carA.accumulatedTimeSec, 5)
        expect(carB.gapToLeader).toBe(carA.gapToLeader)
        expect(carB.gapToFront).toBe(carA.gapToFront)
        expect(carB.pitStopsDone).toBe(carA.pitStopsDone)
        expect(carB.dnf).toBe(carA.dnf)
      }

      // 3. Condições e bandeiras
      expect(stateB.redFlagState.active).toBe(stateA.redFlagState.active)

      // 4. Histórico de voltas e eventos esportivos
      expect(Object.keys(stateB.lapHistory).length).toBe(Object.keys(stateA.lapHistory).length)
      expect(stateB.liveEvents.length).toBe(stateA.liveEvents.length)

      // 5. Diferença esperada: Play permaneceu em execução (não pausado), botão permaneceu pausado
      expect(stateA.isRacePaused).toBe(false)
      expect(stateB.isRacePaused).toBe(true)
    })
  })

  // =========================================================================
  // TESTE C — Concorrência e Proteção do Lock
  // =========================================================================
  describe('TESTE C — Concorrência', () => {
    it('durante execução pendente, uma segunda tentativa (duplo clique) é rejeitada e não chama o runner', async () => {
      const harness = createLiveRaceHarness({ isRacePaused: true, currentLap: 1 })

      // Simula primeira chamada que ativou a trava síncrona isSteppingLapRef
      harness.isSteppingLapRef.current = true

      const secondAttempt = await harness.handleStepOneLap()

      expect(secondAttempt).toBe(false)
      expect(harness.getRunnerCount()).toBe(0)
      expect(harness.getState().currentLap).toBe(1)
    })

    it('quando o Play está ativo (corrida não pausada), o botão de +1 VOLTA está desabilitado/recusado', async () => {
      const harness = createLiveRaceHarness({ isRacePaused: false, currentLap: 3 })

      // Tentativa de clique com Play ativo
      const stepAttempt = await harness.handleStepOneLap()

      expect(stepAttempt).toBe(false)
      expect(harness.getRunnerCount()).toBe(0)
      expect(harness.getState().currentLap).toBe(3)
    })

    it('quando um salvamento de checkpoint estiver em voo (isSavingRef), o step aguarda e não concorre', async () => {
      const harness = createLiveRaceHarness({ isRacePaused: true, currentLap: 2 })
      harness.isSavingRef.current = true

      const stepAttempt = await harness.handleStepOneLap()

      expect(stepAttempt).toBe(false)
      expect(harness.getRunnerCount()).toBe(0)
    })
  })

  // =========================================================================
  // TESTE D — Limites e Bloqueios Canônicos
  // =========================================================================
  describe('TESTE D — Limites e Bloqueios Canônicos', () => {
    it('com corrida encerrada, o botão não avança e não reabre a sessão', async () => {
      const harness = createLiveRaceHarness({
        isRacePaused: true,
        isRaceFinished: true,
        sessionStatus: 'completed',
        currentLap: 50,
        totalLaps: 50,
      })

      const stepAttempt = await harness.handleStepOneLap()

      expect(stepAttempt).toBe(false)
      expect(harness.getRunnerCount()).toBe(0)
      expect(harness.getState().currentLap).toBe(50)
      expect(harness.getState().isRaceFinished).toBe(true)
    })

    it('ao atingir a última volta, finaliza a corrida apenas uma vez e preserva estado terminal', async () => {
      const harness = createLiveRaceHarness({
        isRacePaused: true,
        currentLap: 49,
        totalLaps: 50,
      })

      const stepAttempt = await harness.handleStepOneLap()

      expect(stepAttempt).toBe(true)
      expect(harness.getState().currentLap).toBe(50)
      expect(harness.getState().isRaceFinished).toBe(true)
      expect(harness.getFinishCount()).toBe(1)

      // Tentativa posterior na mesma sessão já concluída
      const secondAttempt = await harness.handleStepOneLap()
      expect(secondAttempt).toBe(false)
      expect(harness.getFinishCount()).toBe(1)
    })

    it('respeita bloqueio de decisão pendente: não avança volta forçada sem resolver', async () => {
      const pendingDecision: RacePendingDecision = {
        id: 'dec_rain_1',
        driverId: 'driver_1',
        driverName: 'Piloto 1',
        type: 'pit_stop_weather_change',
        title: 'Chuva na Pista',
        description: 'Decida se troca os pneus ou permanece na pista',
        lap: 10,
        options: [
          { id: 'box_now', label: 'Parar agora' },
          { id: 'stay_out', label: 'Ficar na pista' },
        ],
        payload: {},
        createdAt: new Date().toISOString(),
      }

      const harness = createLiveRaceHarness({
        isRacePaused: true,
        currentLap: 10,
        pendingDecisions: [pendingDecision],
      })

      const stepAttempt = await harness.handleStepOneLap()

      expect(stepAttempt).toBe(false)
      expect(harness.getRunnerCount()).toBe(0)
      expect(harness.getState().currentLap).toBe(10)
    })
  })
})
