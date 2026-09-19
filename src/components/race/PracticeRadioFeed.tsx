import React, { useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Radio } from 'lucide-react'
import type { PracticeRadioFeedEvent } from '@/types/practice-session'

interface PracticeRadioFeedProps {
  events: PracticeRadioFeedEvent[]
}

export const PracticeRadioFeed: React.FC<PracticeRadioFeedProps> = ({ events }) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <Card className="p-4 bg-[#090D15]/90 border border-[#1F2733] rounded-2xl shadow-xl space-y-3 font-mono">
      <div className="flex items-center justify-between border-b border-[#1A2333] pb-2.5">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
            Rádio & Feed de Eventos do Treino
          </h3>
        </div>
        <span className="text-[10px] text-[#8B95A7]">Atualizações operacionais em tempo real</span>
      </div>

      <div
        ref={scrollRef}
        className="space-y-2 max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#1F2733] pr-1"
      >
        {events.length === 0 ? (
          <div className="text-xs text-[#525E75] italic py-4 text-center">
            Nenhum evento registrado ainda. Acompanhe as comunicações da sessão.
          </div>
        ) : (
          events.map((ev) => {
            const isAlert = ev.type === 'tyre_alert'
            const isFinish = ev.type === 'finish'
            const isBox = ev.type === 'box'
            const isOut = ev.type === 'out'

            return (
              <div
                key={ev.id}
                className={`p-2 rounded-xl text-xs flex items-start gap-2 border ${
                  isAlert
                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                    : isFinish
                      ? 'bg-purple-500/15 border-purple-500/30 text-purple-300 font-bold'
                      : isBox
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : isOut
                          ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                          : 'bg-[#0E1521]/60 border-[#1A2436] text-[#BAC4D6]'
                }`}
              >
                <span className="text-[10px] text-[#525E75] font-mono shrink-0 mt-0.5">
                  [{ev.timestamp}]
                </span>
                <span className="leading-snug">{ev.message}</span>
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}
