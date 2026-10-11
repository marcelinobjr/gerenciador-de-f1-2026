import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  canonicalCareerPersistenceService,
  CareerApplicationJournal,
} from '../services/canonicalCareerPersistenceService'
import { OfficialRaceResult } from '../types/race'

describe('BUG-APPLY-JOURNAL-STALL-01A: Retomada Idempotente e Resiliência', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  it('deve reprocessar apenas as entradas ausentes de applied_driver_ids a partir do snapshot do official result', async () => {
    const mockOfficialResult: OfficialRaceResult = {
      officialResultId: 'orr_z36hmcbqa75kt7k_s2026_3_1791717364781',
      careerId: 'z36hmcbqa75kt7k',
      season: 2026,
      round: 3,
      circuitId: 'race_z36hmcbqa75kt7k_s2026_r3',
      resultHash: 'sha256-mock-5b5b85e9',
      winnerDriverId: 'ferrari_d1',
      poleDriverId: 'mercedes_d1',
      fastestLapDriverId: 'ferrari_d1',
      playerTeamId: 'audi_team',
      officializedAt: new Date().toISOString(),
      entries: [
        {
          driverId: 'drv_1',
          driverName: 'Driver 1',
          teamId: 'team_a',
          teamName: 'Team A',
          gridPosition: 1,
          finalPosition: 1,
          pointsAwarded: 25,
          status: 'finished',
          fastestLap: true,
        },
        {
          driverId: 'drv_2',
          driverName: 'Driver 2',
          teamId: 'team_b',
          teamName: 'Team B',
          gridPosition: 2,
          finalPosition: 2,
          pointsAwarded: 18,
          status: 'finished',
          fastestLap: false,
        },
      ],
      playerEntries: [],
    }

    // Estado inicial: Journal em APPLYING com drv_1 já aplicado e drv_2 pendente
    const initialJournal: CareerApplicationJournal = {
      key: 'career_apply_result_z36hmcbqa75kt7k_s2026_3_main',
      careerId: 'z36hmcbqa75kt7k',
      season: 2026,
      round: 3,
      officialRaceResultId: 'orr_z36hmcbqa75kt7k_s2026_3_1791717364781',
      checksum: 'sha256-mock-5b5b85e9',
      status: 'APPLYING',
      appliedDriverIds: ['drv_1'],
      totalEntries: 2,
      version: 2,
      startedAt: new Date().toISOString(),
    }

    // Mock das chamadas do backend PocketBase
    vi.spyOn(
      canonicalCareerPersistenceService,
      'getApplicationJournalFromBackend',
    ).mockResolvedValue(initialJournal)
    const saveBackendSpy = vi
      .spyOn(canonicalCareerPersistenceService, 'saveApplicationJournalToBackend')
      .mockImplementation(async (j) => {
        return { success: true, recordId: 'mock_rec_id' }
      })
    vi.spyOn(canonicalCareerPersistenceService, 'syncWithPocketBaseIfAvailable').mockResolvedValue({
      success: true,
    })

    // Executar registro assíncrono (retomada)
    const result = await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
      mockOfficialResult,
      { requireBackendSync: true },
    )

    expect(result.success).toBe(true)
    expect(result.journal.status).toBe('COMPLETE')
    expect(result.journal.appliedDriverIds).toEqual(['drv_1', 'drv_2'])
    expect(result.journal.totalEntries).toBe(2)
  })

  it('deve registrar status FAILED e last_error no journal se uma entrada falhar durante a aplicação', async () => {
    const mockOfficialResult: OfficialRaceResult = {
      officialResultId: 'orr_fail_test',
      careerId: 'z36hmcbqa75kt7k',
      season: 2026,
      round: 3,
      circuitId: 'race_z36hmcbqa75kt7k_s2026_r3',
      resultHash: 'sha256-fail-test',
      winnerDriverId: 'ferrari_d1',
      poleDriverId: 'mercedes_d1',
      fastestLapDriverId: 'ferrari_d1',
      playerTeamId: 'audi_team',
      officializedAt: new Date().toISOString(),
      entries: [
        {
          driverId: 'drv_fail_1',
          driverName: 'Driver Fail 1',
          teamId: 'team_a',
          teamName: 'Team A',
          gridPosition: 1,
          finalPosition: 1,
          pointsAwarded: 25,
          status: 'finished',
          fastestLap: false,
        },
      ],
      playerEntries: [],
    }

    // Simular falha forçada no saveApplicationJournalToBackend após checkpoint inicial
    let callCount = 0
    vi.spyOn(
      canonicalCareerPersistenceService,
      'saveApplicationJournalToBackend',
    ).mockImplementation(async (j) => {
      callCount++
      if (callCount > 1) {
        throw new Error('Falha de rede simulada no backend durante aplicação do piloto')
      }
      return { success: true, recordId: 'mock_id' }
    })

    const result = await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
      mockOfficialResult,
      { requireBackendSync: true },
    )

    expect(result.success).toBe(false)
    expect(result.journal.status).toBe('FAILED')
    expect(result.journal.lastError).toContain('Falha de rede simulada no backend')
  })
})
