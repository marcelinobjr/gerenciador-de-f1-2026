/**
 * power-unit-4units-01a2.test.ts
 *
 * Microbloco POWER-UNIT-4UNITS-01A2: INSTALAÇÃO E TROCA CANÔNICA PU1–PU4
 *
 * Casos Obrigatórios:
 * - A2.1: Instalação inicial: dois pilotos com inventário A1 pronto -> PU1 de A instalada, PU1 de B instalada,
 *         exatamente 1 instalada por piloto, 2 instaladas na equipe no total.
 * - A2.2: Idempotência: rodar inicialização novamente -> alocações permanecem iguais, nenhuma troca involuntária,
 *         nenhum estado resetado.
 * - A2.3: Troca simples: Driver A PU1->PU2 -> PU1 reserva, PU2 instalada, Driver B intacto.
 * - A2.4: Preservação de estado: valores não-zero em PU1/PU2, trocar e voltar -> wear/condition/mileage preservados
 *         exatamente (cenário do item 7).
 * - A2.5: Reload: instalar PU3, persistir/recarregar -> PU3 permanece instalada, ensure/init não força PU1.
 * - A2.6: Bloqueio entre pilotos: tentar instalar PU2 do Driver B no carro do Driver A -> rejeitada, nenhuma alteração parcial.
 * - A2.7: Temporada errada: tentar instalar PU de 2026 em inventário 2027 -> rejeitada.
 * - A2.8: Mesma PU em dois carros: tentar alocar o mesmo engine_history.id aos dois carros -> rejeitada, invariantes preservadas.
 * - B1-SEC:
 *   - SEC-B: Exatamente uma unidade instalada por piloto.
 *   - SEC-C: Troca não reseta wear/km/condition.
 *   - SEC-A: Inicialização/reload não duplica unidades.
 *   - SEC-F: Pilotos da mesma equipe são estritamente isolados.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { TeamModel } from '@/types/f1'
import {
  ensureSeasonTeamPowerUnitInventories,
  getDriverSeasonPowerUnits,
  getInstalledUnitsCountForDriver,
} from '@/services/canonicalPowerUnitInventoryService'
import { canonicalPowerUnitAllocationService } from '@/services/canonicalPowerUnitAllocationService'

describe('POWER-UNIT-4UNITS-01A2 — Instalação e Troca Canônica PU1–PU4', () => {
  const createMockTeamWithInventory = (): TeamModel => {
    const baseTeam: TeamModel = {
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
    }

    const history = ensureSeasonTeamPowerUnitInventories({
      team: baseTeam,
      driverIds: ['drv_norris', 'drv_piastri'],
      seasonYear: 2026,
    })

    return {
      ...baseTeam,
      engine_history: history,
    }
  }

  beforeEach(() => {
    canonicalPowerUnitAllocationService.clearMemoryCache()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // A2.1 Instalação inicial
  it('A2.1 — instalação inicial: dois pilotos com inventário A1 pronto → PU1 de A instalada, PU1 de B instalada, exatamente 1 instalada por piloto, 2 no total', () => {
    const team = createMockTeamWithInventory()

    // Inicialização da alocação canônica
    const initializedTeam = canonicalPowerUnitAllocationService.ensureInitialDriverAllocations({
      team,
      driver1Id: 'drv_norris',
      driver2Id: 'drv_piastri',
      seasonYear: 2026,
      careerId: 'test_career_a2_1',
    })

    const alloc = canonicalPowerUnitAllocationService.extractAllocationFromTeam(
      initializedTeam,
      'test_career_a2_1',
    )
    expect(alloc).not.toBeNull()

    const norrisUnits = getDriverSeasonPowerUnits(initializedTeam, 'drv_norris', 2026)
    const piastriUnits = getDriverSeasonPowerUnits(initializedTeam, 'drv_piastri', 2026)

    const norrisPU1 = norrisUnits.find((u) => u.unitNumber === 1)
    const piastriPU1 = piastriUnits.find((u) => u.unitNumber === 1)

    expect(norrisPU1).toBeDefined()
    expect(piastriPU1).toBeDefined()

    // Carro 1 aloca PU1 de Norris (id 1)
    expect(alloc?.car1Unit).toBe(norrisPU1?.id)
    // Carro 2 aloca PU1 de Piastri (id 5)
    expect(alloc?.car2Unit).toBe(piastriPU1?.id)

    // Status no engine_history
    expect(norrisPU1?.status).toBe('instalado')
    expect(piastriPU1?.status).toBe('instalado')

    // As demais unidades devem ser reserva
    const norrisReserves = norrisUnits.filter((u) => u.unitNumber !== 1)
    const piastriReserves = piastriUnits.filter((u) => u.unitNumber !== 1)
    norrisReserves.forEach((u) => expect(u.status).toBe('reserva'))
    piastriReserves.forEach((u) => expect(u.status).toBe('reserva'))

    // Invariante SEC-B: exatamente 1 instalada por piloto
    expect(getInstalledUnitsCountForDriver(initializedTeam, 'drv_norris', 2026)).toBe(1)
    expect(getInstalledUnitsCountForDriver(initializedTeam, 'drv_piastri', 2026)).toBe(1)

    // 2 instaladas no total da equipe na temporada
    const totalInstalled = (initializedTeam.engine_history || []).filter(
      (u) => u.seasonYear === 2026 && u.status === 'instalado',
    ).length
    expect(totalInstalled).toBe(2)
  })

  // A2.2 Idempotência
  it('A2.2 — idempotência: rodar inicialização novamente mantém alocações e nenhum estado é resetado', () => {
    let team = createMockTeamWithInventory()

    team = canonicalPowerUnitAllocationService.ensureInitialDriverAllocations({
      team,
      driver1Id: 'drv_norris',
      driver2Id: 'drv_piastri',
      seasonYear: 2026,
      careerId: 'test_career_a2_2',
    })

    const allocBefore = canonicalPowerUnitAllocationService.extractAllocationFromTeam(
      team,
      'test_career_a2_2',
    )
    const historyBefore = JSON.parse(JSON.stringify(team.engine_history))

    // Executa a inicialização novamente
    team = canonicalPowerUnitAllocationService.ensureInitialDriverAllocations({
      team,
      driver1Id: 'drv_norris',
      driver2Id: 'drv_piastri',
      seasonYear: 2026,
      careerId: 'test_career_a2_2',
    })

    const allocAfter = canonicalPowerUnitAllocationService.extractAllocationFromTeam(
      team,
      'test_career_a2_2',
    )
    expect(allocAfter).toEqual(allocBefore)
    expect(team.engine_history).toEqual(historyBefore)
  })

  // A2.3 Troca simples
  it('A2.3 — troca simples: Driver A PU1→PU2 → PU1 vira reserva, PU2 vira instalada, Driver B permanece intacto', () => {
    let team = createMockTeamWithInventory()

    team = canonicalPowerUnitAllocationService.ensureInitialDriverAllocations({
      team,
      driver1Id: 'drv_norris',
      driver2Id: 'drv_piastri',
      seasonYear: 2026,
      careerId: 'test_career_a2_3',
    })

    const piastriUnitsBefore = getDriverSeasonPowerUnits(team, 'drv_piastri', 2026)

    // Trocar Norris para PU2
    team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
      team,
      driverId: 'drv_norris',
      seasonYear: 2026,
      targetUnitNumber: 2,
      carSlot: 1,
      careerId: 'test_career_a2_3',
    })

    const norrisUnitsAfter = getDriverSeasonPowerUnits(team, 'drv_norris', 2026)
    const piastriUnitsAfter = getDriverSeasonPowerUnits(team, 'drv_piastri', 2026)

    const norrisPU1 = norrisUnitsAfter.find((u) => u.unitNumber === 1)
    const norrisPU2 = norrisUnitsAfter.find((u) => u.unitNumber === 2)

    expect(norrisPU1?.status).toBe('reserva')
    expect(norrisPU2?.status).toBe('instalado')

    // Alocação reflete a nova PU do carro 1
    const alloc = canonicalPowerUnitAllocationService.extractAllocationFromTeam(
      team,
      'test_career_a2_3',
    )
    expect(alloc?.car1Unit).toBe(norrisPU2?.id)

    // Invariante SEC-B
    expect(getInstalledUnitsCountForDriver(team, 'drv_norris', 2026)).toBe(1)
    expect(getInstalledUnitsCountForDriver(team, 'drv_piastri', 2026)).toBe(1)

    // Driver B permaneceu idêntico byte a byte
    expect(piastriUnitsAfter).toEqual(piastriUnitsBefore)
  })

  // A2.4 Preservação de estado
  it('A2.4 — preservação de estado: valores não-zero em PU1 e PU2 (wear/condition/mileage) preservados exatamente na troca e retorno', () => {
    let team = createMockTeamWithInventory()

    team = canonicalPowerUnitAllocationService.ensureInitialDriverAllocations({
      team,
      driver1Id: 'drv_norris',
      driver2Id: 'drv_piastri',
      seasonYear: 2026,
      careerId: 'test_career_a2_4',
    })

    // Configurar o cenário exato do briefing (item 7):
    // PU1 com wear=37 / condition=63 / mileage=842
    // PU2 com wear=12 / condition=88 / mileage=231
    const modifiedHistory = (team.engine_history || []).map((u) => {
      if (u.driverId === 'drv_norris' && u.unitNumber === 1) {
        return { ...u, wear: 37, condition: 63, mileage_km: 842 }
      }
      if (u.driverId === 'drv_norris' && u.unitNumber === 2) {
        return { ...u, wear: 12, condition: 88, mileage_km: 231 }
      }
      return u
    })
    team = { ...team, engine_history: modifiedHistory }

    // Trocar Norris PU1 -> PU2
    team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
      team,
      driverId: 'drv_norris',
      seasonYear: 2026,
      targetUnitNumber: 2,
      carSlot: 1,
      careerId: 'test_career_a2_4',
    })

    let norrisUnits = getDriverSeasonPowerUnits(team, 'drv_norris', 2026)
    let pu1 = norrisUnits.find((u) => u.unitNumber === 1)
    let pu2 = norrisUnits.find((u) => u.unitNumber === 2)

    expect(pu1?.wear).toBe(37)
    expect(pu1?.condition).toBe(63)
    expect(pu1?.mileage_km).toBe(842)
    expect(pu1?.status).toBe('reserva')

    expect(pu2?.wear).toBe(12)
    expect(pu2?.condition).toBe(88)
    expect(pu2?.mileage_km).toBe(231)
    expect(pu2?.status).toBe('instalado')

    // Voltar PU2 -> PU1
    team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
      team,
      driverId: 'drv_norris',
      seasonYear: 2026,
      targetUnitNumber: 1,
      carSlot: 1,
      careerId: 'test_career_a2_4',
    })

    norrisUnits = getDriverSeasonPowerUnits(team, 'drv_norris', 2026)
    pu1 = norrisUnits.find((u) => u.unitNumber === 1)
    pu2 = norrisUnits.find((u) => u.unitNumber === 2)

    expect(pu1?.wear).toBe(37)
    expect(pu1?.condition).toBe(63)
    expect(pu1?.mileage_km).toBe(842)
    expect(pu1?.status).toBe('instalado')

    expect(pu2?.wear).toBe(12)
    expect(pu2?.condition).toBe(88)
    expect(pu2?.mileage_km).toBe(231)
    expect(pu2?.status).toBe('reserva')
  })

  // A2.5 Reload
  it('A2.5 — reload: instalar PU3, simular persistência e recarregamento → PU3 continua instalada e ensure/init não força PU1', () => {
    let team = createMockTeamWithInventory()

    team = canonicalPowerUnitAllocationService.ensureInitialDriverAllocations({
      team,
      driver1Id: 'drv_norris',
      driver2Id: 'drv_piastri',
      seasonYear: 2026,
      careerId: 'test_career_a2_5',
    })

    // Trocar Norris para PU3
    team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
      team,
      driverId: 'drv_norris',
      seasonYear: 2026,
      targetUnitNumber: 3,
      carSlot: 1,
      careerId: 'test_career_a2_5',
    })

    const norrisPU3 = getDriverSeasonPowerUnits(team, 'drv_norris', 2026).find(
      (u) => u.unitNumber === 3,
    )
    expect(norrisPU3?.status).toBe('instalado')

    // Simular reload total limpando cache em memória
    canonicalPowerUnitAllocationService.clearMemoryCache()

    // Re-hidratar / executar ensureInitialDriverAllocations como feito no boot da tela
    const rehydratedTeam = canonicalPowerUnitAllocationService.ensureInitialDriverAllocations({
      team,
      driver1Id: 'drv_norris',
      driver2Id: 'drv_piastri',
      seasonYear: 2026,
      careerId: 'test_career_a2_5',
    })

    const alloc = canonicalPowerUnitAllocationService.extractAllocationFromTeam(
      rehydratedTeam,
      'test_career_a2_5',
    )
    // Norris continua com PU3 instalada! Não foi forçado para PU1
    expect(alloc?.car1Unit).toBe(norrisPU3?.id)

    const norrisUnitsAfter = getDriverSeasonPowerUnits(rehydratedTeam, 'drv_norris', 2026)
    expect(norrisUnitsAfter.find((u) => u.unitNumber === 3)?.status).toBe('instalado')
    expect(norrisUnitsAfter.find((u) => u.unitNumber === 1)?.status).toBe('reserva')
    expect(norrisUnitsAfter.find((u) => u.unitNumber === 2)?.status).toBe('reserva')
    expect(norrisUnitsAfter.find((u) => u.unitNumber === 4)?.status).toBe('reserva')
  })

  // A2.6 Bloqueio entre pilotos
  it('A2.6 — bloqueio entre pilotos: tentar instalar PU2 do Driver B no carro do Driver A é rejeitada sem alterações parciais', () => {
    let team = createMockTeamWithInventory()

    team = canonicalPowerUnitAllocationService.ensureInitialDriverAllocations({
      team,
      driver1Id: 'drv_norris',
      driver2Id: 'drv_piastri',
      seasonYear: 2026,
      careerId: 'test_career_a2_6',
    })

    const piastriUnits = getDriverSeasonPowerUnits(team, 'drv_piastri', 2026)
    const piastriPU2 = piastriUnits.find((u) => u.unitNumber === 2)
    expect(piastriPU2).toBeDefined()

    const allocBefore = canonicalPowerUnitAllocationService.extractAllocationFromTeam(
      team,
      'test_career_a2_6',
    )
    const historyBefore = JSON.parse(JSON.stringify(team.engine_history))

    // Tentar instalar a PU2 de Piastri para Norris
    expect(() => {
      canonicalPowerUnitAllocationService.switchDriverPowerUnit({
        team,
        driverId: 'drv_norris',
        seasonYear: 2026,
        targetPowerUnitId: piastriPU2?.id,
        carSlot: 1,
        careerId: 'test_career_a2_6',
      })
    }).toThrow(/pertence a outro piloto/)

    // Nenhuma alteração parcial
    const allocAfter = canonicalPowerUnitAllocationService.extractAllocationFromTeam(
      team,
      'test_career_a2_6',
    )
    expect(allocAfter).toEqual(allocBefore)
    expect(team.engine_history).toEqual(historyBefore)
  })

  // A2.7 Temporada errada
  it('A2.7 — temporada errada: tentar instalar PU de 2026 em inventário 2027 é rejeitada', () => {
    let team = createMockTeamWithInventory()

    // Criar unidades de 2027 também
    const history2027 = ensureSeasonTeamPowerUnitInventories({
      team,
      driverIds: ['drv_norris', 'drv_piastri'],
      seasonYear: 2027,
    })
    team = { ...team, engine_history: history2027 }

    // Pegar uma PU de Norris de 2026
    const pu2026 = (team.engine_history || []).find(
      (u) => u.driverId === 'drv_norris' && u.seasonYear === 2026 && u.unitNumber === 1,
    )
    expect(pu2026).toBeDefined()

    // Tentar instalar a PU de 2026 no contexto da temporada 2027
    expect(() => {
      canonicalPowerUnitAllocationService.switchDriverPowerUnit({
        team,
        driverId: 'drv_norris',
        seasonYear: 2027,
        targetPowerUnitId: pu2026?.id,
        carSlot: 1,
      })
    }).toThrow(/temporada/)
  })

  // A2.8 Mesma PU em dois carros
  it('A2.8 — mesma PU em dois carros: tentar alocar o mesmo engine_history.id aos dois carros é rejeitada', () => {
    const team = createMockTeamWithInventory()

    // Validação estrita
    const validation = canonicalPowerUnitAllocationService.validateAllocation(1, 1, team)
    expect(validation.valid).toBe(false)
    expect(validation.error).toMatch(/não pode ser instalada simultaneamente nos dois carros/)

    // validateDriverPowerUnitEligibility com otherCarUnitId igual
    const eligibility = canonicalPowerUnitAllocationService.validateDriverPowerUnitEligibility({
      team,
      driverId: 'drv_norris',
      seasonYear: 2026,
      targetPowerUnitId: 1,
      otherCarUnitId: 1,
    })
    expect(eligibility.valid).toBe(false)
    expect(eligibility.error).toMatch(/não pode ser instalada simultaneamente nos dois carros/)
  })

  // SEC-B: exatamente uma unidade instalada por piloto
  it('SEC-B — invariante: exatamente uma unidade instalada por piloto em qualquer momento após inicialização', () => {
    let team = createMockTeamWithInventory()

    team = canonicalPowerUnitAllocationService.ensureInitialDriverAllocations({
      team,
      driver1Id: 'drv_norris',
      driver2Id: 'drv_piastri',
      seasonYear: 2026,
    })

    expect(getInstalledUnitsCountForDriver(team, 'drv_norris', 2026)).toBe(1)
    expect(getInstalledUnitsCountForDriver(team, 'drv_piastri', 2026)).toBe(1)

    // Trocar Norris para PU2
    team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
      team,
      driverId: 'drv_norris',
      seasonYear: 2026,
      targetUnitNumber: 2,
    })
    expect(getInstalledUnitsCountForDriver(team, 'drv_norris', 2026)).toBe(1)
    expect(getInstalledUnitsCountForDriver(team, 'drv_piastri', 2026)).toBe(1)

    // Trocar Piastri para PU4
    team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
      team,
      driverId: 'drv_piastri',
      seasonYear: 2026,
      targetUnitNumber: 4,
    })
    expect(getInstalledUnitsCountForDriver(team, 'drv_norris', 2026)).toBe(1)
    expect(getInstalledUnitsCountForDriver(team, 'drv_piastri', 2026)).toBe(1)
  })

  // SEC-C: troca não reseta wear/km/condition
  it('SEC-C — invariante: trocas sucessivas não resetam nem alteram wear, condition e km', () => {
    let team = createMockTeamWithInventory()

    team = canonicalPowerUnitAllocationService.ensureInitialDriverAllocations({
      team,
      driver1Id: 'drv_norris',
      driver2Id: 'drv_piastri',
      seasonYear: 2026,
    })

    // Colocar wear/condition/mileage em Norris PU1..PU4
    const historyWithValues = (team.engine_history || []).map((u) => {
      if (u.driverId === 'drv_norris') {
        return {
          ...u,
          wear: (u.unitNumber || 1) * 15,
          condition: 100 - (u.unitNumber || 1) * 15,
          mileage_km: (u.unitNumber || 1) * 350,
        }
      }
      return u
    })
    team = { ...team, engine_history: historyWithValues }

    // Realizar várias trocas PU1 -> PU2 -> PU3 -> PU4 -> PU1
    for (const unitNum of [2, 3, 4, 1]) {
      team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
        team,
        driverId: 'drv_norris',
        seasonYear: 2026,
        targetUnitNumber: unitNum,
      })
    }

    const norrisUnits = getDriverSeasonPowerUnits(team, 'drv_norris', 2026)
    norrisUnits.forEach((u) => {
      const expectedWear = (u.unitNumber || 1) * 15
      const expectedCondition = 100 - expectedWear
      const expectedKm = (u.unitNumber || 1) * 350

      expect(u.wear).toBe(expectedWear)
      expect(u.condition).toBe(expectedCondition)
      expect(u.mileage_km).toBe(expectedKm)
    })
  })

  // SEC-F: isolamento estrito entre pilotos da mesma equipe
  it('SEC-F — isolamento estrito: modificações e trocas do Driver A não alteram alocação nem status de Driver B', () => {
    let team = createMockTeamWithInventory()

    team = canonicalPowerUnitAllocationService.ensureInitialDriverAllocations({
      team,
      driver1Id: 'drv_norris',
      driver2Id: 'drv_piastri',
      seasonYear: 2026,
    })

    const piastriPU1Id = getDriverSeasonPowerUnits(team, 'drv_piastri', 2026).find(
      (u) => u.unitNumber === 1,
    )?.id

    // Trocar Driver A repetidamente
    team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
      team,
      driverId: 'drv_norris',
      seasonYear: 2026,
      targetUnitNumber: 3,
    })
    team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
      team,
      driverId: 'drv_norris',
      seasonYear: 2026,
      targetUnitNumber: 4,
    })

    const alloc = canonicalPowerUnitAllocationService.extractAllocationFromTeam(team)
    // Carro 2 continua com a unidade de Piastri
    expect(alloc?.car2Unit).toBe(piastriPU1Id)

    const piastriUnits = getDriverSeasonPowerUnits(team, 'drv_piastri', 2026)
    expect(piastriUnits.find((u) => u.unitNumber === 1)?.status).toBe('instalado')
    expect(piastriUnits.filter((u) => u.status === 'instalado').length).toBe(1)
  })
})
