import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, AlertTriangle, HelpCircle, Layers, Disc, ShieldAlert, Cpu } from 'lucide-react'
import type { PreparationInformedPackage } from '@/services/canonicalPreparationInformedService'
import type { SessionSetupModel } from '@/types/f1'

export interface EngineeringRecommendationCardProps {
  informedPackage: PreparationInformedPackage
  onApplyRecommendedSetup?: (adjustments: Partial<SessionSetupModel>) => void
  disabledApply?: boolean
}

export const EngineeringRecommendationCard: React.FC<EngineeringRecommendationCardProps> = ({
  informedPackage,
  onApplyRecommendedSetup,
  disabledApply = false,
}) => {
  const { hasPracticeEvidence, evidenceBadgeText, setupRecommendation, tyresAnalysis } =
    informedPackage

  return (
    <div className="p-4 rounded-xl bg-[#090D15]/90 border border-[#1E293B] space-y-4 font-mono text-xs shadow-md">
      {/* Cabeçalho do Bloco */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E293B] pb-2.5">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="font-extrabold uppercase tracking-wider text-white text-xs">
            RECOMENDAÇÃO DA ENGENHARIA (4D.1)
          </span>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] font-mono px-2 py-0.5 ${
            hasPracticeEvidence
              ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
              : 'border-amber-500/50 text-amber-300 bg-amber-500/10'
          }`}
        >
          {evidenceBadgeText}
        </Badge>
      </div>

      {/* Subtítulo & Base Observada */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-[#F5F7FA]">{setupRecommendation.headline}</span>
          <span className="text-[#8B95A7] text-[10px]">
            Confiança Geral:{' '}
            <span
              className={`font-bold ${
                setupRecommendation.overallConfidence === 'alta'
                  ? 'text-emerald-400'
                  : setupRecommendation.overallConfidence === 'media'
                    ? 'text-cyan-400'
                    : 'text-amber-400'
              }`}
            >
              {setupRecommendation.overallConfidence.toUpperCase()}
            </span>
          </span>
        </div>
        <p className="text-[10px] text-[#8B95A7] leading-relaxed">
          Base observada: {setupRecommendation.observedBasisText}
        </p>
      </div>

      {/* Grid de Eixos de Setup */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
        {(['frontWing', 'rearWing', 'suspension', 'differential'] as const).map((axisKey) => {
          const axisRec = setupRecommendation.axes[axisKey]
          if (!axisRec) return null

          const isKnown = axisRec.revealed
          const isOutOfRange = axisRec.direction !== 'ok' && axisRec.direction !== 'unknown'

          return (
            <div
              key={axisKey}
              className={`p-2.5 rounded-lg border text-[11px] space-y-1.5 transition-all ${
                isOutOfRange
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-[#1F2733] bg-[#0E1521]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[#8B95A7] font-bold uppercase text-[10px] flex items-center gap-1">
                  <Layers className="w-3 h-3 text-cyan-400" />
                  {axisRec.axisLabel}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1 py-0 ${
                    !isKnown
                      ? 'border-[#334155] text-[#94A3B8]'
                      : axisRec.confidence === 'alta'
                        ? 'border-emerald-500/40 text-emerald-400'
                        : 'border-cyan-500/40 text-cyan-400'
                  }`}
                >
                  {isKnown ? `Faixa: [${axisRec.minKnown}–${axisRec.maxKnown}]` : 'Faixa: ?'}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span>Atual: {axisRec.currentValue}</span>
                <span
                  className={`text-[10px] ${
                    axisRec.direction === 'ok'
                      ? 'text-emerald-400'
                      : axisRec.direction === 'increase'
                        ? 'text-cyan-400'
                        : axisRec.direction === 'decrease'
                          ? 'text-amber-400'
                          : 'text-[#8B95A7]'
                  }`}
                >
                  {axisRec.direction === 'ok'
                    ? '✓ Na janela'
                    : axisRec.direction === 'increase'
                      ? '▲ Aumentar'
                      : axisRec.direction === 'decrease'
                        ? '▼ Reduzir'
                        : 'Aguardando validação'}
                </span>
              </div>

              <p className="text-[10px] text-[#8B95A7] leading-snug">
                {axisRec.recommendationText}
              </p>
            </div>
          )
        })}
      </div>

      {/* Ação Explícita de Ajuste Recomendado */}
      {setupRecommendation.hasActionableChanges && onApplyRecommendedSetup && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-800/40">
          <div className="text-[10px] text-cyan-200">
            A engenharia sugere alinhar o setup às faixas testadas pelos pilotos.
          </div>
          <Button
            size="sm"
            type="button"
            disabled={disabledApply}
            onClick={() => onApplyRecommendedSetup(setupRecommendation.actionableAdjustments)}
            className="h-7 text-xs px-3 bg-cyan-600 hover:bg-cyan-500 text-black font-extrabold flex items-center gap-1.5 shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
            Aplicar Ajuste Recomendado
          </Button>
        </div>
      )}

      {/* Dimensões dos Pneus Avaliados (Macio, Médio, Duro) */}
      <div className="space-y-1.5 pt-1">
        <span className="text-[10px] font-bold uppercase text-[#8B95A7] block flex items-center gap-1">
          <Disc className="w-3 h-3 text-amber-400" /> Diagnóstico Multidimensional de Pneus (Estoque
          Real)
        </span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {(['macio', 'medio', 'duro'] as const).map((compKey) => {
            const analysis = tyresAnalysis[compKey]
            if (!analysis) return null

            return (
              <div
                key={compKey}
                className="p-2.5 rounded-lg bg-[#0E1521] border border-[#1F2733] space-y-1 text-[10px]"
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-white">{analysis.label.split(' ')[0]}</span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 ${
                      analysis.availableSetsCount <= 0
                        ? 'border-red-500/40 text-red-400'
                        : 'border-[#1F2733] text-cyan-300'
                    }`}
                  >
                    {analysis.availableSetsCount} jogo(s)
                  </Badge>
                </div>

                <div className="space-y-0.5 text-[#8B95A7]">
                  <div>
                    Degradação:{' '}
                    <span className="text-slate-200">{analysis.degradationCategory}</span>
                  </div>
                  <div>
                    Janela Útil: <span className="text-slate-200">{analysis.usefulWindowText}</span>
                  </div>
                  <div>
                    Ritmo/Queda: <span className="text-slate-200">{analysis.paceDropText}</span>
                  </div>
                  <div>
                    Consistência: <span className="text-slate-200">{analysis.consistencyText}</span>
                  </div>
                </div>

                {analysis.riskNotice && (
                  <p className="text-[9px] text-amber-400/90 pt-0.5">{analysis.riskNotice}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Feedback Direto do Piloto */}
      {setupRecommendation.driverNotes.length > 0 && (
        <div className="p-2.5 rounded-lg bg-[#0E1521] border border-[#1F2733] space-y-1 text-[10px]">
          <span className="text-[#8B95A7] font-bold uppercase text-[9px] block">
            Telemetria e Voz dos Pilotos (Treinos)
          </span>
          {setupRecommendation.driverNotes.slice(0, 3).map((note, idx) => (
            <p key={idx} className="text-slate-300 italic leading-relaxed">
              {note}
            </p>
          ))}
        </div>
      )}

      {/* Limitação / Principal Risco */}
      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold uppercase tracking-wider text-[9px] text-amber-400 block">
            Limitação / Principal Risco
          </span>
          <p className="leading-relaxed">{setupRecommendation.primaryRisk}</p>
        </div>
      </div>
    </div>
  )
}
