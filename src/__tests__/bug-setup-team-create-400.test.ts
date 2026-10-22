import { describe, it, expect, vi, beforeEach } from 'vitest'
import { f1Service } from '@/services/f1Service'
import pb from '@/lib/pocketbase/client'
import { formatTeamCreationError } from '@/lib/pocketbase/errors'
import { ClientResponseError } from 'pocketbase'

describe('BUG-SETUP-TEAM-CREATE-400 — Team Selection & Career Creation Idempotency', () => {
  const mockUserId = 'jxe5h74yat69x3x'
  const mockExistingTeam = {
    id: 'nn7kruxy4qlvgwr',
    name: 'Audi F1 Team',
    user_id: mockUserId,
    team_key: 'audi',
    is_custom: false,
    strength: 86,
    budget: 165000000,
    engine_supplier: 'Audi',
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('formatTeamCreationError returns actionable message when user already has team', () => {
    const error = new ClientResponseError({
      status: 400,
      data: {},
      message: 'Failed to create record.',
    })

    const msg = formatTeamCreationError(error, true)
    expect(msg).toBe('Não foi possível criar a equipe — você já possui uma equipe nesta carreira.')
  })

  it('formatTeamCreationError handles PocketBase 400 with empty data gracefully', () => {
    const error = new ClientResponseError({
      status: 400,
      data: {},
      message: 'Failed to create record.',
    })

    const msg = formatTeamCreationError(error, false)
    expect(msg).toContain('já possui uma equipe nesta carreira ou houve conflito de dados')
  })

  it('initializeOfficialTeam reuses existing team if user already has one without calling pb.create', async () => {
    // Mock getPlayerTeam to return mockExistingTeam
    vi.spyOn(f1Service, 'getPlayerTeam').mockResolvedValue(mockExistingTeam as any)

    const createSpy = vi.fn()
    vi.spyOn(pb, 'collection').mockImplementation(
      (name: string) =>
        ({
          create: createSpy,
          getFirstListItem: vi.fn(),
          update: vi.fn(),
        }) as any,
    )

    const result = await f1Service.initializeOfficialTeam(mockUserId, 'audi', {
      name: 'Audi F1 Team',
      color: '#E10600',
      engine: 'Audi',
      strength: 86,
      carLevel: 5,
      budget: 165000000,
      driver1: {
        name: 'Nico Hulkenberg',
        nationality: 'Alemanha',
        age: 38,
        speed: 84,
        consistency: 85,
        rain: 82,
        defense: 83,
        salary: 10000000,
      },
      driver2: {
        name: 'Gabriel Bortoleto',
        nationality: 'Brasil',
        age: 21,
        speed: 82,
        consistency: 80,
        rain: 80,
        defense: 79,
        salary: 5000000,
      },
    })

    expect(result).toEqual(mockExistingTeam)
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('initializeCustomTeam reuses existing team if user already has one without calling pb.create', async () => {
    vi.spyOn(f1Service, 'getPlayerTeam').mockResolvedValue(mockExistingTeam as any)

    const createSpy = vi.fn()
    vi.spyOn(pb, 'collection').mockImplementation(
      (name: string) =>
        ({
          create: createSpy,
        }) as any,
    )

    const result = await f1Service.initializeCustomTeam(
      mockUserId,
      'Minha Escuderia',
      'Ferrari',
      '#FF0000',
    )

    expect(result).toEqual(mockExistingTeam)
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('initializeCareerWithConfig reuses existing team if user already has one without calling pb.create', async () => {
    vi.spyOn(f1Service, 'getPlayerTeam').mockResolvedValue(mockExistingTeam as any)

    const createSpy = vi.fn()
    vi.spyOn(pb, 'collection').mockImplementation(
      (name: string) =>
        ({
          create: createSpy,
        }) as any,
    )

    const mockWizardConfig: any = {
      manager: { name: 'Chefe', nationality: 'Brasil', age: 40 },
      managerProfile: { id: 'strategist', title: 'Estrategista' },
      universeType: 'championship_2026',
      playerTeam: { isCustom: false, teamKey: 'audi' },
      selectedTeams: [{ key: 'audi', name: 'Audi F1 Team', engine: 'Audi', strength: 86 }],
      careerSettings: {},
    }

    const result = await f1Service.initializeCareerWithConfig(mockUserId, mockWizardConfig)

    expect(result).toEqual(mockExistingTeam)
    expect(createSpy).not.toHaveBeenCalled()
  })
})
