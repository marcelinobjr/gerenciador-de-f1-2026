/**
 * InfrastructureCapabilityService — Serviço Central de Infraestrutura Técnica e Organizacional
 * F1 Manager 2026 — Implementação Nº 4A
 *
 * Princípios Fundamentais:
 * 1. INFRAESTRUTURA ≠ PERFORMANCE DIRETA.
 *    Infraestrutura NUNCA altera diretamente carPerformanceRating, trackFit, tempos de volta brutos
 *    ou adiciona atributos mágicos aos pilotos existentes.
 * 2. Fluxo Obrigatório: FACILITY -> CAPABILITY -> GAME SYSTEM.
 * 3. Diminishing Returns: 1->2 produz ganho relativo maior que 4->5.
 * 4. Sinergias & Gargalos: O elo mais fraco limita as capabilities derivadas.
 * 5. Manager Integration: Consome EXCLUSIVAMENTE o ManagerEffectService canônico,
 *    respeitando os caps regulamentares (+8% / -5%) e sem duplicar bônus.
 */

import { TeamModel } from '@/types/f1'
import {
  CanonicalFacilityId,
  FacilityLevels,
  TechnicalCapabilities,
  InfrastructureBottleneck,
  InfrastructureSynergy,
  InfrastructureAuditResult,
} from '@/types/canonical-facilities'
import { CANONICAL_FACILITIES_DEFINITIONS } from '@/types/canonical-facilities-data'
import { managerEffectService } from './managerEffectService'
import { technicalOrganizationService } from './technicalOrganizationService'
import { TeamTechnicalOrganization } from '@/types/canonical-staff'

export class InfrastructureCapabilityService {
  /**
   * Extrai e sanitiza os níveis das 9 instalações de uma equipe com fallback seguro.
   */
  public getFacilityLevels(team: Partial<TeamModel> | null | undefined): FacilityLevels {
    const sanitize = (val: any, fallback = 3): number => {
      if (typeof val !== 'number' || isNaN(val) || val <= 0) return fallback
      return Math.max(1, Math.min(5, Math.round(val)))
    }

    // Herança resiliente para saves antigos:
    // Se novas facilities não existirem, herdam factory_level ou simulator_level
    const baseFactory = sanitize(team?.factory_level, 3)
    const baseSimulator = sanitize(team?.simulator_level, 3)
    const basePit = sanitize(team?.pitstop_center_level, 3)
    const baseAcademy = sanitize(team?.youth_academy_level, 3)

    return {
      factory: baseFactory,
      design_centre: sanitize(team?.design_centre_level, baseFactory),
      cfd: sanitize(team?.cfd_level, baseFactory),
      wind_tunnel: sanitize(team?.wind_tunnel_level, baseFactory),
      manufacturing: sanitize(team?.manufacturing_level, baseFactory),
      simulator: baseSimulator,
      operations_centre: sanitize(team?.operations_centre_level, baseSimulator),
      pitstop_center: basePit,
      youth_academy: baseAcademy,
    }
  }

  /**
   * Converte o nível discreto (1 a 5) em pontuação base com retornos decrescentes (diminishing returns).
   * Progressão:
   * Nível 1: 35.0 (Básica)
   * Nível 2: 55.0 (+20.0 ganho relativo grande)
   * Nível 3: 72.0 (+17.0 ganho intermediário sólido)
   * Nível 4: 85.0 (+13.0 ganho avançado)
   * Nível 5: 95.0 (+10.0 estado da arte - topo, mas sem esmagar o nível 4)
   */
  public calculateDiminishingScore(level: number): number {
    const clamped = Math.max(1, Math.min(5, Math.round(level)))
    switch (clamped) {
      case 1:
        return 35.0
      case 2:
        return 55.0
      case 3:
        return 72.0
      case 4:
        return 85.0
      case 5:
        return 95.0
      default:
        return 70.0
    }
  }

  /**
   * Avalia Sinergias e Gargalos entre as instalações.
   * Não utiliza simplesmente média aritmética: desbalanços severos ativam gargalos funcionais.
   */
  public evaluateBottlenecksAndSynergies(levels: FacilityLevels): {
    bottlenecks: InfrastructureBottleneck[]
    synergies: InfrastructureSynergy[]
    technicalBottleneckName?: string
    academyBottleneckName?: string
  } {
    const bottlenecks: InfrastructureBottleneck[] = []
    const synergies: InfrastructureSynergy[] = []

    // 1. Gargalo Técnico Aero/Validação: CFD alto vs Wind Tunnel baixo
    // Ex: CFD 5 e Wind Tunnel 1 = Excelente exploração virtual, mas péssima correlação na pista
    if (levels.cfd >= levels.wind_tunnel + 2) {
      const penalty = Math.min(0.25, (levels.cfd - levels.wind_tunnel) * 0.08)
      bottlenecks.push({
        domain: 'aero_pnd',
        title: 'Descompasso de Validação Aerodinâmica',
        description: `Cluster CFD Nível ${levels.cfd} produz alto volume de conceitos virtuais que o Túnel de Vento Nível ${levels.wind_tunnel} não consegue correlacionar fisicamente. Risco elevado de correlações ilusórias.`,
        weakFacilityId: 'wind_tunnel',
        weakFacilityLevel: levels.wind_tunnel,
        strongFacilityId: 'cfd',
        strongFacilityLevel: levels.cfd,
        penaltyPercent: Number((penalty * 100).toFixed(1)),
      })
    }

    // 2. Gargalo de Ponte Industrial: Design/Aero alto vs Manufatura baixa
    // Ex: Design 5 / CFD 5 / Wind Tunnel 5 vs Manufatura 1
    // Um projeto espetacular sofre para chegar à pista se a usinagem e compósitos forem lentos e cheios de defeito.
    const conceptualMax = Math.max(levels.design_centre, levels.cfd, levels.wind_tunnel)
    if (conceptualMax >= levels.manufacturing + 2) {
      const penalty = Math.min(0.3, (conceptualMax - levels.manufacturing) * 0.1)
      bottlenecks.push({
        domain: 'manufacturing_bridge',
        title: 'Gargalo de Execução Física (Design -> Physical Part)',
        description: `Capacidade projetual de ponta limitada pelo Centro de Manufatura Nível ${levels.manufacturing}. Dificuldade e lentidão para produzir fisicamente as peças projetadas.`,
        weakFacilityId: 'manufacturing',
        weakFacilityLevel: levels.manufacturing,
        strongFacilityId: 'design_centre',
        strongFacilityLevel: conceptualMax,
        penaltyPercent: Number((penalty * 100).toFixed(1)),
      })
    }

    // 3. Gargalo Inverso: Manufatura 5 vs Design 2
    // Boa fábrica de peças, mas capacidade limitada de criar novas geometrias
    if (levels.manufacturing >= levels.design_centre + 2) {
      const penalty = Math.min(0.2, (levels.manufacturing - levels.design_centre) * 0.07)
      bottlenecks.push({
        domain: 'manufacturing_bridge',
        title: 'Subutilização Industrial',
        description: `Manufatura de Nível ${levels.manufacturing} ociosa ou produzindo conceitos conservadores devido ao Centro de Design Nível ${levels.design_centre}.`,
        weakFacilityId: 'design_centre',
        weakFacilityLevel: levels.design_centre,
        strongFacilityId: 'manufacturing',
        strongFacilityLevel: levels.manufacturing,
        penaltyPercent: Number((penalty * 100).toFixed(1)),
      })
    }

    // 4. Gargalo de Operações: Simulador alto vs Centro de Operações baixo
    if (levels.simulator >= levels.operations_centre + 2) {
      const penalty = Math.min(0.18, (levels.simulator - levels.operations_centre) * 0.06)
      bottlenecks.push({
        domain: 'race_operations',
        title: 'Gargalo de Conversão de Telemetria de Pista',
        description: `Simulador Nível ${levels.simulator} gera modelos refinados, mas o Centro de Operações Nível ${levels.operations_centre} possui baixa capacidade de processar dados e coordenar decisões com o pit wall.`,
        weakFacilityId: 'operations_centre',
        weakFacilityLevel: levels.operations_centre,
        strongFacilityId: 'simulator',
        strongFacilityLevel: levels.simulator,
        penaltyPercent: Number((penalty * 100).toFixed(1)),
      })
    }

    // 5. Gargalo de Academia: Academia alta vs Simulador baixo
    // Ex: Academy 5 + Simulator 1 = Excelente scouting, mas ferramentas limitadas de preparação de base
    if (levels.youth_academy >= levels.simulator + 2) {
      const penalty = Math.min(0.22, (levels.youth_academy - levels.simulator) * 0.07)
      bottlenecks.push({
        domain: 'talent_academy',
        title: 'Gargalo de Ferramental para Jovens Pilotos',
        description: `Programa de talentos da Academia Nível ${levels.youth_academy} com rede de scouting ampla, mas suporte de treinamento em Simulador restrito ao Nível ${levels.simulator}.`,
        weakFacilityId: 'simulator',
        weakFacilityLevel: levels.simulator,
        strongFacilityId: 'youth_academy',
        strongFacilityLevel: levels.youth_academy,
        penaltyPercent: Number((penalty * 100).toFixed(1)),
      })
    }

    // Sinergias Positivas:
    // Sinergia Aero Completa: CFD 4+ e Wind Tunnel 4+
    if (levels.cfd >= 4 && levels.wind_tunnel >= 4) {
      synergies.push({
        title: 'Tríade Aerodinâmica Integrada',
        description:
          'Harmonia entre malhas computacionais refinadas e túnel calibrado: máxima correlação entre túnel e pista.',
        involvedFacilities: ['cfd', 'wind_tunnel'],
        bonusPercent: 6.0,
      })
    }

    // Sinergia de Produção: Factory 4+ e Manufacturing 4+
    if (levels.factory >= 4 && levels.manufacturing >= 4) {
      synergies.push({
        title: 'Cadeia de Suprimentos & Throughput Fluido',
        description:
          'Automação de fábrica aliada a compósitos de precisão garante fluxo contínuo de atualizações.',
        involvedFacilities: ['factory', 'manufacturing'],
        bonusPercent: 5.0,
      })
    }

    // Sinergia de Pista: Simulator 4+ e Operations Centre 4+
    if (levels.simulator >= 4 && levels.operations_centre >= 4) {
      synergies.push({
        title: 'Gêmeo Digital de Fim de Semana',
        description:
          'Previsões do simulador integradas em tempo real com os engenheiros remotos no domingo.',
        involvedFacilities: ['simulator', 'operations_centre'],
        bonusPercent: 5.5,
      })
    }

    // Sinergia de Formação: Youth Academy 4+ e Simulator 4+
    if (levels.youth_academy >= 4 && levels.simulator >= 4) {
      synergies.push({
        title: 'Programa de Alto Rendimento de Jovens',
        description:
          'Promessas da base realizam centenas de horas de testes imersivos antes de pisar na pista real.',
        involvedFacilities: ['youth_academy', 'simulator'],
        bonusPercent: 7.0,
      })
    }

    const techB = bottlenecks.find(
      (b) => b.domain === 'aero_pnd' || b.domain === 'manufacturing_bridge',
    )
    const acadB = bottlenecks.find((b) => b.domain === 'talent_academy')

    return {
      bottlenecks,
      synergies,
      technicalBottleneckName: techB
        ? `${techB.weakFacilityId.toUpperCase()} (Gargalo)`
        : undefined,
      academyBottleneckName: acadB ? `${acadB.weakFacilityId.toUpperCase()} (Gargalo)` : undefined,
    }
  }

  /**
   * Calcula o conjunto canônico completo de Capabilities Técnicas e Organizacionais.
   * Integra os modificadores permitidos do ManagerEffectService (technicalManagement e talentDevelopment).
   */
  public calculateCapabilities(
    facilityLevels: FacilityLevels,
    team?: Partial<TeamModel> | null,
  ): TechnicalCapabilities {
    const scores = {
      factory: this.calculateDiminishingScore(facilityLevels.factory),
      design_centre: this.calculateDiminishingScore(facilityLevels.design_centre),
      cfd: this.calculateDiminishingScore(facilityLevels.cfd),
      wind_tunnel: this.calculateDiminishingScore(facilityLevels.wind_tunnel),
      manufacturing: this.calculateDiminishingScore(facilityLevels.manufacturing),
      simulator: this.calculateDiminishingScore(facilityLevels.simulator),
      operations_centre: this.calculateDiminishingScore(facilityLevels.operations_centre),
      pitstop_center: this.calculateDiminishingScore(facilityLevels.pitstop_center),
      youth_academy: this.calculateDiminishingScore(facilityLevels.youth_academy),
    }

    const { bottlenecks, synergies } = this.evaluateBottlenecksAndSynergies(facilityLevels)

    // Bônus/Penalidades agrupados por domínio
    const aeroBottleneck = bottlenecks.find((b) => b.domain === 'aero_pnd')
    const mfgBottleneck = bottlenecks.find((b) => b.domain === 'manufacturing_bridge')
    const opsBottleneck = bottlenecks.find((b) => b.domain === 'race_operations')
    const academyBottleneck = bottlenecks.find((b) => b.domain === 'talent_academy')

    const aeroSynergy = synergies.find((s) => s.title.includes('Aerodinâmica'))
    const mfgSynergy = synergies.find((s) => s.title.includes('Cadeia'))
    const opsSynergy = synergies.find((s) => s.title.includes('Gêmeo Digital'))
    const academySynergy = synergies.find((s) => s.title.includes('Alto Rendimento'))

    // Modificadores Canônicos do Manager (Reutilização estrita de ManagerEffectService)
    const managerEval = managerEffectService.evaluateManager(team)
    // technicalManagement mod: -4% a +6% (aplicado em processos e eficiência técnica)
    const managerTechMod = managerEval.modifiers.workshopEfficiencyBonus
    // talentDevelopment mod: -3% a +8% (aplicado na capacidade de desenvolvimento de jovens)
    const managerTalentMod = managerEval.modifiers.academyDevelopmentBonus
    // raceManagement mod: -2% a +4% na taxa de erro de box
    const managerPitMod = managerEval.modifiers.pitStopErrorReduction

    // Modulação Técnica do Staff (Implementação 7B)
    // Se a equipe possuir organização técnica estruturada, calcular multiplicadores orgânicos por cargo
    let staffAeroFactor = 1.0
    let staffDesignFactor = 1.0
    let staffOpsFactor = 1.0
    let staffAcademyFactor = 1.0
    let staffThroughputFactor = 1.0

    if (team) {
      const teamOrg = (team as { technical_organization?: TeamTechnicalOrganization })
        .technical_organization
      if (teamOrg && teamOrg.members) {
        const hoaEff = technicalOrganizationService.calculateStaffEffectiveness(
          teamOrg.members.HEAD_OF_AERODYNAMICS,
          'HEAD_OF_AERODYNAMICS',
        )
        const cdEff = technicalOrganizationService.calculateStaffEffectiveness(
          teamOrg.members.CHIEF_DESIGNER,
          'CHIEF_DESIGNER',
        )
        const tdEff = technicalOrganizationService.calculateStaffEffectiveness(
          teamOrg.members.TECHNICAL_DIRECTOR,
          'TECHNICAL_DIRECTOR',
        )
        const sdEff = technicalOrganizationService.calculateStaffEffectiveness(
          teamOrg.members.SPORTING_DIRECTOR,
          'SPORTING_DIRECTOR',
        )
        const adEff = technicalOrganizationService.calculateStaffEffectiveness(
          teamOrg.members.ACADEMY_DIRECTOR,
          'ACADEMY_DIRECTOR',
        )

        staffAeroFactor = 0.8 + (hoaEff / 100) * 0.35 // 0.8 a 1.15
        staffDesignFactor = 0.8 + (cdEff / 100) * 0.35
        staffThroughputFactor = 0.8 + (tdEff / 100) * 0.35
        staffOpsFactor = 0.8 + (sdEff / 100) * 0.35
        staffAcademyFactor = 0.8 + (adEff / 100) * 0.35
      }
    }

    // 1. P&D / Engenharia
    // designCapacity: 70% Design Centre + 20% Factory + 10% CFD
    let rawDesignCap = scores.design_centre * 0.7 + scores.factory * 0.2 + scores.cfd * 0.1
    rawDesignCap *= 1 + managerTechMod * 0.5

    // simulationAccuracy: 80% CFD + 20% Design Centre
    let rawSimAccuracy = scores.cfd * 0.8 + scores.design_centre * 0.2
    rawSimAccuracy *= 1 + managerTechMod * 0.4

    // aeroCorrelation: 60% Wind Tunnel + 30% CFD + 10% Simulator
    let rawAeroCorrelation = scores.wind_tunnel * 0.6 + scores.cfd * 0.3 + scores.simulator * 0.1
    if (aeroBottleneck) rawAeroCorrelation *= 1 - aeroBottleneck.penaltyPercent / 100
    if (aeroSynergy) rawAeroCorrelation *= 1 + aeroSynergy.bonusPercent / 100
    rawAeroCorrelation *= (1 + managerTechMod * 0.3) * staffAeroFactor

    // developmentThroughput: 45% Factory + 30% Design + 25% Manufacturing
    let rawThroughput =
      scores.factory * 0.45 + scores.design_centre * 0.3 + scores.manufacturing * 0.25
    if (mfgBottleneck) rawThroughput *= 1 - mfgBottleneck.penaltyPercent / 100
    if (mfgSynergy) rawThroughput *= 1 + mfgSynergy.bonusPercent / 100
    rawThroughput *= (1 + managerTechMod * 0.6) * staffThroughputFactor

    // 2. Fabricação & Produção Física (Design -> Physical Part)
    // manufacturingCapacity: 75% Manufacturing + 25% Factory
    let rawMfgCapacity = scores.manufacturing * 0.75 + scores.factory * 0.25
    if (mfgBottleneck) rawMfgCapacity *= 1 - mfgBottleneck.penaltyPercent / 100
    if (mfgSynergy) rawMfgCapacity *= 1 + mfgSynergy.bonusPercent / 100
    rawMfgCapacity *= 1 + managerTechMod * 0.5

    // manufacturingQuality: 85% Manufacturing + 15% Design Centre
    let rawMfgQuality = scores.manufacturing * 0.85 + scores.design_centre * 0.15
    rawMfgQuality *= 1 + managerTechMod * 0.5

    // 3. Operações de Corrida & Eficiência Organizacional
    // operationalEfficiency: 60% Factory + 25% Operations + 15% Manufacturing
    let rawOpsEfficiency =
      scores.factory * 0.6 + scores.operations_centre * 0.25 + scores.manufacturing * 0.15
    rawOpsEfficiency *= 1 + managerTechMod * 0.5

    // raceOperationsCapability: 70% Operations Centre + 30% Simulator
    let rawRaceOps = scores.operations_centre * 0.7 + scores.simulator * 0.3
    if (opsBottleneck) rawRaceOps *= 1 - opsBottleneck.penaltyPercent / 100
    if (opsSynergy) rawRaceOps *= 1 + opsSynergy.bonusPercent / 100
    rawRaceOps *= staffOpsFactor

    // pitCrewPerformance: 85% Pitstop Center + 15% Factory
    let rawPitCrew = scores.pitstop_center * 0.85 + scores.factory * 0.15
    rawPitCrew *= 1 + managerPitMod * 0.5

    // 4. Academia, Scouting e Talentos (Fase 4C)
    // scoutingReach: 85% Youth Academy + 15% Factory (alcance logístico)
    let rawScoutingReach = scores.youth_academy * 0.85 + scores.factory * 0.15
    rawScoutingReach *= 1 + managerTalentMod * 0.3

    // prospectDiscoveryCapacity: 90% Youth Academy + 10% Operations
    let rawDiscovery = scores.youth_academy * 0.9 + scores.operations_centre * 0.1
    rawDiscovery *= 1 + managerTalentMod * 0.4

    // evaluationAccuracy: 75% Youth Academy + 25% Simulator (testes de volante/dados de telemetria)
    let rawEvalAccuracy = scores.youth_academy * 0.75 + scores.simulator * 0.25
    if (academyBottleneck) rawEvalAccuracy *= 1 - academyBottleneck.penaltyPercent / 100
    rawEvalAccuracy *= 1 + managerTalentMod * 0.5

    // talentDevelopmentCapacity: 60% Youth Academy + 40% Simulator
    let rawTalentDev = scores.youth_academy * 0.6 + scores.simulator * 0.4
    if (academyBottleneck) rawTalentDev *= 1 - academyBottleneck.penaltyPercent / 100
    if (academySynergy) rawTalentDev *= 1 + academySynergy.bonusPercent / 100
    rawTalentDev *= (1 + managerTalentMod * 0.8) * staffAcademyFactor

    // academySupportQuality: 50% Youth Academy + 30% Simulator + 20% Factory
    let rawSupport = scores.youth_academy * 0.5 + scores.simulator * 0.3 + scores.factory * 0.2
    rawSupport *= 1 + managerTalentMod * 0.4

    // prospectRetentionCapability: 70% Youth Academy + 30% Factory (estrutura/prestígio)
    let rawRetention = scores.youth_academy * 0.7 + scores.factory * 0.3
    rawRetention *= 1 + managerTalentMod * 0.3

    const clamp = (v: number) => Math.max(10, Math.min(99, Math.round(v)))

    return {
      designCapacity: clamp(rawDesignCap),
      simulationAccuracy: clamp(rawSimAccuracy),
      aeroCorrelation: clamp(rawAeroCorrelation),
      developmentThroughput: clamp(rawThroughput),
      manufacturingCapacity: clamp(rawMfgCapacity),
      manufacturingQuality: clamp(rawMfgQuality),
      operationalEfficiency: clamp(rawOpsEfficiency),
      raceOperationsCapability: clamp(rawRaceOps),
      pitCrewPerformance: clamp(rawPitCrew),
      scoutingReach: clamp(rawScoutingReach),
      prospectDiscoveryCapacity: clamp(rawDiscovery),
      evaluationAccuracy: clamp(rawEvalAccuracy),
      talentDevelopmentCapacity: clamp(rawTalentDev),
      academySupportQuality: clamp(rawSupport),
      prospectRetentionCapability: clamp(rawRetention),
    }
  }

  /**
   * Calcula o OPEX anual e por rodada das 9 instalações.
   * Níveis superiores possuem custos de manutenção e pessoal progressivos.
   */
  public calculateOperatingExpense(
    facilityLevels: FacilityLevels,
    calendarRounds?: number,
  ): {
    totalAnnualOpex: number
    roundOpex: number
    opexBreakdown: Record<CanonicalFacilityId, number>
  } {
    let totalAnnualOpex = 0
    const opexBreakdown: Record<string, number> = {}

    for (const def of CANONICAL_FACILITIES_DEFINITIONS) {
      const level = facilityLevels[def.id] || 3
      let facilityOpex = def.baseAnnualOpex

      // Soma os acréscimos de OPEX para cada nível acima do Nível 1
      for (let lvl = 2; lvl <= level; lvl++) {
        const upgradeSpec = def.upgrades[lvl]
        if (upgradeSpec) {
          facilityOpex += upgradeSpec.opexAnnualIncrease
        }
      }

      opexBreakdown[def.id] = facilityOpex
      totalAnnualOpex += facilityOpex
    }

    const totalRounds = calendarRounds && calendarRounds > 0 ? calendarRounds : 24
    const roundOpex = Math.round(totalAnnualOpex / totalRounds)

    return {
      totalAnnualOpex,
      roundOpex,
      opexBreakdown: opexBreakdown as Record<CanonicalFacilityId, number>,
    }
  }

  /**
   * Gera auditoria completa de infraestrutura para telemetria, debug e UI.
   */
  public auditInfrastructure(
    team?: Partial<TeamModel> | null,
    calendarRounds?: number,
  ): InfrastructureAuditResult {
    const facilityLevels = this.getFacilityLevels(team)
    const capabilities = this.calculateCapabilities(facilityLevels, team)
    const { bottlenecks, synergies, technicalBottleneckName, academyBottleneckName } =
      this.evaluateBottlenecksAndSynergies(facilityLevels)

    const sumLevels = Object.values(facilityLevels).reduce((acc, l) => acc + l, 0)
    const averageLevel = Number((sumLevels / 9).toFixed(1))

    const { totalAnnualOpex, roundOpex } = this.calculateOperatingExpense(
      facilityLevels,
      calendarRounds,
    )

    const managerEval = managerEffectService.evaluateManager(team)
    const managerTechnicalModifier = managerEval.modifiers.workshopEfficiencyBonus
    const managerTalentModifier = managerEval.modifiers.academyDevelopmentBonus

    const teamName = team?.name || 'Equipe'
    const signTech = managerTechnicalModifier >= 0 ? '+' : ''
    const signTalent = managerTalentModifier >= 0 ? '+' : ''

    const telemetrySummary =
      `${teamName.toUpperCase()} — Factory: ${facilityLevels.factory}, Design: ${facilityLevels.design_centre}, CFD: ${facilityLevels.cfd}, ` +
      `Wind Tunnel: ${facilityLevels.wind_tunnel}, Manufacturing: ${facilityLevels.manufacturing}, Simulator: ${facilityLevels.simulator}, ` +
      `Operations: ${facilityLevels.operations_centre}, Pit Crew: ${facilityLevels.pitstop_center}, Academy: ${facilityLevels.youth_academy} | ` +
      `Derived: Design ${capabilities.designCapacity}, SimAccuracy ${capabilities.simulationAccuracy}, AeroCorr ${capabilities.aeroCorrelation}, ` +
      `MfgCap ${capabilities.manufacturingCapacity}, RaceOps ${capabilities.raceOperationsCapability}, TalentDev ${capabilities.talentDevelopmentCapacity}, ` +
      `ScoutReach ${capabilities.scoutingReach}, EvalAcc ${capabilities.evaluationAccuracy} | ` +
      `Tech Bottleneck: ${technicalBottleneckName || 'Nenhum'} | Academy Bottleneck: ${academyBottleneckName || 'Nenhum'} | ` +
      `Manager Tech Mod: ${signTech}${(managerTechnicalModifier * 100).toFixed(1)}% | Manager Talent Mod: ${signTalent}${(managerTalentModifier * 100).toFixed(1)}%`

    return {
      facilityLevels,
      averageLevel,
      capabilities,
      bottlenecks,
      synergies,
      technicalBottleneckName,
      academyBottleneckName,
      managerTechnicalModifier,
      managerTalentModifier,
      totalAnnualOpex,
      roundOpex,
      telemetrySummary,
    }
  }
}

export const infrastructureCapabilityService = new InfrastructureCapabilityService()
