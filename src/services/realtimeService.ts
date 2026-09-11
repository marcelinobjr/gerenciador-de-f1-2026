import type { RecordModel, RecordSubscription } from 'pocketbase'
import pb from '@/lib/pocketbase/client'

type SubscriptionListener<T extends RecordModel = RecordModel> = (
  data: RecordSubscription<T>,
) => void

interface ActiveSubscription {
  collection: string
  topic: string
  listener: SubscriptionListener<any>
}

class RealtimeService {
  private subscriptions: ActiveSubscription[] = []
  private isReconnecting = false
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
  private connectionInitialized = false
  private retryCount = 0
  private maxRetries = 5

  constructor() {
    this.setupAuthSync()
    this.setupVisibilitySync()
  }

  /**
   * Monitora mudanças no authStore do PocketBase para garantir
   * renovação limpa das conexões sem manter clientIds expirados.
   */
  private setupAuthSync() {
    if (typeof window === 'undefined') return

    pb.authStore.onChange(async (_token, _record) => {
      // Quando o estado de autenticação muda (login, logout, refresh),
      // as permissões de SSE mudam e o clientId pode expirar no backend.
      // Resetamos e reinscrevemos de forma segura.
      this.resubscribeAllSilently()
    })
  }

  /**
   * Monitora reabertura/visibilidade de abas para recuperar conexões
   * SSE adormecidas ou finalizadas pelo navegador.
   */
  private setupVisibilitySync() {
    if (typeof document === 'undefined') return

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Se a aba ficou em segundo plano, o SSE pode ter caído silenciosamente
        // ou o servidor ter descartado o clientId.
        if (this.subscriptions.length > 0) {
          this.ensureConnected()
        }
      }
    })
  }

  /**
   * Inscreve um listener em uma collection PocketBase com recuperação transparente
   * contra 'Invalid realtime client' (HTTP 400/404).
   */
  public subscribe<TRecord extends RecordModel = RecordModel>(
    collection: string,
    listener: SubscriptionListener<TRecord>,
    topic: string = '*',
  ): () => void {
    const subItem: ActiveSubscription = {
      collection,
      topic,
      listener,
    }

    this.subscriptions.push(subItem)
    this.execSubscribe(subItem)

    return () => {
      this.unsubscribe(subItem)
    }
  }

  private async execSubscribe(item: ActiveSubscription): Promise<void> {
    try {
      await pb.collection(item.collection).subscribe(item.topic, item.listener)
      this.connectionInitialized = true
      this.retryCount = 0
    } catch (err: any) {
      this.handleSubscriptionError(err)
    }
  }

  private async unsubscribe(item: ActiveSubscription): Promise<void> {
    const index = this.subscriptions.indexOf(item)
    if (index !== -1) {
      this.subscriptions.splice(index, 1)
    }

    try {
      await pb.collection(item.collection).unsubscribe(item.topic)
    } catch {
      // Silenciosamente ignorar erro ao desinscrever
    }
  }

  /**
   * Trata falhas de realtime (notadamente HTTP 400 "Invalid realtime client"
   * ou 404 "Missing or invalid client id") de forma resiliente e não intrusiva.
   */
  public handleSubscriptionError(err: any): void {
    const errMsg = err?.message || ''
    const status = err?.status || err?.response?.status

    const isInvalidClient =
      status === 400 ||
      status === 404 ||
      errMsg.includes('Invalid realtime client') ||
      errMsg.includes('Missing or invalid client id')

    if (isInvalidClient) {
      // Conexão SSE / clientId obsoleto ou descartado pelo servidor.
      // Recriar canal e reinscrever todas as subscrições com o novo clientId.
      this.resubscribeAllSilently()
      return
    }

    // Erros abortados propositalmente são normais durante transições de página
    if (err?.isAbort) {
      return
    }

    // Demais erros de rede: registrar em nível debug para não poluir console
    // e não quebrar a aplicação (realtime é progressive enhancement).
    if (import.meta.env.DEV) {
      console.debug('[RealtimeService] Falha temporária no SSE/realtime:', errMsg || err)
    }
  }

  /**
   * Reseta o realtime do PocketBase e reinscreve todas as coleções ativas
   * garantindo que nenhuma subscrição fique pendente com clientId obsoleto.
   */
  public async resubscribeAllSilently(): Promise<void> {
    if (this.isReconnecting) return
    this.isReconnecting = true

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }

    try {
      // Força o PocketBase a fechar o EventSource atual e zerar clientIds obsoletos
      if (pb.realtime) {
        try {
          await pb.realtime.unsubscribe()
        } catch {
          // Ignore
        }
      }

      // Se temos subscrições ativas para manter, re-inscreve cada uma
      const currentSubs = [...this.subscriptions]
      if (currentSubs.length > 0) {
        // Delay incremental curto com backoff exponencial
        const backoff = Math.min(200 * Math.pow(1.5, this.retryCount), 3000)
        await new Promise((res) => setTimeout(res, backoff))

        for (const sub of currentSubs) {
          try {
            await pb.collection(sub.collection).subscribe(sub.topic, sub.listener)
          } catch (e: any) {
            // Se ainda falhar, agendar nova tentativa caso dentro do limite
            if (this.retryCount < this.maxRetries) {
              this.retryCount++
              this.scheduleReconnect()
              break
            }
          }
        }
      }
    } catch {
      // Nunca deixe escapar exceções que possam quebrar a UI
    } finally {
      this.isReconnecting = false
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeoutId) return
    const delay = Math.min(500 * Math.pow(1.5, this.retryCount), 4000)
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null
      this.resubscribeAllSilently()
    }, delay)
  }

  private ensureConnected() {
    if (!pb.realtime?.isConnected && this.subscriptions.length > 0) {
      this.resubscribeAllSilently()
    }
  }
}

export const realtimeService = new RealtimeService()
export default realtimeService
