/**
 * raceDiagnosticExport.ts
 *
 * Utilitário puramente de leitura para diagnóstico pontual da corrida / fim de semana.
 * Coleta exclusivamente chaves de localStorage associadas à carreira especificada
 * através de uma lista explícita de prefixos permitidos, sem tokens, credenciais ou outras carreiras.
 */

export const TARGET_CAREER_ID = '31b0p9k5ygw2sc8'

export const ALLOWED_STORAGE_PREFIXES = [
  `f1_2026_canonical_official_result:${TARGET_CAREER_ID}:`,
  `race_result_${TARGET_CAREER_ID}_`,
  `career_apply_result_${TARGET_CAREER_ID}_`,
  `driver_morale_applied_${TARGET_CAREER_ID}_`,
  `driver_morale_receipt_${TARGET_CAREER_ID}_`,
  `driver_morale_${TARGET_CAREER_ID}_`,
] as const

export interface RaceDiagnosticData {
  exportedAt: string
  origin: string
  careerId: string
  allowedPrefixes: string[]
  recordCount: number
  records: Record<string, string>
}

/**
 * Coleta estritamente as chaves e valores do localStorage que casam com
 * os prefixos permitidos da carreira.
 * Preserva os valores em texto bruto sem nenhuma alteração, normalização ou recálculo.
 */
export function collectRaceDiagnosticData(
  careerId: string = TARGET_CAREER_ID,
  storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined,
): RaceDiagnosticData {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown'
  const prefixes = [
    `f1_2026_canonical_official_result:${careerId}:`,
    `race_result_${careerId}_`,
    `career_apply_result_${careerId}_`,
    `driver_morale_applied_${careerId}_`,
    `driver_morale_receipt_${careerId}_`,
    `driver_morale_${careerId}_`,
  ]

  const records: Record<string, string> = {}

  if (storage) {
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key) {
        keys.push(key)
      }
    }

    // Ordenação alfabética para saída determinística
    keys.sort()

    for (const key of keys) {
      const matches = prefixes.some((prefix) => key.startsWith(prefix))
      if (matches) {
        const val = storage.getItem(key)
        if (val !== null) {
          records[key] = val
        }
      }
    }
  }

  const recordCount = Object.keys(records).length

  return {
    exportedAt: new Date().toISOString(),
    origin,
    careerId,
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
