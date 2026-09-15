/**
 * Canonical Types for Implementation 5B: Commercial, Sponsors & Contracts
 * Gerenciador de F1 2026/2027
 *
 * 6 REGRAS DE OURO:
 * 1. Patrocínio é importante. Não é dinheiro infinito.
 * 2. O valor do espaço depende da visibilidade e da força comercial da equipe.
 * 3. Title Sponsor é um status contratual, não um sexto espaço.
 * 4. Todo pagamento de sponsor passa pelo Financial Ledger da 5A.
 * 5. Resultado esportivo aumenta o valor comercial gradualmente. Não duplica da noite pro dia.
 * 6. Um bom Team Principal comercial melhora a negociação. Ele não cria dinheiro sem contraparte.
 */

// Os 5 espaços canônicos do carro (NÃO criar sexto slot)
export type CanonicalSponsorSlot =
  | 'sidepod' // Lateral / Sidepod (Master)
  | 'engine_cover' // Tampa do Motor / Engine Cover
  | 'rear_wing' // Asa Traseira / Rear Wing
  | 'nose' // Bico / Nose
  | 'front_wing' // Asa Dianteira / Front Wing

export interface SponsorSlotMeta {
  slot: CanonicalSponsorSlot
  name: string
  description: string
  weight: number // 1.00, 0.85, 0.75, 0.55, 0.45
  baseAnchors: {
    backmarker: { min: number; max: number } // R$ M
    midfield: { min: number; max: number }
    topTeam: { min: number; max: number }
  }
}

export const CANONICAL_SLOT_METAS: Record<CanonicalSponsorSlot, SponsorSlotMeta> = {
  sidepod: {
    slot: 'sidepod',
    name: 'Lateral / Sidepod',
    description: 'Espaço nobre master lateral de máxima visibilidade em câmeras de percurso.',
    weight: 1.0,
    baseAnchors: {
      backmarker: { min: 6_000_000, max: 10_000_000 },
      midfield: { min: 12_000_000, max: 18_000_000 },
      topTeam: { min: 22_000_000, max: 30_000_000 },
    },
  },
  engine_cover: {
    slot: 'engine_cover',
    name: 'Tampa do Motor / Engine Cover',
    description: 'Posição proeminente sobre a carenagem traseira com exposição contínua.',
    weight: 0.85,
    baseAnchors: {
      backmarker: { min: 5_000_000, max: 8_000_000 },
      midfield: { min: 10_000_000, max: 15_000_000 },
      topTeam: { min: 18_000_000, max: 24_000_000 },
    },
  },
  rear_wing: {
    slot: 'rear_wing',
    name: 'Asa Traseira / Rear Wing',
    description:
      'Posição aerodinâmica nobre em disputas diretas e câmeras on-board de perseguição.',
    weight: 0.75,
    baseAnchors: {
      backmarker: { min: 4_000_000, max: 7_000_000 },
      midfield: { min: 9_000_000, max: 13_000_000 },
      topTeam: { min: 16_000_000, max: 21_000_000 },
    },
  },
  nose: {
    slot: 'nose',
    name: 'Bico / Nose',
    description: 'Bico dianteiro e cone frontal com visibilidade frontal constante e grid walk.',
    weight: 0.55,
    baseAnchors: {
      backmarker: { min: 3_000_000, max: 5_000_000 },
      midfield: { min: 6_000_000, max: 9_000_000 },
      topTeam: { min: 10_000_000, max: 15_000_000 },
    },
  },
  front_wing: {
    slot: 'front_wing',
    name: 'Asa Dianteira / Front Wing',
    description: 'Flaps e endplates da asa dianteira capturados em câmeras de mergulho.',
    weight: 0.45,
    baseAnchors: {
      backmarker: { min: 2_000_000, max: 4_000_000 },
      midfield: { min: 5_000_000, max: 8_000_000 },
      topTeam: { min: 8_000_000, max: 12_000_000 },
    },
  },
}

// Setores Canônicos
export type SponsorSector =
  | 'bancos'
  | 'fintech'
  | 'tecnologia'
  | 'telecom'
  | 'energia'
  | 'automotivo'
  | 'logistica'
  | 'aviacao'
  | 'moda_luxo'
  | 'bebidas_nao_alcoolicas'
  | 'software'
  | 'industrial'
  | 'seguros'
  | 'varejo'

// Tipos de Parceria
export type PartnershipType =
  | 'title_sponsor'
  | 'main_partner'
  | 'official_partner'
  | 'technical_partner'
  | 'regional_partner'
  | 'driver_linked_partner'

// Entidade Canônica de Patrocinador (Sponsor)
export interface CanonicalSponsor {
  sponsorId: string
  name: string
  country: string
  region: string
  sector: SponsorSector
  budgetTier: 'enterprise' | 'major' | 'regional' | 'emerging'
  targetMarkets: string[] // Países/regiões prioritárias
  preferredExposure: 'alta' | 'media' | 'baixa'
  preferredTeamProfile: 'campea' | 'tradicional' | 'inovadora' | 'qualquer'
  riskTolerance: 'conservador' | 'moderado' | 'arrojado'
  performanceExpectation: 'top3' | 'top5' | 'top8' | 'pontuar' | 'livre'
  contractPreferenceYears: number // 1 a 5
  brandingAssets?: {
    logoUrl?: string
    primaryColor?: string
    accentColor?: string
  }
}

// Cláusulas e Metas de Desempenho
export type BonusTriggerType =
  | 'victory'
  | 'podium'
  | 'pole'
  | 'points'
  | 'q3_appearance'
  | 'constructors_top3'
  | 'constructors_top5'
  | 'home_race_podium'

export interface ContractBonusClause {
  id: string
  trigger: BonusTriggerType
  rewardAmount: number // BRL
  description: string
  achievedCount?: number
  maxPayoutsPerSeason?: number
}

export interface ContractObjectiveClause {
  id: string
  type: 'bonus_objective' | 'contract_expectation' | 'mandatory_clause'
  description: string
  targetValue: number | string
  currentValue?: number | string
  status: 'pending' | 'achieved' | 'failed'
  penaltyDescription?: string
}

export interface DriverLinkedClause {
  driverId: string
  driverName: string
  reductionPercentIfLeaves: number // ex: 25%
  mayTerminateIfLeaves: boolean
}

// Entidade Canônica de Contrato de Patrocínio
export interface SponsorshipContract {
  contractId: string
  sponsorId: string
  sponsorName: string
  teamId: string
  seasonStart: number
  seasonEnd: number // seasonStart + duration - 1
  slot: CanonicalSponsorSlot // Slot primário
  packageSlots?: CanonicalSponsorSlot[] // Slots adicionais se pacote multi-slot
  fixedAnnualValue: number // BRL / ano
  valuePerRound: number // fixedAnnualValue / 24
  paymentSchedule: 'per_round' | 'signing_and_periodic'
  bonuses: ContractBonusClause[]
  objectives: ContractObjectiveClause[]
  exclusivitySector?: SponsorSector // Exclusividade setorial
  partnershipType: PartnershipType
  isTitleSponsor: boolean
  titleNameSuffix?: string // ex: "Audi XYZ Formula One Team"
  driverLinkedClause?: DriverLinkedClause
  satisfaction: number // 0-100
  renewalInterest: number // 0-100
  status: 'ativo' | 'suspenso' | 'encerrado' | 'proposta'
  signingDate: string
  clauses?: Record<string, any>
}

// Atratividade Comercial Canônica
export interface TeamCommercialAttractiveness {
  score: number // 0 a 100
  prestige: number
  recentResultsMomentum: number
  championshipStanding: number
  driverStarPower: number
  brandHistory: number
  marketReach: number
  teamPrincipalImpact: number // via managerEffectService
  tier: 'fundo' | 'intermediaria' | 'ponta'
  commercialMultiplier: number // ~0.65 a 1.45 (limitado)
  explanation: string
}

// Negociação Comercial
export interface NegotiationState {
  id: string
  sponsorId: string
  sponsorName: string
  slot: CanonicalSponsorSlot
  packageSlots?: CanonicalSponsorSlot[]
  partnershipType: PartnershipType
  isTitleSponsor: boolean
  titleNameSuffix?: string
  sector: SponsorSector
  country: string
  // Proposta inicial do patrocinador
  initialOffer: {
    fixedAnnualValue: number
    durationYears: number
    exclusivity: boolean
    bonuses: ContractBonusClause[]
    objectives: ContractObjectiveClause[]
  }
  // Proposta corrente do patrocinador
  currentSponsorOffer: {
    fixedAnnualValue: number
    durationYears: number
    exclusivity: boolean
    bonuses: ContractBonusClause[]
    objectives: ContractObjectiveClause[]
  }
  // Última contraproposta do jogador (se houver)
  playerCounterOffer?: {
    fixedAnnualValue: number
    durationYears: number
    exclusivity: boolean
    bonuses: ContractBonusClause[]
    objectives: ContractObjectiveClause[]
  }
  roundsCount: number
  maxRounds: number
  patienceRemaining: number // 0-100
  rejectionRisk: 'muito_baixo' | 'baixo' | 'moderado' | 'alto' | 'critico'
  qualitativeInterest: 'muito_alto' | 'alto' | 'moderado' | 'frio' | 'encerrado'
  status: 'open' | 'accepted' | 'rejected' | 'expired'
  createdAtRound: number
  expiresAtRound: number
}

// Resultado da Auditoria Comercial
export interface CommercialIntegrityReport {
  teamId: string
  seasonYear: number
  commercialAttractiveness: number
  teamMultiplier: number
  managerCommercialEffectFraction: number
  managerCommercialEffectPercent: string
  slotsBreakdown: {
    slot: CanonicalSponsorSlot
    slotName: string
    isOccupied: boolean
    sponsorName?: string
    baseMarketValueAnnual: number
    teamEffectAnnual: number
    sponsorFitPercent: string
    negotiationPercent: string
    contractAnnualValue: number
    isTitleSponsor: boolean
  }[]
  totalFixedSponsorshipAnnual: number
  totalVariableUpsidePotential: number
  financialLedgerIntegrity: 'PASS' | 'WARN' | 'FAIL'
  duplicatePayments: number
  slotConflicts: number
  exclusivityConflicts: number
  issues: string[]
  debugTelemetryString: string
}
