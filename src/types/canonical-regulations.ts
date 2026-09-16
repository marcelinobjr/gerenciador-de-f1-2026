/**
 * Modelos e Tipos Canônicos de Regulamentos Técnicos e Knowledge Transfer (8C.1)
 * F1 Manager 2026 — Núcleo Regulatório
 *
 * REGRA DE OURO (8C.1):
 * A 8C.1 CRIA A REGRA. NÃO CRIA O CARRO FUTURO.
 * ApplicableKnowledge = ExistingKnowledge × Transferability
 * Conhecimento genérico nunca é zerado.
 */

// 1. Status canônicos da timeline regulatória
export type RegulationStatus =
  | 'PROPOSED' // Em debate / estudo; ainda pode mudar ou ser cancelada
  | 'ANNOUNCED' // Confirmada pela FIA; entra em vigor em effectiveSeason
  | 'ACTIVE' // Atualmente em vigor
  | 'SUPERSEDED' // Substituída por nova era ou regulamento posterior
  | 'CANCELLED' // Proposta descartada; não entrou em vigor

// 2. Os quatro tipos canônicos de mudança
export type RegulationType =
  | 'TECHNICAL_DIRECTIVE' // Diretiva técnica FIA: específica, alta continuidade
  | 'MINOR_REGULATION_CHANGE' // Ajuste anual de regras: impacto moderado/baixo
  | 'MAJOR_REGULATION_CHANGE' // Revisão estrutural relevante de regras
  | 'NEW_TECHNICAL_ERA' // Ruptura conceitual de era técnica (ex: 2026 ground effect / 2030)

// 3. Severidade qualitativa da mudança
export type RegulationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'

// 4. Incerteza qualitativa da mudança
export type RegulationUncertainty = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH'

// 5. Prioridade técnica qualitativa por área/domínio
export type TechnicalPriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

// 6. Nível qualitativo de Knowledge Transfer (para exibição na UI sem números brutos)
export type KnowledgeTransferTier = 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH'

// 7. Technical Domains Canônicos Centralizados (12 domínios alinhados com 7B, 4A, 4B e P&D)
export type TechnicalDomainId =
  | 'aerodynamics' // Aerodinâmica superior e asas (7B / 4B)
  | 'floorGroundEffect' // Assoalho e efeito solo (4B floor & diffuser)
  | 'chassis' // Monocoque e estrutura de impacto (7B / 4B)
  | 'vehicleDynamics' // Geometria e balanço dinâmico (7B)
  | 'suspension' // Cinemática de suspensão (4B)
  | 'cooling' // Refrigeração e packaging (4B)
  | 'mechanicalGrip' // Tração mecânica e freios (4B)
  | 'weightManagement' // Distribuição de peso e lastro
  | 'simulation' // Simulador e CFD (7B / 4A)
  | 'manufacturing' // Produção, CNC e compósitos (4A / 7B)
  | 'reliability' // Controle de qualidade e confiabilidade de sistemas
  | 'powerUnitIntegration' // Packaging e integração da Unidade de Potência

export const CANONICAL_TECHNICAL_DOMAINS: TechnicalDomainId[] = [
  'aerodynamics',
  'floorGroundEffect',
  'chassis',
  'vehicleDynamics',
  'suspension',
  'cooling',
  'mechanicalGrip',
  'weightManagement',
  'simulation',
  'manufacturing',
  'reliability',
  'powerUnitIntegration',
]

export const TECHNICAL_DOMAIN_METAS: Record<
  TechnicalDomainId,
  {
    id: TechnicalDomainId
    name: string
    shortName: string
    category: 'specific_aero' | 'chassis_mech' | 'generic_capability'
    description: string
  }
> = {
  aerodynamics: {
    id: 'aerodynamics',
    name: 'Aerodinâmica & Asas',
    shortName: 'Aero',
    category: 'specific_aero',
    description: 'Conceito e superfícies de downforce superior, fluxo frontal e asa traseira.',
  },
  floorGroundEffect: {
    id: 'floorGroundEffect',
    name: 'Assoalho & Efeito Solo',
    shortName: 'Assoalho',
    category: 'specific_aero',
    description: 'Túneis de Venturi, difusor e controle de fluxo sob o carro.',
  },
  chassis: {
    id: 'chassis',
    name: 'Chassi & Célula de Sobrevivência',
    shortName: 'Chassi',
    category: 'chassis_mech',
    description: 'Estrutura monocoque de carbono, rigidez torcional e limites de crash test.',
  },
  vehicleDynamics: {
    id: 'vehicleDynamics',
    name: 'Dinâmica Veicular & Balanço',
    shortName: 'Dinâmica',
    category: 'chassis_mech',
    description: 'Comportamento transitório, atitude da plataforma e transferência de carga.',
  },
  suspension: {
    id: 'suspension',
    name: 'Cinemática de Suspensão',
    shortName: 'Suspensão',
    category: 'chassis_mech',
    description: 'Geometria push/pull rod, controle de rolagem e altura de rodagem.',
  },
  cooling: {
    id: 'cooling',
    name: 'Arrefecimento & Packaging',
    shortName: 'Cooling',
    category: 'chassis_mech',
    description: 'Radiadores, intercoolers e dutos de arrefecimento da unidade motriz e freios.',
  },
  mechanicalGrip: {
    id: 'mechanicalGrip',
    name: 'Aderência Mecânica & Tração',
    shortName: 'Grip Mecânico',
    category: 'chassis_mech',
    description: 'Tração em baixa velocidade, diferencial e aproveitamento dos compostos.',
  },
  weightManagement: {
    id: 'weightManagement',
    name: 'Distribuição de Peso & Lastro',
    shortName: 'Peso',
    category: 'chassis_mech',
    description: 'Alocação de lastro e conformidade com o peso mínimo regulamentar.',
  },
  simulation: {
    id: 'simulation',
    name: 'Simulação & Correlação',
    shortName: 'Simulação',
    category: 'generic_capability',
    description: 'Metodologias computacionais, modelos CFD, correlação simulador-pista.',
  },
  manufacturing: {
    id: 'manufacturing',
    name: 'Manufatura & Processos',
    shortName: 'Manufatura',
    category: 'generic_capability',
    description: 'Usinagem rápida, laminação de compósitos, controle de qualidade de fábrica.',
  },
  reliability: {
    id: 'reliability',
    name: 'Confiabilidade & Métodos de Teste',
    shortName: 'Confiabilidade',
    category: 'generic_capability',
    description: 'Bancadas de prova estruturais, inspeção não-destrutiva e ciclos de fadiga.',
  },
  powerUnitIntegration: {
    id: 'powerUnitIntegration',
    name: 'Integração da PU',
    shortName: 'PU Integration',
    category: 'chassis_mech',
    description: 'Acoplamento de chassi à arquitetura do motor térmico e subsistema elétrico.',
  },
}

// 8. Perfil de Transferabilidade de Conhecimento por Domínio (0.00 a 1.00)
export type KnowledgeTransferProfile = Record<TechnicalDomainId, number>

// 9. Prioridades Técnicas por Domínio
export type TechnicalPrioritiesMap = Partial<Record<TechnicalDomainId, TechnicalPriorityLevel>>

// 10. Entidade Canônica Principal: TechnicalRegulation
export interface TechnicalRegulation {
  regulationId: string // ex: "reg_2026_baseline", "reg_2028_aero_revision"
  name: string // Nome de exibição público
  technicalEraId: string // Era à qual pertence ou inaugura (ex: "era_2026_hybrid_active_aero")
  category: RegulationType
  severity: RegulationSeverity
  status: RegulationStatus
  announcementSeason: number // Temporada de anúncio formal
  effectiveSeason: number // Temporada em que entra em vigor (ativa)
  affectedDomains: TechnicalDomainId[]
  technicalPriorities: TechnicalPrioritiesMap
  transferabilityProfile: KnowledgeTransferProfile
  uncertainty: RegulationUncertainty
  publicDescription: string
  seed?: number
  sourceEventId?: string // Chave de idempotência para anúncios/eventos
  createdAt: string
  updatedAt?: string
}

// 11. Linha do Tempo Regulatória Persistente
export interface RegulationTimelineState {
  version: number
  activeEraId: string
  activeRegulationId: string
  currentSeason: number
  regulations: TechnicalRegulation[]
  lastAuditedRound?: number
  generatedUpToSeason?: number // Controla até qual temporada futura o RegulatoryCycleGenerator já projetou
  historyLog: {
    timestamp: string
    sourceEventId: string
    eventType:
      | 'PROPOSAL_CREATED'
      | 'REGULATION_ANNOUNCED'
      | 'REGULATION_ACTIVATED'
      | 'REGULATION_CANCELLED'
      | 'REGULATION_SUPERSEDED'
      | 'TECHNICAL_DIRECTIVE_ISSUED'
    regulationId: string
    summary: string
  }[]
}

// 11.b Tiers Analíticos de Mobilidade de Grid (8C.4 — Somente analítico, nunca bônus)
export type CompetitiveGridTier =
  | 'TOP'
  | 'UPPER_MIDFIELD'
  | 'MIDFIELD'
  | 'LOWER_MIDFIELD'
  | 'BACKMARKER'

export interface TeamTierStatus {
  teamId: string
  teamName: string
  seasonYear: number
  tier: CompetitiveGridTier
  carPerformance: number
  championshipRank: number
  points: number
  previousTier?: CompetitiveGridTier
  tierChange: 'PROMOTED' | 'DEMOTED' | 'STABLE'
}

// 11.c Era History & Summary (8C.4)
export interface TechnicalEraSummary {
  eraId: string
  name: string
  startSeason: number
  endSeason?: number
  durationSeasons: number
  constructorsChampions: { season: number; teamId: string; teamName: string; count?: number }[]
  driversChampions: { season: number; driverId: string; driverName: string; teamName: string }[]
  dominantTeam?: { teamId: string; teamName: string; titlesCount: number }
  promotedTeams: string[]
  demotedTeams: string[]
  majorRegulationsCount: number
  minorRegulationsCount: number
  technicalDirectivesCount: number
}

// 12. Tipos de Eventos de Domínio
export type RegulationDomainEventType =
  | 'RegulationProposed'
  | 'RegulationAnnounced'
  | 'TechnicalDirectiveIssued'
  | 'RegulationActivated'
  | 'RegulationCancelled'
  | 'RegulationSuperseded'

export interface RegulationDomainEvent {
  eventId: string
  type: RegulationDomainEventType
  regulationId: string
  sourceSeason: number
  effectiveSeason: number
  timestamp: string
  description: string
  metadata?: Record<string, any>
}

// 13. Explicabilidade de Impacto do Regulamento (para UI / Debug sem expor números crus)
export interface DomainImpactExplanation {
  domainId: TechnicalDomainId
  domainName: string
  category: 'specific_aero' | 'chassis_mech' | 'generic_capability'
  isAffected: boolean
  impactSeverity: RegulationSeverity
  priority: TechnicalPriorityLevel
  transferabilityTier: KnowledgeTransferTier
  summaryText: string
}

export interface RegulationImpactExplanation {
  regulationId: string
  regulationName: string
  category: RegulationType
  status: RegulationStatus
  announcementSeason: number
  effectiveSeason: number
  uncertainty: RegulationUncertainty
  publicDescription: string
  domains: DomainImpactExplanation[]
  generalVerdict: string
}

// 14. Conversor canônico de valor numérico para Tier Qualitativo (Regra 25)
export function getKnowledgeTransferTier(ratio: number): KnowledgeTransferTier {
  if (ratio >= 0.85) return 'VERY_HIGH'
  if (ratio >= 0.7) return 'HIGH'
  if (ratio >= 0.5) return 'MODERATE'
  if (ratio >= 0.3) return 'LOW'
  return 'VERY_LOW'
}

export function formatKnowledgeTransferTierLabel(tier: KnowledgeTransferTier): string {
  switch (tier) {
    case 'VERY_HIGH':
      return 'Altíssima (≥85%)'
    case 'HIGH':
      return 'Alta (70–84%)'
    case 'MODERATE':
      return 'Moderada (50–69%)'
    case 'LOW':
      return 'Baixa (30–49%)'
    case 'VERY_LOW':
      return 'Muito Baixa (<30%)'
  }
}

// ==========================================
// 15. IMPLEMENTAÇÃO 8C.2 — ALLOCATION, RESEARCH & PREPARATION
// ==========================================

export type DevelopmentStrategyPreset = 'CURRENT_FOCUS' | 'BALANCED' | 'FUTURE_FOCUS' | 'CUSTOM'

export interface RegulationDevelopmentAllocation {
  teamId: string
  regulationId: string
  currentCarShare: number // 0-100%
  futureRegulationShare: number // 0-100%
  selectedStrategy: DevelopmentStrategyPreset
  effectiveRound: number
  sourceEventId?: string
  lastUpdatedRound?: number
}

export type PreparationStatus = 'MINIMAL' | 'LIMITED' | 'MODERATE' | 'STRONG' | 'EXTENSIVE'

export type ResearchTargetDomain =
  | 'AERO_CONCEPT'
  | 'FLOOR_PHILOSOPHY'
  | 'COOLING_ARCHITECTURE'
  | 'SUSPENSION_ARCHITECTURE'
  | 'WEIGHT_INTEGRATION'
  | 'SIMULATION_CORRELATION'
  | 'VEHICLE_DYNAMICS'
  | 'PU_INTEGRATION'

export interface ResearchTargetMetadata {
  id: ResearchTargetDomain
  name: string
  mappedDomain: TechnicalDomainId
  description: string
  baseCostUsd: number
  baseDurationRounds: number
  requiredFacilities: {
    facility: string
    minLevel: number
    weight: number
  }[]
  requiredStaffRole:
    | 'TECHNICAL_DIRECTOR'
    | 'HEAD_OF_AERODYNAMICS'
    | 'CHIEF_DESIGNER'
    | 'HEAD_OF_VEHICLE_PERFORMANCE'
}

export const CANONICAL_RESEARCH_TARGETS: Record<ResearchTargetDomain, ResearchTargetMetadata> = {
  AERO_CONCEPT: {
    id: 'AERO_CONCEPT',
    name: 'Conceito Aerodinâmico Superior',
    mappedDomain: 'aerodynamics',
    description:
      'Estudo fundamental de vórtices frontais, esteira de asa e direcionamento de fluxo superior para a nova era.',
    baseCostUsd: 2_400_000,
    baseDurationRounds: 4,
    requiredFacilities: [
      { facility: 'cfd', minLevel: 2, weight: 0.5 },
      { facility: 'wind_tunnel', minLevel: 2, weight: 0.5 },
    ],
    requiredStaffRole: 'HEAD_OF_AERODYNAMICS',
  },
  FLOOR_PHILOSOPHY: {
    id: 'FLOOR_PHILOSOPHY',
    name: 'Filosofia de Assoalho & Efeito Solo',
    mappedDomain: 'floorGroundEffect',
    description:
      'Exploração de túneis Venturi, alturas críticas de selagem e controle de porpoising para o novo regulamento.',
    baseCostUsd: 2_800_000,
    baseDurationRounds: 4,
    requiredFacilities: [
      { facility: 'wind_tunnel', minLevel: 2, weight: 0.6 },
      { facility: 'cfd', minLevel: 2, weight: 0.4 },
    ],
    requiredStaffRole: 'HEAD_OF_AERODYNAMICS',
  },
  COOLING_ARCHITECTURE: {
    id: 'COOLING_ARCHITECTURE',
    name: 'Arquitetura de Arrefecimento & Packaging',
    mappedDomain: 'cooling',
    description:
      'Disposição de radiadores, intercoolers e canais internos de dissipação térmica segundo o volume regulamentar.',
    baseCostUsd: 1_600_000,
    baseDurationRounds: 3,
    requiredFacilities: [
      { facility: 'design_centre', minLevel: 2, weight: 0.6 },
      { facility: 'manufacturing', minLevel: 1, weight: 0.4 },
    ],
    requiredStaffRole: 'CHIEF_DESIGNER',
  },
  SUSPENSION_ARCHITECTURE: {
    id: 'SUSPENSION_ARCHITECTURE',
    name: 'Cinemática & Geometria de Suspensão',
    mappedDomain: 'suspension',
    description:
      'Estudo de arranjos push/pull rod, controle de anti-dive/anti-squat e estabilização de atitude dinâmica.',
    baseCostUsd: 1_900_000,
    baseDurationRounds: 3,
    requiredFacilities: [
      { facility: 'design_centre', minLevel: 2, weight: 0.5 },
      { facility: 'simulator', minLevel: 2, weight: 0.5 },
    ],
    requiredStaffRole: 'CHIEF_DESIGNER',
  },
  WEIGHT_INTEGRATION: {
    id: 'WEIGHT_INTEGRATION',
    name: 'Integração Estrutural & Lastro',
    mappedDomain: 'weightManagement',
    description:
      'Otimização de lâminas de fibra de carbono do monocoque e distribuição de peso ante as metas de peso mínimo.',
    baseCostUsd: 1_500_000,
    baseDurationRounds: 3,
    requiredFacilities: [
      { facility: 'manufacturing', minLevel: 2, weight: 0.6 },
      { facility: 'design_centre', minLevel: 2, weight: 0.4 },
    ],
    requiredStaffRole: 'CHIEF_DESIGNER',
  },
  SIMULATION_CORRELATION: {
    id: 'SIMULATION_CORRELATION',
    name: 'Modelos de Simulação & Correlação',
    mappedDomain: 'simulation',
    description:
      'Calibração de algoritmos computacionais e correlação simulador-pista para prever escoamentos sem dados históricos.',
    baseCostUsd: 2_100_000,
    baseDurationRounds: 3,
    requiredFacilities: [
      { facility: 'cfd', minLevel: 2, weight: 0.4 },
      { facility: 'simulator', minLevel: 2, weight: 0.6 },
    ],
    requiredStaffRole: 'HEAD_OF_VEHICLE_PERFORMANCE',
  },
  VEHICLE_DYNAMICS: {
    id: 'VEHICLE_DYNAMICS',
    name: 'Balanço & Dinâmica Veicular',
    mappedDomain: 'vehicleDynamics',
    description:
      'Análise de sensibilidade à guinada, transferência de carga transitória e equilíbrio aeromecânico da nova geração.',
    baseCostUsd: 1_800_000,
    baseDurationRounds: 3,
    requiredFacilities: [
      { facility: 'simulator', minLevel: 2, weight: 0.6 },
      { facility: 'operations_centre', minLevel: 1, weight: 0.4 },
    ],
    requiredStaffRole: 'HEAD_OF_VEHICLE_PERFORMANCE',
  },
  PU_INTEGRATION: {
    id: 'PU_INTEGRATION',
    name: 'Integração de Monocoque & Powertrain',
    mappedDomain: 'powerUnitIntegration',
    description:
      'Acoplamento estrutural da unidade de potência, caixa de transmissão e subsistemas híbridos ao chassi de nova especificação.',
    baseCostUsd: 2_200_000,
    baseDurationRounds: 4,
    requiredFacilities: [
      { facility: 'design_centre', minLevel: 2, weight: 0.5 },
      { facility: 'factory', minLevel: 2, weight: 0.5 },
    ],
    requiredStaffRole: 'TECHNICAL_DIRECTOR',
  },
}

export interface NextRegulationResearchProject {
  id: string
  teamId: string
  regulationId: string
  targetDomain: ResearchTargetDomain
  targetName: string
  roundStarted: number
  roundCompletedTarget: number
  durationRounds: number
  progressPercent: number
  status: 'in_progress' | 'completed' | 'cancelled'
  costUsd: number
  engineeringResourceCost: number
  estimatedKnowledgeGainLabel: 'Baixo' | 'Moderado' | 'Substancial' | 'Revolucionário'
  mappedDomain: TechnicalDomainId
  actualKnowledgeGained?: number // 0-100 escala de preparação
  actualSimulationConfidenceGained?: number
  correlationBottleneckDetected?: boolean
  bottleneckExplanation?: string
  completedRound?: number
}

export interface RegulationPreparation {
  teamId: string
  regulationId: string
  researchProgress: number // 0-100
  knowledgeGain: number // know-how acumulado
  validationProgress: number // 0-100
  simulationConfidence: number // 0-100
  preparationScore: number // Score composto interno
  status: PreparationStatus
  completedProjects: string[] // IDs de projetos concluídos
  completedProjectDetails: {
    id: string
    targetDomain: ResearchTargetDomain
    completedRound: number
    knowledgeGain: number
  }[]
  lastUpdatedSeason: number
  lastUpdatedRound: number
}

export function calculatePreparationStatus(score: number): PreparationStatus {
  if (score >= 80) return 'EXTENSIVE'
  if (score >= 60) return 'STRONG'
  if (score >= 40) return 'MODERATE'
  if (score >= 20) return 'LIMITED'
  return 'MINIMAL'
}

export function formatPreparationStatusLabel(status: PreparationStatus): string {
  switch (status) {
    case 'EXTENSIVE':
      return 'EXTENSIVA (Extensive)'
    case 'STRONG':
      return 'SÓLIDA (Strong)'
    case 'MODERATE':
      return 'MODERADA (Moderate)'
    case 'LIMITED':
      return 'LIMITADA (Limited)'
    case 'MINIMAL':
      return 'MÍNIMA (Minimal)'
  }
}

// ==========================================
// 16. IMPLEMENTAÇÃO 8C.3 — CONCEPT REALIZATION, NOVO CARRO & ERRO DE PROJETO
// ==========================================

export type ConceptApproach = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE'
export type ConceptConfidenceLevel = 'LOW' | 'MODERATE' | 'HIGH'
export type FutureCarStatusStage =
  | 'CONCEPT_EXPLORATION'
  | 'VALIDATION'
  | 'ARCHITECTURE_DEFINED'
  | 'CONCEPT_LOCKED'
  | 'FINAL_PREPARATION'

export type RealityCheckStage =
  | 'PRE_SEASON'
  | 'GP1_FIRST_SIGNAL'
  | 'GP2_GP3_EVALUATION'
  | 'FULL_REVELATION'

/**
 * ConceptRealization: estado oculto por teamId + regulationId.
 * NUNCA mostrar valor numérico ao jogador (Regra 2).
 */
export interface ConceptRealization {
  teamId: string
  regulationId: string
  seed: number
  approach: ConceptApproach
  realizationScore: number // 0-100 oculto (qualidade da interpretação conceitual)
  structuralPotential: number // baseline derivado de capacidade + staff + infra
  stochasticDeviation: number // desvio controlado (approach + uncertainty)
  realizationQualityTier: 'FLAWED' | 'SUBPAR' | 'COMPETITIVE' | 'STRONG' | 'INSPIRATIONAL'
  confidenceLevel: ConceptConfidenceLevel
  perceivedRealization: number // estimativa interna da equipe antes da pista
  correlationGap: number // perceived - realizationScore (se > 12, correlação enganosa)
  correlationProblemDetected: boolean
  correlationProblemAcknowledged: boolean
  stage: FutureCarStatusStage
  realityCheckStage: RealityCheckStage
  revealedConfidenceBand: { min: number; max: number }
  createdAt: string
  updatedAt?: string
}

export interface NewCarBaselineResult {
  teamId: string
  regulationId: string
  seasonYear: number
  chassisRating: number // Derivado dos 12 atributos e pesos
  powerUnitRating: number // Adaptado da PU
  carPerformanceRating: number // 70% chassis + 30% PU
  attributes: Record<string, number> // 12 atributos canônicos
  powerUnitAdaptation: {
    supplier: string
    baselineRating: number
    reliabilityModifier: number
    integrationFactor: number // -5 a +5
  }
  conceptRealizationSummary: {
    approach: ConceptApproach
    confidenceLevel: ConceptConfidenceLevel
    realityCheckStage: RealityCheckStage
    correlationProblemDetected: boolean
  }
  generatedAt: string
}

export interface ConceptPivotState {
  teamId: string
  regulationId: string
  seasonYear: number
  pivotActive: boolean
  pivotRoundStarted?: number
  pivotTargetRoundCompleted?: number
  costUsd: number
  engineeringCapacitySacrifice: number // 0-100% de perda temporária
  sunkCostUsd: number
  potentialRecoveryAmount: number // ganho gradual de realization
  recoveredAmount: number
  pivotApproach: ConceptApproach
  status: 'idle' | 'in_progress' | 'completed'
}

export interface ExplainNewCarConceptResult {
  teamId: string
  regulationId: string
  seasonYear: number
  approach: ConceptApproach
  confidenceLevel: ConceptConfidenceLevel
  realityCheckStage: RealityCheckStage
  applicableKnowledgeAverage: number
  preparationScore: number
  staffRatingAverage: number
  infrastructureCapabilityAverage: number
  simulationAccuracy: number
  aeroCorrelation: number
  structuralPotential: number
  stochasticDeviation: number
  realizationScoreHidden: number
  correlationProblemDetected: boolean
  baselineChassisRating: number
  baselinePuRating: number
  baselineCarPerformanceRating: number
  attributes12: Record<string, number>
}
