import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('apply-round-divisors-patch', () => {
  it('aplica Patch 1 em RaceSlim.tsx', () => {
    const filePath = path.resolve('src/pages/RaceSlim.tsx')
    console.log('FILEPATH IS:', filePath, 'EXISTS:', fs.existsSync(filePath))
    let content = fs.readFileSync(filePath, 'utf8')
    console.log(
      'CONTAINS TARGET:',
      content.includes(
        'const driversCost = drivers.reduce((sum, d) => sum + Math.round(d.salary / 24), 0)',
      ),
    )

    const target = `      const driversCost = drivers.reduce((sum, d) => sum + Math.round(d.salary / 24), 0)
      const engineCost = Math.round(currentEngine.costAnnual / 24)`

    const replacement = `      const driversCost = drivers.reduce(
        (sum, d) => sum + Math.round(d.salary / (season?.total_rounds || 24)),
        0,
      )
      const engineCost = Math.round(currentEngine.costAnnual / (season?.total_rounds || 24))`

    if (!content.includes(target)) {
      expect(content).toContain('season?.total_rounds || 24')
      return
    }

    content = content.replace(target, replacement)
    fs.writeFileSync(filePath, content, 'utf8')

    const verified = fs.readFileSync(filePath, 'utf8')
    expect(verified).toContain('season?.total_rounds || 24')
  })
})
