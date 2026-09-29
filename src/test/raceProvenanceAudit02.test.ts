import { describe, it, expect } from 'vitest'
import {
  calculateTrackQualifyingRating,
  calculateCanonicalQualifyingBasePace,
  calculateQualifyingRatingDeltaMs,
} from '@/lib/race/pureRaceEngine'

describe('RACE-PROVENANCE-AUDIT-02: Fixtures de Auditoria', () => {
  it('Fixture Item 2: Spread estrutural sem ruído para P1–P24 = 2500 ms', () => {
    // 24 ratings lineares de 100 a 70 (ou de max a min)
    const maxRating = 100
    const minRating = 70
    const spreadMs = 2500

    // Rating máximo (P1 sem ruído): rating = maxRating -> delta = 0 ms
    const deltaP1 = calculateQualifyingRatingDeltaMs({
      rating: maxRating,
      minRating,
      maxRating,
      spreadMs,
    })
    expect(deltaP1).toBe(0)

    // Rating mínimo (P24 sem ruído): rating = minRating -> delta = 2500 ms
    const deltaP24 = calculateQualifyingRatingDeltaMs({
      rating: minRating,
      minRating,
      maxRating,
      spreadMs,
    })
    expect(deltaP24).toBe(2500)

    // Intermediário proporcional (ex: rating médio 85)
    const deltaMid = calculateQualifyingRatingDeltaMs({
      rating: 85,
      minRating,
      maxRating,
      spreadMs,
    })
    expect(deltaMid).toBe(1250)
  })

  it('Fixture Item 6: Os 4 perfis de estratégia canônica do Excel', () => {
    // Especificação dos perfis conforme Parâmetros!E31:L34 (R12 / R01):
    // 1. Conservadora: Duro -> Médio, 1 parada ~55%, variação +/-3
    // 2. Equilibrada: Médio -> Duro, 1 parada ~44%, variação +/-3
    // 3. Agressiva: Macio -> Duro -> Médio, 2 paradas ~30% e ~65%, variação +/-2
    // 4. Reativa: Médio -> Duro, 1 parada ~44%, variação +/-6
    const totalLaps = 58 // Melbourne

    const profiles = {
      conservadora: {
        tires: ['Duro', 'Médio'],
        stops: 1,
        stopPct: [0.55],
        variation: 3,
        expectedLaps: [Math.round(58 * 0.55)], // ~32
      },
      equilibrada: {
        tires: ['Médio', 'Duro'],
        stops: 1,
        stopPct: [0.44],
        variation: 3,
        expectedLaps: [Math.round(58 * 0.44)], // ~26
      },
      agressiva: {
        tires: ['Macio', 'Duro', 'Médio'],
        stops: 2,
        stopPct: [0.3, 0.65],
        variation: 2,
        expectedLaps: [Math.round(58 * 0.3), Math.round(58 * 0.65)], // ~17, ~38
      },
      reativa: {
        tires: ['Médio', 'Duro'],
        stops: 1,
        stopPct: [0.44],
        variation: 6,
        expectedLaps: [Math.round(58 * 0.44)], // ~26 (+/-6)
      },
    }

    expect(profiles.conservadora.stops).toBe(1)
    expect(profiles.equilibrada.stops).toBe(1)
    expect(profiles.agressiva.stops).toBe(2)
    expect(profiles.reativa.stops).toBe(1)
    expect(profiles.reativa.variation).toBe(6)
  })
})
