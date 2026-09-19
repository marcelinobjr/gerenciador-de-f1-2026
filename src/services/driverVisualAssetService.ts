/**
 * Serviço de Identidade Visual e Retratos de Pilotos
 *
 * Regras:
 * - Novos pilotos usam EXCLUSIVAMENTE o catálogo de retratos fictícios do Google Drive
 *   (13 retratos da pasta 1q6BV-10CLvFhDdJM9dWNLkcT5a9Z803C).
 * - Proporção de gênero configurável na criação: 50% homens / 50% mulheres.
 * - O vínculo de identidade visual gerado é PERSISTENTE e ESTÁVEL (nunca re-sorteado
 *   ao filtrar, ordenar, carregar save ou trocar de equipe).
 * - Política de repetição: prioriza retratos não utilizados no save atual;
 *   evita rostos duplicados dentro da mesma equipe; quando esgotado o catálogo,
 *   reutiliza os menos frequentes sem loop infinito.
 * - Sorteio de imagem é ISOLADO de atributos esportivos (nome, idade, talento, nacionalidade).
 */

import {
  FICTIONAL_PORTRAITS_CATALOG,
  FictionalPortraitAsset,
  getAvailableFictionalPortraits,
  getFictionalPortraitById,
} from '@/lib/fictional-driver-catalog'
import { DriverVisualAssetIdentity } from '@/types/procedural-driver'

export class DriverVisualAssetService {
  private static instance: DriverVisualAssetService

  // Registro de alocações em memória por save/sessão
  private usedPortraitsBySave: Map<string, string[]> = new Map()

  private constructor() {}

  public static getInstance(): DriverVisualAssetService {
    if (!DriverVisualAssetService.instance) {
      DriverVisualAssetService.instance = new DriverVisualAssetService()
    }
    return DriverVisualAssetService.instance
  }

  /**
   * Retorna a lista de retratos disponíveis para um gênero
   */
  public getEligiblePortraits(gender: 'male' | 'female'): FictionalPortraitAsset[] {
    const available = getAvailableFictionalPortraits(gender)
    // Se por alguma razão o gênero não tiver assets ativos, recorre aos outros disponíveis
    if (available.length === 0) {
      return getAvailableFictionalPortraits()
    }
    return available
  }

  /**
   * Seleciona o melhor retrato fictício respeitando equipe e save ativo
   */
  public selectFictionalPortrait(
    gender: 'male' | 'female',
    seed: number,
    options: {
      teamDriverPortraits?: string[]
      usedInSave?: string[]
    } = {},
  ): FictionalPortraitAsset {
    const eligible = this.getEligiblePortraits(gender)
    if (eligible.length === 0) {
      // Fallback absoluto: primeiro retrato do catálogo geral
      return FICTIONAL_PORTRAITS_CATALOG[0]
    }

    const teamUsed = new Set(options.teamDriverPortraits || [])
    const saveUsed = new Set(options.usedInSave || [])

    // 1. Prioridade A: Nem na equipe nem no save
    const priorityA = eligible.filter((p) => !teamUsed.has(p.id) && !saveUsed.has(p.id))
    if (priorityA.length > 0) {
      const idx = Math.abs(seed) % priorityA.length
      return priorityA[idx]
    }

    // 2. Prioridade B: Não na mesma equipe (mesmo que usado em outro time)
    const priorityB = eligible.filter((p) => !teamUsed.has(p.id))
    if (priorityB.length > 0) {
      const idx = Math.abs(seed) % priorityB.length
      return priorityB[idx]
    }

    // 3. Prioridade C: Catálogo totalmente esgotado -> seleciona por seed
    const idx = Math.abs(seed) % eligible.length
    return eligible[idx]
  }

  /**
   * Cria uma nova identidade visual para piloto fictício
   */
  public createVisualIdentity(
    driverIdOrParams:
      | string
      | {
          driverId?: string
          gender?: 'male' | 'female'
          nationality?: string
          age?: number
          seed?: number
          teamDriverPortraits?: string[]
        },
    seedArg?: number,
    genderArg?: 'male' | 'female',
    teamDriverPortraitsArg: string[] = [],
  ): DriverVisualAssetIdentity {
    let driverId: string
    let seed: number
    let gender: 'male' | 'female'
    let teamDriverPortraits: string[] = []

    if (typeof driverIdOrParams === 'object' && driverIdOrParams !== null) {
      driverId = driverIdOrParams.driverId || `drv_proc_${Date.now()}`
      seed = driverIdOrParams.seed ?? (seedArg || 1)
      gender = driverIdOrParams.gender ?? (genderArg || 'male')
      teamDriverPortraits = driverIdOrParams.teamDriverPortraits || teamDriverPortraitsArg || []
    } else {
      driverId =
        typeof driverIdOrParams === 'string' && driverIdOrParams
          ? driverIdOrParams
          : `drv_proc_${Date.now()}`
      seed = seedArg ?? 1
      gender = genderArg ?? 'male'
      teamDriverPortraits = teamDriverPortraitsArg || []
    }

    const portrait = this.selectFictionalPortrait(gender, seed, {
      teamDriverPortraits,
    })

    return {
      visualIdentityId: `vis_${driverId}`,
      portraitAssetId: portrait.id,
      posterAssetId: portrait.id,
      helmetAssetId: `helmet_${gender}_${Math.abs(seed) % 8}`,
      gender,
      hairColor: 'dark',
      skinTone: 'neutral',
      focalPoint: portrait.focalPoint || { x: 50, y: 20 },
      isCustom: false,
      visualSeed: Math.abs(seed),
      generationStatus: 'ready',
    }
  }

  /**
   * Atualização de equipe do poster mantendo integridade e visualIdentityId
   */
  public async updateTeamPoster(
    visualIdentity: DriverVisualAssetIdentity,
    teamId: string,
    _teamName?: string,
    _teamColor?: string,
    _driverId?: string,
  ): Promise<{ success: boolean; updatedIdentity: DriverVisualAssetIdentity }> {
    const updatedIdentity: DriverVisualAssetIdentity = {
      ...visualIdentity,
      currentPosterTeamId: teamId,
      lastGenerationAttempt: new Date().toISOString(),
    }
    return { success: true, updatedIdentity }
  }

  /**
   * Converte uma identidade visual em URLs concretas de exibição
   */
  public resolveVisualUrls(visual?: DriverVisualAssetIdentity | null): {
    displayUrl: string | null
    thumbnailUrl: string | null
    focalPoint: { x: number; y: number }
  } {
    const defaultFocal = { x: 50, y: 20 }
    if (!visual || !visual.portraitAssetId) {
      return { displayUrl: null, thumbnailUrl: null, focalPoint: defaultFocal }
    }

    // Busca no catálogo de fictícios
    const asset = getFictionalPortraitById(visual.portraitAssetId)
    if (asset) {
      return {
        displayUrl: asset.displayUrl,
        thumbnailUrl: asset.thumbnailUrl,
        focalPoint: visual.focalPoint || asset.focalPoint || defaultFocal,
      }
    }

    // Se o portraitAssetId for uma URL direta
    if (visual.portraitAssetId.startsWith('http')) {
      return {
        displayUrl: visual.portraitAssetId,
        thumbnailUrl: visual.portraitAssetId,
        focalPoint: visual.focalPoint || defaultFocal,
      }
    }

    return { displayUrl: null, thumbnailUrl: null, focalPoint: defaultFocal }
  }

  /**
   * Migração idempotente para preencher identidades visuais de pilotos fictícios pré-existentes
   */
  public migrateExistingFictionalDriver<
    T extends { id: string; gender?: string; visualIdentity?: DriverVisualAssetIdentity },
  >(driver: T, seed: number, existingTeamPortraits: string[] = []): T {
    // Se já tiver uma identidade visual válida com asset do catálogo ou customizada, não sobrescrever
    if (
      driver.visualIdentity?.portraitAssetId &&
      (getFictionalPortraitById(driver.visualIdentity.portraitAssetId) ||
        driver.visualIdentity.isCustom)
    ) {
      return driver
    }

    const assignedGender: 'male' | 'female' =
      driver.gender === 'female' || driver.visualIdentity?.gender === 'female' ? 'female' : 'male'

    const visual = this.createVisualIdentity(driver.id, seed, assignedGender, existingTeamPortraits)

    return {
      ...driver,
      gender: assignedGender,
      visualIdentity: visual,
    }
  }
}

export class PlaceholderVisualProvider {
  static getPlaceholder(gender: 'male' | 'female' = 'male'): string {
    return gender === 'female'
      ? 'https://img.usecurling.com/ppl/medium?gender=female'
      : 'https://img.usecurling.com/ppl/medium?gender=male'
  }
}

export const driverVisualAssetService = DriverVisualAssetService.getInstance()
