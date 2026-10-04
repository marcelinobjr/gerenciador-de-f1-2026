import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  canonicalChampionshipService,
  type ChampionshipSnapshot,
} from '@/services/canonicalChampionshipService'
import pb from '@/lib/pocketbase/client'

describe('CanonicalChampionshipService - syncSnapshotWithPocketBaseIfAvailable (Idempotência e Upsert)', () => {
  const mockSnapshot: ChampionshipSnapshot = {
    id: 'championship_career_test_2026_r4',
    careerId: 'career_test',
    season: 2026,
    throughRound: 4,
    sourceRaceResultIds: ['race_1', 'race_2', 'race_3', 'race_4'],
    sourceChecksums: ['chk1', 'chk2', 'chk3', 'chk4'],
    driverStandings: [
      {
        driverId: 'drv1',
        driverName: 'Piloto 1',
        nationality: 'Brasil',
        flag: '🇧🇷',
        currentTeamId: 'audi',
        currentTeamName: 'Audi Revolut',
        currentTeamColor: '#FF2A00',
        points: 50,
        position: 1,
        wins: 2,
        secondPlaces: 0,
        thirdPlaces: 0,
        fourthPlaces: 0,
        podiums: 2,
        raceStarts: 4,
        racesCounted: 4,
        finishCounts: { 1: 2 },
        gapToLeader: '—',
        positionDelta: 0,
        positionDeltaText: '—',
        isPlayer: false,
      },
    ],
    constructorStandings: [
      {
        teamId: 'audi',
        teamName: 'Audi Revolut',
        teamColor: '#FF2A00',
        points: 50,
        position: 1,
        wins: 2,
        podiums: 2,
        racesCounted: 4,
        finishCounts: { 1: 2 },
        gapToLeader: '—',
        positionDelta: 0,
        positionDeltaText: '—',
        isPlayer: false,
      },
    ],
    createdAt: new Date().toISOString(),
    schemaVersion: 'championship-snapshot-v1',
  }

  let mockGetFirstListItem: any
  let mockCreate: any
  let mockUpdate: any

  beforeEach(() => {
    vi.restoreAllMocks()
    canonicalChampionshipService.clearSnapshotsForTesting()
    mockGetFirstListItem = vi.fn()
    mockCreate = vi.fn()
    mockUpdate = vi.fn()

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'championship_snapshots') {
        return {
          getFirstListItem: mockGetFirstListItem,
          create: mockCreate,
          update: mockUpdate,
        } as any
      }
      return {} as any
    })
  })

  it('deve criar novo registro quando snapshot_key ainda não existe no backend', async () => {
    mockGetFirstListItem.mockRejectedValue(new Error('Record not found'))
    mockCreate.mockResolvedValue({ id: 'rec_created_1' })

    await canonicalChampionshipService.syncSnapshotWithPocketBaseIfAvailable(mockSnapshot)

    expect(mockGetFirstListItem).toHaveBeenCalledWith(
      'snapshot_key = "championship_career_test_2026_r4"',
    )
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot_key: 'championship_career_test_2026_r4',
        career_id: 'career_test',
        season: 2026,
        through_round: 4,
      }),
    )
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('deve atualizar o registro existente quando snapshot_key já existe previamente', async () => {
    mockGetFirstListItem.mockResolvedValue({
      id: 'rec_existing_123',
      snapshot_key: mockSnapshot.id,
    })
    mockUpdate.mockResolvedValue({ id: 'rec_existing_123' })

    await canonicalChampionshipService.syncSnapshotWithPocketBaseIfAvailable(mockSnapshot)

    expect(mockGetFirstListItem).toHaveBeenCalledWith(
      'snapshot_key = "championship_career_test_2026_r4"',
    )
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith(
      'rec_existing_123',
      expect.objectContaining({
        snapshot_key: 'championship_career_test_2026_r4',
        career_id: 'career_test',
        season: 2026,
        through_round: 4,
      }),
    )
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('deve recuperar e fazer update quando create falhar com validação de unicidade (condição de corrida)', async () => {
    // 1ª busca: não encontrou ainda (condição de corrida onde outro processo gravou em paralelo)
    mockGetFirstListItem.mockRejectedValueOnce(new Error('Record not found'))

    // Tentativa de create falha com 400 validation_not_unique
    const uniqueError = {
      status: 400,
      response: {
        data: {
          snapshot_key: {
            code: 'validation_not_unique',
            message: 'Value must be unique.',
          },
        },
      },
    }
    mockCreate.mockRejectedValue(uniqueError)

    // 2ª busca pós-falha de unicidade encontra o registro recém-criado pela outra requisição
    mockGetFirstListItem.mockResolvedValueOnce({
      id: 'rec_concurrent_456',
      snapshot_key: mockSnapshot.id,
    })
    mockUpdate.mockResolvedValue({ id: 'rec_concurrent_456' })

    await canonicalChampionshipService.syncSnapshotWithPocketBaseIfAvailable(mockSnapshot)

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockGetFirstListItem).toHaveBeenCalledTimes(2)
    expect(mockUpdate).toHaveBeenCalledWith(
      'rec_concurrent_456',
      expect.objectContaining({
        snapshot_key: 'championship_career_test_2026_r4',
      }),
    )
  })

  it('não deve lançar erro nem quebrar fluxo se o PocketBase estiver indisponível ou retornar erro genérico', async () => {
    mockGetFirstListItem.mockRejectedValue(new Error('Network error'))
    mockCreate.mockRejectedValue(new Error('Server offline 500'))

    await expect(
      canonicalChampionshipService.syncSnapshotWithPocketBaseIfAvailable(mockSnapshot),
    ).resolves.not.toThrow()
  })

  it('deve usar in-flight lock para chamadas simultâneas com a mesma snapshot_key (exatamente 1 create)', async () => {
    mockGetFirstListItem.mockRejectedValue(new Error('Record not found'))
    // Simula latência no create para garantir que a 2ª chamada entre enquanto a 1ª está em andamento
    mockCreate.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      return { id: 'rec_inflight_1' }
    })

    // Dispara 2 chamadas paralelas com a mesma chave de snapshot
    const p1 = canonicalChampionshipService.syncSnapshotWithPocketBaseIfAvailable(mockSnapshot)
    const p2 = canonicalChampionshipService.syncSnapshotWithPocketBaseIfAvailable(mockSnapshot)

    await Promise.all([p1, p2])

    // In-flight lock garante que a promise foi compartilhada: apenas 1 getFirstListItem e 1 create
    expect(mockGetFirstListItem).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('deve utilizar cache de ID em chamadas subsequentes, indo direto a update sem repetir getFirstListItem', async () => {
    // Primeira chamada: não encontra, cria e guarda ID em cache
    mockGetFirstListItem.mockRejectedValueOnce(new Error('Record not found'))
    mockCreate.mockResolvedValueOnce({ id: 'rec_cached_id_999' })

    await canonicalChampionshipService.syncSnapshotWithPocketBaseIfAvailable(mockSnapshot)
    expect(mockGetFirstListItem).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).not.toHaveBeenCalled()

    // Segunda chamada sequencial para a mesma chave: vai direto a update com o ID cacheado
    mockUpdate.mockResolvedValueOnce({ id: 'rec_cached_id_999' })

    await canonicalChampionshipService.syncSnapshotWithPocketBaseIfAvailable(mockSnapshot)

    // getFirstListItem NÃO deve ser chamado novamente, e update deve receber o ID que estava em cache
    expect(mockGetFirstListItem).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith(
      'rec_cached_id_999',
      expect.objectContaining({
        snapshot_key: mockSnapshot.id,
      }),
    )
  })
})

describe('CanonicalSessionSetupPersistenceService (Upsert e Idempotência de session_setups)', () => {
  let mockGetList: any
  let mockGetOne: any
  let mockCreate: any
  let mockUpdate: any
  let service: typeof import('@/services/canonicalSessionSetupPersistenceService').canonicalSessionSetupPersistenceService

  beforeEach(async () => {
    vi.restoreAllMocks()
    const mod = await import('@/services/canonicalSessionSetupPersistenceService')
    service = mod.canonicalSessionSetupPersistenceService
    service.clearCachesForTesting()

    mockGetList = vi.fn()
    mockGetOne = vi.fn()
    mockCreate = vi.fn()
    mockUpdate = vi.fn()

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'session_setups') {
        return {
          getList: mockGetList,
          getOne: mockGetOne,
          create: mockCreate,
          update: mockUpdate,
        } as any
      }
      return {} as any
    })
  })

  it('deve criar novo session_setup quando o registro ainda não existe', async () => {
    mockGetList.mockResolvedValueOnce({ items: [] })
    mockCreate.mockResolvedValueOnce({ id: 'setup_created_1' })

    const res = await service.upsertSessionSetup({
      teamId: 'career_test',
      seasonId: 'season_2026',
      round: 1,
      session: 'tp1',
      payload: { wing_level: 7 },
    })

    expect(res.success).toBe(true)
    expect(res.id).toBe('setup_created_1')
    expect(res.isCreated).toBe(true)
    expect(mockGetList).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        team_id: 'career_test',
        season_id: 'season_2026',
        round: 1,
        session: 'tp1',
        wing_level: 7,
      }),
    )
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('deve atualizar o registro quando session_setup já existe no backend', async () => {
    mockGetList.mockResolvedValueOnce({
      items: [{ id: 'setup_existing_123', team_id: 'career_test', driver_strategies: {} }],
    })
    mockUpdate.mockResolvedValueOnce({ id: 'setup_existing_123' })

    const res = await service.upsertSessionSetup({
      teamId: 'career_test',
      seasonId: 'season_2026',
      round: 1,
      session: 'tp1',
      payload: { wing_level: 8 },
    })

    expect(res.success).toBe(true)
    expect(res.isUpdated).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      'setup_existing_123',
      expect.objectContaining({ wing_level: 8 }),
    )
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('deve absorver 400 validation_not_unique em condição de corrida e recuperar via update', async () => {
    // 1ª busca retorna vazio (processos concorrentes checaram simultaneamente)
    mockGetList.mockResolvedValueOnce({ items: [] })

    // Tentativa de create falha com 400 validation_not_unique
    mockCreate.mockRejectedValueOnce({
      status: 400,
      message: 'Failed to create record. Value must be unique.',
      response: { data: { notes: { code: 'validation_not_unique' } } },
    })

    // Busca pós-conflito localiza o registro inserido pelo outro processo concorrente
    mockGetList.mockResolvedValueOnce({
      items: [{ id: 'setup_concurrent_777', team_id: 'career_test' }],
    })
    mockUpdate.mockResolvedValueOnce({ id: 'setup_concurrent_777' })

    const res = await service.upsertSessionSetup({
      teamId: 'career_test',
      seasonId: 'season_2026',
      round: 1,
      session: 'race',
      payload: { wing_level: 5 },
    })

    expect(res.success).toBe(true)
    expect(res.id).toBe('setup_concurrent_777')
    expect(res.isUpdated).toBe(true)
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockGetList).toHaveBeenCalledTimes(2)
    expect(mockUpdate).toHaveBeenCalledWith(
      'setup_concurrent_777',
      expect.objectContaining({ wing_level: 5 }),
    )
  })

  it('deve usar in-flight lock para requisições concorrentes na mesma sessão (evita duplicar requisições)', async () => {
    mockGetList.mockResolvedValue({ items: [] })
    mockCreate.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40))
      return { id: 'setup_inflight_999' }
    })

    const p1 = service.upsertSessionSetup({
      teamId: 'career_test',
      seasonId: 'season_2026',
      round: 1,
      session: 'tp2',
      payload: { wing_level: 6 },
    })
    const p2 = service.upsertSessionSetup({
      teamId: 'career_test',
      seasonId: 'season_2026',
      round: 1,
      session: 'tp2',
      payload: { wing_level: 6 },
    })

    const [r1, r2] = await Promise.all([p1, p2])

    expect(r1.id).toBe('setup_inflight_999')
    expect(r2.id).toBe('setup_inflight_999')
    // Apenas 1 getList e 1 create foram despachados
    expect(mockGetList).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('deve absorver silenciosamente falhas de rede ou servidor sem quebrar a execução', async () => {
    mockGetList.mockRejectedValue(new Error('Connection lost'))
    mockCreate.mockRejectedValue(new Error('Server 500'))

    const res = await service.upsertSessionSetup({
      teamId: 'career_test',
      seasonId: 'season_2026',
      round: 1,
      session: 'tp3',
    })

    expect(res.success).toBe(false)
    expect(res.isCreated).toBe(false)
  })
})
