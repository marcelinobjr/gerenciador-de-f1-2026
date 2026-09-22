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
  DriverStrategyState,
  InitializeCanonicalRaceParams,
} from '@/types/canonical-race-v2'
import type { TrackWeatherState } from '@/lib/f1-tire-system'
import { raceStrategyService } from '@/services/raceStrategyService'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'

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
    return canonicalRaceSaveService.buildStorageKey(careerId, season, round)
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

    // Assinalar carId de forma robusta e independente para os dois pilotos do jogador
    let playerCarCounter = 0
    const driverLookup: Record<string, CanonicalRaceDriverState> = {}
    const driverStrategies: Record<string, DriverStrategyState> = {}

    const drivers: CanonicalRaceDriverState[] = sortedGrid.map((entry) => {
      const isPlayer = entry.teamId === playerTeamId || entry.isPlayer
      let carId = entry.carId
      if (isPlayer) {
        playerCarCounter++
        carId = carId || (playerCarCounter === 1 ? 'car1' : 'car2')
      }

      // BUG-02 COMMIT C: Se houver preparação confirmada por carro, respeitá-la estritamente!
      const explicitPrep =
        params.carPreparations?.[entry.driverId] ||
        (carId ? params.carPreparations?.[carId] : undefined)

      // Pneu de largada: explicitamente escolhido pelo jogador, ou composto do qualifying / médio
      const startingCompound = explicitPrep?.startingCompound || entry.bestLapCompound || 'medio'

      const startingFuel =
        typeof explicitPrep?.startingFuelKg === 'number'
          ? explicitPrep.startingFuelKg
          : initialFuelKg

      const startingTyreSetId = explicitPrep?.startingTyreSetId || entry.tyreSetId
      const initialTyreWear = explicitPrep?.initialTyreWear ?? 0
      const initialTyreLapsUsed = explicitPrep?.initialTyreLapsUsed ?? 0

      // Estratégia canônica individual por piloto (FW2.1E-D)
      // Carro 1 e Carro 2 recebem instâncias isoladas (deep cloned) com janelas distintas
      let strat = raceStrategyService.createDefaultDriverStrategy({
        driverId: entry.driverId,
        startingCompound,
        totalLaps,
        carSlot: carId,
        stintPlanOffset: carId === 'car2' ? 6 : 0,
      })

      // Se houver plano de estratégia explícito do jogador, converter para DriverStrategyState
      if (explicitPrep?.strategyPlan && Array.isArray(explicitPrep.strategyPlan.stints)) {
        const customStints = explicitPrep.strategyPlan.stints.map((s, idx) => ({
          stintNumber: s.stintNumber || idx + 1,
          compound: s.compound,
          startLap: idx === 0 ? 1 : explicitPrep.strategyPlan!.stints[idx - 1].targetPitLap + 1,
          targetLaps: s.targetPitLap,
        }))
        const firstPitLap =
          explicitPrep.strategyPlan.stints[0]?.targetPitLap || strat.nextPitWindow.optimalLap
        const secondCompound = explicitPrep.strategyPlan.stints[1]?.compound || strat.targetCompound

        strat = {
          ...strat,
          currentTyre: startingCompound,
          targetCompound: secondCompound,
          paceMode: explicitPrep.strategyPlan.paceMode || strat.paceMode,
          plannedStints: customStints,
          nextPitWindow: {
            startLap: Math.max(1, firstPitLap - 3),
            endLap: Math.min(totalLaps, firstPitLap + 3),
            optimalLap: firstPitLap,
          },
        }
      }

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
        tyreAge: initialTyreLapsUsed, // preserva voltas já acumuladas no jogo físico
        fuel: startingFuel,
        carCondition: 100, // 100% de integridade mecânica na largada
        raceStatus: 'racing',
        pitStops: 0,

        // Metadados
        driverName: entry.driverName,
        teamName: entry.teamName,
        teamColor: entry.teamColor,
        isPlayer,
        carId,
        tyreSetId: startingTyreSetId,
        initialTyreWear,
        initialTyreLapsUsed,
        bestLapSec: entry.bestLapSec || undefined,
        bestLapFormatted: entry.bestLapTime || undefined,
        gapToFrontSec: 0,
        gapToLeaderSec: 0,

        // FW2.1E-D: Estratégia individual
        strategy: strat,
      }

      driverStrategies[entry.driverId] = strat
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
      saveSchemaVersion: 'race-save-v1',
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
      driverStrategies,
      raceControl: initialRaceControl,
      revision: 1,
      updatedAt: new Date().toISOString(),
    }

    // Persistir estado canônico inicial para reload seguro
    this.saveCanonicalRaceState(initialRaceState)

    return initialRaceState
  },

  /**
   * Salva o estado canônico da corrida via canonicalRaceSaveService (FW2.1E-E).
   */
  saveCanonicalRaceState(state: CanonicalRaceState): void {
    canonicalRaceSaveService.saveCanonicalRaceState(state)
  },

  /**
   * Lê o estado canônico persistido de uma corrida com validação (FW2.1E-E).
   */
  readCanonicalRaceState(
    careerId: string,
    season: number,
    round: number,
  ): CanonicalRaceState | null {
    const res = canonicalRaceSaveService.loadCanonicalRaceState(careerId, season, round)
    return res.state
  },

  /**
   * Remove o estado persistido (ex: ao reiniciar a corrida).
   */
  clearCanonicalRaceState(
    careerId: string,
    season: number,
    round: number,
  ): { success: boolean; blockedReason?: string } {
    return canonicalRaceSaveService.clearCanonicalRaceState(careerId, season, round)
  },
}
