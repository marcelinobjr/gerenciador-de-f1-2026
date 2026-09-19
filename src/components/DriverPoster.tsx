import React, { useState, useMemo } from 'react'
import { getLocalDriverPosterCandidates, getInitials } from '@/lib/pilot-posters'
import { DriverVisualAssetIdentity } from '@/types/procedural-driver'
import { cn } from '@/lib/utils'

export interface DriverPosterProps {
  name: string
  className?: string
  aspectRatio?: 'square' | 'poster' | 'tall'
  showInitialsFallback?: boolean
  driverId?: string
  visualIdentity?: DriverVisualAssetIdentity | null
  portraitAssetId?: string
}

export const DriverPoster: React.FC<DriverPosterProps> = ({
  name,
  className,
  aspectRatio = 'poster',
  showInitialsFallback = true,
  driverId,
  visualIdentity,
  portraitAssetId,
}) => {
  const effectiveVisualIdentity = useMemo<DriverVisualAssetIdentity | null>(() => {
    if (visualIdentity) return visualIdentity
    if (portraitAssetId) return { portraitAssetId }
    return null
  }, [visualIdentity, portraitAssetId])

  const candidateUrls = useMemo(
    () => getLocalDriverPosterCandidates(name, driverId, effectiveVisualIdentity),
    [name, driverId, effectiveVisualIdentity],
  )
  const [candidateIndex, setCandidateIndex] = useState(0)

  // Reset index when name, driverId or visual identity changes
  React.useEffect(() => {
    setCandidateIndex(0)
  }, [name, driverId, effectiveVisualIdentity])

  const isExhausted = candidateIndex >= candidateUrls.length
  const currentSrc = !isExhausted ? candidateUrls[candidateIndex] : null

  if (isExhausted || !currentSrc) {
    if (!showInitialsFallback) return null
    return (
      <div
        className={cn(
          'flex items-center justify-center font-bold tracking-wider select-none text-zinc-300 bg-gradient-to-br from-zinc-800 to-zinc-950 border border-zinc-700/60 rounded-md shadow-inner',
          aspectRatio === 'poster'
            ? 'aspect-[3/4]'
            : aspectRatio === 'tall'
              ? 'aspect-[4/5]'
              : 'aspect-square',
          className,
        )}
      >
        <span className="text-xl sm:text-2xl drop-shadow-md">{getInitials(name)}</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md border border-zinc-700/60 bg-zinc-900 group shadow-md',
        aspectRatio === 'poster'
          ? 'aspect-[3/4]'
          : aspectRatio === 'tall'
            ? 'aspect-[4/5]'
            : 'aspect-square',
        className,
      )}
    >
      <img
        key={currentSrc}
        src={currentSrc}
        alt={`Pôster de ${name}`}
        onError={() => setCandidateIndex((prev) => prev + 1)}
        className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
    </div>
  )
}
export default DriverPoster
