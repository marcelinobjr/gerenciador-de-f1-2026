import { describe, it, expect } from 'vitest'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

function buildDeterministicGrid(): FinalQualifyingGridEntry[] {
  const teams = [
    { id: 'ferrari', name: 'Scuderia Ferrari', color: '#DC0000' },
    { id: 'mclaren', name: 'McLaren F1 Team', color: '#FF8700' },
    { id: 'red_bull', name: 'Red Bull Racing', color: '#1E41FF' },
    { id: 'mercedes', name: 'Mercedes-AMG F1', color: '#00D2BE' },
    { id: 'aston_martin', name: 'Aston Martin F1', color: '#006F62' },
    { id: 'alpine', name: 'Alpine F1 Team', color: '#0090FF' },
    { id: 'williams', name: 'Williams Racing', color: '#005AFF' },
    { id: 'racing_bulls', name: 'Visa Cash App RB', color: '#6692FF' },
    { id: 'sauber_audi', name: 'Audi Revolut F1 Team', color: '#C0C0C0' },
    { id: 'haas', name: 'Haas F1 Team', color: '#B6BABD' },
    { id: 'cadillac', name: 'Cadillac F1 Team', color: '#FFD700' },
    { id: 'andretti', name: 'Andretti Global', color: '#002B49' },
  ]

  const grid: FinalQualifyingGridEntry[] = []
  let pos = 1
  for (const t of teams) {
    for (let carNum = 1; carNum <= 2; carNum++) {
      grid.push({
        gridPosition: pos,
        driverId: `drv_${t.id}_${carNum}`,
        driverName: `Driver ${pos} ${t.name}`,
        teamId: t.id,
        teamName: t.name,
        teamColor: t.color,
        isPlayer: false, // TODOS SÃO CARROS IA!
        eliminationStage: pos <= 10 ? 'Q3' : pos <= 18 ? 'Q2' : 'Q1',
        bestLapSec: 80.0 + pos * 0.1,
        bestLapTime: `1:20.${String(pos).padStart(3, '0')}`,
        bestLapCompound: 'medio',
      })
      pos++
    }
  }
  return grid
}

function initializeDeterministicTestRace(
  weather: CanonicalRaceState['weather'] = 'seco',
  totalLaps = 30,
): CanonicalRaceState {
  const grid = buildDeterministicGrid()
  return canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
    careerId: 'test_sd02a_career',
    season: 2026,
    round: 1,
    circuitName: 'Sakhir',
    circuitCountry: 'Bahrain',
    totalLaps,
    playerTeamId: 'player_spectator',
    canonicalQualifyingGrid: grid,
    weather,
    persistState: false,
  })
}

describe('SD-02A ETAPA 1: DIAGNÓSTICO DETERMINÍSTICO EM EXECUÇÃO', () => {
  describe('HIPÓTESE 1: IA NÃO SOLICITA PIT STOP', () => {
    it('EXECUÇÃO H1 (Passo a passo): Prova explícita de cada etapa do ciclo de pit stop da IA', () => {
      let state = initializeDeterministicTestRace('seco', 30)

      const aiDriverId = 'drv_ferrari_1'
      let aiDriver = state.drivers.find((d) => d.driverId === aiDriverId)!
      expect(aiDriver.isPlayer).toBe(false)
      const initialCompound = aiDriver.tyreCompound
      expect(initialCompound).toBe('medio')

      const strat = state.driverStrategies?.[aiDriverId]!
      const optimalLap = strat.nextPitWindow.optimalLap

      // ETAPA 1: Início de stint
      expect(aiDriver.lap).toBe(0)
      expect(aiDriver.pitStops).toBe(0)
      expect(strat.pitRequested).toBe(false)
      expect(strat.strategyStatus).toBe('OPTIMAL')

      // Avançar até a volta anterior à ótima
      state = canonicalRaceEngineService.advanceMultipleLaps(state, optimalLap - 1, {
        seedOverride: 12345,
        persistState: false,
      })

      // ETAPA 2: Chegando à janela estratégica (WINDOW_OPEN ou OPTIMAL)
      const stratNearWindow = state.driverStrategies?.[aiDriverId]!
      expect(['WINDOW_OPEN', 'OPTIMAL', 'OVERDUE']).toContain(stratNearWindow.strategyStatus)

      // ETAPA 3, 4, 5, 6: Avançar a volta ótima
      // Na volta ótima, o gatilho da IA dispara pitRequested = true, pitThisLap = true,
      // a baia de pit é atendida via processLapPitStops, o composto muda para 'duro',
      // o tyreAge reseta e o stint 2 inicia.
      state = canonicalRaceEngineService.advanceOneLap(state, {
        seedOverride: 12345 + optimalLap,
        persistState: false,
      })

      const driverAfterPit = state.drivers.find((d) => d.driverId === aiDriverId)!
      const stratAfterPit = state.driverStrategies?.[aiDriverId]!

      expect(driverAfterPit.pitStops).toBe(1)
      expect(driverAfterPit.tyreCompound).toBe('duro')
      expect(driverAfterPit.tyreCompound).not.toBe(initialCompound)
      expect(driverAfterPit.tyreAge).toBe(1)
      expect(stratAfterPit.strategyStatus).toBe('OPTIMAL')
      expect(stratAfterPit.pitRequested).toBe(false)
      expect(driverAfterPit.raceStatus).toBe('racing')
    })

    it('EXECUÇÃO H1: Piloto controlado pela IA inicia stint, atinge a janela, solicita pit, entra no box, troca composto e inicia novo stint', () => {
      let state = initializeDeterministicTestRace('seco', 30)

      // Escolher um piloto controlado pela IA (todos são IA nesta prova)
      const aiDriverId = 'drv_ferrari_1'
      let aiDriver = state.drivers.find((d) => d.driverId === aiDriverId)!
      expect(aiDriver.isPlayer).toBe(false)
      expect(aiDriver.pitStops).toBe(0)
      const initialCompound = aiDriver.tyreCompound
      expect(initialCompound).toBe('medio')

      const strat = state.driverStrategies?.[aiDriverId]!
      expect(strat).toBeDefined()
      const optimalLap = strat.nextPitWindow.optimalLap
      expect(optimalLap).toBeGreaterThan(10)

      // 1. Início de stint: antes da janela, pitRequested é falso
      let driverStratBeforeWindow = state.driverStrategies?.[aiDriverId]
      expect(driverStratBeforeWindow?.pitRequested).toBe(false)

      // 2. Avançar voltas até 1 volta antes da volta ótima
      const lapsToAdvanceFirst = optimalLap - 1
      state = canonicalRaceEngineService.advanceMultipleLaps(state, lapsToAdvanceFirst, {
        seedOverride: 12345,
        persistState: false,
      })

      aiDriver = state.drivers.find((d) => d.driverId === aiDriverId)!
      expect(aiDriver.lap).toBe(lapsToAdvanceFirst)
      expect(aiDriver.pitStops).toBe(0)

      // Verificar se a IA identificou WINDOW_OPEN ou OPTIMAL conforme a janela
      const stratAtThreshold = state.driverStrategies?.[aiDriverId]!
      expect(['WINDOW_OPEN', 'OPTIMAL', 'OVERDUE']).toContain(stratAtThreshold.strategyStatus)

      // 3 & 4. Avançar a volta ótima onde o gatilho da IA atua:
      // A IA deve autonomamente solicitar pitRequested -> processar pit -> trocar pneu
      state = canonicalRaceEngineService.advanceOneLap(state, {
        seedOverride: 12345 + optimalLap,
        persistState: false,
      })

      aiDriver = state.drivers.find((d) => d.driverId === aiDriverId)!

      // 5 & 6. Provas em execução do pit stop concluído pela IA:
      // - O carro parou? Sim, pitStops incrementou para 1
      // - Pneu trocado? Sim, trocou de 'medio' para 'duro' (regra de 2 compostos)
      // - tyreAge resetou? Sim, 0 no box + 1 volta = 1
      // - Novo stint iniciado? Sim, continua na corrida
      expect(aiDriver.pitStops).toBe(1)
      expect(aiDriver.tyreCompound).toBe('duro')
      expect(aiDriver.tyreCompound).not.toBe(initialCompound)
      expect(aiDriver.tyreAge).toBe(1)
      expect(aiDriver.raceStatus).toBe('racing')

      // Verificar regra esportiva de corrida seca em corrida completa
      const remainingLaps = 30 - aiDriver.lap
      state = canonicalRaceEngineService.advanceMultipleLaps(state, remainingLaps, {
        seedOverride: 99999,
        persistState: false,
      })

      const finishedAiDriver = state.drivers.find((d) => d.driverId === aiDriverId)!
      if (finishedAiDriver.raceStatus === 'finished') {
        expect(finishedAiDriver.pitStops).toBeGreaterThanOrEqual(1)
        expect(finishedAiDriver.tyreCompound).toBe('duro')
      }
    })

    it('EXECUÇÃO H1 (Regra Esportiva 24 carros): Em corrida seca de 30 voltas, carros IA que terminam cumprem pelo menos 1 pit stop e troca de composto', () => {
      let state = initializeDeterministicTestRace('seco', 30)

      state = canonicalRaceEngineService.advanceMultipleLaps(state, 30, {
        seedOverride: 20263000,
        persistState: false,
      })

      expect(state.status).toBe('completed')
      const finishers = state.drivers.filter((d) => d.raceStatus === 'finished')
      expect(finishers.length).toBeGreaterThan(15)

      for (const d of finishers) {
        expect(d.pitStops).toBeGreaterThanOrEqual(1)
        // Largou de médio e trocou de composto no pit
        expect(['duro', 'macio']).toContain(d.tyreCompound)
      }
    })
  })

  describe('HIPÓTESE 2: CLIMA NÃO ALTERA O RITMO', () => {
    it('EXECUÇÃO H2 (Determinismo e Reprodutibilidade): Mesma seed + mesmo estado inicial = mesmo resultado de lapTime e ritmo', () => {
      const fixedRngSeed = 888888
      const circuitName = 'Sakhir'
      const round = 1

      const driverControl = {
        careerId: 'test_career_det',
        season: 2026,
        raceId: 'test_race_det',
        driverId: 'drv_test_det',
        teamId: 'mclaren',
        gridPosition: 2,
        currentPosition: 2,
        lap: 12,
        raceTime: 980.0,
        gap: '+1.500s',
        tyreCompound: 'medio' as const,
        tyreAge: 8,
        fuel: 75.0,
        carCondition: 99.0,
        raceStatus: 'racing' as const,
        pitStops: 0,
        driverName: 'Deterministic Tester',
        teamName: 'McLaren F1 Team',
        teamColor: '#FF8700',
        isPlayer: false,
      }

      // Execução 1
      const rng1 = canonicalRaceEngineService.createMulberry32(fixedRngSeed)
      const paceRun1 = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: { ...driverControl },
        lap: 12,
        weather: 'seco',
        round,
        circuitName,
        tireAbrasiveness: 6,
        rng: rng1,
      })

      // Execução 2
      const rng2 = canonicalRaceEngineService.createMulberry32(fixedRngSeed)
      const paceRun2 = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: { ...driverControl },
        lap: 12,
        weather: 'seco',
        round,
        circuitName,
        tireAbrasiveness: 6,
        rng: rng2,
      })

      expect(paceRun1.lapTimeSec).toBe(paceRun2.lapTimeSec)
      expect(paceRun1.fuelBurnKg).toBe(paceRun2.fuelBurnKg)
      expect(paceRun1.tireWearIncrement).toBe(paceRun2.tireWearIncrement)
    })

    it('EXECUÇÃO H2: Condição climática chega ao motor e altera o lapTime canônico sob condições rigorosamente idênticas', () => {
      const fixedRngSeed = 424242
      const circuitName = 'Sakhir'
      const round = 1

      const driverControl = {
        careerId: 'test_career',
        season: 2026,
        raceId: 'test_race',
        driverId: 'drv_test_identical',
        teamId: 'mclaren',
        gridPosition: 3,
        currentPosition: 3,
        lap: 10,
        raceTime: 820.0,
        gap: '+2.145s',
        tyreCompound: 'macio' as const, // Pneu slick
        tyreAge: 5,
        fuel: 85.0,
        carCondition: 98.0,
        raceStatus: 'racing' as const,
        pitStops: 0,
        driverName: 'Test Driver',
        teamName: 'McLaren F1 Team',
        teamColor: '#FF8700',
        isPlayer: false,
      }

      // 1. Volta em condição seca (DRY)
      const rngDry = canonicalRaceEngineService.createMulberry32(fixedRngSeed)
      const paceDry = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: { ...driverControl },
        lap: 10,
        weather: 'seco',
        round,
        circuitName,
        tireAbrasiveness: 6,
        rng: rngDry,
      })

      // 2. Volta em chuva fraca com pneu slick inadequado (WET / SLICK)
      const rngWetSlick = canonicalRaceEngineService.createMulberry32(fixedRngSeed)
      const paceWetSlick = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: { ...driverControl },
        lap: 10,
        weather: 'chuva_fraca',
        round,
        circuitName,
        tireAbrasiveness: 6,
        rng: rngWetSlick,
      })

      // 3. Volta em chuva fraca com pneu intermediário adequado (WET / INTERMEDIATE)
      const rngWetInter = canonicalRaceEngineService.createMulberry32(fixedRngSeed)
      const paceWetInter = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: { ...driverControl, tyreCompound: 'intermediario' as const },
        lap: 10,
        weather: 'chuva_fraca',
        round,
        circuitName,
        tireAbrasiveness: 6,
        rng: rngWetInter,
      })

      // 4. Volta em chuva forte com pneu slick inadequado (HEAVY RAIN / SLICK)
      const rngHeavySlick = canonicalRaceEngineService.createMulberry32(fixedRngSeed)
      const paceHeavySlick = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: { ...driverControl },
        lap: 10,
        weather: 'chuva_forte',
        round,
        circuitName,
        tireAbrasiveness: 6,
        rng: rngHeavySlick,
      })

      // COMPROVAÇÕES EM EXECUÇÃO:
      // A. Clima chega ao cálculo e produz deltas de tempo reais
      expect(paceDry.lapTimeSec).toBeDefined()
      expect(paceWetSlick.lapTimeSec).toBeDefined()
      expect(paceHeavySlick.lapTimeSec).toBeDefined()

      // B. Chuva fraca com slick é penalizada em +4.2s em relação ao seco (f1-pace-model canônico)
      const deltaWetSlick = Number((paceWetSlick.lapTimeSec - paceDry.lapTimeSec).toFixed(3))
      expect(deltaWetSlick).toBeCloseTo(4.2, 1)

      // C. Chuva forte com slick é penalizada em +9.0s em relação ao seco
      const deltaHeavySlick = Number((paceHeavySlick.lapTimeSec - paceDry.lapTimeSec).toFixed(3))
      expect(deltaHeavySlick).toBeCloseTo(9.0, 1)

      // D. Composto intermediário na chuva fraca é muito mais rápido que slick na chuva fraca
      expect(paceWetInter.lapTimeSec).toBeLessThan(paceWetSlick.lapTimeSec)
      const tyreAdvantageRain = Number(
        (paceWetSlick.lapTimeSec - paceWetInter.lapTimeSec).toFixed(3),
      )
      expect(tyreAdvantageRain).toBeGreaterThan(4.0)
    })

    it('EXECUÇÃO H2 (Integração Total da Corrida): Uma corrida inteira no seco vs no molhado produz ritmo acumulado expressivamente diferente via advanceOneLap', () => {
      // Duas corridas com exatamente o mesmo grid, mesmos carros, mesma seed, alterando APENAS weather
      const stateDry = initializeDeterministicTestRace('seco', 10)
      const stateWet = initializeDeterministicTestRace('chuva_forte', 10)

      // Avançar 3 voltas em ambas
      const dryResult = canonicalRaceEngineService.advanceMultipleLaps(stateDry, 3, {
        seedOverride: 777777,
        persistState: false,
      })
      const wetResult = canonicalRaceEngineService.advanceMultipleLaps(stateWet, 3, {
        seedOverride: 777777,
        persistState: false,
      })

      const dryLeader = dryResult.drivers.find((d) => d.currentPosition === 1)!
      const wetLeader = wetResult.drivers.find((d) => d.currentPosition === 1)!

      // No molhado com pneus slick padrão da largada, os tempos são substancialmente maiores (ritmo mais lento)
      expect(wetLeader.raceTime).toBeGreaterThan(dryLeader.raceTime + 15.0)
      expect(wetLeader.lastLapTimeSec).toBeGreaterThan(dryLeader.lastLapTimeSec! + 5.0)
    })
  })
})
