import React from 'react'
import { countryFlag, countryName, type CountryInput } from '@/lib/country-flag'
import { cn } from '@/lib/utils'

export interface CountryFlagProps {
  code?: CountryInput
  className?: string
  title?: string
}

export const CountryFlag: React.FC<CountryFlagProps> = ({
  code,
  className,
  title: customTitle,
}) => {
  if (code === null || code === undefined) {
    return null
  }
  if (typeof code === 'string' && !code.trim()) {
    return null
  }
  if (Array.isArray(code) && code.length === 0) {
    return null
  }

  const flag = countryFlag(code)
  if (!flag) {
    return null
  }
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
