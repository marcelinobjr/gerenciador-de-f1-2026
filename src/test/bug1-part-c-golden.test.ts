import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { advanceWeekendRound } from '@/services/canonicalRoundAdvanceHelper'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { f1Service } from '@/services/f1Service'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'

function createMockQualifyingGrid(): FinalQualifyingGridEntry[] {
  const teams = [
    { id: 'escuderia_brasil', name: 'Escuderia Brasil', color: '#00A6FB' },
    { id: 'ferrari', name: 'Scuderia Ferrari HP', color: '#E8002D' },
    { id: 'mercedes', name: 'Mercedes-AMG PETRONAS', color: '#27F4D2' },
    { id: 'red_bull', name: 'Oracle Red Bull Racing', color: '#3671C6' },
    { id: 'mclaren', name: 'McLaren Formula 1 Team', color: '#FF8000' },
    { id: 'aston_martin', name: 'Aston Martin Aramco', color: '#229971' },
    { id: 'alpine', name: 'BWT Alpine F1 Team', color: '#0093CC' },
    { id: 'williams', name: 'Williams Racing', color: '#64C4FF' },
    { id: 'sauber_audi', name: 'Audi Revolut F1 Team', color: '#C0C0C0' },
    { id: 'haas', name: 'Haas F1 Team', color: '#B6BABD' },
    { id: 'cadillac', name: 'Cadillac F1 Team', color: '#FFD700' },
    { id: 'racing_bulls', name: 'Visa Cash App RB', color: '#6692FF' },
  ]

  const grid: FinalQualifyingGridEntry[] = []
  let pos = 1
  for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
    const t = teams[teamIdx]
    const isPlayer = t.id === 'escuderia_brasil'

    for (let carNum = 1; carNum <= 2; carNum++) {
      const driverId = isPlayer
        ? carNum === 1
          ? 'drv_player_1'
          : 'drv_player_2'
        : `drv_${t.id}_car${carNum}`
      const driverName = isPlayer
        ? carNum === 1
          ? 'Gabriel Bortoleto'
          : 'Felipe Drugovich'
        : `Piloto ${carNum} - ${t.name}`

      grid.push({
        gridPosition: pos,
        driverId,
        driverName,
        teamId: t.id,
        teamName: t.name,
        teamColor: t.color,
        isPlayer,
        carId: isPlayer ? (carNum === 1 ? 'car1' : 'car2') : undefined,
        eliminationStage: pos <= 10 ? 'Q3' : pos <= 18 ? 'Q2' : 'Q1',
        bestLapSec: 80.0 + pos * 0.1,
        bestLapTime: `1:20.${String(pos).padStart(3, '0')}`,
        bestLapCompound: pos <= 10 ? 'macio' : 'medio',
      })
      pos++
    }
  }

  return grid
}

function createMockFinishedRaceState(params: {
  careerId: string
  season: number
  round: number
}): CanonicalRaceState {
  const { careerId, season, round } = params
  const grid = createMockQualifyingGrid()

  const race = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
    careerId,
    season,
    round,
    circuitName: 'Interlagos',
    circuitCountry: 'Brasil',
    totalLaps: 3,
    playerTeamId: 'escuderia_brasil',
    canonicalQualifyingGrid: grid,
  })

  return canonicalRaceEngineService.advanceMultipleLaps(race, 3, { seedOverride: 42 })
}

describe('PARTE C & GOLDEN TEST: MICRO-PATCH BUG-01 — TESTES BUG1-09 a BUG1-16 + GOLDEN TEST', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('BUG1-09: Continue = +1 exato (current_round 1 -> 2)', async () => {
    const season = { id: 'season_bug1_09', career_id: 'career_09', year: 2026, current_round: 1 }
    const team = { id: 'team_09', name: 'Escuderia Brasil' }

    // Oficializa R1
    const state = createMockFinishedRaceState({ careerId: 'career_09', season: 2026, round: 1 })
    const official = canonicalRaceResultService.officializeRace(state)

    const updateSeasonSpy = vi.spyOn(f1Service, 'updateSeason').mockResolvedValue({} as any)

    const res = await advanceWeekendRound({
      officialResult: official,
      season,
      team,
      currentRound: 1,
    })

    expect(res.success).toBe(true)
    expect(res.nextRound).toBe(2)
    expect(updateSeasonSpy).toHaveBeenCalledWith('season_bug1_09', {
      current_round: 2,
      last_processed_round: 1,
    })
  })

  it('BUG1-10: duplo clique não incrementa +2 (guarda de reentrância e lock)', async () => {
    const season = { id: 'season_bug1_10', career_id: 'career_10', year: 2026, current_round: 4 }
    const team = { id: 'team_10', name: 'Escuderia Brasil' }

    const state = createMockFinishedRaceState({ careerId: 'career_10', season: 2026, round: 4 })
    const official = canonicalRaceResultService.officializeRace(state)

    const updateSeasonSpy = vi
      .spyOn(f1Service, 'updateSeason')
      .mockImplementation(async (_id, data: any) => {
        // Simula a persistência
        season.current_round = data.current_round
        ;(season as any).last_processed_round = data.last_processed_round
        return {} as any
      })

    // Primeiro clique 4 -> 5
    const res1 = await advanceWeekendRound({
      officialResult: official,
      season,
      team,
      currentRound: 4,
    })
    expect(res1.nextRound).toBe(5)

    // Segundo clique imediato (mesma rodada 4 com season atualizada)
    const res2 = await advanceWeekendRound({
      officialResult: official,
      season,
      team,
      currentRound: 4,
    })
    expect(res2.nextRound).toBe(5) // Continua 5, NUNCA 6
    expect(res2.alreadyAdvanced).toBe(true)
    expect(updateSeasonSpy).toHaveBeenCalledTimes(1)
  })

  it('BUG1-11: reload mantém a rodada persistida (após 4->5, reload mantém 5)', async () => {
    const season = { id: 'season_bug1_11', career_id: 'career_11', year: 2026, current_round: 4 }
    const team = { id: 'team_11', name: 'Escuderia Brasil' }

    const state = createMockFinishedRaceState({ careerId: 'career_11', season: 2026, round: 4 })
    const official = canonicalRaceResultService.officializeRace(state)

    vi.spyOn(f1Service, 'updateSeason').mockImplementation(async (_id, data: any) => {
      season.current_round = data.current_round
      ;(season as any).last_processed_round = data.last_processed_round
      return {} as any
    })

    await advanceWeekendRound({ officialResult: official, season, team, currentRound: 4 })
    expect(season.current_round).toBe(5)

    // Simula reload da página: novo objeto season hidratado com round 5
    const reloadedSeason = { ...season }
    expect(reloadedSeason.current_round).toBe(5)
    expect((reloadedSeason as any).last_processed_round).toBe(4)
  })

  it('BUG1-12: race_result não aplicado duas vezes (journal COMPLETE bloqueia re-aplicação)', async () => {
    const season = { id: 'season_bug1_12', career_id: 'career_12', year: 2026, current_round: 1 }
    const team = { id: 'team_12', name: 'Escuderia Brasil' }

    const state = createMockFinishedRaceState({ careerId: 'career_12', season: 2026, round: 1 })
    const official = canonicalRaceResultService.officializeRace(state)

    vi.spyOn(f1Service, 'updateSeason').mockResolvedValue({} as any)

    // Primeira vez
    const regSpy = vi.spyOn(canonicalCareerPersistenceService, 'registerOfficialRaceResultInCareer')
    await advanceWeekendRound({ officialResult: official, season, team, currentRound: 1 })
    expect(regSpy).toHaveBeenCalledTimes(1)

    // Segunda vez
    await advanceWeekendRound({ officialResult: official, season, team, currentRound: 1 })
    // Como o journal já tem status COMPLETE, registerOfficialRaceResultInCareer não é re-executado
    expect(regSpy).toHaveBeenCalledTimes(1)
  })

  it('BUG1-13: championship não duplica pontuações ao ser re-consultado', async () => {
    const careerId = 'career_bug1_13'
    const seasonYear = 2026

    const state = createMockFinishedRaceState({ careerId, season: seasonYear, round: 1 })
    const official = canonicalRaceResultService.officializeRace(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    // Processa snapshot 3 vezes seguidas
    canonicalChampionshipService.processAndPersistRoundChampionship(careerId, seasonYear, 1)
    canonicalChampionshipService.processAndPersistRoundChampionship(careerId, seasonYear, 1)
    const snap = canonicalChampionshipService.processAndPersistRoundChampionship(
      careerId,
      seasonYear,
      1,
    )

    const driver = snap?.driverStandings.find((d) => d.driverId === 'drv_player_1')
    expect(driver?.points).toBe(25) // Permanece 25, não 75
  })

  it('BUG1-14: round só avança após pipeline completo (OFFICIAL -> PERSISTENCE -> STATS -> CHAMPIONSHIP -> ADVANCE)', async () => {
    const season = { id: 'season_bug1_14', career_id: 'career_14', year: 2026, current_round: 1 }
    const team = { id: 'team_14', name: 'Escuderia Brasil' }

    const executionOrder: string[] = []

    const state = createMockFinishedRaceState({ careerId: 'career_14', season: 2026, round: 1 })
    const official = canonicalRaceResultService.officializeRace(state)

    vi.spyOn(
      canonicalCareerPersistenceService,
      'registerOfficialRaceResultInCareer',
    ).mockImplementation((...args) => {
      executionOrder.push('PERSISTENCE_AND_STATS')
      return (
        canonicalCareerPersistenceService as any
      ).constructor.prototype.registerOfficialRaceResultInCareer.apply(
        canonicalCareerPersistenceService,
        args,
      )
    })

    vi.spyOn(canonicalChampionshipService, 'processAndPersistRoundChampionship').mockImplementation(
      (...args) => {
        executionOrder.push('CHAMPIONSHIP_UPDATE')
        return (
          canonicalChampionshipService as any
        ).constructor.prototype.processAndPersistRoundChampionship.apply(
          canonicalChampionshipService,
          args,
        )
      },
    )

    vi.spyOn(f1Service, 'updateSeason').mockImplementation(async () => {
      executionOrder.push('ROUND_ADVANCE')
      return {} as any
    })

    const res = await advanceWeekendRound({
      officialResult: official,
      season,
      team,
      currentRound: 1,
    })

    expect(res.success).toBe(true)
    expect(executionOrder).toEqual([
      'PERSISTENCE_AND_STATS',
      'CHAMPIONSHIP_UPDATE',
      'ROUND_ADVANCE',
    ])
  })

  it('BUG1-15: falha antes do championship update NÃO avança round (proteção contra estado inconsistente)', async () => {
    const season = { id: 'season_bug1_15', career_id: 'career_15', year: 2026, current_round: 4 }
    const team = { id: 'team_15', name: 'Escuderia Brasil' }

    const state = createMockFinishedRaceState({ careerId: 'career_15', season: 2026, round: 4 })
    const official = canonicalRaceResultService.officializeRace(state)

    // Simula falha catastrófica no championship service
    vi.spyOn(canonicalChampionshipService, 'processAndPersistRoundChampionship').mockReturnValue(
      null,
    )

    const updateSeasonSpy = vi.spyOn(f1Service, 'updateSeason').mockResolvedValue({} as any)

    const res = await advanceWeekendRound({
      officialResult: official,
      season,
      team,
      currentRound: 4,
    })

    expect(res.success).toBe(false)
    expect(res.nextRound).toBe(4) // Round NÃO avançou
    expect(updateSeasonSpy).not.toHaveBeenCalled()
  })

  it('BUG1-16: próxima rodada corresponde ao novo current_round', async () => {
    const season = { id: 'season_bug1_16', career_id: 'career_16', year: 2026, current_round: 2 }
    const team = { id: 'team_16', name: 'Escuderia Brasil' }

    const state = createMockFinishedRaceState({ careerId: 'career_16', season: 2026, round: 2 })
    const official = canonicalRaceResultService.officializeRace(state)

    vi.spyOn(f1Service, 'updateSeason').mockImplementation(async (_id, data: any) => {
      season.current_round = data.current_round
      ;(season as any).last_processed_round = data.last_processed_round
      return {} as any
    })

    const res = await advanceWeekendRound({
      officialResult: official,
      season,
      team,
      currentRound: 2,
    })

    expect(res.success).toBe(true)
    expect(season.current_round).toBe(3)
  })

  it('GOLDEN TEST COMPLETO: R1 A=25 B=18 -> Round 2, R2 A=18 B=25 -> Round 3, Acúmulo 43 e 43, Snapshots Congelados, Save/Reload', async () => {
    const careerId = 'career_golden_bug01'
    const season = { id: 'season_golden', career_id: careerId, year: 2026, current_round: 1 }
    const team = { id: 'escuderia_brasil', name: 'Escuderia Brasil' }

    vi.spyOn(f1Service, 'updateSeason').mockImplementation(async (_id, data: any) => {
      season.current_round = data.current_round
      ;(season as any).last_processed_round = data.last_processed_round
      return {} as any
    })

    // ===== ETAPA 1: RODADA 1 (Bortoleto P1 = 25 pts, Drugovich P2 = 18 pts) =====
    expect(season.current_round).toBe(1)
    const stateR1 = createMockFinishedRaceState({ careerId, season: 2026, round: 1 })
    const officialR1 = canonicalRaceResultService.officializeRace(stateR1)

    // Avançar rodada 1
    const advanceR1 = await advanceWeekendRound({
      officialResult: officialR1,
      season,
      team,
      currentRound: 1,
    })
    expect(advanceR1.success).toBe(true)
    expect(season.current_round).toBe(2) // round = 2

    // Verificar standings após R1
    const snapR1 = canonicalChampionshipService.getSnapshot(careerId, 2026, 1)
    expect(snapR1).not.toBeNull()
    const p1_R1 = snapR1?.driverStandings.find((d) => d.driverId === 'drv_player_1')
    const p2_R1 = snapR1?.driverStandings.find((d) => d.driverId === 'drv_player_2')
    expect(p1_R1?.points).toBe(25)
    expect(p2_R1?.points).toBe(18)

    // ===== ETAPA 2: RODADA 2 (Bortoleto P2 = 18 pts, Drugovich P1 = 25 pts) =====
    expect(season.current_round).toBe(2)
    const stateR2 = createMockFinishedRaceState({ careerId, season: 2026, round: 2 })
    stateR2.drivers[0].currentPosition = 2
    stateR2.drivers[0].gridPosition = 2
    stateR2.drivers[1].currentPosition = 1
    stateR2.drivers[1].gridPosition = 1
    const officialR2 = canonicalRaceResultService.officializeRace(stateR2)

    // Avançar rodada 2
    const advanceR2 = await advanceWeekendRound({
      officialResult: officialR2,
      season,
      team,
      currentRound: 2,
    })
    expect(advanceR2.success).toBe(true)
    expect(season.current_round).toBe(3) // round = 3

    // Verificar Snapshot R1 congelado (A=25, B=18 intactos)
    const snapR1Frozen = canonicalChampionshipService.getSnapshot(careerId, 2026, 1)
    expect(snapR1Frozen?.driverStandings.find((d) => d.driverId === 'drv_player_1')?.points).toBe(
      25,
    )
    expect(snapR1Frozen?.driverStandings.find((d) => d.driverId === 'drv_player_2')?.points).toBe(
      18,
    )

    // Verificar Snapshot R2 acumulado (A: 25+18=43, B: 18+25=43)
    const snapR2 = canonicalChampionshipService.getSnapshot(careerId, 2026, 2)
    expect(snapR2).not.toBeNull()
    expect(snapR2?.driverStandings.find((d) => d.driverId === 'drv_player_1')?.points).toBe(43)
    expect(snapR2?.driverStandings.find((d) => d.driverId === 'drv_player_2')?.points).toBe(43)

    // Standings oficiais de ambas as rodadas existem sem duplicação
    const allResults = canonicalChampionshipService.getEligibleOfficialRaceResults(careerId, 2026)
    expect(allResults.length).toBe(2)
    expect(allResults.map((r) => r.round)).toEqual([1, 2])

    // ===== ETAPA 3: SAVE / RELOAD =====
    const reloadedSeason = { ...season }
    expect(reloadedSeason.current_round).toBe(3)

    const standingsAfterReload = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      2,
    )
    expect(
      standingsAfterReload.driverStandings.find((d) => d.driverId === 'drv_player_1')?.points,
    ).toBe(43)
    expect(
      standingsAfterReload.driverStandings.find((d) => d.driverId === 'drv_player_2')?.points,
    ).toBe(43)
  })
})
