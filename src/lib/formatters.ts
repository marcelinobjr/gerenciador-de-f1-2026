export function formatCurrency(value: number): string {
  // Ex: 150000000 -> "R$ 150,00 M"
  // Ex: 2500000 -> "R$ 2,50 M"
  const millions = value / 1000000
  return `R$ ${millions.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`
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
