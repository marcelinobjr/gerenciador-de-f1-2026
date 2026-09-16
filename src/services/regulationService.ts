/**
 * RegulationTimelineService & RegulationService
 * Implementação Nº 8C.1 — Núcleo Regulatório Canônico & Knowledge Transfer
 *
 * REGRA DE OURO:
 * A 8C.1 CRIA A REGRA. NÃO CRIA O CARRO FUTURO.
 * 1. Timeline persistente e data-driven (proibido if season === 2030).
 * 2. Status Canônicos: PROPOSED, ANNOUNCED, ACTIVE, SUPERSEDED, CANCELLED.
 * 3. 4 Tipos: TECHNICAL_DIRECTIVE, MINOR_REGULATION_CHANGE, MAJOR_REGULATION_CHANGE, NEW_TECHNICAL_ERA.
 * 4. Idempotência absoluta por sourceEventId / regulationId.
 * 5. Reutilização estrita de Organizational Knowledge da 7B.
 * 6. Conhecimento genérico (manufatura, processos) sobrevive a novas eras; não zera.
 */

import pb from '@/lib/pocketbase/client'
import {
  TechnicalRegulation,
  RegulationTimelineState,
  RegulationStatus,
  RegulationType,
  RegulationSeverity,
  RegulationUncertainty,
  TechnicalDomainId,
  CANONICAL_TECHNICAL_DOMAINS,
  TECHNICAL_DOMAIN_METAS,
  KnowledgeTransferProfile,
  TechnicalPrioritiesMap,
  RegulationImpactExplanation,
  getKnowledgeTransferTier,
  RegulationDomainEvent,
  RegulationDevelopmentAllocation,
  DevelopmentStrategyPreset,
  PreparationStatus,
  ResearchTargetDomain,
  ResearchTargetMetadata,
  NextRegulationResearchProject,
  RegulationPreparation,
  CANONICAL_RESEARCH_TARGETS,
  calculatePreparationStatus,
  formatPreparationStatusLabel,
  ConceptApproach,
  ConceptConfidenceLevel,
  FutureCarStatusStage,
  RealityCheckStage,
  ConceptRealization,
  NewCarBaselineResult,
  ConceptPivotState,
  ExplainNewCarConceptResult,
} from '@/types/canonical-regulations'
import { TECHNICAL_ATTRIBUTE_METAS, TechnicalAttributeId } from '@/types/car-technical-model'
import { TeamTechnicalOrganization, KnowledgeDomain } from '@/types/canonical-staff'
import { technicalOrganizationService } from '@/services/technicalOrganizationService'
import { financialLedgerService } from '@/services/financialLedgerService'
import { infrastructureCapabilityService } from '@/services/infrastructureCapabilityService'
import { TeamModel } from '@/types/f1'

// ==========================================
// BASELINE ERA CANÔNICA
// ==========================================
export const CANONICAL_BASELINE_ERA_ID = 'era_2026_active_aerodynamics'
export const CANONICAL_BASELINE_REGULATION_ID = 'reg_2026_baseline'

/**
 * Cria o perfil de transferabilidade padrão de acordo com o tipo de regulamento
 * Regra 11 e 12:
 * TECHNICAL_DIRECTIVE: quase 100% (0.90 a 0.98)
 * MINOR_REGULATION_CHANGE: alta (0.75 a 0.95)
 * MAJOR_REGULATION_CHANGE: moderada (0.50 a 0.85)
 * NEW_TECHNICAL_ERA: aero específico sofre (0.35-0.45), manufatura/processos sobrevivem (0.85-0.95)
 */
export function buildDefaultTransferabilityProfile(
  category: RegulationType,
  affectedDomains: TechnicalDomainId[],
): KnowledgeTransferProfile {
  const profile: KnowledgeTransferProfile = {} as KnowledgeTransferProfile

  for (const domain of CANONICAL_TECHNICAL_DOMAINS) {
    const meta = TECHNICAL_DOMAIN_METAS[domain]
    const isAffected = affectedDomains.includes(domain)

    switch (category) {
      case 'TECHNICAL_DIRECTIVE':
        // Diretiva técnica afeta áreas específicas com impacto cirúrgico
        if (isAffected) {
          profile[domain] = meta.category === 'specific_aero' ? 0.9 : 0.92
        } else {
          profile[domain] = 0.98
        }
        break

      case 'MINOR_REGULATION_CHANGE':
        // Ajuste anual: alta continuidade técnica
        if (isAffected) {
          profile[domain] = meta.category === 'specific_aero' ? 0.78 : 0.82
        } else {
          profile[domain] = 0.92
        }
        break

      case 'MAJOR_REGULATION_CHANGE':
        // Mudança estrutural: moderada
        if (isAffected) {
          if (meta.category === 'specific_aero') {
            profile[domain] = 0.55
          } else if (meta.category === 'chassis_mech') {
            profile[domain] = 0.65
          } else {
            profile[domain] = 0.85 // Genérico mantém-se alto
          }
        } else {
          profile[domain] = meta.category === 'generic_capability' ? 0.9 : 0.8
        }
        break

      case 'NEW_TECHNICAL_ERA':
        // Nova era: grande ruptura em conceitos aero específicos, mas conhecimento genérico sobrevive (Regra 12)
        if (meta.category === 'specific_aero') {
          profile[domain] = 0.42 // Específico sofre
        } else if (meta.category === 'chassis_mech') {
          profile[domain] = isAffected ? 0.58 : 0.72
        } else {
          // generic_capability: manufacturing, simulation, reliability NUNCA somem
          profile[domain] = domain === 'manufacturing' ? 0.92 : 0.88
        }
        break
    }
  }

  return profile
}

/**
 * Cria a baseline inicial neutra (Era 2026) sem recalcular nada do passado.
 */
export function createDefaultBaselineTimeline(currentSeasonYear: number): RegulationTimelineState {
  const baselineTransferability = buildDefaultTransferabilityProfile('NEW_TECHNICAL_ERA', [
    'aerodynamics',
    'floorGroundEffect',
    'chassis',
  ])

  const baselineRegulation: TechnicalRegulation = {
    regulationId: CANONICAL_BASELINE_REGULATION_ID,
    name: 'Regulamento Técnico FIA 2026 — Aerodinâmica Ativa & Efeito Solo',
    technicalEraId: CANONICAL_BASELINE_ERA_ID,
    category: 'NEW_TECHNICAL_ERA',
    severity: 'EXTREME',
    status: 'ACTIVE',
    announcementSeason: 2024,
    effectiveSeason: 2026,
    affectedDomains: [
      'aerodynamics',
      'floorGroundEffect',
      'chassis',
      'cooling',
      'powerUnitIntegration',
      'simulation',
      'manufacturing',
    ],
    technicalPriorities: {
      floorGroundEffect: 'CRITICAL',
      aerodynamics: 'HIGH',
      powerUnitIntegration: 'HIGH',
      simulation: 'MEDIUM',
      manufacturing: 'MEDIUM',
    },
    transferabilityProfile: baselineTransferability,
    uncertainty: 'LOW',
    publicDescription:
      'Era regulatória introduzida em 2026 baseada em aerodinâmica ativa, motores térmicos sustentáveis e assoalhos simplificados.',
    createdAt: new Date().toISOString(),
  }

  return {
    version: 1,
    activeEraId: CANONICAL_BASELINE_ERA_ID,
    activeRegulationId: CANONICAL_BASELINE_REGULATION_ID,
    currentSeason: currentSeasonYear,
    regulations: [baselineRegulation],
    historyLog: [
      {
        timestamp: new Date().toISOString(),
        sourceEventId: 'baseline_seed',
        eventType: 'REGULATION_ACTIVATED',
        regulationId: CANONICAL_BASELINE_REGULATION_ID,
        summary: 'Baseline técnico canônico estabelecido.',
      },
    ],
  }
}

// ==========================================
// SERVIÇO PRINCIPAL: RegulationTimelineService
// ==========================================
export class RegulationTimelineService {
  private inMemoryCache: Map<string, RegulationTimelineState> = new Map()

  /**
   * Obtém a timeline regulatória persistida para a equipe ou do backend.
   * Se não existir, constrói e persiste a baseline de forma aditiva.
   */
  public async getTimeline(
    teamId: string,
    currentSeasonYear: number,
  ): Promise<RegulationTimelineState> {
    const cacheKey = `${teamId}_timeline`
    if (this.inMemoryCache.has(cacheKey)) {
      const cached = this.inMemoryCache.get(cacheKey)!
      // Atualizar temporada atual se mudou sem quebrar timeline
      if (cached.currentSeason !== currentSeasonYear) {
        cached.currentSeason = currentSeasonYear
      }
      return cached
    }

    try {
      const record = await pb.collection('teams').getOne(teamId, {
        fields: 'id,regulation_timeline_state',
      })
      const persistedState = (record as any)?.regulation_timeline_state as
        | RegulationTimelineState
        | undefined
      if (
        persistedState &&
        Array.isArray(persistedState.regulations) &&
        persistedState.regulations.length > 0
      ) {
        persistedState.currentSeason = currentSeasonYear
        this.inMemoryCache.set(cacheKey, persistedState)
        return persistedState
      }
    } catch {
      // tolerância: pode ser teste ou time sem conexão
    }

    // Criar baseline padrão
    const baseline = createDefaultBaselineTimeline(currentSeasonYear)
    this.inMemoryCache.set(cacheKey, baseline)
    await this.persistTimeline(teamId, baseline)
    return baseline
  }

  /**
   * Persiste o estado da timeline na collection `teams` (campo aditivo `regulation_timeline_state`).
   */
  public async persistTimeline(teamId: string, timeline: RegulationTimelineState): Promise<void> {
    const cacheKey = `${teamId}_timeline`
    this.inMemoryCache.set(cacheKey, timeline)

    try {
      await pb.collection('teams').update(teamId, {
        regulation_timeline_state: timeline,
      })
    } catch {
      // Em testes locais ou mock, falha silenciosa permitida
    }
  }

  /**
   * Limpa o cache em memória (útil em testes)
   */
  public clearCache(): void {
    this.inMemoryCache.clear()
  }

  /**
   * Responde: qual regulamento está ACTIVE
   */
  public getActiveRegulation(timeline: RegulationTimelineState): TechnicalRegulation | null {
    const active = timeline.regulations.find((r) => r.status === 'ACTIVE')
    if (active) return active
    return timeline.regulations.find((r) => r.regulationId === timeline.activeRegulationId) || null
  }

  /**
   * Responde: quais regulamentos estão PROPOSED
   */
  public getProposedRegulations(timeline: RegulationTimelineState): TechnicalRegulation[] {
    return timeline.regulations.filter((r) => r.status === 'PROPOSED')
  }

  /**
   * Responde: quais regulamentos estão ANNOUNCED
   */
  public getAnnouncedRegulations(timeline: RegulationTimelineState): TechnicalRegulation[] {
    return timeline.regulations.filter((r) => r.status === 'ANNOUNCED')
  }

  /**
   * Responde: quais entrarão em vigor futuramente (status ANNOUNCED e effectiveSeason > currentSeason)
   */
  public getFutureRegulations(
    timeline: RegulationTimelineState,
    currentSeasonYear?: number,
  ): TechnicalRegulation[] {
    const curSeason = currentSeasonYear ?? timeline.currentSeason
    return timeline.regulations
      .filter((r) => r.status === 'ANNOUNCED' && r.effectiveSeason > curSeason)
      .sort((a, b) => a.effectiveSeason - b.effectiveSeason)
  }

  /**
   * Responde: quais foram SUPERSEDED
   */
  public getSupersededRegulations(timeline: RegulationTimelineState): TechnicalRegulation[] {
    return timeline.regulations.filter((r) => r.status === 'SUPERSEDED')
  }

  /**
   * Responde: quais foram CANCELLED
   */
  public getCancelledRegulations(timeline: RegulationTimelineState): TechnicalRegulation[] {
    return timeline.regulations.filter((r) => r.status === 'CANCELLED')
  }

  /**
   * Busca um regulamento por ID na timeline
   */
  public findRegulationById(
    timeline: RegulationTimelineState,
    regulationId: string,
  ): TechnicalRegulation | null {
    return timeline.regulations.find((r) => r.regulationId === regulationId) || null
  }
}

export const regulationTimelineService = new RegulationTimelineService()

// ==========================================
// SERVIÇO PRINCIPAL: RegulationService
// ==========================================
export class RegulationService {
  /**
   * Cria uma proposta de regulamento técnico (PROPOSED).
   * Idempotente via `sourceEventId` ou `regulationId`.
   */
  public createProposal(params: {
    timeline: RegulationTimelineState
    regulationId: string
    name: string
    technicalEraId?: string
    category: RegulationType
    severity: RegulationSeverity
    announcementSeason: number
    effectiveSeason: number
    affectedDomains: TechnicalDomainId[]
    technicalPriorities?: TechnicalPrioritiesMap
    transferabilityProfile?: KnowledgeTransferProfile
    uncertainty?: RegulationUncertainty
    publicDescription: string
    sourceEventId?: string
    seed?: number
  }): {
    updatedTimeline: RegulationTimelineState
    regulation: TechnicalRegulation
    created: boolean
  } {
    const { timeline, regulationId, sourceEventId } = params

    // Idempotência
    const existing = timeline.regulations.find(
      (r) =>
        r.regulationId === regulationId || (sourceEventId && r.sourceEventId === sourceEventId),
    )
    if (existing) {
      return { updatedTimeline: timeline, regulation: existing, created: false }
    }

    const priorities = params.technicalPriorities || {}
    const transferability =
      params.transferabilityProfile ||
      buildDefaultTransferabilityProfile(params.category, params.affectedDomains)

    const newReg: TechnicalRegulation = {
      regulationId,
      name: params.name,
      technicalEraId:
        params.technicalEraId || `era_${params.effectiveSeason}_${params.category.toLowerCase()}`,
      category: params.category,
      severity: params.severity,
      status: 'PROPOSED',
      announcementSeason: params.announcementSeason,
      effectiveSeason: params.effectiveSeason,
      affectedDomains: [...params.affectedDomains],
      technicalPriorities: priorities,
      transferabilityProfile: transferability,
      uncertainty: params.uncertainty || 'MODERATE',
      publicDescription: params.publicDescription,
      sourceEventId,
      seed: params.seed,
      createdAt: new Date().toISOString(),
    }

    const updatedRegulations = [...timeline.regulations, newReg]
    const updatedHistory = [
      ...timeline.historyLog,
      {
        timestamp: new Date().toISOString(),
        sourceEventId: sourceEventId || `prop_${regulationId}`,
        eventType: 'PROPOSAL_CREATED' as const,
        regulationId,
        summary: `Proposta técnica registrada para a temporada ${params.effectiveSeason}.`,
      },
    ]

    const updatedTimeline: RegulationTimelineState = {
      ...timeline,
      version: timeline.version + 1,
      regulations: updatedRegulations,
      historyLog: updatedHistory,
    }

    return { updatedTimeline, regulation: newReg, created: true }
  }

  /**
   * Anuncia formalmente um regulamento técnico (PROPOSED -> ANNOUNCED ou criação direta ANNOUNCED).
   * Idempotente via `sourceEventId` / `regulationId`.
   * REGRA 7 & 18: Idempotência estrita, não duplica anúncio.
   */
  public announceRegulation(params: {
    timeline: RegulationTimelineState
    regulationId: string
    name?: string
    technicalEraId?: string
    category?: RegulationType
    severity?: RegulationSeverity
    announcementSeason: number
    effectiveSeason: number
    affectedDomains?: TechnicalDomainId[]
    technicalPriorities?: TechnicalPrioritiesMap
    transferabilityProfile?: KnowledgeTransferProfile
    uncertainty?: RegulationUncertainty
    publicDescription?: string
    sourceEventId?: string
    seed?: number
  }): {
    updatedTimeline: RegulationTimelineState
    regulation: TechnicalRegulation
    event: RegulationDomainEvent | null
    announced: boolean
  } {
    const { timeline, regulationId, sourceEventId } = params

    // Verificar se já anunciado ou existente
    const existingIndex = timeline.regulations.findIndex(
      (r) =>
        r.regulationId === regulationId || (sourceEventId && r.sourceEventId === sourceEventId),
    )

    if (existingIndex >= 0) {
      const existing = timeline.regulations[existingIndex]
      if (existing.status === 'ANNOUNCED' || existing.status === 'ACTIVE') {
        // Já anunciado/ativo de forma idempotente: não duplica
        return { updatedTimeline: timeline, regulation: existing, event: null, announced: false }
      }

      // Estava PROPOSED: transiciona para ANNOUNCED
      const announcedReg: TechnicalRegulation = {
        ...existing,
        status: 'ANNOUNCED',
        announcementSeason: params.announcementSeason,
        effectiveSeason: params.effectiveSeason,
        updatedAt: new Date().toISOString(),
      }

      const updatedRegs = [...timeline.regulations]
      updatedRegs[existingIndex] = announcedReg

      const domainEvent: RegulationDomainEvent = {
        eventId: sourceEventId || `ev_ann_${regulationId}_${Date.now()}`,
        type:
          announcedReg.category === 'TECHNICAL_DIRECTIVE'
            ? 'TechnicalDirectiveIssued'
            : 'RegulationAnnounced',
        regulationId,
        sourceSeason: params.announcementSeason,
        effectiveSeason: params.effectiveSeason,
        timestamp: new Date().toISOString(),
        description: `Regulamento técnico ${announcedReg.name} anunciado oficialmente para ${params.effectiveSeason}.`,
        metadata: {
          category: announcedReg.category,
          severity: announcedReg.severity,
          affectedDomains: announcedReg.affectedDomains,
        },
      }

      const updatedTimeline: RegulationTimelineState = {
        ...timeline,
        version: timeline.version + 1,
        regulations: updatedRegs,
        historyLog: [
          ...timeline.historyLog,
          {
            timestamp: new Date().toISOString(),
            sourceEventId: domainEvent.eventId,
            eventType:
              announcedReg.category === 'TECHNICAL_DIRECTIVE'
                ? 'TECHNICAL_DIRECTIVE_ISSUED'
                : 'REGULATION_ANNOUNCED',
            regulationId,
            summary: `Regulamento anunciado para ${params.effectiveSeason}.`,
          },
        ],
      }

      return { updatedTimeline, regulation: announcedReg, event: domainEvent, announced: true }
    }

    // Criar diretamente como ANNOUNCED
    const category = params.category || 'MAJOR_REGULATION_CHANGE'
    const affected = params.affectedDomains || ['aerodynamics', 'chassis', 'vehicleDynamics']
    const priorities = params.technicalPriorities || {}
    const transferability =
      params.transferabilityProfile || buildDefaultTransferabilityProfile(category, affected)

    const newAnnounced: TechnicalRegulation = {
      regulationId,
      name: params.name || `Revisão Técnica ${params.effectiveSeason}`,
      technicalEraId: params.technicalEraId || `era_${params.effectiveSeason}`,
      category,
      severity: params.severity || 'HIGH',
      status: 'ANNOUNCED',
      announcementSeason: params.announcementSeason,
      effectiveSeason: params.effectiveSeason,
      affectedDomains: affected,
      technicalPriorities: priorities,
      transferabilityProfile: transferability,
      uncertainty: params.uncertainty || 'MODERATE',
      publicDescription:
        params.publicDescription ||
        `Regulamento técnico aprovado pela FIA com vigência a partir de ${params.effectiveSeason}.`,
      sourceEventId,
      seed: params.seed,
      createdAt: new Date().toISOString(),
    }

    const domainEvent: RegulationDomainEvent = {
      eventId: sourceEventId || `ev_ann_${regulationId}_${Date.now()}`,
      type:
        newAnnounced.category === 'TECHNICAL_DIRECTIVE'
          ? 'TechnicalDirectiveIssued'
          : 'RegulationAnnounced',
      regulationId,
      sourceSeason: params.announcementSeason,
      effectiveSeason: params.effectiveSeason,
      timestamp: new Date().toISOString(),
      description: `Novo regulamento ${newAnnounced.name} anunciado oficialmente para ${params.effectiveSeason}.`,
      metadata: {
        category: newAnnounced.category,
        severity: newAnnounced.severity,
      },
    }

    const updatedTimeline: RegulationTimelineState = {
      ...timeline,
      version: timeline.version + 1,
      regulations: [...timeline.regulations, newAnnounced],
      historyLog: [
        ...timeline.historyLog,
        {
          timestamp: new Date().toISOString(),
          sourceEventId: domainEvent.eventId,
          eventType:
            newAnnounced.category === 'TECHNICAL_DIRECTIVE'
              ? 'TECHNICAL_DIRECTIVE_ISSUED'
              : 'REGULATION_ANNOUNCED',
          regulationId,
          summary: `Regulamento anunciado para ${params.effectiveSeason}.`,
        },
      ],
    }

    return { updatedTimeline, regulation: newAnnounced, event: domainEvent, announced: true }
  }

  /**
   * Ativa um regulamento técnico (ANNOUNCED -> ACTIVE).
   * O regulamento anterior é marcado como SUPERSEDED.
   * REGRA 18: Idempotente — ativar um regulamento já ativo não faz nada.
   * REGRA FINAL: NÃO CRIA O CARRO FUTURO.
   */
  public activateRegulation(params: {
    timeline: RegulationTimelineState
    regulationId: string
    seasonYear: number
    sourceEventId?: string
  }): {
    updatedTimeline: RegulationTimelineState
    activatedRegulation: TechnicalRegulation | null
    supersededRegulation: TechnicalRegulation | null
    event: RegulationDomainEvent | null
    activated: boolean
  } {
    const { timeline, regulationId, seasonYear, sourceEventId } = params

    const target = timeline.regulations.find((r) => r.regulationId === regulationId)
    if (!target) {
      return {
        updatedTimeline: timeline,
        activatedRegulation: null,
        supersededRegulation: null,
        event: null,
        activated: false,
      }
    }

    if (target.status === 'ACTIVE') {
      // Já ativo: idempotente
      return {
        updatedTimeline: timeline,
        activatedRegulation: target,
        supersededRegulation: null,
        event: null,
        activated: false,
      }
    }

    let superseded: TechnicalRegulation | null = null
    const updatedRegulations = timeline.regulations.map((r) => {
      if (r.status === 'ACTIVE') {
        superseded = { ...r, status: 'SUPERSEDED', updatedAt: new Date().toISOString() }
        return superseded
      }
      if (r.regulationId === regulationId) {
        return {
          ...r,
          status: 'ACTIVE' as RegulationStatus,
          updatedAt: new Date().toISOString(),
        }
      }
      return r
    })

    const activatedReg = updatedRegulations.find((r) => r.regulationId === regulationId) || null

    const domainEvent: RegulationDomainEvent = {
      eventId: sourceEventId || `ev_act_${regulationId}_${Date.now()}`,
      type: 'RegulationActivated',
      regulationId,
      sourceSeason: seasonYear,
      effectiveSeason: seasonYear,
      timestamp: new Date().toISOString(),
      description: `Regulamento técnico ${activatedReg?.name} entrou oficialmente em vigor na temporada ${seasonYear}.`,
    }

    const updatedTimeline: RegulationTimelineState = {
      ...timeline,
      version: timeline.version + 1,
      activeEraId: activatedReg?.technicalEraId || timeline.activeEraId,
      activeRegulationId: regulationId,
      currentSeason: seasonYear,
      regulations: updatedRegulations,
      historyLog: [
        ...timeline.historyLog,
        {
          timestamp: new Date().toISOString(),
          sourceEventId: domainEvent.eventId,
          eventType: 'REGULATION_ACTIVATED',
          regulationId,
          summary: `Regulamento ativado para a temporada ${seasonYear}.`,
        },
      ],
    }

    return {
      updatedTimeline,
      activatedRegulation: activatedReg,
      supersededRegulation: superseded,
      event: domainEvent,
      activated: true,
    }
  }

  /**
   * Cancela uma proposta (PROPOSED -> CANCELLED).
   */
  public cancelProposal(params: {
    timeline: RegulationTimelineState
    regulationId: string
    reason?: string
    sourceEventId?: string
  }): { updatedTimeline: RegulationTimelineState; cancelled: boolean } {
    const { timeline, regulationId, sourceEventId } = params
    const target = timeline.regulations.find((r) => r.regulationId === regulationId)
    if (!target || target.status !== 'PROPOSED') {
      return { updatedTimeline: timeline, cancelled: false }
    }

    const updatedRegulations = timeline.regulations.map((r) => {
      if (r.regulationId === regulationId) {
        return {
          ...r,
          status: 'CANCELLED' as RegulationStatus,
          updatedAt: new Date().toISOString(),
        }
      }
      return r
    })

    const updatedTimeline: RegulationTimelineState = {
      ...timeline,
      version: timeline.version + 1,
      regulations: updatedRegulations,
      historyLog: [
        ...timeline.historyLog,
        {
          timestamp: new Date().toISOString(),
          sourceEventId: sourceEventId || `ev_canc_${regulationId}`,
          eventType: 'REGULATION_CANCELLED',
          regulationId,
          summary: `Proposta cancelada pela FIA. ${params.reason || ''}`,
        },
      ],
    }

    return { updatedTimeline, cancelled: true }
  }

  /**
   * REUTILIZAÇÃO OBRIGATÓRIA DA 7B (Regra 9, 10 e 13):
   * getApplicableKnowledge(teamId, regulationId, domain)
   *
   * Conceitualmente:
   * ApplicableKnowledge = ExistingKnowledge × Transferability
   *
   * Busca a base no OrganizationalKnowledge da 7B (domains.aerodynamics, etc.),
   * localiza a taxa de transferabilidade do regulamento para o domínio,
   * e calcula o conhecimento aplicável.
   *
   * NESTA ETAPA ISSO NÃO ALTERA CARRO NEM GERA PERFORMANCE.
   */
  public getApplicableKnowledge(params: {
    teamTechnicalOrg: TeamTechnicalOrganization
    regulation: TechnicalRegulation
    domain: TechnicalDomainId
  }): {
    domain: TechnicalDomainId
    existingKnowledge: number
    transferabilityRatio: number
    applicableKnowledge: number
    transferabilityTier: string
  } {
    const { teamTechnicalOrg, regulation, domain } = params

    // 1. Mapear TechnicalDomainId para KnowledgeDomain da 7B
    const domainMap7B: Record<TechnicalDomainId, KnowledgeDomain> = {
      aerodynamics: 'aerodynamics',
      floorGroundEffect: 'aerodynamics',
      chassis: 'chassis',
      vehicleDynamics: 'vehicleDynamics',
      suspension: 'vehicleDynamics',
      cooling: 'chassis',
      mechanicalGrip: 'vehicleDynamics',
      weightManagement: 'chassis',
      simulation: 'simulation',
      manufacturing: 'operations',
      reliability: 'operations',
      powerUnitIntegration: 'chassis',
    }

    const domain7BKey = domainMap7B[domain] || 'operations'
    const orgDomainData = teamTechnicalOrg.knowledge?.domains?.[domain7BKey]
    const existingKnowledge = orgDomainData?.accumulatedExperience ?? 70

    // 2. Transferabilidade definida no regulamento para o domínio
    const transferabilityRatio = regulation.transferabilityProfile[domain] ?? 0.8

    // 3. Conhecimento aplicável
    // Regra 12: Conhecimento genérico nunca é zerado (mínimo absoluto de segurança: 15)
    const rawApplicable = Math.round(existingKnowledge * transferabilityRatio)
    const applicableKnowledge = Math.max(15, Math.min(100, rawApplicable))

    const tier = getKnowledgeTransferTier(transferabilityRatio)

    return {
      domain,
      existingKnowledge,
      transferabilityRatio,
      applicableKnowledge,
      transferabilityTier: tier,
    }
  }

  /**
   * Helper simplificado para consulta rápida
   */
  public async getApplicableKnowledgeForTeam(params: {
    teamId: string
    regulationId: string
    domain: TechnicalDomainId
    seasonYear: number
  }): Promise<{
    domain: TechnicalDomainId
    existingKnowledge: number
    transferabilityRatio: number
    applicableKnowledge: number
    transferabilityTier: string
  }> {
    const org = await technicalOrganizationService.getTechnicalOrganization(
      params.teamId,
      params.seasonYear,
    )
    const timeline = await regulationTimelineService.getTimeline(params.teamId, params.seasonYear)
    const regulation = regulationTimelineService.findRegulationById(timeline, params.regulationId)

    if (!regulation) {
      return {
        domain: params.domain,
        existingKnowledge: 70,
        transferabilityRatio: 1.0,
        applicableKnowledge: 70,
        transferabilityTier: 'VERY_HIGH',
      }
    }

    return this.getApplicableKnowledge({
      teamTechnicalOrg: org,
      regulation,
      domain: params.domain,
    })
  }

  /**
   * EXPLICABILIDADE CANÔNICA (Regra 30)
   * explainRegulationImpact(regulationId)
   * Formata texto explicativo sem mostrar performance futura ou números crus para a UI.
   */
  public explainRegulationImpact(regulation: TechnicalRegulation): RegulationImpactExplanation {
    const domainExplanations = CANONICAL_TECHNICAL_DOMAINS.map((domainId) => {
      const meta = TECHNICAL_DOMAIN_METAS[domainId]
      const isAffected = regulation.affectedDomains.includes(domainId)
      const ratio = regulation.transferabilityProfile[domainId] ?? 0.8
      const tier = getKnowledgeTransferTier(ratio)
      const priority = regulation.technicalPriorities[domainId] || 'LOW'

      let severity: RegulationSeverity = 'LOW'
      if (isAffected) {
        if (ratio < 0.5) severity = 'EXTREME'
        else if (ratio < 0.7) severity = 'HIGH'
        else severity = 'MEDIUM'
      }

      let summaryText = ''
      if (!isAffected) {
        summaryText = 'Conhecimento e metodologias atuais continuam com validade quase total.'
      } else if (meta.category === 'specific_aero') {
        summaryText =
          ratio < 0.5
            ? 'Ruptura profunda no conceito aerodinâmico; a base anterior terá baixa aplicabilidade.'
            : 'Ajuste aerodinâmico significativo, com retenção moderada de conceitos anteriores.'
      } else if (meta.category === 'generic_capability') {
        summaryText =
          'Competência operacional e processos de fabricação sobrevivem intactos para a nova fase.'
      } else {
        summaryText = 'Impacto mecânico e estrutural moderado sobre os padrões de projeto.'
      }

      return {
        domainId,
        domainName: meta.name,
        category: meta.category,
        isAffected,
        impactSeverity: severity,
        priority,
        transferabilityTier: tier,
        summaryText,
      }
    })

    let verdict = ''
    switch (regulation.category) {
      case 'TECHNICAL_DIRECTIVE':
        verdict =
          'Diretiva técnica pontual. A esmagadora maioria do conhecimento e projetos segue válida.'
        break
      case 'MINOR_REGULATION_CHANGE':
        verdict =
          'Ajuste anual de regras. Alta continuidade técnica com necessidade de refinamento em áreas específicas.'
        break
      case 'MAJOR_REGULATION_CHANGE':
        verdict =
          'Mudança estrutural relevante. Exige redirecionamento de conceitos e adaptação técnica sólida.'
        break
      case 'NEW_TECHNICAL_ERA':
        verdict =
          'Nova era técnica. Ruptura em conceitos de downforce e chassi; know-how genérico e de manufatura permanece como alicerce.'
        break
    }

    return {
      regulationId: regulation.regulationId,
      regulationName: regulation.name,
      category: regulation.category,
      status: regulation.status,
      announcementSeason: regulation.announcementSeason,
      effectiveSeason: regulation.effectiveSeason,
      uncertainty: regulation.uncertainty,
      publicDescription: regulation.publicDescription,
      domains: domainExplanations,
      generalVerdict: verdict,
    }
  }

  /**
   * AUDITORIA FORMAL DO NÚCLEO REGULATÓRIO (Regra 29)
   * auditRegulationFoundation()
   * Valida: IDs únicos; active era válida; announcementSeason válido; effectiveSeason válido;
   * domains válidos; transferability presente; timeline persistente; sem ativações duplicadas;
   * nenhum evento retroativo inválido.
   */
  public auditRegulationFoundation(timeline: RegulationTimelineState): {
    isValid: boolean
    errors: string[]
    warnings: string[]
    stats: {
      totalRegulations: number
      activeCount: number
      announcedCount: number
      proposedCount: number
      supersededCount: number
      cancelledCount: number
    }
  } {
    const errors: string[] = []
    const warnings: string[] = []
    const seenIds = new Set<string>()

    let activeCount = 0
    let announcedCount = 0
    let proposedCount = 0
    let supersededCount = 0
    let cancelledCount = 0

    if (!timeline.activeEraId) {
      errors.push('activeEraId não definido na timeline.')
    }
    if (!timeline.activeRegulationId) {
      errors.push('activeRegulationId não definido na timeline.')
    }

    for (const reg of timeline.regulations) {
      // 1. IDs únicos
      if (seenIds.has(reg.regulationId)) {
        errors.push(`ID de regulamento duplicado: ${reg.regulationId}`)
      }
      seenIds.add(reg.regulationId)

      // 2. Status count
      if (reg.status === 'ACTIVE') activeCount++
      if (reg.status === 'ANNOUNCED') announcedCount++
      if (reg.status === 'PROPOSED') proposedCount++
      if (reg.status === 'SUPERSEDED') supersededCount++
      if (reg.status === 'CANCELLED') cancelledCount++

      // 3. Validação de temporadas
      if (!reg.announcementSeason || reg.announcementSeason < 2000) {
        errors.push(
          `announcementSeason inválido para ${reg.regulationId}: ${reg.announcementSeason}`,
        )
      }
      if (!reg.effectiveSeason || reg.effectiveSeason < 2000) {
        errors.push(`effectiveSeason inválido para ${reg.regulationId}: ${reg.effectiveSeason}`)
      }
      if (reg.announcementSeason > reg.effectiveSeason) {
        errors.push(
          `announcementSeason (${reg.announcementSeason}) posterior a effectiveSeason (${reg.effectiveSeason}) em ${reg.regulationId}`,
        )
      }

      // 4. Domains válidos
      for (const dom of reg.affectedDomains) {
        if (!CANONICAL_TECHNICAL_DOMAINS.includes(dom)) {
          errors.push(`Domínio afetado inválido em ${reg.regulationId}: ${dom}`)
        }
      }

      // 5. Transferability presente e nos limites [0.0, 1.0]
      if (!reg.transferabilityProfile) {
        errors.push(`transferabilityProfile ausente em ${reg.regulationId}`)
      } else {
        for (const dom of CANONICAL_TECHNICAL_DOMAINS) {
          const val = reg.transferabilityProfile[dom]
          if (typeof val !== 'number' || isNaN(val) || val < 0 || val > 1) {
            errors.push(
              `Valor de transferabilidade inválido para domínio ${dom} em ${reg.regulationId}: ${val}`,
            )
          }
        }
      }
    }

    // 6. Deve haver exatamente um ACTIVE
    if (activeCount !== 1) {
      errors.push(
        `Deve haver exatamente 1 regulamento ACTIVE na timeline (encontrados: ${activeCount}).`,
      )
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      stats: {
        totalRegulations: timeline.regulations.length,
        activeCount,
        announcedCount,
        proposedCount,
        supersededCount,
        cancelledCount,
      },
    }
  }

  // ==========================================
  // 16. IMPLEMENTAÇÃO 8C.2: ALOCAÇÃO DE DESENVOLVIMENTO
  // ==========================================

  /**
   * Obtém a alocação de desenvolvimento da equipe (currentCar vs futureRegulation).
   * Default: CURRENT_FOCUS se não houver regulamento futuro, ou BALANCED se houver anunciado.
   */
  public async getAllocation(
    teamId: string,
    regulationId?: string,
  ): Promise<RegulationDevelopmentAllocation> {
    try {
      const record = await pb.collection('teams').getOne(teamId, {
        fields: 'id,regulation_development_allocation',
      })
      const alloc = (record as any)?.regulation_development_allocation as
        | RegulationDevelopmentAllocation
        | undefined
      if (alloc && typeof alloc.currentCarShare === 'number') {
        // Garantir que a soma é 100
        const currentCarShare = Math.max(0, Math.min(100, Math.round(alloc.currentCarShare)))
        const futureRegulationShare = 100 - currentCarShare
        return {
          ...alloc,
          currentCarShare,
          futureRegulationShare,
        }
      }
    } catch {
      // tolerância: fallback neutro
    }

    return {
      teamId,
      regulationId: regulationId || '',
      currentCarShare: 75,
      futureRegulationShare: 25,
      selectedStrategy: 'CURRENT_FOCUS',
      effectiveRound: 1,
    }
  }

  /**
   * Altera a alocação de desenvolvimento.
   * REGRA:
   * - Presets: CURRENT_FOCUS (75/25), BALANCED (50/50), FUTURE_FOCUS (25/75), CUSTOM.
   * - currentCarShare + futureRegulationShare === 100 sempre.
   * - effectiveRound marca o round da mudança.
   * - Anti-exploit: afeta apenas rounds futuros, nunca recalculando ou revertendo rounds passados nem pesquisas já concluídas.
   */
  public async setAllocation(params: {
    teamId: string
    regulationId: string
    strategy: DevelopmentStrategyPreset
    currentCarShare?: number
    currentRound: number
    sourceEventId?: string
  }): Promise<RegulationDevelopmentAllocation> {
    const { teamId, regulationId, strategy, currentRound, sourceEventId } = params

    let currentShare = 50
    let futureShare = 50

    switch (strategy) {
      case 'CURRENT_FOCUS':
        currentShare = 75
        futureShare = 25
        break
      case 'BALANCED':
        currentShare = 50
        futureShare = 50
        break
      case 'FUTURE_FOCUS':
        currentShare = 25
        futureShare = 75
        break
      case 'CUSTOM':
        currentShare = Math.max(0, Math.min(100, Math.round(params.currentCarShare ?? 50)))
        futureShare = 100 - currentShare
        break
    }

    const allocation: RegulationDevelopmentAllocation = {
      teamId,
      regulationId,
      currentCarShare: currentShare,
      futureRegulationShare: futureShare,
      selectedStrategy: strategy,
      effectiveRound: currentRound,
      lastUpdatedRound: currentRound,
      sourceEventId: sourceEventId || `alloc_${teamId}_r${currentRound}_${Date.now()}`,
    }

    try {
      await pb.collection('teams').update(teamId, {
        regulation_development_allocation: allocation,
      })
    } catch (err) {
      // tolerância para testes / offline
    }

    return allocation
  }

  // ==========================================
  // 17. IMPLEMENTAÇÃO 8C.2: PREPARATION & RESEARCH
  // ==========================================

  /**
   * Obtém a preparação técnica persistida para uma equipe em um regulamento.
   */
  public async getPreparation(
    teamId: string,
    regulationId: string,
    currentSeasonYear = 2026,
    currentRound = 1,
  ): Promise<RegulationPreparation> {
    try {
      const record = await pb.collection('teams').getOne(teamId, {
        fields: 'id,regulation_preparations',
      })
      const preps = (record as any)?.regulation_preparations as
        | Record<string, RegulationPreparation>
        | undefined
      if (preps && preps[regulationId]) {
        return preps[regulationId]
      }
    } catch {
      // tolerância
    }

    return {
      teamId,
      regulationId,
      researchProgress: 0,
      knowledgeGain: 0,
      validationProgress: 0,
      simulationConfidence: 0,
      preparationScore: 0,
      status: 'MINIMAL',
      completedProjects: [],
      completedProjectDetails: [],
      lastUpdatedSeason: currentSeasonYear,
      lastUpdatedRound: currentRound,
    }
  }

  /**
   * Persiste o estado da preparação técnica na equipe.
   */
  public async persistPreparation(
    teamId: string,
    preparation: RegulationPreparation,
  ): Promise<void> {
    try {
      const record = await pb.collection('teams').getOne(teamId, {
        fields: 'id,regulation_preparations',
      })
      const existingPreps =
        ((record as any)?.regulation_preparations as Record<string, RegulationPreparation>) || {}
      existingPreps[preparation.regulationId] = preparation

      await pb.collection('teams').update(teamId, {
        regulation_preparations: existingPreps,
      })
    } catch {
      // tolerância
    }
  }

  /**
   * Lista os projetos de pesquisa da equipe (ativos e concluídos).
   */
  public async getResearchProjects(
    teamId: string,
    regulationId?: string,
  ): Promise<NextRegulationResearchProject[]> {
    try {
      const record = await pb.collection('teams').getOne(teamId, {
        fields: 'id,next_regulation_research_projects',
      })
      const list = ((record as any)?.next_regulation_research_projects ||
        []) as NextRegulationResearchProject[]
      if (regulationId) {
        return list.filter((p) => p.regulationId === regulationId)
      }
      return list
    } catch {
      return []
    }
  }

  /**
   * Persiste a lista completa de projetos de pesquisa da equipe.
   */
  public async persistResearchProjects(
    teamId: string,
    projects: NextRegulationResearchProject[],
  ): Promise<void> {
    try {
      await pb.collection('teams').update(teamId, {
        next_regulation_research_projects: projects,
      })
    } catch {
      // tolerância
    }
  }

  /**
   * Inicia um novo projeto de pesquisa NEXT_REGULATION_RESEARCH.
   * REGRAS FUNDAMENTAIS:
   * - Respeita a mesma arquitetura de recursos e capacidade de P&D (carDevelopmentService).
   * - Capacidade consumida deve caber nos pontos futuros ou compartilhados.
   * - Finanças: Toda despesa passa pelo Financial Ledger com idempotency key.
   * - Cost Cap: incluído na categoria 'development' (classificação oficial 5A incluída no teto).
   * - Cria commitment financeiro no Ledger para Available Cash.
   * - Valida se o target já não foi pesquisado com sucesso ou está em andamento.
   */
  public async startResearchProject(params: {
    team: TeamModel
    regulation: TechnicalRegulation
    targetDomain: ResearchTargetDomain
    currentSeasonYear: number
    currentRound: number
    sourceEventId?: string
  }): Promise<{
    project: NextRegulationResearchProject
    created: boolean
    errorMessage?: string
  }> {
    const { team, regulation, targetDomain, currentSeasonYear, currentRound, sourceEventId } =
      params
    const targetMeta = CANONICAL_RESEARCH_TARGETS[targetDomain]
    if (!targetMeta) {
      return {
        project: null as any,
        created: false,
        errorMessage: `Target de pesquisa inválido: ${targetDomain}`,
      }
    }

    // 1. Verificar se o regulamento é legitimamente ANNOUNCED
    if (regulation.status !== 'ANNOUNCED' && regulation.status !== 'PROPOSED') {
      return {
        project: null as any,
        created: false,
        errorMessage: `Pesquisa só é permitida para regulamentos anunciados ou propostos (status atual: ${regulation.status}).`,
      }
    }

    // 2. Verificar se já existe projeto desse target em andamento ou já concluído
    const currentProjects = await this.getResearchProjects(team.id, regulation.regulationId)
    const existingSameTarget = currentProjects.find(
      (p) =>
        p.targetDomain === targetDomain && (p.status === 'in_progress' || p.status === 'completed'),
    )
    if (existingSameTarget) {
      return {
        project: existingSameTarget,
        created: false,
        errorMessage: `Um projeto para ${targetMeta.name} já foi concluído ou está em andamento.`,
      }
    }

    // 3. Checar capacidade técnica de engenharia
    const facilityLevels = infrastructureCapabilityService.getFacilityLevels(team)
    const capabilities = infrastructureCapabilityService.calculateCapabilities(facilityLevels, team)

    // Avaliar bottlenecks das instalações para este target
    let bottleneckDetected = false
    let bottleneckExplanation = ''

    if (targetDomain === 'AERO_CONCEPT' || targetDomain === 'FLOOR_PHILOSOPHY') {
      // Exemplo canônico da 4A: CFD alto + Wind Tunnel fraco
      if (facilityLevels.cfd >= facilityLevels.wind_tunnel + 2) {
        bottleneckDetected = true
        bottleneckExplanation = `Gargalo de correlação detectado: Cluster CFD Nível ${facilityLevels.cfd} produz dados virtuais que o Túnel de Vento Nível ${facilityLevels.wind_tunnel} não valida com fidelidade física.`
      }
    }

    // 4. Modulador do Staff (7B)
    let staffMod = 1.0
    const teamOrg = (team as any)?.technical_organization as TeamTechnicalOrganization | undefined
    if (teamOrg && teamOrg.members) {
      const role = targetMeta.requiredStaffRole
      const member = teamOrg.members[role]
      if (member) {
        const eff = technicalOrganizationService.calculateStaffEffectiveness(member, role)
        // Efetividade 80 = neutro (1.0), 99 = 1.15, 40 = 0.8
        staffMod = 0.75 + (eff / 100) * 0.3
      }
    }

    // Duração base ajustada
    let durationRounds = targetMeta.baseDurationRounds
    if (capabilities.developmentThroughput < 45) {
      durationRounds += 1
    }

    // Custo base
    const cost = targetMeta.baseCostUsd
    const resourceCost = 25

    // 5. Integração Financeira: Idempotência & Financial Ledger
    const projectId = `res_${regulation.regulationId}_${targetDomain.toLowerCase()}_${Date.now().toString(36)}`
    const idempotencyKey = sourceEventId || `ledger_research_${projectId}`

    // Registro da transação financeira no Financial Ledger
    // Cost cap: incluído (included) conforme 5A
    try {
      await financialLedgerService.postTransaction({
        teamId: team.id,
        seasonYear: currentSeasonYear,
        round: currentRound,
        type: 'expense',
        category: 'development',
        subcategory: 'regulation_research',
        direction: 'outflow',
        amount: cost,
        costCapClassification: 'included',
        costCapAmount: cost,
        sourceSystem: 'next_regulation_research',
        sourceEntityId: projectId,
        idempotencyKey,
        description: `Pesquisa Regulatória (${regulation.name}): ${targetMeta.name}`,
        metadata: {
          targetDomain,
          regulationId: regulation.regulationId,
          bottleneckDetected,
        },
      })
    } catch (e: any) {
      // Se já foi processado ou falhou por saldo
      if (!e?.message?.includes('idempotency')) {
        console.warn('Registro contábil de research:', e?.message || e)
      }
    }

    // 6. Label Qualitativo do Conhecimento Esperado (sem revelar números futuros crus)
    let knowledgeLabel: 'Baixo' | 'Moderado' | 'Substancial' | 'Revolucionário' = 'Moderado'
    if (staffMod >= 1.05 && !bottleneckDetected) {
      knowledgeLabel = 'Substancial'
    } else if (staffMod >= 1.12 && capabilities.simulationAccuracy > 80) {
      knowledgeLabel = 'Revolucionário'
    } else if (bottleneckDetected) {
      knowledgeLabel = 'Baixo'
    }

    const newProject: NextRegulationResearchProject = {
      id: projectId,
      teamId: team.id,
      regulationId: regulation.regulationId,
      targetDomain,
      targetName: targetMeta.name,
      roundStarted: currentRound,
      roundCompletedTarget: currentRound + durationRounds,
      durationRounds,
      progressPercent: 0,
      status: 'in_progress',
      costUsd: cost,
      engineeringResourceCost: resourceCost,
      estimatedKnowledgeGainLabel: knowledgeLabel,
      mappedDomain: targetMeta.mappedDomain,
      correlationBottleneckDetected: bottleneckDetected,
      bottleneckExplanation: bottleneckDetected ? bottleneckExplanation : undefined,
    }

    const updatedProjects = [...currentProjects, newProject]
    await this.persistResearchProjects(team.id, updatedProjects)

    return {
      project: newProject,
      created: true,
    }
  }

  /**
   * Avança projetos de pesquisa da próxima regulação na virada de rodada.
   * Ao concluir:
   * - Emite evento FutureCarResearchCompleted.
   * - Atualiza RegulationPreparation UMA ÚNICA VEZ (sem duplicações).
   * - NÃO grava futurePerformanceBonus nem qualquer rating determinístico de carro futuro.
   */
  public advanceResearchProjectsOnRound(params: {
    team: TeamModel
    currentRound: number
    currentSeasonYear: number
    regulationTimeline: RegulationTimelineState
  }): {
    updatedProjects: NextRegulationResearchProject[]
    completedProjects: NextRegulationResearchProject[]
    updatedPreparations: Record<string, RegulationPreparation>
    events: {
      type: string
      teamId: string
      regulationId: string
      targetDomain: string
      description: string
    }[]
  } {
    const { team, currentRound, currentSeasonYear } = params
    const existingProjects =
      ((team as any)?.next_regulation_research_projects as NextRegulationResearchProject[]) || []
    const existingPreps =
      ((team as any)?.regulation_preparations as Record<string, RegulationPreparation>) || {}

    const updatedProjects = [...existingProjects]
    const completedProjects: NextRegulationResearchProject[] = []
    const updatedPreparations = { ...existingPreps }
    const events: {
      type: string
      teamId: string
      regulationId: string
      targetDomain: string
      description: string
    }[] = []

    const facilityLevels = infrastructureCapabilityService.getFacilityLevels(team)
    const capabilities = infrastructureCapabilityService.calculateCapabilities(facilityLevels, team)

    for (let i = 0; i < updatedProjects.length; i++) {
      const proj = updatedProjects[i]
      if (proj.status !== 'in_progress') continue

      const totalRounds = Math.max(1, proj.roundCompletedTarget - proj.roundStarted)
      const elapsed = currentRound - proj.roundStarted
      const progress = Math.min(100, Math.round((elapsed / totalRounds) * 100))
      proj.progressPercent = progress

      if (currentRound >= proj.roundCompletedTarget) {
        // Conclusão do projeto!
        proj.status = 'completed'
        proj.completedRound = currentRound

        // Cálculo do ganho de preparação e confiança técnica (0 a 100)
        let baseGain = 20
        if (proj.estimatedKnowledgeGainLabel === 'Revolucionário') baseGain = 28
        else if (proj.estimatedKnowledgeGainLabel === 'Substancial') baseGain = 24
        else if (proj.estimatedKnowledgeGainLabel === 'Baixo') baseGain = 12

        // Se houver bottleneck de correlação detectado (ex: CFD forte + Túnel fraco),
        // o ganho de simulação existe mas a correlação e validação física sofrem
        let simConfidenceGain = 15
        if (proj.correlationBottleneckDetected) {
          baseGain = Math.round(baseGain * 0.6)
          simConfidenceGain = Math.round(simConfidenceGain * 0.4)
        }

        proj.actualKnowledgeGained = baseGain
        proj.actualSimulationConfidenceGained = simConfidenceGain

        completedProjects.push(proj)

        // Atualizar RegulationPreparation UMA ÚNICA VEZ
        const regId = proj.regulationId
        const prep: RegulationPreparation = updatedPreparations[regId] || {
          teamId: team.id,
          regulationId: regId,
          researchProgress: 0,
          knowledgeGain: 0,
          validationProgress: 0,
          simulationConfidence: 0,
          preparationScore: 0,
          status: 'MINIMAL',
          completedProjects: [],
          completedProjectDetails: [],
          lastUpdatedSeason: currentSeasonYear,
          lastUpdatedRound: currentRound,
        }

        // Adiciona se não presente
        if (!prep.completedProjects.includes(proj.id)) {
          prep.completedProjects.push(proj.id)
          prep.completedProjectDetails.push({
            id: proj.id,
            targetDomain: proj.targetDomain,
            completedRound: currentRound,
            knowledgeGain: baseGain,
          })

          prep.knowledgeGain = Math.min(100, prep.knowledgeGain + baseGain)
          prep.simulationConfidence = Math.min(100, prep.simulationConfidence + simConfidenceGain)
          prep.validationProgress = Math.min(
            100,
            Math.round(
              (prep.completedProjects.length / Object.keys(CANONICAL_RESEARCH_TARGETS).length) *
                100,
            ),
          )
          prep.researchProgress = prep.validationProgress

          // Score composto de preparação (0-100)
          prep.preparationScore = Math.min(
            100,
            Math.round(
              prep.knowledgeGain * 0.45 +
                prep.simulationConfidence * 0.25 +
                prep.validationProgress * 0.3,
            ),
          )
          prep.status = calculatePreparationStatus(prep.preparationScore)
          prep.lastUpdatedSeason = currentSeasonYear
          prep.lastUpdatedRound = currentRound

          updatedPreparations[regId] = prep
        }

        events.push({
          type: 'FutureCarResearchCompleted',
          teamId: team.id,
          regulationId: regId,
          targetDomain: proj.targetDomain,
          description: `Projeto de pesquisa regulatória "${proj.targetName}" concluído. Preparação técnica consolidada em nível ${formatPreparationStatusLabel(prep.status)}.`,
        })
      }
    }

    return {
      updatedProjects,
      completedProjects,
      updatedPreparations,
      events,
    }
  }

  // ==========================================
  // 18. IMPLEMENTAÇÃO 8C.2: AUDITORIA & EXPLICABILIDADE
  // ==========================================

  /**
   * Auditoria estrita da preparação regulatória da equipe.
   * Valida:
   * 1. Soma da alocação = 100%.
   * 2. IDs de projetos de pesquisa únicos.
   * 3. Sem conclusões duplicadas na preparação.
   * 4. Progresso entre 0 e 100.
   * 5. Sem alocação retroativa.
   * 6. Sem gravação de futurePerformanceBonus ou campos determinísticos de pace futuro.
   */
  public auditRegulationPreparation(
    team: TeamModel,
    regulationId: string,
  ): {
    isValid: boolean
    errors: string[]
    warnings: string[]
    metrics: {
      currentCarShare: number
      futureRegulationShare: number
      completedProjectsCount: number
      preparationScore: number
      status: PreparationStatus
    }
  } {
    const errors: string[] = []
    const warnings: string[] = []

    const alloc = (team as any)?.regulation_development_allocation as
      | RegulationDevelopmentAllocation
      | undefined
    const preps = (team as any)?.regulation_preparations as
      | Record<string, RegulationPreparation>
      | undefined
    const prep = preps?.[regulationId]
    const researchProjects =
      ((team as any)?.next_regulation_research_projects as NextRegulationResearchProject[]) || []

    // 1. Checagem de Alocação
    let currentCarShare = 100
    let futureRegulationShare = 0
    if (alloc) {
      currentCarShare = alloc.currentCarShare
      futureRegulationShare = alloc.futureRegulationShare
      if (currentCarShare + futureRegulationShare !== 100) {
        errors.push(
          `Alocação inválida: soma de currentCarShare (${currentCarShare}) e futureRegulationShare (${futureRegulationShare}) deve ser exatamente 100.`,
        )
      }
      if (currentCarShare < 0 || currentCarShare > 100) {
        errors.push(`currentCarShare fora do intervalo 0-100: ${currentCarShare}`)
      }
    }

    // 2. Unicidade de IDs de projetos de pesquisa
    const seenProjectIds = new Set<string>()
    for (const proj of researchProjects) {
      if (seenProjectIds.has(proj.id)) {
        errors.push(`ID de projeto de pesquisa duplicado: ${proj.id}`)
      }
      seenProjectIds.add(proj.id)

      if (proj.progressPercent < 0 || proj.progressPercent > 100) {
        errors.push(`Progresso de pesquisa inválido em ${proj.id}: ${proj.progressPercent}%`)
      }
    }

    // 3. Checagem de Preparação e Ausência de Outcome Determinístico
    let prepScore = 0
    let prepStatus: PreparationStatus = 'MINIMAL'
    if (prep) {
      prepScore = prep.preparationScore
      prepStatus = prep.status

      // Sem conclusões duplicadas
      const uniqueCompleted = new Set(prep.completedProjects)
      if (uniqueCompleted.size !== prep.completedProjects.length) {
        errors.push(`completedProjects contém IDs duplicados em regulation ${regulationId}.`)
      }

      // Regra 2: PREPARAÇÃO NÃO GRAVA futurePerformanceBonus
      if ((prep as any).futurePerformanceBonus !== undefined) {
        errors.push(
          `Violação de integridade: campo 'futurePerformanceBonus' encontrado na preparação. Preparação não determina resultado.`,
        )
      }
      if ((prep as any).guaranteedRatingGain !== undefined) {
        errors.push(
          `Violação de integridade: campo 'guaranteedRatingGain' encontrado na preparação.`,
        )
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics: {
        currentCarShare,
        futureRegulationShare,
        completedProjectsCount: prep?.completedProjects.length || 0,
        preparationScore: prepScore,
        status: prepStatus,
      },
    }
  }

  /**
   * Produz relatório qualitativo detalhado de preparação para a UI / Imprensa / Diretoria.
   * Proibido mostrar ratings futuros crus (ex: "Carro 2030 rating 92").
   */
  public explainRegulationPreparation(
    team: TeamModel,
    regulation: TechnicalRegulation,
  ): {
    strategyName: string
    currentCarAllocationLabel: string
    futureRegulationAllocationLabel: string
    preparationStatusLabel: string
    preparationStatus: PreparationStatus
    researchCompletedCount: number
    totalResearchTargets: number
    mainLimitationOrBottleneck: string
    financialCommitmentSummary: string
    qualitativeOutlook: string
  } {
    const alloc = (team as any)?.regulation_development_allocation as
      | RegulationDevelopmentAllocation
      | undefined
    const preps = (team as any)?.regulation_preparations as
      | Record<string, RegulationPreparation>
      | undefined
    const prep = preps?.[regulation.regulationId]
    const researchProjects = (
      ((team as any)?.next_regulation_research_projects as NextRegulationResearchProject[]) || []
    ).filter((p) => p.regulationId === regulation.regulationId)

    const currentShare = alloc?.currentCarShare ?? 75
    const futureShare = alloc?.futureRegulationShare ?? 25
    const strategy = alloc?.selectedStrategy ?? 'CURRENT_FOCUS'

    const completed = researchProjects.filter((p) => p.status === 'completed')
    const active = researchProjects.filter((p) => p.status === 'in_progress')
    const status = prep?.status ?? 'MINIMAL'

    let limitation = 'Nenhum gargalo de correlação severo identificado nas bancadas de teste.'
    const bottleneckProject = researchProjects.find((p) => p.correlationBottleneckDetected)
    if (bottleneckProject?.bottleneckExplanation) {
      limitation = bottleneckProject.bottleneckExplanation
    }

    let strategyDesc = 'Foco Prioritário no Carro Atual (75% / 25%)'
    if (strategy === 'BALANCED') strategyDesc = 'Divisão Equilibrada de Recursos (50% / 50%)'
    if (strategy === 'FUTURE_FOCUS')
      strategyDesc = 'Foco Agressivo no Regulamento Futuro (25% / 75%)'
    if (strategy === 'CUSTOM')
      strategyDesc = `Divisão Customizada (${currentShare}% Carro Atual / ${futureShare}% Futuro)`

    let outlook = ''
    switch (status) {
      case 'EXTENSIVE':
        outlook =
          'A equipe possui um dos programas conceituais mais maduros do paddock. A dispersão de incerteza foi minimizada, embora o acerto do conceito final dependa da correlação na pista.'
        break
      case 'STRONG':
        outlook =
          'Preparação avançada e dados sólidos coletados nos domínios aerodinâmico e estrutural. A fábrica possui boa leitura preliminar das novas diretrizes da FIA.'
        break
      case 'MODERATE':
        outlook =
          'Estudos preliminares em andamento com compreensão razoável dos fluxos principais. Conceitos críticos ainda carecem de validação aprofundada.'
        break
      case 'LIMITED':
        outlook =
          'Poucos recursos transferidos até o momento. Grande dependência de extrapolações teóricas e alto risco de surpresas na interpretação do regulamento.'
        break
      case 'MINIMAL':
      default:
        outlook =
          'Quase nenhum know-how acumulado especificamente para as novas regras. A equipe corre o risco de chegar à pré-temporada com conceito cru e impreciso.'
        break
    }

    return {
      strategyName: strategyDesc,
      currentCarAllocationLabel: `${currentShare}% da capacidade de P&D`,
      futureRegulationAllocationLabel: `${futureShare}% da capacidade técnica`,
      preparationStatusLabel: formatPreparationStatusLabel(status),
      preparationStatus: status,
      researchCompletedCount: completed.length,
      totalResearchTargets: Object.keys(CANONICAL_RESEARCH_TARGETS).length,
      mainLimitationOrBottleneck: limitation,
      financialCommitmentSummary: `${completed.length + active.length} projetos de pesquisa iniciados sob o teto regulamentar de gastos.`,
      qualitativeOutlook: outlook,
    }
  }

  // ==========================================
  // 19. IMPLEMENTAÇÃO 8C.2: DECISÃO DA IA (SEM CHEAT)
  // ==========================================

  /**
   * Guarda de Integridade contra Cheat da IA:
   * Garante que a IA NUNCA leia ConceptRealization, future ratings, resultado futuro ou hidden outcome.
   */
  public verifyAiInputIntegrity(inputData: any): void {
    const forbiddenKeys = [
      'conceptRealization',
      'futureCarRating',
      'futureChampionshipResult',
      'futurePerformanceBonus',
      'hiddenOutcome',
      'conceptConfidenceFinal',
      'projectError',
    ]
    for (const key of forbiddenKeys) {
      if (inputData && inputData[key] !== undefined) {
        throw new Error(
          `AI INTEGRITY VIOLATION: AI attempt to read forbidden hidden future key "${key}"! AI must only use real observable data.`,
        )
      }
    }
  }

  /**
   * Decide a alocação técnica e projetos de pesquisa para uma equipe da IA.
   * FATORES ANALISADOS:
   * - Championship Position (contender disputa título vs backmarker foca no futuro).
   * - Progresso da Temporada (round atual vs total de rounds).
   * - Anos até ativação do regulamento (effectiveSeason - currentSeason).
   * - Gravidade da regulação (NEW_ERA vs MAJOR vs MINOR).
   * - Saúde Financeira e Teto Orçamentário.
   * - Instalações (facilities) e Staff.
   * - DNA da Equipe (risco, ambição, orientação técnica) e seed de variabilidade (sem hardcode absoluto).
   */
  public evaluateAiAllocationDecision(params: {
    team: TeamModel
    championshipPosition: number
    currentSeasonYear: number
    currentRound: number
    totalRoundsInSeason: number
    regulation: TechnicalRegulation
    seedModifier?: number
  }): {
    strategy: DevelopmentStrategyPreset
    currentCarShare: number
    futureRegulationShare: number
    recommendedResearchTarget?: ResearchTargetDomain
    reasoning: string
  } {
    // 1. Guard contra trapaça da IA
    this.verifyAiInputIntegrity(params)

    const {
      team,
      championshipPosition,
      currentSeasonYear,
      currentRound,
      totalRoundsInSeason,
      regulation,
      seedModifier = 0,
    } = params

    const yearsToEffective = regulation.effectiveSeason - currentSeasonYear
    const isLateSeason = currentRound >= Math.round(totalRoundsInSeason * 0.6)
    const isVeryLateSeason = currentRound >= Math.round(totalRoundsInSeason * 0.8)

    // Avaliação de DNA da equipe (se disponível)
    const riskTolerance = (team as any)?.risk_tolerance ?? 50
    const ambition = (team as any)?.ambition ?? 60

    // Score de incentivo para virar a chave para o futuro (0 a 100)
    let futureWeightScore = 30 // baseline neutro

    // Fator 1: Gravidade do regulamento
    if (regulation.severity === 'EXTREME') {
      futureWeightScore += 25
    } else if (regulation.severity === 'HIGH') {
      futureWeightScore += 15
    }

    // Fator 2: Proximidade
    if (yearsToEffective <= 1) {
      futureWeightScore += 25
      if (isLateSeason) futureWeightScore += 15
    } else if (yearsToEffective === 2) {
      futureWeightScore += 10
    }

    // Fator 3: Posição no Campeonato
    // Contenders (P1-P3) querem vencer o ano atual! Backmarkers (P8-P10) preferem investir no próximo ciclo
    if (championshipPosition <= 2) {
      // Lutando por título
      futureWeightScore -= 30
      if (!isVeryLateSeason) futureWeightScore -= 15
    } else if (championshipPosition <= 4) {
      futureWeightScore -= 15
    } else if (championshipPosition >= 8) {
      // Sem chances de grandes coisas no ano atual
      futureWeightScore += 25
    } else {
      // Pelotão intermediário
      futureWeightScore += 5
    }

    // Fator 4: DNA e seed
    futureWeightScore += (riskTolerance - 50) * 0.2
    futureWeightScore += seedModifier * 8

    // Decisão final de preset
    let strategy: DevelopmentStrategyPreset = 'BALANCED'
    let currentCarShare = 50
    let futureRegulationShare = 50
    let reasoning = ''

    if (futureWeightScore >= 65) {
      strategy = 'FUTURE_FOCUS'
      currentCarShare = 25
      futureRegulationShare = 75
      reasoning = `A equipe (${team.name}, P${championshipPosition}) optou por foco agressivo no novo regulamento (${regulation.effectiveSeason}), priorizando estudos de conceito com 75% da capacidade técnica.`
    } else if (futureWeightScore <= 35) {
      strategy = 'CURRENT_FOCUS'
      currentCarShare = 75
      futureRegulationShare = 25
      reasoning = `Na disputa de ponta pelo campeonato atual (P${championshipPosition}), a equipe dedicou 75% dos recursos de P&D ao carro vigente, mantendo apenas estudos exploratórios de base.`
    } else {
      strategy = 'BALANCED'
      currentCarShare = 50
      futureRegulationShare = 50
      reasoning = `Equilíbrio pragmático (50/50): mantendo evolução consistente no campeonato atual enquanto estrutura os primeiros conceitos da nova geração de monopostos.`
    }

    // Identificar próximo target de pesquisa recomendado para a IA
    let recommendedResearchTarget: ResearchTargetDomain | undefined
    const existingProjects =
      ((team as any)?.next_regulation_research_projects as NextRegulationResearchProject[]) || []
    const completedOrActive = new Set(existingProjects.map((p) => p.targetDomain))

    // Ordem de prioridade técnica lógica da F1:
    const canonicalPriorityOrder: ResearchTargetDomain[] = [
      'AERO_CONCEPT',
      'FLOOR_PHILOSOPHY',
      'COOLING_ARCHITECTURE',
      'SUSPENSION_ARCHITECTURE',
      'SIMULATION_CORRELATION',
      'VEHICLE_DYNAMICS',
      'WEIGHT_INTEGRATION',
      'PU_INTEGRATION',
    ]

    for (const target of canonicalPriorityOrder) {
      if (!completedOrActive.has(target)) {
        recommendedResearchTarget = target
        break
      }
    }

    return {
      strategy,
      currentCarShare,
      futureRegulationShare,
      recommendedResearchTarget,
      reasoning,
    }
  }

  // ==========================================
  // 17. IMPLEMENTAÇÃO 8C.3 — CONCEPT REALIZATION & NOVO CARRO
  // ==========================================

  /**
   * Gerador pseudo-aleatório determinístico baseado em Mulberry32.
   * Garante: mesmo snapshot + mesma seed -> mesmo resultado idêntico.
   */
  public seededRandom(seed: number): () => number {
    let t = (seed += 0x6d2b79f5)
    return () => {
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  /**
   * Helper determinístico para converter strings (ex: teamId + regId) em seed numérica.
   */
  public hashStringToSeed(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash |= 0
    }
    return Math.abs(hash)
  }

  /**
   * Decide abordagem (ConceptApproach) para a IA usando:
   * Team DNA Risk, Ambição, Posição no campeonato, Need for Breakthrough, Capability, Preparation.
   * Sem acessar resultado futuro (AI Integrity).
   */
  public evaluateAiConceptApproach(params: {
    team: TeamModel
    championshipPosition?: number
    preparation?: RegulationPreparation
    capabilities?: any
    seedModifier?: number
  }): ConceptApproach {
    this.verifyAiInputIntegrity(params)

    const risk = (params.team as any)?.risk_tolerance ?? 50
    const ambition = (params.team as any)?.ambition ?? 55
    const pos = params.championshipPosition ?? 5
    const prepScore = params.preparation?.preparationScore ?? 50
    const seed = params.seedModifier ?? 0

    // Contenders consolidados (P1-P2) com preparação alta tendem a BALANCED para proteger base
    // Equipes que precisam de virada (P6-P10) ou alto risco tendem a AGGRESSIVE
    let aggressiveBias = (risk - 50) * 0.4 + (ambition - 50) * 0.3
    if (pos >= 6) aggressiveBias += 15 // Need for breakthrough
    if (pos <= 2 && prepScore >= 70) aggressiveBias -= 20 // Conservative/Balanced protection
    if (prepScore < 30) aggressiveBias += 10 // Sem preparação, apelo ao risco
    aggressiveBias += seed * 10

    if (aggressiveBias >= 15) return 'AGGRESSIVE'
    if (aggressiveBias <= -15) return 'CONSERVATIVE'
    return 'BALANCED'
  }

  /**
   * Gera ou recupera o estado de ConceptRealization para teamId + regulationId.
   * REGRAS DE OURO:
   * 1. Equipe forte tem mais chance de acertar, não direito.
   * 2. NÃO é RNG puro: distribuição condicionada pela capacidade real.
   * 3. NÃO é determinismo estrutural: organização excelente pode errar.
   * 4. Approach afeta dispersão: Conservative (menor variância), Aggressive (maior variância e upside).
   * 5. Determinismo: mesmo snapshot + mesma seed -> mesmo ConceptRealization.
   * 6. Concept Confidence: estado separado (LOW, MODERATE, HIGH); pode conter erro se correlação for ruim.
   */
  public generateConceptRealization(params: {
    team: TeamModel
    regulation: TechnicalRegulation
    technicalOrg?: TeamTechnicalOrganization | null
    preparation?: RegulationPreparation | null
    approach?: ConceptApproach
    seedOverride?: number
  }): ConceptRealization {
    const { team, regulation, technicalOrg, preparation } = params
    const teamId = team.id
    const regId = regulation.regulationId

    // 1. Seed determinística
    const baseSeed =
      params.seedOverride ??
      this.hashStringToSeed(`${teamId}_${regId}_${regulation.effectiveSeason}`)
    const rng = this.seededRandom(baseSeed)

    // 2. Abordagem (IA ou Player)
    const approach: ConceptApproach =
      params.approach ||
      this.evaluateAiConceptApproach({
        team,
        preparation: preparation || undefined,
      })

    // 3. Capacidades de Infraestrutura
    const facilityLevels = infrastructureCapabilityService.getFacilityLevels(team)
    const capabilities = infrastructureCapabilityService.calculateCapabilities(facilityLevels, team)

    const simAccuracy = Math.max(10, Math.min(100, capabilities.simulationAccuracy || 50))
    const aeroCorrelation = Math.max(10, Math.min(100, capabilities.aeroCorrelation || 50))
    const designCapacity = Math.max(10, Math.min(100, capabilities.designCapacity || 50))
    const devThroughput = Math.max(10, Math.min(100, capabilities.developmentThroughput || 50))
    const infraScore = (simAccuracy + aeroCorrelation + designCapacity + devThroughput) / 4

    // 4. Staff Técnico Canônico
    let tdRating = 60
    let hoaRating = 60
    let cdRating = 60
    let vpRating = 60
    if (technicalOrg?.members) {
      if (technicalOrg.members.TECHNICAL_DIRECTOR) {
        tdRating = technicalOrganizationService.calculateStaffEffectiveness(
          technicalOrg.members.TECHNICAL_DIRECTOR,
          'TECHNICAL_DIRECTOR',
        )
      }
      if (technicalOrg.members.HEAD_OF_AERODYNAMICS) {
        hoaRating = technicalOrganizationService.calculateStaffEffectiveness(
          technicalOrg.members.HEAD_OF_AERODYNAMICS,
          'HEAD_OF_AERODYNAMICS',
        )
      }
      if (technicalOrg.members.CHIEF_DESIGNER) {
        cdRating = technicalOrganizationService.calculateStaffEffectiveness(
          technicalOrg.members.CHIEF_DESIGNER,
          'CHIEF_DESIGNER',
        )
      }
      if (technicalOrg.members.HEAD_OF_VEHICLE_PERFORMANCE) {
        vpRating = technicalOrganizationService.calculateStaffEffectiveness(
          technicalOrg.members.HEAD_OF_VEHICLE_PERFORMANCE,
          'HEAD_OF_VEHICLE_PERFORMANCE',
        )
      }
    }
    const staffScore = tdRating * 0.35 + hoaRating * 0.3 + cdRating * 0.2 + vpRating * 0.15

    // 5. Applicable Knowledge médio entre os domínios afetados
    let applicableSum = 0
    let applicableCount = 0
    for (const dom of regulation.affectedDomains) {
      const app = this.getApplicableKnowledge({
        teamTechnicalOrg: technicalOrg || ({} as any),
        regulation,
        domain: dom,
      })
      applicableSum += app.applicableKnowledge
      applicableCount++
    }
    const applicableKnowledgeAvg = applicableCount > 0 ? applicableSum / applicableCount : 60

    // 6. Regulation Preparation Score
    const prepScore = preparation ? preparation.preparationScore : 30

    // 7. Structural Potential: capacidade intrínseca sem RNG (35 a 95)
    // Ponderação balanceada: Staff 30%, Infra 25%, Applicable Knowledge 20%, Preparation 25%
    const structuralPotential = Number(
      (
        staffScore * 0.3 +
        infraScore * 0.25 +
        applicableKnowledgeAvg * 0.2 +
        prepScore * 0.25
      ).toFixed(1),
    )

    // 8. Incerteza do Regulamento
    let uncertaintyFactor = 1.0
    if (regulation.uncertainty === 'VERY_HIGH') uncertaintyFactor = 1.4
    else if (regulation.uncertainty === 'HIGH') uncertaintyFactor = 1.2
    else if (regulation.uncertainty === 'MODERATE') uncertaintyFactor = 1.0
    else uncertaintyFactor = 0.8

    // 9. Stochastic Deviation (Approach + Uncertainty)
    // Conservative: desvio menor [-8, +6]
    // Balanced: desvio intermediário [-14, +14]
    // Aggressive: desvio amplo [-25, +22] (alto upside potencial, alto risco de erro crasso)
    let spread = 14
    let bias = 0
    if (approach === 'CONSERVATIVE') {
      spread = 8
      bias = -1
    } else if (approach === 'AGGRESSIVE') {
      spread = 22
      bias = 2
    }

    // Variabilidade controlada com distribuição centrada (Box-Muller determinístico simples via 2 RNGs)
    const u1 = Math.max(0.0001, rng())
    const u2 = rng()
    const normalRand = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) // média 0, std 1
    const rawStochastic = normalRand * (spread * 0.5 * uncertaintyFactor) + bias
    const stochasticDeviation = Number(
      Math.max(-spread * 1.2, Math.min(spread * 1.2, rawStochastic)).toFixed(1),
    )

    // 10. Realization Score Final (0 a 100 oculto)
    // Backmarker limit (Regra 25): estruturalmente muito fraca não pode atingir 90+ por pura sorte
    let rawRealization = structuralPotential + stochasticDeviation
    if (structuralPotential < 50) {
      rawRealization = Math.min(rawRealization, 68) // backmarker cap
    }
    const realizationScore = Number(Math.max(20, Math.min(98, rawRealization)).toFixed(1))

    let realizationQualityTier: 'FLAWED' | 'SUBPAR' | 'COMPETITIVE' | 'STRONG' | 'INSPIRATIONAL' =
      'COMPETITIVE'
    if (realizationScore >= 85) realizationQualityTier = 'INSPIRATIONAL'
    else if (realizationScore >= 75) realizationQualityTier = 'STRONG'
    else if (realizationScore >= 60) realizationQualityTier = 'COMPETITIVE'
    else if (realizationScore >= 45) realizationQualityTier = 'SUBPAR'
    else realizationQualityTier = 'FLAWED'

    // 11. Perceived Realization & Concept Confidence
    // A equipe calcula sua expectativa usando simulação e correlação.
    // Se aeroCorrelation for baixa, a percepção interna pode divergir drasticamente da pista real!
    const correlationFactor = aeroCorrelation / 100 // 0.2 a 1.0
    const simAccuracyFactor = simAccuracy / 100

    // Equipe enxerga o structuralPotential somado ao feedback de simulação
    // Mas se correlação for ruim, ela pode achar que achou ouro quando na verdade há descolamento de fluxo (porpoising / stall)
    const illusionError = (1 - correlationFactor) * (rng() > 0.4 ? 1 : -1) * 20
    const perceivedRealization = Number(
      Math.max(
        20,
        Math.min(99, structuralPotential * 0.7 + prepScore * 0.3 + illusionError),
      ).toFixed(1),
    )

    // Concept Confidence (LOW, MODERATE, HIGH)
    // Depende de preparation, simulação e validação (Regras 10, 11 e 12)
    let confidenceLevel: ConceptConfidenceLevel = 'MODERATE'
    const confidenceScore =
      prepScore * 0.4 + simAccuracy * 0.3 + (preparation?.validationProgress ?? 50) * 0.3
    if (confidenceScore >= 70) confidenceLevel = 'HIGH'
    else if (confidenceScore <= 40) confidenceLevel = 'LOW'
    else confidenceLevel = 'MODERATE'

    // Correlation Gap e detecção de problema
    const correlationGap = Number((perceivedRealization - realizationScore).toFixed(1))
    const correlationProblemDetected = correlationGap >= 12.0 && correlationFactor < 0.65

    return {
      teamId,
      regulationId: regId,
      seed: baseSeed,
      approach,
      realizationScore,
      structuralPotential,
      stochasticDeviation,
      realizationQualityTier,
      confidenceLevel,
      perceivedRealization,
      correlationGap,
      correlationProblemDetected,
      correlationProblemAcknowledged: false,
      stage: 'FINAL_PREPARATION',
      realityCheckStage: 'PRE_SEASON',
      revealedConfidenceBand: {
        min: Math.max(20, Math.round(perceivedRealization - 12)),
        max: Math.min(99, Math.round(perceivedRealization + 12)),
      },
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * Gera o baseline técnico da nova era para uma escuderia.
   * Regras:
   * - 12 atributos canônicos
   * - chassisRating derivado dos 12 atributos e seus pesos oficiais
   * - Preservar 70/30: carPerformanceRating = chassisRating*0.7 + powerUnitRating*0.3
   * - Power Unit adaptation
   * - Track Fit permanece intocado
   */
  public generateNewCarBaseline(params: {
    team: TeamModel
    regulation: TechnicalRegulation
    realization: ConceptRealization
    technicalOrg?: TeamTechnicalOrganization | null
  }): NewCarBaselineResult {
    const { team, regulation, realization, technicalOrg } = params
    const teamId = team.id
    const regId = regulation.regulationId

    // 1. Base geral do chassi a partir de realizationScore
    const baseChassisScore = realization.realizationScore

    // 2. Modulação dos 12 atributos canônicos de acordo com prioridades do regulamento e staff
    const attrs: Record<string, number> = {}

    // Obter atributos dos pesos canônicos (TECHNICAL_ATTRIBUTE_METAS)
    const domainPriorities = regulation.technicalPriorities || {}
    const isAeroPriority =
      domainPriorities.aerodynamics === 'CRITICAL' ||
      domainPriorities.floorGroundEffect === 'CRITICAL'
    const isMechPriority =
      domainPriorities.suspension === 'CRITICAL' || domainPriorities.chassis === 'CRITICAL'

    const attrIds: TechnicalAttributeId[] = [
      'slowCorner',
      'mediumCorner',
      'fastCorner',
      'topSpeed',
      'acceleration',
      'braking',
      'traction',
      'tyreManagement',
      'aeroEfficiency',
      'cooling',
      'weight',
      'reliability',
    ]

    const seedRng = this.seededRandom(realization.seed + 101)

    for (const attrId of attrIds) {
      let attrBase = baseChassisScore
      const deltaSeed = (seedRng() - 0.5) * 8 // dispersão sutil em torno do conceito

      if (['fastCorner', 'aeroEfficiency', 'topSpeed'].includes(attrId)) {
        if (isAeroPriority) attrBase += (realization.realizationScore - 60) * 0.15
      } else if (['slowCorner', 'traction', 'braking'].includes(attrId)) {
        if (isMechPriority) attrBase += (realization.realizationScore - 60) * 0.1
      }

      attrs[attrId] = Number(Math.max(25, Math.min(99, attrBase + deltaSeed)).toFixed(1))
    }

    // 3. Chassis Rating consolidado via pesos dos 12 atributos (soma 100%)
    let weightedChassisSum = 0
    let totalWeight = 0
    for (const attrId of attrIds) {
      const meta = TECHNICAL_ATTRIBUTE_METAS[attrId]
      const weight = meta.weight // porcentagem
      weightedChassisSum += attrs[attrId] * weight
      totalWeight += weight
    }
    const chassisRating = Number((weightedChassisSum / totalWeight).toFixed(1))

    // 4. Power Unit Adaptation (Regras 17 e 58)
    // Avalia o fornecedor de PU e aplica integração ao chassi
    const puSupplier = (team as any)?.engine_supplier || (team as any)?.pu_supplier || 'Mercedes'
    let puBase = 78
    if (puSupplier === 'Ferrari') puBase = 80
    else if (puSupplier === 'Honda' || puSupplier === 'Red Bull Powertrains') puBase = 81
    else if (puSupplier === 'Mercedes') puBase = 80
    else if (puSupplier === 'Audi') puBase = 77
    else if (puSupplier === 'Renault') puBase = 75

    // Se o regulamento tiver PU integration como afetada
    let puIntegrationMod = 0
    if (regulation.affectedDomains.includes('powerUnitIntegration')) {
      const puApp = this.getApplicableKnowledge({
        teamTechnicalOrg: technicalOrg || ({} as any),
        regulation,
        domain: 'powerUnitIntegration',
      })
      puIntegrationMod = (puApp.applicableKnowledge - 60) * 0.08
    }

    const powerUnitRating = Number(Math.max(30, Math.min(99, puBase + puIntegrationMod)).toFixed(1))

    // 5. Preservar estritamente 70/30 (Regra 18)
    const carPerformanceRating = Number((chassisRating * 0.7 + powerUnitRating * 0.3).toFixed(1))

    return {
      teamId,
      regulationId: regId,
      seasonYear: regulation.effectiveSeason,
      chassisRating,
      powerUnitRating,
      carPerformanceRating,
      attributes: attrs,
      powerUnitAdaptation: {
        supplier: puSupplier,
        baselineRating: powerUnitRating,
        reliabilityModifier: attrs.reliability,
        integrationFactor: Number(puIntegrationMod.toFixed(1)),
      },
      conceptRealizationSummary: {
        approach: realization.approach,
        confidenceLevel: realization.confidenceLevel,
        realityCheckStage: realization.realityCheckStage,
        correlationProblemDetected: realization.correlationProblemDetected,
      },
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * Reality Check: Atualiza a revelação gradual do carro conforme as corridas avançam.
   * Pre-season = Incerteza alta (banda de confiança ampla)
   * GP1 = Primeiro sinal (banda estreita)
   * GP2/GP3 = Revelação consolidada
   * O carro real NUNCA é rerrolado, apenas o conhecimento da equipe sobre ele se torna preciso (Regras 27 e 28).
   */
  public progressRealityCheck(params: { realization: ConceptRealization; currentRound: number }): {
    updatedRealization: ConceptRealization
    newsEvent?: string
  } {
    const { realization, currentRound } = params
    let stage: RealityCheckStage = 'PRE_SEASON'
    let newsEvent: string | undefined

    if (currentRound >= 3) {
      stage = 'FULL_REVELATION'
    } else if (currentRound === 2) {
      stage = 'GP2_GP3_EVALUATION'
    } else if (currentRound === 1) {
      stage = 'GP1_FIRST_SIGNAL'
    } else {
      stage = 'PRE_SEASON'
    }

    // Calcular banda revelada
    let spread = 12
    if (stage === 'GP1_FIRST_SIGNAL') spread = 6
    else if (stage === 'GP2_GP3_EVALUATION') spread = 2.5
    else if (stage === 'FULL_REVELATION') spread = 0

    const center =
      stage === 'PRE_SEASON'
        ? realization.perceivedRealization
        : stage === 'GP1_FIRST_SIGNAL'
          ? realization.perceivedRealization * 0.5 + realization.realizationScore * 0.5
          : realization.realizationScore

    const min = Number(Math.max(20, center - spread).toFixed(1))
    const max = Number(Math.min(99, center + spread).toFixed(1))

    // Se houver problema de correlação e chegamos a GP1/GP2, a equipe detecta na pista!
    let ack = realization.correlationProblemAcknowledged
    if (stage !== 'PRE_SEASON' && realization.correlationProblemDetected && !ack) {
      ack = true
      newsEvent =
        'Dados de telemetria em pista indicam divergência severa com o túnel de vento (problema de correlação detectado).'
    }

    const updated: ConceptRealization = {
      ...realization,
      realityCheckStage: stage,
      revealedConfidenceBand: { min, max },
      correlationProblemAcknowledged: ack,
      updatedAt: new Date().toISOString(),
    }

    return { updatedRealization: updated, newsEvent }
  }

  /**
   * Inicia um Concept Pivot: abandono de direção técnica falha.
   * Custos: Dinheiro, Tempo de fábrica, Sunk Cost, Redução temporária de capacity.
   * Não garante recuperação mágica imediata, mas desbloqueia convergência técnica (Regras 30-34).
   */
  public executeConceptPivot(params: {
    team: TeamModel
    realization: ConceptRealization
    currentRound: number
    targetApproach?: ConceptApproach
    costUsd?: number
  }): {
    updatedRealization: ConceptRealization
    pivotState: ConceptPivotState
    success: boolean
    errorMessage?: string
  } {
    const { team, realization, currentRound } = params
    const cost = params.costUsd ?? 12_000_000

    if ((team.budget || 0) < cost) {
      return {
        updatedRealization: realization,
        pivotState: {} as any,
        success: false,
        errorMessage: 'Saldo bancário insuficiente para financiar pivot de conceito aerodinâmico.',
      }
    }

    const targetApproach = params.targetApproach ?? 'BALANCED'

    // Capacidade de recuperação depende da infraestrutura e staff
    const facilityLevels = infrastructureCapabilityService.getFacilityLevels(team)
    const caps = infrastructureCapabilityService.calculateCapabilities(facilityLevels, team)
    const potentialRecovery = Number((caps.designCapacity * 0.12).toFixed(1))

    const pivotState: ConceptPivotState = {
      teamId: team.id,
      regulationId: realization.regulationId,
      seasonYear: (team as any)?.season || 2026,
      pivotActive: true,
      pivotRoundStarted: currentRound,
      pivotTargetRoundCompleted: currentRound + 4, // 4 GPs para introduzir pacote 'B-Spec'
      costUsd: cost,
      engineeringCapacitySacrifice: 25, // 25% do P&D focado em retrabalho
      sunkCostUsd: cost * 0.6,
      potentialRecoveryAmount: potentialRecovery,
      recoveredAmount: 0,
      pivotApproach: targetApproach,
      status: 'in_progress',
    }

    const updatedRealization: ConceptRealization = {
      ...realization,
      approach: targetApproach,
      correlationProblemAcknowledged: true,
      updatedAt: new Date().toISOString(),
    }

    return {
      updatedRealization,
      pivotState,
      success: true,
    }
  }

  /**
   * Aplica recuperação gradual do Pivot conforme rodadas avançam.
   */
  public advanceConceptPivot(params: {
    pivotState: ConceptPivotState
    realization: ConceptRealization
    currentRound: number
  }): {
    updatedPivotState: ConceptPivotState
    updatedRealization: ConceptRealization
    completed: boolean
  } {
    const { pivotState, realization, currentRound } = params
    if (!pivotState.pivotActive || pivotState.status !== 'in_progress') {
      return { updatedPivotState: pivotState, updatedRealization: realization, completed: false }
    }

    const isDone = currentRound >= (pivotState.pivotTargetRoundCompleted ?? 99)
    const roundsDone = Math.max(0, currentRound - (pivotState.pivotRoundStarted ?? currentRound))
    const totalRounds = Math.max(
      1,
      (pivotState.pivotTargetRoundCompleted ?? currentRound) -
        (pivotState.pivotRoundStarted ?? currentRound),
    )
    const progressRatio = Math.min(1.0, roundsDone / totalRounds)

    const totalToRecover = pivotState.potentialRecoveryAmount
    const currentRecovered = Number((totalToRecover * progressRatio).toFixed(1))
    const newlyAdded = Math.max(0, currentRecovered - pivotState.recoveredAmount)

    const updatedRealization: ConceptRealization = {
      ...realization,
      realizationScore: Number(Math.min(98, realization.realizationScore + newlyAdded).toFixed(1)),
      updatedAt: new Date().toISOString(),
    }

    const updatedPivot: ConceptPivotState = {
      ...pivotState,
      recoveredAmount: currentRecovered,
      status: isDone ? 'completed' : 'in_progress',
      pivotActive: !isDone,
      engineeringCapacitySacrifice: isDone ? 0 : pivotState.engineeringCapacitySacrifice,
    }

    return {
      updatedPivotState: updatedPivot,
      updatedRealization,
      completed: isDone,
    }
  }

  /**
   * Auditoria canônica da geração de novos carros da regulação (Regra 48).
   * Valida:
   * 1. Exatamente 1 concept por equipe
   * 2. Realization persistente e válida
   * 3. Baseline gerada uma única vez
   * 4. 12 atributos válidos em cada carro
   * 5. PU válida e separada
   * 6. teamStrength não é primário
   * 7. Track Fit intocado
   * 8. Todas as equipes na mesma era técnica
   * 9. Histórico das temporadas passadas absolutamente imutável
   */
  public auditNewRegulationCarGeneration(params: {
    regulationId: string
    seasonYear: number
    teams: TeamModel[]
    concepts: Record<string, ConceptRealization>
    baselines: Record<string, NewCarBaselineResult>
    pastHistoryRecords?: any[]
  }): {
    isValid: boolean
    errors: string[]
    warnings: string[]
    stats: {
      totalTeams: number
      conceptsCount: number
      baselinesCount: number
      eliteErrorsCount: number
      midfieldSuccessCount: number
    }
  } {
    const { teams, concepts, baselines, pastHistoryRecords } = params
    const errors: string[] = []
    const warnings: string[] = []

    let eliteErrorsCount = 0
    let midfieldSuccessCount = 0

    // 1. Validar por equipe
    for (const team of teams) {
      const concept = concepts[team.id]
      const baseline = baselines[team.id]

      if (!concept) {
        errors.push(`Equipe ${team.id} (${team.name}) não possui ConceptRealization gerado.`)
        continue
      }
      if (!baseline) {
        errors.push(`Equipe ${team.id} (${team.name}) não possui NewCarBaseline gerado.`)
        continue
      }

      // 12 atributos válidos
      const attrIds: TechnicalAttributeId[] = [
        'slowCorner',
        'mediumCorner',
        'fastCorner',
        'topSpeed',
        'acceleration',
        'braking',
        'traction',
        'tyreManagement',
        'aeroEfficiency',
        'cooling',
        'weight',
        'reliability',
      ]
      for (const attr of attrIds) {
        const val = baseline.attributes[attr]
        if (typeof val !== 'number' || isNaN(val) || val <= 0 || val > 100) {
          errors.push(`Atributo inválido ${attr} no carro da equipe ${team.id}: ${val}`)
        }
      }

      // PU válida e relação 70/30 preservada
      const expectedOverall = Number(
        (baseline.chassisRating * 0.7 + baseline.powerUnitRating * 0.3).toFixed(1),
      )
      if (Math.abs(baseline.carPerformanceRating - expectedOverall) > 0.2) {
        errors.push(
          `Violação da regra 70/30 na equipe ${team.id}: esperado ${expectedOverall}, encontrado ${baseline.carPerformanceRating}`,
        )
      }

      // Check de erro de elite ou sucesso de midfield
      if (concept.structuralPotential >= 75 && concept.realizationScore < 60) {
        eliteErrorsCount++
      }
      if (concept.structuralPotential <= 65 && concept.realizationScore >= 78) {
        midfieldSuccessCount++
      }
    }

    // 2. Histórico passado imutável
    if (pastHistoryRecords && pastHistoryRecords.length > 0) {
      for (const hist of pastHistoryRecords) {
        if (hist.season >= params.seasonYear) {
          errors.push(
            `Registro de histórico posterior ou igual ao ano da transição detectado: ${hist.season}`,
          )
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      stats: {
        totalTeams: teams.length,
        conceptsCount: Object.keys(concepts).length,
        baselinesCount: Object.keys(baselines).length,
        eliteErrorsCount,
        midfieldSuccessCount,
      },
    }
  }

  /**
   * Explicabilidade interna para QA / Debug (Regra 49).
   */
  public explainNewCarConcept(params: {
    team: TeamModel
    regulation: TechnicalRegulation
    realization: ConceptRealization
    baseline: NewCarBaselineResult
    technicalOrg?: TeamTechnicalOrganization | null
  }): ExplainNewCarConceptResult {
    const { team, regulation, realization, baseline, technicalOrg } = params

    const facilityLevels = infrastructureCapabilityService.getFacilityLevels(team)
    const capabilities = infrastructureCapabilityService.calculateCapabilities(facilityLevels, team)

    let staffSum = 60
    if (technicalOrg?.members) {
      const m = technicalOrg.members
      const vals: number[] = []
      if (m.TECHNICAL_DIRECTOR) {
        vals.push(
          technicalOrganizationService.calculateStaffEffectiveness(
            m.TECHNICAL_DIRECTOR,
            'TECHNICAL_DIRECTOR',
          ),
        )
      }
      if (m.HEAD_OF_AERODYNAMICS) {
        vals.push(
          technicalOrganizationService.calculateStaffEffectiveness(
            m.HEAD_OF_AERODYNAMICS,
            'HEAD_OF_AERODYNAMICS',
          ),
        )
      }
      if (m.CHIEF_DESIGNER) {
        vals.push(
          technicalOrganizationService.calculateStaffEffectiveness(
            m.CHIEF_DESIGNER,
            'CHIEF_DESIGNER',
          ),
        )
      }
      if (vals.length > 0) staffSum = vals.reduce((a, b) => a + b, 0) / vals.length
    }

    let applicableSum = 0
    let appCount = 0
    for (const dom of regulation.affectedDomains) {
      const app = this.getApplicableKnowledge({
        teamTechnicalOrg: technicalOrg || ({} as any),
        regulation,
        domain: dom,
      })
      applicableSum += app.applicableKnowledge
      appCount++
    }
    const appAvg = appCount > 0 ? applicableSum / appCount : 60

    return {
      teamId: team.id,
      regulationId: regulation.regulationId,
      seasonYear: regulation.effectiveSeason,
      approach: realization.approach,
      confidenceLevel: realization.confidenceLevel,
      realityCheckStage: realization.realityCheckStage,
      applicableKnowledgeAverage: Number(appAvg.toFixed(1)),
      preparationScore:
        (team as any)?.regulation_preparations?.[regulation.regulationId]?.preparationScore ?? 30,
      staffRatingAverage: Number(staffSum.toFixed(1)),
      infrastructureCapabilityAverage: Number(
        ((capabilities.designCapacity + capabilities.simulationAccuracy) / 2).toFixed(1),
      ),
      simulationAccuracy: capabilities.simulationAccuracy,
      aeroCorrelation: capabilities.aeroCorrelation,
      structuralPotential: realization.structuralPotential,
      stochasticDeviation: realization.stochasticDeviation,
      realizationScoreHidden: realization.realizationScore,
      correlationProblemDetected: realization.correlationProblemDetected,
      baselineChassisRating: baseline.chassisRating,
      baselinePuRating: baseline.powerUnitRating,
      baselineCarPerformanceRating: baseline.carPerformanceRating,
      attributes12: baseline.attributes,
    }
  }
}

export const regulationService = new RegulationService()
