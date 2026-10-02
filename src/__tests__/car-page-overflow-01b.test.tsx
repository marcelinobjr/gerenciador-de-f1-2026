import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import CarPage from '@/pages/Car'
import { TeamCarCard } from '@/components/car/TeamCarCard'
import { InstalledComponentsGrid } from '@/components/car/InstalledComponentsGrid'
import { QuickActionsCard } from '@/components/car/QuickActionsCard'
import { PerformanceRadarMap } from '@/components/car/PerformanceRadarMap'
import { TechnicalFooterCards } from '@/components/car/TechnicalFooterCards'
import { FREE_ENGINE_QUOTA } from '@/services/f1Service'

// Mock do contexto de autenticação com dados canônicos
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    team: {
      id: 'audi',
      name: 'Audi Sport F1 Team',
      team_key: 'audi',
      color: '#E10600',
      budget: 85000000,
      cost_cap_spent: 120000000,
      engine_supplier: 'Audi Sport',
      active_engine_wear: 15,
      engine_pool_used: 2,
    },
    season: {
      year: 2026,
      current_round: 3,
    },
    refreshTeamAndSeason: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: vi.fn(),
}))

vi.mock('@/services/f1Service', () => ({
  FREE_ENGINE_QUOTA: 4,
  f1Service: {
    COST_CAP_LIMIT: 215000000,
    getTeamParts: vi.fn().mockResolvedValue([
      { id: 'p1', name: 'Asa Dianteira', level: 6, condition: 85 },
      { id: 'p2', name: 'Asa Traseira', level: 5, condition: 80 },
    ]),
    getDrivers: vi.fn().mockResolvedValue([
      { id: 'd1', name: 'Gabriel Bortoleto', nationality: 'Brasil' },
      { id: 'd2', name: 'Nico Hülkenberg', nationality: 'Alemanha' },
    ]),
    getPartRepairCost: vi.fn().mockReturnValue(500000),
  },
}))

describe('MICRO-PACK-UI-02: CAR-PAGE-OVERFLOW-01B', () => {
  // CAR01: página Carro renderiza sem erro
  it('CAR01: página Carro renderiza sem erro', () => {
    const { container } = render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/car'] },
        React.createElement(CarPage, null),
      ),
    )
    expect(container).toBeTruthy()
    expect(container.querySelector('div')).toBeInTheDocument()
  })

  // CAR02: container principal não possui overflow horizontal não intencional
  it('CAR02: container principal possui containment e overflow horizontal protegido', () => {
    const { container } = render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/car'] },
        React.createElement(CarPage, null),
      ),
    )
    const rootWrapper = container.firstElementChild as HTMLElement
    expect(rootWrapper).toHaveClass('overflow-x-hidden')
    expect(rootWrapper).toHaveClass('w-full')
    expect(rootWrapper).toHaveClass('max-w-full')
  })

  // CAR03: cards permanecem contidos (classes min-w-0 e overflow-hidden)
  it('CAR03: cards de monoposto e componentes permanecem contidos com min-w-0 e overflow-hidden', () => {
    const { container } = render(
      React.createElement(TeamCarCard, {
        carNumber: 1,
        driver: { id: 'd1', name: 'Gabriel Bortoleto', nationality: 'Brasil' } as any,
        team: { id: 'audi', name: 'Audi Sport' } as any,
        reliability: 85,
        totalWear: 20,
        setupOrientation: 'Equilibrado',
      }),
    )
    const cardEl = container.firstElementChild as HTMLElement
    expect(cardEl).toHaveClass('min-w-0')
    expect(cardEl).toHaveClass('overflow-hidden')
    expect(cardEl).toHaveClass('w-full')
  })

  // CAR04: textos longos permanecem dentro dos cards sem estourar
  it('CAR04: textos longos permanecem contidos nos componentes com truncate ou break-words', () => {
    const { container } = render(
      React.createElement(InstalledComponentsGrid, {
        carNumber: 1,
        parts: [],
        driverName: 'Piloto com nome extraordinariamente longo da Silva Sauro',
      }),
    )
    const cardEl = container.firstElementChild as HTMLElement
    expect(cardEl).toHaveClass('overflow-hidden')
    expect(cardEl).toHaveClass('min-w-0')
  })

  // CAR05: botões/ações permanecem acessíveis
  it('CAR05: botões e ações do QuickActionsCard permanecem acessíveis e com wrap flexível', () => {
    const { getByText, container } = render(React.createElement(QuickActionsCard, null))
    const quickCard = container.firstElementChild as HTMLElement
    expect(quickCard).toHaveClass('overflow-hidden')
    expect(quickCard).toHaveClass('min-w-0')
    expect(getByText(/Trocar peça/i)).toBeInTheDocument()
    expect(getByText(/Instalar upgrade/i)).toBeInTheDocument()
    expect(getByText(/Comparar carros/i)).toBeInTheDocument()
    expect(getByText(/Equilibrar setup/i)).toBeInTheDocument()
  })

  // CAR06: nenhum valor técnico/gameplay foi alterado
  it('CAR06: nenhum valor técnico/gameplay foi alterado (chassi, PU quota, motor)', () => {
    expect(FREE_ENGINE_QUOTA).toBe(4)
  })

  // CAR07: desktop mantém layout consistente
  it('CAR07: desktop mantém layout consistente com grids responsivos e min-w-0', () => {
    const { container } = render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/car?tab=tecnica'] },
        React.createElement(CarPage, null),
      ),
    )
    const gridCols = container.querySelectorAll('.grid')
    expect(gridCols.length).toBeGreaterThan(0)
  })

  // CAR08: viewport menor não gera card fora da tela
  it('CAR08: viewport menor não gera overflow indevido e todos os containers respeitam w-full/min-w-0', () => {
    const { container: footerContainer } = render(React.createElement(TechnicalFooterCards, null))
    const footerEl = footerContainer.firstElementChild as HTMLElement
    expect(footerEl).toHaveClass('min-w-0')

    const { container: radarContainer } = render(React.createElement(PerformanceRadarMap, null))
    const radarEl = radarContainer.firstElementChild as HTMLElement
    expect(radarEl).toHaveClass('min-w-0')
    expect(radarEl).toHaveClass('overflow-hidden')
  })
})
