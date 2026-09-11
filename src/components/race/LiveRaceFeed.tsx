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
    <Card className="bg-[#11161F] border border-[#1F2733] shadow-xl overflow-hidden rounded-xl flex flex-col h-full">
      <CardHeader className="py-2.5 px-3.5 bg-[#0B0E14] border-b border-[#1F2733] flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <CardTitle className="text-xs font-bold text-[#F5F7FA] tracking-wide flex items-center gap-1.5 uppercase">
            <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            Feed de Rádio & Incidentes
          </CardTitle>
          {currentLap !== undefined && totalLaps !== undefined && (
            <span className="font-num text-[11px] font-bold text-[#00A6FB] px-1.5 py-0.5 rounded bg-[#00A6FB]/10 border border-[#00A6FB]/30">
              V{currentLap}/{totalLaps}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isRaceSession && canForcePit && onOpenForcePit && (
            <Button
              size="sm"
              onClick={onOpenForcePit}
              className="h-6 text-[10px] font-bold uppercase bg-amber-500 hover:bg-amber-400 text-black flex items-center gap-1 px-2.5 shadow cursor-pointer"
            >
              <Wrench className="w-3 h-3" />
              Box
            </Button>
          )}
          <span className="font-num text-[10px] text-[#8B95A7] px-1.5 py-0.5 rounded bg-[#161D29] border border-[#1F2733]">
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
          <div className="max-h-[520px] overflow-y-auto divide-y divide-[#1F2733]/60 scrollbar-thin">
            {actualEvents.map((ev) => {
              let badgeBg = 'bg-[#161D29] text-[#8B95A7] border-[#1F2733]'
              let icon = <Flag className="w-3 h-3" />

              if (ev.type === 'overtake') {
                badgeBg = 'bg-[#00A6FB]/15 text-[#00A6FB] border-[#00A6FB]/40'
                icon = <Zap className="w-3 h-3 text-[#00A6FB]" />
              } else if (ev.type === 'fastest_lap') {
                badgeBg = 'bg-purple-500/15 text-purple-300 border-purple-500/40'
                icon = <Flame className="w-3 h-3 text-purple-400" />
              } else if (ev.type === 'tire_warning') {
                badgeBg = 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                icon = <AlertTriangle className="w-3 h-3 text-amber-400" />
              } else if (ev.type === 'incident') {
                badgeBg = 'bg-red-500/15 text-red-300 border-red-500/40'
                icon = <AlertCircle className="w-3 h-3 text-red-400" />
              } else if (ev.type === 'safety_car') {
                badgeBg = 'bg-amber-400 text-black border-amber-500'
                icon = <ShieldAlert className="w-3 h-3" />
              } else if (ev.type === 'weather') {
                badgeBg = 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                icon = <CloudRain className="w-3 h-3 text-sky-400" />
              } else if (ev.type === 'pit_stop') {
                badgeBg = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                icon = <Wrench className="w-3 h-3 text-emerald-400" />
              } else if (ev.type === 'team_radio') {
                badgeBg = 'bg-[#00A6FB]/15 text-[#00A6FB] border-[#00A6FB]/40'
                icon = <Radio className="w-3 h-3 text-[#00A6FB]" />
              }

              // Cor da borda esquerda baseada no emissor ou na cor da equipe
              const borderLeftColor = ev.teamColor || (ev.isPlayer ? teamColor : '#1F2733')

              return (
                <div
                  key={ev.id}
                  className={`p-2.5 text-xs flex items-start gap-2.5 transition-colors border-l-[3px] ${
                    ev.isPlayer
                      ? 'bg-[#161D29]/60 hover:bg-[#161D29]'
                      : 'hover:bg-[#161D29]/40 bg-[#11161F]'
                  }`}
                  style={{ borderLeftColor }}
                >
                  {/* Timestamp e Volta em .font-num */}
                  <div className="flex flex-col items-start shrink-0 w-11 text-[10px] text-[#8B95A7]">
                    <span className="font-num font-bold text-[#F5F7FA]">V{ev.lap}</span>
                    <span className="font-num text-[9px] text-[#8B95A7] leading-tight">
                      {ev.timestamp}
                    </span>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0.5 shrink-0 flex items-center gap-1 font-mono uppercase tracking-wider ${badgeBg}`}
                  >
                    {icon}
                    <span>{ev.type.replace('_', ' ')}</span>
                  </Badge>

                  <div className="flex-1 text-[#F5F7FA] text-xs leading-relaxed break-words">
                    {ev.driverName && (
                      <span className="font-bold text-[#F5F7FA] mr-1">[{ev.driverName}]</span>
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
