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
    if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
      const cwd = process.cwd()
      const candidatePaths = [
        path.resolve(cwd, 'src/artifacts/audits'),
        path.resolve(cwd, 'artifacts/audits'),
        path.resolve(__dirname, '../artifacts/audits'),
        path.resolve(__dirname, '.'),
      ]
      let written = false
      for (const dir of candidatePaths) {
        try {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }
          const targetPath = path.join(dir, 'balance-audit-post02c.json')
          fs.writeFileSync(targetPath, JSON.stringify(artifact, null, 2), 'utf-8')
          written = true
          break
        } catch {
          // Tenta próximo path
        }
      }
      if (!written) {
        const fallbackPath = path.resolve(
          process.cwd(),
          'src/artifacts/audits/balance-audit-post02c.json',
        )
        fs.writeFileSync(fallbackPath, JSON.stringify(artifact, null, 2), 'utf-8')
      }
    }
  } catch (err) {
    console.warn('[balanceAuditPost02cArtifact] Failed to persist artifact:', err)
  }
  return artifact
}

export const POST_02C_AUDIT_DATA: Calibration01aArtifact = getOrGeneratePost02cArtifact()

export default POST_02C_AUDIT_DATA

export const POST_02C_RAW_JSON_STRING = JSON.stringify(POST_02C_AUDIT_DATA, null, 2)
