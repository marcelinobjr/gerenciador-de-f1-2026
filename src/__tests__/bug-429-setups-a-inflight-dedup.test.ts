import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  racePracticeSetupService,
  buildPracticeSetupFactKey,
} from '@/services/racePracticeSetupService'

describe('BUG-429-SETUPS-A: Deduplicação de Requests In-Flight para session_setups', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    racePracticeSetupService.clearInFlightRequests()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  it('1. Chave canônica estável representa univocamente os parâmetros da consulta no PocketBase', () => {
    const key1 = racePracticeSetupService.buildSessionSetupCanonicalKey(
      'career_audi',
      'season_2026',
      1,
      'tp1',
    )
    const key2 = racePracticeSetupService.buildSessionSetupCanonicalKey(
      'career_audi',
      'season_2026',
      1,
      'tp1',
    )
    const keyDiffSession = racePracticeSetupService.buildSessionSetupCanonicalKey(
      'career_audi',
      'season_2026',
      1,
      'tp2',
    )
    const keyDiffRound = racePracticeSetupService.buildSessionSetupCanonicalKey(
      'career_audi',
      'season_2026',
      2,
      'tp1',
    )

    expect(key1).toBe('team_id::career_audi::season_id::season_2026::round::1::session::tp1')
    expect(key1).toBe(key2)
    expect(key1).not.toBe(keyDiffSession)
    expect(key1).not.toBe(keyDiffRound)
  })

  it('2. Chamadas simultâneas com a mesma chave canônica disparam apenas UMA requisição ao PocketBase e compartilham o resultado', async () => {
    const mockRecord = {
      id: 'rec_setup_123',
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
          },
          app_c2: {
            applicationKey: 'app_c2',
            careerId: 'career_audi',
            seasonId: 'season_2026',
            round: 1,
            session: 'TL1',
            teamId: 'career_audi',
            carIndex: 2,
            driverId: 'drv_bortoleto',
            configVersion: '1.0.0',
            plannedLaps: 15,
            completedLaps: 15,
            consistency: 85,
            uniformSetupDraw: 0.5,
            previousSetup: 0,
            sessionGain: 40,
            accumulatedSetup: 40,
            qualifyingBonusSeconds: 0.076,
            raceBonusSecondsPerLap: 0.038,
            appliedAt: new Date().toISOString(),
          },
        },
      },
    }

    let getListCallCount = 0
    let resolveGetList: (val: any) => void = () => {}

    const delayedPromise = new Promise((resolve) => {
      resolveGetList = resolve
    })

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        getListCallCount++
        return delayedPromise
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // Dispara 3 chamadas concorrentes para a mesma chave canônica (ex: montagem simultânea Carro 1 e Carro 2 no TL1)
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
      'app_c2',
    )
    const call3 = racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )

    // Enquanto as requisições estão pendentes:
    // O PocketBase deve ter sido chamado exatamente UMA vez
    expect(getListCallCount).toBe(1)
    expect(mockCollection.getList).toHaveBeenCalledTimes(1)
    // O mapa in-flight deve conter 1 entrada
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(1)

    // Libera a resposta do PocketBase
    resolveGetList({
      items: [mockRecord],
    })

    const [res1, res2, res3] = await Promise.all([call1, call2, call3])

    // Todas as chamadas recebem os dados corretos
    expect(res1?.applicationKey).toBe('app_c1')
    expect(res1?.accumulatedSetup).toBe(42)
    expect(res2?.applicationKey).toBe('app_c2')
    expect(res2?.accumulatedSetup).toBe(40)
    expect(res3?.applicationKey).toBe('app_c1')
    expect(res3).toBe(res1) // Mesma referência do store compartilhado

    // PocketBase continuou sendo chamado uma única vez (antes e depois do resolve)
    expect(mockCollection.getList).toHaveBeenCalledTimes(1)
    expect(getListCallCount).toBe(1)

    // Após resolver, a Promise foi removida do mapa in-flight (não cria cache in-flight permanente)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })

  it('3. Depois que a Promise resolve, uma nova chamada futura pode consultar novamente normalmente', async () => {
    let getListCallCount = 0

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        getListCallCount++
        return Promise.resolve({
          items: [
            {
              id: 'rec_setup_1',
              driver_strategies: {
                practiceSetupApplications: {
                  app_test: {
                    applicationKey: 'app_test',
                    accumulatedSetup: 50,
                  },
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

    // Primeira chamada: consulta backend
    const resFirst = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_test',
    )
    expect(resFirst?.accumulatedSetup).toBe(50)
    expect(getListCallCount).toBe(1)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)

    // Segunda chamada posterior (após resolução): faz nova consulta normal ao backend
    const resSecond = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_test',
    )
    expect(resSecond?.accumulatedSetup).toBe(50)
    expect(getListCallCount).toBe(2)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })

  it('4. Se a primeira chamada rejeitar, a entrada in-flight é limpa e não fica presa à Promise rejeitada', async () => {
    let callIndex = 0

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        callIndex++
        if (callIndex === 1) {
          return Promise.reject(new Error('Network failure or simulated 429'))
        }
        return Promise.resolve({
          items: [
            {
              id: 'rec_ok',
              driver_strategies: {
                practiceSetupApplications: {
                  app_ok: {
                    applicationKey: 'app_ok',
                    accumulatedSetup: 35,
                  },
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

    // 1ª chamada falha (rejeita com erro não-429)
    // loadPersistedApplication propaga o erro não-429
    await expect(
      racePracticeSetupService.loadPersistedApplication(
        'career_audi',
        'season_2026',
        1,
        'TL1',
        'app_ok',
      ),
    ).rejects.toThrow('Network failure or simulated 429')
    expect(callIndex).toBe(1)

    // In-flight deve estar limpo imediatamente
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)

    // 2ª chamada posterior deve tentar novamente o backend com sucesso (não fica presa ao erro)
    const res2 = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_ok',
    )
    expect(res2?.accumulatedSetup).toBe(35)
    expect(callIndex).toBe(2)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })

  it('5. Controle: duas chaves diferentes resultam em duas consultas independentes ao PocketBase', async () => {
    let resolveTL1: (val: any) => void = () => {}
    let resolveTL2: (val: any) => void = () => {}

    const promiseTL1 = new Promise((resolve) => {
      resolveTL1 = resolve
    })
    const promiseTL2 = new Promise((resolve) => {
      resolveTL2 = resolve
    })

    const mockCollection = {
      getList: vi.fn().mockImplementation((_page: number, _perPage: number, options: any) => {
        if (options.filter.includes('"tp1"')) {
          return promiseTL1
        }
        if (options.filter.includes('"tp2"')) {
          return promiseTL2
        }
        return Promise.resolve({ items: [] })
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // Dispara consultas para sessões diferentes (TL1 e TL2) simultaneamente
    const callTL1 = racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_tl1',
    )
    const callTL2 = racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL2',
      'app_tl2',
    )

    // Ambas geram consultas distintas ao PocketBase
    expect(mockCollection.getList).toHaveBeenCalledTimes(2)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(2)

    // Resolver TL1
    resolveTL1({
      items: [
        {
          id: 'rec_tl1',
          driver_strategies: {
            practiceSetupApplications: {
              app_tl1: { applicationKey: 'app_tl1', accumulatedSetup: 20 },
            },
          },
        },
      ],
    })

    const resTL1 = await callTL1
    expect(resTL1?.accumulatedSetup).toBe(20)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(1) // TL2 ainda pendente

    // Resolver TL2
    resolveTL2({
      items: [
        {
          id: 'rec_tl2',
          driver_strategies: {
            practiceSetupApplications: {
              app_tl2: { applicationKey: 'app_tl2', accumulatedSetup: 45 },
            },
          },
        },
      ],
    })

    const resTL2 = await callTL2
    expect(resTL2?.accumulatedSetup).toBe(45)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })

  it('6. Fluxo getCarAccumulatedSetup para Carro 1 e Carro 2 concorre em TL3, TL2 e TL1 sem duplicar chamadas ao backend', async () => {
    const executedFilters: string[] = []

    const mockCollection = {
      getList: vi.fn().mockImplementation((_page: number, _perPage: number, options: any) => {
        executedFilters.push(options.filter)
        return Promise.resolve({ items: [] })
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // Simulação do WeekendV2Page / PracticePreparationView montando os dois carros simultaneamente:
    // Promise.all([ getCarAccumulatedSetup(Carro 1), getCarAccumulatedSetup(Carro 2) ])
    const [c1, c2] = await Promise.all([
      racePracticeSetupService.getCarAccumulatedSetup({
        careerId: 'career_audi',
        seasonId: 'season_2026',
        round: 1,
        teamId: 'career_audi',
        carIndex: 1,
        isSprint: false,
      }),
      racePracticeSetupService.getCarAccumulatedSetup({
        careerId: 'career_audi',
        seasonId: 'season_2026',
        round: 1,
        teamId: 'career_audi',
        carIndex: 2,
        isSprint: false,
      }),
    ])

    expect(c1.accumulatedSetup).toBe(0)
    expect(c2.accumulatedSetup).toBe(0)

    // Em fim de semana normal, checa TL3, TL2, TL1.
    // Como os dois carros disparam em paralelo, para cada sessão (TL3, TL2, TL1) deve haver apenas 1 consulta!
    // Total de consultas ao invés de 6 (3 sessões * 2 carros) deve ser exatamente 3!
    expect(mockCollection.getList).toHaveBeenCalledTimes(3)
    expect(executedFilters).toEqual([
      'team_id = "career_audi" && season_id = "season_2026" && round = 1 && session = "tp3"',
      'team_id = "career_audi" && season_id = "season_2026" && round = 1 && session = "tp2"',
      'team_id = "career_audi" && season_id = "season_2026" && round = 1 && session = "tp1"',
    ])
  })
})
