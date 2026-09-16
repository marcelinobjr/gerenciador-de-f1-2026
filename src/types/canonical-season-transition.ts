/**
 * TIPOS CANÔNICOS — SIMULAÇÃO DE FIM DE SEMANA & TRANSIÇÃO DE TEMPORADA (8A)
 * F1 Manager 2026
 *
 * Entidades formais para:
 * 1. WeekendSimulationRun (execução auditável de simulação do GP com idempotência)
 * 2. WeekendSummaryReport (resumo estruturado do GP pós-simulação)
 * 3. SeasonTransitionState & Machine (transição atômica passo-a-passo)
 * 4. SeasonTransitionSnapshot (auditoria e rollback técnico)
 * 5. CanonicalSeasonHistory (arquivo imutável das temporadas encerradas)
 * 6. SeasonTransitionAuditResult (auditorias canônicas pós e pré-transição)
 */

import type { WeekendSession } from '@/types/race-events'
import type { SimDriverEntry, SessionTimeResult } from '@/pages/race/types'
import type { DriverStanding, TeamStanding } from '@/services/standingsService'
import type { CanonicalDriverContract } from '@/types/canonical-driver-market'
import type { StaffContract, TeamTechnicalOrganization } from '@/types/canonical-staff'
import type { SponsorshipContract, CanonicalSponsorSlot } from '@/types/canonical-commercial'

export type CanonicalCarSponsorContract = SponsorshipContract
import type { FinancialLedgerSnapshot } from '@/types/canonical-finances'

// ==========================================
// 1. SIMULAÇÃO DE FIM DE SEMANA (PARTE A)
// ==========================================

export type WeekendSimulationStatus = 'NOT_STARTED' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface WeekendSimulationStepProgress {
  session: WeekendSession
  label: string
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  completedAt?: string
  summaryText?: string
  message?: string
}

export interface WeekendSimulationRun {
  runId: string
  seasonId: string
  seasonYear: number
  round: number
  gpName: string
  circuitName: string
  isSprintWeekend: boolean
  sessionsRequested: WeekendSession[]
  sessionsCompleted: WeekendSession[]
  status: WeekendSimulationStatus
  startedAt: string
  completedAt?: string
  error?: string | null
  snapshotRef?: string // ID de snapshot para segurança
  steps: WeekendSimulationStepProgress[]
}

export interface RadioHighlight {
  id: string
  lap: number
  driverName: string
  teamName: string
  teamColor: string
  type: 'team_order' | 'complaint' | 'strategy' | 'info'
  radioText: string
  reactionText?: string
}

export interface WeekendSummaryReport {
  runId: string
  round: number
  gpName: string
  circuitName: string
  isSprintWeekend: boolean
  // Bloco 1: Resultado pilotos jogador
  playerDriversResults: {
    driverId: string
    driverName: string
    gridPosition: number
    finishPosition: number
    pointsEarned: number
    dnf: boolean
    fastestLap: boolean
    lapsCompleted: number
    totalTime: string
  }[]
  // Bloco 2: Classificação (Qualifying)
  qualifyingGrid: {
    position: number
    driverName: string
    teamName: string
    lapTime: string
    isPlayer: boolean
  }[]
  // Bloco 3: Sprint (se houver)
  sprintResults?: {
    position: number
    driverName: string
    teamName: string
    points: number
    isPlayer: boolean
  }[]
  // Bloco 4: Pontos e Campeonato antes/depois
  championshipImpact: {
    driverStandingsBefore: { driverId: string; rank: number; points: number }[]
    driverStandingsAfter: { driverId: string; rank: number; points: number }[]
    teamRankBefore: number
    teamRankAfter: number
    teamPointsBefore: number
    teamPointsAfter: number
  }
  // Bloco 5: Estratégia
  strategicDecisions: string[]
  // Bloco 6: Incidentes
  incidents: string[]
  // Bloco 7: Reação pós-corrida dos pilotos
  driverReactions: {
    driverId: string
    driverName: string
    moraleBefore: number
    moraleAfter: number
    physicalBefore: number
    physicalAfter: number
    comment: string
  }[]
  // Bloco 8: Carro & Desgaste
  carCondition: {
    engineWearBefore: number
    engineWearAfter: number
    partsHealth: { name: string; condition: number }[]
  }
  // Bloco 9: Financeiro
  financialImpact: {
    netCashflow: number
    sponsorIncome: number
    driverSalariesCost: number
    engineCost: number
    damageCost?: number
    closingBalance: number
  }
  // Bloco 10: Patrocinadores
  sponsorImpact: {
    activeSponsorsCount: number
    incomeThisRound: number
    objectivesMet: string[]
  }
  // Destaques de rádio
  radioHighlights: RadioHighlight[]
}

// ==========================================
// 2. TRANSIÇÃO DE TEMPORADA (PARTE B)
// ==========================================

export type SeasonTransitionStatus =
  | 'NOT_STARTED'
  | 'VALIDATING'
  | 'CLOSING_CHAMPIONSHIP'
  | 'CLOSING_FINANCIALS'
  | 'CLOSING_COMMERCIAL'
  | 'RESOLVING_CONTRACTS'
  | 'TRANSFERRING_DRIVERS'
  | 'TRANSFERRING_STAFF'
  | 'PROCESSING_ACADEMY'
  | 'PROCESSING_ORGANIZATION'
  | 'CREATING_NEXT_SEASON'
  | 'VALIDATING_NEXT_SEASON'
  | 'COMPLETE'
  | 'FAILED'

export interface SeasonTransitionStep {
  id: SeasonTransitionStatus
  title: string
  status: 'pending' | 'in_progress' | 'done' | 'failed'
  message?: string
}

export interface SeasonTransitionSnapshot {
  snapshotId: string
  seasonTransitionId: string // ex: "2026->2027"
  createdAt: string
  fromSeasonYear: number
  toSeasonYear: number
  teamId: string
  driversState: any[]
  teamsState: any[]
  sponsorsState: any[]
  contractsState: CanonicalDriverContract[]
  staffContractsState: StaffContract[]
  organizationState: TeamTechnicalOrganization | null
  ledgerSnapshot: FinancialLedgerSnapshot | null
  championshipState: {
    driverStandings: DriverStanding[]
    constructorStandings: TeamStanding[]
  }
}

export interface FinalCostCapReport {
  seasonYear: number
  annualLimit: number
  finalSpend: number
  remainingOrOverage: number
  status: 'compliant' | 'minor_breach' | 'material_breach'
  categoriesBreakdown: Record<string, number>
}

export interface FinalFinancialCloseReport {
  seasonYear: number
  openingCash: number
  totalRevenue: number
  totalExpenses: number
  netCashFlow: number
  closingCash: number
  costCapReport: FinalCostCapReport
  prizeMoneyAwarded: number
  carryOverCash: number
}

export interface CanonicalSeasonHistory {
  id: string
  season: number
  technicalEraId?: string
  driversChampion: {
    driverId: string
    driverName: string
    teamName: string
    points: number
    wins: number
    podiums: number
  }
  constructorsChampion: {
    teamId: string
    teamName: string
    points: number
    wins: number
    podiums: number
  }
  finalStandings: {
    drivers: DriverStanding[]
    constructors: TeamStanding[]
  }
  teamSummary: {
    teamId: string
    teamName: string
    finalRank: number
    points: number
    wins: number
    podiums: number
    closingCash: number
    costCapSpent: number
  }
  majorRecords: {
    totalRaces: number
    fastestLapsChampion?: string
    mostWinsDriver: string
  }
  archivedAt: string
}

export interface SeasonTransitionAuditReport {
  transitionId: string
  fromSeason: number
  toSeason: number
  success: boolean
  errors: string[]
  warnings: string[]
  activeRegulationId?: string
  activatedFutureRegulation?: {
    regulationId: string
    category: string
    effectiveSeason: number
  } | null
  audits: {
    championship: {
      passed: boolean
      details: string
    }
    drivers: {
      passed: boolean
      seatCountValid: boolean
      noDuplicates: boolean
      futureContractsActivated: number
      freeAgentsCount: number
      details: string
    }
    staff: {
      passed: boolean
      canonicalRolesFilled: boolean
      adaptationInitialized: boolean
      knowledgeLossAppliedOnce: boolean
      details: string
    }
    finance: {
      passed: boolean
      cashCarriedOver: boolean
      costCapResetToZero: boolean
      prizeMoneyPaidOnce: boolean
      details: string
    }
    sponsors: {
      passed: boolean
      slotsConsistent: boolean
      multiYearContinued: boolean
      expiredReleased: boolean
      details: string
    }
    psychology: {
      passed: boolean
      memoriesPreserved: boolean
      regressionApplied: boolean
      details: string
    }
    academyAndFacilities: {
      passed: boolean
      facilitiesPreserved: boolean
      rdPreserved: boolean
      academyAgesAdvanced: boolean
      truePotentialProtected: boolean
      details: string
    }
  }
}
