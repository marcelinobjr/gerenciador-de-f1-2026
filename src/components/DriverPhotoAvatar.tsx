import React, { useState } from 'react'
import { getDriverPhotoSources } from '@/lib/driver-photos'
import { cn } from '@/lib/utils'

export interface DriverPhotoAvatarProps {
  name: string
  teamColor?: string
  className?: string
  imgClassName?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  alt?: string
}

export const DriverPhotoAvatar: React.FC<DriverPhotoAvatarProps> = ({
  name,
  teamColor = '#E10600',
  className,
  imgClassName,
  size = 'md',
  alt,
}) => {
  const sources = getDriverPhotoSources(name)
  // Lista de URLs candidatas locais e remotas para tentar em ordem:
  // 1. /pilotos/{key}.png (ex.: /pilotos/bortoleto.png)
  // 2. /pilotos/{filename} (ex.: /pilotos/5-Gabriel_Bortoleto.png)
  // 3. /pilotos/gabriel_bortoleto.png (se aplicável)
  // 4. Dropbox direct URL (se existir)
  // 5. /pilotos/generico.png
  // 6. Dropbox generico
  // 7. Fallback de iniciais estilizadas
  const candidateUrls = React.useMemo(() => {
    const list: string[] = []
    if (sources.localPath) list.push(sources.localPath)
    if (sources.filename) {
      const namedFile = `/pilotos/${sources.filename}`
      if (!list.includes(namedFile)) list.push(namedFile)
    }
    if (sources.normalizedKey === 'bortoleto') {
      const customLocal = '/pilotos/gabriel_bortoleto.png'
      if (!list.includes(customLocal)) list.push(customLocal)
    }
    if (sources.dropboxUrl && !list.includes(sources.dropboxUrl)) {
      list.push(sources.dropboxUrl)
    }
    if (sources.fallbackLocal && !list.includes(sources.fallbackLocal)) {
      list.push(sources.fallbackLocal)
    }
    if (sources.fallbackDropbox && !list.includes(sources.fallbackDropbox)) {
      list.push(sources.fallbackDropbox)
    }
    return list
  }, [sources])

  const [attemptIndex, setAttemptIndex] = useState<number>(0)

  const sizeClasses = {
    xs: 'w-7 h-7 text-[10px]',
    sm: 'w-10 h-10 text-xs',
    md: 'w-14 h-14 text-sm',
    lg: 'w-20 h-20 text-base',
    xl: 'w-28 h-28 text-lg',
    '2xl': 'w-36 h-36 text-xl',
  }

  const getInitials = (driverName: string) => {
    if (!driverName) return 'F1'
    const parts = driverName.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const handleError = () => {
    setAttemptIndex((prev) => prev + 1)
  }

  const currentSrc = candidateUrls[attemptIndex] || null
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
          'w-full h-full object-cover object-top transition-transform duration-300 hover:scale-105',
          imgClassName,
        )}
      />{' '}
    </div>
  )
}

export default DriverPhotoAvatar
