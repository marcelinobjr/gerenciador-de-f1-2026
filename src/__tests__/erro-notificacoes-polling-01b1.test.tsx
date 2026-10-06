import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NotificationBell } from '@/components/NotificationBell'
import { notificationService } from '@/services/notificationService'

// Registro global de listeners mockados do useRealtime
const realtimeListeners = new Map<string, Set<(e: any) => void>>()

function useMockRealtime(collectionName: string, callback: (data: any) => void) {
  const cbRef = { current: callback }
  cbRef.current = callback

  React.useEffect(() => {
    let set = realtimeListeners.get(collectionName)
    if (!set) {
      set = new Set()
      realtimeListeners.set(collectionName, set)
    }
    const listener = (data: any) => cbRef.current(data)
    set.add(listener)
    return () => {
      const currentSet = realtimeListeners.get(collectionName)
      if (currentSet) {
        currentSet.delete(listener)
      }
    }
  }, [collectionName])
}

vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: useMockRealtime,
  default: useMockRealtime,
}))

// AuthContext mock isolado
let mockAuthUser: { id: string; email?: string } | null = { id: 'usr_poller_b1_test' }
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

describe('ERRO-NOTIFICACOES-POLLING-01B1 — Suíte de Bloqueio de Overlap de Requests de Notificações', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    realtimeListeners.clear()
    mockAuthUser = { id: 'usr_poller_b1_test' }
    mockAuthTeam = undefined
    mockAuthSeason = undefined
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  /**
   * B1.1 — REQUEST LENTA + VÁRIOS TICKS:
   * Manter a primeira request pendente por mais de 20s, avançar fake timers por vários ciclos.
   * Esperado: apenas 1 request ativa; ticks extras ignorados enquanto ela estiver pendente.
   */
  it('B1.1 — request lenta + vários ticks: ignora ticks extras enquanto a primeira estiver pendente', async () => {
    let pendingResolver: ((value: any) => void) | null = null
    const pendingPromise = new Promise<any>((resolve) => {
      pendingResolver = resolve
    })

    let callCount = 0
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return pendingPromise
        }
        return Promise.resolve([])
      })

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    // Primeira request iniciada no mount
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança 60s (tick 1 do interval de segurança)
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    // In-flight guard deve ter bloqueado a segunda chamada
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança mais 60s (total 120s, tick 2 do interval)
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    // Continua bloqueado em 1 chamada
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança mais 15s (total 135s)
    await act(async () => {
      vi.advanceTimersByTime(15000)
    })
    // Continua exatamente 1 chamada
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Resolve a pendência para desobstruir e limpar
    if (pendingResolver) {
      await act(async () => {
        pendingResolver!([])
      })
    }
  })

  /**
   * B1.2 — REALTIME DURANTE IN-FLIGHT:
   * Request do polling pendente; disparar realtime de notifications E events.
   * Esperado: nenhum carregamento concorrente adicional.
   */
  it('B1.2 — realtime durante in-flight: eventos realtime são bloqueados se request já estiver pendente', async () => {
    let pendingResolver: ((value: any) => void) | null = null
    const pendingPromise = new Promise<any>((resolve) => {
      pendingResolver = resolve
    })

    let callCount = 0
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return pendingPromise
        }
        return Promise.resolve([])
      })

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    // 1 chamada no mount (pendente)
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Dispara evento realtime em 'notifications'
    const notifListeners = realtimeListeners.get('notifications')
    expect(notifListeners).toBeDefined()
    await act(async () => {
      notifListeners?.forEach((cb) => cb({ action: 'create' }))
    })
    // Deve ser barrado pelo guard compartilhado
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Dispara evento realtime em 'events'
    const eventListeners = realtimeListeners.get('events')
    expect(eventListeners).toBeDefined()
    await act(async () => {
      eventListeners?.forEach((cb) => cb({ action: 'update' }))
    })
    // Também barrado pelo mesmo guard
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Resolve a pendência
    if (pendingResolver) {
      await act(async () => {
        pendingResolver!([])
      })
    }
  })

  /**
   * B1.3 — LIBERA APÓS SUCESSO:
   * Resolver a primeira request; no próximo tick/evento nova request deve ocorrer normalmente.
   */
  it('B1.3 — libera após sucesso: término com sucesso destrava o guard e chamadas subsequentes ocorrem normalmente', async () => {
    let pendingResolver: ((value: any) => void) | null = null
    let callCount = 0

    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return new Promise<any>((resolve) => {
            pendingResolver = resolve
          })
        }
        return Promise.resolve([])
      })

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Tick ocorre enquanto pendente -> bloqueado
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Sucesso da primeira request
    await act(async () => {
      pendingResolver!([])
    })

    // Próximo tick do polling (60s após) deve disparar normalmente
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Evento realtime agora também executa normalmente após o destravamento
    const notifListeners = realtimeListeners.get('notifications')
    await act(async () => {
      notifListeners?.forEach((cb) => cb({ action: 'create' }))
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(3)
  })

  /**
   * B1.4 — LIBERA APÓS ERRO:
   * Fazer a request rejeitar; guard liberado (via finally); próximo tick consulta novamente.
   */
  it('B1.4 — libera após erro: rejeição libera o guard (finally) e próximo tick executa normalmente', async () => {
    let pendingRejecter: ((reason: any) => void) | null = null
    let callCount = 0

    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return new Promise<any>((_, reject) => {
            pendingRejecter = reject
          })
        }
        return Promise.resolve([])
      })

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Rejeita a primeira chamada (ex: NetworkError / 500)
    await act(async () => {
      pendingRejecter!(new Error('Network failure'))
    })

    // Próximo tick do polling (60s) não deve ficar bloqueado
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Novo tick mais 60s executa normalmente (total 3)
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(3)
  })

  /**
   * B1.5 — CLEANUP PRESERVADO:
   * Desmontar durante request pendente; nenhum novo polling nasce depois do unmount;
   * comportamento homologado do cleanup intacto.
   */
  it('B1.5 — cleanup preservado: desmontagem durante request pendente limpa timers e não dispara novos pollings', async () => {
    let pendingResolver: ((value: any) => void) | null = null
    const pendingPromise = new Promise<any>((resolve) => {
      pendingResolver = resolve
    })

    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockReturnValue(pendingPromise)

    const { unmount } = render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Desmonta enquanto a chamada está em voo
    unmount()

    // Resolve a promessa que estava pendente no momento do unmount
    if (pendingResolver) {
      await act(async () => {
        pendingResolver!([])
      })
    }

    // Avança 120 segundos (2 ciclos de 60s)
    await act(async () => {
      vi.advanceTimersByTime(120000)
    })

    // Nenhuma nova chamada após desmontagem
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)
  })
})
