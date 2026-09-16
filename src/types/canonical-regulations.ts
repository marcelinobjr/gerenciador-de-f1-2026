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
