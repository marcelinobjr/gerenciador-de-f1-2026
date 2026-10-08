import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  auditLocalStorageUsage,
  formatFamilyReport,
  pruneStorageData,
  safeLocalStorageSetItem,
  APEX_STORAGE_FAMILIES,
  parseStorageKeyMetadata,
} from '@/services/storageQuotaService'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import {
  getActiveWeekendGeneration,
  bumpWeekendGeneration,
} from '@/services/weekendProgressionService'

describe('storage-quota-01a: Auditoria de Tamanho + Prune Seguro do LocalStorage', () => {
  const careerId = 'career_active_01'
  const otherCareerId = 'career_inactive_99'
  const seasonId = 'season_2026'

  // Helper para limpar chaves sem usar localStorage.clear dentro da lógica de teste
  const clearTestKeys = () => {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k) keys.push(k)
    }
    for (const k of keys) {
      window.localStorage.removeItem(k)
    }
  }

  beforeEach(() => {
    clearTestKeys()
  })

  // =========================================================================
  // S1 — MEDIÇÃO POR FAMÍLIA: Popular storage com várias famílias e confirmar agregação.
  // =========================================================================
  it('S1 — MEDIÇÃO POR FAMÍLIA: Popular storage com várias famílias e confirmar agregação', () => {
    // Injetar chaves de diferentes famílias
    window.localStorage.setItem(
      `apex_gp_tires_${seasonId}_r1`,
      JSON.stringify({ tires: [1, 2, 3] }),
    )
    window.localStorage.setItem(
      `apex_gp_tires_${seasonId}_r2`,
      JSON.stringify({ tires: [4, 5, 6] }),
    )
    window.localStorage.setItem(
      `apex_qualifying_stage_state_v2_${seasonId}_r1_q1`,
      JSON.stringify({ stageId: 'q1', status: 'completed' }),
    )
    window.localStorage.setItem(
      `apex_practice_session_${careerId}_${seasonId}_r1_tp1`,
      JSON.stringify({ session: 'tp1' }),
    )
    window.localStorage.setItem(
      `apex_weekend_slot_state_v1_${careerId}_${seasonId}_r1`,
      JSON.stringify({ slot: 'slot1' }),
    )
    window.localStorage.setItem(
      `apex_gp_pu_allocation_${careerId}`,
      JSON.stringify({ allocation: 'alloc1' }),
    )
    window.localStorage.setItem(
      `apex_gp_pu_usage_journal_${careerId}_s2026_r1_main`,
      JSON.stringify({ journal: 'j1' }),
    )
    window.localStorage.setItem('user_theme_preference', 'dark')

    const audit = auditLocalStorageUsage()

    expect(audit.totalKeys).toBe(8)
    expect(audit.apexKeys).toBe(7)
    expect(audit.totalBytes).toBeGreaterThan(0)
    expect(audit.apexBytes).toBeGreaterThan(0)

    // Conferir agregação por família
    expect(audit.families[APEX_STORAGE_FAMILIES.TIRES]).toBeDefined()
    expect(audit.families[APEX_STORAGE_FAMILIES.TIRES].count).toBe(2)
    expect(audit.families[APEX_STORAGE_FAMILIES.QUALIFYING_STAGE_STATE].count).toBe(1)
    expect(audit.families[APEX_STORAGE_FAMILIES.PRACTICE_SESSION].count).toBe(1)
    expect(audit.families[APEX_STORAGE_FAMILIES.WEEKEND_SLOT].count).toBe(1)
    expect(audit.families[APEX_STORAGE_FAMILIES.PU_ALLOCATION].count).toBe(1)
    expect(audit.families[APEX_STORAGE_FAMILIES.PU_USAGE_JOURNAL].count).toBe(1)
    expect(audit.families[APEX_STORAGE_FAMILIES.NON_APEX].count).toBe(1)

    // Formatação de relatório não deve quebrar
    const reportText = formatFamilyReport(audit)
    expect(reportText).toContain('APEX GP MANAGER STORAGE AUDIT')
    expect(reportText).toContain(APEX_STORAGE_FAMILIES.TIRES)
  })

  // =========================================================================
  // S2 — PRUNE DE ROUNDS ANTIGAS: Career/season iguais, rounds 1–5, currentRound=5.
  //      Confirmar política adotada: atuais preservadas, antigas removidas.
  // =========================================================================
  it('S2 — PRUNE DE ROUNDS ANTIGAS: rounds 1-5, currentRound=5; rounds 1-3 removidas, 4 e 5 preservadas', () => {
    // Popular dados de rounds 1 a 5 para a mesma carreira e temporada
    for (let r = 1; r <= 5; r++) {
      window.localStorage.setItem(`apex_gp_tires_${seasonId}_r${r}`, `tires_payload_round_${r}`)
      window.localStorage.setItem(
        `apex_qualifying_stage_state_v2_${seasonId}_r${r}_q1`,
        `q1_payload_round_${r}`,
      )
      window.localStorage.setItem(
        `apex_practice_session_${careerId}_${seasonId}_r${r}_tp1`,
        `tp1_payload_round_${r}`,
      )
    }

    // Executar prune com currentRound = 5
    const pruneRes = pruneStorageData({
      careerId,
      seasonId,
      currentRound: 5,
    })

    expect(pruneRes.prunedKeys.length).toBeGreaterThan(0)

    // Rounds 1, 2 e 3 (< currentRound - 1) devem ser removidas
    for (let r = 1; r <= 3; r++) {
      expect(window.localStorage.getItem(`apex_gp_tires_${seasonId}_r${r}`)).toBeNull()
      expect(
        window.localStorage.getItem(`apex_qualifying_stage_state_v2_${seasonId}_r${r}_q1`),
      ).toBeNull()
      expect(
        window.localStorage.getItem(`apex_practice_session_${careerId}_${seasonId}_r${r}_tp1`),
      ).toBeNull()
    }

    // Round 4 (anterior imediata) e Round 5 (atual) devem ser preservadas
    for (let r = 4; r <= 5; r++) {
      expect(window.localStorage.getItem(`apex_gp_tires_${seasonId}_r${r}`)).not.toBeNull()
      expect(
        window.localStorage.getItem(`apex_qualifying_stage_state_v2_${seasonId}_r${r}_q1`),
      ).not.toBeNull()
      expect(
        window.localStorage.getItem(`apex_practice_session_${careerId}_${seasonId}_r${r}_tp1`),
      ).not.toBeNull()
    }
  })

  // =========================================================================
  // S3 — ISOLAMENTO: Dados da carreira ativa não são confundidos com outra carreira.
  // =========================================================================
  it('S3 — ISOLAMENTO: Dados da carreira ativa não são confundidos com outra carreira', () => {
    const currentRound = 4

    // Carreira ativa: round 3 e 4
    window.localStorage.setItem(
      `apex_practice_session_${careerId}_${seasonId}_r3_tp1`,
      'active_career_r3',
    )
    window.localStorage.setItem(
      `apex_practice_session_${careerId}_${seasonId}_r4_tp1`,
      'active_career_r4',
    )

    // Outra carreira (inativa): round 1 (antiga) e round 4
    window.localStorage.setItem(
      `apex_practice_session_${otherCareerId}_${seasonId}_r1_tp1`,
      'other_career_r1',
    )
    window.localStorage.setItem(
      `apex_practice_session_${otherCareerId}_${seasonId}_r4_tp1`,
      'other_career_r4',
    )

    pruneStorageData({
      careerId,
      seasonId,
      currentRound,
    })

    // Carreira ativa: r3 (anterior imediata) e r4 (atual) preservadas
    expect(
      window.localStorage.getItem(`apex_practice_session_${careerId}_${seasonId}_r3_tp1`),
    ).toBe('active_career_r3')
    expect(
      window.localStorage.getItem(`apex_practice_session_${careerId}_${seasonId}_r4_tp1`),
    ).toBe('active_career_r4')

    // Outra carreira: r1 antiga removida
    expect(
      window.localStorage.getItem(`apex_practice_session_${otherCareerId}_${seasonId}_r1_tp1`),
    ).toBeNull()

    // Outra carreira r4 é round atual: preservada
    expect(
      window.localStorage.getItem(`apex_practice_session_${otherCareerId}_${seasonId}_r4_tp1`),
    ).toBe('other_career_r4')
  })

  // =========================================================================
  // S4 — RODADA ATUAL INTOCADA: Pneus, quali e race state do round atual permanecem idênticos.
  // =========================================================================
  it('S4 — RODADA ATUAL INTOCADA: Pneus, quali e race state do round atual permanecem idênticos', () => {
    const round = 3
    const tiresVal = JSON.stringify({ inventoriesByDriver: { drv1: [{ id: 's1', wear: 10 }] } })
    const qualiVal = JSON.stringify({ stageId: 'q1', status: 'running', bestTime: 78.5 })
    const raceVal = JSON.stringify({ status: 'active', currentLap: 15 })

    window.localStorage.setItem(`apex_gp_tires_${seasonId}_r${round}`, tiresVal)
    window.localStorage.setItem(`apex_qualifying_stage_state_v2_${seasonId}_r${round}_q1`, qualiVal)
    window.localStorage.setItem(
      `apex_race_v2_canonical_state_${careerId}_s${seasonId}_r${round}`,
      raceVal,
    )

    // Adiciona dados velhos para o prune agir
    window.localStorage.setItem(`apex_gp_tires_${seasonId}_r1`, 'old_tires')

    pruneStorageData({
      careerId,
      seasonId,
      currentRound: round,
    })

    expect(window.localStorage.getItem(`apex_gp_tires_${seasonId}_r1`)).toBeNull()
    expect(window.localStorage.getItem(`apex_gp_tires_${seasonId}_r${round}`)).toBe(tiresVal)
    expect(
      window.localStorage.getItem(`apex_qualifying_stage_state_v2_${seasonId}_r${round}_q1`),
    ).toBe(qualiVal)
    expect(
      window.localStorage.getItem(
        `apex_race_v2_canonical_state_${careerId}_s${seasonId}_r${round}`,
      ),
    ).toBe(raceVal)
  })

  // =========================================================================
  // S5 — QUOTA RETRY: Simular QuotaExceededError na primeira escrita. Prune executa uma vez. Segunda tentativa grava com sucesso.
  // =========================================================================
  it('S5 — QUOTA RETRY: Simular QuotaExceededError na 1ª tentativa, prune executa e 2ª tentativa grava com sucesso', () => {
    const currentRound = 4
    // Configurar dados antigos no storage que possam ser liberados
    window.localStorage.setItem(`apex_gp_tires_${seasonId}_r1`, 'old_round_1_tires')
    window.localStorage.setItem(`apex_gp_tires_${seasonId}_r2`, 'old_round_2_tires')

    const originalSetItem = window.localStorage.setItem.bind(window.localStorage)
    let callCount = 0

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      callCount++
      if (callCount === 1) {
        const quotaErr = new Error('Quota exceeded test')
        quotaErr.name = 'QuotaExceededError'
        throw quotaErr
      }
      return originalSetItem(key, value)
    })

    const targetKey = `apex_gp_tires_${seasonId}_r${currentRound}`
    const targetValue = JSON.stringify({ tires: 'new_round_4_inventory' })

    expect(() => {
      safeLocalStorageSetItem(targetKey, targetValue, {
        careerId,
        seasonId,
        currentRound,
      })
    }).not.toThrow()

    // O spy deve ter sido chamado 2 vezes (1ª falhou com QuotaExceededError, 2ª gravou)
    expect(callCount).toBe(2)

    // O valor deve ter sido salvo com sucesso
    expect(window.localStorage.getItem(targetKey)).toBe(targetValue)

    // Os dados obsoletos de r1 e r2 foram liberados pelo prune
    expect(window.localStorage.getItem(`apex_gp_tires_${seasonId}_r1`)).toBeNull()
    expect(window.localStorage.getItem(`apex_gp_tires_${seasonId}_r2`)).toBeNull()

    setItemSpy.mockRestore()
  })

  // =========================================================================
  // S6 — QUOTA CONTINUA: Se a segunda tentativa também falhar: erro explícito, sem loop infinito, sem apagar rodada atual.
  // =========================================================================
  it('S6 — QUOTA CONTINUA: Se 2ª tentativa também falhar, lança erro explícito sem apagar rodada atual e sem emitir console.error', () => {
    const currentRound = 4
    const activeKey = `apex_gp_tires_${seasonId}_r${currentRound}`
    const activeVal = 'existing_active_round_data'
    window.localStorage.setItem(activeKey, activeVal)

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    let attempts = 0
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      attempts++
      const quotaErr = new Error('Persistent QuotaExceededError')
      quotaErr.name = 'QuotaExceededError'
      throw quotaErr
    })

    expect(() => {
      safeLocalStorageSetItem('some_large_key', 'some_payload', {
        careerId,
        seasonId,
        currentRound,
      })
    }).toThrow(/Persistent QuotaExceededError/)

    // Tentativas exatamente 2 (1 original + 1 retry após prune), sem loop infinito
    expect(attempts).toBe(2)

    // A rodada atual NUNCA é apagada
    expect(window.localStorage.getItem(activeKey)).toBe(activeVal)

    // Falha persistente esperada é rebaixada para warn e NÃO polui o console com console.error
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "[safeLocalStorageSetItem] Gravação de 'some_large_key' falhou no retry após prune. Cota exaurida persistentemente.",
      ),
      expect.any(Error),
    )

    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    setItemSpy.mockRestore()
  })

  // =========================================================================
  // S7 — HISTÓRICO NECESSÁRIO: Qualquer família marcada como necessária para histórico não é removida indevidamente.
  // =========================================================================
  it('S7 — HISTÓRICO NECESSÁRIO: race_result, snapshot de campeonato e PU allocation não são removidos no prune', () => {
    const currentRound = 5

    // Injetar resultados canônicos de rounds 1 e 2 (histórico de campeonato e carreira)
    const resultKeyR1 = `race_result_${careerId}_s2026_1`
    const journalKeyR1 = `career_apply_result_${careerId}_s2026_1`
    const champKeyR1 = `apex_championship_snapshot_${careerId}_2026_r1`
    const puAllocKey = `apex_gp_pu_allocation_${careerId}`
    const careerDriversKey = `apex_career_drivers_v2_${careerId}`
    const genKey = `apex_weekend_generation_${careerId}_${seasonId}_r1`

    window.localStorage.setItem(resultKeyR1, JSON.stringify({ winner: 'drv1', round: 1 }))
    window.localStorage.setItem(journalKeyR1, JSON.stringify({ status: 'COMPLETE', round: 1 }))
    window.localStorage.setItem(champKeyR1, JSON.stringify({ standings: [], round: 1 }))
    window.localStorage.setItem(puAllocKey, JSON.stringify({ engines: [] }))
    window.localStorage.setItem(careerDriversKey, JSON.stringify({ drivers: [] }))
    window.localStorage.setItem(genKey, '3')

    // Chave obsoleta de round 1 que DEVE ser removida
    window.localStorage.setItem(`apex_gp_tires_${seasonId}_r1`, 'obsolete_tires_r1')

    pruneStorageData({
      careerId,
      seasonId,
      currentRound,
    })

    // Chave obsoleta é removida
    expect(window.localStorage.getItem(`apex_gp_tires_${seasonId}_r1`)).toBeNull()

    // Histórico necessário permanece 100% intacto
    expect(window.localStorage.getItem(resultKeyR1)).not.toBeNull()
    expect(window.localStorage.getItem(journalKeyR1)).not.toBeNull()
    expect(window.localStorage.getItem(champKeyR1)).not.toBeNull()
    expect(window.localStorage.getItem(puAllocKey)).not.toBeNull()
    expect(window.localStorage.getItem(careerDriversKey)).not.toBeNull()
    expect(window.localStorage.getItem(genKey)).toBe('3')
  })

  // =========================================================================
  // S8 — REGRESSÃO: Q1 result, tyre inventory e reset generation da rodada atual continuam funcionais após prune.
  // =========================================================================
  it('S8 — REGRESSÃO: Q1 result, tyre inventory e reset generation continuam funcionais após prune', () => {
    const currentRound = 3

    // 1. Gravar generation e incrementar
    bumpWeekendGeneration({ careerId, seasonId, round: currentRound })
    const activeGen = getActiveWeekendGeneration({ careerId, seasonId, round: currentRound })
    expect(activeGen).toBeGreaterThanOrEqual(2)

    // 2. Gravar pneus via canonicalWeekendTyrePersistence
    const invs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round: currentRound,
      driverIds: ['drv_verstappen', 'drv_norris'],
    })
    expect(invs['drv_verstappen']).toBeDefined()

    // 3. Gravar resultado de Q1
    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'q1',
      seasonId,
      round: currentRound,
      completedAt: new Date().toISOString(),
      entries: [
        {
          position: 1,
          driverId: 'drv_verstappen',
          driverName: 'Max Verstappen',
          teamId: 'team_redbull',
          teamName: 'Red Bull',
          teamColor: '#1e41ff',
          isPlayer: false,
          carId: 'car1',
          bestLapSec: 80.5,
          bestLapTime: '1:20.500',
          bestLapRecordedAtSec: 80.5,
          compound: 'macio',
          tyreSetId: 't1',
          lapsCount: 5,
          isEliminated: false,
        },
      ],
      advancingDriverIds: ['drv_verstappen'],
      eliminatedDriverIds: ['drv_bottas'],
    })

    // Adicionar chave velha para disparar prune
    window.localStorage.setItem(`apex_gp_tires_${seasonId}_r1`, 'old_tires')

    // Executar prune
    const pruneRes = pruneStorageData({
      careerId,
      seasonId,
      currentRound,
    })
    expect(pruneRes.prunedKeys).toContain(`apex_gp_tires_${seasonId}_r1`)

    // Verificar leitura funcional pós-prune:
    // A) Tyre inventory
    const readTires = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, currentRound)
    expect(readTires).not.toBeNull()
    expect(readTires?.inventoriesByDriver['drv_verstappen']).toBeDefined()

    // B) Q1 stage result
    const readQ1 = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      currentRound,
      'q1',
    )
    expect(readQ1).not.toBeNull()
    expect(readQ1?.entries[0].driverId).toBe('drv_verstappen')
    expect(readQ1?.eliminatedDriverIds).toContain('drv_bottas')

    // C) Generation
    const postPruneGen = getActiveWeekendGeneration({ careerId, seasonId, round: currentRound })
    expect(postPruneGen).toBe(activeGen)
  })
})
