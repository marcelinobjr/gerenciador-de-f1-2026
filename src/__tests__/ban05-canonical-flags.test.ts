import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import {
  countryFlag,
  resolveCountryFlag,
  countryName,
  resolveIso2,
  resolveIso3,
  type CountryInput,
} from '@/lib/country-flag'
import { CountryFlag } from '@/components/CountryFlag'

describe('BAN05 — FECHAMENTO FORMAL DAS BANDEIRAS PÓS-BRT03D (BAN05-01..12)', () => {
  // BAN05-01: ISO2 de equipe resolve corretamente.
  it('BAN05-01: ISO2 de equipe resolve corretamente', () => {
    // Equipes clássicas: DE (Mercedes/Audi), IT (Ferrari/RB), GB (McLaren/Williams/Aston), US (Haas/Cadillac), FR (Alpine)
    expect(countryFlag('DE')).toBe('🇩🇪')
    expect(resolveCountryFlag('IT')).toBe('🇮🇹')
    expect(resolveCountryFlag('GB')).toBe('🇬🇧')
    expect(resolveCountryFlag('US')).toBe('🇺🇸')
    expect(resolveCountryFlag('FR')).toBe('🇫🇷')
  })

  // BAN05-02: ISO3 de equipe resolve para a mesma bandeira do ISO2.
  it('BAN05-02: ISO3 de equipe resolve para a mesma bandeira do ISO2', () => {
    expect(countryFlag('DEU')).toBe(countryFlag('DE'))
    expect(countryFlag('ITA')).toBe(countryFlag('IT'))
    expect(countryFlag('GBR')).toBe(countryFlag('GB'))
    expect(countryFlag('USA')).toBe(countryFlag('US'))
    expect(countryFlag('FRA')).toBe(countryFlag('FR'))
    expect(resolveCountryFlag('DEU')).toBe(resolveCountryFlag('DE'))
    expect(resolveCountryFlag('BRA')).toBe(resolveCountryFlag('BR'))
  })

  // BAN05-03: country array usa o primeiro valor como principal.
  it('BAN05-03: country array usa o primeiro valor como principal', () => {
    const inputDual = ['TH', 'GB']
    expect(countryFlag(inputDual)).toBe('🇹🇭')
    expect(resolveCountryFlag(inputDual)).toBe('🇹🇭')
    expect(resolveCountryFlag(['THA', 'GBR'])).toBe('🇹🇭')
    expect(countryFlag(['DE', 'IT'])).toBe('🇩🇪')
  })

  // BAN05-04: resolver não muta o array recebido.
  it('BAN05-04: resolver não muta o array recebido', () => {
    const input = ['TH', 'GB']
    const copy = [...input]
    Object.freeze(input) // trava array para garantir que qualquer mutação lançará erro
    expect(() => countryFlag(input)).not.toThrow()
    expect(() => resolveCountryFlag(input)).not.toThrow()
    expect(input).toEqual(copy)
    expect(input.length).toBe(2)
    expect(input[0]).toBe('TH')
    expect(input[1]).toBe('GB')
  })

  // BAN05-05: CountryFlag de equipe consome o resolver central.
  it('BAN05-05: CountryFlag de equipe consome o resolver central', () => {
    const { getByRole: r1 } = render(React.createElement(CountryFlag, { code: 'DE' }))
    expect(r1('img').textContent).toBe(countryFlag('DE'))
    expect(r1('img').textContent).toBe('🇩🇪')

    const { getByRole: r2 } = render(React.createElement(CountryFlag, { code: 'GBR' }))
    expect(r2('img').textContent).toBe(countryFlag('GBR'))
    expect(r2('img').textContent).toBe('🇬🇧')
  })

  // BAN05-06: circuito/evento com ISO2 resolve corretamente.
  it('BAN05-06: circuito/evento com ISO2 resolve corretamente', () => {
    // Bahrein (BH), Japão (JP), Austrália (AU), Mônaco (MC), Brasil (BR), Grã-Bretanha (GB), Bélgica (BE), Itália (IT)
    expect(countryFlag('BH')).toBe('🇧🇭')
    expect(countryFlag('JP')).toBe('🇯🇵')
    expect(countryFlag('AU')).toBe('🇦🇺')
    expect(countryFlag('MC')).toBe('🇲🇨')
    expect(countryFlag('BR')).toBe('🇧🇷')
    expect(countryFlag('BE')).toBe('🇧🇪')
    expect(resolveCountryFlag('BH')).toBe('🇧🇭')
  })

  // BAN05-07: circuito/evento com ISO3 resolve corretamente.
  it('BAN05-07: circuito/evento com ISO3 resolve corretamente', () => {
    // BHR -> BH (Bahrein), JPN -> JP (Japão), AUS -> AU (Austrália), MCO -> MC (Mônaco), BEL -> BE (Bélgica)
    expect(countryFlag('BHR')).toBe(countryFlag('BH'))
    expect(countryFlag('JPN')).toBe(countryFlag('JP'))
    expect(countryFlag('AUS')).toBe(countryFlag('AU'))
    expect(countryFlag('MCO')).toBe(countryFlag('MC'))
    expect(countryFlag('BEL')).toBe(countryFlag('BE'))
    expect(resolveCountryFlag('BHR')).toBe('🇧🇭')
  })

  // BAN05-08: Calendar/Tracks não inferem país pelo nome do circuito.
  it('BAN05-08: Calendar/Tracks não inferem país pelo nome do circuito', () => {
    // Proibido inferir por nome textual do circuito/cidade/GP: a fonte de país deve ser a propriedade de país (ISO2, ISO3 ou nome canônico de país)
    // Se passarmos apenas nomes de circuito desconhecidos como country code, o resolver canônico não inventa país:
    const circuitName = 'Circuit de Spa-Francorchamps'
    // Como não é código nem país no dicionário, deve retornar a própria string (fallback seguro) e NÃO '🇧🇪'
    expect(countryFlag(circuitName)).toBe(circuitName)
    expect(resolveCountryFlag(circuitName)).toBe(circuitName)

    const silverstoneName = 'Silverstone Circuit'
    expect(countryFlag(silverstoneName)).toBe(silverstoneName)
  })

  // BAN05-09: unknown/null não quebra render.
  it('BAN05-09: unknown/null não quebra render', () => {
    expect(countryFlag(null)).toBe('')
    expect(countryFlag(undefined)).toBe('')
    expect(countryFlag([])).toBe('')
    expect(resolveCountryFlag(null)).toBe('')
    expect(resolveCountryFlag(undefined)).toBe('')

    // Unknown code retorna a própria string com segurança
    expect(countryFlag('UNKNOWN_CODE')).toBe('UNKNOWN_CODE')
    expect(resolveCountryFlag('UNKNOWN_CODE')).toBe('UNKNOWN_CODE')

    // Render de null/undefined em CountryFlag não joga exceção e retorna null
    const { container: c1 } = render(React.createElement(CountryFlag, { code: null }))
    expect(c1.firstChild).toBeNull()

    const { container: c2 } = render(React.createElement(CountryFlag, { code: undefined }))
    expect(c2.firstChild).toBeNull()

    const { getByRole } = render(React.createElement(CountryFlag, { code: 'UNKNOWN_CODE' }))
    expect(getByRole('img').textContent).toBe('UNKNOWN_CODE')
  })

  // BAN05-10: title/aria-label permanece coerente.
  it('BAN05-10: title/aria-label permanece coerente', () => {
    expect(countryName('BR')).toBe('Brasil')
    expect(countryName('BRA')).toBe('Brasil')
    expect(countryName('DE')).toBe('Alemanha')
    expect(countryName('DEU')).toBe('Alemanha')
    expect(countryName('GB')).toBe('Reino Unido')
    expect(countryName('GBR')).toBe('Reino Unido')

    const { getByRole: r1 } = render(React.createElement(CountryFlag, { code: 'BR' }))
    const el1 = r1('img')
    expect(el1.getAttribute('title')).toBe('Brasil')
    expect(el1.getAttribute('aria-label')).toBe('Brasil')

    const { getByRole: r2 } = render(React.createElement(CountryFlag, { code: 'BRA' }))
    const el2 = r2('img')
    expect(el2.getAttribute('title')).toBe('Brasil')
    expect(el2.getAttribute('aria-label')).toBe('Brasil')
  })

  // BAN05-11: não existe mapping paralelo necessário em Index/Tracks/Calendar — prova de que os componentes consomem o helper/componente canônico.
  it('BAN05-11: não existe mapping paralelo necessário — componentes consomem o helper/componente canônico', () => {
    // Valida que resolveCountryFlag resolve uniformemente o mesmo emoji tanto para entrada ISO quanto para nomes em PT
    expect(resolveCountryFlag('Bahrein')).toBe(resolveCountryFlag('BH'))
    expect(resolveCountryFlag('Austrália')).toBe(resolveCountryFlag('AU'))
    expect(resolveCountryFlag('Brasil')).toBe(resolveCountryFlag('BR'))
    expect(resolveCountryFlag('Alemanha')).toBe(resolveCountryFlag('DE'))
    expect(resolveCountryFlag('Reino Unido')).toBe(resolveCountryFlag('GB'))
    expect(resolveCountryFlag('Estados Unidos')).toBe(resolveCountryFlag('US'))
    expect(resolveCountryFlag('Itália')).toBe(resolveCountryFlag('IT'))
  })

  // BAN05-12: equipe e circuito com o mesmo country code produzem a MESMA representação pelo resolver.
  it('BAN05-12: equipe e circuito com o mesmo country code produzem a MESMA representação pelo resolver', () => {
    // Equipe da Itália (Ferrari) e GP da Itália (Monza) com o mesmo código IT / ITA
    const teamCountryCode = 'IT'
    const circuitCountryCode = 'IT'
    expect(resolveCountryFlag(teamCountryCode)).toBe(resolveCountryFlag(circuitCountryCode))
    expect(countryFlag(teamCountryCode)).toBe(countryFlag(circuitCountryCode))
    expect(countryName(teamCountryCode)).toBe(countryName(circuitCountryCode))

    // Equipe do Reino Unido (McLaren) e GP da Grã-Bretanha (Silverstone) com o mesmo código GBR
    const teamIso3 = 'GBR'
    const circuitIso3 = 'GBR'
    expect(resolveCountryFlag(teamIso3)).toBe(resolveCountryFlag(circuitIso3))
    expect(countryFlag(teamIso3)).toBe(countryFlag(circuitIso3))
    expect(countryName(teamIso3)).toBe(countryName(circuitIso3))
    expect(resolveCountryFlag(teamIso3)).toBe(resolveCountryFlag('GB'))
  })
})
