/**
 * CANONICAL WEEKEND TYRE PERSISTENCE SERVICE
 *
 * Gerencia o inventário individual persistente de pneus por piloto para o fim de semana.
 *
 * Semântica Canônica:
 * 1. Cada PILOTO tem seu próprio inventário — não existe estoque genérico de equipe.
 * 2. Criado UMA ÚNICA VEZ por evento (seasonId + round): reload, troca de tela,
 *    entrar em TL, Quali ou Corrida NÃO recria pneus nem zera desgaste.
 * 3. Identidade de cada jogo: { id, driverId, compound, wear, lapsUsed, isFitted, ... }
 * 4. Pneus de chuva (4 Intermediários + 3 Chuva Extrema no padrão) são finitos e persistentes.
 * 5. Substituição de titular por reserva elegível (17G):
 *    A alocação pertence à ENTRADA/CARRO do piloto titular. Ao trocar de piloto,
 *    o substituto assume o inventário restante do carro/piloto substituído;
 *    jogos já usados permanecem usados e nenhuma segunda alocação de 20 jogos é gerada.
 */

import type { TireSetItem, TireAllotment } from '@/types/f1'
import { createInitialTireInventory } from '@/lib/f1-tire-system'
import {
  getCanonicalTyreAllocation,
  getCanonicalTireAllotment,
  type CanonicalTyreAllocationRules,
} from '@/services/canonicalTyreAllocationService'
import { hasSprintWeekend } from '@/services/weekendProgressionService'

export function getWeekendTireStorageKey(seasonId: string, round: number): string {
  return `apex_gp_tires_${seasonId}_r${round}`
}

export interface StoredWeekendTireData {
  seasonId: string
  round: number
  isSprint: boolean
  allotmentRules: CanonicalTyreAllocationRules
  inventoriesByDriver: Record<string, TireSetItem[]>
  // Mapeamento de herança para pilotos reservas: reserveDriverId -> originalDriverId
  driverAliases?: Record<string, string>
  createdAt: string
  updatedAt: string
}

export const canonicalWeekendTyrePersistence = {
  /**
   * Lê o armazenamento persistente do fim de semana.
   */
  readWeekendTireData(seasonId: string, round: number): StoredWeekendTireData | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const raw = window.localStorage.getItem(getWeekendTireStorageKey(seasonId, round))
      if (!raw) return null
      return JSON.parse(raw) as StoredWeekendTireData
    } catch (e) {
      console.warn('[canonicalWeekendTyrePersistence] Falha ao ler armazenamento de pneus:', e)
      return null
    }
  },

  /**
   * Grava o armazenamento persistente do fim de semana.
   */
  writeWeekendTireData(data: StoredWeekendTireData): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      data.updatedAt = new Date().toISOString()
      window.localStorage.setItem(
        getWeekendTireStorageKey(data.seasonId, data.round),
        JSON.stringify(data),
      )
    } catch (e) {
      console.warn('[canonicalWeekendTyrePersistence] Falha ao salvar armazenamento de pneus:', e)
    }
  },

  /**
   * Inicializa ou recupera o inventário para os pilotos inscritos.
   * Cria UMA ÚNICA VEZ por evento: se já existir inventário para um driverId, mantém intacto.
   * Se um piloto titular for substituído por reserva, o reserva herda o inventário existente.
   */
  getOrCreateWeekendInventories(params: {
    seasonId: string
    round: number
    driverIds: string[]
    primaryDriverIds?: string[] // Pilotos titulares da vaga
  }): Record<string, TireSetItem[]> {
    const { seasonId, round, driverIds, primaryDriverIds = [] } = params
    const isSprint = hasSprintWeekend(round)
    const rules = getCanonicalTyreAllocation(round, isSprint)

    let stored = this.readWeekendTireData(seasonId, round)

    if (!stored) {
      stored = {
        seasonId,
        round,
        isSprint,
        allotmentRules: rules,
        inventoriesByDriver: {},
        driverAliases: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }

    let modified = false

    for (let i = 0; i < driverIds.length; i++) {
      const dId = driverIds[i]
      if (!dId) continue

      // Se o piloto já possui inventário gravado, nunca regera
      if (stored.inventoriesByDriver[dId] && stored.inventoriesByDriver[dId].length > 0) {
        continue
      }

      // Regra 17G (Substituição de titular por reserva):
      // Se este piloto for um reserva assumindo um assento, verificar se existe o titular original
      const correspondingPrimaryId = primaryDriverIds[i]
      if (
        correspondingPrimaryId &&
        correspondingPrimaryId !== dId &&
        stored.inventoriesByDriver[correspondingPrimaryId] &&
        stored.inventoriesByDriver[correspondingPrimaryId].length > 0
      ) {
        // O reserva assume o inventário restante do carro/titular substituído (sem criar nova alocação!)
        stored.inventoriesByDriver[dId] = stored.inventoriesByDriver[correspondingPrimaryId].map(
          (t) => ({
            ...t,
            driverId: dId, // aponta para o piloto ativo mas preserva id físico, desgaste e voltas
          }),
        )
        stored.driverAliases = stored.driverAliases || {}
        stored.driverAliases[dId] = correspondingPrimaryId
        modified = true
        continue
      }

      // Se for primeira alocação deste piloto neste GP:
      // Cria exatamente a distribuição canônica (20 jogos no normal, 19 no sprint)
      stored.inventoriesByDriver[dId] = createInitialTireInventory(dId, { isSprint, round })
      modified = true
    }

    if (modified) {
      this.writeWeekendTireData(stored)
    }

    return stored.inventoriesByDriver
  },

  /**
   * Atualiza o inventário de um piloto específico após uso em TL, Quali ou Corrida.
   */
  updateDriverInventory(
    seasonId: string,
    round: number,
    driverId: string,
    updatedSets: TireSetItem[],
  ): void {
    let stored = this.readWeekendTireData(seasonId, round)
    if (!stored) {
      const isSprint = hasSprintWeekend(round)
      stored = {
        seasonId,
        round,
        isSprint,
        allotmentRules: getCanonicalTyreAllocation(round, isSprint),
        inventoriesByDriver: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }

    stored.inventoriesByDriver[driverId] = updatedSets
    this.writeWeekendTireData(stored)
  },

  /**
   * Atualiza múltiplos inventários de uma vez (ex: após sessão completa).
   */
  updateAllInventories(
    seasonId: string,
    round: number,
    inventories: Record<string, TireSetItem[]>,
  ): void {
    let stored = this.readWeekendTireData(seasonId, round)
    if (!stored) {
      const isSprint = hasSprintWeekend(round)
      stored = {
        seasonId,
        round,
        isSprint,
        allotmentRules: getCanonicalTyreAllocation(round, isSprint),
        inventoriesByDriver: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }

    stored.inventoriesByDriver = {
      ...stored.inventoriesByDriver,
      ...inventories,
    }
    this.writeWeekendTireData(stored)
  },

  /**
   * Registra voltas e desgaste em um jogo de pneus específico e persiste.
   */
  recordTyreUsage(params: {
    seasonId: string
    round: number
    driverId: string
    tyreSetId: string
    lapsAdded: number
    finalWearPct: number
  }): TireSetItem | null {
    const { seasonId, round, driverId, tyreSetId, lapsAdded, finalWearPct } = params
    const stored = this.readWeekendTireData(seasonId, round)
    if (!stored || !stored.inventoriesByDriver[driverId]) return null

    const sets = stored.inventoriesByDriver[driverId]
    const targetSet = sets.find((s) => s.id === tyreSetId)
    if (!targetSet) return null

    targetSet.lapsUsed = (targetSet.lapsUsed || 0) + lapsAdded
    targetSet.wear = Math.min(100, Math.max(targetSet.wear || 0, Math.round(finalWearPct)))

    this.writeWeekendTireData(stored)
    return targetSet
  },
}
