import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { MessageSquareText, Radio } from 'lucide-react'

export interface RaceTeamMessagesFeedProps {
  events?: Array<{
    id: string
    lap: number
    type: string
    message: string
    driverId?: string
    driverName?: string
    teamColor?: string
    timestamp: string
  }>
}

export const RaceTeamMessagesFeed: React.FC<RaceTeamMessagesFeedProps> = ({ events }) => {
  return (
    <Card className="bg-[#0D1524] border border-[#1E293B] rounded-xl overflow-hidden shadow-lg">
      <CardHeader className="py-2.5 px-3.5 bg-[#090E1A] border-b border-[#1E293B] flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
          <MessageSquareText className="w-3.5 h-3.5 text-slate-400" />
          Mensagens da Equipe & Rádio
        </CardTitle>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
          <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
          CANAL ABERTO
        </div>
      </CardHeader>

      <CardContent className="p-4 text-xs font-mono">
        {events && events.length > 0 ? (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {[...events]
              .slice(-8)
              .reverse()
              .map((ev) => (
                <div
                  key={ev.id}
                  className="p-2 rounded bg-[#080E18] border border-[#1E293B] flex items-start gap-2"
                >
                  <span className="text-[10px] font-bold text-cyan-400 shrink-0">V{ev.lap}</span>
                  <span className="text-slate-200 text-xs flex-1">{ev.message}</span>
                  <span className="text-[9px] text-slate-500 shrink-0">{ev.timestamp}</span>
                </div>
              ))}
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-[#080E18] border border-dashed border-[#1E293B] text-center space-y-1">
            <p className="text-slate-400 font-bold text-xs">
              Nenhuma mensagem de rádio no momento.
            </p>
            <p className="text-[10px] text-slate-500">
              Comunicações de corrida, avisos de engenharia e decisões de estratégia aparecerão aqui
              após a largada.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
