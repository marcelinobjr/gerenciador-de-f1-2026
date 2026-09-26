/**
 * canonicalQualifyingRunner.ts
 *
 * Motor de Simulação Canônico de Qualificação V2 (Q1, Q2, Q3)
 * APEX GP MANAGER — F1 2026.
 *
 * Princípios do usuário:
 * "A classificação não escolhe quem é mais rápido por uma fórmula instantânea.
 * Ela coloca os carros na pista, consome tempo e pneus, registra voltas, elimina pilotos e constrói o grid da corrida."
 *
 * Cada fase (Q1, Q2, Q3):
 * 1. PREPARAÇÃO -> INÍCIO -> VOLTAS -> RETORNO AOS BOXES -> NOVA TENTATIVA -> ENCERRAMENTO -> CLASSIFICAÇÃO -> ELIMINAÇÃO.
 * 2. Tempo de volta derivado do modelo canônico existente (calculateCombinedPace / carro / piloto / pneus / combustível / Track Fit / clima).
 * 3. Sem sorteio, sem segundo motor de pace, sem fórmula simplória.
 * 4. IA dos 22 rivais participa ativamente: seleções de pneus, saídas dos boxes, voltas rápidas e evolução de tempo.
 * 5. Consome o estoque canônico de pneus (20 jogos por piloto).
 * 6. Desempate determinístico: primeiro a registrar a marca fica à frente.
 */

import type {
  QualifyingStageId,
  QualifyingStageState,
  QualifyingCarState,
  QualifyingTimeEntry,
  QualifyingLapRecord,
  QualifyingRadioFeedEvent,
  QualifyingStageResult,
} from '@/types/canonical-qualifying-types'
import { CANONICAL_QUALIFYING_RULES } from '@/types/canonical-qualifying-types'
import { FUEL_CONSUMPTION_KG_PER_LAP } from '@/types/practice-preparation'
import { TIRE_SPECS, type TrackWeatherState } from '@/lib/f1-tire-system'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'
import { calculateCombinedPace } from '@/lib/f1-pace-model'
import { formatLapTime, formatGap } from '@/lib/f1-race-sim-engine'
import { canonicalPaceIntegrationService } from '@/services/canonicalPaceIntegrationService'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { carTechnicalService } from '@/services/carTechnicalService'

export interface QualifyingDriverContext {
  id: string
  name: string
  speed: number
  consistency: number
  defense: number
  morale?: number
  physical_condition?: number
  teamId?: string
  teamName?: string
  teamColor?: string
  carNumber?: number
}

export interface QualifyingTickContext {
  seasonId: string
  round: number
  gpName: string
  circuitName: string
  lengthKm: number
  tireAbrasiveness: number
  weather: TrackWeatherState
  teamChassisRating: number
  teamEngineSupplier: string
  teamName: string
  teamColor: string
  teamId?: string
  teamTechnicalAttributes?: any
  drivers: QualifyingDriverContext[]
  rivalDrivers: QualifyingDriverContext[]
}

export interface QualifyingTickResult {
  nextState: QualifyingStageState
  events: QualifyingRadioFeedEvent[]
  lapsCompletedThisTick: Array<{
    carId?: 'car1' | 'car2'
    driverId: string
    lap: QualifyingLapRecord
  }>
}

export interface QualifyingAdvanceStepResult {
  nextState: QualifyingStageState
  events: QualifyingRadioFeedEvent[]
  lapsCount: number
  interruptedByDecision: boolean
  interruptReason?: string
  secondsSimulated: number
}

export class CanonicalQualifyingRunner {
  /**
   * Inicializa ou carrega o estado de uma fase de qualificação (Q1, Q2 ou Q3).
   */
  public static initializeStage(params: {
    stageId: QualifyingStageId
    seasonId: string
    round: number
    playerCar1: {
      driverId: string
      driverName: string
      driverNumber?: number
      tyreSetId: string
      compound: any
      wear: number
      fuelKg?: number
      setup: any
    }
    playerCar2: {
      driverId: string
      driverName: string
      driverNumber?: number
      tyreSetId: string
      compound: any
      wear: number
      fuelKg?: number
      setup: any
    }
    eligibleParticipants: QualifyingDriverContext[]
    persistState?: boolean
  }): QualifyingStageState {
    const { stageId, seasonId, round, playerCar1, playerCar2, eligibleParticipants } = params

    // Tenta carregar estado persistido para reload idempotente
    const saved = canonicalQualifyingPersistenceService.readStageState(seasonId, round, stageId)
    if (saved) {
      return saved
    }

    const rules = CANONICAL_QUALIFYING_RULES[stageId]
    const nowIso = new Date().toISOString()

    const isCar1Eligible =
      stageId === 'q1' ? true : eligibleParticipants.some((p) => p.id === playerCar1.driverId)
    const isCar2Eligible =
      stageId === 'q1' ? true : eligibleParticipants.some((p) => p.id === playerCar2.driverId)

    const car1EliminationStage = !isCar1Eligible ? (stageId === 'q2' ? 'q1' : 'q2') : undefined
    const car2EliminationStage = !isCar2Eligible ? (stageId === 'q2' ? 'q1' : 'q2') : undefined

    const car1State: QualifyingCarState = {
      carId: 'car1',
      driverId: playerCar1.driverId,
      driverName: playerCar1.driverName,
      driverNumber: playerCar1.driverNumber || 1,
      status: isCar1Eligible ? 'garage' : 'eliminated',
      pitRequested: false,
      setup: { ...playerCar1.setup },
      currentTyreSetId: playerCar1.tyreSetId,
      currentCompound: playerCar1.compound || 'macio',
      tyreWear: playerCar1.wear || 0,
      fuelKg: typeof playerCar1.fuelKg === 'number' ? playerCar1.fuelKg : 15, // Carga padrão ou escolha do jogador
      outLapsDone: 0,
      flyingLapsDone: 0,
      inLapsDone: 0,
      totalLaps: 0,
      currentLapProgressPct: 0,
      isEliminated: !isCar1Eligible,
      eliminatedInStage: car1EliminationStage,
    }

    const car2State: QualifyingCarState = {
      carId: 'car2',
      driverId: playerCar2.driverId,
      driverName: playerCar2.driverName,
      driverNumber: playerCar2.driverNumber || 2,
      status: isCar2Eligible ? 'garage' : 'eliminated',
      pitRequested: false,
      setup: { ...playerCar2.setup },
      currentTyreSetId: playerCar2.tyreSetId,
      currentCompound: playerCar2.compound || 'macio',
      tyreWear: playerCar2.wear || 0,
      fuelKg: typeof playerCar2.fuelKg === 'number' ? playerCar2.fuelKg : 15,
      outLapsDone: 0,
      flyingLapsDone: 0,
      inLapsDone: 0,
      totalLaps: 0,
      currentLapProgressPct: 0,
      isEliminated: !isCar2Eligible,
      eliminatedInStage: car2EliminationStage,
    }

    // Leaderboard inicial com todos os participantes elegíveis desta fase
    const leaderboard: QualifyingTimeEntry[] = eligibleParticipants.map((p, idx) => {
      const isPlayer1 = p.id === playerCar1.driverId
      const isPlayer2 = p.id === playerCar2.driverId
      const isPlayer = isPlayer1 || isPlayer2
      const carId = isPlayer1 ? ('car1' as const) : isPlayer2 ? ('car2' as const) : undefined

      return {
        position: idx + 1,
        driverId: p.id,
        driverName: p.name,
        teamId: p.teamId || 'team',
        teamName: p.teamName || 'Equipe',
        teamColor: p.teamColor || '#94A3B8',
        compound: 'macio',
        laps: 0,
        bestLapSec: 0,
        bestLapTime: '--:--.---',
        gap: '-',
        isPlayer,
        carId,
        status: 'garage',
        isEliminated: false,
        carNumber: p.carNumber || idx + 1,
      }
    })

    const initialStageState: QualifyingStageState = {
      stageId,
      status: 'not_started',
      sessionDurationSec: rules.durationSec,
      elapsedTimeSec: 0,
      timeRemainingSec: rules.durationSec,
      simSpeed: 1,
      cars: {
        car1: car1State,
        car2: car2State,
      },
      leaderboard,
      lapHistory: {},
      radioFeed: [
        {
          id: `ev_init_${stageId}_${Date.now()}`,
          second: 0,
          type: 'info',
          message: `Sessão ${stageId.toUpperCase()} aberta. Regulamento: ${rules.participantsCount} participantes, ${rules.advancingCount} avançam.`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ],
      parcFermeActive: canonicalQualifyingPersistenceService.isParcFermeActive(seasonId, round),
      revision: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    if (params.persistState ?? true) {
      canonicalQualifyingPersistenceService.saveStageState(seasonId, round, initialStageState)
    }
    return initialStageState
  }

  /**
   * Ordena saída do carro para a pista na qualificação.
   */
  public static orderCarExitToTrack(
    state: QualifyingStageState,
    carId: 'car1' | 'car2',
  ): { success: boolean; error?: string; event?: QualifyingRadioFeedEvent } {
    if (state.status === 'completed') {
      return { success: false, error: 'Sessão encerrada. Saída para a pista não permitida.' }
    }
    if (state.timeRemainingSec <= 0) {
      return { success: false, error: 'Tempo esgotado na sessão de classificação.' }
    }

    const car = state.cars[carId]
    if (car.isEliminated || car.status === 'eliminated') {
      return {
        success: false,
        error: `O piloto ${car.driverName} foi eliminado na fase anterior e não tem permissão esportiva para ir à pista no ${state.stageId.toUpperCase()}.`,
      }
    }
    if (car.status !== 'garage') {
      return { success: false, error: 'O carro já está na pista ou em volta de transição.' }
    }
    const fuelValidation = this.validateQualifyingFuel(car.fuelKg)
    if (!fuelValidation.valid) {
      return {
        success: false,
        error:
          fuelValidation.warning ||
          'COMBUSTÍVEL INSUFICIENTE — Quantidade insuficiente para completar out lap + volta(s) rápida(s) + in lap.',
      }
    }

    const stintId = `stint_q_${state.stageId}_${carId}_${Date.now()}`
    car.status = 'out_lap'
    car.pitRequested = false
    car.currentLapProgressPct = 0
    car.currentStintId = stintId

    const lbEntry = state.leaderboard.find((e) => e.driverId === car.driverId)
    if (lbEntry) {
      lbEntry.status = 'out_lap'
    }

    const event: QualifyingRadioFeedEvent = {
      id: `ev_out_${carId}_${Date.now()}`,
      second: state.elapsedTimeSec,
      type: 'out',
      message: `${car.driverName} (${carId === 'car1' ? 'Carro 1' : 'Carro 2'}) saiu dos boxes em volta de saída.`,
      driverName: car.driverName,
      carId,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }

    state.radioFeed = [event, ...state.radioFeed].slice(0, 50)
    return { success: true, event }
  }

  /**
   * Solicita retorno aos boxes.
   */
  public static requestCarBox(
    state: QualifyingStageState,
    carId: 'car1' | 'car2',
  ): { success: boolean; error?: string; event?: QualifyingRadioFeedEvent } {
    const car = state.cars[carId]
    if (car.status === 'garage') {
      return { success: false, error: 'O carro já está na garagem.' }
    }

    car.pitRequested = true

    const event: QualifyingRadioFeedEvent = {
      id: `ev_boxreq_${carId}_${Date.now()}`,
      second: state.elapsedTimeSec,
      type: 'box',
      message: `Box solicitado para ${car.driverName}. Carro retornará na próxima oportunidade.`,
      driverName: car.driverName,
      carId,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }

    state.radioFeed = [event, ...state.radioFeed].slice(0, 50)
    return { success: true, event }
  }

  /**
   * Reabastecimento na garagem.
   */
  public static refuelCarInGarage(
    state: QualifyingStageState,
    carId: 'car1' | 'car2',
    kg: number,
  ): boolean {
    const car = state.cars[carId]
    if (car.status !== 'garage') return false
    car.fuelKg = Math.max(1, Math.min(110, kg))
    return true
  }

  /**
   * Valida se a quantidade de combustível é suficiente para a tentativa no qualifying:
   * out lap + volta(s) rápida(s) + in lap + margem de segurança regulamentar.
   */
  public static validateQualifyingFuel(fuelKg: number): {
    valid: boolean
    warning?: string
  } {
    if (fuelKg < 4) {
      return {
        valid: false,
        warning:
          'COMBUSTÍVEL INSUFICIENTE — Quantidade insuficiente para completar out lap + volta(s) rápida(s) + in lap.',
      }
    }
    return { valid: true }
  }

  /**
   * Atualização de setup na garagem durante a qualificação (caso Parc Fermé não proíba).
   */
  public static updateCarGarageSetup(
    state: QualifyingStageState,
    carId: 'car1' | 'car2',
    partialSetup: Partial<QualifyingCarState['setup']>,
    options?: { parcFermeActive?: boolean },
  ): { success: boolean; error?: string } {
    const isParcFerme = options?.parcFermeActive ?? state.parcFermeActive ?? false
    if (isParcFerme) {
      return {
        success: false,
        error:
          'PARC FERMÉ — Este ajuste não pode mais ser alterado após o início do regime de Parc Fermé.',
      }
    }
    const car = state.cars[carId]
    if (car.status !== 'garage') {
      return {
        success: false,
        error: 'O carro precisa estar na garagem para ajustes mecânicos.',
      }
    }
    car.setup = {
      ...car.setup,
      ...partialSetup,
    }
    return { success: true }
  }

  /**
   * Instalação de novo jogo de pneus na garagem (consumindo o mesmo inventário herdado).
   */
  public static fitTyreSetInGarage(
    state: QualifyingStageState,
    carId: 'car1' | 'car2',
    tyreSet: { id: string; compound: any; wear: number },
  ): boolean {
    const car = state.cars[carId]
    if (car.status !== 'garage') return false
    car.currentTyreSetId = tyreSet.id
    car.currentCompound = tyreSet.compound
    car.tyreWear = tyreSet.wear || 0
    return true
  }

  /**
   * Executa um tick de simulação avançando deltaSimSec.
   */
  public static tick(
    currentState: QualifyingStageState,
    deltaSimSec: number,
    context: QualifyingTickContext,
  ): QualifyingTickResult {
    const nextState: QualifyingStageState = JSON.parse(JSON.stringify(currentState))
    const events: QualifyingRadioFeedEvent[] = []
    const lapsCompletedThisTick: Array<{
      carId?: 'car1' | 'car2'
      driverId: string
      lap: QualifyingLapRecord
    }> = []

    if (nextState.status !== 'running') {
      return { nextState, events, lapsCompletedThisTick }
    }

    if (nextState.timeRemainingSec <= 0) {
      this.finalizeStage(nextState, context)
      return { nextState, events, lapsCompletedThisTick }
    }

    const appliedDelta = Math.min(deltaSimSec, nextState.timeRemainingSec)
    nextState.elapsedTimeSec += appliedDelta
    nextState.timeRemainingSec = Math.max(0, nextState.timeRemainingSec - appliedDelta)

    const circuitBaseSec = Math.max(65, context.lengthKm * 15.0)

    // 1. Processar os carros do jogador de forma independente
    ;(['car1', 'car2'] as const).forEach((carId) => {
      const car = nextState.cars[carId]
      if (car.status === 'garage' || car.isEliminated) {
        return
      }

      const driver = context.drivers.find((d) => d.id === car.driverId)
      const lapTimeSec = this.calculateQualifyingLapPace({
        car,
        driver,
        context,
        circuitBaseSec,
      })

      // Progresso: out_lap = 70% do tempo de volta, flying_lap = 100%, in_lap = 70%
      const phaseDurationSec = car.status === 'flying_lap' ? lapTimeSec : lapTimeSec * 0.7
      const progressIncrementPct = (appliedDelta / phaseDurationSec) * 100
      car.currentLapProgressPct = (car.currentLapProgressPct || 0) + progressIncrementPct

      if (car.currentLapProgressPct >= 100) {
        car.currentLapProgressPct = 0

        if (car.status === 'out_lap') {
          car.status = 'flying_lap'
          car.outLapsDone += 1
          const ev: QualifyingRadioFeedEvent = {
            id: `ev_fast_${carId}_${Date.now()}_${nextState.elapsedTimeSec}`,
            second: nextState.elapsedTimeSec,
            type: 'fast_lap',
            message: `${car.driverName} abriu volta rápida no ${nextState.stageId.toUpperCase()}!`,
            driverName: car.driverName,
            carId,
            timestamp: new Date().toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          }
          events.push(ev)
          nextState.radioFeed.unshift(ev)

          const lb = nextState.leaderboard.find((e) => e.driverId === car.driverId)
          if (lb) lb.status = 'flying_lap'
        } else if (car.status === 'flying_lap') {
          // Volta rápida completada!
          car.flyingLapsDone += 1
          car.totalLaps += 1

          // Consumo canônico de combustível e desgaste de pneus
          const fuelBurn = Number((FUEL_CONSUMPTION_KG_PER_LAP * 1.05).toFixed(2))
          car.fuelKg = Math.max(0, Number((car.fuelKg - fuelBurn).toFixed(2)))

          const tireSpec = TIRE_SPECS[car.currentCompound] || TIRE_SPECS.macio
          const baseWearRate = tireSpec.wearFactor * (context.tireAbrasiveness / 5)
          const wearInc = Math.max(3, Math.round(baseWearRate * 1.8))
          car.tyreWear = Math.min(100, (car.tyreWear || 0) + wearInc)

          const lapFormatted = formatLapTime(lapTimeSec)
          car.lastLapSec = lapTimeSec
          car.lastLapTime = lapFormatted

          const isPersonalBest = !car.bestLapSec || lapTimeSec < car.bestLapSec
          if (isPersonalBest) {
            car.bestLapSec = lapTimeSec
            car.bestLapTime = lapFormatted
            car.bestLapNumber = car.totalLaps
            car.bestLapCompound = car.currentCompound
            car.bestLapTyreSetId = car.currentTyreSetId
          }

          const currentBestInSession = Math.min(
            ...nextState.leaderboard.filter((e) => e.bestLapSec > 0).map((e) => e.bestLapSec),
            Infinity,
          )
          const isSessionBest = lapTimeSec < currentBestInSession

          const lapRecord: QualifyingLapRecord = {
            lapNumber: car.totalLaps,
            lapTimeSec,
            lapTimeFormatted: lapFormatted,
            compound: car.currentCompound,
            tyreSetId: car.currentTyreSetId,
            tyreWear: car.tyreWear,
            fuelRemainingKg: car.fuelKg,
            isValid: true,
            isPersonalBest,
            isSessionBest,
            stintId: car.currentStintId || '',
            timestamp: new Date().toISOString(),
            recordedAtSessionSec: nextState.elapsedTimeSec,
          }

          if (!nextState.lapHistory[car.driverId]) {
            nextState.lapHistory[car.driverId] = []
          }
          nextState.lapHistory[car.driverId].push(lapRecord)

          lapsCompletedThisTick.push({
            carId,
            driverId: car.driverId,
            lap: lapRecord,
          })

          this.updateLeaderboardEntry(nextState.leaderboard, {
            driverId: car.driverId,
            driverName: car.driverName,
            teamId: 'player_team',
            teamName: context.teamName,
            teamColor: context.teamColor,
            compound: car.currentCompound,
            tyreSetId: car.currentTyreSetId,
            lapTimeSec,
            lapFormatted,
            isPlayer: true,
            carId,
            recordedAtSec: nextState.elapsedTimeSec,
          })

          // Decidir próximo estado: após volta rápida em qualificação, o carro geralmente retorna para nova tentativa
          if (
            car.pitRequested ||
            car.fuelKg <= 4.0 ||
            nextState.timeRemainingSec <= 0 ||
            car.flyingLapsDone >= 1
          ) {
            car.status = 'in_lap'
            const lb = nextState.leaderboard.find((e) => e.driverId === car.driverId)
            if (lb) lb.status = 'in_lap'

            const evIn: QualifyingRadioFeedEvent = {
              id: `ev_in_${carId}_${Date.now()}_${nextState.elapsedTimeSec}`,
              second: nextState.elapsedTimeSec,
              type: 'box',
              message: `${car.driverName} registrou ${lapFormatted} e está retornando aos boxes.`,
              driverName: car.driverName,
              carId,
              timestamp: new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            }
            events.push(evIn)
            nextState.radioFeed.unshift(evIn)
          }
        } else if (car.status === 'in_lap') {
          car.status = 'garage'
          car.pitRequested = false
          car.inLapsDone += 1
          const lb = nextState.leaderboard.find((e) => e.driverId === car.driverId)
          if (lb) lb.status = 'garage'

          const evGarage: QualifyingRadioFeedEvent = {
            id: `ev_gar_${carId}_${Date.now()}_${nextState.elapsedTimeSec}`,
            second: nextState.elapsedTimeSec,
            type: 'info',
            message: `${car.driverName} na garagem. Pronto para reabastecimento ou novo jogo de pneus.`,
            driverName: car.driverName,
            carId,
            timestamp: new Date().toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          }
          events.push(evGarage)
          nextState.radioFeed.unshift(evGarage)
        }
      }
    })

    // 2. IA dos rivais: participação autêntica de todos os pilotos elegíveis
    this.advanceAIRivals(
      nextState,
      appliedDelta,
      context,
      circuitBaseSec,
      lapsCompletedThisTick,
      events,
    )

    // 3. Checagem de encerramento pelo cronômetro
    if (nextState.timeRemainingSec <= 0) {
      this.finalizeStage(nextState, context)
      const evEnd: QualifyingRadioFeedEvent = {
        id: `ev_end_${Date.now()}`,
        second: nextState.elapsedTimeSec,
        type: 'finish',
        message: `Bandeira quadriculada! Fase ${nextState.stageId.toUpperCase()} encerrada.`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      }
      events.push(evEnd)
      nextState.radioFeed.unshift(evEnd)
    }

    nextState.radioFeed = nextState.radioFeed.slice(0, 50)
    return { nextState, events, lapsCompletedThisTick }
  }

  /**
   * Cálculo de ritmo de volta para qualificação usando o modelo canônico.
   */
  private static calculateQualifyingLapPace(params: {
    car: QualifyingCarState
    driver?: QualifyingDriverContext
    context: QualifyingTickContext
    circuitBaseSec: number
  }): number {
    const { car, driver, context, circuitBaseSec } = params

    const circuitProfile = resolveCircuitProfile({ round: context.round })

    // BALANCE-EQUATION-02C: Integração canônica da Força Estrutural no Qualifying
    const playerTeamKey = context.teamId || driver?.teamId || 'custom_team'
    const integratedPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: playerTeamKey,
      driverId: car.driverId,
      circuitProfile,
      carTechnicalAttributes: context.teamTechnicalAttributes,
      driverAttributes: {
        speed: driver?.speed || 80,
        consistency: driver?.consistency || 80,
        rain: driver?.speed || 80,
        morale: driver?.morale || 85,
        physicalCondition: driver?.physical_condition || 90,
      },
      tyreCompound: car.currentCompound,
      tyreWearPct: car.tyreWear,
      fuelKg: car.fuelKg,
      weather: context.weather,
      noise: (Math.random() - 0.5) * 0.15,
    })

    let lapSec = integratedPace.lapTimeSec || circuitBaseSec

    // Bônus/penalidade de combustível leve de quali (~10-15kg)
    const fuelDeltaSec = (car.fuelKg - 12) * 0.035
    lapSec += fuelDeltaSec

    return Number(Math.max(54, lapSec).toFixed(3))
  }

  /**
   * IA dos rivais: realizam saídas e marcam voltas coerentes na janela de tempo.
   */
  private static advanceAIRivals(
    state: QualifyingStageState,
    deltaSimSec: number,
    context: QualifyingTickContext,
    circuitBaseSec: number,
    lapsCompleted: Array<{ driverId: string; lap: QualifyingLapRecord }>,
    events: QualifyingRadioFeedEvent[],
  ): void {
    const aiEntries = state.leaderboard.filter((e) => !e.isPlayer && !e.isEliminated)
    if (aiEntries.length === 0) return

    const circuitProfile = resolveCircuitProfile({ round: context.round })
    const chance = Math.min(0.9, (deltaSimSec / 45) * 0.5)

    aiEntries.forEach((aiEntry) => {
      // Pilotos da IA fazem até 2 ou 3 tentativas por fase
      if (Math.random() < chance && aiEntry.laps < 3) {
        const rivalObj = context.rivalDrivers.find((r) => r.id === aiEntry.driverId)
        const rivalTeamKey = aiEntry.teamId || 'haas'

        // BALANCE-EQUATION-02C: IA rival também consome a Força Estrutural canônica no Qualifying
        const integratedAiPace = canonicalPaceIntegrationService.computeQualifyingPace({
          teamKey: rivalTeamKey,
          driverId: aiEntry.driverId,
          circuitProfile,
          driverAttributes: {
            speed: rivalObj?.speed || 80,
            consistency: rivalObj?.consistency || 80,
            rain: rivalObj?.speed || 80,
            morale: 85,
            physicalCondition: 90,
          },
          tyreCompound: 'macio',
          fuelKg: 12,
          weather: context.weather,
          noise: (Math.random() - 0.5) * 0.25,
        })

        const lapSec = Number((integratedAiPace.lapTimeSec || circuitBaseSec).toFixed(3))
        aiEntry.laps += 1

        const isPb = !aiEntry.bestLapSec || lapSec < aiEntry.bestLapSec
        if (isPb) {
          aiEntry.bestLapSec = lapSec
          aiEntry.bestLapTime = formatLapTime(lapSec)
          aiEntry.bestLapRecordedAtSec = state.elapsedTimeSec
        }

        const lapRecord: QualifyingLapRecord = {
          lapNumber: aiEntry.laps,
          lapTimeSec: lapSec,
          lapTimeFormatted: formatLapTime(lapSec),
          compound: 'macio',
          tyreSetId: `ai_tire_${aiEntry.driverId}`,
          tyreWear: 8,
          fuelRemainingKg: 10,
          isValid: true,
          isPersonalBest: isPb,
          isSessionBest: false,
          stintId: `ai_stint_${aiEntry.driverId}`,
          timestamp: new Date().toISOString(),
          recordedAtSessionSec: state.elapsedTimeSec,
        }

        if (!state.lapHistory[aiEntry.driverId]) {
          state.lapHistory[aiEntry.driverId] = []
        }
        state.lapHistory[aiEntry.driverId].push(lapRecord)
        lapsCompleted.push({ driverId: aiEntry.driverId, lap: lapRecord })
      }
    })

    this.sortLeaderboard(state.leaderboard)
  }

  /**
   * Ordena a tabela de tempos de qualificação pela melhor volta válida.
   * Regra de desempate determinístico: se dois pilotos marcarem o mesmo tempo exato,
   * quem registrou primeiro (bestLapRecordedAtSec menor) fica à frente.
   */
  public static sortLeaderboard(leaderboard: QualifyingTimeEntry[]): void {
    leaderboard.sort((a, b) => {
      if (a.bestLapSec > 0 && b.bestLapSec > 0) {
        if (a.bestLapSec !== b.bestLapSec) {
          return a.bestLapSec - b.bestLapSec
        }
        // Desempate canônico por timestamp da volta
        return (a.bestLapRecordedAtSec || 0) - (b.bestLapRecordedAtSec || 0)
      }
      if (a.bestLapSec > 0) return -1
      if (b.bestLapSec > 0) return 1
      return (b.laps || 0) - (a.laps || 0)
    })

    const leaderBest = leaderboard.find((e) => e.bestLapSec > 0)?.bestLapSec || 0

    leaderboard.forEach((item, idx) => {
      item.position = idx + 1
      if (item.bestLapSec <= 0) {
        item.gap = '-'
      } else if (leaderBest > 0 && item.bestLapSec === leaderBest) {
        item.gap = 'Pole/Líder'
      } else if (leaderBest > 0) {
        item.gap = formatGap(item.bestLapSec - leaderBest)
      } else {
        item.gap = '-'
      }
    })
  }

  /**
   * Atualiza registro de volta no leaderboard.
   */
  private static updateLeaderboardEntry(
    leaderboard: QualifyingTimeEntry[],
    params: {
      driverId: string
      driverName: string
      teamId: string
      teamName: string
      teamColor: string
      compound: any
      tyreSetId?: string
      lapTimeSec: number
      lapFormatted: string
      isPlayer: boolean
      carId?: 'car1' | 'car2'
      recordedAtSec: number
    },
  ): void {
    let entry = leaderboard.find((e) => e.driverId === params.driverId)
    if (!entry) {
      entry = {
        position: 0,
        driverId: params.driverId,
        driverName: params.driverName,
        teamId: params.teamId,
        teamName: params.teamName,
        teamColor: params.teamColor,
        compound: params.compound,
        tyreSetId: params.tyreSetId,
        laps: 0,
        bestLapSec: 0,
        bestLapTime: '--:--.---',
        gap: '-',
        isPlayer: params.isPlayer,
        carId: params.carId,
        status: 'garage',
      }
      leaderboard.push(entry)
    }

    entry.laps += 1
    entry.compound = params.compound
    if (params.tyreSetId) entry.tyreSetId = params.tyreSetId

    if (!entry.bestLapSec || params.lapTimeSec < entry.bestLapSec) {
      entry.bestLapSec = params.lapTimeSec
      entry.bestLapTime = params.lapFormatted
      entry.bestLapRecordedAtSec = params.recordedAtSec
    }

    this.sortLeaderboard(leaderboard)
  }

  /**
   * Finaliza a fase oficialmente, aplicando as regras canônicas de eliminação.
   * Q1: 24 participantes, 18 avançam, 6 eliminados (P19-P24).
   * Q2: 18 participantes, 10 avançam, 8 eliminados (P11-P18).
   * Q3: 10 participantes, define P1-P10.
   */
  public static finalizeStage(
    state: QualifyingStageState,
    context: QualifyingTickContext,
    options?: { persistState?: boolean },
  ): QualifyingStageResult {
    const shouldPersist = options?.persistState ?? true
    state.status = 'completed'
    state.timeRemainingSec = 0

    // Ordenação final garantida
    this.sortLeaderboard(state.leaderboard)

    const rules = CANONICAL_QUALIFYING_RULES[state.stageId]
    const advancingDriverIds: string[] = []
    const eliminatedDriverIds: string[] = []

    state.leaderboard.forEach((entry, idx) => {
      const position = idx + 1
      if (position <= rules.advancingCount) {
        advancingDriverIds.push(entry.driverId)
        entry.isEliminated = false
      } else {
        eliminatedDriverIds.push(entry.driverId)
        entry.isEliminated = true
        entry.eliminatedInStage = state.stageId
      }
    })

    // Atualiza status nos carros do jogador
    ;(['car1', 'car2'] as const).forEach((carId) => {
      const car = state.cars[carId]
      if (eliminatedDriverIds.includes(car.driverId)) {
        car.isEliminated = true
        car.eliminatedInStage = state.stageId
        car.status = 'eliminated'
      } else {
        car.status = 'classified'
      }
    })

    const stageResult: QualifyingStageResult = {
      stageId: state.stageId,
      seasonId: context.seasonId,
      round: context.round,
      completedAt: new Date().toISOString(),
      entries: state.leaderboard.map((e) => ({
        position: e.position,
        driverId: e.driverId,
        driverName: e.driverName,
        teamId: e.teamId,
        teamName: e.teamName,
        teamColor: e.teamColor,
        bestLapSec: e.bestLapSec,
        bestLapTime: e.bestLapTime,
        bestLapRecordedAtSec: e.bestLapRecordedAtSec || 0,
        compound: e.compound,
        tyreSetId: e.tyreSetId,
        lapsCount: e.laps,
        isPlayer: e.isPlayer,
        carId: e.carId,
        isEliminated: !!e.isEliminated,
        eliminatedInStage: e.eliminatedInStage,
      })),
      advancingDriverIds,
      eliminatedDriverIds,
    }

    if (shouldPersist) {
      canonicalQualifyingPersistenceService.saveStageResult(stageResult)
      canonicalQualifyingPersistenceService.saveStageState(context.seasonId, context.round, state)
    }

    return stageResult
  }

  /**
   * Avança a qualificação por um determinado número de segundos com física incremental.
   */
  public static advanceBySeconds(
    initialState: QualifyingStageState,
    totalSecondsToAdvance: number,
    context: QualifyingTickContext,
    options?: { persistState?: boolean },
  ): QualifyingAdvanceStepResult {
    let currentState: QualifyingStageState = JSON.parse(JSON.stringify(initialState))
    const accumulatedEvents: QualifyingRadioFeedEvent[] = []
    let totalLaps = 0
    let secondsSimulated = 0

    currentState.status = 'running'
    const stepSliceSec = 3
    let remainingToSimulate = Math.min(totalSecondsToAdvance, currentState.timeRemainingSec)

    while (remainingToSimulate > 0 && currentState.status === 'running') {
      const delta = Math.min(stepSliceSec, remainingToSimulate)
      const tickRes = this.tick(currentState, delta, context)
      currentState = tickRes.nextState
      secondsSimulated += delta
      remainingToSimulate -= delta

      if (tickRes.events.length > 0) {
        accumulatedEvents.push(...tickRes.events)
      }
      totalLaps += tickRes.lapsCompletedThisTick.length

      // Sincronizar pneus consumidos com o inventário oficial de fim de semana
      for (const lapItem of tickRes.lapsCompletedThisTick) {
        if (lapItem.carId) {
          const car = currentState.cars[lapItem.carId]
          if (car.currentTyreSetId && (options?.persistState ?? true)) {
            canonicalWeekendTyrePersistence.recordTyreUsage({
              seasonId: context.seasonId,
              round: context.round,
              driverId: car.driverId,
              tyreSetId: car.currentTyreSetId,
              lapsAdded: 1,
              finalWearPct: car.tyreWear,
            })
          }
        }
      }
      if (currentState.timeRemainingSec <= 0 || currentState.status === 'completed') {
        currentState.status = 'completed'
        break
      }
    }

    if (currentState.status !== 'completed') {
      currentState.status = 'paused'
    }

    if (options?.persistState ?? true) {
      canonicalQualifyingPersistenceService.saveStageState(
        context.seasonId,
        context.round,
        currentState,
      )
    }

    return {
      nextState: currentState,
      events: accumulatedEvents,
      lapsCount: totalLaps,
      interruptedByDecision: false,
      secondsSimulated,
    }
  }

  /**
   * SIMULAR RESTANTE DA FASE:
   * Executa todo o tempo restante da fase com o MESMO runner canônico.
   * Não marca simplesmente completed: coloca carros para rodar e IA para tentar melhores marcas.
   */
  public static simulateRemainingSession(
    initialState: QualifyingStageState,
    context: QualifyingTickContext,
    options?: { persistState?: boolean },
  ): QualifyingAdvanceStepResult {
    const shouldPersist = options?.persistState ?? true
    let currentState: QualifyingStageState = JSON.parse(JSON.stringify(initialState))
    const accumulatedEvents: QualifyingRadioFeedEvent[] = []
    let totalLaps = 0
    let secondsSimulated = 0

    currentState.status = 'running'
    const stepSliceSec = 10

    while (currentState.timeRemainingSec > 0) {
      // IA de box e saída para os carros do jogador se estiverem na garagem com combustível
      ;(['car1', 'car2'] as const).forEach((carId) => {
        const car = currentState.cars[carId]
        if (car.status === 'garage' && currentState.timeRemainingSec > 120 && !car.isEliminated) {
          if (car.fuelKg < 8) {
            this.refuelCarInGarage(currentState, carId, 15)
          }
          this.orderCarExitToTrack(currentState, carId)
        }
      })

      const delta = Math.min(stepSliceSec, currentState.timeRemainingSec)
      const tickRes = this.tick(currentState, delta, context)
      currentState = tickRes.nextState
      secondsSimulated += delta

      if (tickRes.events.length > 0) {
        accumulatedEvents.push(...tickRes.events)
      }
      totalLaps += tickRes.lapsCompletedThisTick.length

      for (const lapItem of tickRes.lapsCompletedThisTick) {
        if (lapItem.carId) {
          const car = currentState.cars[lapItem.carId]
          if (car.currentTyreSetId && shouldPersist) {
            canonicalWeekendTyrePersistence.recordTyreUsage({
              seasonId: context.seasonId,
              round: context.round,
              driverId: car.driverId,
              tyreSetId: car.currentTyreSetId,
              lapsAdded: 1,
              finalWearPct: car.tyreWear,
            })
          }
        }
      }

      if (currentState.timeRemainingSec <= 0) {
        break
      }
    }

    this.finalizeStage(currentState, context, { persistState: shouldPersist })

    return {
      nextState: currentState,
      events: accumulatedEvents,
      lapsCount: totalLaps,
      interruptedByDecision: false,
      secondsSimulated,
    }
  }
}
