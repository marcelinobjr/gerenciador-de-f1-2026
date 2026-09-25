import React, { useState } from 'react'
import { getLocalDriverPosterCandidates, getInitials } from '@/lib/pilot-posters'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { DriverVisualAssetIdentity } from '@/types/procedural-driver'
import { cn } from '@/lib/utils'

export interface DriverPhotoAvatarProps {
  name: string
  teamColor?: string
  className?: string
  imgClassName?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  alt?: string
  driverId?: string
  visualIdentity?: DriverVisualAssetIdentity | null
  portraitAssetId?: string
  generatedPortraitProfileId?: string
}

export const DriverPhotoAvatar: React.FC<DriverPhotoAvatarProps> = ({
  name,
  teamColor = '#E10600',
  className,
  imgClassName,
  size = 'md',
  alt,
  driverId,
  visualIdentity,
  portraitAssetId,
  generatedPortraitProfileId,
}) => {
  // Constrói objeto de identidade unificado se fornecido via prop
  const effectiveVisualIdentity = React.useMemo<DriverVisualAssetIdentity | null>(() => {
    if (visualIdentity) return visualIdentity
    if (portraitAssetId) {
      return { portraitAssetId }
    }
    return null
  }, [visualIdentity, portraitAssetId])

  // Resolvedor Canônico Central (DRV-DATA-02)
  const canonicalResolved = React.useMemo(() => {
    return resolveDriverPhoto({
      driverId,
      name,
      teamColor,
      visualIdentity: effectiveVisualIdentity,
      portraitAssetId,
      generatedPortraitProfileId,
    })
  }, [
    driverId,
    name,
    teamColor,
    effectiveVisualIdentity,
    portraitAssetId,
    generatedPortraitProfileId,
  ])

  // Candidatos ordenados: resolvedor canônico unificado primeiro, seguido dos fallbacks
  const candidateUrls = React.useMemo(() => {
    const list: string[] = []
    if (canonicalResolved.url) {
      list.push(canonicalResolved.url)
    }
    for (const c of canonicalResolved.candidateUrls) {
      if (!list.includes(c)) list.push(c)
    }
    // Fallbacks legados adicionais para retrocompatibilidade apenas se não tiver resolvido canônico
    if (list.length === 0) {
      const legacy = getLocalDriverPosterCandidates(name, driverId, effectiveVisualIdentity)
      for (const l of legacy) {
        if (!list.includes(l)) list.push(l)
      }
    }
    return list
  }, [canonicalResolved, name, driverId, effectiveVisualIdentity])

  const [attemptIndex, setAttemptIndex] = useState<number>(0)

  const sizeClasses = {
    xs: 'w-7 h-7 text-[10px]',
    sm: 'w-10 h-10 text-xs',
    md: 'w-14 h-14 text-sm',
    lg: 'w-20 h-20 text-base',
    xl: 'w-28 h-28 text-lg',
    '2xl': 'w-36 h-36 text-xl',
  }

  // Reseta índice de tentativa quando o piloto mudar
  React.useEffect(() => {
    setAttemptIndex(0)
  }, [name, driverId, effectiveVisualIdentity, generatedPortraitProfileId])

  const currentSrc = attemptIndex < candidateUrls.length ? candidateUrls[attemptIndex] : null
  const isExhausted = attemptIndex >= candidateUrls.length || !currentSrc

  const handleError = () => {
    console.warn('[DriverPhotoAvatar] Falha ao carregar retrato:', {
      driverId,
      name,
      currentSrc,
      attemptIndex,
    })
    setAttemptIndex((prev) => prev + 1)
  }

  if (isExhausted) {
    // Fallback honesto: Iniciais estilizadas de alto contraste sobre fundo na cor da equipe (NUNCA bloco escuro sólido)
    const initials = canonicalResolved.fallbackInitials || getInitials(name)
    return (
      <div
        data-testid="driver-fallback-initials"
        className={cn(
          'relative rounded-xl flex items-center justify-center font-black select-none shrink-0 border border-white/20 shadow-md',
          sizeClasses[size],
          className,
        )}
        style={{
          backgroundColor: teamColor || '#E10600',
          color: '#FFFFFF',
          textShadow: '0 1px 3px rgba(0,0,0,0.7)',
        }}
        title={name}
      >
        <span className="tracking-wider">{initials}</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden border border-slate-200/60 select-none shrink-0 shadow-sm flex items-center justify-center',
        sizeClasses[size],
        className,
      )}
      style={{
        backgroundColor: `${teamColor}15`,
        boxShadow: `0 0 0 1px ${teamColor}33, 0 2px 8px rgba(0,0,0,0.15)`,
      }}
    >
      <img
        src={currentSrc}
        alt={alt || name}
        onError={handleError}
        loading="eager"
        className={cn(
          'w-full h-full object-cover transition-transform duration-300 hover:scale-105',
          name.toLowerCase().includes('ricciardo') ? 'object-[50%_12%]' : 'object-top',
          imgClassName,
        )}
      />
    </div>
  )
}

export default DriverPhotoAvatar
