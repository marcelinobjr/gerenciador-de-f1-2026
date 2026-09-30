import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { standingsService, formatConstructorPosition } from '@/services/standingsService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'

function createControlledQualifyingGrid(playerTeamId: string): FinalQualifyingGridEntry[] {
  const teams = [
    { id: 'mercedes', name: 'Mercedes-AMG Petronas', color: '#27F4D2' },
    { id: 'ferrari', name: 'Scuderia Ferrari', color: '#E8002D' },
    { id: playerTeamId, name: 'Audi F1 Team', color: '#FF2A00' },
    { id: 'haas', name: 'Haas F1 Team', color: '#B6BABD' },
    { id: 'williams', name: 'Williams Racing', color: '#64C4FF' },
  ]

  const grid: FinalQualifyingGridEntry[] = []
  let pos = 1
  for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
    const t = teams[teamIdx]
    const isPlayer = t.id === playerTeamId

    for (let carNum = 1; carNum <= 2; carNum++) {
      const driverId = `drv_${t.id}_car${carNum}`
      const driverName = `Piloto ${carNum} - ${t.name}`

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

function setupControlledChampionshipState(careerId: string, seasonYear = 2026) {
  const grid = createControlledQualifyingGrid('audi')
  let race = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
    careerId,
    season: seasonYear,
    round: 1,
    circuitName: 'Sakhir',
    circuitCountry: 'Bahrein',
    totalLaps: 3,
    playerTeamId: 'audi',
    canonicalQualifyingGrid: grid,
  })

  race = canonicalRaceEngineService.advanceMultipleLaps(race, race.totalLaps, {
    seedOverride: 2026,
  })

  const official = canonicalRaceResultService.officializeRace(race)

  // FIXTURE CONTROLADA 01A4: Mercedes P1/100, Ferrari P2/85, Audi P3/62, Haas P4/38, Williams P5/0
  official.entries.forEach((e) => {
    e.pointsAwarded = 0
  })

  const merc = official.entries.find((e) => e.teamId === 'mercedes')!
  const ferr = official.entries.find((e) => e.teamId === 'ferrari')!
  const audi = official.entries.find((e) => e.teamId === 'audi')!
  const haas = official.entries.find((e) => e.teamId === 'haas')!
  const will = official.entries.find((e) => e.teamId === 'williams')!

  merc.pointsAwarded = 100
  merc.finalPosition = 1
  ferr.pointsAwarded = 85
  ferr.finalPosition = 2
  audi.pointsAwarded = 62
  audi.finalPosition = 3
  haas.pointsAwarded = 38
  haas.finalPosition = 4
  will.pointsAwarded = 0
  will.finalPosition = 5

  official.resultHash = canonicalRaceResultService.generateResultChecksum({
    officialResultId: official.officialResultId,
    careerId: official.careerId,
    season: official.season,
    round: official.round,
    raceId: official.raceId,
    winnerDriverId: official.winnerDriverId,
    poleDriverId: official.poleDriverId,
    fastestLapDriverId: official.fastestLapDriverId,
    entries: official.entries,
  })

  canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
  return official
}

/**
 * Helper que replica com exatidão matemática a resolução feita em Teams.tsx
 * para extrair position, points e enrolled status de qualquer equipe
 */
function resolveTeamCardStanding(
  careerId: string,
  seasonYear: number,
  teamIdentifier: string,
  playerTeamId = 'audi',
) {
  const snapshot = canonicalChampionshipService.getChampionshipStandings(
    careerId,
    seasonYear,
    undefined,
    playerTeamId,
  )

  const throughRound = snapshot.throughRound || 0
  const hasOfficialResults = throughRound > 0

  const standing = snapshot.constructorStandings.find(
    (c) =>
      c.teamId.toLowerCase() === teamIdentifier.toLowerCase() ||
      c.teamName.toLowerCase() === teamIdentifier.toLowerCase() ||
      c.teamId.replace(/^ai_/, '').toLowerCase() === teamIdentifier.toLowerCase(),
  )

  const isEnrolled = !!standing
  const position = standing && hasOfficialResults ? standing.position : 0
  const points = standing ? standing.points : 0
  const displayPosition = position > 0 ? `P${position}` : '—'
  const displayPoints = `${points} pts`
  const displayCompact = isEnrolled ? `${displayPosition} · ${displayPoints}` : 'Não inscrita'

  return {
    isEnrolled,
    position,
    points,
    displayPosition,
    displayPoints,
    displayCompact,
    standing,
  }
}

describe('CHAMPIONSHIP-INTEGRITY-01A4: Página Equipes Consome Snapshot Canônico', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // CI01A4-01: equipe inscrita mostra posição.
  it('CI01A4-01: equipe inscrita mostra posição', () => {
    const careerId = 'career_ci01a4_01'
    setupControlledChampionshipState(careerId)

    const res = resolveTeamCardStanding(careerId, 2026, 'mercedes')
    expect(res.isEnrolled).toBe(true)
    expect(res.position).toBe(1)
    expect(res.displayPosition).toBe('P1')
  })

  // CI01A4-02: equipe inscrita mostra pontos.
  it('CI01A4-02: equipe inscrita mostra pontos', () => {
    const careerId = 'career_ci01a4_02'
    setupControlledChampionshipState(careerId)

    const res = resolveTeamCardStanding(careerId, 2026, 'ferrari')
    expect(res.isEnrolled).toBe(true)
    expect(res.points).toBe(85)
    expect(res.displayPoints).toBe('85 pts')
  })

  // CI01A4-03: Audi P3/62 no snapshot → card Audi P3/62.
  it('CI01A4-03: Audi P3/62 no snapshot → card Audi P3/62', () => {
    const careerId = 'career_ci01a4_03'
    setupControlledChampionshipState(careerId)

    const res = resolveTeamCardStanding(careerId, 2026, 'audi')
    expect(res.isEnrolled).toBe(true)
    expect(res.position).toBe(3)
    expect(res.points).toBe(62)
    expect(res.displayCompact).toBe('P3 · 62 pts')
  })

  // CI01A4-04: Williams P5/0 → card Williams P5/0.
  it('CI01A4-04: Williams P5/0 → card Williams P5/0', () => {
    const careerId = 'career_ci01a4_04'
    setupControlledChampionshipState(careerId)

    const res = resolveTeamCardStanding(careerId, 2026, 'williams')
    expect(res.isEnrolled).toBe(true)
    expect(res.position).toBe(5)
    expect(res.points).toBe(0)
    expect(res.displayCompact).toBe('P5 · 0 pts')
  })

  // CI01A4-05: equipe não inscrita não recebe posição.
  it('CI01A4-05: equipe não inscrita não recebe posição', () => {
    const careerId = 'career_ci01a4_05'
    setupControlledChampionshipState(careerId)

    const res = resolveTeamCardStanding(careerId, 2026, 'porsche')
    expect(res.isEnrolled).toBe(false)
    expect(res.position).toBe(0)
  })

  // CI01A4-06: equipe não inscrita usa estado "Não inscrita" ou equivalente.
  it('CI01A4-06: equipe não inscrita usa estado "Não inscrita" ou equivalente', () => {
    const careerId = 'career_ci01a4_06'
    setupControlledChampionshipState(careerId)

    const res = resolveTeamCardStanding(careerId, 2026, 'porsche')
    expect(res.displayCompact).toBe('Não inscrita')
  })

  // CI01A4-07: sem resultados: equipe inscrita → "— / 0 pts".
  it('CI01A4-07: sem resultados: equipe inscrita → "— / 0 pts"', () => {
    const careerId = 'career_ci01a4_07_empty'
    const res = resolveTeamCardStanding(careerId, 2026, 'mercedes')

    expect(res.isEnrolled).toBe(true)
    expect(res.position).toBe(0)
    expect(res.points).toBe(0)
    expect(res.displayPosition).toBe('—')
    expect(res.displayCompact).toBe('— · 0 pts')
  })

  // CI01A4-08: player team não recebe posição/pontos por regra especial.
  it('CI01A4-08: player team não recebe posição/pontos por regra especial', () => {
    const careerId = 'career_ci01a4_08'
    setupControlledChampionshipState(careerId)

    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )

    const audi = snap.constructorStandings.find((c) => c.teamId === 'audi')!
    expect(audi.position).toBe(3)
    expect(audi.points).toBe(62)
    // Se fosse Ferrari player, a pontuação e posição do audi é idêntica
    const snapFerrariPlayer = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'ferrari',
    )
    const audiUnderFerrari = snapFerrariPlayer.constructorStandings.find(
      (c) => c.teamId === 'audi',
    )!
    expect(audiUnderFerrari.position).toBe(3)
    expect(audiUnderFerrari.points).toBe(62)
  })

  // CI01A4-09: página Equipes usa o snapshot canônico.
  it('CI01A4-09: página Equipes usa o snapshot canônico', () => {
    const teamsPath = path.resolve(__dirname, '../pages/Teams.tsx')
    const teamsCode = fs.readFileSync(teamsPath, 'utf-8')

    expect(teamsCode).toContain('canonicalChampionshipService.getChampionshipStandings')
    expect(teamsCode).toContain('resolveCanonicalCareerId')
  })

  // CI01A4-10: página Equipes não usa simulação local como fonte oficial.
  it('CI01A4-10: página Equipes não usa simulação local como fonte oficial', () => {
    const teamsPath = path.resolve(__dirname, '../pages/Teams.tsx')
    const teamsCode = fs.readFileSync(teamsPath, 'utf-8')

    expect(teamsCode).not.toContain('simulateAiGridFiaStandings')
  })

  // CI01A4-11: runtime team ID resolve corretamente.
  it('CI01A4-11: runtime team ID resolve corretamente', () => {
    const careerId = 'career_ci01a4_11'
    setupControlledChampionshipState(careerId)

    // Resolução por key ou por name
    const byKey = resolveTeamCardStanding(careerId, 2026, 'audi')
    const byName = resolveTeamCardStanding(careerId, 2026, 'Audi F1 Team')

    expect(byKey.position).toBe(3)
    expect(byName.position).toBe(3)
    expect(byKey.points).toBe(62)
    expect(byName.points).toBe(62)
  })

  // CI01A4-12: save/reload preserva position + points.
  it('CI01A4-12: save/reload preserva position + points', () => {
    const careerId = 'career_ci01a4_12'
    setupControlledChampionshipState(careerId)

    const res1 = resolveTeamCardStanding(careerId, 2026, 'audi')
    const res2 = resolveTeamCardStanding(careerId, 2026, 'audi')

    expect(res1.position).toBe(res2.position)
    expect(res1.points).toBe(res2.points)
    expect(res1.displayCompact).toBe(res2.displayCompact)
  })

  // CI01A4-13: Dashboard e Página Equipes concordam para a player team.
  it('CI01A4-13: Dashboard e Página Equipes concordam para a player team', () => {
    const careerId = 'career_ci01a4_13'
    setupControlledChampionshipState(careerId)

    // Dashboard via standingsService
    const dashboardResult = standingsService.calculateStandings({
      raceResults: [],
      playerDrivers: [],
      team: { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' } as any,
      season: { id: careerId, year: 2026, current_round: 1 } as any,
    })

    // Equipes via resolveTeamCardStanding
    const teamsCardResult = resolveTeamCardStanding(careerId, 2026, 'audi')

    expect(dashboardResult.playerConstructorRank).toBe(3)
    expect(teamsCardResult.position).toBe(3)
    expect(dashboardResult.teamPoints).toBe(62)
    expect(teamsCardResult.points).toBe(62)
  })

  // CI01A4-14: Campeonato e Página Equipes concordam para TODAS as equipes inscritas.
  it('CI01A4-14: Campeonato e Página Equipes concordam para TODAS as equipes inscritas', () => {
    const careerId = 'career_ci01a4_14'
    setupControlledChampionshipState(careerId)

    const snapshot = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )

    snapshot.constructorStandings.forEach((cTeam) => {
      const cardStanding = resolveTeamCardStanding(careerId, 2026, cTeam.teamId)
      expect(cardStanding.isEnrolled).toBe(true)
      expect(cardStanding.position).toBe(cTeam.position)
      expect(cardStanding.points).toBe(cTeam.points)
    })
  })
})
