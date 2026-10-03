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

describe('QUALI-UNIFY-01A2: Structural Team Identity Resolution', () => {
  // A2-01: 'mercedes' → 100
  it('A2-01: resolves "mercedes" to 100', () => {
    const strength = structuralStrengthService.getTeamStructuralStrength('mercedes')
    expect(strength.structuralStrengthScore).toBe(100)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('mercedes')).toBe(100)
  })

  // A2-02: 'team_mercedes' → 100
  it('A2-02: resolves "team_mercedes" to 100', () => {
    const strength = structuralStrengthService.getTeamStructuralStrength('team_mercedes')
    expect(strength.structuralStrengthScore).toBe(100)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_mercedes')).toBe(100)
  })

  // A2-03: 'audi' → 86
  it('A2-03: resolves "audi" to 86', () => {
    const strength = structuralStrengthService.getTeamStructuralStrength('audi')
    expect(strength.structuralStrengthScore).toBe(86)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('audi')).toBe(86)
  })

  // A2-04: 'team_audi' → 86
  it('A2-04: resolves "team_audi" to 86', () => {
    const strength = structuralStrengthService.getTeamStructuralStrength('team_audi')
    expect(strength.structuralStrengthScore).toBe(86)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_audi')).toBe(86)
  })

  // A2-05: 'williams' → 70
  it('A2-05: resolves "williams" to 70', () => {
    const strength = structuralStrengthService.getTeamStructuralStrength('williams')
    expect(strength.structuralStrengthScore).toBe(70)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('williams')).toBe(70)
  })

  // A2-06: 'team_williams' → 70 e NOT ~73.4
  it('A2-06: resolves "team_williams" to 70 and NOT generic fallback ~73.4', () => {
    const strength = structuralStrengthService.getTeamStructuralStrength('team_williams')
    expect(strength.structuralStrengthScore).toBe(70)
    expect(strength.structuralStrengthScore).not.toBeCloseTo(73.4, 0.5)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_williams')).toBe(70)
    expect(
      canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_williams'),
    ).not.toBeCloseTo(73.4, 0.5)
  })

  // A2-07: 'cadillac' → 50
  it('A2-07: resolves "cadillac" to 50', () => {
    const strength = structuralStrengthService.getTeamStructuralStrength('cadillac')
    expect(strength.structuralStrengthScore).toBe(50)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('cadillac')).toBe(50)
  })

  // A2-08: 'team_cadillac' → 50 e NOT ~73.4
  it('A2-08: resolves "team_cadillac" to 50 and NOT generic fallback ~73.4', () => {
    const strength = structuralStrengthService.getTeamStructuralStrength('team_cadillac')
    expect(strength.structuralStrengthScore).toBe(50)
    expect(strength.structuralStrengthScore).not.toBeCloseTo(73.4, 0.5)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_cadillac')).toBe(50)
    expect(
      canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_cadillac'),
    ).not.toBeCloseTo(73.4, 0.5)
  })

  // A2-09: 'Aston Martin' → 60
  it('A2-09: resolves "Aston Martin" to 60', () => {
    const strength = structuralStrengthService.getTeamStructuralStrength('Aston Martin')
    expect(strength.structuralStrengthScore).toBe(60)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('Aston Martin')).toBe(60)
  })

  // A2-10: 'team_andretti' → 45
  it('A2-10: resolves "team_andretti" to 45', () => {
    const strength = structuralStrengthService.getTeamStructuralStrength('team_andretti')
    expect(strength.structuralStrengthScore).toBe(45)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength('team_andretti')).toBe(45)
  })

  // A2-11: as 12 canonical keys → âncoras exatas
  it('A2-11: all 12 canonical keys resolve to their exact 2026 anchors', () => {
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

    for (const [key, expectedScore] of Object.entries(expectedAnchors)) {
      const strength = structuralStrengthService.getTeamStructuralStrength(key)
      expect(strength.structuralStrengthScore).toBe(expectedScore)
      expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength(key)).toBe(expectedScore)
    }
  })

  // A2-12: as 12 formas team_<key> → mesma âncora
  it('A2-12: all 12 "team_<key>" forms resolve to the same exact anchor', () => {
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

    for (const [key, expectedScore] of Object.entries(expectedAnchors)) {
      const input = `team_${key}`
      const strength = structuralStrengthService.getTeamStructuralStrength(input)
      expect(strength.structuralStrengthScore).toBe(expectedScore)
      expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength(input)).toBe(
        expectedScore,
      )
    }
  })

  // A2-13: display names oficiais → mesma âncora
  it('A2-13: official display names resolve to the exact same anchor', () => {
    const expectedByOfficialName: Record<string, number> = {
      'Mercedes-AMG Petronas': 100,
      'Scuderia Ferrari': 98,
      'McLaren F1 Team': 96,
      'Red Bull Racing': 94,
      'Visa Cash App RB': 87,
      'Alpine F1 Team': 87,
      'Audi F1 Team': 86,
      'Haas F1 Team': 75,
      'Williams Racing': 70,
      'Aston Martin Aramco': 60,
      'Cadillac F1 Team': 50,
      'Andretti Global': 45,
    }

    for (const [name, expectedScore] of Object.entries(expectedByOfficialName)) {
      const strength = structuralStrengthService.getTeamStructuralStrength(name)
      expect(strength.structuralStrengthScore).toBe(expectedScore)
      expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength(name)).toBe(
        expectedScore,
      )
    }
  })

  // A2-14: Williams (3 formas) → 70
  it('A2-14: Williams across 3 forms ("williams", "team_williams", "Williams Racing") resolves to 70', () => {
    const forms = ['williams', 'team_williams', 'Williams Racing', 'WILLIAMS']
    for (const form of forms) {
      expect(
        structuralStrengthService.getTeamStructuralStrength(form).structuralStrengthScore,
      ).toBe(70)
      expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength(form)).toBe(70)
    }
  })

  // A2-15: Cadillac (3 formas) → 50
  it('A2-15: Cadillac across 3 forms ("cadillac", "team_cadillac", "Cadillac F1 Team") resolves to 50', () => {
    const forms = ['cadillac', 'team_cadillac', 'Cadillac F1 Team', 'CADILLAC']
    for (const form of forms) {
      expect(
        structuralStrengthService.getTeamStructuralStrength(form).structuralStrengthScore,
      ).toBe(50)
      expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength(form)).toBe(50)
    }
  })

  // A2-16: Audi (3 formas) → 86
  it('A2-16: Audi across 3 forms ("audi", "team_audi", "Audi F1 Team") resolves to 86', () => {
    const forms = ['audi', 'team_audi', 'Audi F1 Team', 'AUDI']
    for (const form of forms) {
      expect(
        structuralStrengthService.getTeamStructuralStrength(form).structuralStrengthScore,
      ).toBe(86)
      expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength(form)).toBe(86)
    }
  })

  // A2-17: Mercedes (3 formas) → 100
  it('A2-17: Mercedes across 3 forms ("mercedes", "team_mercedes", "Mercedes-AMG Petronas") resolves to 100', () => {
    const forms = ['mercedes', 'team_mercedes', 'Mercedes-AMG Petronas', 'MERCEDES']
    for (const form of forms) {
      expect(
        structuralStrengthService.getTeamStructuralStrength(form).structuralStrengthScore,
      ).toBe(100)
      expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength(form)).toBe(100)
    }
  })

  // A2-18: input desconhecido não confundido com as 12 oficiais, diagnosticável
  it('A2-18: genuinely unknown input is not confused with official 12 and remains diagnosable', () => {
    const unknownInputs = ['unknown_entry', 'phantom_gp_team', 'custom_non_f1']
    for (const unknown of unknownInputs) {
      const strength = structuralStrengthService.getTeamStructuralStrength(unknown)
      // Não pode ser uma das âncoras ativas oficiais com dataQuality COMPLETE
      expect(strength.dataQuality).toBe('MISSING')
      expect(strength.dataQualityNotes).toContain('fallback')
    }
  })

  // A2-19: player_team permanece unresolved nesta rodada
  it('A2-19: "player_team" remains unresolved in this round without arbitrary mapping', () => {
    const strength = structuralStrengthService.getTeamStructuralStrength('player_team')
    // Não deve ser associada arbitrariamente a uma equipe oficial
    expect(resolveCanonicalTeamKey('player_team')).toBeNull()
    expect(strength.dataQuality).toBe('MISSING')
  })

  // A2-20: BASELINE_2026_V1_TEAMS numericamente inalterada
  it('A2-20: BASELINE_2026_V1_TEAMS remains strictly untouched and unaltered', () => {
    expect(BASELINE_2026_V1_TEAMS.mercedes.score).toBe(100)
    expect(BASELINE_2026_V1_TEAMS.ferrari.score).toBe(98)
    expect(BASELINE_2026_V1_TEAMS.mclaren.score).toBe(96)
    expect(BASELINE_2026_V1_TEAMS.redbull.score).toBe(94)
    expect(BASELINE_2026_V1_TEAMS.racingbulls.score).toBe(87)
    expect(BASELINE_2026_V1_TEAMS.alpine.score).toBe(87)
    expect(BASELINE_2026_V1_TEAMS.audi.score).toBe(86)
    expect(BASELINE_2026_V1_TEAMS.haas.score).toBe(75)
    expect(BASELINE_2026_V1_TEAMS.williams.score).toBe(70)
    expect(BASELINE_2026_V1_TEAMS.astonmartin.score).toBe(60)
    expect(BASELINE_2026_V1_TEAMS.cadillac.score).toBe(50)
    expect(BASELINE_2026_V1_TEAMS.andretti.score).toBe(45)
  })
})
