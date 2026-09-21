/**
 * FW2.1C.1 — REGRA DE NOVATOS NO TL1 (FP1 ROOKIE RULE)
 * Regulamento Esportivo FIA F1 2026:
 * - Cada equipe deve ceder 4 sessões de TL1 (Treino Livre 1) por temporada para pilotos novatos.
 * - Sendo exatamente 2 sessões para o Carro 1 e 2 sessões para o Carro 2.
 * - Definição canônica de novato (rookie): piloto que disputou NO MÁXIMO 2 Grandes Prêmios de F1 na carreira (careerF1GrandPrixStarts <= 2).
 *   Idade, overall, categoria ou função não definem rookie.
 * - O requisito pertence ao CARRO / assento: troca de piloto titular não reseta nem transfere o contador.
 */

export interface RookieSeatRequirement {
  carId: 'car1' | 'car2'
  carNumber: 1 | 2
  required: number // 2 por carro
  completed: number // 0, 1 ou 2
  remaining: number // required - completed
  completedRounds: number[] // rounds em que foram cumpridos os créditos
  participatingDriverIds: string[] // IDs dos novatos que cumpriram cada crédito
}

export interface RookieTeamRequirement {
  seasonId: string
  teamId: string
  requiredTotal: number // 4 por equipe
  completedTotal: number // car1.completed + car2.completed
  remainingTotal: number // requiredTotal - completedTotal
  car1: RookieSeatRequirement
  car2: RookieSeatRequirement
  isCompliant: boolean // true se completedTotal === 4 && car1.completed === 2 && car2.completed === 2
}

export interface RookieCreditParticipationRecord {
  creditKey: string // rookie_fp1_credit_{seasonId}_{round}_{teamId}_{carId}
  seasonId: string
  round: number
  teamId: string
  carId: 'car1' | 'car2'
  driverId: string
  driverName: string
  lapsCompleted: number
  timestamp: string
}

export interface RookieEligibilityCheck {
  driverId: string
  driverName: string
  role?: string
  category?: string
  careerGPs: number
  isEligible: boolean
  reason?: string
}

export interface RivalAIRookieSchedule {
  teamId: string
  teamName: string
  car1Rounds: number[]
  car2Rounds: number[]
  car1RookieDriverId: string
  car2RookieDriverId: string
}

export interface RookieTemporaryFP1Assignment {
  seasonId: string
  round: number
  teamId: string
  carId: 'car1' | 'car2'
  rookieDriverId: string
  rookieDriverName: string
  rookieDriverPhoto?: string
  rookieSpeed?: number
  rookieConsistency?: number
  rookieTechnicalFeedback?: number
  originalDriverId: string
  originalDriverName: string
}

export const ROOKIE_MAX_CAREER_STARTS = 2
export const ROOKIE_REQUIRED_PER_CAR = 2
export const ROOKIE_REQUIRED_TOTAL_TEAM = 4
export const TOTAL_SEASON_ROUNDS = 24
