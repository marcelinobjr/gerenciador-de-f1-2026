/**
 * pu-05a2-p3b-applier.test.ts
 *
 * Suíte de Testes PU-05A2-P3-B1:
 * Aplicador Persistente do Uso por Unidade de Potência
 *
 * PROVAS EXIGIDAS PELO BRIEFING:
 * A. APLICAÇÃO CORRETA:
 *    - Duas unidades utilizadas com km/desgaste distintos e uma terceira não utilizada.
 *    - Verificar incrementos/decrementos esperados em cada uma e que a terceira permanece intacta.
 *
 * B. REPETIÇÃO E RETOMADA:
 *    - Aplicar a mesma apuração novamente em outra instância do serviço, relendo o estado persistido.
 *    - Inventário permanece igual ao resultado da primeira aplicação (idempotência, sem duplo débito).
 *
 * C. SPRINT E PRINCIPAL:
 *    - Duas sessões válidas da mesma rodada com variantes distintas são aplicadas uma vez cada.
 *    - A marcação da Sprint não bloqueia o consumo da Corrida Principal.
 *
 * D. FALHA DE GRAVAÇÃO E REPETIÇÃO:
 *    - Exercitar a falha após uma unidade aplicada e antes de concluir a seguinte.
 *    - A repetição/retomada não duplica o débito da primeira unidade e aplica a segunda.
 *
 * E. REJEIÇÃO E PENDÊNCIAS:
 *    - Unidade inexistente / de outro save não pode ser debitada.
 *    - Registro sem desgaste reconhecido (LEGACY_UNLINKED / PENDING_ENGINE_SESSION_EVOLUTION)
 *      não pode virar sucesso.
 *    - Preservar unidades e registros válidos não envolvidos.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  CanonicalPowerUnitUsageApplierService,
  canonicalPowerUnitUsageApplierService,
} from '@/services/canonicalPowerUnitUsageApplierService'
import {
  projectSessionPowerUnitUsage,
  type SessionPowerUnitUsageProjectionReport,
} from '@/services/canonicalPowerUnitUsageProjectionService'
import type { TeamModel } from '@/types/f1'
import type { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'

function createMockTeam(
  teamId: string = 'team_audi',
  overrides: Partial<TeamModel> = {},
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
    ...overrides,
  }
}

function createMockDriver(
  overrides: Partial<CanonicalRaceDriverState> = {},
): CanonicalRaceDriverState {
  return {
    careerId: 'career_save_01',
    season: 2026,
    raceId: 'race_career_save_01_s2026_r1',
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
    powerUnitCondition: 80, // Débito reconhecido = 90 - 80 = 10%
    ...overrides,
  }
}

function createMockRaceState(overrides: Partial<CanonicalRaceState> = {}): CanonicalRaceState {
  const driver1 = createMockDriver({
    driverId: 'player_drv_1',
    driverName: 'Piloto 1',
    carId: 'car1',
    carIndex: 1,
    powerUnitId: 1,
    powerUnitInitialCondition: 90,
    powerUnitCondition: 80, // Débito = 10%
    lap: 50, // 50 voltas * 5 km = 250 km
  })

  const driver2 = createMockDriver({
    driverId: 'player_drv_2',
    driverName: 'Piloto 2',
    carId: 'car2',
    carIndex: 2,
    powerUnitId: 2,
    powerUnitInitialCondition: 80,
    powerUnitCondition: 75, // Débito = 5%
    lap: 25, // 25 voltas * 5 km = 125 km (DNF na volta 25)
    raceStatus: 'dnf',
    isDnf: true,
  })

  return {
    version: '2.0',
    saveSchemaVersion: 'race-save-v1',
    raceVariant: 'MAIN_RACE',
    careerId: 'career_save_01',
    season: 2026,
    round: 1,
    raceId: 'race_career_save_01_s2026_r1',
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

describe('PU-05A2-P3-B1: Aplicador Persistente do Uso por Unidade de Potência', () => {
  beforeEach(() => {
    canonicalPowerUnitUsageApplierService.clearJournalCache()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
    vi.restoreAllMocks()
  })

  // =========================================================================
  // TESTE A: APLICAÇÃO CORRETA
  // =========================================================================
  describe('A. Aplicação correta de km e desgaste em unidades utilizadas', () => {
    it('aplica km e desgaste distintos em duas unidades utilizadas e preserva a terceira não utilizada', async () => {
      const team = createMockTeam('team_audi')
      const raceState = createMockRaceState()
      const projectionReport = projectSessionPowerUnitUsage(raceState)

      const result = await canonicalPowerUnitUsageApplierService.applySessionPowerUnitUsage(
        projectionReport,
        {
          teamOverrides: { team_audi: team },
          dryRunOrLocalOnly: true,
        },
      )

      expect(result.status).toBe('SUCCESS')
      expect(result.appliedCount).toBe(2)
      expect(result.failedCount).toBe(0)
      expect(result.alreadyAppliedCount).toBe(0)

      // Verificar Unidade 1:
      // Início: km = 500, cond = 90, wear = 10
      // Projeção Carro 1: 50 voltas * 5.0 km = 250 km, débito = 10%
      // Final esperado: km = 750, cond = 80, wear = 20
      const u1 = team.engine_history?.find((e) => e.id === 1)
      expect(u1).toBeDefined()
      expect(u1?.mileage_km).toBe(750)
      expect(u1?.condition).toBe(80)
      expect(u1?.wear).toBe(20)

      // Verificar Unidade 2:
      // Início: km = 800, cond = 80, wear = 20
      // Projeção Carro 2: 25 voltas * 5.0 km = 125 km, débito = 5%
      // Final esperado: km = 925, cond = 75, wear = 25
      const u2 = team.engine_history?.find((e) => e.id === 2)
      expect(u2).toBeDefined()
      expect(u2?.mileage_km).toBe(925)
      expect(u2?.condition).toBe(75)
      expect(u2?.wear).toBe(25)

      // Verificar Unidade 3 (não utilizada na sessão):
      // Início: km = 150, cond = 95, wear = 5
      // Final esperado: exatamente igual, NADA debitado
      const u3 = team.engine_history?.find((e) => e.id === 3)
      expect(u3).toBeDefined()
      expect(u3?.mileage_km).toBe(150)
      expect(u3?.condition).toBe(95)
      expect(u3?.wear).toBe(5)

      // Journal registrado como COMPLETE
      const journal = canonicalPowerUnitUsageApplierService.getJournal(
        'career_save_01',
        2026,
        1,
        'MAIN_RACE',
      )
      expect(journal?.status).toBe('COMPLETE')
      expect(journal?.appliedUnitIds).toEqual([1, 2])
    })
  })

  // =========================================================================
  // TESTE B: REPETIÇÃO E RETOMADA (IDEMPOTÊNCIA PERSISTENTE)
  // =========================================================================
  describe('B. Repetição e retomada com nova instância do serviço', () => {
    it('aplicar a mesma apuração novamente em outra instância do serviço relendo o estado persistido não duplica débito', async () => {
      const team = createMockTeam('team_audi')
      const raceState = createMockRaceState()
      const projectionReport = projectSessionPowerUnitUsage(raceState)

      // 1. Primeira aplicação
      const service1 = new CanonicalPowerUnitUsageApplierService()
      const res1 = await service1.applySessionPowerUnitUsage(projectionReport, {
        teamOverrides: { team_audi: team },
        dryRunOrLocalOnly: true,
      })
      expect(res1.status).toBe('SUCCESS')
      expect(res1.appliedCount).toBe(2)

      const u1AfterFirst = { ...team.engine_history?.find((e) => e.id === 1)! }
      const u2AfterFirst = { ...team.engine_history?.find((e) => e.id === 2)! }

      // 2. Segunda aplicação com OUTRA instância de serviço, lendo do localStorage
      const service2 = new CanonicalPowerUnitUsageApplierService()
      const res2 = await service2.applySessionPowerUnitUsage(projectionReport, {
        teamOverrides: { team_audi: team },
        dryRunOrLocalOnly: true,
      })

      // Resultado deve ser ALREADY_APPLIED
      expect(res2.status).toBe('ALREADY_APPLIED')
      expect(res2.appliedCount).toBe(0)
      expect(res2.alreadyAppliedCount).toBe(2)

      // O inventário NÃO pode sofrer novo débito
      const u1AfterSecond = team.engine_history?.find((e) => e.id === 1)
      const u2AfterSecond = team.engine_history?.find((e) => e.id === 2)

      expect(u1AfterSecond?.mileage_km).toBe(u1AfterFirst.mileage_km)
      expect(u1AfterSecond?.condition).toBe(u1AfterFirst.condition)
      expect(u1AfterSecond?.wear).toBe(u1AfterFirst.wear)

      expect(u2AfterSecond?.mileage_km).toBe(u2AfterFirst.mileage_km)
      expect(u2AfterSecond?.condition).toBe(u2AfterFirst.condition)
      expect(u2AfterSecond?.wear).toBe(u2AfterFirst.wear)
    })
  })

  // =========================================================================
  // TESTE C: SPRINT E PRINCIPAL NA MESMA RODADA
  // =========================================================================
  describe('C. Coexistência de Sprint e Corrida Principal na mesma rodada', () => {
    it('duas sessões da mesma rodada com variantes distintas são aplicadas sem bloqueio mútuo', async () => {
      const team = createMockTeam('team_audi')

      // 1. Projeção da Sprint (ex: 15 voltas)
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
            powerUnitCondition: 87, // Débito Sprint: 3%
            lap: 15, // 15 voltas * 5 = 75 km
          }),
        ],
      })
      const sprintReport = projectSessionPowerUnitUsage(sprintState)

      const sprintResult = await canonicalPowerUnitUsageApplierService.applySessionPowerUnitUsage(
        sprintReport,
        {
          teamOverrides: { team_audi: team },
          dryRunOrLocalOnly: true,
        },
      )
      expect(sprintResult.status).toBe('SUCCESS')
      expect(sprintResult.appliedCount).toBe(1)

      const u1AfterSprint = team.engine_history?.find((e) => e.id === 1)
      expect(u1AfterSprint?.mileage_km).toBe(500 + 75) // 575 km
      expect(u1AfterSprint?.condition).toBe(90 - 3) // 87%

      // 2. Projeção da Corrida Principal (mesma rodada 1, MAIN_RACE)
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
            powerUnitCondition: 77, // Débito Main: 10%
            lap: 50, // 50 voltas * 5 = 250 km
          }),
        ],
      })
      const mainReport = projectSessionPowerUnitUsage(mainState)

      // A aplicação da Sprint NÃO pode bloquear a Corrida Principal!
      const mainResult = await canonicalPowerUnitUsageApplierService.applySessionPowerUnitUsage(
        mainReport,
        {
          teamOverrides: { team_audi: team },
          dryRunOrLocalOnly: true,
        },
      )

      expect(mainResult.status).toBe('SUCCESS')
      expect(mainResult.appliedCount).toBe(1)

      const u1AfterMain = team.engine_history?.find((e) => e.id === 1)
      expect(u1AfterMain?.mileage_km).toBe(575 + 250) // 825 km
      expect(u1AfterMain?.condition).toBe(87 - 10) // 77%

      // Journals de Sprint e Main coexistem de forma independente
      const sprintJournal = canonicalPowerUnitUsageApplierService.getJournal(
        'career_save_01',
        2026,
        1,
        'SPRINT_RACE',
      )
      const mainJournal = canonicalPowerUnitUsageApplierService.getJournal(
        'career_save_01',
        2026,
        1,
        'MAIN_RACE',
      )

      expect(sprintJournal?.status).toBe('COMPLETE')
      expect(mainJournal?.status).toBe('COMPLETE')
      expect(sprintJournal?.journalKey).not.toBe(mainJournal?.journalKey)
    })
  })

  // =========================================================================
  // TESTE D: FALHA DE GRAVAÇÃO E RETOMADA RESILIENTE
  // =========================================================================
  describe('D. Falha de gravação e retomada resiliente por unidade', () => {
    it('quando ocorre falha após aplicar a primeira unidade, a retomada não duplica a primeira e conclui a segunda', async () => {
      const team = createMockTeam('team_audi')
      const raceState = createMockRaceState()
      const projectionReport = projectSessionPowerUnitUsage(raceState)

      // 1. Simular falha forçada após gravar a unidade 1 (índice 1)
      const partialResult = await canonicalPowerUnitUsageApplierService.applySessionPowerUnitUsage(
        projectionReport,
        {
          teamOverrides: { team_audi: team },
          simulateFailureAfterUnitIndex: 1, // Falha proposital após PU-1
          dryRunOrLocalOnly: true,
        },
      )

      expect(partialResult.status).toBe('PARTIAL')
      expect(partialResult.appliedCount).toBe(1)
      expect(partialResult.journal.status).toBe('PARTIAL')
      expect(partialResult.journal.appliedUnitIds).toEqual([1])

      // PU-1 foi debitada: 500 + 250 = 750 km; cond: 90 - 10 = 80
      const u1Mid = team.engine_history?.find((e) => e.id === 1)
      expect(u1Mid?.mileage_km).toBe(750)
      expect(u1Mid?.condition).toBe(80)

      // PU-2 ainda NÃO foi debitada: 800 km, cond: 80
      const u2Mid = team.engine_history?.find((e) => e.id === 2)
      expect(u2Mid?.mileage_km).toBe(800)
      expect(u2Mid?.condition).toBe(80)

      // 2. Retomada sem simulação de falha (ex: retry do serviço)
      const resumeService = new CanonicalPowerUnitUsageApplierService()
      const resumeResult = await resumeService.applySessionPowerUnitUsage(projectionReport, {
        teamOverrides: { team_audi: team },
        dryRunOrLocalOnly: true,
      })

      expect(resumeResult.status).toBe('SUCCESS')
      expect(resumeResult.appliedCount).toBe(1) // Apenas a unidade 2 foi debitada agora
      expect(resumeResult.alreadyAppliedCount).toBe(1) // Unidade 1 foi reconhecida como ALREADY_APPLIED

      // PU-1 NÃO sofreu novo débito (permaneceu 750 km e 80% cond)
      const u1Final = team.engine_history?.find((e) => e.id === 1)
      expect(u1Final?.mileage_km).toBe(750)
      expect(u1Final?.condition).toBe(80)

      // PU-2 agora foi debitada corretamente: 800 + 125 = 925 km, cond: 80 - 5 = 75%
      const u2Final = team.engine_history?.find((e) => e.id === 2)
      expect(u2Final?.mileage_km).toBe(925)
      expect(u2Final?.condition).toBe(75)

      // Journal agora está COMPLETE com ambas as unidades registradas
      const journalFinal = resumeService.getJournal('career_save_01', 2026, 1, 'MAIN_RACE')
      expect(journalFinal?.status).toBe('COMPLETE')
      expect(journalFinal?.appliedUnitIds).toEqual([1, 2])
    })
  })

  // =========================================================================
  // TESTE E: REJEIÇÃO, PENDÊNCIAS E REGISTROS NÃO VINCULADOS
  // =========================================================================
  describe('E. Rejeição e registros sem desgaste reconhecido', () => {
    it('unidade inexistente no inventário não é debitada e registra falha estruturada', async () => {
      const team = createMockTeam('team_audi')
      // Corredor usando PU-99 (não existe no inventário do time)
      const raceState = createMockRaceState({
        drivers: [
          createMockDriver({
            driverId: 'player_drv_ghost',
            powerUnitId: 99,
            powerUnitInitialCondition: 90,
            powerUnitCondition: 80,
            lap: 10,
          }),
        ],
      })
      const report = projectSessionPowerUnitUsage(raceState)

      const result = await canonicalPowerUnitUsageApplierService.applySessionPowerUnitUsage(
        report,
        {
          teamOverrides: { team_audi: team },
          dryRunOrLocalOnly: true,
        },
      )

      expect(result.status).toBe('FAILED')
      expect(result.failedCount).toBe(1)
      expect(result.appliedCount).toBe(0)

      const unitRes = result.unitResults.find((u) => u.powerUnitId === 99)
      expect(unitRes?.status).toBe('FAILED_NOT_FOUND')
      expect(unitRes?.message).toContain('não encontrada no engine_history')
    })

    it('registro sem desgaste reconhecido (LEGACY_UNLINKED ou PENDING_ENGINE_SESSION_EVOLUTION) é classificado como NOT_APPLICABLE e não altera inventário', async () => {
      const team = createMockTeam('team_audi')
      const initialEngineHistorySnapshot = JSON.stringify(team.engine_history)

      // Simular participante rival sem instrumento (LEGACY_UNLINKED) e outro com desgaste pendente
      const raceState = createMockRaceState({
        drivers: [
          createMockDriver({
            driverId: 'rival_unlinked',
            isPlayer: false,
            powerUnitId: undefined,
            powerUnitCondition: undefined,
            powerUnitInitialCondition: undefined,
            lap: 50,
          }),
          createMockDriver({
            driverId: 'pending_pu_drv',
            isPlayer: true,
            powerUnitId: 1,
            powerUnitCondition: undefined, // Ausência de evolução em sessão
            powerUnitInitialCondition: 90,
            lap: 50,
          }),
        ],
      })
      const report = projectSessionPowerUnitUsage(raceState)

      const result = await canonicalPowerUnitUsageApplierService.applySessionPowerUnitUsage(
        report,
        {
          teamOverrides: { team_audi: team },
          dryRunOrLocalOnly: true,
        },
      )

      expect(result.pendingOrUnlinkedCount).toBe(2)
      expect(result.appliedCount).toBe(0)

      // Inventário permaneceu 100% inalterado
      expect(JSON.stringify(team.engine_history)).toBe(initialEngineHistorySnapshot)

      const rivalRes = result.unitResults.find((u) => u.driverId === 'rival_unlinked')
      expect(rivalRes?.status).toBe('NOT_APPLICABLE')

      const pendingRes = result.unitResults.find((u) => u.driverId === 'pending_pu_drv')
      expect(pendingRes?.status).toBe('NOT_APPLICABLE')
    })
  })
})
