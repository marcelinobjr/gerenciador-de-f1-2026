/**
 * quali-unify-01a-team-identity.test.ts
 *
 * QUALI-UNIFY-01A — Canonical Team Identity Resolution & Structural Integration Suite
 *
 * Testes determinísticos para validar a resolução unificada de identidade canônica
 * das equipes e sua correta integração com o cálculo de Força Estrutural (Structural Strength)
 * e o pipeline de pace de qualifying para a temporada 2026.
 */

import { describe, it, expect } from 'vitest'
import {
  resolveCanonicalTeamKey,
  resolveQualifyingTeamIdentity,
  CANONICAL_2026_TEAM_KEYS,
} from '@/services/canonicalTeamIdentityService'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { canonicalPaceIntegrationService } from '@/services/canonicalPaceIntegrationService'
import { BASELINE_2026_V1_TEAMS } from '@/data/baseline-2026-v1'

describe('QUALI-UNIFY-01A: Canonical Team Identity & Structural Strength Tests', () => {
  // QUA01A-01: 'williams' -> williams
  it('QUA01A-01: resolves clean key "williams" to "williams"', () => {
    expect(resolveCanonicalTeamKey('williams')).toBe('williams')
  })

  // QUA01A-02: 'team_williams' -> williams
  it('QUA01A-02: resolves prefixed key "team_williams" to "williams"', () => {
    expect(resolveCanonicalTeamKey('team_williams')).toBe('williams')
  })

  // QUA01A-03: 'Williams Racing' -> williams
  it('QUA01A-03: resolves display name "Williams Racing" to "williams"', () => {
    expect(resolveCanonicalTeamKey('Williams Racing')).toBe('williams')
    expect(resolveCanonicalTeamKey('Williams F1 Team')).toBe('williams')
  })

  // QUA01A-04: 'cadillac' e 'team_cadillac' -> cadillac
  it('QUA01A-04: resolves "cadillac" and "team_cadillac" to "cadillac"', () => {
    expect(resolveCanonicalTeamKey('cadillac')).toBe('cadillac')
    expect(resolveCanonicalTeamKey('team_cadillac')).toBe('cadillac')
    expect(resolveCanonicalTeamKey('Cadillac F1 Team')).toBe('cadillac')
  })

  // QUA01A-05: aliases de audi -> audi
  it('QUA01A-05: resolves audi aliases ("audi", "team_audi", "Audi F1 Team", "Audi Revolut", "audi_sport", "sauber") to "audi"', () => {
    expect(resolveCanonicalTeamKey('audi')).toBe('audi')
    expect(resolveCanonicalTeamKey('team_audi')).toBe('audi')
    expect(resolveCanonicalTeamKey('Audi F1 Team')).toBe('audi')
    expect(resolveCanonicalTeamKey('Audi Revolut')).toBe('audi')
    expect(resolveCanonicalTeamKey('audi_revolut')).toBe('audi')
    expect(resolveCanonicalTeamKey('audi_sport')).toBe('audi')
  })

  // QUA01A-06: aliases de mercedes -> mercedes
  it('QUA01A-06: resolves mercedes aliases ("mercedes", "team_mercedes", "Mercedes-AMG Petronas", "mercedes_amg") to "mercedes"', () => {
    expect(resolveCanonicalTeamKey('mercedes')).toBe('mercedes')
    expect(resolveCanonicalTeamKey('team_mercedes')).toBe('mercedes')
    expect(resolveCanonicalTeamKey('Mercedes-AMG Petronas')).toBe('mercedes')
    expect(resolveCanonicalTeamKey('mercedes_amg')).toBe('mercedes')
  })

  // QUA01A-07: as 12 equipes resolvem
  it('QUA01A-07: all 12 official 2026 teams resolve to their canonical keys', () => {
    const expected12 = [
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
    ]
    expect(CANONICAL_2026_TEAM_KEYS).toEqual(expected12)
    for (const key of expected12) {
      expect(resolveCanonicalTeamKey(key)).toBe(key)
      expect(resolveCanonicalTeamKey(`team_${key}`)).toBe(key)
    }
  })

  // QUA01A-08: team_williams -> Structural 70
  it('QUA01A-08: "team_williams" produces Structural Strength exactly 70', () => {
    const result = structuralStrengthService.getTeamStructuralStrength('team_williams')
    expect(result.structuralStrengthScore).toBe(70)
    expect(result.teamKey).toBe('williams')

    const paceP = canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_williams')
    expect(paceP).toBe(70)
  })

  // QUA01A-09: team_cadillac -> Structural 50
  it('QUA01A-09: "team_cadillac" produces Structural Strength exactly 50', () => {
    const result = structuralStrengthService.getTeamStructuralStrength('team_cadillac')
    expect(result.structuralStrengthScore).toBe(50)
    expect(result.teamKey).toBe('cadillac')

    const paceP = canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_cadillac')
    expect(paceP).toBe(50)
  })

  // QUA01A-10: audi (representações oficiais) -> Structural 86
  it('QUA01A-10: official representations of audi ("audi", "team_audi", "Audi F1 Team") produce Structural Strength 86', () => {
    const r1 = structuralStrengthService.getTeamStructuralStrength('audi')
    const r2 = structuralStrengthService.getTeamStructuralStrength('team_audi')
    const r3 = structuralStrengthService.getTeamStructuralStrength('Audi F1 Team')

    expect(r1.structuralStrengthScore).toBe(86)
    expect(r2.structuralStrengthScore).toBe(86)
    expect(r3.structuralStrengthScore).toBe(86)
  })

  // QUA01A-11: mercedes -> 100
  it('QUA01A-11: mercedes ("mercedes", "team_mercedes", "Mercedes-AMG Petronas") produces Structural Strength 100', () => {
    const r1 = structuralStrengthService.getTeamStructuralStrength('mercedes')
    const r2 = structuralStrengthService.getTeamStructuralStrength('team_mercedes')
    const r3 = structuralStrengthService.getTeamStructuralStrength('Mercedes-AMG Petronas')

    expect(r1.structuralStrengthScore).toBe(100)
    expect(r2.structuralStrengthScore).toBe(100)
    expect(r3.structuralStrengthScore).toBe(100)
  })

  // QUA01A-12: aston_martin -> 60
  it('QUA01A-12: aston_martin / astonmartin / amr produces Structural Strength 60', () => {
    const r1 = structuralStrengthService.getTeamStructuralStrength('astonmartin')
    const r2 = structuralStrengthService.getTeamStructuralStrength('aston_martin')
    const r3 = structuralStrengthService.getTeamStructuralStrength('team_aston_martin')
    const r4 = structuralStrengthService.getTeamStructuralStrength('amr')

    expect(r1.structuralStrengthScore).toBe(60)
    expect(r2.structuralStrengthScore).toBe(60)
    expect(r3.structuralStrengthScore).toBe(60)
    expect(r4.structuralStrengthScore).toBe(60)
  })

  // QUA01A-13: andretti -> 45
  it('QUA01A-13: andretti ("andretti", "team_andretti", "Andretti Global") produces Structural Strength 45', () => {
    const r1 = structuralStrengthService.getTeamStructuralStrength('andretti')
    const r2 = structuralStrengthService.getTeamStructuralStrength('team_andretti')
    const r3 = structuralStrengthService.getTeamStructuralStrength('Andretti Global')

    expect(r1.structuralStrengthScore).toBe(45)
    expect(r2.structuralStrengthScore).toBe(45)
    expect(r3.structuralStrengthScore).toBe(45)
  })

  // QUA01A-14: player de equipe real resolve para a equipe (não player_team -> fallback)
  it('QUA01A-14: player controlling an official team resolves to official team key, not fallback', () => {
    // Jogador assumindo a Audi
    const playerAudiTeam = {
      id: 'player_team',
      name: 'Audi F1 Team',
      team_key: 'audi',
      is_custom: false,
    }
    const resolvedAudi = resolveCanonicalTeamKey(playerAudiTeam)
    expect(resolvedAudi).toBe('audi')
    const strengthAudi = structuralStrengthService.getTeamStructuralStrength(resolvedAudi)
    expect(strengthAudi.structuralStrengthScore).toBe(86)

    // Jogador assumindo a Williams
    const playerWilliamsTeam = {
      id: 'player_team',
      name: 'Williams Racing',
      team_key: 'williams',
      is_custom: false,
    }
    const resolvedWilliams = resolveCanonicalTeamKey(playerWilliamsTeam)
    expect(resolvedWilliams).toBe('williams')
    const strengthWilliams = structuralStrengthService.getTeamStructuralStrength(resolvedWilliams)
    expect(strengthWilliams.structuralStrengthScore).toBe(70)

    // Equipe genuinamente customizada do jogador
    const customTeam = {
      id: 'player_team',
      name: 'Escuderia Apex Brasil',
      team_key: 'custom',
      is_custom: true,
    }
    expect(resolveCanonicalTeamKey(customTeam)).toBe('custom_team')
  })

  // QUA01A-15: player e AI da mesma equipe -> mesma canonical key
  it('QUA01A-15: player and AI controlling the same team share the exact same canonical key and structural strength', () => {
    const aiKey = resolveCanonicalTeamKey('ai_ferrari')
    const playerKey = resolveCanonicalTeamKey({
      id: 'player_team',
      name: 'Scuderia Ferrari',
      team_key: 'ferrari',
    })

    expect(aiKey).toBe('ferrari')
    expect(playerKey).toBe('ferrari')
    expect(structuralStrengthService.getTeamStructuralStrength(aiKey).structuralStrengthScore).toBe(
      structuralStrengthService.getTeamStructuralStrength(playerKey).structuralStrengthScore,
    )
    expect(structuralStrengthService.getTeamStructuralStrength(aiKey).structuralStrengthScore).toBe(
      98,
    )
  })

  // QUA01A-16: input desconhecido não é aceito como baseline válida ~73.4 (comportamento explícito)
  it('QUA01A-16: unknown official input emits explicit diagnostic UNRESOLVED_OFFICIAL_TEAM_IDENTITY instead of silently masking', () => {
    const { canonicalKey, diagnostic } = resolveQualifyingTeamIdentity(
      'unknown_official_formula_team',
    )
    expect(canonicalKey).toBe('custom_team')
    expect(diagnostic).not.toBeNull()
    expect(diagnostic?.code).toBe('UNRESOLVED_OFFICIAL_TEAM_IDENTITY')

    // Modo estrito deve lançar erro
    expect(() =>
      resolveQualifyingTeamIdentity('unknown_official_formula_team', { strict: true }),
    ).toThrowError(/UNRESOLVED_OFFICIAL_TEAM_IDENTITY/)
  })

  // QUA01A-17: teams.strength não participa
  it('QUA01A-17: teams.strength does NOT influence canonical key resolution or baseline score', () => {
    const teamWithLegacyStrength = {
      id: 'team_williams',
      name: 'Williams Racing',
      team_key: 'williams',
      strength: 42, // Legado do PB (não deve ser usado)
      strength_rating: 4.2,
    }
    const resolved = resolveCanonicalTeamKey(teamWithLegacyStrength)
    expect(resolved).toBe('williams')
    const structural = structuralStrengthService.getTeamStructuralStrength(resolved)
    // Score canônico da Williams na baseline 2026 é 70, não 42
    expect(structural.structuralStrengthScore).toBe(70)
  })

  // QUA01A-18: BASELINE_2026 intacta
  it('QUA01A-18: BASELINE_2026 targets remain intact across all 12 teams', () => {
    const expectedScores: Record<string, number> = {
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

    for (const [key, target] of Object.entries(expectedScores)) {
      expect(BASELINE_2026_V1_TEAMS[key].score).toBe(target)
      const res = structuralStrengthService.getTeamStructuralStrength(key)
      expect(res.structuralStrengthScore).toBe(target)
    }
  })
})
