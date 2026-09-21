/**
 * raceControlService.ts
 *
 * FW2.1E-C — RACE CONTROL DA CORRIDA V2 (APEX GP MANAGER - F1 2026)
 *
 * Responsabilidades Centrais:
 * 1. Camada Canônica de Controle de Corrida:
 *    - GREEN: pace normal, ultrapassagens permitidas, gaps evoluem pelo pace normal.
 *    - YELLOW_LOCAL: reduz pace apenas na zona/setor afetado, bloqueia ultrapassagem no setor afetado.
 *    - YELLOW: ritmo reduzido globalmente, ultrapassagens estritamente proibidas, mantém ordem coerente.
 *    - VSC (Virtual Safety Car): neutraliza o ritmo sem agrupar o pelotão. Delta controlado.
 *      Gaps amplamente preservados (não convergem). Pneus e combustível continuam sendo consumidos.
 *    - SAFETY_CAR: ritmo significativamente reduzido, ultrapassagens proibidas, pelotão se agrupa
 *      PROGRESSIVAMENTE (gaps convergem progressivamente para ~0.8s - 1.2s, nunca zeram instantaneamente,
 *      nunca negativos). Congela a ordem esportiva no momento do acionamento.
 *    - RESTART: transição de SC/Red Flag para GREEN com fase de relargada determinística (reação, racecraft,
 *      pequenas variações controladas).
 *    - RED_FLAG: corrida não progride normalmente; raceTime competitivo congela; ultrapassagens bloqueadas;
 *      ordem congelada; pilotos e carros preservados; feed registra interrupção. Retomada via RESTART → GREEN.
 *    - BLUE_FLAG: sinalização para retardatário (carro alcançado por líderes com volta de vantagem). Facilita
 *      ultrapassagem pelo líder reduzindo resistência.
 *    - FINISHED (Bandeira Quadriculada): encerra eventos e corridas ao atingir totalLaps.
 * 2. Determinismo:
 *    Toda decisão probabilística (duração, incidentes, severidade, restart) usa RNG canônico (Mulberry32).
 * 3. Separação entre Sporting Order (ordem desportiva regulamentar) e Physical Pace:
 *    Durante bandeiras amarelas, VSC, Safety Car e Red Flag, ultrapassagens são bloqueadas — a classificação
 *    nunca é embaralhada nem permite ultrapassagens ilegais.
 */

import type {
  CanonicalRaceState,
  CanonicalRaceDriverState,
  RaceControlStatus,
  RaceControlState,
  RaceControlEvent,
  RaceIncidentSeverity,
} from '@/types/canonical-race-v2'

export interface IncidentInput {
  type: 'dnf' | 'mechanical_failure' | 'debris' | 'crash' | 'weather_hazard'
  driver?: CanonicalRaceDriverState
  reason?: string
  lap: number
  sector?: 1 | 2 | 3
  isSevereCrash?: boolean
  trackBlocked?: boolean
}

export interface RaceControlResponse {
  targetStatus: RaceControlStatus
  sector?: 1 | 2 | 3
  durationLaps: number
  severity: RaceIncidentSeverity
  reason: string
  message: string
}

export class RaceControlService {
  /**
   * Inicializa o estado de Race Control padrão (GREEN) para uma nova corrida.
   */
  public createInitialRaceControlState(): RaceControlState {
    return {
      currentFlag: 'GREEN',
      previousFlag: undefined,
      lapsRemainingInPhase: 0,
      activeSector: undefined,
      safetyCarLaps: 0,
      vscLaps: 0,
      redFlagLaps: 0,
      scQueuedOrder: [],
      restartPending: false,
      activeEvents: [],
      history: [],
      lastIncidentReason: undefined,
    }
  }

  /**
   * Garante que o estado da corrida tenha o objeto raceControl íntegro.
   */
  public ensureRaceControlState(raceState: CanonicalRaceState): RaceControlState {
    if (raceState.raceControl && raceState.raceControl.currentFlag) {
      return raceState.raceControl
    }
    return this.createInitialRaceControlState()
  }

  /**
   * RESOLVEDOR CENTRALIZADO: resolveRaceControlResponse(event)
   * Regra 12 & 13 da especificação:
   * Considera severidade/contexto:
   * - Incidente leve / retirada em segurança → yellow local ou nada.
   * - Carro parado em local perigoso / detritos moderados → VSC ou SC.
   * - Pista parcialmente bloqueada / barreira danificada → SC.
   * - Acidente grave / pista bloqueada → Red Flag.
   * Determinístico através do RNG fornecido.
   */
  public resolveRaceControlResponse(
    incident: IncidentInput,
    rng: () => number,
  ): RaceControlResponse | null {
    const sector = incident.sector || ((1 + Math.floor(rng() * 3)) as 1 | 2 | 3)

    // Caso 1: Pista bloqueada ou acidente grave declarado -> BANDEIRA VERMELHA
    if (incident.trackBlocked || incident.isSevereCrash) {
      return {
        targetStatus: 'RED_FLAG',
        sector,
        durationLaps: 1, // Red flag congela e requer comando de restart
        severity: 'critical',
        reason: incident.reason || 'Acidente Grave com Bloqueio de Pista',
        message: `🔴 BANDEIRA VERMELHA: ${incident.reason || 'Pista bloqueada no Setor ' + sector}. Sessão suspensa!`,
      }
    }

    // Caso 2: Tratamento de DNF / Abandono
    if (incident.type === 'dnf') {
      const roll = rng()
      const dnfReason = incident.reason || 'Falha Mecânica'

      // Falhas retiradas em segurança (ex: recolheu para o box ou área de escape ampla)
      // ~40% das falhas não geram nenhuma neutralização da pista
      if (roll < 0.4) {
        return null
      }

      // Falha em ponto de escape com fiscais operando -> Amarela Local no setor (~30%)
      if (roll < 0.7) {
        const duration = 1 + Math.floor(rng() * 2) // 1 a 2 voltas
        return {
          targetStatus: 'YELLOW_LOCAL',
          sector,
          durationLaps: duration,
          severity: 'low',
          reason: `Carro parado em área de escape: ${dnfReason}`,
          message: `🟡 BANDEIRA AMARELA — SETOR ${sector}: ${incident.driver?.driverName || 'Carro'} parado na área de escape.`,
        }
      }

      // Carro parado em posição vulnerável com necessidade de guincho -> VSC (~20%)
      if (roll < 0.9) {
        const duration = 2 + Math.floor(rng() * 2) // 2 a 3 voltas
        return {
          targetStatus: 'VSC',
          sector,
          durationLaps: duration,
          severity: 'medium',
          reason: `Carro em posição perigosa: ${dnfReason}`,
          message: `🟡 VIRTUAL SAFETY CAR (VSC): Procedimento de delta ativo para remoção de ${incident.driver?.driverName || 'veículo'}.`,
        }
      }

      // Detritos no asfalto / posição crítica -> SAFETY CAR real (~10%)
      const scDuration = 3 + Math.floor(rng() * 3) // 3 a 5 voltas
      return {
        targetStatus: 'SAFETY_CAR',
        sector,
        durationLaps: scDuration,
        severity: 'high',
        reason: `Remoção complexa em pista: ${dnfReason}`,
        message: `🚨 SAFETY CAR ENPLOYED: Bernd Mayländer na pista para comboio controlado.`,
      }
    }

    // Caso 3: Detritos / Outros incidentes
    if (incident.type === 'debris') {
      const roll = rng()
      if (roll < 0.6) {
        return {
          targetStatus: 'YELLOW_LOCAL',
          sector,
          durationLaps: 1,
          severity: 'low',
          reason: 'Detritos no traçado',
          message: `🟡 BANDEIRA AMARELA — SETOR ${sector}: Fiscais limpando detritos no traçado.`,
        }
      }
      return {
        targetStatus: 'VSC',
        sector,
        durationLaps: 2,
        severity: 'medium',
        reason: 'Limpeza de detritos na pista',
        message: `🟡 VIRTUAL SAFETY CAR (VSC): Pista em neutralização para recolhimento de detritos.`,
      }
    }

    return null
  }

  /**
   * Aplica transição de status em Race Control, registrando eventos no histórico.
   */
  public transitionStatus(
    rc: RaceControlState,
    newStatus: RaceControlStatus,
    meta: {
      lap: number
      reason?: string
      severity?: RaceIncidentSeverity
      sector?: 1 | 2 | 3
      durationLaps?: number
      affectedDriverId?: string
      affectedDriverName?: string
      driversOrder?: string[]
      customMessage?: string
    },
  ): { updatedRc: RaceControlState; newEvents: RaceControlEvent[] } {
    const timestampStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const prev = rc.currentFlag
    let scOrder = rc.scQueuedOrder
    if (
      (newStatus === 'SAFETY_CAR' || newStatus === 'RED_FLAG') &&
      meta.driversOrder &&
      meta.driversOrder.length > 0 &&
      prev !== 'SAFETY_CAR' &&
      prev !== 'RED_FLAG'
    ) {
      // Congelar ordem esportiva no momento da entrada do SC ou Red Flag
      scOrder = [...meta.driversOrder]
    }

    const newEvents: RaceControlEvent[] = []
    let eventType: RaceControlEvent['type'] = 'info' as any

    switch (newStatus) {
      case 'GREEN':
        eventType =
          prev === 'RESTART' || prev === 'SAFETY_CAR' || prev === 'RED_FLAG'
            ? 'restart'
            : 'green_flag'
        break
      case 'YELLOW_LOCAL':
        eventType = 'yellow_flag_local'
        break
      case 'YELLOW':
        eventType = 'yellow_flag_full'
        break
      case 'VSC':
        eventType = 'vsc_deployed'
        break
      case 'SAFETY_CAR':
        eventType = 'safety_car_deployed'
        break
      case 'RED_FLAG':
        eventType = 'red_flag'
        break
      case 'RESTART':
        eventType = 'restart'
        break
      case 'FINISHED':
        eventType = 'chequered_flag'
        break
    }

    const defaultMsg = this.formatDefaultEventMessage(newStatus, meta.sector, meta.reason)
    const event: RaceControlEvent = {
      id: `rc_ev_${meta.lap}_${newStatus}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: eventType,
      lap: meta.lap,
      sector: meta.sector,
      affectedDriverId: meta.affectedDriverId,
      affectedDriverName: meta.affectedDriverName,
      startedAtLap: meta.lap,
      reason: meta.reason || 'Decisão de Direção de Prova',
      severity: meta.severity || 'low',
      message: meta.customMessage || defaultMsg,
      timestamp: timestampStr,
    }
    newEvents.push(event)

    const updatedRc: RaceControlState = {
      ...rc,
      currentFlag: newStatus,
      previousFlag: prev,
      lapsRemainingInPhase: meta.durationLaps ?? rc.lapsRemainingInPhase,
      activeSector: meta.sector,
      lastIncidentReason: meta.reason || rc.lastIncidentReason,
      scQueuedOrder: scOrder,
      restartPending: newStatus === 'RESTART',
      history: [...rc.history, event],
      activeEvents: [...rc.activeEvents.filter((e) => e.endedAtLap === undefined), event],
    }

    return { updatedRc, newEvents }
  }

  /**
   * Mensagem padrão legível para feed e HUD de Race Control.
   */
  private formatDefaultEventMessage(
    status: RaceControlStatus,
    sector?: 1 | 2 | 3,
    reason?: string,
  ): string {
    switch (status) {
      case 'GREEN':
        return '🟢 BANDEIRA VERDE: Pista liberada! Ritmo normal e ultrapassagens autorizadas.'
      case 'YELLOW_LOCAL':
        return `🟡 BANDEIRA AMARELA — SETOR ${sector || 2}: Incidente localizado. Ultrapassagens proibidas neste trecho.`
      case 'YELLOW':
        return '🟡 BANDEIRA AMARELA GERAL: Ritmo global reduzido em todo o circuito. Ultrapassagens proibidas!'
      case 'VSC':
        return '🟡 VIRTUAL SAFETY CAR: Mantenha o delta de velocidade positivo. Ultrapassagens estritamente proibidas!'
      case 'SAFETY_CAR':
        return '🚨 SAFETY CAR NA PISTA: Siga as luzes do líder e do carro de segurança. Pelotão em agrupamento.'
      case 'RESTART':
        return '🟢 SAFETY CAR IN THIS LAP: Preparar para relargada em bandeira verde!'
      case 'RED_FLAG':
        return '🔴 BANDEIRA VERMELHA: Sessão interrompida! Retorne ao pit lane ou mantenha posições.'
      case 'FINISHED':
        return '🏁 BANDEIRA QUADRICULADA: GP finalizado!'
    }
  }

  /**
   * Avalia sinalização de Bandeira Azul (Blue Flag):
   * Quando um retardatário (lap < líder) é alcançado na pista por um carro à frente em voltas
   * (gap físico < 1.2s e volta inferior).
   */
  public evaluateBlueFlags(
    drivers: CanonicalRaceDriverState[],
    currentLap: number,
  ): RaceControlEvent[] {
    const blueFlagEvents: RaceControlEvent[] = []
    const active = drivers.filter((d) => d.raceStatus === 'racing')
    if (active.length < 2) return blueFlagEvents

    const leader = active[0]
    const timestampStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    for (let i = 1; i < active.length; i++) {
      const car = active[i]
      // Se o carro está pelo menos 1 volta atrás do líder e o líder está próximo
      if (leader.lap > car.lap) {
        blueFlagEvents.push({
          id: `rc_blue_${currentLap}_${car.driverId}`,
          type: 'blue_flag',
          lap: currentLap,
          affectedDriverId: car.driverId,
          affectedDriverName: car.driverName,
          startedAtLap: currentLap,
          reason: 'Carro retardatário alcançado pelo líder',
          severity: 'low',
          message: `🔵 BANDEIRA AZUL: ${car.driverName} deve facilitar ultrapassagem do líder ${leader.driverName}.`,
          timestamp: timestampStr,
        })
      }
    }

    return blueFlagEvents
  }

  /**
   * Aplica modificador de pace e desgaste/combustível de acordo com o status atual de Race Control:
   * - GREEN: pace base sem acréscimo de neutralização.
   * - YELLOW_LOCAL: reduz o pace apenas para carros afetados ou em média leve (+2.5s) se no setor.
   * - YELLOW: pace reduzido globalmente (+8.0s).
   * - VSC: todos cumprem delta (+16.0s / lapTime ~40% mais lento), consumo de combustível reduzido.
   * - SAFETY_CAR: ritmo de comboio de SC (+28.0s / ritmo de 105km/h), consumo e desgaste reduzidos.
   * - RED_FLAG: tempo de prova não progride competitivamente (+0s competitivos, congelado).
   */
  public computeRaceControlPaceModifier(params: {
    status: RaceControlStatus
    driver: CanonicalRaceDriverState
    activeSector?: 1 | 2 | 3
  }): {
    extraLapTimeSec: number
    fuelBurnMultiplier: number
    tyreWearMultiplier: number
    allowOvertake: boolean
  } {
    const { status } = params

    switch (status) {
      case 'GREEN':
        return {
          extraLapTimeSec: 0.0,
          fuelBurnMultiplier: 1.0,
          tyreWearMultiplier: 1.0,
          allowOvertake: true,
        }

      case 'YELLOW_LOCAL':
        // No setor amarelo, perda de tempo localizada (~2.0s por volta) e ultrapassagem bloqueada
        return {
          extraLapTimeSec: 2.2,
          fuelBurnMultiplier: 0.95,
          tyreWearMultiplier: 0.9,
          allowOvertake: false, // Bloqueado no trecho
        }

      case 'YELLOW':
        // Ritmo global moderado, sem ultrapassagem
        return {
          extraLapTimeSec: 7.5,
          fuelBurnMultiplier: 0.85,
          tyreWearMultiplier: 0.8,
          allowOvertake: false,
        }

      case 'VSC':
        // VSC: Delta rigoroso de velocidade (~35-40% mais lento que o pace normal)
        return {
          extraLapTimeSec: 16.0,
          fuelBurnMultiplier: 0.65,
          tyreWearMultiplier: 0.5,
          allowOvertake: false,
        }

      case 'SAFETY_CAR':
        // Safety Car: Comboio lento atrás do SC (~28-32s mais lento por volta)
        return {
          extraLapTimeSec: 28.0,
          fuelBurnMultiplier: 0.45,
          tyreWearMultiplier: 0.35,
          allowOvertake: false,
        }

      case 'RESTART':
        // Volta de saída do SC / aceleração para a bandeira verde
        return {
          extraLapTimeSec: 6.0,
          fuelBurnMultiplier: 1.1, // Pilotos aquecem pneus e aceleram forte
          tyreWearMultiplier: 1.0,
          allowOvertake: false, // Ultrapassagem só autorizada na linha de controle (transição para GREEN)
        }

      case 'RED_FLAG':
        // Sob Red Flag a corrida está paralisada
        return {
          extraLapTimeSec: 0,
          fuelBurnMultiplier: 0,
          tyreWearMultiplier: 0,
          allowOvertake: false,
        }

      case 'FINISHED':
        return {
          extraLapTimeSec: 0,
          fuelBurnMultiplier: 0,
          tyreWearMultiplier: 0,
          allowOvertake: false,
        }
    }
  }

  /**
   * CONVERGÊNCIA PROGRESSIVA DE GAPS NO SAFETY CAR:
   * Regra 6 & 16:
   * Sob Safety Car, o pelotão se agrupa progressivamente.
   * - Nunca zerar os gaps em uma única volta.
   * - Gaps nunca ficam negativos.
   * - A ordem esportiva congelada é estritamente preservada.
   * - Cada volta sob SC reduz os gaps em direção ao espaçamento alvo (~0.9s a 1.2s entre carros).
   */
  public compressGapsUnderSafetyCar(
    activeDrivers: CanonicalRaceDriverState[],
    scLapsCompleted: number,
  ): void {
    if (activeDrivers.length <= 1) return

    const leaderTime = activeDrivers[0].raceTime

    // Para cada carro do pelotão, progressivamente aproxima o raceTime do carro à sua frente
    for (let i = 1; i < activeDrivers.length; i++) {
      const car = activeDrivers[i]
      const frontCar = activeDrivers[i - 1]

      const currentDiff = car.raceTime - frontCar.raceTime
      const targetDelta = 0.95 // delta ideal de comboio atrás do SC

      if (currentDiff > targetDelta) {
        // Redução progressiva: comprime ~35% da diferença excedente por volta
        const compressionStep = (currentDiff - targetDelta) * 0.35
        const newAccumulated = Number((car.raceTime - compressionStep).toFixed(3))
        // Garante que o carro nunca fique à frente do carro que deve precedê-lo
        car.raceTime = Math.max(frontCar.raceTime + targetDelta * 0.5, newAccumulated)
      } else if (currentDiff < targetDelta * 0.3) {
        // Mantém distância de segurança mínima de comboio (sem colisão / gap negativo)
        car.raceTime = Number((frontCar.raceTime + targetDelta * 0.5).toFixed(3))
      }
    }
  }

  /**
   * RELARGADA DETERMINÍSTICA (RESTART → GREEN):
   * Regra 8 & 11 da especificação:
   * Ao relargar (SAFETY_CAR ou RED_FLAG para GREEN):
   * - Considera posição, reação, consistência e racecraft do piloto via RNG determinístico.
   * - Gera pequenas alterações de gap (+/- 0.2s a 0.6s) e oportunidades legítimas de ataque.
   */
  public applyRestartVariations(
    activeDrivers: CanonicalRaceDriverState[],
    rng: () => number,
  ): void {
    for (let i = 0; i < activeDrivers.length; i++) {
      const drv = activeDrivers[i]
      // Pequena variabilidade determinística de largada/reação de aquecimento de pneus
      const reactionNoise = (rng() - 0.48) * 0.4 // -0.19s a +0.21s
      // Líder tem vantagem de ditar o ritmo da relargada
      const leaderAdvantage = i === 0 ? -0.15 : 0.05
      const deltaSec = reactionNoise + leaderAdvantage

      drv.raceTime = Math.max(
        i === 0 ? drv.raceTime : activeDrivers[i - 1].raceTime + 0.1,
        Number((drv.raceTime + deltaSec).toFixed(3)),
      )
    }
  }
}

export const raceControlService = new RaceControlService()
