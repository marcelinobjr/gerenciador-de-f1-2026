import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Lock, CheckCircle2, Play, Pause, ChevronRight } from 'lucide-react'
import type {
  WeekendSessionDefinition,
  SessionVisualState,
  RaceWeekendSessionId,
} from '@/services/weekendScheduleConfig'

export interface RaceWeekendPipelineBarProps {
  sessions: WeekendSessionDefinition[]
  selectedSessionId: RaceWeekendSessionId
  completedSessions: string[]
  isSessionRunning?: boolean
  isSessionPaused?: boolean
  onSelectSession: (session: WeekendSessionDefinition) => void
}

export const RaceWeekendPipelineBar: React.FC<RaceWeekendPipelineBarProps> = ({
  sessions,
  selectedSessionId,
  completedSessions,
  isSessionRunning = false,
  isSessionPaused = false,
  onSelectSession,
}) => {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#E10600]">
            ESTEIRA DO FIM DE SEMANA
          </span>
          <h3 className="text-sm font-bold text-[#0F172A]">Etapas Oficiais do Grande Prêmio</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#64748B]">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#E10600]" />
            Ativa
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#059669]" />
            Concluída
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#0284C7]" />
            Disponível
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#94A3B8]" />
            Bloqueada
          </span>
        </div>
      </div>

      {/* Esteira Horizontal com scroll suave no mobile/tablet */}
      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex items-center gap-2 min-w-max md:min-w-0 md:grid md:grid-cols-6">
          {sessions.map((sess, idx) => {
            const isSelected = sess.id === selectedSessionId
            const isCompleted = completedSessions.includes(sess.id)

            // Determinar estado de desbloqueio canônico
            let isLocked = false
            if (sess.id === 'tp2') {
              isLocked = !completedSessions.includes('tp1')
            } else if (sess.id === 'tp3') {
              isLocked = !completedSessions.includes('tp2')
            } else if (sess.id === 'q1') {
              isLocked = !completedSessions.includes('tp2')
            } else if (sess.id === 'q2') {
              isLocked = !completedSessions.includes('q1')
            } else if (sess.id === 'q3') {
              isLocked = !completedSessions.includes('q2')
            } else if (sess.id === 'race') {
              isLocked =
                !completedSessions.includes('q3') && !completedSessions.includes('qualifying')
            }

            const isAvailable = !isLocked && !isCompleted

            // Classes visuais segundo a identidade APEX
            // BLOQUEADO (cinza)
            // DISPONÍVEL (azul/ciano)
            // ATIVA (vermelho APEX)
            // PAUSADA (amarelo)
            // CONCLUÍDA (verde)
            let containerClasses =
              'bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8] opacity-70 cursor-not-allowed'
            let statusBadge = (
              <span className="text-[10px] font-bold text-[#94A3B8] flex items-center gap-1 justify-center">
                <Lock className="w-3 h-3" /> Bloqueado
              </span>
            )

            if (isSelected) {
              if (isSessionRunning) {
                containerClasses =
                  'bg-white border-[#E10600] ring-2 ring-[#E10600]/30 text-[#0F172A] shadow-sm cursor-pointer'
                statusBadge = (
                  <span className="text-[10px] font-extrabold text-[#E10600] flex items-center gap-1 justify-center">
                    <span className="w-2 h-2 rounded-full bg-[#E10600] animate-pulse" />
                    EM PISTA
                  </span>
                )
              } else if (isSessionPaused) {
                containerClasses =
                  'bg-white border-amber-400 ring-2 ring-amber-400/30 text-[#0F172A] shadow-sm cursor-pointer'
                statusBadge = (
                  <span className="text-[10px] font-extrabold text-amber-600 flex items-center gap-1 justify-center">
                    <Pause className="w-3 h-3 fill-current" />
                    PAUSADA
                  </span>
                )
              } else if (isCompleted) {
                containerClasses =
                  'bg-white border-[#059669] ring-2 ring-[#059669]/30 text-[#0F172A] shadow-sm cursor-pointer'
                statusBadge = (
                  <span className="text-[10px] font-extrabold text-[#059669] flex items-center gap-1 justify-center">
                    <CheckCircle2 className="w-3 h-3" />
                    CONCLUÍDA
                  </span>
                )
              } else {
                containerClasses =
                  'bg-white border-[#E10600] ring-2 ring-[#E10600]/30 text-[#0F172A] shadow-sm cursor-pointer'
                statusBadge = (
                  <span className="text-[10px] font-extrabold text-[#E10600] flex items-center gap-1 justify-center">
                    SELECIONADA
                  </span>
                )
              }
            } else if (isCompleted) {
              containerClasses =
                'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534] hover:bg-[#DCFCE7] hover:border-[#86EFAC] cursor-pointer'
              statusBadge = (
                <span className="text-[10px] font-bold text-[#166534] flex items-center gap-1 justify-center">
                  <CheckCircle2 className="w-3 h-3 text-[#16a34a]" />
                  Concluída
                </span>
              )
            } else if (isAvailable) {
              containerClasses =
                'bg-[#F0F9FF] border-[#BAE6FD] text-[#0369A1] hover:bg-[#E0F2FE] hover:border-[#7DD3FC] cursor-pointer'
              statusBadge = (
                <span className="text-[10px] font-bold text-[#0284C7] flex items-center gap-1 justify-center">
                  Disponível
                </span>
              )
            }

            return (
              <button
                key={sess.id}
                type="button"
                disabled={isLocked}
                onClick={() => onSelectSession(sess)}
                className={`p-3 rounded-xl border text-center transition-all duration-150 flex flex-col justify-between min-w-[120px] md:min-w-0 ${containerClasses}`}
              >
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    Etapa {idx + 1}
                  </div>
                  <div className="text-sm font-black mt-0.5 tracking-tight">{sess.shortLabel}</div>
                </div>
                <div className="mt-2 pt-1.5 border-t border-black/5">{statusBadge}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
