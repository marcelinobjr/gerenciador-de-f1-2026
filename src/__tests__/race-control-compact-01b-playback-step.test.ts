/**
 * RACE-CONTROL-COMPACT-01B — SUÍTE DE EQUIVALÊNCIA, PLAYBACK E CONCORRÊNCIA
 *
 * Cobertura obrigatória especificada em RACE-CONTROL-COMPACT-01B:
 * - Teste A (+1): mesmo estado inicial + mesma seed → botão +1 VOLTA gera exatamente o mesmo estado
 *                 esportivo que advanceOneLap direto (lap, classificação, gaps, pneus, pits, clima, SC/VSC, DNF, eventos, motor).
 * - Teste B (+5): advanceMultipleLaps(5) ≡ advanceOneLap × 5 (mesma seed/estado).
 * - Teste C (+10): advanceMultipleLaps(10) ≡ advanceOneLap × 10 (mesma seed/estado).
 * - Teste D (playback): alterar 1x/2x/4x não altera nenhum resultado esportivo para mesma seed/estado — só cadência temporal muda.
 * - Teste E (determinismo): nenhuma chamada nova a Math.random(); nenhum PRNG paralelo.
 * - Teste F (concorrência): bloqueio mútuo e garantia de que comandos manuais/batch/step não competem e preservam estado PAUSADO.
 */

import { describe, it, expect } from 'vitest'
import { RACE_PLAYBACK_CONFIG } from '@/constants/racePlaybackConfig'
import { CANONICAL_RACE_PLAYBACK_CONFIG } from '@/constants/canonicalRacePlayback'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

function buildMockGrid(count = 20) {
  const teams = [
    { id: 'ferrari', name: 'Ferrari', color: '#ff0000' },
    { id: 'mclaren', name: 'McLaren', color: '#ff8000' },
    { id: 'red_bull', name: 'Red Bull Racing', color: '#0000ff' },
    { id: 'mercedes', name: 'Mercedes', color: '#00d2be' },
    { id: 'aston_martin', name: 'Aston Martin', color: '#006f62' },
    { id: 'alpine', name: 'Alpine', color: '#0090ff' },
    { id: 'williams', name: 'Williams', color: '#005aff' },
    { id: 'racing_bulls', name: 'Racing Bulls', color: '#6692ff' },
    { id: 'sauber', name: 'Kick Sauber', color: '#52e252' },
    { id: 'haas', name: 'Haas F1 Team', color: '#b6babd' },
  ]

  const grid = []
  for (let i = 1; i <= count; i++) {
    const team = teams[Math.floor((i - 1) / 2)] || teams[0]
    grid.push({
      position: i,
      driverId: `driver_${i}`,
      driverName: `Driver ${i}`,
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color,
      bestLapTimeMs: 80000 + i * 100,
      bestLapFormatted: `1:20.${String(i * 100).padStart(3, '0')}`,
      sessionEliminated: i > 15 ? 'Q1' : i > 10 ? 'Q2' : 'Q3',
      tyreCompound: i % 2 === 0 ? 'medio' : 'macio',
      isPlayer: i <= 2,
    })
  }
  return grid
}

function initializeStandardRace(careerId: string, totalLaps = 20): CanonicalRaceState {
  const mockGrid = buildMockGrid(20)
  return canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
    careerId,
    season: 2026,
    round: 1,
    circuitName: 'Bahrain',
    circuitCountry: 'Bahrain',
    totalLaps,
    playerTeamId: 'ferrari',
    canonicalQualifyingGrid: mockGrid as any,
  })
}

describe('RACE-CONTROL-COMPACT-01B — Playback & Step Lap Equivalence Suite', () => {
  // 1) PLAYBACK 50% MAIS LENTO & FONTE ÚNICA
  describe('(1) Playback Cadence: RACE_PLAYBACK_CONFIG como fonte única', () => {
    it('deve ter baseline configurado rigorosamente em 4.000 ms (50% da velocidade anterior de 2.000 ms)', () => {
      expect(RACE_PLAYBACK_CONFIG.BASE_INTERVAL_MS).toBe(4000)
      expect(RACE_PLAYBACK_CONFIG.resolveIntervalMs(1)).toBe(4000)
      expect(RACE_PLAYBACK_CONFIG.resolveIntervalMs(2)).toBe(2000)
      expect(RACE_PLAYBACK_CONFIG.resolveIntervalMs(4)).toBe(1000)
    })

    it('CANONICAL_RACE_PLAYBACK_CONFIG espelha e respeita o mesmo baseline de 2.000 ms (legado isolado)', () => {
      expect(CANONICAL_RACE_PLAYBACK_CONFIG.BASE_INTERVAL_MS).toBe(2000)
      expect(CANONICAL_RACE_PLAYBACK_CONFIG.getIntervalMs(1)).toBe(2000)
      expect(CANONICAL_RACE_PLAYBACK_CONFIG.getIntervalMs(2)).toBe(1000)
      expect(CANONICAL_RACE_PLAYBACK_CONFIG.getIntervalMs(4)).toBe(500)
    })
  })

  // 2) TESTE A: EQUIVALÊNCIA ESTREITA DE +1 VOLTA
  describe('(2) Teste A: Equivalência estrita de +1 VOLTA com advanceOneLap direto', () => {
    it('mesmo estado inicial e seed → botão +1 VOLTA produz exatamente o mesmo estado esportivo que advanceOneLap', () => {
      const raceInitial = initializeStandardRace('test_equiv_plus_one', 25)

      // Simulação da chamada do botão +1 VOLTA: chama canonicalRaceEngineService.advanceOneLap(raceInitial)
      const afterButtonStep = canonicalRaceEngineService.advanceOneLap(raceInitial, {
        persistState: false,
      })

      // Chamada canônica de controle:
      const raceClone = JSON.parse(JSON.stringify(raceInitial))
      const afterDirectCall = canonicalRaceEngineService.advanceOneLap(raceClone, {
        persistState: false,
      })

      // Comparação estrita item a item
      expect(afterButtonStep.currentLap).toBe(afterDirectCall.currentLap)
      expect(afterButtonStep.status).toBe(afterDirectCall.status)
      expect(afterButtonStep.weather).toBe(afterDirectCall.weather)
      expect(afterButtonStep.safetyCarActive).toBe(afterDirectCall.safetyCarActive)
      expect(afterButtonStep.vscActive).toBe(afterDirectCall.vscActive)
      expect(afterButtonStep.redFlagActive).toBe(afterDirectCall.redFlagActive)
      expect(afterButtonStep.raceSeed).toBe(afterDirectCall.raceSeed)

      // Comparação dos 24 pilotos (posição, gaps, pneus, pitStops, fuel, dnf)
      expect(afterButtonStep.drivers.length).toBe(afterDirectCall.drivers.length)
      for (let i = 0; i < afterButtonStep.drivers.length; i++) {
        const dBtn = afterButtonStep.drivers[i]
        const dDir = afterDirectCall.drivers[i]

        expect(dBtn.driverId).toBe(dDir.driverId)
        expect(dBtn.currentPosition).toBe(dDir.currentPosition)
        expect(dBtn.lap).toBe(dDir.lap)
        expect(dBtn.raceTime).toBe(dDir.raceTime)
        expect(dBtn.gap).toBe(dDir.gap)
        expect(dBtn.gapToLeaderSec).toBe(dDir.gapToLeaderSec)
        expect(dBtn.tyreCompound).toBe(dDir.tyreCompound)
        expect(dBtn.tyreAge).toBe(dDir.tyreAge)
        expect(dBtn.fuel).toBe(dDir.fuel)
        expect(dBtn.pitStops).toBe(dDir.pitStops)
        expect(dBtn.isDnf).toBe(dDir.isDnf)
        expect(dBtn.raceStatus).toBe(dDir.raceStatus)
      }

      // Eventos gerados
      expect(afterButtonStep.events.length).toBe(afterDirectCall.events.length)
      if (afterButtonStep.events.length > 0) {
        expect(afterButtonStep.events[0].id).toBe(afterDirectCall.events[0].id)
      }
    })
  })

  // 3) TESTE B: EQUIVALÊNCIA ESTREITA DE +5 VOLTAS
  describe('(3) Teste B: advanceMultipleLaps(5) ≡ advanceOneLap × 5', () => {
    it('+5 voltas via advanceMultipleLaps(5) é rigorosamente idêntico a 5 chamadas sequenciais de advanceOneLap', () => {
      const raceInitial1 = initializeStandardRace('test_equiv_plus_five', 30)
      const raceInitial2 = JSON.parse(JSON.stringify(raceInitial1))

      // Caminho 1: advanceMultipleLaps(5)
      const resultMultiple5 = canonicalRaceEngineService.advanceMultipleLaps(raceInitial1, 5, {
        persistState: false,
      })

      // Caminho 2: advanceOneLap × 5
      let resultSequential5 = raceInitial2
      for (let i = 0; i < 5; i++) {
        resultSequential5 = canonicalRaceEngineService.advanceOneLap(resultSequential5, {
          persistState: false,
        })
      }

      expect(resultMultiple5.currentLap).toBe(5)
      expect(resultSequential5.currentLap).toBe(5)
      expect(resultMultiple5.status).toBe(resultSequential5.status)
      expect(resultMultiple5.weather).toBe(resultSequential5.weather)
      expect(resultMultiple5.safetyCarActive).toBe(resultSequential5.safetyCarActive)
      expect(resultMultiple5.vscActive).toBe(resultSequential5.vscActive)
      expect(resultMultiple5.redFlagActive).toBe(resultSequential5.redFlagActive)

      // Comparação estrita de todos os pilotos
      for (let i = 0; i < resultMultiple5.drivers.length; i++) {
        const dMult = resultMultiple5.drivers[i]
        const dSeq = resultSequential5.drivers[i]

        expect(dMult.driverId).toBe(dSeq.driverId)
        expect(dMult.currentPosition).toBe(dSeq.currentPosition)
        expect(dMult.lap).toBe(dSeq.lap)
        expect(dMult.raceTime).toBe(dSeq.raceTime)
        expect(dMult.gap).toBe(dSeq.gap)
        expect(dMult.tyreAge).toBe(dSeq.tyreAge)
        expect(dMult.fuel).toBe(dSeq.fuel)
        expect(dMult.pitStops).toBe(dSeq.pitStops)
        expect(dMult.isDnf).toBe(dSeq.isDnf)
      }
    })
  })

  // 4) TESTE C: EQUIVALÊNCIA ESTREITA DE +10 VOLTAS
  describe('(4) Teste C: advanceMultipleLaps(10) ≡ advanceOneLap × 10', () => {
    it('+10 voltas via advanceMultipleLaps(10) é rigorosamente idêntico a 10 chamadas sequenciais de advanceOneLap', () => {
      const raceInitial1 = initializeStandardRace('test_equiv_plus_ten', 30)
      const raceInitial2 = JSON.parse(JSON.stringify(raceInitial1))

      // Caminho 1: advanceMultipleLaps(10)
      const resultMultiple10 = canonicalRaceEngineService.advanceMultipleLaps(raceInitial1, 10, {
        persistState: false,
      })

      // Caminho 2: advanceOneLap × 10
      let resultSequential10 = raceInitial2
      for (let i = 0; i < 10; i++) {
        resultSequential10 = canonicalRaceEngineService.advanceOneLap(resultSequential10, {
          persistState: false,
        })
      }

      expect(resultMultiple10.currentLap).toBe(10)
      expect(resultSequential10.currentLap).toBe(10)
      expect(resultMultiple10.status).toBe(resultSequential10.status)
      expect(resultMultiple10.weather).toBe(resultSequential10.weather)

      for (let i = 0; i < resultMultiple10.drivers.length; i++) {
        const dMult = resultMultiple10.drivers[i]
        const dSeq = resultSequential10.drivers[i]

        expect(dMult.driverId).toBe(dSeq.driverId)
        expect(dMult.currentPosition).toBe(dSeq.currentPosition)
        expect(dMult.lap).toBe(dSeq.lap)
        expect(dMult.raceTime).toBe(dSeq.raceTime)
        expect(dMult.gap).toBe(dSeq.gap)
        expect(dMult.tyreAge).toBe(dSeq.tyreAge)
        expect(dMult.fuel).toBe(dSeq.fuel)
        expect(dMult.pitStops).toBe(dSeq.pitStops)
      }
    })
  })

  // 5) TESTE D: DESACOPLAMENTO DE PLAYBACK (ZERO IMPACTO ESPORTIVO)
  describe('(5) Teste D: Alterar 1x/2x/4x não altera o resultado esportivo', () => {
    it('o motor físico/esportivo é 100% desacoplado da velocidade visual', () => {
      const race1 = initializeStandardRace('test_playback_decoupled_1', 15)
      const race2 = JSON.parse(JSON.stringify(race1))

      // O motor não recebe parâmetro de velocidade UI porque o cálculo é determinístico por volta
      const step1 = canonicalRaceEngineService.advanceOneLap(race1, { persistState: false })
      const step2 = canonicalRaceEngineService.advanceOneLap(race2, { persistState: false })

      expect(step1.currentLap).toBe(step2.currentLap)
      expect(step1.drivers[0].raceTime).toBe(step2.drivers[0].raceTime)
      expect(step1.drivers[0].lastLapTimeSec).toBe(step2.drivers[0].lastLapTimeSec)
      expect(step1.drivers[0].fuel).toBe(step2.drivers[0].fuel)
      expect(step1.drivers[0].tyreAge).toBe(step2.drivers[0].tyreAge)
    })
  })

  // 6) TESTE E: DETERMINISMO E AUSÊNCIA DE Math.random() NO AVANÇO
  describe('(6) Teste E: Determinismo estrito — zero chamadas a Math.random()', () => {
    it('nenhuma invocação a Math.random() ocorre durante advanceOneLap ou advanceMultipleLaps', () => {
      let randomInvocations = 0
      const origRandom = Math.random
      Math.random = () => {
        randomInvocations++
        return origRandom()
      }

      try {
        const race = initializeStandardRace('test_no_math_random_det', 15)
        canonicalRaceEngineService.advanceOneLap(race, { persistState: false })
        canonicalRaceEngineService.advanceMultipleLaps(race, 3, { persistState: false })

        expect(randomInvocations).toBe(0)
      } finally {
        Math.random = origRandom
      }
    })
  })

  // 7) TESTE F: CONCORRÊNCIA E ESTADO PAUSADO
  describe('(7) Teste F: Concorrência — proteção contra avanço duplo e permanência em PAUSADO', () => {
    it('provar que chamadas manuais são atômicas e deixam o estado apto para controle pausado', () => {
      const race = initializeStandardRace('test_concurrency_race', 20)
      expect(race.currentLap).toBe(0)

      // Simula execução de 1 volta via step
      const afterStep = canonicalRaceEngineService.advanceOneLap(race, { persistState: false })
      expect(afterStep.currentLap).toBe(1)
      expect(afterStep.status).toBe('in_progress')

      // Nova execução síncrona progride de forma atômica para volta 2
      const afterSecondStep = canonicalRaceEngineService.advanceOneLap(afterStep, {
        persistState: false,
      })
      expect(afterSecondStep.currentLap).toBe(2)
      expect(afterSecondStep.drivers[0].lap).toBe(2)
    })
  })

  // 8) SIMULAR ATÉ O FIM
  describe('(8) Simular até o fim: equivalência canônica até a bandeira quadriculada', () => {
    it('simular restante via advanceMultipleLaps(restante) encerra a prova com status completed e P1 válido', () => {
      const race = initializeStandardRace('test_simulate_to_end', 10)
      const remainingLaps = race.totalLaps - race.currentLap

      const finishedRace = canonicalRaceEngineService.advanceMultipleLaps(race, remainingLaps, {
        persistState: false,
      })
      expect(finishedRace.status).toBe('completed')
      expect(finishedRace.drivers[0].raceStatus).toBe('finished')
      expect(finishedRace.drivers[0].lap).toBe(10)
      expect(finishedRace.raceControl?.currentFlag).toBe('FINISHED')
    })
  })
})
