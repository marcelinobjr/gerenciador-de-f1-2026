/**
 * canonicalQualifyingPersistenceService.ts
 *
 * Gerenciamento centralizado de persistência de estado e resultados de qualificação (Q1, Q2, Q3)
 * para a aba CORRIDA.
 *
 * Responsabilidades:
 * - Persistência do estado em andamento de cada fase (q1, q2, q3) para reload seguro.
 * - Idempotência estrita: duplo clique não duplica resultados, finalizar duas vezes não quebra histórico.
 * - Persistência dos resultados de eliminação: Q1_RESULT, Q2_RESULT, Q3_RESULT.
 * - Composição e persistência do grid final P1–P24 (QUALIFYING_RESULT).
 * - Leitura e preservação de Parc Fermé.
 */

import type {
  QualifyingStageId,
  QualifyingStageState,
  QualifyingStageResult,
  CompleteQualifyingWeekendResult,
  FinalQualifyingGridEntry,
} from '@/types/canonical-qualifying-types'

const STAGE_STATE_STORAGE_KEY_PREFIX = 'apex_qualifying_stage_state_v2'
const STAGE_RESULT_STORAGE_KEY_PREFIX = 'apex_qualifying_stage_result_v2'
const FINAL_GRID_STORAGE_KEY_PREFIX = 'apex_qualifying_final_grid_v2'
const PARC_FERME_STORAGE_KEY_PREFIX = 'apex_parc_ferme_v2'

export const canonicalQualifyingPersistenceService = {
  /**
   * Chave de armazenamento do estado em andamento de uma fase (Q1, Q2 ou Q3).
   */
  getStageStateKey(seasonId: string, round: number, stageId: QualifyingStageId): string {
    return `${STAGE_STATE_STORAGE_KEY_PREFIX}_${seasonId}_r${round}_${stageId}`
  },

  /**
   * Chave de armazenamento do resultado oficial homologado de uma fase.
   */
  getStageResultKey(seasonId: string, round: number, stageId: QualifyingStageId): string {
    return `${STAGE_RESULT_STORAGE_KEY_PREFIX}_${seasonId}_r${round}_${stageId}`
  },

  /**
   * Chave de armazenamento do grid final combinado P1-P24.
   */
  getFinalGridKey(seasonId: string, round: number): string {
    return `${FINAL_GRID_STORAGE_KEY_PREFIX}_${seasonId}_r${round}`
  },

  /**
   * Chave de armazenamento do status de Parc Fermé.
   */
  getParcFermeKey(seasonId: string, round: number): string {
    return `${PARC_FERME_STORAGE_KEY_PREFIX}_${seasonId}_r${round}`
  },

  /**
   * Salva o estado ao vivo da fase de classificação.
   */
  saveStageState(seasonId: string, round: number, state: QualifyingStageState): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      state.updatedAt = new Date().toISOString()
      state.revision = (state.revision || 0) + 1
      const key = this.getStageStateKey(seasonId, round, state.stageId)
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch (e) {
      console.warn('[QualifyingPersistence] Erro ao salvar estado de fase:', e)
    }
  },

  /**
   * Lê o estado ao vivo da fase para permitir reload seguro sem recomeçar.
   */
  readStageState(
    seasonId: string,
    round: number,
    stageId: QualifyingStageId,
  ): QualifyingStageState | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const raw = window.localStorage.getItem(this.getStageStateKey(seasonId, round, stageId))
      if (!raw) return null
      return JSON.parse(raw) as QualifyingStageState
    } catch (e) {
      console.warn('[QualifyingPersistence] Erro ao ler estado de fase:', e)
      return null
    }
  },

  /**
   * Salva o resultado oficial homologado de uma fase específica (Q1, Q2 ou Q3).
   * Idempotente: se já existir resultado válido com timestamp, preserva para evitar sobrescrita espúria.
   */
  saveStageResult(result: QualifyingStageResult): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      const key = this.getStageResultKey(result.seasonId, result.round, result.stageId)
      window.localStorage.setItem(key, JSON.stringify(result))
    } catch (e) {
      console.warn('[QualifyingPersistence] Erro ao salvar resultado de fase:', e)
    }
  },

  /**
   * Lê o resultado oficial homologado de uma fase.
   */
  readStageResult(
    seasonId: string,
    round: number,
    stageId: QualifyingStageId,
  ): QualifyingStageResult | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const raw = window.localStorage.getItem(this.getStageResultKey(seasonId, round, stageId))
      if (!raw) return null
      return JSON.parse(raw) as QualifyingStageResult
    } catch (e) {
      console.warn('[QualifyingPersistence] Erro ao ler resultado de fase:', e)
      return null
    }
  },

  /**
   * Salva o resultado final completo da qualificação (grid P1–P24 + referências).
   */
  saveCompleteQualifyingResult(result: CompleteQualifyingWeekendResult): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      const key = this.getFinalGridKey(result.seasonId, result.round)
      window.localStorage.setItem(key, JSON.stringify(result))
    } catch (e) {
      console.warn('[QualifyingPersistence] Erro ao salvar grid final completo:', e)
    }
  },

  /**
   * Lê o resultado final completo da qualificação (grid P1–P24).
   */
  readCompleteQualifyingResult(
    seasonId: string,
    round: number,
  ): CompleteQualifyingWeekendResult | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const raw = window.localStorage.getItem(this.getFinalGridKey(seasonId, round))
      if (!raw) return null
      return JSON.parse(raw) as CompleteQualifyingWeekendResult
    } catch (e) {
      console.warn('[QualifyingPersistence] Erro ao ler grid final completo:', e)
      return null
    }
  },

  /**
   * Define o status de Parc Fermé.
   * O Parc Fermé é ativado assim que o Q1 inicia e congela o setup principal para Q2/Q3/Corrida.
   */
  setParcFermeActive(seasonId: string, round: number, active: boolean): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      const key = this.getParcFermeKey(seasonId, round)
      window.localStorage.setItem(
        key,
        JSON.stringify({ active, updatedAt: new Date().toISOString() }),
      )
    } catch (e) {
      console.warn('[QualifyingPersistence] Erro ao definir Parc Fermé:', e)
    }
  },

  /**
   * Verifica se o Parc Fermé está ativo para este evento.
   */
  isParcFermeActive(seasonId: string, round: number): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false
    try {
      const raw = window.localStorage.getItem(this.getParcFermeKey(seasonId, round))
      if (!raw) return false
      const parsed = JSON.parse(raw)
      return !!parsed.active
    } catch {
      return false
    }
  },

  /**
   * Constrói o grid final oficial P1–P24 combinando os resultados canônicos de Q1, Q2 e Q3.
   * Regra oficial de formação de grid:
   * - Q3 (10 pilotos): define P1 a P10 ordenados pelos melhores tempos de Q3.
   * - Eliminados no Q2 (8 pilotos): ocupam P11 a P18 ordenados pelos melhores tempos de Q2.
   * - Eliminados no Q1 (6 pilotos): ocupam P19 a P24 ordenados pelos melhores tempos de Q1.
   * Desempates resolvidos deterministicamente por quem registrou o tempo primeiro (bestLapRecordedAtSec).
   */
  buildCombinedFinalGrid(params: {
    seasonId: string
    round: number
    q1Result: QualifyingStageResult
    q2Result: QualifyingStageResult
    q3Result: QualifyingStageResult
  }): CompleteQualifyingWeekendResult {
    const { seasonId, round, q1Result, q2Result, q3Result } = params

    // 1. P1 a P10 vêm de Q3
    const q3Sorted = [...q3Result.entries].sort((a, b) => {
      if (a.bestLapSec > 0 && b.bestLapSec > 0) {
        if (a.bestLapSec !== b.bestLapSec) return a.bestLapSec - b.bestLapSec
        return (a.bestLapRecordedAtSec || 0) - (b.bestLapRecordedAtSec || 0)
      }
      if (a.bestLapSec > 0) return -1
      if (b.bestLapSec > 0) return 1
      return 0
    })

    // 2. P11 a P18 vêm dos eliminados no Q2 (ordenados por seus tempos de Q2)
    const q2Eliminated = q2Result.entries
      .filter((e) => q2Result.eliminatedDriverIds.includes(e.driverId))
      .sort((a, b) => {
        if (a.bestLapSec > 0 && b.bestLapSec > 0) {
          if (a.bestLapSec !== b.bestLapSec) return a.bestLapSec - b.bestLapSec
          return (a.bestLapRecordedAtSec || 0) - (b.bestLapRecordedAtSec || 0)
        }
        if (a.bestLapSec > 0) return -1
        if (b.bestLapSec > 0) return 1
        return 0
      })

    // 3. P19 a P24 vêm dos eliminados no Q1 (ordenados por seus tempos de Q1)
    const q1Eliminated = q1Result.entries
      .filter((e) => q1Result.eliminatedDriverIds.includes(e.driverId))
      .sort((a, b) => {
        if (a.bestLapSec > 0 && b.bestLapSec > 0) {
          if (a.bestLapSec !== b.bestLapSec) return a.bestLapSec - b.bestLapSec
          return (a.bestLapRecordedAtSec || 0) - (b.bestLapRecordedAtSec || 0)
        }
        if (a.bestLapSec > 0) return -1
        if (b.bestLapSec > 0) return 1
        return 0
      })

    const finalGrid: FinalQualifyingGridEntry[] = []

    // Adiciona P1–P10
    q3Sorted.forEach((entry, idx) => {
      const q1Entry = q1Result.entries.find((e) => e.driverId === entry.driverId)
      const q2Entry = q2Result.entries.find((e) => e.driverId === entry.driverId)
      finalGrid.push({
        gridPosition: idx + 1,
        driverId: entry.driverId,
        driverName: entry.driverName,
        teamId: entry.teamId,
        teamName: entry.teamName,
        teamColor: entry.teamColor,
        isPlayer: entry.isPlayer,
        carId: entry.carId,
        eliminationStage: 'Q3',
        bestLapSec: entry.bestLapSec,
        bestLapTime: entry.bestLapTime,
        bestLapCompound: entry.compound,
        tyreSetId: entry.tyreSetId,
        q1LapTime: q1Entry?.bestLapTime,
        q2LapTime: q2Entry?.bestLapTime,
        q3LapTime: entry.bestLapTime,
      })
    })

    // Adiciona P11–P18
    q2Eliminated.forEach((entry, idx) => {
      const q1Entry = q1Result.entries.find((e) => e.driverId === entry.driverId)
      finalGrid.push({
        gridPosition: 10 + idx + 1,
        driverId: entry.driverId,
        driverName: entry.driverName,
        teamId: entry.teamId,
        teamName: entry.teamName,
        teamColor: entry.teamColor,
        isPlayer: entry.isPlayer,
        carId: entry.carId,
        eliminationStage: 'Q2',
        bestLapSec: entry.bestLapSec,
        bestLapTime: entry.bestLapTime,
        bestLapCompound: entry.compound,
        tyreSetId: entry.tyreSetId,
        q1LapTime: q1Entry?.bestLapTime,
        q2LapTime: entry.bestLapTime,
      })
    })

    // Adiciona P19–P24
    q1Eliminated.forEach((entry, idx) => {
      finalGrid.push({
        gridPosition: 18 + idx + 1,
        driverId: entry.driverId,
        driverName: entry.driverName,
        teamId: entry.teamId,
        teamName: entry.teamName,
        teamColor: entry.teamColor,
        isPlayer: entry.isPlayer,
        carId: entry.carId,
        eliminationStage: 'Q1',
        bestLapSec: entry.bestLapSec,
        bestLapTime: entry.bestLapTime,
        bestLapCompound: entry.compound,
        tyreSetId: entry.tyreSetId,
        q1LapTime: entry.bestLapTime,
      })
    })

    const poleEntry = finalGrid[0]

    const completeResult: CompleteQualifyingWeekendResult = {
      seasonId,
      round,
      completedAt: new Date().toISOString(),
      poleDriverId: poleEntry?.driverId || '',
      poleDriverName: poleEntry?.driverName || '',
      poleLapTime: poleEntry?.bestLapTime || '--:--.---',
      q1Result,
      q2Result,
      q3Result,
      finalGrid,
    }

    this.saveCompleteQualifyingResult(completeResult)
    return completeResult
  },
}
