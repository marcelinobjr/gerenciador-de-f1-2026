import { describe, it, expect, beforeEach } from 'vitest'
import {
  collectRaceDiagnosticData,
  TARGET_CAREER_ID,
  isAuthOrSensitiveKey,
} from '@/utils/raceDiagnosticExport'

describe('RACE-DIAGNOSTIC-EXPORT-02 & TAREFA: diagnóstico foca identificador real e inventário completo', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('i) chave de corrida sob OUTRO identificador (3109528) aparece no inventário SEM casar com o filtro antigo', () => {
    const activeCareer = '31b0p9k5ygw2sc8'
    const altNumericId = '3109528'

    localStorage.setItem(
      `race_result_${altNumericId}_s2026_1`,
      JSON.stringify({ snapshot: { winner: 'x' } }),
    )
    localStorage.setItem(
      `career_apply_result_${altNumericId}_s2026_1`,
      JSON.stringify({ status: 'COMPLETE' }),
    )
    localStorage.setItem(
      `driver_morale_applied_${altNumericId}_2026_1_drv1`,
      JSON.stringify({ before: 80, after: 82, delta: 2 }),
    )
    localStorage.setItem(
      `f1_2026_canonical_official_result:${altNumericId}:2026:1`,
      JSON.stringify({ winnerDriverId: 'x' }),
    )

    const result = collectRaceDiagnosticData(activeCareer)

    // Nenhum registro com valor da carreira alternativa é exposto
    expect(result.recordCount).toBe(0)
    expect(Object.keys(result.records).length).toBe(0)

    // Mas o inventário lista todos os nomes, agrupados corretamente
    expect(result.inventario.grupos.raceResult.totalKeysFound).toBe(1)
    expect(result.inventario.grupos.raceResult.matchingFilterCount).toBe(0)
    expect(result.inventario.grupos.raceResult.keys).toContain(
      `race_result_${altNumericId}_s2026_1`,
    )

    expect(result.inventario.grupos.careerApplyResult.totalKeysFound).toBe(1)
    expect(result.inventario.grupos.careerApplyResult.matchingFilterCount).toBe(0)
    expect(result.inventario.grupos.careerApplyResult.keys).toContain(
      `career_apply_result_${altNumericId}_s2026_1`,
    )

    expect(result.inventario.grupos.recibosEMarcadoresMoral.totalKeysFound).toBe(1)
    expect(result.inventario.grupos.recibosEMarcadoresMoral.matchingFilterCount).toBe(0)
    expect(result.inventario.grupos.recibosEMarcadoresMoral.keys).toContain(
      `driver_morale_applied_${altNumericId}_2026_1_drv1`,
    )

    expect(result.inventario.grupos.resultadoOficial.totalKeysFound).toBe(1)
    expect(result.inventario.grupos.resultadoOficial.matchingFilterCount).toBe(0)
    expect(result.inventario.grupos.resultadoOficial.keys).toContain(
      `f1_2026_canonical_official_result:${altNumericId}:2026:1`,
    )

    // Total de chaves no storage refletido sem mascarar como zero
    expect(result.inventario.totalDeChavesNoLocalStorage).toBe(4)
    expect(result.inventario.statusDaLeitura).toBe('ok')
  })

  it('ii) chaves de autenticação / token / credencial nunca aparecem — nem em records, nem no inventário, nem em nome', () => {
    localStorage.setItem('pocketbase_auth', '{"token":"jwt_secret_aqui"}')
    localStorage.setItem('sb-token', 'super_secret')
    localStorage.setItem('user_credentials', 'password123')
    localStorage.setItem('pb_auth_cache', 'token_secreto')
    localStorage.setItem('f1_auth_refresh_token', 'abc')
    localStorage.setItem(`race_result_${TARGET_CAREER_ID}_s2026_1`, JSON.stringify({ round: 1 }))

    const result = collectRaceDiagnosticData(TARGET_CAREER_ID)

    expect(result.recordCount).toBe(1)
    expect(Object.keys(result.records)).toEqual([`race_result_${TARGET_CAREER_ID}_s2026_1`])

    // Nenhuma chave sensível pode aparecer nem como NOME
    const serializedInventory = JSON.stringify(result.inventario)
    expect(serializedInventory).not.toContain('pocketbase_auth')
    expect(serializedInventory).not.toContain('sb-token')
    expect(serializedInventory).not.toContain('user_credentials')
    expect(serializedInventory).not.toContain('pb_auth_cache')
    expect(serializedInventory).not.toContain('f1_auth_refresh_token')

    // O total de chaves conta todas (5), mas apenas 1 é diagnóstica e aparece em inventário
    expect(result.inventario.totalDeChavesNoLocalStorage).toBe(6)
    expect(result.inventario.todasAsChavesDiagnosticas).toEqual([
      `race_result_${TARGET_CAREER_ID}_s2026_1`,
    ])
  })

  it('identificadores não são tratados como equivalentes: 31b0p9k5ygw2sc8 ≠ 3109528 ≠ 2026', () => {
    const appContext = {
      careerId: '31b0p9k5ygw2sc8',
      pocketBaseSeasonId: 'abc123season',
      internalNumericSeasonId: 3109528,
      displayedYear: 2026,
      currentRound: 1,
      sessionType: 'race',
    }
    const result = collectRaceDiagnosticData('31b0p9k5ygw2sc8', { appContext })

    expect(result.identificadores.careerId.valor).toBe('31b0p9k5ygw2sc8')
    expect(result.identificadores.pocketBaseSeasonId.valor).toBe('abc123season')
    expect(result.identificadores.internalNumericSeasonId.valor).toBe('3109528')
    expect(result.identificadores.displayedYear.valor).toBe(2026)
    expect(result.identificadores.careerId.valor).not.toBe(
      result.identificadores.internalNumericSeasonId.valor,
    )
    expect(result.identificadores.internalNumericSeasonId.valor).not.toBe(
      String(result.identificadores.displayedYear.valor),
    )

    // Cada identificador tem sua origem documentada
    expect(result.identificadores.careerId.origem).toContain('resolveCanonicalCareerId')
    expect(result.identificadores.pocketBaseSeasonId.origem).toContain('useAuth')
    expect(result.identificadores.internalNumericSeasonId.origem).toContain('season_number')
  })

  it('falha de leitura do storage é reportada como erro, nunca como zero silencioso', () => {
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

    expect(result.inventario.statusDaLeitura).toBe('erro')
    expect(result.inventario.mensagemDeErro).toContain('SecurityError')
    expect(result.statusDaLeitura).toBe('erro')
  })

  it('registros da carreira ativa continuam sendo coletados como valores brutos sem normalização', () => {
    const rawVal = '{"unnormalized": true, "rawText": "abc 123", "value": 999}'
    const key = `race_result_${TARGET_CAREER_ID}_s2026_1`
    localStorage.setItem(key, rawVal)

    const result = collectRaceDiagnosticData(TARGET_CAREER_ID)
    expect(result.records[key]).toBe(rawVal)
    expect(result.recordCount).toBe(1)
    expect(result.inventario.grupos.raceResult.matchingFilterCount).toBe(1)
  })

  it('bloco de contexto de ambiente (origin, pathname, dentroDeIframe) é exportado', () => {
    const result = collectRaceDiagnosticData(TARGET_CAREER_ID)

    expect(result.inventario).toHaveProperty('origin')
    expect(result.inventario).toHaveProperty('pathname')
    expect(typeof result.inventario.dentroDeIframe).toBe('boolean')
    expect(result.inventario.statusDaLeitura).toBe('ok')
  })
})
