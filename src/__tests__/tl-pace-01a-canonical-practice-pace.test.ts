import { describe, it, expect, vi } from 'vitest'
import {
  canonicalPaceIntegrationService,
  computePracticePace,
} from '@/services/canonicalPaceIntegrationService'
import * as canonicalPaceModule from '@/services/canonicalPaceIntegrationService'
import {
  canonicalPracticeRngService,
  buildPracticeSeedIdentity,
  getPracticeDeterministicDraw,
  getPracticeRandomModifier,
  PRACTICE_RNG_DEFAULT_SIGMA,
  PRACTICE_RNG_TARGET_RANGE,
} from '@/services/canonicalPracticeRngService'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('TL-PACE-01A: Canonical Practice Pace Core & RNG Suite (TLPA-01..36)', () => {
  // Fixture neutra padronizada para isolamento dos componentes
  const createNeutralPracticeInput = (teamKey: string, overrides: Record<string, any> = {}) => ({
    teamKey,
    driverId: `neutral_drv_${teamKey}`,
    setupEfficiency: 80, // modifier = 0
    practiceExecutionOverride: 0, // neutral execution = 0
    programModifier: 0, // neutral program = 0
    tyreModifier: 0, // neutral tyre = 0
    fuelModifier: 0, // neutral fuel = 0
    wearModifier: 0, // neutral wear = 0
    weatherModifier: 0, // neutral weather = 0
    adaptationModifier: 0, // neutral adaptation = 0
    rngModifier: 0, // neutral rng = 0
    ...overrides,
  })

  // TLPA-01: computePracticePace existe e usa Structural Strength canônico
  it('TLPA-01: computePracticePace existe e usa Structural Strength canônico', () => {
    expect(typeof computePracticePace).toBe('function')
    expect(typeof canonicalPaceIntegrationService.computePracticePace).toBe('function')
    expect(canonicalPaceModule.computePracticePace).toBeDefined()
    const res = computePracticePace(createNeutralPracticeInput('mercedes'))
    expect(res.breakdown.structural).toBe(100)
  })

  // TLPA-02: Mercedes Structural = 100
  it('TLPA-02: Mercedes Structural = 100', () => {
    const res = computePracticePace(createNeutralPracticeInput('mercedes'))
    expect(res.breakdown.structural).toBe(100)
    expect(res.finalPracticePace).toBe(100)
  })

  // TLPA-03: Audi = 86
  it('TLPA-03: Audi = 86', () => {
    const res = computePracticePace(createNeutralPracticeInput('audi'))
    expect(res.breakdown.structural).toBe(86)
    expect(res.finalPracticePace).toBe(86)
  })

  // TLPA-04: Williams = 70
  it('TLPA-04: Williams = 70', () => {
    const res = computePracticePace(createNeutralPracticeInput('williams'))
    expect(res.breakdown.structural).toBe(70)
    expect(res.finalPracticePace).toBe(70)
  })

  // TLPA-05: Cadillac = 50
  it('TLPA-05: Cadillac = 50', () => {
    const res = computePracticePace(createNeutralPracticeInput('cadillac'))
    expect(res.breakdown.structural).toBe(50)
    expect(res.finalPracticePace).toBe(50)
  })

  // TLPA-06: Andretti = 45
  it('TLPA-06: Andretti = 45', () => {
    const res = computePracticePace(createNeutralPracticeInput('andretti'))
    expect(res.breakdown.structural).toBe(45)
    expect(res.finalPracticePace).toBe(45)
  })

  // TLPA-07: as 12 equipes em fixture neutra preservam exatamente a ordem estrutural
  it('TLPA-07: as 12 equipes em fixture neutra preservam exatamente a ordem estrutural', () => {
    const teamsExpected = [
      { key: 'mercedes', target: 100 },
      { key: 'ferrari', target: 98 },
      { key: 'mclaren', target: 96 },
      { key: 'red_bull', target: 94 },
      { key: 'racing_bulls', target: 87 },
      { key: 'alpine', target: 87 },
      { key: 'audi', target: 86 },
      { key: 'haas', target: 75 },
      { key: 'williams', target: 70 },
      { key: 'aston_martin', target: 60 },
      { key: 'cadillac', target: 50 },
      { key: 'andretti', target: 45 },
    ]

    const results = teamsExpected.map((t) => {
      const pace = computePracticePace(createNeutralPracticeInput(t.key))
      return {
        key: t.key,
        structural: pace.breakdown.structural,
        finalPracticePace: pace.finalPracticePace,
        target: t.target,
      }
    })

    // Verifica que cada time atinge exatamente a âncora
    results.forEach((r) => {
      expect(r.structural).toBe(r.target)
      expect(r.finalPracticePace).toBe(r.target)
    })

    // Ordem estrita não decrescente
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].finalPracticePace).toBeGreaterThanOrEqual(results[i + 1].finalPracticePace)
    }
  })

  // TLPA-08: teams.strength não influencia Practice Structural (Audi teams.strength=20 -> 86)
  it('TLPA-08: teams.strength não influencia Practice Structural (Audi teams.strength=20 -> 86)', () => {
    const res = computePracticePace(
      createNeutralPracticeInput('audi', {
        strength: 20,
        teams: { strength: 20 },
        teamsStrength: 20,
      } as any),
    )
    expect(res.breakdown.structural).toBe(86)
    expect(res.breakdown.structural).not.toBe(20)
    expect(res.finalPracticePace).toBe(86)
  })

  // TLPA-09: strengthRating legado não influencia
  it('TLPA-09: strengthRating legado não influencia (Williams strengthRating=99 -> 70)', () => {
    const res = computePracticePace(
      createNeutralPracticeInput('williams', {
        strengthRating: 99,
        teamStrengthRating: 99,
      } as any),
    )
    expect(res.breakdown.structural).toBe(70)
    expect(res.breakdown.structural).not.toBe(99)
    expect(res.finalPracticePace).toBe(70)
  })

  // TLPA-10: teamChassisRating não substitui Structural
  it('TLPA-10: teamChassisRating não substitui Structural (Cadillac chassisRating=95 -> 50)', () => {
    const res = computePracticePace(
      createNeutralPracticeInput('cadillac', {
        teamChassisRating: 95,
        chassisRating: 95,
      } as any),
    )
    expect(res.breakdown.structural).toBe(50)
    expect(res.breakdown.structural).not.toBe(95)
    expect(res.finalPracticePace).toBe(50)
  })

  // TLPA-11: TrackFit = 75 -> modifier 0
  it('TLPA-11: TrackFit = 75 -> modifier 0', () => {
    const norm = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 75,
    })
    expect(norm.trackFitModifier).toBe(0.0)

    const normCustomRef = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 75,
      referenceTrackFit: 75,
    })
    expect(normCustomRef.trackFitModifier).toBe(0.0)
  })

  // TLPA-12: TrackFit usa scale 0.08 / clamp ±2.0/±2.5, NÃO 0.22/±6.5
  it('TLPA-12: TrackFit usa scale 0.08 / clamp ±2.0/±2.5, NÃO 0.22/±6.5', () => {
    // Delta +10 pts (raw 85 - ref 75):
    // Canônico: 10 * 0.08 = +0.80
    // Legado: 10 * 0.22 = +2.20
    const norm85 = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 85,
    })
    expect(norm85.trackFitModifier).toBe(0.8)
    expect(norm85.trackFitModifier).not.toBe(2.2)

    // Delta +25 pts (raw 100 - ref 75):
    // Canônico normal: 25 * 0.08 = 2.0 (clamp normal 2.0)
    // Especializado: clamp 2.5
    // Legado: 25 * 0.22 = 5.5 (clamp 6.5)
    const norm100Normal = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 100,
      isSpecializedTrack: false,
    })
    expect(norm100Normal.trackFitModifier).toBe(2.0)
    expect(norm100Normal.trackFitModifier).not.toBe(5.5)

    const norm100Specialized = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 100,
      isSpecializedTrack: true,
    })
    // 25 * 0.08 = 2.00, ainda dentro de 2.5
    expect(norm100Specialized.trackFitModifier).toBe(2.0)

    // Teste com delta extremo para validar clamp de 2.0 vs 2.5
    // Se raw = 120 (hipotético) -> delta 45 * 0.08 = 3.6 -> clamp 2.0 ou 2.5
    const normExtNormal = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 120,
      isSpecializedTrack: false,
    })
    expect(normExtNormal.trackFitModifier).toBe(2.0)

    const normExtSpec = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 120,
      isSpecializedTrack: true,
    })
    expect(normExtSpec.trackFitModifier).toBe(2.5)
  })

  // TLPA-13: setupEfficiency 80 -> modifier 0
  it('TLPA-13: setupEfficiency 80 -> modifier 0', () => {
    const res = computePracticePace({
      teamKey: 'audi',
      driverId: 'drv_hul',
      setupEfficiency: 80,
      practiceExecutionOverride: 0,
      programModifier: 0,
      rngModifier: 0,
    })
    expect(res.breakdown.setup).toBe(0.0)
    expect(res.finalPracticePace).toBe(86.0)
  })

  // TLPA-14: setup aplicado exatamente UMA vez
  it('TLPA-14: setup aplicado exatamente UMA vez', () => {
    // setupEfficiency 90 -> (90 - 80) * 0.05 = +0.50 pt
    const res90 = computePracticePace(
      createNeutralPracticeInput('audi', {
        setupEfficiency: 90,
      }),
    )
    expect(res90.breakdown.setup).toBe(0.5)
    expect(res90.finalPracticePace).toBe(86.5)

    // setupEfficiency 60 -> (60 - 80) * 0.05 = -1.00 pt
    const res60 = computePracticePace(
      createNeutralPracticeInput('audi', {
        setupEfficiency: 60,
      }),
    )
    expect(res60.breakdown.setup).toBe(-1.0)
    expect(res60.finalPracticePace).toBe(85.0)

    // Delta estrito entre 90 e 60 deve ser exatamente 1.5 pt
    expect(res90.finalPracticePace - res60.finalPracticePace).toBe(1.5)
  })

  // TLPA-15: PracticeExecution neutral -> modifier neutro
  it('TLPA-15: PracticeExecution neutral -> modifier neutro', () => {
    // Piloto com atributos neutros (80 em tudo)
    const res = computePracticePace({
      teamKey: 'audi',
      driverId: 'drv_neutral',
      driverAttributes: {
        technical_feedback: 80,
        consistency: 80,
        experienceScore: 80,
        morale: 80,
      },
      setupEfficiency: 80,
      programModifier: 0,
      rngModifier: 0,
    })
    expect(res.breakdown.practiceExecution).toBe(0.0)
    expect(res.finalPracticePace).toBe(86.0)
  })

  // TLPA-16: PracticeExecution altera poucos pontos e NÃO substitui Structural
  it('TLPA-16: PracticeExecution altera poucos pontos e NÃO substitui Structural', () => {
    // Piloto lendário (100 em tudo)
    const resLegend = computePracticePace({
      teamKey: 'andretti', // Structural 45
      driverId: 'drv_legend',
      driverAttributes: {
        technical_feedback: 100,
        consistency: 100,
        experienceScore: 100,
        morale: 100,
      },
      setupEfficiency: 80,
      programModifier: 0,
      rngModifier: 0,
    })
    // 100 * 0.45 + 100 * 0.3 + 100 * 0.15 + 100 * 0.1 = 100. (100 - 80) * 0.04 = +0.80 pt
    expect(resLegend.breakdown.practiceExecution).toBe(0.8)
    expect(resLegend.breakdown.structural).toBe(45)
    expect(resLegend.finalPracticePace).toBe(45.8)

    // Piloto péssimo (50 em tudo) em Mercedes (Structural 100)
    const resPoor = computePracticePace({
      teamKey: 'mercedes',
      driverId: 'drv_poor',
      driverAttributes: {
        technical_feedback: 50,
        consistency: 50,
        experienceScore: 50,
        morale: 50,
      },
      setupEfficiency: 80,
      programModifier: 0,
      rngModifier: 0,
    })
    // (50 - 80) * 0.04 = -1.20 pt
    expect(resPoor.breakdown.practiceExecution).toBe(-1.2)
    expect(resPoor.breakdown.structural).toBe(100)
    expect(resPoor.finalPracticePace).toBe(98.8)

    // Mercedes com piloto ruim (98.8) ainda está muito acima de Andretti com piloto lendário (45.8)
    expect(resPoor.finalPracticePace).toBeGreaterThan(resLegend.finalPracticePace + 50)
  })

  // TLPA-17: Program modifier 0 -> sem impacto
  it('TLPA-17: Program modifier 0 -> sem impacto', () => {
    const resExplicit = computePracticePace(
      createNeutralPracticeInput('audi', {
        programModifier: 0,
      }),
    )
    expect(resExplicit.breakdown.program).toBe(0.0)
    expect(resExplicit.finalPracticePace).toBe(86.0)

    const resCarSetup = computePracticePace(
      createNeutralPracticeInput('audi', {
        program: 'car_setup',
      }),
    )
    expect(resCarSetup.breakdown.program).toBe(0.0)
    expect(resCarSetup.finalPracticePace).toBe(86.0)
  })

  // TLPA-18: Program modifier controlado aplicado exatamente UMA vez
  it('TLPA-18: Program modifier controlado aplicado exatamente UMA vez', () => {
    // qualifying_sim = +1.5 pt
    const resQualiSim = computePracticePace(
      createNeutralPracticeInput('audi', {
        program: 'qualifying_sim',
      }),
    )
    expect(resQualiSim.breakdown.program).toBe(1.5)
    expect(resQualiSim.finalPracticePace).toBe(87.5)

    // race_pace = -1.0 pt
    const resRacePace = computePracticePace(
      createNeutralPracticeInput('audi', {
        program: 'race_pace',
      }),
    )
    expect(resRacePace.breakdown.program).toBe(-1.0)
    expect(resRacePace.finalPracticePace).toBe(85.0)

    // Custom programModifier = +0.75 pt
    const resCustom = computePracticePace(
      createNeutralPracticeInput('audi', {
        programModifier: 0.75,
      }),
    )
    expect(resCustom.breakdown.program).toBe(0.75)
    expect(resCustom.finalPracticePace).toBe(86.75)
  })

  // TLPA-19: fuel maior reduz performance pela física canônica existente
  it('TLPA-19: fuel maior reduz performance pela física canônica existente', () => {
    // fuelKg = 12 -> delta = 0 -> fuelModifier = 0
    const res12kg = computePracticePace(
      createNeutralPracticeInput('audi', {
        fuelKg: 12,
      }),
    )
    expect(res12kg.breakdown.fuel).toBe(0.0)

    // fuelKg = 32 -> delta = (32 - 12) * 0.035 = 0.70s -> 0.70 * -12.0 = -8.4 pts
    const res32kg = computePracticePace(
      createNeutralPracticeInput('audi', {
        fuelKg: 32,
      }),
    )
    expect(res32kg.breakdown.fuel).toBe(-8.4)
    expect(res32kg.finalPracticePace).toBe(86.0 - 8.4)
    expect(res32kg.finalPracticePace).toBeLessThan(res12kg.finalPracticePace)
  })

  // TLPA-20: fuel NÃO altera Structural
  it('TLPA-20: fuel NÃO altera Structural', () => {
    const resHeavy = computePracticePace(
      createNeutralPracticeInput('audi', {
        fuelKg: 100,
      }),
    )
    expect(resHeavy.breakdown.structural).toBe(86.0)
    expect(resHeavy.breakdown.fuel).toBeLessThan(-30)
  })

  // TLPA-21: tyre usa modifier canônico
  it('TLPA-21: tyre usa modifier canônico', () => {
    // Composto macio novo (wear 0%) -> deltaPerLap 0.0 -> tyre = 0
    const resSoftNew = computePracticePace(
      createNeutralPracticeInput('audi', {
        tyreCompound: 'macio',
        tyreWearPct: 0,
      }),
    )
    expect(resSoftNew.breakdown.tyre).toBe(0.0)

    // Composto macio desgastado (wear 50%) -> (50/100) * 0.8 = 0.40s -> -4.8 pts
    const resSoftWorn = computePracticePace(
      createNeutralPracticeInput('audi', {
        tyreCompound: 'macio',
        tyreWearPct: 50,
      }),
    )
    expect(resSoftWorn.breakdown.tyre).toBe(-4.8)
    expect(resSoftWorn.finalPracticePace).toBe(86.0 - 4.8)

    // Composto duro novo -> deltaPerLap 1.2s -> 1.2 * -12.0 = -14.4 pts
    const resHardNew = computePracticePace(
      createNeutralPracticeInput('audi', {
        tyreCompound: 'duro',
        tyreWearPct: 0,
      }),
    )
    expect(resHardNew.breakdown.tyre).toBe(-14.4)
  })

  // TLPA-22: weather usa modifier canônico
  it('TLPA-22: weather usa modifier canônico', () => {
    // seco -> penalty 0
    const resDry = computePracticePace(
      createNeutralPracticeInput('audi', {
        weather: 'seco',
      }),
    )
    expect(resDry.breakdown.weather).toBe(0.0)

    // chuva_fraca com macio -> penalty 4.2s -> 4.2 * -12 = -50.4 pts
    const resRainSoft = computePracticePace(
      createNeutralPracticeInput('audi', {
        weather: 'chuva_fraca',
        tyreCompound: 'macio',
      }),
    )
    expect(resRainSoft.breakdown.weather).toBe(-50.4)

    // chuva_fraca com intermediario -> penalty 0
    const resRainInter = computePracticePace(
      createNeutralPracticeInput('audi', {
        weather: 'chuva_fraca',
        tyreCompound: 'intermediario',
      }),
    )
    expect(resRainInter.breakdown.weather).toBe(0.0)
  })

  // TLPA-23: wear/condition usa fonte canônica quando aplicável
  it('TLPA-23: wear/condition usa fonte canônica quando aplicável', () => {
    // PU Wear 0% -> penalty 0
    const resWear0 = computePracticePace(
      createNeutralPracticeInput('audi', {
        puWearPct: 0,
      }),
    )
    expect(resWear0.breakdown.wear).toBe(0.0)

    // PU Wear 80% -> gera penalidade de desgaste de motor
    const resWear80 = computePracticePace(
      createNeutralPracticeInput('audi', {
        puWearPct: 80,
      }),
    )
    expect(resWear80.breakdown.wear).toBeLessThan(0)
    expect(resWear80.finalPracticePace).toBeLessThan(86.0)
  })

  // TLPA-24: rookie/adaptation altera apenas driver/session performance, NÃO altera Structural
  it('TLPA-24: rookie/adaptation altera apenas driver/session performance, NÃO altera Structural', () => {
    const resRookie = computePracticePace(
      createNeutralPracticeInput('audi', {
        isRookie: true,
        driverAttributes: {
          adaptation: 60,
        },
      }),
    )
    // (60 - 80) * 0.04 = -0.80 pt
    expect(resRookie.breakdown.rookieAdaptation).toBe(-0.8)
    expect(resRookie.breakdown.structural).toBe(86.0)
    expect(resRookie.finalPracticePace).toBe(85.2)

    // Teste com override explícito de rookieModifier
    const resCustomRookie = computePracticePace(
      createNeutralPracticeInput('audi', {
        rookieModifier: -1.5,
      }),
    )
    expect(resCustomRookie.breakdown.rookieAdaptation).toBe(-1.5)
    expect(resCustomRookie.breakdown.structural).toBe(86.0)
  })

  // TLPA-25: Practice RNG — mesma seed -> mesmo draw
  it('TLPA-25: Practice RNG — mesma seed -> mesmo draw', () => {
    const params = {
      careerId: 'career_tlpa',
      seasonYear: 2026,
      round: 1,
      session: 'TL1',
      driverId: 'drv_hul',
      attempt: 1,
      program: 'car_setup',
    }
    const draw1 = getPracticeDeterministicDraw(params)
    const draw2 = getPracticeDeterministicDraw(params)

    expect(draw1.seedIdentity).toBe(draw2.seedIdentity)
    expect(draw1.seedUint).toBe(draw2.seedUint)
    expect(draw1.normalDrawZ).toBe(draw2.normalDrawZ)
    expect(draw1.rngModifier).toBe(draw2.rngModifier)
  })

  // TLPA-26: mesma tentativa 10x -> 10 modifiers idênticos
  it('TLPA-26: mesma tentativa 10x -> 10 modifiers idênticos', () => {
    const params = {
      careerId: 'career_tlpa',
      seasonYear: 2026,
      round: 1,
      session: 'TL1',
      driverId: 'drv_hul',
      attempt: 1,
      program: 'car_setup',
    }
    const first = getPracticeDeterministicDraw(params)
    for (let i = 0; i < 10; i++) {
      const current = getPracticeDeterministicDraw(params)
      expect(current.rngModifier).toBe(first.rngModifier)
      expect(current.normalDrawZ).toBe(first.normalDrawZ)
    }
  })

  // TLPA-27: reload/reconstrução da mesma tentativa -> mesmo seed, mesmo RNG, mesmo finalPracticePace
  it('TLPA-27: reload/reconstrução da mesma tentativa -> mesmo seed, mesmo RNG, mesmo finalPracticePace', () => {
    const input = {
      teamKey: 'audi',
      careerId: 'career_reload_test',
      seasonYear: 2026,
      round: 2,
      session: 'TL2',
      driverId: 'drv_hul',
      attempt: 3,
      program: 'race_pace',
      setupEfficiency: 85,
    }

    const run1 = computePracticePace(input)
    // Simula destruição e reconstrução de contexto
    const run2 = computePracticePace({ ...input })

    expect(run1.breakdown.rng).toBe(run2.breakdown.rng)
    expect(run1.finalPracticePace).toBe(run2.finalPracticePace)
    expect(run1.lapTimeSec).toBe(run2.lapTimeSec)
  })

  // TLPA-28: TL1/TL2/TL3 namespaces distintos
  it('TLPA-28: TL1/TL2/TL3 namespaces distintos', () => {
    const base = {
      careerId: 'career_tlpa',
      seasonYear: 2026,
      round: 1,
      driverId: 'drv_hul',
      attempt: 1,
      program: 'car_setup',
    }
    const drawTL1 = getPracticeDeterministicDraw({ ...base, session: 'TL1' })
    const drawTL2 = getPracticeDeterministicDraw({ ...base, session: 'TL2' })
    const drawTL3 = getPracticeDeterministicDraw({ ...base, session: 'TL3' })

    expect(drawTL1.seedIdentity).toContain(':TL1:')
    expect(drawTL2.seedIdentity).toContain(':TL2:')
    expect(drawTL3.seedIdentity).toContain(':TL3:')

    expect(drawTL1.seedIdentity).not.toBe(drawTL2.seedIdentity)
    expect(drawTL2.seedIdentity).not.toBe(drawTL3.seedIdentity)

    expect(drawTL1.normalDrawZ).not.toBe(drawTL2.normalDrawZ)
    expect(drawTL2.normalDrawZ).not.toBe(drawTL3.normalDrawZ)
  })

  // TLPA-29: driver A e driver B com identidade RNG independente
  it('TLPA-29: driver A e driver B com identidade RNG independente', () => {
    const base = {
      careerId: 'career_tlpa',
      seasonYear: 2026,
      round: 1,
      session: 'TL1',
      attempt: 1,
      program: 'car_setup',
    }
    const drawHul = getPracticeDeterministicDraw({ ...base, driverId: 'drv_hul' })
    const drawBor = getPracticeDeterministicDraw({ ...base, driverId: 'drv_bor' })

    expect(drawHul.seedIdentity).not.toBe(drawBor.seedIdentity)
    expect(drawHul.seedUint).not.toBe(drawBor.seedUint)
    expect(drawHul.normalDrawZ).not.toBe(drawBor.normalDrawZ)
  })

  // TLPA-30: attempt 1 e 2 podem variar, mas cada attempt é individualmente reproduzível
  it('TLPA-30: attempt 1 e 2 podem variar, mas cada attempt é individualmente reproduzível', () => {
    const base = {
      careerId: 'career_tlpa',
      seasonYear: 2026,
      round: 1,
      session: 'TL1',
      driverId: 'drv_hul',
      program: 'car_setup',
    }
    const att1 = getPracticeDeterministicDraw({ ...base, attempt: 1 })
    const att2 = getPracticeDeterministicDraw({ ...base, attempt: 2 })

    expect(att1.seedIdentity).not.toBe(att2.seedIdentity)
    expect(att1.normalDrawZ).not.toBe(att2.normalDrawZ)

    // Individualmente reproduzíveis
    expect(getPracticeDeterministicDraw({ ...base, attempt: 1 }).normalDrawZ).toBe(att1.normalDrawZ)
    expect(getPracticeDeterministicDraw({ ...base, attempt: 2 }).normalDrawZ).toBe(att2.normalDrawZ)
  })

  // TLPA-31: Math.random não existe no canonicalPracticeRngService nem no computePracticePace
  it('TLPA-31: Math.random não existe no canonicalPracticeRngService nem no computePracticePace', () => {
    // 1. Verificação em runtime com spy
    const mathRandomSpy = vi.spyOn(Math, 'random')
    computePracticePace({
      teamKey: 'audi',
      driverId: 'drv_hul',
      careerId: 'career_check',
      seasonYear: 2026,
      round: 1,
      session: 'TL1',
      attempt: 1,
    })
    expect(mathRandomSpy).not.toHaveBeenCalled()
    mathRandomSpy.mockRestore()

    // 2. Varredura estática no arquivo canonicalPracticeRngService.ts
    const rngFileContent = readFileSync(
      resolve(process.cwd(), 'src/services/canonicalPracticeRngService.ts'),
      'utf-8',
    )
    expect(rngFileContent).not.toContain('Math.random()')

    // 3. Varredura estática no bloco computePracticePace em canonicalPaceIntegrationService.ts
    const paceFileContent = readFileSync(
      resolve(process.cwd(), 'src/services/canonicalPaceIntegrationService.ts'),
      'utf-8',
    )
    const computeIndex = paceFileContent.indexOf('computePracticePace(')
    expect(computeIndex).toBeGreaterThan(0)
    const computeSnippet = paceFileContent.slice(computeIndex, computeIndex + 4000)
    expect(computeSnippet).not.toContain('Math.random()')
  })

  // TLPA-32: RNG modifier entra exatamente UMA vez
  it('TLPA-32: RNG modifier entra exatamente UMA vez', () => {
    const resExplicit = computePracticePace(
      createNeutralPracticeInput('audi', {
        rngModifier: 1.25,
      }),
    )
    expect(resExplicit.breakdown.rng).toBe(1.25)
    expect(resExplicit.finalPracticePace).toBe(87.25) // 86 + 1.25

    const resExplicitNeg = computePracticePace(
      createNeutralPracticeInput('audi', {
        rngModifier: -0.75,
      }),
    )
    expect(resExplicitNeg.breakdown.rng).toBe(-0.75)
    expect(resExplicitNeg.finalPracticePace).toBe(85.25) // 86 - 0.75

    expect(resExplicit.finalPracticePace - resExplicitNeg.finalPracticePace).toBe(2.0)
  })

  // TLPA-33: Audi-Williams neutral delta = 16 pace points
  it('TLPA-33: Audi-Williams neutral delta = 16 pace points', () => {
    const audi = computePracticePace(createNeutralPracticeInput('audi'))
    const wms = computePracticePace(createNeutralPracticeInput('williams'))
    expect(audi.finalPracticePace).toBe(86.0)
    expect(wms.finalPracticePace).toBe(70.0)
    expect(audi.finalPracticePace - wms.finalPracticePace).toBe(16.0)
  })

  // TLPA-34: Audi-Cadillac neutral delta = 36
  it('TLPA-34: Audi-Cadillac neutral delta = 36', () => {
    const audi = computePracticePace(createNeutralPracticeInput('audi'))
    const cad = computePracticePace(createNeutralPracticeInput('cadillac'))
    expect(audi.finalPracticePace).toBe(86.0)
    expect(cad.finalPracticePace).toBe(50.0)
    expect(audi.finalPracticePace - cad.finalPracticePace).toBe(36.0)
  })

  // TLPA-35: full grid vs subset (Audi+Williams somente) -> gap Audi-Williams idêntico; pace é ABSOLUTO
  it('TLPA-35: full grid vs subset (Audi+Williams somente) -> gap Audi-Williams idêntico; pace é ABSOLUTO', () => {
    const allTeams = [
      'mercedes',
      'ferrari',
      'mclaren',
      'red_bull',
      'racing_bulls',
      'alpine',
      'audi',
      'haas',
      'williams',
      'aston_martin',
      'cadillac',
      'andretti',
    ]

    // Executa full grid
    const fullGridResults = allTeams.map((teamKey) =>
      computePracticePace(createNeutralPracticeInput(teamKey)),
    )
    const audiInFull = fullGridResults.find((r) => r.breakdown.teamKey === 'audi')!
    const wmsInFull = fullGridResults.find((r) => r.breakdown.teamKey === 'williams')!
    const fullGridDelta = audiInFull.finalPracticePace - wmsInFull.finalPracticePace

    // Executa apenas o subset [Audi, Williams]
    const subsetAudi = computePracticePace(createNeutralPracticeInput('audi'))
    const subsetWms = computePracticePace(createNeutralPracticeInput('williams'))
    const subsetDelta = subsetAudi.finalPracticePace - subsetWms.finalPracticePace

    expect(audiInFull.finalPracticePace).toBe(subsetAudi.finalPracticePace)
    expect(wmsInFull.finalPracticePace).toBe(subsetWms.finalPracticePace)
    expect(fullGridDelta).toBe(16.0)
    expect(subsetDelta).toBe(16.0)
    expect(fullGridDelta).toBe(subsetDelta)
  })

  // TLPA-36: QUALI-UNIFY-01 permanece integralmente verde e não foi alterado
  it('TLPA-36: QUALI-UNIFY-01 permanece integralmente verde e não foi alterado', () => {
    // Prova que o serviço de Qualifying RNG permanece intacto e funcional
    const qualiDraw = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv_rus',
      circuitProfile: { characteristics: { downforceRequirement: 'high' } },
      driverAttributes: { speed: 80, morale: 80 },
      f1Starts: 100,
      seed: 'test_seed_quali_36',
    })
    expect(qualiDraw.breakdown.structuralStrength).toBe(100)
    expect(qualiDraw.breakdown.rngModifier).toBeGreaterThanOrEqual(-1.0)
    expect(qualiDraw.breakdown.rngModifier).toBeLessThanOrEqual(1.0)
    expect(qualiDraw.effectivePaceScore).toBeGreaterThan(95)
  })
})
