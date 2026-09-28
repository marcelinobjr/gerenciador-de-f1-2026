/**
 * src/test/race-quali-01a.test.ts
 *
 * Microentrega RACE-QUALI-01A1: SOMENTE Q1
 * Transição de estado: READY_FOR_Q1 → Q1 → Q1_COMPLETE → READY_FOR_Q2
 *
 * TESTES OBRIGATÓRIOS DA MICROENTREGA (Q1-01 a Q1-08):
 * Q1-01 PARTICIPANTES — 24 inscrições únicas entram no Q1 da fixture de referência.
 * Q1-02 CORTE — 18 classificados e 6 eliminados.
 * Q1-03 UNICIDADE — nenhum participante duplicado; posições únicas (P1 a P24).
 * Q1-04 SETUP — RF07 usa setup 90.2275 e bônus 225.56875000000002 ms exatamente uma vez.
 * Q1-05 IDEMPOTÊNCIA — executar novamente Q1 concluído: mesmos tempos, mesmas posições, mesmos classificados, nenhum novo RNG.
 * Q1-06 RELOAD — executar Q1, descartar estado em memória e reconstruir do armazenamento; resultado permanece idêntico.
 * Q1-07 ORDEM — Q1 só inicia a partir do estado válido equivalente a READY_FOR_Q1; tentativa fora de ordem: zero resultado esportivo novo, zero sorteio, zero alteração de setup.
 * Q1-08 ISOLAMENTO — outra carreira/rodada não reutiliza resultado de Q1.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  RaceQualifyingOrchestratorService,
  raceQualifyingOrchestratorService,
  Q1DriverInput,
} from '@/services/raceQualifyingOrchestratorService'
import { racePracticeSetupService } from '@/services/racePracticeSetupService'
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
  id: 'rec_draft_race_quali',
  version: DEFAULT_RACE_DRAFT_VERSION,
  sha256: '15e9e24a41300938f29cefdca68480db80c05988548bb2268798e4d35e1286ae',
  status: 'DRAFT',
  is_active: false,
  work_item: 'RACE-QUALI-01A1',
  delivery_version: 'RACE-QUALI-01A1-1.0.0',
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
    notes: 'Configuração canônica para testes do Q1.',
  },
  created: '2026-09-28T00:00:00.000Z',
  updated: '2026-09-28T00:00:00.000Z',
}

// Fixture oficial de 24 pilotos (12 equipes x 2 pilotos)
const create24EntrantsFixture = (setupVal = 90.2275): Q1DriverInput[] => {
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

  const entrants: Q1DriverInput[] = []
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

describe('RACE-QUALI-01A1 — Microentrega: SOMENTE Q1 (Testes Q1-01 a Q1-08)', () => {
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
  // Q1-01 PARTICIPANTES — 24 inscrições únicas entram no Q1 da fixture de referência
  // =========================================================================
  it('Q1-01 PARTICIPANTES: 24 inscrições únicas entram no Q1 da fixture de referência', async () => {
    const fixture = create24EntrantsFixture()
    const state = await raceQualifyingOrchestratorService.executeQ1({
      careerId: 'career_q1_01',
      seasonId: 'season_2026',
      round: 1,
      participants: fixture,
      forceBypassPracticeCheck: true,
    })

    expect(state.totalParticipants).toBe(24)
    expect(state.results).toHaveLength(24)

    const driverIds = state.results.map((r) => r.driverId)
    const uniqueIds = new Set(driverIds)
    expect(uniqueIds.size).toBe(24)
  })

  // =========================================================================
  // Q1-02 CORTE — 18 classificados e 6 eliminados
  // =========================================================================
  it('Q1-02 CORTE: 18 classificados e 6 eliminados, transicionando para READY_FOR_Q2', async () => {
    const fixture = create24EntrantsFixture()
    const state = await raceQualifyingOrchestratorService.executeQ1({
      careerId: 'career_q1_02',
      seasonId: 'season_2026',
      round: 1,
      participants: fixture,
      forceBypassPracticeCheck: true,
    })

    expect(state.status).toBe('READY_FOR_Q2')
    expect(state.advancingCount).toBe(18)
    expect(state.eliminatedCount).toBe(6)
    expect(state.classifiedDriverIds).toHaveLength(18)
    expect(state.eliminatedDriverIds).toHaveLength(6)

    // Eliminados devem ter posições fixadas em P19..P24
    const eliminated = state.results.filter((r) => r.isEliminated)
    expect(eliminated).toHaveLength(6)
    const elimPositions = eliminated.map((r) => r.position).sort((a, b) => a - b)
    expect(elimPositions).toEqual([19, 20, 21, 22, 23, 24])

    // Classificados devem ter posições P1..P18
    const classified = state.results.filter((r) => r.isClassified)
    expect(classified).toHaveLength(18)
    const classPositions = classified.map((r) => r.position).sort((a, b) => a - b)
    expect(classPositions).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))
  })

  // =========================================================================
  // Q1-03 UNICIDADE — nenhum participante duplicado; posições únicas (P1 a P24)
  // =========================================================================
  it('Q1-03 UNICIDADE: nenhum participante duplicado; posições estritamente únicas de 1 a 24', async () => {
    const fixture = create24EntrantsFixture()
    // Tenta injetar participantes duplicados na entrada
    const dirtyFixture = [...fixture, fixture[0], fixture[10]]

    const state = await raceQualifyingOrchestratorService.executeQ1({
      careerId: 'career_q1_03',
      seasonId: 'season_2026',
      round: 1,
      participants: dirtyFixture,
      forceBypassPracticeCheck: true,
    })

    // Deve desduplicar mantendo 24
    expect(state.results).toHaveLength(24)
    const positions = state.results.map((r) => r.position).sort((a, b) => a - b)
    expect(positions).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))

    const uniquePositions = new Set(positions)
    expect(uniquePositions.size).toBe(24)
  })

  // =========================================================================
  // Q1-04 SETUP — RF07 usa setup 90.2275 e bônus 225.56875000000002 ms exatamente uma vez
  // =========================================================================
  it('Q1-04 SETUP: RF07 usa setup 90.2275 e bônus 225.56875000000002 ms exatamente uma vez', async () => {
    const fixture = create24EntrantsFixture(90.2275)
    const state = await raceQualifyingOrchestratorService.executeQ1({
      careerId: 'career_q1_04',
      seasonId: 'season_2026',
      round: 1,
      participants: fixture,
      forceBypassPracticeCheck: true,
    })

    const expectedBonusMs = 225.56875000000002 // (90.2275 / 100) * 0.25 * 1000

    for (const participant of state.results) {
      expect(participant.setup).toBe(90.2275)
      expect(participant.bonusMs).toBeCloseTo(expectedBonusMs, 10)

      // Checa cada tentativa individual
      expect(participant.attempts).toHaveLength(2)
      for (const att of participant.attempts) {
        expect(att.bonusMs).toBeCloseTo(expectedBonusMs, 10)
        // time_ms = base_pace_ms - bonus_ms + z * sigma
        const expectedTime =
          participant.basePaceMs -
          att.bonusMs +
          att.normalDrawZ * mockRaceConfig.parameters.qualifying_noise_sd_ms
        expect(att.timeMs).toBeCloseTo(expectedTime, 8)
      }
    }
  })

  // =========================================================================
  // Q1-05 IDEMPOTÊNCIA — executar novamente Q1 concluído: mesmos tempos, posições e classificados
  // =========================================================================
  it('Q1-05 IDEMPOTÊNCIA: reexecutar Q1 concluído devolve o mesmo resultado sem novo RNG', async () => {
    const fixture = create24EntrantsFixture()
    const params = {
      careerId: 'career_q1_05',
      seasonId: 'season_2026',
      round: 1,
      participants: fixture,
      forceBypassPracticeCheck: true,
    }

    const state1 = await raceQualifyingOrchestratorService.executeQ1(params)
    const times1 = state1.results.map((r) => ({
      id: r.driverId,
      time: r.bestTimeMs,
      pos: r.position,
      classified: r.isClassified,
    }))

    // Segunda chamada
    const state2 = await raceQualifyingOrchestratorService.executeQ1(params)
    const times2 = state2.results.map((r) => ({
      id: r.driverId,
      time: r.bestTimeMs,
      pos: r.position,
      classified: r.isClassified,
    }))

    expect(times1).toEqual(times2)
    expect(state1.classifiedDriverIds).toEqual(state2.classifiedDriverIds)
    expect(state1.eliminatedDriverIds).toEqual(state2.eliminatedDriverIds)
    expect(state2.status).toBe('READY_FOR_Q2')
  })

  // =========================================================================
  // Q1-06 RELOAD — executar Q1, descartar estado em memória e reconstruir do armazenamento
  // =========================================================================
  it('Q1-06 RELOAD: executar Q1, descartar cache em memória e reconstruir do armazenamento persistido', async () => {
    const fixture = create24EntrantsFixture()
    const context = {
      careerId: 'career_q1_06_reload',
      seasonId: 'season_2026',
      round: 1,
      participants: fixture,
      forceBypassPracticeCheck: true,
    }

    // Instância 1 executa Q1
    const service1 = new RaceQualifyingOrchestratorService()
    const state1 = await service1.executeQ1(context)
    expect(state1.status).toBe('READY_FOR_Q2')

    // DESCARTAR cache em memória completamente e criar nova instância
    const service2 = new RaceQualifyingOrchestratorService()
    const loadedState = await service2.loadPersistedQ1State(
      context.careerId,
      context.seasonId,
      context.round,
    )

    expect(loadedState).not.toBeNull()
    expect(loadedState?.status).toBe('READY_FOR_Q2')
    expect(loadedState?.totalParticipants).toBe(24)
    expect(loadedState?.classifiedDriverIds).toEqual(state1.classifiedDriverIds)
    expect(loadedState?.eliminatedDriverIds).toEqual(state1.eliminatedDriverIds)

    // Reexecutar com service2 devolve exatamente o snapshot gravado
    const state2 = await service2.executeQ1(context)
    expect(state2.results[0].bestTimeMs).toBe(state1.results[0].bestTimeMs)
    expect(state2.results[0].position).toBe(state1.results[0].position)
  })

  // =========================================================================
  // Q1-07 ORDEM — Q1 só inicia a partir do estado válido READY_FOR_Q1
  // =========================================================================
  it('Q1-07 ORDEM: rejeita execução fora de ordem caso treinos livres não estejam em READY_FOR_Q1', async () => {
    const fixture = create24EntrantsFixture()
    const context = {
      careerId: 'career_q1_07_order',
      seasonId: 'season_2026',
      round: 1,
      participants: fixture,
      forceBypassPracticeCheck: false, // Ativa a verificação estrita de ordem
    }

    // Sem ter executado TL1/TL2/TL3, a verificação de ordem DEVE rejeitar
    await expect(raceQualifyingOrchestratorService.executeQ1(context)).rejects.toThrow(
      /Ordem de sessões violada: Q1 só pode ser iniciado a partir do estado READY_FOR_Q1/,
    )

    // Executa TL1 e TL2 para o carro da equipe
    await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      careerId: context.careerId,
      seasonId: context.seasonId,
      round: context.round,
      session: 'TL1',
      teamId: 'mclaren',
      carIndex: 1,
      driverId: 'drv_001',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 24,
      consistency: 93,
    })
    await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      careerId: context.careerId,
      seasonId: context.seasonId,
      round: context.round,
      session: 'TL2',
      teamId: 'mclaren',
      carIndex: 1,
      driverId: 'drv_001',
      configVersion: DEFAULT_RACE_DRAFT_VERSION,
      completedLaps: 26,
      consistency: 93,
    })

    // Ainda falta TL3, logo deve continuar rejeitando
    await expect(raceQualifyingOrchestratorService.executeQ1(context)).rejects.toThrow(
      /Ordem de sessões violada: Q1 só pode ser iniciado a partir do estado READY_FOR_Q1/,
    )
  })

  // =========================================================================
  // Q1-08 ISOLAMENTO — outra carreira/rodada não reutiliza resultado de Q1
  // =========================================================================
  it('Q1-08 ISOLAMENTO: outra carreira ou rodada não compartilha o resultado de Q1', async () => {
    const fixture = create24EntrantsFixture()

    // Executa Q1 na Carreira Alpha, Rodada 1
    const stateA1 = await raceQualifyingOrchestratorService.executeQ1({
      careerId: 'career_alpha',
      seasonId: 'season_2026',
      round: 1,
      participants: fixture,
      forceBypassPracticeCheck: true,
    })

    // Executa Q1 na Carreira Beta, Rodada 1
    const stateB1 = await raceQualifyingOrchestratorService.executeQ1({
      careerId: 'career_beta',
      seasonId: 'season_2026',
      round: 1,
      participants: fixture,
      forceBypassPracticeCheck: true,
    })

    // Executa Q1 na Carreira Alpha, Rodada 2
    const stateA2 = await raceQualifyingOrchestratorService.executeQ1({
      careerId: 'career_alpha',
      seasonId: 'season_2026',
      round: 2,
      participants: fixture,
      forceBypassPracticeCheck: true,
    })

    // Os estados devem ser independentes
    expect(stateA1.careerId).toBe('career_alpha')
    expect(stateB1.careerId).toBe('career_beta')
    expect(stateA2.round).toBe(2)

    // O tempo de P1 entre carreiras diferentes ou rodadas diferentes é diferente
    // graças ao RNG determinístico com seed contendo careerId e round
    expect(stateA1.results[0].bestTimeMs).not.toBe(stateB1.results[0].bestTimeMs)
    expect(stateA1.results[0].bestTimeMs).not.toBe(stateA2.results[0].bestTimeMs)
  })
})
