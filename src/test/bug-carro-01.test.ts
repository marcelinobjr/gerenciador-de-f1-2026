import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import CarPage from '@/pages/Car'
import App from '@/App'
import { f1Service } from '@/services/f1Service'
import * as AuthContextModule from '@/contexts/AuthContext'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Mock do PocketBase
vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    authStore: {
      isValid: true,
      record: { id: 'usr-1', email: 'test@apex.com' },
      onChange: vi.fn(() => () => {}),
      clear: vi.fn(),
    },
    collection: vi.fn(() => ({
      getFullList: vi.fn().mockResolvedValue([]),
      getList: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
      getFirstListItem: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      subscribe: vi.fn(() => vi.fn()),
      unsubscribe: vi.fn(),
    })),
  },
}))

vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: vi.fn(),
}))

const mockTeam: any = {
  id: 'team-audi-2026',
  team_key: 'audi',
  name: 'Audi Sport F1 Team',
  color: '#E10600',
  budget: 120000000,
  cost_cap_spent: 45000000,
  engine_supplier: 'Audi Sport',
  active_engine_wear: 15,
  engine_pool_used: 2,
  user_id: 'usr-1',
  technical_attributes: {
    aerodynamics: 82,
    downforce: 80,
    drag_reduction: 81,
    powertrain_output: 82,
    ers_efficiency: 81,
    fuel_efficiency: 80,
    chassis_rigidity: 78,
    weight_distribution: 79,
    suspension_geometry: 78,
    brake_efficiency: 77,
    cooling_efficiency: 80,
    tire_preservation: 75,
  },
}

const mockSeason: any = {
  id: 'season-2026',
  year: 2026,
  team_id: 'team-audi-2026',
  current_round: 3,
}

const mockDrivers: any[] = [
  {
    id: 'drv-hul',
    name: 'Nico Hülkenberg',
    team_id: 'team-audi-2026',
    role: 'titular',
    number: 27,
    speed: 84,
    consistency: 85,
    morale: 88,
    physical_condition: 90,
  },
  {
    id: 'drv-bor',
    name: 'Gabriel Bortoleto',
    team_id: 'team-audi-2026',
    role: 'titular',
    number: 5,
    speed: 82,
    consistency: 81,
    morale: 90,
    physical_condition: 95,
  },
]

const mockParts: any[] = [
  {
    id: 'part-fw',
    team_id: 'team-audi-2026',
    name: 'Asa Dianteira Spec B',
    type: 'front_wing',
    condition: 88,
    level: 2,
  },
  {
    id: 'part-rw',
    team_id: 'team-audi-2026',
    name: 'Asa Traseira Spec B',
    type: 'rear_wing',
    condition: 90,
    level: 2,
  },
]

describe('BUG-CARRO-01 — Suíte Canônica: Rota /car, Links de Notificação e Resolução do Loading', () => {
  let mockUseAuth: any

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()

    vi.spyOn(f1Service, 'getTeamParts').mockResolvedValue(mockParts)
    vi.spyOn(f1Service, 'getDrivers').mockResolvedValue(mockDrivers)

    mockUseAuth = vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-1' } as any,
      team: mockTeam,
      season: mockSeason,
      isLoading: false,
      careerPhase: 'career',
      refreshTeamAndSeason: vi.fn().mockResolvedValue(undefined),
      resetGame: vi.fn().mockResolvedValue(undefined),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      ensureValidSession: vi.fn().mockResolvedValue(true),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // (a) Nenhum link gerado pelo serviço de notificações aponta para rota inexistente ("/carro" zerado)
  it('BC01-01: Nenhum gerador de notificação em f1Service e notificationGenerator aponta para "/carro"', () => {
    const f1ServiceContent = readFileSync(
      resolve(process.cwd(), 'src/services/f1Service.ts'),
      'utf-8',
    )
    const notifGenContent = readFileSync(
      resolve(process.cwd(), 'src/services/notificationGenerator.ts'),
      'utf-8',
    )

    // O gerador P&D não pode conter link: '/carro'
    expect(f1ServiceContent.includes("link: '/carro'")).toBe(false)
    expect(f1ServiceContent.includes('link: "/carro"')).toBe(false)
    expect(notifGenContent.includes("link: '/carro'")).toBe(false)
    expect(notifGenContent.includes('link: "/carro"')).toBe(false)

    // P&D deve apontar para /car
    expect(f1ServiceContent.includes("link: '/car'")).toBe(true)
  })

  // (b) loadCarData resolve mesmo se uma das promessas pendurar/falhar (não fica eterno)
  it('BC01-02: loadCarData resolve mesmo se getDrivers pendurar indefinidamente (Promise nunca resolvida)', async () => {
    // Simula pendurar getDrivers para sempre
    vi.spyOn(f1Service, 'getDrivers').mockImplementation(
      () => new Promise(() => {}), // never resolves
    )

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/car'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/car', element: React.createElement(CarPage) }),
        ),
      ),
    )

    // Deve resolver e exibir Meu Carro via timeout/safety timer
    await waitFor(
      () => {
        expect(screen.getByText('Meu Carro')).toBeInTheDocument()
      },
      { timeout: 3500 },
    )
  })

  it('BC01-03: loadCarData resolve mesmo se getTeamParts rejeitar com erro', async () => {
    vi.spyOn(f1Service, 'getTeamParts').mockRejectedValueOnce(new Error('Network failure'))

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/car'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/car', element: React.createElement(CarPage) }),
        ),
      ),
    )

    await waitFor(() => {
      expect(screen.getByText('Meu Carro')).toBeInTheDocument()
    })
    expect(screen.getByText('Garagem')).toBeInTheDocument()
    expect(screen.getByText('Área Técnica')).toBeInTheDocument()
  })

  it('BC01-04: loadCarData resolve mesmo se o time ainda não estiver carregado (team === null)', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'usr-1' } as any,
      team: null,
      season: null,
      isLoading: false,
      careerPhase: 'career',
      refreshTeamAndSeason: vi.fn(),
      resetGame: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      ensureValidSession: vi.fn().mockResolvedValue(true),
    })

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/car'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/car', element: React.createElement(CarPage) }),
        ),
      ),
    )

    await waitFor(() => {
      expect(screen.getByText('Meu Carro')).toBeInTheDocument()
    })
  })

  // (c) Rotas "/car" e "/pilotos" registram os componentes corretos
  it('BC01-05: Rota canônica "/car" exibe CarPage e /carro redireciona com sucesso', async () => {
    window.history.pushState({}, 'Carro Page', '/carro')

    render(React.createElement(App))

    await waitFor(() => {
      expect(screen.getByText('Meu Carro')).toBeInTheDocument()
    })
    expect(window.location.pathname).toBe('/car')
  })

  it('BC01-06: Rota canônica "/pilotos" exibe DriversPage com catálogo de pilotos', async () => {
    window.history.pushState({}, 'Pilotos Page', '/pilotos')

    render(React.createElement(App))

    await waitFor(() => {
      expect(screen.getByText('Pilotos')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Mercado, contratos, superlicença e comparação de talentos.'),
    ).toBeInTheDocument()
  })
})
