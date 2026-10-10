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
import { weatherGenerator } from '@/services/weatherGenerator'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { calculateRequiredStartingFuelKg } from '@/services/canonicalFuelModel'
import { canonicalPowerUnitAllocationService } from '@/services/canonicalPowerUnitAllocationService'

const RACE_V2_STORAGE_KEY_PREFIX = 'apex_race_v2_canonical_state'

export const canonicalRaceInitializationService = {
  /**
   * Constrói o identificador único canônico da corrida.
   * Formato: "race_{careerId}_s{season}_r{round}" ou "race_{careerId}_s{season}_r{round}_sprint"
   */
  buildRaceId(
    careerId: string,
    season: number,
    round: number,
    raceVariant: import('@/types/canonical-race-v2').RaceVariant = 'MAIN_RACE',
  ): string {
    if (raceVariant === 'SPRINT_RACE') {
      return `race_${careerId}_s${season}_r${round}_sprint`
    }
    return `race_${careerId}_s${season}_r${round}`
  },

  /**
   * Chave de persistência de estado da Corrida V2 para reload e auditoria.
   */
  getRaceStorageKey(
    careerId: string,
    season: number,
    round: number,
    raceVariant: import('@/types/canonical-race-v2').RaceVariant = 'MAIN_RACE',
  ): string {
    return canonicalRaceSaveService.buildStorageKey(careerId, season, round, raceVariant)
  },

  /**
   * FW2.1E-A: Inicializa a corrida canônica a partir do grid oficial da qualificação.
   */
  initializeRaceFromCanonicalGrid(params: InitializeCanonicalRaceParams): CanonicalRaceState {
    const {
      raceVariant = 'MAIN_RACE',
      careerId,
      season,
      round,
      circuitName,
      circuitCountry,
      totalLaps,
      playerTeamId,
      canonicalQualifyingGrid,
    } = params

    // FUEL-01B: Resolver circuitLengthKm canônico da corrida
    let resolvedCircuitLengthKm = params.circuitLengthKm
    if (!resolvedCircuitLengthKm && round) {
      const calGp = F1_2026_CALENDAR.find((g) => g.round === round)
      if (calGp?.circuitLengthKm) resolvedCircuitLengthKm = calGp.circuitLengthKm
    }
    if (!resolvedCircuitLengthKm && circuitName) {
      const lower = circuitName.toLowerCase()
      const calGp = F1_2026_CALENDAR.find(
        (g) =>
          g.circuit.toLowerCase().includes(lower) ||
          g.name.toLowerCase().includes(lower) ||
          lower.includes(g.circuit.toLowerCase()) ||
          lower.includes(g.name.toLowerCase()) ||
          (lower.includes('interlagos') &&
            (g.circuit.toLowerCase().includes('interlagos') ||
              g.name.toLowerCase().includes('são paulo') ||
              g.name.toLowerCase().includes('brasil'))),
      )
      if (calGp?.circuitLengthKm) resolvedCircuitLengthKm = calGp.circuitLengthKm
    }

    // FUEL-01B: Calcular requiredStartingFuelKg canônico automático
    let autoCalculatedFuel: number | undefined
    if (resolvedCircuitLengthKm && resolvedCircuitLengthKm > 0 && totalLaps && totalLaps > 0) {
      autoCalculatedFuel = calculateRequiredStartingFuelKg(totalLaps, resolvedCircuitLengthKm, 1.0)
    }

    // Default quando metadata não estiver presente fica 100.0 (fallback legado apenas se metadata ausente)
    const defaultInitialFuel =
      typeof params.initialFuelKg === 'number'
        ? params.initialFuelKg
        : (autoCalculatedFuel ?? 100.0)

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

    // 4. Resolver Weather Event determinístico da edição (CLIMATE-01)
    const weatherEvent =
      params.weatherEvent ||
      weatherGenerator.generateRaceWeekendWeather({
        careerId,
        seasonYear: season,
        round,
        totalLaps,
        circuitName,
        country: circuitCountry,
      })

    const initialWeather: TrackWeatherState =
      params.weather || weatherEvent.initialWeather || 'seco'

    // 4. Montar as 24 entidades canônicas
    const raceId = this.buildRaceId(careerId, season, round, raceVariant)

    // PU-05A2-P2a: Resolver a alocação montada via canonicalPowerUnitAllocationService (fonte autoritativa do P1)
    let playerAllocation:
      | import('@/services/canonicalPowerUnitAllocationService').PowerUnitCarAllocation
      | null = null
    let playerTeamEngineHistory: any[] = []
    if (params.playerTeam && (!params.playerTeam.id || params.playerTeam.id === playerTeamId)) {
      playerAllocation = canonicalPowerUnitAllocationService.resolveAllocation({
        team: params.playerTeam,
        careerId,
      })
      playerTeamEngineHistory = params.playerTeam.engine_history || []
      // Validação estrita da alocação da nova sessão:
      const val = canonicalPowerUnitAllocationService.validateAllocation(
        playerAllocation.car1Unit,
        playerAllocation.car2Unit,
        params.playerTeam,
      )
      if (!val.valid) {
        throw new Error(
          `[PU-05A2-P2a] Alocação de Unidade de Potência inválida para a nova corrida: ${val.error}`,
        )
      }
      if (playerAllocation.teamId && playerAllocation.teamId !== playerTeamId) {
        throw new Error(
          `[PU-05A2-P2a] Alocação pertence a outra equipe (${playerAllocation.teamId}) e não à equipe do jogador (${playerTeamId}).`,
        )
      }
      if (playerAllocation.careerId && playerAllocation.careerId !== careerId) {
        throw new Error(
          `[PU-05A2-P2a] Alocação pertence a outro save/carreira (${playerAllocation.careerId}) e não ao save ativo (${careerId}).`,
        )
      }
    }

    // PU-05A2-P2a: Mapear pilotos do jogador de forma consistente e estável
    // Se o grid contiver identificador de carro explícito (entry.carId), preservá-lo.
    // Caso contrário, associar pelo ID do piloto do jogador ou mapeamento determinístico.
    const driverLookup: Record<string, CanonicalRaceDriverState> = {}
    const driverStrategies: Record<string, DriverStrategyState> = {}

    const isWetWeather = initialWeather === 'chuva_fraca' || initialWeather === 'chuva_forte'

    // Identificar previamente os pilotos do jogador presentes no grid para assinalar car1/car2
    // de forma determinística e independente da ordem de classificação no grid
    const playerDriversInGrid = sortedGrid.filter((e) => e.teamId === playerTeamId || e.isPlayer)
    // Se ambos tiverem entry.carId já definido, respeitar. Se não, se o primeiro piloto já tiver carId, manter.
    // Se nenhum tiver carId explícito, indexar pela ordem em playerDriversInGrid ou identificador estável.
    const playerAssignedCarMap = new Map<string, 'car1' | 'car2'>()
    playerDriversInGrid.forEach((entry, idx) => {
      if (entry.carId === 'car1' || entry.carId === 'car2') {
        playerAssignedCarMap.set(entry.driverId, entry.carId)
      } else {
        playerAssignedCarMap.set(entry.driverId, idx === 0 ? 'car1' : 'car2')
      }
    })

    const drivers: CanonicalRaceDriverState[] = sortedGrid.map((entry) => {
      const isPlayer = entry.teamId === playerTeamId || entry.isPlayer
      let carId = entry.carId
      if (isPlayer) {
        carId = carId || playerAssignedCarMap.get(entry.driverId) || 'car1'
      }

      // PU-05A2-P2a: Vincular a unidade física ao participante na inicialização pela identidade real de equipe/carro.
      // Uma unidade selecionada para a nova corrida deve existir no inventário; sua ausência interrompe a inicialização.
      let powerUnitId: number | undefined
      let powerUnitInitialCondition: number | undefined

      if (isPlayer && playerAllocation && (carId === 'car1' || carId === 'car2')) {
        const allocatedUnitNumber =
          carId === 'car1' ? playerAllocation.car1Unit : playerAllocation.car2Unit
        if (typeof allocatedUnitNumber === 'number' && allocatedUnitNumber > 0) {
          const unitInHistory = playerTeamEngineHistory.find(
            (eng: any) => Number(eng.id) === allocatedUnitNumber,
          )

          if (!unitInHistory) {
            throw new Error(
              `[PU-05A2-P2a] Alocação de Unidade de Potência inválida para a nova corrida: A unidade PU-${allocatedUnitNumber} não existe no inventário da equipe.`,
            )
          }

          powerUnitId = allocatedUnitNumber
          powerUnitInitialCondition =
            typeof unitInHistory.condition === 'number'
              ? unitInHistory.condition
              : typeof unitInHistory.wear === 'number'
                ? Math.max(0, 100 - unitInHistory.wear)
                : 100
        }
      } // BUG-02 COMMIT C: Se houver preparação confirmada por carro, respeitá-la estritamente!
      const explicitPrep =
        params.carPreparations?.[entry.driverId] ||
        (carId ? params.carPreparations?.[carId] : undefined)

      // Regra de pneu de largada:
      // Se for SPRINT_RACE:
      // - Seco: todos largam de 'medio'
      // - Molhado: usar pneus de chuva existentes conforme a intensidade (chuva_fraca -> intermediario, chuva_forte -> chuva_extrema)
      // Se for MAIN_RACE: respeita escolha explícita ou composto do qualifying / médio
      let startingCompound: import('@/types/f1').TireCompound
      if (raceVariant === 'SPRINT_RACE') {
        if (isWetWeather) {
          startingCompound = initialWeather === 'chuva_forte' ? 'chuva_extrema' : 'intermediario'
        } else {
          startingCompound = 'medio'
        }
      } else {
        startingCompound = explicitPrep?.startingCompound || entry.bestLapCompound || 'medio'
      }

      let startingFuel = defaultInitialFuel
      if (typeof explicitPrep?.startingFuelKg === 'number') {
        const val = explicitPrep.startingFuelKg
        if (val > 110) {
          // acima de 110 -> rejeitar e fallback para defaultInitialFuel
          startingFuel = defaultInitialFuel
        } else if (val > 0) {
          startingFuel = val
          if (autoCalculatedFuel && val < autoCalculatedFuel) {
            console.warn(
              `[canonicalRaceInitializationService] Warning: insufficient projected fuel for ${entry.driverId}: ${val} kg < required ${autoCalculatedFuel} kg`,
            )
          }
        }
      }

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
        raceVariant,
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
        powerUnitId,
        powerUnitInitialCondition,
        tyreSetId: startingTyreSetId,
        initialTyreWear,
        initialTyreLapsUsed,
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
      raceVariant,
      careerId,
      season,
      round,
      raceId,
      circuitName,
      circuitCountry,
      circuitLengthKm: resolvedCircuitLengthKm,
      totalLaps: Math.max(1, totalLaps),
      currentLap: 1,
      status: 'not_started',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      weather: initialWeather,
      weatherEvent,
      weatherTransitions: weatherEvent.transitions,
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

    // Persistir estado canônico inicial para reload seguro (apenas se persistState !== false)
    if (params.persistState !== false) {
      this.saveCanonicalRaceState(initialRaceState)
    }

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
  /**
   * FW2.1E-A: Converte as 24 entradas do SPRINT_STARTING_GRID para o formato compatível FinalQualifyingGridEntry
   */
  adaptSprintStartingGridToFinalEntries(
    sprintGridEntries: import('@/services/raceQualifyingOrchestratorService').SprintStartingGridEntry[],
  ): FinalQualifyingGridEntry[] {
    return sprintGridEntries.map((e) => ({
      gridPosition: e.gridPosition,
      qualifyingPosition: e.qualifyingPosition,
      driverId: e.driverId,
      driverName: e.driverName,
      teamId: e.teamId,
      teamName: e.teamName,
      teamColor: '#999999',
      carIndex: e.carIndex,
      isPlayer: false,
      // RACE-FASTEST-LAP-01A: Não semear melhor volta da quali na corrida
      bestLapTime: undefined,
      bestLapSec: undefined,
      eliminationPhase: e.eliminationPhase as any,
      eliminationStage: (e.eliminationPhase as any) || 'SQ3',
      bestLapCompound: undefined,
      setupBonusApplied: 0,
    }))
  },

  /**
   * SPRINT-LAPS-UNIFY-01A:
   * Calcula o número de voltas da Sprint:
   * Regra canônica FIA Apex: 1/3 (números inteiros) do número de voltas da corrida normal.
   * Implementação: Math.max(1, Math.floor(mainRaceLaps / 3)).
   * Delega exclusivamente para getCanonicalSprintLaps.
   */
  calculateSprintLaps(
    circuitLengthKm: number,
    sprintDistanceKm: number = 100,
    mainRaceLaps?: number,
  ): number {
    if (mainRaceLaps && mainRaceLaps > 0) {
      return this.getCanonicalSprintLaps(mainRaceLaps)
    }
    // Fallback se mainRaceLaps não for informado
    if (circuitLengthKm && circuitLengthKm > 0 && !isNaN(circuitLengthKm)) {
      const estimatedMainLaps = Math.ceil(305 / circuitLengthKm)
      return this.getCanonicalSprintLaps(estimatedMainLaps)
    }
    if (!circuitLengthKm || circuitLengthKm <= 0 || isNaN(circuitLengthKm)) {
      throw new Error(`[SprintLaps] circuitLengthKm inválido: ${circuitLengthKm}`)
    }
    return this.getCanonicalSprintLaps(Math.ceil(305 / circuitLengthKm))
  },

  /**
   * Helper canônico para cálculo de voltas de corrida Sprint.
   * Regra: Math.max(1, Math.floor(mainRaceLaps / 3))
   */
  getCanonicalSprintLaps(mainRaceLaps: number): number {
    return Math.max(1, Math.floor(mainRaceLaps / 3))
  },

  initializeSprintRaceState(params: any): any {
    return (this as any).initializeCanonicalSprintRaceState(params)
  },

  initializeCanonicalRaceState(params: any): any {
    return (this as any).saveCanonicalRaceState(params)
  },

  /**
   * RACE-SPRINT-SLOTS-01C1:   * Inicializa o estado canônico da corrida Sprint a partir EXCLUSIVAMENTE do SPRINT_STARTING_GRID persistido.
   *
   * PRÉ-CONDIÇÕES OBRIGATÓRIAS:
   * 1. weekendFormat === 'SPRINT'
   * 2. currentSlot === 3
   * 3. slotType === 'SPRINT_RACE' | 'SPRINT'
   * 4. slotStatus === 'READY' | 'AVAILABLE' | 'IN_PROGRESS'
   * 5. SPRINT_STARTING_GRID válido com 24 pilotos P1..P24 sem duplicatas nem ausências
   * 6. Idempotência estrita: se já existir estado Sprint persistido, retorna o estado existente sem recriar
   */
  async initializeSprintRaceFromPersistedGrid(params: {
    careerId: string
    seasonId: string
    seasonNumber?: number
    round: number
    circuitName: string
    circuitCountry: string
    circuitLengthKm: number
    playerTeamId: string
    mainRaceLaps?: number
    weather?: TrackWeatherState
    weatherEvent?: import('@/types/climate').RaceWeekendWeather
  }): Promise<CanonicalRaceState> {
    const {
      careerId,
      seasonId,
      seasonNumber = 2026,
      round,
      circuitName,
      circuitCountry,
      circuitLengthKm,
      playerTeamId,
      mainRaceLaps,
      weather,
      weatherEvent,
    } = params

    // 1. CHECAGEM DE IDEMPOTÊNCIA: Se já foi inicializado e persistido, retorna exatamente o mesmo
    const existing = this.readCanonicalRaceState(careerId, seasonNumber, round, 'SPRINT_RACE')
    if (existing && existing.raceVariant === 'SPRINT_RACE' && existing.drivers?.length === 24) {
      return existing
    }

    // 2. VALIDAR PRÉ-CONDIÇÕES DE SLOT E FORMATO NO canonicalWeekendSlotPersistenceService
    const { canonicalWeekendSlotPersistenceService } =
      await import('@/services/canonicalWeekendSlotPersistenceService')
    const slotState = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId,
      seasonId,
      round,
    })

    if (slotState.weekendFormat !== 'SPRINT') {
      throw new Error(
        `[SprintRaceInit] Rejeitado: formato do final de semana é '${slotState.weekendFormat}', esperado 'SPRINT'.`,
      )
    }

    if (slotState.currentSlot !== 3) {
      throw new Error(
        `[SprintRaceInit] Rejeitado: slot atual é ${slotState.currentSlot} (${slotState.slotType}), esperado slot 3.`,
      )
    }

    const validSlotTypes = ['SPRINT_RACE', 'SPRINT']
    if (!validSlotTypes.includes(slotState.slotType)) {
      throw new Error(
        `[SprintRaceInit] Rejeitado: slotType é '${slotState.slotType}', esperado 'SPRINT_RACE' ou 'SPRINT'.`,
      )
    }

    const validSlotStatuses = ['AVAILABLE', 'READY', 'IN_PROGRESS']
    if (!validSlotStatuses.includes(slotState.slotStatus)) {
      throw new Error(
        `[SprintRaceInit] Rejeitado: slotStatus é '${slotState.slotStatus}', esperado READY/AVAILABLE.`,
      )
    }

    // 3. CARREGAR EXCLUSIVAMENTE SPRINT_STARTING_GRID PERSISTIDO
    const { raceQualifyingOrchestratorService } =
      await import('@/services/raceQualifyingOrchestratorService')
    const sprintGridState = await raceQualifyingOrchestratorService.loadPersistedSprintStartingGrid(
      careerId,
      seasonId,
      round,
    )

    if (
      !sprintGridState ||
      !Array.isArray(sprintGridState.grid) ||
      sprintGridState.grid.length !== 24
    ) {
      throw new Error(
        `[SprintRaceInit] Rejeitado: SPRINT_STARTING_GRID ausente ou incompleto (${sprintGridState?.grid?.length ?? 0}/24).`,
      )
    }

    // 4. VALIDAR UNICIDADE E BIJEÇÃO DO SPRINT_STARTING_GRID (P1..P24)
    const sortedGrid = [...sprintGridState.grid].sort((a, b) => a.gridPosition - b.gridPosition)
    const seenDriverIds = new Set<string>()
    for (let i = 0; i < sortedGrid.length; i++) {
      const entry = sortedGrid[i]
      const expectedPos = i + 1
      if (entry.gridPosition !== expectedPos) {
        throw new Error(
          `[SprintRaceInit] SPRINT_STARTING_GRID descontínuo: esperado P${expectedPos}, encontrado P${entry.gridPosition}`,
        )
      }
      if (seenDriverIds.has(entry.driverId)) {
        throw new Error(
          `[SprintRaceInit] driverId duplicado no SPRINT_STARTING_GRID: ${entry.driverId}`,
        )
      }
      seenDriverIds.add(entry.driverId)
    }

    // 5. CALCULAR VOLTAS DA SPRINT (regra primária: 30% das voltas da corrida principal)
    const totalLaps = this.calculateSprintLaps(circuitLengthKm, 100, mainRaceLaps)

    // 6. ADAPTAR PARA ENTRADAS DO MOTOR CANÔNICO
    const adaptedQualifyingGrid = this.adaptSprintStartingGridToFinalEntries(sortedGrid)

    // Resolver teamColor e isPlayer reais para o playerTeamId
    for (const entry of adaptedQualifyingGrid) {
      if (playerTeamId && entry.teamId === playerTeamId) {
        entry.isPlayer = true
      }
    }
    // 7. INICIALIZAR ESTADO CANÔNICO DA SPRINT COM raceVariant = 'SPRINT_RACE'
    const sprintRaceState = this.initializeRaceFromCanonicalGrid({
      raceVariant: 'SPRINT_RACE',
      careerId,
      season: seasonNumber,
      round,
      circuitName,
      circuitCountry,
      totalLaps,
      playerTeamId,
      canonicalQualifyingGrid: adaptedQualifyingGrid,
      weather,
      weatherEvent,
      persistState: true,
    })

    if (sprintRaceState && sprintRaceState.regulations) {
      sprintRaceState.regulations.mandatedStops = 0
      sprintRaceState.regulations.minimumDryCompounds = 1
    }

    return sprintRaceState
  },

  readCanonicalRaceState(
    careerId: string,
    season: number,
    round: number,
    raceVariant: import('@/types/canonical-race-v2').RaceVariant = 'MAIN_RACE',
  ): CanonicalRaceState | null {
    const res = canonicalRaceSaveService.loadCanonicalRaceState(
      careerId,
      season,
      round,
      raceVariant,
    )
    return res.state
  },

  /**
   * STORAGE-QUOTA-01B1-C — Wrapper assíncrono para leitura/resume preferindo PocketBase.
   */
  async readCanonicalRaceStatePreferred(
    careerId: string,
    season: number,
    round: number,
    raceVariant: import('@/types/canonical-race-v2').RaceVariant = 'MAIN_RACE',
  ): Promise<CanonicalRaceState | null> {
    const res = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      careerId,
      season,
      round,
      raceVariant,
    )
    return res.state
  },

  /**
   * Remove o estado persistido (ex: ao reiniciar a corrida).
   */
  clearCanonicalRaceState(
    careerId: string,
    season: number,
    round: number,
    options?: { force?: boolean; raceVariant?: import('@/types/canonical-race-v2').RaceVariant },
  ): { success: boolean; blockedReason?: string } {
    return canonicalRaceSaveService.clearCanonicalRaceState(careerId, season, round, options)
  },
}
