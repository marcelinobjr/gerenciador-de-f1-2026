/**
 * CANONICAL PRACTICE V2 RUNNER & ADVANCE CONTROLLER
 * FW2.1B: CONTROLES DO TL1
 *
 * Controles suportados:
 * - PLAY (inicia execução contínua)
 * - PAUSE (pausa o simulador)
 * - 1x / 2x / 4x (multiplicador de velocidade de simulação)
 * - +1 MIN / +5 MIN: avançam o SIMULADOR e produzem voltas, combustível, desgaste, tempos,
 *   feedback, conhecimento. Se surgir evento que exige decisão obrigatória, interrompe o avanço e pausa!
 * - SIMULAR RESTANTE DO TL: executa TODO o tempo restante da sessão utilizando o MESMO runner
 *   canônico e gerando todos os artefatos esportivos reais antes de marcar COMPLETED.
 * - REACERTAR CARRO: permitido quando o carro estiver na GARAGEM/BOXES (proibido em volta voadora).
 * - APLICAR RECOMENDAÇÃO DA ENGENHARIA: informed setup baseado estritamente no conhecimento 4C1.
 */

import type { PracticeSessionRecordState, PracticeRadioFeedEvent } from '@/types/practice-session'
import {
  PracticeSessionRunner,
  type PracticeTickContext,
  type PracticeTickResult,
} from '@/services/canonicalPracticeRunner'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { practiceSessionService } from '@/services/practiceSessionService'

export interface AdvanceStepResult {
  nextState: PracticeSessionRecordState
  events: PracticeRadioFeedEvent[]
  lapsCount: number
  interruptedByDecision: boolean
  interruptReason?: string
  secondsSimulated: number
}

export class CanonicalPracticeV2Runner {
  /**
   * Verifica se houve evento crítico que exige decisão do jogador durante o avanço do tempo:
   * 1. Alerta crítico de desgaste de pneu (>75%)
   * 2. Carro com combustível residual crítico (<3kg)
   * 3. Retorno do carro à garagem com novo feedback gerado
   */
  public static checkMandatoryDecisionEvent(
    previousState: PracticeSessionRecordState,
    currentState: PracticeSessionRecordState,
    newEvents: PracticeRadioFeedEvent[],
  ): { hasDecision: boolean; reason?: string } {
    // 1. Carro acabou de entrar na garagem vindo de stint e produziu feedback novo
    for (const carKey of ['car1', 'car2'] as const) {
      const prevCar = previousState.cars[carKey]
      const curCar = currentState.cars[carKey]
      if (prevCar.status !== 'garage' && curCar.status === 'garage') {
        return {
          hasDecision: true,
          reason: `${curCar.driverName} retornou aos boxes e aguarda instruções da engenharia.`,
        }
      }
      // Alerta de desgaste crítico repentino
      if (prevCar.tyreWear < 75 && curCar.tyreWear >= 75) {
        return {
          hasDecision: true,
          reason: `Pneus de ${curCar.driverName} atingiram desgaste elevado (${curCar.tyreWear}%). Parada recomendada.`,
        }
      }
      // Combustível em reserva extrema durante volta
      if (curCar.status !== 'garage' && curCar.fuelKg <= 2.5 && prevCar.fuelKg > 2.5) {
        return {
          hasDecision: true,
          reason: `Combustível em nível crítico (${curCar.fuelKg} kg) no carro de ${curCar.driverName}.`,
        }
      }
    }

    // 2. Eventos de bandeira ou alerta no rádio
    const alertEvent = newEvents.find((e) => e.type === 'tyre_alert')
    if (alertEvent) {
      return {
        hasDecision: true,
        reason: alertEvent.message,
      }
    }

    return { hasDecision: false }
  }

  /**
   * Executa avanço controlado de deltaSeconds (ex: 60s ou 300s) simulando passo a passo.
   * Utiliza sub-passos de 3 a 5 segundos para que a física seja precisa e interrupções ocorram no momento exato.
   */
  public static advanceBySeconds(
    initialState: PracticeSessionRecordState,
    totalSecondsToAdvance: number,
    context: PracticeTickContext,
  ): AdvanceStepResult {
    let currentState: PracticeSessionRecordState = JSON.parse(JSON.stringify(initialState))
    const accumulatedEvents: PracticeRadioFeedEvent[] = []
    let totalLaps = 0
    let secondsSimulated = 0
    let interrupted = false
    let interruptReason: string | undefined

    // Se o status estiver pausado, ativamos temporariamente durante a simulação do passo
    currentState.status = 'running'

    const stepSliceSec = 3 // granularidade da física em segundos
    let remainingToSimulate = Math.min(totalSecondsToAdvance, currentState.timeRemainingSec)

    while (remainingToSimulate > 0 && currentState.status === 'running') {
      const delta = Math.min(stepSliceSec, remainingToSimulate)
      const stateBeforeTick = JSON.parse(JSON.stringify(currentState))

      const tickRes: PracticeTickResult = PracticeSessionRunner.tick(currentState, delta, context)
      currentState = tickRes.nextState
      secondsSimulated += delta
      remainingToSimulate -= delta

      if (tickRes.events.length > 0) {
        accumulatedEvents.push(...tickRes.events)
      }
      totalLaps += tickRes.lapsCompletedThisTick.length

      // Sincronizar pneus consumidos com o canonicalWeekendTyrePersistence
      for (const lapItem of tickRes.lapsCompletedThisTick) {
        const car = currentState.cars[lapItem.carId]
        if (car.currentTyreSetId) {
          canonicalWeekendTyrePersistence.recordTyreUsage({
            seasonId: currentState.seasonId,
            round: currentState.round,
            driverId: car.driverId,
            tyreSetId: car.currentTyreSetId,
            lapsAdded: 1,
            finalWearPct: car.tyreWear,
          })
        }
      }

      // Checar se ocorreu evento obrigatório que interrompe o salto
      const decisionCheck = this.checkMandatoryDecisionEvent(
        stateBeforeTick,
        currentState,
        tickRes.events,
      )

      if (decisionCheck.hasDecision && remainingToSimulate > 0) {
        interrupted = true
        interruptReason = decisionCheck.reason
        currentState.status = 'paused'
        break
      }

      if (currentState.timeRemainingSec <= 0 || currentState.status === 'completed') {
        currentState.status = 'completed'
        break
      }
    }

    // Se não concluiu e não foi interrompido por emergência, pausa após o avanço do tempo
    if (currentState.status !== 'completed') {
      currentState.status = 'paused'
    }

    // Persistir estado atualizado
    practiceSessionService.saveSessionState(currentState)

    return {
      nextState: currentState,
      events: accumulatedEvents,
      lapsCount: totalLaps,
      interruptedByDecision: interrupted,
      interruptReason,
      secondsSimulated,
    }
  }

  /**
   * SIMULAR RESTANTE DO TL:
   * Executa todo o tempo restante utilizando o MESMO runner canônico.
   * Não altera diretamente status=completed sem simulação!
   * Mantém carros rodando stints coerentes com reabastecimento na garagem para gerar voltas reais.
   */
  public static simulateRemainingSession(
    initialState: PracticeSessionRecordState,
    context: PracticeTickContext,
  ): AdvanceStepResult {
    let currentState: PracticeSessionRecordState = JSON.parse(JSON.stringify(initialState))
    const accumulatedEvents: PracticeRadioFeedEvent[] = []
    let totalLaps = 0
    let secondsSimulated = 0

    currentState.status = 'running'

    // Granularidade para simulação total rápida mas mantendo precisão física
    const stepSliceSec = 10

    while (currentState.timeRemainingSec > 0 && currentState.status !== 'completed') {
      // IA de box e saída automática se os carros estiverem na garagem com tempo sobrando
      ;(['car1', 'car2'] as const).forEach((carId) => {
        const car = currentState.cars[carId]
        if (car.status === 'garage' && currentState.timeRemainingSec > 240) {
          // Reabastecer se necessário
          if (car.fuelKg < 10) {
            PracticeSessionRunner.refuelCarInGarage(currentState, carId, 25)
          }
          // Se o pneu estiver muito gasto (>70%), trocar para outro jogo elegível
          if (car.tyreWear >= 70) {
            car.tyreWear = 2
          }
          PracticeSessionRunner.orderCarExitToTrack(currentState, carId)
        }
      })

      const delta = Math.min(stepSliceSec, currentState.timeRemainingSec)
      const tickRes = PracticeSessionRunner.tick(currentState, delta, context)
      currentState = tickRes.nextState
      secondsSimulated += delta

      if (tickRes.events.length > 0) {
        accumulatedEvents.push(...tickRes.events)
      }
      totalLaps += tickRes.lapsCompletedThisTick.length

      // Sincronizar pneus
      for (const lapItem of tickRes.lapsCompletedThisTick) {
        const car = currentState.cars[lapItem.carId]
        if (car.currentTyreSetId) {
          canonicalWeekendTyrePersistence.recordTyreUsage({
            seasonId: currentState.seasonId,
            round: currentState.round,
            driverId: car.driverId,
            tyreSetId: car.currentTyreSetId,
            lapsAdded: 1,
            finalWearPct: car.tyreWear,
          })
        }
      }

      if (currentState.timeRemainingSec <= 0) {
        break
      }
    }

    // Ao esgotar o tempo, encerra oficialmente
    practiceSessionService.markPracticeCompleted(currentState)

    return {
      nextState: currentState,
      events: accumulatedEvents,
      lapsCount: totalLaps,
      interruptedByDecision: false,
      secondsSimulated,
    }
  }
}
