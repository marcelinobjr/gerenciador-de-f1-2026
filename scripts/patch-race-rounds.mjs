import fs from 'node:fs'
import path from 'node:path'

const filePath = path.resolve('src/pages/RaceSlim.tsx')
let content = fs.readFileSync(filePath, 'utf8')

const target = `      const driversCost = drivers.reduce((sum, d) => sum + Math.round(d.salary / 24), 0)
      const engineCost = Math.round(currentEngine.costAnnual / 24)`

const replacement = `      const driversCost = drivers.reduce(
        (sum, d) => sum + Math.round(d.salary / (season?.total_rounds || 24)),
        0,
      )
      const engineCost = Math.round(currentEngine.costAnnual / (season?.total_rounds || 24))`

if (!content.includes(target)) {
  if (content.includes('season?.total_rounds || 24')) {
    console.log('Patch 1 já está aplicado!')
    process.exit(0)
  }
  console.error('Target não encontrado em RaceSlim.tsx')
  process.exit(1)
}

content = content.replace(target, replacement)
fs.writeFileSync(filePath, content, 'utf8')
console.log('✓ Patch 1 aplicado com sucesso em RaceSlim.tsx')
