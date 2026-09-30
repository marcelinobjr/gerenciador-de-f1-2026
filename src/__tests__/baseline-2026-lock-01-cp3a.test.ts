import { describe, it, expect } from 'vitest'
import {
  canonicalPaceIntegrationService,
  TRACKFIT_MAX_CLAMP,
  TRACKFIT_NORMAL_CLAMP,
  TRACKFIT_SPECIALIZED_CLAMP,
  NEUTRAL_TRACKFIT_REFERENCE,
  QUALI_RNG_TARGET_RANGE,
  QUALI_RNG_DEFAULT_SIGMA,
  sampleGaussianRng,
  createMulberry32,
  hashStringToSeed,
} from '@/services/canonicalPaceIntegrationService'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'
import { BASELINE_2026_V1_ORDER } from '@/data/baseline-2026-v1'

describe('BASELINE-2026-LOCK-01-CP3A — Suíte Canônica BL26-06..14 (TrackFit & RNG)', () => {
  const silverstone = resolveCircuitProfile({ round: 11 })

  // =========================================================================
  // BL26-06: Clamp normal — TrackFit nunca ultrapassa +2.0 / -2.0 em cenário padrão
  // =========================================================================
  it('BL26-06: Clamp normal — TrackFit nunca ultrapassa +2.0 / -2.0 em cenário padrão', () => {
    expect(TRACKFIT_NORMAL_CLAMP).toBe(2.0)

    // Testar com ampla gama de scores: extremos (0, 100), moderados (30, 75, 95), limítrofes
    const testScores = [0, 5, 10, 25, 40, 50, 75, 85, 90, 95, 99, 100]
    for (const score of testScores) {
      const normalResult = canonicalPaceIntegrationService.normalizeTrackFit({
        rawTrackFitScore: score,
        isSpecializedTrack: false,
        hasSpecialization: false,
      })

      expect(normalResult.trackFitModifier).toBeGreaterThanOrEqual(-TRACKFIT_NORMAL_CLAMP)
      expect(normalResult.trackFitModifier).toBeLessThanOrEqual(TRACKFIT_NORMAL_CLAMP)
      expect(Math.abs(normalResult.trackFitModifier)).toBeLessThanOrEqual(2.0)
    }

    // Com score 0 (máxima desvantagem normal): clamp em -2.0 exatamente
    const minNormal = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 0,
      isSpecializedTrack: false,
    })
    expect(minNormal.trackFitModifier).toBe(-2.0)
    expect(minNormal.isClamped).toBe(true)

    // Com score 100 (máxima vantagem normal): clamp em +2.0 exatamente
    const maxNormal = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 100,
      isSpecializedTrack: false,
    })
    expect(maxNormal.trackFitModifier).toBe(2.0)
    expect(maxNormal.isClamped).toBe(true)
  })

  // =========================================================================
  // BL26-07: Clamp especializado — TrackFit especializado nunca ultrapassa +2.5 / -2.5
  // =========================================================================
  it('BL26-07: Clamp especializado — TrackFit especializado nunca ultrapassa +2.5 / -2.5', () => {
    expect(TRACKFIT_SPECIALIZED_CLAMP).toBe(2.5)
    expect(TRACKFIT_MAX_CLAMP).toBe(2.5)

    const testScores = [0, 5, 10, 20, 50, 75, 90, 98, 100]
    for (const score of testScores) {
      // Especialização via pista
      const specTrackResult = canonicalPaceIntegrationService.normalizeTrackFit({
        rawTrackFitScore: score,
        isSpecializedTrack: true,
      })
      // Especialização via equipe/piloto
      const specTeamResult = canonicalPaceIntegrationService.normalizeTrackFit({
        rawTrackFitScore: score,
        hasSpecialization: true,
      })

      for (const res of [specTrackResult, specTeamResult]) {
        expect(res.trackFitModifier).toBeGreaterThanOrEqual(-TRACKFIT_SPECIALIZED_CLAMP)
        expect(res.trackFitModifier).toBeLessThanOrEqual(TRACKFIT_SPECIALIZED_CLAMP)
        expect(Math.abs(res.trackFitModifier)).toBeLessThanOrEqual(2.5)
      }
    }

    // Com score 0 (máxima desvantagem especializada): clamp em -2.5 exatamente
    const minSpec = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 0,
      isSpecializedTrack: true,
    })
    expect(minSpec.trackFitModifier).toBe(-2.5)
    expect(minSpec.isClamped).toBe(true)

    // Com score 100 (máxima vantagem especializada): clamp em +2.5 exatamente
    const maxSpec = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 100,
      hasSpecialization: true,
    })
    expect(maxSpec.trackFitModifier).toBe(2.5)
    expect(maxSpec.isClamped).toBe(true)
  })

  // =========================================================================
  // BL26-08: Sinal — vantagem e desvantagem de pista preservam corretamente o sinal
  // =========================================================================
  it('BL26-08: Sinal — vantagem e desvantagem de pista preservam corretamente o sinal', () => {
    expect(NEUTRAL_TRACKFIT_REFERENCE).toBe(75.0)

    // Score acima da referência neutra (> 75) DEVE gerar modificador estritamente POSITIVO
    const scoresAbove = [76, 80, 85, 90, 95, 100]
    for (const score of scoresAbove) {
      const res = canonicalPaceIntegrationService.normalizeTrackFit({
        rawTrackFitScore: score,
      })
      expect(res.trackFitModifier).toBeGreaterThan(0)
    }

    // Score abaixo da referência neutra (< 75) DEVE gerar modificador estritamente NEGATIVO
    const scoresBelow = [0, 10, 50, 60, 70, 74]
    for (const score of scoresBelow) {
      const res = canonicalPaceIntegrationService.normalizeTrackFit({
        rawTrackFitScore: score,
      })
      expect(res.trackFitModifier).toBeLessThan(0)
    }

    // Linearidade exata antes do clamp: (score - 75) * 0.08
    const midAbove = canonicalPaceIntegrationService.normalizeTrackFit({ rawTrackFitScore: 85 })
    expect(midAbove.trackFitModifier).toBeCloseTo((85 - 75) * 0.08, 3) // +0.800

    const midBelow = canonicalPaceIntegrationService.normalizeTrackFit({ rawTrackFitScore: 65 })
    expect(midBelow.trackFitModifier).toBeCloseTo((65 - 75) * 0.08, 3) // -0.800

    // Simetria de sinal para deltas iguais
    expect(midAbove.trackFitModifier).toBe(-midBelow.trackFitModifier)
  })

  // =========================================================================
  // BL26-09: Aplicação única — TrackFit não pode entrar duas vezes no cálculo final
  // =========================================================================
  it('BL26-09: Aplicação única — TrackFit não pode entrar duas vezes no cálculo final', () => {
    // 1. Verificar a auditoria canônica de integrações
    const auditRes = canonicalPaceIntegrationService.auditPaceIntegration()
    expect(auditRes.auditPassed).toBe(true)
    expect(auditRes.legacyTrackFitWeight45).toBe(false)
    expect(auditRes.duplicateDriverApplication).toBe(0)
    expect(auditRes.duplicatePUApplication).toBe(0)
    expect(auditRes.duplicateWearApplication).toBe(0)
    expect(auditRes.teamNameBonuses).toBe(0)

    // 2. Verificar matematicamente na decomposição do computeQualifyingPace
    const carTech = (BASELINE_V0_DATA.teams['mercedes'] as any)?.technicalAttributes
    const result = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: silverstone,
      carTechnicalAttributes: carTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 80,
      tyreCompound: 'macio',
      fuelKg: 12,
      noise: 0,
    })

    const b = result.breakdown
    // A soma exata de todos os termos com trackFitModifier aparecendo EXATAMENTE 1x
    // deve ser igual a finalPace (effectivePaceScore).
    const singleApplicationSum = Number(
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

    expect(result.effectivePaceScore).toBe(singleApplicationSum)
    expect(b.finalPace).toBe(singleApplicationSum)

    // Se TrackFit entrasse uma segunda vez, haveria discrepância de b.trackFitModifier
    if (b.trackFitModifier !== 0) {
      const doubleApplicationSum = Number((singleApplicationSum + b.trackFitModifier).toFixed(2))
      expect(result.effectivePaceScore).not.toBe(doubleApplicationSum)
    }

    // 3. Provar que a base estrutural pura NÃO contém TrackFit embutido
    const structuralOnly = canonicalPaceIntegrationService.resolveBaseStructuralStrength('mercedes')
    expect(b.structuralStrength).toBe(structuralOnly)
  })

  // =========================================================================
  // BL26-10: Neutralidade — TrackFit zero não altera o pace estrutural
  // =========================================================================
  it('BL26-10: Neutralidade — TrackFit zero não altera o pace estrutural', () => {
    // Quando rawTrackFitScore == 75.0 (ou modificador = 0), TrackFit não altera o pace estrutural
    const neutralTF = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 75.0,
      referenceTrackFit: 75.0,
    })
    expect(neutralTF.trackFitModifier).toBe(0.0)

    // Avaliar para todas as 12 equipes 2026 em condição neutra (setup 80, pneus macios, combustível 12kg, RNG 0)
    // Sem passar circuitProfile / carTechnicalAttributes (trackFitModifier = 0)
    for (const teamKey of BASELINE_2026_V1_ORDER) {
      const paceWithoutTF = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: `${teamKey}-drv`,
        circuitProfile: null,
        carTechnicalAttributes: null,
        driverAttributes: { speed: 85 },
        setupEfficiency: 80,
        fuelKg: 12,
        noise: 0,
      })

      expect(paceWithoutTF.breakdown.trackFitModifier).toBe(0)
      // Com todos os fatores neutros, o pace final é exatamente a força estrutural
      expect(paceWithoutTF.effectivePaceScore).toBe(paceWithoutTF.breakdown.structuralStrength)
    }
  })

  // =========================================================================
  // BL26-11: Fixture Silverstone — isolamento puro de pace estrutural + TrackFit (RNG=0)
  // =========================================================================
  it('BL26-11: Fixture Silverstone — isolamento puro de pace estrutural + TrackFit (RNG=0)', () => {
    expect(silverstone).toBeDefined()
    if (!silverstone) return

    // Condições: Silverstone; pista seca; setup neutro (80); pneus equivalentes (macio 0%);
    // mesma condição operacional (fuel 12kg); RNG = 0; nenhum incidente; nenhuma penalidade.
    const fixtureResults = BASELINE_2026_V1_ORDER.map((teamKey) => {
      const entry = BASELINE_V0_DATA.teams[teamKey] as any
      const tech = entry?.technicalAttributes ?? entry?.carAttributes
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: `${teamKey}-drv`,
        circuitProfile: silverstone,
        carTechnicalAttributes: tech,
        driverAttributes: { speed: 85, consistency: 85, morale: 80 },
        setupEfficiency: 80,
        weather: 'seco',
        tyreCompound: 'macio',
        tyreWearPct: 0,
        fuelKg: 12,
        puWearPct: 0,
        noise: 0, // RNG = 0 rigoroso
      })

      return {
        teamKey,
        structuralStrength: pace.breakdown.structuralStrength,
        trackFitModifier: pace.breakdown.trackFitModifier,
        effectivePaceScore: pace.effectivePaceScore,
        lapTimeSec: pace.lapTimeSec,
        breakdown: pace.breakdown,
      }
    })

    // 1. Cada pace reflete estritamente: StructuralStrength + TrackFitModifier
    for (const r of fixtureResults) {
      const expected = Number((r.structuralStrength + r.trackFitModifier).toFixed(2))
      expect(r.effectivePaceScore).toBe(expected)
      expect(r.breakdown.rngModifier).toBe(0)
      expect(r.breakdown.setupModifier).toBe(0)
      expect(r.breakdown.driverEventModifier).toBe(0)
      expect(r.breakdown.weatherModifier).toBe(0)
      expect(r.breakdown.wearModifier).toBe(0)
      expect(Math.abs(r.trackFitModifier)).toBeLessThanOrEqual(TRACKFIT_NORMAL_CLAMP)
    }

    // 2. Ordenar por effectivePaceScore
    const sorted = [...fixtureResults].sort((a, b) => b.effectivePaceScore - a.effectivePaceScore)

    // Top tier: Mercedes, McLaren, Ferrari, Red Bull (1 a 4)
    const top4 = sorted.slice(0, 4).map((s) => s.teamKey)
    expect(top4).toContain('mercedes')
    expect(top4).toContain('mclaren')
    expect(top4).toContain('ferrari')
    expect(top4).toContain('redbull')

    // Mid tier: Racing Bulls, Alpine, Audi, Haas, Williams, Aston Martin (5 a 10)
    const mid6 = sorted.slice(4, 10).map((s) => s.teamKey)
    const expectedMid = ['racingbulls', 'alpine', 'audi', 'haas', 'williams', 'astonmartin']
    for (const m of expectedMid) {
      expect(mid6).toContain(m)
    }

    // Back tier: Cadillac, Andretti (11 e 12)
    const back2 = sorted.slice(10, 12).map((s) => s.teamKey)
    expect(back2).toContain('cadillac')
    expect(back2).toContain('andretti')

    // Hierarquia preservada: pior do Top > melhor do Mid; pior do Mid > melhor do Back
    expect(sorted[3].effectivePaceScore).toBeGreaterThan(sorted[4].effectivePaceScore)
    expect(sorted[9].effectivePaceScore).toBeGreaterThan(sorted[10].effectivePaceScore)
  })

  // =========================================================================
  // BL26-12: RNG — amplitude/sigma da classificação na faixa calibrada (±0.75 a ±1.0 pt)
  // =========================================================================
  it('BL26-12: RNG — amplitude/sigma da classificação na faixa calibrada (±0.75 a ±1.0 pt)', () => {
    // Configurações canônicas
    expect(QUALI_RNG_TARGET_RANGE.MIN).toBe(-1.0)
    expect(QUALI_RNG_TARGET_RANGE.MAX).toBe(1.0)
    expect(QUALI_RNG_TARGET_RANGE.SIGMA).toBe(0.45)
    expect(QUALI_RNG_DEFAULT_SIGMA).toBe(0.45)

    // Verificação estatística: em distribuição normal com sigma = 0.45:
    // 2 * sigma = 0.90 pt (95.4% da distribuição fica entre -0.90 e +0.90 pt)
    const twoSigma = 2 * QUALI_RNG_TARGET_RANGE.SIGMA
    expect(twoSigma).toBeGreaterThanOrEqual(0.75)
    expect(twoSigma).toBeLessThanOrEqual(1.0)

    // Clamp absoluto de segurança estrito em ±1.00 pt (~±0.082s)
    const extremeNoisePos = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-01',
      circuitProfile: silverstone,
      driverAttributes: { speed: 85 },
      noise: 5.0, // ruído extremo positivo
    })
    expect(extremeNoisePos.breakdown.rngModifier).toBe(1.0)

    const extremeNoiseNeg = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-01',
      circuitProfile: silverstone,
      driverAttributes: { speed: 85 },
      noise: -5.0, // ruído extremo negativo
    })
    expect(extremeNoiseNeg.breakdown.rngModifier).toBe(-1.0)

    // Amostragem com gerador Mulberry32 + Box-Muller em 1000 amostras
    const rng = createMulberry32(42)
    const samples: number[] = []
    for (let i = 0; i < 1000; i++) {
      const val = sampleGaussianRng(rng, QUALI_RNG_DEFAULT_SIGMA)
      samples.push(val)
      expect(val).toBeGreaterThanOrEqual(-1.0)
      expect(val).toBeLessThanOrEqual(1.0)
    }

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    expect(Math.abs(mean)).toBeLessThan(0.05) // média aproximadamente zero

    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length
    const stdDev = Math.sqrt(variance)
    // Sigma empírico deve ficar próximo de 0.45 (±0.05)
    expect(stdDev).toBeGreaterThan(0.38)
    expect(stdDev).toBeLessThan(0.5)
  })

  // =========================================================================
  // BL26-13: Determinismo — mesma seed + mesmas entradas produzem exatamente o mesmo resultado
  // =========================================================================
  it('BL26-13: Determinismo — mesma seed + mesmas entradas produzem exatamente o mesmo resultado', () => {
    const carTech = (BASELINE_V0_DATA.teams['ferrari'] as any)?.technicalAttributes

    const seedTest = 'career_test_2026:r11:quali_q1:ferrari_lec'
    const seedTest2 = 123456789

    // Execução 1 com seed string
    const run1 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'ferrari',
      driverId: 'lec',
      circuitProfile: silverstone,
      carTechnicalAttributes: carTech,
      driverAttributes: { speed: 95, consistency: 90 },
      seed: seedTest,
    })

    // Execução 2 com a mesma seed
    const run2 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'ferrari',
      driverId: 'lec',
      circuitProfile: silverstone,
      carTechnicalAttributes: carTech,
      driverAttributes: { speed: 95, consistency: 90 },
      seed: seedTest,
    })

    // Exatidão bit a bit
    expect(run1.effectivePaceScore).toBe(run2.effectivePaceScore)
    expect(run1.lapTimeSec).toBe(run2.lapTimeSec)
    expect(run1.breakdown.rngModifier).toBe(run2.breakdown.rngModifier)
    expect(run1.breakdown.trackFitModifier).toBe(run2.breakdown.trackFitModifier)
    expect(run1.breakdown.finalPace).toBe(run2.breakdown.finalPace)

    // Execução 3 com seed numérica
    const runNumeric1 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'hul',
      circuitProfile: silverstone,
      carTechnicalAttributes: carTech,
      driverAttributes: { speed: 85 },
      seed: seedTest2,
    })
    const runNumeric2 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'hul',
      circuitProfile: silverstone,
      carTechnicalAttributes: carTech,
      driverAttributes: { speed: 85 },
      seed: seedTest2,
    })
    expect(runNumeric1.effectivePaceScore).toBe(runNumeric2.effectivePaceScore)
    expect(runNumeric1.breakdown.rngModifier).toBe(runNumeric2.breakdown.rngModifier)

    // Funções de PRNG isoladas: determinismo estrito
    const prng1 = createMulberry32(999)
    const prng2 = createMulberry32(999)
    for (let i = 0; i < 20; i++) {
      expect(prng1()).toBe(prng2())
    }
  })

  // =========================================================================
  // BL26-14: Hierarquia — ruído aleatório não inverte sistematicamente diferenças estruturais relevantes
  // =========================================================================
  it('BL26-14: Hierarquia — ruído aleatório não inverte sistematicamente diferenças estruturais relevantes', () => {
    // Gaps estruturais 2026:
    // Top (Red Bull 94) vs Mid (Racing Bulls 90) = 4.0 pts
    // Mid (Aston Martin 75) vs Back (Cadillac 72) = 3.0 pts
    // Cadillac (72) e Andretti (69) vs Top 3 (Mercedes 100, McLaren 98, Ferrari 96) = gap > 24 pts
    const maxRngDelta = QUALI_RNG_TARGET_RANGE.MAX - QUALI_RNG_TARGET_RANGE.MIN // 1.0 - (-1.0) = 2.0 pts
    expect(maxRngDelta).toBe(2.0)

    // Gap Top->Mid (4.0 pts) é 2x maior que a amplitude máxima do RNG (2.0 pts)
    expect(maxRngDelta).toBeLessThan(94 - 90)
    // Gap Mid->Back (3.0 pts) é 50% maior que a amplitude máxima do RNG (2.0 pts)
    expect(maxRngDelta).toBeLessThan(75 - 72)

    // Teste de pior caso: equipe superior com pior RNG (-1.0) vs inferior com melhor RNG (+1.0)
    const rbWorstRng = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'redbull',
      driverId: 'rb-drv',
      circuitProfile: silverstone,
      driverAttributes: { speed: 85 },
      noise: -1.0, // azar máximo
    })
    const vcarbBestRng = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'racingbulls',
      driverId: 'vcarb-drv',
      circuitProfile: silverstone,
      driverAttributes: { speed: 85 },
      noise: 1.0, // sorte máxima
    })
    // Red Bull estrutural 94 - 1.0 = 93.0 > Racing Bulls 90 + 1.0 = 91.0
    expect(rbWorstRng.effectivePaceScore).toBeGreaterThan(vcarbBestRng.effectivePaceScore)

    // Aston Martin (75 - 1.0 = 74.0) vs Cadillac (72 + 1.0 = 73.0)
    const astonWorst = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'astonmartin',
      driverId: 'ast-drv',
      circuitProfile: silverstone,
      driverAttributes: { speed: 85 },
      noise: -1.0,
    })
    const cadillacBest = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-drv',
      circuitProfile: silverstone,
      driverAttributes: { speed: 85 },
      noise: 1.0,
    })
    expect(astonWorst.effectivePaceScore).toBeGreaterThan(cadillacBest.effectivePaceScore)

    // Cadillac e Andretti nunca superam o Top 3 mesmo combinando TrackFit especializado + sorte de RNG
    const maxCadillacCombined = 72 + TRACKFIT_SPECIALIZED_CLAMP + QUALI_RNG_TARGET_RANGE.MAX // 72 + 2.5 + 1.0 = 75.5
    const minFerrariCombined = 96 - TRACKFIT_SPECIALIZED_CLAMP + QUALI_RNG_TARGET_RANGE.MIN // 96 - 2.5 - 1.0 = 92.5
    expect(maxCadillacCombined).toBeLessThan(minFerrariCombined)
    expect(minFerrariCombined - maxCadillacCombined).toBeGreaterThan(16.0)

    // Companheiros de equipe ou carros com gap pequeno (< 1 pt) AINDA PODEM inverter com RNG
    // Piloto A (speed 85.5) vs Piloto B (speed 85.0): delta de sessão = (85.5 - 85.0) * 0.08 = 0.04 pts
    const teammateA_badRng = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: silverstone,
      driverAttributes: { speed: 85.5 },
      noise: -0.3,
    })
    const teammateB_goodRng = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'ant',
      circuitProfile: silverstone,
      driverAttributes: { speed: 85.0 },
      noise: 0.3,
    })
    expect(teammateB_goodRng.effectivePaceScore).toBeGreaterThan(
      teammateA_badRng.effectivePaceScore,
    )
  })
})
