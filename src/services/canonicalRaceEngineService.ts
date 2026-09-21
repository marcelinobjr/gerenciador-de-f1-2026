/**
 * canonicalRaceEngineService.ts
 *
 * FW2.1E-B — BASIC RACE ENGINE (APEX GP MANAGER - F1 2026)
 *
 * Princípios e Regras Fundamentais:
 * 1. Consome EXCLUSIVAMENTE o Canonical Race State da FW2.1E-A.
 *    Fluxo: Official Grid → Race Initialization → Canonical Race State → Race Engine.
 *    Altera o estado canônico existente, sem reconstruir grid/pilotos/equipes.
 * 2. RNG Centralizado, Seedável e Reproduzível:
 *    Same state + same seed = mesmo resultado exato.
 *    Zero Math.random() na lógica de negócio.
 * 3. Performance baseada nos atributos JÁ EXISTENTES:
 *    Pilotos: speed, consistency, racePace, tireManagement, experience, defense, morale, physicalCondition.
 *    Carros: chassisRating / carPerformanceRating / reliability / powerUnitRating / trackFit.
 * 4. Consistência controla a VARIABILIDADE:
 *    Piloto rápido + baixa consistência → grande potencial + oscilação alta.
 *    Piloto mais lento + alta consistência → pico menor + ritmo estável.
 * 5. Gaps do tempo acumulado REAL:
 *    raceTime(P2) - raceTime(P1) = gapToLeader
 *    raceTime(P5) - raceTime(P4) = gapToCarAhead
 * 6. Classificação Dinâmica:
 *    Ordem = carros ativos com mais voltas completadas → menor raceTime → abandonados (DNF)
 *    NUNCA ordenar por gridPosition após a largada.
 * 7. Invariantes estritas de final de volta:
 *    - Exatamente 24 pilotos únicos sem duplicações
 *    - teamId vinculado corretamente
 *    - gridPosition nunca muda (imutável)
 *    - lap nunca diminui
 *    - raceTime nunca diminui
 *    - tyreAge nunca diminui sem pit stop
 *    - combustível não aumenta espontaneamente
 *    - DNF não volta para RUNNING
 *    - Base 2026 permanece intocada
 */

import type {
  CanonicalRaceState,
  CanonicalRaceDriverState,
  CanonicalRaceStatus,
} from '@/types/canonical-race-v2'
import { driverBase2026Service } from '@/services/driverBase2026Service'
import { carTechnicalService } from '@/services/carTechnicalService'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { TIRE_SPECS, calculateTireCliffStatus } from '@/lib/f1-tire-system'
import { formatLapTime, formatGap } from '@/lib/f1-race-sim-engine'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { raceControlService } from '@/services/raceControlService'
import type { RaceControlState, RaceControlStatus } from '@/types/canonical-race-v2'

export interface AdvanceRaceOptions {
  seedOverride?: number
  burnFuelRateKg?: number
  tireAbrasiveness?: number
  forceRaceControlStatus?: import('@/types/canonical-race-v2').RaceControlStatus
  forceIncident?: {
    type: 'dnf' | 'crash' | 'debris' | 'mechanical_failure'
    driverId?: string
    isSevere?: boolean
    trackBlocked?: boolean
  }
}

export interface EngineLapEvent {
  id: string
  lap: number
  type: 'overtake' | 'incident' | 'dnf' | 'fastest_lap' | 'info'
  message: string
  driverId?: string
  driverName?: string
  teamColor?: string
  timestamp: string
}

export class CanonicalRaceEngineService {
  /**
   * Gerador pseudo-aleatório determinístico Mulberry32
   */
  public createMulberry32(seed: number): () => number {
    let t = (seed += 0x6d2b79f5)
    return () => {
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  /**
   * Converte uma string identificadora em semente numérica de 32 bits.
   */
  public hashStringToSeed(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash |= 0
    }
    return Math.abs(hash)
  }

  /**
   * Deriva a semente canônica única para uma volta específica da corrida.
   */
  public deriveLapSeed(raceState: CanonicalRaceState, lap: number, seedOverride?: number): number {
    if (typeof seedOverride === 'number') {
      return (seedOverride + lap * 10007) >>> 0
    }
    if (typeof raceState.raceSeed === 'number') {
      return (raceState.raceSeed + lap * 10007) >>> 0
    }
    const baseHash = this.hashStringToSeed(
      `${raceState.careerId}_${raceState.raceId}_${raceState.season}_${raceState.round}`,
    )
    return (baseHash + lap * 10007) >>> 0
  }

  /**
   * Recupera ou calcula os atributos de performance do carro.
   */
  private resolveCarPerformance(driver: CanonicalRaceDriverState) {
    const tech = carTechnicalService.getOrCreateTeamTechnicalData(driver.teamId)
    const chassis = tech.calculatedOverall || 75
    const puSupplier = tech.powerUnitContribution ? 'Ferrari' : 'Audi'
    const pu = OFFICIAL_POWER_UNITS[puSupplier] || OFFICIAL_POWER_UNITS.Ferrari
    const puRating = Number((pu.powerRating * 0.6 + pu.reliabilityRating * 0.4).toFixed(1))
    const carPerf = Number((chassis * 0.7 + puRating * 0.3).toFixed(1))
    const reliability = tech.attributes?.reliability ?? 80

    return {
      chassisRating: chassis,
      puRating,
      carPerf,
      reliability,
      technicalAttributes: tech.attributes,
    }
  }

  /**
   * Recupera ou deriva os atributos de piloto a partir de career_drivers ou base 2026.
   */
  private resolveDriverAttributes(driver: CanonicalRaceDriverState) {
    const careerDriver = driverBase2026Service.getCareerDriver(driver.careerId, driver.driverId)
    if (careerDriver) {
      return {
        speed: careerDriver.ratings.speed,
        consistency: careerDriver.ratings.consistency,
        racePace: careerDriver.ratings.racePace || careerDriver.ratings.speed,
        tireManagement: careerDriver.ratings.tireManagement || careerDriver.ratings.consistency,
        defense: careerDriver.ratings.defense,
        morale: careerDriver.morale ?? 85,
        physicalCondition: careerDriver.physicalCondition ?? 90,
      }
    }

    const baseDriver = driverBase2026Service.getBaseDriver2026(driver.driverId)
    if (baseDriver) {
      return {
        speed: baseDriver.speed,
        consistency: baseDriver.consistency,
        racePace: baseDriver.racePace || baseDriver.speed,
        tireManagement: baseDriver.tireManagement || baseDriver.consistency,
        defense: baseDriver.defense,
        morale: 85,
        physicalCondition: 90,
      }
    }

    // Fallback gracioso para pilotos criados dinamicamente
    return {
      speed: 80,
      consistency: 80,
      racePace: 80,
      tireManagement: 80,
      defense: 80,
      morale: 85,
      physicalCondition: 90,
    }
  }

  /**
   * Calcula o tempo de volta (lapTime) canônico de um piloto ativo.
   * Regra 3 & 4 da especificação:
   * - Consistência controla a VARIABILIDADE (dispersão menor para alta consistência).
   * - Piloto rápido + baixa consistência → grande potencial + oscilação alta.
   * - Circuito como referência central.
   * - Pneu, combustível e desgaste influenciam o pace.
   */
  public calculateCanonicalLapPace(params: {
    driver: CanonicalRaceDriverState
    lap: number
    weather: CanonicalRaceState['weather']
    round: number
    circuitName: string
    tireAbrasiveness?: number
    rng: () => number
  }): {
    lapTimeSec: number
    tireWearIncrement: number
    fuelBurnKg: number
    cliffReached: boolean
  } {
    const { driver, lap, weather, round, circuitName, tireAbrasiveness = 6, rng } = params

    const car = this.resolveCarPerformance(driver)
    const drv = this.resolveDriverAttributes(driver)

    // Perfil do circuito para calibrar tempo de referência
    // Base padrão de corrida na F1 (~82.0s) ajustada pelo round/circuito
    let baseCircuitSec = 82.0
    try {
      const circuitProfile = resolveCircuitProfile({ round, circuitName })
      // Ajuste proporcional ao tipo de pista e severidade do traçado
      const tyreSev = circuitProfile?.auxiliary?.tyreSeverity ?? 60
      const trackFactor = (tyreSev - 60) * 0.05
      baseCircuitSec = 82.0 + trackFactor
    } catch {
      baseCircuitSec = 82.0
    }

    // 1. Performance Base Combinada (70% Carro, 30% Piloto)
    // Piloto skill = racePace 50% + speed 35% + physical/morale 15%
    const driverSkill =
      drv.racePace * 0.5 +
      drv.speed * 0.35 +
      ((drv.morale - 80) * 0.08 + (drv.physicalCondition - 85) * 0.07)
    const combinedPerf = car.carPerf * 0.7 + driverSkill * 0.3

    // Delta de performance em relação a um carro perfeito (100)
    // Escala: ~0.080s por ponto de performance
    const performanceGapSec = (100 - combinedPerf) * 0.08

    // 2. Modulação por Consistência do Piloto
    // Alta consistência (ex: 95) => desvio padrão pequeno (~0.10s)
    // Baixa consistência (ex: 70) => desvio padrão grande (~0.55s)
    // Gerador Normal Box-Muller com rng determinístico
    const u1 = Math.max(0.00001, rng())
    const u2 = rng()
    const normalNoise = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)

    // Spread derivado da consistência: 100 = 0.08s; 70 = 0.53s
    const consistencyVariance = Math.max(0.08, (100 - drv.consistency) * 0.015)
    const controlledVarianceSec = normalNoise * consistencyVariance

    // 3. Modulação de Pneus
    const compound = driver.tyreCompound || 'medio'
    const spec = TIRE_SPECS[compound] || TIRE_SPECS.medio
    const compoundDeltaSec = spec.deltaPerLapSec

    // Idade do pneu e cliff
    const tyreAge = driver.tyreAge
    const cliff = calculateTireCliffStatus({
      compound,
      lapsOnTire: tyreAge,
      wearPercent: Math.min(100, Math.round(tyreAge * (spec.wearFactor * 0.85))),
      wearMultiplier: (100 - drv.tireManagement) * 0.005 + 0.95,
      trackAbrasiveness: tireAbrasiveness,
    })
    const cliffPenaltySec = cliff.extraLapTimeSec
    const linearWearPenaltySec = tyreAge * 0.045 // Desgaste progressivo sutil por volta

    // 4. Modulação de Combustível (efeito peso)
    // Cada 10kg a mais de combustível custa ~0.3s por volta
    const fuelEffectSec = (driver.fuel / 100.0) * 1.5

    // 5. Condição do Carro
    const damagePenaltySec = (100 - driver.carCondition) * 0.04

    // 6. Efeito da Largada (Volta 1)
    // Na primeira volta, o grid parte parado: tempo de reação + aceleração inicial
    // Carros no fundo do grid perdem tempo natural por estarem atrás na fila
    let startLapDelaySec = 0
    if (lap === 1) {
      // P1 tem partida livre; P24 tem atraso da fila do pelotão (~0.12s por posição de largada)
      const gridTrafficDelay = (driver.gridPosition - 1) * 0.12
      // Reação do piloto modulada por consistência e speed
      const reactionVariation = (rng() - 0.5) * 0.25
      startLapDelaySec = 3.5 + gridTrafficDelay + reactionVariation
    }

    const lapTotalSec =
      baseCircuitSec +
      performanceGapSec +
      compoundDeltaSec +
      linearWearPenaltySec +
      cliffPenaltySec +
      fuelEffectSec +
      damagePenaltySec +
      controlledVarianceSec +
      startLapDelaySec

    // Desgaste da volta
    const wearMultiplier = Math.max(0.75, Math.min(1.25, (100 - drv.tireManagement) * 0.006 + 0.85))
    const tireWearInc = Number(
      ((spec.wearFactor * 0.9 * wearMultiplier * (tireAbrasiveness / 5)) / 2).toFixed(1),
    )

    // Consumo de combustível: ~1.75 kg por volta em média (100kg / ~57 voltas)
    const fuelBurn = 1.75

    return {
      lapTimeSec: Number(Math.max(60.0, lapTotalSec).toFixed(3)),
      tireWearIncrement: Math.max(1, tireWearInc),
      fuelBurnKg: fuelBurn,
      cliffReached: !!cliff.isCliffReached,
    }
  }

  /**
   * Avalia probabilidade e ocorrência de DNF para um carro ativo nesta volta.
   * Derivado da confiabilidade da equipe/carro e condição mecânica.
   */
  public evaluateDnfRoll(params: {
    driver: CanonicalRaceDriverState
    lap: number
    rng: () => number
  }): { isDnf: boolean; reason?: string } {
    const { driver, rng } = params

    if (driver.raceStatus === 'dnf' || driver.isDnf) {
      return { isDnf: true, reason: driver.dnfReason }
    }

    const car = this.resolveCarPerformance(driver)
    const reliability = car.reliability ?? 80

    // Probabilidade base controlada por volta: ~0.15% para confiabilidade 90, até ~0.60% para 60
    const baseFailureRisk = Math.max(0.001, (100 - reliability) * 0.00015)
    // Se condição física do carro caiu, risco sobe
    const conditionRisk = (100 - driver.carCondition) * 0.0005
    const totalRisk = baseFailureRisk + conditionRisk

    const roll = rng()
    if (roll < totalRisk) {
      const reasons = [
        'Falha no Sistema de Potência (MGU-K)',
        'Vazamento Hidráulico Crítico',
        'Quebra de Transmissão / Câmbio',
        'Superaquecimento do Motor Turbo 2026',
        'Falha Elétrica de Controle (ECU)',
        'Perda de Pressão de Óleo',
      ]
      const reasonIdx = Math.floor(rng() * reasons.length)
      return {
        isDnf: true,
        reason: reasons[reasonIdx],
      }
    }

    return { isDnf: false }
  }

  /**
   * Avança UMA volta no estado canônico da corrida.
   * Modifica e retorna o estado de forma pura e imutável.
   */
  public advanceOneLap(
    currentState: CanonicalRaceState,
    options?: AdvanceRaceOptions,
  ): CanonicalRaceState {
    if (currentState.status === 'completed') {
      return currentState
    }

    const targetLap = currentState.currentLap
    const totalLaps = currentState.totalLaps

    // 1. Semente e gerador RNG determinístico centralizado
    const lapSeed = this.deriveLapSeed(currentState, targetLap, options?.seedOverride)
    const rng = this.createMulberry32(lapSeed)

    const nextEvents: EngineLapEvent[] = [...(currentState.events || [])]
    const timestampStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    // Garantir estado de Race Control inicial
    let rcState: RaceControlState = raceControlService.ensureRaceControlState(currentState)

    // Registrar largada se corrida estava not_started
    let nextStatus: CanonicalRaceStatus = currentState.status
    let startedAt = currentState.startedAt
    if (currentState.status === 'not_started') {
      nextStatus = 'running'
      startedAt = new Date().toISOString()
      rcState = {
        ...rcState,
        currentFlag: 'GREEN',
        previousFlag: undefined,
      }
      nextEvents.push({
        id: `ev_start_${targetLap}`,
        lap: 1,
        type: 'info',
        message: `🟢 LARGADA AUTORIZADA! 24 carros aceleram para o GP de ${currentState.circuitName}!`,
        timestamp: timestampStr,
      })
    }

    // Processar Override de Race Control para Testes/QA
    if (options?.forceRaceControlStatus) {
      const activeIds = currentState.drivers
        .filter((d) => d.raceStatus === 'racing')
        .sort((a, b) => a.currentPosition - b.currentPosition)
        .map((d) => d.driverId)

      const trans = raceControlService.transitionStatus(rcState, options.forceRaceControlStatus, {
        lap: targetLap,
        reason: 'Comando de QA / Direção de Prova',
        durationLaps: 3,
        driversOrder: activeIds,
      })
      rcState = trans.updatedRc
      trans.newEvents.forEach((ev) => {
        nextEvents.push({
          id: ev.id,
          lap: ev.lap,
          type: ev.type === 'restart' || ev.type === 'green_flag' ? 'info' : 'incident',
          message: ev.message,
          timestamp: ev.timestamp,
        })
      })
    }

    // Se estiver em RED FLAG ativa sem override de transição:
    // A corrida não progride competitivamente; raceTime congela, ordem congela, voltas congelam
    if (rcState.currentFlag === 'RED_FLAG' && !options?.forceRaceControlStatus) {
      rcState = {
        ...rcState,
        redFlagLaps: rcState.redFlagLaps + 1,
      }
      return {
        ...currentState,
        status: 'red_flag',
        redFlagActive: true,
        safetyCarActive: false,
        vscActive: false,
        raceControl: rcState,
        revision: currentState.revision + 1,
        updatedAt: new Date().toISOString(),
      }
    }

    // Se estiver em fase de relargada (RESTART): transiciona para GREEN nesta volta
    let isRestartingNow = false
    if (rcState.currentFlag === 'RESTART') {
      isRestartingNow = true
      const trans = raceControlService.transitionStatus(rcState, 'GREEN', {
        lap: targetLap,
        reason: 'Bandeira Verde — Relargada Autorizada!',
        customMessage: '🟢 BANDEIRA VERDE: Relargada autorizada! Pista livre e disputas liberadas!',
      })
      rcState = trans.updatedRc
      trans.newEvents.forEach((ev) => {
        nextEvents.push({
          id: ev.id,
          lap: ev.lap,
          type: 'info',
          message: ev.message,
          timestamp: ev.timestamp,
        })
      })
    }

    // Guardar ordem esportiva anterior para controle de ultrapassagens
    const prevOrder = [...currentState.drivers]
      .filter((d) => d.raceStatus === 'racing')
      .sort((a, b) => a.currentPosition - b.currentPosition)
      .map((d) => d.driverId)

    // Se acabou de entrar em Safety Car ou Red Flag e ainda não tinha congelado a ordem esportiva:
    if (
      (rcState.currentFlag === 'SAFETY_CAR' || rcState.currentFlag === 'RED_FLAG') &&
      (!rcState.scQueuedOrder || rcState.scQueuedOrder.length === 0)
    ) {
      rcState.scQueuedOrder = [...prevOrder]
    }

    // Contabilizar voltas na fase de neutralização atual
    if (rcState.currentFlag === 'SAFETY_CAR') {
      rcState.safetyCarLaps += 1
      if (rcState.lapsRemainingInPhase > 0) {
        rcState.lapsRemainingInPhase -= 1
        if (rcState.lapsRemainingInPhase === 0) {
          // Safety Car in this lap -> preparar relargada (RESTART)
          const trans = raceControlService.transitionStatus(rcState, 'RESTART', {
            lap: targetLap,
            reason: 'Safety Car recolhe nesta volta',
            customMessage: '🟢 SAFETY CAR IN THIS LAP: Bernd Mayländer recolhe para os boxes!',
          })
          rcState = trans.updatedRc
          trans.newEvents.forEach((ev) => {
            nextEvents.push({
              id: ev.id,
              lap: ev.lap,
              type: 'info',
              message: ev.message,
              timestamp: ev.timestamp,
            })
          })
        }
      }
    } else if (rcState.currentFlag === 'VSC') {
      rcState.vscLaps += 1
      if (rcState.lapsRemainingInPhase > 0) {
        rcState.lapsRemainingInPhase -= 1
        if (rcState.lapsRemainingInPhase === 0) {
          // Fim do VSC -> Retorno à Bandeira Verde
          const trans = raceControlService.transitionStatus(rcState, 'GREEN', {
            lap: targetLap,
            reason: 'Pista liberada após encerramento do VSC',
            customMessage: '🟢 VIRTUAL SAFETY CAR ENDING: Pista liberada! Bandeira verde acionada.',
          })
          rcState = trans.updatedRc
          trans.newEvents.forEach((ev) => {
            nextEvents.push({
              id: ev.id,
              lap: ev.lap,
              type: 'info',
              message: ev.message,
              timestamp: ev.timestamp,
            })
          })
        }
      }
    } else if (rcState.currentFlag === 'YELLOW_LOCAL' || rcState.currentFlag === 'YELLOW') {
      if (rcState.lapsRemainingInPhase > 0) {
        rcState.lapsRemainingInPhase -= 1
        if (rcState.lapsRemainingInPhase === 0) {
          // Fim da bandeira amarela -> Bandeira Verde
          const trans = raceControlService.transitionStatus(rcState, 'GREEN', {
            lap: targetLap,
            reason: 'Incidente solucionado',
            customMessage: '🟢 BANDEIRA VERDE: Traçado desimpedido! Ritmo normal restabelecido.',
          })
          rcState = trans.updatedRc
          trans.newEvents.forEach((ev) => {
            nextEvents.push({
              id: ev.id,
              lap: ev.lap,
              type: 'info',
              message: ev.message,
              timestamp: ev.timestamp,
            })
          })
        }
      }
    }

    // 2. Processar cada piloto para a volta
    const intermediateDrivers: CanonicalRaceDriverState[] = currentState.drivers.map((drv) => {
      // Se já estava em DNF ou terminado, mantém congelado
      if (drv.raceStatus === 'dnf' || drv.isDnf) {
        return { ...drv }
      }

      // Avaliar DNF nesta volta (ou força de incidente QA)
      let dnfCheck: { isDnf: boolean; reason?: string } = { isDnf: false }
      if (options?.forceIncident && options.forceIncident.type === 'dnf') {
        if (!options.forceIncident.driverId || options.forceIncident.driverId === drv.driverId) {
          dnfCheck = { isDnf: true, reason: 'Falha Crítica de Confiabilidade (Forçada por QA)' }
        }
      } else {
        dnfCheck = this.evaluateDnfRoll({ driver: drv, lap: targetLap, rng })
      }

      if (dnfCheck.isDnf) {
        nextEvents.push({
          id: `ev_dnf_${targetLap}_${drv.driverId}`,
          lap: targetLap,
          type: 'dnf',
          message: `🚨 ABANDONO: ${drv.driverName} (${drv.teamName}) — ${dnfCheck.reason}`,
          driverId: drv.driverId,
          driverName: drv.driverName,
          teamColor: drv.teamColor,
          timestamp: timestampStr,
        })

        // RESOLVER RACE CONTROL PARA ESTE DNF (Regras 12 e 13)
        // Nem todo DNF neutraliza a corrida
        const rcResponse = raceControlService.resolveRaceControlResponse(
          {
            type: 'dnf',
            driver: drv,
            reason: dnfCheck.reason,
            lap: targetLap,
            isSevereCrash: options?.forceIncident?.isSevere,
            trackBlocked: options?.forceIncident?.trackBlocked,
          },
          rng,
        )

        if (rcResponse && rcState.currentFlag === 'GREEN') {
          const trans = raceControlService.transitionStatus(rcState, rcResponse.targetStatus, {
            lap: targetLap,
            reason: rcResponse.reason,
            severity: rcResponse.severity,
            sector: rcResponse.sector,
            durationLaps: rcResponse.durationLaps,
            affectedDriverId: drv.driverId,
            affectedDriverName: drv.driverName,
            driversOrder: prevOrder,
            customMessage: rcResponse.message,
          })
          rcState = trans.updatedRc
          trans.newEvents.forEach((ev) => {
            nextEvents.push({
              id: ev.id,
              lap: ev.lap,
              type: 'incident',
              message: ev.message,
              timestamp: ev.timestamp,
            })
          })
        }

        return {
          ...drv,
          raceStatus: 'dnf',
          isDnf: true,
          dnfReason: dnfCheck.reason || 'Problema Mecânico',
          dnfLap: targetLap,
          gap: 'ABANDONO',
        }
      }

      // Modificadores de Pace, Consumo e Pneus de Race Control (Regra 1, 2, 3, 4, 5, 6)
      const rcMod = raceControlService.computeRaceControlPaceModifier({
        status: rcState.currentFlag,
        driver: drv,
        activeSector: rcState.activeSector,
      })

      // Calcular ritmo da volta base
      const pace = this.calculateCanonicalLapPace({
        driver: drv,
        lap: targetLap,
        weather: currentState.weather,
        round: currentState.round,
        circuitName: currentState.circuitName,
        tireAbrasiveness: options?.tireAbrasiveness ?? 6,
        rng,
      })

      const effectiveLapTime = Number((pace.lapTimeSec + rcMod.extraLapTimeSec).toFixed(3))
      const newAccumulatedTime = drv.raceTime + effectiveLapTime
      const newLapsCompleted = drv.lap + 1
      const newTyreAge = drv.tyreAge + 1
      const fuelBurnEffective = Number((pace.fuelBurnKg * rcMod.fuelBurnMultiplier).toFixed(2))
      const newFuel = Math.max(0, Number((drv.fuel - fuelBurnEffective).toFixed(1)))
      const newCondition = Math.max(0, Number((drv.carCondition - 0.25).toFixed(1)))

      // Atualizar melhor volta pessoal apenas em ritmo de bandeira verde
      const isGreenPace = rcState.currentFlag === 'GREEN'
      const bestLapSec =
        isGreenPace && (!drv.bestLapSec || effectiveLapTime < drv.bestLapSec)
          ? effectiveLapTime
          : drv.bestLapSec

      return {
        ...drv,
        lap: newLapsCompleted,
        raceTime: Number(newAccumulatedTime.toFixed(3)),
        lastLapTimeSec: effectiveLapTime,
        lastLapTimeFormatted: formatLapTime(effectiveLapTime),
        bestLapSec,
        bestLapFormatted: bestLapSec ? formatLapTime(bestLapSec) : undefined,
        tyreAge: newTyreAge,
        fuel: newFuel,
        carCondition: newCondition,
        raceStatus: 'racing',
      }
    })

    // 3. Ordenação Dinâmica e Preservação de Ordem Esportiva (Regras 4, 5, 6, 17):
    // Durante neutralizações (YELLOW, VSC, SAFETY_CAR, RESTART), ultrapassagens são estritamente
    // proibidas. Se a neutralização está ativa, a ordem esportiva é PRESERVADA rigorosamente
    // (carros não se ultrapassam por divergências numéricas de tempo).
    const activeDrivers = intermediateDrivers.filter((d) => d.raceStatus === 'racing')
    const dnfDrivers = intermediateDrivers.filter((d) => d.raceStatus === 'dnf')

    const isNeutralized =
      rcState.currentFlag === 'YELLOW' ||
      rcState.currentFlag === 'VSC' ||
      rcState.currentFlag === 'SAFETY_CAR' ||
      rcState.currentFlag === 'RESTART' ||
      rcState.currentFlag === 'YELLOW_LOCAL'

    if (isNeutralized) {
      // Ordenação esportiva preservada: mantém estritamente a posição da volta anterior
      // exceto por carros que abandonaram (DNF)
      activeDrivers.sort((a, b) => {
        const prevIdxA = prevOrder.indexOf(a.driverId)
        const prevIdxB = prevOrder.indexOf(b.driverId)
        if (prevIdxA !== -1 && prevIdxB !== -1) {
          return prevIdxA - prevIdxB
        }
        return a.currentPosition - b.currentPosition
      })

      // Se estiver sob Safety Car: agrupar progressivamente o pelotão
      if (rcState.currentFlag === 'SAFETY_CAR') {
        raceControlService.compressGapsUnderSafetyCar(activeDrivers, rcState.safetyCarLaps)
      } else if (rcState.currentFlag === 'VSC') {
        // No VSC: gaps são amplamente preservados (não convergem)
        // O raceTime de cada carro progride pelo delta uniforme
      }
    } else {
      // BANDEIRA VERDE: Ordenação pura por voltas completadas e menor raceTime real
      activeDrivers.sort((a, b) => {
        if (b.lap !== a.lap) return b.lap - a.lap
        return a.raceTime - b.raceTime
      })

      // Se acabou de relargar (RESTART -> GREEN), aplicar variações de largada
      if (isRestartingNow) {
        raceControlService.applyRestartVariations(activeDrivers, rng)
        activeDrivers.sort((a, b) => {
          if (b.lap !== a.lap) return b.lap - a.lap
          return a.raceTime - b.raceTime
        })
      }
    }

    // DNFs: quem completou mais voltas fica na frente; se mesma volta, quem teve menor tempo
    dnfDrivers.sort((a, b) => {
      if (b.lap !== a.lap) return b.lap - a.lap
      return a.raceTime - b.raceTime
    })

    // 4. Calcular Gaps Reais e Posições Únicas P1..P24
    const leaderTime = activeDrivers[0]?.raceTime || 0

    activeDrivers.forEach((driver, idx) => {
      const pos = idx + 1
      driver.currentPosition = pos

      if (pos === 1) {
        driver.gap = 'LÍDER'
        driver.gapToLeaderSec = 0
        driver.gapToFrontSec = 0
      } else {
        const gapLeader = Number((driver.raceTime - leaderTime).toFixed(3))
        const frontDriver = activeDrivers[idx - 1]
        const gapFront = Number((driver.raceTime - frontDriver.raceTime).toFixed(3))

        driver.gap = formatGap(gapLeader)
        driver.gapToLeaderSec = gapLeader
        driver.gapToFrontSec = gapFront
      }
    })

    dnfDrivers.forEach((driver, idx) => {
      driver.currentPosition = activeDrivers.length + idx + 1
      driver.gap = 'ABANDONO'
      driver.gapToLeaderSec = undefined
      driver.gapToFrontSec = undefined
    })

    const finalOrderedDrivers = [...activeDrivers, ...dnfDrivers]

    // 5. Detectar Ultrapassagens Orgânicas (Apenas quando ultrapassagens NÃO estão bloqueadas)
    if (!isNeutralized) {
      const newActiveOrder = activeDrivers.map((d) => d.driverId)
      for (let i = 0; i < newActiveOrder.length; i++) {
        const driverId = newActiveOrder[i]
        const oldIndex = prevOrder.indexOf(driverId)
        if (oldIndex !== -1 && oldIndex > i) {
          // O piloto avançou na classificação de pista
          const overtakenDriverId = prevOrder[i]
          const chasingDriver = finalOrderedDrivers.find((d) => d.driverId === driverId)
          const defendingDriver = finalOrderedDrivers.find((d) => d.driverId === overtakenDriverId)

          if (
            chasingDriver &&
            defendingDriver &&
            chasingDriver.driverId !== defendingDriver.driverId
          ) {
            // Registrar ultrapassagem no feed apenas se relevante (Top 10 ou equipe do jogador)
            if (chasingDriver.isPlayer || defendingDriver.isPlayer || i <= 5) {
              nextEvents.push({
                id: `ev_otk_${targetLap}_${chasingDriver.driverId}_${defendingDriver.driverId}`,
                lap: targetLap,
                type: 'overtake',
                message: `🟢 ULTRAPASSAGEM: ${chasingDriver.driverName} superou ${defendingDriver.driverName} e assumiu P${chasingDriver.currentPosition}!`,
                driverId: chasingDriver.driverId,
                driverName: chasingDriver.driverName,
                teamColor: chasingDriver.teamColor,
                timestamp: timestampStr,
              })
            }
          }
        }
      }
    }

    // 5.1 Avaliar Bandeira Azul (Blue Flag) - Regra 10
    const blueFlagAlerts = raceControlService.evaluateBlueFlags(finalOrderedDrivers, targetLap)
    if (blueFlagAlerts.length > 0) {
      blueFlagAlerts.forEach((bf) => {
        rcState.history.push(bf)
        nextEvents.push({
          id: bf.id,
          lap: bf.lap,
          type: 'info',
          message: bf.message,
          timestamp: bf.timestamp,
        })
      })
    }

    // 6. Atualizar Volta Mais Rápida da Corrida
    let currentFastest = currentState.fastestLap
    for (const d of activeDrivers) {
      if (d.lastLapTimeSec) {
        if (!currentFastest || d.lastLapTimeSec < currentFastest.lapTimeSec) {
          currentFastest = {
            driverId: d.driverId,
            driverName: d.driverName,
            lapTimeSec: d.lastLapTimeSec,
            lapTimeFormatted: d.lastLapTimeFormatted || formatLapTime(d.lastLapTimeSec),
            lap: targetLap,
          }
        }
      }
    }

    // 7. Checar Finalização da Prova (Regra 11 — Bandeira Quadriculada)
    // Quando o líder completa as voltas regulamentares (totalLaps):
    const leaderLaps = activeDrivers[0]?.lap || 0
    let completedAt = currentState.completedAt
    let isRaceFinished = false
    if (leaderLaps >= totalLaps) {
      nextStatus = 'completed'
      isRaceFinished = true
      completedAt = new Date().toISOString()

      rcState = {
        ...rcState,
        currentFlag: 'FINISHED',
        previousFlag: rcState.currentFlag,
        lapsRemainingInPhase: 0,
      }

      // Finalizar todos os demais pilotos ativos com raceStatus = 'finished'
      activeDrivers.forEach((d) => {
        d.raceStatus = 'finished'
      })

      const winner = activeDrivers[0]
      nextEvents.push({
        id: `ev_finish_${targetLap}`,
        lap: totalLaps,
        type: 'info',
        message: `🏁 BANDEIRA QUADRICULADA: GP concluído! Vitória memorável de ${winner?.driverName} (${winner?.teamName})!`,
        driverId: winner?.driverId,
        driverName: winner?.driverName,
        teamColor: winner?.teamColor,
        timestamp: timestampStr,
      })
    }

    // Montar mapa rápido de lookup
    const updatedLookup: Record<string, CanonicalRaceDriverState> = {}
    finalOrderedDrivers.forEach((d) => {
      updatedLookup[d.driverId] = d
    })

    // Mapear flags no nível raiz do CanonicalRaceState
    const isScActive = rcState.currentFlag === 'SAFETY_CAR' || rcState.currentFlag === 'RESTART'
    const isVscActive = rcState.currentFlag === 'VSC'
    const isRedActive = rcState.currentFlag === 'RED_FLAG'

    const updatedState: CanonicalRaceState = {
      ...currentState,
      currentLap: Math.min(totalLaps, targetLap + (isRaceFinished ? 0 : 1)),
      status: isRaceFinished
        ? 'completed'
        : isRedActive
          ? 'red_flag'
          : isScActive
            ? 'safety_car'
            : isVscActive
              ? 'virtual_safety_car'
              : nextStatus,
      safetyCarActive: isScActive,
      vscActive: isVscActive,
      redFlagActive: isRedActive,
      startedAt,
      completedAt,
      drivers: finalOrderedDrivers,
      driverLookup: updatedLookup,
      events: nextEvents.slice(-60), // Guarda os 60 eventos mais recentes
      fastestLap: currentFastest,
      raceSeed: lapSeed,
      raceControl: rcState,
      revision: currentState.revision + 1,
      updatedAt: new Date().toISOString(),
    }

    // Validar invariantes obrigatórias
    this.assertRaceInvariants(updatedState)

    // Persistir estado atualizado
    canonicalRaceInitializationService.saveCanonicalRaceState(updatedState)

    return updatedState
  }

  /**
   * Avança múltiplas voltas de uma vez no estado canônico da corrida.
   */
  public advanceMultipleLaps(
    currentState: CanonicalRaceState,
    lapsToAdvance: number,
    options?: AdvanceRaceOptions,
  ): CanonicalRaceState {
    let state = currentState
    const laps = Math.max(1, Math.min(lapsToAdvance, currentState.totalLaps))

    for (let i = 0; i < laps; i++) {
      if (state.status === 'completed') {
        break
      }
      state = this.advanceOneLap(state, options)
    }

    return state
  }

  /**
   * INVARIANTES OBRIGATÓRIAS (Asserções):
   * 1. Exatamente 24 pilotos
   * 2. Exatamente 24 driverIds únicos sem duplicatas
   * 3. Posições currentPosition P1..P24 estritamente contínuas
   * 4. gridPosition nunca muda (imutável)
   * 5. lap nunca diminui
   * 6. raceTime nunca diminui
   * 7. tyreAge nunca diminui sem pit stop
   * 8. combustível não aumenta espontaneamente
   * 9. DNF não volta para RUNNING/racing
   */
  public assertRaceInvariants(state: CanonicalRaceState): void {
    if (!state || !Array.isArray(state.drivers)) {
      throw new Error('[FW2.1E-B Invariant] Estado da corrida ou drivers inválidos.')
    }

    if (state.drivers.length !== 24) {
      throw new Error(
        `[FW2.1E-B Invariant] Quantidade de pilotos violada: esperado 24, encontrado ${state.drivers.length}`,
      )
    }

    const seenIds = new Set<string>()
    const seenPositions = new Set<number>()

    for (let i = 0; i < state.drivers.length; i++) {
      const d = state.drivers[i]

      // 1. Unicidade de driverId
      if (seenIds.has(d.driverId)) {
        throw new Error(`[FW2.1E-B Invariant] driverId duplicado detectado: ${d.driverId}`)
      }
      seenIds.add(d.driverId)

      // 2. Continuidade de currentPosition P1..P24
      if (d.currentPosition < 1 || d.currentPosition > 24) {
        throw new Error(
          `[FW2.1E-B Invariant] Posição fora do intervalo 1-24: P${d.currentPosition} para ${d.driverId}`,
        )
      }
      if (seenPositions.has(d.currentPosition)) {
        throw new Error(
          `[FW2.1E-B Invariant] Posição duplicada detectada: P${d.currentPosition} para ${d.driverId}`,
        )
      }
      seenPositions.add(d.currentPosition)

      // 3. gridPosition válida
      if (d.gridPosition < 1 || d.gridPosition > 24) {
        throw new Error(
          `[FW2.1E-B Invariant] gridPosition corrompida: ${d.gridPosition} para ${d.driverId}`,
        )
      }

      // 4. Combustível não-negativo
      if (d.fuel < 0) {
        throw new Error(
          `[FW2.1E-B Invariant] Combustível negativo para ${d.driverId}: ${d.fuel} kg`,
        )
      }

      // 5. Consistência DNF
      if (d.raceStatus === 'dnf' && !d.isDnf) {
        throw new Error(`[FW2.1E-B Invariant] Inconsistência de flag DNF para piloto ${d.driverId}`)
      }
    }
  }
}

export const canonicalRaceEngineService = new CanonicalRaceEngineService()
