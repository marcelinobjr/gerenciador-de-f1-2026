/**
 * canonicalRacePreparationService.ts
 *
 * BUG-02 COMMIT C — SERVIÇO DE PREPARAÇÃO PRÉ-CORRIDA
 *
 * Responsabilidades:
 * 1. Persistência e reload em snapshot "race-prep-v1" no localStorage.
 * 2. Validação rigorosa dos parâmetros de largada por carro (fuel 1-110 kg, tyre set válido e existente).
 * 3. Criação de planos de estratégia default (1 parada / 2 paradas) reutilizando raceStrategyService.
 * 4. Validação de integridade do grid position do BUG-04.
 */

import type {
  RacePreparationSnapshot,
  PreparedCarState,
  RaceStrategyPlan,
  RacePreparationStintPlan,
} from '@/types/canonical-race-preparation'
import type { TireSetItem, TireCompound } from '@/types/f1'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'

export const RACE_PREP_STORAGE_KEY_PREFIX = 'apex_race_prep_v1'

export interface CarPrepValidationResult {
  valid: boolean
  errors: string[]
}

export const canonicalRacePreparationService = {
  buildStorageKey(careerId: string, seasonYear: number, round: number): string {
    return `${RACE_PREP_STORAGE_KEY_PREFIX}_${careerId}_s${seasonYear}_r${round}`
  },

  /**
   * Validação estrita de combustível de corrida (1–110 kg).
   */
  validateStartingFuel(fuelKg: number): { valid: boolean; error?: string } {
    if (typeof fuelKg !== 'number' || Number.isNaN(fuelKg)) {
      return { valid: false, error: 'Carga de combustível inválida (não numérica).' }
    }
    if (fuelKg < 1) {
      return {
        valid: false,
        error: `Combustível insuficiente para largada: ${fuelKg} kg. Mínimo regulamentar é 1 kg.`,
      }
    }
    if (fuelKg > 110) {
      return {
        valid: false,
        error: `Combustível excede capacidade máxima do tanque: ${fuelKg} kg. Máximo regulamentar é 110 kg.`,
      }
    }
    return { valid: true }
  },

  /**
   * Validação do plano de estratégia.
   */
  validateStrategyPlan(
    plan: RaceStrategyPlan,
    totalLaps: number,
  ): { valid: boolean; error?: string } {
    if (!plan || !Array.isArray(plan.stints) || plan.stints.length === 0) {
      return { valid: false, error: 'Plano de estratégia deve conter pelo menos 1 stint.' }
    }
    for (let i = 0; i < plan.stints.length; i++) {
      const stint = plan.stints[i]
      if (!stint.compound) {
        return { valid: false, error: `Stint ${i + 1} sem composto de pneu definido.` }
      }
      if (stint.targetPitLap <= 0 || stint.targetPitLap > totalLaps) {
        return {
          valid: false,
          error: `Volta de pit inválida no Stint ${i + 1}: volta ${stint.targetPitLap} (total da corrida: ${totalLaps}).`,
        }
      }
      if (i > 0) {
        const prev = plan.stints[i - 1]
        if (stint.targetPitLap <= prev.targetPitLap) {
          return {
            valid: false,
            error: `Sequência de paradas impossível: pit ${stint.targetPitLap} menor ou igual ao anterior ${prev.targetPitLap}.`,
          }
        }
      }
    }
    return { valid: true }
  },

  /**
   * Valida a preparação completa de um carro.
   */
  validateCarPreparation(
    car: PreparedCarState,
    totalLaps: number,
    inventory: TireSetItem[],
  ): CarPrepValidationResult {
    const errors: string[] = []

    // 1. Combustível
    const fuelVal = this.validateStartingFuel(car.startingFuelKg)
    if (!fuelVal.valid && fuelVal.error) {
      errors.push(fuelVal.error)
    }

    // 2. Tyre Set
    if (!car.startingTyreSetId) {
      errors.push(`Jogo de pneus de largada não selecionado para ${car.driverName}.`)
    } else {
      const found = inventory.find(
        (s) => s.id === car.startingTyreSetId || s.tyreSetId === car.startingTyreSetId,
      )
      if (!found) {
        errors.push(
          `Jogo de pneus selecionado (${car.startingTyreSetId}) não existe no inventário de ${car.driverName}.`,
        )
      } else if (found.wear >= 95) {
        errors.push(
          `Jogo de pneus ${found.compound} #${found.id} excessivamente desgastado (${found.wear}%) para largada.`,
        )
      }
    }

    // 3. Estratégia
    const stratVal = this.validateStrategyPlan(car.strategyPlan, totalLaps)
    if (!stratVal.valid && stratVal.error) {
      errors.push(stratVal.error)
    }

    // 4. Grid position válida
    if (car.gridPosition < 1 || car.gridPosition > 24) {
      errors.push(`Posição de grid inválida: P${car.gridPosition}.`)
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  },

  /**
   * Cria o plano de estratégia padrão para um carro (1 parada).
   */
  createDefaultStrategyPlan(
    carId: 'car1' | 'car2',
    startingCompound: TireCompound,
    totalLaps: number,
  ): RaceStrategyPlan {
    const safeTotal = Math.max(10, totalLaps || 57)
    // Offset para diferenciar Carro 1 e Carro 2
    let pitLap = Math.round(safeTotal * (carId === 'car1' ? 0.42 : 0.48))
    pitLap = Math.max(8, Math.min(safeTotal - 5, pitLap))

    let nextCompound: TireCompound = 'duro'
    if (startingCompound === 'duro') {
      nextCompound = 'medio'
    } else if (startingCompound === 'macio') {
      nextCompound = 'medio'
    }

    const stints: RacePreparationStintPlan[] = [
      {
        stintNumber: 1,
        compound: startingCompound,
        targetPitLap: pitLap,
        targetEndLap: pitLap,
      },
      {
        stintNumber: 2,
        compound: nextCompound,
        targetPitLap: safeTotal,
        targetEndLap: safeTotal,
      },
    ]

    return {
      carId,
      stints,
      pitPriority: carId === 'car1' ? 'primary' : 'secondary',
      paceMode: 'NORMAL',
    }
  },

  /**
   * Cria plano de 2 paradas alternativo.
   */
  createTwoStopStrategyPlan(
    carId: 'car1' | 'car2',
    startingCompound: TireCompound,
    totalLaps: number,
  ): RaceStrategyPlan {
    const safeTotal = Math.max(15, totalLaps || 57)
    const pit1 = Math.max(6, Math.round(safeTotal * 0.28))
    const pit2 = Math.max(pit1 + 8, Math.round(safeTotal * 0.65))

    const stints: RacePreparationStintPlan[] = [
      {
        stintNumber: 1,
        compound: startingCompound,
        targetPitLap: pit1,
        targetEndLap: pit1,
      },
      {
        stintNumber: 2,
        compound: startingCompound === 'duro' ? 'medio' : 'duro',
        targetPitLap: pit2,
        targetEndLap: pit2,
      },
      {
        stintNumber: 3,
        compound: 'medio',
        targetPitLap: safeTotal,
        targetEndLap: safeTotal,
      },
    ]

    return {
      carId,
      stints,
      pitPriority: carId === 'car1' ? 'primary' : 'secondary',
      paceMode: 'NORMAL',
    }
  },

  /**
   * Constrói o estado inicial de preparação para os dois carros do jogador a partir do grid oficial.
   */
  createInitialSnapshot(params: {
    careerId: string
    seasonYear: number
    round: number
    teamId: string
    totalLaps: number
    grid: FinalQualifyingGridEntry[]
    inventories: Record<string, TireSetItem[]>
  }): RacePreparationSnapshot {
    const { careerId, seasonYear, round, teamId, totalLaps, grid, inventories } = params

    // Filtrar os 2 carros do jogador no grid
    const playerEntries = grid.filter((e) => e.teamId === teamId || e.isPlayer)
    if (playerEntries.length < 2) {
      throw new Error(
        `[canonicalRacePreparationService] Grid oficial deve conter exatamente 2 pilotos da equipe do jogador (${teamId}). Encontrados: ${playerEntries.length}.`,
      )
    }

    const entry1 = playerEntries[0]
    const entry2 = playerEntries[1]

    const inv1 = inventories[entry1.driverId] || []
    const inv2 = inventories[entry2.driverId] || []

    // Selecionar jogo inicial padrão do inventário (preferir Médio novo ou o primeiro disponível)
    const selectDefaultSet = (
      inv: TireSetItem[],
      preferredCompound: TireCompound = 'medio',
    ): TireSetItem => {
      const matchPreferred = inv.find((s) => s.compound === preferredCompound && (s.wear || 0) < 50)
      if (matchPreferred) return matchPreferred
      const anyUsable = inv.find((s) => (s.wear || 0) < 80)
      if (anyUsable) return anyUsable
      return (
        inv[0] || {
          id: 'default_set',
          compound: 'medio' as TireCompound,
          wear: 0,
          lapsUsed: 0,
          isFitted: true,
          status: 'instalado',
        }
      )
    }

    const set1 = selectDefaultSet(inv1, (entry1.bestLapCompound as TireCompound) || 'medio')
    const set2 = selectDefaultSet(inv2, (entry2.bestLapCompound as TireCompound) || 'medio')

    const car1State: PreparedCarState = {
      carId: 'car1',
      carNumber: 1,
      driverId: entry1.driverId,
      driverName: entry1.driverName,
      driverNumber: 1,
      gridPosition: entry1.gridPosition,
      startingTyreSetId: set1.id,
      startingCompound: set1.compound,
      initialTyreWear: set1.wear || 0,
      initialTyreLapsUsed: set1.lapsUsed || 0,
      startingFuelKg: 100, // Default padrão de tanque cheio
      strategyPlan: this.createDefaultStrategyPlan('car1', set1.compound, totalLaps),
      confirmed: false,
    }

    const car2State: PreparedCarState = {
      carId: 'car2',
      carNumber: 2,
      driverId: entry2.driverId,
      driverName: entry2.driverName,
      driverNumber: 2,
      gridPosition: entry2.gridPosition,
      startingTyreSetId: set2.id,
      startingCompound: set2.compound,
      initialTyreWear: set2.wear || 0,
      initialTyreLapsUsed: set2.lapsUsed || 0,
      startingFuelKg: 100,
      strategyPlan: this.createDefaultStrategyPlan('car2', set2.compound, totalLaps),
      confirmed: false,
    }

    return {
      schemaVersion: 'race-prep-v1',
      careerId,
      seasonYear,
      round,
      teamId,
      cars: [car1State, car2State],
      allConfirmed: false,
      updatedAt: new Date().toISOString(),
    }
  },

  /**
   * Salva o snapshot no localStorage.
   */
  saveSnapshot(snapshot: RacePreparationSnapshot): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      const key = this.buildStorageKey(snapshot.careerId, snapshot.seasonYear, snapshot.round)
      snapshot.updatedAt = new Date().toISOString()
      snapshot.allConfirmed = snapshot.cars[0].confirmed && snapshot.cars[1].confirmed
      window.localStorage.setItem(key, JSON.stringify(snapshot))
    } catch (e) {
      console.warn('[canonicalRacePreparationService] Falha ao persistir race-prep-v1:', e)
    }
  },

  /**
   * Carrega o snapshot do localStorage.
   */
  loadSnapshot(
    careerId: string,
    seasonYear: number,
    round: number,
  ): RacePreparationSnapshot | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const key = this.buildStorageKey(careerId, seasonYear, round)
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as RacePreparationSnapshot
      if (parsed.schemaVersion !== 'race-prep-v1') return null
      return parsed
    } catch (e) {
      console.warn('[canonicalRacePreparationService] Falha ao ler race-prep-v1:', e)
      return null
    }
  },

  /**
   * Limpa o snapshot do localStorage.
   */
  clearSnapshot(careerId: string, seasonYear: number, round: number): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      const key = this.buildStorageKey(careerId, seasonYear, round)
      window.localStorage.removeItem(key)
    } catch (e) {
      console.warn('[canonicalRacePreparationService] Falha ao limpar race-prep-v1:', e)
    }
  },
}
