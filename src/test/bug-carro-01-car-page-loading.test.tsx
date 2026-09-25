import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import CarPage from '@/pages/Car'
import App from '@/App'
import { f1Service } from '@/services/f1Service'
import * as AuthContextModule from '@/contexts/AuthContext'

// Mock de serviços necessários
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

describe('BUG-CARRO-01 — Página /carro e CarPage Resolução de Conteúdo', () => {
  let mockUseAuth: any

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()

    // Mock das chamadas f1Service
    vi.spyOn(f1Service, 'getTeamParts').mockResolvedValue(mockParts)
    vi.spyOn(f1Service, 'getDrivers').mockResolvedValue(mockDrivers)

    // Mock useAuth
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

  it('BC01-01: Rota /carro deve renderizar a página do Carro sem 404 e sem travar em loading', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/carro']}>
        <Routes>
          <Route path="/carro" element={<CarPage />} />
          <Route path="/car" element={<CarPage />} />
        </Routes>
      </MemoryRouter>,
    )

    // Aguarda o término do loading e o surgimento do título da página
    await waitFor(() => {
      expect(screen.getByText('Meu Carro')).toBeInTheDocument()
    })

    // Garante que o conteúdo real do carro do jogador foi renderizado
    expect(screen.getByText('Garagem')).toBeInTheDocument()
    expect(screen.getByText('Área Técnica')).toBeInTheDocument()
    expect(container.querySelector('div.min-h-screen')).toBeInTheDocument()
  })

  it('BC01-02: Deve exibir informações dos dois monopostos do jogador (Carro #1 e Carro #2) e pilotos titulares', async () => {
    render(
      <MemoryRouter initialEntries={['/carro']}>
        <Routes>
          <Route path="/carro" element={<CarPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Meu Carro')).toBeInTheDocument()
    })

    // Confere a presença das seções dos monopostos
    expect(screen.getByText(/Nico Hülkenberg/i)).toBeInTheDocument()
    expect(screen.getByText(/Gabriel Bortoleto/i)).toBeInTheDocument()
  })

  it('BC01-03: Loading nunca deve ficar preso mesmo se f1Service.getTeamParts rejeitar', async () => {
    vi.spyOn(f1Service, 'getTeamParts').mockRejectedValueOnce(new Error('Network error PocketBase'))

    render(
      <MemoryRouter initialEntries={['/carro']}>
        <Routes>
          <Route path="/carro" element={<CarPage />} />
        </Routes>
      </MemoryRouter>,
    )

    // Mesmo com erro de rede ou backend lento, o loading DEVE resolver para a tela real com fallback
    await waitFor(() => {
      expect(screen.getByText('Meu Carro')).toBeInTheDocument()
    })
  })

  it('BC01-04: Loading nunca deve ficar preso se team for inicialmente nulo ou indef', async () => {
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
      <MemoryRouter initialEntries={['/carro']}>
        <Routes>
          <Route path="/carro" element={<CarPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Meu Carro')).toBeInTheDocument()
    })
  })

  it('BC01-05: Preservação de configurações específicas do carro via localStorage após reload', async () => {
    localStorage.setItem('apex_gp_car1_engine_unit', '3')
    localStorage.setItem(
      'apex_gp_car1_specs',
      JSON.stringify({ frontWing: 'Spec C - Evolução Monza' }),
    )

    render(
      <MemoryRouter initialEntries={['/carro']}>
        <Routes>
          <Route path="/carro" element={<CarPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Meu Carro')).toBeInTheDocument()
    })

    // Deve respeitar a PU-3 e as specs recuperadas do localStorage
    expect(screen.getByText('PU-3')).toBeInTheDocument()
  })

  it('BC01-06: Suporte bidirecional para /car e /carro no App Router', async () => {
    // Renderiza a estrutura completa do App simulando a rota /carro
    // mock window.history
    window.history.pushState({}, 'Carro Page', '/carro')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Meu Carro')).toBeInTheDocument()
    })
  })
})
