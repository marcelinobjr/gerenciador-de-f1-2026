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
 * Formata erro de criação de equipe com mensagem amigável e acionável para o usuário.
 * Identifica conflitos de equipe já existente por user_id e falhas de validação.
 */
export function formatTeamCreationError(error: unknown, hasExistingTeam = false): string {
  if (hasExistingTeam) {
    return 'Não foi possível criar a equipe — você já possui uma equipe nesta carreira.'
  }

  if (error instanceof ClientResponseError) {
    const fieldErrors = extractFieldErrors(error)
    const fieldKeys = Object.keys(fieldErrors)

    if (fieldKeys.length > 0) {
      return fieldKeys.map((k) => `${k}: ${fieldErrors[k]}`).join(' | ')
    }

    if (error.status === 400) {
      return 'Não foi possível criar a equipe — sua conta já possui uma equipe nesta carreira ou houve conflito de dados. Recarregue a página ou acesse a central de comando.'
    }

    if (error.status === 401 || error.status === 403) {
      return 'Sessão expirada ou sem permissão para criar equipe. Faça login novamente.'
    }

    return error.message || 'Erro ao inicializar equipe.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Erro inesperado ao inicializar equipe.'
}
