import { describe, it, expect } from 'vitest'
import {
  resolveCanonicalTeamKey,
  resolveCanonicalTeamKeyFromContext,
  CANONICAL_2026_TEAM_KEYS,
  type CanonicalTeamKey,
  type TeamResolutionContext,
} from '@/services/canonicalTeamIdentityService'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { canonicalPaceIntegrationService } from '@/services/canonicalPaceIntegrationService'
import { BASELINE_2026_V1_TEAMS } from '@/data/baseline-2026-v1'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'

describe('QUALI-UNIFY-01A3: Contextual Player and PocketBase Team IDs Resolution', () => {
  // A3-01: resolveCanonicalTeamKey('player_team') → null (puro intacto)
  it('A3-01: pure resolver returns null for "player_team"', () => {
    expect(resolveCanonicalTeamKey('player_team')).toBeNull()
    expect(resolveCanonicalTeamKey('playerteam')).toBeNull()
  })

  // A3-02/03: contexto player Mercedes → mercedes; Structural 100
  it('A3-02/03: player context for Mercedes resolves to "mercedes" and Structural 100', () => {
    const ctx: TeamResolutionContext = {
      rawTeamIdentity: 'player_team',
      teamId: 'player_team',
      team: {
        id: 'pb_rec_merc_999',
        name: 'Mercedes-AMG Petronas F1 Team',
        team_key: 'mercedes',
      },
    }
    const resolved = resolveCanonicalTeamKeyFromContext(ctx)
    expect(resolved).toBe('mercedes')
    const strength = structuralStrengthService.getTeamStructuralStrength(resolved!)
    expect(strength.structuralStrengthScore).toBe(100)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength(resolved!)).toBe(100)
  })

  // A3-04/05: player Audi → audi; 86 (não stale)
  it('A3-04/05: player context for Audi resolves to "audi" and Structural 86 (not stale)', () => {
    const ctx: TeamResolutionContext = {
      rawTeamIdentity: 'player_team',
      teamId: 'player_team',
      team: {
        id: 'pb_rec_audi_777',
        name: 'Audi Revolut F1 Team',
        team_key: 'audi',
        strength: 20 as any, // Stale DB field - must be completely ignored
      },
    }
    const resolved = resolveCanonicalTeamKeyFromContext(ctx)
    expect(resolved).toBe('audi')
    const strength = structuralStrengthService.getTeamStructuralStrength(resolved!)
    expect(strength.structuralStrengthScore).toBe(86)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength(resolved!)).toBe(86)
  })

  // A3-06/07: player Williams → williams; 70
  it('A3-06/07: player context for Williams resolves to "williams" and Structural 70', () => {
    const ctx: TeamResolutionContext = {
      rawTeamIdentity: 'player_team',
      teamId: 'player_team',
      team: {
        id: 'pb_rec_wms_123',
        name: 'Williams Racing',
        team_key: 'williams',
        strength: 99 as any, // Stale DB field - must be completely ignored
      },
    }
    const resolved = resolveCanonicalTeamKeyFromContext(ctx)
    expect(resolved).toBe('williams')
    const strength = structuralStrengthService.getTeamStructuralStrength(resolved!)
    expect(strength.structuralStrengthScore).toBe(70)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength(resolved!)).toBe(70)
  })

  // A3-08/09: player Cadillac → cadillac; 50
  it('A3-08/09: player context for Cadillac resolves to "cadillac" and Structural 50', () => {
    const ctx: TeamResolutionContext = {
      rawTeamIdentity: 'player_team',
      teamId: 'player_team',
      team: {
        id: 'pb_rec_cad_456',
        name: 'Cadillac F1 Team',
        team_key: 'cadillac',
      },
    }
    const resolved = resolveCanonicalTeamKeyFromContext(ctx)
    expect(resolved).toBe('cadillac')
    const strength = structuralStrengthService.getTeamStructuralStrength(resolved!)
    expect(strength.structuralStrengthScore).toBe(50)
    expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength(resolved!)).toBe(50)
  })

  // A3-10: player pode controlar cada uma das 12 — para cada contexto válido, player_team → canonical key correta
  it('A3-10: player can control each of the 12 teams - resolves accurately for each valid context', () => {
    for (const team of OFFICIAL_GRID_TEAMS) {
      const ctx: TeamResolutionContext = {
        rawTeamIdentity: 'player_team',
        teamId: 'player_team',
        team: {
          id: `dyn_id_${team.key}`,
          name: team.name,
          team_key: team.key,
        },
      }
      const resolved = resolveCanonicalTeamKeyFromContext(ctx)
      const expectedCanon = resolveCanonicalTeamKey(team.key)
      expect(resolved).toBe(expectedCanon)
      expect(resolved).not.toBeNull()
    }
  })

  // A3-11: para as 12, Player canonical == AI canonical
  it('A3-11: for all 12 teams, Player canonical key === AI canonical key', () => {
    for (const team of OFFICIAL_GRID_TEAMS) {
      const aiCanonical = resolveCanonicalTeamKey(`team_${team.key}`)
      const playerCtx: TeamResolutionContext = {
        rawTeamIdentity: 'player_team',
        team: {
          team_key: team.key,
          name: team.name,
        },
      }
      const playerCanonical = resolveCanonicalTeamKeyFromContext(playerCtx)
      expect(playerCanonical).toBe(aiCanonical)
    }
  })

  // A3-12/13/14: PocketBase team record representando Audi/Williams/Cadillac → audi/86, williams/70, cadillac/50, sem record.strength
  it('A3-12/13/14: PocketBase team records for Audi, Williams, Cadillac resolve dynamically without record.strength', () => {
    const availableTeams = [
      { id: 'pb_rec_audi_rnd01', name: 'Audi Revolut F1 Team', team_key: 'audi', strength: 25 },
      { id: 'pb_rec_wms_rnd02', name: 'Williams Racing', team_key: 'williams', strength: 95 },
      { id: 'pb_rec_cad_rnd03', name: 'Cadillac F1 Team', team_key: 'cadillac', strength: 80 },
    ]

    // Audi
    const audiRes = resolveCanonicalTeamKeyFromContext({
      teamId: 'pb_rec_audi_rnd01',
      availableTeams,
    })
    expect(audiRes).toBe('audi')
    expect(
      structuralStrengthService.getTeamStructuralStrength(audiRes!).structuralStrengthScore,
    ).toBe(86)

    // Williams
    const wmsRes = resolveCanonicalTeamKeyFromContext({
      teamId: 'pb_rec_wms_rnd02',
      availableTeams,
    })
    expect(wmsRes).toBe('williams')
    expect(
      structuralStrengthService.getTeamStructuralStrength(wmsRes!).structuralStrengthScore,
    ).toBe(70)

    // Cadillac
    const cadRes = resolveCanonicalTeamKeyFromContext({
      teamId: 'pb_rec_cad_rnd03',
      availableTeams,
    })
    expect(cadRes).toBe('cadillac')
    expect(
      structuralStrengthService.getTeamStructuralStrength(cadRes!).structuralStrengthScore,
    ).toBe(50)
  })

  // A3-15: record id desconhecido sem dados → unresolved explícito
  it('A3-15: unknown record ID without data/catalog mapping returns explicit null', () => {
    const res = resolveCanonicalTeamKeyFromContext({
      teamId: 'unknown_pb_id_999999',
      availableTeams: [],
    })
    expect(res).toBeNull()
  })

  // A3-16: player_team sem contexto → unresolved explícito, sem fallback estrutural
  it('A3-16: "player_team" without context returns explicit null without structural fallback', () => {
    const res = resolveCanonicalTeamKeyFromContext({
      rawTeamIdentity: 'player_team',
      teamId: 'player_team',
    })
    expect(res).toBeNull()
  })

  // A3-17: fixture Audi strength=20 mesmo assim Structural=86
  it('A3-17: fixture Audi with DB strength=20 still results in Structural 86', () => {
    const ctx: TeamResolutionContext = {
      team: {
        id: 'some_id',
        name: 'Audi Revolut',
        team_key: 'audi',
        strength: 20 as any,
      },
    }
    const resolved = resolveCanonicalTeamKeyFromContext(ctx)
    expect(resolved).toBe('audi')
    expect(
      structuralStrengthService.getTeamStructuralStrength(resolved!).structuralStrengthScore,
    ).toBe(86)
  })

  // A3-18: fixture Williams strength=99 mesmo assim Structural=70
  it('A3-18: fixture Williams with DB strength=99 still results in Structural 70', () => {
    const ctx: TeamResolutionContext = {
      team: {
        id: 'some_id_2',
        name: 'Williams Racing',
        team_key: 'williams',
        strength: 99 as any,
      },
    }
    const resolved = resolveCanonicalTeamKeyFromContext(ctx)
    expect(resolved).toBe('williams')
    expect(
      structuralStrengthService.getTeamStructuralStrength(resolved!).structuralStrengthScore,
    ).toBe(70)
  })

  // A3-19: AI team_williams → williams → 70 (regressão A2)
  it('A3-19: regression A2 - AI team_williams resolves to williams and Structural 70', () => {
    const resolved = resolveCanonicalTeamKey('team_williams')
    expect(resolved).toBe('williams')
    expect(
      structuralStrengthService.getTeamStructuralStrength(resolved!).structuralStrengthScore,
    ).toBe(70)
  })

  // A3-20: AI team_cadillac → cadillac → 50
  it('A3-20: regression A2 - AI team_cadillac resolves to cadillac and Structural 50', () => {
    const resolved = resolveCanonicalTeamKey('team_cadillac')
    expect(resolved).toBe('cadillac')
    expect(
      structuralStrengthService.getTeamStructuralStrength(resolved!).structuralStrengthScore,
    ).toBe(50)
  })

  // A3-21: 12 âncoras permanecem 100/98/96/94/87/87/86/75/70/60/50/45
  it('A3-21: all 12 anchors strictly remain 100, 98, 96, 94, 87, 87, 86, 75, 70, 60, 50, 45', () => {
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

    for (const [key, score] of Object.entries(expectedAnchors)) {
      expect(structuralStrengthService.getTeamStructuralStrength(key).structuralStrengthScore).toBe(
        score,
      )
      expect(canonicalPaceIntegrationService.resolveBaseStructuralStrength(key)).toBe(score)
    }
  })

  // A3-22: nenhum caminho oficial Player/AI das 12 termina em fallback ~73.4
  it('A3-22: no official Player or AI path of the 12 teams terminates in generic fallback ~73.4', () => {
    for (const team of OFFICIAL_GRID_TEAMS) {
      // AI path
      const aiResolved = resolveCanonicalTeamKey(team.key)!
      const aiScore =
        structuralStrengthService.getTeamStructuralStrength(aiResolved).structuralStrengthScore
      expect(aiScore).not.toBeCloseTo(73.4, 0.5)

      // Player path
      const playerCtx: TeamResolutionContext = {
        rawTeamIdentity: 'player_team',
        team: { team_key: team.key, name: team.name },
      }
      const playerResolved = resolveCanonicalTeamKeyFromContext(playerCtx)!
      const playerScore =
        structuralStrengthService.getTeamStructuralStrength(playerResolved).structuralStrengthScore
      expect(playerScore).not.toBeCloseTo(73.4, 0.5)
      expect(playerScore).toBe(aiScore)
    }
  })

  // A3-23: A1-01..16 verdes (validação de regressão A1 inline)
  it('A3-23: A1 pure identity resolution guarantees hold', () => {
    expect(resolveCanonicalTeamKey('mercedes')).toBe('mercedes')
    expect(resolveCanonicalTeamKey('team_mercedes')).toBe('mercedes')
    expect(resolveCanonicalTeamKey('ferrari')).toBe('ferrari')
    expect(resolveCanonicalTeamKey('team_ferrari')).toBe('ferrari')
    expect(resolveCanonicalTeamKey('mclaren')).toBe('mclaren')
    expect(resolveCanonicalTeamKey('team_mclaren')).toBe('mclaren')
    expect(resolveCanonicalTeamKey('redbull')).toBe('red_bull')
    expect(resolveCanonicalTeamKey('team_redbull')).toBe('red_bull')
    expect(resolveCanonicalTeamKey('racingbulls')).toBe('racing_bulls')
    expect(resolveCanonicalTeamKey('team_racingbulls')).toBe('racing_bulls')
    expect(resolveCanonicalTeamKey('alpine')).toBe('alpine')
    expect(resolveCanonicalTeamKey('team_alpine')).toBe('alpine')
    expect(resolveCanonicalTeamKey('audi')).toBe('audi')
    expect(resolveCanonicalTeamKey('team_audi')).toBe('audi')
    expect(resolveCanonicalTeamKey('haas')).toBe('haas')
    expect(resolveCanonicalTeamKey('team_haas')).toBe('haas')
    expect(resolveCanonicalTeamKey('williams')).toBe('williams')
    expect(resolveCanonicalTeamKey('team_williams')).toBe('williams')
    expect(resolveCanonicalTeamKey('astonmartin')).toBe('aston_martin')
    expect(resolveCanonicalTeamKey('team_astonmartin')).toBe('aston_martin')
    expect(resolveCanonicalTeamKey('cadillac')).toBe('cadillac')
    expect(resolveCanonicalTeamKey('team_cadillac')).toBe('cadillac')
    expect(resolveCanonicalTeamKey('andretti')).toBe('andretti')
    expect(resolveCanonicalTeamKey('team_andretti')).toBe('andretti')
  })

  // A3-24: A2-01..20 verdes (validação de integridade estrutural A2)
  it('A3-24: A2 structural baseline and anchors integrity hold', () => {
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

    expect(
      structuralStrengthService.getTeamStructuralStrength('williams').structuralStrengthScore,
    ).toBe(70)
    expect(
      structuralStrengthService.getTeamStructuralStrength('team_williams').structuralStrengthScore,
    ).toBe(70)
    expect(
      structuralStrengthService.getTeamStructuralStrength('cadillac').structuralStrengthScore,
    ).toBe(50)
    expect(
      structuralStrengthService.getTeamStructuralStrength('team_cadillac').structuralStrengthScore,
    ).toBe(50)
    expect(
      structuralStrengthService.getTeamStructuralStrength('audi').structuralStrengthScore,
    ).toBe(86)
    expect(
      structuralStrengthService.getTeamStructuralStrength('team_audi').structuralStrengthScore,
    ).toBe(86)
  })
})
