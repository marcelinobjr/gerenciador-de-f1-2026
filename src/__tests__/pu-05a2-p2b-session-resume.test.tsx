/**
 * pu-05a2-p2b-session-resume.test.tsx
 *
 * Suíte de Testes PU-05A2-P2b-T2:
 * PROVA REAL DE SALVAR E RETOMAR (Apex GP Manager, F1 2026)
 *
 * OBJETIVO ÚNICO:
 * Comprovar que salvar e retomar a corrida oficial preserva a unidade de potência
 * vinculada a cada participante, sua condição e o resultado do cálculo esportivo.
 *
 * PROVAS EXIGIDAS:
 * 1. CAMINHO REAL DE PERSISTÊNCIA:
 *    Chama os mecanismos reais utilizados por /corrida/live (canonicalRaceInitializationService.saveCanonicalRaceState
 *    e canonicalRaceInitializationService.readCanonicalRaceState / canonicalRaceSaveService.loadCanonicalRaceState).
 *
 * 2. PROVA A — IDENTIDADE E CONDIÇÃO PRESERVADAS:
 *    Sessão com 2 participantes da equipe do jogador, unidades distintas (ex: PU-1 e PU-2),
 *    associações obtidas pelo fluxo canônico. Salvar e retomar.
 *    Condição corrente diferente da inicial (detecta restauração indevida da inicial).
 *    Condição corrente zero (válida no contrato): retomar não a converte em ausência nem em condição inicial.
 *    Confirmar que carregar não avança a volta, não reinicializa a corrida e não restaura a condição da unidade na garagem.
 *
 * 3. PROVA B — MESMO RESULTADO ESPORTIVO:
 *    Estados independentes e equivalentes: (A) estado da sessão antes de salvar; (B) estado recuperado pelo carregamento real.
 *    Com as mesmas entradas esportivas e RNG determinístico:
 *    Exercitar os consumidores reais validados no T1 (pace e risco mecânico).
 *    Confirmar igualdade estrita: condição/desgaste efetivamente utilizado, contribuição no pace, risco mecânico calculado.
 *
 * 4. PROVA C — GARAGEM NÃO SUBSTITUI A UNIDADE DA SESSÃO:
 *    Após a sessão registrar unidades A/B, representar no armazenamento uma montagem posterior C/D.
 *    Retomar a sessão salva: ela deve continuar usando suas unidades A/B, a condição registrada na sessão e o resultado correspondente.
 *
 * 5. PROVA D — LEGADO:
 *    Fixture genuína de sessão legada, sem vínculo individual. Salvar/retomar pelo caminho real.
 *    Confirmar preservação do comportamento anterior, ausência de vínculo retroativo e referência esportiva legada mantida (8,5%).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { structuralMissingFactorsService } from '@/services/structuralMissingFactorsService'
import { canonicalPowerUnitAllocationService } from '@/services/canonicalPowerUnitAllocationService'
import type { TeamModel } from '@/types/f1'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

describe('PU-05A2-P2b-T2: Prova Real de Salvar e Retomar a Sessão de Corrida Oficial', () => {
  const deterministicRng = () => 0.5

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
        wear: 15,
        status: 'instalado',
        supplier: 'Mercedes',
        introducedRound: 1,
        condition: 85,
        mileage_km: 500,
      },
      {
        id: 2,
        wear: 35,
        status: 'instalado',
        supplier: 'Mercedes',
        introducedRound: 2,
        condition: 65,
        mileage_km: 1100,
      },
      {
        id: 3,
        wear: 55,
        status: 'reserva',
        supplier: 'Mercedes',
        introducedRound: 3,
        condition: 45,
        mileage_km: 1800,
      },
      {
        id: 4,
        wear: 5,
        status: 'reserva',
        supplier: 'Mercedes',
        introducedRound: 4,
        condition: 95,
        mileage_km: 200,
      },
    ],
    grid_penalties: [],
    ...overrides,
  })

  const createMock24Grid = (
    playerTeamId: string,
    playerCar1Pos: number = 1,
    playerCar2Pos: number = 2,
  ): FinalQualifyingGridEntry[] => {
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
      if (p === playerCar1Pos) {
        grid.push({
          gridPosition: p,
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
      } else if (p === playerCar2Pos) {
        grid.push({
          gridPosition: p,
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

  beforeEach(() => {
    canonicalPowerUnitAllocationService.clearMemoryCache()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
    vi.restoreAllMocks()
  })

  // =========================================================================
  // 1. CAMINHO REAL DE PERSISTÊNCIA: MECANISMOS DE SALVAR E RETOMAR DE /corrida/live
  // =========================================================================
  describe('1. Caminho Real de Persistência Usado por /corrida/live', () => {
    it('chama saveCanonicalRaceState e readCanonicalRaceState mantendo a sessão na chave oficial', () => {
      const careerId = 'career_pu_live_path'
      const season = 2026
      const round = 1
      const team = createMockTeam('team_apex_live', {
        car_specifications: {
          power_unit_allocations: {
            car1Unit: 1,
            car2Unit: 2,
            updatedAt: '2026-03-01T00:00:00Z',
            careerId,
          },
        },
      })
      const grid = createMock24Grid(team.id, 1, 2)

      const initialSession = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId,
        season,
        round,
        circuitName: 'Bahrain International Circuit',
        circuitCountry: 'Bahrain',
        totalLaps: 57,
        playerTeamId: team.id,
        playerTeam: team,
        canonicalQualifyingGrid: grid,
        persistState: true,
      })

      expect(initialSession).toBeDefined()

      // Leitura via caminho real de /corrida/live
      const resumedSession = canonicalRaceInitializationService.readCanonicalRaceState(
        careerId,
        season,
        round,
        'MAIN_RACE',
      )

      expect(resumedSession).not.toBeNull()
      expect(resumedSession?.careerId).toBe(careerId)
      expect(resumedSession?.round).toBe(round)
      expect(resumedSession?.drivers.length).toBe(24)
    })
  })

  // =========================================================================
  // 2. PROVA A: IDENTIDADE E CONDIÇÃO PRESERVADAS (INCLUINDO CONDIÇÃO ZERO)
  // =========================================================================
  describe('2. PROVA A — Identidade e Condição Preservadas ao Retomar', () => {
    it('salvar e retomar preserva carId, driverId, powerUnitId, powerUnitInitialCondition e powerUnitCondition corrente diferente da inicial', () => {
      const careerId = 'career_pu_prova_a'
      const season = 2026
      const round = 2
      const team = createMockTeam('team_apex_prova_a', {
        car_specifications: {
          power_unit_allocations: {
            car1Unit: 1, // Condição inicial no inventário: 85
            car2Unit: 2, // Condição inicial no inventário: 65
            updatedAt: '2026-03-05T00:00:00Z',
            careerId,
          },
        },
      })
      const grid = createMock24Grid(team.id, 4, 9)

      // 1. Inicializar sessão canônica
      const session = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId,
        season,
        round,
        circuitName: 'Jeddah Corniche Circuit',
        circuitCountry: 'Saudi Arabia',
        totalLaps: 50,
        playerTeamId: team.id,
        playerTeam: team,
        canonicalQualifyingGrid: grid,
        persistState: false,
      })

      // 2. Simular avanço na corrida e degradação corrente durante a sessão
      // Carro 1: powerUnitInitialCondition = 85, mas agora degradou para 72 (diferente da inicial)
      // Carro 2: powerUnitInitialCondition = 65, mas agora degradou para 0 (limite inferior extremo válido)
      session.currentLap = 15
      session.status = 'running'
      session.drivers = session.drivers.map((d) => {
        if (d.driverId === 'player_driver_1') {
          return {
            ...d,
            lap: 15,
            powerUnitCondition: 72, // Corrente DIFERENTE da inicial 85
          }
        }
        if (d.driverId === 'player_driver_2') {
          return {
            ...d,
            lap: 15,
            powerUnitCondition: 0, // Corrente ZERO estrita
          }
        }
        return { ...d, lap: 15 }
      })

      // Atualiza driverLookup
      session.driverLookup = {}
      for (const d of session.drivers) {
        session.driverLookup[d.driverId] = d
      }

      // 3. Salvar pelo mecanismo real
      const saveRes = canonicalRaceSaveService.saveCanonicalRaceState(session)
      expect(saveRes.success).toBe(true)

      // 4. Retomar pelo mecanismo real
      const loaded = canonicalRaceInitializationService.readCanonicalRaceState(
        careerId,
        season,
        round,
        'MAIN_RACE',
      )

      expect(loaded).not.toBeNull()
      const resumedCar1 = loaded!.drivers.find((d) => d.driverId === 'player_driver_1')
      const resumedCar2 = loaded!.drivers.find((d) => d.driverId === 'player_driver_2')

      // Identidade preservada
      expect(resumedCar1?.driverId).toBe('player_driver_1')
      expect(resumedCar1?.carId).toBe('car1')
      expect(resumedCar1?.powerUnitId).toBe(1)
      expect(resumedCar1?.powerUnitInitialCondition).toBe(85)
      expect(resumedCar1?.powerUnitCondition).toBe(72)
      // Não restaurou a inicial 85
      expect(resumedCar1?.powerUnitCondition).not.toBe(resumedCar1?.powerUnitInitialCondition)

      // Condição corrente ZERO preservada (não tratada como falsy nem revertida para 65 nem undefined)
      expect(resumedCar2?.driverId).toBe('player_driver_2')
      expect(resumedCar2?.carId).toBe('car2')
      expect(resumedCar2?.powerUnitId).toBe(2)
      expect(resumedCar2?.powerUnitInitialCondition).toBe(65)
      expect(resumedCar2?.powerUnitCondition).toBe(0)
      expect(resumedCar2?.powerUnitCondition).not.toBeUndefined()
      expect(resumedCar2?.powerUnitCondition).not.toBe(resumedCar2?.powerUnitInitialCondition)

      // Confirmar que carregar não avança a volta e não reinicializa a corrida
      expect(loaded!.currentLap).toBe(15)
      expect(loaded!.status).toBe('running')
      expect(loaded!.drivers.every((d) => d.lap === 15)).toBe(true)
    })
  })

  // =========================================================================
  // 3. PROVA B: MESMO RESULTADO ESPORTIVO (PACE E RISCO MECÂNICO)
  // =========================================================================
  describe('3. PROVA B — Mesmo Resultado Esportivo (Pace e Risco Mecânico Reais)', () => {
    it('compara estado antes de salvar (A) com estado retomado pelo carregamento real (B) gerando cálculos de pace e risco idênticos', () => {
      const careerId = 'career_pu_prova_b'
      const season = 2026
      const round = 3
      const team = createMockTeam('team_apex_prova_b', {
        car_specifications: {
          power_unit_allocations: {
            car1Unit: 1, // condição 85
            car2Unit: 3, // condição 45
            updatedAt: '2026-03-10T00:00:00Z',
            careerId,
          },
        },
      })
      const grid = createMock24Grid(team.id, 1, 2)

      // Sessão base
      const sessionBeforeSave = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId,
        season,
        round,
        circuitName: 'Albert Park Circuit',
        circuitCountry: 'Australia',
        totalLaps: 58,
        playerTeamId: team.id,
        playerTeam: team,
        canonicalQualifyingGrid: grid,
        persistState: false,
      })

      // Evolução de desgaste durante a prova:
      sessionBeforeSave.currentLap = 20
      sessionBeforeSave.drivers = sessionBeforeSave.drivers.map((d) => {
        if (d.driverId === 'player_driver_1') {
          return {
            ...d,
            lap: 20,
            powerUnitCondition: 70, // Desgaste 30%
            fuel: 65,
            tyreAge: 10,
          }
        }
        if (d.driverId === 'player_driver_2') {
          return {
            ...d,
            lap: 20,
            powerUnitCondition: 0, // Desgaste 100%
            fuel: 65,
            tyreAge: 10,
          }
        }
        return { ...d, lap: 20 }
      })
      sessionBeforeSave.driverLookup = {}
      for (const d of sessionBeforeSave.drivers) {
        sessionBeforeSave.driverLookup[d.driverId] = d
      }

      // Snapshot independente (A) antes de salvar:
      const stateBeforeSave: CanonicalRaceState = JSON.parse(JSON.stringify(sessionBeforeSave))

      // Salvar pelo fluxo real
      canonicalRaceInitializationService.saveCanonicalRaceState(sessionBeforeSave)

      // Retomar pelo fluxo real (B)
      const stateAfterResume = canonicalRaceInitializationService.readCanonicalRaceState(
        careerId,
        season,
        round,
        'MAIN_RACE',
      )!

      expect(stateAfterResume).not.toBeNull()
      // Garantir que são objetos em instâncias de memória separadas
      expect(stateAfterResume).not.toBe(stateBeforeSave)

      // Spies dos consumidores reais
      const wearPenaltySpy = vi.spyOn(structuralMissingFactorsService, 'calculatePUWearPenalty')
      const mechanicalRiskSpy = vi.spyOn(
        structuralMissingFactorsService,
        'calculateMechanicalFailureRisk',
      )

      // -----------------------------------------------------------------------
      // Comparação 1: Piloto 1 (PU-1, condição corrente 70 -> desgaste 30%)
      // -----------------------------------------------------------------------
      const driverBefore1 = stateBeforeSave.drivers.find((d) => d.driverId === 'player_driver_1')!
      const driverResumed1 = stateAfterResume.drivers.find((d) => d.driverId === 'player_driver_1')!

      // 1.1 Pace
      const paceBefore1 = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driverBefore1,
        lap: 20,
        weather: 'seco',
        round: 3,
        circuitLengthKm: 5.278,
        rng: deterministicRng,
      })

      const paceResumed1 = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driverResumed1,
        lap: 20,
        weather: 'seco',
        round: 3,
        circuitLengthKm: 5.278,
        rng: deterministicRng,
      })

      expect(paceBefore1.lapTimeSec).toBe(paceResumed1.lapTimeSec)
      expect(paceBefore1.fuelBurnKg).toBe(paceResumed1.fuelBurnKg)
      expect(paceBefore1.tireWearIncrement).toBe(paceResumed1.tireWearIncrement)

      // 1.2 Risco Mecânico
      canonicalRaceEngineService.evaluateDnfRoll({
        driver: driverBefore1,
        lap: 20,
        rng: deterministicRng,
      })
      const riskBefore1 =
        mechanicalRiskSpy.mock.results[mechanicalRiskSpy.mock.results.length - 1].value

      canonicalRaceEngineService.evaluateDnfRoll({
        driver: driverResumed1,
        lap: 20,
        rng: deterministicRng,
      })
      const riskResumed1 =
        mechanicalRiskSpy.mock.results[mechanicalRiskSpy.mock.results.length - 1].value

      expect(riskBefore1.totalRiskPerLap).toBe(riskResumed1.totalRiskPerLap)
      expect(riskBefore1.puWear).toBe(30)
      expect(riskResumed1.puWear).toBe(30)

      // -----------------------------------------------------------------------
      // Comparação 2: Piloto 2 (PU-3, condição corrente 0 -> desgaste 100%)
      // -----------------------------------------------------------------------
      const driverBefore2 = stateBeforeSave.drivers.find((d) => d.driverId === 'player_driver_2')!
      const driverResumed2 = stateAfterResume.drivers.find((d) => d.driverId === 'player_driver_2')!

      // 2.1 Pace
      const paceBefore2 = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driverBefore2,
        lap: 20,
        weather: 'seco',
        round: 3,
        circuitLengthKm: 5.278,
        rng: deterministicRng,
      })

      const paceResumed2 = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driverResumed2,
        lap: 20,
        weather: 'seco',
        round: 3,
        circuitLengthKm: 5.278,
        rng: deterministicRng,
      })

      expect(paceBefore2.lapTimeSec).toBe(paceResumed2.lapTimeSec)
      expect(paceBefore2.fuelBurnKg).toBe(paceResumed2.fuelBurnKg)

      // 2.2 Risco Mecânico
      canonicalRaceEngineService.evaluateDnfRoll({
        driver: driverBefore2,
        lap: 20,
        rng: deterministicRng,
      })
      const riskBefore2 =
        mechanicalRiskSpy.mock.results[mechanicalRiskSpy.mock.results.length - 1].value

      canonicalRaceEngineService.evaluateDnfRoll({
        driver: driverResumed2,
        lap: 20,
        rng: deterministicRng,
      })
      const riskResumed2 =
        mechanicalRiskSpy.mock.results[mechanicalRiskSpy.mock.results.length - 1].value

      expect(riskBefore2.totalRiskPerLap).toBe(riskResumed2.totalRiskPerLap)
      expect(riskBefore2.puWear).toBe(100)
      expect(riskResumed2.puWear).toBe(100)
    })
  })

  // =========================================================================
  // 4. PROVA C: GARAGEM NÃO SUBSTITUI A UNIDADE DA SESSÃO
  // =========================================================================
  describe('4. PROVA C — Garagem Não Substitui a Unidade da Sessão ao Retomar', () => {
    it('alterar a alocação de unidades na garagem/storage não altera as unidades registradas na sessão salva ao retomá-la', () => {
      const careerId = 'career_pu_prova_c'
      const season = 2026
      const round = 4

      // 1. Sessão inicial aloca: Carro 1 -> PU-1; Carro 2 -> PU-2
      const teamOriginal = createMockTeam('team_apex_prova_c', {
        car_specifications: {
          power_unit_allocations: {
            car1Unit: 1, // PU-1 (condição 85)
            car2Unit: 2, // PU-2 (condição 65)
            updatedAt: '2026-04-01T00:00:00Z',
            careerId,
          },
        },
      })
      const grid = createMock24Grid(teamOriginal.id, 1, 2)

      const session = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId,
        season,
        round,
        circuitName: 'Baku City Circuit',
        circuitCountry: 'Azerbaijan',
        totalLaps: 51,
        playerTeamId: teamOriginal.id,
        playerTeam: teamOriginal,
        canonicalQualifyingGrid: grid,
        persistState: true,
      })

      // Sessão salva no disco com PU-1 e PU-2
      expect(session.drivers.find((d) => d.driverId === 'player_driver_1')?.powerUnitId).toBe(1)
      expect(session.drivers.find((d) => d.driverId === 'player_driver_2')?.powerUnitId).toBe(2)

      // 2. Modificar a montagem da garagem no armazenamento de teste (alocando unidades 3 e 4)
      // Representando montagem posterior na garagem conforme Prova C
      const storageKey = `apex_pu_alloc_${careerId}`
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          car1Unit: 3, // PU-3 (condição 45)
          car2Unit: 4, // PU-4 (condição 95)
          updatedAt: '2026-04-05T00:00:00Z',
          careerId,
          teamId: teamOriginal.id,
        }),
      )

      // 3. Retomar a sessão salva pelo caminho real
      const resumedSession = canonicalRaceInitializationService.readCanonicalRaceState(
        careerId,
        season,
        round,
        'MAIN_RACE',
      )

      expect(resumedSession).not.toBeNull()
      const d1 = resumedSession!.drivers.find((d) => d.driverId === 'player_driver_1')
      const d2 = resumedSession!.drivers.find((d) => d.driverId === 'player_driver_2')

      // A sessão retomada CONTINUA com as unidades A/B (PU-1 e PU-2), e NÃO as novas da garagem C/D (PU-3 e PU-4)
      expect(d1?.powerUnitId).toBe(1)
      expect(d1?.powerUnitInitialCondition).toBe(85)
      expect(d1?.powerUnitId).not.toBe(3)

      expect(d2?.powerUnitId).toBe(2)
      expect(d2?.powerUnitInitialCondition).toBe(65)
      expect(d2?.powerUnitId).not.toBe(4)

      // Cálculo esportivo da sessão retomada reflete estritamente a unidade 1 (desgaste 15%) e não a unidade 3 (desgaste 55%)
      const mechanicalRiskSpy = vi.spyOn(
        structuralMissingFactorsService,
        'calculateMechanicalFailureRisk',
      )

      canonicalRaceEngineService.evaluateDnfRoll({
        driver: d1!,
        lap: 1,
        rng: deterministicRng,
      })

      const riskD1 = mechanicalRiskSpy.mock.results[mechanicalRiskSpy.mock.results.length - 1].value
      expect(riskD1.puWear).toBe(15) // 100 - 85 = 15%, e NÃO 100 - 45 = 55%
      expect(riskD1.puWear).not.toBe(55)
    })
  })

  // =========================================================================
  // 5. PROVA D: SESSÃO LEGADA (SEM VÍNCULO INDIVIDUAL)
  // =========================================================================
  describe('5. PROVA D — Fixture Genuína de Sessão Legada', () => {
    it('retomar sessão legada sem campos de PU preserva ausência de vínculo, não consulta garagem e mantém referência legada de 8,5%', () => {
      const careerId = 'career_pu_prova_d_legacy'
      const season = 2026
      const round = 5

      // Fixture genuína legada (onde powerUnitId, powerUnitInitialCondition e powerUnitCondition não existiam)
      const legacySession: CanonicalRaceState = {
        version: '2.0',
        saveSchemaVersion: 'race-save-v1',
        raceVariant: 'MAIN_RACE',
        careerId,
        season,
        round,
        raceId: `race_${careerId}_s2026_r5`,
        circuitName: 'Circuit de Monaco',
        circuitCountry: 'Monaco',
        totalLaps: 78,
        currentLap: 12,
        status: 'running',
        safetyCarActive: false,
        vscActive: false,
        redFlagActive: false,
        weather: 'seco',
        simSpeed: 1,
        playerTeamId: 'team_apex_legacy',
        tactics: {},
        paceOrders: {},
        revision: 12,
        updatedAt: '2026-05-24T14:00:00Z',
        drivers: [
          {
            careerId,
            season,
            raceId: `race_${careerId}_s2026_r5`,
            driverId: 'player_drv_legacy_1',
            teamId: 'team_apex_legacy',
            gridPosition: 1,
            currentPosition: 1,
            lap: 12,
            raceTime: 1100.0,
            gap: 'LÍDER',
            tyreCompound: 'medio',
            tyreAge: 12,
            fuel: 75,
            carCondition: 90, // Desgaste agregado 10% -> (100 - 90) * 0.85 = 8.5%
            raceStatus: 'racing',
            pitStops: 0,
            driverName: 'Piloto Legado 1',
            teamName: 'Apex GP',
            teamColor: '#00D2BE',
            isPlayer: true,
            carId: 'car1',
            // powerUnitId ausente
            // powerUnitInitialCondition ausente
            // powerUnitCondition ausente
          },
          {
            careerId,
            season,
            raceId: `race_${careerId}_s2026_r5`,
            driverId: 'player_drv_legacy_2',
            teamId: 'team_apex_legacy',
            gridPosition: 2,
            currentPosition: 2,
            lap: 12,
            raceTime: 1101.5,
            gap: '+1.500s',
            tyreCompound: 'medio',
            tyreAge: 12,
            fuel: 75,
            carCondition: 90,
            raceStatus: 'racing',
            pitStops: 0,
            driverName: 'Piloto Legado 2',
            teamName: 'Apex GP',
            teamColor: '#00D2BE',
            isPlayer: true,
            carId: 'car2',
          },
        ],
        driverLookup: {},
      }

      // Adicionar 22 pilotos para compor o grid oficial de 24 do save
      for (let p = 3; p <= 24; p++) {
        legacySession.drivers.push({
          careerId,
          season,
          raceId: legacySession.raceId,
          driverId: `rival_legacy_${p}`,
          teamId: `rival_team_${p}`,
          gridPosition: p,
          currentPosition: p,
          lap: 12,
          raceTime: 1105.0 + p,
          gap: `+${(5 + p).toFixed(3)}s`,
          tyreCompound: 'duro',
          tyreAge: 12,
          fuel: 70,
          carCondition: 95,
          raceStatus: 'racing',
          pitStops: 0,
          driverName: `Rival ${p}`,
          teamName: `Rival Team ${p}`,
          teamColor: '#333333',
          isPlayer: false,
          carId: 'car1',
        })
      }

      // 1. Salvar pelo caminho real
      canonicalRaceSaveService.saveCanonicalRaceState(legacySession)

      // 2. Retomar pelo caminho real de /corrida/live
      const loadedLegacy = canonicalRaceInitializationService.readCanonicalRaceState(
        careerId,
        season,
        round,
        'MAIN_RACE',
      )

      expect(loadedLegacy).not.toBeNull()
      const legDrv1 = loadedLegacy!.drivers.find((d) => d.driverId === 'player_drv_legacy_1')
      const legDrv2 = loadedLegacy!.drivers.find((d) => d.driverId === 'player_drv_legacy_2')

      // Confirmar ausência de vínculo retroativo criado pela garagem
      expect(legDrv1?.powerUnitId).toBeUndefined()
      expect(legDrv1?.powerUnitInitialCondition).toBeUndefined()
      expect(legDrv1?.powerUnitCondition).toBeUndefined()

      expect(legDrv2?.powerUnitId).toBeUndefined()
      expect(legDrv2?.powerUnitInitialCondition).toBeUndefined()
      expect(legDrv2?.powerUnitCondition).toBeUndefined()

      // 3. Confirmar que os consumidores reais de pace e risco aplicam o cálculo de referência legada (8,5%)
      const wearPenaltySpy = vi.spyOn(structuralMissingFactorsService, 'calculatePUWearPenalty')
      const mechanicalRiskSpy = vi.spyOn(
        structuralMissingFactorsService,
        'calculateMechanicalFailureRisk',
      )

      // Pace legado
      canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: legDrv1!,
        lap: 12,
        weather: 'seco',
        round: 5,
        circuitLengthKm: 3.337,
        rng: deterministicRng,
      })

      expect(wearPenaltySpy).toHaveBeenCalled()
      const wearArgPace = wearPenaltySpy.mock.calls[wearPenaltySpy.mock.calls.length - 1][0]
      expect(wearArgPace).toBe(8.5) // (100 - 90) * 0.85 = 8.5%

      // Risco legado
      canonicalRaceEngineService.evaluateDnfRoll({
        driver: legDrv1!,
        lap: 12,
        rng: deterministicRng,
      })

      expect(mechanicalRiskSpy).toHaveBeenCalled()
      const riskArgDnf = mechanicalRiskSpy.mock.calls[mechanicalRiskSpy.mock.calls.length - 1][0]
      expect(riskArgDnf.puWear).toBe(8.5)
      expect(riskArgDnf.carCondition).toBe(90)
    })
  })
})
