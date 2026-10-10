// QA canary trigger for FORCE-APPLY-R1-01A
export const QA_CANARY_FORCE_APPLY_R1_01A = true

import { describe, it, expect } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { F1_2026_CALENDAR } from '@/lib/f1-data'

describe('SPRINT-LAPS-UNIFY-01A: Canonical Sprint Laps (1/3 rule)', () => {
  it('calculates 1/3 of main race laps floored (min 1)', () => {
    // China: 56 laps -> 18 laps
    expect(canonicalRaceInitializationService.getCanonicalSprintLaps(56)).toBe(18)
    // Interlagos: 71 laps -> 23 laps
    expect(canonicalRaceInitializationService.getCanonicalSprintLaps(71)).toBe(23)
    // Miami: 57 laps -> 19 laps
    expect(canonicalRaceInitializationService.getCanonicalSprintLaps(57)).toBe(19)
    // Canada: 70 laps -> 23 laps
    expect(canonicalRaceInitializationService.getCanonicalSprintLaps(70)).toBe(23)
    // Silverstone: 52 laps -> 17 laps
    expect(canonicalRaceInitializationService.getCanonicalSprintLaps(52)).toBe(17)
    // Zandvoort: 72 laps -> 24 laps
    expect(canonicalRaceInitializationService.getCanonicalSprintLaps(72)).toBe(24)
    // Marina Bay (Singapore): 62 laps -> 20 laps
    expect(canonicalRaceInitializationService.getCanonicalSprintLaps(62)).toBe(20)
  })

  it('calculateSprintLaps delegates to getCanonicalSprintLaps when mainRaceLaps is passed', () => {
    expect(canonicalRaceInitializationService.calculateSprintLaps(5.451, 100, 56)).toBe(18)
  })
})
