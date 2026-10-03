import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'

describe('probe fs', () => {
  it('reads src directory', () => {
    const findFiles = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      let results: string[] = []
      for (const entry of entries) {
        const full = `${dir}/${entry.name}`
        if (entry.isDirectory()) {
          results = results.concat(findFiles(full))
        } else {
          results.push(full)
        }
      }
      return results
    }
    const all = findFiles('src')
    const matched = all.filter(
      (f) =>
        !f.includes('__tests__') &&
        (f.toLowerCase().includes('sprint') ||
          f.toLowerCase().includes('weekend') ||
          f.toLowerCase().includes('stepper') ||
          f.toLowerCase().includes('session')),
    )
    expect(matched.length).toBe(-1) // will fail and show matched in error message
  })
})
