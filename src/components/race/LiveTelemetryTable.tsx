import React, { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Flame, Fuel, Users, Scale, Wrench } from 'lucide-react'
import { TireCompound } from '@/types/f1'
import { TIRE_SPECS, isTireInCliff, TireCliffStatus } from '@/lib/f1-tire-system'
import { TeamOrderState, FiaPenalty, MechanicalIssue, TeamOrderProposal } from '@/lib/raceDrama'

export interface TelemetryDriverEntry {
  driverId: string
  driverName?: string
  teamName?: string
  teamColor?: string
  position: number
  isPlayer?: boolean
  nationality?: string
  flag?: string
  tireCompound?: TireCompound
  tireWear?: number // 0 a 100
  lastLapTime?: string
  gapToLeader?: string
  gapToFront?: string
  pitStopsDone?: number
  dnf?: boolean
  cliffStatus?: TireCliffStatus
  hasWingDamage?: boolean
  lapsInDirtyAir?: number
  lapsOnCurrentTire?: number
  wearMultiplier?: number
  morale?: number
  aiStrategyProfile?: {
    type: 'conservadora' | 'equilibrada' | 'agressiva' | 'reativa'
    label: string
    color: string
    badgeBg: string
    description: string
  }
}

export type LivePaceOrder = 'segurar' | 'normal' | 'empurrar'

interface LiveTelemetryTableProps {
  grid: TelemetryDriverEntry[]
  currentLap: number
  totalLaps: number
  trackAbrasiveness?: number
  playerCarTactics?: Record<string, 'attack' | 'normal' | 'save_fuel'>
  onChangeTacticalMode?: (driverId: string, mode: 'attack' | 'normal' | 'save_fuel') => void
  playerPaceOrders?: Record<string, LivePaceOrder>
  onChangePaceOrder?: (driverId: string, order: LivePaceOrder) => void
  isRaceFinished?: boolean
  teamOrders?: TeamOrderState[] | TeamOrderState
  penalties?: FiaPenalty[]
  mechanicalIssues?: MechanicalIssue[]
  teamOrderProposal?: TeamOrderProposal | null
  onApplyTeamOrder?: () => void
  compact?: boolean
}

export function LiveTelemetryTable({
  grid,
  currentLap,
  totalLaps,
  trackAbrasiveness = 6,
  playerCarTactics = {},
  onChangeTacticalMode,
  playerPaceOrders = {},
  onChangePaceOrder,
  isRaceFinished = false,
  teamOrders = [],
  penalties = [],
  mechanicalIssues = [],
  teamOrderProposal = null,
  onApplyTeamOrder,
  compact = false,
}: LiveTelemetryTableProps) {
  const activeTeamOrders: TeamOrderState[] = useMemo(() => {
    if (Array.isArray(teamOrders)) {
      return teamOrders.filter((to) => to.active && !to.refused)
    }
    return teamOrders &&
      (teamOrders as TeamOrderState).active &&
      !(teamOrders as TeamOrderState).refused
      ? [teamOrders]
      : []
  }, [teamOrders])

  if (!grid || grid.length === 0) return null

  return (
    <Card className="bg-[#11161F] border border-[#1F2733] shadow-xl overflow-hidden rounded-xl flex flex-col h-full">
      {/* Header Sticky */}
      <CardHeader className="sticky top-0 z-20 py-2.5 px-3.5 bg-[#0B0E14] border-b border-[#1F2733] flex flex-row items-center justify-between shrink-0">
        <div>
          <CardTitle className="text-xs font-bold text-[#F5F7FA] tracking-wide flex items-center gap-1.5 uppercase">
            <Activity className="w-3.5 h-3.5 text-[#00A6FB] shrink-0" />
            Tabela ao Vivo // Grid
          </CardTitle>
          <CardDescription className="text-[10px] text-[#8B95A7] font-num">
            Volta {currentLap} de {totalLaps} • {grid.filter((g) => !g.dnf).length} em pista
          </CardDescription>
        </div>
        <div className="flex items-center gap-1.5">
          {!isRaceFinished && teamOrderProposal && onApplyTeamOrder && (
            <button
              type="button"
              onClick={onApplyTeamOrder}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] px-2 py-0.5 rounded transition-colors shadow-sm flex items-center gap-1 shrink-0 cursor-pointer"
              title={`Solicitar que ${teamOrderProposal.slowDriverName} dê passagem para ${teamOrderProposal.fastDriverName}`}
            >
              <Users className="w-3 h-3" />
              Troca
            </button>
          )}
          <span className="font-num text-[10px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
            {grid.filter((g) => !g.dnf).length} P
          </span>
          {grid.filter((g) => g.dnf).length > 0 && (
            <span className="font-num text-[10px] font-bold text-red-400 px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20">
              {grid.filter((g) => g.dnf).length} DNF
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-x-auto max-h-[580px] scrollbar-thin">
        <table className="w-full text-left text-xs">
          {/* Header Sticky da Tabela */}
          <thead className="sticky top-0 z-10 bg-[#0E131B] border-b border-[#1F2733] text-[#8B95A7] uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-2 px-2.5 w-10 text-center font-semibold">Pos</th>
              <th className="py-2 px-2 font-semibold">Piloto</th>
              {!compact && <th className="py-2 px-2 text-center font-semibold">Perfil / Ritmo</th>}
              <th className="py-2 px-2 text-center font-semibold">Pneu</th>
              <th className="py-2 px-2 text-center font-semibold">Vida</th>
              <th className="py-2 px-2 text-right font-semibold">Gap Líder</th>
              <th className="py-2 px-2 text-center font-semibold w-10">Pit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F2733]/60">
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
                  className={`transition-colors relative ${
                    isMyCar
                      ? isInCliff
                        ? 'bg-red-950/30 font-semibold shadow-inner'
                        : 'bg-[#161D29] font-semibold'
                      : entry.dnf
                        ? 'opacity-40 bg-red-950/10'
                        : isInCliff
                          ? 'bg-red-950/15 hover:bg-red-950/25'
                          : 'hover:bg-[#161D29]/60 bg-[#11161F]'
                  }`}
                >
                  {/* Pos com barra 3px na linha do jogador */}
                  <td className="py-2 px-2 text-center relative">
                    {/* Barra lateral 3px destacada da escuderia do jogador */}
                    {isMyCar && (
                      <span
                        className="absolute left-0 top-0 bottom-0 w-[3px]"
                        style={{ backgroundColor: entry.teamColor || '#E10600' }}
                      />
                    )}
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded font-num text-[11px] font-bold ${
                        entry.dnf
                          ? 'bg-red-900/60 text-red-200'
                          : entry.position === 1
                            ? 'bg-amber-400 text-black'
                            : entry.position === 2
                              ? 'bg-slate-300 text-black'
                              : entry.position === 3
                                ? 'bg-amber-700 text-white'
                                : 'text-[#8B95A7] bg-[#0E131B]'
                      }`}
                    >
                      {entry.dnf ? 'X' : entry.position}
                    </span>
                  </td>

                  {/* Piloto & Selo MEU CARRO */}
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span
                        className="w-1.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: entry.teamColor || '#8B95A7' }}
                      />
                      <span
                        title={entry.nationality || 'Nacionalidade'}
                        className="cursor-default select-none text-xs shrink-0"
                      >
                        {entry.flag}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span
                            className={`text-xs truncate ${
                              isMyCar ? 'text-[#F5F7FA] font-bold' : 'text-[#F5F7FA]'
                            }`}
                          >
                            {entry.driverName || 'Piloto'}
                          </span>
                          {isMyCar && (
                            <span className="shrink-0 px-1 py-0.2 rounded text-[8px] font-bold uppercase bg-[#E10600]/20 text-red-300 border border-[#E10600]/40">
                              SUA EQUIPE
                            </span>
                          )}
                          {isInCliff && (
                            <span className="shrink-0 px-1 py-0.2 rounded text-[8px] font-bold uppercase bg-red-600 text-white animate-pulse">
                              CLIFF
                            </span>
                          )}
                          {entry.hasWingDamage && (
                            <span className="shrink-0 px-1 py-0.2 rounded text-[8px] font-bold uppercase bg-red-600 text-white">
                              ASA
                            </span>
                          )}
                        </div>
                        <span
                          className="text-[10px] truncate block leading-tight"
                          style={{ color: entry.teamColor }}
                        >
                          {entry.teamName}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Perfil Tático / Ritmo (Apenas se não compacto) */}
                  {!compact && (
                    <td className="py-2 px-2 text-center">
                      {isMyCar ? (
                        !isRaceFinished && !entry.dnf ? (
                          <div className="flex flex-col items-center gap-0.5">
                            {onChangeTacticalMode && (
                              <div className="inline-flex items-center gap-0.5 bg-[#0B0F19] p-0.5 rounded border border-[#1F2733]">
                                <button
                                  type="button"
                                  onClick={() => onChangeTacticalMode(entry.driverId, 'attack')}
                                  className={`px-1 py-0.2 rounded text-[8px] font-bold transition-all ${
                                    (playerCarTactics[entry.driverId] || 'normal') === 'attack'
                                      ? 'bg-red-600 text-white'
                                      : 'text-red-400 hover:text-white'
                                  }`}
                                  title="Ataque"
                                >
                                  ATQ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onChangeTacticalMode(entry.driverId, 'normal')}
                                  className={`px-1 py-0.2 rounded text-[8px] font-bold transition-all ${
                                    (playerCarTactics[entry.driverId] || 'normal') === 'normal'
                                      ? 'bg-slate-600 text-white'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                  title="Padrão"
                                >
                                  PAD
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onChangeTacticalMode(entry.driverId, 'save_fuel')}
                                  className={`px-1 py-0.2 rounded text-[8px] font-bold transition-all ${
                                    (playerCarTactics[entry.driverId] || 'normal') === 'save_fuel'
                                      ? 'bg-emerald-600 text-white'
                                      : 'text-emerald-400 hover:text-white'
                                  }`}
                                  title="Economizar"
                                >
                                  ECO
                                </button>
                              </div>
                            )}

                            {onChangePaceOrder && (
                              <div className="inline-flex items-center gap-0.5 bg-[#080D18] p-0.5 rounded border border-[#1F2733]">
                                <button
                                  type="button"
                                  onClick={() => onChangePaceOrder(entry.driverId, 'segurar')}
                                  className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                                    (playerPaceOrders[entry.driverId] || 'normal') === 'segurar'
                                      ? 'bg-blue-600 text-white'
                                      : 'text-blue-300'
                                  }`}
                                  title="Segurar ritmo"
                                >
                                  SEG
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onChangePaceOrder(entry.driverId, 'normal')}
                                  className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                                    (playerPaceOrders[entry.driverId] || 'normal') === 'normal'
                                      ? 'bg-slate-600 text-white'
                                      : 'text-slate-400'
                                  }`}
                                  title="Normal"
                                >
                                  NOR
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onChangePaceOrder(entry.driverId, 'empurrar')}
                                  className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                                    (playerPaceOrders[entry.driverId] || 'normal') === 'empurrar'
                                      ? 'bg-orange-600 text-white'
                                      : 'text-orange-400'
                                  }`}
                                  title="Empurrar ritmo"
                                >
                                  EMP
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="font-num text-[10px] text-[#8B95A7]">
                            {playerCarTactics[entry.driverId] || 'Padrão'}
                          </span>
                        )
                      ) : entry.aiStrategyProfile ? (
                        <span
                          className={`inline-block text-[9px] px-1 py-0 rounded font-medium border ${entry.aiStrategyProfile.badgeBg}`}
                          title={entry.aiStrategyProfile.description}
                        >
                          {entry.aiStrategyProfile.label}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#8B95A7]">—</span>
                      )}
                    </td>
                  )}

                  {/* Pneu */}
                  <td className="py-2 px-2 text-center">
                    <span
                      className={`w-4 h-4 rounded-full inline-flex items-center justify-center font-bold text-[9px] font-num border ${compoundColor}`}
                      title={compoundSpec.name}
                    >
                      {compoundLetter}
                    </span>
                  </td>

                  {/* Vida Pneu em .font-num com micro barra */}
                  <td className="py-2 px-2 text-center">
                    <div className="w-14 mx-auto space-y-0.5">
                      <span
                        className={`font-num text-[10px] font-bold block ${
                          wearVal > 80
                            ? 'text-red-400'
                            : wearVal > 55
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                        }`}
                      >
                        {tireLifePct}%
                      </span>
                      <div className="w-full bg-[#0B0E14] rounded-full h-1 overflow-hidden border border-[#1F2733]">
                        <div
                          className={`h-full ${
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

                  {/* Gap Líder em .font-num tabular alinhado à direita */}
                  <td className="py-2 px-2 text-right">
                    <span
                      className={`font-num text-xs tabular-nums block ${
                        entry.position === 1
                          ? 'text-amber-400 font-bold'
                          : isMyCar
                            ? 'text-[#00A6FB] font-semibold'
                            : 'text-[#F5F7FA]'
                      }`}
                    >
                      {entry.position === 1
                        ? 'LÍDER'
                        : entry.gapToLeader && entry.gapToLeader !== 'LÍDER'
                          ? entry.gapToLeader
                          : '—'}
                    </span>
                  </td>

                  {/* Pits em .font-num */}
                  <td className="py-2 px-2 text-center">
                    <span className="font-num text-[11px] font-bold text-[#8B95A7]">
                      {entry.pitStopsDone || 0}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
