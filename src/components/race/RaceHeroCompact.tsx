import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  MapPin,
  Flag,
  CloudSun,
  ShieldCheck,
  Compass,
  Repeat,
  Sparkles,
  Info,
} from 'lucide-react'
import { CountryFlag } from '@/components/CountryFlag'
import type { CircuitPerformanceProfile } from '@/data/circuit-performance-profiles'

export interface RaceHeroCompactProps {
  round: number
  totalRounds?: number
  gpName: string
  circuitName: string
  country: string
  circuitProfile?: CircuitPerformanceProfile | null
  isSprint?: boolean
  dateRange?: string
  currentCondition?: string
  weatherForecast?: string
  laps?: number
  circuitLengthKm?: number
}

export const RaceHeroCompact: React.FC<RaceHeroCompactProps> = ({
  round,
  totalRounds = 24,
  gpName,
  circuitName,
  country,
  circuitProfile,
  isSprint = false,
  dateRange,
  currentCondition = 'Pista Seca / 28°C',
  weatherForecast = 'Estável (Risco de chuva < 15%)',
  laps = 53,
  circuitLengthKm = 5.8,
}) => {
  const formatLabel = isSprint ? 'Formato Sprint (FIA)' : 'Formato Padrão (FIA)'

  return (
    <Card className="p-5 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Identificação do GP */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-[#E10600] text-white hover:bg-[#C00400] text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
              RODADA {round} DE {totalRounds}
            </Badge>
            <Badge
              variant="outline"
              className="border-[#CBD5E1] text-[#475569] bg-[#F8FAFC] text-[10px] font-bold"
            >
              {formatLabel}
            </Badge>
            {dateRange && (
              <span className="text-[11px] text-[#64748B] flex items-center gap-1 font-medium">
                <Calendar className="w-3 h-3 text-[#94A3B8]" />
                {dateRange}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <CountryFlag
              code={country}
              className="text-2xl leading-none select-none"
              title={country}
            />
            <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight uppercase">
              {gpName}
            </h2>
          </div>

          <p className="text-xs text-[#64748B] flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 font-semibold text-[#334155]">
              <MapPin className="w-3.5 h-3.5 text-[#E10600]" />
              {circuitName}
            </span>
            <span>•</span>
            <span>{country}</span>
            {circuitProfile?.clusterLabel && (
              <>
                <span>•</span>
                <span className="text-[#0284C7] font-medium">{circuitProfile.clusterLabel}</span>
              </>
            )}
          </p>
        </div>

        {/* Telemetria Compacta do Evento */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="text-[10px] font-bold text-[#64748B] block uppercase tracking-wider">
              Condição Pista
            </span>
            <div className="flex items-center gap-1.5 font-bold text-[#059669] mt-0.5">
              <CloudSun className="w-3.5 h-3.5 text-[#059669]" />
              <span className="truncate">{currentCondition}</span>
            </div>
            <span className="text-[10px] text-[#94A3B8] block truncate mt-0.5">
              {weatherForecast}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="text-[10px] font-bold text-[#64748B] block uppercase tracking-wider">
              Comprimento
            </span>
            <span className="font-extrabold text-[#0F172A] mt-0.5 block text-sm">
              {circuitLengthKm.toFixed(3)} km
            </span>
            <span className="text-[10px] text-[#64748B] block mt-0.5">Traçado Oficial 2026</span>
          </div>

          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="text-[10px] font-bold text-[#64748B] block uppercase tracking-wider">
              Distância GP
            </span>
            <span className="font-extrabold text-[#0F172A] mt-0.5 block text-sm">
              {laps} voltas
            </span>
            <span className="text-[10px] text-[#64748B] block mt-0.5">
              ~{(laps * circuitLengthKm).toFixed(0)} km totais
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="text-[10px] font-bold text-[#64748B] block uppercase tracking-wider">
              Grid Homologado
            </span>
            <div className="flex items-center gap-1 font-bold text-[#0284C7] mt-0.5 text-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>24 Pilotos</span>
            </div>
            <span className="text-[10px] text-[#64748B] block mt-0.5">12 Equipes Construtoras</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
