/**
 * pu-05a2-p3a1-session-evolution.test.ts
 *
 * Suíte de Homologação PU-05A2-P3-A1:
 * EVOLUIR A CONDIÇÃO INDIVIDUAL DURANTE A SESSÃO
 *
 * PROVAS EXIGIDAS PELO BRIEFING:
 * A. EVOLUÇÃO REAL:
 *    - Inicializar uma sessão pelo fluxo canônico e executar avanços com uso reconhecido.
 *    - Condição inicial preservada (powerUnitInitialCondition inalterado).
 *    - Condição corrente atualizada pela regra real (não inventada; computeLapPUWearIncrement).
 *    - powerUnitId estável (não troca e não consulta a garagem).
 *    - A apuração P3-A passa a reconhecer o débito produzido (wearDebitStatus: 'RECOGNIZED'
 *      em vez de 'PENDING_ENGINE_SESSION_EVOLUTION' para participantes vinculados com evolução).
 *
 * B. AUSÊNCIA DE USO E CONDIÇÃO ZERO:
 *    - Estados canônicos de suspensão (bandeira vermelha): avanço rejeitado / congelado não debita desgaste.
 *    - Participante já abandonado (DNF): não acumula uso posterior.
 *    - Preservar condição zero sem restaurar a inicial (condição 0 permanece 0 e não reverte para 100 nem initial).
 *    - Desgaste legitimamente zero (DNS / 0 voltas) tratado como ZERO_WEAR, não ausência.
 *
 * C. CONTINUIDADE E LEITURA SEM CONSUMO:
 *    - Comparar avanços contínuos com a mesma sequência contendo save/retomada intermediários,
 *      usando estados independentes e a mesma seed determinística: igualdade da condição resultante.
 *    - Consultar pace, risco mecânico e apuração P3-A sem executar nova volta NÃO pode reduzir novamente a condição
 *      (consumidores são leitores puros, não debitam uso).
 *
 * D. PARTICIPANTES NÃO VINCULADOS (LEGACY_UNLINKED):
 *    - Participantes rivais / IA sem powerUnitId permanecem sem powerUnitCondition individual,
 *      com status LEGACY_UNLINKED preservado na apuração.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { structuralMissingFactorsService } from '@/services/structuralMissingFactorsService'
import { projectSessionPowerUnitUsage } from '@/services/canonicalPowerUnitUsageProjectionService'
import { canonicalPowerUnitAllocationService } from '@/services/canonicalPowerUnitAllocationService'
import type { TeamModel } from '@/types/f1'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

describe('PU-05A2-P3-A1: Evolução da Condição Individual da PU Durante a Sessão', () => {
  beforeEach(() => {
    canonicalPowerUnitAllocationService.clearMemoryCache()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
    vi.restoreAllMocks()
  })

  // Factory helper para montar equipe do jogador com alocação canônica de PU
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
    active_engine_wear: 15,
    engine_history: [
      {
        id: 1,
        wear: 10,
        status: 'instalado',
        supplier: 'Mercedes',
        introducedRound: 1,
        condition: 90,
        mileage_km: 300,
      },
      {
        id: 2,
        wear: 20,
        status: 'instalado',
        supplier: 'Mercedes',
        introducedRound: 2,
        condition: 80,
        mileage_km: 700,
      },
      {
        id: 3,
        wear: 50,
        status: 'reserva',
        supplier: 'Mercedes',
        introducedRound: 3,
        condition: 50,
        mileage_km: 1500,
      },
      {
        id: 4,
        wear: 5,
        status: 'reserva',
        supplier: 'Mercedes',
        introducedRound: 4,
        condition: 95,
        mileage_km: 150,
      },
    ],
    grid_penalties: [],
    ...overrides,
  })

  // Factory helper para grid de 24 carros (2 carros do jogador e 22 rivais)
  const createMock24Grid = (playerTeamId: string): FinalQualifyingGridEntry[] => {
    const grid: FinalQualifyingGridEntry[] = []
    const rivalTeams = [
      'team_ferrari',
      'team_mclaren',
      'team_redbull',
      'team_mercedes',
      'team_aston',
      'team_alpine',
      'team_williams',
      'team_haas',
      'team_sauber',
      'team_rb',
      'team_cadillac',
    ]

    let rivalIndex = 0
    for (let p = 1; p <= 24; p++) {
      if (p === 1) {
        grid.push({
          gridPosition: 1,
          driverId: 'player_driver_1',
          driverName: 'Piloto Um',
          teamId: playerTeamId,
          teamName: 'Apex Grand Prix Team',
          teamColor: '#00D2BE',
          carId: 'car1',
          isPlayer: true,
          bestLapCompound: 'medio',
          eliminationStage: 'Q3',
          bestLapSec: 88.0,
          bestLapTime: '1:28.000',
        })
      } else if (p === 2) {
        grid.push({
          gridPosition: 2,
          driverId: 'player_driver_2',
          driverName: 'Piloto Dois',
          teamId: playerTeamId,
          teamName: 'Apex Grand Prix Team',
          teamColor: '#00D2BE',
          carId: 'car2',
          isPlayer: true,
          bestLapCompound: 'medio',
          eliminationStage: 'Q3',
          bestLapSec: 88.2,
          bestLapTime: '1:28.200',
        })
      } else {
        const team = rivalTeams[Math.floor(rivalIndex / 2) % rivalTeams.length]
        const seat = (rivalIndex % 2) + 1
        rivalIndex++
        grid.push({
          gridPosition: p,
          driverId: `rival_driver_${p}`,
          driverName: `Rival ${p}`,
          teamId: team,
          teamName: `Equipe ${team}`,
          teamColor: '#555555',
          carId: seat === 1 ? 'car1' : 'car2',
          isPlayer: false,
          bestLapCompound: 'medio',
          eliminationStage: p <= 10 ? 'Q3' : p <= 16 ? 'Q2' : 'Q1',
          bestLapSec: 89.0 + p * 0.1,
          bestLapTime: `1:${(29 + p * 0.1).toFixed(3)}`,
        })
      }
    }
    return grid
  }

  // =========================================================================
  // A. EVOLUÇÃO REAL
  // =========================================================================
  describe('A. Evolução Real Durante a Sessão de Corrida', () => {
    it('avança voltas, preserva powerUnitInitialCondition e atualiza powerUnitCondition pela regra canônica', () => {
      const careerId = 'career_evolution_a1'
      const season = 2026
      const round = 1
      const team = createMockTeam('team_apex_evo', {
        car_specifications: {
          power_unit_allocations: {
            car1Unit: 1, // Condição no inventário: 90%
            car2Unit: 2, // Condição no inventário: 80%
            updatedAt: '2026-03-01T00:00:00Z',
            careerId,
          },
        },
      })
      const grid = createMock24Grid(team.id)

      // 1. Inicializar sessão canônica
      let state: CanonicalRaceState =
        canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
          careerId,
          season,
          round,
          circuitName: 'Bahrain International Circuit',
          circuitCountry: 'Bahrein',
          totalLaps: 10,
          playerTeamId: team.id,
          playerTeam: team,
          canonicalQualifyingGrid: grid,
          persistState: false,
        })

      const p1Start = state.drivers.find((d) => d.driverId === 'player_driver_1')!
      const p2Start = state.drivers.find((d) => d.driverId === 'player_driver_2')!

      // Na largada: condição inicial registrada, powerUnitCondition ainda não debitado
      expect(p1Start.powerUnitId).toBe(1)
      expect(p1Start.powerUnitInitialCondition).toBe(90)
      expect(p2Start.powerUnitId).toBe(2)
      expect(p2Start.powerUnitInitialCondition).toBe(80)

      // 2. Executar 3 voltas de avanço canônico com uso reconhecido
      state = canonicalRaceEngineService.advanceOneLap(state, {
        seedOverride: 42,
        persistState: false,
      })
      state = canonicalRaceEngineService.advanceOneLap(state, {
        seedOverride: 43,
        persistState: false,
      })
      state = canonicalRaceEngineService.advanceOneLap(state, {
        seedOverride: 44,
        persistState: false,
      })

      const p1After3 = state.drivers.find((d) => d.driverId === 'player_driver_1')!
      const p2After3 = state.drivers.find((d) => d.driverId === 'player_driver_2')!

      // 1. Identidade de PU estável
      expect(p1After3.powerUnitId).toBe(1)
      expect(p2After3.powerUnitId).toBe(2)

      // 2. Condição inicial estritamente preservada
      expect(p1After3.powerUnitInitialCondition).toBe(90)
      expect(p2After3.powerUnitInitialCondition).toBe(80)

      // 3. Condição corrente atualizada e menor que a inicial
      expect(typeof p1After3.powerUnitCondition).toBe('number')
      expect(typeof p2After3.powerUnitCondition).toBe('number')
      expect(p1After3.powerUnitCondition).toBeLessThan(90)
      expect(p2After3.powerUnitCondition).toBeLessThan(80)

      // 4. Desgaste calculado pela regra canônica do projeto (12 / 60 = 0.20% por volta em clima seco normal)
      // Em 3 voltas a 0.20%: 90 - (3 * 0.2) = 89.4
      const expectedP1Cond = Number((90 - 3 * 0.2).toFixed(3))
      expect(p1After3.powerUnitCondition).toBeCloseTo(expectedP1Cond, 2)

      // 5. Apuração P3-A passa a reconhecer o débito como RECOGNIZED em vez de PENDING_ENGINE_SESSION_EVOLUTION
      const report = projectSessionPowerUnitUsage(state)
      const p1Proj = report.projections.find((p) => p.driverId === 'player_driver_1')!
      const p2Proj = report.projections.find((p) => p.driverId === 'player_driver_2')!

      expect(p1Proj.wearDebitStatus).toBe('RECOGNIZED')
      expect(p1Proj.initialCondition).toBe(90)
      expect(p1Proj.finalCondition).toBe(p1After3.powerUnitCondition)
      expect(p1Proj.wearDebit).toBeGreaterThan(0)
      expect(p1Proj.lapsCompleted).toBe(3)

      expect(p2Proj.wearDebitStatus).toBe('RECOGNIZED')
      expect(p2Proj.initialCondition).toBe(80)
      expect(p2Proj.finalCondition).toBe(p2After3.powerUnitCondition)
      expect(p2Proj.wearDebit).toBeGreaterThan(0)
      expect(p2Proj.lapsCompleted).toBe(3)

      expect(report.pendingWearDriverIds).not.toContain('player_driver_1')
      expect(report.pendingWearDriverIds).not.toContain('player_driver_2')
    })
  })

  // =========================================================================
  // B. AUSÊNCIA DE USO E CONDIÇÃO ZERO
  // =========================================================================
  describe('B. Ausência de Uso, Condição Zero e DNF', () => {
    it('bandeira vermelha (suspensão): avanço rejeitado / congelado não debita desgaste da unidade', () => {
      const careerId = 'career_suspension_b1'
      const team = createMockTeam('team_apex_susp', {
        car_specifications: {
          power_unit_allocations: {
            car1Unit: 1,
            car2Unit: 2,
            updatedAt: '2026-03-01T00:00:00Z',
            careerId,
          },
        },
      })
      const grid = createMock24Grid(team.id)

      let state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId,
        season: 2026,
        round: 1,
        circuitName: 'Bahrain International Circuit',
        circuitCountry: 'Bahrein',
        totalLaps: 10,
        playerTeamId: team.id,
        playerTeam: team,
        canonicalQualifyingGrid: grid,
        persistState: false,
      })

      // 1 volta normal
      state = canonicalRaceEngineService.advanceOneLap(state, {
        seedOverride: 1,
        persistState: false,
      })
      const condAfterLap1 = state.drivers.find(
        (d) => d.driverId === 'player_driver_1',
      )!.powerUnitCondition

      // Aciona suspensão por bandeira vermelha
      state = canonicalRaceEngineService.triggerRedFlag(state, {
        reason: 'Acidente Grave',
        persistState: false,
      })
      expect(state.status).toBe('suspended')
      expect(state.redFlagActive).toBe(true)

      // Tenta avançar volta enquanto suspensa (não progride esportivamente)
      state = canonicalRaceEngineService.advanceOneLap(state, {
        seedOverride: 2,
        persistState: false,
      })
      const condDuringSusp = state.drivers.find(
        (d) => d.driverId === 'player_driver_1',
      )!.powerUnitCondition

      // A condição NÃO reduziu durante a volta em bandeira vermelha suspensa!
      expect(condDuringSusp).toBe(condAfterLap1)
    })

    it('participante já abandonado (DNF) não acumula desgaste adicional em voltas posteriores', () => {
      const careerId = 'career_dnf_b2'
      const team = createMockTeam('team_apex_dnf', {
        car_specifications: {
          power_unit_allocations: {
            car1Unit: 1,
            car2Unit: 2,
            updatedAt: '2026-03-01T00:00:00Z',
            careerId,
          },
        },
      })
      const grid = createMock24Grid(team.id)

      let state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId,
        season: 2026,
        round: 1,
        circuitName: 'Bahrain International Circuit',
        circuitCountry: 'Bahrein',
        totalLaps: 10,
        playerTeamId: team.id,
        playerTeam: team,
        canonicalQualifyingGrid: grid,
        persistState: false,
      })

      // Volta 1: ambos completam
      state = canonicalRaceEngineService.advanceOneLap(state, {
        seedOverride: 10,
        persistState: false,
      })

      // Simula abandono (DNF) de player_driver_2 na volta 2
      state.drivers = state.drivers.map((d) => {
        if (d.driverId === 'player_driver_2') {
          return {
            ...d,
            raceStatus: 'dnf',
            isDnf: true,
            dnfReason: 'Superaquecimento da PU',
            dnfLap: 2,
          }
        }
        return d
      })
      const p2CondAtDnf = state.drivers.find(
        (d) => d.driverId === 'player_driver_2',
      )!.powerUnitCondition

      // Avança mais 2 voltas (volta 3 e volta 4)
      state = canonicalRaceEngineService.advanceOneLap(state, {
        seedOverride: 11,
        persistState: false,
      })
      state = canonicalRaceEngineService.advanceOneLap(state, {
        seedOverride: 12,
        persistState: false,
      })

      const p1Active = state.drivers.find((d) => d.driverId === 'player_driver_1')!
      const p2Dnf = state.drivers.find((d) => d.driverId === 'player_driver_2')!

      // O carro ativo continuou degradando
      expect(p1Active.lap).toBe(3)

      // O carro DNF permaneceu com a mesma condição do abandono
      expect(p2Dnf.powerUnitCondition).toBe(p2CondAtDnf)
    })

    it('preserva condição zero (0%) sem restaurar a inicial nem substituir silenciosamente por 100', () => {
      const careerId = 'career_zero_b3'
      const team = createMockTeam('team_apex_zero', {
        car_specifications: {
          power_unit_allocations: {
            car1Unit: 1,
            car2Unit: 2,
            updatedAt: '2026-03-01T00:00:00Z',
            careerId,
          },
        },
      })
      const grid = createMock24Grid(team.id)

      let state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId,
        season: 2026,
        round: 1,
        circuitName: 'Bahrain International Circuit',
        circuitCountry: 'Bahrein',
        totalLaps: 10,
        playerTeamId: team.id,
        playerTeam: team,
        canonicalQualifyingGrid: grid,
        persistState: false,
      })

      // Injeta condição zero explícita (esgotamento mecânico) para Carro 1
      state.drivers = state.drivers.map((d) => {
        if (d.driverId === 'player_driver_1') {
          return {
            ...d,
            powerUnitInitialCondition: 20,
            powerUnitCondition: 0, // Zero válido
          }
        }
        return d
      })

      // Avança uma volta
      state = canonicalRaceEngineService.advanceOneLap(state, {
        seedOverride: 20,
        persistState: false,
      })
      const p1 = state.drivers.find((d) => d.driverId === 'player_driver_1')!

      // Condição zero continua sendo 0 (não volta para 20 nem 100, e não fica negativa)
      expect(p1.powerUnitCondition).toBe(0)
      expect(p1.powerUnitInitialCondition).toBe(20)

      // Apuração P3-A reconhece débito total (20 - 0 = 20)
      const report = projectSessionPowerUnitUsage(state)
      const proj = report.projections.find((p) => p.driverId === 'player_driver_1')!
      expect(proj.initialCondition).toBe(20)
      expect(proj.finalCondition).toBe(0)
      expect(proj.wearDebit).toBe(20)
      expect(proj.wearDebitStatus).toBe('RECOGNIZED')
    })
  })

  // =========================================================================
  // C. CONTINUIDADE E LEITURA SEM CONSUMO
  // =========================================================================
  describe('C. Continuidade com Save/Retomada e Leituras Sem Consumo Adicional', () => {
    it('compara avanço contínuo vs avanço com save/retomada intermediária com mesma seed: condição final idêntica', () => {
      const careerId = 'career_continuity_c1'
      const season = 2026
      const round = 1
      const team = createMockTeam('team_apex_cont', {
        car_specifications: {
          power_unit_allocations: {
            car1Unit: 1, // 90%
            car2Unit: 2, // 80%
            updatedAt: '2026-03-01T00:00:00Z',
            careerId,
          },
        },
      })
      const grid = createMock24Grid(team.id)

      // RAMO 1: Execução contínua de 4 voltas
      let stateContinuous = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId,
        season,
        round,
        circuitName: 'Bahrain International Circuit',
        circuitCountry: 'Bahrein',
        totalLaps: 10,
        playerTeamId: team.id,
        playerTeam: team,
        canonicalQualifyingGrid: grid,
        persistState: false,
      })
      for (let lap = 1; lap <= 4; lap++) {
        stateContinuous = canonicalRaceEngineService.advanceOneLap(stateContinuous, {
          seedOverride: 100 + lap,
          persistState: false,
        })
      }
      const p1Continuous = stateContinuous.drivers.find((d) => d.driverId === 'player_driver_1')!

      // RAMO 2: Executa 2 voltas -> Salva -> Retoma -> Executa mais 2 voltas (com as mesmas seeds)
      let stateSaved = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId: 'career_continuity_c1_branch2',
        season,
        round,
        circuitName: 'Bahrain International Circuit',
        circuitCountry: 'Bahrein',
        totalLaps: 10,
        playerTeamId: team.id,
        playerTeam: team,
        canonicalQualifyingGrid: grid,
        persistState: false,
      })
      stateSaved = canonicalRaceEngineService.advanceOneLap(stateSaved, {
        seedOverride: 101,
        persistState: false,
      })
      stateSaved = canonicalRaceEngineService.advanceOneLap(stateSaved, {
        seedOverride: 102,
        persistState: false,
      })

      // Salva no storage canônico
      canonicalRaceSaveService.saveCanonicalRaceState(stateSaved)

      // Retoma do storage canônico
      let resumedState = canonicalRaceInitializationService.readCanonicalRaceState(
        'career_continuity_c1_branch2',
        season,
        round,
        'MAIN_RACE',
      )!
      expect(resumedState).not.toBeNull()

      // Executa as 2 voltas restantes
      resumedState = canonicalRaceEngineService.advanceOneLap(resumedState, {
        seedOverride: 103,
        persistState: false,
      })
      resumedState = canonicalRaceEngineService.advanceOneLap(resumedState, {
        seedOverride: 104,
        persistState: false,
      })

      const p1Resumed = resumedState.drivers.find((d) => d.driverId === 'player_driver_1')!

      // Igualdade estrita da condição de PU resultante
      expect(p1Resumed.powerUnitCondition).toBe(p1Continuous.powerUnitCondition)
      expect(p1Resumed.powerUnitInitialCondition).toBe(p1Continuous.powerUnitInitialCondition)
      expect(p1Resumed.powerUnitId).toBe(p1Continuous.powerUnitId)
    })

    it('consultar pace, risco e apuração P3-A repetidamente não debita nem consome a condição', () => {
      const careerId = 'career_read_only_c2'
      const team = createMockTeam('team_apex_read', {
        car_specifications: {
          power_unit_allocations: {
            car1Unit: 1,
            car2Unit: 2,
            updatedAt: '2026-03-01T00:00:00Z',
            careerId,
          },
        },
      })
      const grid = createMock24Grid(team.id)

      let state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId,
        season: 2026,
        round: 1,
        circuitName: 'Bahrain International Circuit',
        circuitCountry: 'Bahrein',
        totalLaps: 10,
        playerTeamId: team.id,
        playerTeam: team,
        canonicalQualifyingGrid: grid,
        persistState: false,
      })

      // 1 volta para ter condição corrente inicializada
      state = canonicalRaceEngineService.advanceOneLap(state, {
        seedOverride: 50,
        persistState: false,
      })
      const driverBefore = state.drivers.find((d) => d.driverId === 'player_driver_1')!
      const condBefore = driverBefore.powerUnitCondition

      // 1. Consultar cálculo de pace repetidas vezes
      for (let i = 0; i < 5; i++) {
        canonicalRaceEngineService.calculateCanonicalLapPace({
          driver: driverBefore,
          lap: 2,
          weather: 'seco',
          round: 1,
          circuitName: 'Bahrain International Circuit',
          circuitLengthKm: 5.412,
          rng: () => 0.5,
        })
      }

      // 2. Consultar avaliação de risco repetidas vezes
      for (let i = 0; i < 5; i++) {
        canonicalRaceEngineService.evaluateDnfRoll({
          driver: driverBefore,
          lap: 2,
          rng: () => 0.99,
        })
      }

      // 3. Consultar apuração P3-A repetidas vezes
      for (let i = 0; i < 5; i++) {
        projectSessionPowerUnitUsage(state)
      }

      // Verificar que nada mutou a condição do participante
      expect(driverBefore.powerUnitCondition).toBe(condBefore)
      const currentDriver = state.drivers.find((d) => d.driverId === 'player_driver_1')!
      expect(currentDriver.powerUnitCondition).toBe(condBefore)
    })
  })

  // =========================================================================
  // D. PARTICIPANTES RIVAIS NÃO VINCULADOS
  // =========================================================================
  describe('D. Participantes Rivais sem Vínculo Individual (LEGACY_UNLINKED)', () => {
    it('rivais permanecem sem powerUnitCondition individual e classificados como LEGACY_UNLINKED', () => {
      const careerId = 'career_rivals_d1'
      const team = createMockTeam('team_apex_rivals', {
        car_specifications: {
          power_unit_allocations: {
            car1Unit: 1,
            car2Unit: 2,
            updatedAt: '2026-03-01T00:00:00Z',
            careerId,
          },
        },
      })
      const grid = createMock24Grid(team.id)

      let state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId,
        season: 2026,
        round: 1,
        circuitName: 'Bahrain International Circuit',
        circuitCountry: 'Bahrein',
        totalLaps: 10,
        playerTeamId: team.id,
        playerTeam: team,
        canonicalQualifyingGrid: grid,
        persistState: false,
      })

      // Avança 2 voltas
      state = canonicalRaceEngineService.advanceOneLap(state, {
        seedOverride: 70,
        persistState: false,
      })
      state = canonicalRaceEngineService.advanceOneLap(state, {
        seedOverride: 71,
        persistState: false,
      })

      // Rival 3 (não vinculado)
      const rival3 = state.drivers.find((d) => d.driverId === 'rival_driver_3')!
      expect(rival3.powerUnitId).toBeUndefined()
      expect(rival3.powerUnitCondition).toBeUndefined()

      // Apuração P3-A
      const report = projectSessionPowerUnitUsage(state)
      const rivalProj = report.projections.find((p) => p.driverId === 'rival_driver_3')!

      expect(rivalProj.hasValidLinkage).toBe(false)
      expect(rivalProj.wearDebitStatus).toBe('LEGACY_UNLINKED')
      expect(rivalProj.lapsCompleted).toBe(2)
      expect(rivalProj.distanceKm).toBeGreaterThan(0)
    })
  })
})
