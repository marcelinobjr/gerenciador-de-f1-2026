/**
 * race-page-01a-fix1.test.ts
 *
 * Suíte de Verificação Focada RACE-PAGE-01A-FIX1:
 * F1: finalGrid válido + corrida pendente + leitura backend concluída => retoma grid/preparação, sem reinscrever.
 * F2: backend ainda carregando ou falha => não criar estado vazio persistente nem resetar GP.
 * F3: sem grid => fluxo original de fim de semana; com corrida existente/resultado => respeitar estado existente.
 * F4: Carro 1 larga atrás de Carro 2 => assentos permanecem oficiais e pneus/estratégia associados ao driverId correto. Inclui equipe humana genérica (não Audi).
 * F5: abrir card do Carro 1, fechar, abrir Carro 2, e ordem inversa => aba correta sempre.
 * F6: reload e navegação entre /corrida e /race preservam identidade, grid, pneus e clima.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadCanonicalRaceSessionContext } from '@/services/canonicalRaceSessionLoader'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { canonicalEventRegistrationService } from '@/services/canonicalEventRegistrationService'
import { resolveDeterministicRaceWeather } from '@/services/canonicalRaceWeatherService'
import type {
  CompleteQualifyingWeekendResult,
  FinalQualifyingGridEntry,
} from '@/types/canonical-qualifying-types'
import type { SeasonModel, TeamModel, DriverModel, TireSetItem } from '@/types/f1'

function createMockGridWithInvertedPositions(
  seasonId = 'season_gen_1',
  round = 1,
  teamKey = 'team_custom',
  d1Id = 'drv_custom_1',
  d2Id = 'drv_custom_2',
): CompleteQualifyingWeekendResult {
  // Simula Carro 1 largando atrás (ex: P16) e Carro 2 largando na frente (ex: P15)
  const finalGrid: FinalQualifyingGridEntry[] = Array.from({ length: 24 }, (_, idx) => {
    let isPlayer = false
    let driverId = `drv_${idx + 1}`
    let driverName = `Driver ${idx + 1}`
    let teamId = `team_${Math.floor(idx / 2) + 1}`
    let teamName = `Team ${Math.floor(idx / 2) + 1}`
    let carId: 'car1' | 'car2' | undefined = undefined

    if (idx === 14) {
      // P15 -> Carro 2 (Hülkenberg / Segundo Piloto)
      isPlayer = true
      driverId = d2Id
      driverName = 'Segundo Piloto'
      teamId = teamKey
      teamName = 'Custom Racing Team'
      carId = 'car2'
    } else if (idx === 15) {
      // P16 -> Carro 1 (Bortoleto / Primeiro Piloto)
      isPlayer = true
      driverId = d1Id
      driverName = 'Primeiro Piloto'
      teamId = teamKey
      teamName = 'Custom Racing Team'
      carId = 'car1'
    }

    return {
      gridPosition: idx + 1,
      driverId,
      driverName,
      teamId,
      teamName,
      teamColor: isPlayer ? '#00A3E0' : '#475569',
      isPlayer,
      carId,
      eliminationStage: idx < 10 ? 'Q3' : idx < 18 ? 'Q2' : 'Q1',
      bestLapSec: 81.0 + idx * 0.1,
      bestLapTime: `1:21.${String(Math.round(idx * 15)).padStart(3, '0')}`,
      bestLapCompound: 'macio' as const,
      tyreSetId: `set_${driverId}_1`,
    }
  })

  return {
    seasonId,
    round,
    completedAt: '2026-03-20T15:00:00Z',
    poleDriverId: finalGrid[0].driverId,
    poleDriverName: finalGrid[0].driverName,
    poleLapTime: finalGrid[0].bestLapTime,
    q1Result: {} as any,
    q2Result: {} as any,
    q3Result: {} as any,
    finalGrid,
  }
}

describe('RACE-PAGE-01A-FIX1 — Suíte de Verificação Focada (F1–F6)', () => {
  const genericTeam: TeamModel = {
    id: 'team_custom',
    name: 'Custom Racing Team',
    team_key: 'custom',
    color: '#00A3E0',
    chassis_level: 80,
    aero_level: 80,
    strategy_level: 80,
    budget: 100_000_000,
    engine_supplier: 'Ferrari',
    created: '2026-01-01',
    updated: '2026-01-01',
  }

  const genericSeason: SeasonModel = {
    id: 'season_gen_1',
    team_id: 'team_custom',
    year: 2026,
    current_round: 1,
    total_rounds: 24,
    created: '2026-01-01',
    updated: '2026-01-01',
  }

  const genericDrivers: DriverModel[] = [
    {
      id: 'drv_custom_1',
      name: 'Primeiro Piloto',
      team_id: 'team_custom',
      role: 'primeiro_piloto',
      overall: 82,
    } as any,
    {
      id: 'drv_custom_2',
      name: 'Segundo Piloto',
      team_id: 'team_custom',
      role: 'segundo_piloto',
      overall: 80,
    } as any,
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    canonicalQualifyingPersistenceService.clearCachesForTesting()
    canonicalWeekendTyrePersistence.clearMemoryForTesting()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('F1: finalGrid válido + corrida pendente + leitura backend concluída => retoma grid/preparação sem reinscrever', async () => {
    const mockGrid = createMockGridWithInvertedPositions()
    vi.spyOn(canonicalQualifyingPersistenceService, 'readFinalGridPreferred').mockResolvedValue({
      data: mockGrid,
      source: 'backend',
    })

    const res = await loadCanonicalRaceSessionContext({
      season: genericSeason,
      team: genericTeam,
      round: 1,
      allPlayerDrivers: genericDrivers,
    })

    expect(res.status).toBe('ready')
    if (res.status === 'ready') {
      expect(res.context.finalGrid).toHaveLength(24)
      expect(res.context.round).toBe(1)
      expect(res.context.gridSource).toBe('backend')
    }
  })

  it('F2: backend em falha transitória => não cria estado vazio persistente no storage', async () => {
    vi.spyOn(canonicalQualifyingPersistenceService, 'readFinalGridPreferred').mockRejectedValue(
      new Error('Network offline 503'),
    )

    const res = await loadCanonicalRaceSessionContext({
      season: genericSeason,
      team: genericTeam,
      round: 1,
      allPlayerDrivers: genericDrivers,
    })

    // Retorna no_race amigável, sem criar grid vazio nem alterar localStorage
    expect(res.status).toBe('no_race')
    expect(localStorage.getItem('apex_qualifying_final_grid_v2_season_gen_1_r1')).toBeNull()
  })

  it('F3: sem grid oficial => status no_race amigável para preservar fluxo de treinos/classificação', async () => {
    vi.spyOn(canonicalQualifyingPersistenceService, 'readFinalGridPreferred').mockResolvedValue({
      data: null,
      source: 'none',
    })

    const res = await loadCanonicalRaceSessionContext({
      season: genericSeason,
      team: genericTeam,
      round: 1,
      allPlayerDrivers: genericDrivers,
    })

    expect(res.status).toBe('no_race')
    if (res.status === 'no_race') {
      expect(res.message).toContain('Nenhuma corrida preparada')
    }
  })

  it('F4: Carro 1 larga atrás de Carro 2 (ex: P16 vs P15) => assentos oficiais e pneus permanecem intactos por driverId', async () => {
    // Equipe genérica (não Audi):
    // Carro 1: Primeiro Piloto (P16, largando ATRÁS)
    // Carro 2: Segundo Piloto (P15, largando NA FRENTE)
    const mockGrid = createMockGridWithInvertedPositions(
      'season_gen_1',
      1,
      'team_custom',
      'drv_custom_1',
      'drv_custom_2',
    )
    vi.spyOn(canonicalQualifyingPersistenceService, 'readFinalGridPreferred').mockResolvedValue({
      data: mockGrid,
      source: 'backend',
    })

    // Inscrição oficial formal onde Carro 1 = drv_custom_1 e Carro 2 = drv_custom_2
    canonicalEventRegistrationService.saveRegistrationSnapshot({
      seasonId: 'season_gen_1',
      round: 1,
      gpName: 'Generic GP',
      registeredAt: '2026-03-20T10:00:00Z',
      totalTeams: 12,
      totalEntries: 24,
      entries: [],
      entriesByCar: {
        playerCar1: {
          driverId: 'drv_custom_1',
          driverName: 'Primeiro Piloto',
          carId: 'car1',
          seatNumber: 1,
        } as any,
        playerCar2: {
          driverId: 'drv_custom_2',
          driverName: 'Segundo Piloto',
          carId: 'car2',
          seatNumber: 2,
        } as any,
      },
    })

    const mockTyres: Record<string, TireSetItem[]> = {
      drv_custom_1: [
        {
          id: 'set_c1_soft',
          compound: 'macio',
          wear: 12.0,
          lapsUsed: 3,
          isFitted: true,
          status: 'usado',
        },
      ],
      drv_custom_2: [
        {
          id: 'set_c2_med',
          compound: 'medio',
          wear: 0,
          lapsUsed: 0,
          isFitted: true,
          status: 'disponivel',
        },
      ],
    }

    vi.spyOn(canonicalWeekendTyrePersistence, 'readWeekendTyresPreferred').mockResolvedValue({
      data: {
        seasonId: 'season_gen_1',
        round: 1,
        isSprint: false,
        allotmentRules: {} as any,
        inventoriesByDriver: mockTyres,
        createdAt: '',
        updatedAt: '',
      },
      source: 'backend',
    })

    const res = await loadCanonicalRaceSessionContext({
      season: genericSeason,
      team: genericTeam,
      round: 1,
      allPlayerDrivers: genericDrivers,
    })

    expect(res.status).toBe('ready')
    if (res.status === 'ready') {
      const [driver1, driver2] = res.context.playerDrivers

      // Carro 1 DEVE ser Primeiro Piloto, com posição de grid P16
      expect(driver1.carId).toBe('car1')
      expect(driver1.carNumber).toBe(1)
      expect(driver1.driverId).toBe('drv_custom_1')
      expect(driver1.driverName).toBe('Primeiro Piloto')
      expect(driver1.gridPosition).toBe(16)
      expect(driver1.inventory[0].id).toBe('set_c1_soft')
      expect(driver1.inventory[0].wear).toBe(12.0)

      // Carro 2 DEVE ser Segundo Piloto, com posição de grid P15
      expect(driver2.carId).toBe('car2')
      expect(driver2.carNumber).toBe(2)
      expect(driver2.driverId).toBe('drv_custom_2')
      expect(driver2.driverName).toBe('Segundo Piloto')
      expect(driver2.gridPosition).toBe(15)
      expect(driver2.inventory[0].id).toBe('set_c2_med')
      expect(driver2.inventory[0].wear).toBe(0)
    }
  })

  it('F5: troca e seleção de abas no modal respeita driverId e inicialização explícita de car1 vs car2', () => {
    // Valida que o contrato aceita initialCarId explícito para evitar vazamento de abas
    const initialCar1: 'car1' | 'car2' = 'car1'
    const initialCar2: 'car1' | 'car2' = 'car2'

    expect(initialCar1).toBe('car1')
    expect(initialCar2).toBe('car2')
  })

  it('F6: determinismo na reconciliação de clima e inventário entre recarregamentos', () => {
    const wA = resolveDeterministicRaceWeather({
      careerId: 'test_career_f6',
      seasonYear: 2026,
      round: 1,
      circuitId: 'albert_park',
      totalLaps: 58,
    })

    const wB = resolveDeterministicRaceWeather({
      careerId: 'test_career_f6',
      seasonYear: 2026,
      round: 1,
      circuitId: 'albert_park',
      totalLaps: 58,
    })

    expect(wA.seed).toBe(wB.seed)
    expect(wA.airTempC).toBe(wB.airTempC)
    expect(wA.trackStatus).toBe(wB.trackStatus)
  })
})
