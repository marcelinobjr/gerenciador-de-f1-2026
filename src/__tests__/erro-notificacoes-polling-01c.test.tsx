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

// AuthContext mock isolado
let mockAuthUser: { id: string; email?: string } | null = { id: 'usr_poller_c_test' }
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

describe('ERRO-NOTIFICACOES-POLLING-01C — Suspensão de Safety Poll na Corrida ao Vivo + Reconciliação', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    realtimeListeners.clear()
    mockAuthUser = { id: 'usr_poller_c_test' }
    mockAuthTeam = undefined
    mockAuthSeason = undefined
    document.body.removeAttribute('data-live-race-running')
    window.sessionStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    document.body.removeAttribute('data-live-race-running')
    window.sessionStorage.clear()
  })

  /**
   * C1 — ÁREA NORMAL:
   * Montar fora da corrida ao vivo; carga imediata; exatamente 1 safety poll aos 60s.
   */
  it('C1 — área normal: montar fora da corrida ao vivo; carga imediata; 1 safety poll aos 60s', async () => {
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NotificationBell />
      </MemoryRouter>,
    )

    // Carga imediata no mount
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)
    expect(getNotificationsSpy).toHaveBeenLastCalledWith('usr_poller_c_test', 30)

    // Avança 59s -> nenhuma nova chamada
    await act(async () => {
      vi.advanceTimersByTime(59000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança até 60s -> exatamente 1 safety poll periódico
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)
  })

  /**
   * C2 — ENTRAR NA CORRIDA AO VIVO:
   * Começar fora, entrar na rota/estado que oculta o sino, avançar fake timers por pelo menos 180s;
   * zero polling periódico nesse período.
   */
  it('C2 — entrar na corrida ao vivo: começar fora, entrar no estado de live race, avançar 180s -> zero polling periódico', async () => {
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockResolvedValue([])

    const { rerender } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NotificationBell />
      </MemoryRouter>,
    )

    // 1 chamada no mount em /dashboard
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Ativa corrida ao vivo em /corrida
    document.body.setAttribute('data-live-race-running', 'true')
    rerender(
      <MemoryRouter initialEntries={['/corrida']}>
        <NotificationBell />
      </MemoryRouter>,
    )

    // Avança timers por 180s (3 ciclos completos de 60s)
    await act(async () => {
      vi.advanceTimersByTime(180000)
    })

    // Nenhuma nova chamada de polling deve ter ocorrido durante a corrida ao vivo
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)
  })

  /**
   * C3 — REALTIME DURANTE CORRIDA:
   * Com sino oculto na corrida ao vivo, disparar evento realtime; realtime continua funcionando;
   * loadNotifications() pode atualizar; ausência de polling não desativa subscription.
   */
  it('C3 — realtime durante corrida: com sino oculto, evento realtime continua atualizando notificações', async () => {
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockResolvedValue([])

    document.body.setAttribute('data-live-race-running', 'true')

    render(
      <MemoryRouter initialEntries={['/corrida']}>
        <NotificationBell />
      </MemoryRouter>,
    )

    // Montou diretamente na corrida ao vivo -> polling suspenso, sem chamada inicial de polling
    expect(getNotificationsSpy).toHaveBeenCalledTimes(0)

    // Realtime listeners devem estar montados e registrados
    const notifListeners = realtimeListeners.get('notifications')
    expect(notifListeners).toBeDefined()
    expect(notifListeners?.size).toBeGreaterThan(0)

    // Dispara evento realtime de notificações
    await act(async () => {
      notifListeners?.forEach((cb) => cb({ action: 'create', record: { id: 'notif_live_1' } }))
    })

    // Realtime atualizou com sucesso mesmo com o sino oculto
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Dispara evento realtime de eventos
    const eventListeners = realtimeListeners.get('events')
    expect(eventListeners).toBeDefined()
    await act(async () => {
      eventListeners?.forEach((cb) => cb({ action: 'update', record: { id: 'evt_live_1' } }))
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // Avança 120s para provar que polling continua suspenso
    await act(async () => {
      vi.advanceTimersByTime(120000)
    })
    // Continua exatamente com as 2 chamadas originadas do realtime, zero polling
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)
  })

  /**
   * C4 — SAIR DA CORRIDA:
   * Voltar para rota normal; exatamente 1 carga imediata de reconciliação;
   * timer de 60s volta a funcionar; após 60s exatamente 1 safety poll.
   */
  it('C4 — sair da corrida: voltar para rota normal -> exatamente 1 carga de reconciliação imediata + safety poll aos 60s', async () => {
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockResolvedValue([])

    // Começa na corrida ao vivo
    document.body.setAttribute('data-live-race-running', 'true')

    const { rerender } = render(
      <MemoryRouter initialEntries={['/corrida']}>
        <NotificationBell />
      </MemoryRouter>,
    )

    expect(getNotificationsSpy).toHaveBeenCalledTimes(0)

    // Sai da corrida ao vivo voltando para /dashboard
    document.body.removeAttribute('data-live-race-running')
    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NotificationBell />
      </MemoryRouter>,
    )

    // Exatamente 1 carga imediata de reconciliação executada
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança 59s -> nenhuma nova chamada
    await act(async () => {
      vi.advanceTimersByTime(59000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Avança até 60s -> exatamente 1 safety poll (total 2)
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)
  })

  /**
   * C5 — VÁRIAS ENTRADAS/SAÍDAS:
   * Alternar normal → live race → normal → live race → normal;
   * nunca mais de 1 interval ativo; nenhum timer fantasma; nenhuma multiplicação de requests.
   */
  it('C5 — várias entradas/saídas: normal -> live -> normal -> live -> normal não acumula timers nem duplica requests', async () => {
    const getNotificationsSpy = vi
      .spyOn(notificationService, 'getNotifications')
      .mockResolvedValue([])

    // 1. Inicia em Normal (/dashboard)
    const { rerender } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NotificationBell />
      </MemoryRouter>,
    )
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1) // Mount

    // 2. Transição para Live Race (/corrida + flag)
    document.body.setAttribute('data-live-race-running', 'true')
    rerender(
      <MemoryRouter initialEntries={['/corrida']}>
        <NotificationBell />
      </MemoryRouter>,
    )
    // Avança 70s na live race -> zero polling
    await act(async () => {
      vi.advanceTimersByTime(70000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // 3. Volta para Normal (/dashboard)
    document.body.removeAttribute('data-live-race-running')
    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NotificationBell />
      </MemoryRouter>,
    )
    // Carga de reconciliação imediata
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // 4. Nova entrada na Live Race (/corrida-ao-vivo + flag)
    document.body.setAttribute('data-live-race-running', 'true')
    rerender(
      <MemoryRouter initialEntries={['/corrida-ao-vivo']}>
        <NotificationBell />
      </MemoryRouter>,
    )
    // Avança 100s na live race -> zero polling
    await act(async () => {
      vi.advanceTimersByTime(100000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)

    // 5. Volta para Normal (/garagem)
    document.body.removeAttribute('data-live-race-running')
    rerender(
      <MemoryRouter initialEntries={['/garagem']}>
        <NotificationBell />
      </MemoryRouter>,
    )
    // Nova reconciliação imediata
    expect(getNotificationsSpy).toHaveBeenCalledTimes(3)

    // Avança 59s -> nenhum tick precoce
    await act(async () => {
      vi.advanceTimersByTime(59000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(3)

    // Avança mais 1s (completando 60s) -> exatamente 1 safety poll
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(4)

    // Avança mais 60s -> exatamente 1 safety poll (total 5)
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(5)
  })

  /**
   * C6 — SAÍDA COM REQUEST IN-FLIGHT:
   * Realtime mantém uma request pendente; sair da corrida ao vivo;
   * carga de reconciliação respeita B1 (máximo 1 request ativa);
   * após a conclusão, próximos ticks funcionam normalmente.
   */
  it('C6 — saída com request in-flight: carga de reconciliação respeita guard B1 se realtime estiver pendente', async () => {
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
          // Primeira chamada (disparada pelo realtime durante live race) fica pendente
          return pendingPromise
        }
        return Promise.resolve([])
      })

    // Começa na corrida ao vivo
    document.body.setAttribute('data-live-race-running', 'true')

    const { rerender } = render(
      <MemoryRouter initialEntries={['/corrida']}>
        <NotificationBell />
      </MemoryRouter>,
    )

    expect(getNotificationsSpy).toHaveBeenCalledTimes(0)

    // Dispara realtime durante corrida ao vivo -> inicia request pendente
    const notifListeners = realtimeListeners.get('notifications')
    await act(async () => {
      notifListeners?.forEach((cb) => cb({ action: 'create' }))
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Enquanto a request do realtime AINDA está pendente, sai da corrida ao vivo para /dashboard
    document.body.removeAttribute('data-live-race-running')
    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NotificationBell />
      </MemoryRouter>,
    )

    // A carga de reconciliação imediata tenta rodar mas é BLOQUEADA pelo guard B1 (inFlightRef)
    // Mantendo exatamente 1 request simultânea ativa
    expect(getNotificationsSpy).toHaveBeenCalledTimes(1)

    // Resolve a request que estava pendente
    await act(async () => {
      if (pendingResolver) {
        pendingResolver([])
      }
    })

    // Com o guard destravado, após 60s o próximo safety poll executa normalmente
    await act(async () => {
      vi.advanceTimersByTime(NOTIFICATION_SAFETY_POLL_INTERVAL_MS)
    })
    expect(getNotificationsSpy).toHaveBeenCalledTimes(2)
  })
})
