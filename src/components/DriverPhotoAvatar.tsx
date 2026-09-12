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
  // Stage: 0 = local /pilotos/{key}.png, 1 = dropbox direct, 2 = local generico.png, 3 = dropbox generico, 4 = initials fallback
  const [stage, setStage] = useState<number>(0)

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
    setStage((prev) => prev + 1)
  }

  // Determine current image URL to try
  let currentSrc: string | null = null
  if (stage === 0) {
    currentSrc = sources.localPath
  } else if (stage === 1) {
    currentSrc = sources.dropboxUrl || sources.fallbackLocal
  } else if (stage === 2) {
    currentSrc = sources.fallbackLocal
  } else if (stage === 3) {
    currentSrc = sources.fallbackDropbox
  }

  if (stage >= 4 || !currentSrc) {
    // Fallback: Initials on team color background
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
        loading="lazy"
        className={cn(
          'w-full h-full object-cover object-top transition-transform duration-300 hover:scale-105',
          imgClassName,
        )}
      />
    </div>
  )
}

export default DriverPhotoAvatar
