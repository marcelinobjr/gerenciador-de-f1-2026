import React from 'react'
import { getCountryCode } from '@/lib/country-flags'

export interface CountryFlagChipProps {
  country?: string | null
  round?: number | null
  className?: string
  title?: string
}

export const CountryFlagChip: React.FC<CountryFlagChipProps> = ({
  country,
  round,
  className = '',
  title,
}) => {
  const code = getCountryCode(country, round)
  return (
    <span
      className={`w-7 h-5 rounded font-mono font-bold text-[10px] bg-neutral-100 border border-neutral-200 text-neutral-700 inline-flex items-center justify-center shrink-0 tracking-wider ${className}`}
      title={title || country || code}
      aria-label={title || country || code}
    >
      {code}
    </span>
  )
}
