import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('examine codebase for initialization and Doohan', () => {
  it('checks Doohan and Andretti initialization', () => {
    // 1. Check canonical-driver-database.ts
    const cdbPath = path.resolve('src/lib/canonical-driver-database.ts')
    const cdb = fs.readFileSync(cdbPath, 'utf-8')
    const doohanMatchesCdb = cdb
      .split('\n')
      .filter((l) => l.includes('Doohan') || l.includes('mbj-012') || l.includes('DRV_'))

    // 2. Search for where Official Grid Teams or Andretti are used in career creation / initialization
    const files = [
      'src/components/lobby/StepOfficialTeamSelection.tsx',
      'src/components/lobby/StepReview.tsx',
      'src/services/careerInitializationService.ts',
      'src/services/careerService.ts',
      'src/services/driverService.ts',
      'src/services/driverBase2026Service.ts',
      'src/lib/grid-teams-database.ts',
      'src/lib/f1-data.ts',
      'src/lib/mbj-drivers-data.ts',
    ]

    const report: Record<string, any> = {}
    report['doohan_in_cdb'] = doohanMatchesCdb.slice(0, 10)

    for (const f of files) {
      const p = path.resolve(f)
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8')
        report[f] = {
          hasAndretti: content.includes('andretti') || content.includes('Andretti'),
          hasHerta: content.includes('Herta') || content.includes('mbj-033'),
          hasDoohan: content.includes('Doohan') || content.includes('mbj-012'),
          hasDrugovich: content.includes('Drugovich') || content.includes('mbj-032'),
        }
      } else {
        report[f] = 'FILE_NOT_FOUND'
      }
    }

    // Also look for career initialization files under src/services or src/lib
    const allServices = fs.readdirSync(path.resolve('src/services'))
    report['career_services'] = allServices.filter(
      (s) =>
        s.toLowerCase().includes('career') ||
        s.toLowerCase().includes('init') ||
        s.toLowerCase().includes('team') ||
        s.toLowerCase().includes('season'),
    )

    // Let's assert false with JSON to see in vitest output!
    expect(JSON.stringify(report, null, 2)).toBe('')
  })
})
