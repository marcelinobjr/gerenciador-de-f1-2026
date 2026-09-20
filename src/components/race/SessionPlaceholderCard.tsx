import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Lock, Construction, Trophy, ShieldAlert, Sparkles } from 'lucide-react'
import type { WeekendSessionDefinition } from '@/services/weekendScheduleConfig'

export interface SessionPlaceholderCardProps {
  session: WeekendSessionDefinition
  isLocked: boolean
  isPendingDevelopment: boolean
}

export const SessionPlaceholderCard: React.FC<SessionPlaceholderCardProps> = ({
  session,
  isLocked,
  isPendingDevelopment,
}) => {
  const isQualy = session.category === 'qualifying'
  const isRace = session.category === 'race'

  return (
    <Card className="p-8 sm:p-12 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs text-center max-w-2xl mx-auto space-y-6">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#64748B]">
        {isPendingDevelopment ? (
          <Construction className="w-8 h-8 text-[#0284C7]" />
        ) : isRace ? (
          <Trophy className="w-8 h-8 text-[#E10600]" />
        ) : (
          <Lock className="w-8 h-8 text-[#64748B]" />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Badge
            variant="outline"
            className="border-[#CBD5E1] text-[#475569] bg-[#F8FAFC] text-[11px] font-bold uppercase tracking-wider"
          >
            {isQualy ? 'Classificação Oficial' : isRace ? 'Grande Prêmio' : 'Treino Livre'}
          </Badge>

          {isPendingDevelopment ? (
            <Badge className="bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD] hover:bg-[#E0F2FE] text-[11px] font-extrabold uppercase">
              Em desenvolvimento
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-[#CBD5E1] text-[#64748B] bg-[#F1F5F9] text-[11px] font-extrabold uppercase"
            >
              Bloqueado
            </Badge>
          )}
        </div>

        <h3 className="text-xl sm:text-2xl font-black text-[#0F172A] uppercase tracking-tight">
          {session.fullName}
        </h3>

        <p className="text-sm text-[#64748B] max-w-md mx-auto">
          {isPendingDevelopment
            ? `A mecânica oficial de ${session.shortLabel} está sendo integrada ao novo módulo de Corrida. O fluxo canônico com tempos reais e eliminações será liberado na próxima etapa de entrega.`
            : session.blockedMessage}
        </p>
      </div>

      <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#64748B] space-y-1 text-left">
        <div className="flex items-center gap-1.5 font-bold text-[#334155]">
          <ShieldAlert className="w-4 h-4 text-[#0284C7]" />
          Regulamento Esportivo FIA F1 2026:
        </div>
        <p>
          O evento segue a esteira esportiva canônica: complete o Treino Livre 1 (TL1) e o Treino
          Livre 2 (TL2) para desbloquear a preparação para a classificação.
        </p>
      </div>
    </Card>
  )
}
