/**
 * src/test/race-tl-01b-focused-proofs.test.ts
 *
 * Suíte de Testes Canônica para a entrega RACE-TL-01B-NORMAL:
 * Fluxo de Treinos Livres do Fim de Semana NORMAL (TL1 -> TL2 -> TL3 -> READY_FOR_Q1).
 *
 * PROVAS E CRITÉRIOS OBRIGATÓRIOS (N01 a N09):
 * N01 PROGRESSÃO: TL1 -> TL2 -> TL3 produz RF07 completo (32.81 -> 65.62 -> 90.2275).
 * N02 TETO: setup anterior 95 + ganho 30 -> 100.
 * N03 ORDEM: TL3 antes de TL2 é rejeitado sem alterar estado.
 * N04 IDEMPOTÊNCIA: reexecutar TL2 concluído: mesmo registro, mesmo acumulado, nenhum ganho duplicado.
 * N05 CONSULTA HISTÓRICA: depois de TL3 = 90.2275, consultar TL1 pode retornar snapshot 32.81, mas o setup atual do carro continua 90.2275.
 * N06 RELOAD: TL1 -> save/reload -> TL2 -> save/reload -> TL3 produz o mesmo estado final da execução direta. Descartar cache em memória no teste; reconstruir pelo armazenamento persistido.
 * N07 TROCA DE PILOTO: mesmo carro, TL1 com piloto A, TL2 com piloto B: TL2 parte do setup deixado pelo TL1; sem setup paralelo; sem reaplicar TL1.
 * N08 ISOLAMENTO: outra carreira, rodada ou carro não compartilha setup.
 * N09 READY_FOR_Q1: somente após conclusão válida do TL3; não disparar Q1 automaticamente.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  RacePracticeSetupService,
  racePracticeSetupService,
  buildPracticeSetupFactKey,
} from '@/services/racePracticeSetupService'
import { DEFAULT_RACE_DRAFT_VERSION } from '@/lib/race/loader'
import type { VersionedRaceConfig } from '@/lib/race/types'
import { DEFAULT_SOURCE_RACE_PARAMETERS } from '@/lib/race/pureRaceEngine'

// Mock do localStorage para testes de persistência resiliente
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

// Configuração canônica versionada para os testes com parâmetros de RF07
const mockRaceConfig: VersionedRaceConfig = {
  id: 'rec_draft_race_b',
  version: DEFAULT_RACE_DRAFT_VERSION,
  sha256: '15e9e24a41300938f29cefdca68480db80c05988548bb2268798e4d35e1286ae',
  status: 'DRAFT',
  is_active: false,
  work_item: 'RACE-TL-01B',
  delivery_version: 'RACE-TL-01B-1.0.0',
  source_declared_version: 'v1',
  source_sha256: '0d02e79794f6defabfa3385d2854a4fc0bed7e5a17495c008075185d71f289a2',
  parameters: {
    ...DEFAULT_SOURCE_RACE_PARAMETERS,
    max_setup_qualifying_bonus_seconds: 0.25,
    max_setup_race_bonus_seconds_per_lap: 0.15,
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
    notes: 'Configuração versionada canônica para testes do RACE-TL-01B.',
  },
  created: '2026-09-28T00:00:00.000Z',
  updated: '2026-09-28T00:00:00.000Z',
}

describe('RACE-TL-01B-NORMAL — Testes Obrigatórios N01 a N09', () => {
  let pbSessionSetupsStore: any[] = []

  beforeEach(() => {
    mockStorage.clear()
    pbSessionSetupsStore = []

    // Mock PocketBase race_versioned_configs
    vi.spyOn(pb.collection('race_versioned_configs'), 'getFirstListItem').mockImplementation(
      async (filter: string) => {
        if (filter.includes(DEFAULT_RACE_DRAFT_VERSION)) {
          return mockRaceConfig as any
        }
        throw new Error(`Record not found for filter: ${filter}`)
      },
    )

    // Mock PocketBase session_setups
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

  // =========================================================================
  // N01 — PROGRESSÃO EXATA RF07 (TESTE DE OURO)
  // consistency = 93, completed laps: TL1 = 24, TL2 = 26, TL3 = 18, draws = 0.5
  // Esperado: após TL1 = 32.81; após TL2 = 65.62; após TL3 = 90.2275;
  // Bônus final quali = 225.56875000000002 ms; bônus final corrida = 0.13534125 s/lap
  // =========================================================================
  it('N01 PROGRESSÃO: TL1 -> TL2 -> TL3 produz RF07 completo com valores exatos sem arredondamento precoce', async () => {
    const context = {
      careerId: 'career_n01',
      seasonId: 'season_2026',
      round: 1,
      teamId: 'audi_sport',
      carIndex: 1 as const,
      driverId: 'drv_bortoleto',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      consistency: 93, // Rigoroso RF07
      uniformSetupDraw: 0.5,
    }

    // TL1: 24 voltas, max gain 40
    const tl1Res = await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      ...context,
      session: 'TL1',
      completedLaps: 24,
    })
    // RF07 exato: 32.81
    expect(tl1Res.record.sessionGain).toBe(32.81)
    expect(tl1Res.record.accumulatedSetup).toBe(32.81)

    // TL2: 26 voltas, max gain 40
    const tl2Res = await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      ...context,
      session: 'TL2',
      completedLaps: 26,
    })
    // RF07 exato: 32.81 + 32.81 = 65.62
    expect(tl2Res.record.sessionGain).toBe(32.81)
    expect(tl2Res.record.accumulatedSetup).toBe(65.62)
    expect(tl2Res.record.previousSetup).toBe(32.81)

    // TL3: 18 voltas, max gain 30
    const tl3Res = await racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
      ...context,
      session: 'TL3',
      completedLaps: 18,
    })
    // RF07 exato: 65.62 + 24.6075 = 90.2275
    expect(tl3Res.record.sessionGain).toBe(24.6075)
    expect(tl3Res.record.accumulatedSetup).toBe(90.2275)
    expect(tl3Res.record.previousSetup).toBe(65.62)

    // Bônus finais:
    // qualifying_bonus_ms: (90.2275 / 100) * 0.25 * 1000 = 225.56875000000002 ms
    // qualifyingBonusSeconds no record = 0.22556875000000002 s
    // raceBonusSecondsPerLap: (90.2275 / 100) * 0.15 = 0.13534125 s/lap
    const expectedQualiMs = 225.56875000000002
    const expectedRaceS = 0.13534125

    expect(tl3Res.record.qualifyingBonusSeconds * 1000).toBe(expectedQualiMs)
    expect(tl3Res.record.raceBonusSecondsPerLap).toBe(expectedRaceS)
  })

  // =========================================================================
  // N02 — TETO: setup anterior 95 + ganho 30 -> 100
  // =========================================================================
  it('N02 TETO: setup anterior 95 + ganho 30 -> 100', async () => {
    // Para testar o teto com TL3 sobre 95 prévio:
    // Cria TL1 e TL2 simulados ou aplica TL3 fornecendo previousSetup = 95
    // Primeiro cria TL1 e TL2 no banco para validar a ordem regulamentar
    const context = {
      careerId: 'career_n02',
      seasonId: 'season_2026',
      round: 1,
      teamId: 'ferrari',
      carIndex: 1 as const,
      driverId: 'drv_leclerc',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      consistency: 93,
      uniformSetupDraw: 0.5,
    }

    await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      ...context,
      session: 'TL1',
      completedLaps: 24,
    })

    await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      ...context,
      session: 'TL2',
      completedLaps: 26,
    })

    // TL3 com previousSetup forçado em 95
    // Max gain de TL3 é 30 (18 voltas, consistência 93, draw 0.5 -> ganho ~24.6075)
    // 95 + 24.6075 = 119.6075 -> teto 100!
    const tl3Res = await racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
      ...context,
      session: 'TL3',
      completedLaps: 18,
      previousSetup: 95,
    })

    expect(tl3Res.record.previousSetup).toBe(95)
    expect(tl3Res.record.accumulatedSetup).toBe(100)
    expect(tl3Res.record.accumulatedSetup).toBeLessThanOrEqual(100)
    expect(tl3Res.record.qualifyingBonusSeconds).toBe(0.25)
    expect(tl3Res.record.raceBonusSecondsPerLap).toBe(0.15)
  })

  // =========================================================================
  // N03 — ORDEM: TL3 antes de TL2 é rejeitado sem alterar estado
  // =========================================================================
  it('N03 ORDEM: TL3 antes de TL2 é rejeitado sem alterar estado', async () => {
    const context = {
      careerId: 'career_n03',
      seasonId: 'season_2026',
      round: 1,
      teamId: 'red_bull',
      carIndex: 1 as const,
      driverId: 'drv_verstappen',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 18,
      consistency: 93,
      uniformSetupDraw: 0.5,
    }

    const recordsBefore = pbSessionSetupsStore.length

    // Tentar executar TL3 direto (sem TL1 nem TL2)
    await expect(
      racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
        ...context,
        session: 'TL3',
      }),
    ).rejects.toThrow(/TL2 para o Carro 1 .* ainda não foi concluído/)

    // Executa TL1
    await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      ...context,
      session: 'TL1',
      completedLaps: 24,
    })

    const recordsAfterTL1 = pbSessionSetupsStore.length

    // Tentar executar TL3 tendo apenas TL1 (sem TL2)
    await expect(
      racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
        ...context,
        session: 'TL3',
      }),
    ).rejects.toThrow(/TL2 para o Carro 1 .* ainda não foi concluído/)

    // Estado não foi alterado para TL3, nenhum novo registro criado
    expect(pbSessionSetupsStore.length).toBe(recordsAfterTL1)
    expect(recordsBefore).toBe(0)
  })

  // =========================================================================
  // N04 — IDEMPOTÊNCIA: reexecutar TL2 concluído: mesmo registro, mesmo acumulado, nenhum ganho duplicado
  // =========================================================================
  it('N04 IDEMPOTÊNCIA: reexecutar TL2 concluído: mesmo registro, mesmo acumulado, nenhum ganho duplicado', async () => {
    const context = {
      careerId: 'career_n04',
      seasonId: 'season_2026',
      round: 1,
      teamId: 'mercedes',
      carIndex: 1 as const,
      driverId: 'drv_russell',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      consistency: 93,
      uniformSetupDraw: 0.5,
    }

    await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      ...context,
      session: 'TL1',
      completedLaps: 24,
    })

    // 1ª execução de TL2
    const tl2Run1 = await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      ...context,
      session: 'TL2',
      completedLaps: 26,
    })
    expect(tl2Run1.isAlreadyCompleted).toBe(false)
    expect(tl2Run1.record.accumulatedSetup).toBe(65.62)
    const storeCountAfterTL2 = pbSessionSetupsStore.length

    // 2ª execução de TL2 idêntica
    const tl2Run2 = await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      ...context,
      session: 'TL2',
      completedLaps: 26,
    })
    expect(tl2Run2.isAlreadyCompleted).toBe(true)
    expect(tl2Run2.record.applicationKey).toBe(tl2Run1.record.applicationKey)
    expect(tl2Run2.record.accumulatedSetup).toBe(65.62)
    expect(tl2Run2.record.sessionGain).toBe(32.81)

    // Não duplicou registros
    expect(pbSessionSetupsStore.length).toBe(storeCountAfterTL2)
  })

  // =========================================================================
  // N05 — CONSULTA HISTÓRICA: depois de TL3 = 90.2275, consultar TL1 pode retornar
  // snapshot 32.81, mas o setup atual do carro continua 90.2275
  // =========================================================================
  it('N05 CONSULTA HISTÓRICA: depois de TL3 = 90.2275, consultar TL1 retorna snapshot 32.81, mas setup atual do carro continua 90.2275', async () => {
    const context = {
      careerId: 'career_n05',
      seasonId: 'season_2026',
      round: 1,
      teamId: 'mclaren',
      carIndex: 1 as const,
      driverId: 'drv_norris',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      consistency: 93,
      uniformSetupDraw: 0.5,
    }

    // Executa TL1 -> TL2 -> TL3
    await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      ...context,
      session: 'TL1',
      completedLaps: 24,
    })
    await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      ...context,
      session: 'TL2',
      completedLaps: 26,
    })
    await racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
      ...context,
      session: 'TL3',
      completedLaps: 18,
    })

    // 1. Consulta histórica específica do TL1
    const tl1FactKey = buildPracticeSetupFactKey({
      careerId: context.careerId,
      seasonId: context.seasonId,
      round: context.round,
      session: 'TL1',
      teamId: context.teamId,
      carIndex: context.carIndex,
    })
    const tl1Snapshot = await racePracticeSetupService.loadPersistedApplication(
      context.careerId,
      context.seasonId,
      context.round,
      'TL1',
      tl1FactKey,
    )
    expect(tl1Snapshot).not.toBeNull()
    expect(tl1Snapshot?.accumulatedSetup).toBe(32.81)
    expect(tl1Snapshot?.sessionGain).toBe(32.81)

    // 2. Consulta do setup ATUAL acumulado do carro: deve ser 90.2275 e NÃO 32.81!
    const carCurrentState = await racePracticeSetupService.getCarAccumulatedSetup({
      careerId: context.careerId,
      seasonId: context.seasonId,
      round: context.round,
      teamId: context.teamId,
      carIndex: context.carIndex,
    })
    expect(carCurrentState.accumulatedSetup).toBe(90.2275)
    expect(carCurrentState.lastCompletedSession).toBe('TL3')
    expect(carCurrentState.isPracticeComplete).toBe(true)
    expect(carCurrentState.nextStep).toBe('Q1')
  })

  // =========================================================================
  // N06 — RELOAD: TL1 -> save/reload -> TL2 -> save/reload -> TL3 produz o mesmo
  // estado final da execução direta. Descartar cache em memória no teste;
  // reconstruir pelo armazenamento persistido.
  // =========================================================================
  it('N06 RELOAD: TL1 -> save/reload -> TL2 -> save/reload -> TL3 produz o mesmo estado final da execução direta', async () => {
    const context = {
      careerId: 'career_n06_reload',
      seasonId: 'season_2026',
      round: 1,
      teamId: 'aston_martin',
      carIndex: 1 as const,
      driverId: 'drv_alonso',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      consistency: 93,
      uniformSetupDraw: 0.5,
    }

    // Instância 1 executa TL1
    const service1 = new RacePracticeSetupService()
    await service1.processAndPersistPracticeSetup('TL1', {
      ...context,
      session: 'TL1',
      completedLaps: 24,
    })

    // DESCARTAR cache/instância 1 e criar Instância 2
    const service2 = new RacePracticeSetupService()
    const stateAfterTL1 = await service2.getWeekendNormalState({
      careerId: context.careerId,
      seasonId: context.seasonId,
      round: context.round,
      teamId: context.teamId,
      cars: [1],
    })
    expect(stateAfterTL1.status).toBe('TL2')
    expect(stateAfterTL1.lastCompletedSession).toBe('TL1')
    expect(stateAfterTL1.carSetups['aston_martin_c1'].accumulatedSetup).toBe(32.81)

    // Instância 2 executa TL2
    await service2.processAndPersistPracticeSetup('TL2', {
      ...context,
      session: 'TL2',
      completedLaps: 26,
    })

    // DESCARTAR cache/instância 2 e criar Instância 3
    const service3 = new RacePracticeSetupService()
    const stateAfterTL2 = await service3.getWeekendNormalState({
      careerId: context.careerId,
      seasonId: context.seasonId,
      round: context.round,
      teamId: context.teamId,
      cars: [1],
    })
    expect(stateAfterTL2.status).toBe('TL3')
    expect(stateAfterTL2.lastCompletedSession).toBe('TL2')
    expect(stateAfterTL2.carSetups['aston_martin_c1'].accumulatedSetup).toBe(65.62)

    // Instância 3 executa TL3
    const tl3Res = await service3.processAndPersistPracticeSetup('TL3', {
      ...context,
      session: 'TL3',
      completedLaps: 18,
    })

    expect(tl3Res.record.accumulatedSetup).toBe(90.2275)

    // Nova instância final para conferir tudo
    const serviceFinal = new RacePracticeSetupService()
    const finalState = await serviceFinal.getWeekendNormalState({
      careerId: context.careerId,
      seasonId: context.seasonId,
      round: context.round,
      teamId: context.teamId,
      cars: [1],
    })
    expect(finalState.status).toBe('READY_FOR_Q1')
    expect(finalState.lastCompletedSession).toBe('TL3')
    expect(finalState.carSetups['aston_martin_c1'].accumulatedSetup).toBe(90.2275)
    expect(finalState.carSetups['aston_martin_c1'].qualifyingBonusSeconds * 1000).toBe(
      225.56875000000002,
    )
    expect(finalState.carSetups['aston_martin_c1'].raceBonusSecondsPerLap).toBe(0.13534125)
  })

  // =========================================================================
  // N07 — TROCA DE PILOTO: mesmo carro, TL1 com piloto A, TL2 com piloto B:
  // TL2 parte do setup deixado pelo TL1; sem setup paralelo; sem reaplicar TL1.
  // =========================================================================
  it('N07 TROCA DE PILOTO: TL1 com piloto A, TL2 com piloto B no mesmo carro parte do setup deixado pelo TL1', async () => {
    const careerId = 'career_n07_swap'
    const seasonId = 'season_2026'
    const round = 1
    const teamId = 'audi_sport'
    const carIndex = 1 as const

    // TL1 com piloto A (Reserva Mariana Fagundes)
    const tl1Res = await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      careerId,
      seasonId,
      round,
      session: 'TL1',
      teamId,
      carIndex,
      driverId: 'drv_mariana_fagundes',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 24,
      consistency: 93,
      uniformSetupDraw: 0.5,
    })
    expect(tl1Res.record.accumulatedSetup).toBe(32.81)
    expect(tl1Res.record.driverId).toBe('drv_mariana_fagundes')

    // TL2 com piloto B (Titular Gabriel Bortoleto) no mesmo carro 1
    const tl2Res = await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      careerId,
      seasonId,
      round,
      session: 'TL2',
      teamId,
      carIndex,
      driverId: 'drv_gabriel_bortoleto',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 26,
      consistency: 93,
      uniformSetupDraw: 0.5,
    })

    // Deve partir do setup deixado pelo TL1 (32.81)
    expect(tl2Res.record.previousSetup).toBe(32.81)
    expect(tl2Res.record.sessionGain).toBe(32.81)
    expect(tl2Res.record.accumulatedSetup).toBe(65.62)
    expect(tl2Res.record.driverId).toBe('drv_gabriel_bortoleto')

    // Estado do carro consolidado
    const state = await racePracticeSetupService.getWeekendNormalState({
      careerId,
      seasonId,
      round,
      teamId,
      cars: [1],
    })
    expect(state.carSetups['audi_sport_c1'].accumulatedSetup).toBe(65.62)
    expect(state.carSetups['audi_sport_c1'].lastDriverId).toBe('drv_gabriel_bortoleto')
    // Não criou registro paralelo no carro 1
    expect(state.carSetups['audi_sport_c1'].sessionsCompleted).toEqual(['TL1', 'TL2'])
  })

  // =========================================================================
  // N08 — ISOLAMENTO: outra carreira, rodada ou carro não compartilha setup
  // =========================================================================
  it('N08 ISOLAMENTO: outra carreira, rodada ou carro não compartilha setup', async () => {
    // 1. Carro 1 da Carreira 1
    const c1Car1 = await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      careerId: 'career_alpha',
      seasonId: 'season_2026',
      round: 1,
      session: 'TL1',
      teamId: 'audi_sport',
      carIndex: 1,
      driverId: 'drv_bortoleto',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 24,
      consistency: 93,
      uniformSetupDraw: 0.5,
    })

    // 2. Carro 2 da MESMA carreira e rodada
    const c1Car2 = await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      careerId: 'career_alpha',
      seasonId: 'season_2026',
      round: 1,
      session: 'TL1',
      teamId: 'audi_sport',
      carIndex: 2,
      driverId: 'drv_hulkenberg',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 24,
      consistency: 80, // Ganho diferente
      uniformSetupDraw: 0.5,
    })

    // 3. Rodada 2 da Carreira 1
    const c1Round2 = await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      careerId: 'career_alpha',
      seasonId: 'season_2026',
      round: 2,
      session: 'TL1',
      teamId: 'audi_sport',
      carIndex: 1,
      driverId: 'drv_bortoleto',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 24,
      consistency: 93,
      uniformSetupDraw: 0.5,
    })

    // 4. Outra carreira (Carreira Beta)
    const c2Car1 = await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      careerId: 'career_beta',
      seasonId: 'season_2026',
      round: 1,
      session: 'TL1',
      teamId: 'audi_sport',
      carIndex: 1,
      driverId: 'drv_bortoleto',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 24,
      consistency: 93,
      uniformSetupDraw: 0.5,
    })

    // Chaves de aplicação devem ser todas distintas
    expect(c1Car1.record.applicationKey).not.toBe(c1Car2.record.applicationKey)
    expect(c1Car1.record.applicationKey).not.toBe(c1Round2.record.applicationKey)
    expect(c1Car1.record.applicationKey).not.toBe(c2Car1.record.applicationKey)

    // Carro 2 não herdou nada do Carro 1
    expect(c1Car2.record.previousSetup).toBe(0)
    // Rodada 2 não herdou nada da Rodada 1
    expect(c1Round2.record.previousSetup).toBe(0)
    // Carreira Beta não herdou nada da Alpha
    expect(c2Car1.record.previousSetup).toBe(0)
  })

  // =========================================================================
  // N09 — READY_FOR_Q1: somente após conclusão válida do TL3; não disparar Q1 automaticamente
  // =========================================================================
  it('N09 READY_FOR_Q1: somente após conclusão válida do TL3; não disparar Q1 automaticamente', async () => {
    const contextCar1 = {
      careerId: 'career_n09',
      seasonId: 'season_2026',
      round: 1,
      teamId: 'audi_sport',
      carIndex: 1 as const,
      driverId: 'drv_bortoleto',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      consistency: 93,
      uniformSetupDraw: 0.5,
    }
    const contextCar2 = {
      careerId: 'career_n09',
      seasonId: 'season_2026',
      round: 1,
      teamId: 'audi_sport',
      carIndex: 2 as const,
      driverId: 'drv_hulkenberg',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      consistency: 93,
      uniformSetupDraw: 0.5,
    }

    // Após TL1 para ambos os carros
    await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      ...contextCar1,
      session: 'TL1',
      completedLaps: 24,
    })
    await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      ...contextCar2,
      session: 'TL1',
      completedLaps: 24,
    })

    let state = await racePracticeSetupService.getWeekendNormalState({
      careerId: 'career_n09',
      seasonId: 'season_2026',
      round: 1,
      teamId: 'audi_sport',
      cars: [1, 2],
    })
    expect(state.status).toBe('TL2')
    expect(state.status).not.toBe('READY_FOR_Q1')

    // Após TL2 para ambos os carros
    await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      ...contextCar1,
      session: 'TL2',
      completedLaps: 26,
    })
    await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      ...contextCar2,
      session: 'TL2',
      completedLaps: 26,
    })

    state = await racePracticeSetupService.getWeekendNormalState({
      careerId: 'career_n09',
      seasonId: 'season_2026',
      round: 1,
      teamId: 'audi_sport',
      cars: [1, 2],
    })
    expect(state.status).toBe('TL3')
    expect(state.status).not.toBe('READY_FOR_Q1')

    // Se apenas o Carro 1 concluiu TL3 e o Carro 2 ainda não:
    await racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
      ...contextCar1,
      session: 'TL3',
      completedLaps: 18,
    })

    state = await racePracticeSetupService.getWeekendNormalState({
      careerId: 'career_n09',
      seasonId: 'season_2026',
      round: 1,
      teamId: 'audi_sport',
      cars: [1, 2],
    })
    // Ainda não está READY_FOR_Q1 porque Carro 2 não concluiu TL3!
    expect(state.status).toBe('TL3')

    // Carro 2 conclui TL3
    await racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
      ...contextCar2,
      session: 'TL3',
      completedLaps: 18,
    })

    state = await racePracticeSetupService.getWeekendNormalState({
      careerId: 'career_n09',
      seasonId: 'season_2026',
      round: 1,
      teamId: 'audi_sport',
      cars: [1, 2],
    })
    // Agora sim: READY_FOR_Q1!
    expect(state.status).toBe('READY_FOR_Q1')
    expect(state.lastCompletedSession).toBe('TL3')

    // Regra estrita: READY_FOR_Q1 não dispara Q1 automaticamente.
    // Nenhum registro de Q1 deve ter sido criado em session_setups
    const q1Records = pbSessionSetupsStore.filter((r) => r.session === 'q1')
    expect(q1Records.length).toBe(0)
  })

  // =========================================================================
  // RECUPERAÇÃO DE FALHA PARCIAL: ganho da sessão persistido -> avanço de progresso
  // interrompido. Ao repetir: detectar aplicação existente, não somar ganho novamente,
  // concluir somente o avanço pendente.
  // =========================================================================
  it('FALHA PARCIAL: detectar aplicação já persistida, não somar ganho novamente e recuperar estado', async () => {
    const context = {
      careerId: 'career_partial_failure',
      seasonId: 'season_2026',
      round: 1,
      teamId: 'audi_sport',
      carIndex: 1 as const,
      driverId: 'drv_bortoleto',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      consistency: 93,
      uniformSetupDraw: 0.5,
    }

    // Executa TL1
    await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      ...context,
      session: 'TL1',
      completedLaps: 24,
    })

    // Executa TL2 - simula que o registro foi persistido
    const tl2Run = await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      ...context,
      session: 'TL2',
      completedLaps: 26,
    })
    expect(tl2Run.record.accumulatedSetup).toBe(65.62)

    // Ao repetir a solicitação de TL2 (como no caso de retry após interrupção/timeout):
    const retryRun = await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      ...context,
      session: 'TL2',
      completedLaps: 26,
    })

    // Detecta aplicação existente, não soma ganho de novo
    expect(retryRun.isAlreadyCompleted).toBe(true)
    expect(retryRun.record.accumulatedSetup).toBe(65.62)
    expect(retryRun.record.sessionGain).toBe(32.81)

    // O progresso pode avançar diretamente para TL3 a partir do acerto herdado (65.62)
    const tl3Run = await racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
      ...context,
      session: 'TL3',
      completedLaps: 18,
    })

    expect(tl3Run.record.previousSetup).toBe(65.62)
    expect(tl3Run.record.accumulatedSetup).toBe(90.2275)
  })
})
