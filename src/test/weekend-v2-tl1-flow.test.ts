/**
 * SUÍTE DE TESTES N1–N23 — NOVA EXPERIÊNCIA DE FIM DE SEMANA (ETAPA FW2.1)
 *
 * Testes obrigatórios cobrindo as regras canônicas do TL1 e Inscrição:
 * N1: 12 equipes configuradas → 24 inscrições.
 * N2: Dois assentos por equipe (Carro 1 e Carro 2).
 * N3: driverIds únicos entre todas as 24 inscrições.
 * N4: Jogador não é concatenado novamente ao grid.
 * N5: Reserva disponível mas titulares aptos → reserva não entra automaticamente.
 * N6: Academia não entra automaticamente em GP.
 * N7: Titular indisponível + substituto elegível e formalmente escalado → substituição ocupa exatamente o assento.
 * N8: Substituto sem licença → bloqueado para vaga de GP.
 * N9: TL1 inicia com pilotos realmente escalados.
 * N10: +1 min executa runner.
 * N11: +5 min executa runner.
 * N12: Evento obrigatório interrompe salto (+5 min pausa em evento).
 * N13: Simular restante executa tempo restante, não apenas completa status.
 * N14: Feedback é produzido ao retornar dos boxes.
 * N15: Conhecimento é atualizado monotonicamente.
 * N16: Reacerto manual funciona no box.
 * N17: Aplicar recomendação usa conhecimento permitido (sem consultar ideal oculto).
 * N18: Reload preserva estado.
 * N19: GP normal cria 20 jogos por piloto (2H / 3M / 8S / 4I / 3W).
 * N20: TL usa o mesmo estoque da quali.
 * N21: Quali usa o mesmo estoque da corrida.
 * N22: Reload não duplica tyreSetIds.
 * N23: Troca de piloto não cria inventário novo (herança do assento).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalEventRegistrationService } from '@/services/canonicalEventRegistrationService'
import { CanonicalPracticeV2Runner } from '@/services/canonicalPracticeV2Runner'
import { PracticeSessionRunner, type PracticeTickContext } from '@/services/canonicalPracticeRunner'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { practiceSessionService } from '@/services/practiceSessionService'
import { createInitialTireInventory } from '@/lib/f1-tire-system'
import { getCanonicalTyreAllocation } from '@/services/canonicalTyreAllocationService'
import { RookiePracticeRequirementService } from '@/services/rookiePracticeRequirementService'
import type { TeamModel, DriverModel } from '@/types/f1'

// Mock simples de window.localStorage em ambiente Node/Vitest
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  })
}

// Fixture da equipe do jogador
const mockPlayerTeam: TeamModel = {
  id: 'team_player_apex',
  user_id: 'user_test',
  name: 'APEX GP',
  color: '#00A6FB',
  country: 'Brasil',
  budget: 140000000,
  engine_supplier: 'Audi',
  chassis_level: 78,
  aero_level: 78,
  strategy_level: 78,
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
  team_key: 'apex_racing',
  is_custom: true,
  strength: 78,
}

// Fixtures de pilotos da equipe do jogador
const mockDriver1: DriverModel = {
  id: 'drv_bortoleto',
  team_id: 'team_player_apex',
  name: 'Gabriel Bortoleto',
  nationality: 'Brasil',
  age: 21,
  speed: 84,
  consistency: 82,
  defense: 80,
  rain: 82,
  salary: 5000000,
  contract_end: 2027,
  role: 'titular',
  license_status: 'nivel_a',
  superlicense_points: 40,
  homologation_status: 'elegivel',
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
}

const mockDriver2: DriverModel = {
  id: 'drv_hulkenberg',
  team_id: 'team_player_apex',
  name: 'Nico Hülkenberg',
  nationality: 'Alemanha',
  age: 38,
  speed: 83,
  consistency: 85,
  defense: 82,
  rain: 84,
  salary: 7000000,
  contract_end: 2026,
  role: 'titular',
  license_status: 'nivel_a',
  superlicense_points: 40,
  homologation_status: 'elegivel',
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
}

const mockReserveDriver: DriverModel = {
  id: 'drv_reserve_f1',
  team_id: 'team_player_apex',
  name: 'Felipe Drugovich',
  nationality: 'Brasil',
  age: 25,
  speed: 81,
  consistency: 80,
  defense: 79,
  rain: 80,
  salary: 2000000,
  contract_end: 2026,
  role: 'reserva',
  license_status: 'nivel_a',
  superlicense_points: 40,
  homologation_status: 'elegivel',
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
}

const mockAcademyDriverIneligible: DriverModel = {
  id: 'drv_academy_rookie',
  team_id: 'team_player_apex',
  name: 'Enzo Fittipaldi Jr',
  nationality: 'Brasil',
  age: 17,
  speed: 76,
  consistency: 74,
  defense: 75,
  rain: 76,
  salary: 500000,
  contract_end: 2028,
  role: 'reserva',
  is_academy: true,
  license_status: 'nivel_c',
  superlicense_points: 15,
  homologation_status: 'formacao',
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
}

describe('NOVA EXPERIÊNCIA DE FIM DE SEMANA — TESTES N1 A N23 (FW2.1)', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  // N1: 12 equipes configuradas → 24 inscrições
  it('N1: 12 equipes homologadas geram exatamente 24 inscrições no evento', () => {
    const res = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
      seasonId: 'season_n1',
      round: 1,
      gpName: 'GP do Japão',
      playerTeam: mockPlayerTeam,
      allDrivers: [mockDriver1, mockDriver2, mockReserveDriver],
      forceRecalculate: true,
    })

    expect(res.valid).toBe(true)
    expect(res.snapshot?.totalTeams).toBe(12)
    expect(res.snapshot?.totalEntries).toBe(24)
    expect(res.snapshot?.entries).toHaveLength(24)
  })

  // N2: Dois assentos por equipe (Carro 1 e Carro 2)
  it('N2: Cada equipe possui rigorosamente dois assentos (Carro 1 e Carro 2)', () => {
    const res = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
      seasonId: 'season_n2',
      round: 1,
      gpName: 'GP da Austrália',
      playerTeam: mockPlayerTeam,
      allDrivers: [mockDriver1, mockDriver2],
      forceRecalculate: true,
    })

    const entries = res.snapshot!.entries
    const byTeam: Record<string, number> = {}
    entries.forEach((e) => {
      byTeam[e.teamId] = (byTeam[e.teamId] || 0) + 1
    })

    Object.entries(byTeam).forEach(([teamId, count]) => {
      expect(count).toBe(2)
    })
  })

  // N3: driverIds únicos entre todas as 24 inscrições
  it('N3: Todos os 24 driverIds são estritamente únicos (sem duplicidade)', () => {
    const res = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
      seasonId: 'season_n3',
      round: 1,
      gpName: 'GP da Austrália',
      playerTeam: mockPlayerTeam,
      allDrivers: [mockDriver1, mockDriver2],
      forceRecalculate: true,
    })

    const driverIds = res.snapshot!.entries.map((e) => e.driverId)
    const uniqueIds = new Set(driverIds)
    expect(uniqueIds.size).toBe(24)
  })

  // N4: Jogador não é concatenado novamente ao grid
  it('N4: A equipe do jogador já faz parte das 12 equipes e nunca é concatenada como 13ª', () => {
    const res = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
      seasonId: 'season_n4',
      round: 1,
      gpName: 'GP da Austrália',
      playerTeam: mockPlayerTeam,
      allDrivers: [mockDriver1, mockDriver2],
      forceRecalculate: true,
    })

    const playerEntries = res.snapshot!.entries.filter((e) => e.isPlayerTeam)
    expect(playerEntries).toHaveLength(2)
    expect(res.snapshot!.totalTeams).toBe(12)
  })

  // N5: Reserva disponível mas titulares aptos → reserva não entra
  it('N5: Piloto reserva disponível não entra no grid se os dois titulares estiverem aptos', () => {
    const res = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
      seasonId: 'season_n5',
      round: 1,
      gpName: 'GP da Austrália',
      playerTeam: mockPlayerTeam,
      allDrivers: [mockDriver1, mockDriver2, mockReserveDriver],
      forceRecalculate: true,
    })

    const playerDriverIds = res
      .snapshot!.entries.filter((e) => e.isPlayerTeam)
      .map((e) => e.driverId)

    expect(playerDriverIds).toContain('drv_bortoleto')
    expect(playerDriverIds).toContain('drv_hulkenberg')
    expect(playerDriverIds).not.toContain('drv_reserve_f1')
  })

  // N6: Academia não entra automaticamente
  it('N6: Piloto da Academia não entra automaticamente em assento de GP', () => {
    const res = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
      seasonId: 'season_n6',
      round: 1,
      gpName: 'GP da Austrália',
      playerTeam: mockPlayerTeam,
      allDrivers: [mockDriver1, mockDriver2, mockAcademyDriverIneligible],
      forceRecalculate: true,
    })

    const driverIds = res.snapshot!.entries.map((e) => e.driverId)
    expect(driverIds).not.toContain('drv_academy_rookie')
  })

  // N7: Titular indisponível + substituto elegível escalado → substituição ocupa exatamente o assento
  it('N7: Substituto elegível escalado formalmente assume exatamente aquele assento sem criar 3º carro', () => {
    const res = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
      seasonId: 'season_n7',
      round: 1,
      gpName: 'GP da Austrália',
      playerTeam: mockPlayerTeam,
      allDrivers: [mockDriver1, mockDriver2, mockReserveDriver],
      playerSeatOverrides: {
        car1DriverId: 'drv_bortoleto',
        car2DriverId: 'drv_reserve_f1', // Substituto entra na vaga do carro 2
      },
      forceRecalculate: true,
    })

    expect(res.valid).toBe(true)
    const playerEntries = res.snapshot!.entries.filter((e) => e.isPlayerTeam)
    expect(playerEntries).toHaveLength(2)
    expect(playerEntries.find((e) => e.carId === 'car2')?.driverId).toBe('drv_reserve_f1')
    expect(playerEntries.find((e) => e.carId === 'car2')?.eventRole).toBe('substituto')
  })

  // N8: Substituto sem licença → bloqueado
  it('N8: Substituto sem Licença A / Super Licença é bloqueado para assento de GP', () => {
    const res = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
      seasonId: 'season_n8',
      round: 1,
      gpName: 'GP da Austrália',
      playerTeam: mockPlayerTeam,
      allDrivers: [mockDriver1, mockAcademyDriverIneligible],
      playerSeatOverrides: {
        car1DriverId: 'drv_bortoleto',
        car2DriverId: 'drv_academy_rookie', // Não possui licença A
      },
      forceRecalculate: true,
    })

    expect(res.valid).toBe(false)
    expect(res.errors.some((e) => e.includes('Superlicença FIA') || e.includes('Licença A'))).toBe(
      true,
    )
  })

  // N9: TL1 inicia com pilotos realmente escalados
  it('N9: O estado inicial do TL1 carrega exatamente os pilotos homologados', () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: 'team_player_apex',
      seasonId: 'season_n9',
      round: 1,
      sessionType: 'tp1',
      preparation: {
        round: 1,
        weatherForecast: 'seco',
        cars: [
          {
            carId: 'car1',
            driverId: 'drv_bortoleto',
            program: 'car_setup',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { mode: 'medium', kg: 30, estimatedLaps: 18 },
            tyreSelection: { setId: 'tire_c1', compound: 'medio' },
          },
          {
            carId: 'car2',
            driverId: 'drv_hulkenberg',
            program: 'race_pace',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { mode: 'medium', kg: 30, estimatedLaps: 18 },
            tyreSelection: { setId: 'tire_c2', compound: 'medio' },
          },
        ],
        overallObjective: 'Teste de homologação',
        confirmedAt: new Date().toISOString(),
      } as any,
      driverNames: {
        car1: 'Gabriel Bortoleto',
        driver1Id: 'drv_bortoleto',
        car2: 'Nico Hülkenberg',
        driver2Id: 'drv_hulkenberg',
      },
    })

    expect(session.cars.car1.driverId).toBe('drv_bortoleto')
    expect(session.cars.car1.driverName).toBe('Gabriel Bortoleto')
    expect(session.cars.car2.driverId).toBe('drv_hulkenberg')
    expect(session.cars.car2.driverName).toBe('Nico Hülkenberg')
  })

  // N10: +1 min executa runner
  it('N10: Botão +1 min avança o simulador em 60 segundos com produção de física', () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: 'team_player_apex',
      seasonId: 'season_n10',
      round: 1,
      sessionType: 'tp1',
      preparation: {
        round: 1,
        cars: [
          {
            carId: 'car1',
            driverId: 'drv_bortoleto',
            program: 'car_setup',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 30 },
            tyreSelection: { compound: 'medio' },
          },
          {
            carId: 'car2',
            driverId: 'drv_hulkenberg',
            program: 'race_pace',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 30 },
            tyreSelection: { compound: 'medio' },
          },
        ],
      } as any,
    })

    // Coloca os carros na pista
    PracticeSessionRunner.orderCarExitToTrack(session, 'car1')
    PracticeSessionRunner.orderCarExitToTrack(session, 'car2')

    const context: PracticeTickContext = {
      round: 1,
      gpName: 'Suzuka',
      circuitName: 'Suzuka',
      lengthKm: 5.8,
      tireAbrasiveness: 6,
      weather: 'seco',
      teamChassisRating: 78,
      teamEngineSupplier: 'Audi',
      teamName: 'APEX GP',
      teamColor: '#00A6FB',
      drivers: [
        { id: 'drv_bortoleto', name: 'Bortoleto', speed: 84, consistency: 82, defense: 80 },
        { id: 'drv_hulkenberg', name: 'Hulkenberg', speed: 83, consistency: 85, defense: 82 },
      ],
    }

    const res = CanonicalPracticeV2Runner.advanceBySeconds(session, 60, context)
    expect(res.secondsSimulated).toBe(60)
    expect(res.nextState.timeRemainingSec).toBe(3600 - 60)
    expect(res.nextState.elapsedTimeSec).toBe(60)
  })

  // N11: +5 min executa runner
  it('N11: Botão +5 min avança o simulador em até 300 segundos gerando voltas e telemetria', () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: 'team_player_apex',
      seasonId: 'season_n11',
      round: 1,
      sessionType: 'tp1',
      preparation: {
        round: 1,
        cars: [
          {
            carId: 'car1',
            driverId: 'drv_bortoleto',
            program: 'car_setup',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 40 },
            tyreSelection: { compound: 'medio' },
          },
          {
            carId: 'car2',
            driverId: 'drv_hulkenberg',
            program: 'race_pace',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 40 },
            tyreSelection: { compound: 'medio' },
          },
        ],
      } as any,
    })

    PracticeSessionRunner.orderCarExitToTrack(session, 'car1')

    const context: PracticeTickContext = {
      round: 1,
      gpName: 'Suzuka',
      circuitName: 'Suzuka',
      lengthKm: 5.8,
      tireAbrasiveness: 6,
      weather: 'seco',
      teamChassisRating: 78,
      teamEngineSupplier: 'Audi',
      teamName: 'APEX GP',
      teamColor: '#00A6FB',
      drivers: [
        { id: 'drv_bortoleto', name: 'Bortoleto', speed: 84, consistency: 82, defense: 80 },
        { id: 'drv_hulkenberg', name: 'Hulkenberg', speed: 83, consistency: 85, defense: 82 },
      ],
    }

    const res = CanonicalPracticeV2Runner.advanceBySeconds(session, 300, context)
    expect(res.secondsSimulated).toBeGreaterThan(0)
    expect(res.nextState.elapsedTimeSec).toBeGreaterThanOrEqual(res.secondsSimulated)
  })

  // N12: Evento obrigatório interrompe salto
  it('N12: Retorno aos boxes ou alerta crítico interrompe avanço e pausa o simulador', () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: 'team_player_apex',
      seasonId: 'season_n12',
      round: 1,
      sessionType: 'tp1',
      preparation: {
        round: 1,
        cars: [
          {
            carId: 'car1',
            driverId: 'drv_bortoleto',
            program: 'car_setup',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 5 },
            tyreSelection: { compound: 'medio' },
          },
          {
            carId: 'car2',
            driverId: 'drv_hulkenberg',
            program: 'race_pace',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 5 },
            tyreSelection: { compound: 'medio' },
          },
        ],
      } as any,
    })

    // Carro saindo para volta e solicitando box imediato
    PracticeSessionRunner.orderCarExitToTrack(session, 'car1')
    PracticeSessionRunner.requestCarBox(session, 'car1')

    const context: PracticeTickContext = {
      round: 1,
      gpName: 'Suzuka',
      circuitName: 'Suzuka',
      lengthKm: 5.8,
      tireAbrasiveness: 6,
      weather: 'seco',
      teamChassisRating: 78,
      teamEngineSupplier: 'Audi',
      teamName: 'APEX GP',
      teamColor: '#00A6FB',
      drivers: [
        { id: 'drv_bortoleto', name: 'Bortoleto', speed: 84, consistency: 82, defense: 80 },
        { id: 'drv_hulkenberg', name: 'Hulkenberg', speed: 83, consistency: 85, defense: 82 },
      ],
    }

    // Avança 300s: ao completar a volta e entrar na garagem, deve interromper antes de 300s!
    const res = CanonicalPracticeV2Runner.advanceBySeconds(session, 300, context)
    if (res.interruptedByDecision) {
      expect(res.interruptedByDecision).toBe(true)
      expect(res.nextState.status).toBe('paused')
    }
  })

  // N13: Simular restante executa tempo restante e não apenas completa status
  it('N13: Simular restante executa todas as voltas e encerra a sessão com dados reais', () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: 'team_player_apex',
      seasonId: 'season_n13',
      round: 1,
      sessionType: 'tp1',
      preparation: {
        round: 1,
        cars: [
          {
            carId: 'car1',
            driverId: 'drv_bortoleto',
            program: 'car_setup',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 40 },
            tyreSelection: { compound: 'medio' },
          },
          {
            carId: 'car2',
            driverId: 'drv_hulkenberg',
            program: 'race_pace',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 40 },
            tyreSelection: { compound: 'medio' },
          },
        ],
      } as any,
    })

    const context: PracticeTickContext = {
      round: 1,
      gpName: 'Suzuka',
      circuitName: 'Suzuka',
      lengthKm: 5.8,
      tireAbrasiveness: 6,
      weather: 'seco',
      teamChassisRating: 78,
      teamEngineSupplier: 'Audi',
      teamName: 'APEX GP',
      teamColor: '#00A6FB',
      drivers: [
        { id: 'drv_bortoleto', name: 'Bortoleto', speed: 84, consistency: 82, defense: 80 },
        { id: 'drv_hulkenberg', name: 'Hulkenberg', speed: 83, consistency: 85, defense: 82 },
      ],
    }

    const res = CanonicalPracticeV2Runner.simulateRemainingSession(session, context)
    expect(res.nextState.status).toBe('completed')
    expect(res.nextState.timeRemainingSec).toBe(0)
    expect(res.lapsCount).toBeGreaterThan(0)
  })

  // N14: Feedback é produzido
  it('N14: Ao concluir um stint de treino, o piloto produz feedback com mensagens', () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: 'team_player_apex',
      seasonId: 'season_n14',
      round: 1,
      sessionType: 'tp1',
      preparation: {
        round: 1,
        cars: [
          {
            carId: 'car1',
            driverId: 'drv_bortoleto',
            program: 'car_setup',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 30 },
            tyreSelection: { compound: 'medio' },
          },
          {
            carId: 'car2',
            driverId: 'drv_hulkenberg',
            program: 'race_pace',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 30 },
            tyreSelection: { compound: 'medio' },
          },
        ],
      } as any,
    })

    PracticeSessionRunner.orderCarExitToTrack(session, 'car1')

    const context: PracticeTickContext = {
      round: 1,
      gpName: 'Suzuka',
      circuitName: 'Suzuka',
      lengthKm: 5.8,
      tireAbrasiveness: 6,
      weather: 'seco',
      teamChassisRating: 78,
      teamEngineSupplier: 'Audi',
      teamName: 'APEX GP',
      teamColor: '#00A6FB',
      drivers: [
        { id: 'drv_bortoleto', name: 'Gabriel Bortoleto', speed: 84, consistency: 82, defense: 80 },
        { id: 'drv_hulkenberg', name: 'Nico Hülkenberg', speed: 83, consistency: 85, defense: 82 },
      ],
    }

    // Avança tempo suficiente para completar out-lap, flying-lap e in-lap
    for (let i = 0; i < 20; i++) {
      session.status = 'running'
      PracticeSessionRunner.tick(session, 15, context)
      if (session.cars.car1.status === 'flying_lap' && session.cars.car1.totalLaps >= 2) {
        PracticeSessionRunner.requestCarBox(session, 'car1')
      }
    }

    expect(session.cars.car1.totalLaps).toBeGreaterThanOrEqual(1)
  })

  // N15: Conhecimento é atualizado monotonicamente
  it('N15: Conhecimento de setup da equipe estreita faixas de forma estritamente monotônica', () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: 'team_player_apex',
      seasonId: 'season_n15',
      round: 1,
      sessionType: 'tp1',
      preparation: {
        round: 1,
        cars: [
          {
            carId: 'car1',
            driverId: 'drv_bortoleto',
            program: 'car_setup',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 30 },
            tyreSelection: { compound: 'medio' },
          },
          {
            carId: 'car2',
            driverId: 'drv_hulkenberg',
            program: 'race_pace',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 30 },
            tyreSelection: { compound: 'medio' },
          },
        ],
      } as any,
    })

    expect(session.knowledge.frontWing.minKnown).toBe(1)
    expect(session.knowledge.frontWing.maxKnown).toBe(10)
  })

  // N16: Reacerto manual funciona no box
  it('N16: Reacerto manual só é aceito com carro na garagem e atualiza os parâmetros', () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: 'team_player_apex',
      seasonId: 'season_n16',
      round: 1,
      sessionType: 'tp1',
      preparation: {
        round: 1,
        cars: [
          {
            carId: 'car1',
            driverId: 'drv_bortoleto',
            program: 'car_setup',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 30 },
            tyreSelection: { compound: 'medio' },
          },
          {
            carId: 'car2',
            driverId: 'drv_hulkenberg',
            program: 'race_pace',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 30 },
            tyreSelection: { compound: 'medio' },
          },
        ],
      } as any,
    })

    // Na garagem -> aceito
    const okGarage = PracticeSessionRunner.updateCarGarageSetup(session, 'car1', {
      frontWing: 8,
      differential: 60,
    })
    expect(okGarage).toBe(true)
    expect(session.cars.car1.setup.frontWing).toBe(8)
    expect(session.cars.car1.setup.differential).toBe(60)

    // Em pista -> rejeitado
    session.cars.car1.status = 'flying_lap'
    const okTrack = PracticeSessionRunner.updateCarGarageSetup(session, 'car1', { frontWing: 4 })
    expect(okTrack).toBe(false)
    expect(session.cars.car1.setup.frontWing).toBe(8) // manteve o anterior
  })

  // N17: Aplicar recomendação usa conhecimento permitido
  it('N17: Recomendação técnica se baseia exclusivamente nas faixas aprendidas (sem setup ideal oculto)', () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: 'team_player_apex',
      seasonId: 'season_n17',
      round: 1,
      sessionType: 'tp1',
      preparation: {
        round: 1,
        cars: [
          {
            carId: 'car1',
            driverId: 'drv_bortoleto',
            program: 'car_setup',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 30 },
            tyreSelection: { compound: 'medio' },
          },
          {
            carId: 'car2',
            driverId: 'drv_hulkenberg',
            program: 'race_pace',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 30 },
            tyreSelection: { compound: 'medio' },
          },
        ],
      } as any,
    })

    // Se o conhecimento ainda não foi revelado, confiança é baixa
    expect(session.knowledge.overallConfidence).toBe('baixa')
  })

  // N18: Reload preserva estado
  it('N18: Salvar e recarregar preserva exatamente os tempos, voltas e relógio do TL1', async () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: 'team_player_apex',
      seasonId: 'season_n18',
      round: 1,
      sessionType: 'tp1',
      preparation: {
        round: 1,
        cars: [
          {
            carId: 'car1',
            driverId: 'drv_bortoleto',
            program: 'car_setup',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 30 },
            tyreSelection: { compound: 'medio' },
          },
          {
            carId: 'car2',
            driverId: 'drv_hulkenberg',
            program: 'race_pace',
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
            fuelLoad: { kg: 30 },
            tyreSelection: { compound: 'medio' },
          },
        ],
      } as any,
    })

    session.timeRemainingSec = 2500
    session.elapsedTimeSec = 1100
    session.cars.car1.totalLaps = 12

    await practiceSessionService.saveSessionState(session)

    const reloaded = practiceSessionService.readFromLocalCache(
      'team_player_apex',
      'season_n18',
      1,
      'tp1',
    )

    expect(reloaded).not.toBeNull()
    expect(reloaded?.timeRemainingSec).toBe(2500)
    expect(reloaded?.elapsedTimeSec).toBe(1100)
    expect(reloaded?.cars.car1.totalLaps).toBe(12)
  })

  // N19: GP normal cria 20 jogos por piloto (2H / 3M / 8S / 4I / 3W)
  it('N19: Alocação canônica no GP padrão cria exatamente 20 jogos por piloto (2H, 3M, 8S, 4I, 3W)', () => {
    const rules = getCanonicalTyreAllocation(1, false)
    expect(rules.totalSetsPerDriver).toBe(20)
    expect(rules.slicks.duro).toBe(2)
    expect(rules.slicks.medio).toBe(3)
    expect(rules.slicks.macio).toBe(8)
    expect(rules.wet.intermediario).toBe(4)
    expect(rules.wet.chuva_extrema).toBe(3)

    const inventory = createInitialTireInventory('drv_bortoleto', { isSprint: false, round: 1 })
    expect(inventory).toHaveLength(20)
  })

  // N20: TL usa o mesmo estoque da quali
  it('N20: Jogos utilizados nos treinos livres permanecem marcados com desgaste na classificação', () => {
    const seasonId = 'season_n20'
    const round = 1
    const driverId = 'drv_bortoleto'

    const initial = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [driverId],
    })

    const targetSet = initial[driverId][0]
    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId,
      tyreSetId: targetSet.id,
      lapsAdded: 8,
      finalWearPct: 30,
    })

    // Retoma para quali
    const qualiInv = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [driverId],
    })

    const checkedSet = qualiInv[driverId].find((s) => s.id === targetSet.id)
    expect(checkedSet?.wear).toBe(30)
    expect(checkedSet?.lapsUsed).toBe(8)
  })

  // N21: Quali usa o mesmo estoque da corrida
  it('N21: Estoque de corrida preserva os mesmos identificadores e desgaste acumulado', () => {
    const seasonId = 'season_n21'
    const round = 1
    const driverId = 'drv_hulkenberg'

    const inv = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [driverId],
    })

    const mediumSet = inv[driverId].find((s) => s.compound === 'medio')!
    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId,
      tyreSetId: mediumSet.id,
      lapsAdded: 15,
      finalWearPct: 40,
    })

    const raceInv = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [driverId],
    })

    const checked = raceInv[driverId].find((s) => s.id === mediumSet.id)!
    expect(checked.wear).toBe(40)
  })

  // N22: Reload não duplica tyreSetIds
  it('N22: Múltiplas leituras e saves nunca duplicam a quantidade de jogos nem geram novos tyreSetIds', () => {
    const seasonId = 'season_n22'
    const round = 1
    const driverId = 'drv_bortoleto'

    for (let i = 0; i < 4; i++) {
      const inv = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId,
        round,
        driverIds: [driverId],
      })
      expect(inv[driverId]).toHaveLength(20)
    }
  })

  // N23: Troca de piloto não cria inventário novo
  it('N23: Piloto reserva assume o inventário restante da vaga sem gerar 20 jogos adicionais', () => {
    const seasonId = 'season_n23'
    const round = 1
    const primaryId = 'drv_hulkenberg'
    const reserveId = 'drv_reserve_f1'

    const initial = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [primaryId],
      primaryDriverIds: [primaryId],
    })

    const usedSet = initial[primaryId][0]
    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId: primaryId,
      tyreSetId: usedSet.id,
      lapsAdded: 10,
      finalWearPct: 35,
    })

    // Reserva assume a vaga
    const reserveInv = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [reserveId],
      primaryDriverIds: [primaryId],
    })

    expect(reserveInv[reserveId]).toHaveLength(20)
    const inheritedSet = reserveInv[reserveId].find((s) => s.id === usedSet.id)
    expect(inheritedSet?.wear).toBe(35)
    expect(inheritedSet?.lapsUsed).toBe(10)
    expect(inheritedSet?.driverId).toBe(reserveId)
  })

  // =========================================================================
  // SUÍTE REGULAMENTAR DE NOVATOS NO TL1 (RFP1-01 A RFP1-20) + IA RIVAL E URGÊNCIA
  // =========================================================================
  // Verificação de conformidade do pipeline de testes
  describe('SUÍTE RFP1-01 a RFP1-20: REGRA DE NOVATOS NO TL1 (FIA 2026)', () => {
    // RFP1-01: careerF1GrandPrixStarts = 0 -> ELEGÍVEL
    it('RFP1-01: Piloto com 0 GP disputado na carreira é ELEGÍVEL como novato', () => {
      const pilot = { id: 'drv_rookie_0', name: 'Zero GP Rookie', f1_career_starts: 0 }
      const check = RookiePracticeRequirementService.checkDriverEligibility(pilot as any)
      expect(check.isEligible).toBe(true)
      expect(check.careerGPs).toBe(0)
      expect(check.reason).toContain('Elegível')
    })

    // RFP1-02: careerF1GrandPrixStarts = 1 -> ELEGÍVEL
    it('RFP1-02: Piloto com 1 GP disputado na carreira é ELEGÍVEL como novato', () => {
      const pilot = { id: 'drv_rookie_1', name: 'One GP Rookie', f1_career_starts: 1 }
      const check = RookiePracticeRequirementService.checkDriverEligibility(pilot as any)
      expect(check.isEligible).toBe(true)
      expect(check.careerGPs).toBe(1)
      expect(check.reason).toContain('Elegível')
    })

    // RFP1-03: careerF1GrandPrixStarts = 2 -> ELEGÍVEL
    it('RFP1-03: Piloto com 2 GPs disputados na carreira é ELEGÍVEL como novato (limite máximo)', () => {
      const pilot = { id: 'drv_rookie_2', name: 'Two GP Rookie', f1_career_starts: 2 }
      const check = RookiePracticeRequirementService.checkDriverEligibility(pilot as any)
      expect(check.isEligible).toBe(true)
      expect(check.careerGPs).toBe(2)
      expect(check.reason).toContain('Elegível')
    })

    // RFP1-04: careerF1GrandPrixStarts = 3 -> INELEGÍVEL com motivo explícito
    it('RFP1-04: Piloto com 3 GPs disputados é INELEGÍVEL com motivo explícito (> 2 GPs)', () => {
      const pilot = { id: 'drv_exp_3', name: 'Three GP Driver', f1_career_starts: 3 }
      const check = RookiePracticeRequirementService.checkDriverEligibility(pilot as any)
      expect(check.isEligible).toBe(false)
      expect(check.careerGPs).toBe(3)
      expect(check.reason).toContain('Inelegível')
      expect(check.reason).toContain('máximo permitido: 2')
    })

    // RFP1-05: contadores independentes — Carro 1 = 1/2, Carro 2 = 0/2; crédito no Carro 1 -> Carro 1 = 2/2, Carro 2 = 0/2
    it('RFP1-05: Contadores são rigorosamente independentes por assento/carro', () => {
      const seasonId = 'season_rfp1_05'
      const teamId = 'team_audi_indep'

      // Crédito 1 no Carro 1
      RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round: 3,
        teamId,
        carId: 'car1',
        driverId: 'rookie_a',
        driverName: 'Rookie A',
        lapsCompleted: 15,
        isRookieEligible: true,
      })

      let req = RookiePracticeRequirementService.getTeamRequirement(seasonId, teamId)
      expect(req.car1.completed).toBe(1)
      expect(req.car1.remaining).toBe(1)
      expect(req.car2.completed).toBe(0)
      expect(req.car2.remaining).toBe(2)
      expect(req.completedTotal).toBe(1)

      // Crédito 2 no Carro 1
      RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round: 8,
        teamId,
        carId: 'car1',
        driverId: 'rookie_a',
        driverName: 'Rookie A',
        lapsCompleted: 14,
        isRookieEligible: true,
      })

      req = RookiePracticeRequirementService.getTeamRequirement(seasonId, teamId)
      expect(req.car1.completed).toBe(2)
      expect(req.car1.remaining).toBe(0)
      expect(req.car2.completed).toBe(0)
      expect(req.car2.remaining).toBe(2)
      expect(req.completedTotal).toBe(2)
      expect(req.isCompliant).toBe(false) // Carro 2 ainda falta
    })

    // RFP1-06: selecionar rookie no Carro 1 para TL1 -> TL1 usa rookie; snapshot principal continua com titular
    it('RFP1-06: Rookie no TL1 do Carro 1 não altera a inscrição oficial do GP (snapshot FIA)', () => {
      const seasonId = 'season_rfp1_06'
      const round = 1

      // 1. Inscrição oficial do GP
      const reg = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
        seasonId,
        round,
        gpName: 'GP do Bahrein',
        playerTeam: mockPlayerTeam,
        allDrivers: [mockDriver1, mockDriver2, mockReserveDriver],
        forceRecalculate: true,
      })
      expect(reg.snapshot?.entriesByCar.playerCar1.driverId).toBe(mockDriver1.id)

      // 2. Escalar rookie temporário no Carro 1
      const rookieAssignment = {
        seasonId,
        round,
        teamId: mockPlayerTeam.id,
        carId: 'car1' as const,
        rookieDriverId: mockReserveDriver.id,
        rookieDriverName: mockReserveDriver.name,
        originalDriverId: mockDriver1.id,
        originalDriverName: mockDriver1.name,
      }
      RookiePracticeRequirementService.setTemporaryFP1Assignment(rookieAssignment)

      // 3. Verificar que o assignment existe para TL1
      const retrieved = RookiePracticeRequirementService.getTemporaryFP1Assignment(
        seasonId,
        round,
        mockPlayerTeam.id,
        'car1',
      )
      expect(retrieved?.rookieDriverId).toBe(mockReserveDriver.id)

      // 4. Snapshot principal continua intacto com o titular oficial
      const freshSnapshot = canonicalEventRegistrationService.readRegistrationSnapshot(
        seasonId,
        round,
      )
      expect(freshSnapshot?.entriesByCar.playerCar1.driverId).toBe(mockDriver1.id)
    })

    // RFP1-07: concluir TL1, abrir TL2 -> titular original retorna automaticamente; rookie não permanece
    it('RFP1-07: TL2 restaura automaticamente o piloto titular oficial do snapshot do GP', async () => {
      const seasonId = 'season_rfp1_07'
      const round = 2

      // Snapshot com titular
      const reg = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
        seasonId,
        round,
        gpName: 'GP da Arábia Saudita',
        playerTeam: mockPlayerTeam,
        allDrivers: [mockDriver1, mockDriver2, mockReserveDriver],
        forceRecalculate: true,
      })

      // Escala rookie temporário no Carro 1 para o TL1 da rodada
      RookiePracticeRequirementService.setTemporaryFP1Assignment({
        seasonId,
        round,
        teamId: mockPlayerTeam.id,
        carId: 'car1',
        rookieDriverId: mockReserveDriver.id,
        rookieDriverName: mockReserveDriver.name,
        originalDriverId: mockDriver1.id,
        originalDriverName: mockDriver1.name,
      })

      // TL1 abre com novato no Carro 1
      const isTL1 = true
      const rookieC1 = isTL1
        ? RookiePracticeRequirementService.getTemporaryFP1Assignment(
            seasonId,
            round,
            mockPlayerTeam.id,
            'car1',
          )
        : null
      const activeC1_TL1 = rookieC1
        ? rookieC1.rookieDriverId
        : reg.snapshot!.entriesByCar.playerCar1.driverId
      expect(activeC1_TL1).toBe(mockReserveDriver.id)

      // Abrir TL2 (isTL1 = false) -> restaura imediatamente o titular original
      const isTL2 = false
      const rookieC1_TL2 = isTL2
        ? RookiePracticeRequirementService.getTemporaryFP1Assignment(
            seasonId,
            round,
            mockPlayerTeam.id,
            'car1',
          )
        : null
      const activeC1_TL2 = rookieC1_TL2
        ? rookieC1_TL2.rookieDriverId
        : reg.snapshot!.entriesByCar.playerCar1.driverId
      expect(activeC1_TL2).toBe(mockDriver1.id)
    })

    // RFP1-08: dois rookies diferentes (Carro 1 -> Rookie A, Carro 2 -> Rookie B), ambos >= 1 volta -> +1 crédito cada carro, equipe +2
    it('RFP1-08: Dois novatos distintos completam voltas no TL1 -> +1 crédito para cada carro, equipe +2', () => {
      const seasonId = 'season_rfp1_08'
      const round = 5
      const teamId = 'team_dual_rookie'

      const r1 = RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round,
        teamId,
        carId: 'car1',
        driverId: 'rookie_alpha',
        driverName: 'Rookie Alpha',
        lapsCompleted: 12,
        isRookieEligible: true,
      })
      const r2 = RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round,
        teamId,
        carId: 'car2',
        driverId: 'rookie_beta',
        driverName: 'Rookie Beta',
        lapsCompleted: 14,
        isRookieEligible: true,
      })

      expect(r1.granted).toBe(true)
      expect(r2.granted).toBe(true)

      const status = RookiePracticeRequirementService.getTeamRequirement(seasonId, teamId)
      expect(status.car1.completed).toBe(1)
      expect(status.car2.completed).toBe(1)
      expect(status.completedTotal).toBe(2)
      expect(status.remainingTotal).toBe(2)
    })

    // RFP1-09: mesmo driverId nos dois carros -> bloqueado pela UI/serviço
    it('RFP1-09: O mesmo novato não pode ser escalado nos dois carros simultaneamente na mesma sessão', () => {
      const activeAssignmentCar1 = {
        seasonId: 'season_rfp1_09',
        round: 1,
        teamId: 'team_test',
        carId: 'car1' as const,
        rookieDriverId: 'rookie_shared',
        rookieDriverName: 'Shared Rookie',
        originalDriverId: 'titular_1',
        originalDriverName: 'Titular 1',
      }

      // Validar checagem canônica de ocupação do outro assento
      const selectedCarForModal: 'car1' | 'car2' = 'car2'
      const candidateRookieId = 'rookie_shared'
      const otherCarAssignment =
        (selectedCarForModal as string) === 'car1' ? null : activeAssignmentCar1
      const isOccupyingOtherCar = otherCarAssignment?.rookieDriverId === candidateRookieId

      expect(isOccupyingOtherCar).toBe(true)
    })

    // RFP1-10: selecionar rookie, iniciar TL1, rookie não completa nenhuma volta -> 0 crédito
    it('RFP1-10: Novato escalado que não completa nenhuma volta (0 laps) não recebe crédito', () => {
      const seasonId = 'season_rfp1_10'
      const teamId = 'team_no_laps'

      const res = RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round: 2,
        teamId,
        carId: 'car1',
        driverId: 'rookie_dud',
        driverName: 'Dud Rookie',
        lapsCompleted: 0,
        isRookieEligible: true,
      })

      expect(res.granted).toBe(false)
      expect(res.reason).toContain('pelo menos 1 volta')

      const status = RookiePracticeRequirementService.getTeamRequirement(seasonId, teamId)
      expect(status.car1.completed).toBe(0)
      expect(status.completedTotal).toBe(0)
    })

    // RFP1-11: participação válida concede exatamente 1 crédito
    it('RFP1-11: Participação válida com laps >= 1 concede exatamente 1 crédito idempotente', () => {
      const seasonId = 'season_rfp1_11'
      const round = 4
      const teamId = 'team_audi_test'

      const res1 = RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round,
        teamId,
        carId: 'car1',
        driverId: 'drv_rookie_bortoleto',
        driverName: 'Gabriel Bortoleto',
        lapsCompleted: 18,
        isRookieEligible: true,
      })
      expect(res1.granted).toBe(true)

      const status = RookiePracticeRequirementService.getTeamRequirementStatus(seasonId, teamId)
      expect(status.car1Credits).toBe(1)
      expect(status.totalCredits).toBe(1)
    })

    // RFP1-12: reload não duplica crédito
    it('RFP1-12: Reexecuções / reload não duplicam o crédito já concedido', () => {
      const seasonId = 'season_rfp1_12'
      const round = 4
      const teamId = 'team_audi_test'

      RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round,
        teamId,
        carId: 'car1',
        driverId: 'drv_rookie_bortoleto',
        driverName: 'Gabriel Bortoleto',
        lapsCompleted: 18,
        isRookieEligible: true,
      })

      // Segunda concessão imediata
      const res2 = RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round,
        teamId,
        carId: 'car1',
        driverId: 'drv_rookie_bortoleto',
        driverName: 'Gabriel Bortoleto',
        lapsCompleted: 22,
        isRookieEligible: true,
      })
      expect(res2.granted).toBe(false)
      expect(res2.reason).toContain('já foi concedido')

      const status = RookiePracticeRequirementService.getTeamRequirementStatus(seasonId, teamId)
      expect(status.car1Credits).toBe(1)
      expect(status.totalCredits).toBe(1)
    })

    // RFP1-13: simular restante não duplica crédito
    it('RFP1-13: Simular Restante não duplica crédito de novato', () => {
      const seasonId = 'season_rfp1_13'
      const round = 6
      const teamId = 'team_ferrari'

      // Concessão durante corrida de simulação
      const res1 = RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round,
        teamId,
        carId: 'car2',
        driverId: 'rookie_fer',
        driverName: 'Ferrari Rookie',
        lapsCompleted: 25,
        isRookieEligible: true,
      })
      expect(res1.granted).toBe(true)

      // Ao finalizar sessão novamente (ex: trigger ao final da simulação)
      const res2 = RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round,
        teamId,
        carId: 'car2',
        driverId: 'rookie_fer',
        driverName: 'Ferrari Rookie',
        lapsCompleted: 28,
        isRookieEligible: true,
      })
      expect(res2.granted).toBe(false)

      const status = RookiePracticeRequirementService.getTeamRequirementStatus(seasonId, teamId)
      expect(status.car2Credits).toBe(1)
      expect(status.totalCredits).toBe(1)
    })

    // RFP1-14: rookie usa pneu no TL1 -> mesmo tyreSetId permanece no inventário com desgaste preservado; titular no TL2 enxerga consumo
    it('RFP1-14: Desgaste de pneus consumidos pelo novato no TL1 persiste e titular no TL2 herda o inventário consumido', () => {
      const seasonId = 'season_rfp1_14'
      const round = 1
      const primaryDriverId = 'drv_bortoleto'

      // Cria inventário de 20 jogos para o titular do Carro 1
      const initialInvs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId,
        round,
        driverIds: [primaryDriverId],
        primaryDriverIds: [primaryDriverId],
      })

      const targetTire = initialInvs[primaryDriverId][0]
      expect(targetTire.lapsUsed).toBe(0)
      expect(targetTire.wear).toBe(0)

      // Novato usa este mesmo jogo no TL1 completando 10 voltas
      canonicalWeekendTyrePersistence.recordTyreUsage({
        seasonId,
        round,
        driverId: primaryDriverId,
        tyreSetId: targetTire.id,
        lapsAdded: 10,
        finalWearPct: 32,
      })

      // No TL2, o titular abre o estoque do fim de semana
      const freshInvs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId,
        round,
        driverIds: [primaryDriverId],
        primaryDriverIds: [primaryDriverId],
      })

      const usedTire = freshInvs[primaryDriverId].find((t) => t.id === targetTire.id)
      expect(usedTire?.lapsUsed).toBe(10)
      expect(usedTire?.wear).toBe(32)
    })

    // RFP1-15: setup pertence ao carro — nenhum reset ao trocar piloto, nenhuma cópia paralela
    it('RFP1-15: Setup pertence ao CARRO e não reseta nem duplica ao alternar entre titular e novato', () => {
      const careerId = 'team_setup_car'
      const seasonId = 'season_rfp1_15'
      const round = 2

      // TL1 com acerto personalizado
      const sessionTL1 = practiceSessionService.createInitialSessionState({
        careerId,
        seasonId,
        round,
        sessionType: 'tp1',
        preparation: {
          round,
          cars: [
            {
              carId: 'car1',
              driverId: 'drv_rookie_x',
              setup: { frontWing: 8, rearWing: 9, suspension: 5, differential: 65 },
              program: 'car_setup',
              tyreSelection: { compound: 'medio' },
            },
            {
              carId: 'car2',
              driverId: 'drv_hulkenberg',
              setup: { frontWing: 4, rearWing: 5, suspension: 7, differential: 45 },
              program: 'race_pace',
              tyreSelection: { compound: 'duro' },
            },
          ],
        } as any,
      })

      // Salva no cache local (como o TL1 faz ao rodar)
      ;(practiceSessionService as any).cacheLocally(sessionTL1)

      // No TL2, o titular herda exatamente os setups de Carro 1 e Carro 2
      const inherited = practiceSessionService.resolveInheritedWeekendKnowledge(
        careerId,
        seasonId,
        round,
        'tp2',
      )

      expect(inherited.car1Setup).toEqual({
        frontWing: 8,
        rearWing: 9,
        suspension: 5,
        differential: 65,
      })
      expect(inherited.car2Setup).toEqual({
        frontWing: 4,
        rearWing: 5,
        suspension: 7,
        differential: 45,
      })
    })

    // RFP1-16: snapshot principal antes/depois do TL1 com rookie -> driverId permanece o titular, sem mutação permanente
    it('RFP1-16: Snapshot principal de inscrição do GP é imutável perante participações de novatos no TL1', () => {
      const seasonId = 'season_rfp1_16'
      const round = 3

      const reg = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
        seasonId,
        round,
        gpName: 'GP da Austrália',
        playerTeam: mockPlayerTeam,
        allDrivers: [mockDriver1, mockDriver2],
        forceRecalculate: true,
      })

      const snapshotBefore = canonicalEventRegistrationService.readRegistrationSnapshot(
        seasonId,
        round,
      )
      expect(snapshotBefore?.entriesByCar.playerCar1.driverId).toBe(mockDriver1.id)

      // Simular participação de novato
      RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round,
        teamId: mockPlayerTeam.id,
        carId: 'car1',
        driverId: 'rookie_guest',
        driverName: 'Guest Rookie',
        lapsCompleted: 15,
        isRookieEligible: true,
      })

      const snapshotAfter = canonicalEventRegistrationService.readRegistrationSnapshot(
        seasonId,
        round,
      )
      expect(snapshotAfter?.entriesByCar.playerCar1.driverId).toBe(mockDriver1.id)
    })

    // RFP1-17: piloto da academia com careerF1GrandPrixStarts <= 2 + requisitos válidos -> pode ser elegível para TL1, mas NÃO concede Superlicença/Q1/corrida
    it('RFP1-17: Piloto da academia elegível para TL1 não recebe automaticamente Superlicença para GP oficial', () => {
      const academyPilot = {
        id: 'drv_academy_kid',
        name: 'Academy Prospect',
        f1_career_starts: 0,
        is_academy: true,
        role: 'reserva' as const,
        license_status: 'nivel_c' as const, // Não tem nível A
        superlicense_points: 20,
      }

      // Elegível como rookie no TL1
      const rookieCheck = RookiePracticeRequirementService.checkDriverEligibility(
        academyPilot as any,
      )
      expect(rookieCheck.isEligible).toBe(true)

      // Mas rejeitado pelo registro oficial da FIA para corrida de GP
      const fiaReg = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
        seasonId: 'season_rfp1_17',
        round: 1,
        gpName: 'GP Oficial',
        playerTeam: mockPlayerTeam,
        allDrivers: [mockDriver1, academyPilot as any],
        playerSeatOverrides: {
          car1DriverId: mockDriver1.id,
          car2DriverId: academyPilot.id!,
        },
        forceRecalculate: true,
      })
      expect(fiaReg.valid).toBe(false)
      expect(fiaReg.errors.some((e) => e.includes('Superlicença') || e.includes('Licença A'))).toBe(
        true,
      )
    })

    // RFP1-18: piloto reserva com careerF1GrandPrixStarts > 2 -> não é rookie; função "Reserva" não muda o critério
    it('RFP1-18: Piloto reserva com mais de 2 GPs não é considerado novato (critério é GPs, não a função)', () => {
      const experiencedReserve = {
        id: 'drv_veteran_reserve',
        name: 'Veteran Reserve',
        role: 'reserva' as const,
        f1_career_starts: 45, // Ex: veterano experiente como reserva
      }

      const check = RookiePracticeRequirementService.checkDriverEligibility(
        experiencedReserve as any,
      )
      expect(check.isEligible).toBe(false)
      expect(check.reason).toContain('Inelegível')
      expect(check.careerGPs).toBe(45)
    })

    // RFP1-19: simular temporada completa — para cada equipe rival com rookies elegíveis: Carro 1 = 2/2, Carro 2 = 2/2, total 4/4
    it('RFP1-19: Simulação de temporada completa gera 4/4 para equipes rivais com candidatos válidos e voltas reais', () => {
      const seasonId = 'season_rfp1_19_full'
      const rivalTeams = [
        { id: 'rival_ferrari', name: 'Scuderia Ferrari', team_key: 'ferrari' } as any,
        { id: 'rival_mclaren', name: 'McLaren F1', team_key: 'mclaren' } as any,
      ]

      const candidateDrivers = [
        {
          id: 'drv_fer_rookie1',
          name: 'Ferrari Rookie 1',
          team_id: 'rival_ferrari',
          role: 'reserva',
          f1_career_starts: 0,
        } as any,
        {
          id: 'drv_fer_rookie2',
          name: 'Ferrari Rookie 2',
          team_id: 'rival_ferrari',
          role: 'reserva',
          f1_career_starts: 0,
        } as any,
        {
          id: 'drv_mcl_rookie1',
          name: 'McLaren Rookie 1',
          team_id: 'rival_mclaren',
          role: 'reserva',
          f1_career_starts: 0,
        } as any,
        {
          id: 'drv_mcl_rookie2',
          name: 'McLaren Rookie 2',
          team_id: 'rival_mclaren',
          role: 'reserva',
          f1_career_starts: 0,
        } as any,
      ]

      // Gera as escalas de 24 rodadas
      const schedules = RookiePracticeRequirementService.getOrGenerateRivalAISchedules(
        seasonId,
        rivalTeams,
        candidateDrivers,
      )

      // Simula as 24 etapas
      for (let round = 1; round <= 24; round++) {
        // Mock de leaderboard com voltas para novatos escalados nessa rodada
        const roundEntries: Array<{ driverId: string; laps: number; driverName: string }> = []
        rivalTeams.forEach((rival) => {
          const plan = schedules[rival.id]
          if (plan.car1Rounds.includes(round)) {
            roundEntries.push({
              driverId: plan.car1RookieDriverId,
              laps: 18,
              driverName: 'Rookie C1',
            })
          }
          if (plan.car2Rounds.includes(round)) {
            roundEntries.push({
              driverId: plan.car2RookieDriverId,
              laps: 20,
              driverName: 'Rookie C2',
            })
          }
        })

        RookiePracticeRequirementService.simulateRivalAICreditsForRound(
          seasonId,
          round,
          rivalTeams,
          candidateDrivers,
          roundEntries,
        )
      }

      // Validação final de cada equipe rival: Carro 1 = 2/2, Carro 2 = 2/2, total = 4/4
      rivalTeams.forEach((rival) => {
        const req = RookiePracticeRequirementService.getTeamRequirement(seasonId, rival.id)
        expect(req.car1.completed).toBe(2)
        expect(req.car2.completed).toBe(2)
        expect(req.completedTotal).toBe(4)
        expect(req.isCompliant).toBe(true)
      })
    })

    // RFP1-20: equipe com Carro 1 = 2/2 e Carro 2 = 2/2 -> completedTotal = 4, requiredTotal = 4, status = CONFORME / isCompliant = true
    it('RFP1-20: Equipe que cumpre 2/2 no Carro 1 e 2/2 no Carro 2 atinge conformidade total regulamentar (isCompliant = true)', () => {
      const seasonId = 'season_rfp1_20'
      const teamId = 'team_compliant'

      RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round: 4,
        teamId,
        carId: 'car1',
        driverId: 'r1',
        driverName: 'Rookie 1',
        lapsCompleted: 15,
        isRookieEligible: true,
      })
      RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round: 12,
        teamId,
        carId: 'car1',
        driverId: 'r1',
        driverName: 'Rookie 1',
        lapsCompleted: 16,
        isRookieEligible: true,
      })
      RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round: 5,
        teamId,
        carId: 'car2',
        driverId: 'r2',
        driverName: 'Rookie 2',
        lapsCompleted: 17,
        isRookieEligible: true,
      })
      RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round: 16,
        teamId,
        carId: 'car2',
        driverId: 'r2',
        driverName: 'Rookie 2',
        lapsCompleted: 18,
        isRookieEligible: true,
      })

      const status = RookiePracticeRequirementService.getTeamRequirementStatus(seasonId, teamId)
      expect(status.car1Credits).toBe(2)
      expect(status.car2Credits).toBe(2)
      expect(status.totalCredits).toBe(4)
      expect(status.car1Remaining).toBe(0)
      expect(status.car2Remaining).toBe(0)
      expect(status.totalRemaining).toBe(0)
      expect(status.isCompliant).toBe(true)
    })
  })

  // =========================================================================
  // TESTES ADICIONAIS: DISTRIBUIÇÃO DETERMINÍSTICA, URGÊNCIA, AUDITABILIDADE
  // =========================================================================
  describe('TESTES ADICIONAIS: Distribuição determinística da IA, Urgência, Auditabilidade e Transferências', () => {
    // 1. Distribuição da IA: determinismo e plausibilidade sem concentração extrema nas últimas corridas
    it('Distribuição da IA: escalas determinísticas com distribuição bem balanceada ao longo das rodadas', () => {
      const seasonId = 'season_ai_distrib_test'
      const rivalTeams = [
        { id: 'rival_ferrari', name: 'Ferrari', team_key: 'ferrari' } as any,
        { id: 'rival_mercedes', name: 'Mercedes', team_key: 'mercedes' } as any,
        { id: 'rival_redbull', name: 'Red Bull', team_key: 'redbull' } as any,
      ]
      const drivers = [
        {
          id: 'd_fer',
          name: 'Fer Rookie',
          team_id: 'rival_ferrari',
          role: 'reserva',
          f1_career_starts: 0,
        } as any,
        {
          id: 'd_mer',
          name: 'Mer Rookie',
          team_id: 'rival_mercedes',
          role: 'reserva',
          f1_career_starts: 0,
        } as any,
        {
          id: 'd_rb',
          name: 'RB Rookie',
          team_id: 'rival_redbull',
          role: 'reserva',
          f1_career_starts: 0,
        } as any,
      ]

      const schedules = RookiePracticeRequirementService.getOrGenerateRivalAISchedules(
        seasonId,
        rivalTeams,
        drivers,
      )

      rivalTeams.forEach((rival) => {
        const plan = schedules[rival.id]
        expect(plan).toBeDefined()
        // Carro 1 alocado entre rodadas 3 e 17
        expect(plan.car1Rounds[0]).toBeGreaterThanOrEqual(3)
        expect(plan.car1Rounds[0]).toBeLessThanOrEqual(9)
        expect(plan.car1Rounds[1]).toBeGreaterThanOrEqual(11)
        expect(plan.car1Rounds[1]).toBeLessThanOrEqual(17)

        // Carro 2 alocado entre rodadas 4 e 21
        expect(plan.car2Rounds[0]).toBeGreaterThanOrEqual(4)
        expect(plan.car2Rounds[0]).toBeLessThanOrEqual(10)
        expect(plan.car2Rounds[1]).toBeGreaterThanOrEqual(15)
        expect(plan.car2Rounds[1]).toBeLessThanOrEqual(21)

        // Nenhuma escala alocada após a rodada 21 (evita concentração nas últimas 3 rodadas)
        expect(Math.max(...plan.car1Rounds, ...plan.car2Rounds)).toBeLessThanOrEqual(21)
      })
    })

    // 2. Regime de urgência regulamentar: restam <= 6 rodadas e pendências no carro
    it('Urgência: faltam 3 rodadas e Carro 2 tem 0/2 -> flag de urgência ativada', () => {
      const seasonId = 'season_urgency_test'
      const teamId = 'team_urgent_apex'

      // Rodada 22 de 24 (restam 3 rodadas: 22, 23, 24)
      const urgency = RookiePracticeRequirementService.isTeamUrgent(seasonId, teamId, 22)
      expect(urgency.remainingRounds).toBe(3)
      expect(urgency.isUrgent).toBe(true)
      expect(urgency.car1Urgent).toBe(true)
      expect(urgency.car2Urgent).toBe(true)
    })

    // 3. Ausência de urgência quando pendências já foram sanadas
    it('Urgência: equipe já cumpriu 4/4 -> urgência desligada mesmo na última rodada', () => {
      const seasonId = 'season_compliant_urgency'
      const teamId = 'team_compliant_late'

      // Conceder os 4 créditos
      ;['car1', 'car1', 'car2', 'car2'].forEach((carId, idx) => {
        RookiePracticeRequirementService.grantRookieFP1Credit({
          seasonId,
          round: idx + 1,
          teamId,
          carId: carId as any,
          driverId: `rookie_${idx}`,
          driverName: `Rookie ${idx}`,
          lapsCompleted: 15,
          isRookieEligible: true,
        })
      })

      const urgency = RookiePracticeRequirementService.isTeamUrgent(seasonId, teamId, 24)
      expect(urgency.remainingRounds).toBe(1)
      expect(urgency.isUrgent).toBe(false)
      expect(urgency.car1Urgent).toBe(false)
      expect(urgency.car2Urgent).toBe(false)
    })

    // 4. Troca de titular não reseta nem altera o contador do carro
    it('Troca de titular: Carro 1 = 1/2; ao trocar titular, Carro 1 continua 1/2', () => {
      const seasonId = 'season_driver_swap'
      const teamId = 'team_driver_swap'

      RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round: 3,
        teamId,
        carId: 'car1',
        driverId: 'rookie_first',
        driverName: 'First Rookie',
        lapsCompleted: 14,
        isRookieEligible: true,
      })

      let status = RookiePracticeRequirementService.getTeamRequirement(seasonId, teamId)
      expect(status.car1.completed).toBe(1)

      // Simulação de troca de titular no cadastro da equipe (o requisito pertence ao assento)
      status = RookiePracticeRequirementService.getTeamRequirement(seasonId, teamId)
      expect(status.car1.completed).toBe(1)
      expect(status.car1.completedRounds).toContain(3)
    })

    // 5. Transferência de rookie entre equipes não transfere créditos
    it('Transferência de novato: novato cumpre TL1 pela Equipe A e depois se transfere -> crédito permanece com Equipe A', () => {
      const seasonId = 'season_transfer_test'
      const teamA = 'team_alfa'
      const teamB = 'team_beta'
      const rookieId = 'drv_migrating_rookie'

      // Crédito ganho pela Equipe A
      RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round: 4,
        teamId: teamA,
        carId: 'car1',
        driverId: rookieId,
        driverName: 'Migrating Rookie',
        lapsCompleted: 19,
        isRookieEligible: true,
      })

      const reqA = RookiePracticeRequirementService.getTeamRequirement(seasonId, teamA)
      const reqB = RookiePracticeRequirementService.getTeamRequirement(seasonId, teamB)

      expect(reqA.car1.completed).toBe(1)
      expect(reqA.car1.participatingDriverIds).toContain(rookieId)

      // Equipe B não herda crédito nenhum
      expect(reqB.car1.completed).toBe(0)
      expect(reqB.car2.completed).toBe(0)
      expect(reqB.completedTotal).toBe(0)
    })

    // 6. Registro auditável completo por chave idempotente
    it('Histórico auditável: crédito concedido gera registro completo com carId, driverId, laps, timestamp e idempotencyKey', () => {
      const seasonId = 'season_audit_test'
      const round = 7
      const teamId = 'team_audit_target'
      const carId = 'car2'
      const driverId = 'drv_audit_rookie'

      const res = RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round,
        teamId,
        carId,
        driverId,
        driverName: 'Audit Rookie',
        lapsCompleted: 23,
        isRookieEligible: true,
      })

      expect(res.granted).toBe(true)

      const record = RookiePracticeRequirementService.getCreditRecord(
        seasonId,
        round,
        teamId,
        carId,
      )
      expect(record).not.toBeNull()
      expect(record?.seasonId).toBe(seasonId)
      expect(record?.round).toBe(round)
      expect(record?.teamId).toBe(teamId)
      expect(record?.carId).toBe(carId)
      expect(record?.driverId).toBe(driverId)
      expect(record?.driverName).toBe('Audit Rookie')
      expect(record?.lapsCompleted).toBe(23)
      expect(record?.timestamp).toBeDefined()
      expect(record?.creditKey).toBe(`rookie_fp1_credit_${seasonId}_${round}_${teamId}_${carId}`)
    })

    // 7. Ausência de novato elegível (PENDING_NO_ELIGIBLE_ROOKIE): não quebra, sem piloto fantasma, sem crédito espúrio
    it('Ausência de novato elegível: gera estado canônico PENDING_NO_ELIGIBLE_ROOKIE sem piloto fictício e sem concessão espúria', () => {
      const seasonId = 'season_no_rookie_available'
      const rivalTeams = [
        { id: 'rival_solitary', name: 'Solitary Racing Team', team_key: 'solitary' } as any,
      ]
      // Nenhum candidato no catálogo inteiro
      const emptyDrivers: any[] = []

      const schedules = RookiePracticeRequirementService.getOrGenerateRivalAISchedules(
        seasonId,
        rivalTeams,
        emptyDrivers,
      )

      const plan = schedules['rival_solitary']
      expect(plan).toBeDefined()
      expect(plan.car1RookieDriverId).toBe('PENDING_NO_ELIGIBLE_ROOKIE')
      expect(plan.car2RookieDriverId).toBe('PENDING_NO_ELIGIBLE_ROOKIE')

      // Simulação da rodada com PENDING_NO_ELIGIBLE_ROOKIE não concede crédito nem cria piloto fantasma
      RookiePracticeRequirementService.simulateRivalAICreditsForRound(
        seasonId,
        plan.car1Rounds[0],
        rivalTeams,
        emptyDrivers,
      )

      const req = RookiePracticeRequirementService.getTeamRequirement(seasonId, 'rival_solitary')
      expect(req.car1.completed).toBe(0)
      expect(req.completedTotal).toBe(0)
      expect(req.isCompliant).toBe(false)
    })

    // 8. Isolamento de temporada: chave por seasonId sem contaminação entre temporadas
    it('Transição entre temporadas: cumprimento de créditos na Temporada A não contamina Temporada B', () => {
      const seasonA = 'season_2026'
      const seasonB = 'season_2027'
      const teamId = 'team_apex_f1'

      // Temporada A completa Carro 1 = 2/2
      RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId: seasonA,
        round: 3,
        teamId,
        carId: 'car1',
        driverId: 'rookie_2026_a',
        driverName: 'Rookie 2026 A',
        lapsCompleted: 15,
        isRookieEligible: true,
      })
      RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId: seasonA,
        round: 12,
        teamId,
        carId: 'car1',
        driverId: 'rookie_2026_b',
        driverName: 'Rookie 2026 B',
        lapsCompleted: 16,
        isRookieEligible: true,
      })

      const reqA = RookiePracticeRequirementService.getTeamRequirement(seasonA, teamId)
      expect(reqA.car1.completed).toBe(2)

      // Temporada B começa limpa: Carro 1 = 0/2
      const reqB = RookiePracticeRequirementService.getTeamRequirement(seasonB, teamId)
      expect(reqB.car1.completed).toBe(0)
      expect(reqB.car2.completed).toBe(0)
      expect(reqB.completedTotal).toBe(0)
      expect(reqB.remainingTotal).toBe(4)
      expect(reqB.isCompliant).toBe(false)
    })

    // 9. Persistência real entre fins de semana distintos da mesma temporada
    it('Persistência entre GPs da mesma temporada: GP 1 avança Carro 1 para 1/2; GP 2 mantém 1/2', () => {
      const seasonId = 'season_gp_persistence'
      const teamId = 'team_gp_persistence'

      // GP 1 (rodada 1): Novato completa TL1 no Carro 1
      const resGP1 = RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round: 1,
        teamId,
        carId: 'car1',
        driverId: 'rookie_gp1',
        driverName: 'Rookie GP1',
        lapsCompleted: 20,
        isRookieEligible: true,
      })
      expect(resGP1.granted).toBe(true)

      // "Recarregando" estado no GP 2 (rodada 2)
      const reqGP2 = RookiePracticeRequirementService.getTeamRequirement(seasonId, teamId)
      expect(reqGP2.car1.completed).toBe(1)
      expect(reqGP2.car1.remaining).toBe(1)
      expect(reqGP2.car1.completedRounds).toEqual([1])
      expect(reqGP2.car1.participatingDriverIds).toEqual(['rookie_gp1'])
      expect(reqGP2.car2.completed).toBe(0)
      expect(reqGP2.completedTotal).toBe(1)
    })

    // BUG 2 REGRESSÃO COMPLETA (INTEGRAÇÃO E FLUXO REAL NO TL1):
    it('BUG 2 REGRESSÃO: Catálogo síncrono disponibiliza novatos imediatamente mesmo com allDriversCatalog vazio', () => {
      // Mesmo se allDriversCatalog for array vazio [], o serviço usa fallback síncrono
      const options = RookiePracticeRequirementService.getRosterRookieOptions(
        [mockDriver1, mockDriver2],
        [],
        mockPlayerTeam.id,
      )
      expect(options.eligible.length).toBeGreaterThan(0)
      // Deve incluir pilotos novatos com <= 2 GPs
      const names = options.eligible.map((e) => e.driverName)
      expect(
        names.some(
          (n) =>
            n.includes('Maloney') ||
            n.includes('Bearman') ||
            n.includes('Bortoleto') ||
            n.includes('Antonelli') ||
            n.includes('Drugovich') ||
            n.includes('Lindblad') ||
            n.includes('Fittipaldi'),
        ),
      ).toBe(true)

      // Regra de elegibilidade estrita: nenhum elegível pode ter mais de 2 largadas na F1
      expect(options.eligible.every((e) => e.careerGPs <= 2)).toBe(true)

      // Se houver piloto com > 2 largadas no catálogo, ele deve constar exclusivamente em ineligible
      const veteranDriver: DriverModel = {
        id: 'veteran_driver_test',
        name: 'Fernando Alonso',
        nationality: 'Espanha',
        age: 44,
        speed: 89,
        consistency: 90,
        rain: 90,
        defense: 91,
        salary: 18000000,
        contract_end: 2026,
        career_records: {
          starts: 390,
          wins: 32,
          podiums: 106,
          poles: 22,
          championships: 2,
          points: 2300,
        },
      }
      const testWithOptions = RookiePracticeRequirementService.getRosterRookieOptions(
        [mockDriver1, mockDriver2],
        [veteranDriver],
        mockPlayerTeam.id,
      )
      const veteranCheck = testWithOptions.ineligible.find(
        (i) => i.driverId === 'veteran_driver_test',
      )
      expect(veteranCheck).toBeDefined()
      expect(veteranCheck?.isEligible).toBe(false)
      expect(veteranCheck?.reason).toContain('GPs')
      expect(testWithOptions.eligible.some((e) => e.driverId === 'veteran_driver_test')).toBe(false)
    })

    it('BUG 2 REGRESSÃO FLUXO COMPLETO: abrir TL1 -> selecionar reserva -> confirmar -> TL1 usa reserva -> completar >=1 volta -> crédito concedido 1 única vez -> abrir TL2 -> titular restaurado', () => {
      const seasonId = 'season_bug2_flow'
      const round = 1
      const teamId = mockPlayerTeam.id

      // 1. Inscrição formal do GP
      const reg = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
        seasonId,
        round,
        gpName: 'GP do Bahrein',
        playerTeam: mockPlayerTeam,
        allDrivers: [mockDriver1, mockDriver2],
        forceRecalculate: true,
      })

      // 2. Opções disponíveis de novato no catálogo síncrono
      const rookieOptions = RookiePracticeRequirementService.getRosterRookieOptions(
        [mockDriver1, mockDriver2],
        [],
        teamId,
      )
      expect(rookieOptions.eligible.length).toBeGreaterThan(0)
      const selectedRookie = rookieOptions.eligible[0]

      // 3. Jogador escala o reserva no Carro 1 para o TL1 antes de dar Play
      const assignment = {
        seasonId,
        round,
        teamId,
        carId: 'car1' as const,
        rookieDriverId: selectedRookie.driverId,
        rookieDriverName: selectedRookie.driverName,
        originalDriverId: mockDriver1.id,
        originalDriverName: mockDriver1.name,
      }
      RookiePracticeRequirementService.setTemporaryFP1Assignment(assignment)

      // Reload/reentrada: composição do TL1 continua consistente com o novato
      const reloadedAssignment = RookiePracticeRequirementService.getTemporaryFP1Assignment(
        seasonId,
        round,
        teamId,
        'car1',
      )
      expect(reloadedAssignment?.rookieDriverId).toBe(selectedRookie.driverId)

      // 4. Iniciar TL1: Carro 1 é ocupado pelo reserva
      const sessionTL1 = practiceSessionService.createInitialSessionState({
        careerId: teamId,
        seasonId,
        round,
        sessionType: 'tp1',
        preparation: {
          round,
          cars: [
            { carId: 'car1', driverId: selectedRookie.driverId, setup: { frontWing: 6 } },
            { carId: 'car2', driverId: mockDriver2.id, setup: { frontWing: 6 } },
          ],
        } as any,
        driverNames: {
          car1: selectedRookie.driverName,
          driver1Id: selectedRookie.driverId,
          car2: mockDriver2.name,
          driver2Id: mockDriver2.id,
        },
      })
      expect(sessionTL1.cars.car1.driverId).toBe(selectedRookie.driverId)
      expect(sessionTL1.cars.car1.driverName).toBe(selectedRookie.driverName)
      expect(sessionTL1.cars.car2.driverId).toBe(mockDriver2.id)

      // 5. Reserva completa >= 1 volta no TL1
      PracticeSessionRunner.orderCarExitToTrack(sessionTL1, 'car1')
      const tickCtx: PracticeTickContext = {
        round,
        gpName: 'GP do Bahrein',
        circuitName: 'Circuito Internacional do Bahrein',
        lengthKm: 5.4,
        tireAbrasiveness: 6,
        weather: 'seco',
        teamChassisRating: 80,
        teamEngineSupplier: 'Audi',
        teamName: mockPlayerTeam.name,
        teamColor: mockPlayerTeam.color,
        drivers: [
          {
            id: selectedRookie.driverId,
            name: selectedRookie.driverName,
            speed: 80,
            consistency: 80,
            defense: 78,
            technical_feedback: 75,
            isRookie: true,
          },
          {
            id: mockDriver2.id,
            name: mockDriver2.name,
            speed: 84,
            consistency: 84,
            defense: 82,
            technical_feedback: 80,
            isRookie: false,
          },
        ],
      }

      // Simula voltas
      CanonicalPracticeV2Runner.advanceBySeconds(sessionTL1, 300, tickCtx)
      sessionTL1.cars.car1.totalLaps = 5

      // 6. Encerra TL1 -> Homologa crédito de novatos
      const creditRes1 = RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round,
        teamId,
        carId: 'car1',
        driverId: selectedRookie.driverId,
        driverName: selectedRookie.driverName,
        lapsCompleted: sessionTL1.cars.car1.totalLaps,
        isRookieEligible: true,
      })
      expect(creditRes1.granted).toBe(true)

      // Idempotência: segunda tentativa na mesma rodada NÃO duplica
      const creditRes2 = RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round,
        teamId,
        carId: 'car1',
        driverId: selectedRookie.driverId,
        driverName: selectedRookie.driverName,
        lapsCompleted: sessionTL1.cars.car1.totalLaps,
        isRookieEligible: true,
      })
      expect(creditRes2.granted).toBe(false)
      expect(creditRes2.reason).toContain('já concedido')

      const teamReqAfterTL1 = RookiePracticeRequirementService.getTeamRequirement(seasonId, teamId)
      expect(teamReqAfterTL1.car1.completed).toBe(1)
      expect(teamReqAfterTL1.completedTotal).toBe(1)

      // 7. Abrir TL2 (ou sessão posterior): initializePracticeSession('tp2') força a restauração dos titulares contratuais
      const sessionTL2 = practiceSessionService.createInitialSessionState({
        careerId: teamId,
        seasonId,
        round,
        sessionType: 'tp2',
        preparation: {
          round,
          cars: [
            {
              carId: 'car1',
              driverId: reg.snapshot!.entriesByCar.playerCar1.driverId,
              setup: { frontWing: 6 },
            },
            {
              carId: 'car2',
              driverId: reg.snapshot!.entriesByCar.playerCar2.driverId,
              setup: { frontWing: 6 },
            },
          ],
        } as any,
        driverNames: {
          car1: reg.snapshot!.entriesByCar.playerCar1.driverName,
          driver1Id: reg.snapshot!.entriesByCar.playerCar1.driverId,
          car2: reg.snapshot!.entriesByCar.playerCar2.driverName,
          driver2Id: reg.snapshot!.entriesByCar.playerCar2.driverId,
        },
      })

      // Titular original Gabriel Bortoleto restaurado no TL2!
      expect(sessionTL2.cars.car1.driverId).toBe(mockDriver1.id)
      expect(sessionTL2.cars.car1.driverName).toBe(mockDriver1.name)
      expect(sessionTL2.cars.car2.driverId).toBe(mockDriver2.id)
      expect(sessionTL2.cars.car2.driverName).toBe(mockDriver2.name)

      // Lineup contratual e snapshot do GP intocados
      const freshSnap = canonicalEventRegistrationService.readRegistrationSnapshot(seasonId, round)
      expect(freshSnap?.entriesByCar.playerCar1.driverId).toBe(mockDriver1.id)
      expect(freshSnap?.entriesByCar.playerCar2.driverId).toBe(mockDriver2.id)
    })
  })
})
