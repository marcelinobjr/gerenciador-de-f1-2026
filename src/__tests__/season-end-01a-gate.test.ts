/**
 * season-end-01a-gate.test.ts
 *
 * SEASON-END-01A:
 * Validação focal do gate de encerramento da temporada 2026:
 * 1. Ao completar a rodada final (round = 24 = total_rounds):
 *    - advanceWeekendRound NÃO incrementa current_round além de 24 (mantém 24);
 *    - last_processed_round é atualizado para 24;
 *    - Idempotência ao tentar avançar novamente com round 24 preserva current_round=24.
 * 2. Em rodadas intermediárias (ex: round 1 < 24):
 *    - advanceWeekendRound avança normalmente para round + 1.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { advanceWeekendRound } from '@/services/canonicalRoundAdvanceHelper'
import { f1Service } from '@/services/f1Service'
import type { OfficialRaceResult, OfficialRaceResultEntry } from '@/types/canonical-race-v2'
import type { SeasonModel, TeamModel } from '@/types/f1'

describe('SEASON-END-01A — Gate de Encerramento de Temporada no Avanço', () => {
  const mockOfficialRaceResult: OfficialRaceResult = {
    schemaVersion: 'official-race-result-v1',
    officialResultId: 'orr_test_r24',
    raceVariant: 'MAIN_RACE',
    careerId: 'test_career_2026',
    season: 2026,
    round: 24,
    raceId: 'race_abu_dhabi_2026',
    circuitId: 'yas_marina',
    circuitName: 'Yas Marina Circuit',
    circuitCountry: 'Emirados Árabes Unidos',
    playerTeamId: 'test_team',
    officializedAt: '2026-12-06T15:00:00.000Z',
    totalLaps: 58,
    winnerDriverId: 'driver_bortoleto',
    winnerTeamId: 'test_team',
    poleDriverId: 'driver_bortoleto',
    fastestLapDriverId: 'driver_bortoleto',
    podium: ['driver_bortoleto', 'driver_piastri', 'driver_norris'],
    entries: [
      { driverId: 'driver_bortoleto', finalPosition: 1 } as OfficialRaceResultEntry,
      { driverId: 'driver_piastri', finalPosition: 2 } as OfficialRaceResultEntry,
    ],
    playerEntries: [
      { driverId: 'driver_bortoleto', finalPosition: 1 } as OfficialRaceResultEntry,
      { driverId: 'driver_piastri', finalPosition: 2 } as OfficialRaceResultEntry,
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
    resultHash: 'sha256-test-hash',
  }

  const mockSeason: SeasonModel = {
    id: 'z36hmcbqa75kt7k',
    year: 2026,
    current_round: 24,
    total_rounds: 24,
    team_id: 'test_team',
    is_completed: false,
    last_processed_round: 23,
    created: '2026-01-01',
    updated: '2026-12-01',
  }

  const mockTeam: TeamModel = {
    id: 'test_team',
    name: 'Audi F1 Team',
    funds: 50000000,
  } as any

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('ao oficializar R24 (= total_rounds), NÃO avança para R25 fantasma e mantém current_round=24', async () => {
    const updateSeasonSpy = vi.spyOn(f1Service, 'updateSeason').mockResolvedValue({
      ...mockSeason,
      current_round: 24,
      last_processed_round: 24,
    })

    const res = await advanceWeekendRound({
      officialResult: mockOfficialRaceResult,
      season: mockSeason,
      team: mockTeam,
      currentRound: 24,
      totalRounds: 24,
    })

    expect(res.success).toBe(true)
    expect(res.nextRound).toBe(24) // Não 25!
    expect(updateSeasonSpy).toHaveBeenCalledWith('z36hmcbqa75kt7k', {
      current_round: 24,
      last_processed_round: 24,
    })
  })

  it('idempotência: quando R24 já foi processada (last_processed_round=24 e current_round=24), não duplica e retorna alreadyAdvanced=true', async () => {
    const seasonAlreadyProcessed: SeasonModel = {
      ...mockSeason,
      current_round: 24,
      last_processed_round: 24,
    }

    const updateSeasonSpy = vi.spyOn(f1Service, 'updateSeason')

    const res = await advanceWeekendRound({
      officialResult: mockOfficialRaceResult,
      season: seasonAlreadyProcessed,
      team: mockTeam,
      currentRound: 24,
      totalRounds: 24,
    })

    expect(res.success).toBe(true)
    expect(res.alreadyAdvanced).toBe(true)
    expect(res.nextRound).toBe(24)
    expect(updateSeasonSpy).not.toHaveBeenCalled()
  })

  it('em rodadas normais (ex: R1 de 24), incrementa current_round normalmente para round + 1', async () => {
    const seasonR1: SeasonModel = {
      ...mockSeason,
      current_round: 1,
      last_processed_round: 0,
    }

    const updateSeasonSpy = vi.spyOn(f1Service, 'updateSeason').mockResolvedValue({
      ...seasonR1,
      current_round: 2,
      last_processed_round: 1,
    })

    const res = await advanceWeekendRound({
      officialResult: { ...mockOfficialRaceResult, round: 1 },
      season: seasonR1,
      team: mockTeam,
      currentRound: 1,
      totalRounds: 24,
    })

    expect(res.success).toBe(true)
    expect(res.nextRound).toBe(2)
    expect(updateSeasonSpy).toHaveBeenCalledWith('z36hmcbqa75kt7k', {
      current_round: 2,
      last_processed_round: 1,
    })
  })
})
