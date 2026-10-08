import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { MessageSquareText, Radio } from 'lucide-react'

export const RaceTeamMessagesFeed: React.FC = () => {
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
        <div className="p-4 rounded-lg bg-[#080E18] border border-dashed border-[#1E293B] text-center space-y-1">
          <p className="text-slate-400 font-bold text-xs">Nenhuma mensagem de rádio no momento.</p>
          <p className="text-[10px] text-slate-500">
            Comunicações de corrida, avisos de engenharia e decisões de estratégia aparecerão aqui
            após a largada.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
