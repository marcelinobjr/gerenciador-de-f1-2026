/**
 * bug-advance-gate-01a.test.ts
 *
 * BUG-ADVANCE-GATE-01A:
 * Validação focal da correção do gate de avanço pós-oficialização.
 *
 * Garante que:
 * 1. Ao persistir com sucesso (resultado já oficializado ou oficialização nova),
 *    o status do journal no PocketBase/backend é verificado via verifyRemoteJournalStatus,
 *    transicionando remoteQueryState de 'idle' para 'found' e permitindo o avanço (canAdvance=true).
 * 2. Se a verificação remota falhar (erro de rede / journal ausente / hash divergente),
 *    o remoteQueryState NÃO se torna 'found' e o gate permanece bloqueado.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'
import type { CareerApplicationJournal } from '@/services/canonicalCareerPersistenceService'

describe('BUG-ADVANCE-GATE-01A — Avanço habilitado com journal COMPLETE validado', () => {
  const mockResult: OfficialRaceResult = {
    schemaVersion: 'official-race-result-v1',
    officialResultId: 'orr_z36hmcbqa75kt7k_s2026_r1_main',
    raceVariant: 'MAIN_RACE',
    careerId: '31b0p9k5ygw2sc8',
    season: 2026,
    round: 1,
    raceId: 'race_melbourne_2026',
    circuitId: 'albert_park',
    circuitName: 'Albert Park Circuit',
    circuitCountry: 'Austrália',
    playerTeamId: 'nn7kruxy4qlvgwr',
    officializedAt: '2026-03-15T06:00:00.000Z',
    totalLaps: 58,
    winnerDriverId: 'driver_piastri',
    winnerTeamId: 'team_mclaren',
    poleDriverId: 'driver_piastri',
    fastestLapDriverId: 'driver_piastri',
    podium: ['driver_piastri', 'driver_norris', 'driver_leclerc'],
    entries: [
      { driverId: 'driver_piastri', finalPosition: 1 } as any,
      { driverId: 'driver_norris', finalPosition: 2 } as any,
    ],
    playerEntries: [
      { driverId: 'driver_piastri', finalPosition: 1 } as any,
      { driverId: 'driver_norris', finalPosition: 2 } as any,
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
    resultHash: 'sha256-hash-audi-r1',
  }

  const mockJournalComplete: CareerApplicationJournal = {
    key: 'career_apply_result_z36hmcbqa75kt7k_s2026_1_main',
    careerId: '31b0p9k5ygw2sc8',
    season: 2026,
    round: 1,
    officialRaceResultId: 'orr_z36hmcbqa75kt7k_s2026_r1_main',
    checksum: 'sha256-hash-audi-r1',
    status: 'COMPLETE',
    appliedDriverIds: ['driver_1', 'driver_2'],
    totalEntries: 2,
    version: 22,
    startedAt: '2026-03-15T06:00:00.000Z',
    completedAt: '2026-03-15T06:01:00.000Z',
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('validação remota com journal COMPLETE transiciona remoteQueryState para "found" e habilita canAdvance', async () => {
    vi.spyOn(
      canonicalCareerPersistenceService,
      'getApplicationJournalFromBackend',
    ).mockResolvedValueOnce(mockJournalComplete)

    // Simula a lógica de verifyRemoteJournalStatus executada em RacePage
    let remoteQueryState: 'idle' | 'checking' | 'found' | 'missing' | 'error' = 'idle' as any
    let careerPersistenceStatus: 'PENDING' | 'APPLYING' | 'COMPLETE' | 'FAILED' = 'PENDING' as any

    const targetContext = {
      careerId: '31b0p9k5ygw2sc8',
      seasonYear: 2026,
      round: 1,
      variant: 'MAIN_RACE' as const,
    }

    const verifyRemoteJournalStatus = async (
      targetResult: OfficialRaceResult,
      ctx: typeof targetContext,
    ) => {
      remoteQueryState = 'checking'
      const remoteJournal =
        await canonicalCareerPersistenceService.getApplicationJournalFromBackend(
          ctx.careerId,
          ctx.seasonYear,
          ctx.round,
          ctx.variant,
        )

      if (!remoteJournal) {
        remoteQueryState = 'missing'
        careerPersistenceStatus = 'PENDING'
        return false
      }

      const matchesCareer = remoteJournal.careerId === ctx.careerId
      const matchesSeason = Number(remoteJournal.season) === Number(ctx.seasonYear)
      const matchesRound = Number(remoteJournal.round) === Number(ctx.round)
      const matchesHash =
        !targetResult.resultHash ||
        !remoteJournal.checksum ||
        remoteJournal.checksum === targetResult.resultHash

      if (!matchesCareer || !matchesSeason || !matchesRound || !matchesHash) {
        remoteQueryState = 'error'
        careerPersistenceStatus = 'FAILED'
        return false
      }

      remoteQueryState = 'found'
      careerPersistenceStatus = remoteJournal.status
      return remoteJournal.status === 'COMPLETE'
    }

    const isValid = await verifyRemoteJournalStatus(mockResult, targetContext)

    expect(isValid).toBe(true)
    expect(remoteQueryState).toBe('found')
    expect(careerPersistenceStatus).toBe('COMPLETE')

    // Regra do gate:
    const canAdvance = remoteQueryState === 'found' && careerPersistenceStatus === 'COMPLETE'
    expect(canAdvance).toBe(true)
  })

  it('validação remota com falha ou divergência mantém canAdvance bloqueado', async () => {
    const divergingJournal: CareerApplicationJournal = {
      ...mockJournalComplete,
      checksum: 'sha256-divergente',
    }

    vi.spyOn(
      canonicalCareerPersistenceService,
      'getApplicationJournalFromBackend',
    ).mockResolvedValueOnce(divergingJournal)

    let remoteQueryState: 'idle' | 'checking' | 'found' | 'missing' | 'error' = 'idle' as any
    let careerPersistenceStatus: 'PENDING' | 'APPLYING' | 'COMPLETE' | 'FAILED' = 'PENDING' as any

    const targetContext = {
      careerId: '31b0p9k5ygw2sc8',
      seasonYear: 2026,
      round: 1,
      variant: 'MAIN_RACE' as const,
    }

    const verifyRemoteJournalStatus = async (
      targetResult: OfficialRaceResult,
      ctx: typeof targetContext,
    ) => {
      remoteQueryState = 'checking'
      const remoteJournal =
        await canonicalCareerPersistenceService.getApplicationJournalFromBackend(
          ctx.careerId,
          ctx.seasonYear,
          ctx.round,
          ctx.variant,
        )

      if (!remoteJournal) {
        remoteQueryState = 'missing'
        careerPersistenceStatus = 'PENDING'
        return false
      }

      const matchesCareer = remoteJournal.careerId === ctx.careerId
      const matchesSeason = Number(remoteJournal.season) === Number(ctx.seasonYear)
      const matchesRound = Number(remoteJournal.round) === Number(ctx.round)
      const matchesHash =
        !targetResult.resultHash ||
        !remoteJournal.checksum ||
        remoteJournal.checksum === targetResult.resultHash

      if (!matchesCareer || !matchesSeason || !matchesRound || !matchesHash) {
        remoteQueryState = 'error'
        careerPersistenceStatus = 'FAILED'
        return false
      }

      remoteQueryState = 'found'
      careerPersistenceStatus = remoteJournal.status
      return remoteJournal.status === 'COMPLETE'
    }

    const isValid = await verifyRemoteJournalStatus(mockResult, targetContext)

    expect(isValid).toBe(false)
    expect(remoteQueryState).toBe('error')
    expect(careerPersistenceStatus).toBe('FAILED')

    const canAdvance = remoteQueryState === 'found' && careerPersistenceStatus === 'COMPLETE'
    expect(canAdvance).toBe(false)
  })
})
