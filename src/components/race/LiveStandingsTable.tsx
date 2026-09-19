import React, { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Trophy, ArrowUp, ArrowDown, Minus, Timer, Users, ChevronDown, Info } from 'lucide-react'
import type { SimDriverEntry } from '@/pages/race/types'
import { TIRE_SPECS, isTireInCliff } from '@/lib/f1-tire-system'

export interface LapRecord {
  lap: number
  driverId: string
  lapTimeSec: number
  lapTimeFormatted: string
}

interface LiveStandingsTableProps {
  grid: SimDriverEntry[]
  currentLap: number
  totalLaps: number
  playerDriverIds: string[]
  lapHistory: Record<string, LapRecord[]> // driverId -> array of laps
  selectedCompareDriverId: string | null
  onSelectCompareDriverId: (driverId: string) => void
  onSelectRowDriver?: (driverId: string) => void
}

export const LiveStandingsTable: React.FC<LiveStandingsTableProps> = ({
  grid,
  currentLap,
  totalLaps,
  playerDriverIds,
  lapHistory,
  selectedCompareDriverId,
  onSelectCompareDriverId,
  onSelectRowDriver,
}) => {
  const [showAllLaps, setShowAllLaps] = useState<boolean>(false)

  // Identificar os dois pilotos do jogador
  const playerCars = useMemo(() => {
    return grid.filter((g) => g.isPlayer)
  }, [grid])

  const p1Car = playerCars[0] || null
  const p2Car = playerCars[1] || null

  // Piloto extra selecionado para comparação (se houver e não for P1 ou P2)
  const compareCar = useMemo(() => {
    if (!selectedCompareDriverId) return null
    if (
      selectedCompareDriverId === p1Car?.driverId ||
      selectedCompareDriverId === p2Car?.driverId
    ) {
      return null
    }
    return grid.find((g) => g.driverId === selectedCompareDriverId) || null
  }, [grid, selectedCompareDriverId, p1Car, p2Car])

  // Lista de voltas completadas para a tabela de tempos por volta
  const lapNumbers = useMemo(() => {
    const lapsSet = new Set<number>()
    Object.values(lapHistory).forEach((records) => {
      records.forEach((r) => lapsSet.add(r.lap))
    })
    const arr = Array.from(lapsSet).sort((a, b) => b - a) // Mais recentes primeiro
    if (!showAllLaps) {
      return arr.slice(0, 10)
    }
    return arr
  }, [lapHistory, showAllLaps])

  return (
    <div className="space-y-4">
      {/* 1. TABELA PRINCIPAL DE CLASSIFICAÇÃO AO VIVO (Fundo claro motorsport, Anexo A) */}
      <Card className="bg-white border border-slate-200/90 shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="py-2.5 px-3.5 bg-slate-50 border-b border-slate-200 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-3.5 rounded-full bg-[#E10600]" />
            <CardTitle className="text-xs font-black text-slate-900 tracking-wider uppercase">
              Classificação ao Vivo
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
              V {currentLap}/{totalLaps}
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {grid.filter((g) => !g.dnf).length} em pista
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-y-auto overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-sm border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-2 px-2 text-center w-10">Pos</th>
                  <th
                    className="py-2 px-1 text-center w-9"
                    title="Variação em relação à posição de largada"
                  >
                    Var
                  </th>
                  <th className="py-2 px-3">Piloto</th>
                  <th className="py-2 px-2 hidden sm:table-cell">Equipe</th>
                  <th className="py-2 px-1.5 text-center">Pneu</th>
                  <th className="py-2 px-1 text-center" title="Paradas nos Boxes">
                    Box
                  </th>
                  <th className="py-2 px-2 text-right">Última Volta</th>
                  <th className="py-2 px-2 text-right">Gap Líder</th>
                  <th className="py-2 px-2 text-right">Intervalo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {grid.map((entry) => {
                  const isPlayerCar = entry.isPlayer || playerDriverIds.includes(entry.driverId)
                  const gridPos = entry.gridPosition || entry.position
                  const posChange = gridPos - entry.position // Positivo = ganhou posições

                  // Formatação de composto de pneu
                  const compSpec = TIRE_SPECS[entry.tireCompound || 'medio'] || TIRE_SPECS.medio
                  const compLetter =
                    entry.tireCompound === 'duro'
                      ? 'D'
                      : entry.tireCompound === 'medio'
                        ? 'M'
                        : entry.tireCompound === 'macio'
                          ? 'S'
                          : entry.tireCompound === 'intermediario'
                            ? 'I'
                            : 'W'

                  const compBadgeColor =
                    entry.tireCompound === 'duro'
                      ? 'bg-slate-100 text-slate-900 border-slate-300'
                      : entry.tireCompound === 'medio'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : entry.tireCompound === 'macio'
                          ? 'bg-red-100 text-red-700 border-red-300'
                          : entry.tireCompound === 'intermediario'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-blue-100 text-blue-800 border-blue-300'

                  const lapsOnTire = entry.lapsOnCurrentTire || 0
                  const isCliff =
                    Boolean(entry.cliffStatus && entry.cliffStatus.isCliffReached > 0) ||
                    isTireInCliff(
                      entry.tireCompound || 'medio',
                      lapsOnTire,
                      entry.wearMultiplier || 1.0,
                      6,
                    ).inCliff

                  return (
                    <tr
                      key={entry.driverId}
                      onClick={() => {
                        onSelectCompareDriverId(entry.driverId)
                        onSelectRowDriver?.(entry.driverId)
                      }}
                      className={`cursor-pointer transition-colors ${
                        isPlayerCar
                          ? 'bg-red-50/80 hover:bg-red-100/70 font-semibold'
                          : entry.dnf
                            ? 'bg-slate-50/70 opacity-60 hover:bg-slate-100'
                            : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Posição */}
                      <td className="py-2 px-2 text-center relative">
                        {isPlayerCar && (
                          <span className="absolute left-0 top-0 bottom-0 w-[3.5px] bg-[#E10600]" />
                        )}
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded font-mono text-[11px] font-black ${
                            entry.dnf
                              ? 'bg-slate-200 text-slate-600'
                              : entry.position === 1
                                ? 'bg-amber-400 text-slate-950 shadow-xs'
                                : entry.position === 2
                                  ? 'bg-slate-300 text-slate-900'
                                  : entry.position === 3
                                    ? 'bg-amber-600 text-white'
                                    : 'text-slate-800 bg-slate-100'
                          }`}
                        >
                          {entry.dnf ? 'DNF' : entry.position}
                        </span>
                      </td>

                      {/* Variação vs Largada com Tooltip */}
                      <td className="py-2 px-1 text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center justify-center gap-0.5 text-[10px] font-mono font-bold cursor-help">
                                {entry.dnf ? (
                                  <Minus className="w-3 h-3 text-slate-400" />
                                ) : posChange > 0 ? (
                                  <span className="text-emerald-600 flex items-center">
                                    <ArrowUp className="w-2.5 h-2.5" />
                                    {posChange}
                                  </span>
                                ) : posChange < 0 ? (
                                  <span className="text-red-500 flex items-center">
                                    <ArrowDown className="w-2.5 h-2.5" />
                                    {Math.abs(posChange)}
                                  </span>
                                ) : (
                                  <Minus className="w-3 h-3 text-slate-400" />
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs bg-slate-900 text-white">
                              Largou em P{gridPos} • Posição atual:{' '}
                              {entry.dnf ? 'DNF' : `P${entry.position}`}
                              {posChange !== 0 &&
                                ` (${posChange > 0 ? `+${posChange}` : posChange} posições)`}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>

                      {/* Piloto */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span
                            className="w-1.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: entry.teamColor || '#94A3B8' }}
                          />
                          <span
                            className={`truncate text-xs ${isPlayerCar ? 'font-black text-slate-950' : 'font-semibold text-slate-900'}`}
                          >
                            {entry.driverName}
                          </span>
                          {isPlayerCar && (
                            <Badge className="bg-[#E10600] text-white text-[9px] px-1 py-0 rounded font-black uppercase shrink-0">
                              NÓS
                            </Badge>
                          )}
                          {isCliff && (
                            <Badge className="bg-red-500 text-white text-[9px] px-1 py-0 rounded font-bold shrink-0 animate-pulse">
                              CLIFF
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Equipe */}
                      <td className="py-2 px-2 hidden sm:table-cell">
                        <span className="text-[11px] text-slate-500 truncate block max-w-[120px]">
                          {entry.teamName}
                        </span>
                      </td>

                      {/* Pneu */}
                      <td className="py-2 px-1.5 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-mono text-[9px] font-black border ${compBadgeColor}`}
                          title={`${compSpec.name} (${entry.tireWear || 0}% desg.)`}
                        >
                          {compLetter}
                        </span>
                      </td>

                      {/* Pit Stops Realizados */}
                      <td className="py-2 px-1 text-center font-mono text-[11px] text-slate-600">
                        {entry.pitStopsDone !== undefined ? entry.pitStopsDone : '0'}
                      </td>

                      {/* Última Volta */}
                      <td className="py-2 px-2 text-right font-mono text-[11px] tabular-nums text-slate-700">
                        {currentLap <= 1 && !entry.lastLapTime
                          ? '—'
                          : entry.lastLapTime ||
                            (entry.lastLapTimeSec ? `${entry.lastLapTimeSec.toFixed(3)}s` : '—')}
                      </td>

                      {/* Gap Líder */}
                      <td className="py-2 px-2 text-right font-mono text-[11px] tabular-nums font-semibold">
                        {entry.dnf ? (
                          <span className="text-red-600 font-bold">ABANDONO</span>
                        ) : entry.position === 1 ? (
                          <span className="font-black text-amber-700">LÍDER</span>
                        ) : currentLap <= 1 ? (
                          '—'
                        ) : (
                          <span className="text-slate-900">{entry.gapToLeader || '—'}</span>
                        )}
                      </td>

                      {/* Intervalo / Gap Frente */}
                      <td className="py-2 px-2 text-right font-mono text-[11px] tabular-nums text-slate-600">
                        {entry.dnf
                          ? '—'
                          : entry.position === 1
                            ? '—'
                            : currentLap <= 1
                              ? '—'
                              : entry.gapToFront || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 2. QUADRO "TEMPOS POR VOLTA — NOSSOS PILOTOS" (Com Seletor de Comparação) */}
      <Card className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="py-3 px-4 bg-slate-50/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-[#E10600]" />
            <div>
              <CardTitle className="text-xs font-bold text-slate-900 tracking-wide uppercase">
                Tempos por Volta — Nossos Pilotos
              </CardTitle>
              <p className="text-[10px] text-slate-500">
                Histórico volta a volta de telemetria dos dois carros
                {compareCar ? ` e comparação com ${compareCar.driverName}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Seletor de outro competidor para comparar */}
            <div className="flex items-center gap-1.5 text-xs">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedCompareDriverId || ''}
                onChange={(e) => onSelectCompareDriverId(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                <option value="">Comparar com rival...</option>
                {grid
                  .filter((g) => !g.isPlayer)
                  .map((g) => (
                    <option key={g.driverId} value={g.driverId}>
                      P{g.position} {g.driverName} ({g.teamName})
                    </option>
                  ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowAllLaps(!showAllLaps)}
              className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded px-2 py-1 transition-colors"
            >
              {showAllLaps ? 'Últimas 10' : 'Todas as voltas'}
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {lapNumbers.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              <p className="font-medium text-slate-700">Aguardando registro da primeira volta</p>
              <p className="text-[11px] mt-0.5">
                Os tempos completos de volta e deltas de P1 vs P2 aparecerão ao término da volta 1.
              </p>
            </div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-semibold tracking-wider">
                  <tr>
                    <th className="py-2 px-3 w-14">Volta</th>
                    <th className="py-2 px-3 text-right">
                      {p1Car?.driverName ? `${p1Car.driverName} (P1)` : 'Carro 1'}
                    </th>
                    <th className="py-2 px-3 text-right">
                      {p2Car?.driverName ? `${p2Car.driverName} (P2)` : 'Carro 2'}
                    </th>
                    <th className="py-2 px-3 text-right">
                      <span className="flex items-center justify-end gap-1">
                        Delta (P1−P2)
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3 h-3 text-slate-400 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="text-xs bg-slate-900 text-white">
                              Tempo P1 menos tempo P2. Negativo indica P1 mais rápido nesta volta.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </span>
                    </th>
                    {compareCar && (
                      <th className="py-2 px-3 text-right text-slate-900 bg-amber-50">
                        {compareCar.driverName}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-mono text-[11px]">
                  {lapNumbers.map((lapNum) => {
                    const p1Lap = p1Car
                      ? lapHistory[p1Car.driverId]?.find((r) => r.lap === lapNum)
                      : null
                    const p2Lap = p2Car
                      ? lapHistory[p2Car.driverId]?.find((r) => r.lap === lapNum)
                      : null
                    const compLap = compareCar
                      ? lapHistory[compareCar.driverId]?.find((r) => r.lap === lapNum)
                      : null

                    let deltaFormatted = '—'
                    let deltaColor = 'text-slate-500'

                    if (p1Lap && p2Lap) {
                      const deltaSec = p1Lap.lapTimeSec - p2Lap.lapTimeSec
                      deltaFormatted = `${deltaSec >= 0 ? '+' : ''}${deltaSec.toFixed(3)}s`
                      deltaColor =
                        deltaSec < 0
                          ? 'text-emerald-600 font-semibold'
                          : 'text-amber-600 font-semibold'
                    }

                    return (
                      <tr key={lapNum} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-semibold text-slate-600">V{lapNum}</td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {p1Lap?.lapTimeFormatted ||
                            (p1Lap?.lapTimeSec ? `${p1Lap.lapTimeSec.toFixed(3)}s` : '—')}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {p2Lap?.lapTimeFormatted ||
                            (p2Lap?.lapTimeSec ? `${p2Lap.lapTimeSec.toFixed(3)}s` : '—')}
                        </td>
                        <td className={`py-2 px-3 text-right tabular-nums ${deltaColor}`}>
                          {deltaFormatted}
                        </td>
                        {compareCar && (
                          <td className="py-2 px-3 text-right tabular-nums bg-amber-50/50 font-medium">
                            {compLap?.lapTimeFormatted ||
                              (compLap?.lapTimeSec ? `${compLap.lapTimeSec.toFixed(3)}s` : '—')}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
