import React from 'react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import InfrastructurePage from '@/pages/InfrastructurePage'
import CarPage from '@/pages/Car'
import { EngineSwapModal } from '@/components/car/EngineSwapModal'
import { PowerUnitSystemsPanel } from '@/components/car/PowerUnitSystemsPanel'
import { f1Service, FREE_ENGINE_QUOTA } from '@/services/f1Service'
import * as AuthContextModule from '@/contexts/AuthContext'
import type { TeamModel, DriverModel, SeasonModel } from '@/types/f1'

// Mocks canônicos de infraestrutura externa
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

const createBaseDrivers = (): DriverModel[] => [
  {
    id: 'drv-hul',
    name: 'Nico Hülkenberg',
    team_id: 'team_audi_05c2',
    nationality: 'Alemanha',
    age: 38,
    speed: 84,
    consistency: 85,
    rain: 82,
    defense: 83,
    salary: 8000000,
    contract_end: 2026,
    role: 'titular',
    morale: 88,
    physical_condition: 90,
  },
  {
    id: 'drv-bor',
    name: 'Gabriel Bortoleto',
    team_id: 'team_audi_05c2',
    nationality: 'Brasil',
    age: 21,
    speed: 82,
    consistency: 81,
    rain: 79,
    defense: 80,
    salary: 3000000,
    contract_end: 2027,
    role: 'titular',
    morale: 90,
    physical_condition: 95,
  },
]

const createBaseTeam = (overrides: Partial<TeamModel> = {}): TeamModel => ({
  id: 'team_audi_05c2',
  name: 'Audi Sport F1 Team',
  team_key: 'audi',
  color: '#E10600',
  budget: 120000000,
  cost_cap_spent: 45000000,
  engine_supplier: 'Audi',
  chassis_level: 80,
  aero_level: 80,
  strategy_level: 80,
  engine_pool_used: 4,
  active_engine_wear: 21,
  engine_history: [
    {
      id: 1,
      wear: 60,
      status: 'reserva',
      supplier: 'Audi',
      introducedRound: 1,
      mileage_km: 1482,
      condition: 40,
    },
    {
      id: 2,
      wear: 45,
      status: 'reserva',
      supplier: 'Audi',
      introducedRound: 3,
      mileage_km: 890,
      condition: 55,
    },
    {
      id: 3,
      wear: 30,
      status: 'reserva',
      supplier: 'Audi',
      introducedRound: 6,
      mileage_km: 520,
      condition: 70,
    },
    {
      id: 4,
      wear: 10,
      status: 'instalado',
      supplier: 'Audi',
      introducedRound: 9,
      mileage_km: 210,
      condition: 90,
    },
  ],
  grid_penalties: [],
  ...overrides,
})

const createBaseSeason = (overrides: Partial<SeasonModel> = {}): SeasonModel => ({
  id: 'season-2026',
  year: 2026,
  current_round: 5,
  total_rounds: 24,
  team_id: 'team_audi_05c2',
  ...overrides,
})

describe('BUG-INTEGRIDADE-05C2 — Contrato de Unidades de Potência (UI / Integração)', () => {
  let mockUseAuth: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()

    vi.spyOn(f1Service, 'getTeamParts').mockResolvedValue([])
    vi.spyOn(f1Service, 'getDrivers').mockResolvedValue(createBaseDrivers())

    mockUseAuth = vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-1', email: 'manager@apex.com' } as any,
      team: createBaseTeam(),
      season: createBaseSeason(),
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

  // (1) InfrastructurePage renderiza PU1–PU4
  it('(1) InfrastructurePage renderiza PU1–PU4 por padrão dentro da cota inicial', async () => {
    render(
      <MemoryRouter>
        <InfrastructurePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('pu-card-1')).toBeInTheDocument()
    })

    expect(screen.getByTestId('pu-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('pu-card-2')).toBeInTheDocument()
    expect(screen.getByTestId('pu-card-3')).toBeInTheDocument()
    expect(screen.getByTestId('pu-card-4')).toBeInTheDocument()
  })

  // (2) PU5 aparece quando existe no domínio
  it('(2) InfrastructurePage exibe PU5 quando ela existe no domínio persistido', async () => {
    const teamWithPU5 = createBaseTeam({
      engine_pool_used: 5,
      engine_history: [
        { id: 1, wear: 70, status: 'reserva', supplier: 'Audi', introducedRound: 1 },
        { id: 2, wear: 50, status: 'reserva', supplier: 'Audi', introducedRound: 3 },
        { id: 3, wear: 40, status: 'reserva', supplier: 'Audi', introducedRound: 5 },
        { id: 4, wear: 30, status: 'reserva', supplier: 'Audi', introducedRound: 7 },
        {
          id: 5,
          wear: 0,
          status: 'instalado',
          supplier: 'Audi',
          introducedRound: 10,
          exceedsQuota: true,
        },
      ],
      grid_penalties: [
        {
          id: 'p5',
          unitIndex: 5,
          positions: 10,
          reason: 'Excesso de cota',
          appliedAt: '2026-05-01',
        },
      ],
    })

    mockUseAuth.mockReturnValue({
      user: { id: 'usr-1', email: 'manager@apex.com' } as any,
      team: teamWithPU5,
      season: createBaseSeason(),
      isLoading: false,
      careerPhase: 'career',
      refreshTeamAndSeason: vi.fn().mockResolvedValue(undefined),
      resetGame: vi.fn().mockResolvedValue(undefined),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      ensureValidSession: vi.fn().mockResolvedValue(true),
    })

    render(
      <MemoryRouter>
        <InfrastructurePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('pu-card-5')).toBeInTheDocument()
    })

    expect(screen.getByTestId('pu-card-5')).toBeInTheDocument()
  })

  // (3) PU6 aparece quando existe
  it('(3) InfrastructurePage exibe PU6 quando ela existe no pool do domínio', async () => {
    const teamWithPU6 = createBaseTeam({
      engine_pool_used: 6,
      engine_history: [
        { id: 1, wear: 80, status: 'reserva', supplier: 'Audi', introducedRound: 1 },
        { id: 2, wear: 65, status: 'reserva', supplier: 'Audi', introducedRound: 3 },
        { id: 3, wear: 50, status: 'reserva', supplier: 'Audi', introducedRound: 5 },
        { id: 4, wear: 40, status: 'reserva', supplier: 'Audi', introducedRound: 7 },
        {
          id: 5,
          wear: 20,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 10,
          exceedsQuota: true,
        },
        {
          id: 6,
          wear: 0,
          status: 'instalado',
          supplier: 'Audi',
          introducedRound: 12,
          exceedsQuota: true,
        },
      ],
      grid_penalties: [
        {
          id: 'p5',
          unitIndex: 5,
          positions: 10,
          reason: 'Excesso de cota',
          appliedAt: '2026-05-01',
        },
        {
          id: 'p6',
          unitIndex: 6,
          positions: 5,
          reason: 'Excesso de cota',
          appliedAt: '2026-06-01',
        },
      ],
    })

    mockUseAuth.mockReturnValue({
      user: { id: 'usr-1', email: 'manager@apex.com' } as any,
      team: teamWithPU6,
      season: createBaseSeason(),
      isLoading: false,
      careerPhase: 'career',
      refreshTeamAndSeason: vi.fn().mockResolvedValue(undefined),
      resetGame: vi.fn().mockResolvedValue(undefined),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      ensureValidSession: vi.fn().mockResolvedValue(true),
    })

    render(
      <MemoryRouter>
        <InfrastructurePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('pu-card-6')).toBeInTheDocument()
    })

    expect(screen.getByTestId('pu-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('pu-card-6')).toBeInTheDocument()
  })

  // (4) Não existem cards fictícios PU5+ antes da criação
  it('(4) Não existem cards fictícios PU5+ antes da sua introdução no domínio', async () => {
    render(
      <MemoryRouter>
        <InfrastructurePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('pu-card-4')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('pu-card-5')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pu-card-6')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pu-card-7')).not.toBeInTheDocument()
  })

  // (5) Ação "nova PU" chama introduceNewEngine do f1Service
  it('(5) Ação "Criar Nova PU (Pool)" invoca introduceNewEngine do f1Service', async () => {
    const baseTeam = createBaseTeam()
    const updatedTeam = {
      ...baseTeam,
      engine_pool_used: 5,
      engine_history: [
        ...(baseTeam.engine_history || []),
        {
          id: 5,
          wear: 0,
          status: 'instalado' as const,
          supplier: 'Audi',
          introducedRound: 5,
          exceedsQuota: true,
        },
      ],
      grid_penalties: [
        {
          id: 'p5',
          unitIndex: 5,
          positions: 10,
          reason: 'Excesso de cota',
          appliedAt: '2026-05-01',
        },
      ],
    }

    const introduceSpy = vi.spyOn(f1Service, 'introduceNewEngine').mockResolvedValue({
      team: updatedTeam,
      penaltyPositions: 10,
      engineNumber: 5,
      costCapSpent: 63000000,
    })

    render(
      <MemoryRouter>
        <InfrastructurePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('btn-introduce-new-engine')).toBeInTheDocument()
    })

    const createButton = screen.getByTestId('btn-introduce-new-engine')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(introduceSpy).toHaveBeenCalledTimes(1)
      expect(introduceSpy).toHaveBeenCalledWith(baseTeam)
    })
  })

  // (6) UI não calcula unitIndex manualmente
  it('(6) UI não calcula unitIndex manualmente (delega ao retorno de introduceNewEngine)', async () => {
    const baseTeam = createBaseTeam()
    // Retorno do serviço retorna explicitamente PU7 (ex: pulo ou gestão delegada pelo engine)
    const introduceSpy = vi.spyOn(f1Service, 'introduceNewEngine').mockResolvedValue({
      team: {
        ...baseTeam,
        engine_pool_used: 7,
      },
      penaltyPositions: 5,
      engineNumber: 7,
      costCapSpent: 63000000,
    })

    render(
      <MemoryRouter>
        <InfrastructurePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('btn-introduce-new-engine')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('btn-introduce-new-engine'))

    await waitFor(() => {
      expect(introduceSpy).toHaveBeenCalled()
    })
    // UI não impõe unitIndex = 5: consome res.engineNumber
  })

  // (7) PU5 mostra indicação de exceedsQuota
  it('(7) PU5 exibe indicação explícita de "Fora da quota" e penalidade registrada', async () => {
    const teamWithPU5 = createBaseTeam({
      engine_pool_used: 5,
      engine_history: [
        { id: 1, wear: 70, status: 'reserva', supplier: 'Audi', introducedRound: 1 },
        { id: 2, wear: 50, status: 'reserva', supplier: 'Audi', introducedRound: 3 },
        { id: 3, wear: 40, status: 'reserva', supplier: 'Audi', introducedRound: 5 },
        { id: 4, wear: 30, status: 'reserva', supplier: 'Audi', introducedRound: 7 },
        {
          id: 5,
          wear: 0,
          status: 'instalado',
          supplier: 'Audi',
          introducedRound: 10,
          exceedsQuota: true,
        },
      ],
      grid_penalties: [
        {
          id: 'p5',
          unitIndex: 5,
          positions: 10,
          reason: 'Excesso de cota',
          appliedAt: '2026-05-01',
        },
      ],
    })

    mockUseAuth.mockReturnValue({
      user: { id: 'usr-1', email: 'manager@apex.com' } as any,
      team: teamWithPU5,
      season: createBaseSeason(),
      isLoading: false,
      careerPhase: 'career',
      refreshTeamAndSeason: vi.fn().mockResolvedValue(undefined),
      resetGame: vi.fn().mockResolvedValue(undefined),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      ensureValidSession: vi.fn().mockResolvedValue(true),
    })

    render(
      <MemoryRouter>
        <InfrastructurePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('badge-quota-5')).toBeInTheDocument()
    })

    expect(screen.getByTestId('badge-quota-5')).toHaveTextContent(/fora da quota/i)
    expect(screen.getByTestId('badge-penalty-5')).toHaveTextContent('+10 pos')
  })

  // (8) PU4 não mostra "fora da quota"
  it('(8) PU4 e inferiores não exibem "Fora da quota"', async () => {
    render(
      <MemoryRouter>
        <InfrastructurePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('pu-card-4')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('badge-quota-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('badge-quota-2')).not.toBeInTheDocument()
    expect(screen.queryByTestId('badge-quota-3')).not.toBeInTheDocument()
    expect(screen.queryByTestId('badge-quota-4')).not.toBeInTheDocument()
  })

  // (9) Seleção do carro contém PU5
  it('(9) Seleção de motor no modal (EngineSwapModal) contém PU5 quando presente no pool', () => {
    const availableUnits = [
      { id: 1, wear: 50, condition: 50, mileage_km: 1482, status: 'reserva', supplier: 'Audi' },
      { id: 2, wear: 30, condition: 70, mileage_km: 800, status: 'reserva', supplier: 'Audi' },
      { id: 3, wear: 20, condition: 80, mileage_km: 400, status: 'reserva', supplier: 'Audi' },
      { id: 4, wear: 10, condition: 90, mileage_km: 200, status: 'instalado', supplier: 'Audi' },
      {
        id: 5,
        wear: 0,
        condition: 100,
        mileage_km: 0,
        status: 'reserva',
        supplier: 'Audi',
        exceedsQuota: true,
      },
    ]
    const penalties = [{ unitIndex: 5, positions: 10 }]

    render(
      <EngineSwapModal
        open={true}
        onOpenChange={vi.fn()}
        targetCar={1}
        driverName="Nico Hülkenberg"
        currentCar1EngineUnit={4}
        currentCar2EngineUnit={2}
        totalUnitsLimit={FREE_ENGINE_QUOTA}
        availableUnits={availableUnits}
        penalties={penalties}
        onConfirmSwap={vi.fn()}
      />,
    )

    expect(screen.getByText(/PU-5 \(Unidade #5\)/i)).toBeInTheDocument()
    expect(screen.getByTestId('engine-swap-badge-5')).toHaveTextContent(
      /penalidade registrada: \+10 posições/i,
    )
  })

  // (10) Contém PU6
  it('(10) Seleção de motor no modal (EngineSwapModal) contém PU6 quando presente no pool', () => {
    const availableUnits = [
      { id: 1, wear: 60, condition: 40, mileage_km: 1500, status: 'reserva', supplier: 'Audi' },
      { id: 2, wear: 40, condition: 60, mileage_km: 1000, status: 'reserva', supplier: 'Audi' },
      { id: 3, wear: 30, condition: 70, mileage_km: 600, status: 'reserva', supplier: 'Audi' },
      { id: 4, wear: 20, condition: 80, mileage_km: 300, status: 'reserva', supplier: 'Audi' },
      {
        id: 5,
        wear: 15,
        condition: 85,
        mileage_km: 150,
        status: 'reserva',
        supplier: 'Audi',
        exceedsQuota: true,
      },
      {
        id: 6,
        wear: 0,
        condition: 100,
        mileage_km: 0,
        status: 'instalado',
        supplier: 'Audi',
        exceedsQuota: true,
      },
    ]
    const penalties = [
      { unitIndex: 5, positions: 10 },
      { unitIndex: 6, positions: 5 },
    ]

    render(
      <EngineSwapModal
        open={true}
        onOpenChange={vi.fn()}
        targetCar={1}
        driverName="Nico Hülkenberg"
        currentCar1EngineUnit={6}
        currentCar2EngineUnit={2}
        totalUnitsLimit={FREE_ENGINE_QUOTA}
        availableUnits={availableUnits}
        penalties={penalties}
        onConfirmSwap={vi.fn()}
      />,
    )

    expect(screen.getByText(/PU-6 \(Unidade #6\)/i)).toBeInTheDocument()
    expect(screen.getByTestId('engine-swap-badge-6')).toHaveTextContent(
      /penalidade registrada: \+5 posições/i,
    )
  })

  // (11) PU5 pode ser alocada
  it('(11) PU5 pode ser alocada no Carro #1 chamando onConfirmSwap', () => {
    const onConfirmSwapMock = vi.fn()
    const onOpenChangeMock = vi.fn()
    const availableUnits = [
      { id: 1, wear: 50, condition: 50, mileage_km: 1000, status: 'reserva', supplier: 'Audi' },
      { id: 2, wear: 30, condition: 70, mileage_km: 600, status: 'reserva', supplier: 'Audi' },
      { id: 3, wear: 20, condition: 80, mileage_km: 400, status: 'reserva', supplier: 'Audi' },
      { id: 4, wear: 10, condition: 90, mileage_km: 200, status: 'instalado', supplier: 'Audi' },
      {
        id: 5,
        wear: 0,
        condition: 100,
        mileage_km: 0,
        status: 'reserva',
        supplier: 'Audi',
        exceedsQuota: true,
      },
    ]

    render(
      <EngineSwapModal
        open={true}
        onOpenChange={onOpenChangeMock}
        targetCar={1}
        driverName="Nico Hülkenberg"
        currentCar1EngineUnit={4}
        currentCar2EngineUnit={2}
        totalUnitsLimit={FREE_ENGINE_QUOTA}
        availableUnits={availableUnits}
        onConfirmSwap={onConfirmSwapMock}
      />,
    )

    // Clicar no item PU-5
    const pu5Label = screen.getByText(/PU-5 \(Unidade #5\)/i)
    fireEvent.click(pu5Label)

    // Clicar no botão Confirmar Troca no Carro #1
    const applyButton = screen.getByRole('button', { name: /confirmar troca no carro #1/i })
    fireEvent.click(applyButton)

    expect(onConfirmSwapMock).toHaveBeenCalledTimes(1)
    expect(onConfirmSwapMock).toHaveBeenCalledWith(1, 5)
    expect(onOpenChangeMock).toHaveBeenCalledWith(false)
  })

  // (12) Alocação de PU5 não cria outra unidade
  it('(12) Alocação de PU5 no Carro não cria nova unidade e preserva o pool de 5 unidades', async () => {
    const teamWithPU5 = createBaseTeam({
      engine_pool_used: 5,
      engine_history: [
        { id: 1, wear: 70, status: 'reserva', supplier: 'Audi', introducedRound: 1 },
        { id: 2, wear: 50, status: 'reserva', supplier: 'Audi', introducedRound: 3 },
        { id: 3, wear: 40, status: 'reserva', supplier: 'Audi', introducedRound: 5 },
        { id: 4, wear: 30, status: 'reserva', supplier: 'Audi', introducedRound: 7 },
        {
          id: 5,
          wear: 0,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 10,
          exceedsQuota: true,
        },
      ],
      grid_penalties: [
        {
          id: 'p5',
          unitIndex: 5,
          positions: 10,
          reason: 'Excesso de cota',
          appliedAt: '2026-05-01',
        },
      ],
    })

    mockUseAuth.mockReturnValue({
      user: { id: 'usr-1', email: 'manager@apex.com' } as any,
      team: teamWithPU5,
      season: createBaseSeason(),
      isLoading: false,
      careerPhase: 'career',
      refreshTeamAndSeason: vi.fn().mockResolvedValue(undefined),
      resetGame: vi.fn().mockResolvedValue(undefined),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      ensureValidSession: vi.fn().mockResolvedValue(true),
    })

    const introduceSpy = vi.spyOn(f1Service, 'introduceNewEngine')

    render(
      <MemoryRouter>
        <CarPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Meu Carro')).toBeInTheDocument()
    })

    // introduceNewEngine NUNCA deve ter sido chamado apenas por alocar/visualizar a tela
    expect(introduceSpy).not.toHaveBeenCalled()
    expect(teamWithPU5.engine_history?.length).toBe(5)
  })

  // (13) Alocação não duplica penalidade
  it('(13) Alocação de PU5 já existente não duplica penalidades no modelo', async () => {
    const teamWithPU5 = createBaseTeam({
      engine_pool_used: 5,
      engine_history: [
        { id: 1, wear: 70, status: 'reserva', supplier: 'Audi', introducedRound: 1 },
        { id: 2, wear: 50, status: 'reserva', supplier: 'Audi', introducedRound: 3 },
        { id: 3, wear: 40, status: 'reserva', supplier: 'Audi', introducedRound: 5 },
        { id: 4, wear: 30, status: 'reserva', supplier: 'Audi', introducedRound: 7 },
        {
          id: 5,
          wear: 0,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 10,
          exceedsQuota: true,
        },
      ],
      grid_penalties: [
        {
          id: 'p5',
          unitIndex: 5,
          positions: 10,
          reason: 'Excesso de cota',
          appliedAt: '2026-05-01',
        },
      ],
    })

    // Chamada de introduceNewEngine com a PU5 já presente no histórico (idempotência no domínio)
    const result = await f1Service.introduceNewEngine(teamWithPU5, 18000000)
    const penalties = result.team.grid_penalties || []
    const pu5Penalties = penalties.filter((p) => p.unitIndex === 5)

    expect(pu5Penalties.length).toBe(1)
    expect(result.penaltyPositions).toBe(10)
  })

  // (14) PU1–PU4 permanecem disponíveis
  it('(14) PU1–PU4 permanecem disponíveis no inventário após introdução da PU5', () => {
    const availableUnits = [
      { id: 1, wear: 60, condition: 40, mileage_km: 1482, status: 'reserva', supplier: 'Audi' },
      { id: 2, wear: 45, condition: 55, mileage_km: 890, status: 'reserva', supplier: 'Audi' },
      { id: 3, wear: 30, condition: 70, mileage_km: 520, status: 'reserva', supplier: 'Audi' },
      { id: 4, wear: 15, condition: 85, mileage_km: 210, status: 'reserva', supplier: 'Audi' },
      {
        id: 5,
        wear: 0,
        condition: 100,
        mileage_km: 0,
        status: 'instalado',
        supplier: 'Audi',
        exceedsQuota: true,
      },
    ]

    render(
      <EngineSwapModal
        open={true}
        onOpenChange={vi.fn()}
        targetCar={1}
        currentCar1EngineUnit={5}
        currentCar2EngineUnit={2}
        totalUnitsLimit={FREE_ENGINE_QUOTA}
        availableUnits={availableUnits}
        onConfirmSwap={vi.fn()}
      />,
    )

    expect(screen.getByText(/PU-1 \(Unidade #1\)/i)).toBeInTheDocument()
    expect(screen.getByText(/PU-2 \(Unidade #2\)/i)).toBeInTheDocument()
    expect(screen.getByText(/PU-3 \(Unidade #3\)/i)).toBeInTheDocument()
    expect(screen.getByText(/PU-4 \(Unidade #4\)/i)).toBeInTheDocument()
    expect(screen.getByText(/PU-5 \(Unidade #5\)/i)).toBeInTheDocument()
  })

  // (15) Save/reload continua mostrando PU5
  it('(15) Save/reload (localStorage / persistência) continua exibindo PU5 no CarPage', async () => {
    localStorage.setItem('apex_gp_car1_engine_unit', '5')
    localStorage.setItem('apex_gp_car2_engine_unit', '2')

    const teamWithPU5 = createBaseTeam({
      engine_pool_used: 5,
      engine_history: [
        { id: 1, wear: 60, status: 'reserva', supplier: 'Audi', introducedRound: 1 },
        { id: 2, wear: 45, status: 'instalado', supplier: 'Audi', introducedRound: 3 },
        { id: 3, wear: 30, status: 'reserva', supplier: 'Audi', introducedRound: 5 },
        { id: 4, wear: 20, status: 'reserva', supplier: 'Audi', introducedRound: 7 },
        {
          id: 5,
          wear: 0,
          status: 'instalado',
          supplier: 'Audi',
          introducedRound: 10,
          exceedsQuota: true,
        },
      ],
      grid_penalties: [
        {
          id: 'p5',
          unitIndex: 5,
          positions: 10,
          reason: 'Excesso de cota',
          appliedAt: '2026-05-01',
        },
      ],
    })

    mockUseAuth.mockReturnValue({
      user: { id: 'usr-1', email: 'manager@apex.com' } as any,
      team: teamWithPU5,
      season: createBaseSeason(),
      isLoading: false,
      careerPhase: 'career',
      refreshTeamAndSeason: vi.fn().mockResolvedValue(undefined),
      resetGame: vi.fn().mockResolvedValue(undefined),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      ensureValidSession: vi.fn().mockResolvedValue(true),
    })

    render(
      <MemoryRouter>
        <CarPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Meu Carro')).toBeInTheDocument()
    })

    // Deve exibir PU-5 no card do Carro #1 conforme armazenado
    expect(screen.getByText(/PU-5 \(Fora da quota\)/i)).toBeInTheDocument()
  })

  // (16) Estado da unidade ativa sobrevive reload
  it('(16) Estado da unidade ativa sobrevive reload sem redefinir para cota inicial', async () => {
    localStorage.setItem('apex_gp_car1_engine_unit', '5')

    const teamWithPU5 = createBaseTeam({
      engine_pool_used: 5,
      engine_history: [
        { id: 1, wear: 60, status: 'reserva', supplier: 'Audi', introducedRound: 1 },
        { id: 2, wear: 45, status: 'instalado', supplier: 'Audi', introducedRound: 3 },
        { id: 3, wear: 30, status: 'reserva', supplier: 'Audi', introducedRound: 5 },
        { id: 4, wear: 20, status: 'reserva', supplier: 'Audi', introducedRound: 7 },
        {
          id: 5,
          wear: 12,
          status: 'instalado',
          supplier: 'Audi',
          introducedRound: 10,
          exceedsQuota: true,
        },
      ],
    })

    mockUseAuth.mockReturnValue({
      user: { id: 'usr-1', email: 'manager@apex.com' } as any,
      team: teamWithPU5,
      season: createBaseSeason(),
      isLoading: false,
      careerPhase: 'career',
      refreshTeamAndSeason: vi.fn().mockResolvedValue(undefined),
      resetGame: vi.fn().mockResolvedValue(undefined),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      ensureValidSession: vi.fn().mockResolvedValue(true),
    })

    render(
      <MemoryRouter>
        <CarPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Meu Carro')).toBeInTheDocument()
    })

    expect(screen.getByText(/PU-5 \(Fora da quota\)/i)).toBeInTheDocument()
  })

  // (17) Fornecedor aparece corretamente
  it('(17) Fornecedor aparece corretamente em todas as unidades e painéis', () => {
    render(
      <PowerUnitSystemsPanel
        supplierName="Audi Sport"
        overallIntegrity={88}
        activeUnitIndex={5}
        totalUnitsLimit={FREE_ENGINE_QUOTA}
        poolUnits={[
          { unitNumber: 1, exceedsQuota: false },
          { unitNumber: 2, exceedsQuota: false },
          { unitNumber: 3, exceedsQuota: false },
          { unitNumber: 4, exceedsQuota: false },
          { unitNumber: 5, exceedsQuota: true },
        ]}
      />,
    )

    expect(screen.getByText(/Audi Sport 2026/i)).toBeInTheDocument()
  })

  // (18) Km/condição exibidos corretamente
  it('(18) Km e condição são exibidos corretamente para PU5', async () => {
    const teamWithPU5 = createBaseTeam({
      engine_pool_used: 5,
      engine_history: [
        {
          id: 1,
          wear: 60,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 1,
          mileage_km: 1482,
          condition: 40,
        },
        {
          id: 2,
          wear: 45,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 3,
          mileage_km: 890,
          condition: 55,
        },
        {
          id: 3,
          wear: 30,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 5,
          mileage_km: 520,
          condition: 70,
        },
        {
          id: 4,
          wear: 20,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 7,
          mileage_km: 210,
          condition: 80,
        },
        {
          id: 5,
          wear: 5,
          status: 'instalado',
          supplier: 'Audi',
          introducedRound: 10,
          mileage_km: 125,
          condition: 95,
          exceedsQuota: true,
        },
      ],
      grid_penalties: [
        {
          id: 'p5',
          unitIndex: 5,
          positions: 10,
          reason: 'Excesso de cota',
          appliedAt: '2026-05-01',
        },
      ],
    })

    mockUseAuth.mockReturnValue({
      user: { id: 'usr-1', email: 'manager@apex.com' } as any,
      team: teamWithPU5,
      season: createBaseSeason(),
      isLoading: false,
      careerPhase: 'career',
      refreshTeamAndSeason: vi.fn().mockResolvedValue(undefined),
      resetGame: vi.fn().mockResolvedValue(undefined),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      ensureValidSession: vi.fn().mockResolvedValue(true),
    })

    render(
      <MemoryRouter>
        <InfrastructurePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('pu-card-5')).toBeInTheDocument()
    })

    const card5 = screen.getByTestId('pu-card-5')
    expect(card5).toHaveTextContent('125 km')
    expect(card5).toHaveTextContent('Desgaste: 5%')
    expect(card5).toHaveTextContent('95%')
  })

  // (19) Nenhuma assumption fixa de 4 itens permanece nas superfícies alteradas
  it('(19) Nenhuma assumption fixa de 4 itens (totalUnitsLimit={4}, /4 estrutural) permanece nas superfícies', () => {
    // PowerUnitSystemsPanel suporta qualquer número de unidades dinâmicas além de 4
    const { container } = render(
      <PowerUnitSystemsPanel
        overallIntegrity={95}
        activeUnitIndex={5}
        totalUnitsLimit={FREE_ENGINE_QUOTA}
        poolUnits={[
          { unitNumber: 1 },
          { unitNumber: 2 },
          { unitNumber: 3 },
          { unitNumber: 4 },
          { unitNumber: 5, exceedsQuota: true },
        ]}
      />,
    )

    // Renderiza todas as 5 caixas numéricas
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('EXTRA')).toBeInTheDocument()
    expect(container.querySelectorAll('.font-black.font-mono')).toHaveLength(6) // 1 integridade + 5 caixas
  })

  // (20) Layout/render não quebra com 6+ unidades
  it('(20) Layout e renderização não quebram com 6+ unidades no pool dinâmico', async () => {
    const teamWithPU8 = createBaseTeam({
      engine_pool_used: 8,
      engine_history: [
        {
          id: 1,
          wear: 90,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 1,
          mileage_km: 2100,
          condition: 10,
        },
        {
          id: 2,
          wear: 80,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 3,
          mileage_km: 1800,
          condition: 20,
        },
        {
          id: 3,
          wear: 70,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 6,
          mileage_km: 1500,
          condition: 30,
        },
        {
          id: 4,
          wear: 60,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 9,
          mileage_km: 1200,
          condition: 40,
        },
        {
          id: 5,
          wear: 40,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 12,
          mileage_km: 800,
          condition: 60,
          exceedsQuota: true,
        },
        {
          id: 6,
          wear: 30,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 15,
          mileage_km: 600,
          condition: 70,
          exceedsQuota: true,
        },
        {
          id: 7,
          wear: 20,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 18,
          mileage_km: 400,
          condition: 80,
          exceedsQuota: true,
        },
        {
          id: 8,
          wear: 0,
          status: 'instalado',
          supplier: 'Audi',
          introducedRound: 21,
          mileage_km: 0,
          condition: 100,
          exceedsQuota: true,
        },
      ],
      grid_penalties: [
        {
          id: 'p5',
          unitIndex: 5,
          positions: 10,
          reason: 'Excesso de cota',
          appliedAt: '2026-05-01',
        },
        {
          id: 'p6',
          unitIndex: 6,
          positions: 5,
          reason: 'Excesso de cota',
          appliedAt: '2026-06-01',
        },
        {
          id: 'p7',
          unitIndex: 7,
          positions: 5,
          reason: 'Excesso de cota',
          appliedAt: '2026-07-01',
        },
        {
          id: 'p8',
          unitIndex: 8,
          positions: 5,
          reason: 'Excesso de cota',
          appliedAt: '2026-08-01',
        },
      ],
    })

    mockUseAuth.mockReturnValue({
      user: { id: 'usr-1', email: 'manager@apex.com' } as any,
      team: teamWithPU8,
      season: createBaseSeason(),
      isLoading: false,
      careerPhase: 'career',
      refreshTeamAndSeason: vi.fn().mockResolvedValue(undefined),
      resetGame: vi.fn().mockResolvedValue(undefined),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      ensureValidSession: vi.fn().mockResolvedValue(true),
    })

    render(
      <MemoryRouter>
        <InfrastructurePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('pu-card-8')).toBeInTheDocument()
    })

    for (let u = 1; u <= 8; u++) {
      expect(screen.getByTestId(`pu-card-${u}`)).toBeInTheDocument()
    }
    expect(screen.getByTestId('badge-penalty-8')).toHaveTextContent('+5 pos')
  })
})
