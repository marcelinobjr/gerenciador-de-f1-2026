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
    // Fallbacks legados adicionais para retrocompatibilidade
    const legacy = getLocalDriverPosterCandidates(name, driverId, effectiveVisualIdentity)
    for (const l of legacy) {
      if (!list.includes(l)) list.push(l)
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

  const handleError = () => {
    setAttemptIndex((prev) => prev + 1)
  }

  // Previne loop ou tentativas fora do array
  const currentSrc = attemptIndex < candidateUrls.length ? candidateUrls[attemptIndex] : null
  const isExhausted = attemptIndex >= candidateUrls.length || !currentSrc

  if (isExhausted) {
    // Fallback: Iniciais estilizadas sobre fundo na cor da equipe
    return (
      <div
        className={cn(
          'relative rounded-xl flex items-center justify-center font-black select-none shrink-0 border border-white/10 shadow-md',
          sizeClasses[size],
          className,
        )}
        style={{
          backgroundColor: teamColor || '#1F2733',
          color: '#FFFFFF',
          textShadow: '0 1px 3px rgba(0,0,0,0.7)',
        }}
        title={name}
      >
        <span>{getInitials(name)}</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden bg-[#161D29] border border-[#1F2733] select-none shrink-0 shadow-md flex items-center justify-center',
        sizeClasses[size],
        className,
      )}
      style={{
        boxShadow: `0 0 0 1px ${teamColor}33, 0 4px 12px rgba(0,0,0,0.5)`,
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
      />{' '}
    </div>
  )
}

export default DriverPhotoAvatar
