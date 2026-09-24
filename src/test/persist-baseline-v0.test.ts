/**
 * persist-baseline-v0.test.ts
 *
 * Persiste a árvore completa da baseline V0 (29 equipes) em src/data/balance-baseline-v0.json
 * usando um reporter Vitest para garantir que seja escrito fora do worker descartável.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { buildCompleteBaselineV0, calculateStableChecksum } from '@/scripts/generate-baseline-v0'

describe('Persistência Física da Baseline V0', () => {
  it('garante que src/data/balance-baseline-v0.json possui 29 equipes e checksum válido', () => {
    const full = buildCompleteBaselineV0()
    const filePath = path.resolve(process.cwd(), 'src/data/balance-baseline-v0.json')

    // Persiste o json completo
    fs.writeFileSync(filePath, JSON.stringify(full, null, 2), 'utf-8')

    expect(fs.existsSync(filePath)).toBe(true)
    const readBack = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    expect(readBack.schemaVersion).toBe('v0')
    expect(readBack.totalTeamsCount).toBe(29)
    expect(Object.keys(readBack.teams).length).toBe(29)

    const { checksum, ...withoutChecksum } = readBack
    const recalculated = calculateStableChecksum(withoutChecksum)
    expect(checksum).toBe(recalculated)
  })
})
