import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/PageHeader'
import { ChevronRight, FastForward, Play, RotateCcw } from 'lucide-react'
import type { WeekendSession } from '@/types/race-events'

export type WeekendDisplaySession =
  | WeekendSession
  | 'treino_livre'
  | 'classificacao'
  | 'corrida'
  | 'pos_corrida'

export interface WeekendHeaderProps {
  currentRound: number
  gpInfo: {
    name: string
    circuit: string
  }
  weekendSession: WeekendDisplaySession
  isSimulating: boolean
  hasRaceFinished: boolean
  hasQualyFinished: boolean
  practiceDone: boolean
  onRunSession: () => void
  onAdvanceRound: () => void
  onQuickSimRace?: () => void
  onResetWeekend?: () => void
}

export function WeekendHeader({
  currentRound,
  gpInfo,
  weekendSession,
  isSimulating,
  hasRaceFinished,
  hasQualyFinished,
  practiceDone,
  onRunSession,
  onAdvanceRound,
  onQuickSimRace,
  onResetWeekend,
}: WeekendHeaderProps) {
  const getSessionBadgeColor = () => {
    switch (weekendSession) {
      case 'tp1':
      case 'tp2':
      case 'treino_livre':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'q1':
      case 'q2':
      case 'q3':
      case 'classificacao':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      case 'race':
      case 'corrida':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'pos_corrida':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      default:
        return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    }
  }

  const getSessionLabel = () => {
    switch (weekendSession) {
      case 'tp1':
        return 'Treino Livre 1 (TP1)'
      case 'tp2':
        return 'Treino Livre 2 (TP2)'
      case 'q1':
        return 'Qualificação 1 (Q1)'
      case 'q2':
        return 'Qualificação 2 (Q2)'
      case 'q3':
        return 'Qualificação 3 (Q3)'
      case 'race':
        return 'Grande Prêmio (Corrida)'
      case 'treino_livre':
        return 'Treino Livre (FP1)'
      case 'classificacao':
        return 'Qualificação (Q1-Q3)'
      case 'corrida':
        return 'Grande Prêmio'
      case 'pos_corrida':
        return 'Pós-Corrida'
      default:
        return 'Sessão'
    }
  }

  return (
    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#1F2733] bg-[#090D15]/80 backdrop-blur-md p-4 rounded-xl border">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600]">
            FIA F1 WORLD CHAMPIONSHIP // RACE OPERATIONS
          </span>
          <Badge
            variant="outline"
            className={`font-mono text-[10px] font-bold ${getSessionBadgeColor()}`}
          >
            {getSessionLabel()}
          </Badge>
          <span className="text-xs font-mono text-[#8B95A7]">Etapa {currentRound} de 24</span>
        </div>
        <PageHeader
          title={gpInfo.name}
          eyebrow="FIM DE SEMANA DE GP"
          description={`Fim de semana oficial da Fórmula 1 em ${gpInfo.circuit}`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {weekendSession === 'pos_corrida' && (
          <Button
            onClick={onAdvanceRound}
            disabled={isSimulating}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold shadow-lg shadow-emerald-950/40"
          >
            Avançar para Próxima Etapa
            <ChevronRight className="w-4 h-4 ml-1.5" />
          </Button>
        )}

        {weekendSession === 'corrida' && !hasRaceFinished && (
          <>
            {onQuickSimRace && (
              <Button
                variant="outline"
                onClick={onQuickSimRace}
                disabled={isSimulating}
                className="border-[#1A2333] hover:bg-[#1A2333] text-white font-mono text-xs"
              >
                <FastForward className="w-3.5 h-3.5 mr-1 text-amber-400" />
                Simulação Instantânea
              </Button>
            )}
            <Button
              onClick={onRunSession}
              disabled={isSimulating}
              className="bg-[#E10600] hover:bg-[#B30500] text-white font-mono font-bold shadow-lg shadow-red-950/40"
            >
              <Play className="w-4 h-4 mr-1.5" />
              {isSimulating ? 'Simulando Corrida...' : 'Iniciar Grande Prêmio'}
            </Button>
          </>
        )}

        {weekendSession === 'classificacao' && !hasQualyFinished && (
          <Button
            onClick={onRunSession}
            disabled={isSimulating}
            className="bg-amber-600 hover:bg-amber-500 text-white font-mono font-bold"
          >
            <Play className="w-4 h-4 mr-1.5" />
            {isSimulating ? 'Disputando Qualy...' : 'Iniciar Classificação'}
          </Button>
        )}

        {weekendSession === 'treino_livre' && !practiceDone && (
          <Button
            onClick={onRunSession}
            disabled={isSimulating}
            className="bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold"
          >
            <Play className="w-4 h-4 mr-1.5" />
            {isSimulating ? 'Executando FP1...' : 'Iniciar Treino Livre'}
          </Button>
        )}

        {onResetWeekend && weekendSession !== 'pos_corrida' && !isSimulating && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onResetWeekend}
            title="Reiniciar Sessão"
            className="text-[#8B95A7] hover:text-white"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
