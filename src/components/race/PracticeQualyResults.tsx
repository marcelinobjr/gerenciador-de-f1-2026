import React from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock } from 'lucide-react'
import { TireCompound } from '@/types/f1'

export interface SessionResultRow {
  position: number
  driverId: string
  driverName: string
  teamName: string
  teamColor: string
  lapTime: string
  gap: string
  tire: TireCompound
  isPlayer: boolean
  isEliminated?: boolean
  eliminatedInSession?: 'q1' | 'q2'
}

interface PracticeQualyResultsProps {
  sessionKey: string
  circuitName?: string
  circuit?: string
  results: SessionResultRow[]
}

export function PracticeQualyResults({
  sessionKey,
  circuitName,
  circuit,
  results,
}: PracticeQualyResultsProps) {
  if (!results || results.length === 0) return null
  const displayedCircuit = circuitName || circuit || 'Circuito'

  return (
    <Card className="bg-[#090D15]/85 backdrop-blur-md border border-[#1A2333] shadow-xl">
      <CardHeader className="pb-3 border-b border-[#1A2333] flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            Tabela de Tempos Oficiais — {sessionKey.toUpperCase()}
          </CardTitle>
          <CardDescription className="text-xs text-[#8B95A7]">
            Classificação após voltas rápidas completadas no {displayedCircuit}
          </CardDescription>
        </div>
        <Badge
          variant="outline"
          className="border-emerald-500/40 text-emerald-400 font-mono text-xs"
        >
          Sessão Finalizada
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1A2333] text-[#8B95A7] uppercase tracking-wider bg-[#080C14]/80 text-[10px]">
                <th className="py-2 px-3 w-12">Pos</th>
                <th className="py-2 px-3">Piloto</th>
                <th className="py-2 px-3">Escuderia</th>
                <th className="py-2 px-3">Pneu</th>
                <th className="py-2 px-3">Melhor Volta</th>
                <th className="py-2 px-3 text-right">Diferença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A2333]">
              {results.map((row) => (
                <tr
                  key={`${row.position}_${row.driverId}`}
                  className={`transition-colors ${
                    row.isEliminated
                      ? 'opacity-60 bg-red-950/20'
                      : row.isPlayer
                        ? 'bg-[#E10600]/10 font-bold border-l-4 border-l-[#E10600]'
                        : 'hover:bg-[#161D29]/40'
                  }`}
                >
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold ${
                        row.position === 1
                          ? 'bg-amber-400 text-black'
                          : row.position <= 3
                            ? 'bg-slate-300 text-black'
                            : row.isEliminated
                              ? 'bg-red-900/60 text-red-200'
                              : 'text-[#8B95A7]'
                      }`}
                    >
                      {row.position}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={row.isPlayer ? 'text-[#F5F7FA] font-bold' : 'text-[#F5F7FA]'}
                      >
                        {row.driverName}
                      </span>
                      {row.isPlayer && (
                        <Badge className="bg-[#E10600] text-white text-[9px] px-1 py-0 h-3.5">
                          Sua Equipe
                        </Badge>
                      )}
                      {row.isEliminated && (
                        <Badge
                          variant="destructive"
                          className="text-[9px] px-1.5 py-0 h-3.5 bg-red-800 text-red-200"
                        >
                          Eliminado {row.eliminatedInSession?.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span style={{ color: row.teamColor }}>{row.teamName}</span>
                  </td>
                  <td className="py-2.5 px-3 text-capitalize text-[#8B95A7]">{row.tire}</td>
                  <td className="py-2.5 px-3 text-[#00A6FB]">{row.lapTime}</td>
                  <td className="py-2.5 px-3 text-right text-[#8B95A7]">
                    {row.isEliminated ? (
                      <span className="text-red-400 text-[10px]">CORTE FIA</span>
                    ) : (
                      row.gap
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
