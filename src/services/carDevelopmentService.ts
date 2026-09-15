/**
 * Serviço Canônico de Desenvolvimento e P&D do Carro (CarDevelopmentService)
 * F1 Manager 2026 — IMPLEMENTAÇÃO Nº 4B
 *
 * REGRAS DE OURO:
 * 1. DINHEIRO COMPRA TENTATIVAS E RECURSOS. NÃO COMPRA RESULTADO GARANTIDO.
 * 2. INFRAESTRUTURA REDUZ INCERTEZA E AUMENTA CAPACIDADE. NÃO GARANTE ACERTO.
 * 3. UM PROJETO SÓ MUDA O CARRO QUANDO A SPEC É FABRICADA E A PEÇA FÍSICA É INSTALADA.
 * 4. O JOGADOR DEVE TOMAR DECISÕES COM INFORMAÇÃO IMPERFEITA.
 */

import {
  DevelopmentProject,
  DevelopmentStage,
  DevelopmentScope,
  DevelopmentPrediction,
  DevelopmentActualResult,
  DevelopmentOutcomeTier,
  CanonicalComponentSpec,
  ManufacturingOrder,
  TeamTechnicalKnowledge,
  DevelopmentQATelemetry,
} from '@/types/car-development'
import {
  TechnicalAttributeId,
  TechnicalComponentId,
  CANONICAL_COMPONENT_METAS,
  TECHNICAL_ATTRIBUTE_METAS,
  ComponentRatingsMap,
  TechnicalAttributesMap,
} from '@/types/car-technical-model'
import { COMPONENT_INFLUENCE_MATRIX, createDefaultSpecifications } from '@/lib/car-technical-data'
import { infrastructureCapabilityService } from '@/services/infrastructureCapabilityService'
import { managerEffectService } from '@/services/managerEffectService'
import { TeamModel, DriverModel } from '@/types/f1'

// Constantes de balanceamento e economia
const BASE_PROJECT_COST_USD: Record<TechnicalComponentId, number> = {
  frontWing: 1_200_000,
  rearWing: 1_100_000,
  floor: 2_200_000,
  diffuser: 1_400_000,
  sidepods: 1_500_000,
  chassis: 2_800_000,
  suspension: 1_300_000,
  brakes: 900_000,
}

const MANUFACTURING_UNIT_COST_USD: Record<TechnicalComponentId, number> = {
  frontWing: 250_000,
  rearWing: 220_000,
  floor: 450_000,
  diffuser: 280_000,
  sidepods: 300_000,
  chassis: 750_000,
  suspension: 240_000,
  brakes: 160_000,
}

const BASE_DEVELOPMENT_ROUNDS: Record<TechnicalComponentId, number> = {
  frontWing: 3,
  rearWing: 3,
  floor: 4,
  diffuser: 3,
  sidepods: 3,
  chassis: 5,
  suspension: 3,
  brakes: 2,
}

export interface NewProjectParameters {
  team: TeamModel
  seasonYear: number
  currentRound: number
  componentId: TechnicalComponentId
  primaryObjective: TechnicalAttributeId
  secondaryObjectives?: TechnicalAttributeId[]
  scope: DevelopmentScope
  priority?: 'normal' | 'high' | 'urgent'
  drivers?: DriverModel[]
}

export class CarDevelopmentService {
  /**
   * Identifica os atributos influenciados canonicamente por um componente.
   */
  public getInfluencedAttributes(componentId: TechnicalComponentId): TechnicalAttributeId[] {
    const row = COMPONENT_INFLUENCE_MATRIX[componentId]
    if (!row) return []
    return (Object.keys(row) as TechnicalAttributeId[]).filter((attr) => (row[attr] ?? 0) > 0.05)
  }

  /**
   * Conhecimento acumulado da equipe por componente (inicialização segura/aditiva).
   */
  public getOrCreateTechnicalKnowledge(team: TeamModel): TeamTechnicalKnowledge {
    const existing = team.technical_knowledge || ({} as TeamTechnicalKnowledge)
    const result: TeamTechnicalKnowledge = { ...existing }
    const allComponents: TechnicalComponentId[] = [
      'frontWing',
      'rearWing',
      'floor',
      'diffuser',
      'sidepods',
      'chassis',
      'suspension',
      'brakes',
    ]

    for (const comp of allComponents) {
      if (!result[comp]) {
        result[comp] = {
          experienceLevel: 30, // Base inicial neutra
          successfulProjectsCount: 0,
          failedProjectsCount: 0,
          lastUpdatedRound: 0,
        }
      }
    }
    return result
  }

  /**
   * Verifica a capacidade de engenharia da equipe:
   * Consome capabilities (designCapacity, developmentThroughput)
   */
  public getEngineeringCapacityStatus(team: TeamModel): {
    totalCapacityPoints: number
    occupiedCapacityPoints: number
    availableCapacityPoints: number
    maxConcurrentProjects: number
    activeProjectsCount: number
    canStartNewProject: boolean
    explanation: string
  } {
    const capabilities = infrastructureCapabilityService.calculateCapabilities(team)
    // Throughput determina slots simultâneos: 1 a 3 projetos recomendados
    const maxConcurrentProjects = Math.max(
      1,
      Math.min(4, Math.round(capabilities.developmentThroughput / 25)),
    )
    // Total de pontos de capacidade (ex: 100 base)
    const totalCapacityPoints = Math.round(capabilities.designCapacity * 1.5)

    const activeProjects = (team.development_projects || []).filter(
      (p) => p.status === 'in_progress',
    )
    const occupiedCapacityPoints = activeProjects.reduce(
      (acc, p) => acc + (p.engineeringResourceCost || 25),
      0,
    )
    const availableCapacityPoints = Math.max(0, totalCapacityPoints - occupiedCapacityPoints)

    const canStartNewProject =
      activeProjects.length < maxConcurrentProjects && availableCapacityPoints >= 20

    let explanation = `Slots: ${activeProjects.length}/${maxConcurrentProjects} ativos. `
    if (activeProjects.length >= maxConcurrentProjects) {
      explanation += `Capacidade de projetos simultâneos atingida pelo Centro de Design/Fábrica.`
    } else if (availableCapacityPoints < 20) {
      explanation += `Recursos de engenharia esgotados por projetos concorrentes.`
    } else {
      explanation += `Capacidade livre para novos conceitos técnicos.`
    }

    return {
      totalCapacityPoints,
      occupiedCapacityPoints,
      availableCapacityPoints,
      maxConcurrentProjects,
      activeProjectsCount: activeProjects.length,
      canStartNewProject,
      explanation,
    }
  }

  /**
   * Gera a Previsão Técnica Imperfeita para o jogador.
   * REGRAS:
   * - Menor a correlação/avaliação -> MAIOR a faixa de incerteza (informação imperfeita).
   * - Confiança Técnica é "o quanto acreditamos na previsão", NÃO "% de chance de funcionar".
   * - Pilotos e Manager reduzem incerteza residual.
   */
  public calculateProjectPrediction(params: {
    team: TeamModel
    componentId: TechnicalComponentId
    primaryObjective: TechnicalAttributeId
    secondaryObjectives?: TechnicalAttributeId[]
    scope: DevelopmentScope
    priority?: 'normal' | 'high' | 'urgent'
    drivers?: DriverModel[]
  }): DevelopmentPrediction {
    const { team, componentId, primaryObjective, secondaryObjectives = [], scope } = params
    const capabilities = infrastructureCapabilityService.calculateCapabilities(team)
    const managerEval = managerEffectService.evaluateManager(team)

    // Avaliação de feedback dos pilotos
    const titulars = (params.drivers || []).filter((d) => d.role === 'titular')
    const avgDriverFeedback =
      titulars.length > 0
        ? titulars.reduce((sum, d) => sum + (d.technical_feedback || 70), 0) / titulars.length
        : 70

    // Ganho base potencial de acordo com o escopo
    let basePotentialGain = 3.0
    if (scope === 'conservative') basePotentialGain = 1.8
    if (scope === 'aggressive') basePotentialGain = 4.8

    // Penalidade por dispersão de foco (1 obj: 100%, 2 objs: 75% cada, 3 objs: 60% cada)
    const totalGoals = 1 + secondaryObjectives.length
    const dispersionFactor = totalGoals === 1 ? 1.0 : totalGoals === 2 ? 0.78 : 0.62
    const targetGain = basePotentialGain * dispersionFactor

    // Influência da Matriz Física Componente x Atributo
    const influenceRow = COMPONENT_INFLUENCE_MATRIX[componentId] || {}
    const physWeight = influenceRow[primaryObjective] ?? 0.3
    const normalizedTarget = Number((targetGain * (0.6 + physWeight * 0.8)).toFixed(2))

    // Incerteza e Largura da Faixa:
    // Alta precisão CFD + alta correlação túnel -> FAIXA ESTREITA
    // Baixa infraestrutura -> FAIXA LARGA
    const aeroCorr = capabilities.aeroCorrelation // 30 a 95
    const simAcc = capabilities.simulationAccuracy // 30 a 95
    const uncertaintyFactor = Math.max(0.18, 1.25 - (aeroCorr * 0.5 + simAcc * 0.5) / 100)

    const halfBand = Math.max(0.4, Number((normalizedTarget * uncertaintyFactor).toFixed(2)))
    const minGain = Math.max(0.2, Number((normalizedTarget - halfBand).toFixed(2)))
    const maxGain = Number((normalizedTarget + halfBand).toFixed(2))

    // Confiança Técnica: 40% a 92% (nunca 100%)
    const managerBonus = managerEval.modifiers.workshopEfficiencyBonus * 50 // -2 a +3
    const driverBonus = (avgDriverFeedback - 70) * 0.15 // ex: feedback 85 -> +2.25%
    const rawConfidence =
      42 +
      (aeroCorr * 0.28 + simAcc * 0.22) +
      managerBonus +
      driverBonus +
      (scope === 'conservative' ? 6 : scope === 'aggressive' ? -8 : 0)

    const confidencePercent = Math.max(38, Math.min(92, Math.round(rawConfidence)))

    // Riscos e Trade-offs possíveis
    const potentialRisks: DevelopmentPrediction['potentialRisks'] = []
    if (scope === 'aggressive' || scope === 'balanced') {
      if (['frontWing', 'rearWing', 'floor', 'sidepods'].includes(componentId)) {
        potentialRisks.push({
          attribute: 'cooling',
          minImpact: -0.2,
          maxImpact: scope === 'aggressive' ? -1.4 : -0.7,
          description:
            'Aumento de carga aerodinâmica pode restringir fluxo interno de refrigeração.',
        })
      }
      if (componentId === 'rearWing' || componentId === 'frontWing') {
        potentialRisks.push({
          attribute: 'topSpeed',
          minImpact: -0.1,
          maxImpact: scope === 'aggressive' ? -1.2 : -0.5,
          description: 'Arrasto induzido adicional pode penalizar velocidade final.',
        })
      }
      if (componentId === 'chassis' || componentId === 'suspension') {
        potentialRisks.push({
          attribute: 'reliability',
          minImpact: -0.3,
          maxImpact: scope === 'aggressive' ? -1.6 : -0.6,
          description: 'Alívio extremo de peso estrutural pode introduzir microfissuras e fadiga.',
        })
      }
    }

    // Prazo estimado em rodadas
    let rounds = BASE_DEVELOPMENT_ROUNDS[componentId] || 3
    if (scope === 'aggressive') rounds += 1
    if (params.priority === 'urgent') rounds = Math.max(1, rounds - 1)
    if (capabilities.developmentThroughput < 40) rounds += 1

    return {
      primaryAttribute: primaryObjective,
      minGain,
      maxGain,
      expectedGain: normalizedTarget,
      confidencePercent,
      potentialRisks,
      estimatedDurationRounds: rounds,
      engineeringCapacityRequired: params.priority === 'urgent' ? 35 : 25,
    }
  }

  /**
   * Cria um novo DevelopmentProject no pipeline
   */
  public createProject(params: NewProjectParameters): DevelopmentProject {
    const {
      team,
      seasonYear,
      currentRound,
      componentId,
      primaryObjective,
      secondaryObjectives = [],
      scope,
      priority = 'normal',
      drivers = [],
    } = params

    const prediction = this.calculateProjectPrediction({
      team,
      componentId,
      primaryObjective,
      secondaryObjectives,
      scope,
      priority,
      drivers,
    })

    let cost = BASE_PROJECT_COST_USD[componentId] || 1_500_000
    if (scope === 'conservative') cost *= 0.75
    if (scope === 'aggressive') cost *= 1.45
    if (priority === 'urgent') cost *= 1.4
    if (priority === 'high') cost *= 1.15

    const mfgCost = MANUFACTURING_UNIT_COST_USD[componentId] || 250_000

    const projectId = `proj_${componentId}_${seasonYear}_r${currentRound}_${Date.now().toString(36)}`

    const project: DevelopmentProject = {
      id: projectId,
      teamId: team.id,
      seasonYear,
      roundStarted: currentRound,
      roundCompletedTarget: currentRound + prediction.estimatedDurationRounds,
      componentId,
      primaryObjective,
      secondaryObjectives,
      scope,
      priority,
      stage: 'concept',
      progressPercent: 0,
      status: 'in_progress',
      costUsd: Math.round(cost),
      engineeringResourceCost: prediction.engineeringCapacityRequired,
      manufacturingCostPerUnitUsd: mfgCost,
      prediction,
    }

    return project
  }

  /**
   * Resolve o resultado real contínuo do projeto no momento da conclusão do Design.
   * REGRAS FUNDAMENTAIS:
   * - NÃO usar Math.random() puro;
   * - Distribuição contínua com incerteza residual (imponderável);
   * - Infraestrutura excelente melhora a precisão da entrega, mas JAMAIS elimina o risco.
   */
  public computeActualResult(
    project: DevelopmentProject,
    team: TeamModel,
    drivers: DriverModel[] = [],
  ): { actualResult: DevelopmentActualResult; telemetry: DevelopmentQATelemetry } {
    const capabilities = infrastructureCapabilityService.calculateCapabilities(team)
    const managerEval = managerEffectService.evaluateManager(team)
    const knowledge = this.getOrCreateTechnicalKnowledge(team)
    const compKnowledge = knowledge[project.componentId] || { experienceLevel: 30 }

    // Avaliação de pilotos
    const titulars = drivers.filter((d) => d.role === 'titular')
    const reserves = drivers.filter((d) => d.role === 'reserva')
    const d1Feedback = titulars[0]?.technical_feedback ?? 70
    const d2Feedback = titulars[1]?.technical_feedback ?? 70
    const reserveFeedback = reserves[0]?.technical_feedback ?? 65
    const driverAvgFeedback = (d1Feedback + d2Feedback) / 2

    // Modificador do Manager (técnico)
    const managerTechScore = managerEval.domainScores.technicalManagement
    const managerMod = managerEval.modifiers.workshopEfficiencyBonus // ex: +0.03

    // Qualidade de correlação e validação:
    // aeroCorrelation (30-95), simulationAccuracy (30-95)
    const correlationScore = capabilities.aeroCorrelation
    const simAccuracy = capabilities.simulationAccuracy

    // Pseudo-random com seed controlada (determinismo por projeto + seed caótica)
    // Usamos múltiplos fatores físicos para modelar a dispersão contínua
    const scopeRisk =
      project.scope === 'aggressive' ? 1.4 : project.scope === 'conservative' ? 0.6 : 1.0

    // Componente imponderável: mesmo com infra 5 (score ~90), existe variabilidade residual (mínimo 10%)
    const residualVariance = Math.max(
      0.12,
      (100 - (correlationScore * 0.6 + simAccuracy * 0.4)) / 100,
    )

    // Ruído contínuo gaussiano simplificado usando somatório de ruídos
    // Box-Muller simples para distribuição contínua normal
    const u1 = Math.max(0.0001, Math.random())
    const u2 = Math.random()
    const normalNoise = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)

    // Desvio do ganho real relativo ao esperado
    const varianceDelta = normalNoise * residualVariance * scopeRisk * 0.85

    // Bônus sutil de experiência e equipe
    const knowledgeBonus = (compKnowledge.experienceLevel - 40) * 0.006 // -0.06 a +0.18
    const driverMod = (driverAvgFeedback - 70) * 0.008 // ex: feedback 90 -> +0.16

    // Fator multiplicador de entrega sobre o target previsto
    let deliveryFactor = 1.0 + varianceDelta + knowledgeBonus + driverMod + managerMod

    // Evento imponderável (ex: túnel enganou a equipe ou conceito encontrou ganho súbito)
    let imponderableTriggered = false
    const chaosRoll = Math.random()
    if (chaosRoll < 0.05) {
      // 5% de chance de tropeço aerodinâmico imponderável mesmo com equipe de ponta
      deliveryFactor *= 0.68
      imponderableTriggered = true
    } else if (chaosRoll > 0.96) {
      // 4% de chance de "eureka" aerodinâmica
      deliveryFactor *= 1.25
      imponderableTriggered = true
    }

    // Ganho real do objetivo primário
    const rawActualPrimary = project.prediction.expectedGain * deliveryFactor
    const actualPrimaryGain = Math.max(0.15, Number(rawActualPrimary.toFixed(2)))

    // Erro de correlação: diferença entre o meio da faixa prevista e o que a pista realmente recebeu
    const correlationError = Number(
      Math.abs(project.prediction.expectedGain - actualPrimaryGain).toFixed(2),
    )

    // Classificação da entrega
    let outcomeTier: DevelopmentOutcomeTier = 'on_target'
    const ratio = actualPrimaryGain / project.prediction.expectedGain

    if (ratio >= 1.18) {
      outcomeTier = 'exceeded_expectations'
    } else if (ratio >= 0.88) {
      outcomeTier = 'on_target'
    } else if (ratio >= 0.65) {
      outcomeTier = 'below_expectations'
    } else if (ratio >= 0.35) {
      outcomeTier = 'marginal_gain'
    } else {
      outcomeTier = 'partial_failure'
    }

    // Ganhos secundários (se houver)
    const actualSecondaryGains: Partial<Record<TechnicalAttributeId, number>> = {}
    for (const sec of project.secondaryObjectives) {
      const secExpected = project.prediction.expectedGain * 0.45
      const secActual = Number(
        (secExpected * (0.8 + Math.random() * 0.35) * deliveryFactor).toFixed(2),
      )
      actualSecondaryGains[sec] = Math.max(0.05, secActual)
    }

    // Trade-offs e efeitos colaterais reais
    const actualSideEffects: Partial<Record<TechnicalAttributeId, number>> = {}
    if (project.prediction.potentialRisks.length > 0) {
      for (const risk of project.prediction.potentialRisks) {
        // Correlação alta ajuda a mitigar o risco, mas não anula
        const riskTriggeredRoll = Math.random()
        const riskThreshold = project.scope === 'aggressive' ? 0.65 : 0.45
        if (riskTriggeredRoll < riskThreshold) {
          const impact = Number(
            (
              risk.minImpact +
              (risk.maxImpact - risk.minImpact) * (0.3 + Math.random() * 0.7)
            ).toFixed(2),
          )
          actualSideEffects[risk.attribute] = impact
          if (impact < -0.8 && outcomeTier !== 'partial_failure') {
            outcomeTier = 'unpredicted_side_effect'
          }
        }
      }
    }

    // Rationale em pt-BR
    let rationale = ''
    switch (outcomeTier) {
      case 'exceeded_expectations':
        rationale = `Conceito excepcional! A correlação entre o túnel de vento e o cluster CFD superou as estimativas de fluxo.`
        break
      case 'on_target':
        rationale = `Desenvolvimento dentro dos parâmetros planejados de correlação aerodinâmica e dados virtuais.`
        break
      case 'below_expectations':
        rationale = `Ganho inferior ao projetado. Pequenas divergências de escoamento limitaram a eficiência final.`
        break
      case 'marginal_gain':
        rationale = `Retorno marginal de desempenho. O pacote trouxe ganhos discretos face ao esforço de engenharia.`
        break
      case 'partial_failure':
        rationale = `Falha de conceito aerodinâmico. O componente sofreu de esteira turbulenta não prevista na modelagem.`
        break
      case 'unpredicted_side_effect':
        rationale = `Desempenho entregue, porém com penalidade térmica/estrutural acima do teto de projeto.`
        break
    }

    const actualResult: DevelopmentActualResult = {
      outcomeTier,
      actualPrimaryGain,
      actualSecondaryGains,
      actualSideEffects,
      correlationError,
      rationale,
      unlockedKnowledgeBonus: actualPrimaryGain > 1.5 ? 4 : 2,
    }

    // Geração de ID da Spec resultante
    const specGen =
      (team.component_specs || []).filter((s) => s.componentId === project.componentId).length + 1
    const letter = String.fromCharCode(64 + Math.min(26, specGen)) // A, B, C, D...
    const finalSpecId = `spec_${project.componentId}_gen${specGen}`

    // Telemetria oficial para Requisito 72
    const telemetry: DevelopmentQATelemetry = {
      projectCode: `PROJECT: ${project.componentId.toUpperCase()}-2026-${letter}`,
      teamKey: team.team_key || team.name,
      component: project.componentId,
      goals: {
        primary: project.primaryObjective,
        secondary: project.secondaryObjectives,
      },
      approach: project.scope,
      capabilitiesSnapshot: {
        designCapacity: capabilities.designCapacity,
        simulationAccuracy: capabilities.simulationAccuracy,
        aeroCorrelation: capabilities.aeroCorrelation,
        developmentThroughput: capabilities.developmentThroughput,
        manufacturingCapacity: capabilities.manufacturingCapacity,
        manufacturingQuality: capabilities.manufacturingQuality,
      },
      managerModifier: {
        technicalDomainScore: managerTechScore,
        workshopEfficiencyBonus: managerMod,
        explanation:
          managerEval.telemetryLogs.find((l) => l.domain === 'technicalManagement')?.explanation ||
          '',
      },
      driverFeedbackContribution: {
        driver1Feedback: d1Feedback,
        driver2Feedback: d2Feedback,
        reserveFeedback,
        effectiveModifier: Number(driverMod.toFixed(3)),
        explanation: `Pilotos titulares com feedback médio de ${driverAvgFeedback.toFixed(0)} contribuíram na validação.`,
      },
      predictedRange: {
        min: project.prediction.minGain,
        max: project.prediction.maxGain,
        expected: project.prediction.expectedGain,
      },
      technicalConfidencePercent: project.prediction.confidencePercent,
      actualGain: actualPrimaryGain,
      correlationError,
      imponderableFactorTriggered: imponderableTriggered,
      finalSpecId,
      finalSpecRating: 0, // Será preenchido ao gerar a Spec
      timestamp: new Date().toISOString(),
    }

    return { actualResult, telemetry }
  }

  /**
   * Converte um projeto em estágio 'approved' na entidade CanonicalComponentSpec
   */
  public generateApprovedSpec(
    project: DevelopmentProject,
    actualResult: DevelopmentActualResult,
    team: TeamModel,
  ): CanonicalComponentSpec {
    const existingSpecs = (team.component_specs || []).filter(
      (s) => s.componentId === project.componentId,
    )
    const gen = existingSpecs.length + 1
    const letter = String.fromCharCode(64 + Math.min(26, gen)) // A, B, C...

    // Rating base herdado da spec anterior ou base do carro
    const previousSpec = existingSpecs[existingSpecs.length - 1]
    const baseRating = previousSpec ? previousSpec.baseRating : 70
    const newRating = Math.min(99, Number((baseRating + actualResult.actualPrimaryGain).toFixed(1)))

    const attributeBiases: Partial<Record<TechnicalAttributeId, number>> = {
      ...(previousSpec?.attributeBiases || {}),
      [project.primaryObjective]: Number(
        (
          (previousSpec?.attributeBiases?.[project.primaryObjective] || 0) +
          actualResult.actualPrimaryGain
        ).toFixed(2),
      ),
    }

    // Aplica secundários
    for (const [attr, gain] of Object.entries(actualResult.actualSecondaryGains)) {
      const a = attr as TechnicalAttributeId
      attributeBiases[a] = Number(((attributeBiases[a] || 0) + (gain || 0)).toFixed(2))
    }

    // Aplica side effects
    for (const [attr, loss] of Object.entries(actualResult.actualSideEffects)) {
      const a = attr as TechnicalAttributeId
      attributeBiases[a] = Number(((attributeBiases[a] || 0) + (loss || 0)).toFixed(2))
    }

    const compMeta = CANONICAL_COMPONENT_METAS[project.componentId]
    const specName = `${compMeta?.name || project.componentId} Spec 2026-${letter}`

    const spec: CanonicalComponentSpec = {
      specId: `spec_${project.componentId}_gen${gen}_${Date.now().toString(36)}`,
      teamId: team.id,
      componentId: project.componentId,
      generation: gen,
      specName,
      originProjectId: project.id,
      dateCreated: new Date().toISOString(),
      roundIntroduced: project.roundCompletedTarget,
      baseRating: newRating,
      attributeBiases,
      tradeOffsSummary:
        Object.entries(actualResult.actualSideEffects)
          .map(
            ([k, v]) => `${TECHNICAL_ATTRIBUTE_METAS[k as TechnicalAttributeId]?.name || k}: ${v}`,
          )
          .join(', ') || 'Nenhum efeito colateral crítico detectado.',
      manufacturingLeadTimeRounds: 1, // 1 rodada de usinagem/cura de compósitos
      manufacturingCostUsd: project.manufacturingCostPerUnitUsd,
      isTrackValidated: false,
      status: 'approved',
    }

    return spec
  }

  /**
   * Cria uma Ordem de Fabricação (Manufacturing Order) para a Spec aprovada
   */
  public createManufacturingOrder(params: {
    team: TeamModel
    spec: CanonicalComponentSpec
    quantity: number // 1 ou 2 unidades
    currentRound: number
    targetCarAssignment: 'car1' | 'car2' | 'stock' | 'both_split'
  }): ManufacturingOrder {
    const { team, spec, quantity, currentRound, targetCarAssignment } = params
    const capabilities = infrastructureCapabilityService.calculateCapabilities(team)

    // Prazo de manufatura depende da capacidade de fabricação
    let leadTime = spec.manufacturingLeadTimeRounds
    if (capabilities.manufacturingCapacity < 45 && quantity > 1) {
      leadTime += 1
    }

    const order: ManufacturingOrder = {
      orderId: `mfg_${spec.specId}_${Date.now().toString(36)}`,
      teamId: team.id,
      specId: spec.specId,
      componentId: spec.componentId,
      quantity,
      unitsCompleted: 0,
      costTotalUsd: spec.manufacturingCostUsd * quantity,
      roundStarted: currentRound,
      roundTarget: currentRound + leadTime,
      targetCarAssignment,
      status: 'in_production',
    }

    return order
  }

  /**
   * Avança o ciclo de vida dos projetos de P&D e das Ordens de Fabricação na virada de rodada.
   * Concept -> Simulation -> Validation -> Design -> Approved -> Manufacturing -> Available
   */
  public advanceDevelopmentOnRound(
    team: TeamModel,
    newRound: number,
    drivers: DriverModel[] = [],
  ): {
    updatedProjects: DevelopmentProject[]
    updatedSpecs: CanonicalComponentSpec[]
    updatedOrders: ManufacturingOrder[]
    updatedKnowledge: TeamTechnicalKnowledge
    completedProjects: DevelopmentProject[]
    completedOrders: ManufacturingOrder[]
    notifications: { title: string; message: string; type: 'desenvolvimento' }[]
  } {
    const projects = [...(team.development_projects || [])]
    const specs = [...(team.component_specs || [])]
    const orders = [...(team.manufacturing_orders || [])]
    const knowledge = this.getOrCreateTechnicalKnowledge(team)
    const notifications: { title: string; message: string; type: 'desenvolvimento' }[] = []
    const completedProjects: DevelopmentProject[] = []
    const completedOrders: ManufacturingOrder[] = []

    // 1. Processa Projetos de Desenvolvimento
    for (let i = 0; i < projects.length; i++) {
      const proj = projects[i]
      if (proj.status !== 'in_progress') continue

      const totalRounds = Math.max(1, proj.roundCompletedTarget - proj.roundStarted)
      const roundsElapsed = newRound - proj.roundStarted
      const progress = Math.min(100, Math.round((roundsElapsed / totalRounds) * 100))
      proj.progressPercent = progress

      // Atualiza estágio conforme progresso
      if (progress < 25) {
        proj.stage = 'concept'
      } else if (progress < 55) {
        proj.stage = 'simulation'
      } else if (progress < 85) {
        proj.stage = 'validation'
      } else if (progress < 100) {
        proj.stage = 'design'
      } else {
        // Projeto concluído! Design final aprovado
        proj.stage = 'approved'
        proj.status = 'ready_for_manufacturing'
        proj.roundFinished = newRound

        // Calcula resultado real
        const { actualResult, telemetry } = this.computeActualResult(proj, team, drivers)
        proj.actualResult = actualResult

        // Gera nova Spec
        const newSpec = this.generateApprovedSpec(proj, actualResult, team)
        proj.resultingSpecId = newSpec.specId
        proj.resultingSpec = newSpec
        telemetry.finalSpecRating = newSpec.baseRating
        proj.auditTelemetry = telemetry

        specs.push(newSpec)
        completedProjects.push(proj)

        // Atualiza conhecimento da equipe
        if (knowledge[proj.componentId]) {
          knowledge[proj.componentId].experienceLevel = Math.min(
            99,
            knowledge[proj.componentId].experienceLevel + actualResult.unlockedKnowledgeBonus,
          )
          if (actualResult.outcomeTier !== 'partial_failure') {
            knowledge[proj.componentId].successfulProjectsCount += 1
          } else {
            knowledge[proj.componentId].failedProjectsCount += 1
          }
          knowledge[proj.componentId].lastUpdatedRound = newRound
        }

        notifications.push({
          title: `Projeto Concluído: ${newSpec.specName}`,
          message: `O desenvolvimento de ${CANONICAL_COMPONENT_METAS[proj.componentId]?.name} foi finalizado. Resultado: ${actualResult.rationale} Spec pronta para ordem de fabricação.`,
          type: 'desenvolvimento',
        })
      }
    }

    // 2. Processa Ordens de Fabricação
    for (let i = 0; i < orders.length; i++) {
      const ord = orders[i]
      if (ord.status !== 'in_production') continue

      if (newRound >= ord.roundTarget) {
        ord.status = 'completed'
        ord.unitsCompleted = ord.quantity
        completedOrders.push(ord)

        const relatedSpec = specs.find((s) => s.specId === ord.specId)
        const compName = CANONICAL_COMPONENT_METAS[ord.componentId]?.name || ord.componentId

        notifications.push({
          title: `Manufatura Concluída: ${relatedSpec?.specName || compName}`,
          message: `${ord.quantity} unidade(s) física(s) foram usinadas e inspecionadas pela fábrica. Peça(s) disponíveis para instalação no carro.`,
          type: 'desenvolvimento',
        })
      }
    }

    return {
      updatedProjects: projects,
      updatedSpecs: specs,
      updatedOrders: orders,
      updatedKnowledge: knowledge,
      completedProjects,
      completedOrders,
      notifications,
    }
  }

  /**
   * Instalação física no carro:
   * DOIS CARROS PODEM RECEBER ANTES UM QUE O OUTRO.
   * Cria ou atualiza as peças físicas na coleção `parts` com a spec correspondente.
   */
  public generatePartsFromSpecInstall(params: {
    teamId: string
    spec: CanonicalComponentSpec
    targetCar: 'car1' | 'car2' | 'both'
    existingParts: any[] // partes físicas do time
  }): any[] {
    const { teamId, spec, targetCar, existingParts } = params
    const updatedParts = [...existingParts]

    const targetCars = targetCar === 'both' ? ['car1', 'car2'] : [targetCar]

    for (const car of targetCars) {
      // Localiza a peça física atual instalada no carro
      const existingPartIndex = updatedParts.findIndex(
        (p) =>
          (p.component_id === spec.componentId ||
            p.name?.toLowerCase().includes(spec.componentId.toLowerCase())) &&
          p.car_assignment === car,
      )

      if (existingPartIndex >= 0) {
        // Atualiza a peça física instalada para apontar para a nova Spec
        updatedParts[existingPartIndex] = {
          ...updatedParts[existingPartIndex],
          spec_id: spec.specId,
          spec_generation: spec.generation,
          level: Math.round(spec.baseRating / 10), // Adaptação para campo legado level (0-10)
          condition: 100, // Peça física nova instalada
          mileage_km: 0,
        }
      } else {
        // Cria nova peça física caso não exista
        updatedParts.push({
          id: `part_${spec.componentId}_${car}_${Date.now().toString(36)}`,
          team_id: teamId,
          name: spec.specName,
          component_id: spec.componentId,
          car_assignment: car,
          spec_id: spec.specId,
          spec_generation: spec.generation,
          level: Math.round(spec.baseRating / 10),
          condition: 100,
          mileage_km: 0,
        })
      }
    }

    return updatedParts
  }

  /**
   * Inteligência Artificial de P&D para Equipes Rivais:
   * - Identifica fraquezas do carro via modelo técnico real;
   * - Orçamento, position, capabilities e tempo restante;
   * - Não omnisciente (pode errar, priorizar errado);
   * - Proibido hardcode "Ferrari develops floor".
   */
  public runAiTeamDevelopmentDecision(params: {
    team: TeamModel
    seasonYear: number
    currentRound: number
    totalRounds: number
    drivers?: DriverModel[]
    currentAttributes: TechnicalAttributesMap
  }): DevelopmentProject | null {
    const { team, seasonYear, currentRound, totalRounds, currentAttributes } = params

    // Se já tiver projeto ativo, respeita o throughput
    const activeProjects = (team.development_projects || []).filter(
      (p) => p.status === 'in_progress',
    )
    if (activeProjects.length >= 1) {
      return null // IA mantém no máximo 1 projeto simultâneo por vez nesta fase
    }

    // Se a temporada estiver quase no fim (últimas 3 corridas), IA economiza para próximo ano
    if (currentRound > totalRounds - 3) {
      return null
    }

    // Orçamento disponível (respeitando cost cap)
    const budget = team.budget || 20_000_000
    if (budget < 3_000_000) {
      return null // Sem caixa para desenvolvimento
    }

    // Identifica atributos mais fracos do carro real
    const sortedWeaknesses = (Object.keys(currentAttributes) as TechnicalAttributeId[]).sort(
      (a, b) => (currentAttributes[a] ?? 70) - (currentAttributes[b] ?? 70),
    )
    const primaryWeakness = sortedWeaknesses[0] || 'aeroEfficiency'

    // Escolhe o componente com maior influência sobre essa fraqueza
    const allComponents: TechnicalComponentId[] = [
      'frontWing',
      'rearWing',
      'floor',
      'diffuser',
      'sidepods',
      'chassis',
      'suspension',
      'brakes',
    ]

    const bestComponent = allComponents.reduce((best, comp) => {
      const weight = COMPONENT_INFLUENCE_MATRIX[comp]?.[primaryWeakness] ?? 0
      const bestWeight = COMPONENT_INFLUENCE_MATRIX[best]?.[primaryWeakness] ?? 0
      return weight > bestWeight ? comp : best
    }, allComponents[0])

    // Escopo da IA baseado na posição e apetite a risco
    const scopeRoll = Math.random()
    const scope: DevelopmentScope =
      scopeRoll < 0.25 ? 'conservative' : scopeRoll < 0.75 ? 'balanced' : 'aggressive'

    return this.createProject({
      team,
      seasonYear,
      currentRound,
      componentId: bestComponent,
      primaryObjective: primaryWeakness,
      scope,
      priority: 'normal',
      drivers: params.drivers,
    })
  }
}

export const carDevelopmentService = new CarDevelopmentService()
