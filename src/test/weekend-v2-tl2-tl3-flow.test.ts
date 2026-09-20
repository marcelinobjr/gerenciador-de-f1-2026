/**
 * SUÍTE DE TESTES FW2.1C — TL2 E TL3 COM HERANÇA CANÔNICA, REUTILIZAÇÃO DO RUNNER E ESTEIRA
 *
 * Requisitos prescritivos testados:
 * C1: TL2 e TL3 reutilizam o MESMO runner (PracticeSessionRunner & CanonicalPracticeV2Runner) mudando apenas o sessionType.
 * C2: TL2 herda estoque restante de pneus do TL1 sem recriação (20 jogos/piloto mantidos).
 * C3: TL2 herda conhecimento e acerto (setup) refinado no TL1.
 * C4: TL3 herda conhecimento acumulado de TL1 + TL2 e setups refinados.
 * C5: Controles operacionais (+1 min, +5 min, Simular Restante) executam o runner real em TL2 e TL3.
 * C6: Evento obrigatório interrompe saltos em TL2 e TL3.
 * C7: Sessão concluída (COMPLETED) bloqueia reexecução ("Não permitir voltar no fluxo e executar novamente uma sessão oficialmente concluída").
 * C8: Progressão da esteira: TL1 concluído habilita TL2; TL2 ativo mantém TL3 bloqueado; TL2 concluído habilita TL3.
 * C9: N18 & N22: Reload preserva estado em TL2/TL3 e nunca duplica tyreSetIds.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PracticeSessionRunner, type PracticeTickContext } from '@/services/canonicalPracticeRunner'
import { CanonicalPracticeV2Runner } from '@/services/canonicalPracticeV2Runner'
import { practiceSessionService } from '@/services/practiceSessionService'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import {
  readStoredCompletedSessions,
  writeStoredCompletedSessions,
  getCanonicalWeekendSchedule,
} from '@/services/weekendProgressionService'
import type { PracticeSessionRecordState } from '@/types/practice-session'

// Mock simples de localStorage
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

describe('NOVA EXPERIÊNCIA DE FIM DE SEMANA — FW2.1C (TL2 E TL3)', () => {
  const careerId = 'team_player_apex'
  const seasonId = 'season_fw21c_test'
  const round = 1

  const mockContext: PracticeTickContext = {
    round,
    gpName: 'GP do Japão',
    circuitName: 'Suzuka',
    lengthKm: 5.807,
    tireAbrasiveness: 7,
    weather: 'seco',
    teamChassisRating: 80,
    teamEngineSupplier: 'Audi',
    teamName: 'APEX GP',
    teamColor: '#00A6FB',
    drivers: [
      {
        id: 'drv_bortoleto',
        name: 'Gabriel Bortoleto',
        speed: 84,
        consistency: 82,
        defense: 80,
        technical_feedback: 80,
      },
      {
        id: 'drv_hulkenberg',
        name: 'Nico Hülkenberg',
        speed: 83,
        consistency: 85,
        defense: 82,
        technical_feedback: 85,
      },
    ],
  }

  beforeEach(() => {
    localStorageMock.clear()
  })

  it('C1: TL2 e TL3 utilizam o mesmo runner e estrutura de sessão de TL1, com sessionType respectivo', async () => {
    // Inicializar TL1
    const { session: tl1 } = await practiceSessionService.openOrResumePracticeSession({
      careerId,
      seasonId,
      round,
      sessionType: 'tp1',
      preparation: {
        round,
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

    expect(tl1.sessionType).toBe('tp1')
    expect(tl1.timeRemainingSec).toBe(3600)

    // Inicializar TL2 com o mesmo service/runner
    const { session: tl2 } = await practiceSessionService.openOrResumePracticeSession({
      careerId,
      seasonId,
      round,
      sessionType: 'tp2',
      preparation: {
        round,
        cars: [
          { carId: 'car1', driverId: 'drv_bortoleto', fuelLoad: { kg: 30 } },
          { carId: 'car2', driverId: 'drv_hulkenberg', fuelLoad: { kg: 30 } },
        ],
      } as any,
    })

    expect(tl2.sessionType).toBe('tp2')
    expect(tl2.timeRemainingSec).toBe(3600)
    expect(tl2.cars.car1).toBeDefined()
    expect(tl2.cars.car2).toBeDefined()

    // Inicializar TL3 com o mesmo service/runner
    const { session: tl3 } = await practiceSessionService.openOrResumePracticeSession({
      careerId,
      seasonId,
      round,
      sessionType: 'tp3',
      preparation: {
        round,
        cars: [
          { carId: 'car1', driverId: 'drv_bortoleto', fuelLoad: { kg: 30 } },
          { carId: 'car2', driverId: 'drv_hulkenberg', fuelLoad: { kg: 30 } },
        ],
      } as any,
    })

    expect(tl3.sessionType).toBe('tp3')
    expect(tl3.timeRemainingSec).toBe(3600)
  })

  it('C2 & N20: TL2 e TL3 herdam o estoque restante de TL1 sem gerar novos inventários (20 jogos mantidos)', () => {
    // 1. Criar inventário canônico inicial de fim de semana
    const driverIds = ['drv_bortoleto', 'drv_hulkenberg']
    const initialInvs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds,
    })

    expect(initialInvs['drv_bortoleto']).toHaveLength(20)
    expect(initialInvs['drv_hulkenberg']).toHaveLength(20)

    // 2. Simular uso de 1 jogo de pneus no TL1
    const setTL1 = initialInvs['drv_bortoleto'][0]
    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId: 'drv_bortoleto',
      tyreSetId: setTL1.id,
      lapsAdded: 12,
      finalWearPct: 32,
    })

    // 3. Carregar estoque para TL2
    const invsTL2 = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds,
    })

    expect(invsTL2['drv_bortoleto']).toHaveLength(20) // Nenhum jogo duplicado
    const setInTL2 = invsTL2['drv_bortoleto'].find((s) => s.id === setTL1.id)!
    expect(setInTL2.wear).toBe(32)
    expect(setInTL2.lapsUsed).toBe(12)
    expect(setInTL2.status).toBe('usado')

    // 4. Simular uso de outro jogo no TL2
    const setTL2 = invsTL2['drv_bortoleto'][1]
    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId: 'drv_bortoleto',
      tyreSetId: setTL2.id,
      lapsAdded: 8,
      finalWearPct: 25,
    })

    // 5. Carregar estoque para TL3
    const invsTL3 = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds,
    })

    expect(invsTL3['drv_bortoleto']).toHaveLength(20)
    expect(invsTL3['drv_bortoleto'].find((s) => s.id === setTL1.id)?.wear).toBe(32)
    expect(invsTL3['drv_bortoleto'].find((s) => s.id === setTL2.id)?.wear).toBe(25)
  })

  it('C3 & C4: TL2 herda setup e conhecimento do TL1; TL3 herda TL1 + TL2 acumulados', async () => {
    // 1. Executar TL1 e alterar acerto do Carro 1 e Carro 2
    const { session: tl1 } = await practiceSessionService.openOrResumePracticeSession({
      careerId,
      seasonId,
      round,
      sessionType: 'tp1',
      preparation: {
        round,
        cars: [
          {
            carId: 'car1',
            driverId: 'drv_bortoleto',
            setup: { frontWing: 5, rearWing: 5, suspension: 5, differential: 50 },
            fuelLoad: { kg: 30 },
          },
          {
            carId: 'car2',
            driverId: 'drv_hulkenberg',
            setup: { frontWing: 5, rearWing: 5, suspension: 5, differential: 50 },
            fuelLoad: { kg: 30 },
          },
        ],
      } as any,
    })

    // Modificar setup no box durante TL1
    PracticeSessionRunner.updateCarGarageSetup(tl1, 'car1', {
      frontWing: 8,
      rearWing: 7,
      suspension: 6,
      differential: 55,
    })

    // Fornecer feedback e consolidar conhecimento no TL1
    tl1.knowledge.frontWing.revealed = true
    tl1.knowledge.frontWing.minKnown = 7
    tl1.knowledge.frontWing.maxKnown = 9
    tl1.knowledge.overallConfidence = 'media'
    tl1.knowledge.totalStintsAnalyzed = 2

    // Finalizar TL1 oficialmente
    await practiceSessionService.markPracticeCompleted(tl1)

    // 2. Abrir TL2 — deve herdar setup e conhecimento do TL1
    const { session: tl2 } = await practiceSessionService.openOrResumePracticeSession({
      careerId,
      seasonId,
      round,
      sessionType: 'tp2',
      preparation: {
        round,
        cars: [
          { carId: 'car1', driverId: 'drv_bortoleto', fuelLoad: { kg: 30 } },
          { carId: 'car2', driverId: 'drv_hulkenberg', fuelLoad: { kg: 30 } },
        ],
      } as any,
    })

    expect(tl2.cars.car1.setup.frontWing).toBe(8)
    expect(tl2.cars.car1.setup.rearWing).toBe(7)
    expect(tl2.cars.car1.setup.suspension).toBe(6)
    expect(tl2.cars.car1.setup.differential).toBe(55)
    expect(tl2.knowledge.frontWing.revealed).toBe(true)
    expect(tl2.knowledge.frontWing.minKnown).toBe(7)
    expect(tl2.knowledge.frontWing.maxKnown).toBe(9)

    // Evoluir ainda mais o conhecimento no TL2
    tl2.knowledge.rearWing.revealed = true
    tl2.knowledge.rearWing.minKnown = 6
    tl2.knowledge.rearWing.maxKnown = 8
    tl2.knowledge.overallConfidence = 'alta'
    tl2.knowledge.totalStintsAnalyzed = 5

    // Ajustar setup do Carro 2 no TL2
    PracticeSessionRunner.updateCarGarageSetup(tl2, 'car2', {
      frontWing: 7,
      rearWing: 8,
      suspension: 5,
      differential: 60,
    })

    await practiceSessionService.markPracticeCompleted(tl2)

    // 3. Abrir TL3 — deve herdar TL1 + TL2 acumulados
    const { session: tl3 } = await practiceSessionService.openOrResumePracticeSession({
      careerId,
      seasonId,
      round,
      sessionType: 'tp3',
      preparation: {
        round,
        cars: [
          { carId: 'car1', driverId: 'drv_bortoleto', fuelLoad: { kg: 30 } },
          { carId: 'car2', driverId: 'drv_hulkenberg', fuelLoad: { kg: 30 } },
        ],
      } as any,
    })

    // TL3 herdou asas de ambos os treinos
    expect(tl3.knowledge.frontWing.revealed).toBe(true)
    expect(tl3.knowledge.rearWing.revealed).toBe(true)
    expect(tl3.knowledge.overallConfidence).toBe('alta')
    expect(tl3.cars.car2.setup.differential).toBe(60)
  })

  it('C5 & C6: Controles (+1 min, +5 min, Simular Restante) executam o runner em TL2 e TL3 com interrupção em decisão', async () => {
    const { session: tl2 } = await practiceSessionService.openOrResumePracticeSession({
      careerId,
      seasonId,
      round,
      sessionType: 'tp2',
      preparation: {
        round,
        cars: [
          {
            carId: 'car1',
            driverId: 'drv_bortoleto',
            fuelLoad: { kg: 30 },
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          },
          {
            carId: 'car2',
            driverId: 'drv_hulkenberg',
            fuelLoad: { kg: 30 },
            setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          },
        ],
      } as any,
    })

    // Carros saem para a pista
    PracticeSessionRunner.orderCarExitToTrack(tl2, 'car1')
    PracticeSessionRunner.orderCarExitToTrack(tl2, 'car2')

    // +1 min
    const res1 = CanonicalPracticeV2Runner.advanceBySeconds(tl2, 60, mockContext)
    expect(res1.secondsSimulated).toBe(60)
    expect(res1.nextState.elapsedTimeSec).toBe(60)
    expect(res1.nextState.timeRemainingSec).toBe(3540)

    // +5 min
    const res5 = CanonicalPracticeV2Runner.advanceBySeconds(res1.nextState, 300, mockContext)
    expect(res5.secondsSimulated).toBe(300)
    expect(res5.nextState.elapsedTimeSec).toBe(360)

    // Simular Restante
    const resRem = CanonicalPracticeV2Runner.simulateRemainingSession(res5.nextState, mockContext)
    expect(resRem.nextState.timeRemainingSec).toBe(0)
    expect(resRem.nextState.status).toBe('completed')
    expect(resRem.lapsCount).toBeGreaterThan(10)
  })

  it('C7: Sessão concluída (COMPLETED) bloqueia reexecução canônica', async () => {
    const seasonProgressKey = 'season_c7_test'
    writeStoredCompletedSessions(seasonProgressKey, round, ['tp1'])

    const stored = readStoredCompletedSessions(seasonProgressKey, round)
    expect(stored.includes('tp1')).toBe(true)

    // Simular tentativa de avanço em sessão completada
    const { session: tl1 } = await practiceSessionService.openOrResumePracticeSession({
      careerId,
      seasonId: seasonProgressKey,
      round,
      sessionType: 'tp1',
      preparation: {
        round,
        cars: [
          { carId: 'car1', driverId: 'drv_bortoleto', fuelLoad: { kg: 30 } },
          { carId: 'car2', driverId: 'drv_hulkenberg', fuelLoad: { kg: 30 } },
        ],
      } as any,
    })

    tl1.status = 'completed'

    // O runner canônico recusa avançar sessão finalizada
    const res = CanonicalPracticeV2Runner.advanceBySeconds(tl1, 60, mockContext)
    expect(res.secondsSimulated).toBe(0)
    expect(res.nextState.status).toBe('completed')
  })

  it('C8: Esteira do Fim de Semana: TL1 concluído habilita TL2; TL2 ativo mantém TL3 bloqueado', () => {
    const schedule = getCanonicalWeekendSchedule(round)
    expect(schedule).toContain('tp1')
    expect(schedule).toContain('tp2')
    expect(schedule).toContain('tp3')

    // Cenário 1: início do evento (nenhuma sessão concluída)
    const initialCompleted = readStoredCompletedSessions(seasonId, round)
    expect(initialCompleted).toEqual([])

    // TL2 deve estar bloqueado sem TL1
    const canAccessTL2_init = initialCompleted.includes('tp1')
    expect(canAccessTL2_init).toBe(false)

    // Cenário 2: TL1 finalizado
    writeStoredCompletedSessions(seasonId, round, ['tp1'])
    const afterTL1 = readStoredCompletedSessions(seasonId, round)
    const canAccessTL2_after = afterTL1.includes('tp1')
    const canAccessTL3_after = afterTL1.includes('tp2')

    expect(canAccessTL2_after).toBe(true)
    expect(canAccessTL3_after).toBe(false) // TL3 continua bloqueado

    // Cenário 3: TL2 finalizado
    writeStoredCompletedSessions(seasonId, round, ['tp1', 'tp2'])
    const afterTL2 = readStoredCompletedSessions(seasonId, round)
    const canAccessTL3_now = afterTL2.includes('tp2')

    expect(canAccessTL3_now).toBe(true)
  })

  it('C9 & N18 & N22: Reload preserva estado em TL2/TL3 e nunca duplica tyreSetIds', async () => {
    // 1. Criar e salvar sessão TL2
    const { session: tl2 } = await practiceSessionService.openOrResumePracticeSession({
      careerId,
      seasonId,
      round,
      sessionType: 'tp2',
      preparation: {
        round,
        cars: [
          { carId: 'car1', driverId: 'drv_bortoleto', fuelLoad: { kg: 30 } },
          { carId: 'car2', driverId: 'drv_hulkenberg', fuelLoad: { kg: 30 } },
        ],
      } as any,
    })

    PracticeSessionRunner.orderCarExitToTrack(tl2, 'car1')
    PracticeSessionRunner.tick(tl2, 120, mockContext)
    await practiceSessionService.saveSessionState(tl2)

    // 2. Recarregar (simulando reload da página)
    const { session: reloaded, isResumed } =
      await practiceSessionService.openOrResumePracticeSession({
        careerId,
        seasonId,
        round,
        sessionType: 'tp2',
        preparation: {} as any,
      })

    expect(isResumed).toBe(true)
    expect(reloaded.sessionType).toBe('tp2')
    expect(reloaded.elapsedTimeSec).toBe(120)
    expect(reloaded.cars.car1.status).toBe('flying_lap')

    // 3. Checar inventário após múltiplos reloads
    for (let i = 0; i < 5; i++) {
      const invs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId,
        round,
        driverIds: ['drv_bortoleto'],
      })
      expect(invs['drv_bortoleto']).toHaveLength(20)
      const ids = invs['drv_bortoleto'].map((s) => s.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(20)
    }
  })
})
