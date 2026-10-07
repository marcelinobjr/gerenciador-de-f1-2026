import { QualifyingStageId, CANONICAL_QUALIFYING_RULES } from '@/types/canonical-qualifying-types'
import type { QualifyingDriverContext } from '@/services/canonicalQualifyingRunner'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'

export type QualifyingPrerequisiteReason =
  | 'missing_stage_result'
  | 'invalid_advancing_count'
  | 'duplicate_or_invalid_driver_ids'

export class QualifyingPrerequisiteError extends Error {
  readonly stageId: QualifyingStageId
  readonly parentStageId: QualifyingStageId
  readonly reason: QualifyingPrerequisiteReason

  constructor(
    stageId: QualifyingStageId,
    parentStageId: QualifyingStageId,
    reason: QualifyingPrerequisiteReason,
    message?: string,
  ) {
    const defaultMessage = `Falha de pré-requisito para qualificação na fase '${stageId}' (fase anterior: '${parentStageId}'): ${reason}`
    super(message || defaultMessage)
    this.name = 'QualifyingPrerequisiteError'
    this.stageId = stageId
    this.parentStageId = parentStageId
    this.reason = reason
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

const parentStageMap: Record<Exclude<QualifyingStageId, 'q1' | 'sq1'>, QualifyingStageId> = {
  q2: 'q1',
  q3: 'q2',
  sq2: 'sq1',
  sq3: 'sq2',
}

export interface ResolveQualifyingParticipantsParams {
  stageId: QualifyingStageId
  seasonId: string
  round: number
  allEntries: Array<{
    driverId?: string
    driverName?: string
    carId?: string
    isPlayerTeam?: boolean
    teamId?: string
    teamName?: string
    teamColor?: string
    driverNumber?: number
  }>
  playerDriverIds?: Set<string> | string[]
  playerTeam?: {
    id?: string
    name?: string
    color?: string
  }
}

/**
 * Resolve os participantes canônicos e elegíveis para uma fase de qualificação
 * (Q1/Q2/Q3 ou SQ1/SQ2/SQ3), respeitando as regras esportivas de avanço e corte.
 */
export function resolveEligibleQualifyingDrivers(
  params: ResolveQualifyingParticipantsParams,
): QualifyingDriverContext[] {
  const { stageId, seasonId, round, allEntries = [], playerTeam } = params
  if (!seasonId) return []

  const playerDriverSet = new Set(
    params.playerDriverIds instanceof Set
      ? params.playerDriverIds
      : Array.isArray(params.playerDriverIds)
        ? params.playerDriverIds
        : [],
  )

  const all24: QualifyingDriverContext[] = []
  const seenDriverIds = new Set<string>()

  allEntries.forEach((e, idx) => {
    if (!e.driverId || seenDriverIds.has(e.driverId)) return
    seenDriverIds.add(e.driverId)

    const isPlayer = Boolean(e.isPlayerTeam || playerDriverSet.has(e.driverId))
    all24.push({
      id: e.driverId,
      name: e.driverName || `Piloto ${idx + 1}`,
      speed: isPlayer ? (e.carId === 'car1' ? 84 : 82) : 78 + (idx % 8),
      consistency: isPlayer ? (e.carId === 'car1' ? 82 : 81) : 79,
      defense: isPlayer ? (e.carId === 'car1' ? 80 : 78) : 76,
      teamId: isPlayer ? playerTeam?.id || e.teamId || 'player_team' : e.teamId || `rival_${idx}`,
      teamName: isPlayer
        ? playerTeam?.name || e.teamName || 'Equipe Jogador'
        : e.teamName || `Equipe ${idx + 1}`,
      teamColor: isPlayer
        ? playerTeam?.color || e.teamColor || '#E10600'
        : e.teamColor || '#64748B',
      carNumber: e.driverNumber || (isPlayer ? (e.carId === 'car1' ? 1 : 2) : idx + 3),
    })
  })

  // Fases iniciais: todos os 24 pilotos inscritos participam
  if (stageId === 'q1' || stageId === 'sq1') {
    return all24.slice(0, CANONICAL_QUALIFYING_RULES[stageId].participantsCount || 24)
  }

  // Fases dependentes: mapeamento único parentStageMap (sem branches hardcoded por nome)
  const parentStage = parentStageMap[stageId]
  if (!parentStage) {
    return all24
  }

  const parentRes = canonicalQualifyingPersistenceService.readStageResult(
    seasonId,
    round,
    parentStage,
  )

  // 1. Ausente ou sem advancingDriverIds -> lançar QualifyingPrerequisiteError com 'missing_stage_result'
  if (
    !parentRes ||
    !Array.isArray(parentRes.advancingDriverIds) ||
    parentRes.advancingDriverIds.length === 0
  ) {
    throw new QualifyingPrerequisiteError(stageId, parentStage, 'missing_stage_result')
  }

  const advancingIds = parentRes.advancingDriverIds
  const expectedAdvancingCount = CANONICAL_QUALIFYING_RULES[parentStage].advancingCount

  // 2. Contagem diferente da regra esportiva canônica -> 'invalid_advancing_count'
  if (advancingIds.length !== expectedAdvancingCount) {
    throw new QualifyingPrerequisiteError(stageId, parentStage, 'invalid_advancing_count')
  }

  // 3. IDs vazios ou duplicados -> 'duplicate_or_invalid_driver_ids'
  const seenAdvancing = new Set<string>()
  for (const id of advancingIds) {
    if (!id || typeof id !== 'string' || id.trim() === '' || seenAdvancing.has(id)) {
      throw new QualifyingPrerequisiteError(stageId, parentStage, 'duplicate_or_invalid_driver_ids')
    }
    seenAdvancing.add(id)
  }

  // Caminho feliz: mapear e preservar ordem e dados canônicos
  const participantsMap = new Map(all24.map((p) => [p.id, p]))
  const orderedClassified: QualifyingDriverContext[] = []

  for (const driverId of advancingIds) {
    const found = participantsMap.get(driverId)
    if (found) {
      orderedClassified.push(found)
    }
  }

  if (orderedClassified.length > 0) {
    return orderedClassified
  }

  const advSet = new Set(advancingIds)
  return all24.filter((p) => advSet.has(p.id))
}
