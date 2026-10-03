import { describe, it, expect } from 'vitest'
import {
  resolveCanonicalTeamKey,
  getCanonicalQualifyingStructuralStrength,
  CANONICAL_F1_2026_TEAM_KEYS,
} from '@/services/canonicalTeamIdentityService'
import { BASELINE_2026_V1_TEAMS } from '@/types/structural-strength'

describe('QUALI-UNIFY-01A — CANONICAL TEAM IDENTITY RESOLVER', () => {
  // QUA01A-01: 'williams' -> williams
  it('QUA01A-01: resolve "williams" para chave canônica williams', () => {
    expect(resolveCanonicalTeamKey('williams')).toBe('williams')
  })

  // QUA01A-02: 'team_williams' -> williams
  it('QUA01A-02: resolve "team_williams" para chave canônica williams', () => {
    expect(resolveCanonicalTeamKey('team_williams')).toBe('williams')
  })

  // QUA01A-03: display name Williams -> williams
  it('QUA01A-03: resolve display name "Williams" e "Williams Racing" para williams', () => {
    expect(resolveCanonicalTeamKey('Williams')).toBe('williams')
    expect(resolveCanonicalTeamKey('Williams Racing')).toBe('williams')
  })

  // QUA01A-04: 'cadillac' -> cadillac
  it('QUA01A-04: resolve "cadillac" para chave canônica cadillac', () => {
    expect(resolveCanonicalTeamKey('cadillac')).toBe('cadillac')
  })

  // QUA01A-05: 'team_cadillac' -> cadillac
  it('QUA01A-05: resolve "team_cadillac" para chave canônica cadillac', () => {
    expect(resolveCanonicalTeamKey('team_cadillac')).toBe('cadillac')
  })

  // QUA01A-06: todas as 12 equipes resolvem
  it('QUA01A-06: todas as 12 equipes da F1 2026 resolvem corretamente', () => {
    const expectations: Record<string, string> = {
      mercedes: 'mercedes',
      ferrari: 'ferrari',
      mclaren: 'mclaren',
      redbull: 'redbull',
      racingbulls: 'racingbulls',
      alpine: 'alpine',
      audi: 'audi',
      haas: 'haas',
      williams: 'williams',
      astonmartin: 'astonmartin',
      cadillac: 'cadillac',
      andretti: 'andretti',
    }

    for (const [input, expectedKey] of Object.entries(expectations)) {
      expect(resolveCanonicalTeamKey(input)).toBe(expectedKey)
      expect(resolveCanonicalTeamKey(`team_${input}`)).toBe(expectedKey)
      expect(CANONICAL_F1_2026_TEAM_KEYS).toContain(expectedKey)
    }
  })

  // QUA01A-07: player e AI convergem para mesma canonical key
  it('QUA01A-07: player (com record/objeto) e AI convergem para a mesma canonicalTeamKey', () => {
    // Player com objeto estilo PocketBase ou team model
    const playerWilliams = {
      id: 'rec_williams_pb123',
      name: 'Williams Racing',
      team_key: 'williams',
    }
    const aiWilliams = 'team_williams'

    const keyPlayer = resolveCanonicalTeamKey(playerWilliams)
    const keyAI = resolveCanonicalTeamKey(aiWilliams)

    expect(keyPlayer).toBe('williams')
    expect(keyAI).toBe('williams')
    expect(keyPlayer).toBe(keyAI)
  })

  // QUA01A-08: Williams resolve Structural=70
  it('QUA01A-08: Williams resolve Structural Strength = 70 (baseline 2026)', () => {
    const strength = getCanonicalQualifyingStructuralStrength('team_williams')
    expect(strength.structuralStrengthScore).toBe(70)
    expect(strength.structuralStrengthScore).toBe(BASELINE_2026_V1_TEAMS.williams.score)
  })

  // QUA01A-09: Cadillac=50
  it('QUA01A-09: Cadillac resolve Structural Strength = 50 (baseline 2026)', () => {
    const strength = getCanonicalQualifyingStructuralStrength('team_cadillac')
    expect(strength.structuralStrengthScore).toBe(50)
    expect(strength.structuralStrengthScore).toBe(BASELINE_2026_V1_TEAMS.cadillac.score)
  })

  // QUA01A-10: Mercedes=100
  it('QUA01A-10: Mercedes resolve Structural Strength = 100 (baseline 2026)', () => {
    const strength = getCanonicalQualifyingStructuralStrength('team_mercedes')
    expect(strength.structuralStrengthScore).toBe(100)
    expect(strength.structuralStrengthScore).toBe(BASELINE_2026_V1_TEAMS.mercedes.score)
  })

  // QUA01A-11: Audi=86
  it('QUA01A-11: Audi resolve Structural Strength = 86 (baseline 2026)', () => {
    const strength = getCanonicalQualifyingStructuralStrength('team_audi')
    expect(strength.structuralStrengthScore).toBe(86)
    expect(strength.structuralStrengthScore).toBe(BASELINE_2026_V1_TEAMS.audi.score)
  })

  // QUA01A-12: input não resolvível NÃO vira silenciosamente ~73.4 no caminho oficial
  it('QUA01A-12: input não resolvível lança erro explícito e NÃO cai em fallback silencioso de 73.4', () => {
    expect(() => {
      getCanonicalQualifyingStructuralStrength('equipe_inexistente_xyz_123', {
        allowFallback: false,
      })
    }).toThrow(
      /não pôde ser resolvida para uma identidade canônica 2026\. Proibido fallback silencioso/,
    )

    // Com allowFallback explícito, dataQuality é MISSING e nunca COMPLETE
    const fallback = getCanonicalQualifyingStructuralStrength('equipe_inexistente_xyz_123', {
      allowFallback: true,
    })
    expect(fallback.dataQuality).toBe('MISSING')
  })
})
