/**
 * Resolver centralizado oficial de Logos Reduzidas de Equipes da F1.
 * Fonte Oficial Obrigatória: Google Drive (Pasta 1xs6OGFzP1ey2GUqYigJcVIWqylHk6U8G - "Logo_Equipes_reduzida")
 *
 * Mapeia 26 logos reduzidas de construtores oficiais para URLs de alta disponibilidade no Google Drive Thumbnail CDN.
 * Fallback seguro para construtores sem asset ou equipes criadas pelo jogador.
 */

export interface TeamReducedLogoDef {
  teamKey: string
  displayName: string
  fileName: string
  fileId: string
  thumbnailUrl: string
  aliases: string[]
}

/**
 * Catálogo canônico com os 26 arquivos de logos reduzidas extraídos diretamente da pasta do Google Drive:
 * https://drive.google.com/drive/folders/1xs6OGFzP1ey2GUqYigJcVIWqylHk6U8G?usp=drive_link
 */
export const TEAM_REDUCED_LOGOS_MANIFEST: Record<string, TeamReducedLogoDef> = {
  alfaromeo: {
    teamKey: 'alfaromeo',
    displayName: 'Alfa Romeo',
    fileName: 'Alfa_romeo.jpg',
    fileId: '1tL0p6Z_qvWG8AdAH-v2iNj3Qq-zpp26o',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1tL0p6Z_qvWG8AdAH-v2iNj3Qq-zpp26o&sz=w200',
    aliases: ['alfa', 'alfa_romeo', 'alfaromeof1', 'sauber_alfa_romeo'],
  },
  alphatauri: {
    teamKey: 'alphatauri',
    displayName: 'AlphaTauri',
    fileName: 'Alpha_Tauri.jpg',
    fileId: '11U8w7PciYGemEPZECzSmhdyVDnT7jOqZ',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=11U8w7PciYGemEPZECzSmhdyVDnT7jOqZ&sz=w200',
    aliases: ['alpha_tauri', 'scuderia_alphatauri', 'toro_rosso', 'tororosso'],
  },
  alpine: {
    teamKey: 'alpine',
    displayName: 'Alpine',
    fileName: 'Alpine.jpg',
    fileId: '1U7pqTOjUiHuDDOPgkTtgGvlE0xwqQJe5',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1U7pqTOjUiHuDDOPgkTtgGvlE0xwqQJe5&sz=w200',
    aliases: ['alpine_f1', 'alpine_f1_team', 'renault_alpine', 'bwt_alpine'],
  },
  andretti: {
    teamKey: 'andretti',
    displayName: 'Andretti',
    fileName: 'Andretti.jpg',
    fileId: '1kyiQ_RLUi2x4g_rXyxtvcwfDdslTDSLM',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1kyiQ_RLUi2x4g_rXyxtvcwfDdslTDSLM&sz=w200',
    aliases: ['andretti_global', 'andretti_cadillac', 'andrettif1'],
  },
  astonmartin: {
    teamKey: 'astonmartin',
    displayName: 'Aston Martin',
    fileName: 'Aston_Martin.jpg',
    fileId: '1LOgnFWKzNqDwGNEa6OSWzKgsJA76-7Om',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1LOgnFWKzNqDwGNEa6OSWzKgsJA76-7Om&sz=w200',
    aliases: ['aston_martin', 'aston', 'amr', 'aston_martin_aramco'],
  },
  audi: {
    teamKey: 'audi',
    displayName: 'Audi',
    fileName: 'Audi.jpg',
    fileId: '1E_hOCkC1UZ1vxJ_BmhMLrjVz4hjduRw-',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1E_hOCkC1UZ1vxJ_BmhMLrjVz4hjduRw-&sz=w200',
    aliases: ['audi_f1', 'audi_sport', 'audi_revolut', 'audi_f1_team', 'audisport'],
  },
  benetton: {
    teamKey: 'benetton',
    displayName: 'Benetton',
    fileName: 'Benetton.jpg',
    fileId: '1KCj-EH7-J3AEqIJb0QkNAoe9JmDJqkXQ',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1KCj-EH7-J3AEqIJb0QkNAoe9JmDJqkXQ&sz=w200',
    aliases: ['benetton_formula', 'benetton_f1'],
  },
  byd: {
    teamKey: 'byd',
    displayName: 'BYD',
    fileName: 'BYD.jpg',
    fileId: '1SLBjhkqxIJxK-c831PKUeXBurVPLM5hj',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1SLBjhkqxIJxK-c831PKUeXBurVPLM5hj&sz=w200',
    aliases: ['byd_racing', 'byd_formula', 'bydf1'],
  },
  cadillac: {
    teamKey: 'cadillac',
    displayName: 'Cadillac',
    fileName: 'Cadillac.jpg',
    fileId: '1pPQpYtldrk0UTLW3RlDT8qohR8_b6GuL',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1pPQpYtldrk0UTLW3RlDT8qohR8_b6GuL&sz=w200',
    aliases: ['cadillac_f1', 'cadillac_racing', 'gm_cadillac'],
  },
  copersucar: {
    teamKey: 'copersucar',
    displayName: 'Copersucar',
    fileName: 'Copersucar.jpg',
    fileId: '15B_AF_zFABsGor0x9NlGNAIlVC8uyJpf',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=15B_AF_zFABsGor0x9NlGNAIlVC8uyJpf&sz=w200',
    aliases: ['copersucar_fittipaldi', 'copersucar_racing'],
  },
  ferrari: {
    teamKey: 'ferrari',
    displayName: 'Ferrari',
    fileName: 'Ferrari.jpg',
    fileId: '1WNhKOWyf3B_clAbYkBnv9cSju3sBNtg6',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1WNhKOWyf3B_clAbYkBnv9cSju3sBNtg6&sz=w200',
    aliases: ['scuderia_ferrari', 'scuderia_ferrari_hp', 'ferrari_hp'],
  },
  fittipaldi: {
    teamKey: 'fittipaldi',
    displayName: 'Fittipaldi',
    fileName: 'Fittipaldi.jpg',
    fileId: '1rrsBOm7iUZjvIN3PHeIjS1A0YS6_b9Fu',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1rrsBOm7iUZjvIN3PHeIjS1A0YS6_b9Fu&sz=w200',
    aliases: ['fittipaldi_automotive', 'fittipaldi_f1'],
  },
  haas: {
    teamKey: 'haas',
    displayName: 'Haas',
    fileName: 'Haas.jpg',
    fileId: '1m_xPABTMdbI7QMfXRIcZBTMw-Moe1TRi',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1m_xPABTMdbI7QMfXRIcZBTMw-Moe1TRi&sz=w200',
    aliases: ['haas_f1_team', 'moneygram_haas', 'haasf1'],
  },
  honda: {
    teamKey: 'honda',
    displayName: 'Honda',
    fileName: 'Honda.jpg',
    fileId: '1DVnv6Wmr2wQOiX38gkokCY9jLQUsp_k1',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1DVnv6Wmr2wQOiX38gkokCY9jLQUsp_k1&sz=w200',
    aliases: ['honda_racing', 'honda_hrc', 'hrc', 'hondaf1'],
  },
  jordan: {
    teamKey: 'jordan',
    displayName: 'Jordan',
    fileName: 'Jordan.jpg',
    fileId: '1hFc149S_7oWU8cH7Js8pbqIBZeRwDL8N',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1hFc149S_7oWU8cH7Js8pbqIBZeRwDL8N&sz=w200',
    aliases: ['jordan_grand_prix', 'jordan_f1'],
  },
  lamborghini: {
    teamKey: 'lamborghini',
    displayName: 'Lamborghini',
    fileName: 'Lamborguini.jpg',
    fileId: '1UI3Vgkqa8ZI0sR9WSCaCSBIUD7Wt45-x',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1UI3Vgkqa8ZI0sR9WSCaCSBIUD7Wt45-x&sz=w200',
    aliases: ['lamborguini', 'squadra_corse', 'lamborghini_sc'],
  },
  lotus: {
    teamKey: 'lotus',
    displayName: 'Lotus',
    fileName: 'Lotus.jpg',
    fileId: '18A7_25fBF0rEhlnKLI7RgEiEQ08Yqejw',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=18A7_25fBF0rEhlnKLI7RgEiEQ08Yqejw&sz=w200',
    aliases: ['team_lotus', 'lotus_f1', 'classic_lotus'],
  },
  mclaren: {
    teamKey: 'mclaren',
    displayName: 'McLaren',
    fileName: 'McLaren.jpg',
    fileId: '1YCuoP5vebmxH81LIYCwwGkwKhC86dpZ-',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1YCuoP5vebmxH81LIYCwwGkwKhC86dpZ-&sz=w200',
    aliases: ['mclaren_f1', 'mclaren_racing', 'mclaren_mercedes'],
  },
  mercedes: {
    teamKey: 'mercedes',
    displayName: 'Mercedes',
    fileName: 'Mercedes.jpg',
    fileId: '1h6M1dRWwk9MVc4vNEZbPjwTkjrANo_O1',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1h6M1dRWwk9MVc4vNEZbPjwTkjrANo_O1&sz=w200',
    aliases: ['mercedes_amg', 'mercedes_amg_petronas', 'amg_petronas', 'mercedes_f1'],
  },
  penske: {
    teamKey: 'penske',
    displayName: 'Penske',
    fileName: 'Penske.jpg',
    fileId: '10Uhfb8zLajDLaKbxQMfDB2yQ5iK4tlqa',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=10Uhfb8zLajDLaKbxQMfDB2yQ5iK4tlqa&sz=w200',
    aliases: ['team_penske', 'penske_racing'],
  },
  porsche: {
    teamKey: 'porsche',
    displayName: 'Porsche',
    fileName: 'porshe.jpg',
    fileId: '1Q900Wb0kfAZ2LzqxuXJzvkekm2mNRJRJ',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1Q900Wb0kfAZ2LzqxuXJzvkekm2mNRJRJ&sz=w200',
    aliases: ['porshe', 'porsche_motorsport', 'tag_heuer_porsche'],
  },
  racingbulls: {
    teamKey: 'racingbulls',
    displayName: 'Racing Bulls (VCARB)',
    fileName: 'RacingBulls.jpg',
    fileId: '12XpIy3rbIAz1fy53K9F0BLRB-yyGDlV3',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=12XpIy3rbIAz1fy53K9F0BLRB-yyGDlV3&sz=w200',
    aliases: ['vcarb', 'visa_cash_app_rb', 'rb', 'racing_bulls', 'toro_rosso'],
  },
  redbull: {
    teamKey: 'redbull',
    displayName: 'Red Bull Racing',
    fileName: 'Red_Bull.jpg',
    fileId: '1Jr0apKfqpoVVmm4K49N07iARa9sseRPG',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1Jr0apKfqpoVVmm4K49N07iARa9sseRPG&sz=w200',
    aliases: ['red_bull', 'rbr', 'oracle_red_bull_racing', 'redbullracing'],
  },
  renault: {
    teamKey: 'renault',
    displayName: 'Renault',
    fileName: 'Renaut.jpg',
    fileId: '1g0UJBKKOgRagNrTpr1Hqolw_I3dY_jtz',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1g0UJBKKOgRagNrTpr1Hqolw_I3dY_jtz&sz=w200',
    aliases: ['renaut', 'renault_f1', 'renault_dp_world'],
  },
  sauber: {
    teamKey: 'sauber',
    displayName: 'Sauber',
    fileName: 'Sauber.jpg',
    fileId: '1ESFnMCnbtwhiwbjS5WKbWG1r5iILnh3X',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1ESFnMCnbtwhiwbjS5WKbWG1r5iILnh3X&sz=w200',
    aliases: ['stake_f1', 'kick_sauber', 'sauber_motorsport'],
  },
  toleman: {
    teamKey: 'toleman',
    displayName: 'Toleman',
    fileName: 'Tolleman.jpg',
    fileId: '1VI88EbNcqtDqXoyBrEcBaaxFPiU0pO8J',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1VI88EbNcqtDqXoyBrEcBaaxFPiU0pO8J&sz=w200',
    aliases: ['tolleman', 'toleman_motorsport', 'tg184'],
  },
  toyota: {
    teamKey: 'toyota',
    displayName: 'Toyota',
    fileName: 'Toyota.jpg',
    fileId: '1xe86l2aiX94xOcdWpbieotzXaD55cZ_P',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1xe86l2aiX94xOcdWpbieotzXaD55cZ_P&sz=w200',
    aliases: ['toyota_racing', 'panasonic_toyota', 'gazoo_racing', 'toyota_gazoo'],
  },
  williams: {
    teamKey: 'williams',
    displayName: 'Williams',
    fileName: 'Williams.jpg',
    fileId: '1vK9yr_LWt5Yn0Jkr-Wl7u82EhzQS0tV2',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1vK9yr_LWt5Yn0Jkr-Wl7u82EhzQS0tV2&sz=w200',
    aliases: ['williams_racing', 'williamsf1', 'williams_mercedes'],
  },
}

/**
 * Normaliza qualquer identificador, nome completo ou slug de equipe
 */
export function normalizeTeamIdentifier(input: string | null | undefined): string {
  if (!input) return ''
  const clean = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/^ai_/, '') // remove prefixo de IA
    .replace(/[-\s]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')

  // 1. Match direto de chave
  if (TEAM_REDUCED_LOGOS_MANIFEST[clean]) {
    return clean
  }

  // 2. Match por alias
  for (const [key, item] of Object.entries(TEAM_REDUCED_LOGOS_MANIFEST)) {
    if (key === clean) return key
    if (
      item.aliases.some((alias) => {
        const normAlias = alias.toLowerCase().replace(/[-\s]+/g, '_')
        return normAlias === clean || clean.includes(normAlias) || normAlias.includes(clean)
      })
    ) {
      return key
    }
  }

  // 3. Match por nome contido
  const cleanPlain = clean.replace(/_/g, '')
  for (const [key] of Object.entries(TEAM_REDUCED_LOGOS_MANIFEST)) {
    if (cleanPlain.includes(key) || key.includes(cleanPlain)) {
      return key
    }
  }

  return clean
}

/**
 * Retorna a definição canônica da logo reduzida da equipe do Google Drive
 */
export function getTeamReducedLogoDef(
  teamCodeOrName: string | null | undefined,
): TeamReducedLogoDef | null {
  const normKey = normalizeTeamIdentifier(teamCodeOrName)
  return TEAM_REDUCED_LOGOS_MANIFEST[normKey] || null
}

/**
 * Retorna a URL direta do thumbnail da logo reduzida oficial (20-28px)
 * Caso não exista registro, retorna null para permitir placeholder neutro no consumidor.
 */
export function getTeamReducedLogoUrl(teamCodeOrName: string | null | undefined): string | null {
  const def = getTeamReducedLogoDef(teamCodeOrName)
  return def ? def.thumbnailUrl : null
}

/**
 * Resolver unificado canônico
 */
export const teamAssetResolver = {
  getReducedLogo: getTeamReducedLogoUrl,
  getReducedLogoDef: getTeamReducedLogoDef,
  normalizeKey: normalizeTeamIdentifier,
  manifest: TEAM_REDUCED_LOGOS_MANIFEST,
}
