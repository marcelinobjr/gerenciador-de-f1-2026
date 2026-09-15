/**
 * FinancialLedgerService — Motor Canônico de Finanças, Orçamento e Cost Cap
 * Implementação Nº 5A (F1 2026/2027)
 *
 * Regras de Ouro:
 * 1. Caixa NÃO é Cost Cap.
 * 2. Toda receita e despesa possui uma origem rastreável (sourceSystem, sourceEntityId).
 * 3. Idempotência estrita: um evento econômico só pode ser lançado uma vez.
 * 4. Transações são imutáveis após efetivadas. Correções usam reversão / nova transação.
 * 5. O Financeiro apenas registra as consequências dos outros sistemas; não duplica bônus.
 */

import pb from '@/lib/pocketbase/client'
import { TeamModel, SeasonModel } from '@/types/f1'
import {
  FinancialTransaction,
  FinancialCommitment,
  InternalBudgetAllocation,
  CashSummary,
  CostCapSummary,
  FinancialAlert,
  FinancialImpactSimulation,
  FinancialIntegrityReport,
  FinancialCategory,
  ExpenseCategory,
  CostCapClassification,
  TransactionType,
  TransactionDirection,
  FinancialLedgerSnapshot,
} from '@/types/canonical-finances'

export const COST_CAP_ANNUAL_LIMIT = 215_000_000 // Teto oficial regulamentar FIA R$ 215M

export interface PostTransactionParams {
  teamId: string
  seasonYear: number
  round?: number
  type: TransactionType
  category: FinancialCategory
  subcategory?: string
  direction: TransactionDirection
  amount: number
  costCapClassification?: CostCapClassification
  costCapAmount?: number // Se omitido e for included, igual a amount; se excluded, 0
  sourceSystem: string
  sourceEntityId?: string
  idempotencyKey: string
  description: string
  metadata?: Record<string, any>
  dateDisplay?: string
}

export class FinancialLedgerService {
  /**
   * Determina a classificação regulatória padrão de cada categoria
   * com base nas regras financeiras da FIA 2026/2027.
   */
  getDefaultCostCapClassification(category: FinancialCategory): CostCapClassification {
    switch (category) {
      case 'development': // P&D 100% sujeito ao teto
      case 'manufacturing': // Manufatura de peças 100% no teto
      case 'repairs': // Reparos e peças sobressalentes no teto
      case 'testing': // Testes de pista e horas de túnel/cfd no teto
        return 'included'

      case 'driverSalaries': // Salários dos 2 pilotos titulares e marketing são EXCLUÍDOS do teto FIA
      case 'sponsorship':
      case 'prizeMoney':
      case 'commercial':
      case 'ownerFunding':
      case 'otherRevenue':
      case 'infrastructureCapex': // CAPEX de instalações possui teto separado de infraestrutura na FIA, excluído do teto operacional
      case 'penalties': // Multas financeiras da FIA não consomem o teto operacional
        return 'excluded'

      case 'infrastructureOpex': // Custos de utilities e prédios contam parcialmente ou com isenções específicas
      case 'staff': // Os 3 funcionários mais bem pagos são excluídos; restante é incluído
      case 'academy': // Custos da academia de base têm isenções parciais da FIA
      case 'scouting':
      case 'raceOperations':
        return 'partial'

      default:
        return 'pending'
    }
  }

  /**
   * Converte model do PocketBase para a entidade FinancialTransaction
   */
  private mapDbToTransaction(record: any): FinancialTransaction {
    return {
      id: record.id,
      team_id: record.team_id,
      season_year: record.season_year,
      round: record.round,
      date_display: record.date_display,
      type: record.type,
      category: record.category,
      subcategory: record.subcategory,
      direction: record.direction,
      amount: Math.round(record.amount || 0),
      cash_impact: Math.round(record.cash_impact || 0),
      cost_cap_impact: Math.round(record.cost_cap_impact || 0),
      cost_cap_classification: record.cost_cap_classification || 'pending',
      source_system: record.source_system,
      source_entity_id: record.source_entity_id,
      idempotency_key: record.idempotency_key,
      description: record.description,
      status: record.status || 'effective',
      effective_date: record.effective_date || record.created,
      metadata: record.metadata,
      created: record.created,
      updated: record.updated,
    }
  }

  /**
   * Garante a inicialização do saldo de abertura de um save pré-existente
   * (Idempotente: se já houver transações para esta equipe/ano, não duplica)
   */
  async ensureOpeningBalance(team: TeamModel, seasonYear: number): Promise<void> {
    const existing = await this.getTeamTransactions(team.id, seasonYear)
    if (existing.length > 0) return

    // Cria transação canônica de saldo de abertura (Opening Balance)
    const openingAmount = Math.max(0, Math.round(team.budget || 84_000_000))
    const idempotencyKey = `opening_balance_${team.id}_${seasonYear}`

    try {
      await pb.collection('financial_ledger').create({
        team_id: team.id,
        season_year: seasonYear,
        round: 1,
        date_display: `Abertura Temporada ${seasonYear}`,
        type: 'opening_balance',
        category: 'ownerFunding',
        subcategory: 'legacy_opening_balance',
        direction: 'inflow',
        amount: openingAmount,
        cash_impact: openingAmount,
        cost_cap_impact: 0,
        cost_cap_classification: 'excluded',
        source_system: 'system_migration',
        source_entity_id: `team_${team.id}`,
        idempotency_key: idempotencyKey,
        description: `Saldo de abertura e transição para o Livro Razão Financeiro (${seasonYear})`,
        status: 'effective',
        metadata: {
          originalBudget: team.budget,
          migrationDate: new Date().toISOString(),
        },
      })
    } catch (e: any) {
      // Se der duplicate idempotency_key, ignora silenciosamente
      if (!e?.message?.includes('idempotency')) {
        console.warn('Erro ao registrar opening balance:', e)
      }
    }
  }

  /**
   * Obtém todas as transações financeiras de uma equipe na temporada
   */
  async getTeamTransactions(teamId: string, seasonYear?: number): Promise<FinancialTransaction[]> {
    try {
      let filter = `team_id = "${teamId}"`
      if (seasonYear) {
        filter += ` && season_year = ${seasonYear}`
      }
      const records = await pb.collection('financial_ledger').getFullList({
        filter,
        sort: '-created',
      })
      return records.map((r) => this.mapDbToTransaction(r))
    } catch (e) {
      console.warn('Falha ao listar transações financeiras:', e)
      return []
    }
  }

  /**
   * Consulta uma transação específica pela sua chave de idempotência
   */
  async getTransactionByIdempotencyKey(key: string): Promise<FinancialTransaction | null> {
    try {
      const record = await pb
        .collection('financial_ledger')
        .getFirstListItem(`idempotency_key = "${key}"`)
      return this.mapDbToTransaction(record)
    } catch {
      return null
    }
  }

  /**
   * LANÇAMENTO CANÔNICO DE TRANSAÇÃO (com IDEMPOTÊNCIA E AUDITORIA)
   * Impede estritamente lançamentos duplicados e atualiza o cache da equipe se aplicável.
   */
  async postTransaction(params: PostTransactionParams): Promise<{
    transaction: FinancialTransaction
    wasAlreadyProcessed: boolean
  }> {
    // 1. Checagem prévia de idempotência
    const existing = await this.getTransactionByIdempotencyKey(params.idempotencyKey)
    if (existing) {
      return { transaction: existing, wasAlreadyProcessed: true }
    }

    // 2. Determinação de impactos financeiros
    const classification =
      params.costCapClassification || this.getDefaultCostCapClassification(params.category)
    let costCapImpact = 0
    if (params.costCapAmount !== undefined) {
      costCapImpact = params.costCapAmount
    } else if (classification === 'included') {
      costCapImpact = params.amount
    } else if (classification === 'partial') {
      costCapImpact = Math.round(params.amount * 0.5) // Parcialidade de 50% nas despesas operacionais aplicáveis
    }

    let cashImpact = 0
    if (params.direction === 'inflow') {
      cashImpact = params.amount
    } else if (params.direction === 'outflow') {
      cashImpact = -params.amount
    }

    const payload = {
      team_id: params.teamId,
      season_year: params.seasonYear,
      round: params.round || 1,
      date_display: params.dateDisplay || `R${params.round || 1}`,
      type: params.type,
      category: params.category,
      subcategory: params.subcategory || '',
      direction: params.direction,
      amount: Math.round(params.amount),
      cash_impact: Math.round(cashImpact),
      cost_cap_impact: Math.round(costCapImpact),
      cost_cap_classification: classification,
      source_system: params.sourceSystem,
      source_entity_id: params.sourceEntityId || '',
      idempotency_key: params.idempotencyKey,
      description: params.description,
      status: 'effective',
      effective_date: new Date().toISOString(),
      metadata: params.metadata || {},
    }

    try {
      const record = await pb.collection('financial_ledger').create(payload)
      const tx = this.mapDbToTransaction(record)

      // Atualiza o saldo sincronizado no time (mantendo adapter legado team.budget e cost_cap_spent coerentes)
      await this.syncTeamBudgetCache(params.teamId, params.seasonYear)

      return { transaction: tx, wasAlreadyProcessed: false }
    } catch (err: any) {
      // Se colidir idempotência no momento da concorrência
      const checkAgain = await this.getTransactionByIdempotencyKey(params.idempotencyKey)
      if (checkAgain) {
        return { transaction: checkAgain, wasAlreadyProcessed: true }
      }
      throw err
    }
  }

  /**
   * REVERSÃO CANÔNICA DE TRANSAÇÃO (Item 5)
   * Nunca edita o registro original silenciosamente. Cria uma transação compensatória de reversão.
   */
  async reverseTransaction(
    transactionId: string,
    reason: string,
  ): Promise<{
    reversalTransaction: FinancialTransaction
    originalTransaction: FinancialTransaction
  }> {
    const originalRecord = await pb.collection('financial_ledger').getOne(transactionId)
    const orig = this.mapDbToTransaction(originalRecord)

    if (orig.status === 'reversed') {
      throw new Error(`A transação ${orig.id} já foi estornada anteriormente.`)
    }

    // Marca original como 'reversed'
    await pb.collection('financial_ledger').update(transactionId, {
      status: 'reversed',
      metadata: {
        ...(orig.metadata || {}),
        reversalReason: reason,
        reversedAt: new Date().toISOString(),
      },
    })

    // Cria transação compensatória com direção oposta
    const oppositeDirection: TransactionDirection =
      orig.direction === 'inflow' ? 'outflow' : orig.direction === 'outflow' ? 'inflow' : 'neutral'

    const reversalPayload: PostTransactionParams = {
      teamId: orig.team_id,
      seasonYear: orig.season_year,
      round: orig.round,
      type: 'reversal',
      category: orig.category,
      subcategory: `reversal_${orig.subcategory || ''}`,
      direction: oppositeDirection,
      amount: orig.amount,
      costCapAmount: -orig.cost_cap_impact,
      costCapClassification: orig.cost_cap_classification,
      sourceSystem: 'ledger_reversal',
      sourceEntityId: orig.id,
      idempotencyKey: `reversal_for_${orig.id}_${Date.now()}`,
      description: `Estorno/Reversão: ${orig.description} — Motivo: ${reason}`,
      metadata: {
        reversingTransactionId: orig.id,
        reason,
      },
    }

    const { transaction: revTx } = await this.postTransaction(reversalPayload)
    return { reversalTransaction: revTx, originalTransaction: orig }
  }

  /**
   * Sincroniza o campo team.budget e team.cost_cap_spent com a verdade do Ledger
   */
  async syncTeamBudgetCache(
    teamId: string,
    seasonYear: number,
  ): Promise<{ cashBalance: number; costCapSpent: number }> {
    const txs = await this.getTeamTransactions(teamId, seasonYear)
    const activeTxs = txs.filter((t) => t.status === 'effective' || t.status === 'reversed')

    const cashBalance = activeTxs.reduce((sum, t) => sum + t.cash_impact, 0)
    const costCapSpent = activeTxs.reduce((sum, t) => sum + t.cost_cap_impact, 0)

    try {
      await pb.collection('teams').update(teamId, {
        budget: Math.round(cashBalance),
        cost_cap_spent: Math.round(costCapSpent),
      })
    } catch (e) {
      console.warn('Erro ao atualizar cache de budget em teams:', e)
    }

    return { cashBalance, costCapSpent }
  }

  /**
   * Resumo de Caixa e Liquidez (Cash, Committed, Available)
   */
  calculateCashSummary(
    transactions: FinancialTransaction[],
    commitments: FinancialCommitment[] = [],
    totalRounds = 24,
    currentRound = 1,
    projectedRoundRevenue = 0,
    projectedRoundExpense = 0,
  ): CashSummary {
    const activeTxs = transactions.filter((t) => t.status === 'effective')

    let cashBalance = 0
    let seasonRevenue = 0
    let seasonExpenses = 0

    for (const tx of activeTxs) {
      cashBalance += tx.cash_impact
      if (tx.type === 'revenue') {
        seasonRevenue += tx.amount
      } else if (tx.type === 'expense') {
        seasonExpenses += tx.amount
      }
    }

    const activeCommitments = commitments.filter((c) => c.status === 'active')
    const committedCash = activeCommitments.reduce((sum, c) => sum + c.remaining_amount, 0)
    const availableCash = Math.max(0, cashBalance - committedCash)
    const netCashFlow = seasonRevenue - seasonExpenses

    const roundsPlayed = Math.max(1, currentRound - 1)
    const burnRatePerRound = Math.round(seasonExpenses / roundsPlayed)

    const remainingRounds = Math.max(0, totalRounds - currentRound + 1)
    // Projeção base conservadora de fim de ano:
    // Saldo atual + (Receitas recorrentes contratadas) - (Despesas recorrentes + compromissos)
    const projectedRecurringNet = (projectedRoundRevenue - projectedRoundExpense) * remainingRounds
    const projectedEndCash = Math.round(cashBalance + projectedRecurringNet - committedCash)

    return {
      cashBalance,
      committedCash,
      availableCash,
      seasonRevenue,
      seasonExpenses,
      netCashFlow,
      burnRatePerRound,
      projectedEndCash,
    }
  }

  /**
   * Resumo de Cost Cap (Used, Committed, Projected, Remaining, % Used)
   */
  calculateCostCapSummary(
    transactions: FinancialTransaction[],
    commitments: FinancialCommitment[] = [],
    annualLimit = COST_CAP_ANNUAL_LIMIT,
    remainingRounds = 22,
    projectedOpexPerRoundSubjectToCap = 0,
  ): CostCapSummary {
    const activeTxs = transactions.filter((t) => t.status === 'effective')

    const used = activeTxs.reduce((sum, t) => sum + t.cost_cap_impact, 0)

    const activeCommitments = commitments.filter((c) => c.status === 'active')
    const committed = activeCommitments.reduce((sum, c) => sum + c.cost_cap_impact_remaining, 0)

    // Projeção: o que já gastou + compromissos firmes + OPEX operacional fixo sujeito a teto até o final do ano
    const projectedOpexTotal = projectedOpexPerRoundSubjectToCap * remainingRounds
    const projected = Math.round(used + committed + projectedOpexTotal)

    const remaining = Math.max(0, annualLimit - used)
    const projectedRemaining = annualLimit - projected

    const pctUsed = Math.min(100, Math.round((used / annualLimit) * 100))
    const pctProjected = Math.round((projected / annualLimit) * 100)

    let status: CostCapSummary['status'] = 'confortavel'
    if (used > annualLimit) {
      status = 'breach'
    } else if (pctProjected >= 100) {
      status = 'critico'
    } else if (pctProjected >= 90) {
      status = 'risco'
    } else if (pctProjected >= 80) {
      status = 'atencao'
    }

    return {
      annualLimit,
      used,
      committed,
      projected,
      remaining,
      projectedRemaining,
      pctUsed,
      pctProjected,
      status,
    }
  }

  /**
   * Avaliação de Impacto Preliminar (What-If Simulation) — Item 23
   * Permite que o jogador simule o impacto de um novo P&D, contratação ou peça antes de aprovar.
   */
  simulateFinancialImpact(params: {
    team: TeamModel
    actionDescription: string
    costAmount: number
    category: FinancialCategory
    costCapAmount?: number
    costCapClassification?: CostCapClassification
    currentTransactions: FinancialTransaction[]
    currentCommitments?: FinancialCommitment[]
    totalRounds?: number
    currentRound?: number
  }): FinancialImpactSimulation {
    const classification =
      params.costCapClassification || this.getDefaultCostCapClassification(params.category)
    let costCapImpact = 0
    if (params.costCapAmount !== undefined) {
      costCapImpact = params.costCapAmount
    } else if (classification === 'included') {
      costCapImpact = params.costAmount
    } else if (classification === 'partial') {
      costCapImpact = Math.round(params.costAmount * 0.5)
    }

    const currentCash = params.team.budget || 0
    const currentCapUsed = params.team.cost_cap_spent || 0

    const isAffordableCash = currentCash >= params.costAmount
    const projectedCapAfter = currentCapUsed + costCapImpact
    const isWithinCostCap = projectedCapAfter <= COST_CAP_ANNUAL_LIMIT

    const projectedCashAfter = currentCash - params.costAmount
    const projectedCostCapPctAfter = Math.round((projectedCapAfter / COST_CAP_ANNUAL_LIMIT) * 100)

    let warning: string | undefined
    if (!isAffordableCash) {
      warning = 'Caixa insuficiente para cobrir o investimento.'
    } else if (projectedCapAfter > COST_CAP_ANNUAL_LIMIT) {
      warning =
        'Atenção: esta ação colocará sua equipe em VIOLAÇÃO (Breach) do teto de gastos da FIA!'
    } else if (projectedCostCapPctAfter >= 90) {
      warning = 'Atenção: seu consumo de teto de gastos ultrapassará 90% da cota anual.'
    }

    return {
      actionDescription: params.actionDescription,
      costAmount: params.costAmount,
      cashImpact: -params.costAmount,
      costCapImpact,
      costCapClassification: classification,
      isAffordableCash,
      isWithinCostCap,
      currentCash,
      projectedCashAfter,
      currentCostCapUsed: currentCapUsed,
      projectedCostCapAfter: projectedCapAfter,
      projectedCostCapPctAfter,
      warning,
    }
  }

  /**
   * Gera Alertas Financeiros Inteligentes (Liquidez, Cost Cap, Breach, Commitments) — Item 21 e 65
   */
  /**
   * Snapshot consolidado do Ledger Financeiro
   */
  async getLedgerSnapshot(
    teamId: string,
    seasonYear: number,
    round = 24,
  ): Promise<FinancialLedgerSnapshot> {
    const txs = await this.getTeamTransactions(teamId, seasonYear)
    const activeTxs = txs.filter((t) => t.status === 'effective')
    const cashBalance = activeTxs.reduce((sum, t) => sum + t.cash_impact, 0)
    const costCapSpent = activeTxs.reduce((sum, t) => sum + t.cost_cap_impact, 0)
    const remaining = Math.max(0, COST_CAP_ANNUAL_LIMIT - costCapSpent)

    return {
      teamId,
      seasonYear,
      round,
      cashBalance: Math.round(cashBalance),
      committedCash: 0,
      availableCash: Math.round(cashBalance),
      costCapSpent: Math.round(costCapSpent),
      costCapRemaining: Math.round(remaining),
      costCapLimit: COST_CAP_ANNUAL_LIMIT,
      transactionCount: txs.length,
      status: costCapSpent > COST_CAP_ANNUAL_LIMIT ? 'minor_breach' : 'compliant',
    }
  }

  generateFinancialAlerts(
    cashSummary: CashSummary,
    costCapSummary: CostCapSummary,
  ): FinancialAlert[] {
    const alerts: FinancialAlert[] = []

    // 1. Alerta de Liquidez (Cash negativo ou projeção negativa)
    if (cashSummary.projectedEndCash < 0) {
      alerts.push({
        id: 'alert_liquidity_negative',
        severity: 'danger',
        type: 'liquidity',
        title: 'Risco de Insolvência Projetada',
        message: `O caixa projetado ao fim da temporada está negativo em R$ ${(Math.abs(cashSummary.projectedEndCash) / 1000000).toFixed(1)}M.`,
        recommendation:
          'Reduza novas ordens de fabricação ou busque patrocinadores com repasses imediatos.',
      })
    } else if (cashSummary.availableCash < 10_000_000) {
      alerts.push({
        id: 'alert_low_available_cash',
        severity: 'warning',
        type: 'liquidity',
        title: 'Liquidez Disponível Reduzida',
        message: `Você possui apenas R$ ${(cashSummary.availableCash / 1000000).toFixed(1)}M livres após deduzir os compromissos assumidos.`,
      })
    }

    // 2. Alerta de Cost Cap
    if (costCapSummary.status === 'breach') {
      alerts.push({
        id: 'alert_cost_cap_breach',
        severity: 'danger',
        type: 'breach',
        title: '🚨 Violação Oficial do Teto da FIA',
        message: `Gastos sob o regulamento excederam o limite anual em R$ ${(Math.abs(costCapSummary.remaining) / 1000000).toFixed(1)}M.`,
        recommendation:
          'A FIA aplicará deduções de pontos e restrições de horas de túnel de vento.',
      })
    } else if (costCapSummary.pctProjected >= 97) {
      alerts.push({
        id: 'alert_cost_cap_critical',
        severity: 'danger',
        type: 'cost_cap',
        title: 'Teto de Gastos em Nível Crítico (≥97%)',
        message: `Sua projeção de consumo alcança ${costCapSummary.pctProjected}% do teto. Margem de apenas R$ ${(costCapSummary.projectedRemaining / 1000000).toFixed(1)}M.`,
        recommendation: 'Congele novos projetos de P&D de grande escopo.',
      })
    } else if (costCapSummary.pctProjected >= 90) {
      alerts.push({
        id: 'alert_cost_cap_risk',
        severity: 'warning',
        type: 'cost_cap',
        title: 'Atenção ao Teto de Gastos (≥90%)',
        message: `O ritmo atual projeta consumo de ${costCapSummary.pctProjected}% do Cost Cap da temporada.`,
      })
    }

    return alerts
  }

  /**
   * Auditoria de Consistência e Integridade Financeira (QA auditFinancialIntegrity) — Item 83 & 84
   */
  /**
   * Adapter de compatibilidade canônica para registro simplificado de lançamentos (recordEntry)
   */
  async recordEntry(params: {
    team_id: string
    season_id: string
    round: number
    category: any
    entry_type: 'revenue' | 'expense' | 'commitment' | 'reversal' | 'adjustment'
    amount: number
    cash_impact: number
    cost_cap_impact: number
    cost_cap_classification?: CostCapClassification | 'relevant'
    idempotency_key: string
    description: string
  }): Promise<void> {
    const direction: TransactionDirection = params.entry_type === 'revenue' ? 'inflow' : 'outflow'
    const classification: CostCapClassification =
      params.cost_cap_classification === 'relevant'
        ? 'included'
        : params.cost_cap_classification || (params.cost_cap_impact > 0 ? 'included' : 'excluded')

    await this.postTransaction({
      teamId: params.team_id,
      seasonYear: parseInt(params.season_id, 10) || 2026,
      round: params.round,
      type: params.entry_type === 'revenue' ? 'revenue' : 'expense',
      category: params.category === 'sponsorPayout' ? 'sponsorship' : params.category,
      direction,
      amount: params.amount,
      costCapAmount: params.cost_cap_impact,
      costCapClassification: classification,
      sourceSystem: 'weekend_simulation',
      sourceEntityId: `r${params.round}`,
      idempotencyKey: params.idempotency_key,
      description: params.description,
    })
  }

  async auditFinancialIntegrity(
    teamId: string,
    seasonYear: number,
  ): Promise<FinancialIntegrityReport> {
    const teamRecord = await pb.collection('teams').getOne<TeamModel>(teamId)
    const transactions = await this.getTeamTransactions(teamId, seasonYear)

    let openingCash = 0
    let totalRevenue = 0
    let totalExpense = 0
    const seenKeys = new Set<string>()
    let duplicateTransactionsCount = 0
    let orphanTransactionsCount = 0
    const issues: string[] = []

    const expenseCategoryTotals: Record<ExpenseCategory, number> = {
      development: 0,
      manufacturing: 0,
      repairs: 0,
      infrastructureCapex: 0,
      infrastructureOpex: 0,
      driverSalaries: 0,
      staff: 0,
      academy: 0,
      scouting: 0,
      testing: 0,
      raceOperations: 0,
      penalties: 0,
      otherExpense: 0,
    }

    for (const tx of transactions) {
      if (seenKeys.has(tx.idempotency_key)) {
        duplicateTransactionsCount++
        issues.push(`Chave de idempotência duplicada: ${tx.idempotency_key}`)
      } else {
        seenKeys.add(tx.idempotency_key)
      }

      if (!tx.source_system) {
        orphanTransactionsCount++
        issues.push(`Transação sem source_system (órfã): ${tx.id}`)
      }

      if (isNaN(tx.amount) || isNaN(tx.cash_impact) || isNaN(tx.cost_cap_impact)) {
        issues.push(`Valores monetários NaN detectados na transação ${tx.id}`)
      }

      if (tx.status === 'effective') {
        if (tx.type === 'opening_balance') {
          openingCash += tx.cash_impact
        } else if (tx.type === 'revenue') {
          totalRevenue += tx.amount
        } else if (tx.type === 'expense') {
          totalExpense += tx.amount
          if (tx.category in expenseCategoryTotals) {
            expenseCategoryTotals[tx.category as ExpenseCategory] += tx.amount
          }
        }
      }
    }

    const calculatedCash = openingCash + totalRevenue - totalExpense
    const dbRecordedBudget = teamRecord.budget || 0
    const cashDiscrepancy = Math.abs(calculatedCash - dbRecordedBudget)

    // Acha a maior categoria de despesa
    let largestExpenseCategory: ExpenseCategory | 'none' = 'none'
    let largestExpenseAmount = 0
    for (const [cat, amt] of Object.entries(expenseCategoryTotals)) {
      if (amt > largestExpenseAmount) {
        largestExpenseAmount = amt
        largestExpenseCategory = cat as ExpenseCategory
      }
    }

    const commitments = (teamRecord.financial_commitments || []) as FinancialCommitment[]
    const committedCash = commitments.reduce(
      (s, c) => s + (c.status === 'active' ? c.remaining_amount : 0),
      0,
    )
    const availableCash = Math.max(0, calculatedCash - committedCash)

    const costCapUsed = transactions
      .filter((t) => t.status === 'effective')
      .reduce((sum, t) => sum + t.cost_cap_impact, 0)

    const costCapCommitted = commitments
      .filter((c) => c.status === 'active')
      .reduce((s, c) => s + c.cost_cap_impact_remaining, 0)

    const projectedCostCap = costCapUsed + costCapCommitted
    const projectedRemainingCostCap = COST_CAP_ANNUAL_LIMIT - projectedCostCap

    let integrityStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS'
    if (duplicateTransactionsCount > 0 || orphanTransactionsCount > 0) {
      integrityStatus = 'FAIL'
    } else if (cashDiscrepancy > 100) {
      integrityStatus = 'WARN'
      issues.push(
        `Divergência entre Ledger (${calculatedCash}) e teams.budget (${dbRecordedBudget})`,
      )
    }

    return {
      teamId,
      seasonYear,
      openingCash,
      totalRevenue,
      totalExpense,
      calculatedCash,
      dbRecordedBudget,
      cashDiscrepancy,
      committedCash,
      availableCash,
      costCapLimit: COST_CAP_ANNUAL_LIMIT,
      costCapUsed,
      costCapCommitted,
      projectedCostCap,
      projectedRemainingCostCap,
      largestExpenseCategory,
      largestExpenseAmount,
      transactionCount: transactions.length,
      duplicateTransactionsCount,
      orphanTransactionsCount,
      integrityStatus,
      issues,
    }
  }
}

export const financialLedgerService = new FinancialLedgerService()
export default financialLedgerService
