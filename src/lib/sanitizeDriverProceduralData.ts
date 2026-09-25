/**
 * sanitizeDriverProceduralData.ts
 *
 * Sanitizador canônico para o campo `procedural_data` de pilotos (DriverModel).
 *
 * ROOT CAUSE PREVENTED:
 * No PocketBase / SQLite, se um valor for lido ou escrito como Array JSON `[]`,
 * propriedades anexadas em JS (ex: `procData.generatedPortraitProfileId = ...`)
 * viram "expando properties" de um Array. A serialização Goja/PocketBase/JSON descarta
 * chaves não-numéricas de arrays e grava `[]`, destruindo o objeto inteiro.
 *
 * Regras Obrigatórias:
 * 1. Entrada array / null / undefined / primitiva -> normalizar para objeto plano `{}`.
 * 2. `patch` omitido ou undefined -> retornar `existing` normalizado (nunca array).
 * 3. `patch` parcial (objeto) -> merge com `existing` normalizado.
 * 4. `patch` array `[]` -> converter para objeto plano `{}`, rejeitar array.
 * 5. generatedPortraitProfileId e visualIdentity NUNCA são perdidos se existirem no existing.
 * 6. NUNCA retornar ou persistir um Array em `procedural_data`.
 */

import { preservePortraitFields } from './preservePortraitFields'

/**
 * Converte com segurança qualquer valor para objeto plano JS ({}),
 * garantindo que Arrays, strings JSON, null ou undefined nunca sejam tratados como Array.
 */
export function normalizeProceduralDataObject(input: any): Record<string, any> {
  if (!input) {
    return {}
  }

  // Se vier como string JSON (ex: do banco SQLite em alguns drivers legados)
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input)
      if (Array.isArray(parsed)) {
        return {}
      }
      if (parsed && typeof parsed === 'object') {
        return { ...parsed }
      }
      return {}
    } catch {
      return {}
    }
  }

  // Se vier como Array [], converter para objeto plano {} (rejeitar Array)
  if (Array.isArray(input)) {
    // Se por acaso tinha expando properties não numéricas no array
    const obj: Record<string, any> = {}
    for (const key of Object.keys(input)) {
      if (isNaN(Number(key))) {
        obj[key] = (input as any)[key]
      }
    }
    return obj
  }

  if (typeof input === 'object') {
    return { ...input }
  }

  return {}
}

/**
 * Sanitizador canônico para procedural_data de pilotos:
 * - existing: valor atual do driver (pode ser objeto, [], null, undefined)
 * - patch: alterações que se deseja aplicar (opcional)
 *
 * Retorna sempre um objeto plano Record<string, any> com campos de identidade protegidos.
 */
export function sanitizeDriverProceduralData(existing: any, patch?: any): Record<string, any> {
  const normExisting = normalizeProceduralDataObject(existing)

  // Se patch for undefined ou null, retorna o existing normalizado protegido
  if (patch === undefined || patch === null) {
    return normExisting
  }

  const normPatch = normalizeProceduralDataObject(patch)

  // Faz o merge de base
  const mergedBase = {
    ...normExisting,
    ...normPatch,
  }

  // Aplica blindagem canônica de retratos (preserva portraitProfileId e visualIdentity)
  const safeguarded = preservePortraitFields(normExisting, mergedBase)

  return normalizeProceduralDataObject(safeguarded)
}
