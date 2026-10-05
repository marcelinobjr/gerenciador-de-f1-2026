import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Lock, Construction, Trophy, ShieldAlert, Sparkles } from 'lucide-react'
import type { WeekendSessionDefinition } from '@/services/weekendScheduleConfig'

export interface SessionPlaceholderCardProps {
  session: WeekendSessionDefinition
  isLocked: boolean
  isPendingDevelopment: boolean
  gpName?: string
  circuitName?: string
  guidanceMessage?: string
  statusVariant?: 'locked' | 'available' | 'active' | 'paused' | 'completed'
}

export const SessionPlaceholderCard: React.FC<SessionPlaceholderCardProps> = ({
  session,
  isLocked,
  isPendingDevelopment,
  gpName,
  circuitName,
  guidanceMessage,
  statusVariant,
}) => {
  const isSprint =
    session.id === 'sprint_race' ||
    session.id === 'sq1' ||
    session.id === 'sq2' ||
    session.id === 'sq3'
  const isSprintRace = session.id === 'sprint_race'
  const isQualy = session.category === 'qualifying'
  const isRace = session.category === 'race'

  // Identificação do badge da sessão:
  // Para Sprint: "SPRINT"
  // Para qualificação: "Classificação Oficial" ou "Qualificação Sprint"
  // Para corrida principal: "Grande Prêmio"
  // Para treino: "Treino Livre"
  const sessionBadgeLabel = isSprintRace
    ? 'Sprint'
    : isSprint && isQualy
      ? 'Qualificação Sprint'
      : isQualy
        ? 'Classificação Oficial'
        : isRace
          ? 'Grande Prêmio'
          : 'Treino Livre'

  // Título: se Sprint, mostrar "SPRINT" + GP/Circuito (ex: "SPRINT — GP da China")
  const sessionTitle = isSprintRace
    ? gpName
      ? `SPRINT — ${gpName}`
      : circuitName
        ? `SPRINT — ${circuitName}`
        : 'SPRINT'
    : session.fullName

  // Orientação regulamentar baseada no contexto e estado da sessão
  const regulationGuidance =
    guidanceMessage ||
    (isSprintRace
      ? isLocked
        ? 'Complete a Qualificação Sprint (SQ3) para definir o grid e desbloquear a Corrida Sprint.'
        : statusVariant === 'completed'
          ? 'Corrida Sprint concluída. O resultado oficial foi homologado e a pontuação atribuída.'
          : statusVariant === 'active' || statusVariant === 'paused'
            ? 'A Corrida Sprint está em andamento. Retome a sessão no Race Control para continuar.'
            : 'O grid da Sprint foi definido. Prossiga com a preparação de estratégia e pneus antes de iniciar.'
      : isRace
        ? isLocked
          ? 'Complete a classificação oficial (Q3) para definir o grid de largada da Corrida Principal.'
          : statusVariant === 'completed'
            ? 'Grande Prêmio concluído. O resultado oficial foi homologado.'
            : statusVariant === 'active' || statusVariant === 'paused'
              ? 'A Corrida Principal está em andamento. Retome no Race Control para continuar.'
              : 'O grid do Grande Prêmio foi definido. Prossiga com a estratégia de corrida.'
        : isSprint
          ? 'Fim de semana Sprint FIA: complete o Treino Livre 1 (TL1) para desbloquear a Qualificação Sprint (SQ1).'
          : 'O evento segue a esteira esportiva canônica: complete os treinos livres anteriores para avançar na programação oficial.')

  const effectiveStatus = statusVariant || (isLocked ? 'locked' : 'available')

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
            {sessionBadgeLabel}
          </Badge>

          {isPendingDevelopment ? (
            <Badge className="bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD] hover:bg-[#E0F2FE] text-[11px] font-extrabold uppercase">
              Em desenvolvimento
            </Badge>
          ) : effectiveStatus === 'locked' ? (
            <Badge
              variant="outline"
              className="border-[#CBD5E1] text-[#64748B] bg-[#F1F5F9] text-[11px] font-extrabold uppercase"
            >
              Bloqueado
            </Badge>
          ) : effectiveStatus === 'completed' ? (
            <Badge
              variant="outline"
              className="border-blue-300 text-blue-700 bg-blue-50 text-[11px] font-extrabold uppercase"
            >
              Concluída
            </Badge>
          ) : effectiveStatus === 'active' || effectiveStatus === 'paused' ? (
            <Badge
              variant="outline"
              className="border-amber-300 text-amber-700 bg-amber-50 text-[11px] font-extrabold uppercase flex items-center gap-1"
            >
              {effectiveStatus === 'paused' ? 'Em andamento / Retomar' : 'Em andamento'}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[11px] font-extrabold uppercase"
            >
              Pendente
            </Badge>
          )}
        </div>

        <h3 className="text-xl sm:text-2xl font-black text-[#0F172A] uppercase tracking-tight">
          {sessionTitle}
        </h3>

        <p className="text-sm text-[#64748B] max-w-md mx-auto">
          {isPendingDevelopment
            ? `A mecânica oficial de ${session.shortLabel} está sendo integrada ao novo módulo de Corrida. O fluxo canônico com tempos reais e eliminações será liberado na próxima etapa de entrega.`
            : isLocked
              ? session.blockedMessage
              : effectiveStatus === 'completed'
                ? 'Sessão concluída com resultado oficial registrado.'
                : effectiveStatus === 'active' || effectiveStatus === 'paused'
                  ? 'Sessão em andamento. Acesse o controle de corrida para prosseguir.'
                  : 'Sessão liberada para preparação e largada.'}
        </p>
      </div>

      <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#64748B] space-y-1 text-left">
        <div className="flex items-center gap-1.5 font-bold text-[#334155]">
          <ShieldAlert className="w-4 h-4 text-[#0284C7]" />
          Regulamento Esportivo FIA F1 2026:
        </div>
        <p>{regulationGuidance}</p>
      </div>
    </Card>
  )
}
