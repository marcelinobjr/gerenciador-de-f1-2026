import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Trophy,
  Flag,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Radio,
  AlertTriangle,
  Award,
  Sparkles,
  Zap,
  TrendingUp,
} from 'lucide-react'
import type { RaceReportData } from '@/types/f1'

export interface RaceReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: RaceReportData | null
  teamColor?: string
}

export function RaceReportModal({
  open,
  onOpenChange,
  report,
  teamColor = '#E10600',
}: RaceReportModalProps) {
  if (!report) return null

  const cDelta = report.constructorDelta
  const isRankUp = cDelta.positionDelta > 0
  const isRankDown = cDelta.positionDelta < 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0B0E14] border border-[#1F2733] text-[#F5F7FA] p-0 shadow-2xl">
        {/* Top Header com gradiente sutil na cor da equipe */}
        <div className="relative p-6 border-b border-[#1F2733] bg-[#11161F] overflow-hidden">
          <div
            className="absolute top-0 right-0 w-80 h-48 opacity-15 pointer-events-none rounded-full blur-3xl"
            style={{ backgroundColor: teamColor }}
          />

          <DialogHeader className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="eyebrow text-[#00A6FB] text-[10px] tracking-widest uppercase">
                    RACE OPERATIONS // DEBRIEFING OFICIAL
                  </span>
                  <Badge className="bg-[#161D29] border border-[#1F2733] text-white font-num text-[11px] px-2 py-0.5">
                    Rodada {report.round}
                  </Badge>
                </div>
                <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase flex items-center gap-2">
                  <span>{report.flag || '🏁'}</span>
                  <span>{report.gpName}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-[#8B95A7] font-num">
                  {report.circuitName} • {report.totalLaps} Voltas • Data: {report.date}
                </DialogDescription>
              </div>

              {/* Box de Pontos e Posição da Equipe */}
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1F2733] text-right">
                  <span className="text-[10px] text-[#8B95A7] block uppercase font-mono">
                    Pontos no GP
                  </span>
                  <span className="font-num text-xl sm:text-2xl font-extrabold text-[#22C55E]">
                    +{report.teamPoints}{' '}
                    <span className="text-xs text-[#8B95A7] font-normal">pts</span>
                  </span>
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          {/* 1. DESTAQUE DO MELHOR MOMENTO */}
          {report.bestMoment && (
            <div className="relative p-4 rounded-xl bg-gradient-to-r from-[#161D29] via-[#11161F] to-[#161D29] border border-[#22C55E]/40 shadow-lg">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center shrink-0 text-[#22C55E]">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-[#22C55E] uppercase">
                      MELHOR MOMENTO DA EQUIPE
                    </span>
                    {report.bestMoment.badge && (
                      <Badge className="bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40 font-mono text-[9px] px-1.5 py-0">
                        {report.bestMoment.badge}
                      </Badge>
                    )}
                  </div>
                  <h4 className="text-sm font-extrabold text-white mt-0.5">
                    {report.bestMoment.title}
                  </h4>
                  <p className="text-xs text-[#8B95A7] mt-1 leading-relaxed">
                    {report.bestMoment.description}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 2. GANHO / PERDA DE POSIÇÕES NO CAMPEONATO (ANTES ⇄ DEPOIS) */}
          <div className="p-4 rounded-xl bg-[#11161F] border border-[#1F2733] space-y-3">
            <div className="flex items-center justify-between border-b border-[#1F2733] pb-2">
              <span className="eyebrow text-[#8B95A7] text-[11px] flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#00A6FB]" /> Impacto no Campeonato de
                Construtores
              </span>
              <span className="text-[11px] font-num text-[#8B95A7]">Fonte: FIA Standings</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Posição no campeonato: antes ⇄ depois */}
              <div className="p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] flex flex-col justify-between">
                <span className="text-[10px] text-[#8B95A7] uppercase font-mono">
                  Posição no Mundial
                </span>
                <div className="flex items-center gap-2 mt-2">
                  <span className="font-num text-lg font-bold text-[#8B95A7]">
                    P{cDelta.rankBefore}
                  </span>
                  <span className="text-xs text-[#8B95A7]">➔</span>
                  <span className="font-num text-xl font-extrabold text-white">
                    P{cDelta.rankAfter}
                  </span>
                </div>
                <div className="mt-2">
                  {isRankUp && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#22C55E] font-num">
                      <ArrowUpRight className="w-3.5 h-3.5" /> +{cDelta.positionDelta}{' '}
                      {cDelta.positionDelta === 1 ? 'posição' : 'posições'}
                    </span>
                  )}
                  {isRankDown && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 font-num">
                      <ArrowDownRight className="w-3.5 h-3.5" /> {cDelta.positionDelta} posições
                    </span>
                  )}
                  {!isRankUp && !isRankDown && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8B95A7] font-num">
                      <Minus className="w-3.5 h-3.5" /> Posição mantida
                    </span>
                  )}
                </div>
              </div>

              {/* Pontos acumulados */}
              <div className="p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] flex flex-col justify-between">
                <span className="text-[10px] text-[#8B95A7] uppercase font-mono">
                  Pontos Acumulados
                </span>
                <div className="flex items-center gap-2 mt-2">
                  <span className="font-num text-lg font-bold text-[#8B95A7]">
                    {cDelta.pointsBefore}
                  </span>
                  <span className="text-xs text-[#8B95A7]">➔</span>
                  <span className="font-num text-xl font-extrabold text-[#00A6FB]">
                    {cDelta.pointsAfter} pts
                  </span>
                </div>
                <span className="text-[11px] text-[#22C55E] font-num font-bold mt-2">
                  +{cDelta.pointsGained} no GP
                </span>
              </div>

              {/* Status do Mundial */}
              <div className="p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] flex flex-col justify-between">
                <span className="text-[10px] text-[#8B95A7] uppercase font-mono">
                  Status da Escuderia
                </span>
                <div className="mt-2">
                  <span className="text-sm font-bold text-white block">
                    {cDelta.rankAfter <= 3
                      ? 'Luta pelo Título Mundial'
                      : cDelta.rankAfter <= 6
                        ? 'Disputa de Alto Pelotão'
                        : 'Batalha do Meio do Grid'}
                  </span>
                  <span className="text-[10px] text-[#8B95A7] font-num mt-1 block">
                    Top {cDelta.rankAfter} de 12 construtores
                  </span>
                </div>
                <div className="w-full bg-[#161D29] h-1.5 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-[#00A6FB] rounded-full"
                    style={{ width: `${Math.max(8, 100 - (cDelta.rankAfter - 1) * 8.3)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. RESULTADO FINAL DA EQUIPE (POSIÇÕES, PONTOS E ESTRATÉGIA DOS 2 PILOTOS) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#1F2733] pb-2">
              <span className="eyebrow text-[#8B95A7] text-[11px] flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-400" /> Desempenho dos Pilotos & Estratégia
              </span>
              <span className="text-[11px] font-num text-[#8B95A7]">
                {report.teamDrivers.length} carros na pista
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.teamDrivers.map((driver) => {
                const hasMorale = driver.newMorale !== undefined && driver.oldMorale !== undefined
                const mDelta = hasMorale ? driver.newMorale! - driver.oldMorale! : 0
                const hasPhys = driver.newPhysical !== undefined && driver.oldPhysical !== undefined
                const pDelta = hasPhys ? driver.newPhysical! - driver.oldPhysical! : 0

                return (
                  <div
                    key={driver.driverId}
                    className="p-4 rounded-xl bg-[#11161F] border border-[#1F2733] space-y-3 relative overflow-hidden"
                  >
                    <div
                      className="absolute top-0 left-0 bottom-0 w-1"
                      style={{ backgroundColor: teamColor }}
                    />

                    {/* Cabeçalho do piloto */}
                    <div className="flex items-center justify-between gap-2 pl-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{driver.flag || '🏎️'}</span>
                        <div>
                          <h4 className="text-sm font-extrabold text-white">{driver.driverName}</h4>
                          <span className="text-[10px] text-[#8B95A7] font-num">
                            {driver.totalTime || 'Concluído'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {driver.fastestLap && (
                          <Badge className="bg-purple-600 text-white font-mono text-[9px] px-1.5 py-0 h-4">
                            FL
                          </Badge>
                        )}
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md font-num font-extrabold text-xs ${
                            driver.dnf
                              ? 'bg-red-950/80 text-red-400 border border-red-500/50'
                              : driver.finalPosition === 1
                                ? 'bg-amber-400 text-black'
                                : driver.finalPosition <= 3
                                  ? 'bg-amber-700 text-white'
                                  : driver.finalPosition <= 10
                                    ? 'bg-[#161D29] text-[#22C55E] border border-[#22C55E]/40'
                                    : 'bg-[#161D29] text-[#8B95A7]'
                          }`}
                        >
                          {driver.dnf ? 'DNF' : `P${driver.finalPosition}`}
                        </span>
                        {driver.points > 0 && (
                          <span className="font-num text-xs font-bold text-[#22C55E]">
                            +{driver.points} pts
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stints e Paradas */}
                    <div className="pl-2 pt-1 border-t border-[#1F2733]/60 space-y-2">
                      <span className="text-[10px] font-mono text-[#8B95A7] uppercase block">
                        Estratégia de Paradas & Pneus:
                      </span>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-num">
                        {driver.stints && driver.stints.length > 0 ? (
                          driver.stints.map((stint, sIdx) => (
                            <div
                              key={sIdx}
                              className="px-2 py-1 rounded-md bg-[#0B0E14] border border-[#1F2733] flex items-center gap-1.5"
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  stint.compound === 'macio'
                                    ? 'bg-red-500'
                                    : stint.compound === 'medio'
                                      ? 'bg-amber-400'
                                      : stint.compound === 'duro'
                                        ? 'bg-slate-200'
                                        : 'bg-emerald-400'
                                }`}
                              />
                              <span className="capitalize text-white font-bold">
                                {stint.compound}
                              </span>
                              <span className="text-[#8B95A7] text-[10px]">
                                (V{stint.startLap}-V{stint.endLap})
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-[#8B95A7] font-mono">
                            Estratégia padrão de 1 parada executada
                          </span>
                        )}
                      </div>

                      {driver.pitStops && driver.pitStops.length > 0 && (
                        <div className="text-[11px] text-[#8B95A7] font-num">
                          Parada(s):{' '}
                          {driver.pitStops
                            .map((p) => `V${p.lap} (${p.toCompound.toUpperCase()})`)
                            .join(', ')}
                        </div>
                      )}
                    </div>

                    {/* Variação de Moral e Condição Física */}
                    {(hasMorale || hasPhys) && (
                      <div className="pl-2 pt-2 border-t border-[#1F2733]/60 grid grid-cols-2 gap-2 text-xs font-num">
                        {hasMorale && (
                          <div className="p-2 rounded bg-[#0B0E14] border border-[#1F2733]">
                            <span className="text-[9px] text-[#8B95A7] uppercase block font-mono">
                              Moral
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-white font-bold">{driver.newMorale}</span>
                              <span
                                className={`text-[10px] font-bold ${
                                  mDelta > 0
                                    ? 'text-[#22C55E]'
                                    : mDelta < 0
                                      ? 'text-red-400'
                                      : 'text-[#8B95A7]'
                                }`}
                              >
                                ({mDelta > 0 ? `+${mDelta}` : mDelta})
                              </span>
                            </div>
                          </div>
                        )}

                        {hasPhys && (
                          <div className="p-2 rounded bg-[#0B0E14] border border-[#1F2733]">
                            <span className="text-[9px] text-[#8B95A7] uppercase block font-mono">
                              Condição Física
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-white font-bold">{driver.newPhysical}%</span>
                              <span
                                className={`text-[10px] font-bold ${
                                  pDelta > 0
                                    ? 'text-[#22C55E]'
                                    : pDelta < 0
                                      ? 'text-red-400'
                                      : 'text-[#8B95A7]'
                                }`}
                              >
                                ({pDelta > 0 ? `+${pDelta}` : pDelta}%)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 4. MELHORES RÁDIOS DA CORRIDA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#1F2733] pb-2">
              <span className="eyebrow text-[#8B95A7] text-[11px] flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" /> Melhores Rádios da Equipe
              </span>
              <span className="text-[11px] font-num text-[#8B95A7]">Comunicações de Pista</span>
            </div>

            {report.radioHighlights && report.radioHighlights.length > 0 ? (
              <div className="space-y-2">
                {report.radioHighlights.map((r, i) => (
                  <div
                    key={r.id || i}
                    className="p-3 rounded-lg bg-[#11161F] border border-[#1F2733] text-xs font-mono space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#8B95A7]">
                      <span className="font-bold text-white">
                        V{r.lap} • {r.driverName}
                      </span>
                      {r.bossResponse && (
                        <Badge className="bg-[#161D29] border border-[#1F2733] text-cyan-400 text-[9px] px-1.5 py-0 uppercase">
                          {r.bossResponse}
                        </Badge>
                      )}
                    </div>
                    <p className="text-slate-200 italic font-sans text-xs">"{r.driverMessage}"</p>
                    {r.driverFeedback && (
                      <p className="text-emerald-400 text-[11px]">➔ Piloto: "{r.driverFeedback}"</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-[#11161F] border border-[#1F2733] text-center text-xs text-[#8B95A7] font-mono">
                Nenhum rádio crítico registrado durante a etapa.
              </div>
            )}
          </div>

          {/* 5. INCIDENTES ENVOLVENDO A EQUIPE */}
          <div className="space-y-2">
            <span className="eyebrow text-[#8B95A7] text-[11px] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Incidentes da Corrida
            </span>
            <div className="p-3.5 rounded-lg bg-[#11161F] border border-[#1F2733] space-y-1.5 text-xs font-mono">
              {report.teamIncidents && report.teamIncidents.length > 0 ? (
                report.teamIncidents.map((inc, i) => (
                  <div key={i} className="flex items-start gap-2 text-slate-300">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>{inc}</span>
                  </div>
                ))
              ) : (
                <div className="text-[#8B95A7]">Nenhum incidente registrado. Corrida limpa!</div>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé com botão de fechar */}
        <div className="p-4 border-t border-[#1F2733] bg-[#11161F] flex items-center justify-end">
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-[#161D29] hover:bg-[#1f2937] text-white border border-[#1F2733] text-xs font-bold px-5"
          >
            Fechar Relatório
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
