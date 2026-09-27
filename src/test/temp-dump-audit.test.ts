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
    const diffs: any[] = []
    for (const p of MBJ_2026_PILOTS) {
      const inStats = DRIVER_CAREER_STATS_2025[p.id]
      const mbjRaces = p.f1RacesCompleted ?? 0
      const mbjWins = p.f1Wins ?? 0
      const mbjPoles = p.f1Poles ?? 0
      const mbjTitles = p.f1Titles ?? (p as any).f1Championships ?? 0

      const statRaces = inStats?.races ?? 0
      const statWins = inStats?.wins ?? 0
      const statPoles = inStats?.poles ?? 0
      const statTitles = inStats?.championships ?? 0

      if (!inStats) {
        if (mbjRaces > 0 || mbjWins > 0 || mbjPoles > 0 || mbjTitles > 0) {
          diffs.push({
            id: p.id,
            name: p.name,
            reason: 'missing_in_stats_but_mbj_has_values',
            mbj: { races: mbjRaces, wins: mbjWins, poles: mbjPoles, titles: mbjTitles },
            stats: null,
          })
        }
      } else {
        if (
          mbjRaces !== statRaces ||
          mbjWins !== statWins ||
          mbjPoles !== statPoles ||
          mbjTitles !== statTitles
        ) {
          diffs.push({
            id: p.id,
            name: p.name,
            reason: 'divergence',
            mbj: { races: mbjRaces, wins: mbjWins, poles: mbjPoles, titles: mbjTitles },
            stats: { races: statRaces, wins: statWins, poles: statPoles, titles: statTitles },
          })
        }
      }
    }
    const lines = diffs.map((d) => JSON.stringify(d))
    // Escrever diffs em um arquivo para lermos com read_file
    fs.writeFileSync(path.resolve(process.cwd(), 'temp-audit-diffs.json'), JSON.stringify(diffs, null, 2), 'utf-8')
    expect(`COUNT_${diffs.length}__\n` + lines.join('\n')).toBe('COUNT_DUMP_WRITTEN')
  })
})
