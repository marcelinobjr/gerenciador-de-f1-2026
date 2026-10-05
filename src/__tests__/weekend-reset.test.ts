import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  resetWeekendForRound,
  readStoredCompletedSessions,
  writeStoredCompletedSessions,
} from '@/services/weekendProgressionService'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { canonicalWeekendSlotPersistenceService } from '@/services/canonicalWeekendSlotPersistenceService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { resolveInitialRaceSession, getRaceWeekendPipeline } from '@/services/weekendScheduleConfig'

describe('Suíte de Reset do Fim de Semana (weekend-reset)', () => {
  const CAREER_ID = 'career_test_apex_01'
  const SEASON_ID = 'season_2026_test'
  const TARGET_ROUND = 7 // Rodada do Canadá (Sprint)
  const PREVIOUS_ROUND = 6

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // (a) Reset limpa estados/resultados das fases e volta a Pendente
  it('(a) reset limpa estados e resultados de todas as fases da rodada alvo e volta a Pendente', () => {
    // 1. Simular dados preenchidos da rodada alvo
    writeStoredCompletedSessions(SEASON_ID, TARGET_ROUND, ['tp1', 'sq1', 'sq2'])

    // Qualificação estados e resultados
    canonicalQualifyingPersistenceService.saveStageState(SEASON_ID, TARGET_ROUND, {
      stageId: 'sq2',
      status: 'completed',
      sessionDurationSec: 600,
      timeRemainingSec: 0,
      elapsedTimeSec: 600,
      simSpeed: 1,
      cars: {} as any,
      leaderboard: [],
      lapHistory: {},
      radioFeed: [],
      parcFermeActive: false,
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq2',
      seasonId: SEASON_ID,
      round: TARGET_ROUND,
      completedAt: new Date().toISOString(),
      entries: [],
      advancingDriverIds: ['drv_1', 'drv_2'],
      eliminatedDriverIds: [],
    })

    canonicalQualifyingPersistenceService.saveCompleteQualifyingResult({
      seasonId: SEASON_ID,
      round: TARGET_ROUND,
      completedAt: new Date().toISOString(),
      poleDriverId: 'drv_1',
      poleDriverName: 'Pole Man',
      poleLapTime: '1:12.000',
      q1Result: {} as any,
      q2Result: {} as any,
      q3Result: {} as any,
      finalGrid: [],
    })

    canonicalQualifyingPersistenceService.setParcFermeActive(SEASON_ID, TARGET_ROUND, true)

    // Pneus
    localStorage.setItem(
      `apex_gp_tires_${SEASON_ID}_r${TARGET_ROUND}`,
      JSON.stringify({ used: true }),
    )

    // Treinos e slots
    localStorage.setItem(
      `apex_practice_session_${CAREER_ID}_${SEASON_ID}_${TARGET_ROUND}_tp1`,
      JSON.stringify({ active: true }),
    )
    localStorage.setItem(
      `apex_practice_prep_${CAREER_ID}_${SEASON_ID}_${TARGET_ROUND}_tp1`,
      JSON.stringify({ prep: true }),
    )
    localStorage.setItem(
      `apex_practice_setup_${CAREER_ID}_${SEASON_ID}_r${TARGET_ROUND}_tp1`,
      JSON.stringify({ setup: true }),
    )
    localStorage.setItem(
      `apex_weekend_slot_state_v1_${CAREER_ID}_${SEASON_ID}_r${TARGET_ROUND}`,
      JSON.stringify({ slot: 3 }),
    )
    localStorage.setItem(
      `apex_sprint_race_canonical_state_${CAREER_ID}_s${SEASON_ID}_r${TARGET_ROUND}`,
      JSON.stringify({ running: true }),
    )
    localStorage.setItem(
      `f1_2026_canonical_race_v2_sprint_${CAREER_ID}_s${SEASON_ID}_r${TARGET_ROUND}`,
      JSON.stringify({ running: true }),
    )

    // 2. Executar reset
    const result = resetWeekendForRound({
      careerId: CAREER_ID,
      seasonId: SEASON_ID,
      round: TARGET_ROUND,
    })

    expect(result.success).toBe(true)
    expect(result.clearedKeys.length).toBeGreaterThan(0)

    // 3. Verificar que as chaves da rodada alvo foram removidas
    const completedAfter = readStoredCompletedSessions(SEASON_ID, TARGET_ROUND)
    expect(completedAfter).toEqual([])

    expect(
      canonicalQualifyingPersistenceService.readStageState(SEASON_ID, TARGET_ROUND, 'sq2'),
    ).toBeNull()
    expect(
      canonicalQualifyingPersistenceService.readStageResult(SEASON_ID, TARGET_ROUND, 'sq2'),
    ).toBeNull()
    expect(
      canonicalQualifyingPersistenceService.readCompleteQualifyingResult(SEASON_ID, TARGET_ROUND),
    ).toBeNull()
    expect(canonicalQualifyingPersistenceService.isParcFermeActive(SEASON_ID, TARGET_ROUND)).toBe(
      false,
    )

    expect(localStorage.getItem(`apex_gp_tires_${SEASON_ID}_r${TARGET_ROUND}`)).toBeNull()
    expect(
      localStorage.getItem(`apex_practice_session_${CAREER_ID}_${SEASON_ID}_${TARGET_ROUND}_tp1`),
    ).toBeNull()
    expect(
      localStorage.getItem(`apex_weekend_slot_state_v1_${CAREER_ID}_${SEASON_ID}_r${TARGET_ROUND}`),
    ).toBeNull()
    expect(
      localStorage.getItem(
        `apex_sprint_race_canonical_state_${CAREER_ID}_s${SEASON_ID}_r${TARGET_ROUND}`,
      ),
    ).toBeNull()
  })

  // (b) Reset NÃO altera chaves de campeonato/temporada/rodadas anteriores
  it('(b) reset NÃO altera chaves de campeonato, moral, economia ou rodadas anteriores', () => {
    // Configurar dados de rodada anterior (Round 6) e dados globais de campeonato/economia
    const prevRoundCompleted = ['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race']
    writeStoredCompletedSessions(SEASON_ID, PREVIOUS_ROUND, prevRoundCompleted)

    const prevRoundQuali = {
      seasonId: SEASON_ID,
      round: PREVIOUS_ROUND,
      completedAt: '2026-05-15T12:00:00.000Z',
      poleDriverId: 'drv_prev',
      poleDriverName: 'Old Pole',
      poleLapTime: '1:10.000',
      q1Result: {} as any,
      q2Result: {} as any,
      q3Result: {} as any,
      finalGrid: [],
    }
    canonicalQualifyingPersistenceService.saveCompleteQualifyingResult(prevRoundQuali)

    const championshipStandingsKey = `apex_championship_standings_${SEASON_ID}`
    const driverMoraleKey = `apex_driver_morale_canonical_${CAREER_ID}`
    const financeKey = `apex_team_finances_${CAREER_ID}`
    const carDevKey = `apex_car_development_${CAREER_ID}`

    localStorage.setItem(championshipStandingsKey, JSON.stringify({ points: { drv_1: 45 } }))
    localStorage.setItem(driverMoraleKey, JSON.stringify({ morale: 95 }))
    localStorage.setItem(financeKey, JSON.stringify({ balance: 15000000 }))
    localStorage.setItem(carDevKey, JSON.stringify({ aeroLevel: 3 }))

    // Preencher também a rodada alvo para resetar
    writeStoredCompletedSessions(SEASON_ID, TARGET_ROUND, ['tp1', 'sq1'])

    // Executar reset na rodada alvo (Round 7)
    const result = resetWeekendForRound({
      careerId: CAREER_ID,
      seasonId: SEASON_ID,
      round: TARGET_ROUND,
    })
    expect(result.success).toBe(true)

    // Validar integridade estrita das chaves que NÃO podem ser tocadas
    expect(readStoredCompletedSessions(SEASON_ID, PREVIOUS_ROUND)).toEqual(prevRoundCompleted)
    expect(
      canonicalQualifyingPersistenceService.readCompleteQualifyingResult(SEASON_ID, PREVIOUS_ROUND),
    ).toEqual(prevRoundQuali)

    expect(localStorage.getItem(championshipStandingsKey)).toBe(
      JSON.stringify({ points: { drv_1: 45 } }),
    )
    expect(localStorage.getItem(driverMoraleKey)).toBe(JSON.stringify({ morale: 95 }))
    expect(localStorage.getItem(financeKey)).toBe(JSON.stringify({ balance: 15000000 }))
    expect(localStorage.getItem(carDevKey)).toBe(JSON.stringify({ aeroLevel: 3 }))
  })

  // (c) Idempotência (reset 2x sem erro nem corrupção)
  it('(c) idempotência: reset executado consecutivamente não lança erro e mantém estado limpo', () => {
    writeStoredCompletedSessions(SEASON_ID, TARGET_ROUND, ['tp1', 'sq1', 'sq2'])

    const firstRun = resetWeekendForRound({
      careerId: CAREER_ID,
      seasonId: SEASON_ID,
      round: TARGET_ROUND,
    })
    expect(firstRun.success).toBe(true)
    expect(firstRun.clearedKeys.length).toBeGreaterThan(0)

    // Segunda execução consecutiva
    const secondRun = resetWeekendForRound({
      careerId: CAREER_ID,
      seasonId: SEASON_ID,
      round: TARGET_ROUND,
    })
    expect(secondRun.success).toBe(true)
    // Na segunda vez, como as chaves já foram removidas, clearedKeys é vazio
    expect(secondRun.clearedKeys).toEqual([])

    expect(readStoredCompletedSessions(SEASON_ID, TARGET_ROUND)).toEqual([])
  })

  // (d) Após reset, primeira fase pode iniciar normalmente
  it('(d) após reset, a esteira volta para a primeira fase (TL1) e pode iniciar normalmente', () => {
    // Simular que o fim de semana já estava em SQ2
    writeStoredCompletedSessions(SEASON_ID, TARGET_ROUND, ['tp1', 'sq1'])

    resetWeekendForRound({
      careerId: CAREER_ID,
      seasonId: SEASON_ID,
      round: TARGET_ROUND,
    })

    const completed = readStoredCompletedSessions(SEASON_ID, TARGET_ROUND)
    expect(completed).toEqual([])

    const pipeline = getRaceWeekendPipeline({ format: 'sprint', includePractice3: false })
    const initialSession = resolveInitialRaceSession({
      pipeline,
      completedSessions: completed,
    })

    // No formato sprint, a primeira fase após o reset é 'tp1'
    expect(initialSession).toBe('tp1')
  })
})
