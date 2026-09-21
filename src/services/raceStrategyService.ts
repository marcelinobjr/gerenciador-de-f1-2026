/**
 * raceStrategyService.ts
 *
 * FW2.1E-D — PIT & STRATEGY (APEX GP MANAGER - F1 2026)
 *
 * Princípios Canônicos Fundamentais:
 * 1. DOIS PILOTOS INDEPENDENTES:
 *    A equipe do jogador possui dois carros e os dois são controlados independentemente.
 *    Cada carro possui seu próprio DriverStrategyState.
 *    Nenhum comando aplicado ao Carro 1 pode alterar o Carro 2 por efeito colateral.
 * 2. IDENTIDADE DOS DOIS CARROS:
 *    Derivados dinamicamente de careerId -> playerTeamId -> race entries.
 *    Zero hardcoding de equipe ou pilotos.
 * 3. SEPARAÇÃO RIGOROSA: pitRequested vs pitExecuted.
 *    O jogador pode pedir pit a qualquer momento, mas a execução ocorre quando o carro
 *    chega ao box no fim da volta. Não troca pneu instantaneamente no clique.
 * 4. DOUBLE STACK REAL:
 *    Se ambos os pilotos da mesma equipe pararem na mesma volta, o segundo carro
 *    sofre atraso adicional (doubleStackDelaySec) dependendo do gap entre eles,
 *    da duração do pit do primeiro e da liberação da baia.
 * 5. IMPACTO DE SAFETY CAR / VSC:
 *    Pit stop durante SC / VSC tem perda de tempo efetiva significativamente menor
 *    em relação ao pelotão que está andando em ritmo lento.
 *    RED_FLAG bloqueia pit stops normais.
 * 6. PERFORMANCE CANÔNICA DE PNEUS, UNDERCUT E OVERCUT:
 *    Centralizado em TIRE_SPECS e calculateTireCliffStatus.
 *    Ritmo e desgaste variam por composto (Soft, Medium, Hard).
 *    Undercut e overcut emergem das diferenças de tempo e tráfego.
 * 7. MODOS DE RITMO:
 *    PUSH, NORMAL, CONSERVE por piloto.
 * 8. DETERMINISMO E CLONAGEM PROFUNDA:
 *    Mulberry32 centralizado, sem Math.random().
 *    Deep clone entre instâncias para garantir isolamento absoluto.
 */

import type {
  CanonicalRaceState,
  CanonicalRaceDriverState,
  DriverStrategyState,
  DriverPaceMode,
  DriverFuelMode,
  DriverTrafficStatus,
  PitWindow,
  PlannedStint,
} from '@/types/canonical-race-v2'
import type { TireCompound } from '@/types/f1'
import { TIRE_SPECS, calculateTireCliffStatus } from '@/lib/f1-tire-system'

export interface PitExecutionResult {
  durationSec: number
  totalPitLossSec: number
  isDoubleStack: boolean
  doubleStackDelaySec: number
  newCompound: TireCompound
  narrativeMessage: string
}

export class RaceStrategyService {
  /**
   * Deep clone auxiliar para garantir que nenhum estado seja compartilhado por referência
   */
  public deepClone<T>(obj: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj)
    }
    return JSON.parse(JSON.stringify(obj))
  }

  /**
   * Inicializa o estado estratégico padrão de um piloto específico.
   */
  public createDefaultDriverStrategy(params: {
    driverId: string
    startingCompound: TireCompound
    totalLaps: number
    carSlot?: 'car1' | 'car2'
    stintPlanOffset?: number // ex: car1 para na volta 18, car2 na 28
  }): DriverStrategyState {
    const { driverId, startingCompound, totalLaps, carSlot, stintPlanOffset = 0 } = params

    // Janela padrão de acordo com o pneu de largada e o slot do carro
    let windowStart = 16
    let windowEnd = 22
    let targetCompound: TireCompound = 'medio'

    if (startingCompound === 'macio') {
      windowStart = carSlot === 'car2' ? 17 : 14
      windowEnd = carSlot === 'car2' ? 22 : 18
      targetCompound = 'medio'
    } else if (startingCompound === 'medio') {
      windowStart = carSlot === 'car2' ? 28 : 22
      windowEnd = carSlot === 'car2' ? 34 : 27
      targetCompound = 'duro'
    } else {
      // duro
      windowStart = carSlot === 'car2' ? 32 : 28
      windowEnd = carSlot === 'car2' ? 38 : 34
      targetCompound = 'medio'
    }

    if (stintPlanOffset !== 0) {
      windowStart = Math.max(5, windowStart + stintPlanOffset)
      windowEnd = Math.max(windowStart + 3, windowEnd + stintPlanOffset)
    }

    const optimalLap = Math.round((windowStart + windowEnd) / 2)

    const nextPitWindow: PitWindow = {
      startLap: Math.min(totalLaps - 5, windowStart),
      endLap: Math.min(totalLaps - 2, windowEnd),
      optimalLap: Math.min(totalLaps - 3, optimalLap),
    }

    const plannedStints: PlannedStint[] = [
      {
        stintNumber: 1,
        compound: startingCompound,
        startLap: 1,
        targetLaps: nextPitWindow.optimalLap,
      },
      {
        stintNumber: 2,
        compound: targetCompound,
        startLap: nextPitWindow.optimalLap + 1,
        targetLaps: totalLaps - nextPitWindow.optimalLap,
      },
    ]

    return {
      driverId,
      carSlot,
      currentTyre: startingCompound,
      tyreAge: 0,
      plannedStints,
      nextPitWindow,
      pitRequested: false,
      pitThisLap: false,
      targetCompound,
      paceMode: 'NORMAL',
      fuelMode: 'NORMAL',
      trafficStatus: 'CLEAR_AIR',
      gapAhead: 0,
      gapBehind: 0,
      undercutOpportunity: false,
      overcutOpportunity: false,
      strategyStatus: 'OPTIMAL',
    }
  }

  /**
   * Garante e inicializa a estratégia para todos os pilotos da corrida.
   * Dá atenção especial aos 2 carros do playerTeamId, garantindo estratégias distintas.
   */
  public ensureDriverStrategies(
    raceState: CanonicalRaceState,
  ): Record<string, DriverStrategyState> {
    const existing = raceState.driverStrategies ? this.deepClone(raceState.driverStrategies) : {}
    const totalLaps = raceState.totalLaps || 50
    const playerDrivers = raceState.drivers.filter((d) => d.isPlayer)

    // Se houver pilotos do jogador sem carId definido, assinalar car1 e car2 de forma determinística
    if (playerDrivers.length >= 2) {
      if (!playerDrivers[0].carId && !playerDrivers[1].carId) {
        playerDrivers[0].carId = 'car1'
        playerDrivers[1].carId = 'car2'
      } else if (playerDrivers[0].carId && !playerDrivers[1].carId) {
        playerDrivers[1].carId = playerDrivers[0].carId === 'car1' ? 'car2' : 'car1'
      }
    }

    for (const driver of raceState.drivers) {
      if (!existing[driver.driverId]) {
        const isPlayer = driver.isPlayer
        const carSlot =
          driver.carId ||
          (isPlayer
            ? playerDrivers[0]?.driverId === driver.driverId
              ? 'car1'
              : 'car2'
            : undefined)

        // Diferenciar janelas padrão para Carro 1 e Carro 2
        let offset = 0
        if (carSlot === 'car2') {
          offset = 6 // Carro 2 tem janela mais tardia por padrão
        }

        existing[driver.driverId] = this.createDefaultDriverStrategy({
          driverId: driver.driverId,
          startingCompound: driver.tyreCompound || 'medio',
          totalLaps,
          carSlot,
          stintPlanOffset: offset,
        })
      }
    }

    return existing
  }

  /**
   * COMANDO INDIVIDUAL: Solicitar Pit Stop para um piloto específico.
   * Não afeta o outro piloto da equipe.
   */
  public requestPitStop(
    raceState: CanonicalRaceState,
    driverId: string,
    targetCompound?: TireCompound,
  ): CanonicalRaceState {
    const nextState = this.deepClone(raceState)
    const strategies = this.ensureDriverStrategies(nextState)
    const currentStrat = strategies[driverId]

    if (!currentStrat) {
      return raceState
    }

    const driver = nextState.drivers.find((d) => d.driverId === driverId)
    if (!driver || driver.raceStatus === 'dnf' || driver.raceStatus === 'finished') {
      return raceState
    }

    // Proibir solicitação de pit sob Red Flag ativa
    if (nextState.status === 'red_flag' || nextState.redFlagActive) {
      return raceState
    }

    currentStrat.pitRequested = true
    currentStrat.pitThisLap = true
    if (targetCompound) {
      currentStrat.targetCompound = targetCompound
    }
    currentStrat.strategyStatus = 'PIT_REQUESTED'

    strategies[driverId] = currentStrat
    nextState.driverStrategies = strategies

    // Atualizar no driver individual também
    if (driver) {
      driver.strategy = currentStrat
    }

    // Registrar evento individual
    const events = [...(nextState.events || [])]
    events.push({
      id: `ev_pitreq_${nextState.currentLap}_${driverId}_${Date.now()}`,
      lap: nextState.currentLap,
      type: 'info',
      message: `📻 PIT REQUEST: Box confirmado para ${driver.driverName} (${driver.carId === 'car2' ? 'Carro 2' : 'Carro 1'}) nesta volta! Pneus alvo: ${(currentStrat.targetCompound || 'duro').toUpperCase()}.`,
      driverId: driver.driverId,
      driverName: driver.driverName,
      teamColor: driver.teamColor,
      timestamp: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    })
    nextState.events = events.slice(-60)

    return nextState
  }

  /**
   * COMANDO INDIVIDUAL: Cancelar pedido de pit stop de um piloto.
   */
  public cancelPitRequest(raceState: CanonicalRaceState, driverId: string): CanonicalRaceState {
    const nextState = this.deepClone(raceState)
    const strategies = this.ensureDriverStrategies(nextState)
    const currentStrat = strategies[driverId]

    if (!currentStrat) return raceState

    currentStrat.pitRequested = false
    currentStrat.pitThisLap = false
    currentStrat.strategyStatus = 'OPTIMAL'
    strategies[driverId] = currentStrat
    nextState.driverStrategies = strategies

    const driver = nextState.drivers.find((d) => d.driverId === driverId)
    if (driver) {
      driver.strategy = currentStrat
    }

    return nextState
  }

  /**
   * COMANDO INDIVIDUAL: Definir modo de ritmo (PaceMode) de um piloto.
   * Não altera o outro piloto.
   */
  public setDriverPaceMode(
    raceState: CanonicalRaceState,
    driverId: string,
    mode: DriverPaceMode,
  ): CanonicalRaceState {
    const nextState = this.deepClone(raceState)
    const strategies = this.ensureDriverStrategies(nextState)
    const currentStrat = strategies[driverId]

    if (!currentStrat) return raceState

    currentStrat.paceMode = mode
    strategies[driverId] = currentStrat
    nextState.driverStrategies = strategies

    // Sincronizar com paceOrders legado para compatibilidade de UI
    if (!nextState.paceOrders) nextState.paceOrders = {}
    nextState.paceOrders[driverId] =
      mode === 'PUSH' ? 'empurrar' : mode === 'CONSERVE' ? 'segurar' : 'normal'

    const driver = nextState.drivers.find((d) => d.driverId === driverId)
    if (driver) {
      driver.strategy = currentStrat
    }

    return nextState
  }

  /**
   * COMANDO INDIVIDUAL: Atualizar composto alvo do próximo pit stop.
   */
  public setDriverTargetCompound(
    raceState: CanonicalRaceState,
    driverId: string,
    compound: TireCompound,
  ): CanonicalRaceState {
    const nextState = this.deepClone(raceState)
    const strategies = this.ensureDriverStrategies(nextState)
    const currentStrat = strategies[driverId]

    if (!currentStrat) return raceState

    currentStrat.targetCompound = compound
    strategies[driverId] = currentStrat
    nextState.driverStrategies = strategies

    const driver = nextState.drivers.find((d) => d.driverId === driverId)
    if (driver) {
      driver.strategy = currentStrat
    }

    return nextState
  }

  /**
   * COMANDO INDIVIDUAL: Definir janela de pit planejada para um piloto.
   */
  public setDriverPitWindow(
    raceState: CanonicalRaceState,
    driverId: string,
    window: PitWindow,
  ): CanonicalRaceState {
    const nextState = this.deepClone(raceState)
    const strategies = this.ensureDriverStrategies(nextState)
    const currentStrat = strategies[driverId]

    if (!currentStrat) return raceState

    currentStrat.nextPitWindow = window
    strategies[driverId] = currentStrat
    nextState.driverStrategies = strategies

    const driver = nextState.drivers.find((d) => d.driverId === driverId)
    if (driver) {
      driver.strategy = currentStrat
    }

    return nextState
  }

  /**
   * COMANDO: Configurar prioridade de pit stop da equipe (para resolução de double stack).
   * Prioridade explícita e configurável: 'car1', 'car2' ou driverId.
   */
  public setTeamPitPriority(raceState: CanonicalRaceState, priority: string): CanonicalRaceState {
    const nextState = this.deepClone(raceState)
    nextState.pitPriority = priority
    return nextState
  }

  /**
   * Modificadores de ritmo e desgaste decorrentes do modo de ritmo (PaceMode).
   */
  public getPaceModeModifiers(mode: DriverPaceMode): {
    paceDeltaSec: number
    wearMultiplier: number
    fuelBurnMultiplier: number
  } {
    switch (mode) {
      case 'PUSH':
        return {
          paceDeltaSec: -0.35, // 0.35s mais rápido
          wearMultiplier: 1.35, // 35% mais desgaste
          fuelBurnMultiplier: 1.15, // 15% mais consumo
        }
      case 'CONSERVE':
        return {
          paceDeltaSec: +0.45, // 0.45s mais lento
          wearMultiplier: 0.65, // 35% menos desgaste
          fuelBurnMultiplier: 0.85, // 15% menos consumo
        }
      case 'NORMAL':
      default:
        return {
          paceDeltaSec: 0.0,
          wearMultiplier: 1.0,
          fuelBurnMultiplier: 1.0,
        }
    }
  }

  /**
   * Avalia tráfego, ar limpo (clean air) e oportunidades de undercut / overcut
   * para um piloto ativo na pista.
   */
  public evaluateTrafficAndStrategyOpportunities(params: {
    driver: CanonicalRaceDriverState
    driversInOrder: CanonicalRaceDriverState[]
    currentLap: number
    strategy: DriverStrategyState
  }): {
    trafficStatus: DriverTrafficStatus
    gapAhead: number
    gapBehind: number
    undercutOpportunity: boolean
    overcutOpportunity: boolean
  } {
    const { driver, driversInOrder, currentLap, strategy } = params
    const active = driversInOrder.filter((d) => d.raceStatus === 'racing')
    const idx = active.findIndex((d) => d.driverId === driver.driverId)

    if (idx === -1) {
      return {
        trafficStatus: 'CLEAR_AIR',
        gapAhead: 99.0,
        gapBehind: 99.0,
        undercutOpportunity: false,
        overcutOpportunity: false,
      }
    }

    const carAhead = idx > 0 ? active[idx - 1] : null
    const carBehind = idx < active.length - 1 ? active[idx + 1] : null

    const gapAhead = carAhead ? Number((driver.raceTime - carAhead.raceTime).toFixed(3)) : 99.0
    const gapBehind = carBehind ? Number((carBehind.raceTime - driver.raceTime).toFixed(3)) : 99.0

    // Ar sujo/tráfego: gap à frente menor que 1.5s
    let trafficStatus: DriverTrafficStatus = 'CLEAR_AIR'
    if (gapAhead < 1.0) {
      trafficStatus = 'DIRTY_AIR'
    } else if (gapAhead < 2.0) {
      trafficStatus = 'IN_TRAFFIC'
    }

    // UNDERCUT:
    // Carro está próximo do adversário à frente (gapAhead entre 0.4s e 2.5s),
    // pneu atual já tem desgaste moderado (tyreAge >= 10 ou perto da janela),
    // e o adversário à frente ainda não parou nesta volta.
    const isInPitWindow = currentLap >= strategy.nextPitWindow.startLap - 2
    const tyreTired = driver.tyreAge >= 10
    const closeToAhead = gapAhead >= 0.3 && gapAhead <= 2.8
    const undercutOpportunity = closeToAhead && (isInPitWindow || tyreTired) && !strategy.pitThisLap

    // OVERCUT:
    // Carro está com ritmo razoável, adversário próximo à frente acabou de parar
    // ou adversário atrás parou e o piloto tem ar limpo (gapAhead > 3s) com pneu ainda funcional.
    const hasCleanAir = gapAhead > 3.0 || idx === 0
    const tyreUsable = driver.tyreAge < 35
    const overcutOpportunity = hasCleanAir && tyreUsable && gapBehind < 3.0 && !strategy.pitThisLap

    return {
      trafficStatus,
      gapAhead: Math.max(0, gapAhead),
      gapBehind: Math.max(0, gapBehind),
      undercutOpportunity,
      overcutOpportunity,
    }
  }

  /**
   * EXECUÇÃO CANÔNICA DO PIT STOP:
   * Calcula tempo do pit stop, atraso de double stack se aplicável,
   * perda de pit relativa a Safety Car / VSC e aplica determinismo.
   */
  public executePitStop(params: {
    driver: CanonicalRaceDriverState
    targetCompound: TireCompound
    isDoubleStackSecondCar: boolean
    firstCarPitDurationSec?: number
    gapBetweenTeammatesSec?: number
    isSafetyCar: boolean
    isVsc: boolean
    rng: () => number
  }): PitExecutionResult {
    const {
      driver,
      targetCompound,
      isDoubleStackSecondCar,
      firstCarPitDurationSec = 2.5,
      gapBetweenTeammatesSec = 1.0,
      isSafetyCar,
      isVsc,
      rng,
    } = params

    // 1. Duração mecânica da parada na baia (2.0s a 3.5s base)
    // Semente Mulberry32
    const baseDuration = 2.2 + rng() * 0.8 // 2.2s a 3.0s

    // Chance de pit stop lento: 4%
    const isSlow = rng() < 0.04
    const slowExtra = isSlow ? 2.5 + rng() * 3.0 : 0
    let pitDurationSec = Number((baseDuration + slowExtra).toFixed(2))

    // 2. DOUBLE STACK:
    // Se for o segundo carro da equipe parando na mesma volta:
    // O segundo carro precisa esperar a liberação do primeiro se a diferença de tempo
    // for menor que o tempo de atendimento do primeiro.
    let doubleStackDelaySec = 0
    if (isDoubleStackSecondCar) {
      // Tempo que o primeiro carro ainda estará ocupando a baia quando o segundo chega
      // Se gap < firstCarPitDuration, o segundo carro obrigatoriamente fica parado esperando
      const timeRemainingForFirst = Math.max(
        0,
        firstCarPitDurationSec - Math.max(0, gapBetweenTeammatesSec),
      )
      // Margem operacional da equipe para troca de ferramentas e posicionamento dos mecânicos (~1.5s a 2.5s)
      const mechanicResetDelay = 1.6 + rng() * 0.9
      doubleStackDelaySec = Number((timeRemainingForFirst + mechanicResetDelay).toFixed(2))
      pitDurationSec = Number((pitDurationSec + doubleStackDelaySec).toFixed(2))
    }

    // 3. PIT LOSS (Perda de tempo total no pit lane):
    // Em bandeira verde: tempo de entrada + rolagem a 80km/h + parada + saída - tempo que o pelotão leva na reta
    // Típico da F1: ~20.0s a 23.0s de delta total.
    // Sob VSC: o pelotão está rodando ~40% mais lento, a perda relativa é de apenas ~10.0s a 13.0s!
    // Sob Safety Car: o pelotão roda a velocidade de comboio (~105km/h), a perda relativa é de apenas ~8.0s a 11.0s!
    let pitLaneTransitLossSec = 19.5
    if (isSafetyCar) {
      pitLaneTransitLossSec = 8.5 // "Cheaper pit stop" sob SC
    } else if (isVsc) {
      pitLaneTransitLossSec = 11.0 // "Cheaper pit stop" sob VSC
    }

    const totalPitLossSec = Number((pitLaneTransitLossSec + pitDurationSec).toFixed(3))

    let narrativeMessage = `🔧 BOX: Pit stop de ${driver.driverName} (${driver.teamName}) em ${pitDurationSec}s. Troca para ${targetCompound.toUpperCase()}.`
    if (isDoubleStackSecondCar) {
      narrativeMessage = `⚠️ DOUBLE STACK: ${driver.driverName} aguardou nos boxes da equipe (+${doubleStackDelaySec}s de atraso)! Parada total: ${pitDurationSec}s.`
    } else if (isSlow) {
      narrativeMessage = `⚠️ PIT LENTO: Dificuldade na troca de pneus de ${driver.driverName} (${pitDurationSec}s)!`
    } else if (isSafetyCar || isVsc) {
      narrativeMessage = `⚡ PIT OPORTUNISTA: ${driver.driverName} aproveitou a neutralização (${isSafetyCar ? 'Safety Car' : 'VSC'}) para parada rápida com perda reduzida!`
    }

    return {
      durationSec: pitDurationSec,
      totalPitLossSec,
      isDoubleStack: isDoubleStackSecondCar,
      doubleStackDelaySec,
      newCompound: targetCompound,
      narrativeMessage,
    }
  }

  /**
   * Processa todas as paradas pendentes nesta volta de corrida no canonicalRaceState.
   * Suporta double stack caso ambos os pilotos da mesma equipe tenham chamado pit.
   */
  public processLapPitStops(params: {
    raceState: CanonicalRaceState
    lap: number
    rng: () => number
  }): {
    updatedDrivers: CanonicalRaceDriverState[]
    updatedStrategies: Record<string, DriverStrategyState>
    newEvents: CanonicalRaceState['events']
  } {
    const { raceState, lap, rng } = params
    const strategies = this.ensureDriverStrategies(raceState)
    const updatedDrivers = this.deepClone(raceState.drivers)
    const newEvents: NonNullable<CanonicalRaceState['events']> = []

    // Proibir execução de pit normal sob Red Flag
    if (raceState.status === 'red_flag' || raceState.redFlagActive) {
      return {
        updatedDrivers,
        updatedStrategies: strategies,
        newEvents,
      }
    }

    const isSafetyCar =
      raceState.safetyCarActive || raceState.raceControl?.currentFlag === 'SAFETY_CAR'
    const isVsc = raceState.vscActive || raceState.raceControl?.currentFlag === 'VSC'

    // 1. Identificar carros que solicitaram pit nesta volta
    const pittingDrivers: CanonicalRaceDriverState[] = []
    for (const drv of updatedDrivers) {
      if (drv.raceStatus === 'dnf' || drv.raceStatus === 'finished') continue
      const strat = strategies[drv.driverId]
      if (strat && (strat.pitRequested || strat.pitThisLap)) {
        pittingDrivers.push(drv)
      }
    }

    if (pittingDrivers.length === 0) {
      return {
        updatedDrivers,
        updatedStrategies: strategies,
        newEvents,
      }
    }

    // 2. Agrupar por teamId para checar double stack
    const pittingByTeam: Record<string, CanonicalRaceDriverState[]> = {}
    for (const d of pittingDrivers) {
      if (!pittingByTeam[d.teamId]) pittingByTeam[d.teamId] = []
      pittingByTeam[d.teamId].push(d)
    }

    for (const teamId in pittingByTeam) {
      const teamCars = pittingByTeam[teamId]

      if (teamCars.length === 1) {
        // Apenas um carro da equipe parando: atendimento normal sem double stack
        const car = teamCars[0]
        const strat = strategies[car.driverId]
        const targetComp =
          strat?.targetCompound || (car.tyreCompound === 'macio' ? 'medio' : 'duro')

        const result = this.executePitStop({
          driver: car,
          targetCompound: targetComp,
          isDoubleStackSecondCar: false,
          isSafetyCar,
          isVsc,
          rng,
        })

        // Atualizar piloto
        car.pitStops = (car.pitStops || 0) + 1
        car.tyreCompound = result.newCompound
        car.tyreAge = 0
        car.raceTime = Number((car.raceTime + result.totalPitLossSec).toFixed(3))

        // Atualizar estratégia do piloto
        if (strat) {
          strat.currentTyre = result.newCompound
          strat.tyreAge = 0
          strat.pitRequested = false
          strat.pitThisLap = false
          strat.strategyStatus = 'OPTIMAL'
          strat.doubleStackDelaySec = 0
          strat.doubleStackWarning = undefined
          car.strategy = strat
        }

        newEvents.push({
          id: `ev_pitexec_${lap}_${car.driverId}_${Date.now()}`,
          lap,
          type: 'info',
          message: result.narrativeMessage,
          driverId: car.driverId,
          driverName: car.driverName,
          teamColor: car.teamColor,
          timestamp: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        })
      } else if (teamCars.length >= 2) {
        // DOUBLE STACK DETECTADO: Ambos os carros da mesma equipe parando na mesma volta!
        // Determinar ordem de atendimento.
        // Regra de prioridade explícita e configurável:
        // Se pitPriority estiver configurado para um driverId específico ou slot, respeitar.
        // Caso contrário, quem estiver à frente na pista (menor raceTime / melhor posição) tem prioridade natural.
        let firstCar = teamCars[0]
        let secondCar = teamCars[1]

        const explicitPriority = raceState.pitPriority
        if (explicitPriority) {
          if (teamCars[1].driverId === explicitPriority || teamCars[1].carId === explicitPriority) {
            firstCar = teamCars[1]
            secondCar = teamCars[0]
          }
        } else {
          // Ordenação natural de pista
          if (secondCar.raceTime < firstCar.raceTime) {
            firstCar = teamCars[1]
            secondCar = teamCars[0]
          }
        }

        const gapBetweenTeammates = Math.max(0, Math.abs(secondCar.raceTime - firstCar.raceTime))

        // Atender primeiro carro
        const strat1 = strategies[firstCar.driverId]
        const targetComp1 =
          strat1?.targetCompound || (firstCar.tyreCompound === 'macio' ? 'medio' : 'duro')
        const result1 = this.executePitStop({
          driver: firstCar,
          targetCompound: targetComp1,
          isDoubleStackSecondCar: false,
          isSafetyCar,
          isVsc,
          rng,
        })

        firstCar.pitStops = (firstCar.pitStops || 0) + 1
        firstCar.tyreCompound = result1.newCompound
        firstCar.tyreAge = 0
        firstCar.raceTime = Number((firstCar.raceTime + result1.totalPitLossSec).toFixed(3))

        if (strat1) {
          strat1.currentTyre = result1.newCompound
          strat1.tyreAge = 0
          strat1.pitRequested = false
          strat1.pitThisLap = false
          strat1.strategyStatus = 'OPTIMAL'
          strat1.doubleStackDelaySec = 0
          strat1.doubleStackWarning = undefined
          firstCar.strategy = strat1
        }

        // Atender segundo carro com double stack delay
        const strat2 = strategies[secondCar.driverId]
        const targetComp2 =
          strat2?.targetCompound || (secondCar.tyreCompound === 'macio' ? 'medio' : 'duro')
        const result2 = this.executePitStop({
          driver: secondCar,
          targetCompound: targetComp2,
          isDoubleStackSecondCar: true,
          firstCarPitDurationSec: result1.durationSec,
          gapBetweenTeammatesSec: gapBetweenTeammates,
          isSafetyCar,
          isVsc,
          rng,
        })

        secondCar.pitStops = (secondCar.pitStops || 0) + 1
        secondCar.tyreCompound = result2.newCompound
        secondCar.tyreAge = 0
        secondCar.raceTime = Number((secondCar.raceTime + result2.totalPitLossSec).toFixed(3))

        if (strat2) {
          strat2.currentTyre = result2.newCompound
          strat2.tyreAge = 0
          strat2.pitRequested = false
          strat2.pitThisLap = false
          strat2.strategyStatus = 'OPTIMAL'
          strat2.doubleStackDelaySec = result2.doubleStackDelaySec
          strat2.doubleStackWarning = `Atraso de double stack: +${result2.doubleStackDelaySec}s aguardando ${firstCar.driverName}`
          secondCar.strategy = strat2
        }

        newEvents.push({
          id: `ev_pitexec_${lap}_${firstCar.driverId}_${Date.now()}`,
          lap,
          type: 'info',
          message: result1.narrativeMessage,
          driverId: firstCar.driverId,
          driverName: firstCar.driverName,
          teamColor: firstCar.teamColor,
          timestamp: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        })

        newEvents.push({
          id: `ev_pitexec_${lap}_${secondCar.driverId}_${Date.now() + 1}`,
          lap,
          type: 'incident',
          message: result2.narrativeMessage,
          driverId: secondCar.driverId,
          driverName: secondCar.driverName,
          teamColor: secondCar.teamColor,
          timestamp: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        })
      }
    }

    return {
      updatedDrivers,
      updatedStrategies: strategies,
      newEvents,
    }
  }
}

export const raceStrategyService = new RaceStrategyService()
