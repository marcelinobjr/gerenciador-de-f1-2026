import { describe, it, expect, beforeEach } from 'vitest'
import { CanonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { CanonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { driverBase2026Service } from '@/services/driverBase2026Service'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'
import type { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'

/**
 * ALL-DNF-RACE-01C-C — PERSISTÊNCIA + SAVE/RELOAD + IDEMPOTÊNCIA
 * (fechamento definitivo da pendência nº 10 — TODAS DNF)
 *
 * Contratos testados (ALLDNF01CC-01..20):
 * - ALLDNF01CC-01: resultado oficial ALL-DNF é persistido.
 * - ALLDNF01CC-02: pointsAwarded é persistido.
 * - ALLDNF01CC-03: save/reload preserva position, lapsCompleted, raceStatus, classificationStatus.
 * - ALLDNF01CC-04: save/reload preserva Driver Championship.
 * - ALLDNF01CC-05: save/reload preserva Constructor Championship.
 * - ALLDNF01CC-06: segunda officializeRace() do mesmo evento → Driver delta = 0.
 * - ALLDNF01CC-07: segunda officializeRace() do mesmo evento → Constructor delta = 0.
 * - ALLDNF01CC-08: segunda oficialização não duplica race result.
 * - ALLDNF01CC-09: segunda oficialização não duplica history.
 * - ALLDNF01CC-10: segunda oficialização não duplica wins/podiums ou stats atualizadas pelo fluxo.
 * - ALLDNF01CC-11: reload + abrir resultado não reaplica pontos.
 * - ALLDNF01CC-12: re-render/navegação não reaplica pontos.
 * - ALLDNF01CC-13: Round 4 duplicado é bloqueado; Round 5 continua oficializável.
 * - ALLDNF01CC-14: career A round 4 não bloqueia career B round 4.
 * - ALLDNF01CC-15: corrida com 0 pontos ainda fica marcada como oficializada.
 * - ALLDNF01CC-16: NC com points = 0 permanece persistido após reload.
 * - ALLDNF01CC-17: DNF + CLASSIFIED mantém pointsAwarded após reload.
 * - ALLDNF01CC-18: dois pilotos da mesma equipe mantêm contribuição correta ao construtor após reload.
 * - ALLDNF01CC-19: idempotency identity usa evento/carreira/temporada/rodada ou identidade canônica equivalente.
 * - ALLDNF01CC-20: corrida normal completa continua persistindo e oficializando sem regressão.
 */

describe('ALL-DNF-RACE-01C-C — Persistência, Save/Reload e Idempotência', () => {
  let engine: CanonicalRaceEngineService
  let resultService: CanonicalRaceResultService

  const careerIdA = 'CAREER_A'
  const careerIdB = 'CAREER_B'
  const season = 2026
  const round = 4
  const raceId = 'test_gp_round_4'

  beforeEach(() => {
    engine = new CanonicalRaceEngineService()
    resultService = new CanonicalRaceResultService()

    // Limpar armazenamento para testes em ambas as carreiras
    ;[careerIdA, careerIdB].forEach((cId) => {
      for (let r = 1; r <= 6; r++) {
        resultService.clearOfficialRaceResultForTesting(cId, season, `gp_r${r}`)
        resultService.clearOfficialRaceResultForTesting(cId, season, raceId)
        canonicalCareerPersistenceService.clearPersistenceForTesting(cId, season, r)
        canonicalChampionshipService.clearSnapshotsForTesting(cId, season, r)
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`f1_career_drivers_${cId}`)
      }
    })
  })

  /**
   * Helper para construir a fixture principal conforme especificação:
   * career: CAREER_A; season: 2026; round: 4; scheduledLaps: 60; leaderLaps: 10; eligible: true
   * - P1 Driver A (drv_01), Team X (mercedes), DNF, CLASSIFIED, 6 pts
   * - P2 Driver B (drv_03), Team Y (ferrari), DNF, CLASSIFIED, 4 pts
   * - P3 Driver C (drv_02), Team X (mercedes), DNF, CLASSIFIED, 3 pts
   * - P4 Driver D (drv_05), Team Z (mclaren), DNF, NC (5 voltas), 0 pts
   * - Demais P5..P24: DNF com tempos ordenados
   */
  function createPrincipalFixtureState(options?: {
    careerId?: string
    season?: number
    round?: number
    raceId?: string
    scheduledLaps?: number
    leaderLaps?: number
    consecutiveGreenLaps?: number
  }): CanonicalRaceState {
    const cId = options?.careerId ?? careerIdA
    const sYear = options?.season ?? season
    const rNum = options?.round ?? round
    const rId = options?.raceId ?? raceId
    const totalLaps = options?.scheduledLaps ?? 60
    const leaderLaps = options?.leaderLaps ?? 10

    const drivers: CanonicalRaceDriverState[] = []
    OFFICIAL_GRID_TEAMS.forEach((team, teamIndex) => {
      for (let carNum = 1; carNum <= 2; carNum++) {
        const globalIdx = teamIndex * 2 + (carNum - 1)
        const pos = globalIdx + 1
        const driverName = carNum === 1 ? team.driver1.name : team.driver2.name
        const driverId = `drv_${pos.toString().padStart(2, '0')}`

        drivers.push({
          careerId: cId,
          season: sYear,
          raceId: rId,
          driverId,
          teamId: team.key,
          driverName,
          teamName: team.name,
          teamColor: team.color,
          gridPosition: pos,
          currentPosition: pos,
          lap: leaderLaps,
          raceTime: 2000 + pos * 5,
          gap: pos === 1 ? 'LÍDER' : `+${(pos * 0.5).toFixed(3)}s`,
          tyreCompound: 'medio',
          tyreAge: leaderLaps,
          fuel: 80 - pos,
          carCondition: 95 - pos,
          raceStatus: 'dnf',
          isDnf: true,
          pitStops: 1,
          isPlayer: team.key === 'mercedes',
        })
      }
    })

    // Customizar explicitamente P1, P2, P3, P4 da Fixture Principal
    // Driver A: drv_01, Team X (mercedes), lap=10, raceTime=900
    // Driver B: drv_03, Team Y (ferrari), lap=10, raceTime=910
    // Driver C: drv_02, Team X (mercedes), lap=10, raceTime=920
    // Driver D: drv_05, Team Z (mclaren), lap=5 (<9 laps -> NC), raceTime=930
    const dA = drivers.find((d) => d.driverId === 'drv_01')!
    const dB = drivers.find((d) => d.driverId === 'drv_03')!
    const dC = drivers.find((d) => d.driverId === 'drv_02')!
    const dD = drivers.find((d) => d.driverId === 'drv_05')!

    dA.lap = leaderLaps
    dA.raceTime = 900
    dB.lap = leaderLaps
    dB.raceTime = 910
    dC.lap = leaderLaps
    dC.raceTime = 920
    dD.lap = 5 // 5 voltas < 9 voltas (90% de 10) => NC
    dD.raceTime = 930

    // Demais pilotos com lap = leaderLaps e tempos maiores
    drivers.forEach((d) => {
      if (d !== dA && d !== dB && d !== dC && d !== dD) {
        d.lap = leaderLaps
        d.raceTime = 1000 + d.gridPosition * 10
      }
    })

    // Ordenar drivers por lap DESC e raceTime ASC para espelhar classificação canônica
    drivers.sort((a, b) => {
      if (b.lap !== a.lap) return b.lap - a.lap
      return a.raceTime - b.raceTime
    })
    drivers.forEach((d, idx) => {
      d.currentPosition = idx + 1
    })

    const lookup: Record<string, CanonicalRaceDriverState> = {}
    drivers.forEach((d) => {
      lookup[d.driverId] = d
    })

    return {
      version: '2.0',
      careerId: cId,
      season: sYear,
      round: rNum,
      raceId: rId,
      circuitName: 'Silverstone',
      circuitCountry: 'GBR',
      totalLaps,
      currentLap: leaderLaps + 1,
      status: 'completed',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      weather: 'seco',
      simSpeed: 1,
      drivers,
      driverLookup: lookup,
      playerTeamId: 'mercedes',
      tactics: {},
      paceOrders: {},
      revision: 1,
      updatedAt: new Date().toISOString(),
      events: [],
      raceControl: {
        currentFlag: 'FINISHED',
        lapsRemainingInPhase: 0,
        safetyCarLaps: 0,
        vscLaps: 0,
        redFlagLaps: 0,
        scQueuedOrder: [],
        restartPending: false,
        activeEvents: [],
        history: [],
      },
    }
  }

  // ALLDNF01CC-01: resultado oficial ALL-DNF é persistido
  it('ALLDNF01CC-01: resultado oficial ALL-DNF é persistido na storage canônica', () => {
    const state = createPrincipalFixtureState()
    const official = resultService.createOfficialRaceResult(state)
    const saved = resultService.saveOfficialRaceResult(official, true)
    expect(saved).toBe(true)

    const reg = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    expect(reg.success).toBe(true)

    // Verificar se o registro foi salvo no storage persistente canônico
    const persisted = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerIdA,
      season,
      round,
    )
    expect(persisted).not.toBeNull()
    expect(persisted!.careerId).toBe(careerIdA)
    expect(persisted!.season).toBe(season)
    expect(persisted!.round).toBe(round)
    expect(persisted!.entries.length).toBe(24)
  })

  // ALLDNF01CC-02: pointsAwarded é persistido
  it('ALLDNF01CC-02: pointsAwarded é persistido fielmente no registro canônico', () => {
    const state = createPrincipalFixtureState()
    const official = resultService.createOfficialRaceResult(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const persisted = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerIdA,
      season,
      round,
    )!
    const p1 = persisted.entries.find((e) => e.finalPosition === 1)!
    const p2 = persisted.entries.find((e) => e.finalPosition === 2)!
    const p3 = persisted.entries.find((e) => e.finalPosition === 3)!
    const p4 = persisted.entries.find((e) => e.finalPosition === 4)!

    expect(p1.pointsAwarded).toBe(6)
    expect(p2.pointsAwarded).toBe(4)
    expect(p3.pointsAwarded).toBe(3)
    expect(p4.pointsAwarded).toBe(0)
  })

  // ALLDNF01CC-03: save/reload preserva position, lapsCompleted, raceStatus, classificationStatus
  it('ALLDNF01CC-03: save/reload preserva position, lapsCompleted, raceStatus, classificationStatus', () => {
    const state = createPrincipalFixtureState()
    const official = resultService.createOfficialRaceResult(state)
    resultService.saveOfficialRaceResult(official, true)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    // Simular reload lendo diretamente da storage serializada
    const reloaded = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerIdA,
      season,
      round,
    )
    expect(reloaded).not.toBeNull()

    const p1 = reloaded!.entries.find((e) => e.driverId === 'drv_01')!
    expect(p1.finalPosition).toBe(1)
    expect(p1.lapsCompleted).toBe(10)
    expect(p1.status).toBe('dnf')
    expect(p1.classificationStatus).toBe('CLASSIFIED')

    const p4 = reloaded!.entries.find((e) => e.driverId === 'drv_05')!
    expect(p4.finalPosition).toBe(4)
    expect(p4.lapsCompleted).toBe(5)
    expect(p4.status).toBe('dnf')
    expect(p4.classificationStatus).toBe('NOT_CLASSIFIED')
  })

  // ALLDNF01CC-04: save/reload preserva Driver Championship
  it('ALLDNF01CC-04: save/reload preserva Driver Championship', () => {
    const state = createPrincipalFixtureState()
    const official = resultService.createOfficialRaceResult(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    // Antes do reload
    const standBefore = canonicalChampionshipService.getChampionshipStandings(
      careerIdA,
      season,
      round,
    )
    const drvABefore = standBefore.driverStandings.find((d) => d.driverId === 'drv_01')!
    expect(drvABefore.points).toBe(6)

    // Limpar cache em memória de snapshots para forçar rebuild/reload a partir da persistência
    canonicalChampionshipService.clearSnapshotsForTesting(careerIdA, season, round)

    // Após reload
    const standAfter = canonicalChampionshipService.getChampionshipStandings(
      careerIdA,
      season,
      round,
    )
    const drvAAfter = standAfter.driverStandings.find((d) => d.driverId === 'drv_01')!
    expect(drvAAfter.points).toBe(6)
  })

  // ALLDNF01CC-05: save/reload preserva Constructor Championship
  it('ALLDNF01CC-05: save/reload preserva Constructor Championship', () => {
    const state = createPrincipalFixtureState()
    const official = resultService.createOfficialRaceResult(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    // Antes do reload: mercedes com Driver A (6) + Driver C (3) = 9
    const standBefore = canonicalChampionshipService.getChampionshipStandings(
      careerIdA,
      season,
      round,
    )
    const mercBefore = standBefore.constructorStandings.find((c) => c.teamId === 'mercedes')!
    expect(mercBefore.points).toBe(9)

    // Forçar releitura da persistência
    canonicalChampionshipService.clearSnapshotsForTesting(careerIdA, season, round)

    const standAfter = canonicalChampionshipService.getChampionshipStandings(
      careerIdA,
      season,
      round,
    )
    const mercAfter = standAfter.constructorStandings.find((c) => c.teamId === 'mercedes')!
    expect(mercAfter.points).toBe(9)
  })

  // ALLDNF01CC-06: segunda officializeRace() do mesmo evento → Driver delta = 0
  it('ALLDNF01CC-06: segunda officializeRace() do mesmo evento → Driver delta = 0', () => {
    const state = createPrincipalFixtureState()
    const official1 = resultService.createOfficialRaceResult(state)

    // Primeira oficialização / persistência
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official1)
    const stand1 = canonicalChampionshipService.getChampionshipStandings(careerIdA, season, round)
    const p1Before = stand1.driverStandings.find((d) => d.driverId === 'drv_01')!.points
    expect(p1Before).toBe(6)

    // Segunda chamada com o mesmo evento
    const official2 = resultService.createOfficialRaceResult(state)
    const reg2 = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official2)
    expect(reg2.alreadyRegistered).toBe(true)

    const stand2 = canonicalChampionshipService.getChampionshipStandings(careerIdA, season, round)
    const p1After = stand2.driverStandings.find((d) => d.driverId === 'drv_01')!.points
    expect(p1After).toBe(6) // Delta = 0
  })

  // ALLDNF01CC-07: segunda officializeRace() do mesmo evento → Constructor delta = 0
  it('ALLDNF01CC-07: segunda officializeRace() do mesmo evento → Constructor delta = 0', () => {
    const state = createPrincipalFixtureState()
    const official = resultService.createOfficialRaceResult(state)

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    const stand1 = canonicalChampionshipService.getChampionshipStandings(careerIdA, season, round)
    const mercPoints1 = stand1.constructorStandings.find((c) => c.teamId === 'mercedes')!.points
    expect(mercPoints1).toBe(9)

    // Segunda chamada
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    const stand2 = canonicalChampionshipService.getChampionshipStandings(careerIdA, season, round)
    const mercPoints2 = stand2.constructorStandings.find((c) => c.teamId === 'mercedes')!.points
    expect(mercPoints2).toBe(9) // Delta = 0
  })

  // ALLDNF01CC-08: segunda oficialização não duplica race result
  it('ALLDNF01CC-08: segunda oficialização não duplica race result', () => {
    const state = createPrincipalFixtureState()
    const official = resultService.createOfficialRaceResult(state)

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const eligible = canonicalChampionshipService.getEligibleOfficialRaceResults(
      careerIdA,
      season,
      round,
    )
    const round4Results = eligible.filter((r) => r.round === 4)
    expect(round4Results.length).toBe(1)
  })

  // ALLDNF01CC-09: segunda oficialização não duplica history
  it('ALLDNF01CC-09: segunda oficialização não duplica history', () => {
    const state = createPrincipalFixtureState()
    const official = resultService.createOfficialRaceResult(state)

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const audit = canonicalCareerPersistenceService.auditCareerRaceResultPersistence({
      careerId: careerIdA,
      season,
      round,
    })
    expect(audit.isValid).toBe(true)
    expect(audit.duplicateIncrementsDetected).toBe(false)
    expect(audit.uniqueDriverIds).toBe(true)
    expect(audit.foundEntries).toBe(24)
  })

  // ALLDNF01CC-10: segunda oficialização não duplica wins/podiums ou stats atualizadas pelo fluxo
  it('ALLDNF01CC-10: segunda oficialização não duplica wins/podiums ou stats atualizadas pelo fluxo', () => {
    const state = createPrincipalFixtureState()
    const official = resultService.createOfficialRaceResult(state)

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    const driverAStats1 = driverBase2026Service.getCareerDriver(careerIdA, 'drv_01')?.stats

    expect(driverAStats1?.wins).toBe(1)
    expect(driverAStats1?.podiums).toBe(1)
    expect(driverAStats1?.raceStarts).toBe(1)

    // Segunda chamada
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    const driverAStats2 = driverBase2026Service.getCareerDriver(careerIdA, 'drv_01')?.stats

    expect(driverAStats2?.wins).toBe(1)
    expect(driverAStats2?.podiums).toBe(1)
    expect(driverAStats2?.raceStarts).toBe(1)
  })

  // ALLDNF01CC-11: reload + abrir resultado não reaplica pontos
  it('ALLDNF01CC-11: reload + abrir resultado não reaplica pontos', () => {
    const state = createPrincipalFixtureState()
    const official = resultService.createOfficialRaceResult(state)
    resultService.saveOfficialRaceResult(official, true)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    // Simula reload e leitura da tela de resultado (loadOfficialResult)
    const loaded1 = resultService.loadOfficialResult(careerIdA, season, raceId)
    const loaded2 = resultService.loadOfficialResult(careerIdA, season, raceId)
    expect(loaded1).not.toBeNull()
    expect(loaded2).not.toBeNull()

    const standings = canonicalChampionshipService.getChampionshipStandings(
      careerIdA,
      season,
      round,
    )
    const drvA = standings.driverStandings.find((d) => d.driverId === 'drv_01')!
    expect(drvA.points).toBe(6)
  })

  // ALLDNF01CC-12: re-render/navegação não reaplica pontos
  it('ALLDNF01CC-12: re-render/navegação simulada não reaplica pontos', () => {
    const state = createPrincipalFixtureState()
    const official = resultService.createOfficialRaceResult(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    // Simular múltiplas consultas como faria um componente React remontando
    for (let render = 0; render < 5; render++) {
      const standings = canonicalChampionshipService.getChampionshipStandings(
        careerIdA,
        season,
        round,
      )
      expect(standings.driverStandings.find((d) => d.driverId === 'drv_01')!.points).toBe(6)
      expect(standings.constructorStandings.find((c) => c.teamId === 'mercedes')!.points).toBe(9)
    }
  })

  // ALLDNF01CC-13: Round 4 duplicado é bloqueado; Round 5 continua oficializável
  it('ALLDNF01CC-13: Round 4 duplicado é bloqueado; Round 5 continua oficializável normalmente', () => {
    const stateR4 = createPrincipalFixtureState({ round: 4, raceId: 'gp_r4' })
    const officialR4 = resultService.createOfficialRaceResult(stateR4)
    const regR4_1 = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialR4)
    expect(regR4_1.success).toBe(true)
    expect(regR4_1.alreadyRegistered).toBe(false)

    // Tentativa duplicada de Round 4
    const regR4_2 = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialR4)
    expect(regR4_2.alreadyRegistered).toBe(true)

    // Agora Round 5 na mesma carreira
    const stateR5 = createPrincipalFixtureState({ round: 5, raceId: 'gp_r5' })
    const officialR5 = resultService.createOfficialRaceResult(stateR5)
    const regR5 = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialR5)
    expect(regR5.success).toBe(true)
    expect(regR5.alreadyRegistered).toBe(false)

    // Standings através do Round 5 deve somar os pontos de R4 (6) + R5 (6) = 12
    const standR5 = canonicalChampionshipService.getChampionshipStandings(careerIdA, season, 5)
    const drvA = standR5.driverStandings.find((d) => d.driverId === 'drv_01')!
    expect(drvA.points).toBe(12)
  })

  // ALLDNF01CC-14: career A round 4 não bloqueia career B round 4
  it('ALLDNF01CC-14: career A round 4 não bloqueia career B round 4 (isolamento estrito)', () => {
    const stateA = createPrincipalFixtureState({ careerId: careerIdA, round: 4 })
    const officialA = resultService.createOfficialRaceResult(stateA)
    const regA = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialA)
    expect(regA.success).toBe(true)

    const stateB = createPrincipalFixtureState({ careerId: careerIdB, round: 4 })
    const officialB = resultService.createOfficialRaceResult(stateB)
    const regB = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(officialB)
    expect(regB.success).toBe(true)
    expect(regB.alreadyRegistered).toBe(false)

    // Ambos devem ter seus respectivos registros isolados
    const resA = canonicalCareerPersistenceService.getPersistedRaceResult(careerIdA, season, 4)
    const resB = canonicalCareerPersistenceService.getPersistedRaceResult(careerIdB, season, 4)
    expect(resA).not.toBeNull()
    expect(resB).not.toBeNull()
    expect(resA!.careerId).toBe(careerIdA)
    expect(resB!.careerId).toBe(careerIdB)
  })

  // ALLDNF01CC-15: corrida com 0 pontos ainda fica marcada como oficializada
  it('ALLDNF01CC-15: corrida com 0 pontos ainda fica marcada como oficializada', () => {
    // Prova sem voltas verdes suficientes (< 2 voltas verdes completas consecutivas)
    const state0Pts = createPrincipalFixtureState()
    state0Pts.raceControl = {
      ...state0Pts.raceControl,
      safetyCarLaps: 10, // Todas as 10 voltas foram sob SC -> 0 pontos elegíveis
    }

    const official = resultService.createOfficialRaceResult(state0Pts)
    expect(official.entries[0].pointsAwarded).toBe(0)

    const reg = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    expect(reg.success).toBe(true)

    // Confirmar que a corrida está registrada e marcada como oficializada
    const isRegistered = canonicalCareerPersistenceService.isResultRegistered(
      careerIdA,
      season,
      round,
    )
    expect(isRegistered).toBe(true)

    const journal = canonicalCareerPersistenceService.getApplicationJournal(
      careerIdA,
      season,
      round,
    )
    expect(journal?.status).toBe('COMPLETE')
  })

  // ALLDNF01CC-16: NC com points = 0 permanece persistido após reload
  it('ALLDNF01CC-16: NC com points = 0 permanece persistido após reload', () => {
    const state = createPrincipalFixtureState()
    const official = resultService.createOfficialRaceResult(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    // Simular reload lendo da camada persistente
    const persisted = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerIdA,
      season,
      round,
    )
    expect(persisted).not.toBeNull()

    const ncEntry = persisted!.entries.find((e) => e.driverId === 'drv_05')!
    expect(ncEntry).toBeDefined()
    expect(ncEntry.classificationStatus).toBe('NOT_CLASSIFIED')
    expect(ncEntry.pointsAwarded).toBe(0)
    expect(ncEntry.lapsCompleted).toBe(5)
  })

  // ALLDNF01CC-17: DNF + CLASSIFIED mantém pointsAwarded após reload
  it('ALLDNF01CC-17: DNF + CLASSIFIED mantém pointsAwarded após reload', () => {
    const state = createPrincipalFixtureState()
    const official = resultService.createOfficialRaceResult(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const persisted = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerIdA,
      season,
      round,
    )
    const dnfClassified = persisted!.entries.find((e) => e.driverId === 'drv_01')!
    expect(dnfClassified.status).toBe('dnf')
    expect(dnfClassified.classificationStatus).toBe('CLASSIFIED')
    expect(dnfClassified.pointsAwarded).toBe(6)
  })

  // ALLDNF01CC-18: dois pilotos da mesma equipe mantêm contribuição correta ao construtor após reload
  it('ALLDNF01CC-18: dois pilotos da mesma equipe mantêm contribuição correta ao construtor após reload', () => {
    const state = createPrincipalFixtureState()
    const official = resultService.createOfficialRaceResult(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    // Limpar cache para forçar rebuild dos construtores
    canonicalChampionshipService.clearSnapshotsForTesting(careerIdA, season, round)

    const standings = canonicalChampionshipService.getChampionshipStandings(
      careerIdA,
      season,
      round,
    )
    const teamMercedes = standings.constructorStandings.find((c) => c.teamId === 'mercedes')!
    expect(teamMercedes.points).toBe(9) // 6 de drv_01 + 3 de drv_02
  })

  // ALLDNF01CC-19: idempotency identity usa evento/carreira/temporada/rodada ou identidade canônica equivalente
  it('ALLDNF01CC-19: idempotency identity usa formato canônico race_result_{careerId}_{seasonId}_{round}', () => {
    const expectedKey = canonicalCareerPersistenceService.buildRaceResultKey(
      careerIdA,
      season,
      round,
    )
    expect(expectedKey).toBe(`race_result_${careerIdA}_s${season}_${round}`)

    const expectedJournalKey = canonicalCareerPersistenceService.buildApplyJournalKey(
      careerIdA,
      season,
      round,
    )
    expect(expectedJournalKey).toBe(`career_apply_result_${careerIdA}_s${season}_${round}`)

    const state = createPrincipalFixtureState()
    const official = resultService.createOfficialRaceResult(state)
    const reg = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    expect(reg.persistedResult?.id).toBe(expectedKey)
    expect(reg.journal.key).toBe(expectedJournalKey)
  })

  // ALLDNF01CC-20: corrida normal completa continua persistindo e oficializando sem regressão
  // Verificação de conformidade ALL-DNF-RACE-01C-C
  it('ALLDNF01CC-20: corrida normal completa continua persistindo e oficializando sem regressão', () => {
    const normalState = createPrincipalFixtureState({
      scheduledLaps: 60,
      leaderLaps: 60,
    })
    // Marcar todos como racing/finished
    normalState.drivers.forEach((d, idx) => {
      d.raceStatus = 'racing'
      d.isDnf = false
      d.lap = 60
      d.raceTime = 5000 + idx * 5
    })

    const official = resultService.createOfficialRaceResult(normalState)
    expect(official.entries[0].status).toBe('finished')
    expect(official.entries[0].pointsAwarded).toBe(25)
    expect(official.entries[1].pointsAwarded).toBe(18)
    expect(official.entries[2].pointsAwarded).toBe(15)

    const reg = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    expect(reg.success).toBe(true)

    const standings = canonicalChampionshipService.getChampionshipStandings(
      careerIdA,
      season,
      round,
    )
    expect(standings.driverStandings[0].points).toBe(25)
    expect(standings.driverStandings[1].points).toBe(18)
    expect(standings.driverStandings[2].points).toBe(15)
  })
})
