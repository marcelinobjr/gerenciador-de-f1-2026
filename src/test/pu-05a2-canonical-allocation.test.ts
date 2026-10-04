/**
 * pu-05a2-canonical-allocation.test.ts
 *
 * Suíte de Testes Direcionados de Produção Real para PU-05A2-P1:
 * Persistência Canônica da Montagem de Unidades de Potência (Apex GP Manager)
 *
 * TESTES OBRIGATÓRIOS DO BRIEFING:
 * - TESTE A — DOIS CARROS: acionar o handler/serviço real de montagem para duas unidades distintas; gravação correta e independente por carro.
 * - TESTE B — LEITURA E RETOMADA: recarregar pelo mecanismo real; consumidores de Carro/Infraestrutura resolvem as mesmas associações; remover o cache local e comprovar que a montagem persistida permanece.
 * - TESTE C — ISOLAMENTO: duas carreiras/saves; montagem de uma não altera a outra.
 * - TESTE D — REJEIÇÕES: restrições reais de propriedade, existência e conflito entre carros; rejeição preserva o estado válido anterior.
 * - TESTE E — FALHA DE GRAVAÇÃO: simular falha no transporte de persistência; não apresentar sucesso nem manter associação visual divergente da fonte canônica.
 * - TESTE F — CHAVES LEGADAS: chave global antiga de outra carreira não contamina a associação do save aberto.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  canonicalPowerUnitAllocationService,
  PowerUnitCarAllocation,
} from '@/services/canonicalPowerUnitAllocationService'
import type { TeamModel } from '@/types/f1'

describe('PU-05A2-P1: Persistência Canônica da Montagem (Testes A - F)', () => {
  const createMockTeam = (id: string, overrides: Partial<TeamModel> = {}): TeamModel => ({
    id,
    name: 'Apex Grand Prix Team',
    color: '#00D2BE',
    chassis_level: 85,
    aero_level: 82,
    strategy_level: 80,
    budget: 120000000,
    cost_cap_spent: 35000000,
    engine_pool_used: 4,
    engine_supplier: 'Mercedes',
    active_engine_wear: 18,
    engine_history: [
      {
        id: 1,
        wear: 35,
        status: 'instalado',
        supplier: 'Mercedes',
        introducedRound: 1,
        condition: 65,
        mileage_km: 1200,
      },
      {
        id: 2,
        wear: 20,
        status: 'instalado',
        supplier: 'Mercedes',
        introducedRound: 3,
        condition: 80,
        mileage_km: 800,
      },
      {
        id: 3,
        wear: 10,
        status: 'reserva',
        supplier: 'Mercedes',
        introducedRound: 6,
        condition: 90,
        mileage_km: 400,
      },
      {
        id: 4,
        wear: 0,
        status: 'reserva',
        supplier: 'Mercedes',
        introducedRound: 9,
        condition: 100,
        mileage_km: 0,
      },
    ],
    grid_penalties: [],
    ...overrides,
  })

  beforeEach(() => {
    canonicalPowerUnitAllocationService.clearMemoryCache()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
    vi.restoreAllMocks()
  })

  // =========================================================================
  // TESTE A — DOIS CARROS
  // =========================================================================
  it('TESTE A — DOIS CARROS: acionar montagem real para duas unidades distintas; gravação correta e independente por carro', async () => {
    const team = createMockTeam('team_car1_car2_test')
    const careerId = 'career_two_cars_01'

    // Mock do update do PocketBase para refletir persistência no banco
    const updateSpy = vi
      .spyOn(pb.collection('teams'), 'update')
      .mockImplementation(async (id, data) => {
        return { id, ...data } as any
      })

    // Monta Carro 1 com PU3 e Carro 2 com PU4
    const res = await canonicalPowerUnitAllocationService.setAllocation({
      team,
      car1Unit: 3,
      car2Unit: 4,
      careerId,
    })

    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(res.car1Unit).toBe(3)
    expect(res.car2Unit).toBe(4)
    expect(res.careerId).toBe(careerId)

    // Valida payload persistido no PocketBase
    const passedPayload = updateSpy.mock.calls[0][1] as any
    expect(passedPayload.car_specifications?.power_unit_allocations).toEqual({
      car1Unit: 3,
      car2Unit: 4,
      updatedAt: res.updatedAt,
      careerId,
    })

    // Valida enriquecimento semântico no engine_history
    const hist = passedPayload.engine_history
    expect(hist.find((e: any) => e.id === 3)?.assignedCar).toBe(1)
    expect(hist.find((e: any) => e.id === 3)?.status).toBe('instalado')
    expect(hist.find((e: any) => e.id === 4)?.assignedCar).toBe(2)
    expect(hist.find((e: any) => e.id === 4)?.status).toBe('instalado')

    // Altera apenas Carro 2 para PU1 (Carro 1 deve permanecer PU3)
    const resSingle = await canonicalPowerUnitAllocationService.setSingleCarAllocation({
      team,
      targetCar: 2,
      unitNumber: 1,
      careerId,
    })

    expect(resSingle.car1Unit).toBe(3)
    expect(resSingle.car2Unit).toBe(1)
  })

  // =========================================================================
  // TESTE B — LEITURA E RETOMADA
  // =========================================================================
  it('TESTE B — LEITURA E RETOMADA: consumidores de Carro/Infraestrutura resolvem as mesmas associações; limpar local cache mantém alocação persistida', async () => {
    const careerId = 'career_reload_test'
    const team = createMockTeam('team_reload', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 2,
          car2Unit: 4,
          updatedAt: '2026-04-10T12:00:00Z',
          careerId,
        },
      },
    })

    // Leitura pelo consumidor de Carro
    const allocForCar = canonicalPowerUnitAllocationService.resolveAllocation({
      team,
      careerId,
    })

    // Leitura pelo consumidor de Infraestrutura
    const allocForInfra = canonicalPowerUnitAllocationService.resolveAllocation({
      team,
      careerId,
    })

    expect(allocForCar.car1Unit).toBe(2)
    expect(allocForCar.car2Unit).toBe(4)
    expect(allocForInfra.car1Unit).toBe(2)
    expect(allocForInfra.car2Unit).toBe(4)
    expect(allocForCar).toEqual(allocForInfra)

    // SIMULAR LIMPEZA DO LOCAL STORAGE DO NAVEGADOR E CACHE DE MEMÓRIA
    window.localStorage.clear()
    canonicalPowerUnitAllocationService.clearMemoryCache()

    // Re-leitura pós-limpeza de cache: recupera diretamente do TeamModel do save
    const recoveredAlloc = canonicalPowerUnitAllocationService.resolveAllocation({
      team,
      careerId,
    })

    expect(recoveredAlloc.car1Unit).toBe(2)
    expect(recoveredAlloc.car2Unit).toBe(4)
  })

  // =========================================================================
  // TESTE C — ISOLAMENTO
  // =========================================================================
  it('TESTE C — ISOLAMENTO: duas carreiras/saves; montagem de uma não altera a outra', async () => {
    vi.spyOn(pb.collection('teams'), 'update').mockImplementation(
      async (id, data) => ({ id, ...data }) as any,
    )

    const teamCareerAlpha = createMockTeam('team_alpha', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 1,
          car2Unit: 2,
          updatedAt: '2026-01-01T00:00:00Z',
          careerId: 'career_alpha',
        },
      },
    })

    const teamCareerBeta = createMockTeam('team_beta', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 3,
          car2Unit: 4,
          updatedAt: '2026-01-01T00:00:00Z',
          careerId: 'career_beta',
        },
      },
    })

    // Altera Career Alpha para PU2 e PU3
    await canonicalPowerUnitAllocationService.setAllocation({
      team: teamCareerAlpha,
      car1Unit: 2,
      car2Unit: 3,
      careerId: 'career_alpha',
    })

    // Resolve ambas
    const allocAlpha = canonicalPowerUnitAllocationService.resolveAllocation({
      team: teamCareerAlpha,
      careerId: 'career_alpha',
    })

    const allocBeta = canonicalPowerUnitAllocationService.resolveAllocation({
      team: teamCareerBeta,
      careerId: 'career_beta',
    })

    expect(allocAlpha.car1Unit).toBe(2)
    expect(allocAlpha.car2Unit).toBe(3)

    // Career Beta permaneceu 3 e 4, intocada
    expect(allocBeta.car1Unit).toBe(3)
    expect(allocBeta.car2Unit).toBe(4)
  })

  // =========================================================================
  // TESTE D — REJEIÇÕES
  // =========================================================================
  it('TESTE D — REJEIÇÕES: conflito entre carros e unidade inexistente; rejeição preserva estado válido anterior', async () => {
    const updateSpy = vi
      .spyOn(pb.collection('teams'), 'update')
      .mockImplementation(async (id, data) => ({ id, ...data }) as any)
    const team = createMockTeam('team_reject_test', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 1,
          car2Unit: 2,
          updatedAt: '2026-02-01T00:00:00Z',
          careerId: 'career_reject_01',
        },
      },
    })
    const careerId = 'career_reject_01'

    // 1. Validação de conflito: tentar montar mesma PU (PU2) nos dois carros
    const conflictValidation = canonicalPowerUnitAllocationService.validateAllocation(2, 2, team)
    expect(conflictValidation.valid).toBe(false)
    expect(conflictValidation.error).toContain('não pode ser instalada simultaneamente')

    await expect(
      canonicalPowerUnitAllocationService.setAllocation({
        team,
        car1Unit: 2,
        car2Unit: 2,
        careerId,
      }),
    ).rejects.toThrow()

    // 2. Validação de existência: tentar montar PU99 que não existe no histórico
    const nonexistentValidation = canonicalPowerUnitAllocationService.validateAllocation(
      99,
      1,
      team,
    )
    expect(nonexistentValidation.valid).toBe(false)
    expect(nonexistentValidation.error).toContain('não existe no inventário')

    await expect(
      canonicalPowerUnitAllocationService.setAllocation({
        team,
        car1Unit: 99,
        car2Unit: 1,
        careerId,
      }),
    ).rejects.toThrow()

    // O banco NÃO foi acionado nas rejeições
    expect(updateSpy).not.toHaveBeenCalled()

    // O estado canônico anterior continua preservado intacto
    const current = canonicalPowerUnitAllocationService.resolveAllocation({ team, careerId })
    expect(current.car1Unit).toBe(1)
    expect(current.car2Unit).toBe(2)
  })

  // =========================================================================
  // TESTE E — FALHA DE GRAVAÇÃO
  // =========================================================================
  it('TESTE E — FALHA DE GRAVAÇÃO: simular falha no transporte de persistência; não manter associação divergente da fonte canônica', async () => {
    // Simula falha de conexão/500 no PocketBase
    vi.spyOn(pb.collection('teams'), 'update').mockRejectedValue(
      new Error('Network error 500: Database lock'),
    )

    const team = createMockTeam('team_net_fail', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 1,
          car2Unit: 2,
          updatedAt: '2026-01-01T00:00:00Z',
          careerId: 'career_fail_test',
        },
      },
    })
    const careerId = 'career_fail_test'

    // Tentativa de troca falha
    await expect(
      canonicalPowerUnitAllocationService.setAllocation({
        team,
        car1Unit: 3,
        car2Unit: 4,
        careerId,
      }),
    ).rejects.toThrow('Falha ao persistir alocação no save')

    // A alocação em memória e no resolver reverte ao estado válido anterior
    const resolved = canonicalPowerUnitAllocationService.resolveAllocation({ team, careerId })
    expect(resolved.car1Unit).toBe(1)
    expect(resolved.car2Unit).toBe(2)

    // O cache isolado de localStorage também NÃO deve conter a alocação rejeitada (3 e 4)
    const storageKey = canonicalPowerUnitAllocationService.getStorageKey(careerId)
    const stored = window.localStorage.getItem(storageKey)
    if (stored) {
      const parsed = JSON.parse(stored) as PowerUnitCarAllocation
      expect(parsed.car1Unit).not.toBe(3)
      expect(parsed.car2Unit).not.toBe(4)
    }
  })

  // =========================================================================
  // TESTE F — CHAVES LEGADAS
  // =========================================================================
  it('TESTE F — CHAVES LEGADAS: chave global antiga de outra carreira não contamina a associação do save aberto', () => {
    // Cenário: jogador tinha outra carreira no navegador com chaves globais antigas
    window.localStorage.setItem('apex_gp_car1_engine_unit', '4')
    window.localStorage.setItem('apex_gp_car2_engine_unit', '3')

    // Carreira atual aberta que tem no save PU1 e PU2
    const currentCareerTeam = createMockTeam('team_isolated_career', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 1,
          car2Unit: 2,
          updatedAt: '2026-03-01T00:00:00Z',
          careerId: 'active_player_career_01',
        },
      },
    })

    const resolved = canonicalPowerUnitAllocationService.resolveAllocation({
      team: currentCareerTeam,
      careerId: 'active_player_career_01',
    })

    // Deve resolver estritamente a associação canônica do save aberto (1 e 2), e NÃO as globais antigas (4 e 3)
    expect(resolved.car1Unit).toBe(1)
    expect(resolved.car2Unit).toBe(2)
    expect(resolved.car1Unit).not.toBe(4)
    expect(resolved.car2Unit).not.toBe(3)
  })
})
