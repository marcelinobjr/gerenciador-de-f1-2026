/**
 * Mapa de imagens do monoposto 2026 por equipe — EXCLUSIVO da aba Carro (CarPage / RealisticCarHero).
 * SEPARADO do mapa de imagens da aba Equipes (Teams.tsx).
 *
 * Estrutura pronta para receber as fotos oficiais que serão enviadas pelo usuário em lotes
 * (Audi, Mercedes, Red Bull, Ferrari, McLaren, Aston Martin, Alpine, Williams, Racing Bulls, Haas, Andretti + equipe personalizada).
 *
 * Equipes sem imagem própria usam o monoposto branco genérico homologado como fallback.
 * Equipes personalizadas usarão uma imagem em branco (por enquanto cai no fallback).
 */

import defaultWhiteCarFallback from '@/assets/carro-lateral-2986d.jpeg'
import alpineCarImg from '@/assets/alpine-c36dc.png'
import andrettiCarImg from '@/assets/andretti-b0db5.png'
import astonMartinCarImg from '@/assets/astonmartin-38691.png'
import audiHeroCarImg from '@/assets/audi-a0460.png'
import audiCarImg from '@/assets/audi-13288.png'

export { audiHeroCarImg }
import cadillacCarImg from '@/assets/cadilac01-b80f2.png'
import ferrariCarImg from '@/assets/ferrari-918a9.png'
import haasCarImg from '@/assets/haas-6f08d.png'
import mclarenCarImg from '@/assets/mclaren-f7e77.png'
import mercedesCarImg from '@/assets/mercedes-fbf8d.png'
import racingBullsCarImg from '@/assets/vcarb-cdba0.png'
import redbullCarImg from '@/assets/redbull-f11b0.png'
import williamsCarImg from '@/assets/williams-4b724.png'
import customWhiteCarImg from '@/assets/carro-lateral-3bf16.jpeg'

export type OfficialTeamKey =
  | 'audi'
  | 'mercedes'
  | 'redbull'
  | 'ferrari'
  | 'mclaren'
  | 'astonmartin'
  | 'alpine'
  | 'williams'
  | 'racingbulls'
  | 'haas'
  | 'andretti'
  | 'cadillac'

/**
 * Mapa onde as fotos específicas de cada escuderia do grid 2026 estão cadastradas.
 * Caso o valor seja undefined ou null, a aplicação utiliza a imagem homologada de fallback.
 */
export const CARRO_POR_EQUIPE_MAP: Partial<Record<OfficialTeamKey, string>> = {
  audi: audiHeroCarImg,
  mercedes: mercedesCarImg,
  redbull: redbullCarImg,
  ferrari: ferrariCarImg,
  mclaren: mclarenCarImg,
  astonmartin: astonMartinCarImg,
  alpine: alpineCarImg,
  williams: williamsCarImg,
  racingbulls: racingBullsCarImg,
  haas: haasCarImg,
  andretti: andrettiCarImg,
  cadillac: cadillacCarImg,
}

/**
 * Imagem específica para escuderias personalizadas (equipe própria montada pelo jogador).
 * Monoposto branco limpo vista lateral sem patrocinadores, perfeito para decalques e customização.
 */
export const IMAGEM_CARRO_CUSTOM: string = customWhiteCarImg

/**
 * Imagem padrão de fallback (monoposto branco FIA 2026 limpo).
 */
export const IMAGEM_CARRO_PADRAO_FALLBACK: string = defaultWhiteCarFallback

/**
 * Resolve a imagem lateral do carro para a aba Carro com base na chave da equipe ou status de customização.
 *
 * @param teamKey Chave identificadora da equipe (ex: 'audi', 'ferrari', 'mercedes')
 * @param isCustom Se a equipe é personalizada pelo jogador (12ª escuderia)
 * @returns Caminho da imagem resolvido
 */
export function getCarroPorEquipeImage(teamKey?: string | null, isCustom?: boolean): string {
  if (isCustom) {
    return IMAGEM_CARRO_CUSTOM || IMAGEM_CARRO_PADRAO_FALLBACK
  }

  if (teamKey) {
    const normalizedKey = teamKey.toLowerCase().replace(/[-_]/g, '') as OfficialTeamKey
    // 1. Checa se há imagem mapeada no bundle
    const specificImage = CARRO_POR_EQUIPE_MAP[normalizedKey]
    if (specificImage) {
      return specificImage
    }
    // 2. Fallback para caminho público se equipe existir em /equipes/{key}.png ou /carros/{key}.png
    return `/equipes/${normalizedKey}.png`
  }

  return IMAGEM_CARRO_PADRAO_FALLBACK
}

export default CARRO_POR_EQUIPE_MAP
