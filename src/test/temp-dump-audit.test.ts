import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'
import { DRIVER_CAREER_STATS_2025 } from '@/data/driverCareerStats2025'

describe('temp dump audit', () => {
  it('checks all 135 pilots against baseline', () => {
    const data = {
      total: MBJ_2026_PILOTS.length,
      pilots: MBJ_2026_PILOTS.map((p) => {
        const inStats = DRIVER_CAREER_STATS_2025[p.id]
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          mbj: {
            races: p.f1RacesCompleted ?? 0,
            wins: p.f1Wins ?? 0,
            poles: p.f1Poles ?? 0,
            championships: p.f1Championships ?? (p as any).f1Titles ?? 0,
          },
          dict: inStats
            ? {
                races: inStats.races,
                wins: inStats.wins,
                poles: inStats.poles,
                championships: inStats.championships,
              }
            : null,
        }
      }),
    }
    const allDump = MBJ_2026_PILOTS.map((p) => {
      const inStats = DRIVER_CAREER_STATS_2025[p.id]
      return `${p.id}#${p.name}#${p.f1RacesCompleted ?? 0}#${inStats ? `${inStats.races}` : 'NONE'}`
    }).join(';')
    expect(allDump.substring(0, 50)).toBe('DUMP_FAIL')
  })
})
