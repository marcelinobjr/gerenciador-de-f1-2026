import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { driverBase2026Service } from '@/services/driverBase2026Service'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'

/**
 * Fixture de gerador determinístico de grid oficial P1–P24
 * Suporta qualquer equipe como playerTeamId dinamicamente
 */
function createMockQualifyingGrid(playerTeamId: string): FinalQualifyingGridEntry[] {
  const teams = [
    { id: playerTeamId, name: 'Player Custom Racing', color: '#FF1801' },
    { id: 'ferrari', name: 'Scuderia Ferrari', color: '#DC0000' },
    { id: 'red_bull', name: 'Red Bull Racing', color: '#1E41FF' },
    { id: 'mercedes', name: 'Mercedes-AMG F1', color: '#00D2BE' },
    { id: 'mclaren', name: 'McLaren F1 Team', color: '#FF8700' },
    { id: 'aston_martin', name: 'Aston Martin F1', color: '#006F62' },
    { id: 'alpine', name: 'Alpine F1 Team', color: '#0090FF' },
    { id: 'williams', name: 'Williams Racing', color: '#005AFF' },
    { id: 'racing_bulls', name: 'Visa Cash App RB', color: '#6692FF' },
    { id: 'sauber_audi', name: 'Audi Revolut F1 Team', color: '#C0C0C0' },
    { id: 'haas', name: 'Haas F1 Team', color: '#B6BABD' },
    { id: 'cadillac', name: 'Cadillac F1 Team', color: '#FFD700' },
  ]

  const grid: FinalQualifyingGridEntry[] = []

  // 12 equipes x 2 pilotos = 24 posições contínuas P1 a P24
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

describe('FW2.1E-A: RACE INITIALIZATION & BASE 2026 IMMUTABILITY SUITE', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // (1) corrida inicia com exatamente 24 pilotos
  it('PROVA 1: Corrida inicia com exatamente 24 pilotos', () => {
    const playerTeamId = 'team_player_dynamic_01'
    const mockGrid = createMockQualifyingGrid(playerTeamId)

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_test_01',
      season: 2026,
      round: 1,
      circuitName: 'Sakhir',
      circuitCountry: 'Bahrain',
      totalLaps: 57,
      playerTeamId,
      canonicalQualifyingGrid: mockGrid,
    })

    expect(raceState.drivers).toHaveLength(24)
    expect(Object.keys(raceState.driverLookup)).toHaveLength(24)
  })

  // (2) 24 "driverId" únicos
  it('PROVA 2: Exatamente 24 driverIds únicos sem duplicatas', () => {
    const playerTeamId = 'team_player_unique_ids'
    const mockGrid = createMockQualifyingGrid(playerTeamId)

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_test_02',
      season: 2026,
      round: 1,
      circuitName: 'Sakhir',
      circuitCountry: 'Bahrain',
      totalLaps: 57,
      playerTeamId,
      canonicalQualifyingGrid: mockGrid,
    })

    const ids = raceState.drivers.map((d) => d.driverId)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(24)
  })

  // (3) P1–P24 preservados
  it('PROVA 3: Posições P1–P24 rigorosamente contínuas e preservadas do grid oficial', () => {
    const playerTeamId = 'team_test_grid_continuity'
    const mockGrid = createMockQualifyingGrid(playerTeamId)

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_test_03',
      season: 2026,
      round: 1,
      circuitName: 'Jeddah',
      circuitCountry: 'Saudi Arabia',
      totalLaps: 50,
      playerTeamId,
      canonicalQualifyingGrid: mockGrid,
    })

    raceState.drivers.forEach((driver, idx) => {
      const expectedPos = idx + 1
      expect(driver.gridPosition).toBe(expectedPos)
      expect(driver.currentPosition).toBe(expectedPos)
    })
  })

  // (4) os pilotos são exatamente os classificados
  it('PROVA 4: Os pilotos na largada são exatamente os classificados no grid oficial (mesmos driverIds)', () => {
    const playerTeamId = 'team_test_driver_parity'
    const mockGrid = createMockQualifyingGrid(playerTeamId)

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_test_04',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park',
      circuitCountry: 'Australia',
      totalLaps: 58,
      playerTeamId,
      canonicalQualifyingGrid: mockGrid,
    })

    const expectedDriverIds = mockGrid.map((g) => g.driverId)
    const actualDriverIds = raceState.drivers.map((d) => d.driverId)

    expect(actualDriverIds).toEqual(expectedDriverIds)
  })

  // (5) existem exatamente dois pilotos da equipe escolhida pelo jogador
  it('PROVA 5: Existem exatamente dois pilotos da equipe escolhida pelo jogador', () => {
    const playerTeamId = 'my_custom_championship_team'
    const mockGrid = createMockQualifyingGrid(playerTeamId)

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_test_05',
      season: 2026,
      round: 2,
      circuitName: 'Suzuka',
      circuitCountry: 'Japan',
      totalLaps: 53,
      playerTeamId,
      canonicalQualifyingGrid: mockGrid,
    })

    const playerDrivers = raceState.drivers.filter((d) => d.isPlayer || d.teamId === playerTeamId)
    expect(playerDrivers).toHaveLength(2)

    // Os outros 22 são rivais
    const rivalDrivers = raceState.drivers.filter((d) => !d.isPlayer && d.teamId !== playerTeamId)
    expect(rivalDrivers).toHaveLength(22)
  })

  // (6) funciona com Audi como playerTeam
  it('PROVA 6: Funciona dinamicamente quando Audi é a equipe do jogador', () => {
    const playerTeamId = 'sauber_audi'
    const mockGrid = createMockQualifyingGrid(playerTeamId)

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_audi_save',
      season: 2026,
      round: 3,
      circuitName: 'Miami',
      circuitCountry: 'USA',
      totalLaps: 57,
      playerTeamId,
      canonicalQualifyingGrid: mockGrid,
    })

    const playerDrivers = raceState.drivers.filter((d) => d.isPlayer)
    expect(playerDrivers).toHaveLength(2)
    expect(playerDrivers.every((d) => d.teamId === 'sauber_audi')).toBe(true)
  })

  // (7) funciona com outra equipe como playerTeam (ex: Ferrari, Williams ou Custom)
  it('PROVA 7: Funciona dinamicamente quando Ferrari ou Williams é a equipe do jogador', () => {
    const ferrariTeamId = 'ferrari'
    const ferrariGrid = createMockQualifyingGrid(ferrariTeamId)

    const ferrariRace = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_ferrari_save',
      season: 2026,
      round: 4,
      circuitName: 'Monaco',
      circuitCountry: 'Monaco',
      totalLaps: 78,
      playerTeamId: ferrariTeamId,
      canonicalQualifyingGrid: ferrariGrid,
    })

    const ferrariDrivers = ferrariRace.drivers.filter((d) => d.isPlayer)
    expect(ferrariDrivers).toHaveLength(2)
    expect(ferrariDrivers.every((d) => d.teamId === 'ferrari')).toBe(true)

    // Teste alternativo: Williams
    const williamsTeamId = 'williams'
    const williamsGrid = createMockQualifyingGrid(williamsTeamId)

    const williamsRace = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_williams_save',
      season: 2026,
      round: 5,
      circuitName: 'Silverstone',
      circuitCountry: 'UK',
      totalLaps: 52,
      playerTeamId: williamsTeamId,
      canonicalQualifyingGrid: williamsGrid,
    })

    const williamsDrivers = williamsRace.drivers.filter((d) => d.isPlayer)
    expect(williamsDrivers).toHaveLength(2)
    expect(williamsDrivers.every((d) => d.teamId === 'williams')).toBe(true)
  })

  // (8) nenhuma regra de negócio depende da Audi
  it('PROVA 8: Nenhuma regra de negócio depende de ID estático ou hardcode da Audi', () => {
    const arbitraryTeamId = 'andretti_global_f1_custom_id'
    const customGrid = createMockQualifyingGrid(arbitraryTeamId)

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_custom_arbitrary',
      season: 2026,
      round: 1,
      circuitName: 'Interlagos',
      circuitCountry: 'Brazil',
      totalLaps: 71,
      playerTeamId: arbitraryTeamId,
      canonicalQualifyingGrid: customGrid,
    })

    expect(raceState.playerTeamId).toBe(arbitraryTeamId)
    const playerDrivers = raceState.drivers.filter((d) => d.isPlayer)
    expect(playerDrivers).toHaveLength(2)
    expect(playerDrivers[0].teamId).toBe(arbitraryTeamId)
    expect(playerDrivers[1].teamId).toBe(arbitraryTeamId)
  })

  // (9) Invariante do Estado Canônico Único: campos mínimos exigidos
  it('PROVA 9: Cada carro/piloto possui todos os campos mínimos canônicos', () => {
    const playerTeamId = 'team_player_fields'
    const mockGrid = createMockQualifyingGrid(playerTeamId)

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_fields_01',
      season: 2026,
      round: 1,
      circuitName: 'Monza',
      circuitCountry: 'Italy',
      totalLaps: 53,
      playerTeamId,
      canonicalQualifyingGrid: mockGrid,
    })

    for (const d of raceState.drivers) {
      expect(d.careerId).toBe('career_fields_01')
      expect(d.season).toBe(2026)
      expect(typeof d.raceId).toBe('string')
      expect(typeof d.driverId).toBe('string')
      expect(typeof d.teamId).toBe('string')
      expect(d.gridPosition).toBeGreaterThanOrEqual(1)
      expect(d.gridPosition).toBeLessThanOrEqual(24)
      expect(d.currentPosition).toBe(d.gridPosition)
      expect(d.lap).toBe(0)
      expect(d.raceTime).toBe(0)
      expect(typeof d.gap).toBe('string')
      expect(typeof d.tyreCompound).toBe('string')
      expect(d.tyreAge).toBe(0)
      expect(d.fuel).toBe(100)
      expect(d.carCondition).toBe(100)
      expect(d.raceStatus).toBe('racing')
      expect(d.pitStops).toBe(0)
    }
  })

  // (10) Imutabilidade da Base Original 2026
  it('PROVA 10: drivers_base_2026 é imutável durante o gameplay', () => {
    const baseVerstappen = driverBase2026Service.getBaseDriver2026('mbj-001')
    expect(baseVerstappen).not.toBeNull()
    expect(baseVerstappen?.f1Wins).toBe(63)

    // Tentativa de escrita direta em propriedade deve falhar ou ser congelada
    expect(() => {
      ;(baseVerstappen as any).f1Wins = 999
    }).toThrow()

    // O valor na base continua idêntico
    const reloaded = driverBase2026Service.getBaseDriver2026('mbj-001')
    expect(reloaded?.f1Wins).toBe(63)
  })

  // (11) Duas carreiras independentes usando a mesma base 2026
  it('PROVA 11: Duas carreiras diferentes evoluem independentemente a partir da base 2026', () => {
    const careerA = 'career_save_alfa'
    const careerB = 'career_save_beta'

    driverBase2026Service.initializeCareerDrivers({
      careerId: careerA,
      playerTeamId: 'sauber_audi',
    })
    driverBase2026Service.initializeCareerDrivers({
      careerId: careerB,
      playerTeamId: 'ferrari',
    })

    // Carreira A: Max vence 2 GPs
    driverBase2026Service.updateCareerDriverStats({
      careerId: careerA,
      driverId: 'mbj-001',
      deltaGps: 2,
      deltaWins: 2,
    })

    // Carreira B: Hamilton vence 1 GP
    driverBase2026Service.updateCareerDriverStats({
      careerId: careerB,
      driverId: 'mbj-003',
      deltaGps: 1,
      deltaWins: 1,
    })

    const verstappenA = driverBase2026Service.getCareerDriver(careerA, 'mbj-001')
    const verstappenB = driverBase2026Service.getCareerDriver(careerB, 'mbj-001')

    expect(verstappenA?.stats.careerWins).toBe(65) // 63 base + 2
    expect(verstappenB?.stats.careerWins).toBe(63) // 63 base + 0 (intacto em B)

    // Base original 2026 permanece 63 inalterada
    const baseOriginal = driverBase2026Service.getBaseDriver2026('mbj-001')
    expect(baseOriginal?.f1Wins).toBe(63)
  })
})
