import React from 'react'
import { CloudRain, Sun, CloudDrizzle, Droplets } from 'lucide-react'

export interface RaceWeatherHUDProps {
  weather?: string
  rainIntensity?: number
  trackCondition?: string
}

export function RaceWeatherHUD({ weather, rainIntensity, trackCondition }: RaceWeatherHUDProps) {
  const rawWx = (weather || trackCondition || 'dry').toLowerCase()
  let label = 'SECO'
  let icon = <Sun className="w-4 h-4 text-amber-400" />
  let badgeClass = 'border-amber-500/40 text-amber-300 bg-amber-500/10'
  let intensityLabel = '0%'

  if (rawWx.includes('heavy') || rawWx === 'heavy_rain' || rawWx === 'wet') {
    label = 'CHUVA FORTE'
    icon = <CloudRain className="w-4 h-4 text-blue-400 animate-pulse" />
    badgeClass = 'border-blue-500/50 text-blue-300 bg-blue-500/20'
    intensityLabel = rainIntensity !== undefined ? `${Math.round(rainIntensity * 100)}%` : '85%'
  } else if (
    rawWx.includes('light') ||
    rawWx === 'light_rain' ||
    rawWx === 'drizzle' ||
    rawWx === 'intermediate'
  ) {
    label = 'CHUVA FRACA'
    icon = <CloudDrizzle className="w-4 h-4 text-cyan-400" />
    badgeClass = 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10'
    intensityLabel = rainIntensity !== undefined ? `${Math.round(rainIntensity * 100)}%` : '40%'
  }

  return (
    <div
      data-testid="race-weather-hud"
      className={`flex items-center gap-2 px-3 py-1 rounded-md border ${badgeClass} text-xs font-mono font-bold tracking-wider shadow-sm transition-all duration-300`}
    >
      {icon}
      <span className="font-semibold">{label}</span>
      <span className="text-[10px] opacity-80 pl-1 border-l border-current/20 flex items-center gap-0.5">
        <Droplets className="w-3 h-3 opacity-70" />
        {intensityLabel}
      </span>
      <span className="text-[10px] uppercase opacity-70">
        ({rawWx.includes('rain') || rawWx === 'wet' ? 'Pista Molhada' : 'Pista Seca'})
      </span>
    </div>
  )
}
