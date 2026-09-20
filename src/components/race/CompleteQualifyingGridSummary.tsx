import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, CheckCircle2, AlertOctagon, Flag, ArrowRight } from 'lucide-react'
import type { CompleteQualifyingWeekendResult } from '@/types/canonical-qualifying-types'
import { getTeamReducedLogoUrl } from '@/lib/team-reduced-logo-resolver'

export interface CompleteQualifyingGridSummaryProps {
  result: CompleteQualifyingWeekendResult
  onGoToRace?: () => void
}

export const CompleteQualifyingGridSummary: React.FC<CompleteQualifyingGridSummaryProps> = ({
  result,
  onGoToRace,
}) => {
  const { finalGrid, poleDriverName, poleLapTime } = result

  return (
    <div className="space-y-6">
      {/* Banner de Homologação da Pole Position e Grid */}
      <Card className="bg-[#0F172A] text-white border-none shadow-md overflow-hidden rounded-2xl relative">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-[#E10600]/30 to-transparent pointer-events-none" />
        <CardContent className="p-6 relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#E10600] text-white text-[10px] font-black uppercase">
                GRID OFICIAL FIA FORMADO
              </Badge>
              <Badge
                variant="outline"
                className="text-emerald-400 border-emerald-500/40 text-[10px]"
              >
                Q1 • Q2 • Q3 HOMOLOGADOS
              </Badge>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-400" />
              Pole Position: {poleDriverName} ({poleLapTime})
            </h2>
            <p className="text-xs text-slate-300">
              O grid oficial P1–P24 está composto conforme o regulamento esportivo de eliminação. A
              etapa de Corrida Principal está desbloqueada.
            </p>
          </div>

          {onGoToRace && (
            <button
              type="button"
              onClick={onGoToRace}
              className="px-5 py-2.5 rounded-xl bg-[#E10600] hover:bg-[#C00400] text-white font-black text-xs shadow-md transition-all flex items-center gap-2 shrink-0 self-start md:self-auto"
            >
              <span>AVANÇAR PARA A CORRIDA</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </CardContent>
      </Card>

      {/* Grid Oficial P1 a P24 com identificação de fase de corte */}
      <Card className="bg-white border border-[#E2E8F0] shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="py-3.5 px-4 bg-[#F8FAFC] border-b border-[#F1F5F9] flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs font-black uppercase tracking-wider text-[#0F172A]">
              Grid de Largada Oficial do Grande Prêmio (P1 – P24)
            </CardTitle>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Composição: P1–P10 (Q3) • P11–P18 (Eliminados no Q2) • P19–P24 (Eliminados no Q1)
            </p>
          </div>
          <Badge className="bg-[#059669] text-white text-[10px] font-bold">24 CARROS</Badge>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#F1F5F9] text-[#64748B] uppercase tracking-wider bg-[#F8FAFC]/50 text-[10px]">
                  <th className="py-2.5 px-3 w-12 text-center">Grid</th>
                  <th className="py-2.5 px-3">Piloto</th>
                  <th className="py-2.5 px-3">Equipe</th>
                  <th className="py-2.5 px-3 text-center">Fase</th>
                  <th className="py-2.5 px-3">Melhor Tempo</th>
                  <th className="py-2.5 px-3">Q1</th>
                  <th className="py-2.5 px-3">Q2</th>
                  <th className="py-2.5 px-3">Q3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {finalGrid.map((row) => {
                  const logoUrl = getTeamReducedLogoUrl(row.teamName || row.teamId)

                  return (
                    <tr
                      key={`grid_${row.gridPosition}_${row.driverId}`}
                      className={`transition-colors ${
                        row.isPlayer
                          ? 'bg-red-50/70 hover:bg-red-50 font-bold border-l-4 border-l-[#E10600]'
                          : 'hover:bg-slate-50 text-[#0F172A]'
                      }`}
                    >
                      {/* Posição no Grid */}
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold text-[11px] ${
                            row.gridPosition === 1
                              ? 'bg-amber-400 text-black shadow-xs'
                              : row.gridPosition <= 3
                                ? 'bg-slate-200 text-[#0F172A]'
                                : row.gridPosition <= 10
                                  ? 'bg-slate-100 text-[#334155]'
                                  : 'bg-slate-50 text-[#64748B]'
                          }`}
                        >
                          P{row.gridPosition}
                        </span>
                      </td>

                      {/* Piloto */}
                      <td className="py-2 px-3 font-sans">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={
                              row.isPlayer
                                ? 'text-[#0F172A] font-extrabold'
                                : 'text-[#1E293B] font-medium'
                            }
                          >
                            {row.driverName}
                          </span>
                          {row.isPlayer && (
                            <Badge className="bg-[#E10600] text-white text-[9px] px-1 py-0 h-4 uppercase font-black tracking-tight">
                              Sua Equipe
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Equipe com Logo Reduzida Canônica */}
                      <td className="py-2 px-3 font-sans">
                        <div className="flex items-center gap-2">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={row.teamName}
                              className="w-5 h-5 rounded-sm object-contain bg-white border border-[#E2E8F0] p-0.5 shrink-0"
                            />
                          ) : (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: row.teamColor || '#94A3B8' }}
                            />
                          )}
                          <span
                            className="truncate max-w-[120px] text-xs font-semibold"
                            style={{ color: row.teamColor }}
                          >
                            {row.teamName}
                          </span>
                        </div>
                      </td>

                      {/* Fase em que o tempo foi consolidado */}
                      <td className="py-2 px-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            row.eliminationStage === 'Q3'
                              ? 'border-emerald-500/40 text-emerald-700 bg-emerald-50'
                              : row.eliminationStage === 'Q2'
                                ? 'border-amber-500/40 text-amber-700 bg-amber-50'
                                : 'border-rose-500/40 text-rose-700 bg-rose-50'
                          }`}
                        >
                          {row.eliminationStage}
                        </Badge>
                      </td>

                      {/* Melhor Volta */}
                      <td className="py-2 px-3 font-bold text-[#0F172A]">
                        {row.bestLapTime || '--:--.---'}
                      </td>

                      {/* Q1 */}
                      <td className="py-2 px-3 text-[#64748B]">{row.q1LapTime || '-'}</td>

                      {/* Q2 */}
                      <td className="py-2 px-3 text-[#64748B]">{row.q2LapTime || '-'}</td>

                      {/* Q3 */}
                      <td className="py-2 px-3 text-[#64748B]">{row.q3LapTime || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
