/**
 * race-career-save-01b-backend.test.ts
 *
 * Microbloco RACE-CAREER-SAVE-01B:
 * 1. localStorage.setItem falhando não impede persistir o resultado oficial completo no backend
 * 2. Falha do backend é propagada ao chamador (nada de catch que engole silenciosamente)
 * 3. Repetição do mesmo resultado não duplica; resultado divergente gera conflito explícito
 * 4. Nova instância recupera o objeto completo pelo backend
 * 5. Persistir somente o resultado NÃO libera CONTINUAR (preserva barreira do 01A)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'
import pb from '@/lib/pocketbase/client'

describe('RACE-CAREER-SAVE-01B — Gravação e Recuperação do Resultado no Backend (PocketBase)', () => {
  const careerId = '31b0p9k5ygw2sc8' // season id real do PocketBase
  const season = 2026
  const round = 1

  const mockOfficialResult: OfficialRaceResult = {
    schemaVersion: 'official-race-result-v1',
    officialResultId: `orr_${careerId}_s${season}_r${round}_1741500000`,
    raceVariant: 'MAIN_RACE',
    careerId,
    season,
    round,
    raceId: 'race_melbourne_2026',
    circuitId: 'albert_park',
    circuitName: 'Albert Park Circuit',
    circuitCountry: 'Austrália',
    playerTeamId: 'nn7kruxy4qlvgwr', // Audi F1 Team
    officializedAt: new Date().toISOString(),
    totalLaps: 58,
    winnerDriverId: 'driver_piastri',
    winnerTeamId: 'team_mclaren',
    poleDriverId: 'driver_verstappen',
    fastestLapDriverId: 'driver_norris',
    podium: ['driver_piastri', 'driver_norris', 'driver_leclerc'],
    entries: [
      {
        driverId: 'driver_piastri',
        teamId: 'team_mclaren',
        driverName: 'Oscar Piastri',
        teamName: 'McLaren F1 Team',
        teamColor: '#FF8000',
        isPlayer: false,
        gridPosition: 2,
        finalPosition: 1,
        positionsGainedLost: 1,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 25,
      } as any,
      {
        driverId: 'driver_norris',
        teamId: 'team_mclaren',
        driverName: 'Lando Norris',
        teamName: 'McLaren F1 Team',
        teamColor: '#FF8000',
        isPlayer: false,
        gridPosition: 1,
        finalPosition: 2,
        positionsGainedLost: -1,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 18,
      } as any,
    ],
    playerEntries: [
      {
        driverId: 'driver_hulkenberg',
        teamId: 'nn7kruxy4qlvgwr',
        driverName: 'Nico Hülkenberg',
        teamName: 'Audi F1 Team',
        teamColor: '#C0C0C0',
        isPlayer: true,
        gridPosition: 8,
        finalPosition: 7,
        positionsGainedLost: 1,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 6,
      } as any,
      {
        driverId: 'driver_bortoleto',
        teamId: 'nn7kruxy4qlvgwr',
        driverName: 'Gabriel Bortoleto',
        teamName: 'Audi F1 Team',
        teamColor: '#C0C0C0',
        isPlayer: true,
        gridPosition: 10,
        finalPosition: 9,
        positionsGainedLost: 1,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 2,
      } as any,
    ],
    eventsSummary: {
      safetyCarPeriods: 0,
      safetyCarLaps: 0,
      vscPeriods: 0,
      vscLaps: 0,
      redFlagPeriods: 0,
      dnfCount: 0,
      totalPitStops: 1,
      significantIncidents: [],
    },
    resultHash: 'sha256-mock-official-hash-12345',
  }

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('1. localStorage.setItem falhando com QuotaExceededError não impede persistir o resultado completo no backend', async () => {
    // Simular quebra de cota no localStorage
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string) => {
      const err = new DOMException(`Quota exceeded for ${key}`, 'QuotaExceededError')
      throw err
    })

    let createdPayload: any = null
    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'race_results') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue(new Error('not found')),
          create: vi.fn().mockImplementation((payload) => {
            createdPayload = { id: 'rec_pb_created_99', ...payload }
            return Promise.resolve(createdPayload)
          }),
        } as any
      }
      if (name === 'seasons') {
        return {
          getOne: vi.fn().mockResolvedValue({ id: careerId }),
          getFirstListItem: vi.fn().mockResolvedValue({ id: careerId }),
        } as any
      }
      return {} as any
    })

    const saveRes =
      await canonicalRaceResultService.saveOfficialRaceResultToBackend(mockOfficialResult)

    expect(saveRes.success).toBe(true)
    expect(saveRes.recordId).toBe('rec_pb_created_99')
    expect(createdPayload).not.toBeNull()
    expect(createdPayload.career_id).toBe(careerId)
    expect(createdPayload.round).toBe(1)
    expect(createdPayload.result_snapshot).toBeDefined()
    expect(createdPayload.result_snapshot.schemaVersion).toBe('official-race-result-v1')
    expect(createdPayload.result_snapshot.resultHash).toBe(mockOfficialResult.resultHash)
    expect(createdPayload.result_snapshot.entries.length).toBe(2)
  })

  it('2. Falha do backend é propagada ao chamador (sem engolir silenciosamente)', async () => {
    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'race_results') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue(new Error('not found')),
          create: vi
            .fn()
            .mockRejectedValue(new Error('PocketBase write failed: 503 Service Unavailable')),
        } as any
      }
      if (name === 'seasons') {
        return {
          getOne: vi.fn().mockResolvedValue({ id: careerId }),
          getFirstListItem: vi.fn().mockResolvedValue({ id: careerId }),
        } as any
      }
      return {} as any
    })

    await expect(
      canonicalRaceResultService.saveOfficialRaceResultToBackend(mockOfficialResult),
    ).rejects.toThrow(/PocketBase write failed/)
  })

  it('3. Repetição do mesmo resultado não duplica; resultado divergente gera conflito explícito', async () => {
    // 3a. Mesmo resultado e mesmo hash -> reconhece existente sem duplicar
    const mockExistingRecord = {
      id: 'rec_pb_existing_1',
      official_race_result_id: mockOfficialResult.officialResultId,
      checksum: mockOfficialResult.resultHash,
      result_key: `race_result_${careerId}_s2026_1_main`,
      career_id: careerId,
      round: 1,
      result_snapshot: mockOfficialResult,
    }

    const mockCreate = vi.fn()
    const mockUpdate = vi.fn().mockResolvedValue(mockExistingRecord)

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'race_results') {
        return {
          getFirstListItem: vi.fn().mockResolvedValue(mockExistingRecord),
          create: mockCreate,
          update: mockUpdate,
        } as any
      }
      if (name === 'seasons') {
        return {
          getOne: vi.fn().mockResolvedValue({ id: careerId }),
        } as any
      }
      return {} as any
    })

    const repeatRes =
      await canonicalRaceResultService.saveOfficialRaceResultToBackend(mockOfficialResult)
    expect(repeatRes.success).toBe(true)
    expect(repeatRes.isExisting).toBe(true)
    expect(repeatRes.recordId).toBe('rec_pb_existing_1')
    expect(mockCreate).not.toHaveBeenCalled() // NUNCA duplica

    // 3b. Resultado divergente (mesma identidade mas hash diferente) -> conflito explícito
    const conflictingResult: OfficialRaceResult = {
      ...mockOfficialResult,
      officialResultId: 'orr_different_attempt_id',
      resultHash: 'sha256-divergent-hash-99999',
    }

    await expect(
      canonicalRaceResultService.saveOfficialRaceResultToBackend(conflictingResult),
    ).rejects.toThrow(/Conflito de resultado oficial/)
  })

  it('4. Nova instância recupera o objeto completo pelo backend', async () => {
    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'race_results') {
        return {
          getFullList: vi.fn().mockResolvedValue([
            {
              id: 'rec_pb_existing_1',
              official_race_result_id: mockOfficialResult.officialResultId,
              checksum: mockOfficialResult.resultHash,
              result_key: `race_result_${careerId}_s2026_1_main`,
              career_id: careerId,
              round: 1,
              result_snapshot: mockOfficialResult,
            },
          ]),
        } as any
      }
      return {} as any
    })

    const fetched = await canonicalRaceResultService.getOfficialRaceResultFromBackend(
      careerId,
      season,
      round,
      'MAIN_RACE',
    )

    expect(fetched).not.toBeNull()
    expect(fetched?.officialResultId).toBe(mockOfficialResult.officialResultId)
    expect(fetched?.resultHash).toBe(mockOfficialResult.resultHash)
    expect(fetched?.entries.length).toBe(mockOfficialResult.entries.length)
    expect(fetched?.playerEntries.length).toBe(mockOfficialResult.playerEntries.length)
  })

  it('5. Persistir somente o resultado NÃO libera CONTINUAR (preserva barreira do 01A)', () => {
    // 5a. Salvar apenas o resultado em cache / memória
    canonicalRaceResultService.saveOfficialRaceResult(mockOfficialResult)

    // O status do registro da carreira deve ser falso/PENDING porque o journal NÃO foi registrado como COMPLETE
    const isRegistered = canonicalCareerPersistenceService.isResultRegistered(
      careerId,
      season,
      round,
      'MAIN_RACE',
    )
    expect(isRegistered).toBe(false)

    // O journal ainda não existe
    const journal = canonicalCareerPersistenceService.getApplicationJournal(
      careerId,
      season,
      round,
      'MAIN_RACE',
    )
    expect(journal).toBeNull()
  })
})
