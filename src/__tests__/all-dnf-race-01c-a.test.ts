import { describe, it, expect } from 'vitest'
import { calculateRacePoints, calculateFiaPoints } from '@/lib/f1-standings-calculator'

/**
 * ALL-DNF-RACE-01C-A — RESOLVER CANÔNICO DE PONTOS POR DISTÂNCIA
 * Micro-patch isolado — Sem championship, sem persistência
 *
 * Contratos testados (ALLDNF01CA-01 .. ALLDNF01CA-12):
 * - ALLDNF01CA-01: não elegível para pontos -> resultado = 0, mesmo se position = P1.
 * - ALLDNF01CA-02: <25% retorna 6/4/3/2/1/0.
 * - ALLDNF01CA-03: >=25% e <50% retorna 13/10/8/6/5/4/3/2/1/0.
 * - ALLDNF01CA-04: >=50% e <75% retorna 19/14/12/10/8/6/4/3/2/1.
 * - ALLDNF01CA-05: >=75% retorna 25/18/15/12/10/8/6/4/2/1.
 * - ALLDNF01CA-06: exatamente 25% entra na faixa 25–50.
 * - ALLDNF01CA-07: exatamente 50% entra na faixa 50–75.
 * - ALLDNF01CA-08: exatamente 75% entra na faixa integral.
 * - ALLDNF01CA-09: NC -> 0 pontos em qualquer faixa.
 * - ALLDNF01CA-10: DNF + CLASSIFIED pode receber pontos.
 * - ALLDNF01CA-11: P10 na faixa 25–50 -> 0 pontos.
 * - ALLDNF01CA-12: P11+ -> 0 pontos em qualquer faixa.
 *
 * FIXTURE PRINCIPAL: scheduledLaps = 60
 * - CASO A: leaderLaps = 10, eligible = true -> 16,67% -> P1 = 6
 * - CASO B: leaderLaps = 15 -> 25% -> P1 = 13
 * - CASO C: leaderLaps = 30 -> 50% -> P1 = 19
 * - CASO D: leaderLaps = 45 -> 75% -> P1 = 25
 */

describe('ALL-DNF-RACE-01C-A — Resolver Canônico de Pontos por Distância', () => {
  const scheduledLaps = 60

  // ALLDNF01CA-01: não elegível para pontos -> resultado = 0, mesmo se position = P1
  it('ALLDNF01CA-01: não elegível para pontos -> resultado = 0, mesmo se position = P1', () => {
    const ptsP1IneligibleExplicit = calculateRacePoints({
      position: 1,
      scheduledLaps,
      leaderLaps: 10,
      hasMinimumPointEligibility: false,
      isClassified: true,
      classificationStatus: 'CLASSIFIED',
    })
    expect(ptsP1IneligibleExplicit).toBe(0)

    const ptsP1IneligibleZeroLaps = calculateRacePoints({
      position: 1,
      scheduledLaps,
      leaderLaps: 0,
      hasMinimumPointEligibility: true,
      isClassified: true,
      classificationStatus: 'CLASSIFIED',
    })
    expect(ptsP1IneligibleZeroLaps).toBe(0)

    const ptsP1IneligibleUnder2Laps = calculateRacePoints({
      position: 1,
      scheduledLaps,
      leaderLaps: 1,
      isClassified: true,
      classificationStatus: 'CLASSIFIED',
    })
    expect(ptsP1IneligibleUnder2Laps).toBe(0)
  })

  // ALLDNF01CA-02: <25% retorna 6/4/3/2/1/0
  it('ALLDNF01CA-02: <25% retorna 6/4/3/2/1/0 (Caso A: leaderLaps = 10 em 60)', () => {
    const leaderLaps = 10 // 16.67% < 25%
    const expected = [6, 4, 3, 2, 1, 0, 0, 0, 0, 0]

    for (let pos = 1; pos <= 10; pos++) {
      const pts = calculateRacePoints({
        position: pos,
        scheduledLaps,
        leaderLaps,
        hasMinimumPointEligibility: true,
        isClassified: true,
        classificationStatus: 'CLASSIFIED',
      })
      expect(pts).toBe(expected[pos - 1])
    }
  })

  // ALLDNF01CA-03: >=25% e <50% retorna 13/10/8/6/5/4/3/2/1/0
  it('ALLDNF01CA-03: >=25% e <50% retorna 13/10/8/6/5/4/3/2/1/0 (Caso B: leaderLaps = 20 em 60)', () => {
    const leaderLaps = 20 // 33.33%
    const expected = [13, 10, 8, 6, 5, 4, 3, 2, 1, 0]

    for (let pos = 1; pos <= 10; pos++) {
      const pts = calculateRacePoints({
        position: pos,
        scheduledLaps,
        leaderLaps,
        hasMinimumPointEligibility: true,
        isClassified: true,
        classificationStatus: 'CLASSIFIED',
      })
      expect(pts).toBe(expected[pos - 1])
    }
  })

  // ALLDNF01CA-04: >=50% e <75% retorna 19/14/12/10/8/6/4/3/2/1
  it('ALLDNF01CA-04: >=50% e <75% retorna 19/14/12/10/8/6/4/3/2/1 (Caso C: leaderLaps = 35 em 60)', () => {
    const leaderLaps = 35 // 58.33%
    const expected = [19, 14, 12, 10, 8, 6, 4, 3, 2, 1]

    for (let pos = 1; pos <= 10; pos++) {
      const pts = calculateRacePoints({
        position: pos,
        scheduledLaps,
        leaderLaps,
        hasMinimumPointEligibility: true,
        isClassified: true,
        classificationStatus: 'CLASSIFIED',
      })
      expect(pts).toBe(expected[pos - 1])
    }
  })

  // ALLDNF01CA-05: >=75% retorna 25/18/15/12/10/8/6/4/2/1
  it('ALLDNF01CA-05: >=75% retorna 25/18/15/12/10/8/6/4/2/1 (Caso D: leaderLaps = 50 em 60)', () => {
    const leaderLaps = 50 // 83.33%
    const expected = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

    for (let pos = 1; pos <= 10; pos++) {
      const pts = calculateRacePoints({
        position: pos,
        scheduledLaps,
        leaderLaps,
        hasMinimumPointEligibility: true,
        isClassified: true,
        classificationStatus: 'CLASSIFIED',
      })
      expect(pts).toBe(expected[pos - 1])
    }
  })

  // ALLDNF01CA-06: exatamente 25% entra na faixa 25–50
  it('ALLDNF01CA-06: exatamente 25% entra na faixa 25–50 (leaderLaps = 15 em 60)', () => {
    // 15 * 100 = 1500 === 60 * 25
    const ptsP1Exact25 = calculateRacePoints({
      position: 1,
      scheduledLaps: 60,
      leaderLaps: 15,
      hasMinimumPointEligibility: true,
      isClassified: true,
      classificationStatus: 'CLASSIFIED',
    })
    expect(ptsP1Exact25).toBe(13)

    // Just under 25% (14 laps in 60 = 23.33%) -> Faixa 1 (6 pts)
    const ptsP1Under25 = calculateRacePoints({
      position: 1,
      scheduledLaps: 60,
      leaderLaps: 14,
      hasMinimumPointEligibility: true,
      isClassified: true,
      classificationStatus: 'CLASSIFIED',
    })
    expect(ptsP1Under25).toBe(6)
  })

  // ALLDNF01CA-07: exatamente 50% entra na faixa 50–75
  it('ALLDNF01CA-07: exatamente 50% entra na faixa 50–75 (leaderLaps = 30 em 60)', () => {
    // 30 * 100 = 3000 === 60 * 50
    const ptsP1Exact50 = calculateRacePoints({
      position: 1,
      scheduledLaps: 60,
      leaderLaps: 30,
      hasMinimumPointEligibility: true,
      isClassified: true,
      classificationStatus: 'CLASSIFIED',
    })
    expect(ptsP1Exact50).toBe(19)

    // Just under 50% (29 laps in 60 = 48.33%) -> Faixa 2 (13 pts)
    const ptsP1Under50 = calculateRacePoints({
      position: 1,
      scheduledLaps: 60,
      leaderLaps: 29,
      hasMinimumPointEligibility: true,
      isClassified: true,
      classificationStatus: 'CLASSIFIED',
    })
    expect(ptsP1Under50).toBe(13)
  })

  // ALLDNF01CA-08: exatamente 75% entra na faixa integral
  it('ALLDNF01CA-08: exatamente 75% entra na faixa integral (leaderLaps = 45 em 60)', () => {
    // 45 * 100 = 4500 === 60 * 75
    const ptsP1Exact75 = calculateRacePoints({
      position: 1,
      scheduledLaps: 60,
      leaderLaps: 45,
      hasMinimumPointEligibility: true,
      isClassified: true,
      classificationStatus: 'CLASSIFIED',
    })
    expect(ptsP1Exact75).toBe(25)

    // Just under 75% (44 laps in 60 = 73.33%) -> Faixa 3 (19 pts)
    const ptsP1Under75 = calculateRacePoints({
      position: 1,
      scheduledLaps: 60,
      leaderLaps: 44,
      hasMinimumPointEligibility: true,
      isClassified: true,
      classificationStatus: 'CLASSIFIED',
    })
    expect(ptsP1Under75).toBe(19)
  })

  // ALLDNF01CA-09: NC -> 0 pontos em qualquer faixa
  it('ALLDNF01CA-09: NC -> 0 pontos em qualquer faixa', () => {
    const faixas = [10, 15, 30, 45, 60]
    for (const leaderLaps of faixas) {
      const ptsNC = calculateRacePoints({
        position: 1,
        scheduledLaps: 60,
        leaderLaps,
        hasMinimumPointEligibility: true,
        isClassified: false,
        classificationStatus: 'NC',
      })
      expect(ptsNC).toBe(0)

      const ptsNotClassified = calculateRacePoints({
        position: 1,
        scheduledLaps: 60,
        leaderLaps,
        hasMinimumPointEligibility: true,
        isClassified: false,
        classificationStatus: 'NOT_CLASSIFIED',
      })
      expect(ptsNotClassified).toBe(0)
    }
  })

  // ALLDNF01CA-10: DNF + CLASSIFIED pode receber pontos
  it('ALLDNF01CA-10: DNF + CLASSIFIED pode receber pontos', () => {
    const ptsDnfClassified = calculateRacePoints({
      position: 1,
      scheduledLaps: 60,
      leaderLaps: 30, // 50% -> Faixa 3
      hasMinimumPointEligibility: true,
      isClassified: true,
      classificationStatus: 'CLASSIFIED',
      raceStatus: 'dnf',
      status: 'dnf',
    })
    expect(ptsDnfClassified).toBe(19)

    const ptsDnfClassifiedP2 = calculateRacePoints({
      position: 2,
      scheduledLaps: 60,
      leaderLaps: 45, // 75% -> Faixa 4
      hasMinimumPointEligibility: true,
      isClassified: true,
      classificationStatus: 'CLASSIFIED',
      raceStatus: 'dnf',
    })
    expect(ptsDnfClassifiedP2).toBe(18)
  })

  // ALLDNF01CA-11: P10 na faixa 25–50 -> 0 pontos
  it('ALLDNF01CA-11: P10 na faixa 25–50 -> 0 pontos', () => {
    const ptsP10 = calculateRacePoints({
      position: 10,
      scheduledLaps: 60,
      leaderLaps: 20, // 33.33% (faixa 25–50)
      hasMinimumPointEligibility: true,
      isClassified: true,
      classificationStatus: 'CLASSIFIED',
    })
    expect(ptsP10).toBe(0)

    // P9 na mesma faixa deve receber 1 ponto
    const ptsP9 = calculateRacePoints({
      position: 9,
      scheduledLaps: 60,
      leaderLaps: 20,
      hasMinimumPointEligibility: true,
      isClassified: true,
      classificationStatus: 'CLASSIFIED',
    })
    expect(ptsP9).toBe(1)
  })

  // ALLDNF01CA-12: P11+ -> 0 pontos em qualquer faixa
  it('ALLDNF01CA-12: P11+ -> 0 pontos em qualquer faixa', () => {
    const faixas = [10, 20, 35, 55]
    for (const leaderLaps of faixas) {
      for (const pos of [11, 12, 15, 20, 24]) {
        const pts = calculateRacePoints({
          position: pos,
          scheduledLaps: 60,
          leaderLaps,
          hasMinimumPointEligibility: true,
          isClassified: true,
          classificationStatus: 'CLASSIFIED',
        })
        expect(pts).toBe(0)
      }
    }
  })

  // Verificação complementar: compatibilidade e delegação de calculateFiaPoints
  it('calculateFiaPoints delega corretamente para calculateRacePoints', () => {
    expect(calculateFiaPoints(1, 10, 60)).toBe(6)
    expect(calculateFiaPoints(1, 15, 60)).toBe(13)
    expect(calculateFiaPoints(1, 30, 60)).toBe(19)
    expect(calculateFiaPoints(1, 45, 60)).toBe(25)
    expect(calculateFiaPoints(1, 10, 60, { hasMinimumPointEligibility: false })).toBe(0)
    expect(calculateFiaPoints(1, 30, 60, { classificationStatus: 'NC' })).toBe(0)
  })
})
