import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import {
  countryFlag,
  resolveCountryFlag,
  countryName,
  resolveIso2,
  resolveIso3,
  ISO3_TO_ISO2,
  SUPPORTED_ISO2,
  type CountryInput,
} from '@/lib/country-flag'
import { CountryFlag } from '@/components/CountryFlag'

describe('BUG-RETRATOS-03D — PARTE 1 (BRT03D-A): RESOLVER CANÔNICO', () => {
  // BRT03D-A01: BR → bandeira Brasil.
  it('BRT03D-A01: BR resolve para a bandeira do Brasil 🇧🇷', () => {
    expect(countryFlag('BR')).toBe('🇧🇷')
    expect(resolveCountryFlag('BR')).toBe('🇧🇷')
  })

  // BRT03D-A02: BRA → mesma bandeira Brasil.
  it('BRT03D-A02: BRA resolve para a mesma bandeira do Brasil 🇧🇷', () => {
    expect(countryFlag('BRA')).toBe('🇧🇷')
    expect(resolveCountryFlag('BRA')).toBe('🇧🇷')
    expect(countryFlag('BRA')).toBe(countryFlag('BR'))
  })

  // BRT03D-A03: DE / DEU → mesma bandeira.
  it('BRT03D-A03: DE e DEU resolvem para a mesma bandeira da Alemanha 🇩🇪', () => {
    expect(countryFlag('DE')).toBe('🇩🇪')
    expect(countryFlag('DEU')).toBe('🇩🇪')
    expect(countryFlag('DE')).toBe(countryFlag('DEU'))
  })

  // BRT03D-A04: GB / GBR → mesma bandeira.
  it('BRT03D-A04: GB e GBR resolvem para a mesma bandeira do Reino Unido 🇬🇧', () => {
    expect(countryFlag('GB')).toBe('🇬🇧')
    expect(countryFlag('GBR')).toBe('🇬🇧')
    expect(countryFlag('GB')).toBe(countryFlag('GBR'))
  })

  // BRT03D-A05: US / USA → mesma bandeira.
  it('BRT03D-A05: US e USA resolvem para a mesma bandeira dos Estados Unidos 🇺🇸', () => {
    expect(countryFlag('US')).toBe('🇺🇸')
    expect(countryFlag('USA')).toBe('🇺🇸')
    expect(countryFlag('US')).toBe(countryFlag('USA'))
  })

  // BRT03D-A06: JP / JPN → mesma bandeira.
  it('BRT03D-A06: JP e JPN resolvem para a mesma bandeira do Japão 🇯🇵', () => {
    expect(countryFlag('JP')).toBe('🇯🇵')
    expect(countryFlag('JPN')).toBe('🇯🇵')
    expect(countryFlag('JP')).toBe(countryFlag('JPN'))
  })

  // BRT03D-A07: AU / AUS → mesma bandeira.
  it('BRT03D-A07: AU e AUS resolvem para a mesma bandeira da Austrália 🇦🇺', () => {
    expect(countryFlag('AU')).toBe('🇦🇺')
    expect(countryFlag('AUS')).toBe('🇦🇺')
    expect(countryFlag('AU')).toBe(countryFlag('AUS'))
  })

  // BRT03D-A08: ["TH","GB"] → principal TH.
  it('BRT03D-A08: ["TH","GB"] usa TH como bandeira principal (🇹🇭)', () => {
    const input = ['TH', 'GB']
    expect(countryFlag(input)).toBe('🇹🇭')
    expect(resolveCountryFlag(input)).toBe('🇹🇭')
    expect(resolveCountryFlag(['THA', 'GBR'])).toBe('🇹🇭')
  })

  // BRT03D-A09: resolver NÃO muta array.
  it('BRT03D-A09: resolver NÃO muta, reordena ou reduz o array de entrada', () => {
    const input = ['TH', 'GB']
    const copy = [...input]
    Object.freeze(input) // garante imutabilidade estrita
    expect(() => countryFlag(input)).not.toThrow()
    expect(() => resolveCountryFlag(input)).not.toThrow()
    expect(input).toEqual(copy)
    expect(input.length).toBe(2)
    expect(input[0]).toBe('TH')
    expect(input[1]).toBe('GB')
  })

  // BRT03D-A10: " br " resolve corretamente.
  it('BRT03D-A10: " br " com espaços e minúsculas resolve para bandeira do Brasil 🇧🇷', () => {
    expect(countryFlag(' br ')).toBe('🇧🇷')
    expect(resolveCountryFlag(' br ')).toBe('🇧🇷')
  })

  // BRT03D-A11: "deu" resolve corretamente.
  it('BRT03D-A11: "deu" em minúsculas resolve para bandeira da Alemanha 🇩🇪', () => {
    expect(countryFlag('deu')).toBe('🇩🇪')
    expect(resolveCountryFlag('deu')).toBe('🇩🇪')
  })

  // BRT03D-A12: XYZ → XYZ (fallback seguro sem null/undefined/?).
  it('BRT03D-A12: XYZ desconhecido retorna fallback seguro "XYZ"', () => {
    expect(countryFlag('XYZ')).toBe('XYZ')
    expect(resolveCountryFlag('XYZ')).toBe('XYZ')
    expect(countryFlag('FOO')).toBe('FOO')
    expect(resolveCountryFlag('FOO')).toBe('FOO')
  })

  // BRT03D-A13: null/undefined/[] não quebram render.
  it('BRT03D-A13: null, undefined e [] retornam string vazia neutra sem quebrar', () => {
    expect(countryFlag(null)).toBe('')
    expect(countryFlag(undefined)).toBe('')
    expect(countryFlag([])).toBe('')
    expect(resolveCountryFlag(null)).toBe('')
    expect(resolveCountryFlag(undefined)).toBe('')
    expect(resolveCountryFlag([])).toBe('')

    // Render de CountryFlag com inputs vazios retorna null sem lançar
    const { container: c1 } = render(React.createElement(CountryFlag, { code: null }))
    expect(c1.firstChild).toBeNull()

    const { container: c2 } = render(React.createElement(CountryFlag, { code: undefined }))
    expect(c2.firstChild).toBeNull()

    const { container: c3 } = render(React.createElement(CountryFlag, { code: [] }))
    expect(c3.firstChild).toBeNull()

    const { container: c4 } = render(React.createElement(CountryFlag, { code: '   ' }))
    expect(c4.firstChild).toBeNull()
  })

  // BRT03D-A14: CountryFlag usa resolver canônico.
  it('BRT03D-A14: Componente CountryFlag consome o resolver canônico', () => {
    const { getByRole: getByRole1 } = render(React.createElement(CountryFlag, { code: 'BR' }))
    const el1 = getByRole1('img')
    expect(el1.textContent).toBe('🇧🇷')

    const { getByRole: getByRole2 } = render(React.createElement(CountryFlag, { code: 'BRA' }))
    const el2 = getByRole2('img')
    expect(el2.textContent).toBe('🇧🇷')

    const { getByRole: getByRole3 } = render(
      React.createElement(CountryFlag, { code: ['TH', 'GB'] }),
    )
    const el3 = getByRole3('img')
    expect(el3.textContent).toBe('🇹🇭')
  })

  // BRT03D-A15: CountryFlag possui title e aria-label com o nome canônico do país.
  it('BRT03D-A15: CountryFlag renderiza title e aria-label com nome do país (BR/BRA -> Brasil)', () => {
    expect(countryName('BR')).toBe('Brasil')
    expect(countryName('BRA')).toBe('Brasil')
    expect(countryName('DE')).toBe('Alemanha')
    expect(countryName('DEU')).toBe('Alemanha')
    expect(countryName('GB')).toBe('Reino Unido')
    expect(countryName('GBR')).toBe('Reino Unido')
    expect(countryName('US')).toBe('Estados Unidos')
    expect(countryName('USA')).toBe('Estados Unidos')

    const { getByRole } = render(React.createElement(CountryFlag, { code: 'BR' }))
    const el = getByRole('img')
    expect(el.getAttribute('title')).toBe('Brasil')
    expect(el.getAttribute('aria-label')).toBe('Brasil')
  })

  // BRT03D-A16: todos os códigos ISO2 usados na base atual resolvem.
  it('BRT03D-A16: todos os códigos ISO2 obrigatórios da base atual resolvem para bandeira válida', () => {
    const requiredIso2 = [
      'BR',
      'DE',
      'GB',
      'US',
      'NL',
      'MC',
      'JP',
      'AU',
      'FR',
      'IT',
      'TH',
      'FI',
      'ES',
      'CA',
      'MX',
      'AR',
      'NZ',
      'CH',
      'AT',
      'BE',
      'SE',
      'DK',
      'NO',
      'IE',
      'CN',
    ]

    for (const code of requiredIso2) {
      const flag = countryFlag(code)
      expect(flag).toBeTruthy()
      expect(flag).not.toBe(code)
      // Testa se contém pictograma / emoji de bandeira
      expect(/\p{Extended_Pictographic}/u.test(flag)).toBe(true)
    }
  })

  // BRT03D-A17: todos os códigos ISO3 usados no runtime atual resolvem para a mesma bandeira do ISO2 correspondente.
  it('BRT03D-A17: todos os códigos ISO3 obrigatórios do runtime resolvem para a mesma bandeira do seu ISO2', () => {
    const iso3ToIso2Pairs: Record<string, string> = {
      BRA: 'BR',
      DEU: 'DE',
      GBR: 'GB',
      USA: 'US',
      NLD: 'NL',
      MCO: 'MC',
      JPN: 'JP',
      AUS: 'AU',
      FRA: 'FR',
      ITA: 'IT',
      THA: 'TH',
      FIN: 'FI',
      ESP: 'ES',
      CAN: 'CA',
      MEX: 'MX',
      ARG: 'AR',
      NZL: 'NZ',
      CHE: 'CH',
      AUT: 'AT',
      BEL: 'BE',
      SWE: 'SE',
      DNK: 'DK',
      IRL: 'IE',
      CHN: 'CN',
    }

    for (const [iso3, iso2] of Object.entries(iso3ToIso2Pairs)) {
      const flagFromIso3 = countryFlag(iso3)
      const flagFromIso2 = countryFlag(iso2)
      expect(flagFromIso3).toBe(flagFromIso2)
      expect(countryName(iso3)).toBe(countryName(iso2))
    }
  })

  // BRT03D-A18: nenhuma resolução altera o formato persistido de nationality/nationalities.
  it('BRT03D-A18: nenhuma resolução altera o formato de nationality/nationalities original', () => {
    interface DriverRecordMock {
      name: string
      nationality: string
      nationalities?: string[]
    }

    const driverSingle: DriverRecordMock = {
      name: 'Gabriel Bortoleto',
      nationality: 'Brasil',
    }

    const driverDual: DriverRecordMock = {
      name: 'Alexander Albon',
      nationality: 'TH',
      nationalities: ['TH', 'GB'],
    }

    const driverIso3: DriverRecordMock = {
      name: 'Test Driver',
      nationality: 'DEU',
    }

    // Executa resolução sobre os registros
    const flagSingle = countryFlag(driverSingle.nationality)
    const flagDual = countryFlag(driverDual.nationalities)
    const flagIso3 = countryFlag(driverIso3.nationality)

    expect(flagSingle).toBe('🇧🇷')
    expect(flagDual).toBe('🇹🇭')
    expect(flagIso3).toBe('🇩🇪')

    // Prova de não-mutação dos dados originais
    expect(driverSingle.nationality).toBe('Brasil')
    expect(driverDual.nationality).toBe('TH')
    expect(driverDual.nationalities).toEqual(['TH', 'GB'])
    expect(driverIso3.nationality).toBe('DEU')
  })
})
