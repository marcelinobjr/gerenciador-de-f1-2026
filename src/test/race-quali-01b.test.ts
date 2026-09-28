/**
 * src/test/race-quali-01b.test.ts
 *
 * Microentrega RACE-QUALI-01B, ETAPA 1: QUALIFYING_RESULT GLOBAL
 * Transição de estado: Q3_COMPLETE → QUALIFYING_COMPLETE → QUALIFYING_RESULT_READY
 *
 * Consolidação do resultado global da classificação exclusivamente a partir
 * dos dados já persistidos de Q1, Q2 e Q3.
 *
 * COMPOSIÇÃO DO RESULTADO GLOBAL (fixture de 24 carros):
 * - P1–P10: ordem final do Q3.
 * - P11–P18: os 8 eliminados no Q2, ordenados exclusivamente pelo resultado persistido do Q2.
 * - P19–P24: os 6 eliminados no Q1, ordenados exclusivamente pelo resultado persistido do Q1.
 *
 * TESTES OBRIGATÓRIOS (QB01–QB07):
 * QB01: os 10 do Q3 formam P1–P10 na ordem do Q3.
 * QB02: os 8 eliminados do Q2 formam P11–P18 na ordem persistida do Q2.
 * QB03: os 6 eliminados do Q1 formam P19–P24 na ordem persistida do Q1.
 * QB04: bijeção — 24 participantes, 24 posições, zero duplicados, zero ausentes.
 * QB05: precedência de fase (eliminado do Q1 nunca supera participante do Q2; eliminado do Q2 nunca supera participante do Q3).
 * QB06: geração do resultado global consome ZERO sorteios adicionais.
 * QB07: idempotência — gerar novamente devolve o mesmo artefato.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  RaceQualifyingOrchestratorService,
  raceQualifyingOrchestratorService,
  QualifyingDriverInput,
  buildGlobalQualifyingStorageKey,
  buildStartingGridStorageKey,
} from '@/services/raceQualifyingOrchestratorService'
import { DEFAULT_SOURCE_RACE_PARAMETERS } from '@/lib/race/pureRaceEngine'
import { DEFAULT_RACE_DRAFT_VERSION } from '@/lib/race/loader'
import type { VersionedRaceConfig } from '@/lib/race/types'

// Mock do localStorage para testes de reload e persistência resiliente
const memoryLocalStorage: Record<string, string> = {}
const mockStorage = {
  getItem: (key: string) => memoryLocalStorage[key] || null,
  setItem: (key: string, val: string) => {
    memoryLocalStorage[key] = String(val)
  },
  removeItem: (key: string) => {
    delete memoryLocalStorage[key]
  },
  clear: () => {
    for (const k of Object.keys(memoryLocalStorage)) {
      delete memoryLocalStorage[k]
    }
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
})

// Configuração canônica versionada
const mockRaceConfig: VersionedRaceConfig = {
  id: 'rec_draft_race_quali_01b',
  version: DEFAULT_RACE_DRAFT_VERSION,
  sha256: '15e9e24a41300938f29cefdca68480db80c05988548bb2268798e4d35e1286ae',
  status: 'DRAFT',
  is_active: false,
  work_item: 'RACE-QUALI-01B',
  delivery_version: 'RACE-QUALI-01B-1.0.0',
  source_declared_version: 'v1',
  source_sha256: '0d02e79794f6defabfa3385d2854a4fc0bed7e5a17495c008075185d71f289a2',
  parameters: {
    ...DEFAULT_SOURCE_RACE_PARAMETERS,
    max_setup_qualifying_bonus_seconds: 0.25,
    max_setup_race_bonus_seconds_per_lap: 0.15,
    qualifying_noise_sd_ms: 150,
  },
  tables: {
    practices: [
      { session: 'TL1', laps: 24, max_setup_gain: 40, time_offset_sec: 1.5, soft_tyre_prob: 0.3 },
      { session: 'TL2', laps: 26, max_setup_gain: 40, time_offset_sec: 0.8, soft_tyre_prob: 0.5 },
      { session: 'TL3', laps: 18, max_setup_gain: 30, time_offset_sec: 0.2, soft_tyre_prob: 0.8 },
    ],
  },
  catalogs: {
    entrants_count: 24,
    teams_count: 12,
  },
  metadata: {
    notes: 'Configuração canônica para testes do resultado global da qualificação.',
  },
  created: '2026-09-28T00:00:00.000Z',
  updated: '2026-09-28T00:00:00.000Z',
}

// Fixture oficial de 24 pilotos (12 equipes x 2 pilotos)
const create24EntrantsFixture = (setupVal = 90.2275): QualifyingDriverInput[] => {
  const teams = [
    { teamId: 'mclaren', teamName: 'McLaren', baseCar: 92 },
    { teamId: 'ferrari', teamName: 'Ferrari', baseCar: 91 },
    { teamId: 'redbull', teamName: 'Red Bull Racing', baseCar: 90 },
    { teamId: 'mercedes', teamName: 'Mercedes', baseCar: 88 },
    { teamId: 'astonmartin', teamName: 'Aston Martin', baseCar: 85 },
    { teamId: 'alpine', teamName: 'Alpine', baseCar: 82 },
    { teamId: 'williams', teamName: 'Williams', baseCar: 81 },
    { teamId: 'racingbulls', teamName: 'Racing Bulls', baseCar: 80 },
    { teamId: 'sauber', teamName: 'Sauber', baseCar: 78 },
    { teamId: 'haas', teamName: 'Haas', baseCar: 77 },
    { teamId: 'andretti', teamName: 'Andretti', baseCar: 76 },
    { teamId: 'audi_sport', teamName: 'Audi F1 Team', baseCar: 79 },
  ]

  const entrants: QualifyingDriverInput[] = []
  teams.forEach((t, tIdx) => {
    for (let c = 1; c <= 2; c++) {
      const entrantIndex = tIdx * 2 + c
      entrants.push({
        driverId: `drv_${entrantIndex.toString().padStart(3, '0')}`,
        driverName: `Driver ${entrantIndex}`,
        teamId: t.teamId,
        teamName: t.teamName,
        carIndex: c as 1 | 2,
        carPerformance: t.baseCar,
        speed: 80 + (24 - entrantIndex) * 0.4,
        qualifying: 80 + (24 - entrantIndex) * 0.4,
        form: 50,
        morale: 50,
        wet_skill: 50,
        setup: setupVal,
      })
    }
  })

  return entrants
}

describe('RACE-QUALI-01B, ETAPA 1: QUALIFYING_RESULT GLOBAL (Testes QB01–QB07)', () => {
  let pbSessionSetupsStore: any[] = []

  beforeEach(() => {
    mockStorage.clear()
    pbSessionSetupsStore = []
    raceQualifyingOrchestratorService.clearMemoryCache()

    // Mock do PB race_versioned_configs
    vi.spyOn(pb.collection('race_versioned_configs'), 'getFirstListItem').mockImplementation(
      async (filter: string) => {
        if (filter.includes(DEFAULT_RACE_DRAFT_VERSION)) {
          return mockRaceConfig as any
        }
        throw new Error(`Record not found for filter: ${filter}`)
      },
    )

    // Mock do PB session_setups
    vi.spyOn(pb.collection('session_setups'), 'getList').mockImplementation(
      async (_page: number, _perPage: number, options?: any) => {
        const filter = options?.filter || ''
        const matches = pbSessionSetupsStore.filter((item) => {
          if (
            filter.includes(`team_id = "${item.team_id}"`) &&
            filter.includes(`season_id = "${item.season_id}"`) &&
            filter.includes(`round = ${item.round}`) &&
            filter.includes(`session = "${item.session}"`)
          ) {
            return true
          }
          return false
        })
        return {
          page: 1,
          perPage: 50,
          totalItems: matches.length,
          totalPages: 1,
          items: matches,
        } as any
      },
    )

    vi.spyOn(pb.collection('session_setups'), 'create').mockImplementation(async (payload: any) => {
      const record = {
        id: `setup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...payload,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
      pbSessionSetupsStore.push(record)
      return record as any
    })

    vi.spyOn(pb.collection('session_setups'), 'update').mockImplementation(
      async (id: string, payload: any) => {
        const idx = pbSessionSetupsStore.findIndex((x) => x.id === id)
        if (idx >= 0) {
          pbSessionSetupsStore[idx] = {
            ...pbSessionSetupsStore[idx],
            ...payload,
            updated: new Date().toISOString(),
          }
          return pbSessionSetupsStore[idx]
        }
        throw new Error(`Record ${id} not found`)
      },
    )
  })

  // Helper para preparar as fases Q1, Q2 e Q3
  async function prepareQualifyingComplete(context: {
    careerId: string
    seasonId: string
    round: number
  }) {
    const fixture = create24EntrantsFixture()
    const q1State = await raceQualifyingOrchestratorService.executeQ1({
      ...context,
      participants: fixture,
      forceBypassPracticeCheck: true,
    })
    const q2State = await raceQualifyingOrchestratorService.executeQ2({
      ...context,
      forceBypassPracticeCheck: true,
    })
    const q3State = await raceQualifyingOrchestratorService.executeQ3({
      ...context,
      forceBypassPracticeCheck: true,
    })
    return { q1State, q2State, q3State }
  }

  // =========================================================================
  // QB01: os 10 do Q3 formam P1–P10 na ordem do Q3
  // =========================================================================
  it('QB01: os 10 participantes do Q3 formam P1–P10 na exata ordem do Q3', async () => {
    const context = {
      careerId: 'career_qb01',
      seasonId: 'season_2026',
      round: 1,
    }
    const { q3State } = await prepareQualifyingComplete(context)

    const globalResult =
      await raceQualifyingOrchestratorService.buildGlobalQualifyingResult(context)

    expect(globalResult.status).toBe('QUALIFYING_RESULT_READY')
    expect(globalResult.results).toHaveLength(24)

    // Top 10 do resultado global
    const top10 = globalResult.results.slice(0, 10)
    expect(top10).toHaveLength(10)

    // Ordem oficial persistida do Q3
    const q3Sorted = [...q3State.results].sort((a, b) => a.position - b.position)

    for (let i = 0; i < 10; i++) {
      expect(top10[i].position).toBe(i + 1)
      expect(top10[i].driverId).toBe(q3Sorted[i].driverId)
      expect(top10[i].eliminationPhase).toBe('Q3')
      expect(top10[i].phaseBestTimeMs).toBe(q3Sorted[i].bestTimeMs)
      expect(top10[i].formattedPhaseBestTime).toBe(q3Sorted[i].formattedBestTime)
      expect(top10[i].q3BestTimeMs).toBe(q3Sorted[i].bestTimeMs)
    }

    // Pole position
    expect(globalResult.poleDriverId).toBe(q3Sorted[0].driverId)
    expect(globalResult.poleTimeMs).toBe(q3Sorted[0].bestTimeMs)
  })

  // =========================================================================
  // QB02: os 8 eliminados do Q2 formam P11–P18 na ordem persistida do Q2
  // =========================================================================
  it('QB02: os 8 eliminados do Q2 formam P11–P18 na ordem persistida do Q2', async () => {
    const context = {
      careerId: 'career_qb02',
      seasonId: 'season_2026',
      round: 1,
    }
    const { q2State } = await prepareQualifyingComplete(context)

    const globalResult =
      await raceQualifyingOrchestratorService.buildGlobalQualifyingResult(context)

    // P11 a P18 no resultado global (índices 10 a 17)
    const p11ToP18 = globalResult.results.slice(10, 18)
    expect(p11ToP18).toHaveLength(8)

    // 8 eliminados no Q2 ordenados pela posição persistida de Q2
    const q2Eliminated = q2State.results
      .filter((r) => r.isEliminated || q2State.eliminatedDriverIds.includes(r.driverId))
      .sort((a, b) => a.position - b.position)

    expect(q2Eliminated).toHaveLength(8)

    for (let i = 0; i < 8; i++) {
      const globalEntry = p11ToP18[i]
      const expectedEliminated = q2Eliminated[i]

      expect(globalEntry.position).toBe(11 + i)
      expect(globalEntry.driverId).toBe(expectedEliminated.driverId)
      expect(globalEntry.eliminationPhase).toBe('Q2')
      expect(globalEntry.phaseBestTimeMs).toBe(expectedEliminated.bestTimeMs)
      expect(globalEntry.formattedPhaseBestTime).toBe(expectedEliminated.formattedBestTime)
      expect(globalEntry.q2BestTimeMs).toBe(expectedEliminated.bestTimeMs)
      expect(globalEntry.q3BestTimeMs).toBeUndefined()
    }
  })

  // =========================================================================
  // QB03: os 6 eliminados do Q1 formam P19–P24 na ordem persistida do Q1
  // =========================================================================
  it('QB03: os 6 eliminados do Q1 formam P19–P24 na ordem persistida do Q1', async () => {
    const context = {
      careerId: 'career_qb03',
      seasonId: 'season_2026',
      round: 1,
    }
    const { q1State } = await prepareQualifyingComplete(context)

    const globalResult =
      await raceQualifyingOrchestratorService.buildGlobalQualifyingResult(context)

    // P19 a P24 no resultado global (índices 18 a 23)
    const p19ToP24 = globalResult.results.slice(18, 24)
    expect(p19ToP24).toHaveLength(6)

    // 6 eliminados no Q1 ordenados pela posição persistida de Q1
    const q1Eliminated = q1State.results
      .filter((r) => r.isEliminated || q1State.eliminatedDriverIds.includes(r.driverId))
      .sort((a, b) => a.position - b.position)

    expect(q1Eliminated).toHaveLength(6)

    for (let i = 0; i < 6; i++) {
      const globalEntry = p19ToP24[i]
      const expectedEliminated = q1Eliminated[i]

      expect(globalEntry.position).toBe(19 + i)
      expect(globalEntry.driverId).toBe(expectedEliminated.driverId)
      expect(globalEntry.eliminationPhase).toBe('Q1')
      expect(globalEntry.phaseBestTimeMs).toBe(expectedEliminated.bestTimeMs)
      expect(globalEntry.formattedPhaseBestTime).toBe(expectedEliminated.formattedBestTime)
      expect(globalEntry.q1BestTimeMs).toBe(expectedEliminated.bestTimeMs)
      expect(globalEntry.q2BestTimeMs).toBeUndefined()
      expect(globalEntry.q3BestTimeMs).toBeUndefined()
    }
  })

  // =========================================================================
  // QB04: bijeção — 24 participantes, 24 posições, zero duplicados, zero ausentes
  // =========================================================================
  it('QB04: bijeção estrita — 24 participantes, 24 posições, zero duplicados, zero ausentes e falha explícita se corrompido', async () => {
    const context = {
      careerId: 'career_qb04',
      seasonId: 'season_2026',
      round: 1,
    }
    const { q1State } = await prepareQualifyingComplete(context)

    const globalResult =
      await raceQualifyingOrchestratorService.buildGlobalQualifyingResult(context)

    expect(globalResult.totalParticipants).toBe(24)
    expect(globalResult.results).toHaveLength(24)

    // Todas as posições de P1 a P24 devem estar presentes de forma contínua
    const positions = globalResult.results.map((r) => r.position).sort((a, b) => a - b)
    expect(positions).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))
    expect(new Set(positions).size).toBe(24)

    // Todos os 24 participantes originais devem estar presentes exatamente uma vez
    const globalDriverIds = globalResult.results.map((r) => r.driverId)
    const uniqueDriverIds = new Set(globalDriverIds)
    expect(uniqueDriverIds.size).toBe(24)

    const originalDriverIds = new Set(q1State.results.map((r) => r.driverId))
    expect(uniqueDriverIds).toEqual(originalDriverIds)

    // Validação de rejeição explícita (sem tentar consertar silenciosamente):
    // Se corrompermos o estado do Q3 persistido forçando piloto duplicado ou desconhecido:
    const corruptService = new RaceQualifyingOrchestratorService()
    const q3Corrupted = await raceQualifyingOrchestratorService.loadPersistedPhaseState(
      'Q3',
      context.careerId,
      context.seasonId,
      context.round,
    )
    expect(q3Corrupted).not.toBeNull()

    // Piloto desconhecido
    const fakeQ3 = {
      ...q3Corrupted!,
      results: [
        ...q3Corrupted!.results.slice(0, 9),
        { ...q3Corrupted!.results[9], driverId: 'drv_ghost_999' },
      ],
    }
    await corruptService.persistPhaseState(fakeQ3 as any)
    corruptService.clearMemoryCache()

    await expect(
      corruptService.buildGlobalQualifyingResult({
        careerId: context.careerId,
        seasonId: context.seasonId,
        round: context.round,
      }),
    ).rejects.toThrow(/Violação de integridade esportiva|Violação de bijeção/)
  })

  // =========================================================================
  // QB05: precedência de fase
  // =========================================================================
  it('QB05: precedência de fase — eliminado do Q1 nunca supera participante do Q2; eliminado do Q2 nunca supera participante do Q3', async () => {
    const context = {
      careerId: 'career_qb05',
      seasonId: 'season_2026',
      round: 1,
    }
    const { q1State, q2State, q3State } = await prepareQualifyingComplete(context)

    const globalResult =
      await raceQualifyingOrchestratorService.buildGlobalQualifyingResult(context)

    // Coleta as posições e fases
    const phaseByDriverId = new Map(
      globalResult.results.map((r) => [r.driverId, r.eliminationPhase]),
    )
    const positionByDriverId = new Map(globalResult.results.map((r) => [r.driverId, r.position]))

    const q3DriverIds = q3State.results.map((r) => r.driverId)
    const q2EliminatedDriverIds = q2State.eliminatedDriverIds
    const q1EliminatedDriverIds = q1State.eliminatedDriverIds

    // 1. Qualquer piloto de Q3 deve ter posição < qualquer eliminado de Q2
    for (const q3Id of q3DriverIds) {
      const q3Pos = positionByDriverId.get(q3Id)!
      expect(q3Pos).toBeLessThanOrEqual(10)
      expect(phaseByDriverId.get(q3Id)).toBe('Q3')

      for (const q2ElimId of q2EliminatedDriverIds) {
        const q2ElimPos = positionByDriverId.get(q2ElimId)!
        expect(q3Pos).toBeLessThan(q2ElimPos)
      }
    }

    // 2. Qualquer eliminado de Q2 deve ter posição < qualquer eliminado de Q1
    for (const q2ElimId of q2EliminatedDriverIds) {
      const q2ElimPos = positionByDriverId.get(q2ElimId)!
      expect(q2ElimPos).toBeGreaterThanOrEqual(11)
      expect(q2ElimPos).toBeLessThanOrEqual(18)
      expect(phaseByDriverId.get(q2ElimId)).toBe('Q2')

      for (const q1ElimId of q1EliminatedDriverIds) {
        const q1ElimPos = positionByDriverId.get(q1ElimId)!
        expect(q2ElimPos).toBeLessThan(q1ElimPos)
      }
    }

    // 3. Qualquer eliminado de Q1 deve ter posição P19..P24
    for (const q1ElimId of q1EliminatedDriverIds) {
      const q1ElimPos = positionByDriverId.get(q1ElimId)!
      expect(q1ElimPos).toBeGreaterThanOrEqual(19)
      expect(q1ElimPos).toBeLessThanOrEqual(24)
      expect(phaseByDriverId.get(q1ElimId)).toBe('Q1')
    }

    // 4. Demonstração de precedência esportiva mesmo se um eliminado de Q1 tiver tempo mais rápido que piloto de Q2/Q3 em sua melhor volta
    const fastestQ1Elim = globalResult.results.find((r) => r.eliminationPhase === 'Q1')!
    const slowestQ3 = globalResult.results.find((r) => r.position === 10)!
    expect(fastestQ1Elim.position).toBeGreaterThan(slowestQ3.position)
  })

  // =========================================================================
  // QB06: geração do resultado global consome ZERO sorteios adicionais
  // =========================================================================
  it('QB06: geração do resultado global consome ZERO sorteios adicionais (Math.random() intacto)', async () => {
    const context = {
      careerId: 'career_qb06',
      seasonId: 'season_2026',
      round: 1,
    }
    await prepareQualifyingComplete(context)

    // Espionar Math.random para garantir ZERO chamadas durante a consolidação do resultado global
    const randomSpy = vi.spyOn(Math, 'random')

    const globalResult =
      await raceQualifyingOrchestratorService.buildGlobalQualifyingResult(context)

    expect(randomSpy).not.toHaveBeenCalled()
    expect(globalResult.status).toBe('QUALIFYING_RESULT_READY')
    expect(globalResult.results).toHaveLength(24)

    randomSpy.mockRestore()
  })

  // =========================================================================
  // QB07: idempotência — gerar novamente devolve o mesmo artefato
  // =========================================================================
  it('QB07: idempotência — gerar novamente devolve o mesmo artefato e preserva integridade após reload', async () => {
    const context = {
      careerId: 'career_qb07',
      seasonId: 'season_2026',
      round: 1,
    }
    await prepareQualifyingComplete(context)

    // 1ª execução
    const run1 = await raceQualifyingOrchestratorService.buildGlobalQualifyingResult(context)
    const run1Order = run1.results.map((r) => ({
      pos: r.position,
      id: r.driverId,
      time: r.phaseBestTimeMs,
      phase: r.eliminationPhase,
    }))

    // 2ª execução na mesma instância
    const run2 = await raceQualifyingOrchestratorService.buildGlobalQualifyingResult(context)
    const run2Order = run2.results.map((r) => ({
      pos: r.position,
      id: r.driverId,
      time: r.phaseBestTimeMs,
      phase: r.eliminationPhase,
    }))

    expect(run1Order).toEqual(run2Order)
    expect(run1.poleDriverId).toBe(run2.poleDriverId)
    expect(run1.poleTimeMs).toBe(run2.poleTimeMs)

    // 3ª execução: simulação de RELOAD (nova instância com cache de memória vazio)
    const reloadedService = new RaceQualifyingOrchestratorService()

    // Consulta do armazenamento persistido
    const loadedFromStorage = await reloadedService.loadPersistedGlobalQualifyingResult(
      context.careerId,
      context.seasonId,
      context.round,
    )
    expect(loadedFromStorage).not.toBeNull()
    expect(loadedFromStorage?.status).toBe('QUALIFYING_RESULT_READY')
    expect(loadedFromStorage?.results).toHaveLength(24)

    // Reexecutar a geração na instância recarregada
    const run3 = await reloadedService.buildGlobalQualifyingResult(context)
    const run3Order = run3.results.map((r) => ({
      pos: r.position,
      id: r.driverId,
      time: r.phaseBestTimeMs,
      phase: r.eliminationPhase,
    }))

    expect(run3Order).toEqual(run1Order)
  })

  // =========================================================================
  // QB08: SEM PENALIDADES — STARTING_GRID == QUALIFYING_RESULT
  // =========================================================================
  it('QB08: SEM PENALIDADES — STARTING_GRID == QUALIFYING_RESULT, 24 participantes, mesma ordem, qualifyingPosition == gridPosition', async () => {
    const context = {
      careerId: 'career_qb08',
      seasonId: 'season_2026',
      round: 1,
    }
    await prepareQualifyingComplete(context)
    const globalResult =
      await raceQualifyingOrchestratorService.buildGlobalQualifyingResult(context)

    const startingGridState = await raceQualifyingOrchestratorService.buildStartingGrid(context)

    expect(startingGridState.status).toBe('GRID_READY')
    expect(startingGridState.totalParticipants).toBe(24)
    expect(startingGridState.grid).toHaveLength(24)

    // Sem penalidades: para todos os 24 carros, qualifyingPosition == gridPosition e ordem idêntica
    for (let i = 0; i < 24; i++) {
      const gridItem = startingGridState.grid[i]
      const qualiItem = globalResult.results[i]

      expect(gridItem.gridPosition).toBe(i + 1)
      expect(gridItem.qualifyingPosition).toBe(i + 1)
      expect(gridItem.driverId).toBe(qualiItem.driverId)
      expect(gridItem.hasPenalty).toBe(false)
      expect(gridItem.totalPenaltyPositions).toBe(0)
    }

    expect(startingGridState.poleDriverId).toBe(globalResult.poleDriverId)
  })

  // =========================================================================
  // QB09: PENALIDADE CANÔNICA DE PU — qualifyingPosition imutável, gridPosition alterada, bijeção
  // =========================================================================
  it('QB09: PENALIDADE CANÔNICA — usa fixture de penalidade de PU (+10), qualifyingPosition imutável, gridPosition alterada, reordenação bijetiva', async () => {
    const context = {
      careerId: 'career_qb09',
      seasonId: 'season_2026',
      round: 1,
    }
    await prepareQualifyingComplete(context)
    const globalResult =
      await raceQualifyingOrchestratorService.buildGlobalQualifyingResult(context)

    // Piloto classificado em P3 recebe penalidade regulamentar canônica de PU5 (+10 posições)
    const p3Quali = globalResult.results.find((r) => r.position === 3)!
    expect(p3Quali).toBeDefined()

    const startingGridState = await raceQualifyingOrchestratorService.buildStartingGrid({
      ...context,
      penaltiesByDriverId: {
        [p3Quali.driverId]: [
          {
            id: `pu_pen_${p3Quali.driverId}_u5`,
            unitIndex: 5,
            positions: 10,
            reason: 'Excesso de cota anual de PU (PU5: +10 posições)',
          },
        ],
      },
    })

    // Piloto penalizado
    const penalizedGridEntry = startingGridState.grid.find((g) => g.driverId === p3Quali.driverId)!
    expect(penalizedGridEntry).toBeDefined()
    // qualifyingPosition permanece estritamente P3 (imutável)
    expect(penalizedGridEntry.qualifyingPosition).toBe(3)
    // gridPosition foi deslocada para trás (alvo provisório 3 + 10 = 13)
    expect(penalizedGridEntry.gridPosition).toBe(13)
    expect(penalizedGridEntry.hasPenalty).toBe(true)
    expect(penalizedGridEntry.totalPenaltyPositions).toBe(10)
    expect(penalizedGridEntry.penaltyReason).toContain('PU5')

    // P1 e P2 continuam P1 e P2
    expect(startingGridState.grid[0].driverId).toBe(globalResult.results[0].driverId)
    expect(startingGridState.grid[0].gridPosition).toBe(1)
    expect(startingGridState.grid[0].qualifyingPosition).toBe(1)

    expect(startingGridState.grid[1].driverId).toBe(globalResult.results[1].driverId)
    expect(startingGridState.grid[1].gridPosition).toBe(2)
    expect(startingGridState.grid[1].qualifyingPosition).toBe(2)

    // Pilotos entre P4 e P13 foram promovidos uma posição
    for (let p = 4; p <= 13; p++) {
      const origDriver = globalResult.results.find((r) => r.position === p)!
      const newGridItem = startingGridState.grid.find((g) => g.driverId === origDriver.driverId)!
      expect(newGridItem.qualifyingPosition).toBe(p)
      expect(newGridItem.gridPosition).toBe(p - 1)
    }

    // Bijeção total preservada
    const gridPositions = startingGridState.grid.map((g) => g.gridPosition).sort((a, b) => a - b)
    expect(gridPositions).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))
  })

  // =========================================================================
  // QB10: IDEMPOTÊNCIA DA PENALIDADE
  // =========================================================================
  it('QB10: IDEMPOTÊNCIA DA PENALIDADE — gerar novamente ou recarregar não reaplica penalidade nem adiciona novo deslocamento', async () => {
    const context = {
      careerId: 'career_qb10',
      seasonId: 'season_2026',
      round: 1,
    }
    await prepareQualifyingComplete(context)
    const globalResult =
      await raceQualifyingOrchestratorService.buildGlobalQualifyingResult(context)

    const p3Quali = globalResult.results.find((r) => r.position === 3)!

    const penaltyParams = {
      ...context,
      penaltiesByDriverId: {
        [p3Quali.driverId]: [
          {
            id: `pu_pen_${p3Quali.driverId}_u5`,
            unitIndex: 5,
            positions: 10,
            reason: 'PU5 +10',
          },
        ],
      },
    }

    // 1ª execução
    const grid1 = await raceQualifyingOrchestratorService.buildStartingGrid(penaltyParams)
    const p3First = grid1.grid.find((g) => g.driverId === p3Quali.driverId)!
    expect(p3First.gridPosition).toBe(13)
    expect(p3First.qualifyingPosition).toBe(3)

    // 2ª execução repetida na mesma instância
    const grid2 = await raceQualifyingOrchestratorService.buildStartingGrid(penaltyParams)
    const p3Second = grid2.grid.find((g) => g.driverId === p3Quali.driverId)!
    expect(p3Second.gridPosition).toBe(13) // Não vira 23
    expect(p3Second.qualifyingPosition).toBe(3)

    // 3ª execução: simulação de RELOAD (nova instância de serviço, cache de memória limpo)
    const reloadedService = new RaceQualifyingOrchestratorService()
    const grid3 = await reloadedService.buildStartingGrid(penaltyParams)
    const p3Third = grid3.grid.find((g) => g.driverId === p3Quali.driverId)!
    expect(p3Third.gridPosition).toBe(13)
    expect(p3Third.qualifyingPosition).toBe(3)

    expect(grid1.grid.map((g) => g.gridPosition)).toEqual(grid3.grid.map((g) => g.gridPosition))
    expect(grid1.grid.map((g) => g.driverId)).toEqual(grid3.grid.map((g) => g.driverId))
  })

  // =========================================================================
  // QB11: GRID COMPLETO BIJETIVO — 24 participantes, zero duplicados, zero ausentes
  // =========================================================================
  it('QB11: GRID COMPLETO — após múltiplas penalidades, 24 participantes únicos, P1–P24 contínuos, zero duplicados/ausentes', async () => {
    const context = {
      careerId: 'career_qb11',
      seasonId: 'season_2026',
      round: 1,
    }
    await prepareQualifyingComplete(context)
    const globalResult =
      await raceQualifyingOrchestratorService.buildGlobalQualifyingResult(context)

    // Aplicar penalidades múltiplas (PU5 de 10 posições em P1 e PU6 de 5 posições em P5)
    const p1Driver = globalResult.results[0].driverId
    const p5Driver = globalResult.results[4].driverId

    const startingGridState = await raceQualifyingOrchestratorService.buildStartingGrid({
      ...context,
      penaltiesByDriverId: {
        [p1Driver]: [{ id: 'pen_1', unitIndex: 5, positions: 10, reason: 'PU5 +10' }],
        [p5Driver]: [{ id: 'pen_2', unitIndex: 6, positions: 5, reason: 'PU6 +5' }],
      },
    })

    expect(startingGridState.grid).toHaveLength(24)

    // Unicidade de pilotos
    const driverIds = startingGridState.grid.map((g) => g.driverId)
    const uniqueDrivers = new Set(driverIds)
    expect(uniqueDrivers.size).toBe(24)

    // Posições P1..P24 contínuas e bijetivas
    const positions = startingGridState.grid.map((g) => g.gridPosition).sort((a, b) => a - b)
    expect(positions).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))
    expect(new Set(positions).size).toBe(24)

    // Identidade do carro (carIndex 1 ou 2) preservada
    for (const entry of startingGridState.grid) {
      expect([1, 2]).toContain(entry.carIndex)
    }
  })

  // =========================================================================
  // QB12: ISOLAMENTO ESTREITO ENTRE CARREIRAS E RODADAS
  // =========================================================================
  it('QB12: ISOLAMENTO — outra carreira ou rodada não compartilha penalidade, STARTING_GRID nem posições', async () => {
    const contextA = { careerId: 'career_qb12_A', seasonId: 'season_2026', round: 1 }
    const contextB = { careerId: 'career_qb12_B', seasonId: 'season_2026', round: 1 }

    await prepareQualifyingComplete(contextA)
    await prepareQualifyingComplete(contextB)

    // Carreira A aplica penalidade no piloto P1
    const qualiA = await raceQualifyingOrchestratorService.buildGlobalQualifyingResult(contextA)
    const p1A = qualiA.results[0].driverId

    const gridA = await raceQualifyingOrchestratorService.buildStartingGrid({
      ...contextA,
      penaltiesByDriverId: {
        [p1A]: [{ id: 'pen_A', unitIndex: 5, positions: 10, reason: 'PU5' }],
      },
    })

    // Carreira B roda sem penalidades
    const gridB = await raceQualifyingOrchestratorService.buildStartingGrid(contextB)

    // Carreira A teve P1 movido para trás
    const p1AEntry = gridA.grid.find((g) => g.driverId === p1A)!
    expect(p1AEntry.gridPosition).toBeGreaterThan(1)
    expect(p1AEntry.hasPenalty).toBe(true)

    // Carreira B não teve nenhuma penalidade
    expect(gridB.grid.every((g) => !g.hasPenalty)).toBe(true)
    expect(gridB.grid[0].gridPosition).toBe(1)
    expect(gridB.grid[0].qualifyingPosition).toBe(1)
  })

  // =========================================================================
  // QB13: RELOAD — Fluxo Direto vs Save/Reload Real
  // =========================================================================
  it('QB13: RELOAD — Fluxo A (direto em memória) vs Fluxo B (save/reload real descartando cache) produzem resultados idênticos', async () => {
    const context = {
      careerId: 'career_qb13',
      seasonId: 'season_2026',
      round: 1,
    }
    await prepareQualifyingComplete(context)
    const globalResult =
      await raceQualifyingOrchestratorService.buildGlobalQualifyingResult(context)

    const p4Driver = globalResult.results[3].driverId
    const penaltyParams = {
      ...context,
      penaltiesByDriverId: {
        [p4Driver]: [{ id: 'pen_p4', unitIndex: 5, positions: 5, reason: 'PU6 +5' }],
      },
    }

    // Fluxo A: direto
    const gridFlowA = await raceQualifyingOrchestratorService.buildStartingGrid(penaltyParams)

    // Fluxo B: descartar cache em memória simulando reload completo da página/app
    const cleanReloadedService = new RaceQualifyingOrchestratorService()
    const loadedGrid = await cleanReloadedService.loadPersistedStartingGrid(
      context.careerId,
      context.seasonId,
      context.round,
    )

    expect(loadedGrid).not.toBeNull()
    expect(loadedGrid?.status).toBe('GRID_READY')
    expect(loadedGrid?.grid).toHaveLength(24)

    // O grid recarregado deve ser estritamente idêntico ao do Fluxo A
    expect(
      loadedGrid?.grid.map((g) => ({
        pos: g.gridPosition,
        qPos: g.qualifyingPosition,
        id: g.driverId,
      })),
    ).toEqual(
      gridFlowA.grid.map((g) => ({
        pos: g.gridPosition,
        qPos: g.qualifyingPosition,
        id: g.driverId,
      })),
    )
  })

  // =========================================================================
  // QB14: IMUTABILIDADE DO QUALIFYING_RESULT
  // =========================================================================
  it('QB14: IMUTABILIDADE — gerar STARTING_GRID não altera Q1, Q2, Q3, QUALIFYING_RESULT nem qualifyingPosition', async () => {
    const context = {
      careerId: 'career_qb14',
      seasonId: 'season_2026',
      round: 1,
    }
    const { q1State, q2State, q3State } = await prepareQualifyingComplete(context)
    const globalBefore =
      await raceQualifyingOrchestratorService.buildGlobalQualifyingResult(context)

    // Foto imutável de Q1, Q2, Q3 e QUALIFYING_RESULT
    const q1Snapshot = JSON.stringify(q1State)
    const q2Snapshot = JSON.stringify(q2State)
    const q3Snapshot = JSON.stringify(q3State)
    const globalSnapshot = JSON.stringify(globalBefore)

    // Executa buildStartingGrid com penalidades severas
    const p2Driver = globalBefore.results[1].driverId
    const p3Driver = globalBefore.results[2].driverId

    await raceQualifyingOrchestratorService.buildStartingGrid({
      ...context,
      penaltiesByDriverId: {
        [p2Driver]: [{ id: 'pen_1', unitIndex: 5, positions: 10, reason: 'PU5' }],
        [p3Driver]: [{ id: 'pen_2', unitIndex: 6, positions: 5, reason: 'PU6' }],
      },
    })

    // Recarregar os artefatos das etapas anteriores
    const q1After = await raceQualifyingOrchestratorService.loadPersistedPhaseState(
      'Q1',
      context.careerId,
      context.seasonId,
      context.round,
    )
    const q2After = await raceQualifyingOrchestratorService.loadPersistedPhaseState(
      'Q2',
      context.careerId,
      context.seasonId,
      context.round,
    )
    const q3After = await raceQualifyingOrchestratorService.loadPersistedPhaseState(
      'Q3',
      context.careerId,
      context.seasonId,
      context.round,
    )
    const globalAfter = await raceQualifyingOrchestratorService.loadPersistedGlobalQualifyingResult(
      context.careerId,
      context.seasonId,
      context.round,
    )

    expect(JSON.stringify(q1After)).toBe(q1Snapshot)
    expect(JSON.stringify(q2After)).toBe(q2Snapshot)
    expect(JSON.stringify(q3After)).toBe(q3Snapshot)
    expect(JSON.stringify(globalAfter)).toBe(globalSnapshot)

    // Garantir que a ordem P1..P24 do QUALIFYING_RESULT permanece intacta
    expect(globalAfter?.results[1].position).toBe(2)
    expect(globalAfter?.results[1].driverId).toBe(p2Driver)
    expect(globalAfter?.results[2].position).toBe(3)
    expect(globalAfter?.results[2].driverId).toBe(p3Driver)
  })

  // =========================================================================
  // REGRESSÃO DO BUG DE GRID DUPLICADO & RECUPERAÇÃO DE FALHA PARCIAL
  // =========================================================================
  it('REGRESSÃO DO BUG DE GRID DUPLICADO: 24 pilotos == 24 carros/entradas, falha no domínio se duplicado', async () => {
    const context = {
      careerId: 'career_duplicate_regression',
      seasonId: 'season_2026',
      round: 1,
    }
    await prepareQualifyingComplete(context)
    const startingGrid = await raceQualifyingOrchestratorService.buildStartingGrid(context)

    const participantCount = 24
    const driverIds = new Set(startingGrid.grid.map((g) => g.driverId))
    const entryKeys = new Set(startingGrid.grid.map((g) => `${g.teamId}_${g.carIndex}`))

    expect(driverIds.size).toBe(participantCount)
    expect(entryKeys.size).toBe(participantCount)
    expect(startingGrid.grid.length).toBe(participantCount)

    // Prova de falha imediata no domínio se o resultado possuir duplicata:
    const corruptService = new RaceQualifyingOrchestratorService()
    const globalQuali = await raceQualifyingOrchestratorService.loadPersistedGlobalQualifyingResult(
      context.careerId,
      context.seasonId,
      context.round,
    )
    expect(globalQuali).not.toBeNull()

    // Injeta piloto duplicado forçado
    const corruptedResults = [
      ...globalQuali!.results.slice(0, 23),
      { ...globalQuali!.results[0], position: 24 },
    ]
    const corruptedQuali = { ...globalQuali!, results: corruptedResults }
    await corruptService.persistGlobalQualifyingResult(corruptedQuali as any)
    corruptService.clearMemoryCache()

    await expect(
      corruptService.buildStartingGrid({
        careerId: context.careerId,
        seasonId: context.seasonId,
        round: context.round,
      }),
    ).rejects.toThrow(/Regressão de pilotos duplicados detectada no STARTING_GRID/)
  })

  it('RECUPERAÇÃO DE FALHA PARCIAL: grid persistido mas status intermediário conclui GRID_READY sem recalcular', async () => {
    const context = {
      careerId: 'career_partial_failure',
      seasonId: 'season_2026',
      round: 1,
    }
    await prepareQualifyingComplete(context)
    const fullGrid = await raceQualifyingOrchestratorService.buildStartingGrid(context)

    // Simula estado persistido onde status ficou como STARTING_GRID_READY
    const partialState = {
      ...fullGrid,
      status: 'STARTING_GRID_READY' as const,
    }
    const partialService = new RaceQualifyingOrchestratorService()
    await partialService.persistStartingGrid(partialState)
    partialService.clearMemoryCache()

    // O retry deve completar transição para GRID_READY sem recalcular
    const recovered = await partialService.buildStartingGrid(context)
    expect(recovered.status).toBe('GRID_READY')
    expect(recovered.grid).toEqual(fullGrid.grid)
  })
})
