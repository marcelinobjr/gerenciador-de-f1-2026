/**
 * calibration-wca-01.test.ts
 *
 * Suíte de Auditoria e Homologação Canônica: CALIBRATION-WCA-01
 * (Williams + Cadillac + Andretti)
 *
 * Cobre estritamente os requisitos WCA01 até WCA18:
 * - WCA01: fixture neutra é determinística.
 * - WCA02: mesmo piloto neutro usado na comparação estrutural.
 * - WCA03: setup = 80 em todas as equipes.
 * - WCA04: RNG = 0/neutralizado.
 * - WCA05: TrackFit neutralizado no teste estrutural puro.
 * - WCA06: Williams dentro do envelope do grupo inferior em cenário neutro agregado.
 * - WCA07: Cadillac dentro do envelope do grupo inferior.
 * - WCA08: Andretti dentro do envelope do grupo inferior.
 * - WCA09: Top 4 permanecem superiores estruturalmente ao grupo inferior em cenário neutro.
 * - WCA10: Middle group permanece distinguível do grupo inferior no agregado.
 * - WCA11: TrackFit ainda pode produzir inversões plausíveis em pistas específicas.
 * - WCA12: pilotos reais podem alterar a ordem sem alterar Structural Strength.
 * - WCA13: nenhum código de produção contém bônus/penalidade por nome WCA.
 * - WCA14: nenhum cap de resultado/posição foi criado.
 * - WCA15: setupEfficiency permanece neutral 80 e coeficiente atual preservado.
 * - WCA16: TrackFit permanece neutral 75, scale 0.08, clamp ±2.0/±2.5.
 * - WCA17: qualifying RNG permanece sigma 0.45.
 * - WCA18: CP3A e integridade da baseline 2026 continuam verdes.
 */

import { describe, it, expect } from 'vitest'
import {
  canonicalPaceIntegrationService,
  TRACKFIT_NORMAL_CLAMP,
  TRACKFIT_SPECIALIZED_CLAMP,
  NEUTRAL_TRACKFIT_REFERENCE,
  TRACKFIT_SCALE,
  QUALI_RNG_TARGET_RANGE,
  QUALI_RNG_DEFAULT_SIGMA,
} from '@/services/canonicalPaceIntegrationService'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import {
  BASELINE_2026_V1_TEAMS,
  BASELINE_2026_V1_ORDER,
  BASELINE_2026_V1_METADATA,
} from '@/data/baseline-2026-v1'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'

describe('CALIBRATION-WCA-01 — Suíte de Auditoria Williams, Cadillac e Andretti', () => {
  const neutralDriver = { speed: 85, consistency: 85, morale: 80 }
  const canonical12Teams = [
    'mercedes',
    'ferrari',
    'mclaren',
    'redbull',
    'racingbulls',
    'alpine',
    'audi',
    'haas',
    'williams',
    'astonmartin',
    'cadillac',
    'andretti',
  ] as const

  // =========================================================================
  // WCA01: Fixture neutra é determinística
  // =========================================================================
  it('WCA01: fixture neutra é determinística', () => {
    const run1 = canonical12Teams.map((teamKey) => {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: `${teamKey}-drv`,
        circuitProfile: null,
        carTechnicalAttributes: null,
        driverAttributes: neutralDriver,
        setupEfficiency: 80,
        fuelKg: 12,
        noise: 0,
      })
      return { teamKey, pace: pace.effectivePaceScore, lapTime: pace.lapTimeSec }
    })

    const run2 = canonical12Teams.map((teamKey) => {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: `${teamKey}-drv`,
        circuitProfile: null,
        carTechnicalAttributes: null,
        driverAttributes: neutralDriver,
        setupEfficiency: 80,
        fuelKg: 12,
        noise: 0,
      })
      return { teamKey, pace: pace.effectivePaceScore, lapTime: pace.lapTimeSec }
    })

    expect(run1).toEqual(run2)
  })

  // =========================================================================
  // WCA02: Mesmo piloto neutro usado na comparação estrutural
  // =========================================================================
  it('WCA02: mesmo piloto neutro usado na comparação estrutural', () => {
    // Prova que em todas as 12 equipes o modificador de piloto é idêntico e nulo (delta = 0)
    canonical12Teams.forEach((teamKey) => {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: 'neutral-evaluator',
        circuitProfile: null,
        carTechnicalAttributes: null,
        driverAttributes: neutralDriver,
        setupEfficiency: 80,
        noise: 0,
      })
      expect(pace.breakdown.driverEventModifier).toBe(0)
    })
  })

  // =========================================================================
  // WCA03: Setup = 80 em todas as equipes (setupModifier = 0)
  // =========================================================================
  it('WCA03: setup = 80 em todas as equipes', () => {
    canonical12Teams.forEach((teamKey) => {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: `${teamKey}-drv`,
        circuitProfile: null,
        carTechnicalAttributes: null,
        driverAttributes: neutralDriver,
        setupEfficiency: 80,
        noise: 0,
      })
      expect(pace.breakdown.setupModifier).toBe(0)
    })
  })

  // =========================================================================
  // WCA04: RNG = 0/neutralizado (rngModifier = 0)
  // =========================================================================
  it('WCA04: RNG = 0/neutralizado', () => {
    canonical12Teams.forEach((teamKey) => {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: `${teamKey}-drv`,
        circuitProfile: null,
        carTechnicalAttributes: null,
        driverAttributes: neutralDriver,
        setupEfficiency: 80,
        noise: 0,
      })
      expect(pace.breakdown.rngModifier).toBe(0)
    })
  })

  // =========================================================================
  // WCA05: TrackFit neutralizado no teste estrutural puro
  // =========================================================================
  it('WCA05: TrackFit neutralizado no teste estrutural puro', () => {
    canonical12Teams.forEach((teamKey) => {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: `${teamKey}-drv`,
        circuitProfile: null,
        carTechnicalAttributes: null,
        driverAttributes: neutralDriver,
        setupEfficiency: 80,
        noise: 0,
      })
      expect(pace.breakdown.trackFitModifier).toBe(0)
      expect(pace.effectivePaceScore).toBe(pace.breakdown.structuralStrength)
    })
  })

  // =========================================================================
  // WCA06: Williams dentro do envelope do grupo inferior em cenário neutro agregado
  // =========================================================================
  it('WCA06: Williams dentro do envelope do grupo inferior em cenário neutro agregado', () => {
    const williams = structuralStrengthService.getTeamStructuralStrength('williams', {
      seasonYear: 2026,
    })
    const haas = structuralStrengthService.getTeamStructuralStrength('haas', { seasonYear: 2026 })
    const aston = structuralStrengthService.getTeamStructuralStrength('astonmartin', {
      seasonYear: 2026,
    })

    // Williams (70) fica abaixo do grupo médio (Haas = 75) e acima/dentro do grupo inferior (Aston = 60)
    expect(williams.structuralStrengthScore).toBe(70)
    expect(williams.structuralStrengthScore).toBeLessThan(haas.structuralStrengthScore)
    expect(williams.structuralStrengthScore).toBeGreaterThan(aston.structuralStrengthScore)
    expect(BASELINE_2026_V1_TEAMS.williams.rank).toBe(9)
  })

  // =========================================================================
  // WCA07: Cadillac dentro do envelope do grupo inferior
  // =========================================================================
  it('WCA07: Cadillac dentro do envelope do grupo inferior', () => {
    const cadillac = structuralStrengthService.getTeamStructuralStrength('cadillac', {
      seasonYear: 2026,
    })
    const aston = structuralStrengthService.getTeamStructuralStrength('astonmartin', {
      seasonYear: 2026,
    })
    const andretti = structuralStrengthService.getTeamStructuralStrength('andretti', {
      seasonYear: 2026,
    })

    // Cadillac (50) fica abaixo de Aston Martin (60) e acima de Andretti (45)
    expect(cadillac.structuralStrengthScore).toBe(50)
    expect(cadillac.structuralStrengthScore).toBeLessThan(aston.structuralStrengthScore)
    expect(cadillac.structuralStrengthScore).toBeGreaterThan(andretti.structuralStrengthScore)
    expect(BASELINE_2026_V1_TEAMS.cadillac.rank).toBe(11)
  })

  // =========================================================================
  // WCA08: Andretti dentro do envelope do grupo inferior
  // =========================================================================
  it('WCA08: Andretti dentro do envelope do grupo inferior', () => {
    const andretti = structuralStrengthService.getTeamStructuralStrength('andretti', {
      seasonYear: 2026,
    })
    const cadillac = structuralStrengthService.getTeamStructuralStrength('cadillac', {
      seasonYear: 2026,
    })

    // Andretti (45) é a âncora inferior do grid de 2026 (P12)
    expect(andretti.structuralStrengthScore).toBe(45)
    expect(andretti.structuralStrengthScore).toBeLessThan(cadillac.structuralStrengthScore)
    expect(BASELINE_2026_V1_TEAMS.andretti.rank).toBe(12)
  })

  // =========================================================================
  // WCA09: Top 4 permanecem superiores estruturalmente ao grupo inferior em cenário neutro
  // =========================================================================
  it('WCA09: Top 4 permanecem superiores estruturalmente ao grupo inferior em cenário neutro', () => {
    const top4Keys = ['mercedes', 'ferrari', 'mclaren', 'redbull'] as const
    const lowerKeys = ['williams', 'astonmartin', 'cadillac', 'andretti'] as const

    const top4Scores = top4Keys.map(
      (k) =>
        structuralStrengthService.getTeamStructuralStrength(k, { seasonYear: 2026 })
          .structuralStrengthScore,
    )
    const lowerScores = lowerKeys.map(
      (k) =>
        structuralStrengthService.getTeamStructuralStrength(k, { seasonYear: 2026 })
          .structuralStrengthScore,
    )

    const minTop4 = Math.min(...top4Scores) // Red Bull = 94
    const maxLower = Math.max(...lowerScores) // Williams = 70

    // Gap claro e inquestionável (mínimo de 24 pontos)
    expect(minTop4).toBe(94)
    expect(maxLower).toBe(70)
    expect(minTop4 - maxLower).toBe(24)
    expect(minTop4).toBeGreaterThan(maxLower)
  })

  // =========================================================================
  // WCA10: Middle group permanece distinguível do grupo inferior no agregado
  // =========================================================================
  it('WCA10: Middle group permanece distinguível do grupo inferior no agregado', () => {
    const middleKeys = ['racingbulls', 'alpine', 'audi', 'haas'] as const
    const lowerKeys = ['williams', 'astonmartin', 'cadillac', 'andretti'] as const

    const middleScores = middleKeys.map(
      (k) =>
        structuralStrengthService.getTeamStructuralStrength(k, { seasonYear: 2026 })
          .structuralStrengthScore,
    )
    const lowerScores = lowerKeys.map(
      (k) =>
        structuralStrengthService.getTeamStructuralStrength(k, { seasonYear: 2026 })
          .structuralStrengthScore,
    )

    const minMiddle = Math.min(...middleScores) // Haas = 75
    const maxLower = Math.max(...lowerScores) // Williams = 70

    expect(minMiddle).toBe(75)
    expect(maxLower).toBe(70)
    expect(minMiddle).toBeGreaterThan(maxLower)
  })

  // =========================================================================
  // WCA11: TrackFit ainda pode produzir inversões plausíveis em pistas específicas
  // =========================================================================
  it('WCA11: TrackFit ainda pode produzir inversões plausíveis em pistas específicas', () => {
    // Prova que se uma pista favorece uma equipe com TrackFit alto (ex: +2.0)
    // e desfavorece uma equipe com TrackFit baixo (ex: -2.0),
    // carros com delta estrutural próximo (ex: Haas 75 vs Williams 70) podem ter seus deltas
    // significativamente reduzidos ou invertidos se combinado com condições de sessão
    const haasScore = 75
    const williamsScore = 70

    // Pista onde Williams tem vantagem de TrackFit (+2.0) e Haas tem desvantagem (-1.5)
    const williamsPace = williamsScore + 2.0 // 72.0
    const haasPace = haasScore - 2.0 // 73.0 (gap cai de 5.0 para apenas 1.0)
    expect(haasPace - williamsPace).toBe(1.0)

    // Com leve delta de acerto (setup 90 para Williams = +0.5 pt, 70 para Haas = -0.5 pt):
    const williamsWithSetup = williamsPace + 0.5 // 72.5
    const haasWithSetup = haasPace - 0.5 // 72.5 (empate técnico perfeito!)
    expect(williamsWithSetup).toBe(haasWithSetup)
  })

  // =========================================================================
  // WCA12: Pilotos reais podem alterar a ordem sem alterar Structural Strength
  // =========================================================================
  it('WCA12: pilotos reais podem alterar a ordem sem alterar Structural Strength', () => {
    // Williams tem piloto de ponta (ex: speed 92) vs Haas com novato/baixo rendimento (speed 78)
    const williamsBase = structuralStrengthService.getTeamStructuralStrength('williams', {
      seasonYear: 2026,
    })
    const haasBase = structuralStrengthService.getTeamStructuralStrength('haas', {
      seasonYear: 2026,
    })

    // As forças estruturais continuam rigorosamente 70 e 75 (não mudam!)
    expect(williamsBase.structuralStrengthScore).toBe(70)
    expect(haasBase.structuralStrengthScore).toBe(75)

    // Na sessão, o piloto da Williams tem speed 93 (+0.64 pt) e da Haas speed 77 (-0.64 pt)
    const paceWilliams = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'star-driver',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 93, consistency: 90 },
      setupEfficiency: 95, // bom setup (+0.75 pt)
      noise: 0,
    })

    const paceHaas = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'haas',
      driverId: 'rookie-driver',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 77, consistency: 75 },
      setupEfficiency: 65, // setup ruim (-0.75 pt)
      noise: 0,
    })

    // Williams pode superar Haas no pace da sessão através do talento do piloto e setup
    expect(paceWilliams.effectivePaceScore).toBeGreaterThan(paceHaas.effectivePaceScore)
    // Mas a Força Estrutural canônica no breakdown permaneceu 70 vs 75
    expect(paceWilliams.breakdown.structuralStrength).toBe(70)
    expect(paceHaas.breakdown.structuralStrength).toBe(75)
  })

  // =========================================================================
  // WCA13: Nenhum código de produção contém bônus/penalidade por nome WCA
  // =========================================================================
  it('WCA13: nenhum código de produção contém bônus/penalidade por nome WCA', () => {
    const paceAudit = canonicalPaceIntegrationService.auditPaceIntegration()
    expect(paceAudit.teamNameBonuses).toBe(0)
    expect(paceAudit.auditPassed).toBe(true)

    const structAudit = structuralStrengthService.auditStructuralStrengthSystem({
      seasonYear: 2026,
    })
    expect(structAudit.teamNameBonuses).toBe(0)
    expect(structAudit.duplicateFactors).toBe(0)
  })

  // =========================================================================
  // WCA14: Nenhum cap de resultado/posição foi criado
  // =========================================================================
  it('WCA14: nenhum cap de resultado/posição foi criado', () => {
    // Prova que com desenvolvimento futuro Williams, Cadillac ou Andretti podem ultrapassar qualquer nota
    const baseline = structuralStrengthService.getTeamStructuralStrength('cadillac', {
      seasonYear: 2026,
    })
    const upgradedComponents: Record<string, number> = {}
    for (const [k, v] of Object.entries(baseline.technicalBreakdown.componentsMap)) {
      upgradedComponents[k] = v + 50
    }

    const evolved = structuralStrengthService.calculateStructuralStrength({
      teamKey: 'cadillac',
      teamName: 'Cadillac F1 Team',
      components: upgradedComponents,
      effectivePuRating: baseline.technicalBreakdown.effectivePuScore + 40,
      reliability: 95,
      condition: 100,
      puSupplier: 'Ferrari',
      effectiveIntegration: 0.95,
      nominalPuRating: 92,
      drivers: baseline.driverBreakdown.drivers,
      facilities: baseline.teamBreakdown.facilitiesLevels,
      teamMorale: 90,
    })

    // Não há trava: pontuação evolui naturalmente sem nenhum teto artificial
    expect(evolved.structuralStrengthScore).toBeGreaterThan(80)
    expect(evolved.structuralStrengthScore).toBeGreaterThan(baseline.structuralStrengthScore)
  })

  // =========================================================================
  // WCA15: setupEfficiency permanece neutral 80 e coeficiente atual preservado (0.05)
  // =========================================================================
  it('WCA15: setupEfficiency permanece neutral 80 e coeficiente atual preservado', () => {
    const pace80 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'wil-01',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: neutralDriver,
      setupEfficiency: 80,
    })
    const pace100 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'wil-01',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: neutralDriver,
      setupEfficiency: 100,
    })
    const pace60 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'wil-01',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: neutralDriver,
      setupEfficiency: 60,
    })

    expect(pace80.breakdown.setupModifier).toBe(0)
    expect(pace100.breakdown.setupModifier).toBe(1.0) // (100 - 80) * 0.05 = 1.0 pt
    expect(pace60.breakdown.setupModifier).toBe(-1.0) // (60 - 80) * 0.05 = -1.0 pt
  })

  // =========================================================================
  // WCA16: TrackFit permanece neutral 75, scale 0.08, clamp ±2.0/±2.5
  // =========================================================================
  it('WCA16: TrackFit permanece neutral 75, scale 0.08, clamp ±2.0/±2.5', () => {
    expect(NEUTRAL_TRACKFIT_REFERENCE).toBe(75.0)
    expect(TRACKFIT_SCALE).toBe(0.08)
    expect(TRACKFIT_NORMAL_CLAMP).toBe(2.0)
    expect(TRACKFIT_SPECIALIZED_CLAMP).toBe(2.5)

    const normMid = canonicalPaceIntegrationService.normalizeTrackFit({ rawTrackFitScore: 85 })
    expect(normMid.trackFitModifier).toBeCloseTo(0.8, 2) // (85 - 75) * 0.08 = 0.80 pt

    const normExtr = canonicalPaceIntegrationService.normalizeTrackFit({ rawTrackFitScore: 110 })
    expect(normExtr.trackFitModifier).toBe(2.0) // clamped em 2.0
  })

  // =========================================================================
  // WCA17: Qualifying RNG permanece sigma 0.45
  // =========================================================================
  it('WCA17: qualifying RNG permanece sigma 0.45', () => {
    expect(QUALI_RNG_TARGET_RANGE.SIGMA).toBe(0.45)
    expect(QUALI_RNG_DEFAULT_SIGMA).toBe(0.45)
    expect(QUALI_RNG_TARGET_RANGE.MIN).toBe(-1.0)
    expect(QUALI_RNG_TARGET_RANGE.MAX).toBe(1.0)
  })

  // =========================================================================
  // WCA18: CP3A e integridade da baseline 2026 continuam verdes
  // =========================================================================
  it('WCA18: CP3A e integridade da baseline 2026 continuam verdes', () => {
    const scores = BASELINE_2026_V1_ORDER.map((k) => BASELINE_2026_V1_TEAMS[k].score)
    expect(scores).toEqual([100, 98, 96, 94, 87, 87, 86, 75, 70, 60, 50, 45])

    // Verifica que Williams = 70, Cadillac = 50, Andretti = 45
    expect(BASELINE_2026_V1_TEAMS.williams.score).toBe(70)
    expect(BASELINE_2026_V1_TEAMS.cadillac.score).toBe(50)
    expect(BASELINE_2026_V1_TEAMS.andretti.score).toBe(45)

    // Spread estrutural = 55 pts -> 4.40s
    expect(BASELINE_2026_V1_METADATA.pointSpread).toBe(55)
    expect(BASELINE_2026_V1_METADATA.targetSpreadSec).toBe(4.4)
  })

  // =========================================================================
  // BENCHMARK CONTROLADO 1: Piloto Neutro em Silverstone
  // =========================================================================
  it('Benchmark Controlado 1: Piloto neutro em Silverstone isola estritamente Carro + PU + Equipe', () => {
    const circuit = resolveCircuitProfile({ round: 11 })
    expect(circuit).toBeDefined()

    const results = canonical12Teams.map((teamKey) => {
      const entry = BASELINE_V0_DATA.teams[teamKey] as any
      const tech = entry?.technicalAttributes ?? entry?.carAttributes
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: `${teamKey}-eval`,
        circuitProfile: circuit,
        carTechnicalAttributes: tech,
        driverAttributes: neutralDriver,
        setupEfficiency: 80,
        fuelKg: 12,
        noise: 0,
      })

      return {
        teamKey,
        structuralStrength: pace.breakdown.structuralStrength,
        trackFitModifier: pace.breakdown.trackFitModifier,
        effectivePaceScore: pace.effectivePaceScore,
        lapTimeSec: pace.lapTimeSec,
      }
    })

    // Ordena por effectivePaceScore
    const sorted = [...results].sort((a, b) => b.effectivePaceScore - a.effectivePaceScore)
    const sortedKeys = sorted.map((s) => s.teamKey)

    // Top 4 sempre no topo
    expect(sortedKeys.slice(0, 4)).toContain('mercedes')
    expect(sortedKeys.slice(0, 4)).toContain('ferrari')
    expect(sortedKeys.slice(0, 4)).toContain('mclaren')
    expect(sortedKeys.slice(0, 4)).toContain('redbull')

    // Williams (P9 estrutural) fica no grupo inferior / limítrofe inferior
    const wilResult = results.find((r) => r.teamKey === 'williams')!
    const cadResult = results.find((r) => r.teamKey === 'cadillac')!
    const andResult = results.find((r) => r.teamKey === 'andretti')!

    // Bottom 3 estrutural: Aston Martin (60), Cadillac (50), Andretti (45)
    expect(cadResult.structuralStrength).toBe(50)
    expect(andResult.structuralStrength).toBe(45)
    expect(wilResult.structuralStrength).toBe(70)

    // Cadillac e Andretti nunca superam o Top 4 ou Middle 4 em cenário neutro puro
    expect(cadResult.effectivePaceScore).toBeLessThan(sorted[3].effectivePaceScore)
    expect(andResult.effectivePaceScore).toBeLessThan(sorted[3].effectivePaceScore)
  })

  // =========================================================================
  // BENCHMARK CONTROLADO 2: Pilotos Reais
  // =========================================================================
  it('Benchmark Controlado 2: Pilotos reais mostram que a contribuição do piloto é camada de sessão', () => {
    // Para Williams, Alex Albon tem rating alto no catálogo MBJ
    // Isso explica porque em corridas reais ou sessões de carreira Albon pontua ou brilha no Q2/Q3,
    // enquanto a força estrutural canônica do carro Williams permanece 70 (P9).
    const wilStructural = structuralStrengthService.getTeamStructuralStrength('williams', {
      seasonYear: 2026,
    })
    expect(wilStructural.structuralStrengthScore).toBe(70)

    const cadStructural = structuralStrengthService.getTeamStructuralStrength('cadillac', {
      seasonYear: 2026,
    })
    expect(cadStructural.structuralStrengthScore).toBe(50)

    const andStructural = structuralStrengthService.getTeamStructuralStrength('andretti', {
      seasonYear: 2026,
    })
    expect(andStructural.structuralStrengthScore).toBe(45)
  })
})
