import { describe, it, expect } from 'vitest'
import * as fs from 'fs'

describe('audit-probe-practice', () => {
  it('dump practice and tracks info', () => {
    const practiceService = fs.readFileSync('src/services/practiceSessionService.ts', 'utf-8')
    const practiceRunner = fs.readFileSync('src/services/canonicalPracticeRunner.ts', 'utf-8')
    const weekendPersistence = fs.readFileSync(
      'src/services/canonicalWeekendTyrePersistence.ts',
      'utf-8',
    )

    const linesRunner = practiceRunner
      .split('\n')
      .filter((l) => /tyre|tire|wear|age|compound|medium|medio/i.test(l))
    const linesPracticeService = practiceService
      .split('\n')
      .filter((l) => /tyre|tire|wear|age|compound|medium|medio/i.test(l))

    // Fail on purpose to print details in error output!
    expect(linesPracticeService.slice(0, 30).join(' \n ')).toBe('')
  })
})
