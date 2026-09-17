/**
 * Manifest Canônico de Assets de Membros de Equipe Técnica / Staff
 */

export interface StaffAssetDefinition {
  id: string
  name: string
  role?: string
  localFileName?: string
  localPath?: string
  aliases: string[]
}

export const STAFF_ASSET_MANIFEST: Record<string, StaffAssetDefinition> = {
  cardile: {
    id: 'enrico_cardile',
    name: 'Enrico Cardile',
    role: 'technical_director',
    localFileName: 'Enrico_Cardile.jpg',
    localPath: '/assets/staff/Enrico_Cardile.jpg',
    aliases: ['cardile', 'enrico cardile'],
  },
  wheatley: {
    id: 'jonathan_wheatley',
    name: 'Jonathan Wheatley',
    role: 'team_principal',
    localFileName: 'Jonathan_Wheatley.jpg',
    localPath: '/assets/staff/Jonathan_Wheatley.jpg',
    aliases: ['wheatley', 'jonathan wheatley'],
  },
  binotto: {
    id: 'mattia_binotto',
    name: 'Mattia Binotto',
    role: 'chief_executive',
    localFileName: 'Mattia_Binotto.jpg',
    localPath: '/assets/staff/Mattia_Binotto.jpg',
    aliases: ['binotto', 'mattia binotto'],
  },
  newey: {
    id: 'adrian_newey',
    name: 'Adrian Newey',
    role: 'technical_director',
    localFileName: 'Adrian_Newey.jpg',
    localPath: '/assets/staff/Adrian_Newey.jpg',
    aliases: ['newey', 'adrian newey'],
  },
  wolff: {
    id: 'toto_wolff',
    name: 'Toto Wolff',
    role: 'team_principal',
    localFileName: 'Toto_Wolff.jpg',
    localPath: '/assets/staff/Toto_Wolff.jpg',
    aliases: ['wolff', 'toto wolff'],
  },
  horner: {
    id: 'christian_horner',
    name: 'Christian Horner',
    role: 'team_principal',
    localFileName: 'Christian_Horner.jpg',
    localPath: '/assets/staff/Christian_Horner.jpg',
    aliases: ['horner', 'christian horner'],
  },
  vasseur: {
    id: 'frederic_vasseur',
    name: 'Frédéric Vasseur',
    role: 'team_principal',
    localFileName: 'Frederic_Vasseur.jpg',
    localPath: '/assets/staff/Frederic_Vasseur.jpg',
    aliases: ['vasseur', 'frederic vasseur', 'frédéric vasseur'],
  },
  stella: {
    id: 'andrea_stella',
    name: 'Andrea Stella',
    role: 'team_principal',
    localFileName: 'Andrea_Stella.jpg',
    localPath: '/assets/staff/Andrea_Stella.jpg',
    aliases: ['stella', 'andrea stella'],
  },
}

/**
 * Normaliza o identificador ou nome do staff
 */
export function normalizeStaffKey(staffIdOrName: string | null | undefined): string {
  if (!staffIdOrName) return ''
  const clean = staffIdOrName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  for (const [key, item] of Object.entries(STAFF_ASSET_MANIFEST)) {
    if (key === clean || item.id === clean) return key
    if (item.aliases.some((alias) => clean.includes(alias) || alias === clean)) {
      return key
    }
  }

  const parts = clean.split(/\s+/)
  const lastName = parts[parts.length - 1]
  if (STAFF_ASSET_MANIFEST[lastName]) {
    return lastName
  }

  return clean
}

/**
 * Retorna o caminho de imagem do membro do staff com fallback limpo
 */
export function getStaffImage(staffIdOrName: string | null | undefined): string | null {
  if (!staffIdOrName) return null
  const key = normalizeStaffKey(staffIdOrName)
  const asset = STAFF_ASSET_MANIFEST[key]
  return asset?.localPath || null
}
