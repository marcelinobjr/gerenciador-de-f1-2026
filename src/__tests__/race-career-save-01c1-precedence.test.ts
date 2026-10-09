/**
 * race-career-save-01c1-precedence.test.ts
 *
 * Microbloco RACE-CAREER-SAVE-01C1:
 * Contrato de Precedência e Robustez da Persistência Remota do Resultado:
 * 1. A confirmação remota do resultado precede a entrada no loop de efeitos (ordem observável).
 * 2. Backend rejeitado ou conflito de hash -> o loop de efeitos NÃO é chamado e o erro é propagado.
 * 3. localStorage indisponível não impede a persistência remota do resultado; falha posterior (no loop) é distinguida.
 * 4. A confirmação isolada do resultado NÃO marca o journal como COMPLETE.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  canonicalCareerPersistenceService,
  type CareerApplicationJournal,
} from '@/services/canonicalCareerPersistenceService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'
import pb from '@/lib/pocketbase/client'

describe('RACE-CAREER-SAVE-01C1 — Precedência da Persistência Remota do Resultado', () => {
  const careerId = '31b0p9k5ygw2sc8'
  const season = 2026
  const round = 1

  const mockOfficialResult: OfficialRaceResult = {
    schemaVersion: 'official-race-result-v1',
    officialResultId: `orr_${careerId}_s${season}_r${round}_1741500000`,
    raceVariant: 'MAIN_RACE',
    careerId,
    season,
    round,
    raceId: 'race_melbourne_2026',
    circuitId: 'albert_park',
    circuitName: 'Albert Park Circuit',
    circuitCountry: 'Austrália',
    playerTeamId: 'nn7kruxy4qlvgwr',
    officializedAt: new Date().toISOString(),
    totalLaps: 58,
    winnerDriverId: 'driver_piastri',
    winnerTeamId: 'team_mclaren',
    poleDriverId: 'driver_verstappen',
    fastestLapDriverId: 'driver_norris',
    podium: ['driver_piastri', 'driver_norris', 'driver_leclerc'],
    entries: [
      {
        driverId: 'driver_piastri',
        teamId: 'team_mclaren',
        driverName: 'Oscar Piastri',
        teamName: 'McLaren F1 Team',
        teamColor: '#FF8000',
        isPlayer: false,
        gridPosition: 2,
        finalPosition: 1,
        positionsGainedLost: 1,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 25,
      } as any,
      {
        driverId: 'driver_norris',
        teamId: 'team_mclaren',
        driverName: 'Lando Norris',
        teamName: 'McLaren F1 Team',
        teamColor: '#FF8000',
        isPlayer: false,
        gridPosition: 1,
        finalPosition: 2,
        positionsGainedLost: -1,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 18,
      } as any,
    ],
    playerEntries: [
      {
        driverId: 'driver_hulkenberg',
        teamId: 'nn7kruxy4qlvgwr',
        driverName: 'Nico Hülkenberg',
        teamName: 'Audi F1 Team',
        teamColor: '#C0C0C0',
        isPlayer: true,
        gridPosition: 8,
        finalPosition: 7,
        positionsGainedLost: 1,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 6,
      } as any,
      {
        driverId: 'driver_bortoleto',
        teamId: 'nn7kruxy4qlvgwr',
        driverName: 'Gabriel Bortoleto',
        teamName: 'Audi F1 Team',
        teamColor: '#C0C0C0',
        isPlayer: true,
        gridPosition: 10,
        finalPosition: 9,
        positionsGainedLost: 1,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 2,
      } as any,
    ],
    eventsSummary: {
      safetyCarPeriods: 0,
      safetyCarLaps: 0,
      vscPeriods: 0,
      vscLaps: 0,
      redFlagPeriods: 0,
      dnfCount: 0,
      totalPitStops: 1,
      significantIncidents: [],
    },
    resultHash: 'sha256-mock-official-hash-01c1',
  }

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(canonicalRaceResultService, 'verifyResultIntegrity').mockReturnValue(true)
  })

  it('1. A confirmação remota do resultado precede a entrada no loop de efeitos (ordem observável)', async () => {
    const executionOrder: string[] = []

    // Monitorar a chamada do saveOfficialRaceResultToBackend
    vi.spyOn(canonicalRaceResultService, 'saveOfficialRaceResultToBackend').mockImplementation(
      async () => {
        executionOrder.push('saveOfficialRaceResultToBackend')
        return { success: true, recordId: 'res_rec_remote_1' }
      },
    )

    // Monitorar a chamada do loop de aplicação assíncrono (executeCareerApplicationLoopAsync)
    const loopSpy = vi
      .spyOn(canonicalCareerPersistenceService, 'executeCareerApplicationLoopAsync')
      .mockImplementation(async ({ officialResult: res }) => {
        executionOrder.push('executeCareerApplicationLoopAsync')
        const journal: CareerApplicationJournal = {
          key: `career_apply_result_${res.careerId}_s${res.season}_${res.round}_main`,
          careerId: res.careerId,
          season: res.season,
          round: res.round,
          officialRaceResultId: res.officialResultId,
          checksum: res.resultHash,
          status: 'COMPLETE',
          appliedDriverIds: ['driver_piastri', 'driver_norris'],
          totalEntries: 2,
          version: 1,
          startedAt: new Date().toISOString(),
        }
        return {
          success: true,
          alreadyRegistered: false,
          persistedResult: {
            id: `race_result_${res.careerId}_s${res.season}_${res.round}_main`,
            careerId: res.careerId,
            seasonId: `s${res.season}`,
            season: res.season,
            round: res.round,
            eventId: `event_${res.careerId}_s${res.season}_r${res.round}`,
            circuitId: res.circuitId,
            officialRaceResultId: res.officialResultId,
            checksum: res.resultHash,
            winnerDriverId: res.winnerDriverId,
            poleDriverId: res.poleDriverId,
            fastestLapDriverId: res.fastestLapDriverId,
            officializedAt: res.officializedAt,
            createdAt: new Date().toISOString(),
            entries: res.entries,
            playerEntries: res.playerEntries,
            snapshot: res,
          },
          journal,
        }
      })

    // Mock pb.collection para garantir que pb está ativo
    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_career_apply_journals') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }),
          create: vi.fn().mockImplementation((payload) => {
            executionOrder.push('saveApplicationJournalToBackend')
            return Promise.resolve({ id: 'journal_rec_1', ...payload })
          }),
        } as any
      }
      if (name === 'race_results') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }),
          update: vi.fn().mockResolvedValue({ id: 'res_rec_remote_1' }),
        } as any
      }
      return {} as any
    })

    const res = await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
      mockOfficialResult,
      { requireBackendSync: true },
    )

    expect(res.success).toBe(true)
    // Ordem estrita: Backend resultado -> Loop assíncrono
    expect(executionOrder[0]).toBe('saveOfficialRaceResultToBackend')
    expect(executionOrder[1]).toBe('executeCareerApplicationLoopAsync')
    expect(loopSpy).toHaveBeenCalled()
  })

  it('2. Backend rejeitado ou conflito de hash -> o loop de efeitos NÃO é chamado e o erro é propagado', async () => {
    // Simular rejeição de rede / conflito no saveOfficialRaceResultToBackend
    vi.spyOn(canonicalRaceResultService, 'saveOfficialRaceResultToBackend').mockRejectedValue(
      new Error('Conflito de resultado oficial detectado no backend: hash divergente.'),
    )

    const loopSpy = vi.spyOn(canonicalCareerPersistenceService, 'executeCareerApplicationLoopAsync')

    // Com requireBackendSync: true
    const res = await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
      mockOfficialResult,
      { requireBackendSync: true },
    )

    expect(res.success).toBe(false)
    expect(res.error).toContain('Conflito de resultado oficial detectado no backend')
    // O loop de efeitos NÃO foi chamado
    expect(loopSpy).not.toHaveBeenCalled()
  })

  it('2b. Backend rejeitado sem requireBackendSync propaga exceção e NÃO executa loop de efeitos', async () => {
    vi.spyOn(canonicalRaceResultService, 'saveOfficialRaceResultToBackend').mockRejectedValue(
      new Error('Network error 503 Service Unavailable'),
    )

    const loopSpy = vi.spyOn(canonicalCareerPersistenceService, 'executeCareerApplicationLoopAsync')

    await expect(
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(mockOfficialResult),
    ).rejects.toThrow(/Network error 503 Service Unavailable/)

    // O loop de efeitos NÃO foi chamado
    expect(loopSpy).not.toHaveBeenCalled()
  })

  it('3. localStorage indisponível não impede a persistência remota; falha posterior (no loop) é distinguida', async () => {
    // Simular localStorage lançando QuotaExceededError
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string) => {
      throw new DOMException(`Quota exceeded for ${key}`, 'QuotaExceededError')
    })

    let backendSaveCalled = false
    vi.spyOn(canonicalRaceResultService, 'saveOfficialRaceResultToBackend').mockImplementation(
      async () => {
        backendSaveCalled = true
        return { success: true, recordId: 'res_rec_remote_quota' }
      },
    )

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_career_apply_journals') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }),
          create: vi.fn().mockResolvedValue({ id: 'journal_rec_remote' }),
        } as any
      }
      if (name === 'race_results') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }),
          update: vi.fn().mockResolvedValue({ id: 'res_rec_remote_quota' }),
        } as any
      }
      return {} as any
    })

    // Caso 3a: Persistência remota ocorre normalmente mesmo sem localStorage
    const res = await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
      mockOfficialResult,
      { requireBackendSync: true },
    )

    expect(backendSaveCalled).toBe(true)
    expect(res.success).toBe(true)
    expect(res.journal.status).toBe('COMPLETE')

    // Caso 3b: Falha dentro do loop (após persistência do resultado) é distinguida
    // Simular que o loop falhou por erro de processamento
    vi.spyOn(
      canonicalCareerPersistenceService,
      'executeCareerApplicationLoopAsync',
    ).mockResolvedValueOnce({
      success: false,
      alreadyRegistered: false,
      persistedResult: null,
      journal: {
        key: `career_apply_result_${mockOfficialResult.careerId}_s${mockOfficialResult.season}_${mockOfficialResult.round}_main`,
        careerId: mockOfficialResult.careerId,
        season: mockOfficialResult.season,
        round: mockOfficialResult.round,
        officialRaceResultId: mockOfficialResult.officialResultId,
        checksum: mockOfficialResult.resultHash,
        status: 'FAILED',
        appliedDriverIds: [],
        totalEntries: 2,
        version: 1,
        startedAt: new Date().toISOString(),
        lastError: 'Falha forçada no loop de pilotos',
      },
      error: 'Falha forçada no loop de pilotos',
    })

    const failRes = await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
      mockOfficialResult,
      { requireBackendSync: true },
    )

    // O resultado no backend foi chamado antes da falha no loop
    expect(failRes.success).toBe(false)
    expect(failRes.error).toBe('Falha forçada no loop de pilotos')
    expect(failRes.journal.status).toBe('FAILED')
  })

  it('4. A confirmação isolada do resultado NÃO marca o journal como COMPLETE', async () => {
    // 4a. Apenas persistir o resultado no backend
    let savedInBackend = false
    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'race_results') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }),
          create: vi.fn().mockImplementation(() => {
            savedInBackend = true
            return Promise.resolve({ id: 'res_rec_1' })
          }),
        } as any
      }
      if (name === 'seasons') {
        return {
          getOne: vi.fn().mockResolvedValue({ id: careerId }),
          getFirstListItem: vi.fn().mockResolvedValue({ id: careerId }),
        } as any
      }
      return {} as any
    })

    const saveRes =
      await canonicalRaceResultService.saveOfficialRaceResultToBackend(mockOfficialResult)
    expect(saveRes.success).toBe(true)
    expect(savedInBackend).toBe(true)

    // 4b. Verificar que o journal NÃO foi marcado como COMPLETE
    const journal = canonicalCareerPersistenceService.getApplicationJournal(
      careerId,
      season,
      round,
      'MAIN_RACE',
    )
    expect(journal).toBeNull()

    // 4c. O registro da carreira continua não concluído (isResultRegistered = false)
    const isRegistered = canonicalCareerPersistenceService.isResultRegistered(
      careerId,
      season,
      round,
      'MAIN_RACE',
    )
    expect(isRegistered).toBe(false)
  })
})
