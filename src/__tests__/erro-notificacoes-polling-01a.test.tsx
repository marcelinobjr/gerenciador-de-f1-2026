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
   * P1 — MONTAGEM ÚNICA:
   * Montar o componente real NotificationBell, avançar fake timers por 60 segundos.
   * Provar: 1 chamada imediata no mount + 6 ticks (a cada 10s: 10s, 20s, 30s, 40s, 50s, 60s)
   * = exatamente 7 chamadas ao notificationService.getNotifications em 60s (6 requests/minuto por poller).
   */
  it('P1 — MONTAGEM ÚNICA: dispara 1 chamada no mount + 6 ticks em 60s (total 7 chamadas, 6 req/min)', async () => {
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

    // Avança 10s -> tick 1
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Avança mais 10s (total 20s) -> tick 2
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(3)

    // Avança mais 40s (total 60s) -> ticks 3, 4, 5, 6
    await act(async () => {
      vi.advanceTimersByTime(40000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(7)
  })

  /**
   * P2 — RERENDER SEM DESMONTAR:
   * Rerenderizar o componente mantendo o mesmo effectiveUserId.
   * Provar que NÃO nasce um segundo timer: o ritmo se mantém estritamente em 1 a cada 10s (não dobra).
   */
  it('P2 — RERENDER SEM DESMONTAR: mantém ritmo de 1 chamada a cada 10s sem duplicar timers', async () => {
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

    // Avança 10s: deve ter exatamente 1 chamada nova (total 2), não 4 chamadas
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Avança mais 10s: deve ter exatamente 1 chamada nova (total 3)
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(3)
  })

  /**
   * P3 — UNMOUNT / REMOUNT:
   * Desmontar o componente; avançar o relógio além de 10s (ex.: 30s) e provar que o poller antigo
   * PAROU completamente (nenhuma chamada nova).
   * Em seguida, remontar e provar que nasce exatamente 1 novo poller (chamada imediata + 1 a cada 10s).
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
      vi.advanceTimersByTime(10000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Desmontar o componente
    unmount()

    // Avança 30 segundos com componente desmontado
    await act(async () => {
      vi.advanceTimersByTime(30000)
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

    // Avança 10s: novo poller dispara tick 1 (total 4)
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(4)

    // Avança mais 10s: novo poller dispara tick 2 (total 5)
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(5)
  })

  /**
   * P4 — REQUEST LENTA (PROVA DO OVERLAP / AUSÊNCIA DE IN-FLIGHT GUARD):
   * Fazer a primeira chamada ficar PENDENTE por mais de um intervalo (Promise não resolvida).
   * Avançar o relógio para o próximo tick (10s).
   * Provar que uma SEGUNDA chamada concorrente é disparada mesmo com a primeira pendente —
   * documentando que NÃO existe in-flight guard na implementação atual de produção.
   * NÃO corrigir na produção.
   */
  it('P4 — REQUEST LENTA (prova do overlap): dispara segundo tick mesmo com a primeira request ainda pendente', async () => {
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
          // Primeira chamada fica pendente indefinidamente
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

    // Avança 10 segundos até o próximo tick do timer
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    // PROVA DO DEFEITO: Sem guard de in-flight, o setInterval dispara a 2ª chamada concorrente
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Avança mais 10 segundos: dispara a 3ª chamada concorrente
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(3)

    // Resolvemos a primeira promise pendente para garantir cleanup limpo
    if (pendingResolver) {
      pendingResolver([])
    }
  })

  /**
   * P5 — DUPLICIDADE REALTIME / POLLING:
   * Com o useRealtime mockado, disparar o callback registrado para a coleção 'notifications'.
   * Provar que ele chama loadNotifications() e portanto dispara um getNotifications extra —
   * documentando que realtime e polling coexistem e disparam chamadas adicionais.
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

    // Polling continua correndo em paralelo: ao avançar 10s, tick do polling dispara 4ª chamada
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(4)
  })
})
