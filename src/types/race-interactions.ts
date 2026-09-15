/**
 * IMPLEMENTAÇÃO Nº 6B — RACE INTERACTIONS, RÁDIO & ORDENS DE EQUIPE
 * Tipos canônicos para interações de corrida, ordens de equipe, pedidos de piloto e reações estruturadas.
 *
 * Princípios Fundamentais:
 * 1. Rádio é consequência do estado do piloto, não gerador aleatório de frases.
 * 2. Obedecer não significa concordar (ACCEPT_RELUCTANTLY cria memória negativa).
 * 3. Recusar é raro e explicável (combinação extrema de ambição, ego, baixa confiança e ordem prejudicial).
 * 4. Piloto também tem voz (driver requests baseados em telemetria real).
 * 5. Consequência psicológica depende do resultado subsequente (ex: pedido de pit negado + resultado).
 * 6. Simular e Acompanhar compartilham o mesmo universo e fundação psicológica.
 * 7. Lógica estruturada primeiro, templates textuais depois.
 */

import {
  DriverPersonalityTraits,
  DriverEmotionalState,
  DriverRelationships,
  DriverMemoryEvent,
  DriverPromise,
} from './driver-psychology'
import { TireCompound } from './f1'

// ============================================================================
// 1. TIPOS DE REAÇÃO CANÔNICOS (Conjunto estável e pequeno)
// ============================================================================
export type RaceReactionType = 'ACCEPT' | 'ACCEPT_RELUCTANTLY' | 'QUESTION' | 'RESIST' | 'REFUSE'

// ============================================================================
// 2. ORDENS DE EQUIPE (Team Orders)
// ============================================================================
export type TeamOrderType =
  | 'LET_TEAMMATE_PASS'
  | 'HOLD_POSITION'
  | 'DO_NOT_FIGHT'
  | 'ATTACK'
  | 'PUSH'
  | 'MANAGE_TYRES'
  | 'EXTEND_STINT'
  | 'BOX_THIS_LAP'
  | 'STAY_OUT'
  | 'CHANGE_STRATEGY'

export type TeamOrderReason =
  | 'DIFFERENT_STRATEGY'
  | 'CHAMPIONSHIP_PRIORITY'
  | 'FASTER_TEAMMATE'
  | 'DAMAGE'
  | 'TYRE_OFFSET'
  | 'TEAM_RESULT'
  | 'PACE_MANAGEMENT'
  | 'TECHNICAL_PRESERVATION'

export interface TeamOrderPayload {
  orderId: string
  orderType: TeamOrderType
  targetDriverId: string
  teammateId?: string
  reason: TeamOrderReason
  reasonDetails?: string
  lap: number
  round: number
  season: number
  targetCompound?: TireCompound
  pitWindowLap?: number
  isFollowUp?: boolean
}

// ============================================================================
// 3. PEDIDOS DO PILOTO (Driver Requests)
// ============================================================================
export type DriverRequestType =
  | 'REQUEST_PIT'
  | 'REQUEST_ATTACK'
  | 'REQUEST_POSITION_SWAP'
  | 'REPORT_TYRE_DROP'
  | 'REPORT_DAMAGE'
  | 'REPORT_BALANCE_ISSUE'
  | 'REPORT_WEATHER_CHANGE'
  | 'QUESTION_STRATEGY'

export interface DriverRequestPayload {
  requestId: string
  requestType: DriverRequestType
  driverId: string
  driverName: string
  lap: number
  round: number
  season: number
  telemetryContext: {
    tireWear: number
    isInCliff: boolean
    tyreCompound: TireCompound
    gapFrontSec?: number
    gapBehindSec?: number
    position: number
    engineWear?: number
    hasWingDamage?: boolean
    trackCondition?: string
    lapTimeDeltaSec?: number
  }
  urgency: 'low' | 'medium' | 'high' | 'critical'
  accuracy: number // 0-100 baseada em technicalFeedback + experiência
  perceivedIssue: string
}

export type TeamResponseToRequest = 'ACCEPT_REQUEST' | 'DENY_REQUEST' | 'REQUEST_MORE_LAPS'

// ============================================================================
// 4. CONTEXTO COMPLETO DE INTERAÇÃO NA CORRIDA
// ============================================================================
export interface RaceInteractionContext {
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  isPlayerTeam: boolean
  round: number
  season: number
  circuitId: string
  currentLap: number
  totalLaps: number
  position: number
  gridTotal: number

  // Companheiro
  teammateId?: string
  teammateName?: string
  teammatePosition?: number
  gapToTeammateSec?: number
  isTeammateAhead?: boolean
  teammateTireCompound?: TireCompound
  teammateTireWear?: number
  teammateHasPitted?: boolean
  driverHasPitted?: boolean

  // Pneus e Carro
  tireCompound: TireCompound
  tireWear: number
  isInCliff: boolean
  carPerformanceScore?: number
  hasDamage?: boolean

  // Campeonato e Contrato
  championshipPointsDriver?: number
  championshipPointsTeammate?: number
  championshipRankDriver?: number
  championshipRankTeammate?: number
  isChampionshipContender?: boolean
  isTeammateChampionshipContender?: boolean
  seatSecurity?: number
  isNumberOneStatusActive?: boolean

  // Manager (Pit Wall)
  managerArchetypeId?: string
  managerRaceManagement?: number // 0-100
  managerPeopleManagement?: number // 0-100

  // Clima
  weatherState: string
}

// ============================================================================
// 5. RESULTADO DA AVALIAÇÃO DE INTERAÇÃO
// ============================================================================
export interface InteractionEvaluationResult {
  interactionId: string
  driverId: string
  reactionType: RaceReactionType
  actionApplied: boolean // Se a ação mecânica entra em vigor
  executionLatencySectors: number // 0, 1 ou 2 setores de atraso
  radioMessageText: string // Frase contextual final do rádio
  radioTone: 'obedient' | 'professional' | 'reluctant' | 'questioning' | 'resistant' | 'combative'

  // Follow-up
  followUpAllowed: boolean
  followUpReasonPrompt?: string

  // Consequências
  stateDeltas: Partial<DriverEmotionalState>
  tpRelationshipDeltas: {
    trust?: number
    respect?: number
    confidence?: number
    personalLoyalty?: number
  }
  teamRelationshipDeltas: {
    belonging?: number
    sportingTrust?: number
    technicalTrust?: number
    satisfaction?: number
    desireToStay?: number
  }
  teammateRelationshipDeltas?: {
    respect?: number
    cooperation?: number
    rivalry?: number
    tension?: number
  }

  // Memória resultante
  shouldGenerateMemory: boolean
  memoryPayload?: {
    eventType: string
    polarity: 'positive' | 'neutral' | 'negative'
    intensity: number
    description: string
    contextExplanation: string
    persistenceClass: 'Minor' | 'Relevant' | 'Major' | 'Career-defining'
  }

  // Telemetria explicativa
  scoreBreakdown: {
    baseObedienceScore: number
    orderSeverity: number
    justificationBonus: number
    traitsScore: number
    relationshipScore: number
    historyScore: number
    championshipBonus: number
    managerBonus: number
    finalScore: number
    decisionThresholds: {
      refuseThreshold: number
      resistThreshold: number
      questionThreshold: number
      acceptReluctantThreshold: number
    }
  }
}

// ============================================================================
// 6. DOMAIN EVENTS CANÔNICOS DE CORRIDA (6B)
// ============================================================================
export type RaceDomainEventType =
  | 'TeamOrderIssued'
  | 'TeamOrderAccepted'
  | 'TeamOrderQuestioned'
  | 'TeamOrderResisted'
  | 'TeamOrderRefused'
  | 'DriverPitRequested'
  | 'DriverRequestAccepted'
  | 'DriverRequestDenied'
  | 'StrategyDisagreement'
  | 'PostRaceDriverReaction'
  | 'TeammateConflictEscalated'

export interface RaceDomainEvent {
  id: string
  eventType: RaceDomainEventType
  round: number
  season: number
  circuitId: string
  lap: number
  teamId: string
  driverId: string
  driverName: string
  teammateId?: string
  orderType?: TeamOrderType
  requestType?: DriverRequestType
  reactionType?: RaceReactionType
  description: string
  timestamp: string
  sourceEventId: string
}

// ============================================================================
// 7. HISTÓRICO DE LOG DE RÁDIO NA SESSÃO & TELEMETRIA QA
// ============================================================================
export interface SessionRadioLogEntry {
  id: string
  lap: number
  driverId: string
  driverName: string
  origin: 'driver' | 'pit_wall'
  type: 'order' | 'request' | 'feedback' | 'alert' | 'follow_up'
  message: string
  timestamp: string
  reactionType?: RaceReactionType
  orderType?: TeamOrderType
  requestType?: DriverRequestType
}

export interface RaceInteractionTelemetryReport {
  interactionId: string
  driverId: string
  driverName: string
  orderOrRequest: string
  contextSummary: string
  traits: DriverPersonalityTraits
  emotionalStateBefore: DriverEmotionalState
  relationshipsBefore: DriverRelationships
  scoreBreakdown: InteractionEvaluationResult['scoreBreakdown']
  chosenReaction: RaceReactionType
  actionApplied: boolean
  latencySectors: number
  radioMessageText: string
  effectsSummary: string
  memoryGenerated?: DriverMemoryEvent | null
}
