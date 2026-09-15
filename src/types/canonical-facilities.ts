/**
 * Modelos e Tipos Canônicos de Infraestrutura Técnica e Organizacional
 * F1 Manager 2026 — Implementação Nº 4A
 *
 * Princípio Fundamental: INFRAESTRUTURA ≠ PERFORMANCE DIRETA.
 * Determina capacidade, precisão, velocidade, volume, qualidade de processo,
 * correlação, alcance e eficiência — mas NÃO altera diretamente velocidade de carro,
 * sucesso automático de projeto ou qualidade intrínseca de piloto descoberto.
 */

// ==========================================
// 1. AS 9 INSTALAÇÕES CANÔNICAS
// ==========================================

export type CanonicalFacilityId =
  | 'factory' // Fábrica de Engenharia & Sede Central
  | 'design_centre' // Centro de Design & Escritório de Projetos
  | 'cfd' // Cluster Computacional de Dinâmica de Fluidos (CFD)
  | 'wind_tunnel' // Túnel de Vento Aerodinâmico (Escala 60%)
  | 'manufacturing' // Centro de Manufatura Aditiva & Compósitos
  | 'simulator' // Simulador Dinâmico de Pilotos 6-DOF
  | 'operations_centre' // Centro de Operações de Corrida & Pit Wall Remoto
  | 'pitstop_center' // Centro de Treinamento de Paradas nos Boxes
  | 'youth_academy' // Academia de Desenvolvimento & Scouting de Pilotos

/** Nomes de colunas legadas / novas em PocketBase para cada instalação */
export type FacilityTeamField =
  | 'factory_level'
  | 'design_centre_level'
  | 'cfd_level'
  | 'wind_tunnel_level'
  | 'manufacturing_level'
  | 'simulator_level'
  | 'operations_centre_level'
  | 'pitstop_center_level'
  | 'youth_academy_level'

/** Mapa canônico de ID para coluna no banco */
export const FACILITY_FIELD_MAP: Record<CanonicalFacilityId, FacilityTeamField> = {
  factory: 'factory_level',
  design_centre: 'design_centre_level',
  cfd: 'cfd_level',
  wind_tunnel: 'wind_tunnel_level',
  manufacturing: 'manufacturing_level',
  simulator: 'simulator_level',
  operations_centre: 'operations_centre_level',
  pitstop_center: 'pitstop_center_level',
  youth_academy: 'youth_academy_level',
}

/** Objeto com os níveis das 9 instalações */
export type FacilityLevels = Record<CanonicalFacilityId, number>

// ==========================================
// 2. CAPABILITIES TÉCNICAS E ORGANIZACIONAIS
// ==========================================

export interface TechnicalCapabilities {
  // P&D / Engenharia (Fase 4B)
  designCapacity: number // Capacidade e profundidade de novos conceitos (0-100)
  simulationAccuracy: number // Precisão e confiança dos testes virtuais em CFD (0-100)
  aeroCorrelation: number // Correlação entre simulação virtual, túnel e pista real (0-100)
  developmentThroughput: number // Volume e velocidade simultânea de projetos de P&D (0-100)

  // Fabricação & Produção Física (Design -> Physical Part)
  manufacturingCapacity: number // Velocidade e capacidade de produção física de peças (0-100)
  manufacturingQuality: number // Rigor dimensional, consistência e tolerância a defeito (0-100)

  // Operações de Corrida & Eficiência Organizacional
  operationalEfficiency: number // Eficiência logística, coordenação interna e custos (0-100)
  raceOperationsCapability: number // Qualidade da informação de pit wall, telemetria e dados (0-100)
  pitCrewPerformance: number // Eficiência, consistência e taxa de erro da equipe de box (0-100)

  // Academia, Scouting e Talentos (Fase 4C)
  scoutingReach: number // Alcance geográfico e profundidade da rede de olheiros (0-100)
  prospectDiscoveryCapacity: number // Capacidade de rastrear e prospectar múltiplos jovens (0-100)
  evaluationAccuracy: number // Precisão com que o potencial e atributos reais são estimados (0-100)
  talentDevelopmentCapacity: number // Capacidade de lapidação e ganho técnico no programa (0-100)
  academySupportQuality: number // Qualidade da infraestrutura de treino e adaptação física (0-100)
  prospectRetentionCapability: number // Capacidade institucional de reter promessas (0-100)
}

/** Diagnóstico de Sinergias e Gargalos */
export interface InfrastructureBottleneck {
  domain: 'aero_pnd' | 'manufacturing_bridge' | 'race_operations' | 'talent_academy'
  title: string
  description: string
  weakFacilityId: CanonicalFacilityId
  weakFacilityLevel: number
  strongFacilityId: CanonicalFacilityId
  strongFacilityLevel: number
  penaltyPercent: number // Penalidade aplicada na capability derivada (ex: -15%)
}

export interface InfrastructureSynergy {
  title: string
  description: string
  involvedFacilities: CanonicalFacilityId[]
  bonusPercent: number // Bônus obtido por harmonia de instalações (ex: +5%)
}

/** Resultado consolidado da auditoria de infraestrutura */
export interface InfrastructureAuditResult {
  facilityLevels: FacilityLevels
  averageLevel: number
  capabilities: TechnicalCapabilities
  bottlenecks: InfrastructureBottleneck[]
  synergies: InfrastructureSynergy[]
  technicalBottleneckName?: string
  academyBottleneckName?: string
  managerTechnicalModifier: number // Vindo estritamente do ManagerEffectService (ex: +0.032)
  managerTalentModifier: number // Vindo estritamente do ManagerEffectService (ex: +0.045)
  totalAnnualOpex: number // Custo operacional recorrente total por ano (R$)
  roundOpex: number // Custo operacional debitado por rodada (R$)
  telemetrySummary: string
}

// ==========================================
// 3. CAPEX, OPEX E UPGRADES NO TEMPO
// ==========================================

export interface FacilityUpgradeCostSpec {
  targetLevel: number // 2, 3, 4, 5
  capexCost: number // Custo de investimento / construção (R$)
  durationRounds: number // Duração da obra em rodadas da temporada (ex: 2 a 5 rodadas)
  opexAnnualIncrease: number // Aumento no custo operacional anual pós-conclusão (R$)
  subjectToCostCap: boolean // Se este CAPEX entra no Cost Cap da FIA (F1 2026: CAPEX possui teto separado ou entra com depreciação)
}

export interface FacilityDefinition {
  id: CanonicalFacilityId
  teamField: FacilityTeamField
  name: string
  shortName: string
  subtitle: string
  description: string
  iconName:
    | 'Building2'
    | 'PencilRuler'
    | 'Cpu'
    | 'Wind'
    | 'Factory'
    | 'Monitor'
    | 'Radio'
    | 'Gauge'
    | 'GraduationCap'
  accentColor: string
  levelLabels: [string, string, string, string, string]
  benefitsSummary: string
  primaryCapabilitiesText: string
  effects: {
    title: string
    description: string
    gameplayBonusDescription: string
    formulaDetail: string
  }[]
  upgrades: Record<number, FacilityUpgradeCostSpec> // Níveis 2 a 5
  baseAnnualOpex: number // OPEX anual no nível 1
}

/** Projeto de Obra Ativo (Persistência no Save) */
export interface FacilityUpgradeProject {
  facilityId: CanonicalFacilityId
  fromLevel: number
  targetLevel: number
  capexCost: number
  startedAtRound: number
  completionRound: number // Round em que a obra será entregue
  status: 'em_construcao' | 'concluido'
  isCapexPaid: boolean
}

// ==========================================
// 4. PILOTOS PROCEDURAIS E CONTRATOS FUTUROS (4C PREVIEW)
// ==========================================

export interface ProceduralDriverIdentity {
  driverId: string
  firstName: string
  lastName: string
  fullName: string
  dateOfBirth: string
  age: number
  nationality: string
  countryFlag: string
  preferredNumber?: number
  category: 'f2' | 'f3' | 'karting' | 'f1_academy' | 'mercado'
  originTeamOrAcademyId?: string
  careerStatus:
    | 'prospect'
    | 'academy'
    | 'test_driver'
    | 'reserve'
    | 'f1_driver'
    | 'free_agent'
    | 'retired'

  // Perfil Técnico e Psicológico
  personality: 'focado' | 'ambicioso' | 'metodico' | 'impulsivo' | 'resiliente'
  drivingStyle: 'agressivo' | 'suave' | 'calculista' | 'adaptavel'
  strengths: string[]
  weaknesses: string[]

  // Avaliação & Potencial Oculto
  truePotential: number // Oculto da visão direta do jogador (60-99)
  perceivedPotential: number // Estimado pela Academia da equipe (influenciado pela evaluationAccuracy)
  evaluationConfidence: number // Grau de confiança da estimativa da equipe (0.0 a 1.0)
  technicalAttributes: {
    speed: number
    consistency: number
    rain: number
    defense: number
    tyreManagement: number
    technicalFeedback: number
    qualifyingPace: number
  }

  // Identidade Visual e Imagem por IA (Isolamento Arquitetural)
  visualIdentity: {
    visualIdentityId: string
    portraitAssetId?: string
    posterAssetId?: string
    faceFeaturesPrompt?: string
    hairStyle?: string
    skinTone?: string
    helmetDesignId?: string
  }
}
