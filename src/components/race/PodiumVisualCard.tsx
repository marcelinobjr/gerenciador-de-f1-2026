import React from 'react'
import type { OfficialRaceResult, OfficialRaceResultEntry } from '@/types/canonical-race-v2'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'
import { getTeamReducedLogoUrl } from '@/lib/team-reduced-logo-resolver'
import { Trophy, Award } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PodiumVisualCardProps {
  result: OfficialRaceResult
  className?: string
}

interface PodiumDriverItem {
  position: 1 | 2 | 3
  entry: OfficialRaceResultEntry
  driverNumber?: number
}

export const PodiumVisualCard: React.FC<PodiumVisualCardProps> = ({ result, className }) => {
  // P1, P2 e P3 derivados estritamente do OfficialRaceResult
  const podiumData = React.useMemo<PodiumDriverItem[]>(() => {
    if (!result) return []

    // 1. Resolver P1
    const p1DriverId = result.podium?.[0] || result.winnerDriverId
    const p1Entry =
      result.entries.find((e) => e.driverId === p1DriverId) ||
      result.entries.find((e) => e.finalPosition === 1) ||
      result.entries[0]

    // 2. Resolver P2
    const p2DriverId = result.podium?.[1]
    const p2Entry =
      result.entries.find((e) => e.driverId === p2DriverId) ||
      result.entries.find((e) => e.finalPosition === 2) ||
      result.entries[1]

    // 3. Resolver P3
    const p3DriverId = result.podium?.[2]
    const p3Entry =
      result.entries.find((e) => e.driverId === p3DriverId) ||
      result.entries.find((e) => e.finalPosition === 3) ||
      result.entries[2]

    const items: PodiumDriverItem[] = []

    if (p1Entry) {
      items.push({
        position: 1,
        entry: p1Entry,
        driverNumber: (p1Entry as any).driverNumber,
      })
    }

    if (p2Entry) {
      items.push({
        position: 2,
        entry: p2Entry,
        driverNumber: (p2Entry as any).driverNumber,
      })
    }

    if (p3Entry) {
      items.push({
        position: 3,
        entry: p3Entry,
        driverNumber: (p3Entry as any).driverNumber,
      })
    }

    return items
  }, [result])

  const p1Item = podiumData.find((d) => d.position === 1)
  const p2Item = podiumData.find((d) => d.position === 2)
  const p3Item = podiumData.find((d) => d.position === 3)

  if (!p1Item) {
    return null
  }

  // Componente interno para renderizar cada degrau do pódio
  const renderPodiumStep = (item: PodiumDriverItem | undefined, place: 1 | 2 | 3) => {
    if (!item) return null

    const { entry, driverNumber } = item
    const isP1 = place === 1
    const logoUrl = getTeamReducedLogoUrl(entry.teamName || entry.teamId)

    return (
      <div
        key={`podium_visual_step_${place}_${entry.driverId}`}
        data-testid={`podium-visual-slot-p${place}`}
        className={cn(
          'relative flex flex-col items-center text-center transition-all duration-200',
          // No desktop, P1 ganha elevação sutil / z-index mais alto
          isP1
            ? 'order-1 md:order-2 z-10'
            : place === 2
              ? 'order-2 md:order-1'
              : 'order-3 md:order-3',
        )}
      >
        {/* Card do Piloto */}
        <div
          className={cn(
            'w-full rounded-2xl p-4 sm:p-5 flex flex-col items-center transition-all',
            isP1
              ? 'bg-gradient-to-b from-amber-50/90 via-white to-amber-50/40 border-2 border-amber-400 shadow-md md:-translate-y-2'
              : 'bg-white/90 border border-slate-200 shadow-xs hover:border-slate-300',
          )}
        >
          {/* Badge de Posição */}
          <div className="flex items-center gap-1.5 mb-3">
            <span
              className={cn(
                'inline-flex items-center justify-center font-black rounded-lg shadow-xs tracking-tight',
                isP1
                  ? 'w-8 h-8 text-base bg-amber-400 text-slate-950 border border-amber-300'
                  : place === 2
                    ? 'w-7 h-7 text-xs bg-slate-200 text-slate-800 border border-slate-300'
                    : 'w-7 h-7 text-xs bg-amber-700/20 text-amber-900 border border-amber-800/20',
              )}
            >
              P{place}
            </span>
            {isP1 && (
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
                <Trophy className="w-3 h-3 text-amber-600" />
                VENCEDOR
              </span>
            )}
          </div>

          {/* Foto Canônica com Fallback Elegante */}
          <div className="relative mb-3 flex items-center justify-center">
            <DriverPhotoAvatar
              name={entry.driverName}
              driverId={entry.driverId}
              teamColor={entry.teamColor || '#E10600'}
              size={isP1 ? 'xl' : 'lg'}
              className={cn(
                'shadow-sm',
                isP1 ? 'border-2 border-amber-400' : 'border border-slate-200',
              )}
            />
            {isP1 && (
              <div
                className="absolute -bottom-2 -right-1 w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-xs border border-white"
                title="1º Lugar"
              >
                <Trophy className="w-3.5 h-3.5" />
              </div>
            )}
            {place === 2 && (
              <div
                className="absolute -bottom-1.5 -right-1 w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center shadow-xs border border-white"
                title="2º Lugar"
              >
                <Award className="w-3 h-3" />
              </div>
            )}
            {place === 3 && (
              <div
                className="absolute -bottom-1.5 -right-1 w-5 h-5 rounded-full bg-amber-700/20 text-amber-900 flex items-center justify-center shadow-xs border border-white"
                title="3º Lugar"
              >
                <Award className="w-3 h-3" />
              </div>
            )}
          </div>

          {/* Nome e Número do Piloto */}
          <div className="w-full space-y-1">
            <div className="flex items-center justify-center gap-1.5">
              <h4
                className={cn(
                  'font-black text-slate-900 truncate tracking-tight',
                  isP1 ? 'text-lg sm:text-xl' : 'text-sm sm:text-base',
                )}
                data-testid={`podium-driver-name-p${place}`}
                title={entry.driverName}
              >
                {entry.driverName}
              </h4>
              {typeof driverNumber === 'number' && (
                <span
                  className={cn(
                    'font-mono font-bold text-slate-500 shrink-0',
                    isP1 ? 'text-xs' : 'text-[11px]',
                  )}
                  data-testid={`podium-driver-number-p${place}`}
                >
                  #{driverNumber}
                </span>
              )}
            </div>

            {/* Logo da Equipe e Nome da Equipe */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 font-medium">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={entry.teamName}
                  className={cn('object-contain shrink-0', isP1 ? 'w-4 h-4' : 'w-3.5 h-3.5')}
                />
              ) : (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.teamColor || '#94A3B8' }}
                />
              )}
              <span
                className="truncate max-w-[150px] text-slate-700 font-semibold"
                title={entry.teamName}
              >
                {entry.teamName}
              </span>
            </div>
          </div>

          {/* Degrau de Elevação Esportivo (Pedestal Estilizado) */}
          <div
            className={cn(
              'w-full mt-4 pt-2 border-t flex items-center justify-between text-[11px] font-mono',
              isP1 ? 'border-amber-200/80 text-amber-900' : 'border-slate-100 text-slate-500',
            )}
          >
            <span className="font-semibold text-slate-500">
              {entry.finalPosition === 1 ? '1º Degrau' : `${place}º Degrau`}
            </span>
            <span className="font-black font-mono text-emerald-700">
              +{entry.pointsAwarded} pts
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section
      aria-label="Pódio da Corrida"
      data-testid="podium-visual-box"
      className={cn(
        'bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden',
        className,
      )}
    >
      {/* Detalhe de Topo: acento esportivo sutil */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-200/70">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#E10600]" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" />
            Pódio Oficial do Grande Prêmio
          </h3>
        </div>
        <div className="text-[11px] font-mono font-medium text-slate-500">
          Oficializado FIA • Top 3
        </div>
      </div>

      {/* Grid Horizontal: [P2] [P1] [P3] */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        {/* Renderiza P2 na esquerda no desktop */}
        {renderPodiumStep(p2Item, 2)}
        {/* Renderiza P1 no centro (mais alto) */}
        {renderPodiumStep(p1Item, 1)}
        {/* Renderiza P3 na direita no desktop */}
        {renderPodiumStep(p3Item, 3)}
      </div>
    </section>
  )
}

export default PodiumVisualCard
