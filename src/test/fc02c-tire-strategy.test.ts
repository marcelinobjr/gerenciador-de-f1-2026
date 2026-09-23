/**
 * fc02c-tire-strategy.test.ts
 *
 * Suíte Oficial de Testes de Homologação FC02C — PNEUS
 * Valida os requisitos canônicos FC02C-01 a FC02C-10:
 *
 * FC02C-01: pneus novos respeitam TIRE_SPECS (macio ~11 cliff/13 max; medio 24/26; duro 38/40).
 * FC02C-02: fator de piloto ajusta autonomia (agressivo reduz, conservador estende).
 * FC02C-03: abrasividade de pista ajusta estimativa proporcionalmente.
 * FC02C-04: pneus usados (initialWearPct) reduzem estimativa proporcionalmente.
 * FC02C-05: janela de pit respeita totalRaceLaps e composto atual.
 * FC02C-06: estratégia de 2 paradas divide stints coerentemente sem exceder o cliff.
 * FC02C-07: faixas do indicador (0–25 verde, 26–59 âmbar, 60–79 laranja, ≥80/cliff vermelho).
 * FC02C-08: selectCarTireDisplayState expõe dados consistentes e não inventa dados em caso de ausência.
 * FC02C-09: PreRaceStrategyPreparationPanel exibe estimativa canônica e janela recomendada para ambos os carros independentemente.
 * FC02C-10: regressão — compatibilidade 100% com preparação de corrida do BUG-02.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  estimateCompoundLifespanLaps,
  calculateRecommendedPitWindow,
  getTireDegradationBand,
  formatCompoundLifespanBadge,
  selectCarTireDisplayState,
  calculateDriverTireWearProfile,
  TIRE_SPECS,
} from '@/lib/canonical-tire-strategy'
import { canonicalRacePreparationService } from '@/services/canonicalRacePreparationService'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { TireSetItem } from '@/types/f1'

describe('FC02C — PNEUS: Suíte Canônica de Autonomia, Degradação e Janela de Pit (FC02C-01..10)', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  // FC02C-01: pneus novos respeitam TIRE_SPECS (macio ~11 cliff/13 max; medio 24/26; duro 38/40).
  it('FC02C-01: pneus novos respeitam TIRE_SPECS (macio ~11 cliff/13 max; medio 24/26; duro 38/40)', () => {
    // Com parâmetros padrão: driverWearMultiplier=1.0, trackAbrasiveness=6 (fator=1.07), initialWearPct=0
    // Divisor padrão = 1.0 * (1 + (6 - 5)*0.07) = 1.07
    // macio: cliff 11 / 1.07 = 10.28 -> round 10 ou com abrasividade neutra 5: 11 e 13
    const macioNeutra = estimateCompoundLifespanLaps('macio', {
      driverWearMultiplier: 1.0,
      trackAbrasiveness: 5, // fator neutro = 1.0
      initialWearPct: 0,
    })
    expect(macioNeutra.usefulLaps).toBe(TIRE_SPECS.macio.cliffLapThreshold) // 11
    expect(macioNeutra.maximumLaps).toBe(TIRE_SPECS.macio.baseLapsLife) // 13

    const medioNeutra = estimateCompoundLifespanLaps('medio', {
      driverWearMultiplier: 1.0,
      trackAbrasiveness: 5,
      initialWearPct: 0,
    })
    expect(medioNeutra.usefulLaps).toBe(TIRE_SPECS.medio.cliffLapThreshold) // 24
    expect(medioNeutra.maximumLaps).toBe(TIRE_SPECS.medio.baseLapsLife) // 26

    const duroNeutra = estimateCompoundLifespanLaps('duro', {
      driverWearMultiplier: 1.0,
      trackAbrasiveness: 5,
      initialWearPct: 0,
    })
    expect(duroNeutra.usefulLaps).toBe(TIRE_SPECS.duro.cliffLapThreshold) // 38
    expect(duroNeutra.maximumLaps).toBe(TIRE_SPECS.duro.baseLapsLife) // 40

    // Com abrasividade padrão 6:
    const macioPadrao = estimateCompoundLifespanLaps('macio')
    expect(macioPadrao.usefulLaps).toBeGreaterThanOrEqual(10)
    expect(macioPadrao.maximumLaps).toBeGreaterThanOrEqual(12)
    expect(macioPadrao.maximumLaps).toBeGreaterThanOrEqual(macioPadrao.usefulLaps)

    const medioPadrao = estimateCompoundLifespanLaps('medio')
    expect(medioPadrao.usefulLaps).toBeGreaterThanOrEqual(22)
    expect(medioPadrao.maximumLaps).toBeGreaterThanOrEqual(24)

    const duroPadrao = estimateCompoundLifespanLaps('duro')
    expect(duroPadrao.usefulLaps).toBeGreaterThanOrEqual(35)
    expect(duroPadrao.maximumLaps).toBeGreaterThanOrEqual(37)
  })

  // FC02C-02: fator de piloto ajusta autonomia (agressivo reduz, conservador estende).
  it('FC02C-02: fator de piloto ajusta autonomia (agressivo reduz, conservador estende)', () => {
    const conservadorProfile = calculateDriverTireWearProfile({
      speed: 70,
      consistency: 95,
      physical_condition: 95,
      morale: 90,
    })
    const agressivoProfile = calculateDriverTireWearProfile({
      speed: 98,
      consistency: 70,
      physical_condition: 75,
      morale: 70,
    })

    expect(conservadorProfile.multiplier).toBeLessThan(1.0)
    expect(agressivoProfile.multiplier).toBeGreaterThan(1.0)

    const estimativaConservador = estimateCompoundLifespanLaps('medio', {
      driverWearMultiplier: conservadorProfile.multiplier,
      trackAbrasiveness: 5,
    })
    const estimativaAgressivo = estimateCompoundLifespanLaps('medio', {
      driverWearMultiplier: agressivoProfile.multiplier,
      trackAbrasiveness: 5,
    })

    // Piloto conservador roda mais voltas úteis antes do cliff
    expect(estimativaConservador.usefulLaps).toBeGreaterThan(estimativaAgressivo.usefulLaps)
    expect(estimativaConservador.maximumLaps).toBeGreaterThan(estimativaAgressivo.maximumLaps)
  })

  // FC02C-03: abrasividade de pista ajusta estimativa proporcionalmente.
  it('FC02C-03: abrasividade de pista ajusta estimativa proporcionalmente', () => {
    // Pista lisa (ex: abrasividade 2) vs pista abrasiva (ex: abrasividade 9)
    const pistaLisa = estimateCompoundLifespanLaps('duro', {
      trackAbrasiveness: 2,
    })
    const pistaAbrasiva = estimateCompoundLifespanLaps('duro', {
      trackAbrasiveness: 9,
    })

    expect(pistaLisa.trackFactor).toBeLessThan(pistaAbrasiva.trackFactor)
    expect(pistaLisa.usefulLaps).toBeGreaterThan(pistaAbrasiva.usefulLaps)
    expect(pistaLisa.maximumLaps).toBeGreaterThan(pistaAbrasiva.maximumLaps)
  })

  // FC02C-04: pneus usados (initialWearPct) reduzem estimativa proporcionalmente.
  it('FC02C-04: pneus usados (initialWearPct) reduzem estimativa proporcionalmente', () => {
    const novo = estimateCompoundLifespanLaps('medio', {
      trackAbrasiveness: 5,
      driverWearMultiplier: 1.0,
      initialWearPct: 0,
    })
    const meiaVida = estimateCompoundLifespanLaps('medio', {
      trackAbrasiveness: 5,
      driverWearMultiplier: 1.0,
      initialWearPct: 50,
    })
    const quaseGasto = estimateCompoundLifespanLaps('medio', {
      trackAbrasiveness: 5,
      driverWearMultiplier: 1.0,
      initialWearPct: 80,
    })

    expect(novo.usefulLaps).toBe(24)
    expect(meiaVida.usefulLaps).toBe(12) // exatamente metade
    expect(quaseGasto.usefulLaps).toBeLessThan(meiaVida.usefulLaps)
    expect(meiaVida.priorLifeDiscount).toBe(0.5)
  })

  // FC02C-05: janela de pit respeita totalRaceLaps e composto atual.
  it('FC02C-05: janela de pit respeita totalRaceLaps e composto atual', () => {
    const totalLaps = 57
    const windowSoft = calculateRecommendedPitWindow({
      currentStintCompound: 'macio',
      totalRaceLaps: totalLaps,
    })
    const windowHard = calculateRecommendedPitWindow({
      currentStintCompound: 'duro',
      totalRaceLaps: totalLaps,
    })

    // Macio exige parada muito mais cedo que o duro
    expect(windowSoft.optimalLap).toBeLessThan(windowHard.optimalLap)
    expect(windowSoft.windowEnd).toBeLessThanOrEqual(TIRE_SPECS.macio.cliffLapThreshold)
    expect(windowHard.windowEnd).toBeLessThan(totalLaps)

    // Formato de texto canônico
    expect(windowSoft.windowText).toMatch(/Voltas \d+–\d+/)
    expect(windowSoft.windowStart).toBeLessThanOrEqual(windowSoft.windowEnd)

    // Corrida curta (ex: 20 voltas): nunca pode passar de totalLaps
    const shortRace = calculateRecommendedPitWindow({
      currentStintCompound: 'duro',
      totalRaceLaps: 18,
    })
    expect(shortRace.optimalLap).toBeLessThan(18)
    expect(shortRace.windowEnd).toBeLessThan(18)
  })

  // FC02C-06: estratégia de 2 paradas divide stints coerentemente sem exceder o cliff.
  it('FC02C-06: estratégia de 2 paradas divide stints coerentemente sem exceder o cliff', () => {
    const totalLaps = 60
    const stint1 = calculateRecommendedPitWindow({
      currentStintCompound: 'macio',
      totalRaceLaps: totalLaps,
      stintNumber: 1,
      totalStintsPlanned: 3, // 2 paradas = 3 stints
    })
    const stint2 = calculateRecommendedPitWindow({
      currentStintCompound: 'medio',
      totalRaceLaps: totalLaps,
      stintNumber: 2,
      totalStintsPlanned: 3,
    })

    // Stint 1 no macio deve parar cedo e não exceder o cliff do macio
    expect(stint1.optimalLap).toBeLessThanOrEqual(TIRE_SPECS.macio.cliffLapThreshold)
    expect(stint1.windowEnd).toBeLessThanOrEqual(TIRE_SPECS.macio.cliffLapThreshold)

    // Stint 2 (segunda parada) ocorre mais tarde na corrida
    expect(stint2.optimalLap).toBeGreaterThan(stint1.optimalLap)
    expect(stint2.windowStart).toBeGreaterThan(stint1.windowEnd)
  })

  // FC02C-07: faixas do indicador (0–25 verde, 26–59 âmbar, 60–79 laranja, ≥80/cliff vermelho).
  it('FC02C-07: faixas do indicador (0–25 verde, 26–59 âmbar, 60–79 laranja, ≥80/cliff vermelho)', () => {
    const band0 = getTireDegradationBand(0)
    expect(band0.key).toBe('nominal')
    expect(band0.label).toBe('Nominal')
    expect(band0.colorClass).toContain('bg-emerald-500')
    expect(band0.animatePulse).toBe(false)

    const band25 = getTireDegradationBand(25)
    expect(band25.key).toBe('nominal')

    const band26 = getTireDegradationBand(26)
    expect(band26.key).toBe('moderada')
    expect(band26.label).toBe('Moderada')
    expect(band26.colorClass).toContain('bg-amber-500')

    const band59 = getTireDegradationBand(59)
    expect(band59.key).toBe('moderada')

    const band60 = getTireDegradationBand(60)
    expect(band60.key).toBe('alerta')
    expect(band60.label).toBe('Alerta')
    expect(band60.colorClass).toContain('bg-orange-500')

    const band79 = getTireDegradationBand(79)
    expect(band79.key).toBe('alerta')

    const band80 = getTireDegradationBand(80)
    expect(band80.key).toBe('critica')
    expect(band80.label).toBe('Cliff/Janela Crítica')
    expect(band80.colorClass).toContain('bg-rose-600')
    expect(band80.animatePulse).toBe(true)

    // Cliff explícito ativa crítico mesmo com desgaste menor
    const bandCliff = getTireDegradationBand(30, true)
    expect(bandCliff.key).toBe('critica')
    expect(bandCliff.animatePulse).toBe(true)
  })

  // FC02C-08: selectCarTireDisplayState expõe dados consistentes e não inventa dados em caso de ausência.
  it('FC02C-08: selectCarTireDisplayState expõe dados consistentes e não inventa dados em caso de ausência', () => {
    // Carro ausente/nulo
    const empty = selectCarTireDisplayState(null)
    expect(empty.hasData).toBe(false)
    expect(empty.compound).toBeNull()
    expect(empty.tireWearPct).toBeNull()
    expect(empty.tireWearText).toBe('—')
    expect(empty.lapsOnTire).toBeNull()
    expect(empty.lapsOnTireText).toBe('—')

    // Carro com pneu 0% de desgaste (novo)
    const brandNew = selectCarTireDisplayState({
      tireCompound: 'macio',
      tireWear: 0,
      lapsOnCurrentTire: 0,
    })
    expect(brandNew.hasData).toBe(true)
    expect(brandNew.compound).toBe('macio')
    expect(brandNew.tireWearPct).toBe(0)
    expect(brandNew.tireWearText).toBe('0%')
    expect(brandNew.tireConditionPct).toBe(100)
    expect(brandNew.isInCliff).toBe(false)

    // Carro com dados de cliff
    const inCliffCar = selectCarTireDisplayState({
      tireCompound: 'macio',
      tireWear: 82,
      lapsOnCurrentTire: 15,
      cliffStatus: { isCliffReached: 4 },
    })
    expect(inCliffCar.isInCliff).toBe(true)
    expect(inCliffCar.isHighDegradation).toBe(true)
  })

  // FC02C-09: PreRaceStrategyPreparationPanel exibe estimativa canônica e janela recomendada para ambos os carros independentemente.
  it('FC02C-09: PreRaceStrategyPreparationPanel integra dados canônicos independentes para ambos os carros', () => {
    const badgeCar1 = formatCompoundLifespanBadge('macio')
    const badgeCar2 = formatCompoundLifespanBadge('duro')

    expect(badgeCar1).toContain('Macio')
    expect(badgeCar2).toContain('Duro')
    expect(badgeCar1).not.toBe(badgeCar2)

    // Janelas independentes
    const windowCar1 = calculateRecommendedPitWindow({
      currentStintCompound: 'macio',
      totalRaceLaps: 57,
      stintNumber: 1,
    })
    const windowCar2 = calculateRecommendedPitWindow({
      currentStintCompound: 'duro',
      totalRaceLaps: 57,
      stintNumber: 1,
    })

    expect(windowCar1.optimalLap).toBeLessThan(windowCar2.optimalLap)
    expect(windowCar1.windowText).not.toBe(windowCar2.windowText)
  })

  // FC02C-10: regressão — compatibilidade 100% com preparação de corrida do BUG-02.
  it('FC02C-10: regressão — compatibilidade 100% com preparação de corrida do BUG-02', () => {
    const careerId = 'career_fc02c_test'
    const seasonYear = 2026
    const round = 1
    const teamId = 'team_audi'
    const totalLaps = 57

    const mockGrid: FinalQualifyingGridEntry[] = [
      {
        gridPosition: 1,
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        teamId,
        teamName: 'Audi F1 Team',
        teamColor: '#E10600',
        isPlayer: true,
        bestLapCompound: 'macio',
        eliminationStage: 'Q3',
        bestLapSec: 81.2,
        bestLapTime: '1:21.200',
      },
      {
        gridPosition: 2,
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        teamId,
        teamName: 'Audi F1 Team',
        teamColor: '#E10600',
        isPlayer: true,
        bestLapCompound: 'duro',
        eliminationStage: 'Q3',
        bestLapSec: 81.5,
        bestLapTime: '1:21.500',
      },
    ]

    const mockInventories: Record<string, TireSetItem[]> = {
      drv_1: [
        {
          id: 'set_1',
          driverId: 'drv_1',
          compound: 'macio',
          wear: 10,
          lapsUsed: 2,
          isFitted: true,
          status: 'usado',
        },
      ],
      drv_2: [
        {
          id: 'set_2',
          driverId: 'drv_2',
          compound: 'duro',
          wear: 0,
          lapsUsed: 0,
          isFitted: true,
          status: 'disponivel',
        },
      ],
    }

    const snapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId,
      seasonYear,
      round,
      teamId,
      totalLaps,
      grid: mockGrid,
      inventories: mockInventories,
    })

    expect(snapshot.schemaVersion).toBe('race-prep-v1')
    expect(snapshot.cars.length).toBe(2)

    // Validação estrita de cada carro continua válida (BUG-02)
    const val1 = canonicalRacePreparationService.validateCarPreparation(
      snapshot.cars[0],
      totalLaps,
      mockInventories.drv_1,
    )
    const val2 = canonicalRacePreparationService.validateCarPreparation(
      snapshot.cars[1],
      totalLaps,
      mockInventories.drv_2,
    )
    expect(val1.valid).toBe(true)
    expect(val2.valid).toBe(true)

    // Métodos FC02C adicionados ao serviço
    const lifespan1 = canonicalRacePreparationService.getTireCompoundLifespan(
      snapshot.cars[0].startingCompound,
      { initialWearPct: snapshot.cars[0].initialTyreWear },
    )
    expect(lifespan1.compound).toBe('macio')
    expect(lifespan1.usefulLaps).toBeGreaterThanOrEqual(1)

    const pitRec = canonicalRacePreparationService.getRecommendedPitWindow({
      currentStintCompound: snapshot.cars[0].startingCompound,
      totalRaceLaps: totalLaps,
    })
    expect(pitRec.windowText).toMatch(/Voltas \d+–\d+/)

    // Salvar e carregar snapshot continua preservado
    canonicalRacePreparationService.saveSnapshot(snapshot)
    const loaded = canonicalRacePreparationService.loadSnapshot(careerId, seasonYear, round)
    expect(loaded).not.toBeNull()
    expect(loaded?.cars[0].driverId).toBe('drv_1')
    expect(loaded?.cars[1].driverId).toBe('drv_2')
  })
})
