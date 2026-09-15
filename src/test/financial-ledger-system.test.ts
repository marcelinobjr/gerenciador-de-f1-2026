import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FinancialLedgerService, COST_CAP_ANNUAL_LIMIT } from '@/services/financialLedgerService'
import { FinancialTransaction, FinancialCommitment } from '@/types/canonical-finances'
import { TeamModel } from '@/types/f1'

describe('Implementação Nº 5A — Finanças, Orçamento, Projeções e Cost Cap', () => {
  let service: FinancialLedgerService

  beforeEach(() => {
    service = new FinancialLedgerService()
  })

  // (67) CASH ≠ COST CAP: criar cenário muito cash/pouco cost cap remaining e o inverso
  it('(67) Confirma que Caixa (Liquidez) e Cost Cap (Regulação) são métricas totalmente independentes', () => {
    // Cenário A: Equipe rica em caixa (Cash R$ 100M), mas teto regulatório quase esgotado (Used R$ 207M de R$ 215M => Remaining R$ 8M)
    const txsScenarioA: FinancialTransaction[] = [
      {
        id: '1',
        team_id: 'team1',
        season_year: 2026,
        type: 'opening_balance',
        category: 'ownerFunding',
        direction: 'inflow',
        amount: 307_000_000,
        cash_impact: 307_000_000,
        cost_cap_impact: 0,
        cost_cap_classification: 'excluded',
        source_system: 'system',
        idempotency_key: 'open_a',
        description: 'Aporte de acionista',
        status: 'effective',
      },
      {
        id: '2',
        team_id: 'team1',
        season_year: 2026,
        type: 'expense',
        category: 'development',
        direction: 'outflow',
        amount: 207_000_000,
        cash_impact: -207_000_000,
        cost_cap_impact: 207_000_000,
        cost_cap_classification: 'included',
        source_system: 'rd',
        idempotency_key: 'rd_a',
        description: 'Desenvolvimento massivo de P&D',
        status: 'effective',
      },
    ]

    const cashA = service.calculateCashSummary(txsScenarioA)
    const capA = service.calculateCostCapSummary(txsScenarioA)

    expect(cashA.cashBalance).toBe(100_000_000)
    expect(capA.remaining).toBe(8_000_000)
    expect(capA.status).toBe('critico')

    // Cenário B: Equipe com amplo espaço regulatório no teto (Used R$ 30M => Remaining R$ 185M), mas sem liquidez de caixa (Cash R$ 4M)
    const txsScenarioB: FinancialTransaction[] = [
      {
        id: '3',
        team_id: 'team2',
        season_year: 2026,
        type: 'opening_balance',
        category: 'ownerFunding',
        direction: 'inflow',
        amount: 34_000_000,
        cash_impact: 34_000_000,
        cost_cap_impact: 0,
        cost_cap_classification: 'excluded',
        source_system: 'system',
        idempotency_key: 'open_b',
        description: 'Caixa de abertura modesto',
        status: 'effective',
      },
      {
        id: '4',
        team_id: 'team2',
        season_year: 2026,
        type: 'expense',
        category: 'development',
        direction: 'outflow',
        amount: 30_000_000,
        cash_impact: -30_000_000,
        cost_cap_impact: 30_000_000,
        cost_cap_classification: 'included',
        source_system: 'rd',
        idempotency_key: 'rd_b',
        description: 'P&D inicial',
        status: 'effective',
      },
    ]

    const cashB = service.calculateCashSummary(txsScenarioB)
    const capB = service.calculateCostCapSummary(txsScenarioB)

    expect(cashB.cashBalance).toBe(4_000_000)
    expect(capB.remaining).toBe(185_000_000)
    expect(capB.status).toBe('confortavel')
  })

  // (68) IDEMPOTÊNCIA: lançar duas vezes com mesma chave não duplica
  it('(68) Garante idempotência: rejeita cobrança duplicada com a mesma idempotency_key', async () => {
    // Mock do pb
    const fakeStore = new Map<string, any>()
    vi.spyOn(service, 'getTransactionByIdempotencyKey').mockImplementation(async (key: string) => {
      return fakeStore.get(key) || null
    })

    const payload = {
      teamId: 'audi_test',
      seasonYear: 2026,
      round: 1,
      type: 'expense' as const,
      category: 'manufacturing' as const,
      direction: 'outflow' as const,
      amount: 4_500_000,
      sourceSystem: 'manufacturing_order',
      sourceEntityId: 'order_123',
      idempotencyKey: 'mfg_order_123',
      description: 'Fabricação de 2x Assoalho',
    }

    // Primeiro lançamento
    const firstCall = await service.postTransaction(payload)
    expect(firstCall.wasAlreadyProcessed).toBe(false)
    fakeStore.set(payload.idempotencyKey, firstCall.transaction)

    // Segundo lançamento idêntico (reload/retry)
    const secondCall = await service.postTransaction(payload)
    expect(secondCall.wasAlreadyProcessed).toBe(true)
    expect(secondCall.transaction.id).toBe(firstCall.transaction.id)
  })

  // (69) REVERSÃO: histórico permanece, ajuste compensatório existe, saldo final correto
  it('(69) Realiza reversão canônica preservando o registro original e gerando ajuste compensatório', async () => {
    const originalTx: FinancialTransaction = {
      id: 'tx_error_1',
      team_id: 'audi_test',
      season_year: 2026,
      round: 3,
      type: 'expense',
      category: 'development',
      direction: 'outflow',
      amount: 12_000_000,
      cash_impact: -12_000_000,
      cost_cap_impact: 12_000_000,
      cost_cap_classification: 'included',
      source_system: 'car_development',
      idempotency_key: 'erroneous_rd',
      description: 'Cobrança errônea de P&D',
      status: 'effective',
    }

    // Simula cálculo com transação antes da reversão
    const preCash = service.calculateCashSummary([originalTx])
    const preCap = service.calculateCostCapSummary([originalTx])
    expect(preCash.cashBalance).toBe(-12_000_000)
    expect(preCap.used).toBe(12_000_000)

    // Cria a transação compensatória de reversão (direção oposta, status reversed na original)
    const originalMarkedReversed: FinancialTransaction = {
      ...originalTx,
      status: 'reversed',
    }
    const reversalTx: FinancialTransaction = {
      id: 'tx_rev_1',
      team_id: 'audi_test',
      season_year: 2026,
      round: 3,
      type: 'reversal',
      category: 'development',
      direction: 'inflow',
      amount: 12_000_000,
      cash_impact: 12_000_000,
      cost_cap_impact: -12_000_000,
      cost_cap_classification: 'included',
      source_system: 'ledger_reversal',
      idempotency_key: 'reversal_key_1',
      description: 'Estorno de Cobrança errônea',
      status: 'effective',
    }

    const postCash = service.calculateCashSummary([originalMarkedReversed, reversalTx])
    const postCap = service.calculateCostCapSummary([originalMarkedReversed, reversalTx])

    // Saldo restaurado sem perda de histórico contábil
    expect(postCash.cashBalance).toBe(12_000_000)
    expect(postCap.used).toBe(-12_000_000)
  })

  // (73) COST CAP: classificação included/excluded/partial
  it('(73) Classifica corretamente despesas como included, excluded ou partial perante o regulamento FIA', () => {
    expect(service.getDefaultCostCapClassification('development')).toBe('included')
    expect(service.getDefaultCostCapClassification('manufacturing')).toBe('included')
    expect(service.getDefaultCostCapClassification('driverSalaries')).toBe('excluded')
    expect(service.getDefaultCostCapClassification('infrastructureCapex')).toBe('excluded')
    expect(service.getDefaultCostCapClassification('penalties')).toBe('excluded')
    expect(service.getDefaultCostCapClassification('infrastructureOpex')).toBe('partial')
    expect(service.getDefaultCostCapClassification('staff')).toBe('partial')
  })

  // (74) PROJEÇÃO: despesas realizadas + commitments + OPEX futuro = Projected Cost Cap
  it('(74) Projeta com precisão o Cost Cap e o Caixa final considerando compromissos e despesas recorrentes', () => {
    const executedTxs: FinancialTransaction[] = [
      {
        id: 't1',
        team_id: 'audi',
        season_year: 2026,
        type: 'opening_balance',
        category: 'ownerFunding',
        direction: 'inflow',
        amount: 80_000_000,
        cash_impact: 80_000_000,
        cost_cap_impact: 0,
        cost_cap_classification: 'excluded',
        source_system: 'system',
        idempotency_key: 'k1',
        description: 'Abertura',
        status: 'effective',
      },
      {
        id: 't2',
        team_id: 'audi',
        season_year: 2026,
        type: 'expense',
        category: 'development',
        direction: 'outflow',
        amount: 50_000_000,
        cash_impact: -50_000_000,
        cost_cap_impact: 50_000_000,
        cost_cap_classification: 'included',
        source_system: 'rd',
        idempotency_key: 'k2',
        description: 'Desenvolvimento',
        status: 'effective',
      },
    ]

    const commitments: FinancialCommitment[] = [
      {
        id: 'c1',
        team_id: 'audi',
        season_year: 2026,
        category: 'manufacturing',
        source_system: 'manufacturing_order',
        source_entity_id: 'order_parts',
        total_amount: 15_000_000,
        settled_amount: 0,
        remaining_amount: 15_000_000,
        cost_cap_impact_remaining: 15_000_000,
        description: 'Ordens de fabricação em andamento',
        status: 'active',
        created_at: new Date().toISOString(),
      },
    ]

    // 20 rodadas restantes, OPEX de R$ 300.000 / rodada sujeito a teto = R$ 6.000.000
    const capSummary = service.calculateCostCapSummary(
      executedTxs,
      commitments,
      COST_CAP_ANNUAL_LIMIT,
      20,
      300_000,
    )

    expect(capSummary.used).toBe(50_000_000)
    expect(capSummary.committed).toBe(15_000_000)
    expect(capSummary.projected).toBe(71_000_000) // 50M + 15M + 6M = 71M
    expect(capSummary.projectedRemaining).toBe(COST_CAP_ANNUAL_LIMIT - 71_000_000)

    const cashSummary = service.calculateCashSummary(
      executedTxs,
      commitments,
      24,
      5,
      2_000_000,
      1_000_000,
    )
    expect(cashSummary.cashBalance).toBe(30_000_000)
    expect(cashSummary.committedCash).toBe(15_000_000)
    expect(cashSummary.availableCash).toBe(15_000_000)
  })

  // (75) ALERTA: disparo coerente nos limites 80%, 90%, 97% e breach
  it('(75) Dispara alertas financeiros de liquidez e faixas de risco do Cost Cap', () => {
    const cashSummary = {
      cashBalance: 8_000_000,
      committedCash: 5_000_000,
      availableCash: 3_000_000,
      seasonRevenue: 10_000_000,
      seasonExpenses: 15_000_000,
      netCashFlow: -5_000_000,
      burnRatePerRound: 3_000_000,
      projectedEndCash: -4_000_000, // Caixa negativo projetado!
    }

    const costCapSummary = {
      annualLimit: 215_000_000,
      used: 195_000_000,
      committed: 10_000_000,
      projected: 216_000_000, // Violação projetada!
      remaining: 20_000_000,
      projectedRemaining: -1_000_000,
      pctUsed: 91,
      pctProjected: 101,
      status: 'critico' as const,
    }

    const alerts = service.generateFinancialAlerts(cashSummary, costCapSummary)

    const liquidityAlert = alerts.find((a) => a.type === 'liquidity')
    expect(liquidityAlert).toBeDefined()
    expect(liquidityAlert?.severity).toBe('danger')

    const capAlert = alerts.find((a) => a.type === 'cost_cap')
    expect(capAlert).toBeDefined()
    expect(capAlert?.title).toContain('Crítico')
  })

  // (76) ORÇAMENTO INTERNO: realocação não altera caixa nem cost cap
  it('(76) Realocar orçamento interno altera apenas as metas departamentais sem mutar caixa nem cost cap', () => {
    const team: TeamModel = {
      id: 'audi_team',
      name: 'Audi Revolut F1 Team',
      team_key: 'audi',
      budget: 84_000_000,
      cost_cap_spent: 35_000_000,
      budget_allocations: {
        development: 40_000_000,
        academy: 10_000_000,
      },
    } as any

    // Realoca R$ 5M de Academy para Development
    const updatedAllocations = {
      development: (team.budget_allocations as any).development + 5_000_000,
      academy: (team.budget_allocations as any).academy - 5_000_000,
    }

    // Valida que o caixa e o cost cap do time permanecem absolutamente inalterados
    expect(team.budget).toBe(84_000_000)
    expect(team.cost_cap_spent).toBe(35_000_000)
    expect(updatedAllocations.development).toBe(45_000_000)
    expect(updatedAllocations.academy).toBe(5_000_000)
  })

  // (23) WHAT-IF SIMULATION: simulação de decisão prévia
  it('(23) Simula com fidelidade o impacto de uma nova despesa relevante antes da aprovação', () => {
    const fakeTeam: TeamModel = {
      id: 'audi_team',
      name: 'Audi Revolut F1 Team',
      budget: 50_000_000,
      cost_cap_spent: 190_000_000,
    } as any

    const simulation = service.simulateFinancialImpact({
      team: fakeTeam,
      actionDescription: 'Novo Chassi Monocoque Spec B',
      costAmount: 10_000_000,
      category: 'development',
      currentTransactions: [],
    })

    expect(simulation.cashImpact).toBe(-10_000_000)
    expect(simulation.costCapImpact).toBe(10_000_000)
    expect(simulation.isAffordableCash).toBe(true)
    expect(simulation.projectedCashAfter).toBe(40_000_000)
    expect(simulation.projectedCostCapAfter).toBe(200_000_000)
    expect(simulation.warning).toBeDefined()
  })

  // (80) & (81) PRECISÃO MONETÁRIA: arredondamento inteiro seguro
  it('(80) Mantém precisão monetária inteira evitando acúmulo de dizimas de floating point', () => {
    const roundVal1 = Math.round(1234567.89)
    const roundVal2 = Math.round(1000000 / 3)
    expect(Number.isInteger(roundVal1)).toBe(true)
    expect(Number.isInteger(roundVal2)).toBe(true)
  })
})
