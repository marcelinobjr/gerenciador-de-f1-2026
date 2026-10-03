/**
 * quali-unify-01a2-structural-resolution.test.ts
 *
 * QUALI-UNIFY-01A2 — Micro-Patch Canonical Team Identity -> Structural Strength Integration Suite
 *
 * Valida a conexão do resolver de identidade canônica ao pipeline de Força Estrutural,
 * garantindo que qualquer input de equipe oficial (chave canônica, prefixo team_, display name)
 * consulte a âncora 2026 correta e NUNCA caia no fallback estrutural genérico (~73.4).
 */

import { describe, it, expect } from 'vitest'
import {
  resolveCanonicalTeamKey,
  CANONICAL_2026_TEAM_KEYS,
  type CanonicalTeamKey,
} from '@/services/canonicalTeamIdentityService'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { canonicalPaceIntegrationService } from '@/services/canonicalPaceIntegrationService'
import { BASELINE_2026_V1_TEAMS } from '@/data/baseline-2026-v1'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'

describe('QUALI-UNIFY-01A2: Canonical Team Identity -> Structural Strength Resolution', () => {
  // A2-01: 'mercedes' → Structural = 100
  it('A2-01: "mercedes" -> Structural = 100', () => {
    const res = structuralStrengthService.getTeamStructuralStrength('mercedes')
    expect(res.structuralStrengthScore).toBe(100)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('mercedes')).toBe(100)
  })

  // A2-02: 'team_mercedes' → 100
  it('A2-02: "team_mercedes" -> 100', () => {
    const res = structuralStrengthService.getTeamStructuralStrength('team_mercedes')
    expect(res.structuralStrengthScore).toBe(100)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_mercedes')).toBe(100)
  })

  // A2-03: 'audi' → 86
  it('A2-03: "audi" -> 86', () => {
    const res = structuralStrengthService.getTeamStructuralStrength('audi')
    expect(res.structuralStrengthScore).toBe(86)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('audi')).toBe(86)
  })

  // A2-04: 'team_audi' → 86
  it('A2-04: "team_audi" -> 86', () => {
    const res = structuralStrengthService.getTeamStructuralStrength('team_audi')
    expect(res.structuralStrengthScore).toBe(86)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_audi')).toBe(86)
  })

  // A2-05: 'williams' → 70
  it('A2-05: "williams" -> 70', () => {
    const res = structuralStrengthService.getTeamStructuralStrength('williams')
    expect(res.structuralStrengthScore).toBe(70)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('williams')).toBe(70)
  })

  // A2-06: 'team_williams' → 70, e explicitamente NOT ~73.4
  it('A2-06: "team_williams" -> 70, and explicitly NOT ~73.4', () => {
    const res = structuralStrengthService.getTeamStructuralStrength('team_williams')
    expect(res.structuralStrengthScore).toBe(70)
    expect(Math.abs(res.structuralStrengthScore - 73.4)).toBeGreaterThan(2.0)
    const basePace = canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_williams')
    expect(basePace).toBe(70)
    expect(Math.abs(basePace - 73.4)).toBeGreaterThan(2.0)
  })

  // A2-07: 'cadillac' → 50
  it('A2-07: "cadillac" -> 50', () => {
    const res = structuralStrengthService.getTeamStructuralStrength('cadillac')
    expect(res.structuralStrengthScore).toBe(50)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('cadillac')).toBe(50)
  })

  // A2-08: 'team_cadillac' → 50, e explicitamente NOT ~73.4
  it('A2-08: "team_cadillac" -> 50, and explicitly NOT ~73.4', () => {
    const res = structuralStrengthService.getTeamStructuralStrength('team_cadillac')
    expect(res.structuralStrengthScore).toBe(50)
    expect(Math.abs(res.structuralStrengthScore - 73.4)).toBeGreaterThan(20.0)
    const basePace = canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_cadillac')
    expect(basePace).toBe(50)
    expect(Math.abs(basePace - 73.4)).toBeGreaterThan(20.0)
  })

  // A2-09: 'Aston Martin' → aston_martin → 60
  it('A2-09: "Aston Martin" -> aston_martin -> 60', () => {
    expect(resolveCanonicalTeamKey('Aston Martin')).toBe('aston_martin')
    const res = structuralStrengthService.getTeamStructuralStrength('Aston Martin')
    expect(res.structuralStrengthScore).toBe(60)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('Aston Martin')).toBe(60)
  })

  // A2-10: 'team_andretti' → andretti → 45
  it('A2-10: "team_andretti" -> andretti -> 45', () => {
    expect(resolveCanonicalTeamKey('team_andretti')).toBe('andretti')
    const res = structuralStrengthService.getTeamStructuralStrength('team_andretti')
    expect(res.structuralStrengthScore).toBe(45)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_andretti')).toBe(45)
  })

  // A2-11: todas as 12 canonical keys retornam exatamente suas âncoras 2026
  it('A2-11: all 12 canonical keys return exactly their 2026 anchors', () => {
    const expectedAnchors: Record<CanonicalTeamKey, number> = {
      mercedes: 100,
      ferrari: 98,
      mclaren: 96,
      red_bull: 94,
      racing_bulls: 87,
      alpine: 87,
      audi: 86,
      haas: 75,
      williams: 70,
      aston_martin: 60,
      cadillac: 50,
      andretti: 45,
    }

    for (const key of CANONICAL_2026_TEAM_KEYS) {
      const res = structuralStrengthService.getTeamStructuralStrength(key)
      expect(res.structuralStrengthScore).toBe(expectedAnchors[key])
      expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength(key)).toBe(
        expectedAnchors[key],
      )
    }
  })

  // A2-12: todas as 12 formas team_<canonicalKey> retornam a mesma âncora da key sem prefixo
  it('A2-12: all 12 team_<canonicalKey> formats return the same anchor as the non-prefixed key', () => {
    for (const key of CANONICAL_2026_TEAM_KEYS) {
      const direct =
        structuralStrengthService.getTeamStructuralStrength(key).structuralStrengthScore
      const prefixed = structuralStrengthService.getTeamStructuralStrength(
        `team_${key}`,
      ).structuralStrengthScore
      expect(prefixed).toBe(direct)
      expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength(`team_${key}`)).toBe(
        direct,
      )
    }
  })

  // A2-13: display names oficiais das 12 equipes resolvem para a mesma força estrutural das canonical keys
  it('A2-13: official display names of all 12 teams resolve to the same structural strength as canonical keys', () => {
    for (const team of OFFICIAL_GRID_TEAMS) {
      const canonKey = resolveCanonicalTeamKey(team.name)
      expect(canonKey).not.toBeNull()
      const scoreFromName = structuralStrengthService.getTeamStructuralStrength(
        team.name,
      ).structuralStrengthScore
      const scoreFromCanon = structuralStrengthService.getTeamStructuralStrength(
        canonKey!,
      ).structuralStrengthScore
      expect(scoreFromName).toBe(scoreFromCanon)
      expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength(team.name)).toBe(
        scoreFromCanon,
      )
    }
  })

  // A2-14: Williams (canonical, team_, display name) → todos 70
  it('A2-14: Williams (canonical, team_, display name) -> all 70', () => {
    expect(
      structuralStrengthService.getTeamStructuralStrength('williams').structuralStrengthScore,
    ).toBe(70)
    expect(
      structuralStrengthService.getTeamStructuralStrength('team_williams').structuralStrengthScore,
    ).toBe(70)
    expect(
      structuralStrengthService.getTeamStructuralStrength('Williams Racing')
        .structuralStrengthScore,
    ).toBe(70)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('williams')).toBe(70)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_williams')).toBe(70)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('Williams Racing')).toBe(
      70,
    )
  })

  // A2-15: Cadillac (canonical, team_, display name) → todos 50
  it('A2-15: Cadillac (canonical, team_, display name) -> all 50', () => {
    expect(
      structuralStrengthService.getTeamStructuralStrength('cadillac').structuralStrengthScore,
    ).toBe(50)
    expect(
      structuralStrengthService.getTeamStructuralStrength('team_cadillac').structuralStrengthScore,
    ).toBe(50)
    expect(
      structuralStrengthService.getTeamStructuralStrength('Cadillac F1 Team')
        .structuralStrengthScore,
    ).toBe(50)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('cadillac')).toBe(50)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_cadillac')).toBe(50)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('Cadillac F1 Team')).toBe(
      50,
    )
  })

  // A2-16: Audi (canonical, team_, display name) → todos 86
  it('A2-16: Audi (canonical, team_, display name) -> all 86', () => {
    expect(
      structuralStrengthService.getTeamStructuralStrength('audi').structuralStrengthScore,
    ).toBe(86)
    expect(
      structuralStrengthService.getTeamStructuralStrength('team_audi').structuralStrengthScore,
    ).toBe(86)
    expect(
      structuralStrengthService.getTeamStructuralStrength('Audi F1 Team').structuralStrengthScore,
    ).toBe(86)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('audi')).toBe(86)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_audi')).toBe(86)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('Audi F1 Team')).toBe(86)
  })

  // A2-17: Mercedes (canonical, team_, display name) → todos 100
  it('A2-17: Mercedes (canonical, team_, display name) -> all 100', () => {
    expect(
      structuralStrengthService.getTeamStructuralStrength('mercedes').structuralStrengthScore,
    ).toBe(100)
    expect(
      structuralStrengthService.getTeamStructuralStrength('team_mercedes').structuralStrengthScore,
    ).toBe(100)
    expect(
      structuralStrengthService.getTeamStructuralStrength('Mercedes-AMG Petronas')
        .structuralStrengthScore,
    ).toBe(100)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('mercedes')).toBe(100)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_mercedes')).toBe(100)
    expect(
      canonicalPaceIntegrationService.resolveBaseStructuralStrength('Mercedes-AMG Petronas'),
    ).toBe(100)
  })

  // A2-18: input desconhecido não é confundido com nenhuma das 12 equipes oficiais; se fallback legado for preservado, permanece diagnosticável como MISSING ou equivalente
  it('A2-18: unknown input is not confused with official teams and remains diagnosable as MISSING', () => {
    expect(resolveCanonicalTeamKey('unknown_racing_team')).toBeNull()
    const fallbackRes = structuralStrengthService.getTeamStructuralStrength('unknown_racing_team')
    expect(fallbackRes.dataQuality).toBe('MISSING')
    expect(fallbackRes.teamKey).not.toBe('mercedes')
    expect(fallbackRes.teamKey).not.toBe('williams')
    expect(fallbackRes.teamKey).not.toBe('cadillac')
  })

  // A2-19: player_team continua unresolved sem contexto; não transformado arbitrariamente em equipe oficial
  it('A2-19: player_team remains unresolved without context in pure layer', () => {
    expect(resolveCanonicalTeamKey('player_team')).toBeNull()
    const ptRes = structuralStrengthService.getTeamStructuralStrength('player_team')
    // Sem contexto, player_team não deve virar Audi ou Mercedes arbitrariamente
    expect(ptRes.dataQuality).toBe('MISSING')
  })

  // A2-20: BASELINE_2026_V1_TEAMS permanece numericamente inalterada
  it('A2-20: BASELINE_2026_V1_TEAMS remains numerically intact', () => {
    const expectedRawValues: Record<string, number> = {
      mercedes: 100,
      ferrari: 98,
      mclaren: 96,
      redbull: 94,
      racingbulls: 87,
      alpine: 87,
      audi: 86,
      haas: 75,
      williams: 70,
      astonmartin: 60,
      cadillac: 50,
      andretti: 45,
    }

    for (const [key, expectedScore] of Object.entries(expectedRawValues)) {
      expect(BASELINE_2026_V1_TEAMS[key]).toBeDefined()
      expect(BASELINE_2026_V1_TEAMS[key].score).toBe(expectedScore)
    }
  })
})
