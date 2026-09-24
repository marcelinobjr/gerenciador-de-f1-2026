import { buildCompleteBaselineV0 } from '@/scripts/generate-baseline-v0'
import * as fs from 'fs'
import * as path from 'path'

// Constrói a baseline V0 canônica com todas as 29 equipes
const baseline = buildCompleteBaselineV0()
const filePath = path.resolve(process.cwd(), 'src/data/balance-baseline-v0.json')
fs.writeFileSync(filePath, JSON.stringify(baseline, null, 2), 'utf-8')
console.log(`Generated canonical V0 with ${baseline.totalTeamsCount} teams at ${filePath}`)
