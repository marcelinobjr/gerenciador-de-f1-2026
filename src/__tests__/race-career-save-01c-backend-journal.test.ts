/**
 * race-career-save-01c-backend-journal.test.ts
 *
 * Microbloco RACE-CAREER-SAVE-01C — JOURNAL COMPACTO E PERSISTIDO NO BACKEND:
 * 1. Journal funciona com localStorage indisponível ou estourando cota (QuotaExceededError).
 * 2. Nova instância recupera status e progresso pelo backend (PocketBase).
 * 3. Repetição não cria duplicata e atualização desatualizada não perde progresso (concorrência e merge de IDs).
 * 4. Conflito explícito quando resultado/hash incompatível tenta sobrescrever o journal.
 * 5. Falha de gravação no backend chega ao chamador (não mostra sucesso antecipado).
 * 6. Resultado persistido com journal pendente/incompleto NÃO libera CONTINUAR (preserva barreira do 01A).
 * 7. Consulta com erro no backend não equivale a journal ausente (propaga exceção).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  canonicalCareerPersistenceService,
  type CareerApplicationJournal,
} from '@/services/canonicalCareerPersistenceService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'
import pb from '@/lib/pocketbase/client'

describe('RACE-CAREER-SAVE-01C — Journal Compacto e Persistido no Backend', () => {
  const careerId = '31b0p9k5ygw2sc8'
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
    playerTeamId: 'nn7kruxy4qlvgwr',
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
    vi.spyOn(canonicalRaceResultService, 'verifyResultIntegrity').mockReturnValue(true)
  })

  it('1. Journal funciona com localStorage quebrado por QuotaExceededError (persiste no backend sem falhar)', async () => {
    // Simular estouro de cota no localStorage na chave do journal
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string) => {
      throw new DOMException(`Quota exceeded for ${key}`, 'QuotaExceededError')
    })

    let savedJournalPayload: any = null
    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_career_apply_journals') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }),
          create: vi.fn().mockImplementation((payload) => {
            savedJournalPayload = { id: 'journal_rec_123', ...payload }
            return Promise.resolve(savedJournalPayload)
          }),
        } as any
      }
      if (name === 'race_results') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }),
          create: vi.fn().mockResolvedValue({ id: 'res_rec_123' }),
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

    const initialJournal: CareerApplicationJournal = {
      key: `career_apply_result_${careerId}_s2026_1_main`,
      careerId,
      season,
      round,
      officialRaceResultId: mockOfficialResult.officialResultId,
      checksum: mockOfficialResult.resultHash,
      status: 'COMPLETE',
      appliedDriverIds: ['driver_piastri', 'driver_norris'],
      totalEntries: 2,
      version: 1,
      startedAt: new Date().toISOString(),
    }

    const saveRes = await canonicalCareerPersistenceService.saveApplicationJournalToBackend(
      initialJournal,
      'MAIN_RACE',
    )

    expect(saveRes.success).toBe(true)
    expect(saveRes.recordId).toBe('journal_rec_123')
    expect(savedJournalPayload).not.toBeNull()
    expect(savedJournalPayload.journal_key).toBe(`career_apply_result_${careerId}_s2026_1_main`)
    expect(savedJournalPayload.status).toBe('COMPLETE')
    expect(savedJournalPayload.applied_driver_ids).toEqual(['driver_piastri', 'driver_norris'])
    // NÃO duplica entries detalhadas nem snapshot completo no journal
    expect(savedJournalPayload.result_snapshot).toBeUndefined()
    expect(savedJournalPayload.entries).toBeUndefined()
  })

  it('2. Nova instância recupera status e progresso pelo backend (PocketBase)', async () => {
    // LocalStorage vazio
    expect(
      canonicalCareerPersistenceService.getApplicationJournal(careerId, season, round, 'MAIN_RACE'),
    ).toBeNull()

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_career_apply_journals') {
        return {
          getFullList: vi.fn().mockResolvedValue([
            {
              id: 'journal_rec_remote',
              journal_key: `career_apply_result_${careerId}_s2026_1_main`,
              career_id: careerId,
              season,
              round,
              race_variant: 'MAIN_RACE',
              official_race_result_id: mockOfficialResult.officialResultId,
              result_hash: mockOfficialResult.resultHash,
              status: 'COMPLETE',
              applied_driver_ids: ['driver_piastri', 'driver_norris'],
              total_entries: 2,
              version: 3,
              started_at: '2026-03-15T05:00:00Z',
              completed_at: '2026-03-15T05:01:00Z',
            },
          ]),
        } as any
      }
      return {} as any
    })

    const fetched = await canonicalCareerPersistenceService.getApplicationJournalFromBackend(
      careerId,
      season,
      round,
      'MAIN_RACE',
    )

    expect(fetched).not.toBeNull()
    expect(fetched?.status).toBe('COMPLETE')
    expect(fetched?.appliedDriverIds).toEqual(['driver_piastri', 'driver_norris'])
    expect(fetched?.version).toBe(3)
  })

  it('3. Repetição não cria duplicata e atualização desatualizada não perde progresso confirmado', async () => {
    const existingDbRecord = {
      id: 'journal_rec_existing',
      journal_key: `career_apply_result_${careerId}_s2026_1_main`,
      career_id: careerId,
      season,
      round,
      official_race_result_id: mockOfficialResult.officialResultId,
      result_hash: mockOfficialResult.resultHash,
      status: 'APPLYING',
      applied_driver_ids: ['driver_piastri'],
      total_entries: 2,
      version: 2,
      started_at: '2026-03-15T05:00:00Z',
    }

    let updatedPayload: any = null
    const mockCreate = vi.fn()
    const mockUpdate = vi.fn().mockImplementation((_id, payload) => {
      updatedPayload = payload
      return Promise.resolve({ id: existingDbRecord.id, ...payload })
    })

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_career_apply_journals') {
        return {
          getFirstListItem: vi.fn().mockResolvedValue(existingDbRecord),
          create: mockCreate,
          update: mockUpdate,
        } as any
      }
      return {} as any
    })

    // Caso A: Atualização válida que avança para driver_norris
    const nextJournal: CareerApplicationJournal = {
      key: `career_apply_result_${careerId}_s2026_1_main`,
      careerId,
      season,
      round,
      officialRaceResultId: mockOfficialResult.officialResultId,
      checksum: mockOfficialResult.resultHash,
      status: 'COMPLETE',
      appliedDriverIds: ['driver_norris'], // sem driver_piastri no payload de entrada
      totalEntries: 2,
      version: 2,
      startedAt: '2026-03-15T05:00:00Z',
    }

    await canonicalCareerPersistenceService.saveApplicationJournalToBackend(
      nextJournal,
      'MAIN_RACE',
    )

    expect(mockCreate).not.toHaveBeenCalled() // NUNCA duplica
    expect(mockUpdate).toHaveBeenCalled()
    // Proteção contra perda de progresso: fez merge com driver_piastri já confirmado
    expect(updatedPayload.applied_driver_ids).toContain('driver_piastri')
    expect(updatedPayload.applied_driver_ids).toContain('driver_norris')
    expect(updatedPayload.version).toBe(3) // Version incrementada

    // Caso B: Versão desatualizada (incoming version 1 < existing version 2) é rejeitada
    const staleJournal: CareerApplicationJournal = {
      ...nextJournal,
      version: 1, // desatualizada
    }

    await expect(
      canonicalCareerPersistenceService.saveApplicationJournalToBackend(staleJournal, 'MAIN_RACE'),
    ).rejects.toThrow(/Conflito de versão desatualizada/)
  })

  it('4. Conflito explícito quando resultado/hash incompatível tenta sobrescrever o journal', async () => {
    const existingDbRecord = {
      id: 'journal_rec_existing',
      journal_key: `career_apply_result_${careerId}_s2026_1_main`,
      career_id: careerId,
      season,
      round,
      official_race_result_id: 'orr_original_race_id',
      result_hash: 'sha256-original-hash-11111',
      status: 'COMPLETE',
      applied_driver_ids: ['driver_piastri', 'driver_norris'],
      total_entries: 2,
      version: 1,
    }

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_career_apply_journals') {
        return {
          getFirstListItem: vi.fn().mockResolvedValue(existingDbRecord),
        } as any
      }
      return {} as any
    })

    const divergentJournal: CareerApplicationJournal = {
      key: `career_apply_result_${careerId}_s2026_1_main`,
      careerId,
      season,
      round,
      officialRaceResultId: 'orr_divergent_id_22222', // ID diferente
      checksum: 'sha256-original-hash-11111',
      status: 'APPLYING',
      appliedDriverIds: [],
      totalEntries: 2,
      version: 1,
      startedAt: new Date().toISOString(),
    }

    await expect(
      canonicalCareerPersistenceService.saveApplicationJournalToBackend(
        divergentJournal,
        'MAIN_RACE',
      ),
    ).rejects.toThrow(/Conflito de journal no backend/)
  })

  it('5. Falha de gravação no backend chega ao chamador (não mostra sucesso antecipado)', async () => {
    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_career_apply_journals') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }),
          create: vi.fn().mockRejectedValue(new Error('PocketBase network timeout')),
        } as any
      }
      if (name === 'race_results') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }),
          create: vi.fn().mockResolvedValue({ id: 'res_rec_123' }),
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

    const journal: CareerApplicationJournal = {
      key: `career_apply_result_${careerId}_s2026_1_main`,
      careerId,
      season,
      round,
      officialRaceResultId: mockOfficialResult.officialResultId,
      checksum: mockOfficialResult.resultHash,
      status: 'APPLYING',
      appliedDriverIds: [],
      totalEntries: 2,
      version: 1,
      startedAt: new Date().toISOString(),
    }

    await expect(
      canonicalCareerPersistenceService.saveApplicationJournalToBackend(journal, 'MAIN_RACE'),
    ).rejects.toThrow(/PocketBase network timeout/)
  })

  it('6. Resultado persistido com journal pendente/incompleto NÃO libera CONTINUAR', async () => {
    // Cenário: race_results já persistido, mas journal ainda PENDING
    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_career_apply_journals') {
        return {
          getFullList: vi.fn().mockResolvedValue([
            {
              id: 'journal_rec_1',
              journal_key: `career_apply_result_${careerId}_s2026_1_main`,
              career_id: careerId,
              season,
              round,
              status: 'APPLYING', // Ainda aplicando
              applied_driver_ids: ['driver_piastri'], // 1 de 2
              total_entries: 2,
            },
          ]),
        } as any
      }
      return {} as any
    })

    const isComplete = await canonicalCareerPersistenceService.isResultRegisteredAsync(
      careerId,
      season,
      round,
      'MAIN_RACE',
    )

    // Botão CONTINUAR DEVE continuar bloqueado
    expect(isComplete).toBe(false)
  })

  it('7. Consulta com erro no backend não equivale a journal ausente (propaga exceção)', async () => {
    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_career_apply_journals') {
        return {
          getFullList: vi.fn().mockRejectedValue(new Error('500 Internal Server Error')),
        } as any
      }
      return {} as any
    })

    await expect(
      canonicalCareerPersistenceService.getApplicationJournalFromBackend(
        careerId,
        season,
        round,
        'MAIN_RACE',
      ),
    ).rejects.toThrow(/500 Internal Server Error/)
  })
})
