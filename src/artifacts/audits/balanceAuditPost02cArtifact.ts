import { calibration01aBaselineService } from '@/services/calibration01aBaselineService'
import type { Calibration01aArtifact } from '@/services/calibration01aBaselineService'
import * as fs from 'node:fs'
import * as path from 'node:path'

// Executa e opcionalmente persiste se executado em ambiente Node
export function getOrGeneratePost02cArtifact(): Calibration01aArtifact {
  const artifact = calibration01aBaselineService.runFullMeasurement({
    qualiIterations: 200,
    raceIterations: 100,
    deterministicSeed: 20260315,
  })

  // Se executando em ambiente Node (Vitest/build/QA), garante a persistência no disco
  try {
    if (typeof process !== 'undefined' && process.cwd && typeof fs?.writeFileSync === 'function') {
      const outDir = path.resolve(process.cwd(), 'src/artifacts/audits')
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true })
      }
      const targetPath = path.join(outDir, 'balance-audit-post02c.json')
      fs.writeFileSync(targetPath, JSON.stringify(artifact, null, 2), 'utf-8')
    }
  } catch (_e) {
    // Ignorado em browsers/preview
  }

  return artifact
}

export const POST_02C_AUDIT_DATA: Calibration01aArtifact = getOrGeneratePost02cArtifact()

export default POST_02C_AUDIT_DATA

export const POST_02C_RAW_JSON_STRING = JSON.stringify(POST_02C_AUDIT_DATA, null, 2)
