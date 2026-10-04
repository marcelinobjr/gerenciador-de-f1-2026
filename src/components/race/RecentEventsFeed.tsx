import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  ChevronDown,
  ChevronUp,
  ArrowUp,
  AlertTriangle,
  Flame,
  CloudRain,
  Wrench,
  Radio,
} from 'lucide-react'

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
}

// Retorna ícone temático conforme tipo de evento
function getEventVisual(type: string, message: string) {
  const msgLower = (message || '').toLowerCase()

  if (type === 'dnf' || msgLower.includes('abandonou') || msgLower.includes('dnf')) {
    return {
      icon: <span className="w-2.5 h-2.5 rounded-xs bg-red-500 shrink-0" />,
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
      icon: <span className="w-2.5 h-2.5 rounded-xs bg-yellow-400 shrink-0" />,
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
  maxItems = 7,
}) => {
  const [collapsed, setCollapsed] = useState(false)

  // Inverte os eventos para mostrar os mais recentes no topo
  const displayedEvents = [...events].slice(-maxItems).reverse()

  return (
    <Card className="bg-[#090d18] border border-slate-800/80 rounded-2xl shadow-lg overflow-hidden text-white font-mono">
      <CardHeader
        onClick={() => setCollapsed(!collapsed)}
        className="py-2.5 px-3.5 bg-[#0e1628] border-b border-slate-800 flex flex-row items-center justify-between cursor-pointer select-none"
      >
        <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
          EVENTOS RECENTES
        </CardTitle>
        <button
          type="button"
          className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </CardHeader>

      {!collapsed && (
        <CardContent className="p-2 space-y-1 text-xs max-h-56 overflow-y-auto">
          {displayedEvents.length === 0 ? (
            <div className="py-4 text-center text-slate-500 text-[11px] font-sans">
              Nenhum evento registrado ainda.
            </div>
          ) : (
            displayedEvents.map((ev) => {
              const visual = getEventVisual(ev.type, ev.message)

              return (
                <div
                  key={ev.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60 hover:bg-slate-800/70 transition-colors"
                >
                  {/* VOLTA */}
                  <span className="text-[10px] font-black text-slate-400 w-8 shrink-0">
                    V{ev.lap}
                  </span>

                  {/* ÍCONE */}
                  <div className="flex items-center justify-center shrink-0">{visual.icon}</div>

                  {/* MENSAGEM */}
                  <span
                    className={`text-[11px] leading-tight truncate font-sans flex-1 ${visual.color}`}
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
