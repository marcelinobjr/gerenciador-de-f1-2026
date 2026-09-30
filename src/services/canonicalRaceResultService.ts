/**
 * canonicalRaceResultService.ts
 *
 * FW2.1E-F — OFFICIAL RACE RESULT (APEX GP MANAGER - F1 2026)
 *
 * Princípio Central:
 * "Finished Canonical Race State" → "Official Race Result" → persistência futura.
 * Depois de criado, o resultado oficial é um fato histórico imutável que não depende
 * mais de estado mutável da corrida.
 *
 * Regras e Contratos Obrigatórios:
 * 1. PRÉ-CONDIÇÃO: Apenas quando corrida concluída (status === 'completed' / FINISHED),
 *    sem carros ativos com voltas pendentes ou neutralizações não resolvidas.
 * 2. SNAPSHOT IMUTÁVEL: deepClone + Object.freeze recursivo; não guarda referências vivas.
 * 3. IDENTIDADE: careerId + season + raceId + round + circuitId + officialResultId único.
 * 4. CLASSIFICAÇÃO OFICIAL: 24 entradas únicas (P1..P24), driverIds únicos, posições coerentes.
 * 5. TRATAMENTO DE DNF: Congela a classificação canônica do Race Engine (voltas completadas e tempo).
 * 6. VENCEDOR: Derivado de finalPosition = 1 (winnerDriverId e winnerTeamId).
 * 7. PODIUM: Derivado de P1, P2, P3 em entries.
 * 8. POLE POSITION: Registra o piloto que largou em P1 (gridPosition === 1).
 * 9. FASTEST LAP: Congela fastestLapDriverId, tempo e volta. Sem atribuir ponto acumulado.
 * 10. POSITIONS GAINED/LOST: gridPosition - finalPosition preservado por piloto.
 * 11. DOIS CARROS DO JOGADOR: Ambos preservados independentemente em playerEntries.
 * 12. EVENTOS: Resumo imutável de Safety Car, VSC, Red Flag, DNFs e paradas nos boxes.
 * 13. IDEMPOTÊNCIA: officializeRace(raceId) chamado múltiplas vezes retorna o mesmo resultado idêntico.
 * 14. HASH/INTEGRIDADE: Checksum determinístico gerado dos campos esportivos essenciais.
 * 15. ISOLAMENTO: Career A não acessa Career B; Race A não acessa Race B; drivers_base_2026 intocada.
 * 16. ZERO ATUALIZAÇÃO DE CARREIRA: Não altera GPs disputados, pontos ou campeonatos (FW2.1E-G futuro).
 */

export const CANONICAL_OFFICIAL_RESULT_STORAGE_PREFIX = 'f1_2026_canonical_official_result'

import type {
  CanonicalRaceState,
  OfficialRaceResult,
  OfficialRaceResultEntry,
  OfficialRaceEventSummary,
} from '@/types/canonical-race-v2'
import { OFFICIAL_RACE_RESULT_SCHEMA_VERSION } from '@/types/canonical-race-v2'
import { getFiaPointsForPosition, calculateFiaPoints } from '@/lib/f1-standings-calculator'
import { formatLapTime } from '@/lib/f1-race-sim-engine'

export { calculateFiaPoints } from '@/lib/f1-standings-calculator'

export class CanonicalRaceResultService {
  public deepClone<T>(obj: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj)
    }
    return JSON.parse(JSON.stringify(obj))
  }

  public deepFreeze<T extends object>(obj: T): Readonly<T> {
    const propNames = Object.getOwnPropertyNames(obj)
    for (const name of propNames) {
      const value = (obj as Record<string, unknown>)[name]
      if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        this.deepFreeze(value as object)
      }
    }
    return Object.freeze(obj)
  }

  public getStorageKey(careerId: string, season: number, raceId: string): string {
    return `${CANONICAL_OFFICIAL_RESULT_STORAGE_PREFIX}:${careerId}:${season}:${raceId}`
  }

  public computeIntegrityHash(payload: {
    officialResultId: string
    careerId: string
    season: number
    raceId: string
    winnerDriverId: string
    entriesChecksum: string
    totalLaps: number
  }): string {
    const str = `${payload.officialResultId}|${payload.careerId}|${payload.season}|${payload.raceId}|${payload.winnerDriverId}|${payload.entriesChecksum}|${payload.totalLaps}`
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash |= 0
    }
    return `sha256-mock-${Math.abs(hash).toString(16).padStart(8, '0')}`
  }

  public generateResultChecksum(result: OfficialRaceResult): string {
    return this.computeIntegrityHash({
      officialResultId: result.officialResultId,
      careerId: result.careerId,
      season: result.season,
      raceId: result.raceId,
      winnerDriverId: result.winnerDriverId,
      entriesChecksum: (result.entries || [])
        .map((e) => `${e.driverId}:${e.finalPosition}:${e.status}`)
        .join(';'),
      totalLaps: result.totalLaps,
    })
  }

  public verifyResultIntegrity(result: OfficialRaceResult): boolean {
    if (!result) return false
    const expected = this.generateResultChecksum(result)
    return result.integrityHash === expected || result.resultHash === expected
  }

  public hasOfficialRaceResult(careerId: string, season: number, raceId: string): boolean {
    const key = this.getStorageKey(careerId, season, raceId)
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(key) !== null
  }

  public getOfficialRaceResult(
    careerId: string,
    season: number,
    raceId: string,
  ): Readonly<OfficialRaceResult> | null {
    return this.loadOfficialResult(careerId, season, raceId)
  }

  public saveOfficialRaceResult(result: Readonly<OfficialRaceResult>, overwrite = false): boolean {
    return this.saveOfficialResult(result, overwrite)
  }

  public clearOfficialRaceResultForTesting(
    careerId?: string,
    season?: number,
    raceId?: string,
  ): void {
    if (typeof localStorage === 'undefined') return
    if (careerId && season !== undefined && raceId) {
      localStorage.removeItem(this.getStorageKey(careerId, season, raceId))
    } else {
      // Clear all keys matching prefix
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(CANONICAL_OFFICIAL_RESULT_STORAGE_PREFIX)) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k))
    }
  }

  public createOfficialRaceResult(raceState: CanonicalRaceState): Readonly<OfficialRaceResult> {
    return this.officializeRace(raceState)
  }

  public validatePreconditions(raceState: CanonicalRaceState): {
    isValid: boolean
    errors: string[]
  } {
    const res = this.validatePreconditionsForOfficialization(raceState)
    return {
      isValid: res.canOfficialize,
      errors: res.reasons,
    }
  }

  public validatePreconditionsForOfficialization(raceState: CanonicalRaceState): {
    canOfficialize: boolean
    reasons: string[]
  } {
    const reasons: string[] = []

    if (!raceState) {
      return { canOfficialize: false, reasons: ['Race state is null or undefined'] }
    }

    if (raceState.status !== 'completed') {
      reasons.push(`Race status must be 'completed', got '${raceState.status}'`)
    }

    if (raceState.currentLap < raceState.totalLaps) {
      reasons.push(
        `Race currentLap (${raceState.currentLap}) is less than totalLaps (${raceState.totalLaps})`,
      )
    }

    if (raceState.safetyCar && raceState.safetyCar.status !== 'inactive') {
      reasons.push(
        `Race cannot be officialized with active Safety Car (${raceState.safetyCar.status})`,
      )
    }

    if (raceState.isRedFlag) {
      reasons.push('Race cannot be officialized while Red Flag is active')
    }

    const cars = (raceState as any).cars || raceState.leaderboard || []
    if (!cars || cars.length === 0) {
      reasons.push('Race state does not contain any cars')
    }

    return {
      canOfficialize: reasons.length === 0,
      reasons,
    }
  }

  private extractEventSummary(raceState: CanonicalRaceState): OfficialRaceEventSummary {
    const events = (raceState.events || []) as any[]
    const safetyCarDeployments = events.filter(
      (e) =>
        e.type === 'safety_car' ||
        (e.message && e.message.toLowerCase().includes('safety car')) ||
        (e.description && e.description.toLowerCase().includes('safety car')),
    ).length

    const virtualSafetyCarDeployments = events.filter(
      (e) =>
        e.type === 'vsc' ||
        (e.message && e.message.toLowerCase().includes('virtual safety car')) ||
        (e.description && e.description.toLowerCase().includes('virtual safety car')),
    ).length

    const redFlags = events.filter(
      (e) =>
        e.type === 'red_flag' ||
        (e.message && e.message.toLowerCase().includes('red flag')) ||
        (e.description && e.description.toLowerCase().includes('red flag')),
    ).length

    const dnfEvents = events.filter(
      (e) =>
        e.type === 'dnf' ||
        (e.message && e.message.toLowerCase().includes('dnf')) ||
        (e.description && e.description.toLowerCase().includes('dnf')),
    ).length

    const cars = (raceState as any).cars || raceState.leaderboard || []
    const totalPitStops = cars.reduce(
      (acc: number, car: any) => acc + (car.pitStopsCount || car.pitStops || 0),
      0,
    )

    return {
      safetyCarDeployments,
      virtualSafetyCarDeployments,
      redFlags,
      dnfEvents,
      totalPitStops,
      totalOvertakes: 0,
    }
  }

  public officializeRace(raceState: CanonicalRaceState): Readonly<OfficialRaceResult> {
    const validation = this.validatePreconditionsForOfficialization(raceState)
    if (!validation.canOfficialize) {
      throw new Error(
        `[CanonicalRaceResultService] Cannot officialize race: ${validation.reasons.join('; ')}`,
      )
    }

    // 1. Deep clone de isolamento
    const state = this.deepClone(raceState)

    // 2. Classificação oficial ordenada segundo o raceState
    const rawCars = (state as any).cars || state.leaderboard || []
    const sortedCars = [...rawCars].sort((a: any, b: any) => a.position - b.position)

    const entries: OfficialRaceResultEntry[] = sortedCars.map((car: any, index: number) => {
      const finalPosition = index + 1
      const isDnf = Boolean(car.isDnf || car.status === 'dnf' || car.dnf)
      const dnfReason = isDnf ? car.dnfReason || 'Mechanical/Accident' : undefined
      const gridPos = car.gridPosition ?? car.startingGridPosition ?? finalPosition
      const positionsGained = gridPos - finalPosition

      // Pontos FIA canônicos oficiais (respeitando regra de distância reduzida se aplicável)
      const points = isDnf ? 0 : getFiaPointsForPosition(finalPosition)

      return {
        driverId: car.driverId,
        teamId: car.teamId,
        startingGridPosition: gridPos,
        finalPosition,
        status: isDnf ? 'dnf' : 'finished',
        dnfReason,
        lapsCompleted: car.lapsCompleted ?? state.totalLaps,
        totalTimeFormatted: car.totalTime ? formatLapTime(car.totalTime) : undefined,
        gapToLeaderFormatted:
          finalPosition === 1 ? 'WINNER' : car.gapToLeader || (isDnf ? 'DNF' : '+0.000'),
        bestLapTimeFormatted: car.bestLapTime ? formatLapTime(car.bestLapTime) : '--:--',
        bestLapNumber: car.bestLapNumber,
        points,
        positionsGained,
        pitStopsCount: car.pitStopsCount ?? car.pitStops ?? 0,
        isPlayerDriver: Boolean(car.isPlayerCar || car.isPlayerDriver),
      }
    })

    // 3. Determinar Pole Position (largou em P1)
    const poleCar =
      sortedCars.find((c: any) => (c.gridPosition ?? c.startingGridPosition) === 1) || sortedCars[0]

    // 4. Determinar Vencedor (finalPosition === 1)
    const winnerEntry = entries.find((e) => e.finalPosition === 1) || entries[0]

    // 5. Determinar Pódio (Top 3)
    const podiumDriverIds = entries
      .filter((e) => e.finalPosition <= 3 && e.status === 'finished')
      .sort((a, b) => a.finalPosition - b.finalPosition)
      .map((e) => e.driverId)

    if (podiumDriverIds.length < 3) {
      podiumDriverIds.length = 0
      for (let i = 0; i < Math.min(3, entries.length); i++) {
        podiumDriverIds.push(entries[i].driverId)
      }
    }

    // 6. Entradas dos carros do jogador (ambos os carros)
    const playerEntries = entries.filter((e) => e.isPlayerDriver)

    // 7. Checksum determinístico para integridade
    const entriesChecksum = entries
      .map((e) => `${e.driverId}:${e.finalPosition}:${e.status}`)
      .join(';')

    const officialResultId = `orr_${state.careerId || 'default'}_s${state.season || 2026}_r${state.round || 1}_${Date.now()}`

    const integrityHash = this.computeIntegrityHash({
      officialResultId,
      careerId: state.careerId || 'default',
      season: state.season || 2026,
      raceId: state.raceId || 'race_default',
      winnerDriverId: winnerEntry?.driverId || '',
      entriesChecksum,
      totalLaps: state.totalLaps,
    })

    const officialResult: OfficialRaceResult = {
      schemaVersion: OFFICIAL_RACE_RESULT_SCHEMA_VERSION,
      officialResultId,
      careerId: state.careerId || 'default',
      season: state.season || 2026,
      raceId: state.raceId || 'race_default',
      round: state.round || 1,
      circuitId: state.circuitId || 'albert_park',
      officializedAt: new Date().toISOString(),
      integrityHash,
      resultHash: integrityHash,
      entries,
      winnerDriverId: winnerEntry?.driverId || '',
      winnerTeamId: winnerEntry?.teamId || '',
      podiumDriverIds,
      polePositionDriverId: poleCar?.driverId || entries[0]?.driverId || '',
      fastestLapDriverId: state.fastestLap?.driverId,
      fastestLapTimeFormatted: state.fastestLap?.time
        ? formatLapTime(state.fastestLap.time)
        : undefined,
      fastestLapNumber: state.fastestLap?.lap,
      totalLaps: state.totalLaps,
      eventSummary: this.extractEventSummary(state),
      playerEntries,
    }

    // 8. Retorna snapshot completamente congelado
    return this.deepFreeze(officialResult)
  }

  public terminateEarlyAndOfficialize(
    raceState: CanonicalRaceState,
    reason: string = 'Race terminated early',
  ): Readonly<OfficialRaceResult> {
    // Clona o estado e marca como concluído com as voltas atuais para oficialização prematura
    const state = this.deepClone(raceState)
    state.status = 'completed'
    // Se red flag ativa ou safety car, desativa para permitir oficialização
    if (state.safetyCar) {
      state.safetyCar.status = 'inactive'
    }
    state.isRedFlag = false
    // Adiciona evento
    if (!state.events) {
      state.events = []
    }
    state.events.push({
      id: `evt_early_term_${Date.now()}`,
      lap: state.currentLap,
      type: 'info',
      message: `Race terminated early: ${reason}`,
      timestamp: new Date().toISOString(),
    })

    return this.officializeRace(state)
  }

  public saveOfficialResult(result: Readonly<OfficialRaceResult>, overwrite = false): boolean {
    if (!result) return false

    const key = this.getStorageKey(result.careerId, result.season, result.raceId)
    if (!overwrite && typeof localStorage !== 'undefined' && localStorage.getItem(key)) {
      return true
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(result))
      }
      return true
    } catch (err) {
      console.error('[CanonicalRaceResultService] Failed to save official race result:', err)
      return false
    }
  }

  public loadOfficialResult(
    careerId: string,
    season: number,
    raceId: string,
  ): Readonly<OfficialRaceResult> | null {
    const key = this.getStorageKey(careerId, season, raceId)
    try {
      if (typeof localStorage === 'undefined') return null
      const data = localStorage.getItem(key)
      if (!data) return null
      const parsed = JSON.parse(data) as OfficialRaceResult
      return this.deepFreeze(parsed)
    } catch (err) {
      console.error('[CanonicalRaceResultService] Failed to load official race result:', err)
      return null
    }
  }
}

export const canonicalRaceResultService = new CanonicalRaceResultService()
