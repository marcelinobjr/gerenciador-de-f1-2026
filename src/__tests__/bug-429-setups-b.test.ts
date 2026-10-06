import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'
import {
  racePracticeSetupService,
  PracticeSetupApplicationRecord,
} from '@/services/racePracticeSetupService'

describe('BUG-429-SETUPS-B: Fallback Suave Exclusivo para HTTP 429 em session_setups', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    racePracticeSetupService.clearInFlightRequests()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // Helper para criar ClientResponseError
  function createPocketBaseError(status: number, message = `Error ${status}`) {
    const err = new ClientResponseError({
      status,
      message,
      data: {},
    })
    return err
  }

  const sampleRecord: PracticeSetupApplicationRecord = {
    applicationKey: 'app_audi_c1',
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
    appliedAt: '2026-03-29T10:00:00.000Z',
  }

  it('B1 — 429 com valor válido anterior: simular valor válido já disponível + backend retornando 429. Esperado: chamada não explode, retorna último valor válido e não faz retry imediato', async () => {
    // 1. Simula que em uma leitura prévia bem-sucedida, o registro foi obtido e gravado no cache local
    const mockSuccessResponse = {
      items: [
        {
          id: 'rec_prev_123',
          team_id: 'career_audi',
          season_id: 'season_2026',
          round: 1,
          session: 'tp1',
          driver_strategies: {
            practiceSetupApplications: {
              app_audi_c1: sampleRecord,
            },
          },
        },
      ],
    }

    let getListCallCount = 0
    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        getListCallCount++
        return Promise.resolve(mockSuccessResponse)
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') return mockCollection as any
      return {} as any
    })

    // Primeira chamada: carrega normalmente e popula cache local
    const firstCall = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_audi_c1',
    )
    expect(firstCall).toEqual(sampleRecord)
    expect(getListCallCount).toBe(1)

    // 2. Agora o backend passa a responder HTTP 429
    mockCollection.getList.mockImplementation(() => {
      getListCallCount++
      return Promise.reject(createPocketBaseError(429, 'Too Many Requests'))
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Segunda chamada: backend retorna 429
    const secondCall = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_audi_c1',
    )

    // Não deve explodir; deve retornar o último valor válido conhecido
    expect(secondCall).toEqual(sampleRecord)
    expect(secondCall?.accumulatedSetup).toBe(42)

    // Não deve disparar retry imediato: apenas UMA tentativa foi feita nessa chamada (total = 2)
    expect(getListCallCount).toBe(2)

    // Log de advertência deve ter sido emitido
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('HTTP 429 detectado em loadPersistedApplication'),
    )
  })

  it('B2 — 429 sem cache/valor anterior: backend retorna 429 sem valor disponível. Esperado: chamada não explode, retorna estado neutro (null) e getCarAccumulatedSetup devolve accumulatedSetup = 0', async () => {
    let getListCallCount = 0
    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        getListCallCount++
        return Promise.reject(createPocketBaseError(429, 'Rate limited'))
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') return mockCollection as any
      return {} as any
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // loadPersistedApplication direto: não explode e retorna null (estado neutro)
    const result = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_nonexistent',
    )
    expect(result).toBeNull()
    expect(getListCallCount).toBe(1)

    // Testar efeito funcional no consumidor de alto nível da página /corrida (getCarAccumulatedSetup)
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

    expect(warnSpy).toHaveBeenCalled()
  })

  it('B3 — concorrência + 429: três chamadas simultâneas para a mesma chave; backend chamado uma única vez e responde 429. Esperado: todas resolvem pelo mesmo fallback, nenhum novo GET é disparado', async () => {
    let getListCallCount = 0
    let rejectGetList: (err: any) => void = () => {}

    const delayedPromise = new Promise((_, reject) => {
      rejectGetList = reject
    })

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        getListCallCount++
        return delayedPromise
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') return mockCollection as any
      return {} as any
    })

    vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Dispara 3 chamadas simultâneas com a mesma chave
    const call1 = racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_concurrent',
    )
    const call2 = racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_concurrent',
    )
    const call3 = racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_concurrent',
    )

    // Deduplicação in-flight (Bloco A): PocketBase é chamado exatamente 1 vez
    expect(getListCallCount).toBe(1)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(1)

    // Rejeita a Promise com HTTP 429
    rejectGetList(createPocketBaseError(429, 'Rate limit exceeded'))

    const [res1, res2, res3] = await Promise.all([call1, call2, call3])

    // Todas resolvem de maneira coerente pelo fallback suave (null / neutro, sem crash)
    expect(res1).toBeNull()
    expect(res2).toBeNull()
    expect(res3).toBeNull()

    // Nenhum novo GET foi disparado
    expect(getListCallCount).toBe(1)
    expect(mockCollection.getList).toHaveBeenCalledTimes(1)

    // Mapa in-flight limpo
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })

  it('B4 — erro não-429: simular 400 e 500. Esperado: erro continua sendo propagado, nenhum fallback silencioso', async () => {
    let statusCodeToReturn = 400

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        return Promise.reject(
          createPocketBaseError(statusCodeToReturn, `HTTP ${statusCodeToReturn} Failure`),
        )
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') return mockCollection as any
      return {} as any
    })

    vi.spyOn(console, 'warn').mockImplementation(() => {})

    // 1. Teste com 400: DEVE propagar o erro (não mascarar falhas de schema/request)
    statusCodeToReturn = 400
    await expect(
      racePracticeSetupService.loadPersistedApplication(
        'career_audi',
        'season_2026',
        1,
        'TL1',
        'app_key',
      ),
    ).rejects.toThrow('HTTP 400 Failure')

    // 2. Teste com 500: DEVE propagar o erro
    statusCodeToReturn = 500
    await expect(
      racePracticeSetupService.loadPersistedApplication(
        'career_audi',
        'season_2026',
        1,
        'TL1',
        'app_key',
      ),
    ).rejects.toThrow('HTTP 500 Failure')

    // 3. Teste com 401: DEVE propagar o erro
    statusCodeToReturn = 401
    await expect(
      racePracticeSetupService.loadPersistedApplication(
        'career_audi',
        'season_2026',
        1,
        'TL1',
        'app_key',
      ),
    ).rejects.toThrow('HTTP 401 Failure')

    // 4. Teste com 403: DEVE propagar o erro
    statusCodeToReturn = 403
    await expect(
      racePracticeSetupService.loadPersistedApplication(
        'career_audi',
        'season_2026',
        1,
        'TL1',
        'app_key',
      ),
    ).rejects.toThrow('HTTP 403 Failure')

    // In-flight deve estar limpo após cada erro
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })

  it('B5 — recuperação posterior: primeira leitura -> 429/fallback; depois que o in-flight foi limpo, segunda leitura normal -> backend disponível. Esperado: nova consulta permitida, valor real substitui o fallback, sistema não fica preso em zero', async () => {
    let callCount = 0

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.reject(createPocketBaseError(429, 'Rate limited in first call'))
        }
        return Promise.resolve({
          items: [
            {
              id: 'rec_recovered_1',
              team_id: 'career_audi',
              season_id: 'season_2026',
              round: 1,
              session: 'tp1',
              driver_strategies: {
                practiceSetupApplications: {
                  app_audi_c1: sampleRecord,
                },
              },
            },
          ],
        })
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') return mockCollection as any
      return {} as any
    })

    vi.spyOn(console, 'warn').mockImplementation(() => {})

    // 1ª Leitura: Backend retorna 429 -> fallback neutro (null)
    const firstResult = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_audi_c1',
    )
    expect(firstResult).toBeNull()
    expect(callCount).toBe(1)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)

    // 2ª Leitura: Backend voltou ao normal -> retorna o dado real do backend
    const secondResult = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_audi_c1',
    )
    expect(secondResult).not.toBeNull()
    expect(secondResult?.accumulatedSetup).toBe(42)
    expect(secondResult?.driverId).toBe('drv_hulkenberg')
    expect(callCount).toBe(2)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })
})
