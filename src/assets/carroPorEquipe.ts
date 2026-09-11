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
import audiCarImg from '@/assets/audi-13288.png'

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
 * Mapa onde as fotos específicas de cada escuderia serão cadastradas à medida que forem enviadas.
 * Caso o valor seja undefined ou null, a aplicação utiliza a imagem homologada de fallback.
 */
export const CARRO_POR_EQUIPE_MAP: Partial<Record<OfficialTeamKey, string>> = {
  audi: audiCarImg,
  mercedes: undefined,
  redbull: undefined,
  ferrari: undefined,
  mclaren: undefined,
  astonmartin: astonMartinCarImg,
  alpine: alpineCarImg,
  williams: undefined,
  racingbulls: undefined,
  haas: undefined,
  andretti: andrettiCarImg,
  cadillac: undefined,
}

/**
 * Imagem específica para escuderias personalizadas (criada/editada pelo jogador).
 * A definir pelo usuário depois — por enquanto cai no fallback.
 */
export const IMAGEM_CARRO_CUSTOM: string | undefined = undefined

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
    const specificImage = CARRO_POR_EQUIPE_MAP[normalizedKey]
    if (specificImage) {
      return specificImage
    }
  }

  return IMAGEM_CARRO_PADRAO_FALLBACK
}

export default CARRO_POR_EQUIPE_MAP
