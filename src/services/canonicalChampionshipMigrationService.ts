/**
 * canonicalChampionshipMigrationService.ts
 *
 * Reconciliação e migração idempotente de resultados legados de corrida.
 * Quando resultados históricos foram persistidos com careerId legado (ex: team.id)
 * em vez do canonicalCareerId (season.career_id || season.id), este serviço
 * vincula os registros ao canonicalCareerId de maneira:
 * - IDEMPOTENTE: rodar N vezes produz o mesmo efeito da 1ª vez.
 * - SEGURA: sem duplicar race_results, sem conceder pontos duas vezes, sem apagar nada.
 * - PRESERVAÇÃO: preserva checksum, season, round, driver IDs, team IDs, pointsAwarded, officializedAt.
 * - UNICIDADE: garante unicidade lógica (canonicalCareerId + season + round).
 */

import {
  canonicalCareerPersistenceService,
  type CanonicalPersistedRaceResult,
  type CareerApplicationJournal,
} from '@/services/canonicalCareerPersistenceService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'

export interface ReconciliationOptions {
  canonicalCareerId: string
  legacyCareerIds: string[]
  seasonYear: number
  totalRounds?: number
}

export interface ReconciliationReport {
  canonicalCareerId: string
  seasonYear: number
  reconciledRounds: number[]
  skippedRounds: number[]
  alreadyCanonicalRounds: number[]
  errors: string[]
}

export class CanonicalChampionshipMigrationService {
  /**
   * Reconcilia resultados legados para o canonicalCareerId de forma idempotente.
   */
  public reconcileLegacyCareerResults(options: ReconciliationOptions): ReconciliationReport {
    const { canonicalCareerId, legacyCareerIds, seasonYear, totalRounds = 24 } = options
    const report: ReconciliationReport = {
      canonicalCareerId,
      seasonYear,
      reconciledRounds: [],
      skippedRounds: [],
      alreadyCanonicalRounds: [],
      errors: [],
    }

    if (!canonicalCareerId) {
      report.errors.push('canonicalCareerId inválido')
      return report
    }

    // Filtrar IDs legados que sejam diferentes do canônico
    const distinctLegacyIds = Array.from(
      new Set(legacyCareerIds.filter((id) => id && id !== canonicalCareerId)),
    )

    for (let round = 1; round <= totalRounds; round++) {
      // 1. Checar se já existe sob a chave canônica com journal COMPLETE
      const canonicalJournal = canonicalCareerPersistenceService.getApplicationJournal(
        canonicalCareerId,
        seasonYear,
        round,
      )
      const canonicalPersisted = canonicalCareerPersistenceService.getPersistedRaceResult(
        canonicalCareerId,
        seasonYear,
        round,
      )
      const canonicalOfficial = canonicalRaceResultService.getOfficialRaceResult(
        canonicalCareerId,
        seasonYear,
        round,
      )

      if (canonicalJournal?.status === 'COMPLETE' && canonicalPersisted && canonicalOfficial) {
        report.alreadyCanonicalRounds.push(round)
        continue
      }

      // 2. Se falta algum dado no canônico, buscar no acervo legado
      let legacyFoundPersisted: CanonicalPersistedRaceResult | null = null
      let legacyFoundJournal: CareerApplicationJournal | null = null
      let legacyFoundOfficial: OfficialRaceResult | null = null
      let sourceLegacyId: string | null = null

      for (const legacyId of distinctLegacyIds) {
        const legJournal = canonicalCareerPersistenceService.getApplicationJournal(
          legacyId,
          seasonYear,
          round,
        )
        const legPersisted = canonicalCareerPersistenceService.getPersistedRaceResult(
          legacyId,
          seasonYear,
          round,
        )
        const legOfficial = canonicalRaceResultService.getOfficialRaceResult(
          legacyId,
          seasonYear,
          round,
        )

        if (legJournal && legJournal.status === 'COMPLETE' && legPersisted && legOfficial) {
          legacyFoundJournal = legJournal
          legacyFoundPersisted = legPersisted
          legacyFoundOfficial = legOfficial
          sourceLegacyId = legacyId
          break
        }
      }

      if (!legacyFoundPersisted || !legacyFoundJournal || !legacyFoundOfficial || !sourceLegacyId) {
        // Nada legado encontrado para esta rodada
        report.skippedRounds.push(round)
        continue
      }

      try {
        // Reconciliação sem recomputar posições, pontos ou estatísticas:
        // O OfficialRaceResult mantém seus fatos esportivos e apenas atualiza a identidade lógica se necessário
        const migratedOfficial: OfficialRaceResult = {
          ...legacyFoundOfficial,
          careerId: canonicalCareerId,
        }
        canonicalRaceResultService.saveOfficialRaceResult(migratedOfficial)

        const migratedPersisted: CanonicalPersistedRaceResult = {
          ...legacyFoundPersisted,
          careerId: canonicalCareerId,
          id: canonicalCareerPersistenceService.buildRaceResultKey(
            canonicalCareerId,
            seasonYear,
            round,
          ),
          snapshot: migratedOfficial,
        }
        canonicalCareerPersistenceService.savePersistedRaceResult(migratedPersisted)

        const migratedJournal: CareerApplicationJournal = {
          ...legacyFoundJournal,
          careerId: canonicalCareerId,
          key: canonicalCareerPersistenceService.buildApplyJournalKey(
            canonicalCareerId,
            seasonYear,
            round,
          ),
        }
        canonicalCareerPersistenceService.saveApplicationJournal(migratedJournal)

        // Também migra CanonicalRaceState salvo se existir para permitir inspeção/continuidade da rodada
        const legacyRaceState = canonicalRaceSaveService.loadCanonicalRaceState(
          sourceLegacyId,
          seasonYear,
          round,
        )
        if (legacyRaceState.state) {
          const migratedState = {
            ...legacyRaceState.state,
            careerId: canonicalCareerId,
          }
          canonicalRaceSaveService.saveCanonicalRaceState(migratedState)
        }

        report.reconciledRounds.push(round)
      } catch (err: any) {
        report.errors.push(`Erro reconciliando rodada ${round}: ${err?.message || err}`)
      }
    }

    // Após reconciliação de todas as rodadas, recalcula o snapshot do campeonato canônico
    try {
      const eligible = canonicalChampionshipService.getEligibleOfficialRaceResults(
        canonicalCareerId,
        seasonYear,
        totalRounds,
      )
      if (eligible.length > 0) {
        const latestRound = eligible[eligible.length - 1].round
        canonicalChampionshipService.processAndPersistRoundChampionship(
          canonicalCareerId,
          seasonYear,
          latestRound,
        )
      }
    } catch (e: any) {
      report.errors.push(`Erro atualizando snapshot de campeonato: ${e?.message || e}`)
    }

    return report
  }
}

export const canonicalChampionshipMigrationService = new CanonicalChampionshipMigrationService()
