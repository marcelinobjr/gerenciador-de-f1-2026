import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'
import {
  racePracticeSetupService,
  PracticeSetupApplicationRecord,
} from '@/services/racePracticeSetupService'

describe('BUG-429-SETUPS-B3: Concorrência de Leitura com Resposta 429 e Recuperação', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    racePracticeSetupService.clearInFlightRequests()
    racePracticeSetupService.clearLastKnownGood()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  it('CENÁRIO 1 — SEM LAST-KNOWN-GOOD: 3 chamadas concorrentes da mesma chave recebendo um único 429', async () => {
    const err429 = new ClientResponseError({
      status: 429,
      response: {
        code: 429,
        message: 'Too Many Requests',
        data: {},
      },
    })

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
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // Disparar simultaneamente 3 chamadas para exatamente a mesma chave canônica:
    // team_id::{careerId}::season_id::{seasonId}::round::{round}::session::{internalSession}
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

    // Provar:
    // 1. PocketBase chamado 1 única vez enquanto requisições estão pendentes
    expect(getListCallCount).toBe(1)
    expect(mockCollection.getList).toHaveBeenCalledTimes(1)

    // 2. As 3 chamadas compartilham a mesma Promise in-flight
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(1)

    // Backend responde 429
    rejectGetList(err429)

    // Aguardar resolução de todas as chamadas
    const [res1, res2, res3] = await Promise.all([call1, call2, call3])

    // Provar:
    // 3. Nenhuma faz retry (continua exatamente 1 GET)
    expect(getListCallCount).toBe(1)
    expect(mockCollection.getList).toHaveBeenCalledTimes(1)

    // 4. Todas resolvem coerentemente para null
    expect(res1).toBeNull()
    expect(res2).toBeNull()
    expect(res3).toBeNull()

    // 5. Nenhuma rejeita (o Promise.all acima não disparou erro/rejeição)

    // 6. Após conclusão, entrada in-flight foi removida do Map
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })

  it('CENÁRIO 2 — COM LAST-KNOWN-GOOD: Primeiro carrega resposta válida; depois 3 leituras concorrentes recebem um único 429', async () => {
    let getListCallCount = 0
    let rejectGetList: (err: any) => void = () => {}

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

    const err429 = new ClientResponseError({
      status: 429,
      response: {
        code: 429,
        message: 'Too Many Requests',
        data: {},
      },
    })

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        getListCallCount++
        if (getListCallCount === 1) {
          // 1ª leitura: responde válido com practiceSetupApplications
          return Promise.resolve({
            items: [validRecord],
          })
        }
        // 2ª consulta (batch concorrente): Promise pendente que rejeitará com 429
        return new Promise((_, reject) => {
          rejectGetList = reject
        })
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // 1. Primeiro carregar resposta válida para a chave (confirmar que B2 armazenou o last-known-good)
    const initialLoad = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )
    expect(initialLoad).not.toBeNull()
    expect(initialLoad?.accumulatedSetup).toBe(42)
    expect(initialLoad?.applicationKey).toBe('app_c1')
    expect(getListCallCount).toBe(1)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)

    // Limpar cache local (localStorage) para garantir que o resultado venha do last-known-good em memória
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }

    // 2. Disparar 3 leituras concorrentes da mesma chave
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

    // Backend foi chamado para a nova leitura (segundo GET no total)
    expect(getListCallCount).toBe(2)
    // As 3 leituras compartilham a mesma Promise in-flight
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(1)

    // Backend responde um único 429 para o batch concorrente
    rejectGetList(err429)

    const [res1, res2, res3] = await Promise.all([call1, call2, call3])

    // Provar:
    // - Apenas 1 GET para o batch (total de 2 GETs no teste: 1 inicial + 1 do batch concorrente)
    expect(getListCallCount).toBe(2)
    expect(mockCollection.getList).toHaveBeenCalledTimes(2)

    // - Todas as chamadas retornam o mesmo valor válido anterior
    expect(res1).not.toBeNull()
    expect(res1?.accumulatedSetup).toBe(42)
    expect(res2).not.toBeNull()
    expect(res2?.accumulatedSetup).toBe(42)
    expect(res3).not.toBeNull()
    expect(res3?.accumulatedSetup).toBe(42)
    expect(res1?.applicationKey).toBe('app_c1')
    expect(res2?.applicationKey).toBe('app_c1')
    expect(res3?.applicationKey).toBe('app_c1')

    // - Nenhuma retorna null
    expect(res1).not.toBeNull()
    expect(res2).not.toBeNull()
    expect(res3).not.toBeNull()

    // - Nenhuma faz retry (permanece 2 GETs no total)
    expect(mockCollection.getList).toHaveBeenCalledTimes(2)

    // - In-flight limpo após o término do batch
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })

  it('CENÁRIO 3 — NOVA CONSULTA APÓS O 429: Recuperação e atualização de last-known-good', async () => {
    let getListCallCount = 0

    const err429 = new ClientResponseError({
      status: 429,
      response: {
        code: 429,
        message: 'Too Many Requests',
        data: {},
      },
    })

    const initialRecord = {
      id: 'rec_initial',
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
            appliedAt: '2026-03-20T10:00:00.000Z',
          } as PracticeSetupApplicationRecord,
        },
      },
    }

    const updatedRecord = {
      id: 'rec_updated',
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
            consistency: 90,
            uniformSetupDraw: 0.6,
            previousSetup: 0,
            sessionGain: 58,
            accumulatedSetup: 58,
            qualifyingBonusSeconds: 0.11,
            raceBonusSecondsPerLap: 0.055,
            appliedAt: '2026-03-20T10:30:00.000Z',
          } as PracticeSetupApplicationRecord,
        },
      },
    }

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        getListCallCount++
        if (getListCallCount === 1) {
          // Chamada 1: sucesso inicial
          return Promise.resolve({ items: [initialRecord] })
        }
        if (getListCallCount === 2) {
          // Chamada 2 (batch de 3): 429
          return Promise.reject(err429)
        }
        // Chamada 3 (recuperação): backend saudável com registro atualizado
        return Promise.resolve({ items: [updatedRecord] })
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // 1. Carrega resposta válida inicial
    const initRes = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )
    expect(initRes?.accumulatedSetup).toBe(42)
    expect(getListCallCount).toBe(1)

    // Limpar localStorage para testar puramente o estado em memória
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }

    // 2. Dispara batch concorrente que recebe 429
    const [b1, b2, b3] = await Promise.all([
      racePracticeSetupService.loadPersistedApplication(
        'career_audi',
        'season_2026',
        1,
        'TL1',
        'app_c1',
      ),
      racePracticeSetupService.loadPersistedApplication(
        'career_audi',
        'season_2026',
        1,
        'TL1',
        'app_c1',
      ),
      racePracticeSetupService.loadPersistedApplication(
        'career_audi',
        'season_2026',
        1,
        'TL1',
        'app_c1',
      ),
    ])

    // Provar batch concluído:
    expect(getListCallCount).toBe(2)
    expect(b1?.accumulatedSetup).toBe(42)
    expect(b2?.accumulatedSetup).toBe(42)
    expect(b3?.accumulatedSetup).toBe(42)

    // Provar:
    // - Confirmar que o Map in-flight não manteve a Promise anterior
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)

    // 3. Fazer nova leitura da mesma chave com backend novamente saudável
    const recoveryRes = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )

    // Provar:
    // - Nova consulta ao backend ocorre normalmente (3º GET ao todo)
    expect(getListCallCount).toBe(3)
    expect(mockCollection.getList).toHaveBeenCalledTimes(3)

    // - Resposta nova é retornada (não fica presa ao fallback anterior)
    expect(recoveryRes).not.toBeNull()
    expect(recoveryRes?.accumulatedSetup).toBe(58)
    expect(recoveryRes?.appliedAt).toBe('2026-03-20T10:30:00.000Z')

    // - Last-known-good é atualizado: se um 429 ocorrer agora, deve retornar 58, não 42
    mockCollection.getList.mockImplementationOnce(() => Promise.reject(err429))

    const subsequent429Res = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )
    expect(subsequent429Res).not.toBeNull()
    expect(subsequent429Res?.accumulatedSetup).toBe(58)
    expect(getListCallCount).toBe(4)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })
})
