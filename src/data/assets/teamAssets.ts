export interface TeamAssetDefinition {
  id: string
  name: string
  sideViewFileName: string
  sideViewPath: string
  logoFileName?: string
  logoPath?: string
  aliases: string[]
}

export const TEAM_ASSET_MANIFEST: Record<string, TeamAssetDefinition> = {
  audi: {
    id: 'audi',
    name: 'Audi Revolut F1 Team',
    sideViewFileName: 'Audi_VL.jpg',
    sideViewPath: '/assets/teams/sideviews/Audi_VL.jpg',
    logoFileName: 'audi.png',
    logoPath: '/assets/teams/logos/audi.png',
    aliases: ['audi', 'audi_f1', 'audi-sport', 'audi-revolut'],
  },
  red_bull: {
    id: 'red_bull',
    name: 'Oracle Red Bull Racing',
    sideViewFileName: 'REd_Bull_VL.jpg',
    sideViewPath: '/assets/teams/sideviews/REd_Bull_VL.jpg',
    logoFileName: 'red_bull.png',
    logoPath: '/assets/teams/logos/red_bull.png',
    aliases: ['red_bull', 'redbull', 'red-bull', 'rbr', 'oracle-red-bull'],
  },
  mclaren: {
    id: 'mclaren',
    name: 'McLaren Formula 1 Team',
    sideViewFileName: 'MCLaren_VL.jpg',
    sideViewPath: '/assets/teams/sideviews/MCLaren_VL.jpg',
    logoFileName: 'mclaren.png',
    logoPath: '/assets/teams/logos/mclaren.png',
    aliases: ['mclaren', 'mclaren-f1', 'mcl'],
  },
  porsche: {
    id: 'porsche',
    name: 'Porsche Penske Motorsport F1',
    sideViewFileName: 'Porshe_VL.jpg',
    sideViewPath: '/assets/teams/sideviews/Porshe_VL.jpg',
    logoFileName: 'porsche.png',
    logoPath: '/assets/teams/logos/porsche.png',
    aliases: ['porsche', 'porshe', 'porsche-f1'],
  },
  cadillac: {
    id: 'cadillac',
    name: 'Cadillac F1 Team',
    sideViewFileName: 'Cadilac_VL.jpg',
    sideViewPath: '/assets/teams/sideviews/Cadilac_VL.jpg',
    logoFileName: 'cadillac.png',
    logoPath: '/assets/teams/logos/cadillac.png',
    aliases: ['cadillac', 'cadilac', 'andretti-cadillac', 'andretti'],
  },
  renault: {
    id: 'renault',
    name: 'BWT Alpine F1 Team (Renault)',
    sideViewFileName: 'Renaut_VL.jpg',
    sideViewPath: '/assets/teams/sideviews/Renaut_VL.jpg',
    logoFileName: 'renault.png',
    logoPath: '/assets/teams/logos/renault.png',
    aliases: ['renault', 'renaut', 'alpine', 'alpine-f1'],
  },
  lamborghini: {
    id: 'lamborghini',
    name: 'Lamborghini Squadra Corse F1',
    sideViewFileName: 'Lamborguini_VL.jpg',
    sideViewPath: '/assets/teams/sideviews/Lamborguini_VL.jpg',
    logoFileName: 'lamborghini.png',
    logoPath: '/assets/teams/logos/lamborghini.png',
    aliases: ['lamborghini', 'lamborguini', 'lambo'],
  },
  ferrari: {
    id: 'ferrari',
    name: 'Scuderia Ferrari HP',
    sideViewFileName: 'Ferrari_VL.jpg',
    sideViewPath: '/assets/teams/sideviews/Ferrari_VL.jpg',
    logoFileName: 'ferrari.png',
    logoPath: '/assets/teams/logos/ferrari.png',
    aliases: ['ferrari', 'scuderia-ferrari', 'sf'],
  },
  mercedes: {
    id: 'mercedes',
    name: 'Mercedes-AMG PETRONAS F1 Team',
    sideViewFileName: 'Mercedes_VL.jpg',
    sideViewPath: '/assets/teams/sideviews/Mercedes_VL.jpg',
    logoFileName: 'mercedes.png',
    logoPath: '/assets/teams/logos/mercedes.png',
    aliases: ['mercedes', 'mercedes-amg', 'amg'],
  },
  aston_martin: {
    id: 'aston_martin',
    name: 'Aston Martin Aramco F1 Team',
    sideViewFileName: 'Aston_Martin_VL.jpg',
    sideViewPath: '/assets/teams/sideviews/Aston_Martin_VL.jpg',
    logoFileName: 'aston_martin.png',
    logoPath: '/assets/teams/logos/aston_martin.png',
    aliases: ['aston_martin', 'aston-martin', 'aston', 'amr'],
  },
  williams: {
    id: 'williams',
    name: 'Williams Racing',
    sideViewFileName: 'Williams_VL.jpg',
    sideViewPath: '/assets/teams/sideviews/Williams_VL.jpg',
    logoFileName: 'williams.png',
    logoPath: '/assets/teams/logos/williams.png',
    aliases: ['williams', 'williams-racing'],
  },
  haas: {
    id: 'haas',
    name: 'MoneyGram Haas F1 Team',
    sideViewFileName: 'Haas_VL.jpg',
    sideViewPath: '/assets/teams/sideviews/Haas_VL.jpg',
    logoFileName: 'haas.png',
    logoPath: '/assets/teams/logos/haas.png',
    aliases: ['haas', 'haas-f1'],
  },
  rb: {
    id: 'rb',
    name: 'Visa Cash App RB F1 Team',
    sideViewFileName: 'RB_VL.jpg',
    sideViewPath: '/assets/teams/sideviews/RB_VL.jpg',
    logoFileName: 'rb.png',
    logoPath: '/assets/teams/logos/rb.png',
    aliases: ['rb', 'racing_bulls', 'racing-bulls', 'vcarb', 'alphatauri', 'alpha_tauri'],
  },
  sauber: {
    id: 'sauber',
    name: 'Stake F1 Team Kick Sauber',
    sideViewFileName: 'Sauber_VL.jpg',
    sideViewPath: '/assets/teams/sideviews/Sauber_VL.jpg',
    logoFileName: 'sauber.png',
    logoPath: '/assets/teams/logos/sauber.png',
    aliases: ['sauber', 'kick_sauber', 'kick-sauber', 'stake'],
  },
}

/**
 * Normaliza identificadores de equipe para busca no manifest
 */
export function normalizeTeamKey(teamCodeOrId: string | null | undefined): string {
  if (!teamCodeOrId) return ''
  const clean = teamCodeOrId
    .toLowerCase()
    .trim()
    .replace(/[-\s]+/g, '_')
  for (const [key, item] of Object.entries(TEAM_ASSET_MANIFEST)) {
    if (key === clean) return key
    if (item.aliases.some((alias) => alias.toLowerCase().replace(/[-\s]+/g, '_') === clean)) {
      return key
    }
  }
  return clean
}

/**
 * Retorna os dados do asset da equipe ou fallback
 */
export function getTeamAsset(teamCodeOrId: string | null | undefined): TeamAssetDefinition | null {
  const key = normalizeTeamKey(teamCodeOrId)
  return TEAM_ASSET_MANIFEST[key] || null
}

/**
 * Retorna o caminho da vista lateral (SideView) da equipe
 */
export function getTeamSideView(teamCodeOrId: string | null | undefined): string | null {
  const asset = getTeamAsset(teamCodeOrId)
  return asset ? asset.sideViewPath : null
}

/**
 * Retorna o caminho do logo da equipe
 */
export function getTeamLogo(teamCodeOrId: string | null | undefined): string | null {
  const asset = getTeamAsset(teamCodeOrId)
  return asset?.logoPath || null
}
