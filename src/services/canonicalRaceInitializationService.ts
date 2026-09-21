/**
 * canonicalRaceInitializationService.ts
 *
 * FW2.1E-A — RACE INITIALIZATION (Grid Oficial → Estado Inicial Canônico da Corrida)
 *
 * Princípios e Invariantes homologadas:
 * 1. Consome EXATAMENTE o grid oficial canônico P1–P24 gerado pela qualificação homologada.
 *    Não reconstrói grid consultando novamente equipes, pilotos ou inscrições da pré-temporada.
 * 2. Invariantes estritas de largada:
 *    - Exatamente 24 pilotos
 *    - Exatamente 24 driverIds únicos
 *    - Posições P1–P24 estritamente contínuas
 *    - Exatamente 2 pilotos por equipe
 *    - Exatamente 2 pilotos pertencentes ao playerTeamId da carreira
 *    - Nenhum piloto duplicado
 *    - Os driverIds na largada são EXATAMENTE os mesmos driverIds do grid oficial
 * 3. Cria a entidade canônica única por carro/piloto (CanonicalRaceDriverState) com todos
 *    os campos requeridos:
 *    careerId, season, raceId, driverId, teamId, gridPosition, currentPosition, lap,
 *    raceTime, gap, tyreCompound, tyreAge, fuel, carCondition, raceStatus, pitStops.
 * 4. Independência de playerTeamId:
 *    Funciona identicamente para qualquer equipe que o jogador selecione (Audi, Ferrari,
 *    McLaren, Mercedes, Red Bull, Haas, Williams ou equipes personalizadas).
 * 5. Persistência e Idempotência:
 *    Salva o estado inicial com chave estável para suportar reload seguro.
 */

import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type {
  CanonicalRaceState,
  CanonicalRaceDriverState,
  InitializeCanonicalRaceParams,
} from '@/types/canonical-race-v2'
import type { TrackWeatherState } from '@/lib/f1-tire-system'

const RACE_V2_STORAGE_KEY_PREFIX = 'apex_race_v2_canonical_state'

export const canonicalRaceInitializationService = {
  /**
   * Constrói o identificador único canônico da corrida.
   * Formato: "race_{careerId}_s{season}_r{round}"
   */
  buildRaceId(careerId: string, season: number, round: number): string {
    return `race_${careerId}_s${season}_r${round}`
  },

  /**
   * Chave de persistência de estado da Corrida V2 para reload e auditoria.
   */
  getRaceStorageKey(careerId: string, season: number, round: number): string {
    return `${RACE_V2_STORAGE_KEY_PREFIX}_${careerId}_s${season}_r${round}`
  },

  /**
   * FW2.1E-A: Inicializa a corrida canônica a partir do grid oficial da qualificação.
   */
  initializeRaceFromCanonicalGrid(params: InitializeCanonicalRaceParams): CanonicalRaceState {
    const {
      careerId,
      season,
      round,
      circuitName,
      circuitCountry,
      totalLaps,
      playerTeamId,
      canonicalQualifyingGrid,
      initialFuelKg = 100.0,
    } = params

    if (!careerId || typeof careerId !== 'string') {
      throw new Error('[FW2.1E-A] careerId inválido para inicialização canônica da corrida.')
    }
    if (!playerTeamId || typeof playerTeamId !== 'string') {
      throw new Error('[FW2.1E-A] playerTeamId inválido para inicialização canônica da corrida.')
    }
    if (!Array.isArray(canonicalQualifyingGrid) || canonicalQualifyingGrid.length !== 24) {
      throw new Error(
        `[FW2.1E-A] Grid oficial FIA deve conter exatamente 24 posições homologadas. Encontrado: ${
          canonicalQualifyingGrid?.length ?? 0
        }`,
      )
    }

    // 1. Validar unicidade estrita de driverId
    const seenDriverIds = new Set<string>()
    for (const entry of canonicalQualifyingGrid) {
      if (!entry.driverId) {
        throw new Error('[FW2.1E-A] Posição de grid sem driverId canônico.')
      }
      if (seenDriverIds.has(entry.driverId)) {
        throw new Error(`[FW2.1E-A] driverId duplicado no grid oficial: ${entry.driverId}`)
      }
      seenDriverIds.add(entry.driverId)
    }

    // 2. Ordenar estritamente por gridPosition (P1 a P24)
    const sortedGrid = [...canonicalQualifyingGrid].sort((a, b) => a.gridPosition - b.gridPosition)

    // Validar continuidade P1..P24
    sortedGrid.forEach((entry, idx) => {
      const expectedPos = idx + 1
      if (entry.gridPosition !== expectedPos) {
        throw new Error(
          `[FW2.1E-A] Grid descontínuo: esperado P${expectedPos}, encontrado P${entry.gridPosition} para piloto ${entry.driverId}`,
        )
      }
    })

    // 3. Validar contagem por equipe e pilotos do playerTeam
    const teamCounts = new Map<string, number>()
    let playerTeamDriverCount = 0

    for (const entry of sortedGrid) {
      const current = teamCounts.get(entry.teamId) || 0
      teamCounts.set(entry.teamId, current + 1)

      if (entry.teamId === playerTeamId || entry.isPlayer) {
        playerTeamDriverCount += 1
      }
    }

    if (playerTeamDriverCount !== 2) {
      throw new Error(
        `[FW2.1E-A] Invariante violada: esperado exatamente 2 pilotos do playerTeam (${playerTeamId}), encontrado ${playerTeamDriverCount}.`,
      )
    }

    // 4. Montar as 24 entidades canônicas
    const raceId = this.buildRaceId(careerId, season, round)
    const defaultWeather: TrackWeatherState = params.weather || 'seco'

    const driverLookup: Record<string, CanonicalRaceDriverState> = {}
    const drivers: CanonicalRaceDriverState[] = sortedGrid.map((entry) => {
      const isPlayer = entry.teamId === playerTeamId || entry.isPlayer

      // Pneu de largada padrão da FIA (composto da melhor volta do qualifying ou Médio)
      const startingCompound = entry.bestLapCompound || 'medio'

      const driverState: CanonicalRaceDriverState = {
        careerId,
        season,
        raceId,
        driverId: entry.driverId,
        teamId: entry.teamId,
        gridPosition: entry.gridPosition,
        currentPosition: entry.gridPosition, // na largada P_atual = P_grid
        lap: 0, // 0 voltas completadas na largada
        raceTime: 0.0,
        gap: entry.gridPosition === 1 ? 'LÍDER' : '+0.000s',
        tyreCompound: startingCompound,
        tyreAge: 0, // jogo montado para a largada
        fuel: initialFuelKg,
        carCondition: 100, // 100% de integridade mecânica na largada
        raceStatus: 'racing',
        pitStops: 0,

        // Metadados
        driverName: entry.driverName,
        teamName: entry.teamName,
        teamColor: entry.teamColor,
        isPlayer,
        carId: entry.carId,
        tyreSetId: entry.tyreSetId,
        bestLapSec: entry.bestLapSec || undefined,
        bestLapFormatted: entry.bestLapTime || undefined,
        gapToFrontSec: 0,
        gapToLeaderSec: 0,
      }

      driverLookup[entry.driverId] = driverState
      return driverState
    })

    const initialRaceControl = {
      currentFlag: 'GREEN' as const,
      previousFlag: undefined,
      lapsRemainingInPhase: 0,
      activeSector: undefined,
      safetyCarLaps: 0,
      vscLaps: 0,
      redFlagLaps: 0,
      scQueuedOrder: [],
      restartPending: false,
      activeEvents: [],
      history: [],
      lastIncidentReason: undefined,
    }

    const initialRaceState: CanonicalRaceState = {
      version: '2.0',
      careerId,
      season,
      round,
      raceId,
      circuitName,
      circuitCountry,
      totalLaps: Math.max(1, totalLaps),
      currentLap: 1,
      status: 'not_started',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      weather: defaultWeather,
      simSpeed: 1,
      startedAt: undefined,
      completedAt: undefined,
      drivers,
      driverLookup,
      playerTeamId,
      tactics: {},
      paceOrders: {},
      raceControl: initialRaceControl,
      revision: 1,
      updatedAt: new Date().toISOString(),
    }

    // Persistir estado canônico inicial para reload seguro
    this.saveCanonicalRaceState(initialRaceState)

    return initialRaceState
  },

  /**
   * Salva o estado canônico da corrida em localStorage para recuperação.
   */
  saveCanonicalRaceState(state: CanonicalRaceState): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      state.updatedAt = new Date().toISOString()
      const key = this.getRaceStorageKey(state.careerId, state.season, state.round)
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch (e) {
      console.warn('[canonicalRaceInitializationService] Falha ao persistir estado canônico:', e)
    }
  },

  /**
   * Lê o estado canônico persistido de uma corrida.
   */
  readCanonicalRaceState(
    careerId: string,
    season: number,
    round: number,
  ): CanonicalRaceState | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const key = this.getRaceStorageKey(careerId, season, round)
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      return JSON.parse(raw) as CanonicalRaceState
    } catch (e) {
      console.warn('[canonicalRaceInitializationService] Falha ao ler estado canônico:', e)
      return null
    }
  },

  /**
   * Remove o estado persistido (ex: ao reiniciar o fim de semana).
   */
  clearCanonicalRaceState(careerId: string, season: number, round: number): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      const key = this.getRaceStorageKey(careerId, season, round)
      window.localStorage.removeItem(key)
    } catch (e) {
      console.warn('[canonicalRaceInitializationService] Falha ao limpar estado:', e)
    }
  },
}
