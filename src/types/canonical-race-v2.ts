/**
 * canonical-race-v2.ts
 *
 * FW2.1E — CORRIDA V2: TIPOS E ENTIDADE CANÔNICA
 *
 * Contratos da FW2.1E-A:
 * 1. Entidade canônica única por carro/piloto (CanonicalRaceDriverState)
 * 2. Estado unificado da corrida (CanonicalRaceState)
 * 3. Invariantes canônicas:
 *    - 24 carros/pilotos rigorosamente únicos
 *    - P1 a P24 preservados da classificação oficial
 *    - driverIds que iniciam a corrida são exatamente os classificados
 *    - playerTeamId dinâmico (2 pilotos do playerTeam, 22 rivais)
 *    - Zero regras acopladas a nomes estáticos de equipes ou pilotos
 */

import type { TireCompound } from '@/types/f1'
import type { TrackWeatherState } from '@/lib/f1-tire-system'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'

export type CanonicalRaceStatus =
  | 'not_started'
  | 'running'
  | 'paused'
  | 'safety_car'
  | 'virtual_safety_car'
  | 'red_flag'
  | 'completed'

export type CanonicalDriverRaceStatus = 'racing' | 'in_pit' | 'dnf' | 'finished' | 'disqualified'

/**
 * FW2.1E-C: Status Canônico Unificado de Race Control.
 * Enum único para todo o controle de corrida.
 */
export type RaceControlStatus =
  | 'GREEN'
  | 'YELLOW_LOCAL'
  | 'YELLOW'
  | 'VSC'
  | 'SAFETY_CAR'
  | 'RED_FLAG'
  | 'RESTART'
  | 'FINISHED'

/**
 * Severidade de incidentes em pista
 */
export type RaceIncidentSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Estrutura de evento canônico de Race Control
 */
export interface RaceControlEvent {
  id: string
  type:
    | 'green_flag'
    | 'yellow_flag_local'
    | 'yellow_flag_full'
    | 'vsc_deployed'
    | 'vsc_ending'
    | 'safety_car_deployed'
    | 'safety_car_in_lap'
    | 'red_flag'
    | 'restart'
    | 'blue_flag'
    | 'chequered_flag'
  lap: number
  sector?: 1 | 2 | 3
  affectedDriverId?: string
  affectedDriverName?: string
  startedAtLap: number
  endedAtLap?: number
  reason: string
  severity: RaceIncidentSeverity
  message: string
  timestamp: string
}

/**
 * Estado Canônico de Race Control acoplado ao CanonicalRaceState
 */
export interface RaceControlState {
  currentFlag: RaceControlStatus
  previousFlag?: RaceControlStatus
  lapsRemainingInPhase: number // Duração programada em voltas da neutralização
  activeSector?: 1 | 2 | 3 // Setor com bandeira amarela local ativa
  safetyCarLaps: number // Contagem de voltas sob SC
  vscLaps: number // Contagem de voltas sob VSC
  redFlagLaps: number // Contagem de voltas sob Red Flag
  scQueuedOrder: string[] // Ordem esportiva congelada no momento da entrada do SC/Red Flag
  restartPending: boolean // Indica transição ativa para relargada
  activeEvents: RaceControlEvent[]
  history: RaceControlEvent[]
  lastIncidentReason?: string
}

/**
 * Entidade Canônica Única por carro/piloto na Corrida V2.
 * Obrigatório pela especificação FW2.1E:
 * "careerId", "season", "raceId", "driverId", "teamId", "gridPosition",
 * "currentPosition", "lap", "raceTime", "gap", "tyreCompound", "tyreAge",
 * "fuel", "carCondition", "raceStatus", "pitStops".
 */
/**
 * FW2.1E-D: Ritmo por piloto
 */
export type DriverPaceMode = 'PUSH' | 'NORMAL' | 'CONSERVE'

/**
 * FW2.1E-D: Modo de combustível por piloto (se aplicável)
 */
export type DriverFuelMode = 'ATTACK' | 'NORMAL' | 'SAVE'

/**
 * FW2.1E-D: Status do tráfego para avaliação de undercut/overcut
 */
export type DriverTrafficStatus = 'CLEAR_AIR' | 'IN_TRAFFIC' | 'DIRTY_AIR'

/**
 * FW2.1E-D: Planejamento de Stint
 */
export interface PlannedStint {
  stintNumber: number
  compound: TireCompound
  startLap: number
  targetLaps: number
}

/**
 * FW2.1E-D: Janela de Pit Planejada
 */
export interface PitWindow {
  startLap: number
  endLap: number
  optimalLap: number
}

/**
 * FW2.1E-D: Estado Estratégico Canônico Individual por Piloto (driverStrategyState)
 * Contrato canônico obrigatório FW2.1E-D:
 * driverId, currentTyre, tyreAge, plannedStints, nextPitWindow,
 * pitRequested, pitThisLap, targetCompound, paceMode, fuelMode,
 * ersMode, trafficStatus, gapAhead, gapBehind, undercutOpportunity,
 * overcutOpportunity, strategyStatus.
 */
export interface DriverStrategyState {
  driverId: string
  carSlot?: 'car1' | 'car2'
  currentTyre: TireCompound
  tyreAge: number
  plannedStints: PlannedStint[]
  nextPitWindow: PitWindow
  pitRequested: boolean
  pitThisLap: boolean
  targetCompound?: TireCompound
  paceMode: DriverPaceMode
  fuelMode?: DriverFuelMode
  ersMode?: string
  trafficStatus: DriverTrafficStatus
  gapAhead: number // segundos em relação ao carro imediatamente à frente
  gapBehind: number // segundos em relação ao carro imediatamente atrás
  undercutOpportunity: boolean
  overcutOpportunity: boolean
  strategyStatus: 'OPTIMAL' | 'WINDOW_OPEN' | 'PIT_REQUESTED' | 'BOXING' | 'OVERDUE' | 'EXTENDED'
  // Suporte a double stack
  doubleStackDelaySec?: number
  doubleStackWarning?: string
}

export interface CanonicalRaceDriverState {
  careerId: string
  season: number
  raceId: string
  driverId: string
  teamId: string
  gridPosition: number // 1 a 24
  currentPosition: number // 1 a 24
  lap: number // 0 na largada
  raceTime: number // tempo acumulado em segundos
  gap: string // gap relativo: líder ('0.000s' / 'LÍDER') ou delta ao líder ('+X.XXXs')
  tyreCompound: TireCompound
  tyreAge: number // voltas de uso no jogo atual de pneus
  fuel: number // kg de combustível (ex: 100.0) ou % restante
  carCondition: number // integridade mecânica global 0-100%
  raceStatus: CanonicalDriverRaceStatus
  pitStops: number // número de paradas realizadas

  // Metadados informativos canônicos (sem duplicar estado em outro objeto)
  driverName: string
  driverNumber?: number
  nationality?: string
  teamName: string
  teamColor: string
  isPlayer: boolean
  carId?: 'car1' | 'car2'
  tyreSetId?: string
  lastLapTimeSec?: number
  lastLapTimeFormatted?: string
  bestLapSec?: number
  bestLapFormatted?: string
  isDnf?: boolean
  dnfReason?: string
  dnfLap?: number
  gapToFrontSec?: number
  gapToLeaderSec?: number

  // FW2.1E-D: Estado estratégico individual do piloto
  strategy?: DriverStrategyState
}

/**
 * Estado Canônico Completo da Corrida V2.
 * Fonte de verdade única da prova.
 */
export interface CanonicalRaceState {
  version: '2.0'
  saveSchemaVersion?: 'race-save-v1'
  careerId: string
  season: number
  round: number
  raceId: string
  circuitName: string
  circuitCountry: string
  totalLaps: number
  currentLap: number
  status: CanonicalRaceStatus
  safetyCarActive: boolean
  vscActive: boolean
  redFlagActive: boolean
  weather: TrackWeatherState
  simSpeed: number
  startedAt?: string
  completedAt?: string

  // As 24 entidades canônicas ordenadas por currentPosition (P1..P24)
  drivers: CanonicalRaceDriverState[]

  // Tabela rápida de lookup por driverId para evitar loops repetidos
  driverLookup: Record<string, CanonicalRaceDriverState>

  // Controles específicos de pit/estratégia e táticas do jogador
  playerTeamId: string
  tactics: Record<string, 'attack' | 'normal' | 'save_fuel'>
  paceOrders: Record<string, 'normal' | 'empurrar' | 'segurar'>

  // FW2.1E-D: Estratégias individuais por piloto indexadas por driverId (dois pilotos independentes)
  driverStrategies?: Record<string, DriverStrategyState>
  // Prioridade de box explícita e configurável ('car1' | 'car2' | driverId)
  pitPriority?: string

  // Histórico de voltas e eventos
  revision: number
  updatedAt: string
  raceSeed?: number
  events?: Array<{
    id: string
    lap: number
    type: 'overtake' | 'incident' | 'dnf' | 'fastest_lap' | 'info'
    message: string
    driverId?: string
    driverName?: string
    teamColor?: string
    timestamp: string
  }>
  fastestLap?: {
    driverId: string
    driverName: string
    lapTimeSec: number
    lapTimeFormatted: string
    lap: number
  }

  // FW2.1E-C: Race Control Canônico Integrado
  raceControl?: RaceControlState
}

/**
 * Parâmetros de Inicialização da Corrida V2 (FW2.1E-A).
 */
export interface InitializeCanonicalRaceParams {
  careerId: string
  season: number
  round: number
  circuitName: string
  circuitCountry: string
  totalLaps: number
  playerTeamId: string
  canonicalQualifyingGrid: FinalQualifyingGridEntry[]
  weather?: TrackWeatherState
  initialFuelKg?: number
}
