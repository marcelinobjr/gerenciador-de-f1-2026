import fs from 'node:fs'
import path from 'node:path'

const filePath = path.resolve('src/pages/RaceSlim.tsx')
const content = fs.readFileSync(filePath, 'utf-8')

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

if (!content.includes(target)) {
  console.log('Target block not found. Checking if already replaced...')
  if (content.includes(replacement)) {
    console.log('Already replaced!')
    process.exit(0)
  }
  console.error('Target not found!')
  process.exit(1)
}

const updated = content.replace(target, replacement)
fs.writeFileSync(filePath, updated, 'utf-8')
console.log('Successfully removed the 3 orphan setter calls from RaceSlim.tsx!')
