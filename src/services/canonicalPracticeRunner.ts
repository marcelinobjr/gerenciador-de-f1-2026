import type {
  PracticeSessionRecordState,
  PracticeCarLiveState,
  PracticeStint,
  PracticeLapRecord,
  PracticeTimeEntry,
  PracticeRadioFeedEvent,
} from '@/types/practice-session'
import { CANONICAL_PRACTICE_DURATION_SEC } from '@/types/practice-session'
import { FUEL_CONSUMPTION_KG_PER_LAP } from '@/types/practice-preparation'
import { TIRE_SPECS, type TrackWeatherState } from '@/lib/f1-tire-system'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { carTechnicalService } from '@/services/carTechnicalService'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'
import { calculateCombinedPace } from '@/lib/f1-pace-model'
import { formatLapTime, formatGap } from '@/lib/f1-race-sim-engine'
import { getAICompetitors } from '@/lib/f1-data'
import {
  evaluateStintFeedback,
  updateSetupKnowledge,
  createInitialSetupKnowledge,
} from '@/services/canonicalPracticeFeedbackService'
import {
  evaluateTyreStint,
  updateTyreKnowledge,
  createInitialWeekendTyreKnowledge,
} from '@/services/canonicalPracticeTyreService'

export interface PracticeTickContext {
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
  drivers: Array<{
    id: string
    name: string
    speed: number
    consistency: number
    defense: number
    morale?: number
    physical_condition?: number
    technical_feedback?: number
  }>
}

export interface PracticeTickResult {
  nextState: PracticeSessionRecordState
  events: PracticeRadioFeedEvent[]
  lapsCompletedThisTick: Array<{
    carId: 'car1' | 'car2'
    driverId: string
    lap: PracticeLapRecord
  }>
}

export class PracticeSessionRunner {
  /**
   * Solicita que um dos carros saia para a pista da garagem.
   * Cria novo stint, tira do estado 'garage' e põe em 'out_lap'.
   */
  static orderCarExitToTrack(
    state: PracticeSessionRecordState,
    carId: 'car1' | 'car2',
  ): { success: boolean; error?: string; event?: PracticeRadioFeedEvent } {
    if (state.status === 'completed') {
      return { success: false, error: 'Sessão encerrada. Novos stints não são permitidos.' }
    }
    if (state.timeRemainingSec <= 0) {
      return { success: false, error: 'Tempo de sessão esgotado.' }
    }

    const car = state.cars[carId]
    if (car.status !== 'garage') {
      return { success: false, error: 'O carro já está na pista ou em trânsito.' }
    }
    if (car.fuelKg < 2) {
      return { success: false, error: 'Combustível insuficiente para sair aos boxes.' }
    }

    const stintId = `stint_${state.careerId}_${carId}_${Date.now()}`
    const newStint: PracticeStint = {
      id: stintId,
      driverId: car.driverId,
      carId,
      program: car.program,
      setupSnapshot: { ...car.setup },
      tyreSetId: car.currentTyreSetId,
      compound: car.currentCompound,
      initialFuelKg: car.fuelKg,
      initialWear: car.tyreWear,
      lapsCount: 0,
      laps: [],
      startedAt: new Date().toISOString(),
      status: 'active',
    }

    car.status = 'out_lap'
    car.pitRequested = false
    car.lapsInStint = 0
    car.currentStintId = stintId
    car.currentLapProgressPct = 0

    state.stints.push(newStint)

    const event: PracticeRadioFeedEvent = {
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
   * Solicita que o carro retorne aos boxes ao final do ciclo em pista.
   * Não teleporta: registra pitRequested para o carro transitar em 'in_lap' e retornar à garagem.
   */
  static requestCarBox(
    state: PracticeSessionRecordState,
    carId: 'car1' | 'car2',
  ): { success: boolean; error?: string; event?: PracticeRadioFeedEvent } {
    const car = state.cars[carId]
    if (car.status === 'garage') {
      return { success: false, error: 'O carro já está na garagem.' }
    }

    car.pitRequested = true

    const event: PracticeRadioFeedEvent = {
      id: `ev_boxreq_${carId}_${Date.now()}`,
      second: state.elapsedTimeSec,
      type: 'box',
      message: `Chamada aos boxes registrada para ${car.driverName}. Carro entrará nos boxes na próxima oportunidade.`,
      driverName: car.driverName,
      carId,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }

    state.radioFeed = [event, ...state.radioFeed].slice(0, 50)
    return { success: true, event }
  }

  /**
   * Atualiza a configuração do carro na garagem se o carro estiver parado na garagem.
   */
  static updateCarGarageSetup(
    state: PracticeSessionRecordState,
    carId: 'car1' | 'car2',
    partialSetup: Partial<PracticeCarLiveState['setup']>,
  ): boolean {
    const car = state.cars[carId]
    if (car.status !== 'garage') return false

    car.setup = {
      ...car.setup,
      ...partialSetup,
    }
    return true
  }

  /**
   * Reabastece o carro na garagem.
   */
  static refuelCarInGarage(
    state: PracticeSessionRecordState,
    carId: 'car1' | 'car2',
    kg: number,
  ): boolean {
    const car = state.cars[carId]
    if (car.status !== 'garage') return false
    car.fuelKg = Math.max(5, Math.min(110, kg))
    return true
  }

  /**
   * Avança a sessão em um tick de tempo simulado (deltaSec).
   * A cadência (simSpeed) multiplica o avanço de tempo no relógio e no progresso,
   * garantindo que a física por volta e stint seja estritamente canônica.
   */
  static tick(
    currentState: PracticeSessionRecordState,
    deltaSimSec: number,
    context: PracticeTickContext,
  ): PracticeTickResult {
    // Clonar para garantir imutabilidade e pureza do runner
    const nextState: PracticeSessionRecordState = JSON.parse(JSON.stringify(currentState))
    const events: PracticeRadioFeedEvent[] = []
    const lapsCompletedThisTick: Array<{
      carId: 'car1' | 'car2'
      driverId: string
      lap: PracticeLapRecord
    }> = []

    if (nextState.status !== 'running') {
      return { nextState, events, lapsCompletedThisTick }
    }

    if (nextState.timeRemainingSec <= 0) {
      nextState.status = 'completed'
      nextState.timeRemainingSec = 0
      return { nextState, events, lapsCompletedThisTick }
    }

    // 1. Avançar relógio da sessão
    const appliedDelta = Math.min(deltaSimSec, nextState.timeRemainingSec)
    nextState.elapsedTimeSec += appliedDelta
    nextState.timeRemainingSec = Math.max(0, nextState.timeRemainingSec - appliedDelta)

    // Base de tempo de volta do circuito
    const circuitBaseSec = Math.max(65, context.lengthKm * 15.2)

    // 2. Processar os carros do jogador de forma independente
    ;(['car1', 'car2'] as const).forEach((carId) => {
      const car = nextState.cars[carId]
      if (car.status === 'garage') {
        // Carro na garagem: sem desgaste, sem consumo, sem teleporte
        return
      }

      // Estimar tempo da volta para o piloto/carro atual usando o motor canônico
      const driver = context.drivers.find((d) => d.id === car.driverId)
      const lapTimeSec = this.calculatePracticeLapPace({
        car,
        driver,
        context,
        circuitBaseSec,
      })

      // Progresso da fase atual (out_lap: 75% da volta, flying_lap: 100%, in_lap: 75%)
      const phaseDurationSec = car.status === 'flying_lap' ? lapTimeSec : lapTimeSec * 0.75
      const progressIncrementPct = (appliedDelta / phaseDurationSec) * 100
      car.currentLapProgressPct = (car.currentLapProgressPct || 0) + progressIncrementPct

      if (car.currentLapProgressPct >= 100) {
        car.currentLapProgressPct = 0

        if (car.status === 'out_lap') {
          // Completou volta de saída: entra em volta rápida (flying lap)
          car.status = 'flying_lap'
          const ev: PracticeRadioFeedEvent = {
            id: `ev_fast_${carId}_${Date.now()}_${nextState.elapsedTimeSec}`,
            second: nextState.elapsedTimeSec,
            type: 'fast_lap',
            message: `${car.driverName} (${carId === 'car1' ? 'Carro 1' : 'Carro 2'}) iniciou volta rápida.`,
            driverName: car.driverName,
            carId,
            timestamp: new Date().toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          }
          events.push(ev)
          nextState.radioFeed.unshift(ev)
        } else if (car.status === 'flying_lap') {
          // Completou uma volta rápida oficial!
          car.totalLaps += 1
          car.lapsInStint += 1

          // Física Canônica: Consumo de Combustível
          // Programa race_pace consome ligeiramente mais; car_setup consome padrão
          const programFuelFactor =
            car.program === 'race_pace' ? 1.05 : car.program === 'qualifying_sim' ? 0.95 : 1.0
          const fuelBurn = Number((FUEL_CONSUMPTION_KG_PER_LAP * programFuelFactor).toFixed(2))
          car.fuelKg = Math.max(0, Number((car.fuelKg - fuelBurn).toFixed(2)))

          // Física Canônica: Desgaste de Pneus
          const tireSpec = TIRE_SPECS[car.currentCompound] || TIRE_SPECS.medio
          const baseWearRate = tireSpec.wearFactor * (context.tireAbrasiveness / 5)
          const programWearFactor =
            car.program === 'qualifying_sim' ? 1.4 : car.program === 'tyre_knowledge' ? 1.15 : 1.0
          const wearInc = Math.max(2, Math.round(baseWearRate * programWearFactor * 1.5))
          car.tyreWear = Math.min(100, (car.tyreWear || 0) + wearInc)

          // Alerta de desgaste elevado
          if (car.tyreWear >= 75 && car.tyreWear - wearInc < 75) {
            const evWear: PracticeRadioFeedEvent = {
              id: `ev_wear_${carId}_${Date.now()}`,
              second: nextState.elapsedTimeSec,
              type: 'tyre_alert',
              message: `Alerta: Pneus de ${car.driverName} atingiram ${car.tyreWear}% de desgaste!`,
              driverName: car.driverName,
              carId,
              timestamp: new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            }
            events.push(evWear)
            nextState.radioFeed.unshift(evWear)
          }

          // Registrar tempo da volta
          const lapFormatted = formatLapTime(lapTimeSec)
          car.lastLapTime = lapFormatted
          car.lastLapSec = lapTimeSec

          const isPersonalBest = !car.bestLapSec || lapTimeSec < car.bestLapSec
          if (isPersonalBest) {
            car.bestLapSec = lapTimeSec
            car.bestLapTime = lapFormatted
          }

          // Verificar se é a melhor volta geral da sessão
          const currentBestInSession = Math.min(
            ...nextState.leaderboard.filter((e) => e.bestLapSec > 0).map((e) => e.bestLapSec),
            Infinity,
          )
          const isSessionBest = lapTimeSec < currentBestInSession

          // Criar registro da volta
          const lapRecord: PracticeLapRecord = {
            lapNumber: car.totalLaps,
            lapTimeSec,
            lapTimeFormatted: lapFormatted,
            compound: car.currentCompound,
            tyreWear: car.tyreWear,
            fuelRemainingKg: car.fuelKg,
            program: car.program,
            stintId: car.currentStintId || '',
            isValid: true,
            isPersonalBest,
            isSessionBest,
            timestamp: new Date().toISOString(),
          }

          if (!nextState.lapHistory[car.driverId]) {
            nextState.lapHistory[car.driverId] = []
          }
          nextState.lapHistory[car.driverId].push(lapRecord)

          // Anexar no stint atual
          const activeStint = nextState.stints.find(
            (s) => s.id === car.currentStintId && s.status === 'active',
          )
          if (activeStint) {
            activeStint.lapsCount += 1
            activeStint.laps.push(lapRecord)
            activeStint.finalFuelKg = car.fuelKg
            activeStint.finalWear = car.tyreWear
          }

          lapsCompletedThisTick.push({
            carId,
            driverId: car.driverId,
            lap: lapRecord,
          })

          // Atualizar leaderboard oficial
          this.updateLeaderboardEntry(nextState.leaderboard, {
            driverId: car.driverId,
            driverName: car.driverName,
            teamName: context.teamName,
            teamColor: context.teamColor,
            compound: car.currentCompound,
            lapTimeSec,
            lapFormatted,
            isPlayer: true,
            carId,
          })

          // Decidir próximo estado do carro:
          // Se o jogador pediu box, ou combustível acabou (<3 kg), ou tempo acabou -> entra nos boxes
          if (car.pitRequested || car.fuelKg <= 3.0 || nextState.timeRemainingSec <= 0) {
            car.status = 'in_lap'
            const evIn: PracticeRadioFeedEvent = {
              id: `ev_in_${carId}_${Date.now()}_${nextState.elapsedTimeSec}`,
              second: nextState.elapsedTimeSec,
              type: 'box',
              message: `${car.driverName} (${carId === 'car1' ? 'Carro 1' : 'Carro 2'}) completou a volta e está entrando nos boxes.`,
              driverName: car.driverName,
              carId,
              timestamp: new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            }
            events.push(evIn)
            nextState.radioFeed.unshift(evIn)
          } else {
            // Continua em flying lap
            car.status = 'flying_lap'
          }
        } else if (car.status === 'in_lap') {
          // Completou volta de entrada: retorna à garagem
          car.status = 'garage'
          car.pitRequested = false

          // Concluir stint
          const stintToClose = nextState.stints.find(
            (s) => s.id === car.currentStintId && s.status === 'active',
          )
          if (stintToClose) {
            stintToClose.status = 'completed'
            stintToClose.endedAt = new Date().toISOString()
            stintToClose.finalFuelKg = car.fuelKg
            stintToClose.finalWear = car.tyreWear

            // Etapa 4C1: Gerar feedback do piloto e atualizar conhecimento de setup da equipe
            if (!nextState.feedbacks) {
              nextState.feedbacks = []
            }
            if (!nextState.knowledge) {
              nextState.knowledge = createInitialSetupKnowledge()
            }

            const feedbackId = `feedback_${nextState.careerId}_${nextState.round}_${stintToClose.id}`
            const existingFeedback = nextState.feedbacks.find(
              (f) => f.stintId === stintToClose.id || f.id === feedbackId,
            )

            const driverObj = context.drivers.find((d) => d.id === car.driverId) || {
              id: car.driverId,
              name: car.driverName,
              speed: 80,
              consistency: 80,
              technical_feedback: 70,
            }

            const practiceSessionId = `${nextState.careerId}_${nextState.seasonId}_${nextState.round}_${nextState.sessionType}`

            if (!existingFeedback) {
              const newFeedback = evaluateStintFeedback({
                sessionId: practiceSessionId,
                stint: stintToClose,
                driver: driverObj,
                round: context.round,
                weather: context.weather,
                currentKnowledge: nextState.knowledge,
              })

              nextState.feedbacks.push(newFeedback)
              nextState.knowledge = updateSetupKnowledge(nextState.knowledge, newFeedback)

              // Marca como unread para destaque visual "NOVO FEEDBACK"
              if (!nextState.unreadFeedbackCarIds) {
                nextState.unreadFeedbackCarIds = []
              }
              if (!nextState.unreadFeedbackCarIds.includes(carId)) {
                nextState.unreadFeedbackCarIds.push(carId)
              }
            }

            // Etapa 4C2: Observação de Pneu e Conhecimento Progressivo da Equipe
            if (!nextState.tyreObservations) {
              nextState.tyreObservations = []
            }
            if (!nextState.tyreKnowledge) {
              nextState.tyreKnowledge = createInitialWeekendTyreKnowledge()
            }

            const tyreObsId = `tyre_obs_${practiceSessionId}_${stintToClose.id}`
            const existingTyreObs = nextState.tyreObservations.find(
              (o) => o.stintId === stintToClose.id || o.id === tyreObsId,
            )

            if (!existingTyreObs) {
              const newTyreObs = evaluateTyreStint({
                sessionId: practiceSessionId,
                stint: stintToClose,
                driver: driverObj,
                weather: context.weather,
                currentKnowledge: nextState.tyreKnowledge,
              })

              nextState.tyreObservations.push(newTyreObs)
              nextState.tyreKnowledge = updateTyreKnowledge(nextState.tyreKnowledge, newTyreObs)
            }
          }

          const evGarage: PracticeRadioFeedEvent = {
            id: `ev_gar_${carId}_${Date.now()}_${nextState.elapsedTimeSec}`,
            second: nextState.elapsedTimeSec,
            type: 'info',
            message: `${car.driverName} retornou aos boxes e está na garagem. Restante: ${car.fuelKg} kg de combustível.`,
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

    // 3. IA de Treino (Participação coerente do grid completo, sem criar 22 runners pesados)
    this.advanceAIPracticePace(nextState, appliedDelta, context, circuitBaseSec)

    // 4. Se o relógio zerou: finaliza a sessão
    if (nextState.timeRemainingSec <= 0 && (nextState.status as string) !== 'completed') {
      nextState.status = 'completed'
      const evEnd: PracticeRadioFeedEvent = {
        id: `ev_end_${Date.now()}`,
        second: nextState.elapsedTimeSec,
        type: 'finish',
        message: 'Cronômetro zerado. Sessão de Treino Livre encerrada!',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      }
      events.push(evEnd)
      nextState.radioFeed.unshift(evEnd)
    }

    nextState.radioFeed = nextState.radioFeed.slice(0, 50)
    return { nextState, events, lapsCompletedThisTick }
  }

  /**
   * Cálculo canônico do ritmo de volta livre de treino para o carro do jogador.
   */
  private static calculatePracticeLapPace(params: {
    car: PracticeCarLiveState
    driver?: PracticeTickContext['drivers'][0]
    context: PracticeTickContext
    circuitBaseSec: number
  }): number {
    const { car, driver, context, circuitBaseSec } = params

    const circuitProfile = resolveCircuitProfile({ round: context.round })
    const playerPu = OFFICIAL_POWER_UNITS[context.teamEngineSupplier] || OFFICIAL_POWER_UNITS.Audi
    const playerPuRating = Number(
      (playerPu.powerRating * 0.6 + playerPu.reliabilityRating * 0.4).toFixed(1),
    )
    const playerCarPerfRating = Number(
      (context.teamChassisRating * 0.7 + playerPuRating * 0.3).toFixed(1),
    )

    // Programa de treino influenciando modo de ataque
    const tacticalMode =
      car.program === 'qualifying_sim'
        ? 'attack'
        : car.program === 'race_pace'
          ? 'preserve'
          : undefined

    const pace = calculateCombinedPace({
      teamStrength: context.teamChassisRating,
      carLevel: context.teamChassisRating,
      driver: {
        speed: driver?.speed || 80,
        consistency: driver?.consistency || 80,
        defense: driver?.defense || 75,
        morale: driver?.morale || 85,
        physicalCondition: driver?.physical_condition || 90,
      },
      weather: context.weather,
      tireCompound: car.currentCompound,
      lapsOnTire: car.lapsInStint,
      wearPercent: car.tyreWear,
      trackAbrasiveness: context.tireAbrasiveness,
      circuit: circuitProfile,
      chassisRating: context.teamChassisRating,
      powerUnitRating: playerPuRating,
      carPerformanceRating: playerCarPerfRating,
      noise: (Math.random() - 0.5) * 0.2, // variação natural sutil
    })

    let lapSec = pace.lapTimeSec || circuitBaseSec

    // Penalidade/bônus de combustível: ~0.035s por kg a mais
    const fuelDeltaSec = (car.fuelKg - 25) * 0.035
    lapSec += fuelDeltaSec

    // Programa de classificação é mais agressivo (-0.6s)
    if (car.program === 'qualifying_sim') {
      lapSec -= 0.6
    }

    return Number(Math.max(55, lapSec).toFixed(3))
  }

  /**
   * Simulação leve de participação dos pilotos IA durante o treino livre.
   * Periodicamente, pilotos IA completam voltas e atualizam a tabela de tempos.
   */
  private static advanceAIPracticePace(
    state: PracticeSessionRecordState,
    deltaSimSec: number,
    context: PracticeTickContext,
    circuitBaseSec: number,
  ): void {
    // A cada ~100s de sessão simulada, alguns pilotos IA completam voltas de treino
    const aiEntries = state.leaderboard.filter((e) => !e.isPlayer)
    if (aiEntries.length === 0) return

    const circuitProfile = resolveCircuitProfile({ round: context.round })
    const aiList = getAICompetitors()

    // Amostragem probabilística proporcional ao delta de tempo
    const chance = Math.min(0.85, (deltaSimSec / 60) * 0.45)

    aiEntries.forEach((aiEntry) => {
      // Pilotos da IA dão entre 12 e 28 voltas ao longo de toda a sessão de 60 min
      if (Math.random() < chance && aiEntry.laps < 28) {
        const aiTeam = aiList.find((t) => t.name === aiEntry.teamName)
        const strength = aiTeam?.strengthRating || aiTeam?.strength || 75
        const driverSkill = aiEntry.driverId.endsWith('d1')
          ? aiTeam?.driver1.speed || 82
          : aiTeam?.driver2.speed || 80

        const pace = calculateCombinedPace({
          teamStrength: strength,
          carLevel: strength,
          driver: {
            speed: driverSkill,
            consistency: 80,
            defense: 75,
          },
          weather: context.weather,
          tireCompound: aiEntry.compound || 'medio',
          trackAbrasiveness: context.tireAbrasiveness,
          circuit: circuitProfile,
          chassisRating: strength,
          powerUnitRating: 85,
          carPerformanceRating: strength,
          noise: (Math.random() - 0.5) * 0.4,
        })

        const lapSec = Number((pace.lapTimeSec || circuitBaseSec).toFixed(3))
        aiEntry.laps += 1
        aiEntry.lastLapSec = lapSec
        aiEntry.lastLapTime = formatLapTime(lapSec)

        if (!aiEntry.bestLapSec || lapSec < aiEntry.bestLapSec) {
          aiEntry.bestLapSec = lapSec
          aiEntry.bestLapTime = formatLapTime(lapSec)
        }
      }
    })

    // Reordenar tabela de tempos pela melhor volta válida
    this.sortLeaderboard(state.leaderboard)
  }

  /**
   * Atualiza ou adiciona o registro de volta de um piloto na tabela de tempos.
   */
  private static updateLeaderboardEntry(
    leaderboard: PracticeTimeEntry[],
    params: {
      driverId: string
      driverName: string
      teamName: string
      teamColor: string
      compound: any
      lapTimeSec: number
      lapFormatted: string
      isPlayer: boolean
      carId?: 'car1' | 'car2'
    },
  ): void {
    let entry = leaderboard.find((e) => e.driverId === params.driverId)
    if (!entry) {
      entry = {
        position: 0,
        driverId: params.driverId,
        driverName: params.driverName,
        teamName: params.teamName,
        teamColor: params.teamColor,
        compound: params.compound,
        laps: 0,
        bestLapSec: 0,
        bestLapTime: '--:--.---',
        gap: '-',
        isPlayer: params.isPlayer,
        carId: params.carId,
      }
      leaderboard.push(entry)
    }

    entry.laps += 1
    entry.compound = params.compound
    entry.lastLapSec = params.lapTimeSec
    entry.lastLapTime = params.lapFormatted

    if (!entry.bestLapSec || params.lapTimeSec < entry.bestLapSec) {
      entry.bestLapSec = params.lapTimeSec
      entry.bestLapTime = params.lapFormatted
    }

    this.sortLeaderboard(leaderboard)
  }

  /**
   * Ordena a tabela de tempos de treino: quem tem melhor tempo menor fica no topo.
   * Pilotos sem voltas registradas ficam no final da tabela.
   */
  private static sortLeaderboard(leaderboard: PracticeTimeEntry[]): void {
    leaderboard.sort((a, b) => {
      if (a.bestLapSec > 0 && b.bestLapSec > 0) {
        return a.bestLapSec - b.bestLapSec
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
        item.gap = 'Líder'
      } else if (leaderBest > 0) {
        item.gap = formatGap(item.bestLapSec - leaderBest)
      } else {
        item.gap = '-'
      }
    })
  }
}
