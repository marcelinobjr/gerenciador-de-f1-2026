import { describe, it, expect, beforeEach, vi } from 'vitest'
import { practiceSessionService } from '@/services/practiceSessionService'
import { createInitialPracticePreparation } from '@/services/practicePreparationService'
import pb from '@/lib/pocketbase/client'
import type { PracticeSessionRecordState } from '@/types/practice-session'

describe('Session Setups - Notes Overflow & Backward Compatibility', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('salvar um practiceSessionState grande (com 24 carros e tyreKnowledge) não envia notas serializadas acima de 5000 chars nem polui notes', async () => {
    const prep = createInitialPracticePreparation({
      careerId: 'j1tbbhpi6xailwg',
      seasonId: 'season_2026',
      round: 2,
      sessionType: 'tp2',
      driver1Id: 'driver_hulkenberg',
      driver2Id: 'driver_bortoleto',
    })

    const sessionState = practiceSessionService.createInitialSessionState({
      careerId: 'j1tbbhpi6xailwg',
      seasonId: 'season_2026',
      round: 2,
      sessionType: 'tp2',
      preparation: prep,
      driverNames: {
        car1: 'Nico Hülkenberg',
        driver1Id: 'driver_hulkenberg',
        car2: 'Gabriel Bortoleto',
        driver2Id: 'driver_bortoleto',
      },
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
    })

    // Adiciona histórico de voltas e eventos para inflar ainda mais o estado
    for (let i = 1; i <= 20; i++) {
      sessionState.radioFeed.push({
        id: `feed_${i}`,
        second: i * 60,
        type: 'info',
        message: `Piloto completou volta de simulação número ${i} com telemetria detalhada de pneus e asas.`,
        timestamp: '14:20',
      })
    }

    const stateSerialized = JSON.stringify(sessionState)
    // O estado do treino é naturalmente bem maior que 5.000 caracteres (20-50KB+)
    expect(stateSerialized.length).toBeGreaterThan(5000)

    let createdPayload: any = null
    let updatedPayload: any = null

    // Mock do pb.collection('session_setups')
    const mockGetList = vi.fn().mockResolvedValue({ items: [] })
    const mockCreate = vi.fn().mockImplementation((payload) => {
      createdPayload = payload
      return Promise.resolve({ id: 'setup_rec_123', ...payload })
    })
    const mockUpdate = vi.fn().mockImplementation((id, payload) => {
      updatedPayload = payload
      return Promise.resolve({ id, ...payload })
    })

    const collectionSpy = vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'session_setups') {
        return {
          getList: mockGetList,
          create: mockCreate,
          update: mockUpdate,
        } as any
      }
      return (pb as any).collection(name)
    })

    // 1. Testar CREATE (novo registro no PocketBase)
    await practiceSessionService.saveSessionState(sessionState)

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(createdPayload).toBeDefined()
    expect(createdPayload.team_id).toBe('j1tbbhpi6xailwg')
    expect(createdPayload.driver_strategies).toBeDefined()
    expect(createdPayload.driver_strategies.practiceSessionState).toBeDefined()

    // Validação crítica da restrição de 5000 caracteres:
    // Se o campo notes existir no payload, seu comprimento NÃO PODE exceder 5000 caracteres!
    if (createdPayload.notes !== undefined && createdPayload.notes !== null) {
      expect(typeof createdPayload.notes).toBe('string')
      expect(createdPayload.notes.length).toBeLessThanOrEqual(5000)
    } else {
      // notes foi removido do payload de create para evitar duplicação redundante
      expect(createdPayload.notes).toBeUndefined()
    }

    // 2. Testar UPDATE (atualização de registro existente no PocketBase)
    mockGetList.mockResolvedValueOnce({
      items: [
        {
          id: 'setup_rec_123',
          team_id: 'j1tbbhpi6xailwg',
          season_id: 'season_2026',
          round: 2,
          session: 'tp2',
          driver_strategies: { existingKey: 'abc' },
        },
      ],
    })

    sessionState.elapsedTimeSec = 300
    await practiceSessionService.saveSessionState(sessionState)

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(updatedPayload).toBeDefined()
    expect(updatedPayload.driver_strategies.practiceSessionState.elapsedTimeSec).toBe(300)

    if (updatedPayload.notes !== undefined && updatedPayload.notes !== null) {
      expect(typeof updatedPayload.notes).toBe('string')
      expect(updatedPayload.notes.length).toBeLessThanOrEqual(5000)
    } else {
      expect(updatedPayload.notes).toBeUndefined()
    }

    collectionSpy.mockRestore()
  })

  it('carregar registro legado salvo apenas com estado em notes continua funcionando com retrocompatibilidade (fallback)', async () => {
    const prep = createInitialPracticePreparation({
      careerId: 'legacy_career',
      seasonId: 'legacy_season',
      round: 1,
      sessionType: 'tp1',
    })

    const legacyState = practiceSessionService.createInitialSessionState({
      careerId: 'legacy_career',
      seasonId: 'legacy_season',
      round: 1,
      sessionType: 'tp1',
      preparation: prep,
    })
    legacyState.elapsedTimeSec = 888

    // Registro legado onde driver_strategies NÃO tem practiceSessionState,
    // mas notes continha o JSON serializado
    const legacyRecordItem = {
      id: 'legacy_rec_001',
      team_id: 'legacy_career',
      season_id: 'legacy_season',
      round: 1,
      session: 'tp1',
      driver_strategies: {}, // sem practiceSessionState aqui
      notes: JSON.stringify({ practiceSessionState: legacyState }),
    }

    const mockGetList = vi.fn().mockResolvedValue({
      items: [legacyRecordItem],
    })

    const collectionSpy = vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'session_setups') {
        return {
          getList: mockGetList,
        } as any
      }
      return (pb as any).collection(name)
    })

    const result = await practiceSessionService.openOrResumePracticeSession({
      careerId: 'legacy_career',
      seasonId: 'legacy_season',
      round: 1,
      sessionType: 'tp1',
      preparation: prep,
    })

    expect(result.isResumed).toBe(true)
    expect(result.session.elapsedTimeSec).toBe(888)
    expect(result.session.careerId).toBe('legacy_career')

    collectionSpy.mockRestore()
  })
})
