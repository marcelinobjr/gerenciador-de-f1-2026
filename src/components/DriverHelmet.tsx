import React, { useMemo, useState } from 'react'
import { DriverModel } from '@/types/f1'
import pb from '@/lib/pocketbase/client'

export interface DriverHelmetProps {
  driver?:
    | DriverModel
    | { name?: string; nationality?: string; helmet?: string | null; id?: string }
    | null
  teamColor?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showBadge?: boolean
}

// Map of driver national flag / accent palette for stylized SVG helmet designs
const DRIVER_COLORS: Record<
  string,
  { primary: string; secondary: string; visor: string; accent: string }
> = {
  'Gabriel Bortoleto': {
    primary: '#009C3B',
    secondary: '#FFDF00',
    visor: '#002776',
    accent: '#FFFFFF',
  },
  'Pietro Fittipaldi': {
    primary: '#009C3B',
    secondary: '#FFDF00',
    visor: '#111827',
    accent: '#E10600',
  },
  'Lewis Hamilton': {
    primary: '#9333EA',
    secondary: '#FACC15',
    visor: '#111827',
    accent: '#FFFFFF',
  },
  'Max Verstappen': {
    primary: '#EA580C',
    secondary: '#1E3A8A',
    visor: '#0F172A',
    accent: '#DC2626',
  },
  'Charles Leclerc': {
    primary: '#DC2626',
    secondary: '#FFFFFF',
    visor: '#1E293B',
    accent: '#991B1B',
  },
  'Lando Norris': { primary: '#F97316', secondary: '#84CC16', visor: '#0B0F19', accent: '#06B6D4' },
  'Oscar Piastri': {
    primary: '#F97316',
    secondary: '#0284C7',
    visor: '#0F172A',
    accent: '#FACC15',
  },
  'George Russell': {
    primary: '#06B6D4',
    secondary: '#1E293B',
    visor: '#0F172A',
    accent: '#EF4444',
  },
  'Fernando Alonso': {
    primary: '#059669',
    secondary: '#0284C7',
    visor: '#1E293B',
    accent: '#FACC15',
  },
  'Carlos Sainz': { primary: '#DC2626', secondary: '#FACC15', visor: '#1E293B', accent: '#1E1E1E' },
  'Alexander Albon': {
    primary: '#0284C7',
    secondary: '#DC2626',
    visor: '#0B0F19',
    accent: '#FFFFFF',
  },
  'Nico Hulkenberg': {
    primary: '#10B981',
    secondary: '#F59E0B',
    visor: '#0F172A',
    accent: '#1E293B',
  },
  'Liam Lawson': { primary: '#1E3A8A', secondary: '#DC2626', visor: '#0F172A', accent: '#FFFFFF' },
  'Yuki Tsunoda': { primary: '#1E3A8A', secondary: '#EA580C', visor: '#0F172A', accent: '#DC2626' },
  'Pierre Gasly': { primary: '#3B82F6', secondary: '#EC4899', visor: '#0F172A', accent: '#FFFFFF' },
  'Esteban Ocon': { primary: '#DC2626', secondary: '#3B82F6', visor: '#0F172A', accent: '#FFFFFF' },
  'Valtteri Bottas': {
    primary: '#0284C7',
    secondary: '#FFFFFF',
    visor: '#0F172A',
    accent: '#10B981',
  },
}

const DEFAULT_SCHEME = {
  primary: '#E10600',
  secondary: '#1A2333',
  visor: '#090D15',
  accent: '#00A6FB',
}

const SIZES = {
  sm: { box: 32, svgSize: 'w-8 h-8', text: 'text-[10px]' },
  md: { box: 44, svgSize: 'w-11 h-11', text: 'text-xs' },
  lg: { box: 64, svgSize: 'w-16 h-16', text: 'text-sm' },
  xl: { box: 96, svgSize: 'w-24 h-24', text: 'text-base' },
}

export const DriverHelmet: React.FC<DriverHelmetProps> = ({
  driver,
  teamColor,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false)
  const sizeConfig = SIZES[size] || SIZES.md

  // 1. Check if driver has an uploaded custom helmet photo file on Skip Cloud PocketBase
  const helmetFileUrl = useMemo(() => {
    if (!driver) return null
    const drvAny = driver as any
    if (drvAny.helmet && typeof drvAny.helmet === 'string' && drvAny.helmet.trim().length > 0) {
      if (
        drvAny.helmet.startsWith('http://') ||
        drvAny.helmet.startsWith('https://') ||
        drvAny.helmet.startsWith('/')
      ) {
        return drvAny.helmet
      }
      try {
        return pb.files.getUrl(drvAny, drvAny.helmet)
      } catch {
        return null
      }
    }
    return null
  }, [driver])

  const palette = useMemo(() => {
    const name = driver?.name || ''
    if (DRIVER_COLORS[name]) {
      return DRIVER_COLORS[name]
    }
    if (teamColor) {
      return {
        primary: teamColor,
        secondary: '#0F172A',
        visor: '#0A0E17',
        accent: '#00A6FB',
      }
    }
    return DEFAULT_SCHEME
  }, [driver?.name, teamColor])

  // If driver has an uploaded helmet image that didn't error out, render it
  if (helmetFileUrl && !imageError) {
    return (
      <div
        className={`relative inline-flex items-center justify-center shrink-0 rounded-xl overflow-hidden border border-[#1A2333]/90 bg-[#090D15]/80 shadow-md ${sizeConfig.svgSize} ${className}`}
      >
        <img
          src={helmetFileUrl}
          alt={`Capacete ${driver?.name || 'Piloto'}`}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover object-center"
        />
      </div>
    )
  }

  // Fallback: Ultra-detailed FIA-grade F1 Helmet SVG with dynamic aerodynamics, visor refraction & team accent
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl p-0.5 bg-gradient-to-b from-[#141B26] to-[#080C14] border border-[#1A2333]/90 shadow-md ${sizeConfig.svgSize} ${className}`}
      title={driver?.name ? `Capacete: ${driver.name}` : 'Capacete F1'}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id={`helmShell-${driver?.name || 'f1'}`}
            x1="15"
            y1="15"
            x2="85"
            y2="85"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={palette.primary} />
            <stop offset="60%" stopColor={palette.secondary} />
            <stop offset="100%" stopColor="#0B0F19" />
          </linearGradient>
          <linearGradient
            id={`visorGlow-${driver?.name || 'f1'}`}
            x1="45"
            y1="35"
            x2="88"
            y2="55"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#00A6FB" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#0F172A" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#E10600" stopOpacity="0.6" />
          </linearGradient>
          <filter id="softGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Shadow */}
        <ellipse cx="50" cy="88" rx="34" ry="6" fill="#000000" opacity="0.45" />

        {/* Base Helmet Shell */}
        <path
          d="M 24 64 C 18 52 20 30 36 18 C 50 8 72 10 82 22 C 90 32 92 48 88 64 C 85 75 74 80 62 81 C 45 82 30 80 24 64 Z"
          fill={`url(#helmShell-${driver?.name || 'f1'})`}
          stroke={palette.accent}
          strokeWidth="1.2"
        />

        {/* Aero Spoiler / Top Scoop */}
        <path
          d="M 38 15 C 50 12 66 14 74 20 L 70 24 C 62 20 50 18 40 20 Z"
          fill={palette.accent}
          opacity="0.8"
        />

        {/* Dynamic Graphic Stripe / Livery Arc */}
        <path
          d="M 23 45 C 32 30 55 24 82 38 L 84 46 C 58 32 34 38 23 54 Z"
          fill={palette.secondary}
          opacity="0.9"
        />
        <path
          d="M 26 50 C 36 38 56 32 80 44 L 81 48 C 58 37 38 42 27 54 Z"
          fill={palette.accent}
          opacity="0.85"
        />

        {/* Visor Opening / Recess */}
        <path
          d="M 46 36 L 85 41 C 89 48 88 57 85 62 L 50 62 C 45 56 44 45 46 36 Z"
          fill="#06090E"
        />

        {/* Tinted Iridium Visor with Refraction */}
        <path
          d="M 48 38 L 84 43 C 87 49 86 56 83 60 L 52 60 C 47 54 46 45 48 38 Z"
          fill={`url(#visorGlow-${driver?.name || 'f1'})`}
          stroke="#00A6FB"
          strokeWidth="0.8"
        />

        {/* Visor Glare highlight */}
        <path
          d="M 52 40 L 76 43 C 78 45 78 48 76 49 L 54 45 C 52 44 51 42 52 40 Z"
          fill="#FFFFFF"
          opacity="0.55"
        />

        {/* Visor Pivot Screw */}
        <circle cx="47" cy="49" r="3" fill="#1E293B" stroke={palette.accent} strokeWidth="0.8" />
        <circle cx="47" cy="49" r="1.2" fill="#FFFFFF" opacity="0.8" />

        {/* Chin Vent / Hans anchor */}
        <path
          d="M 60 70 L 76 70 L 74 74 L 62 74 Z"
          fill="#0B0F19"
          stroke={palette.accent}
          strokeWidth="0.6"
        />
        <line x1="64" y1="72" x2="72" y2="72" stroke="#64748B" strokeWidth="0.8" />

        {/* Hans post clip */}
        <circle cx="32" cy="68" r="2.2" fill="#475569" stroke="#000000" strokeWidth="0.6" />

        {/* Neck collar / rubber seal */}
        <path
          d="M 28 72 C 38 78 60 79 72 74 L 70 79 C 58 83 38 82 27 76 Z"
          fill="#0F172A"
          stroke="#1E293B"
          strokeWidth="0.6"
        />
      </svg>
    </div>
  )
}

export default DriverHelmet
