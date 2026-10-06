import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'
import {
  racePracticeSetupService,
  PracticeSetupApplicationRecord,
} from '@/services/racePracticeSetupService'

describe('BUG-429-SETUPS-B4: Propagação Explícita de Erros Não-429', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    racePracticeSetupService.clearInFlightRequests()
    racePracticeSetupService.clearLastKnownGood()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  it('B4.1 — HTTP 400: ClientResponseError com status = 400 é propagado, não retorna null, não usa last-known-good, não faz retry', async () => {
    let callCount = 0
    const err400 = new ClientResponseError({
      status: 400,
      response: {
        code: 400,
        message: 'Bad Request - Failed to filter',
        data: {},
      },
    })

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        callCount++
        return Promise.reject(err400)
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // Esperado:
    // - erro é propagado (não retorna null)
    // - erro lançado é exatamente err400
    // - não faz retry (chamado exatamente 1 vez)
    await expect(
      racePracticeSetupService.loadPersistedApplication(
        'career_audi',
        'season_2026',
        1,
        'TL1',
        'app_c1',
      ),
    ).rejects.toThrow(err400)

    expect(callCount).toBe(1)
    expect(mockCollection.getList).toHaveBeenCalledTimes(1)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })

  it('B4.2 — HTTP 401/403: Autenticação/autorização propaga erro integralmente sem nenhum fallback', async () => {
    const err401 = new ClientResponseError({
      status: 401,
      response: {
        code: 401,
        message: 'The request requires valid user authorization token.',
        data: {},
      },
    })

    const err403 = new ClientResponseError({
      status: 403,
      response: {
        code: 403,
        message: 'The authorized record is not allowed to perform this action.',
        data: {},
      },
    })

    let callCount = 0
    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.reject(err401)
        }
        return Promise.reject(err403)
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // Caso 1: 401 Unauthorized
    await expect(
      racePracticeSetupService.loadPersistedApplication(
        'career_audi',
        'season_2026',
        1,
        'TL1',
        'app_c1',
      ),
    ).rejects.toThrow(err401)

    expect(callCount).toBe(1)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)

    // Caso 2: 403 Forbidden
    await expect(
      racePracticeSetupService.loadPersistedApplication(
        'career_audi',
        'season_2026',
        1,
        'TL1',
        'app_c1',
      ),
    ).rejects.toThrow(err403)

    expect(callCount).toBe(2)
    expect(mockCollection.getList).toHaveBeenCalledTimes(2)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })

  it('B4.3 — HTTP 500: Backend retorna status = 500, erro propagado sem fallback e sem retry', async () => {
    let callCount = 0
    const err500 = new ClientResponseError({
      status: 500,
      response: {
        code: 500,
        message: 'Internal Server Error',
        data: {},
      },
    })

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        callCount++
        return Promise.reject(err500)
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    await expect(
      racePracticeSetupService.loadPersistedApplication(
        'career_audi',
        'season_2026',
        1,
        'TL1',
        'app_c1',
      ),
    ).rejects.toThrow(err500)

    // Sem retry e sem fallback
    expect(callCount).toBe(1)
    expect(mockCollection.getList).toHaveBeenCalledTimes(1)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })

  it('B4.4 — Erro desconhecido: lança erro que não seja ClientResponseError, propaga exatamente o erro e não converte em null', async () => {
    let callCount = 0
    const unknownNetworkError = new TypeError(
      'Failed to fetch: network connection closed abnormally',
    )

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        callCount++
        return Promise.reject(unknownNetworkError)
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // Esperado: propagar exatamente o erro lançado, não converter em null nem capturar
    await expect(
      racePracticeSetupService.loadPersistedApplication(
        'career_audi',
        'season_2026',
        1,
        'TL1',
        'app_c1',
      ),
    ).rejects.toThrow(unknownNetworkError)

    expect(callCount).toBe(1)
    expect(mockCollection.getList).toHaveBeenCalledTimes(1)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })

  it('B4.5 — Last-known-good não mascara erro real: valor válido carregado para uma chave, depois backend retorna 500 para essa mesma chave; não retorna valor anterior, erro 500 sobe', async () => {
    let callCount = 0

    const validRecord = {
      id: 'rec_setup_valid',
      team_id: 'career_audi',
      season_id: 'season_2026',
      round: 1,
      session: 'tp1',
      driver_strategies: {
        practiceSetupApplications: {
          app_c1: {
            applicationKey: 'app_c1',
            careerId: 'career_audi',
            seasonId: 'season_2026',
            round: 1,
            session: 'TL1',
            teamId: 'career_audi',
            carIndex: 1,
            driverId: 'drv_hulkenberg',
            configVersion: '1.0.0',
            plannedLaps: 15,
            completedLaps: 15,
            consistency: 85,
            uniformSetupDraw: 0.5,
            previousSetup: 0,
            sessionGain: 42,
            accumulatedSetup: 42,
            qualifyingBonusSeconds: 0.08,
            raceBonusSecondsPerLap: 0.04,
            appliedAt: new Date().toISOString(),
          } as PracticeSetupApplicationRecord,
        },
      },
    }

    const err500 = new ClientResponseError({
      status: 500,
      response: {
        code: 500,
        message: 'Internal Server Error - Database connection timed out',
        data: {},
      },
    })

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // 1ª leitura: responde válido
          return Promise.resolve({
            items: [validRecord],
          })
        }
        // 2ª leitura para a mesma chave: backend falha com HTTP 500
        return Promise.reject(err500)
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // 1. Primeiro carregar valor válido para a chave
    const firstRead = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )
    expect(firstRead).not.toBeNull()
    expect(firstRead?.applicationKey).toBe('app_c1')
    expect(firstRead?.accumulatedSetup).toBe(42)
    expect(callCount).toBe(1)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)

    // 2. Segunda leitura para a mesma chave: backend retorna HTTP 500
    // Prova que last-known-good NÃO mascara o erro 500!
    // O erro 500 DEVE subir e não pode retornar o valor 42 anterior
    await expect(
      racePracticeSetupService.loadPersistedApplication(
        'career_audi',
        'season_2026',
        1,
        'TL1',
        'app_c1',
      ),
    ).rejects.toThrow(err500)

    expect(callCount).toBe(2)
    expect(mockCollection.getList).toHaveBeenCalledTimes(2)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })
})
