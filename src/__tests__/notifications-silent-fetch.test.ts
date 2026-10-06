import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { notificationService } from '@/services/notificationService'
import { f1Service } from '@/services/f1Service'
import pb from '@/lib/pocketbase/client'

describe('Notificações - Tratamento Silencioso de Falhas Transitórias de Rede', () => {
  const originalCollection = pb.collection.bind(pb)

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    pb.collection = originalCollection
  })

  it('notificationService.getNotifications deve resolver sem lançar erro quando o fetch falha (ex: Failed to fetch / HTTP N/A)', async () => {
    const mockGetList = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    pb.collection = vi.fn().mockReturnValue({
      getList: mockGetList,
    }) as unknown as typeof pb.collection

    // Deve resolver normalmente retornando array vazio ou itens locais, NUNCA lançando exceção
    await expect(notificationService.getNotifications('user_test_123', 30)).resolves.toEqual([])
    expect(mockGetList).toHaveBeenCalledWith(1, 30, {
      filter: 'user_id = "user_test_123"',
      sort: '-created',
      requestKey: null,
    })
  })

  it('notificationService.getNotifications deve retornar fallback local quando há cache no localStorage e fetch falha', async () => {
    const cachedItem = {
      id: 'local_cached_1',
      user_id: 'user_test_456',
      type: 'news' as const,
      title: 'Aviso Importante',
      message: 'Mensagem de teste',
      read: false,
    }
    localStorage.setItem('f1_notifications_read_user_test_456', JSON.stringify([cachedItem]))

    const mockGetList = vi.fn().mockRejectedValue(new Error('NetworkError: Failed to fetch'))
    pb.collection = vi.fn().mockReturnValue({
      getList: mockGetList,
    }) as unknown as typeof pb.collection

    const result = await notificationService.getNotifications('user_test_456', 30)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('local_cached_1')
  })

  it('f1Service.getNotifications deve resolver com array vazio sem lançar erro quando o fetch falha', async () => {
    const mockGetList = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    pb.collection = vi.fn().mockReturnValue({
      getList: mockGetList,
    }) as unknown as typeof pb.collection

    await expect(f1Service.getNotifications('user_test_789', 30)).resolves.toEqual([])
  })
})
