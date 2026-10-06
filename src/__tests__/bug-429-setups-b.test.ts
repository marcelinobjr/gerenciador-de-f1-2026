import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'
import { racePracticeSetupService } from '@/services/racePracticeSetupService'

describe('BUG-429-SETUPS-B1: Fallback para HTTP 429 na leitura de session_setups', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    racePracticeSetupService.clearInFlightRequests()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  it('429 resolve com estado neutro (null / accumulatedSetup = 0)', async () => {
    const err429 = new ClientResponseError({
      status: 429,
      response: {
        code: 429,
        message: 'Too Many Requests',
        data: {},
      },
    })

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => Promise.reject(err429)),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'session_setups') {
        return mockCollection as any
      }
      return {} as any
    })

    // loadPersistedApplication não propaga 429 e retorna estado neutro (null)
    const result = await racePracticeSetupService.loadPersistedApplication(
      'career_audi',
      'season_2026',
      1,
      'TL1',
      'app_c1',
    )
    expect(result).toBeNull()

    // Efeito acumulado no carro resulta em accumulatedSetup = 0
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

  it('500 continua rejeitando', async () => {
    const err500 = new ClientResponseError({
      status: 500,
      response: {
        code: 500,
        message: 'Internal Server Error',
        data: {},
      },
    })

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => Promise.reject(err500)),
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
  })
})
