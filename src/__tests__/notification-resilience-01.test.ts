import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { notificationService } from '@/services/notificationService'
import { f1Service } from '@/services/f1Service'

describe('Notification Polling & Fetch Resiliency (Transient Network Failures)', () => {
  const originalGetList = pb.collection('notifications').getList

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    pb.collection('notifications').getList = originalGetList
  })

  it('notificationService.getNotifications captura silenciosamente rejeição de rede transitória (TypeError: Failed to fetch) sem lançar erro', async () => {
    // Simula falha transitória de rede como 'Failed to fetch' ou 'HTTP N/A'
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mockGetList = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.spyOn(pb, 'collection').mockReturnValue({
      getList: mockGetList,
    } as any)

    let errorThrown: any = null
    let result: any = null

    try {
      result = await notificationService.getNotifications('test_user_id', 30)
    } catch (err) {
      errorThrown = err
    }

    // Não deve lançar erro
    expect(errorThrown).toBeNull()
    // Deve retornar array (fallback resiliente)
    expect(Array.isArray(result)).toBe(true)
    // Não deve poluir console.error com banner ou log de erro
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('f1Service.getNotifications captura silenciosamente rejeição de rede transitória sem propagar erro nem chamar console.error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(pb, 'collection').mockReturnValue({
      getList: vi.fn().mockRejectedValue(new Error('Network error HTTP N/A')),
    } as any)

    let errorThrown: any = null
    let result: any = null

    try {
      result = await f1Service.getNotifications('test_user_id', 30)
    } catch (err) {
      errorThrown = err
    }

    expect(errorThrown).toBeNull()
    expect(Array.isArray(result)).toBe(true)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('garante que mesmo se o fetch falhar repetidamente em múltiplos ciclos de polling, nenhum erro é propagado', async () => {
    vi.spyOn(pb, 'collection').mockReturnValue({
      getList: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    } as any)

    // Simula 3 ciclos sucessivos de polling
    for (let i = 0; i < 3; i++) {
      await expect(notificationService.getNotifications('user_abc', 30)).resolves.toEqual([])
    }
  })
})
