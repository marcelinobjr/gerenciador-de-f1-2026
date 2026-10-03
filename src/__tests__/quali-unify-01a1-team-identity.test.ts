/**
 * quali-unify-01a1-team-identity.test.ts
 *
 * QUALI-UNIFY-01A1 — Micro-Patch Canonical Team Identity Resolver Suite
 *
 * Valida os testes unitários A1-01 a A1-16 chamando o resolver real resolveCanonicalTeamKey
 * sem reimplementar lógica de normalização no teste.
 */

import { describe, it, expect } from 'vitest'
import {
  resolveCanonicalTeamKey,
  CANONICAL_2026_TEAM_KEYS,
  type CanonicalTeamKey,
} from '@/services/canonicalTeamIdentityService'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'

describe('QUALI-UNIFY-01A1: Canonical Team Identity Resolver', () => {
  // A1-01: 'williams' → williams
  it('A1-01: resolves "williams" to "williams"', () => {
    expect(resolveCanonicalTeamKey('williams')).toBe('williams')
  })

  // A1-02: 'team_williams' → williams
  it('A1-02: resolves "team_williams" to "williams"', () => {
    expect(resolveCanonicalTeamKey('team_williams')).toBe('williams')
  })

  // A1-03: 'Williams' → williams
  it('A1-03: resolves "Williams" to "williams"', () => {
    expect(resolveCanonicalTeamKey('Williams')).toBe('williams')
  })

  // A1-04: 'cadillac' → cadillac
  it('A1-04: resolves "cadillac" to "cadillac"', () => {
    expect(resolveCanonicalTeamKey('cadillac')).toBe('cadillac')
  })

  // A1-05: 'team_cadillac' → cadillac
  it('A1-05: resolves "team_cadillac" to "cadillac"', () => {
    expect(resolveCanonicalTeamKey('team_cadillac')).toBe('cadillac')
  })

  // A1-06: 'Red Bull Racing' → red_bull
  it('A1-06: resolves "Red Bull Racing" to "red_bull"', () => {
    expect(resolveCanonicalTeamKey('Red Bull Racing')).toBe('red_bull')
  })

  // A1-07: 'Racing Bulls' → racing_bulls
  it('A1-07: resolves "Racing Bulls" to "racing_bulls"', () => {
    expect(resolveCanonicalTeamKey('Racing Bulls')).toBe('racing_bulls')
  })

  // A1-08: 'Aston Martin' → aston_martin
  it('A1-08: resolves "Aston Martin" to "aston_martin"', () => {
    expect(resolveCanonicalTeamKey('Aston Martin')).toBe('aston_martin')
  })

  // A1-09: aliases legítimos de Audi → audi
  it('A1-09: resolves legitimate aliases of Audi to "audi"', () => {
    const audiAliases = [
      'audi',
      'Audi',
      'team_audi',
      'Audi F1 Team',
      'Audi Revolut',
      'audi_revolut',
      'audi_sport',
      'sauber',
      'Kick Sauber',
    ]
    for (const alias of audiAliases) {
      expect(resolveCanonicalTeamKey(alias)).toBe('audi')
    }
  })

  // A1-10: aliases legítimos de Mercedes → mercedes
  it('A1-10: resolves legitimate aliases of Mercedes to "mercedes"', () => {
    const mercedesAliases = [
      'mercedes',
      'Mercedes',
      'team_mercedes',
      'Mercedes-AMG Petronas',
      'mercedes_amg',
      'Mercedes F1 Team',
    ]
    for (const alias of mercedesAliases) {
      expect(resolveCanonicalTeamKey(alias)).toBe('mercedes')
    }
  })

  // A1-11: as 12 canonical keys resolvem para si mesmas
  it('A1-11: all 12 canonical keys resolve to themselves', () => {
    const expected12Keys: CanonicalTeamKey[] = [
      'mercedes',
      'ferrari',
      'mclaren',
      'red_bull',
      'racing_bulls',
      'alpine',
      'audi',
      'haas',
      'williams',
      'aston_martin',
      'cadillac',
      'andretti',
    ]
    expect(CANONICAL_2026_TEAM_KEYS).toEqual(expected12Keys)
    for (const key of expected12Keys) {
      expect(resolveCanonicalTeamKey(key)).toBe(key)
    }
  })

  // A1-12: as 12 display names oficiais resolvem para a canonical key correta
  it('A1-12: official display names of all 12 teams resolve to their canonical keys', () => {
    expect(OFFICIAL_GRID_TEAMS).toHaveLength(12)
    for (const team of OFFICIAL_GRID_TEAMS) {
      const resolved = resolveCanonicalTeamKey(team.name)
      expect(resolved).not.toBeNull()
      // Deve resolver para uma das 12 chaves canônicas
      expect(CANONICAL_2026_TEAM_KEYS).toContain(resolved)
    }

    // Validações explícitas por escuderia
    expect(resolveCanonicalTeamKey('Mercedes-AMG Petronas')).toBe('mercedes')
    expect(resolveCanonicalTeamKey('Scuderia Ferrari')).toBe('ferrari')
    expect(resolveCanonicalTeamKey('McLaren F1 Team')).toBe('mclaren')
    expect(resolveCanonicalTeamKey('Red Bull Racing')).toBe('red_bull')
    expect(resolveCanonicalTeamKey('Visa Cash App RB')).toBe('racing_bulls')
    expect(resolveCanonicalTeamKey('Alpine F1 Team')).toBe('alpine')
    expect(resolveCanonicalTeamKey('Audi F1 Team')).toBe('audi')
    expect(resolveCanonicalTeamKey('Haas F1 Team')).toBe('haas')
    expect(resolveCanonicalTeamKey('Williams Racing')).toBe('williams')
    expect(resolveCanonicalTeamKey('Aston Martin Aramco')).toBe('aston_martin')
    expect(resolveCanonicalTeamKey('Cadillac F1 Team')).toBe('cadillac')
    expect(resolveCanonicalTeamKey('Andretti Global')).toBe('andretti')
  })

  // A1-13: prefixo team_ funciona para as 12 equipes
  it('A1-13: prefix "team_" works for all 12 canonical teams', () => {
    for (const key of CANONICAL_2026_TEAM_KEYS) {
      expect(resolveCanonicalTeamKey(`team_${key}`)).toBe(key)
    }
  })

  // A1-14: input desconhecido → unresolved explícito (null)
  it('A1-14: unknown input returns explicit unresolved (null)', () => {
    expect(resolveCanonicalTeamKey('unknown_formula_squad')).toBeNull()
    expect(resolveCanonicalTeamKey('phantom_racing')).toBeNull()
    expect(resolveCanonicalTeamKey('')).toBeNull()
    expect(resolveCanonicalTeamKey(null)).toBeNull()
    expect(resolveCanonicalTeamKey(undefined)).toBeNull()
  })

  // A1-15: 'player_team' → unresolved nesta camada pura (não mapear arbitrariamente)
  it('A1-15: "player_team" is unresolved in this pure layer', () => {
    expect(resolveCanonicalTeamKey('player_team')).toBeNull()
    expect(resolveCanonicalTeamKey('playerteam')).toBeNull()
    expect(resolveCanonicalTeamKey({ id: 'player_team' })).toBeNull()
  })

  // A1-16: normalização case-insensitive onde aplicável
  it('A1-16: case-insensitive normalization applies across keys and aliases', () => {
    expect(resolveCanonicalTeamKey('WILLIAMS')).toBe('williams')
    expect(resolveCanonicalTeamKey('Cadillac')).toBe('cadillac')
    expect(resolveCanonicalTeamKey('TEAM_RED_BULL')).toBe('red_bull')
    expect(resolveCanonicalTeamKey('RED BULL RACING')).toBe('red_bull')
    expect(resolveCanonicalTeamKey('rAcInG_bUlLs')).toBe('racing_bulls')
    expect(resolveCanonicalTeamKey('AsToN MaRtIn')).toBe('aston_martin')
    expect(resolveCanonicalTeamKey('MERCEDES')).toBe('mercedes')
    expect(resolveCanonicalTeamKey('audi')).toBe('audi')
    expect(resolveCanonicalTeamKey('AUDI')).toBe('audi')
  })
})
