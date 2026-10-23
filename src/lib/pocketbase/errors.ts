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
    return 'Você já possui uma equipe vinculada à sua conta. Utilize a opção "Carregar Carreira" para continuar seu progresso.'
  }
  if (error instanceof ClientResponseError) {
    const fieldErrors = extractFieldErrors(error)
    if (Object.keys(fieldErrors).length > 0) {
      return Object.entries(fieldErrors)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join('; ')
    }
    if (error.status === 400) {
      return 'Não foi possível registrar a equipe. Se você já possui uma carreira, selecione "Carregar Carreira" ou tente novamente.'
    }
    return error.message || 'Erro inesperado ao registrar equipe.'
  }
  return error instanceof Error ? error.message : 'Erro inesperado ao criar escuderia.'
}
