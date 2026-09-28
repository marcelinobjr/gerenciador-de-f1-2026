import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalWeekendSlotPersistenceService } from '@/services/canonicalWeekendSlotPersistenceService'
import { raceQualifyingOrchestratorService } from '@/services/raceQualifyingOrchestratorService'
import type {
  SprintStartingGridState,
  SprintStartingGridEntry,
} from '@/services/raceQualifyingOrchestratorService'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'

// Mock 24 pilotos padrão do grid
function createMock24Grid(playerTeamId = 'ferrari'): FinalQualifyingGridEntry[] {
  const teams = [
    'ferrari',
    'ferrari',
    'mercedes',
    'mercedes',
    'mclaren',
    'mclaren',
    'red_bull',
    'red_bull',
    'aston_martin',
    'aston_martin',
    'alpine',
    'alpine',
    'williams',
    'williams',
    'haas',
    'haas',
    'sauber',
    'sauber',
    'rb',
    'rb',
    'audi',
    'audi',
    'andretti',
    'andretti',
  ]

  return teams.map((teamId, index) => ({
    gridPosition: index + 1,
    qualifyingPosition: index + 1,
    driverId: `drv_${index + 1}`,
    driverName: `Driver ${index + 1}`,
    teamId,
    teamName: teamId.toUpperCase(),
    teamColor: '#ff0000',
    carIndex: (index % 2 === 0 ? 1 : 2) as 1 | 2,
    isPlayer: teamId === playerTeamId,
    bestLapTime: '1:20.000',
    bestLapSec: 80.0,
    eliminationPhase: 'Q3',
    eliminationStage: 'Q3',
    bestLapCompound: 'macio',
    setupBonusApplied: 0,
  }))
}

function createMockSprintStartingGrid(playerTeamId = 'ferrari'): SprintStartingGridState {
  const teams = [
    'ferrari',
    'ferrari',
    'mercedes',
    'mercedes',
    'mclaren',
    'mclaren',
    'red_bull',
    'red_bull',
    'aston_martin',
    'aston_martin',
    'alpine',
    'alpine',
    'williams',
    'williams',
    'haas',
    'haas',
    'sauber',
    'sauber',
    'rb',
    'rb',
    'audi',
    'audi',
    'andretti',
    'andretti',
  ]

  const grid: SprintStartingGridEntry[] = teams.map((teamId, index) => ({
    gridPosition: index + 1,
    qualifyingPosition: index + 1,
    driverId: `drv_sprint_${index + 1}`,
    driverName: `Sprint Driver ${index + 1}`,
    teamId,
    teamName: teamId.toUpperCase(),
    carIndex: (index % 2 === 0 ? 1 : 2) as 1 | 2,
    eliminationPhase: 'SQ3',
    qualifyingTimeMs: 80000 + index * 100,
    formattedQualifyingTime: `1:20.${(index * 100).toString().padStart(3, '0')}`,
    setup: 15,
    penalties: [],
    totalPenaltyPositions: 0,
    hasPenalty: false,
  }))

  return {
    careerId: 'test_career_rc1',
    seasonId: 'season_2026',
    round: 1,
    configVersion: 'v1',
    status: 'SPRINT_GRID_READY',
    totalParticipants: 24,
    grid,
    poleDriverId: grid[0].driverId,
    poleDriverName: grid[0].driverName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('RACE-SPRINT-SLOTS-01C1 — Suíte de Testes RC1-01 a RC1-15', () => {
  beforeEach(() => {
    localStorage.clear()
    raceQualifyingOrchestratorService.clearMemoryCache()
  })

  // RC1-01 — VARIANT: MAIN_RACE e SPRINT_RACE possuem identidades distintas.
  it('RC1-01 — VARIANT: MAIN_RACE e SPRINT_RACE possuem identidades distintas', () => {
    const mainKey = canonicalRaceSaveService.buildStorageKey('car1', 2026, 1, 'MAIN_RACE')
    const sprintKey = canonicalRaceSaveService.buildStorageKey('car1', 2026, 1, 'SPRINT_RACE')
    expect(mainKey).not.toBe(sprintKey)
    expect(sprintKey).toContain('_sprint_')

    const mainRaceId = canonicalRaceInitializationService.buildRaceId('car1', 2026, 1, 'MAIN_RACE')
    const sprintRaceId = canonicalRaceInitializationService.buildRaceId(
      'car1',
      2026,
      1,
      'SPRINT_RACE',
    )
    expect(mainRaceId).not.toBe(sprintRaceId)
    expect(sprintRaceId).toContain('_sprint')
  })

  // RC1-02 — PRÉ-CONDIÇÃO: Sprint só inicializa em weekend SPRINT / slot 3 / READY.
  it('RC1-02 — PRÉ-CONDIÇÃO: Sprint só inicializa em weekend SPRINT / slot 3 / READY', async () => {
    // 1. Caso weekend NORMAL: deve rejeitar
    const normalSlotState = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId: 'test_normal_weekend',
      seasonId: 'season_2026',
      round: 1,
    })
    normalSlotState.weekendFormat = 'NORMAL'
    await canonicalWeekendSlotPersistenceService.saveSlotState(normalSlotState)
    expect(normalSlotState.weekendFormat).toBe('NORMAL')

    await expect(
      canonicalRaceInitializationService.initializeSprintRaceFromPersistedGrid({
        careerId: 'test_normal_weekend',
        seasonId: 'season_2026',
        round: 1,
        circuitName: 'Albert Park',
        circuitCountry: 'Australia',
        circuitLengthKm: 5.278,
        playerTeamId: 'ferrari',
      }),
    ).rejects.toThrow(/Rejeitado: formato do final de semana é 'NORMAL'/)

    // 2. Caso weekend SPRINT mas slot != 3 (ex: slot 1): deve rejeitar
    const sprintSlotState = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId: 'test_sprint_wrong_slot',
      seasonId: 'season_2026',
      round: 1,
    })
    sprintSlotState.weekendFormat = 'SPRINT'
    await canonicalWeekendSlotPersistenceService.saveSlotState(sprintSlotState)
    expect(sprintSlotState.currentSlot).toBe(1)

    await expect(
      canonicalRaceInitializationService.initializeSprintRaceFromPersistedGrid({
        careerId: 'test_sprint_wrong_slot',
        seasonId: 'season_2026',
        round: 1,
        circuitName: 'Albert Park',
        circuitCountry: 'Australia',
        circuitLengthKm: 5.278,
        playerTeamId: 'ferrari',
      }),
    ).rejects.toThrow(/Rejeitado: slot atual é 1/)
  })

  // RC1-03 — GRID: SPRINT_RACE recebe exatamente SPRINT_STARTING_GRID P1–P24.
  it('RC1-03 — GRID: SPRINT_RACE recebe exatamente SPRINT_STARTING_GRID P1–P24', async () => {
    const careerId = 'test_rc1_03'
    const seasonId = 'season_2026'
    const round = 1

    // Preparar slot 3 SPRINT_RACE AVAILABLE
    const slotState = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId,
      seasonId,
      round,
    })
    slotState.weekendFormat = 'SPRINT'
    await canonicalWeekendSlotPersistenceService.saveSlotState(slotState)
    // Conclui TL1 (slot 1) e SQ (slot 2)
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 2)
    expect(slotState.currentSlot).toBe(3)
    expect(slotState.slotType).toBe('SPRINT_RACE')

    // Persistir SPRINT_STARTING_GRID
    const mockGrid = createMockSprintStartingGrid('ferrari')
    mockGrid.careerId = careerId
    await raceQualifyingOrchestratorService.persistSprintStartingGrid(mockGrid)

    // Inicializar Sprint
    const sprintState =
      await canonicalRaceInitializationService.initializeSprintRaceFromPersistedGrid({
        careerId,
        seasonId,
        round,
        circuitName: 'Interlagos',
        circuitCountry: 'Brasil',
        circuitLengthKm: 4.309,
        playerTeamId: 'ferrari',
      })

    expect(sprintState.drivers.length).toBe(24)
    expect(sprintState.drivers[0].driverId).toBe('drv_sprint_1')
    expect(sprintState.drivers[23].driverId).toBe('drv_sprint_24')
    expect(sprintState.drivers[0].currentPosition).toBe(1)
    expect(sprintState.drivers[23].currentPosition).toBe(24)
  })

  // RC1-04 — ISOLAMENTO DE GRID: Nunca utiliza STARTING_GRID principal.
  it('RC1-04 — ISOLAMENTO DE GRID: Nunca utiliza STARTING_GRID principal', async () => {
    const careerId = 'test_rc1_04'
    const seasonId = 'season_2026'
    const round = 1

    const slotState = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId,
      seasonId,
      round,
      weekendFormat: 'SPRINT',
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 2)

    // Grava SPRINT_STARTING_GRID com pilotos específicos
    const mockSprintGrid = createMockSprintStartingGrid('ferrari')
    mockSprintGrid.careerId = careerId
    mockSprintGrid.grid[0].driverName = 'Sprint Poleman Especial'
    await raceQualifyingOrchestratorService.persistSprintStartingGrid(mockSprintGrid)

    const sprintState =
      await canonicalRaceInitializationService.initializeSprintRaceFromPersistedGrid({
        careerId,
        seasonId,
        round,
        circuitName: 'Red Bull Ring',
        circuitCountry: 'Austria',
        circuitLengthKm: 4.318,
        playerTeamId: 'ferrari',
      })

    // Deve ser o piloto do grid Sprint, não do GP
    expect(sprintState.drivers[0].driverName).toBe('Sprint Poleman Especial')
    expect(sprintState.drivers[0].driverId).toBe('drv_sprint_1')
  })

  // RC1-05 — LAPS: sprintLaps = ceil(100 km / circuitLengthKm).
  it('RC1-05 — LAPS: sprintLaps = ceil(100 km / circuitLengthKm) em múltiplos circuitos', () => {
    // Prova matemática conceitual do enunciado:
    // extensão 5.0 km -> 20 voltas
    expect(canonicalRaceInitializationService.calculateSprintLaps(5.0)).toBe(20)
    // extensão 5.5 km -> ceil(18.18) = 19 voltas
    expect(canonicalRaceInitializationService.calculateSprintLaps(5.5)).toBe(19)

    // Fixtures de circuitos reais:
    // Spa-Francorchamps: 7.004 km -> ceil(100 / 7.004) = ceil(14.277) = 15 voltas
    expect(canonicalRaceInitializationService.calculateSprintLaps(7.004)).toBe(15)
    // Interlagos: 4.309 km -> ceil(100 / 4.309) = ceil(23.207) = 24 voltas
    expect(canonicalRaceInitializationService.calculateSprintLaps(4.309)).toBe(24)
    // Red Bull Ring: 4.318 km -> ceil(100 / 4.318) = ceil(23.158) = 24 voltas
    expect(canonicalRaceInitializationService.calculateSprintLaps(4.318)).toBe(24)
    // Silverstone: 5.891 km -> ceil(100 / 5.891) = ceil(16.975) = 17 voltas
    expect(canonicalRaceInitializationService.calculateSprintLaps(5.891)).toBe(17)
    // Monaco: 3.337 km -> ceil(100 / 3.337) = ceil(29.967) = 30 voltas
    expect(canonicalRaceInitializationService.calculateSprintLaps(3.337)).toBe(30)
  })

  // RC1-06 — PNEU SECO: Todos iniciam de Medium em condição seca.
  it('RC1-06 — PNEU SECO: Todos iniciam de Medium em condição seca', async () => {
    const careerId = 'test_rc1_06'
    const seasonId = 'season_2026'
    const round = 1

    const slotState = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId,
      seasonId,
      round,
      weekendFormat: 'SPRINT',
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 2)

    const mockGrid = createMockSprintStartingGrid('ferrari')
    mockGrid.careerId = careerId
    await raceQualifyingOrchestratorService.persistSprintStartingGrid(mockGrid)

    const sprintState =
      await canonicalRaceInitializationService.initializeSprintRaceFromPersistedGrid({
        careerId,
        seasonId,
        round,
        circuitName: 'Interlagos',
        circuitCountry: 'Brasil',
        circuitLengthKm: 4.309,
        playerTeamId: 'ferrari',
        weather: 'seco',
      })

    // Todos os 24 carros largam de médio no seco
    for (const d of sprintState.drivers) {
      expect(d.tyreCompound).toBe('medio')
    }
  })

  // RC1-07 — PNEU MOLHADO: Condição molhada utiliza política wet/intermediate já existente, não Medium forçado.
  it('RC1-07 — PNEU MOLHADO: Condição molhada utiliza política wet/intermediate, não Medium forçado', async () => {
    const careerId = 'test_rc1_07'
    const seasonId = 'season_2026'
    const round = 1

    const slotState = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId,
      seasonId,
      round,
      weekendFormat: 'SPRINT',
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 2)

    const mockGrid = createMockSprintStartingGrid('ferrari')
    mockGrid.careerId = careerId
    await raceQualifyingOrchestratorService.persistSprintStartingGrid(mockGrid)

    // Chuva fraca -> intermediário
    const sprintInter =
      await canonicalRaceInitializationService.initializeSprintRaceFromPersistedGrid({
        careerId,
        seasonId,
        round,
        circuitName: 'Interlagos',
        circuitCountry: 'Brasil',
        circuitLengthKm: 4.309,
        playerTeamId: 'ferrari',
        weather: 'chuva_fraca',
      })
    for (const d of sprintInter.drivers) {
      expect(d.tyreCompound).toBe('intermediario')
    }

    // Chuva forte -> chuva_extrema
    localStorage.clear()
    await raceQualifyingOrchestratorService.persistSprintStartingGrid(mockGrid)
    const sprintWet =
      await canonicalRaceInitializationService.initializeSprintRaceFromPersistedGrid({
        careerId,
        seasonId,
        round,
        circuitName: 'Interlagos',
        circuitCountry: 'Brasil',
        circuitLengthKm: 4.309,
        playerTeamId: 'ferrari',
        weather: 'chuva_forte',
      })
    for (const d of sprintWet.drivers) {
      expect(d.tyreCompound).toBe('chuva_extrema')
    }
  })

  // RC1-08 — STATE CONTRACT: Os 24 carros utilizam o mesmo modelo estrutural da corrida principal.
  it('RC1-08 — STATE CONTRACT: Os 24 carros utilizam o mesmo modelo estrutural da corrida principal', async () => {
    const careerId = 'test_rc1_08'
    const seasonId = 'season_2026'
    const round = 1

    const slotState = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId,
      seasonId,
      round,
      weekendFormat: 'SPRINT',
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 2)

    const mockGrid = createMockSprintStartingGrid('ferrari')
    mockGrid.careerId = careerId
    await raceQualifyingOrchestratorService.persistSprintStartingGrid(mockGrid)

    const sprintState =
      await canonicalRaceInitializationService.initializeSprintRaceFromPersistedGrid({
        careerId,
        seasonId,
        round,
        circuitName: 'Interlagos',
        circuitCountry: 'Brasil',
        circuitLengthKm: 4.309,
        playerTeamId: 'ferrari',
      })

    expect(sprintState.drivers.length).toBe(24)
    sprintState.drivers.forEach((d) => {
      expect(d).toHaveProperty('careerId')
      expect(d).toHaveProperty('season')
      expect(d).toHaveProperty('raceId')
      expect(d).toHaveProperty('driverId')
      expect(d).toHaveProperty('teamId')
      expect(d).toHaveProperty('gridPosition')
      expect(d).toHaveProperty('currentPosition')
      expect(d).toHaveProperty('lap', 0)
      expect(d).toHaveProperty('raceTime', 0)
      expect(d).toHaveProperty('gap')
      expect(d).toHaveProperty('tyreCompound')
      expect(d).toHaveProperty('tyreAge')
      expect(d).toHaveProperty('fuel')
      expect(d).toHaveProperty('carCondition', 100)
      expect(d).toHaveProperty('raceStatus', 'racing')
      expect(d).toHaveProperty('pitStops', 0)
      expect(d).toHaveProperty('strategy')
      expect(d.raceVariant).toBe('SPRINT_RACE')
    })
  })

  // RC1-09 — SETUP: Setup do TL1 é preservado e não alterado.
  it('RC1-09 — SETUP: Setup do TL1 é preservado e não alterado', async () => {
    const careerId = 'test_rc1_09'
    const seasonId = 'season_2026'
    const round = 1

    const slotState = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId,
      seasonId,
      round,
      weekendFormat: 'SPRINT',
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 2)

    const mockGrid = createMockSprintStartingGrid('ferrari')
    mockGrid.careerId = careerId
    mockGrid.grid[0].setup = 22 // Setup herdado do TL1
    await raceQualifyingOrchestratorService.persistSprintStartingGrid(mockGrid)

    const sprintState =
      await canonicalRaceInitializationService.initializeSprintRaceFromPersistedGrid({
        careerId,
        seasonId,
        round,
        circuitName: 'Interlagos',
        circuitCountry: 'Brasil',
        circuitLengthKm: 4.309,
        playerTeamId: 'ferrari',
      })

    // Setup gravado no SPRINT_STARTING_GRID permanece inalterado
    const loadedGrid = await raceQualifyingOrchestratorService.loadPersistedSprintStartingGrid(
      careerId,
      seasonId,
      round,
    )
    expect(loadedGrid?.grid[0].setup).toBe(22)
  })

  // RC1-10 — RNG NAMESPACE: SPRINT_RACE possui namespace distinto de MAIN_RACE.
  it('RC1-10 — RNG NAMESPACE: SPRINT_RACE possui namespace distinto de MAIN_RACE', () => {
    const mainRaceState = {
      careerId: 'car1',
      raceId: 'race_car1_s2026_r1',
      season: 2026,
      round: 1,
      raceVariant: 'MAIN_RACE' as const,
    } as any

    const sprintRaceState = {
      careerId: 'car1',
      raceId: 'race_car1_s2026_r1_sprint',
      season: 2026,
      round: 1,
      raceVariant: 'SPRINT_RACE' as const,
    } as any

    const mainSeed = canonicalRaceEngineService.deriveLapSeed(mainRaceState, 1)
    const sprintSeed = canonicalRaceEngineService.deriveLapSeed(sprintRaceState, 1)

    expect(mainSeed).not.toBe(sprintSeed)
  })

  // RC1-11 — IDEMPOTÊNCIA: Inicializar duas vezes retorna o mesmo Sprint Race State.
  it('RC1-11 — IDEMPOTÊNCIA: Inicializar duas vezes retorna o mesmo Sprint Race State', async () => {
    const careerId = 'test_rc1_11'
    const seasonId = 'season_2026'
    const round = 1

    const slotState = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId,
      seasonId,
      round,
      weekendFormat: 'SPRINT',
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 2)

    const mockGrid = createMockSprintStartingGrid('ferrari')
    mockGrid.careerId = careerId
    await raceQualifyingOrchestratorService.persistSprintStartingGrid(mockGrid)

    const state1 = await canonicalRaceInitializationService.initializeSprintRaceFromPersistedGrid({
      careerId,
      seasonId,
      round,
      circuitName: 'Interlagos',
      circuitCountry: 'Brasil',
      circuitLengthKm: 4.309,
      playerTeamId: 'ferrari',
    })

    const state2 = await canonicalRaceInitializationService.initializeSprintRaceFromPersistedGrid({
      careerId,
      seasonId,
      round,
      circuitName: 'Interlagos',
      circuitCountry: 'Brasil',
      circuitLengthKm: 4.309,
      playerTeamId: 'ferrari',
    })

    expect(state1.raceId).toBe(state2.raceId)
    expect(state1.totalLaps).toBe(state2.totalLaps)
    expect(state1.updatedAt).toBe(state2.updatedAt)
    expect(state1.drivers[0].driverId).toBe(state2.drivers[0].driverId)
  })

  // RC1-12 — RELOAD: Persistir → descartar memória → reload: estado inicial idêntico.
  it('RC1-12 — RELOAD: Persistir → descartar memória → reload: estado inicial idêntico', async () => {
    const careerId = 'test_rc1_12'
    const seasonId = 'season_2026'
    const round = 1

    const slotState = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId,
      seasonId,
      round,
      weekendFormat: 'SPRINT',
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 2)

    const mockGrid = createMockSprintStartingGrid('ferrari')
    mockGrid.careerId = careerId
    await raceQualifyingOrchestratorService.persistSprintStartingGrid(mockGrid)

    const initial = await canonicalRaceInitializationService.initializeSprintRaceFromPersistedGrid({
      careerId,
      seasonId,
      round,
      circuitName: 'Interlagos',
      circuitCountry: 'Brasil',
      circuitLengthKm: 4.309,
      playerTeamId: 'ferrari',
    })

    // Reload direto do storage sem passar por memória
    const loaded = canonicalRaceInitializationService.readCanonicalRaceState(
      careerId,
      2026,
      round,
      'SPRINT_RACE',
    )

    expect(loaded).not.toBeNull()
    expect(loaded?.raceVariant).toBe('SPRINT_RACE')
    expect(loaded?.totalLaps).toBe(initial.totalLaps)
    expect(loaded?.status).toBe('not_started')
    expect(loaded?.drivers.length).toBe(24)
    expect(loaded?.drivers[0].driverId).toBe(initial.drivers[0].driverId)
  })

  // RC1-13 — SLOT: Inicialização mantém slot 3. Não libera Q1.
  it('RC1-13 — SLOT: Inicialização mantém slot 3. Não libera Q1', async () => {
    const careerId = 'test_rc1_13'
    const seasonId = 'season_2026'
    const round = 1

    const slotState = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId,
      seasonId,
      round,
      weekendFormat: 'SPRINT',
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 2)

    const mockGrid = createMockSprintStartingGrid('ferrari')
    mockGrid.careerId = careerId
    await raceQualifyingOrchestratorService.persistSprintStartingGrid(mockGrid)

    await canonicalRaceInitializationService.initializeSprintRaceFromPersistedGrid({
      careerId,
      seasonId,
      round,
      circuitName: 'Interlagos',
      circuitCountry: 'Brasil',
      circuitLengthKm: 4.309,
      playerTeamId: 'ferrari',
    })

    // Consulta o estado do slot: permanece 3 (SPRINT_RACE)
    const currentSlot = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId,
      seasonId,
      round,
    })
    expect(currentSlot.currentSlot).toBe(3)
    expect(currentSlot.slotType).toBe('SPRINT_RACE')
    expect(currentSlot.slots[4].status).toBe('LOCKED') // Q1 continua bloqueado!
  })

  // RC1-14 — NORMAL REGRESSION: Weekend NORMAL / MAIN_RACE continua intacto.
  it('RC1-14 — NORMAL REGRESSION: Weekend NORMAL / MAIN_RACE continua intacto', () => {
    const careerId = 'test_rc1_14'
    const normalGrid = createMock24Grid('ferrari')

    const mainRace = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      raceVariant: 'MAIN_RACE',
      careerId,
      season: 2026,
      round: 1,
      circuitName: 'Albert Park',
      circuitCountry: 'Australia',
      totalLaps: 58,
      playerTeamId: 'ferrari',
      canonicalQualifyingGrid: normalGrid,
      initialFuelKg: 100,
      weather: 'seco',
    })

    expect(mainRace.raceVariant).toBe('MAIN_RACE')
    expect(mainRace.totalLaps).toBe(58)
    expect(mainRace.currentLap).toBe(1)
    expect(mainRace.status).toBe('not_started')
    expect(mainRace.drivers.length).toBe(24)
    expect(mainRace.raceId).toBe(`race_${careerId}_s2026_r1`)

    // O save da MAIN_RACE não interfere com a SPRINT_RACE
    const loadedMain = canonicalRaceInitializationService.readCanonicalRaceState(
      careerId,
      2026,
      1,
      'MAIN_RACE',
    )
    const loadedSprint = canonicalRaceInitializationService.readCanonicalRaceState(
      careerId,
      2026,
      1,
      'SPRINT_RACE',
    )
    expect(loadedMain).not.toBeNull()
    expect(loadedSprint).toBeNull()
  })

  // RC1-15 — SEM EXECUÇÃO: Após a 01C1: lap atual continua pré-largada / zero conforme modelo real. Nenhuma volta foi processada.
  it('RC1-15 — SEM EXECUÇÃO: Após a 01C1: lap atual continua pré-largada / zero. Nenhuma volta processada', async () => {
    const careerId = 'test_rc1_15'
    const seasonId = 'season_2026'
    const round = 1

    const slotState = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId,
      seasonId,
      round,
      weekendFormat: 'SPRINT',
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 1)
    await canonicalWeekendSlotPersistenceService.completeSlot(slotState, 2)

    const mockGrid = createMockSprintStartingGrid('ferrari')
    mockGrid.careerId = careerId
    await raceQualifyingOrchestratorService.persistSprintStartingGrid(mockGrid)

    const sprintState =
      await canonicalRaceInitializationService.initializeSprintRaceFromPersistedGrid({
        careerId,
        seasonId,
        round,
        circuitName: 'Interlagos',
        circuitCountry: 'Brasil',
        circuitLengthKm: 4.309,
        playerTeamId: 'ferrari',
      })

    expect(sprintState.status).toBe('not_started')
    expect(sprintState.currentLap).toBe(1)
    for (const d of sprintState.drivers) {
      expect(d.lap).toBe(0) // 0 voltas completadas
      expect(d.raceTime).toBe(0)
      expect(d.pitStops).toBe(0)
      expect(d.carCondition).toBe(100)
    }
  })
})
