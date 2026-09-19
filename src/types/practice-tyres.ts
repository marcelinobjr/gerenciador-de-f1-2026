import type { TireCompound } from '@/types/f1'
import type { PracticeProgramType, PracticeCarSetup } from '@/types/practice-preparation'
import type { TrackWeatherState } from '@/lib/f1-tire-system'

export type TyreConfidenceLevel = 'baixa' | 'media' | 'alta'
export type TyreKnowledgeConfidence = TyreConfidenceLevel | 'sem_dados'

export type TyreDegradationLevel = 'muito_baixa' | 'baixa' | 'moderada' | 'alta' | 'muito_alta'
export type TyreConsistencyLevel = 'ruim' | 'irregular' | 'razoavel' | 'boa' | 'muito_boa'

/**
 * Dimensão multidimensional de conhecimento sobre um aspecto específico do pneu.
 */
export interface TyreKnowledgeDimension<T> {
  value?: T
  confidence: TyreKnowledgeConfidence
  confidenceScore: number // 0 a 100 interno
  revealed: boolean
}

/**
 * Faixa de voltas da janela útil estimada do pneu.
 */
export interface TyreUsefulWindowRange {
  minLaps: number
  maxLaps: number
}

/**
 * Faixa s/volta de queda de rendimento (pace drop / degradation slope).
 */
export interface TyrePaceDropRange {
  minSecPerLap: number
  maxSecPerLap: number
}

/**
 * Conhecimento consolidado de um composto pela equipe no fim de semana.
 */
export interface TyreCompoundKnowledge {
  compound: TireCompound
  degradation: TyreKnowledgeDimension<TyreDegradationLevel>
  usefulWindow: TyreKnowledgeDimension<TyreUsefulWindowRange>
  paceDrop: TyreKnowledgeDimension<TyrePaceDropRange>
  consistency: TyreKnowledgeDimension<TyreConsistencyLevel>
  overallConfidence: TyreKnowledgeConfidence
  totalLapsObserved: number
  totalStintsObserved: number
  testedDrivers: string[]
  testedCars: Array<'car1' | 'car2'>
  testedConditions: TrackWeatherState[]
  lastUpdatedStintId?: string
  lastUpdatedSession?: string
  updatedAt: string
}

/**
 * Dicionário de conhecimento consolidado de todos os compostos canônicos.
 */
export type WeekendTyreKnowledge = Record<TireCompound, TyreCompoundKnowledge>

/**
 * Observação individual e auditável de pneu por stint.
 */
export interface TyreStintObservation {
  id: string // tyre_obs_{sessionId}_{stintId}
  sessionId: string
  stintId: string
  driverId: string
  driverName: string
  carId: 'car1' | 'car2'
  compound: TireCompound
  program: PracticeProgramType
  lapsCount: number
  weather: TrackWeatherState
  setupSnapshot: PracticeCarSetup
  initialWear: number
  finalWear: number
  wearDelta: number
  wearPerLap: number
  observedDegradationLevel: TyreDegradationLevel
  estimatedUsefulWindow: TyreUsefulWindowRange
  observedPaceDropPerLapSec: number // taxa s/volta normalizada (sem combustível)
  observedConsistency: TyreConsistencyLevel
  quality: 'insufficient' | 'preliminary' | 'reliable'
  knowledgeGain: number // pontuação adquirida para confiança
  summaryMessage: string
  timestamp: string
}
