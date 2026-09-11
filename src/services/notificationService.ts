import pb from '@/lib/pocketbase/client'
import { F1NotificationModel, F1NotificationType } from '@/types/f1'

export interface CreateNotificationInput {
  type: F1NotificationType
  title: string
  message: string
  round?: number
  link?: string
  read?: boolean
}

const STORAGE_KEY_PREFIX = 'f1_notifications_read_'

export const notificationService = {
  /**
   * Retorna as últimas 30 notificações do usuário logado (mais recentes primeiro).
   * Possui fallback offline/local se a collection no PB ainda estiver indisponível ou em caso de erro de rede.
   */
  async getNotifications(userId: string, limit = 30): Promise<F1NotificationModel[]> {
    if (!userId) return []
    try {
      const records = await pb.collection('notifications').getList<F1NotificationModel>(1, limit, {
        filter: `user_id = "${userId}"`,
        sort: '-created',
      })
      return records.items
    } catch (err) {
      console.warn('Erro ao buscar notificações do PocketBase, usando cache local:', err)
      return this.getLocalNotifications(userId).slice(0, limit)
    }
  },

  /**
   * Cria uma nova notificação evitando duplicatas idênticas na mesma rodada/contexto
   */
  async createNotification(
    userId: string,
    data: CreateNotificationInput,
  ): Promise<F1NotificationModel | null> {
    if (!userId) return null

    try {
      // Checar se já existe notificação recente idêntica para evitar spam/duplicação
      const filter = `user_id = "${userId}" && title = "${data.title.replace(/"/g, '\\"')}" && round = ${data.round || 0}`
      const existing = await pb.collection('notifications').getList(1, 1, { filter })
      if (existing.items.length > 0) {
        return existing.items[0] as unknown as F1NotificationModel
      }

      const record = await pb.collection('notifications').create<F1NotificationModel>({
        user_id: userId,
        type: data.type,
        title: data.title,
        message: data.message,
        round: data.round || 1,
        read: data.read ?? false,
        link: data.link || '',
      })
      this.syncToLocal(userId, record)
      return record
    } catch (err) {
      console.warn('Erro ao salvar notificação no banco, gravando localmente:', err)
      const fallback: F1NotificationModel = {
        id: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        user_id: userId,
        type: data.type,
        title: data.title,
        message: data.message,
        round: data.round || 1,
        read: data.read ?? false,
        link: data.link || '',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
      this.syncToLocal(userId, fallback)
      return fallback
    }
  },

  /**
   * Marca uma notificação individual como lida
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    // Atualiza local primeiro para resposta instantânea na UI
    const local = this.getLocalNotifications(userId)
    const updated = local.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    this.saveLocalNotifications(userId, updated)

    if (!notificationId.startsWith('local_')) {
      try {
        await pb.collection('notifications').update(notificationId, { read: true })
      } catch (e) {
        console.warn('Erro ao marcar notificação como lida no PocketBase:', e)
      }
    }
  },

  /**
   * Marca todas as notificações do usuário como lidas
   */
  async markAllAsRead(userId: string): Promise<void> {
    if (!userId) return

    // 1. Atualizar local imediatamente
    const local = this.getLocalNotifications(userId)
    const updated = local.map((n) => ({ ...n, read: true }))
    this.saveLocalNotifications(userId, updated)

    // 2. Persistir no PocketBase para todas não lidas
    try {
      const unreadList = await pb.collection('notifications').getFullList<F1NotificationModel>({
        filter: `user_id = "${userId}" && read = false`,
      })
      await Promise.all(
        unreadList.map((item) =>
          pb
            .collection('notifications')
            .update(item.id, { read: true })
            .catch(() => null),
        ),
      )
    } catch (err) {
      console.warn('Erro ao atualizar todas notificações para lidas no banco:', err)
    }
  },

  /**
   * Deleta notificação no PocketBase e localmente
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const local = this.getLocalNotifications(userId)
    const updated = local.filter((n) => n.id !== notificationId)
    this.saveLocalNotifications(userId, updated)

    if (!notificationId.startsWith('local_')) {
      try {
        await pb.collection('notifications').delete(notificationId)
      } catch (e) {
        console.warn('Erro ao deletar notificação no PocketBase:', e)
      }
    }
  },

  // Fallback e sincronização local
  getLocalNotifications(userId: string): F1NotificationModel[] {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  },

  saveLocalNotifications(userId: string, items: F1NotificationModel[]): void {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(items.slice(0, 50)))
    } catch (e) {
      console.warn('Erro ao salvar notificações locais:', e)
    }
  },

  syncToLocal(userId: string, item: F1NotificationModel): void {
    const list = this.getLocalNotifications(userId)
    const filtered = list.filter((n) => n.id !== item.id)
    const merged = [item, ...filtered].slice(0, 50)
    this.saveLocalNotifications(userId, merged)
  },
}
