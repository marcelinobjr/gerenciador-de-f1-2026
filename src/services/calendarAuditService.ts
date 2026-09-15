import { F1_2026_CALENDAR } from '@/lib/f1-data'
import {
  CIRCUIT_PERFORMANCE_PROFILES,
  validateCircuitPerformanceProfiles,
  resolveCircuitProfile,
  CircuitValidationResult,
  CircuitPerformanceProfile,
} from '@/data/circuit-performance-profiles'
import { SeasonModel, RaceResultModel } from '@/types/f1'

export interface CalendarAuditReport {
  totalGPs: number
  uniqueRounds: number
  missingRounds: number[]
  duplicateRounds: number[]
  validCircuitIds: string[]
  technicalProfilesResolved: number
  weightValidation: CircuitValidationResult
  unresolvedAliases: string[]
  orphanResults: number
  integrity: 'PASS' | 'FAIL'
}

/**
 * Realiza auditoria profunda de integridade do calendário ativo da temporada.
 * - Determina a extensão do calendário dinamicamente (sem hardcode 24)
 * - Valida completude, unicidade e ordenação dos rounds
 * - Valida resolução de perfis técnicos oficiais e soma exata de 100% dos pesos
 * - Verifica órfãos de resultados associados caso results sejam fornecidos
 */
export function auditSeasonCalendar(
  season?: Partial<SeasonModel> | null,
  raceResults?: RaceResultModel[],
): CalendarAuditReport {
  const calendarGps = F1_2026_CALENDAR || []
  const calendarLength = calendarGps.length
  const totalRounds = season?.total_rounds || calendarLength || 24

  const totalGPs = calendarLength
  const seenRounds = new Map<number, number>()
  const duplicateRoundsSet = new Set<number>()

  calendarGps.forEach((gp) => {
    const r = gp.round
    seenRounds.set(r, (seenRounds.get(r) || 0) + 1)
    if ((seenRounds.get(r) || 0) > 1) {
      duplicateRoundsSet.add(r)
    }
  })

  const uniqueRounds = seenRounds.size
  const duplicateRounds = Array.from(duplicateRoundsSet).sort((a, b) => a - b)

  const missingRounds: number[] = []
  for (let r = 1; r <= totalRounds; r++) {
    if (!seenRounds.has(r)) {
      missingRounds.push(r)
    }
  }

  // Validação dos perfis técnicos e resolução de aliases
  const validCircuitIds: string[] = []
  const unresolvedAliases: string[] = []
  let technicalProfilesResolved = 0

  calendarGps.forEach((gp) => {
    let resolved: CircuitPerformanceProfile | null = null
    try {
      resolved = resolveCircuitProfile({
        round: gp.round,
        circuitName: gp.circuit,
        country: gp.country,
      })
    } catch {
      try {
        resolved = resolveCircuitProfile({ round: gp.round })
      } catch {
        resolved = null
      }
    }

    if (resolved) {
      technicalProfilesResolved++
      if (!validCircuitIds.includes(resolved.id)) {
        validCircuitIds.push(resolved.id)
      }
    } else {
      unresolvedAliases.push(`round_${gp.round}:${gp.name || gp.circuit}`)
    }
  })

  // Validação matemática de pesos dos perfis (soma 100)
  const weightValidation = validateCircuitPerformanceProfiles(false)

  // Auditoria de resultados órfãos (rounds de resultados que não existem no calendário)
  let orphanResults = 0
  if (Array.isArray(raceResults) && raceResults.length > 0) {
    const validRoundSet = new Set(calendarGps.map((gp) => gp.round))
    raceResults.forEach((res) => {
      if (typeof res.round === 'number' && !validRoundSet.has(res.round)) {
        orphanResults++
      }
    })
  }

  const isComplete = missingRounds.length === 0 && duplicateRounds.length === 0
  const isAllResolved = unresolvedAliases.length === 0 && technicalProfilesResolved >= totalGPs
  const isWeightValid = weightValidation.valid
  const hasNoOrphans = orphanResults === 0

  const integrity: 'PASS' | 'FAIL' =
    isComplete && isAllResolved && isWeightValid && hasNoOrphans ? 'PASS' : 'FAIL'

  return {
    totalGPs,
    uniqueRounds,
    missingRounds,
    duplicateRounds,
    validCircuitIds,
    technicalProfilesResolved,
    weightValidation,
    unresolvedAliases,
    orphanResults,
    integrity,
  }
}
