/**
 * Calculadora Anual Isolada de Finanças — FIN-SOURCE-01A (FIN-EVO-03).
 *
 * REGRAS E DIRETRIZES:
 * 1. Todos os parâmetros e coeficientes vêm da configuração versionada (FinancialEconomicRules).
 * 2. Ausência ou invalidade de parâmetros gera erro explícito (sem eval, sem IFERROR(..., 0) silencioso).
 * 3. Fórmulas estritamente fiéis às abas Resultados/Regras do arquivo 03_FIN_EVO_FORMULAS_E_FONTE.
 * 4. P = (N - posicao) / (N - 1), para N > 1 e 1 <= posicao <= N; senao 0.
 * 5. W = V / (V + G / divisor_w), divisor_w = win_curve_calendar_divisor (4); W = 0 se G = 0.
 * 6. Aporte do proprietário NÃO é receita (é financiamento do caixa).
 * 7. Reserva indicativa NÃO é despesa.
 * 8. Unidade monetária: US$ Milhões (padrão da fonte).
 */

import { FinancialEconomicRules } from './types'

export interface AnnualPlanInputs {
  /** Número total de equipes participantes (N, ex: 12) */
  total_teams: number
  /** Posição final da equipe no campeonato de construtores (1 <= posicao <= total_teams) */
  championship_position: number
  /** Quantidade de Grandes Prêmios no calendário anual (G, ex: 24) */
  calendar_gps: number
  /** Quantidade de corridas Sprint no calendário anual (Gs, ex: 6) */
  calendar_sprints: number
  /** Quantidade de vitórias em GPs conquistadas pela equipe (V) */
  gp_wins: number
  /** Quantidade de vitórias em Sprints conquistadas pela equipe (Vs) */
  sprint_wins: number
  /** Cref / C0 comercial de referência da equipe (ex: 260) */
  c0_reference: number
  /** Índice de reajuste de custos/receitas da cota de participação (ex: 1.0) */
  cost_index?: number
  /** Patrocínio fixo total informado/contratado no ano (ex: 130) */
  fixed_sponsorship: number
  /** Outras receitas do programa anual (ex: 0) */
  other_revenues?: number
  /** Fração de bônus de pessoal (ex: 0.25) */
  staff_bonus_fraction: number
  /** Regime de bônus de equipe: "Participação" ou "Manual" */
  bonus_regime: 'Participação' | 'Manual'
  /** Valor manual de bônus anual caso regime seja "Manual" (ex: 0) */
  manual_bonus?: number
  /** Aporte financeiro do proprietário no ano (NÃO entra em receitas) */
  owner_capital_injection?: number
  /** Novos empréstimos captados no ano */
  new_loans?: number
  /** Amortização efetiva de dívida paga no ano */
  debt_amortization?: number
  /** Caixa inicial / de abertura do ano */
  opening_cash: number
  /** Reserva indicativa estipulada para o ano (ex: 65) */
  indicative_reserve?: number
}

export interface AnnualCostInputs {
  /** Estruturas: funcionamento / manutenção recorrente (ex: 55.6) */
  facilities: number
  /** Folha anual e bolsas de pilotos (ex: 9.0) */
  drivers_payroll: number
  /** Folha anual e encargos de funcionários / staff (ex: 54.8) */
  staff_payroll: number
  /** Custo anual do fornecimento da unidade de potência / PU (ex: 31.0) */
  power_unit: number
  /** Custo operacional de logística e corridas (ex: 28.0) */
  race_operations: number
  /** Custo anual de evoluções e primeiros lotes de peças (ex: 25.28) */
  car_developments: number
  /** Custo de preparação para a temporada seguinte (ex: 27.78) */
  next_season_prep: number
  /** Custos extras e reposições extraordinárias (ex: 0.0) */
  extra_costs?: number
  /** Juros da dívida pagos no ano (ex: 0.0) */
  debt_interest?: number
  /** Investimento anual em expansão de infraestrutura / obras (ex: 0.0) */
  expansion_investments?: number
}

export interface AnnualRevenueBreakdown {
  /** Cota de participação anual (fixa + por GP + por Sprint) x reajuste */
  participation_quota: number
  /** Patrocínio fixo comercial anual */
  fixed_sponsorship: number
  /** Bônus patrocinado por vitórias em GPs: C0 x coef_vit x W */
  sponsor_wins_bonus: number
  /** Bônus patrocinado por posição no campeonato: C0 x coef_pos x P */
  sponsor_position_bonus: number
  /** Prêmio esportivo por GPs vencidos: premio_gp x V */
  gp_wins_prize: number
  /** Prêmio esportivo por Sprints vencidas: premio_sprint x Vs */
  sprint_wins_prize: number
  /** Prêmio esportivo de construtores: base_min + amplitude x P + (bonus_campea se pos=1) */
  constructors_prize: number
  /** Outras receitas diversas */
  other_revenues: number
  /** Total consolidado de receitas do programa */
  total_revenue: number
}

export interface AnnualCostBreakdown {
  /** Estruturas recorrentes */
  facilities: number
  /** Folha de pilotos */
  drivers_payroll: number
  /** Folha de funcionários / staff */
  staff_payroll: number
  /** Unidade de potência */
  power_unit: number
  /** Operação de corridas / logística */
  race_operations: number
  /** Evoluções do carro atual */
  car_developments: number
  /** Preparação temporada seguinte */
  next_season_prep: number
  /** Custos extras */
  extra_costs: number
  /** Bônus de pessoal pago */
  staff_bonus: number
  /** Juros da dívida */
  debt_interest: number
  /** Total de custos do programa anual */
  total_costs: number
}

export interface AnnualFinancialResults {
  /** Fator de posição esportivo P normalizado entre 0 e 1 */
  p_factor: number
  /** Fator de curva de vitórias W entre 0 e 1 */
  w_factor: number
  /** Detalhamento completo de receitas */
  revenues: AnnualRevenueBreakdown
  /** Detalhamento completo de custos operacionais */
  costs: AnnualCostBreakdown
  /** Investimento em expansão / obras físicas */
  expansion_investments: number
  /** Saldo operacional antes de financiamento: receitas - custos - investimentos */
  balance_before_financing: number
  /** Aportes de capital do proprietário */
  owner_capital_injection: number
  /** Novos empréstimos tomados */
  new_loans: number
  /** Amortização de dívidas paga */
  debt_amortization: number
  /** Financiamento líquido: aportes + empréstimos - amortizações */
  net_financing: number
  /** Variação teórica anual do saldo: saldo antes financ + financ líquido */
  theoretical_variation: number
  /** Caixa inicial / de abertura */
  opening_cash: number
  /** Caixa de encerramento do ano */
  closing_cash: number
  /** Caixa sem aportes do proprietário */
  cash_without_owner_injections: number
  /** Reserva indicativa estipulada */
  indicative_reserve: number
  /** Diagnóstico de excedente de orçamento sem vitórias */
  surplus_warning: 'SEM ALERTA' | 'REVER EXCEDENTE'
}

/**
 * Validador estrito para números finitos válidos.
 */
function assertValidNumber(val: unknown, name: string): number {
  if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
    throw new Error(`[annualCalculator] Parâmetro '${name}' inválido ou ausente: ${String(val)}`)
  }
  return val
}

/**
 * Calcula o Fator de Posição P:
 * P = (N - posicao) / (N - 1), para N > 1 e 1 <= posicao <= N; senão 0.
 * Fonte: Resultados!B56 / 03_FIN_EVO_FORMULAS_E_FONTE.
 */
export function calculatePositionFactor(totalTeams: number, position: number): number {
  assertValidNumber(totalTeams, 'totalTeams')
  assertValidNumber(position, 'position')

  if (totalTeams > 1 && position >= 1 && position <= totalTeams) {
    return (totalTeams - position) / (totalTeams - 1)
  }
  return 0
}

/**
 * Calcula o Fator de Vitórias W:
 * W = V / (V + G / divisor_w), divisor_w = win_curve_calendar_divisor (4).
 * Se G <= 0 ou V <= 0, W = 0.
 * Fonte: Resultados!B57 / 03_FIN_EVO_FORMULAS_E_FONTE.
 */
export function calculateWinFactor(
  gpWins: number,
  calendarGps: number,
  calendarDivisor: number,
): number {
  assertValidNumber(gpWins, 'gpWins')
  assertValidNumber(calendarGps, 'calendarGps')
  assertValidNumber(calendarDivisor, 'calendarDivisor')

  if (calendarDivisor <= 0) {
    throw new Error(
      `[annualCalculator] Divisor da curva W deve ser positivo. Recebido: ${calendarDivisor}`,
    )
  }

  if (calendarGps <= 0 || gpWins <= 0) {
    return 0
  }

  return gpWins / (gpWins + calendarGps / calendarDivisor)
}

/**
 * Executa o cálculo econômico anual completo para uma temporada.
 */
export function calculateAnnualFinances(
  rules: FinancialEconomicRules,
  plan: AnnualPlanInputs,
  costs: AnnualCostInputs,
): AnnualFinancialResults {
  if (!rules) {
    throw new Error(
      '[annualCalculator] Regras econômicas ausentes. Requer objeto FinancialEconomicRules válido.',
    )
  }
  if (!plan) {
    throw new Error('[annualCalculator] Entradas de planejamento ausentes.')
  }
  if (!costs) {
    throw new Error('[annualCalculator] Entradas de custos ausentes.')
  }

  // Validação estrita das regras necessárias
  const partAnnualFixed = assertValidNumber(
    rules.participation_annual_fixed,
    'participation_annual_fixed',
  )
  const partPerGp = assertValidNumber(rules.participation_per_gp, 'participation_per_gp')
  const partPerSprint = assertValidNumber(
    rules.participation_per_sprint,
    'participation_per_sprint',
  )
  const gpWinPrize = assertValidNumber(rules.gp_win_prize, 'gp_win_prize')
  const sprintWinPrize = assertValidNumber(rules.sprint_win_prize, 'sprint_win_prize')
  const constrMinPrize = assertValidNumber(
    rules.constructors_minimum_prize,
    'constructors_minimum_prize',
  )
  const constrAmp = assertValidNumber(
    rules.constructors_position_amplitude,
    'constructors_position_amplitude',
  )
  const constrChampBonus = assertValidNumber(
    rules.constructors_champion_bonus,
    'constructors_champion_bonus',
  )
  const sponsorPosCoef = assertValidNumber(
    rules.sponsor_position_coefficient,
    'sponsor_position_coefficient',
  )
  const sponsorWinCoef = assertValidNumber(
    rules.sponsor_wins_coefficient,
    'sponsor_wins_coefficient',
  )
  const winCurveDivisor = assertValidNumber(
    rules.win_curve_calendar_divisor,
    'win_curve_calendar_divisor',
  )
  const surplusFraction = assertValidNumber(
    rules.no_gp_wins_surplus_warning_fraction,
    'no_gp_wins_surplus_warning_fraction',
  )

  // Entradas de planejamento
  const totalTeams = assertValidNumber(plan.total_teams, 'plan.total_teams')
  const position = assertValidNumber(plan.championship_position, 'plan.championship_position')
  const calendarGps = assertValidNumber(plan.calendar_gps, 'plan.calendar_gps')
  const calendarSprints = assertValidNumber(plan.calendar_sprints, 'plan.calendar_sprints')
  const gpWins = assertValidNumber(plan.gp_wins, 'plan.gp_wins')
  const sprintWins = assertValidNumber(plan.sprint_wins, 'plan.sprint_wins')
  const c0Ref = assertValidNumber(plan.c0_reference, 'plan.c0_reference')
  const costIndex =
    plan.cost_index !== undefined ? assertValidNumber(plan.cost_index, 'plan.cost_index') : 1.0
  const fixedSponsorship = assertValidNumber(plan.fixed_sponsorship, 'plan.fixed_sponsorship')
  const otherRevenues =
    plan.other_revenues !== undefined
      ? assertValidNumber(plan.other_revenues, 'plan.other_revenues')
      : 0.0
  const staffBonusFraction = assertValidNumber(
    plan.staff_bonus_fraction,
    'plan.staff_bonus_fraction',
  )
  const ownerInjection =
    plan.owner_capital_injection !== undefined
      ? assertValidNumber(plan.owner_capital_injection, 'plan.owner_capital_injection')
      : 0.0
  const newLoans =
    plan.new_loans !== undefined ? assertValidNumber(plan.new_loans, 'plan.new_loans') : 0.0
  const debtAmortization =
    plan.debt_amortization !== undefined
      ? assertValidNumber(plan.debt_amortization, 'plan.debt_amortization')
      : 0.0
  const openingCash = assertValidNumber(plan.opening_cash, 'plan.opening_cash')
  const indicativeReserve =
    plan.indicative_reserve !== undefined
      ? assertValidNumber(plan.indicative_reserve, 'plan.indicative_reserve')
      : 0.0

  // 1. Fatores de desempenho esportivo P e W
  const pFactor = calculatePositionFactor(totalTeams, position)
  const wFactor = calculateWinFactor(gpWins, calendarGps, winCurveDivisor)

  // 2. Receitas
  // Cota de participação: =(Regras!B6 + Regras!B7*GPs + Regras!B8*Sprints) * reajuste
  const participationQuota =
    (partAnnualFixed + partPerGp * calendarGps + partPerSprint * calendarSprints) * costIndex

  // Bônus patrocinado de vitórias: C0 * coef_vit * W (se GPs > 0)
  const sponsorWinsBonus = calendarGps > 0 ? c0Ref * sponsorWinCoef * wFactor : 0.0

  // Bônus patrocinado de posição: C0 * coef_pos * P (se GPs > 0)
  const sponsorPositionBonus = calendarGps > 0 ? c0Ref * sponsorPosCoef * pFactor : 0.0

  // Prêmios por GPs e Sprints vencidos
  const gpWinsPrize = gpWins * gpWinPrize
  const sprintWinsPrize = sprintWins * sprintWinPrize

  // Prêmio de construtores: se GPs > 0 => min + amp * P + (bonus_campeao se pos == 1)
  const constructorsPrize =
    calendarGps > 0
      ? constrMinPrize + constrAmp * pFactor + (position === 1 ? constrChampBonus : 0.0)
      : 0.0

  const totalRevenue =
    participationQuota +
    fixedSponsorship +
    sponsorWinsBonus +
    sponsorPositionBonus +
    gpWinsPrize +
    sprintWinsPrize +
    constructorsPrize +
    otherRevenues

  // 3. Custos Operacionais
  const facilitiesCost = assertValidNumber(costs.facilities, 'costs.facilities')
  const driversPayroll = assertValidNumber(costs.drivers_payroll, 'costs.drivers_payroll')
  const staffPayroll = assertValidNumber(costs.staff_payroll, 'costs.staff_payroll')
  const powerUnitCost = assertValidNumber(costs.power_unit, 'costs.power_unit')
  const raceOpsCost = assertValidNumber(costs.race_operations, 'costs.race_operations')
  const carDevCost = assertValidNumber(costs.car_developments, 'costs.car_developments')
  const nextSeasonPrepCost = assertValidNumber(costs.next_season_prep, 'costs.next_season_prep')
  const extraCosts =
    costs.extra_costs !== undefined
      ? assertValidNumber(costs.extra_costs, 'costs.extra_costs')
      : 0.0
  const debtInterest =
    costs.debt_interest !== undefined
      ? assertValidNumber(costs.debt_interest, 'costs.debt_interest')
      : 0.0
  const expansionInvestments =
    costs.expansion_investments !== undefined
      ? assertValidNumber(costs.expansion_investments, 'costs.expansion_investments')
      : 0.0

  // Bônus de pessoal:
  // Se regime == "Participação": staffBonusFraction * (sponsorWinsBonus + gpWinsPrize + sprintWinsPrize)
  // Se regime == "Manual": manual_bonus
  let staffBonus = 0.0
  if (plan.bonus_regime === 'Participação') {
    staffBonus = staffBonusFraction * (sponsorWinsBonus + gpWinsPrize + sprintWinsPrize)
  } else if (plan.bonus_regime === 'Manual') {
    staffBonus =
      plan.manual_bonus !== undefined
        ? assertValidNumber(plan.manual_bonus, 'plan.manual_bonus')
        : 0.0
  } else {
    throw new Error(
      `[annualCalculator] Regime de bônus desconhecido: '${String(plan.bonus_regime)}'`,
    )
  }

  const totalCosts =
    facilitiesCost +
    driversPayroll +
    staffPayroll +
    powerUnitCost +
    raceOpsCost +
    carDevCost +
    nextSeasonPrepCost +
    extraCosts +
    staffBonus +
    debtInterest

  // 4. Saldos e Variações
  // Saldo antes de financiamento = receitas - custos - investimento em obras
  const balanceBeforeFinancing = totalRevenue - totalCosts - expansionInvestments

  // Financiamento líquido = aportes + novos empréstimos - amortização
  const netFinancing = ownerInjection + newLoans - debtAmortization

  // Variação teórica anual = saldo antes financiamento + financiamento líquido
  const theoreticalVariation = balanceBeforeFinancing + netFinancing

  // Caixa de encerramento = caixa de abertura + variação teórica
  // (Nota: no modelo consolidado anual sem defasagens, caixa encerramento = caixa anterior + saldo + aportes líquidos)
  const closingCash = openingCash + theoreticalVariation

  // Caixa acumulado sem aportes do proprietário
  // No ano corrente: fechamento sem considerar aportes
  const cashWithoutOwnerInjections = closingCash - ownerInjection

  // 5. Diagnóstico de alerta: excedente sem vitórias
  // Regra fonte: AND(gp_wins == 0, saldo > surplusFraction * (custos + obras)) => "REVER EXCEDENTE"
  const totalBaseExpenses = totalCosts + expansionInvestments
  const surplusWarning =
    gpWins === 0 && balanceBeforeFinancing > surplusFraction * totalBaseExpenses
      ? 'REVER EXCEDENTE'
      : 'SEM ALERTA'

  return {
    p_factor: pFactor,
    w_factor: wFactor,
    revenues: {
      participation_quota: participationQuota,
      fixed_sponsorship: fixedSponsorship,
      sponsor_wins_bonus: sponsorWinsBonus,
      sponsor_position_bonus: sponsorPositionBonus,
      gp_wins_prize: gpWinsPrize,
      sprint_wins_prize: sprintWinsPrize,
      constructors_prize: constructorsPrize,
      other_revenues: otherRevenues,
      total_revenue: totalRevenue,
    },
    costs: {
      facilities: facilitiesCost,
      drivers_payroll: driversPayroll,
      staff_payroll: staffPayroll,
      power_unit: powerUnitCost,
      race_operations: raceOpsCost,
      car_developments: carDevCost,
      next_season_prep: nextSeasonPrepCost,
      extra_costs: extraCosts,
      staff_bonus: staffBonus,
      debt_interest: debtInterest,
      total_costs: totalCosts,
    },
    expansion_investments: expansionInvestments,
    balance_before_financing: balanceBeforeFinancing,
    owner_capital_injection: ownerInjection,
    new_loans: newLoans,
    debt_amortization: debtAmortization,
    net_financing: netFinancing,
    theoretical_variation: theoreticalVariation,
    opening_cash: openingCash,
    closing_cash: closingCash,
    cash_without_owner_injections: cashWithoutOwnerInjections,
    indicative_reserve: indicativeReserve,
    surplus_warning: surplusWarning,
  }
}
