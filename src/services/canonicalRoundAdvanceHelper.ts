/**
 * canonicalRoundAdvanceHelper.ts
 *
 * Helper canônico de avanço de rodada pós-corrida.
 * Executa a esteira obrigatória:
 * 1. OFFICIAL RESULT (validação)
 * 2. RACE RESULT PERSISTENCE (persistência oficial)
 * 3. CAREER STATS (atualização estatística)
 * 4. CHAMPIONSHIP UPDATE (processamento e snapshot da rodada)
 * 5. ROUND ADVANCE (persistir current_round + 1 e last_processed_round)
 * 6. Suporte a guards de reentrância e proteção contra falhas parciais.
 */

import { f1Service } from '@/services/f1Service'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { resolveCanonicalCareerId } from '@/lib/canonical-career-id'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'
import type { SeasonModel, TeamModel } from '@/types/f1'

export interface AdvanceWeekendRoundParams {
  officialResult?: OfficialRaceResult | null
  season: SeasonModel | any
  team: TeamModel | any
  currentRound: number
  totalRounds?: number
  refreshTeamAndSeason?: () => Promise<void>
  onSuccess?: (nextRound: number) => void
  onError?: (error: Error) => void
}

export interface AdvanceWeekendRoundResult {
  success: boolean
  previousRound: number
  nextRound: number
  alreadyAdvanced?: boolean
  error?: string
}

// Map de lock em memória contra duplo clique imediato por season.id
const activeAdvanceLocks = new Set<string>()

export async function advanceWeekendRound(
  params: AdvanceWeekendRoundParams,
): Promise<AdvanceWeekendRoundResult> {
  const {
    officialResult,
    season,
    team,
    currentRound,
    totalRounds = 24,
    refreshTeamAndSeason,
    onSuccess,
    onError,
  } = params

  if (!season?.id) {
    const err = new Error('Temporada não identificada para avanço de rodada.')
    onError?.(err)
    return {
      success: false,
      previousRound: currentRound,
      nextRound: currentRound,
      error: err.message,
    }
  }

  // Idempotência: trava de reentrância por temporada
  const lockKey = `${season.id}_round_${currentRound}`
  if (activeAdvanceLocks.has(lockKey)) {
    return {
      success: true,
      previousRound: currentRound,
      nextRound: currentRound + 1,
      alreadyAdvanced: true,
    }
  }

  // Idempotência: checar se a temporada no banco ou no estado já foi avançada
  if (
    season.last_processed_round &&
    season.last_processed_round >= currentRound &&
    season.current_round > currentRound
  ) {
    return {
      success: true,
      previousRound: currentRound,
      nextRound: season.current_round,
      alreadyAdvanced: true,
    }
  }

  activeAdvanceLocks.add(lockKey)

  try {
    const canonicalCareerId = resolveCanonicalCareerId(season, team)
    const seasonYear = season.year || 2026

    // ETAPA 1: OFFICIAL RESULT
    // Obter resultado oficial se não foi passado diretamente
    const official =
      officialResult ||
      canonicalRaceResultService.getOfficialRaceResult(canonicalCareerId, seasonYear, currentRound)

    if (!official) {
      throw new Error(
        `Não há resultado de corrida oficializado para a rodada ${currentRound}. A rodada não pode avançar.`,
      )
    }

    // ETAPA 2: RACE RESULT PERSISTENCE & ETAPA 3: CAREER STATS
    // Verifica se já está registrado no journal com status COMPLETE
    let journal = canonicalCareerPersistenceService.getApplicationJournal(
      canonicalCareerId,
      seasonYear,
      currentRound,
    )
    if (!journal || journal.status !== 'COMPLETE') {
      const persistRes =
        canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
      if (!persistRes.success) {
        throw new Error(
          `Falha ao persistir resultado na carreira: ${persistRes.error || 'Erro desconhecido'}`,
        )
      }
      journal = persistRes.journal
    }

    // ETAPA 4: CHAMPIONSHIP UPDATE
    // Gera e persiste o snapshot canônico acumulado da rodada
    const championshipStandings = canonicalChampionshipService.processAndPersistRoundChampionship(
      canonicalCareerId,
      seasonYear,
      currentRound,
    )

    if (!championshipStandings) {
      throw new Error(
        `Falha ao consolidar classificação do campeonato para a rodada ${currentRound}.`,
      )
    }

    // ETAPA 4.5: PU INTEGRATION KNOWLEDGE PROGRESSION
    // Evolução natural de conhecimento de integração entre equipe e fornecedor de PU
    try {
      const { canonicalPowerUnitIntegrationService } =
        await import('@/services/canonicalPowerUnitIntegrationService')
      const puState = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
        careerId: canonicalCareerId,
        seasonYear,
        teamId: team?.id || 'player_team',
      })
      canonicalPowerUnitIntegrationService.progressKnowledge({
        state: puState,
        infrastructureFacilityLevel: (team as any)?.factory_level || 5,
        technicalStaffRating:
          (team as any)?.technical_organization?.staff?.technicalDirector?.attributes
            ?.aerodynamics || 75,
      })
    } catch (puErr) {
      console.warn('Aviso: falha não bloqueante na evolução de PU Integration:', puErr)
    }

    // ETAPA 5: ROUND ADVANCE (persistência de current_round + 1 e last_processed_round)
    const nextRound = currentRound + 1
    await f1Service.updateSeason(season.id, {
      current_round: nextRound,
      last_processed_round: currentRound,
    })

    // Processamento de Silly Season opcional legado (rodadas 12 a 24)
    if (currentRound >= 12 && currentRound <= 24 && team?.id) {
      try {
        await f1Service.processMidSeasonSillyMoves(season.id, team.id, currentRound)
      } catch (sillyErr) {
        console.warn('Erro não-bloqueante Silly Season:', sillyErr)
      }
    }

    // Sincronizar contexto se fornecido
    if (refreshTeamAndSeason) {
      try {
        await refreshTeamAndSeason()
      } catch (refErr) {
        console.warn('Aviso: refreshTeamAndSeason encontrou aviso secundário:', refErr)
      }
    }

    onSuccess?.(nextRound)

    return {
      success: true,
      previousRound: currentRound,
      nextRound,
    }
  } catch (err: any) {
    const errorObj = err instanceof Error ? err : new Error(String(err))
    onError?.(errorObj)
    return {
      success: false,
      previousRound: currentRound,
      nextRound: currentRound,
      error: errorObj.message,
    }
  } finally {
    activeAdvanceLocks.delete(lockKey)
  }
}
