import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { CountryFlagChip } from '@/components/CountryFlagChip'
import { getCountryCode } from '@/lib/country-flags'

describe('BUG-RETRATOS-02: Resolução Canônica de CountryFlagChip e Integridade Visual de Bandeiras', () => {
  it('BR02-01: CountryFlagChip é exportado canonicamente por src/components/CountryFlagChip.tsx', () => {
    expect(CountryFlagChip).toBeDefined()
    expect(typeof CountryFlagChip).toBe('function')
  })

  it('BR02-02: getCountryCode resolve códigos canônicos sem emojis quebradiços', () => {
    expect(getCountryCode('Brasil')).toBe('BRA')
    expect(getCountryCode('United Kingdom')).toBe('GBR')
    expect(getCountryCode('Australia')).toBe('AUS')
    expect(getCountryCode('Netherlands')).toBe('NLD')
    expect(getCountryCode('Monaco')).toBe('MCO')
    expect(getCountryCode('Alemanha')).toBe('DEU')
  })

  it('BR02-03: CountryFlagChip renderiza elemento mono com código do país', () => {
    const { container } = render(React.createElement(CountryFlagChip, { country: 'Brasil' }))
    const chip = container.querySelector('span')
    expect(chip).not.toBeNull()
    expect(chip?.textContent).toBe('BRA')
    expect(chip?.getAttribute('title')).toBe('Brasil')
  })

  it('BR02-04: CountryFlagChip com rodada do campeonato resolve código da rodada', () => {
    const { container } = render(React.createElement(CountryFlagChip, { round: 1 }))
    const chip = container.querySelector('span')
    expect(chip).not.toBeNull()
    expect(chip?.textContent).toBe('AUS')
  })
})
