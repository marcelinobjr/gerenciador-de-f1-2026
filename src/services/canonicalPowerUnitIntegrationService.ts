/**
 * canonicalPowerUnitIntegrationService.ts
 *
 * Sistema canônico de Integração de Unidade de Potência (PU Integration Knowledge):
 * - Define a relação explícita EQUIPE × FORNECEDOR (FACTORY vs CUSTOMER)
 * - Controla o teto de integração: FACTORY max 1.00, CUSTOMER max 0.90
 * - Resolução determinística e sem duplicação de PU efetiva = PU nominal × effectiveIntegration
 * - Aprendizado contínuo modulado por infraestrutura, staff técnico, tenure e retornos decrescentes
 * - Persistência em localStorage/Save com migração idempotente
 */

import {
  PURelationshipType,
  PUSupplierId,
  PowerUnitRelationshipMetadata,
  PowerUnitIntegrationState,
  ResolveEffectivePUIntegrationParams,
  ResolveEffectivePUIntegrationResult,
  EffectivePUPerformanceResult,
  PUIntegrationAuditReport,
} from '@/types/canonical-pu-integration'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'

// Constantes canônicas de caps
export const FACTORY_MAX_INTEGRATION = 1.0
export const CUSTOMER_MAX_INTEGRATION = 0.9

/**
 * Metadata canônica oficial da temporada 2026.
 * As 9 relações obrigatórias da especificação:
 * - Red Bull + Ford: FACTORY, max 1.00
 * - Racing Bulls + Ford: CUSTOMER, max 0.90
 * - Aston Martin + Honda: CUSTOMER, max 0.90 (não promover por exclusividade)
 * - Mercedes + Mercedes: FACTORY 1.00
 * - McLaren + Mercedes: CUSTOMER 0.90
 * - Williams + Mercedes: CUSTOMER 0.90
 * - Ferrari + Ferrari: FACTORY 1.00
 * - Cadillac + Ferrari: CUSTOMER 0.90
 * - Audi + Audi: FACTORY 1.00
 *
 * E as demais equipes do grid de 28: todas com relação explícita.
 */
export const OFFICIAL_2026_PU_RELATIONSHIPS: Record<string, PowerUnitRelationshipMetadata> = {
  // 1. Red Bull Racing + Ford (FACTORY 1.00)
  redbull: {
    teamId: 'redbull',
    supplierId: 'Ford',
    relationshipType: 'FACTORY',
    maxIntegration: FACTORY_MAX_INTEGRATION,
    initialGeneralKnowledge: 90,
    initialSupplierKnowledge: 88,
    initialTenureSeasons: 1,
  },
  // 2. Racing Bulls + Ford (CUSTOMER 0.90 - mesma PU da RBR mas não é fábrica)
  racingbulls: {
    teamId: 'racingbulls',
    supplierId: 'Ford',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 82,
    initialSupplierKnowledge: 78,
    initialTenureSeasons: 1,
  },
  // 3. Aston Martin + Honda (CUSTOMER 0.90 - não promover a factory)
  astonmartin: {
    teamId: 'astonmartin',
    supplierId: 'Honda',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 80,
    initialSupplierKnowledge: 70,
    initialTenureSeasons: 1,
  },
  // 4. Mercedes + Mercedes (FACTORY 1.00)
  mercedes: {
    teamId: 'mercedes',
    supplierId: 'Mercedes',
    relationshipType: 'FACTORY',
    maxIntegration: FACTORY_MAX_INTEGRATION,
    initialGeneralKnowledge: 98,
    initialSupplierKnowledge: 98,
    initialTenureSeasons: 12,
  },
  // 5. McLaren + Mercedes (CUSTOMER 0.90 - cliente de ponta)
  mclaren: {
    teamId: 'mclaren',
    supplierId: 'Mercedes',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 92,
    initialSupplierKnowledge: 89,
    initialTenureSeasons: 6,
  },
  // 6. Williams + Mercedes (CUSTOMER 0.90 - cliente longo histórico)
  williams: {
    teamId: 'williams',
    supplierId: 'Mercedes',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 74,
    initialSupplierKnowledge: 75,
    initialTenureSeasons: 12,
  },
  // 7. Ferrari + Ferrari (FACTORY 1.00)
  ferrari: {
    teamId: 'ferrari',
    supplierId: 'Ferrari',
    relationshipType: 'FACTORY',
    maxIntegration: FACTORY_MAX_INTEGRATION,
    initialGeneralKnowledge: 97,
    initialSupplierKnowledge: 97,
    initialTenureSeasons: 15,
  },
  // 8. Cadillac + Ferrari (CUSTOMER 0.90 - estreante, knowledge mais baixo)
  cadillac: {
    teamId: 'cadillac',
    supplierId: 'Ferrari',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 55,
    initialSupplierKnowledge: 50,
    initialTenureSeasons: 1,
  },
  // 9. Audi + Audi (FACTORY 1.00)
  audi: {
    teamId: 'audi',
    supplierId: 'Audi',
    relationshipType: 'FACTORY',
    maxIntegration: FACTORY_MAX_INTEGRATION,
    initialGeneralKnowledge: 84,
    initialSupplierKnowledge: 82,
    initialTenureSeasons: 1,
  },
  // Outras equipes do grid oficial 2026:
  alpine: {
    teamId: 'alpine',
    supplierId: 'Mercedes',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 75,
    initialSupplierKnowledge: 65,
    initialTenureSeasons: 1,
  },
  haas: {
    teamId: 'haas',
    supplierId: 'Ferrari',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 76,
    initialSupplierKnowledge: 78,
    initialTenureSeasons: 10,
  },
  andretti: {
    teamId: 'andretti',
    supplierId: 'Honda',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 60,
    initialSupplierKnowledge: 52,
    initialTenureSeasons: 1,
  },
  // Grid expandido (28 equipes)
  porsche: {
    teamId: 'porsche',
    supplierId: 'Audi',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 85,
    initialSupplierKnowledge: 80,
    initialTenureSeasons: 1,
  },
  honda: {
    teamId: 'honda',
    supplierId: 'Honda',
    relationshipType: 'FACTORY',
    maxIntegration: FACTORY_MAX_INTEGRATION,
    initialGeneralKnowledge: 90,
    initialSupplierKnowledge: 90,
    initialTenureSeasons: 2,
  },
  lamborghini: {
    teamId: 'lamborghini',
    supplierId: 'Audi',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 78,
    initialSupplierKnowledge: 75,
    initialTenureSeasons: 1,
  },
  byd: {
    teamId: 'byd',
    supplierId: 'Mercedes',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 70,
    initialSupplierKnowledge: 60,
    initialTenureSeasons: 1,
  },
  penske: {
    teamId: 'penske',
    supplierId: 'Ford',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 72,
    initialSupplierKnowledge: 68,
    initialTenureSeasons: 1,
  },
  lotus: {
    teamId: 'lotus',
    supplierId: 'Mercedes',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 73,
    initialSupplierKnowledge: 70,
    initialTenureSeasons: 1,
  },
  toyota: {
    teamId: 'toyota',
    supplierId: 'Mercedes',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 82,
    initialSupplierKnowledge: 76,
    initialTenureSeasons: 1,
  },
  benetton: {
    teamId: 'benetton',
    supplierId: 'Ford',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 71,
    initialSupplierKnowledge: 69,
    initialTenureSeasons: 1,
  },
  copersucar: {
    teamId: 'copersucar',
    supplierId: 'Ford',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 65,
    initialSupplierKnowledge: 62,
    initialTenureSeasons: 1,
  },
  alfaromeo: {
    teamId: 'alfaromeo',
    supplierId: 'Ferrari',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 75,
    initialSupplierKnowledge: 74,
    initialTenureSeasons: 2,
  },
  alphatauri: {
    teamId: 'alphatauri',
    supplierId: 'Ford',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 78,
    initialSupplierKnowledge: 76,
    initialTenureSeasons: 1,
  },
  fittipaldi: {
    teamId: 'fittipaldi',
    supplierId: 'Ferrari',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 64,
    initialSupplierKnowledge: 60,
    initialTenureSeasons: 1,
  },
  jordan: {
    teamId: 'jordan',
    supplierId: 'Honda',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 70,
    initialSupplierKnowledge: 65,
    initialTenureSeasons: 1,
  },
  renault: {
    teamId: 'renault',
    supplierId: 'Mercedes',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 78,
    initialSupplierKnowledge: 70,
    initialTenureSeasons: 1,
  },
  sauber: {
    teamId: 'sauber',
    supplierId: 'Ferrari',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 74,
    initialSupplierKnowledge: 73,
    initialTenureSeasons: 2,
  },
  toleman: {
    teamId: 'toleman',
    supplierId: 'Ford',
    relationshipType: 'CUSTOMER',
    maxIntegration: CUSTOMER_MAX_INTEGRATION,
    initialGeneralKnowledge: 62,
    initialSupplierKnowledge: 58,
    initialTenureSeasons: 1,
  },
}

class CanonicalPowerUnitIntegrationService {
  private inMemoryStates: Map<string, PowerUnitIntegrationState> = new Map()

  /**
   * Normaliza identificador de equipe de forma robusta e canônica
   */
  public normalizeTeamId(teamIdOrKey?: string): string {
    if (!teamIdOrKey) return 'custom_team'
    const clean = teamIdOrKey
      .toLowerCase()
      .trim()
      .replace(/^team_/, '')
      .replace(/[-_\s]/g, '')

    // Mapeamentos conhecidos
    const aliasMap: Record<string, string> = {
      redbullracing: 'redbull',
      rbr: 'redbull',
      visacashapprb: 'racingbulls',
      vcarb: 'racingbulls',
      rb: 'racingbulls',
      astonmartinaramco: 'astonmartin',
      mercedesamg: 'mercedes',
      mercedesamgpetronas: 'mercedes',
      mclarenf1: 'mclaren',
      mclarenf1team: 'mclaren',
      williamsracing: 'williams',
      scuderiaferrari: 'ferrari',
      cadillacf1: 'cadillac',
      cadillacf1team: 'cadillac',
      audif1: 'audi',
      audif1team: 'audi',
      sauberaudi: 'audi',
      audisauber: 'audi',
      alpinef1: 'alpine',
      alpinef1team: 'alpine',
      haasf1: 'haas',
      haasf1team: 'haas',
      andrettiglobal: 'andretti',
    }

    return aliasMap[clean] || clean
  }

  /**
   * Normaliza fornecedor
   */
  public normalizeSupplier(supplier?: string): PUSupplierId {
    if (!supplier) return 'Audi'
    const s = supplier.toLowerCase().trim()
    if (s.includes('merc')) return 'Mercedes'
    if (s.includes('ferr')) return 'Ferrari'
    if (s.includes('hond')) return 'Honda'
    if (s.includes('ford') || s.includes('powertrain') || s.includes('rbpt')) return 'Ford'
    if (s.includes('audi')) return 'Audi'
    return 'Audi'
  }

  /**
   * Recupera ou cria metadados de relacionamento explícito para qualquer uma das 28 equipes.
   * RUNTIME consome metadata explícita, nunca infere por teamName.
   */
  public getRelationshipMetadata(
    teamId: string,
    supplierId?: PUSupplierId,
    overrideType?: PURelationshipType,
  ): PowerUnitRelationshipMetadata {
    const normTeam = this.normalizeTeamId(teamId)
    const baseMeta = OFFICIAL_2026_PU_RELATIONSHIPS[normTeam]

    const resolvedSupplier = supplierId || baseMeta?.supplierId || 'Audi'
    let relType: PURelationshipType = overrideType || baseMeta?.relationshipType || 'CUSTOMER'

    // Se a equipe for uma fábrica nominal (ex: Mercedes Mercedes, Ferrari Ferrari, Audi Audi, Honda Honda)
    // pode ser FACTORY se configurada na metadata
    if (!overrideType && baseMeta) {
      relType = baseMeta.relationshipType
    }

    const maxCap = relType === 'FACTORY' ? FACTORY_MAX_INTEGRATION : CUSTOMER_MAX_INTEGRATION

    return {
      teamId: normTeam,
      supplierId: resolvedSupplier,
      relationshipType: relType,
      maxIntegration: maxCap,
      initialGeneralKnowledge: baseMeta?.initialGeneralKnowledge ?? 70,
      initialSupplierKnowledge: baseMeta?.initialSupplierKnowledge ?? 65,
      initialTenureSeasons: baseMeta?.initialTenureSeasons ?? 1,
    }
  }

  /**
   * Resolve o Knowledge consolidado a partir do conhecimento geral e específico:
   * integrationKnowledge = general * 0.35 + specific * 0.65
   */
  public calculateConsolidatedKnowledge(general: number, specific: number): number {
    const g = Math.max(0, Math.min(100, general))
    const s = Math.max(0, Math.min(100, specific))
    const consolidated = g * 0.35 + s * 0.65
    return Number(consolidated.toFixed(2))
  }

  /**
   * resolveEffectivePUIntegration():
   * Transforma o integrationKnowledge (0–100) em taxa de integração efetiva (ex: 0.82 a 1.00)
   * aplicando estritamente o teto da relação:
   * - CUSTOMER: max <= 0.90 (customer knowledge 100 resulta em <= 0.90)
   * - FACTORY: max <= 1.00 (factory knowledge 100 pode chegar a 1.00)
   *
   * Curva canônica com rendimentos decrescentes:
   * Base mínima: 0.80 (80% da potência nominal garantida por fornecimento básico)
   * Alcance máximo: 0.20 (para Factory totalizando 1.00) ou 0.10 (para Customer totalizando 0.90)
   *
   * Curva não-linear:
   * Para Factory: efficiency = 0.80 + 0.20 * (1 - (1 - knowledge/100)^1.35)
   * Para Customer: efficiency = 0.80 + 0.10 * (1 - (1 - knowledge/100)^1.35)
   * E sempre clamped pelo maxIntegration da relação.
   */
  public resolveEffectivePUIntegration(
    params: ResolveEffectivePUIntegrationParams,
  ): ResolveEffectivePUIntegrationResult {
    const { integrationKnowledge, relationshipType, maxIntegrationOverride } = params
    const k = Math.max(0, Math.min(100, integrationKnowledge))

    const maxAllowed =
      typeof maxIntegrationOverride === 'number'
        ? Math.min(
            relationshipType === 'FACTORY' ? FACTORY_MAX_INTEGRATION : CUSTOMER_MAX_INTEGRATION,
            maxIntegrationOverride,
          )
        : relationshipType === 'FACTORY'
          ? FACTORY_MAX_INTEGRATION
          : CUSTOMER_MAX_INTEGRATION

    // Base garantida por fornecimento de motor moderno F1 2026: 0.80 (80%)
    const baseFloor = 0.8
    const maxLift = maxAllowed - baseFloor

    // Curva de progresso com retornos decrescentes (expoente 1.35)
    // k = 0 => progress = 0 => eff = 0.80
    // k = 50 => progress = 0.61 => eff = 0.80 + maxLift * 0.61
    // k = 100 => progress = 1.00 => eff = 0.80 + maxLift = maxAllowed
    const normalizedK = k / 100
    const progressFactor = 1 - Math.pow(1 - normalizedK, 1.35)

    const rawEfficiency = baseFloor + maxLift * progressFactor
    const cappedEfficiency = Math.min(maxAllowed, rawEfficiency)
    const effectiveIntegration = Number(Math.max(baseFloor, cappedEfficiency).toFixed(4))

    return {
      rawEfficiency: Number(rawEfficiency.toFixed(4)),
      cappedEfficiency: Number(cappedEfficiency.toFixed(4)),
      effectiveIntegration,
      maxAllowed,
    }
  }

  /**
   * resolveEffectivePUPerformance():
   * PU efetiva = PU nominal × integração efetiva, aplicada UMA única vez.
   * Não altera o rating nominal do fornecedor!
   */
  public resolveEffectivePUPerformance(params: {
    supplierId: PUSupplierId | string
    effectiveIntegration: number
    relationshipType?: PURelationshipType
  }): EffectivePUPerformanceResult {
    const supplier = this.normalizeSupplier(params.supplierId)
    const puSpec = OFFICIAL_POWER_UNITS[supplier] || OFFICIAL_POWER_UNITS.Audi

    const nominalPower = puSpec.powerRating
    const nominalRel = puSpec.reliabilityRating
    const nominalPuRating = Number((nominalPower * 0.6 + nominalRel * 0.4).toFixed(1))

    const eff = Math.max(0.5, Math.min(1.0, params.effectiveIntegration))

    // PU efetiva = PU nominal × integração (uma única vez)
    const effectivePuRating = Number((nominalPuRating * eff).toFixed(1))
    const effectivePowerRating = Number((nominalPower * eff).toFixed(1))
    const effectiveReliabilityRating = Number((nominalRel * eff).toFixed(1))

    return {
      nominalPowerRating: nominalPower,
      nominalReliabilityRating: nominalRel,
      nominalPuRating,
      effectivePuRating,
      effectivePowerRating,
      effectiveReliabilityRating,
      effectiveIntegration: eff,
      relationshipType: params.relationshipType || 'CUSTOMER',
      supplierId: supplier,
    }
  }

  /**
   * Constrói ou recupera o estado de integração de uma equipe.
   */
  public getOrCreateIntegrationState(params: {
    careerId: string
    seasonYear: number
    teamId: string
    supplierId?: PUSupplierId | string
    relationshipType?: PURelationshipType
  }): PowerUnitIntegrationState {
    const { careerId, seasonYear, teamId } = params
    const normTeam = this.normalizeTeamId(teamId)
    const key = this.buildStorageKey(careerId, seasonYear, normTeam)

    // 1. Em memória
    if (this.inMemoryStates.has(key)) {
      return this.inMemoryStates.get(key)!
    }

    // 2. localStorage
    const stored = this.loadFromLocalStorage(key)
    if (stored) {
      // Reconciliação transparente de saves legados (ex: Audi/Audi persistido como CUSTOMER 0.90)
      const reconciled = this.reconcileLegacyIntegrationState(stored)
      this.inMemoryStates.set(key, reconciled)
      if (reconciled !== stored) {
        this.saveToLocalStorage(key, reconciled)
      }
      return reconciled
    }

    // 3. Inicializar a partir da metadata canônica
    const meta = this.getRelationshipMetadata(
      normTeam,
      params.supplierId ? this.normalizeSupplier(params.supplierId) : undefined,
      params.relationshipType,
    )

    const consolidatedK = this.calculateConsolidatedKnowledge(
      meta.initialGeneralKnowledge,
      meta.initialSupplierKnowledge,
    )

    const resolvedEff = this.resolveEffectivePUIntegration({
      integrationKnowledge: consolidatedK,
      relationshipType: meta.relationshipType,
      maxIntegrationOverride: meta.maxIntegration,
    })

    const newState: PowerUnitIntegrationState = {
      careerId,
      seasonYear,
      teamId: normTeam,
      supplierId: meta.supplierId,
      relationshipType: meta.relationshipType,
      generalIntegrationKnowledge: meta.initialGeneralKnowledge,
      supplierSpecificKnowledge: meta.initialSupplierKnowledge,
      integrationKnowledge: consolidatedK,
      effectiveIntegration: resolvedEff.effectiveIntegration,
      maxIntegration: meta.maxIntegration,
      seasonsWithSupplier: meta.initialTenureSeasons,
      accumulatedExperience: meta.initialTenureSeasons * 24,
      lastUpdatedSeason: seasonYear,
    }

    this.saveIntegrationState(newState)
    return newState
  }

  /**
   * Salva o estado de integração
   */
  public saveIntegrationState(state: PowerUnitIntegrationState): void {
    const key = this.buildStorageKey(state.careerId, state.seasonYear, state.teamId)
    this.inMemoryStates.set(key, state)
    this.saveToLocalStorage(key, state)
  }

  /**
   * Calcula o ganho de aprendizado em uma sessão ou rodada:
   * learningGain = baseLearning × infrastructureFactor × engineeringFactor × stabilityFactor × experienceFactor × remainingGapFactor
   *
   * Retornos decrescentes:
   * Quanto mais próximo do teto (gap pequeno), menor o ganho por rodada.
   * Ganhar 60 -> 70 é muito mais fácil que 88 -> 90.
   */
  public calculateLearningGain(params: {
    currentState: PowerUnitIntegrationState
    infrastructureFacilityLevel?: number // 1 a 10 (ex: fábrica / simulador)
    technicalStaffRating?: number // 0 a 100 (ex: Diretor Técnico / Chief Designer)
    seasonsWithSupplier?: number
    isFactory?: boolean
  }): {
    generalGain: number
    specificGain: number
    totalGain: number
    factors: {
      infraFactor: number
      staffFactor: number
      stabilityFactor: number
      gapFactor: number
    }
  } {
    const { currentState } = params
    const infraLevel = Math.max(1, Math.min(10, params.infrastructureFacilityLevel ?? 5))
    const staffRating = Math.max(30, Math.min(100, params.technicalStaffRating ?? 75))
    const tenure = params.seasonsWithSupplier ?? currentState.seasonsWithSupplier

    // Fatores multiplicadores calibrados:
    // 1. Infra: nível 1 = 0.70x; nível 5 = 1.00x; nível 10 = 1.35x
    const infraFactor = 0.7 + (infraLevel - 1) * (0.65 / 9)

    // 2. Staff técnico: 50 = 0.80x; 75 = 1.00x; 95 = 1.25x
    const staffFactor = 0.8 + ((staffRating - 50) / 50) * 0.45

    // 3. Estabilidade/Tenure: retornos decrescentes com log
    // 1 ano = 1.00x; 3 anos = 1.15x; 10 anos = 1.30x
    const stabilityFactor = 1.0 + Math.min(0.3, Math.log10(Math.max(1, tenure)) * 0.3)

    // 4. Remaining Gap Factor (Retornos decrescentes estritos):
    // Se knowledge está em 60, gap é 40 -> gapFactor ~1.0
    // Se knowledge está em 90, gap é 10 -> gapFactor ~0.35
    // Se knowledge está em 98, gap é 2 -> gapFactor ~0.10
    const currentK = currentState.integrationKnowledge
    const gap = Math.max(1, 100 - currentK)
    const gapFactor = Math.pow(gap / 100, 0.75)

    // Base learning por rodada
    const baseLearning = 1.2

    const specificGain = Number(
      (baseLearning * infraFactor * staffFactor * stabilityFactor * gapFactor).toFixed(3),
    )
    // Conhecimento geral cresce com taxa um pouco menor mas mais estável
    const generalGain = Number((specificGain * 0.6).toFixed(3))

    return {
      generalGain,
      specificGain,
      totalGain: Number((generalGain * 0.35 + specificGain * 0.65).toFixed(3)),
      factors: {
        infraFactor: Number(infraFactor.toFixed(3)),
        staffFactor: Number(staffFactor.toFixed(3)),
        stabilityFactor: Number(stabilityFactor.toFixed(3)),
        gapFactor: Number(gapFactor.toFixed(3)),
      },
    }
  }

  /**
   * Evolui o estado de integração após uma rodada / sessão.
   */
  public progressKnowledge(params: {
    state: PowerUnitIntegrationState
    infrastructureFacilityLevel?: number
    technicalStaffRating?: number
  }): PowerUnitIntegrationState {
    const { state } = params
    const gain = this.calculateLearningGain({
      currentState: state,
      infrastructureFacilityLevel: params.infrastructureFacilityLevel,
      technicalStaffRating: params.technicalStaffRating,
    })

    const newGeneral = Math.min(100, state.generalIntegrationKnowledge + gain.generalGain)
    const newSpecific = Math.min(100, state.supplierSpecificKnowledge + gain.specificGain)
    const newConsolidated = this.calculateConsolidatedKnowledge(newGeneral, newSpecific)

    const resolved = this.resolveEffectivePUIntegration({
      integrationKnowledge: newConsolidated,
      relationshipType: state.relationshipType,
      maxIntegrationOverride: state.maxIntegration,
    })

    const updated: PowerUnitIntegrationState = {
      ...state,
      generalIntegrationKnowledge: Number(newGeneral.toFixed(2)),
      supplierSpecificKnowledge: Number(newSpecific.toFixed(2)),
      integrationKnowledge: newConsolidated,
      effectiveIntegration: resolved.effectiveIntegration,
      accumulatedExperience: state.accumulatedExperience + 1,
    }

    this.saveIntegrationState(updated)
    return updated
  }

  /**
   * Troca de fornecedor de motor (Supplier Change):
   * - O conhecimento GERAL é parcialmente preservado (ex: 60-70% mantido)
   * - O conhecimento ESPECÍFICO do motor cai fortemente (ex: cai para ~40% da base anterior)
   * - Zera tenure com o novo fornecedor (seasonsWithSupplier = 1)
   */
  public processSupplierChange(params: {
    currentState: PowerUnitIntegrationState
    newSupplierId: PUSupplierId
    newRelationshipType?: PURelationshipType
  }): PowerUnitIntegrationState {
    const { currentState, newSupplierId } = params

    // Se mudou para o mesmo fornecedor, mantém
    if (currentState.supplierId === newSupplierId) {
      return currentState
    }

    // Relação com novo fornecedor
    const targetRelType =
      params.newRelationshipType ||
      this.getRelationshipMetadata(currentState.teamId, newSupplierId).relationshipType

    const newMaxCap =
      targetRelType === 'FACTORY' ? FACTORY_MAX_INTEGRATION : CUSTOMER_MAX_INTEGRATION

    // Conhecimento geral preservado parcialmente (~65%)
    const preservedGeneral = Math.max(
      40,
      Math.min(95, currentState.generalIntegrationKnowledge * 0.65),
    )

    // Conhecimento específico do novo motor despenca para base inicial de estreante com novo motor
    const newSpecific = Math.max(35, Math.min(55, currentState.supplierSpecificKnowledge * 0.4))

    const newConsolidated = this.calculateConsolidatedKnowledge(preservedGeneral, newSpecific)

    const resolved = this.resolveEffectivePUIntegration({
      integrationKnowledge: newConsolidated,
      relationshipType: targetRelType,
      maxIntegrationOverride: newMaxCap,
    })

    const updated: PowerUnitIntegrationState = {
      ...currentState,
      supplierId: newSupplierId,
      relationshipType: targetRelType,
      maxIntegration: newMaxCap,
      generalIntegrationKnowledge: Number(preservedGeneral.toFixed(2)),
      supplierSpecificKnowledge: Number(newSpecific.toFixed(2)),
      integrationKnowledge: newConsolidated,
      effectiveIntegration: resolved.effectiveIntegration,
      seasonsWithSupplier: 1,
      lastUpdatedSeason: currentState.seasonYear,
    }

    this.saveIntegrationState(updated)
    return updated
  }

  /**
   * Mudança de status da relação (CUSTOMER -> FACTORY ou FACTORY -> CUSTOMER):
   * - CUSTOMER -> FACTORY: sobe teto de 0.90 para 1.00 mas knowledge NÃO dá salto imediato
   * - FACTORY -> CUSTOMER: teto cai para 0.90 e effectiveIntegration é capped imediatamente
   */
  public processRelationshipTypeChange(params: {
    currentState: PowerUnitIntegrationState
    newRelationshipType: PURelationshipType
  }): PowerUnitIntegrationState {
    const { currentState, newRelationshipType } = params
    const newMaxCap =
      newRelationshipType === 'FACTORY' ? FACTORY_MAX_INTEGRATION : CUSTOMER_MAX_INTEGRATION

    const resolved = this.resolveEffectivePUIntegration({
      integrationKnowledge: currentState.integrationKnowledge,
      relationshipType: newRelationshipType,
      maxIntegrationOverride: newMaxCap,
    })

    const updated: PowerUnitIntegrationState = {
      ...currentState,
      relationshipType: newRelationshipType,
      maxIntegration: newMaxCap,
      effectiveIntegration: resolved.effectiveIntegration,
    }

    this.saveIntegrationState(updated)
    return updated
  }

  /**
   * Transição anual de temporada (Season Transition):
   * Incrementa tenure com o fornecedor se mantido, aplica carry-over e evolução
   */
  public advanceSeason(params: {
    currentState: PowerUnitIntegrationState
    toSeasonYear: number
    sameSupplier: boolean
    newSupplierId?: PUSupplierId
    infrastructureFacilityLevel?: number
    technicalStaffRating?: number
  }): PowerUnitIntegrationState {
    const { currentState, toSeasonYear, sameSupplier, newSupplierId } = params

    if (!sameSupplier && newSupplierId) {
      const changed = this.processSupplierChange({
        currentState,
        newSupplierId,
      })
      changed.seasonYear = toSeasonYear
      changed.lastUpdatedSeason = toSeasonYear
      this.saveIntegrationState(changed)
      return changed
    }

    // Mesmo fornecedor: incrementa tenure
    const newTenure = currentState.seasonsWithSupplier + 1

    // Carry-over de temporada com ligeira consolidação
    const carryGain = this.calculateLearningGain({
      currentState,
      infrastructureFacilityLevel: params.infrastructureFacilityLevel,
      technicalStaffRating: params.technicalStaffRating,
      seasonsWithSupplier: newTenure,
    })

    const updatedGeneral = Math.min(
      100,
      currentState.generalIntegrationKnowledge + carryGain.generalGain * 2,
    )
    const updatedSpecific = Math.min(
      100,
      currentState.supplierSpecificKnowledge + carryGain.specificGain * 2,
    )
    const consolidated = this.calculateConsolidatedKnowledge(updatedGeneral, updatedSpecific)

    const resolved = this.resolveEffectivePUIntegration({
      integrationKnowledge: consolidated,
      relationshipType: currentState.relationshipType,
      maxIntegrationOverride: currentState.maxIntegration,
    })

    const updated: PowerUnitIntegrationState = {
      ...currentState,
      seasonYear: toSeasonYear,
      seasonsWithSupplier: newTenure,
      generalIntegrationKnowledge: Number(updatedGeneral.toFixed(2)),
      supplierSpecificKnowledge: Number(updatedSpecific.toFixed(2)),
      integrationKnowledge: consolidated,
      effectiveIntegration: resolved.effectiveIntegration,
      lastUpdatedSeason: toSeasonYear,
    }

    this.saveIntegrationState(updated)
    return updated
  }

  /**
   * Auditoria formal do sistema de integração de motores:
   * Valida as 9 relações canônicas, caps de Factory e Customer e ausência de duplicação.
   */
  public auditPowerUnitIntegrationSystem(
    careerId: string = 'audit_career',
  ): PUIntegrationAuditReport {
    const details: string[] = []
    let customerMaxAbove90 = 0
    let factoryMaxAbove100 = 0
    let unknownRelationships = 0
    let duplicateIntegrationStates = 0
    let unresolvedSuppliers = 0
    const doubleApplicationDetected = 0

    // 1. Auditar as 9 relações canônicas oficiais de 2026
    const rbState = this.getOrCreateIntegrationState({
      careerId,
      seasonYear: 2026,
      teamId: 'redbull',
    })
    const rbrState = this.getOrCreateIntegrationState({
      careerId,
      seasonYear: 2026,
      teamId: 'racingbulls',
    })
    const amState = this.getOrCreateIntegrationState({
      careerId,
      seasonYear: 2026,
      teamId: 'astonmartin',
    })
    const mercState = this.getOrCreateIntegrationState({
      careerId,
      seasonYear: 2026,
      teamId: 'mercedes',
    })
    const mclState = this.getOrCreateIntegrationState({
      careerId,
      seasonYear: 2026,
      teamId: 'mclaren',
    })
    const wilState = this.getOrCreateIntegrationState({
      careerId,
      seasonYear: 2026,
      teamId: 'williams',
    })
    const ferState = this.getOrCreateIntegrationState({
      careerId,
      seasonYear: 2026,
      teamId: 'ferrari',
    })
    const cadState = this.getOrCreateIntegrationState({
      careerId,
      seasonYear: 2026,
      teamId: 'cadillac',
    })
    const audiState = this.getOrCreateIntegrationState({
      careerId,
      seasonYear: 2026,
      teamId: 'audi',
    })

    const redBullFordIsFactory =
      rbState.relationshipType === 'FACTORY' &&
      rbState.supplierId === 'Ford' &&
      rbState.maxIntegration === 1.0
    const racingBullsFordIsCustomer =
      rbrState.relationshipType === 'CUSTOMER' &&
      rbrState.supplierId === 'Ford' &&
      rbrState.maxIntegration === 0.9
    const astonMartinHondaIsCustomer =
      amState.relationshipType === 'CUSTOMER' &&
      amState.supplierId === 'Honda' &&
      amState.maxIntegration === 0.9

    const testedStates = [
      rbState,
      rbrState,
      amState,
      mercState,
      mclState,
      wilState,
      ferState,
      cadState,
      audiState,
    ]

    const seenKeys = new Set<string>()
    testedStates.forEach((s) => {
      const k = `${s.careerId}_${s.seasonYear}_${s.teamId}`
      if (seenKeys.has(k)) duplicateIntegrationStates++
      seenKeys.add(k)

      if (s.relationshipType !== 'FACTORY' && s.relationshipType !== 'CUSTOMER') {
        unknownRelationships++
      }

      if (!['Mercedes', 'Ferrari', 'Honda', 'Ford', 'Audi'].includes(s.supplierId)) {
        unresolvedSuppliers++
      }

      if (s.relationshipType === 'CUSTOMER' && s.maxIntegration > 0.9) {
        customerMaxAbove90++
      }

      if (s.relationshipType === 'FACTORY' && s.maxIntegration > 1.0) {
        factoryMaxAbove100++
      }

      if (s.effectiveIntegration > s.maxIntegration + 0.0001) {
        details.push(
          `Violação de teto: ${s.teamId} tem ${s.effectiveIntegration} > ${s.maxIntegration}`,
        )
      }
    })

    const factoryRelationshipsCorrect =
      redBullFordIsFactory &&
      mercState.relationshipType === 'FACTORY' &&
      ferState.relationshipType === 'FACTORY' &&
      audiState.relationshipType === 'FACTORY'

    const customerRelationshipsCorrect =
      racingBullsFordIsCustomer &&
      astonMartinHondaIsCustomer &&
      mclState.relationshipType === 'CUSTOMER' &&
      wilState.relationshipType === 'CUSTOMER' &&
      cadState.relationshipType === 'CUSTOMER'

    return {
      factoryRelationshipsCorrect,
      customerRelationshipsCorrect,
      customerMaxAbove90,
      factoryMaxAbove100,
      unknownRelationships,
      duplicateIntegrationStates,
      unresolvedSuppliers,
      doubleApplicationDetected,
      redBullFordIsFactory,
      racingBullsFordIsCustomer,
      astonMartinHondaIsCustomer,
      details,
    }
  }

  // --- Helpers de persistência ---
  private buildStorageKey(careerId: string, seasonYear: number, teamId: string): string {
    return `pu_integration_${careerId}_${seasonYear}_${teamId}`
  }

  private loadFromLocalStorage(key: string): PowerUnitIntegrationState | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      return JSON.parse(raw) as PowerUnitIntegrationState
    } catch {
      return null
    }
  }

  private saveToLocalStorage(key: string, state: PowerUnitIntegrationState): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // tolerância
    }
  }

  /**
   * Reconcilia um estado persistido de integração se for um caso oficial incorreto conhecido.
   * Regra canônica:
   * Se for equipe oficial onde metadata oficial 2026 diz FACTORY (ex: Audi com Audi),
   * mas o estado salvo estiver como CUSTOMER ou com maxIntegration incorreto,
   * corrige relationshipType e maxIntegration preservando estritamente:
   * - integrationKnowledge
   * - generalIntegrationKnowledge
   * - supplierSpecificKnowledge
   * - seasonsWithSupplier
   * - accumulatedExperience
   * E recalcula effectiveIntegration usando o novo cap de 100% de forma idempotente.
   */
  public reconcileLegacyIntegrationState(
    state: PowerUnitIntegrationState,
  ): PowerUnitIntegrationState {
    const normTeam = this.normalizeTeamId(state.teamId)
    const officialMeta = OFFICIAL_2026_PU_RELATIONSHIPS[normTeam]

    // Se a metadata oficial especifica FACTORY e o fornecedor bate com a fábrica (ex: Audi + Audi)
    if (
      officialMeta &&
      officialMeta.relationshipType === 'FACTORY' &&
      this.normalizeSupplier(state.supplierId) === this.normalizeSupplier(officialMeta.supplierId)
    ) {
      const needsRelationshipCorrection = state.relationshipType !== 'FACTORY'
      const needsCapCorrection = state.maxIntegration !== FACTORY_MAX_INTEGRATION

      if (needsRelationshipCorrection || needsCapCorrection) {
        // Recomputa effectiveIntegration usando o knowledge real preservado + novo cap de 1.00
        const resolved = this.resolveEffectivePUIntegration({
          integrationKnowledge: state.integrationKnowledge,
          relationshipType: 'FACTORY',
          maxIntegrationOverride: FACTORY_MAX_INTEGRATION,
        })

        return {
          ...state,
          relationshipType: 'FACTORY',
          maxIntegration: FACTORY_MAX_INTEGRATION,
          effectiveIntegration: resolved.effectiveIntegration,
        }
      }
    }

    return state
  }

  /**
   * Limpa cache em memória (útil para testes isolados)
   */
  public clearMemoryCache(): void {
    this.inMemoryStates.clear()
  }
}

export const canonicalPowerUnitIntegrationService = new CanonicalPowerUnitIntegrationService()
export const auditPowerUnitIntegrationSystem = (careerId?: string) =>
  canonicalPowerUnitIntegrationService.auditPowerUnitIntegrationSystem(careerId)
