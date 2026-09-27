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
    const resolvedPath = path.resolve(process.cwd(), 'src/data/audit-dump-raw.json')
    fs.writeFileSync(resolvedPath, JSON.stringify(data, null, 2), 'utf-8')
    expect(fs.existsSync(resolvedPath)).toBe(true)
    const withRaces = MBJ_2026_PILOTS.filter((p) => (p.f1RacesCompleted ?? 0) > 0).map(
      (p) => `${p.id}:${p.name}:${p.f1RacesCompleted}`,
    )
    expect(withRaces).toEqual(['SHOULD_FAIL_TO_SHOW_ARRAY'])
  })
})
