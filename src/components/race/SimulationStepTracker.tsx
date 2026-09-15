import React from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { WeekendSimulationStepProgress } from '@/types/canonical-season-transition'

interface SimulationStepTrackerProps {
  steps: WeekendSimulationStepProgress[]
  currentStepMessage?: string
}

export const SimulationStepTracker: React.FC<SimulationStepTrackerProps> = ({
  steps,
  currentStepMessage,
}) => {
  const completedCount = steps.filter((s) => s.status === 'completed').length
  const progressPercent = Math.round((completedCount / steps.length) * 100)

  return (
    <Card className="bg-[#090D15]/95 border border-[#00A6FB]/50 p-5 space-y-4 shadow-2xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1F2733] pb-3">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#00A6FB] block font-bold">
            RACE OPERATIONS // SIMULAÇÃO EM ANDAMENTO
          </span>
          <h4 className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
            <Loader2 className="w-4 h-4 text-[#00A6FB] animate-spin" />
            {currentStepMessage || 'Processando sessões do Grande Prêmio...'}
          </h4>
        </div>
        <span className="font-mono text-xs font-bold text-cyan-300">
          {progressPercent}% Concluído ({completedCount}/{steps.length} sessões)
        </span>
      </div>

      <Progress value={progressPercent} className="h-2 bg-[#11161F]" />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
        {steps.map((st) => {
          const isDone = st.status === 'completed'
          const isInProgress = st.status === 'in_progress'

          return (
            <div
              key={st.session}
              className={`p-2.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-2 ${
                isDone
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : isInProgress
                    ? 'bg-[#00A6FB]/15 border-[#00A6FB] text-white shadow-md shadow-[#00A6FB]/20'
                    : 'bg-[#11161F] border-[#1F2733] text-[#8B95A7]'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : isInProgress ? (
                <Loader2 className="w-4 h-4 text-[#00A6FB] shrink-0 animate-spin" />
              ) : (
                <Circle className="w-4 h-4 text-[#8B95A7] shrink-0" />
              )}
              <span className="truncate font-semibold">{st.label}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
