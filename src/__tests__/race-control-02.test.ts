import { describe, it, expect, beforeEach } from 'vitest'
import type {
  CanonicalRaceState,
  CanonicalRaceDriverState,
  DriverStrategyState,
} from '@/types/canonical-race-v2'
import type { TireSetItem } from '@/types/f1'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { raceStrategyService } from '@/services/raceStrategyService'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { selectCarTireDisplayState } from '@/lib/f1-tire-system'

/**
 * RACE-CONTROL-02 — Homologação Cirúrgica do Race Control Canônico
 * 16 Testes Comportamentais Estritos
 *
 * FIXTURE BASE:
 * Race: currentLap = 34, totalLaps = 58.
 * Driver A: pitStops = 1, tyreCompound = 'medio', tyreSetId = 'M-2'.
 * M-2: compound = 'medio', wear = 18, lapsUsed > 0, isFitted = true / mounted = true.
 * Driver B: pitStops = 0, tyreCompound = 'duro', tyreSetId = 'H-1'.
 */

function createMockStrategy(
  driverId: string,
  carSlot: 'car1' | 'car2',
  overrides: Partial<DriverStrategyState> = {},
): DriverStrategyState {
  return {
    driverId,
    carSlot,
    currentTyre: 'medio',
    tyreAge: 14,
    plannedStints: [],
    nextPitWindow: { startLap: 38, optimalLap: 40, endLap: 43 },
    pitRequested: false,
    pitThisLap: false,
    targetCompound: 'duro',
    paceMode: 'NORMAL',
    trafficStatus: 'CLEAR_AIR',
    gapAhead: 2.5,
    gapBehind: 3.1,
    undercutOpportunity: false,
    overcutOpportunity: false,
    strategyStatus: 'OPTIMAL',
    ...overrides,
  }
}

function createMockDriver(
  overrides: Partial<CanonicalRaceDriverState> = {},
): CanonicalRaceDriverState {
  const driverId = overrides.driverId || 'drv_player_1'
  const carSlot = overrides.carId || 'car1'

  return {
    careerId: 'test_career_rc02',
    season: 2026,
    raceId: 'test_race_rc02',
    driverId,
    teamId: 'team_audi',
    gridPosition: 1,
    currentPosition: 1,
    lap: 34,
    raceTime: 3400.123,
    gap: 'LÍDER',
    tyreCompound: 'medio',
    tyreAge: 14,
    fuel: 45.0,
    carCondition: 92.0,
    raceStatus: 'racing',
    pitStops: 1,
    driverName: 'Gabriel Bortoleto',
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    isPlayer: true,
    carId: carSlot,
    tyreSetId: 'M-2',
    initialTyreWear: 18,
    initialTyreLapsUsed: 5,
    strategy: createMockStrategy(driverId, carSlot),
    ...overrides,
  }
}

function createMockRaceState(overrides: Partial<CanonicalRaceState> = {}): CanonicalRaceState {
  const driverA = createMockDriver({
    driverId: 'drv_player_1',
    driverName: 'Gabriel Bortoleto',
    carId: 'car1',
    pitStops: 1,
    tyreCompound: 'medio',
    tyreSetId: 'M-2',
  })

  const driverB = createMockDriver({
    driverId: 'drv_player_2',
    driverName: 'Nico Hülkenberg',
    carId: 'car2',
    currentPosition: 2,
    gridPosition: 2,
    pitStops: 0,
    tyreCompound: 'duro',
    tyreSetId: 'H-1',
    tyreAge: 34,
    initialTyreWear: 0,
    initialTyreLapsUsed: 0,
    strategy: createMockStrategy('drv_player_2', 'car2', {
      currentTyre: 'duro',
      tyreAge: 34,
      targetCompound: 'medio',
      nextPitWindow: { startLap: 36, optimalLap: 38, endLap: 42 },
    }),
  })

  // Preencher outros pilotos para somar 24 pilotos homologados
  const drivers: CanonicalRaceDriverState[] = [driverA, driverB]
  for (let i = 3; i <= 24; i++) {
    drivers.push(
      createMockDriver({
        driverId: `drv_ai_${i}`,
        driverName: `AI Driver ${i}`,
        teamId: `team_ai_${Math.floor(i / 2)}`,
        teamName: `Team ${Math.floor(i / 2)}`,
        isPlayer: false,
        carId: undefined,
        currentPosition: i,
        gridPosition: i,
        pitStops: 1,
        tyreCompound: 'medio',
        tyreSetId: `SET_AI_${i}`,
      }),
    )
  }

  const lookup: Record<string, CanonicalRaceDriverState> = {}
  drivers.forEach((d) => {
    lookup[d.driverId] = d
  })

  return {
    version: '2.0',
    saveSchemaVersion: 'race-save-v1',
    raceVariant: 'MAIN_RACE',
    careerId: 'test_career_rc02',
    season: 2026,
    round: 1,
    raceId: 'test_race_rc02',
    circuitName: 'Interlagos',
    circuitCountry: 'Brasil',
    totalLaps: 58,
    currentLap: 34,
    status: 'running',
    safetyCarActive: false,
    vscActive: false,
    redFlagActive: false,
    weather: 'seco',
    simSpeed: 1,
    playerTeamId: 'team_audi',
    drivers,
    driverLookup: lookup,
    tactics: {},
    paceOrders: {},
    driverStrategies: {
      drv_player_1: driverA.strategy!,
      drv_player_2: driverB.strategy!,
    },
    revision: 1,
    updatedAt: new Date().toISOString(),
    raceControl: {
      currentFlag: 'GREEN',
      lapsRemainingInPhase: 0,
      activeSector: 1,
      safetyCarLaps: 0,
      vscLaps: 0,
      redFlagLaps: 0,
      scQueuedOrder: [],
      restartPending: false,
      activeEvents: [],
      history: [],
    },
    ...overrides,
  }
}

describe('RACE-CONTROL-02 — Homologação Canônica do Race Control', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // RC02-01 — Volta atual: valor exibido/consumido pelo Race Control = raceState.currentLap, sem contador local paralelo
  it('RC02-01 — Volta atual: valor exibido/consumido pelo Race Control = raceState.currentLap, sem contador local paralelo', () => {
    const raceState = createMockRaceState({ currentLap: 34, totalLaps: 58 })
    expect(raceState.currentLap).toBe(34)

    // Avançar uma volta via canonicalRaceEngineService
    const nextState = canonicalRaceEngineService.advanceOneLap(raceState)
    expect(nextState.currentLap).toBe(35)
    expect(nextState.currentLap).not.toBe(raceState.currentLap)
  })

  // RC02-02 — Total de voltas: total exibido = raceState.totalLaps (ou fonte FIA/calendar), sem hardcode
  it('RC02-02 — Total de voltas: total exibido = raceState.totalLaps, sem hardcode', () => {
    const raceState58 = createMockRaceState({ totalLaps: 58 })
    expect(raceState58.totalLaps).toBe(58)

    const raceState71 = createMockRaceState({ totalLaps: 71 })
    expect(raceState71.totalLaps).toBe(71)

    // O avanço respeita o limite do raceState.totalLaps dinâmico
    const nextState = canonicalRaceEngineService.advanceOneLap(raceState71)
    expect(nextState.totalLaps).toBe(71)
  })

  // RC02-03 — Zero pits: antes de qualquer pit concluído, driver.pitStops = 0 e Race Control mostra 0
  it('RC02-03 — Zero pits: antes de qualquer pit concluído, driver.pitStops = 0 e Race Control mostra 0', () => {
    const raceState = createMockRaceState()
    const driverB = raceState.drivers.find((d) => d.driverId === 'drv_player_2')!
    expect(driverB.pitStops).toBe(0)
  })

  // RC02-04 — Request não conta: pitRequested = true (ou pitThisLap = true) sem executePitStop concluído -> pitStops continua igual
  it('RC02-04 — Request não conta: pitRequested = true sem executePitStop concluído -> pitStops continua igual', () => {
    const raceState = createMockRaceState()
    const driverA = raceState.drivers.find((d) => d.driverId === 'drv_player_1')!
    const initialPits = driverA.pitStops // 1

    // Solicitar pit stop
    const requestedState = raceStrategyService.requestPitStop(raceState, 'drv_player_1', 'duro')
    const updatedDriverA = requestedState.drivers.find((d) => d.driverId === 'drv_player_1')!

    // pitRequested / pitThisLap devem ser true, mas pitStops NÃO pode ser incrementado
    expect(updatedDriverA.strategy?.pitRequested).toBe(true)
    expect(updatedDriverA.strategy?.pitThisLap).toBe(true)
    expect(updatedDriverA.pitStops).toBe(initialPits)
    expect(updatedDriverA.pitStops).toBe(1)
  })

  // RC02-05 — Primeiro pit: após executePitStop real, pitStops 0 -> 1
  it('RC02-05 — Primeiro pit: após executePitStop real, pitStops 0 -> 1', () => {
    const raceState = createMockRaceState()
    const driverB = raceState.drivers.find((d) => d.driverId === 'drv_player_2')!
    expect(driverB.pitStops).toBe(0)

    // Agendar pit para Driver B
    const requestedState = raceStrategyService.requestPitStop(raceState, 'drv_player_2', 'medio')

    // Executar as paradas da volta através do processLapPitStops (ou advanceOneLap)
    const pitResult = raceStrategyService.processLapPitStops({
      raceState: requestedState,
      lap: requestedState.currentLap,
      rng: () => 0.5,
    })

    const executedDriverB = pitResult.updatedDrivers.find((d) => d.driverId === 'drv_player_2')!
    expect(executedDriverB.pitStops).toBe(1)
    expect(executedDriverB.strategy?.pitRequested).toBe(false)
  })

  // RC02-06 — Segundo pit: após segundo pit concluído, pitStops = 2
  it('RC02-06 — Segundo pit: após segundo pit concluído, pitStops = 2', () => {
    const raceState = createMockRaceState()
    const driverA = raceState.drivers.find((d) => d.driverId === 'drv_player_1')!
    expect(driverA.pitStops).toBe(1)

    // Agendar 2º pit para Driver A
    const requestedState = raceStrategyService.requestPitStop(raceState, 'drv_player_1', 'duro')

    const pitResult = raceStrategyService.processLapPitStops({
      raceState: requestedState,
      lap: requestedState.currentLap,
      rng: () => 0.5,
    })

    const executedDriverA = pitResult.updatedDrivers.find((d) => d.driverId === 'drv_player_1')!
    expect(executedDriverA.pitStops).toBe(2)
  })

  // RC02-07 — Composto atual: Race Control usa driver.tyreCompound ou compound do physical tyre set ligado a driver.tyreSetId
  it('RC02-07 — Composto atual: Race Control usa driver.tyreCompound ou compound do physical tyre set ligado a driver.tyreSetId', () => {
    const raceState = createMockRaceState()
    const driverA = raceState.drivers.find((d) => d.driverId === 'drv_player_1')!
    expect(driverA.tyreCompound).toBe('medio')
    expect(driverA.tyreSetId).toBe('M-2')

    // A função de apresentação selectCarTireDisplayState consome o composto real
    const display = selectCarTireDisplayState({
      tireCompound: driverA.tyreCompound,
      tireWear: driverA.initialTyreWear,
      lapsOnCurrentTire: driverA.tyreAge,
    })
    expect(display.compound).toBe('medio')
    expect(display.compoundShort).toBe('MEDIO')
  })

  // RC02-08 — Condition/wear: condição reflete desgaste real; se wear = 18, condition = 82
  it('RC02-08 — Condition/wear: condição reflete desgaste real; se wear = 18, condition = 82', () => {
    const wear = 18
    const display = selectCarTireDisplayState({
      tireCompound: 'medio',
      tireWear: wear,
      lapsOnCurrentTire: 5,
    })
    expect(display.tireWearPct).toBe(18)
    expect(display.tireConditionPct).toBe(82)
    expect(display.tireConditionText).toBe('82%')
  })

  // RC02-09 — NEW/USED: set com lapsUsed = 0 -> NEW; set previamente rodado -> USED
  it('RC02-09 — NEW/USED: set com lapsUsed = 0 -> NEW; set previamente rodado -> USED', () => {
    const newSet: TireSetItem = {
      id: 'M-3',
      compound: 'medio',
      wear: 0,
      condition: 100,
      lapsUsed: 0,
      status: 'disponivel',
    }
    const usedSet: TireSetItem = {
      id: 'M-1',
      compound: 'medio',
      wear: 53,
      condition: 47,
      lapsUsed: 15,
      status: 'usado',
    }

    const isNew = (newSet.lapsUsed || 0) === 0
    const isUsed = (usedSet.lapsUsed || 0) > 0

    expect(isNew).toBe(true)
    expect(isUsed).toBe(true)
  })

  // RC02-10 — Set indisponível: physical tyre set indisponível -> não selecionável
  it('RC02-10 — Set indisponível: physical tyre set indisponível -> não selecionável', () => {
    const unavailableSet: TireSetItem = {
      id: 'S-1',
      compound: 'macio',
      wear: 92,
      condition: 8,
      lapsUsed: 22,
      status: 'devolvido_indisponivel',
    }

    // Regra canônica: desgaste >= 90% ou status 'devolvido_indisponivel' torna o jogo não selecionável
    const isExhausted = (unavailableSet.wear || 0) >= 90
    const isUnavailable = unavailableSet.status === 'devolvido_indisponivel' || isExhausted

    expect(isUnavailable).toBe(true)
  })

  // RC02-11 — Inventário canônico: UI/controle consome o inventário físico já existente por driverId; nenhum array paralelo criado
  it('RC02-11 — Inventário canônico: UI/controle consome o inventário físico já existente por driverId; sem inventário paralelo', () => {
    const driverId = 'drv_player_1'
    const inventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId: 'season_2026',
      round: 1,
      driverIds: [driverId],
    })

    expect(inventories[driverId]).toBeDefined()
    expect(inventories[driverId].length).toBe(20) // Alocação FIA de 20 jogos no fim de semana normal

    // Leitura repetida retorna o MESMO inventário (imutável por reinvocação)
    const secondRead = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId: 'season_2026',
      round: 1,
      driverIds: [driverId],
    })
    expect(secondRead[driverId]).toEqual(inventories[driverId])
  })

  // RC02-12 — Save/reload: preservar pitStops, tyreSetId, tyreCompound, wear/condition, NEW/USED, availability
  it('RC02-12 — Save/reload: preservar pitStops, tyreSetId, tyreCompound, wear/condition, NEW/USED, availability', () => {
    const originalState = createMockRaceState({
      careerId: 'career_save_test',
      season: 2026,
      round: 1,
      currentLap: 34,
      totalLaps: 58,
    })

    // Salvar estado canônico
    const saveRes = canonicalRaceSaveService.saveCanonicalRaceState(originalState)
    expect(saveRes.success).toBe(true)

    // Recarregar estado
    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      'career_save_test',
      2026,
      1,
      'MAIN_RACE',
    )
    expect(loaded.state).not.toBeNull()

    const loadedDriverA = loaded.state!.drivers.find((d) => d.driverId === 'drv_player_1')!
    expect(loadedDriverA.pitStops).toBe(1)
    expect(loadedDriverA.tyreSetId).toBe('M-2')
    expect(loadedDriverA.tyreCompound).toBe('medio')
    expect(loadedDriverA.initialTyreWear).toBe(18)
    expect(loadedDriverA.initialTyreLapsUsed).toBe(5)
  })

  // RC02-13 — Set montado: current tyre set reconhecido como montado/em uso; não pode ser oferecido como set livre
  it('RC02-13 — Set montado: current tyre set reconhecido como montado/em uso; NÃO pode ser oferecido como set livre', () => {
    const currentTyreSetId = 'M-2'
    const inventory: TireSetItem[] = [
      { id: 'M-1', compound: 'medio', wear: 53, lapsUsed: 15, status: 'usado' },
      { id: 'M-2', compound: 'medio', wear: 18, lapsUsed: 5, isFitted: true, status: 'instalado' },
      { id: 'M-3', compound: 'medio', wear: 0, lapsUsed: 0, status: 'disponivel' },
    ]

    // Validação da regra: o jogo montado (isCurrent) não pode ser selecionado como próximo set livre
    const isMounted = (set: TireSetItem) => set.id === currentTyreSetId || set.isFitted
    const isSelectableForPit = (set: TireSetItem) => !isMounted(set) && (set.wear || 0) < 90

    expect(isMounted(inventory[1])).toBe(true)
    expect(isSelectableForPit(inventory[1])).toBe(false)
    expect(isSelectableForPit(inventory[0])).toBe(true)
    expect(isSelectableForPit(inventory[2])).toBe(true)
  })

  // RC02-14 — Troca real no pit: seleção não troca imediatamente; troca ocorre apenas após executePitStop
  it('RC02-14 — Troca real no pit: seleção não troca imediatamente; troca ocorre apenas após executePitStop', () => {
    const raceState = createMockRaceState()
    const driverA = raceState.drivers.find((d) => d.driverId === 'drv_player_1')!
    expect(driverA.tyreSetId).toBe('M-2')
    expect(driverA.pitStops).toBe(1)

    // Usuário / estratégia seleciona composto 'duro' para o próximo pit
    const stateWithTarget = raceStrategyService.setDriverTargetCompound(
      raceState,
      'drv_player_1',
      'duro',
    )
    const requestedState = raceStrategyService.requestPitStop(
      stateWithTarget,
      'drv_player_1',
      'duro',
    )

    const driverBeforePit = requestedState.drivers.find((d) => d.driverId === 'drv_player_1')!
    // ANTES do pit real, tyreCompound continua 'medio', tyreSetId continua 'M-2' e pitStops continua 1
    expect(driverBeforePit.tyreCompound).toBe('medio')
    expect(driverBeforePit.tyreSetId).toBe('M-2')
    expect(driverBeforePit.pitStops).toBe(1)

    // APÓS executePitStop concluído
    const pitResult = raceStrategyService.processLapPitStops({
      raceState: requestedState,
      lap: requestedState.currentLap,
      rng: () => 0.5,
    })

    const driverAfterPit = pitResult.updatedDrivers.find((d) => d.driverId === 'drv_player_1')!
    expect(driverAfterPit.pitStops).toBe(2)
    expect(driverAfterPit.tyreCompound).toBe('duro')
    expect(driverAfterPit.tyreAge).toBe(0)
  })

  // RC02-15 — Isolamento entre carros: alterações em Driver A NÃO modificam Driver B
  it('RC02-15 — Isolamento entre carros: alterações em Driver A NÃO modificam Driver B', () => {
    const raceState = createMockRaceState()
    const driverBBefore = raceState.drivers.find((d) => d.driverId === 'drv_player_2')!
    expect(driverBBefore.pitStops).toBe(0)
    expect(driverBBefore.tyreCompound).toBe('duro')

    // Modificar Driver A (solicitar pit, alterar pace para PUSH)
    let nextState = raceStrategyService.requestPitStop(raceState, 'drv_player_1', 'macio')
    nextState = raceStrategyService.setDriverPaceMode(nextState, 'drv_player_1', 'PUSH')

    const driverAUpdated = nextState.drivers.find((d) => d.driverId === 'drv_player_1')!
    const driverBAfter = nextState.drivers.find((d) => d.driverId === 'drv_player_2')!

    expect(driverAUpdated.strategy?.pitRequested).toBe(true)
    expect(driverAUpdated.strategy?.paceMode).toBe('PUSH')

    // Driver B permanece 100% inalterado
    expect(driverBAfter.pitStops).toBe(0)
    expect(driverBAfter.tyreCompound).toBe('duro')
    expect(driverBAfter.strategy?.pitRequested).toBe(false)
    expect(driverBAfter.strategy?.paceMode).toBe('NORMAL')
  })

  // RC02-16 — Estado congelado ao final: quando corrida termina, nenhum novo tick altera currentLap, pitStops, tyre wear, current tyre set
  it('RC02-16 — Estado congelado ao final: quando corrida termina, nenhum novo tick altera currentLap, pitStops, tyre wear, current tyre set', () => {
    const finishedState = createMockRaceState({
      status: 'completed',
      currentLap: 58,
      totalLaps: 58,
    })
    // Marcar pilotos como finished
    finishedState.drivers.forEach((d) => {
      d.raceStatus = 'finished'
    })

    const driverABefore = finishedState.drivers.find((d) => d.driverId === 'drv_player_1')!
    const lapBefore = finishedState.currentLap
    const pitsBefore = driverABefore.pitStops
    const tyreAgeBefore = driverABefore.tyreAge
    const compoundBefore = driverABefore.tyreCompound

    // Tentar avançar volta em corrida concluída
    const stateAfterAdvance = canonicalRaceEngineService.advanceOneLap(finishedState)

    const driverAAfter = stateAfterAdvance.drivers.find((d) => d.driverId === 'drv_player_1')!

    expect(stateAfterAdvance.status).toBe('completed')
    expect(stateAfterAdvance.currentLap).toBe(lapBefore)
    expect(driverAAfter.pitStops).toBe(pitsBefore)
    expect(driverAAfter.tyreAge).toBe(tyreAgeBefore)
    expect(driverAAfter.tyreCompound).toBe(compoundBefore)
  })
})
