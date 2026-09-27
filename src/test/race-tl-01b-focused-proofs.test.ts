/**
 * src/test/race-tl-01b-focused-proofs.test.ts
 *
 * Suíte de Testes Canônica para a entrega RACE-TL-01B-NORMAL:
 * Fluxo de Treinos Livres do Fim de Semana NORMAL (TL1 -> TL2 -> TL3 -> READY_FOR_Q1).
 *
 * PROVAS E CRITÉRIOS OBRIGATÓRIOS:
 * 1. Progressão exata RF07: 32.81 (TL1) -> 65.62 (TL2) -> 90.2275 (TL3).
 * 2. Transição de estado: TL1 -> TL2 -> TL3 -> READY_FOR_Q1.
 * 3. Identidade do Acerto: pertence ao CARRO + FIM DE SEMANA.
 *    - Troca de piloto (ex: reserva no TL1 e titular no TL2) preserva o acerto do carro sem duplicar ganho.
 * 4. Idempotência estrita: rodar o mesmo passo duas vezes não duplica ganho nem adiciona novas aplicações.
 * 5. Persistência e Reload: recarregar a instância preserva o slot atual, acerto acumulado e ordem de execução.
 * 6. Teto de acerto 100 respeitado: ganhos que somariam mais de 100 são estritamente limitados a 100.
 * 7. Isolamento de formato: sessões competitivas e sessões sprint não afetam nem utilizam TL2/TL3.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  RacePracticeSetupService,
  racePracticeSetupService,
  buildPracticeSetupFactKey,
  getPracticeSetupStorageKey,
} from '@/services/racePracticeSetupService'
import { racePracticeService } from '@/services/racePracticeService'
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

// Configuração canônica versionada para os testes
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

describe('RACE-TL-01B-NORMAL — Fluxo de Fim de Semana Normal (TL1 -> TL2 -> TL3 -> READY_FOR_Q1)', () => {
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
  // PROVA 1 — PROGRESSÃO EXATA RF07 (32.81 -> 65.62 -> 90.2275) E READY_FOR_Q1
  // =========================================================================
  it('PROVA 1 — Progressão RF07: acerto acumulado 32.81 -> 65.62 -> 90.2275 e avança para READY_FOR_Q1', async () => {
    const careerContext = {
      careerId: 'career_rf07',
      seasonId: 'season_2026',
      round: 1,
      teamId: 'audi_sport',
      carIndex: 1 as const,
      driverId: 'drv_bortoleto',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      consistency: 80, // Valor padrão de consistência do vetor RF07
      uniformSetupDraw: 0.5, // Sorteio uniforme padrão de 0.5 do vetor RF07
    }

    // 1. TL1: 24 voltas, max 40 -> ganho 32.81, acumulado 32.81
    const tl1Res = await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      ...careerContext,
      session: 'TL1',
      completedLaps: 24,
    })
    expect(tl1Res.record.sessionGain).toBeCloseTo(32.81, 2)
    expect(tl1Res.record.accumulatedSetup).toBeCloseTo(32.81, 2)

    // Estado intermediário após TL1: próximo passo é TL2
    let weekendState = await racePracticeSetupService.getWeekendNormalState({
      careerId: careerContext.careerId,
      seasonId: careerContext.seasonId,
      round: careerContext.round,
      teamId: careerContext.teamId,
      cars: [1],
    })
    expect(weekendState.status).toBe('TL2')
    expect(weekendState.lastCompletedSession).toBe('TL1')
    expect(weekendState.carSetups['audi_sport_c1'].accumulatedSetup).toBeCloseTo(32.81, 2)

    // 2. TL2: 26 voltas, max 40 -> ganho 32.81, acumulado 65.62
    const tl2Res = await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      ...careerContext,
      session: 'TL2',
      completedLaps: 26,
    })
    expect(tl2Res.record.sessionGain).toBeCloseTo(32.81, 2)
    expect(tl2Res.record.accumulatedSetup).toBeCloseTo(65.62, 2)
    expect(tl2Res.record.previousSetup).toBeCloseTo(32.81, 2)

    // Estado intermediário após TL2: próximo passo é TL3
    weekendState = await racePracticeSetupService.getWeekendNormalState({
      careerId: careerContext.careerId,
      seasonId: careerContext.seasonId,
      round: careerContext.round,
      teamId: careerContext.teamId,
      cars: [1],
    })
    expect(weekendState.status).toBe('TL3')
    expect(weekendState.lastCompletedSession).toBe('TL2')
    expect(weekendState.carSetups['audi_sport_c1'].accumulatedSetup).toBeCloseTo(65.62, 2)

    // 3. TL3: 18 voltas, max 30 -> ganho 24.6075, acumulado 90.2275
    const tl3Res = await racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
      ...careerContext,
      session: 'TL3',
      completedLaps: 18,
    })
    expect(tl3Res.record.sessionGain).toBeCloseTo(24.6075, 4)
    expect(tl3Res.record.accumulatedSetup).toBeCloseTo(90.2275, 4)
    expect(tl3Res.record.previousSetup).toBeCloseTo(65.62, 2)

    // Estado final do fim de semana normal após TL3: avança para READY_FOR_Q1
    weekendState = await racePracticeSetupService.getWeekendNormalState({
      careerId: careerContext.careerId,
      seasonId: careerContext.seasonId,
      round: careerContext.round,
      teamId: careerContext.teamId,
      cars: [1],
    })
    expect(weekendState.status).toBe('READY_FOR_Q1')
    expect(weekendState.lastCompletedSession).toBe('TL3')
    expect(weekendState.carSetups['audi_sport_c1'].accumulatedSetup).toBeCloseTo(90.2275, 4)

    // Verificação de bônus derivados:
    // Qualificação: 90.2275% de 0.25 s = 0.22556875 s
    // Corrida: 90.2275% de 0.15 s = 0.13534125 s/volta
    expect(weekendState.carSetups['audi_sport_c1'].qualifyingBonusSeconds).toBeCloseTo(0.22557, 4)
    expect(weekendState.carSetups['audi_sport_c1'].raceBonusSecondsPerLap).toBeCloseTo(0.13534, 4)

    // Integração com racePracticeService.getNextStep
    const serviceNextStep = racePracticeService.getNextStep(
      {
        version: DEFAULT_RACE_DRAFT_VERSION,
        careerId: careerContext.careerId,
        seasonId: careerContext.seasonId,
        round: careerContext.round,
        isSprint: false,
        lastCompletedSession: 'TL3',
        carSetups: {},
      },
      false,
    )
    expect(serviceNextStep.status).toBe('READY_FOR_Q1')
    expect(serviceNextStep.nextSession).toBe('Q1')
    expect(serviceNextStep.isPracticeComplete).toBe(true)
  })

  // =========================================================================
  // PROVA 2 — IDENTIDADE DO ACERTO: CARRO + FIM DE SEMANA (TROCA DE PILOTO)
  // =========================================================================
  it('PROVA 2 — Troca de piloto entre treinos não zera nem duplica o acerto acumulado do carro', async () => {
    const careerId = 'career_driver_swap'
    const seasonId = 'season_2026'
    const round = 1
    const teamId = 'audi_sport'
    const carIndex = 1 as const

    // TL1 com piloto Reserva (Mariana Fagundes / mbj-028)
    const tl1Res = await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      careerId,
      seasonId,
      round,
      session: 'TL1',
      teamId,
      carIndex,
      driverId: 'drv_rookie_mariana',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 24,
      consistency: 80,
      uniformSetupDraw: 0.5,
    })
    expect(tl1Res.record.accumulatedSetup).toBeCloseTo(32.81, 2)
    expect(tl1Res.record.driverId).toBe('drv_rookie_mariana')

    // TL2 com o retorno do piloto Titular (Gabriel Bortoleto) no mesmo carro
    // O TL2 deve iniciar com o acerto deixado pelo TL1 (32.81)
    const tl2Res = await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      careerId,
      seasonId,
      round,
      session: 'TL2',
      teamId,
      carIndex,
      driverId: 'drv_titular_bortoleto', // Piloto diferente no cockpit
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 26,
      consistency: 80,
      uniformSetupDraw: 0.5,
    })

    // O carro preservou o acerto obtido pelo reserva e acumulou de forma incremental
    expect(tl2Res.record.previousSetup).toBeCloseTo(32.81, 2)
    expect(tl2Res.record.sessionGain).toBeCloseTo(32.81, 2)
    expect(tl2Res.record.accumulatedSetup).toBeCloseTo(65.62, 2)
    expect(tl2Res.record.driverId).toBe('drv_titular_bortoleto')

    // Verifica que o estado do carro reflete o acerto consolidado e o último piloto
    const state = await racePracticeSetupService.getWeekendNormalState({
      careerId,
      seasonId,
      round,
      teamId,
      cars: [1],
    })
    expect(state.carSetups['audi_sport_c1'].accumulatedSetup).toBeCloseTo(65.62, 2)
    expect(state.carSetups['audi_sport_c1'].lastDriverId).toBe('drv_titular_bortoleto')
  })

  // =========================================================================
  // PROVA 3 — IDEMPOTÊNCIA E REPETIÇÃO SEM DUPLICAÇÃO
  // =========================================================================
  it('PROVA 3 — Repetição da mesma solicitação é idempotente e não recalcula nem duplica ganhos', async () => {
    const inputs = {
      careerId: 'career_idempotence',
      seasonId: 'season_2026',
      round: 1,
      session: 'TL1' as const,
      teamId: 'ferrari',
      carIndex: 1 as const,
      driverId: 'drv_leclerc',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 24,
      consistency: 80,
      uniformSetupDraw: 0.5,
    }

    // 1ª execução
    const firstRun = await racePracticeSetupService.processAndPersistPracticeSetup('TL1', inputs)
    expect(firstRun.isAlreadyCompleted).toBe(false)
    expect(firstRun.record.accumulatedSetup).toBeCloseTo(32.81, 2)
    const recordsCountBefore = pbSessionSetupsStore.length

    // 2ª execução idêntica
    const secondRun = await racePracticeSetupService.processAndPersistPracticeSetup('TL1', inputs)
    expect(secondRun.isAlreadyCompleted).toBe(true)
    expect(secondRun.record.accumulatedSetup).toBeCloseTo(32.81, 2)
    expect(secondRun.record.sessionGain).toBeCloseTo(32.81, 2)

    // Não duplicou registros
    expect(pbSessionSetupsStore.length).toBe(recordsCountBefore)
  })

  // =========================================================================
  // PROVA 4 — RELOAD E RESILIÊNCIA DE PERSISTÊNCIA
  // =========================================================================
  it('PROVA 4 — Reload do save no meio do fim de semana preserva slot e acerto acumulado', async () => {
    const careerId = 'career_mid_reload'
    const seasonId = 'season_2026'
    const round = 1
    const teamId = 'mclaren'

    // Executa TL1
    await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      careerId,
      seasonId,
      round,
      session: 'TL1',
      teamId,
      carIndex: 1,
      driverId: 'drv_norris',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 24,
      consistency: 80,
      uniformSetupDraw: 0.5,
    })

    // Executa TL2
    await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      careerId,
      seasonId,
      round,
      session: 'TL2',
      teamId,
      carIndex: 1,
      driverId: 'drv_norris',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 26,
      consistency: 80,
      uniformSetupDraw: 0.5,
    })

    // SIMULAÇÃO DO RELOAD: descartar serviço e recriar instância limpa
    const reloadedService = new RacePracticeSetupService()

    // Consulta estado após reload
    const reloadedState = await reloadedService.getWeekendNormalState({
      careerId,
      seasonId,
      round,
      teamId,
      cars: [1],
    })

    // Deve reconhecer que parou após TL2 e que o próximo slot é TL3
    expect(reloadedState.status).toBe('TL3')
    expect(reloadedState.lastCompletedSession).toBe('TL2')
    expect(reloadedState.carSetups['mclaren_c1'].accumulatedSetup).toBeCloseTo(65.62, 2)

    // Pode continuar diretamente no TL3 a partir do acerto herdado
    const tl3AfterReload = await reloadedService.processAndPersistPracticeSetup('TL3', {
      careerId,
      seasonId,
      round,
      session: 'TL3',
      teamId,
      carIndex: 1,
      driverId: 'drv_norris',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 18,
      consistency: 80,
      uniformSetupDraw: 0.5,
    })

    expect(tl3AfterReload.record.accumulatedSetup).toBeCloseTo(90.2275, 4)
  })

  // =========================================================================
  // PROVA 5 — TETO DE ACERTO 100
  // =========================================================================
  it('PROVA 5 — Teto de acerto 100 é rigorosamente respeitado sem ultrapassagens', async () => {
    const careerId = 'career_cap_100'
    const seasonId = 'season_2026'
    const round = 1
    const teamId = 'mercedes'
    const carIndex = 1 as const

    // Configura TL1
    await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      careerId,
      seasonId,
      round,
      session: 'TL1',
      teamId,
      carIndex,
      driverId: 'drv_russell',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 24,
      consistency: 80,
      uniformSetupDraw: 0.5,
    })

    // Executa TL2 forçando acerto anterior alto (ex: 85)
    const tl2Capped = await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      careerId,
      seasonId,
      round,
      session: 'TL2',
      teamId,
      carIndex,
      driverId: 'drv_russell',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 26,
      consistency: 95,
      previousSetup: 85, // 85 + ~35 ultrapassaria 100
      uniformSetupDraw: 0.9,
    })

    expect(tl2Capped.record.accumulatedSetup).toBe(100)
    expect(tl2Capped.record.accumulatedSetup).toBeLessThanOrEqual(100)
    expect(tl2Capped.record.qualifyingBonusSeconds).toBe(0.25)
    expect(tl2Capped.record.raceBonusSecondsPerLap).toBe(0.15)
  })

  // =========================================================================
  // PROVA 6 — ORDEM REGULAMENTAR: TL2 REQUER TL1 E TL3 REQUER TL2
  // =========================================================================
  it('PROVA 6 — Ordem regulamentar estrita: falha ao tentar TL2 sem TL1 ou TL3 sem TL2', async () => {
    const inputs = {
      careerId: 'career_order_test',
      seasonId: 'season_2026',
      round: 1,
      teamId: 'red_bull',
      carIndex: 1 as const,
      driverId: 'drv_verstappen',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 26,
      consistency: 80,
      uniformSetupDraw: 0.5,
    }

    // Tentativa direta de TL2 sem TL1 prévio para este carro
    await expect(
      racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
        ...inputs,
        session: 'TL2',
      }),
    ).rejects.toThrow(/TL1 para o Carro 1 .* ainda não foi concluído/)

    // Tentativa direta de TL3 sem TL2
    await expect(
      racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
        ...inputs,
        session: 'TL3',
      }),
    ).rejects.toThrow(/TL2 para o Carro 1 .* ainda não foi concluído/)
  })

  // =========================================================================
  // PROVA 7 — ISOLAMENTO SPRINT: REJEITA TL2/TL3 EM SPRINT WEEKEND
  // =========================================================================
  it('PROVA 7 — Sprint: rejeita categoricamente TL2 e TL3 quando isSprint for true', async () => {
    const inputs = {
      careerId: 'career_sprint_test',
      seasonId: 'season_2026',
      round: 2,
      teamId: 'aston_martin',
      carIndex: 1 as const,
      driverId: 'drv_alonso',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 26,
      consistency: 80,
      uniformSetupDraw: 0.5,
      isSprint: true,
    }

    await expect(
      racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
        ...inputs,
        session: 'TL2',
      }),
    ).rejects.toThrow(/não é realizada em formato de fim de semana Sprint/)

    await expect(
      racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
        ...inputs,
        session: 'TL3',
      }),
    ).rejects.toThrow(/não é realizada em formato de fim de semana Sprint/)
  })
})
