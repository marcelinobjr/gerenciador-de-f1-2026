import { MBJ_2026_PILOTS } from '../lib/mbj-drivers-data'
import { DRIVER_CAREER_STATS_2025 } from '../data/driverCareerStats2025'

console.log('AUDIT START')
for (const p of MBJ_2026_PILOTS) {
  const inStats = DRIVER_CAREER_STATS_2025[p.id]
  console.log(
    `${p.id}|${p.name}|${p.category}|mbjRaces:${p.f1RacesCompleted ?? 0}|mbjWins:${p.f1Wins ?? 0}|mbjPoles:${p.f1Poles ?? 0}|mbjTitles:${p.f1Titles ?? p.f1Championships ?? 0}|has2025:${!!inStats}|histRaces:${inStats?.races ?? '-'}|histWins:${inStats?.wins ?? '-'}|histPoles:${inStats?.poles ?? '-'}|histTitles:${inStats?.championships ?? '-'}`,
  )
}
