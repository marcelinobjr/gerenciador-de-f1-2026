import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Trophy,
  Flag,
  ShieldCheck,
  Play,
  FastForward,
  RotateCcw,
  Sparkles,
  Flame,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'
import { getTeamReducedLogoUrl } from '@/lib/team-reduced-logo-resolver'

interface CanonicalRaceInitializationPanelProps {
  raceState: CanonicalRaceState
  onResetGrid?: () => void
  onAdvanceOneLap?: (options?: {
    forceRaceControlStatus?: import('@/types/canonical-race-v2').RaceControlStatus
  }) => void
  onAdvanceMultipleLaps?: (count: number) => void
  onResetRace?: () => void
  onForceFlag?: (flag: import('@/types/canonical-race-v2').RaceControlStatus) => void
}

export const CanonicalRaceInitializationPanel: React.FC<CanonicalRaceInitializationPanelProps> = ({
  raceState,
  onResetGrid,
  onAdvanceOneLap,
  onAdvanceMultipleLaps,
  onResetRace,
}) => {
  const [isSimulating, setIsSimulating] = useState(false)
  const leaderDriver =
    raceState.drivers[0] || raceState.drivers.find((d) => d.currentPosition === 1)
  const playerDrivers = raceState.drivers.filter((d) => d.isPlayer)
  const isFinished = raceState.status === 'completed'
  const isNotStarted = raceState.status === 'not_started'
  const rc = raceState.raceControl
  const currentFlag =
    rc?.currentFlag ||
    (raceState.safetyCarActive
      ? 'SAFETY_CAR'
      : raceState.vscActive
        ? 'VSC'
        : raceState.redFlagActive
          ? 'RED_FLAG'
          : raceState.status === 'completed'
            ? 'FINISHED'
            : 'GREEN')

  const handleSimulateRest = () => {
    if (!onAdvanceMultipleLaps || isFinished) return
    setIsSimulating(true)
    const remainingLaps = Math.max(1, raceState.totalLaps - raceState.drivers[0].lap)
    setTimeout(() => {
      onAdvanceMultipleLaps(remainingLaps)
      setIsSimulating(false)
    }, 100)
  }

  return (
    <div className="space-y-6">
      {/* Barra de Controles de QA e Simulação da Corrida (FW2.1E-B) */}
      <Card className="bg-[#0B111E] border border-slate-800 shadow-md rounded-2xl overflow-hidden text-white">
        <CardContent className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#E10600] text-white text-[10px] font-black uppercase">
                FW2.1E-C • RACE CONTROL INTEGRADO
              </Badge>
              {/* Badge Dinâmico da Bandeira Atual */}
              <Badge
                className={`text-[10px] uppercase font-black px-2.5 py-0.5 border ${
                  currentFlag === 'GREEN'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : currentFlag === 'YELLOW_LOCAL'
                      ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50'
                      : currentFlag === 'YELLOW'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : currentFlag === 'VSC'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 animate-pulse'
                          : currentFlag === 'SAFETY_CAR'
                            ? 'bg-orange-600 text-white border-orange-400 animate-pulse'
                            : currentFlag === 'RESTART'
                              ? 'bg-emerald-600 text-white border-emerald-300 animate-pulse'
                              : currentFlag === 'RED_FLAG'
                                ? 'bg-red-600 text-white border-red-400 animate-pulse font-extrabold'
                                : 'bg-slate-800 text-white border-slate-600'
                }`}
              >
                {currentFlag === 'GREEN' && '🟢 BANDEIRA VERDE'}
                {currentFlag === 'YELLOW_LOCAL' &&
                  `🟡 AMARELA LOCAL (SETOR ${rc?.activeSector || 2})`}
                {currentFlag === 'YELLOW' && '🟡 BANDEIRA AMARELA GERAL'}
                {currentFlag === 'VSC' && '🟡 VIRTUAL SAFETY CAR'}
                {currentFlag === 'SAFETY_CAR' && '🚨 SAFETY CAR ATIVO'}
                {currentFlag === 'RESTART' && '🟢 RELARGADA EM ANDAMENTO'}
                {currentFlag === 'RED_FLAG' && '🔴 BANDEIRA VERMELHA'}
                {currentFlag === 'FINISHED' && '🏁 BANDEIRA QUADRICULADA'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              Race Control canônico: cada bandeira altera ritmo, gaps, consumo e ultrapassagens.
              {rc?.lastIncidentReason && (
                <span className="block text-slate-300 font-mono text-[11px] mt-0.5">
                  Motivo: {rc.lastIncidentReason}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onAdvanceOneLap && (
              <Button
                type="button"
                size="sm"
                disabled={isFinished || isSimulating}
                onClick={() => onAdvanceOneLap()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5 h-9 px-3"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Avançar 1 Volta
              </Button>
            )}

            {onAdvanceMultipleLaps && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isFinished || isSimulating || currentFlag === 'RED_FLAG'}
                  onClick={() => onAdvanceMultipleLaps(5)}
                  className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-bold gap-1.5 h-9 px-3"
                >
                  <FastForward className="w-3.5 h-3.5 text-cyan-400" />
                  +5 Voltas
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isFinished || isSimulating || currentFlag === 'RED_FLAG'}
                  onClick={() => onAdvanceMultipleLaps(10)}
                  className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-bold gap-1.5 h-9 px-3"
                >
                  <FastForward className="w-3.5 h-3.5 text-amber-400" />
                  +10 Voltas
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={isFinished || isSimulating || currentFlag === 'RED_FLAG'}
                  onClick={handleSimulateRest}
                  className="bg-red-600 hover:bg-red-500 text-white text-xs font-black gap-1.5 h-9 px-3"
                >
                  <Flame className="w-3.5 h-3.5 fill-current text-amber-300" />
                  {isSimulating ? 'Simulando...' : 'Simular até o Fim'}
                </Button>
              </>
            )}

            {onResetRace && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onResetRace}
                className="text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-medium gap-1 h-9 px-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reiniciar
              </Button>
            )}
          </div>

          {/* Painel de Controles de QA para Forçar Bandeiras / Race Control (Requisito 18) */}
          <div className="w-full pt-3 mt-1 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Controles de QA (Forçar Race Control):
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isFinished}
                onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'GREEN' })}
                className="h-7 px-2 text-[10px] font-bold bg-emerald-950/40 text-emerald-300 border-emerald-700/50 hover:bg-emerald-900/60"
              >
                🟢 Green
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isFinished}
                onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'YELLOW_LOCAL' })}
                className="h-7 px-2 text-[10px] font-bold bg-yellow-950/40 text-yellow-300 border-yellow-700/50 hover:bg-yellow-900/60"
              >
                🟡 Yellow Local
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isFinished}
                onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'YELLOW' })}
                className="h-7 px-2 text-[10px] font-bold bg-amber-950/40 text-amber-300 border-amber-700/50 hover:bg-amber-900/60"
              >
                🟡 Yellow Geral
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isFinished}
                onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'VSC' })}
                className="h-7 px-2 text-[10px] font-bold bg-amber-950/40 text-amber-300 border-amber-600/50 hover:bg-amber-900/60"
              >
                🟡 VSC
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isFinished}
                onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'SAFETY_CAR' })}
                className="h-7 px-2 text-[10px] font-bold bg-orange-950/40 text-orange-300 border-orange-600/50 hover:bg-orange-900/60"
              >
                🚨 Safety Car
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isFinished}
                onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'RESTART' })}
                className="h-7 px-2 text-[10px] font-bold bg-emerald-950/40 text-cyan-300 border-cyan-600/50 hover:bg-cyan-900/60"
              >
                🟢 SC Restart
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isFinished}
                onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'RED_FLAG' })}
                className="h-7 px-2 text-[10px] font-bold bg-red-950/50 text-red-300 border-red-600/60 hover:bg-red-900/70"
              >
                🔴 Red Flag
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Banner Informativo da Corrida V2 */}
      <Card className="bg-[#0F172A] text-white border-none shadow-md overflow-hidden rounded-2xl relative">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-[#E10600]/30 to-transparent pointer-events-none" />
        <CardContent className="p-6 relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#E10600] text-white text-[10px] font-black uppercase">
                {raceState.circuitCountry} • {raceState.season}
              </Badge>
              <Badge
                variant="outline"
                className="text-emerald-400 border-emerald-500/40 text-[10px]"
              >
                24 PILOTOS HOMOLOGADOS
              </Badge>
            </div>
            {onResetGrid && (
              <button
                type="button"
                onClick={onResetGrid}
                className="text-xs text-slate-400 hover:text-white underline underline-offset-2"
              >
                Revisar Grid Oficial
              </button>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Flag className="w-6 h-6 text-emerald-400" />
              {raceState.circuitName} —{' '}
              {isFinished ? 'Resultado Provisório Final' : 'Corrida em Tempo Real'}
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl">
              {isFinished
                ? 'A bandeira quadriculada foi agitada! O líder completou todas as voltas regulamentares e a classificação foi congelada.'
                : 'Posições e gaps calculados diretamente pelo tempo acumulado real (raceTime). Desgaste de pneus e consumo de combustível progridem volta a volta.'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                {isFinished ? 'Vencedor do GP' : 'Líder da Prova'}
              </span>
              <span className="font-extrabold text-amber-400 text-sm">
                {leaderDriver?.driverName} ({leaderDriver?.teamName})
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Progresso
              </span>
              <span className="font-extrabold text-white text-sm">
                Volta {leaderDriver?.lap ?? 0} de {raceState.totalLaps}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Volta Mais Rápida
              </span>
              <span className="font-extrabold text-cyan-400 text-sm">
                {raceState.fastestLap
                  ? `${raceState.fastestLap.driverName} (${raceState.fastestLap.lapTimeFormatted})`
                  : 'Nenhuma registrada'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Sua Equipe
              </span>
              <span className="font-extrabold text-white text-sm">
                {playerDrivers.map((d) => `P${d.currentPosition} ${d.driverName}`).join(' • ')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feed de Eventos Relevantes (Ultrapassagens, DNFs, Largada) */}
      {raceState.events && raceState.events.length > 0 && (
        <Card className="bg-[#090D16] border border-slate-800/80 rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="py-2.5 px-4 bg-[#0F172A] border-b border-slate-800 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Feed Dinâmico de Pista
            </CardTitle>
            <span className="text-[10px] text-slate-500 font-mono">
              {raceState.events.length} evento(s) registrado(s)
            </span>
          </CardHeader>
          <CardContent className="p-3 max-h-36 overflow-y-auto space-y-1 text-xs font-mono">
            {raceState.events
              .slice(-6)
              .reverse()
              .map((ev) => (
                <div
                  key={ev.id}
                  className={`p-1.5 rounded-lg flex items-center justify-between text-[11px] ${
                    ev.type === 'dnf'
                      ? 'bg-red-950/40 text-red-300 border border-red-800/40'
                      : ev.type === 'overtake'
                        ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-800/30'
                        : 'bg-slate-900/50 text-slate-300'
                  }`}
                >
                  <span>{ev.message}</span>
                  <span className="text-[9px] text-slate-500 ml-2 shrink-0">{ev.timestamp}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Tabela de Classificação Dinâmica (P1 a P24) */}
      <Card className="bg-white border border-[#E2E8F0] shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="py-3.5 px-4 bg-[#F8FAFC] border-b border-[#F1F5F9] flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs font-black uppercase tracking-wider text-[#0F172A] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Classificação Dinâmica em Pista (P1–P24)
            </CardTitle>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Ordenação estrita por voltas completadas e menor raceTime real acumulado.
            </p>
          </div>
          <Badge className="bg-[#059669] text-white text-[10px] font-bold">
            {isFinished ? 'RESULTADO FINAL' : 'AO VIVO'}
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#F1F5F9] text-[#64748B] uppercase tracking-wider bg-[#F8FAFC]/50 text-[10px]">
                  <th className="py-2.5 px-3 w-12 text-center">Pos</th>
                  <th className="py-2.5 px-3 text-center w-12">Grid</th>
                  <th className="py-2.5 px-3">Piloto</th>
                  <th className="py-2.5 px-3">Equipe</th>
                  <th className="py-2.5 px-3 text-center">Volta</th>
                  <th className="py-2.5 px-3 text-center">Última Volta</th>
                  <th className="py-2.5 px-3 text-center">Gap Líder</th>
                  <th className="py-2.5 px-3 text-center">Gap Carro Frente</th>
                  <th className="py-2.5 px-3 text-center">Pneu (Idade)</th>
                  <th className="py-2.5 px-3 text-center">Combustível</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {raceState.drivers.map((driver) => {
                  const logoUrl = getTeamReducedLogoUrl(driver.teamName || driver.teamId)
                  const isDnf = driver.raceStatus === 'dnf' || driver.isDnf
                  const posDelta = driver.gridPosition - driver.currentPosition

                  return (
                    <tr
                      key={`canonical_race_${driver.driverId}`}
                      className={`transition-colors ${
                        isDnf
                          ? 'bg-slate-50/80 text-slate-400 opacity-60'
                          : driver.isPlayer
                            ? 'bg-red-50/70 hover:bg-red-50 font-bold border-l-4 border-l-[#E10600]'
                            : 'hover:bg-slate-50 text-[#0F172A]'
                      }`}
                    >
                      {/* Posição Atual */}
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold text-[11px] ${
                            isDnf
                              ? 'bg-slate-200 text-slate-500'
                              : driver.currentPosition === 1
                                ? 'bg-amber-400 text-black shadow-xs font-black'
                                : driver.currentPosition <= 3
                                  ? 'bg-slate-200 text-[#0F172A]'
                                  : driver.currentPosition <= 10
                                    ? 'bg-slate-100 text-[#334155]'
                                    : 'bg-slate-50 text-[#64748B]'
                          }`}
                        >
                          P{driver.currentPosition}
                        </span>
                      </td>

                      {/* Grid Position Original (Imutável) com Delta */}
                      <td className="py-2 px-3 text-center text-[10px] text-slate-500">
                        <div className="flex items-center justify-center gap-1">
                          <span>P{driver.gridPosition}</span>
                          {!isDnf && posDelta !== 0 && (
                            <span
                              className={`text-[9px] font-bold ${
                                posDelta > 0 ? 'text-emerald-600' : 'text-red-500'
                              }`}
                            >
                              {posDelta > 0 ? `+${posDelta}` : posDelta}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Piloto */}
                      <td className="py-2 px-3 font-sans">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={
                              driver.isPlayer
                                ? 'text-[#0F172A] font-extrabold'
                                : 'text-[#1E293B] font-medium'
                            }
                          >
                            {driver.driverName}
                          </span>
                          {driver.isPlayer && (
                            <Badge className="bg-[#E10600] text-white text-[9px] px-1 py-0 h-4 uppercase font-black">
                              Sua Equipe
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Equipe */}
                      <td className="py-2 px-3 font-sans">
                        <div className="flex items-center gap-2">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={driver.teamName}
                              className="w-5 h-5 rounded-sm object-contain bg-white border border-[#E2E8F0] p-0.5 shrink-0"
                            />
                          ) : (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: driver.teamColor || '#94A3B8' }}
                            />
                          )}
                          <span
                            className="truncate max-w-[120px] text-xs font-semibold"
                            style={{ color: driver.teamColor }}
                          >
                            {driver.teamName}
                          </span>
                        </div>
                      </td>

                      {/* Voltas */}
                      <td className="py-2 px-3 text-center font-bold">{driver.lap}</td>

                      {/* Última Volta */}
                      <td className="py-2 px-3 text-center">
                        {isDnf ? (
                          <span className="text-slate-400 text-[10px]">—</span>
                        ) : driver.lastLapTimeFormatted ? (
                          <span className="text-slate-700 font-mono text-[11px]">
                            {driver.lastLapTimeFormatted}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>

                      {/* Gap ao Líder */}
                      <td className="py-2 px-3 text-center font-bold">
                        {isDnf ? (
                          <Badge variant="destructive" className="text-[9px] uppercase">
                            DNF
                          </Badge>
                        ) : (
                          <span
                            className={
                              driver.currentPosition === 1
                                ? 'text-amber-600 font-black'
                                : 'text-slate-600'
                            }
                          >
                            {driver.gap}
                          </span>
                        )}
                      </td>

                      {/* Gap ao Carro da Frente */}
                      <td className="py-2 px-3 text-center text-slate-500 text-[11px]">
                        {isDnf
                          ? '—'
                          : driver.currentPosition === 1
                            ? '—'
                            : typeof driver.gapToFrontSec === 'number'
                              ? `+${driver.gapToFrontSec.toFixed(3)}s`
                              : '—'}
                      </td>

                      {/* Pneu e Idade */}
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold uppercase border-slate-300"
                          >
                            {driver.tyreCompound}
                          </Badge>
                          <span className="text-[10px] text-slate-500 font-mono">
                            ({driver.tyreAge}v)
                          </span>
                        </div>
                      </td>

                      {/* Combustível */}
                      <td className="py-2 px-3 text-center text-slate-700 font-bold">
                        {driver.fuel.toFixed(1)} kg
                      </td>

                      {/* Status */}
                      <td className="py-2 px-3 text-center">
                        {isDnf ? (
                          <Badge
                            variant="destructive"
                            className="text-[9px] uppercase font-bold"
                            title={driver.dnfReason}
                          >
                            DNF ({driver.dnfReason?.slice(0, 15) || 'Falha'}...)
                          </Badge>
                        ) : driver.raceStatus === 'finished' ? (
                          <Badge className="bg-slate-700 text-white text-[9px] uppercase font-bold">
                            Concluído
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-white text-[9px] uppercase font-bold">
                            Na Pista
                          </Badge>
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
