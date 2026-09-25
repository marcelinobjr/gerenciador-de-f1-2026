import { calibration01aBaselineService } from '@/services/calibration01aBaselineService'
import * as fs from 'fs'
import * as path from 'path'

// Gera o artefato e salva em src/artifacts/audits/balance-audit-post02c.json
const payload = calibration01aBaselineService.runFullMeasurement({
  qualiIterations: 200,
  raceIterations: 100,
  deterministicSeed: 20260315,
})

const targetPath = path.resolve(__dirname, 'balance-audit-post02c.json')
fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf-8')
console.log(`[CALIBRATION-01A] Artefato gerado com sucesso em ${targetPath}`)
