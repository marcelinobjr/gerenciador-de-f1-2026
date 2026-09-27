import { describe, it } from 'vitest'
import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'
import { DRIVER_CAREER_STATS_2025 } from '@/data/driverCareerStats2025'

describe('temp dump audit', () => {
  it('dumps pilot stats', () => {
    const results: any[] = []
    for (const p of MBJ_2026_PILOTS) {
      const hist = DRIVER_CAREER_STATS_2025[p.id]
      results.push({
        id: p.id,
        name: p.name,
        category: p.category,
        f1Races: p.f1RacesCompleted,
        f1Wins: p.f1Wins,
        f1Poles: p.f1Poles,
        f1Titles: p.f1Titles ?? p.f1Championships,
        inHist: !!hist,
        histRaces: hist?.races,
        histWins: hist?.wins,
        histPoles: hist?.poles,
        histTitles: hist?.championships,
      })
    }
    console.log('PILOTS_COUNT:', results.length)
    console.log('SAMPLE_PILOTS:', JSON.stringify(results.slice(0, 10), null, 2))
    const all = results.map(
      (r) => `${r.id} | ${r.name} | mbjRaces:${r.f1Races} | histRaces:${r.histRaces}`,
    )
    throw new Error(`\nTOTAL: ${results.length}\n` + all.join('\n'))
  })
})
