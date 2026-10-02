/**
 * baseline-2026-lock-contract.ts
 *
 * BASELINE-2026-LOCK-01 — CP4 (Lock Técnico da Baseline 2026)
 *
 * Artefato técnico de travamento de contrato para prevenir silent drift no futuro.
 * Não recalibra números. Congela como invariantes formais os valores aprovados
 * e auditados na baseline 2026 e nas equações canônicas de integração.
 */

export interface BaselineStructuralTargetEntry {
  rank: number
  teamKey: string
  teamName: string
  targetScore: number
}

/**
 * 1. TARGETS ESTRUTURAIS CANÔNICOS INICIAIS 2026
 * Mercedes 100, Ferrari 98, McLaren 96, Red Bull 94, Racing Bulls 87,
 * Alpine 87, Audi 86, Haas 75, Williams 70, Aston Martin 60, Cadillac 50, Andretti 45.
 */
export const BASELINE_2026_TARGETS: Record<string, BaselineStructuralTargetEntry> = {
  mercedes: { rank: 1, teamKey: 'mercedes', teamName: 'Mercedes-AMG Petronas', targetScore: 100 },
  ferrari: { rank: 2, teamKey: 'ferrari', teamName: 'Scuderia Ferrari', targetScore: 98 },
  mclaren: { rank: 3, teamKey: 'mclaren', teamName: 'McLaren F1 Team', targetScore: 96 },
  redbull: { rank: 4, teamKey: 'redbull', teamName: 'Red Bull Racing', targetScore: 94 },
  racingbulls: { rank: 5, teamKey: 'racingbulls', teamName: 'Visa Cash App RB', targetScore: 87 },
  alpine: { rank: 6, teamKey: 'alpine', teamName: 'Alpine F1 Team', targetScore: 87 },
  audi: { rank: 7, teamKey: 'audi', teamName: 'Audi F1 Team', targetScore: 86 },
  haas: { rank: 8, teamKey: 'haas', teamName: 'Haas F1 Team', targetScore: 75 },
  williams: { rank: 9, teamKey: 'williams', teamName: 'Williams Racing', targetScore: 70 },
  astonmartin: {
    rank: 10,
    teamKey: 'astonmartin',
    teamName: 'Aston Martin Aramco',
    targetScore: 60,
  },
  cadillac: { rank: 11, teamKey: 'cadillac', teamName: 'Cadillac F1 Team', targetScore: 50 },
  andretti: { rank: 12, teamKey: 'andretti', teamName: 'Andretti Global', targetScore: 45 },
} as const

export const BASELINE_2026_CANONICAL_ORDER = [
  'mercedes',
  'ferrari',
  'mclaren',
  'redbull',
  'racingbulls',
  'alpine',
  'audi',
  'haas',
  'williams',
  'astonmartin',
  'cadillac',
  'andretti',
] as const

/**
 * 2. PESOS E FÓRMULAS ESTRUTURAIS
 */
export const BASELINE_2026_FORMULA_CONTRACT = {
  TECHNICAL_WEIGHTS: {
    parts: 0.5,
    effectivePu: 0.3,
    reliability: 0.1,
    condition: 0.1,
  },
  DRIVER_WEIGHTS: {
    driverAttributes: 0.8,
    morale: 0.1,
    adaptation: 0.1,
  },
  TEAM_WEIGHTS: {
    infrastructure: 0.8,
    teamMorale: 0.2,
  },
  FINAL_STRUCTURAL_WEIGHTS: {
    technical: 0.6,
    driver: 0.25,
    team: 0.15,
  },
} as const

/**
 * 3. TRACKFIT CONTRACT
 */
export const BASELINE_2026_TRACKFIT_CONTRACT = {
  neutralReference: 75.0,
  scale: 0.08,
  normalClamp: 2.0,
  specializedClamp: 2.5,
  maxClamp: 2.5,
  allowedApplicationCount: 1,
} as const

/**
 * 4. SETUP EFFICIENCY CONTRACT
 */
export const BASELINE_2026_SETUP_CONTRACT = {
  neutralReference: 80.0,
  coefficient: 0.05,
  allowedApplicationCount: 1,
} as const

/**
 * 5. QUALIFYING RNG CONTRACT
 */
export const BASELINE_2026_RNG_CONTRACT = {
  defaultSigma: 0.45,
  targetMin: -1.0,
  targetMax: 1.0,
  algorithm: 'Mulberry32 + Box-Muller',
  deterministic: true,
} as const

/**
 * 6. TOLERÂNCIA DE DERIVAÇÃO
 */
export const BASELINE_2026_TOLERANCE = 1.0
