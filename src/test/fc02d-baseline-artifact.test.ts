/**
 * fc02d-baseline-artifact.test.ts
 *
 * Teste permanente de integridade do artefato canônico FC02D Fase B:
 * src/data/baseline-2026-after-phase-b.json
 *
 * Valida que o arquivo no disco existe e reflete exatamente a saída
 * de runFC02DPhaseB com a configuração canônica determinística.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { runFC02DPhaseB, getCanonicalPhaseBPath } from '@/scripts/run-fc02d-phase-b'

describe('FC02D Fase B — Teste de Integridade do Artefato Canônico', () => {
  const SEED = 20260315
  const RUNS = 30
  const TOTAL_LAPS = 15

  it('valida que baseline-2026-after-phase-b.json existe e corresponde à saída do runner', () => {
    const canonicalPath = getCanonicalPhaseBPath()
    const rawDisk = fs.existsSync(canonicalPath) ? fs.readFileSync(canonicalPath, 'utf-8') : '{}'
    const parsedDisk = JSON.parse(rawDisk)

    const result = runFC02DPhaseB({
      seed: SEED,
      runs: RUNS,
      totalLaps: TOTAL_LAPS,
      persist: false,
    })

    const parsedMemory = JSON.parse(result.jsonString)
    expect(parsedDisk).toEqual(parsedMemory.calibration)
  })
})
