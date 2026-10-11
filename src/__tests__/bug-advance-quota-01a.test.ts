/**
 * bug-advance-quota-01a.test.ts
 *
 * Suíte de testes para BUG-ADVANCE-QUOTA-01A:
 * CONTINUAR na /race falha com QuotaExceededError ao gravar championship_* no localStorage.
 * Fix:
 * 1. Podar espelhos locais de dados já canônicos no PB (journals COMPLETE, snapshots antigos, resultados de rodadas antigas);
 * 2. Try/catch de quota em saveSnapshot e processAndPersistRoundChampionship que degrada para backend-preferred sem bloquear o avanço;
 * 3. Poda no boot se storage > ~3MB;
 * 4. CONTINUAR -> Rodada 4 (Bahrein) avança com sucesso sem travar por QuotaExceededError.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { advanceWeekendRound } from '@/services/canonicalRoundAdvanceHelper'
import {
  pruneStorageData,
  runPreventiveStorageCleanup,
  runBootStorageHygieneIfExceeded,
  APEX_STORAGE_FAMILIES,
  STORAGE_WARNING_THRESHOLD_BYTES,
} from '@/services/storageQuotaService'
import { f1Service } from '@/services/f1Service'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'

describe('BUG-ADVANCE-QUOTA-01A — Resiliência a QuotaExceededError no avanço esportivo e poda de espelhos', () => {
  const CAREER_ID = 'career_quota_01a'
  const SEASON_ID = 's2026'
  const SEASON_YEAR = 2026

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('1. saveSnapshot não lança QuotaExceededError e degrada graciosamente para backend-preferred', () => {
    const originalSetItem = window.localStorage.setItem

    // Simular QuotaExceededError sistemático no localStorage
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      const quotaErr = new Error('QuotaExceededError: The quota has been exceeded.')
      quotaErr.name = 'QuotaExceededError'
      throw quotaErr
    })

    const mockSnapshot = {
      id: `championship_${CAREER_ID}_2026_r3`,
      careerId: CAREER_ID,
      season: 2026,
      throughRound: 3,
      sourceRaceResultIds: ['res1', 'res2', 'res3'],
      sourceChecksums: ['chk1', 'chk2', 'chk3'],
      driverStandings: [
        {
          position: 1,
          driverId: 'drv_1',
          driverName: 'Max Verstappen',
          teamId: 'red_bull',
          teamName: 'Red Bull Racing',
          points: 75,
          wins: 3,
          podiums: 3,
          racesCounted: 3,
        },
      ] as any[],
      constructorStandings: [
        {
          position: 1,
          teamId: 'red_bull',
          teamName: 'Red Bull Racing',
          points: 75,
          wins: 3,
          podiums: 3,
          racesCounted: 3,
        },
      ] as any[],
      createdAt: new Date().toISOString(),
      schemaVersion: 'championship-snapshot-v1' as const,
    }

    // Não deve lançar erro
    expect(() => {
      canonicalChampionshipService.saveSnapshot(mockSnapshot)
    }).not.toThrow()
  })

  it('2. processAndPersistRoundChampionship não quebra o fluxo quando localStorage está saturado', () => {
    // Mockar rebuildChampionshipStandings para retornar um snapshot válido
    vi.spyOn(canonicalChampionshipService, 'rebuildChampionshipStandings').mockReturnValue({
      id: `championship_${CAREER_ID}_2026_r3`,
      careerId: CAREER_ID,
      season: 2026,
      throughRound: 3,
      sourceRaceResultIds: ['res_r3'],
      sourceChecksums: ['chk_r3'],
      driverStandings: [],
      constructorStandings: [],
      createdAt: new Date().toISOString(),
      schemaVersion: 'championship-snapshot-v1' as const,
    } as any)

    // Forçar saveSnapshot a falhar ou localStorage com QuotaExceededError
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      const err = new DOMException('Storage quota exceeded', 'QuotaExceededError')
      throw err
    })

    let snapshotResult: any = null
    expect(() => {
      snapshotResult = canonicalChampionshipService.processAndPersistRoundChampionship(
        CAREER_ID,
        2026,
        3,
        'audi',
      )
    }).not.toThrow()

    expect(snapshotResult).toBeDefined()
    expect(snapshotResult.throughRound).toBe(3)
  })

  it('3. runPreventiveStorageCleanup remove snapshots e journals COMPLETE de rodadas antigas (< currentRound - 1)', () => {
    // Simular dados locais de R1, R2, R3 e R4
    // R1: antiga (< 4 - 1 = 3), deve ser podada
    // R2: antiga (< 4 - 1 = 3), deve ser podada
    // R3: imediatamente anterior (4 - 1 = 3), DEVE SER PRESERVADA
    // R4: atual, DEVE SER PRESERVADA

    // Snapshot R1 e R2
    localStorage.setItem(
      `championship_${CAREER_ID}_2026_r1`,
      JSON.stringify({ round: 1, data: 'snap1' }),
    )
    localStorage.setItem(
      `championship_${CAREER_ID}_2026_r2`,
      JSON.stringify({ round: 2, data: 'snap2' }),
    )
    localStorage.setItem(
      `championship_${CAREER_ID}_2026_r3`,
      JSON.stringify({ round: 3, data: 'snap3' }),
    )
    localStorage.setItem(
      `championship_${CAREER_ID}_2026_r4`,
      JSON.stringify({ round: 4, data: 'snap4' }),
    )

    // Journals COMPLETE
    localStorage.setItem(
      `career_apply_result_${CAREER_ID}_${SEASON_ID}_1`,
      JSON.stringify({ status: 'COMPLETE', officialRaceResultId: 'off1' }),
    )
    localStorage.setItem(
      `career_apply_result_${CAREER_ID}_${SEASON_ID}_2`,
      JSON.stringify({ status: 'COMPLETE', officialRaceResultId: 'off2' }),
    )
    localStorage.setItem(
      `career_apply_result_${CAREER_ID}_${SEASON_ID}_3`,
      JSON.stringify({ status: 'COMPLETE', officialRaceResultId: 'off3' }),
    )

    // Race results de rodadas antigas
    localStorage.setItem(
      `race_result_${CAREER_ID}_${SEASON_ID}_1`,
      JSON.stringify({ round: 1, entries: [{ driverId: 'd1' }] }),
    )
    localStorage.setItem(
      `race_result_${CAREER_ID}_${SEASON_ID}_3`,
      JSON.stringify({ round: 3, entries: [{ driverId: 'd1' }] }),
    )

    const cleanupRes = runPreventiveStorageCleanup({
      careerId: CAREER_ID,
      seasonId: SEASON_ID,
      currentRound: 4,
    })

    // Snapshots de R1 e R2 devem ter sido podados
    expect(localStorage.getItem(`championship_${CAREER_ID}_2026_r1`)).toBeNull()
    expect(localStorage.getItem(`championship_${CAREER_ID}_2026_r2`)).toBeNull()

    // Snapshot de R3 (anterior) e R4 (atual) devem ser mantidos
    expect(localStorage.getItem(`championship_${CAREER_ID}_2026_r3`)).not.toBeNull()
    expect(localStorage.getItem(`championship_${CAREER_ID}_2026_r4`)).not.toBeNull()

    // Journal COMPLETE de R1 e R2 devem ter sido podados (PB é a fonte da verdade)
    expect(localStorage.getItem(`career_apply_result_${CAREER_ID}_${SEASON_ID}_1`)).toBeNull()
    expect(localStorage.getItem(`career_apply_result_${CAREER_ID}_${SEASON_ID}_2`)).toBeNull()

    // Journal de R3 deve ser mantido
    expect(localStorage.getItem(`career_apply_result_${CAREER_ID}_${SEASON_ID}_3`)).not.toBeNull()

    // Race result de R1 deve ter sido podado
    expect(localStorage.getItem(`race_result_${CAREER_ID}_${SEASON_ID}_1`)).toBeNull()
    // Race result de R3 deve ser mantido
    expect(localStorage.getItem(`race_result_${CAREER_ID}_${SEASON_ID}_3`)).not.toBeNull()

    expect(cleanupRes.prunedKeys.length).toBeGreaterThan(0)
  })

  it('4. runBootStorageHygieneIfExceeded executa poda quando o storage excede ~3MB', () => {
    // Criar chaves que simulam volume pesado (> 3MB)
    // 3MB = 3 * 1024 * 1024 bytes. Em chars UTF-16, cada char conta como 2 bytes.
    // 1.5M chars ~= 3MB.
    const heavyChunk = 'x'.repeat(400_000) // ~800KB cada
    localStorage.setItem(`apex_practice_session_${CAREER_ID}_${SEASON_ID}_r1_tp1`, heavyChunk)
    localStorage.setItem(`apex_practice_session_${CAREER_ID}_${SEASON_ID}_r1_tp2`, heavyChunk)
    localStorage.setItem(`apex_practice_session_${CAREER_ID}_${SEASON_ID}_r2_tp1`, heavyChunk)
    localStorage.setItem(`apex_practice_session_${CAREER_ID}_${SEASON_ID}_r2_tp2`, heavyChunk)
    localStorage.setItem(`championship_${CAREER_ID}_2026_r1`, heavyChunk)
    localStorage.setItem(`championship_${CAREER_ID}_2026_r4`, 'current_snap')

    const result = runBootStorageHygieneIfExceeded({ force: true })

    expect(result).not.toBeNull()
    expect(result?.prunedKeys.length).toBeGreaterThan(0)
    // Chaves de sessões antigas de r1 e r2 devem ter sido liberadas
    expect(
      localStorage.getItem(`apex_practice_session_${CAREER_ID}_${SEASON_ID}_r1_tp1`),
    ).toBeNull()
  })

  it('5. CONTINUAR (advanceWeekendRound) para a Rodada 4 (Bahrein) avança com sucesso mesmo com QuotaExceededError em championship_*', async () => {
    const mockSeason = {
      id: 'season_2026_audi',
      year: 2026,
      current_round: 3,
      total_rounds: 24,
      last_processed_round: 2,
    }

    const mockTeam = {
      id: 'team_audi_2026',
      name: 'Audi F1 Team',
      team_key: 'audi',
    }

    const mockOfficialResult = {
      officialResultId: 'off_res_r3_australia',
      careerId: 'season_2026_audi',
      season: 2026,
      round: 3,
      circuitId: 'albert_park',
      circuitName: 'Melbourne',
      raceVariant: 'MAIN_RACE',
      resultHash: 'hash_abc123',
      winnerDriverId: 'drv_1',
      poleDriverId: 'drv_1',
      fastestLapDriverId: 'drv_1',
      officializedAt: new Date().toISOString(),
      playerTeamId: 'audi',
      entries: [
        {
          driverId: 'drv_1',
          driverName: 'Max Verstappen',
          teamId: 'red_bull',
          teamName: 'Red Bull Racing',
          pointsAwarded: 25,
          finalPosition: 1,
          gridPosition: 1,
          status: 'finished',
          fastestLap: true,
        },
      ],
      playerEntries: [],
    } as any

    // Mock do updateSeason no backend
    vi.spyOn(f1Service, 'updateSeason').mockResolvedValue({
      ...mockSeason,
      current_round: 4,
      last_processed_round: 3,
    } as any)

    // Mock de journal já COMPLETE para R3
    vi.spyOn(canonicalCareerPersistenceService, 'getApplicationJournal').mockReturnValue({
      key: `career_apply_result_season_2026_audi_s2026_3`,
      careerId: 'season_2026_audi',
      season: 2026,
      round: 3,
      officialRaceResultId: 'off_res_r3_australia',
      checksum: 'hash_abc123',
      status: 'COMPLETE',
      appliedDriverIds: ['drv_1'],
      totalEntries: 1,
      version: 1,
    } as any)

    // Simular que ao gravar snapshot de campeonato (championship_*), o localStorage lança QuotaExceededError
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage)
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((k: string, v: string) => {
      if (k.startsWith('championship_') || k.startsWith('apex_championship_')) {
        const quotaErr = new Error(
          'QuotaExceededError: Setting championship snapshot exceeded storage quota.',
        )
        quotaErr.name = 'QuotaExceededError'
        throw quotaErr
      }
      return originalSetItem(k, v)
    })

    let advancedToRound: number | null = null
    const res = await advanceWeekendRound({
      officialResult: mockOfficialResult,
      season: mockSeason,
      team: mockTeam,
      currentRound: 3,
      totalRounds: 24,
      onSuccess: (nextRound) => {
        advancedToRound = nextRound
      },
    })

    expect(res.success).toBe(true)
    expect(res.previousRound).toBe(3)
    expect(res.nextRound).toBe(4)
    expect(advancedToRound).toBe(4)
    expect(f1Service.updateSeason).toHaveBeenCalledWith('season_2026_audi', {
      current_round: 4,
      last_processed_round: 3,
    })
  })
})
