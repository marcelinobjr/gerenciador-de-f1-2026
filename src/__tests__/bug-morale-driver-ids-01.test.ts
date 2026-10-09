import { describe, it, expect, vi, beforeEach } from 'vitest'
import { driverMoraleService } from '@/services/driverMoraleService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { f1Service } from '@/services/f1Service'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'

describe('BUG-MORALE-DRIVER-IDS-01: Canonical Morale Driver Resolution & Resilience', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('1. driverMoraleService: save falhando NÃO grava markMoraleProcessed (retry reprocessa)', async () => {
    let callCount = 0
    const mockSave = vi.fn().mockImplementation(async (driverId: string, _morale: number) => {
      callCount++
      if (driverId === 'failed_driver' && callCount === 1) {
        throw new Error('Network error on first attempt')
      }
      return true
    })

    const officialResult = {
      careerId: 'career_test_1',
      season: 2026,
      round: 1,
      entries: [
        {
          driverId: 'failed_driver',
          driverName: 'Failed Driver',
          finalPosition: 5,
          gridPosition: 5,
          status: 'finished',
        },
      ],
    }

    // Primeira tentativa: deve falhar no save e NÃO marcar como processado
    await driverMoraleService.processOfficialRaceMorale({
      officialResult,
      driverCurrentMoraleMap: { failed_driver: 70 },
      onSaveDriverMorale: mockSave,
    })

    const isProcessedAfterFail = driverMoraleService.isMoraleAlreadyProcessed({
      careerId: 'career_test_1',
      season: 2026,
      round: 1,
      driverId: 'failed_driver',
    })
    expect(isProcessedAfterFail).toBe(false)

    // Segunda tentativa (retry): save tem sucesso -> agora sim grava markMoraleProcessed
    await driverMoraleService.processOfficialRaceMorale({
      officialResult,
      driverCurrentMoraleMap: { failed_driver: 70 },
      onSaveDriverMorale: mockSave,
    })

    const isProcessedAfterSuccess = driverMoraleService.isMoraleAlreadyProcessed({
      careerId: 'career_test_1',
      season: 2026,
      round: 1,
      driverId: 'failed_driver',
    })
    expect(isProcessedAfterSuccess).toBe(true)

    // Terceira tentativa: como já está marcado, NÃO deve chamar onSaveDriverMorale de novo (idempotência)
    const prevCallCount = callCount
    await driverMoraleService.processOfficialRaceMorale({
      officialResult,
      driverCurrentMoraleMap: { failed_driver: 70 },
      onSaveDriverMorale: mockSave,
    })
    expect(callCount).toBe(prevCallCount)
  })

  it('2. driverMoraleService: callback retornando false explicitamente NÃO grava markMoraleProcessed', async () => {
    const mockSave = vi.fn().mockResolvedValue(false)

    const officialResult = {
      careerId: 'career_test_2',
      season: 2026,
      round: 1,
      entries: [
        {
          driverId: 'driver_retry',
          driverName: 'Retry Driver',
          finalPosition: 3,
          gridPosition: 3,
          status: 'finished',
        },
      ],
    }

    await driverMoraleService.processOfficialRaceMorale({
      officialResult,
      driverCurrentMoraleMap: { driver_retry: 85 },
      onSaveDriverMorale: mockSave,
    })

    const isProcessed = driverMoraleService.isMoraleAlreadyProcessed({
      careerId: 'career_test_2',
      season: 2026,
      round: 1,
      driverId: 'driver_retry',
    })
    expect(isProcessed).toBe(false)
  })

  it('3. processOfficialMoraleDirect: resolve slug canônico (ex: mercedes_d1, ferrari_d2) para o ID real do PocketBase', async () => {
    // Mock dos pilotos e equipes no f1Service
    const mockDrivers = [
      {
        id: 'pb_russell_id_123',
        name: 'George Russell',
        morale: 72,
        team_id: 'team_merc_id',
      },
      {
        id: 'pb_kimi_id_456',
        name: 'Kimi Antonelli',
        morale: 68,
        team_id: 'team_merc_id',
      },
      {
        id: 'pb_leclerc_id_789',
        name: 'Charles Leclerc',
        morale: 88,
        team_id: 'team_ferrari_id',
      },
      {
        id: 'pb_hamilton_id_101',
        name: 'Lewis Hamilton',
        morale: 92,
        team_id: 'team_ferrari_id',
      },
    ]

    const mockTeams = [
      {
        id: 'team_merc_id',
        team_key: 'mercedes',
        name: 'Mercedes-AMG Petronas F1 Team',
      },
      {
        id: 'team_ferrari_id',
        team_key: 'ferrari',
        name: 'Scuderia Ferrari',
      },
    ]

    vi.spyOn(f1Service, 'getAllDrivers').mockResolvedValue(mockDrivers as any)
    vi.spyOn(f1Service, 'getAllTeams').mockResolvedValue(mockTeams as any)
    const updateDriverSpy = vi.spyOn(f1Service, 'updateDriver').mockResolvedValue({} as any)

    const officialResult: any = {
      officialResultId: 'orr_test_1',
      schemaVersion: 'official-race-result-v1',
      raceVariant: 'MAIN_RACE',
      careerId: 'career_test_slug',
      season: 2026,
      round: 1,
      raceId: 'gp_1',
      circuitId: 'bahrain',
      circuitName: 'Bahrain Grand Prix',
      circuitCountry: 'Bahrein',
      playerTeamId: 'team_williams',
      officializedAt: new Date().toISOString(),
      totalLaps: 57,
      winnerDriverId: 'mercedes_d1',
      winnerTeamId: 'team_mercedes',
      poleDriverId: 'mercedes_d1',
      podium: ['mercedes_d1', 'ferrari_d2', 'mercedes_d2'],
      podiumDriverIds: ['mercedes_d1', 'ferrari_d2', 'mercedes_d2'],
      entries: [
        {
          driverId: 'mercedes_d1', // George Russell
          driverName: 'George Russell',
          finalPosition: 1,
          gridPosition: 1,
          status: 'finished',
          pointsAwarded: 25,
          teamId: 'team_mercedes',
          teamName: 'Mercedes',
          teamColor: '#00D2BE',
          isPlayer: false,
          lapsCompleted: 57,
          pitStops: 1,
          pitStopsCount: 1,
          gapToWinner: 'WINNER',
          classificationStatus: 'CLASSIFIED',
          isClassified: true,
          dnf: false,
          fastestLap: false,
          tyreCompound: 'duro',
          positionsGained: 0,
          positionsGainedLost: 0,
        },
        {
          driverId: 'ferrari_d2', // Lewis Hamilton
          driverName: 'Lewis Hamilton',
          finalPosition: 2,
          gridPosition: 3,
          status: 'finished',
          pointsAwarded: 18,
          teamId: 'team_ferrari',
          teamName: 'Ferrari',
          teamColor: '#E80020',
          isPlayer: false,
          lapsCompleted: 57,
          pitStops: 1,
          pitStopsCount: 1,
          gapToWinner: '+2.5s',
          classificationStatus: 'CLASSIFIED',
          isClassified: true,
          dnf: false,
          fastestLap: false,
          tyreCompound: 'duro',
          positionsGained: 1,
          positionsGainedLost: 1,
        },
      ],
    }

    await canonicalRaceResultService.processOfficialMoraleDirect(officialResult)

    // O updateDriver NÃO deve ser chamado com 'mercedes_d1' ou 'ferrari_d2' (que gerava 404 em produção!)
    expect(updateDriverSpy).not.toHaveBeenCalledWith('mercedes_d1', expect.anything())
    expect(updateDriverSpy).not.toHaveBeenCalledWith('ferrari_d2', expect.anything())

    // Deve ser chamado com os IDs reais do PocketBase correspondentes!
    expect(updateDriverSpy).toHaveBeenCalledWith('pb_russell_id_123', expect.anything())
    expect(updateDriverSpy).toHaveBeenCalledWith('pb_hamilton_id_101', expect.anything())
  })

  it('4. processOfficialMoraleDirect: moral de partida usa o valor do registro correto (não fallback 80)', async () => {
    const mockDrivers = [
      {
        id: 'pb_driver_real_999',
        name: 'George Russell',
        morale: 65, // Moral distinta de 80 para provar leitura
        team_id: 'team_merc_id',
      },
    ]

    const mockTeams = [
      {
        id: 'team_merc_id',
        team_key: 'mercedes',
        name: 'Mercedes-AMG Petronas F1 Team',
      },
    ]

    vi.spyOn(f1Service, 'getAllDrivers').mockResolvedValue(mockDrivers as any)
    vi.spyOn(f1Service, 'getAllTeams').mockResolvedValue(mockTeams as any)
    const updateSpy = vi.spyOn(f1Service, 'updateDriver').mockResolvedValue({} as any)

    const officialResult: any = {
      officialResultId: 'orr_test_morale',
      schemaVersion: 'official-race-result-v1',
      raceVariant: 'MAIN_RACE',
      careerId: 'career_test_morale',
      season: 2026,
      round: 1,
      raceId: 'gp_1',
      circuitId: 'bahrain',
      circuitName: 'Bahrain Grand Prix',
      circuitCountry: 'Bahrein',
      playerTeamId: 'team_williams',
      officializedAt: new Date().toISOString(),
      totalLaps: 57,
      winnerDriverId: 'mercedes_d1',
      winnerTeamId: 'team_mercedes',
      poleDriverId: 'mercedes_d1',
      podium: ['mercedes_d1', 'mercedes_d1', 'mercedes_d1'],
      podiumDriverIds: ['mercedes_d1'],
      entries: [
        {
          driverId: 'mercedes_d1',
          driverName: 'George Russell',
          finalPosition: 1, // Venceu largando da P1 -> delta 0, bônus vitória +3 -> nova moral: 65 + 3 = 68
          gridPosition: 1,
          status: 'finished',
          pointsAwarded: 25,
          teamId: 'team_mercedes',
          teamName: 'Mercedes',
          teamColor: '#00D2BE',
          isPlayer: false,
          lapsCompleted: 57,
          pitStops: 1,
          pitStopsCount: 1,
          gapToWinner: 'WINNER',
          classificationStatus: 'CLASSIFIED',
          isClassified: true,
          dnf: false,
          fastestLap: false,
          tyreCompound: 'duro',
          positionsGained: 0,
          positionsGainedLost: 0,
        },
      ],
    }

    await canonicalRaceResultService.processOfficialMoraleDirect(officialResult)

    // Se caísse no fallback 80, a nova moral seria 80 + 3 = 83.
    // Como leu 65 do registro correto, a nova moral deve ser exatamente 68!
    expect(updateSpy).toHaveBeenCalledWith('pb_driver_real_999', { morale: 68 })
  })

  it('5. Resiliência a falhas individuais: lote não trava se um piloto falhar', async () => {
    const mockDrivers = [
      { id: 'pb_id_1', name: 'George Russell', morale: 70 },
      { id: 'pb_id_2', name: 'Kimi Antonelli', morale: 70 },
    ]
    vi.spyOn(f1Service, 'getAllDrivers').mockResolvedValue(mockDrivers as any)
    vi.spyOn(f1Service, 'getAllTeams').mockResolvedValue([] as any)

    // Primeiro piloto falha no updateDriver, segundo tem sucesso
    vi.spyOn(f1Service, 'updateDriver').mockImplementation(async (driverId) => {
      if (driverId === 'pb_id_1') {
        throw new Error('500 Internal Server Error simulating PB flake')
      }
      return {} as any
    })

    const officialResult: any = {
      officialResultId: 'orr_test_batch',
      schemaVersion: 'official-race-result-v1',
      raceVariant: 'MAIN_RACE',
      careerId: 'career_test_batch',
      season: 2026,
      round: 1,
      raceId: 'gp_1',
      circuitId: 'bahrain',
      circuitName: 'Bahrain Grand Prix',
      circuitCountry: 'Bahrein',
      playerTeamId: 'team_williams',
      officializedAt: new Date().toISOString(),
      totalLaps: 57,
      winnerDriverId: 'mercedes_d1',
      winnerTeamId: 'team_mercedes',
      poleDriverId: 'mercedes_d1',
      podium: ['mercedes_d1', 'mercedes_d2', 'mercedes_d2'],
      podiumDriverIds: ['mercedes_d1', 'mercedes_d2'],
      entries: [
        {
          driverId: 'mercedes_d1',
          driverName: 'George Russell',
          finalPosition: 1,
          gridPosition: 1,
          status: 'finished',
          pointsAwarded: 25,
          teamId: 'team_mercedes',
          teamName: 'Mercedes',
          teamColor: '#00D2BE',
          isPlayer: false,
          lapsCompleted: 57,
          pitStops: 1,
          pitStopsCount: 1,
          gapToWinner: 'WINNER',
          classificationStatus: 'CLASSIFIED',
          isClassified: true,
          dnf: false,
          fastestLap: false,
          tyreCompound: 'duro',
          positionsGained: 0,
          positionsGainedLost: 0,
        },
        {
          driverId: 'mercedes_d2',
          driverName: 'Kimi Antonelli',
          finalPosition: 2,
          gridPosition: 2,
          status: 'finished',
          pointsAwarded: 18,
          teamId: 'team_mercedes',
          teamName: 'Mercedes',
          teamColor: '#00D2BE',
          isPlayer: false,
          lapsCompleted: 57,
          pitStops: 1,
          pitStopsCount: 1,
          gapToWinner: '+5s',
          classificationStatus: 'CLASSIFIED',
          isClassified: true,
          dnf: false,
          fastestLap: false,
          tyreCompound: 'duro',
          positionsGained: 0,
          positionsGainedLost: 0,
        },
      ],
    }

    // Não deve lançar erro unhandled
    await expect(
      canonicalRaceResultService.processOfficialMoraleDirect(officialResult),
    ).resolves.not.toThrow()

    // O piloto 1 que falhou NÃO deve estar marcado como processado
    const isP1Done = driverMoraleService.isMoraleAlreadyProcessed({
      careerId: 'career_test_batch',
      season: 2026,
      round: 1,
      driverId: 'mercedes_d1',
    })
    expect(isP1Done).toBe(false)

    // O piloto 2 que teve sucesso DEVE estar marcado como processado
    const isP2Done = driverMoraleService.isMoraleAlreadyProcessed({
      careerId: 'career_test_batch',
      season: 2026,
      round: 1,
      driverId: 'mercedes_d2',
    })
    expect(isP2Done).toBe(true)
  })
})
