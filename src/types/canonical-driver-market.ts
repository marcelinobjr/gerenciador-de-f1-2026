/**
 * TIPOS CANÔNICOS DE CONTRATOS, MERCADO DE PILOTOS & SILLY SEASON (7A)
 * F1 Manager 2026 — Implementação Nº 7A
 *
 * Princípios e Regras de Ouro:
 * 1. Nenhum piloto escolhe equipe apenas pelo maior salário.
 * 2. Personalidade e histórico afetam o mercado (maus-tratos importam).
 * 3. Contrato assinado ≠ Contrato anunciado (Verdade do sistema vs Visão pública).
 * 4. O mercado é uma rede — contratação abre vaga que puxa outra em cascata.
 * 5. A IA não tem acesso ao truePotential nem ao futuro.
 * 6. Academy é fonte de talentos, não prisão.
 * 7. Todo signing bonus, salário e buyout passam pelo FinancialLedger (5A).
 * 8. Pilotos têm agência real: negociam, recusam, exigem promessas e contrapropoem.
 */

import { DriverPromise } from './driver-psychology'

// ============================================================================
// 1. PAPÉIS CONTRATUAIS
// ============================================================================

export type DriverContractRole =
  | 'LEAD_DRIVER' // Prioridade esportiva, mas sem imunidade (pode ser superado ou perder status)
  | 'EQUAL_STATUS' // Paridade esportiva declarada; se tratado como nº 2 sucessivamente, gera quebra de expectativa
  | 'SUPPORT_DRIVER' // Segundo piloto com foco de apoio à equipe
  | 'RESERVE' // Piloto reserva ativo para substituições e treinos livres (FP1)
  | 'TEST_DEVELOPMENT' // Piloto de desenvolvimento focado em simulador e testes

// ============================================================================
// 2. STATUS DE ANÚNCIO E CONFIDENCIALIDADE
// ============================================================================

export type ContractAnnouncementStatus =
  | 'RUMOR' // Boatos ou especulações circulando no paddock
  | 'PRIVATE_TALKS' // Conversas privadas/sondagens sem vazamento público
  | 'AGREEMENT_IN_PRINCIPLE' // Acordo verbal fechado entre piloto e equipe
  | 'SIGNED_CONFIDENTIAL' // Contrato formalmente assinado no backend, mantido em segredo do paddock
  | 'ANNOUNCED' // Anúncio oficial público comunicado aos fãs e à imprensa

// ============================================================================
// 3. CLÁUSULAS E BÔNUS DE DESEMPENHO
// ============================================================================

export interface ContractPerformanceBonus {
  type: 'win' | 'podium' | 'points' | 'championship' | 'championship_top3'
  amount: number // em USD (ou moeda padrão)
  description: string
}

export interface ContractOptionClause {
  available: boolean
  exercised: boolean
  expired: boolean
  deadlineRound: number // Rodada limite na temporada para ativação da opção (ex: round 18)
  extensionYears: number
  salaryIncreasePct: number
}

export interface ContractBuyoutClause {
  hasBuyout: boolean
  buyoutAmount: number // Valor para rescisão unilateral por rival ou dispensa
  restrictedToTopTeams?: boolean
}

// ============================================================================
// 4. ENTIDADE PRINCIPAL — DriverContract
// ============================================================================

export interface DriverContract {
  contractId: string
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  role: DriverContractRole
  startSeason: number
  endSeason: number
  annualSalary: number
  signingBonus: number
  performanceBonuses: ContractPerformanceBonus[]
  teamOption: ContractOptionClause
  driverOption: ContractOptionClause
  buyoutClause: ContractBuyoutClause
  status: 'active' | 'future_pending' | 'expired' | 'terminated' | 'bought_out'
  signedDate: string
  announcementStatus: ContractAnnouncementStatus
  writtenPromises: DriverPromise[] // Promessas formalizadas em contrato (pesam mais que conversa de bar)
  equipmentStatus: 'equal' | 'priority' | 'secondary'
  metadata?: Record<string, any>
}

// ============================================================================
// 5. CAREER INTENT (Derivado, nunca salvo como verdade imutável)
// ============================================================================

export type CareerIntentState =
  | 'COMMITTED' // 100% focado no projeto atual, rejeita saídas normais
  | 'CONTENT' // Feliz e estável, mas ouviria propostas extraordinárias
  | 'OPEN_TO_TALKS' // Receptivo a sondagens e projetos ambiciosos
  | 'EXPLORING_OPTIONS' // Em busca ativa de alternativas para o próximo ciclo
  | 'LOOKING_TO_LEAVE' // Desejo explícito de sair devido a carro fraco, maus-tratos ou promessas quebradas
  | 'DETERMINED_TO_LEAVE' // Decisão irrevogável de sair; rejeita renovação mesmo com salário dobrado

export interface CareerIntentBreakdown {
  state: CareerIntentState
  qualitativeReason: string
  desireToStayScore: number // 0 a 100 (interno, não exibir % exato na UI)
  marketScarcityImpact: number
  financialSatisfaction: number
  competitivenessSatisfaction: number
  treatmentSatisfaction: number
  loyaltyAnchor: number
  ambitionDrive: number
}

// ============================================================================
// 6. TEAM CAREER ATTRACTIVENESS (Específica por piloto)
// ============================================================================

export interface TeamCareerAttractivenessBreakdown {
  teamId: string
  teamName: string
  overallScore: number // 0 a 100
  factors: {
    competitiveness: number // Força atual percebida do carro
    recentTrajectory: number // Tendência esportiva recente
    infrastructureScore: number // Fábrica, simulador e túnel de vento
    financialPower: number // Capacidade orçamentária e estabilidade
    seatOpportunity: number // Vaga disponível + papel oferecido
    teammatePairingFit: number // Relação com o provável companheiro
    teamPrincipalPrestige: number // Gestão e reputação do chefe
    historicalRelationship: number // Histórico anterior com a equipe
    titleContentionProspect: number // Chance plausível de vencer títulos
    commercialSecondary: number // Valor comercial secundário
  }
  qualitativeSummary: string
}

// ============================================================================
// 7. OFERTA E NEGOCIAÇÃO DE CONTRATO
// ============================================================================

export type NegotiationStage =
  | 'INTEREST' // Observação e manifestação de interesse preliminar
  | 'CONTACT' // Contato inicial entre dirigentes e agentes
  | 'TALKS' // Sondagem de expectativas e termos
  | 'NEGOTIATION' // Troca de propostas e contrapropostas
  | 'OFFER_SUBMITTED' // Oferta formal na mesa com prazo de expiração
  | 'COUNTEROFFER_RECEIVED' // Piloto solicitou ajustes
  | 'AGREEMENT' // Acordo firmado
  | 'REJECTED' // Recusado pelo piloto ou pela equipe
  | 'EXPIRED' // Expirou o prazo sem resposta

export interface DriverContractOffer {
  offerId: string
  teamId: string
  teamName: string
  driverId: string
  driverName: string
  annualSalary: number
  durationYears: number
  role: DriverContractRole
  signingBonus: number
  performanceBonuses: ContractPerformanceBonus[]
  teamOptionIncluded: boolean
  driverOptionIncluded: boolean
  buyoutAmount: number
  importantPromise?: DriverPromise
  offeredSeason: number
  startSeason: number // Pode ser temporada atual ou próxima (future contract)
  expirationRound: number // Rodada em que a oferta vence
  status: NegotiationStage
  isConfidential: boolean
  roundsOfTalks: number // Limite de paciência contra exploit de pequenos acréscimos
  driverPatienceRemaining: number // 0 a 5
}

export type NegotiationOfferAssessment =
  | 'strong' // Muito acima do esperado; piloto empolgado
  | 'competitive' // Justa e atrativa; tendência de acordo
  | 'uncertain' // Tem pontos positivos, mas exige concessões
  | 'weak' // Abaixo do valor de mercado; risco de irritar o piloto
  | 'unacceptable' // Ofensiva ou inviável; encerra negociação

export interface CounterofferTerms {
  requestedSalary: number
  requestedDurationYears: number
  requestedRole: DriverContractRole
  requestedSigningBonus: number
  requestedOption: 'none' | 'team' | 'driver'
  requestedPromise?: DriverPromise
  assessment: NegotiationOfferAssessment
  driverMessage: string
}

export interface EstimatedMarketValueRange {
  minAnnualSalary: number
  maxAnnualSalary: number
  displayRange: string // Ex: "R$ 18.000.000 — R$ 24.000.000 / ano"
  perceivedDemandLevel: 'low' | 'moderate' | 'high' | 'very_high'
}

// ============================================================================
// 8. SILLY SEASON & GRID RESERVATION
// ============================================================================

export interface GridSeatStatus {
  teamId: string
  teamName: string
  teamColor: string
  seasonYear: number
  seat1: {
    driverId?: string
    driverName?: string
    status: 'confirmed' | 'rumored' | 'negotiating' | 'expiring' | 'open'
    isConfidential: boolean
    publicDisplay: string
  }
  seat2: {
    driverId?: string
    driverName?: string
    status: 'confirmed' | 'rumored' | 'negotiating' | 'expiring' | 'open'
    isConfidential: boolean
    publicDisplay: string
  }
  reserveSeat: {
    driverId?: string
    driverName?: string
    status: 'confirmed' | 'open' | 'rumored'
    publicDisplay: string
  }
}

export interface SillySeasonRumor {
  id: string
  driverName: string
  targetTeamName: string
  credibility: 'weak' | 'credible' | 'strong'
  headline: string
  details: string
  roundReported: number
  isConfidentialLeak: boolean
}

// ============================================================================
// 9. DOMAIN EVENTS DO MERCADO DE PILOTOS
// ============================================================================

export type DriverMarketDomainEventType =
  | 'DriverContractSigned'
  | 'DriverRenewed'
  | 'DriverSignedForFutureSeason'
  | 'DriverLeavingTeam'
  | 'DriverReleased'
  | 'DriverBecameFreeAgent'
  | 'DriverBuyoutTriggered'
  | 'DriverNegotiationBroken'

export interface DriverMarketDomainEvent {
  id: string
  type: DriverMarketDomainEventType
  driverId: string
  driverName: string
  teamId?: string
  teamName?: string
  priorTeamId?: string
  priorTeamName?: string
  seasonYear: number
  round: number
  isConfidential: boolean
  announcementText?: string
  financialImpact?: {
    salary: number
    signingBonus?: number
    buyout?: number
  }
  metadata?: Record<string, any>
}
