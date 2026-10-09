/**
 * raceDiagnosticExport.ts
 *
 * Utilitário puramente de leitura para diagnóstico pontual da corrida / fim de semana.
 * Coleta chaves de localStorage associadas à carreira e ao fim de semana,
 * além de inventário completo e seguro do storage (somente chaves/caminhos sem expor valores ou dados de auth).
 */

export const TARGET_CAREER_ID = '31b0p9k5ygw2sc8'

export interface StorageInventoryGroup {
  totalKeysFound: number
  matchingFilterCount: number
  keys: string[]
}

export interface StorageInventory {
  totalStorageKeys: number
  readStatus: 'success' | 'error'
  readError?: string
  groups: {
    officialResult: StorageInventoryGroup
    raceResult: StorageInventoryGroup
    careerApplyResult: StorageInventoryGroup
    driverMorale: StorageInventoryGroup
  }
  allDiagnosticRelevantKeys: string[]
}

export interface AppRuntimeContext {
  origin: string
  pathname: string
  isIframe: boolean
  careerId?: string
  careerIdOrigin?: string
  pocketBaseSeasonId?: string
  pocketBaseSeasonIdOrigin?: string
  internalNumericSeasonId?: number | string
  internalNumericSeasonIdOrigin?: string
  displayedYear?: number
  displayedYearOrigin?: string
  currentRound?: number
  currentRoundOrigin?: string
  sessionType?: string
  sessionTypeOrigin?: string
}

export interface RaceDiagnosticData {
  exportedAt: string
  origin: string
  careerId: string
  appContext: AppRuntimeContext
  inventory: StorageInventory
  allowedPrefixes: string[]
  recordCount: number
  records: Record<string, string>
}

// Chaves e substrings protegidas que JAMAIS devem figurar no inventário nem nos registros
const PROTECTED_AUTH_PATTERNS = [
  'auth',
  'token',
  'pocketbase',
  'credential',
  'password',
  'secret',
  'jwt',
  'api_key',
  'apikey',
]

export function isAuthOrSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return PROTECTED_AUTH_PATTERNS.some((pat) => lower.includes(pat))
}

export interface CollectDiagnosticOptions {
  careerId?: string
  appContext?: Partial<AppRuntimeContext>
  storage?: Storage
}

/**
 * Construtores reais e canônicos de prefixos/chaves confirmados no código:
 * 1. Resultado Oficial: f1_2026_canonical_official_result:${careerId}:
 * 2. Race Result (carreira): race_result_${careerId}_
 * 3. Career Apply Result: career_apply_result_${careerId}_
 * 4. Driver Morale (marcadores, confirmação e recibos):
 *    - driver_morale_${careerId}_
 *    - driver_morale_applied_${careerId}_
 *    - driver_morale_receipt_${careerId}_
 */
export function getDiagnosticAllowedPrefixes(careerId: string): string[] {
  return [
    `f1_2026_canonical_official_result:${careerId}:`,
    `race_result_${careerId}_`,
    `career_apply_result_${careerId}_`,
    `driver_morale_applied_${careerId}_`,
    `driver_morale_receipt_${careerId}_`,
    `driver_morale_${careerId}_`,
  ]
}

/**
 * Coleta diagnóstico pontual seguro:
 * - Inventário de chaves dos grupos confirmados (sem valores, filtrando auth/tokens)
 * - Registros de valores estritamente da carreira filtrada
 * - Metadados e contexto de execução
 */
export function collectRaceDiagnosticData(
  targetCareerId: string = TARGET_CAREER_ID,
  options?: CollectDiagnosticOptions,
): RaceDiagnosticData {
  const careerId = options?.careerId || targetCareerId

  let origin = 'unknown'
  let pathname = 'unknown'
  let isIframe = false

  if (typeof window !== 'undefined') {
    origin = window.location?.origin || 'unknown'
    pathname = window.location?.pathname || 'unknown'
    try {
      isIframe = window.self !== window.top
    } catch {
      isIframe = true
    }
  }

  const storage: Storage | undefined =
    options?.storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)

  const prefixes = getDiagnosticAllowedPrefixes(careerId)

  // 1. Inventário de chaves
  let totalStorageKeys = 0
  let readStatus: 'success' | 'error' = 'success'
  let readError: string | undefined = undefined
  const allKeys: string[] = []

  if (storage) {
    try {
      totalStorageKeys = storage.length
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i)
        if (k && !isAuthOrSensitiveKey(k)) {
          allKeys.push(k)
        }
      }
    } catch (err: any) {
      readStatus = 'error'
      readError = err?.message || String(err)
    }
  } else {
    readStatus = 'error'
    readError = 'Storage (localStorage) indisponível no ambiente de execução.'
  }

  allKeys.sort()

  // Classificação nos 4 grupos pertinentes (independentemente do careerId)
  const officialResultAll = allKeys.filter((k) =>
    k.startsWith('f1_2026_canonical_official_result:'),
  )
  const raceResultAll = allKeys.filter((k) => k.startsWith('race_result_'))
  const careerApplyResultAll = allKeys.filter((k) => k.startsWith('career_apply_result_'))
  const driverMoraleAll = allKeys.filter(
    (k) =>
      k.startsWith('driver_morale_') ||
      k.startsWith('driver_morale_applied_') ||
      k.startsWith('driver_morale_receipt_'),
  )

  // Subconjuntos que correspondem ao filtro atual (específicos do careerId)
  const officialResultMatched = officialResultAll.filter((k) =>
    k.startsWith(`f1_2026_canonical_official_result:${careerId}:`),
  )
  const raceResultMatched = raceResultAll.filter((k) => k.startsWith(`race_result_${careerId}_`))
  const careerApplyResultMatched = careerApplyResultAll.filter((k) =>
    k.startsWith(`career_apply_result_${careerId}_`),
  )
  const driverMoraleMatched = driverMoraleAll.filter(
    (k) =>
      k.startsWith(`driver_morale_${careerId}_`) ||
      k.startsWith(`driver_morale_applied_${careerId}_`) ||
      k.startsWith(`driver_morale_receipt_${careerId}_`),
  )

  const relevantKeys = Array.from(
    new Set([...officialResultAll, ...raceResultAll, ...careerApplyResultAll, ...driverMoraleAll]),
  ).sort()

  const inventory: StorageInventory = {
    totalStorageKeys,
    readStatus,
    readError,
    groups: {
      officialResult: {
        totalKeysFound: officialResultAll.length,
        matchingFilterCount: officialResultMatched.length,
        keys: officialResultAll,
      },
      raceResult: {
        totalKeysFound: raceResultAll.length,
        matchingFilterCount: raceResultMatched.length,
        keys: raceResultAll,
      },
      careerApplyResult: {
        totalKeysFound: careerApplyResultAll.length,
        matchingFilterCount: careerApplyResultMatched.length,
        keys: careerApplyResultAll,
      },
      driverMorale: {
        totalKeysFound: driverMoraleAll.length,
        matchingFilterCount: driverMoraleMatched.length,
        keys: driverMoraleAll,
      },
    },
    allDiagnosticRelevantKeys: relevantKeys,
  }

  // 2. Extração segura dos valores (APENAS para os prefixos que casam com o careerId)
  const records: Record<string, string> = {}
  if (storage && readStatus === 'success') {
    for (const key of relevantKeys) {
      const matchesCareer = prefixes.some((p) => key.startsWith(p))
      if (matchesCareer) {
        try {
          const val = storage.getItem(key)
          if (val !== null) {
            records[key] = val
          }
        } catch {
          // falha individual de leitura não bloqueia
        }
      }
    }
  }

  const recordCount = Object.keys(records).length

  const resolvedAppContext: AppRuntimeContext = {
    origin,
    pathname,
    isIframe,
    careerId,
    careerIdOrigin: options?.appContext?.careerIdOrigin || 'parameter',
    pocketBaseSeasonId: options?.appContext?.pocketBaseSeasonId,
    pocketBaseSeasonIdOrigin: options?.appContext?.pocketBaseSeasonIdOrigin,
    internalNumericSeasonId: options?.appContext?.internalNumericSeasonId,
    internalNumericSeasonIdOrigin: options?.appContext?.internalNumericSeasonIdOrigin,
    displayedYear: options?.appContext?.displayedYear,
    displayedYearOrigin: options?.appContext?.displayedYearOrigin,
    currentRound: options?.appContext?.currentRound,
    currentRoundOrigin: options?.appContext?.currentRoundOrigin,
    sessionType: options?.appContext?.sessionType,
    sessionTypeOrigin: options?.appContext?.sessionTypeOrigin,
  }

  return {
    exportedAt: new Date().toISOString(),
    origin,
    careerId,
    appContext: resolvedAppContext,
    inventory,
    allowedPrefixes: prefixes,
    recordCount,
    records,
  }
}

/**
 * Dispara o download de um arquivo JSON contendo o diagnóstico formatado.
 */
export function downloadDiagnosticJson(
  data: RaceDiagnosticData,
  fileName = 'apex-diagnostico-australia.json',
): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }

  try {
    const jsonStr = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
  } catch (err) {
    console.error('[RaceDiagnostic] Falha ao fazer download do JSON:', err)
    return false
  }
}

/**
 * Copia a string JSON formatada para a área de transferência com fallback
 * de textarea selecionável caso o navegador mobile bloqueie.
 */
export async function copyDiagnosticToClipboard(
  data: RaceDiagnosticData,
): Promise<{ success: boolean; fallbackText?: string }> {
  const jsonStr = JSON.stringify(data, null, 2)

  if (typeof window === 'undefined') {
    return { success: false, fallbackText: jsonStr }
  }

  // Tenta navigator.clipboard primeiro
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(jsonStr)
      return { success: true }
    } catch (e) {
      console.warn('[RaceDiagnostic] Clipboard API bloqueada ou indisponível, usando fallback:', e)
    }
  }

  // Fallback: elemento textarea temporário
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea')
      textArea.value = jsonStr
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      if (successful) {
        return { success: true }
      }
    } catch (err) {
      console.warn('[RaceDiagnostic] document.execCommand falhou:', err)
    }
  }

  return { success: false, fallbackText: jsonStr }
}
