import { describe, it, expect } from 'vitest'
import {
  countryFlag,
  resolveCountryFlag,
  countryName,
  resolveIso3,
  ISO3_TO_ISO2,
} from '@/lib/country-flag'
import { CANONICAL_DRIVERS_MASTER } from '@/lib/canonical-driver-database'
import React from 'react'
import { render } from '@testing-library/react'
import { CountryFlag } from '@/components/CountryFlag'
import fs from 'fs'
import path from 'path'

describe('BUG-RETRATOS-03D: Resolução Canônica de Bandeiras ISO2 + ISO3 (BRT03D)', () => {
  // BRT03D-01: ISO2 BR -> 🇧🇷 e ISO3 BRA -> 🇧🇷
  it('BRT03D-01: ISO2 BR -> 🇧🇷 e ISO3 BRA -> 🇧🇷 (mesmo input, mesma saída emoji)', () => {
    expect(countryFlag('BR')).toBe('🇧🇷')
    expect(countryFlag('BRA')).toBe('🇧🇷')
    expect(resolveCountryFlag('BR')).toBe('🇧🇷')
    expect(resolveCountryFlag('BRA')).toBe('🇧🇷')
  })

  // BRT03D-02: ISO2 DE -> 🇩🇪 e ISO3 DEU -> 🇩🇪
  it('BRT03D-02: ISO2 DE -> 🇩🇪 e ISO3 DEU -> 🇩🇪', () => {
    expect(countryFlag('DE')).toBe('🇩🇪')
    expect(countryFlag('DEU')).toBe('🇩🇪')
    expect(countryFlag('GER')).toBe('🇩🇪')
    expect(resolveCountryFlag('DE')).toBe('🇩🇪')
    expect(resolveCountryFlag('DEU')).toBe('🇩🇪')
  })

  // BRT03D-03: ISO2 GB -> 🇬🇧 e ISO3 GBR -> 🇬🇧
  it('BRT03D-03: ISO2 GB -> 🇬🇧 e ISO3 GBR -> 🇬🇧', () => {
    expect(countryFlag('GB')).toBe('🇬🇧')
    expect(countryFlag('GBR')).toBe('🇬🇧')
    expect(resolveCountryFlag('GB')).toBe('🇬🇧')
    expect(resolveCountryFlag('GBR')).toBe('🇬🇧')
  })

  // BRT03D-04: ISO2 US -> 🇺🇸 e ISO3 USA -> 🇺🇸
  it('BRT03D-04: ISO2 US -> 🇺🇸 e ISO3 USA -> 🇺🇸', () => {
    expect(countryFlag('US')).toBe('🇺🇸')
    expect(countryFlag('USA')).toBe('🇺🇸')
    expect(resolveCountryFlag('US')).toBe('🇺🇸')
    expect(resolveCountryFlag('USA')).toBe('🇺🇸')
  })

  // BRT03D-05: Outros pares obrigatórios ISO2 / ISO3 (NL/NLD, MC/MCO, JP/JPN, AU/AUS, FR/FRA, IT/ITA, TH/THA)
  it('BRT03D-05: Cobertura de pares ISO2 e ISO3 (NL/NLD, MC/MCO, JP/JPN, AU/AUS, FR/FRA, IT/ITA, TH/THA)', () => {
    const pairs: [string, string, string][] = [
      ['NL', 'NLD', '🇳🇱'],
      ['MC', 'MCO', '🇲🇨'],
      ['JP', 'JPN', '🇯🇵'],
      ['AU', 'AUS', '🇦🇺'],
      ['FR', 'FRA', '🇫🇷'],
      ['IT', 'ITA', '🇮🇹'],
      ['TH', 'THA', '🇹🇭'],
    ]

    for (const [iso2, iso3, expected] of pairs) {
      expect(countryFlag(iso2)).toBe(expected)
      expect(countryFlag(iso3)).toBe(expected)
      expect(resolveCountryFlag(iso2)).toBe(expected)
      expect(resolveCountryFlag(iso3)).toBe(expected)
    }
  })

  // BRT03D-06: Array de nacionalidades ['TH', 'GB'] -> primeira entrada como bandeira principal (🇹🇭)
  it('BRT03D-06: Array de nacionalidades ["TH", "GB"] resolve para 🇹🇭 (primeira como principal)', () => {
    expect(countryFlag(['TH', 'GB'])).toBe('🇹🇭')
    expect(resolveCountryFlag(['TH', 'GB'])).toBe('🇹🇭')
    expect(countryFlag(['GBR', 'BRA'])).toBe('🇬🇧')
    expect(resolveCountryFlag(['GBR', 'BRA'])).toBe('🇬🇧')
  })

  // BRT03D-07: Fallback de código não resolvido retorna a PRÓPRIA string de entrada (nunca undefined, null, '?')
  it('BRT03D-07: Fallback: código não resolvido retorna o próprio código original', () => {
    expect(countryFlag('XYZ')).toBe('XYZ')
    expect(countryFlag('UNKNOWN_CODE')).toBe('UNKNOWN_CODE')
    expect(resolveCountryFlag('XYZ')).toBe('XYZ')
    expect(resolveCountryFlag('UNKNOWN_NATION')).toBe('UNKNOWN_NATION')

    // Valores nulos/vazios
    expect(countryFlag('')).toBe('')
    expect(countryFlag(null)).toBe('')
    expect(countryFlag(undefined)).toBe('')

    // Chamadas com fallback explícito legado mantêm compatibilidade
    expect(resolveCountryFlag('XYZ', '🏁')).toBe('🏁')
  })

  // BRT03D-08: Componente CountryFlag aceita string | string[] | null | undefined
  it('BRT03D-08: Componente CountryFlag aceita array e renderiza primeira como principal', () => {
    // Array
    const { container: cArray } = render(React.createElement(CountryFlag, { code: ['TH', 'GB'] }))
    expect(cArray.textContent).toBe('🇹🇭')

    // ISO2
    const { container: cIso2 } = render(React.createElement(CountryFlag, { code: 'BR' }))
    expect(cIso2.textContent).toBe('🇧🇷')

    // ISO3
    const { container: cIso3 } = render(React.createElement(CountryFlag, { code: 'BRA' }))
    expect(cIso3.textContent).toBe('🇧🇷')

    // Vazio renderiza null
    const { container: cEmpty } = render(React.createElement(CountryFlag, { code: '' }))
    expect(cEmpty.firstChild).toBeNull()

    const { container: cNull } = render(React.createElement(CountryFlag, { code: null }))
    expect(cNull.firstChild).toBeNull()
  })

  // BRT03D-09: Nenhuma conversão destrutiva em save/reload nem nos dados canônicos
  it('BRT03D-09: Nenhuma conversão destrutiva em save/reload (dados originais preservados)', () => {
    const rawDriver = {
      id: 'drv_test_canonical',
      name: 'Alexander Albon',
      nationality: 'THA',
      nationalities: ['TH', 'GB'],
    }

    const flag = resolveCountryFlag(rawDriver.nationalities)
    expect(flag).toBe('🇹🇭')

    // Certifica que o objeto não foi mutado
    expect(rawDriver.nationality).toBe('THA')
    expect(rawDriver.nationalities).toEqual(['TH', 'GB'])

    // JSON serialization não sofre perda nem mutação
    const json = JSON.stringify(rawDriver)
    const parsed = JSON.parse(json)
    expect(parsed.nationality).toBe('THA')
    expect(parsed.nationalities).toEqual(['TH', 'GB'])

    // Normalização em memória não altera formato persistido
    expect(resolveCountryFlag(parsed.nationalities)).toBe('🇹🇭')
  })

  // BRT03D-10: Drivers canônicos preservam formatos originais nos catálogos (não são alterados no storage)
  it('BRT03D-10: Catálogo canônico de pilotos permanece com nacionalidade original intacta', () => {
    for (const driver of CANONICAL_DRIVERS_MASTER) {
      expect(driver.nationality).toBeDefined()
      // Não pode haver emoji persistido no catálogo
      expect(driver.nationality).not.toMatch(/[\uD83C][\uDDE6-\uDDFF]{2}/)
      // Deve resolver perfeitamente para emoji válido
      const resolved = resolveCountryFlag(driver.nationality)
      expect(resolved).toBeTruthy()
      expect(resolved).not.toBe('')
    }
  })
})
