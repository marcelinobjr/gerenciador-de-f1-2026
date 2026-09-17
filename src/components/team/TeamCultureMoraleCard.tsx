import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HeartPulse, ChevronRight, Smile, ShieldCheck, Target } from 'lucide-react'

export interface TeamCultureMoraleBreakdown {
  workEnvironment?: number // Ambiente de Trabalho
  leadershipTrust?: number // Confiança na Liderança
  clarityOfObjectives?: number // Clareza de Objetivos
}

interface TeamCultureMoraleCardProps {
  overallMorale: number // 0 a 100
  breakdown?: TeamCultureMoraleBreakdown
  onOpenDetails?: () => void
}

export const TeamCultureMoraleCard: React.FC<TeamCultureMoraleCardProps> = ({
  overallMorale,
  breakdown,
  onOpenDetails,
}) => {
  // Configurações do medidor circular principal (svg)
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const clampedMorale = Math.min(100, Math.max(0, overallMorale))
  const strokeDashoffset = circumference - (clampedMorale / 100) * circumference

  // Classificação da moral geral
  const getMoraleStatus = (score: number) => {
    if (score >= 80) return { label: 'Excelente', color: 'text-emerald-600', ring: '#10B981' }
    if (score >= 65)
      return { label: 'Estável e Positiva', color: 'text-emerald-600', ring: '#10B981' }
    if (score >= 50) return { label: 'Sob Atenção', color: 'text-amber-600', ring: '#F59E0B' }
    return { label: 'Pressão Elevada', color: 'text-red-600', ring: '#EF4444' }
  }

  const moraleStatus = getMoraleStatus(clampedMorale)

  // Indicadores secundários reais/preparados para expansão
  const secondaryIndicators = [
    {
      id: 'work-env',
      label: 'Ambiente de Trabalho',
      icon: Smile,
      value: breakdown?.workEnvironment ?? null,
    },
    {
      id: 'lead-trust',
      label: 'Confiança na Liderança',
      icon: ShieldCheck,
      value: breakdown?.leadershipTrust ?? null,
    },
    {
      id: 'obj-clarity',
      label: 'Clareza de Objetivos',
      icon: Target,
      value: breakdown?.clarityOfObjectives ?? null,
    },
  ]

  return (
    <Card className="bg-white border-neutral-200/90 shadow-sm rounded-2xl p-5 flex flex-col justify-between h-full">
      <div>
        {/* Cabeçalho */}
        <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <HeartPulse className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-neutral-900 font-sans block">
                Saúde da Organização
              </span>
              <span className="text-[11px] text-neutral-400 font-medium block">
                Cultura interna, engajamento e clima de trabalho.
              </span>
            </div>
          </div>
          {onOpenDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenDetails}
              className="text-[11px] text-[#E10600] hover:text-[#B00500] hover:bg-red-50/50 font-bold p-0 h-auto flex items-center gap-0.5 shrink-0"
            >
              Detalhes
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Indicador Circular Principal "MORAL GERAL" */}
        <div className="flex items-center gap-5 py-4 border-b border-neutral-100">
          <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r={radius} stroke="#F1F3F5" strokeWidth="5" fill="none" />
              <circle
                cx="36"
                cy="36"
                r={radius}
                stroke={moraleStatus.ring}
                strokeWidth="5"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="font-mono font-black text-lg text-neutral-900 leading-none">
                {clampedMorale}%
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block font-mono">
              Indicador Principal
            </span>
            <div className="font-bold text-sm text-neutral-900 leading-tight mt-0.5">
              Moral Geral da Equipe
            </div>
            <div
              className={`text-xs font-semibold ${moraleStatus.color} mt-1 flex items-center gap-1.5`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              {moraleStatus.label}
            </div>
          </div>
        </div>

        {/* Indicadores Secundários (Ambiente de Trabalho, Confiança na Liderança, Clareza de Objetivos) */}
        <div className="pt-3 space-y-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block font-mono">
            Indicadores Secundários
          </span>

          <div className="space-y-2">
            {secondaryIndicators.map((ind) => {
              const Icon = ind.icon
              const hasVal = ind.value != null && !isNaN(ind.value)
              const displayVal = hasVal ? ind.value : '—'

              return (
                <div
                  key={ind.id}
                  className="flex items-center justify-between gap-3 text-xs p-2 rounded-xl bg-neutral-50/80 border border-neutral-100"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-md bg-white border border-neutral-200 flex items-center justify-center text-neutral-500 shrink-0">
                      <Icon className="w-3 h-3" />
                    </div>
                    <span className="font-medium text-neutral-700 truncate text-[11px]">
                      {ind.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {hasVal ? (
                      <>
                        <div className="w-16 h-1.5 bg-neutral-200 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(10, ind.value!))}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-neutral-900 text-[11px] min-w-[28px] text-right">
                          {displayVal}%
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-mono text-neutral-400 bg-neutral-200/50 px-1.5 py-0.5 rounded">
                        Em calibração
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}
