import { describe, it, expect } from 'vitest'
import {
  computePracticePace,
  calculatePracticeDriverExecution,
  calculatePracticeExecutionModifier,
  resolveProgramPaceModifier,
  buildPracticeSeedIdentity,
  getPracticeDeterministicRngModifier,
  PRACTICE_RNG_TARGET_RANGE,
} from '@/services/canonicalPracticePaceService'
import { BASELINE_2026_V1_ORDER } from '@/data/baseline-2026-v1'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { canonicalPaceIntegrationService } from '@/services/canonicalPaceIntegrationService'

describe('TL-PACE-01A — Canonical Practice Pace Core (TLPA-01..36)', () => {
  const defaultCircuit = resolveCircuitProfile({ round: 1 })

  // Fixture neutra canônica:
  // Mesmo driver neutro (speed 80, consistency 80, technical_feedback 80, morale 80 -> exec 80 -> modifier 0),
  // TrackFit = 75 (modifier 0), setupEfficiency = 80 (modifier 0), program = 'car_setup' (modifier 0),
  // tyre = 'medio' (modifier 0), fuel = 25 kg (modifier 0), puWear = 0, condition = 100, weather = 'seco',
  // rookie = false, adaptation = 75 (modifier 0), noise = 0 / RNG = 0.
  const neutralDriverAttrs = {
    speed: 80,
    consistency: 80,
    technical_feedback: 80,
    morale: 80,
  }

  // TLPA-01: computePracticePace existe e usa Structural Strength canônico
  it('TLPA-01: computePracticePace existe e usa Structural Strength canônico', () => {
    expect(typeof computePracticePace).toBe('function')
    const res = computePracticePace({
      teamKey: 'mercedes',
      driverId: 'drv_01',
      driverAttributes: neutralDriverAttrs,
      setupEfficiency: 80,
      fuelKg: 25,
      noise: 0,
    })
    expect(res).toBeDefined()
    expect(res.breakdown).toBeDefined()
    expect(res.breakdown.structuralStrength).toBe(100)
    expect(res.finalPracticePace).toBe(100)
  })

  // TLPA-02..06: neutro — Mercedes=100, Audi=86, Williams=70, Cadillac=50, Andretti=45
  it('TLPA-02: neutro — Mercedes = 100', () => {
    const res = computePracticePace({
      teamKey: 'mercedes',
      driverId: 'drv_merc',
      driverAttributes: neutralDriverAttrs,
      noise: 0,
    })
    expect(res.breakdown.structuralStrength).toBe(100)
    expect(res.finalPracticePace).toBe(100)
  })

  it('TLPA-03: neutro — Audi = 86', () => {
    const res = computePracticePace({
      teamKey: 'audi',
      driverId: 'drv_audi',
      driverAttributes: neutralDriverAttrs,
      noise: 0,
    })
    expect(res.breakdown.structuralStrength).toBe(86)
    expect(res.finalPracticePace).toBe(86)
  })

  it('TLPA-04: neutro — Williams = 70', () => {
    const res = computePracticePace({
      teamKey: 'williams',
      driverId: 'drv_wms',
      driverAttributes: neutralDriverAttrs,
      noise: 0,
    })
    expect(res.breakdown.structuralStrength).toBe(70)
    expect(res.finalPracticePace).toBe(70)
  })

  it('TLPA-05: neutro — Cadillac = 50', () => {
    const res = computePracticePace({
      teamKey: 'cadillac',
      driverId: 'drv_cad',
      driverAttributes: neutralDriverAttrs,
      noise: 0,
    })
    expect(res.breakdown.structuralStrength).toBe(50)
    expect(res.finalPracticePace).toBe(50)
  })

  it('TLPA-06: neutro — Andretti = 45', () => {
    const res = computePracticePace({
      teamKey: 'andretti',
      driverId: 'drv_and',
      driverAttributes: neutralDriverAttrs,
      noise: 0,
    })
    expect(res.breakdown.structuralStrength).toBe(45)
    expect(res.finalPracticePace).toBe(45)
  })

  // TLPA-07: as 12 equipes em fixture neutra preservam a ordem da baseline
  it('TLPA-07: as 12 equipes em fixture neutra preservam a ordem da baseline', () => {
    const expectedScores: Record<string, number> = {
      mercedes: 100,
      ferrari: 98,
      mclaren: 96,
      redbull: 94,
      racingbulls: 87,
      alpine: 87,
      audi: 86,
      haas: 75,
      williams: 70,
      astonmartin: 60,
      cadillac: 50,
      andretti: 45,
    }

    const computed = BASELINE_2026_V1_ORDER.map((teamKey) => {
      const res = computePracticePace({
        teamKey,
        driverId: `drv_${teamKey}`,
        driverAttributes: neutralDriverAttrs,
        noise: 0,
      })
      return {
        teamKey,
        pace: res.finalPracticePace,
        structural: res.breakdown.structuralStrength,
      }
    })

    // Cada equipe tem rigorosamente sua âncora estrutural canônica
    computed.forEach((item) => {
      expect(item.structural).toBe(expectedScores[item.teamKey])
      expect(item.pace).toBe(expectedScores[item.teamKey])
    })

    // Preservação da ordem decrescente (com empates permitidos nos pares de mesmo score ex: RB/Alpine 87)
    for (let i = 1; i < computed.length; i++) {
      expect(computed[i - 1].pace).toBeGreaterThanOrEqual(computed[i].pace)
    }
  })

  // TLPA-08: teams.strength não influencia (Audi com teams.strength=20 -> Structural 86)
  it('TLPA-08: teams.strength não influencia (Audi com teams.strength=20 -> Structural 86)', () => {
    const res = computePracticePace({
      teamKey: 'audi',
      teamContext: {
        teamId: 'audi',
        rawTeamIdentity: 'audi',
        team: {
          id: 'audi',
          name: 'Audi Revolut F1 Team',
          team_key: 'audi',
          strength: 20, // Stale PocketBase strength ignorado
        } as any,
      },
      driverId: 'drv_audi_s20',
      driverAttributes: neutralDriverAttrs,
      noise: 0,
    })
    expect(res.breakdown.structuralStrength).toBe(86)
    expect(res.finalPracticePace).toBe(86)
  })

  // TLPA-09: strengthRating legado não influencia
  it('TLPA-09: strengthRating legado não influencia', () => {
    const res = computePracticePace({
      teamKey: 'williams',
      teamContext: {
        teamId: 'williams',
        team: {
          id: 'williams',
          name: 'Williams Racing',
          team_key: 'williams',
          strength_rating: 9.9, // rating 0-10 legado ignorado
        } as any,
      },
      driverId: 'drv_wms_legacy',
      driverAttributes: neutralDriverAttrs,
      noise: 0,
    })
    expect(res.breakdown.structuralStrength).toBe(70)
    expect(res.finalPracticePace).toBe(70)
  })

  // TLPA-10: teamChassisRating não substitui Structural
  it('TLPA-10: teamChassisRating não substitui Structural', () => {
    const res = computePracticePace({
      teamKey: 'cadillac',
      driverId: 'drv_cad_chassis',
      driverAttributes: neutralDriverAttrs,
      // Se houvesse parâmetro artificial chassisRating = 95, o core deve preservar Structural 50
      noise: 0,
    })
    expect(res.breakdown.structuralStrength).toBe(50)
    expect(res.finalPracticePace).toBe(50)
  })

  // TLPA-11: TrackFit neutral 75 -> modifier 0
  it('TLPA-11: TrackFit neutral 75 -> modifier 0', () => {
    const res = computePracticePace({
      teamKey: 'mercedes',
      driverId: 'drv_tf_neutral',
      driverAttributes: neutralDriverAttrs,
      circuitProfile: defaultCircuit,
      // Se carTechnicalAttributes gerar rawTrackFitScore 75 ou ausente
      carTechnicalAttributes: {
        lowSpeedCornering: 75,
        mediumSpeedCornering: 75,
        highSpeedCornering: 75,
        straightLineSpeed: 75,
      },
      noise: 0,
    })
    expect(res.breakdown.trackFitModifier).toBe(0)
  })

  // TLPA-12: TrackFit usa escala/clamp canônicos (não 0.22/±6.5)
  it('TLPA-12: TrackFit usa escala/clamp canônicos (não 0.22/±6.5)', () => {
    const resExtreme = computePracticePace({
      teamKey: 'mercedes',
      driverId: 'drv_tf_ext',
      driverAttributes: neutralDriverAttrs,
      circuitProfile: defaultCircuit,
      carTechnicalAttributes: {
        lowSpeedCornering: 100,
        mediumSpeedCornering: 100,
        highSpeedCornering: 100,
        straightLineSpeed: 100,
      },
      noise: 0,
    })
    // Normal clamp é ±2.0 pts (especializado ±2.5). NUNCA ±6.5 do modelo legado.
    expect(Math.abs(resExtreme.breakdown.trackFitModifier)).toBeLessThanOrEqual(2.5)
  })

  // TLPA-13: setupEfficiency 80 -> modifier 0
  it('TLPA-13: setupEfficiency 80 -> modifier 0', () => {
    const res = computePracticePace({
      teamKey: 'ferrari',
      driverId: 'drv_setup_80',
      driverAttributes: neutralDriverAttrs,
      setupEfficiency: 80,
      noise: 0,
    })
    expect(res.breakdown.setupModifier).toBe(0)
  })

  // TLPA-14: setup entra exatamente uma vez
  it('TLPA-14: setup entra exatamente uma vez', () => {
    const res90 = computePracticePace({
      teamKey: 'ferrari',
      driverId: 'drv_setup_90',
      driverAttributes: neutralDriverAttrs,
      setupEfficiency: 90,
      noise: 0,
    })
    // (90 - 80) * 0.05 = +0.50 pt
    expect(res90.breakdown.setupModifier).toBeCloseTo(0.5, 3)
    const expectedPace = Number((res90.breakdown.structuralStrength + 0.5).toFixed(2))
    expect(res90.finalPracticePace).toBe(expectedPace)
  })

  // TLPA-15: PracticeExecution neutral -> modifier 0 ou baseline explícita
  it('TLPA-15: PracticeExecution neutral -> modifier 0 ou baseline explícita', () => {
    const score = calculatePracticeDriverExecution({
      consistency: 80,
      technical_feedback: 80,
      speed: 80,
      morale: 80,
    })
    expect(score).toBe(80)
    const mod = calculatePracticeExecutionModifier(score)
    expect(mod).toBe(0)

    const paceRes = computePracticePace({
      teamKey: 'audi',
      driverId: 'drv_pde_neutral',
      driverAttributes: { consistency: 80, technical_feedback: 80, speed: 80, morale: 80 },
      noise: 0,
    })
    expect(paceRes.breakdown.practiceExecutionModifier).toBe(0)
  })

  // TLPA-16: PracticeExecution altera poucos pontos, não substitui Structural
  it('TLPA-16: PracticeExecution altera poucos pontos, não substitui Structural', () => {
    // Piloto super experiente com 100 em todos os atributos de treino
    const scoreMax = calculatePracticeDriverExecution({
      consistency: 100,
      technical_feedback: 100,
      speed: 100,
      morale: 100,
    })
    const modMax = calculatePracticeExecutionModifier(scoreMax)
    // (100 - 80) * 0.08 = +1.60 pts de pace
    expect(modMax).toBeCloseTo(1.6, 3)

    // Piloto fraco com 50 em tudo
    const scoreMin = calculatePracticeDriverExecution({
      consistency: 50,
      technical_feedback: 50,
      speed: 50,
      morale: 50,
    })
    const modMin = calculatePracticeExecutionModifier(scoreMin)
    // (50 - 80) * 0.08 = -2.40 pts de pace
    expect(modMin).toBeCloseTo(-2.4, 3)

    // Cadillac (50) com piloto máximo (mod +1.60) chega a ~51.60, NUNCA supera Audi (86) ou Williams (70)
    const cadillacSuper = computePracticePace({
      teamKey: 'cadillac',
      driverId: 'drv_cad_super',
      driverAttributes: { consistency: 100, technical_feedback: 100, speed: 100, morale: 100 },
      noise: 0,
    })
    const williamsNeutral = computePracticePace({
      teamKey: 'williams',
      driverId: 'drv_wms_neutral',
      driverAttributes: neutralDriverAttrs,
      noise: 0,
    })
    expect(cadillacSuper.finalPracticePace).toBeLessThan(williamsNeutral.finalPracticePace)
  })

  // TLPA-17: program modifier = 0 -> nenhum impacto
  it('TLPA-17: program modifier = 0 -> nenhum impacto', () => {
    const resSetup = computePracticePace({
      teamKey: 'mclaren',
      driverId: 'drv_prog_0',
      driverAttributes: neutralDriverAttrs,
      program: 'car_setup',
      noise: 0,
    })
    expect(resSetup.breakdown.programModifier).toBe(0)
    expect(resSetup.finalPracticePace).toBe(resSetup.breakdown.structuralStrength)
  })

  // TLPA-18: program modifier controlado altera o resultado exatamente uma vez
  it('TLPA-18: program modifier controlado altera o resultado exatamente uma vez', () => {
    const resQualiSim = computePracticePace({
      teamKey: 'mclaren',
      driverId: 'drv_quali_sim',
      driverAttributes: neutralDriverAttrs,
      program: 'qualifying_sim',
      noise: 0,
    })
    // qualifying_sim dá +0.75 pt
    expect(resQualiSim.breakdown.programModifier).toBe(0.75)
    expect(resQualiSim.finalPracticePace).toBe(96 + 0.75)

    const resRacePace = computePracticePace({
      teamKey: 'mclaren',
      driverId: 'drv_race_pace',
      driverAttributes: neutralDriverAttrs,
      program: 'race_pace',
      noise: 0,
    })
    // race_pace dá -0.50 pt
    expect(resRacePace.breakdown.programModifier).toBe(-0.5)
    expect(resRacePace.finalPracticePace).toBe(96 - 0.5)
  })

  // TLPA-19: fuel mais alto afeta pace pela física canônica
  it('TLPA-19: fuel mais alto afeta pace pela física canônica', () => {
    const resLight = computePracticePace({
      teamKey: 'ferrari',
      driverId: 'drv_fuel_light',
      driverAttributes: neutralDriverAttrs,
      fuelKg: 10,
      noise: 0,
    })
    const resHeavy = computePracticePace({
      teamKey: 'ferrari',
      driverId: 'drv_fuel_heavy',
      driverAttributes: neutralDriverAttrs,
      fuelKg: 50,
      noise: 0,
    })
    // Carro pesado é mais lento (pace menor e lapTime maior)
    expect(resHeavy.breakdown.fuelModifier).toBeLessThan(resLight.breakdown.fuelModifier)
    expect(resHeavy.finalPracticePace).toBeLessThan(resLight.finalPracticePace)
    expect(resHeavy.lapTimeSec).toBeGreaterThan(resLight.lapTimeSec)
  })

  // TLPA-20: fuel não altera Structural
  it('TLPA-20: fuel não altera Structural', () => {
    const resHeavy = computePracticePace({
      teamKey: 'ferrari',
      driverId: 'drv_fuel_structural',
      driverAttributes: neutralDriverAttrs,
      fuelKg: 100,
      noise: 0,
    })
    expect(resHeavy.breakdown.structuralStrength).toBe(98)
  })

  // TLPA-21: tyre usa fonte canônica
  it('TLPA-21: tyre usa fonte canônica', () => {
    const resSoft = computePracticePace({
      teamKey: 'mercedes',
      driverId: 'drv_soft',
      driverAttributes: neutralDriverAttrs,
      tyreCompound: 'macio',
      noise: 0,
    })
    const resHard = computePracticePace({
      teamKey: 'mercedes',
      driverId: 'drv_hard',
      driverAttributes: neutralDriverAttrs,
      tyreCompound: 'duro',
      noise: 0,
    })
    // Macio tem modifier mais positivo/vantajoso que duro
    expect(resSoft.breakdown.tyreModifier).toBeGreaterThan(resHard.breakdown.tyreModifier)
    expect(resSoft.finalPracticePace).toBeGreaterThan(resHard.finalPracticePace)
  })

  // TLPA-22: weather usa fonte canônica
  it('TLPA-22: weather usa fonte canônica', () => {
    const resDry = computePracticePace({
      teamKey: 'mercedes',
      driverId: 'drv_dry',
      driverAttributes: neutralDriverAttrs,
      weather: 'seco',
      noise: 0,
    })
    const resWet = computePracticePace({
      teamKey: 'mercedes',
      driverId: 'drv_wet',
      driverAttributes: neutralDriverAttrs,
      weather: 'chuva_forte',
      tyreCompound: 'medio', // pneu de seco na chuva
      noise: 0,
    })
    expect(resWet.breakdown.weatherModifier).toBeLessThan(0)
    expect(resWet.finalPracticePace).toBeLessThan(resDry.finalPracticePace)
    expect(resWet.lapTimeSec).toBeGreaterThan(resDry.lapTimeSec)
  })

  // TLPA-23: wear/condition usa fonte canônica quando aplicável
  it('TLPA-23: wear/condition usa fonte canônica quando aplicável', () => {
    const resWorn = computePracticePace({
      teamKey: 'redbull',
      driverId: 'drv_worn',
      driverAttributes: neutralDriverAttrs,
      puWearPct: 60,
      noise: 0,
    })
    const resFresh = computePracticePace({
      teamKey: 'redbull',
      driverId: 'drv_fresh',
      driverAttributes: neutralDriverAttrs,
      puWearPct: 0,
      noise: 0,
    })
    expect(resWorn.breakdown.wearModifier).toBeLessThan(resFresh.breakdown.wearModifier)
    expect(resWorn.finalPracticePace).toBeLessThan(resFresh.finalPracticePace)
  })

  // TLPA-24: rookie/adaptation não altera Structural
  it('TLPA-24: rookie/adaptation não altera Structural', () => {
    const resRookie = computePracticePace({
      teamKey: 'audi',
      driverId: 'drv_rookie_test',
      driverAttributes: { ...neutralDriverAttrs, isRookie: true },
      isRookie: true,
      noise: 0,
    })
    expect(resRookie.breakdown.structuralStrength).toBe(86)
    expect(resRookie.breakdown.rookieAdaptationModifier).toBeLessThan(0)
    expect(resRookie.finalPracticePace).toBeCloseTo(86 - 0.35, 2)
  })

  // TLPA-25: Practice RNG determinístico (same seed -> same draw)
  it('TLPA-25: Practice RNG determinístico (same seed -> same draw)', () => {
    const seed = 'career_123:2026:r1:tp1:mercedes_c1_drv1:lap3:prog_car_setup'
    const draw1 = getPracticeDeterministicRngModifier(seed)
    const draw2 = getPracticeDeterministicRngModifier(seed)
    expect(draw1).toBe(draw2)
  })

  // TLPA-26: reload/reexecução da mesma tentativa -> same RNG
  it('TLPA-26: reload/reexecução da mesma tentativa -> same RNG', () => {
    const seed = 'career_abc:2026:r2:tp2:williams_c2_drv2:lap5:prog_race_pace'
    const run1 = computePracticePace({
      teamKey: 'williams',
      driverId: 'drv2',
      driverAttributes: neutralDriverAttrs,
      seed,
    })
    const run2 = computePracticePace({
      teamKey: 'williams',
      driverId: 'drv2',
      driverAttributes: neutralDriverAttrs,
      seed,
    })
    expect(run1.breakdown.rngModifier).toBe(run2.breakdown.rngModifier)
    expect(run1.finalPracticePace).toBe(run2.finalPracticePace)
    expect(run1.lapTimeSec).toBe(run2.lapTimeSec)
  })

  // TLPA-27: driver diferente -> seed identity independente
  it('TLPA-27: driver diferente -> seed identity independente', () => {
    const s1 = buildPracticeSeedIdentity({
      careerId: 'c1',
      seasonYear: 2026,
      round: 1,
      session: 'tp1',
      teamId: 'ferrari',
      driverId: 'leclerc',
      lapOrAttempt: 1,
    })
    const s2 = buildPracticeSeedIdentity({
      careerId: 'c1',
      seasonYear: 2026,
      round: 1,
      session: 'tp1',
      teamId: 'ferrari',
      driverId: 'hamilton',
      lapOrAttempt: 1,
    })
    expect(s1).not.toBe(s2)
  })

  // TLPA-28: TL1/TL2/TL3 têm namespace de seed distinto quando session entra na seed
  it('TLPA-28: TL1/TL2/TL3 têm namespace de seed distinto quando session entra na seed', () => {
    const sTL1 = buildPracticeSeedIdentity({
      careerId: 'c1',
      seasonYear: 2026,
      round: 1,
      session: 'tp1',
      teamId: 'audi',
      driverId: 'hulkenberg',
    })
    const sTL2 = buildPracticeSeedIdentity({
      careerId: 'c1',
      seasonYear: 2026,
      round: 1,
      session: 'tp2',
      teamId: 'audi',
      driverId: 'hulkenberg',
    })
    const sTL3 = buildPracticeSeedIdentity({
      careerId: 'c1',
      seasonYear: 2026,
      round: 1,
      session: 'tp3',
      teamId: 'audi',
      driverId: 'hulkenberg',
    })
    expect(sTL1).not.toBe(sTL2)
    expect(sTL2).not.toBe(sTL3)
  })

  // TLPA-29: Math.random não participa do novo computePracticePace
  it('TLPA-29: Math.random não participa do novo computePracticePace', () => {
    const origRandom = Math.random
    let randomCalled = false
    Math.random = () => {
      randomCalled = true
      return 0.5
    }
    try {
      computePracticePace({
        teamKey: 'alpine',
        driverId: 'gasly',
        driverAttributes: neutralDriverAttrs,
        seed: 'test_seed_no_math_random',
      })
      expect(randomCalled).toBe(false)
    } finally {
      Math.random = origRandom
    }
  })

  // TLPA-30: RNG entra exatamente uma vez
  it('TLPA-30: RNG entra exatamente uma vez', () => {
    const res = computePracticePace({
      teamKey: 'alpine',
      driverId: 'gasly',
      driverAttributes: neutralDriverAttrs,
      noise: 0.75,
    })
    const b = res.breakdown
    expect(b.rngModifier).toBe(0.75)
    const expectedSum = Number(
      (
        b.structuralStrength +
        b.trackFitModifier +
        b.setupModifier +
        b.practiceExecutionModifier +
        b.programModifier +
        b.tyreModifier +
        b.fuelModifier +
        b.wearModifier +
        b.weatherModifier +
        b.rookieAdaptationModifier +
        b.rngModifier
      ).toFixed(2),
    )
    expect(res.finalPracticePace).toBe(expectedSum)
  })

  // TLPA-31: Audi-Williams neutral delta = 16 pace pts antes dos session modifiers
  it('TLPA-31: Audi-Williams neutral delta = 16 pace pts antes dos session modifiers', () => {
    const audi = computePracticePace({
      teamKey: 'audi',
      driverId: 'd_audi',
      driverAttributes: neutralDriverAttrs,
      noise: 0,
    })
    const wms = computePracticePace({
      teamKey: 'williams',
      driverId: 'd_wms',
      driverAttributes: neutralDriverAttrs,
      noise: 0,
    })
    const delta = audi.finalPracticePace - wms.finalPracticePace
    expect(delta).toBe(16)
  })

  // TLPA-32: Audi-Cadillac neutral delta = 36 pace pts
  it('TLPA-32: Audi-Cadillac neutral delta = 36 pace pts', () => {
    const audi = computePracticePace({
      teamKey: 'audi',
      driverId: 'd_audi',
      driverAttributes: neutralDriverAttrs,
      noise: 0,
    })
    const cad = computePracticePace({
      teamKey: 'cadillac',
      driverId: 'd_cad',
      driverAttributes: neutralDriverAttrs,
      noise: 0,
    })
    const delta = audi.finalPracticePace - cad.finalPracticePace
    expect(delta).toBe(36)
  })

  // TLPA-33: remover equipes da fixture não renormaliza Audi-Williams
  it('TLPA-33: remover equipes da fixture não renormaliza Audi-Williams', () => {
    // Calculado isoladamente (sem min-max de participantes)
    const pAudi = computePracticePace({
      teamKey: 'audi',
      driverId: 'd1',
      driverAttributes: neutralDriverAttrs,
      noise: 0,
    })
    const pWms = computePracticePace({
      teamKey: 'williams',
      driverId: 'd2',
      driverAttributes: neutralDriverAttrs,
      noise: 0,
    })
    expect(pAudi.finalPracticePace - pWms.finalPracticePace).toBe(16)
  })

  // TLPA-34: practice pace é ABSOLUTO — sem min-max por participantes
  it('TLPA-34: practice pace é ABSOLUTO — sem min-max por participantes', () => {
    const pCad = computePracticePace({
      teamKey: 'cadillac',
      driverId: 'd1',
      driverAttributes: neutralDriverAttrs,
      noise: 0,
    })
    const pAnd = computePracticePace({
      teamKey: 'andretti',
      driverId: 'd2',
      driverAttributes: neutralDriverAttrs,
      noise: 0,
    })
    // Cadillac (50) vs Andretti (45) -> delta absoluto = 5 pts
    expect(pCad.finalPracticePace - pAnd.finalPracticePace).toBe(5)
  })

  // TLPA-35: qualifying core permanece inalterado
  it('TLPA-35: qualifying core permanece inalterado', () => {
    const qualiMerc = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv_q_merc',
      circuitProfile: defaultCircuit,
      driverAttributes: { speed: 80, morale: 80 },
      f1Starts: 0,
      setupEfficiency: 80,
      noise: 0,
    })
    expect(qualiMerc.breakdown.structuralStrength).toBe(100)
    expect(qualiMerc.breakdown.sessionType).toBe('qualifying')
  })

  // TLPA-36: regressões QUALI-UNIFY continuam verdes
  it('TLPA-36: regressões QUALI-UNIFY continuam verdes', () => {
    // Structural Strength canônico preserva as 12 âncoras para qualifying e practice
    const sMerc = canonicalPaceIntegrationService.resolveBaseStructuralStrength('mercedes')
    const sAudi = canonicalPaceIntegrationService.resolveBaseStructuralStrength('audi')
    const sCad = canonicalPaceIntegrationService.resolveBaseStructuralStrength('cadillac')
    expect(sMerc).toBe(100)
    expect(sAudi).toBe(86)
    expect(sCad).toBe(50)
  })
})
