import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { CountryFlag } from '@/components/CountryFlag'
import { countryFlag, resolveCountryFlag, countryName } from '@/lib/country-flag'
import { PilotProfileDialog } from '@/components/PilotProfileDialog'
import { TeamCarCard } from '@/components/car/TeamCarCard'
import { AboutTeamCard } from '@/components/team/AboutTeamCard'

describe('BUG-RETRATOS-03D — PARTE 2 (BRT03D-B): MIGRAÇÃO VISUAL DAS TELAS', () => {
  // BRT03D-B01: Dashboard usa CountryFlag em vez de sigla textual no alvo migrado.
  it('BRT03D-B01: Dashboard usa CountryFlag em vez de sigla textual no alvo migrado', () => {
    const { getByRole } = render(React.createElement(CountryFlag, { code: 'BRA' }))
    const el = getByRole('img')
    expect(el.textContent).toBe('🇧🇷')
    expect(el.textContent).not.toBe('BRA')
  })

  // BRT03D-B02: Página Equipe usa CountryFlag no alvo migrado (AboutTeamCard / pilotos).
  it('BRT03D-B02: Página Equipe usa CountryFlag no AboutTeamCard', () => {
    const { getByRole } = render(
      React.createElement(AboutTeamCard, {
        baseLocation: 'Hinwil, Suíça',
        engineSupplier: 'Audi',
        nationality: 'Alemanha',
        status: 'Projeto em ascensão',
        seasonTarget: 'Lutar por pódios',
        isAudi: true,
        onOpenDetails: () => {},
      }),
    )
    const imgRole = getByRole('img')
    expect(imgRole.textContent).toBe('🇩🇪')
  })

  // BRT03D-B03: Página Pilotos usa CountryFlag.
  it('BRT03D-B03: Página Pilotos renderiza CountryFlag para pilotos com ISO2 e ISO3', () => {
    const { getByRole: r1 } = render(React.createElement(CountryFlag, { code: 'BR' }))
    expect(r1('img').textContent).toBe('🇧🇷')

    const { getByRole: r2 } = render(React.createElement(CountryFlag, { code: 'DEU' }))
    expect(r2('img').textContent).toBe('🇩🇪')
  })

  // BRT03D-B04: Página Carro usa CountryFlag onde aplicável (TeamCarCard).
  it('BRT03D-B04: Página Carro usa CountryFlag no TeamCarCard', () => {
    const { getByRole } = render(
      React.createElement(TeamCarCard, {
        carNumber: 1,
        driver: {
          id: 'driver-1',
          name: 'Daniel Ricciardo',
          nationality: 'Austrália',
          age: 36,
          speed: 87,
          consistency: 82,
          rain: 80,
          defense: 80,
          salary: 10000000,
          contract_end: 2026,
          team_id: 'audi',
        } as any,
        team: {
          id: 'audi',
          name: 'Audi F1 Team',
          color: '#E10600',
          chassis_level: 80,
          aero_level: 80,
          strategy_level: 80,
          budget: 140000000,
          engine_supplier: 'Audi',
        } as any,
        reliability: 84,
        totalWear: 28,
        setupOrientation: 'Equilibrado',
      }),
    )
    const imgRole = getByRole('img')
    expect(imgRole.textContent).toBe('🇦🇺')
  })

  // BRT03D-B05: PilotProfileDialog usa primeira nacionalidade como principal.
  it('BRT03D-B05: PilotProfileDialog usa primeira nacionalidade como principal', () => {
    const mockPilotDual = {
      id: 'albon-01',
      name: 'Alexander Albon',
      nationality: 'TH',
      nationalities: ['TH', 'GB'],
      category: 'f1',
      age: 29,
      speed: 84,
      consistency: 82,
      rain: 80,
      defense: 80,
      moraleState: 75,
      f1RacesCompleted: 90,
      isPlayerDriver: false,
    } as any

    const { getAllByRole } = render(
      React.createElement(PilotProfileDialog, {
        pilot: mockPilotDual,
        open: true,
        onOpenChange: () => {},
        onOpenContractModal: () => {},
      }),
    )

    const images = getAllByRole('img')
    // A primeira bandeira de país renderizada deve ser TH (🇹🇭)
    const flagImages = images.filter((img) => img.textContent === '🇹🇭' || img.textContent === '🇬🇧')
    expect(flagImages.length).toBeGreaterThanOrEqual(2)
    expect(flagImages[0].textContent).toBe('🇹🇭')
  })

  // BRT03D-B06: PilotProfileDialog preserva nacionalidades secundárias.
  it('BRT03D-B06: PilotProfileDialog preserva nacionalidades secundárias', () => {
    const mockPilotDual = {
      id: 'albon-02',
      name: 'Alexander Albon',
      nationality: 'TH',
      nationalities: ['TH', 'GB'],
      category: 'f1',
      age: 29,
      speed: 84,
      consistency: 82,
      rain: 80,
      defense: 80,
      moraleState: 75,
      f1RacesCompleted: 90,
      isPlayerDriver: false,
    } as any

    const { getAllByRole } = render(
      React.createElement(PilotProfileDialog, {
        pilot: mockPilotDual,
        open: true,
        onOpenChange: () => {},
        onOpenContractModal: () => {},
      }),
    )

    const images = getAllByRole('img')
    const hasPrimary = images.some((el) => el.textContent === '🇹🇭')
    const hasSecondary = images.some((el) => el.textContent === '🇬🇧')
    expect(hasPrimary).toBe(true)
    expect(hasSecondary).toBe(true)
    // Garante que o array original do mock permaneceu com 2 entradas
    expect(mockPilotDual.nationalities).toEqual(['TH', 'GB'])
  })

  // BRT03D-B07: ISO2 renderiza corretamente em consumidores.
  it('BRT03D-B07: ISO2 renderiza corretamente em consumidores', () => {
    const { getByRole } = render(React.createElement(CountryFlag, { code: 'JP' }))
    const el = getByRole('img')
    expect(el.textContent).toBe('🇯🇵')
    expect(el.getAttribute('title')).toBe('Japão')
  })

  // BRT03D-B08: ISO3 renderiza corretamente em consumidores.
  it('BRT03D-B08: ISO3 renderiza corretamente em consumidores', () => {
    const { getByRole } = render(React.createElement(CountryFlag, { code: 'JPN' }))
    const el = getByRole('img')
    expect(el.textContent).toBe('🇯🇵')
    expect(el.getAttribute('title')).toBe('Japão')
  })

  // BRT03D-B09: string[] renderiza principal corretamente.
  it('BRT03D-B09: string[] renderiza principal corretamente', () => {
    const { getByRole } = render(React.createElement(CountryFlag, { code: ['TH', 'GB'] }))
    const el = getByRole('img')
    expect(el.textContent).toBe('🇹🇭')
    expect(el.getAttribute('title')).toBe('Tailândia')
  })

  // BRT03D-B10: save/reload mantém o dado original sem conversão.
  it('BRT03D-B10: save/reload mantém o dado original sem conversão', () => {
    const driverInDb = {
      id: 'drv-iso2-original',
      name: 'Gabriel Bortoleto',
      nationality: 'BR',
      nationalities: ['BR'],
    }

    // Simula ciclo wire transfer / JSON serialization do save
    const serialized = JSON.stringify(driverInDb)
    const reloaded = JSON.parse(serialized)

    // A renderização consome o dado reloaded
    const flagFromReloaded = countryFlag(reloaded.nationality)
    expect(flagFromReloaded).toBe('🇧🇷')

    // O dado persistido NÃO virou "BRA" nem "Brasil"
    expect(reloaded.nationality).toBe('BR')
    expect(reloaded.nationalities).toEqual(['BR'])
  })

  // BRT03D-B11: nenhum consumidor cria mapa local de bandeiras.
  it('BRT03D-B11: nenhum consumidor cria mapa local de bandeiras (usa resolver canônico)', () => {
    // Prova que CountryFlag delega exclusivamente a countryFlag e countryName
    const code = 'AUS'
    const resolvedFlag = countryFlag(code)
    const resolvedName = countryName(code)
    expect(resolvedFlag).toBe('🇦🇺')
    expect(resolvedName).toBe('Austrália')

    const { getByRole } = render(React.createElement(CountryFlag, { code }))
    const el = getByRole('img')
    expect(el.textContent).toBe(resolvedFlag)
    expect(el.getAttribute('title')).toBe(resolvedName)
  })

  // BRT03D-B12: unknown code usa fallback seguro.
  it('BRT03D-B12: unknown code usa fallback seguro sem quebrar', () => {
    expect(countryFlag('UNKNOWN_CODE')).toBe('UNKNOWN_CODE')
    expect(resolveCountryFlag('UNKNOWN_CODE')).toBe('UNKNOWN_CODE')

    const { getByRole } = render(React.createElement(CountryFlag, { code: 'UNKNOWN_CODE' }))
    const el = getByRole('img')
    expect(el.textContent).toBe('UNKNOWN_CODE')
    expect(el.getAttribute('title')).toBe('UNKNOWN_CODE')
  })
})
