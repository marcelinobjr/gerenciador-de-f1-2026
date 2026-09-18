export function formatCurrency(value: number): string {
  // Canônico F1: US$ X,XX M
  const millions = value / 1000000
  const sign = millions < 0 ? '-' : ''
  return `${sign}US$ ${Math.abs(millions).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`
}

/**
 * Formata valores expressos em milhões ou brutos no formato visual F1 canônico: "US$ 164,01 M"
 */
export function formatMoneyM(valInMillionsOrRaw: number, isRaw = false, decimals = 2): string {
  const millions = isRaw ? valInMillionsOrRaw / 1_000_000 : valInMillionsOrRaw
  const sign = millions < 0 ? '-' : ''
  const formatted = Math.abs(millions).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${sign}US$ ${formatted} M`
}

export function formatDateBR(dateString?: string): string {
  if (!dateString) return ''
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return dateString
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTimeBR(dateString?: string): string {
  if (!dateString) return ''
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return dateString
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
