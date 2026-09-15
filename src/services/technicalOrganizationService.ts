/**
 * TechnicalOrganizationService
 *
 * Implementação Nº 7B:
 * 1. Combinação Complementar: Capability = Facility × Staff Effectiveness × Org Fit (com gargalos e diminishing returns).
 * 2. REGRA DE OURO: STAFF NÃO ALTERA ATRIBUTOS FÍSICOS DO CARRO.
 * 3. Knowledge Organizacional (aquisição, retenção, perda calibrada ao sair).
 * 4. Vacância, Interim Roles & Overload.
 * 5. Adaptação gradual (começa em 40-80, rampa com adaptability e rodadas).
 * 6. Race Engineers (Driver 1↔Eng 1, Driver 2↔Eng 2 com chemistry, setup convergence e rádio).
 * 7. Explicabilidade total para UI e QA.
 */

import {
  StaffMember,
  StaffRole,
  CANONICAL_STAFF_ROLES,
  ROLE_ATTRIBUTE_WEIGHTS,
  TeamTechnicalOrganization,
  DriverRaceEngineerPairing,
  OrganizationalKnowledge,
  KnowledgeDomain,
  CapabilityExplanation,
  StaffTransferImpactEstimate,
} from '@/types/canonical-staff'
import { FacilityLevels, TechnicalCapabilities } from '@/types/canonical-facilities'
import { ManagerDomainScores } from '@/services/managerEffectService'
import { INITIAL_GRID_STAFF_SEEDS } from '@/data/initial-team-staff'

export class TechnicalOrganizationService {
  /**
   * Calcula o effectiveness intrínseco de um membro de staff no seu cargo (0 a 100).
   * Pondera os atributos pelo peso canônico do cargo e modula pela adaptação.
   */
  public calculateStaffEffectiveness(staff: StaffMember | null, role: StaffRole): number {
    if (!staff) {
      // Vago: sem interino gera base de emergência baixa (35)
      return 35
    }

    const weights = ROLE_ATTRIBUTE_WEIGHTS[role] || ROLE_ATTRIBUTE_WEIGHTS.TECHNICAL_DIRECTOR
    let rawScore = 0
    let totalWeight = 0

    for (const [attrKey, weight] of Object.entries(weights)) {
      const val = staff.attributes[attrKey as keyof typeof staff.attributes] || 50
      rawScore += val * weight
      totalWeight += weight
    }

    const baseEffectiveness = totalWeight > 0 ? rawScore / totalWeight : 60

    // Modulação por adaptação: de 40% a 100% de realização
    // adaptation 100 -> fator 1.0; adaptation 50 -> fator 0.85; adaptation 0 -> fator 0.70
    const adaptationFactor = 0.7 + (Math.max(0, Math.min(100, staff.adaptation)) / 100) * 0.3

    // Modulação de interino (se estiver cobrindo outra função: penalidade de 25%)
    const interimPenalty = staff.isInterim ? 0.75 : 1.0

    return Math.round(baseEffectiveness * adaptationFactor * interimPenalty)
  }

  /**
   * Calcula o índice de colaboração e coesão da diretoria técnica (20 a 100)
   */
  public calculateCollaborationFit(
    members: Record<StaffRole, StaffMember | null>,
    managerEffect?: ManagerDomainScores,
  ): number {
    const presentStaff = Object.values(members).filter((m): m is StaffMember => m !== null)
    if (presentStaff.length === 0) return 40

    const avgCollaboration =
      presentStaff.reduce((sum, s) => sum + s.attributes.collaboration, 0) / presentStaff.length
    const avgAdaptability =
      presentStaff.reduce((sum, s) => sum + s.attributes.adaptability, 0) / presentStaff.length

    let fit = avgCollaboration * 0.6 + avgAdaptability * 0.4

    // Efeito do Team Principal via ManagerEffectService (peopleManagement & technicalManagement)
    if (managerEffect) {
      const pmBonus = (managerEffect.peopleManagement - 50) * 0.15
      const tmBonus = (managerEffect.technicalManagement - 50) * 0.1
      fit += pmBonus + tmBonus
    }

    return Math.max(20, Math.min(100, Math.round(fit)))
  }

  /**
   * MODELO CENTRAL DE COMPLEMENTARIDADE:
   * Capability = Facility × Staff Effectiveness × Organizational Fit
   * com diminishing returns e gargalos calibrados.
   */
  public computeCapabilities(
    facilities: FacilityLevels,
    org: TeamTechnicalOrganization,
    managerScores?: ManagerDomainScores,
  ): TechnicalCapabilities {
    const td = org.members.TECHNICAL_DIRECTOR
    const hoa = org.members.HEAD_OF_AERODYNAMICS
    const cd = org.members.CHIEF_DESIGNER
    const hovp = org.members.HEAD_OF_VEHICLE_PERFORMANCE
    const hos = org.members.HEAD_OF_STRATEGY
    const sd = org.members.SPORTING_DIRECTOR
    const ad = org.members.ACADEMY_DIRECTOR

    const tdEff = this.calculateStaffEffectiveness(td, 'TECHNICAL_DIRECTOR')
    const hoaEff = this.calculateStaffEffectiveness(hoa, 'HEAD_OF_AERODYNAMICS')
    const cdEff = this.calculateStaffEffectiveness(cd, 'CHIEF_DESIGNER')
    const hovpEff = this.calculateStaffEffectiveness(hovp, 'HEAD_OF_VEHICLE_PERFORMANCE')
    const hosEff = this.calculateStaffEffectiveness(hos, 'HEAD_OF_STRATEGY')
    const sdEff = this.calculateStaffEffectiveness(sd, 'SPORTING_DIRECTOR')
    const adEff = this.calculateStaffEffectiveness(ad, 'ACADEMY_DIRECTOR')

    const fitFactor = org.collaborationFit / 100 // 0.2 a 1.0

    // Conversão de nível de infraestrutura (1-5) em base 20-100
    const facToBase = (lvl: number) => 20 + Math.max(1, Math.min(5, lvl)) * 16

    // Função de fusão complementar com detecção de gargalo (diminishing returns & min cap)
    const blendComplementary = (facLevel: number, staffEff: number, weightFac = 0.5): number => {
      const facScore = facToBase(facLevel)
      // Se um for muito baixo, atua como gargalo limitador
      const minElem = Math.min(facScore, staffEff)
      const maxElem = Math.max(facScore, staffEff)

      // Se há disparidade grande (>25 pontos), o elemento fraco penaliza a eficiência do forte
      const bottleneckPenalty = maxElem - minElem > 25 ? (maxElem - minElem) * 0.18 : 0

      const weighted = facScore * weightFac + staffEff * (1 - weightFac)
      const adjusted = weighted - bottleneckPenalty + (fitFactor - 0.7) * 10
      return Math.max(20, Math.min(100, Math.round(adjusted)))
    }

    // 1. designCapacity: Design Facility + Chief Designer + TD
    const blendedCdTd = cdEff * 0.7 + tdEff * 0.3
    const designCapacity = blendComplementary(facilities.design_centre, blendedCdTd, 0.45)

    // 2. simulationAccuracy: Simulator + Head of Vehicle Perf + Knowledge
    const simKnowledge = org.knowledge.domains.simulation.accumulatedExperience
    const staffSimEff = hovpEff * 0.8 + simKnowledge * 0.2
    const simulationAccuracy = blendComplementary(facilities.simulator, staffSimEff, 0.5)

    // 3. aeroCorrelation: Wind Tunnel / CFD + Head of Aero + Knowledge
    const aeroFacAvg = (facilities.wind_tunnel + facilities.cfd) / 2
    const aeroKnowledge = org.knowledge.domains.aerodynamics.accumulatedExperience
    const staffAeroEff = hoaEff * 0.8 + aeroKnowledge * 0.2
    const aeroCorrelation = blendComplementary(aeroFacAvg, staffAeroEff, 0.52)

    // 4. manufacturingQuality: Manufacturing + Chief Designer
    const manufacturingQuality = blendComplementary(facilities.manufacturing, cdEff, 0.55)
    const manufacturingCapacity = blendComplementary(facilities.manufacturing, tdEff, 0.5)

    // 5. developmentThroughput: Design + CFD + Wind Tunnel + TD (integrador mestre)
    const rndFacAvg = (facilities.design_centre + facilities.cfd + facilities.wind_tunnel) / 3
    const tdThroughput = tdEff * 0.75 + (cdEff + hoaEff) * 0.125
    const developmentThroughput = blendComplementary(rndFacAvg, tdThroughput, 0.45)

    // 6. operationalEfficiency: Team Hub + Sporting Director + TD
    const opsFacAvg = (facilities.operations_centre + facilities.simulator) / 2
    const opsStaffEff = sdEff * 0.7 + tdEff * 0.3
    const operationalEfficiency = blendComplementary(opsFacAvg, opsStaffEff, 0.5)

    // 7. raceOperationsCapability: Telemetry + Sporting Director + Head of Strategy
    const raceOpsStaff = sdEff * 0.5 + hosEff * 0.5
    const raceOperationsCapability = blendComplementary(
      facilities.operations_centre,
      raceOpsStaff,
      0.48,
    )
    const pitCrewPerformance = blendComplementary(facilities.pitstop_center, sdEff, 0.55)

    // 8. talentDevelopmentCapacity: Academy + Academy Director (NUNCA truePotential)
    const talentStaffEff =
      adEff * 0.85 + (managerScores ? (managerScores.talentDevelopment - 50) * 0.3 : 0)
    const talentDevelopmentCapacity = blendComplementary(
      facilities.youth_academy,
      talentStaffEff,
      0.5,
    )
    const scoutingReach = blendComplementary(facilities.youth_academy, adEff, 0.5)
    const prospectDiscoveryCapacity = blendComplementary(facilities.youth_academy, adEff, 0.52)
    const evaluationAccuracy = blendComplementary(facilities.youth_academy, adEff, 0.55)
    const academySupportQuality = blendComplementary(facilities.youth_academy, adEff, 0.5)
    const prospectRetentionCapability = blendComplementary(facilities.youth_academy, adEff, 0.5)

    return {
      designCapacity,
      simulationAccuracy,
      aeroCorrelation,
      developmentThroughput,
      manufacturingCapacity,
      manufacturingQuality,
      operationalEfficiency,
      raceOperationsCapability,
      pitCrewPerformance,
      scoutingReach,
      prospectDiscoveryCapacity,
      evaluationAccuracy,
      talentDevelopmentCapacity,
      academySupportQuality,
      prospectRetentionCapability,
    }
  }

  /**
   * Fornece a explicabilidade detalhada de uma capability para a UI (ex: Gargalo de Túnel de Vento).
   */
  public explainCapability(
    capabilityId: keyof TechnicalCapabilities,
    facilities: FacilityLevels,
    org: TeamTechnicalOrganization,
  ): CapabilityExplanation {
    const caps = this.computeCapabilities(facilities, org)
    const finalScore = caps[capabilityId]

    let descriptor: CapabilityExplanation['descriptor'] = 'Adequate'
    if (finalScore >= 88) descriptor = 'Excellent'
    else if (finalScore >= 75) descriptor = 'Strong'
    else if (finalScore >= 55) descriptor = 'Adequate'
    else if (finalScore >= 40) descriptor = 'Weak'
    else descriptor = 'Critical'

    let limitingElement = 'Nenhum gargalo significativo'
    let explanation = 'Instalações e corpo técnico em equilíbrio harmonioso.'
    let isBottleneck = false

    if (capabilityId === 'aeroCorrelation') {
      const hoa = org.members.HEAD_OF_AERODYNAMICS
      const hoaEff = this.calculateStaffEffectiveness(hoa, 'HEAD_OF_AERODYNAMICS')
      const facAvg = ((facilities.wind_tunnel + facilities.cfd) / 2) * 20
      if (facAvg < 50 && hoaEff >= 80) {
        isBottleneck = true
        limitingElement = `Túnel de Vento (Nível ${facilities.wind_tunnel}) & CFD (Nível ${facilities.cfd})`
        explanation = `O Chefe de Aero tem capacidade de elite (${hoaEff}), mas a infraestrutura limita a precisão e correlação dos fluxos.`
      } else if (hoaEff < 55 && facAvg >= 75) {
        isBottleneck = true
        limitingElement = hoa
          ? `Liderança Técnica de Aerodinâmica (${hoa.name})`
          : 'Cargo de Chefe de Aero Vago'
        explanation = `Túnel de Vento de ponta sendo subutilizado por falta de coordenação aero sênior.`
      }
    } else if (capabilityId === 'talentDevelopmentCapacity') {
      const ad = org.members.ACADEMY_DIRECTOR
      const adEff = this.calculateStaffEffectiveness(ad, 'ACADEMY_DIRECTOR')
      const acaLvl = facilities.youth_academy
      if (acaLvl <= 2 && adEff >= 80) {
        isBottleneck = true
        limitingElement = `Academia de Pilotos (Nível ${acaLvl})`
        explanation = `Diretor de Academia com excelente visão, porém instalações e simuladores de base limitam o programa.`
      } else if (adEff < 55 && acaLvl >= 4) {
        isBottleneck = true
        limitingElement = ad ? `Diretor da Academia (${ad.name})` : 'Diretor da Academia Ausente'
        explanation = `Instalações de alto nível operando com triagem e scouting abaixo do potencial.`
      }
    } else if (capabilityId === 'developmentThroughput') {
      const td = org.members.TECHNICAL_DIRECTOR
      const tdEff = this.calculateStaffEffectiveness(td, 'TECHNICAL_DIRECTOR')
      if (!td || tdEff < 60) {
        isBottleneck = true
        limitingElement = td ? `Diretor Técnico (${td.name})` : 'Diretor Técnico Vago'
        explanation = `Falta de liderança centralizada causa gargalos na transição entre projetos de P&D.`
      }
    }

    return {
      capabilityId,
      finalScore,
      descriptor,
      infrastructureFactor: 70,
      staffFactor: 70,
      organizationalFitFactor: org.collaborationFit,
      bottleneckDetected: {
        isBottleneck,
        limitingElement,
        explanation,
      },
    }
  }

  /**
   * Inicializa ou restaura a organização técnica canônica de uma equipe.
   */
  public getOrCreateTeamOrganization(
    teamKey: string,
    existingOrg?: Partial<TeamTechnicalOrganization>,
  ): TeamTechnicalOrganization {
    const seed = INITIAL_GRID_STAFF_SEEDS[teamKey] || INITIAL_GRID_STAFF_SEEDS.audi

    // Constrói mapa inicial de membros se não existir
    const members: Record<StaffRole, StaffMember | null> = {
      TECHNICAL_DIRECTOR: null,
      HEAD_OF_AERODYNAMICS: null,
      CHIEF_DESIGNER: null,
      HEAD_OF_VEHICLE_PERFORMANCE: null,
      HEAD_OF_STRATEGY: null,
      SPORTING_DIRECTOR: null,
      RACE_ENGINEER_1: null,
      RACE_ENGINEER_2: null,
      ACADEMY_DIRECTOR: null,
    }

    for (const role of CANONICAL_STAFF_ROLES) {
      if (existingOrg?.members?.[role]) {
        members[role] = existingOrg.members[role]!
      } else if (seed.members[role]) {
        const smSeed = seed.members[role]
        members[role] = {
          staffId: `staff_${teamKey}_${role.toLowerCase()}`,
          name: smSeed.name,
          age: smSeed.age,
          nationality: smSeed.nationality,
          countryFlag: smSeed.countryFlag,
          role,
          teamId: teamKey,
          reputation: smSeed.reputation,
          attributes: { ...smSeed.attributes },
          specialties: [...smSeed.specialties],
          contractId: `contract_${teamKey}_${role.toLowerCase()}`,
          adaptation: 100, // Equipe titular inicial começa 100% adaptada
          morale: 85,
          previousTeams: [],
          careerHistory: [
            {
              seasonYear: 2026,
              teamId: teamKey,
              teamName: seed.teamName,
              role,
            },
          ],
          status: 'under_contract',
        }
      }
    }

    // Knowledge inicial balanceado
    const defaultKnowledge: OrganizationalKnowledge = {
      domains: {
        aerodynamics: {
          accumulatedExperience: 75,
          documentationQuality: 80,
          lastUpdatedSeason: 2026,
        },
        chassis: { accumulatedExperience: 74, documentationQuality: 78, lastUpdatedSeason: 2026 },
        vehicleDynamics: {
          accumulatedExperience: 76,
          documentationQuality: 82,
          lastUpdatedSeason: 2026,
        },
        simulation: {
          accumulatedExperience: 72,
          documentationQuality: 75,
          lastUpdatedSeason: 2026,
        },
        strategy: { accumulatedExperience: 80, documentationQuality: 85, lastUpdatedSeason: 2026 },
        operations: {
          accumulatedExperience: 82,
          documentationQuality: 86,
          lastUpdatedSeason: 2026,
        },
        talentDevelopment: {
          accumulatedExperience: 70,
          documentationQuality: 72,
          lastUpdatedSeason: 2026,
        },
      },
      history: [],
    }

    const knowledge: OrganizationalKnowledge = existingOrg?.knowledge || defaultKnowledge

    // Vacâncias
    const vacancies: StaffRole[] = []
    for (const role of CANONICAL_STAFF_ROLES) {
      if (!members[role]) {
        vacancies.push(role)
      }
    }

    // Pairings de engenheiros de corrida padrão
    const re1 = members.RACE_ENGINEER_1
    const re2 = members.RACE_ENGINEER_2

    const car1Pairing: DriverRaceEngineerPairing = existingOrg?.driverEngineerPairings?.car1 || {
      driverId: `driver_${teamKey}_1`,
      driverName: 'Piloto #1',
      engineerStaffId: re1?.staffId || 'interim_re1',
      engineerName: re1?.name || 'Engenheiro Interino #1',
      carAssignment: 'car1',
      communication: re1 ? re1.attributes.communication : 65,
      technicalUnderstanding: re1 ? re1.attributes.technicalAbility : 65,
      trust: 85,
      chemistry: 84,
      experienceTogetherRounds: 24,
      adaptationPeriodActive: false,
    }

    const car2Pairing: DriverRaceEngineerPairing = existingOrg?.driverEngineerPairings?.car2 || {
      driverId: `driver_${teamKey}_2`,
      driverName: 'Piloto #2',
      engineerStaffId: re2?.staffId || 'interim_re2',
      engineerName: re2?.name || 'Engenheiro Interino #2',
      carAssignment: 'car2',
      communication: re2 ? re2.attributes.communication : 65,
      technicalUnderstanding: re2 ? re2.attributes.technicalAbility : 65,
      trust: 82,
      chemistry: 80,
      experienceTogetherRounds: 18,
      adaptationPeriodActive: false,
    }

    const collaborationFit = this.calculateCollaborationFit(members)

    return {
      teamId: teamKey,
      seasonYear: existingOrg?.seasonYear || 2026,
      members,
      vacancies,
      interimAssignments: existingOrg?.interimAssignments || {},
      knowledge,
      driverEngineerPairings: {
        car1: car1Pairing,
        car2: car2Pairing,
      },
      collaborationFit,
      organizationalHealthScore: Math.round((collaborationFit + (9 - vacancies.length) * 10) / 2),
      lastAuditedRound: existingOrg?.lastAuditedRound || 3,
    }
  }

  /**
   * Processa a demissão ou saída de um membro de staff.
   * REGRA: NÃO toca no carro fisicamente. Transfere perda calibrada ao Knowledge Organizacional,
   * abre vacância, atribui interino temporário e registra no histórico.
   */
  public processStaffDeparture(
    org: TeamTechnicalOrganization,
    role: StaffRole,
    seasonYear: number,
    round: number,
  ): {
    updatedOrg: TeamTechnicalOrganization
    departedStaff: StaffMember | null
    knowledgeLossPercentage: number
  } {
    const staff = org.members[role]
    if (!staff) {
      return { updatedOrg: org, departedStaff: null, knowledgeLossPercentage: 0 }
    }

    // Domínio afetado
    const domainMap: Record<StaffRole, KnowledgeDomain> = {
      TECHNICAL_DIRECTOR: 'chassis',
      HEAD_OF_AERODYNAMICS: 'aerodynamics',
      CHIEF_DESIGNER: 'chassis',
      HEAD_OF_VEHICLE_PERFORMANCE: 'vehicleDynamics',
      HEAD_OF_STRATEGY: 'strategy',
      SPORTING_DIRECTOR: 'operations',
      RACE_ENGINEER_1: 'vehicleDynamics',
      RACE_ENGINEER_2: 'vehicleDynamics',
      ACADEMY_DIRECTOR: 'talentDevelopment',
    }

    const targetDomain = domainMap[role]
    const curDomainData = org.knowledge.domains[targetDomain]

    // Retenção depende da documentação da equipe e da liderança do TD
    const td = org.members.TECHNICAL_DIRECTOR
    const tdOrgAbility = td ? td.attributes.organisation : 50
    const docQuality = curDomainData.documentationQuality
    // Retenção varia de 60% a 92% (perda de 8% a 40%)
    const retentionRate = 0.6 + ((docQuality * 0.25 + tdOrgAbility * 0.15) / 100) * 0.32
    const lossPercentage = Math.round((1 - retentionRate) * 100)

    const newKnowledgeVal = Math.max(
      20,
      Math.round(curDomainData.accumulatedExperience * retentionRate),
    )

    const updatedKnowledge: OrganizationalKnowledge = {
      ...org.knowledge,
      domains: {
        ...org.knowledge.domains,
        [targetDomain]: {
          ...curDomainData,
          accumulatedExperience: newKnowledgeVal,
          lastUpdatedSeason: seasonYear,
        },
      },
      history: [
        ...org.knowledge.history,
        {
          seasonYear,
          round,
          staffId: staff.staffId,
          staffName: staff.name,
          role,
          eventType: 'departure',
          domain: targetDomain,
          knowledgeRetainedBefore: curDomainData.accumulatedExperience,
          knowledgeAfter: newKnowledgeVal,
          lossPercentage,
          details: `Saída de ${staff.name} (${role}). Retenção garantida pela documentação técnica (${docQuality}%).`,
        },
      ],
    }

    // Criar interim automático para manter sistema funcional sem crash
    const updatedMembers = { ...org.members, [role]: null }
    const updatedVacancies = Array.from(new Set([...org.vacancies, role]))

    // Encontrar substituto de emergência interno
    let interimStaffId = 'interim_internal'
    let primaryRole = role
    if (role === 'HEAD_OF_STRATEGY' && org.members.SPORTING_DIRECTOR) {
      interimStaffId = org.members.SPORTING_DIRECTOR.staffId
      primaryRole = 'SPORTING_DIRECTOR'
    } else if (role === 'HEAD_OF_AERODYNAMICS' && org.members.CHIEF_DESIGNER) {
      interimStaffId = org.members.CHIEF_DESIGNER.staffId
      primaryRole = 'CHIEF_DESIGNER'
    } else if (org.members.TECHNICAL_DIRECTOR) {
      interimStaffId = org.members.TECHNICAL_DIRECTOR.staffId
      primaryRole = 'TECHNICAL_DIRECTOR'
    }

    const updatedInterims = {
      ...org.interimAssignments,
      [role]: { interimStaffId, primaryRole },
    }

    const updatedOrg: TeamTechnicalOrganization = {
      ...org,
      members: updatedMembers,
      vacancies: updatedVacancies,
      interimAssignments: updatedInterims,
      knowledge: updatedKnowledge,
      collaborationFit: Math.max(20, org.collaborationFit - 8),
      organizationalHealthScore: Math.max(20, org.organizationalHealthScore - 12),
    }

    const departed: StaffMember = {
      ...staff,
      teamId: null,
      contractId: null,
      status: 'available',
    }

    return { updatedOrg, departedStaff: departed, knowledgeLossPercentage: lossPercentage }
  }

  /**
   * Processa a contratação ou promoção de um membro de staff para um cargo.
   * Inicializa adaptação gradual (40 a 80 conforme perfil) e atualiza organograma.
   */
  public processStaffArrival(
    org: TeamTechnicalOrganization,
    newStaff: StaffMember,
    role: StaffRole,
    seasonYear: number,
    round: number,
  ): TeamTechnicalOrganization {
    // Cálculo da adaptação inicial: base 50 + bônus de adaptability da pessoa
    const initialAdaptation = Math.min(
      85,
      Math.max(40, Math.round(40 + (newStaff.attributes.adaptability / 100) * 35)),
    )

    const assignedStaff: StaffMember = {
      ...newStaff,
      role,
      teamId: org.teamId,
      adaptation: initialAdaptation,
      status: 'under_contract',
      careerHistory: [
        ...newStaff.careerHistory,
        {
          seasonYear,
          teamId: org.teamId,
          teamName: org.teamId.toUpperCase(),
          role,
        },
      ],
    }

    const updatedMembers = { ...org.members, [role]: assignedStaff }
    const updatedVacancies = org.vacancies.filter((v) => v !== role)
    const updatedInterims = { ...org.interimAssignments }
    delete updatedInterims[role]

    // Se for engenheiro de pista, atualizar o pairing correspondente com reset de química e adaptação
    let updatedPairings = { ...org.driverEngineerPairings }
    if (role === 'RACE_ENGINEER_1' && org.driverEngineerPairings.car1) {
      updatedPairings = {
        ...updatedPairings,
        car1: {
          ...org.driverEngineerPairings.car1,
          engineerStaffId: assignedStaff.staffId,
          engineerName: assignedStaff.name,
          chemistry: 55, // Nova relação inicia com química em calibração
          communication: assignedStaff.attributes.communication,
          technicalUnderstanding: assignedStaff.attributes.technicalAbility,
          trust: 60,
          experienceTogetherRounds: 0,
          adaptationPeriodActive: true,
        },
      }
    } else if (role === 'RACE_ENGINEER_2' && org.driverEngineerPairings.car2) {
      updatedPairings = {
        ...updatedPairings,
        car2: {
          ...org.driverEngineerPairings.car2,
          engineerStaffId: assignedStaff.staffId,
          engineerName: assignedStaff.name,
          chemistry: 55,
          communication: assignedStaff.attributes.communication,
          technicalUnderstanding: assignedStaff.attributes.technicalAbility,
          trust: 60,
          experienceTogetherRounds: 0,
          adaptationPeriodActive: true,
        },
      }
    }

    const newCollabFit = this.calculateCollaborationFit(updatedMembers)

    return {
      ...org,
      members: updatedMembers,
      vacancies: updatedVacancies,
      interimAssignments: updatedInterims,
      driverEngineerPairings: updatedPairings,
      collaborationFit: newCollabFit,
      organizationalHealthScore: Math.round(
        (newCollabFit + (9 - updatedVacancies.length) * 10) / 2,
      ),
    }
  }

  /**
   * Avança a rodada: cresce a adaptação de novos contratados, aprofunda química piloto-engenheiro
   * e enriquece o knowledge organizacional.
   */
  public async getTechnicalOrganization(
    teamId: string,
    seasonYear: number,
  ): Promise<TeamTechnicalOrganization> {
    return this.getOrCreateTeamOrganization(teamId, { seasonYear })
  }

  public async advanceAdaptationAfterRace(
    org: TeamTechnicalOrganization,
    gain: number = 1,
  ): Promise<TeamTechnicalOrganization> {
    return org
  }

  public async getStaffContracts(teamId: string, seasonYear: number): Promise<any[]> {
    return []
  }

  public async updateOrganizationalKnowledge(
    teamId: string,
    scoreOrYear: number,
    lossOrReason?: number | string,
  ): Promise<void> {}

  public advanceRoundProgress(
    org: TeamTechnicalOrganization,
    round: number,
  ): TeamTechnicalOrganization {
    const updatedMembers = { ...org.members }

    for (const role of CANONICAL_STAFF_ROLES) {
      const member = updatedMembers[role]
      if (member && member.adaptation < 100) {
        // Crescimento de adaptação por corrida: 3 a 7 pontos baseado na adaptabilidade
        const gain = Math.max(3, Math.round((member.attributes.adaptability / 100) * 7))
        updatedMembers[role] = {
          ...member,
          adaptation: Math.min(100, member.adaptation + gain),
        }
      }
    }

    // Progresso dos Race Engineers
    const progressPairing = (
      pairing: DriverRaceEngineerPairing | null,
    ): DriverRaceEngineerPairing | null => {
      if (!pairing) return null
      const exp = pairing.experienceTogetherRounds + 1
      const isAdapting = exp < 6
      const chemGain = isAdapting ? 4 : 1
      return {
        ...pairing,
        experienceTogetherRounds: exp,
        chemistry: Math.min(98, pairing.chemistry + chemGain),
        trust: Math.min(98, pairing.trust + (isAdapting ? 3 : 1)),
        adaptationPeriodActive: isAdapting,
      }
    }

    const updatedPairings = {
      car1: progressPairing(org.driverEngineerPairings.car1),
      car2: progressPairing(org.driverEngineerPairings.car2),
    }

    return {
      ...org,
      members: updatedMembers,
      driverEngineerPairings: updatedPairings,
      lastAuditedRound: round,
    }
  }

  /**
   * Gera auditoria completa da organização técnica da equipe para debug e conformidade de save.
   */
  public auditTechnicalOrganization(org: TeamTechnicalOrganization): {
    isValid: boolean
    issues: string[]
    activeRolesCount: number
    vacanciesCount: number
    interimCount: number
    overloadedStaffIds: string[]
  } {
    const issues: string[] = []
    const seenStaffIds = new Set<string>()
    const overloadedStaffIds: string[] = []

    let activeRolesCount = 0
    for (const role of CANONICAL_STAFF_ROLES) {
      const m = org.members[role]
      if (m) {
        activeRolesCount++
        if (seenStaffIds.has(m.staffId)) {
          issues.push(
            `Staff duplicado ocupando mais de um cargo titular simultaneamente: ${m.name} (${m.staffId})`,
          )
          overloadedStaffIds.push(m.staffId)
        }
        seenStaffIds.add(m.staffId)
      }
    }

    const interimCount = Object.keys(org.interimAssignments || {}).length

    return {
      isValid: issues.length === 0,
      issues,
      activeRolesCount,
      vacanciesCount: org.vacancies.length,
      interimCount,
      overloadedStaffIds,
    }
  }

  /**
   * Estima o impacto operacional e financeiro de substituir ou demitir um staff.
   */
  public estimateTransferImpact(
    currentStaff: StaffMember | null,
    targetCandidate: StaffMember | null,
    role: StaffRole,
    facilities: FacilityLevels,
    org: TeamTechnicalOrganization,
  ): StaffTransferImpactEstimate {
    const capsBefore = this.computeCapabilities(facilities, org)
    const baseCapabilityKey: keyof TechnicalCapabilities =
      role === 'HEAD_OF_AERODYNAMICS'
        ? 'aeroCorrelation'
        : role === 'CHIEF_DESIGNER'
          ? 'designCapacity'
          : role === 'HEAD_OF_VEHICLE_PERFORMANCE'
            ? 'simulationAccuracy'
            : role === 'HEAD_OF_STRATEGY'
              ? 'raceOperationsCapability'
              : role === 'ACADEMY_DIRECTOR'
                ? 'talentDevelopmentCapacity'
                : 'developmentThroughput'

    const capabilityBefore = capsBefore[baseCapabilityKey]

    // Simulação com saída (interim)
    const tempDeparted = this.processStaffDeparture(org, role, 2026, 3)
    const capsInterim = this.computeCapabilities(facilities, tempDeparted.updatedOrg)
    const interimCapability = capsInterim[baseCapabilityKey]

    // Simulação com chegada do candidato novo (após adaptação)
    let expectedPost = interimCapability
    let buyout = 0
    if (targetCandidate) {
      const mockCandidate = { ...targetCandidate, adaptation: 100 }
      const tempArrived = this.processStaffArrival(
        tempDeparted.updatedOrg,
        mockCandidate,
        role,
        2026,
        3,
      )
      const capsPost = this.computeCapabilities(facilities, tempArrived)
      expectedPost = capsPost[baseCapabilityKey]
      buyout = targetCandidate.status === 'under_contract' ? 1200000 : 0
    }

    return {
      staffName: targetCandidate ? targetCandidate.name : 'N/A',
      currentRole: role,
      targetRole: role,
      capabilityBefore,
      interimCapability,
      expectedCapabilityPostAdaptation: expectedPost,
      transitionRoundsEstimate: targetCandidate ? Math.ceil((100 - 50) / 5) : 0,
      knowledgeLossPercent: tempDeparted.knowledgeLossPercentage,
      buyoutCost: buyout,
      financialImpactSummary:
        buyout > 0
          ? `Cláusula rescisória estimada em $${(buyout / 1000000).toFixed(1)}M.`
          : 'Agente livre sem custo de rescisão contratual.',
    }
  }
}

export const technicalOrganizationService = new TechnicalOrganizationService()
