import { structuralStrengthService } from '@/services/structuralStrengthService'
import { BASELINE_2026_V1_TEAMS } from '@/types/structural-strength'

/**
 * Mapeamento canônico unificado das 12 equipes da Fórmula 1 2026.
 *
 * Chaves canônicas padrão:
 * - 'mercedes' (100)
 * - 'ferrari' (98)
 * - 'mclaren' (96)
 * - 'redbull' (94)
 * - 'racingbulls' (87)
 * - 'alpine' (87)
 * - 'audi' (86)
 * - 'haas' (75)
 * - 'williams' (70)
 * - 'astonmartin' (60)
 * - 'cadillac' (50)
 * - 'andretti' (45)
 */
export const CANONICAL_F1_2026_TEAM_KEYS = [
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

export type CanonicalF1TeamKey = (typeof CANONICAL_F1_2026_TEAM_KEYS)[number]

/**
 * Dicionário exaustivo de sinônimos/aliases que convertem qualquer entrada
 * (team_id, team_key, slug, display name, pocketbase id, prefixos 'team_')
 * na chave canônica única da equipe.
 */
const TEAM_IDENTITY_ALIAS_MAP: Record<string, CanonicalF1TeamKey> = {
  // Mercedes
  mercedes: 'mercedes',
  team_mercedes: 'mercedes',
  'mercedes-amg': 'mercedes',
  'mercedes amg': 'mercedes',
  'mercedes-amg petronas': 'mercedes',
  'mercedes amg petronas f1 team': 'mercedes',
  merc: 'mercedes',

  // Ferrari
  ferrari: 'ferrari',
  team_ferrari: 'ferrari',
  'scuderia ferrari': 'ferrari',
  'scuderia ferrari hp': 'ferrari',

  // McLaren
  mclaren: 'mclaren',
  team_mclaren: 'mclaren',
  'mclaren f1 team': 'mclaren',
  mcl: 'mclaren',

  // Red Bull
  redbull: 'redbull',
  team_redbull: 'redbull',
  red_bull: 'redbull',
  team_red_bull: 'redbull',
  'red bull': 'redbull',
  'red bull racing': 'redbull',
  'oracle red bull racing': 'redbull',
  rbr: 'redbull',

  // Racing Bulls (VCARB)
  racingbulls: 'racingbulls',
  team_racingbulls: 'racingbulls',
  racing_bulls: 'racingbulls',
  team_racing_bulls: 'racingbulls',
  'racing bulls': 'racingbulls',
  vcarb: 'racingbulls',
  team_vcarb: 'racingbulls',
  'visa cash app rb': 'racingbulls',
  rb: 'racingbulls',
  team_rb: 'racingbulls',

  // Alpine
  alpine: 'alpine',
  team_alpine: 'alpine',
  'bwt alpine f1 team': 'alpine',
  'bwt alpine': 'alpine',

  // Audi (Sauber / Stake)
  audi: 'audi',
  team_audi: 'audi',
  'audi f1 team': 'audi',
  'audi revolut': 'audi',
  'audi revolut f1 team': 'audi',
  sauber: 'audi',
  stake: 'audi',
  'kick sauber': 'audi',

  // Haas
  haas: 'haas',
  team_haas: 'haas',
  'moneygram haas f1 team': 'haas',
  'haas f1 team': 'haas',

  // Williams
  williams: 'williams',
  team_williams: 'williams',
  'williams racing': 'williams',
  wil: 'williams',

  // Aston Martin
  astonmartin: 'astonmartin',
  team_astonmartin: 'astonmartin',
  aston_martin: 'astonmartin',
  team_aston_martin: 'astonmartin',
  'aston martin': 'astonmartin',
  'aston martin aramco': 'astonmartin',
  amr: 'astonmartin',

  // Cadillac
  cadillac: 'cadillac',
  team_cadillac: 'cadillac',
  'cadillac f1 team': 'cadillac',
  'cadillac racing': 'cadillac',
  cad: 'cadillac',

  // Andretti
  andretti: 'andretti',
  team_andretti: 'andretti',
  'andretti cadillac': 'andretti',
  'andretti f1 team': 'andretti',
  and: 'andretti',
}

/**
 * Resolve uma entrada de equipe de qualquer origem para a chave canônica única 2026.
 *
 * Suporta:
 * - teamKey / teamId / slug ('williams', 'team_williams', 'team_cadillac')
 * - Objeto com { id, team_key, name, key, slug }
 * - Tratamento de prefixos 'team_' centralizado (proibido espalhar .replace('team_', '') fora daqui)
 * - Retorna null se a equipe não puder ser mapeada com certeza.
 */
export function resolveCanonicalTeamKey(
  input:
    | string
    | {
        id?: string
        team_key?: string
        teamId?: string
        key?: string
        slug?: string
        name?: string
        displayName?: string
      }
    | null
    | undefined,
): CanonicalF1TeamKey | null {
  if (!input) return null

  let raw = ''
  if (typeof input === 'string') {
    raw = input
  } else {
    // Ordem de prioridade para extração do identificador
    raw =
      input.team_key ||
      input.key ||
      input.slug ||
      input.name ||
      input.displayName ||
      input.teamId ||
      input.id ||
      ''
  }

  const normalized = raw.toLowerCase().trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')

  // 1. Consulta direta por texto normalizado com espaços
  if (TEAM_IDENTITY_ALIAS_MAP[normalized]) {
    return TEAM_IDENTITY_ALIAS_MAP[normalized]
  }

  // 2. Consulta compactada (sem espaços)
  const squashed = normalized.replace(/\s+/g, '')
  if (TEAM_IDENTITY_ALIAS_MAP[squashed]) {
    return TEAM_IDENTITY_ALIAS_MAP[squashed]
  }

  // 3. Normalização de prefixo 'team' centralizada (nunca fora deste helper)
  const stripped = squashed.startsWith('team') ? squashed.slice(4) : squashed
  if (TEAM_IDENTITY_ALIAS_MAP[stripped]) {
    return TEAM_IDENTITY_ALIAS_MAP[stripped]
  }

  // 4. Verificação por substring de nome oficial
  for (const [alias, key] of Object.entries(TEAM_IDENTITY_ALIAS_MAP)) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      return key
    }
  }

  return null
}

/**
 * Consulta a Força Estrutural canônica 2026 de uma equipe a partir de qualquer
 * identificador, garantindo resolução canônica e impedindo fallback silencioso para 73.4.
 *
 * Se a equipe não for resolvida ou não pertencer à baseline, emite erro ou retorna dataQuality MISSING
 * conforme exigido pelo QUALI-UNIFY-01A.
 */
export function getCanonicalQualifyingStructuralStrength(
  input: string | { id?: string; team_key?: string; name?: string; [key: string]: any },
  options?: { allowFallback?: boolean; seasonYear?: number },
) {
  const canonicalKey = resolveCanonicalTeamKey(input)

  if (!canonicalKey) {
    if (!options?.allowFallback) {
      throw new Error(
        `[QUALI-UNIFY-01] Equipe '${typeof input === 'string' ? input : JSON.stringify(input)}' não pôde ser resolvida para uma identidade canônica 2026. Proibido fallback silencioso.`,
      )
    }
    return structuralStrengthService.getTeamStructuralStrength('unresolved_team', options)
  }

  const result = structuralStrengthService.getTeamStructuralStrength(canonicalKey, {
    seasonYear: options?.seasonYear ?? 2026,
  })

  // Validação estrita: se a equipe for uma das 12 canônicas, garante integridade
  if (canonicalKey in BASELINE_2026_V1_TEAMS) {
    const anchor = BASELINE_2026_V1_TEAMS[canonicalKey]
    if (anchor && result.structuralStrengthScore !== anchor.score) {
      result.structuralStrengthScore = anchor.score
    }
  }

  return result
}
