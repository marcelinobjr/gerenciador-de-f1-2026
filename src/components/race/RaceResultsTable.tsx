import React from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Award, ArrowRight, ShieldAlert } from 'lucide-react'
import { TireCompound } from '@/types/f1'

export interface RaceResultEntry {
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  teamColor: string
  isPlayer: boolean
  flag: string
  position: number
  points: number
  fastestLap: boolean
  dnf: boolean
  dnfReason?: string
  totalTime: string
  tireCompound?: TireCompound
  secondCompound?: TireCompound
  tireWear?: number
  oldMorale?: number
  newMorale?: number
  moraleDelta?: number
  oldPhysical?: number
  newPhysical?: number
  physicalDelta?: number
}

interface RaceResultsTableProps {
  gpName: string
  results?: RaceResultEntry[]
  raceResults?: RaceResultEntry[]
  incidents: string[]
  isFinishing: boolean
  onAdvanceRound: () => void
}

export function RaceResultsTable({
  gpName,
  results,
  raceResults,
  incidents,
  isFinishing,
  onAdvanceRound,
}: RaceResultsTableProps) {
  const actualResults = results || raceResults || []
  if (actualResults.length === 0) return null

  return (
    <div className="space-y-6">
      {/* Safety Car / Incidents alert if occurred */}
      {incidents.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-400 text-xs font-mono uppercase">
            <ShieldAlert className="w-4 h-4" /> Relatório de Incidentes & Bandeiras
          </div>
          <div className="space-y-1 text-xs text-[#F5F7FA] font-mono">
            {incidents.map((inc, i) => (
              <div key={i}>{inc}</div>
            ))}
          </div>
        </div>
      )}

      {/* Classification Table */}
      <Card className="bg-[#090D15]/85 backdrop-blur-md border border-[#1A2333] shadow-xl">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#1A2333] gap-3">
          <div>
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
              HOMOLOGAÇÃO DA FEDERAÇÃO INTERNACIONAL
            </span>
            <CardTitle className="text-base font-black text-white flex items-center gap-2 mt-0.5">
              <Award className="w-5 h-5 text-amber-400" />
              Resultado Oficial do GP — {gpName}
            </CardTitle>
            <CardDescription className="text-xs text-[#8B95A7] font-mono mt-0.5">
              Desgaste de pneus acumulado, paradas nos boxes e pontos FIA atribuídos.
            </CardDescription>
          </div>

          {/* Advance Button */}
          <Button
            size="sm"
            onClick={onAdvanceRound}
            disabled={isFinishing}
            className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold px-6 shadow-lg"
          >
            {isFinishing ? 'Salvando dados...' : 'Avançar para Próxima Rodada'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1A2333] text-[#8B95A7] uppercase tracking-wider bg-[#080C14]/80 text-[10px]">
                  <th className="py-2.5 px-3">Pos</th>
                  <th className="py-2.5 px-3">Piloto</th>
                  <th className="py-2.5 px-3">Equipe</th>
                  <th className="py-2.5 px-2 text-center">Pneus (1º/2º)</th>
                  <th className="py-2.5 px-2 text-center">Desgaste</th>
                  <th className="py-2.5 px-3">Tempo / Gap</th>
                  <th className="py-2.5 px-2 text-center">Moral</th>
                  <th className="py-2.5 px-2 text-center">Física</th>
                  <th className="py-2.5 px-3 text-right">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2333]">
                {' '}
                {actualResults.map((row) => {
                  const hasMorale = row.newMorale !== undefined && row.oldMorale !== undefined
                  const mDelta =
                    row.moraleDelta ?? (hasMorale ? row.newMorale! - row.oldMorale! : 0)
                  const hasPhysical = row.newPhysical !== undefined && row.oldPhysical !== undefined
                  const pDelta =
                    row.physicalDelta ?? (hasPhysical ? row.newPhysical! - row.oldPhysical! : 0)

                  return (
                    <tr
                      key={row.driverId}
                      className={`transition-colors ${
                        row.isPlayer
                          ? 'bg-[#E10600]/10 font-bold border-l-4 border-l-[#E10600]'
                          : 'hover:bg-[#161D29]/40'
                      }`}
                    >
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold ${
                            row.position === 1
                              ? 'bg-amber-400 text-black'
                              : row.position === 2
                                ? 'bg-slate-300 text-black'
                                : row.position === 3
                                  ? 'bg-amber-700 text-white'
                                  : 'text-[#8B95A7]'
                          }`}
                        >
                          {row.dnf ? 'DNF' : row.position}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span>{row.flag}</span>
                          <span
                            className={row.isPlayer ? 'text-[#F5F7FA] font-bold' : 'text-[#F5F7FA]'}
                          >
                            {row.driverName}
                          </span>
                          {row.fastestLap && (
                            <Badge
                              className="bg-purple-600 text-white text-[9px] px-1 py-0 h-4"
                              title="Volta Mais Rápida"
                            >
                              FL
                            </Badge>
                          )}
                        </div>
                        {row.dnfReason && (
                          <span className="text-[10px] text-red-400 block mt-0.5 font-normal">
                            {row.dnfReason}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span style={{ color: row.teamColor }}>{row.teamName}</span>
                      </td>
                      <td className="py-3 px-2 text-center text-[#8B95A7]">
                        {row.tireCompound?.slice(0, 3)} / {row.secondCompound?.slice(0, 3)}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`font-bold ${
                            (row.tireWear || 0) > 85
                              ? 'text-red-400'
                              : (row.tireWear || 0) > 65
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                          }`}
                        >
                          {row.tireWear || 70}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#8B95A7]">{row.totalTime}</td>
                      <td className="py-3 px-2 text-center">
                        {hasMorale ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-white font-semibold">{row.newMorale}</span>
                            <span
                              className={`text-[10px] font-bold ${
                                mDelta > 0
                                  ? 'text-emerald-400'
                                  : mDelta < 0
                                    ? 'text-red-400'
                                    : 'text-zinc-400'
                              }`}
                            >
                              ({mDelta > 0 ? `+${mDelta}` : mDelta})
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#8B95A7]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {hasPhysical ? (
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className={`font-semibold ${
                                (row.newPhysical ?? 100) < 40 ? 'text-amber-400' : 'text-white'
                              }`}
                            >
                              {row.newPhysical}%
                            </span>
                            <span
                              className={`text-[10px] font-bold ${
                                pDelta > 0
                                  ? 'text-emerald-400'
                                  : pDelta < 0
                                    ? 'text-red-400'
                                    : 'text-zinc-400'
                              }`}
                            >
                              ({pDelta > 0 ? `+${pDelta}` : pDelta})
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#8B95A7]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {row.points > 0 ? (
                          <strong className="text-emerald-400 font-bold text-sm">
                            +{row.points}
                          </strong>
                        ) : (
                          <span className="text-[#8B95A7]">0</span>
                        )}
                      </td>
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
