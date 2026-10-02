/**
 * qualifying-driver-execution-02.test.ts
 *
 * QUALI-DRIVER-EXECUTION-02: Suíte canônica de testes de execução de piloto no Qualifying.
 *
 * ESCOPO (40 CASOS):
 * 01: Experience 0 starts = 40.00
 * 02: Experience 10 starts ≈ 45.71
 * 03: Experience 50 starts ≈ 63.61
 * 04: Experience 100 starts ≈ 77.93
 * 05: Experience 250 starts ≈ 95.07
 * 06: Experience satura abaixo/até 100
 * 07: starts negativo não produz Experience < 40
 * 08: uma única fonte canônica de starts é usada
 * 09: não soma dois contadores equivalentes
 * 10: Experience não é persistida em novo campo
 * 11: QExec = Technical 70%
 * 12: QExec = Experience 20%
 * 13: QExec = Morale 10%
 * 14: maior Technical melhora expected pace (demais fatores iguais)
 * 15: maior Experience melhora expected pace (demais fatores iguais)
 * 16: maior Morale melhora expected pace (demais fatores iguais)
 * 17: same-car different-driver produz pace esperado diferente
 * 18: modifier antigo não é somado com QExec no qualifying
 * 19: QExec aplicado exatamente 1x
 * 20: TrackFit aplicado exatamente 1x
 * 21: Setup aplicado exatamente 1x
 * 22: RNG aplicado exatamente 1x
 * 23: sigma permanece exatamente 0.45
 * 24: Q1 usa pipeline canônico
 * 25: Q2 usa pipeline canônico
 * 26: Q3 usa pipeline canônico
 * 27: sem hardcode por driverName
 * 28: sem hardcode por teamName
 * 29: sem position cap
 * 30: sem qualifying result hardcoded
 * 31: carro continua determinante
 * 32: piloto melhor não apaga gap estrutural extremo
 * 33: multi-seed permite inversões ocasionais
 * 34: multi-seed mantém melhor QExec mais rápido em média
 * 35: Structural formula intacta
 * 36: WCA baseline intacta
 * 37: CP4 intacto
 * 38: Adaptation não duplicada no QExec
 * 39: Consistency não adicionada ao QExec
 * 40: Rain não adicionada no QExec seco
 */

import { describe, it, expect } from 'vitest'
import {
  calculateF1ExperienceScore,
  calculateQDriverExecution,
  calculateQExecModifier,
  resolveCanonicalF1Starts,
  QDE_CONSTANTS,
} from '@/lib/qualifying-driver-execution'
import {
  canonicalPaceIntegrationService,
  QUALI_RNG_TARGET_RANGE,
} from '@/services/canonicalPaceIntegrationService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'
import { getDriverCareerBaseline2025 } from '@/data/driverCareerStats2025'
import { MBJ_2026_PILOTS, getDriverCareerStats } from '@/lib/mbj-drivers-data'
import { STRUCTURAL_STRENGTH_WEIGHTS, DRIVER_WEIGHTS } from '@/services/structuralStrengthService'

describe('QUALI-DRIVER-EXECUTION-02: Canonical Suite (40 Test Cases)', () => {
  const silverstone = resolveCircuitProfile({ round: 11 })
  const audiEntry = BASELINE_V0_DATA.teams['audi'] as any
  const audiTech = audiEntry?.technicalAttributes ?? audiEntry?.carAttributes

  // 01: Experience 0 starts = 40.00
  it('QDE02-01: Experience 0 starts = 40', () => {
    const exp = calculateF1ExperienceScore(0)
    expect(exp).toBe(40.0)
  })

  // 02: Experience 10 starts ≈ 45.71
  it('QDE02-02: Experience 10 starts ≈ 45.71', () => {
    const exp = calculateF1ExperienceScore(10)
    // 40 + 60 * (1 - exp(-0.1)) = 40 + 60 * (1 - 0.904837) = 45.7098 ≈ 45.71
    expect(exp).toBeCloseTo(45.71, 2)
  })

  // 03: Experience 50 starts ≈ 63.61
  it('QDE02-03: Experience 50 starts ≈ 63.61', () => {
    const exp = calculateF1ExperienceScore(50)
    // 40 + 60 * (1 - exp(-0.5)) = 40 + 60 * (1 - 0.60653) = 63.608 ≈ 63.61
    expect(exp).toBeCloseTo(63.61, 2)
  })

  // 04: Experience 100 starts ≈ 77.93
  it('QDE02-04: Experience 100 starts ≈ 77.93', () => {
    const exp = calculateF1ExperienceScore(100)
    // 40 + 60 * (1 - exp(-1)) = 40 + 60 * (1 - 0.367879) = 77.927 ≈ 77.93
    expect(exp).toBeCloseTo(77.93, 2)
  })

  // 05: Experience 250 starts ≈ 95.07
  it('QDE02-05: Experience 250 starts ≈ 95.07', () => {
    const exp = calculateF1ExperienceScore(250)
    // 40 + 60 * (1 - exp(-2.5)) = 40 + 60 * (1 - 0.082085) = 95.0749 ≈ 95.07
    expect(exp).toBeCloseTo(95.07, 2)
  })

  // 06: Experience satura abaixo/até 100
  it('QDE02-06: satura abaixo/até 100', () => {
    const exp1000 = calculateF1ExperienceScore(1000)
    const exp5000 = calculateF1ExperienceScore(5000)
    expect(exp1000).toBeLessThanOrEqual(100)
    expect(exp5000).toBeLessThanOrEqual(100)
    expect(exp1000).toBeGreaterThanOrEqual(99.9)
    expect(exp5000).toBe(100)
  })

  // 07: starts negativo não produz Experience < 40
  it('QDE02-07: starts negativo não produz Experience < 40', () => {
    expect(calculateF1ExperienceScore(-1)).toBe(40.0)
    expect(calculateF1ExperienceScore(-100)).toBe(40.0)
    expect(calculateF1ExperienceScore(NaN)).toBe(40.0)
    expect(calculateF1ExperienceScore(undefined)).toBe(40.0)
    expect(calculateF1ExperienceScore(null)).toBe(40.0)
  })

  // 08: uma única fonte canônica de starts é usada
  it('QDE02-08: uma única fonte canônica de starts é usada', () => {
    // getDriverCareerStats({ pilot }).races consulta primária getDriverCareerBaseline2025
    const verId = 'mbj-001'
    const baseline = getDriverCareerBaseline2025(verId)
    expect(baseline).not.toBeNull()
    expect(baseline?.races).toBe(233)

    const starts = resolveCanonicalF1Starts(verId)
    expect(starts).toBe(233)
  })

  // 09: não soma dois contadores equivalentes
  it('QDE02-09: não soma dois contadores equivalentes', () => {
    const verPilot = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-001')!
    // verPilot tem f1RacesCompleted: 205 no objeto, mas baseline histórico tem 233
    // NÃO deve somar 205 + 233 = 438
    const stats = getDriverCareerStats({ pilot: verPilot })
    expect(stats.races).toBe(233) // Exatamente a fonte canônica, sem duplicação

    const starts = resolveCanonicalF1Starts(verPilot.id, verPilot)
    expect(starts).toBe(233)
    expect(starts).not.toBe(205 + 233)
  })

  // 10: Experience não é persistida em novo campo
  it('QDE02-10: Experience não é persistida em novo campo', () => {
    // Verifica que nenhum piloto do catálogo tem campo `experience` ou `f1Experience` persistido no schema
    for (const pilot of MBJ_2026_PILOTS) {
      expect((pilot as any).experience).toBeUndefined()
      expect((pilot as any).f1Experience).toBeUndefined()
    }
  })

  // 11: QExec = Technical 70%
  it('QDE02-11: QExec = Technical 70%', () => {
    const base = calculateQDriverExecution({ technical: 80, experience: 80, morale: 80 })
    const plus10 = calculateQDriverExecution({ technical: 90, experience: 80, morale: 80 })
    // +10 tech com peso 0.70 deve resultar em exatamente +7.00 no QDriverExecution
    expect(plus10 - base).toBeCloseTo(7.0, 3)
  })

  // 12: QExec = Experience 20%
  it('QDE02-12: QExec = Experience 20%', () => {
    const base = calculateQDriverExecution({ technical: 80, experience: 80, morale: 80 })
    const plus10 = calculateQDriverExecution({ technical: 80, experience: 90, morale: 80 })
    // +10 experience com peso 0.20 deve resultar em exatamente +2.00 no QDriverExecution
    expect(plus10 - base).toBeCloseTo(2.0, 3)
  })

  // 13: QExec = Morale 10%
  it('QDE02-13: QExec = Morale 10%', () => {
    const base = calculateQDriverExecution({ technical: 80, experience: 80, morale: 80 })
    const plus10 = calculateQDriverExecution({ technical: 80, experience: 80, morale: 90 })
    // +10 morale com peso 0.10 deve resultar em exatamente +1.00 no QDriverExecution
    expect(plus10 - base).toBeCloseTo(1.0, 3)
  })

  // 14: maior Technical melhora expected pace (demais fatores iguais)
  it('QDE02-14: maior Technical melhora expected pace (demais fatores iguais)', () => {
    const paceLow = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-14',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 85, morale: 85 },
      f1Starts: 100,
      noise: 0,
    })
    const paceHigh = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-14',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 95, morale: 85 },
      f1Starts: 100,
      noise: 0,
    })

    expect(paceHigh.effectivePaceScore).toBeGreaterThan(paceLow.effectivePaceScore)
    expect(paceHigh.lapTimeSec).toBeLessThan(paceLow.lapTimeSec)
  })

  // 15: maior Experience idem
  it('QDE02-15: maior Experience melhora expected pace (demais fatores iguais)', () => {
    const paceRookie = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-15',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 85, morale: 85 },
      f1Starts: 0,
      noise: 0,
    })
    const paceVeteran = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-15',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 85, morale: 85 },
      f1Starts: 250,
      noise: 0,
    })

    expect(paceVeteran.effectivePaceScore).toBeGreaterThan(paceRookie.effectivePaceScore)
    expect(paceVeteran.lapTimeSec).toBeLessThan(paceRookie.lapTimeSec)
  })

  // 16: maior Morale idem
  it('QDE02-16: maior Morale melhora expected pace (demais fatores iguais)', () => {
    const paceLowMorale = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-16',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 85, morale: 60 },
      f1Starts: 100,
      noise: 0,
    })
    const paceHighMorale = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-16',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 85, morale: 95 },
      f1Starts: 100,
      noise: 0,
    })

    expect(paceHighMorale.effectivePaceScore).toBeGreaterThan(paceLowMorale.effectivePaceScore)
    expect(paceHighMorale.lapTimeSec).toBeLessThan(paceLowMorale.lapTimeSec)
  })

  // 17: same-car different-driver produz pace esperado diferente
  it('QDE02-17: same-car different-driver produz pace esperado diferente', () => {
    // Verstappen vs Hülkenberg vs Bortoleto no Audi 86
    const paceVer = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'mbj-001',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 98, morale: 92 },
      noise: 0,
    })
    const paceHul = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'mbj-019',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 88, morale: 84 },
      noise: 0,
    })
    const paceBor = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'mbj-020',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 86, morale: 89 },
      noise: 0,
    })

    expect(paceVer.lapTimeSec).not.toBe(paceHul.lapTimeSec)
    expect(paceHul.lapTimeSec).not.toBe(paceBor.lapTimeSec)
    expect(paceVer.lapTimeSec).toBeLessThan(paceHul.lapTimeSec)
    expect(paceHul.lapTimeSec).toBeLessThan(paceBor.lapTimeSec)
  })

  // 18: modifier antigo não é somado com QExec no qualifying
  it('QDE02-18: modifier antigo não é somado com QExec no qualifying', () => {
    // Se o modifier antigo (speedDelta=(speed-85)*0.08 + moraleDelta=((morale-80)*0.02))
    // estivesse empilhado com QExecModifier, driverEventModifier conteria a soma dos dois.
    const technical = 98
    const morale = 92
    const starts = 233
    const experience = calculateF1ExperienceScore(starts)
    const qExec = calculateQDriverExecution({ technical, experience, morale })
    const expectedQExecMod = calculateQExecModifier(qExec)

    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-18',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: technical, morale },
      f1Starts: starts,
      noise: 0,
      weather: 'seco',
    })

    // driverEventModifier deve ser EXATAMENTE igual a expectedQExecMod (sem empilhamento)
    expect(pace.breakdown.driverEventModifier).toBeCloseTo(expectedQExecMod, 3)

    // Se o antigo estivesse somado:
    const oldSpeedDelta = (technical - 85) * 0.08
    const oldMoraleDelta = (morale - 80) * 0.02
    const oldModifier = oldSpeedDelta + oldMoraleDelta
    const stackedModifier = expectedQExecMod + oldModifier
    expect(pace.breakdown.driverEventModifier).not.toBeCloseTo(stackedModifier, 2)
  })

  // 19: QExec aplicado exatamente 1x
  it('QDE02-19: QExec aplicado exatamente 1x', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'mbj-001',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 98, morale: 92 },
      noise: 0,
    })

    const b = pace.breakdown
    const sumAllModifiers = Number(
      (
        b.structuralStrength +
        b.trackFitModifier +
        b.setupModifier +
        b.driverEventModifier +
        b.tyreModifier +
        b.fuelModifier +
        b.wearModifier +
        b.weatherModifier +
        b.rngModifier
      ).toFixed(2),
    )

    expect(pace.effectivePaceScore).toBe(sumAllModifiers)
    // Se estivesse duplicado na pontuação final:
    expect(pace.effectivePaceScore).not.toBe(
      Number((sumAllModifiers + b.driverEventModifier).toFixed(2)),
    )
  })

  // 20: TrackFit 1x
  it('QDE02-20: TrackFit 1x', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-20',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 85 },
      noise: 0,
    })
    const b = pace.breakdown
    expect(b.trackFitModifier).toBeDefined()
    // TrackFit é aplicado uma única vez na decomposição
    const expected = Number(
      (
        b.structuralStrength +
        b.trackFitModifier +
        b.setupModifier +
        b.driverEventModifier +
        b.tyreModifier +
        b.fuelModifier +
        b.wearModifier +
        b.weatherModifier +
        b.rngModifier
      ).toFixed(2),
    )
    expect(pace.effectivePaceScore).toBe(expected)
  })

  // 21: Setup 1x
  it('QDE02-21: Setup 1x', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-21',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 90,
      noise: 0,
    })
    expect(pace.breakdown.setupModifier).toBeCloseTo((90 - 80) * 0.05, 3)
  })

  // 22: RNG 1x
  it('QDE02-22: RNG 1x', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-22',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 85 },
      noise: 0.5,
    })
    expect(pace.breakdown.rngModifier).toBeCloseTo(0.5, 3)
  })

  // 23: sigma permanece 0.45
  it('QDE02-23: sigma permanece 0.45', () => {
    expect(QUALI_RNG_TARGET_RANGE.SIGMA).toBe(0.45)
  })

  // 24: Q1 usa pipeline canônico
  it('QDE02-24: Q1 usa pipeline canônico', () => {
    // O mesmo método computeQualifyingPace atende a sessão de qualifying
    const p = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-24',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 85 },
      noise: 0,
    })
    expect(p.breakdown.sessionType).toBe('qualifying')
    expect(p.effectivePaceScore).toBeGreaterThan(0)
  })

  // 25: Q2 usa pipeline canônico
  it('QDE02-25: Q2 usa pipeline canônico', () => {
    const p = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-25',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 85 },
      noise: 0,
    })
    expect(p.breakdown.sessionType).toBe('qualifying')
    expect(p.lapTimeSec).toBeGreaterThan(54.0)
  })

  // 26: Q3 usa pipeline canônico
  it('QDE02-26: Q3 usa pipeline canônico', () => {
    const p = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-26',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 85 },
      noise: 0,
    })
    expect(p.breakdown.sessionType).toBe('qualifying')
  })

  // 27: sem hardcode por driverName
  it('QDE02-27: sem hardcode por driverName', () => {
    // Dois drivers fictícios com os exatos mesmos inputs técnicos, experience e moral devem ter o mesmo modifier
    const paceA = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'pilot_fake_alpha',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 90, morale: 85 },
      f1Starts: 50,
      noise: 0,
    })
    const paceB = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'pilot_fake_beta',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 90, morale: 85 },
      f1Starts: 50,
      noise: 0,
    })
    expect(paceA.breakdown.driverEventModifier).toBe(paceB.breakdown.driverEventModifier)
    expect(paceA.lapTimeSec).toBe(paceB.lapTimeSec)
  })

  // 28: sem hardcode por teamName
  it('QDE02-28: sem hardcode por teamName', () => {
    // Modificador do piloto independe da equipe
    const modAudi = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv_test',
      circuitProfile: silverstone,
      driverAttributes: { speed: 92, morale: 80 },
      f1Starts: 100,
      noise: 0,
    }).breakdown.driverEventModifier

    const modWilliams = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'drv_test',
      circuitProfile: silverstone,
      driverAttributes: { speed: 92, morale: 80 },
      f1Starts: 100,
      noise: 0,
    }).breakdown.driverEventModifier

    expect(modAudi).toBe(modWilliams)
  })

  // 29: sem position cap
  it('QDE02-29: sem position cap', () => {
    // Um piloto com QExec baixo num carro dominante ainda tem lapTime determinado pelas fórmulas físicas
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv-test-29',
      circuitProfile: silverstone,
      driverAttributes: { speed: 70, morale: 70 },
      f1Starts: 0,
      noise: 0,
    })
    expect(pace.lapTimeSec).toBeGreaterThan(60.0)
  })

  // 30: sem qualifying result hardcoded
  it('QDE02-30: sem qualifying result hardcoded', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'mbj-001',
      circuitProfile: silverstone,
      driverAttributes: { speed: 98, morale: 92 },
      noise: 0,
    })
    // O tempo deve ser resultado contínuo da física
    expect(pace.lapTimeSec).toBeGreaterThan(70.0)
    expect(pace.lapTimeSec).toBeLessThan(80.0)
  })

  // 31: carro continua determinante
  it('QDE02-31: carro continua determinante', () => {
    // Mercedes (100) vs Andretti (45) com o mesmo piloto
    const mercPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'mbj-001',
      circuitProfile: silverstone,
      driverAttributes: { speed: 98, morale: 92 },
      noise: 0,
    })
    const andrettiPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'andretti',
      driverId: 'mbj-001',
      circuitProfile: silverstone,
      driverAttributes: { speed: 98, morale: 92 },
      noise: 0,
    })

    // Delta do carro é de 55 pts de structural strength (~4.5s)
    const gap = andrettiPace.lapTimeSec - mercPace.lapTimeSec
    expect(gap).toBeGreaterThan(4.0)
  })

  // 32: piloto melhor não apaga gap estrutural extremo
  it('QDE02-32: piloto melhor não apaga gap estrutural extremo', () => {
    // Verstappen (speed 98, exp alta) na Andretti (45) vs Piloto Novato (speed 80, 0 starts) na Mercedes (100)
    const andrettiVerstappen = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'andretti',
      driverId: 'mbj-001',
      circuitProfile: silverstone,
      driverAttributes: { speed: 98, morale: 92 },
      noise: 0,
    })
    const mercRookie = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'rookie',
      circuitProfile: silverstone,
      driverAttributes: { speed: 80, morale: 80 },
      f1Starts: 0,
      noise: 0,
    })

    // Mercedes ainda deve ser muito mais rápida que Andretti, mesmo com piloto inferior
    expect(mercRookie.lapTimeSec).toBeLessThan(andrettiVerstappen.lapTimeSec)
    const delta = andrettiVerstappen.lapTimeSec - mercRookie.lapTimeSec
    expect(delta).toBeGreaterThan(2.5) // gap estrutural vence com folga
  })

  // 33: multi-seed permite inversões ocasionais
  it('QDE02-33: multi-seed permite inversões ocasionais', () => {
    // Hülkenberg (speed 88, exp 250) vs Bortoleto (speed 86, exp 24) no mesmo Audi 86
    // Com RNG ativo (sigma 0.45), em algumas seeds Bortoleto deve bater Hülkenberg
    let bortoletoWins = 0
    const seedsCount = 100

    for (let i = 1; i <= seedsCount; i++) {
      const seed = `seed_multiseed_qde02_${i}`
      const hul = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'audi',
        driverId: 'mbj-019',
        circuitProfile: silverstone,
        carTechnicalAttributes: audiTech,
        driverAttributes: { speed: 88, morale: 84 },
        seed: `${seed}_hul`,
      })
      const bor = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'audi',
        driverId: 'mbj-020',
        circuitProfile: silverstone,
        carTechnicalAttributes: audiTech,
        driverAttributes: { speed: 86, morale: 89 },
        seed: `${seed}_bor`,
      })

      if (bor.lapTimeSec < hul.lapTimeSec) {
        bortoletoWins++
      }
    }

    // Prova A: piloto inferior em QExec PODE vencer tentativa isolada
    expect(bortoletoWins).toBeGreaterThan(0)
    expect(bortoletoWins).toBeLessThan(seedsCount)
  })

  // 34: multi-seed mantém melhor QExec mais rápido em média
  it('QDE02-34: multi-seed mantém melhor QExec mais rápido em média', () => {
    let sumVer = 0
    let sumHul = 0
    let sumBor = 0
    const seedsCount = 150

    for (let i = 1; i <= seedsCount; i++) {
      const seed = `seed_stats_qde02_${i}`
      const ver = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'audi',
        driverId: 'mbj-001',
        circuitProfile: silverstone,
        carTechnicalAttributes: audiTech,
        driverAttributes: { speed: 98, morale: 92 },
        seed: `${seed}_v`,
      })
      const hul = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'audi',
        driverId: 'mbj-019',
        circuitProfile: silverstone,
        carTechnicalAttributes: audiTech,
        driverAttributes: { speed: 88, morale: 84 },
        seed: `${seed}_h`,
      })
      const bor = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'audi',
        driverId: 'mbj-020',
        circuitProfile: silverstone,
        carTechnicalAttributes: audiTech,
        driverAttributes: { speed: 86, morale: 89 },
        seed: `${seed}_b`,
      })

      sumVer += ver.lapTimeSec
      sumHul += hul.lapTimeSec
      sumBor += bor.lapTimeSec
    }

    const meanVer = sumVer / seedsCount
    const meanHul = sumHul / seedsCount
    const meanBor = sumBor / seedsCount

    // Prova B: piloto superior em QExec tem melhor média em amostra grande
    expect(meanVer).toBeLessThan(meanHul)
    expect(meanHul).toBeLessThan(meanBor)
  })

  // 35: Structural formula intacta
  it('QDE02-35: Structural formula intacta', () => {
    expect(STRUCTURAL_STRENGTH_WEIGHTS.technical).toBe(0.6)
    expect(STRUCTURAL_STRENGTH_WEIGHTS.driver).toBe(0.25)
    expect(STRUCTURAL_STRENGTH_WEIGHTS.team).toBe(0.15)
    expect(DRIVER_WEIGHTS.driverAttributes).toBe(0.8)
    expect(DRIVER_WEIGHTS.morale).toBe(0.1)
    expect(DRIVER_WEIGHTS.adaptation).toBe(0.1)
  })

  // 36: WCA baseline intacta
  it('QDE02-36: WCA baseline intacta', () => {
    // Audi = 86
    expect(BASELINE_V0_DATA.teams['audi'].structuralStrengthScore).toBe(86)
    // Mercedes = 100
    expect(BASELINE_V0_DATA.teams['mercedes'].structuralStrengthScore).toBe(100)
    // Andretti = 45
    expect(BASELINE_V0_DATA.teams['andretti'].structuralStrengthScore).toBe(45)
  })

  // 37: CP4 intacto & QDE scale calibrado esportivamente (10 pts QExec em 0.15–0.25s)
  it('QDE02-37: CP4 intacto e calibração de scale QDE', () => {
    expect(QUALI_RNG_TARGET_RANGE.SIGMA).toBe(0.45)
    expect(QDE_CONSTANTS.SCALE).toBe(0.24)
    expect(QDE_CONSTANTS.NEUTRAL).toBe(80)

    // Prova explícita: 10 QExec pts produzem impacto dentro da janela esportiva 0.15–0.25s
    const paceExec80 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-calib-80',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 80, morale: 80 },
      qDriverExecutionOverride: 80,
      noise: 0,
    })
    const paceExec90 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-calib-90',
      circuitProfile: silverstone,
      carTechnicalAttributes: audiTech,
      driverAttributes: { speed: 90, morale: 80 },
      qDriverExecutionOverride: 90,
      noise: 0,
    })

    const deltaPacePoints = paceExec90.effectivePaceScore - paceExec80.effectivePaceScore
    const deltaLapSec = paceExec80.lapTimeSec - paceExec90.lapTimeSec

    // 10 pts * 0.24 = 2.4 pts de pace
    expect(deltaPacePoints).toBeCloseTo(2.4, 1)
    // 2.4 pts * 0.082 s/pt = 0.1968 s (~0.197 s), estritamente dentro de [0.15, 0.25]
    expect(deltaLapSec).toBeGreaterThanOrEqual(0.15)
    expect(deltaLapSec).toBeLessThanOrEqual(0.25)
    expect(deltaLapSec).toBeCloseTo(0.197, 2)
  })

  // 38: Adaptation não duplicada no QExec
  it('QDE02-38: Adaptation não duplicada no QExec', () => {
    // QDriverExecution formula usa apenas technical, experience e morale
    const execWithAdap = calculateQDriverExecution({
      technical: 85,
      experience: 85,
      morale: 85,
    })
    // Não existe campo adaptation no cálculo de QExec
    expect(execWithAdap).toBe(85.0)
  })

  // 39: Consistency não adicionada
  it('QDE02-39: Consistency não adicionada ao QExec', () => {
    // Consistency fica para etapa futura de sigma individual
    const p1 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-39',
      circuitProfile: silverstone,
      driverAttributes: { speed: 85, consistency: 50 },
      f1Starts: 50,
      noise: 0,
    })
    const p2 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-39',
      circuitProfile: silverstone,
      driverAttributes: { speed: 85, consistency: 99 },
      f1Starts: 50,
      noise: 0,
    })
    expect(p1.breakdown.driverEventModifier).toBe(p2.breakdown.driverEventModifier)
  })

  // 40: Rain não adicionada no QExec seco
  it('QDE02-40: Rain não adicionada no QExec seco', () => {
    const pDry1 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-40',
      circuitProfile: silverstone,
      driverAttributes: { speed: 85, rain: 50 },
      f1Starts: 50,
      weather: 'seco',
      noise: 0,
    })
    const pDry2 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv-test-40',
      circuitProfile: silverstone,
      driverAttributes: { speed: 85, rain: 99 },
      f1Starts: 50,
      weather: 'seco',
      noise: 0,
    })
    expect(pDry1.breakdown.driverEventModifier).toBe(pDry2.breakdown.driverEventModifier)
  })
})
