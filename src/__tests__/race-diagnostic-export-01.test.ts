import { describe, it, expect, beforeEach } from 'vitest'
import {
  collectRaceDiagnosticData,
  TARGET_CAREER_ID,
  downloadDiagnosticJson,
  copyDiagnosticToClipboard,
  isAuthOrSensitiveKey,
} from '@/utils/raceDiagnosticExport'

describe('RACE-DIAGNOSTIC-EXPORT-01 & TAREFA: raceDiagnosticExport com inventário seguro', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('coleta SOMENTE as chaves dos prefixos permitidos para a carreira alvo nos valores brutos', () => {
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

    // Chaves de OUTRAS carreiras (NÃO devem ser coletadas em records)
    localStorage.setItem(
      'f1_2026_canonical_official_result:other_career:2026:1',
      '{"val":"ignored"}',
    )
    localStorage.setItem('race_result_other_career_s2026_1', '{"val":"ignored"}')
    localStorage.setItem('driver_morale_applied_other_career_2026_1_drv1', '{"val":"ignored"}')
    localStorage.setItem('driver_morale_other_career_2026_1_drv1', '{"val":"ignored"}')

    // Chaves sensíveis / tokens / auth (NÃO podem aparecer nem no inventário nem em records)
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

    // Provar que tokens e credenciais NÃO estão presentes nos registros
    expect(collectedKeys).not.toContain('pocketbase_auth')
    expect(collectedKeys).not.toContain('sb-token')
    expect(collectedKeys).not.toContain('user_credentials')
    expect(collectedKeys).not.toContain('theme')

    // Provar que chaves de outras carreiras NÃO estão presentes nos registros com valores
    expect(collectedKeys.some((k) => k.includes('other_career'))).toBe(false)
  })

  it('INVENTÁRIO: reporta nomes de chaves existentes mesmo sob outro identificador, mas NÃO expõe valores de outras carreiras', () => {
    const activeCareer = TARGET_CAREER_ID
    const altIdentifier = '3109528'

    // Grava registros sob altIdentifier (ex. 3109528)
    localStorage.setItem(
      `f1_2026_canonical_official_result:${altIdentifier}:2026:1`,
      'secret_race_result_val',
    )
    localStorage.setItem(`race_result_${altIdentifier}_s2026_1`, 'secret_career_result_val')
    localStorage.setItem(`career_apply_result_${altIdentifier}_s2026_1`, 'secret_apply_val')
    localStorage.setItem(`driver_morale_${altIdentifier}_2026_1_drv1`, 'secret_morale_val')

    // Grava também token de autenticação
    localStorage.setItem('pocketbase_auth', '{"token":"jwt.secret.here"}')

    const result = collectRaceDiagnosticData(activeCareer)

    // O filtro da carreira ativa (TARGET_CAREER_ID) não encontra registros
    expect(result.recordCount).toBe(0)
    expect(Object.keys(result.records).length).toBe(0)

    // O inventário deve indicar:
    expect(result.inventory.totalStorageKeys).toBe(5)
    expect(result.inventory.readStatus).toBe('success')

    // Inventário do grupo officialResult:
    expect(result.inventory.groups.officialResult.totalKeysFound).toBe(1)
    expect(result.inventory.groups.officialResult.matchingFilterCount).toBe(0)
    expect(result.inventory.groups.officialResult.keys).toContain(
      `f1_2026_canonical_official_result:${altIdentifier}:2026:1`,
    )

    // Inventário do grupo raceResult:
    expect(result.inventory.groups.raceResult.totalKeysFound).toBe(1)
    expect(result.inventory.groups.raceResult.matchingFilterCount).toBe(0)
    expect(result.inventory.groups.raceResult.keys).toContain(
      `race_result_${altIdentifier}_s2026_1`,
    )

    // Inventário do grupo careerApplyResult:
    expect(result.inventory.groups.careerApplyResult.totalKeysFound).toBe(1)
    expect(result.inventory.groups.careerApplyResult.matchingFilterCount).toBe(0)
    expect(result.inventory.groups.careerApplyResult.keys).toContain(
      `career_apply_result_${altIdentifier}_s2026_1`,
    )

    // Inventário do grupo driverMorale:
    expect(result.inventory.groups.driverMorale.totalKeysFound).toBe(1)
    expect(result.inventory.groups.driverMorale.matchingFilterCount).toBe(0)
    expect(result.inventory.groups.driverMorale.keys).toContain(
      `driver_morale_${altIdentifier}_2026_1_drv1`,
    )

    // NENHUM valor sob altIdentifier deve estar em result.records (preservando isolamento seguro)
    const recordsValues = JSON.stringify(result.records)
    expect(recordsValues).not.toContain('secret_race_result_val')
    expect(recordsValues).not.toContain('secret_career_result_val')

    // Chaves de autenticação NUNCA devem figurar no inventário
    const inventoryAllKeys = result.inventory.allDiagnosticRelevantKeys
    expect(inventoryAllKeys).not.toContain('pocketbase_auth')
    expect(result.inventory.groups.officialResult.keys).not.toContain('pocketbase_auth')
    expect(JSON.stringify(result.inventory)).not.toContain('pocketbase_auth')
  })

  it('FILTRAGEM DE AUTH: isAuthOrSensitiveKey bloqueia padrões sensíveis', () => {
    expect(isAuthOrSensitiveKey('pocketbase_auth')).toBe(true)
    expect(isAuthOrSensitiveKey('sb-token')).toBe(true)
    expect(isAuthOrSensitiveKey('user_password_hash')).toBe(true)
    expect(isAuthOrSensitiveKey('user_credentials')).toBe(true)
    expect(isAuthOrSensitiveKey('race_result_31b0p9k5ygw2sc8_s2026_1')).toBe(false)
    expect(isAuthOrSensitiveKey('driver_morale_31b0p9k5ygw2sc8_2026_1_drv1')).toBe(false)
  })

  it('preserva integralmente chaves e valores originais como string bruta', () => {
    const rawVal = '{"unnormalized": true, "rawText": "abc 123", "value": 999}'
    const key = `race_result_${TARGET_CAREER_ID}_s2026_1`
    localStorage.setItem(key, rawVal)

    const result = collectRaceDiagnosticData(TARGET_CAREER_ID)
    expect(result.records[key]).toBe(rawVal)
  })

  it('reporta metadados e contexto da aplicação de forma explícita', () => {
    const appContext = {
      careerId: 'test_career_123',
      careerIdOrigin: 'season.id',
      pocketBaseSeasonId: 'pb_season_abc',
      pocketBaseSeasonIdOrigin: 'season.id',
      internalNumericSeasonId: 3109528,
      internalNumericSeasonIdOrigin: 'season.season_number',
      displayedYear: 2026,
      displayedYearOrigin: 'season.year',
      currentRound: 1,
      currentRoundOrigin: 'season.current_round',
      sessionType: 'race',
      sessionTypeOrigin: 'WeekendV2Page.selectedSessionId',
    }

    const result = collectRaceDiagnosticData('test_career_123', {
      appContext,
    })

    expect(result.appContext.careerId).toBe('test_career_123')
    expect(result.appContext.careerIdOrigin).toBe('season.id')
    expect(result.appContext.pocketBaseSeasonId).toBe('pb_season_abc')
    expect(result.appContext.internalNumericSeasonId).toBe(3109528)
    expect(result.appContext.displayedYear).toBe(2026)
    expect(result.appContext.currentRound).toBe(1)
    expect(result.appContext.sessionType).toBe('race')
  })

  it('trata falha de acesso ao storage sem mascarar como zero registros silencioso', () => {
    const mockFaultyStorage = {
      get length() {
        throw new Error('SecurityError: localStorage is disabled')
      },
      key: () => null,
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    } as unknown as Storage

    const result = collectRaceDiagnosticData(TARGET_CAREER_ID, {
      storage: mockFaultyStorage,
    })

    expect(result.inventory.readStatus).toBe('error')
    expect(result.inventory.readError).toContain('SecurityError')
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
