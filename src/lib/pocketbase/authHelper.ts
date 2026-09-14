import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'

/**
 * Erro específico disparado quando a sessão não puder ser renovada.
 */
export class SessionExpiredError extends Error {
  constructor(message = 'Sessão expirada, entre novamente') {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

/**
 * Verifica se um erro retornado pelo PocketBase indica token expirado, não autenticado ou 400 sem detalhes
 * (comum na regra de create/update da coleção teams/outras quando @request.auth fica vazio).
 */
export function isAuthOrPermissionError(error: unknown): boolean {
  if (error instanceof ClientResponseError) {
    if (error.status === 401 || error.status === 403) {
      return true
    }
    // 400 com data vazia ou sem campos específicos é o padrão quando a createRule falha por token inválido
    if (error.status === 400) {
      const data = error.response?.data
      const hasFieldDetails = data && typeof data === 'object' && Object.keys(data).length > 0
      if (!hasFieldDetails) {
        return true
      }
    }
  }
  return false
}

/**
 * Garante que a sessão atual do PocketBase seja fresca renovando o JWT via pb.collection('users').authRefresh().
 * Se o token estiver vencido ou a chamada falhar, limpa o authStore e dispara SessionExpiredError.
 */
export async function refreshAuthSession(): Promise<boolean> {
  if (!pb.authStore.isValid || !pb.authStore.record) {
    pb.authStore.clear()
    throw new SessionExpiredError()
  }

  try {
    await pb.collection('users').authRefresh()
    return true
  } catch (err) {
    console.warn('[authHelper] authRefresh falhou ao renovar JWT:', err)
    pb.authStore.clear()
    throw new SessionExpiredError()
  }
}

/**
 * Executa uma operação contra o PocketBase com garantia de resiliência:
 * Em caso de erro 400 (com data vazia) ou 401/403, tenta renovar o token via authRefresh()
 * e faz exatamente 1 retry da operação antes de propagar o erro.
 */
export async function withAuthRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (err) {
    if (isAuthOrPermissionError(err)) {
      console.warn(
        '[authHelper] Erro de autenticação detectado (400 data:{} ou 401/403). Tentando authRefresh e 1 retry...',
      )
      try {
        await refreshAuthSession()
        return await operation()
      } catch (retryErr) {
        if (retryErr instanceof SessionExpiredError) {
          throw retryErr
        }
        throw retryErr
      }
    }
    throw err
  }
}
