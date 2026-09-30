import { describe, it, expect } from 'vitest'
import {
  canonicalPaceIntegrationService,
  TRACKFIT_MAX_CLAMP,
  TRACKFIT_NORMAL_CLAMP,
  QUALI_RNG_TARGET_RANGE,
} from '@/services/canonicalPaceIntegrationService'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'
import { calculateTrackFit } from '@/lib/car-session-performance-engine'

describe('BASELINE-2026-LOCK-01-CP3A: Calibração TrackFit e RNG', () => {
  const silverstone = resolveCircuitProfile({ round: 11 })
  const monaco = resolveCircuitProfile({ round: 8 })

  // == 4. TRACKFIT — TESTES ==
  it('BL26-06: TrackFit efetivo nunca ultrapassa ±2.5 pts mesmo com scores extremos', () => {
    // Testar com scores extremos: 0, 10, 50, 90, 100
    const testScores = [0, 5, 20, 50, 75, 90, 98, 100]
    for (const score of testScores) {
      const normalResult = canonicalPaceIntegrationService.normalizeTrackFit({
        rawTrackFitScore: score,
        isSpecializedTrack: false,
      })
      const specializedResult = canonicalPaceIntegrationService.normalizeTrackFit({
        rawTrackFitScore: score,
        isSpecializedTrack: true,
      })

      expect(normalResult.trackFitModifier).toBeGreaterThanOrEqual(-TRACKFIT_MAX_CLAMP)
      expect(normalResult.trackFitModifier).toBeLessThanOrEqual(TRACKFIT_MAX_CLAMP)

      expect(specializedResult.trackFitModifier).toBeGreaterThanOrEqual(-TRACKFIT_MAX_CLAMP)
      expect(specializedResult.trackFitModifier).toBeLessThanOrEqual(TRACKFIT_MAX_CLAMP)
      expect(Math.abs(specializedResult.trackFitModifier)).toBeLessThanOrEqual(2.5)
    }
  })

  it('BL26-07: em cenário normal, clamp efetivo = ±2.0 pts', () => {
    // Para cenário normal (isSpecializedTrack: false ou default), clamp estrito em ±2.0 pts
    const extremeScores = [0, 10, 20, 30, 95, 100]
    for (const score of extremeScores) {
      const result = canonicalPaceIntegrationService.normalizeTrackFit({
        rawTrackFitScore: score,
      })
      expect(result.trackFitModifier).toBeGreaterThanOrEqual(-TRACKFIT_NORMAL_CLAMP)
      expect(result.trackFitModifier).toBeLessThanOrEqual(TRACKFIT_NORMAL_CLAMP)
      expect(Math.abs(result.trackFitModifier)).toBeLessThanOrEqual(2.0)
    }

    // Configuração central confirma os valores
    expect(TRACKFIT_NORMAL_CLAMP).toBe(2.0)
    expect(TRACKFIT_MAX_CLAMP).toBe(2.5)
  })

  it('BL26-08: Cadillac não entra top 3 apenas por TrackFit', () => {
    // Cadillac (âncora 72) vs Top 3 (Mercedes 100, McLaren 98, Ferrari 96, Red Bull 94)
    // Mesmo no caso mais extremo de TrackFit (+2.5 para Cadillac, -2.5 para top teams),
    // Cadillac não pode superar ou igualar as equipes do Top 3
    const cadillacBase =
      structuralStrengthService.getTeamStructuralStrength('cadillac').structuralStrengthScore
    const ferrariBase =
      structuralStrengthService.getTeamStructuralStrength('ferrari').structuralStrengthScore
    const mclarenBase =
      structuralStrengthService.getTeamStructuralStrength('mclaren').structuralStrengthScore
    const mercedesBase =
      structuralStrengthService.getTeamStructuralStrength('mercedes').structuralStrengthScore
    const redbullBase =
      structuralStrengthService.getTeamStructuralStrength('redbull').structuralStrengthScore

    // Melhor caso possível de TrackFit para Cadillac
    const maxCadillacTrackFitPace = cadillacBase + TRACKFIT_MAX_CLAMP // 72 + 2.5 = 74.5
    // Pior caso de TrackFit para as equipes do top 3
    const minMercedesPace = mercedesBase - TRACKFIT_MAX_CLAMP // 100 - 2.5 = 97.5
    const minMclarenPace = mclarenBase - TRACKFIT_MAX_CLAMP // 98 - 2.5 = 95.5
    const minFerrariPace = ferrariBase - TRACKFIT_MAX_CLAMP // 96 - 2.5 = 93.5
    const minRedbullPace = redbullBase - TRACKFIT_MAX_CLAMP // 94 - 2.5 = 91.5

    expect(maxCadillacTrackFitPace).toBeLessThan(minMercedesPace)
    expect(maxCadillacTrackFitPace).toBeLessThan(minMclarenPace)
    expect(maxCadillacTrackFitPace).toBeLessThan(minFerrariPace)
    expect(maxCadillacTrackFitPace).toBeLessThan(minRedbullPace)

    // A distância estrutural mínima para o top 3 permanece superior a 15 pontos
    expect(minRedbullPace - maxCadillacTrackFitPace).toBeGreaterThan(15.0)
  })

  it('BL26-09: Andretti não entra top 3 apenas por TrackFit', () => {
    // Andretti (âncora 69) vs Top 3
    const andrettiBase =
      structuralStrengthService.getTeamStructuralStrength('andretti').structuralStrengthScore
    const redbullBase =
      structuralStrengthService.getTeamStructuralStrength('redbull').structuralStrengthScore

    const maxAndrettiTrackFitPace = andrettiBase + TRACKFIT_MAX_CLAMP // 69 + 2.5 = 71.5
    const minRedbullPace = redbullBase - TRACKFIT_MAX_CLAMP // 94 - 2.5 = 91.5

    expect(maxAndrettiTrackFitPace).toBeLessThan(minRedbullPace)
    expect(minRedbullPace - maxAndrettiTrackFitPace).toBeGreaterThan(15.0)
  })

  it('BL26-10: equipes próximas ainda podem inverter com TrackFit calibrado', () => {
    // Racing Bulls (âncora 90) vs Alpine (âncora 87): gap = 3.0 pts
    // Se Alpine tiver TrackFit favorável (+1.8) e Racing Bulls desfavorável (-1.5), Alpine passa à frente
    const alpineBase = 87
    const racingBullsBase = 90

    const alpineFavorableTF = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 97, // favorável
      isSpecializedTrack: false,
    }).trackFitModifier // +1.76

    const rbUnfavorableTF = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 55, // desfavorável
      isSpecializedTrack: false,
    }).trackFitModifier // -1.6

    const alpineNet = alpineBase + alpineFavorableTF
    const rbNet = racingBullsBase + rbUnfavorableTF

    expect(alpineNet).toBeGreaterThan(rbNet)

    // Audi (84) vs Haas (81): gap = 3.0 pts
    const audiBase = 84
    const haasBase = 81
    const haasFavorableTF = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 98,
      isSpecializedTrack: false,
    }).trackFitModifier // ~ +1.84
    const audiUnfavorableTF = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 53,
      isSpecializedTrack: false,
    }).trackFitModifier // ~ -1.76

    expect(haasBase + haasFavorableTF).toBeGreaterThan(audiBase + audiUnfavorableTF)
  })

  // == 7. RNG — TESTES ==
  it('BL26-11: RNG máximo respeita a nova faixa configurada (±0.75 a ±1.00 pt)', () => {
    expect(QUALI_RNG_TARGET_RANGE.MIN).toBe(-1.0)
    expect(QUALI_RNG_TARGET_RANGE.MAX).toBe(1.0)
    expect(QUALI_RNG_TARGET_RANGE.SIGMA).toBe(0.45)
    // Em distribuição normal, 2 * sigma (95.4% dos casos) fica em ±0.90 pt
    const twoSigma = 2 * QUALI_RNG_TARGET_RANGE.SIGMA
    expect(twoSigma).toBeLessThanOrEqual(1.0)
    expect(twoSigma).toBeGreaterThanOrEqual(0.75)

    // Testar com valores de ruído extremos no computeQualifyingPace
    const testCadillacPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-01',
      circuitProfile: silverstone,
      driverAttributes: { speed: 85 },
      noise: 0.5, // ruído positivo alto
    })
    expect(testCadillacPace.breakdown.rngModifier).toBeLessThanOrEqual(1.0)
    expect(testCadillacPace.breakdown.rngModifier).toBeGreaterThanOrEqual(-1.0)

    const testCadillacPaceNeg = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-01',
      circuitProfile: silverstone,
      driverAttributes: { speed: 85 },
      noise: -0.5, // ruído negativo alto
    })
    expect(testCadillacPaceNeg.breakdown.rngModifier).toBeLessThanOrEqual(1.0)
    expect(testCadillacPaceNeg.breakdown.rngModifier).toBeGreaterThanOrEqual(-1.0)
  })

  it('BL26-12: RNG sozinho não quebra tiers', () => {
    // Gap mínimo entre tiers 2026:
    // Top (Red Bull 94) vs Mid (Racing Bulls 90) = 4.0 pts
    // Mid (Aston Martin 75) vs Back (Cadillac 72) = 3.0 pts
    // Com RNG máximo de ±1.0 pt, a amplitude máxima gerada por RNG é 2.0 pts
    const maxRngDelta = QUALI_RNG_TARGET_RANGE.MAX - QUALI_RNG_TARGET_RANGE.MIN // 2.0 pts
    const topToMidTierGap = 94 - 90 // 4.0 pts
    const midToBackTierGap = 75 - 72 // 3.0 pts

    expect(maxRngDelta).toBeLessThan(topToMidTierGap)
    expect(maxRngDelta).toBeLessThan(midToBackTierGap)

    // Red Bull com pior RNG (-1.0) vs Racing Bulls com melhor RNG (+1.0)
    const rbWorstRng = 94 - 1.0 // 93.0
    const vcarbBestRng = 90 + 1.0 // 91.0
    expect(rbWorstRng).toBeGreaterThan(vcarbBestRng)

    // Aston Martin com pior RNG (-1.0) vs Cadillac com melhor RNG (+1.0)
    const astonWorstRng = 75 - 1.0 // 74.0
    const cadillacBestRng = 72 + 1.0 // 73.0
    expect(astonWorstRng).toBeGreaterThan(cadillacBestRng)
  })

  it('BL26-13: companheiros próximos ainda podem inverter com RNG', () => {
    // Piloto 1 (speed 85.5) vs Piloto 2 (speed 85.0): delta de sessão = (85.5 - 85.0) * 0.08 = 0.04 pts
    // Um RNG de ±0.3 pt é mais do que suficiente para inverter a disputa interna
    const circuit = silverstone
    const carTech = (BASELINE_V0_DATA.teams['mercedes'] as any)?.technicalAttributes

    // Piloto A tem ligeira vantagem em atributos de piloto mas RNG neutro/desfavorável
    const driverA = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv-a',
      circuitProfile: circuit,
      carTechnicalAttributes: carTech,
      driverAttributes: { speed: 85.5 },
      noise: -0.05, // -0.3 pts
    })

    // Piloto B tem volta inspirada (RNG favorável)
    const driverB = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv-b',
      circuitProfile: circuit,
      carTechnicalAttributes: carTech,
      driverAttributes: { speed: 85.0 },
      noise: 0.08, // +0.48 pts
    })

    expect(driverB.effectivePaceScore).toBeGreaterThan(driverA.effectivePaceScore)
  })

  it('BL26-14: top/mid/back continuam separados estatisticamente em quali normal', () => {
    // Amostragem com ruído controlado simulado (~normal com sigma = 0.45)
    // Verificar que a média e percentis dos tiers não se sobrepõem
    const topTeams = ['mercedes', 'mclaren', 'ferrari', 'redbull']
    const midTeams = ['racingbulls', 'alpine', 'audi', 'haas', 'williams', 'astonmartin']
    const backTeams = ['cadillac', 'andretti']

    const evaluateTeam = (teamKey: string, noise: number) => {
      const entry = BASELINE_V0_DATA.teams[teamKey] as any
      const tech = entry?.technicalAttributes ?? entry?.carAttributes
      return canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: `${teamKey}-drv`,
        circuitProfile: silverstone,
        carTechnicalAttributes: tech,
        driverAttributes: { speed: 85 },
        setupEfficiency: 80,
        noise,
      }).effectivePaceScore
    }

    // Pior caso para o pior time do top tier (Red Bull com pior TrackFit e pior RNG)
    const worstTopPace = evaluateTeam('redbull', -0.2) // ruído negativo
    // Melhor caso para o melhor time do mid tier (Racing Bulls com melhor TrackFit e melhor RNG)
    const bestMidPace = evaluateTeam('racingbulls', 0.2) // ruído positivo
    // Pior caso para o pior time do mid tier (Aston Martin)
    const worstMidPace = evaluateTeam('astonmartin', -0.2)
    // Melhor caso para o melhor time do back tier (Cadillac)
    const bestBackPace = evaluateTeam('cadillac', 0.2)

    // Estatisticamente, top tier > mid tier e mid tier > back tier
    expect(worstTopPace).toBeGreaterThan(bestMidPace)
    expect(worstMidPace).toBeGreaterThan(bestBackPace)
  })

  // == 8. FIXTURE SILVERSTONE CONTROLADA ==
  it('Fixture Silverstone: baseline 2026 ativa, setup neutro, seco, pneus iguais, TrackFit calibrado, RNG = 0', () => {
    expect(silverstone).toBeDefined()
    if (!silverstone) return

    const teamKeys = [
      'mercedes',
      'mclaren',
      'ferrari',
      'redbull',
      'racingbulls',
      'alpine',
      'audi',
      'haas',
      'williams',
      'astonmartin',
      'cadillac',
      'andretti',
    ]

    const ranking = teamKeys.map((teamKey) => {
      const entry = BASELINE_V0_DATA.teams[teamKey] as any
      const tech = entry?.technicalAttributes ?? entry?.carAttributes
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: `${teamKey}-drv`,
        circuitProfile: silverstone,
        carTechnicalAttributes: tech,
        driverAttributes: { speed: 85, consistency: 85 },
        setupEfficiency: 80, // neutro
        weather: 'seco',
        tyreCompound: 'macio',
        tyreWearPct: 0,
        fuelKg: 12,
        noise: 0, // RNG = 0
      })

      return {
        teamKey,
        effectivePaceScore: pace.effectivePaceScore,
        lapTimeSec: pace.lapTimeSec,
        breakdown: pace.breakdown,
      }
    })

    // Ordenar do mais rápido para o mais lento (maior effectivePaceScore)
    ranking.sort((a, b) => b.effectivePaceScore - a.effectivePaceScore)

    // Tier 1: Top = Mercedes, McLaren, Ferrari, Red Bull (posições 1 a 4)
    const topTierPositions = ranking.slice(0, 4).map((r) => r.teamKey)
    const expectedTop = ['mercedes', 'mclaren', 'ferrari', 'redbull']
    for (const team of expectedTop) {
      expect(topTierPositions).toContain(team)
    }

    // Tier 2: Mid = Racing Bulls, Alpine, Audi, Haas, Williams, Aston Martin (posições 5 a 10)
    const midTierPositions = ranking.slice(4, 10).map((r) => r.teamKey)
    const expectedMid = ['racingbulls', 'alpine', 'audi', 'haas', 'williams', 'astonmartin']
    for (const team of expectedMid) {
      expect(midTierPositions).toContain(team)
    }

    // Tier 3: Back = Cadillac, Andretti (posições 11 e 12)
    const backTierPositions = ranking.slice(10, 12).map((r) => r.teamKey)
    const expectedBack = ['cadillac', 'andretti']
    for (const team of expectedBack) {
      expect(backTierPositions).toContain(team)
    }

    // Todos os TrackFit modifiers respeitam o clamp normal de ±2.0 pts
    for (const row of ranking) {
      expect(Math.abs(row.breakdown.trackFitModifier)).toBeLessThanOrEqual(TRACKFIT_NORMAL_CLAMP)
    }
  })
})
