export function formatCurrency(value: number): string {
  // Canônico F1: US$ X,XX M
  const millions = value / 1000000
  const sign = millions < 0 ? '-' : ''
  return `${sign}US$ ${Math.abs(millions).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`
}

/**
 * Formata valores expressos em milhões ou brutos no formato visual F1 canônico: "US$ 164,01 M"
 */
export function formatMoneyM(
  valInMillionsOrRaw: number | undefined | null,
  isRaw = false,
  decimals = 2,
): string {
  if (
    valInMillionsOrRaw === undefined ||
    valInMillionsOrRaw === null ||
    isNaN(valInMillionsOrRaw)
  ) {
    return 'US$ 0,00 M'
  }
  const millions = isRaw ? valInMillionsOrRaw / 1_000_000 : valInMillionsOrRaw
  const sign = millions < 0 ? '-' : ''
  const formatted = Math.abs(millions).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${sign}US$ ${formatted} M`
}

/**
 * Formata um número qualquer em pt-BR com no máximo `maxDecimals` casas decimais (padrão: 2).
 * Por padrão usa no máximo 2 casas decimais para padronizar floats crus na interface.
 */
export function formatNumber(
  value: number | undefined | null,
  minDecimals = 2,
  maxDecimals = 2,
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return (0).toLocaleString('pt-BR', {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    })
  }
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  })
}

/**
 * Formata percentuais com no máximo 2 casas decimais no padrão pt-BR.
 * Ex.: 85 -> "85%"; 61.25 -> "61,25%"; 61.256 -> "61,26%".
 */
export function formatPercent(
  value: number | undefined | null,
  options?: {
    allowIntegerNoDecimals?: boolean
    maxDecimals?: number
  },
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0%'
  }
  const maxDecimals = options?.maxDecimals ?? 2
  const allowInteger = options?.allowIntegerNoDecimals ?? true
  const isInteger = Number.isInteger(value)

  if (allowInteger && isInteger) {
    return `${value}%`
  }

  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: allowInteger && isInteger ? 0 : 2,
    maximumFractionDigits: maxDecimals,
  })
  return `${formatted}%`
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
