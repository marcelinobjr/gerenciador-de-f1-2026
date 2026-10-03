/**
 * canonicalTeamIdentityService.ts
 *
 * QUALI-UNIFY-01A — Canonical Team Identity Resolution Service
 *
 * Fornece a resolução unificada e determinística da identidade canônica das equipes
 * para o pipeline de qualifying, balanceamento e performance estrutural da F1 2026.
 *
 * Domínio Canônico das 12 Equipes 2026:
 * - 'mercedes', 'ferrari', 'mclaren', 'redbull', 'racingbulls', 'alpine',
 *   'audi', 'haas', 'williams', 'astonmartin', 'cadillac', 'andretti'
 * - 'custom_team': para equipe personalizada autêntica criada pelo jogador
 */

import { BASELINE_2026_V1_TEAMS } from '@/data/baseline-2026-v1'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'
import { ALL_GRID_TEAMS_DATABASE } from '@/lib/grid-teams-database'
import { TEAM_REDUCED_LOGOS_MANIFEST } from '@/lib/team-reduced-logo-resolver'
import { TEAM_LOGOS } from '@/data/teamLogos'
import type { TeamModel } from '@/types/f1'

export type CanonicalTeamKey =
  | 'mercedes'
  | 'ferrari'
  | 'mclaren'
  | 'redbull'
  | 'racingbulls'
  | 'alpine'
  | 'audi'
  | 'haas'
  | 'williams'
  | 'astonmartin'
  | 'cadillac'
  | 'andretti'

export const CANONICAL_2026_TEAM_KEYS: readonly CanonicalTeamKey[] = [
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

const CANONICAL_KEYS_SET = new Set<string>(CANONICAL_2026_TEAM_KEYS)

/**
 * Tabela canônica de aliases normalizados (sem prefixos, sem underscores, lowercase)
 * mapeados para uma das 12 chaves canônicas da temporada 2026.
 */
const NORMALIZED_ALIASES_MAP: Record<string, CanonicalTeamKey> = {
  // Mercedes
  mercedes: 'mercedes',
  mercedesamg: 'mercedes',
  mercedesamgpetronas: 'mercedes',
  amgpetronas: 'mercedes',
  mercedesf1: 'mercedes',
  mercedesf1team: 'mercedes',

  // Ferrari
  ferrari: 'ferrari',
  scuderiaferrari: 'ferrari',
  scuderiaferrarihp: 'ferrari',
  ferrarihp: 'ferrari',
  ferrarif1: 'ferrari',

  // McLaren
  mclaren: 'mclaren',
  mclarenf1: 'mclaren',
  mclarenf1team: 'mclaren',
  mclarenracing: 'mclaren',
  mclarenmercedes: 'mclaren',
  mclarenformula1: 'mclaren',
  mclarenformula1team: 'mclaren',

  // Red Bull
  redbull: 'redbull',
  redbullracing: 'redbull',
  rbr: 'redbull',
  oracleredbullracing: 'redbull',
  redbullford: 'redbull',

  // Racing Bulls / VCARB
  racingbulls: 'racingbulls',
  rb: 'racingbulls',
  vcarb: 'racingbulls',
  visacashapprb: 'racingbulls',
  visacashapp: 'racingbulls',
  scuderiatellocashapprb: 'racingbulls',
  tororosso: 'racingbulls',
  scuderiatororosso: 'racingbulls',
  alphatauri: 'racingbulls',
  scuderiaalphatauri: 'racingbulls',

  // Alpine
  alpine: 'alpine',
  alpinef1: 'alpine',
  alpinef1team: 'alpine',
  bwtalpine: 'alpine',
  bwtalpinef1team: 'alpine',
  bwtalpinef1: 'alpine',
  renaultalpine: 'alpine',

  // Audi
  audi: 'audi',
  audif1: 'audi',
  audif1team: 'audi',
  audirevolut: 'audi',
  audirevolutf1: 'audi',
  audirevolutf1team: 'audi',
  audisport: 'audi',
  audisportf1: 'audi',
  sauber: 'audi',
  stakef1: 'audi',
  kicksauber: 'audi',
  saubermotorsport: 'audi',
  stakef1teamkicksauber: 'audi',

  // Haas
  haas: 'haas',
  haasf1: 'haas',
  haasf1team: 'haas',
  moneygramhaas: 'haas',
  moneygramhaasf1: 'haas',
  moneygramhaasf1team: 'haas',

  // Williams
  williams: 'williams',
  williamsracing: 'williams',
  williamsf1: 'williams',
  williamsf1team: 'williams',
  williamsmercedes: 'williams',

  // Aston Martin
  astonmartin: 'astonmartin',
  aston: 'astonmartin',
  amr: 'astonmartin',
  astonmartinaramco: 'astonmartin',
  astonmartinaramcof1: 'astonmartin',
  astonmartinaramcoformulaoneteam: 'astonmartin',
  astonmartinf1: 'astonmartin',
  astonmartinf1team: 'astonmartin',

  // Cadillac
  cadillac: 'cadillac',
  cadillacf1: 'cadillac',
  cadillacf1team: 'cadillac',
  cadillacracing: 'cadillac',
  cadillacformula1team: 'cadillac',
  gmcadillac: 'cadillac',
  gmcadillacf1: 'cadillac',

  // Andretti
  andretti: 'andretti',
  andrettiglobal: 'andretti',
  andrettif1: 'andretti',
  andrettif1team: 'andretti',
  andretticadillac: 'andretti',
}

/**
 * Remove acentuação e converte para minúsculas
 */
function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Normaliza uma string de entrada para token alfanumérico compacto:
 * lowercase, trim, remove acentos, remove prefixos 'team_' e 'ai_', remove separadores.
 */
function cleanRawToken(input: string): string {
  let s = stripAccents(input).toLowerCase().trim()
  // Remove prefixos repetidos se presentes
  s = s.replace(/^ai_/, '').replace(/^team_/, '')
  // Também trata se foi ai_team_
  s = s.replace(/^ai_/, '').replace(/^team_/, '')
  // Remove caracteres não alfanuméricos
  return s.replace(/[^a-z0-9]/g, '')
}

/**
 * Normalização primária a partir de um TeamModel parcial ou objeto de equipe.
 * Proibido espalhar replace('team_','') em outros arquivos:
 * todo tratamento de prefixo e extração de campos vive aqui.
 * teams.strength (PocketBase) NÃO participa da resolução.
 */
function extractInputString(input: string | Partial<TeamModel> | null | undefined): {
  rawString: string
  isExplicitCustom?: boolean
  teamKeyField?: string
  teamIdField?: string
  teamNameField?: string
} {
  if (input === null || input === undefined) {
    return { rawString: '' }
  }

  if (typeof input === 'string') {
    return { rawString: input }
  }

  // Objeto TeamModel ou similar
  const isExplicitCustom = input.is_custom === true
  const teamKeyField = input.team_key || ''
  const teamIdField = input.id || ''
  const teamNameField = input.name || ''

  // Precedência de campos: team_key > id > name
  const candidate = teamKeyField || teamIdField || teamNameField || ''

  return {
    rawString: candidate,
    isExplicitCustom,
    teamKeyField,
    teamIdField,
    teamNameField,
  }
}

/**
 * Diagnóstico explícito emitido quando um input tenta representar uma equipe oficial
 * mas não pode ser resolvido com certeza para o catálogo canônico 2026.
 */
export interface UnresolvedTeamDiagnostic {
  code: 'UNRESOLVED_OFFICIAL_TEAM_IDENTITY'
  input: string
  details: string
  suggestedAction: string
}

export function createUnresolvedDiagnostic(
  input: string,
  details?: string,
): UnresolvedTeamDiagnostic {
  return {
    code: 'UNRESOLVED_OFFICIAL_TEAM_IDENTITY',
    input,
    details:
      details ||
      `A identidade de equipe informada '${input}' não pôde ser mapeada para nenhuma das 12 equipes oficiais 2026.`,
    suggestedAction:
      'Verificar se o identificador, alias ou binding de equipe corresponde ao catálogo oficial de 2026.',
  }
}

/**
 * Resolve a identidade canônica de uma equipe para a temporada 2026.
 *
 * @param input String (chave, alias, display name, id com prefixo) ou Partial<TeamModel>
 * @returns CanonicalTeamKey | 'custom_team'
 */
export function resolveCanonicalTeamKey(
  input: string | Partial<TeamModel> | null | undefined,
): CanonicalTeamKey | 'custom_team' {
  const { rawString, isExplicitCustom, teamKeyField, teamIdField, teamNameField } =
    extractInputString(input)

  // 1. Se explicitamente marcada como customizada (sem vínculo a equipe oficial)
  if (isExplicitCustom) {
    // Mas se tiver um team_key ou id que resolva para uma oficial, a oficial tem precedência (ex.: jogador assumiu time oficial)
    if (
      teamKeyField &&
      teamKeyField !== 'custom' &&
      teamKeyField !== 'custom_team' &&
      teamKeyField !== 'player_team'
    ) {
      const resolvedFromKey = resolveCanonicalTeamKey(teamKeyField)
      if (resolvedFromKey !== 'custom_team') {
        return resolvedFromKey
      }
    }
    // Caso contrário, é genuinamente uma equipe customizada criada pelo jogador
    return 'custom_team'
  }

  if (!rawString || !rawString.trim()) {
    return 'custom_team'
  }

  // 2. Normalização do token
  const token = cleanRawToken(rawString)

  // Se o token for exatamente indicador de custom ou player genérico sem oficial
  if (
    token === 'custom' ||
    token === 'customteam' ||
    token === 'minhaequipe' ||
    token === 'suaescuderia' ||
    token === 'escuderiabrasil' ||
    token === 'escuderiaapexbrasil' ||
    token === 'apexbrasil'
  ) {
    return 'custom_team'
  }

  // 3. Caso especial 'player_team':
  // 'player_team' NÃO é identidade final: se veio acompanhado de objeto com name ou id que aponta para oficial,
  // ou se um dos campos aponta para equipe real, resolver para ela.
  if (token === 'playerteam') {
    if (teamKeyField && teamKeyField !== 'player_team') {
      const fromKey = resolveCanonicalTeamKey(teamKeyField)
      if (fromKey !== 'custom_team') return fromKey
    }
    if (
      teamNameField &&
      teamNameField !== 'player_team' &&
      teamNameField !== 'Escuderia Apex Brasil'
    ) {
      const fromName = resolveCanonicalTeamKey(teamNameField)
      if (fromName !== 'custom_team') return fromName
    }
    // Sem equipe oficial vinculada -> 'custom_team'
    return 'custom_team'
  }

  // 4. Verificação direta contra as 12 chaves canônicas (exata)
  if (CANONICAL_KEYS_SET.has(token)) {
    return token as CanonicalTeamKey
  }

  // 5. Verificação no mapa consolidado de aliases normalizados
  if (token in NORMALIZED_ALIASES_MAP) {
    return NORMALIZED_ALIASES_MAP[token]
  }

  // 6. Verificação no catálogo canônico BASELINE_2026_V1_TEAMS
  for (const [canonKey, entry] of Object.entries(BASELINE_2026_V1_TEAMS)) {
    const entryToken = cleanRawToken(canonKey)
    const nameToken = cleanRawToken(entry.teamName)
    if (token === entryToken || token === nameToken) {
      return canonKey as CanonicalTeamKey
    }
  }

  // 7. Verificação no catálogo OFFICIAL_GRID_TEAMS
  for (const team of OFFICIAL_GRID_TEAMS) {
    const kToken = cleanRawToken(team.key)
    const nToken = cleanRawToken(team.name)
    if (token === kToken || token === nToken) {
      if (CANONICAL_KEYS_SET.has(team.key)) {
        return team.key as CanonicalTeamKey
      }
      if (NORMALIZED_ALIASES_MAP[kToken]) {
        return NORMALIZED_ALIASES_MAP[kToken]
      }
    }
  }

  // 8. Verificação no catálogo ALL_GRID_TEAMS_DATABASE
  for (const team of ALL_GRID_TEAMS_DATABASE) {
    const kToken = cleanRawToken(team.key)
    const nToken = cleanRawToken(team.name)
    const sToken = cleanRawToken(team.shortName || '')
    if (token === kToken || token === nToken || (sToken && token === sToken)) {
      if (CANONICAL_KEYS_SET.has(team.key)) {
        return team.key as CanonicalTeamKey
      }
      if (NORMALIZED_ALIASES_MAP[kToken]) {
        return NORMALIZED_ALIASES_MAP[kToken]
      }
    }
  }

  // 9. Verificação nos aliases do TEAM_REDUCED_LOGOS_MANIFEST
  for (const [manifestKey, item] of Object.entries(TEAM_REDUCED_LOGOS_MANIFEST)) {
    const mToken = cleanRawToken(manifestKey)
    const dToken = cleanRawToken(item.displayName)
    if (token === mToken || token === dToken) {
      if (CANONICAL_KEYS_SET.has(manifestKey)) return manifestKey as CanonicalTeamKey
      if (NORMALIZED_ALIASES_MAP[mToken]) return NORMALIZED_ALIASES_MAP[mToken]
    }
    for (const alias of item.aliases) {
      const aToken = cleanRawToken(alias)
      if (token === aToken) {
        if (CANONICAL_KEYS_SET.has(manifestKey)) return manifestKey as CanonicalTeamKey
        if (NORMALIZED_ALIASES_MAP[mToken]) return NORMALIZED_ALIASES_MAP[mToken]
        if (NORMALIZED_ALIASES_MAP[aToken]) return NORMALIZED_ALIASES_MAP[aToken]
      }
    }
  }

  // 10. Verificação nos aliases de TEAM_LOGOS
  for (const [logoKey, item] of Object.entries(TEAM_LOGOS)) {
    const lToken = cleanRawToken(logoKey)
    const dToken = cleanRawToken(item.displayName)
    if (token === lToken || token === dToken) {
      if (CANONICAL_KEYS_SET.has(logoKey)) return logoKey as CanonicalTeamKey
      if (NORMALIZED_ALIASES_MAP[lToken]) return NORMALIZED_ALIASES_MAP[lToken]
    }
    if (item.aliases) {
      for (const alias of item.aliases) {
        const aToken = cleanRawToken(alias)
        if (token === aToken) {
          if (CANONICAL_KEYS_SET.has(logoKey)) return logoKey as CanonicalTeamKey
          if (NORMALIZED_ALIASES_MAP[lToken]) return NORMALIZED_ALIASES_MAP[lToken]
          if (NORMALIZED_ALIASES_MAP[aToken]) return NORMALIZED_ALIASES_MAP[aToken]
        }
      }
    }
  }

  // 11. Match por inclusão de substring robusta (ex: 'williams' contido em token, ou token contido em display)
  for (const canonKey of CANONICAL_2026_TEAM_KEYS) {
    if (token.includes(canonKey) || canonKey.includes(token)) {
      return canonKey
    }
  }

  // 12. Se nada casar, emitir diagnóstico caso pareça tentativa de oficial
  // Se for desconhecido genuíno:
  return 'custom_team'
}

/**
 * Helper com diagnóstico estrito para o caminho de Qualifying.
 * Se o input não resolver para uma equipe das 12 e não for explicitamente customizado,
 * lança ou registra diagnóstico explícito UNRESOLVED_OFFICIAL_TEAM_IDENTITY.
 */
export function resolveQualifyingTeamIdentity(
  input: string | Partial<TeamModel> | null | undefined,
  options?: { strict?: boolean },
): {
  canonicalKey: CanonicalTeamKey | 'custom_team'
  diagnostic: UnresolvedTeamDiagnostic | null
} {
  const resolved = resolveCanonicalTeamKey(input)
  const { rawString, isExplicitCustom } = extractInputString(input)
  const token = cleanRawToken(rawString)

  // Se resultou em custom_team mas o input aparentava ser uma equipe oficial (não vazia e não explicitamente custom)
  const isLikelyCustom =
    !token ||
    isExplicitCustom ||
    token === 'custom' ||
    token === 'customteam' ||
    token === 'playerteam'

  if (resolved === 'custom_team' && !isLikelyCustom) {
    const diagnostic = createUnresolvedDiagnostic(rawString)
    if (options?.strict) {
      throw new Error(`[QUALI-IDENTITY] ${diagnostic.code}: ${diagnostic.details}`)
    }
    return {
      canonicalKey: 'custom_team',
      diagnostic,
    }
  }

  return {
    canonicalKey: resolved,
    diagnostic: null,
  }
}
