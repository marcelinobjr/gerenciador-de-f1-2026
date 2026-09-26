import { describe, it, expect } from 'vitest'
import { generateAndPersistDiagnosticRaceArtifacts } from '@/artifacts/audits/generateStatisticalDiagnosticRaceArtifacts'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('SD-02A Environment Probe', () => {
  it('checks cwd and files', () => {
    console.warn('CURRENT_WORKING_DIR:', process.cwd())
    const outDir = path.resolve(process.cwd(), 'src/artifacts/audits')
    console.warn('OUT_DIR:', outDir)
    console.warn('OUT_DIR_EXISTS:', fs.existsSync(outDir))
    if (fs.existsSync(outDir)) {
      console.warn('OUT_DIR_FILES:', fs.readdirSync(outDir))
    }
    const res = generateAndPersistDiagnosticRaceArtifacts(10)
    console.warn('RESULT_PATHS:', res.jsonPath, res.csvPath, res.markdownPath)
    console.warn('EXISTS_NOW:', fs.existsSync(res.jsonPath), fs.existsSync(res.csvPath), fs.existsSync(res.markdownPath))
    expect(res.sampleCount).toBe(10)
  })
})
