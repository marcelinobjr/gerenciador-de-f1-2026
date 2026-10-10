import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalChampionshipService } from '../services/canonicalChampionshipService'
import { canonicalCareerPersistenceService } from '../services/canonicalCareerPersistenceService'
import pb from '../lib/pocketbase/client'

describe('STANDINGS-PB-AUTHORITY-01A — Classificação deriva do backend', () => {
  const careerId = '31b0p9k5ygw2sc8'
  const season = 2026

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('passo 1: getEligibleOfficialRaceResultsAsync recupera resultados do PocketBase mesmo com localStorage vazio', async () => {
    // 1. Simular PocketBase contendo o journal da Rodada 1 e as linhas de race_results
    const mockJournalRecord = {
      id: 'journal_r1',
      career_id: careerId,
      season: season,
      round: 1,
      variant: 'MAIN_RACE',
      journal_key: `career_apply_result_${careerId}_s${season}_1_main`,
      status: 'COMPLETE',
      total_entries: 24,
      applied_driver_ids: ['drv_antonelli', 'drv_russell'],
      created: '2026-03-01T10:00:00Z',
    }

    const mockRaceResults = [
      {
        id: 'rr_1',
        career_id: careerId,
        season_id: careerId,
        round: 1,
        position: 1,
        driver_id: 'drv_antonelli',
        driverName: 'Kimi Antonelli',
        team_id: 'team_mercedes',
        teamName: 'Mercedes-AMG F1 Team',
        grid_position: 1,
        points: 25,
        status: 'finished',
        application_status: 'COMPLETE',
        fastest_lap: false,
      },
      {
        id: 'rr_2',
        career_id: careerId,
        season_id: careerId,
        round: 1,
        position: 2,
        driver_id: 'drv_russell',
        driverName: 'George Russell',
        team_id: 'team_mercedes',
        teamName: 'Mercedes-AMG F1 Team',
        grid_position: 2,
        points: 18,
        status: 'finished',
        application_status: 'COMPLETE',
        fastest_lap: true,
      },
    ]

    const getFullListSpy = vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'canonical_career_apply_journals') {
        return {
          getFullList: vi.fn().mockResolvedValue([mockJournalRecord]),
        } as any
      }
      if (colName === 'race_results') {
        return {
          getFullList: vi.fn().mockResolvedValue(mockRaceResults),
        } as any
      }
      return {
        getFullList: vi.fn().mockResolvedValue([]),
        getFirstListItem: vi.fn().mockResolvedValue(null),
      } as any
    })

    // LocalStorage está vazio
    const localRaces = canonicalChampionshipService.getEligibleOfficialRaceResults(careerId, season)
    expect(localRaces.length).toBe(0)

    // Leitura autoritativa busca do backend
    const remoteRaces = await canonicalChampionshipService.getEligibleOfficialRaceResultsAsync(
      careerId,
      season,
    )
    expect(remoteRaces.length).toBe(1)
    expect(remoteRaces[0].round).toBe(1)
    expect(remoteRaces[0].entries?.length).toBe(2)

    // Reconstrução do campeonato via getChampionshipStandingsAsync
    const standings = await canonicalChampionshipService.getChampionshipStandingsAsync(
      careerId,
      season,
    )
    expect(standings.throughRound).toBe(1)
    expect(standings.driverStandings.length).toBeGreaterThan(0)
    expect(standings.driverStandings[0].driverId).toBe('drv_antonelli')
    expect(standings.driverStandings[0].points).toBe(25)

    // Construtores com Mercedes na frente
    expect(standings.constructorStandings.length).toBeGreaterThan(0)
    expect(standings.constructorStandings[0].teamId).toBe('team_mercedes')
    expect(standings.constructorStandings[0].points).toBe(43) // 25 + 18
  })

  it('passo 2: getApplicationJournalFromBackend usa filtro journal_key (nunca key)', async () => {
    let queriedFilter = ''
    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'canonical_career_apply_journals') {
        return {
          getFullList: vi.fn().mockImplementation((options: any) => {
            queriedFilter = options?.filter || ''
            return Promise.resolve([
              {
                id: 'j1',
                journal_key: `career_apply_result_${careerId}_s${season}_1_main`,
                status: 'COMPLETE',
                total_entries: 24,
                applied_driver_ids: ['drv1'],
              },
            ])
          }),
        } as any
      }
      return {} as any
    })

    await canonicalCareerPersistenceService.getApplicationJournalFromBackend(
      careerId,
      season,
      1,
      'MAIN_RACE',
    )
    expect(queriedFilter).toContain('journal_key =')
    expect(queriedFilter).not.toContain('key =')
  })
})
