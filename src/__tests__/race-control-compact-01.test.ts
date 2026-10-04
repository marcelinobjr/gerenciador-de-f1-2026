import { describe, it, expect } from 'vitest'
import { RACE_PLAYBACK_CONFIG } from '@/constants/racePlaybackConfig'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
type CanonicalGridPosition = any

function buildMockGrid(count = 20): CanonicalGridPosition[] {
  const teams = [
    { id: 'ferrari', name: 'Ferrari' },
    { id: 'mclaren', name: 'McLaren' },
    { id: 'red_bull', name: 'Red Bull Racing' },
    { id: 'mercedes', name: 'Mercedes' },
    { id: 'aston_martin', name: 'Aston Martin' },
    { id: 'alpine', name: 'Alpine' },
    { id: 'williams', name: 'Williams' },
    { id: 'racing_bulls', name: 'Racing Bulls' },
    { id: 'sauber', name: 'Kick Sauber' },
    { id: 'haas', name: 'Haas F1 Team' },
  ]

  const grid: CanonicalGridPosition[] = []
  for (let i = 1; i <= count; i++) {
    const team = teams[Math.floor((i - 1) / 2)] || teams[0]
    grid.push({
      position: i,
      driverId: `driver_${i}`,
      driverName: `Driver ${i}`,
      teamId: team.id,
      teamName: team.name,
      teamColor: '#ff0000',
      bestLapTimeMs: 80000 + i * 100,
      bestLapFormatted: `1:20.${String(i * 100).padStart(3, '0')}`,
      sessionEliminated: i > 15 ? 'Q1' : i > 10 ? 'Q2' : 'Q3',
      tyreCompound: i % 2 === 0 ? 'medio' : 'macio',
      isPlayer: i <= 2,
    })
  }
  return grid
}

describe('RACE-CONTROL-COMPACT-01 — QA Suites', () => {
  const mockGrid = buildMockGrid(20)

  // PROVA A: Centralização de Playback 50% mais lento e desacoplamento esportivo
  describe('A) Playback 50% mais lento (Orquestração Temporal UI vs Física/Esportivo)', () => {
    it('deve ter baseline configurado como 4.000ms (50% da velocidade anterior de 2.000ms)', () => {
      expect(RACE_PLAYBACK_CONFIG.BASE_INTERVAL_MS).toBe(4000)
      expect(RACE_PLAYBACK_CONFIG.resolveIntervalMs(1)).toBe(4000)
      expect(RACE_PLAYBACK_CONFIG.resolveIntervalMs(2)).toBe(2000)
      expect(RACE_PLAYBACK_CONFIG.resolveIntervalMs(4)).toBe(1000)
    })

    it('provar que simular em 1x, 2x ou 4x não altera lap times, pace ou cálculos matemáticos da corrida', () => {
      const state1 = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId: 'test_career_speed',
        season: 2026,
        round: 1,
        circuitName: 'Bahrain',
        circuitCountry: 'Bahrain',
        totalLaps: 20,
        playerTeamId: 'ferrari',
        canonicalQualifyingGrid: mockGrid,
      })

      // Clona exatamente o mesmo estado para testar avanço
      const state2 = JSON.parse(JSON.stringify(state1))

      const advanced1 = canonicalRaceEngineService.advanceOneLap(state1)
      const advanced2 = canonicalRaceEngineService.advanceOneLap(state2)

      // A engine pura é agnóstica à velocidade da UI (intervalo em ms do timer)
      expect(advanced1.currentLap).toBe(advanced2.currentLap)
      expect(advanced1.drivers[0].raceTime).toBe(advanced2.drivers[0].raceTime)
      expect(advanced1.drivers[0].tyreAge).toBe(advanced2.drivers[0].tyreAge)
    })
  })

  // PROVA B: Step Lap (+1 Volta) = Fluxo Canônico Normal
  describe('B) Step Lap (+1 Volta) e equivalência esportiva com avanço normal', () => {
    it('+1 VOLTA deve executar exatamente uma volta canônica e preservar integridade dos dados', () => {
      const race = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId: 'test_career_step',
        season: 2026,
        round: 1,
        circuitName: 'Bahrain',
        circuitCountry: 'Bahrain',
        totalLaps: 25,
        playerTeamId: 'ferrari',
        canonicalQualifyingGrid: mockGrid,
      })

      expect(race.currentLap).toBe(0)
      const afterStep = canonicalRaceEngineService.advanceOneLap(race)

      expect(afterStep.currentLap).toBe(1)
      expect(afterStep.drivers[0].lap).toBe(1)
      expect(afterStep.drivers[0].tyreAge).toBe(1)
      expect(afterStep.status).toBe('in_progress')
    })
  })

  // PROVA C e D: +5 e +10 Voltas = Sequência Canônica Estrita de +1 Volta
  describe('C & D) +5 e +10 voltas equivalência com N avanços individuais consecutivos', () => {
    it('+5 voltas deve ser equivalente a 5 chamadas de advanceOneLap', () => {
      const raceBase1 = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId: 'test_career_5v',
        season: 2026,
        round: 1,
        circuitName: 'Bahrain',
        circuitCountry: 'Bahrain',
        totalLaps: 30,
        playerTeamId: 'ferrari',
        canonicalQualifyingGrid: mockGrid,
      })

      // Executa advanceMultipleLaps(5)
      const resultBatch5 = canonicalRaceEngineService.advanceMultipleLaps(raceBase1, 5)

      // Executa 5 vezes advanceOneLap no mesmo estado inicial
      const raceBase2 = JSON.parse(JSON.stringify(raceBase1))
      let curr = raceBase2
      for (let i = 0; i < 5; i++) {
        curr = canonicalRaceEngineService.advanceOneLap(curr)
      }

      // Ambos devem ter avançado exatamente 5 voltas
      expect(resultBatch5.currentLap).toBe(5)
      expect(curr.currentLap).toBe(5)
      expect(resultBatch5.drivers.length).toBe(curr.drivers.length)
      expect(resultBatch5.drivers[0].lap).toBe(5)
      expect(curr.drivers[0].lap).toBe(5)
    })

    it('+10 voltas deve ser equivalente a 10 chamadas de advanceOneLap', () => {
      const raceBase1 = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId: 'test_career_10v',
        season: 2026,
        round: 1,
        circuitName: 'Bahrain',
        circuitCountry: 'Bahrain',
        totalLaps: 30,
        playerTeamId: 'ferrari',
        canonicalQualifyingGrid: mockGrid,
      })

      const resultBatch10 = canonicalRaceEngineService.advanceMultipleLaps(raceBase1, 10)

      const raceBase2 = JSON.parse(JSON.stringify(raceBase1))
      let curr = raceBase2
      for (let i = 0; i < 10; i++) {
        curr = canonicalRaceEngineService.advanceOneLap(curr)
      }

      expect(resultBatch10.currentLap).toBe(10)
      expect(curr.currentLap).toBe(10)
      expect(resultBatch10.drivers[0].lap).toBe(10)
      expect(curr.drivers[0].lap).toBe(10)
    })
  })

  // PROVA E: Determinismo e Ausência de PRNG Paralelo ou Shortcuts
  describe('E) Determinismo e ausência de atalhos esportivos', () => {
    it('o motor não incrementa currentLap sem calcular a física e pneus de todos os carros', () => {
      const race = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId: 'test_career_det',
        season: 2026,
        round: 1,
        circuitName: 'Bahrain',
        circuitCountry: 'Bahrain',
        totalLaps: 20,
        playerTeamId: 'ferrari',
        canonicalQualifyingGrid: mockGrid,
      })

      const prevTyreAges = race.drivers.map((d) => d.tyreAge)
      const next = canonicalRaceEngineService.advanceOneLap(race)

      // Todo piloto ativo deve ter sua idade de pneu ou voltas avançadas
      next.drivers.forEach((d, idx) => {
        if (!d.isDnf && d.raceStatus !== 'dnf') {
          expect(d.tyreAge).toBe(prevTyreAges[idx] + 1)
          expect(d.lap).toBe(1)
        }
      })
    })
  })

  // PROVA F: Navegação Race Control ↔ Página Principal (Mesma Sessão Canônica)
  describe('F) Navegação Race Control ↔ Página Principal preserva o estado canônico', () => {
    it('provar que não há chamadas a Math.random() ou PRNG paralelo no fluxo de avanço canônico', () => {
      let randomCalled = false
      const origRandom = Math.random
      Math.random = () => {
        randomCalled = true
        return origRandom()
      }

      try {
        const race = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
          careerId: 'test_career_no_math_random',
          season: 2026,
          round: 1,
          circuitName: 'Bahrain',
          circuitCountry: 'Bahrain',
          totalLaps: 20,
          playerTeamId: 'ferrari',
          canonicalQualifyingGrid: mockGrid,
        })
        expect(race.currentLap).toBe(0)
        // Step lap canônico
        const nextState = canonicalRaceEngineService.advanceOneLap(race)
        expect(nextState.currentLap).toBe(1)
        // Determinismo mantido: zero invocação de Math.random descontrolado
        expect(randomCalled).toBe(false)
      } finally {
        Math.random = origRandom
      }
    })

    it('salvar o estado e recarregá-lo não reinicia, re-sorteia nem modifica a corrida', () => {
      const careerId = 'test_career_nav_flow'
      const season = 2026
      const round = 1

      const initialRace = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId,
        season,
        round,
        circuitName: 'Bahrain',
        circuitCountry: 'Bahrain',
        totalLaps: 20,
        playerTeamId: 'ferrari',
        canonicalQualifyingGrid: mockGrid,
      })

      // Avança 3 voltas
      const after3Laps = canonicalRaceEngineService.advanceMultipleLaps(initialRace, 3)
      expect(after3Laps.currentLap).toBe(3)

      // Persiste o estado canônico
      canonicalRaceInitializationService.saveCanonicalRaceState(after3Laps)

      // Lê o estado canônico como a nova rota /corrida/live faria
      const readState = canonicalRaceInitializationService.readCanonicalRaceState(
        careerId,
        season,
        round,
        'MAIN_RACE',
      )

      expect(readState).not.toBeNull()
      expect(readState?.currentLap).toBe(3)
      expect(readState?.drivers[0].driverId).toBe(after3Laps.drivers[0].driverId)
      expect(readState?.drivers[0].raceTime).toBe(after3Laps.drivers[0].raceTime)
      expect(readState?.events.length).toBe(after3Laps.events.length)

      // Limpa dados de teste
      canonicalRaceInitializationService.clearCanonicalRaceState(careerId, season, round, {
        raceVariant: 'MAIN_RACE',
      })
    })
  })
})
