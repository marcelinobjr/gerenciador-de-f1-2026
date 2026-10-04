import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Wrench, SlidersHorizontal, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react'
import type { CanonicalRaceDriverState, DriverPaceMode } from '@/types/canonical-race-v2'
import type { TireCompound } from '@/types/f1'
import { getCanonicalDriverMaster } from '@/lib/canonical-driver-database'
import { getTeamReducedLogoUrl } from '@/lib/team-reduced-logo-resolver'
import { CountryFlag } from '@/components/CountryFlag'

export interface CompactPlayerCarStripsProps {
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
  bar: string
  text: string
} {
  const c = (compound || 'medio').toLowerCase()
  if (c.includes('macio') || c === 'soft') {
    return {
      circle: 'border-red-500 text-red-400 bg-red-950/50',
      bar: 'bg-red-500',
      text: 'text-red-400',
    }
  }
  if (c.includes('duro') || c === 'hard') {
    return {
      circle: 'border-slate-300 text-slate-200 bg-slate-900/60',
      bar: 'bg-slate-300',
      text: 'text-slate-200',
    }
  }
  if (c.includes('inter')) {
    return {
      circle: 'border-emerald-500 text-emerald-400 bg-emerald-950/50',
      bar: 'bg-emerald-500',
      text: 'text-emerald-400',
    }
  }
  if (c.includes('chuva')) {
    return {
      circle: 'border-blue-500 text-blue-400 bg-blue-950/50',
      bar: 'bg-blue-500',
      text: 'text-blue-400',
    }
  }
  return {
    circle: 'border-yellow-400 text-yellow-400 bg-yellow-950/50',
    bar: 'bg-yellow-400',
    text: 'text-yellow-400',
  }
}

function resolveDriverCarNumber(driver: CanonicalRaceDriverState, slotIndex: number): number {
  if (driver.driverNumber) return driver.driverNumber
  const master = getCanonicalDriverMaster(driver.driverId)
  if (master?.sourceMbjData?.permanentNumber) return master.sourceMbjData.permanentNumber
  if (master?.sourceMbjData?.preferredNumber) return master.sourceMbjData.preferredNumber
  return slotIndex === 0 ? 9 : 10
}

export const CompactPlayerCarStrips: React.FC<CompactPlayerCarStripsProps> = ({
  playerDrivers,
  currentLap,
  onRequestPit,
  onCancelPit,
  onOpenStrategyModal,
  isRaceFinished,
  isRedFlagActive,
  onChangeSuspensionTyre,
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {playerDrivers.map((driver, index) => {
        const carNumber = resolveDriverCarNumber(driver, index)
        const strat = driver.strategy
        const isDnf = driver.raceStatus === 'dnf' || driver.isDnf
        const isPitRequested = !!strat?.pitRequested || !!strat?.pitThisLap
        const master = getCanonicalDriverMaster(driver.driverId)
        const nationality = driver.nationality || master?.nationality || 'BR'
        const logoUrl = getTeamReducedLogoUrl(driver.teamName || driver.teamId)

        // Posição e Delta
        const posDelta = driver.gridPosition - driver.currentPosition

        // Cálculo de vida do pneu (100% - desgaste)
        const driverAny = driver as unknown as { tyreWear?: number }
        const wear =
          typeof driverAny.tyreWear === 'number'
            ? driverAny.tyreWear
            : Math.min(100, Math.round((driver.initialTyreWear || 0) + (driver.tyreAge || 0) * 2.8))
        const tyreLifePct = Math.max(0, 100 - wear)

        // Gaps à frente e atrás
        const gapAheadDisplay =
          typeof driver.gapToFrontSec === 'number' ? `+${driver.gapToFrontSec.toFixed(1)}s` : '—'
        const gapBehindDisplay =
          typeof strat?.gapBehind === 'number' ? `+${strat.gapBehind.toFixed(1)}s` : '—'

        // Janela de pit planejada
        const pitWindowDisplay = strat?.nextPitWindow
          ? `V${strat.nextPitWindow.startLap}–${strat.nextPitWindow.endLap}`
          : '—'

        // Estratégia de compostos (composto atual -> alvo)
        const targetCompound =
          strat?.targetCompound || (driver.tyreCompound === 'macio' ? 'medio' : 'duro')
        const currentCompoundLetter = getCompoundLetter(driver.tyreCompound)
        const targetCompoundLetter = getCompoundLetter(targetCompound)

        // Estilos de pneu
        const tyreStyles = getCompoundColor(driver.tyreCompound)

        return (
          <Card
            key={`compact_player_strip_${driver.driverId}`}
            className="bg-[#090d18] border border-slate-800/80 rounded-xl shadow-md overflow-hidden text-white"
          >
            <CardContent className="p-2 sm:p-2.5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 text-xs font-mono">
              {/* SEÇÃO 1: NÚMERO, BANDEIRA, NOME, LOGO, POSIÇÃO COM GANHO/PERDA */}
              <div className="flex items-center gap-2 min-w-[190px] shrink-0">
                {/* Número do Carro */}
                <span className="w-6 h-6 rounded-md border border-emerald-500/40 bg-emerald-950/60 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
                  {carNumber}
                </span>

                <CountryFlag code={nationality} className="text-xs shrink-0" />

                {/* Nome e Equipe */}
                <div className="truncate max-w-[110px] sm:max-w-[130px]">
                  <div className="font-black text-xs uppercase tracking-tight text-white truncate flex items-center gap-1">
                    {driver.driverName}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 truncate">
                    {logoUrl && (
                      <img
                        src={logoUrl}
                        alt=""
                        className="w-3 h-3 object-contain inline-block shrink-0"
                      />
                    )}
                    <span className="truncate">{driver.teamName}</span>
                  </div>
                </div>

                {/* Posição P# com delta */}
                <div className="flex items-center gap-1 ml-auto sm:ml-1 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
                  <span className="font-black text-xs text-white">P{driver.currentPosition}</span>
                  {posDelta !== 0 && !isDnf && (
                    <span
                      className={`text-[10px] font-black flex items-center ${
                        posDelta > 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
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

              {/* SEÇÃO 2: PNEU (COMPOSTO, IDADE, VIDA %) COM MINI BARRA */}
              <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#0d1527] border border-slate-800/80 shrink-0">
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-black shrink-0 ${tyreStyles.circle}`}
                  title={`${driver.tyreCompound} (${driver.tyreAge} voltas)`}
                >
                  {currentCompoundLetter}
                </span>
                <div className="flex flex-col text-[10px] leading-tight">
                  <div className="flex items-center gap-1 text-slate-300 font-bold">
                    <span>{driver.tyreAge}v</span>
                    <span className="text-slate-500">•</span>
                    <span className={tyreStyles.text}>{tyreLifePct}%</span>
                  </div>
                  <div className="w-14 h-1 rounded-full bg-slate-800 overflow-hidden mt-0.5">
                    <div
                      className={`h-full rounded-full ${tyreStyles.bar}`}
                      style={{ width: `${tyreLifePct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 3: GAPS (À FRENTE, ATRÁS) */}
              <div className="hidden sm:flex items-center gap-2 text-[10px] px-2 py-1 rounded bg-[#0d1527] border border-slate-800/80 shrink-0">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-sans">
                    À FRENTE
                  </span>
                  <span className="text-slate-200 font-bold">{gapAheadDisplay}</span>
                </div>
                <span className="text-slate-700">|</span>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-sans">ATRÁS</span>
                  <span className="text-slate-200 font-bold">{gapBehindDisplay}</span>
                </div>
              </div>

              {/* SEÇÃO 4: TELEMETRIA (ÚLTIMA VOLTA, MELHOR VOLTA) */}
              <div className="hidden md:flex items-center gap-2 text-[10px] px-2 py-1 rounded bg-[#0d1527] border border-slate-800/80 shrink-0">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-sans">
                    ÚLT. VOLTA
                  </span>
                  <span className="text-slate-200 font-bold">
                    {driver.lastLapTimeFormatted || '—'}
                  </span>
                </div>
                <span className="text-slate-700">|</span>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-sans">
                    MELHOR
                  </span>
                  <span className="text-purple-300 font-bold">
                    {driver.bestLapFormatted || '—'}
                  </span>
                </div>
              </div>

              {/* SEÇÃO 5: BOX (Nº PITS, JANELA, ESTRATÉGIA, ESTADO CARRO) */}
              <div className="flex items-center gap-2 text-[10px] px-2 py-1 rounded bg-[#0d1527] border border-slate-800/80 shrink-0">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-sans">PITS</span>
                  <span className="text-white font-black">{driver.pitStops}</span>
                </div>
                <span className="text-slate-700">|</span>
                <div className="hidden sm:block">
                  <span className="text-slate-500 block text-[9px] uppercase font-sans">
                    JANELA
                  </span>
                  <span className="text-cyan-400 font-bold">{pitWindowDisplay}</span>
                </div>
                <span className="hidden sm:inline text-slate-700">|</span>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-sans">
                    ESTRAT.
                  </span>
                  <span className="text-amber-300 font-bold">
                    {currentCompoundLetter}→{targetCompoundLetter}
                  </span>
                </div>
                <span className="text-slate-700">|</span>
                <div title={driver.carCondition >= 80 ? 'Carro normal' : 'Carro avariado'}>
                  <span className="text-slate-500 block text-[9px] uppercase font-sans">CARRO</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        driver.carCondition >= 80
                          ? 'bg-emerald-400'
                          : driver.carCondition >= 50
                            ? 'bg-yellow-400'
                            : 'bg-red-400'
                      }`}
                    />
                    <span className="text-[10px] text-slate-300 font-semibold">
                      {driver.carCondition}%
                    </span>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 6: BOTÕES DE AÇÃO BOX E ESTRATÉGIA */}
              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                {/* Botão de Box */}
                {isRedFlagActive ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isDnf || isRaceFinished}
                    onClick={() => {
                      if (onChangeSuspensionTyre) {
                        onChangeSuspensionTyre(driver.driverId, targetCompound)
                      } else {
                        onRequestPit(driver.driverId, targetCompound)
                      }
                    }}
                    className="h-7 px-2.5 text-[10px] font-black bg-purple-600 hover:bg-purple-500 text-white gap-1 shadow-xs uppercase rounded-lg"
                  >
                    <Wrench className="w-3 h-3" />
                    TROCAR
                  </Button>
                ) : isPitRequested ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isDnf || isRaceFinished}
                    onClick={() => onCancelPit(driver.driverId)}
                    className="h-7 px-2.5 text-[10px] font-black bg-amber-600 hover:bg-amber-500 text-white animate-pulse gap-1 shadow-xs uppercase rounded-lg"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    CANCELAR
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isDnf || isRaceFinished}
                    onClick={() => onRequestPit(driver.driverId, targetCompound)}
                    className="h-7 px-2.5 text-[10px] font-black bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 hover:text-white gap-1 shadow-xs uppercase rounded-lg"
                  >
                    <Wrench className="w-3 h-3 text-amber-400" />
                    BOX
                  </Button>
                )}

                {/* Botão de Estratégia */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isDnf || isRaceFinished}
                  onClick={() => onOpenStrategyModal?.(driver)}
                  className="h-7 px-2 text-[10px] font-black bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 hover:text-white gap-1 shadow-xs uppercase rounded-lg"
                  title="Abre estratégias detalhadas e pit plan"
                >
                  <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
                  <span className="hidden sm:inline">ESTRATÉGIA</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
