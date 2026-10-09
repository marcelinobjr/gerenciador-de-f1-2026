/**
 * raceDiagnosticExport.ts
 *
 * Utilitário puramente de leitura para diagnóstico pontual da corrida / fim de semana.
 * Coleta exclusivamente chaves de localStorage associadas à carreira especificada
 * através de uma lista explícita de prefixos permitidos, sem tokens, credenciais ou outras carreiras.
 *
 * Baseado estritamente nos construtores de chave canônicos:
 * - canonicalRaceResultService:
 *     `${CANONICAL_OFFICIAL_RESULT_STORAGE_PREFIX}:${careerId}:${season}:${raceId}`
 * - canonicalCareerPersistenceService:
 *     `${CANONICAL_CAREER_RACE_RESULT_PREFIX}_${careerId}_${sId}_${round}${variantTag}`
 *     `${CANONICAL_CAREER_APPLY_JOURNAL_PREFIX}_${careerId}_${sId}_${round}${variantTag}`
 * - driverMoraleService:
 *     `driver_morale_${career}_${season}_${round}${session}_${driverId}`
 *     `driver_morale_applied_${career}_${season}_${round}${session}_${driverId}`
 *     `driver_morale_receipt_${career}_${season}_${round}${session}_${driverId}`
 */

import { CANONICAL_OFFICIAL_RESULT_STORAGE_PREFIX } from '@/services/canonicalRaceResultService'
import {
  CANONICAL_CAREER_RACE_RESULT_PREFIX,
  CANONICAL_CAREER_APPLY_JOURNAL_PREFIX,
} from '@/services/canonicalCareerPersistenceService'

export const TARGET_CAREER_ID = '31b0p9k5ygw2sc8'

/**
 * Padrões de chaves estritamente sensíveis que NUNCA devem ser coletadas
 * nem figurar em listas de nomes de inventário.
 */
export const SENSITIVE_STORAGE_KEY_PATTERNS: RegExp[] = [
  /pocketbase/i,
  /pb_/i,
  /auth/i,
  /token/i,
  /jwt/i,
  /credential/i,
  /password/i,
  /secret/i,
  /cookie/i,
  /session_user/i,
  /sb-/i,
]

export function isAuthOrSensitiveKey(key: string): boolean {
  return SENSITIVE_STORAGE_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

/**
 * Constrói os prefixos de filtro autorizados para uma carreira específica,
 * replicando exatamente a convenção de delimitadores e formatos dos serviços canônicos.
 */
export function buildAllowedStoragePrefixes(careerId: string): string[] {
  return [
    // canonicalRaceResultService: f1_2026_canonical_official_result:{careerId}:
    `${CANONICAL_OFFICIAL_RESULT_STORAGE_PREFIX}:${careerId}:`,
    // canonicalCareerPersistenceService: race_result_{careerId}_
    `${CANONICAL_CAREER_RACE_RESULT_PREFIX}_${careerId}_`,
    // canonicalCareerPersistenceService: career_apply_result_{careerId}_
    `${CANONICAL_CAREER_APPLY_JOURNAL_PREFIX}_${careerId}_`,
    // driverMoraleService (applied): driver_morale_applied_{careerId}_
    `driver_morale_applied_${careerId}_`,
    // driverMoraleService (receipt): driver_morale_receipt_{careerId}_
    `driver_morale_receipt_${careerId}_`,
    // driverMoraleService (processed): driver_morale_{careerId}_
    `driver_morale_${careerId}_`,
  ]
}

export const ALLOWED_STORAGE_PREFIXES = buildAllowedStoragePrefixes(TARGET_CAREER_ID)

export interface DiagnosticGroupInventory {
  groupName: string
  totalKeysFound: number
  matchingFilterCount: number
  keys: string[]
}

export interface DiagnosticInventory {
  origin: string
  pathname: string
  dentroDeIframe: boolean
  statusDaLeitura: 'ok' | 'erro'
  // compatibilidade com testes anteriores:
  readStatus?: 'success' | 'error'
  readError?: string
  mensagemDeErro?: string
  totalDeChavesNoLocalStorage: number
  totalStorageKeys?: number
  grupos: {
    resultadoOficial: DiagnosticGroupInventory
    raceResult: DiagnosticGroupInventory
    careerApplyResult: DiagnosticGroupInventory
    recibosEMarcadoresMoral: DiagnosticGroupInventory
  }
  // alias compatível em inglês caso testes dependam:
  groups?: {
    officialResult: DiagnosticGroupInventory
    raceResult: DiagnosticGroupInventory
    careerApplyResult: DiagnosticGroupInventory
    driverMorale: DiagnosticGroupInventory
  }
  todasAsChavesDiagnosticas?: string[]
  allDiagnosticRelevantKeys?: string[]
}

export interface DiagnosticAppContext {
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
  [key: string]: any
}

export interface DiagnosticIdentificadores {
  careerId: { valor: string; origem: string }
  pocketBaseSeasonId: { valor: string; origem: string }
  internalNumericSeasonId: { valor: string; origem: string }
  displayedYear: { valor: string | number; origem: string }
  currentRound: { valor: string | number; origem: string }
  sessionType: { valor: string; origem: string }
}

export interface RaceDiagnosticData {
  exportedAt: string
  origin: string
  pathname: string
  dentroDeIframe: boolean
  statusDaLeitura: 'ok' | 'erro'
  careerId: string
  allowedPrefixes: string[]
  recordCount: number
  records: Record<string, string>
  inventario: DiagnosticInventory
  // Alias retrocompatível com suíte anterior:
  inventory: DiagnosticInventory
  identificadores: DiagnosticIdentificadores
  // Alias retrocompatível com suíte anterior:
  appContext: DiagnosticAppContext
}

/**
 * Avalia se uma chave do localStorage pertence a um dos grupos canônicos
 * independentemente de qual identificador de carreira esteja nela.
 */
function matchGroupName(
  key: string,
): 'resultadoOficial' | 'raceResult' | 'careerApplyResult' | 'recibosEMarcadoresMoral' | null {
  if (key.startsWith(`${CANONICAL_OFFICIAL_RESULT_STORAGE_PREFIX}:`)) {
    return 'resultadoOficial'
  }
  if (key.startsWith(`${CANONICAL_CAREER_RACE_RESULT_PREFIX}_`)) {
    return 'raceResult'
  }
  if (key.startsWith(`${CANONICAL_CAREER_APPLY_JOURNAL_PREFIX}_`)) {
    return 'careerApplyResult'
  }
  if (
    key.startsWith('driver_morale_applied_') ||
    key.startsWith('driver_morale_receipt_') ||
    key.startsWith('driver_morale_')
  ) {
    return 'recibosEMarcadoresMoral'
  }
  return null
}

export interface CollectDiagnosticOptions {
  storage?: Storage
  appContext?: DiagnosticAppContext
  careerId?: string
}

/**
 * Coleta estritamente as chaves e valores do localStorage que casam com
 * os prefixos permitidos da carreira informada (ou alvo padrão).
 * Preserva os valores em texto bruto sem nenhuma alteração, normalização ou recálculo.
 *
 * Gera inventário completo de nomes de chaves (sem valores) e bloco de identificadores
 * lidos sem reinicialização ou mutação.
 */
export function collectRaceDiagnosticData(
  careerIdOrTarget: string = TARGET_CAREER_ID,
  options?: CollectDiagnosticOptions,
): RaceDiagnosticData {
  const targetCareerId = (options?.careerId || careerIdOrTarget || TARGET_CAREER_ID).trim()
  const storage =
    options?.storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)

  let origin = 'unknown'
  let pathname = 'unknown'
  let dentroDeIframe = false

  if (typeof window !== 'undefined') {
    try {
      origin = window.location.origin || 'unknown'
      pathname = window.location.pathname || 'unknown'
      dentroDeIframe = window.self !== window.top
    } catch {
      dentroDeIframe = true
    }
  }

  const prefixes = buildAllowedStoragePrefixes(targetCareerId)
  const records: Record<string, string> = {}

  let statusDaLeitura: 'ok' | 'erro' = 'ok'
  let readError: string | undefined = undefined
  let totalDeChavesNoLocalStorage = 0

  const groupKeysMap: Record<
    'resultadoOficial' | 'raceResult' | 'careerApplyResult' | 'recibosEMarcadoresMoral',
    string[]
  > = {
    resultadoOficial: [],
    raceResult: [],
    careerApplyResult: [],
    recibosEMarcadoresMoral: [],
  }

  if (storage) {
    try {
      totalDeChavesNoLocalStorage = storage.length

      const allKeys: string[] = []
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i)
        if (k) {
          allKeys.push(k)
        }
      }

      // Ordenação para inventário determinístico
      allKeys.sort()

      for (const key of allKeys) {
        // EXCLUSÃO TOTAL E OBRIGATÓRIA: tokens, credenciais, senhas e chaves sensíveis
        if (isAuthOrSensitiveKey(key)) {
          continue
        }

        const group = matchGroupName(key)
        if (group) {
          groupKeysMap[group].push(key)
        }

        // Se casar com os prefixos permitidos da carreira ativa, coletar valor bruto
        const matchesFilter = prefixes.some((prefix) => key.startsWith(prefix))
        if (matchesFilter) {
          try {
            const val = storage.getItem(key)
            if (val !== null) {
              records[key] = val
            }
          } catch (itemErr: any) {
            console.warn(`[RaceDiagnostic] Falha ao ler chave ${key}:`, itemErr)
          }
        }
      }
    } catch (err: any) {
      statusDaLeitura = 'erro'
      readError = err?.message || String(err)
      console.error('[RaceDiagnostic] Falha crítica de leitura no localStorage:', err)
    }
  } else {
    statusDaLeitura = 'erro'
    readError = 'Storage indisponível (ambiente sem window.localStorage)'
  }

  const recordCount = Object.keys(records).length

  // Montagem do inventário de grupos
  const buildGroupInv = (
    groupKey: 'resultadoOficial' | 'raceResult' | 'careerApplyResult' | 'recibosEMarcadoresMoral',
    groupName: string,
  ): DiagnosticGroupInventory => {
    const keys = groupKeysMap[groupKey]
    const matchingFilterCount = keys.filter((k) => prefixes.some((p) => k.startsWith(p))).length
    return {
      groupName,
      totalKeysFound: keys.length,
      matchingFilterCount,
      keys,
    }
  }

  const groupResOficial = buildGroupInv('resultadoOficial', 'f1_2026_canonical_official_result')
  const groupRaceRes = buildGroupInv('raceResult', 'race_result')
  const groupApplyRes = buildGroupInv('careerApplyResult', 'career_apply_result')
  const groupMorale = buildGroupInv('recibosEMarcadoresMoral', 'driver_morale_applied_e_receipts')

  const allRelevantKeys = [
    ...groupResOficial.keys,
    ...groupRaceRes.keys,
    ...groupApplyRes.keys,
    ...groupMorale.keys,
  ]

  const inventario: DiagnosticInventory = {
    origin,
    pathname,
    dentroDeIframe,
    statusDaLeitura,
    readStatus: statusDaLeitura === 'ok' ? 'success' : 'error',
    readError,
    mensagemDeErro: readError,
    totalDeChavesNoLocalStorage,
    totalStorageKeys: totalDeChavesNoLocalStorage,
    grupos: {
      resultadoOficial: groupResOficial,
      raceResult: groupRaceRes,
      careerApplyResult: groupApplyRes,
      recibosEMarcadoresMoral: groupMorale,
    },
    groups: {
      officialResult: groupResOficial,
      raceResult: groupRaceRes,
      careerApplyResult: groupApplyRes,
      driverMorale: groupMorale,
    },
    todasAsChavesDiagnosticas: allRelevantKeys,
    allDiagnosticRelevantKeys: allRelevantKeys,
  }

  const rawCtx = options?.appContext || {}
  const identificadores: DiagnosticIdentificadores = {
    careerId: {
      valor: String(rawCtx.careerId ?? targetCareerId ?? 'indefinido'),
      origem: rawCtx.careerIdOrigin ?? 'resolveCanonicalCareerId(season, team) | TARGET_CAREER_ID',
    },
    pocketBaseSeasonId: {
      valor: String(rawCtx.pocketBaseSeasonId ?? 'indefinido'),
      origem: rawCtx.pocketBaseSeasonIdOrigin ?? 'useAuth().season?.id',
    },
    internalNumericSeasonId: {
      valor: String(rawCtx.internalNumericSeasonId ?? 'indefinido'),
      origem: rawCtx.internalNumericSeasonIdOrigin ?? 'season.season_number / seasonId numérico',
    },
    displayedYear: {
      valor: rawCtx.displayedYear ?? 2026,
      origem: rawCtx.displayedYearOrigin ?? 'useAuth().season?.year || 2026',
    },
    currentRound: {
      valor: rawCtx.currentRound ?? 1,
      origem: rawCtx.currentRoundOrigin ?? 'useUnifiedSeason().currentRound',
    },
    sessionType: {
      valor: String(rawCtx.sessionType ?? 'race'),
      origem: rawCtx.sessionTypeOrigin ?? 'WeekendV2Page.selectedSessionId',
    },
  }

  return {
    exportedAt: new Date().toISOString(),
    origin,
    pathname,
    dentroDeIframe,
    statusDaLeitura,
    careerId: targetCareerId,
    allowedPrefixes: prefixes,
    recordCount,
    records,
    inventario,
    inventory: inventario,
    identificadores,
    appContext: {
      ...rawCtx,
      careerId: targetCareerId,
    },
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
