import React, { useState } from 'react'
import { CanonicalSponsorSlot, SponsorshipContract } from '@/types/canonical-commercial'
import { SponsorSlotKey, OFFICIAL_SPONSOR_SLOTS } from '@/data/assets/teamSponsorHotspots'
import { formatMoneyM, formatPercent } from '@/lib/formatters'
import {
  Handshake,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  XCircle,
  FileCheck2,
  Building2,
  DollarSign,
  ChevronRight,
} from 'lucide-react'

export interface ActiveNegotiationItem {
  id: string
  sponsorId: string
  sponsorName: string
  sector: string
  country: string
  logoUrl?: string
  slot: SponsorSlotKey
  pipelineStage:
    | 'contato'
    | 'interesse'
    | 'proposta'
    | 'contraproposta'
    | 'decisao'
    | 'fechado'
    | 'recusado'
  initialOfferAnnual: number // US$ M
  currentOfferAnnual: number // US$ M
  askedCounterAnnual?: number // US$ M
  durationYears: number
  sportingRequirement: string
  podiumBonus: number // US$ M
  sponsorFit: number // 0-100
  roundsCount: number
  maxRounds: number
  status: 'em_andamento' | 'fechado' | 'recusado'
}

export interface TabNegotiationDeskProps {
  negotiations: ActiveNegotiationItem[]
  onAcceptOffer: (negId: string) => void
  onRejectOffer: (negId: string) => void
  onSendCounter: (negId: string, counterAnnualValue: number, durationYears: number) => void
  onCloseNegotiation: (negId: string) => void
  onExploreMarketTab: () => void
}

export const TabNegotiationDesk: React.FC<TabNegotiationDeskProps> = ({
  negotiations,
  onAcceptOffer,
  onRejectOffer,
  onSendCounter,
  onCloseNegotiation,
  onExploreMarketTab,
}) => {
  const [selectedNegId, setSelectedNegId] = useState<string | null>(
    negotiations.length > 0 ? negotiations[0].id : null,
  )

  const activeNegotiation =
    negotiations.find((n) => n.id === selectedNegId) || negotiations[0] || null

  const [counterValue, setCounterValue] = useState<number>(
    activeNegotiation ? activeNegotiation.currentOfferAnnual : 15,
  )
  const [counterYears, setCounterYears] = useState<number>(
    activeNegotiation ? activeNegotiation.durationYears : 2,
  )

  React.useEffect(() => {
    if (activeNegotiation) {
      setCounterValue(activeNegotiation.currentOfferAnnual)
      setCounterYears(activeNegotiation.durationYears)
    }
  }, [activeNegotiation])

  // Etapas do Pipeline
  const PIPELINE_STEPS = [
    { key: 'contato', label: 'Contato' },
    { key: 'interesse', label: 'Interesse' },
    { key: 'proposta', label: 'Proposta' },
    { key: 'contraproposta', label: 'Contraproposta' },
    { key: 'decisao', label: 'Decisão' },
  ]

  const getStepIndex = (stage: string) => {
    switch (stage) {
      case 'contato':
        return 0
      case 'interesse':
        return 1
      case 'proposta':
        return 2
      case 'contraproposta':
        return 3
      case 'decisao':
      case 'fechado':
      case 'recusado':
        return 4
      default:
        return 0
    }
  }

  if (negotiations.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
          <Handshake className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-neutral-900">
          Nenhuma negociação em andamento na mesa
        </h3>
        <p className="text-xs text-neutral-500 max-w-md mx-auto">
          Visite a aba <strong>Mercado & Oportunidades</strong> ou clique nos espaços vagos do carro
          para convidar marcas oficiais e iniciar rodadas reais de proposta e contraproposta.
        </p>
        <button
          onClick={onExploreMarketTab}
          className="px-5 py-2.5 rounded-xl bg-[#E10600] hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md inline-flex items-center gap-2"
        >
          Explorar Oportunidades no Mercado
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. PIPELINE HORIZONTAL SUPERIOR DE RESUMO DA NEGOCIAÇÃO ATIVA */}
      {activeNegotiation && (
        <div className="bg-[#0B0E14] border border-[#1F2733] rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1F2733]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 p-2 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-neutral-200" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#E10600] font-bold block">
                  PIPELINE DE NEGOCIAÇÃO // F1 2026
                </span>
                <h3 className="text-lg font-black text-white">
                  {activeNegotiation.sponsorName} ({activeNegotiation.country})
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-neutral-800 text-neutral-300">
                Rodada {activeNegotiation.roundsCount} de {activeNegotiation.maxRounds}
              </span>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Fit: {formatPercent(activeNegotiation.sponsorFit)}
              </span>
            </div>
          </div>

          {/* Stepper visual do Pipeline */}
          <div className="pt-4 grid grid-cols-5 gap-2">
            {PIPELINE_STEPS.map((step, idx) => {
              const currentIdx = getStepIndex(activeNegotiation.pipelineStage)
              const isPast = idx < currentIdx
              const isCurrent = idx === currentIdx

              return (
                <div key={step.key} className="space-y-1.5">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      isCurrent
                        ? 'bg-[#E10600] shadow-[0_0_10px_rgba(225,6,0,0.8)]'
                        : isPast
                          ? 'bg-emerald-500'
                          : 'bg-[#1F2733]'
                    }`}
                  />
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span
                      className={`${
                        isCurrent
                          ? 'text-white font-bold'
                          : isPast
                            ? 'text-emerald-400'
                            : 'text-[#8B95A7]'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 2. GRID PRINCIPAL: LISTA DE PROCESSOS À ESQUERDA + DETALHES & AÇÕES À DIREITA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LISTA DE NEGOCIAÇÕES ATIVAS (5 COLUNAS) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Handshake className="w-4 h-4 text-[#E10600]" />
                Negociações Abertas ({negotiations.length})
              </h3>
              <button
                onClick={onExploreMarketTab}
                className="text-xs font-bold text-[#E10600] hover:underline"
              >
                + Nova
              </button>
            </div>

            <div className="space-y-2">
              {negotiations.map((neg) => {
                const isSelected = selectedNegId === neg.id
                const slotLabel =
                  OFFICIAL_SPONSOR_SLOTS.find((s) => s.key === neg.slot)?.labelEn || neg.slot

                return (
                  <div
                    key={neg.id}
                    onClick={() => setSelectedNegId(neg.id)}
                    className={`cursor-pointer rounded-xl p-3.5 border transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-[#E10600] bg-red-50/50 shadow-sm ring-1 ring-[#E10600]/30'
                        : 'border-neutral-150 bg-neutral-50/60 hover:bg-neutral-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-900">
                          {neg.sponsorName}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-neutral-200 text-neutral-700 font-bold uppercase">
                          {slotLabel}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        {neg.sector} • {neg.country}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-black text-emerald-600 block">
                        {formatMoneyM(neg.currentOfferAnnual)}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400">
                        {neg.durationYears} {neg.durationYears === 1 ? 'temporada' : 'temporadas'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* DETALHES DA OFERTA & PAINEL DE CONTRAPROPOSTA REAL (7 COLUNAS) */}
        {activeNegotiation && (
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 space-y-5">
              <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
                <div>
                  <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block font-bold">
                    TERMOS DA OFERTA // {activeNegotiation.sponsorName}
                  </span>
                  <h3 className="text-base font-bold text-neutral-900 mt-0.5">
                    Espaço Alvo:{' '}
                    {OFFICIAL_SPONSOR_SLOTS.find((s) => s.key === activeNegotiation.slot)?.label}
                  </h3>
                </div>

                <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-100 text-amber-800 font-bold">
                  Status: {activeNegotiation.pipelineStage.toUpperCase()}
                </span>
              </div>

              {/* Quadro de Oferta Atual */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <span className="text-[10px] text-neutral-500 font-mono block">
                    Oferta Anual Fixo
                  </span>
                  <span className="text-sm font-black font-mono text-emerald-600">
                    {formatMoneyM(activeNegotiation.currentOfferAnnual)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <span className="text-[10px] text-neutral-500 font-mono block">
                    Duração Proposta
                  </span>
                  <span className="text-sm font-bold text-neutral-900">
                    {activeNegotiation.durationYears}{' '}
                    {activeNegotiation.durationYears === 1 ? 'Temporada' : 'Temporadas'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <span className="text-[10px] text-neutral-500 font-mono block">
                    Bônus por Pódio
                  </span>
                  <span className="text-sm font-black font-mono text-cyan-600">
                    +{formatMoneyM(activeNegotiation.podiumBonus)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <span className="text-[10px] text-neutral-500 font-mono block">
                    Fit com a Equipe
                  </span>
                  <span className="text-sm font-bold text-neutral-900">
                    {formatPercent(activeNegotiation.sponsorFit)} (Sólido)
                  </span>
                </div>
              </div>

              {/* Exigência Esportiva */}
              <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-150 space-y-1">
                <span className="text-[10px] font-mono text-neutral-500 uppercase block font-semibold">
                  Exigência Contratual da Marca
                </span>
                <p className="text-xs text-neutral-800 font-medium">
                  "{activeNegotiation.sportingRequirement}"
                </p>
              </div>

              {/* Formulário de Contraproposta Real */}
              <div className="p-4 rounded-xl bg-neutral-900 text-white space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    Enviar Contraproposta da Equipe
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400">
                    Rodada {activeNegotiation.roundsCount}/{activeNegotiation.maxRounds}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-neutral-300 block mb-1 font-mono text-[11px]">
                      Valor Anual Solicitado (US$ Milhões):
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="60"
                      value={counterValue}
                      onChange={(e) => setCounterValue(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-black/50 border border-neutral-700 text-white font-mono font-bold text-sm focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-300 block mb-1 font-mono text-[11px]">
                      Duração do Contrato:
                    </label>
                    <select
                      value={counterYears}
                      onChange={(e) => setCounterYears(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-black/50 border border-neutral-700 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                    >
                      <option value={1}>1 Temporada (Flexível)</option>
                      <option value={2}>2 Temporadas (Padrão)</option>
                      <option value={3}>3 Temporadas (Segurança)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-neutral-400">
                    Ajustes de até +{formatPercent(15)} costumam ser aceitos em 1 rodada.
                  </span>
                  <button
                    onClick={() => onSendCounter(activeNegotiation.id, counterValue, counterYears)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs transition-colors flex items-center gap-1.5"
                  >
                    Submeter Contraproposta
                  </button>
                </div>
              </div>

              {/* Ações Finais: Aceitar (Assinar Acordo) ou Recusar */}
              <div className="pt-3 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  onClick={() => onRejectOffer(activeNegotiation.id)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-neutral-600 hover:text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  Recusar e Encerrar
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => onCloseNegotiation(activeNegotiation.id)}
                    className="px-4 py-2 rounded-xl border border-neutral-200 text-neutral-700 hover:bg-neutral-100 text-xs font-semibold"
                  >
                    Congelar Mesa
                  </button>
                  <button
                    onClick={() => onAcceptOffer(activeNegotiation.id)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Aceitar & Assinar Contrato Oficial
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
