import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Timer, ArrowUp, ArrowDown, User } from 'lucide-react'
import type { PracticeTimeEntry } from '@/types/practice-session'
import type { TireCompound } from '@/types/f1'

interface PracticeLeaderboardTableProps {
  entries: PracticeTimeEntry[]
  playerTeamName?: string
  playerTeamColor?: string
}

const TIRE_COLORS: Record<TireCompound, { bg: string; text: string; label: string }> = {
  macio: { bg: 'bg-red-500/20', text: 'text-red-400 border-red-500/40', label: 'S' },
  medio: { bg: 'bg-amber-500/20', text: 'text-amber-400 border-amber-500/40', label: 'M' },
  duro: { bg: 'bg-slate-500/20', text: 'text-slate-300 border-slate-500/40', label: 'H' },
  intermediario: { bg: 'bg-green-500/20', text: 'text-green-400 border-green-500/40', label: 'I' },
  chuva_extrema: { bg: 'bg-blue-500/20', text: 'text-blue-400 border-blue-500/40', label: 'W' },
}

export const PracticeLeaderboardTable: React.FC<PracticeLeaderboardTableProps> = ({
  entries,
  playerTeamName,
  playerTeamColor = '#00A6FB',
}) => {
  return (
    <Card className="p-4 bg-[#090D15]/90 border border-[#1F2733] rounded-2xl shadow-xl space-y-3 font-mono">
      <div className="flex items-center justify-between border-b border-[#1A2333] pb-2.5">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
            Tabela de Tempos do Treino
          </h3>
        </div>
        <span className="text-[10px] text-[#8B95A7]">
          Ordenada pela melhor marca válida • Tempo de Sessão
        </span>
      </div>

      <div className="overflow-x-auto max-h-[580px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#1F2733]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#1A2333] text-[10px] uppercase text-[#8B95A7] tracking-wider">
              <th className="py-2 px-2 text-center w-10">Pos</th>
              <th className="py-2 px-2">Piloto</th>
              <th className="py-2 px-2">Equipe</th>
              <th className="py-2 px-1 text-center w-12">Pneu</th>
              <th className="py-2 px-2 text-center w-14">Voltas</th>
              <th className="py-2 px-2 text-right">Melhor Volta</th>
              <th className="py-2 px-2 text-right">Dif.</th>
              <th className="py-2 px-2 text-right">Última Volta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141B26]">
            {entries.map((entry) => {
              const isPlayer = !!entry.isPlayer
              const tyreConfig = TIRE_COLORS[entry.compound] || TIRE_COLORS.medio

              return (
                <tr
                  key={entry.driverId}
                  className={`transition-colors text-xs ${
                    isPlayer
                      ? 'bg-cyan-950/30 hover:bg-cyan-950/50 font-bold'
                      : 'hover:bg-[#0E1521]/60'
                  }`}
                >
                  <td className="py-2 px-2 text-center font-bold">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] ${
                        entry.position === 1
                          ? 'bg-amber-400/20 text-amber-300 font-black'
                          : entry.position <= 3
                            ? 'bg-slate-400/20 text-slate-200 font-bold'
                            : isPlayer
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'text-[#8B95A7]'
                      }`}
                    >
                      {entry.position}
                    </span>
                  </td>

                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-3.5 rounded-full"
                        style={{ backgroundColor: entry.teamColor || '#888' }}
                      />
                      <span className={isPlayer ? 'text-cyan-300 font-bold' : 'text-white'}>
                        {entry.driverName}
                      </span>
                      {entry.isRookie && (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[8px] font-black px-1 py-0 h-3.5 tracking-wider">
                          ROOKIE
                        </Badge>
                      )}
                      {isPlayer && (
                        <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-400/30 text-[9px] px-1 py-0 h-4">
                          {entry.carId === 'car1' ? 'Carro 1' : 'Carro 2'}
                        </Badge>
                      )}
                    </div>
                  </td>

                  <td className="py-2 px-2 text-[#8B95A7] text-[11px] truncate max-w-[120px]">
                    {entry.teamName}
                  </td>

                  <td className="py-2 px-1 text-center">
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-black px-1.5 py-0 border ${tyreConfig.bg} ${tyreConfig.text}`}
                    >
                      {tyreConfig.label}
                    </Badge>
                  </td>

                  <td className="py-2 px-2 text-center text-[#BAC4D6] font-bold">
                    {entry.laps || 0}
                  </td>

                  <td className="py-2 px-2 text-right">
                    <span
                      className={`font-mono text-xs ${
                        entry.bestLapTime !== '--:--.---'
                          ? entry.position === 1
                            ? 'text-purple-400 font-black'
                            : isPlayer
                              ? 'text-cyan-300 font-bold'
                              : 'text-white font-semibold'
                          : 'text-[#525E75]'
                      }`}
                    >
                      {entry.bestLapTime}
                    </span>
                  </td>

                  <td className="py-2 px-2 text-right text-[11px] font-mono text-[#8B95A7]">
                    {entry.gap}
                  </td>

                  <td className="py-2 px-2 text-right text-[11px] font-mono text-[#BAC4D6]">
                    {entry.lastLapTime || '--:--.---'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
