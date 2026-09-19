import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Radio,
  Wrench,
  Flag,
  Zap,
  Flame,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  CloudRain,
  MessageSquare,
} from 'lucide-react'
import { LiveRaceEvent } from '@/types/race-events'
import { EmptyState } from '@/components/EmptyState'

interface LiveRaceFeedProps {
  events?: LiveRaceEvent[]
  liveEvents?: LiveRaceEvent[]
  currentLap?: number
  totalLaps?: number
  isRaceSession?: boolean
  canForcePit?: boolean
  onOpenForcePit?: () => void
  teamColor?: string
}

export function LiveRaceFeed({
  events,
  liveEvents,
  currentLap,
  totalLaps,
  isRaceSession = true,
  canForcePit = false,
  onOpenForcePit,
  teamColor = '#E10600',
}: LiveRaceFeedProps) {
  const actualEvents = events || liveEvents || []

  return (
    <Card className="bg-white border border-slate-200/90 shadow-xs overflow-hidden rounded-xl flex flex-col h-full">
      <CardHeader className="py-2.5 px-3.5 bg-slate-50 border-b border-slate-200 flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <CardTitle className="text-xs font-black text-slate-900 tracking-wider flex items-center gap-1.5 uppercase">
            <Radio className="w-3.5 h-3.5 text-slate-700 shrink-0" />
            Feed de Rádio & Incidentes
          </CardTitle>
          {currentLap !== undefined && totalLaps !== undefined && (
            <span className="font-mono text-[11px] font-bold text-slate-700 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
              V{currentLap}/{totalLaps}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isRaceSession && canForcePit && onOpenForcePit && (
            <Button
              size="sm"
              onClick={onOpenForcePit}
              className="h-6 text-[10px] font-bold uppercase bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1 px-2.5 shadow-xs cursor-pointer"
            >
              <Wrench className="w-3 h-3 text-amber-400" />
              Box
            </Button>
          )}
          <span className="font-mono text-[10px] font-medium text-slate-500 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
            {actualEvents.length} logs
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden">
        {actualEvents.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={MessageSquare}
              title="Aguardando largada"
              description="Os rádios de equipe, ultrapassagens e incidentes da pista serão transmitidos aqui em tempo real."
            />
          </div>
        ) : (
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
            {actualEvents.map((ev) => {
              let badgeBg = 'bg-slate-100 text-slate-700 border-slate-200'
              let icon = <Flag className="w-3 h-3 text-slate-500" />

              if (ev.type === 'overtake') {
                badgeBg = 'bg-sky-50 text-sky-800 border-sky-200'
                icon = <Zap className="w-3 h-3 text-sky-600" />
              } else if (ev.type === 'fastest_lap') {
                badgeBg = 'bg-purple-50 text-purple-800 border-purple-200'
                icon = <Flame className="w-3 h-3 text-purple-600" />
              } else if (ev.type === 'tire_warning') {
                badgeBg = 'bg-amber-50 text-amber-900 border-amber-200'
                icon = <AlertTriangle className="w-3 h-3 text-amber-600" />
              } else if (ev.type === 'incident') {
                badgeBg = 'bg-red-50 text-red-800 border-red-200'
                icon = <AlertCircle className="w-3 h-3 text-red-600" />
              } else if (ev.type === 'safety_car') {
                badgeBg = 'bg-amber-400 text-slate-950 border-amber-500 font-black'
                icon = <ShieldAlert className="w-3 h-3 text-slate-950" />
              } else if (ev.type === 'weather') {
                badgeBg = 'bg-blue-50 text-blue-800 border-blue-200'
                icon = <CloudRain className="w-3 h-3 text-blue-600" />
              } else if (ev.type === 'pit_stop') {
                badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200'
                icon = <Wrench className="w-3 h-3 text-emerald-600" />
              } else if (ev.type === 'team_radio') {
                badgeBg = 'bg-indigo-50 text-indigo-800 border-indigo-200'
                icon = <Radio className="w-3 h-3 text-indigo-600" />
              }

              // Borda esquerda baseada no emissor
              const borderLeftColor = ev.teamColor || (ev.isPlayer ? teamColor : '#E2E8F0')

              return (
                <div
                  key={ev.id}
                  className={`p-2.5 text-xs flex items-start gap-2.5 transition-colors border-l-[3px] ${
                    ev.isPlayer ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50 bg-white'
                  }`}
                  style={{ borderLeftColor }}
                >
                  {/* Timestamp e Volta */}
                  <div className="flex flex-col items-start shrink-0 w-11 text-[10px] text-slate-500 font-mono">
                    <span className="font-bold text-slate-800">V{ev.lap}</span>
                    <span className="text-[9px] text-slate-400 leading-tight">{ev.timestamp}</span>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0.5 shrink-0 flex items-center gap-1 font-mono uppercase tracking-wider ${badgeBg}`}
                  >
                    {icon}
                    <span>{ev.type.replace('_', ' ')}</span>
                  </Badge>

                  <div className="flex-1 text-slate-800 text-xs leading-relaxed break-words">
                    {ev.driverName && (
                      <span className="font-bold text-slate-950 mr-1">[{ev.driverName}]</span>
                    )}
                    <span>{ev.message}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
