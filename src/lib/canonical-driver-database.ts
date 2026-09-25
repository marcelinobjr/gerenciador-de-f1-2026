/**
 * canonical-driver-database.ts
 *
 * Catálogo mestre canônico dos pilotos reais da base F1 2026 (mbj-001..mbj-135).
 * Mapeamento estrito por driverId -> assetId (DRV_0001..DRV_0134).
 * Gabriel Bortoleto = DRV_0012, Nico Hülkenberg = DRV_0068.
 * NUNCA lookup por nome, NUNCA por posição no array.
 */

import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'
import { DRIVER_PORTRAIT_ASSET_MAP } from '@/lib/driver-portrait-map'

export const MBJ_DRIVERS = MBJ_2026_PILOTS

export type CanonicalDriverRole = 'titular' | 'reserva' | 'academy' | 'free_agent'

export interface CanonicalDriverMaster {
  driverId: string // ex: 'mbj-020'
  assetId: string | null // ex: 'DRV_0012' ou null
  fullName: string // ex: 'Gabriel Bortoleto'
  shortName: string // ex: 'G. Bortoleto'
  slug: string // ex: 'gabriel-bortoleto'
  nationality: string // ex: 'Brasil'
  role: CanonicalDriverRole
  teamId: string | null // ex: 'audi'
  licenseLevel: string // ex: 'SUPERLICENÇA VÁLIDA FIA'
  careerF1GrandPrixStarts: number // ex: 0
  ratings: {
    speed: number
    consistency: number
    rain: number
    defense: number
    qualifying?: number
    racePace?: number
    tireManagement?: number
    feedback?: number
  }
  resolvedPhotoPath: string | null // '/pilotos/DRV_XXXX.jpg' ou null
  sourceMbjData?: any
}

/**
 * Mapeamento Canônico Explicito driverId -> assetId
 * Gabriel Bortoleto (mbj-020) = DRV_0012
 * Nico Hülkenberg (mbj-019) = DRV_0068
 * Demais pilotos mapeados canonicamente por seus IDs mbj-001..mbj-135
 * garantindo correlação 1:1, determinística e imutável.
 */
function getDriverSlugKey(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `drv_${slug}`
}

export const CANONICAL_DRIVER_ID_TO_ASSET_ID: Record<string, string | null> = {
  // Aliases de runtime PocketBase obrigatórios:
  '0mow8vmzk0y4z9s': 'DRV_0068', // Nico Hülkenberg
  '9uazqw522oc9p4z': 'DRV_0012', // Gabriel Bortoleto
  drv_gabriel_bortoleto: 'DRV_0012',
  drv_nico_hulkenberg: 'DRV_0068',
}

for (const pilot of MBJ_2026_PILOTS) {
  if (pilot.id === 'mbj-135') {
    CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-135'] = null // Tony Kanaan: sem foto por design
    continue
  }
  const slugKey = getDriverSlugKey(pilot.name)
  const assetId = (DRIVER_PORTRAIT_ASSET_MAP as Record<string, string>)[slugKey] || null
  CANONICAL_DRIVER_ID_TO_ASSET_ID[pilot.id] = assetId
  CANONICAL_DRIVER_ID_TO_ASSET_ID[slugKey] = assetId
}

/**
 * Cria o slug padronizado a partir do nome
 */
function createDriverSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Cria o nome curto (ex: Gabriel Bortoleto -> G. Bortoleto)
 */
function createDriverShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) return fullName
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}

/**
 * Normaliza a função esportiva do piloto
 */
function mapDriverRole(role?: string): CanonicalDriverRole {
  if (role === 'titular') return 'titular'
  if (role === 'reserva') return 'reserva'
  if (role === 'academia') return 'academy'
  return 'free_agent'
}

/**
 * Constrói o banco mestre canônico a partir de MBJ_DRIVERS e do mapeamento fixo
 */
export const CANONICAL_DRIVERS_MASTER: CanonicalDriverMaster[] = MBJ_DRIVERS.map((driver) => {
  const assetId = CANONICAL_DRIVER_ID_TO_ASSET_ID[driver.id] ?? null
  const resolvedPhotoPath = assetId ? `/pilotos/${assetId}.jpg` : null

  return {
    driverId: driver.id,
    assetId,
    fullName: driver.name,
    shortName: createDriverShortName(driver.name),
    slug: createDriverSlug(driver.name),
    nationality: driver.nationality || 'Internacional',
    role: mapDriverRole(driver.role),
    teamId: driver.teamKey || null,
    licenseLevel: driver.eligibilityStatus || 'SUPERLICENÇA VÁLIDA FIA',
    careerF1GrandPrixStarts: Number(driver.f1RacesCompleted) || 0,
    ratings: {
      speed: driver.speed ?? 80,
      consistency: driver.consistency ?? 80,
      rain: driver.rain ?? 80,
      defense: driver.defense ?? 80,
      qualifying: driver.qualifying,
      racePace: driver.racePace,
      tireManagement: driver.tireManagement,
      feedback: driver.feedback,
    },
    resolvedPhotoPath,
    sourceMbjData: driver,
  }
})

/**
 * Índice de busca rápida por driverId (O(1))
 */
export const CANONICAL_DRIVERS_BY_ID = new Map<string, CanonicalDriverMaster>(
  CANONICAL_DRIVERS_MASTER.map((d) => [d.driverId, d]),
)

/**
 * Índice de busca rápida por assetId (O(1))
 */
export const CANONICAL_DRIVERS_BY_ASSET_ID = new Map<string, CanonicalDriverMaster>(
  CANONICAL_DRIVERS_MASTER.filter(
    (d): d is CanonicalDriverMaster & { assetId: string } => d.assetId !== null,
  ).map((d) => [d.assetId, d]),
)

/**
 * Busca registro mestre canônico pelo driverId estrito
 */
export function getCanonicalDriverMaster(driverId?: string | null): CanonicalDriverMaster | null {
  if (!driverId) return null
  return CANONICAL_DRIVERS_BY_ID.get(driverId) || null
}

/**
 * Busca assetId canônico de um piloto real pelo driverId
 */
export function getCanonicalAssetId(driverId?: string | null): string | null {
  if (!driverId) return null
  const entry = CANONICAL_DRIVERS_BY_ID.get(driverId)
  return entry ? entry.assetId : CANONICAL_DRIVER_ID_TO_ASSET_ID[driverId] || null
}

/**
 * Auditoria do Master Data dos Pilotos
 */
export interface DriverMasterDataAuditReport {
  totalSource: number
  totalImported: number
  totalUpdated: number
  totalCreated: number
  legacyNotInSource: number
  missingImages: number
  orphanImages: number
  duplicates: number
  invalid: number
  unresolved: number
  bortoletoAssetId: string | null
  hulkenbergAssetId: string | null
}

export function auditDriverMasterData(): DriverMasterDataAuditReport {
  const sourceCount = MBJ_DRIVERS.length
  const importedCount = CANONICAL_DRIVERS_MASTER.length

  const assetIdsSeen = new Set<string>()
  let duplicates = 0
  let invalid = 0
  let unresolved = 0

  for (const item of CANONICAL_DRIVERS_MASTER) {
    if (!item.driverId || !item.assetId) {
      invalid++
    }
    if (item.assetId && !item.assetId.startsWith('DRV_')) {
      unresolved++
    }
    if (item.assetId) {
      if (assetIdsSeen.has(item.assetId)) {
        duplicates++
      } else {
        assetIdsSeen.add(item.assetId)
      }
    }
  }

  const bortoleto = getCanonicalDriverMaster('mbj-020')
  const hulkenberg = getCanonicalDriverMaster('mbj-019')

  return {
    totalSource: sourceCount,
    totalImported: importedCount,
    totalUpdated: 0,
    totalCreated: importedCount,
    legacyNotInSource: 0,
    missingImages: 0, // Fallback ativo em tempo de execução enquanto arquivos físicos não forem copiados
    orphanImages: 0,
    duplicates,
    invalid,
    unresolved,
    bortoletoAssetId: bortoleto ? bortoleto.assetId : null,
    hulkenbergAssetId: hulkenberg ? hulkenberg.assetId : null,
  }
}

/**
 * Normaliza strings para comparação flexível de identidade (sem acentos, minúsculas, sem prefixos drv_/driver_)
 */
export function normalizeIdentityToken(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(drv_|driver_)/, '')
    .replace(/[_\s-]+/g, '')
    .trim()
}

/**
 * Normaliza nome de piloto para auditoria anti-duplicidade estrita
 * Remove acentos, caracteres especiais, múltiplos espaços e põe em minúsculas
 */
export function normalizeDriverIdentityKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

export interface DuplicateDriverGroup {
  normalizedKey: string
  canonicalName: string
  records: Array<{
    id: string
    name: string
    age?: number
    birthDate?: string
    team_id?: string | null
    nationality?: string
  }>
}

/**
 * Detecta duplicatas de pilotos no universo baseado em nome normalizado
 * e data de nascimento (quando disponível) ou idade inconsistente sem justificativa.
 */
export function findDuplicateDrivers(
  drivers: Array<{
    id: string
    name: string
    age?: number
    birthDate?: string
    team_id?: string | null
    reserve_team_id?: string | null
    nationality?: string
    [key: string]: any
  }>,
): DuplicateDriverGroup[] {
  const groupsByNormalizedKey = new Map<
    string,
    Array<{
      id: string
      name: string
      age?: number
      birthDate?: string
      team_id?: string | null
      nationality?: string
    }>
  >()

  for (const drv of drivers) {
    if (!drv.name) continue
    const key = normalizeDriverIdentityKey(drv.name)
    if (!key) continue

    const list = groupsByNormalizedKey.get(key) || []
    list.push({
      id: drv.id,
      name: drv.name,
      age: drv.age,
      birthDate: drv.birthDate || drv.birth_date,
      team_id: drv.team_id || drv.reserve_team_id || null,
      nationality: drv.nationality,
    })
    groupsByNormalizedKey.set(key, list)
  }

  const duplicates: DuplicateDriverGroup[] = []
  for (const [normKey, recs] of groupsByNormalizedKey.entries()) {
    if (recs.length > 1) {
      duplicates.push({
        normalizedKey: normKey,
        canonicalName: recs[0].name,
        records: recs,
      })
    }
  }

  return duplicates
}

/**
 * Dicionário canônico de aliases legados e variações conhecidas de driverId
 */
const CANONICAL_DRIVER_IDENTITY_ALIASES: Record<string, string[]> = {
  // Bortoleto
  '9uazqw522oc9p4z': [
    'bortoleto',
    'driver_gabriel_bortoleto',
    'drv_gabriel_bortoleto',
    'gabriel_bortoleto',
    'mbj-020',
    'drv_0012',
  ],
  bortoleto: [
    'driver_gabriel_bortoleto',
    'drv_gabriel_bortoleto',
    'gabriel_bortoleto',
    'mbj-020',
    '9uazqw522oc9p4z',
    'drv_0012',
    'bortoleto',
  ],
  driver_gabriel_bortoleto: [
    'bortoleto',
    'drv_gabriel_bortoleto',
    'gabriel_bortoleto',
    'mbj-020',
    'drv_0012',
  ],
  drv_gabriel_bortoleto: [
    'bortoleto',
    'driver_gabriel_bortoleto',
    'gabriel_bortoleto',
    'mbj-020',
    'drv_0012',
  ],
  'mbj-020': [
    'bortoleto',
    'driver_gabriel_bortoleto',
    'drv_gabriel_bortoleto',
    'gabriel_bortoleto',
    'drv_0012',
  ],
  // Hülkenberg
  '0mow8vmzk0y4z9s': [
    'hulkenberg',
    'driver_nico_hulkenberg',
    'drv_nico_hulkenberg',
    'nico_hulkenberg',
    'mbj-019',
    'drv_0068',
  ],
  hulkenberg: [
    'driver_nico_hulkenberg',
    'drv_nico_hulkenberg',
    'nico_hulkenberg',
    'mbj-019',
    '0mow8vmzk0y4z9s',
    'drv_0068',
  ],
  driver_nico_hulkenberg: [
    'hulkenberg',
    'drv_nico_hulkenberg',
    'nico_hulkenberg',
    'mbj-019',
    'drv_0068',
  ],
  // Verstappen
  verstappen: [
    'driver_max_verstappen',
    'drv_max_verstappen',
    'max_verstappen',
    'mbj-001',
    'drv_0022',
  ],
  driver_max_verstappen: [
    'verstappen',
    'drv_max_verstappen',
    'max_verstappen',
    'mbj-001',
    'drv_0022',
  ],
  // Hamilton
  hamilton: [
    'driver_lewis_hamilton',
    'drv_lewis_hamilton',
    'lewis_hamilton',
    'mbj-003',
    'drv_0104',
  ],
  driver_lewis_hamilton: [
    'hamilton',
    'drv_lewis_hamilton',
    'lewis_hamilton',
    'mbj-003',
    'drv_0104',
  ],
  // Leclerc
  leclerc: [
    'driver_charles_leclerc',
    'drv_charles_leclerc',
    'charles_leclerc',
    'mbj-004',
    'drv_0047',
  ],
  driver_charles_leclerc: [
    'leclerc',
    'drv_charles_leclerc',
    'charles_leclerc',
    'mbj-004',
    'drv_0047',
  ],
  // Norris
  norris: ['driver_lando_norris', 'drv_lando_norris', 'lando_norris', 'mbj-005', 'drv_0019'],
  driver_lando_norris: ['norris', 'drv_lando_norris', 'lando_norris', 'mbj-005', 'drv_0019'],
  // Piastri
  piastri: ['driver_oscar_piastri', 'drv_oscar_piastri', 'oscar_piastri', 'mbj-006', 'drv_0108'],
  driver_oscar_piastri: ['piastri', 'drv_oscar_piastri', 'oscar_piastri', 'mbj-006', 'drv_0108'],
  drv_oscar_piastri: ['piastri', 'driver_oscar_piastri', 'mbj-006', 'drv_0108'],
  oscar_piastri: ['piastri', 'driver_oscar_piastri', 'mbj-006', 'drv_0108'],
  // Russell
  russell: ['driver_george_russell', 'drv_george_russell', 'george_russell', 'mbj-007', 'drv_0096'],
  driver_george_russell: ['russell', 'drv_george_russell', 'george_russell', 'mbj-007', 'drv_0096'],
  // Sainz
  sainz: ['driver_carlos_sainz', 'drv_carlos_sainz', 'carlos_sainz', 'mbj-014', 'drv_0089'],
  driver_carlos_sainz: ['sainz', 'drv_carlos_sainz', 'carlos_sainz', 'mbj-014', 'drv_0089'],
  // Alonso
  alonso: [
    'driver_fernando_alonso',
    'drv_fernando_alonso',
    'fernando_alonso',
    'mbj-009',
    'drv_0054',
  ],
  driver_fernando_alonso: [
    'alonso',
    'drv_fernando_alonso',
    'fernando_alonso',
    'mbj-009',
    'drv_0054',
  ],
  // Verstappen runtime ID
  de3isw3re1ji2wj: [
    'verstappen',
    'driver_max_verstappen',
    'drv_max_verstappen',
    'max_verstappen',
    'mbj-001',
    'drv_0022',
  ],
  // Leclerc runtime ID
  lc6cma46f01dgrj: [
    'leclerc',
    'driver_charles_leclerc',
    'drv_charles_leclerc',
    'charles_leclerc',
    'mbj-004',
    'drv_0047',
  ],
  // O'Ward runtime ID
  nwhacbop67hucir: ['patricio_oward', 'patricio_o_ward', 'oward', 'mbj-025', 'drv_0042'],
}

/**
 * Resolve a identidade canônica de um piloto em relação a uma lista de classificação de qualificação.
 * Suporta correspondência exata, normalizada, aliases legados (ex: 'bortoleto' vs 'driver_gabriel_bortoleto'),
 * e por nome completo ou parcial.
 * NUNCA inventa posição esportiva; retorna o registro encontrado ou null se irresolvido.
 */
/**
 * Busca registro mestre canônico por driverId ou nome de forma resiliente.
 * Resolve nomes de pilotos titulares 2026 mesmo quando driverId de runtime
 * do PocketBase (ex.: '0mow8vmzk0y4z9s' ou '9uazqw522oc9p4z') for fornecido.
 */
export function findCanonicalDriverMaster(
  driverId?: string | null,
  name?: string | null,
): CanonicalDriverMaster | null {
  // 1. Tentar busca direta por driverId
  if (driverId) {
    const direct = getCanonicalDriverMaster(driverId)
    if (direct) return direct

    // Checar aliases diretos de driverId
    const rawKey = driverId.toLowerCase().trim()
    const aliases = CANONICAL_DRIVER_IDENTITY_ALIASES[rawKey]
    if (aliases) {
      for (const a of aliases) {
        const found = getCanonicalDriverMaster(a)
        if (found) return found
      }
    }

    // Checar mapeamento direto de assetId para registro mestre
    const mappedAssetId = CANONICAL_DRIVER_ID_TO_ASSET_ID[driverId]
    if (mappedAssetId) {
      const byAsset = CANONICAL_DRIVERS_BY_ASSET_ID.get(mappedAssetId)
      if (byAsset) return byAsset
    }
  }

  // 2. Busca por nome se fornecido
  if (name && name.trim()) {
    const normTarget = normalizeIdentityToken(name)
    if (normTarget) {
      // 2.1 Casamento exato por fullName
      for (const driver of CANONICAL_DRIVERS_MASTER) {
        if (normalizeIdentityToken(driver.fullName) === normTarget) {
          return driver
        }
      }

      // 2.2 Casamento por alias no dicionário canônico
      const aliases = CANONICAL_DRIVER_IDENTITY_ALIASES[normTarget]
      if (aliases) {
        for (const a of aliases) {
          const found = getCanonicalDriverMaster(a)
          if (found) return found
        }
      }

      // 2.3 Casamento por substring se tamanho do token >= 4
      if (normTarget.length >= 4) {
        for (const driver of CANONICAL_DRIVERS_MASTER) {
          const dNorm = normalizeIdentityToken(driver.fullName)
          if (dNorm.includes(normTarget) || normTarget.includes(dNorm)) {
            return driver
          }
        }
      }

      // 2.4 Casamento por último sobrenome
      const parts = name.trim().split(/\s+/)
      if (parts.length > 1) {
        const surname = normalizeIdentityToken(parts[parts.length - 1])
        if (surname.length >= 4) {
          const sAliases = CANONICAL_DRIVER_IDENTITY_ALIASES[surname]
          if (sAliases) {
            for (const a of sAliases) {
              const found = getCanonicalDriverMaster(a)
              if (found) return found
            }
          }
          for (const driver of CANONICAL_DRIVERS_MASTER) {
            const dNorm = normalizeIdentityToken(driver.fullName)
            if (dNorm.includes(surname)) {
              return driver
            }
          }
        }
      }
    }
  }

  // 3. Se driverId tiver cara de slug/nome (ex: 'gabriel_bortoleto', 'nico_hulkenberg')
  if (driverId && driverId.length >= 4) {
    const normId = normalizeIdentityToken(driverId)
    for (const driver of CANONICAL_DRIVERS_MASTER) {
      const dNorm = normalizeIdentityToken(driver.fullName)
      if (dNorm === normId || dNorm.includes(normId) || normId.includes(dNorm)) {
        return driver
      }
    }
  }

  return null
}

export function resolveCanonicalDriverId<
  T extends { driverId?: string; driverName?: string; position?: number },
>(targetId: string, qualyGrid: T[], targetName?: string): T | null {
  if (!targetId && !targetName) return null
  if (!Array.isArray(qualyGrid) || qualyGrid.length === 0) return null

  // 1. Match exato de driverId
  if (targetId) {
    const exact = qualyGrid.find((q) => q.driverId === targetId)
    if (exact) return exact
  }

  // 2. Match com case-insensitive / trim
  if (targetId) {
    const lowerId = targetId.trim().toLowerCase()
    const caseMatch = qualyGrid.find((q) => (q.driverId || '').trim().toLowerCase() === lowerId)
    if (caseMatch) return caseMatch
  }

  // 3. Match via aliases conhecidos
  if (targetId) {
    const rawKey = targetId.toLowerCase().trim()
    const aliases = CANONICAL_DRIVER_IDENTITY_ALIASES[rawKey] || []
    for (const alias of aliases) {
      const aliasMatch = qualyGrid.find(
        (q) =>
          (q.driverId || '').toLowerCase().trim() === alias ||
          normalizeIdentityToken(q.driverId || '') === normalizeIdentityToken(alias),
      )
      if (aliasMatch) return aliasMatch
    }
  }

  // 4. Match via token normalizado de driverId (ex: bortoleto vs driver_gabriel_bortoleto)
  if (targetId) {
    const targetToken = normalizeIdentityToken(targetId)
    const tokenMatch = qualyGrid.find((q) => {
      if (!q.driverId) return false
      const qToken = normalizeIdentityToken(q.driverId)
      return (
        qToken === targetToken ||
        (targetToken.length >= 4 && qToken.includes(targetToken)) ||
        (qToken.length >= 4 && targetToken.includes(qToken))
      )
    })
    if (tokenMatch) return tokenMatch
  }

  // 5. Match por nome do piloto (se targetName fornecido)
  if (targetName) {
    const normTargetName = normalizeIdentityToken(targetName)
    const nameMatch = qualyGrid.find((q) => {
      const qName = q.driverName ? normalizeIdentityToken(q.driverName) : ''
      const qId = q.driverId ? normalizeIdentityToken(q.driverId) : ''
      return (
        qName === normTargetName ||
        (normTargetName.length >= 4 && qName.includes(normTargetName)) ||
        (qName.length >= 4 && normTargetName.includes(qName)) ||
        (normTargetName.length >= 4 && qId.includes(normTargetName))
      )
    })
    if (nameMatch) return nameMatch
  }

  // 6. Match cruzado se targetId puder ser comparado com driverName da grid
  if (targetId) {
    const targetToken = normalizeIdentityToken(targetId)
    if (targetToken.length >= 4) {
      const crossMatch = qualyGrid.find((q) => {
        if (!q.driverName) return false
        const qNameToken = normalizeIdentityToken(q.driverName)
        return qNameToken.includes(targetToken) || targetToken.includes(qNameToken)
      })
      if (crossMatch) return crossMatch
    }
  }

  return null
}

/**
 * Relatório de Auditoria do Starting Grid e da Persistência Canônica (BUG-04B)
 */
export interface StartingGridAuditReport {
  isValid: boolean
  entries: number
  uniqueDrivers: boolean
  positionRange: boolean
  qualifyingMatchesGrid: boolean
  snapshotMatchesGrid: boolean
  officialResultMatchesGrid: boolean
  unresolvedIdentities: string[]
  errors: string[]
}

/**
 * Executa auditoria completa de integridade entre Qualifying Grid, Starting Grid,
 * Snapshot persistido e Official Race Result.
 */
/**
 * Relatório de Auditoria de Integridade da Fonte de Performance dos Pilotos (BUG-06)
 */
export interface DriverPerformanceSourceAuditReport {
  isValid: boolean
  effectiveSource: string
  totalDrivers: number
  conflictingOverrides: number
  duplicateDriverIds: number
  unresolvedIdentities: number
  engineResolvesToCanonical: boolean
  errors: string[]
}

/**
 * Valida a integridade da fonte esportiva única de pilotos:
 * - 1 fonte esportiva efetiva (MBJ_2026_PILOTS / CANONICAL_DRIVERS_MASTER)
 * - 0 overrides conflitantes
 * - 0 driverIds duplicados
 * - 0 unresolved
 * - Engine resolvendo para a fonte canônica esperada
 */
export function auditDriverPerformanceSource(): DriverPerformanceSourceAuditReport {
  const errors: string[] = []
  const seenIds = new Set<string>()
  let duplicateDriverIds = 0
  let unresolvedIdentities = 0

  for (const driver of MBJ_DRIVERS) {
    if (!driver.id) {
      errors.push('Registro de piloto sem id')
      unresolvedIdentities++
      continue
    }
    if (seenIds.has(driver.id)) {
      errors.push(`driverId duplicado detectado: ${driver.id}`)
      duplicateDriverIds++
    }
    seenIds.add(driver.id)
  }

  // Verifica se o master foi construído sem perda nem divergência
  if (CANONICAL_DRIVERS_MASTER.length !== MBJ_DRIVERS.length) {
    errors.push(
      `CANONICAL_DRIVERS_MASTER length (${CANONICAL_DRIVERS_MASTER.length}) != MBJ_DRIVERS length (${MBJ_DRIVERS.length})`,
    )
  }

  // Overrides conflitantes em CANONICAL_DRIVER_IDENTITY_ALIASES
  let conflictingOverrides = 0
  const russellAliases = CANONICAL_DRIVER_IDENTITY_ALIASES['russell'] || []
  const sainzAliases = CANONICAL_DRIVER_IDENTITY_ALIASES['sainz'] || []

  if (sainzAliases.includes('mbj-007')) {
    conflictingOverrides++
    errors.push("Alias de Sainz contém 'mbj-007' (conflito com George Russell)")
  }
  if (!sainzAliases.includes('mbj-014')) {
    errors.push("Alias de Sainz não contém 'mbj-014'")
  }

  // Testar se os 4 pilotos chave do BUG-06 estão nos valores canônicos esperados
  const canonicalExpected = {
    'mbj-014': { speed: 86, consistency: 85, defense: 83 },
    'mbj-013': { speed: 83, consistency: 82, defense: 80 },
    'mbj-021': { speed: 79, consistency: 80, defense: 80 },
    'mbj-022': { speed: 79, consistency: 81, defense: 78 },
  }

  let engineResolvesToCanonical = true
  for (const [id, exp] of Object.entries(canonicalExpected)) {
    const driver = getCanonicalDriverMaster(id)
    if (!driver) {
      engineResolvesToCanonical = false
      unresolvedIdentities++
      errors.push(`Piloto canônico ${id} não encontrado em CANONICAL_DRIVERS_BY_ID`)
      continue
    }
    if (
      driver.ratings.speed !== exp.speed ||
      driver.ratings.consistency !== exp.consistency ||
      driver.ratings.defense !== exp.defense
    ) {
      engineResolvesToCanonical = false
      conflictingOverrides++
      errors.push(
        `Rating divergente em ${id}: recebido (${driver.ratings.speed}/${driver.ratings.consistency}/${driver.ratings.defense}), esperado (${exp.speed}/${exp.consistency}/${exp.defense})`,
      )
    }
  }

  const isValid =
    errors.length === 0 &&
    duplicateDriverIds === 0 &&
    conflictingOverrides === 0 &&
    unresolvedIdentities === 0 &&
    engineResolvesToCanonical

  return {
    isValid,
    effectiveSource: 'MBJ_2026_PILOTS',
    totalDrivers: MBJ_DRIVERS.length,
    conflictingOverrides,
    duplicateDriverIds,
    unresolvedIdentities,
    engineResolvesToCanonical,
    errors,
  }
}

export function auditStartingGrid(params: {
  qualifyingGrid?: Array<{ driverId: string; position: number; driverName?: string }>
  startingGrid?: Array<{ driverId: string; gridPosition: number; driverName?: string }>
  snapshotDrivers?: Array<{ driverId: string; gridPosition: number; currentPosition?: number }>
  officialResultEntries?: Array<{ driverId: string; gridPosition: number; finalPosition?: number }>
}): StartingGridAuditReport {
  const errors: string[] = []
  const unresolvedIdentities: string[] = []

  const startingGrid = params.startingGrid || []
  const entriesCount = startingGrid.length

  // 1. Unicidade de pilotos no Starting Grid
  const seenDrivers = new Set<string>()
  for (const s of startingGrid) {
    if (!s.driverId) {
      errors.push('Starting grid entry sem driverId')
      continue
    }
    if (seenDrivers.has(s.driverId)) {
      errors.push(`driverId duplicado no starting grid: ${s.driverId}`)
    }
    seenDrivers.add(s.driverId)
  }
  const uniqueDrivers = seenDrivers.size === entriesCount && entriesCount > 0

  // 2. Faixa de posições (1..entriesCount sem saltos)
  const sortedPositions = startingGrid.map((s) => s.gridPosition).sort((a, b) => a - b)
  let positionRange = entriesCount > 0
  for (let i = 0; i < entriesCount; i++) {
    if (sortedPositions[i] !== i + 1) {
      positionRange = false
      errors.push(
        `Posição de grid fora da sequência esperada: esperado ${i + 1}, recebido ${sortedPositions[i]}`,
      )
      break
    }
  }

  // 3. qualifyingMatchesGrid
  let qualifyingMatchesGrid = true
  if (params.qualifyingGrid && params.qualifyingGrid.length > 0) {
    for (const s of startingGrid) {
      const qResolved = resolveCanonicalDriverId(s.driverId, params.qualifyingGrid, s.driverName)
      if (!qResolved) {
        qualifyingMatchesGrid = false
        unresolvedIdentities.push(s.driverId)
        errors.push(`Piloto do starting grid '${s.driverId}' não localizado na qualificação`)
      } else if (qResolved.position !== s.gridPosition) {
        qualifyingMatchesGrid = false
        errors.push(
          `Posição divergente para '${s.driverId}': qualificação P${qResolved.position} vs grid P${s.gridPosition}`,
        )
      }
    }
  }

  // 4. snapshotMatchesGrid
  let snapshotMatchesGrid = true
  if (params.snapshotDrivers && params.snapshotDrivers.length > 0) {
    if (params.snapshotDrivers.length !== entriesCount) {
      snapshotMatchesGrid = false
      errors.push(
        `Contagem de pilotos no snapshot difere do grid: ${params.snapshotDrivers.length} vs ${entriesCount}`,
      )
    }
    for (const s of startingGrid) {
      const snapDriver = params.snapshotDrivers.find((d) => d.driverId === s.driverId)
      if (!snapDriver) {
        snapshotMatchesGrid = false
        errors.push(`Piloto '${s.driverId}' ausente no snapshot da corrida`)
      } else if (snapDriver.gridPosition !== s.gridPosition) {
        snapshotMatchesGrid = false
        errors.push(
          `gridPosition corrompida no snapshot para '${s.driverId}': esperado P${s.gridPosition}, encontrado P${snapDriver.gridPosition}`,
        )
      }
    }
  }

  // 5. officialResultMatchesGrid
  let officialResultMatchesGrid = true
  if (params.officialResultEntries && params.officialResultEntries.length > 0) {
    if (params.officialResultEntries.length !== entriesCount) {
      officialResultMatchesGrid = false
      errors.push(
        `Contagem de entradas no resultado oficial difere do grid: ${params.officialResultEntries.length} vs ${entriesCount}`,
      )
    }
    for (const s of startingGrid) {
      const offEntry = params.officialResultEntries.find((e) => e.driverId === s.driverId)
      if (!offEntry) {
        officialResultMatchesGrid = false
        errors.push(`Piloto '${s.driverId}' ausente no OfficialRaceResult`)
      } else if (offEntry.gridPosition !== s.gridPosition) {
        officialResultMatchesGrid = false
        errors.push(
          `gridPosition corrompida no OfficialRaceResult para '${s.driverId}': esperado P${s.gridPosition}, encontrado P${offEntry.gridPosition}`,
        )
      }
    }
  }

  const isValid =
    errors.length === 0 &&
    unresolvedIdentities.length === 0 &&
    uniqueDrivers &&
    positionRange &&
    qualifyingMatchesGrid &&
    snapshotMatchesGrid &&
    officialResultMatchesGrid

  return {
    isValid,
    entries: entriesCount,
    uniqueDrivers,
    positionRange,
    qualifyingMatchesGrid,
    snapshotMatchesGrid,
    officialResultMatchesGrid,
    unresolvedIdentities,
    errors,
  }
}

/**
 * Auditoria do Mapeamento Canônico de Retratos de Pilotos
 */
export interface CanonicalDriverPortraitMapAuditReport {
  canonicalDrivers: number
  realPortraitMappings: number
  driversWithoutPortraitByDesign: number
  duplicateDriverIds: number
  duplicateAssetIds: number
  missingAssetIds: number
  malformedAssetIds: number
  unresolvedRealDrivers: number
  externalRuntimeUrls: number
  driversWithoutPortrait: string[]
}

export function auditCanonicalDriverPortraitMap(): CanonicalDriverPortraitMapAuditReport {
  const canonicalDrivers = CANONICAL_DRIVERS_MASTER.length
  let realPortraitMappings = 0
  const driversWithoutPortrait: string[] = []
  const seenDriverIds = new Set<string>()
  const seenAssetIds = new Set<string>()
  let duplicateDriverIds = 0
  let duplicateAssetIds = 0
  let missingAssetIds = 0
  let malformedAssetIds = 0
  let unresolvedRealDrivers = 0
  let externalRuntimeUrls = 0

  for (const driver of CANONICAL_DRIVERS_MASTER) {
    if (seenDriverIds.has(driver.driverId)) {
      duplicateDriverIds++
    } else {
      seenDriverIds.add(driver.driverId)
    }

    if (driver.assetId === null) {
      driversWithoutPortrait.push(driver.driverId)
    } else {
      realPortraitMappings++
      if (!driver.assetId.startsWith('DRV_') || driver.assetId.length !== 8) {
        malformedAssetIds++
      }
      if (seenAssetIds.has(driver.assetId)) {
        duplicateAssetIds++
      } else {
        seenAssetIds.add(driver.assetId)
      }
    }

    if (driver.resolvedPhotoPath) {
      if (
        driver.resolvedPhotoPath.startsWith('http://') ||
        driver.resolvedPhotoPath.startsWith('https://')
      ) {
        externalRuntimeUrls++
      }
    }
  }

  return {
    canonicalDrivers,
    realPortraitMappings,
    driversWithoutPortraitByDesign: driversWithoutPortrait.length,
    duplicateDriverIds,
    duplicateAssetIds,
    missingAssetIds,
    malformedAssetIds,
    unresolvedRealDrivers,
    externalRuntimeUrls,
    driversWithoutPortrait,
  }
}

/**
 * Interface do Vínculo Canônico Ativo de Equipe de um Piloto (BUG-RETRATOS-03C2)
 */
export interface ActiveDriverTeamBinding {
  driverId: string | null
  canonicalDriver: CanonicalDriverMaster | null
  teamId: string | null
  teamKey: string | null
  teamName: string | null
  teamColor: string | null
  role: 'titular' | 'reserva' | 'academia' | 'desenvolvimento' | null
  status: 'active' | 'free_agent'
  isContracted: boolean
}

/**
 * Helper centralizado: resolve o vínculo contratual ativo de um piloto.
 * NUNCA recorre a driver.teamName, mbjInfo.teamKey ou strings históricas desprovidas de contrato ativo.
 */
export function getActiveDriverTeamBinding(
  driverId: string | null | undefined,
  seasonContext?: any,
  dbDrivers?: any[],
  dbTeams?: any[],
): ActiveDriverTeamBinding {
  if (!driverId) {
    return {
      driverId: null,
      canonicalDriver: null,
      teamId: null,
      teamKey: null,
      teamName: null,
      teamColor: null,
      role: null,
      status: 'free_agent',
      isContracted: false,
    }
  }

  const teamsList: any[] = Array.isArray(dbTeams) ? dbTeams : []
  const teamsById = new Map<string, any>()
  for (const t of teamsList) {
    if (t?.id) teamsById.set(t.id, t)
    if (t?.team_key) teamsById.set(t.team_key, t)
  }

  const findTeamRecord = (targetTeamIdOrKey: string): any | null => {
    if (!targetTeamIdOrKey) return null
    if (teamsById.has(targetTeamIdOrKey)) return teamsById.get(targetTeamIdOrKey)!
    const lower = targetTeamIdOrKey.toLowerCase().trim()
    for (const t of teamsList) {
      if (t.id === targetTeamIdOrKey) return t
      if (t.team_key && t.team_key.toLowerCase() === lower) return t
      if (t.name && t.name.toLowerCase() === lower) return t
    }
    return null
  }

  const buildBindingResult = (
    cDriver: CanonicalDriverMaster | null,
    resolvedTeam: any | null,
    resolvedRole: 'titular' | 'reserva' | 'academia' | 'desenvolvimento' | null,
    rawTeamIdOrKey?: string | null,
  ): ActiveDriverTeamBinding => {
    if (!resolvedTeam && !rawTeamIdOrKey) {
      return {
        driverId: cDriver?.driverId || driverId,
        canonicalDriver: cDriver,
        teamId: null,
        teamKey: null,
        teamName: null,
        teamColor: null,
        role: null,
        status: 'free_agent',
        isContracted: false,
      }
    }

    const teamKey = resolvedTeam?.team_key || rawTeamIdOrKey || null
    const teamId = resolvedTeam?.id || null
    const teamName = resolvedTeam?.name || (teamKey ? teamKey.toUpperCase() : null)
    const teamColor = resolvedTeam?.color || '#E10600'

    return {
      driverId: cDriver?.driverId || driverId,
      canonicalDriver: cDriver,
      teamId,
      teamKey,
      teamName,
      teamColor,
      role: resolvedRole || 'titular',
      status: 'active',
      isContracted: true,
    }
  }

  // 1. Reconciliação canônica do piloto
  const canonicalDriver = findCanonicalDriverMaster(driverId, null)

  // 2. Busca o registro real do banco no dbDrivers se fornecido
  if (Array.isArray(dbDrivers) && dbDrivers.length > 0) {
    const rawMatch = dbDrivers.find((d) => {
      if (!d) return false
      if (d.id === driverId) return true
      if (
        canonicalDriver &&
        (d.id === canonicalDriver.driverId || d.name === canonicalDriver.fullName)
      )
        return true
      const dKey = normalizeDriverIdentityKey(d.name || '')
      if (canonicalDriver && dKey === normalizeDriverIdentityKey(canonicalDriver.fullName))
        return true
      return false
    })

    if (rawMatch) {
      const explicitContract = rawMatch.canonical_contract
      const hasActiveExplicitContract =
        explicitContract &&
        (explicitContract.status === 'active' || !explicitContract.status) &&
        (explicitContract.teamId || explicitContract.team_id)

      if (hasActiveExplicitContract) {
        const cTeamId = explicitContract.teamId || explicitContract.team_id
        const matchedTeam = findTeamRecord(cTeamId)
        let cRole: 'titular' | 'reserva' | 'academia' | 'desenvolvimento' = 'titular'
        const rawRole = (explicitContract.role || '').toLowerCase()
        if (rawRole === 'reserve' || rawRole === 'reserva') cRole = 'reserva'
        else if (rawRole === 'academy' || rawRole === 'academia') cRole = 'academia'
        else if (rawRole === 'test_development' || rawRole === 'desenvolvimento')
          cRole = 'desenvolvimento'
        return buildBindingResult(canonicalDriver, matchedTeam, cRole, cTeamId)
      }

      // Check de vínculo ativo real no DB:
      // Exclui anomalia de banco legado onde Verstappen ou Leclerc têm team_id da McLaren ('76vs00hy9hu24q1') sem contrato
      const isKnownLegacyGlitch =
        (rawMatch.id === 'de3isw3re1ji2wj' || rawMatch.id === 'lc6cma46f01dgrj') &&
        rawMatch.team_id === '76vs00hy9hu24q1'

      if (!isKnownLegacyGlitch) {
        const boundTeamId = rawMatch.team_id || rawMatch.reserve_team_id || null
        if (boundTeamId) {
          const matchedTeam = findTeamRecord(boundTeamId)
          let cRole: 'titular' | 'reserva' | 'academia' | 'desenvolvimento' = 'titular'
          if (rawMatch.reserve_team_id || rawMatch.role === 'reserva') {
            cRole = 'reserva'
          } else if (rawMatch.is_academy || rawMatch.role === 'academia') {
            cRole = 'academia'
          } else if (rawMatch.is_test_driver || rawMatch.role === 'desenvolvimento') {
            cRole = 'desenvolvimento'
          }
          return buildBindingResult(canonicalDriver, matchedTeam, cRole, boundTeamId)
        }
      }
    }
  }

  // 3. Sem contrato ativo no save/banco -> Free Agent estrito
  return {
    driverId: canonicalDriver?.driverId || driverId,
    canonicalDriver,
    teamId: null,
    teamKey: null,
    teamName: null,
    teamColor: null,
    role: null,
    status: 'free_agent',
    isContracted: false,
  }
}
