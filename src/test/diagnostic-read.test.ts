import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

describe('Diagnostic file inspection', () => {
  it('reads key files to inspect existing implementation', () => {
    const cwd = process.cwd()
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'))

    // Check files related to race qualifying
    const serviceFiles = [
      'src/services/raceQualifyingService.ts',
      'src/services/canonicalQualifyingRunner.ts',
      'src/services/canonicalQualifyingPersistenceService.ts',
      'src/lib/race/pureRaceEngine.ts',
      'src/types/canonical-qualifying-types.ts',
      'src/test/weekend-v2-qualifying-flow.test.ts',
      'src/pages/WeekendV2Page.tsx',
    ]

    const summaries: Record<string, any> = {}
    for (const f of serviceFiles) {
      const full = path.join(cwd, f)
      if (fs.existsSync(full)) {
        const content = fs.readFileSync(full, 'utf8')
        summaries[f] = {
          exists: true,
          lines: content.split('\n').length,
          preview: content.slice(0, 300),
        }
      } else {
        summaries[f] = { exists: false }
      }
    }

    let gitHead = ''
    try {
      gitHead = fs.readFileSync(path.join(cwd, '.git/HEAD'), 'utf8').trim()
      if (gitHead.startsWith('ref:')) {
        const refPath = gitHead.replace('ref:', '').trim()
        const fullRef = path.join(cwd, '.git', refPath)
        if (fs.existsSync(fullRef)) {
          gitHead += ' -> ' + fs.readFileSync(fullRef, 'utf8').trim()
        }
      }
    } catch {
      /* intentionally ignored */
    }

    expect({
      version: pkg.version,
      head: gitHead,
      summaries,
    }).toBeNull()
  })
})
