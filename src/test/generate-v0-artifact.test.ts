/**
 * generate-v0-artifact.test.ts
 *
 * Gera e valida src/data/balance-baseline-v0.json em disco
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { buildCompleteBaselineV0, calculateStableChecksum } from '@/scripts/generate-baseline-v0'

describe('Geração e Validação do Artefato Baseline V0', () => {
  it('gera src/data/balance-baseline-v0.json com integridade e persistência', () => {
    const baseline = buildCompleteBaselineV0()
    expect(baseline).toBeDefined()
    expect(baseline.schemaVersion).toBe('v0')
    expect(baseline.totalTeamsCount).toBe(29)

    const json = JSON.stringify(baseline, null, 2)
    const targetPath = path.resolve(process.cwd(), 'src/data/balance-baseline-v0.json')
    fs.writeFileSync(targetPath, json, 'utf-8')

    expect(fs.existsSync(targetPath)).toBe(true)

    const readBack = JSON.parse(fs.readFileSync(targetPath, 'utf-8'))
    expect(readBack.schemaVersion).toBe('v0')
    expect(readBack.totalTeamsCount).toBe(29)
    expect(readBack.checksum).toBe(baseline.checksum)

    // Validar checksum estável
    const { checksum, ...withoutChecksum } = readBack
    const recalculated = calculateStableChecksum(withoutChecksum)
    expect(checksum).toBe(recalculated)
  })
})
