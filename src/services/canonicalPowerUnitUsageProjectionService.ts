/**
 * canonicalPowerUnitUsageProjectionService.ts
 *
 * TAREFA PU-05A2-P3-A: Materializar projeção de uso de cada unidade de potência (PU)
 * por participante a partir da sessão de corrida, pronta para FUTURA persistência no inventário.
 *
 * REGRAS DO CONTRATO:
 * 1. PARTIR DOS DADOS REAIS DA SESSÃO:
 *    - Consome o estado canônico (CanonicalRaceState) recebido.
 *    - NÃO consulta a montagem atual da garagem para identificar a unidade usada.
 *    - Unidade usada é lida exclusivamente dos participantes da sessão (CanonicalRaceDriverState).
 *
 * 2. SAÍDA DA APURAÇÃO:
 *    - Para cada participante com vínculo válido:
 *      * Identidade canônica da sessão (careerId, season, round, raceVariant, raceId, sessionKey).
 *      * Equipe e participante (teamId, driverId, driverName, carId/carIndex, isPlayer).
 *      * powerUnitId registrado na sessão.
 *      * Quilometragem efetivamente reconhecida (km).
 *      * Condição inicial (0-100) e condição final corrente (0-100 se disponível) ou débito de desgaste.
 *      * Status de cobertura / desgaste pendente quando o modelo corrente não registrar evolução individual.
 *
 * 3. QUILOMETRAGEM CORRETA:
 *    - Baseada na participação efetiva de cada carro (lapsCompleted).
 *    - NÃO calcular totalLaps * circuitLengthKm para todos.
 *    - Carro sem voltas completadas válidas -> 0 km.
 *    - DNF mantém o uso ocorrido antes do abandono (suas voltas completadas).
 *    - Unidade não utilizada não recebe uso de outra.
 *    - circuitLengthKm resolvido canonicamente do estado ou calendário F1 2026.
 *
 * 4. DESGASTE: NÃO INVENTAR NEM DUPLICAR:
 *    - Se houver powerUnitCondition (corrente) e powerUnitInitialCondition, apura o desgaste real (initial - current).
 *    - Se powerUnitCondition não estiver presente (ex: o motor de corrida V2 atualiza carCondition - 0.25/volta
 *      mas ainda não mantém powerUnitCondition dinâmico por volta para a sessão), identificar EXATAMENTE
 *      a informação faltante e marcar wearDebitStatus: 'PENDING_ENGINE_SESSION_EVOLUTION', sem inventar fórmula.
 *
 * 5. FUNÇÃO PURA SEM EFEITOS COLATERAIS:
 *    - Não modifica o CanonicalRaceState recebido.
 *    - Não grava no banco, localStorage ou inventário.
 *    - Idempotente e determinística.
 */

import type {
  CanonicalRaceState,
  CanonicalRaceDriverState,
  RaceVariant,
} from '@/types/canonical-race-v2'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { selectParticipantPowerUnitCondition } from '@/services/canonicalPowerUnitConditionSelector'

/**
 * Status da apuração de desgaste para a unidade do participante.
 */
export type PowerUnitWearDebitStatus =
  | 'RECOGNIZED' // Condição final corrente registrada na sessão; desgaste apurado com precisão
  | 'ZERO_WEAR' // Não houve evolução ou voltas completadas; débito zero
  | 'PENDING_ENGINE_SESSION_EVOLUTION' // Sessão possui vínculo mas powerUnitCondition não foi evoluído pelo engine na sessão
  | 'LEGACY_UNLINKED' // Participante não possui vínculo de unidade física individual (sessão legada / rival não instrumentado)

/**
 * Registro de projeção de uso de PU para um participante.
 */
export interface ParticipantPowerUnitUsageProjection {
  // Identidade da sessão
  careerId: string
  season: number
  round: number
  raceVariant: RaceVariant
  raceId: string
  sessionKey: string

  // Identidade do competidor
  teamId: string
  teamName: string
  driverId: string
  driverName: string
  isPlayer: boolean
  carId?: 'car1' | 'car2'
  carIndex?: 1 | 2

  // Vínculo da Unidade de Potência
  hasValidLinkage: boolean
  powerUnitId?: number

  // Distância reconhecida
  lapsCompleted: number
  circuitLengthKm: number
  distanceKm: number

  // Condição e Desgaste
  initialCondition?: number | null
  finalCondition?: number | null
  wearDebit?: number | null
  wearDebitStatus: PowerUnitWearDebitStatus
  pendingReason?: string
}

/**
 * Resumo global da projeção de uso de uma sessão de corrida.
 */
export interface SessionPowerUnitUsageProjectionReport {
  careerId: string
  season: number
  round: number
  raceVariant: RaceVariant
  raceId: string
  sessionKey: string
  circuitName: string
  circuitLengthKm: number
  totalLapsScheduled: number
  sessionStatus: string

  // Participantes avaliados
  totalParticipants: number
  linkedParticipantsCount: number
  unlinkedParticipantsCount: number

  // Projeções individuais
  projections: ParticipantPowerUnitUsageProjection[]

  // Sumário de pendências de dados
  unlinkedDriverIds: string[]
  pendingWearDriverIds: string[]
}

/**
 * Helper puro para resolver a extensão do circuito em km a partir do estado ou calendário F1 2026.
 */
export function resolveSessionCircuitLengthKm(state: CanonicalRaceState): number {
  if (
    typeof state.circuitLengthKm === 'number' &&
    Number.isFinite(state.circuitLengthKm) &&
    state.circuitLengthKm > 0
  ) {
    return state.circuitLengthKm
  }

  if (typeof state.round === 'number' && state.round > 0) {
    const foundByRound = F1_2026_CALENDAR.find((gp) => gp.round === state.round)
    if (foundByRound?.circuitLengthKm) {
      return foundByRound.circuitLengthKm
    }
  }

  if (state.circuitName) {
    const lower = state.circuitName.toLowerCase()
    const foundByName = F1_2026_CALENDAR.find(
      (gp) =>
        gp.circuit.toLowerCase().includes(lower) ||
        gp.name.toLowerCase().includes(lower) ||
        lower.includes(gp.circuit.toLowerCase()) ||
        lower.includes(gp.name.toLowerCase()) ||
        (lower.includes('interlagos') &&
          (gp.circuit.toLowerCase().includes('interlagos') ||
            gp.name.toLowerCase().includes('são paulo') ||
            gp.name.toLowerCase().includes('brasil'))),
    )
    if (foundByName?.circuitLengthKm) {
      return foundByName.circuitLengthKm
    }
  }

  // Extensão de segurança caso circuito não esteja no calendário oficial
  return 5.0
}

/**
 * Constrói chave única e determinística para a sessão, diferenciando Sprint e Corrida Principal.
 */
export function buildCanonicalSessionKey(
  careerId: string,
  season: number,
  round: number,
  raceVariant: RaceVariant = 'MAIN_RACE',
): string {
  const variantSlug = raceVariant === 'SPRINT_RACE' ? 'sprint' : 'main'
  return `${careerId}_s${season}_r${round}_${variantSlug}`
}

/**
 * Função Pura de Apuração: Projeta o uso e desgaste de cada Unidade de Potência a partir do estado da corrida.
 *
 * @param state Estado canônico da corrida (CanonicalRaceState). Não é mutado.
 * @returns Relatório estruturado com as projeções por participante.
 */
export function projectSessionPowerUnitUsage(
  state: CanonicalRaceState,
): SessionPowerUnitUsageProjectionReport {
  if (!state) {
    throw new Error('[projectSessionPowerUnitUsage] CanonicalRaceState nulo ou indefinido.')
  }

  const careerId = state.careerId || 'unknown_career'
  const season = typeof state.season === 'number' ? state.season : 2026
  const round = typeof state.round === 'number' ? state.round : 1
  const raceVariant: RaceVariant = state.raceVariant || 'MAIN_RACE'
  const raceId = state.raceId || `race_${careerId}_s${season}_r${round}`
  const sessionKey = buildCanonicalSessionKey(careerId, season, round, raceVariant)
  const circuitLengthKm = resolveSessionCircuitLengthKm(state)
  const totalLapsScheduled = state.totalLaps || 0
  const sessionStatus = state.status || 'unknown'

  const drivers: CanonicalRaceDriverState[] = Array.isArray(state.drivers) ? state.drivers : []
  const projections: ParticipantPowerUnitUsageProjection[] = []
  const unlinkedDriverIds: string[] = []
  const pendingWearDriverIds: string[] = []

  let linkedParticipantsCount = 0
  let unlinkedParticipantsCount = 0

  for (const driver of drivers) {
    // 1. Apuração de Vínculo de PU
    const hasPuId =
      typeof driver.powerUnitId === 'number' &&
      Number.isInteger(driver.powerUnitId) &&
      driver.powerUnitId > 0

    let initialCondition: number | null = null
    let finalCondition: number | null = null
    let wearDebit: number | null = null
    let wearDebitStatus: PowerUnitWearDebitStatus = 'LEGACY_UNLINKED'
    let pendingReason: string | undefined

    if (hasPuId) {
      linkedParticipantsCount++

      // Usar seletor canônico para obter a condição da sessão de forma estrita
      const selection = selectParticipantPowerUnitCondition(driver)
      initialCondition =
        typeof driver.powerUnitInitialCondition === 'number'
          ? driver.powerUnitInitialCondition
          : selection.condition

      // Avaliação de condição final corrente
      if (typeof driver.powerUnitCondition === 'number') {
        finalCondition = driver.powerUnitCondition
        // Se a condição corrente está disponível, calculamos o débito exato
        if (typeof initialCondition === 'number') {
          wearDebit = Number(Math.max(0, initialCondition - finalCondition).toFixed(2))
          wearDebitStatus = wearDebit === 0 ? 'ZERO_WEAR' : 'RECOGNIZED'
        } else {
          wearDebit = null
          wearDebitStatus = 'PENDING_ENGINE_SESSION_EVOLUTION'
          pendingReason =
            'powerUnitInitialCondition ausente no participante com powerUnitCondition.'
          pendingWearDriverIds.push(driver.driverId)
        }
      } else {
        // powerUnitCondition ainda não é atualizado a cada volta no canonicalRaceEngineService.
        // O motor atualiza `carCondition` (-0.25/volta), mas não grava `powerUnitCondition`.
        // Declaramos explicitamente como pendência do motor da sessão, SEM inventar débito nem fabricar números.
        finalCondition = null
        wearDebit = null
        wearDebitStatus = 'PENDING_ENGINE_SESSION_EVOLUTION'
        pendingReason =
          'powerUnitCondition não foi evoluído pelo motor de corrida durante esta sessão. A apuração de desgaste requer implementação da evolução da PU em sessão.'
        pendingWearDriverIds.push(driver.driverId)
      }
    } else {
      unlinkedParticipantsCount++
      unlinkedDriverIds.push(driver.driverId)
      wearDebitStatus = 'LEGACY_UNLINKED'
      pendingReason =
        'Participante sem powerUnitId associado no estado da corrida (sessão legada ou rival sem instrumento individual).'
    }

    // 2. Apuração da Quilometragem Efetivamente Reconhecida
    // drv.lap no CanonicalRaceDriverState representa voltas completadas (ex: largada = 0, volta 1 completada = 1).
    // Carro sem voltas completadas -> 0 km.
    // DNF mantém as voltas completadas registradas antes do abandono.
    const lapsCompleted = typeof driver.lap === 'number' && driver.lap > 0 ? driver.lap : 0
    const distanceKm = Number((lapsCompleted * circuitLengthKm).toFixed(3))

    projections.push({
      careerId,
      season,
      round,
      raceVariant,
      raceId,
      sessionKey,
      teamId: driver.teamId,
      teamName: driver.teamName || 'Unknown Team',
      driverId: driver.driverId,
      driverName: driver.driverName || 'Unknown Driver',
      isPlayer: Boolean(driver.isPlayer),
      carId: driver.carId,
      carIndex: driver.carIndex,
      hasValidLinkage: hasPuId,
      powerUnitId: hasPuId ? driver.powerUnitId : undefined,
      lapsCompleted,
      circuitLengthKm,
      distanceKm,
      initialCondition,
      finalCondition,
      wearDebit,
      wearDebitStatus,
      pendingReason,
    })
  }

  return {
    careerId,
    season,
    round,
    raceVariant,
    raceId,
    sessionKey,
    circuitName: state.circuitName || 'Grand Prix Circuit',
    circuitLengthKm,
    totalLapsScheduled,
    sessionStatus,
    totalParticipants: drivers.length,
    linkedParticipantsCount,
    unlinkedParticipantsCount,
    projections,
    unlinkedDriverIds,
    pendingWearDriverIds,
  }
}
