import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'
import { racePracticeSetupService } from '@/services/racePracticeSetupService'

describe('BUG-429-SETUPS-B2: Last-Known-Good Fallback em 429 para session_setups', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    racePracticeSetupService.clearInFlightRequests()
    racePracticeSetupService.clearLastKnownGood()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  it('B2.1 — valor válido → depois 429: primeira leitura retorna setup válido; segunda leitura recebe 429; esperado: segunda leitura retorna o valor válido anterior, não null, sem retry', async () => {
    let callCount = 0

    const err429 = new ClientResponseError({
      status: 429,
      response: {
        code: 429,
        message: 'Too Many Requests',
        data: {},
      },
    })

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
          },
        },
      },
    }

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // 1ª leitura: responde válido do backend
          return Promise.resolve({
            items: [validRecord],
          })
        }
        // 2ª leitura: backend retorna 429
        return Promise.reject(err429)
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // Primeira leitura: retorna setup válido do backend
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

    // Segunda leitura: backend retorna HTTP 429
    // Deve retornar o valor válido anterior (last-known-good), não null, sem retry
    const secondRead = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )
    expect(secondRead).not.toBeNull()
    expect(secondRead?.applicationKey).toBe('app_c1')
    expect(secondRead?.accumulatedSetup).toBe(42)
    // Apenas duas chamadas ao getList no total: nenhuma tentativa de retry / backoff
    expect(callCount).toBe(2)
  })

  it('B2.2 — 429 sem histórico: sem leitura válida anterior, backend retorna 429; esperado: retorna null (preserva B1)', async () => {
    const err429 = new ClientResponseError({
      status: 429,
      response: {
        code: 429,
        message: 'Too Many Requests',
        data: {},
      },
    })

    let callCount = 0
    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        callCount++
        return Promise.reject(err429)
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // Sem leitura válida prévia no cache last-known-good
    const result = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )
    expect(result).toBeNull()
    expect(callCount).toBe(1)

    // Verifica que getCarAccumulatedSetup também preserva comportamento neutro (accumulatedSetup = 0)
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
  })

  it('B2.3 — isolamento entre chaves: chave A tem valor válido; chave B recebe 429; esperado: B não recebe valor de A, B retorna null', async () => {
    let callCount = 0

    const err429 = new ClientResponseError({
      status: 429,
      response: {
        code: 429,
        message: 'Too Many Requests',
        data: {},
      },
    })

    // Record para Chave A (TL1)
    const validRecordA = {
      id: 'rec_setup_A',
      team_id: 'career_audi',
      season_id: 'season_2026',
      round: 1,
      session: 'tp1',
      driver_strategies: {
        practiceSetupApplications: {
          app_key_a: {
            applicationKey: 'app_key_a',
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
        },
      },
    }

    const mockCollection = {
      getList: vi.fn().mockImplementation((_page: number, _perPage: number, options: any) => {
        callCount++
        if (options.filter.includes('"tp1"')) {
          // Chave A: responde com sucesso
          return Promise.resolve({
            items: [validRecordA],
          })
        }
        if (options.filter.includes('"tp2"')) {
          // Chave B: responde 429
          return Promise.reject(err429)
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

    // 1. Chave A (TL1) é lida e obtém valor válido com sucesso
    const resA = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_key_a',
    )
    expect(resA).not.toBeNull()
    expect(resA?.applicationKey).toBe('app_key_a')
    expect(resA?.accumulatedSetup).toBe(42)

    // 2. Chave B (TL2) recebe 429
    // Chave B não possui histórico próprio de valor válido
    const resB = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL2',
      'app_key_b',
    )

    // B não deve receber o valor de A sob nenhuma circunstância
    expect(resB).toBeNull()
  })
})
