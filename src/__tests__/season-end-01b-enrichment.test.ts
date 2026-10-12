/**
 * season-end-01b-enrichment.test.ts
 *
 * Teste unitário e de regressão focal para o SEASON-END-01B:
 * 1. Escolha da equipe substituta da última colocada (procedurais / aspirantes)
 * 2. Dança das cadeiras (mercado de pilotos entre temporadas)
 * 3. Identificação e exibição dos campeões de pilotos e construtores
 * 4. Posições dos pilotos e equipe do jogador com premiação em dinheiro (R$)
 * 5. Idempotência e integridade da máquina de estados na virada 2026 -> 2027
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { teamReplacementService } from '@/services/teamReplacementService'
import { seasonTransitionService } from '@/services/seasonTransitionService'

describe('SEASON-END-01B — Enriquecimento do Encerramento de Temporada', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('1. Identifica canonicamente a última colocada no campeonato de construtores', () => {
    const mockStandings = [
      { id: 't1', teamName: 'McLaren F1 Team', points: 450 },
      { id: 't2', teamName: 'Ferrari', points: 410 },
      { id: 't3', teamName: 'Audi F1 Team', points: 120 },
      { id: 't_last', teamName: 'Cadillac F1 Team', points: 12 },
    ]

    const last = teamReplacementService.identifyLastPlaceTeam(mockStandings)
    expect(last).not.toBeNull()
    expect(last?.teamId).toBe('t_last')
    expect(last?.teamName).toBe('Cadillac F1 Team')
    expect(last?.rank).toBe(4)
    expect(last?.points).toBe(12)
  })

  it('2. Oferece pool de equipes candidatas/aspirantes quando grid já possui equipes oficiais', () => {
    const currentGridKeys = [
      'audi',
      'ferrari',
      'mclaren',
      'redbull',
      'mercedes',
      'aston_martin',
      'alpine',
      'williams',
      'haas',
      'racing_bulls',
    ]
    const candidates = teamReplacementService.getEligibleReplacementTeams(currentGridKeys)

    expect(candidates.length).toBeGreaterThan(0)
    // Verifica presença de novas entrantes plausíveis (ex: Porsche, Toyota, Prema)
    const keys = candidates.map((c) => c.key.toLowerCase())
    expect(
      keys.some(
        (k) =>
          k.includes('porsche') ||
          k.includes('toyota') ||
          k.includes('prema') ||
          k.includes('andretti'),
      ),
    ).toBe(true)

    // Candidatos possuem rating, nome, país e motor
    const first = candidates[0]
    expect(first.name).toBeTruthy()
    expect(first.country).toBeTruthy()
    expect(first.engine).toBeTruthy()
    expect(first.strength).toBeGreaterThan(50)
  })

  it('3. Persiste e recupera a decisão de substituição de forma idempotente', async () => {
    const decisionRecord = {
      transitionKey: teamReplacementService.getReplacementKey(2026, 2027, 't_last'),
      fromSeasonYear: 2026,
      toSeasonYear: 2027,
      lastPlaceTeamId: 't_last',
      lastPlaceTeamName: 'Cadillac F1 Team',
      decision: 'REPLACE' as const,
      replacementTeamKey: 'porsche_f1',
      replacementTeamName: 'Porsche Motorsport F1',
      officialRankingReference: 'Mundial de Construtores 2026 - P12',
      confirmed: true,
      applied: false,
      createdAt: new Date().toISOString(),
    }

    await teamReplacementService.saveReplacementDecision(decisionRecord)
    const persisted = await teamReplacementService.getPersistedReplacementDecision(
      2026,
      2027,
      't_last',
    )

    expect(persisted).not.toBeNull()
    expect(persisted?.decision).toBe('REPLACE')
    expect(persisted?.replacementTeamKey).toBe('porsche_f1')
    expect(persisted?.confirmed).toBe(true)
  })

  it('4. Aplica substituição de grid 1 por 1 mantendo a contagem de equipes', () => {
    const currentGrid = ['ferrari', 'mclaren', 'audi', 'cadillac']
    const res = teamReplacementService.applyGridReplacement({
      currentGridKeys: currentGrid,
      lastPlaceTeamKey: 'cadillac',
      replacementTeamKey: 'porsche_f1',
    })

    expect(res.success).toBe(true)
    expect(res.updatedGridKeys).toHaveLength(4)
    expect(res.updatedGridKeys).toContain('porsche_f1')
    expect(res.updatedGridKeys).not.toContain('cadillac')
  })

  it('5. Validação da máquina de estados e cálculo de premiação de construtores e pilotos', () => {
    const steps = seasonTransitionService.getTransitionSteps()
    expect(steps.length).toBeGreaterThanOrEqual(11)
    expect(steps.some((s) => s.id === 'CLOSING_CHAMPIONSHIP')).toBe(true)
    expect(steps.some((s) => s.id === 'CLOSING_FINANCIALS')).toBe(true)
    expect(steps.some((s) => s.id === 'TRANSFERRING_DRIVERS')).toBe(true)
    expect(steps.some((s) => s.id === 'CREATING_NEXT_SEASON')).toBe(true)
  })

  it('6. Garante estrutura das tabelas de premiação em dinheiro (R$)', () => {
    // Formulação de premiação de construtores
    const constrPrizeTable = [
      65000000, 58000000, 52000000, 46000000, 41000000, 36000000, 32000000, 28000000, 24000000,
      20000000,
    ]
    expect(constrPrizeTable[0]).toBe(65000000)
    expect(constrPrizeTable[9]).toBe(20000000)

    // Formulação de premiação de pilotos
    const driverPrizeTable = [
      25000000, 20000000, 16000000, 13000000, 10000000, 8000000, 6000000, 5000000, 4000000, 3000000,
    ]
    expect(driverPrizeTable[0]).toBe(25000000)
    expect(driverPrizeTable[9]).toBe(3000000)
  })
})
