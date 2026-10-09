import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getTeamReducedLogoUrl } from '@/lib/team-reduced-logo-resolver'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'

import type { CanonicalRaceDriverState } from '@/types/canonical-race-v2'

export interface RaceTopTenBoardProps {
  finalGrid?: FinalQualifyingGridEntry[]
  canonicalDrivers?: CanonicalRaceDriverState[]
  playerDriverIds: string[]
}

function getTyreBadge(compound: string) {
  const c = (compound || 'medio').toLowerCase()
  if (c.includes('macio') || c === 'soft') {
    return { symbol: 'S', color: 'text-red-400 border-red-500/80 bg-red-950/40' }
  }
  if (c.includes('duro') || c === 'hard') {
    return { symbol: 'H', color: 'text-slate-200 border-slate-400/80 bg-slate-900/60' }
  }
  if (c.includes('inter') || c === 'intermediate') {
    return { symbol: 'I', color: 'text-emerald-400 border-emerald-500/80 bg-emerald-950/40' }
  }
  if (c.includes('chuva') || c === 'wet') {
    return { symbol: 'W', color: 'text-blue-400 border-blue-500/80 bg-blue-950/40' }
  }
  return { symbol: 'M', color: 'text-yellow-400 border-yellow-500/80 bg-yellow-950/40' }
}

export const RaceTopTenBoard: React.FC<RaceTopTenBoardProps> = ({
  finalGrid = [],
  canonicalDrivers,
  playerDriverIds,
}) => {
  const isLive = Boolean(canonicalDrivers && canonicalDrivers.length > 0)

  // Se canonicalDrivers for fornecido, ordena por currentPosition e pega os 10 primeiros
  const top10Canonical = isLive
    ? [...(canonicalDrivers || [])]
        .sort((a, b) => a.currentPosition - b.currentPosition)
        .slice(0, 10)
    : []

  const top10Grid = !isLive ? finalGrid.slice(0, 10) : []

  return (
    <Card className="bg-[#0D1524] border border-[#1E293B] rounded-xl overflow-hidden shadow-lg">
      <CardHeader className="py-2.5 px-3.5 bg-[#090E1A] border-b border-[#1E293B] flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-400'}`}
            />
            Classificação — TOP 10
          </CardTitle>
          <span className="text-[10px] text-slate-400 font-mono">
            {isLive ? 'Tempo real da prova' : 'Grid oficial pré-largada'}
          </span>
        </div>
        <Badge className="bg-[#1E293B] text-slate-300 border border-slate-700 text-[10px] font-mono">
          P1–P10
        </Badge>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1E293B] text-slate-400 uppercase text-[9px] bg-[#090E1A]/40 tracking-wider">
                <th className="py-2 px-2.5 text-center w-10">POS</th>
                <th className="py-2 px-2.5">PILOTO</th>
                <th className="py-2 px-2 text-center w-8">PNEU</th>
                <th className="py-2 px-2.5 text-right w-20">GRID / GAP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/60">
              {isLive
                ? top10Canonical.map((row) => {
                    const isPlayer = playerDriverIds.includes(row.driverId) || row.isPlayer
                    const logoUrl = getTeamReducedLogoUrl(row.teamName || row.teamId)
                    const tyre = getTyreBadge(row.tyreCompound || 'medio')
                    const isLeader = row.currentPosition === 1
                    const isDnf = row.raceStatus === 'dnf' || row.isDnf

                    return (
                      <tr
                        key={`top10_canonical_${row.currentPosition}_${row.driverId}`}
                        className={`transition-colors ${
                          isPlayer
                            ? 'bg-red-950/30 border-l-2 border-l-[#E10600] text-white font-bold'
                            : 'hover:bg-slate-800/40 text-slate-200'
                        }`}
                      >
                        {/* POS */}
                        <td className="py-1.5 px-2.5 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black ${
                              isDnf
                                ? 'bg-rose-900 text-rose-200'
                                : isLeader
                                  ? 'bg-amber-400 text-black'
                                  : row.currentPosition <= 3
                                    ? 'bg-slate-300 text-slate-900'
                                    : isPlayer
                                      ? 'bg-red-600 text-white'
                                      : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            P{row.currentPosition}
                          </span>
                        </td>

                        {/* PILOTO & EQUIPE */}
                        <td className="py-1.5 px-2.5">
                          <div className="flex items-center gap-1.5 truncate">
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt={row.teamName}
                                className="w-4 h-4 rounded-xs object-contain bg-slate-900 border border-slate-700/60 p-0.5 shrink-0"
                              />
                            ) : (
                              <span
                                className="w-1.5 h-3.5 rounded-full shrink-0"
                                style={{ backgroundColor: row.teamColor || '#64748B' }}
                              />
                            )}
                            <span
                              className={`truncate text-xs ${
                                isPlayer
                                  ? 'text-red-400 font-extrabold'
                                  : 'text-slate-100 font-medium'
                              }`}
                            >
                              {row.driverName}
                            </span>
                            {isPlayer && (
                              <span className="text-[9px] px-1 py-0 rounded bg-red-600 text-white font-black uppercase">
                                VOCÊ
                              </span>
                            )}
                          </div>
                        </td>

                        {/* PNEU */}
                        <td className="py-1.5 px-2 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-4 h-4 rounded-full border text-[8px] font-black ${tyre.color}`}
                            title={`${row.tyreCompound} (${row.tyreAge}v)`}
                          >
                            {tyre.symbol}
                          </span>
                        </td>

                        {/* GAP */}
                        <td className="py-1.5 px-2.5 text-right font-mono text-[11px] text-slate-300">
                          {isDnf ? (
                            <span className="text-rose-400 font-bold">ABANDONO</span>
                          ) : isLeader ? (
                            'LÍDER'
                          ) : (
                            row.gap ||
                            (row.gapToLeaderSec !== undefined
                              ? `+${row.gapToLeaderSec.toFixed(3)}s`
                              : '-')
                          )}
                        </td>
                      </tr>
                    )
                  })
                : top10Grid.map((row) => {
                    const isPlayer = playerDriverIds.includes(row.driverId) || row.isPlayer
                    const logoUrl = getTeamReducedLogoUrl(row.teamName || row.teamId)
                    const tyre = getTyreBadge(row.bestLapCompound || 'medio')

                    return (
                      <tr
                        key={`top10_${row.gridPosition}_${row.driverId}`}
                        className={`transition-colors ${
                          isPlayer
                            ? 'bg-red-950/30 border-l-2 border-l-[#E10600] text-white font-bold'
                            : 'hover:bg-slate-800/40 text-slate-200'
                        }`}
                      >
                        {/* POS */}
                        <td className="py-1.5 px-2.5 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black ${
                              row.gridPosition === 1
                                ? 'bg-amber-400 text-black'
                                : row.gridPosition <= 3
                                  ? 'bg-slate-300 text-slate-900'
                                  : isPlayer
                                    ? 'bg-red-600 text-white'
                                    : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            P{row.gridPosition}
                          </span>
                        </td>

                        {/* PILOTO & EQUIPE */}
                        <td className="py-1.5 px-2.5">
                          <div className="flex items-center gap-1.5 truncate">
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt={row.teamName}
                                className="w-4 h-4 rounded-xs object-contain bg-slate-900 border border-slate-700/60 p-0.5 shrink-0"
                              />
                            ) : (
                              <span
                                className="w-1.5 h-3.5 rounded-full shrink-0"
                                style={{ backgroundColor: row.teamColor || '#64748B' }}
                              />
                            )}
                            <span
                              className={`truncate text-xs ${
                                isPlayer
                                  ? 'text-red-400 font-extrabold'
                                  : 'text-slate-100 font-medium'
                              }`}
                            >
                              {row.driverName}
                            </span>
                            {isPlayer && (
                              <span className="text-[9px] px-1 py-0 rounded bg-red-600 text-white font-black uppercase">
                                VOCÊ
                              </span>
                            )}
                          </div>
                        </td>

                        {/* PNEU */}
                        <td className="py-1.5 px-2 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-4 h-4 rounded-full border text-[8px] font-black ${tyre.color}`}
                            title={row.bestLapCompound}
                          >
                            {tyre.symbol}
                          </span>
                        </td>

                        {/* GRID / GAP */}
                        <td className="py-1.5 px-2.5 text-right font-mono text-[11px] text-slate-300">
                          {row.gridPosition === 1
                            ? 'LÍDER'
                            : row.bestLapTime || `P${row.gridPosition}`}
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
