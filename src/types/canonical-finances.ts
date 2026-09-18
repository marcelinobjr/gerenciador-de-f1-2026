/**
 * Canonical Financial Types & Data Contracts — F1 2026/2027
 * Implementação Nº 5A: Finanças, Orçamento, Projeções e Cost Cap
 *
 * Regra de Ouro nº 1: Caixa não é Cost Cap.
 * Regra de Ouro nº 2: Toda receita e despesa possui origem rastreável.
 * Regra de Ouro nº 3: Idempotência obrigatória — um evento só cobra uma vez.
 * Regra de Ouro nº 4: Orçamento é planejamento, Caixa é dinheiro, Cost Cap é regulação.
 */

// Categorias canônicas de Receita (Taxonomia obrigatória item 7)
export type RevenueCategory =
  | 'prizeMoney' // Premiação esportiva oficial
  | 'sponsorship' // Contratos de patrocínio
  | 'commercial' // Receitas comerciais diversas (marketing, merchandising)
  | 'driverRelated' // Receitas ligadas a pilotos (pay driver / academia externa)
  | 'ownerFunding' // Aporte ou injeção de acionistas/montadora
  | 'otherRevenue' // Outras receitas

// Categorias canônicas de Despesa (Taxonomia obrigatória item 8)
export type ExpenseCategory =
  | 'development' // P&D de componentes (Fase 4B)
  | 'manufacturing' // Fabricação de peças físicas
  | 'repairs' // Reparos e restauração de peças desgastadas
  | 'infrastructureCapex' // Obras e expansão de instalações (Fase 4A)
  | 'infrastructureOpex' // Manutenção e custos operacionais das facilities
  | 'driverSalaries' // Folha salarial de pilotos titulares/reservas
  | 'staff' // Equipe técnica e de engenharia
  | 'academy' // Scouting, bolsas e programa de jovens pilotos (Fase 4C)
  | 'scouting' // Missões de prospecção e relatórios de observação
  | 'testing' // Testes de pista, homologação e simulador
  | 'raceOperations' // Logística, pneus, combustível e taxas de GP
  | 'penalties' // Multas financeiras da FIA ou rescisórias
  | 'otherExpense' // Outras despesas operacionais

export type FinancialCategory = RevenueCategory | ExpenseCategory

export type TransactionDirection = 'inflow' | 'outflow' | 'neutral'

export type TransactionType =
  | 'revenue'
  | 'expense'
  | 'commitment'
  | 'reversal'
  | 'adjustment'
  | 'opening_balance'

export type CostCapClassification =
  | 'included' // Totalmente sujeito ao teto regulatório FIA (ex: P&D, Manufatura)
  | 'excluded' // Excluído do teto pelas regras FIA (ex: Salários dos 2 pilotos, Marketing, OPEX/CAPEX predial selecionado)
  | 'partial' // Parcialmente incluído conforme proporção
  | 'pending' // Pendente de classificação / auditoria regulatória

export type TransactionStatus = 'committed' | 'effective' | 'reversed' | 'cancelled'

/**
 * Entidade Canônica de Transação Financeira
 */
export interface FinancialTransaction {
  id: string
  team_id: string
  season_year: number
  round?: number
  date_display?: string
  type: TransactionType
  category: FinancialCategory
  subcategory?: string
  direction: TransactionDirection
  amount: number // Valor nominal monetário positivo
  cash_impact: number // Impacto real no caixa (+ positivo para inflow, - negativo para outflow)
  cost_cap_impact: number // Impacto regulatório no Cost Cap (positivo se consome teto)
  cost_cap_classification: CostCapClassification
  source_system: string // ex: 'car_development', 'manufacturing', 'infrastructure', 'driver_academy', 'race_advance', 'sponsor_payout'
  source_entity_id?: string // ex: id do projeto de P&D, ordem de manufatura, obra de facility
  idempotency_key: string // Chave única para prevenir duplicação
  description: string
  status: TransactionStatus
  effective_date?: string
  metadata?: Record<string, any>
  created?: string
  updated?: string
}

/**
 * Compromissos Futuros (Commitments)
 * Despesas já contratadas/aprovadas cujo desembolso ou impacto ainda se estenderá pela temporada
 */
export interface FinancialCommitment {
  id: string
  team_id: string
  season_year: number
  category: ExpenseCategory
  source_system: string
  source_entity_id: string
  total_amount: number
  settled_amount: number
  remaining_amount: number
  cost_cap_impact_remaining: number
  due_round?: number
  description: string
  status: 'active' | 'fulfilled' | 'cancelled'
  created_at: string
}

/**
 * Planejamento e Alocação Interna de Orçamento (Internal Budget Allocations)
 * Realocar orçamento não cria nem destrói caixa, nem altera o Cost Cap.
 */
export interface InternalBudgetAllocation {
  category: ExpenseCategory
  allocated_amount: number
  spent_amount: number
  committed_amount: number
  available_amount: number
}

/**
 * Resumo Canônico do Caixa (Cash Position)
 */
export interface CashSummary {
  cashBalance: number // Saldo real em caixa (Opening + Inflows - Outflows)
  committedCash: number // Compromissos já assumidos para o restante da temporada
  availableCash: number // cashBalance - committedCash (liquidez livre para novas decisões)
  seasonRevenue: number // Total de receitas efetivadas na temporada
  seasonExpenses: number // Total de despesas efetivadas na temporada
  netCashFlow: number // seasonRevenue - seasonExpenses
  burnRatePerRound: number // Ritmo médio de queima de caixa por rodada disputada
  projectedEndCash: number // Projeção conservadora ao final da temporada
}

/**
 * Resumo Canônico do Teto Regulatório (Cost Cap Summary)
 */
export interface CostCapSummary {
  annualLimit: number // ex: R$ 215.000.000 ou valor da categoria
  used: number // Total efetivado sujeito ao teto
  committed: number // Compromissos que incidirão no teto até o final do ano
  projected: number // used + committed + despesas recorrentes sujeitas ao teto
  remaining: number // annualLimit - used
  projectedRemaining: number // annualLimit - projected
  pctUsed: number // (used / annualLimit) * 100
  pctProjected: number // (projected / annualLimit) * 100
  status: 'confortavel' | 'atencao' | 'risco' | 'critico' | 'breach'
}

/**
 * Faixas de Alerta Financeiro (Configuráveis)
 */
export interface FinancialAlertThresholds {
  costCapAttentionPct: number // 80%
  costCapRiskPct: number // 90%
  costCapCriticalPct: number // 97%
  lowCashWarningLimit: number // ex: R$ 5.000.000
}

export interface FinancialAlert {
  id: string
  severity: 'info' | 'warning' | 'danger'
  type: 'liquidity' | 'cost_cap' | 'breach' | 'commitment' | 'burn_rate'
  title: string
  message: string
  recommendation?: string
}

/**
 * Avaliação de Impacto Preliminar (What-If Simulation)
 */
export interface FinancialImpactSimulation {
  actionDescription: string
  costAmount: number
  cashImpact: number
  costCapImpact: number
  costCapClassification: CostCapClassification
  isAffordableCash: boolean
  isWithinCostCap: boolean
  currentCash: number
  projectedCashAfter: number
  currentCostCapUsed: number
  projectedCostCapAfter: number
  projectedCostCapPctAfter: number
  warning?: string
}

/**
 * Relatório de Auditoria de Integridade Financeira
 */
export interface FinancialLedgerSnapshot {
  teamId: string
  seasonYear: number
  round?: number
  cashBalance: number
  committedCash: number
  availableCash: number
  costCapSpent: number
  costCapRemaining: number
  costCapLimit: number
  transactionCount: number
  status: 'compliant' | 'minor_breach' | 'material_breach'
  cashSummary?: CashSummary
  costCapSummary?: CostCapSummary
  recentTransactions?: FinancialTransaction[]
  activeCommitments?: FinancialCommitment[]
  financialAlerts?: FinancialAlert[]
  lastAuditDate?: string
}

export interface FinancialIntegrityReport {
  teamId: string
  seasonYear: number
  openingCash: number
  totalRevenue: number
  totalExpense: number
  calculatedCash: number
  dbRecordedBudget: number
  cashDiscrepancy: number
  committedCash: number
  availableCash: number
  costCapLimit: number
  costCapUsed: number
  costCapCommitted: number
  projectedCostCap: number
  projectedRemainingCostCap: number
  largestExpenseCategory: ExpenseCategory | 'none'
  largestExpenseAmount: number
  transactionCount: number
  duplicateTransactionsCount: number
  orphanTransactionsCount: number
  integrityStatus: 'PASS' | 'WARN' | 'FAIL'
  issues: string[]
}
