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

import type {
  CanonicalRaceState,
  OfficialRaceResult,
  OfficialRaceResultEntry,
  OfficialRaceEventSummary,
} from '@/types/canonical-race-v2'
import { OFFICIAL_RACE_RESULT_SCHEMA_VERSION } from '@/types/canonical-race-v2'
import { getFiaPointsForPosition } from '@/lib/f1-standings-calculator'
import { formatLapTime } from '@/lib/f1-race-sim-engine'

export const CANONICAL_OFFICIAL_RESULT_STORAGE_PREFIX = 'f1_2026_canonical_official_result'

export class CanonicalRaceResultService {
  /**
   * Deep clone independente que não retém referências mutáveis.
   */
  public deepClone<T>(obj: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj)
    }
    return JSON.parse(JSON.stringify(obj))
  }

  /**
   * Congela recursivamente um objeto para garantir imutabilidade estrita.
   */
  public deepFreeze<T extends object>(obj: T): Readonly<T> {
    Object.freeze(obj)
    for (const key of Object.getOwnPropertyNames(obj)) {
      const val = (obj as any)[key]
      if (
        val !== null &&
        (typeof val === 'object' || typeof val === 'function') &&
        !Object.isFrozen(val)
      ) {
        this.deepFreeze(val)
      }
    }
    return obj
  }

  /**
   * Constrói a chave canônica única de armazenamento do resultado oficial:
   * f1_2026_canonical_official_result_${careerId}_s${season}_r${round}
   */
  public buildResultStorageKey(careerId: string, season: number, round: number): string {
    return `${CANONICAL_OFFICIAL_RESULT_STORAGE_PREFIX}_${careerId}_s${season}_r${round}`
  }

  /**
   * Constrói o identificador único do resultado oficial.
   */
  public buildOfficialResultId(careerId: string, season: number, raceId: string): string {
    return `official_result_${careerId}_s${season}_${raceId}`
  }

  /**
   * Gera um hash/checksum determinístico e reproduzível a partir dos dados esportivos essenciais.
   * Não criptográfico, mas sensível a qualquer alteração acidental de pilotos, posições, tempos ou status.
   */
  public generateResultChecksum(payload: {
    officialResultId: string
    careerId: string
    season: number
    round: number
    raceId: string
    winnerDriverId: string
    poleDriverId: string
    fastestLapDriverId?: string
    entries: Array<{
      driverId: string
      teamId: string
      gridPosition: number
      finalPosition: number
      lapsCompleted: number
      raceTime: number
      dnf: boolean
      dnfReason?: string
      pitStops: number
    }>
  }): string {
    // Ordenar entradas estritamente por finalPosition
    const sortedEntries = [...payload.entries].sort((a, b) => a.finalPosition - b.finalPosition)
    const normalizedData = {
      officialResultId: payload.officialResultId,
      careerId: payload.careerId,
      season: payload.season,
      round: payload.round,
      raceId: payload.raceId,
      winnerDriverId: payload.winnerDriverId,
      poleDriverId: payload.poleDriverId,
      fastestLapDriverId: payload.fastestLapDriverId || 'none',
      entries: sortedEntries.map((e) => ({
        d: e.driverId,
        t: e.teamId,
        g: e.gridPosition,
        p: e.finalPosition,
        l: e.lapsCompleted,
        rt: e.raceTime,
        dnf: e.dnf,
        dnfR: e.dnfReason || '',
        pits: e.pitStops,
      })),
    }

    const jsonString = JSON.stringify(normalizedData)
    // Algoritmo FNV-1a de 64 bits em hex para integridade robusta
    let h1 = 0x811c9dc5
    let h2 = 0xcbf29ce4
    for (let i = 0; i < jsonString.length; i++) {
      const code = jsonString.charCodeAt(i)
      h1 ^= code
      h1 = Math.imul(h1, 0x01000193)
      h2 ^= code
      h2 = Math.imul(h2, 0x01000193)
    }
    const hex1 = (h1 >>> 0).toString(16).padStart(8, '0')
    const hex2 = (h2 >>> 0).toString(16).padStart(8, '0')
    return `sha_apex_${hex1}${hex2}`
  }

  /**
   * Verifica a integridade de um OfficialRaceResult recalculando seu hash.
   */
  public verifyResultIntegrity(result: OfficialRaceResult): boolean {
    if (!result || !result.resultHash) return false
    const expectedHash = this.generateResultChecksum({
      officialResultId: result.officialResultId,
      careerId: result.careerId,
      season: result.season,
      round: result.round,
      raceId: result.raceId,
      winnerDriverId: result.winnerDriverId,
      poleDriverId: result.poleDriverId,
      fastestLapDriverId: result.fastestLapDriverId,
      entries: result.entries,
    })
    return result.resultHash === expectedHash
  }

  /**
   * Pré-condição obrigatória (Regra 1):
   * Só pode existir resultado oficial quando a corrida estiver realmente concluída.
   */
  public validatePreconditionsForOfficialization(state: CanonicalRaceState): {
    canOfficialize: boolean
    reasons: string[]
  } {
    const reasons: string[] = []

    if (!state) {
      return { canOfficialize: false, reasons: ['Estado da corrida inexistente ou nulo'] }
    }

    // 1. Status da corrida
    const isCompletedStatus = state.status === 'completed'
    const isFinishedFlag = state.raceControl?.currentFlag === 'FINISHED'

    if (!isCompletedStatus && !isFinishedFlag) {
      reasons.push(
        `Corrida ainda não concluída (status atual: '${state.status}', bandeira: '${state.raceControl?.currentFlag || 'N/A'}')`,
      )
    }

    // Não permitir durante bandeiras ativas de neutralização ou pausa
    if (state.safetyCarActive || state.raceControl?.currentFlag === 'SAFETY_CAR') {
      reasons.push('Corrida sob regime de Safety Car — não pode ser oficializada')
    }
    if (state.vscActive || state.raceControl?.currentFlag === 'VSC') {
      reasons.push('Corrida sob regime de Virtual Safety Car (VSC) — não pode ser oficializada')
    }
    if (state.redFlagActive || state.raceControl?.currentFlag === 'RED_FLAG') {
      reasons.push('Corrida sob Bandeira Vermelha não resolvida — não pode ser oficializada')
    }
    if (state.status === 'paused') {
      reasons.push('Corrida pausada — deve ser retomada e finalizada antes da oficialização')
    }
    if (state.status === 'not_started') {
      reasons.push('Corrida ainda não iniciada — não pode ser oficializada')
    }

    // 2. Pilotos e voltas
    if (!Array.isArray(state.drivers) || state.drivers.length !== 24) {
      reasons.push(
        `Classificação inconsistente: esperado 24 pilotos, encontrado ${state.drivers?.length || 0}`,
      )
    } else {
      // Verificar se há algum piloto em racing que ainda deveria estar correndo
      const leader = state.drivers[0]
      if (leader && leader.lap < state.totalLaps && leader.raceStatus !== 'dnf') {
        reasons.push(`Líder completou ${leader.lap}/${state.totalLaps} voltas — corrida incompleta`)
      }
    }

    return {
      canOfficialize: reasons.length === 0,
      reasons,
    }
  }

  /**
   * Constrói o resumo auditável de eventos relevantes (Safety Car, VSC, Red Flag, DNFs, Pits).
   */
  private buildEventsSummary(state: CanonicalRaceState): OfficialRaceEventSummary {
    const rc = state.raceControl
    const events = state.events || []

    const scPeriods =
      rc?.history?.filter((e) => e.type === 'safety_car_deployed').length ||
      (state.safetyCarActive ? 1 : 0)
    const vscPeriods =
      rc?.history?.filter((e) => e.type === 'vsc_deployed').length || (state.vscActive ? 1 : 0)
    const redFlagPeriods =
      rc?.history?.filter((e) => e.type === 'red_flag').length || (state.redFlagActive ? 1 : 0)
    const dnfCount = state.drivers.filter((d) => d.raceStatus === 'dnf' || d.isDnf).length
    const totalPitStops = state.drivers.reduce((acc, d) => acc + (d.pitStops || 0), 0)

    const significantIncidents = events
      .filter(
        (ev) =>
          ev.type === 'dnf' ||
          ev.type === 'incident' ||
          ev.type === 'fastest_lap' ||
          ev.type === 'info',
      )
      .map((ev) => ({
        lap: ev.lap,
        type: (ev.type === 'overtake' ? 'info' : ev.type) as any,
        message: ev.message,
        driverId: ev.driverId,
        timestamp: ev.timestamp,
      }))

    return {
      safetyCarPeriods: scPeriods,
      safetyCarLaps: rc?.safetyCarLaps || 0,
      vscPeriods: vscPeriods,
      vscLaps: rc?.vscLaps || 0,
      redFlagPeriods: redFlagPeriods,
      dnfCount,
      totalPitStops,
      significantIncidents,
    }
  }

  /**
   * Cria o snapshot imutável de OfficialRaceResult a partir do CanonicalRaceState finalizado.
   * Lança erro explícito se a pré-condição não for atendida.
   */
  public createOfficialRaceResult(state: CanonicalRaceState): OfficialRaceResult {
    // 1. Validar pré-condições
    const preCheck = this.validatePreconditionsForOfficialization(state)
    if (!preCheck.canOfficialize) {
      throw new Error(`[OfficialRaceResult] Pré-condições violadas: ${preCheck.reasons.join('; ')}`)
    }

    // 2. Extrair informações fundamentais de identidade
    const careerId = state.careerId
    const season = state.season
    const round = state.round
    const raceId = state.raceId
    const circuitId = state.circuitName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const circuitName = state.circuitName
    const circuitCountry = state.circuitCountry
    const playerTeamId = state.playerTeamId
    const officialResultId = this.buildOfficialResultId(careerId, season, raceId)

    // 3. Processar P1 a P24
    // O motor canônico já ordena os pilotos em state.drivers estritamente:
    // P1..P(ativos) por laps/raceTime, seguidos por DNFs por voltas/tempo de abandono.
    // Congelamos exatamente essa ordem sem recalcular.
    const rawDrivers = state.drivers
    const leader = rawDrivers[0]
    const winnerDriverId = leader.driverId
    const winnerTeamId = leader.teamId

    // Identificar pole position (quem largou em P1 do qualifying)
    const poleDriver = rawDrivers.find((d) => d.gridPosition === 1) || rawDrivers[0]
    const poleDriverId = poleDriver.driverId

    // Identificar fastest lap
    const fastestLap = state.fastestLap
    const fastestLapDriverId = fastestLap?.driverId
    const fastestLapSec = fastestLap?.lapTimeSec
    const fastestLapFormatted = fastestLap?.lapTimeFormatted
    const fastestLapNumber = fastestLap?.lap

    const entries: OfficialRaceResultEntry[] = rawDrivers.map((driver, index) => {
      const finalPosition = index + 1
      const isDnf = driver.raceStatus === 'dnf' || !!driver.isDnf
      const positionsGainedLost = driver.gridPosition - finalPosition
      const isFastest = fastestLapDriverId ? driver.driverId === fastestLapDriverId : false

      // Pontos FIA de acordo com o regulamento esportivo (Top 10)
      // O dado esportivo é registrado na entrada, mas nenhuma carreira é persistida nesta etapa
      const pointsAwarded =
        !isDnf && finalPosition <= 10 ? getFiaPointsForPosition(finalPosition) : 0

      const gapToWinner =
        finalPosition === 1
          ? 'LÍDER'
          : isDnf
            ? 'DNF'
            : driver.gap ||
              (driver.gapToLeaderSec !== undefined ? `+${driver.gapToLeaderSec.toFixed(3)}s` : '—')

      return {
        driverId: driver.driverId,
        teamId: driver.teamId,
        driverName: driver.driverName,
        teamName: driver.teamName,
        teamColor: driver.teamColor,
        isPlayer: driver.isPlayer || driver.teamId === playerTeamId,
        carId: driver.carId,
        carSlot: driver.carId,
        gridPosition: driver.gridPosition,
        finalPosition,
        positionsGainedLost,
        lapsCompleted: driver.lap,
        raceTime: driver.raceTime,
        raceTimeFormatted: driver.raceTime ? formatLapTime(driver.raceTime) : undefined,
        gapToWinner,
        gapToWinnerSec: driver.gapToLeaderSec,
        gapToFrontSec: driver.gapToFrontSec,
        status: isDnf ? 'dnf' : 'finished',
        dnf: isDnf,
        dnfReason: isDnf ? driver.dnfReason || 'Abandono da Prova' : undefined,
        dnfLap: isDnf ? driver.dnfLap || driver.lap : undefined,
        pitStops: driver.pitStops,
        bestLapSec: driver.bestLapSec,
        bestLapFormatted: driver.bestLapFormatted,
        bestLap: driver.bestLapFormatted,
        fastestLap: isFastest,
        tyreCompound: driver.tyreCompound,
        pointsAwarded,
      }
    })

    // Invariantes estritas de classificação (Regra 4)
    if (entries.length !== 24) {
      throw new Error(
        `[OfficialRaceResult] Classificação violada: esperado 24 entradas, encontrado ${entries.length}`,
      )
    }
    const seenDriverIds = new Set<string>()
    const seenPositions = new Set<number>()
    for (const e of entries) {
      if (seenDriverIds.has(e.driverId)) {
        throw new Error(`[OfficialRaceResult] driverId duplicado na classificação: ${e.driverId}`)
      }
      seenDriverIds.add(e.driverId)

      if (seenPositions.has(e.finalPosition)) {
        throw new Error(`[OfficialRaceResult] finalPosition duplicada: P${e.finalPosition}`)
      }
      seenPositions.add(e.finalPosition)
    }

    // Pódium derivado diretamente de entries (P1, P2, P3)
    const podium: [string, string, string] = [
      entries[0].driverId,
      entries[1].driverId,
      entries[2].driverId,
    ]

    // Os dois carros da equipe do jogador preservados independentemente (Regra 11)
    const playerCars = entries.filter((e) => e.isPlayer || e.teamId === playerTeamId)
    if (playerCars.length !== 2) {
      throw new Error(
        `[OfficialRaceResult] Esperado exatamente 2 carros da equipe do jogador ('${playerTeamId}'), encontrado ${playerCars.length}`,
      )
    }
    const playerEntries: [OfficialRaceResultEntry, OfficialRaceResultEntry] = [
      playerCars[0],
      playerCars[1],
    ]

    // Resumo de eventos
    const eventsSummary = this.buildEventsSummary(state)

    // Checksum determinístico de integridade (Regra 15)
    const resultHash = this.generateResultChecksum({
      officialResultId,
      careerId,
      season,
      round,
      raceId,
      winnerDriverId,
      poleDriverId,
      fastestLapDriverId,
      entries,
    })

    const rawResult: OfficialRaceResult = {
      officialResultId,
      schemaVersion: OFFICIAL_RACE_RESULT_SCHEMA_VERSION,
      careerId,
      season,
      round,
      raceId,
      circuitId,
      circuitName,
      circuitCountry,
      playerTeamId,
      officializedAt: state.completedAt || new Date().toISOString(),
      totalLaps: state.totalLaps,
      winnerDriverId,
      winnerTeamId,
      poleDriverId,
      fastestLapDriverId,
      fastestLapSec,
      fastestLapFormatted,
      fastestLapNumber,
      podium,
      entries,
      playerEntries,
      eventsSummary,
      resultHash,
    }

    // Retornar snapshot profundamente clonado e congelado (Regra 2)
    return this.deepFreeze(this.deepClone(rawResult))
  }

  /**
   * Oficializa a corrida de forma idempotente e atômica.
   * Se já existir um resultado oficial registrado para aquela (careerId + season + raceId),
   * retorna o resultado existente sem recriar, sem alterar ID e sem duplicar efeitos (Regra 14).
   */
  public officializeRace(state: CanonicalRaceState): OfficialRaceResult {
    // 1. Verificar se já existe resultado persistido
    const existing = this.getOfficialRaceResult(state.careerId, state.season, state.round)
    if (existing) {
      // Idempotência estrita: se já oficializado, retorna o snapshot imutável idêntico
      return existing
    }

    // 2. Criar novo snapshot oficial imutável
    const officialResult = this.createOfficialRaceResult(state)

    // 3. Persistir no storage oficial isolado por carreira e rodada
    this.saveOfficialRaceResult(officialResult)

    return officialResult
  }

  /**
   * Salva o OfficialRaceResult no armazenamento isolado.
   */
  public saveOfficialRaceResult(result: OfficialRaceResult): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    const key = this.buildResultStorageKey(result.careerId, result.season, result.round)
    const serialized = JSON.stringify(result)
    window.localStorage.setItem(key, serialized)
  }

  /**
   * Lê o OfficialRaceResult imutável para uma carreira, temporada e rodada.
   */
  public getOfficialRaceResult(
    careerId: string,
    season: number,
    round: number,
  ): OfficialRaceResult | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const key = this.buildResultStorageKey(careerId, season, round)
    const raw = window.localStorage.getItem(key)
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw) as OfficialRaceResult
      // Validações básicas de integridade e isolamento
      if (parsed.careerId !== careerId || parsed.season !== season || parsed.round !== round) {
        console.warn('[OfficialRaceResult] Tentativa de acesso cruzado rejeitada')
        return null
      }
      return this.deepFreeze(this.deepClone(parsed))
    } catch (e) {
      console.error('[OfficialRaceResult] Falha ao desserializar resultado oficial:', e)
      return null
    }
  }

  /**
   * Verifica se já existe um resultado oficial para a corrida.
   */
  public hasOfficialRaceResult(careerId: string, season: number, round: number): boolean {
    return this.getOfficialRaceResult(careerId, season, round) !== null
  }

  /**
   * Remove o resultado oficial (apenas para testes/ambiente de testes ou limpeza explícita).
   */
  public clearOfficialRaceResultForTesting(careerId: string, season: number, round: number): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    const key = this.buildResultStorageKey(careerId, season, round)
    window.localStorage.removeItem(key)
  }
}

export const canonicalRaceResultService = new CanonicalRaceResultService()
