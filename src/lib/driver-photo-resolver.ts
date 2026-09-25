/**
 * driver-photo-resolver.ts
 *
 * Resolvedor ÚNICO de fotos e retratos de pilotos no sistema:
 * - Pilotos Reais (F1 / Catálogo Canônico): driverId -> assetId (DRV_0001..DRV_0134) -> /pilotos/DRV_XXXX.jpg
 * - Pilotos Procedurais / Newgens: generatedPortraitProfileId -> /pilotos-gerados/Piloto_XX.jpg
 * - Imagens personalizadas (isCustom): customImageUrl direta
 * - Proibido lookup por nome para desambiguação canônica (lookup estrito por ID).
 * - Fallback gracioso: iniciais na cor da equipe ou placeholder se arquivo não responder.
 */

import {
  getCanonicalDriverMaster,
  getCanonicalAssetId,
  findCanonicalDriverMaster,
} from '@/lib/canonical-driver-database'
import { getGeneratedDriverPortraitProfile } from '@/lib/generated-driver-profiles'
import { DriverVisualAssetIdentity } from '@/types/procedural-driver'

export interface ResolvedDriverPhoto {
  url: string | null
  candidateUrls: string[]
  fallbackInitials: string
  teamColor: string
  sourceType: 'canonical_real' | 'generated_procedural' | 'custom' | 'fallback_initials'
  assetId?: string
  driverId?: string
}

export interface DriverPhotoResolveOptions {
  driverId?: string | null
  name?: string | null
  teamColor?: string | null
  visualIdentity?: DriverVisualAssetIdentity | null
  portraitAssetId?: string | null
  generatedPortraitProfileId?: string | null
  customImageUrl?: string | null
}

/**
 * Extrai iniciais limpas de um piloto para o fallback visual
 */
export function extractDriverInitials(name?: string | null): string {
  if (!name || !name.trim()) return 'F1'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Resolvedor Central Único de Fotos de Piloto
 */
export function resolveDriverPhoto(options: DriverPhotoResolveOptions): ResolvedDriverPhoto {
  const {
    driverId,
    name,
    teamColor = '#E10600',
    visualIdentity,
    portraitAssetId,
    generatedPortraitProfileId,
    customImageUrl,
  } = options

  const fallbackInitials = extractDriverInitials(name)
  const candidateUrls: string[] = []

  // 1. Imagem Customizada / Jogador (isCustom)
  if (customImageUrl) {
    candidateUrls.push(customImageUrl)
    return {
      url: customImageUrl,
      candidateUrls,
      fallbackInitials,
      teamColor: teamColor || '#E10600',
      sourceType: 'custom',
      driverId: driverId || undefined,
    }
  }

  if (visualIdentity?.isCustom && visualIdentity.customImageUrl) {
    candidateUrls.push(visualIdentity.customImageUrl)
    return {
      url: visualIdentity.customImageUrl,
      candidateUrls,
      fallbackInitials,
      teamColor: teamColor || '#E10600',
      sourceType: 'custom',
      driverId: driverId || undefined,
    }
  }

  // 2. Piloto Procedural / Newgen com perfil gerado (Piloto_01..Piloto_13)
  const effectiveGenProfileId =
    generatedPortraitProfileId ||
    (portraitAssetId && portraitAssetId.startsWith('GEN_') ? portraitAssetId : null) ||
    (portraitAssetId && portraitAssetId.toLowerCase().startsWith('piloto_')
      ? portraitAssetId
      : null) ||
    (visualIdentity?.portraitAssetId && visualIdentity.portraitAssetId.startsWith('GEN_')
      ? visualIdentity.portraitAssetId
      : null) ||
    (visualIdentity?.portraitAssetId &&
    visualIdentity.portraitAssetId.toLowerCase().startsWith('piloto_')
      ? visualIdentity.portraitAssetId
      : null)

  if (effectiveGenProfileId) {
    const genProfile = getGeneratedDriverPortraitProfile(effectiveGenProfileId)
    if (genProfile) {
      candidateUrls.push(genProfile.path)
      return {
        url: genProfile.path,
        candidateUrls,
        fallbackInitials,
        teamColor: teamColor || '#E10600',
        sourceType: 'generated_procedural',
        assetId: genProfile.profileId,
        driverId: driverId || undefined,
      }
    }
  }

  // 3. Piloto Real Canônico (driverId -> assetId DRV_XXXX -> /pilotos/DRV_XXXX.jpg)
  // Com resiliência para IDs de runtime do PocketBase (ex: '0mow8vmzk0y4z9s' ou '9uazqw522oc9p4z')
  // resolvendo pelo master canônico via driverId ou normalização por nome.
  const resolvedMaster =
    (driverId ? getCanonicalDriverMaster(driverId) : null) ||
    findCanonicalDriverMaster(driverId, name)

  const directAssetId = driverId ? getCanonicalAssetId(driverId) : null
  const effectiveAssetId = resolvedMaster?.assetId || directAssetId

  if (effectiveAssetId && effectiveAssetId.startsWith('DRV_')) {
    const canonicalPath = `/pilotos/${effectiveAssetId}.jpg`
    candidateUrls.push(canonicalPath)

    return {
      url: canonicalPath,
      candidateUrls,
      fallbackInitials,
      teamColor: teamColor || '#E10600',
      sourceType: 'canonical_real',
      assetId: effectiveAssetId,
      driverId: resolvedMaster?.driverId || driverId || undefined,
    }
  }

  // 4. Se o próprio portraitAssetId fornecido for um DRV_XXXX
  if (portraitAssetId && portraitAssetId.startsWith('DRV_')) {
    const canonicalPath = `/pilotos/${portraitAssetId}.jpg`
    candidateUrls.push(canonicalPath)
    return {
      url: canonicalPath,
      candidateUrls,
      fallbackInitials,
      teamColor: teamColor || '#E10600',
      sourceType: 'canonical_real',
      assetId: portraitAssetId,
      driverId: driverId || undefined,
    }
  }

  // 5. Fallback para inicial
  return {
    url: null,
    candidateUrls,
    fallbackInitials,
    teamColor: teamColor || '#E10600',
    sourceType: 'fallback_initials',
    driverId: driverId || undefined,
  }
}
