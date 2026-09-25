/**
 * preservePortraitFields.ts
 *
 * Helper canônico para garantir que saves de procedural_data no app
 * preservem campos críticos de identificação de retratos gerados
 * (generatedPortraitProfileId e visualIdentity.portraitAssetId)
 * oriundos do registro persistido, evitando que reescritas parciais
 * ou instâncias em memória sem esses campos apaguem dados de backfill.
 */

export interface PortraitFieldCarrier {
  generatedPortraitProfileId?: string | null
  visualIdentity?: {
    portraitAssetId?: string | null
    generatedPortraitProfileId?: string | null
    [key: string]: any
  } | null
  [key: string]: any
}

/**
 * Faz merge seguro dos campos de retrato gerado de `persisted` em `next`.
 * - Preserva generatedPortraitProfileId persistido quando next não trouxer.
 * - Preserva visualIdentity.portraitAssetId persistido quando next não trouxer.
 * - Preserva visualIdentity.generatedPortraitProfileId persistido quando aplicável.
 * - NÃO inventa campos do nada se persisted não os possuir.
 * - Retorna next enriquecido (imutável ou estendido com segurança).
 */
export function preservePortraitFields<
  T extends PortraitFieldCarrier | null | undefined,
  U extends PortraitFieldCarrier | null | undefined,
>(persisted: T, next: U): (U & PortraitFieldCarrier) | null | undefined {
  if (!persisted || typeof persisted !== 'object') {
    return next
  }

  if (!next || typeof next !== 'object') {
    return next
  }

  const persistedProfileId =
    persisted.generatedPortraitProfileId ||
    persisted.visualIdentity?.generatedPortraitProfileId ||
    null

  const persistedPortraitAssetId = persisted.visualIdentity?.portraitAssetId || null

  // Se o registro persistido não tiver nenhum desses campos, nada a preservar
  if (!persistedProfileId && !persistedPortraitAssetId) {
    return next
  }

  const result: any = Array.isArray(next) ? [...next] : { ...next }

  // 1. generatedPortraitProfileId no nível raiz
  if (!result.generatedPortraitProfileId && persistedProfileId) {
    result.generatedPortraitProfileId = persistedProfileId
  }

  // 2. visualIdentity
  const nextVisual = result.visualIdentity
  const persistedVisual = persisted.visualIdentity

  if (persistedPortraitAssetId || persistedProfileId) {
    if (!nextVisual || typeof nextVisual !== 'object') {
      if (persistedVisual && typeof persistedVisual === 'object') {
        result.visualIdentity = { ...persistedVisual }
      } else {
        result.visualIdentity = {}
        if (persistedPortraitAssetId) {
          result.visualIdentity.portraitAssetId = persistedPortraitAssetId
        }
        if (persistedProfileId) {
          result.visualIdentity.generatedPortraitProfileId = persistedProfileId
        }
      }
    } else {
      const mergedVisual: any = { ...nextVisual }
      let visualModified = false

      if (!mergedVisual.portraitAssetId && persistedPortraitAssetId) {
        mergedVisual.portraitAssetId = persistedPortraitAssetId
        visualModified = true
      }

      if (!mergedVisual.generatedPortraitProfileId && persistedProfileId) {
        mergedVisual.generatedPortraitProfileId = persistedProfileId
        visualModified = true
      }

      if (visualModified) {
        result.visualIdentity = mergedVisual
      }
    }
  }

  return result as U & PortraitFieldCarrier
}
