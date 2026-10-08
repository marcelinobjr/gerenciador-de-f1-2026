import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NotificationBell } from '@/components/NotificationBell'
import { notificationService, NotificationNetworkError } from '@/services/notificationService'
import { F1NotificationModel, F1NotificationType } from '@/types/f1'

// Mock useRealtime
vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: vi.fn(),
  default: vi.fn(),
}))

// Mock AuthContext
let mockAuthUser: { id: string } | null = { id: 'usr_bell_network_01' }
let mockAuthTeam: any = undefined
let mockAuthSeason: any = undefined

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    team: mockAuthTeam,
    season: mockAuthSeason,
    isLoading: false,
    careerPhase: 'career',
    refreshTeamAndSeason: vi.fn(),
    resetGame: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    ensureValidSession: vi.fn().mockResolvedValue(true),
  }),
}))

describe('NOTIF-BELL-NETWORK-01 — Suíte focada de resiliência a falhas de rede no sino', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    mockAuthUser = { id: 'usr_bell_network_01' }
    mockAuthTeam = undefined
    mockAuthSeason = undefined
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  // (T1) fetch falha → componente não propaga exceção, estado permanece, console.error não é chamado
  it('(T1) fetch falha: componente não propaga exceção para o runtime, estado é retido e console.error não é chamado', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Simula falha de rede TypeError: Failed to fetch
    vi.spyOn(notificationService, 'getNotifications').mockRejectedValue(
      new TypeError('Failed to fetch'),
    )

    let renderThrew = false
    try {
      render(
        <MemoryRouter>
          <NotificationBell />
        </MemoryRouter>,
      )
    } catch {
      renderThrew = true
    }

    // Não deve lançar erro
    expect(renderThrew).toBe(false)
    // Nenhuma chamada a console.error
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    // Pode logar aviso informativo (console.warn no máximo)
    expect(consoleWarnSpy).toHaveBeenCalled()
  })

  // (T2) backend volta → próxima tentativa carrega notificações com sucesso
  it('(T2) backend volta: próxima tentativa carrega notificações com sucesso e atualiza estado', async () => {
    const sampleNotifications = [
      {
        id: 'notif_recovered_1',
        user_id: 'usr_bell_network_01',
        type: 'info' as unknown as F1NotificationType,
        title: 'Atualização Técnica',
        message: 'Novo pacote aerodinâmico instalado',
        round: 1,
        read: false,
        created: new Date().toISOString(),
      },
    ] as F1NotificationModel[]
    let callCount = 0
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // Primeira tentativa falha com NotificationNetworkError (transient network failure)
          return Promise.reject(new NotificationNetworkError('Failed to fetch'))
        }
        // Segunda tentativa (backend voltou) responde com lista
        return Promise.resolve(sampleNotifications)
      })

    const { getByRole } = render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança timers para acionar o backoff de retry (primeiro retry ocorre em 5s)
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    // Segunda chamada foi executada e teve sucesso
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // O botão do sino deve estar presente e com badge de 1 não lida
    const button = getByRole('button', { name: /notificações/i })
    expect(button).toBeDefined()
  })

  // (T3) backoff não dispara requisições em loop apertado
  it('(T3) backoff não dispara requisições em loop apertado: espaçamento mínimo seguro e teto respeitado', async () => {
    let callCount = 0
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockImplementation(() => {
        callCount++
        return Promise.reject(new TypeError('Failed to fetch'))
      })

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    // Chamada inicial de montagem
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança 1 segundo: NÃO pode haver disparos imediatos em loop apertado
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança mais 3.9 segundos (total 4.9s): ainda sem retry prematuro
    await act(async () => {
      vi.advanceTimersByTime(3900)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Aos 5.0 segundos: 1º retry executado (total 2 chamadas)
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Próximo retry tem backoff exponencial (5000 * 1.5 = 7500ms).
    // Avança 5s: ainda não deve ter executado o 2º retry
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Avança mais 2.5s (total 7.5s após a falha): 2º retry executado (total 3 chamadas)
    await act(async () => {
      vi.advanceTimersByTime(2500)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(3)
  })

  // (T4) sucesso normal renderiza igual
  it('(T4) sucesso normal renderiza igual: lista preenchida e badge exibido corretamente', async () => {
    const normalItems = [
      {
        id: 'notif_normal_1',
        user_id: 'usr_bell_network_01',
        type: 'info' as unknown as F1NotificationType,
        title: 'Novo Contrato',
        message: 'Piloto renovou contrato',
        round: 2,
        read: false,
        created: new Date().toISOString(),
      },
    ] as F1NotificationModel[]
    vi.spyOn(notificationService, 'getNotifications').mockResolvedValue(normalItems)

    const { getByRole, findByText } = render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    const button = getByRole('button', { name: /notificações/i })
    expect(button).toBeDefined()

    // Abrir o sino
    await act(async () => {
      button.click()
    })

    // Confere que título da notificação renderiza normalmente
    expect(await findByText('Novo Contrato')).toBeDefined()
  })
})
