import React, { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Fuel,
  Disc,
  Wrench,
  ChevronUp,
  ChevronDown,
  Trophy,
  Zap,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Gauge,
  Activity,
} from 'lucide-react'
import { SimDriverEntry } from '@/pages/RaceSlim'
import { TireCompound } from '@/types/f1'

interface LiveRaceHUDProps {
  currentLap: number
  totalLaps: number
  playerDrivers: SimDriverEntry[]
  isRaceFinished?: boolean
  gpName: string
  gpCountry: string
  tacticalModes: Record<string, 'attack' | 'preserve' | 'save_fuel' | 'normal'>
  onChangeTacticalMode?: (
    driverId: string,
    mode: 'attack' | 'preserve' | 'save_fuel' | 'normal',
  ) => void
  formatTireName: (c?: TireCompound) => string
  teamOrderProposal?: {
    fastDriverId: string
    fastDriverName: string
    slowDriverId: string
    slowDriverName: string
    gap: number
    lapsPushed: number
  } | null
  onApplyTeamOrder?: () => void
  teamOrderActive?: boolean
}

const compoundColorMap: Record<TireCompound, string> = {
  macio: '#E10600',
  medio: '#FACC15',
  duro: '#FFFFFF',
  intermediario: '#10B981',
  chuva_extrema: '#3B82F6',
}

export function LiveRaceHUD({
  currentLap,
  totalLaps,
  playerDrivers,
  isRaceFinished = false,
  gpName,
  gpCountry,
  tacticalModes,
  onChangeTacticalMode,
  formatTireName,
  teamOrderProposal,
  onApplyTeamOrder,
  teamOrderActive = false,
}: LiveRaceHUDProps) {
  // Se a corrida já estiver finalizada, inicia recolhido
  const [collapsed, setCollapsed] = useState(isRaceFinished)

  // Quando isRaceFinished mudar para true, recolhe automaticamente o HUD
  React.useEffect(() => {
    if (isRaceFinished) {
      setCollapsed(true)
    }
  }, [isRaceFinished])

  // Identifica pódio
  const podiumDrivers = isRaceFinished
    ? playerDrivers.filter((d) => !d.dnf && d.position <= 3).sort((a, b) => a.position - b.position)
    : []

  const handleScrollToResults = () => {
    const el = document.getElementById('race-official-results')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (collapsed) {
    if (isRaceFinished) {
      return (
        <aside
          aria-label="HUD da Corrida"
          className="fixed bottom-5 right-5 z-40 animate-fade-in flex items-center gap-2"
        >
          <Button
            onClick={() => {
              handleScrollToResults()
            }}
            className="h-10 px-4 rounded-full bg-[#090D15]/95 hover:bg-[#121927] border border-emerald-500/60 text-emerald-300 shadow-2xl backdrop-blur-md flex items-center gap-2 group transition-all cursor-pointer"
            title="Ver Resultados Oficiais"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-mono font-bold">Corrida Finalizada — Ver Resultado</span>
          </Button>
          <Button
            onClick={() => setCollapsed(false)}
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-[#090D15]/80 hover:bg-[#121927] border border-cyan-500/40 text-cyan-300 backdrop-blur-md"
            title="Reabrir HUD de Telemetria"
          >
            <Activity className="w-4 h-4" />
          </Button>
        </aside>
      )
    }

    return (
      <aside aria-label="HUD da Corrida" className="fixed bottom-5 right-5 z-40 animate-fade-in">
        <Button
          onClick={() => setCollapsed(false)}
          className="h-12 w-12 rounded-2xl bg-[#090D15]/90 hover:bg-[#121927] border border-cyan-500/50 text-cyan-300 shadow-2xl backdrop-blur-md flex flex-col items-center justify-center p-0 gap-0.5 group"
          title="Expandir HUD Flutuante"
        >
          <Activity className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          <span className="text-[9px] font-mono font-bold leading-none">HUD</span>
        </Button>
      </aside>
    )
  }

  return (
    <aside
      aria-label="Painel de telemetria ao vivo"
      className="fixed bottom-4 right-4 z-40 max-w-[360px] w-[calc(100vw-2rem)] rounded-2xl bg-[#090D15]/95 border border-cyan-500/40 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.7)] text-[#F5F7FA] overflow-hidden font-mono transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
    >
      {/* Header do HUD */}
      <div className="px-3.5 py-2.5 bg-gradient-to-r from-cyan-950/40 via-[#0B0F19] to-slate-900/60 border-b border-[#1F2733] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
          <span className="text-xs font-black tracking-wider text-cyan-300 uppercase">
            Pit Wall • HUD Ao Vivo
          </span>
          <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-mono text-[11px] px-2 py-0 font-bold">
            V {currentLap}/{totalLaps}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          {isRaceFinished && (
            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] uppercase font-bold animate-pulse">
              Finalizada
            </Badge>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Minimizar HUD"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Banner de Celebração de Pódio ao fim da corrida */}
      {isRaceFinished && podiumDrivers.length > 0 && (
        <div className="p-3 bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-amber-500/25 border-b border-amber-500/40 text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-amber-300 font-extrabold text-xs uppercase tracking-wider animate-bounce">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>RESULTADO HISTÓRICO!</span>
          </div>
          {podiumDrivers.map((pd) => (
            <p key={pd.driverId} className="text-xs text-white font-bold leading-tight">
              🎉 PÓDIO! {pd.driverName} terminou em {pd.position}º no GP de {gpCountry || gpName}!
            </p>
          ))}
        </div>
      )}

      {/* Banner / Botão de Ordem de Equipe (Pedir Passagem) */}
      {!isRaceFinished && (teamOrderProposal || teamOrderActive) && (
        <div className="p-2.5 bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 border-b border-amber-500/40 flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>ORDEM DE EQUIPE POSSÍVEL</span>
            </div>
            <p className="text-[10px] text-slate-300 leading-tight">
              {teamOrderProposal
                ? `${teamOrderProposal.fastDriverName} colado em ${teamOrderProposal.slowDriverName} (gap ${(teamOrderProposal.gap || 0.8).toFixed(1)}s)`
                : 'Ordem de equipe em andamento na pista'}
            </p>
          </div>
          {onApplyTeamOrder && !teamOrderActive && (
            <Button
              size="sm"
              onClick={onApplyTeamOrder}
              className="h-7 text-[10px] font-bold uppercase bg-amber-500 hover:bg-amber-400 text-black px-2.5 shadow-md shadow-amber-500/20 shrink-0"
            >
              Pedir passagem
            </Button>
          )}
          {teamOrderActive && (
            <Badge className="bg-amber-500/30 text-amber-300 border border-amber-400/50 text-[9px] uppercase font-bold animate-pulse">
              Em andamento
            </Badge>
          )}
        </div>
      )}

      {/* Grid com os pilotos do jogador */}
      <div className="p-3 space-y-2.5 max-h-[70vh] overflow-y-auto scrollbar-thin">
        {playerDrivers.map((driver) => {
          const currentTactical = tacticalModes[driver.driverId] || 'normal'
          const fuelPct = Math.max(0, Math.round(driver.fuelRemaining ?? 100))
          const tireCompound = driver.tireCompound || 'medio'
          const tireWear = Math.round(driver.tireWear || 5)
          const carParts = driver.carPartsHealth || []
          const zeroCondCount = carParts.filter((p) => (p.condition ?? 100) <= 0).length

          return (
            <div
              key={driver.driverId}
              className="p-2.5 rounded-xl bg-[#0B0F19]/90 border border-[#1E2638] space-y-2 relative"
            >
              {/* Piloto + Posição + Gap */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-1.5 h-6 rounded-full"
                    style={{ backgroundColor: driver.teamColor || '#E10600' }}
                  />
                  <div>
                    <span className="font-extrabold text-xs text-white block leading-tight">
                      {driver.driverName}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Gap líder: {driver.gapToLeader || '-'} • Gap frente:{' '}
                      {driver.gapToFront || '-'}
                    </span>
                  </div>
                </div>

                <div className="text-right flex items-center gap-1.5">
                  <Badge
                    className={`font-mono text-xs font-black ${
                      driver.dnf
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : driver.position <= 3
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-200 border border-slate-700'
                    }`}
                  >
                    {driver.dnf ? 'DNF' : `P${driver.position}`}
                  </Badge>
                </div>
              </div>

              {/* Status Pneu + Combustível */}
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                {/* Pneu */}
                <div className="p-1.5 rounded-lg bg-[#111726] border border-[#1E2638] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{ backgroundColor: compoundColorMap[tireCompound] || '#FFFFFF' }}
                    />
                    <span className="text-slate-300 capitalize text-[10px]">
                      {formatTireName(tireCompound).split(' ')[0]}
                    </span>
                  </div>
                  <span
                    className={`font-bold text-[10px] ${
                      tireWear > 80
                        ? 'text-red-400'
                        : tireWear > 60
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}
                  >
                    {tireWear}% desg.
                  </span>
                </div>

                {/* Combustível */}
                <div className="p-1.5 rounded-lg bg-[#111726] border border-[#1E2638] flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Fuel
                      className={`w-3.5 h-3.5 ${
                        fuelPct <= 5
                          ? 'text-red-400 animate-bounce'
                          : fuelPct < 20
                            ? 'text-amber-400'
                            : 'text-cyan-400'
                      }`}
                    />
                    <span className="text-slate-300 text-[10px]">Tanque</span>
                  </div>
                  <span
                    className={`font-bold text-[10px] ${
                      fuelPct <= 5
                        ? 'text-red-400 animate-pulse'
                        : fuelPct < 20
                          ? 'text-amber-400'
                          : 'text-cyan-300'
                    }`}
                  >
                    {fuelPct}%
                  </span>
                </div>
              </div>

              {/* Componentes (6 peças) */}
              {carParts.length > 0 && (
                <div className="p-1.5 rounded-lg bg-[#0F1420] border border-[#1B2232] space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-slate-400" /> Saúde dos 6 Componentes:
                    </span>
                    {zeroCondCount > 0 && (
                      <span className="text-red-400 font-bold animate-pulse text-[9px]">
                        🚨 {zeroCondCount} a 0%!
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {carParts.map((part) => {
                      const cond = Math.max(0, Math.round(part.condition ?? 100))
                      const isZero = cond <= 0
                      const isLow = cond <= 30
                      return (
                        <div
                          key={part.id}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center justify-between border ${
                            isZero
                              ? 'bg-red-500/25 border-red-500/60 text-red-300 animate-pulse'
                              : isLow
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                          title={`${part.name}: ${cond}% de integridade`}
                        >
                          <span className="truncate max-w-[60px]">{part.name.split(' ')[0]}</span>
                          <span className="font-bold ml-1">{cond}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Controles de Modo Tático (Normal, Ataque, Economizar) */}
              {!isRaceFinished && !driver.dnf && onChangeTacticalMode && (
                <div className="pt-1 flex items-center justify-between gap-1 text-[10px]">
                  <span className="text-slate-400 text-[9px] font-bold uppercase">Modo:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onChangeTacticalMode(driver.driverId, 'normal')}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all border ${
                        currentTactical === 'normal'
                          ? 'bg-slate-700 text-white border-slate-500 shadow-sm'
                          : 'bg-[#111726] text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      Padrão
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeTacticalMode(driver.driverId, 'attack')}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all border flex items-center gap-0.5 ${
                        currentTactical === 'attack'
                          ? 'bg-red-600 text-white border-red-400 shadow-[0_0_8px_#dc2626]'
                          : 'bg-[#111726] text-red-400 border-red-900/50 hover:bg-red-950/40'
                      }`}
                      title="Ataque: +3% ritmo, +25% consumo de combustível"
                    >
                      <Flame className="w-2.5 h-2.5" /> Ataque
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeTacticalMode(driver.driverId, 'save_fuel')}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all border flex items-center gap-0.5 ${
                        currentTactical === 'save_fuel'
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_8px_#059669]'
                          : 'bg-[#111726] text-emerald-400 border-emerald-900/50 hover:bg-emerald-950/40'
                      }`}
                      title="Economizar: -30% consumo de combustível, ritmo -1.2s/volta"
                    >
                      <Fuel className="w-2.5 h-2.5" /> Economizar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
