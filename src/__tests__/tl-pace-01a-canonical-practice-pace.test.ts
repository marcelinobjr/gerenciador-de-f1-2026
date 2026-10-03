/**
 * tl-pace-01a-canonical-practice-pace.test.ts
 *
 * Suíte canônica TL-PACE-01A (TLPA-01 a TLPA-36).
 * Valida o core canônico de pace do Treino Livre (computePracticePace).
 */

import { describe, it, expect } from 'vitest'
import {
  computePracticePace,
  canonicalPaceIntegrationService,
} from '@/services/canonicalPaceIntegrationService'
import {
  buildPracticeSeedIdentity,
  getPracticeDeterministicDraw,
} from '@/services/canonicalPracticeRngService'

describe('TL-PACE-01A — Canonical Practice Pace Core (TLPA-01..36)', () => {
  // Fixture neutra base para isolamento analítico rigoroso
  const neutralFixture = {
    driverId: 'neutral_d1',
    driverAttributes: {
      speed: 80,
      consistency: 80,
      technical_feedback: 80,
      morale: 80,
      f1Starts: 20, // exp score = 80
      f1_adaptation: 80,
    },
    setupEfficiency: 80, // modifier = 0.0
    programModifier: 0, // neutro = 0.0
    rookieModifier: 0, // neutro = 0.0
    noise: 0, // RNG neutro = 0.0
    tyreCompound: 'macio',
    tyreWearPct: 0,
    fuelKg: 12, // neutro (delta = 0)
    puWearPct: 0,
    weather: 'seco',
  }

  // TLPA-01: O core de treino usa Structural Strength canônico
  it('TLPA-01: deve utilizar o Structural Strength canônico como base primária', () => {
    const resAudi = computePracticePace({
      teamKey: 'audi',
      ...neutralFixture,
    })
    expect(resAudi.breakdown.structural).toBe(86)
    expect(resAudi.finalPracticePace).toBe(86)
  })

  // TLPA-02..06: Âncoras neutras de referência (Mercedes 100, Audi 86, Williams 70, Cadillac 50, Andretti 45)
  it('TLPA-02: âncora neutra Mercedes = 100', () => {
    const res = computePracticePace({
      teamKey: 'mercedes',
      ...neutralFixture,
    })
    expect(res.breakdown.structural).toBe(100)
    expect(res.finalPracticePace).toBe(100)
  })

  it('TLPA-03: âncora neutra Audi = 86', () => {
    const res = computePracticePace({
      teamKey: 'audi',
      ...neutralFixture,
    })
    expect(res.breakdown.structural).toBe(86)
    expect(res.finalPracticePace).toBe(86)
  })

  it('TLPA-04: âncora neutra Williams = 70', () => {
    const res = computePracticePace({
      teamKey: 'williams',
      ...neutralFixture,
    })
    expect(res.breakdown.structural).toBe(70)
    expect(res.finalPracticePace).toBe(70)
  })

  it('TLPA-05: âncora neutra Cadillac = 50', () => {
    const res = computePracticePace({
      teamKey: 'cadillac',
      ...neutralFixture,
    })
    expect(res.breakdown.structural).toBe(50)
    expect(res.finalPracticePace).toBe(50)
  })

  it('TLPA-06: âncora neutra Andretti = 45', () => {
    const res = computePracticePace({
      teamKey: 'andretti',
      ...neutralFixture,
    })
    expect(res.breakdown.structural).toBe(45)
    expect(res.finalPracticePace).toBe(45)
  })

  // TLPA-07: Ordem estrita das 12 equipes 2026 emerge da baseline na fixture neutra
  it('TLPA-07: ordem das 12 âncoras na fixture neutra emerge exatamente da baseline', () => {
    const teams = [
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

    const paces = teams.map((t) => ({
      team: t,
      pace: computePracticePace({ teamKey: t, ...neutralFixture }).finalPracticePace,
    }))

    // Ordena decrescente
    paces.sort((a, b) => b.pace - a.pace)

    expect(paces.map((p) => p.team)).toEqual([
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
    ])
    expect(paces.map((p) => p.pace)).toEqual([100, 98, 96, 94, 87, 87, 86, 75, 70, 60, 50, 45])
  })

  // TLPA-08..10: Imunidade a campos legados/banco (teams.strength, strengthRating, chassisRating)
  it('TLPA-08: teams.strength legado em qualquer objeto não altera Audi 86', () => {
    const res = computePracticePace({
      teamKey: 'audi',
      ...neutralFixture,
      carTechnicalAttributes: { strength: 20 },
    })
    expect(res.breakdown.structural).toBe(86)
  })

  it('TLPA-09: strengthRating legado não influencia a baseline estrutural', () => {
    const res = computePracticePace({
      teamKey: 'williams',
      ...neutralFixture,
      carTechnicalAttributes: { strengthRating: 99 },
    })
    expect(res.breakdown.structural).toBe(70)
  })

  it('TLPA-10: teamChassisRating não substitui o structural canônico', () => {
    const res = computePracticePace({
      teamKey: 'cadillac',
      ...neutralFixture,
      carTechnicalAttributes: { teamChassisRating: 90 },
    })
    expect(res.breakdown.structural).toBe(50)
  })

  // TLPA-11..12: TrackFit canônico (neutral 75 -> 0; scale canônico 0.08, não legado 0.22/±6.5)
  it('TLPA-11: TrackFit 75.0 bruto resulta estritamente em modifier 0.000', () => {
    const norm = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 75,
    })
    expect(norm.trackFitModifier).toBe(0)
  })

  it('TLPA-12: TrackFit segue escala canônica de 0.08 e clamp ±2.0/±2.5 (nunca 0.22/±6.5)', () => {
    const normNormalHigh = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 100, // (100 - 75) * 0.08 = 2.0
      isSpecializedTrack: false,
    })
    expect(normNormalHigh.trackFitModifier).toBe(2.0)
    expect(normNormalHigh.isClamped).toBe(false)

    const normSpecialized = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 110, // clamp max specialized 2.5
      isSpecializedTrack: true,
    })
    expect(normSpecialized.trackFitModifier).toBe(2.5)
    expect(normSpecialized.isClamped).toBe(true)
    expect(normNormalHigh.trackFitModifier).not.toBe(5.5) // 0.22 legado daria 5.5
  })

  // TLPA-13..14: Setup (80 -> 0; aplicado estritamente uma vez)
  it('TLPA-13: setupEfficiency 80 resulta em modificador de setup 0.000', () => {
    const res = computePracticePace({
      teamKey: 'ferrari',
      ...neutralFixture,
      setupEfficiency: 80,
    })
    expect(res.breakdown.setup).toBe(0)
  })

  it('TLPA-14: setupEfficiency 100 aplica exatamente (100-80)*0.05 = +1.0 pt uma única vez', () => {
    const res = computePracticePace({
      teamKey: 'ferrari',
      ...neutralFixture,
      setupEfficiency: 100,
    })
    expect(res.breakdown.setup).toBe(1.0)
    expect(res.finalPracticePace).toBe(99.0) // 98 + 1.0 = 99.0
  })

  // TLPA-15..16: PracticeExecution (neutral 80 -> 0; mexe poucos pontos)
  it('TLPA-15: PracticeExecution neutra (atributos 80) resulta em modifier 0.000', () => {
    const res = computePracticePace({
      teamKey: 'mclaren',
      ...neutralFixture,
      driverAttributes: {
        speed: 80,
        consistency: 80,
        technical_feedback: 80,
        morale: 80,
        f1Starts: 20,
      },
    })
    expect(res.breakdown.practiceExecution).toBe(0)
  })

  it('TLPA-16: PracticeExecution mexe poucos pontos de pace (baseline estrutural domina)', () => {
    const resElite = computePracticePace({
      teamKey: 'audi',
      ...neutralFixture,
      driverAttributes: {
        speed: 99,
        consistency: 99,
        technical_feedback: 99,
        morale: 99,
        f1Starts: 300,
      },
    })
    const resPoor = computePracticePace({
      teamKey: 'audi',
      ...neutralFixture,
      driverAttributes: {
        speed: 50,
        consistency: 50,
        technical_feedback: 50,
        morale: 50,
        f1Starts: 0,
      },
    })
    // Diferença máxima de piloto na prática deve ser contida (< 3.0 pts)
    const diff = resElite.finalPracticePace - resPoor.finalPracticePace
    expect(diff).toBeLessThan(3.0)
    expect(diff).toBeGreaterThan(0.5)
    // Audi 86 continua muito acima de Williams 70 mesmo com piloto ruim
    expect(resPoor.finalPracticePace).toBeGreaterThan(70)
  })

  // TLPA-17..18: Program modifier (0 -> neutro; programas nunca alteram Structural)
  it('TLPA-17: program neutro ou programModifier 0 não tem impacto no pace', () => {
    const res = computePracticePace({
      teamKey: 'red_bull',
      ...neutralFixture,
      program: 'car_setup',
      programModifier: 0,
    })
    expect(res.breakdown.program).toBe(0)
    expect(res.finalPracticePace).toBe(94)
  })

  it('TLPA-18: program controlado aplica exatamente uma vez e não altera Structural', () => {
    const resQualiSim = computePracticePace({
      teamKey: 'red_bull',
      ...neutralFixture,
      program: 'qualifying_sim',
    })
    expect(resQualiSim.breakdown.structural).toBe(94)
    expect(resQualiSim.breakdown.program).toBe(1.5)
    expect(resQualiSim.finalPracticePace).toBe(95.5)

    const resRacePace = computePracticePace({
      teamKey: 'red_bull',
      ...neutralFixture,
      program: 'race_pace',
    })
    expect(resRacePace.breakdown.structural).toBe(94)
    expect(resRacePace.breakdown.program).toBe(-1.0)
    expect(resRacePace.finalPracticePace).toBe(93.0)
  })

  // TLPA-19..20: Fuel modifier (física canônica; não altera Structural)
  it('TLPA-19: fuel afeta pela física canônica (~0.035s por kg acima de 12kg)', () => {
    const resHeavy = computePracticePace({
      teamKey: 'aston_martin',
      ...neutralFixture,
      fuelKg: 42, // +30kg -> 30 * 0.035 = 1.05s -> modifier = -1.05 * 12 = -12.6 pts
    })
    expect(resHeavy.breakdown.fuel).toBe(-12.6)
    expect(resHeavy.finalPracticePace).toBe(60 - 12.6)
  })

  it('TLPA-20: combustível pesado não altera o Structural da equipe', () => {
    const res = computePracticePace({
      teamKey: 'aston_martin',
      ...neutralFixture,
      fuelKg: 100,
    })
    expect(res.breakdown.structural).toBe(60)
  })

  // TLPA-21..23: Fontes canônicas de pneus, clima e desgaste
  it('TLPA-21: tyre segue tabela canônica de compostos e desgaste', () => {
    const resSoftWorn = computePracticePace({
      teamKey: 'haas',
      ...neutralFixture,
      tyreCompound: 'macio',
      tyreWearPct: 50,
    })
    // Delta desgaste: 0.5 * 0.8 = 0.4s -> modifier = -0.4 * 12 = -4.8 pts
    expect(resSoftWorn.breakdown.tyre).toBe(-4.8)
    expect(resSoftWorn.breakdown.structural).toBe(75)
  })

  it('TLPA-22: weather segue penalidades de chuva canônicas', () => {
    const resWet = computePracticePace({
      teamKey: 'haas',
      ...neutralFixture,
      tyreCompound: 'macio',
      weather: 'chuva_fraca',
    })
    // Chuva fraca com pneu slick: penalidade de 4.2s -> modifier = -4.2 * 12 = -50.4 pts
    expect(resWet.breakdown.weather).toBe(-50.4)
    expect(resWet.breakdown.structural).toBe(75)
  })

  it('TLPA-23: wear de PU aplica penalidade canônica de PU Wear', () => {
    const resWear = computePracticePace({
      teamKey: 'haas',
      ...neutralFixture,
      puWearPct: 50,
    })
    expect(resWear.breakdown.wear).toBeLessThan(0)
    expect(resWear.breakdown.structural).toBe(75)
  })

  // TLPA-24: Rookie/adaptation não altera Structural
  it('TLPA-24: rookie/adaptation entra como modificador de sessão e nunca altera Structural', () => {
    const resRookie = computePracticePace({
      teamKey: 'audi',
      ...neutralFixture,
      isRookie: true,
      driverAttributes: {
        f1_adaptation: 60,
      },
    })
    expect(resRookie.breakdown.structural).toBe(86)
    expect(resRookie.breakdown.rookieAdaptation).toBeLessThan(0)
    expect(resRookie.finalPracticePace).toBeLessThan(86)
  })

  // TLPA-25..30: RNG determinístico no core de treino
  it('TLPA-25: RNG same seed -> same draw determinístico', () => {
    const params = {
      careerId: 'test_c1',
      seasonYear: 2026,
      round: 3,
      session: 'TL1',
      driverId: 'drv_hulkenberg',
      attempt: 1,
      program: 'car_setup',
    }
    const draw1 = getPracticeDeterministicDraw(params)
    const draw2 = getPracticeDeterministicDraw(params)
    expect(draw1.rngModifier).toBe(draw2.rngModifier)
    expect(draw1.seedUint).toBe(draw2.seedUint)
    expect(draw1.normalDrawZ).toBe(draw2.normalDrawZ)
  })

  it('TLPA-26: reload / recálculo com mesmos parâmetros produz o mesmo draw', () => {
    const res1 = computePracticePace({
      teamKey: 'audi',
      ...neutralFixture,
      noise: undefined,
      careerId: 'car_reload_test',
      seasonYear: 2026,
      round: 1,
      session: 'TL2',
      attempt: 2,
    })
    const res2 = computePracticePace({
      teamKey: 'audi',
      ...neutralFixture,
      noise: undefined,
      careerId: 'car_reload_test',
      seasonYear: 2026,
      round: 1,
      session: 'TL2',
      attempt: 2,
    })
    expect(res1.breakdown.rng).toBe(res2.breakdown.rng)
    expect(res1.finalPracticePace).toBe(res2.finalPracticePace)
  })

  it('TLPA-27: driver diferente gera seed independente e sorteio isolado', () => {
    const drawHulk = getPracticeDeterministicDraw({
      careerId: 'c1',
      seasonYear: 2026,
      round: 1,
      session: 'TL1',
      driverId: 'drv_hulk',
      attempt: 1,
    })
    const drawBort = getPracticeDeterministicDraw({
      careerId: 'c1',
      seasonYear: 2026,
      round: 1,
      session: 'TL1',
      driverId: 'drv_bortoleto',
      attempt: 1,
    })
    expect(drawHulk.seedIdentity).not.toBe(drawBort.seedIdentity)
    expect(drawHulk.seedUint).not.toBe(drawBort.seedUint)
  })

  it('TLPA-28: TL1, TL2 e TL3 possuem namespaces distintos no seed', () => {
    const seed1 = buildPracticeSeedIdentity({
      careerId: 'c1',
      seasonYear: 2026,
      round: 1,
      session: 'TL1',
      driverId: 'd1',
      attempt: 1,
    })
    const seed2 = buildPracticeSeedIdentity({
      careerId: 'c1',
      seasonYear: 2026,
      round: 1,
      session: 'TL2',
      driverId: 'd1',
      attempt: 1,
    })
    const seed3 = buildPracticeSeedIdentity({
      careerId: 'c1',
      seasonYear: 2026,
      round: 1,
      session: 'TL3',
      driverId: 'd1',
      attempt: 1,
    })
    expect(seed1).toContain(':TL1:')
    expect(seed2).toContain(':TL2:')
    expect(seed3).toContain(':TL3:')
    expect(seed1).not.toBe(seed2)
    expect(seed2).not.toBe(seed3)
  })

  it('TLPA-29: zero Math.random no core canônico de prática', () => {
    const originalMathRandom = Math.random
    let randomCalled = false
    Math.random = () => {
      randomCalled = true
      return 0.5
    }

    try {
      computePracticePace({
        teamKey: 'audi',
        ...neutralFixture,
        noise: undefined,
        careerId: 'career_no_random',
        seasonYear: 2026,
        round: 1,
        session: 'TL1',
        attempt: 1,
      })
      expect(randomCalled).toBe(false)
    } finally {
      Math.random = originalMathRandom
    }
  })

  it('TLPA-30: RNG entra exatamente uma vez no cálculo de pace', () => {
    const res = computePracticePace({
      teamKey: 'audi',
      ...neutralFixture,
      noise: 0.75, // injeção direta de ruído
    })
    expect(res.breakdown.rng).toBe(0.75)
    // 86 (structural) + 0.75 (rng) = 86.75
    expect(res.finalPracticePace).toBe(86.75)
  })

  // TLPA-31..34: Pace absoluto, gaps canônicos (Audi-Williams 16, Audi-Cadillac 36), sem renormalização
  it('TLPA-31: preserva gap exato Audi-Williams = 16 pontos na baseline neutra', () => {
    const audi = computePracticePace({ teamKey: 'audi', ...neutralFixture })
    const williams = computePracticePace({ teamKey: 'williams', ...neutralFixture })
    expect(audi.finalPracticePace - williams.finalPracticePace).toBe(16)
  })

  it('TLPA-32: preserva gap exato Audi-Cadillac = 36 pontos na baseline neutra', () => {
    const audi = computePracticePace({ teamKey: 'audi', ...neutralFixture })
    const cadillac = computePracticePace({ teamKey: 'cadillac', ...neutralFixture })
    expect(audi.finalPracticePace - cadillac.finalPracticePace).toBe(36)
  })

  it('TLPA-33: remoção de equipes (subset do grid) não renormaliza os gaps', () => {
    // Cenário: apenas Audi, Williams e Cadillac no treino (subset de 3 equipes)
    const subset = ['audi', 'williams', 'cadillac'].map((teamKey) =>
      computePracticePace({ teamKey, ...neutralFixture }),
    )
    const audi = subset.find((s) => s.breakdown.teamKey === 'audi')!
    const williams = subset.find((s) => s.breakdown.teamKey === 'williams')!
    const cadillac = subset.find((s) => s.breakdown.teamKey === 'cadillac')!

    expect(audi.finalPracticePace).toBe(86)
    expect(williams.finalPracticePace).toBe(70)
    expect(cadillac.finalPracticePace).toBe(50)
    expect(audi.finalPracticePace - williams.finalPracticePace).toBe(16)
    expect(audi.finalPracticePace - cadillac.finalPracticePace).toBe(36)
  })

  it('TLPA-34: o pace de treino é absoluto e não depende de min/max dos participantes', () => {
    // Calculado isoladamente para Audi
    const isolatedAudi = computePracticePace({ teamKey: 'audi', ...neutralFixture })
    expect(isolatedAudi.finalPracticePace).toBe(86)

    // Calculado isoladamente para Andretti (última)
    const isolatedAndretti = computePracticePace({ teamKey: 'andretti', ...neutralFixture })
    expect(isolatedAndretti.finalPracticePace).toBe(45)

    // Calculado isoladamente para Mercedes (primeira)
    const isolatedMercedes = computePracticePace({ teamKey: 'mercedes', ...neutralFixture })
    expect(isolatedMercedes.finalPracticePace).toBe(100)
  })

  // TLPA-35: Qualifying core continua rigorosamente inalterado
  it('TLPA-35: qualifying core permanece funcional e inalterado', () => {
    const resQuali = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'neutral_d1',
      circuitProfile: undefined,
      driverAttributes: { speed: 80, morale: 80 },
      f1Starts: 20,
      setupEfficiency: 80,
      tyreCompound: 'macio',
      fuelKg: 12,
      noise: 0,
    })
    expect(resQuali.breakdown.structuralStrength).toBe(100)
    expect(resQuali.breakdown.sessionType).toBe('qualifying')
  })

  // TLPA-36: Regressões canônicas de auditoria de integração
  it('TLPA-36: auditoria canônica de pace integração continua passando', () => {
    const audit = canonicalPaceIntegrationService.auditPaceIntegration()
    expect(audit.auditPassed).toBe(true)
    expect(audit.structuralConnectedQuali).toBe(true)
    expect(audit.structuralConnectedRace).toBe(true)
  })
})
