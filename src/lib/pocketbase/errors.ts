import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }
  return errors
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}

export function formatTeamCreationError(error: unknown, hasExistingTeam = false): string {
  if (hasExistingTeam) {
    return 'Não foi possível criar a equipe — você já possui uma equipe nesta carreira.'
  }
  if (error instanceof ClientResponseError) {
    const fieldErrors = extractFieldErrors(error)
    const fieldMsg = Object.values(fieldErrors).filter(Boolean).join(' ')
    if (fieldMsg) {
      return `Falha ao registrar equipe: ${fieldMsg}`
    }
    if (error.status === 400) {
      return 'Falha ao registrar equipe: você já possui uma equipe nesta carreira ou houve conflito de dados.'
    }
    return `Falha ao registrar equipe: ${error.message || 'Erro desconhecido'}`
  }
  if (error instanceof Error) {
    return `Falha ao registrar equipe: ${error.message}`
  }
  return 'Falha ao registrar equipe: você já possui uma equipe nesta carreira ou houve conflito de dados.'
}
