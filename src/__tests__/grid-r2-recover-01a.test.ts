/**
 * GRID-R2-RECOVER-01A: Teste de verificação da recuperação e leitura do grid oficial para corrida sprint
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalQualifyingFinalGridBackendService } from '@/services/canonicalQualifyingFinalGridBackendService'

describe('GRID-R2-RECOVER-01A — Leitura do Grid para Sprint Race e Backend-Preferred', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    canonicalQualifyingPersistenceService.clearCachesForTesting()
    canonicalQualifyingFinalGridBackendService.clearCachesForTesting()
  })

  it('1. readFinalGridPreferred recupera com sucesso o grid da Rodada 2 quando mockado do backend', async () => {
    const mockR2Grid = {
      seasonId: '31b0p9k5ygw2sc8',
      round: 2,
      completedAt: '2026-10-10T20:55:19.378Z',
      poleDriverId: 'mercedes_d1',
      poleDriverName: 'George Russell',
      poleLapTime: '1:33.450',
      finalGrid: Array.from({ length: 24 }, (_, i) => ({
        gridPosition: i + 1,
        driverId: i === 0 ? 'mercedes_d1' : `driver_${i + 1}`,
        driverName: i === 0 ? 'George Russell' : `Driver ${i + 1}`,
        teamId: i === 0 ? 'mercedes' : `team_${i + 1}`,
        teamName: i === 0 ? 'Mercedes-AMG Petronas F1 Team' : `Team ${i + 1}`,
        teamColor: '#00D2BE',
        isPlayer: false,
        eliminationStage: i < 10 ? ('Q3' as const) : i < 18 ? ('Q2' as const) : ('Q1' as const),
        bestLapSec: 93.45 + i * 0.1,
        bestLapTime: '1:33.450',
        bestLapCompound: 'macio' as const,
      })),
      q1Result: {} as any,
      q2Result: {} as any,
      q3Result: {} as any,
    }

    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'readFinalGrid').mockResolvedValue(
      mockR2Grid as any,
    )

    const outcome = await canonicalQualifyingPersistenceService.readFinalGridPreferred(
      '31b0p9k5ygw2sc8',
      2,
    )

    expect(outcome.source).toBe('backend')
    expect(outcome.data).not.toBeNull()
    expect(outcome.data?.round).toBe(2)
    expect(outcome.data?.finalGrid).toHaveLength(24)
    expect(outcome.data?.finalGrid[0].driverName).toBe('George Russell')
    expect(outcome.data?.finalGrid[0].gridPosition).toBe(1)
  })

  it('2. canonicalQualifyingPersistenceService.isValidFinalQualifyingGrid valida o grid recuperado com 24 pilotos', () => {
    const sample = {
      seasonId: '31b0p9k5ygw2sc8',
      round: 2,
      completedAt: '2026-10-10T20:55:19.378Z',
      poleDriverId: 'mercedes_d1',
      finalGrid: Array.from({ length: 24 }, (_, i) => ({
        gridPosition: i + 1,
        driverId: `driver_${i + 1}`,
        driverName: `Driver ${i + 1}`,
        teamId: `team_${i + 1}`,
        eliminationStage: 'Q3' as const,
        bestLapSec: 90,
        bestLapTime: '1:30.000',
        bestLapCompound: 'macio' as const,
      })),
    } as any

    expect(canonicalQualifyingPersistenceService.isValidFinalQualifyingGrid(sample)).toBe(true)
  })
})
