import React, { useState } from 'react'
import { resolveTeamLogo } from '@/data/teamLogos'
import { cn } from '@/lib/utils'

export type TeamCrestSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface TeamCrestProps {
  team?: string | null
  teamId?: string | null
  teamName?: string | null
  size?: TeamCrestSize
  className?: string
  imgClassName?: string
  showFallbackText?: boolean
}

const SIZE_MAP: Record<
  TeamCrestSize,
  {
    box: string
    img: string
    text: string
    svgSize: number
    fontSize: number
  }
> = {
  xs: {
    box: 'w-4 h-4',
    img: 'w-4 h-4',
    text: 'text-[8px]',
    svgSize: 16,
    fontSize: 8,
  },
  sm: {
    box: 'w-5 h-5',
    img: 'w-5 h-5',
    text: 'text-[9px]',
    svgSize: 20,
    fontSize: 9,
  },
  md: {
    box: 'w-6 h-6',
    img: 'w-6 h-6',
    text: 'text-[10px]',
    svgSize: 24,
    fontSize: 10,
  },
  lg: {
    box: 'w-8 h-8',
    img: 'w-8 h-8',
    text: 'text-xs',
    svgSize: 32,
    fontSize: 12,
  },
  xl: {
    box: 'w-12 h-12',
    img: 'w-12 h-12',
    text: 'text-sm',
    svgSize: 48,
    fontSize: 16,
  },
}

/**
 * Componente Canônico TeamCrest.
 * Renderiza:
 * 1. Logo Real (<img> apontando para asset local em src/assets/logos/ ou registrado no mapa)
 * 2. Crest procedural em SVG (círculo com cor primária + borda secundária + sigla em bold)
 * 3. Fallback honesto para equipes não cadastradas (sigla simples em caixa neutra, sem inventar escudo)
 */
export const TeamCrest: React.FC<TeamCrestProps> = ({
  team,
  teamId,
  teamName,
  size = 'md',
  className,
  imgClassName,
  showFallbackText = false,
}) => {
  const [imgError, setImgError] = useState(false)
  const identifier = teamId || team || teamName || ''
  const resolved = resolveTeamLogo(identifier)
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md

  // 1. Caso tenha logoUrl e não tenha falhado o carregamento
  if (resolved.type === 'logo' && resolved.logoUrl && !imgError) {
    return (
      <div
        className={cn(
          'inline-flex items-center justify-center shrink-0 select-none overflow-hidden',
          sizeConfig.box,
          className,
        )}
        title={resolved.displayName}
      >
        <img
          src={resolved.logoUrl}
          alt={resolved.displayName}
          className={cn('w-full h-full object-contain filter drop-shadow-xs', imgClassName)}
          loading="lazy"
          onError={() => setImgError(true)}
        />
        {showFallbackText && (
          <span className={cn('sr-only', sizeConfig.text)}>{resolved.fallbackText}</span>
        )}
      </div>
    )
  }

  // 2. Caso seja crest gerado (ou fallback do logo que falhou carregamento)
  if (resolved.crest) {
    const { primaryColor, secondaryColor, acronym, textColor } = resolved.crest
    const effectiveTextColor = textColor || '#FFFFFF'

    return (
      <div
        className={cn(
          'inline-flex items-center justify-center shrink-0 select-none',
          sizeConfig.box,
          className,
        )}
        title={resolved.displayName}
      >
        <svg
          viewBox="0 0 40 40"
          width={sizeConfig.svgSize}
          height={sizeConfig.svgSize}
          className="w-full h-full"
        >
          {/* Círculo do Crest com cor primária e borda na cor secundária */}
          <circle
            cx="20"
            cy="20"
            r="18"
            fill={primaryColor}
            stroke={secondaryColor}
            strokeWidth="2.5"
          />
          {/* Sigla Oficial da Equipe */}
          <text
            x="20"
            y="24"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            fontWeight="900"
            fontSize="12"
            fill={effectiveTextColor}
            textAnchor="middle"
            letterSpacing="-0.5"
          >
            {acronym}
          </text>
        </svg>
        {showFallbackText && (
          <span className={cn('sr-only', sizeConfig.text)}>{resolved.fallbackText}</span>
        )}
      </div>
    )
  }

  // 3. Fallback honesto: equipe desconhecida ou não cadastrada -> sigla textual simples, sem visual falso
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center shrink-0 select-none rounded bg-neutral-100 text-neutral-600 border border-neutral-300 font-mono font-bold leading-none',
        sizeConfig.box,
        sizeConfig.text,
        className,
      )}
      title={resolved.displayName || 'Equipe Desconhecida'}
    >
      <span>{resolved.fallbackText}</span>
    </div>
  )
}
