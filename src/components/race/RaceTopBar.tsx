import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Sun, CloudRain, Droplets, ShieldAlert } from 'lucide-react'
import { CountryFlag } from '@/components/CountryFlag'
import type { RaceControlStatus } from '@/types/canonical-race-v2'
import type { TrackWeatherState } from '@/lib/f1-tire-system'
import type { WeatherTransition } from '@/types/climate'

export interface RaceTopBarProps {
  circuitName: string
  circuitCountry: string
  round?: number
  currentLap: number
  totalLaps: number
  currentFlag: RaceControlStatus
  weather?: TrackWeatherState | any
  weatherTransitions?: WeatherTransition[]
  activeSector?: 1 | 2 | 3
  isSuspended?: boolean
  isRestartPending?: boolean
}

export const RaceTopBar: React.FC<RaceTopBarProps> = ({
  circuitName,
  circuitCountry,
  currentLap,
  totalLaps,
  currentFlag,
  weather,
  weatherTransitions,
  activeSector,
  isSuspended,
  isRestartPending,
}) => {
  // Procura próxima transição futura para previsão
  const nextRainTransition = weatherTransitions?.find(
    (t) => t.lap > currentLap && t.condition !== 'seco',
  )

  // Tratamento robusto para weather como string ('seco', 'chuva_fraca', 'chuva_forte') ou objeto
  const weatherStr = typeof weather === 'string' ? weather : weather?.condition || 'seco'
  const isWet = weatherStr === 'chuva_fraca' || weatherStr === 'chuva_forte'
  const airTemp =
    typeof weather === 'object' && weather?.airTemperature ? weather.airTemperature : 26
  const trackTemp =
    typeof weather === 'object' && weather?.trackTemperature ? weather.trackTemperature : 38
  const wetnessPct =
    typeof weather === 'object' && typeof weather?.trackWetness === 'number'
      ? weather.trackWetness
      : weatherStr === 'chuva_forte'
        ? 90
        : weatherStr === 'chuva_fraca'
          ? 55
          : 0

  // Configuração visual do chip de bandeira
  const getFlagVisual = () => {
    switch (currentFlag) {
      case 'GREEN':
        return {
          label: 'BANDEIRA VERDE',
          dot: 'bg-emerald-400',
          className:
            'bg-emerald-950/80 text-emerald-400 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]',
        }
      case 'YELLOW_LOCAL':
        return {
          label: `AMARELA LOCAL (S${activeSector || 2})`,
          dot: 'bg-yellow-400 animate-pulse',
          className:
            'bg-yellow-950/80 text-yellow-300 border-yellow-500/50 shadow-[0_0_12px_rgba(234,179,8,0.25)]',
        }
      case 'YELLOW':
        return {
          label: 'BANDEIRA AMARELA',
          dot: 'bg-amber-400 animate-pulse',
          className:
            'bg-amber-950/80 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
        }
      case 'VSC':
        return {
          label: 'VIRTUAL SAFETY CAR',
          dot: 'bg-amber-400 animate-ping',
          className:
            'bg-amber-950/90 text-amber-300 border-amber-400/80 shadow-[0_0_16px_rgba(245,158,11,0.4)]',
        }
      case 'SAFETY_CAR':
        return {
          label: 'SAFETY CAR ATIVO',
          dot: 'bg-orange-400 animate-ping',
          className:
            'bg-orange-950/90 text-orange-300 border-orange-500/80 shadow-[0_0_16px_rgba(249,115,22,0.4)]',
        }
      case 'RESTART':
        return {
          label: isRestartPending ? 'RESTART PENDENTE' : 'RELARGADA',
          dot: 'bg-emerald-400 animate-pulse',
          className:
            'bg-emerald-950/90 text-emerald-300 border-emerald-400/80 shadow-[0_0_16px_rgba(16,185,129,0.3)]',
        }
      case 'RED_FLAG':
        return {
          label: isSuspended ? 'CORRIDA SUSPENSA (BOXES)' : 'BANDEIRA VERMELHA',
          dot: 'bg-red-500 animate-ping',
          className:
            'bg-red-950/90 text-red-200 border-red-500/80 shadow-[0_0_18px_rgba(239,68,68,0.5)] font-black',
        }
      case 'FINISHED':
        return {
          label: 'BANDEIRA QUADRICULADA',
          dot: 'bg-white',
          className: 'bg-slate-900 text-white border-slate-600',
        }
      default:
        return {
          label: 'BANDEIRA VERDE',
          dot: 'bg-emerald-400',
          className: 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50',
        }
    }
  }

  const flagVisual = getFlagVisual()

  return (
    <header className="bg-[#080d1a] border-b border-slate-800/80 px-4 py-3 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 text-white">
      {/* 1. Logo / GP / Circuito + Bandeira do país */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-7 rounded-sm bg-[#e10600] text-white flex items-center justify-center font-black italic tracking-tighter text-xs shadow-md select-none">
          F1
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-wider uppercase text-white">
              GP DO {circuitCountry ? circuitCountry.toUpperCase() : 'CAMPEONATO'}
            </span>
            <CountryFlag code={circuitCountry} className="text-sm" />
          </div>
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-widest">
            {circuitName || 'Circuito Internacional'}
          </span>
        </div>
      </div>

      {/* 2. Centro: Contagem de Voltas e Chip de Bandeira */}
      <div className="flex items-center gap-4">
        {/* VOLTA X / Y */}
        <div className="flex items-baseline gap-1.5 px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            VOLTA
          </span>
          <span className="text-xl font-black text-white font-mono leading-none">{currentLap}</span>
          <span className="text-xs font-mono text-slate-500">/{totalLaps}</span>
        </div>

        {/* Chip da Bandeira */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black tracking-wide uppercase transition-all ${flagVisual.className}`}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${flagVisual.dot}`} />
          <span>{flagVisual.label}</span>
        </div>
      </div>

      {/* 3. Direita: Meteorologia (Ar, Pista, % Chuva, Previsão) */}
      <div className="flex items-center gap-4 text-xs font-mono">
        {/* Temperatura do Ar */}
        <div className="flex items-center gap-1.5" title="Temperatura do Ar">
          <Sun className="w-4 h-4 text-amber-400" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-200">{airTemp}°C</span>
            <span className="text-[9px] uppercase font-sans text-slate-400 leading-none">AR</span>
          </div>
        </div>

        {/* Temperatura da Pista */}
        <div className="flex items-center gap-1.5" title="Temperatura da Pista">
          <div className="w-4 h-4 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-amber-300">
            ♨
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-200">{trackTemp}°C</span>
            <span className="text-[9px] uppercase font-sans text-slate-400 leading-none">
              PISTA
            </span>
          </div>
        </div>

        {/* Umidade / % Chuva */}
        <div className="flex items-center gap-1.5" title="Condição de Chuva na Pista">
          <Droplets
            className={`w-4 h-4 ${wetnessPct > 0 ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`}
          />
          <div className="flex flex-col">
            <span
              className={`text-xs font-bold ${wetnessPct > 0 ? 'text-cyan-400' : 'text-slate-200'}`}
            >
              {wetnessPct}%
            </span>
            <span className="text-[9px] uppercase font-sans text-slate-400 leading-none">
              CHUVA
            </span>
          </div>
        </div>

        {/* Previsão / Transição Climática */}
        {nextRainTransition ? (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 animate-pulse"
            title={`Chuva prevista para a volta ${nextRainTransition.lap}`}
          >
            <CloudRain className="w-3.5 h-3.5 text-cyan-300" />
            <span className="text-[11px] font-bold">Chuva prevista V{nextRainTransition.lap}</span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400">
            <span>Tempo Estável</span>
          </div>
        )}
      </div>
    </header>
  )
}
