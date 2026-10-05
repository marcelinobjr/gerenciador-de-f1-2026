/**
 * pu-05a2-p3-b1-r-authoritative-backend.test.ts
 *
 * Suíte de Homologação PU-05A2-P3-B1-R:
 * Débito e confirmação persistentes sem duplicação (idempotência autoritativa no backend)
 *
 * TESTES EXIGIDOS NA SEÇÃO 5:
 * A. SEM MEMÓRIA LOCAL:
 *    - Aplicar, descartar completamente o journal/cache local e repetir com novo cliente
 *      sobre o mesmo backend: nenhum novo débito e status ALREADY_APPLIED.
 * B. RESPOSTA PERDIDA:
 *    - Gravação autoritativa concluída no backend, chamador recebe falha antes de atualizar cache local;
 *      repetir: resultado persistido inalterado, não duplica débito.
 * C. CLIENTES INDEPENDENTES:
 *    - Duas chamadas para o mesmo efeito sem compartilhar a trava local resultam em uma única aplicação.
 * D. RETOMADA PARCIAL:
 *    - Primeira unidade aplicada, segunda falha; retomar sem estado local anterior:
 *      primeira sem novo débito, segunda concluída.
 * E. EFEITOS DIFERENTES:
 *    - Sprint e principal da mesma rodada aplicadas uma vez cada, sem sobrescrever o uso registrado pela outra.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  CanonicalPowerUnitUsageApplierService,
  canonicalPowerUnitUsageApplierService,
} from '@/services/canonicalPowerUnitUsageApplierService'
import { projectSessionPowerUnitUsage } from '@/services/canonicalPowerUnitUsageProjectionService'
import type { TeamModel } from '@/types/f1'
import type { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'

function createMockTeam(teamId: string = 'team_audi'): TeamModel {
  return {
    id: teamId,
    name: 'Audi F1 Team',
    color: '#C00000',
    chassis_level: 80,
    aero_level: 80,
    strategy_level: 80,
    budget: 100000000,
    engine_pool_used: 4,
    engine_supplier: 'Audi',
    active_engine_wear: 10,
    engine_history: [
      {
        id: 1,
        wear: 10,
        status: 'instalado',
        supplier: 'Audi',
        introducedRound: 1,
        condition: 90,
        mileage_km: 500,
      },
      {
        id: 2,
        wear: 20,
        status: 'instalado',
        supplier: 'Audi',
        introducedRound: 1,
        condition: 80,
        mileage_km: 800,
      },
      {
        id: 3,
        wear: 5,
        status: 'reserva',
        supplier: 'Audi',
        introducedRound: 2,
        condition: 95,
        mileage_km: 150,
      },
    ],
  }
}

function createMockDriver(
  overrides: Partial<CanonicalRaceDriverState> = {},
): CanonicalRaceDriverState {
  return {
    careerId: 'career_auth_test_01',
    season: 2026,
    raceId: 'race_auth_s2026_r1',
    driverId: 'player_drv_1',
    driverName: 'Piloto 1',
    teamId: 'team_audi',
    teamName: 'Audi F1 Team',
    teamColor: '#C00000',
    isPlayer: true,
    gridPosition: 1,
    currentPosition: 1,
    lap: 50,
    raceTime: 4500.0,
    gap: 'LÍDER',
    tyreCompound: 'medio',
    tyreAge: 15,
    fuel: 30,
    carCondition: 90,
    raceStatus: 'racing',
    pitStops: 1,
    powerUnitId: 1,
    powerUnitInitialCondition: 90,
    powerUnitCondition: 80, // Débito = 10%
    ...overrides,
  }
}

function createMockRaceState(overrides: Partial<CanonicalRaceState> = {}): CanonicalRaceState {
  const driver1 = createMockDriver({
    driverId: 'player_drv_1',
    driverName: 'Piloto 1',
    carId: 'car1',
    powerUnitId: 1,
    powerUnitInitialCondition: 90,
    powerUnitCondition: 80, // Débito = 10%
    lap: 50, // 50 voltas * 5 km = 250 km
  })

  const driver2 = createMockDriver({
    driverId: 'player_drv_2',
    driverName: 'Piloto 2',
    carId: 'car2',
    powerUnitId: 2,
    powerUnitInitialCondition: 80,
    powerUnitCondition: 75, // Débito = 5%
    lap: 25, // 25 voltas * 5 km = 125 km
    raceStatus: 'dnf',
    isDnf: true,
  })

  return {
    version: '2.0',
    saveSchemaVersion: 'race-save-v1',
    raceVariant: 'MAIN_RACE',
    careerId: 'career_auth_test_01',
    season: 2026,
    round: 1,
    raceId: 'race_auth_s2026_r1',
    circuitName: 'Circuito Teste GP',
    circuitCountry: 'Bahrein',
    circuitLengthKm: 5.0,
    totalLaps: 50,
    currentLap: 50,
    status: 'completed',
    safetyCarActive: false,
    vscActive: false,
    redFlagActive: false,
    weather: 'seco',
    simSpeed: 1,
    drivers: [driver1, driver2],
    driverLookup: {
      player_drv_1: driver1,
      player_drv_2: driver2,
    },
    playerTeamId: 'team_audi',
    tactics: {},
    paceOrders: {},
    revision: 50,
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('PU-05A2-P3-B1-R: Idempotência Autoritativa no Backend (Provas Reais A–E)', () => {
  beforeEach(() => {
    canonicalPowerUnitUsageApplierService.clearJournalCache()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
    vi.restoreAllMocks()
  })

  // =========================================================================
  // TESTE A: SEM MEMÓRIA LOCAL
  // =========================================================================
  describe('A. SEM MEMÓRIA LOCAL: descarte de journal/cache local e novo cliente', () => {
    it('quando o cache local é completamente descartado, um novo cliente reconhece o backend autoritativo e não duplica débito', async () => {
      const team = createMockTeam('team_audi')
      const raceState = createMockRaceState()
      const projectionReport = projectSessionPowerUnitUsage(raceState)

      // Simular persistência no backend PocketBase
      const mockBackendJournalStore: Record<string, any> = {}
      const journalKey = `apex_gp_pu_usage_journal_${raceState.careerId}_s${raceState.season}_r${raceState.round}_main`

      // Espiar pb.collection
      vi.spyOn(pb, 'collection').mockImplementation((collName: string) => {
        if (collName === 'power_unit_usage_journals') {
          return {
            getFirstListItem: vi.fn(async (filter: string) => {
              if (mockBackendJournalStore[journalKey]) {
                return mockBackendJournalStore[journalKey]
              }
              throw new Error('Not found')
            }),
            create: vi.fn(async (data: any) => {
              const rec = {
                id: 'journal_rec_1',
                ...data,
                created: '2026-03-10T12:00:00Z',
                updated: '2026-03-10T12:00:00Z',
              }
              mockBackendJournalStore[journalKey] = rec
              return rec
            }),
            update: vi.fn(async (id: string, data: any) => {
              mockBackendJournalStore[journalKey] = {
                ...mockBackendJournalStore[journalKey],
                ...data,
                updated: '2026-03-10T12:01:00Z',
              }
              return mockBackendJournalStore[journalKey]
            }),
          } as any
        }
        if (collName === 'teams') {
          return {
            getOne: vi.fn(async () => ({ ...team })),
            update: vi.fn(async (id: string, data: any) => {
              Object.assign(team, data)
              return { ...team }
            }),
          } as any
        }
        return {} as any
      })

      // 1. Aplicação inicial
      const client1 = new CanonicalPowerUnitUsageApplierService()
      const res1 = await client1.applySessionPowerUnitUsage(projectionReport, {
        teamOverrides: { team_audi: team },
      })

      expect(res1.status).toBe('SUCCESS')
      expect(res1.appliedCount).toBe(2)

      const u1Mid = { ...team.engine_history?.find((e) => e.id === 1)! }
      const u2Mid = { ...team.engine_history?.find((e) => e.id === 2)! }
      expect(u1Mid.mileage_km).toBe(750)
      expect(u1Mid.condition).toBe(80)

      // 2. DESCARTAR TOTALMENTE MEMÓRIA E LOCALSTORAGE DO CLIENTE
      client1.clearJournalCache()
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear()
        expect(window.localStorage.getItem(journalKey)).toBeNull()
      }

      // 3. NOVO CLIENTE (sem qualquer cache anterior)
      const client2 = new CanonicalPowerUnitUsageApplierService()
      expect(
        client2.getLocalJournalCache(
          raceState.careerId,
          raceState.season,
          raceState.round,
          'MAIN_RACE',
        ),
      ).toBeNull()

      const res2 = await client2.applySessionPowerUnitUsage(projectionReport, {
        teamOverrides: { team_audi: team },
      })

      // Deve reconhecer a autoridade do backend e retornar ALREADY_APPLIED sem novo débito
      expect(res2.status).toBe('ALREADY_APPLIED')
      expect(res2.appliedCount).toBe(0)
      expect(res2.alreadyAppliedCount).toBe(2)

      const u1Final = team.engine_history?.find((e) => e.id === 1)
      const u2Final = team.engine_history?.find((e) => e.id === 2)
      expect(u1Final?.mileage_km).toBe(u1Mid.mileage_km)
      expect(u1Final?.condition).toBe(u1Mid.condition)
      expect(u2Final?.mileage_km).toBe(u2Mid.mileage_km)
      expect(u2Final?.condition).toBe(u2Mid.condition)
    })
  })

  // =========================================================================
  // TESTE B: RESPOSTA PERDIDA
  // =========================================================================
  describe('B. RESPOSTA PERDIDA: gravação concluída no backend mas cliente falhou antes do cache', () => {
    it('se o backend concluiu o débito e o cliente foi desconectado antes de salvar cache local, na repetição o inventário fica inalterado', async () => {
      const team = createMockTeam('team_audi')
      const raceState = createMockRaceState()
      const projectionReport = projectSessionPowerUnitUsage(raceState)
      const journalKey = `apex_gp_pu_usage_journal_${raceState.careerId}_s${raceState.season}_r${raceState.round}_main`

      // Backend já possui a aplicação persistida como COMPLETE
      const mockBackendJournalStore: Record<string, any> = {
        [journalKey]: {
          id: 'journal_rec_complete',
          journal_key: journalKey,
          career_id: raceState.careerId,
          season: raceState.season,
          round: raceState.round,
          race_variant: 'MAIN_RACE',
          session_key: raceState.raceId,
          status: 'COMPLETE',
          applied_unit_ids: [1, 2],
          applied_driver_ids: ['player_drv_1', 'player_drv_2'],
          created: '2026-03-10T12:00:00Z',
          updated: '2026-03-10T12:00:05Z',
        },
      }

      vi.spyOn(pb, 'collection').mockImplementation((collName: string) => {
        if (collName === 'power_unit_usage_journals') {
          return {
            getFirstListItem: vi.fn(async (filter: string) => {
              if (mockBackendJournalStore[journalKey]) {
                return mockBackendJournalStore[journalKey]
              }
              throw new Error('Not found')
            }),
          } as any
        }
        if (collName === 'teams') {
          return {
            getOne: vi.fn(async () => ({ ...team })),
            update: vi.fn(async (id: string, data: any) => {
              Object.assign(team, data)
              return { ...team }
            }),
          } as any
        }
        return {} as any
      })

      // Simulação: o localStorage local do cliente está VAZIO (resposta anterior se perdeu na rede)
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear()
      }

      const client = new CanonicalPowerUnitUsageApplierService()
      const res = await client.applySessionPowerUnitUsage(projectionReport, {
        teamOverrides: { team_audi: team },
      })

      expect(res.status).toBe('ALREADY_APPLIED')
      expect(res.appliedCount).toBe(0)
      expect(res.alreadyAppliedCount).toBe(2)

      // Inventário permaneceu exatamente inalterado
      const u1 = team.engine_history?.find((e) => e.id === 1)
      const u2 = team.engine_history?.find((e) => e.id === 2)
      expect(u1?.mileage_km).toBe(500)
      expect(u1?.condition).toBe(90)
      expect(u2?.mileage_km).toBe(800)
      expect(u2?.condition).toBe(80)
    })
  })

  // =========================================================================
  // TESTE C: CLIENTES INDEPENDENTES
  // =========================================================================
  describe('C. CLIENTES INDEPENDENTES: duas instâncias sem compartilhar trava local', () => {
    it('duas instâncias separadas chamando o mesmo efeito resultam em uma única aplicação com proteção no backend', async () => {
      const team = createMockTeam('team_audi')
      const raceState = createMockRaceState()
      const projectionReport = projectSessionPowerUnitUsage(raceState)
      const journalKey = `apex_gp_pu_usage_journal_${raceState.careerId}_s${raceState.season}_r${raceState.round}_main`

      let backendJournal: any = null

      // Simulação atômica de backend (se já existe, create lança erro de duplicidade como o PocketBase faz)
      vi.spyOn(pb, 'collection').mockImplementation((collName: string) => {
        if (collName === 'power_unit_usage_journals') {
          return {
            getFirstListItem: vi.fn(async (filter: string) => {
              if (backendJournal) return backendJournal
              throw new Error('Not found')
            }),
            create: vi.fn(async (data: any) => {
              if (backendJournal) {
                const err: any = new Error('Unique constraint violated')
                err.status = 400
                throw err
              }
              backendJournal = {
                id: 'journal_backend_1',
                ...data,
                created: '2026-03-10T12:00:00Z',
                updated: '2026-03-10T12:00:00Z',
              }
              return backendJournal
            }),
            update: vi.fn(async (id: string, data: any) => {
              backendJournal = { ...backendJournal, ...data, updated: '2026-03-10T12:00:01Z' }
              return backendJournal
            }),
          } as any
        }
        if (collName === 'teams') {
          return {
            getOne: vi.fn(async () => ({ ...team })),
            update: vi.fn(async (id: string, data: any) => {
              Object.assign(team, data)
              return { ...team }
            }),
          } as any
        }
        return {} as any
      })

      // Dois clientes independentes instanciados separadamente
      const clientA = new CanonicalPowerUnitUsageApplierService()
      const clientB = new CanonicalPowerUnitUsageApplierService()

      // Executar sequencialmente simulando dois clientes remotos chegando um após o outro
      const resA = await clientA.applySessionPowerUnitUsage(projectionReport, {
        teamOverrides: { team_audi: team },
      })
      const resB = await clientB.applySessionPowerUnitUsage(projectionReport, {
        teamOverrides: { team_audi: team },
      })

      expect(resA.status).toBe('SUCCESS')
      expect(resA.appliedCount).toBe(2)

      expect(resB.status).toBe('ALREADY_APPLIED')
      expect(resB.appliedCount).toBe(0)
      expect(resB.alreadyAppliedCount).toBe(2)

      // Inventário foi incrementado uma única vez
      const u1 = team.engine_history?.find((e) => e.id === 1)
      expect(u1?.mileage_km).toBe(750)
      expect(u1?.condition).toBe(80)
    })
  })

  // =========================================================================
  // TESTE D: RETOMADA PARCIAL SEM ESTADO LOCAL
  // =========================================================================
  describe('D. RETOMADA PARCIAL: primeira unidade aplicada, segunda falhou; retomar sem cache local', () => {
    it('retoma a partir do estado parcial do backend sem estado local anterior e não duplica a primeira unidade', async () => {
      const team = createMockTeam('team_audi')
      const raceState = createMockRaceState()
      const projectionReport = projectSessionPowerUnitUsage(raceState)
      const journalKey = `apex_gp_pu_usage_journal_${raceState.careerId}_s${raceState.season}_r${raceState.round}_main`

      // Backend possui estado PARTIAL com unidade 1 já aplicada
      let backendJournal: any = {
        id: 'journal_rec_partial',
        journal_key: journalKey,
        career_id: raceState.careerId,
        season: raceState.season,
        round: raceState.round,
        race_variant: 'MAIN_RACE',
        session_key: raceState.raceId,
        status: 'PARTIAL',
        applied_unit_ids: [1],
        applied_driver_ids: ['player_drv_1'],
        created: '2026-03-10T12:00:00Z',
        updated: '2026-03-10T12:00:02Z',
      }

      // PU-1 já recebeu o débito no team (500 -> 750 km, 90 -> 80 cond)
      team.engine_history![0].mileage_km = 750
      team.engine_history![0].condition = 80
      team.engine_history![0].wear = 20

      // PU-2 ainda está intocada (800 km, 80 cond)
      expect(team.engine_history![1].mileage_km).toBe(800)
      expect(team.engine_history![1].condition).toBe(80)

      vi.spyOn(pb, 'collection').mockImplementation((collName: string) => {
        if (collName === 'power_unit_usage_journals') {
          return {
            getFirstListItem: vi.fn(async (filter: string) => backendJournal),
            update: vi.fn(async (id: string, data: any) => {
              backendJournal = { ...backendJournal, ...data }
              return backendJournal
            }),
          } as any
        }
        if (collName === 'teams') {
          return {
            getOne: vi.fn(async () => ({ ...team })),
            update: vi.fn(async (id: string, data: any) => {
              Object.assign(team, data)
              return { ...team }
            }),
          } as any
        }
        return {} as any
      })

      // Novo cliente sem cache local
      const client = new CanonicalPowerUnitUsageApplierService()
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear()
      }

      const res = await client.applySessionPowerUnitUsage(projectionReport, {
        teamOverrides: { team_audi: team },
      })

      expect(res.status).toBe('SUCCESS')
      expect(res.appliedCount).toBe(1) // Apenas a unidade 2 foi debitada
      expect(res.alreadyAppliedCount).toBe(1) // Unidade 1 reconhecida pelo backend

      // PU-1 permaneceu sem novo débito
      const u1 = team.engine_history?.find((e) => e.id === 1)
      expect(u1?.mileage_km).toBe(750)
      expect(u1?.condition).toBe(80)

      // PU-2 foi completada: 800 + 125 = 925 km, cond: 80 - 5 = 75
      const u2 = team.engine_history?.find((e) => e.id === 2)
      expect(u2?.mileage_km).toBe(925)
      expect(u2?.condition).toBe(75)

      // Backend atualizado para COMPLETE com ambas as unidades
      expect(backendJournal.status).toBe('COMPLETE')
      expect(backendJournal.applied_unit_ids).toEqual([1, 2])
    })
  })

  // =========================================================================
  // TESTE E: EFEITOS DIFERENTES (SPRINT E PRINCIPAL)
  // =========================================================================
  describe('E. EFEITOS DIFERENTES: Sprint e Principal na mesma rodada com backend persistente', () => {
    it('aplica Sprint e Principal independentemente no backend sem que uma sobrescreva ou anule a outra', async () => {
      const team = createMockTeam('team_audi')
      const backendStore: Record<string, any> = {}

      vi.spyOn(pb, 'collection').mockImplementation((collName: string) => {
        if (collName === 'power_unit_usage_journals') {
          return {
            getFirstListItem: vi.fn(async (filter: string) => {
              for (const key of Object.keys(backendStore)) {
                if (filter.includes(key)) {
                  return backendStore[key]
                }
              }
              throw new Error('Not found')
            }),
            create: vi.fn(async (data: any) => {
              backendStore[data.journal_key] = { id: `id_${data.journal_key}`, ...data }
              return backendStore[data.journal_key]
            }),
            update: vi.fn(async (id: string, data: any) => {
              for (const key of Object.keys(backendStore)) {
                if (backendStore[key].id === id) {
                  backendStore[key] = { ...backendStore[key], ...data }
                  return backendStore[key]
                }
              }
              return data
            }),
          } as any
        }
        if (collName === 'teams') {
          return {
            getOne: vi.fn(async () => ({ ...team })),
            update: vi.fn(async (id: string, data: any) => {
              Object.assign(team, data)
              return { ...team }
            }),
          } as any
        }
        return {} as any
      })

      // 1. Aplicar Sprint
      const sprintState = createMockRaceState({
        raceVariant: 'SPRINT_RACE',
        totalLaps: 15,
        currentLap: 15,
        drivers: [
          createMockDriver({
            driverId: 'player_drv_1',
            carId: 'car1',
            powerUnitId: 1,
            powerUnitInitialCondition: 90,
            powerUnitCondition: 87, // 3% desgaste
            lap: 15, // 15 * 5 = 75 km
          }),
        ],
      })
      const sprintReport = projectSessionPowerUnitUsage(sprintState)

      const client = new CanonicalPowerUnitUsageApplierService()
      const sprintRes = await client.applySessionPowerUnitUsage(sprintReport, {
        teamOverrides: { team_audi: team },
      })

      expect(sprintRes.status).toBe('SUCCESS')
      const u1AfterSprint = team.engine_history?.find((e) => e.id === 1)
      expect(u1AfterSprint?.mileage_km).toBe(575)
      expect(u1AfterSprint?.condition).toBe(87)

      // 2. Aplicar Corrida Principal na mesma rodada
      const mainState = createMockRaceState({
        raceVariant: 'MAIN_RACE',
        totalLaps: 50,
        currentLap: 50,
        drivers: [
          createMockDriver({
            driverId: 'player_drv_1',
            carId: 'car1',
            powerUnitId: 1,
            powerUnitInitialCondition: 87,
            powerUnitCondition: 77, // 10% desgaste
            lap: 50, // 50 * 5 = 250 km
          }),
        ],
      })
      const mainReport = projectSessionPowerUnitUsage(mainState)

      const mainRes = await client.applySessionPowerUnitUsage(mainReport, {
        teamOverrides: { team_audi: team },
      })

      expect(mainRes.status).toBe('SUCCESS')
      const u1AfterMain = team.engine_history?.find((e) => e.id === 1)
      expect(u1AfterMain?.mileage_km).toBe(575 + 250) // 825 km
      expect(u1AfterMain?.condition).toBe(77)

      // Confirmar que ambos os registros coexistem no backend
      const sprintKey = client.buildJournalKey('career_auth_test_01', 2026, 1, 'SPRINT_RACE')
      const mainKey = client.buildJournalKey('career_auth_test_01', 2026, 1, 'MAIN_RACE')

      expect(backendStore[sprintKey]).toBeDefined()
      expect(backendStore[sprintKey].status).toBe('COMPLETE')
      expect(backendStore[mainKey]).toBeDefined()
      expect(backendStore[mainKey].status).toBe('COMPLETE')
      expect(sprintKey).not.toBe(mainKey)
    })
  })
})
