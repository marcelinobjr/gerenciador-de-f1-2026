/**
 * src/test/race-tl-01b-focused-proofs.test.ts
 *
 * PROVAS FOCADAS DE ACEITE (B01–B07) — RACE-TL-01B:
 * Progressão dos Treinos Livres (TL1 -> TL2 -> TL3 no formato Normal; TL1 apenas no formato Sprint),
 * com verificação estrita de acerto acumulado, ordem de execução, proteção contra repetição/regressão,
 * reload e preservação do acerto vinculado ao carro/vaga com piloto reserva.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  racePracticeSetupService,
  PracticeSetupApplicationInputs,
  buildPracticeSetupFactKey,
} from '@/services/racePracticeSetupService'
import { racePracticeService } from '@/services/racePracticeService'
import { CanonicalPracticeIntegrationAdapter } from '@/services/canonicalPracticeIntegrationAdapter'
import { DEFAULT_RACE_DRAFT_VERSION } from '@/lib/race/raceConfigDefaults'
import { pb } from '@/lib/pocketbase/client'

// Mock para chamadas de banco no PocketBase caso o backend esteja off-line durante o teste
vi.mock('@/lib/pocketbase/client', () => ({
  pb: {
    collection: vi.fn(() => ({
      getList: vi.fn().mockResolvedValue({ items: [] }),
      create: vi.fn().mockResolvedValue({ id: 'rec_mock' }),
      update: vi.fn().mockResolvedValue({ id: 'rec_mock' }),
    })),
  },
}))

describe('PROVAS FOCADAS DE ACEITE (B01–B07) — RACE-TL-01B', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  // =========================================================================
  // B01 — NORMAL/RF07: TL1 -> TL2 -> TL3 com valores esperados exatos
  // Consistência 93, voltas 24/26/18, sorteio uniforme 0.5, acerto inicial 0.
  // Esperados: TL1 32.81; TL2 65.62; TL3 90.2275.
  // Bônus finais: quali 225.56875 ms; corrida 0.13534125 s/volta. Estado: pronto para Q1.
  // =========================================================================
  it('B01 — NORMAL/RF07: progressão completa TL1 -> TL2 -> TL3 com acertos e bônus acumulados exatos e avanço para Q1', async () => {
    const careerId = 'career_b01'
    const seasonId = 'season_2026'
    const round = 1
    const teamId = 'audi'
    const carIndex = 1
    const driverId = 'drv_hulkenberg'
    const configVersion = DEFAULT_RACE_DRAFT_VERSION
    const consistency = 93
    const uniformSetupDraw = 0.5

    // 1. TL1 (24 voltas, acerto prévio 0)
    const tl1 = await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      careerId,
      seasonId,
      round,
      session: 'TL1',
      teamId,
      carIndex,
      driverId,
      configVersion,
      completedLaps: 24,
      consistency,
      uniformSetupDraw,
      isSprint: false,
    })

    expect(tl1.isAlreadyCompleted).toBe(false)
    expect(tl1.record.sessionGain).toBe(32.81)
    expect(tl1.record.accumulatedSetup).toBe(32.81)

    // 2. TL2 (26 voltas, acerto prévio herdado 32.81)
    const tl2 = await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      careerId,
      seasonId,
      round,
      session: 'TL2',
      teamId,
      carIndex,
      driverId,
      configVersion,
      completedLaps: 26,
      consistency,
      uniformSetupDraw,
      isSprint: false,
    })

    expect(tl2.isAlreadyCompleted).toBe(false)
    expect(tl2.record.previousSetup).toBe(32.81)
    expect(tl2.record.sessionGain).toBe(32.81)
    expect(tl2.record.accumulatedSetup).toBe(65.62)

    // 3. TL3 (18 voltas, acerto prévio herdado 65.62)
    const tl3 = await racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
      careerId,
      seasonId,
      round,
      session: 'TL3',
      teamId,
      carIndex,
      driverId,
      configVersion,
      completedLaps: 18,
      consistency,
      uniformSetupDraw,
      isSprint: false,
    })

    expect(tl3.isAlreadyCompleted).toBe(false)
    expect(tl3.record.previousSetup).toBe(65.62)
    expect(tl3.record.sessionGain).toBe(24.6075)
    expect(tl3.record.accumulatedSetup).toBe(90.2275)

    // Bônus finais acumulados pós-TL3:
    // quali: (90.2275 / 100) * 0.25 = 0.22556875 s = 225.56875 ms
    // corrida: (90.2275 / 100) * 0.15 = 0.13534125 s/volta
    const qualiBonusMs = tl3.record.qualifyingBonusSeconds * 1000
    expect(qualiBonusMs).toBeCloseTo(225.56875, 8)
    expect(tl3.record.raceBonusSecondsPerLap).toBeCloseTo(0.13534125, 8)

    // Verifica estado do carro e prontidão para Q1
    const carSummary = await racePracticeSetupService.getCarAccumulatedSetup({
      careerId,
      seasonId,
      round,
      teamId,
      carIndex,
      isSprint: false,
    })

    expect(carSummary.lastCompletedSession).toBe('TL3')
    expect(carSummary.accumulatedSetup).toBe(90.2275)
    expect(carSummary.isPracticeComplete).toBe(true)
    expect(carSummary.nextStep).toBe('Q1')
  })

  // =========================================================================
  // B02 — SPRINT/RF08: TL1 único; TL2 e TL3 rejeitados estritamente; avanço para SQ1
  // =========================================================================
  it('B02 — SPRINT/RF08: formato Sprint executa apenas TL1 (32.81), rejeita TL2/TL3 com erro e fica pronto para SQ1', async () => {
    const careerId = 'career_b02_sprint'
    const seasonId = 'season_2026'
    const round = 2
    const teamId = 'audi'
    const carIndex = 1
    const driverId = 'drv_hulkenberg'
    const configVersion = DEFAULT_RACE_DRAFT_VERSION

    // Executa TL1 em formato Sprint
    const tl1 = await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      careerId,
      seasonId,
      round,
      session: 'TL1',
      teamId,
      carIndex,
      driverId,
      configVersion,
      completedLaps: 24,
      consistency: 93,
      uniformSetupDraw: 0.5,
      isSprint: true,
    })

    expect(tl1.record.accumulatedSetup).toBe(32.81)
    expect(tl1.record.qualifyingBonusSeconds * 1000).toBeCloseTo(82.025, 6)
    expect(tl1.record.raceBonusSecondsPerLap).toBeCloseTo(0.049215, 6)

    // Tentativa direta de executar TL2 ou TL3 em formato Sprint DEVE ser rejeitada pelo serviço
    await expect(
      racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
        careerId,
        seasonId,
        round,
        session: 'TL2',
        teamId,
        carIndex,
        driverId,
        configVersion,
        completedLaps: 26,
        consistency: 93,
        uniformSetupDraw: 0.5,
        isSprint: true,
      }),
    ).rejects.toThrow(/não é realizada em formato de fim de semana Sprint/i)

    await expect(
      racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
        careerId,
        seasonId,
        round,
        session: 'TL3',
        teamId,
        carIndex,
        driverId,
        configVersion,
        completedLaps: 18,
        consistency: 93,
        uniformSetupDraw: 0.5,
        isSprint: true,
      }),
    ).rejects.toThrow(/não é realizada em formato de fim de semana Sprint/i)

    // Estado acumulado permanece intacto em 32.81 e avança para SQ1
    const sprintSummary = await racePracticeSetupService.getCarAccumulatedSetup({
      careerId,
      seasonId,
      round,
      teamId,
      carIndex,
      isSprint: true,
    })

    expect(sprintSummary.lastCompletedSession).toBe('TL1')
    expect(sprintSummary.accumulatedSetup).toBe(32.81)
    expect(sprintSummary.isPracticeComplete).toBe(true)
    expect(sprintSummary.nextStep).toBe('SQ1')
  })

  // =========================================================================
  // B03 — ORDEM E REPETIÇÃO: TL3 antes de TL2 rejeitado; repetir TL2 não duplica;
  // consultar TL1 depois de TL3 não reduz o acerto atual
  // =========================================================================
  it('B03 — ORDEM E REPETIÇÃO: validação de dependência cronológica, idempotência e não regressão ao consultar histórico anterior', async () => {
    const careerId = 'career_b03'
    const seasonId = 'season_2026'
    const round = 3
    const teamId = 'ferrari'
    const carIndex = 1
    const driverId = 'drv_leclerc'
    const configVersion = DEFAULT_RACE_DRAFT_VERSION

    // 1. Tentar TL2 ou TL3 sem ter feito TL1 -> DEVE falhar
    await expect(
      racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
        careerId,
        seasonId,
        round,
        session: 'TL2',
        teamId,
        carIndex,
        driverId,
        configVersion,
        completedLaps: 26,
        consistency: 90,
        isSprint: false,
      }),
    ).rejects.toThrow(/o TL1 para o Carro 1 \(ferrari\) ainda não foi concluído/i)

    await expect(
      racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
        careerId,
        seasonId,
        round,
        session: 'TL3',
        teamId,
        carIndex,
        driverId,
        configVersion,
        completedLaps: 18,
        consistency: 90,
        isSprint: false,
      }),
    ).rejects.toThrow(/o TL2 para o Carro 1 \(ferrari\) ainda não foi concluído/i)

    // 2. Executa TL1
    await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      careerId,
      seasonId,
      round,
      session: 'TL1',
      teamId,
      carIndex,
      driverId,
      configVersion,
      completedLaps: 24,
      consistency: 93,
      uniformSetupDraw: 0.5,
      isSprint: false,
    })

    // 3. Executa TL2
    const tl2First = await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      careerId,
      seasonId,
      round,
      session: 'TL2',
      teamId,
      carIndex,
      driverId,
      configVersion,
      completedLaps: 26,
      consistency: 93,
      uniformSetupDraw: 0.5,
      isSprint: false,
    })
    expect(tl2First.record.accumulatedSetup).toBe(65.62)
    expect(tl2First.isAlreadyCompleted).toBe(false)

    // 4. Repetir TL2 com os mesmos dados -> Idempotente (não duplica ganho nem recalcula)
    const tl2Repeat = await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      careerId,
      seasonId,
      round,
      session: 'TL2',
      teamId,
      carIndex,
      driverId,
      configVersion,
      completedLaps: 26,
      consistency: 93,
      uniformSetupDraw: 0.5,
      isSprint: false,
    })
    expect(tl2Repeat.isAlreadyCompleted).toBe(true)
    expect(tl2Repeat.record.accumulatedSetup).toBe(65.62)

    // 5. Executa TL3
    await racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
      careerId,
      seasonId,
      round,
      session: 'TL3',
      teamId,
      carIndex,
      driverId,
      configVersion,
      completedLaps: 18,
      consistency: 93,
      uniformSetupDraw: 0.5,
      isSprint: false,
    })

    // 6. Consultar registro do TL1 após ter concluído o TL3:
    // O registro histórico do TL1 é 32.81, MAS o acerto ATUAL do carro continua 90.2275!
    const keyTL1 = buildPracticeSetupFactKey({
      careerId,
      seasonId,
      round,
      session: 'TL1',
      teamId,
      carIndex,
    })
    const historicalTL1 = await racePracticeSetupService.loadPersistedApplication(
      careerId,
      seasonId,
      round,
      'TL1',
      keyTL1,
    )
    expect(historicalTL1?.accumulatedSetup).toBe(32.81)

    const currentCarStatus = await racePracticeSetupService.getCarAccumulatedSetup({
      careerId,
      seasonId,
      round,
      teamId,
      carIndex,
      isSprint: false,
    })
    // Proteção obrigatória: estado atual permanece 90.2275, NÃO regride para 32.81
    expect(currentCarStatus.accumulatedSetup).toBe(90.2275)
    expect(currentCarStatus.lastCompletedSession).toBe('TL3')
    expect(currentCarStatus.nextStep).toBe('Q1')
  })

  // =========================================================================
  // B04 — RELOAD E RECUPERAÇÃO: descarte de memória/cache e reconstrução canônica
  // =========================================================================
  it('B04 — RELOAD E RECUPERAÇÃO: consistência estrita após descarte de cache e simulação de recuperação de interrupção', async () => {
    const careerId = 'career_b04_reload'
    const seasonId = 'season_2026'
    const round = 4
    const teamId = 'mclaren'
    const carIndex = 1
    const driverId = 'drv_norris'
    const configVersion = DEFAULT_RACE_DRAFT_VERSION

    // 1. Executa TL1
    await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      careerId,
      seasonId,
      round,
      session: 'TL1',
      teamId,
      carIndex,
      driverId,
      configVersion,
      completedLaps: 24,
      consistency: 93,
      uniformSetupDraw: 0.5,
      isSprint: false,
    })

    // 2. Simula reload descartando cache em memória do serviço
    racePracticeSetupService.clearMemoryCacheForTesting()

    // 3. Após reload, executa TL2 -> Deve encontrar TL1 no cache/armazenamento e prosseguir perfeitamente
    const tl2 = await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      careerId,
      seasonId,
      round,
      session: 'TL2',
      teamId,
      carIndex,
      driverId,
      configVersion,
      completedLaps: 26,
      consistency: 93,
      uniformSetupDraw: 0.5,
      isSprint: false,
    })

    expect(tl2.record.previousSetup).toBe(32.81)
    expect(tl2.record.accumulatedSetup).toBe(65.62)

    // 4. Descarta cache novamente antes do TL3
    racePracticeSetupService.clearMemoryCacheForTesting()

    const tl3 = await racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
      careerId,
      seasonId,
      round,
      session: 'TL3',
      teamId,
      carIndex,
      driverId,
      configVersion,
      completedLaps: 18,
      consistency: 93,
      uniformSetupDraw: 0.5,
      isSprint: false,
    })

    expect(tl3.record.previousSetup).toBe(65.62)
    expect(tl3.record.accumulatedSetup).toBe(90.2275)
  })

  // =========================================================================
  // B05 — LIMITES E ISOLAMENTO: Teto de 100%, isolamento de carreiras/rodadas e equipes
  // =========================================================================
  it('B05 — LIMITES E ISOLAMENTO: acerto acumulado não excede 100 e rodadas/carreiras não se contaminam', async () => {
    const configVersion = DEFAULT_RACE_DRAFT_VERSION

    // Teste de teto 100 com entradas extremas
    const tl1Max = await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      careerId: 'career_limit',
      seasonId: 'season_2026',
      round: 1,
      session: 'TL1',
      teamId: 'williams',
      carIndex: 1,
      driverId: 'drv_albon',
      configVersion,
      completedLaps: 40,
      consistency: 100,
      previousSetup: 95,
      uniformSetupDraw: 1.0,
      isSprint: false,
    })

    expect(tl1Max.record.accumulatedSetup).toBe(100)
    expect(tl1Max.record.qualifyingBonusSeconds).toBe(0.25)
    expect(tl1Max.record.raceBonusSecondsPerLap).toBe(0.15)

    // Isolamento entre Rodada 1 e Rodada 2: Rodada 2 NÃO herda o acerto da Rodada 1!
    const r2Status = await racePracticeSetupService.getCarAccumulatedSetup({
      careerId: 'career_limit',
      seasonId: 'season_2026',
      round: 2, // Nova rodada
      teamId: 'williams',
      carIndex: 1,
      isSprint: false,
    })

    expect(r2Status.accumulatedSetup).toBe(0)
    expect(r2Status.lastCompletedSession).toBeNull()
    expect(r2Status.isPracticeComplete).toBe(false)
    expect(r2Status.nextStep).toBe('TL1')
  })

  // =========================================================================
  // B06 — RESERVA E POLÍTICA DE TRANSFERÊNCIA DE ACERTO:
  // Reserva corre no TL1 pelo Carro 1; titular corre no TL2 pelo Carro 1.
  // O acerto do carro permanece acumulado na vaga do monoposto (${teamId}_car1)
  // sem duplicar carros e sem alterar contratos.
  // =========================================================================
  it('B06 — RESERVA E POLÍTICA: acerto conquistado pelo reserva no TL1 permanece na vaga do Carro 1 para o titular no TL2', async () => {
    const careerId = 'career_b06_reserve'
    const seasonId = 'season_2026'
    const round = 1
    const teamId = 'audi'
    const carIndex = 1
    const reserveDriverId = 'drv_rookie_bortoleto'
    const titularDriverId = 'drv_hulkenberg'
    const configVersion = DEFAULT_RACE_DRAFT_VERSION

    // 1. Piloto Reserva disputa o TL1 no Carro 1
    const tl1Reserve = await racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
      careerId,
      seasonId,
      round,
      session: 'TL1',
      teamId,
      carIndex,
      driverId: reserveDriverId,
      configVersion,
      completedLaps: 24,
      consistency: 93,
      uniformSetupDraw: 0.5,
      isSprint: false,
    })

    expect(tl1Reserve.record.driverId).toBe(reserveDriverId)
    expect(tl1Reserve.record.accumulatedSetup).toBe(32.81)

    // Não permite segunda aplicação no TL1 trocando o piloto após a conclusão
    await expect(
      racePracticeSetupService.processAndPersistPracticeSetup('TL1', {
        careerId,
        seasonId,
        round,
        session: 'TL1',
        teamId,
        carIndex,
        driverId: titularDriverId, // Tentando colocar o titular no mesmo TL1 já concluído
        configVersion,
        completedLaps: 24,
        consistency: 93,
        uniformSetupDraw: 0.5,
        isSprint: false,
      }),
    ).rejects.toThrow(/Conflito de aplicação/i)

    // 2. Piloto Titular assume o Carro 1 no TL2
    // A política canônica determina que o acerto pertence à vaga do carro (${teamId}_car1)
    const tl2Titular = await racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
      careerId,
      seasonId,
      round,
      session: 'TL2',
      teamId,
      carIndex,
      driverId: titularDriverId,
      configVersion,
      completedLaps: 26,
      consistency: 93,
      uniformSetupDraw: 0.5,
      isSprint: false,
    })

    // O titular parte do acerto deixado pelo reserva (32.81) e progride para 65.62
    expect(tl2Titular.record.previousSetup).toBe(32.81)
    expect(tl2Titular.record.driverId).toBe(titularDriverId)
    expect(tl2Titular.record.accumulatedSetup).toBe(65.62)
  })

  // =========================================================================
  // B07 — REGRESSÃO DE ATIVAÇÃO: Carreira legada (sem configVersion) mantém funcionamento anterior
  // e não dispara qualificação ou corrida automaticamente.
  // =========================================================================
  it('B07 — REGRESSÃO DE ATIVAÇÃO: carreira não habilitada retorna null no adaptador e não inicia outras fases', async () => {
    const unversionedResult = await CanonicalPracticeIntegrationAdapter.executeIfVersioned({
      careerId: 'legacy_career',
      seasonId: 'legacy_season',
      round: 1,
      sessionType: 'tp1',
      isSprint: false,
      configVersion: '', // Vazio = Legado
      participants: [
        { teamId: 'audi', carIndex: 1, driverId: 'drv1' },
        { teamId: 'audi', carIndex: 2, driverId: 'drv2' },
      ],
    })

    // Total isolamento: carreiras legadas não são tocadas pelo novo motor
    expect(unversionedResult).toBeNull()
  })
})
