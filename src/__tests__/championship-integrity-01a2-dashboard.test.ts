import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  standingsService,
  formatConstructorPosition,
  calculateSeasonObjectiveProgress,
} from '@/services/standingsService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

function createMockQualifyingGrid(playerTeamId: string): FinalQualifyingGridEntry[] {
  const teams = [
    { id: playerTeamId, name: 'Audi F1 Team', color: '#C0C0C0' },
    { id: 'ferrari', name: 'Scuderia Ferrari', color: '#DC0000' },
    { id: 'red_bull', name: 'Red Bull Racing', color: '#1E41FF' },
    { id: 'mercedes', name: 'Mercedes-AMG F1', color: '#00D2BE' },
    { id: 'mclaren', name: 'McLaren F1 Team', color: '#FF8700' },
    { id: 'aston_martin', name: 'Aston Martin F1', color: '#006F62' },
    { id: 'alpine', name: 'Alpine F1 Team', color: '#0090FF' },
    { id: 'williams', name: 'Williams Racing', color: '#005AFF' },
    { id: 'racing_bulls', name: 'Visa Cash App RB', color: '#6692FF' },
    { id: 'haas', name: 'Haas F1 Team', color: '#B6BABD' },
    { id: 'cadillac', name: 'Cadillac F1 Team', color: '#FFD700' },
    { id: 'custom_runtime_team_id_xyz', name: 'Minha Escuderia Especial', color: '#333333' },
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

function initializeStandardRace(
  playerTeamId = 'audi',
  totalLaps = 3,
  careerId?: string,
  season = 2026,
  round = 1,
): CanonicalRaceState {
  const grid = createMockQualifyingGrid(playerTeamId)
  return canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
    careerId: careerId || `career_${playerTeamId}_test`,
    season,
    round,
    circuitName: 'Sakhir',
    circuitCountry: 'Bahrein',
    totalLaps,
    playerTeamId,
    canonicalQualifyingGrid: grid,
  })
}

function completeRace(race: CanonicalRaceState, seed = 42): CanonicalRaceState {
  return canonicalRaceEngineService.advanceMultipleLaps(race, race.totalLaps, {
    seedOverride: seed,
  })
}

describe('CHAMPIONSHIP-INTEGRITY-01A2 (DASHBOARD)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // CI01A2-01: Audi P3 no snapshot → Dashboard P3
  it('CI01A2-01: Audi P3 no snapshot → Dashboard P3', () => {
    const careerId = 'career_ci01a2_01'
    const seasonYear = 2026

    // Simular corrida canônica oficial
    let race = initializeStandardRace('audi', 3, careerId, seasonYear, 1)
    race = completeRace(race, 101)
    const official = canonicalRaceResultService.officializeRace(race)

    // Ajustar entries do official result para o cenário controlado: Mercedes P1/100, Ferrari P2/85, Audi P3/62, Haas P4/38
    official.entries.forEach((e) => {
      e.pointsAwarded = 0
    })
    const merc = official.entries.find((e) => e.teamId === 'mercedes')!
    const ferr = official.entries.find((e) => e.teamId === 'ferrari')!
    const audi = official.entries.find((e) => e.teamId === 'audi')!
    const haas = official.entries.find((e) => e.teamId === 'haas')!

    merc.pointsAwarded = 100
    merc.finalPosition = 1
    ferr.pointsAwarded = 85
    ferr.finalPosition = 2
    audi.pointsAwarded = 62
    audi.finalPosition = 3
    haas.pointsAwarded = 38
    haas.finalPosition = 4

    // Recalcular hash para integridade
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

    const result = standingsService.calculateStandings({
      raceResults: [],
      playerDrivers: [],
      team: { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' } as any,
      season: { id: 's2026', year: seasonYear, current_round: 1 } as any,
    })

    expect(result.playerConstructorRank).toBe(3)
    expect(formatConstructorPosition(result.playerConstructorRank)).toBe('3º')
  })

  // CI01A2-02: Audi 62 pts no snapshot → Dashboard 62 pts
  it('CI01A2-02: Audi 62 pts no snapshot → Dashboard 62 pts', () => {
    const careerId = 'career_ci01a2_02'
    const seasonYear = 2026

    let race = initializeStandardRace('audi', 3, careerId, seasonYear, 1)
    race = completeRace(race, 102)
    const official = canonicalRaceResultService.officializeRace(race)

    official.entries.forEach((e) => {
      e.pointsAwarded = 0
    })
    const merc = official.entries.find((e) => e.teamId === 'mercedes')!
    const ferr = official.entries.find((e) => e.teamId === 'ferrari')!
    const audi = official.entries.find((e) => e.teamId === 'audi')!
    const haas = official.entries.find((e) => e.teamId === 'haas')!

    merc.pointsAwarded = 100
    merc.finalPosition = 1
    ferr.pointsAwarded = 85
    ferr.finalPosition = 2
    audi.pointsAwarded = 62
    audi.finalPosition = 3
    haas.pointsAwarded = 38
    haas.finalPosition = 4

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

    const result = standingsService.calculateStandings({
      raceResults: [],
      playerDrivers: [],
      team: { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' } as any,
      season: { id: 's2026', year: seasonYear, current_round: 1 } as any,
    })

    expect(result.teamPoints).toBe(62)
  })

  // CI01A2-03: posição e pontos vêm do mesmo registro (playerStanding) do constructorStandings ordenado
  it('CI01A2-03: posição e pontos vêm do mesmo registro (playerStanding) do constructorStandings ordenado', () => {
    const careerId = 'career_ci01a2_03'
    const seasonYear = 2026

    let race = initializeStandardRace('audi', 3, careerId, seasonYear, 1)
    race = completeRace(race, 103)
    const official = canonicalRaceResultService.officializeRace(race)

    official.entries.forEach((e) => {
      e.pointsAwarded = 0
    })
    const merc = official.entries.find((e) => e.teamId === 'mercedes')!
    const ferr = official.entries.find((e) => e.teamId === 'ferrari')!
    const audi = official.entries.find((e) => e.teamId === 'audi')!
    const haas = official.entries.find((e) => e.teamId === 'haas')!

    merc.pointsAwarded = 100
    merc.finalPosition = 1
    ferr.pointsAwarded = 85
    ferr.finalPosition = 2
    audi.pointsAwarded = 62
    audi.finalPosition = 3
    haas.pointsAwarded = 38
    haas.finalPosition = 4

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

    const result = standingsService.calculateStandings({
      raceResults: [],
      playerDrivers: [],
      team: { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' } as any,
      season: { id: 's2026', year: seasonYear, current_round: 1 } as any,
    })

    const playerStandingFromList = result.constructorStandings.find((c) => c.isPlayer)
    expect(playerStandingFromList).toBeDefined()
    expect(result.teamPoints).toBe(playerStandingFromList!.points)

    const rankInList = result.constructorStandings.findIndex((c) => c.isPlayer) + 1
    expect(result.playerConstructorRank).toBe(rankInList)
    expect(result.playerConstructorRank).toBe(3)
    expect(result.teamPoints).toBe(62)
  })

  // CI01A2-04: sem standings → NÃO P1 (rank null/— )
  it('CI01A2-04: sem standings → NÃO P1 (rank null/— )', () => {
    const careerId = 'career_ci01a2_04_empty'
    const result = standingsService.calculateStandings({
      raceResults: [],
      playerDrivers: [],
      team: { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' } as any,
      season: { id: careerId, year: 2026, current_round: 1 } as any,
    })

    expect(result.playerConstructorRank).toBeNull()
    expect(result.playerConstructorRank).not.toBe(1)
    expect(result.teamPoints).toBe(0)
  })

  // CI01A2-05: sem standings → posição neutra "—" (Dashboard renderiza "—" quando null)
  it('CI01A2-05: sem standings → posição neutra "—" (Dashboard renderiza "—" quando null)', () => {
    expect(formatConstructorPosition(null)).toBe('—')
    expect(formatConstructorPosition(undefined)).toBe('—')
    expect(formatConstructorPosition(0)).toBe('—')
    expect(formatConstructorPosition(3)).toBe('3º')
    expect(formatConstructorPosition(1)).toBe('1º')
  })

  // CI01A2-06: não existe mais fallback artificial P1 (sem resultados → rank null)
  it('CI01A2-06: não existe mais fallback artificial P1 (sem resultados → rank null)', () => {
    // 1. Comportamento funcional: sem resultados, rank deve ser null
    const result = standingsService.calculateStandings({
      raceResults: [],
      playerDrivers: [],
      team: { id: 'new_team', team_key: 'new_team', name: 'New Team' } as any,
      season: { id: 'season_clean_zero', year: 2026, current_round: 1 } as any,
    })
    expect(result.playerConstructorRank).toBeNull()
    expect(result.playerConstructorRank).not.toBe(1)

    // 2. Análise estática do código-fonte: sem fallbacks artificiais ?? 65, ?? 3, playerConstructorRank || 1
    const serviceCode = fs.readFileSync(
      path.resolve(__dirname, '../services/standingsService.ts'),
      'utf-8',
    )
    const indexCode = fs.readFileSync(path.resolve(__dirname, '../pages/Index.tsx'), 'utf-8')

    // Não deve conter fallback para 1 quando nulo/0
    expect(serviceCode).not.toMatch(/playerTeamRank\s*>\s*0\s*\?\s*playerTeamRank\s*:\s*1\b/)
    expect(serviceCode).not.toMatch(/playerConstructorRank\s*\|\|\s*1\b/)
    expect(serviceCode).not.toMatch(/playerConstructorRank\s*\?\?\s*1\b/)

    // Index.tsx não deve ter ?? 65 ou ?? 3
    expect(indexCode).not.toMatch(/\?\?\s*65\b/)
    expect(indexCode).not.toMatch(/\?\?\s*3\b/)
    expect(indexCode).not.toMatch(/useState\s*\(\s*65\s*\)/)
    expect(indexCode).not.toMatch(/useState\s*\(\s*3\s*\)/)
  })

  // CI01A2-07: objetivo Top 4 recebe posição atual real (inputs do snapshot)
  it('CI01A2-07: objetivo Top 4 recebe posição atual real (inputs do snapshot)', () => {
    // Top 4 com P3 / 62 pts
    const p3Progress = calculateSeasonObjectiveProgress({
      position: 3,
      points: 62,
      targetRank: 4,
      seasonYear: 2026,
      round: 1,
    })
    expect(p3Progress.isMeeting).toBe(true)
    expect(p3Progress.percentage).toBeGreaterThan(50)
    expect(p3Progress.label).toContain('% atingido')

    // Posição nula → estado neutro "—", NÃO 78%
    const nullProgress = calculateSeasonObjectiveProgress({
      position: null,
      points: 0,
      targetRank: 4,
      seasonYear: 2026,
      round: 1,
    })
    expect(nullProgress.label).toBe('—')
    expect(nullProgress.formattedPercentage).toBe('—')
    expect(nullProgress.percentage).toBe(0)
    expect(nullProgress.isMeeting).toBe(false)
  })

  // CI01A2-08: objetivo recebe pontos atuais do mesmo snapshot
  it('CI01A2-08: objetivo recebe pontos atuais do mesmo snapshot', () => {
    const careerId = 'career_ci01a2_08'
    const seasonYear = 2026

    let race = initializeStandardRace('audi', 3, careerId, seasonYear, 1)
    race = completeRace(race, 108)
    const official = canonicalRaceResultService.officializeRace(race)

    official.entries.forEach((e) => {
      e.pointsAwarded = 0
    })
    const merc = official.entries.find((e) => e.teamId === 'mercedes')!
    const ferr = official.entries.find((e) => e.teamId === 'ferrari')!
    const audi = official.entries.find((e) => e.teamId === 'audi')!

    merc.pointsAwarded = 100
    merc.finalPosition = 1
    ferr.pointsAwarded = 85
    ferr.finalPosition = 2
    audi.pointsAwarded = 62
    audi.finalPosition = 3

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

    const standingsResult = standingsService.calculateStandings({
      raceResults: [],
      playerDrivers: [],
      team: { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' } as any,
      season: { id: 's2026', year: seasonYear, current_round: 1 } as any,
    })

    // Derivar objetivo usando exatamente os campos do MESMO calculateStandings result
    const progress = calculateSeasonObjectiveProgress({
      position: standingsResult.playerConstructorRank,
      points: standingsResult.teamPoints,
      targetRank: 4,
      seasonYear,
      round: 1,
    })

    expect(progress.isMeeting).toBe(true)
    // Com 62 pts e P3, progresso consistente (calculado dinamicamente)
    expect(progress.percentage).toBe(92)
    expect(progress.label).toBe('92% atingido')
  })

  // CI01A2-09: nenhuma posição hardcoded para player team (sem constantes literais P1/P3 no caminho do player)
  it('CI01A2-09: nenhuma posição hardcoded para player team (sem constantes literais P1/P3 no caminho do player)', () => {
    const serviceCode = fs.readFileSync(
      path.resolve(__dirname, '../services/standingsService.ts'),
      'utf-8',
    )

    // O serviço não deve conter fallbacks hardcoded como ': 1' ou ': 3' na atribuição do rank do player
    expect(serviceCode).not.toMatch(/playerConstructorRank\s*:\s*[1-9]\b/)
    expect(serviceCode).not.toMatch(
      /playerConstructorRank\s*:\s*playerTeamRank\s*>\s*0\s*\?\s*playerTeamRank\s*:\s*[1-9]/,
    )
  })

  // CI01A2-10: runtime team ID resolve para a equipe correta no standings (match por isPlayer no snapshot canônico)
  it('CI01A2-10: runtime team ID resolve para a equipe correta no standings (match por isPlayer no snapshot canônico)', () => {
    const careerId = 'career_ci01a2_10'
    const seasonYear = 2026

    let race = initializeStandardRace('audi', 3, careerId, seasonYear, 1)
    race = completeRace(race, 110)
    const official = canonicalRaceResultService.officializeRace(race)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    // Passar o runtime team ID correto
    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      seasonYear,
      undefined,
      'audi',
    )

    const playerTeam = snap.constructorStandings.find((c) => c.isPlayer)
    expect(playerTeam).toBeDefined()
    expect(playerTeam!.teamId).toBe('audi')
    expect(playerTeam!.isPlayer).toBe(true)
  })

  // CI01A2-11: save/reload preserva posição e pontos coerentes (calcular duas vezes sobre o mesmo estado persistido → mesmo resultado)
  it('CI01A2-11: save/reload preserva posição e pontos coerentes (calcular duas vezes sobre o mesmo estado persistido → mesmo resultado)', () => {
    const careerId = 'career_ci01a2_11'
    const seasonYear = 2026

    let race = initializeStandardRace('audi', 3, careerId, seasonYear, 1)
    race = completeRace(race, 111)
    const official = canonicalRaceResultService.officializeRace(race)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const run1 = standingsService.calculateStandings({
      raceResults: [],
      playerDrivers: [],
      team: { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' } as any,
      season: { id: 's2026', year: seasonYear, current_round: 1 } as any,
    })

    const run2 = standingsService.calculateStandings({
      raceResults: [],
      playerDrivers: [],
      team: { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' } as any,
      season: { id: 's2026', year: seasonYear, current_round: 1 } as any,
    })

    expect(run1.playerConstructorRank).toBe(run2.playerConstructorRank)
    expect(run1.teamPoints).toBe(run2.teamPoints)
    expect(run1.playerWins).toBe(run2.playerWins)
    expect(run1.playerPodiums).toBe(run2.playerPodiums)
    expect(run1.constructorStandings).toEqual(run2.constructorStandings)
  })

  // CI01A2-12: player team não recebe tratamento esportivo especial (mesma regra de ordenação/tiebreak que as equipes IA; sem bônus de posição)
  // Verificação canônica pós-build v0.0.728
  it('CI01A2-12: player team não recebe tratamento esportivo especial (mesma regra de ordenação/tiebreak que as equipes IA; sem bônus de posição)', () => {
    const careerId = 'career_ci01a2_12'
    const seasonYear = 2026

    let race = initializeStandardRace('audi', 3, careerId, seasonYear, 1)
    race = completeRace(race, 112)
    const official = canonicalRaceResultService.officializeRace(race)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    // Se player team for Audi:
    const snapAudiPlayer = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      seasonYear,
      undefined,
      'audi',
    )
    // Se player team for Ferrari:
    const snapFerrariPlayer = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      seasonYear,
      undefined,
      'ferrari',
    )

    // A ordem esportiva das equipes é estritamente a mesma independente de quem é o jogador
    for (let i = 0; i < snapAudiPlayer.constructorStandings.length; i++) {
      expect(snapAudiPlayer.constructorStandings[i].teamId).toBe(
        snapFerrariPlayer.constructorStandings[i].teamId,
      )
      expect(snapAudiPlayer.constructorStandings[i].points).toBe(
        snapFerrariPlayer.constructorStandings[i].points,
      )
      expect(snapAudiPlayer.constructorStandings[i].position).toBe(
        snapFerrariPlayer.constructorStandings[i].position,
      )
    }
  })
})
