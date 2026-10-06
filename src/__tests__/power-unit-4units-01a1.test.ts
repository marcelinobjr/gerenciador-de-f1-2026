/**
 * power-unit-4units-01a1.test.ts
 *
 * Microbloco POWER-UNIT-4UNITS-01A1:
 * - A1.1: Um piloto: inicializar numa temporada nova -> 4 unidades (unitNumber 1..4, mesmo driverId, mesmo seasonYear, IDs únicos).
 * - A1.2: Dois pilotos da mesma equipe -> 8 unidades totais (4 para cada, ambos unitNumber 1..4, IDs únicos).
 * - A1.3: Idempotência: executar inicialização duas vezes -> continua exatamente 8 unidades, nenhum ID novo, nenhum reset.
 * - A1.4: Estado existente preservado: alterar PU1 do piloto A para wear > 0, condition < 100, mileage > 0 -> valores intactos.
 * - A1.5: Unidade faltante: piloto possui PU1, PU2 e PU4, falta PU3 -> cria apenas PU3, preserva as demais, novo ID único (max+1).
 * - A1.6: Temporadas isoladas: mesmo piloto em 2026 e 2027 -> inventário 2026 = PU1..PU4; 2027 = PU1..PU4; nenhuma mistura.
 * - A1.7: Pilotos isolados: alterar unidade do piloto A -> inventário do piloto B inalterado.
 * - SEC-A: Inicialização / reload não duplica PU.
 * - SEC-F (parcial): Inventários de pilotos diferentes são isolados.
 * - Integração f1Service.startNextSeason: prova que as 8 instâncias (2 pilotos) nascem no engine_history sem apagar entradas legadas anteriores.
 */

import { describe, it, expect } from 'vitest'
import type { TeamModel, PowerUnitHistoryEntry } from '@/types/f1'
import {
  ensureSeasonDriverPowerUnitInventory,
  ensureSeasonTeamPowerUnitInventories,
  getDriverSeasonPowerUnits,
  getNextPowerUnitId,
  REGULATION_UNITS_PER_DRIVER,
} from '@/services/canonicalPowerUnitInventoryService'
import pb from '@/lib/pocketbase/client'
import { f1Service } from '@/services/f1Service'

describe('POWER-UNIT-4UNITS-01A1 — Inventário Idempotente PU1–PU4 por Piloto', () => {
  const createMockTeam = (overrides: Partial<TeamModel> = {}): TeamModel => ({
    id: 'team_apex_01',
    name: 'Apex GP Test',
    color: '#00F0FF',
    chassis_level: 80,
    aero_level: 80,
    strategy_level: 80,
    budget: 150000000,
    cost_cap_spent: 0,
    engine_pool_used: 1,
    engine_supplier: 'Audi',
    active_engine_wear: 0,
    engine_history: [],
    ...overrides,
  })

  // A1.1 — um piloto: inicializar numa temporada nova → 4 unidades; unitNumber = [1,2,3,4]; mesmo driverId; mesmo seasonYear; IDs únicos.
  it('A1.1 — um piloto em temporada nova inicializa exatamente 4 unidades regulamentares com IDs únicos', () => {
    const team = createMockTeam()
    const history = ensureSeasonDriverPowerUnitInventory({
      team,
      driverId: 'drv_norris',
      seasonYear: 2026,
    })

    expect(history.length).toBe(REGULATION_UNITS_PER_DRIVER)
    expect(history.length).toBe(4)

    const unitNumbers = history.map((u) => u.unitNumber)
    expect(unitNumbers).toEqual([1, 2, 3, 4])

    history.forEach((u) => {
      expect(u.driverId).toBe('drv_norris')
      expect(u.seasonYear).toBe(2026)
      expect(u.wear).toBe(0)
      expect(u.condition).toBe(100)
      expect(u.mileage_km).toBe(0)
      expect(u.status).toBe('reserva')
      expect(u.exceedsQuota).toBe(false)
      expect(u.supplier).toBe('Audi')
    })

    const ids = history.map((u) => u.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(4)
  })

  // A1.2 — dois pilotos da mesma equipe → 8 unidades totais; 4 para cada; ambos com unitNumber 1–4; todos os id únicos (ex.: A: 1..4, B: 5..8).
  it('A1.2 — dois pilotos da mesma equipe geram 8 unidades totais, 4 para cada, com IDs únicos', () => {
    const team = createMockTeam()
    const driverIds = ['drv_norris', 'drv_piastri']

    const history = ensureSeasonTeamPowerUnitInventories({
      team,
      driverIds,
      seasonYear: 2026,
    })

    expect(history.length).toBe(8)

    const norrisUnits = history.filter((u) => u.driverId === 'drv_norris')
    const piastriUnits = history.filter((u) => u.driverId === 'drv_piastri')

    expect(norrisUnits.length).toBe(4)
    expect(piastriUnits.length).toBe(4)

    expect(norrisUnits.map((u) => u.unitNumber)).toEqual([1, 2, 3, 4])
    expect(piastriUnits.map((u) => u.unitNumber)).toEqual([1, 2, 3, 4])

    const allIds = history.map((u) => u.id)
    const uniqueIds = new Set(allIds)
    expect(uniqueIds.size).toBe(8)

    expect(allIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  // A1.3 — idempotência: executar inicialização duas vezes → continua exatamente 8 unidades; nenhum ID novo; nenhum reset de estado.
  it('A1.3 — idempotência: executar ensure duas vezes mantém exatamente 8 unidades sem duplicar nem alterar IDs', () => {
    const team = createMockTeam()
    const driverIds = ['drv_norris', 'drv_piastri']

    const firstRun = ensureSeasonTeamPowerUnitInventories({
      team,
      driverIds,
      seasonYear: 2026,
    })
    expect(firstRun.length).toBe(8)

    const secondRun = ensureSeasonTeamPowerUnitInventories({
      team: { ...team, engine_history: firstRun },
      driverIds,
      seasonYear: 2026,
    })

    expect(secondRun.length).toBe(8)
    expect(secondRun.map((u) => u.id)).toEqual(firstRun.map((u) => u.id))
    expect(secondRun).toEqual(firstRun)
  })

  // A1.4 — estado existente preservado: alterar PU1 do piloto A para wear > 0, condition < 100, mileage > 0; executar ensure novamente → valores permanecem exatamente iguais.
  it('A1.4 — estado existente preservado: unidade modificada em wear/condition/mileage mantém seus valores ao rodar ensure', () => {
    const team = createMockTeam()
    const driverIds = ['drv_norris', 'drv_piastri']

    const initialHistory = ensureSeasonTeamPowerUnitInventories({
      team,
      driverIds,
      seasonYear: 2026,
    })

    // Alterar PU1 do Norris
    const modifiedHistory = initialHistory.map((u) => {
      if (u.driverId === 'drv_norris' && u.unitNumber === 1) {
        return {
          ...u,
          wear: 28.5,
          condition: 71.5,
          mileage_km: 742,
          status: 'instalado' as const,
        }
      }
      return u
    })

    const afterEnsure = ensureSeasonTeamPowerUnitInventories({
      team: { ...team, engine_history: modifiedHistory },
      driverIds,
      seasonYear: 2026,
    })

    expect(afterEnsure.length).toBe(8)
    const norrisPU1 = afterEnsure.find((u) => u.driverId === 'drv_norris' && u.unitNumber === 1)
    expect(norrisPU1).toBeDefined()
    expect(norrisPU1?.wear).toBe(28.5)
    expect(norrisPU1?.condition).toBe(71.5)
    expect(norrisPU1?.mileage_km).toBe(742)
    expect(norrisPU1?.status).toBe('instalado')
    expect(norrisPU1?.id).toBe(1)
  })

  // A1.5 — unidade faltante: piloto possui PU1, PU2 e PU4, falta PU3 → cria apenas PU3; preserva as demais; novo id único (max+1).
  it('A1.5 — unidade faltante: quando piloto tem PU1, PU2 e PU4, cria apenas PU3 com ID único (max+1)', () => {
    const incompleteHistory: PowerUnitHistoryEntry[] = [
      {
        id: 1,
        wear: 10,
        condition: 90,
        mileage_km: 300,
        status: 'instalado',
        supplier: 'Audi',
        introducedRound: 1,
        exceedsQuota: false,
        driverId: 'drv_norris',
        seasonYear: 2026,
        unitNumber: 1,
      },
      {
        id: 2,
        wear: 5,
        condition: 95,
        mileage_km: 150,
        status: 'reserva',
        supplier: 'Audi',
        introducedRound: 1,
        exceedsQuota: false,
        driverId: 'drv_norris',
        seasonYear: 2026,
        unitNumber: 2,
      },
      {
        id: 4,
        wear: 0,
        condition: 100,
        mileage_km: 0,
        status: 'reserva',
        supplier: 'Audi',
        introducedRound: 1,
        exceedsQuota: false,
        driverId: 'drv_norris',
        seasonYear: 2026,
        unitNumber: 4,
      },
    ]

    const team = createMockTeam({ engine_history: incompleteHistory })

    const updated = ensureSeasonDriverPowerUnitInventory({
      team,
      driverId: 'drv_norris',
      seasonYear: 2026,
    })

    expect(updated.length).toBe(4)

    // Unidades originais 1, 2 e 4 preservadas
    const pu1 = updated.find((u) => u.unitNumber === 1)
    const pu2 = updated.find((u) => u.unitNumber === 2)
    const pu4 = updated.find((u) => u.unitNumber === 4)
    expect(pu1?.wear).toBe(10)
    expect(pu2?.wear).toBe(5)
    expect(pu4?.id).toBe(4)

    // Unidade faltante PU3 materializada com id max+1 = 5
    const pu3 = updated.find((u) => u.unitNumber === 3)
    expect(pu3).toBeDefined()
    expect(pu3?.id).toBe(5) // maxId(1,2,4) + 1
    expect(pu3?.wear).toBe(0)
    expect(pu3?.condition).toBe(100)
    expect(pu3?.mileage_km).toBe(0)
    expect(pu3?.driverId).toBe('drv_norris')
    expect(pu3?.seasonYear).toBe(2026)
  })

  // A1.6 — temporadas isoladas: mesmo piloto em 2026 e 2027 → inventário 2026 = PU1–PU4; 2027 = PU1–PU4; nenhuma mistura.
  it('A1.6 — temporadas isoladas: mesmo piloto em 2026 e 2027 tem inventários independentes e não misturados', () => {
    let team = createMockTeam()

    // Temporada 2026
    const history2026 = ensureSeasonDriverPowerUnitInventory({
      team,
      driverId: 'drv_norris',
      seasonYear: 2026,
    })
    team = { ...team, engine_history: history2026 }

    // Temporada 2027
    const history2027 = ensureSeasonDriverPowerUnitInventory({
      team,
      driverId: 'drv_norris',
      seasonYear: 2027,
    })
    team = { ...team, engine_history: history2027 }

    expect(team.engine_history?.length).toBe(8)

    const units2026 = getDriverSeasonPowerUnits(team, 'drv_norris', 2026)
    const units2027 = getDriverSeasonPowerUnits(team, 'drv_norris', 2027)

    expect(units2026.length).toBe(4)
    expect(units2027.length).toBe(4)

    expect(units2026.map((u) => u.unitNumber)).toEqual([1, 2, 3, 4])
    expect(units2027.map((u) => u.unitNumber)).toEqual([1, 2, 3, 4])

    // IDs de 2027 devem continuar a sequência após 2026
    expect(units2026.map((u) => u.id)).toEqual([1, 2, 3, 4])
    expect(units2027.map((u) => u.id)).toEqual([5, 6, 7, 8])

    // Cada lista tem estritamente o seu ano
    units2026.forEach((u) => expect(u.seasonYear).toBe(2026))
    units2027.forEach((u) => expect(u.seasonYear).toBe(2027))
  })

  // A1.7 — pilotos isolados: alterar unidade do piloto A → inventário do piloto B inalterado nos campos relevantes.
  it('A1.7 — pilotos isolados: alterações no inventário de A não afetam o inventário de B', () => {
    const team = createMockTeam()
    const driverIds = ['drv_norris', 'drv_piastri']

    const initialHistory = ensureSeasonTeamPowerUnitInventories({
      team,
      driverIds,
      seasonYear: 2026,
    })

    // Alterar piloto A
    const historyWithAChanged = initialHistory.map((u) => {
      if (u.driverId === 'drv_norris') {
        return { ...u, wear: u.wear + 15, mileage_km: 500 }
      }
      return u
    })

    const teamUpdated = { ...team, engine_history: historyWithAChanged }

    const piastriUnits = getDriverSeasonPowerUnits(teamUpdated, 'drv_piastri', 2026)
    expect(piastriUnits.length).toBe(4)
    piastriUnits.forEach((u) => {
      expect(u.driverId).toBe('drv_piastri')
      expect(u.wear).toBe(0)
      expect(u.mileage_km).toBe(0)
      expect(u.condition).toBe(100)
    })
  })

  // SEC-A: inicialização/reload não duplica PU.
  it('SEC-A — simulação de reload/chamada repetida não duplica instâncias nem corrompe contagem', () => {
    const team = createMockTeam()
    const driverIds = ['drv_norris', 'drv_piastri']

    let current = ensureSeasonTeamPowerUnitInventories({
      team,
      driverIds,
      seasonYear: 2026,
    })

    // Simula 5 reloads sucessivos da página
    for (let i = 0; i < 5; i++) {
      current = ensureSeasonTeamPowerUnitInventories({
        team: { ...team, engine_history: current },
        driverIds,
        seasonYear: 2026,
      })
    }

    expect(current.length).toBe(8)
    const uniqueIds = new Set(current.map((u) => u.id))
    expect(uniqueIds.size).toBe(8)
  })

  // SEC-F (parcial): inventários de pilotos diferentes são isolados.
  it('SEC-F (parcial) — getDriverSeasonPowerUnits filtra estritamente por piloto e temporada', () => {
    const dummyHistory: PowerUnitHistoryEntry[] = [
      {
        id: 1,
        wear: 0,
        condition: 100,
        mileage_km: 0,
        status: 'reserva',
        supplier: 'Ferrari',
        introducedRound: 1,
        exceedsQuota: false,
        driverId: 'drv_A',
        seasonYear: 2026,
        unitNumber: 1,
      },
      {
        id: 2,
        wear: 0,
        condition: 100,
        mileage_km: 0,
        status: 'reserva',
        supplier: 'Ferrari',
        introducedRound: 1,
        exceedsQuota: false,
        driverId: 'drv_B',
        seasonYear: 2026,
        unitNumber: 1,
      },
      {
        id: 3,
        wear: 0,
        condition: 100,
        mileage_km: 0,
        status: 'reserva',
        supplier: 'Ferrari',
        introducedRound: 1,
        exceedsQuota: false,
        driverId: 'drv_A',
        seasonYear: 2027,
        unitNumber: 1,
      },
      {
        id: 99,
        wear: 10,
        condition: 90,
        mileage_km: 500,
        status: 'reserva',
        supplier: 'Ferrari',
        introducedRound: 1,
        exceedsQuota: false,
      }, // legado sem piloto
    ]

    const team = createMockTeam({ engine_history: dummyHistory })

    const unitsA2026 = getDriverSeasonPowerUnits(team, 'drv_A', 2026)
    expect(unitsA2026.length).toBe(1)
    expect(unitsA2026[0].id).toBe(1)

    const unitsB2026 = getDriverSeasonPowerUnits(team, 'drv_B', 2026)
    expect(unitsB2026.length).toBe(1)
    expect(unitsB2026[0].id).toBe(2)

    const unitsA2027 = getDriverSeasonPowerUnits(team, 'drv_A', 2027)
    expect(unitsA2027.length).toBe(1)
    expect(unitsA2027[0].id).toBe(3)

    // Entradas legadas (sem driverId) não poluem a consulta regulamentar
    const unitsUnknown = getDriverSeasonPowerUnits(team, 'drv_unknown', 2026)
    expect(unitsUnknown.length).toBe(0)
  })

  // getNextPowerUnitId helper
  it('getNextPowerUnitId calcula max(id)+1 corretamente ou 1 se vazio', () => {
    expect(getNextPowerUnitId([])).toBe(1)
    expect(
      getNextPowerUnitId([
        {
          id: 1,
          wear: 0,
          condition: 100,
          mileage_km: 0,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 1,
          exceedsQuota: false,
        },
        {
          id: 7,
          wear: 0,
          condition: 100,
          mileage_km: 0,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 1,
          exceedsQuota: false,
        },
        {
          id: 3,
          wear: 0,
          condition: 100,
          mileage_km: 0,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 1,
          exceedsQuota: false,
        },
      ]),
    ).toBe(8)
  })

  // Teste adicional de INTEGRAÇÃO no f1Service.startNextSeason
  describe('Integração no fluxo anual f1Service.startNextSeason', () => {
    it('startNextSeason materializa as 8 instâncias (2 pilotos) no engine_history preservando entradas legadas', async () => {
      // Mock das chamadas do PocketBase usadas no startNextSeason
      const legacyHistory: PowerUnitHistoryEntry[] = [
        {
          id: 99,
          wear: 50,
          condition: 50,
          mileage_km: 2500,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 1,
          exceedsQuota: false,
        },
      ]

      const mockTeam: TeamModel = {
        id: 'team_apex_integracao',
        name: 'Apex GP',
        color: '#00F0FF',
        chassis_level: 80,
        aero_level: 80,
        strategy_level: 80,
        budget: 150000000,
        cost_cap_spent: 0,
        engine_pool_used: 1,
        engine_supplier: 'Audi',
        active_engine_wear: 30,
        engine_history: legacyHistory,
      }

      const mockTitulars = [
        {
          id: 'drv_norris_int',
          name: 'Lando Norris',
          role: 'titular',
          team_id: 'team_apex_integracao',
        },
        {
          id: 'drv_piastri_int',
          name: 'Oscar Piastri',
          role: 'titular',
          team_id: 'team_apex_integracao',
        },
      ]

      let persistedTeamUpdate: any = null

      const originalCollection = pb.collection.bind(pb)

      // Substituto controlado para a collection
      pb.collection = ((collectionName: string) => {
        if (collectionName === 'teams') {
          return {
            getOne: async (id: string) => {
              if (id === mockTeam.id) return { ...mockTeam }
              return { ...mockTeam }
            },
            update: async (id: string, data: any) => {
              persistedTeamUpdate = data
              return { ...mockTeam, ...data }
            },
            getFullList: async () => [mockTeam],
          }
        }
        if (collectionName === 'drivers') {
          return {
            getFullList: async (opts?: any) => {
              if (opts?.filter?.includes('role = "titular"')) {
                return mockTitulars
              }
              return []
            },
            update: async () => ({}),
          }
        }
        if (collectionName === 'parts') {
          return {
            getFullList: async () => [],
            update: async () => ({}),
          }
        }
        if (collectionName === 'seasons') {
          return {
            update: async (_id: string, data: any) => ({ id: _id, ...data }),
            getFullList: async () => [],
          }
        }
        if (
          collectionName === 'race_results' ||
          collectionName === 'race_reports' ||
          collectionName === 'session_setups' ||
          collectionName === 'sponsors'
        ) {
          return {
            getFullList: async () => [],
            delete: async () => ({}),
            update: async () => ({}),
          }
        }
        if (collectionName === 'events') {
          return {
            create: async () => ({}),
          }
        }
        return originalCollection(collectionName)
      }) as unknown as typeof pb.collection

      try {
        await f1Service.startNextSeason('season_2026', 'team_apex_integracao', 2027, 1)

        expect(persistedTeamUpdate).not.toBeNull()
        expect(persistedTeamUpdate.active_engine_wear).toBe(0)
        expect(persistedTeamUpdate.engine_pool_used).toBe(1)

        const history: PowerUnitHistoryEntry[] = persistedTeamUpdate.engine_history
        expect(Array.isArray(history)).toBe(true)

        // Preservou a entrada legada (id 99)
        const legacy = history.find((u) => u.id === 99)
        expect(legacy).toBeDefined()
        expect(legacy?.wear).toBe(50)

        // Criou 8 novas unidades (4 para norris, 4 para piastri) com ano 2027
        const norrisUnits = history.filter(
          (u) => u.driverId === 'drv_norris_int' && u.seasonYear === 2027,
        )
        const piastriUnits = history.filter(
          (u) => u.driverId === 'drv_piastri_int' && u.seasonYear === 2027,
        )

        expect(norrisUnits.length).toBe(4)
        expect(piastriUnits.length).toBe(4)

        expect(norrisUnits.map((u) => u.unitNumber)).toEqual([1, 2, 3, 4])
        expect(piastriUnits.map((u) => u.unitNumber)).toEqual([1, 2, 3, 4])

        // Todos os IDs são únicos no histórico completo
        const allIds = history.map((u) => u.id)
        const uniqueIds = new Set(allIds)
        expect(uniqueIds.size).toBe(history.length)
        expect(history.length).toBe(9) // 1 legado + 8 novas
      } finally {
        pb.collection = originalCollection
      }
    })
  })
})
