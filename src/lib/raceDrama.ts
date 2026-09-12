/**
 * Módulo de Drama de Corrida (F1 2026 - Rodada B)
 * Arquivo 100% autocontido, sem dependência direta do motor gigante RaceSlim.
 *
 * Contém tipos e funções puras para:
 * 1. Ordens de Equipe (Team Orders) entre pilotos do jogador
 * 2. Quebras Mecânicas & Incidentes escalados por desgaste de peças/tática
 * 3. Bandeira Vermelha (Red Flag)
 * 4. Penalidades FIA e aplicação na classificação final
 * 5. Constantes narrativas de rádio e feed da corrida em pt-BR
 */

// ==========================================
// 1. TIPOS
// ==========================================

export interface TeamOrderState {
  fastDriverId: string
  slowDriverId: string
  lapsPushed: number
  active: boolean
  cooldownLaps: number
  refused: boolean
  resolved?: boolean
}

export type MechanicalIssueType = 'motor' | 'gearbox' | 'hydraulics' | 'crash'
export type MechanicalIssueSeverity = 'light' | 'grave'

export interface MechanicalIssue {
  driverId: string
  type: MechanicalIssueType
  severity: MechanicalIssueSeverity
  lapsAffected: number
  description: string
  pacePenaltySec: number
  isDnf: boolean
}

export interface RedFlagState {
  active: boolean
  ticksFrozen: number
  usedThisRace: boolean
  safetyCarLapsRemaining: number
}

export type FiaPenaltyKind = '5s' | '10s' | 'stop_and_go'

export interface FiaPenalty {
  id: string
  driverId: string
  kind: FiaPenaltyKind
  reason: string
  served: boolean
  lapIssued: number
  timePenaltySec: number // 5, 10 ou 10 (stop_and_go)
}

export interface DriverDramaContext {
  id: string
  name: string
  teamId?: string
  isPlayer?: boolean
  gap?: number // Gap para o carro à frente em segundos (ou gap geral)
  gapToLeader?: number
  position?: number
  morale?: number // 0-100
  personality?: string // 'agressiva', 'egoísta', 'frio', 'equipe', etc.
  hasWingDamage?: boolean
  tacticalMode?: 'attack' | 'normal' | 'save_fuel'
  paceOrder?: 'segurar' | 'normal' | 'empurrar'
  carPartsHealth?: { id?: string; name: string; condition: number }[]
  dnf?: boolean
}

export interface RaceDramaEvent {
  type: 'team_order' | 'mechanical' | 'red_flag' | 'fia_penalty'
  message: string
  driverId?: string
  lap: number
  severity?: 'info' | 'warning' | 'danger'
}

export interface FinalResultWithPenalties {
  driverId: string
  driverName?: string
  position: number
  accumulatedTimeSec?: number
  totalTimeSec?: number
  totalTime?: string
  lapsCompleted?: number
  dnf?: boolean
  dnfReason?: string
  dnfLap?: number
  timePenaltySec?: number
  appliedPenalties?: FiaPenalty[]
  [key: string]: any
}

// ==========================================
// 6. NARRATIVAS (PT-BR)
// ==========================================

export const DRAMA_NARRATIVES = {
  // Ordens de Equipe
  RADIO_FAST_DRIVER_REQUEST: (fastName: string) =>
    `📻 ${fastName}: Ele está me segurando, posso passar...`,
  RADIO_PIT_ORDER_SLOW: (slowName: string, fastName: string) =>
    `📻 Box para ${slowName}: deixe ${fastName} passar, ordem de equipe`,
  RADIO_SLOW_DRIVER_REFUSED: (slowName: string) =>
    `📻 ${slowName}: Não vou ceder, ele precisa me ganhar na pista`,
  RADIO_SLOW_DRIVER_ACCEPTED: (slowName: string) =>
    `📻 ${slowName}: Entendido box, abrindo espaço na reta principal...`,
  FEED_TEAM_ORDER_SWAP: (fastName: string, slowName: string) =>
    `🔄 ORDEM DE EQUIPE: ${slowName} cede a posição para ${fastName}!`,

  // Quebras Mecânicas & Batidas
  ENGINE_EXPLODED: '💨 MOTOR EXPLODIU',
  ENGINE_LIGHT_ISSUE: '⚠️ Perda intermitente de potência no motor',
  GEARBOX_FAILURE: '⚙️ Câmbio travado na 4ª marcha',
  HYDRAULICS_ISSUE: '💧 Perda progressiva de pressão hidráulica',
  CRASH_GRAVE: '💥 BATEU FORTE',
  CRASH_LIGHT: '💥 Toque de corrida — asa dianteira danificada',

  // Bandeira Vermelha
  RED_FLAG_SUSPENDED: '🟥 BANDEIRA VERMELHA — Corrida suspensa',
  RED_FLAG_RESTART: '🟡 CORRIDA REINICIADA — Procedimento atrás do Safety Car por 2 voltas',

  // Penalidades FIA
  FIA_STOP_AND_GO: (driverName: string) => `⚖️ FIA: ${driverName}, stop & go obrigatório`,
  FIA_INVESTIGATION_5S: (driverName: string) => `⚖️ Investigação FIA: ${driverName} — decisão: 5s`,
  FIA_INVESTIGATION_10S: (driverName: string) =>
    `⚖️ Investigação FIA: ${driverName} — decisão: 10s`,
} as const

// ==========================================
// 2. ORDENS DE EQUIPE (TEAM ORDERS)
// ==========================================

export interface TeamOrderProposal {
  fastDriverId: string
  fastDriverName: string
  slowDriverId: string
  slowDriverName: string
  gap: number
  lapsPushed: number
}

/**
 * Avalia se existe proposta de ordem de equipe viável.
 * Condições: 2 carros do jogador na pista (sem DNF), carro de trás com gap < 1,5s
 * para o companheiro à frente por 2+ voltas consecutivas, respeitando cooldown de 5 voltas.
 *
 * Conexão: Chamado a cada tick/volta na simulação de corrida.
 */
export function avaliarTeamOrder(
  playerDrivers: DriverDramaContext[],
  currentLap: number,
  previousState?: TeamOrderState | null,
): TeamOrderProposal | null {
  const activeDrivers = playerDrivers.filter((d) => !d.dnf)
  if (activeDrivers.length < 2) return null

  // Se já há ordem de equipe ativa ou em cooldown de 5 voltas
  if (previousState && previousState.cooldownLaps > 0) {
    return null
  }

  // Ordena por posição na pista (P menor = à frente)
  const sorted = [...activeDrivers].sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
  const ahead = sorted[0]
  const behind = sorted[1]

  // Gap entre eles: usar gap do carro de trás ou calcular via gapToLeader se disponível
  let gapBetween = 999
  if (typeof behind.gap === 'number' && behind.gap > 0 && behind.gap < 10) {
    gapBetween = behind.gap
  } else if (typeof behind.gapToLeader === 'number' && typeof ahead.gapToLeader === 'number') {
    gapBetween = Math.max(0, behind.gapToLeader - ahead.gapToLeader)
  }

  // Se o de trás está colado (< 1,5s)
  if (gapBetween <= 1.5) {
    const currentLapsPushed = (previousState?.lapsPushed || 0) + 1
    if (currentLapsPushed >= 2) {
      return {
        fastDriverId: behind.id,
        fastDriverName: behind.name,
        slowDriverId: ahead.id,
        slowDriverName: ahead.name,
        gap: gapBetween,
        lapsPushed: currentLapsPushed,
      }
    }
  }

  return null
}

export interface ApplyTeamOrderResult {
  state: TeamOrderState
  refused: boolean
  accepted: boolean
  swapExecuted: boolean
  moraleDelta: number // Delta aplicado no piloto mais lento (-5 se aceitou)
  paceModifierSec: number // Ritmo ganho pelo rápido / cedido pelo lento (+0,8s por 2 voltas)
  radioMessage: string
  feedMessage?: string
}

/**
 * Aplica ou resolve a ordem de equipe dada pelo jogador/equipe.
 * - Recusa (30% de chance): se moral < 40 ou traços 'agressiva' / 'egoísta'.
 * - Aceitação: moral -5 no cedido, +0,8s de ritmo por 2 voltas para o piloto que ultrapassa,
 *   e troca efetiva de posição quando gap < 0,4s.
 *
 * Conexão: Chamado quando o jogador aciona o botão de ordem de equipe ou no tick de resolução.
 */
export function aplicarTeamOrder(
  currentState: TeamOrderState,
  slowDriver: DriverDramaContext,
  fastDriverName = 'Companheiro',
  gapCurrent = 0.8,
  randomRoll = Math.random(),
): ApplyTeamOrderResult {
  const isLowMorale = (slowDriver.morale ?? 70) < 40
  const personality = (slowDriver.personality || '').toLowerCase()
  const isSelfishOrAggressive =
    personality.includes('agressiv') ||
    personality.includes('egoíst') ||
    personality.includes('egoist')

  // 30% de chance de recusa se moral baixa ou personalidade difícil
  const shouldCheckRefusal = isLowMorale || isSelfishOrAggressive
  const isRefused = shouldCheckRefusal && randomRoll < 0.3

  if (isRefused) {
    return {
      state: {
        ...currentState,
        active: false,
        refused: true,
        cooldownLaps: 5,
        resolved: true,
      },
      refused: true,
      accepted: false,
      swapExecuted: false,
      moraleDelta: 0,
      paceModifierSec: 0,
      radioMessage: DRAMA_NARRATIVES.RADIO_SLOW_DRIVER_REFUSED(slowDriver.name),
    }
  }

  // Aceitação
  const swapExecuted = gapCurrent <= 0.4
  return {
    state: {
      ...currentState,
      active: !swapExecuted,
      refused: false,
      cooldownLaps: swapExecuted ? 5 : currentState.cooldownLaps,
      resolved: swapExecuted,
    },
    refused: false,
    accepted: true,
    swapExecuted,
    moraleDelta: -5,
    paceModifierSec: 0.8,
    radioMessage: DRAMA_NARRATIVES.RADIO_SLOW_DRIVER_ACCEPTED(slowDriver.name),
    feedMessage: swapExecuted
      ? DRAMA_NARRATIVES.FEED_TEAM_ORDER_SWAP(fastDriverName, slowDriver.name)
      : undefined,
  }
}

// ==========================================
// 3. QUEBRAS MECÂNICAS & INCIDENTES
// ==========================================

export interface MechanicalRollResult {
  issues: MechanicalIssue[]
  newDnfs: { driverId: string; reason: string; driverName: string }[]
  radioAlerts: string[]
}

/**
 * Rola falhas mecânicas e batidas a cada volta.
 * - Chance escalada por desgaste de peças (carPartsHealth): peça a 0% gera 15% de chance de falha grave/volta.
 * - Motor: grave = DNF "💨 MOTOR EXPLODIU"; leve = perda de +0,5 a +1,2s de ritmo.
 * - Câmbio: travado por 3 voltas (+1,5s ritmo) ou DNF se condição crítica.
 * - Hidráulica: degradação progressiva de +0,3s/volta.
 * - Batida forte: probabilidade amplificada sob 'empurrar', chuva ou asa quebrada.
 *   Grave = DNF "💥 BATEU FORTE"; leve = asa dianteira danificada.
 *
 * Conexão: Chamado no início do loop da volta para todos os pilotos em pista.
 */
export function rollMechanicalFailures(
  drivers: DriverDramaContext[],
  lap: number,
  options?: {
    isWet?: boolean
    randomSource?: () => number
  },
): MechanicalRollResult {
  const rand = options?.randomSource || Math.random
  const isWet = Boolean(options?.isWet)
  const issues: MechanicalIssue[] = []
  const newDnfs: { driverId: string; reason: string; driverName: string }[] = []
  const radioAlerts: string[] = []

  drivers.forEach((driver) => {
    if (driver.dnf) return

    // Calcula integridade média e mínima das peças
    const parts = driver.carPartsHealth || []
    let minCondition = 100
    let motorCondition = 100
    let gearboxCondition = 100
    let hydraulicsCondition = 100

    parts.forEach((p) => {
      const c = typeof p.condition === 'number' ? p.condition : 100
      if (c < minCondition) minCondition = c
      const pName = (p.name || '').toLowerCase()
      if (pName.includes('motor') || pName.includes('power unit') || pName.includes('pu')) {
        motorCondition = c
      } else if (
        pName.includes('câmbio') ||
        pName.includes('cambio') ||
        pName.includes('gearbox')
      ) {
        gearboxCondition = c
      } else if (pName.includes('hidrául') || pName.includes('hidraul')) {
        hydraulicsCondition = c
      }
    })

    const isPushing = driver.paceOrder === 'empurrar' || driver.tacticalMode === 'attack'
    const riskMultiplier =
      (isPushing ? 1.6 : 1.0) * (isWet ? 1.8 : 1.0) * (driver.hasWingDamage ? 1.5 : 1.0)

    // 1. Falha por peça a 0%: 15% de chance de quebra grave por volta
    if (minCondition <= 0 && rand() < 0.15) {
      newDnfs.push({
        driverId: driver.id,
        driverName: driver.name,
        reason: DRAMA_NARRATIVES.ENGINE_EXPLODED,
      })
      issues.push({
        driverId: driver.id,
        type: 'motor',
        severity: 'grave',
        lapsAffected: 999,
        description: DRAMA_NARRATIVES.ENGINE_EXPLODED,
        pacePenaltySec: 99,
        isDnf: true,
      })
      radioAlerts.push(`💥 ${driver.name}: DNF por falha estrutural completa de componente!`)
      return
    }

    // 2. Motor roll (probabilidade natural 0.25% base, até 12% se condição baixa)
    const motorRisk = (motorCondition < 30 ? (30 - motorCondition) * 0.003 : 0.002) * riskMultiplier
    if (rand() < motorRisk) {
      const isGrave = motorCondition < 15 || rand() < 0.35
      if (isGrave) {
        newDnfs.push({
          driverId: driver.id,
          driverName: driver.name,
          reason: DRAMA_NARRATIVES.ENGINE_EXPLODED,
        })
        issues.push({
          driverId: driver.id,
          type: 'motor',
          severity: 'grave',
          lapsAffected: 999,
          description: DRAMA_NARRATIVES.ENGINE_EXPLODED,
          pacePenaltySec: 99,
          isDnf: true,
        })
        radioAlerts.push(`💨 ${driver.name}: ${DRAMA_NARRATIVES.ENGINE_EXPLODED}`)
        return
      } else {
        const pacePenalty = 0.5 + rand() * 0.7 // +0,5 a +1,2s
        issues.push({
          driverId: driver.id,
          type: 'motor',
          severity: 'light',
          lapsAffected: 3,
          description: DRAMA_NARRATIVES.ENGINE_LIGHT_ISSUE,
          pacePenaltySec: Number(pacePenalty.toFixed(2)),
          isDnf: false,
        })
        radioAlerts.push(
          `⚠️ ${driver.name}: ${DRAMA_NARRATIVES.ENGINE_LIGHT_ISSUE} (+${pacePenalty.toFixed(1)}s/v)`,
        )
      }
    }

    // 3. Câmbio roll
    const gearboxRisk = (gearboxCondition < 25 ? 0.04 : 0.0015) * riskMultiplier
    if (rand() < gearboxRisk) {
      const isGrave = gearboxCondition < 10 && rand() < 0.4
      if (isGrave) {
        newDnfs.push({
          driverId: driver.id,
          driverName: driver.name,
          reason: '⚙️ Câmbio quebrado — DNF',
        })
        issues.push({
          driverId: driver.id,
          type: 'gearbox',
          severity: 'grave',
          lapsAffected: 999,
          description: '⚙️ Câmbio totalmente destruído',
          pacePenaltySec: 99,
          isDnf: true,
        })
        return
      } else {
        issues.push({
          driverId: driver.id,
          type: 'gearbox',
          severity: 'light',
          lapsAffected: 3,
          description: DRAMA_NARRATIVES.GEARBOX_FAILURE,
          pacePenaltySec: 1.5,
          isDnf: false,
        })
      }
    }

    // 4. Hidráulica roll
    const hydraulicsRisk = (hydraulicsCondition < 20 ? 0.03 : 0.001) * riskMultiplier
    if (rand() < hydraulicsRisk) {
      issues.push({
        driverId: driver.id,
        type: 'hydraulics',
        severity: 'light',
        lapsAffected: 5,
        description: DRAMA_NARRATIVES.HYDRAULICS_ISSUE,
        pacePenaltySec: 0.3, // Degradação progressiva
        isDnf: false,
      })
    }

    // 5. Batida (Crash) — chance maior sob empurrar / chuva / dano de asa
    const baseCrashRisk = 0.002
    const totalCrashRisk = baseCrashRisk * riskMultiplier
    if (rand() < totalCrashRisk) {
      const isGrave = rand() < (isWet ? 0.55 : 0.4)
      if (isGrave) {
        newDnfs.push({
          driverId: driver.id,
          driverName: driver.name,
          reason: DRAMA_NARRATIVES.CRASH_GRAVE,
        })
        issues.push({
          driverId: driver.id,
          type: 'crash',
          severity: 'grave',
          lapsAffected: 999,
          description: DRAMA_NARRATIVES.CRASH_GRAVE,
          pacePenaltySec: 99,
          isDnf: true,
        })
        radioAlerts.push(`💥 ${driver.name}: ${DRAMA_NARRATIVES.CRASH_GRAVE}`)
      } else {
        issues.push({
          driverId: driver.id,
          type: 'crash',
          severity: 'light',
          lapsAffected: 99,
          description: DRAMA_NARRATIVES.CRASH_LIGHT,
          pacePenaltySec: 1.2,
          isDnf: false,
        })
        radioAlerts.push(`⚠️ ${driver.name}: ${DRAMA_NARRATIVES.CRASH_LIGHT}`)
      }
    }
  })

  return { issues, newDnfs, radioAlerts }
}

// ==========================================
// 4. BANDEIRA VERMELHA (RED FLAG)
// ==========================================

export interface RedFlagTriggerResult {
  triggered: boolean
  state: RedFlagState
  message?: string
}

/**
 * Avalia se deve acionar Bandeira Vermelha.
 * Condições:
 * - Novos DNFs causados por batida forte ('BATEU FORTE') ou quebra grave bloqueando a pista.
 * - Máximo de 1 bandeira vermelha por GP (redFlagUsed === true bloqueia novas ativações).
 * - Quando acionada: ticksFrozen configurado para pausa, retomada atrás do safety car por 2 voltas.
 *
 * Conexão: Chamado imediatamente após o processamento de acidentes da volta.
 */
export function shouldTriggerRedFlag(
  novosDnfs: { reason: string }[],
  currentState: RedFlagState,
): RedFlagTriggerResult {
  if (currentState.usedThisRace) {
    return { triggered: false, state: currentState }
  }

  const hasSevereCrashOrBlock = novosDnfs.some(
    (d) =>
      d.reason.includes('BATEU FORTE') ||
      d.reason.includes('CRASH') ||
      d.reason.includes('EXPLODIU') ||
      d.reason.includes('bloqueando'),
  )

  if (hasSevereCrashOrBlock) {
    return {
      triggered: true,
      state: {
        active: true,
        ticksFrozen: 3, // Pausa da suspensão
        usedThisRace: true,
        safetyCarLapsRemaining: 2, // 2 voltas de retomada atrás do Safety Car
      },
      message: DRAMA_NARRATIVES.RED_FLAG_SUSPENDED,
    }
  }

  return { triggered: false, state: currentState }
}

// ==========================================
// 5. PENALIDADES FIA
// ==========================================

export interface IncidentEventInput {
  driverId: string
  driverName: string
  kind: 'collision_light' | 'chicane_cut' | 'collision_fatal' | 'repeat_offense'
  isPushing?: boolean
  otherDriverDnf?: boolean
}

/**
 * Avalia incidentes da volta e gera penalidades FIA oficiais:
 * - 5s: colisão leve ou corte de chicane sob ordem 'empurrar'
 * - 10s: colisão que provoca abandono (DNF) de outro piloto
 * - stop_and_go: piloto reincidente (+10s efetivo + parada obrigatória na volta seguinte)
 *
 * Conexão: Chamado ao final de cada volta sobre o rol de incidentes.
 */
export function evaluateFiaIncidents(
  events: IncidentEventInput[],
  currentLap: number,
  existingPenalties: FiaPenalty[] = [],
): { newPenalties: FiaPenalty[]; narrativeEvents: string[] } {
  const newPenalties: FiaPenalty[] = []
  const narrativeEvents: string[] = []

  events.forEach((ev) => {
    const priorCount = existingPenalties.filter((p) => p.driverId === ev.driverId).length

    // Reincidente ou ordem expressa de stop and go
    if (ev.kind === 'repeat_offense' || priorCount >= 2) {
      const penalty: FiaPenalty = {
        id: `fia_${ev.driverId}_${currentLap}_sg`,
        driverId: ev.driverId,
        kind: 'stop_and_go',
        reason: 'Reincidência de conduta antidesportiva em pista',
        served: false,
        lapIssued: currentLap,
        timePenaltySec: 10,
      }
      newPenalties.push(penalty)
      narrativeEvents.push(DRAMA_NARRATIVES.FIA_STOP_AND_GO(ev.driverName))
      return
    }

    // Colisão que gerou DNF do adversário: 10s
    if (ev.kind === 'collision_fatal' || ev.otherDriverDnf) {
      const penalty: FiaPenalty = {
        id: `fia_${ev.driverId}_${currentLap}_10s`,
        driverId: ev.driverId,
        kind: '10s',
        reason: 'Causar colisão com abandono de adversário',
        served: false,
        lapIssued: currentLap,
        timePenaltySec: 10,
      }
      newPenalties.push(penalty)
      narrativeEvents.push(DRAMA_NARRATIVES.FIA_INVESTIGATION_10S(ev.driverName))
      return
    }

    // Colisão leve ou corte de chicane (especialmente ao empurrar): 5s
    if (ev.kind === 'collision_light' || ev.kind === 'chicane_cut') {
      const penalty: FiaPenalty = {
        id: `fia_${ev.driverId}_${currentLap}_5s`,
        driverId: ev.driverId,
        kind: '5s',
        reason:
          ev.kind === 'chicane_cut' ? 'Corte de chicane e ganho de vantagem' : 'Toque evitável',
        served: false,
        lapIssued: currentLap,
        timePenaltySec: 5,
      }
      newPenalties.push(penalty)
      narrativeEvents.push(DRAMA_NARRATIVES.FIA_INVESTIGATION_5S(ev.driverName))
    }
  })

  return { newPenalties, narrativeEvents }
}

/**
 * Converte string de tempo ("1:24:10.500" ou "+12.4s") ou segundos para valor numérico puro.
 */
function parseTimeToSeconds(timeStr?: string, fallback = 5400): number {
  if (!timeStr) return fallback
  if (timeStr.includes(':')) {
    const parts = timeStr.split(':')
    if (parts.length === 3) {
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
    }
    if (parts.length === 2) {
      return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
    }
  }
  const clean = timeStr.replace(/[^\d.-]/g, '')
  const val = parseFloat(clean)
  return isNaN(val) ? fallback : val
}

/**
 * Formata segundos em formato legível de corrida ("1:24:15.500" ou "+5.2s").
 */
function formatSecondsToDisplay(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = (sec % 60).toFixed(3)
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${parseFloat(s) < 10 ? '0' : ''}${s}`
  }
  return `${m}:${parseFloat(s) < 10 ? '0' : ''}${s}`
}

/**
 * Aplica penalidades não pagas aos resultados finais da corrida:
 * Soma timePenaltySec ao tempo final do piloto e reordena posições de acordo.
 *
 * Conexão: Chamado na homologação do resultado no final do GP.
 */
export function applyPenaltiesToResults<T extends FinalResultWithPenalties>(
  results: T[],
  penalties: FiaPenalty[] = [],
  totalRaceLaps = 50,
): T[] {
  if (!results || results.length === 0) return []

  // Agrupa penalidades não cumpridas por piloto
  const unservedPenaltiesMap: Record<string, FiaPenalty[]> = {}
  penalties.forEach((p) => {
    if (!p.served) {
      if (!unservedPenaltiesMap[p.driverId]) {
        unservedPenaltiesMap[p.driverId] = []
      }
      unservedPenaltiesMap[p.driverId].push(p)
    }
  })

  // Calcula tempo total efetivo para cada piloto ativo usando accumulatedTimeSec real
  const modified = results.map((entry) => {
    const driverPenalties = unservedPenaltiesMap[entry.driverId] || []
    const penaltySum = driverPenalties.reduce((acc, p) => acc + (p.timePenaltySec || 0), 0)

    if (entry.dnf) {
      return {
        ...entry,
        timePenaltySec: penaltySum,
        appliedPenalties: driverPenalties,
      }
    }

    const baseSec =
      typeof entry.accumulatedTimeSec === 'number'
        ? entry.accumulatedTimeSec
        : typeof entry.totalTimeSec === 'number'
          ? entry.totalTimeSec
          : parseTimeToSeconds(entry.totalTime, 0)

    const finalSec = Number((baseSec + penaltySum).toFixed(3))

    return {
      ...entry,
      accumulatedTimeSec: finalSec,
      totalTimeSec: finalSec,
      timePenaltySec: penaltySum,
      appliedPenalties: driverPenalties,
    }
  })

  // Reordena:
  // 1. Não-DNFs ordenados primeiramente por voltas completadas DESC (se disponíveis),
  //    e depois por accumulatedTimeSec ASC
  // 2. DNFs ordenados por dnfLap DESC, depois position ASC
  const finishedDrivers = modified.filter((d) => !d.dnf)
  const dnfDrivers = modified.filter((d) => d.dnf)

  finishedDrivers.sort((a, b) => {
    const lapsA = typeof a.lapsCompleted === 'number' ? a.lapsCompleted : totalRaceLaps
    const lapsB = typeof b.lapsCompleted === 'number' ? b.lapsCompleted : totalRaceLaps
    if (lapsB !== lapsA) {
      return lapsB - lapsA
    }
    return (a.accumulatedTimeSec || 0) - (b.accumulatedTimeSec || 0)
  })

  dnfDrivers.sort((a, b) => {
    const lapA = a.dnfLap ?? 0
    const lapB = b.dnfLap ?? 0
    if (lapB !== lapA) {
      return lapB - lapA
    }
    return (a.position || 0) - (b.position || 0)
  })

  const reordered: T[] = [
    ...finishedDrivers.map((d, idx) => ({ ...d, position: idx + 1 })),
    ...dnfDrivers.map((d, idx) => ({
      ...d,
      position: finishedDrivers.length + idx + 1,
    })),
  ]

  return reordered
}
