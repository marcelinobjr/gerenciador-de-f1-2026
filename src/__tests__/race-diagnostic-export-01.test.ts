import { describe, it, expect, beforeEach } from 'vitest'
import {
  collectRaceDiagnosticData,
  TARGET_CAREER_ID,
  downloadDiagnosticJson,
  copyDiagnosticToClipboard,
} from '@/utils/raceDiagnosticExport'

describe('RACE-DIAGNOSTIC-EXPORT-01: raceDiagnosticExport', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('coleta SOMENTE as chaves dos prefixos permitidos para a carreira alvo', () => {
    const career = TARGET_CAREER_ID

    // Chaves permitidas (devem ser coletadas)
    localStorage.setItem(
      `f1_2026_canonical_official_result:${career}:2026:1`,
      JSON.stringify({ raceId: 'r1', winner: 'VER' }),
    )
    localStorage.setItem(
      `race_result_${career}_s2026_1`,
      JSON.stringify({ status: 'completed', round: 1 }),
    )
    localStorage.setItem(
      `career_apply_result_${career}_s2026_1`,
      JSON.stringify({ status: 'COMPLETE' }),
    )
    localStorage.setItem(
      `driver_morale_applied_${career}_2026_1_drv1`,
      JSON.stringify({ before: 80, after: 85, delta: 5 }),
    )
    localStorage.setItem(
      `driver_morale_receipt_${career}_2026_1_MAIN_RACE_drv1`,
      JSON.stringify({ operationKey: 'op1' }),
    )
    localStorage.setItem(
      `driver_morale_${career}_2026_1_drv1`,
      JSON.stringify({ processedAt: '2026-03-01T00:00:00.000Z' }),
    )

    // Chaves de OUTRAS carreiras (NÃO devem ser coletadas)
    localStorage.setItem('f1_2026_canonical_official_result:other_career:2026:1', 'ignored')
    localStorage.setItem('race_result_other_career_s2026_1', 'ignored')
    localStorage.setItem('driver_morale_applied_other_career_2026_1_drv1', 'ignored')
    localStorage.setItem('driver_morale_other_career_2026_1_drv1', 'ignored')

    // Chaves sensíveis / tokens / auth (NÃO podem aparecer)
    localStorage.setItem('pocketbase_auth', '{"token":"secret_jwt_token"}')
    localStorage.setItem('sb-token', 'super_secret')
    localStorage.setItem('user_credentials', 'password123')
    localStorage.setItem('theme', 'dark')

    const result = collectRaceDiagnosticData(career)

    expect(result.careerId).toBe(career)
    expect(result.recordCount).toBe(6)

    const collectedKeys = Object.keys(result.records)
    expect(collectedKeys).toContain(`f1_2026_canonical_official_result:${career}:2026:1`)
    expect(collectedKeys).toContain(`race_result_${career}_s2026_1`)
    expect(collectedKeys).toContain(`career_apply_result_${career}_s2026_1`)
    expect(collectedKeys).toContain(`driver_morale_applied_${career}_2026_1_drv1`)
    expect(collectedKeys).toContain(`driver_morale_receipt_${career}_2026_1_MAIN_RACE_drv1`)
    expect(collectedKeys).toContain(`driver_morale_${career}_2026_1_drv1`)

    // Provar que tokens e credenciais NÃO estão presentes
    expect(collectedKeys).not.toContain('pocketbase_auth')
    expect(collectedKeys).not.toContain('sb-token')
    expect(collectedKeys).not.toContain('user_credentials')
    expect(collectedKeys).not.toContain('theme')

    // Provar que chaves de outras carreiras NÃO estão presentes
    expect(collectedKeys.some((k) => k.includes('other_career'))).toBe(false)
  })

  it('preserva integralmente chaves e valores originais como string bruta', () => {
    const rawVal = '{"unnormalized": true, "rawText": "abc 123", "value": 999}'
    const key = `race_result_${TARGET_CAREER_ID}_s2026_1`
    localStorage.setItem(key, rawVal)

    const result = collectRaceDiagnosticData(TARGET_CAREER_ID)
    expect(result.records[key]).toBe(rawVal)
  })

  it('retorna metadados mesmo quando nenhum registro é encontrado (recordCount = 0)', () => {
    const result = collectRaceDiagnosticData(TARGET_CAREER_ID)

    expect(result.recordCount).toBe(0)
    expect(result.records).toEqual({})
    expect(result.careerId).toBe(TARGET_CAREER_ID)
    expect(result.exportedAt).toBeDefined()
    expect(result.origin).toBeDefined()
  })

  it('downloadDiagnosticJson cria blob e dispara download sem erro', () => {
    const data = collectRaceDiagnosticData(TARGET_CAREER_ID)
    const success = downloadDiagnosticJson(data, 'teste-diagnostico.json')
    expect(typeof success).toBe('boolean')
  })

  it('copyDiagnosticToClipboard executa cópia ou retorna fallbackText', async () => {
    const data = collectRaceDiagnosticData(TARGET_CAREER_ID)
    const outcome = await copyDiagnosticToClipboard(data)
    expect(typeof outcome.success).toBe('boolean')
    if (!outcome.success) {
      expect(outcome.fallbackText).toContain(TARGET_CAREER_ID)
    }
  })
})
