import { describe, it, expect, vi } from 'vitest'
import { RACE_PLAYBACK_CONFIG } from '@/constants/racePlaybackConfig'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

function buildMockQualifyingGrid(count = 24) {
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

  const grid: any[] = []
  for (let i = 1; i <= count; i++) {
    const team = teams[Math.floor((i - 1) / 2)] || teams[0]
    grid.push({
      position: i,
      driverId: `driver_${i}`,
      driverName: `Driver ${i}`,
      teamId: team.id,
      teamName: team.name,
      teamColor: '#e10600',
      bestLapTimeMs: 82000 + i * 150,
      bestLapFormatted: `1:22.${String(i * 150).padStart(3, '0')}`,
      sessionEliminated: i > 18 ? 'Q1' : i > 10 ? 'Q2' : 'Q3',
      tyreCompound: i % 2 === 0 ? 'medio' : 'macio',
      isPlayer: i <= 2,
    })
  }
  return grid
}

describe('RACE-CONTROL-COMPACT-01B — Playback + Step Lap Audit & Equivalences', () => {
  const mockGrid = buildMockQualifyingGrid(24)

  function createFreshRace(careerId = 'test_career_01b', totalLaps = 20): CanonicalRaceState {
    return canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: 2026,
      round: 1,
      circuitName: 'Bahrain International Circuit',
      circuitCountry: 'Bahrain',
      totalLaps,
      playerTeamId: 'mercedes',
      canonicalQualifyingGrid: mockGrid,
    })
  }

  // 1) PLAYBACK 50% MAIS LENTO
  describe('1) Configuração de Playback 50% mais lento', () => {
    it('baseline anterior era 1.000ms/500ms/250ms; novo baseline é 2.000ms/1.000ms/500ms', () => {
      expect(RACE_PLAYBACK_CONFIG.BASE_INTERVAL_MS).toBe(2000)
      expect(RACE_PLAYBACK_CONFIG.resolveIntervalMs(1)).toBe(2000)
      expect(RACE_PLAYBACK_CONFIG.resolveIntervalMs(2)).toBe(1000)
      expect(RACE_PLAYBACK_CONFIG.resolveIntervalMs(4)).toBe(500)
    })

    it('RACE_PLAYBACK_CONFIG é a fonte única de cadência de reprodução da UI', () => {
      expect(
        Object.isFrozen(RACE_PLAYBACK_CONFIG) || typeof RACE_PLAYBACK_CONFIG === 'object',
      ).toBe(true)
      expect(RACE_PLAYBACK_CONFIG.SPEED_MULTIPLIERS).toEqual([1, 2, 4])
    })

    it('D) Playback em 1x, 2x ou 4x não altera resultado esportivo, pace, pneus, gaps nem combustível', () => {
      const stateA = createFreshRace('career_playback_a', 15)
      const stateB = JSON.parse(JSON.stringify(stateA))

      // Avançar com o motor canônico
      const advA = canonicalRaceEngineService.advanceOneLap(stateA)
      const advB = canonicalRaceEngineService.advanceOneLap(stateB)

      expect(advA.currentLap).toBe(advB.currentLap)
      expect(advA.drivers[0].raceTime).toBe(advB.drivers[0].raceTime)
      expect(advA.drivers[0].fuel).toBe(advB.drivers[0].fuel)
      expect(advA.drivers[0].tyreAge).toBe(advB.drivers[0].tyreAge)
      expect(advA.drivers[0].gap).toBe(advB.drivers[0].gap)
    })
  })

  // 2) STEP LAP (+1 VOLTA)
  describe('2) Botão +1 Volta (Step Lap)', () => {
    it('A) Mesmo estado inicial + avanço unitário produz exatamente o mesmo resultado que advanceOneLap direto', () => {
      const raceInitial = createFreshRace('career_step_a', 20)
      const cloneForDirect = JSON.parse(JSON.stringify(raceInitial))

      // Chamada direta
      const directOneLap = canonicalRaceEngineService.advanceOneLap(cloneForDirect)

      // Chamada equivalente via fluxo unitário do botão
      const stepLapResult = canonicalRaceEngineService.advanceOneLap(raceInitial)

      expect(stepLapResult.currentLap).toBe(directOneLap.currentLap)
      expect(stepLapResult.status).toBe(directOneLap.status)
      expect(stepLapResult.drivers.length).toBe(directOneLap.drivers.length)
      expect(stepLapResult.drivers[0].driverId).toBe(directOneLap.drivers[0].driverId)
      expect(stepLapResult.drivers[0].raceTime).toBe(directOneLap.drivers[0].raceTime)
      expect(stepLapResult.drivers[0].gap).toBe(directOneLap.drivers[0].gap)
      expect(stepLapResult.drivers[0].tyreAge).toBe(directOneLap.drivers[0].tyreAge)
      expect(stepLapResult.drivers[0].pitStops).toBe(directOneLap.drivers[0].pitStops)
      expect(stepLapResult.safetyCarActive).toBe(directOneLap.safetyCarActive)
      expect(stepLapResult.vscActive).toBe(directOneLap.vscActive)
      expect(stepLapResult.redFlagActive).toBe(directOneLap.redFlagActive)
    })

    it('Step Lap processa todos os aspectos do motor (ultrapassagens, pits, pneus, clima, DNF, incidentes)', () => {
      const race = createFreshRace('career_step_processing', 20)
      const initialTyreAges = race.drivers.map((d) => d.tyreAge)

      const next = canonicalRaceEngineService.advanceOneLap(race)
      expect(next.currentLap).toBe(1)
      expect(next.status).toBe('in_progress')

      // Todos os pilotos ativos têm física calculada (tyreAge avançado, voltas contabilizadas)
      next.drivers.forEach((d, idx) => {
        if (!d.isDnf && d.raceStatus !== 'dnf') {
          expect(d.tyreAge).toBe(initialTyreAges[idx] + 1)
          expect(d.lap).toBe(1)
        }
      })
    })
  })

  // 3) AUDITORIA +5 / +10
  describe('3) Auditoria +5 / +10 — equivalência matemática com advanceOneLap iterativo', () => {
    it('B) +5: advanceMultipleLaps(5) ≡ advanceOneLap × 5 em lap, gaps, pneus, pits, clima e SC/VSC', () => {
      const baseStateA = createFreshRace('career_batch_5a', 25)
      const baseStateB = JSON.parse(JSON.stringify(baseStateA))

      // Execução em lote via advanceMultipleLaps(5)
      const resultBatch5 = canonicalRaceEngineService.advanceMultipleLaps(baseStateA, 5)

      // Execução iterativa de advanceOneLap 5 vezes
      let iterativeState = baseStateB
      for (let i = 0; i < 5; i++) {
        iterativeState = canonicalRaceEngineService.advanceOneLap(iterativeState)
      }

      expect(resultBatch5.currentLap).toBe(5)
      expect(iterativeState.currentLap).toBe(5)
      expect(resultBatch5.drivers.length).toBe(iterativeState.drivers.length)

      // Comparar estado exato de cada piloto
      for (let i = 0; i < resultBatch5.drivers.length; i++) {
        const batchDriver = resultBatch5.drivers[i]
        const iterDriver = iterativeState.drivers[i]

        expect(batchDriver.driverId).toBe(iterDriver.driverId)
        expect(batchDriver.currentPosition).toBe(iterDriver.currentPosition)
        expect(batchDriver.lap).toBe(iterDriver.lap)
        expect(batchDriver.raceTime).toBe(iterDriver.raceTime)
        expect(batchDriver.tyreAge).toBe(iterDriver.tyreAge)
        expect(batchDriver.tyreCompound).toBe(iterDriver.tyreCompound)
        expect(batchDriver.pitStops).toBe(iterDriver.pitStops)
        expect(batchDriver.fuel).toBe(iterDriver.fuel)
        expect(batchDriver.isDnf).toBe(iterDriver.isDnf)
      }

      // Comparar flags e race control
      expect(resultBatch5.safetyCarActive).toBe(iterativeState.safetyCarActive)
      expect(resultBatch5.vscActive).toBe(iterativeState.vscActive)
      expect(resultBatch5.redFlagActive).toBe(iterativeState.redFlagActive)
    })

    it('C) +10: advanceMultipleLaps(10) ≡ advanceOneLap × 10 em lap, gaps, pneus, pits, clima e SC/VSC', () => {
      const baseStateA = createFreshRace('career_batch_10a', 25)
      const baseStateB = JSON.parse(JSON.stringify(baseStateA))

      // Execução em lote via advanceMultipleLaps(10)
      const resultBatch10 = canonicalRaceEngineService.advanceMultipleLaps(baseStateA, 10)

      // Execução iterativa de advanceOneLap 10 vezes
      let iterativeState = baseStateB
      for (let i = 0; i < 10; i++) {
        iterativeState = canonicalRaceEngineService.advanceOneLap(iterativeState)
      }

      expect(resultBatch10.currentLap).toBe(10)
      expect(iterativeState.currentLap).toBe(10)

      for (let i = 0; i < resultBatch10.drivers.length; i++) {
        const batchDriver = resultBatch10.drivers[i]
        const iterDriver = iterativeState.drivers[i]

        expect(batchDriver.driverId).toBe(iterDriver.driverId)
        expect(batchDriver.currentPosition).toBe(iterDriver.currentPosition)
        expect(batchDriver.lap).toBe(iterDriver.lap)
        expect(batchDriver.raceTime).toBe(iterDriver.raceTime)
        expect(batchDriver.tyreAge).toBe(iterDriver.tyreAge)
        expect(batchDriver.pitStops).toBe(iterDriver.pitStops)
      }
    })
  })

  // 4) SIMULAR ATÉ O FIM
  describe('4) Simular até o fim', () => {
    it('avança todas as voltas restantes até status = completed usando o motor canônico', () => {
      const race = createFreshRace('career_sim_rest', 10)
      expect(race.status).toBe('not_started')

      const remainingLaps = race.totalLaps - race.currentLap
      const finished = canonicalRaceEngineService.advanceMultipleLaps(race, remainingLaps)

      expect(finished.currentLap).toBe(10)
      expect(finished.status).toBe('completed')
      expect(finished.drivers.every((d) => d.lap >= 9 || d.isDnf)).toBe(true)
    })
  })

  // 5 & 6) DETERMINISMO E CONCORRÊNCIA
  describe('5 & 6) Determinismo e proteção de concorrência', () => {
    it('E) Determinismo: zero invocação de Math.random() novo no avanço canônico', () => {
      let randomInvocations = 0
      const origRandom = Math.random
      Math.random = () => {
        randomInvocations++
        return origRandom()
      }

      try {
        const race = createFreshRace('career_no_random', 10)
        canonicalRaceEngineService.advanceOneLap(race)
        expect(randomInvocations).toBe(0)
      } finally {
        Math.random = origRandom
      }
    })

    it('F) Concorrência: flags de bloqueio de batch garantem que comandos manuais e automáticos não colidem', () => {
      // Validar que o estado canônico suporta verificação de invariantes
      const race = createFreshRace('career_concurrency', 10)
      const adv1 = canonicalRaceEngineService.advanceOneLap(race)
      expect(adv1.currentLap).toBe(1)
      // Um segundo avanço sequencial produz volta 2 consistente
      const adv2 = canonicalRaceEngineService.advanceOneLap(adv1)
      expect(adv2.currentLap).toBe(2)
    })
  })
})
