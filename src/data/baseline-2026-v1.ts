/**
 * baseline-2026-v1.ts
 *
 * BASELINE-2026-LOCK-01-CP1 — BASELINE CANÔNICA DEFINITIVA 2026-V1
 *
 * Força Estrutural canônica inicial das 12 equipes da Fórmula 1 (temporada 2026):
 * 1. Mercedes — 100
 * 2. Ferrari — 98
 * 3. McLaren — 96
 * 4. Red Bull Racing — 94
 * 5. Racing Bulls — 87
 * 6. Alpine — 87
 * 7. Audi — 86
 * 8. Haas — 75
 * 9. Williams — 70
 * 10. Aston Martin — 60
 * 11. Cadillac — 50
 * 12. Andretti — 45
 *
 * Spread estrutural: 100 - 45 = 55 pts.
 * Multiplicador de conversão: 0.08s por ponto -> Spread teórico = 55 * 0.08 = 4.40s.
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
  ferrari: {
    rank: 2,
    teamKey: 'ferrari',
    teamName: 'Scuderia Ferrari',
    score: 98,
  },
  mclaren: {
    rank: 3,
    teamKey: 'mclaren',
    teamName: 'McLaren F1 Team',
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
    score: 87,
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
    score: 86,
  },
  haas: {
    rank: 8,
    teamKey: 'haas',
    teamName: 'Haas F1 Team',
    score: 75,
  },
  williams: {
    rank: 9,
    teamKey: 'williams',
    teamName: 'Williams Racing',
    score: 70,
  },
  astonmartin: {
    rank: 10,
    teamKey: 'astonmartin',
    teamName: 'Aston Martin Aramco',
    score: 60,
  },
  cadillac: {
    rank: 11,
    teamKey: 'cadillac',
    teamName: 'Cadillac F1 Team',
    score: 50,
  },
  andretti: {
    rank: 12,
    teamKey: 'andretti',
    teamName: 'Andretti Global',
    score: 45,
  },
} as const

export const BASELINE_2026_V1_ORDER = [
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

export const BASELINE_2026_V1_METADATA = {
  version: '2026-V1',
  effectiveDate: '2026-01-01',
  topScore: 100,
  bottomScore: 45,
  pointSpread: 55,
  timeConversionSecPerPoint: 0.08,
  targetSpreadSec: 4.4,
} as const
