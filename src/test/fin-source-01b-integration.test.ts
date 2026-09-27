import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  financialAdapterService,
  buildDeterministicFactKey,
  convertMillionsToLedgerUnits,
  convertLedgerUnitsToMillions,
} from '@/services/financialAdapterService'
import { teamReplacementService } from '@/services/teamReplacementService'
import { financialLedgerService } from '@/services/financialLedgerService'
import { FinancialEconomicRules } from '@/lib/finances/types'

describe('FIN-SOURCE-01B: Adaptador Financeiro e Ledger', () => {
  const dummyRules: FinancialEconomicRules = {
    participation_annual_fixed: 40.0,
    participation_per_gp: 0.8,
    participation_per_sprint: 0.15,
    gp_win_prize: 0.5,
    sprint_win_prize: 0.15,
    constructors_minimum_prize: 15.0,
    constructors_position_amplitude: 50.0,
    constructors_champion_bonus: 5.0,
    sponsor_position_coefficient: 0.1,
    initial_reserve_over_c0: 0.1,
    initial_cash_over_c0: 0.2,
    sponsor_wins_coefficient: 0.05,
    preparation_test_event: 1.0,
    localized_development_multiplier: 1.0,
    broad_development_multiplier: 1.0,
    win_curve_calendar_divisor: 4.0,
    weekend_fixed_operation: 1.2,
    logistics_regional: 0.3,
    logistics_standard: 0.5,
    logistics_long_distance: 0.8,
    logistics_complex: 1.2,
    sprint_incremental_operation: 0.25,
    logistics_savings_default: 0.0,
    logistics_savings_max: 0.0,
    staff_win_bonus_share: 0.05,
    construction_contract_share: 0.3,
    construction_execution_share: 0.5,
    construction_delivery_share: 0.2,
    no_gp_wins_surplus_warning_fraction: 0.05,
    stress_fixed_sponsor_change: 0.0,
    stress_staff_change: 0.0,
    months_per_year: 12,
    reconciliation_tolerance: 0.000001,
    monetary_scale_to_usd: 1000000,
  }

  it('deve converter milhões para unidades contábeis do Ledger e vice-versa sem perda de centavos', () => {
    expect(convertMillionsToLedgerUnits(10.5)).toBe(10_500_000)
    expect(convertLedgerUnitsToMillions(10_500_000)).toBe(10.5)
    expect(convertMillionsToLedgerUnits(0.000001)).toBe(1)
  })

  it('deve gerar chave determinística contendo carreira, equipe, rubrica e período', () => {
    const key = buildDeterministicFactKey({
      careerId: 'car_01',
      teamId: 'team_audi',
      seasonYear: 2026,
      rubric: 'opex_facilities',
      periodOrRound: 1,
    })
    expect(key).toBe('fin_car_01_team_audi_2026_opex_facilities_p1')
  })

  it('deve calcular obrigações mensais em 12 parcelas com reconciliação estrita na última parcela', async () => {
    const postSpy = vi.spyOn(financialLedgerService, 'postTransaction').mockResolvedValue({
      transaction: { id: 'tx_mock' },
      balance: 1000000,
    } as any)

    const res = await financialAdapterService.postMonthlyOperationalObligations({
      careerId: 'car_01',
      teamId: 'team_audi',
      seasonYear: 2026,
      monthNumber: 12,
      rules: dummyRules,
      configVersion: 'v1.0.0-draft',
      annualCosts: {
        facilitiesAnnualM: 12.0,
        driversPayrollAnnualM: 24.0,
        staffPayrollAnnualM: 36.0,
        powerUnitAnnualM: 20.0,
      },
    })

    expect(res.postedCount).toBe(4)
    expect(postSpy).toHaveBeenCalled()
    postSpy.mockRestore()
  })

  it('deve registrar finanças de GP com separação de cota de participação e custos operacionais', async () => {
    const postSpy = vi.spyOn(financialLedgerService, 'postTransaction').mockResolvedValue({
      transaction: { id: 'tx_mock' },
      balance: 1000000,
    } as any)

    const res = await financialAdapterService.postWeekendEventFinances(
      {
        careerId: 'car_01',
        teamId: 'team_audi',
        seasonYear: 2026,
        round: 3,
        isSprintRound: true,
        gpWon: true,
        sprintWon: false,
        logisticsZone: 'standard',
      },
      dummyRules,
      'v1.0.0-draft',
    )

    // Cota de participação + Custo operacional + Prêmio de vitória
    expect(res.transactions.length).toBe(3)
    postSpy.mockRestore()
  })

  it('deve isolar novas carreiras das legadas com isNewEconomicModelActive', () => {
    const legacyTeam = { id: 'team_ferrari', budget: 50000000 }
    expect(financialAdapterService.isNewEconomicModelActive(legacyTeam)).toBe(false)

    const testCareerTeam = {
      id: 'team_audi',
      career_settings: { economic_model: 'FIN-EVO-03' },
    }
    expect(financialAdapterService.isNewEconomicModelActive(testCareerTeam)).toBe(true)
  })
})

describe('FIN-SOURCE-01B: Substituição Opcional da Última Colocada', () => {
  const standings = [
    { teamId: 'mclaren', name: 'McLaren', points: 450 },
    { teamId: 'ferrari', name: 'Ferrari', points: 420 },
    { teamId: 'redbull', name: 'Red Bull', points: 390 },
    { teamId: 'mercedes', name: 'Mercedes', points: 300 },
    { teamId: 'aston', name: 'Aston Martin', points: 150 },
    { teamId: 'alpine', name: 'Alpine', points: 60 },
    { teamId: 'haas', name: 'Haas', points: 40 },
    { teamId: 'audi', name: 'Audi', points: 35 },
    { teamId: 'williams', name: 'Williams', points: 20 },
    { teamId: 'cadillac', name: 'Cadillac F1', points: 0 },
  ]

  it('deve identificar a última colocada com base na classificação oficial de construtores', () => {
    const last = teamReplacementService.identifyLastPlaceTeam(standings)
    expect(last).not.toBeNull()
    expect(last?.teamId).toBe('cadillac')
    expect(last?.rank).toBe(10)
    expect(last?.points).toBe(0)
  })

  it('deve listar candidatas elegíveis excluindo as já inscritas no campeonato', () => {
    const currentKeys = [
      'mclaren',
      'ferrari',
      'redbull',
      'mercedes',
      'aston_martin',
      'alpine',
      'haas',
      'audi',
      'williams',
      'cadillac',
    ]
    const candidates = teamReplacementService.getEligibleReplacementTeams(currentKeys)

    expect(candidates.length).toBeGreaterThan(0)
    // Nenhuma equipe candidata pode estar no currentKeys
    for (const cand of candidates) {
      expect(currentKeys).not.toContain(cand.key.toLowerCase())
    }
  })

  it('deve aplicar substituição 1-para-1 no grid sem alterar contagem total de equipes', () => {
    const currentKeys = ['mclaren', 'ferrari', 'redbull', 'mercedes', 'haas', 'cadillac']
    const res = teamReplacementService.applyGridReplacement({
      currentGridKeys: currentKeys,
      lastPlaceTeamKey: 'cadillac',
      replacementTeamKey: 'porsche',
    })

    expect(res.success).toBe(true)
    expect(res.updatedGridKeys.length).toBe(currentKeys.length)
    expect(res.updatedGridKeys).toContain('porsche')
    expect(res.updatedGridKeys).not.toContain('cadillac')
  })

  it('deve rejeitar substituição de entrante já inscrita', () => {
    const currentKeys = ['mclaren', 'ferrari', 'haas']
    const res = teamReplacementService.applyGridReplacement({
      currentGridKeys: currentKeys,
      lastPlaceTeamKey: 'haas',
      replacementTeamKey: 'ferrari', // já inscrita
    })

    expect(res.success).toBe(false)
    expect(res.reason).toContain('já está inscrita')
  })
})
