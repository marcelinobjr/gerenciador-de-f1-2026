/**
 * race-career-save-quota-01.test.ts
 *
 * Suíte de testes para a tarefa RACE-CAREER-SAVE-01:
 * - Tolerância à falha de cota do localStorage durante gravação do resultado e journal
 * - Preservação de efeitos já aplicados sem reprocessamento duplicado
 * - Bloqueio de avanço com explicação clara quando pendente/falha
 * - Sincronização e autoridade da gravação
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'
import pb from '@/lib/pocketbase/client'

describe('RACE-CAREER-SAVE-01 — Persistência de Carreira e Tolerância a Cota de Storage', () => {
  const dummyCareerId = 'test_career_quota_01'
  const season = 2026
  const round = 1

  const mockOfficialResult: any = {
    schemaVersion: 'official-race-result-v1',
    officialResultId: `orr_${dummyCareerId}_s${season}_r${round}_12345`,
    raceVariant: 'MAIN_RACE',
    careerId: dummyCareerId,
    season,
    round,
    raceId: 'race_test_1',
    circuitId: 'albert_park',
    circuitName: 'Albert Park Circuit',
    circuitCountry: 'Australia',
    playerTeamId: 'team_audi',
    officializedAt: new Date().toISOString(),
    totalLaps: 58,
    winnerDriverId: 'driver_verstappen',
    winnerTeamId: 'team_redbull',
    poleDriverId: 'driver_verstappen',
    fastestLapDriverId: 'driver_verstappen',
    podium: ['driver_verstappen', 'driver_norris', 'driver_leclerc'],
    entries: [
      {
        driverId: 'driver_verstappen',
        teamId: 'team_redbull',
        driverName: 'Max Verstappen',
        teamName: 'Red Bull Racing',
        gridPosition: 1,
        finalPosition: 1,
        positionsGainedLost: 0,
        lapsCompleted: 58,
        pointsAwarded: 25,
        status: 'finished',
        isPlayer: false,
      },
      {
        driverId: 'driver_norris',
        teamId: 'team_mclaren',
        driverName: 'Lando Norris',
        teamName: 'McLaren',
        gridPosition: 2,
        finalPosition: 2,
        positionsGainedLost: 0,
        lapsCompleted: 58,
        pointsAwarded: 18,
        status: 'finished',
        isPlayer: false,
      },
    ],
    playerEntries: [],
    resultHash: `hash_${dummyCareerId}`,
  }

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('1. Gravação suporta QuotaExceededError no localStorage sem quebrar a execução', () => {
    // Simular QuotaExceededError ao tentar salvar qualquer chave com setItem
    const origSetItem = localStorage.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      if (key.includes('career_apply_result') || key.includes('race_result')) {
        const quotaError = new DOMException(
          `Setting the value of '${key}' exceeded the quota.`,
          'QuotaExceededError',
        )
        throw quotaError
      }
      return origSetItem.call(localStorage, key, value)
    })

    // Executar registro na carreira
    const res =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mockOfficialResult)

    // O registro deve concluir sem lançar exceção não capturada
    expect(res).toBeDefined()
    expect(res.journal).toBeDefined()
    // O status do journal em memória deve ser COMPLETE
    expect(res.journal.status).toBe('COMPLETE')
  })

  it('2. registerOfficialRaceResultInCareerAsync sincroniza com PocketBase e propaga status', async () => {
    // Mock pb collection
    const mockUpdate = vi.fn().mockResolvedValue({ id: 'rec_pb_123' })
    const mockGetFirst = vi.fn().mockResolvedValue({ id: 'rec_pb_123' })

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'race_results') {
        return {
          getFirstListItem: mockGetFirst,
          update: mockUpdate,
        } as any
      }
      return {} as any
    })

    const res = await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
      mockOfficialResult,
      { requireBackendSync: true },
    )

    expect(res.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('3. Falha no Backend propaga erro quando requireBackendSync está ativo', async () => {
    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'race_results') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue(new Error('Network error')),
          create: vi.fn().mockRejectedValue(new Error('PocketBase write failed 500')),
        } as any
      }
      if (name === 'seasons') {
        return {
          getFirstListItem: vi.fn().mockResolvedValue({ id: 's12345678901234' }),
        } as any
      }
      return {} as any
    })

    const res = await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
      mockOfficialResult,
      { requireBackendSync: true },
    )

    expect(res.success).toBe(false)
    expect(res.error).toBeDefined()
  })

  it('4. Retomada não duplica efeitos já gravados no journal', () => {
    // Injetar falha parcial no primeiro piloto
    const partialRes = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(
      mockOfficialResult,
      { simulateFailureAfterIndex: 0 },
    )
    expect(partialRes.success).toBe(false)
    expect(partialRes.journal.status).toBe('FAILED')

    // Ao tentar novamente, recupera journal e conclui sem duplicar
    const retryRes =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mockOfficialResult)
    expect(retryRes.success).toBe(true)
    expect(retryRes.journal.status).toBe('COMPLETE')
    expect(retryRes.journal.appliedDriverIds.length).toBe(mockOfficialResult.entries.length)
  })
})
