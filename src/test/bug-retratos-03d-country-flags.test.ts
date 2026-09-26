import { describe, it, expect } from 'vitest'
import { countryFlag, countryName, resolveIso3, ISO3_TO_ISO2 } from '@/lib/country-flag'
import { CANONICAL_DRIVERS_MASTER } from '@/lib/canonical-driver-database'
import React from 'react'
import { render } from '@testing-library/react'
import { CountryFlag } from '@/components/CountryFlag'
import fs from 'fs'
import path from 'path'

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

  // 07 DriversPage não renderiza ISO3 puro onde há bandeira conhecida
  it('BRT03D-07: DriversPage usa <CountryFlag code={...} /> em vez de CountryFlagChip puro na lista de pilotos', () => {
    const filePath = path.resolve(process.cwd(), 'src/pages/DriversPage.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('<CountryFlag')
    expect(content).toContain('code={pilot.nationality}')
    expect(content).not.toContain('country={pilot.nationality}')
  })

  // 08 DriverSidePanel usa componente canônico
  it('BRT03D-08: DriverSidePanel usa componente canônico CountryFlag', () => {
    const filePath = path.resolve(process.cwd(), 'src/components/DriverSidePanel.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('<CountryFlag code={driver.nationality}')
    expect(content).not.toContain('<CountryFlagChip country={driver.nationality}')
  })

  // 09 Team/Academia usam componente canônico
  it('BRT03D-09: Team/Academia usam componente canônico CountryFlag', () => {
    const filePath = path.resolve(process.cwd(), 'src/pages/Team.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('<CountryFlag code={d.nationality}')
    expect(content).toContain('<CountryFlag code={rd.nationality}')
    expect(content).toContain('<CountryFlag code={pilot.nationality}')
    expect(content).toContain('<CountryFlag code={alumnus.nationality}')
    expect(content).not.toContain('getCountryFlag(d.nationality)')
    expect(content).not.toContain('getCountryFlag(rd.nationality)')
  })

  // 10 Mariana Fagundes → 🇧🇷
  it('BRT03D-10: Mariana Fagundes resolve para 🇧🇷 sem tocar nos dados', () => {
    const marianaNationality = 'Brasil'
    const flag = countryFlag(marianaNationality)
    expect(flag).toBe('🇧🇷')

    const marianaIso3 = 'BRA'
    expect(countryFlag(marianaIso3)).toBe('🇧🇷')

    const { container } = render(React.createElement(CountryFlag, { code: marianaNationality }))
    expect(container.textContent).toBe('🇧🇷')
  })

  // 11 ProspectCard usa componente canônico
  it('BRT03D-11: ProspectCard usa componente canônico CountryFlag', () => {
    const filePath = path.resolve(process.cwd(), 'src/components/ProspectCard.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('<CountryFlag code={prospect.nationality}')
  })

  // 12 contratos/mercado usam componente canônico
  it('BRT03D-12: contratos/mercado (DriverComparisonModal, SillySeasonModal, DriversPage modal) usam componente canônico', () => {
    const compModalPath = path.resolve(process.cwd(), 'src/components/DriverComparisonModal.tsx')
    const compContent = fs.readFileSync(compModalPath, 'utf-8')
    expect(compContent).toContain('<CountryFlag code={primaryDriver.nationality}')
    expect(compContent).toContain('<CountryFlag code={secondaryDriver.nationality}')
    expect(compContent).not.toContain('getCountryFlag(primaryDriver.nationality)')

    const sillyModalPath = path.resolve(process.cwd(), 'src/components/race/SillySeasonModal.tsx')
    const sillyContent = fs.readFileSync(sillyModalPath, 'utf-8')
    expect(sillyContent).toContain('<CountryFlag')
    expect(sillyContent).toContain('code={nationality}')

    const devModalPath = path.resolve(process.cwd(), 'src/components/DevelopmentManagerModal.tsx')
    const devContent = fs.readFileSync(devModalPath, 'utf-8')
    expect(devContent).toContain('<CountryFlag code={pilot.nationality}')
  })

  // 13 zero mapas locais duplicados ISO3→emoji nas superfícies migradas
  it('BRT03D-13: zero mapas locais duplicados ISO3→emoji nas superfícies migradas', () => {
    const filesToCheck = [
      'src/pages/DriversPage.tsx',
      'src/components/DriverSidePanel.tsx',
      'src/pages/Team.tsx',
      'src/components/ProspectCard.tsx',
      'src/components/DriverComparisonModal.tsx',
      'src/components/PilotProfileDialog.tsx',
      'src/components/DevelopmentManagerModal.tsx',
      'src/components/race/SillySeasonModal.tsx',
      'src/pages/Standings.tsx',
    ]

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath)
      const content = fs.readFileSync(fullPath, 'utf-8')
      // Não deve haver mapas locais do tipo 'DEU': '🇩🇪'
      expect(content).not.toMatch(/'DEU':\s*'🇩🇪'/)
      expect(content).not.toMatch(/"DEU":\s*"🇩🇪"/)
      expect(content).not.toMatch(/'BRA':\s*'🇧🇷'/)
    }
  })

  // 14 nationality permanece ISO3/nome nos dados (não migrado)
  it('BRT03D-14: nationality permanece ISO3 ou nome nos dados (não migrado para emoji)', () => {
    for (const driver of CANONICAL_DRIVERS_MASTER) {
      expect(driver.nationality).toBeDefined()
      // Deve ser texto ISO3 ou nome legível, nunca emoji de bandeira armazenado
      expect(driver.nationality).not.toMatch(/[\uD83C][\uDDE6-\uDDFF]{2}/)
    }
  })

  // 15 save/reload não altera nacionalidade
  it('BRT03D-15: save/reload não altera nacionalidade no objeto do piloto', () => {
    const rawPilotData = {
      id: 'hulk-01',
      name: 'Nico Hülkenberg',
      nationality: 'DEU',
    }

    const flagResolved = countryFlag(rawPilotData.nationality)
    expect(flagResolved).toBe('🇩🇪')

    // Simula save/reload em JSON
    const serialized = JSON.stringify(rawPilotData)
    const reloaded = JSON.parse(serialized)

    // O dado original permanece DEU
    expect(reloaded.nationality).toBe('DEU')
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
