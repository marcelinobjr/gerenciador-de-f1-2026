import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, Wrench, Eye, EyeOff } from 'lucide-react'

export interface LapHistoryEntry {
  lap: number
  driverId: string
  driverName: string
  teamName: string
  teamColor: string
  isPlayer: boolean
  position: number
  dnf: boolean
  didPit?: boolean
}

export interface LapHistorySnapshot {
  lap: number
  positions: {
    driverId: string
    driverName: string
    teamName: string
    teamColor: string
    isPlayer: boolean
    position: number
    dnf: boolean
    didPit?: boolean
  }[]
}

interface LapEvolutionChartProps {
  history: LapHistorySnapshot[]
  totalLaps: number
  playerDriverIds?: string[]
}

export function LapEvolutionChart({
  history,
  totalLaps,
  playerDriverIds = [],
}: LapEvolutionChartProps) {
  // Coletar todos os pilotos únicos
  const driversList = useMemo(() => {
    const map = new Map<
      string,
      {
        driverId: string
        driverName: string
        teamName: string
        teamColor: string
        isPlayer: boolean
      }
    >()
    history.forEach((snap) => {
      snap.positions.forEach((p) => {
        if (!map.has(p.driverId)) {
          map.set(p.driverId, {
            driverId: p.driverId,
            driverName: p.driverName,
            teamName: p.teamName,
            teamColor: p.teamColor,
            isPlayer: p.isPlayer,
          })
        }
      })
    })
    return Array.from(map.values())
  }, [history])

  // Pilotos selecionados para destaque (inicialmente os pilotos do jogador pré-selecionados)
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>(() => {
    if (playerDriverIds.length > 0) return playerDriverIds
    return []
  })

  // Se nada selecionado por padrão, pré-selecionar os isPlayer
  React.useEffect(() => {
    if (selectedDriverIds.length === 0 && driversList.length > 0) {
      const playerIds = driversList.filter((d) => d.isPlayer).map((d) => d.driverId)
      if (playerIds.length > 0) {
        setSelectedDriverIds(playerIds)
      }
    }
  }, [driversList])

  const toggleDriverSelection = (driverId: string) => {
    setSelectedDriverIds((prev) =>
      prev.includes(driverId) ? prev.filter((id) => id !== driverId) : [...prev, driverId],
    )
  }

  const selectAll = () => {
    setSelectedDriverIds(driversList.map((d) => d.driverId))
  }

  const selectOnlyPlayer = () => {
    setSelectedDriverIds(driversList.filter((d) => d.isPlayer).map((d) => d.driverId))
  }

  // Dimensões do SVG
  const width = 920
  const height = 480
  const padding = { top: 30, right: 60, bottom: 45, left: 45 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Eixo X: voltas 1 até max(totalLaps, maxLapNaHistoria)
  const maxLap = Math.max(totalLaps || 1, history.length > 0 ? history[history.length - 1].lap : 1)

  const getX = (lap: number) => {
    if (maxLap <= 1) return padding.left
    return padding.left + ((lap - 1) / (maxLap - 1)) * chartWidth
  }

  // Eixo Y: posições 1 a 24 (invertido: P1 no topo)
  const getY = (position: number) => {
    const clamped = Math.max(1, Math.min(24, position))
    return padding.top + ((clamped - 1) / 23) * chartHeight
  }

  // Agrupar dados por piloto para traçar as linhas
  const driverSeries = useMemo(() => {
    const seriesMap = new Map<
      string,
      {
        driverId: string
        driverName: string
        teamName: string
        teamColor: string
        isPlayer: boolean
        points: { lap: number; position: number; dnf: boolean; didPit?: boolean }[]
      }
    >()

    history.forEach((snap) => {
      snap.positions.forEach((p) => {
        if (!seriesMap.has(p.driverId)) {
          seriesMap.set(p.driverId, {
            driverId: p.driverId,
            driverName: p.driverName,
            teamName: p.teamName,
            teamColor: p.teamColor,
            isPlayer: p.isPlayer,
            points: [],
          })
        }
        seriesMap.get(p.driverId)!.points.push({
          lap: snap.lap,
          position: p.position,
          dnf: p.dnf,
          didPit: p.didPit,
        })
      })
    })

    return Array.from(seriesMap.values())
  }, [history])

  // Posições de referência no Eixo Y (P1, P5, P10, P15, P20, P24)
  const yTicks = [1, 5, 10, 15, 20, 24]

  // Ticks no Eixo X a cada 5 ou 10 voltas
  const xStep = maxLap > 40 ? 10 : maxLap > 20 ? 5 : 2
  const xTicks: number[] = []
  for (let l = 1; l <= maxLap; l += xStep) {
    xTicks.push(l)
  }
  if (!xTicks.includes(maxLap)) {
    xTicks.push(maxLap)
  }

  if (history.length === 0) {
    return (
      <Card className="bg-[#11161F] border-[#1F2733]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            Evolução de Posições Volta a Volta (Lap Chart)
          </CardTitle>
          <CardDescription className="text-xs text-[#8B95A7]">
            O gráfico registrará a movimentação de cada carro a cada volta completada na prova.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-44 flex items-center justify-center border border-dashed border-[#1F2733] rounded-lg text-xs font-mono text-[#8B95A7]">
            Aguardando início da corrida para traçar a evolução...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-[#11161F] border-[#1F2733] shadow-xl overflow-hidden">
      <CardHeader className="py-3 px-4 bg-[#0B0E14] border-b border-[#1F2733] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base font-bold text-[#F5F7FA] font-mono flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            GRÁFICO OFICIAL DE EVOLUÇÃO VOLTA A VOLTA (LAP CHART)
          </CardTitle>
          <CardDescription className="text-xs font-mono text-[#8B95A7]">
            Traçado histórico de posições • Eixo Y invertido (P1 no topo) • Losangos amarelos
            indicam Pit Stops
          </CardDescription>
        </div>

        {/* Controles de filtro rápido */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={selectOnlyPlayer}
            className="h-7 text-[11px] font-mono border-[#E10600]/60 text-white bg-[#E10600]/20 hover:bg-[#E10600]/30"
          >
            Apenas Minha Equipe
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={selectAll}
            className="h-7 text-[11px] font-mono border-slate-700 text-slate-300 hover:text-white"
          >
            Todos os 24
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Seletor de pilotos em chips */}
        <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto p-2 bg-[#0B0E14] rounded-lg border border-[#1F2733]/80">
          <span className="text-[10px] font-mono uppercase text-[#8B95A7] mr-1 flex items-center gap-1">
            <Eye className="w-3 h-3" /> Destacar:
          </span>
          {driversList.map((d) => {
            const isSelected = selectedDriverIds.includes(d.driverId)
            return (
              <button
                key={d.driverId}
                type="button"
                onClick={() => toggleDriverSelection(d.driverId)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded transition-all border flex items-center gap-1 ${
                  isSelected
                    ? d.isPlayer
                      ? 'bg-[#E10600] text-white border-[#E10600] font-bold shadow-sm'
                      : 'bg-cyan-950/80 text-cyan-200 border-cyan-500/60 font-semibold'
                    : 'bg-[#161D29]/40 text-slate-500 border-transparent hover:border-slate-700'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: d.teamColor || '#94A3B8' }}
                />
                <span>{d.driverName}</span>
                {d.isPlayer && <span className="text-[9px] font-extrabold text-amber-300">★</span>}
              </button>
            )
          })}
        </div>

        {/* SVG do Lap Chart em Blueprint */}
        <div className="w-full overflow-x-auto bg-[#070B12] rounded-xl border border-[#1F2733] p-2 relative shadow-inner">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto min-w-[680px] select-none font-mono"
          >
            <defs>
              {/* Grade técnica Blueprint */}
              <pattern id="blueprintGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke="#162235"
                  strokeWidth="0.5"
                  strokeOpacity="0.45"
                />
              </pattern>
              {/* Gradiente sutil para fundo */}
              <linearGradient id="bgBlueprintGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0B1320" />
                <stop offset="100%" stopColor="#060A12" />
              </linearGradient>
            </defs>

            {/* Fundo técnico */}
            <rect x="0" y="0" width={width} height={height} fill="url(#bgBlueprintGrad)" />
            <rect
              x={padding.left}
              y={padding.top}
              width={chartWidth}
              height={chartHeight}
              fill="url(#blueprintGrid)"
              stroke="#1F2E45"
              strokeWidth="1"
            />

            {/* Linhas horizontais de posições (Y Ticks) */}
            {yTicks.map((pos) => {
              const y = getY(pos)
              return (
                <g key={`y-${pos}`}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke={pos === 1 ? '#F59E0B' : pos === 10 ? '#38BDF8' : '#1E293B'}
                    strokeWidth={pos === 1 ? 1.2 : 0.75}
                    strokeDasharray={pos === 1 ? 'none' : '3 3'}
                    strokeOpacity={pos === 1 ? 0.7 : 0.4}
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fill={pos === 1 ? '#F59E0B' : '#8B95A7'}
                    fontSize="10"
                    fontWeight={pos === 1 ? 'bold' : 'normal'}
                  >
                    P{pos}
                  </text>
                  <text
                    x={width - padding.right + 8}
                    y={y + 3.5}
                    textAnchor="start"
                    fill={pos === 1 ? '#F59E0B' : '#475569'}
                    fontSize="9"
                  >
                    P{pos}
                  </text>
                </g>
              )
            })}

            {/* Linhas verticais de voltas (X Ticks) */}
            {xTicks.map((lap) => {
              const x = getX(lap)
              return (
                <g key={`x-${lap}`}>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={height - padding.bottom}
                    stroke="#1E293B"
                    strokeWidth="0.75"
                    strokeDasharray="2 2"
                    strokeOpacity="0.4"
                  />
                  <text
                    x={x}
                    y={height - padding.bottom + 16}
                    textAnchor="middle"
                    fill="#8B95A7"
                    fontSize="10"
                  >
                    V{lap}
                  </text>
                </g>
              )
            })}

            {/* Rótulo Eixo X */}
            <text
              x={padding.left + chartWidth / 2}
              y={height - 8}
              textAnchor="middle"
              fill="#64748B"
              fontSize="10"
              fontWeight="bold"
              letterSpacing="1"
            >
              VOLTAS COMPLETADAS
            </text>

            {/* Rótulo Eixo Y */}
            <text
              x={14}
              y={padding.top + chartHeight / 2}
              textAnchor="middle"
              fill="#64748B"
              fontSize="10"
              fontWeight="bold"
              transform={`rotate(-90 14 ${padding.top + chartHeight / 2})`}
              letterSpacing="1"
            >
              POSIÇÃO
            </text>

            {/* Camada 1: Linhas de pilotos NÃO selecionados (cinza sutil transparente) */}
            {driverSeries
              .filter((s) => !selectedDriverIds.includes(s.driverId))
              .map((s) => {
                if (s.points.length === 0) return null
                const dPath = s.points
                  .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(p.lap)} ${getY(p.position)}`)
                  .join(' ')

                return (
                  <path
                    key={`unsel-${s.driverId}`}
                    d={dPath}
                    fill="none"
                    stroke="#334155"
                    strokeWidth="1"
                    strokeOpacity="0.3"
                  />
                )
              })}

            {/* Camada 2: Linhas de pilotos SELECIONADOS */}
            {driverSeries
              .filter((s) => selectedDriverIds.includes(s.driverId))
              .map((s) => {
                if (s.points.length === 0) return null
                const dPath = s.points
                  .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(p.lap)} ${getY(p.position)}`)
                  .join(' ')

                const color = s.isPlayer ? '#E10600' : s.teamColor || '#00A6FB'
                const strokeWidth = s.isPlayer ? 3 : 2

                return (
                  <g key={`sel-${s.driverId}`}>
                    {/* Linha com leve glow se for jogador */}
                    {s.isPlayer && (
                      <path
                        d={dPath}
                        fill="none"
                        stroke="#E10600"
                        strokeWidth="5"
                        strokeOpacity="0.35"
                      />
                    )}
                    <path
                      d={dPath}
                      fill="none"
                      stroke={color}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Pontos nas pontas */}
                    {s.points.map((p, pIdx) => {
                      const px = getX(p.lap)
                      const py = getY(p.position)

                      // Se fez pit stop nesta volta: desenha um losango amarelo fluorescente
                      if (p.didPit) {
                        return (
                          <g key={`pit-${s.driverId}-${p.lap}`}>
                            {/* Losango de Pit Stop */}
                            <polygon
                              points={`${px},${py - 6} ${px + 5},${py} ${px},${py + 6} ${px - 5},${py}`}
                              fill="#FACC15"
                              stroke="#000000"
                              strokeWidth="1.2"
                            />
                          </g>
                        )
                      }

                      // Se DNF no último ponto da história
                      if (p.dnf && pIdx === s.points.length - 1) {
                        return (
                          <g key={`dnf-${s.driverId}-${p.lap}`}>
                            <circle
                              cx={px}
                              cy={py}
                              r="4"
                              fill="#EF4444"
                              stroke="#FFFFFF"
                              strokeWidth="1"
                            />
                            <text
                              x={px + 6}
                              y={py + 3}
                              fill="#EF4444"
                              fontSize="8"
                              fontWeight="bold"
                            >
                              DNF
                            </text>
                          </g>
                        )
                      }

                      // Ponto normal apenas no final para identificar o piloto
                      if (pIdx === s.points.length - 1) {
                        return (
                          <g key={`end-${s.driverId}`}>
                            <circle
                              cx={px}
                              cy={py}
                              r={s.isPlayer ? 4 : 3}
                              fill={color}
                              stroke="#0B0E14"
                              strokeWidth="1.5"
                            />
                            <text
                              x={px + 6}
                              y={py + 3}
                              fill={s.isPlayer ? '#FFFFFF' : '#CBD5E1'}
                              fontSize={s.isPlayer ? '9.5' : '8.5'}
                              fontWeight={s.isPlayer ? 'bold' : 'normal'}
                            >
                              {s.driverName.split(' ')[0]} (P{p.position})
                            </text>
                          </g>
                        )
                      }

                      return null
                    })}
                  </g>
                )
              })}
          </svg>
        </div>

        {/* Legenda técnica */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-[#8B95A7] pt-1 border-t border-[#1F2733]/70">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-1 bg-[#E10600] inline-block rounded" />
              <strong className="text-white">Sua Equipe</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 bg-[#00A6FB] inline-block rounded" />
              <span>Rivais Selecionados</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 bg-slate-600 inline-block rounded" />
              <span>Outros Carros</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-yellow-400 rotate-45 inline-block border border-black" />
              <strong className="text-yellow-300">Pit Stop Realizado</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              <span className="text-red-400">Abandono (DNF)</span>
            </span>
          </div>

          <div className="text-[10px] text-slate-500">
            Total de {history.length} voltas registradas
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
