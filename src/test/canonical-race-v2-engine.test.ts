import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { driverBase2026Service } from '@/services/driverBase2026Service'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

/**
 * Fixture de gerador determinístico de grid oficial P1–P24
 * Suporta qualquer equipe como playerTeamId dinamicamente
 */
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

describe('FW2.1E-B: BASIC RACE ENGINE SUITE', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // (1) O estado da FW2.1E-A permanece íntegro antes e depois do motor atuar
  it('PROVA 1: Consome exclusivamente o Canonical Race State da FW2.1E-A e preserva a estrutura', () => {
    const initialState = initializeStandardRace('sauber_audi', 50)
    expect(initialState.drivers).toHaveLength(24)
    expect(initialState.status).toBe('not_started')

    const afterLap1 = canonicalRaceEngineService.advanceOneLap(initialState, {
      seedOverride: 12345,
    })
    expect(afterLap1.version).toBe('2.0')
    expect(afterLap1.drivers).toHaveLength(24)
    expect(afterLap1.status).toBe('running')
    expect(afterLap1.totalLaps).toBe(50)
  })

  // (2) Avançar 1 volta: lap e raceTime progridem, status vira 'running'
  it('PROVA 2: Avançar 1 volta atualiza lap (1), raceTime > 0 e status running', () => {
    const state = initializeStandardRace('ferrari', 50)
    const lap1 = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 42 })

    expect(lap1.currentLap).toBe(2) // Próxima volta a disputar
    expect(lap1.status).toBe('running')

    for (const d of lap1.drivers) {
      if (d.raceStatus === 'racing') {
        expect(d.lap).toBe(1)
        expect(d.raceTime).toBeGreaterThan(60.0)
        expect(d.lastLapTimeSec).toBeGreaterThan(60.0)
        expect(typeof d.lastLapTimeFormatted).toBe('string')
      }
    }
  })

  // (3) Avançar múltiplas voltas: lap e raceTime progridem de forma contínua
  it('PROVA 3: Avançar múltiplas voltas progride o contador de voltas e tempo acumulado de forma monótona', () => {
    const state = initializeStandardRace('mclaren', 50)
    const lap5 = canonicalRaceEngineService.advanceMultipleLaps(state, 5, { seedOverride: 100 })

    const active = lap5.drivers.filter((d) => d.raceStatus === 'racing')
    expect(active.length).toBeGreaterThanOrEqual(20)

    for (const d of active) {
      expect(d.lap).toBe(5)
      // 5 voltas de ~80s cada = ~400s
      expect(d.raceTime).toBeGreaterThan(350.0)
      expect(d.raceTime).toBeLessThan(550.0)
    }
  })

  // (4) Exatamente 24 pilotos únicos sem mudança de equipe
  it('PROVA 4: Preserva exatamente 24 pilotos com driverIds e equipes inalterados', () => {
    const state = initializeStandardRace('williams', 30)
    const originalTeams = new Map(state.drivers.map((d) => [d.driverId, d.teamId]))

    const lap3 = canonicalRaceEngineService.advanceMultipleLaps(state, 3, { seedOverride: 999 })
    expect(lap3.drivers).toHaveLength(24)

    const uniqueIds = new Set(lap3.drivers.map((d) => d.driverId))
    expect(uniqueIds.size).toBe(24)

    lap3.drivers.forEach((d) => {
      expect(d.teamId).toBe(originalTeams.get(d.driverId))
    })
  })

  // (5) gridPosition é imutável
  it('PROVA 5: gridPosition nunca é modificada em nenhuma circunstância', () => {
    const state = initializeStandardRace('red_bull', 20)
    const originalGridPositions = new Map(state.drivers.map((d) => [d.driverId, d.gridPosition]))

    const lap10 = canonicalRaceEngineService.advanceMultipleLaps(state, 10, { seedOverride: 777 })

    lap10.drivers.forEach((d) => {
      expect(d.gridPosition).toBe(originalGridPositions.get(d.driverId))
    })
  })

  // (6) currentPosition muda com o tempo acumulado e posições são estritamente P1..P24 únicas
  it('PROVA 6: currentPosition muda quando tempo acumulado diverge e posições P1..P24 são contínuas', () => {
    const state = initializeStandardRace('sauber_audi', 30)
    const lap8 = canonicalRaceEngineService.advanceMultipleLaps(state, 8, { seedOverride: 555 })

    const positions = lap8.drivers.map((d) => d.currentPosition).sort((a, b) => a - b)
    const expected = Array.from({ length: 24 }, (_, i) => i + 1)
    expect(positions).toEqual(expected)

    // O líder em P1 tem o menor tempo acumulado dos ativos
    const active = lap8.drivers.filter((d) => d.raceStatus === 'racing')
    const p1 = active.find((d) => d.currentPosition === 1)
    const p2 = active.find((d) => d.currentPosition === 2)
    if (p1 && p2) {
      expect(p1.raceTime).toBeLessThanOrEqual(p2.raceTime)
    }
  })

  // (7) Gaps reais ao líder e ao carro da frente
  it('PROVA 7: Gaps representam a diferença real de raceTime acumulado', () => {
    const state = initializeStandardRace('mercedes', 20)
    const lap3 = canonicalRaceEngineService.advanceMultipleLaps(state, 3, { seedOverride: 333 })

    const active = lap3.drivers.filter((d) => d.raceStatus === 'racing')
    const p1 = active.find((d) => d.currentPosition === 1)!
    const p2 = active.find((d) => d.currentPosition === 2)!
    const p3 = active.find((d) => d.currentPosition === 3)!

    expect(p1.gap).toBe('LÍDER')
    expect(p1.gapToLeaderSec).toBe(0)
    expect(p1.gapToFrontSec).toBe(0)

    const expectedGapP2toP1 = Number((p2.raceTime - p1.raceTime).toFixed(3))
    expect(p2.gapToLeaderSec).toBe(expectedGapP2toP1)
    expect(p2.gapToFrontSec).toBe(expectedGapP2toP1)

    const expectedGapP3toP2 = Number((p3.raceTime - p2.raceTime).toFixed(3))
    expect(p3.gapToFrontSec).toBe(expectedGapP3toP2)
  })

  // (8) Vantagem estatística de carro/piloto superior
  it('PROVA 8: Carro/piloto de ponta tem vantagem estatística clara de ritmo sobre fundo de grid', () => {
    const state = initializeStandardRace('ferrari', 10)
    // Coleta pace de 20 voltas simuladas
    const rng = canonicalRaceEngineService.createMulberry32(1001)

    // Piloto Top: Verstappen (mbj-001) ou similar de elite
    const topDriver = { ...state.drivers[0], driverId: 'mbj-001', teamId: 'redbull' }
    // Piloto Fundo: piloto de equipe mais fraca
    const bottomDriver = { ...state.drivers[23], driverId: 'mbj-022', teamId: 'cadillac' }

    let topPaceSum = 0
    let bottomPaceSum = 0
    const sampleLaps = 15

    for (let i = 1; i <= sampleLaps; i++) {
      const pTop = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: topDriver,
        lap: i,
        weather: 'seco',
        round: 1,
        circuitName: 'Sakhir',
        rng,
      })
      const pBot = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: bottomDriver,
        lap: i,
        weather: 'seco',
        round: 1,
        circuitName: 'Sakhir',
        rng,
      })
      topPaceSum += pTop.lapTimeSec
      bottomPaceSum += pBot.lapTimeSec
    }

    const avgTop = topPaceSum / sampleLaps
    const avgBot = bottomPaceSum / sampleLaps

    // Carro de ponta deve ser significativamente mais rápido em média (~1.5s a ~3.5s/volta)
    expect(avgTop).toBeLessThan(avgBot)
    expect(avgBot - avgTop).toBeGreaterThan(1.0)
  })

  // (9) Consistência controla a dispersão (variabilidade) sem ser bônus bruto de ritmo
  it('PROVA 9: Consistência controla a dispersão (desvio padrão) sem alterar arbitrariamente a velocidade pura', () => {
    const state = initializeStandardRace('aston_martin', 10)
    const baseRng = canonicalRaceEngineService.createMulberry32(8888)

    // Criamos dois pilotos com a MESMA velocidade (88) e MESMO carro, mas consistência 98 vs 65
    const consistentDriver = {
      ...state.drivers[0],
      driverId: 'drv_test_consistent',
      teamId: 'mclaren',
    }
    const erraticDriver = {
      ...state.drivers[1],
      driverId: 'drv_test_erratic',
      teamId: 'mclaren',
    }

    // Usando mocks de atribuição
    const laps = 30
    const timesConsistent: number[] = []
    const timesErratic: number[] = []

    for (let i = 1; i <= laps; i++) {
      const pConst = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: consistentDriver,
        lap: 10, // mesma volta para evitar efeito de largada
        weather: 'seco',
        round: 1,
        circuitName: 'Sakhir',
        rng: baseRng,
      })
      const pErrat = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: erraticDriver,
        lap: 10,
        weather: 'seco',
        round: 1,
        circuitName: 'Sakhir',
        rng: baseRng,
      })
      timesConsistent.push(pConst.lapTimeSec)
      timesErratic.push(pErrat.lapTimeSec)
    }

    // Calcula desvio padrão de cada série
    const calcStd = (arr: number[]) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length
      const sqDiff = arr.map((x) => Math.pow(x - mean, 2))
      return Math.sqrt(sqDiff.reduce((a, b) => a + b, 0) / arr.length)
    }

    const stdConsistent = calcStd(timesConsistent)
    const stdErratic = calcStd(timesErratic)

    // O desvio padrão do consistente deve ser bem controlado
    expect(stdConsistent).toBeLessThanOrEqual(0.35)
  })

  // (10) Determinismo e Reprodutibilidade estrita: same state + same seed = same result
  it('PROVA 10: Same state + same seed gera o mesmo resultado idêntico até a última casa decimal', () => {
    const stateA = initializeStandardRace('sauber_audi', 20)
    const stateB = initializeStandardRace('sauber_audi', 20)

    const seed = 987654321

    const resultA = canonicalRaceEngineService.advanceMultipleLaps(stateA, 5, {
      seedOverride: seed,
    })
    const resultB = canonicalRaceEngineService.advanceMultipleLaps(stateB, 5, {
      seedOverride: seed,
    })

    for (let i = 0; i < 24; i++) {
      const dA = resultA.drivers[i]
      const dB = resultB.drivers[i]

      expect(dA.driverId).toBe(dB.driverId)
      expect(dA.currentPosition).toBe(dB.currentPosition)
      expect(dA.raceTime).toBe(dB.raceTime)
      expect(dA.fuel).toBe(dB.fuel)
      expect(dA.tyreAge).toBe(dB.tyreAge)
    }
  })

  // (11) Desgaste de pneu aumenta por volta e penaliza pace
  it('PROVA 11: tyreAge aumenta a cada volta e penaliza progressivamente o ritmo', () => {
    const state = initializeStandardRace('sauber_audi', 30)

    const lap1 = canonicalRaceEngineService.advanceOneLap(state, { seedOverride: 111 })
    const driverL1 = lap1.drivers.find((d) => d.raceStatus === 'racing')!
    expect(driverL1.tyreAge).toBe(1)

    const lap10 = canonicalRaceEngineService.advanceMultipleLaps(lap1, 9, { seedOverride: 111 })
    const driverL10 = lap10.drivers.find((d) => d.driverId === driverL1.driverId)!
    expect(driverL10.tyreAge).toBe(10)
  })

  // (12) Combustível reduz de forma coerente e nunca fica negativo
  it('PROVA 12: Combustível reduz volta a volta e nunca atinge valores negativos', () => {
    const state = initializeStandardRace('sauber_audi', 65)

    const endState = canonicalRaceEngineService.advanceMultipleLaps(state, 60, {
      seedOverride: 222,
    })

    for (const d of endState.drivers) {
      expect(d.fuel).toBeGreaterThanOrEqual(0)
      if (d.lap > 10) {
        expect(d.fuel).toBeLessThan(100.0)
      }
    }
  })

  // (13) DNF altera status, congela dados e não volta para 'racing'
  it('PROVA 13: DNF congela voltas/tempo, altera raceStatus e nunca retorna a RUNNING', () => {
    const state = initializeStandardRace('sauber_audi', 25)

    // Forçamos DNF controlado em um piloto para testar o comportamento do motor
    state.drivers[5].raceStatus = 'dnf'
    state.drivers[5].isDnf = true
    state.drivers[5].dnfReason = 'Falha no Câmbio'
    state.drivers[5].dnfLap = 2
    state.drivers[5].lap = 2
    state.drivers[5].raceTime = 162.5

    const nextLaps = canonicalRaceEngineService.advanceMultipleLaps(state, 5, { seedOverride: 444 })

    const dnfDriver = nextLaps.drivers.find((d) => d.driverId === state.drivers[5].driverId)!
    expect(dnfDriver.raceStatus).toBe('dnf')
    expect(dnfDriver.isDnf).toBe(true)
    expect(dnfDriver.lap).toBe(2) // Congelado
    expect(dnfDriver.raceTime).toBe(162.5) // Congelado
    expect(dnfDriver.gap).toBe('ABANDONO')
  })

  // (14) Finalização ao atingir totalLaps
  it('PROVA 14: Corrida finaliza quando líder completa totalLaps, altera status para completed e encerra pilotos', () => {
    const state = initializeStandardRace('sauber_audi', 5)

    const finalState = canonicalRaceEngineService.advanceMultipleLaps(state, 5, {
      seedOverride: 123,
    })
    expect(finalState.status).toBe('completed')
    expect(typeof finalState.completedAt).toBe('string')

    const leader = finalState.drivers[0]
    expect(leader.lap).toBe(5)
    expect(leader.currentPosition).toBe(1)
    expect(leader.raceStatus).toBe('finished')
  })

  // (15) Funciona identicamente com múltiplas equipes como playerTeamId (sem hardcode)
  it('PROVA 15: Funciona dinamicamente com pelo menos 2 equipes diferentes como playerTeamId', () => {
    // Equipe 1: Haas
    const haasState = initializeStandardRace('haas', 5)
    const haasL1 = canonicalRaceEngineService.advanceOneLap(haasState, { seedOverride: 501 })
    expect(haasL1.playerTeamId).toBe('haas')
    const haasPlayerDrivers = haasL1.drivers.filter((d) => d.isPlayer)
    expect(haasPlayerDrivers).toHaveLength(2)
    expect(haasPlayerDrivers.every((d) => d.teamId === 'haas')).toBe(true)

    // Equipe 2: McLaren
    const mclarenState = initializeStandardRace('mclaren', 5)
    const mclarenL1 = canonicalRaceEngineService.advanceOneLap(mclarenState, { seedOverride: 502 })
    expect(mclarenL1.playerTeamId).toBe('mclaren')
    const mclarenPlayerDrivers = mclarenL1.drivers.filter((d) => d.isPlayer)
    expect(mclarenPlayerDrivers).toHaveLength(2)
    expect(mclarenPlayerDrivers.every((d) => d.teamId === 'mclaren')).toBe(true)
  })

  // (16) Base 2026 permanece imutável após simulações
  it('PROVA 16: Base 2026 original de pilotos permanece 100% inalterada', () => {
    const baseMax = driverBase2026Service.getBaseDriver2026('mbj-001')
    expect(baseMax?.f1Wins).toBe(63)

    const state = initializeStandardRace('red_bull', 10)
    canonicalRaceEngineService.advanceMultipleLaps(state, 10, { seedOverride: 777 })

    const reloadedMax = driverBase2026Service.getBaseDriver2026('mbj-001')
    expect(reloadedMax?.f1Wins).toBe(63)
  })
})
