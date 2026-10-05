/**
 * pu-05a2-p3-a-usage-projection.test.ts
 *
 * Suíte de Homologação PU-05A2-P3-A:
 * Materializar projeção de uso de cada unidade de potência por participante
 * a partir da sessão de corrida, pronta para futura persistência no inventário.
 *
 * PROVAS EXIGIDAS PELO BRIEFING:
 * A. DOIS CARROS, USOS DISTINTOS:
 *    - Unidades diferentes (PU-1 e PU-2) e quantidades diferentes de voltas completadas (ex: 50 laps e 22 laps por DNF).
 *    - Cada registro tem sua própria distância e unidade, independente da ordem no grid ou do carro que abandonou antes.
 * B. ZERO USO:
 *    - Sem quilometragem reconhecida (0 laps) -> zero km.
 *    - Unidade não utilizada não recebe uso de outra.
 * C. CONDIÇÃO / DESGASTE:
 *    - Exercitar o mecanismo canônico:
 *      * Condição final corrente presente na sessão -> desgaste apurado fielmente (initial - current).
 *      * Condição zero (0) válida tratada estritamente como esgotamento mecânico, não falsy/ausência.
 *      * Se powerUnitCondition ausente na sessão, identificar rigorosamente a pendência sem fabricar números.
 * D. REPETIÇÃO SEM MUTAÇÃO:
 *    - Duas apurações sobre o mesmo estado produzem exatamente a mesma projeção.
 *    - CanonicalRaceState recebido permanece estritamente inalterado (deep equal).
 *    - Sem efeitos colaterais em banco, inventário ou journal.
 * E. IDENTIDADE DA SESSÃO:
 *    - Sprint e Corrida Principal na mesma rodada produzem identidades e sessionKeys distintas,
 *      garantindo futura aplicação idempotente.
 */

import { describe, it, expect } from 'vitest'
import {
  projectSessionPowerUnitUsage,
  buildCanonicalSessionKey,
  resolveSessionCircuitLengthKm,
} from '@/services/canonicalPowerUnitUsageProjectionService'
import type { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'

function createMockDriver(
  overrides: Partial<CanonicalRaceDriverState> = {},
): CanonicalRaceDriverState {
  return {
    careerId: 'career_save_01',
    season: 2026,
    raceId: 'race_s2026_r1_main',
    driverId: 'driver_1',
    driverName: 'Test Driver 1',
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
    powerUnitInitialCondition: 95,
    powerUnitCondition: 82,
    ...overrides,
  }
}

function createMockRaceState(overrides: Partial<CanonicalRaceState> = {}): CanonicalRaceState {
  const driver1 = createMockDriver({
    driverId: 'player_drv_1',
    driverName: 'Piloto Carro 1',
    carId: 'car1',
    carIndex: 1,
    gridPosition: 1,
    currentPosition: 1,
    powerUnitId: 1,
    powerUnitInitialCondition: 95,
    powerUnitCondition: 82,
    lap: 50,
  })

  const driver2 = createMockDriver({
    driverId: 'player_drv_2',
    driverName: 'Piloto Carro 2',
    carId: 'car2',
    carIndex: 2,
    gridPosition: 6,
    currentPosition: 18,
    powerUnitId: 2,
    powerUnitInitialCondition: 80,
    powerUnitCondition: 68,
    lap: 22,
    raceStatus: 'dnf',
    isDnf: true,
    dnfReason: 'Superaquecimento do Motor Turbo 2026',
    dnfLap: 22,
  })

  return {
    version: '2.0',
    saveSchemaVersion: 'race-save-v1',
    raceVariant: 'MAIN_RACE',
    careerId: 'career_save_01',
    season: 2026,
    round: 1,
    raceId: 'race_career_save_01_s2026_r1',
    circuitName: 'Bahrain International Circuit',
    circuitCountry: 'Bahrein',
    circuitLengthKm: 5.412,
    totalLaps: 57,
    currentLap: 51,
    status: 'running',
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

describe('PU-05A2-P3-A: Materialização da Projeção de Uso de Power Unit', () => {
  // =========================================================================
  // BLOCO A: DOIS CARROS, USOS DISTINTOS
  // =========================================================================
  describe('A. Dois carros com unidades e usos distintos', () => {
    it('apura corretamente unidades diferentes, voltas e km distintos quando um abandona antes do outro', () => {
      const state = createMockRaceState()
      const report = projectSessionPowerUnitUsage(state)

      expect(report.totalParticipants).toBe(2)
      expect(report.linkedParticipantsCount).toBe(2)
      expect(report.unlinkedParticipantsCount).toBe(0)

      const projCar1 = report.projections.find((p) => p.driverId === 'player_drv_1')
      const projCar2 = report.projections.find((p) => p.driverId === 'player_drv_2')

      expect(projCar1).toBeDefined()
      expect(projCar2).toBeDefined()

      // Carro 1: PU-1, completou 50 voltas a 5.412 km/volta = 270.6 km
      expect(projCar1?.powerUnitId).toBe(1)
      expect(projCar1?.lapsCompleted).toBe(50)
      expect(projCar1?.circuitLengthKm).toBe(5.412)
      expect(projCar1?.distanceKm).toBe(270.6)
      expect(projCar1?.initialCondition).toBe(95)
      expect(projCar1?.finalCondition).toBe(82)
      expect(projCar1?.wearDebit).toBe(13) // 95 - 82 = 13% de débito
      expect(projCar1?.wearDebitStatus).toBe('RECOGNIZED')

      // Carro 2: PU-2, abandonou na volta 22 = 22 voltas completadas * 5.412 km = 119.064 km
      expect(projCar2?.powerUnitId).toBe(2)
      expect(projCar2?.lapsCompleted).toBe(22)
      expect(projCar2?.circuitLengthKm).toBe(5.412)
      expect(projCar2?.distanceKm).toBe(119.064)
      expect(projCar2?.initialCondition).toBe(80)
      expect(projCar2?.finalCondition).toBe(68)
      expect(projCar2?.wearDebit).toBe(12) // 80 - 68 = 12% de débito
      expect(projCar2?.wearDebitStatus).toBe('RECOGNIZED')

      // Independência estrita: unidades e distâncias distintas
      expect(projCar1?.powerUnitId).not.toBe(projCar2?.powerUnitId)
      expect(projCar1?.distanceKm).not.toBe(projCar2?.distanceKm)
      expect(projCar1?.distanceKm).toBeGreaterThan(projCar2?.distanceKm!)
    })

    it('mantém uso e distância da unidade independentemente da ordem no grid ou na prova', () => {
      // Inverte a ordem no grid/posição: P1 agora é driver2, P2 é driver1
      const state = createMockRaceState({
        drivers: [
          createMockDriver({
            driverId: 'player_drv_2',
            gridPosition: 1,
            currentPosition: 1,
            lap: 10,
            powerUnitId: 4,
            powerUnitInitialCondition: 85,
            powerUnitCondition: 80,
          }),
          createMockDriver({
            driverId: 'player_drv_1',
            gridPosition: 20,
            currentPosition: 2,
            lap: 40,
            powerUnitId: 3,
            powerUnitInitialCondition: 100,
            powerUnitCondition: 90,
          }),
        ],
      })

      const report = projectSessionPowerUnitUsage(state)
      const p1 = report.projections.find((p) => p.driverId === 'player_drv_1')
      const p2 = report.projections.find((p) => p.driverId === 'player_drv_2')

      expect(p1?.powerUnitId).toBe(3)
      expect(p1?.lapsCompleted).toBe(40)
      expect(p1?.distanceKm).toBe(Number((40 * 5.412).toFixed(3)))

      expect(p2?.powerUnitId).toBe(4)
      expect(p2?.lapsCompleted).toBe(10)
      expect(p2?.distanceKm).toBe(Number((10 * 5.412).toFixed(3)))
    })
  })

  // =========================================================================
  // BLOCO B: ZERO USO E ISOLAMENTO DE UNIDADES
  // =========================================================================
  describe('B. Zero uso e isolamento de unidades', () => {
    it('carro sem voltas completadas (DNS ou abandono na largada antes da volta 1) registra zero km', () => {
      const state = createMockRaceState({
        drivers: [
          createMockDriver({
            driverId: 'drv_dns',
            lap: 0,
            powerUnitId: 1,
            powerUnitInitialCondition: 100,
            powerUnitCondition: 100,
          }),
        ],
      })

      const report = projectSessionPowerUnitUsage(state)
      const proj = report.projections[0]

      expect(proj.lapsCompleted).toBe(0)
      expect(proj.distanceKm).toBe(0)
      expect(proj.wearDebit).toBe(0)
      expect(proj.wearDebitStatus).toBe('ZERO_WEAR')
    })

    it('unidade não utilizada por um carro não recebe quilometragem de outra unidade', () => {
      // Dois carros: Carro 1 correu com PU-1 (30 voltas); Carro 2 não largou com PU-2 (0 voltas)
      const state = createMockRaceState({
        drivers: [
          createMockDriver({
            driverId: 'active_car',
            carId: 'car1',
            powerUnitId: 1,
            lap: 30,
            powerUnitInitialCondition: 90,
            powerUnitCondition: 85,
          }),
          createMockDriver({
            driverId: 'idle_car',
            carId: 'car2',
            powerUnitId: 2,
            lap: 0,
            powerUnitInitialCondition: 90,
            powerUnitCondition: 90,
          }),
        ],
      })

      const report = projectSessionPowerUnitUsage(state)
      const pu1 = report.projections.find((p) => p.powerUnitId === 1)
      const pu2 = report.projections.find((p) => p.powerUnitId === 2)

      expect(pu1?.distanceKm).toBeGreaterThan(0)
      expect(pu2?.distanceKm).toBe(0)
      expect(pu2?.wearDebit).toBe(0)
    })
  })

  // =========================================================================
  // BLOCO C: CONDIÇÃO E DESGASTE
  // =========================================================================
  describe('C. Condição e desgaste canônico', () => {
    it('apura fielmente quando a condição corrente atinge o limite inferior zero (0%)', () => {
      // Condição 0 é um limite regulamentar estrito válido (motor totalmente desgastado)
      const state = createMockRaceState({
        drivers: [
          createMockDriver({
            driverId: 'dead_engine_drv',
            powerUnitId: 1,
            powerUnitInitialCondition: 30,
            powerUnitCondition: 0,
            lap: 25,
          }),
        ],
      })

      const report = projectSessionPowerUnitUsage(state)
      const proj = report.projections[0]

      expect(proj.initialCondition).toBe(30)
      expect(proj.finalCondition).toBe(0)
      expect(proj.wearDebit).toBe(30) // 30 - 0 = 30
      expect(proj.wearDebitStatus).toBe('RECOGNIZED')
    })

    it('identifica rigorosamente a pendência de evolução de PU em sessão quando powerUnitCondition estiver ausente', () => {
      // Estado real do motor de corrida V2 onde powerUnitCondition não foi injetado/evoluído
      const state = createMockRaceState({
        drivers: [
          createMockDriver({
            driverId: 'driver_no_live_pu',
            powerUnitId: 2,
            powerUnitInitialCondition: 85,
            powerUnitCondition: undefined, // Motor V2 atualizou carCondition, mas não gravou powerUnitCondition
            carCondition: 78,
            lap: 28,
          }),
        ],
      })

      const report = projectSessionPowerUnitUsage(state)
      const proj = report.projections[0]

      // Apura a quilometragem perfeitamente
      expect(proj.lapsCompleted).toBe(28)
      expect(proj.distanceKm).toBe(Number((28 * 5.412).toFixed(3)))

      // Não inventa nem deduz o desgaste a partir de carCondition!
      expect(proj.finalCondition).toBeNull()
      expect(proj.wearDebit).toBeNull()
      expect(proj.wearDebitStatus).toBe('PENDING_ENGINE_SESSION_EVOLUTION')
      expect(proj.pendingReason).toContain(
        'powerUnitCondition não foi evoluído pelo motor de corrida',
      )
      expect(report.pendingWearDriverIds).toContain('driver_no_live_pu')
    })

    it('identifica participantes rivais sem vínculo individual (legado/não instrumentado)', () => {
      const state = createMockRaceState({
        drivers: [
          createMockDriver({
            driverId: 'player_drv',
            isPlayer: true,
            powerUnitId: 1,
            powerUnitInitialCondition: 90,
            powerUnitCondition: 85,
            lap: 50,
          }),
          createMockDriver({
            driverId: 'rival_drv',
            isPlayer: false,
            powerUnitId: undefined,
            powerUnitInitialCondition: undefined,
            powerUnitCondition: undefined,
            carCondition: 95,
            lap: 50,
          }),
        ],
      })

      const report = projectSessionPowerUnitUsage(state)
      expect(report.linkedParticipantsCount).toBe(1)
      expect(report.unlinkedParticipantsCount).toBe(1)
      expect(report.unlinkedDriverIds).toContain('rival_drv')

      const rivalProj = report.projections.find((p) => p.driverId === 'rival_drv')
      expect(rivalProj?.hasValidLinkage).toBe(false)
      expect(rivalProj?.wearDebitStatus).toBe('LEGACY_UNLINKED')
      expect(rivalProj?.distanceKm).toBe(Number((50 * 5.412).toFixed(3))) // km é reconhecido mesmo sem vínculo
    })
  })

  // =========================================================================
  // BLOCO D: REPETIÇÃO SEM MUTAÇÃO (FUNÇÃO PURA)
  // =========================================================================
  describe('D. Repetição sem mutação de estado', () => {
    it('duas apurações sobre o mesmo estado produzem exatamente a mesma projeção sem efeitos colaterais', () => {
      const state = createMockRaceState()
      const originalSnapshot = JSON.stringify(state)

      const report1 = projectSessionPowerUnitUsage(state)
      const report2 = projectSessionPowerUnitUsage(state)

      // Saídas rigorosamente iguais
      expect(report1).toEqual(report2)

      // Estado de entrada estritamente inalterado
      expect(JSON.stringify(state)).toBe(originalSnapshot)
    })
  })

  // =========================================================================
  // BLOCO E: IDENTIDADE DA SESSÃO (SPRINT vs PRINCIPAL)
  // =========================================================================
  describe('E. Identidade da sessão: Sprint vs Corrida Principal', () => {
    it('sprint e corrida principal na mesma rodada produzem sessionKeys e identidades distintas', () => {
      const mainKey = buildCanonicalSessionKey('career_01', 2026, 2, 'MAIN_RACE')
      const sprintKey = buildCanonicalSessionKey('career_01', 2026, 2, 'SPRINT_RACE')

      expect(mainKey).toBe('career_01_s2026_r2_main')
      expect(sprintKey).toBe('career_01_s2026_r2_sprint')
      expect(mainKey).not.toBe(sprintKey)

      const sprintState = createMockRaceState({
        raceVariant: 'SPRINT_RACE',
        round: 2,
        raceId: 'race_sprint_r2',
      })
      const mainState = createMockRaceState({
        raceVariant: 'MAIN_RACE',
        round: 2,
        raceId: 'race_main_r2',
      })

      const sprintReport = projectSessionPowerUnitUsage(sprintState)
      const mainReport = projectSessionPowerUnitUsage(mainState)

      expect(sprintReport.raceVariant).toBe('SPRINT_RACE')
      expect(mainReport.raceVariant).toBe('MAIN_RACE')
      expect(sprintReport.sessionKey).toBe('career_save_01_s2026_r2_sprint')
      expect(mainReport.sessionKey).toBe('career_save_01_s2026_r2_main')
      expect(sprintReport.sessionKey).not.toBe(mainReport.sessionKey)
    })

    it('resolve extensão do circuito a partir do calendário F1 2026 quando ausente no estado', () => {
      const stateWithoutKm = createMockRaceState({
        circuitLengthKm: undefined,
        round: 1, // Bahrein: 5.412 km
      })

      const len = resolveSessionCircuitLengthKm(stateWithoutKm)
      expect(len).toBe(5.412)
    })
  })
})
