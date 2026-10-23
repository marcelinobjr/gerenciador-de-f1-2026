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
 * Formata mensagem de erro na criação de equipe (BUG-SETUP-TEAM-CREATE-400).
 * Se o usuário já possui equipe vinculada ou o erro indica duplicidade/400 de unicidade,
 * retorna instrução acionável e amigável.
 */
export function formatTeamCreationError(error: unknown, hasExistingTeam?: boolean): string {
  if (hasExistingTeam) {
    return 'Você já possui uma equipe cadastrada. Carregue sua carreira existente ou arquive-a para iniciar uma nova.'
  }

  if (error instanceof ClientResponseError) {
    if (error.status === 400) {
      const fieldErrors = extractFieldErrors(error)
      if (fieldErrors.user_id) {
        return 'Sua conta já está associada a uma carreira ativa nesta temporada.'
      }
      const general = getErrorMessage(error)
      return general || 'Dados inválidos ao tentar criar a equipe. Verifique as informações.'
    }
    if (error.status === 0 || error.isAbort) {
      return 'Conexão interrompida. Verifique sua internet e tente novamente.'
    }
  }

  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir o registro da escuderia. Tente novamente.'
}
