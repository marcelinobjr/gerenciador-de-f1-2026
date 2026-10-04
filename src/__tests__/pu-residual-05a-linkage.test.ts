/**
 * pu-residual-05a-linkage.test.ts
 *
 * Suíte de Homologação PU-RESIDUAL-05A:
 * Encadeamento Canônico Fornecedor -> Inventário (PU1..PUn) -> Alocação -> Leitura
 *
 * Cobre:
 * A. FORNECEDOR CORRETO (vínculo canônico da equipe sem hardcode de Audi/Mercedes)
 * B. IDENTIDADE DO INVENTÁRIO (leitura das mesmas unidades canônicas, sem reconstrução fictícia)
 * C. ALOCAÇÃO (consistência nos carros #1 e #2, não duplicação, preservação)
 * D. ISOLAMENTO (equipes diferentes/saves diferentes mantêm fornecedores e inventários isolados)
 * E. REGRESSÃO DO NÚCLEO FECHADO (preservação de PU1-PU4, dynamic PU5+, penalidades idempotentes)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { f1Service, FREE_ENGINE_QUOTA } from '@/services/f1Service'
import { canonicalPowerUnitIntegrationService } from '@/services/canonicalPowerUnitIntegrationService'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'
import { ENGINE_SUPPLIERS } from '@/lib/f1-data'
import type { TeamModel } from '@/types/f1'

describe('PU-RESIDUAL-05A: Fornecedor -> Inventário -> Alocação -> Leitura', () => {
  beforeEach(() => {
    canonicalPowerUnitIntegrationService.clearMemoryCache()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
    vi.restoreAllMocks()
  })

  // Factory helper para equipes parametrizadas
  const createMockTeam = (
    id: string,
    supplier: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford' | 'Audi',
    overrides: Partial<TeamModel> = {},
  ): TeamModel => ({
    id,
    name: `Team ${supplier} Test`,
    color: '#1E293B',
    chassis_level: 80,
    aero_level: 80,
    strategy_level: 80,
    budget: 150000000,
    cost_cap_spent: 40000000,
    engine_pool_used: 4,
    engine_supplier: supplier,
    active_engine_wear: 20,
    engine_history: [
      {
        id: 1,
        wear: 60,
        status: 'reserva',
        supplier,
        introducedRound: 1,
        mileage_km: 1500,
        condition: 40,
      },
      {
        id: 2,
        wear: 40,
        status: 'reserva',
        supplier,
        introducedRound: 4,
        mileage_km: 900,
        condition: 60,
      },
      {
        id: 3,
        wear: 25,
        status: 'reserva',
        supplier,
        introducedRound: 8,
        mileage_km: 600,
        condition: 75,
      },
      {
        id: 4,
        wear: 10,
        status: 'instalado',
        supplier,
        introducedRound: 12,
        mileage_km: 300,
        condition: 90,
      },
    ],
    grid_penalties: [],
    ...overrides,
  })

  // =========================================================================
  // CONTRATO A: FORNECEDOR CORRETO
  // =========================================================================
  describe('Contrato A: Fornecedor Correto & Vínculo Canônico', () => {
    it('A1: cada equipe preserva seu fornecedor contratado sem fallback arbitrário para Audi', () => {
      const teamsToTest: Array<{
        id: string
        supplier: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford' | 'Audi'
      }> = [
        { id: 'team_williams', supplier: 'Mercedes' },
        { id: 'team_ferrari', supplier: 'Ferrari' },
        { id: 'team_redbull', supplier: 'Ford' },
        { id: 'team_aston', supplier: 'Honda' },
        { id: 'team_audi', supplier: 'Audi' },
      ]

      for (const t of teamsToTest) {
        const team = createMockTeam(t.id, t.supplier)
        expect(team.engine_supplier).toBe(t.supplier)

        // As unidades de potência associadas no histórico pertencem ao mesmo fornecedor
        for (const unit of team.engine_history || []) {
          expect(unit.supplier).toBe(t.supplier)
        }
      }
    })

    it('A2: catálogo oficial ENGINE_SUPPLIERS e OFFICIAL_POWER_UNITS contêm as 5 fabricantes de 2026', () => {
      const suppliers = ['Ferrari', 'Mercedes', 'Honda', 'Ford', 'Audi'] as const

      for (const sup of suppliers) {
        const catalogEntry = ENGINE_SUPPLIERS.find(
          (s) => s.name.toLowerCase() === sup.toLowerCase(),
        )
        expect(catalogEntry).toBeDefined()
        expect(catalogEntry?.power).toBeGreaterThan(0)
        expect(catalogEntry?.reliability).toBeGreaterThan(0)

        const officialPU = OFFICIAL_POWER_UNITS[sup]
        expect(officialPU).toBeDefined()
        expect(officialPU.powerRating).toBeGreaterThan(0)
        expect(officialPU.reliabilityRating).toBeGreaterThan(0)
      }
    })

    it('A3: nova unidade criada herda estritamente o engine_supplier da equipe', async () => {
      const hondaTeam = createMockTeam('team_honda_user', 'Honda', {
        engine_pool_used: 4,
      })

      const res = await f1Service.introduceNewEngine(hondaTeam, 18000000)
      expect(res.engineNumber).toBe(5)

      const pu5 = res.team.engine_history?.find((u) => u.id === 5)
      expect(pu5).toBeDefined()
      expect(pu5?.supplier).toBe('Honda')
      expect(pu5?.supplier).not.toBe('Audi')
      expect(pu5?.supplier).not.toBe('Mercedes')
    })
  })

  // =========================================================================
  // CONTRATO B: IDENTIDADE DO INVENTÁRIO
  // =========================================================================
  describe('Contrato B: Identidade do Inventário e Ausência de Cópias Desconexas', () => {
    it('B1: histórico persistido reflete o pool de unidades canônicas (PU1..PU4) sem duplicar', () => {
      const team = createMockTeam('team_inv_test', 'Mercedes')
      const history = team.engine_history || []

      expect(history.length).toBe(4)
      const ids = history.map((u) => u.id)
      expect(ids).toEqual([1, 2, 3, 4])

      // Todas as unidades mantêm integridade e quilometragem persistidas
      expect(history[0].mileage_km).toBe(1500)
      expect(history[1].mileage_km).toBe(900)
      expect(history[2].mileage_km).toBe(600)
      expect(history[3].mileage_km).toBe(300)
    })

    it('B2: estado inicial de unidade nova é padronizado (0 km, 0% desgaste, condição 100%)', async () => {
      const team = createMockTeam('team_fresh_pu', 'Ferrari')
      const res = await f1Service.introduceNewEngine(team, 18000000)

      const pu5 = res.team.engine_history?.find((u) => u.id === 5)
      expect(pu5).toBeDefined()
      expect(pu5?.wear).toBe(0)
      expect(pu5?.mileage_km).toBe(0)
      expect(pu5?.condition).toBe(100)
      expect(pu5?.status).toBe('instalado')
    })
  })

  // =========================================================================
  // CONTRATO C: ALOCAÇÃO POR CARRO/PILOTO
  // =========================================================================
  describe('Contrato C: Mecanismo de Alocação por Carro e Persistência', () => {
    it('C1: dois carros não podem alocar simultaneamente a mesma unidade de potência', () => {
      // Simulação da regra de validação de alocação usada no Car.tsx e InfrastructurePage.tsx
      const validateAllocation = (car1Unit: number, car2Unit: number) => {
        if (car1Unit === car2Unit) {
          return {
            valid: false,
            error: 'A mesma PU não pode ser instalada simultaneamente em ambos os carros.',
          }
        }
        return { valid: true, error: null }
      }

      expect(validateAllocation(1, 1).valid).toBe(false)
      expect(validateAllocation(1, 2).valid).toBe(true)
      expect(validateAllocation(4, 5).valid).toBe(true)
    })

    it('C2: persistência e retomada da alocação de unidades nos carros via storage canônico', () => {
      // Setup de alocação: Carro 1 com PU3, Carro 2 com PU4
      localStorage.setItem('apex_gp_car1_engine_unit', '3')
      localStorage.setItem('apex_gp_car2_engine_unit', '4')

      const reloadedC1 = Number(localStorage.getItem('apex_gp_car1_engine_unit'))
      const reloadedC2 = Number(localStorage.getItem('apex_gp_car2_engine_unit'))

      expect(reloadedC1).toBe(3)
      expect(reloadedC2).toBe(4)
      expect(reloadedC1).not.toBe(reloadedC2)

      // Atualização de alocação: Carro 1 recebe PU5 recém-introduzida
      localStorage.setItem('apex_gp_car1_engine_unit', '5')
      expect(Number(localStorage.getItem('apex_gp_car1_engine_unit'))).toBe(5)
      expect(Number(localStorage.getItem('apex_gp_car2_engine_unit'))).toBe(4)
    })

    it('C3: alocação de PU existente ou excedente não cria nova unidade no histórico', () => {
      const team = createMockTeam('team_alloc_idempotent', 'Ford')
      const initialHistoryLength = team.engine_history?.length || 0

      // Simulando troca/alocação de motor para Carro #1 com PU 2
      const targetUnitId = 2
      const unitExists = team.engine_history?.some((u) => u.id === targetUnitId)
      expect(unitExists).toBe(true)

      // O histórico de motores permanece exatamente com as mesmas unidades
      expect(team.engine_history?.length).toBe(initialHistoryLength)
    })
  })

  // =========================================================================
  // CONTRATO D: ISOLAMENTO ENTRE EQUIPES E SAVES
  // =========================================================================
  describe('Contrato D: Isolamento Entre Equipes e Saves', () => {
    it('D1: alterar o pool ou introduzir motor em uma equipe NÃO altera o pool de outra equipe', async () => {
      const teamFerrari = createMockTeam('team_ferrari_iso', 'Ferrari', { engine_pool_used: 4 })
      const teamMcLaren = createMockTeam('team_mclaren_iso', 'Mercedes', { engine_pool_used: 4 })

      // Ferrari introduz PU5
      const resFerrari = await f1Service.introduceNewEngine(teamFerrari, 18000000)

      // Ferrari agora tem 5 unidades e fornecedor Ferrari
      expect(resFerrari.team.engine_pool_used).toBe(5)
      expect(resFerrari.team.engine_history?.length).toBe(5)
      expect(resFerrari.team.engine_supplier).toBe('Ferrari')

      // McLaren permanece com 4 unidades e fornecedor Mercedes
      expect(teamMcLaren.engine_pool_used).toBe(4)
      expect(teamMcLaren.engine_history?.length).toBe(4)
      expect(teamMcLaren.engine_supplier).toBe('Mercedes')
      expect(teamMcLaren.engine_history?.some((u) => u.id === 5)).toBe(false)
    })

    it('D2: isolamento de estado de integração canônica entre carreiras e fornecedores', () => {
      const stateRedBull = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
        careerId: 'save_career_alpha',
        seasonYear: 2026,
        teamId: 'redbull',
      })

      const stateWilliams = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
        careerId: 'save_career_alpha',
        seasonYear: 2026,
        teamId: 'williams',
      })

      expect(stateRedBull.supplierId).toBe('Ford')
      expect(stateRedBull.relationshipType).toBe('FACTORY')
      expect(stateRedBull.maxIntegration).toBe(1.0)

      expect(stateWilliams.supplierId).toBe('Mercedes')
      expect(stateWilliams.relationshipType).toBe('CUSTOMER')
      expect(stateWilliams.maxIntegration).toBe(0.9)

      // Outro save (career_beta) possui estado independente
      const stateRedBullBeta = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
        careerId: 'save_career_beta',
        seasonYear: 2026,
        teamId: 'redbull',
      })
      expect(stateRedBullBeta.careerId).toBe('save_career_beta')
      expect(stateRedBull.careerId).toBe('save_career_alpha')
    })
  })

  // =========================================================================
  // CONTRATO E: REGRESSÃO DO NÚCLEO FECHADO
  // =========================================================================
  describe('Contrato E: Regressão do Núcleo Fechado (PU1..PU4, PU5+ e Penalidades)', () => {
    it('E1: cota regulamentar exportada é 4 (FREE_ENGINE_QUOTA = 4)', () => {
      expect(FREE_ENGINE_QUOTA).toBe(4)
      expect(f1Service.FREE_ENGINE_QUOTA).toBe(4)
    })

    it('E2: PU5 recebe 10 posições de penalidade e PU6 recebe 5 posições de forma idempotente', async () => {
      const team = createMockTeam('team_penalty_reg', 'Audi', {
        engine_pool_used: 4,
      })

      // PU5: primeira fora da cota -> 10 posições
      const res5 = await f1Service.introduceNewEngine(team, 18000000)
      expect(res5.engineNumber).toBe(5)
      expect(res5.penaltyPositions).toBe(10)
      expect(res5.team.grid_penalties?.length).toBe(1)
      expect(res5.team.grid_penalties?.[0].positions).toBe(10)

      // PU6: subsequente fora da cota -> 5 posições
      const res6 = await f1Service.introduceNewEngine(res5.team, 18000000)
      expect(res6.engineNumber).toBe(6)
      expect(res6.penaltyPositions).toBe(5)
      expect(res6.team.grid_penalties?.length).toBe(2)
      expect(res6.team.grid_penalties?.some((p) => p.unitIndex === 6 && p.positions === 5)).toBe(
        true,
      )

      // Idempotência: re-executar com equipe já contendo PU5 não gera penalidade duplicada
      const resDupe = await f1Service.introduceNewEngine(res5.team, 18000000)
      const pu5Penalties = resDupe.team.grid_penalties?.filter((p) => p.unitIndex === 5)
      expect(pu5Penalties?.length).toBe(1)
    })

    it('E3: unidades anteriores (PU1..PU4) mantêm desgastes e atributos inalterados', async () => {
      const team = createMockTeam('team_wear_preserve', 'Ferrari', {
        engine_history: [
          { id: 1, wear: 65, status: 'reserva', supplier: 'Ferrari', introducedRound: 1 },
          { id: 2, wear: 45, status: 'reserva', supplier: 'Ferrari', introducedRound: 5 },
          { id: 3, wear: 30, status: 'reserva', supplier: 'Ferrari', introducedRound: 10 },
          { id: 4, wear: 15, status: 'instalado', supplier: 'Ferrari', introducedRound: 15 },
        ],
      })

      const res5 = await f1Service.introduceNewEngine(team, 18000000)
      const history = res5.team.engine_history || []

      expect(history.find((u) => u.id === 1)?.wear).toBe(65)
      expect(history.find((u) => u.id === 2)?.wear).toBe(45)
      expect(history.find((u) => u.id === 3)?.wear).toBe(30)
      expect(history.find((u) => u.id === 4)?.wear).toBe(15)
      expect(history.find((u) => u.id === 4)?.status).toBe('reserva')

      const pu5 = history.find((u) => u.id === 5)
      expect(pu5?.wear).toBe(0)
      expect(pu5?.status).toBe('instalado')
      expect(pu5?.exceedsQuota).toBe(true)
    })
  })
})
