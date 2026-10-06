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

// AuthContext mock: retorna team e season undefined por padrão para isolar o poller
let mockAuthUser: { id: string; email?: string } | null = { id: 'usr_poller_test' }
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

describe('ERRO-NOTIFICACOES-POLLING-01A — Suíte de Reprodução Focada do Poller de Notificações', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    realtimeListeners.clear()
    mockAuthUser = { id: 'usr_poller_test' }
    mockAuthTeam = undefined
    mockAuthSeason = undefined
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  /**
   * P1 — MONTAGEM ÚNICA (ATUALIZADO PARA INTERVALO DE SEGURANÇA 60s):
   * Montar o componente real NotificationBell, avançar fake timers por 60 segundos.
   * Provar: 1 chamada imediata no mount + 1 tick aos 60s
   * = exatamente 2 chamadas ao notificationService.getNotifications em 60s (1 request/minuto além do mount).
   */
  it('P1 — MONTAGEM ÚNICA: dispara 1 chamada no mount + 1 tick aos 60s (total 2 chamadas, 1 req/min)', async () => {
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockResolvedValue([])

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    // Ao montar, dispara imediatamente a primeira chamada no useEffect([effectiveUserId])
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)
    expect(getNotificationsSpy).toHaveBeenLastCalledWith('usr_poller_test', 30)

    // Avança 59s -> nenhuma nova chamada
    await act(async () => {
      vi.advanceTimersByTime(59000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança mais 1s (total 60s) -> tick 1
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Avança mais 60s (total 120s) -> tick 2
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(3)
  })

  /**
   * P2 — RERENDER SEM DESMONTAR:
   * Rerenderizar o componente mantendo o mesmo effectiveUserId.
   * Provar que NÃO nasce um segundo timer: o ritmo se mantém estritamente em 1 a cada 60s (não dobra).
   */
  it('P2 — RERENDER SEM DESMONTAR: mantém ritmo de 1 chamada a cada 60s sem duplicar timers', async () => {
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockResolvedValue([])

    const { rerender } = render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Rerenderiza 3 vezes consecutivas mantendo o mesmo userId
    rerender(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )
    rerender(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )
    rerender(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    // Rerender sem mudar effectiveUserId não deve disparar nova chamada imediata
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança 60s: deve ter exatamente 1 chamada nova (total 2), não 4 chamadas
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Avança mais 60s: deve ter exatamente 1 chamada nova (total 3)
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(3)
  })

  /**
   * P3 — UNMOUNT / REMOUNT:
   * Desmontar o componente; avançar o relógio além de 60s (ex.: 120s) e provar que o poller antigo
   * PAROU completamente (nenhuma chamada nova).
   * Em seguida, remontar e provar que nasce exatamente 1 novo poller (chamada imediata + 1 a cada 60s).
   */
  it('P3 — UNMOUNT/REMOUNT: cleanup cancela o timer antigo e remontagem inicia exatamente 1 novo poller', async () => {
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockResolvedValue([])

    const { unmount } = render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Desmontar o componente
    unmount()

    // Avança 120 segundos com componente desmontado
    await act(async () => {
      vi.advanceTimersByTime(120000)
    })

    // Nenhuma nova chamada deve ocorrer após o unmount
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Remontar novo componente
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    // Imediatamente dispara a chamada do novo mount (total 3)
    expect(getNotificationsSpy).toHaveBeenCalledTimes(3)

    // Avança 60s: novo poller dispara tick 1 (total 4)
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(4)

    // Avança mais 60s: novo poller dispara tick 2 (total 5)
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(5)
  })

  /**
   * P4 — REGRESSÃO 01A / IN-FLIGHT GUARD:
   * Em 01A, P4 provava a ausência do guard (overlap).
   * Em 01B1/B2 (com o guard ativo), ticks concorrentes enquanto pendente são bloqueados.
   * Quando a promise é resolvida, os próximos ticks ocorrem normalmente.
   */
  it('P4 — REGRESSÃO 01A (com in-flight guard ativo): bloqueia ticks concorrentes enquanto pendente e retoma após resolução', async () => {
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
          // Primeira chamada fica pendente
          return pendingPromise
        }
        // Segunda chamada e subsequentes
        return Promise.resolve([])
      })

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    // Primeira chamada disparada no mount e fica PENDENTE
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança 60 segundos até o próximo tick do timer -> guard bloqueia tick concorrente
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança mais 60 segundos -> continua bloqueado
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Resolve a primeira promise pendente
    await act(async () => {
      if (pendingResolver) {
        pendingResolver([])
      }
    })

    // Próximo tick retoma normalmente
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)
  })

  /**
   * P5 — DUPLICIDADE REALTIME / POLLING:
   * Com o useRealtime mockado e sem chamada pendente, disparar o callback registrado
   * para as coleções 'notifications' e 'events' chama loadNotifications() normalmente
   * coexistindo com o polling.
   */
  it('P5 — DUPLICIDADE REALTIME/POLLING: callback do useRealtime dispara getNotifications extra em paralelo ao polling', async () => {
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockResolvedValue([])

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    // 1 chamada no mount pelo poller
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Simula evento emitido pelo realtime da collection 'notifications'
    const notificationListeners = realtimeListeners.get('notifications')
    expect(notificationListeners).toBeDefined()
    expect(notificationListeners?.size).toBeGreaterThan(0)

    await act(async () => {
      notificationListeners?.forEach((cb) => {
        cb({ action: 'create', record: { id: 'notif_realtime_1' } })
      })
    })

    // O callback do realtime invocou loadNotifications(), gerando 2ª chamada
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Simula evento emitido pelo realtime da collection 'events'
    const eventListeners = realtimeListeners.get('events')
    expect(eventListeners).toBeDefined()
    expect(eventListeners?.size).toBeGreaterThan(0)

    await act(async () => {
      eventListeners?.forEach((cb) => {
        cb({ action: 'create', record: { id: 'evt_1' } })
      })
    })

    // O callback do realtime de 'events' gerou 3ª chamada
    expect(getNotificationsSpy).toHaveBeenCalledTimes(3)

    // Polling de segurança continua correndo em paralelo: ao avançar 60s, tick do polling dispara 4ª chamada
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(4)
  })
})
