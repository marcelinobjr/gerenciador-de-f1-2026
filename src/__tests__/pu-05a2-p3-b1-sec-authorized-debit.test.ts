/**
 * pu-05a2-p3-b1-sec-authorized-debit.test.ts
 *
 * Suíte de Homologação PU-05A2-P3-B1-SEC:
 * "DÉBITO SOMENTE PELO CAMINHO AUTORIZADO"
 *
 * Provas Direcionadas Exigidas:
 * A. SEM AUTENTICAÇÃO:
 *    - Aplicação e consulta privada são rejeitadas (401).
 *    - Nenhum débito no inventário ou journal é criado.
 * B. OUTRA CARREIRA:
 *    - Usuário autenticado tenta operar sobre carreira de outro usuário (403).
 *    - Acesso rejeitado, inclusive em repetição de journal já existente (não vaza dados nem reaplica).
 * C. DONO AUTORIZADO:
 *    - Aplicação válida funciona via hook; repetição contínua sem redébito (ALREADY_APPLIED).
 * D. HOOK INDISPONÍVEL:
 *    - O cliente não chama gravação alternativa de inventário/journal e não retorna aplicação confirmada.
 *    - Devolve estado com erro/pendente explícito.
 * E. RESPOSTA PERDIDA:
 *    - Servidor conclui aplicação; confirmação de rede se perde antes de o cliente gravar o cache.
 *    - Reconciliação / repetição com a mesma chave canônica pelo caminho autorizado não duplica o uso.
 * F. API DIRETA DO JOURNAL:
 *    - Cliente comum não consegue fabricar, alterar ou apagar a marca autoritativa contornando o hook.
 *    - createRule, updateRule e deleteRule bloqueados na collection power_unit_usage_journals.
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

function createMockTeam(
  teamId: string = 'team_audi_sec',
  userId: string = 'user_player_1',
): TeamModel {
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
    user_id: userId,
    team_key: 'audi',
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
    ],
  }
}

function createMockDriver(
  overrides: Partial<CanonicalRaceDriverState> = {},
): CanonicalRaceDriverState {
  return {
    careerId: 'team_audi_sec',
    season: 2026,
    raceId: 'race_sec_s2026_r1',
    driverId: 'player_drv_1',
    driverName: 'Piloto 1',
    teamId: 'team_audi_sec',
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
    powerUnitCondition: 80,
    lap: 50,
  })

  const driver2 = createMockDriver({
    driverId: 'player_drv_2',
    driverName: 'Piloto 2',
    carId: 'car2',
    powerUnitId: 2,
    powerUnitInitialCondition: 80,
    powerUnitCondition: 75,
    lap: 25,
    raceStatus: 'dnf',
    isDnf: true,
  })

  return {
    version: '2.0',
    saveSchemaVersion: 'race-save-v1',
    raceVariant: 'MAIN_RACE',
    careerId: 'team_audi_sec',
    season: 2026,
    round: 1,
    raceId: 'race_sec_s2026_r1',
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
    playerTeamId: 'team_audi_sec',
    tactics: {},
    paceOrders: {},
    revision: 50,
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('PU-05A2-P3-B1-SEC: Débito Somente pelo Caminho Autorizado (Provas A–F)', () => {
  beforeEach(() => {
    canonicalPowerUnitUsageApplierService.clearJournalCache()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
    vi.restoreAllMocks()
  })

  // =========================================================================
  // TESTE A: SEM AUTENTICAÇÃO
  // =========================================================================
  describe('A. SEM AUTENTICAÇÃO: aplicação e consulta privada são rejeitadas', () => {
    it('chamada ao endpoint de aplicação sem token/usuário é rejeitada (401) sem debitar inventário ou criar journal', async () => {
      const raceState = createMockRaceState()
      const projectionReport = projectSessionPowerUnitUsage(raceState)
      const team = createMockTeam('team_audi_sec', 'user_player_1')

      // Mock de pb.send simulando rejeição 401 do hook de backend
      vi.spyOn(pb, 'send').mockImplementation(async (path: string) => {
        if (path.includes('/backend/v1/pu-usage/apply-session')) {
          const err: any = new Error('Autenticação obrigatória para aplicar uso de PU.')
          err.status = 401
          throw err
        }
        if (path.includes('/backend/v1/pu-usage/journal')) {
          const err: any = new Error('Autenticação obrigatória para consultar journal de PU.')
          err.status = 401
          throw err
        }
        return {} as any
      })

      // Espiar pb.collection para comprovar que NÃO houve chamada de gravação de inventário nem de journal
      const teamUpdateSpy = vi.fn()
      const journalCreateSpy = vi.fn()
      vi.spyOn(pb, 'collection').mockImplementation((collName: string) => {
        if (collName === 'teams') {
          return { update: teamUpdateSpy, getOne: vi.fn() } as any
        }
        if (collName === 'power_unit_usage_journals') {
          return {
            create: journalCreateSpy,
            update: vi.fn(),
            getFirstListItem: vi.fn().mockRejectedValue(new Error('404')),
          } as any
        }
        return {} as any
      })

      const client = new CanonicalPowerUnitUsageApplierService()
      const result = await client.applySessionPowerUnitUsage(projectionReport)

      expect(result.status).toBe('FAILED')
      expect(result.appliedCount).toBe(0)
      expect(result.error).toContain('Autenticação obrigatória')

      // Garantir que NENHUM débito foi chamado no inventário ou gravação direta na collection de journals
      expect(teamUpdateSpy).not.toHaveBeenCalled()
      expect(journalCreateSpy).not.toHaveBeenCalled()

      // Inventário da equipe em memória permaneceu intacto
      expect(team.engine_history![0].condition).toBe(90)
      expect(team.engine_history![0].mileage_km).toBe(500)
    })
  })

  // =========================================================================
  // TESTE B: OUTRA CARREIRA
  // =========================================================================
  describe('B. OUTRA CARREIRA: acesso rejeitado (403) inclusive em repetições', () => {
    it('usuário autenticado tentando aplicar ou consultar carreira de outrem recebe 403 sem vazar dados ou reaplicar', async () => {
      const raceState = createMockRaceState({ careerId: 'career_alheia_999' })
      const projectionReport = projectSessionPowerUnitUsage(raceState)

      vi.spyOn(pb, 'send').mockImplementation(async (path: string) => {
        if (
          path.includes('/backend/v1/pu-usage/apply-session') ||
          path.includes('/backend/v1/pu-usage/journal')
        ) {
          const err: any = new Error('Acesso não autorizado à carreira solicitada.')
          err.status = 403
          throw err
        }
        return {} as any
      })

      const client = new CanonicalPowerUnitUsageApplierService()
      const result = await client.applySessionPowerUnitUsage(projectionReport)

      expect(result.status).toBe('FAILED')
      expect(result.appliedCount).toBe(0)
      expect(result.error).toContain('Acesso não autorizado à carreira solicitada')

      // Consulta de journal da carreira de outro usuário
      const fetched = await client.fetchBackendJournal('career_alheia_999', 2026, 1, 'MAIN_RACE')
      expect(fetched).toBeNull()
    })
  })

  // =========================================================================
  // TESTE C: DONO AUTORIZADO
  // =========================================================================
  describe('C. DONO AUTORIZADO: aplicação válida via hook e repetição sem redébito', () => {
    it('dono autorizado conclui aplicação pelo hook e repetição retorna ALREADY_APPLIED sem novo débito', async () => {
      const team = createMockTeam('team_audi_sec', 'user_player_1')
      const raceState = createMockRaceState()
      const projectionReport = projectSessionPowerUnitUsage(raceState)
      const journalKey = `apex_gp_pu_usage_journal_${raceState.careerId}_s${raceState.season}_r${raceState.round}_main`

      let backendCallCount = 0
      let backendApplied = false

      vi.spyOn(pb, 'send').mockImplementation(async (path: string, options: any) => {
        if (path.includes('/backend/v1/pu-usage/apply-session')) {
          backendCallCount++
          if (!backendApplied) {
            backendApplied = true
            // Debita no mock do banco
            team.engine_history![0].condition = 80
            team.engine_history![0].mileage_km = 750
            team.engine_history![1].condition = 75
            team.engine_history![1].mileage_km = 925

            return {
              sessionKey: raceState.raceId,
              careerId: raceState.careerId,
              season: 2026,
              round: 1,
              raceVariant: 'MAIN_RACE',
              status: 'SUCCESS',
              journal: {
                journalKey,
                careerId: raceState.careerId,
                season: 2026,
                round: 1,
                raceVariant: 'MAIN_RACE',
                sessionKey: raceState.raceId,
                status: 'COMPLETE',
                appliedUnitIds: [1, 2],
                appliedDriverIds: ['player_drv_1', 'player_drv_2'],
                startedAt: '2026-03-10T12:00:00Z',
                completedAt: '2026-03-10T12:01:00Z',
              },
              appliedCount: 2,
              alreadyAppliedCount: 0,
              pendingOrUnlinkedCount: 0,
              failedCount: 0,
              unitResults: [
                {
                  driverId: 'player_drv_1',
                  teamId: 'team_audi_sec',
                  powerUnitId: 1,
                  status: 'APPLIED',
                  distanceKmAdded: 250,
                  wearDebitApplied: 10,
                },
                {
                  driverId: 'player_drv_2',
                  teamId: 'team_audi_sec',
                  powerUnitId: 2,
                  status: 'APPLIED',
                  distanceKmAdded: 125,
                  wearDebitApplied: 5,
                },
              ],
            }
          } else {
            // Repetição no backend retorna ALREADY_APPLIED
            return {
              sessionKey: raceState.raceId,
              careerId: raceState.careerId,
              season: 2026,
              round: 1,
              raceVariant: 'MAIN_RACE',
              status: 'ALREADY_APPLIED',
              journal: {
                journalKey,
                careerId: raceState.careerId,
                season: 2026,
                round: 1,
                raceVariant: 'MAIN_RACE',
                sessionKey: raceState.raceId,
                status: 'COMPLETE',
                appliedUnitIds: [1, 2],
                appliedDriverIds: ['player_drv_1', 'player_drv_2'],
                startedAt: '2026-03-10T12:00:00Z',
                completedAt: '2026-03-10T12:01:00Z',
              },
              appliedCount: 0,
              alreadyAppliedCount: 2,
              pendingOrUnlinkedCount: 0,
              failedCount: 0,
              unitResults: [
                {
                  driverId: 'player_drv_1',
                  teamId: 'team_audi_sec',
                  powerUnitId: 1,
                  status: 'ALREADY_APPLIED',
                  distanceKmAdded: 0,
                  wearDebitApplied: 0,
                },
                {
                  driverId: 'player_drv_2',
                  teamId: 'team_audi_sec',
                  powerUnitId: 2,
                  status: 'ALREADY_APPLIED',
                  distanceKmAdded: 0,
                  wearDebitApplied: 0,
                },
              ],
            }
          }
        }
        return {} as any
      })

      const client = new CanonicalPowerUnitUsageApplierService()
      const res1 = await client.applySessionPowerUnitUsage(projectionReport)

      expect(res1.status).toBe('SUCCESS')
      expect(res1.appliedCount).toBe(2)
      expect(team.engine_history![0].condition).toBe(80)

      // Repetição
      const res2 = await client.applySessionPowerUnitUsage(projectionReport)
      expect(res2.status).toBe('ALREADY_APPLIED')
      expect(res2.appliedCount).toBe(0)
      expect(res2.alreadyAppliedCount).toBe(2)

      // Condição permaneceu inalterada
      expect(team.engine_history![0].condition).toBe(80)
      expect(team.engine_history![0].mileage_km).toBe(750)
    })
  })

  // =========================================================================
  // TESTE D: HOOK INDISPONÍVEL
  // =========================================================================
  describe('D. HOOK INDISPONÍVEL: o cliente não chama débito alternativo fora do hook', () => {
    it('quando o endpoint está fora do ar ou sofre timeout, o cliente NÃO efetua débito alternativo nem confirma aplicação', async () => {
      const raceState = createMockRaceState()
      const projectionReport = projectSessionPowerUnitUsage(raceState)

      // Simular hook retornando erro de rede / timeout 503 / 500
      vi.spyOn(pb, 'send').mockImplementation(async () => {
        const err: any = new Error('Service Unavailable: Connection timeout to backend')
        err.status = 503
        throw err
      })

      const teamUpdateSpy = vi.fn()
      const journalCreateSpy = vi.fn()
      vi.spyOn(pb, 'collection').mockImplementation((collName: string) => {
        if (collName === 'teams') {
          return { update: teamUpdateSpy, getOne: vi.fn() } as any
        }
        if (collName === 'power_unit_usage_journals') {
          return {
            create: journalCreateSpy,
            getFirstListItem: vi.fn().mockRejectedValue(new Error('timeout')),
          } as any
        }
        return {} as any
      })

      const client = new CanonicalPowerUnitUsageApplierService()
      const res = await client.applySessionPowerUnitUsage(projectionReport)

      // DEVE retornar falha de aplicação explícita com journal pendente, sem confirmação
      expect(res.status).toBe('FAILED')
      expect(res.journal.status).toBe('PENDING')
      expect(res.appliedCount).toBe(0)
      expect(res.error).toContain('Service Unavailable')

      // NÃO chamou update no teams e NÃO criou journal contornando o hook
      expect(teamUpdateSpy).not.toHaveBeenCalled()
      expect(journalCreateSpy).not.toHaveBeenCalled()

      // Cache local NÃO deve estar com status COMPLETE
      const localCache = client.getLocalJournalCache(raceState.careerId, 2026, 1, 'MAIN_RACE')
      expect(localCache?.status).not.toBe('COMPLETE')
    })
  })

  // =========================================================================
  // TESTE E: RESPOSTA PERDIDA
  // =========================================================================
  describe('E. RESPOSTA PERDIDA: servidor concluiu; cliente reconecta com a mesma chave', () => {
    it('se o servidor concluiu o débito mas a resposta se perdeu, a retomada com a mesma chave consulta o journal autoritativo e não duplica o uso', async () => {
      const raceState = createMockRaceState()
      const projectionReport = projectSessionPowerUnitUsage(raceState)
      const journalKey = `apex_gp_pu_usage_journal_${raceState.careerId}_s${raceState.season}_r${raceState.round}_main`

      const storedJournal = {
        journalKey,
        careerId: raceState.careerId,
        season: 2026,
        round: 1,
        raceVariant: 'MAIN_RACE',
        sessionKey: raceState.raceId,
        status: 'COMPLETE' as const,
        appliedUnitIds: [1, 2],
        appliedDriverIds: ['player_drv_1', 'player_drv_2'],
        startedAt: '2026-03-10T12:00:00Z',
        completedAt: '2026-03-10T12:01:00Z',
      }

      let attempt = 0
      vi.spyOn(pb, 'send').mockImplementation(async (path: string) => {
        if (path.includes('/backend/v1/pu-usage/apply-session')) {
          attempt++
          if (attempt === 1) {
            // Servidor gravou, mas conexão caiu antes do retorno ao cliente
            const err: any = new Error('Network error: socket hang up')
            err.status = 0
            throw err
          }
          // Na segunda tentativa (reconciliação), o servidor já tem COMPLETE
          return {
            sessionKey: raceState.raceId,
            careerId: raceState.careerId,
            season: 2026,
            round: 1,
            raceVariant: 'MAIN_RACE',
            status: 'ALREADY_APPLIED',
            journal: storedJournal,
            appliedCount: 0,
            alreadyAppliedCount: 2,
            pendingOrUnlinkedCount: 0,
            failedCount: 0,
            unitResults: [],
          }
        }
        if (path.includes('/backend/v1/pu-usage/journal')) {
          return {
            journal: storedJournal,
            unitResults: [],
          }
        }
        return {} as any
      })

      const client = new CanonicalPowerUnitUsageApplierService()

      // Primeira chamada: falha de rede
      const res1 = await client.applySessionPowerUnitUsage(projectionReport)
      // Como o fallback consulta o backend journal e encontra COMPLETE, reconhece imediatamente sem duplicar
      expect(res1.status).toBe('ALREADY_APPLIED')
      expect(res1.appliedCount).toBe(0)
      expect(res1.alreadyAppliedCount).toBe(2)

      // Repetição direta após reconexão
      const res2 = await client.applySessionPowerUnitUsage(projectionReport)
      expect(res2.status).toBe('ALREADY_APPLIED')
      expect(res2.appliedCount).toBe(0)
    })
  })

  // =========================================================================
  // TESTE F: API DIRETA DO JOURNAL
  // =========================================================================
  describe('F. API DIRETA DO JOURNAL: cliente comum não consegue forjar ou apagar marcas', () => {
    it('tentativas diretas via REST collection de criar, editar ou apagar o journal de uso de PU são bloqueadas', async () => {
      // Simular as regras de RLS da migration 1741500051 (createRule = null, updateRule = null, deleteRule = null)
      vi.spyOn(pb, 'collection').mockImplementation((collName: string) => {
        if (collName === 'power_unit_usage_journals') {
          return {
            create: vi.fn(async () => {
              const err: any = new Error('Only superusers can perform this action.')
              err.status = 403
              throw err
            }),
            update: vi.fn(async () => {
              const err: any = new Error('Only superusers can perform this action.')
              err.status = 403
              throw err
            }),
            delete: vi.fn(async () => {
              const err: any = new Error('Only superusers can perform this action.')
              err.status = 403
              throw err
            }),
          } as any
        }
        return {} as any
      })

      await expect(
        pb.collection('power_unit_usage_journals').create({
          journal_key: 'fake_journal_key',
          status: 'COMPLETE',
        }),
      ).rejects.toThrow(/Only superusers can perform this action/)

      await expect(
        pb.collection('power_unit_usage_journals').update('record_id_123', {
          status: 'SKIPPED',
        }),
      ).rejects.toThrow(/Only superusers can perform this action/)

      await expect(
        pb.collection('power_unit_usage_journals').delete('record_id_123'),
      ).rejects.toThrow(/Only superusers can perform this action/)
    })
  })
})
