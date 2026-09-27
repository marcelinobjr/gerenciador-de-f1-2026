import { describe, it } from 'vitest'
import fs from 'node:fs'
import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'
import { DRIVER_CAREER_STATS_2025 } from '@/data/driverCareerStats2025'

describe('temp dump audit', () => {
  it('checks all 135 pilots against baseline', () => {
    let withHistoricalMbj = 0
    let withHistoricalDict = 0
    let total = 0

    for (const p of MBJ_2026_PILOTS) {
      total++
      const inStats = DRIVER_CAREER_STATS_2025[p.id]
      const mbjRaces = p.f1RacesCompleted ?? 0
      if (mbjRaces > 0) withHistoricalMbj++
      if (inStats && (inStats.races > 0 || inStats.wins > 0 || inStats.poles > 0 || inStats.championships > 0)) {
        withHistoricalDict++
      }
    }

    fs.writeFileSync('src/data/audit-dump-raw.json', JSON.stringify({
      total,
      withHistoricalMbj,
      withHistoricalDict,
      pilots: MBJ_2026_PILOTS.map(p => {
        const inStats = DRIVER_CAREER_STATS_2025[p.id]
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          f1Races: p.f1RacesCompleted ?? 0,
          f1Wins: p.f1Wins ?? 0,
          f1Poles: p.f1Poles ?? 0,
          f1Titles: p.f1Titles ?? p.f1Championships ?? 0,
          dict: inStats ? { races: inStats.races, wins: inStats.wins, poles: inStats.poles, championships: inStats.championships } : null
        }
      })
    }, null, 2))
  })
})
