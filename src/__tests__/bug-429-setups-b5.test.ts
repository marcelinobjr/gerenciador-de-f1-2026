import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'
import {
  racePracticeSetupService,
  PracticeSetupApplicationRecord,
  buildPracticeSetupFactKey,
} from '@/services/racePracticeSetupService'

/**
 * BUG-429-SETUPS-B5 — RECUPERAÇÃO POSTERIOR NO FLUXO REAL DA /corrida
 *
 * Objetivo: PROVAR que, no fluxo integrado real da /corrida (WeekendV2Page),
 * um 429 transitório não deixa a aplicação presa no fallback quando o backend volta a responder.
 *
 * Cenário Integrado Real:
 * - Carro 1 e Carro 2;
 * - Leituras de TL1/TL2/TL3;
 * - Camada real de racePracticeSetupService (getCarAccumulatedSetup / loadPersistedApplication / getWeekendNormalState);
 * - Mesmas chaves canônicas usadas em produção:
 *   team_id::{careerId}::season_id::{seasonId}::round::{round}::session::{internalSession}
 * - Ciclo: Saudável (Passo A) -> 429 (Passo B) -> Recuperação Saudável (Passo C) -> Novo 429 (Passo D)
 * - Isolamento estrito entre Carro 1 e Carro 2, TL1/TL2/TL3, dedup in-flight e last-known-good.
 */

describe('BUG-429-SETUPS-B5: Recuperação Posterior no Fluxo Real da /corrida', () => {
  const careerId = 'career_audi_2026'
  const seasonId = 'season_2026'
  const round = 1
  const teamId = 'career_audi_2026'

  // Fábrica de records realistas para testes
  const createPracticeSetupRecord = (params: {
    session: 'TL1' | 'TL2' | 'TL3'
    carIndex: 1 | 2
    driverId: string
    accumulatedSetup: number
    gain: number
    timestamp: string
  }): PracticeSetupApplicationRecord => {
    const factKey = buildPracticeSetupFactKey({
      careerId,
      seasonId,
      round,
      session: params.session,
      teamId,
      carIndex: params.carIndex,
    })

    return {
      applicationKey: factKey,
      careerId,
      seasonId,
      round,
      session: params.session,
      teamId,
      carIndex: params.carIndex,
      driverId: params.driverId,
      configVersion: '1.0.0',
      plannedLaps: 15,
      completedLaps: 15,
      consistency: 85,
      uniformSetupDraw: 0.5,
      previousSetup: params.accumulatedSetup - params.gain,
      sessionGain: params.gain,
      accumulatedSetup: params.accumulatedSetup,
      qualifyingBonusSeconds: (params.accumulatedSetup / 100) * 0.2,
      raceBonusSecondsPerLap: (params.accumulatedSetup / 100) * 0.1,
      appliedAt: params.timestamp,
    }
  }

  const err429 = new ClientResponseError({
    status: 429,
    response: {
      code: 429,
      message: 'Too Many Requests',
      data: {},
    },
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    racePracticeSetupService.clearInFlightRequests()
    racePracticeSetupService.clearLastKnownGood()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  it('B5.1 — Fluxo Integrado Completo dos Dois Carros: Saudável → 429 → Recuperado → Novo 429', async () => {
    let getListCallsCount = 0

    // Estado do backend simulado:
    // Mapeamento: internalSession ('tp1'|'tp2'|'tp3') -> Map<applicationKey, PracticeSetupApplicationRecord> | 'THROW_429' | null
    type BackendSessionState = Record<string, PracticeSetupApplicationRecord> | 'THROW_429' | null
    const backendData: Record<string, BackendSessionState> = {
      tp1: null,
      tp2: null,
      tp3: null,
    }

    const mockCollection = {
      getList: vi.fn().mockImplementation((_page: number, _perPage: number, options: any) => {
        getListCallsCount++
        const filterStr: string = options?.filter || ''

        // Identifica qual sessão está sendo consultada pela query do PocketBase
        let targetSession = 'tp1'
        if (filterStr.includes('"tp3"')) targetSession = 'tp3'
        else if (filterStr.includes('"tp2"')) targetSession = 'tp2'
        else if (filterStr.includes('"tp1"')) targetSession = 'tp1'

        const stateForSession = backendData[targetSession]

        if (stateForSession === 'THROW_429') {
          return Promise.reject(err429)
        }

        if (stateForSession) {
          return Promise.resolve({
            items: [
              {
                id: `rec_${targetSession}`,
                team_id: careerId,
                season_id: seasonId,
                round,
                session: targetSession,
                driver_strategies: {
                  practiceSetupApplications: stateForSession,
                },
              },
            ],
          })
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

    // =========================================================================
    // PASSO A: BACKEND SAUDÁVEL (Primeira montagem na /corrida)
    // Setup inicial de TL1 concluído para Carro 1 (acerto 40) e Carro 2 (acerto 35)
    // =========================================================================
    const c1_tl1_initial = createPracticeSetupRecord({
      session: 'TL1',
      carIndex: 1,
      driverId: 'drv_hulkenberg',
      accumulatedSetup: 40,
      gain: 40,
      timestamp: '2026-03-20T10:00:00.000Z',
    })
    const c2_tl1_initial = createPracticeSetupRecord({
      session: 'TL1',
      carIndex: 2,
      driverId: 'drv_bortoleto',
      accumulatedSetup: 35,
      gain: 35,
      timestamp: '2026-03-20T10:00:00.000Z',
    })

    backendData['tp1'] = {
      [c1_tl1_initial.applicationKey]: c1_tl1_initial,
      [c2_tl1_initial.applicationKey]: c2_tl1_initial,
    }
    // tp2 e tp3 ainda não foram disputados (retornam itens vazios normalmente)
    backendData['tp2'] = null
    backendData['tp3'] = null

    // Simular a /corrida montando a tela com os 2 carros em paralelo:
    // SessionCarPreparationPanel (Carro 1) e SessionCarPreparationPanel (Carro 2)
    // chamam getCarAccumulatedSetup simultaneamente
    const [c1_stepA, c2_stepA] = await Promise.all([
      racePracticeSetupService.getCarAccumulatedSetup({
        careerId,
        seasonId,
        round,
        teamId,
        carIndex: 1,
        isSprint: false,
      }),
      racePracticeSetupService.getCarAccumulatedSetup({
        careerId,
        seasonId,
        round,
        teamId,
        carIndex: 2,
        isSprint: false,
      }),
    ])

    // Provar PASSO A:
    // - Carro 1 e Carro 2 obtêm seus respectivos setups apurados de TL1
    expect(c1_stepA.accumulatedSetup).toBe(40)
    expect(c1_stepA.lastCompletedSession).toBe('TL1')
    expect(c1_stepA.nextStep).toBe('TL2')

    expect(c2_stepA.accumulatedSetup).toBe(35)
    expect(c2_stepA.lastCompletedSession).toBe('TL1')
    expect(c2_stepA.nextStep).toBe('TL2')

    // - Dedup in-flight funcionou perfeitamente:
    // Ambos consultaram em paralelo ['tp3', 'tp2', 'tp1'].
    // Em vez de 6 GETs (3 sessões * 2 carros), exatamente 3 GETs foram feitos!
    expect(getListCallsCount).toBe(3)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)

    // Limpar localStorage para provar que a resiliência no Passo B depende do Last-Known-Good em memória
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }

    // =========================================================================
    // PASSO B: BACKEND RESPONDE 429
    // Segunda montagem/leitura: backend entra em rate limit (429) em todas as sessões
    // =========================================================================
    backendData['tp1'] = 'THROW_429'
    backendData['tp2'] = 'THROW_429'
    backendData['tp3'] = 'THROW_429'

    // Nova chamada paralela para ambos os carros na /corrida
    const [c1_stepB, c2_stepB] = await Promise.all([
      racePracticeSetupService.getCarAccumulatedSetup({
        careerId,
        seasonId,
        round,
        teamId,
        carIndex: 1,
        isSprint: false,
      }),
      racePracticeSetupService.getCarAccumulatedSetup({
        careerId,
        seasonId,
        round,
        teamId,
        carIndex: 2,
        isSprint: false,
      }),
    ])

    // Provar PASSO B:
    // - O fluxo não quebrou;
    // - Valores válidos anteriores (last-known-good) foram usados para C1 (40) e C2 (35);
    // - Sem retry imediato (3 GETs adicionais, 1 por sessão pelo dedup, total 6 GETs);
    expect(c1_stepB.accumulatedSetup).toBe(40)
    expect(c1_stepB.lastCompletedSession).toBe('TL1')

    expect(c2_stepB.accumulatedSetup).toBe(35)
    expect(c2_stepB.lastCompletedSession).toBe('TL1')

    expect(getListCallsCount).toBe(6) // 3 do Passo A + 3 do Passo B
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)

    // Limpar localStorage novamente para o próximo passo
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }

    // =========================================================================
    // PASSO C: BACKEND RECUPERA
    // Backend volta a responder normalmente.
    // O usuário disputou o TL2 e novos setups foram salvos no backend:
    // Carro 1 avançou para 65 (ganho +25) e Carro 2 avançou para 58 (ganho +23).
    // =========================================================================
    const c1_tl2_updated = createPracticeSetupRecord({
      session: 'TL2',
      carIndex: 1,
      driverId: 'drv_hulkenberg',
      accumulatedSetup: 65,
      gain: 25,
      timestamp: '2026-03-20T14:00:00.000Z',
    })
    const c2_tl2_updated = createPracticeSetupRecord({
      session: 'TL2',
      carIndex: 2,
      driverId: 'drv_bortoleto',
      accumulatedSetup: 58,
      gain: 23,
      timestamp: '2026-03-20T14:00:00.000Z',
    })

    // Backend restaurado:
    backendData['tp1'] = {
      [c1_tl1_initial.applicationKey]: c1_tl1_initial,
      [c2_tl1_initial.applicationKey]: c2_tl1_initial,
    }
    backendData['tp2'] = {
      [c1_tl2_updated.applicationKey]: c1_tl2_updated,
      [c2_tl2_updated.applicationKey]: c2_tl2_updated,
    }
    backendData['tp3'] = null // TL3 ainda não disputado

    // Terceira leitura: a /corrida faz nova consulta ao backend saudável
    const [c1_stepC, c2_stepC] = await Promise.all([
      racePracticeSetupService.getCarAccumulatedSetup({
        careerId,
        seasonId,
        round,
        teamId,
        carIndex: 1,
        isSprint: false,
      }),
      racePracticeSetupService.getCarAccumulatedSetup({
        careerId,
        seasonId,
        round,
        teamId,
        carIndex: 2,
        isSprint: false,
      }),
    ])

    // Provar PASSO C:
    // - Nova consulta REALMENTE aconteceu (novos GETs foram disparados);
    //   getCarAccumulatedSetup consulta TL3 (vazio) e encontra TL2 (com sucesso).
    //   Portanto dispara tp3 e tp2 (2 GETs deduplicados entre os dois carros).
    // - O valor novo substitui o last-known-good anterior;
    // - Carro 1 recebe 65 (TL2), Carro 2 recebe 58 (TL2);
    // - Aplicação NÃO ficou presa no cache antigo de 40 / 35 do TL1!
    expect(c1_stepC.accumulatedSetup).toBe(65)
    expect(c1_stepC.lastCompletedSession).toBe('TL2')
    expect(c1_stepC.nextStep).toBe('TL3')

    expect(c2_stepC.accumulatedSetup).toBe(58)
    expect(c2_stepC.lastCompletedSession).toBe('TL2')
    expect(c2_stepC.nextStep).toBe('TL3')

    expect(getListCallsCount).toBe(8) // 6 anteriores + 2 (tp3, tp2)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)

    // Limpar localStorage para testar puramente a evolução do last-known-good em memória
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }

    // =========================================================================
    // PASSO D: NOVO 429 APÓS RECUPERAÇÃO
    // Backend volta a sofrer rate limit (429).
    // Esperado: O fallback usa o valor NOVO (65 e 58 de TL2), NÃO o antigo (40 e 35 de TL1).
    // Prova definitiva de que o cache evolui e nunca regride!
    // =========================================================================
    backendData['tp1'] = 'THROW_429'
    backendData['tp2'] = 'THROW_429'
    backendData['tp3'] = 'THROW_429'

    const [c1_stepD, c2_stepD] = await Promise.all([
      racePracticeSetupService.getCarAccumulatedSetup({
        careerId,
        seasonId,
        round,
        teamId,
        carIndex: 1,
        isSprint: false,
      }),
      racePracticeSetupService.getCarAccumulatedSetup({
        careerId,
        seasonId,
        round,
        teamId,
        carIndex: 2,
        isSprint: false,
      }),
    ])

    // Provar PASSO D:
    // - Fallback sob o novo 429 entrega os valores atualizados do Passo C (65 e 58);
    // - Não regride para o valor inicial do Passo A (40 e 35);
    // - Sessão mais avançada reconhecida é TL2;
    expect(c1_stepD.accumulatedSetup).toBe(65)
    expect(c1_stepD.lastCompletedSession).toBe('TL2')

    expect(c2_stepD.accumulatedSetup).toBe(58)
    expect(c2_stepD.lastCompletedSession).toBe('TL2')

    // Dedup continuou ativo (1 GET por sessão testada)
    expect(getListCallsCount).toBe(11) // 8 anteriores + 3 no 429 (tp3, tp2, tp1)
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })

  it('B5.2 — Isolamento Entre Carros e Sessões: Chave de TL2 sem histórico resulta em neutro (null) sob 429 enquanto TL1 usa last-known-good', async () => {
    let getListCallsCount = 0

    // Carro 1 completou TL1 com 45%
    const c1_tl1 = createPracticeSetupRecord({
      session: 'TL1',
      carIndex: 1,
      driverId: 'drv_hulkenberg',
      accumulatedSetup: 45,
      gain: 45,
      timestamp: '2026-03-20T10:00:00.000Z',
    })

    const mockCollection = {
      getList: vi.fn().mockImplementation((_page: number, _perPage: number, options: any) => {
        getListCallsCount++
        const filterStr: string = options?.filter || ''

        // 1ª fase: TL1 responde válido
        if (filterStr.includes('"tp1"')) {
          return Promise.resolve({
            items: [
              {
                id: 'rec_tp1',
                team_id: careerId,
                season_id: seasonId,
                round,
                session: 'tp1',
                driver_strategies: {
                  practiceSetupApplications: {
                    [c1_tl1.applicationKey]: c1_tl1,
                  },
                },
              },
            ],
          })
        }

        // TL2 ou TL3 respondem 429 direto (nunca tiveram sucesso antes)
        if (filterStr.includes('"tp2"') || filterStr.includes('"tp3"')) {
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

    // 1. Popula last-known-good para TL1 do Carro 1
    const tl1Res = await racePracticeSetupService.loadPersistedApplication(
      careerId,
      seasonId,
      round,
      'TL1',
      c1_tl1.applicationKey,
    )
    expect(tl1Res?.accumulatedSetup).toBe(45)

    // 2. Tenta ler TL2 do Carro 1 (nunca teve resposta válida prévia) sob 429
    const factKeyTL2 = buildPracticeSetupFactKey({
      careerId,
      seasonId,
      round,
      session: 'TL2',
      teamId,
      carIndex: 1,
    })
    const tl2Res = await racePracticeSetupService.loadPersistedApplication(
      careerId,
      seasonId,
      round,
      'TL2',
      factKeyTL2,
    )

    // TL2 não foi contaminado pelo TL1: retorna null neutro
    expect(tl2Res).toBeNull()

    // 3. Tenta ler Carro 2 no TL1 (mesma sessão TL1, mas chave de carro diferente)
    const factKeyC2TL1 = buildPracticeSetupFactKey({
      careerId,
      seasonId,
      round,
      session: 'TL1',
      teamId,
      carIndex: 2,
    })
    const c2tl1Res = await racePracticeSetupService.loadPersistedApplication(
      careerId,
      seasonId,
      round,
      'TL1',
      factKeyC2TL1,
    )

    // Carro 2 não foi gravado no record de TL1: retorna null, não vaza Carro 1
    expect(c2tl1Res).toBeNull()
  })

  it('B5.3 — Recuperação em getWeekendNormalState: Reflete transição de status de TL1 para TL2 e READY_FOR_Q1 após recuperação', async () => {
    let getListCallsCount = 0

    // Carro 1 e Carro 2 completam TL1 (Passo 1), depois TL2 (Passo 2), depois TL3 (Passo 3)
    let currentPhase: 'INITIAL_HEALTHY' | 'DOWN_429' | 'RECOVERED_TL2' | 'DOWN_429_AGAIN' =
      'INITIAL_HEALTHY'

    const c1_tl1 = createPracticeSetupRecord({
      session: 'TL1',
      carIndex: 1,
      driverId: 'drv_hulkenberg',
      accumulatedSetup: 30,
      gain: 30,
      timestamp: '2026-03-20T10:00:00.000Z',
    })
    const c2_tl1 = createPracticeSetupRecord({
      session: 'TL1',
      carIndex: 2,
      driverId: 'drv_bortoleto',
      accumulatedSetup: 32,
      gain: 32,
      timestamp: '2026-03-20T10:00:00.000Z',
    })

    const c1_tl2 = createPracticeSetupRecord({
      session: 'TL2',
      carIndex: 1,
      driverId: 'drv_hulkenberg',
      accumulatedSetup: 55,
      gain: 25,
      timestamp: '2026-03-20T14:00:00.000Z',
    })
    const c2_tl2 = createPracticeSetupRecord({
      session: 'TL2',
      carIndex: 2,
      driverId: 'drv_bortoleto',
      accumulatedSetup: 57,
      gain: 25,
      timestamp: '2026-03-20T14:00:00.000Z',
    })

    const mockCollection = {
      getList: vi.fn().mockImplementation((_page: number, _perPage: number, options: any) => {
        getListCallsCount++
        const filter: string = options?.filter || ''

        if (currentPhase === 'DOWN_429' || currentPhase === 'DOWN_429_AGAIN') {
          return Promise.reject(err429)
        }

        if (currentPhase === 'INITIAL_HEALTHY') {
          if (filter.includes('"tp1"')) {
            return Promise.resolve({
              items: [
                {
                  id: 'rec_tp1',
                  team_id: careerId,
                  season_id: seasonId,
                  round,
                  session: 'tp1',
                  driver_strategies: {
                    practiceSetupApplications: {
                      [c1_tl1.applicationKey]: c1_tl1,
                      [c2_tl1.applicationKey]: c2_tl1,
                    },
                  },
                },
              ],
            })
          }
          return Promise.resolve({ items: [] })
        }

        if (currentPhase === 'RECOVERED_TL2') {
          if (filter.includes('"tp1"')) {
            return Promise.resolve({
              items: [
                {
                  id: 'rec_tp1',
                  team_id: careerId,
                  season_id: seasonId,
                  round,
                  session: 'tp1',
                  driver_strategies: {
                    practiceSetupApplications: {
                      [c1_tl1.applicationKey]: c1_tl1,
                      [c2_tl1.applicationKey]: c2_tl1,
                    },
                  },
                },
              ],
            })
          }
          if (filter.includes('"tp2"')) {
            return Promise.resolve({
              items: [
                {
                  id: 'rec_tp2',
                  team_id: careerId,
                  season_id: seasonId,
                  round,
                  session: 'tp2',
                  driver_strategies: {
                    practiceSetupApplications: {
                      [c1_tl2.applicationKey]: c1_tl2,
                      [c2_tl2.applicationKey]: c2_tl2,
                    },
                  },
                },
              ],
            })
          }
          return Promise.resolve({ items: [] })
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

    // 1. Passo Inicial Saudável: TL1 completado
    currentPhase = 'INITIAL_HEALTHY'
    const stateA = await racePracticeSetupService.getWeekendNormalState({
      careerId,
      seasonId,
      round,
      teamId,
    })
    expect(stateA.status).toBe('TL2')
    expect(stateA.lastCompletedSession).toBe('TL1')
    expect(stateA.carSetups[`${teamId}_c1`].accumulatedSetup).toBe(30)
    expect(stateA.carSetups[`${teamId}_c2`].accumulatedSetup).toBe(32)

    // 2. Passo 429: Backend cai em rate limit
    currentPhase = 'DOWN_429'
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
    const stateB = await racePracticeSetupService.getWeekendNormalState({
      careerId,
      seasonId,
      round,
      teamId,
    })
    // Last-known-good preserva status TL2 com TL1 concluído
    expect(stateB.status).toBe('TL2')
    expect(stateB.lastCompletedSession).toBe('TL1')
    expect(stateB.carSetups[`${teamId}_c1`].accumulatedSetup).toBe(30)
    expect(stateB.carSetups[`${teamId}_c2`].accumulatedSetup).toBe(32)

    // 3. Passo Recuperado: Backend volta com TL2 concluído
    currentPhase = 'RECOVERED_TL2'
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
    const stateC = await racePracticeSetupService.getWeekendNormalState({
      careerId,
      seasonId,
      round,
      teamId,
    })
    // Recuperação detecta TL2 concluído para ambos os carros, status avança para TL3!
    expect(stateC.status).toBe('TL3')
    expect(stateC.lastCompletedSession).toBe('TL2')
    expect(stateC.carSetups[`${teamId}_c1`].accumulatedSetup).toBe(55)
    expect(stateC.carSetups[`${teamId}_c2`].accumulatedSetup).toBe(57)

    // 4. Passo Novo 429 após Recuperação:
    currentPhase = 'DOWN_429_AGAIN'
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
    const stateD = await racePracticeSetupService.getWeekendNormalState({
      careerId,
      seasonId,
      round,
      teamId,
    })
    // O novo 429 preserva o estado recuperado (TL3 com TL2 concluído e 55/57%)
    expect(stateD.status).toBe('TL3')
    expect(stateD.lastCompletedSession).toBe('TL2')
    expect(stateD.carSetups[`${teamId}_c1`].accumulatedSetup).toBe(55)
    expect(stateD.carSetups[`${teamId}_c2`].accumulatedSetup).toBe(57)
  })

  it('B5.4 — Dedup In-Flight em Chamadas Simultâneas no Momento da Recuperação', async () => {
    let getListCallsCount = 0

    const c1_tl1 = createPracticeSetupRecord({
      session: 'TL1',
      carIndex: 1,
      driverId: 'drv_hulkenberg',
      accumulatedSetup: 48,
      gain: 48,
      timestamp: '2026-03-20T10:00:00.000Z',
    })

    const mockCollection = {
      getList: vi.fn().mockImplementation(() => {
        getListCallsCount++
        return Promise.resolve({
          items: [
            {
              id: 'rec_tp1',
              team_id: careerId,
              season_id: seasonId,
              round,
              session: 'tp1',
              driver_strategies: {
                practiceSetupApplications: {
                  [c1_tl1.applicationKey]: c1_tl1,
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

    // Disparar simultaneamente 5 leituras para a mesma chave canônica
    const promises = Array.from({ length: 5 }, () =>
      racePracticeSetupService.loadPersistedApplication(
        careerId,
        seasonId,
        round,
        'TL1',
        c1_tl1.applicationKey,
      ),
    )

    const results = await Promise.all(promises)

    // Exatamente 1 GET disparado para o backend (dedup in-flight)
    expect(getListCallsCount).toBe(1)
    results.forEach((res) => {
      expect(res?.accumulatedSetup).toBe(48)
    })
    expect(racePracticeSetupService.getInFlightRequestsCount()).toBe(0)
  })
})
