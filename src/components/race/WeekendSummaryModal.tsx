import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Trophy,
  Flag,
  Gauge,
  Radio,
  AlertTriangle,
  DollarSign,
  Briefcase,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Wrench,
  Zap,
} from 'lucide-react'
import { WeekendSummaryReport } from '@/types/canonical-season-transition'
import { formatCurrency } from '@/lib/formatters'

interface WeekendSummaryModalProps {
  open: boolean
  onClose: () => void
  report: WeekendSummaryReport | null
  onAdvanceToNextRound?: () => void
  isRound24?: boolean
  onNavigateToSeasonEnd?: () => void
}

export const WeekendSummaryModal: React.FC<WeekendSummaryModalProps> = ({
  open,
  onClose,
  report,
  onAdvanceToNextRound,
  isRound24,
  onNavigateToSeasonEnd,
}) => {
  if (!report) return null

  const p1 = report.playerDriversResults[0]
  const p2 = report.playerDriversResults[1]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#090D15] border border-[#1F2733] text-[#F5F7FA] p-6 space-y-6">
        <DialogHeader className="border-b border-[#1F2733] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#00A6FB]">
                RELATÓRIO OFICIAL FIA // RESUMO DO FIM DE SEMANA
              </span>
              <DialogTitle className="text-2xl font-black text-white flex items-center gap-2">
                <Flag className="w-6 h-6 text-[#E10600]" />
                {report.gpName} • Rodada {report.round}/24
              </DialogTitle>
              <DialogDescription className="text-xs text-[#8B95A7] font-mono">
                {report.circuitName} • Simulação canônica concluída com decisões autônomas do Pit
                Wall.
              </DialogDescription>
            </div>
            {report.isSprintWeekend && (
              <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs px-2.5 py-1">
                Fim de Semana Sprint
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* 1. RESULTADO DA EQUIPE & CLASSIFICAÇÃO */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#00A6FB] flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-yellow-400" />
            1. Resultado da Corrida Principal
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.playerDriversResults.map((dr, idx) => (
              <Card key={dr.driverId} className="bg-[#11161F] border border-[#1F2733] p-4">
                <div className="flex items-center justify-between border-b border-[#1F2733] pb-2 mb-3">
                  <div>
                    <span className="text-xs text-[#8B95A7] font-mono">Carro #{idx + 1}</span>
                    <h4 className="text-base font-bold text-white">{dr.driverName}</h4>
                  </div>
                  <Badge
                    className={`text-sm font-num font-bold px-3 py-1 ${
                      dr.finishPosition === 1
                        ? 'bg-amber-500 text-black'
                        : dr.finishPosition <= 3
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : dr.finishPosition <= 10
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-[#161D29] text-[#8B95A7]'
                    }`}
                  >
                    {dr.dnf ? 'DNF (Abandono)' : `P${dr.finishPosition}`}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="p-2 rounded bg-[#090D15] border border-[#1F2733]">
                    <span className="text-[#8B95A7] block text-[10px]">Grid Inicial</span>
                    <span className="font-bold text-white">P{dr.gridPosition}</span>
                  </div>
                  <div className="p-2 rounded bg-[#090D15] border border-[#1F2733]">
                    <span className="text-[#8B95A7] block text-[10px]">Pontos GP</span>
                    <span className="font-bold text-[#00A6FB]">+{dr.pointsEarned} pts</span>
                  </div>
                  <div className="p-2 rounded bg-[#090D15] border border-[#1F2733]">
                    <span className="text-[#8B95A7] block text-[10px]">Voltas</span>
                    <span className="font-bold text-white">{dr.lapsCompleted} v</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* 2. SPRINT (SE HOUVER) */}
        {report.isSprintWeekend && report.sprintResults && report.sprintResults.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              2. Classificação Sprint
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.sprintResults.map((sp, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-[#11161F] border border-[#1F2733] flex items-center justify-between font-mono text-xs"
                >
                  <span className="text-white font-bold">{sp.driverName}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-amber-500/30 text-amber-300">
                      P{sp.position}
                    </Badge>
                    <span className="text-emerald-400 font-bold">+{sp.points} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. CAMPEONATO (ANTES E DEPOIS) */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#00A6FB] flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            3. Impacto no Campeonato de Construtores & Pilotos
          </h3>
          <Card className="bg-[#11161F] border border-[#1F2733] p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-[#090D15] border border-[#1F2733] space-y-1 font-mono">
                <span className="text-[11px] text-[#8B95A7] uppercase block">
                  Classificação da Escuderia
                </span>
                <div className="flex items-center justify-between text-sm">
                  <span>Posição Mundial:</span>
                  <div className="flex items-center gap-2 font-bold">
                    <span className="text-[#8B95A7]">
                      P{report.championshipImpact.teamRankBefore}
                    </span>
                    <span>→</span>
                    <span className="text-[#00A6FB]">
                      P{report.championshipImpact.teamRankAfter}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Pontuação Total:</span>
                  <div className="flex items-center gap-2 font-bold">
                    <span className="text-[#8B95A7]">
                      {report.championshipImpact.teamPointsBefore} pts
                    </span>
                    <span>→</span>
                    <span className="text-emerald-400">
                      {report.championshipImpact.teamPointsAfter} pts
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#090D15] border border-[#1F2733] space-y-2 font-mono">
                <span className="text-[11px] text-[#8B95A7] uppercase block">
                  Pilotos da Equipe
                </span>
                {report.playerDriversResults.map((dr) => {
                  const before = report.championshipImpact.driverStandingsBefore.find(
                    (d) => d.driverId === dr.driverId,
                  )
                  const after = report.championshipImpact.driverStandingsAfter.find(
                    (d) => d.driverId === dr.driverId,
                  )
                  return (
                    <div
                      key={dr.driverId}
                      className="flex items-center justify-between text-xs border-b border-[#1F2733]/50 pb-1"
                    >
                      <span className="text-white font-bold">{dr.driverName}</span>
                      <span className="text-cyan-300">
                        P{before?.rank || '—'} ({before?.points || 0} pts) → P{after?.rank || '—'} (
                        {after?.points || 0} pts)
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* 4. ESTRATÉGIA & INCIDENTES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#00A6FB] flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-cyan-400" />
              4. Decisões Estratégicas da IA Pit Wall
            </h3>
            <div className="p-3 rounded-lg bg-[#11161F] border border-[#1F2733] space-y-2 text-xs font-mono">
              {report.strategicDecisions.length > 0 ? (
                report.strategicDecisions.map((dec, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-slate-300">{dec}</span>
                  </div>
                ))
              ) : (
                <span className="text-[#8B95A7]">
                  Nenhuma decisão estratégica anormal requerida.
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              5. Incidentes e Banderas
            </h3>
            <div className="p-3 rounded-lg bg-[#11161F] border border-[#1F2733] space-y-2 text-xs font-mono">
              {report.incidents.length > 0 ? (
                report.incidents.map((inc, i) => (
                  <div key={i} className="flex items-start gap-2 text-amber-300">
                    <span className="text-amber-400 font-bold shrink-0">⚠️</span>
                    <span>{inc}</span>
                  </div>
                ))
              ) : (
                <span className="text-[#8B95A7]">Nenhum incidente crítico durante o GP.</span>
              )}
            </div>
          </div>
        </div>

        {/* 5. REAÇÃO DOS PILOTOS & ESTADO PSICOLÓGICO */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#00A6FB] flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-[#00A6FB]" />
            6. Reação Pós-Corrida dos Pilotos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.driverReactions.map((rea) => (
              <div
                key={rea.driverId}
                className="p-3.5 rounded-lg bg-[#11161F] border border-[#1F2733] space-y-2"
              >
                <div className="flex items-center justify-between border-b border-[#1F2733]/60 pb-1.5">
                  <span className="text-xs font-bold text-white">{rea.driverName}</span>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-[#8B95A7]">
                      Moral: {rea.moraleBefore}% →{' '}
                      <strong
                        className={
                          rea.moraleAfter >= rea.moraleBefore
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }
                      >
                        {rea.moraleAfter}%
                      </strong>
                    </span>
                    <span className="text-[#8B95A7]">
                      Física: <strong className="text-cyan-400">{rea.physicalAfter}%</strong>
                    </span>
                  </div>
                </div>
                <p className="text-xs italic text-slate-300 leading-relaxed">"{rea.comment}"</p>
              </div>
            ))}
          </div>
        </div>

        {/* 6. CARRO & DESGASTE MECÂNICO */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#00A6FB] flex items-center gap-1.5">
            <Wrench className="w-4 h-4 text-emerald-400" />
            7. Condição Mecânica do Carro Pós-GP
          </h3>
          <div className="p-4 rounded-lg bg-[#11161F] border border-[#1F2733] space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#1F2733] pb-2">
              <span className="text-slate-300">Desgaste da Unidade de Potência (PU V6):</span>
              <span className="font-bold text-white">
                {report.carCondition.engineWearBefore}% →{' '}
                <span className="text-amber-400">{report.carCondition.engineWearAfter}%</span>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              {report.carCondition.partsHealth.map((p, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-[#090D15] border border-[#1F2733] flex justify-between"
                >
                  <span className="text-[#8B95A7] truncate max-w-[90px]">{p.name}</span>
                  <span className="font-bold text-emerald-400">{p.condition}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 7. IMPACTO FINANCEIRO & PATROCINADORES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              8. Fechamento Financeiro da Rodada
            </h3>
            <div className="p-3.5 rounded-lg bg-[#11161F] border border-[#1F2733] space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-emerald-400">
                <span>Receita Patrocinadores:</span>
                <span>+{formatCurrency(report.financialImpact.sponsorIncome)}</span>
              </div>
              <div className="flex justify-between text-red-400">
                <span>Salários dos Pilotos:</span>
                <span>-{formatCurrency(report.financialImpact.driverSalariesCost)}</span>
              </div>
              <div className="flex justify-between text-red-400">
                <span>Custos de Motor & Operação:</span>
                <span>-{formatCurrency(report.financialImpact.engineCost)}</span>
              </div>
              {report.financialImpact.damageCost ? (
                <div className="flex justify-between text-amber-400">
                  <span>Reparos de Dano:</span>
                  <span>-{formatCurrency(report.financialImpact.damageCost)}</span>
                </div>
              ) : null}
              <Separator className="bg-[#1F2733] my-1" />
              <div className="flex justify-between font-bold text-white pt-1">
                <span>Saldo em Caixa Final:</span>
                <span className="text-[#00A6FB]">
                  {formatCurrency(report.financialImpact.closingBalance)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#00A6FB] flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-[#00A6FB]" />
              9. Patrocinadores & Metas
            </h3>
            <div className="p-3.5 rounded-lg bg-[#11161F] border border-[#1F2733] space-y-2 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-[#8B95A7]">Contratos Ativos:</span>
                <span className="font-bold text-white">
                  {report.sponsorImpact.activeSponsorsCount} patrocinador(es)
                </span>
              </div>
              <div className="space-y-1 pt-1">
                <span className="text-[#8B95A7] block text-[10px]">Metas Cumpridas:</span>
                {report.sponsorImpact.objectivesMet.length > 0 ? (
                  report.sponsorImpact.objectivesMet.map((obj, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{obj}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-[#8B95A7] text-[11px]">
                    Nenhuma bonificação especial acionada nesta rodada.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 8. RADIO HIGHLIGHTS */}
        {report.radioHighlights.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#00A6FB] flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-[#00A6FB]" />
              10. Destaques de Rádio (Interações Relevantes)
            </h3>
            <div className="p-3 rounded-lg bg-[#11161F] border border-[#1F2733] space-y-2 text-xs font-mono">
              {report.radioHighlights.map((rh, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-[#090D15] border border-[#1F2733] space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] text-[#8B95A7]">
                    <span className="font-bold text-white">
                      Volta {rh.lap} • {rh.driverName}
                    </span>
                    <Badge variant="outline" className="border-[#1F2733] text-cyan-300">
                      {rh.type}
                    </Badge>
                  </div>
                  <p className="text-slate-300">{rh.radioText}</p>
                  {rh.reactionText && (
                    <p className="text-amber-300 italic text-[11px]">{rh.reactionText}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-[#1F2733] pt-4 flex flex-col sm:flex-row gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-[#1F2733] text-white hover:bg-[#11161F]"
          >
            Fechar Relatório
          </Button>

          {isRound24 ? (
            <Button
              onClick={() => {
                onClose()
                onNavigateToSeasonEnd?.()
              }}
              className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold flex items-center gap-2"
            >
              <Trophy className="w-4 h-4" />
              Ver Fim da Temporada 2026
            </Button>
          ) : (
            <Button
              onClick={() => {
                onClose()
                onAdvanceToNextRound?.()
              }}
              className="bg-[#00A6FB] hover:bg-[#0092DC] text-[#0B0E14] font-extrabold"
            >
              Avançar para Próximo GP
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
