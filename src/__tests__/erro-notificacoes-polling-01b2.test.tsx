import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  NotificationBell,
  NOTIFICATION_SAFETY_POLL_INTERVAL_MS,
} from '@/components/NotificationBell'
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
let mockAuthUser: { id: string; email?: string } | null = { id: 'usr_poller_b2_test' }
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

describe('ERRO-NOTIFICACOES-POLLING-01B2 — Realtime Primário + Polling de Segurança (60s)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    realtimeListeners.clear()
    mockAuthUser = { id: 'usr_poller_b2_test' }
    mockAuthTeam = undefined
    mockAuthSeason = undefined
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('B2.0 — constante de intervalo exportada é exatamente 60.000 ms', () => {
    expect(NOTIFICATION_SAFETY_POLL_INTERVAL_MS).toBe(60000)
  })

  /**
   * B2.1 — MOUNT:
   * Montar NotificationBell; esperado exatamente 1 carga imediata.
   */
  it('B2.1 — mount: montar NotificationBell; esperado 1 carga imediata', async () => {
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockResolvedValue([])

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)
    expect(getNotificationsSpy).toHaveBeenLastCalledWith('usr_poller_b2_test', 30)
  })

  /**
   * B2.2 — FREQUÊNCIA DE SEGURANÇA:
   * Avançar fake timers por 59s -> nenhuma nova chamada causada pelo polling;
   * avançar até 60s -> exatamente 1 nova carga periódica.
   */
  it('B2.2 — frequência de segurança: avançar fake timers por 59s -> nenhuma nova chamada; até 60s -> exatamente 1 nova carga', async () => {
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockResolvedValue([])

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança 59 segundos
    await act(async () => {
      vi.advanceTimersByTime(59000)
    })
    // Nenhuma nova chamada aos 59s
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança mais 1 segundo (completando 60s)
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    // Exatamente 1 nova carga periódica (total 2)
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)
  })

  /**
   * B2.3 — CARGA POR MINUTO:
   * Em 60s de componente montado, sem realtime -> 1 chamada inicial + 1 safety poll;
   * não mais 7 chamadas como no comportamento antigo (10s).
   */
  it('B2.3 — carga por minuto: em 60s montado, sem realtime -> 1 inicial + 1 safety poll (total 2), não 7', async () => {
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockResolvedValue([])

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    // 1 chamada no mount
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança 60 segundos inteiros
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })

    // Total de 2 chamadas (1 mount + 1 safety poll aos 60s)
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Prova que em mais 60s (total 120s) há apenas mais 1 safety poll (total 3 chamadas em 2 minutos)
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(3)
  })

  /**
   * B2.4 — REALTIME CONTINUA IMEDIATO:
   * Antes dos 60s, disparar realtime notifications -> nova leitura imediatamente,
   * não esperar próximo poll. Repetir com events.
   */
  it('B2.4 — realtime continua imediato: antes dos 60s, dispara realtime notifications e events -> leitura imediata', async () => {
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockResolvedValue([])

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança 15s (bem antes dos 60s)
    await act(async () => {
      vi.advanceTimersByTime(15000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Dispara evento realtime em 'notifications'
    const notifListeners = realtimeListeners.get('notifications')
    expect(notifListeners).toBeDefined()
    await act(async () => {
      notifListeners?.forEach((cb) => cb({ action: 'create', record: { id: 'notif_1' } }))
    })

    // Leitura ocorreu imediatamente sem esperar o poll de 60s
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Avança mais 10s (total 25s)
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Dispara evento realtime em 'events'
    const eventListeners = realtimeListeners.get('events')
    expect(eventListeners).toBeDefined()
    await act(async () => {
      eventListeners?.forEach((cb) => cb({ action: 'update', record: { id: 'evt_1' } }))
    })

    // Leitura imediata de events
    expect(getNotificationsSpy).toHaveBeenCalledTimes(3)

    // Avança até o 60º segundo (faltam 35s) -> safety poll ainda dispara no seu tempo
    await act(async () => {
      vi.advanceTimersByTime(35000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(4)
  })

  /**
   * B2.5 — REALTIME + POLL SIMULTÂNEOS:
   * Fazer evento realtime ocorrer próximo do tick de 60s com request ainda pendente ->
   * guard B1 mantém no máximo uma request in-flight.
   */
  it('B2.5 — realtime + poll simultâneos: com request pendente no tick de 60s, guard B1 bloqueia request concorrente', async () => {
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
          // Mount resolve imediatamente
          return Promise.resolve([])
        }
        if (callCount === 2) {
          // Tick de 60s fica pendente
          return pendingPromise
        }
        return Promise.resolve([])
      })

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança 60s -> dispara o segundo fetch (safety poll), que fica pendente
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Durante a pendência da chamada de 60s, dispara realtime de 'notifications'
    const notifListeners = realtimeListeners.get('notifications')
    await act(async () => {
      notifListeners?.forEach((cb) => cb({ action: 'create' }))
    })
    // Guard B1 deve ter bloqueado a chamada simultânea
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Dispara realtime de 'events' simultaneamente
    const eventListeners = realtimeListeners.get('events')
    await act(async () => {
      eventListeners?.forEach((cb) => cb({ action: 'update' }))
    })
    // Continua bloqueado
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Resolve a request pendente
    await act(async () => {
      if (pendingResolver) {
        pendingResolver([])
      }
    })

    // Agora, novo evento realtime executa normalmente
    await act(async () => {
      notifListeners?.forEach((cb) => cb({ action: 'create' }))
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(3)
  })

  /**
   * B2.6 — CLEANUP:
   * unmount antes de 60s, avançar relógio -> nenhum safety poll após unmount.
   */
  it('B2.6 — cleanup: unmount antes de 60s, avançar relógio -> nenhum safety poll após unmount', async () => {
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockResolvedValue([])

    const { unmount } = render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança 30s
    await act(async () => {
      vi.advanceTimersByTime(30000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Desmonta antes dos 60s
    unmount()

    // Avança 120s além do unmount (passando pelo que seriam ticks de 60s e 120s)
    await act(async () => {
      vi.advanceTimersByTime(120000)
    })

    // Permanece em exatamente 1 chamada (a inicial antes do unmount)
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)
  })
})
