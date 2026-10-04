import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ChevronDown, ChevronUp, ArrowUp, CloudRain, Wrench, Radio, Flame } from 'lucide-react'

export interface RaceEventItem {
  id: string
  lap: number
  type: 'overtake' | 'incident' | 'dnf' | 'fastest_lap' | 'info' | string
  message: string
  driverId?: string
  driverName?: string
  teamColor?: string
  timestamp: string
}

export interface RecentEventsFeedProps {
  events?: RaceEventItem[]
  maxItems?: number
  compact?: boolean
}

// Retorna ícone temático conforme tipo de evento
function getEventVisual(type: string, message: string) {
  const msgLower = (message || '').toLowerCase()

  if (type === 'dnf' || msgLower.includes('abandonou') || msgLower.includes('dnf')) {
    return {
      icon: <span className="w-2 h-2 rounded-xs bg-red-500 shrink-0" />,
      color: 'text-red-300',
    }
  }
  if (type === 'overtake' || msgLower.includes('ultrapassou')) {
    return {
      icon: <ArrowUp className="w-3 h-3 text-emerald-400 shrink-0" />,
      color: 'text-slate-200',
    }
  }
  if (msgLower.includes('box') || msgLower.includes('boxes') || msgLower.includes('pit')) {
    return {
      icon: <Wrench className="w-3 h-3 text-rose-400 shrink-0" />,
      color: 'text-slate-200',
    }
  }
  if (msgLower.includes('amarela') || msgLower.includes('yellow') || type === 'incident') {
    return {
      icon: <span className="w-2 h-2 rounded-xs bg-yellow-400 shrink-0" />,
      color: 'text-yellow-200',
    }
  }
  if (msgLower.includes('chuva') || msgLower.includes('rain')) {
    return {
      icon: <CloudRain className="w-3 h-3 text-cyan-400 shrink-0" />,
      color: 'text-cyan-200',
    }
  }
  if (type === 'fastest_lap' || msgLower.includes('mais rápida')) {
    return {
      icon: <Flame className="w-3 h-3 text-purple-400 shrink-0" />,
      color: 'text-purple-200',
    }
  }

  return {
    icon: <Radio className="w-3 h-3 text-slate-400 shrink-0" />,
    color: 'text-slate-300',
  }
}

export const RecentEventsFeed: React.FC<RecentEventsFeedProps> = ({
  events = [],
  maxItems = 6,
  compact = false,
}) => {
  const [collapsed, setCollapsed] = useState(false)

  // Inverte os eventos para mostrar os mais recentes no topo
  const displayedEvents = [...events].slice(-maxItems).reverse()

  return (
    <Card className="bg-[#090d18] border border-slate-800/80 rounded-xl shadow-md overflow-hidden text-white font-mono">
      <CardHeader
        onClick={() => setCollapsed(!collapsed)}
        className={`${
          compact ? 'py-1 px-2.5' : 'py-2.5 px-3.5'
        } bg-[#0e1628] border-b border-slate-800 flex flex-row items-center justify-between cursor-pointer select-none`}
      >
        <CardTitle
          className={`${compact ? 'text-[11px]' : 'text-xs'} font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
          EVENTOS RECENTES
        </CardTitle>
        <button
          type="button"
          className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed ? (
            <ChevronDown className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
          ) : (
            <ChevronUp className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
          )}
        </button>
      </CardHeader>

      {!collapsed && (
        <CardContent
          className={`${compact ? 'p-1 space-y-0.5 max-h-24' : 'p-2 space-y-1 max-h-56'} text-xs overflow-y-auto`}
        >
          {displayedEvents.length === 0 ? (
            <div
              className={`py-1 text-center text-slate-500 ${compact ? 'text-[9px]' : 'text-[10px]'} font-sans`}
            >
              Nenhum evento registrado ainda.
            </div>
          ) : (
            displayedEvents.map((ev) => {
              const visual = getEventVisual(ev.type, ev.message)

              return (
                <div
                  key={ev.id}
                  className={`flex items-center gap-1 ${
                    compact ? 'px-1 py-0.5' : 'px-2 py-1.5'
                  } rounded bg-slate-900/60 border border-slate-800/60 hover:bg-slate-800/70 transition-colors`}
                >
                  {/* VOLTA */}
                  <span
                    className={`${compact ? 'text-[9px] w-6' : 'text-[10px] w-7'} font-black text-slate-400 shrink-0`}
                  >
                    V{ev.lap}
                  </span>

                  {/* ÍCONE */}
                  <div className="flex items-center justify-center shrink-0">{visual.icon}</div>

                  {/* MENSAGEM */}
                  <span
                    className={`${compact ? 'text-[9px]' : 'text-[10px] sm:text-[11px]'} leading-tight truncate font-sans flex-1 ${visual.color}`}
                    title={ev.message}
                  >
                    {ev.message}
                  </span>
                </div>
              )
            })
          )}
        </CardContent>
      )}
    </Card>
  )
}
