import React from 'react'
import { countryFlag, countryName } from '@/lib/country-flag'
import { cn } from '@/lib/utils'

export interface CountryFlagProps {
  code?: string | null
  className?: string
  title?: string
}

export const CountryFlag: React.FC<CountryFlagProps> = ({ code, className, title: customTitle }) => {
  if (!code || !code.trim()) {
    return null
  }

  const flag = countryFlag(code)
  const label = customTitle || countryName(code)

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn('inline-flex items-center text-base leading-none select-none', className)}
    >
      {flag}
    </span>
  )
}

export default CountryFlag
