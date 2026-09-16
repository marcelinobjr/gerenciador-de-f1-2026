import { MANAGER_AVATAR_ASSETS, ManagerAvatarAsset } from '@/lib/lobby-assets'
import { MANAGER_PROFILES, getManagerProfileById } from '@/lib/manager-profiles'
import { ManagerProfile } from '@/types/career-wizard'

/**
 * Mapeamento canônico e estável do Arquétipo de Manager para a imagem oficial
 * obtida do diretório do Google Drive de Managers (6 arquivos oficiais):
 *
 * 1. 01-Estrategista.jpg -> id: 'estrategista' (O Estrategista)
 * 2. 02-Competidor.jpg   -> id: 'competidor'   (O Competidor)
 * 3. 03-Engenheiro.jpg   -> id: 'engenheiro'   (O Engenheiro)
 * 4. 04-Gestor.jpg       -> id: 'gestor'       (O Gestor)
 * 5. 05-Empresário.jpg   -> id: 'empresario'   (O Empresário)
 * 6. 06-Lider.jpg        -> id: 'lider'        (A Líder)
 */

export interface ManagerOfficialPortraitMeta {
  archetypeId: string
  archetypeTitle: string
  archetypeSlug: string
  officialFilename: string
  imageUrl: string
  topAttributes: { label: string; key: string; value: number }[]
}

export function getManagerOfficialPortrait(team?: any): ManagerOfficialPortraitMeta {
  const mp = team?.manager_profile
  const rawId =
    mp?.profileId || mp?.id || mp?.slug || (typeof mp === 'string' ? mp : '') || 'estrategista'
  const normalizedId = String(rawId).toLowerCase().trim()

  const profile: ManagerProfile = getManagerProfileById(normalizedId)
  const avatarAsset =
    MANAGER_AVATAR_ASSETS.find(
      (a) => a.id === profile.id || a.filename.toLowerCase().includes(profile.id),
    ) || MANAGER_AVATAR_ASSETS[0]

  // Atributos principais para o card resumido
  // Exemplo no print: Estratégia 90, Liderança 82, Negociação 88, Gestão de Pessoas 75
  const attrs = profile.baseAttributes || {}

  const topAttributes = [
    {
      label: 'Estratégia',
      key: 'visao_estrategica',
      value: attrs.visao_estrategica || attrs.gestao_corrida || 88,
    },
    {
      label: 'Liderança',
      key: 'lideranca',
      value: attrs.lideranca || 82,
    },
    {
      label: 'Negociação',
      key: 'negociacao',
      value: attrs.negociacao || attrs.gestao_financeira || 85,
    },
    {
      label: 'Gestão de Pessoas',
      key: 'gestao_pessoas',
      value: attrs.gestao_pessoas || 75,
    },
  ]

  return {
    archetypeId: profile.id,
    archetypeTitle: profile.title,
    archetypeSlug: profile.slug,
    officialFilename: avatarAsset.filename,
    imageUrl: avatarAsset.dropboxUrl,
    topAttributes,
  }
}
