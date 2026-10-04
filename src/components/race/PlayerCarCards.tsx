import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Wrench,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import type { CanonicalRaceDriverState, DriverPaceMode } from '@/types/canonical-race-v2'
import type { TireCompound } from '@/types/f1'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { getCanonicalDriverMaster } from '@/lib/canonical-driver-database'
import { getTeamReducedLogoUrl } from '@/lib/team-reduced-logo-resolver'
import { CountryFlag } from '@/components/CountryFlag'

export interface PlayerCarCardsProps {
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

function getCompoundLabel(compound: TireCompound | string): string {
  const c = (compound || 'medio').toLowerCase()
  if (c.includes('macio') || c === 'soft') return 'MACIO'
  if (c.includes('duro') || c === 'hard') return 'DURO'
  if (c.includes('inter')) return 'INTERMEDIÁRIO'
  if (c.includes('chuva')) return 'CHUVA EXTREMA'
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

// Resolução de número do carro com fallback canônico
function resolveDriverCarNumber(driver: CanonicalRaceDriverState, slotIndex: number): number {
  if (driver.driverNumber) return driver.driverNumber
  const master = getCanonicalDriverMaster(driver.driverId)
  if (master?.sourceMbjData?.permanentNumber) return master.sourceMbjData.permanentNumber
  if (master?.sourceMbjData?.preferredNumber) return master.sourceMbjData.preferredNumber
  return slotIndex === 0 ? 9 : 10
}

export const PlayerCarCards: React.FC<PlayerCarCardsProps> = ({
  playerDrivers,
  currentLap,
  onRequestPit,
  onCancelPit,
  onSetPaceMode,
  onSetTargetCompound,
  onOpenStrategyModal,
  isRaceFinished,
  isRedFlagActive,
  onChangeSuspensionTyre,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {playerDrivers.map((driver, index) => {
        const carNumber = resolveDriverCarNumber(driver, index)
        const strat = driver.strategy
        const isDnf = driver.raceStatus === 'dnf' || driver.isDnf
        const isPitRequested = !!strat?.pitRequested || !!strat?.pitThisLap
        const master = getCanonicalDriverMaster(driver.driverId)
        const nationality = driver.nationality || master?.nationality || 'BR'
        const logoUrl = getTeamReducedLogoUrl(driver.teamName || driver.teamId)

        // Resolução de Foto
        const resolvedPhoto = resolveDriverPhoto({
          driverId: driver.driverId,
          name: driver.driverName,
          teamColor: driver.teamColor,
        })

        // Posição e Delta
        const posDelta = driver.gridPosition - driver.currentPosition

        // Cálculo de vida do pneu (100% - desgaste)
        const driverAny = driver as unknown as { tyreWear?: number }
        const wear =
          typeof driverAny.tyreWear === 'number'
            ? driverAny.tyreWear
            : Math.min(100, Math.round((driver.initialTyreWear || 0) + (driver.tyreAge || 0) * 2.8))
        const tyreLifePct = Math.max(0, 100 - wear)

        // Gaps
        const gapLeaderDisplay =
          driver.currentPosition === 1
            ? '0.000s'
            : driver.gap && driver.gap !== 'LÍDER'
              ? driver.gap
              : '—'
        const gapAheadDisplay =
          typeof driver.gapToFrontSec === 'number' ? `+${driver.gapToFrontSec.toFixed(1)}` : '—'
        const gapBehindDisplay =
          typeof strat?.gapBehind === 'number' ? `+${strat.gapBehind.toFixed(1)}` : '—'

        // Último pit stop derivado com segurança esportiva
        const lastPitDisplay =
          driver.pitStops > 0 ? `V${Math.max(1, currentLap - (driver.tyreAge || 0))}` : '—'

        // Janela de pit planejada
        const pitWindowDisplay = strat?.nextPitWindow
          ? `V${strat.nextPitWindow.startLap} – V${strat.nextPitWindow.endLap}`
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
            key={`player_card_${driver.driverId}`}
            className="bg-[#090d18] border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden text-white flex flex-col justify-between"
          >
            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* LINHA 1: CABEÇALHO DO PILOTO (NÚMERO, BANDEIRA, NOME, LOGO EQUIPE) */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
                <div className="flex items-center gap-2.5">
                  {/* Badge do Número */}
                  <div className="px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-950/60 text-emerald-400 font-mono font-black text-sm">
                    {carNumber}
                  </div>
                  <CountryFlag code={nationality} className="text-base" />
                  <div>
                    <h3 className="text-sm font-black tracking-wider uppercase text-white flex items-center gap-2">
                      {driver.driverName}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[11px] font-sans text-slate-400 mt-0.5">
                      {logoUrl && (
                        <img
                          src={logoUrl}
                          alt={driver.teamName}
                          className="w-3.5 h-3.5 object-contain"
                        />
                      )}
                      <span
                        className="font-semibold"
                        style={{ color: driver.teamColor || '#94a3b8' }}
                      >
                        {driver.teamName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bloco de Posição e Gaps no Topo do Card */}
                <div className="flex items-center gap-4 text-right">
                  {/* Posição Grande com Delta ▲/▼ */}
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-widest font-mono">
                      POSIÇÃO
                    </span>
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="text-2xl font-black font-mono text-white leading-none">
                        P{driver.currentPosition}
                      </span>
                      {posDelta !== 0 && !isDnf && (
                        <span
                          className={`text-xs font-mono font-black flex items-center ${
                            posDelta > 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {posDelta > 0 ? (
                            <>
                              <ArrowUp className="w-3 h-3" />
                              {posDelta}
                            </>
                          ) : (
                            <>
                              <ArrowDown className="w-3 h-3" />
                              {Math.abs(posDelta)}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Gaps: Líder, À Frente, Atrás */}
                  <div className="hidden sm:block text-[11px] font-mono border-l border-slate-800/80 pl-3 space-y-0.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 text-[10px]">GAP LÍDER</span>
                      <span className="text-slate-200 font-bold">{gapLeaderDisplay}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 text-[10px]">À FRENTE</span>
                      <span className="text-slate-300 font-semibold">{gapAheadDisplay}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 text-[10px]">ATRÁS</span>
                      <span className="text-slate-300 font-semibold">{gapBehindDisplay}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* LINHA 2: CORPO PRINCIPAL COM FOTO, PNEU/VIDA E TELEMETRIA */}
              <div className="grid grid-cols-12 gap-3 sm:gap-4 items-center">
                {/* FOTO DO PILOTO */}
                <div className="col-span-4 sm:col-span-3 flex justify-center">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#0f172a] border border-slate-700/60 overflow-hidden relative shadow-md flex items-center justify-center">
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
                      <span className="text-xl font-black text-slate-400 font-mono">
                        {resolvedPhoto.fallbackInitials}
                      </span>
                    )}
                  </div>
                </div>

                {/* BLOCO DE PNEUS: CÍRCULO DO COMPOSTO + % VIDA + BARRA */}
                <div className="col-span-8 sm:col-span-5 space-y-2">
                  <div className="flex items-center gap-3">
                    {/* Círculo do Composto com Letra F1 */}
                    <div
                      className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-mono font-black text-xl shadow-inner ${tyreStyles.circle}`}
                    >
                      {currentCompoundLetter}
                    </div>

                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                        {getCompoundLabel(driver.tyreCompound)}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {driver.tyreAge} voltas de uso
                      </span>
                      <span className="text-xs font-mono font-black text-slate-200 mt-0.5">
                        {tyreLifePct}% vida
                      </span>
                    </div>
                  </div>

                  {/* Barra horizontal de vida do pneu */}
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${tyreStyles.bar}`}
                      style={{ width: `${tyreLifePct}%` }}
                    />
                  </div>
                </div>

                {/* TELEMETRIA: ÚLTIMA VOLTA, MELHOR VOLTA, STINT MÉDIO */}
                <div className="col-span-12 sm:col-span-4 bg-[#0e1628] p-2.5 rounded-xl border border-slate-800/80 font-mono text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[10px] uppercase font-sans">
                      ÚLTIMA VOLTA
                    </span>
                    <span className="font-bold text-slate-200">
                      {driver.lastLapTimeFormatted || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[10px] uppercase font-sans">
                      MELHOR VOLTA
                    </span>
                    <span className="font-bold text-purple-300">
                      {driver.bestLapFormatted || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[10px] uppercase font-sans">
                      STINT MÉDIO
                    </span>
                    <span className="font-bold text-slate-500">—</span>
                  </div>
                </div>
              </div>

              {/* LINHA 3: RODAPÉ DE GESTÃO DO CARRO (PIT STOPS, ÚLTIMO PIT, JANELA, ESTRATÉGIA, STATUS) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-800/60 text-xs font-mono">
                {/* PIT STOPS */}
                <div className="bg-[#0e1628] p-2 rounded-xl border border-slate-800/60">
                  <span className="text-[9px] uppercase font-sans font-bold text-slate-400 block">
                    PIT STOPS
                  </span>
                  <span className="font-black text-white text-xs mt-0.5 block">
                    🔧 {driver.pitStops} PIT{driver.pitStops !== 1 ? 'S' : ''}
                  </span>
                </div>

                {/* ÚLTIMO PIT */}
                <div className="bg-[#0e1628] p-2 rounded-xl border border-slate-800/60">
                  <span className="text-[9px] uppercase font-sans font-bold text-slate-400 block">
                    ÚLTIMO PIT
                  </span>
                  <span className="font-black text-slate-200 text-xs mt-0.5 block">
                    {lastPitDisplay}
                  </span>
                </div>

                {/* JANELA BOX */}
                <div className="bg-[#0e1628] p-2 rounded-xl border border-slate-800/60">
                  <span className="text-[9px] uppercase font-sans font-bold text-slate-400 block">
                    JANELA BOX
                  </span>
                  <span className="font-black text-cyan-400 text-xs mt-0.5 block">
                    {pitWindowDisplay}
                  </span>
                </div>

                {/* ESTRATÉGIA */}
                <div className="bg-[#0e1628] p-2 rounded-xl border border-slate-800/60">
                  <span className="text-[9px] uppercase font-sans font-bold text-slate-400 block">
                    ESTRATÉGIA
                  </span>
                  <span className="font-black text-amber-300 text-xs mt-0.5 block">
                    {currentCompoundLetter} → {targetCompoundLetter}
                  </span>
                </div>

                {/* ESTADO DO CARRO */}
                <div className="col-span-2 sm:col-span-1 bg-[#0e1628] p-2 rounded-xl border border-slate-800/60">
                  <span className="text-[9px] uppercase font-sans font-bold text-slate-400 block">
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
                    <span className="font-black text-xs text-slate-200 uppercase">
                      {driver.carCondition >= 80 ? 'NORMAL' : 'AVARIADO'}
                    </span>
                  </div>
                </div>
              </div>

              {/* LINHA 4: BOTÕES DE AÇÃO: BOX PRÓXIMA VOLTA / ESTRATÉGIA */}
              <div className="grid grid-cols-2 gap-2 pt-1">
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
                    className="h-10 text-xs font-black bg-purple-600 hover:bg-purple-500 text-white gap-2 shadow-md uppercase"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    TROCAR NA SUSPENSÃO
                  </Button>
                ) : isPitRequested ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isDnf || isRaceFinished}
                    onClick={() => onCancelPit(driver.driverId)}
                    className="h-10 text-xs font-black bg-amber-600 hover:bg-amber-500 text-white animate-pulse gap-2 shadow-md uppercase"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    CANCELAR BOX
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isDnf || isRaceFinished}
                    onClick={() => onRequestPit(driver.driverId, targetCompound)}
                    className="h-10 text-xs font-black bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 hover:text-white gap-2 shadow-md uppercase tracking-wide"
                  >
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    BOX PRÓXIMA VOLTA
                  </Button>
                )}

                {/* Botão de Estratégia */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isDnf || isRaceFinished}
                  onClick={() => onOpenStrategyModal?.(driver)}
                  className="h-10 text-xs font-black bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 hover:text-white gap-2 shadow-md uppercase tracking-wide"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                  ESTRATÉGIA
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
