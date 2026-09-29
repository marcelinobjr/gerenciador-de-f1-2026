import { describe, it, expect } from 'vitest'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { CIRCUIT_PERFORMANCE_PROFILES } from '@/data/circuit-performance-profiles'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'

function createMockOfficialGrid(playerTeamId: string): FinalQualifyingGridEntry[] {
  const teams = [
    { id: playerTeamId, name: 'Audi F1 Team', color: '#F50537' },
    { id: 'ferrari', name: 'Scuderia Ferrari', color: '#E8002D' },
    { id: 'mclaren', name: 'McLaren F1 Team', color: '#FF8000' },
    { id: 'mercedes', name: 'Mercedes-AMG Petronas', color: '#27F4D2' },
    { id: 'redbull', name: 'Oracle Red Bull Racing', color: '#3671C6' },
    { id: 'astonmartin', name: 'Aston Martin Aramco', color: '#229971' },
    { id: 'alpine', name: 'BWT Alpine F1 Team', color: '#0093CC' },
    { id: 'williams', name: 'Williams Racing', color: '#64C4FF' },
    { id: 'rb', name: 'Visa Cash App RB', color: '#6692FF' },
    { id: 'haas', name: 'MoneyGram Haas F1 Team', color: '#B6BABD' },
    { id: 'andretti', name: 'Andretti Cadillac F1', color: '#A0A0A0' },
    { id: 'toyota', name: 'Toyota Gazoo Racing', color: '#D40000' },
  ]

  const grid: FinalQualifyingGridEntry[] = []
  let pos = 1
  for (const t of teams) {
    const isPlayer = t.id === playerTeamId
    for (let carNum = 1; carNum <= 2; carNum++) {
      grid.push({
        gridPosition: pos,
        driverId: `drv_${t.id}_car${carNum}`,
        driverName: `Piloto ${carNum} - ${t.name}`,
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

describe('RACE-PROVENANCE-AUDIT-02A2-C1: Micro-auditoria Tabela 24/24 de Voltas', () => {
  it('valida exatamente 24 registros, rounds únicos de 1 a 24, e circuitIds únicos de circuit_01 a circuit_24', () => {
    expect(F1_2026_CALENDAR).toHaveLength(24)
    expect(CIRCUIT_PERFORMANCE_PROFILES).toHaveLength(24)

    const calendarRounds = F1_2026_CALENDAR.map((c) => c.round)
    expect(new Set(calendarRounds).size).toBe(24)
    for (let r = 1; r <= 24; r++) {
      expect(calendarRounds).toContain(r)
    }

    const profileCircuitIds = CIRCUIT_PERFORMANCE_PROFILES.map((p) => p.id)
    expect(new Set(profileCircuitIds).size).toBe(24)
    for (let i = 1; i <= 24; i++) {
      const idStr = `circuit_${String(i).padStart(2, '0')}`
      expect(profileCircuitIds).toContain(idStr)
    }
  })

  it('compara para cada round 1–24: F1_2026_CALENDAR.laps vs CanonicalRaceState.totalLaps (caminho real do motor)', () => {
    const playerTeamId = 'sauber_audi'
    const mockGrid = createMockOfficialGrid(playerTeamId)

    const auditRows: Array<{
      round: number
      gp: string
      circuitId: string
      sourceLaps: number
      engineTotalLaps: number
      fallbackTriggered: boolean
      status: 'MATCH' | 'DIVERGENTE' | 'FALLBACK' | 'AUSENTE'
    }> = []

    for (let round = 1; round <= 24; round++) {
      const gp = F1_2026_CALENDAR.find((c) => c.round === round)
      expect(gp).toBeDefined()
      const profile = CIRCUIT_PERFORMANCE_PROFILES.find((p) => p.round === round)
      expect(profile).toBeDefined()

      const sourceLaps = gp!.laps
      // Validar que o campo da fonte é válido
      expect(typeof sourceLaps).toBe('number')
      expect(Number.isInteger(sourceLaps)).toBe(true)
      expect(sourceLaps).toBeGreaterThan(0)
      expect(isNaN(sourceLaps)).toBe(false)

      // Caminho real reproduzido de WeekendV2Page:
      // totalLaps: gpInfo.laps || 57 passado para initializeRaceFromCanonicalGrid
      const fallbackTriggered = !gp!.laps
      const inputLaps = gp!.laps || 57

      const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId: `audit_c1_career_r${round}`,
        season: 2026,
        round,
        circuitName: gp!.circuit,
        circuitCountry: gp!.country,
        totalLaps: inputLaps,
        playerTeamId,
        canonicalQualifyingGrid: mockGrid,
        persistState: false, // não poluir storage
      })

      const engineTotalLaps = raceState.totalLaps

      let status: 'MATCH' | 'DIVERGENTE' | 'FALLBACK' | 'AUSENTE' = 'DIVERGENTE'
      if (!sourceLaps || !engineTotalLaps) {
        status = 'AUSENTE'
      } else if (fallbackTriggered) {
        status = 'FALLBACK'
      } else if (sourceLaps === engineTotalLaps) {
        status = 'MATCH'
      }

      auditRows.push({
        round,
        gp: gp!.name,
        circuitId: profile!.id,
        sourceLaps,
        engineTotalLaps,
        fallbackTriggered,
        status,
      })
    }

    // Validações estritas dos 24
    expect(auditRows).toHaveLength(24)

    const matchCount = auditRows.filter((r) => r.status === 'MATCH').length
    const divergentCount = auditRows.filter((r) => r.status === 'DIVERGENTE').length
    const fallbackCount = auditRows.filter((r) => r.status === 'FALLBACK').length
    const missingCount = auditRows.filter((r) => r.status === 'AUSENTE').length

    expect(matchCount).toBe(24)
    expect(divergentCount).toBe(0)
    expect(fallbackCount).toBe(0)
    expect(missingCount).toBe(0)

    // Sanity checks específicos obrigatórios
    const bahrain = auditRows.find((r) => r.round === 4)
    expect(bahrain).toBeDefined()
    expect(bahrain?.sourceLaps).toBe(57)
    expect(bahrain?.engineTotalLaps).toBe(57)
    expect(bahrain?.fallbackTriggered).toBe(false)
    expect(bahrain?.status).toBe('MATCH')

    const abuDhabi = auditRows.find((r) => r.round === 24)
    expect(abuDhabi).toBeDefined()
    expect(abuDhabi?.sourceLaps).toBe(58)
    expect(abuDhabi?.engineTotalLaps).toBe(58)
    expect(abuDhabi?.fallbackTriggered).toBe(false)
    expect(abuDhabi?.status).toBe('MATCH')
  })

  it('prova que nenhum fallback 57 é acionado na baseline canônica atual de 24 GPs', () => {
    for (let round = 1; round <= 24; round++) {
      const gp = F1_2026_CALENDAR.find((c) => c.round === round)
      expect(gp).toBeDefined()
      // gpInfo.laps || 57
      const evaluatedLaps = gp!.laps || 57
      expect(evaluatedLaps).toBe(gp!.laps)
      expect(gp!.laps).toBeDefined()
      expect(gp!.laps).not.toBeNull()
      expect(gp!.laps).not.toBe(0)
      expect(Number.isNaN(gp!.laps)).toBe(false)
    }
  })
})
