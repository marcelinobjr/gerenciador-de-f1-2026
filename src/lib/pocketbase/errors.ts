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

/**
 * Formata erros de criação de equipe de forma amigável e acionável.
 * Se o erro for 400 com payload vazio (falha de restrição única ou índice),
 * ou se o usuário já possui equipe, exibe mensagem clara.
 */
export function formatTeamCreationError(error: unknown, hasExistingTeam = false): string {
  if (hasExistingTeam) {
    return 'Não foi possível criar a equipe — você já possui uma equipe nesta carreira.'
  }

  if (error instanceof ClientResponseError) {
    const fieldErrors = extractFieldErrors(error)
    const msgs = Object.values(fieldErrors)
    if (msgs.length > 0) {
      return msgs.join(' ')
    }

    // Se status for 400 com data vazio ou mensagem genérica de PocketBase
    if (error.status === 400) {
      if (
        !error.message ||
        error.message === 'Failed to create record.' ||
        error.message.includes('unique')
      ) {
        return 'Não foi possível criar a equipe — você já possui uma equipe nesta carreira ou houve conflito de dados.'
      }
      return error.message
    }

    if (error.message && error.message !== 'Failed to create record.') {
      return error.message
    }
  }

  if (error instanceof Error && error.message && error.message !== 'Failed to create record.') {
    return error.message
  }

  return 'Não foi possível criar a equipe — você já possui uma equipe nesta carreira ou os dados são inválidos.'
}
