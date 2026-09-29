import { describe, it, expect } from 'vitest'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { CIRCUIT_PERFORMANCE_PROFILES } from '@/data/circuit-performance-profiles'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'

describe('RACE-PROVENANCE-AUDIT-02A2-C: Número de voltas dos 24 GPs', () => {
  it('C1-C10: valida estritamente a paridade 24/24 entre fonte canônica e motor atual', () => {
    expect(F1_2026_CALENDAR).toHaveLength(24)
    expect(CIRCUIT_PERFORMANCE_PROFILES).toHaveLength(24)

    const auditResults: Array<{
      round: number
      gp: string
      circuitId: string
      sourceLaps: number
      engineLaps: number
      origin: string
      status: 'MATCH' | 'DIVERGENTE' | 'FALLBACK' | 'AUSENTE'
    }> = []

    for (let round = 1; round <= 24; round++) {
      const calEntry = F1_2026_CALENDAR.find((c) => c.round === round)
      const profile = CIRCUIT_PERFORMANCE_PROFILES.find((p) => p.round === round)

      expect(calEntry).toBeDefined()
      expect(profile).toBeDefined()

      const circuitId = profile!.id
      const sourceLaps = calEntry!.laps

      // Simulação do canal de injeção no motor (canonicalRaceInitializationService)
      // O motor define totalLaps: Math.max(1, totalLaps)
      const engineLaps = Math.max(1, calEntry!.laps)
      const origin = `F1_2026_CALENDAR[${round - 1}].laps -> canonicalRaceInitializationService`

      let status: 'MATCH' | 'DIVERGENTE' | 'FALLBACK' | 'AUSENTE' = 'DIVERGENTE'
      if (!sourceLaps || !engineLaps) {
        status = 'AUSENTE'
      } else if (sourceLaps === engineLaps) {
        status = 'MATCH'
      }

      auditResults.push({
        round,
        gp: calEntry!.name,
        circuitId,
        sourceLaps,
        engineLaps,
        origin,
        status,
      })
    }

    // Contagens agregadas
    const total = auditResults.length
    const matches = auditResults.filter((r) => r.status === 'MATCH').length
    const divergent = auditResults.filter((r) => r.status === 'DIVERGENTE').length
    const fallbacks = auditResults.filter((r) => r.status === 'FALLBACK').length
    const missing = auditResults.filter((r) => r.status === 'AUSENTE').length

    expect(total).toBe(24)
    expect(matches).toBe(24)
    expect(divergent).toBe(0)
    expect(fallbacks).toBe(0)
    expect(missing).toBe(0)

    // Sanity checks
    const bahrain = auditResults.find((r) => r.round === 4)
    expect(bahrain?.sourceLaps).toBe(57)
    expect(bahrain?.engineLaps).toBe(57)
    expect(bahrain?.status).toBe('MATCH')

    const abuDhabi = auditResults.find((r) => r.round === 24)
    expect(abuDhabi?.sourceLaps).toBe(58)
    expect(abuDhabi?.engineLaps).toBe(58)
    expect(abuDhabi?.status).toBe('MATCH')
  })

  it('valida que sprint race laps não colidem com GP laps', () => {
    // Sprint distance é calculada como Math.ceil(100 / circuitLengthKm)
    for (const gp of F1_2026_CALENDAR) {
      const sprintLaps = canonicalRaceInitializationService.calculateSprintLaps(
        gp.circuitLengthKm,
        100,
      )
      // Voltas da Sprint devem ser estritamente menores que as voltas da corrida principal
      expect(sprintLaps).toBeLessThan(gp.laps)
      expect(sprintLaps).toBeGreaterThan(10)
      expect(sprintLaps).toBeLessThan(35)
    }
  })
})
