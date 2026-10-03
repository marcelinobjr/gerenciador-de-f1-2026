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
import { TANK_CAPACITY_KG } from '@/services/canonicalFuelModel'
import { TIRE_SPECS, type TrackWeatherState } from '@/lib/f1-tire-system'
import { computePracticePace } from '@/services/canonicalPaceIntegrationService'
import { canonicalPracticeRngService } from '@/services/canonicalPracticeRngService'
import { resolveCanonicalTeamKeyFromContext } from '@/services/canonicalTeamIdentityService'
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
    isRookie?: boolean
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
    car.fuelKg = Math.max(1, Math.min(TANK_CAPACITY_KG, kg))
    return true
  }

  /**
   * Instalação de jogo de pneus no carro na garagem durante o treino livre.
   */
  static fitTyreSetInGarage(
    state: PracticeSessionRecordState,
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
        sessionRecord: nextState,
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
          const isDriverRookie = !!context.drivers.find((d) => d.id === car.driverId)?.isRookie
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
            isRookie: isDriverRookie,
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
   * TL-PACE-01B: Mapeia o tipo de sessão de treino para o namespace canônico ('TL1' | 'TL2' | 'TL3').
   */
  public static mapSessionTypeToNamespace(sessionType?: string | null): 'TL1' | 'TL2' | 'TL3' {
    if (!sessionType) return 'TL1'
    const s = sessionType.trim().toUpperCase()
    if (s === 'TP1' || s === 'TL1') return 'TL1'
    if (s === 'TP2' || s === 'TL2') return 'TL2'
    if (s === 'TP3' || s === 'TL3') return 'TL3'
    return 'TL1'
  }

  /**
   * TL-PACE-01B: Extrai a eficiência de setup numérica (0..100) do estado de setup do carro.
   */
  public static extractSetupEfficiency(setup: any): number {
    if (!setup) return 80
    if (typeof setup.efficiency === 'number') return setup.efficiency
    if (typeof setup.setupEfficiency === 'number') return setup.setupEfficiency
    return 80
  }

  /**
   * Cálculo canônico do ritmo de volta livre de treino para o carro do jogador (TL-PACE-01B).
   * Substitui calculateCombinedPace por computePracticePace + canonicalPracticeRngService.
   */
  public static calculatePracticeLapPace(params: {
    car: PracticeCarLiveState
    driver?: PracticeTickContext['drivers'][0]
    context: PracticeTickContext
    circuitBaseSec: number
    sessionRecord?: PracticeSessionRecordState
  }): number {
    const { car, driver, context, sessionRecord } = params

    // 1. Resolução da identidade canônica da equipe via resolver contextual do Bloco A
    const rawCandidate =
      (context as any).teamId || (context as any).teamKey || context.teamName || 'custom_team'
    const resolvedCanonicalKey = resolveCanonicalTeamKeyFromContext({
      teamId: (context as any).teamId,
      rawTeamIdentity: rawCandidate,
      team: {
        id: (context as any).teamId,
        name: context.teamName,
      },
    })
    const playerTeamKey = resolvedCanonicalKey || rawCandidate

    // 2. Setup canônico
    const setupEfficiency = this.extractSetupEfficiency(car.setup)

    // 3. Sessão canônica ('TL1' | 'TL2' | 'TL3')
    const sessionNamespace = this.mapSessionTypeToNamespace(
      sessionRecord?.sessionType || (context as any).sessionType || 'TL1',
    )

    // 4. Temporada, round e carreira
    const careerId = sessionRecord?.careerId || (context as any).careerId || 'default_career'
    const seasonYear =
      (sessionRecord as any)?.seasonYear ||
      (context as any)?.seasonYear ||
      (sessionRecord?.seasonId
        ? parseInt(sessionRecord.seasonId.replace(/[^0-9]/g, '')) || 2026
        : 2026)
    const round = context.round || sessionRecord?.round || 1

    // 5. Attempt canônico: baseia-se no número real de voltas já dadas pelo carro + 1
    const attempt = (car.totalLaps || 0) + 1

    // 6. RNG determinístico canônico do Treino Livre (canonicalPracticeRngService)
    const rngDraw = canonicalPracticeRngService.getDeterministicDraw({
      careerId,
      seasonYear,
      round,
      session: sessionNamespace,
      driverId: car.driverId,
      attempt,
      program: car.program ?? 'default',
    })

    // 7. Chamada canônica ao computePracticePace (sem double counting)
    const result = computePracticePace({
      teamKey: playerTeamKey,
      driverId: car.driverId,
      careerId,
      seasonYear,
      round,
      session: sessionNamespace,
      attempt,
      rngModifier: rngDraw.rngModifier,
      program: car.program,
      driverAttributes: {
        speed: driver?.speed ?? 80,
        consistency: driver?.consistency ?? 80,
        morale: driver?.morale ?? 85,
        technical_feedback: driver?.technical_feedback ?? 80,
      },
      tyreCompound: car.currentCompound,
      tyreWearPct: car.tyreWear ?? 0,
      fuelKg: car.fuelKg,
      setupEfficiency,
      weather: context.weather,
      isRookie: !!driver?.isRookie,
    })

    return Number(Math.max(54, result.lapTimeSec).toFixed(3))
  }

  /**
   * Simulação da participação dos pilotos IA durante o treino livre (TL-PACE-01B).
   * Player e IA usam o MESMO computePracticePace e canonicalPracticeRngService.
   */
  public static advanceAIPracticePace(
    state: PracticeSessionRecordState,
    deltaSimSec: number,
    context: PracticeTickContext,
    circuitBaseSec: number,
  ): void {
    const aiEntries = state.leaderboard.filter((e) => !e.isPlayer)
    if (aiEntries.length === 0) return

    const aiList = getAICompetitors()
    const sessionNamespace = this.mapSessionTypeToNamespace(state.sessionType)
    const careerId = state.careerId || 'default_career'
    const seasonYear =
      (state as any)?.seasonYear ||
      (state.seasonId ? parseInt(state.seasonId.replace(/[^0-9]/g, '')) || 2026 : 2026)
    const round = context.round || state.round || 1

    // Amostragem probabilística de avanço no tempo (controle de tick)
    const chance = Math.min(0.95, Math.max(0.2, (deltaSimSec / 60) * 0.65))

    aiEntries.forEach((aiEntry) => {
      // Pilotos da IA dão voltas ao longo da sessão de 60 min (máx 28 voltas)
      if (Math.random() < chance && aiEntry.laps < 28) {
        const aiTeam = aiList.find((t) => t.name === aiEntry.teamName)

        // Resolução da identidade canônica da equipe IA (mesmo resolver contextual do Bloco A)
        const teamRawCandidate =
          (aiTeam as any)?.key || (aiTeam as any)?.id?.replace(/^ai_/, '') || aiEntry.teamName
        const resolvedTeamKey = resolveCanonicalTeamKeyFromContext({
          rawTeamIdentity: teamRawCandidate,
          team: {
            name: aiEntry.teamName,
          },
        })
        const aiTeamKey = resolvedTeamKey || teamRawCandidate

        const defaultSkill = aiEntry.driverId.endsWith('d1')
          ? aiTeam?.driver1.speed || 82
          : aiTeam?.driver2.speed || 80
        const driverSkill = aiEntry.isRookie ? 77 : defaultSkill

        const attempt = (aiEntry.laps || 0) + 1

        const aiRngDraw = canonicalPracticeRngService.getDeterministicDraw({
          careerId,
          seasonYear,
          round,
          session: sessionNamespace,
          driverId: aiEntry.driverId,
          attempt,
          program: 'car_setup',
        })

        const paceResult = computePracticePace({
          teamKey: aiTeamKey,
          driverId: aiEntry.driverId,
          careerId,
          seasonYear,
          round,
          session: sessionNamespace,
          attempt,
          rngModifier: aiRngDraw.rngModifier,
          program: 'car_setup', // programa neutro representativo para IA
          driverAttributes: {
            speed: driverSkill,
            consistency: aiEntry.isRookie ? 75 : 80,
            morale: 85,
            technical_feedback: 80,
          },
          tyreCompound: aiEntry.compound || 'medio',
          tyreWearPct: 5,
          fuelKg: 20,
          setupEfficiency: 80,
          weather: context.weather,
          isRookie: !!aiEntry.isRookie,
        })

        const lapSec = Number(Math.max(54, paceResult.lapTimeSec).toFixed(3))
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
      isRookie?: boolean
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
        isRookie: params.isRookie,
      }
      leaderboard.push(entry)
    }

    if (params.isRookie !== undefined) {
      entry.isRookie = params.isRookie
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
