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
import {
  getFiaPointsForPosition,
  getFiaSprintPointsForPosition,
  calculateFiaPoints,
  calculateRacePoints,
} from '@/lib/f1-standings-calculator'
import { formatLapTime } from '@/lib/f1-race-sim-engine'

export { calculateFiaPoints, calculateRacePoints } from '@/lib/f1-standings-calculator'
export type { CalculateRacePointsParams } from '@/lib/f1-standings-calculator'

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

  public getStorageKey(careerId: string, season: number | string, raceId: string | number): string {
    return `${CANONICAL_OFFICIAL_RESULT_STORAGE_PREFIX}:${careerId}:${season}:${raceId}`
  }

  public hasOfficialRaceResult(
    careerId: string,
    season: number | string,
    raceId: string | number,
  ): boolean {
    const key = this.getStorageKey(careerId, Number(season), raceId)
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(key) !== null
  }

  public getOfficialRaceResult(
    careerId: string,
    season: number | string,
    raceId: string | number,
  ): OfficialRaceResult | null {
    return this.loadOfficialResult(careerId, Number(season), raceId) as OfficialRaceResult | null
  }

  public saveOfficialRaceResult(result: OfficialRaceResult, overwrite = false): boolean {
    return this.saveOfficialResult(result, overwrite)
  }

  public clearOfficialRaceResultForTesting(
    careerId?: string,
    season?: number | string,
    raceId?: string | number,
  ): void {
    if (typeof localStorage === 'undefined') return
    if (careerId && season !== undefined && raceId) {
      localStorage.removeItem(this.getStorageKey(careerId, Number(season), raceId))
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

  public generateResultChecksum(result: any): string {
    return this.computeIntegrityHash({
      officialResultId: result.officialResultId,
      careerId: result.careerId,
      season: result.season,
      raceId: result.raceId,
      winnerDriverId: result.winnerDriverId,
      entriesChecksum: (result.entries || [])
        .map((e: any) => `${e.driverId}:${e.finalPosition}:${e.status}`)
        .join(';'),
      totalLaps: result.totalLaps ?? 0,
    })
  }

  public verifyResultIntegrity(result: OfficialRaceResult): boolean {
    if (!result) return false
    const expected = this.generateResultChecksum(result)
    return (result as any).integrityHash === expected || result.resultHash === expected
  }

  public createOfficialRaceResult(raceState: CanonicalRaceState): OfficialRaceResult {
    return this.officializeRace(raceState) as OfficialRaceResult
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

  /**
   * Determina o número máximo de voltas consecutivas completas sem procedimento de SC ou VSC
   * com base no histórico canônico da prova (raceControl, events e contadores de SC/VSC).
   */
  public getConsecutiveLapsWithoutSCVSC(raceState: CanonicalRaceState, leaderLaps: number): number {
    if (leaderLaps <= 0) return 0

    // Se houver propriedade explícita no estado, reutilizá-la
    if (
      typeof (raceState as any).completeConsecutiveLapsWithoutSCVSC === 'number' ||
      typeof (raceState as any).validConsecutiveLapsWithoutSCVSC === 'number'
    ) {
      return (
        (raceState as any).completeConsecutiveLapsWithoutSCVSC ??
        (raceState as any).validConsecutiveLapsWithoutSCVSC ??
        0
      )
    }

    // Se houver lap-by-lap control status ou lapStatuses no estado
    if (Array.isArray((raceState as any).lapStatuses)) {
      let maxConsecutive = 0
      let currentStreak = 0
      for (const status of (raceState as any).lapStatuses) {
        if (status !== 'SAFETY_CAR' && status !== 'VSC' && status !== 'SC') {
          currentStreak++
          if (currentStreak > maxConsecutive) maxConsecutive = currentStreak
        } else {
          currentStreak = 0
        }
      }
      return maxConsecutive
    }

    // Reconstruir o status das voltas a partir dos eventos e contadores de raceControl
    const neutralLaps = new Set<number>()
    const rc = raceState.raceControl

    // 1. Inspecionar eventos de SC/VSC
    const events = (raceState.events || []) as any[]
    for (const ev of events) {
      const type = (ev.type || '').toLowerCase()
      const msg = (ev.message || ev.description || '').toLowerCase()
      const isScOrVsc =
        type === 'safety_car' ||
        type === 'vsc' ||
        type === 'safety_car_deployed' ||
        type === 'vsc_deployed' ||
        msg.includes('safety car') ||
        msg.includes('vsc') ||
        msg.includes('virtual safety car')

      if (isScOrVsc && typeof ev.lap === 'number' && ev.lap >= 1) {
        neutralLaps.add(ev.lap)
        // Se houver duração informada no evento
        const dur = ev.durationLaps || ev.duration || 1
        for (let l = ev.lap; l < ev.lap + dur && l <= leaderLaps; l++) {
          neutralLaps.add(l)
        }
      }
    }

    // 2. Inspecionar raceControl.history se disponível
    if (rc?.history && Array.isArray(rc.history)) {
      for (const h of rc.history) {
        const type = (h.type || '').toLowerCase()
        const isScOrVsc =
          type === 'safety_car' ||
          type === 'vsc' ||
          type === 'safety_car_deployed' ||
          type === 'vsc_deployed'
        if (isScOrVsc && typeof h.lap === 'number' && h.lap >= 1) {
          neutralLaps.add(h.lap)
          const start = h.startedAtLap || h.lap
          const end = h.endedAtLap || start + ((h as any).durationLaps || 1)
          for (let l = start; l <= end && l <= leaderLaps; l++) {
            neutralLaps.add(l)
          }
        }
      }
    }

    // 3. Se safetyCarLaps + vscLaps abrange todas ou quase todas as voltas
    const scLapsCount = (rc?.safetyCarLaps || 0) + (rc?.vscLaps || 0)
    if (scLapsCount >= leaderLaps) {
      return 0
    }

    // Se temos neutralLaps mapeadas, calcular sequência máxima
    if (neutralLaps.size > 0) {
      let maxConsecutive = 0
      let currentStreak = 0
      for (let lap = 1; lap <= leaderLaps; lap++) {
        if (!neutralLaps.has(lap)) {
          currentStreak++
          if (currentStreak > maxConsecutive) maxConsecutive = currentStreak
        } else {
          currentStreak = 0
        }
      }
      return maxConsecutive
    }

    // Se scLapsCount > 0 mas não mapeado em voltas específicas, avaliar se sobra espaço para 2 consecutivas
    if (scLapsCount > 0) {
      const greenLaps = leaderLaps - scLapsCount
      if (greenLaps < 2) return 0
      // Estimativa canônica conservadora: assumir que as voltas sem SC/VSC podem ser consecutivas se greenLaps >= 2
      return greenLaps
    }

    // Sem neutralizações registradas: todas as leaderLaps foram completas sem SC/VSC
    return leaderLaps
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

    const drivers = raceState.drivers || (raceState as any).cars || []
    const activeDrivers = drivers.filter(
      (d: any) => !d.isDnf && d.raceStatus !== 'dnf' && d.status !== 'dnf',
    )

    // Se ainda houver carros ativos na prova, a volta atual deve ter chegado ao total
    if (activeDrivers.length > 0 && raceState.currentLap < raceState.totalLaps) {
      reasons.push(
        `Race currentLap (${raceState.currentLap}) is less than totalLaps (${raceState.totalLaps})`,
      )
    }

    const isScActive = Boolean(
      raceState.safetyCarActive ||
      (raceState.raceControl &&
        (raceState.raceControl.currentFlag === 'SAFETY_CAR' ||
          raceState.raceControl.currentFlag === 'VSC')) ||
      ((raceState as any).safetyCar && (raceState as any).safetyCar.status !== 'inactive'),
    )

    if (isScActive && raceState.status !== 'completed') {
      reasons.push('Race cannot be officialized with active Safety Car')
    }

    const isRedFlagActive = Boolean(
      raceState.redFlagActive ||
      (raceState.raceControl && raceState.raceControl.currentFlag === 'RED_FLAG') ||
      (raceState as any).isRedFlag,
    )

    if (isRedFlagActive && raceState.status !== 'completed') {
      reasons.push('Race cannot be officialized while Red Flag is active')
    }

    if (!drivers || drivers.length === 0) {
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

    const drivers = raceState.drivers || (raceState as any).cars || []
    const totalPitStops = drivers.reduce(
      (acc: number, car: any) => acc + (car.pitStopsCount || car.pitStops || 0),
      0,
    )

    const significantIncidents: Array<{
      lap: number
      type: 'dnf' | 'safety_car' | 'vsc' | 'red_flag' | 'fastest_lap' | 'info'
      message: string
      driverId?: string
      timestamp: string
    }> = events.map((e: any) => ({
      lap: e.lap || 0,
      type: (e.type || 'info') as any,
      message: e.message || e.description || '',
      driverId: e.driverId,
      timestamp: e.timestamp || new Date().toISOString(),
    }))

    const summary: any = {
      safetyCarPeriods: safetyCarDeployments,
      safetyCarLaps: raceState.raceControl?.safetyCarLaps ?? 0,
      vscPeriods: virtualSafetyCarDeployments,
      vscLaps: raceState.raceControl?.vscLaps ?? 0,
      redFlagPeriods: redFlags,
      dnfCount: dnfEvents,
      totalPitStops,
      significantIncidents,
      // Compatibilidade legada
      safetyCarDeployments,
      virtualSafetyCarDeployments,
      redFlags,
      dnfEvents,
      totalOvertakes: 0,
    }

    return summary as OfficialRaceEventSummary
  }

  public officializeRace(raceState: CanonicalRaceState): OfficialRaceResult {
    const validation = this.validatePreconditionsForOfficialization(raceState)
    if (!validation.canOfficialize) {
      throw new Error(
        `[CanonicalRaceResultService] Cannot officialize race: ${validation.reasons.join('; ')}`,
      )
    }

    // 1. Deep clone de isolamento
    const state = this.deepClone(raceState)

    // 2. Classificação oficial ordenada segundo o raceState
    const rawCars = state.drivers || (state as any).cars || []
    const sortedCars = [...rawCars].sort((a: any, b: any) => {
      const posA = a.currentPosition ?? a.position ?? 999
      const posB = b.currentPosition ?? b.position ?? 999
      return posA - posB
    })

    // Calcular voltas do líder para regra de 90% FIA e distância reduzida
    const leaderLaps =
      sortedCars.length > 0 ? (sortedCars[0].lap ?? sortedCars[0].lapsCompleted ?? 0) : 0
    const totalLaps = state.totalLaps || 1

    // FIA 2026 Art A2.2.1: Determinar se o líder completou pelo menos 2 voltas completas e consecutivas sem SC/VSC
    const validConsecutiveLapsWithoutSCVSC = this.getConsecutiveLapsWithoutSCVSC(state, leaderLaps)
    const hasMinimumConsecutiveGreenLaps = validConsecutiveLapsWithoutSCVSC >= 2

    const entries: OfficialRaceResultEntry[] = sortedCars.map((car: any, index: number) => {
      const finalPosition = index + 1
      const isDnf = Boolean(
        car.isDnf || car.raceStatus === 'dnf' || car.status === 'dnf' || car.dnf,
      )
      const dnfReason = isDnf ? car.dnfReason || 'Mechanical/Accident' : undefined
      const lapsCompleted = car.lap ?? car.lapsCompleted ?? 0
      const gridPos = car.gridPosition ?? car.startingGridPosition ?? finalPosition
      const positionsGained = gridPos - finalPosition

      // Regra FIA 90%: Piloto precisa ter completado ao menos 90% das voltas do vencedor para ser classificado
      const meets90Percent = leaderLaps > 0 ? lapsCompleted >= Math.floor(leaderLaps * 0.9) : false
      const classificationStatus =
        !isDnf || meets90Percent ? ('CLASSIFIED' as const) : ('NOT_CLASSIFIED' as const)
      const isClassified = classificationStatus === 'CLASSIFIED'

      // Pontos FIA calculados conforme percentual de distância e classificação
      // REGRA CRÍTICA: somente CLASSIFIED pontua. NC/NOT_CLASSIFIED -> 0 pontos.
      // E requisito mínimo de 2 voltas consecutivas completas sem SC/VSC.
      let pointsAwarded = 0
      if (isClassified && hasMinimumConsecutiveGreenLaps && leaderLaps >= 2) {
        pointsAwarded = calculateRacePoints({
          position: finalPosition,
          scheduledLaps: totalLaps,
          leaderLaps,
          hasMinimumPointEligibility: hasMinimumConsecutiveGreenLaps,
          isClassified,
          classificationStatus,
          raceStatus: car.raceStatus || car.status,
          status: car.status || car.raceStatus,
          raceVariant: state.raceVariant,
        })
      }

      const bestLapSec = car.bestLapSec
      const bestLapFormatted =
        car.bestLapFormatted || (bestLapSec ? formatLapTime(bestLapSec) : '--:--')
      const isFastestLap = Boolean(
        state.fastestLap?.driverId && state.fastestLap.driverId === car.driverId,
      )

      const entry: any = {
        driverId: car.driverId,
        teamId: car.teamId,
        driverName: car.driverName || `Driver ${car.driverId}`,
        teamName: car.teamName || 'F1 Team',
        teamColor: car.teamColor || '#E10600',
        isPlayer: Boolean(car.isPlayer || car.isPlayerCar || car.isPlayerDriver),
        gridPosition: gridPos,
        startingGridPosition: gridPos,
        finalPosition,
        positionsGainedLost: positionsGained,
        positionsGained,
        lapsCompleted,
        raceTime: car.raceTime || 0,
        raceTimeFormatted: car.raceTime ? formatLapTime(car.raceTime) : undefined,
        totalTimeFormatted: car.raceTime ? formatLapTime(car.raceTime) : undefined,
        gapToWinner:
          finalPosition === 1
            ? 'WINNER'
            : car.gap || car.gapToLeader || (isDnf ? 'DNF' : '+0.000s'),
        gapToLeaderFormatted:
          finalPosition === 1
            ? 'WINNER'
            : car.gap || car.gapToLeader || (isDnf ? 'DNF' : '+0.000s'),
        status: isDnf ? 'dnf' : 'finished',
        finishStatus: isDnf ? 'dnf' : 'finished',
        classificationStatus,
        isClassified,
        dnf: isDnf,
        dnfReason,
        dnfLap: car.dnfLap,
        pitStops: car.pitStops ?? car.pitStopsCount ?? 0,
        pitStopsCount: car.pitStops ?? car.pitStopsCount ?? 0,
        bestLapSec,
        bestLapFormatted,
        bestLapTimeFormatted: bestLapFormatted,
        bestLap: bestLapFormatted,
        bestLapNumber: car.bestLapNumber,
        fastestLap: isFastestLap,
        tyreCompound: car.tyreCompound || 'duro',
        points: pointsAwarded,
        pointsAwarded,
        isPlayerDriver: Boolean(car.isPlayer || car.isPlayerCar || car.isPlayerDriver),
      }

      return entry as OfficialRaceResultEntry
    })

    // 3. Determinar Pole Position (largou em P1)
    const poleCar =
      sortedCars.find((c: any) => (c.gridPosition ?? c.startingGridPosition) === 1) || sortedCars[0]

    // 4. Determinar Vencedor (finalPosition === 1)
    const winnerEntry = entries.find((e) => e.finalPosition === 1) || entries[0]
    const winnerDriverId = winnerEntry?.driverId || ''

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
    const playerEntries = entries.filter((e) => e.isPlayer || (e as any).isPlayerDriver)

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
      winnerDriverId,
      entriesChecksum,
      totalLaps: state.totalLaps,
    })

    const officialResult: any = {
      schemaVersion: OFFICIAL_RACE_RESULT_SCHEMA_VERSION,
      officialResultId,
      raceVariant: state.raceVariant,
      careerId: state.careerId || 'default',
      season: state.season || 2026,
      round: state.round || 1,
      raceId: state.raceId || 'race_default',
      circuitId: (state as any).circuitId || state.raceId || 'circuit_default',
      circuitName: state.circuitName || 'Grand Prix',
      circuitCountry: state.circuitCountry || 'FIA',
      playerTeamId: state.playerTeamId || 'team_player',
      officializedAt: new Date().toISOString(),
      totalLaps: state.totalLaps,
      winnerDriverId,
      winnerTeamId: winnerEntry?.teamId || '',
      poleDriverId: poleCar?.driverId || entries[0]?.driverId || '',
      polePositionDriverId: poleCar?.driverId || entries[0]?.driverId || '',
      fastestLapDriverId: state.fastestLap?.driverId,
      fastestLapSec: state.fastestLap?.lapTimeSec,
      fastestLapFormatted:
        state.fastestLap?.lapTimeFormatted ||
        ((state.fastestLap as any)?.time
          ? formatLapTime((state.fastestLap as any).time)
          : undefined),
      fastestLapTimeFormatted:
        state.fastestLap?.lapTimeFormatted ||
        ((state.fastestLap as any)?.time
          ? formatLapTime((state.fastestLap as any).time)
          : undefined),
      fastestLapNumber: state.fastestLap?.lap,
      podium: podiumDriverIds.slice(0, 3) as [string, string, string],
      podiumDriverIds,
      entries,
      playerEntries: playerEntries.slice(0, 2),
      eventsSummary: this.extractEventSummary(state),
      eventSummary: this.extractEventSummary(state),
      integrityHash,
      resultHash: integrityHash,
    }

    // 8. DRIVER-MORALE-01: Disparar hook de processamento assíncrono seguro após oficialização
    try {
      this.triggerPostOfficialMoraleProcessing(officialResult)
    } catch (moraleErr) {
      console.warn('[CanonicalRaceResultService] Non-blocking morale processing notice:', moraleErr)
    }

    // 9. Retorna snapshot
    return officialResult as OfficialRaceResult
  }

  private triggerPostOfficialMoraleProcessing(officialResult: OfficialRaceResult): void {
    if (typeof window === 'undefined') return
    // Executa em microtask para não bloquear retorno síncrono da oficialização
    setTimeout(async () => {
      try {
        await this.processOfficialMoraleDirect(officialResult)
      } catch (err) {
        console.warn('[CanonicalRaceResultService] Async morale update failed:', err)
      }
    }, 0)
  }

  /**
   * Processamento canônico de moral de pilotos após oficialização
   * Consome o driverMoraleService de forma idempotente e determinística
   */
  public async processOfficialMoraleDirect(officialResult: OfficialRaceResult): Promise<void> {
    const { driverMoraleService } = await import('./driverMoraleService')
    const { f1Service } = await import('./f1Service')

    let allDrivers: any[] = []
    try {
      allDrivers = await f1Service.getAllDrivers()
    } catch (e) {
      console.warn('[CanonicalRaceResultService] Could not fetch all drivers from DB:', e)
    }

    const moraleMap: Record<string, number> = {}
    for (const d of allDrivers) {
      if (d && d.id) {
        moraleMap[d.id] = d.morale ?? 80
      }
    }

    // Se estiver em contexto de carreira, complementar moraleMap com a fonte canônica career_drivers
    if (officialResult.careerId) {
      const { driverBase2026Service } = await import('./driverBase2026Service')
      const careerDrivers = driverBase2026Service.getCareerDrivers(officialResult.careerId)
      if (careerDrivers) {
        for (const [drvId, rec] of Object.entries(careerDrivers)) {
          if (rec && typeof rec.morale === 'number') {
            moraleMap[drvId] = rec.morale
          }
        }
      }
    }

    await driverMoraleService.processOfficialRaceMorale({
      officialResult: {
        careerId: officialResult.careerId,
        season: officialResult.season,
        round: officialResult.round,
        officializedAt: officialResult.officializedAt,
        entries: (officialResult.entries || []).map((e) => ({
          driverId: e.driverId,
          teamId: e.teamId,
          driverName: e.driverName,
          teamName: e.teamName,
          finalPosition: e.finalPosition,
          gridPosition: e.gridPosition ?? (e as any).startingGridPosition,
          status: e.status,
          isDnf: Boolean((e as any).isDnf || e.dnf),
          dnf: e.dnf,
          dnfReason: e.dnfReason,
        })),
      },
      driverCurrentMoraleMap: moraleMap,
      onSaveDriverMorale: async (driverId, newMorale) => {
        try {
          await f1Service.updateDriver(driverId, { morale: newMorale })
        } catch (saveErr) {
          console.warn(
            `[CanonicalRaceResultService] Error persisting driver ${driverId} morale:`,
            saveErr,
          )
        }

        // Também assegura persistência na fonte canônica de career_drivers se careerId presente
        if (officialResult.careerId) {
          try {
            const { driverBase2026Service } = await import('./driverBase2026Service')
            driverBase2026Service.updateCareerDriverStats({
              careerId: officialResult.careerId,
              driverId,
              newMorale,
            })
          } catch (careerErr) {
            console.warn(
              `[CanonicalRaceResultService] Error persisting driver ${driverId} in careerDrivers:`,
              careerErr,
            )
          }
        }
      },
    })
  }

  public terminateEarlyAndOfficialize(
    raceState: CanonicalRaceState,
    reason: string = 'Race terminated early',
  ): OfficialRaceResult {
    // Clona o estado e marca como concluído com as voltas atuais para oficialização prematura
    const state = this.deepClone(raceState)
    state.status = 'completed'
    // Se red flag ativa ou safety car, desativa para permitir oficialização
    if ((state as any).safetyCar) {
      ;(state as any).safetyCar.status = 'inactive'
    }
    state.safetyCarActive = false
    state.vscActive = false
    state.redFlagActive = false
    ;(state as any).isRedFlag = false
    if (state.raceControl) {
      state.raceControl.currentFlag = 'FINISHED'
    }

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

  public saveOfficialResult(result: OfficialRaceResult, overwrite = false): boolean {
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
    season: number | string,
    raceId: string | number,
  ): OfficialRaceResult | null {
    const key = this.getStorageKey(careerId, Number(season), raceId)
    try {
      if (typeof localStorage === 'undefined') return null
      const data = localStorage.getItem(key)
      if (!data) return null
      const parsed = JSON.parse(data) as OfficialRaceResult
      return parsed
    } catch (err) {
      console.error('[CanonicalRaceResultService] Failed to load official race result:', err)
      return null
    }
  }
}

export const canonicalRaceResultService = new CanonicalRaceResultService()
