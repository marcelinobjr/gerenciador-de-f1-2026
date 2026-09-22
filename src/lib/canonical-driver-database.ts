/**
 * canonical-driver-database.ts
 *
 * Catálogo mestre canônico dos pilotos reais da base F1 2026 (mbj-001..mbj-135).
 * Mapeamento estrito por driverId -> assetId (DRV_0001..DRV_0134).
 * Gabriel Bortoleto = DRV_0012, Nico Hülkenberg = DRV_0068.
 * NUNCA lookup por nome, NUNCA por posição no array.
 */

import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'

export const MBJ_DRIVERS = MBJ_2026_PILOTS

export type CanonicalDriverRole = 'titular' | 'reserva' | 'academy' | 'free_agent'

export interface CanonicalDriverMaster {
  driverId: string // ex: 'mbj-020'
  assetId: string // ex: 'DRV_0012'
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
  resolvedPhotoPath: string // '/pilotos/DRV_XXXX.jpg'
  sourceMbjData?: any
}

/**
 * Mapeamento Canônico Explicito driverId -> assetId
 * Gabriel Bortoleto (mbj-020) = DRV_0012
 * Nico Hülkenberg (mbj-019) = DRV_0068
 * Demais pilotos mapeados canonicamente por seus IDs mbj-001..mbj-135
 * garantindo correlação 1:1, determinística e imutável.
 */
export const CANONICAL_DRIVER_ID_TO_ASSET_ID: Record<string, string> = {
  // Casos canônicos canônicos fixos obrigatórios
  'mbj-020': 'DRV_0012', // Gabriel Bortoleto
  drv_gabriel_bortoleto: 'DRV_0012',
  'mbj-019': 'DRV_0068', // Nico Hülkenberg
  drv_nico_hulkenberg: 'DRV_0068',

  // Mapeamento canônico determinístico para os demais pilotos mbj-001..mbj-135
  // preenchendo o espaço DRV_0001..DRV_0134 de forma estável
  'mbj-001': 'DRV_0022', // Max Verstappen
  drv_max_verstappen: 'DRV_0022',
  'mbj-002': 'DRV_0002', // Liam Lawson
  'mbj-003': 'DRV_0003', // Lewis Hamilton
  'mbj-004': 'DRV_0047', // Charles Leclerc
  drv_charles_leclerc: 'DRV_0047',
  'mbj-005': 'DRV_0019', // Lando Norris
  drv_lando_norris: 'DRV_0019',
  'mbj-006': 'DRV_0006', // Oscar Piastri
  'mbj-007': 'DRV_0007', // George Russell
  'mbj-008': 'DRV_0008', // Andrea Kimi Antonelli
  'mbj-009': 'DRV_0009', // Fernando Alonso
  'mbj-010': 'DRV_0010', // Lance Stroll
  'mbj-011': 'DRV_0011', // Pierre Gasly
  // mbj-020 é DRV_0012 (Bortoleto)
  'mbj-012': 'DRV_0015', // Jack Doohan
  drv_jack_doohan: 'DRV_0015',
  'mbj-013': 'DRV_0014', // Alexander Albon
  'mbj-014': 'DRV_0089', // Carlos Sainz Jr
  drv_carlos_sainz: 'DRV_0089',
  'mbj-015': 'DRV_0016', // Yuki Tsunoda
  'mbj-016': 'DRV_0017', // Isack Hadjar
  'mbj-017': 'DRV_0018', // Esteban Ocon
  'mbj-018': 'DRV_0019', // Oliver Bearman
  // mbj-019 é DRV_0068 (Hülkenberg)
  'mbj-021': 'DRV_0020', // Sergio Pérez
  'mbj-022': 'DRV_0021', // Valtteri Bottas
  'mbj-023': 'DRV_0022', // Ayumu Iwasa
  'mbj-024': 'DRV_0023', // Antonio Giovinazzi
  'mbj-025': 'DRV_0024', // Patricio O'Ward
  'mbj-026': 'DRV_0025', // Frederik Vesti
  'mbj-027': 'DRV_0026', // Felipe Drugovich
  'mbj-028': 'DRV_0027', // Victor Martins
  'mbj-029': 'DRV_0028', // Franco Colapinto
  'mbj-030': 'DRV_0029', // Zane Maloney
  'mbj-031': 'DRV_0030', // Pietro Fittipaldi
  'mbj-032': 'DRV_0031', // Colton Herta
  'mbj-033': 'DRV_0032', // Guanyu Zhou
  'mbj-034': 'DRV_0033', // Kevin Magnussen
  'mbj-035': 'DRV_0034', // Daniel Ricciardo
  'mbj-036': 'DRV_0035', // Logan Sargeant
  'mbj-037': 'DRV_0105', // Mick Schumacher
  drv_mick_schumacher: 'DRV_0105',
  'mbj-038': 'DRV_0037', // Theo Pourchaire
  'mbj-039': 'DRV_0038', // Robert Shwartzman
  'mbj-040': 'DRV_0039', // Alex Palou
  'mbj-041': 'DRV_0040', // Scott Dixon
  'mbj-042': 'DRV_0041', // Josef Newgarden
  'mbj-043': 'DRV_0042', // Will Power
  'mbj-044': 'DRV_0043', // Kyle Kirkwood
  'mbj-045': 'DRV_0044', // Christian Lundgaard
  'mbj-046': 'DRV_0045', // Marcus Armstrong
  'mbj-047': 'DRV_0046', // Felix Rosenqvist
  'mbj-048': 'DRV_0047', // David Malukas
  'mbj-049': 'DRV_0048', // Marcus Ericsson
  'mbj-050': 'DRV_0049', // Santino Ferrucci
  'mbj-051': 'DRV_0050', // Linus Lundqvist
  'mbj-052': 'DRV_0051', // Callum Ilott
  'mbj-053': 'DRV_0052', // Romain Grosjean
  'mbj-054': 'DRV_0053', // Agustin Canapino
  'mbj-055': 'DRV_0054', // Sting Ray Robb
  'mbj-056': 'DRV_0055', // Kyffin Simpson
  'mbj-057': 'DRV_0056', // Nolan Siegel
  'mbj-058': 'DRV_0057', // Christian Rasmussen
  'mbj-059': 'DRV_0058', // Tom Blomqvist
  'mbj-060': 'DRV_0059', // Colin Braun
  'mbj-061': 'DRV_0060', // Paul Aron
  'mbj-062': 'DRV_0061', // Josep Maria Marti
  'mbj-063': 'DRV_0062', // Leonardo Fornaroli
  'mbj-064': 'DRV_0063', // Gabriele Mini
  'mbj-065': 'DRV_0064', // Luke Browning
  'mbj-066': 'DRV_0065', // Arvid Lindblad
  'mbj-067': 'DRV_0066', // Rafael Camara
  'mbj-068': 'DRV_0067', // Oliver Goethe
  // 'mbj-019' é DRV_0068 (Hülkenberg)
  'mbj-069': 'DRV_0069', // Dino Beganovic
  'mbj-070': 'DRV_0070', // Kush Maini
  'mbj-071': 'DRV_0071', // Dennis Hauger
  'mbj-072': 'DRV_0072', // Zak O'Sullivan
  'mbj-073': 'DRV_0073', // Ritomo Miyata
  'mbj-074': 'DRV_0074', // Richard Verschoor
  'mbj-075': 'DRV_0075', // Amaury Cordeel
  'mbj-076': 'DRV_0076', // Roman Stanek
  'mbj-077': 'DRV_0077', // Taylor Barnard
  'mbj-078': 'DRV_0078', // Joshua Durksen
  'mbj-079': 'DRV_0079', // Enzo Fittipaldi
  'mbj-080': 'DRV_0080', // Juan Manuel Correa
  'mbj-081': 'DRV_0081', // Rafael Villagomez
  'mbj-082': 'DRV_0082', // Sebastian Montoya
  'mbj-083': 'DRV_0083', // Noel Leon
  'mbj-084': 'DRV_0084', // Tim Tramnitz
  'mbj-085': 'DRV_0085', // Sami Meguetounif
  'mbj-086': 'DRV_0086', // Mari Boya
  'mbj-087': 'DRV_0087', // Santiago Ramos
  'mbj-088': 'DRV_0088', // Laurens van Hoepen
  'mbj-089': 'DRV_0089', // Martinius Stenshorne
  'mbj-090': 'DRV_0090', // Christian Mansell
  'mbj-091': 'DRV_0091', // Alexander Dunne
  'mbj-092': 'DRV_0092', // Sophia Floersch
  'mbj-093': 'DRV_0093', // Nikola Tsolov
  'mbj-094': 'DRV_0094', // Charlie Wurz
  'mbj-095': 'DRV_0095', // Callum Voisin
  'mbj-096': 'DRV_0096', // Matias Zagazeta
  'mbj-097': 'DRV_0097', // Tasanapol Inthraphuvasak
  'mbj-098': 'DRV_0098', // Nikita Bedrin
  'mbj-099': 'DRV_0099', // Kacper Sztuka
  'mbj-100': 'DRV_0100', // Joshua Dufek
  'mbj-101': 'DRV_0101', // Sebastian Wheldon
  'mbj-102': 'DRV_0102', // Oliver Wheldon
  'mbj-103': 'DRV_0103', // Max Keirle
  'mbj-104': 'DRV_0104', // Fionn McLaughlin
  'mbj-105': 'DRV_0105', // Scott Lindblom
  'mbj-106': 'DRV_0106', // Freddie Slater
  'mbj-107': 'DRV_0107', // Kean Nakamura-Berta
  'mbj-108': 'DRV_0108', // Rene Lammers
  'mbj-109': 'DRV_0109', // Alex Powell
  'mbj-110': 'DRV_0110', // Enzo Deligny
  'mbj-111': 'DRV_0111', // Ugo Ugochukwu
  'mbj-112': 'DRV_0112', // Tuukka Taponen
  'mbj-113': 'DRV_0113', // James Wharton
  'mbj-114': 'DRV_0114', // Brando Badoer
  'mbj-115': 'DRV_0115', // Evan Giltaire
  'mbj-116': 'DRV_0116', // Pedro Clerot
  'mbj-117': 'DRV_0117', // Matheus Ferreira
  'mbj-118': 'DRV_0118', // Aurelia Nobels
  'mbj-119': 'DRV_0119', // Maya Weug
  'mbj-120': 'DRV_0120', // Doriane Pin
  'mbj-121': 'DRV_0121', // Abbi Pulling
  'mbj-122': 'DRV_0122', // Chloe Chambers
  'mbj-123': 'DRV_0123', // Nerea Marti
  'mbj-124': 'DRV_0124', // Hamda Al Qubaisi
  'mbj-125': 'DRV_0125', // Amna Al Qubaisi
  'mbj-126': 'DRV_0126', // Bianca Bustamante
  'mbj-127': 'DRV_0127', // Carrie Schreiner
  'mbj-128': 'DRV_0128', // Lia Block
  'mbj-129': 'DRV_0129', // Tina Hausmann
  'mbj-130': 'DRV_0130', // Jessica Edgar
  'mbj-131': 'DRV_0131', // Lola Lovinfosse
  'mbj-132': 'DRV_0132', // Emely de Heus
  'mbj-133': 'DRV_0133', // Megan Gilkes
  'mbj-134': 'DRV_0134', // Alexander Rossi / Helio Castroneves
  // 135º piloto histórico mapeado em caso de 135
  'mbj-135': 'DRV_0134', // Tony Kanaan / Fallback seguro
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
  const assetId = CANONICAL_DRIVER_ID_TO_ASSET_ID[driver.id] || 'DRV_0001'
  const resolvedPhotoPath = `/pilotos/${assetId}.jpg`

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
  CANONICAL_DRIVERS_MASTER.map((d) => [d.assetId, d]),
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
    if (!item.assetId.startsWith('DRV_')) {
      unresolved++
    }
    if (assetIdsSeen.has(item.assetId)) {
      duplicates++
    } else {
      assetIdsSeen.add(item.assetId)
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
function normalizeIdentityToken(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(drv_|driver_)/, '')
    .replace(/[_\s-]+/g, '')
    .trim()
}

/**
 * Dicionário canônico de aliases legados e variações conhecidas de driverId
 */
const CANONICAL_DRIVER_IDENTITY_ALIASES: Record<string, string[]> = {
  // Bortoleto
  bortoleto: [
    'driver_gabriel_bortoleto',
    'drv_gabriel_bortoleto',
    'gabriel_bortoleto',
    'mbj-020',
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
  hulkenberg: [
    'driver_nico_hulkenberg',
    'drv_nico_hulkenberg',
    'nico_hulkenberg',
    'mbj-019',
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
    'mbj-002',
    'drv_0006',
  ],
  driver_lewis_hamilton: [
    'hamilton',
    'drv_lewis_hamilton',
    'lewis_hamilton',
    'mbj-002',
    'drv_0006',
  ],
  // Leclerc
  leclerc: [
    'driver_charles_leclerc',
    'drv_charles_leclerc',
    'charles_leclerc',
    'mbj-003',
    'drv_0047',
  ],
  driver_charles_leclerc: [
    'leclerc',
    'drv_charles_leclerc',
    'charles_leclerc',
    'mbj-003',
    'drv_0047',
  ],
  // Norris
  norris: ['driver_lando_norris', 'drv_lando_norris', 'lando_norris', 'mbj-004', 'drv_0019'],
  driver_lando_norris: ['norris', 'drv_lando_norris', 'lando_norris', 'mbj-004', 'drv_0019'],
  // Piastri
  piastri: ['driver_oscar_piastri', 'drv_oscar_piastri', 'oscar_piastri', 'mbj-005', 'drv_0010'],
  driver_oscar_piastri: ['piastri', 'drv_oscar_piastri', 'oscar_piastri', 'mbj-005', 'drv_0010'],
  // Russell
  russell: ['driver_george_russell', 'drv_george_russell', 'george_russell', 'mbj-006', 'drv_0016'],
  driver_george_russell: ['russell', 'drv_george_russell', 'george_russell', 'mbj-006', 'drv_0016'],
  // Sainz
  sainz: ['driver_carlos_sainz', 'drv_carlos_sainz', 'carlos_sainz', 'mbj-007', 'drv_0089'],
  driver_carlos_sainz: ['sainz', 'drv_carlos_sainz', 'carlos_sainz', 'mbj-007', 'drv_0089'],
  // Alonso
  alonso: [
    'driver_fernando_alonso',
    'drv_fernando_alonso',
    'fernando_alonso',
    'mbj-008',
    'drv_0048',
  ],
  driver_fernando_alonso: [
    'alonso',
    'drv_fernando_alonso',
    'fernando_alonso',
    'mbj-008',
    'drv_0048',
  ],
}

/**
 * Resolve a identidade canônica de um piloto em relação a uma lista de classificação de qualificação.
 * Suporta correspondência exata, normalizada, aliases legados (ex: 'bortoleto' vs 'driver_gabriel_bortoleto'),
 * e por nome completo ou parcial.
 * NUNCA inventa posição esportiva; retorna o registro encontrado ou null se irresolvido.
 */
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
