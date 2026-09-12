import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Disc } from 'lucide-react'
import type { TireAllotment, TireCompound } from '@/types/f1'

export interface TireStockCardProps {
  tireStock: TireAllotment
  calculateCompoundLaps: (compound: TireCompound) => number
}

export function TireStockCard({ tireStock, calculateCompoundLaps }: TireStockCardProps) {
  return (
    <Card className="relative z-10 bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] p-4 shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
            GERENCIAMENTO DE COMPOSTOS PIRELLI
          </span>
          <h3 className="text-base font-black text-white flex items-center gap-2 mt-0.5">
            <Disc className="w-4 h-4 text-[#E10600]" />
            Estoque Oficial de Pneus do Piloto (Regulamento FIA 2026)
          </h3>
          <p className="text-xs text-[#8B95A7] font-mono mt-0.5">
            Alocação oficial: 2 Duros, 3 Médios, 3 Macios, 4 Intermediários, 3 Chuva Extrema.
            Paradas nos boxes reutilizam jogos usados com desgaste proporcional!
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
          {/* Hard */}
          <div className="p-2 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white ring-1 ring-slate-400" />
              <span className="text-[#8B95A7] text-[10px]">DURO (+0.60s)</span>
            </div>
            <strong
              className={`text-sm block mt-0.5 ${tireStock.duro === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
            >
              {tireStock.duro} jogos
            </strong>
            <span className="text-[10px] text-emerald-400 font-mono block mt-0.5">
              ~{calculateCompoundLaps('duro')} voltas
            </span>
          </div>

          {/* Medium */}
          <div className="p-2 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 ring-1 ring-yellow-500" />
              <span className="text-[#8B95A7] text-[10px]">MÉDIO (Ref 0.0s)</span>
            </div>
            <strong
              className={`text-sm block mt-0.5 ${tireStock.medio === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
            >
              {tireStock.medio} jogos
            </strong>
            <span className="text-[10px] text-amber-400 font-mono block mt-0.5">
              ~{calculateCompoundLaps('medio')} voltas
            </span>
          </div>

          {/* Soft */}
          <div className="p-2 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 ring-1 ring-red-600" />
              <span className="text-[#8B95A7] text-[10px]">MACIO (-0.75s)</span>
            </div>
            <strong
              className={`text-sm block mt-0.5 ${tireStock.macio === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
            >
              {tireStock.macio} jogos
            </strong>
            <span className="text-[10px] text-rose-400 font-mono block mt-0.5">
              ~{calculateCompoundLaps('macio')} voltas
            </span>
          </div>

          {/* Intermediate */}
          <div className="p-2 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1 ring-emerald-600" />
              <span className="text-[#8B95A7] text-[10px]">INTERMEDIÁRIO</span>
            </div>
            <strong
              className={`text-sm block mt-0.5 ${tireStock.intermediario === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
            >
              {tireStock.intermediario} jogos
            </strong>
            <span className="text-[10px] text-sky-400 font-mono block mt-0.5">Chuva Fraca</span>
          </div>

          {/* Wet */}
          <div className="p-2 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-center col-span-2 sm:col-span-1">
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-1 ring-blue-600" />
              <span className="text-[#8B95A7] text-[10px]">CHUVA EXT.</span>
            </div>
            <strong
              className={`text-sm block mt-0.5 ${tireStock.chuva_extrema === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
            >
              {tireStock.chuva_extrema} jogos
            </strong>
            <span className="text-[10px] text-blue-400 font-mono block mt-0.5">Chuva Forte</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
