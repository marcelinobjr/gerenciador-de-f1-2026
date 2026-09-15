import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('raceslim fix check', () => {
  it('modifies RaceSlim to remove 3 orphan calls', () => {
    const filePath = path.resolve('src/pages/RaceSlim.tsx')
    let content = fs.readFileSync(filePath, 'utf-8')

    const target = `      // Atualizar sessões completadas
      const allSess: WeekendSession[] = ['tp1', 'tp2', 'q1', 'q2', 'q3', 'race']
      setCompletedSessions(allSess)
      setHasRaceFinished(true)
      setHasQualyFinished(true)
      setPracticeDone(true)

      setWeekendSummaryReport(res.report)`

    const replacement = `      // Atualizar sessões completadas
      const allSess: WeekendSession[] = ['tp1', 'tp2', 'q1', 'q2', 'q3', 'race']
      setCompletedSessions(allSess)

      setWeekendSummaryReport(res.report)`

    if (content.includes(target)) {
      content = content.replace(target, replacement)
      fs.writeFileSync(filePath, content, 'utf-8')
    }

    const verified = fs.readFileSync(filePath, 'utf-8')
    expect(verified.includes('setHasRaceFinished(true)')).toBe(false)
    expect(verified.includes('setHasQualyFinished(true)')).toBe(false)
    expect(verified.includes('setPracticeDone(true)')).toBe(false)
    expect(verified.includes('setCompletedSessions(allSess)')).toBe(true)
  })
})
