import { describe, it, expect } from 'vitest'
import {
  BASELINE_2026_V1_TEAMS,
  BASELINE_2026_V1_ORDER,
  BASELINE_2026_V1_METADATA,
} from '@/data/baseline-2026-v1'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { canonicalPaceIntegrationService } from '@/services/canonicalPaceIntegrationService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'

describe('BASELINE-2026-LOCK-01 — Suíte Completa BL26-01..14', () => {
  // BL26-01: baseline exata 12 equipes
  it('BL26-01: baseline exata 12 equipes', () => {
    expect(Object.keys(BASELINE_2026_V1_TEAMS)).toHaveLength(12)
    expect(BASELINE_2026_V1_ORDER).toHaveLength(12)
    const expectedKeys = [
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
    expect(BASELINE_2026_V1_ORDER).toEqual(expectedKeys)
  })

  // BL26-02: ordem estrutural correta
  it('BL26-02: ordem estrutural correta', () => {
    const scores = BASELINE_2026_V1_ORDER.map((key) => {
      const team = structuralStrengthService.getTeamStructuralStrength(key)
      return { key, score: team.structuralStrengthScore }
    })

    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i].score).toBeGreaterThan(scores[i + 1].score)
    }

    expect(scores.map((s) => s.score)).toEqual([100, 98, 96, 94, 90, 87, 84, 81, 79, 75, 72, 69])
  })

  // BL26-03: Mercedes = 100
  it('BL26-03: Mercedes = 100', () => {
    const merc = structuralStrengthService.getTeamStructuralStrength('mercedes')
    expect(merc.structuralStrengthScore).toBe(100)
    expect(BASELINE_2026_V1_TEAMS.mercedes.score).toBe(100)
  })

  // BL26-04: Andretti = 69
  it('BL26-04: Andretti = 69', () => {
    const andretti = structuralStrengthService.getTeamStructuralStrength('andretti')
    expect(andretti.structuralStrengthScore).toBe(69)
    expect(BASELINE_2026_V1_TEAMS.andretti.score).toBe(69)
  })

  // BL26-05: spread estrutural ~2.48s
  it('BL26-05: spread estrutural ~2.48s', () => {
    const merc = structuralStrengthService.getTeamStructuralStrength('mercedes')
    const andretti = structuralStrengthService.getTeamStructuralStrength('andretti')
    const ptDelta = merc.structuralStrengthScore - andretti.structuralStrengthScore
    expect(ptDelta).toBe(31)

    const secSpread = Number(
      (ptDelta * BASELINE_2026_V1_METADATA.timeConversionSecPerPoint).toFixed(2),
    )
    expect(secSpread).toBe(2.48)
  })

  // BL26-06: TrackFit limitado tipicamente -2.0 a +2.0 pts; máx ±2.5 pts
  it('BL26-06: TrackFit limitado', () => {
    // rawTrackFit varia de 0 a 100
    const minRes = canonicalPaceIntegrationService.normalizeTrackFit({ rawTrackFitScore: 0 })
    const maxRes = canonicalPaceIntegrationService.normalizeTrackFit({ rawTrackFitScore: 100 })
    const midRes = canonicalPaceIntegrationService.normalizeTrackFit({ rawTrackFitScore: 75 })
    const highTypical = canonicalPaceIntegrationService.normalizeTrackFit({ rawTrackFitScore: 95 })

    expect(minRes.trackFitModifier).toBeGreaterThanOrEqual(-2.5)
    expect(maxRes.trackFitModifier).toBeLessThanOrEqual(2.5)
    expect(midRes.trackFitModifier).toBe(0)
    // Para 95 (delta +20): 20 * 0.08 = 1.6 pts (dentro da faixa típica -2.0 a +2.0)
    expect(Math.abs(highTypical.trackFitModifier)).toBeLessThanOrEqual(2.0)
  })

  // BL26-07: TrackFit não joga Cadillac top 3 sozinho
  it('BL26-07: TrackFit não joga Cadillac top 3 sozinho', () => {
    // Cadillac base = 72. Max TrackFit = +2.5 -> max = 74.5
    // Top 3 (Mercedes 100, McLaren 98, Ferrari 96) mesmo com pior TrackFit (-2.5) tem no mínimo 93.5
    const cadillacBase =
      structuralStrengthService.getTeamStructuralStrength('cadillac').structuralStrengthScore
    const maxCadillacTrackFit = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 100,
    }).trackFitModifier
    const cadillacMaxPace = cadillacBase + maxCadillacTrackFit

    const minTop3Pace =
      96 +
      canonicalPaceIntegrationService.normalizeTrackFit({ rawTrackFitScore: 0 }).trackFitModifier
    expect(cadillacMaxPace).toBeLessThan(minTop3Pace)
    expect(cadillacMaxPace).toBeLessThan(80) // Longe do Top 3
  })

  // BL26-08: TrackFit não joga Andretti top 3 sozinho
  it('BL26-08: TrackFit não joga Andretti top 3 sozinho', () => {
    // Andretti base = 69. Max TrackFit = +2.5 -> max = 71.5
    const andrettiBase =
      structuralStrengthService.getTeamStructuralStrength('andretti').structuralStrengthScore
    const maxAndrettiTrackFit = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 100,
    }).trackFitModifier
    const andrettiMaxPace = andrettiBase + maxAndrettiTrackFit

    const minTop3Pace =
      96 +
      canonicalPaceIntegrationService.normalizeTrackFit({ rawTrackFitScore: 0 }).trackFitModifier
    expect(andrettiMaxPace).toBeLessThan(minTop3Pace)
    expect(andrettiMaxPace).toBeLessThan(75)
  })

  // BL26-09: RNG não quebra tiers sozinho (alvo ±0.75 a ±1.0 pt)
  it('BL26-09: RNG não quebra tiers sozinho', () => {
    const circuit = resolveCircuitProfile({ round: 1 })
    // Testa ruído extremo no computeQualifyingPace
    const paceMaxRng = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv1',
      circuitProfile: circuit,
      driverAttributes: { speed: 85, consistency: 85 },
      noise: 1.0, // ruído extremo positivo
    })
    const paceMinRng = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv1',
      circuitProfile: circuit,
      driverAttributes: { speed: 85, consistency: 85 },
      noise: -1.0, // ruído extremo negativo
    })

    expect(paceMaxRng.breakdown.rngModifier).toBeLessThanOrEqual(1.0)
    expect(paceMinRng.breakdown.rngModifier).toBeGreaterThanOrEqual(-1.0)
    // Amplitude total do RNG máx 2.0 pts
    expect(paceMaxRng.breakdown.rngModifier - paceMinRng.breakdown.rngModifier).toBeLessThanOrEqual(
      2.0,
    )
  })

  // BL26-10: setup não quebra tiers sozinho (setup 100 vs 80 = +1.0 pt)
  it('BL26-10: setup não quebra tiers sozinho', () => {
    const circuit = resolveCircuitProfile({ round: 1 })
    const paceSetup100 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv1',
      circuitProfile: circuit,
      driverAttributes: { speed: 85, consistency: 85 },
      setupEfficiency: 100,
    })
    const paceSetup80 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv1',
      circuitProfile: circuit,
      driverAttributes: { speed: 85, consistency: 85 },
      setupEfficiency: 80,
    })

    expect(paceSetup80.breakdown.setupModifier).toBe(0.0)
    expect(paceSetup100.breakdown.setupModifier).toBe(1.0)
  })

  // BL26-11: qualificação neutra respeita ordem exatamente (Mercedes > McLaren > Ferrari > ...)
  it('BL26-11: qualificação neutra respeita ordem', () => {
    const circuit = resolveCircuitProfile({ round: 1 })
    const results = BASELINE_2026_V1_ORDER.map((teamKey) => {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: `drv_${teamKey}`,
        circuitProfile: circuit,
        driverAttributes: { speed: 85, consistency: 85 },
        setupEfficiency: 80,
        fuelKg: 12,
        weather: 'seco',
        noise: 0,
      })
      return { teamKey, lapTimeSec: pace.lapTimeSec, score: pace.effectivePaceScore }
    })

    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThan(results[i + 1].score)
      expect(results[i].lapTimeSec).toBeLessThan(results[i + 1].lapTimeSec)
    }
  })

  // BL26-12: companheiros permanecem em faixa plausível (0.05 a 0.35s)
  it('BL26-12: companheiros permanecem em faixa plausível', () => {
    const circuit = resolveCircuitProfile({ round: 1 })
    // Piloto 1 (Speed 90) vs Piloto 2 (Speed 86) na mesma equipe Mercedes
    const d1 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'd1',
      circuitProfile: circuit,
      driverAttributes: { speed: 90, consistency: 90 },
      noise: 0,
    })
    const d2 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'd2',
      circuitProfile: circuit,
      driverAttributes: { speed: 86, consistency: 86 },
      noise: 0,
    })

    const gapSec = d2.lapTimeSec - d1.lapTimeSec
    expect(gapSec).toBeGreaterThan(0.02)
    expect(gapSec).toBeLessThan(0.4)
  })

  // BL26-13: Silverstone normal plausível (top teams dominam o topo)
  it('BL26-13: Silverstone normal plausível', () => {
    const silverstone = resolveCircuitProfile({ round: 11 }) // Silverstone
    const gridTimes = BASELINE_2026_V1_ORDER.map((teamKey) => {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: `drv_${teamKey}`,
        circuitProfile: silverstone,
        driverAttributes: { speed: 85, consistency: 85 },
        setupEfficiency: 80,
        noise: 0,
      })
      return { teamKey, paceScore: pace.effectivePaceScore, lapTimeSec: pace.lapTimeSec }
    })

    gridTimes.sort((a, b) => a.lapTimeSec - b.lapTimeSec)
    const top4 = gridTimes.slice(0, 4).map((g) => g.teamKey)

    // Todas as 4 top teams (mercedes, mclaren, ferrari, redbull) devem estar no top 4
    expect(top4).toContain('mercedes')
    expect(top4).toContain('mclaren')
    expect(top4).toContain('ferrari')
    expect(top4).toContain('redbull')

    // Fundo do grid contém andretti e cadillac
    const bottom2 = gridTimes.slice(-2).map((g) => g.teamKey)
    expect(bottom2).toContain('andretti')
    expect(bottom2).toContain('cadillac')
  })

  // BL26-14: cenário caótico permite zebras (chuva forte com pneu errado para líderes, zebra avança)
  it('BL26-14: cenário caótico permite zebras', () => {
    const circuit = resolveCircuitProfile({ round: 1 })
    // Líder Mercedes sai com pneu macio em chuva forte (+8.5s penalidade)
    const mercCaos = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: circuit,
      driverAttributes: { speed: 90, rain: 75 },
      tyreCompound: 'macio',
      weather: 'chuva_forte',
      noise: -0.1,
    })

    // Haas/Cadillac acerta estratégia de pneu (chuva_extrema, 0s penalidade de pneu) + piloto de chuva
    const cadillacCaos = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'bot',
      circuitProfile: circuit,
      driverAttributes: { speed: 82, rain: 92 },
      tyreCompound: 'chuva_extrema',
      weather: 'chuva_forte',
      noise: 0.1,
    })

    // No cenário de caos, Cadillac supera Mercedes por causa da estratégia/clima
    expect(cadillacCaos.lapTimeSec).toBeLessThan(mercCaos.lapTimeSec)
  })
})
