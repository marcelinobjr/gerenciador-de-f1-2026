import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import WeekendV2Page from '@/pages/WeekendV2Page'
import { canonicalEventRegistrationService } from '@/services/canonicalEventRegistrationService'
import { RookieTl1PlanningService } from '@/services/rookieTl1PlanningService'
import { RookiePracticeRequirementService } from '@/services/rookiePracticeRequirementService'
import { f1Service } from '@/services/f1Service'
import * as useToastModule from '@/hooks/use-toast'
import type { EventRegistrationSnapshot } from '@/services/canonicalEventRegistrationService'

/**
 * SUÍTE bug-render-corrida-01:
 * - (R1) Carregar /corrida com plano de rookie pendente de revisão → página monta, toast aparece após o render, uma única vez.
 * - (R2) Recarregar com plano já avisado → sem toast duplicado.
 * - (R3) Nenhuma emissão de toast durante render (provar via teste que simula o carregamento).
 * - (R4) Regressão: bug-tl1-release-lock-01 (T1–T4), weekend-reset (4/4), sq1-result-integrity.
 */

const mockUser = {
  id: 'usr_test',
  email: 'manager@audi.com',
  name: 'Test Manager',
}

const mockTeam = {
  id: 'team_audi',
  team_key: 'audi',
  name: 'Audi F1 Team',
  color: '#E10600',
  budget: 150000000,
  cost_cap_spent: 80000000,
  engine_supplier: 'Audi',
  strength: 86,
}

const mockSeason = {
  id: 'season_2026',
  year: 2026,
  current_round: 1,
  total_rounds: 24,
}

const mockPlayerDrivers = [
  {
    id: 'drv_human_1',
    name: 'Gabriel Bortoleto',
    number: 5,
    team_id: 'team_audi',
    role: 'titular',
    speed: 84,
    consistency: 82,
    defense: 80,
  },
  {
    id: 'drv_human_2',
    name: 'Nico Hülkenberg',
    number: 27,
    team_id: 'team_audi',
    role: 'titular',
    speed: 82,
    consistency: 81,
    defense: 78,
  },
]

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    team: mockTeam,
    season: mockSeason,
    isLoading: false,
    careerPhase: 'career',
    refreshTeamAndSeason: vi.fn(),
    resetGame: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    ensureValidSession: vi.fn().mockResolvedValue(true),
  }),
}))

vi.mock('@/hooks/use-unified-season', () => ({
  useUnifiedSeason: () => ({
    season: mockSeason,
    team: mockTeam,
    playerDrivers: mockPlayerDrivers,
    raceResults: [],
    standings: { driverStandings: [], constructorStandings: [] },
    driverStandings: [],
    constructorStandings: [],
    currentRound: 1,
    totalRounds: 24,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}))

function setupCanonicalSnapshot() {
  const entries: any[] = [
    {
      teamId: 'team_audi',
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
      isPlayerTeam: true,
      carId: 'car1',
      seatNumber: 1,
      driverId: 'drv_human_1',
      driverName: 'Gabriel Bortoleto',
      driverNumber: 5,
      eventRole: 'titular',
      originalRole: 'titular',
      licenseStatus: 'nivel_a',
      isSuperLicenseValid: true,
    },
    {
      teamId: 'team_audi',
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
      isPlayerTeam: true,
      carId: 'car2',
      seatNumber: 2,
      driverId: 'drv_human_2',
      driverName: 'Nico Hülkenberg',
      driverNumber: 27,
      eventRole: 'titular',
      originalRole: 'titular',
      licenseStatus: 'nivel_a',
      isSuperLicenseValid: true,
    },
  ]

  for (let i = 3; i <= 24; i++) {
    const rivalTeamId = `team_rival_${Math.floor((i - 1) / 2)}`
    entries.push({
      teamId: rivalTeamId,
      teamName: `Rival Team ${Math.floor((i - 1) / 2)}`,
      teamColor: '#3B82F6',
      isPlayerTeam: false,
      carId: i % 2 === 1 ? 'car1' : 'car2',
      seatNumber: i % 2 === 1 ? 1 : 2,
      driverId: `drv_rival_${i}`,
      driverName: `Rival Driver ${i}`,
      driverNumber: i + 10,
      eventRole: 'titular',
      originalRole: 'titular',
      licenseStatus: 'nivel_a',
      isSuperLicenseValid: true,
    })
  }

  const snapshot: EventRegistrationSnapshot = {
    seasonId: mockSeason.id,
    round: 1,
    gpName: 'Grande Prêmio do Bahrein',
    registeredAt: new Date().toISOString(),
    totalTeams: 12,
    totalEntries: 24,
    entries,
    entriesByCar: {
      playerCar1: entries[0],
      playerCar2: entries[1],
    },
  }

  canonicalEventRegistrationService.saveRegistrationSnapshot(snapshot)
}

describe('SUÍTE bug-render-corrida-01: Isolamento de Toast do Render da WeekendV2Page', () => {
  let mockToastFn: any

  beforeEach(() => {
    localStorage.clear()
    setupCanonicalSnapshot()
    mockToastFn = vi.fn()
    vi.spyOn(useToastModule, 'useToast').mockReturnValue({
      toast: mockToastFn,
      toasts: [],
      dismiss: vi.fn(),
    })

    // Mock do getMarketDrivers
    vi.spyOn(f1Service, 'getMarketDrivers').mockResolvedValue([
      {
        id: 'drv_ineligible_rookie',
        name: 'Novato Inelegível',
        speed: 70,
        consistency: 70,
        defense: 70,
        is_academy: false,
      } as any,
    ])
  })

  it('(R1) Carregar /corrida com plano de rookie pendente de revisão → página monta, toast aparece após o render, uma única vez', async () => {
    // Configurar plano de rookie que falhará na validação (piloto com mais de 2 GPs ou não elegível)
    const careerId = 'career_default'
    RookiePracticeRequirementService.clearTemporaryFP1Assignment(
      mockSeason.id,
      1,
      mockTeam.id,
      'car1',
    )

    RookieTl1PlanningService.savePlans(careerId, mockSeason.id, mockTeam.id, [
      {
        seasonId: mockSeason.id,
        teamId: mockTeam.id,
        round: 1,
        carId: 'car1',
        driverId: 'drv_ineligible_rookie',
        driverName: 'Novato Inelegível',
        status: 'PLANNED',
        createdAt: new Date().toISOString(),
      } as any,
    ])

    // Forçar mock de elegibilidade retornando falso
    vi.spyOn(RookiePracticeRequirementService, 'checkDriverEligibility').mockReturnValue({
      isEligible: false,
      reason: '3 GPs disputados — limite rookie: 2.',
      careerGPs: 3,
    } as any)

    // Renderizar página
    render(
      <MemoryRouter initialEntries={['/corrida']}>
        <WeekendV2Page />
      </MemoryRouter>,
    )

    // A página DEVE montar (conteúdo do weekend schedule ou sessões visível)
    expect(screen.getByText(/FIA FORMULA 1 WORLD CHAMPIONSHIP/i)).toBeInTheDocument()

    // O toast deve ser disparado via useEffect após o render
    await waitFor(() => {
      expect(mockToastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: expect.stringContaining('PLANEJAMENTO DE ROOKIE PRECISA DE REVISÃO (Carro 1)'),
        }),
      )
    })

    // Disparado uma única vez
    const callsMatching = mockToastFn.mock.calls.filter((callArgs: any[]) =>
      callArgs[0]?.title?.includes('PLANEJAMENTO DE ROOKIE PRECISA DE REVISÃO (Carro 1)'),
    )
    expect(callsMatching.length).toBe(1)
  })

  it('(R2) Recarregar com plano já avisado → sem toast duplicado', async () => {
    const careerId = 'career_default'
    RookiePracticeRequirementService.clearTemporaryFP1Assignment(
      mockSeason.id,
      1,
      mockTeam.id,
      'car1',
    )

    RookieTl1PlanningService.savePlans(careerId, mockSeason.id, mockTeam.id, [
      {
        seasonId: mockSeason.id,
        teamId: mockTeam.id,
        round: 1,
        carId: 'car1',
        driverId: 'drv_ineligible_rookie',
        driverName: 'Novato Inelegível',
        status: 'NEEDS_REVIEW',
        reviewReason: '3 GPs disputados — limite rookie: 2.',
        createdAt: new Date().toISOString(),
      } as any,
    ])

    vi.spyOn(RookiePracticeRequirementService, 'checkDriverEligibility').mockReturnValue({
      isEligible: false,
      reason: '3 GPs disputados — limite rookie: 2.',
      careerGPs: 3,
    } as any)

    const { rerender } = render(
      <MemoryRouter initialEntries={['/corrida']}>
        <WeekendV2Page />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mockToastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: expect.stringContaining('PLANEJAMENTO DE ROOKIE PRECISA DE REVISÃO (Carro 1)'),
        }),
      )
    })

    const initialCallCount = mockToastFn.mock.calls.filter((callArgs: any[]) =>
      callArgs[0]?.title?.includes('PLANEJAMENTO DE ROOKIE PRECISA DE REVISÃO (Carro 1)'),
    ).length
    expect(initialCallCount).toBe(1)

    // Simular re-render da página (atualização de props/estado)
    rerender(
      <MemoryRouter initialEntries={['/corrida']}>
        <WeekendV2Page />
      </MemoryRouter>,
    )

    // Aguardar ciclo seguinte
    await new Promise((r) => setTimeout(r, 50))

    const reCallCount = mockToastFn.mock.calls.filter((callArgs: any[]) =>
      callArgs[0]?.title?.includes('PLANEJAMENTO DE ROOKIE PRECISA DE REVISÃO (Carro 1)'),
    ).length
    expect(reCallCount).toBe(1)
  })

  it('(R3) Nenhuma emissão de toast síncrona durante o render imediato do componente', () => {
    let toastCalledDuringRender = false
    let isInsideRender = true

    mockToastFn.mockImplementation(() => {
      if (isInsideRender) {
        toastCalledDuringRender = true
      }
    })

    render(
      <MemoryRouter initialEntries={['/corrida']}>
        <WeekendV2Page />
      </MemoryRouter>,
    )

    isInsideRender = false

    // Durante o primeiro frame de render síncrono, toast() NÃO pode ter sido chamado!
    expect(toastCalledDuringRender).toBe(false)
  })
})
