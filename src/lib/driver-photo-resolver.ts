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
import { resolveCanonicalDriverImagePath } from '@/lib/driver-canonical-service'

import { DriverVisualAssetIdentity } from '@/types/procedural-driver'
import {
  assignGeneratedPortrait,
  resolveDriverIdentityGender,
} from '@/services/driverPortraitAssignmentService'

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
  gender?: string | null
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

  // 2. Piloto Procedural / Newgen com perfil gerado gravado (ORDEM ESTRITA - REGRA A: PERSISTIDO PRIMEIRO)
  // Resolve direto /pilotos-gerados/{id}.jpg sem busca por nome
  const effectiveGenProfileId =
    generatedPortraitProfileId ||
    visualIdentity?.generatedPortraitProfileId ||
    (portraitAssetId &&
    (portraitAssetId.startsWith('GEN_') || portraitAssetId.toLowerCase().startsWith('piloto'))
      ? portraitAssetId
      : null) ||
    (visualIdentity?.portraitAssetId &&
    (visualIdentity.portraitAssetId.startsWith('GEN_') ||
      visualIdentity.portraitAssetId.toLowerCase().startsWith('piloto'))
      ? visualIdentity.portraitAssetId
      : null)

  if (effectiveGenProfileId) {
    const cleanProfileId = effectiveGenProfileId.replace(/\.jpg$/i, '')
    // Tenta obter do catálogo de perfis gerados ou resolve direto o path
    const genProfile = getGeneratedDriverPortraitProfile(cleanProfileId)
    const directPath = genProfile?.path || `/pilotos-gerados/${cleanProfileId}.jpg`

    candidateUrls.push(directPath)
    return {
      url: directPath,
      candidateUrls,
      fallbackInitials,
      teamColor: teamColor || '#E10600',
      sourceType: 'generated_procedural',
      assetId: genProfile?.profileId || cleanProfileId,
      driverId: driverId || undefined,
    }
  }

  // Detecta se é piloto explicitamente procedural (por id, tipo de origem ou visualIdentity)
  const isProcedural = Boolean(
    (driverId && driverId.startsWith('drv_proc_')) ||
    (visualIdentity && !portraitAssetId?.startsWith('DRV_') && !driverId?.startsWith('mbj-')),
  )

  // 3. Piloto Real Canônico (DRV_0001..DRV_0188 / Catálogo Master Canônico)
  // REGRA B: Pilotos procedurais IGNORAM colisões nominais com pilotos reais!
  // Apenas pilotos não-procedurais fazem busca ampla por nome no catálogo canônico real.
  if (!isProcedural) {
    // 3.1 Resolução Canônica Direta BUG-PILOTOS-01
    const directCanonicalPath = resolveCanonicalDriverImagePath(driverId, name)
    if (directCanonicalPath && !directCanonicalPath.includes('pilotos-gerados')) {
      candidateUrls.push(directCanonicalPath)
      return {
        url: directCanonicalPath,
        candidateUrls,
        fallbackInitials,
        teamColor: teamColor || '#E10600',
        sourceType: 'canonical_real',
        assetId: directCanonicalPath.split('/').pop()?.replace('.jpg', ''),
        driverId: driverId || undefined,
      }
    }

    // 3.2 Se o próprio portraitAssetId fornecido for um DRV_XXXX
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

    // 3.3 Piloto Real Canônico (driverId -> assetId DRV_XXXX -> /pilotos/DRV_XXXX.jpg)
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
  }

  // 4. Se o próprio portraitAssetId fornecido for um DRV_XXXX (caso especial para procedurais com asset DRV)
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

  // 5. REGRA C: Hash determinístico SÓ como último fallback, usando semente imutável
  // (prioriza visualSeed ou driverId original se presente, evitando id volátil do banco)
  if (driverId || (name && name.trim()) || visualIdentity?.visualSeed) {
    const immutableSeed =
      (visualIdentity?.visualSeed !== undefined ? `seed_${visualIdentity.visualSeed}` : null) ||
      (driverId && driverId.startsWith('drv_proc_') ? driverId : null) ||
      (driverId && driverId.trim()) ||
      (name && name.trim().toLowerCase())

    const autoAssignedPath = assignGeneratedPortrait({
      driverId: immutableSeed,
      name,
      gender: options.gender,
      visualIdentity,
    })

    if (autoAssignedPath) {
      candidateUrls.push(autoAssignedPath)
      const cleanAssetId = autoAssignedPath.split('/').pop()?.replace('.jpg', '')
      return {
        url: autoAssignedPath,
        candidateUrls,
        fallbackInitials,
        teamColor: teamColor || '#E10600',
        sourceType: 'generated_procedural',
        assetId: cleanAssetId,
        driverId: driverId || undefined,
      }
    }
  }

  // 6. Fallback final para inicial (quando nem id nem nome existirem)
  return {
    url: null,
    candidateUrls,
    fallbackInitials,
    teamColor: teamColor || '#E10600',
    sourceType: 'fallback_initials',
    driverId: driverId || undefined,
  }
}
