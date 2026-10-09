/**
 * race-career-save-01c2a-backend-authority.test.ts
 *
 * Microbloco RACE-CAREER-SAVE-01C2A:
 * Garantir que getApplicationJournalFromBackend e saveApplicationJournalToBackend
 * retornam evidência do backend e que o localStorage serve apenas como cache opcional,
 * nunca como confirmação de leitura ou gravação remota.
 *
 * Testes focais:
 * 1. Leitura e gravação remotas funcionam com localStorage indisponível.
 * 2. Backend com erro + cache local COMPLETE: erro propagado, sem falso sucesso.
 * 3. Backend sem registro + cache local existente: ausência remota permanece explícita (null).
 * 4. Gravação rejeitada não retorna sucesso; gravação confirmada seguida de falha do cache continua confirmada.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  canonicalCareerPersistenceService,
  type CareerApplicationJournal,
} from '@/services/canonicalCareerPersistenceService'
import pb from '@/lib/pocketbase/client'

describe('RACE-CAREER-SAVE-01C2A — Autoridade Remota de Leitura e Gravação do Journal', () => {
  const careerId = 'career_test_01c2a'
  const season = 2026
  const round = 1
  const raceVariant = 'MAIN_RACE'
  const journalKey = `career_apply_result_${careerId}_s2026_1_main`

  const sampleJournal: CareerApplicationJournal = {
    key: journalKey,
    careerId,
    season,
    round,
    officialRaceResultId: 'orr_melbourne_2026_01c2a',
    checksum: 'hash_sha256_mock_01c2a',
    status: 'COMPLETE',
    appliedDriverIds: ['driver_norris', 'driver_piastri'],
    totalEntries: 2,
    version: 1,
    startedAt: '2026-03-15T05:00:00.000Z',
    completedAt: '2026-03-15T05:01:00.000Z',
  }

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('1. Leitura e gravação remotas funcionam perfeitamente com localStorage indisponível', async () => {
    // Simular indisponibilidade completa do localStorage (throws em qualquer chamada ou ausente)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: localStorage is disabled')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: localStorage is disabled')
    })

    const remoteDbRecord = {
      id: 'rec_pb_journal_01',
      journal_key: journalKey,
      career_id: careerId,
      season,
      round,
      race_variant: 'MAIN_RACE',
      official_race_result_id: sampleJournal.officialRaceResultId,
      result_hash: sampleJournal.checksum,
      status: 'COMPLETE',
      applied_driver_ids: sampleJournal.appliedDriverIds,
      total_entries: 2,
      version: 1,
      started_at: sampleJournal.startedAt,
      completed_at: sampleJournal.completedAt,
    }

    vi.spyOn(pb, 'collection').mockImplementation((col: string) => {
      if (col === 'canonical_career_apply_journals') {
        return {
          getFullList: vi.fn().mockResolvedValue([remoteDbRecord]),
          getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }),
          create: vi.fn().mockResolvedValue({ id: 'rec_pb_created_99' }),
        } as any
      }
      return {} as any
    })

    // Leitura remota funciona e retorna o registro do backend
    const readResult = await canonicalCareerPersistenceService.getApplicationJournalFromBackend(
      careerId,
      season,
      round,
      raceVariant,
    )
    expect(readResult).not.toBeNull()
    expect(readResult?.status).toBe('COMPLETE')
    expect(readResult?.officialRaceResultId).toBe(sampleJournal.officialRaceResultId)
    expect(readResult?.appliedDriverIds).toEqual(['driver_norris', 'driver_piastri'])

    // Gravação remota funciona mesmo com falha no cache local
    const writeResult = await canonicalCareerPersistenceService.saveApplicationJournalToBackend(
      sampleJournal,
      raceVariant,
    )
    expect(writeResult.success).toBe(true)
    expect(writeResult.recordId).toBe('rec_pb_created_99')
  })

  it('2. Backend com erro + cache local COMPLETE: erro propagado, sem falso sucesso', async () => {
    // Colocar um journal com status COMPLETE no localStorage
    canonicalCareerPersistenceService.saveApplicationJournal(sampleJournal, raceVariant)
    expect(
      canonicalCareerPersistenceService.getApplicationJournal(careerId, season, round, raceVariant),
    ).not.toBeNull()

    // Configurar o PocketBase para falhar (erro 503 Service Unavailable / timeout de rede)
    vi.spyOn(pb, 'collection').mockImplementation((col: string) => {
      if (col === 'canonical_career_apply_journals') {
        return {
          getFullList: vi.fn().mockRejectedValue(new Error('503 Service Unavailable')),
        } as any
      }
      return {} as any
    })

    // Deve propagar o erro; NUNCA mascarar a falha retornando o cache local COMPLETE como falso sucesso
    await expect(
      canonicalCareerPersistenceService.getApplicationJournalFromBackend(
        careerId,
        season,
        round,
        raceVariant,
      ),
    ).rejects.toThrow('503 Service Unavailable')
  })

  it('3. Backend sem registro + cache local existente: ausência remota permanece explícita (null)', async () => {
    // Salvar cache local prévio
    canonicalCareerPersistenceService.saveApplicationJournal(sampleJournal, raceVariant)
    expect(
      canonicalCareerPersistenceService.getApplicationJournal(careerId, season, round, raceVariant),
    ).not.toBeNull()

    // PocketBase responde com lista vazia (registro ausente)
    vi.spyOn(pb, 'collection').mockImplementation((col: string) => {
      if (col === 'canonical_career_apply_journals') {
        return {
          getFullList: vi.fn().mockResolvedValue([]),
        } as any
      }
      return {} as any
    })

    const result = await canonicalCareerPersistenceService.getApplicationJournalFromBackend(
      careerId,
      season,
      round,
      raceVariant,
    )

    // A ausência remota deve permanecer explícita (null), mesmo que exista cache local
    expect(result).toBeNull()
  })

  it('4. Gravação rejeitada não retorna sucesso; gravação confirmada seguida de falha do cache continua confirmada', async () => {
    // Cenário 4A: Gravação rejeitada pelo backend (ex: erro de rede 500)
    vi.spyOn(pb, 'collection').mockImplementation((col: string) => {
      if (col === 'canonical_career_apply_journals') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }),
          create: vi.fn().mockRejectedValue(new Error('Falha de conexão com PocketBase')),
        } as any
      }
      return {} as any
    })

    // Gravação rejeitada DEVE lançar exceção ou falhar, sem retornar { success: true }
    await expect(
      canonicalCareerPersistenceService.saveApplicationJournalToBackend(sampleJournal, raceVariant),
    ).rejects.toThrow('Falha de conexão com PocketBase')

    // Cenário 4B: Gravação confirmada pelo backend, mas o cache local (localStorage) falha logo depois
    let setItemCalls = 0
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      setItemCalls++
      if (setItemCalls > 1) {
        throw new DOMException('QuotaExceededError after PB write', 'QuotaExceededError')
      }
    })

    vi.spyOn(pb, 'collection').mockImplementation((col: string) => {
      if (col === 'canonical_career_apply_journals') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }),
          create: vi.fn().mockResolvedValue({ id: 'rec_confirmed_backend_777' }),
        } as any
      }
      return {} as any
    })

    const confirmedRes = await canonicalCareerPersistenceService.saveApplicationJournalToBackend(
      sampleJournal,
      raceVariant,
    )

    // O sucesso remoto DEVE ser preservado; a falha posterior do cache não anula o sucesso
    expect(confirmedRes.success).toBe(true)
    expect(confirmedRes.recordId).toBe('rec_confirmed_backend_777')
  })
})
