import React from 'react'
import type { CanonicalRaceDriverState } from '@/types/canonical-race-v2'
import type { TireCompound } from '@/types/f1'
import { getTeamReducedLogoUrl } from '@/lib/team-reduced-logo-resolver'

export interface TimingTowerProps {
  drivers: CanonicalRaceDriverState[]
  totalLaps: number
  playerDriverIds?: string[]
}

// Extrai sobrenome em caixa alta para a torre oficial F1
function extractLastName(fullName: string): string {
  if (!fullName) return 'PILOTO'
  const parts = fullName.trim().split(/\s+/)
  return parts[parts.length - 1].toUpperCase()
}

// Retorna cor e letra padrão de composto oficial F1
function getTyreBadge(compound: TireCompound | string) {
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

export const TimingTower: React.FC<TimingTowerProps> = ({ drivers }) => {
  return (
    <aside className="w-full lg:w-72 xl:w-80 shrink-0 bg-[#090d18] border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden flex flex-col">
      {/* Header da Torre */}
      <div className="grid grid-cols-12 items-center px-2.5 py-2 bg-[#0e1628] border-b border-slate-800 text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase select-none">
        <span className="col-span-2 text-center">POS</span>
        <span className="col-span-5 pl-1">PILOTO</span>
        <span className="col-span-2 text-center">EQUIPE</span>
        <span className="col-span-1 text-center">PNEU</span>
        <span className="col-span-2 text-right pr-1">GAP</span>
      </div>

      {/* Lista de Pilotos (P1 a P24) */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
        {drivers.map((driver) => {
          const isPlayer = !!driver.isPlayer
          const isDnf = driver.raceStatus === 'dnf' || driver.isDnf
          const lastName = extractLastName(driver.driverName)
          const logoUrl = getTeamReducedLogoUrl(driver.teamName || driver.teamId)
          const tyre = getTyreBadge(driver.tyreCompound)

          // Formatação do GAP canônico
          let gapDisplay = '—'
          if (isDnf) {
            gapDisplay = 'DNF'
          } else if (driver.currentPosition === 1) {
            gapDisplay = '—'
          } else if (typeof driver.gapToFrontSec === 'number') {
            gapDisplay = `+${driver.gapToFrontSec.toFixed(3)}`
          } else if (driver.gap && driver.gap !== '0.000s' && driver.gap !== 'LÍDER') {
            gapDisplay = driver.gap
          }

          return (
            <div
              key={`tower_${driver.driverId}`}
              className={`grid grid-cols-12 items-center px-2 py-1.5 text-xs font-mono transition-colors ${
                isDnf
                  ? 'bg-slate-950/60 opacity-40 text-slate-500'
                  : isPlayer
                    ? 'bg-emerald-950/40 border-l-4 border-l-emerald-400 hover:bg-emerald-950/60 text-white font-bold'
                    : 'hover:bg-slate-800/50 text-slate-200'
              }`}
            >
              {/* POS */}
              <div className="col-span-2 flex items-center justify-center">
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black ${
                    driver.currentPosition === 1
                      ? 'bg-amber-400 text-black font-black'
                      : driver.currentPosition <= 3
                        ? 'bg-slate-300 text-black font-extrabold'
                        : isPlayer
                          ? 'bg-emerald-500 text-black font-black'
                          : 'bg-slate-800/80 text-slate-300'
                  }`}
                >
                  {driver.currentPosition}
                </span>
              </div>

              {/* BARRA DE COR DA EQUIPE + SOBRENOME */}
              <div className="col-span-5 flex items-center gap-1.5 pl-1 truncate">
                <span
                  className="w-1 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: driver.teamColor || '#64748b' }}
                />
                <span
                  className={`truncate uppercase tracking-tight text-[11px] ${
                    isPlayer ? 'text-emerald-300 font-black' : 'text-slate-100 font-semibold'
                  }`}
                  title={driver.driverName}
                >
                  {lastName}
                </span>
              </div>

              {/* LOGO DA EQUIPE */}
              <div className="col-span-2 flex items-center justify-center">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={driver.teamName}
                    className="w-4 h-4 rounded-xs object-contain bg-slate-900 border border-slate-700/60 p-0.5 shrink-0"
                  />
                ) : (
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: driver.teamColor || '#64748b' }}
                    title={driver.teamName}
                  />
                )}
              </div>

              {/* PNEU (Círculo colorido com S/M/H/I/W) */}
              <div className="col-span-1 flex items-center justify-center">
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-black ${tyre.color}`}
                  title={`${driver.tyreCompound} (${driver.tyreAge} voltas)`}
                >
                  {tyre.symbol}
                </span>
              </div>

              {/* GAP */}
              <div className="col-span-2 text-right pr-1">
                <span
                  className={`text-[10px] font-mono tracking-tight ${
                    isDnf
                      ? 'text-red-400 font-bold'
                      : driver.currentPosition === 1
                        ? 'text-amber-400 font-black'
                        : isPlayer
                          ? 'text-emerald-300 font-bold'
                          : 'text-slate-400'
                  }`}
                >
                  {gapDisplay}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
