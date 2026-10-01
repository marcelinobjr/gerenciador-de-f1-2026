/**
 * baseline-2026-v1.ts
 *
 * BASELINE-2026-LOCK-01-CP1 — BASELINE CANÔNICA DEFINITIVA 2026-V1
 *
 * Força Estrutural canônica inicial das 12 equipes da Fórmula 1 (temporada 2026):
 * 1. Mercedes — 100
 * 2. McLaren — 98
 * 3. Ferrari — 96
 * 4. Red Bull Racing — 94
 * 5. Racing Bulls — 90
 * 6. Alpine — 87
 * 7. Audi — 84
 * 8. Haas — 81
 * 9. Williams — 79
 * 10. Aston Martin — 75
 * 11. Cadillac — 72
 * 12. Andretti — 69
 *
 * Spread estrutural: 100 - 69 = 31 pts.
 * Multiplicador de conversão: 0.08s por ponto -> Spread teórico = 31 * 0.08 = 2.48s.
 */

export interface TeamBaselineEntry {
  rank: number
  teamKey: string
  teamName: string
  score: number
}

export const BASELINE_2026_V1_TEAMS: Record<string, TeamBaselineEntry> = {
  mercedes: {
    rank: 1,
    teamKey: 'mercedes',
    teamName: 'Mercedes-AMG Petronas',
    score: 100,
  },
  mclaren: {
    rank: 2,
    teamKey: 'mclaren',
    teamName: 'McLaren F1 Team',
    score: 98,
  },
  ferrari: {
    rank: 3,
    teamKey: 'ferrari',
    teamName: 'Scuderia Ferrari',
    score: 96,
  },
  redbull: {
    rank: 4,
    teamKey: 'redbull',
    teamName: 'Red Bull Racing',
    score: 94,
  },
  racingbulls: {
    rank: 5,
    teamKey: 'racingbulls',
    teamName: 'Visa Cash App RB',
    score: 90,
  },
  alpine: {
    rank: 6,
    teamKey: 'alpine',
    teamName: 'Alpine F1 Team',
    score: 87,
  },
  audi: {
    rank: 7,
    teamKey: 'audi',
    teamName: 'Audi F1 Team',
    score: 84,
  },
  haas: {
    rank: 8,
    teamKey: 'haas',
    teamName: 'Haas F1 Team',
    score: 81,
  },
  williams: {
    rank: 9,
    teamKey: 'williams',
    teamName: 'Williams Racing',
    score: 79,
  },
  astonmartin: {
    rank: 10,
    teamKey: 'astonmartin',
    teamName: 'Aston Martin Aramco',
    score: 75,
  },
  cadillac: {
    rank: 11,
    teamKey: 'cadillac',
    teamName: 'Cadillac F1 Team',
    score: 72,
  },
  andretti: {
    rank: 12,
    teamKey: 'andretti',
    teamName: 'Andretti Global',
    score: 69,
  },
} as const

export const BASELINE_2026_V1_ORDER = [
  'mercedes',
  'mclaren',
  'ferrari',
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

export const BASELINE_2026_V1_METADATA = {
  version: '2026-V1',
  effectiveDate: '2026-01-01',
  topScore: 100,
  bottomScore: 69,
  pointSpread: 31,
  timeConversionSecPerPoint: 0.08,
  targetSpreadSec: 2.48,
} as const
