import {
  QualifyingDriverContext,
  QualifyingStageId,
  CANONICAL_QUALIFYING_RULES,
} from '@/types/qualifying'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'

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
  if (stageId === 'q1' || (stageId as any) === 'sq1') {
    return all24.slice(0, CANONICAL_QUALIFYING_RULES[stageId].initialDriversCount || 24)
  }

  // Fases intermediárias (Q2 ou SQ2): avançam os classificados da fase 1 anterior
  if (stageId === 'q2' || (stageId as any) === 'sq2') {
    const parentStage = (stageId as any) === 'sq2' ? 'sq1' : 'q1'
    const parentRes = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      round,
      parentStage as any,
    )

    if (parentRes && parentRes.advancingDriverIds && parentRes.advancingDriverIds.length > 0) {
      const advSet = new Set(parentRes.advancingDriverIds)
      const participantsMap = new Map(all24.map((p) => [p.id, p]))
      const orderedClassified: QualifyingDriverContext[] = []

      for (const driverId of parentRes.advancingDriverIds) {
        const found = participantsMap.get(driverId)
        if (found) {
          orderedClassified.push(found)
        }
      }

      if (orderedClassified.length > 0) {
        return orderedClassified
      }
      return all24.filter((p) => advSet.has(p.id))
    }
    return []
  }

  // Fases finais (Q3 ou SQ3): avançam os classificados da fase 2 anterior
  if (stageId === 'q3' || (stageId as any) === 'sq3') {
    const parentStage = (stageId as any) === 'sq3' ? 'sq2' : 'q2'
    const parentRes = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      round,
      parentStage as any,
    )

    if (parentRes && parentRes.advancingDriverIds && parentRes.advancingDriverIds.length > 0) {
      const advSet = new Set(parentRes.advancingDriverIds)
      const participantsMap = new Map(all24.map((p) => [p.id, p]))
      const orderedClassified: QualifyingDriverContext[] = []

      for (const driverId of parentRes.advancingDriverIds) {
        const found = participantsMap.get(driverId)
        if (found) {
          orderedClassified.push(found)
        }
      }

      if (orderedClassified.length > 0) {
        return orderedClassified
      }
      return all24.filter((p) => advSet.has(p.id))
    }
    return []
  }

  return all24
}
