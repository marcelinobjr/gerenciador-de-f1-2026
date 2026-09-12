import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CloudRain, Sun } from 'lucide-react'
import type { WeatherForecast } from '@/types/f1'
import type { TrackWeatherState } from '@/lib/f1-tire-system'

export interface WeatherRadarCardProps {
  forecast: WeatherForecast
  weather: TrackWeatherState
}

export function WeatherRadarCard({ forecast, weather }: WeatherRadarCardProps) {
  return (
    <Card className="relative z-10 bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] p-4 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
              forecast.probability >= 50
                ? 'bg-sky-500/10 border-sky-500/40 text-sky-400'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
            }`}
          >
            {forecast.probability >= 50 ? (
              <CloudRain className="w-6 h-6 animate-pulse" />
            ) : (
              <Sun className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-400">
                RADAR METEOROLÓGICO OFICIAL
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono px-1.5 py-0 ${
                  forecast.probability >= 60
                    ? 'border-red-500/40 text-red-400 bg-red-500/10'
                    : forecast.probability >= 30
                      ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                      : 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                }`}
              >
                {forecast.probability}% Risco de Chuva
              </Badge>
            </div>
            <h3 className="text-base font-black text-white mt-0.5">
              Previsão para o GP: {forecast.expectedCondition}
            </h3>
            <p className="text-xs text-[#8B95A7] font-mono">
              {forecast.probability >= 35 && forecast.rainLapStart
                ? `Alerta de Radar: Nuvem densa se aproximando com chuva prevista por volta da volta ${forecast.rainLapStart}.`
                : 'Condições meteorológicas estáveis previstas durante o evento.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-center">
            <span className="text-[10px] text-[#8B95A7] block">Temp. Ar</span>
            <strong className="text-sm text-[#F5F7FA]">{forecast.airTemp}°C</strong>
          </div>
          <div className="p-2.5 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-center">
            <span className="text-[10px] text-[#8B95A7] block">Temp. Asfalto</span>
            <strong className="text-sm text-amber-400">{forecast.trackTemp}°C</strong>
          </div>
          <div className="p-2.5 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-center">
            <span className="text-[10px] text-[#8B95A7] block">Clima Atual</span>
            <strong
              className={`text-sm ${
                weather === 'chuva_forte'
                  ? 'text-blue-400 font-bold'
                  : weather === 'chuva_fraca'
                    ? 'text-sky-400'
                    : 'text-emerald-400'
              }`}
            >
              {weather === 'chuva_forte'
                ? '⛈️ Chuva Forte'
                : weather === 'chuva_fraca'
                  ? '🌧️ Chuva Fraca'
                  : '☀️ Seco'}
            </strong>
          </div>
        </div>
      </div>
    </Card>
  )
}
