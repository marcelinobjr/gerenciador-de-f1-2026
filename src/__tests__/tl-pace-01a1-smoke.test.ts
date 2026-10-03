import { describe, it, expect, vi } from 'vitest'
import {
  canonicalPaceIntegrationService,
  computePracticePace,
} from '@/services/canonicalPaceIntegrationService'
import * as canonicalPaceModule from '@/services/canonicalPaceIntegrationService'

describe('TL-PACE-01A1: Canonical Practice Pace Core Smoke Suite (TPA1-01..08)', () => {
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

  // TPA1-01: computePracticePace existe e é importável do módulo canônico
  it('TPA1-01: computePracticePace existe e é importável do módulo canônico', () => {
    expect(typeof computePracticePace).toBe('function')
    expect(typeof canonicalPaceIntegrationService.computePracticePace).toBe('function')
    expect(canonicalPaceModule.computePracticePace).toBeDefined()
  })

  // TPA1-02: Audi Structural = 86 (neutral fixture)
  it('TPA1-02: Audi Structural = 86 (neutral fixture)', () => {
    const res = computePracticePace(createNeutralPracticeInput('audi'))
    expect(res.breakdown.structural).toBe(86)
    expect(res.finalPracticePace).toBe(86)
  })

  // TPA1-03: Williams Structural = 70 (neutral fixture)
  it('TPA1-03: Williams Structural = 70 (neutral fixture)', () => {
    const res = computePracticePace(createNeutralPracticeInput('williams'))
    expect(res.breakdown.structural).toBe(70)
    expect(res.finalPracticePace).toBe(70)
  })

  // TPA1-04: Cadillac Structural = 50 (neutral fixture)
  it('TPA1-04: Cadillac Structural = 50 (neutral fixture)', () => {
    const res = computePracticePace(createNeutralPracticeInput('cadillac'))
    expect(res.breakdown.structural).toBe(50)
    expect(res.finalPracticePace).toBe(50)
  })

  // TPA1-05: teams.strength não controla o core (fixture Audi strength=20 → 86)
  it('TPA1-05: teams.strength não controla o core (fixture Audi strength=20 -> 86)', () => {
    const fakeAudi = {
      teamKey: 'audi',
      strength: 20,
      teams: { strength: 20 },
      teamChassisRating: 20,
      strengthRating: 20,
    }
    const res = computePracticePace(
      createNeutralPracticeInput(fakeAudi.teamKey, {
        // passa propriedades espúrias de legado
        strength: 20,
        teamsStrength: 20,
      } as any),
    )
    expect(res.breakdown.structural).toBe(86)
    expect(res.breakdown.structural).not.toBe(20)
    expect(res.finalPracticePace).toBe(86)
  })

  // TPA1-06: strengthRating não controla o core
  it('TPA1-06: strengthRating não controla o core (Williams strengthRating=99 -> 70)', () => {
    const res = computePracticePace(
      createNeutralPracticeInput('williams', {
        strengthRating: 99,
        chassisRating: 99,
      } as any),
    )
    expect(res.breakdown.structural).toBe(70)
    expect(res.breakdown.structural).not.toBe(99)
    expect(res.finalPracticePace).toBe(70)
  })

  // TPA1-07: TrackFit usa escala canônica (75 → modifier 0; não 0.22/±6.5)
  it('TPA1-07: TrackFit usa escala canônica (75 -> modifier 0; não 0.22/±6.5)', () => {
    // 1. Raw 75 na normalização canônica resulta em modifier exatamente 0
    const normNeutral = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 75,
    })
    expect(normNeutral.trackFitModifier).toBe(0.0)

    // 2. Raw 85 (delta +10):
    // Na escala canônica (0.08): 10 * 0.08 = +0.80 pt (clamped a normal 2.0)
    // No legado de practice (scale 0.22, clamp ±6.5): 10 * 0.22 = +2.20 pt
    const normHigher = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 85,
    })
    expect(normHigher.trackFitModifier).toBe(0.8)
    expect(normHigher.trackFitModifier).not.toBe(2.2)

    // 3. Raw 100 (delta +25):
    // Na escala canônica: 25 * 0.08 = 2.00 pt (clamped a 2.0 em pista normal)
    // No legado seria 25 * 0.22 = 5.5 pt
    const normMax = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 100,
    })
    expect(normMax.trackFitModifier).toBe(2.0)
    expect(normMax.trackFitModifier).not.toBe(5.5)
    expect(normMax.trackFitModifier).not.toBe(6.5)

    // 4. Integrado ao computePracticePace
    const carTech = {
      chassis: 85,
      aerodynamics: 85,
      powertrain: 85,
    }
    const circuitProfile = {
      characteristics: {
        downforceRequirement: 'high',
        powerRequirement: 'high',
      },
    }
    const res = computePracticePace(
      createNeutralPracticeInput('audi', {
        carTechnicalAttributes: carTech,
        circuitProfile,
      }),
    )
    expect(res.breakdown.trackFit).toBeLessThanOrEqual(2.5)
    expect(res.breakdown.trackFit).toBeGreaterThanOrEqual(-2.5)
    expect(Math.abs(res.breakdown.trackFit)).toBeLessThan(6.5)
  })

  // TPA1-08: rngModifier é injetável e Math.random não existe dentro do novo core
  it('TPA1-08: rngModifier é injetável e Math.random não existe dentro do novo core', () => {
    const mathRandomSpy = vi.spyOn(Math, 'random')

    // Injeção explícita de rngModifier = 0.75
    const resWithRng = computePracticePace(
      createNeutralPracticeInput('audi', {
        rngModifier: 0.75,
      }),
    )

    expect(resWithRng.breakdown.rng).toBe(0.75)
    expect(resWithRng.finalPracticePace).toBe(86.75) // 86 + 0.75
    expect(mathRandomSpy).not.toHaveBeenCalled()

    // Injeção negativa de rngModifier = -0.50
    const resNegativeRng = computePracticePace(
      createNeutralPracticeInput('mercedes', {
        rngModifier: -0.5,
      }),
    )
    expect(resNegativeRng.breakdown.rng).toBe(-0.5)
    expect(resNegativeRng.finalPracticePace).toBe(99.5) // 100 - 0.50
    expect(mathRandomSpy).not.toHaveBeenCalled()

    mathRandomSpy.mockRestore()
  })

  // PROVA ADICIONAL DAS ÂNCORAS NEUTRAS EXIGIDAS
  it('Âncoras neutras: Mercedes 100, Audi 86, Williams 70, Cadillac 50, Andretti 45 e deltas', () => {
    const merc = computePracticePace(createNeutralPracticeInput('mercedes'))
    const audi = computePracticePace(createNeutralPracticeInput('audi'))
    const wms = computePracticePace(createNeutralPracticeInput('williams'))
    const cad = computePracticePace(createNeutralPracticeInput('cadillac'))
    const and = computePracticePace(createNeutralPracticeInput('andretti'))

    expect(merc.finalPracticePace).toBe(100)
    expect(audi.finalPracticePace).toBe(86)
    expect(wms.finalPracticePace).toBe(70)
    expect(cad.finalPracticePace).toBe(50)
    expect(and.finalPracticePace).toBe(45)

    // Deltas canônicos
    expect(audi.finalPracticePace - wms.finalPracticePace).toBe(16)
    expect(audi.finalPracticePace - cad.finalPracticePace).toBe(36)
    expect(merc.finalPracticePace - and.finalPracticePace).toBe(55)
  })
})
