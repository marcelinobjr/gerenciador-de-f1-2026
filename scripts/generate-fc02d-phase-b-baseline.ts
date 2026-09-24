/**
 * scripts/generate-fc02d-phase-b-baseline.ts
 *
 * Script dedicado para execução canônica do Monte Carlo FC02D Fase B
 * e persistência em src/data/baseline-2026-after-phase-b.json.
 *
 * Executa runFC02DPhaseB({ persist: true }) com motor real,
 * seeds determinísticas (20260315), sem sintéticos e sem alterar calibragens.
 */

import * as fs from 'fs'
import * as path from 'path'
import { runFC02DPhaseB, getCanonicalPhaseBPath } from '../src/scripts/run-fc02d-phase-b'

export function generatePhaseBBaseline(
  options: {
    seed?: number
    runs?: number
    totalLaps?: number
  } = {},
) {
  const seed = options.seed ?? 20260315
  const runs = options.runs ?? 15
  const totalLaps = options.totalLaps ?? 10

  const resolvedPath = getCanonicalPhaseBPath()
  const targetDir = path.dirname(resolvedPath)
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  const result = runFC02DPhaseB({
    seed,
    runs,
    totalLaps,
    persist: true,
  })

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Arquivo não foi persistido no destino esperado: ${resolvedPath}`)
  }

  const raw = fs.readFileSync(resolvedPath, 'utf8')
  const parsed = JSON.parse(raw)
  if (!parsed || parsed.phase !== 'FASE_B_AFTER') {
    throw new Error('Falha na validação do artefato gerado: payload inválido ou phase incorreta')
  }

  return {
    filePath: resolvedPath,
    size: raw.length,
    artifact: parsed,
  }
}
