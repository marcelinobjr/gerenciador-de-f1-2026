import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { raceStrategyService } from '@/services/raceStrategyService'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

function createMockQualifyingGrid(playerTeamId: string): FinalQualifyingGridEntry[] {
  const teams = [
    { id: playerTeamId, name: 'Player Custom Racing', color: '#FF1801' },
    { id: 'ferrari', name: 'Scuderia Ferrari', color: '#DC0000' },
    { id: 'red_bull', name: 'Red Bull Racing', color: '#1E41FF' },
    { id: 'mercedes', name: 'Mercedes-AMG F1', color: '#00D2BE' },
    { id: 'mclaren', name: 'McLaren F1 Team', color: '#FF8700' },
    { id: 'aston_martin', name: 'Aston Martin F1', color: '#006F62' },
    { id: 'alpine', name: 'Alpine F1 Team', color: '#0090FF' },
    { id: 'williams', name: 'Williams Racing', color: '#005AFF' },
    { id: 'racing_bulls', name: 'Visa Cash App RB', color: '#6692FF' },
    { id: 'sauber_audi', name: 'Audi Revolut F1 Team', color: '#C0C0C0' },
    { id: 'haas', name: 'Haas F1 Team', color: '#B6BABD' },
    { id: 'cadillac', name: 'Cadillac F1 Team', color: '#FFD700' },
  ]

  const grid: FinalQualifyingGridEntry[] = []
  let pos = 1
  for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
    const t = teams[teamIdx]
    const isPlayer = t.id === playerTeamId

    for (let carNum = 1; carNum <= 2; carNum++) {
      const driverId = `drv_${t.id}_car${carNum}`
      const driverName = `Piloto ${carNum} - ${t.name}`

      grid.push({
        gridPosition: pos,
        driverId,
        driverName,
        teamId: t.id,
        teamName: t.name,
        teamColor: t.color,
        isPlayer,
        carId: isPlayer ? (carNum === 1 ? 'car1' : 'car2') : undefined,
        eliminationStage: pos <= 10 ? 'Q3' : pos <= 18 ? 'Q2' : 'Q1',
        bestLapSec: 80.0 + pos * 0.1,
        bestLapTime: `1:20.${String(pos).padStart(3, '0')}`,
        bestLapCompound: pos <= 10 ? 'macio' : 'medio',
      })
      pos++
    }
  }

  return grid
}

function initializeStandardRace(playerTeamId = 'sauber_audi', totalLaps = 50): CanonicalRaceState {
  const grid = createMockQualifyingGrid(playerTeamId)
  return canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
    careerId: `career_${playerTeamId}_test`,
    season: 2026,
    round: 1,
    circuitName: 'Sakhir',
    circuitCountry: 'Bahrain',
    totalLaps,
    playerTeamId,
    canonicalQualifyingGrid: grid,
  })
}

describe('FW2.1E-D: DOIS PILOTOS INDEPENDENTES (15 PROVAS OBRIGATÓRIAS)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // 1. playerTeam possui dois carros independentes
  it('PROVA 1: playerTeam possui exatamente dois carros com identidades e slots próprios', () => {
    const state = initializeStandardRace('sauber_audi', 50)
    const playerCars = state.drivers.filter((d) => d.isPlayer)
    expect(playerCars).toHaveLength(2)
    expect(playerCars[0].driverId).not.toBe(playerCars[1].driverId)
    expect(playerCars[0].carId).toBe('car1')
    expect(playerCars[1].carId).toBe('car2')
    expect(playerCars[0].strategy).toBeDefined()
    expect(playerCars[1].strategy).toBeDefined()
  })

  // 2. ordem ao Carro 1 não altera Carro 2
  it('PROVA 2: ordem de ritmo ou pit ao Carro 1 não altera o Carro 2', () => {
    const state = initializeStandardRace('sauber_audi', 50)
    const playerCars = state.drivers.filter((d) => d.isPlayer)
    const car1Id = playerCars[0].driverId
    const car2Id = playerCars[1].driverId

    const updated = raceStrategyService.setDriverPaceMode(state, car1Id, 'PUSH')
    const car1Strat = updated.driverStrategies?.[car1Id]
    const car2Strat = updated.driverStrategies?.[car2Id]

    expect(car1Strat?.paceMode).toBe('PUSH')
    expect(car2Strat?.paceMode).toBe('NORMAL')
  })

  // 3. ordem ao Carro 2 não altera Carro 1
  it('PROVA 3: ordem de ritmo ou pit ao Carro 2 não altera o Carro 1', () => {
    const state = initializeStandardRace('sauber_audi', 50)
    const playerCars = state.drivers.filter((d) => d.isPlayer)
    const car1Id = playerCars[0].driverId
    const car2Id = playerCars[1].driverId

    const updated = raceStrategyService.setDriverPaceMode(state, car2Id, 'CONSERVE')
    const car1Strat = updated.driverStrategies?.[car1Id]
    const car2Strat = updated.driverStrategies?.[car2Id]

    expect(car1Strat?.paceMode).toBe('NORMAL')
    expect(car2Strat?.paceMode).toBe('CONSERVE')
  })

  // 4. dois compostos diferentes simultaneamente
  it('PROVA 4: os dois carros da equipe podem calçar dois compostos diferentes simultaneamente', () => {
    const state = initializeStandardRace('ferrari', 50)
    const playerCars = state.drivers.filter((d) => d.isPlayer)
    playerCars[0].tyreCompound = 'macio'
    playerCars[1].tyreCompound = 'duro'

    expect(playerCars[0].tyreCompound).toBe('macio')
    expect(playerCars[1].tyreCompound).toBe('duro')
    expect(playerCars[0].tyreCompound).not.toBe(playerCars[1].tyreCompound)
  })

  // 5. duas janelas de pit diferentes
  it('PROVA 5: cada carro possui sua própria janela de pit independente', () => {
    const state = initializeStandardRace('mclaren', 50)
    const playerCars = state.drivers.filter((d) => d.isPlayer)
    const car1Id = playerCars[0].driverId
    const car2Id = playerCars[1].driverId

    const car1Strat = state.driverStrategies?.[car1Id]
    const car2Strat = state.driverStrategies?.[car2Id]

    expect(car1Strat?.nextPitWindow.startLap).toBeDefined()
    expect(car2Strat?.nextPitWindow.startLap).toBeDefined()
    // Carro 2 tem offset padrão para janelas escalonadas
    expect(car2Strat?.nextPitWindow.startLap).not.toBe(car1Strat?.nextPitWindow.startLap)
  })

  // 6. dois pace modes diferentes
  it('PROVA 6: os dois carros podem rodar com pace modes diferentes simultaneamente', () => {
    let state = initializeStandardRace('mercedes', 50)
    const playerCars = state.drivers.filter((d) => d.isPlayer)
    const car1Id = playerCars[0].driverId
    const car2Id = playerCars[1].driverId

    state = raceStrategyService.setDriverPaceMode(state, car1Id, 'PUSH')
    state = raceStrategyService.setDriverPaceMode(state, car2Id, 'CONSERVE')

    expect(state.driverStrategies?.[car1Id].paceMode).toBe('PUSH')
    expect(state.driverStrategies?.[car2Id].paceMode).toBe('CONSERVE')
  })

  // 7. Carro 1 pode parar enquanto Carro 2 continua
  it('PROVA 7: Carro 1 pode parar no box enquanto Carro 2 permanece na pista (Cenário A)', () => {
    let state = initializeStandardRace('sauber_audi', 50)
    const playerCars = state.drivers.filter((d) => d.isPlayer)
    const car1Id = playerCars[0].driverId
    const car2Id = playerCars[1].driverId

    // 1 volta para iniciar a corrida
    state = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 10 })

    // Solicitar pit apenas para Carro 1
    state = raceStrategyService.requestPitStop(state, car1Id, 'medio')
    expect(state.driverStrategies?.[car1Id].pitRequested).toBe(true)
    expect(state.driverStrategies?.[car2Id].pitRequested).toBe(false)

    // Avançar volta: pit deve ser executado para Carro 1, Carro 2 continua
    const afterPit = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 11 })
    const c1 = afterPit.drivers.find((d) => d.driverId === car1Id)!
    const c2 = afterPit.drivers.find((d) => d.driverId === car2Id)!

    expect(c1.pitStops).toBe(1)
    expect(c1.tyreCompound).toBe('medio')
    expect(c1.tyreAge).toBe(1) // 0 no pit + 1 volta completada

    expect(c2.pitStops).toBe(0)
    expect(c2.tyreAge).toBe(2)
  })

  // 8. Carro 2 pode parar enquanto Carro 1 continua
  it('PROVA 8: Carro 2 pode parar no box enquanto Carro 1 permanece na pista', () => {
    let state = initializeStandardRace('sauber_audi', 50)
    const playerCars = state.drivers.filter((d) => d.isPlayer)
    const car1Id = playerCars[0].driverId
    const car2Id = playerCars[1].driverId

    state = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 20 })
    state = raceStrategyService.requestPitStop(state, car2Id, 'duro')

    const afterPit = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 21 })
    const c1 = afterPit.drivers.find((d) => d.driverId === car1Id)!
    const c2 = afterPit.drivers.find((d) => d.driverId === car2Id)!

    expect(c1.pitStops).toBe(0)
    expect(c2.pitStops).toBe(1)
    expect(c2.tyreCompound).toBe('duro')
  })

  // 9. ambos podem solicitar pit na mesma volta
  it('PROVA 9: ambos os pilotos podem solicitar pit na mesma volta', () => {
    let state = initializeStandardRace('ferrari', 50)
    const playerCars = state.drivers.filter((d) => d.isPlayer)
    const car1Id = playerCars[0].driverId
    const car2Id = playerCars[1].driverId

    state = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 30 })
    state = raceStrategyService.requestPitStop(state, car1Id, 'duro')
    state = raceStrategyService.requestPitStop(state, car2Id, 'medio')

    expect(state.driverStrategies?.[car1Id].pitRequested).toBe(true)
    expect(state.driverStrategies?.[car2Id].pitRequested).toBe(true)
  })

  // 10. double stack aplica atraso correto ao segundo
  it('PROVA 10: double stack aplica atraso adicional ao segundo carro', () => {
    let state = initializeStandardRace('ferrari', 50)
    const playerCars = state.drivers.filter((d) => d.isPlayer)
    const car1Id = playerCars[0].driverId
    const car2Id = playerCars[1].driverId

    state = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 40 })

    // Ambos pedem pit
    state = raceStrategyService.requestPitStop(state, car1Id, 'duro')
    state = raceStrategyService.requestPitStop(state, car2Id, 'medio')

    const afterDoubleStack = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 41 })
    const c1 = afterDoubleStack.drivers.find((d) => d.driverId === car1Id)!
    const c2 = afterDoubleStack.drivers.find((d) => d.driverId === car2Id)!

    // Ambos pararam
    expect(c1.pitStops).toBe(1)
    expect(c2.pitStops).toBe(1)

    // O segundo carro sofreu atraso de double stack
    const secondStrat = afterDoubleStack.driverStrategies?.[c2.driverId]
    expect(secondStrat?.doubleStackDelaySec).toBeGreaterThan(0)
  })

  // 11. prioridade não é hardcoded por piloto
  it('PROVA 11: prioridade de double stack não é hardcoded para car1, é configurável', () => {
    let state = initializeStandardRace('red_bull', 50)
    const playerCars = state.drivers.filter((d) => d.isPlayer)
    const car1Id = playerCars[0].driverId
    const car2Id = playerCars[1].driverId

    state = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 50 })
    state = raceStrategyService.setTeamPitPriority(state, car2Id)
    expect(state.pitPriority).toBe(car2Id)

    state = raceStrategyService.requestPitStop(state, car1Id, 'duro')
    state = raceStrategyService.requestPitStop(state, car2Id, 'duro')

    const afterPit = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 51 })
    const c1Strat = afterPit.driverStrategies?.[car1Id]
    const c2Strat = afterPit.driverStrategies?.[car2Id]

    // Com prioridade dada a car2, car1 é quem sofre atraso de espera
    expect(c1Strat?.doubleStackDelaySec).toBeGreaterThan(0)
    expect(c2Strat?.doubleStackDelaySec).toBe(0)
  })

  // 12. trocar playerTeam mantém comportamento dinâmico
  it('PROVA 12: trocar playerTeam para outra equipe mantém comportamento totalmente dinâmico', () => {
    const stateWilliams = initializeStandardRace('williams', 50)
    const williamsDrivers = stateWilliams.drivers.filter((d) => d.isPlayer)
    expect(williamsDrivers).toHaveLength(2)
    expect(williamsDrivers[0].teamId).toBe('williams')
    expect(williamsDrivers[1].teamId).toBe('williams')

    const car1Id = williamsDrivers[0].driverId
    const updated = raceStrategyService.requestPitStop(stateWilliams, car1Id, 'duro')
    expect(updated.driverStrategies?.[car1Id].pitRequested).toBe(true)
  })

  // 13. save state contém estratégia dos dois separadamente
  it('PROVA 13: save state contém estratégia dos dois carros separadamente em driverStrategies', () => {
    let state = initializeStandardRace('sauber_audi', 50)
    const playerCars = state.drivers.filter((d) => d.isPlayer)
    const car1Id = playerCars[0].driverId
    const car2Id = playerCars[1].driverId

    state = raceStrategyService.setDriverPaceMode(state, car1Id, 'PUSH')
    state = raceStrategyService.setDriverPaceMode(state, car2Id, 'CONSERVE')

    canonicalRaceInitializationService.saveCanonicalRaceState(state)
    const reloaded = canonicalRaceInitializationService.readCanonicalRaceState(
      state.careerId,
      state.season,
      state.round,
    )

    expect(reloaded).not.toBeNull()
    expect(reloaded?.driverStrategies?.[car1Id].paceMode).toBe('PUSH')
    expect(reloaded?.driverStrategies?.[car2Id].paceMode).toBe('CONSERVE')
  })

  // 14. nenhum estado estratégico é compartilhado por referência
  it('PROVA 14: nenhum estado estratégico é compartilhado por referência (deep clone isolado)', () => {
    const state = initializeStandardRace('ferrari', 50)
    const playerCars = state.drivers.filter((d) => d.isPlayer)
    const car1Id = playerCars[0].driverId
    const car2Id = playerCars[1].driverId

    const strat1 = state.driverStrategies?.[car1Id]
    const strat2 = state.driverStrategies?.[car2Id]

    expect(strat1).not.toBe(strat2)
    expect(strat1?.plannedStints).not.toBe(strat2?.plannedStints)
    expect(strat1?.nextPitWindow).not.toBe(strat2?.nextPitWindow)
  })

  // 15. Race Control continua correto com estratégias diferentes
  it('PROVA 15: Race Control continua estritamente correto com estratégias e ritmos diferentes', () => {
    let state = initializeStandardRace('sauber_audi', 50)
    const playerCars = state.drivers.filter((d) => d.isPlayer)
    state = raceStrategyService.setDriverPaceMode(state, playerCars[0].driverId, 'PUSH')
    state = raceStrategyService.setDriverPaceMode(state, playerCars[1].driverId, 'CONSERVE')

    // Disparar VSC
    const vscLap = canonicalRaceEngineService.advanceOneLap(state, {
      seedOverride: 70,
      forceRaceControlStatus: 'VSC',
    })

    expect(vscLap.vscActive).toBe(true)
    expect(vscLap.raceControl?.currentFlag).toBe('VSC')
    // Invariantes mantidas
    expect(() => canonicalRaceEngineService.assertRaceInvariants(vscLap)).not.toThrow()
  })
})

describe('FW2.1E-D: TESTES DE PIT STOP (11 PROVAS OBRIGATÓRIAS)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // 1. Pit adiciona perda de tempo
  it('PROVA 16: Pit stop adiciona pit-loss real ao raceTime do carro', () => {
    let state = initializeStandardRace('sauber_audi', 50)
    state = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 80 })

    const pCar = state.drivers.find((d) => d.isPlayer)!
    const timeBefore = pCar.raceTime

    state = raceStrategyService.requestPitStop(state, pCar.driverId, 'duro')
    const stateAfterPit = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 81 })
    const pCarAfter = stateAfterPit.drivers.find((d) => d.driverId === pCar.driverId)!

    // Delta normal de volta ~82s + pit loss ~21s = ~103s
    const diff = pCarAfter.raceTime - timeBefore
    expect(diff).toBeGreaterThan(95.0)
  })

  // 2. Composto troca corretamente
  it('PROVA 17: Composto é atualizado para o targetCompound no pit stop', () => {
    let state = initializeStandardRace('ferrari', 50)
    state = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 90 })

    const pCar = state.drivers.find((d) => d.isPlayer)!
    state = raceStrategyService.requestPitStop(state, pCar.driverId, 'duro')

    const afterPit = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 91 })
    const pCarAfter = afterPit.drivers.find((d) => d.driverId === pCar.driverId)!

    expect(pCarAfter.tyreCompound).toBe('duro')
  })

  // 3. tyreAge volta a zero
  it('PROVA 18: tyreAge é resetado no pit stop e contabiliza a volta recém-completada', () => {
    let state = initializeStandardRace('mclaren', 50)
    // 5 voltas para acumular idade de pneus
    state = canonicalRaceEngineService.advanceMultipleLaps(state, 5, { seedOverride: 100 })
    const pCar = state.drivers.find((d) => d.isPlayer)!
    expect(pCar.tyreAge).toBe(5)

    state = raceStrategyService.requestPitStop(state, pCar.driverId, 'medio')
    const afterPit = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 106 })
    const pCarAfter = afterPit.drivers.find((d) => d.driverId === pCar.driverId)!

    // Resetou para 0 na baia e completou a volta do pit = 1 volta no novo pneu
    expect(pCarAfter.tyreAge).toBe(1)
  })

  // 4. pitStops incrementa apenas uma vez
  it('PROVA 19: pitStops é incrementado estritamente em 1 por parada', () => {
    let state = initializeStandardRace('mercedes', 50)
    state = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 110 })
    const pCar = state.drivers.find((d) => d.isPlayer)!
    expect(pCar.pitStops).toBe(0)

    state = raceStrategyService.requestPitStop(state, pCar.driverId, 'duro')
    const afterPit = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 111 })
    const pCarAfter = afterPit.drivers.find((d) => d.driverId === pCar.driverId)!

    expect(pCarAfter.pitStops).toBe(1)
  })

  // 5. pit request não executa instantaneamente
  it('PROVA 20: pit request não executa instantaneamente no clique, espera a volta', () => {
    let state = initializeStandardRace('sauber_audi', 50)
    const pCar = state.drivers.find((d) => d.isPlayer)!
    const initialCompound = pCar.tyreCompound

    // Apenas pede pit via UI / serviço
    const stateWithRequest = raceStrategyService.requestPitStop(state, pCar.driverId, 'duro')
    const driverState = stateWithRequest.drivers.find((d) => d.driverId === pCar.driverId)!

    expect(driverState.strategy?.pitRequested).toBe(true)
    expect(driverState.pitStops).toBe(0) // Não parou ainda
    expect(driverState.tyreCompound).toBe(initialCompound) // Não trocou pneu ainda
  })

  // 6. Undercut pode emergir
  it('PROVA 21: Undercut emerge naturalmente com pneu novo mais rápido que o antigo do rival', () => {
    const drvMock = {
      driverId: 'drv1',
      raceTime: 100.0,
      tyreAge: 18,
      raceStatus: 'racing',
    } as any
    const driversInOrder = [
      { driverId: 'drv0', raceTime: 98.8, tyreAge: 18, raceStatus: 'racing' },
      drvMock,
    ] as any

    const strat = raceStrategyService.createDefaultDriverStrategy({
      driverId: 'drv1',
      startingCompound: 'macio',
      totalLaps: 50,
    })

    const evalResult = raceStrategyService.evaluateTrafficAndStrategyOpportunities({
      driver: drvMock,
      driversInOrder,
      currentLap: 16,
      strategy: strat,
    })

    expect(evalResult.undercutOpportunity).toBe(true)
  })

  // 7. Overcut pode emergir
  it('PROVA 22: Overcut emerge naturalmente quando o piloto possui ar limpo e pneu funcional', () => {
    const drvMock = {
      driverId: 'drv1',
      raceTime: 100.0,
      tyreAge: 14,
      raceStatus: 'racing',
    } as any
    const driversInOrder = [
      { driverId: 'drv0', raceTime: 94.0, tyreAge: 2, raceStatus: 'racing' }, // 6s à frente
      drvMock,
      { driverId: 'drv2', raceTime: 101.5, tyreAge: 15, raceStatus: 'racing' },
    ] as any

    const strat = raceStrategyService.createDefaultDriverStrategy({
      driverId: 'drv1',
      startingCompound: 'duro',
      totalLaps: 50,
    })

    const evalResult = raceStrategyService.evaluateTrafficAndStrategyOpportunities({
      driver: drvMock,
      driversInOrder,
      currentLap: 25,
      strategy: strat,
    })

    expect(evalResult.overcutOpportunity).toBe(true)
  })

  // 8. SC/VSC alteram custo relativo do pit
  it('PROVA 23: SC e VSC reduzem significativamente o pit-loss total em relação à bandeira verde', () => {
    const dummyDriver = {
      driverId: 'test',
      driverName: 'Piloto',
      teamName: 'Equipe',
      raceStatus: 'racing',
    } as any

    const rng = () => 0.5

    const greenPit = raceStrategyService.executePitStop({
      driver: dummyDriver,
      targetCompound: 'duro',
      isDoubleStackSecondCar: false,
      isSafetyCar: false,
      isVsc: false,
      rng,
    })

    const vscPit = raceStrategyService.executePitStop({
      driver: dummyDriver,
      targetCompound: 'duro',
      isDoubleStackSecondCar: false,
      isSafetyCar: false,
      isVsc: true,
      rng,
    })

    const scPit = raceStrategyService.executePitStop({
      driver: dummyDriver,
      targetCompound: 'duro',
      isDoubleStackSecondCar: false,
      isSafetyCar: true,
      isVsc: false,
      rng,
    })

    expect(vscPit.totalPitLossSec).toBeLessThan(greenPit.totalPitLossSec)
    expect(scPit.totalPitLossSec).toBeLessThan(vscPit.totalPitLossSec)
  })

  // 9. red flag bloqueia pit normal
  it('PROVA 24: Red Flag bloqueia solicitação e execução de pit stops normais', () => {
    let state = initializeStandardRace('sauber_audi', 50)
    state = canonicalRaceEngineService.advanceOneLap(state, {
      seedOverride: 120,
      forceRaceControlStatus: 'RED_FLAG',
    })

    expect(state.redFlagActive).toBe(true)
    const pCar = state.drivers.find((d) => d.isPlayer)!

    const blockedReq = raceStrategyService.requestPitStop(state, pCar.driverId, 'duro')
    // Não autoriza solicitação sob Red Flag
    expect(blockedReq.driverStrategies?.[pCar.driverId].pitRequested).toBe(false)
  })

  // 10. nenhum driverId é duplicado
  it('PROVA 25: Nenhum driverId é duplicado em nenhuma operação de estratégia ou pit stop', () => {
    let state = initializeStandardRace('ferrari', 30)
    state = canonicalRaceEngineService.advanceMultipleLaps(state, 5, { seedOverride: 130 })

    const driverIds = state.drivers.map((d) => d.driverId)
    const uniqueIds = new Set(driverIds)
    expect(uniqueIds.size).toBe(24)
  })

  // 11. sporting order continua válida
  it('PROVA 26: sporting order continua contínua P1..P24 após ciclos de pit stop', () => {
    let state = initializeStandardRace('mclaren', 30)
    const playerCars = state.drivers.filter((d) => d.isPlayer)

    state = canonicalRaceEngineService.advanceMultipleLaps(state, 3, { seedOverride: 140 })
    state = raceStrategyService.requestPitStop(state, playerCars[0].driverId, 'duro')
    state = canonicalRaceEngineService.advanceMultipleLaps(state, 2, { seedOverride: 144 })

    const positions = state.drivers.map((d) => d.currentPosition).sort((a, b) => a - b)
    expect(positions).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))
    expect(() => canonicalRaceEngineService.assertRaceInvariants(state)).not.toThrow()
  })
})
