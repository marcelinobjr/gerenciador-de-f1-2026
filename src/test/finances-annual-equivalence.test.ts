/**
 * Teste de Equivalência Estrita da Calculadora Anual — FIN-SOURCE-01A (FIN-EVO-03).
 *
 * OBJETIVO:
 * Para cada um dos 5 anos (2026-2030) do cenário Audi (arquivo 02_FIN_EVO_CENARIOS_E_TESTES),
 * comparar rubrica por rubrica e totais contra `annual_source_outputs`,
 * com comparador estrito ABS(obtido - esperado) < 0.000001 (US$ 1 milhão).
 *
 * REGRAS DE INTEGRIDADE:
 * 1. Valores esperados vêm EXCLUSIVAMENTE do arquivo 02, NUNCA da própria função ou inventados.
 * 2. Parâmetros vêm do arquivo 01_FIN_EVO_PARAMETROS.
 * 3. Entradas vêm da seção `annual_inputs` do arquivo 02.
 * 4. NENHUM eval ou fallback silencioso.
 */

import { describe, it, expect } from 'vitest'
import rawParams from '../assets/01finevoparametros-9bcaa.json'
import rawScenarios from '../assets/02finevocenariosetestes-e6c0c.json'
import { FinancialEconomicRules } from '../lib/finances/types'
import {
  calculateAnnualFinances,
  AnnualPlanInputs,
  AnnualCostInputs,
  calculatePositionFactor,
  calculateWinFactor,
} from '../lib/finances/annualCalculator'

// Extração dos parâmetros tipados do arquivo 01
const rawRules = (rawParams as unknown as { rules: Record<string, { value: number }> }).rules
const parameters: FinancialEconomicRules = Object.fromEntries(
  Object.entries(rawRules).map(([k, v]) => [k, v.value]),
) as unknown as FinancialEconomicRules

// Extração de inputs e outputs do arquivo 02
interface AnnualInputItem {
  season: number
  plan: {
    values: {
      r15: number // total equipes
      r16: number // posicao
      r17: number // GPs
      r18: number // Sprints
      r19: number // Vitorias GP
      r20: number // Vitorias Sprint
      r21: number // C0
      r22: number // reajuste
      r29: number // patrocínio fixo
      r31: number // fração bônus pessoal
      r32: 'Participação' | 'Manual'
      r33: number // bônus manual
      r37: number // aporte
      r39: number // novo empréstimo
      r42: number // amortização
      r44: number // outras receitas
      r46: number // reserva
    }
  }
  costs: {
    values: {
      r49: number // estruturas
      r50: number // corridas
      r51: number // folha pilotos
      r52: number // folha staff
      r53: number // motor
      r54: number // evolucoes
      r55: number // preparacao
      r56: number // extras
      r57: number // total antes bonus/juros
    }
  }
}

interface AnnualOutputItem {
  season: number
  source_column: string
  values: {
    r06: number // Cota participação
    r07: number // Patrocínio fixo
    r08: number // Bônus vitórias
    r09: number // Bônus posição
    r10: number // Prêmios GP
    r11: number // Prêmios Sprint
    r12: number // Prêmio construtores
    r13: number // Outras receitas
    r14: number // TOTAL RECEITAS
    r17: number // Estruturas
    r18: number // Pilotos
    r19: number // Funcionários
    r20: number // PU
    r21: number // Corridas
    r22: number // Evoluções
    r23: number // Preparação
    r24: number // Extras
    r25: number // Bônus pessoal
    r26: number // Juros dívida
    r27: number // TOTAL CUSTOS
    r29: number // Investimento expansão
    r30: number // SALDO ANTES FINANCIAMENTO
    r32: number // Aportes proprietário
    r33: number // Novos empréstimos
    r34: number // Amortização
    r35: number // FINANCIAMENTO LÍQUIDO
    r36: number // Variação teórica
    r38: number // Caixa abertura
    r42: number // CAIXA ENCERRAMENTO
    r56: number // Fator P
    r57: number // Fator W
  }
}

const annualInputs = (rawScenarios as unknown as { annual_inputs: AnnualInputItem[] }).annual_inputs
const annualOutputs = (rawScenarios as unknown as { annual_source_outputs: AnnualOutputItem[] })
  .annual_source_outputs

const TOLERANCE = 0.000001 // ABS(dif) < 1e-6 (US$ 1 milhão)

describe('FIN-SOURCE-01A — Equivalência Estrita da Calculadora Anual (2026-2030 Audi)', () => {
  it('deve possuir os 5 anos de inputs e outputs no arquivo 02', () => {
    expect(annualInputs).toHaveLength(5)
    expect(annualOutputs).toHaveLength(5)
  })

  // Validação ano a ano encadeando o caixa
  const seasons = [2026, 2027, 2028, 2029, 2030]

  // Rastreamento para tabela do relatório final
  seasons.forEach((season) => {
    describe(`Temporada ${season}`, () => {
      const inputItem = annualInputs.find((i) => i.season === season)!
      const expected = annualOutputs.find((o) => o.season === season)!

      it(`ano ${season}: equivalência estrita por rubrica e totais`, () => {
        expect(inputItem).toBeDefined()
        expect(expected).toBeDefined()

        const pValues = inputItem.plan.values
        const cValues = inputItem.costs.values

        const planInputs: AnnualPlanInputs = {
          total_teams: pValues.r15,
          championship_position: pValues.r16,
          calendar_gps: pValues.r17,
          calendar_sprints: pValues.r18,
          gp_wins: pValues.r19,
          sprint_wins: pValues.r20,
          c0_reference: pValues.r21,
          cost_index: pValues.r22,
          fixed_sponsorship: pValues.r29,
          other_revenues: pValues.r44,
          staff_bonus_fraction: pValues.r31,
          bonus_regime: pValues.r32,
          manual_bonus: pValues.r33,
          owner_capital_injection: pValues.r37,
          new_loans: pValues.r39,
          debt_amortization: pValues.r42,
          opening_cash: expected.values.r38,
          indicative_reserve: pValues.r46,
        }

        const costInputs: AnnualCostInputs = {
          facilities: cValues.r49,
          race_operations: cValues.r50,
          drivers_payroll: cValues.r51,
          staff_payroll: cValues.r52,
          power_unit: cValues.r53,
          car_developments: cValues.r54,
          next_season_prep: cValues.r55,
          extra_costs: cValues.r56,
          debt_interest: expected.values.r26, // 0
          expansion_investments: expected.values.r29, // 0
        }

        const result = calculateAnnualFinances(parameters, planInputs, costInputs)

        // 1. Fatores esportivos P e W
        expect(Math.abs(result.p_factor - expected.values.r56)).toBeLessThan(TOLERANCE)
        expect(Math.abs(result.w_factor - expected.values.r57)).toBeLessThan(TOLERANCE)

        // 2. Rubricas de Receita
        expect(Math.abs(result.revenues.participation_quota - expected.values.r06)).toBeLessThan(
          TOLERANCE,
        )
        expect(Math.abs(result.revenues.fixed_sponsorship - expected.values.r07)).toBeLessThan(
          TOLERANCE,
        )
        expect(Math.abs(result.revenues.sponsor_wins_bonus - expected.values.r08)).toBeLessThan(
          TOLERANCE,
        )
        expect(Math.abs(result.revenues.sponsor_position_bonus - expected.values.r09)).toBeLessThan(
          TOLERANCE,
        )
        expect(Math.abs(result.revenues.gp_wins_prize - expected.values.r10)).toBeLessThan(
          TOLERANCE,
        )
        expect(Math.abs(result.revenues.sprint_wins_prize - expected.values.r11)).toBeLessThan(
          TOLERANCE,
        )
        expect(Math.abs(result.revenues.constructors_prize - expected.values.r12)).toBeLessThan(
          TOLERANCE,
        )
        expect(Math.abs(result.revenues.other_revenues - expected.values.r13)).toBeLessThan(
          TOLERANCE,
        )
        expect(Math.abs(result.revenues.total_revenue - expected.values.r14)).toBeLessThan(
          TOLERANCE,
        )

        // 3. Rubricas de Custos
        expect(Math.abs(result.costs.facilities - expected.values.r17)).toBeLessThan(TOLERANCE)
        expect(Math.abs(result.costs.drivers_payroll - expected.values.r18)).toBeLessThan(TOLERANCE)
        expect(Math.abs(result.costs.staff_payroll - expected.values.r19)).toBeLessThan(TOLERANCE)
        expect(Math.abs(result.costs.power_unit - expected.values.r20)).toBeLessThan(TOLERANCE)
        expect(Math.abs(result.costs.race_operations - expected.values.r21)).toBeLessThan(TOLERANCE)
        expect(Math.abs(result.costs.car_developments - expected.values.r22)).toBeLessThan(
          TOLERANCE,
        )
        expect(Math.abs(result.costs.next_season_prep - expected.values.r23)).toBeLessThan(
          TOLERANCE,
        )
        expect(Math.abs(result.costs.extra_costs - expected.values.r24)).toBeLessThan(TOLERANCE)
        expect(Math.abs(result.costs.staff_bonus - expected.values.r25)).toBeLessThan(TOLERANCE)
        expect(Math.abs(result.costs.debt_interest - expected.values.r26)).toBeLessThan(TOLERANCE)
        expect(Math.abs(result.costs.total_costs - expected.values.r27)).toBeLessThan(TOLERANCE)

        // 4. Saldos e Variações
        expect(Math.abs(result.balance_before_financing - expected.values.r30)).toBeLessThan(
          TOLERANCE,
        )
        expect(Math.abs(result.owner_capital_injection - expected.values.r32)).toBeLessThan(
          TOLERANCE,
        )
        expect(Math.abs(result.new_loans - expected.values.r33)).toBeLessThan(TOLERANCE)
        expect(Math.abs(result.debt_amortization - expected.values.r34)).toBeLessThan(TOLERANCE)
        expect(Math.abs(result.net_financing - expected.values.r35)).toBeLessThan(TOLERANCE)
        expect(Math.abs(result.theoretical_variation - expected.values.r36)).toBeLessThan(TOLERANCE)

        // 5. Caixa de encerramento
        expect(Math.abs(result.closing_cash - expected.values.r42)).toBeLessThan(TOLERANCE)
      })
    })
  })

  it('casos-chave conferidos analiticamente devem ser exatos', () => {
    // 2026: receitas 223,4454545455, custos 231,46, saldo -8,0145454545, caixa final 97,9854545455
    const exp2026 = annualOutputs.find((o) => o.season === 2026)!.values
    expect(exp2026.r14).toBeCloseTo(223.4454545455, 6)
    expect(exp2026.r27).toBeCloseTo(231.46, 6)
    expect(exp2026.r30).toBeCloseTo(-8.0145454545, 6)
    expect(exp2026.r42).toBeCloseTo(97.9854545455, 6)

    // 2028: W=1/7 (0.142857...), bônus vitórias 2.9714285714, bônus pessoal 0.8678571429, saldo -2.4655194805
    const exp2028 = annualOutputs.find((o) => o.season === 2028)!.values
    expect(exp2028.r57).toBeCloseTo(1 / 7, 6)
    expect(exp2028.r08).toBeCloseTo(2.9714285714, 6)
    expect(exp2028.r25).toBeCloseTo(0.8678571429, 6)
    expect(exp2028.r30).toBeCloseTo(-2.4655194805, 6)

    // 2030: P=1, W=0.5, receitas 244.0, saldo +9.19, caixa final 100.8967532468
    const exp2030 = annualOutputs.find((o) => o.season === 2030)!.values
    expect(exp2030.r56).toBeCloseTo(1.0, 6)
    expect(exp2030.r57).toBeCloseTo(0.5, 6)
    expect(exp2030.r14).toBeCloseTo(244.0, 6)
    expect(exp2030.r30).toBeCloseTo(9.19, 6)
    expect(exp2030.r42).toBeCloseTo(100.8967532468, 6)
  })

  it('funções isoladas P e W devem respeitar os limites matemáticos', () => {
    // P factor
    expect(calculatePositionFactor(12, 1)).toBe(1)
    expect(calculatePositionFactor(12, 12)).toBe(0)
    expect(calculatePositionFactor(12, 6)).toBe((12 - 6) / 11)
    expect(calculatePositionFactor(1, 1)).toBe(0)
    expect(calculatePositionFactor(12, 0)).toBe(0)
    expect(calculatePositionFactor(12, 13)).toBe(0)

    // W factor: V / (V + G/4)
    expect(calculateWinFactor(0, 24, 4)).toBe(0)
    expect(calculateWinFactor(6, 24, 4)).toBe(6 / (6 + 6)) // 0.5
    expect(calculateWinFactor(1, 24, 4)).toBe(1 / (1 + 6)) // 1/7 = 0.142857...
    expect(calculateWinFactor(3, 24, 4)).toBe(3 / (3 + 6)) // 3/9 = 1/3 = 0.333333...
    expect(calculateWinFactor(2, 0, 4)).toBe(0)
  })

  it('deve lançar erro explícito quando parâmetros ou entradas forem inválidos', () => {
    // Ausência de regras
    expect(() => calculateAnnualFinances(null as any, {} as any, {} as any)).toThrowError(
      /Regras econômicas ausentes/,
    )

    // Parâmetro NaN
    const corruptedRules = { ...parameters, participation_annual_fixed: NaN }
    expect(() =>
      calculateAnnualFinances(
        corruptedRules,
        {
          total_teams: 12,
          championship_position: 1,
          calendar_gps: 24,
          calendar_sprints: 6,
          gp_wins: 0,
          sprint_wins: 0,
          c0_reference: 260,
          fixed_sponsorship: 130,
          staff_bonus_fraction: 0.25,
          bonus_regime: 'Participação',
          opening_cash: 91,
        },
        {
          facilities: 55.6,
          drivers_payroll: 9,
          staff_payroll: 54.8,
          power_unit: 31,
          race_operations: 28,
          car_developments: 25.28,
          next_season_prep: 27.78,
        },
      ),
    ).toThrowError(/participation_annual_fixed/)
  })
})
