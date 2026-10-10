import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import pb from '@/lib/pocketbase/client'
import { resolveCanonicalCareerId } from '@/lib/canonical-career-id'

describe('STANDINGS-PB-AUTHORITY-01A — Classificação autoritativa do PocketBase', () => {
  const careerId = '31b0p9k5ygw2sc8'
  const season = 2026
  const round = 1

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('1. resolveCanonicalCareerId unifica a identidade com season.id quando season.career_id não existe', () => {
    const mockSeason = { id: careerId, year: 2026 }
    const mockTeam = { id: 'nn7kruxy4qlvgwr', name: 'Audi F1 Team' }
    const resolved = resolveCanonicalCareerId(mockSeason, mockTeam)
    expect(resolved).toBe(careerId)
  })

  it('2. getEligibleOfficialRaceResultsAsync consulta PocketBase e reconstrói resultados mesmo com localStorage vazio', async () => {
    const mockJournalRecord = {
      id: 'iuocfkevb121a7g',
      journal_key: `career_apply_result_${careerId}_s2026_1_main`,
      career_id: careerId,
      season: 2026,
      round: 1,
      race_variant: 'MAIN_RACE',
      official_race_result_id: 'orr_31b0p9k5ygw2sc8_s2026_r1_1791637467492',
      result_hash: 'sha256-mock-4de4b4f6',
      status: 'COMPLETE',
      total_entries: 24,
      applied_driver_ids: ['jwj3wcbmpjlszi9'],
      completed_at: '2026-10-10T19:47:41.691Z',
    }

    const mockRaceRow = {
      id: 'eu9k6dq7sir2y42',
      career_id: careerId,
      season_id: careerId,
      round: 1,
      driver_id: 'jwj3wcbmpjlszi9',
      team_id: 'team_mercedes',
      points: 25,
      position: 1,
      application_status: 'COMPLETE',
      result_snapshot: {
        circuitName: 'Grande Prêmio da Austrália',
        circuitCountry: 'Austrália',
        totalLaps: 58,
        entries: [
          {
            driverId: 'jwj3wcbmpjlszi9',
            driverName: 'Andrea Kimi Antonelli',
            teamId: 'team_mercedes',
            teamName: 'Mercedes-AMG F1 Team',
            teamColor: '#00D2BE',
            pointsAwarded: 25,
            finalPosition: 1,
            fastestLap: false,
          },
          {
            driverId: 'synyhb7yruf04vr',
            driverName: 'George Russell',
            teamId: 'team_mercedes',
            teamName: 'Mercedes-AMG F1 Team',
            teamColor: '#00D2BE',
            pointsAwarded: 18,
            finalPosition: 2,
            fastestLap: false,
          },
        ],
      },
    }

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_career_apply_journals') {
        return {
          getFullList: vi.fn().mockResolvedValue([mockJournalRecord]),
        } as any
      }
      if (name === 'race_results') {
        return {
          getFullList: vi.fn().mockResolvedValue([mockRaceRow]),
        } as any
      }
      if (name === 'championship_snapshots') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }),
        } as any
      }
      return {
        getFullList: vi.fn().mockResolvedValue([]),
        getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }),
      } as any
    })

    const results = await canonicalChampionshipService.getEligibleOfficialRaceResultsAsync(
      careerId,
      season,
      round,
    )

    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].round).toBe(1)
    expect(results[0].entries[0].driverName).toContain('Antonelli')
    expect(results[0].entries[0].pointsAwarded).toBe(25)

    const standings = await canonicalChampionshipService.getChampionshipStandingsAsync(
      careerId,
      season,
      round,
    )

    expect(standings.throughRound).toBe(1)
    expect(standings.driverStandings[0].driverId).toBe('jwj3wcbmpjlszi9')
    expect(standings.driverStandings[0].points).toBe(25)
    // Construtores: Mercedes deve estar na frente com Antonelli (25) + Russell (18) = 43 pontos
    const mercStanding = standings.constructorStandings.find(
      (c) => c.teamId === 'team_mercedes' || c.teamName.includes('Mercedes'),
    )
    expect(mercStanding).toBeDefined()
    expect(mercStanding?.points).toBe(43)
    expect(standings.constructorStandings[0].teamId).toBe(mercStanding?.teamId)
  })
})
