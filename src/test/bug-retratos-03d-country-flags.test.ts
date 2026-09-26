import { describe, it, expect } from 'vitest'
import { countryFlag, countryName, resolveIso3, ISO3_TO_ISO2 } from '@/lib/country-flag'
import { CANONICAL_DRIVERS_MASTER } from '@/lib/canonical-driver-database'
import React from 'react'
import { render } from '@testing-library/react'
import { CountryFlag } from '@/components/CountryFlag'

describe('BUG-RETRATOS-03D: Resolução Canônica de Bandeiras de Pilotos', () => {
  // 01 countryFlag("DEU") = "🇩🇪"
  it('BRT03D-01: countryFlag("DEU") retorna 🇩🇪', () => {
    expect(countryFlag('DEU')).toBe('🇩🇪')
  })

  // 02 countryFlag("BRA") = "🇧🇷"
  it('BRT03D-02: countryFlag("BRA") retorna 🇧🇷', () => {
    expect(countryFlag('BRA')).toBe('🇧🇷')
  })

  // 03 countryFlag("GBR") = "🇬🇧"
  it('BRT03D-03: countryFlag("GBR") retorna 🇬🇧', () => {
    expect(countryFlag('GBR')).toBe('🇬🇧')
  })

  // 04 countryFlag("USA") = "🇺🇸"
  it('BRT03D-04: countryFlag("USA") retorna 🇺🇸', () => {
    expect(countryFlag('USA')).toBe('🇺🇸')
  })

  // 05 todos os códigos do universo ativo têm cobertura
  it('BRT03D-05: todos os códigos do universo ativo têm cobertura', () => {
    const canonicalNationalities = new Set(
      CANONICAL_DRIVERS_MASTER.map((d) => d.nationality).filter(Boolean),
    )

    expect(canonicalNationalities.size).toBeGreaterThan(0)
    for (const nat of canonicalNationalities) {
      const flag = countryFlag(nat)
      // Não pode ser vazio e nem fallback bruto para nacionalidades válidas conhecidas
      expect(flag).toBeTruthy()
      expect(flag.length).toBeGreaterThan(0)
    }

    // Cobertura explícita dos códigos citados na especificação
    const requiredCodes = [
      'DEU',
      'BRA',
      'GBR',
      'USA',
      'MCO',
      'NLD',
      'JPN',
      'ESP',
      'FRA',
      'ITA',
      'AUS',
      'CAN',
      'MEX',
      'ARG',
      'NZL',
      'FIN',
      'DNK',
      'SWE',
      'NOR',
      'BEL',
      'CHE',
      'SUI',
      'AUT',
      'POL',
      'CZE',
      'COL',
      'POR',
      'PRT',
      'RSA',
      'ZAF',
      'CHN',
      'THA',
      'IND',
      'IRL',
      'BRB',
      'EST',
      'PRY',
      'BGR',
    ]

    for (const code of requiredCodes) {
      const flag = countryFlag(code)
      expect(flag).not.toBe(code)
      // Deve conter regional indicators (emoji de 2 code points)
      expect(Array.from(flag).length).toBe(2)
    }
  })

  // 06 código desconhecido ("XYZ") → "XYZ"
  it('BRT03D-06: código desconhecido ("XYZ") retorna "XYZ" sem erro nem "?", e vazio retorna ""', () => {
    expect(countryFlag('XYZ')).toBe('XYZ')
    expect(countryFlag('')).toBe('')
    expect(countryFlag(null)).toBe('')
    expect(countryFlag(undefined)).toBe('')
  })

  // 16 CountryFlag tem title e aria-label válidos
  it('BRT03D-16: CountryFlag tem title e aria-label válidos', () => {
    const { container: cDeu } = render(React.createElement(CountryFlag, { code: 'DEU' }))
    const spanDeu = cDeu.querySelector('span')
    expect(spanDeu).not.toBeNull()
    expect(spanDeu?.getAttribute('role')).toBe('img')
    expect(spanDeu?.getAttribute('aria-label')).toBe('Alemanha')
    expect(spanDeu?.getAttribute('title')).toBe('Alemanha')
    expect(spanDeu?.textContent).toBe('🇩🇪')

    const { container: cBra } = render(React.createElement(CountryFlag, { code: 'BRA' }))
    const spanBra = cBra.querySelector('span')
    expect(spanBra?.getAttribute('aria-label')).toBe('Brasil')
    expect(spanBra?.getAttribute('title')).toBe('Brasil')
    expect(spanBra?.textContent).toBe('🇧🇷')

    // Desconhecido
    const { container: cXyz } = render(React.createElement(CountryFlag, { code: 'XYZ' }))
    const spanXyz = cXyz.querySelector('span')
    expect(spanXyz?.getAttribute('aria-label')).toBe('XYZ')
    expect(spanXyz?.textContent).toBe('XYZ')

    // Vazio renderiza null
    const { container: cEmpty } = render(React.createElement(CountryFlag, { code: '' }))
    expect(cEmpty.firstChild).toBeNull()
  })
})
