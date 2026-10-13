import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import PaddockPage from '@/pages/PaddockPage'
import { CAREER_NAV_SECTIONS, ROUTE_TITLE_MAP } from '@/components/Sidebar'

const mockUseUnifiedSeason = vi.fn()

vi.mock('@/hooks/use-unified-season', () => ({
  useUnifiedSeason: () => mockUseUnifiedSeason(),
}))

describe('NAV-TEAMS-01A — Navegação Equipes vs Universo F1 e Dinamismo da Temporada', () => {
  it('Sidebar possui item "Equipes" apontando para /teams e "Universo F1" apontando para /paddock', () => {
    const allItems = CAREER_NAV_SECTIONS.flatMap((s) => s.items)

    const equipesItem = allItems.find((i) => i.name === 'Equipes')
    expect(equipesItem).toBeDefined()
    expect(equipesItem?.path).toBe('/teams')

    const universoItem = allItems.find((i) => i.name === 'Universo F1')
    expect(universoItem).toBeDefined()
    expect(universoItem?.path).toBe('/paddock')
  })

  it('ROUTE_TITLE_MAP mapeia /teams para "Equipes" e /paddock para "Universo F1"', () => {
    expect(ROUTE_TITLE_MAP['/teams']).toBe('Equipes')
    expect(ROUTE_TITLE_MAP['/paddock']).toBe('Universo F1')
  })

  it('PaddockPage exibe cabeçalho dinâmico com temporada ativa 2027 e rodada atual 1/24', () => {
    mockUseUnifiedSeason.mockReturnValue({
      team: {
        id: 'team_audi',
        name: 'Audi F1 Team',
        team_key: 'audi',
        color: '#FF2A00',
        engine_supplier: 'Audi',
      },
      season: { id: 'season_2027', year: 2027, current_round: 1, total_rounds: 24 },
      constructorStandings: [],
      playerDrivers: [],
      loading: false,
      currentRound: 1,
      totalRounds: 24,
    })

    render(<PaddockPage />)

    // Título e badge de temporada ativa
    expect(screen.getByText('UNIVERSO F1')).toBeDefined()
    expect(screen.getByText('TEMPORADA 2027')).toBeDefined()

    // Badge de rodada dinâmica
    const badge = screen.getByTestId('paddock-round-badge')
    expect(badge).toBeDefined()
    expect(badge.textContent).toContain('Temporada 2027 — Rodada 1/24')
  })
})
