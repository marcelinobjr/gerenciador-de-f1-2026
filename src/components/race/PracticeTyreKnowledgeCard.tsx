import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CircleDot, ChevronDown, ChevronUp, Layers } from 'lucide-react'
import type { WeekendTyreKnowledge, TyreStintObservation } from '@/types/practice-tyres'
import {
  formatDegradationLabel,
  formatUsefulWindowLabel,
  formatPaceDropLabel,
  formatConsistencyLabel,
  CANONICAL_COMPOUNDS,
} from '@/services/canonicalPracticeTyreService'
import { TIRE_SPECS } from '@/lib/f1-tire-system'
import type { TireCompound } from '@/types/f1'

interface PracticeTyreKnowledgeCardProps {
  tyreKnowledge?: WeekendTyreKnowledge
  latestObservation?: TyreStintObservation
}

export const PracticeTyreKnowledgeCard: React.FC<PracticeTyreKnowledgeCardProps> = ({
  tyreKnowledge,
  latestObservation,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedCompound, setSelectedCompound] = useState<TireCompound>('medio')

  const formatConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'alta':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] font-mono uppercase px-1.5 py-0">
            Alta
          </Badge>
        )
      case 'media':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px] font-mono uppercase px-1.5 py-0">
            Média
          </Badge>
        )
      case 'baixa':
        return (
          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[9px] font-mono uppercase px-1.5 py-0">
            Baixa
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-700/40 text-slate-400 border-slate-600/30 text-[9px] font-mono uppercase px-1.5 py-0">
            Sem dados
          </Badge>
        )
    }
  }

  const activeCompoundData = tyreKnowledge?.[selectedCompound]
  const activeCompoundSpec = TIRE_SPECS[selectedCompound]

  return (
    <Card className="p-3.5 rounded-xl bg-[#090D15]/90 border border-[#1A2333] space-y-3 font-mono text-xs">
      {/* Cabeçalho do Card */}
      <div className="flex items-center justify-between border-b border-[#141B26] pb-2">
        <div className="flex items-center gap-2">
          <CircleDot className="w-4 h-4 text-amber-400" />
          <span className="font-extrabold text-white uppercase tracking-wider text-[11px]">
            Conhecimento de Pneus & Compostos
          </span>
        </div>
        <div className="flex items-center gap-2">
          {activeCompoundData && (
            <div className="flex items-center gap-1 text-[10px] text-[#8B95A7]">
              <span>Confiança:</span>
              {formatConfidenceBadge(activeCompoundData.overallConfidence)}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0 text-[#8B95A7] hover:text-white"
          >
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Seletor de Compostos Canônicos */}
      <div className="flex flex-wrap items-center gap-1.5">
        {CANONICAL_COMPOUNDS.map((comp) => {
          const spec = TIRE_SPECS[comp]
          const isSelected = selectedCompound === comp
          const compData = tyreKnowledge?.[comp]
          const hasData = compData && compData.overallConfidence !== 'sem_dados'

          return (
            <button
              key={comp}
              type="button"
              onClick={() => setSelectedCompound(comp)}
              style={{
                borderColor: isSelected ? spec.color : undefined,
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border transition-all ${
                isSelected
                  ? 'bg-[#141E2F] text-white shadow'
                  : 'bg-[#0E1521]/70 border-[#1A2436] text-[#8B95A7] hover:text-white'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: spec.color }}
              />
              <span>{spec.label}</span>
              {hasData && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse ml-0.5" />
              )}
            </button>
          )
        })}
      </div>

      {/* Grid de Apresentação das Dimensões Multidimensionais */}
      {activeCompoundData ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[10px]">
          {/* Degradação */}
          <div className="bg-[#141B26]/60 p-2 rounded-lg border border-[#1A2436]/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#8B95A7]">
              <span>Degradação</span>
              {activeCompoundData.degradation.revealed &&
                formatConfidenceBadge(activeCompoundData.degradation.confidence)}
            </div>
            <div className="font-bold text-white mt-1">
              {activeCompoundData.degradation.revealed ? (
                <span className="text-amber-300">
                  {formatDegradationLabel(activeCompoundData.degradation.value)}
                </span>
              ) : (
                <span className="text-slate-500">?</span>
              )}
            </div>
          </div>

          {/* Janela Útil */}
          <div className="bg-[#141B26]/60 p-2 rounded-lg border border-[#1A2436]/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#8B95A7]">
              <span>Janela Útil</span>
              {activeCompoundData.usefulWindow.revealed &&
                formatConfidenceBadge(activeCompoundData.usefulWindow.confidence)}
            </div>
            <div className="font-bold text-white mt-1">
              {activeCompoundData.usefulWindow.revealed ? (
                <span className="text-cyan-300 font-mono">
                  {formatUsefulWindowLabel(activeCompoundData.usefulWindow.value)}
                </span>
              ) : (
                <span className="text-slate-500 font-mono">?</span>
              )}
            </div>
          </div>

          {/* Queda de Ritmo */}
          <div className="bg-[#141B26]/60 p-2 rounded-lg border border-[#1A2436]/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#8B95A7]">
              <span>Queda Ritmo</span>
              {activeCompoundData.paceDrop.revealed &&
                formatConfidenceBadge(activeCompoundData.paceDrop.confidence)}
            </div>
            <div className="font-bold text-white mt-1">
              {activeCompoundData.paceDrop.revealed ? (
                <span className="text-emerald-300 font-mono">
                  {formatPaceDropLabel(activeCompoundData.paceDrop.value)}
                </span>
              ) : (
                <span className="text-slate-500 font-mono">?</span>
              )}
            </div>
          </div>

          {/* Consistência */}
          <div className="bg-[#141B26]/60 p-2 rounded-lg border border-[#1A2436]/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#8B95A7]">
              <span>Consistência</span>
              {activeCompoundData.consistency.revealed &&
                formatConfidenceBadge(activeCompoundData.consistency.confidence)}
            </div>
            <div className="font-bold text-white mt-1">
              {activeCompoundData.consistency.revealed ? (
                <span className="text-white">
                  {formatConsistencyLabel(activeCompoundData.consistency.value)}
                </span>
              ) : (
                <span className="text-slate-500">?</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-[#8B95A7] italic p-2 bg-[#0E1521] rounded-lg">
          Sem observações coletadas para este composto no fim de semana.
        </div>
      )}

      {/* Detalhes Expandidos de Auditoria e Histórico */}
      {isExpanded && activeCompoundData && (
        <div className="pt-2 border-t border-[#141B26] space-y-1.5 text-[10px] text-[#8B95A7]">
          <div className="flex justify-between items-center">
            <span>Voltas observadas:</span>
            <span className="font-bold text-white">
              {activeCompoundData.totalLapsObserved} voltas
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>Stints analisados:</span>
            <span className="font-bold text-white">
              {activeCompoundData.totalStintsObserved} stint(s)
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>Carros participantes:</span>
            <span className="font-bold text-white">
              {activeCompoundData.testedCars.length > 0
                ? activeCompoundData.testedCars.join(' & ')
                : 'Nenhum'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>Condições climáticas:</span>
            <span className="font-bold text-white">
              {activeCompoundData.testedConditions.length > 0
                ? activeCompoundData.testedConditions.join(', ')
                : 'Sem registro'}
            </span>
          </div>
        </div>
      )}

      {/* Resumo Pós-Stint Recente do Composto se disponível */}
      {latestObservation && latestObservation.compound === selectedCompound && (
        <div className="p-2.5 rounded-lg bg-[#0B111C] border border-[#1E293B] text-[10px]">
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold mb-1">
            <Layers className="w-3 h-3" />
            <span>Último Stint Observado:</span>
          </div>
          <p className="text-[#BAC4D6] italic">{latestObservation.summaryMessage}</p>
        </div>
      )}
    </Card>
  )
}
