// Mapeamento e URLs públicas seguras de assets do jogo:
// - 6 Avatares de Manager (Manager.pdf e pasta Dropbox)
// - Logos de Equipes (Assets locais vetoriais em src/assets/logos/*.svg e fallback canônico)
// - Modelos de Carro (Carro1 a Carro5 para equipe personalizada)

import { TEAM_LOGOS, resolveTeamLogo, normalizeTeamKey } from '@/data/teamLogos'

export interface ManagerAvatarAsset {
  id: string
  number: number
  title: string
  filename: string
  dropboxUrl: string
}

export const MANAGER_AVATAR_ASSETS: ManagerAvatarAsset[] = [
  {
    id: 'estrategista',
    number: 1,
    title: 'O Estrategista',
    filename: '01-Estrategista.png',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/us1odvwyg5fika5v93cp2/ANa1G4wrjfMjDpOX1cbHCBM/01-Estrategista.png?rlkey=g7j5jucdc3rhdvv7211cfsuu1&dl=1',
  },
  {
    id: 'competidor',
    number: 2,
    title: 'O Competidor',
    filename: '02-Competidor.png',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/us1odvwyg5fika5v93cp2/AHRM1kX4g0hdpug4iD7J6gk/02-Competidor.png?rlkey=g7j5jucdc3rhdvv7211cfsuu1&dl=1',
  },
  {
    id: 'engenheiro',
    number: 3,
    title: 'O Engenheiro',
    filename: '03-Engenheiro.png',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/us1odvwyg5fika5v93cp2/AIlU1g5tLGEU4Fm-HM3McVc/03-Engenheiro.png?rlkey=g7j5jucdc3rhdvv7211cfsuu1&dl=1',
  },
  {
    id: 'gestor',
    number: 4,
    title: 'O Gestor',
    filename: '04-Gestor.png',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/us1odvwyg5fika5v93cp2/AGbFqK-fLlHG1VqtCCoX1js/04-Gestor.png?rlkey=g7j5jucdc3rhdvv7211cfsuu1&dl=1',
  },
  {
    id: 'empresario',
    number: 5,
    title: 'O Empresário',
    filename: '05-Empresário.png',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/us1odvwyg5fika5v93cp2/AHmp368NtSG3cwf_cndqqFA/05-Empres%C3%A1rio.png?rlkey=g7j5jucdc3rhdvv7211cfsuu1&dl=1',
  },
  {
    id: 'lider',
    number: 6,
    title: 'A Líder',
    filename: '06-Lider.png',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/us1odvwyg5fika5v93cp2/ANcmAfQXvz3R0UYLZL42APs/06-Lider.png?rlkey=g7j5jucdc3rhdvv7211cfsuu1&dl=1',
  },
]

export const CAR_MODEL_ASSETS = [
  {
    id: 'Carro1',
    name: 'Modelo Aço Escovado / Conceito 1',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/6jgy9mlbhc65lwk657q3t/AJ1NShrXSqEUQ-vAxdle1Yk/Carro1.png?rlkey=065e9g795k7eh1tvrvwwd8fyo&dl=1',
  },
  {
    id: 'Carro2',
    name: 'Modelo Asa Alfa / Conceito 2',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/6jgy9mlbhc65lwk657q3t/ABVGJE2I33GSZU-vJjUurHk/Carro2.png?rlkey=065e9g795k7eh1tvrvwwd8fyo&dl=1',
  },
  {
    id: 'Carro3',
    name: 'Modelo Velocitá / Conceito 3',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/6jgy9mlbhc65lwk657q3t/AOb9iAOcaKCCO5QSUVxNsFw/Carro3.png?rlkey=065e9g795k7eh1tvrvwwd8fyo&dl=1',
  },
  {
    id: 'Carro4',
    name: 'Modelo Fênix / Conceito 4',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/6jgy9mlbhc65lwk657q3t/AFRDu-0fF1ap81AVRExeySk/Carro4.png?rlkey=065e9g795k7eh1tvrvwwd8fyo&dl=1',
  },
  {
    id: 'Carro5',
    name: 'Modelo Vórtice / Conceito 5',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/6jgy9mlbhc65lwk657q3t/ANP1ScSk83fIidWhZa92m60/Carro5.png?rlkey=065e9g795k7eh1tvrvwwd8fyo&dl=1',
  },
]

/**
 * Helper inline para gerar um data URI SVG seguro a partir do Crest de uma equipe.
 * Usado como fallback 100% local e imune a CORS para equipes sem arquivo SVG vetorial estático.
 */
function createCrestDataUri(
  primaryColor: string,
  secondaryColor: string,
  acronym: string,
  textColor: string = '#FFFFFF',
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="18" fill="${primaryColor}" stroke="${secondaryColor}" stroke-width="2.5"/><text x="20" y="24" font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-weight="900" font-size="12" fill="${textColor}" text-anchor="middle" letter-spacing="-0.5">${acronym}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/**
 * Mapeamento das logos de equipes usando assets locais em src/assets/logos/ ou crest SVG procedural em data: URI.
 * Zero URLs externas de terceiros/Dropbox: bundled localmente pelo Vite, imunes a bloqueios de CORS e html-to-image.
 */
export const TEAM_LOGOS_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const [key, entry] of Object.entries(TEAM_LOGOS)) {
    if (entry.logoUrl) {
      map[key] = entry.logoUrl
    } else if (entry.crest) {
      map[key] = createCrestDataUri(
        entry.crest.primaryColor,
        entry.crest.secondaryColor,
        entry.crest.acronym,
        entry.crest.textColor || '#FFFFFF',
      )
    }
  }
  return map
})()

/**
 * Retorna o logo seguro (asset local bundled pelo Vite ou data: URI SVG de crest).
 * Nunca retorna URLs do Dropbox para evitar falhas de CORS no html-to-image de preview/screenshots.
 */
export function getTeamLogoUrl(teamKey: string | null | undefined): string | undefined {
  if (!teamKey) return undefined
  const clean = teamKey.toLowerCase().trim()
  const normalized = clean.replace(/[^a-z0-9]/g, '')

  // 1. Direct match no TEAM_LOGOS_MAP
  if (TEAM_LOGOS_MAP[normalized]) return TEAM_LOGOS_MAP[normalized]
  if (TEAM_LOGOS_MAP[clean]) return TEAM_LOGOS_MAP[clean]

  // 2. Normalização canônica via resolveTeamLogo
  const canonicalKey = normalizeTeamKey(teamKey)
  if (TEAM_LOGOS_MAP[canonicalKey]) return TEAM_LOGOS_MAP[canonicalKey]

  const resolved = resolveTeamLogo(teamKey)
  if (resolved.type === 'logo' && resolved.logoUrl) {
    return resolved.logoUrl
  }
  if (resolved.crest) {
    return createCrestDataUri(
      resolved.crest.primaryColor,
      resolved.crest.secondaryColor,
      resolved.crest.acronym,
      resolved.crest.textColor || '#FFFFFF',
    )
  }

  // Fallback seguro: se não encontrar nada, gera SVG neutro com a sigla de fallback
  if (resolved.fallbackText) {
    return createCrestDataUri('#475569', '#94A3B8', resolved.fallbackText, '#FFFFFF')
  }

  return undefined
}
