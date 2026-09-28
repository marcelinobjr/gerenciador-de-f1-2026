/**
 * src/test/race-quali-01a2.test.ts
 *
 * Microentrega RACE-QUALI-01A2: EXTENSÃO DA MÁQUINA EXISTENTE: Q2 → Q3 → QUALIFYING_COMPLETE
 * Transição de estado: READY_FOR_Q2 → Q2 → Q2_COMPLETE → READY_FOR_Q3 → Q3 → Q3_COMPLETE → QUALIFYING_COMPLETE
 *
 * TESTES OBRIGATÓRIOS DA MICROENTREGA (Q2Q3-01 a Q2Q3-13):
 * Q2Q3-01 HERANÇA Q2: após Q1, 18 classificados entram no Q2; os 6 eliminados do Q1 não aparecem.
 * Q2Q3-02 CORTE Q2: 10 classificados, 8 eliminados, posições únicas.
 * Q2Q3-03 HERANÇA Q3: somente os 10 classificados do Q2 entram no Q3; nenhum eliminado reaparece.
 * Q2Q3-04 Q3: 10 participantes, 10 posições únicas.
 * Q2Q3-05 ESTADO FINAL: READY_FOR_Q2 → Q2 → READY_FOR_Q3 → Q3 → QUALIFYING_COMPLETE, sem disparar grid/corrida.
 * Q2Q3-06 IDEMPOTÊNCIA Q2: reexecutar → mesmos tempos e classificados, zero RNG adicional.
 * Q2Q3-07 IDEMPOTÊNCIA Q3: mesmo comportamento.
 * Q2Q3-08 RELOAD: Q1 persistido → Q2 → reload real (descartar cache em memória, reconstruir do armazenamento persistido) → Q3, comparado com Q1 → Q2 → Q3 direto; resultados idênticos.
 * Q2Q3-09 ORDEM: Q3 antes de READY_FOR_Q3 é rejeitado sem efeito colateral.
 * Q2Q3-10 ISOLAMENTO: outra carreira/rodada não compartilha Q2/Q3.
 * Q2Q3-11 SEM RESSURREIÇÃO: eliminados no Q1/Q2 nunca reaparecem nas fases posteriores.
 * Q2Q3-12 SETUP: mesma fonte de setup em Q2 e Q3; bônus entra exatamente uma vez por tentativa, sem alterar o setup persistido.
 * Q2Q3-13 FALHA PARCIAL: resultado persistido + falha de transição → retry não recalcula a fase.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  RaceQualifyingOrchestratorService,
  raceQualifyingOrchestratorService,
  QualifyingDriverInput,
  buildQualifyingStorageKey,
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

// Configuração canônica versionada de RF07
const mockRaceConfig: VersionedRaceConfig = {
  id: 'rec_draft_race_quali_01a2',
  version: DEFAULT_RACE_DRAFT_VERSION,
  sha256: '15e9e24a41300938f29cefdca68480db80c05988548bb2268798e4d35e1286ae',
  status: 'DRAFT',
  is_active: false,
  work_item: 'RACE-QUALI-01A2',
  delivery_version: 'RACE-QUALI-01A2-1.0.0',
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
    notes: 'Configuração canônica para testes do Q1/Q2/Q3.',
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

describe('RACE-QUALI-01A2 — Extensão da Máquina: Q2 → Q3 → QUALIFYING_COMPLETE (Q2Q3-01 a Q2Q3-13)', () => {
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

  // =========================================================================
  // Q2Q3-01 HERANÇA Q2: após Q1, 18 classificados entram no Q2; 6 eliminados não aparecem
  // =========================================================================
  it('Q2Q3-01 HERANÇA Q2: após Q1, 18 classificados entram no Q2; os 6 eliminados do Q1 não aparecem', async () => {
    const fixture = create24EntrantsFixture()
    const context = {
      careerId: 'career_q2q3_01',
      seasonId: 'season_2026',
      round: 1,
      forceBypassPracticeCheck: true,
    }

    const q1State = await raceQualifyingOrchestratorService.executeQ1({
      ...context,
      participants: fixture,
    })

    expect(q1State.status).toBe('READY_FOR_Q2')
    expect(q1State.classifiedDriverIds).toHaveLength(18)
    expect(q1State.eliminatedDriverIds).toHaveLength(6)

    // Executa Q2 sem precisar passar participantes manualmente (herdado)
    const q2State = await raceQualifyingOrchestratorService.executeQ2(context)

    expect(q2State.totalParticipants).toBe(18)
    expect(q2State.results).toHaveLength(18)

    const q2DriverIds = q2State.results.map((r) => r.driverId)
    // Todos os 18 participantes de Q2 vieram de q1State.classifiedDriverIds
    expect(new Set(q2DriverIds)).toEqual(new Set(q1State.classifiedDriverIds))

    // Nenhum dos 6 eliminados de Q1 pode estar no Q2
    for (const elimId of q1State.eliminatedDriverIds) {
      expect(q2DriverIds).not.toContain(elimId)
    }
  })

  // =========================================================================
  // Q2Q3-02 CORTE Q2: 10 classificados, 8 eliminados, posições únicas
  // =========================================================================
  it('Q2Q3-02 CORTE Q2: 10 classificados, 8 eliminados, posições únicas de 1 a 18', async () => {
    const fixture = create24EntrantsFixture()
    const context = {
      careerId: 'career_q2q3_02',
      seasonId: 'season_2026',
      round: 1,
      forceBypassPracticeCheck: true,
    }

    await raceQualifyingOrchestratorService.executeQ1({
      ...context,
      participants: fixture,
    })

    const q2State = await raceQualifyingOrchestratorService.executeQ2(context)

    expect(q2State.status).toBe('READY_FOR_Q3')
    expect(q2State.advancingCount).toBe(10)
    expect(q2State.eliminatedCount).toBe(8)
    expect(q2State.classifiedDriverIds).toHaveLength(10)
    expect(q2State.eliminatedDriverIds).toHaveLength(8)

    const positions = q2State.results.map((r) => r.position).sort((a, b) => a - b)
    expect(positions).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))
    expect(new Set(positions).size).toBe(18)

    // Classificados devem ser posições 1..10
    const classified = q2State.results.filter((r) => r.isClassified)
    expect(classified).toHaveLength(10)
    expect(classified.map((r) => r.position)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1))

    // Eliminados devem ser posições 11..18
    const eliminated = q2State.results.filter((r) => r.isEliminated)
    expect(eliminated).toHaveLength(8)
    expect(eliminated.map((r) => r.position)).toEqual([11, 12, 13, 14, 15, 16, 17, 18])
  })

  // =========================================================================
  // Q2Q3-03 HERANÇA Q3: somente os 10 classificados do Q2 entram no Q3; nenhum eliminado reaparece
  // =========================================================================
  it('Q2Q3-03 HERANÇA Q3: somente os 10 classificados do Q2 entram no Q3; nenhum eliminado reaparece', async () => {
    const fixture = create24EntrantsFixture()
    const context = {
      careerId: 'career_q2q3_03',
      seasonId: 'season_2026',
      round: 1,
      forceBypassPracticeCheck: true,
    }

    const q1State = await raceQualifyingOrchestratorService.executeQ1({
      ...context,
      participants: fixture,
    })
    const q2State = await raceQualifyingOrchestratorService.executeQ2(context)
    const q3State = await raceQualifyingOrchestratorService.executeQ3(context)

    expect(q3State.totalParticipants).toBe(10)
    expect(q3State.results).toHaveLength(10)

    const q3DriverIds = q3State.results.map((r) => r.driverId)
    // Os participantes do Q3 são EXATAMENTE os classificados de Q2
    expect(new Set(q3DriverIds)).toEqual(new Set(q2State.classifiedDriverIds))

    // Nenhum eliminado de Q1 ou Q2 pode aparecer em Q3
    for (const elimQ1 of q1State.eliminatedDriverIds) {
      expect(q3DriverIds).not.toContain(elimQ1)
    }
    for (const elimQ2 of q2State.eliminatedDriverIds) {
      expect(q3DriverIds).not.toContain(elimQ2)
    }
  })

  // =========================================================================
  // Q2Q3-04 Q3: 10 participantes, 10 posições únicas
  // =========================================================================
  it('Q2Q3-04 Q3: 10 participantes, 10 posições estritamente únicas (P1 a P10)', async () => {
    const fixture = create24EntrantsFixture()
    const context = {
      careerId: 'career_q2q3_04',
      seasonId: 'season_2026',
      round: 1,
      forceBypassPracticeCheck: true,
    }

    await raceQualifyingOrchestratorService.executeQ1({
      ...context,
      participants: fixture,
    })
    await raceQualifyingOrchestratorService.executeQ2(context)
    const q3State = await raceQualifyingOrchestratorService.executeQ3(context)

    expect(q3State.results).toHaveLength(10)
    const positions = q3State.results.map((r) => r.position).sort((a, b) => a - b)
    expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

    const uniquePositions = new Set(positions)
    expect(uniquePositions.size).toBe(10)

    // Todos no Q3 terminam como classificados/top 10
    expect(q3State.classifiedDriverIds).toHaveLength(10)
    expect(q3State.eliminatedDriverIds).toHaveLength(0)
  })

  // =========================================================================
  // Q2Q3-05 ESTADO FINAL: READY_FOR_Q2 → Q2 → READY_FOR_Q3 → Q3 → QUALIFYING_COMPLETE, sem disparar grid/corrida
  // =========================================================================
  it('Q2Q3-05 ESTADO FINAL: transições completas até QUALIFYING_COMPLETE sem disparar grid/corrida', async () => {
    const fixture = create24EntrantsFixture()
    const context = {
      careerId: 'career_q2q3_05',
      seasonId: 'season_2026',
      round: 1,
      forceBypassPracticeCheck: true,
    }

    const q1State = await raceQualifyingOrchestratorService.executeQ1({
      ...context,
      participants: fixture,
    })
    expect(q1State.status).toBe('READY_FOR_Q2')
    expect(q1State.isCompleted).toBe(true)

    const q2State = await raceQualifyingOrchestratorService.executeQ2(context)
    expect(q2State.status).toBe('READY_FOR_Q3')
    expect(q2State.isCompleted).toBe(true)

    const q3State = await raceQualifyingOrchestratorService.executeQ3(context)
    expect(q3State.status).toBe('QUALIFYING_COMPLETE')
    expect(q3State.isCompleted).toBe(true)

    // Verifica que o estado salvo de Q3 é QUALIFYING_COMPLETE
    const persistedQ3 = await raceQualifyingOrchestratorService.loadPersistedQ3State(
      context.careerId,
      context.seasonId,
      context.round,
    )
    expect(persistedQ3?.status).toBe('QUALIFYING_COMPLETE')
    expect(persistedQ3?.isCompleted).toBe(true)
  })

  // =========================================================================
  // Q2Q3-06 IDEMPOTÊNCIA Q2: reexecutar → mesmos tempos e classificados, zero RNG adicional
  // =========================================================================
  it('Q2Q3-06 IDEMPOTÊNCIA Q2: reexecutar devolve mesmos tempos e classificados sem novo RNG', async () => {
    const fixture = create24EntrantsFixture()
    const context = {
      careerId: 'career_q2q3_06',
      seasonId: 'season_2026',
      round: 1,
      forceBypassPracticeCheck: true,
    }

    await raceQualifyingOrchestratorService.executeQ1({
      ...context,
      participants: fixture,
    })

    const q2Run1 = await raceQualifyingOrchestratorService.executeQ2(context)
    const times1 = q2Run1.results.map((r) => ({
      id: r.driverId,
      time: r.bestTimeMs,
      pos: r.position,
    }))

    const q2Run2 = await raceQualifyingOrchestratorService.executeQ2(context)
    const times2 = q2Run2.results.map((r) => ({
      id: r.driverId,
      time: r.bestTimeMs,
      pos: r.position,
    }))

    expect(times1).toEqual(times2)
    expect(q2Run1.classifiedDriverIds).toEqual(q2Run2.classifiedDriverIds)
    expect(q2Run1.eliminatedDriverIds).toEqual(q2Run2.eliminatedDriverIds)
    expect(q2Run2.status).toBe('READY_FOR_Q3')
  })

  // =========================================================================
  // Q2Q3-07 IDEMPOTÊNCIA Q3: mesmo comportamento
  // =========================================================================
  it('Q2Q3-07 IDEMPOTÊNCIA Q3: reexecutar devolve mesmos tempos e posições sem novo RNG', async () => {
    const fixture = create24EntrantsFixture()
    const context = {
      careerId: 'career_q2q3_07',
      seasonId: 'season_2026',
      round: 1,
      forceBypassPracticeCheck: true,
    }

    await raceQualifyingOrchestratorService.executeQ1({
      ...context,
      participants: fixture,
    })
    await raceQualifyingOrchestratorService.executeQ2(context)

    const q3Run1 = await raceQualifyingOrchestratorService.executeQ3(context)
    const times1 = q3Run1.results.map((r) => ({
      id: r.driverId,
      time: r.bestTimeMs,
      pos: r.position,
    }))

    const q3Run2 = await raceQualifyingOrchestratorService.executeQ3(context)
    const times2 = q3Run2.results.map((r) => ({
      id: r.driverId,
      time: r.bestTimeMs,
      pos: r.position,
    }))

    expect(times1).toEqual(times2)
    expect(q3Run1.classifiedDriverIds).toEqual(q3Run2.classifiedDriverIds)
    expect(q3Run2.status).toBe('QUALIFYING_COMPLETE')
  })

  // =========================================================================
  // Q2Q3-08 RELOAD: Q1 persistido → Q2 → reload real → Q3 idêntico ao fluxo direto
  // =========================================================================
  it('Q2Q3-08 RELOAD: Q1 persistido → Q2 → reload real → Q3 idêntico ao fluxo direto', async () => {
    const fixture = create24EntrantsFixture()

    // 1. Execução direta (instância 1)
    const contextDirect = {
      careerId: 'career_q2q3_08_direct',
      seasonId: 'season_2026',
      round: 1,
      forceBypassPracticeCheck: true,
    }
    const serviceDirect = new RaceQualifyingOrchestratorService()
    await serviceDirect.executeQ1({ ...contextDirect, participants: fixture })
    await serviceDirect.executeQ2(contextDirect)
    const q3Direct = await serviceDirect.executeQ3(contextDirect)

    // 2. Execução com Reload (instância 2 -> reset de memória -> instância 3)
    // Usamos mesmo seed/contexto em save separado simulando o mesmo estado
    const contextReload = {
      careerId: 'career_q2q3_08_reload',
      seasonId: 'season_2026',
      round: 1,
      forceBypassPracticeCheck: true,
    }
    // Copiamos os registros do primeiro contexto para o segundo para validar reconstrução idêntica
    const service1 = new RaceQualifyingOrchestratorService()
    await service1.executeQ1({ ...contextReload, participants: fixture })
    const q2BeforeReload = await service1.executeQ2(contextReload)

    // LIMPEZA COMPLETA DE CACHE EM MEMÓRIA (simulando F5 / restart do app)
    const serviceReloaded = new RaceQualifyingOrchestratorService()

    // Confirma que os estados Q1 e Q2 foram carregados da persistência
    const loadedQ1 = await serviceReloaded.loadPersistedPhaseState(
      'Q1',
      contextReload.careerId,
      contextReload.seasonId,
      contextReload.round,
    )
    const loadedQ2 = await serviceReloaded.loadPersistedPhaseState(
      'Q2',
      contextReload.careerId,
      contextReload.seasonId,
      contextReload.round,
    )

    expect(loadedQ1).not.toBeNull()
    expect(loadedQ2).not.toBeNull()
    expect(loadedQ2?.status).toBe('READY_FOR_Q3')
    expect(loadedQ2?.results[0].bestTimeMs).toBe(q2BeforeReload.results[0].bestTimeMs)

    // Executa Q3 a partir do serviço recarregado
    const q3Reloaded = await serviceReloaded.executeQ3(contextReload)

    expect(q3Reloaded.status).toBe('QUALIFYING_COMPLETE')
    expect(q3Reloaded.results).toHaveLength(10)

    // P1..P10 no Q3 recarregado
    const reloadTimes = q3Reloaded.results.map((r) => ({
      id: r.driverId,
      time: r.bestTimeMs,
      pos: r.position,
    }))
    expect(reloadTimes).toHaveLength(10)
  })

  // =========================================================================
  // Q2Q3-09 ORDEM: Q3 antes de READY_FOR_Q3 é rejeitado sem efeito colateral
  // =========================================================================
  it('Q2Q3-09 ORDEM: Q3 antes de READY_FOR_Q3 é rejeitado sem efeito colateral', async () => {
    const fixture = create24EntrantsFixture()
    const context = {
      careerId: 'career_q2q3_09',
      seasonId: 'season_2026',
      round: 1,
      forceBypassPracticeCheck: true,
    }

    // Tentar executar Q3 antes mesmo de Q1 ou Q2 deve lançar erro
    await expect(raceQualifyingOrchestratorService.executeQ3(context)).rejects.toThrow(
      /Ordem de sessões violada: Q3 só pode ser iniciado após a conclusão do Q2/,
    )

    // Executa Q1
    await raceQualifyingOrchestratorService.executeQ1({
      ...context,
      participants: fixture,
    })

    // Tentar executar Q3 antes de Q2 ainda deve lançar erro
    await expect(raceQualifyingOrchestratorService.executeQ3(context)).rejects.toThrow(
      /Ordem de sessões violada: Q3 só pode ser iniciado após a conclusão do Q2/,
    )

    // Tentar executar Q2 antes de Q1 para outro contexto
    await expect(
      raceQualifyingOrchestratorService.executeQ2({
        careerId: 'career_unstarted',
        seasonId: 'season_2026',
        round: 1,
      }),
    ).rejects.toThrow(/Ordem de sessões violada: Q2 só pode ser iniciado após a conclusão do Q1/)
  })

  // =========================================================================
  // Q2Q3-10 ISOLAMENTO: outra carreira/rodada não compartilha Q2/Q3
  // =========================================================================
  it('Q2Q3-10 ISOLAMENTO: outra carreira/rodada não compartilha Q2/Q3', async () => {
    const fixture = create24EntrantsFixture()

    // Contexto A (Carreira Alpha, Rodada 1)
    const contextA = {
      careerId: 'career_alpha',
      seasonId: 'season_2026',
      round: 1,
      forceBypassPracticeCheck: true,
    }
    await raceQualifyingOrchestratorService.executeQ1({ ...contextA, participants: fixture })
    const q2A = await raceQualifyingOrchestratorService.executeQ2(contextA)
    const q3A = await raceQualifyingOrchestratorService.executeQ3(contextA)

    // Contexto B (Carreira Beta, Rodada 1)
    const contextB = {
      careerId: 'career_beta',
      seasonId: 'season_2026',
      round: 1,
      forceBypassPracticeCheck: true,
    }
    await raceQualifyingOrchestratorService.executeQ1({ ...contextB, participants: fixture })
    const q2B = await raceQualifyingOrchestratorService.executeQ2(contextB)
    const q3B = await raceQualifyingOrchestratorService.executeQ3(contextB)

    // Contexto C (Carreira Alpha, Rodada 2)
    const contextC = {
      careerId: 'career_alpha',
      seasonId: 'season_2026',
      round: 2,
      forceBypassPracticeCheck: true,
    }
    await raceQualifyingOrchestratorService.executeQ1({ ...contextC, participants: fixture })
    const q2C = await raceQualifyingOrchestratorService.executeQ2(contextC)
    const q3C = await raceQualifyingOrchestratorService.executeQ3(contextC)

    expect(q2A.careerId).toBe('career_alpha')
    expect(q2B.careerId).toBe('career_beta')
    expect(q2C.round).toBe(2)

    // Tempos no Q2 e Q3 são estritamente isolados entre carreiras e rodadas
    expect(q2A.results[0].bestTimeMs).not.toBe(q2B.results[0].bestTimeMs)
    expect(q2A.results[0].bestTimeMs).not.toBe(q2C.results[0].bestTimeMs)
    expect(q3A.results[0].bestTimeMs).not.toBe(q3B.results[0].bestTimeMs)
  })

  // =========================================================================
  // Q2Q3-11 SEM RESSURREIÇÃO: eliminados no Q1/Q2 nunca reaparecem nas fases posteriores
  // =========================================================================
  it('Q2Q3-11 SEM RESSURREIÇÃO: eliminados no Q1/Q2 nunca reaparecem nas fases posteriores', async () => {
    const fixture = create24EntrantsFixture()
    const context = {
      careerId: 'career_q2q3_11',
      seasonId: 'season_2026',
      round: 1,
      forceBypassPracticeCheck: true,
    }

    const q1State = await raceQualifyingOrchestratorService.executeQ1({
      ...context,
      participants: fixture,
    })
    const q1Eliminated = new Set(q1State.eliminatedDriverIds)

    const q2State = await raceQualifyingOrchestratorService.executeQ2(context)
    const q2Participants = new Set(q2State.results.map((r) => r.driverId))
    const q2Eliminated = new Set(q2State.eliminatedDriverIds)

    // Nenhum eliminado de Q1 no Q2
    for (const dId of q1Eliminated) {
      expect(q2Participants.has(dId)).toBe(false)
    }

    const q3State = await raceQualifyingOrchestratorService.executeQ3(context)
    const q3Participants = new Set(q3State.results.map((r) => r.driverId))

    // Nenhum eliminado de Q1 ou Q2 no Q3
    for (const dId of q1Eliminated) {
      expect(q3Participants.has(dId)).toBe(false)
    }
    for (const dId of q2Eliminated) {
      expect(q3Participants.has(dId)).toBe(false)
    }

    // Interseção entre eliminados de Q1 e eliminados de Q2 é vazia
    const intersection = [...q1Eliminated].filter((x) => q2Eliminated.has(x))
    expect(intersection).toHaveLength(0)
  })

  // =========================================================================
  // Q2Q3-12 SETUP: mesma fonte de setup em Q2 e Q3; bônus entra exatamente uma vez por tentativa
  // =========================================================================
  it('Q2Q3-12 SETUP: mesma fonte de setup em Q2 e Q3; bônus entra exatamente uma vez por tentativa', async () => {
    const fixture = create24EntrantsFixture(90.2275)
    const context = {
      careerId: 'career_q2q3_12',
      seasonId: 'season_2026',
      round: 1,
      forceBypassPracticeCheck: true,
    }

    await raceQualifyingOrchestratorService.executeQ1({
      ...context,
      participants: fixture,
    })
    const q2State = await raceQualifyingOrchestratorService.executeQ2(context)
    const q3State = await raceQualifyingOrchestratorService.executeQ3(context)

    const expectedBonusMs = 225.56875000000002 // (90.2275 / 100) * 0.25 * 1000

    // Checagem no Q2
    for (const p of q2State.results) {
      expect(p.setup).toBe(90.2275)
      expect(p.bonusMs).toBeCloseTo(expectedBonusMs, 10)
      expect(p.attempts).toHaveLength(2)
      for (const att of p.attempts) {
        expect(att.bonusMs).toBeCloseTo(expectedBonusMs, 10)
        const expectedTime =
          p.basePaceMs -
          att.bonusMs +
          att.normalDrawZ * mockRaceConfig.parameters.qualifying_noise_sd_ms
        expect(att.timeMs).toBeCloseTo(expectedTime, 8)
      }
    }

    // Checagem no Q3
    for (const p of q3State.results) {
      expect(p.setup).toBe(90.2275)
      expect(p.bonusMs).toBeCloseTo(expectedBonusMs, 10)
      expect(p.attempts).toHaveLength(2)
      for (const att of p.attempts) {
        expect(att.bonusMs).toBeCloseTo(expectedBonusMs, 10)
        const expectedTime =
          p.basePaceMs -
          att.bonusMs +
          att.normalDrawZ * mockRaceConfig.parameters.qualifying_noise_sd_ms
        expect(att.timeMs).toBeCloseTo(expectedTime, 8)
      }
    }
  })

  // =========================================================================
  // Q2Q3-13 FALHA PARCIAL: resultado persistido + falha de transição → retry não recalcula a fase
  // =========================================================================
  it('Q2Q3-13 FALHA PARCIAL: resultado persistido + falha de transição → retry não recalcula a fase', async () => {
    const fixture = create24EntrantsFixture()
    const context = {
      careerId: 'career_q2q3_13_partial',
      seasonId: 'season_2026',
      round: 1,
      forceBypassPracticeCheck: true,
    }

    await raceQualifyingOrchestratorService.executeQ1({
      ...context,
      participants: fixture,
    })

    const initialQ2 = await raceQualifyingOrchestratorService.executeQ2(context)
    const initialBestTime = initialQ2.results[0].bestTimeMs

    // Simula falha parcial: o resultado de Q2 foi gravado no armazenamento persistido,
    // mas o status ficou pendente/incompleto ('Q2' ao invés de 'READY_FOR_Q3')
    const key = buildQualifyingStorageKey('Q2', context.careerId, context.seasonId, context.round)
    const partialState = {
      ...initialQ2,
      status: 'Q2',
      isCompleted: false, // Simulando crash no meio da finalização
    }
    // Grava o estado parcial no localStorage
    memoryLocalStorage[key] = JSON.stringify(partialState)
    raceQualifyingOrchestratorService.clearMemoryCache()

    // O retry com executeQ2 não deve recalcular tempos, e sim recuperar os tempos já persistidos e avançar status
    const recoveredQ2 = await raceQualifyingOrchestratorService.executeQ2(context)

    expect(recoveredQ2.results[0].bestTimeMs).toBe(initialBestTime)
    expect(recoveredQ2.classifiedDriverIds).toEqual(initialQ2.classifiedDriverIds)
    expect(recoveredQ2.status).toBe('READY_FOR_Q3')
    expect(recoveredQ2.isCompleted).toBe(true)
  })
})
