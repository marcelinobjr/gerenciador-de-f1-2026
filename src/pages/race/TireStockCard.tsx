import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Disc, ChevronDown, ChevronUp } from 'lucide-react'
import type { TireAllotment, TireCompound, TireSetItem, DriverModel } from '@/types/f1'
import { resolvePhysicalCompoundForRole } from '@/services/canonicalTyreAllocationService'

export interface TireStockCardProps {
  tireStock: TireAllotment
  calculateCompoundLaps: (compound: TireCompound) => number
  driverTireInventories?: Record<string, TireSetItem[]>
  drivers?: DriverModel[]
  currentRound?: number
}

interface CompoundBreakdown {
  total: number
  novos: number
  usados: number
  instalados: number
  indisponiveis: number
}

function calculateBreakdown(sets: TireSetItem[], compound: TireCompound): CompoundBreakdown {
  const filtered = sets.filter((s) => s.compound === compound)
  let novos = 0
  let usados = 0
  let instalados = 0
  let indisponiveis = 0

  filtered.forEach((s) => {
    const isIndisp = s.status === 'devolvido_indisponivel' || (s.wear || 0) >= 90
    if (isIndisp) {
      indisponiveis++
    } else if (s.isFitted || s.status === 'instalado') {
      instalados++
    } else if ((s.wear || 0) > 0 || (s.lapsUsed || 0) > 0 || s.status === 'usado') {
      usados++
    } else {
      novos++
    }
  })

  return {
    total: filtered.length,
    novos,
    usados,
    instalados,
    indisponiveis,
  }
}

export function TireStockCard({
  tireStock,
  calculateCompoundLaps,
  driverTireInventories = {},
  drivers = [],
  currentRound = 1,
}: TireStockCardProps) {
  // Piloto selecionado para detalhamento ou composto aberto
  const driverIds = Object.keys(driverTireInventories)
  const [selectedDriverId, setSelectedDriverId] = useState<string>(driverIds[0] || '')
  const [expandedCompound, setExpandedCompound] = useState<TireCompound | null>(null)

  const activeDriverId = selectedDriverId || driverIds[0]
  const activeDriver = drivers.find((d) => d.id === activeDriverId)
  const activeSets = activeDriverId ? driverTireInventories[activeDriverId] || [] : []

  const macios = calculateBreakdown(activeSets, 'macio')
  const medios = calculateBreakdown(activeSets, 'medio')
  const duros = calculateBreakdown(activeSets, 'duro')
  const inters = calculateBreakdown(activeSets, 'intermediario')
  const wets = calculateBreakdown(activeSets, 'chuva_extrema')

  const compoundsList: {
    key: TireCompound
    label: string
    colorText: string
    bgDot: string
    breakdown: CompoundBreakdown
    deltaText: string
  }[] = [
    {
      key: 'macio',
      label: 'MACIOS',
      colorText: 'text-rose-400',
      bgDot: 'bg-red-500 ring-red-600',
      breakdown: macios,
      deltaText: '-0.75s',
    },
    {
      key: 'medio',
      label: 'MÉDIOS',
      colorText: 'text-amber-400',
      bgDot: 'bg-yellow-400 ring-yellow-500',
      breakdown: medios,
      deltaText: 'Ref 0.0s',
    },
    {
      key: 'duro',
      label: 'DUROS',
      colorText: 'text-slate-200',
      bgDot: 'bg-white ring-slate-400',
      breakdown: duros,
      deltaText: '+0.60s',
    },
    {
      key: 'intermediario',
      label: 'INTERMEDIÁRIOS',
      colorText: 'text-emerald-400',
      bgDot: 'bg-emerald-500 ring-emerald-600',
      breakdown: inters,
      deltaText: 'Chuva Fraca',
    },
    {
      key: 'chuva_extrema',
      label: 'CHUVA',
      colorText: 'text-blue-400',
      bgDot: 'bg-blue-500 ring-blue-600',
      breakdown: wets,
      deltaText: 'Chuva Forte',
    },
  ]

  return (
    <Card className="relative z-10 bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] p-4 shadow-xl font-mono">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1A2333] pb-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#E10600] block">
            GERENCIAMENTO DE COMPOSTOS PIRELLI (FIA ALLOCATION 2026)
          </span>
          <h3 className="text-base font-black text-white flex items-center gap-2 mt-0.5">
            <Disc className="w-4 h-4 text-[#E10600]" />
            Estoque Individual por Piloto — Alocação vs Disponibilidade Real
          </h3>
          <p className="text-xs text-[#8B95A7] mt-0.5">
            20 jogos por piloto no GP Padrão (2 Duros, 3 Médios, 8 Macios, 4 Intermediários, 3 Chuva
            Extrema). Estoque finito e persistente através de todas as sessões do fim de semana.
          </p>
        </div>

        {/* Seletor de Piloto */}
        {driverIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8B95A7]">Piloto:</span>
            <div className="flex rounded-lg bg-[#080C14] border border-[#1A2333] p-0.5">
              {driverIds.map((dId) => {
                const drv = drivers.find((d) => d.id === dId)
                const isSelected = dId === activeDriverId
                return (
                  <button
                    key={dId}
                    type="button"
                    onClick={() => {
                      setSelectedDriverId(dId)
                      setExpandedCompound(null)
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-[#E10600] text-white shadow-md'
                        : 'text-[#8B95A7] hover:text-white'
                    }`}
                  >
                    {drv?.name || dId}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Grid de Cards por Composto com discriminação completa: TOTAL / NOVO / USADO / INSTALADO / INDISPONÍVEL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-3">
        {compoundsList.map(({ key, label, colorText, bgDot, breakdown, deltaText }) => {
          const phys = resolvePhysicalCompoundForRole(key, currentRound)
          const isExpanded = expandedCompound === key

          return (
            <div
              key={key}
              className={`p-3 rounded-xl bg-[#080C14]/90 border transition-all cursor-pointer ${
                isExpanded
                  ? 'border-[#E10600] shadow-lg shadow-red-950/20'
                  : 'border-[#1A2333] hover:border-[#2A374D]'
              }`}
              onClick={() => setExpandedCompound(isExpanded ? null : key)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ring-1 ${bgDot}`} />
                  <span className="text-white font-bold text-xs">{label}</span>
                </div>
                <span className="text-[10px] text-[#8B95A7] font-semibold">{phys}</span>
              </div>

              <div className="mt-2 text-xs text-[#BAC4D6] space-y-1">
                <div className="flex items-center justify-between border-b border-[#161D29] pb-1">
                  <span className="text-[#8B95A7] text-[11px]">Total Alocado:</span>
                  <strong className="text-white text-sm">{breakdown.total}</strong>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[10px] pt-0.5">
                  <div>
                    <span className="text-emerald-400 block font-bold">
                      {breakdown.novos} novos
                    </span>
                    <span className="text-amber-400 block font-medium">
                      {breakdown.usados} usados
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-cyan-400 block font-medium">
                      {breakdown.instalados} instalado
                    </span>
                    <span className="text-rose-400 block font-medium">
                      {breakdown.indisponiveis} indisp.
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#161D29] text-[10px]">
                <span className={colorText}>{deltaText}</span>
                <span className="text-[#8B95A7] flex items-center gap-0.5 hover:text-white">
                  {isExpanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  {isExpanded ? 'ocultar' : 'ver jogos'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Detalhamento expandido dos jogos individuais do composto selecionado */}
      {expandedCompound && (
        <div className="mt-4 p-3 rounded-xl bg-[#0B0F17] border border-[#232F42] space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs text-white">
            <span className="font-bold flex items-center gap-2">
              <Disc className="w-3.5 h-3.5 text-[#E10600]" />
              Jogos Individuais: {expandedCompound.toUpperCase()} ({activeDriver?.name || 'Piloto'})
            </span>
            <span className="text-[10px] text-[#8B95A7]">Condição (%) = 100 - Desgaste</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
            {activeSets
              .filter((s) => s.compound === expandedCompound)
              .map((s, idx) => {
                const cond = s.condition ?? Math.max(0, 100 - (s.wear || 0))
                const isNew = (s.wear || 0) === 0 && (s.lapsUsed || 0) === 0
                return (
                  <div
                    key={s.id || idx}
                    className={`p-2 rounded-lg border text-xs flex flex-col justify-between gap-1 ${
                      s.isFitted
                        ? 'border-cyan-500 bg-cyan-950/30'
                        : isNew
                          ? 'border-emerald-500/40 bg-emerald-950/20'
                          : (s.wear || 0) >= 90
                            ? 'border-red-900/40 bg-red-950/20 opacity-60'
                            : 'border-[#1F2733] bg-[#0E1420]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-white text-[11px]">
                        #{idx + 1} ({s.id.split('_').slice(-2).join('_')})
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 ${
                          s.isFitted
                            ? 'border-cyan-400 text-cyan-300'
                            : isNew
                              ? 'border-emerald-400 text-emerald-300'
                              : 'border-amber-400 text-amber-300'
                        }`}
                      >
                        {s.isFitted ? 'INSTALADO' : isNew ? 'NOVO' : 'USADO'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[#8B95A7]">
                      <span>
                        Condição: <strong className="text-white">{cond}%</strong>
                      </span>
                      <span>{s.lapsUsed || 0} voltas</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </Card>
  )
}
