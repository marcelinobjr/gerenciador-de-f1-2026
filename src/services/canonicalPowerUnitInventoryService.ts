/**
 * canonicalPowerUnitInventoryService.ts
 *
 * POWER-UNIT-4UNITS-01A1: Modelo + Inventário Idempotente PU1–PU4 por Piloto
 *
 * Responsabilidades do microbloco A1:
 * 1. Inicialização idempotente do inventário de 4 unidades regulamentares por piloto por temporada.
 * 2. Unicidade de ID numérico global dentro de engine_history da equipe:
 *    - Cada instância possui id único (ex: 1, 2, 3... max(existing) + 1).
 *    - Identidade regulamentar expressa por driverId + seasonYear + unitNumber (1..4).
 * 3. Preservação de estado existente:
 *    - Se uma unidade já existe para (driverId, seasonYear, unitNumber), preserva wear, condition, mileage_km, status, etc.
 *    - Se faltar alguma unidade (ex: PU3 ausente), materializa apenas a faltante sem duplicar ou alterar as demais.
 * 4. Isolamento:
 *    - Pilotos da mesma equipe possuem instâncias distintas com IDs únicos (2 pilotos = 8 instâncias PU1..PU4).
 *    - Temporadas diferentes do mesmo piloto não se misturam (filtro canônico: driverId + seasonYear).
 * 5. Estado inicial seguro:
 *    - wear = 0, condition = 100, mileage_km = 0, supplier = equipe.engine_supplier,
 *      introducedRound = 1, exceedsQuota = false, status = 'reserva' (instalação tratada no A2).
 */

import type { TeamModel, PowerUnitHistoryEntry } from '@/types/f1'

export const REGULATION_UNITS_PER_DRIVER = 4

export interface EnsureDriverInventoryParams {
  team: TeamModel
  driverId: string
  seasonYear: number
  supplier?: string
  introducedRound?: number
}

export interface EnsureTeamDriverInventoriesParams {
  team: TeamModel
  driverIds: string[]
  seasonYear: number
  supplier?: string
  introducedRound?: number
}

/**
 * Encontra a próxima ID numérica única disponível dentro do histórico da equipe.
 */
export function getNextPowerUnitId(history: PowerUnitHistoryEntry[]): number {
  if (!history || history.length === 0) return 1
  const maxId = history.reduce((max, u) => {
    const num = Number(u.id)
    return !isNaN(num) && num > max ? num : max
  }, 0)
  return maxId + 1
}

/**
 * Garante a existência de exatamente as 4 unidades regulamentares (unitNumber: 1..4)
 * para um determinado piloto e temporada no histórico de motores da equipe.
 *
 * Idempotente: se já existirem, preserva seus valores (wear, condition, mileage_km, etc.).
 * Se faltarem algumas ou todas, materializa apenas as ausentes com ID único.
 *
 * Retorna a lista atualizada de engine_history da equipe.
 */
export function ensureSeasonDriverPowerUnitInventory(
  params: EnsureDriverInventoryParams,
): PowerUnitHistoryEntry[] {
  const { team, driverId, seasonYear } = params
  if (!driverId) {
    throw new Error('[ensureSeasonDriverPowerUnitInventory] driverId é obrigatório.')
  }
  if (!seasonYear || typeof seasonYear !== 'number') {
    throw new Error('[ensureSeasonDriverPowerUnitInventory] seasonYear numérico é obrigatório.')
  }

  const currentHistory: PowerUnitHistoryEntry[] = Array.isArray(team.engine_history)
    ? [...team.engine_history]
    : []

  const supplier = params.supplier || team.engine_supplier || 'Audi'
  const introducedRound = typeof params.introducedRound === 'number' ? params.introducedRound : 1

  let workingHistory = [...currentHistory]

  for (let unitNum = 1; unitNum <= REGULATION_UNITS_PER_DRIVER; unitNum++) {
    const existingIndex = workingHistory.findIndex(
      (entry) =>
        entry.driverId === driverId &&
        entry.seasonYear === seasonYear &&
        entry.unitNumber === unitNum,
    )

    if (existingIndex === -1) {
      // Unidade ausente para este piloto/temporada: criar com próximo ID numérico único
      const nextId = getNextPowerUnitId(workingHistory)
      const newUnit: PowerUnitHistoryEntry = {
        id: nextId,
        wear: 0,
        condition: 100,
        mileage_km: 0,
        status: 'reserva',
        supplier,
        introducedRound,
        exceedsQuota: false,
        driverId,
        seasonYear,
        unitNumber: unitNum,
      }
      workingHistory.push(newUnit)
    }
  }

  return workingHistory
}

/**
 * Garante o inventário regulamentar (PU1..PU4) para uma lista de pilotos da equipe na temporada.
 * Para 2 pilotos ativos, resulta em exatamente 8 instâncias físicas identificadas e com IDs únicos.
 */
export function ensureSeasonTeamPowerUnitInventories(
  params: EnsureTeamDriverInventoriesParams,
): PowerUnitHistoryEntry[] {
  const { team, driverIds, seasonYear, supplier, introducedRound } = params
  let currentHistory: PowerUnitHistoryEntry[] = Array.isArray(team.engine_history)
    ? [...team.engine_history]
    : []

  let dummyTeam: TeamModel = {
    ...team,
    engine_history: currentHistory,
  }

  for (const driverId of driverIds) {
    if (!driverId) continue
    const updated = ensureSeasonDriverPowerUnitInventory({
      team: dummyTeam,
      driverId,
      seasonYear,
      supplier,
      introducedRound,
    })
    dummyTeam = {
      ...dummyTeam,
      engine_history: updated,
    }
  }

  return dummyTeam.engine_history || []
}

/**
 * Filtro regulamentar para recuperar as unidades de potência de um piloto em determinada temporada.
 */
export function getDriverSeasonPowerUnits(
  team: TeamModel,
  driverId: string,
  seasonYear: number,
): PowerUnitHistoryEntry[] {
  const history = team.engine_history || []
  return history
    .filter((entry) => entry.driverId === driverId && entry.seasonYear === seasonYear)
    .sort((a, b) => (a.unitNumber || 0) - (b.unitNumber || 0))
}
