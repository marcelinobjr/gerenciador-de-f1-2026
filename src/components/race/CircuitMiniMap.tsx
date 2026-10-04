import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { MapPin } from 'lucide-react'
import { resolveTrackFromCircuitName } from './tracks'

export interface CircuitMiniMapProps {
  circuitName?: string
  circuitCountry?: string
  round?: number
  compact?: boolean
}

export const CircuitMiniMap: React.FC<CircuitMiniMapProps> = ({
  circuitName,
  circuitCountry,
  compact = false,
}) => {
  const track = resolveTrackFromCircuitName(circuitName || circuitCountry)

  return (
    <Card className="bg-[#090d18] border border-slate-800/80 rounded-xl shadow-md overflow-hidden text-white font-mono">
      <CardHeader
        className={`${
          compact ? 'py-1 px-2.5' : 'py-2.5 px-3.5'
        } bg-[#0e1628] border-b border-slate-800 flex flex-row items-center justify-between select-none`}
      >
        <CardTitle
          className={`${compact ? 'text-[11px]' : 'text-xs'} font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5`}
        >
          <MapPin className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-cyan-400`} />
          CIRCUITO // {track.name}
        </CardTitle>
        <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-cyan-300 font-bold`}>
          {track.lapLengthKm} km • {track.country}
        </span>
      </CardHeader>

      <CardContent
        className={`${compact ? 'p-1.5' : 'p-3'} flex items-center justify-center bg-[#070b14]`}
      >
        <div
          className={`relative w-full ${compact ? 'max-h-[90px]' : 'max-h-[120px]'} flex items-center justify-center`}
        >
          <svg
            viewBox={track.viewBox}
            className={`w-full h-auto ${compact ? 'max-h-[85px]' : 'max-h-[110px]'} drop-shadow-[0_0_12px_rgba(0,166,251,0.25)]`}
          >
            <defs>
              <linearGradient id="circuitMiniGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00A6FB" />
                <stop offset="50%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#E10600" />
              </linearGradient>
            </defs>

            {/* Pista borda externa */}
            <path
              d={track.path}
              fill="none"
              stroke="#1E293B"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Traçado principal brilhante */}
            <path
              d={track.path}
              fill="none"
              stroke="url(#circuitMiniGrad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Ponto de largada / chegada */}
            {track.startFinish && (
              <g>
                <circle
                  cx={track.startFinish.x}
                  cy={track.startFinish.y}
                  r="5"
                  fill="#E10600"
                  className="animate-pulse"
                />
                <circle cx={track.startFinish.x} cy={track.startFinish.y} r="2" fill="#FFFFFF" />
              </g>
            )}
          </svg>
        </div>
      </CardContent>
    </Card>
  )
}
