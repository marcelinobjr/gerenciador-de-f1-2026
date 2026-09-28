/**
 * src/services/raceQualifyingOrchestratorService.ts
 *
 * Orquestrador canônico do fluxo de classificação normal (RACE-QUALI-01A).
 * READY_FOR_Q1 -> Q1 -> Q2 -> Q3 -> QUALIFYING_COMPLETE
 */

export const QUALIFYING_PHASES = {
  READY_FOR_Q1: 'READY_FOR_Q1',
  Q1: 'q1',
  Q2: 'q2',
  Q3: 'q3',
  QUALIFYING_COMPLETE: 'QUALIFYING_COMPLETE',
} as const
