/**
 * Helper canônico para resolução de Career ID (APEX GP Manager).
 * Unifica a resolução de identificador de carreira entre season, team e fallback canônico.
 */

export interface CareerIdSourceSeason {
  id?: string | null
  career_id?: string | null
  careerId?: string | null
  [key: string]: any
}

export interface CareerIdSourceTeam {
  id?: string | null
  career_id?: string | null
  careerId?: string | null
  [key: string]: any
}

/**
 * Retorna o careerId canônico da sessão.
 * Regra de precedência:
 * 1. season.career_id / season.careerId
 * 2. season.id
 * 3. team.id (fallback legado caso season não tenha career_id nem id)
 * 4. 'default_career'
 */
export function resolveCanonicalCareerId(
  season?: CareerIdSourceSeason | null,
  team?: CareerIdSourceTeam | null,
): string {
  const seasonCareerId = season?.career_id || season?.careerId
  if (seasonCareerId && typeof seasonCareerId === 'string' && seasonCareerId.trim() !== '') {
    return seasonCareerId.trim()
  }

  const seasonId = season?.id
  if (seasonId && typeof seasonId === 'string' && seasonId.trim() !== '') {
    return seasonId.trim()
  }

  const teamCareerId = team?.career_id || team?.careerId
  if (teamCareerId && typeof teamCareerId === 'string' && teamCareerId.trim() !== '') {
    return teamCareerId.trim()
  }

  const teamId = team?.id
  if (teamId && typeof teamId === 'string' && teamId.trim() !== '') {
    return teamId.trim()
  }

  return 'default_career'
}
