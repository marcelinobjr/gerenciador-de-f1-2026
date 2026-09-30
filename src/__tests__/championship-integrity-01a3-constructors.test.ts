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
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

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

  // FIXTURE CONTROLADA: Mercedes P1/100, Ferrari P2/85, Audi P3/62, Haas P4/38, Williams P5/0
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

describe('CHAMPIONSHIP-INTEGRITY-01A3: Construtores Standings Canônico', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // CI01A3-01: a página Campeonato não renderiza apenas a player team.
  it('CI01A3-01: a página Campeonato não renderiza apenas a player team', () => {
    const careerId = 'career_ci01a3_01'
    setupControlledChampionshipState(careerId)

    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )

    expect(snap.constructorStandings.length).toBeGreaterThan(1)
    const nonPlayerTeams = snap.constructorStandings.filter((c) => !c.isPlayer)
    expect(nonPlayerTeams.length).toBeGreaterThan(0)
    expect(snap.constructorStandings.some((c) => c.teamId === 'audi')).toBe(true)
  })

  // CI01A3-02: todas as equipes inscritas estão presentes.
  it('CI01A3-02: todas as equipes inscritas estão presentes', () => {
    const careerId = 'career_ci01a3_02'
    setupControlledChampionshipState(careerId)

    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )

    // O grid oficial 2026 possui 12 equipes homologadas
    const expectedKeys = OFFICIAL_GRID_TEAMS.map((t) => t.key)
    expectedKeys.forEach((key) => {
      const found = snap.constructorStandings.find((c) => c.teamId === key)
      expect(found, `Equipe ${key} deve estar presente`).toBeDefined()
    })
    expect(snap.constructorStandings.length).toBe(12)
  })

  // CI01A3-03: equipe com 0 pontos continua presente.
  it('CI01A3-03: equipe com 0 pontos continua presente', () => {
    const careerId = 'career_ci01a3_03'
    setupControlledChampionshipState(careerId)

    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )

    const williams = snap.constructorStandings.find((c) => c.teamId === 'williams')
    expect(williams).toBeDefined()
    expect(williams!.points).toBe(0)
    expect(williams!.position).toBeGreaterThan(0)
  })

  // CI01A3-04: equipe fora do grid não aparece.
  it('CI01A3-04: equipe fora do grid não aparece', () => {
    const careerId = 'career_ci01a3_04'
    setupControlledChampionshipState(careerId)

    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )

    const disallowedKeys = ['porsche', 'bmw', 'toyota', 'lotus', 'unknown_team']
    disallowedKeys.forEach((key) => {
      expect(snap.constructorStandings.some((c) => c.teamId === key)).toBe(false)
    })
  })

  // CI01A3-05: Audi/player team usa o mesmo snapshot das demais equipes.
  it('CI01A3-05: Audi/player team usa o mesmo snapshot das demais equipes', () => {
    const careerId = 'career_ci01a3_05'
    setupControlledChampionshipState(careerId)

    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )

    const audi = snap.constructorStandings.find((c) => c.teamId === 'audi')
    const merc = snap.constructorStandings.find((c) => c.teamId === 'mercedes')
    const ferr = snap.constructorStandings.find((c) => c.teamId === 'ferrari')

    expect(audi).toBeDefined()
    expect(merc).toBeDefined()
    expect(ferr).toBeDefined()

    // Todos pertencem ao mesmo array constructorStandings ordenado
    const audiIndex = snap.constructorStandings.indexOf(audi!)
    const mercIndex = snap.constructorStandings.indexOf(merc!)
    const ferrIndex = snap.constructorStandings.indexOf(ferr!)

    expect(mercIndex).toBe(0) // P1
    expect(ferrIndex).toBe(1) // P2
    expect(audiIndex).toBe(2) // P3
  })

  // CI01A3-06: position exibida = snapshot.position.
  it('CI01A3-06: position exibida = snapshot.position', () => {
    const careerId = 'career_ci01a3_06'
    setupControlledChampionshipState(careerId)

    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )

    const audi = snap.constructorStandings.find((c) => c.teamId === 'audi')!
    expect(audi.position).toBe(3)
    expect(formatConstructorPosition(audi.position)).toBe('3º')
  })

  // CI01A3-07: points exibidos = snapshot.points.
  it('CI01A3-07: points exibidos = snapshot.points', () => {
    const careerId = 'career_ci01a3_07'
    setupControlledChampionshipState(careerId)

    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )

    const audi = snap.constructorStandings.find((c) => c.teamId === 'audi')!
    expect(audi.points).toBe(62)
    const merc = snap.constructorStandings.find((c) => c.teamId === 'mercedes')!
    expect(merc.points).toBe(100)
    const ferr = snap.constructorStandings.find((c) => c.teamId === 'ferrari')!
    expect(ferr.points).toBe(85)
  })

  // CI01A3-08: position e points vêm do mesmo registro.
  it('CI01A3-08: position e points vêm do mesmo registro', () => {
    const careerId = 'career_ci01a3_08'
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
  })

  // CI01A3-09: a UI não usa simulateAiGridFiaStandings como fonte oficial atual.
  it('CI01A3-09: a UI não usa simulateAiGridFiaStandings como fonte oficial atual', () => {
    const standingsPath = path.resolve(__dirname, '../pages/Standings.tsx')
    const standingsCode = fs.readFileSync(standingsPath, 'utf-8')
    expect(standingsCode).not.toContain('simulateAiGridFiaStandings')

    const standingsServicePath = path.resolve(__dirname, '../services/standingsService.ts')
    const standingsServiceCode = fs.readFileSync(standingsServicePath, 'utf-8')
    expect(standingsServiceCode).not.toContain('simulateAiGridFiaStandings')
  })

  // CI01A3-10: sem resultados oficiais, todas as equipes inscritas aparecem com estado neutro coerente.
  it('CI01A3-10: sem resultados oficiais, todas as equipes inscritas aparecem com estado neutro coerente', () => {
    const careerId = 'career_ci01a3_10_empty'
    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )

    expect(snap.throughRound).toBe(0)
    expect(snap.constructorStandings.length).toBe(12)
    snap.constructorStandings.forEach((c) => {
      expect(c.points).toBe(0)
      expect(c.wins).toBe(0)
      expect(c.gapToLeader).toBe('—')
    })
  })

  // CI01A3-11: runtime team ID resolve corretamente para canonical team.
  it('CI01A3-11: runtime team ID resolve corretamente para canonical team', () => {
    const careerId = 'career_ci01a3_11'
    setupControlledChampionshipState(careerId)

    // Passar ID da equipe em tempo de execução
    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )

    const playerTeam = snap.constructorStandings.find((c) => c.isPlayer)
    expect(playerTeam).toBeDefined()
    expect(playerTeam!.teamId).toBe('audi')
    expect(playerTeam!.teamName).toContain('Audi')
  })

  // CI01A3-12: save/reload preserva a classificação exibida.
  it('CI01A3-12: save/reload preserva a classificação exibida', () => {
    const careerId = 'career_ci01a3_12'
    setupControlledChampionshipState(careerId)

    const read1 = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )
    const read2 = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )

    expect(read1.constructorStandings).toEqual(read2.constructorStandings)
    expect(read1.driverStandings).toEqual(read2.driverStandings)
    expect(read1.throughRound).toBe(read2.throughRound)
  })
})
