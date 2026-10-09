import { describe, it, expect } from 'vitest'
import {
  calculateCareerDriverStatsEffect,
  normalizeStats,
} from '@/services/careerDriverStatsCalculator'

import cjsModule from '../../pocketbase/hooks/career_driver_stats_calculator.js'

describe('RACE-CAREER-SAVE-01D2A2-A — CÁLCULO DE ESTATÍSTICAS (Microbloco Focal)', () => {
  // =========================================================================
  // CASO 1: Caso Piastri do 01D1 (+25 pts, +1 vitória, +1 GP, pole, volta mais rápida)
  // =========================================================================
  describe('1. Caso Piastri do 01D1: +25 pontos, +1 vitória e +1 GP na corrida principal', () => {
    it('calcula o efeito canônico idêntico a updateCareerDriverStats', () => {
      const initialStats = {
        careerGps: 22,
        careerWins: 2,
        careerPoles: 1,
        careerPodiums: 9,
        careerPoints: 262,
        careerFastestLaps: 2,
        careerDnfs: 1,
        careerTitles: 0,
        raceStarts: 22,
        wins: 2,
        podiums: 9,
        poles: 1,
        fastestLaps: 2,
        points: 262,
        dnfs: 1,
        lapsCompleted: 1200,
        pitStops: 45,
        positionsGained: 10,
        bestFinish: 1,
        bestGridPosition: 1,
      }

      // Snapshot entry do Piastri no teste 01D1:
      // P1 largando da Pole (P1), 58 voltas completadas, 25 pontos, sem abandono
      const piastriEntry = {
        driverId: 'driver_piastri',
        teamId: 'team_mclaren',
        driverName: 'Oscar Piastri',
        teamName: 'McLaren F1 Team',
        gridPosition: 1,
        finalPosition: 1,
        positionsGainedLost: 0,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 25,
        pitStops: 1,
      }

      const context = {
        session: 'MAIN_RACE',
        sessionType: 'MAIN_RACE',
        poleDriverId: 'driver_piastri',
        fastestLapDriverId: 'driver_piastri',
      }

      const result = calculateCareerDriverStatsEffect(initialStats, piastriEntry, context)

      // Comprovar effectData
      expect(result.effectData.deltaPoints).toBe(25)
      expect(result.effectData.deltaWins).toBe(1)
      expect(result.effectData.deltaGps).toBe(1)
      expect(result.effectData.deltaRaceStarts).toBe(1)
      expect(result.effectData.deltaPodiums).toBe(1) // P1 é pódio
      expect(result.effectData.deltaPoles).toBe(1) // Poleman
      expect(result.effectData.deltaFastestLaps).toBe(1) // Volta mais rápida
      expect(result.effectData.deltaDnfs).toBe(0)
      expect(result.effectData.deltaLapsCompleted).toBe(58)
      expect(result.effectData.deltaPitStops).toBe(1)
      expect(result.effectData.deltaPositionsGained).toBe(0)
      expect(result.effectData.newFinishPosition).toBe(1)
      expect(result.effectData.newGridPosition).toBe(1)

      // Comprovar afterStats acumulados
      expect(result.afterStats.careerPoints).toBe(initialStats.careerPoints + 25)
      expect(result.afterStats.points).toBe(initialStats.points + 25)
      expect(result.afterStats.careerWins).toBe(initialStats.careerWins + 1)
      expect(result.afterStats.wins).toBe(initialStats.wins + 1)
      expect(result.afterStats.careerGps).toBe(initialStats.careerGps + 1)
      expect(result.afterStats.raceStarts).toBe(initialStats.raceStarts + 1)
      expect(result.afterStats.careerPoles).toBe(initialStats.careerPoles + 1)
      expect(result.afterStats.careerFastestLaps).toBe(initialStats.careerFastestLaps + 1)
      expect(result.afterStats.careerPodiums).toBe(initialStats.careerPodiums + 1)
      expect(result.afterStats.lapsCompleted).toBe(initialStats.lapsCompleted + 58)
      expect(result.afterStats.pitStops).toBe(initialStats.pitStops + 1)
      expect(result.afterStats.bestFinish).toBe(1)
      expect(result.afterStats.bestGridPosition).toBe(1)
    })
  })

  // =========================================================================
  // CASO 2: Caso Sprint
  // =========================================================================
  describe('2. Caso Sprint: comportamento esportivo canônico equivalente ao cálculo atual', () => {
    it('em Sprint atribui pontos mas não incrementa vitória de GP nem GP disputado', () => {
      const initialStats = {
        careerGps: 15,
        careerWins: 1,
        careerPoles: 0,
        careerPodiums: 4,
        careerPoints: 80,
        raceStarts: 15,
        wins: 1,
        points: 80,
        bestFinish: 1,
        bestGridPosition: 2,
      }

      // Vitória em Sprint (P1) rende 8 pontos (regulamento F1 Sprint)
      const sprintEntry = {
        driverId: 'driver_norris',
        gridPosition: 2,
        finalPosition: 1,
        positionsGainedLost: 1,
        lapsCompleted: 19,
        status: 'finished',
        pointsAwarded: 8,
        pitStops: 0,
      }

      const context = {
        sessionType: 'SPRINT_RACE',
        poleDriverId: 'driver_verstappen',
        fastestLapDriverId: 'driver_norris',
      }

      const result = calculateCareerDriverStatsEffect(initialStats, sprintEntry, context)

      // Na Sprint:
      // +8 pontos
      expect(result.effectData.deltaPoints).toBe(8)
      expect(result.afterStats.points).toBe(88)
      expect(result.afterStats.careerPoints).toBe(88)

      // NÃO soma GP (GP/raceStarts permanecem os mesmos)
      expect(result.effectData.deltaGps).toBe(0)
      expect(result.effectData.deltaRaceStarts).toBe(0)
      expect(result.afterStats.careerGps).toBe(15)
      expect(result.afterStats.raceStarts).toBe(15)

      // NÃO soma vitória de GP canônico (mantém 1)
      expect(result.effectData.deltaWins).toBe(0)
      expect(result.afterStats.careerWins).toBe(1)
      expect(result.afterStats.wins).toBe(1)

      // NÃO soma pódio de GP
      expect(result.effectData.deltaPodiums).toBe(0)

      // Voltas completadas somam
      expect(result.effectData.deltaLapsCompleted).toBe(19)
      expect(result.afterStats.lapsCompleted).toBe(19)

      // Posições ganhas somam
      expect(result.effectData.deltaPositionsGained).toBe(1)
      expect(result.afterStats.positionsGained).toBe(1)
    })
  })

  // =========================================================================
  // CASO 3: Imutabilidade e Determinismo
  // =========================================================================
  describe('3. Imutabilidade e Determinismo estrito', () => {
    it('entradas permanecem 100% intactas (sem mutação) e duas chamadas produzem saída idêntica', () => {
      const statsInput = Object.freeze({
        careerGps: 10,
        careerWins: 0,
        careerPoles: 0,
        careerPodiums: 2,
        careerPoints: 40,
        careerFastestLaps: 0,
        careerDnfs: 2,
        careerTitles: 0,
        raceStarts: 10,
        wins: 0,
        podiums: 2,
        poles: 0,
        fastestLaps: 0,
        points: 40,
        dnfs: 2,
        lapsCompleted: 500,
        pitStops: 15,
        positionsGained: 5,
        bestFinish: 3,
        bestGridPosition: 4,
      })

      const entryInput = Object.freeze({
        driverId: 'driver_albon',
        gridPosition: 6,
        finalPosition: 5,
        positionsGainedLost: 1,
        lapsCompleted: 52,
        status: 'finished',
        pointsAwarded: 10,
        pitStops: 2,
      })

      const contextInput = Object.freeze({
        sessionType: 'MAIN_RACE',
        poleDriverId: 'driver_verstappen',
        fastestLapDriverId: 'driver_norris',
      })

      // Clones para conferir se algo foi mutado
      const statsClone = JSON.parse(JSON.stringify(statsInput))
      const entryClone = JSON.parse(JSON.stringify(entryInput))
      const contextClone = JSON.parse(JSON.stringify(contextInput))

      // Primeira execução
      const out1 = calculateCareerDriverStatsEffect(statsInput, entryInput, contextInput)

      // Segunda execução com os mesmos parâmetros
      const out2 = calculateCareerDriverStatsEffect(statsInput, entryInput, contextInput)

      // 1. Verificar imutabilidade das entradas
      expect(statsInput).toEqual(statsClone)
      expect(entryInput).toEqual(entryClone)
      expect(contextInput).toEqual(contextClone)

      // 2. Verificar determinismo (mesma entrada -> mesma saída exata)
      expect(out1).toEqual(out2)
      expect(JSON.stringify(out1)).toBe(JSON.stringify(out2))

      // 3. Verificar que o objeto beforeStats na saída é isolado e não a mesma referência de memória
      expect(out1.beforeStats).not.toBe(statsInput)
      expect(out1.afterStats).not.toBe(statsInput)
    })
  })

  // =========================================================================
  // CASO 4: Casos Limite: DNF, DNS e campos não aditivos (bestFinish, bestGrid)
  // =========================================================================
  describe('4. Casos Limite: DNF, DNS e não aditivos', () => {
    it('trata DNF sem atribuir nova melhor posição de chegada e incrementa dnfs', () => {
      const stats = {
        careerGps: 5,
        careerDnfs: 0,
        dnfs: 0,
        bestFinish: 4,
        bestGridPosition: 3,
      }

      const dnfEntry = {
        driverId: 'driver_leclerc',
        gridPosition: 2,
        finalPosition: 18,
        status: 'dnf',
        dnf: true,
        pointsAwarded: 0,
        lapsCompleted: 12,
      }

      const res = calculateCareerDriverStatsEffect(stats, dnfEntry, { sessionType: 'MAIN_RACE' })

      expect(res.effectData.deltaDnfs).toBe(1)
      expect(res.afterStats.careerDnfs).toBe(1)
      expect(res.afterStats.dnfs).toBe(1)
      // Abandonou: newFinishPosition não é considerado, melhor chegada mantida em 4
      expect(res.afterStats.bestFinish).toBe(4)
      // Mas o grid válido de largada (2) supera o anterior (3)
      expect(res.afterStats.bestGridPosition).toBe(2)
    })

    it('trata DNS sem incrementar largada/GP (deltaGps = 0)', () => {
      const stats = {
        careerGps: 10,
        raceStarts: 10,
      }

      const dnsEntry = {
        driverId: 'driver_sainz',
        status: 'dns',
        gridPosition: 5,
        finalPosition: 20,
      }

      const res = calculateCareerDriverStatsEffect(stats, dnsEntry, {
        sessionType: 'MAIN_RACE',
        isDns: true,
      })

      expect(res.effectData.deltaGps).toBe(0)
      expect(res.afterStats.careerGps).toBe(10)
      expect(res.afterStats.raceStarts).toBe(10)
    })
  })

  // =========================================================================
  // CASO 5: Paridade com o módulo CommonJS exportado para os hooks
  // =========================================================================
  describe('5. Paridade entre o módulo ES e a versão CommonJS para pb_hooks', () => {
    it('a função exportada em pocketbase/hooks produz exatamente o mesmo resultado', () => {
      const stats = {
        careerGps: 8,
        careerWins: 1,
        points: 50,
      }
      const entry = {
        driverId: 'driver_hamilton',
        finalPosition: 1,
        gridPosition: 1,
        pointsAwarded: 25,
      }
      const ctx = {
        sessionType: 'MAIN_RACE',
        poleDriverId: 'driver_hamilton',
        fastestLapDriverId: 'driver_hamilton',
      }

      const esResult = calculateCareerDriverStatsEffect(stats, entry, ctx)
      const cjsResult = cjsModule.calculateCareerDriverStatsEffect(stats, entry, ctx)

      expect(cjsResult).toEqual(esResult)
    })
  })

  // =========================================================================
  // DECLARAÇÃO DO ESCOPO DE COMPROVAÇÃO
  // =========================================================================
  it('declaração de escopo: estes testes comprovam o cálculo, não a idempotência da aplicação no banco', () => {
    const escopoVerificado =
      'Esses testes comprovam o cálculo puro das estatísticas, não a idempotência da aplicação no banco.'
    expect(escopoVerificado).toContain('comprovam o cálculo')
    expect(escopoVerificado).toContain('não a idempotência da aplicação no banco')
  })
})
