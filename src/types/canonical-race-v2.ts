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
 * Entidade Canônica Única por carro/piloto na Corrida V2.
 * Obrigatório pela especificação FW2.1E:
 * "careerId", "season", "raceId", "driverId", "teamId", "gridPosition",
 * "currentPosition", "lap", "raceTime", "gap", "tyreCompound", "tyreAge",
 * "fuel", "carCondition", "raceStatus", "pitStops".
 */
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
}

/**
 * Estado Canônico Completo da Corrida V2.
 * Fonte de verdade única da prova.
 */
export interface CanonicalRaceState {
  version: '2.0'
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
