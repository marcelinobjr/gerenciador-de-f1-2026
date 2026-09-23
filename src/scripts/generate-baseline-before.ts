import { auditTeamPerformanceBaseline } from '@/services/teamPerformanceBaselineAuditService'
import * as fs from 'fs'
import * as path from 'path'

console.log('Iniciando Monte Carlo 1.000 Q / 1.000 R para Baseline BEFORE 2026...')
const startTime = Date.now()

const report = auditTeamPerformanceBaseline({
  seed: 20260315,
  qualifyingIterations: 1000,
  raceIterations: 1000,
  circuitRound: 1,
  totalRaceLaps: 15, // voltas otimizadas para processar 1.000 corridas completas com consumo, degradação e DNF canônicos
})

const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1)
console.log(`Concluído em ${elapsedSec}s!`)
console.log(report.summaryText)

const outPath = path.resolve(process.cwd(), 'src/data/baseline-2026-before.json')
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8')
console.log(`Relatório salvo em ${outPath}`)
