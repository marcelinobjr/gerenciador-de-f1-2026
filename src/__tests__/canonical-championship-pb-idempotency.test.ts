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
})
