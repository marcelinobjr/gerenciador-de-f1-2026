import React from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Flame, Fuel } from 'lucide-react'
import { TireCompound } from '@/types/f1'
import { TIRE_SPECS, isTireInCliff, TireCliffStatus } from '@/lib/f1-tire-system'

export type LivePaceOrder = 'segurar' | 'normal' | 'empurrar'

export interface TelemetryDriverEntry {
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  teamColor: string
  isPlayer: boolean
  flag: string
  nationality?: string
  position: number
  dnf: boolean
  dnfReason?: string
  tireCompound?: TireCompound
  tireWear?: number
  pitStopsDone?: number
  hasWingDamage?: boolean
  lastLapTime?: string
  gapToLeader?: string
  gapToFront?: string
  wearMultiplier?: number
  lapsOnCurrentTire?: number
  cliffStatus?: TireCliffStatus
  accumulatedTimeSec?: number
  lapsInDirtyAir?: number
  aiStrategyProfile?: {
    type: 'conservadora' | 'equilibrada' | 'agressiva' | 'reativa'
    label: string
    color: string
    badgeBg: string
    description: string
  }
}

interface LiveTelemetryTableProps {
  grid?: TelemetryDriverEntry[]
  currentLap?: number
  totalLaps?: number
  liveRaceState?: {
    grid?: TelemetryDriverEntry[]
    currentLap?: number
    totalLaps?: number
    [key: string]: any
  }
  trackAbrasiveness?: number
  playerCarTactics?: Record<string, 'attack' | 'normal' | 'save_fuel'>
  onChangeTacticalMode?: (
    driverId: string,
    mode: 'attack' | 'normal' | 'save_fuel' | 'preserve',
  ) => void
  playerPaceOrders?: Record<string, LivePaceOrder>
  onChangePaceOrder?: (driverId: string, pace: LivePaceOrder) => void
  isRaceFinished?: boolean
}

export function LiveTelemetryTable(props: LiveTelemetryTableProps) {
  const grid = props.grid || props.liveRaceState?.grid || []
  const currentLap = props.currentLap ?? props.liveRaceState?.currentLap ?? 1
  const totalLaps = props.totalLaps ?? props.liveRaceState?.totalLaps ?? 50
  const trackAbrasiveness = props.trackAbrasiveness ?? 6
  const playerCarTactics = props.playerCarTactics ?? {}
  const onChangeTacticalMode = props.onChangeTacticalMode
  const playerPaceOrders = props.playerPaceOrders ?? {}
  const onChangePaceOrder = props.onChangePaceOrder
  const isRaceFinished = props.isRaceFinished ?? false
  if (!grid || grid.length === 0) return null

  return (
    <Card className="bg-[#090D15]/85 backdrop-blur-md border border-[#1A2333] shadow-2xl overflow-hidden">
      <CardHeader className="py-3 px-4 bg-[#080C14]/90 border-b border-[#1A2333] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <CardTitle className="text-sm font-bold text-[#F5F7FA] tracking-wide font-mono flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            TELEMETRIA OFICIAL DA CORRIDA EM TEMPO REAL // GRID COMPLETO (24 CARROS)
          </CardTitle>
          <CardDescription className="text-[11px] text-[#8B95A7] font-mono">
            Volta {currentLap} de {totalLaps} • Atualização a cada volta • Destaque para pilotos da
            sua escuderia
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[11px]">
            {grid.filter((g) => !g.dnf).length} em pista
          </Badge>
          <Badge className="bg-red-500/15 text-red-300 border border-red-500/30 font-mono text-[11px]">
            {grid.filter((g) => g.dnf).length} abandonos
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1A2333] text-[#8B95A7] uppercase tracking-wider bg-[#080C14]/90 text-[10px]">
                <th className="py-2.5 px-3 w-12 text-center">Pos</th>
                <th className="py-2.5 px-3">Piloto / Escuderia</th>
                <th className="py-2.5 px-3 text-center">Perfil Tático</th>
                <th className="py-2.5 px-3 text-center">Pneu Atual</th>
                <th className="py-2.5 px-3 text-center">Vida / Desgaste</th>
                <th className="py-2.5 px-3 text-center">Última Volta</th>
                <th className="py-2.5 px-3 text-right">Diferença Frente</th>
                <th className="py-2.5 px-3 text-right">Gap Líder</th>
                <th className="py-2.5 px-3 text-center">Pits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A2333]">
              {grid.map((entry) => {
                const isMyCar = entry.isPlayer
                const compoundSpec = TIRE_SPECS[entry.tireCompound || 'medio'] || TIRE_SPECS.medio
                const compoundLetter =
                  entry.tireCompound === 'duro'
                    ? 'D'
                    : entry.tireCompound === 'medio'
                      ? 'M'
                      : entry.tireCompound === 'macio'
                        ? 'S'
                        : entry.tireCompound === 'intermediario'
                          ? 'I'
                          : 'W'

                const compoundColor =
                  entry.tireCompound === 'duro'
                    ? 'bg-slate-100 text-slate-900 border-slate-300'
                    : entry.tireCompound === 'medio'
                      ? 'bg-yellow-400 text-black border-yellow-500'
                      : entry.tireCompound === 'macio'
                        ? 'bg-red-600 text-white border-red-700'
                        : entry.tireCompound === 'intermediario'
                          ? 'bg-emerald-500 text-black border-emerald-600'
                          : 'bg-blue-600 text-white border-blue-700'

                const wearVal = entry.tireWear || 5
                const tireLifePct = Math.max(0, 100 - wearVal)

                const lapsOnCompound = entry.lapsOnCurrentTire || 1
                const cliffCheck = isTireInCliff(
                  entry.tireCompound || 'medio',
                  lapsOnCompound,
                  entry.wearMultiplier ?? 1.0,
                  trackAbrasiveness,
                )
                const isInCliff =
                  cliffCheck.inCliff ||
                  Boolean(entry.cliffStatus && entry.cliffStatus.isCliffReached > 0)

                return (
                  <tr
                    key={entry.driverId}
                    className={`transition-colors ${
                      isMyCar
                        ? isInCliff
                          ? 'bg-red-950/40 font-semibold border-l-4 border-l-red-500 shadow-[inset_0_0_16px_rgba(239,68,68,0.3)] ring-1 ring-red-500/60'
                          : 'bg-[#E10600]/15 font-semibold border-l-4 border-l-[#E10600] shadow-[inset_0_0_12px_rgba(225,6,0,0.15)] ring-1 ring-[#E10600]/40'
                        : entry.dnf
                          ? 'opacity-40 bg-red-950/20'
                          : isInCliff
                            ? 'bg-red-950/20 hover:bg-red-950/30'
                            : 'hover:bg-[#161D29]/50'
                    }`}
                  >
                    {/* Pos */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold ${
                          entry.dnf
                            ? 'bg-red-900/60 text-red-200'
                            : entry.position === 1
                              ? 'bg-amber-400 text-black'
                              : entry.position === 2
                                ? 'bg-slate-300 text-black'
                                : entry.position === 3
                                  ? 'bg-amber-700 text-white'
                                  : 'text-[#8B95A7]'
                        }`}
                      >
                        {entry.dnf ? 'DNF' : entry.position}
                      </span>
                    </td>

                    {/* Driver & Team */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          title={entry.nationality || 'Nacionalidade'}
                          className="cursor-default select-none text-base"
                        >
                          {entry.flag}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-xs ${isMyCar ? 'text-white font-extrabold' : 'text-[#F5F7FA]'}`}
                            >
                              {entry.driverName}
                            </span>
                            {isMyCar && (
                              <Badge className="bg-[#E10600] text-white text-[9px] px-1 py-0 h-3.5 font-bold animate-pulse">
                                MEU CARRO
                              </Badge>
                            )}
                            {isMyCar && isInCliff && (
                              <Badge className="bg-red-600 text-white text-[9px] px-1.5 py-0 h-3.5 font-extrabold animate-bounce border border-red-400">
                                BOX URGENTE
                              </Badge>
                            )}
                            {entry.hasWingDamage && (
                              <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5">
                                ASA QUEBRADA
                              </Badge>
                            )}
                            {(entry.lapsInDirtyAir || 0) >= 3 && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 h-3.5 border-orange-500/50 text-orange-400 bg-orange-500/10"
                                title={`Ar turbulento (Dirty Air) por ${entry.lapsInDirtyAir} voltas: +0.12s no ritmo e desgaste extra`}
                              >
                                DIRTY AIR
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] block" style={{ color: entry.teamColor }}>
                            {entry.teamName}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Tactical Profile Badge / Selector */}
                    <td className="py-2.5 px-3 text-center">
                      {isMyCar ? (
                        !isRaceFinished && !entry.dnf ? (
                          <div className="flex flex-col items-center gap-1">
                            {/* Linha 1: Tática existente de consumo/ataque */}
                            {onChangeTacticalMode && (
                              <div className="inline-flex items-center gap-1 bg-[#0B0F19] p-0.5 rounded border border-[#1E2638]">
                                <button
                                  type="button"
                                  onClick={() => onChangeTacticalMode(entry.driverId, 'attack')}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all flex items-center gap-0.5 border ${
                                    (playerCarTactics[entry.driverId] || 'normal') === 'attack'
                                      ? 'bg-red-600 text-white border-red-400 shadow-[0_0_8px_#dc2626]'
                                      : 'bg-[#111726] text-red-400 border-red-900/40 hover:bg-red-950/60'
                                  }`}
                                  title="Ataque: ritmo ×0.97, +30% pneus, +25% combustível, +30% peças"
                                >
                                  <Flame className="w-2.5 h-2.5" /> Ataque
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onChangeTacticalMode(entry.driverId, 'normal')}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all border ${
                                    (playerCarTactics[entry.driverId] || 'normal') === 'normal'
                                      ? 'bg-slate-600 text-white border-slate-400 shadow-sm'
                                      : 'bg-[#111726] text-slate-400 border-slate-800 hover:text-white'
                                  }`}
                                  title="Padrão: sem modificadores"
                                >
                                  Padrão
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onChangeTacticalMode(entry.driverId, 'save_fuel')}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all flex items-center gap-0.5 border ${
                                    (playerCarTactics[entry.driverId] || 'normal') === 'save_fuel'
                                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_8px_#059669]'
                                      : 'bg-[#111726] text-emerald-400 border-emerald-900/40 hover:bg-emerald-950/60'
                                  }`}
                                  title="Economizar: ritmo ×1.02, -25% pneus, -30% combustível, -25% peças"
                                >
                                  <Fuel className="w-2.5 h-2.5" /> Economizar
                                </button>
                              </div>
                            )}

                            {/* Linha 2: 3 Botões de Ordem de Ritmo ao Vivo (Segurar / Normal / Empurrar) */}
                            {onChangePaceOrder && (
                              <div className="inline-flex items-center gap-1 bg-[#080D18] p-0.5 rounded border border-cyan-900/40 shadow-inner">
                                <span className="text-[8px] font-mono font-bold text-cyan-400 uppercase px-1">
                                  Ritmo:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onChangePaceOrder(entry.driverId, 'segurar')}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all border ${
                                    (playerPaceOrders[entry.driverId] || 'normal') === 'segurar'
                                      ? 'bg-blue-600 text-white border-blue-300 shadow-[0_0_8px_#2563eb]'
                                      : 'bg-[#101726] text-blue-300 border-blue-900/40 hover:bg-blue-950/70'
                                  }`}
                                  title="Segurar ritmo: +1,5s/volta, desgaste ×0,65 (poupa pneu e combustível). Válido a partir da volta seguinte."
                                >
                                  Segurar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onChangePaceOrder(entry.driverId, 'normal')}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all border ${
                                    (playerPaceOrders[entry.driverId] || 'normal') === 'normal'
                                      ? 'bg-slate-600 text-white border-slate-300 shadow-sm'
                                      : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
                                  }`}
                                  title="Ritmo normal / neutro"
                                >
                                  Normal
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onChangePaceOrder(entry.driverId, 'empurrar')}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all border ${
                                    (playerPaceOrders[entry.driverId] || 'normal') === 'empurrar'
                                      ? 'bg-orange-600 text-white border-orange-300 shadow-[0_0_8px_#ea580c]'
                                      : 'bg-[#101726] text-orange-400 border-orange-900/40 hover:bg-orange-950/70'
                                  }`}
                                  title="Empurrar ritmo: -0,3s/volta, desgaste ×1,25 (busca fechar gap). Válido a partir da volta seguinte."
                                >
                                  Empurrar
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <Badge className="bg-red-500/15 border-red-500/30 text-red-300 text-[9px] px-1.5 py-0">
                              {playerCarTactics[entry.driverId] === 'attack'
                                ? 'Ataque'
                                : playerCarTactics[entry.driverId] === 'save_fuel'
                                  ? 'Economizar'
                                  : 'Padrão'}
                            </Badge>
                            {playerPaceOrders[entry.driverId] && (
                              <Badge className="bg-cyan-500/15 border-cyan-500/30 text-cyan-300 text-[9px] px-1.5 py-0 capitalize">
                                Ritmo: {playerPaceOrders[entry.driverId]}
                              </Badge>
                            )}
                          </div>
                        )
                      ) : entry.aiStrategyProfile ? (
                        <Badge
                          className={`text-[9px] px-1.5 py-0 border ${entry.aiStrategyProfile.badgeBg}`}
                          title={entry.aiStrategyProfile.description}
                        >
                          {entry.aiStrategyProfile.label}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-slate-500">—</span>
                      )}
                    </td>

                    {/* Tire Compound Icon/Letter */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1">
                        <span
                          className={`w-5 h-5 rounded-full inline-flex items-center justify-center font-bold text-[10px] border shadow-sm ${compoundColor}`}
                          title={compoundSpec.name}
                        >
                          {compoundLetter}
                        </span>
                        <span className="text-[10px] text-[#8B95A7] capitalize">
                          {entry.tireCompound?.slice(0, 3)}
                        </span>
                        {isInCliff && (
                          <Badge
                            variant="destructive"
                            className={`text-[9px] px-1 py-0 h-4 font-bold uppercase tracking-wider bg-red-600 text-white animate-pulse border-red-500 shadow-sm ${
                              isMyCar ? 'ring-1 ring-white/70 shadow-red-500/50' : ''
                            }`}
                            title={`Pneu em Cliff! Perda de ritmo: +${(
                              cliffCheck.penaltyPerLap ||
                              entry.cliffStatus?.extraLapTimeSec ||
                              compoundSpec.cliffDegradationPerLapSec
                            ).toFixed(2)}s/volta`}
                          >
                            CLIFF
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Life / Wear % with visual progress bar */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="w-24 mx-auto space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-[#8B95A7]">{tireLifePct}% vida</span>
                          <span
                            className={`font-bold ${
                              wearVal > 80
                                ? 'text-red-400'
                                : wearVal > 55
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                            }`}
                          >
                            {wearVal}% desg.
                          </span>
                        </div>
                        <div className="w-full bg-[#0B0E14] rounded-full h-1.5 overflow-hidden border border-[#1F2733]">
                          <div
                            className={`h-full transition-all ${
                              tireLifePct < 25
                                ? 'bg-red-500'
                                : tireLifePct < 50
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                            }`}
                            style={{ width: `${tireLifePct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Last Lap Time */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`text-xs ${isMyCar ? 'text-cyan-300 font-bold' : 'text-[#8B95A7]'}`}
                      >
                        {entry.lastLapTime || '1:18.420'}
                      </span>
                    </td>

                    {/* Gap to Front */}
                    <td className="py-2.5 px-3 text-right">
                      <span className="text-xs text-[#8B95A7]">{entry.gapToFront || '-'}</span>
                    </td>

                    {/* Gap to Leader */}
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`text-xs ${
                          entry.position === 1 ? 'text-amber-400 font-bold' : 'text-[#F5F7FA]'
                        }`}
                      >
                        {entry.position === 1
                          ? 'LÍDER'
                          : entry.gapToLeader && entry.gapToLeader !== 'LÍDER'
                            ? entry.gapToLeader
                            : '—'}
                      </span>
                    </td>

                    {/* Pits Done */}
                    <td className="py-2.5 px-3 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          (entry.pitStopsDone || 0) > 0
                            ? 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10'
                            : 'border-slate-800 text-slate-400'
                        }`}
                      >
                        {entry.pitStopsDone || 0}
                      </Badge>
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
