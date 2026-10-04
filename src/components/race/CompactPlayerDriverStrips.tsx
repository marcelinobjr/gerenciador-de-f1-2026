import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Wrench, SlidersHorizontal, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react'
import type { CanonicalRaceDriverState, DriverPaceMode } from '@/types/canonical-race-v2'
import type { TireCompound } from '@/types/f1'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { getCanonicalDriverMaster } from '@/lib/canonical-driver-database'
import { getTeamReducedLogoUrl } from '@/lib/team-reduced-logo-resolver'
import { CountryFlag } from '@/components/CountryFlag'

export interface CompactPlayerDriverStripsProps {
  playerDrivers: CanonicalRaceDriverState[]
  currentLap: number
  onRequestPit: (driverId: string, compound?: TireCompound) => void
  onCancelPit: (driverId: string) => void
  onSetPaceMode: (driverId: string, mode: DriverPaceMode) => void
  onSetTargetCompound: (driverId: string, compound: TireCompound) => void
  onOpenStrategyModal?: (driver: CanonicalRaceDriverState) => void
  isRaceFinished?: boolean
  isRedFlagActive?: boolean
  onChangeSuspensionTyre?: (driverId: string, compound: TireCompound) => void
  isActionBlocked?: boolean
}

function getCompoundLabel(compound: TireCompound | string): string {
  const c = (compound || 'medio').toLowerCase()
  if (c.includes('macio') || c === 'soft') return 'MACIO'
  if (c.includes('duro') || c === 'hard') return 'DURO'
  if (c.includes('inter')) return 'INTER'
  if (c.includes('chuva')) return 'CHUVA'
  return 'MÉDIO'
}

function getCompoundLetter(compound: TireCompound | string): string {
  const c = (compound || 'medio').toLowerCase()
  if (c.includes('macio') || c === 'soft') return 'S'
  if (c.includes('duro') || c === 'hard') return 'H'
  if (c.includes('inter')) return 'I'
  if (c.includes('chuva')) return 'W'
  return 'M'
}

function getCompoundColor(compound: TireCompound | string): {
  circle: string
  text: string
  bar: string
} {
  const c = (compound || 'medio').toLowerCase()
  if (c.includes('macio') || c === 'soft') {
    return {
      circle: 'border-red-500 text-red-400 bg-red-950/40',
      text: 'text-red-400',
      bar: 'bg-red-500',
    }
  }
  if (c.includes('duro') || c === 'hard') {
    return {
      circle: 'border-slate-300 text-slate-200 bg-slate-900/60',
      text: 'text-slate-200',
      bar: 'bg-slate-300',
    }
  }
  if (c.includes('inter')) {
    return {
      circle: 'border-emerald-500 text-emerald-400 bg-emerald-950/40',
      text: 'text-emerald-400',
      bar: 'bg-emerald-500',
    }
  }
  if (c.includes('chuva')) {
    return {
      circle: 'border-blue-500 text-blue-400 bg-blue-950/40',
      text: 'text-blue-400',
      bar: 'bg-blue-500',
    }
  }
  return {
    circle: 'border-yellow-400 text-yellow-400 bg-yellow-950/40',
    text: 'text-yellow-400',
    bar: 'bg-yellow-400',
  }
}

function resolveDriverCarNumber(driver: CanonicalRaceDriverState, slotIndex: number): number {
  if (driver.driverNumber) return driver.driverNumber
  const master = getCanonicalDriverMaster(driver.driverId)
  if (master?.sourceMbjData?.permanentNumber) return master.sourceMbjData.permanentNumber
  if (master?.sourceMbjData?.preferredNumber) return master.sourceMbjData.preferredNumber
  return slotIndex === 0 ? 9 : 10
}

export const CompactPlayerDriverStrips: React.FC<CompactPlayerDriverStripsProps> = ({
  playerDrivers,
  currentLap,
  onRequestPit,
  onCancelPit,
  onSetPaceMode: _onSetPaceMode,
  onSetTargetCompound: _onSetTargetCompound,
  onOpenStrategyModal,
  isRaceFinished,
  isRedFlagActive,
  onChangeSuspensionTyre,
  isActionBlocked = false,
}) => {
  return (
    <div className="space-y-2">
      {playerDrivers.map((driver, index) => {
        const carNumber = resolveDriverCarNumber(driver, index)
        const strat = driver.strategy
        const isDnf = driver.raceStatus === 'dnf' || driver.isDnf
        const isPitRequested = !!strat?.pitRequested || !!strat?.pitThisLap
        const master = getCanonicalDriverMaster(driver.driverId)
        const nationality = driver.nationality || master?.nationality || 'BR'
        const logoUrl = getTeamReducedLogoUrl(driver.teamName || driver.teamId)

        const resolvedPhoto = resolveDriverPhoto({
          driverId: driver.driverId,
          name: driver.driverName,
          teamColor: driver.teamColor,
        })

        const posDelta = driver.gridPosition - driver.currentPosition

        const driverAny = driver as unknown as { tyreWear?: number }
        const wear =
          typeof driverAny.tyreWear === 'number'
            ? driverAny.tyreWear
            : Math.min(100, Math.round((driver.initialTyreWear || 0) + (driver.tyreAge || 0) * 2.8))
        const tyreLifePct = Math.max(0, 100 - wear)

        const gapAheadDisplay =
          typeof driver.gapToFrontSec === 'number' ? `+${driver.gapToFrontSec.toFixed(1)}s` : '—'
        const gapBehindDisplay =
          typeof strat?.gapBehind === 'number' ? `+${strat.gapBehind.toFixed(1)}s` : '—'

        const pitWindowDisplay = strat?.nextPitWindow
          ? `V${strat.nextPitWindow.startLap}–V${strat.nextPitWindow.endLap}`
          : '—'

        const targetCompound =
          strat?.targetCompound || (driver.tyreCompound === 'macio' ? 'medio' : 'duro')
        const currentCompoundLetter = getCompoundLetter(driver.tyreCompound)
        const targetCompoundLetter = getCompoundLetter(targetCompound)

        const tyreStyles = getCompoundColor(driver.tyreCompound)

        return (
          <Card
            key={`compact_strip_${driver.driverId}`}
            className="bg-[#090d18] border border-slate-800/80 rounded-xl shadow-md overflow-hidden text-white"
          >
            <CardContent className="p-2 sm:p-2.5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                {/* PILOTO: FOTO + NOME + POSIÇÃO + DELTA */}
                <div className="flex items-center gap-2.5 min-w-[210px] shrink-0">
                  <div className="w-10 h-10 rounded-lg bg-[#0f172a] border border-slate-700/60 overflow-hidden relative shadow-xs flex items-center justify-center shrink-0">
                    {resolvedPhoto.url ? (
                      <img
                        src={resolvedPhoto.url}
                        alt={driver.driverName}
                        className="w-full h-full object-cover object-top"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <span className="text-xs font-black text-slate-400 font-mono">
                        {resolvedPhoto.fallbackInitials}
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.2 rounded border border-emerald-500/40 bg-emerald-950/60 text-emerald-400 font-mono font-black text-[10px]">
                        #{carNumber}
                      </span>
                      <CountryFlag code={nationality} className="text-xs shrink-0" />
                      <h4
                        className="text-xs font-black uppercase text-white truncate max-w-[120px]"
                        title={driver.driverName}
                      >
                        {driver.driverName}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      {logoUrl && (
                        <img
                          src={logoUrl}
                          alt={driver.teamName}
                          className="w-3 h-3 object-contain shrink-0"
                        />
                      )}
                      <span className="truncate font-semibold text-slate-300">
                        {driver.teamName}
                      </span>
                    </div>
                  </div>

                  {/* POSIÇÃO E GANHO/PERDA */}
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#0e1628] border border-slate-800 shrink-0">
                    <span className="text-sm font-black font-mono text-white leading-none">
                      P{driver.currentPosition}
                    </span>
                    {posDelta !== 0 && !isDnf && (
                      <span
                        className={`text-[10px] font-mono font-black flex items-center ${
                          posDelta > 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                        title={`Largou em P${driver.gridPosition}`}
                      >
                        {posDelta > 0 ? (
                          <>
                            <ArrowUp className="w-2.5 h-2.5" />
                            {posDelta}
                          </>
                        ) : (
                          <>
                            <ArrowDown className="w-2.5 h-2.5" />
                            {Math.abs(posDelta)}
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* MÉTRICAS CENTRAIS: PNEU, GAPS, VOLTAS, PITS, JANELA, ESTADO */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-[11px] font-mono flex-1">
                  {/* PNEU + DESGASTE + IDADE */}
                  <div className="bg-[#0e1628] px-2 py-1 rounded-md border border-slate-800/60">
                    <span className="text-[9px] uppercase font-sans text-slate-400 block leading-tight">
                      PNEU
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center font-bold text-[9px] ${tyreStyles.circle}`}
                      >
                        {currentCompoundLetter}
                      </span>
                      <span className="text-[10px] font-bold text-slate-200">
                        {tyreLifePct}% ({driver.tyreAge}v)
                      </span>
                    </div>
                  </div>

                  {/* GAPS (FRENTE / ATRÁS) */}
                  <div className="bg-[#0e1628] px-2 py-1 rounded-md border border-slate-800/60">
                    <span className="text-[9px] uppercase font-sans text-slate-400 block leading-tight">
                      GAPS
                    </span>
                    <div className="text-[10px] font-bold text-slate-200 mt-0.5 flex items-center gap-1">
                      <span className="text-slate-400 font-normal">▲</span>
                      <span>{gapAheadDisplay}</span>
                      <span className="text-slate-500 font-normal">/</span>
                      <span className="text-slate-400 font-normal">▼</span>
                      <span>{gapBehindDisplay}</span>
                    </div>
                  </div>

                  {/* ÚLTIMA VOLTA / MELHOR VOLTA */}
                  <div className="bg-[#0e1628] px-2 py-1 rounded-md border border-slate-800/60">
                    <span className="text-[9px] uppercase font-sans text-slate-400 block leading-tight">
                      TEMPOS
                    </span>
                    <div className="text-[10px] font-bold mt-0.5 truncate">
                      <span className="text-slate-300">{driver.lastLapTimeFormatted || '—'}</span>
                      {driver.bestLapFormatted && (
                        <span className="text-purple-300 ml-1 text-[9px]">
                          ★{driver.bestLapFormatted}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* PITS E JANELA */}
                  <div className="bg-[#0e1628] px-2 py-1 rounded-md border border-slate-800/60">
                    <span className="text-[9px] uppercase font-sans text-slate-400 block leading-tight">
                      BOX / JANELA
                    </span>
                    <div className="text-[10px] font-bold text-cyan-300 mt-0.5 truncate">
                      {driver.pitStops} pit{driver.pitStops !== 1 ? 's' : ''} • {pitWindowDisplay}
                    </div>
                  </div>

                  {/* ESTRATÉGIA RESUMIDA */}
                  <div className="bg-[#0e1628] px-2 py-1 rounded-md border border-slate-800/60">
                    <span className="text-[9px] uppercase font-sans text-slate-400 block leading-tight">
                      ESTRATÉGIA
                    </span>
                    <div className="text-[10px] font-bold text-amber-300 mt-0.5 flex items-center gap-1">
                      <span>{currentCompoundLetter}</span>
                      <span className="text-slate-400">→</span>
                      <span>{targetCompoundLetter}</span>
                      <span className="text-slate-400 text-[9px]">
                        ({getCompoundLabel(targetCompound)})
                      </span>
                    </div>
                  </div>

                  {/* ESTADO DO CARRO */}
                  <div className="bg-[#0e1628] px-2 py-1 rounded-md border border-slate-800/60">
                    <span className="text-[9px] uppercase font-sans text-slate-400 block leading-tight">
                      CARRO
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          driver.carCondition >= 80
                            ? 'bg-emerald-400'
                            : driver.carCondition >= 50
                              ? 'bg-yellow-400'
                              : 'bg-red-400'
                        }`}
                      />
                      <span className="text-[10px] font-bold text-slate-200 uppercase">
                        {driver.carCondition >= 80 ? 'OK' : 'AVARIADO'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* BOTÕES DE AÇÃO COMPACTOS: BOX + ESTRATÉGIA */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isRedFlagActive ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isDnf || isRaceFinished || isActionBlocked}
                      onClick={() => {
                        if (onChangeSuspensionTyre) {
                          onChangeSuspensionTyre(driver.driverId, targetCompound)
                        } else {
                          onRequestPit(driver.driverId, targetCompound)
                        }
                      }}
                      className="h-8 px-2.5 text-[11px] font-black bg-purple-600 hover:bg-purple-500 text-white gap-1 shadow-sm uppercase"
                    >
                      <Wrench className="w-3 h-3" />
                      TROCAR (SUSP.)
                    </Button>
                  ) : isPitRequested ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isDnf || isRaceFinished || isActionBlocked}
                      onClick={() => onCancelPit(driver.driverId)}
                      className="h-8 px-2.5 text-[11px] font-black bg-amber-600 hover:bg-amber-500 text-white animate-pulse gap-1 shadow-sm uppercase"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      CANCELAR BOX
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isDnf || isRaceFinished || isActionBlocked}
                      onClick={() => onRequestPit(driver.driverId, targetCompound)}
                      className="h-8 px-2.5 text-[11px] font-black bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 hover:text-white gap-1 shadow-sm uppercase tracking-tight"
                    >
                      <Wrench className="w-3 h-3 text-amber-400" />
                      BOX
                    </Button>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isDnf || isRaceFinished || isActionBlocked}
                    onClick={() => onOpenStrategyModal?.(driver)}
                    className="h-8 px-2.5 text-[11px] font-black bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 hover:text-white gap-1 shadow-sm uppercase tracking-tight"
                  >
                    <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
                    ESTRATÉGIA
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
