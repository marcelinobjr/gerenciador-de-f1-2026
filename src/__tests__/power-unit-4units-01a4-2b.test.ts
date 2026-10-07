/**
 * src/__tests__/power-unit-4units-01a4-2b.test.ts
 *
 * POWER-UNIT-4UNITS-01A4.2B-T — PROVA DO CONSUMER DE GRID PENALTIES POR PILOTO
 *
 * Suíte de testes determinística e canônica para verificar o comportamento do
 * consumidor esportivo real:
 *   raceQualifyingOrchestratorService.buildStartingGrid
 *
 * Cobertura T1–T13:
 * - T1: Driver A / PU5 (penalidade moderna aplicada exclusivamente ao piloto A, sem afetar companheiro B)
 * - T2: Driver B / PU5 (penalidade moderna aplicada exclusivamente ao piloto B, sem afetar companheiro A)
 * - T3: Duas PU5 na mesma equipe (coexistência e isolamento A/PU5 e B/PU5)
 * - T4: PU6+ (respeito à magnitude SUBSEQUENT_EXCESS_GRID_PENALTY persistida)
 * - T5: Múltiplas penalidades do mesmo piloto (somatório e precedência)
 * - T6: Recálculo não acumula (ordem derivada do QUALIFYING_RESULT imutável)
 * - T7: Reload / persistência resiliente (idempotência com novo serviço/storage)
 * - T8: Temporada diferente (penalidade de outra temporada não afeta temporada corrente)
 * - T9: Auditoria da semântica de temporada (seasonId recebido vs seasonYear persistido)
 * - T10: Falso positivo por substring no filtro de temporada
 * - T11: Round / Evento (comportamento atual do consumidor quanto ao campo round)
 * - T12: Legado (compatibilidade com penalidades sem driverId, usando carIndex ou fallback)
 * - T13: Bijeção do grid (P1..P24 estritos, sem buracos, sem duplicatas)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  RaceQualifyingOrchestratorService,
  raceQualifyingOrchestratorService,
  GlobalQualifyingResultState,
  GlobalQualifyingResultEntry,
  StartingGridState,
} from '@/services/raceQualifyingOrchestratorService'
import {
  FIRST_EXCESS_GRID_PENALTY,
  SUBSEQUENT_EXCESS_GRID_PENALTY,
} from '@/services/canonicalPowerUnitInventoryService'
import type { GridPenaltyApplied } from '@/services/raceQualifyingOrchestratorService'

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

// Gerador de fixture canônica de QUALIFYING_RESULT determinístico com 24 pilotos (12 equipes x 2 pilotos)
function createCanonicalQualifyingResult(params: {
  careerId: string
  seasonId: string
  round: number
}): GlobalQualifyingResultState {
  const { careerId, seasonId, round } = params

  const teams = [
    { teamId: 'mclaren', teamName: 'McLaren' },
    { teamId: 'ferrari', teamName: 'Ferrari' },
    { teamId: 'redbull', teamName: 'Red Bull Racing' },
    { teamId: 'mercedes', teamName: 'Mercedes' },
    { teamId: 'astonmartin', teamName: 'Aston Martin' },
    { teamId: 'alpine', teamName: 'Alpine' },
    { teamId: 'williams', teamName: 'Williams' },
    { teamId: 'racingbulls', teamName: 'Racing Bulls' },
    { teamId: 'sauber', teamName: 'Sauber' },
    { teamId: 'haas', teamName: 'Haas' },
    { teamId: 'andretti', teamName: 'Andretti' },
    { teamId: 'audi_sport', teamName: 'Audi F1 Team' },
  ]

  const entries: GlobalQualifyingResultEntry[] = []
  let position = 1

  teams.forEach((t) => {
    for (let c = 1; c <= 2; c++) {
      const carIndex = c as 1 | 2
      const driverId = `${t.teamId}_driver_${carIndex}`
      const driverName = `${t.teamName} Driver ${carIndex}`
      const phase: 'Q1' | 'Q2' | 'Q3' = position <= 10 ? 'Q3' : position <= 18 ? 'Q2' : 'Q1'

      entries.push({
        position,
        driverId,
        driverName,
        teamId: t.teamId,
        teamName: t.teamName,
        carIndex,
        eliminationPhase: phase,
        phaseBestTimeMs: 80000 + position * 100,
        formattedPhaseBestTime: `1:20.${(position * 100).toString().padStart(3, '0')}`,
        setup: 85,
        q1BestTimeMs: 80000 + position * 100,
        q2BestTimeMs: position <= 18 ? 80000 + position * 100 : undefined,
        q3BestTimeMs: position <= 10 ? 80000 + position * 100 : undefined,
      })
      position++
    }
  })

  return {
    careerId,
    seasonId,
    round,
    configVersion: 'v1',
    status: 'QUALIFYING_RESULT_READY',
    totalParticipants: 24,
    results: entries,
    poleDriverId: entries[0].driverId,
    poleDriverName: entries[0].driverName,
    poleTimeMs: entries[0].phaseBestTimeMs,
    formattedPoleTime: entries[0].formattedPhaseBestTime,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('POWER-UNIT-4UNITS-01A4.2B-T — PROVA DO CONSUMER DE GRID PENALTIES POR PILOTO', () => {
  let pbSessionSetupsStore: any[] = []
  let pbTeamsStore: any[] = []

  const careerId = 'career_pu_consumer_test'
  const seasonId = 'season_2026'
  const round = 5

  beforeEach(() => {
    mockStorage.clear()
    pbSessionSetupsStore = []
    pbTeamsStore = []
    raceQualifyingOrchestratorService.clearMemoryCache()

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

    // Mock do PB teams para getFullList
    vi.spyOn(pb.collection('teams'), 'getFullList').mockImplementation(async () => {
      return pbTeamsStore as any
    })
  })

  // Helper para persistir QUALIFYING_RESULT canônico antes de chamar buildStartingGrid
  async function seedQualifyingResult(cId = careerId, sId = seasonId, r = round) {
    const quali = createCanonicalQualifyingResult({ careerId: cId, seasonId: sId, round: r })
    await raceQualifyingOrchestratorService.persistGlobalQualifyingResult(quali)
    return quali
  }

  // =========================================================================
  // T1 — DRIVER A / PU5
  // =========================================================================
  it('T1: Driver A / PU5 — penalidade moderna atribuída exclusivamente a A, B não recebe penalidade', async () => {
    await seedQualifyingResult()

    const driverA = 'mclaren_driver_1'
    const driverB = 'mclaren_driver_2'

    // McLaren Driver 1 larga em P1, Driver 2 larga em P2
    // Driver A recebe penalidade moderna de PU5
    const penaltyA: any = {
      id: `pu_pen_mclaren_${driverA}_2026_u5`,
      unitIndex: 5,
      positions: FIRST_EXCESS_GRID_PENALTY, // 10 posições
      reason: `Excesso de cota anual de PU (#5 > 4)`,
      source: 'PU_QUOTA_REGULATION',
      driverId: driverA,
      seasonYear: 2026,
      round: 5,
    }

    // Configurar equipe com grid_penalties no PocketBase
    pbTeamsStore = [
      {
        id: 'mclaren',
        team_key: 'mclaren',
        user_id: careerId,
        grid_penalties: [penaltyA],
      },
    ]

    const startingGrid = await raceQualifyingOrchestratorService.buildStartingGrid({
      careerId,
      seasonId,
      round,
    })

    const entryA = startingGrid.grid.find((g) => g.driverId === driverA)!
    const entryB = startingGrid.grid.find((g) => g.driverId === driverB)!

    // A deve ter penalidade direta de 10 posições
    expect(entryA.hasPenalty).toBe(true)
    expect(entryA.totalPenaltyPositions).toBe(10)
    expect(entryA.penalties).toHaveLength(1)
    expect(entryA.penalties[0].positions).toBe(FIRST_EXCESS_GRID_PENALTY)
    expect(entryA.qualifyingPosition).toBe(1)
    expect(entryA.gridPosition).toBe(11) // P1 + 10 = P11

    // B NÃO deve ter penalidade direta
    expect(entryB.hasPenalty).toBe(false)
    expect(entryB.totalPenaltyPositions).toBe(0)
    expect(entryB.penalties).toHaveLength(0)
    expect(entryB.qualifyingPosition).toBe(2)
    // B ascende de P2 para P1 devido ao reordenamento natural
    expect(entryB.gridPosition).toBe(1)
  })

  // =========================================================================
  // T2 — DRIVER B / PU5
  // =========================================================================
  it('T2: Driver B / PU5 — penalidade moderna atribuída exclusivamente a B, A não recebe penalidade', async () => {
    await seedQualifyingResult()

    const driverA = 'mclaren_driver_1'
    const driverB = 'mclaren_driver_2'

    // Inverter cenário: penalidade agora pertence exclusivamente ao Piloto B
    const penaltyB: any = {
      id: `pu_pen_mclaren_${driverB}_2026_u5`,
      unitIndex: 5,
      positions: FIRST_EXCESS_GRID_PENALTY, // 10 posições
      reason: `Excesso de cota anual de PU (#5 > 4)`,
      source: 'PU_QUOTA_REGULATION',
      driverId: driverB,
      seasonYear: 2026,
      round: 5,
    }

    pbTeamsStore = [
      {
        id: 'mclaren',
        team_key: 'mclaren',
        user_id: careerId,
        grid_penalties: [penaltyB],
      },
    ]

    const startingGrid = await raceQualifyingOrchestratorService.buildStartingGrid({
      careerId,
      seasonId,
      round,
    })

    const entryA = startingGrid.grid.find((g) => g.driverId === driverA)!
    const entryB = startingGrid.grid.find((g) => g.driverId === driverB)!

    // B deve ter penalidade direta
    expect(entryB.hasPenalty).toBe(true)
    expect(entryB.totalPenaltyPositions).toBe(10)
    expect(entryB.penalties).toHaveLength(1)
    expect(entryB.penalties[0].positions).toBe(FIRST_EXCESS_GRID_PENALTY)
    expect(entryB.qualifyingPosition).toBe(2)
    expect(entryB.gridPosition).toBe(12) // P2 + 10 = P12

    // A permanece intacto sem penalidade direta na pole position
    expect(entryA.hasPenalty).toBe(false)
    expect(entryA.totalPenaltyPositions).toBe(0)
    expect(entryA.penalties).toHaveLength(0)
    expect(entryA.qualifyingPosition).toBe(1)
    expect(entryA.gridPosition).toBe(1)
  })

  // =========================================================================
  // T3 — DUAS PU5 NA MESMA EQUIPE
  // =========================================================================
  it('T3: DUAS PU5 NA MESMA EQUIPE — coexistem simultaneamente, cada penalidade casa apenas com seu piloto sem colisão ou dedup errada', async () => {
    await seedQualifyingResult()

    const driverA = 'ferrari_driver_1' // P3 na qualificação canônica
    const driverB = 'ferrari_driver_2' // P4 na qualificação canônica

    const penaltyA: any = {
      id: `pu_pen_ferrari_${driverA}_2026_u5`,
      unitIndex: 5,
      positions: 10,
      reason: `Excesso de cota Ferrari Driver 1 (#5)`,
      source: 'PU_QUOTA_REGULATION',
      driverId: driverA,
      seasonYear: 2026,
      round: 5,
    }

    const penaltyB: any = {
      id: `pu_pen_ferrari_${driverB}_2026_u5`,
      unitIndex: 5,
      positions: 10,
      reason: `Excesso de cota Ferrari Driver 2 (#5)`,
      source: 'PU_QUOTA_REGULATION',
      driverId: driverB,
      seasonYear: 2026,
      round: 5,
    }

    pbTeamsStore = [
      {
        id: 'ferrari',
        team_key: 'ferrari',
        user_id: careerId,
        grid_penalties: [penaltyA, penaltyB],
      },
    ]

    const startingGrid = await raceQualifyingOrchestratorService.buildStartingGrid({
      careerId,
      seasonId,
      round,
    })

    const entryA = startingGrid.grid.find((g) => g.driverId === driverA)!
    const entryB = startingGrid.grid.find((g) => g.driverId === driverB)!

    // Ambas as penalidades foram aplicadas aos seus respectivos pilotos
    expect(entryA.hasPenalty).toBe(true)
    expect(entryA.totalPenaltyPositions).toBe(10)
    expect(entryA.penalties).toHaveLength(1)
    expect(entryA.penalties[0].id).toBe(penaltyA.id)
    expect(entryA.qualifyingPosition).toBe(3)
    expect(entryA.gridPosition).toBe(13) // P3 + 10 = P13

    expect(entryB.hasPenalty).toBe(true)
    expect(entryB.totalPenaltyPositions).toBe(10)
    expect(entryB.penalties).toHaveLength(1)
    expect(entryB.penalties[0].id).toBe(penaltyB.id)
    expect(entryB.qualifyingPosition).toBe(4)
    expect(entryB.gridPosition).toBe(14) // P4 + 10 = P14
  })

  // =========================================================================
  // T4 — PU6+
  // =========================================================================
  it('T4: PU6+ — consumer usa exatamente o valor persistido (SUBSEQUENT_EXCESS_GRID_PENALTY)', async () => {
    await seedQualifyingResult()

    const driverA = 'redbull_driver_1' // P5 na qualificação

    const penaltyPU6: any = {
      id: `pu_pen_redbull_${driverA}_2026_u6`,
      unitIndex: 6,
      positions: SUBSEQUENT_EXCESS_GRID_PENALTY, // 5 posições
      reason: 'Excesso PU6 +5 posições',
      source: 'PU_QUOTA_REGULATION',
      driverId: driverA,
      seasonYear: 2026,
      round: 5,
    }

    pbTeamsStore = [
      {
        id: 'redbull',
        team_key: 'redbull',
        user_id: careerId,
        grid_penalties: [penaltyPU6],
      },
    ]

    const startingGrid = await raceQualifyingOrchestratorService.buildStartingGrid({
      careerId,
      seasonId,
      round,
    })

    const entryA = startingGrid.grid.find((g) => g.driverId === driverA)!
    expect(entryA.hasPenalty).toBe(true)
    expect(entryA.totalPenaltyPositions).toBe(SUBSEQUENT_EXCESS_GRID_PENALTY)
    expect(entryA.penalties[0].positions).toBe(5)
    expect(entryA.qualifyingPosition).toBe(5)
    expect(entryA.gridPosition).toBe(10) // P5 + 5 = P10
  })

  // =========================================================================
  // T5 — MÚLTIPLAS PENALIDADES DO MESMO PILOTO
  // =========================================================================
  it('T5: MÚLTIPLAS PENALIDADES DO MESMO PILOTO — consumer soma conforme comportamento existente', async () => {
    await seedQualifyingResult()

    const driverA = 'mercedes_driver_1' // P7 na qualificação

    // Duas penalidades aplicadas ao mesmo piloto (ex: PU5 de 10 posições + penalidade desportiva/FIA de 3 posições)
    const penalty1: any = {
      id: `pu_pen_merc_${driverA}_u5`,
      unitIndex: 5,
      positions: 10,
      reason: 'PU5 +10 posições',
      source: 'PU_QUOTA_REGULATION',
      driverId: driverA,
      seasonYear: 2026,
      round: 5,
    }

    const penalty2: any = {
      id: `sporting_pen_merc_${driverA}_r5`,
      positions: 3,
      reason: 'Infração de pit lane +3 posições',
      source: 'FIA_STEWARDS',
      driverId: driverA,
      seasonYear: 2026,
      round: 5,
    }

    pbTeamsStore = [
      {
        id: 'mercedes',
        team_key: 'mercedes',
        user_id: careerId,
        grid_penalties: [penalty1, penalty2],
      },
    ]

    const startingGrid = await raceQualifyingOrchestratorService.buildStartingGrid({
      careerId,
      seasonId,
      round,
    })

    const entryA = startingGrid.grid.find((g) => g.driverId === driverA)!
    expect(entryA.hasPenalty).toBe(true)
    // Consumer soma Math.max(0, p.positions): 10 + 3 = 13
    expect(entryA.totalPenaltyPositions).toBe(13)
    expect(entryA.penalties).toHaveLength(2)
    expect(entryA.qualifyingPosition).toBe(7)
    expect(entryA.gridPosition).toBe(20) // P7 + 13 = P20
  })

  // =========================================================================
  // T6 — RECÁLCULO NÃO ACUMULA
  // =========================================================================
  it('T6: RECÁLCULO NÃO ACUMULA — reexecutar buildStartingGrid não produz efeito acumulativo (P4 -> P14, não P24)', async () => {
    await seedQualifyingResult()

    const driverA = 'astonmartin_driver_1' // P9

    const penaltyA: any = {
      id: `pu_pen_am_${driverA}_u5`,
      unitIndex: 5,
      positions: 10,
      reason: 'PU5 +10',
      source: 'PU_QUOTA_REGULATION',
      driverId: driverA,
      seasonYear: 2026,
      round: 5,
    }

    pbTeamsStore = [
      {
        id: 'astonmartin',
        team_key: 'astonmartin',
        user_id: careerId,
        grid_penalties: [penaltyA],
      },
    ]

    // 1ª execução
    const grid1 = await raceQualifyingOrchestratorService.buildStartingGrid({
      careerId,
      seasonId,
      round,
    })
    const entry1 = grid1.grid.find((g) => g.driverId === driverA)!
    expect(entry1.qualifyingPosition).toBe(9)
    expect(entry1.gridPosition).toBe(19) // P9 + 10 = P19

    // 2ª execução (mesma instância)
    const grid2 = await raceQualifyingOrchestratorService.buildStartingGrid({
      careerId,
      seasonId,
      round,
    })
    const entry2 = grid2.grid.find((g) => g.driverId === driverA)!
    expect(entry2.qualifyingPosition).toBe(9)
    expect(entry2.gridPosition).toBe(19) // Permanece 19, não acumula para 29 ou 24

    // 3ª execução limpando cache em memória para forçar releitura do armazenamento
    raceQualifyingOrchestratorService.clearMemoryCache()
    const grid3 = await raceQualifyingOrchestratorService.buildStartingGrid({
      careerId,
      seasonId,
      round,
    })
    const entry3 = grid3.grid.find((g) => g.driverId === driverA)!
    expect(entry3.qualifyingPosition).toBe(9)
    expect(entry3.gridPosition).toBe(19)
  })

  // =========================================================================
  // T7 — RELOAD
  // =========================================================================
  it('T7: RELOAD — persistir penalidade moderna, construir/persistir STARTING_GRID e recarregar em nova instância preserva dados exatos', async () => {
    await seedQualifyingResult()

    const driverA = 'alpine_driver_1' // P11
    const driverB = 'alpine_driver_2' // P12

    const penaltyA: any = {
      id: `pu_pen_alp_${driverA}_u5`,
      unitIndex: 5,
      positions: 10,
      reason: 'PU5 +10 posições',
      source: 'PU_QUOTA_REGULATION',
      driverId: driverA,
      seasonYear: 2026,
      round: 5,
    }

    pbTeamsStore = [
      {
        id: 'alpine',
        team_key: 'alpine',
        user_id: careerId,
        grid_penalties: [penaltyA],
      },
    ]

    const initialGrid = await raceQualifyingOrchestratorService.buildStartingGrid({
      careerId,
      seasonId,
      round,
    })

    // Simula reload criando nova instância e lendo do storage persistido
    const freshService = new RaceQualifyingOrchestratorService()
    const loadedGrid = await freshService.loadPersistedStartingGrid(careerId, seasonId, round)

    expect(loadedGrid).not.toBeNull()
    expect(loadedGrid?.status).toBe('GRID_READY')
    expect(loadedGrid?.grid).toHaveLength(24)

    const reloadedA = loadedGrid!.grid.find((g) => g.driverId === driverA)!
    const reloadedB = loadedGrid!.grid.find((g) => g.driverId === driverB)!

    expect(reloadedA.hasPenalty).toBe(true)
    expect(reloadedA.totalPenaltyPositions).toBe(10)
    expect(reloadedA.gridPosition).toBe(21) // P11 + 10 = P21
    expect(reloadedA.qualifyingPosition).toBe(11)

    expect(reloadedB.hasPenalty).toBe(false)
    expect(reloadedB.totalPenaltyPositions).toBe(0)
    expect(reloadedB.gridPosition).toBe(11) // B subiu de P12 para P11
    expect(reloadedB.qualifyingPosition).toBe(12)

    // O grid recarregado deve ser estritamente idêntico ao original
    expect(loadedGrid!.grid).toEqual(initialGrid.grid)
  })

  // =========================================================================
  // T8 — TEMPORADA DIFERENTE
  // =========================================================================
  it('T8: TEMPORADA DIFERENTE — penalidade pertencente a outra temporada não afeta o grid da temporada atual', async () => {
    // Cenário: temporada atual = 'season_2026'
    await seedQualifyingResult()

    const driverA = 'williams_driver_1' // P13

    // Penalidade pertence à temporada de 2025
    const penalty2025: any = {
      id: `pu_pen_wms_${driverA}_2025_u5`,
      unitIndex: 5,
      positions: 10,
      reason: 'PU5 2025',
      source: 'PU_QUOTA_REGULATION',
      driverId: driverA,
      seasonYear: 2025,
      round: 5,
    }

    pbTeamsStore = [
      {
        id: 'williams',
        team_key: 'williams',
        user_id: careerId,
        grid_penalties: [penalty2025],
      },
    ]

    const startingGrid = await raceQualifyingOrchestratorService.buildStartingGrid({
      careerId,
      seasonId, // 'season_2026'
      round,
    })

    const entryA = startingGrid.grid.find((g) => g.driverId === driverA)!

    // Como 2025 != 'season_2026' e nenhum inclui o outro, a penalidade NÃO é aplicada
    expect(entryA.hasPenalty).toBe(false)
    expect(entryA.totalPenaltyPositions).toBe(0)
    expect(entryA.penalties).toHaveLength(0)
    expect(entryA.gridPosition).toBe(13)
    expect(entryA.qualifyingPosition).toBe(13)
  })

  // =========================================================================
  // T9 — AUDITORIA DA SEMÂNTICA DE TEMPORADA
  // =========================================================================
  it('T9: AUDITORIA DA SEMÂNTICA DE TEMPORADA — diagnóstico dos valores reais de seasonId e seasonYear', async () => {
    await seedQualifyingResult()

    // O orquestrador recebe buildStartingGridParams.seasonId:
    // No contexto canônico de testes e telas: 'season_2026', 's_2026' ou ID do PocketBase de 15 caracteres (ex: 'rec_season_001').
    // O modelo de penalidade moderna persiste: seasonYear: 2026 (número)
    const observedSeasonId = seasonId // 'season_2026'
    const penaltySeasonYearNum = 2026
    const penaltySeasonYearStr = String(penaltySeasonYearNum) // '2026'

    // O filtro real no orquestrador (linhas 2362–2371) executa:
    // const penaltySeasonStr = String(penaltySeason)
    // const currentSeasonStr = String(seasonId)
    // if (penaltySeasonStr !== currentSeasonStr && !currentSeasonStr.includes(penaltySeasonStr) && !penaltySeasonStr.includes(currentSeasonStr))
    const filterMatches =
      penaltySeasonYearStr === observedSeasonId ||
      observedSeasonId.includes(penaltySeasonYearStr) ||
      penaltySeasonYearStr.includes(observedSeasonId)

    expect(filterMatches).toBe(true) // 'season_2026'.includes('2026') é verdadeiro!

    // Agora auditando caso seasonId seja um ID de registro PocketBase arbitrário (ex: 'season_rec_abc123'):
    const pbRecordSeasonId = 'season_rec_abc123'
    const filterWithPbId =
      penaltySeasonYearStr === pbRecordSeasonId ||
      pbRecordSeasonId.includes(penaltySeasonYearStr) ||
      penaltySeasonYearStr.includes(pbRecordSeasonId)

    // DIAGNÓSTICO: Se o seasonId for um PB ID alfanumérico que não contém o ano numérico,
    // o filtro .includes() rejeitaria a penalidade.
    expect(filterWithPbId).toBe(false)

    // Se o penalty possuir seasonId explicitamente casando com o PB record ID:
    const modernPenaltyWithBoth: any = {
      id: 'audit_pen_1',
      unitIndex: 5,
      positions: 10,
      seasonYear: 2026,
      seasonId: pbRecordSeasonId,
      driverId: 'racingbulls_driver_1',
    }
    // O orquestrador usa: penaltySeason = tp.seasonYear || tp.season || tp.seasonId
    // Nota: Como seasonYear vem primeiro, penaltySeason avalia para 2026!
    const effectivePenaltySeason =
      modernPenaltyWithBoth.seasonYear ||
      modernPenaltyWithBoth.season ||
      modernPenaltyWithBoth.seasonId

    expect(effectivePenaltySeason).toBe(2026)
  })

  // =========================================================================
  // T10 — FALSO POSITIVO POR SUBSTRING
  // =========================================================================
  it('T10: FALSO POSITIVO POR SUBSTRING — verificação da comparação por includes', async () => {
    // Cenário onde seasonId possui ano que contém substring de outro ano ou coincidência textual
    // Ex: seasonId = 'season_2026', penaltySeason = '20' ou '26'
    await seedQualifyingResult()

    const driverA = 'racingbulls_driver_1' // P15

    // Penalidade malformada com seasonYear = 20 ou 26 (apenas 2 dígitos)
    const penaltyPartial: any = {
      id: `pu_pen_rb_${driverA}_partial`,
      unitIndex: 5,
      positions: 10,
      reason: 'PU5 com ano de 2 dígitos',
      source: 'PU_QUOTA_REGULATION',
      driverId: driverA,
      seasonYear: 26, // 'season_2026'.includes('26') === true!
      round: 5,
    }

    pbTeamsStore = [
      {
        id: 'racingbulls',
        team_key: 'racingbulls',
        user_id: careerId,
        grid_penalties: [penaltyPartial],
      },
    ]

    const startingGrid = await raceQualifyingOrchestratorService.buildStartingGrid({
      careerId,
      seasonId, // 'season_2026'
      round,
    })

    const entryA = startingGrid.grid.find((g) => g.driverId === driverA)!

    // Pelo código atual: 'season_2026'.includes('26') retorna true e aceita a penalidade
    expect(entryA.hasPenalty).toBe(true)
    expect(entryA.totalPenaltyPositions).toBe(10)
  })

  // =========================================================================
  // T11 — ROUND / EVENTO
  // =========================================================================
  it('T11: ROUND / EVENTO — comprova que o consumer atualmente NÃO filtra por rodada (penalidade da R1 persiste na R5 se não limpa)', async () => {
    await seedQualifyingResult()

    const driverA = 'sauber_driver_1' // P17

    // Penalidade criada na rodada 1 (round = 1)
    const penaltyRound1: any = {
      id: `pu_pen_sauber_${driverA}_u5_r1`,
      unitIndex: 5,
      positions: 10,
      reason: 'PU5 introduzida na Rodada 1',
      source: 'PU_QUOTA_REGULATION',
      driverId: driverA,
      seasonYear: 2026,
      round: 1, // Rodada 1
    }

    pbTeamsStore = [
      {
        id: 'sauber',
        team_key: 'sauber',
        user_id: careerId,
        grid_penalties: [penaltyRound1],
      },
    ]

    // Executar buildStartingGrid para a rodada 5 (round = 5)
    const startingGridR5 = await raceQualifyingOrchestratorService.buildStartingGrid({
      careerId,
      seasonId,
      round: 5,
    })

    const entryA = startingGridR5.grid.find((g) => g.driverId === driverA)!

    // FATO OBSERVADO: O consumidor em src/services/raceQualifyingOrchestratorService.ts (linhas 2355–2396)
    // NÃO possui verificação do campo `tp.round`.
    // Portanto, enquanto a penalidade permanecer na lista `team.grid_penalties`, ela é aplicada no grid da R5!
    expect(entryA.hasPenalty).toBe(true)
    expect(entryA.totalPenaltyPositions).toBe(10)
    // Registro explícito da dívida arquitetural
  })

  // =========================================================================
  // T12 — LEGADO
  // =========================================================================
  it('T12: LEGADO — penalidade sem driverId usa carIndex se disponível, ou aplica a ambos se nenhum discriminador existir', async () => {
    await seedQualifyingResult()

    const driverCar1 = 'haas_driver_1' // P19
    const driverCar2 = 'haas_driver_2' // P20

    // Caso 1: Penalidade legada com carIndex: 1
    const legacyPenaltyWithCar: any = {
      id: 'leg_pen_haas_c1',
      unitIndex: 5,
      positions: 10,
      reason: 'Penalidade legada Carro 1',
      source: 'PU_QUOTA_REGULATION',
      carIndex: 1, // Sem driverId
      seasonYear: 2026,
    }

    pbTeamsStore = [
      {
        id: 'haas',
        team_key: 'haas',
        user_id: careerId,
        grid_penalties: [legacyPenaltyWithCar],
      },
    ]

    const gridCar1 = await raceQualifyingOrchestratorService.buildStartingGrid({
      careerId,
      seasonId,
      round,
    })

    const entryCar1 = gridCar1.grid.find((g) => g.driverId === driverCar1)!
    const entryCar2 = gridCar1.grid.find((g) => g.driverId === driverCar2)!

    // Carro 1 recebe a penalidade; Carro 2 não
    expect(entryCar1.hasPenalty).toBe(true)
    expect(entryCar1.totalPenaltyPositions).toBe(10)
    expect(entryCar2.hasPenalty).toBe(false)
    expect(entryCar2.totalPenaltyPositions).toBe(0)

    // Caso 2: Penalidade legada sem driverId e sem carIndex (fallback amplo)
    raceQualifyingOrchestratorService.clearMemoryCache()
    pbSessionSetupsStore = [] // Limpar grid persistido para recalcular

    const legacyPenaltyGlobal: any = {
      id: 'leg_pen_haas_global',
      unitIndex: 5,
      positions: 10,
      reason: 'Penalidade legada global da equipe',
      source: 'PU_QUOTA_REGULATION',
      seasonYear: 2026,
    }

    pbTeamsStore = [
      {
        id: 'haas',
        team_key: 'haas',
        user_id: careerId,
        grid_penalties: [legacyPenaltyGlobal],
      },
    ]

    const gridGlobal = await raceQualifyingOrchestratorService.buildStartingGrid({
      careerId,
      seasonId,
      round,
    })

    const entryGlob1 = gridGlobal.grid.find((g) => g.driverId === driverCar1)!
    const entryGlob2 = gridGlobal.grid.find((g) => g.driverId === driverCar2)!

    // Sem discriminador, o fallback legado aplica a ambos os carros da equipe
    expect(entryGlob1.hasPenalty).toBe(true)
    expect(entryGlob2.hasPenalty).toBe(true)
  })

  // =========================================================================
  // T13 — BIJEÇÃO DO GRID
  // =========================================================================
  it('T13: BIJEÇÃO DO GRID — confirma grid contínuo P1..P24, sem buracos, sem duplicatas, todos os 24 participantes presentes', async () => {
    const quali = await seedQualifyingResult()

    // Aplicar múltiplas penalidades simultâneas em várias equipes e pilotos
    const pen1: any = {
      id: 'pen_bij_1',
      positions: 10,
      driverId: 'mclaren_driver_1', // P1 -> P11
      seasonYear: 2026,
    }
    const pen2: any = {
      id: 'pen_bij_2',
      positions: 5,
      driverId: 'ferrari_driver_1', // P3 -> P8
      seasonYear: 2026,
    }
    const pen3: any = {
      id: 'pen_bij_3',
      positions: 10,
      driverId: 'andretti_driver_1', // P21 -> P24+ (vai para P24)
      seasonYear: 2026,
    }

    pbTeamsStore = [
      { id: 'mclaren', team_key: 'mclaren', user_id: careerId, grid_penalties: [pen1] },
      { id: 'ferrari', team_key: 'ferrari', user_id: careerId, grid_penalties: [pen2] },
      { id: 'andretti', team_key: 'andretti', user_id: careerId, grid_penalties: [pen3] },
    ]

    const startingGrid = await raceQualifyingOrchestratorService.buildStartingGrid({
      careerId,
      seasonId,
      round,
    })

    // 1. Total de participantes = 24
    expect(startingGrid.grid).toHaveLength(24)
    expect(startingGrid.totalParticipants).toBe(24)

    // 2. Todas as posições P1..P24 contínuas e únicas
    const positions = startingGrid.grid.map((g) => g.gridPosition).sort((a, b) => a - b)
    expect(positions).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))
    expect(new Set(positions).size).toBe(24)

    // 3. Unicidade de pilotos (exatamente os 24 pilotos da qualificação)
    const gridDriverIds = startingGrid.grid.map((g) => g.driverId)
    expect(new Set(gridDriverIds).size).toBe(24)
    const originalDriverIds = new Set(quali.results.map((r) => r.driverId))
    expect(new Set(gridDriverIds)).toEqual(originalDriverIds)

    // 4. Pole position definida
    expect(startingGrid.poleDriverId).toBe(startingGrid.grid[0].driverId)
    expect(startingGrid.poleDriverName).toBe(startingGrid.grid[0].driverName)

    // 5. qualifyingPosition imutável
    for (const g of startingGrid.grid) {
      const orig = quali.results.find((r) => r.driverId === g.driverId)!
      expect(g.qualifyingPosition).toBe(orig.position)
    }
  })
})
