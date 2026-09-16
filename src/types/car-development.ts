/**
 * Tipos Oficiais e Contratos Canônicos para a IMPLEMENTAÇÃO Nº 4B — P&D DO CARRO
 * F1 Manager 2026
 *
 * Ciclo de Vida:
 * NECESSIDADE TÉCNICA -> OBJETIVO -> CONCEITO -> CFD -> VALIDAÇÃO -> DESIGN FINAL -> FABRICAÇÃO -> NOVA SPEC -> PEÇA FÍSICA -> INSTALAÇÃO -> PERFORMANCE NA PISTA -> APRENDIZADO/CORRELAÇÃO
 *
 * Princípios Fundamentais:
 * 1. DINHEIRO COMPRA TENTATIVAS E RECURSOS. NÃO COMPRA RESULTADO GARANTIDO.
 * 2. INFRAESTRUTURA REDUZ INCERTEZA E AUMENTA CAPACIDADE. NÃO GARANTE ACERTO.
 * 3. UM PROJETO SÓ MUDA O CARRO QUANDO A SPEC É FABRICADA E A PEÇA FÍSICA É INSTALADA.
 * 4. O JOGADOR DEVE TOMAR DECISÕES COM INFORMAÇÃO IMPERFEITA.
 */

import {
  TechnicalAttributeId,
  TechnicalComponentId,
  TechnicalAttributesMap,
  ComponentRatingsMap,
} from './car-technical-model'

// 1. Estágios do ciclo de desenvolvimento
export type DevelopmentStage =
  | 'concept' // Concepção inicial e definição de pacotes
  | 'simulation' // Exploração via cluster CFD
  | 'validation' // Validação em Túnel de Vento / Simulador
  | 'design' // Desenho de engenharia detalhado / Homologação
  | 'approved' // Spec Aprovada - pronta para ordem de fabricação
  | 'manufacturing' // Ordem de fabricação em andamento
  | 'available' // Concluído / Disponível em estoque ou instalado

// 2. Escopo do Projeto
export type DevelopmentScope = 'conservative' | 'balanced' | 'aggressive'

// 3. Status operacional do projeto
export type DevelopmentProjectStatus =
  | 'in_progress' // Ativo no pipeline
  | 'ready_for_manufacturing' // Design concluído, aguardando ordem de fabricação
  | 'completed' // Finalizado (fabricado e catalogado)
  | 'abandoned' // Descartado / Cancelado pelo jogador ou equipe
  | 'refined' // Refinado em projeto derivado

// 4. Trade-off modelado
export interface DevelopmentProjectTradeOff {
  attributeGained: TechnicalAttributeId
  gainEstimated: number
  attributeSacrificed: TechnicalAttributeId
  lossEstimated: number
  rationale: string
}

// 5. Previsão imperfeita apresentada ao jogador (faixas e confiança)
export interface DevelopmentPrediction {
  primaryAttribute: TechnicalAttributeId
  minGain: number
  maxGain: number
  expectedGain: number // Central da estimativa
  confidencePercent: number // "O quanto acreditamos na previsão" (40% a 92%)
  potentialRisks: {
    attribute: TechnicalAttributeId
    minImpact: number
    maxImpact: number
    description: string
  }[]
  estimatedDurationRounds: number
  engineeringCapacityRequired: number // Recursos de engenharia ocupados
}

// 6. Resultado real do P&D (determinado por modelo contínuo com incerteza residual)
export type DevelopmentOutcomeTier =
  | 'exceeded_expectations' // Superou expectativa
  | 'on_target' // Dentro da previsão
  | 'below_expectations' // Abaixo do esperado
  | 'marginal_gain' // Ganho marginal
  | 'partial_failure' // Falha parcial de conceito
  | 'unpredicted_side_effect' // Efeito colateral não previsto

export interface DevelopmentActualResult {
  outcomeTier: DevelopmentOutcomeTier
  actualPrimaryGain: number // Ganho físico real em rating do componente
  actualSecondaryGains: Partial<Record<TechnicalAttributeId, number>>
  actualSideEffects: Partial<Record<TechnicalAttributeId, number>>
  correlationError: number // |Predicted - Actual|
  trackConfirmationDelta?: number // Delta pós-estreia na pista
  rationale: string
  unlockedKnowledgeBonus: number // Ganho de aprendizado/conhecimento acumulado na área
}

// 7. Entidade Canônica DevelopmentProject
export type DevelopmentProjectType = 'CURRENT_CAR_COMPONENT' | 'NEXT_REGULATION_RESEARCH'

export interface DevelopmentProject {
  id: string
  teamId: string
  seasonYear: number
  roundStarted: number
  roundCompletedTarget: number
  roundFinished?: number

  // Tipo de projeto (Fase 4B vs Fase 8C.2)
  projectType?: DevelopmentProjectType
  targetRegulationId?: string
  researchTargetDomain?: string

  // Componente e Objetivos (para current car)
  componentId: TechnicalComponentId
  primaryObjective: TechnicalAttributeId
  secondaryObjectives: TechnicalAttributeId[] // 0 a 2 secundários
  scope: DevelopmentScope // conservative, balanced, aggressive
  priority: 'normal' | 'high' | 'urgent' // Prioridade de throughput

  // Estágio e Progresso
  stage: DevelopmentStage
  progressPercent: number // 0-100%
  status: DevelopmentProjectStatus

  // Recursos e Custos
  costUsd: number // Custo total do projeto de P&D (Design + CFD + Validação)
  engineeringResourceCost: number // Pontos de capacidade de engenharia alocados (ex: 25)
  manufacturingCostPerUnitUsd: number // Custo separado por peça física fabricada

  // Estimativa vs Confiança Técnica
  prediction: DevelopmentPrediction

  // Resultado Real (revelado ao concluir a etapa de design)
  actualResult?: DevelopmentActualResult

  // Spec Resultante (quando aprovado)
  resultingSpecId?: string
  resultingSpec?: CanonicalComponentSpec

  // Telemetria detalhada de auditoria (QA / Debug / Histórico)
  auditTelemetry?: DevelopmentQATelemetry
}
// 8. Entidade Canônica de Especificação de Peça (Design/Spec A, B, C...)
export interface CanonicalComponentSpec {
  specId: string
  teamId: string
  componentId: TechnicalComponentId
  generation: number // 1 (Base), 2 (Spec B), 3 (Spec C)...
  specName: string // ex: "Floor Spec 2026-B"
  originProjectId?: string // Referência ao DevelopmentProject
  dateCreated: string
  roundIntroduced: number

  baseRating: number // Rating intrínseco deste componente (0-100)
  attributeBiases: Partial<Record<TechnicalAttributeId, number>> // Contribuições customizadas
  tradeOffsSummary: string

  manufacturingLeadTimeRounds: number // Tempo para usinar/laminar uma unidade física
  manufacturingCostUsd: number // Custo por unidade física

  // Histórico de validação na pista
  isTrackValidated: boolean
  trackConfirmationError?: number

  // Status da Spec
  status:
    | 'draft'
    | 'approved'
    | 'active_car1'
    | 'active_car2'
    | 'active_both'
    | 'superseded'
    | 'abandoned'
}

// 9. Ordem de Fabricação (Manufacturing Order)
export interface ManufacturingOrder {
  orderId: string
  teamId: string
  specId: string
  componentId: TechnicalComponentId
  quantity: number // Quantidade encomendada (1 ou 2)
  unitsCompleted: number
  costTotalUsd: number
  roundStarted: number
  roundTarget: number
  targetCarAssignment: 'car1' | 'car2' | 'stock' | 'both_split'
  status: 'in_production' | 'completed' | 'cancelled'
}

// 10. Conhecimento Técnico Acumulado por Componente / Família
export type TeamTechnicalKnowledge = Record<
  TechnicalComponentId,
  {
    experienceLevel: number // 0 a 100 (acumulado via projetos e quilometragem)
    successfulProjectsCount: number
    failedProjectsCount: number
    lastUpdatedRound: number
  }
>

// 11. Telemetria de QA Estrita (Formato obrigatório do Requisito 72)
export interface DevelopmentQATelemetry {
  projectCode: string // Ex: "PROJECT: FLOOR-2026-B"
  teamKey: string
  component: TechnicalComponentId
  goals: {
    primary: TechnicalAttributeId
    secondary: TechnicalAttributeId[]
  }
  approach: DevelopmentScope
  capabilitiesSnapshot: {
    designCapacity: number
    simulationAccuracy: number
    aeroCorrelation: number
    developmentThroughput: number
    manufacturingCapacity: number
    manufacturingQuality: number
  }
  managerModifier: {
    technicalDomainScore: number
    workshopEfficiencyBonus: number
    explanation: string
  }
  driverFeedbackContribution: {
    driver1Feedback: number
    driver2Feedback: number
    reserveFeedback?: number
    effectiveModifier: number
    explanation: string
  }
  predictedRange: {
    min: number
    max: number
    expected: number
  }
  technicalConfidencePercent: number
  actualGain: number
  correlationError: number
  imponderableFactorTriggered: boolean
  finalSpecId: string
  finalSpecRating: number
  timestamp: string
}
