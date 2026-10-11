import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveSessionVisualState } from '../services/weekendScheduleConfig'
import { canonicalQualifyingFinalGridBackendService } from '../services/canonicalQualifyingFinalGridBackendService'
import { canonicalQualifyingPersistenceService } from '../services/canonicalQualifyingPersistenceService'
import pb from '../lib/pocketbase/client'

describe('BUG-RACE-ENTRY-01A Focal Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('(C) Estado visual honesto: Corrida sem estado persistido', () => {
    it('retorna "available" (não "active") quando a corrida principal está selecionada e desbloqueada mas não tem estado persistido', () => {
      const visualState = resolveSessionVisualState({
        sessionId: 'race',
        activeSessionId: 'race',
        completedSessions: ['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3'],
        hasPersistedState: false,
        isSessionRunning: false,
        isSessionPaused: false,
      })
      expect(visualState).toBe('available')
      expect(visualState).not.toBe('active')
    })

    it('retorna "active" quando há estado persistido de corrida ou quando está em execução', () => {
      const runningState = resolveSessionVisualState({
        sessionId: 'race',
        activeSessionId: 'race',
        completedSessions: ['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3'],
        hasPersistedState: false,
        isSessionRunning: true,
      })
      expect(runningState).toBe('active')

      const persistedState = resolveSessionVisualState({
        sessionId: 'race',
        activeSessionId: 'race',
        completedSessions: ['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3'],
        hasPersistedState: true,
        isSessionRunning: false,
      })
      expect(persistedState).toBe('active')
    })

    it('retorna "locked" se q3/qualifying não estiverem concluídas', () => {
      const lockedState = resolveSessionVisualState({
        sessionId: 'race',
        activeSessionId: 'race',
        completedSessions: ['tp1', 'tp2'],
        hasPersistedState: false,
      })
      expect(lockedState).toBe('locked')
    })
  })

  describe('(A) e (B) Resiliência de chaves canônicas e fallback de IDs', () => {
    it('recoverFinalGridFromStageResults monta filtro resiliente com careerId e seasonId', async () => {
      const mockCollection = {
        getFullList: vi.fn().mockResolvedValue([
          {
            stage: 'q1',
            payload: {
              stageId: 'q1',
              results: [{ driverId: 'd1', bestLapMs: 80000, position: 1 }],
              advancingDriverIds: ['d1'],
              eliminatedDriverIds: [],
            },
          },
          {
            stage: 'q2',
            payload: {
              stageId: 'q2',
              results: [{ driverId: 'd1', bestLapMs: 79000, position: 1 }],
              advancingDriverIds: ['d1'],
              eliminatedDriverIds: [],
            },
          },
          {
            stage: 'q3',
            payload: {
              stageId: 'q3',
              results: [{ driverId: 'd1', bestLapMs: 78000, position: 1 }],
              advancingDriverIds: ['d1'],
              eliminatedDriverIds: [],
            },
          },
        ]),
        create: vi.fn().mockResolvedValue({ id: 'created_grid_1' }),
      }

      const originalCollection = pb?.collection
      if (pb) {
        ;(pb as any).collection = vi.fn().mockReturnValue(mockCollection)
      }

      try {
        const recovered =
          await canonicalQualifyingFinalGridBackendService.recoverFinalGridFromStageResults({
            careerId: 'z36hmcbqa75kt7k',
            seasonId: '31b0p9k5ygw2sc8',
            season: 2026,
            round: 1,
          })

        expect(mockCollection.getFullList).toHaveBeenCalled()
        const filterUsed = mockCollection.getFullList.mock.calls[0][0].filter
        // Deve conter ambos os IDs no filtro resiliente
        expect(filterUsed).toContain('career_id = "z36hmcbqa75kt7k"')
        expect(filterUsed).toContain('career_id = "31b0p9k5ygw2sc8"')
        expect(filterUsed).toContain('round = 1')
        expect(recovered).not.toBeNull()
        expect(recovered?.finalGrid).toHaveLength(1)
      } finally {
        if (pb) {
          ;(pb as any).collection = originalCollection
        }
      }
    })

    it('readFinalGridPreferred propaga fallbackSeasonId e seasonYear corretamente', async () => {
      const spyReadFinalGrid = vi
        .spyOn(canonicalQualifyingFinalGridBackendService, 'readFinalGrid')
        .mockResolvedValueOnce({
          seasonId: 'z36hmcbqa75kt7k',
          round: 1,
          finalGrid: [
            {
              gridPosition: 1,
              driverId: 'd1',
              driverName: 'Pilot 1',
              teamId: 't1',
              teamName: 'Audi',
              teamColor: '#E10600',
              isPlayer: true,
              eliminationStage: 'Q3',
              bestLapSec: 78.0,
              bestLapTime: '1:18.000',
              bestLapCompound: 'macio',
            },
          ],
          poleDriverId: 'd1',
          poleDriverName: 'Pilot 1',
          poleLapTime: '1:18.000',
          q1Result: {} as any,
          q2Result: {} as any,
          q3Result: {} as any,
          completedAt: new Date().toISOString(),
        })

      const outcome = await canonicalQualifyingPersistenceService.readFinalGridPreferred(
        'z36hmcbqa75kt7k',
        1,
        {
          fallbackSeasonId: '31b0p9k5ygw2sc8',
          seasonYear: 2026,
        },
      )

      expect(spyReadFinalGrid).toHaveBeenCalledWith({
        careerId: 'z36hmcbqa75kt7k',
        season: 2026,
        round: 1,
        seasonId: '31b0p9k5ygw2sc8',
      })
      expect(outcome.data?.finalGrid).toHaveLength(1)
      spyReadFinalGrid.mockRestore()
    })
  })
})
