import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  financialAdapterService,
  buildDeterministicFactKey,
  convertMillionsToLedgerUnits,
  convertLedgerUnitsToMillions,
  RoundEconomicContext,
  SeasonEndEconomicContext,
} from '@/services/financialAdapterService'
import { teamReplacementService, ReplacementRecord } from '@/services/teamReplacementService'
import { financialLedgerService } from '@/services/financialLedgerService'
import { FinancialEconomicRules } from '@/lib/finances/types'
import pb from '@/lib/pocketbase/client'

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
    expect(convertMillionsToLedgerUnits(0.0000004)).toBe(0)
    expect(convertMillionsToLedgerUnits(0)).toBe(0)
    expect(convertLedgerUnitsToMillions(0)).toBe(0)
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

    const keyWithOriginAndSub = buildDeterministicFactKey({
      careerId: 'car_02',
      teamId: 'team_ferrari',
      seasonYear: 2027,
      rubric: 'prize_gp_win',
      subEntityId: 'gp_monaco',
      periodOrRound: 6,
      originSeasonYear: 2026,
    })
    expect(keyWithOriginAndSub).toBe(
      'fin_car_02_team_ferrari_2027_prize_gp_win_gp_monaco_p6_orig2026',
    )
  })

  it('deve calcular obrigações mensais em 12 parcelas com reconciliação estrita na última parcela', async () => {
    const postedTxs: any[] = []
    const postSpy = vi
      .spyOn(financialLedgerService, 'postTransaction')
      .mockImplementation(async (params) => {
        postedTxs.push(params)
        return {
          transaction: { id: `tx_${params.idempotencyKey}`, ...params } as any,
          wasAlreadyProcessed: false,
        }
      })

    // Teste mês intermediário (mês 5): parcela inteira padrão
    const resM5 = await financialAdapterService.postMonthlyOperationalObligations({
      careerId: 'car_01',
      teamId: 'team_audi',
      seasonYear: 2026,
      monthNumber: 5,
      rules: dummyRules,
      configVersion: 'v1.0.0-draft',
      annualCosts: {
        facilitiesAnnualM: 10.0, // 10.000.000 / 12 = 833.333
        driversPayrollAnnualM: 25.0,
        staffPayrollAnnualM: 35.0,
        powerUnitAnnualM: 20.0,
      },
    })
    expect(resM5.postedCount).toBe(4)
    const facilitiesM5 = postedTxs.find((t) => t.subcategory === 'monthly_facilities')
    expect(facilitiesM5?.amount).toBe(Math.floor(10_000_000 / 12)) // 833333

    // Teste mês 12: resíduo absorvido exatamente
    postedTxs.length = 0
    const resM12 = await financialAdapterService.postMonthlyOperationalObligations({
      careerId: 'car_01',
      teamId: 'team_audi',
      seasonYear: 2026,
      monthNumber: 12,
      rules: dummyRules,
      configVersion: 'v1.0.0-draft',
      annualCosts: {
        facilitiesAnnualM: 10.0,
        driversPayrollAnnualM: 25.0,
        staffPayrollAnnualM: 35.0,
        powerUnitAnnualM: 20.0,
      },
    })
    expect(resM12.postedCount).toBe(4)
    const facilitiesM12 = postedTxs.find((t) => t.subcategory === 'monthly_facilities')
    const stdMonth = Math.floor(10_000_000 / 12)
    const remainder = 10_000_000 - stdMonth * 12
    expect(facilitiesM12?.amount).toBe(stdMonth + remainder)
    expect(stdMonth * 11 + facilitiesM12?.amount).toBe(10_000_000)

    postSpy.mockRestore()
  })

  it('deve registrar finanças de GP com separação de cota de participação e custos operacionais', async () => {
    const postSpy = vi.spyOn(financialLedgerService, 'postTransaction').mockResolvedValue({
      transaction: { id: 'tx_mock' },
      wasAlreadyProcessed: false,
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
    expect(financialAdapterService.isNewEconomicModelActive(null)).toBe(false)
    expect(financialAdapterService.isNewEconomicModelActive(undefined)).toBe(false)

    const testCareerTeam = {
      id: 'team_audi',
      career_settings: { economic_model: 'FIN-EVO-03' },
    }
    expect(financialAdapterService.isNewEconomicModelActive(testCareerTeam)).toBe(true)

    const testCareerTeamConfigVersion = {
      id: 'team_cadillac',
      career_settings: { versioned_economic_config_version: 'v1.0.0' },
    }
    expect(financialAdapterService.isNewEconomicModelActive(testCareerTeamConfigVersion)).toBe(true)
  })

  // =========================================================================
  // GATES OBRIGATÓRIOS DO PASSO 4: IDEMPOTÊNCIA E RECONCILIAÇÃO
  // =========================================================================

  it('IDEMPOTÊNCIA FINANCEIRA: reprocessamento da mesma rodada e mês não cria lançamentos duplicados', async () => {
    const mockDb = new Map<string, any>()

    vi.spyOn(pb.collection('financial_ledger'), 'getFirstListItem').mockImplementation(
      async (filter: string) => {
        const match = filter.match(/idempotency_key = "([^"]+)"/)
        if (match && mockDb.has(match[1])) {
          return mockDb.get(match[1])
        }
        throw new Error('Not found')
      },
    )

    vi.spyOn(pb.collection('financial_ledger'), 'create').mockImplementation(
      async (payload: any) => {
        if (mockDb.has(payload.idempotency_key)) {
          throw new Error(`Unique constraint failed: ${payload.idempotency_key}`)
        }
        const record = {
          id: `rec_${mockDb.size + 1}`,
          ...payload,
          created: new Date().toISOString(),
        }
        mockDb.set(payload.idempotency_key, record)
        return record
      },
    )

    vi.spyOn(pb.collection('teams'), 'update').mockResolvedValue({ id: 'team_audi' } as any)
    vi.spyOn(financialLedgerService, 'getTeamTransactions').mockImplementation(async () => {
      return Array.from(mockDb.values()).map((r) => ({
        ...r,
        cash_impact: r.cash_impact,
        cost_cap_impact: r.cost_cap_impact,
      }))
    })

    const context: RoundEconomicContext = {
      careerId: 'career_alpha',
      teamId: 'team_audi',
      seasonYear: 2026,
      round: 1,
      isSprintRound: false,
      gpWon: false,
      sprintWon: false,
      logisticsZone: 'standard',
    }

    // 1ª execução
    const firstRun = await financialAdapterService.postWeekendEventFinances(
      context,
      dummyRules,
      'v1.0.0',
    )
    const initialTxsCount = mockDb.size
    expect(firstRun.transactions.length).toBe(2) // cota de participação + operação
    expect(initialTxsCount).toBe(2)

    // 2ª execução com os mesmos parâmetros (simulando duplo clique / reprocessamento)
    const secondRun = await financialAdapterService.postWeekendEventFinances(
      context,
      dummyRules,
      'v1.0.0',
    )
    expect(secondRun.transactions.length).toBe(2)
    // O banco NÃO pode ter crescido
    expect(mockDb.size).toBe(initialTxsCount)

    vi.restoreAllMocks()
  })

  it('IDEMPOTÊNCIA FINANCEIRA: fechamento anual repetido não duplica lançamentos nem corrompe saldo', async () => {
    const mockDb = new Map<string, any>()

    vi.spyOn(pb.collection('financial_ledger'), 'getFirstListItem').mockImplementation(
      async (filter: string) => {
        const match = filter.match(/idempotency_key = "([^"]+)"/)
        if (match && mockDb.has(match[1])) {
          return mockDb.get(match[1])
        }
        throw new Error('Not found')
      },
    )

    vi.spyOn(pb.collection('financial_ledger'), 'create').mockImplementation(
      async (payload: any) => {
        const record = {
          id: `rec_${mockDb.size + 1}`,
          ...payload,
          created: new Date().toISOString(),
        }
        mockDb.set(payload.idempotency_key, record)
        return record
      },
    )

    vi.spyOn(pb.collection('teams'), 'update').mockResolvedValue({ id: 'team_audi' } as any)
    vi.spyOn(financialLedgerService, 'getTeamTransactions').mockImplementation(async () => {
      return Array.from(mockDb.values())
    })

    const seasonCloseContext: SeasonEndEconomicContext = {
      careerId: 'career_alpha',
      teamId: 'team_audi',
      seasonYear: 2026,
      totalTeams: 12,
      finalRank: 5,
      gpWins: 2,
      sprintWins: 0,
      calendarGps: 24,
      calendarSprints: 6,
      c0Reference: 260.0,
      fixedSponsorship: 50.0,
      costs: {
        facilities: 15,
        drivers_payroll: 20,
        staff_payroll: 30,
        power_unit: 20,
        race_operations: 18,
        car_developments: 22,
        next_season_prep: 15,
      },
      ownerInjection: 10.0,
      newLoans: 5.0,
      debtAmortization: 2.0,
      openingCashMillions: 91.0,
      configVersion: 'v1.0.0-draft',
    }

    // 1ª execução de fechamento anual
    const res1 = await financialAdapterService.executeSeasonEndFinancialSettlement(
      seasonCloseContext,
      dummyRules,
    )
    const countAfterFirst = mockDb.size
    expect(res1.postedTransactions.length).toBeGreaterThan(0)

    // 2ª execução (duplo clique ou retry após queda de conexão)
    const res2 = await financialAdapterService.executeSeasonEndFinancialSettlement(
      seasonCloseContext,
      dummyRules,
    )
    expect(mockDb.size).toBe(countAfterFirst)
    expect(res2.closingCashUnits).toBe(res1.closingCashUnits)

    vi.restoreAllMocks()
  })

  it('SEPARAÇÃO CONTÁBIL: aportes de proprietário e empréstimos bancários não inflam receita operacional', async () => {
    const postedEntries: any[] = []
    vi.spyOn(financialLedgerService, 'postTransaction').mockImplementation(async (params) => {
      postedEntries.push(params)
      return { transaction: params as any, wasAlreadyProcessed: false }
    })
    vi.spyOn(financialLedgerService, 'syncTeamBudgetCache').mockResolvedValue({
      cashBalance: 100_000_000,
      costCapSpent: 120_000_000,
    })

    const seasonContext: SeasonEndEconomicContext = {
      careerId: 'career_beta',
      teamId: 'team_audi',
      seasonYear: 2026,
      totalTeams: 12,
      finalRank: 3,
      gpWins: 1,
      sprintWins: 0,
      calendarGps: 24,
      calendarSprints: 6,
      c0Reference: 260.0,
      fixedSponsorship: 60.0,
      costs: {
        facilities: 15,
        drivers_payroll: 20,
        staff_payroll: 30,
        power_unit: 20,
        race_operations: 18,
        car_developments: 22,
        next_season_prep: 15,
      },
      ownerInjection: 25.0, // US$ 25M de aporte
      newLoans: 15.0, // US$ 15M de novo empréstimo
      debtAmortization: 5.0,
      openingCashMillions: 80.0,
      configVersion: 'v1.0.0',
    }

    const res = await financialAdapterService.executeSeasonEndFinancialSettlement(
      seasonContext,
      dummyRules,
    )

    // O total_revenue apurado na calculadora NÃO inclui owner injection nem new loans
    expect(res.annualCalculation.revenues.total_revenue).toBeLessThan(
      res.annualCalculation.closing_cash,
    )

    // Verifica que os lançamentos de financiamento possuem categoria ownerFunding / otherExpense e type adjustment
    const injectionTx = postedEntries.find((e) => e.subcategory === 'capital_injection')
    expect(injectionTx).toBeDefined()
    expect(injectionTx.type).toBe('adjustment')
    expect(injectionTx.category).toBe('ownerFunding')
    expect(injectionTx.costCapClassification).toBe('excluded')

    const loanTx = postedEntries.find((e) => e.subcategory === 'bank_loan_funding')
    expect(loanTx).toBeDefined()
    expect(loanTx.type).toBe('adjustment')
    expect(loanTx.costCapClassification).toBe('excluded')

    vi.restoreAllMocks()
  })

  it('ISOLAMENTO DE CARREIRAS: segunda carreira não herda transações ou saldo da primeira', () => {
    const keyCareer1 = buildDeterministicFactKey({
      careerId: 'carreira_1',
      teamId: 'team_audi',
      seasonYear: 2026,
      rubric: 'participation_gp',
      periodOrRound: 1,
    })
    const keyCareer2 = buildDeterministicFactKey({
      careerId: 'carreira_2',
      teamId: 'team_audi',
      seasonYear: 2026,
      rubric: 'participation_gp',
      periodOrRound: 1,
    })

    expect(keyCareer1).not.toBe(keyCareer2)
    expect(keyCareer1).toContain('carreira_1')
    expect(keyCareer2).toContain('carreira_2')
  })

  it('FALHA PARCIAL E RECUPERAÇÃO: falha entre gravação do lançamento e atualização do cache reexecuta sem duplicar dinheiro', async () => {
    const mockTxs = new Map<string, any>()
    let teamBudgetCached = 50_000_000

    vi.spyOn(pb.collection('financial_ledger'), 'getFirstListItem').mockImplementation(
      async (filter: string) => {
        const match = filter.match(/idempotency_key = "([^"]+)"/)
        if (match && mockTxs.has(match[1])) {
          return mockTxs.get(match[1])
        }
        throw new Error('Not found')
      },
    )

    vi.spyOn(pb.collection('financial_ledger'), 'create').mockImplementation(
      async (payload: any) => {
        const record = {
          id: `rec_${mockTxs.size + 1}`,
          ...payload,
          created: new Date().toISOString(),
        }
        mockTxs.set(payload.idempotency_key, record)
        return record
      },
    )

    vi.spyOn(financialLedgerService, 'getTeamTransactions').mockImplementation(async () => {
      return Array.from(mockTxs.values())
    })

    let failOnSync = true
    vi.spyOn(pb.collection('teams'), 'update').mockImplementation(
      async (_id: string, data: any) => {
        if (failOnSync) {
          throw new Error('Simulated network disconnect during team cache sync')
        }
        teamBudgetCached = data.budget
        return { id: 'team_audi', budget: teamBudgetCached } as any
      },
    )

    const params = {
      teamId: 'team_audi',
      seasonYear: 2026,
      round: 1,
      type: 'revenue' as const,
      category: 'otherRevenue' as const,
      direction: 'inflow' as const,
      amount: 1_000_000,
      sourceSystem: 'test_recovery',
      idempotencyKey: 'tx_fail_and_recover_key_001',
      description: 'Lançamento de teste com simulação de falha de rede',
    }

    // 1ª tentativa: falha durante a sincronização do cache de teams
    let errorCaught = false
    try {
      await financialLedgerService.postTransaction(params)
    } catch {
      // Como a transação já foi gravada antes do sync, a gravação ocorreu
      errorCaught = true
    }
    // A transação foi criada no ledger
    expect(mockTxs.has('tx_fail_and_recover_key_001')).toBe(true)

    // 2ª tentativa (reexecução / retry): falha cessou
    failOnSync = false
    const resRetry = await financialLedgerService.postTransaction(params)
    expect(resRetry.wasAlreadyProcessed).toBe(true)

    // O cache é reconciliado corretamente sem duplicar o lançamento
    const syncRes = await financialLedgerService.syncTeamBudgetCache('team_audi', 2026)
    expect(syncRes.cashBalance).toBe(1_000_000)
    expect(mockTxs.size).toBe(1)

    vi.restoreAllMocks()
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

  it('deve retornar null se a classificação de construtores for vazia', () => {
    expect(teamReplacementService.identifyLastPlaceTeam([])).toBeNull()
    expect(teamReplacementService.identifyLastPlaceTeam(null as any)).toBeNull()
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
    for (const cand of candidates) {
      expect(currentKeys).not.toContain(cand.key.toLowerCase())
    }
  })

  it('deve lidar quando todas as candidatas do catálogo já estiverem inscritas (ausência de elegíveis)', () => {
    // Passar uma lista que contenha todas as chaves possíveis do catálogo
    const candidates = teamReplacementService.getEligibleReplacementTeams([
      'porsche',
      'andretti',
      'toyota',
      'honda_racing',
      'bmw_motorsport',
      'lotus',
      'ford',
      'hyundai',
      'lamborghini',
      'audi',
      'cadillac',
      'haas',
      'mclaren',
      'ferrari',
      'redbull',
      'mercedes',
      'aston_martin',
      'alpine',
      'williams',
      'racing_bulls',
      'sauber',
    ])
    // Se não há elegíveis, deve retornar array vazio com segurança
    expect(candidates).toBeInstanceOf(Array)
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

  it('deve rejeitar tentativa de substituir equipe que NÃO é encontrada no grid', () => {
    const currentKeys = ['mclaren', 'ferrari', 'haas', 'cadillac']
    const res = teamReplacementService.applyGridReplacement({
      currentGridKeys: currentKeys,
      lastPlaceTeamKey: 'inexistent_team_xyz',
      replacementTeamKey: 'porsche',
    })

    expect(res.success).toBe(false)
    expect(res.reason).toContain('não foi localizada no grid')
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

  it('DECISÃO EXPLÍCITA: última colocada pode ser mantida com replacementDecision = KEEP', async () => {
    const mockStorage = new Map<string, any>()
    vi.spyOn(pb.collection('season_transitions'), 'getFirstListItem').mockImplementation(
      async (filter: string) => {
        const match = filter.match(/transition_key="([^"]+)"/)
        if (match && mockStorage.has(match[1])) {
          return mockStorage.get(match[1])
        }
        throw new Error('Not found')
      },
    )
    vi.spyOn(pb.collection('season_transitions'), 'create').mockImplementation(
      async (payload: any) => {
        mockStorage.set(payload.transition_key, payload)
        return payload
      },
    )

    const decisionRecord: ReplacementRecord = {
      transitionKey: 'replacement_2026->2027_cadillac',
      fromSeasonYear: 2026,
      toSeasonYear: 2027,
      lastPlaceTeamId: 'cadillac',
      lastPlaceTeamName: 'Cadillac F1',
      decision: 'KEEP',
      officialRankingReference: 'Mundial de Construtores 2026 - P10',
      confirmed: true,
      applied: false,
      createdAt: new Date().toISOString(),
    }

    await teamReplacementService.saveReplacementDecision(decisionRecord)
    const persisted = await teamReplacementService.getPersistedReplacementDecision(
      2026,
      2027,
      'cadillac',
    )

    expect(persisted).not.toBeNull()
    expect(persisted?.decision).toBe('KEEP')
    expect(persisted?.replacementTeamKey).toBeUndefined()

    vi.restoreAllMocks()
  })

  it('IDEMPOTÊNCIA DA DECISÃO: reload ou salvamento repetido da decisão preserva o registro sem duplicar', async () => {
    let updateCount = 0
    let createCount = 0
    const transitionKey = 'replacement_2026->2027_cadillac'

    vi.spyOn(pb.collection('season_transitions'), 'getFirstListItem').mockImplementation(
      async () => {
        if (createCount > 0) {
          return {
            id: 'st_001',
            transition_key: transitionKey,
            snapshot_data: {
              replacementDecision: {
                transitionKey,
                fromSeasonYear: 2026,
                toSeasonYear: 2027,
                lastPlaceTeamId: 'cadillac',
                decision: 'REPLACE',
                replacementTeamKey: 'porsche',
                confirmed: true,
                applied: false,
              },
            },
          } as any
        }
        throw new Error('Not found')
      },
    )

    vi.spyOn(pb.collection('season_transitions'), 'create').mockImplementation(async () => {
      createCount++
      return { id: 'st_001' } as any
    })

    vi.spyOn(pb.collection('season_transitions'), 'update').mockImplementation(async () => {
      updateCount++
      return { id: 'st_001' } as any
    })

    const decisionRecord: ReplacementRecord = {
      transitionKey,
      fromSeasonYear: 2026,
      toSeasonYear: 2027,
      lastPlaceTeamId: 'cadillac',
      lastPlaceTeamName: 'Cadillac F1',
      decision: 'REPLACE',
      replacementTeamKey: 'porsche',
      replacementTeamName: 'Porsche Motorsport',
      officialRankingReference: 'Mundial 2026 - P10',
      confirmed: true,
      applied: false,
      createdAt: new Date().toISOString(),
    }

    // 1ª gravação -> create
    await teamReplacementService.saveReplacementDecision(decisionRecord)
    expect(createCount).toBe(1)
    expect(updateCount).toBe(0)

    // 2ª gravação -> update idempotente sem criar nova entrada
    await teamReplacementService.saveReplacementDecision(decisionRecord)
    expect(createCount).toBe(1)
    expect(updateCount).toBe(1)

    vi.restoreAllMocks()
  })
})
