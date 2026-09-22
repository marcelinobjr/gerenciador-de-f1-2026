/**
 * canonical-race-preparation.ts
 *
 * BUG-02 COMMIT C — MODELO DE PREPARAÇÃO PRÉ-CORRIDA E ESTRATÉGIA
 *
 * Princípios e Invariantes:
 * 1. Schema version: "race-prep-v1"
 * 2. Preparação independente por carro (car1 e car2).
 * 3. Seleção de jogo físico real por tyreSetId a partir do inventário canônico persistente.
 * 4. Combustível no range canônico (1–110 kg).
 * 5. Pit plan declarativo (stints planejados, targetPitLap, targetCompound).
 * 6. Preservação de desgaste inicial do pneu (se o pneu escolhido tem 16% de desgaste, larga com 16%).
 * 7. Grid position estritamente preservado da qualificação oficial BUG-04 (P1..P24).
 */

import type { TireCompound } from '@/types/f1'
import type { DriverStrategyState, PlannedStint } from '@/types/canonical-race-v2'

export const RACE_PREP_SCHEMA_VERSION = 'race-prep-v1' as const
export type RacePrepSchemaVersion = typeof RACE_PREP_SCHEMA_VERSION

export interface RacePreparationStintPlan {
  stintNumber: number
  compound: TireCompound
  tyreSetId?: string
  targetPitLap: number
  targetEndLap?: number
}

export interface RaceStrategyPlan {
  carId: 'car1' | 'car2'
  stints: RacePreparationStintPlan[]
  pitPriority?: 'primary' | 'secondary'
  paceMode?: 'PUSH' | 'NORMAL' | 'CONSERVE'
}

export interface PreparedCarState {
  carId: 'car1' | 'car2'
  carNumber: number
  driverId: string
  driverName: string
  driverNumber?: number
  gridPosition: number
  startingTyreSetId: string
  startingCompound: TireCompound
  initialTyreWear: number
  initialTyreLapsUsed: number
  startingFuelKg: number
  strategyPlan: RaceStrategyPlan
  confirmed: boolean
}

export interface RacePreparationSnapshot {
  schemaVersion: RacePrepSchemaVersion
  careerId: string
  seasonYear: number
  round: number
  teamId: string
  cars: [PreparedCarState, PreparedCarState]
  allConfirmed: boolean
  updatedAt: string
}
