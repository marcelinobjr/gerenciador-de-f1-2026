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
} from 'lucide-react'
import { LiveRaceEvent } from '@/types/race-events'

interface LiveRaceFeedProps {
  events?: LiveRaceEvent[]
  liveEvents?: LiveRaceEvent[]
  currentLap?: number
  totalLaps?: number
  isRaceSession?: boolean
  canForcePit?: boolean
  onOpenForcePit?: () => void
}

export function LiveRaceFeed({
  events,
  liveEvents,
  currentLap,
  totalLaps,
  isRaceSession = true,
  canForcePit = false,
  onOpenForcePit,
}: LiveRaceFeedProps) {
  const actualEvents = events || liveEvents || []
  if (actualEvents.length === 0 && !currentLap) return null

  return (
    <Card className="bg-[#090D15]/85 backdrop-blur-md border border-[#1A2333] shadow-xl overflow-hidden">
      <CardHeader className="py-3 px-4 bg-[#080C14]/90 border-b border-[#1A2333] flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <CardTitle className="text-sm font-bold text-[#F5F7FA] tracking-wide font-mono flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            FEED DE TRANSMISSÃO AO VIVO // PIT WALL & RÁDIO
          </CardTitle>
          {currentLap !== undefined && totalLaps !== undefined && (
            <Badge className="bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 text-xs font-mono ml-2">
              Volta {currentLap}/{totalLaps}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isRaceSession && canForcePit && onOpenForcePit && (
            <Button
              size="sm"
              variant="destructive"
              onClick={onOpenForcePit}
              className="h-7 text-xs font-bold font-mono uppercase bg-amber-600 hover:bg-amber-500 text-black flex items-center gap-1.5 px-3 shadow"
            >
              <Wrench className="w-3.5 h-3.5" />
              PARAR NOS BOXES
            </Button>
          )}
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-slate-700 text-slate-300"
          >
            {actualEvents.length} eventos
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="max-h-[340px] overflow-y-auto divide-y divide-[#1A2333] scrollbar-thin">
          {actualEvents.map((ev) => {
            let badgeBg = 'bg-slate-800 text-slate-300 border-slate-700'
            let icon = <Flag className="w-3.5 h-3.5" />

            if (ev.type === 'overtake') {
              badgeBg = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              icon = <Zap className="w-3.5 h-3.5 text-cyan-400" />
            } else if (ev.type === 'fastest_lap') {
              badgeBg = 'bg-purple-500/20 text-purple-300 border-purple-500/40'
              icon = <Flame className="w-3.5 h-3.5 text-purple-400" />
            } else if (ev.type === 'tire_warning') {
              badgeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            } else if (ev.type === 'incident') {
              badgeBg = 'bg-red-500/20 text-red-300 border-red-500/40'
              icon = <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            } else if (ev.type === 'safety_car') {
              badgeBg = 'bg-amber-400 text-black border-amber-500'
              icon = <ShieldAlert className="w-3.5 h-3.5" />
            } else if (ev.type === 'weather') {
              badgeBg = 'bg-sky-500/20 text-sky-300 border-sky-500/40'
              icon = <CloudRain className="w-3.5 h-3.5 text-sky-400" />
            } else if (ev.type === 'pit_stop') {
              badgeBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              icon = <Wrench className="w-3.5 h-3.5 text-emerald-400" />
            } else if (ev.type === 'team_radio') {
              badgeBg = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              icon = <Radio className="w-3.5 h-3.5 text-cyan-400" />
            }

            return (
              <div
                key={ev.id}
                className={`p-3 text-xs font-mono flex items-start gap-3 transition-colors ${
                  ev.isPlayer
                    ? 'bg-[#E10600]/10 border-l-2 border-l-[#E10600]'
                    : 'hover:bg-[#161D29]/40'
                }`}
              >
                <div className="flex flex-col items-center shrink-0 w-12 text-[10px] text-[#8B95A7]">
                  <span className="font-bold text-white">V{ev.lap}</span>
                  <span>{ev.timestamp}</span>
                </div>

                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0.5 shrink-0 flex items-center gap-1 ${badgeBg}`}
                >
                  {icon}
                  <span className="capitalize">{ev.type.replace('_', ' ')}</span>
                </Badge>

                <div className="flex-1 text-[#F5F7FA] leading-relaxed">{ev.message}</div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
