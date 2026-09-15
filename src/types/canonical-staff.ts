/**
 * Modelos e Tipos Canônicos de Staff, Organização Técnica & Mercado de Talentos
 * F1 Manager 2026 — Implementação Nº 7B
 *
 * REGRA DE OURO:
 * STAFF NÃO INJETA PERFORMANCE DIRETA NO CARRO.
 * STAFF × INFRASTRUCTURE × PROCESS → CAPABILITY → qualidade/velocidade/precisão/eficiência dos sistemas.
 */

import { TechnicalCapabilities } from './canonical-facilities'

// ==========================================
// 1. OS 9 CARGOS CANÔNICOS (NÃO MAIS, NÃO MENOS)
// ==========================================
export type StaffRole =
  | 'TECHNICAL_DIRECTOR' // Coordenação técnica, throughput de P&D, redução de gargalos
  | 'HEAD_OF_AERODYNAMICS' // CFD, túnel de vento, correlação aero, incerteza de projetos aero
  | 'CHIEF_DESIGNER' // Arquitetura mecânica, packaging, manufacturability, risco de desenvolvimento
  | 'HEAD_OF_VEHICLE_PERFORMANCE' // Simulador, setup convergence, correlação pista↔fábrica, tyre understanding
  | 'HEAD_OF_STRATEGY' // Janelas de pit stop, reação SC/chuva, qualidade de recomendação tática
  | 'SPORTING_DIRECTOR' // Operações de fim de semana, pit crew consistency, processos esportivos
  | 'RACE_ENGINEER_1' // Engenheiro principal do Carro 1 (Driver 1)
  | 'RACE_ENGINEER_2' // Engenheiro principal do Carro 2 (Driver 2)
  | 'ACADEMY_DIRECTOR' // Scouting reach, precisão e confiança de avaliação de jovens (sem truePotential)

export const CANONICAL_STAFF_ROLES: StaffRole[] = [
  'TECHNICAL_DIRECTOR',
  'HEAD_OF_AERODYNAMICS',
  'CHIEF_DESIGNER',
  'HEAD_OF_VEHICLE_PERFORMANCE',
  'HEAD_OF_STRATEGY',
  'SPORTING_DIRECTOR',
  'RACE_ENGINEER_1',
  'RACE_ENGINEER_2',
  'ACADEMY_DIRECTOR',
]

export const ROLE_DISPLAY_NAMES: Record<StaffRole, string> = {
  TECHNICAL_DIRECTOR: 'Diretor Técnico',
  HEAD_OF_AERODYNAMICS: 'Chefe de Aerodinâmica',
  CHIEF_DESIGNER: 'Projetista-Chefe',
  HEAD_OF_VEHICLE_PERFORMANCE: 'Chefe de Performance do Veículo',
  HEAD_OF_STRATEGY: 'Chefe de Estratégia',
  SPORTING_DIRECTOR: 'Diretor Esportivo',
  RACE_ENGINEER_1: 'Engenheiro de Pista (#1)',
  RACE_ENGINEER_2: 'Engenheiro de Pista (#2)',
  ACADEMY_DIRECTOR: 'Diretor da Academia de Pilotos',
}

// ==========================================
// 2. ATRIBUTOS E PESOS DATA-DRIVEN
// ==========================================
export interface StaffAttributes {
  technicalAbility: number // 30-99: rigor e conhecimento conceitual da área
  leadership: number // 30-99: comando, orientação e autoridade técnica
  communication: number // 30-99: clareza na transmissão de dados e feedback
  innovation: number // 30-99: criatividade e busca de soluções inovadoras
  organisation: number // 30-99: documentação, fluxo de processos e throughput
  adaptability: number // 30-99: facilidade de assimilação em novas estruturas
  collaboration: number // 30-99: trabalho interdisciplinar e ausência de atrito
  pressureHandling: number // 30-99: resistência ao estresse em momentos críticos
  experience: number // 30-99: anos e bagagem acumulada na F1
}

export type StaffSpecialty =
  | 'ground_effect'
  | 'low_high_speed_aero'
  | 'cooling_packaging'
  | 'suspension_kinematics'
  | 'mechanical_grip'
  | 'tyre_thermal_management'
  | 'vehicle_dynamics'
  | 'simulation_correlation'
  | 'wet_safety_car_strategy'
  | 'pit_operations'
  | 'driver_development'

export const STAFF_SPECIALTY_LABELS: Record<StaffSpecialty, string> = {
  ground_effect: 'Efeito Solo & Assoalhos',
  low_high_speed_aero: 'Eficiência Aero Alta/Baixa Velocidade',
  cooling_packaging: 'Arrefecimento & Packaging Compacto',
  suspension_kinematics: 'Geometria & Cinemática de Suspensão',
  mechanical_grip: 'Aderência Mecânica & Tração Lenta',
  tyre_thermal_management: 'Gestão Térmica e Degradação de Pneus',
  vehicle_dynamics: 'Dinâmica Veicular & Balanço Geral',
  simulation_correlation: 'Correlação CFD / Simulador / Pista',
  wet_safety_car_strategy: 'Estratégia sob Chuva & Safety Car',
  pit_operations: 'Operações de Boxe & Paradas Rápidas',
  driver_development: 'Lapidação & Avaliação de Jovens Pilotos',
}

/** Pesos data-driven dos atributos para cálculo de rating/effectiveness por função */
export const ROLE_ATTRIBUTE_WEIGHTS: Record<StaffRole, Record<keyof StaffAttributes, number>> = {
  TECHNICAL_DIRECTOR: {
    leadership: 0.25,
    technicalAbility: 0.25,
    organisation: 0.2,
    collaboration: 0.1,
    innovation: 0.1,
    experience: 0.05,
    pressureHandling: 0.05,
    communication: 0.0,
    adaptability: 0.0,
  },
  HEAD_OF_AERODYNAMICS: {
    technicalAbility: 0.35,
    innovation: 0.25,
    collaboration: 0.15,
    organisation: 0.1,
    experience: 0.1,
    pressureHandling: 0.05,
    leadership: 0.0,
    communication: 0.0,
    adaptability: 0.0,
  },
  CHIEF_DESIGNER: {
    technicalAbility: 0.3,
    organisation: 0.25,
    innovation: 0.15,
    collaboration: 0.15,
    experience: 0.1,
    pressureHandling: 0.05,
    leadership: 0.0,
    communication: 0.0,
    adaptability: 0.0,
  },
  HEAD_OF_VEHICLE_PERFORMANCE: {
    technicalAbility: 0.3,
    collaboration: 0.2,
    communication: 0.2,
    pressureHandling: 0.15,
    experience: 0.15,
    leadership: 0.0,
    innovation: 0.0,
    organisation: 0.0,
    adaptability: 0.0,
  },
  HEAD_OF_STRATEGY: {
    pressureHandling: 0.3,
    technicalAbility: 0.25,
    communication: 0.2,
    organisation: 0.15,
    experience: 0.1,
    leadership: 0.0,
    innovation: 0.0,
    adaptability: 0.0,
    collaboration: 0.0,
  },
  SPORTING_DIRECTOR: {
    leadership: 0.3,
    organisation: 0.25,
    pressureHandling: 0.2,
    communication: 0.15,
    experience: 0.1,
    technicalAbility: 0.0,
    innovation: 0.0,
    adaptability: 0.0,
    collaboration: 0.0,
  },
  RACE_ENGINEER_1: {
    communication: 0.3,
    technicalAbility: 0.25,
    collaboration: 0.2,
    pressureHandling: 0.15,
    experience: 0.1,
    leadership: 0.0,
    innovation: 0.0,
    organisation: 0.0,
    adaptability: 0.0,
  },
  RACE_ENGINEER_2: {
    communication: 0.3,
    technicalAbility: 0.25,
    collaboration: 0.2,
    pressureHandling: 0.15,
    experience: 0.1,
    leadership: 0.0,
    innovation: 0.0,
    organisation: 0.0,
    adaptability: 0.0,
  },
  ACADEMY_DIRECTOR: {
    leadership: 0.25,
    technicalAbility: 0.25,
    communication: 0.2,
    organisation: 0.15,
    experience: 0.15,
    pressureHandling: 0.0,
    innovation: 0.0,
    adaptability: 0.0,
    collaboration: 0.0,
  },
}

// ==========================================
// 3. ENTIDADE CANÔNICA StaffMember
// ==========================================
export type StaffMarketStatus =
  | 'available' // Livre no mercado
  | 'under_contract' // Empregado normalmente
  | 'open_to_talks' // Empregado, mas insatisfeito ou contrato acabando
  | 'negotiating' // Em conversa ativa com alguma escuderia
  | 'signed_future' // Assinou pré-contrato para a próxima temporada
  | 'gardening_leave' // Período de quarentena técnica

export interface StaffCareerHistoryEntry {
  seasonYear: number
  teamId: string
  teamName: string
  role: StaffRole
  achievements?: string
}

export interface StaffMember {
  staffId: string
  name: string
  age: number
  nationality: string
  countryFlag: string
  photoUrl?: string
  role: StaffRole
  teamId: string | null // null se agente livre
  reputation: number // 30-99 (independente do rating técnico)
  attributes: StaffAttributes
  specialties: StaffSpecialty[] // 0 a 2 especialidades
  contractId: string | null
  adaptation: number // 0-100 (começa em 40-80 ao chegar)
  morale: number // 30-99 (satisfação e motivação profissional)
  previousTeams: string[]
  careerHistory: StaffCareerHistoryEntry[]
  status: StaffMarketStatus
  isInterim?: boolean // Verdadeiro se for funcionário temporário cobrindo vaga
}

// ==========================================
// 4. CONTRATO DE STAFF & MERCADO
// ==========================================
export type StaffContractStatus = 'active' | 'signed_future' | 'terminated' | 'gardening_leave'

export interface StaffContract {
  contractId: string
  staffId: string
  staffName: string
  teamId: string
  role: StaffRole
  annualSalary: number // Em USD
  startSeason: number
  endSeason: number // Ex: 2026, 2027, etc.
  signingBonus?: number
  buyoutClause?: number // Cláusula rescisória
  status: StaffContractStatus
  confidentiality: 'talks' | 'agreement' | 'signed_confidential' | 'announced'
  futureContract?: {
    nextTeamId: string
    nextRole: StaffRole
    annualSalary: number
    startSeason: number
    endSeason: number
    isConfidential: boolean
  }
}

// ==========================================
// 5. ORGANIZATIONAL KNOWLEDGE & RETENÇÃO
// ==========================================
export type KnowledgeDomain =
  | 'aerodynamics'
  | 'chassis'
  | 'vehicleDynamics'
  | 'simulation'
  | 'strategy'
  | 'operations'
  | 'talentDevelopment'

export interface DomainKnowledgeData {
  accumulatedExperience: number // 10-100 (know-how acumulado)
  documentationQuality: number // 10-100 (processos documentados)
  lastUpdatedSeason: number
}

export interface KnowledgeTransferAuditEntry {
  seasonYear: number
  round: number
  staffId: string
  staffName: string
  role: StaffRole
  eventType: 'departure' | 'arrival'
  domain: KnowledgeDomain
  knowledgeRetainedBefore: number
  knowledgeAfter: number
  lossPercentage: number
  details: string
}

export interface OrganizationalKnowledge {
  domains: Record<KnowledgeDomain, DomainKnowledgeData>
  history: KnowledgeTransferAuditEntry[]
}

// ==========================================
// 6. RELAÇÃO PILOTO-ENGENHEIRO DE PISTA
// ==========================================
export interface DriverRaceEngineerPairing {
  driverId: string
  driverName: string
  engineerStaffId: string
  engineerName: string
  carAssignment: 'car1' | 'car2'
  communication: number // 20-100: clareza das mensagens de rádio
  technicalUnderstanding: number // 20-100: interpretação do feedback de setup
  trust: number // 20-100: obediência mútua e tranquilidade
  chemistry: number // 20-100: sintonia geral combinada
  experienceTogetherRounds: number // Aumenta com cada fim de semana compartilhado
  adaptationPeriodActive: boolean
}

// ==========================================
// 7. ESTRUTURA ORGANIZACIONAL DA EQUIPE
// ==========================================
export interface TeamTechnicalOrganization {
  teamId: string
  seasonYear: number
  members: Record<StaffRole, StaffMember | null>
  vacancies: StaffRole[]
  interimAssignments: Partial<Record<StaffRole, { interimStaffId: string; primaryRole: StaffRole }>>
  knowledge: OrganizationalKnowledge
  driverEngineerPairings: {
    car1: DriverRaceEngineerPairing | null
    car2: DriverRaceEngineerPairing | null
  }
  collaborationFit: number // 20-100: sinergia interna entre diretores
  organizationalHealthScore: number // 20-100: resumo de estabilidade e liderança
  lastAuditedRound?: number
}

// ==========================================
// 8. EXPLICABILIDADE E TELEMETRIA (DEBUG/QA/UI)
// ==========================================
export interface CapabilityExplanation {
  capabilityId: keyof TechnicalCapabilities
  finalScore: number
  descriptor: 'Critical' | 'Weak' | 'Adequate' | 'Strong' | 'Excellent'
  infrastructureFactor: number
  staffFactor: number
  organizationalFitFactor: number
  bottleneckDetected?: {
    isBottleneck: boolean
    limitingElement: string
    explanation: string
  }
}

export interface StaffTransferImpactEstimate {
  staffName: string
  currentRole: StaffRole
  targetRole: StaffRole
  capabilityBefore: number
  interimCapability: number
  expectedCapabilityPostAdaptation: number
  transitionRoundsEstimate: number
  knowledgeLossPercent: number
  buyoutCost: number
  financialImpactSummary: string
}
