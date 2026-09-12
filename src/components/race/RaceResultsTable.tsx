import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Award, ArrowRight, ShieldAlert, FileText } from 'lucide-react'
import { TireCompound, RaceReportData } from '@/types/f1'
import { RaceReportModal } from './RaceReportModal'
import { raceReportService } from '@/services/raceReportService'
import { f1Service } from '@/services/f1Service'
import pb from '@/lib/pocketbase/client'

export interface RaceResultEntry {
  driverId: string
  driverName?: string
  teamId?: string
  teamName?: string
  teamColor?: string
  isPlayer?: boolean
  flag?: string
  position: number
  points?: number
  tireCompound?: TireCompound
  secondCompound?: TireCompound
  tireWear?: number
  pitStopsDone?: number
  fastestLap?: boolean
  dnf?: boolean
  dnfReason?: string
  totalTime?: string
  oldMorale?: number
  newMorale?: number
  oldPhysical?: number
  newPhysical?: number
}

interface RaceResultsTableProps {
  gpName: string
  results?: RaceResultEntry[]
  raceResults?: RaceResultEntry[]
  incidents: string[]
  isFinishing: boolean
  onAdvanceRound: () => void
  onOpenReport?: () => void
}

export function RaceResultsTable({
  gpName,
  results,
  raceResults,
  incidents,
  isFinishing,
  onAdvanceRound,
  onOpenReport,
}: RaceResultsTableProps) {
  const displayResults = results || raceResults || []

  // Estado local para relatório pós-corrida
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [currentReport, setCurrentReport] = useState<RaceReportData | null>(null)

  // Ao montar ou mudar de resultados, tenta gerar/obter o relatório para exibição instantânea
  const handleOpenReportInternal = async () => {
    if (onOpenReport) {
      onOpenReport()
      return
    }

    if (currentReport) {
      setReportModalOpen(true)
      return
    }

    try {
      // Buscar season do usuário autenticado no backend
      const pbUser = pb.authStore.record
      const team = pbUser ? await f1Service.getPlayerTeam(pbUser.id) : null
      const season = team ? await f1Service.getSeasonByTeam(team.id) : null

      if (season && team) {
        const existing = await raceReportService.getReport(season.id, season.current_round)
        if (existing?.data) {
          setCurrentReport(existing.data)
          setReportModalOpen(true)
          return
        }

        const drivers = await f1Service.getTeamDrivers(team.id)
        const generated = raceReportService.generateReportData({
          round: season.current_round,
          gpInfo: {
            name: gpName,
            circuit: 'Autódromo Oficial FIA',
            laps: 55,
          },
          finalGrid: displayResults,
          raceIncidents: incidents,
          liveEvents: [],
          team,
          season,
          drivers,
          previousRaceResults: [],
          currentRaceResults: [],
        })

        setCurrentReport(generated)
        setReportModalOpen(true)
      }
    } catch (e) {
      console.warn('Erro ao carregar relatório no botão interno:', e)
    }
  }

  return (
    <>
      <Card
        id="race-official-results"
        className="bg-[#11161F] border-[#1F2733] shadow-xl scroll-mt-24"
      >
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#1F2733] pb-4">
          <div>
            <span className="eyebrow text-[#00A6FB] text-[10px] tracking-wider uppercase block">
              RACE OPERATIONS // CLASSIFICAÇÃO OFICIAL FIA
            </span>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
              <Award className="w-4 h-4 text-amber-400" />
              Resultado Final — {gpName}
            </CardTitle>
          </div>

          {/* Action Buttons: Ver Relatório & Avançar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenReportInternal}
              className="bg-[#161D29] hover:bg-[#1f2937] text-cyan-400 border border-cyan-500/40 font-bold px-4 shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Ver Relatório do GP</span>
            </Button>

            <Button
              size="sm"
              onClick={onAdvanceRound}
              disabled={isFinishing}
              data-advance-round=""
              data-is-finishing={isFinishing ? 'true' : 'false'}
              className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold px-5 shadow-lg cursor-pointer flex items-center gap-1.5"
            >
              <span>{isFinishing ? 'Salvando dados...' : 'Avançar para Próxima Rodada'}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Tabela de Resultados */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#8B95A7] border-b border-[#1F2733] text-left">
                  <th className="py-2 px-2 font-mono uppercase text-[10px] w-12">Pos</th>
                  <th className="py-2 px-2 font-mono uppercase text-[10px]">Piloto</th>
                  <th className="py-2 px-2 font-mono uppercase text-[10px]">Equipe</th>
                  <th className="py-2 px-2 font-mono uppercase text-[10px] text-right">
                    Tempo / Gap
                  </th>
                  <th className="py-2 px-2 font-mono uppercase text-[10px] text-right w-16">
                    Pontos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2733]/50">
                {displayResults.map((r) => {
                  const isPodium = r.position <= 3 && !r.dnf
                  const isPoints = r.position <= 10 && !r.dnf
                  return (
                    <tr
                      key={r.driverId}
                      className={`hover:bg-[#161D29]/60 transition-colors ${
                        r.isPlayer ? 'bg-[#00A6FB]/10 font-semibold' : ''
                      }`}
                    >
                      <td className="py-2.5 px-2 font-num">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${
                            r.dnf
                              ? 'bg-red-950/60 text-red-400 border border-red-500/30'
                              : r.position === 1
                                ? 'bg-amber-400 text-black'
                                : r.position === 2
                                  ? 'bg-slate-300 text-black'
                                  : r.position === 3
                                    ? 'bg-amber-700 text-white'
                                    : isPoints
                                      ? 'bg-[#161D29] text-[#22C55E]'
                                      : 'text-[#8B95A7]'
                          }`}
                        >
                          {r.dnf ? 'DNF' : r.position}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <span>{r.flag || '🏁'}</span>
                          <span className={r.isPlayer ? 'text-white font-bold' : 'text-[#F5F7FA]'}>
                            {r.driverName || 'Piloto'}
                          </span>
                          {r.fastestLap && (
                            <Badge className="bg-purple-600 text-white font-mono text-[9px] px-1 py-0 h-3.5">
                              FL
                            </Badge>
                          )}
                          {r.isPlayer && (
                            <Badge className="bg-[#00A6FB]/20 text-[#00A6FB] border border-[#00A6FB]/40 text-[9px] px-1 py-0 h-3.5">
                              Sua Equipe
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="font-medium" style={{ color: r.teamColor || '#8B95A7' }}>
                          {r.teamName || 'Equipe'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-num text-[#8B95A7]">
                        {r.dnf ? (
                          <span className="text-red-400 font-mono">
                            {r.dnfReason || 'Abandono'}
                          </span>
                        ) : (
                          r.totalTime ||
                          (r.position === 1 ? '1h 28m 34s' : `+${(r.position - 1) * 2.4}s`)
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-num">
                        {r.points && r.points > 0 ? (
                          <span className="font-bold text-[#22C55E]">+{r.points}</span>
                        ) : (
                          <span className="text-[#6A768A]">0</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Incidentes Registrados */}
          {incidents && incidents.length > 0 && (
            <div className="p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] space-y-1.5 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-bold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Incidentes Notificados da Etapa</span>
              </div>
              <div className="space-y-1 text-slate-300">
                {incidents.map((inc, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-400">•</span>
                    <span>{inc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Embutido de Relatório Pós-Corrida */}
      <RaceReportModal
        open={reportModalOpen}
        onOpenChange={setReportModalOpen}
        report={currentReport}
      />
    </>
  )
}
