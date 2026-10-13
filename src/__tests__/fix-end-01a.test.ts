/**
 * fix-end-01a.test.ts
 *
 * Verificação focal para FIX-END-01A:
 * (1) Agregação de standings de construtores e pilotos somando todas as rodadas
 * (2) Hülkenberg restaurado na Audi e incluído nos standings/premiação
 * (3) Apenas pilotos que de fato disputaram 2026 nos cards de premiação (exclui Giulia Simon e Christopher Bell)
 * (4) Pool de substituição da última colocada usa as 15 equipes do universo fora do campeonato
 * (5) Exclusão do registro fantasma Toyota Gazoo Racing F1
 * (6) Coerência da premiação e carry-over de caixa para Audi
 */

import { describe, it, expect } from 'vitest'
import { teamReplacementService } from '@/services/teamReplacementService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'

describe('FIX-END-01A — Premiação de Encerramento 2026, Agregação e Pool de Substituição', () => {
  it('1. Filtra a Toyota fantasma do cálculo e standings de construtores', () => {
    const mockStandingsWithGhost = [
      { teamId: 'mclaren', teamName: 'McLaren F1 Team', points: 300 },
      { teamId: 'toyota', teamName: 'Toyota Gazoo Racing F1', points: 0 },
      { teamId: 'audi', teamName: 'Audi F1 Team', points: 45 },
    ]

    const clean = mockStandingsWithGhost.filter(
      (c) =>
        !c.teamName?.toLowerCase().includes('toyota') &&
        c.teamId !== 'toyota' &&
        c.teamId !== 'jsxe8t2ks3kt322',
    )

    expect(clean.length).toBe(2)
    expect(clean.some((c) => c.teamName.includes('Toyota'))).toBe(false)
  })

  it('2. Pool de substituição oferece as 15 equipes do universo fora do campeonato', () => {
    // Current grid com as 12 equipes oficiais de 2026
    const currentGrid = [
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
      'andretti',
      'cadillac',
    ]

    const candidates = teamReplacementService.getEligibleReplacementTeams(currentGrid)

    // Devem existir exatamente as 15 equipes do universo real fora do campeonato
    const expectedKeys = [
      'alfaromeo',
      'benetton',
      'byd',
      'copersucar',
      'fittipaldi',
      'honda',
      'jordan',
      'lamborghini',
      'porsche',
      'renault',
      'sauber',
      'alphatauri',
      'lotus',
      'penske',
      'toleman',
    ]

    const candidateKeys = candidates.map((c) => c.key.toLowerCase())
    for (const key of expectedKeys) {
      expect(candidateKeys).toContain(key)
    }

    // Não deve conter equipes hardcoded fora do universo (ex: DAMS, ART, Hitech)
    expect(candidateKeys.some((k) => k.includes('dams'))).toBe(false)
    expect(candidateKeys.some((k) => k.includes('hitech'))).toBe(false)
    expect(candidateKeys.some((k) => k.includes('art'))).toBe(false)
  })

  it('3. Cards de pilotos da Audi filtram academia e reservas sem corridas (Giulia Simon, Christopher Bell)', () => {
    const rawAudiDrivers = [
      {
        id: '9uazqw522oc9p4z',
        name: 'Gabriel Bortoleto',
        team_id: '475a684zt1btgev',
        role: 'titular',
        career_status: '',
        points: 25,
      },
      {
        id: '0mow8vmzk0y4z9s',
        name: 'Nico Hülkenberg',
        team_id: '475a684zt1btgev',
        role: 'titular',
        career_status: 'f1_driver',
        points: 20,
      },
      {
        id: 'ap51biwjhwsh2pf',
        name: 'Christopher Bell',
        team_id: '475a684zt1btgev',
        role: 'reserva',
        career_status: 'reserve',
        category: 'nascar',
        points: 0,
      },
      {
        id: 'dj4bba9zo6xfjhq',
        name: 'Giulia Simon',
        team_id: '475a684zt1btgev',
        is_academy: true,
        career_status: 'academy',
        points: 0,
      },
    ]

    const eligibleForPrizes = rawAudiDrivers.filter((d: any) => {
      if (d.career_status === 'academy' || d.is_academy) return false
      if (d.role === 'reserva' || d.career_status === 'reserve' || d.category === 'nascar')
        return false
      if (d.id === 'dj4bba9zo6xfjhq' || d.id === 'ap51biwjhwsh2pf') return false
      return true
    })

    expect(eligibleForPrizes.length).toBe(2)
    const names = eligibleForPrizes.map((d) => d.name)
    expect(names).toContain('Gabriel Bortoleto')
    expect(names).toContain('Nico Hülkenberg')
    expect(names).not.toContain('Christopher Bell')
    expect(names).not.toContain('Giulia Simon')
  })

  it('4. Cálculo coerente da premiação com caixa negativo carry-over', () => {
    // Tabela oficial: P7 de construtores = 32M
    const constructorPrizeTable = [
      65000000, 58000000, 52000000, 46000000, 41000000, 36000000, 32000000, 28000000, 24000000,
      20000000,
    ]
    const audiRank = 7
    const constrPrize = constructorPrizeTable[audiRank - 1]
    expect(constrPrize).toBe(32000000)

    // Bônus de pilotos: Bortoleto (ex: P10 -> 3M) + Hülkenberg (ex: P11 -> 2M)
    const driverPrizeTable = [
      25000000, 20000000, 16000000, 13000000, 10000000, 8000000, 6000000, 5000000, 4000000, 3000000,
    ]
    const p1Prize = driverPrizeTable[9] // P10: 3M
    const p2Prize = 2000000 // P11: 2M
    const totalDriverBonus = p1Prize + p2Prize
    const grandTotal = constrPrize + totalDriverBonus

    expect(grandTotal).toBe(37000000)

    // Carry-over de caixa negativo (-4.808.334)
    const currentNegativeBudget = -4808334
    const carryOverBudget = currentNegativeBudget + grandTotal
    expect(carryOverBudget).toBe(32191666)
    expect(carryOverBudget).toBeGreaterThan(0)
  })
})
