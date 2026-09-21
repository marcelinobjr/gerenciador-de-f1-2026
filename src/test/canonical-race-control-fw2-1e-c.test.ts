import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { raceControlService } from '@/services/raceControlService'
import { driverBase2026Service } from '@/services/driverBase2026Service'
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

describe('FW2.1E-C: RACE CONTROL SUITE (22 PROVAS OBRIGATÓRIAS)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // 1. GREEN mantém comportamento normal
  it('PROVA 1: GREEN mantém comportamento normal de ritmo e evolução de gaps', () => {
    const state = initializeStandardRace('ferrari', 30)
    const lap1 = canonicalRaceEngineService.advanceOneLap(state, {
      seedOverride: 101,
      forceRaceControlStatus: 'GREEN',
    })

    expect(lap1.raceControl?.currentFlag).toBe('GREEN')
    expect(lap1.status).toBe('running')
    expect(lap1.safetyCarActive).toBe(false)
    expect(lap1.vscActive).toBe(false)
    expect(lap1.redFlagActive).toBe(false)

    // O tempo dos carros progridem em ritmo de corrida normal (~80-86s)
    const active = lap1.drivers.filter((d) => d.raceStatus === 'racing')
    for (const car of active) {
      expect(car.lastLapTimeSec).toBeGreaterThan(60.0)
      expect(car.lastLapTimeSec).toBeLessThan(95.0)
    }
  })

  // 2. Yellow local reduz pace na zona afetada
  it('PROVA 2: Yellow local reduz pace na zona afetada', () => {
    const greenMod = raceControlService.computeRaceControlPaceModifier({
      status: 'GREEN',
      driver: {} as any,
    })
    const yellowLocalMod = raceControlService.computeRaceControlPaceModifier({
      status: 'YELLOW_LOCAL',
      driver: {} as any,
      activeSector: 2,
    })

    expect(yellowLocalMod.extraLapTimeSec).toBeGreaterThan(greenMod.extraLapTimeSec)
    expect(yellowLocalMod.extraLapTimeSec).toBeGreaterThanOrEqual(2.0)
  })

  // 3. Yellow local bloqueia ultrapassagem onde aplicável
  it('PROVA 3: Yellow local bloqueia ultrapassagens', () => {
    const yellowLocalMod = raceControlService.computeRaceControlPaceModifier({
      status: 'YELLOW_LOCAL',
      driver: {} as any,
    })
    expect(yellowLocalMod.allowOvertake).toBe(false)
  })

  // 4. VSC reduz pace global
  it('PROVA 4: VSC reduz pace globalmente por delta regulamentar', () => {
    const greenMod = raceControlService.computeRaceControlPaceModifier({
      status: 'GREEN',
      driver: {} as any,
    })
    const vscMod = raceControlService.computeRaceControlPaceModifier({
      status: 'VSC',
      driver: {} as any,
    })

    expect(vscMod.extraLapTimeSec).toBeGreaterThan(greenMod.extraLapTimeSec + 10.0)
    expect(vscMod.extraLapTimeSec).toBeGreaterThanOrEqual(15.0)
  })

  // 5. VSC preserva gaps aproximadamente (sem agrupamento físico)
  it('PROVA 5: VSC preserva gaps aproximadamente sem agrupar fisicamente o pelotão', () => {
    const state = initializeStandardRace('sauber_audi', 20)
    // 3 voltas em green para abrir gaps
    const lap3 = canonicalRaceEngineService.advanceMultipleLaps(state, 3, { seedOverride: 456 })
    const p1_before = lap3.drivers.find((d) => d.currentPosition === 1)!
    const p2_before = lap3.drivers.find((d) => d.currentPosition === 2)!
    const gapBefore = p2_before.raceTime - p1_before.raceTime

    // Volta sob VSC
    const vscLap = canonicalRaceEngineService.advanceOneLap(lap3, {
      seedOverride: 789,
      forceRaceControlStatus: 'VSC',
    })
    const p1_after = vscLap.drivers.find((d) => d.currentPosition === 1)!
    const p2_after = vscLap.drivers.find((d) => d.currentPosition === 2)!
    const gapAfter = p2_after.raceTime - p1_after.raceTime

    // O gap entre P1 e P2 sob VSC deve se manter amplamente preservado (diferença residual pequena)
    expect(Math.abs(gapAfter - gapBefore)).toBeLessThan(1.5)
    expect(vscLap.vscActive).toBe(true)
  })

  // 6. VSC bloqueia ultrapassagens
  it('PROVA 6: VSC bloqueia ultrapassagens', () => {
    const vscMod = raceControlService.computeRaceControlPaceModifier({
      status: 'VSC',
      driver: {} as any,
    })
    expect(vscMod.allowOvertake).toBe(false)
  })

  // 7. Safety Car reduz pace
  it('PROVA 7: Safety Car reduz significativamente o ritmo do pelotão', () => {
    const scMod = raceControlService.computeRaceControlPaceModifier({
      status: 'SAFETY_CAR',
      driver: {} as any,
    })
    expect(scMod.extraLapTimeSec).toBeGreaterThanOrEqual(25.0)
    expect(scMod.allowOvertake).toBe(false)
  })

  // 8. SC agrupa o pelotão progressivamente
  it('PROVA 8: Safety Car agrupa o pelotão progressivamente (sem zerar instantaneamente)', () => {
    const state = initializeStandardRace('mercedes', 30)
    // 5 voltas de green para abrir gaps grandes (~10s)
    const lap5 = canonicalRaceEngineService.advanceMultipleLaps(state, 5, { seedOverride: 555 })
    const p1_start = lap5.drivers.find((d) => d.currentPosition === 1)!
    const p10_start = lap5.drivers.find((d) => d.currentPosition === 10)!
    const initialGapToP10 = p10_start.raceTime - p1_start.raceTime
    expect(initialGapToP10).toBeGreaterThan(3.0)

    // 1 volta sob SC
    const scLap1 = canonicalRaceEngineService.advanceOneLap(lap5, {
      seedOverride: 666,
      forceRaceControlStatus: 'SAFETY_CAR',
    })
    const p1_sc1 = scLap1.drivers.find((d) => d.currentPosition === 1)!
    const p10_sc1 = scLap1.drivers.find((d) => d.currentPosition === 10)!
    const gapSc1 = p10_sc1.raceTime - p1_sc1.raceTime

    // O gap deve ter diminuído mas NÃO zerou em uma única volta
    expect(gapSc1).toBeLessThan(initialGapToP10)
    expect(gapSc1).toBeGreaterThan(0.5)

    // Mais 2 voltas sob SC
    const scLap2 = canonicalRaceEngineService.advanceOneLap(scLap1, {
      seedOverride: 667,
      forceRaceControlStatus: 'SAFETY_CAR',
    })
    const p1_sc2 = scLap2.drivers.find((d) => d.currentPosition === 1)!
    const p10_sc2 = scLap2.drivers.find((d) => d.currentPosition === 10)!
    const gapSc2 = p10_sc2.raceTime - p1_sc2.raceTime

    expect(gapSc2).toBeLessThan(gapSc1)
  })

  // 9. SC não altera arbitrariamente a ordem esportiva
  it('PROVA 9: SC não altera arbitrariamente a ordem esportiva congelada', () => {
    const state = initializeStandardRace('red_bull', 20)
    const lap3 = canonicalRaceEngineService.advanceMultipleLaps(state, 3, { seedOverride: 777 })
    const orderBefore = lap3.drivers.filter((d) => d.raceStatus === 'racing').map((d) => d.driverId)

    const scLap = canonicalRaceEngineService.advanceOneLap(lap3, {
      seedOverride: 888,
      forceRaceControlStatus: 'SAFETY_CAR',
    })
    const orderAfter = scLap.drivers.filter((d) => d.raceStatus === 'racing').map((d) => d.driverId)

    expect(orderAfter).toEqual(orderBefore)
  })

  // 10. SC -> GREEN funciona (transição via RESTART)
  it('PROVA 10: SC -> GREEN funciona e restabelece a bandeira verde', () => {
    const state = initializeStandardRace('aston_martin', 20)
    const scState = canonicalRaceEngineService.advanceOneLap(state, {
      seedOverride: 111,
      forceRaceControlStatus: 'SAFETY_CAR',
    })
    expect(scState.safetyCarActive).toBe(true)

    // Forçar transição para RESTART
    const restartState = canonicalRaceEngineService.advanceOneLap(scState, {
      seedOverride: 112,
      forceRaceControlStatus: 'RESTART',
    })
    expect(restartState.raceControl?.currentFlag).toBe('RESTART')

    // Próxima volta: transiciona automaticamente para GREEN
    const greenState = canonicalRaceEngineService.advanceOneLap(restartState, {
      seedOverride: 113,
    })
    expect(greenState.raceControl?.currentFlag).toBe('GREEN')
    expect(greenState.safetyCarActive).toBe(false)
  })

  // 11. Restart usa RNG determinístico
  it('PROVA 11: Restart usa RNG determinístico gerando mesmo resultado para mesma semente', () => {
    const stateA = initializeStandardRace('sauber_audi', 10)
    const stateB = initializeStandardRace('sauber_audi', 10)

    const restartA = canonicalRaceEngineService.advanceOneLap(stateA, {
      seedOverride: 999,
      forceRaceControlStatus: 'RESTART',
    })
    const restartB = canonicalRaceEngineService.advanceOneLap(stateB, {
      seedOverride: 999,
      forceRaceControlStatus: 'RESTART',
    })

    const greenA = canonicalRaceEngineService.advanceOneLap(restartA, { seedOverride: 1000 })
    const greenB = canonicalRaceEngineService.advanceOneLap(restartB, { seedOverride: 1000 })

    for (let i = 0; i < 24; i++) {
      expect(greenA.drivers[i].raceTime).toBe(greenB.drivers[i].raceTime)
    }
  })

  // 12. Red Flag congela corrida
  it('PROVA 12: Red Flag congela a evolução da corrida e tempos competitivos', () => {
    const state = initializeStandardRace('mclaren', 20)
    const lap2 = canonicalRaceEngineService.advanceMultipleLaps(state, 2, { seedOverride: 321 })
    const redState = canonicalRaceEngineService.advanceOneLap(lap2, {
      seedOverride: 322,
      forceRaceControlStatus: 'RED_FLAG',
    })

    expect(redState.status).toBe('red_flag')
    expect(redState.redFlagActive).toBe(true)
    const timesBefore = redState.drivers.map((d) => d.raceTime)

    // Tentar avançar sob Red Flag sem mudar o status
    const redFrozen = canonicalRaceEngineService.advanceOneLap(redState, { seedOverride: 323 })
    const timesAfter = redFrozen.drivers.map((d) => d.raceTime)

    expect(timesAfter).toEqual(timesBefore)
  })

  // 13. Red Flag impede ultrapassagens
  it('PROVA 13: Red Flag impede ultrapassagens e mantém posições', () => {
    const redMod = raceControlService.computeRaceControlPaceModifier({
      status: 'RED_FLAG',
      driver: {} as any,
    })
    expect(redMod.allowOvertake).toBe(false)
  })

  // 14. Red Flag -> Restart funciona
  it('PROVA 14: Red Flag -> Restart funciona restabelecendo a corrida', () => {
    const state = initializeStandardRace('williams', 20)
    const red = canonicalRaceEngineService.advanceOneLap(state, {
      seedOverride: 401,
      forceRaceControlStatus: 'RED_FLAG',
    })
    expect(red.status).toBe('red_flag')

    // Direção de prova autoriza relargada
    const restart = canonicalRaceEngineService.advanceOneLap(red, {
      seedOverride: 402,
      forceRaceControlStatus: 'RESTART',
    })
    expect(restart.raceControl?.currentFlag).toBe('RESTART')

    // Próxima volta vai para GREEN
    const green = canonicalRaceEngineService.advanceOneLap(restart, { seedOverride: 403 })
    expect(green.raceControl?.currentFlag).toBe('GREEN')
    expect(green.redFlagActive).toBe(false)
  })

  // 15. DNF pode acionar Race Control conforme severidade
  it('PROVA 15: DNF grave com pista bloqueada aciona RED_FLAG pelo resolver centralizado', () => {
    const rng = canonicalRaceEngineService.createMulberry32(1234)
    const response = raceControlService.resolveRaceControlResponse(
      {
        type: 'crash',
        lap: 10,
        reason: 'Acidente grave na curva 1',
        trackBlocked: true,
      },
      rng,
    )
    expect(response?.targetStatus).toBe('RED_FLAG')
    expect(response?.severity).toBe('critical')
  })

  // 16. DNF simples pode não gerar neutralização
  it('PROVA 16: DNF mecânico simples retirado com segurança pode não gerar neutralização', () => {
    // Semente calibrada para roll < 0.40 no resolver
    const rngSafe = () => 0.15
    const response = raceControlService.resolveRaceControlResponse(
      {
        type: 'dnf',
        lap: 10,
        reason: 'Superaquecimento retirado para o pit lane',
      },
      rngSafe,
    )
    expect(response).toBeNull()
  })

  // 17. Blue flag é reconhecida
  it('PROVA 17: Blue flag é reconhecida quando retardatário é alcançado por líder', () => {
    const drivers = [
      {
        driverId: 'leader',
        driverName: 'Líder',
        lap: 20,
        raceStatus: 'racing',
      },
      {
        driverId: 'backmarker',
        driverName: 'Retardatário',
        lap: 18,
        raceStatus: 'racing',
      },
    ] as any

    const blueFlags = raceControlService.evaluateBlueFlags(drivers, 20)
    expect(blueFlags.length).toBeGreaterThan(0)
    expect(blueFlags[0].type).toBe('blue_flag')
    expect(blueFlags[0].affectedDriverId).toBe('backmarker')
  })

  // 18. Chequered flag encerra corretamente
  it('PROVA 18: Chequered flag encerra a corrida e fixa FINISHED sem novas voltas esportivas', () => {
    const state = initializeStandardRace('sauber_audi', 3)
    const completed = canonicalRaceEngineService.advanceMultipleLaps(state, 3, { seedOverride: 99 })

    expect(completed.status).toBe('completed')
    expect(completed.raceControl?.currentFlag).toBe('FINISHED')

    const leader = completed.drivers[0]
    expect(leader.raceStatus).toBe('finished')
  })

  // 19. Mesma seed reproduz mesmos eventos
  it('PROVA 19: Mesma seed reproduz exatamente os mesmos eventos de Race Control', () => {
    const stateA = initializeStandardRace('ferrari', 15)
    const stateB = initializeStandardRace('ferrari', 15)

    const runA = canonicalRaceEngineService.advanceMultipleLaps(stateA, 4, { seedOverride: 54321 })
    const runB = canonicalRaceEngineService.advanceMultipleLaps(stateB, 4, { seedOverride: 54321 })

    expect(runA.raceControl?.currentFlag).toBe(runB.raceControl?.currentFlag)
    expect(runA.events?.length).toBe(runB.events?.length)
    if (runA.events && runB.events) {
      for (let i = 0; i < runA.events.length; i++) {
        expect(runA.events[i].type).toBe(runB.events[i].type)
        expect(runA.events[i].message).toBe(runB.events[i].message)
      }
    }
  })

  // 20. Nenhum driverId é duplicado
  it('PROVA 20: Nenhum driverId é duplicado após eventos e neutralizações de Race Control', () => {
    const state = initializeStandardRace('haas', 20)
    const scState = canonicalRaceEngineService.advanceOneLap(state, {
      seedOverride: 700,
      forceRaceControlStatus: 'SAFETY_CAR',
    })
    const uniqueIds = new Set(scState.drivers.map((d) => d.driverId))
    expect(uniqueIds.size).toBe(24)
  })

  // 21. Base 2026 continua intocada
  it('PROVA 21: Base 2026 de pilotos permanece 100% inalterada', () => {
    const maxVerstappen = driverBase2026Service.getBaseDriver2026('mbj-001')
    expect(maxVerstappen?.name).toBe('Max Verstappen')

    const state = initializeStandardRace('red_bull', 10)
    canonicalRaceEngineService.advanceMultipleLaps(state, 5, { seedOverride: 808 })

    const reloadedMax = driverBase2026Service.getBaseDriver2026('mbj-001')
    expect(reloadedMax?.name).toBe('Max Verstappen')
  })

  // 22. playerTeam continua totalmente dinâmica
  it('PROVA 22: playerTeam continua dinâmica testada com pelo menos 2 equipes diferentes', () => {
    // Equipe 1: Williams
    const williamsState = initializeStandardRace('williams', 5)
    const williamsL1 = canonicalRaceEngineService.advanceOneLap(williamsState, {
      seedOverride: 901,
      forceRaceControlStatus: 'VSC',
    })
    expect(williamsL1.playerTeamId).toBe('williams')
    expect(williamsL1.drivers.filter((d) => d.isPlayer)).toHaveLength(2)

    // Equipe 2: Cadillac
    const cadillacState = initializeStandardRace('cadillac', 5)
    const cadillacL1 = canonicalRaceEngineService.advanceOneLap(cadillacState, {
      seedOverride: 902,
      forceRaceControlStatus: 'SAFETY_CAR',
    })
    expect(cadillacL1.playerTeamId).toBe('cadillac')
    expect(cadillacL1.drivers.filter((d) => d.isPlayer)).toHaveLength(2)
  })
})
