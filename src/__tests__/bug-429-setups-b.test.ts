import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'
import {
  racePracticeSetupService,
  PracticeSetupApplicationRecord,
} from '@/services/racePracticeSetupService'

describe('BUG-429-SETUPS-B: Fallback suave exclusivo para HTTP 429 nas leituras de session_setups', () => {
  const dummyApp1: PracticeSetupApplicationRecord = {
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
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    racePracticeSetupService.clearInFlightRequests()
    racePracticeSetupService.clearLastKnownValidStore()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // B1: 429 com valor válido anterior disponível → retorna último valor válido, sem retry.
  it('B1: 429 com valor válido anterior disponível retorna último valor válido, sem retry', async () => {
    let getListCalls = 0

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        getListCalls++
        if (getListCalls === 1) {
          // 1ª leitura bem-sucedida: retorna valor válido do backend
          return Promise.resolve({
            items: [
              {
                id: 'rec_setup_123',
                driver_strategies: {
                  practiceSetupApplications: {
                    app_c1: dummyApp1,
                  },
                },
              },
            ],
          })
        }
        // 2ª leitura simula erro 429 Too Many Requests (ClientResponseError estruturado)
        const err429 = new ClientResponseError({
          status: 429,
          response: {
            code: 429,
            message: 'Too Many Requests',
            data: {},
          },
        })
        return Promise.reject(err429)
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // 1ª leitura: popula o estado do backend
    const res1 = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )
    expect(res1).not.toBeNull()
    expect(res1?.accumulatedSetup).toBe(42)
    expect(getListCalls).toBe(1)

    // 2ª leitura: backend retorna 429
    // O serviço deve retornar o último valor válido anteriormente carregado (res1), sem crash e sem retry
    const res2 = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )

    expect(res2).not.toBeNull()
    expect(res2?.applicationKey).toBe('app_c1')
    expect(res2?.accumulatedSetup).toBe(42)
    // Exatamente 2 chamadas no total: 1ª chamada + 2ª chamada (sem retry imediato)
    expect(getListCalls).toBe(2)
    expect(mockCollection.getList).toHaveBeenCalledTimes(2)
  })

  // B2: 429 sem cache → estado neutro, accumulatedSetup efetivo 0.
  it('B2: 429 sem cache retorna estado neutro com accumulatedSetup efetivo 0', async () => {
    let getListCalls = 0

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        getListCalls++
        const err429 = new ClientResponseError({
          status: 429,
          response: {
            code: 429,
            message: 'Too Many Requests',
            data: {},
          },
        })
        return Promise.reject(err429)
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // Leitura direta de aplicação persistida quando nunca houve cache
    const appRec = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )
    expect(appRec).toBeNull()

    // Consulta de alto nível no carro através de getCarAccumulatedSetup:
    // Deve degradar suavemente para estado neutro (accumulatedSetup efetivo = 0)
    const carSetup = await racePracticeSetupService.getCarAccumulatedSetup({
      careerId: 'career_audi',
      seasonId: 'season_2026',
      round: 1,
      teamId: 'career_audi',
      carIndex: 1,
      isSprint: false,
    })

    expect(carSetup.accumulatedSetup).toBe(0)
    expect(carSetup.lastCompletedSession).toBeNull()
    expect(carSetup.qualifyingBonusSeconds).toBe(0)
    expect(carSetup.raceBonusSecondsPerLap).toBe(0)
    expect(carSetup.isPracticeComplete).toBe(false)
    expect(carSetup.nextStep).toBe('TL1')
  })

  // B3: 3 chamadas simultâneas mesma chave, backend 429 → 1 único GET, todas recebem fallback igual.
  it('B3: 3 chamadas simultâneas mesma chave com backend 429 disparam 1 único GET e todas recebem fallback igual', async () => {
    let getListCalls = 0
    let rejectGetList: (err: any) => void = () => {}

    const delayedPromise = new Promise((_, reject) => {
      rejectGetList = reject
    })

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        getListCalls++
        return delayedPromise
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // Dispara 3 chamadas concorrentes para a mesma chave canônica
    const call1 = racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )
    const call2 = racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )
    const call3 = racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )

    // Apenas 1 GET disparado no PocketBase
    expect(getListCalls).toBe(1)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(1)

    // Backend rejeita com 429
    const err429 = new ClientResponseError({
      status: 429,
      response: {
        code: 429,
        message: 'Too Many Requests',
        data: {},
      },
    })
    rejectGetList(err429)

    const [res1, res2, res3] = await Promise.all([call1, call2, call3])

    // Todas as 3 chamadas recebem exatamente o mesmo fallback neutro (null)
    expect(res1).toBeNull()
    expect(res2).toBeNull()
    expect(res3).toBeNull()

    // O backend continuou recebendo apenas 1 único GET (sem novas requisições)
    expect(getListCalls).toBe(1)
    expect(mockCollection.getList).toHaveBeenCalledTimes(1)
    // O mapa in-flight foi devidamente limpo
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })

  // B4: 400 e 500 → erro propaga, sem fallback.
  it('B4: Erros HTTP 400 e 500 propagam normalmente sem fallback silencioso', async () => {
    const err400 = new ClientResponseError({
      status: 400,
      response: {
        code: 400,
        message: 'Bad Request',
        data: {},
      },
    })

    const err500 = new ClientResponseError({
      status: 500,
      response: {
        code: 500,
        message: 'Internal Server Error',
        data: {},
      },
    })

    let currentError: any = err400

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        return Promise.reject(currentError)
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // Teste com 400: deve lançar e propagar o ClientResponseError
    await expect(
      racePracticeSetupService.loadPersistedApplication(
        'career_audi',
        'season_2026',
        1,
        'TL1',
        'app_c1',
      ),
    ).rejects.toThrow(err400)

    // Teste com 500: deve lançar e propagar o ClientResponseError
    currentError = err500
    await expect(
      racePracticeSetupService.loadPersistedApplication(
        'career_audi',
        'season_2026',
        1,
        'TL1',
        'app_c1',
      ),
    ).rejects.toThrow(err500)

    // In-flight deve estar limpo após os erros
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })

  // B5: 429/fallback na 1ª leitura, depois in-flight limpo, 2ª leitura com backend OK → valor real substitui o fallback (não fica preso em zero).
  it('B5: 429/fallback na 1ª leitura, depois in-flight limpo, 2ª leitura com backend OK atualiza com o valor real', async () => {
    let callCount = 0

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // 1ª leitura falha com 429
          const err429 = new ClientResponseError({
            status: 429,
            response: {
              code: 429,
              message: 'Rate limited',
              data: {},
            },
          })
          return Promise.reject(err429)
        }

        // 2ª leitura sucede com o registro persistido real
        return Promise.resolve({
          items: [
            {
              id: 'rec_ok',
              driver_strategies: {
                practiceSetupApplications: {
                  app_c1: dummyApp1,
                },
              },
            },
          ],
        })
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // 1ª leitura com 429 -> recebe fallback neutro (null)
    const res1 = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )
    expect(res1).toBeNull()
    expect(callCount).toBe(1)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)

    // 2ª leitura posterior quando o backend normaliza -> recebe o valor real (42), não fica preso em zero
    const res2 = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )
    expect(res2).not.toBeNull()
    expect(res2?.accumulatedSetup).toBe(42)
    expect(callCount).toBe(2)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })
})
