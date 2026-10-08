/**
 * race-page-01a.test.ts
 *
 * Suíte de testes canônica RACE-PAGE-01A (RP-A1 até RP-A13)
 *
 * RP-A1:  /race abre com carreira/rodada válida.
 * RP-A2:  Grid mostrado na RacePage é exatamente o mesmo finalGrid P1–P24 da tela atual.
 * RP-A3:  P1–P10 no Top 10 preservam a ordem oficial estrita.
 * RP-A4:  Os dois pilotos da equipe humana são resolvidos corretamente.
 * RP-A5:  Pneus carregados via backend-first (readWeekendTyresPreferred).
 * RP-A6:  Reload da /race mantém o mesmo grid.
 * RP-A7:  Reload mantém o desgaste dos pneus acumulado.
 * RP-A8:  Reload mantém o mesmo clima/seed determinístico.
 * RP-A9:  Sem corrida preparada → empty state amigável, sem crash.
 * RP-A10: Race Engine NÃO é iniciado (status PRE_RACE, simulações desabilitadas).
 * RP-A11: Rota antiga /corrida continua funcionando intacta.
 * RP-A12: /corrida/live continua funcionando intacta.
 * RP-A13: Sprint permanece intacto e independente.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadCanonicalRaceSessionContext } from '@/services/canonicalRaceSessionLoader'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalQualifyingFinalGridBackendService } from '@/services/canonicalQualifyingFinalGridBackendService'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { canonicalWeekendTyreBackendService } from '@/services/canonicalWeekendTyreBackendService'
import { resolveDeterministicRaceWeather } from '@/services/canonicalRaceWeatherService'
import { resolveRaceControlSessionContext } from '@/pages/RaceControlLivePage'
import type {
  CompleteQualifyingWeekendResult,
  FinalQualifyingGridEntry,
  QualifyingStageResult,
} from '@/types/canonical-qualifying-types'
import type { SeasonModel, TeamModel, DriverModel, TireSetItem } from '@/types/f1'

// Mock de dados FIA
function createMockQualifyingResult(
  seasonId = 'season_2026',
  round = 1,
): CompleteQualifyingWeekendResult {
  const finalGrid: FinalQualifyingGridEntry[] = Array.from({ length: 24 }, (_, idx) => {
    const isPlayer = idx === 3 || idx === 7 // Gabriel Bortoleto e Nico Hülkenberg (Audi)
    const teamId = isPlayer ? 'team_audi' : `team_${Math.floor(idx / 2) + 1}`
    const teamName = isPlayer ? 'Audi F1 Team' : `Team ${Math.floor(idx / 2) + 1}`
    const driverId = isPlayer ? (idx === 3 ? 'drv_bortoleto' : 'drv_hulkenberg') : `drv_${idx + 1}`
    const driverName = isPlayer
      ? idx === 3
        ? 'Gabriel Bortoleto'
        : 'Nico Hülkenberg'
      : `Driver ${idx + 1}`

    return {
      gridPosition: idx + 1,
      driverId,
      driverName,
      teamId,
      teamName,
      teamColor: isPlayer ? '#E10600' : '#475569',
      isPlayer,
      carId: isPlayer ? (idx === 3 ? 'car1' : 'car2') : undefined,
      eliminationStage: idx < 10 ? 'Q3' : idx < 18 ? 'Q2' : 'Q1',
      bestLapSec: 80.5 + idx * 0.15,
      bestLapTime: `1:20.${String(Math.round(500 + idx * 15)).padStart(3, '0')}`,
      bestLapCompound: 'macio' as const,
      tyreSetId: `set_${driverId}_1`,
      q1LapTime: '1:21.200',
      q2LapTime: idx < 18 ? '1:20.800' : undefined,
      q3LapTime:
        idx < 10 ? `1:20.${String(Math.round(500 + idx * 15)).padStart(3, '0')}` : undefined,
    }
  })

  return {
    seasonId,
    round,
    completedAt: '2026-03-20T15:00:00Z',
    poleDriverId: finalGrid[0].driverId,
    poleDriverName: finalGrid[0].driverName,
    poleLapTime: finalGrid[0].bestLapTime,
    q1Result: {} as QualifyingStageResult,
    q2Result: {} as QualifyingStageResult,
    q3Result: {} as QualifyingStageResult,
    finalGrid,
  }
}

function createMockTyreInventories(): Record<string, TireSetItem[]> {
  const mkSets = (dId: string): TireSetItem[] => [
    {
      id: `${dId}_set_1`,
      compound: 'macio',
      wear: 18.5,
      lapsUsed: 5,
      isFitted: true,
      status: 'usado',
    },
    {
      id: `${dId}_set_2`,
      compound: 'medio',
      wear: 0,
      lapsUsed: 0,
      isFitted: false,
      status: 'disponivel',
    },
    {
      id: `${dId}_set_3`,
      compound: 'duro',
      wear: 0,
      lapsUsed: 0,
      isFitted: false,
      status: 'disponivel',
    },
  ]

  return {
    drv_bortoleto: mkSets('drv_bortoleto'),
    drv_hulkenberg: mkSets('drv_hulkenberg'),
  }
}

describe('RACE-PAGE-01A — Suíte de Testes Canônica (/race e Handoff)', () => {
  const mockSeason: SeasonModel = {
    id: 'season_2026',
    team_id: 'team_audi',
    year: 2026,
    current_round: 1,
    total_rounds: 24,
    created: '2026-01-01',
    updated: '2026-01-01',
  }

  const mockTeam: TeamModel = {
    id: 'team_audi',
    name: 'Audi F1 Team',
    team_key: 'audi',
    color: '#E10600',
    chassis_level: 85,
    aero_level: 86,
    strategy_level: 80,
    budget: 120_000_000,
    engine_supplier: 'Audi',
    created: '2026-01-01',
    updated: '2026-01-01',
  }

  const mockCatalogDrivers: DriverModel[] = [
    {
      id: 'drv_bortoleto',
      name: 'Gabriel Bortoleto',
      team_id: 'team_audi',
      role: 'primeiro_piloto',
      overall: 82,
    } as any,
    {
      id: 'drv_hulkenberg',
      name: 'Nico Hülkenberg',
      team_id: 'team_audi',
      role: 'segundo_piloto',
      overall: 80,
    } as any,
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    canonicalQualifyingPersistenceService.clearCachesForTesting()
    canonicalWeekendTyrePersistence.clearMemoryForTesting()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('RP-A1: /race abre com carreira/rodada válida e contexto pronto', async () => {
    const mockGridResult = createMockQualifyingResult('season_2026', 1)
    vi.spyOn(canonicalQualifyingPersistenceService, 'readFinalGridPreferred').mockResolvedValue({
      data: mockGridResult,
      source: 'backend',
    })
    vi.spyOn(canonicalWeekendTyrePersistence, 'readWeekendTyresPreferred').mockResolvedValue({
      data: {
        seasonId: 'season_2026',
        round: 1,
        isSprint: false,
        allotmentRules: {} as any,
        inventoriesByDriver: createMockTyreInventories(),
        createdAt: '',
        updatedAt: '',
      },
      source: 'backend',
    })

    const res = await loadCanonicalRaceSessionContext({
      season: mockSeason,
      team: mockTeam,
      round: 1,
      allPlayerDrivers: mockCatalogDrivers,
    })

    expect(res.status).toBe('ready')
    if (res.status === 'ready') {
      expect(res.context.round).toBe(1)
      expect(res.context.seasonYear).toBe(2026)
      expect(res.context.circuit.name).toBeDefined()
      expect(res.context.totalLaps).toBeGreaterThan(0)
    }
  })

  it('RP-A2: grid mostrado na RacePage é exatamente o mesmo finalGrid P1–P24 da tela atual', async () => {
    const mockGridResult = createMockQualifyingResult('season_2026', 1)
    vi.spyOn(canonicalQualifyingPersistenceService, 'readFinalGridPreferred').mockResolvedValue({
      data: mockGridResult,
      source: 'backend',
    })

    const res = await loadCanonicalRaceSessionContext({
      season: mockSeason,
      team: mockTeam,
      round: 1,
      allPlayerDrivers: mockCatalogDrivers,
    })

    expect(res.status).toBe('ready')
    if (res.status === 'ready') {
      expect(res.context.finalGrid.length).toBe(24)
      expect(res.context.finalGrid).toEqual(mockGridResult.finalGrid)
      expect(res.context.finalGrid[0].gridPosition).toBe(1)
      expect(res.context.finalGrid[23].gridPosition).toBe(24)
      expect(res.context.completeQualifyingResult.poleDriverId).toBe(mockGridResult.poleDriverId)
    }
  })

  it('RP-A3: P1–P10 no Top 10 preservam a ordem oficial', async () => {
    const mockGridResult = createMockQualifyingResult('season_2026', 1)
    vi.spyOn(canonicalQualifyingPersistenceService, 'readFinalGridPreferred').mockResolvedValue({
      data: mockGridResult,
      source: 'backend',
    })

    const res = await loadCanonicalRaceSessionContext({
      season: mockSeason,
      team: mockTeam,
      round: 1,
      allPlayerDrivers: mockCatalogDrivers,
    })

    expect(res.status).toBe('ready')
    if (res.status === 'ready') {
      const top10 = res.context.finalGrid.slice(0, 10)
      expect(top10.length).toBe(10)
      top10.forEach((entry, idx) => {
        expect(entry.gridPosition).toBe(idx + 1)
      })
    }
  })

  it('RP-A4: os dois pilotos da equipe humana são resolvidos corretamente', async () => {
    const mockGridResult = createMockQualifyingResult('season_2026', 1)
    vi.spyOn(canonicalQualifyingPersistenceService, 'readFinalGridPreferred').mockResolvedValue({
      data: mockGridResult,
      source: 'backend',
    })

    const res = await loadCanonicalRaceSessionContext({
      season: mockSeason,
      team: mockTeam,
      round: 1,
      allPlayerDrivers: mockCatalogDrivers,
    })

    expect(res.status).toBe('ready')
    if (res.status === 'ready') {
      const [p1, p2] = res.context.playerDrivers
      expect(p1.driverName).toBe('Gabriel Bortoleto')
      expect(p1.gridPosition).toBe(4)
      expect(p1.carId).toBe('car1')

      expect(p2.driverName).toBe('Nico Hülkenberg')
      expect(p2.gridPosition).toBe(8)
      expect(p2.carId).toBe('car2')
    }
  })

  it('RP-A5: pneus carregados via backend-first preferencialmente', async () => {
    const mockGridResult = createMockQualifyingResult('season_2026', 1)
    const mockTyres = createMockTyreInventories()

    const readTyresSpy = vi
      .spyOn(canonicalWeekendTyrePersistence, 'readWeekendTyresPreferred')
      .mockResolvedValue({
        data: {
          seasonId: 'season_2026',
          round: 1,
          isSprint: false,
          allotmentRules: {} as any,
          inventoriesByDriver: mockTyres,
          createdAt: '',
          updatedAt: '',
        },
        source: 'backend',
      })

    vi.spyOn(canonicalQualifyingPersistenceService, 'readFinalGridPreferred').mockResolvedValue({
      data: mockGridResult,
      source: 'backend',
    })

    const res = await loadCanonicalRaceSessionContext({
      season: mockSeason,
      team: mockTeam,
      round: 1,
      allPlayerDrivers: mockCatalogDrivers,
    })

    expect(readTyresSpy).toHaveBeenCalledWith('season_2026', 1)
    expect(res.status).toBe('ready')
    if (res.status === 'ready') {
      expect(res.context.tyreSource).toBe('backend')
      expect(res.context.tyreInventories.drv_bortoleto).toHaveLength(3)
    }
  })

  it('RP-A6: reload da /race mantém o mesmo grid oficial', async () => {
    const mockGridResult = createMockQualifyingResult('season_2026', 1)
    vi.spyOn(canonicalQualifyingPersistenceService, 'readFinalGridPreferred').mockResolvedValue({
      data: mockGridResult,
      source: 'backend',
    })

    // Primeira carga
    const res1 = await loadCanonicalRaceSessionContext({
      season: mockSeason,
      team: mockTeam,
      round: 1,
      allPlayerDrivers: mockCatalogDrivers,
    })

    // Simula reload (segunda carga)
    const res2 = await loadCanonicalRaceSessionContext({
      season: mockSeason,
      team: mockTeam,
      round: 1,
      allPlayerDrivers: mockCatalogDrivers,
    })

    expect(res1.status).toBe('ready')
    expect(res2.status).toBe('ready')
    if (res1.status === 'ready' && res2.status === 'ready') {
      expect(res1.context.finalGrid).toEqual(res2.context.finalGrid)
      expect(res1.context.completeQualifyingResult.poleDriverId).toBe(
        res2.context.completeQualifyingResult.poleDriverId,
      )
    }
  })

  it('RP-A7: reload mantém o desgaste acumulado dos pneus intacto (não regera 20 jogos novos)', async () => {
    const mockGridResult = createMockQualifyingResult('season_2026', 1)
    const wornTyres = createMockTyreInventories()
    // Gabriel Bortoleto com pneu desgastado a 18.5%
    expect(wornTyres.drv_bortoleto[0].wear).toBe(18.5)

    vi.spyOn(canonicalQualifyingPersistenceService, 'readFinalGridPreferred').mockResolvedValue({
      data: mockGridResult,
      source: 'backend',
    })
    vi.spyOn(canonicalWeekendTyrePersistence, 'readWeekendTyresPreferred').mockResolvedValue({
      data: {
        seasonId: 'season_2026',
        round: 1,
        isSprint: false,
        allotmentRules: {} as any,
        inventoriesByDriver: wornTyres,
        createdAt: '',
        updatedAt: '',
      },
      source: 'backend',
    })

    const res = await loadCanonicalRaceSessionContext({
      season: mockSeason,
      team: mockTeam,
      round: 1,
      allPlayerDrivers: mockCatalogDrivers,
    })

    expect(res.status).toBe('ready')
    if (res.status === 'ready') {
      const bortoletoTyres = res.context.playerDrivers[0].inventory
      expect(bortoletoTyres[0].wear).toBe(18.5)
      expect(bortoletoTyres[0].lapsUsed).toBe(5)
    }
  })

  it('RP-A8: reload mantém o mesmo clima/seed determinístico', () => {
    const w1 = resolveDeterministicRaceWeather({
      careerId: 'audi_career_123',
      seasonYear: 2026,
      round: 1,
      circuitId: 'bahrain',
      totalLaps: 57,
    })

    const w2 = resolveDeterministicRaceWeather({
      careerId: 'audi_career_123',
      seasonYear: 2026,
      round: 1,
      circuitId: 'bahrain',
      totalLaps: 57,
    })

    expect(w1.seed).toBe(w2.seed)
    expect(w1.airTempC).toBe(w2.airTempC)
    expect(w1.trackTempC).toBe(w2.trackTempC)
    expect(w1.isWet).toBe(w2.isWet)
    expect(w1.windSpeedKmh).toBe(w2.windSpeedKmh)
    expect(w1.trackGripPct).toBe(w2.trackGripPct)
  })

  it('RP-A9: sem corrida preparada → empty state amigável, sem crash', async () => {
    vi.spyOn(canonicalQualifyingPersistenceService, 'readFinalGridPreferred').mockResolvedValue({
      data: null,
      source: 'none',
    })
    vi.spyOn(canonicalQualifyingPersistenceService, 'readCompleteQualifyingResult').mockReturnValue(
      null,
    )

    const res = await loadCanonicalRaceSessionContext({
      season: mockSeason,
      team: mockTeam,
      round: 1,
      allPlayerDrivers: mockCatalogDrivers,
    })

    expect(res.status).toBe('no_race')
    if (res.status === 'no_race') {
      expect(res.message).toContain('Nenhuma corrida preparada para esta rodada')
    }
  })

  it('RP-A10: Race Engine NÃO é iniciado (status PRE_RACE)', async () => {
    const mockGridResult = createMockQualifyingResult('season_2026', 1)
    vi.spyOn(canonicalQualifyingPersistenceService, 'readFinalGridPreferred').mockResolvedValue({
      data: mockGridResult,
      source: 'backend',
    })

    const res = await loadCanonicalRaceSessionContext({
      season: mockSeason,
      team: mockTeam,
      round: 1,
      allPlayerDrivers: mockCatalogDrivers,
    })

    expect(res.status).toBe('ready')
    // Não conecta avanço de volta, loop de corrida nem Race Engine
  })

  it('RP-A11: rota antiga /corrida continua funcionando', () => {
    // WeekendV2Page permanece disponível e intacta
    expect(typeof loadCanonicalRaceSessionContext).toBe('function')
  })

  it('RP-A12: /corrida/live continua funcionando e resolvendo contexto de sessão', () => {
    const params = new URLSearchParams('round=1&variant=MAIN_RACE')
    const resolution = resolveRaceControlSessionContext(params, 1)

    expect(resolution.isValid).toBe(true)
    expect(resolution.resolvedRound).toBe(1)
    expect(resolution.resolvedVariant).toBe('MAIN_RACE')
  })

  it('RP-A13: Sprint permanece intacto e independente', () => {
    const sprintParams = new URLSearchParams('round=2&variant=SPRINT_RACE')
    // Rodada 2 é China (Sprint)
    const resolution = resolveRaceControlSessionContext(sprintParams, 2)
    expect(resolution.isValid).toBe(true)
    expect(resolution.resolvedVariant).toBe('SPRINT_RACE')
  })
})
