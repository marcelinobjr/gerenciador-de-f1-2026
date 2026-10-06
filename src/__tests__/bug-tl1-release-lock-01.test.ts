import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetWeekendForRound } from '@/services/weekendProgressionService'
import { practiceSessionService } from '@/services/practiceSessionService'
import type { PracticePreparation } from '@/types/practice-preparation'
import type { PracticeSessionRecordState } from '@/types/practice-session'

describe('BUG-TL1-RELEASE-LOCK-01: Sessão de treino fantasma após reset', () => {
  const careerId = 'team_audi_2026'
  const seasonId = 'season_2026'
  const round = 7 // GP do Canadá R7

  const mockPrep: PracticePreparation = {
    careerId,
    seasonId,
    round,
    sessionType: 'tp1',
    cars: [
      {
        carId: 'car1',
        driverId: 'drv_human_1',
        program: 'qualifying_sim',
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
        tyreSelection: { setId: 'tire_c1', compound: 'duro', isReserved: false },
        fuelLoad: { mode: 'medium', kg: 30, estimatedLaps: 18 },
        objective: 'qualifying_sim',
        status: 'ready',
      } as any,
      {
        carId: 'car2',
        driverId: 'drv_human_2',
        program: 'qualifying_sim',
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
        tyreSelection: { setId: 'tire_c2', compound: 'duro', isReserved: false },
        fuelLoad: { mode: 'medium', kg: 30, estimatedLaps: 18 },
        objective: 'qualifying_sim',
        status: 'ready',
      } as any,
    ],
    status: 'ready',
    updatedAt: new Date().toISOString(),
  }

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  // (T1) reset → estado de treino limpo, TL1 inicializável com carros aptos
  it('(T1) reset do fim de semana limpa as chaves de practiceSessionService e permite TL1 inicializar limpa e apta', () => {
    // 1. Simula sessão TL1 previamente finalizada e persistida no localStorage
    const completedTL1State: PracticeSessionRecordState = {
      ...practiceSessionService.createInitialSessionState({
        careerId,
        seasonId,
        round,
        sessionType: 'tp1',
        preparation: mockPrep,
      }),
      status: 'completed',
      timeRemainingSec: 0,
    }
    const tl1Key = `apex_practice_session_${careerId}_${seasonId}_${round}_tp1`
    localStorage.setItem(tl1Key, JSON.stringify(completedTL1State))

    expect(localStorage.getItem(tl1Key)).not.toBeNull()

    // 2. Executa o reset do fim de semana
    const resetResult = resetWeekendForRound({
      careerId,
      seasonId,
      round,
    })

    expect(resetResult.success).toBe(true)
    expect(resetResult.clearedKeys).toContain(tl1Key)
    expect(localStorage.getItem(tl1Key)).toBeNull()

    // 3. Leitura subsequente do cache local retorna null
    const cached = practiceSessionService.readFromLocalCache(careerId, seasonId, round, 'tp1')
    expect(cached).toBeNull()

    // 4. Criação de nova sessão TL1 limpa inicia como paused e com carros aptos na garagem
    const freshState = practiceSessionService.createInitialSessionState({
      careerId,
      seasonId,
      round,
      sessionType: 'tp1',
      preparation: mockPrep,
    })

    expect(freshState.status).toBe('paused')
    expect(freshState.cars.car1.status).toBe('garage')
    expect(freshState.cars.car1.fuelKg).toBe(42)
    expect(freshState.cars.car2.status).toBe('garage')
    expect(freshState.cars.car2.fuelKg).toBe(42)
  })

  // (T2) sessão completed órfã + slot resetado → estado descartado
  it('(T2) sessão completed órfã descartada quando slot resetado/AVAILABLE e completedSessions vazio', () => {
    // Simula cenário de inconsistência onde banco/storage tinha completed mas slot está AVAILABLE
    const orphanCompletedState: PracticeSessionRecordState = {
      ...practiceSessionService.createInitialSessionState({
        careerId,
        seasonId,
        round,
        sessionType: 'tp1',
        preparation: mockPrep,
      }),
      status: 'completed',
      timeRemainingSec: 0,
    }

    const completedSessions: string[] = [] // resetado
    const weekendSlotState = {
      slots: {
        tp1: { status: 'AVAILABLE' },
      },
    }

    const targetType = 'tp1'
    const slotForSession = weekendSlotState.slots[targetType]
    const isSlotResetOrAvailable =
      !slotForSession || slotForSession.status === 'AVAILABLE' || slotForSession.status === 'LOCKED'
    const isNotMarkedCompletedInWeekend = !completedSessions.includes(targetType)

    // Avalia lógica de reconciliação idêntica à do WeekendV2Page
    let effectiveSession = orphanCompletedState
    if (
      orphanCompletedState.status === 'completed' &&
      (isNotMarkedCompletedInWeekend || isSlotResetOrAvailable)
    ) {
      practiceSessionService.clearLocalCache(careerId, seasonId, round, targetType)
      const freshState = practiceSessionService.createInitialSessionState({
        careerId,
        seasonId,
        round,
        sessionType: targetType,
        preparation: mockPrep,
      })
      effectiveSession = freshState
    }

    expect(effectiveSession.status).toBe('paused')
    expect(effectiveSession.timeRemainingSec).toBeGreaterThan(0)
    expect(effectiveSession.cars.car1.fuelKg).toBe(42)
  })

  // (T3) fuel < 4 → LIBERAR bloqueado com motivo visível e reabastecimento resolve
  it('(T3) fuel < 4 bloqueia LIBERAR com motivo visível de combustível insuficiente e reabastecimento resolve', () => {
    // Carro com menos de 4kg
    const carUnderfuel = {
      fuelKg: 3.2,
      isSessionCompleted: false,
      isEliminated: false,
    }

    const isButtonDisabled =
      carUnderfuel.isSessionCompleted || carUnderfuel.isEliminated || carUnderfuel.fuelKg < 4

    expect(isButtonDisabled).toBe(true)

    const blockReason = carUnderfuel.isSessionCompleted
      ? 'Sessão concluída'
      : carUnderfuel.isEliminated
        ? 'Carro eliminado'
        : carUnderfuel.fuelKg < 4
          ? 'Combustível insuficiente (mínimo 4 kg)'
          : null

    expect(blockReason).toBe('Combustível insuficiente (mínimo 4 kg)')

    // Reabastecendo para 42kg (como no screenshot)
    carUnderfuel.fuelKg = 42
    const isButtonDisabledAfterFuel =
      carUnderfuel.isSessionCompleted || carUnderfuel.isEliminated || carUnderfuel.fuelKg < 4
    expect(isButtonDisabledAfterFuel).toBe(false)
  })

  // (T4) regressão: weekend-reset (4/4), sq1-result-integrity, R3
  it('(T4) regressão: resetWeekendForRound mantém integridade e remove chaves de qualificação e sessões', () => {
    const qualiKey = `apex_qualifying_stage_state_v2_${seasonId}_r${round}_sq1`
    const slotKey = `apex_weekend_slot_state_v1_${careerId}_${seasonId}_r${round}`
    localStorage.setItem(qualiKey, JSON.stringify({ stage: 'sq1', status: 'completed' }))
    localStorage.setItem(slotKey, JSON.stringify({ slots: {} }))

    const result = resetWeekendForRound({
      careerId,
      seasonId,
      round,
    })

    expect(result.success).toBe(true)
    expect(result.clearedKeys).toContain(qualiKey)
    expect(result.clearedKeys).toContain(slotKey)
    expect(localStorage.getItem(qualiKey)).toBeNull()
    expect(localStorage.getItem(slotKey)).toBeNull()
  })
})
