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
} from '@/types/canonical-regulations'
import { TeamTechnicalOrganization, KnowledgeDomain } from '@/types/canonical-staff'
import { technicalOrganizationService } from '@/services/technicalOrganizationService'

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
}

export const regulationService = new RegulationService()
