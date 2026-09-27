/**
 * src/test/race-tl-01a-focused-proofs.test.ts
 *
 * Suíte de Testes Canônica para a microentrega RACE-TL-01A:
 * Apuração e Persistência do Acerto do TL1 no Apex GP Manager.
 *
 * Quatro Provas Focadas Obrigatórias:
 * A01 — CÁLCULO E GRAVAÇÃO:
 *       Contexto de teste: TL1, acerto anterior 0, voltas planejadas 24, voltas completadas 24,
 *       ganho máximo 40, consistência 93, sorteio uniforme 0.5 (referência RF04 / arquivo 02).
 *       Esperado: ganho 32.81, acerto posterior 32.81, uma aplicação persistida.
 * A02 — REPETIÇÃO SEM DUPLICAÇÃO:
 *       Executar novamente a mesma solicitação.
 *       Esperado: mesmo resultado, acerto continua 32.81, uma única aplicação, nenhum novo sorteio.
 * A03 — RELOAD:
 *       Descartar o estado em memória, reconstruir a instância do serviço/contexto,
 *       carregar os dados persistidos, repetir a consulta/aplicação.
 *       Esperado: mesmo participante, mesmas entradas, mesma versão de config, mesmo ganho (32.81),
 *       mesmo acerto (32.81), nenhuma duplicação.
 * A04 — ISOLAMENTO E ERRO EXPLÍCITO:
 *       Contextos distintos de carreira/rodada não alteram nem compartilham a aplicação um do outro.
 *       Com versão de configuração ausente/inválida: erro explícito (RaceConfigLoadError),
 *       nenhum ganho gravado, nenhum acerto alterado, nenhum fallback silencioso.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  RacePracticeSetupService,
  racePracticeSetupService,
  buildPracticeSetupFactKey,
  getPracticeSetupStorageKey,
} from '@/services/racePracticeSetupService'
import { RaceConfigLoadError, DEFAULT_RACE_DRAFT_VERSION } from '@/lib/race/loader'
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

// Mock da configuração DRAFT do PocketBase
const mockDraftConfig: VersionedRaceConfig = {
  id: 'rec_draft_race_1',
  version: DEFAULT_RACE_DRAFT_VERSION,
  sha256: '15e9e24a41300938f29cefdca68480db80c05988548bb2268798e4d35e1286ae',
  status: 'DRAFT',
  is_active: false,
  work_item: 'RACE-SOURCE-01A',
  delivery_version: 'RACE-SOURCE-01A-DRAFT-1.0.0',
  source_declared_version: 'v1',
  source_sha256: '0d02e79794f6defabfa3385d2854a4fc0bed7e5a17495c008075185d71f289a2',
  parameters: DEFAULT_SOURCE_RACE_PARAMETERS,
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
    notes: 'Configuração DRAFT inativa para testes focados.',
  },
  created: '2026-09-27T00:00:00.000Z',
  updated: '2026-09-27T00:00:00.000Z',
}

describe('RACE-TL-01A — Quatro Provas Focadas (A01 a A04)', () => {
  // Store em memória simulando a collection session_setups do PocketBase
  let pbSessionSetupsStore: any[] = []

  beforeEach(() => {
    mockStorage.clear()
    pbSessionSetupsStore = []

    // Mock do pb.collection('race_versioned_configs').getFirstListItem
    vi.spyOn(pb.collection('race_versioned_configs'), 'getFirstListItem').mockImplementation(
      async (filter: string) => {
        if (filter.includes(DEFAULT_RACE_DRAFT_VERSION)) {
          return mockDraftConfig as any
        }
        throw new Error(`Record not found for filter: ${filter}`)
      },
    )

    // Mock do pb.collection('session_setups')
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
  // A01 — CÁLCULO E GRAVAÇÃO
  // =========================================================================
  it('A01 — CÁLCULO E GRAVAÇÃO: calcula ganho 32.81, acerto 32.81 e persiste a aplicação com identificador estável', async () => {
    // Contexto de teste RF04 do arquivo 02:
    // Sessão TL1; acerto anterior 0; voltas planejadas 24; voltas completadas 24;
    // ganho máximo 40; consistência 93 (ou 80 conforme RF04); sorteio uniforme 0.5.
    // Verificando RF04 do JSON 02:
    // consistency: 93, uniform_setup_draw: 0.5, exposure: 24/24=1
    // consistencyFactor = 0.5 + 0.5 * (93 / 100) = 0.965
    // drawFactor = 0.7 + 0.3 * 0.5 = 0.85
    // gain = 40 * 1 * 0.965 * 0.85 = 32.81
    const inputs = {
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      round: 1,
      session: 'TL1' as const,
      teamId: 'audi_sport',
      carIndex: 1 as const,
      driverId: 'drv_bortoleto',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 24,
      consistency: 93,
      previousSetup: 0,
      uniformSetupDraw: 0.5,
    }

    const result = await racePracticeSetupService.processAndPersistTL1Setup(inputs)

    // 1. Verificação de resultado esportivo esperado
    expect(result.isAlreadyCompleted).toBe(false)
    expect(result.record.sessionGain).toBeCloseTo(32.81, 2)
    expect(result.record.accumulatedSetup).toBeCloseTo(32.81, 2)
    expect(result.record.previousSetup).toBe(0)
    expect(result.record.completedLaps).toBe(24)
    expect(result.record.plannedLaps).toBe(24)
    expect(result.record.consistency).toBe(93)
    expect(result.record.uniformSetupDraw).toBe(0.5)

    // Bônus derivados proporcionais:
    // 32.81% de 0.25 s = 0.082025 s
    // 32.81% de 0.15 s = 0.049215 s
    expect(result.record.qualifyingBonusSeconds).toBeCloseTo(0.082025, 5)
    expect(result.record.raceBonusSecondsPerLap).toBeCloseTo(0.049215, 5)

    // 2. Verificação de persistência no armazenamento canônico (session_setups)
    expect(pbSessionSetupsStore.length).toBe(1)
    const storedRecord = pbSessionSetupsStore[0]
    expect(storedRecord.team_id).toBe('career_test_01')
    expect(storedRecord.round).toBe(1)
    expect(storedRecord.session).toBe('tp1')

    const apps = storedRecord.driver_strategies?.practiceSetupApplications
    const factKey = buildPracticeSetupFactKey({
      careerId: inputs.careerId,
      seasonId: inputs.seasonId,
      round: inputs.round,
      session: inputs.session,
      teamId: inputs.teamId,
      carIndex: inputs.carIndex,
    })
    expect(apps).toBeDefined()
    expect(apps[factKey]).toBeDefined()
    expect(apps[factKey].sessionGain).toBeCloseTo(32.81, 2)
    expect(apps[factKey].accumulatedSetup).toBeCloseTo(32.81, 2)
    expect(apps[factKey].applicationKey).toBe(factKey)

    // 3. Verificação do espelho em cache local
    const localKey = getPracticeSetupStorageKey('career_test_01', 'season_2026', 1, 'TL1')
    const rawLocal = localStorage.getItem(localKey)
    expect(rawLocal).not.toBeNull()
    const parsedLocal = JSON.parse(rawLocal!)
    expect(parsedLocal[factKey].accumulatedSetup).toBeCloseTo(32.81, 2)
  })

  // =========================================================================
  // A02 — REPETIÇÃO SEM DUPLICAÇÃO (IDEMPOTÊNCIA)
  // =========================================================================
  it('A02 — REPETIÇÃO SEM DUPLICAÇÃO: executar novamente devolve o mesmo resultado sem duplicar registros nem realizar novo sorteio', async () => {
    const inputs = {
      careerId: 'career_test_02',
      seasonId: 'season_2026',
      round: 1,
      session: 'TL1' as const,
      teamId: 'audi_sport',
      carIndex: 1 as const,
      driverId: 'drv_bortoleto',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 24,
      consistency: 93,
      previousSetup: 0,
      uniformSetupDraw: 0.5,
    }

    // 1ª execução
    const firstRun = await racePracticeSetupService.processAndPersistTL1Setup(inputs)
    expect(firstRun.isAlreadyCompleted).toBe(false)
    expect(firstRun.record.accumulatedSetup).toBeCloseTo(32.81, 2)
    expect(pbSessionSetupsStore.length).toBe(1)

    // 2ª execução idêntica
    const secondRun = await racePracticeSetupService.processAndPersistTL1Setup(inputs)
    expect(secondRun.isAlreadyCompleted).toBe(true)
    expect(secondRun.record.accumulatedSetup).toBeCloseTo(32.81, 2)
    expect(secondRun.record.sessionGain).toBeCloseTo(32.81, 2)
    expect(secondRun.record.applicationKey).toBe(firstRun.record.applicationKey)

    // Não deve criar novos registros no banco
    expect(pbSessionSetupsStore.length).toBe(1)

    // Execuções concorrentes simuladas (Promise.all)
    const [concurrent1, concurrent2] = await Promise.all([
      racePracticeSetupService.processAndPersistTL1Setup(inputs),
      racePracticeSetupService.processAndPersistTL1Setup(inputs),
    ])
    expect(concurrent1.record.accumulatedSetup).toBeCloseTo(32.81, 2)
    expect(concurrent2.record.accumulatedSetup).toBeCloseTo(32.81, 2)
    expect(pbSessionSetupsStore.length).toBe(1)
  })

  // =========================================================================
  // A03 — RELOAD
  // =========================================================================
  it('A03 — RELOAD: reconstrói serviço e contexto em memória e lê do armazenamento persistido com exatidão', async () => {
    const inputs = {
      careerId: 'career_reload_03',
      seasonId: 'season_2026',
      round: 1,
      session: 'TL1' as const,
      teamId: 'ferrari',
      carIndex: 2 as const,
      driverId: 'drv_leclerc',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 24,
      consistency: 93,
      previousSetup: 0,
      uniformSetupDraw: 0.5,
    }

    // 1ª execução grava no armazenamento simulado
    const initialRun = await racePracticeSetupService.processAndPersistTL1Setup(inputs)
    expect(initialRun.record.accumulatedSetup).toBeCloseTo(32.81, 2)

    // DESCARTAR estado em memória: instanciar um novo RacePracticeSetupService
    const freshServiceInstance = new RacePracticeSetupService()

    // Consulta direta do fato persistido
    const factKey = buildPracticeSetupFactKey({
      careerId: inputs.careerId,
      seasonId: inputs.seasonId,
      round: inputs.round,
      session: inputs.session,
      teamId: inputs.teamId,
      carIndex: inputs.carIndex,
    })

    const loadedRecord = await freshServiceInstance.loadPersistedApplication(
      inputs.careerId,
      inputs.seasonId,
      inputs.round,
      inputs.session,
      factKey,
    )

    expect(loadedRecord).not.toBeNull()
    expect(loadedRecord?.driverId).toBe('drv_leclerc')
    expect(loadedRecord?.carIndex).toBe(2)
    expect(loadedRecord?.configVersion).toBe(DEFAULT_RACE_DRAFT_VERSION)
    expect(loadedRecord?.completedLaps).toBe(24)
    expect(loadedRecord?.plannedLaps).toBe(24)
    expect(loadedRecord?.sessionGain).toBeCloseTo(32.81, 2)
    expect(loadedRecord?.accumulatedSetup).toBeCloseTo(32.81, 2)

    // Repetir a aplicação pelo novo serviço: deve reconhecer o registro gravado sem recalcular
    const postReloadRun = await freshServiceInstance.processAndPersistTL1Setup(inputs)
    expect(postReloadRun.isAlreadyCompleted).toBe(true)
    expect(postReloadRun.record.accumulatedSetup).toBeCloseTo(32.81, 2)
    expect(pbSessionSetupsStore.length).toBe(1)
  })

  // =========================================================================
  // A04 — ISOLAMENTO E ERRO EXPLÍCITO
  // =========================================================================
  it('A04 — ISOLAMENTO: contextos distintos de carreira e rodada são estritamente isolados', async () => {
    // Carreira A
    const resA = await racePracticeSetupService.processAndPersistTL1Setup({
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
      previousSetup: 0,
      uniformSetupDraw: 0.5,
    })

    // Carreira B (mesmo time, mesma rodada, piloto diferente)
    const resB = await racePracticeSetupService.processAndPersistTL1Setup({
      careerId: 'career_beta',
      seasonId: 'season_2026',
      round: 1,
      session: 'TL1',
      teamId: 'audi_sport',
      carIndex: 1,
      driverId: 'drv_hulkenberg',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 24,
      consistency: 93,
      previousSetup: 0,
      uniformSetupDraw: 0.5,
    })

    // Rodada 2 da Carreira A
    const resA_R2 = await racePracticeSetupService.processAndPersistTL1Setup({
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
      previousSetup: 0,
      uniformSetupDraw: 0.5,
    })

    expect(resA.record.applicationKey).not.toBe(resB.record.applicationKey)
    expect(resA.record.applicationKey).not.toBe(resA_R2.record.applicationKey)
    expect(pbSessionSetupsStore.length).toBe(3) // 3 sessões independentes gravadas
  })

  it('A04 — ERRO EXPLÍCITO: falha sem gravar nada quando a configuração é vazia ou inválida', async () => {
    const storeCountBefore = pbSessionSetupsStore.length

    // 1. Versão vazia
    await expect(
      racePracticeSetupService.processAndPersistTL1Setup({
        careerId: 'career_err',
        seasonId: 'season_2026',
        round: 1,
        session: 'TL1',
        teamId: 'audi_sport',
        carIndex: 1,
        driverId: 'drv_test',
        configVersion: '',
        completedLaps: 24,
        consistency: 93,
        previousSetup: 0,
      }),
    ).rejects.toThrow(RaceConfigLoadError)

    // 2. Versão inexistente no banco
    await expect(
      racePracticeSetupService.processAndPersistTL1Setup({
        careerId: 'career_err',
        seasonId: 'season_2026',
        round: 1,
        session: 'TL1',
        teamId: 'audi_sport',
        carIndex: 1,
        driverId: 'drv_test',
        configVersion: 'NON_EXISTENT_VERSION_9.9.9',
        completedLaps: 24,
        consistency: 93,
        previousSetup: 0,
      }),
    ).rejects.toThrow(RaceConfigLoadError)

    // Nenhum dado gravado no banco ou alterado
    expect(pbSessionSetupsStore.length).toBe(storeCountBefore)
  })

  it('A04 — ERRO EXPLÍCITO: falha em tentativa de sobrescrita conflitante para fato já concluído', async () => {
    const baseInputs = {
      careerId: 'career_conflict',
      seasonId: 'season_2026',
      round: 1,
      session: 'TL1' as const,
      teamId: 'audi_sport',
      carIndex: 1 as const,
      driverId: 'drv_bortoleto',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 24,
      consistency: 93,
      previousSetup: 0,
      uniformSetupDraw: 0.5,
    }

    // 1ª gravação bem-sucedida
    await racePracticeSetupService.processAndPersistTL1Setup(baseInputs)

    // Tentativa com entradas conflitantes para o mesmo fato
    const conflictingInputs = {
      ...baseInputs,
      completedLaps: 10, // Diferente do gravado
      consistency: 70, // Diferente do gravado
    }

    await expect(
      racePracticeSetupService.processAndPersistTL1Setup(conflictingInputs),
    ).rejects.toThrow(/Conflito de aplicação/)
  })
})
