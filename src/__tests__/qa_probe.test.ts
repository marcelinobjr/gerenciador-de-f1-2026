import { describe, it } from 'vitest'
import * as fs from 'node:fs'

describe('QA Probe', () => {
  it('finds references', () => {
    const list: string[] = []
    function walk(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = `${dir}/${entry.name}`
        if (entry.isDirectory()) {
          if (!full.includes('node_modules') && !full.includes('.git') && !full.includes('dist')) {
            walk(full)
          }
        } else {
          list.push(full)
        }
      }
    }
    walk('src')
    const matches: string[] = []
    for (const f of list) {
      if (f.endsWith('.ts') || f.endsWith('.tsx')) {
        const content = fs.readFileSync(f, 'utf-8')
        if (
          content.includes('allocateGeneratedPortraitProfile') ||
          content.includes('sanitizeDriverProceduralData') ||
          content.includes('GENERATED_DRIVER_MALE_INDICES')
        ) {
          matches.push(f)
        }
      }
    }
    throw new Error('MATCHES: ' + JSON.stringify(matches))
  })
})
