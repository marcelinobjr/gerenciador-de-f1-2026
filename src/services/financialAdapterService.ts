/**
 * financialAdapterService.ts — Adaptador Oficial da Economia Versionada ao Ledger Canônico.
 *
 * ESCOPO E DIRETRIZES (FIN-SOURCE-01B):
 * 1. Conecta o modelo validado na FIN-SOURCE-01A (annualCalculator.ts + FinancialEconomicRules)
 *    aos fatos contábeis reais e lançamentos granulares no financial_ledger.
 * 2. Unidades e Conversão:
 *    - Fonte (annualCalculator / 02_FIN_EVO): US$ Milhões (escala_usd = 1.000.000).
 *    - Ledger Canônico: Dólares / Unidades monetárias inteiras (cents rounding deterministic).
 * 3. Chaves Estáveis de Idempotência:
 *    - Cada fato possui identificação determinística: careerId, teamId, rubrica, fato/vencimento/parcela, temporada de origem.
 *    - Gravação da versão da configuração na proveniência/metadados.
 * 4. Isolamento Estrito:
 *    - Não ativa automaticamente em saves legados. Somente opera no modelo novo se a carreira/equipe tiver
 *      a flag ou configuração explicitamente habilitada (ex: team.career_settings?.economic_model === 'FIN-EVO-03'
 *      ou versioned_economic_config_version vinculada).
 * 5. Não duplicidade de lançamentos:
 *    - Ao processar a rodada ou fechamento no modelo novo, os caminhos legados são desviados / desativados.
 *    - Empréstimos, aportes e reservas são estritamente distinguidos de receita operacional.
 */

import pb from '@/lib/pocketbase/client'
import { FinancialEconomicRules, VersionedEconomicConfig } from '@/lib/finances/types'
import {
  calculateAnnualFinances,
  AnnualPlanInputs,
  AnnualCostInputs,
  AnnualFinancialResults,
} from '@/lib/finances/annualCalculator'
import { financialLedgerService, PostTransactionParams } from '@/services/financialLedgerService'
import { TeamModel } from '@/types/f1'

export interface FinancialFactKeyParams {
  careerId: string
  teamId: string
  seasonYear: number
  rubric: string
  subEntityId?: string | number
  periodOrRound: string | number
  originSeasonYear?: number
}

export function buildDeterministicFactKey(params: FinancialFactKeyParams): string {
  const origin = params.originSeasonYear ? `_orig${params.originSeasonYear}` : ''
  const sub = params.subEntityId ? `_${params.subEntityId}` : ''
  return `fin_${params.careerId}_${params.teamId}_${params.seasonYear}_${params.rubric}${sub}_p${params.periodOrRound}${origin}`
}

export function convertMillionsToLedgerUnits(millionsValue: number): number {
  if (!Number.isFinite(millionsValue)) return 0
  // 1 milhão = 1_000_000 unidades inteiras
  return Math.round(millionsValue * 1_000_000)
}

export function convertLedgerUnitsToMillions(units: number): number {
  if (!Number.isFinite(units)) return 0
  return units / 1_000_000
}

export interface RoundEconomicContext {
  careerId: string
  teamId: string
  seasonYear: number
  round: number
  totalRounds?: number
  isSprintRound?: boolean
  gpWon?: boolean
  sprintWon?: boolean
  logisticsZone?: 'regional' | 'standard' | 'long_distance' | 'complex'
}

export interface SeasonEndEconomicContext {
  careerId: string
  teamId: string
  seasonYear: number
  totalTeams: number
  finalRank: number
  gpWins: number
  sprintWins: number
  calendarGps: number
  calendarSprints: number
  c0Reference: number
  fixedSponsorship: number
  costs: AnnualCostInputs
  ownerInjection?: number
  newLoans?: number
  debtAmortization?: number
  openingCashMillions: number
  staffBonusFraction?: number
  bonusRegime?: 'Participação' | 'Manual'
  manualBonus?: number
  indicativeReserve?: number
  configVersion: string
}

export class FinancialAdapterService {
  /**
   * Checa se a equipe/carreira está habilitada para o modelo econômico FIN-EVO-03.
   * Não ativa silenciosamente em saves legados.
   */
  public isNewEconomicModelActive(team: Partial<TeamModel> | null | undefined): boolean {
    if (!team) return false
    const cs = (team as any).career_settings
    if (cs?.economic_model === 'FIN-EVO-03' || cs?.versioned_economic_config_version) {
      return true
    }
    // Suporte também se team.active_economic_config_id estiver explicitamente preenchido
    if ((team as any).active_economic_config_id || (team as any).economic_model_version) {
      return true
    }
    return false
  }

  /**
   * Processa o lançamento mensal/periódico das rubricas operacionais recorrentes (Folha de Staff, Pilotos, Manutenção, Motor).
   * Conforme a periodicidade do modelo aprovado (12 meses por ano), cada rodada ou avanço mensal
   * processa 1/12 determinístico com reconciliação de centavos na 12ª parcela.
   */
  public async postMonthlyOperationalObligations(params: {
    careerId: string
    teamId: string
    seasonYear: number
    monthNumber: number // 1 a 12
    rules: FinancialEconomicRules
    configVersion: string
    annualCosts: {
      facilitiesAnnualM: number
      driversPayrollAnnualM: number
      staffPayrollAnnualM: number
      powerUnitAnnualM: number
    }
  }): Promise<{ postedCount: number; transactions: any[] }> {
    const { careerId, teamId, seasonYear, monthNumber, rules, configVersion, annualCosts } = params
    const txs: any[] = []

    const rubricList = [
      {
        key: 'facilities',
        name: 'Estruturas e Instalações',
        totalM: annualCosts.facilitiesAnnualM,
        cat: 'infrastructureOpex' as const,
        cc: 'partial' as const,
      },
      {
        key: 'drivers_payroll',
        name: 'Folha de Pilotos',
        totalM: annualCosts.driversPayrollAnnualM,
        cat: 'driverSalaries' as const,
        cc: 'excluded' as const,
      },
      {
        key: 'staff_payroll',
        name: 'Folha de Pessoal e Engenharia',
        totalM: annualCosts.staffPayrollAnnualM,
        cat: 'staff' as const,
        cc: 'partial' as const,
      },
      {
        key: 'power_unit',
        name: 'Fornecimento de Unidade de Potência (PU)',
        totalM: annualCosts.powerUnitAnnualM,
        cat: 'development' as const,
        cc: 'included' as const,
      },
    ]

    for (const rub of rubricList) {
      // Cálculo determinístico da parcela: 12 parcelas mensais, resíduo no mês 12
      const totalUnits = convertMillionsToLedgerUnits(rub.totalM)
      const standardMonthly = Math.floor(totalUnits / 12)
      const remainder = totalUnits - standardMonthly * 12
      const amountForThisMonth = monthNumber === 12 ? standardMonthly + remainder : standardMonthly

      if (amountForThisMonth <= 0) continue

      const factKey = buildDeterministicFactKey({
        careerId,
        teamId,
        seasonYear,
        rubric: `opex_${rub.key}`,
        periodOrRound: monthNumber,
      })

      const res = await financialLedgerService.postTransaction({
        teamId,
        seasonYear,
        round: monthNumber, // alinhado ao período mensal
        type: 'expense',
        category: rub.cat,
        subcategory: `monthly_${rub.key}`,
        direction: 'outflow',
        amount: amountForThisMonth,
        costCapClassification: rub.cc,
        sourceSystem: 'financial_adapter_v3',
        sourceEntityId: factKey,
        idempotencyKey: factKey,
        description: `Custo Mensal [Mês ${monthNumber}/12] — ${rub.name}`,
        metadata: {
          configVersion,
          monthNumber,
          annualTotalM: rub.totalM,
          reconciledUnits: totalUnits,
        },
      })

      txs.push(res.transaction)
    }

    return { postedCount: txs.length, transactions: txs }
  }

  /**
   * Processa os fatos financeiros de um Grande Prêmio (Custo do Evento/Logística + Cota de Participação do GP + Bônus de Vitória se houver).
   */
  public async postWeekendEventFinances(
    context: RoundEconomicContext,
    rules: FinancialEconomicRules,
    configVersion: string,
  ): Promise<{ transactions: any[] }> {
    const {
      careerId,
      teamId,
      seasonYear,
      round,
      isSprintRound,
      gpWon,
      sprintWon,
      logisticsZone = 'standard',
    } = context
    const txs: any[] = []

    // 1. COTA DE PARTICIPAÇÃO POR GP (Receita da equipe pelo evento oficial)
    let participationM = rules.participation_per_gp
    if (isSprintRound) {
      participationM += rules.participation_per_sprint
    }
    const partUnits = convertMillionsToLedgerUnits(participationM)
    const partKey = buildDeterministicFactKey({
      careerId,
      teamId,
      seasonYear,
      rubric: 'participation_gp',
      periodOrRound: round,
    })

    const partRes = await financialLedgerService.postTransaction({
      teamId,
      seasonYear,
      round,
      type: 'revenue',
      category: 'otherRevenue',
      subcategory: 'participation_quota',
      direction: 'inflow',
      amount: partUnits,
      costCapClassification: 'excluded',
      sourceSystem: 'financial_adapter_v3',
      sourceEntityId: partKey,
      idempotencyKey: partKey,
      description: `Cota de Participação Oficial FIA — GP Round ${round}${isSprintRound ? ' (+Sprint)' : ''}`,
      metadata: { configVersion, round, isSprintRound, amountM: participationM },
    })
    txs.push(partRes.transaction)

    // 2. DESPESA OPERACIONAL DO GP (Logística + Operação de Fim de Semana)
    let logCostM = rules.logistics_standard
    if (logisticsZone === 'regional') logCostM = rules.logistics_regional
    else if (logisticsZone === 'long_distance') logCostM = rules.logistics_long_distance
    else if (logisticsZone === 'complex') logCostM = rules.logistics_complex

    let opCostM = rules.weekend_fixed_operation + logCostM
    if (isSprintRound) {
      opCostM += rules.sprint_incremental_operation
    }
    const opUnits = convertMillionsToLedgerUnits(opCostM)
    const opKey = buildDeterministicFactKey({
      careerId,
      teamId,
      seasonYear,
      rubric: 'race_ops_event',
      periodOrRound: round,
    })

    const opRes = await financialLedgerService.postTransaction({
      teamId,
      seasonYear,
      round,
      type: 'expense',
      category: 'raceOperations',
      subcategory: 'weekend_event_costs',
      direction: 'outflow',
      amount: opUnits,
      costCapClassification: 'included',
      sourceSystem: 'financial_adapter_v3',
      sourceEntityId: opKey,
      idempotencyKey: opKey,
      description: `Operação de Pista e Logística — GP Round ${round} (${logisticsZone})`,
      metadata: { configVersion, round, logisticsZone, opCostM },
    })
    txs.push(opRes.transaction)

    // 3. PRÊMIO POR VITÓRIA NO GP (se conquistado)
    if (gpWon) {
      const winUnits = convertMillionsToLedgerUnits(rules.gp_win_prize)
      const winKey = buildDeterministicFactKey({
        careerId,
        teamId,
        seasonYear,
        rubric: 'prize_gp_win',
        periodOrRound: round,
      })
      const winRes = await financialLedgerService.postTransaction({
        teamId,
        seasonYear,
        round,
        type: 'revenue',
        category: 'prizeMoney',
        subcategory: 'gp_win_prize',
        direction: 'inflow',
        amount: winUnits,
        costCapClassification: 'excluded',
        sourceSystem: 'financial_adapter_v3',
        sourceEntityId: winKey,
        idempotencyKey: winKey,
        description: `Prêmio Oficial FIA por Vitória — GP Round ${round}`,
        metadata: { configVersion, round, amountM: rules.gp_win_prize },
      })
      txs.push(winRes.transaction)
    }

    // 4. PRÊMIO POR VITÓRIA NO SPRINT (se conquistado)
    if (sprintWon) {
      const sprintWinUnits = convertMillionsToLedgerUnits(rules.sprint_win_prize)
      const sprintWinKey = buildDeterministicFactKey({
        careerId,
        teamId,
        seasonYear,
        rubric: 'prize_sprint_win',
        periodOrRound: round,
      })
      const sprintWinRes = await financialLedgerService.postTransaction({
        teamId,
        seasonYear,
        round,
        type: 'revenue',
        category: 'prizeMoney',
        subcategory: 'sprint_win_prize',
        direction: 'inflow',
        amount: sprintWinUnits,
        costCapClassification: 'excluded',
        sourceSystem: 'financial_adapter_v3',
        sourceEntityId: sprintWinKey,
        idempotencyKey: sprintWinKey,
        description: `Prêmio Oficial FIA por Vitória na Sprint — Round ${round}`,
        metadata: { configVersion, round, amountM: rules.sprint_win_prize },
      })
      txs.push(sprintWinRes.transaction)
    }

    return { transactions: txs }
  }

  /**
   * Processa o Fechamento Econômico Anual Conectado ao Ledger:
   * 1. Executa a calculadora anual isolada para obter o resultado consolidado e validações.
   * 2. Lança os direitos e obrigações apurados ao final da temporada (Prêmio de Construtores, Bônus de Patrocínio, Bônus de Pessoal, etc.).
   * 3. Registra eventos de financiamento (Aportes e Empréstimos) com rubricas próprias que NÃO inflam receitas operacionais.
   * 4. Sincroniza o saldo final com reconciliação estrita em centavos.
   */
  public async executeSeasonEndFinancialSettlement(
    context: SeasonEndEconomicContext,
    rules: FinancialEconomicRules,
  ): Promise<{
    annualCalculation: AnnualFinancialResults
    postedTransactions: any[]
    closingCashUnits: number
    reconciledBalanceDiscrepancyUnits: number
  }> {
    const {
      careerId,
      teamId,
      seasonYear,
      totalTeams,
      finalRank,
      gpWins,
      sprintWins,
      calendarGps,
      calendarSprints,
      c0Reference,
      fixedSponsorship,
      costs,
      ownerInjection = 0,
      newLoans = 0,
      debtAmortization = 0,
      openingCashMillions,
      staffBonusFraction = rules.staff_win_bonus_share,
      bonusRegime = 'Participação',
      manualBonus = 0,
      indicativeReserve = rules.initial_reserve_over_c0 * c0Reference,
      configVersion,
    } = context

    // 1. Executar a Calculadora Anual Isolada e Determinística
    const planInputs: AnnualPlanInputs = {
      total_teams: totalTeams,
      championship_position: finalRank,
      calendar_gps: calendarGps,
      calendar_sprints: calendarSprints,
      gp_wins: gpWins,
      sprint_wins: sprintWins,
      c0_reference: c0Reference,
      fixed_sponsorship: fixedSponsorship,
      staff_bonus_fraction: staffBonusFraction,
      bonus_regime: bonusRegime,
      manual_bonus: manualBonus,
      owner_capital_injection: ownerInjection,
      new_loans: newLoans,
      debt_amortization: debtAmortization,
      opening_cash: openingCashMillions,
      indicative_reserve: indicativeReserve,
    }

    const calcResult = calculateAnnualFinances(rules, planInputs, costs)
    const postedTxs: any[] = []

    // 2. Lançamento do PRÊMIO DE CONSTRUTORES (Premiação Homologada do Campeonato)
    if (calcResult.revenues.constructors_prize > 0) {
      const prizeUnits = convertMillionsToLedgerUnits(calcResult.revenues.constructors_prize)
      const prizeKey = buildDeterministicFactKey({
        careerId,
        teamId,
        seasonYear,
        rubric: 'constructors_prize',
        periodOrRound: 'season_end',
      })

      const tx = await financialLedgerService.postTransaction({
        teamId,
        seasonYear,
        round: calendarGps,
        type: 'revenue',
        category: 'prizeMoney',
        subcategory: 'constructors_championship_prize',
        direction: 'inflow',
        amount: prizeUnits,
        costCapClassification: 'excluded',
        sourceSystem: 'financial_adapter_v3',
        sourceEntityId: prizeKey,
        idempotencyKey: prizeKey,
        description: `Prêmio Mundial de Construtores — P${finalRank} (${seasonYear})`,
        metadata: { configVersion, finalRank, amountM: calcResult.revenues.constructors_prize },
      })
      postedTxs.push(tx.transaction)
    }

    // 3. Lançamento do BÔNUS COMERCIAL DE POSIÇÃO DE PATROCÍNIO (Sponsor Position Bonus)
    if (calcResult.revenues.sponsor_position_bonus > 0) {
      const sponsorBonusUnits = convertMillionsToLedgerUnits(
        calcResult.revenues.sponsor_position_bonus,
      )
      const sponsorBonusKey = buildDeterministicFactKey({
        careerId,
        teamId,
        seasonYear,
        rubric: 'sponsor_pos_bonus',
        periodOrRound: 'season_end',
      })

      const tx = await financialLedgerService.postTransaction({
        teamId,
        seasonYear,
        round: calendarGps,
        type: 'revenue',
        category: 'sponsorship',
        subcategory: 'sponsor_position_bonus',
        direction: 'inflow',
        amount: sponsorBonusUnits,
        costCapClassification: 'excluded',
        sourceSystem: 'financial_adapter_v3',
        sourceEntityId: sponsorBonusKey,
        idempotencyKey: sponsorBonusKey,
        description: `Bônus Contratual de Patrocínio por Posição no Campeonato (P${finalRank})`,
        metadata: { configVersion, finalRank, amountM: calcResult.revenues.sponsor_position_bonus },
      })
      postedTxs.push(tx.transaction)
    }

    // 4. Lançamento do BÔNUS COMERCIAL DE VITÓRIAS (Sponsor Wins Bonus)
    if (calcResult.revenues.sponsor_wins_bonus > 0) {
      const winsBonusUnits = convertMillionsToLedgerUnits(calcResult.revenues.sponsor_wins_bonus)
      const winsBonusKey = buildDeterministicFactKey({
        careerId,
        teamId,
        seasonYear,
        rubric: 'sponsor_wins_bonus',
        periodOrRound: 'season_end',
      })

      const tx = await financialLedgerService.postTransaction({
        teamId,
        seasonYear,
        round: calendarGps,
        type: 'revenue',
        category: 'sponsorship',
        subcategory: 'sponsor_wins_bonus',
        direction: 'inflow',
        amount: winsBonusUnits,
        costCapClassification: 'excluded',
        sourceSystem: 'financial_adapter_v3',
        sourceEntityId: winsBonusKey,
        idempotencyKey: winsBonusKey,
        description: `Bônus Contratual de Patrocínio por Desempenho (${gpWins} vitórias)`,
        metadata: { configVersion, gpWins, amountM: calcResult.revenues.sponsor_wins_bonus },
      })
      postedTxs.push(tx.transaction)
    }

    // 5. BÔNUS DE PESSOAL / STAFF (Despesa apurada pelos bônus conquistados)
    if (calcResult.costs.staff_bonus > 0) {
      const staffBonusUnits = convertMillionsToLedgerUnits(calcResult.costs.staff_bonus)
      const staffBonusKey = buildDeterministicFactKey({
        careerId,
        teamId,
        seasonYear,
        rubric: 'staff_bonus_payable',
        periodOrRound: 'season_end',
      })

      const tx = await financialLedgerService.postTransaction({
        teamId,
        seasonYear,
        round: calendarGps,
        type: 'expense',
        category: 'staff',
        subcategory: 'annual_staff_bonus',
        direction: 'outflow',
        amount: staffBonusUnits,
        costCapClassification: 'partial',
        sourceSystem: 'financial_adapter_v3',
        sourceEntityId: staffBonusKey,
        idempotencyKey: staffBonusKey,
        description: `Pagamento de Bônus Anual de Desempenho ao Corpo Técnico e Fábrica`,
        metadata: { configVersion, bonusRegime, amountM: calcResult.costs.staff_bonus },
      })
      postedTxs.push(tx.transaction)
    }

    // 6. EVENTOS DE FINANCIAMENTO: Aporte do Proprietário (NÃO é receita operacional)
    if (ownerInjection > 0) {
      const injectionUnits = convertMillionsToLedgerUnits(ownerInjection)
      const injectionKey = buildDeterministicFactKey({
        careerId,
        teamId,
        seasonYear,
        rubric: 'owner_injection',
        periodOrRound: 'season_end',
      })

      const tx = await financialLedgerService.postTransaction({
        teamId,
        seasonYear,
        round: calendarGps,
        type: 'adjustment',
        category: 'ownerFunding',
        subcategory: 'capital_injection',
        direction: 'inflow',
        amount: injectionUnits,
        costCapClassification: 'excluded',
        sourceSystem: 'financial_adapter_v3',
        sourceEntityId: injectionKey,
        idempotencyKey: injectionKey,
        description: `Aporte Financeiro de Capital do Acionista / Proprietário`,
        metadata: { configVersion, isFinancingNotRevenue: true, amountM: ownerInjection },
      })
      postedTxs.push(tx.transaction)
    }

    // 7. EVENTOS DE FINANCIAMENTO: Empréstimos e Amortizações
    if (newLoans > 0) {
      const loanUnits = convertMillionsToLedgerUnits(newLoans)
      const loanKey = buildDeterministicFactKey({
        careerId,
        teamId,
        seasonYear,
        rubric: 'new_loans',
        periodOrRound: 'season_end',
      })
      const tx = await financialLedgerService.postTransaction({
        teamId,
        seasonYear,
        round: calendarGps,
        type: 'adjustment',
        category: 'ownerFunding',
        subcategory: 'bank_loan_funding',
        direction: 'inflow',
        amount: loanUnits,
        costCapClassification: 'excluded',
        sourceSystem: 'financial_adapter_v3',
        sourceEntityId: loanKey,
        idempotencyKey: loanKey,
        description: `Captação de Linha de Crédito / Financiamento Bancário`,
        metadata: { configVersion, amountM: newLoans },
      })
      postedTxs.push(tx.transaction)
    }

    if (debtAmortization > 0) {
      const amortUnits = convertMillionsToLedgerUnits(debtAmortization)
      const amortKey = buildDeterministicFactKey({
        careerId,
        teamId,
        seasonYear,
        rubric: 'debt_amortization',
        periodOrRound: 'season_end',
      })
      const tx = await financialLedgerService.postTransaction({
        teamId,
        seasonYear,
        round: calendarGps,
        type: 'adjustment',
        category: 'otherExpense',
        subcategory: 'debt_principal_amortization',
        direction: 'outflow',
        amount: amortUnits,
        costCapClassification: 'excluded',
        sourceSystem: 'financial_adapter_v3',
        sourceEntityId: amortKey,
        idempotencyKey: amortKey,
        description: `Amortização de Principal de Dívida e Empréstimos`,
        metadata: { configVersion, amountM: debtAmortization },
      })
      postedTxs.push(tx.transaction)
    }

    // 8. Reconciliação do Caixa no Ledger
    const syncRes = await financialLedgerService.syncTeamBudgetCache(teamId, seasonYear)
    const expectedClosingUnits = convertMillionsToLedgerUnits(calcResult.closing_cash)
    const discrepancy = Math.abs(syncRes.cashBalance - expectedClosingUnits)

    return {
      annualCalculation: calcResult,
      postedTransactions: postedTxs,
      closingCashUnits: syncRes.cashBalance,
      reconciledBalanceDiscrepancyUnits: discrepancy,
    }
  }

  /**
   * Inicializa o saldo de abertura de uma nova temporada transportando o saldo exato
   * do encerramento da temporada anterior (sem re-creditamento de caixa inicial padrão).
   */
  public async carryOverClosingBalanceToNextSeason(params: {
    teamId: string
    fromSeasonYear: number
    toSeasonYear: number
    closingCashBalanceUnits: number
    configVersion: string
  }): Promise<void> {
    const { teamId, fromSeasonYear, toSeasonYear, closingCashBalanceUnits, configVersion } = params
    const idempotencyKey = `opening_balance_${teamId}_${toSeasonYear}`

    const existing = await financialLedgerService.getTransactionByIdempotencyKey(idempotencyKey)
    if (existing) {
      return // Já inicializado de forma idempotente
    }

    await financialLedgerService.postTransaction({
      teamId,
      seasonYear: toSeasonYear,
      round: 1,
      type: 'opening_balance',
      category: 'ownerFunding',
      subcategory: 'carryover_opening_balance',
      direction: 'inflow',
      amount: closingCashBalanceUnits,
      costCapClassification: 'excluded',
      sourceSystem: 'financial_adapter_v3',
      sourceEntityId: `season_${fromSeasonYear}_close`,
      idempotencyKey,
      description: `Transporte de Caixa de Encerramento (${fromSeasonYear} → ${toSeasonYear})`,
      metadata: {
        configVersion,
        fromSeasonYear,
        toSeasonYear,
        carriedOverCashUnits: closingCashBalanceUnits,
      },
    })
  }
}

export const financialAdapterService = new FinancialAdapterService()
export default financialAdapterService
