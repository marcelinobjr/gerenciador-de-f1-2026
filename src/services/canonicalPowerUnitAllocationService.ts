/**
 * canonicalPowerUnitAllocationService.ts
 *
 * PU-05A2-P1: Persistência Canônica da Montagem de Power Units (F1 Apex GP Manager)
 *
 * Responsabilidades:
 * 1. FONTE CANÔNICA DA ASSOCIAÇÃO:
 *    Associação canônica entre Career/Save, Equipe, Carro (#1 e #2) e Unidade Física (PU1..PUn).
 *    Persistência canônica no TeamModel (car_specifications / power_unit_allocations).
 *    Cache local isolado por Career ID: `apex_gp_pu_allocation_${careerId}`.
 * 2. VALIDAÇÃO REAL:
 *    - Unidade deve existir no histórico (`engine_history`) ou na cota válida da equipe.
 *    - Unidades distintas para Carro #1 e Carro #2 (sem conflito/duplicação).
 *    - Rejeição atômica (preserva estado anterior, sem associação parcial).
 * 3. RETOMADA E UNIFICAÇÃO:
 *    - Carro e Infraestrutura consomem a mesma fonte.
 *    - Limpeza de cache local não apaga alocação persistida no save.
 *    - Chaves globais legadas (`apex_gp_car1_engine_unit`) NÃO contaminam saves.
 */

import pb from '@/lib/pocketbase/client'
import type { TeamModel } from '@/types/f1'
import { resolveCanonicalCareerId } from '@/lib/canonical-career-id'

export interface PowerUnitCarAllocation {
  car1Unit: number
  car2Unit: number
  updatedAt: string
  careerId: string
  teamId: string
}

export interface ValidateAllocationResult {
  valid: boolean
  error?: string
}

class CanonicalPowerUnitAllocationService {
  private memoryCache: Map<string, PowerUnitCarAllocation> = new Map()

  /**
   * Constrói a chave de cache local isolada por carreira
   */
  public getStorageKey(careerId: string): string {
    return `apex_gp_pu_allocation_${careerId}`
  }

  /**
   * Limpa cache em memória (útil para testes unitários)
   */
  public clearMemoryCache(): void {
    this.memoryCache.clear()
  }

  /**
   * Extrai alocação persistida diretamente dos dados canônicos do TeamModel.
   * Prioridades:
   * 1. team.car_specifications.power_unit_allocations
   * 2. Inferência a partir dos registros em team.engine_history com assignedCar
   */
  public extractAllocationFromTeam(
    team?: TeamModel | null,
    careerId: string = 'default_career',
  ): PowerUnitCarAllocation | null {
    if (!team) return null

    // 1. car_specifications estruturado
    const carSpecs = (team as any).car_specifications
    if (carSpecs && typeof carSpecs === 'object') {
      const alloc = carSpecs.power_unit_allocations
      if (
        alloc &&
        typeof alloc.car1Unit === 'number' &&
        typeof alloc.car2Unit === 'number' &&
        alloc.car1Unit > 0 &&
        alloc.car2Unit > 0
      ) {
        return {
          car1Unit: alloc.car1Unit,
          car2Unit: alloc.car2Unit,
          updatedAt: alloc.updatedAt || new Date().toISOString(),
          careerId: alloc.careerId || careerId,
          teamId: team.id,
        }
      }
    }

    // 2. Se engine_history tiver registros com status 'instalado' ou assignedCar explícito
    const history = team.engine_history || []
    if (history.length > 0) {
      let c1: number | null = null
      let c2: number | null = null

      for (const entry of history) {
        const assigned = (entry as any).assignedCar
        if (assigned === 1 && !c1) c1 = Number(entry.id)
        if (assigned === 2 && !c2) c2 = Number(entry.id)
      }

      if (c1 && c2 && c1 !== c2) {
        return {
          car1Unit: c1,
          car2Unit: c2,
          updatedAt: new Date().toISOString(),
          careerId,
          teamId: team.id,
        }
      }
    }

    return null
  }

  /**
   * Resolve a alocação atual para a carreira e equipe.
   * Ordem canônica de resolução:
   * 1. Cache em memória da sessão
   * 2. TeamModel persistido no backend/save (car_specifications)
   * 3. LocalStorage isolado por Career ID (`apex_gp_pu_allocation_${careerId}`)
   * 4. Padrão inicial canônico do projeto: Carro #1 = PU1, Carro #2 = PU2 (ou unidades válidas do histórico)
   */
  public resolveAllocation(options: {
    team?: TeamModel | null
    season?: any | null
    careerId?: string | null
  }): PowerUnitCarAllocation {
    const canonicalCareerId =
      options.careerId || resolveCanonicalCareerId(options.season, options.team)
    const teamId = options.team?.id || 'unknown_team'

    // 1. Cache em memória
    const inMem = this.memoryCache.get(canonicalCareerId)
    if (inMem && (!options.team?.id || inMem.teamId === options.team.id)) {
      return { ...inMem }
    }

    // 2. Do TeamModel persistido
    const fromTeam = this.extractAllocationFromTeam(options.team, canonicalCareerId)
    if (fromTeam) {
      this.memoryCache.set(canonicalCareerId, fromTeam)
      this.syncToLocalStorage(canonicalCareerId, fromTeam)
      return { ...fromTeam }
    }

    // 3. Do LocalStorage isolado por careerId
    const fromStorage = this.loadFromLocalStorage(canonicalCareerId)
    if (fromStorage && (!options.team?.id || fromStorage.teamId === options.team.id)) {
      this.memoryCache.set(canonicalCareerId, fromStorage)
      return { ...fromStorage }
    }

    // 4. Fallback padrão canônico: PU1 para Carro 1, PU2 para Carro 2
    // Se houver histórico, certificar que as unidades 1 e 2 existem ou pegar as duas primeiras disponíveis
    const history = options.team?.engine_history || []
    let defaultC1 = 1
    let defaultC2 = 2

    if (history.length >= 2) {
      defaultC1 = Number(history[0].id) || 1
      defaultC2 = Number(history[1].id) || 2
      if (defaultC1 === defaultC2) {
        defaultC2 = defaultC1 + 1
      }
    }

    const defaultAlloc: PowerUnitCarAllocation = {
      car1Unit: defaultC1,
      car2Unit: defaultC2,
      updatedAt: new Date().toISOString(),
      careerId: canonicalCareerId,
      teamId,
    }

    return defaultAlloc
  }

  /**
   * Validação de Domínio:
   * 1. Ambas as unidades devem ser números inteiros positivos.
   * 2. Carro 1 e Carro 2 não podem alocar a mesma unidade simultaneamente.
   * 3. As unidades devem existir no inventário físico da equipe (se fornecido).
   */
  public validateAllocation(
    car1Unit: number,
    car2Unit: number,
    team?: TeamModel | null,
  ): ValidateAllocationResult {
    if (!Number.isInteger(car1Unit) || car1Unit <= 0) {
      return { valid: false, error: 'Identificador de unidade do Carro #1 inválido.' }
    }
    if (!Number.isInteger(car2Unit) || car2Unit <= 0) {
      return { valid: false, error: 'Identificador de unidade do Carro #2 inválido.' }
    }
    if (car1Unit === car2Unit) {
      return {
        valid: false,
        error: `A unidade PU-${car1Unit} não pode ser instalada simultaneamente nos dois carros.`,
      }
    }

    // Se o time e o histórico forem conhecidos, valida existência física no inventário
    if (team?.engine_history && team.engine_history.length > 0) {
      const availableIds = new Set(team.engine_history.map((e) => Number(e.id)))
      if (!availableIds.has(car1Unit)) {
        return {
          valid: false,
          error: `A unidade PU-${car1Unit} não existe no inventário da equipe.`,
        }
      }
      if (!availableIds.has(car2Unit)) {
        return {
          valid: false,
          error: `A unidade PU-${car2Unit} não existe no inventário da equipe.`,
        }
      }
    }

    return { valid: true }
  }

  /**
   * Grava a associação canônica:
   * 1. Executa validação de domínio.
   * 2. Persiste no backend (PocketBase) via team.car_specifications.
   * 3. Atualiza cache em memória e cache isolado do localStorage após confirmação.
   * 4. Em caso de falha de persistência, reverte/rejeita e NÃO atualiza o estado canônico.
   */
  public async setAllocation(params: {
    team: TeamModel
    car1Unit: number
    car2Unit: number
    careerId?: string
    season?: any
  }): Promise<PowerUnitCarAllocation> {
    const { team, car1Unit, car2Unit } = params
    const careerId = params.careerId || resolveCanonicalCareerId(params.season, team)

    // Validação
    const validation = this.validateAllocation(car1Unit, car2Unit, team)
    if (!validation.valid) {
      throw new Error(validation.error || 'Alocação inválida de unidade de potência.')
    }

    const previousAlloc = this.resolveAllocation({ team, careerId })

    const newAlloc: PowerUnitCarAllocation = {
      car1Unit,
      car2Unit,
      updatedAt: new Date().toISOString(),
      careerId,
      teamId: team.id,
    }

    // Preparar payload para car_specifications da equipe
    const existingSpecs = (team as any).car_specifications || {}
    const updatedSpecs = {
      ...existingSpecs,
      power_unit_allocations: {
        car1Unit,
        car2Unit,
        updatedAt: newAlloc.updatedAt,
        careerId,
      },
    }

    // Atualiza status no engine_history caso existente para semântica rica
    let updatedHistory = team.engine_history ? [...team.engine_history] : undefined
    if (updatedHistory && updatedHistory.length > 0) {
      updatedHistory = updatedHistory.map((eng) => {
        const idNum = Number(eng.id)
        if (idNum === car1Unit) {
          return { ...eng, status: 'instalado' as const, assignedCar: 1 }
        }
        if (idNum === car2Unit) {
          return { ...eng, status: 'instalado' as const, assignedCar: 2 }
        }
        return {
          ...eng,
          status: eng.status === 'instalado' ? ('reserva' as const) : eng.status,
          assignedCar: undefined,
        }
      })
    }

    try {
      const updatePayload: Record<string, any> = {
        car_specifications: updatedSpecs,
      }
      if (updatedHistory) {
        updatePayload.engine_history = updatedHistory
      }

      await pb.collection('teams').update(team.id, updatePayload)

      // Atualiza modelo em memória do time
      ;(team as any).car_specifications = updatedSpecs
      if (updatedHistory) {
        team.engine_history = updatedHistory
      }

      // Atualiza cache em memória e cache isolado do localStorage SOMENTE após sucesso
      this.memoryCache.set(careerId, newAlloc)
      this.syncToLocalStorage(careerId, newAlloc)

      return newAlloc
    } catch (err: any) {
      // Rejeição: preserva o estado anterior intacto
      this.memoryCache.set(careerId, previousAlloc)
      throw new Error(
        `Falha ao persistir alocação no save: ${err?.message || 'Erro de rede ou banco'}`,
      )
    }
  }

  /**
   * Atualização pontual de um único carro (#1 ou #2), mantendo o outro carro inalterado
   */
  public async setSingleCarAllocation(params: {
    team: TeamModel
    targetCar: 1 | 2
    unitNumber: number
    careerId?: string
    season?: any
  }): Promise<PowerUnitCarAllocation> {
    const { team, targetCar, unitNumber } = params
    const careerId = params.careerId || resolveCanonicalCareerId(params.season, team)
    const current = this.resolveAllocation({ team, careerId })

    const newC1 = targetCar === 1 ? unitNumber : current.car1Unit
    const newC2 = targetCar === 2 ? unitNumber : current.car2Unit

    return this.setAllocation({
      team,
      car1Unit: newC1,
      car2Unit: newC2,
      careerId,
      season: params.season,
    })
  }

  // --- Helpers de Armazenamento Local Isolado ---

  private syncToLocalStorage(careerId: string, alloc: PowerUnitCarAllocation): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      const key = this.getStorageKey(careerId)
      window.localStorage.setItem(key, JSON.stringify(alloc))
    } catch (e) {
      console.warn('Falha ao sincronizar alocação no cache local:', e)
    }
  }

  private loadFromLocalStorage(careerId: string): PowerUnitCarAllocation | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const key = this.getStorageKey(careerId)
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as PowerUnitCarAllocation
      if (
        typeof parsed?.car1Unit === 'number' &&
        typeof parsed?.car2Unit === 'number' &&
        parsed.car1Unit > 0 &&
        parsed.car2Unit > 0
      ) {
        return parsed
      }
      return null
    } catch {
      return null
    }
  }
}

export const canonicalPowerUnitAllocationService = new CanonicalPowerUnitAllocationService()
