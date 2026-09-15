/**
 * IMPLEMENTAÇÃO Nº 6A — PERSONALIDADE, RELAÇÕES & MEMÓRIA
 * Tipos canônicos do sistema psicológico, relacional e de memória para pilotos da F1 2026.
 *
 * Princípio Fundamental:
 * PERSONALIDADE → EVENTO → INTERPRETAÇÃO → MEMÓRIA → RELAÇÃO → ESTADO EMOCIONAL → EXPECTATIVA → COMPORTAMENTO FUTURO.
 * Moral, personalidade e relações NÃO alteram a física nem o ritmo puro do carro diretamente.
 */

// ============================================================================
// 1. TRAITS CANÔNICOS DE PERSONALIDADE (Permanentes, 0-100)
// ============================================================================

export interface DriverPersonalityTraits {
  ambition: number // Exigência por carro vencedor, aversão a ser nº 2, foco em topo
  loyalty: number // Tolerância institucional, apego à equipe e promessas
  aggression: number // Disposição para disputas duras e reação combativa
  cooperation: number // Disposição a ordens de equipe, ajuda ao companheiro, divisão de dados
  pressureTolerance: number // Estabilidade DURANTE a pressão (qualy, disputa, crise de assento)
  professionalism: number // Postura com mídia, cumprimento de deveres, obediência técnica
  adaptability: number // Facilidade em absorver novos carros, pistas e filosofias de equipe
  ego: number // Sensibilidade a status, privilégios de equipamento e comparações
  resilience: number // Capacidade de RECUPERAÇÃO após resultados ruins, crises ou decepções
}

export type PersonalityDescriptor =
  | 'Altamente Ambicioso'
  | 'Fiel e Leal'
  | 'Agressivo nas Pistas'
  | 'Espírito Coletivo'
  | 'Frio sob Pressão'
  | 'Profissional Exemplar'
  | 'Camaleão Técnico'
  | 'Ego Elevado / Status First'
  | 'Resiliente Inabalável'
  | 'Equilibrado e Metódico'
  | 'Competidor Nato'

// ============================================================================
// 2. ESTADO PSICOLÓGICO/EMOCIONAL DERIVADO (Temporário, 0-100)
// ============================================================================

export interface DriverEmotionalState {
  confidence: number // Confiança no momento esportivo e no próprio ritmo (baseline 75)
  motivation: number // Vontade de entrega, foco nos briefings e treinos (baseline 75)
  satisfaction: number // Satisfação geral com o tratamento e a equipe (baseline 75)
  frustration: number // Frustração acumulada por falhas, perdas ou desrespeito (baseline 20)
  pressure: number // Pressão sentida atual (por cobrança, contrato ou mídia) (baseline 25)
  teamTrust: number // Confiança institucional na liderança técnica/esportiva (baseline 75)
  emotionalTension: number // Tensão interna e desgaste com o ambiente de garagem (baseline 20)
}

export type QualitativeStateLevel = 'muito_baixo' | 'baixo' | 'neutro' | 'alto' | 'muito_alto'

// ============================================================================
// 3. ESTRUTURA TRIDIMENSIONAL DE RELAÇÕES (0-100 cada dimensão)
// ============================================================================

export interface DriverToTPRelationship {
  trust: number // Confiança na palavra, promessas e liderança do Team Principal
  respect: number // Respeito pela competência estratégica e liderança
  confidence: number // Segurança transmitida pelo Manager
  personalLoyalty: number // Vínculo pessoal que transcende contratos
}

export interface DriverToTeamRelationship {
  belonging: number // Sensação de pertencimento e acolhimento na fábrica
  sportingTrust: number // Confiança nas decisões de estratégia de corrida
  technicalTrust: number // Confiança no desenvolvimento do carro e nas peças entregues
  satisfaction: number // Satisfação com o tratamento geral e recursos
  desireToStay: number // Vontade subjetiva de continuar na equipe no futuro
}

export type TeammateDynamicStatus =
  | 'Partners'
  | 'Respectful'
  | 'Competitive'
  | 'Tense'
  | 'Rivals'
  | 'Hostile'

export interface DriverToTeammateRelationship {
  teammateId: string
  teammateName: string
  respect: number // Respeito pela habilidade e conduta esportiva
  cooperation: number // Vontade mútua de trocar setups e trabalhar juntos
  rivalry: number // Intensidade competitiva direta (não é ódio, é disputa)
  tension: number // Atrito acumulado, toques ou favoritismos percebidos
  status: TeammateDynamicStatus // Estado descritivo derivado das dimensões
}

export interface DriverRelationships {
  teamPrincipal: DriverToTPRelationship
  team: DriverToTeamRelationship
  teammate?: DriverToTeammateRelationship
  historicalTeams?: Record<string, DriverToTeamRelationship> // Memória de ex-equipes
}

// ============================================================================
// 4. ENTIDADE DE MEMÓRIA — DriverMemoryEvent
// ============================================================================

export type MemoryPolarity = 'positive' | 'neutral' | 'negative'
export type MemoryPersistenceClass = 'Minor' | 'Relevant' | 'Major' | 'Career-defining'

export type MemoryEventType =
  | 'upgrade_received_priority'
  | 'upgrade_denied_priority'
  | 'upgrade_equal'
  | 'race_win'
  | 'race_podium'
  | 'race_good_recovery'
  | 'race_expected_met'
  | 'race_underperformance'
  | 'race_dnf_mechanical'
  | 'race_dnf_driver_error'
  | 'strategy_blunder_team'
  | 'strategy_masterclass_team'
  | 'team_protected_driver'
  | 'teammate_battle_clean'
  | 'teammate_incident_collision'
  | 'teammate_favoritism_felt'
  | 'promise_made'
  | 'promise_fulfilled'
  | 'promise_broken'
  | 'promise_expired'
  | 'contract_renewed'
  | 'contract_extension_offered'
  | 'contract_threat_academy'
  | 'test_driver_youngster_run'
  | 'promotion_to_titular'
  | 'demoted_or_replaced'
  | 'manager_conflict_resolution'
  | 'public_support_manager'
  | 'public_criticism_manager'

export interface DriverMemoryEvent {
  memoryId: string
  driverId: string
  eventType: MemoryEventType
  season: number
  round: number
  circuitId?: string
  date: string
  involvedEntityIds: string[] // driverId, teamId, managerProfileId, partId, etc.
  polarity: MemoryPolarity
  intensity: number // 1 a 10: impacto do momento
  salience: number // 0 a 100: peso psicológico ativo restante (decai com o tempo)
  decayRate: number // taxa de perda de saliência por rodada (modulada pela personalidade)
  persistenceClass: MemoryPersistenceClass
  tags: string[]
  relationshipEffects: {
    tpDelta?: Partial<DriverToTPRelationship>
    teamDelta?: Partial<DriverToTeamRelationship>
    teammateDelta?: Partial<
      Omit<DriverToTeammateRelationship, 'teammateId' | 'teammateName' | 'status'>
    >
  }
  stateEffects: Partial<DriverEmotionalState>
  sourceEventId?: string // Chave de idempotência (ex: "upgrade_diffuser_gen2_r3_audi")
  description: string
  contextExplanation: string
  isArchivedHistorical: boolean // true se salience <= 0 (permanece no log histórico sem afetar estado ativo)
}

// ============================================================================
// 5. PROMESSAS — DriverPromise
// ============================================================================

export type PromiseType =
  | 'equalEquipment' // Garantia de paridade em peças novas
  | 'upgradePriority' // Garantia de que receberá próximas novidades primeiro
  | 'raceOpportunity' // Oportunidade de guiar ou pontuar
  | 'testOpportunity' // Oportunidade em TL1 ou testes oficiais
  | 'contractRenewal' // Promessa formal de renovação para próxima temporada
  | 'promotion' // Promessa de promoção de reserva para titular
  | 'numberOneStatus' // Status declarado de primeiro piloto
  | 'titleSupport' // Apoio incondicional na disputa do título

export type PromiseStatus =
  | 'proposed'
  | 'accepted'
  | 'active'
  | 'fulfilled'
  | 'partiallyFulfilled'
  | 'broken'
  | 'expired'

export interface DriverPromise {
  id: string
  driverId: string
  type: PromiseType
  status: PromiseStatus
  createdRound: number
  createdSeason: number
  targetRound?: number
  targetSeason?: number
  description: string
  terms?: Record<string, any>
  evaluationHistory: {
    round: number
    note: string
    complianceScore: number // 0 a 100
  }[]
  sourceEventId?: string
}

// ============================================================================
// 6. EXPECTATION MODEL & RACING CONTEXT
// ============================================================================

export interface DriverPreRaceContext {
  driverId: string
  driverName: string
  round: number
  season: number
  circuitId: string
  expectedPositionRange: { min: number; max: number; target: number }
  expectedPositionReason: string
  emotionalState: DriverEmotionalState
  relationships: DriverRelationships
  activeSalientMemories: DriverMemoryEvent[]
  activePromises: DriverPromise[]
  seatSecurity: number
  perceivedTreatmentFairness: number // 0-100
}

export interface DriverDecisionContext {
  driverId: string
  teamTrust: number
  teammateRespect: number
  teammateRivalry: number
  cooperation: number
  ambition: number
  professionalism: number
  ego: number
  pressure: number
  relevantMemorySummary: string[]
}

// ============================================================================
// 7. EXPLICABILIDADE & AUDITORIA
// ============================================================================

export interface DriverReactionAuditLog {
  driverId: string
  driverName: string
  eventType: string
  baseImpact: number
  traitModulations: {
    trait: keyof DriverPersonalityTraits
    value: number
    delta: number
    explanation: string
  }[]
  historicalModulation: {
    factor: string
    delta: number
    explanation: string
  }
  managerModulation: {
    managerEffect: string
    delta: number
    explanation: string
  }
  finalRelationshipDeltas: Record<string, number>
  finalStateDeltas: Record<string, number>
  resultingSalience: number
  resultingPersistence: MemoryPersistenceClass
  telemetrySummary: string
}

export interface DriverPsychologyAuditReport {
  driverId: string
  driverName: string
  personalityTraits: DriverPersonalityTraits
  currentState: DriverEmotionalState
  qualitativeState: Record<keyof DriverEmotionalState, string>
  relationships: DriverRelationships
  activeMemoriesCount: number
  historicalMemoriesCount: number
  topActiveMemories: DriverMemoryEvent[]
  promises: DriverPromise[]
  seatSecurity: number
  perceivedFairness: number
  derivedDesireToStay: number
  integrityProblems: string[]
}
