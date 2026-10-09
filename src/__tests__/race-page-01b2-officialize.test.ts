import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { driverBase2026Service } from '@/services/driverBase2026Service'
import type { CanonicalRaceState, OfficialRaceResult } from '@/types/canonical-race-v2'

const TEST_CAREER_ID = 'test_career_race_01b2'
const TEST_SEASON = 2026
const TEST_ROUND = 1
const TOTAL_LAPS = 58

function buildTestGrid(count = 20) {
  return Array.from({ length: count }, (_, idx) => ({
    position: idx + 1,
    driverId: `driver_${idx + 1}`,
    driverName: `Piloto ${idx + 1}`,
    teamId: idx < 2 ? 'team_audi' : `team_${Math.floor(idx / 2) + 1}`,
    teamName: idx < 2 ? 'Audi F1 Team' : `Equipe ${Math.floor(idx / 2) + 1}`,
    driverNumber: idx + 1,
    gapToPoleFormatted: idx === 0 ? 'POLE' : `+0.${idx * 150}s`,
    gapToPreviousFormatted: idx === 0 ? '-' : '+0.150s',
    fastestLapTimeFormatted: '1:18.500',
    compound: 'macio' as const,
  }))
}

describe('RACE-PAGE-01B2: Oficialização canônica e não-duplicação na /race', () => {
  beforeEach(() => {
    localStorage.clear()
    canonicalRaceInitializationService.clearCanonicalRaceState(
      TEST_CAREER_ID,
      TEST_SEASON,
      TEST_ROUND,
      { raceVariant: 'MAIN_RACE' },
    )
    canonicalRaceInitializationService.clearCanonicalRaceState(
      TEST_CAREER_ID,
      TEST_SEASON,
      TEST_ROUND,
      { raceVariant: 'SPRINT_RACE' },
    )
    canonicalCareerPersistenceService.clearPersistenceForTesting(
      TEST_CAREER_ID,
      TEST_SEASON,
      TEST_ROUND,
    )
  })

  it('1. Checkpoint encerrado (58/58 voltas) → oficializa sem nova simulação de voltas', () => {
    const grid = buildTestGrid(20)

    // Inicializa a corrida
    let state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: TEST_CAREER_ID,
      season: TEST_SEASON,
      round: TEST_ROUND,
      circuitName: 'Albert Park',
      circuitCountry: 'Australia',
      totalLaps: TOTAL_LAPS,
      playerTeamId: 'team_audi',
      canonicalQualifyingGrid: grid as any,
      persistState: true,
    })

    // Simula a chegada a 58 voltas (completou a prova)
    state = {
      ...state,
      currentLap: TOTAL_LAPS,
      status: 'completed',
      drivers: state.drivers.map((d, idx) => ({
        ...d,
        lap: idx === 18 ? 55 : idx === 19 ? 30 : TOTAL_LAPS, // retardatário e abandono
        raceStatus: idx === 19 ? 'dnf' : 'finished',
        isDnf: idx === 19,
        dnfReason: idx === 19 ? 'Falha Elétrica na PU' : undefined,
      })),
    }
    canonicalRaceInitializationService.saveCanonicalRaceState(state)

    // Confere que está persistido em 58/58
    const loadedFinished = canonicalRaceInitializationService.readCanonicalRaceState(
      TEST_CAREER_ID,
      TEST_SEASON,
      TEST_ROUND,
      'MAIN_RACE',
    )
    expect(loadedFinished).not.toBeNull()
    expect(loadedFinished?.currentLap).toBe(58)
    expect(loadedFinished?.status).toBe('completed')

    // Oficializa pela rotina canônica
    const official = canonicalRaceResultService.officializeRace(loadedFinished!)
    expect(official).toBeDefined()
    expect(official.officialResultId).toContain('official_result_')
    expect(official.entries.length).toBe(20)

    // Retardatários e abandonos são preservados sem erro
    const dnfEntry = official.entries.find((e) => e.driverId === 'driver_20')
    expect(dnfEntry?.dnf).toBe(true)
    expect(dnfEntry?.dnfReason).toBe('Falha Elétrica na PU')

    // Registra na carreira
    const persistRes =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    expect(persistRes.success).toBe(true)
    expect(persistRes.journal.status).toBe('COMPLETE')
  })

  it('2. Oficializar novamente ou recarregar → recupera o mesmo resultado e não duplica pontos nem efeitos', () => {
    const grid = buildTestGrid(20)
    let state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: TEST_CAREER_ID,
      season: TEST_SEASON,
      round: TEST_ROUND,
      circuitName: 'Albert Park',
      circuitCountry: 'Australia',
      totalLaps: TOTAL_LAPS,
      playerTeamId: 'team_audi',
      canonicalQualifyingGrid: grid as any,
      persistState: true,
    })

    state = {
      ...state,
      currentLap: TOTAL_LAPS,
      status: 'completed',
    }
    canonicalRaceInitializationService.saveCanonicalRaceState(state)

    // Primeira oficialização
    const official1 = canonicalRaceResultService.officializeRace(state)
    const persist1 = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official1)
    expect(persist1.success).toBe(true)
    expect(persist1.alreadyRegistered).toBe(false)

    // Processa campeonato inicial
    const champ1 = canonicalChampionshipService.processAndPersistRoundChampionship(
      TEST_CAREER_ID,
      TEST_SEASON,
      TEST_ROUND,
      'team_audi',
    )
    const winnerDriverId = official1.winnerDriverId
    const pointsAfter1 = champ1.driverStandings.find((d) => d.driverId === winnerDriverId)?.points

    // Obter stats de carreira do piloto 1
    const p1Stats1 = driverBase2026Service.getCareerDriver(TEST_CAREER_ID, 'driver_1')?.stats

    // Segunda tentativa de oficialização (duplo clique, reload ou retry)
    const official2 = canonicalRaceResultService.officializeRace(state)
    expect(official2.resultHash).toBe(official1.resultHash)
    expect(official2.officialResultId).toBe(official1.officialResultId)

    const persist2 = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official2)
    expect(persist2.success).toBe(true)
    expect(persist2.alreadyRegistered).toBe(true) // Proteção idempotente acionada

    const champ2 = canonicalChampionshipService.processAndPersistRoundChampionship(
      TEST_CAREER_ID,
      TEST_SEASON,
      TEST_ROUND,
      'team_audi',
    )
    const pointsAfter2 = champ2.driverStandings.find((d) => d.driverId === winnerDriverId)?.points
    expect(pointsAfter2).toBe(pointsAfter1) // Pontos NÃO duplicaram

    const p1Stats2 = driverBase2026Service.getCareerDriver(TEST_CAREER_ID, 'driver_1')?.stats
    expect(p1Stats2?.careerGps).toBe(p1Stats1?.careerGps)
    expect(p1Stats2?.careerPoints).toBe(p1Stats1?.careerPoints)
  })

  it('3. Falha simulada durante a oficialização → retry retoma sem duplicar dados já gravados', () => {
    const grid = buildTestGrid(20)
    let state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: TEST_CAREER_ID,
      season: TEST_SEASON,
      round: TEST_ROUND,
      circuitName: 'Albert Park',
      circuitCountry: 'Australia',
      totalLaps: TOTAL_LAPS,
      playerTeamId: 'team_audi',
      canonicalQualifyingGrid: grid as any,
      persistState: true,
    })

    state = { ...state, currentLap: TOTAL_LAPS, status: 'completed' }
    canonicalRaceInitializationService.saveCanonicalRaceState(state)

    const official = canonicalRaceResultService.officializeRace(state)

    // Simula falha após o 5º piloto (índice 5)
    const partialAttempt = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(
      official,
      { simulateFailureAfterIndex: 5 },
    )
    expect(partialAttempt.success).toBe(false)
    expect(partialAttempt.journal.status).toBe('FAILED')
    expect(partialAttempt.journal.appliedDriverIds.length).toBe(5)

    // Estatística do primeiro piloto já foi incrementada uma vez
    const statsMid = driverBase2026Service.getCareerDriver(TEST_CAREER_ID, 'driver_1')?.stats

    // Retry agora executando até o final sem simulação de erro
    const retryAttempt =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    expect(retryAttempt.success).toBe(true)
    expect(retryAttempt.journal.status).toBe('COMPLETE')
    expect(retryAttempt.journal.appliedDriverIds.length).toBe(20)

    // Piloto 1 (que já tinha sido processado na primeira tentativa) NÃO deve ter recebido duplo incremento
    const statsFinal = driverBase2026Service.getCareerDriver(TEST_CAREER_ID, 'driver_1')?.stats
    expect(statsFinal?.careerGps).toBe(statsMid?.careerGps)
    expect(statsFinal?.careerPoints).toBe(statsMid?.careerPoints)
  })

  it('4. Corrida em andamento (volta 30/58) → oficialização canônica é rejeitada pelo motor', () => {
    const grid = buildTestGrid(20)
    const inProgressState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: TEST_CAREER_ID,
      season: TEST_SEASON,
      round: TEST_ROUND,
      circuitName: 'Albert Park',
      circuitCountry: 'Australia',
      totalLaps: TOTAL_LAPS,
      playerTeamId: 'team_audi',
      canonicalQualifyingGrid: grid as any,
      persistState: true,
    })

    inProgressState.currentLap = 30
    inProgressState.status = 'running'

    expect(() => {
      canonicalRaceResultService.officializeRace(inProgressState)
    }).toThrow(/não pode ser oficializada|em andamento/i)
  })

  it('5. GP e Sprint possuem identidades canônicas e resultados separados', () => {
    const grid = buildTestGrid(20)

    // Main race state
    const mainRaceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      raceVariant: 'MAIN_RACE',
      careerId: TEST_CAREER_ID,
      season: TEST_SEASON,
      round: TEST_ROUND,
      circuitName: 'Albert Park',
      circuitCountry: 'Australia',
      totalLaps: TOTAL_LAPS,
      playerTeamId: 'team_audi',
      canonicalQualifyingGrid: grid as any,
      persistState: true,
    })

    // Sprint race state
    const sprintRaceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      raceVariant: 'SPRINT_RACE',
      careerId: TEST_CAREER_ID,
      season: TEST_SEASON,
      round: TEST_ROUND,
      circuitName: 'Albert Park',
      circuitCountry: 'Australia',
      totalLaps: 19,
      playerTeamId: 'team_audi',
      canonicalQualifyingGrid: grid as any,
      persistState: true,
    })

    expect(mainRaceState.raceVariant).toBe('MAIN_RACE')
    expect(sprintRaceState.raceVariant).toBe('SPRINT_RACE')

    // Conclui e oficializa ambos
    mainRaceState.currentLap = 58
    mainRaceState.status = 'completed'
    sprintRaceState.currentLap = 19
    sprintRaceState.status = 'completed'

    const officialMain = canonicalRaceResultService.officializeRace(mainRaceState)
    const officialSprint = canonicalRaceResultService.officializeRace(sprintRaceState)

    expect(officialMain.raceVariant).toBe('MAIN_RACE')
    expect(officialSprint.raceVariant).toBe('SPRINT_RACE')
    expect(officialMain.officialResultId).not.toBe(officialSprint.officialResultId)

    // Ambos persistem em chaves distintas sem colisão
    const persistMain =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialMain)
    const persistSprint =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialSprint)

    expect(persistMain.success).toBe(true)
    expect(persistSprint.success).toBe(true)
  })
})
