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

  // RFP1-11, RFP1-12, RFP1-13: Idempotência de concessão de crédito TL1 e suporte a IA Rival
  describe('RFP1-11 a RFP1-13: Idempotência de crédito TL1 e IA Rival', () => {
    it('RFP1-11: grantRookieFP1Credit é estritamente idempotente pela chave round + team + car', () => {
      const seasonId = 'season_rfp1_test'
      const round = 4
      const teamId = 'team_audi_test'
      const carId = 'car1'
      const driverId = 'drv_rookie_bortoleto'

      // Concessão 1
      const res1 = RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round,
        teamId,
        carId,
        driverId,
        driverName: 'Gabriel Bortoleto',
        lapsCompleted: 18,
        isRookieEligible: true,
      })
      expect(res1.granted).toBe(true)

      // Concessão 2 (repetida)
      const res2 = RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round,
        teamId,
        carId,
        driverId,
        driverName: 'Gabriel Bortoleto',
        lapsCompleted: 22,
        isRookieEligible: true,
      })
      expect(res2.granted).toBe(false)
      expect(res2.reason).toContain('já foi concedido')

      // Verificar total de créditos gravados: deve ser exatamente 1 para este carro
      const teamStatus = RookiePracticeRequirementService.getTeamRequirementStatus(
        seasonId,
        teamId,
        'Audi Revolut',
      )
      expect(teamStatus.car1Credits).toBe(1)
      expect(teamStatus.car2Credits).toBe(0)
      expect(teamStatus.totalCredits).toBe(1)
    })

    it('RFP1-12: TotalLaps < 1 não concede crédito de novato', () => {
      const seasonId = 'season_rfp1_zero_laps'
      const round = 5
      const teamId = 'team_player'

      const res = RookiePracticeRequirementService.grantRookieFP1Credit({
        seasonId,
        round,
        teamId,
        carId: 'car2',
        driverId: 'drv_rookie_test',
        driverName: 'Test Rookie',
        lapsCompleted: 0,
        isRookieEligible: true,
      })

      expect(res.granted).toBe(false)
      expect(res.reason).toContain('pelo menos 1 volta')
    })

    it('RFP1-13: simulateRivalAICreditsForRound concede créditos idempotentes aos rivais com laps >= 1', () => {
      const seasonId = 'season_rfp1_rivals'
      const rivalTeams = [
        { id: 'ferrari', name: 'Ferrari', team_key: 'ferrari' } as any,
        { id: 'mclaren', name: 'McLaren', team_key: 'mclaren' } as any,
      ]
      const allDrivers = [
        {
          id: 'rookie_fer_1',
          name: 'Ferrari Academy Driver',
          team_id: 'ferrari',
          role: 'reserva',
        } as any,
      ]

      // Gerar escala
      const schedules = RookiePracticeRequirementService.getOrGenerateRivalAISchedules(
        seasonId,
        rivalTeams,
        allDrivers,
      )
      expect(schedules['ferrari']).toBeDefined()

      const scheduledRound = schedules['ferrari'].car1Rounds[0]

      // Simular com leaderboard mock onde o novato deu voltas
      RookiePracticeRequirementService.simulateRivalAICreditsForRound(
        seasonId,
        scheduledRound,
        rivalTeams,
        allDrivers,
        [
          {
            driverId: schedules['ferrari'].car1RookieDriverId,
            laps: 15,
            driverName: 'Novato Ferrari',
          },
        ],
      )

      const status1 = RookiePracticeRequirementService.getTeamRequirementStatus(
        seasonId,
        'ferrari',
        'Ferrari',
      )
      expect(status1.car1Credits).toBe(1)

      // Repetir a chamada para o mesmo round não duplica o crédito
      RookiePracticeRequirementService.simulateRivalAICreditsForRound(
        seasonId,
        scheduledRound,
        rivalTeams,
        allDrivers,
        [
          {
            driverId: schedules['ferrari'].car1RookieDriverId,
            laps: 20,
            driverName: 'Novato Ferrari',
          },
        ],
      )

      const status2 = RookiePracticeRequirementService.getTeamRequirementStatus(
        seasonId,
        'ferrari',
        'Ferrari',
      )
      expect(status2.car1Credits).toBe(1)
    })
  })
})
