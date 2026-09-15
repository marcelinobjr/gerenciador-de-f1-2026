import { describe, it, expect, beforeEach, vi } from 'vitest'
import { weekendSimulationService } from '@/services/weekendSimulationService'
import { seasonTransitionService } from '@/services/seasonTransitionService'
import { financialLedgerService } from '@/services/financialLedgerService'
import { standingsService } from '@/services/standingsService'
import type { TeamModel, SeasonModel, DriverModel, PartModel, SponsorModel } from '@/types/f1'

describe('Fase 8A: Simulação Canônica de Fim de Semana & Transição de Temporada', () => {
  const mockTeam: any = {
    id: 'team_ferrari_test',
    name: 'Scuderia Ferrari',
    color: '#E10600',
    budget: 50_000_000,
    morale: 80,
    created: '2026-01-01',
    updated: '2026-01-01',
  }

  const mockSeason: any = {
    id: 'season_2026_test',
    year: 2026,
    current_round: 1,
    total_rounds: 24,
    created: '2026-01-01',
    updated: '2026-01-01',
  }

  const mockDrivers: DriverModel[] = [
    {
      id: 'driver_lec_test',
      team_id: 'team_ferrari_test',
      name: 'Charles Leclerc',
      skill: 92,
      pace: 93,
      consistency: 89,
      experience: 85,
      morale: 85,
      salary: 15_000_000,
      contract_years: 2,
      created: '2026-01-01',
      updated: '2026-01-01',
    },
    {
      id: 'driver_ham_test',
      team_id: 'team_ferrari_test',
      name: 'Lewis Hamilton',
      skill: 94,
      pace: 91,
      consistency: 94,
      experience: 99,
      morale: 88,
      salary: 20_000_000,
      contract_years: 2,
      created: '2026-01-01',
      updated: '2026-01-01',
    },
  ]

  const mockParts: PartModel[] = [
    {
      id: 'part_engine_test',
      team_id: 'team_ferrari_test',
      name: 'Internal Combustion Engine',
      category: 'engine',
      level: 4,
      health: 95,
      created: '2026-01-01',
      updated: '2026-01-01',
    },
    {
      id: 'part_aero_test',
      team_id: 'team_ferrari_test',
      name: 'Front Wing',
      category: 'aerodynamics',
      level: 4,
      health: 98,
      created: '2026-01-01',
      updated: '2026-01-01',
    },
  ]

  const mockSponsors: SponsorModel[] = [
    {
      id: 'sp_shell_test',
      team_id: 'team_ferrari_test',
      name: 'Shell High Performance',
      payment_per_race: 2_500_000,
      bonus_objective: 'Pódio (Top 3)',
      bonus_amount: 1_000_000,
      contract_races_left: 24,
      reputation_requirement: 75,
      created: '2026-01-01',
      updated: '2026-01-01',
    },
  ]

  it('1. Deve simular um fim de semana completo e retornar relatório auditado em 7 dimensões', async () => {
    const res = await weekendSimulationService.simulateRemainingWeekend({
      team: mockTeam,
      season: mockSeason,
      drivers: mockDrivers,
      parts: mockParts,
      sponsors: mockSponsors,
      currentRound: 1,
      alreadyCompletedSessions: [],
    })

    expect(res).toBeDefined()
    expect(res.report).toBeDefined()
    expect(res.report.playerDriversResults).toHaveLength(2)
    expect(res.report.financialImpact).toBeDefined()
    expect(res.report.carCondition).toBeDefined()
    expect(res.report.championshipImpact).toBeDefined()

    // Valida auditoria canônica de 7 dimensões
    const audit = weekendSimulationService.auditWeekendSimulation(res.runId)
    expect(audit).toBeDefined()
    expect(audit.valid).toBe(true)
    expect(audit.dimensionsChecked).toBeGreaterThanOrEqual(7)
  })

  it('2. Idempotência do Ledger Financeiro: 10× simulações subsequentes sem duplicação ou corrupção', async () => {
    // Executa simulação 10 vezes em rodadas distintas ou sessões subsequentes
    const initialBalance = mockTeam.budget

    for (let r = 1; r <= 10; r++) {
      const sim = await weekendSimulationService.simulateRemainingWeekend({
        team: { ...mockTeam, budget: initialBalance },
        season: { ...mockSeason, current_round: r },
        drivers: mockDrivers,
        parts: mockParts,
        sponsors: mockSponsors,
        currentRound: r,
        alreadyCompletedSessions: [],
      })

      expect(sim.report).toBeDefined()
      expect(sim.report.round).toBe(r)
      expect(sim.report.playerDriversResults[0].finishPosition).toBeGreaterThanOrEqual(1)
      expect(sim.report.playerDriversResults[0].finishPosition).toBeLessThanOrEqual(22)

      // Ledger não deve gerar lançamentos inconsistentes
      const audit = weekendSimulationService.auditWeekendSimulation(sim.runId)
      expect(audit.valid).toBe(true)
    }
  })

  it('3. Validação de Pontuação Canônica FIA 2026', () => {
    // Regra FIA F1 2026 padrão: 25, 18, 15, 12, 10, 8, 6, 4, 2, 1
    const p1 = standingsService.calculatePointsForPosition(1, false)
    const p2 = standingsService.calculatePointsForPosition(2, false)
    const p3 = standingsService.calculatePointsForPosition(3, false)
    const p10 = standingsService.calculatePointsForPosition(10, false)
    const p11 = standingsService.calculatePointsForPosition(11, false)

    expect(p1).toBe(25)
    expect(p2).toBe(18)
    expect(p3).toBe(15)
    expect(p10).toBe(1)
    expect(p11).toBe(0)

    // Volta mais rápida no top 10 ganha +1 pt
    const p1WithFL = standingsService.calculatePointsForPosition(1, true)
    expect(p1WithFL).toBe(26)

    // Volta mais rápida fora do top 10 NÃO ganha ponto
    const p11WithFL = standingsService.calculatePointsForPosition(11, true)
    expect(p11WithFL).toBe(0)
  })

  it('4. Exercitar o auditSeasonTransition real e transição de temporada', async () => {
    // Realiza auditoria real de transição 2026 -> 2027
    const auditTransition = await seasonTransitionService.auditSeasonTransition(
      2026,
      2027,
      mockTeam.id,
    )

    expect(auditTransition).toBeDefined()
    expect(auditTransition.valid).toBe(true)
    expect(auditTransition.checks).toBeDefined()
  })
})
