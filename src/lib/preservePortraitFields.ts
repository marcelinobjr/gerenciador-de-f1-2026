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
 * - Retorna next enriquecido (objeto plano {} desempacotado, nunca Array).
 */
export function preservePortraitFields<
  T extends PortraitFieldCarrier | null | undefined,
  U extends PortraitFieldCarrier | null | undefined,
>(persisted: T, next: U): (U & PortraitFieldCarrier) | null | undefined {
  if (!persisted || typeof persisted !== 'object') {
    return (Array.isArray(next) ? { ...next } : next) as
      | (U & PortraitFieldCarrier)
      | null
      | undefined
  }

  if (!next || typeof next !== 'object') {
    return next
  }

  // Se next ou persisted for Array, desempacotar para objeto plano {} antes de mesclar
  const safePersisted: any = Array.isArray(persisted) ? { ...persisted } : persisted
  const result: any = Array.isArray(next) ? { ...next } : { ...next }

  const persistedProfileIdSafe =
    safePersisted.generatedPortraitProfileId ||
    safePersisted.visualIdentity?.generatedPortraitProfileId ||
    null

  const persistedPortraitAssetIdSafe = safePersisted.visualIdentity?.portraitAssetId || null

  // Se o registro persistido não tiver nenhum desses campos, retorna result como objeto
  if (!persistedProfileIdSafe && !persistedPortraitAssetIdSafe) {
    return result as U & PortraitFieldCarrier
  }

  // 1. generatedPortraitProfileId no nível raiz
  if (!result.generatedPortraitProfileId && persistedProfileIdSafe) {
    result.generatedPortraitProfileId = persistedProfileIdSafe
  }

  // 2. visualIdentity
  const nextVisual = result.visualIdentity
  const persistedVisual = safePersisted.visualIdentity

  if (persistedPortraitAssetIdSafe || persistedProfileIdSafe) {
    if (!nextVisual || typeof nextVisual !== 'object' || Array.isArray(nextVisual)) {
      if (
        persistedVisual &&
        typeof persistedVisual === 'object' &&
        !Array.isArray(persistedVisual)
      ) {
        result.visualIdentity = { ...persistedVisual }
      } else {
        result.visualIdentity = {}
        if (persistedPortraitAssetIdSafe) {
          result.visualIdentity.portraitAssetId = persistedPortraitAssetIdSafe
        }
        if (persistedProfileIdSafe) {
          result.visualIdentity.generatedPortraitProfileId = persistedProfileIdSafe
        }
      }
    } else {
      const mergedVisual: any = { ...nextVisual }
      let visualModified = false

      if (!mergedVisual.portraitAssetId && persistedPortraitAssetIdSafe) {
        mergedVisual.portraitAssetId = persistedPortraitAssetIdSafe
        visualModified = true
      }

      if (!mergedVisual.generatedPortraitProfileId && persistedProfileIdSafe) {
        mergedVisual.generatedPortraitProfileId = persistedProfileIdSafe
        visualModified = true
      }

      if (visualModified) {
        result.visualIdentity = mergedVisual
      }
    }
  }

  return result as U & PortraitFieldCarrier
}
