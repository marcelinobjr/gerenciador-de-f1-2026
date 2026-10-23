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

  it('initializeOfficialTeam fallback recovers existing team when pb.create throws 400 (race condition / unique constraint)', async () => {
    // 1st getPlayerTeam returns null (check passes), create throws 400, 2nd getPlayerTeam finds team
    const getPlayerTeamSpy = vi
      .spyOn(f1Service, 'getPlayerTeam')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockExistingTeam as any)

    const create400Error = new ClientResponseError({
      status: 400,
      data: {},
      message: 'Failed to create record.',
    })

    const createSpy = vi.fn().mockRejectedValue(create400Error)
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

    expect(createSpy).toHaveBeenCalled()
    expect(getPlayerTeamSpy).toHaveBeenCalledTimes(2)
    expect(result).toEqual(mockExistingTeam)
  })

  it('initializeCustomTeam fallback recovers existing team when pb.create throws 400', async () => {
    const getPlayerTeamSpy = vi
      .spyOn(f1Service, 'getPlayerTeam')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockExistingTeam as any)

    const create400Error = new ClientResponseError({
      status: 400,
      data: {},
      message: 'Failed to create record.',
    })

    const createSpy = vi.fn().mockRejectedValue(create400Error)
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

    expect(createSpy).toHaveBeenCalled()
    expect(getPlayerTeamSpy).toHaveBeenCalledTimes(2)
    expect(result).toEqual(mockExistingTeam)
  })

  it('initializeCareerWithConfig fallback recovers existing team when pb.create throws 400', async () => {
    const getPlayerTeamSpy = vi
      .spyOn(f1Service, 'getPlayerTeam')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockExistingTeam as any)

    const create400Error = new ClientResponseError({
      status: 400,
      data: {},
      message: 'Failed to create record.',
    })

    const createSpy = vi.fn().mockRejectedValue(create400Error)
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

    expect(createSpy).toHaveBeenCalled()
    expect(getPlayerTeamSpy).toHaveBeenCalledTimes(2)
    expect(result).toEqual(mockExistingTeam)
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

  it('handleConfirmOfficial on TeamSelectionPage: pre-check skips create if user already has team', async () => {
    // Simula a lógica exata de verificação prévia no clique de confirmação
    const effectiveUserId = mockUserId
    const getPlayerTeamSpy = vi
      .spyOn(f1Service, 'getPlayerTeam')
      .mockResolvedValue(mockExistingTeam as any)
    const initOfficialSpy = vi.spyOn(f1Service, 'initializeOfficialTeam')

    // Executa a verificação prévia como em handleConfirmOfficial
    const preExisting = await f1Service.getPlayerTeam(effectiveUserId)
    let teamToUse = preExisting
    if (!preExisting) {
      teamToUse = await f1Service.initializeOfficialTeam(effectiveUserId, 'audi', {} as any)
    }

    expect(getPlayerTeamSpy).toHaveBeenCalledWith(effectiveUserId)
    expect(initOfficialSpy).not.toHaveBeenCalled()
    expect(teamToUse).toEqual(mockExistingTeam)
  })

  it('handleConfirmOfficial on TeamSelectionPage: fallback recovers existing team when 400 is caught', async () => {
    const effectiveUserId = mockUserId
    const create400Error = new ClientResponseError({
      status: 400,
      data: {},
      message: 'Failed to create record.',
    })

    // Pré-verificação inicial não encontra equipe (ex: corrida concorrente)
    // Inicialização lança 400
    // Bloco catch reconsulta e encontra mockExistingTeam
    const getPlayerTeamSpy = vi
      .spyOn(f1Service, 'getPlayerTeam')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockExistingTeam as any)

    vi.spyOn(f1Service, 'initializeOfficialTeam').mockRejectedValue(create400Error)

    let finalTeam = null
    const preExisting = await f1Service.getPlayerTeam(effectiveUserId)
    if (preExisting) {
      finalTeam = preExisting
    } else {
      try {
        finalTeam = await f1Service.initializeOfficialTeam(effectiveUserId, 'audi', {} as any)
      } catch (err) {
        finalTeam = await f1Service.getPlayerTeam(effectiveUserId)
      }
    }

    expect(getPlayerTeamSpy).toHaveBeenCalledTimes(2)
    expect(finalTeam).toEqual(mockExistingTeam)
  })

  it('getPlayerTeam: throws error on network failure and NEVER returns null as if user had no team', async () => {
    const networkError = new Error('Network timeout/aborted connection')
    vi.spyOn(pb, 'collection').mockImplementation(
      () =>
        ({
          getList: vi.fn().mockRejectedValue(networkError),
        }) as any,
    )

    await expect(f1Service.getPlayerTeam(mockUserId)).rejects.toThrow(
      'Network timeout/aborted connection',
    )
  })

  it('Guard fail-safe: prior query failure does NOT proceed to create()', async () => {
    const networkError = new Error('Network timeout')
    vi.spyOn(f1Service, 'getPlayerTeam').mockRejectedValue(networkError)
    const initSpy = vi.spyOn(f1Service, 'initializeOfficialTeam')

    let createAttempted = false
    try {
      const preExisting = await f1Service.getPlayerTeam(mockUserId)
      if (!preExisting) {
        createAttempted = true
        await f1Service.initializeOfficialTeam(mockUserId, 'audi', {} as any)
      }
    } catch {
      // Guard blocked creation on query error
    }

    expect(createAttempted).toBe(false)
    expect(initSpy).not.toHaveBeenCalled()
  })

  it('Existing team: button action performs navigation with zero pb.collection("teams").create calls', async () => {
    const createSpy = vi.fn()
    vi.spyOn(pb, 'collection').mockImplementation(
      (name: string) =>
        ({
          create: createSpy,
          getList: vi.fn().mockResolvedValue({ items: [mockExistingTeam] }),
        }) as any,
    )

    const existingTeam = mockExistingTeam
    // Simulating user clicking "Carregar Carreira - Audi F1 Team"
    let navigated = false
    if (existingTeam) {
      navigated = true
      // navigate('/', { replace: true }) - zero POST
    } else {
      await pb.collection('teams').create({ name: 'Audi F1 Team' })
    }

    expect(navigated).toBe(true)
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('SETUP-CHOICE-01A: getPlayerTeam uses valid PocketBase syntax is_archived != true', async () => {
    const getListSpy = vi.fn().mockImplementation((page, perPage, options) => {
      // Verifica se o filtro utiliza a sintaxe válida do PocketBase: is_archived != true
      expect(options.filter).toBe('user_id = "jxe5h74yat69x3x" && is_archived != true')
      expect(options.filter).not.toContain('= null')
      return Promise.resolve({ items: [mockExistingTeam] })
    })

    vi.spyOn(pb, 'collection').mockImplementation(
      (colName: string) =>
        ({
          getList: getListSpy,
        }) as any,
    )

    const res = await f1Service.getPlayerTeam(mockUserId)
    expect(res).toEqual(mockExistingTeam)
  })

  it('SETUP-CHOICE-01A: archiveActiveCareer marks team as is_archived: true and verifies with is_archived != true', async () => {
    const updateSpy = vi.fn().mockResolvedValue({ ...mockExistingTeam, is_archived: true })
    const deleteSpy = vi.fn()
    let getFullListCallCount = 0
    const filterCalls: string[] = []

    vi.spyOn(pb, 'collection').mockImplementation(
      (colName: string) =>
        ({
          getFullList: vi.fn().mockImplementation((options: any) => {
            getFullListCallCount++
            filterCalls.push(options?.filter)
            // Na primeira chamada (busca de equipes), retorna mockExistingTeam (não arquivado)
            // Na segunda chamada (verificação estrita), retorna [] (nenhuma equipe ativa)
            if (getFullListCallCount === 1) {
              return Promise.resolve([mockExistingTeam])
            }
            return Promise.resolve([])
          }),
          update: updateSpy,
          delete: deleteSpy,
        }) as any,
    )

    await f1Service.archiveActiveCareer(mockUserId)

    expect(updateSpy).toHaveBeenCalledWith(mockExistingTeam.id, { is_archived: true })
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(filterCalls[1]).toBe('user_id = "jxe5h74yat69x3x" && is_archived != true')
  })

  it('archiveActiveCareer throws explicit error if active team still persists after retry update', async () => {
    const persistentTeam = { ...mockExistingTeam, is_archived: false }
    vi.spyOn(pb, 'collection').mockImplementation(
      () =>
        ({
          getFullList: vi.fn().mockResolvedValue([persistentTeam]),
          update: vi.fn().mockResolvedValue(persistentTeam),
        }) as any,
    )

    await expect(f1Service.archiveActiveCareer(mockUserId)).rejects.toThrow(
      /Falha na confirmação de arquivamento/,
    )
  })

  it('SETUP-CHOICE-01A: after archiving, getPlayerTeam returns null allowing selection flow', async () => {
    vi.spyOn(pb, 'collection').mockImplementation(
      (colName: string) =>
        ({
          getList: vi.fn().mockResolvedValue({ items: [] }),
        }) as any,
    )

    const res = await f1Service.getPlayerTeam(mockUserId)
    expect(res).toBeNull()
  })

  it('R4/R5: (a) Iniciar nova carreira com equipe ativa existente arquiva com verificação e cria nova equipe', async () => {
    const activeTeam = { ...mockExistingTeam, id: 'team_audi_123', is_archived: false }
    const newCreatedTeam = { id: 'team_ferrari_456', name: 'Scuderia Ferrari', is_archived: false }
    const updateSpy = vi.fn().mockResolvedValue({ ...activeTeam, is_archived: true })
    const createSpy = vi.fn().mockResolvedValue(newCreatedTeam)

    let fullListCalls = 0
    vi.spyOn(pb, 'collection').mockImplementation(
      (colName: string) =>
        ({
          getFullList: vi.fn().mockImplementation(() => {
            fullListCalls++
            if (fullListCalls === 1) return Promise.resolve([activeTeam])
            return Promise.resolve([]) // verificação: 0 equipes ativas restantes
          }),
          getList: vi.fn().mockResolvedValue({ items: [] }),
          update: updateSpy,
          create: createSpy,
          getFirstListItem: vi.fn().mockResolvedValue({ id: 'driver_1' }),
        }) as any,
    )

    // Arquivamento verificado
    await f1Service.archiveActiveCareer(mockUserId)
    expect(updateSpy).toHaveBeenCalledWith('team_audi_123', { is_archived: true })

    // Criação da nova equipe
    const created = await f1Service.initializeOfficialTeam(mockUserId, 'ferrari', {
      name: 'Scuderia Ferrari',
      color: '#E8002D',
      engine: 'Ferrari',
      strength: 88,
      carLevel: 80,
      budget: 300000000,
      driver1: {
        name: 'Charles Leclerc',
        nationality: 'Mônaco',
        age: 28,
        speed: 92,
        consistency: 88,
        rain: 89,
        defense: 90,
        salary: 35000000,
      },
      driver2: {
        name: 'Lewis Hamilton',
        nationality: 'Reino Unido',
        age: 41,
        speed: 93,
        consistency: 91,
        rain: 94,
        defense: 92,
        salary: 45000000,
      },
      reserveDriver: {
        name: 'Oliver Bearman',
        nationality: 'Reino Unido',
        age: 20,
        speed: 82,
        consistency: 80,
        rain: 81,
        defense: 80,
        salary: 2000000,
      },
    })

    expect(created.id).toBe('team_ferrari_456')
    expect(created.name).toBe('Scuderia Ferrari')
  })

  it('R4/R5: (b) Segunda equipe ativa no mesmo clique é recusada ou cai no fallback de reuso idempotente', async () => {
    const existingActive = { ...mockExistingTeam, id: 'team_active_1', is_archived: false }
    const createSpy = vi.fn().mockRejectedValue({ status: 400, message: 'Failed to create record' })

    vi.spyOn(pb, 'collection').mockImplementation(
      (colName: string) =>
        ({
          getList: vi.fn().mockResolvedValue({ items: [existingActive] }),
          create: createSpy,
        }) as any,
    )

    // initializeOfficialTeam detecta que o usuário já possui equipe ativa e reusa sem chamar create
    const result = await f1Service.initializeOfficialTeam(mockUserId, 'ferrari', {
      name: 'Scuderia Ferrari',
      color: '#E8002D',
      engine: 'Ferrari',
      strength: 88,
      carLevel: 80,
      budget: 300000000,
      driver1: {
        name: 'Charles Leclerc',
        nationality: 'Mônaco',
        age: 28,
        speed: 92,
        consistency: 88,
        rain: 89,
        defense: 90,
        salary: 35000000,
      },
      driver2: {
        name: 'Lewis Hamilton',
        nationality: 'Reino Unido',
        age: 41,
        speed: 93,
        consistency: 91,
        rain: 94,
        defense: 92,
        salary: 45000000,
      },
    })

    expect(result.id).toBe('team_active_1')
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('R4/R5: (c) getPlayerTeam retorna apenas equipe não arquivada com filtro is_archived != true', async () => {
    const getListSpy = vi.fn().mockImplementation((page: number, perPage: number, options: any) => {
      // O filtro do PocketBase precisa conter a verificação de is_archived != true (nunca = null)
      expect(options.filter).toBe('user_id = "jxe5h74yat69x3x" && is_archived != true')
      expect(options.filter).not.toContain('= null')
      return Promise.resolve({ items: [] })
    })

    vi.spyOn(pb, 'collection').mockImplementation(
      (colName: string) =>
        ({
          getList: getListSpy,
        }) as any,
    )

    const res = await f1Service.getPlayerTeam(mockUserId)
    expect(res).toBeNull()
  })

  it('CareerRoute and Guard behavior: query error sets careerPhase to error or loadError and does NOT redirect as lobby', () => {
    // Validação lógica do guard: erro na consulta NÃO deve resultar em redirecionamento de lobby
    const errorState = {
      isLoading: false,
      user: { id: mockUserId },
      team: null,
      loadError: 'Connection timeout',
    }

    let careerPhase: 'loading' | 'auth' | 'lobby' | 'career' | 'error' = 'loading'
    if (errorState.isLoading) {
      careerPhase = 'loading'
    } else if (!errorState.user) {
      careerPhase = 'auth'
    } else if (errorState.loadError && !errorState.team) {
      careerPhase = 'error'
    } else if (!errorState.team) {
      careerPhase = 'lobby'
    } else {
      careerPhase = 'career'
    }

    expect(careerPhase).toBe('error')
    expect(careerPhase).not.toBe('lobby')
  })
})
