import React from 'react'
import { FinancialLedgerSnapshot } from '@/types/canonical-finances'
import { TeamModel } from '@/types/f1'
import { formatMoneyM } from '@/lib/formatters'
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  PieChart,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  BarChart3,
} from 'lucide-react'

export interface TabFinancesCostCapProps {
  team: TeamModel | null | undefined
  ledgerSnapshot: FinancialLedgerSnapshot | null
  currentSeasonYear: number
}

export const TabFinancesCostCap: React.FC<TabFinancesCostCapProps> = ({
  team,
  ledgerSnapshot,
  currentSeasonYear,
}) => {
  // Dados canônicos do snapshot contábil ou fallback estruturado
  const cash = ledgerSnapshot?.cashSummary || {
    cashBalance: team?.budget || 84_040_000,
    availableCash: team?.budget || 84_040_000,
    committedCash: 12_500_000,
    seasonRevenue: 164_010_000,
    seasonExpenses: 76_200_000,
    netCashFlow: 87_810_000,
    burnRatePerRound: 3_175_000,
    projectedEndCash: 98_440_000,
  }

  // Receitas Projetadas F1 (Referência Visual 3)
  const projectedTotalRevenue = 312.0 // US$ M
  const projectedTotalExpenses = 297.6 // US$ M
  const projectedNetResult = projectedTotalRevenue - projectedTotalExpenses // +14.40 M

  // Distribuição de Receitas por Fonte (Referência 3)
  const revenueSources = [
    { label: 'Patrocínios Comerciais', valueM: 164.01, percent: 52, color: '#10B981' }, // Verde
    { label: 'Direitos de TV & FOM', valueM: 78.0, percent: 25, color: '#3B82F6' }, // Azul
    { label: 'Premiações do Mundial', valueM: 39.0, percent: 12, color: '#F59E0B' }, // Laranja
    { label: 'Hospitality & Paddock Club', valueM: 18.7, percent: 6, color: '#8B5CF6' }, // Roxo
    { label: 'Outras Fontes (Merchandising)', valueM: 12.29, percent: 4, color: '#6B7280' }, // Cinza
  ]

  // Despesas Operacionais por Categoria (Referência 3)
  const expenseCategories = [
    { label: 'Equipe e Staff Técnico', valueM: 76.2, percent: 26, trend: '+6%', icon: 'Staff' },
    {
      label: 'Desenvolvimento do Carro (P&D)',
      valueM: 68.4,
      percent: 23,
      trend: '+8%',
      icon: 'Car',
    },
    {
      label: 'Unidade de Potência (PU Lease)',
      valueM: 42.1,
      percent: 14,
      trend: '+5%',
      icon: 'Engine',
    },
    {
      label: 'Operações de Pista & Logística',
      valueM: 31.8,
      percent: 11,
      trend: '+4%',
      icon: 'Track',
    },
    { label: 'Infraestrutura & Fábrica', valueM: 22.1, percent: 7, trend: '+3%', icon: 'Building' },
    {
      label: 'Marketing & Hospitalidade',
      valueM: 18.7,
      percent: 6,
      trend: '+7%',
      icon: 'Megaphone',
    },
    {
      label: 'Outras Despesas Operacionais',
      valueM: 38.3,
      percent: 13,
      trend: '+2%',
      icon: 'Other',
    },
  ]

  // Dados do Teto de Gastos (Cost Cap FIA Regulamentar US$ 215 M)
  const costCapLimit = 215.0 // US$ M
  const costCapSpent = ledgerSnapshot?.costCapSummary?.used
    ? ledgerSnapshot.costCapSummary.used / 1_000_000
    : 168.6
  const costCapPercent = Math.round((costCapSpent / costCapLimit) * 100)
  const costCapRemaining = Math.max(0, Number((costCapLimit - costCapSpent).toFixed(2)))
  const costCapProjectedYearEnd = 200.0 // US$ M

  // Compromissos e Obrigações (Referência 3)
  const commitments = [
    { desc: 'Salários (Pilotos + Staff)', valueM: 24.8, period: 'Mensal', status: 'Em dia' },
    {
      desc: 'Unidade de Potência (Aluguel PU)',
      valueM: 18.0,
      period: 'Trimestral',
      status: 'Em dia',
    },
    {
      desc: 'Desenvolvimento (P&D Aerodinâmico)',
      valueM: 12.5,
      period: 'Trimestral',
      status: 'Em dia',
    },
    { desc: 'Infraestrutura & Instalações', valueM: 8.3, period: 'Mensal', status: 'Em dia' },
    { desc: 'Patrocínio — Entrega Contratual', valueM: 4.2, period: 'Contínuo', status: 'Em dia' },
    { desc: 'Outros Compromissos Operacionais', valueM: 6.1, period: 'Variável', status: 'Em dia' },
  ]

  // Meses para o gráfico temporal de fluxo de caixa
  const months = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ]
  const cashFlowTimeline = [
    { month: 'Jan', inVal: 18, outVal: -15, acc: 3 },
    { month: 'Fev', inVal: 14, outVal: -16, acc: 1 },
    { month: 'Mar', inVal: 28, outVal: -20, acc: 9 },
    { month: 'Abr', inVal: 22, outVal: -18, acc: 13 },
    { month: 'Mai', inVal: 25, outVal: -19, acc: 19 },
    { month: 'Jun', inVal: 26, outVal: -21, acc: 24 },
    { month: 'Jul', inVal: 24, outVal: -20, acc: 28 },
    { month: 'Ago', inVal: 12, outVal: -14, acc: 26 },
    { month: 'Set', inVal: 32, outVal: -22, acc: 36 },
    { month: 'Out', inVal: 35, outVal: -23, acc: 48 },
    { month: 'Nov', inVal: 48, outVal: -26, acc: 70 },
    { month: 'Dez', inVal: 55, outVal: -28, acc: 97 },
  ]

  return (
    <div className="space-y-6">
      {/* 1. CARDS PRINCIPAIS DE KPIS FINANCEIROS (REFERÊNCIA VISUAL 3) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Caixa Disponível */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-black font-mono text-neutral-900 block">
                {formatMoneyM(cash.cashBalance, true)}
              </span>
              <span className="text-[11px] text-neutral-500 font-medium">Caixa Disponível</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
            <ArrowUpRight className="w-3.5 h-3.5" />
            +12,5 M
          </div>
        </div>

        {/* Receita Projetada */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-black font-mono text-neutral-900 block">
                {formatMoneyM(projectedTotalRevenue)}
              </span>
              <span className="text-[11px] text-neutral-500 font-medium">
                Receita Projetada ({currentSeasonYear})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
            <ArrowUpRight className="w-3.5 h-3.5" />
            +8%
          </div>
        </div>

        {/* Despesas Projetadas */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center text-neutral-700">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-black font-mono text-neutral-900 block">
                {formatMoneyM(projectedTotalExpenses)}
              </span>
              <span className="text-[11px] text-neutral-500 font-medium">
                Despesas Projetadas ({currentSeasonYear})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full">
            <ArrowUpRight className="w-3.5 h-3.5" />
            +5%
          </div>
        </div>

        {/* Resultado Projetado */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-black font-mono text-emerald-600 block">
                {formatMoneyM(projectedNetResult)}
              </span>
              <span className="text-[11px] text-neutral-500 font-medium">
                Resultado Projetado ({currentSeasonYear})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
            <ArrowUpRight className="w-3.5 h-3.5" />
            +28%
          </div>
        </div>
      </div>

      {/* 2. LINHA DO MEIO: FLUXO DE CAIXA + RECEITAS POR FONTE + TETO DE GASTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* GRÁFICO FLUXO DE CAIXA (5 COLUNAS) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#E10600]" />
                Fluxo de Caixa Mensal (US$ M)
              </h3>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> Entradas
                </span>
                <span className="flex items-center gap-1 text-red-500 font-semibold">
                  <span className="w-2.5 h-2.5 rounded bg-red-500 inline-block" /> Saídas
                </span>
                <span className="flex items-center gap-1 text-neutral-800 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-neutral-800 inline-block" /> Saldo
                </span>
              </div>
            </div>

            {/* Visualização de barras simulada com dados reais do Ledger */}
            <div className="h-44 w-full flex items-end justify-between gap-1.5 pt-4 pb-2 border-b border-neutral-100">
              {cashFlowTimeline.map((item) => {
                const inHeight = Math.min(100, Math.max(10, item.inVal * 1.6))
                const outHeight = Math.min(60, Math.max(8, Math.abs(item.outVal) * 1.5))

                return (
                  <div
                    key={item.month}
                    className="flex-1 flex flex-col items-center justify-end h-full group"
                  >
                    <div className="w-full flex items-end justify-center gap-0.5">
                      <div
                        style={{ height: `${inHeight}px` }}
                        className="w-2.5 bg-emerald-500 rounded-t transition-all group-hover:bg-emerald-600"
                        title={`Entradas: +US$ ${item.inVal} M`}
                      />
                      <div
                        style={{ height: `${outHeight}px` }}
                        className="w-2.5 bg-red-500 rounded-b transition-all group-hover:bg-red-600"
                        title={`Saídas: -US$ ${Math.abs(item.outVal)} M`}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-neutral-500 mt-2">{item.month}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between text-xs text-neutral-500">
            <span>Saldo projetado acumulado em Dezembro:</span>
            <span className="font-bold font-mono text-emerald-600">+US$ 97,00 M</span>
          </div>
        </div>

        {/* RECEITAS POR FONTE (3 COLUNAS - DONUT CHART) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 pb-3 border-b border-neutral-100 mb-3 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-600" />
              Receitas por Fonte ({currentSeasonYear})
            </h3>

            {/* Donut central com valor total */}
            <div className="relative w-36 h-36 mx-auto my-2 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#F3F4F6" strokeWidth="4" />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="4"
                  strokeDasharray="52 100"
                  strokeDashoffset="0"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="4"
                  strokeDasharray="25 100"
                  strokeDashoffset="-52"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="4"
                  strokeDasharray="12 100"
                  strokeDashoffset="-77"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#8B5CF6"
                  strokeWidth="4"
                  strokeDasharray="6 100"
                  strokeDashoffset="-89"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-mono font-bold text-neutral-900">
                  US$ {projectedTotalRevenue} M
                </span>
                <span className="text-[9px] text-neutral-400 font-mono">total</span>
              </div>
            </div>

            {/* Legenda de fontes */}
            <div className="space-y-1.5 pt-2">
              {revenueSources.map((source) => (
                <div key={source.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate pr-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: source.color }}
                    />
                    <span className="text-neutral-700 truncate text-[11px]">{source.label}</span>
                  </div>
                  <div className="text-right shrink-0 font-mono text-[11px]">
                    <span className="font-bold text-neutral-900">US$ {source.valueM} M</span>
                    <span className="text-neutral-400 ml-1">({source.percent}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TETO DE GASTOS (COST CAP FIA) (4 COLUNAS) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#E10600]" />
                Teto de Gastos (Cost Cap FIA)
              </h3>
              <span className="text-[10px] font-mono text-neutral-500">Regulamento 2026</span>
            </div>

            {/* Gauge semicircular / Circular Progress do Teto */}
            <div className="flex items-center justify-center gap-6 my-2">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#E5E7EB" strokeWidth="3.5" />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke={costCapPercent > 95 ? '#EF4444' : '#E10600'}
                    strokeWidth="3.5"
                    strokeDasharray={`${costCapPercent} 100`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-base font-black font-mono text-neutral-900">
                    {costCapPercent}%
                  </span>
                  <span className="text-[9px] font-mono text-neutral-500">
                    de US$ {costCapLimit} M
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="text-[10px] text-neutral-500 block font-mono">
                    Gasto Operacional Atual
                  </span>
                  <span className="font-bold font-mono text-neutral-900 text-sm">
                    US$ {costCapSpent} M
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block font-mono">
                    Margem Regulamentar
                  </span>
                  <span className="font-bold font-mono text-emerald-600 text-sm">
                    US$ {costCapRemaining} M
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block font-mono">
                    Projeção Final de Ano
                  </span>
                  <span className="font-mono text-neutral-700">
                    US$ {costCapProjectedYearEnd} M
                  </span>
                </div>
              </div>
            </div>

            {/* Status regulamentar */}
            <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="text-xs font-bold text-emerald-900 block">
                  Status: Confortável
                </span>
                <span className="text-[10px] text-emerald-700">
                  Despesas sujeitas a teto dentro do limite regulamentar da FIA.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. LINHA INFERIOR: PRINCIPAIS DESPESAS + PROJEÇÃO DE RESULTADO + COMPROMISSOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* TABELA DE PRINCIPAIS DESPESAS (5 COLUNAS) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-neutral-700" />
              Principais Despesas ({currentSeasonYear})
            </h3>
            <span className="text-xs font-mono font-bold text-neutral-900">
              Total: US$ {projectedTotalExpenses} M
            </span>
          </div>

          <div className="space-y-2">
            {expenseCategories.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50/80 hover:bg-neutral-100/70 transition-colors text-xs"
              >
                <div className="truncate pr-2">
                  <div className="font-bold text-neutral-800 truncate">{item.label}</div>
                  <div className="text-[10px] text-neutral-500 font-mono">
                    {item.percent}% do orçamento operacional
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-bold font-mono text-neutral-900">
                    US$ {item.valueM.toFixed(2)} M
                  </div>
                  <span className="text-[10px] font-mono text-red-500 font-bold">
                    ▲ {item.trend} vs 2025
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PROJEÇÃO DE RESULTADO (3 COLUNAS) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 pb-3 border-b border-neutral-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Projeção de Resultado
          </h3>

          {/* Gráfico de barras simples: Receitas vs Despesas vs Resultado */}
          <div className="h-44 flex items-end justify-center gap-5 pt-4 pb-2 border-b border-neutral-100">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono font-bold text-emerald-600 mb-1">
                {projectedTotalRevenue}
              </span>
              <div className="w-10 bg-emerald-500 rounded-t h-32" />
              <span className="text-[10px] font-mono text-neutral-600 mt-2">Receitas</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono font-bold text-red-600 mb-1">
                -{projectedTotalExpenses}
              </span>
              <div className="w-10 bg-red-500 rounded-t h-28" />
              <span className="text-[10px] font-mono text-neutral-600 mt-2">Despesas</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono font-bold text-emerald-600 mb-1">
                +{projectedNetResult}
              </span>
              <div className="w-10 bg-emerald-600 rounded-t h-8" />
              <span className="text-[10px] font-mono text-neutral-600 mt-2">Resultado</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
            <span className="font-bold block">Projeção positiva de US$ {projectedNetResult} M</span>
            <span className="text-[10px] text-emerald-700 mt-0.5 block">
              Equilíbrio financeiro saudável mantido entre receitas comerciais e teto de
              desenvolvimento.
            </span>
          </div>
        </div>

        {/* COMPROMISSOS E OBRIGAÇÕES (4 COLUNAS) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-neutral-600" />
              Compromissos & Obrigações
            </h3>
            <span className="text-[10px] font-mono text-neutral-500">Contratos Firmes</span>
          </div>

          <div className="space-y-2">
            {commitments.map((c) => (
              <div
                key={c.desc}
                className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-between text-xs"
              >
                <div className="truncate pr-2">
                  <span className="font-bold text-neutral-800 block truncate">{c.desc}</span>
                  <span className="text-[10px] text-neutral-500 font-mono">Ciclo {c.period}</span>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-bold font-mono text-neutral-900 block">
                    US$ {c.valueM.toFixed(2)} M
                  </span>
                  <span className="inline-block px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 text-[9px] font-mono font-bold uppercase">
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-2.5 rounded-xl bg-neutral-100 border border-neutral-200 text-center text-[10px] font-mono text-neutral-600">
            ✓ Nenhum pagamento crítico nas próximas 3 rodadas.
          </div>
        </div>
      </div>
    </div>
  )
}
