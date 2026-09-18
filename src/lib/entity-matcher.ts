/**
 * Normalizador e Casador Resiliente de Entidades (Pilotos e Equipes)
 * com tolerância rigorosa a erros tipográficos, prefixos e aliases.
 *
 * Requisitos:
 * - Ignorar maiúsculas/minúsculas e acentos (NFD).
 * - Tratar espaço, underscore e hífen como separadores equivalentes.
 * - Remover extensão (.jpg, .png, .webp).
 * - Desconsiderar prefixos numéricos ("05-", "3-") e sufixos de cópia ("(1)", "copia", "-5ea8a").
 * - Tolerar pequenas inserções, omissões, repetições e inversões de letras.
 * - PRESERVAR distinguidores cruciais:
 *     * Mick Schumacher != outro Schumacher (ex: Michael, Ralf)
 *     * Nelson Piquet Jr. != Nelson Piquet
 *     * Equipe Fittipaldi != Pietro Fittipaldi
 *     * Red Bull Racing != Racing Bulls
 * - Se houver ambiguidade (dois candidatos plausíveis próximos), registrar como ambíguo para revisão.
 * - Resolver sempre para o ID oficial da entidade, nunca alterar a grafia canônica do cadastro.
 */

export interface MatchCandidate {
  id: string
  name: string
  type: 'driver' | 'team'
  aliases?: string[]
}

export interface MatchResult {
  matched: boolean
  entityId?: string
  entityName?: string
  entityType?: 'driver' | 'team'
  method?: 'exact_id' | 'exact_normalized' | 'alias' | 'fuzzy_approximation' | 'manual'
  score: number // 0 a 1
  isAmbiguous?: boolean
  candidateAlternatives?: string[]
  reason?: string
}

/**
 * Remove diacríticos, pontuação secundária e padroniza separadores
 */
export function normalizeCleanName(input: string): string {
  if (!input) return ''

  let str = input.trim()

  // 1. Remover extensão de arquivo se houver
  str = str.replace(/\.(jpg|jpeg|png|webp|svg|gif)$/i, '')

  // 2. Remover sufixos de hash do Vite/Dropbox/cópia ex: "-5ea8a", "(1)", "_copia"
  str = str.replace(/[-_][a-f0-9]{5,}$/i, '')
  str = str.replace(/\(\d+\)$/i, '')
  str = str.replace(/[-_]copia$/i, '')

  // 3. Remover prefixos numéricos como "05-", "3-", "77-"
  str = str.replace(/^\d+[-_\s]+/, '')

  // 4. Decompor diacríticos (acentos)
  str = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  // 5. Normalizar separadores (_, -, múltiplos espaços) para um único espaço
  str = str.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()

  return str
}

/**
 * Distância de Levenshtein padrão entre duas strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a.length
  const bn = b.length
  if (an === 0) return bn
  if (bn === 0) return an

  const matrix: number[][] = []

  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          matrix[i][j - 1] + 1, // inserção
          matrix[i - 1][j] + 1, // deleção
        )
      }
    }
  }

  return matrix[bn][an]
}

/**
 * Similaridade baseada em Levenshtein normalizada (0 a 1)
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  const dist = levenshteinDistance(a, b)
  return Math.max(0, 1 - dist / maxLen)
}

/**
 * Mapa de aliases conhecidos para pilotos e equipes (com erros comuns de digitação)
 */
export const KNOWN_DRIVER_ALIASES: Record<string, string> = {
  // Lando Norris
  'lando noris': 'Lando Norris',
  '4 lando noris': 'Lando Norris',
  // Valtteri Bottas
  'walteri botas': 'Valtteri Bottas',
  '77 walteri botas': 'Valtteri Bottas',
  'valteri bottas': 'Valtteri Bottas',
  'valteri botas': 'Valtteri Bottas',
  // George Russell
  'george russel': 'George Russell',
  '63 george russel': 'George Russell',
  // Liam Lawson
  'lian lawson': 'Liam Lawson',
  '30 lian lawson': 'Liam Lawson',
  // Nico Hülkenberg
  'nuco hulkemberg': 'Nico Hülkenberg',
  '27 nuco hulkemberg': 'Nico Hülkenberg',
  'nico hulkenberg': 'Nico Hülkenberg',
  'nuco hulkenberg': 'Nico Hülkenberg',
  // Mick Schumacher
  'mick shumacher': 'Mick Schumacher',
  '47 mick shumacher': 'Mick Schumacher',
  // Jean-Éric Vergne
  'jean eric vergne': 'Jean-Éric Vergne',
  '25 jean eric vergne': 'Jean-Éric Vergne',
  // Oliver Bearman
  'olivier bearman': 'Oliver Bearman',
  '87 olivier bearman': 'Oliver Bearman',
  // Kamui Kobayashi
  'kamui kobaiashi': 'Kamui Kobayashi',
  // Chase Elliott
  'chase elliot': 'Chase Elliott',
  // Nelson Piquet Jr
  'nelson piquet jr': 'Nelson Piquet Jr.',
  '8 nelson piquet jr': 'Nelson Piquet Jr.',
  // Pietro Fittipaldi
  '51 pietro fittipaldi': 'Pietro Fittipaldi',
  // Gabriel Bortoleto
  '05 gabriel bortoleto': 'Gabriel Bortoleto',
  '5 gabriel bortoleto': 'Gabriel Bortoleto',
  'gabriel bortoletto': 'Gabriel Bortoleto',
  // Rafael Câmara
  'rafael camara': 'Rafael Câmara',
  '1 rafael camara': 'Rafael Câmara',
  // Sergio Pérez
  'checo perez': 'Sergio Pérez',
  'sergio perez': 'Sergio Pérez',
  '11 sergio perez': 'Sergio Pérez',
  // Kimi Antonelli
  'andrea kimi antonelli': 'Andrea Kimi Antonelli',
  'kimi antonelli': 'Andrea Kimi Antonelli',
  '12 kimi antonelli': 'Andrea Kimi Antonelli',
}

export const KNOWN_TEAM_ALIASES: Record<string, string> = {
  porshe: 'Porsche',
  renaut: 'Renault',
  'alfa tauri': 'AlphaTauri',
  cadilac: 'Cadillac',
  'red bull': 'Red Bull Racing',
  'red bull racing': 'Red Bull Racing',
  'racing bulls': 'Visa Cash App RB F1 Team',
  vcarb: 'Visa Cash App RB F1 Team',
  rb: 'Visa Cash App RB F1 Team',
  sauber: 'Stake F1 Team Kick Sauber',
  audi: 'Audi F1 Team',
}

/**
 * Verifica se dois nomes possuem distinguidores críticos que impedem casamento incorreto:
 * Ex: "Piquet Jr" != "Piquet"
 * Ex: "Mick Schumacher" != "Michael Schumacher"
 * Ex: "Pietro Fittipaldi" != "Fittipaldi" (equipe)
 * Ex: "Red Bull Racing" != "Racing Bulls"
 */
export function hasConflictingDistinguishers(inputNorm: string, targetNorm: string): boolean {
  // Jr distinguisher
  const inputHasJr = /\bjr\b|\bjunior\b/.test(inputNorm)
  const targetHasJr = /\bjr\b|\bjunior\b/.test(targetNorm)
  if (inputHasJr !== targetHasJr) {
    return true
  }

  // Schumacher distinguisher (Mick vs Michael/Ralf)
  if (inputNorm.includes('schumacher') && targetNorm.includes('schumacher')) {
    const inputMick = inputNorm.includes('mick')
    const targetMick = targetNorm.includes('mick')
    if (inputMick !== targetMick) {
      return true
    }
  }

  // Red Bull Racing vs Racing Bulls
  const inputIsRacingBulls = inputNorm.includes('racing bulls') || inputNorm === 'rb'
  const targetIsRacingBulls = targetNorm.includes('racing bulls') || targetNorm === 'rb'
  if (inputIsRacingBulls !== targetIsRacingBulls) {
    if (inputNorm.includes('red bull') || targetNorm.includes('red bull')) {
      return true
    }
  }

  return false
}

/**
 * Casa um nome de arquivo ou string de entrada com uma lista de entidades candidatas.
 */
export function matchEntity(
  input: string,
  candidates: MatchCandidate[],
  options: {
    minScoreThreshold?: number // Default 0.75
    ambiguityMargin?: number // Default 0.10
    entityTypeFilter?: 'driver' | 'team'
  } = {},
): MatchResult {
  const minScore = options.minScoreThreshold ?? 0.75
  const margin = options.ambiguityMargin ?? 0.1

  const filteredCandidates = options.entityTypeFilter
    ? candidates.filter((c) => c.type === options.entityTypeFilter)
    : candidates

  if (!input || filteredCandidates.length === 0) {
    return { matched: false, score: 0, reason: 'Entrada vazia ou sem candidatos' }
  }

  // 1. Tentativa de casamento por ID direto
  const byId = filteredCandidates.find((c) => c.id === input)
  if (byId) {
    return {
      matched: true,
      entityId: byId.id,
      entityName: byId.name,
      entityType: byId.type,
      method: 'exact_id',
      score: 1.0,
    }
  }

  const clean = normalizeCleanName(input)
  if (!clean) {
    return { matched: false, score: 0, reason: 'Nome limpo resultou em string vazia' }
  }

  // 2. Casamento exato pós-normalização com nome da entidade
  for (const c of filteredCandidates) {
    const cNorm = normalizeCleanName(c.name)
    if (clean === cNorm) {
      return {
        matched: true,
        entityId: c.id,
        entityName: c.name,
        entityType: c.type,
        method: 'exact_normalized',
        score: 1.0,
      }
    }
  }

  // 3. Casamento por Aliases Conhecidos
  const aliasTarget = KNOWN_DRIVER_ALIASES[clean] || KNOWN_TEAM_ALIASES[clean]
  if (aliasTarget) {
    const aliasNorm = normalizeCleanName(aliasTarget)
    const matchedCandidate = filteredCandidates.find((c) => {
      const cNorm = normalizeCleanName(c.name)
      return (
        cNorm === aliasNorm ||
        (c.aliases && c.aliases.some((a) => normalizeCleanName(a) === aliasNorm))
      )
    })
    if (matchedCandidate) {
      return {
        matched: true,
        entityId: matchedCandidate.id,
        entityName: matchedCandidate.name,
        entityType: matchedCandidate.type,
        method: 'alias',
        score: 0.98,
      }
    }
  }

  // Também verificar aliases registrados nos próprios candidatos
  for (const c of filteredCandidates) {
    if (c.aliases) {
      for (const a of c.aliases) {
        if (normalizeCleanName(a) === clean) {
          return {
            matched: true,
            entityId: c.id,
            entityName: c.name,
            entityType: c.type,
            method: 'alias',
            score: 0.96,
          }
        }
      }
    }
  }

  // 4. Casamento por aproximação (Fuzzy Match no conjunto do nome completo)
  interface ScoredCandidate {
    candidate: MatchCandidate
    score: number
  }

  const scored: ScoredCandidate[] = []

  for (const c of filteredCandidates) {
    const cNorm = normalizeCleanName(c.name)

    // Previne conflitos cruciais de distinção (ex: Jr, Mick vs Michael)
    if (hasConflictingDistinguishers(clean, cNorm)) {
      continue
    }

    // Calcula similaridade no nome completo
    let sim = stringSimilarity(clean, cNorm)

    // Se o candidato tiver aliases, considera a melhor pontuação
    if (c.aliases) {
      for (const a of c.aliases) {
        const aNorm = normalizeCleanName(a)
        if (!hasConflictingDistinguishers(clean, aNorm)) {
          const aSim = stringSimilarity(clean, aNorm)
          if (aSim > sim) sim = aSim
        }
      }
    }

    // Se os tokens coincidirem de forma forte (ex: "Verstappen Max" vs "Max Verstappen")
    const cleanTokens = clean.split(' ').sort()
    const targetTokens = cNorm.split(' ').sort()
    if (cleanTokens.join(' ') === targetTokens.join(' ')) {
      sim = Math.max(sim, 0.95)
    }

    if (sim >= minScore) {
      scored.push({ candidate: c, score: sim })
    }
  }

  scored.sort((a, b) => b.score - a.score)

  if (scored.length === 0) {
    return {
      matched: false,
      score: 0,
      reason: 'Nenhuma entidade atingiu a pontuação mínima de similaridade',
    }
  }

  const best = scored[0]

  // Detecção de ambiguidade se houver segundo candidato muito próximo
  if (scored.length > 1) {
    const second = scored[1]
    if (best.score - second.score < margin) {
      return {
        matched: false,
        score: best.score,
        isAmbiguous: true,
        candidateAlternatives: [best.candidate.name, second.candidate.name],
        reason: `Ambiguidade detectada entre "${best.candidate.name}" e "${second.candidate.name}" (diferença < ${margin})`,
      }
    }
  }

  return {
    matched: true,
    entityId: best.candidate.id,
    entityName: best.candidate.name,
    entityType: best.candidate.type,
    method: 'fuzzy_approximation',
    score: Number(best.score.toFixed(3)),
  }
}
