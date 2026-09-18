import audiSideView from '@/assets/audivl-cfef2.jpg'

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
    sideViewPath: audiSideView,
    aliases: ['audi', 'audi_f1', 'audi-sport', 'audi-revolut'],
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

export { getTeamReducedLogoUrl, teamAssetResolver } from '@/lib/team-reduced-logo-resolver'
export {
  getTeamCarPhotoUrl,
  getTeamCarPhotoDef,
  TEAM_CAR_PHOTOS_MANIFEST,
} from '@/lib/team-car-photo-resolver'
