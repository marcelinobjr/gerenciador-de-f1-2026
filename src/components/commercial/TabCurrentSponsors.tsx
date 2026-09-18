import React from 'react'
import { SponsorshipContract, CommercialSummary } from '@/types/canonical-commercial'
import { SponsorSlotKey, OFFICIAL_SPONSOR_SLOTS } from '@/data/assets/teamSponsorHotspots'
import { CarSideViewHotspots } from './CarSideViewHotspots'
import { formatMoneyM } from '@/lib/formatters'
import {
  DollarSign,
  TrendingUp,
  Award,
  Layers,
  ArrowRight,
  Search,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

import { getSponsorSlotPhoto } from '@/data/assets/carPartAssets'

export interface TabCurrentSponsorsProps {
  teamId?: string | null
  teamName?: string
  contracts: SponsorshipContract[]
  summary: CommercialSummary
  selectedSlot: SponsorSlotKey
  onSelectSlot: (slot: SponsorSlotKey) => void
  onExploreMarket: (slot: SponsorSlotKey) => void
}

export const TabCurrentSponsors: React.FC<TabCurrentSponsorsProps> = ({
  teamId,
  teamName,
  contracts,
  summary,
  selectedSlot,
  onSelectSlot,
  onExploreMarket,
}) => {
  const getContractForSlot = (slotKey: SponsorSlotKey) => {
    return contracts.find(
      (c) =>
        c.status === 'ativo' &&
        (c.slot === slotKey || (c.packageSlots && c.packageSlots.includes(slotKey as any))),
    )
  }

  const activeContract = getContractForSlot(selectedSlot)
  const currentSlotMeta =
    OFFICIAL_SPONSOR_SLOTS.find((s) => s.key === selectedSlot) || OFFICIAL_SPONSOR_SLOTS[0]

  return (
    <div className="space-y-6">
      {/* 1. SEÇÃO DO CARRO LATERAL REAL COM 5 HOTSPOTS */}
      <CarSideViewHotspots
        teamId={teamId}
        teamName={teamName}
        contracts={contracts}
        selectedSlot={selectedSlot}
        onSelectSlot={onSelectSlot}
        onExploreMarket={onExploreMarket}
      />

      {/* 2. KPIS COMERCIAIS RÁPIDOS DA CARREIRA (REFERÊNCIA VISUAL 1) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0B0E14] border border-[#1F2733] rounded-xl p-3.5 shadow-lg">
        <div className="flex items-center gap-3 px-3 py-1.5 border-r border-[#1F2733]/60 last:border-none">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B95A7] block">
              Receita Contratada
            </span>
            <span className="text-base font-black font-mono text-emerald-400">
              {formatMoneyM(summary.totalContractedRevenue, true)}/ano
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 px-3 py-1.5 border-r border-[#1F2733]/60 last:border-none">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B95A7] block">
              Receita Potencial
            </span>
            <span className="text-base font-black font-mono text-cyan-400">
              {formatMoneyM(summary.totalPotentialRevenue, true)}/ano
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 px-3 py-1.5 border-r border-[#1F2733]/60 last:border-none">
          <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B95A7] block">
              Espaços de Patrocínio
            </span>
            <span className="text-base font-black font-mono text-white">
              {summary.occupiedSlotsCount} / {summary.totalSlotsCount} Ocupados
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 px-3 py-1.5">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B95A7] block">
              Satisfação Média
            </span>
            <span className="text-base font-black font-mono text-amber-400">
              {summary.averageSatisfaction > 0 ? `${summary.averageSatisfaction}%` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. GRID PRINCIPAL: LISTA DE SLOTS À ESQUERDA + DETALHES DO SELECIONADO À DIREITA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUNA ESQUERDA: LISTA DOS 5 ESPAÇOS OFICIAIS (5 COLUNAS) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#E10600]" />
                Espaços Oficiais do Carro
              </h3>
              <span className="text-xs font-mono font-semibold text-neutral-500">
                {summary.occupiedSlotsCount}/5 Ativos
              </span>
            </div>

            <div className="space-y-2">
              {OFFICIAL_SPONSOR_SLOTS.map((slot) => {
                const contract = getContractForSlot(slot.key)
                const isSelected = selectedSlot === slot.key
                const isOccupied = !!contract

                return (
                  <div
                    key={slot.key}
                    onClick={() => onSelectSlot(slot.key)}
                    className={`cursor-pointer rounded-xl p-3 border transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-[#E10600] bg-red-50/50 shadow-sm ring-1 ring-[#E10600]/30'
                        : 'border-neutral-150 bg-neutral-50/60 hover:bg-neutral-100/70 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-10 rounded-lg bg-neutral-900/5 p-1 flex items-center justify-center shrink-0 border border-neutral-200">
                        <img
                          src={getSponsorSlotPhoto(slot.key)}
                          alt={slot.label}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-neutral-900 truncate">
                          {slot.label}
                        </div>
                        <div className="text-[11px] text-neutral-500 truncate">
                          {isOccupied ? contract.sponsorName : 'Espaço Disponível'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isOccupied ? (
                        <>
                          <div className="text-xs font-bold font-mono text-emerald-600">
                            {formatMoneyM(contract.fixedAnnualValue, true)}
                          </div>
                          <span className="inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold uppercase">
                            Ativo até {contract.seasonEnd}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="text-[11px] font-mono text-neutral-400">
                            US$ {slot.defaultMarketValueMin}M - {slot.defaultMarketValueMax}M
                          </div>
                          <span className="inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-600 font-semibold uppercase">
                            Disponível
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Resumo Comercial */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3 font-mono">
              Resumo Operacional Comercial
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-100">
                <span className="text-[10px] text-neutral-500 block font-mono">
                  Receita Contratada
                </span>
                <span className="font-bold font-mono text-neutral-900 text-sm">
                  {formatMoneyM(summary.totalContractedRevenue, true)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-100">
                <span className="text-[10px] text-neutral-500 block font-mono">
                  Espaços Ocupados
                </span>
                <span className="font-bold font-mono text-neutral-900 text-sm">
                  {summary.occupiedSlotsCount} de 5 oficiais
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-100">
                <span className="text-[10px] text-neutral-500 block font-mono">
                  Negociações na Mesa
                </span>
                <span className="font-bold font-mono text-neutral-900 text-sm">
                  {summary.pendingNegotiationsCount} em andamento
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-100">
                <span className="text-[10px] text-neutral-500 block font-mono">
                  Satisfação de Marca
                </span>
                <span className="font-bold font-mono text-emerald-600 text-sm">
                  {summary.averageSatisfaction > 0
                    ? `${summary.averageSatisfaction}%`
                    : '100% Estável'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: PAINEL DE DETALHES DO ESPAÇO SELECIONADO (7 COLUNAS) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-150">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#E10600] block">
                  ESPAÇO SELECIONADO // {currentSlotMeta.labelEn.toUpperCase()}
                </span>
                <h3 className="text-lg font-black text-neutral-900 mt-0.5">
                  {currentSlotMeta.label}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {activeContract ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1.5 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    CONTRATO ATIVO
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800 flex items-center gap-1.5 border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5" />
                    ESPAÇO VAGO
                  </span>
                )}
              </div>
            </div>

            {/* SE O ESPAÇO ESTÁ OCUPADO -> MOSTRA DADOS REAIS DO CONTRATO */}
            {activeContract ? (
              <div className="mt-4 space-y-5">
                <div className="flex items-start justify-between bg-neutral-900 text-white rounded-xl p-4 shadow-md">
                  <div>
                    <span className="text-[10px] font-mono text-neutral-400 block uppercase">
                      Patrocinador Oficial
                    </span>
                    <h4 className="text-xl font-black tracking-tight mt-0.5">
                      {activeContract.sponsorName}
                    </h4>
                    <p className="text-xs text-neutral-300 mt-1 max-w-md">
                      {currentSlotMeta.description}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-neutral-400 block uppercase">
                      Receita Fixa Anual
                    </span>
                    <span className="text-lg font-black font-mono text-emerald-400 block mt-0.5">
                      {formatMoneyM(activeContract.fixedAnnualValue, true)}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">por temporada</span>
                  </div>
                </div>

                {/* Tabela de especificações contratuais reais */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="text-[10px] text-neutral-500 font-mono block">
                      Setor de Atuação
                    </span>
                    <span className="text-xs font-bold text-neutral-800">
                      Automotivo & Engenharia
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="text-[10px] text-neutral-500 font-mono block">
                      Início do Contrato
                    </span>
                    <span className="text-xs font-bold text-neutral-800">
                      Temporada {activeContract.seasonStart || 2026}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="text-[10px] text-neutral-500 font-mono block">
                      Término do Contrato
                    </span>
                    <span className="text-xs font-bold text-neutral-800">
                      Temporada {activeContract.seasonEnd}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="text-[10px] text-neutral-500 font-mono block">
                      Satisfação da Marca
                    </span>
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      ★ {activeContract.satisfaction || 85}% (Estável)
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="text-[10px] text-neutral-500 font-mono block">
                      Interesse em Renovar
                    </span>
                    <span className="text-xs font-bold text-neutral-800">
                      {activeContract.renewalInterest || 'Muito Alto'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="text-[10px] text-neutral-500 font-mono block">
                      Bônus por Performance
                    </span>
                    <span className="text-xs font-bold text-neutral-800">
                      {activeContract.podiumBonus
                        ? `${formatMoneyM(activeContract.podiumBonus, true)} / pódio`
                        : 'Sim (incluso)'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">
                    Contrato em conformidade com o livro razão contábil.
                  </span>
                  <button
                    onClick={() => onExploreMarket(selectedSlot)}
                    className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    Ver Alternativas no Mercado
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* SE O ESPAÇO ESTÁ VAGO -> ESTIMATIVAS DE MERCADO E CTA PARA EXPLORAR MERCADO */
              <div className="mt-4 space-y-5">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                    <Search className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">
                      Espaço Comercial Disponível para Captação
                    </h4>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Este espaço não possui contrato ativo. A equipe está perdendo receita anual
                      estimada de até <strong>US$ {currentSlotMeta.defaultMarketValueMax} M</strong>{' '}
                      por temporada.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="text-[10px] text-neutral-500 font-mono block">
                      Valor de Mercado Mínimo
                    </span>
                    <span className="text-sm font-black font-mono text-neutral-900">
                      US$ {currentSlotMeta.defaultMarketValueMin},00 M
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="text-[10px] text-neutral-500 font-mono block">
                      Valor de Mercado Máximo
                    </span>
                    <span className="text-sm font-black font-mono text-emerald-600">
                      US$ {currentSlotMeta.defaultMarketValueMax},00 M
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="text-[10px] text-neutral-500 font-mono block">
                      Visibilidade na TV
                    </span>
                    <span className="text-sm font-bold text-neutral-900">
                      {currentSlotMeta.visibility}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <p className="text-xs text-neutral-500">
                    Abra o mercado filtrado para este espaço para negociar com marcas interessadas.
                  </p>
                  <button
                    onClick={() => onExploreMarket(selectedSlot)}
                    className="px-5 py-2.5 rounded-xl bg-[#E10600] hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                  >
                    Explorar Mercado ({currentSlotMeta.labelEn})
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Valor de Mercado dos 5 Espaços (Referência Visual 1) */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-neutral-900">
                Valor de Mercado Estimado dos Espaços
              </h4>
              <span className="text-[11px] font-mono text-neutral-500">Base Temporada 2026</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {OFFICIAL_SPONSOR_SLOTS.map((slot) => {
                const isSelected = selectedSlot === slot.key
                return (
                  <div
                    key={slot.key}
                    onClick={() => onSelectSlot(slot.key)}
                    className={`cursor-pointer p-2.5 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'border-[#E10600] bg-red-50/40 ring-1 ring-[#E10600]/30'
                        : 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100'
                    }`}
                  >
                    <div className="h-10 w-full mb-1 flex items-center justify-center">
                      <img
                        src={getSponsorSlotPhoto(slot.key)}
                        alt={slot.label}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-neutral-800 block truncate">
                      {slot.labelEn}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-600 block mt-0.5">
                      US$ {slot.defaultMarketValueMin}M - {slot.defaultMarketValueMax}M
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onExploreMarket(slot.key)
                      }}
                      className="mt-1.5 w-full py-1 text-[9px] font-bold font-mono text-[#E10600] bg-white border border-red-200 rounded hover:bg-red-50"
                    >
                      Explorar
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
