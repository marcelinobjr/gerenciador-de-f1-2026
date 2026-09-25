import React from 'react'
import { Check, User, Globe, Trophy, Sliders, CheckCircle2 } from 'lucide-react'
import { WizardStepId } from '@/types/career-wizard'

interface WizardStepperProps {
  currentStep: WizardStepId
  onStepClick?: (step: WizardStepId) => void
  canNavigateTo?: (step: WizardStepId) => boolean
}

interface StepItem {
  id: WizardStepId
  label: string
  subLabel: string
  icon: React.ElementType
}

const STEPS: StepItem[] = [
  { id: 'manager', label: 'Manager', subLabel: 'Perfil & Dados', icon: User },
  { id: 'universe', label: 'Universo', subLabel: '2026 / Custom', icon: Globe },
  { id: 'teams', label: 'Grid / Equipe', subLabel: 'Escolha da Escuderia', icon: Trophy },
  { id: 'settings', label: 'Configurações', subLabel: 'Dificuldade & IA', icon: Sliders },
  { id: 'review', label: 'Revisão', subLabel: 'Confirmação', icon: CheckCircle2 },
]

export function WizardStepper({ currentStep, onStepClick, canNavigateTo }: WizardStepperProps) {
  if (currentStep === 'start') {
    return null
  }

  const currentIndex = STEPS.findIndex((s) => s.id === currentStep)

  return (
    <div className="w-full bg-white/90 backdrop-blur border-b border-[#E2E8F0] px-4 py-3 shadow-xs">
      <div className="max-w-4xl mx-auto">
        <nav
          aria-label="Progresso da criação de carreira"
          className="flex items-center justify-between"
        >
          {STEPS.map((step, index) => {
            const isCompleted = currentIndex > index
            const isCurrent = currentIndex === index
            const isNavigable = canNavigateTo ? canNavigateTo(step.id) : isCompleted
            const IconComponent = step.icon

            return (
              <div
                key={step.id}
                className={
                  index < STEPS.length - 1
                    ? 'flex items-center flex-1 last:flex-initial'
                    : 'flex items-center'
                }
              >
                {/* Step button */}
                <button
                  type="button"
                  disabled={!isNavigable && !isCurrent}
                  onClick={() => {
                    if (isNavigable && onStepClick) {
                      onStepClick(step.id)
                    }
                  }}
                  className={`group flex items-center gap-2.5 transition-all outline-none ${
                    isNavigable ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
                      isCompleted
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                        : isCurrent
                          ? 'bg-[#E10600] text-white ring-4 ring-red-100 shadow-md shadow-red-200 font-black'
                          : 'bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1]'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <IconComponent className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div className="text-left hidden md:block">
                    <p
                      className={`text-xs font-bold transition-colors ${
                        isCurrent
                          ? 'text-[#0F172A]'
                          : isCompleted
                            ? 'text-[#334155]'
                            : 'text-[#64748B]'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-[10px] font-mono text-[#94A3B8]">{step.subLabel}</p>
                  </div>
                </button>

                {/* Connecting bar */}
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 mx-2 sm:mx-3 h-[2px] rounded-full transition-colors ${
                      currentIndex > index ? 'bg-emerald-500' : 'bg-[#E2E8F0]'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
