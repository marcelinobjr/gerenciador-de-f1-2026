import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveCanonicalCareerId } from '@/lib/canonical-career-id'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { canonicalChampionshipMigrationService } from '@/services/canonicalChampionshipMigrationService'
import { calculateStandings } from '@/services/standingsService'
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

describe('PARTE A & B: MICRO-PATCH BUG-01 — TESTES BUG1-01 a BUG1-08', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('BUG1-01: novo race_result usa careerId canônico', () => {
    const season = { id: 'season_2026', career_id: 'canonical_career_99', year: 2026 }
    const team = { id: 'team_player_123', name: 'Escuderia Brasil' }

    const canonicalId = resolveCanonicalCareerId(season, team)
    expect(canonicalId).toBe('canonical_career_99')

    const state = createMockFinishedRaceState({
      careerId: canonicalId,
      season: 2026,
      round: 1,
    })

    const official = canonicalRaceResultService.officializeRace(state)
    expect(official.careerId).toBe('canonical_career_99')

    const persisted = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    expect(persisted.success).toBe(true)
    expect(persisted.journal.careerId).toBe('canonical_career_99')
    expect(persisted.persistedResult?.careerId).toBe('canonical_career_99')

    // Deve estar acessível sob o canonicalCareerId
    const stored = canonicalCareerPersistenceService.getPersistedRaceResult(
      'canonical_career_99',
      2026,
      1,
    )
    expect(stored).not.toBeNull()
    expect(stored?.careerId).toBe('canonical_career_99')
  })

  it('BUG1-02: team.id !== season.career_id não quebra agregação', () => {
    const season = { id: 'season_2026', career_id: 'real_career_f1', year: 2026 }
    const team = { id: 'team_divergent_abc', name: 'Escuderia Brasil' }

    const canonicalCareerId = resolveCanonicalCareerId(season, team)
    expect(canonicalCareerId).toBe('real_career_f1')

    const state = createMockFinishedRaceState({
      careerId: canonicalCareerId,
      season: 2026,
      round: 1,
    })

    const official = canonicalRaceResultService.officializeRace(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    // standingsService chamado passando team divergente e season com career_id
    const standings = calculateStandings({
      raceResults: [],
      playerDrivers: [
        { id: 'drv_player_1', name: 'Gabriel Bortoleto', nationality: 'Brasil' } as any,
        { id: 'drv_player_2', name: 'Felipe Drugovich', nationality: 'Brasil' } as any,
      ],
      team: team as any,
      season: season as any,
    })

    expect(standings.driverStandings.length).toBeGreaterThan(0)
    const bortoleto = standings.driverStandings.find((d) => d.id === 'drv_player_1')
    expect(bortoleto?.points).toBe(25)
    expect(standings.teamPoints).toBe(43) // 25 (P1) + 18 (P2)
  })

  it('BUG1-03: R1=25 + R2=18 -> 43 (não 18, não 25, não substitui)', () => {
    const careerId = 'career_accum_01'
    const seasonYear = 2026

    // R1: Bortoleto P1 = 25 pts
    const stateR1 = createMockFinishedRaceState({ careerId, season: seasonYear, round: 1 })
    const officialR1 = canonicalRaceResultService.officializeRace(stateR1)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialR1)

    // Snapshot R1
    const snapR1 = canonicalChampionshipService.getChampionshipStandings(careerId, seasonYear, 1)
    const bortoletoR1 = snapR1.driverStandings.find((d) => d.driverId === 'drv_player_1')
    expect(bortoletoR1?.points).toBe(25)

    // R2: Bortoleto P2 = 18 pts
    const stateR2 = createMockFinishedRaceState({ careerId, season: seasonYear, round: 2 })
    // Inverter posições: Bortoleto P2 (18 pts), Drugovich P1 (25 pts)
    stateR2.drivers[0].currentPosition = 2
    stateR2.drivers[0].gridPosition = 2
    stateR2.drivers[1].currentPosition = 1
    stateR2.drivers[1].gridPosition = 1

    const officialR2 = canonicalRaceResultService.officializeRace(stateR2)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialR2)

    // Snapshot após R2
    const snapR2 = canonicalChampionshipService.getChampionshipStandings(careerId, seasonYear, 2)
    const bortoletoR2 = snapR2.driverStandings.find((d) => d.driverId === 'drv_player_1')
    expect(bortoletoR2?.points).toBe(43) // 25 + 18 = 43

    const drugovichR2 = snapR2.driverStandings.find((d) => d.driverId === 'drv_player_2')
    expect(drugovichR2?.points).toBe(43) // 18 + 25 = 43
  })

  it('BUG1-04: R3 acumula sobre R1+R2', () => {
    const careerId = 'career_accum_02'
    const seasonYear = 2026

    // R1: P1 (25)
    const s1 = createMockFinishedRaceState({ careerId, season: seasonYear, round: 1 })
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(
      canonicalRaceResultService.officializeRace(s1),
    )

    // R2: P2 (18)
    const s2 = createMockFinishedRaceState({ careerId, season: seasonYear, round: 2 })
    s2.drivers[0].currentPosition = 2
    s2.drivers[1].currentPosition = 1
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(
      canonicalRaceResultService.officializeRace(s2),
    )

    // R3: P3 (15 pts para Bortoleto)
    const s3 = createMockFinishedRaceState({ careerId, season: seasonYear, round: 3 })
    s3.drivers[0].currentPosition = 3
    s3.drivers[1].currentPosition = 4
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(
      canonicalRaceResultService.officializeRace(s3),
    )

    const snapR3 = canonicalChampionshipService.getChampionshipStandings(careerId, seasonYear, 3)
    const bortoleto = snapR3.driverStandings.find((d) => d.driverId === 'drv_player_1')
    expect(bortoleto?.points).toBe(58) // 25 + 18 + 15 = 58
  })

  it('BUG1-05: construtores acumulam os dois carros em múltiplas rodadas', () => {
    const careerId = 'career_constructors_01'
    const seasonYear = 2026

    // R1: Carro 1 = P1 (25), Carro 2 = P2 (18) -> total equipe = 43
    const s1 = createMockFinishedRaceState({ careerId, season: seasonYear, round: 1 })
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(
      canonicalRaceResultService.officializeRace(s1),
    )

    // R2: Carro 1 = P2 (18), Carro 2 = P3 (15) -> total equipe = 33 -> acumula 43 + 33 = 76
    const s2 = createMockFinishedRaceState({ careerId, season: seasonYear, round: 2 })
    s2.drivers[0].currentPosition = 2
    s2.drivers[1].currentPosition = 3
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(
      canonicalRaceResultService.officializeRace(s2),
    )

    const snap = canonicalChampionshipService.getChampionshipStandings(careerId, seasonYear, 2)
    const escuderia = snap.constructorStandings.find((c) => c.teamId === 'escuderia_brasil')
    expect(escuderia?.points).toBe(76)
  })

  it('BUG1-06: snapshot histórico R1 permanece congelado e intacto após R2', () => {
    const careerId = 'career_frozen_snap'
    const seasonYear = 2026

    const s1 = createMockFinishedRaceState({ careerId, season: seasonYear, round: 1 })
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(
      canonicalRaceResultService.officializeRace(s1),
    )

    const snapR1Before = canonicalChampionshipService.getSnapshot(careerId, seasonYear, 1)
    expect(snapR1Before).not.toBeNull()
    const p1Before = snapR1Before?.driverStandings.find(
      (d) => d.driverId === 'drv_player_1',
    )?.points
    expect(p1Before).toBe(25)

    // Registra R2
    const s2 = createMockFinishedRaceState({ careerId, season: seasonYear, round: 2 })
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(
      canonicalRaceResultService.officializeRace(s2),
    )

    // Snapshot R1 continua inalterado com 25 pontos
    const snapR1After = canonicalChampionshipService.getSnapshot(careerId, seasonYear, 1)
    const p1After = snapR1After?.driverStandings.find((d) => d.driverId === 'drv_player_1')?.points
    expect(p1After).toBe(25)

    // Já snapshot R2 tem o acumulado de 50
    const snapR2 = canonicalChampionshipService.getSnapshot(careerId, seasonYear, 2)
    const p1R2 = snapR2?.driverStandings.find((d) => d.driverId === 'drv_player_1')?.points
    expect(p1R2).toBe(50)
  })

  it('BUG1-07: legado salvo com team.id é reconciliado com careerId canônico', () => {
    const legacyTeamId = 'legacy_team_brasil'
    const canonicalCareerId = 'canonical_career_brasil'
    const seasonYear = 2026

    // Criar resultado sob a chave antiga de team.id
    const stateLegacy = createMockFinishedRaceState({
      careerId: legacyTeamId,
      season: seasonYear,
      round: 1,
    })
    const officialLegacy = canonicalRaceResultService.officializeRace(stateLegacy)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialLegacy)

    // Verificar que inicialmente o canonicalCareerId não tem resultados
    const before = canonicalChampionshipService.getEligibleOfficialRaceResults(
      canonicalCareerId,
      seasonYear,
    )
    expect(before.length).toBe(0)

    // Executar reconciliação
    const report = canonicalChampionshipMigrationService.reconcileLegacyCareerResults({
      canonicalCareerId,
      legacyCareerIds: [legacyTeamId],
      seasonYear,
    })

    expect(report.reconciledRounds).toContain(1)

    // Agora o canonicalCareerId tem o resultado da rodada 1
    const after = canonicalChampionshipService.getEligibleOfficialRaceResults(
      canonicalCareerId,
      seasonYear,
    )
    expect(after.length).toBe(1)
    expect(after[0].careerId).toBe(canonicalCareerId)

    const snap = canonicalChampionshipService.getChampionshipStandings(
      canonicalCareerId,
      seasonYear,
      1,
    )
    const driver = snap.driverStandings.find((d) => d.driverId === 'drv_player_1')
    expect(driver?.points).toBe(25)
  })

  it('BUG1-08: reconciliação é idempotente e não duplica pontos nem resultados', () => {
    const legacyTeamId = 'legacy_team_idemp'
    const canonicalCareerId = 'canonical_career_idemp'
    const seasonYear = 2026

    const state = createMockFinishedRaceState({
      careerId: legacyTeamId,
      season: seasonYear,
      round: 1,
    })
    const official = canonicalRaceResultService.officializeRace(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    // 1ª Execução
    const rep1 = canonicalChampionshipMigrationService.reconcileLegacyCareerResults({
      canonicalCareerId,
      legacyCareerIds: [legacyTeamId],
      seasonYear,
    })
    expect(rep1.reconciledRounds).toContain(1)

    // 2ª Execução
    const rep2 = canonicalChampionshipMigrationService.reconcileLegacyCareerResults({
      canonicalCareerId,
      legacyCareerIds: [legacyTeamId],
      seasonYear,
    })
    expect(rep2.alreadyCanonicalRounds).toContain(1)
    expect(rep2.reconciledRounds.length).toBe(0)

    // 3ª Execução
    const rep3 = canonicalChampionshipMigrationService.reconcileLegacyCareerResults({
      canonicalCareerId,
      legacyCareerIds: [legacyTeamId],
      seasonYear,
    })
    expect(rep3.alreadyCanonicalRounds).toContain(1)

    const eligible = canonicalChampionshipService.getEligibleOfficialRaceResults(
      canonicalCareerId,
      seasonYear,
    )
    expect(eligible.length).toBe(1) // Continua sendo 1 resultado, não duplicou

    const snap = canonicalChampionshipService.getChampionshipStandings(
      canonicalCareerId,
      seasonYear,
      1,
    )
    const driver = snap.driverStandings.find((d) => d.driverId === 'drv_player_1')
    expect(driver?.points).toBe(25) // Não duplicou para 50 nem 75
  })
})
