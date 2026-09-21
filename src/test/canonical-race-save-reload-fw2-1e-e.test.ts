import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import {
  canonicalRaceSaveService,
  RACE_SAVE_SCHEMA_VERSION,
} from '@/services/canonicalRaceSaveService'
import { raceStrategyService } from '@/services/raceStrategyService'
import { driverBase2026Service } from '@/services/driverBase2026Service'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

function createMockQualifyingGrid(playerTeamId: string): FinalQualifyingGridEntry[] {
  const teams = [
    { id: playerTeamId, name: 'Player Racing F1', color: '#E10600' },
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

function initializeStandardRace(
  playerTeamId = 'sauber_audi',
  totalLaps = 50,
  careerId?: string,
): CanonicalRaceState {
  const grid = createMockQualifyingGrid(playerTeamId)
  return canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
    careerId: careerId || `career_${playerTeamId}_test`,
    season: 2026,
    round: 1,
    circuitName: 'Sakhir',
    circuitCountry: 'Bahrein',
    totalLaps,
    playerTeamId,
    canonicalQualifyingGrid: grid,
  })
}

describe('FW2.1E-E: RACE SAVE/RELOAD (30 TESTES OBRIGATÓRIOS)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // Teste 1: save serializa corrida completa
  it('TESTE 1: save serializa corrida completa com todos os campos canônicos', () => {
    const race = initializeStandardRace('sauber_audi', 50)
    const result = canonicalRaceSaveService.saveCanonicalRaceState(race)
    expect(result.success).toBe(true)

    const key = canonicalRaceSaveService.buildStorageKey(race.careerId, race.season, race.round)
    const raw = localStorage.getItem(key)
    expect(raw).not.toBeNull()

    const parsed = JSON.parse(raw!)
    expect(parsed.careerId).toBe(race.careerId)
    expect(parsed.raceId).toBe(race.raceId)
    expect(parsed.saveSchemaVersion).toBe(RACE_SAVE_SCHEMA_VERSION)
    expect(parsed.drivers).toHaveLength(24)
    expect(parsed.raceControl).toBeDefined()
  })

  // Teste 2: load restaura completa
  it('TESTE 2: load restaura a corrida completa com 24 pilotos e lookup indexado', () => {
    const race = initializeStandardRace('ferrari', 50)
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    )
    expect(loaded.error).toBeUndefined()
    expect(loaded.state).not.toBeNull()
    expect(loaded.state?.drivers).toHaveLength(24)
    expect(Object.keys(loaded.state?.driverLookup || {})).toHaveLength(24)
    expect(loaded.state?.circuitName).toBe('Sakhir')
  })

  // Teste 3: load não executa simulação
  it('TESTE 3: load restaura o estado sem simular ou alterar qualquer campo', () => {
    let race = initializeStandardRace('mercedes', 50)
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 3, { seedOverride: 101 })
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const loaded1 = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    expect(loaded1.currentLap).toBe(race.currentLap)
    expect(loaded1.drivers[0].raceTime).toBe(race.drivers[0].raceTime)
    expect(loaded1.drivers[0].fuel).toBe(race.drivers[0].fuel)
  })

  // Teste 4: reload preserva volta
  it('TESTE 4: reload preserva a volta atual exata (currentLap)', () => {
    let race = initializeStandardRace('mclaren', 50)
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 7, { seedOverride: 202 })
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    expect(loaded.currentLap).toBe(8) // completou 7, está na 8
  })

  // Teste 5: reload preserva raceTime
  it('TESTE 5: reload preserva os tempos acumulados (raceTime) dos 24 carros', () => {
    let race = initializeStandardRace('red_bull', 50)
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 4, { seedOverride: 303 })
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    for (let i = 0; i < 24; i++) {
      expect(loaded.drivers[i].raceTime).toBe(race.drivers[i].raceTime)
    }
  })

  // Teste 6: reload preserva gaps
  it('TESTE 6: reload preserva os gaps em relação ao líder e ao carro da frente', () => {
    let race = initializeStandardRace('williams', 50)
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 5, { seedOverride: 404 })
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    expect(loaded.drivers[0].gap).toBe('LÍDER')
    expect(loaded.drivers[1].gap).toBe(race.drivers[1].gap)
    expect(loaded.drivers[1].gapToLeaderSec).toBe(race.drivers[1].gapToLeaderSec)
  })

  // Teste 7: reload preserva combustível
  it('TESTE 7: reload preserva combustível restante por carro', () => {
    let race = initializeStandardRace('aston_martin', 50)
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 6, { seedOverride: 505 })
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    for (const d of race.drivers) {
      const restored = loaded.drivers.find((ld) => ld.driverId === d.driverId)!
      expect(restored.fuel).toBe(d.fuel)
    }
  })

  // Teste 8: reload preserva pneus
  it('TESTE 8: reload preserva o composto atual de pneus de cada piloto', () => {
    let race = initializeStandardRace('sauber_audi', 50)
    const pCar1 = race.drivers.find((d) => d.isPlayer)!
    race = raceStrategyService.requestPitStop(race, pCar1.driverId, 'duro')
    race = canonicalRaceEngineService.advanceOneLap(race, { seedOverride: 606 })
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    const restoredC1 = loaded.drivers.find((d) => d.driverId === pCar1.driverId)!
    expect(restoredC1.tyreCompound).toBe('duro')
  })

  // Teste 9: reload preserva tyreAge
  it('TESTE 9: reload preserva tyreAge sem resetar para 0', () => {
    let race = initializeStandardRace('cadillac', 50)
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 8, { seedOverride: 707 })
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    const active = loaded.drivers.find((d) => d.raceStatus === 'racing')!
    expect(active.tyreAge).toBe(8)
  })

  // Teste 10: reload preserva DNF e motivo
  it('TESTE 10: reload preserva DNF com motivo e volta sem ressuscitar', () => {
    let race = initializeStandardRace('alpine', 50)
    const targetDriver = race.drivers[10]
    race = canonicalRaceEngineService.advanceOneLap(race, {
      seedOverride: 808,
      forceIncident: {
        type: 'dnf',
        driverId: targetDriver.driverId,
      },
    })
    const dnfDriver = race.drivers.find((d) => d.driverId === targetDriver.driverId)!
    expect(dnfDriver.raceStatus).toBe('dnf')

    canonicalRaceSaveService.saveCanonicalRaceState(race)
    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    const reloadedDnf = loaded.drivers.find((d) => d.driverId === targetDriver.driverId)!

    expect(reloadedDnf.raceStatus).toBe('dnf')
    expect(reloadedDnf.isDnf).toBe(true)
    expect(reloadedDnf.dnfReason).toBe(dnfDriver.dnfReason)
    expect(reloadedDnf.dnfLap).toBe(dnfDriver.dnfLap)
  })

  // Teste 11: reload preserva Race Control
  it('TESTE 11: reload preserva Race Control completo (flag, lapsRemaining, scQueuedOrder)', () => {
    let race = initializeStandardRace('haas', 50)
    race = canonicalRaceEngineService.advanceOneLap(race, {
      seedOverride: 909,
      forceRaceControlStatus: 'SAFETY_CAR',
    })
    expect(race.raceControl?.currentFlag).toBe('SAFETY_CAR')
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    expect(loaded.raceControl?.currentFlag).toBe('SAFETY_CAR')
    expect(loaded.safetyCarActive).toBe(true)
    expect(loaded.raceControl?.scQueuedOrder).toEqual(race.raceControl?.scQueuedOrder)
  })

  // Teste 12: reload preserva event feed
  it('TESTE 12: reload preserva event feed sem duplicações após reload', () => {
    let race = initializeStandardRace('sauber_audi', 50)
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 3, { seedOverride: 1010 })
    const initialEventsCount = race.events?.length || 0
    expect(initialEventsCount).toBeGreaterThan(0)

    canonicalRaceSaveService.saveCanonicalRaceState(race)
    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    expect(loaded.events?.length).toBe(initialEventsCount)
    expect(loaded.events?.[0].id).toBe(race.events?.[0].id)
  })

  // Teste 13: reload preserva Carro 1
  it('TESTE 13: reload preserva parâmetros do Carro 1 do jogador', () => {
    let race = initializeStandardRace('ferrari', 50)
    const playerDrivers = race.drivers.filter((d) => d.isPlayer)
    const car1 = playerDrivers[0]
    race = raceStrategyService.setDriverPaceMode(race, car1.driverId, 'PUSH')
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    const reloadedCar1Strat = loaded.driverStrategies?.[car1.driverId]
    expect(reloadedCar1Strat?.paceMode).toBe('PUSH')
  })

  // Teste 14: reload preserva Carro 2
  it('TESTE 14: reload preserva parâmetros do Carro 2 do jogador', () => {
    let race = initializeStandardRace('ferrari', 50)
    const playerDrivers = race.drivers.filter((d) => d.isPlayer)
    const car2 = playerDrivers[1]
    race = raceStrategyService.setDriverPaceMode(race, car2.driverId, 'CONSERVE')
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    const reloadedCar2Strat = loaded.driverStrategies?.[car2.driverId]
    expect(reloadedCar2Strat?.paceMode).toBe('CONSERVE')
  })

  // Teste 15: independência das estratégias (TESTE ESSENCIAL C1 PUSH/pit/Medium x C2 CONSERVE/sem pit/Hard)
  it('TESTE 15 (ESSENCIAL): Carro 1 (PUSH + pitRequested + Medium) e Carro 2 (CONSERVE + sem pit + Hard) preservam 4 diferenças intactas', () => {
    let race = initializeStandardRace('sauber_audi', 50)
    const pCars = race.drivers.filter((d) => d.isPlayer)
    const c1Id = pCars[0].driverId
    const c2Id = pCars[1].driverId

    // Carro 1: PUSH, pitRequested, target = 'medio'
    race = raceStrategyService.setDriverPaceMode(race, c1Id, 'PUSH')
    race = raceStrategyService.requestPitStop(race, c1Id, 'medio')

    // Carro 2: CONSERVE, sem pit, target = 'duro'
    race = raceStrategyService.setDriverPaceMode(race, c2Id, 'CONSERVE')
    race = raceStrategyService.setDriverTargetCompound(race, c2Id, 'duro')

    canonicalRaceSaveService.saveCanonicalRaceState(race)
    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!

    const s1 = loaded.driverStrategies?.[c1Id]!
    const s2 = loaded.driverStrategies?.[c2Id]!

    // Provar as 4 diferenças intactas:
    // 1. Ritmo: PUSH vs CONSERVE
    expect(s1.paceMode).toBe('PUSH')
    expect(s2.paceMode).toBe('CONSERVE')
    // 2. Pedido de pit: true vs false
    expect(s1.pitRequested).toBe(true)
    expect(s2.pitRequested).toBe(false)
    // 3. Composto alvo: medio vs duro
    expect(s1.targetCompound).toBe('medio')
    expect(s2.targetCompound).toBe('duro')
    // 4. Objetos totalmente desacoplados
    expect(s1).not.toBe(s2)
  })

  // Teste 16: pitRequested preservado
  it('TESTE 16: salvar com pitRequested true não executa pit precocemente no reload', () => {
    let race = initializeStandardRace('sauber_audi', 50)
    const pCar = race.drivers.find((d) => d.isPlayer)!
    race = raceStrategyService.requestPitStop(race, pCar.driverId, 'duro')
    expect(race.driverStrategies?.[pCar.driverId].pitRequested).toBe(true)
    expect(pCar.pitStops).toBe(0)

    canonicalRaceSaveService.saveCanonicalRaceState(race)
    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!

    const reloadedCar = loaded.drivers.find((d) => d.driverId === pCar.driverId)!
    expect(loaded.driverStrategies?.[pCar.driverId].pitRequested).toBe(true)
    expect(reloadedCar.pitStops).toBe(0) // reload não executa o box
  })

  // Teste 17: double stack pendente preservado
  it('TESTE 17: double stack pendente preserva os dois pedidos e pitPriority', () => {
    let race = initializeStandardRace('ferrari', 50)
    const pCars = race.drivers.filter((d) => d.isPlayer)
    race = raceStrategyService.setTeamPitPriority(race, pCars[1].driverId)
    race = raceStrategyService.requestPitStop(race, pCars[0].driverId, 'medio')
    race = raceStrategyService.requestPitStop(race, pCars[1].driverId, 'duro')

    canonicalRaceSaveService.saveCanonicalRaceState(race)
    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!

    expect(loaded.pitPriority).toBe(pCars[1].driverId)
    expect(loaded.driverStrategies?.[pCars[0].driverId].pitRequested).toBe(true)
    expect(loaded.driverStrategies?.[pCars[1].driverId].pitRequested).toBe(true)
  })

  // Teste 18: RNG continua da posição correta
  it('TESTE 18: RNG continua da semente correta derivada da volta persistida', () => {
    let race = initializeStandardRace('mercedes', 50)
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 5, { seedOverride: 777 })
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    expect(loaded.raceSeed).toBe(race.raceSeed)

    const seedLap6Direct = canonicalRaceEngineService.deriveLapSeed(race, 6)
    const seedLap6Reload = canonicalRaceEngineService.deriveLapSeed(loaded, 6)
    expect(seedLap6Reload).toBe(seedLap6Direct)
  })

  // Teste 19: TESTE DE OURO (Caminho A vs Caminho B)
  it('TESTE 19 (TESTE DE OURO): Caminho A (correr até X, continuar até Y) == Caminho B (correr até X, salvar, reload, continuar até Y)', () => {
    // Caminho A: direto até volta 6
    let raceA = initializeStandardRace('sauber_audi', 50)
    raceA = canonicalRaceEngineService.advanceMultipleLaps(raceA, 3, { seedOverride: 12345 })
    raceA = canonicalRaceEngineService.advanceMultipleLaps(raceA, 3, { seedOverride: 12345 })

    // Caminho B: até volta 3, salva, destrói memória, reload, continua até volta 6
    let raceB = initializeStandardRace('sauber_audi', 50)
    raceB = canonicalRaceEngineService.advanceMultipleLaps(raceB, 3, { seedOverride: 12345 })
    canonicalRaceSaveService.saveCanonicalRaceState(raceB)

    // Destrói estado em memória
    raceB = null as any

    const loadedB = canonicalRaceSaveService.loadCanonicalRaceState(
      'career_sauber_audi_test',
      2026,
      1,
    ).state!
    const finishedB = canonicalRaceEngineService.advanceMultipleLaps(loadedB, 3, {
      seedOverride: 12345,
    })

    // Comparações determinísticas exatas entre Caminho A e Caminho B:
    expect(finishedB.currentLap).toBe(raceA.currentLap)
    expect(finishedB.status).toBe(raceA.status)

    for (let i = 0; i < 24; i++) {
      const drvA = raceA.drivers[i]
      const drvB = finishedB.drivers[i]
      expect(drvB.driverId).toBe(drvA.driverId)
      expect(drvB.currentPosition).toBe(drvA.currentPosition)
      expect(drvB.raceTime).toBe(drvA.raceTime)
      expect(drvB.fuel).toBe(drvA.fuel)
      expect(drvB.tyreAge).toBe(drvA.tyreAge)
      expect(drvB.pitStops).toBe(drvA.pitStops)
    }
  })

  // Teste 20: save durante VSC reproduzível
  it('TESTE 20: save durante VSC restaura neutralização e delta reduzido intactos', () => {
    let race = initializeStandardRace('mclaren', 50)
    race = canonicalRaceEngineService.advanceOneLap(race, {
      seedOverride: 2020,
      forceRaceControlStatus: 'VSC',
    })
    expect(race.vscActive).toBe(true)
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    expect(loaded.vscActive).toBe(true)
    expect(loaded.raceControl?.currentFlag).toBe('VSC')
  })

  // Teste 21: save durante Safety Car (pelotão convergindo) reproduzível
  it('TESTE 21: save durante Safety Car preserva safetyCarLaps e scQueuedOrder', () => {
    let race = initializeStandardRace('ferrari', 50)
    race = canonicalRaceEngineService.advanceOneLap(race, {
      seedOverride: 2121,
      forceRaceControlStatus: 'SAFETY_CAR',
    })
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    expect(loaded.safetyCarActive).toBe(true)
    expect(loaded.raceControl?.safetyCarLaps).toBe(race.raceControl?.safetyCarLaps)
    expect(loaded.raceControl?.scQueuedOrder).toEqual(race.raceControl?.scQueuedOrder)
  })

  // Teste 22: save durante Red Flag permanece congelado
  it('TESTE 22: save durante Red Flag permanece congelado no reload sem virar verde automaticamente', () => {
    let race = initializeStandardRace('red_bull', 50)
    race = canonicalRaceEngineService.advanceOneLap(race, {
      seedOverride: 2222,
      forceRaceControlStatus: 'RED_FLAG',
    })
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    expect(loaded.redFlagActive).toBe(true)
    expect(loaded.status).toBe('red_flag')
    expect(loaded.raceControl?.currentFlag).toBe('RED_FLAG')

    // Avançar volta em Red Flag não altera voltas nem raceTime
    const afterRed = canonicalRaceEngineService.advanceOneLap(loaded)
    expect(afterRed.currentLap).toBe(loaded.currentLap)
    expect(afterRed.drivers[0].raceTime).toBe(loaded.drivers[0].raceTime)
  })

  // Teste 23: save não toca drivers_base_2026
  it('TESTE 23: save e reload jamais alteram ou regravam a base drivers_base_2026', () => {
    const baseBefore = driverBase2026Service.getAllBaseDrivers2026()
    const race = initializeStandardRace('sauber_audi', 50)
    canonicalRaceSaveService.saveCanonicalRaceState(race)
    canonicalRaceSaveService.loadCanonicalRaceState(race.careerId, race.season, race.round)

    const baseAfter = driverBase2026Service.getAllBaseDrivers2026()
    expect(baseAfter).toHaveLength(baseBefore.length)
    expect(baseAfter[0].id).toBe(baseBefore[0].id)
  })

  // Teste 24: Carreira A não carrega save da Carreira B
  it('TESTE 24: Isolamento: Carreira A não carrega o save da Carreira B', () => {
    const raceA = initializeStandardRace('sauber_audi', 50, 'career_A')
    const raceB = initializeStandardRace('ferrari', 50, 'career_B')

    canonicalRaceSaveService.saveCanonicalRaceState(raceA)
    canonicalRaceSaveService.saveCanonicalRaceState(raceB)

    const loadedA = canonicalRaceSaveService.loadCanonicalRaceState('career_A', 2026, 1).state!
    const loadedB = canonicalRaceSaveService.loadCanonicalRaceState('career_B', 2026, 1).state!

    expect(loadedA.careerId).toBe('career_A')
    expect(loadedB.careerId).toBe('career_B')
    expect(loadedA.playerTeamId).toBe('sauber_audi')
    expect(loadedB.playerTeamId).toBe('ferrari')
  })

  // Teste 25: Race A não carrega Race B (etapas distintas)
  it('TESTE 25: Isolamento de Etapa: Round 1 não carrega o save do Round 2', () => {
    const raceR1 = initializeStandardRace('mclaren', 50, 'career_multi')
    raceR1.round = 1
    raceR1.raceId = 'race_career_multi_s2026_r1'

    const raceR2 = initializeStandardRace('mclaren', 50, 'career_multi')
    raceR2.round = 2
    raceR2.raceId = 'race_career_multi_s2026_r2'

    canonicalRaceSaveService.saveCanonicalRaceState(raceR1)
    canonicalRaceSaveService.saveCanonicalRaceState(raceR2)

    const loadedR1 = canonicalRaceSaveService.loadCanonicalRaceState('career_multi', 2026, 1).state!
    const loadedR2 = canonicalRaceSaveService.loadCanonicalRaceState('career_multi', 2026, 2).state!

    expect(loadedR1.round).toBe(1)
    expect(loadedR2.round).toBe(2)
  })

  // Teste 26: load repetido idempotente
  it('TESTE 26: load repetido 10 vezes é 100% idempotente (não avança volta, não gasta pneu)', () => {
    let race = initializeStandardRace('sauber_audi', 50)
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 4, { seedOverride: 2626 })
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    for (let i = 0; i < 10; i++) {
      const reloaded = canonicalRaceSaveService.loadCanonicalRaceState(
        race.careerId,
        race.season,
        race.round,
      ).state!
      expect(reloaded.currentLap).toBe(race.currentLap)
      expect(reloaded.drivers[0].raceTime).toBe(race.drivers[0].raceTime)
      expect(reloaded.drivers[0].fuel).toBe(race.drivers[0].fuel)
      expect(reloaded.drivers[0].tyreAge).toBe(race.drivers[0].tyreAge)
    }
  })

  // Teste 27: reiniciar descarta save corretamente
  it('TESTE 27: reiniciar corrida descarta o snapshot salvo sem afetar a carreira global', () => {
    const race = initializeStandardRace('sauber_audi', 50)
    canonicalRaceSaveService.saveCanonicalRaceState(race)
    expect(canonicalRaceSaveService.hasSavedRace(race.careerId, race.season, race.round)).toBe(true)

    canonicalRaceSaveService.clearCanonicalRaceState(race.careerId, race.season, race.round)
    expect(canonicalRaceSaveService.hasSavedRace(race.careerId, race.season, race.round)).toBe(
      false,
    )
  })

  // Teste 28: corrida terminada não volta a RUNNING
  it('TESTE 28: corrida terminada (completed / FINISHED) tem flag isFinished sinalizada no load', () => {
    let race = initializeStandardRace('sauber_audi', 2)
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 2, { seedOverride: 2828 })
    expect(race.status).toBe('completed')

    canonicalRaceSaveService.saveCanonicalRaceState(race)
    const result = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    )
    expect(result.isFinished).toBe(true)
    expect(result.state?.status).toBe('completed')
  })

  // Teste 29: schema version validada
  it('TESTE 29: saveSchemaVersion "race-save-v1" é gravada e validada com sucesso', () => {
    const race = initializeStandardRace('sauber_audi', 50)
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    ).state!
    expect(loaded.saveSchemaVersion).toBe('race-save-v1')
  })

  // Teste 30: snapshot inválido rejeitado de forma controlada
  it('TESTE 30: snapshot corrompido ou com pilotos faltando é rejeitado com erro diagnosticável', () => {
    const race = initializeStandardRace('sauber_audi', 50)
    // Corromper: remover 2 pilotos
    const corrupted = { ...race, drivers: race.drivers.slice(0, 22) }
    const validation = canonicalRaceSaveService.validateRaceSnapshot(corrupted)

    expect(validation.valid).toBe(false)
    expect(validation.errors.some((e) => e.includes('deve conter exatamente 24 entradas'))).toBe(
      true,
    )

    // Tentar salvar com falha
    const saveRes = canonicalRaceSaveService.saveCanonicalRaceState(corrupted as any)
    expect(saveRes.success).toBe(false)
    expect(saveRes.error).toContain('Validação de snapshot falhou')
  })
})
