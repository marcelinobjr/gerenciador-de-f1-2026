import { describe, it, expect, beforeEach } from 'vitest'
import { CanonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { CanonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'

/**
 * ALL-DNF-RACE-01B — CLASSIFICAÇÃO FINAL + REGRA DOS 90% (APEX GP Manager - F1 2026)
 * Suíte de Testes Canônica: ALLDNF01B-01 .. ALLDNF01B-16
 *
 * Base regulamentar obrigatória:
 * A. Classificação considera o número de VOLTAS COMPLETAS (lapsCompleted / lap DESC).
 * B. Entre carros com o mesmo número de voltas completas: classificar pela ordem em que cruzaram a linha (raceTime ASC).
 * C. Regra dos 90%: threshold = Math.floor(winnerLaps * 0.90).
 *    lapsCompleted >= threshold -> CLASSIFIED
 *    lapsCompleted < threshold  -> NOT_CLASSIFIED (NC)
 * D. NENHUMA pontuação nova gerada nesta rodada (escopo reservado ao 01C).
 */
describe('HOTFIX ALL-DNF-RACE-01B — Classificação Final e Regra dos 90% (All-DNF)', () => {
  let engine: CanonicalRaceEngineService
  let resultService: CanonicalRaceResultService

  const careerId = 'test_career_alldnf_01b_suite'
  const season = 2026
  const round = 1
  const raceId = 'test_gp_alldnf_01b_suite'

  beforeEach(() => {
    engine = new CanonicalRaceEngineService()
    resultService = new CanonicalRaceResultService()
    resultService.clearOfficialRaceResultForTesting(careerId, season, round)
    canonicalChampionshipService.clearSnapshotsForTesting(careerId, season, round)
  })

  function createMockRaceState(options?: {
    totalLaps?: number
    currentLap?: number
    status?: CanonicalRaceState['status']
    setupDrivers?: (drivers: CanonicalRaceDriverState[]) => void
  }): CanonicalRaceState {
    const totalLaps = options?.totalLaps ?? 58
    const currentLap = options?.currentLap ?? 34
    const status = options?.status ?? 'running'

    const drivers: CanonicalRaceDriverState[] = Array.from({ length: 24 }, (_, i) => {
      const pos = i + 1
      const teamIdx = Math.floor(i / 2) + 1
      return {
        careerId,
        season,
        raceId,
        driverId: `drv_${pos.toString().padStart(2, '0')}`,
        teamId: `team_${teamIdx.toString().padStart(2, '0')}`,
        driverName: `Driver ${pos}`,
        teamName: `Team ${teamIdx}`,
        teamColor: '#FF0000',
        gridPosition: pos,
        currentPosition: pos,
        lap: currentLap > 1 ? currentLap - 1 : 0,
        raceTime: currentLap > 1 ? (currentLap - 1) * 90 + pos : 0,
        gap: pos === 1 ? 'LÍDER' : '+0.500s',
        tyreCompound: 'medio',
        tyreAge: currentLap > 1 ? currentLap - 1 : 0,
        fuel: 80 - pos,
        carCondition: 95 - pos,
        raceStatus: 'racing',
        pitStops: 1,
        isPlayer: pos <= 2,
      }
    })

    if (options?.setupDrivers) {
      options.setupDrivers(drivers)
    }

    const lookup: Record<string, CanonicalRaceDriverState> = {}
    drivers.forEach((d) => {
      lookup[d.driverId] = d
    })

    return {
      version: '2.0',
      careerId,
      season,
      round,
      raceId,
      circuitName: 'Albert Park',
      circuitCountry: 'AUS',
      totalLaps,
      currentLap,
      status,
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      weather: 'seco',
      simSpeed: 1,
      drivers,
      driverLookup: lookup,
      playerTeamId: 'team_01',
      tactics: {},
      paceOrders: {},
      revision: 1,
      updatedAt: new Date().toISOString(),
      events: [],
    }
  }

  // ALLDNF01B-01: todos DNF, voltas distintas -> ordenação DESC por lapsCompleted
  it('ALLDNF01B-01: todos DNF com voltas distintas são classificados em ordem decrescente por lapsCompleted', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 41,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          // Varia as voltas de 17 a 40 de forma invertida em relação ao ID/grid
          d.lap = 17 + idx
          d.raceTime = 2500 + (24 - idx) * 10
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    // O piloto com mais voltas (idx=23, lap=40, drv_24) deve ser P1
    expect(official.entries[0].driverId).toBe('drv_24')
    expect(official.entries[0].lapsCompleted).toBe(40)
    expect(official.entries[0].finalPosition).toBe(1)

    // A ordenação completa dos 24 pilotos deve ser estritamente decrescente em lapsCompleted
    for (let i = 0; i < official.entries.length - 1; i++) {
      expect(official.entries[i].lapsCompleted).toBeGreaterThanOrEqual(
        official.entries[i + 1].lapsCompleted,
      )
    }
  })

  // ALLDNF01B-02: dois pilotos com mesmo lapsCompleted -> desempate por passagem pela linha (raceTime menor)
  it('ALLDNF01B-02: dois pilotos com o mesmo lapsCompleted desempatam por passagem pela linha (raceTime menor cruzou antes)', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 42,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          if (idx === 0) {
            d.driverId = 'drv_A'
            d.lap = 41
            d.raceTime = 3205.5 // lineOrder 2 (cruzou depois)
          } else if (idx === 1) {
            d.driverId = 'drv_B'
            d.lap = 41
            d.raceTime = 3201.2 // lineOrder 1 (cruzou antes)
          } else {
            d.lap = 30
            d.raceTime = 3500 + idx
          }
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    // drv_B cruzou a linha antes (raceTime menor) -> P1; drv_A -> P2
    expect(official.entries[0].driverId).toBe('drv_B')
    expect(official.entries[0].finalPosition).toBe(1)
    expect(official.entries[0].lapsCompleted).toBe(41)

    expect(official.entries[1].driverId).toBe('drv_A')
    expect(official.entries[1].finalPosition).toBe(2)
    expect(official.entries[1].lapsCompleted).toBe(41)
  })

  // ALLDNF01B-03: ordem de abandono NÃO determina a classificação
  it('ALLDNF01B-03: ordem cronológica de abandono NÃO determina a classificação; prevalece voltas completas', () => {
    // Driver A abandona na volta 38 (abandono mais cedo)
    // Driver B abandona na volta 35 (abandono ainda mais cedo)
    // Driver C abandona na volta 40 (abandono por último no tempo de prova)
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 41,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          if (idx === 0) {
            // Abandonou na volta 38 com 38 voltas completadas
            d.driverId = 'drv_abandona_depois'
            d.lap = 38
            d.raceTime = 3100
          } else if (idx === 1) {
            // Completou 40 voltas completadas mas abandonou primeiro em timestamp simulado
            d.driverId = 'drv_mais_voltas'
            d.lap = 40
            d.raceTime = 3000
          } else {
            d.lap = 20
            d.raceTime = 4000 + idx
          }
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    expect(official.entries[0].driverId).toBe('drv_mais_voltas')
    expect(official.entries[0].lapsCompleted).toBe(40)
    expect(official.entries[0].finalPosition).toBe(1)

    expect(official.entries[1].driverId).toBe('drv_abandona_depois')
    expect(official.entries[1].lapsCompleted).toBe(38)
    expect(official.entries[1].finalPosition).toBe(2)
  })

  // ALLDNF01B-04: DNF acima do limiar 90% permanece DNF + CLASSIFIED
  it('ALLDNF01B-04: piloto DNF que completou voltas acima do limiar 90% permanece com raceStatus/status DNF e classificationStatus CLASSIFIED', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 41,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          // Vencedor com 40 voltas; limiar 90% = floor(40 * 0.90) = 36.
          // idx 1 tem 38 voltas (> 36)
          d.lap = idx === 0 ? 40 : idx === 1 ? 38 : 20
          d.raceTime = 3000 + idx * 10
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    const entryP2 = official.entries[1]
    expect(entryP2.lapsCompleted).toBe(38)
    expect(entryP2.status).toBe('dnf')
    expect(entryP2.dnf).toBe(true)
    expect(entryP2.classificationStatus).toBe('CLASSIFIED')
    expect(entryP2.isClassified).toBe(true)
  })

  // ALLDNF01B-05: exatamente no limiar -> CLASSIFIED (winner 40, driver 36)
  it('ALLDNF01B-05: piloto exatamente no limiar dos 90% (winner 40, threshold 36) fica CLASSIFIED', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 41,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          // Winner = 40 laps, driver = 36 laps (floor(40 * 0.90) = 36)
          d.lap = idx === 0 ? 40 : idx === 1 ? 36 : 20
          d.raceTime = 3000 + idx * 10
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    const entry36 = official.entries.find((e) => e.lapsCompleted === 36)
    expect(entry36).toBeDefined()
    expect(entry36!.classificationStatus).toBe('CLASSIFIED')
    expect(entry36!.isClassified).toBe(true)
    expect(entry36!.status).toBe('dnf')
  })

  // ALLDNF01B-06: uma volta abaixo do limiar -> NC (winner 40, driver 35)
  it('ALLDNF01B-06: piloto uma volta abaixo do limiar dos 90% (winner 40, driver 35) fica NOT_CLASSIFIED (NC)', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 41,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          // Winner = 40 laps, driver = 35 laps (< 36)
          d.lap = idx === 0 ? 40 : idx === 1 ? 35 : 20
          d.raceTime = 3000 + idx * 10
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    const entry35 = official.entries.find((e) => e.lapsCompleted === 35)
    expect(entry35).toBeDefined()
    expect(entry35!.classificationStatus).toBe('NOT_CLASSIFIED')
    expect(entry35!.isClassified).toBe(false)
    expect(entry35!.status).toBe('dnf')
  })

  // ALLDNF01B-07: winner 47, threshold 42 -> 42 CLASSIFIED, 41 NC
  it('ALLDNF01B-07: winner 47 laps -> threshold floor(47 * 0.90) = 42; 42 laps = CLASSIFIED, 41 laps = NC', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 48,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          if (idx === 0) d.lap = 47
          else if (idx === 1) d.lap = 42
          else if (idx === 2) d.lap = 41
          else d.lap = 30
          d.raceTime = 3500 + idx * 10
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    const entry42 = official.entries.find((e) => e.lapsCompleted === 42)
    const entry41 = official.entries.find((e) => e.lapsCompleted === 41)

    expect(entry42).toBeDefined()
    expect(entry42!.classificationStatus).toBe('CLASSIFIED')
    expect(entry42!.isClassified).toBe(true)

    expect(entry41).toBeDefined()
    expect(entry41!.classificationStatus).toBe('NOT_CLASSIFIED')
    expect(entry41!.isClassified).toBe(false)
  })

  // ALLDNF01B-08: NC continua presente no resultado oficial com posição preservada
  it('ALLDNF01B-08: pilotos NC permanecem presentes nas 24 entradas do resultado oficial mantendo sua posição relativa', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 41,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = idx === 0 ? 40 : idx === 1 ? 38 : idx === 2 ? 36 : 35 - idx
          d.raceTime = 3000 + idx * 10
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    // Deve conter todas as 24 entradas
    expect(official.entries.length).toBe(24)

    // O 4º piloto (35 voltas) é NC e deve ocupar P4
    const p4 = official.entries[3]
    expect(p4.finalPosition).toBe(4)
    expect(p4.lapsCompleted).toBe(35)
    expect(p4.classificationStatus).toBe('NOT_CLASSIFIED')

    // Todas as posições de 1 a 24 devem estar presentes de forma contínua
    const positions = official.entries.map((e) => e.finalPosition)
    for (let p = 1; p <= 24; p++) {
      expect(positions).toContain(p)
    }
  })

  // ALLDNF01B-09: NC NÃO é convertido para FINISHED
  it('ALLDNF01B-09: pilotos NC nunca têm status alterado para finished', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 41,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = idx === 0 ? 40 : 15
          d.raceTime = 3000 + idx * 10
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    const ncEntries = official.entries.filter((e) => e.classificationStatus === 'NOT_CLASSIFIED')
    expect(ncEntries.length).toBe(23)
    ncEntries.forEach((e) => {
      expect(e.status).toBe('dnf')
      expect(e.finishStatus).toBe('dnf')
      expect(e.status).not.toBe('finished')
    })
  })

  // ALLDNF01B-10: CLASSIFIED DNF continua com raceStatus DNF
  it('ALLDNF01B-10: piloto CLASSIFIED que abandonou continua com status e dnf indicando DNF', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 41,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 40
          d.raceTime = 3000 + idx * 10
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    official.entries.forEach((e) => {
      expect(e.classificationStatus).toBe('CLASSIFIED')
      expect(e.status).toBe('dnf')
      expect(e.dnf).toBe(true)
      expect(e.status).not.toBe('finished')
    })
  })

  // ALLDNF01B-11: zero complete laps -> não usa grid automaticamente como classificação final
  it('ALLDNF01B-11: zero voltas completas por todos os pilotos não gera classificação esportiva artificial pela grid', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 1,
      setupDrivers: (drivers) => {
        drivers.forEach((d) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 0
          d.raceTime = 0
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    // Nenhum piloto atinge os 90% (leaderLaps = 0) -> todos NOT_CLASSIFIED
    official.entries.forEach((e) => {
      expect(e.classificationStatus).toBe('NOT_CLASSIFIED')
      expect(e.isClassified).toBe(false)
      expect(e.pointsAwarded).toBe(0)
    })
  })

  // ALLDNF01B-12: zero complete laps com timing canônico válido -> usa somente fonte real de timing
  it('ALLDNF01B-12: zero voltas completas com timing canônico válido de corrida respeita timing real sem fallback para grid', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 1,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 0
          // drv_10 teve abandono mais tarde na volta de abertura (timing real maior/menor)
          // Se tiver raceTime diferente (ex: setor 1/2 antes de abandonar), o motor ordena por raceTime
          d.raceTime = idx === 9 ? 35.2 : 45.0 + idx
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    // drv_10 (idx=9) com raceTime 35.2 deve vir à frente de drv_01 (grid 1 com raceTime 45.0)
    expect(official.entries[0].driverId).toBe('drv_10')
    expect(official.entries[0].finalPosition).toBe(1)
  })

  // ALLDNF01B-13: resultado ALL-DNF usa o pipeline canônico de classificação (officializeRace / createOfficialRaceResult)
  it('ALLDNF01B-13: resultado All-DNF é produzido pelo mesmo pipeline canônico officializeRace', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 35,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 34 - (idx % 5)
          d.raceTime = 2800 + idx * 10
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.officializeRace(finished)

    expect(official).toBeDefined()
    expect(official.schemaVersion).toBe('official-race-result-v1')
    expect(official.totalLaps).toBe(58)
    expect(official.entries.length).toBe(24)
    expect(resultService.verifyResultIntegrity(official)).toBe(true)
  })

  // ALLDNF01B-14: corrida normal com finishers + DNF não sofre regressão
  it('ALLDNF01B-14: corrida mista normal (finishers + DNFs) não sofre regressão no pipeline canônico', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 58,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          if (idx < 18) {
            // 18 finishers
            d.raceStatus = 'racing'
            d.isDnf = false
            d.lap = 58
            d.raceTime = 5200 + idx * 2.5
          } else {
            // 6 DNFs
            d.raceStatus = 'dnf'
            d.isDnf = true
            d.lap = 30 + (idx % 10)
            d.raceTime = 3000 + idx * 10
          }
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    expect(official.entries.length).toBe(24)
    // Os 18 primeiros são finished
    for (let i = 0; i < 18; i++) {
      expect(official.entries[i].status).toBe('finished')
      expect(official.entries[i].classificationStatus).toBe('CLASSIFIED')
    }
    // Os 6 últimos são DNF
    for (let i = 18; i < 24; i++) {
      expect(official.entries[i].status).toBe('dnf')
      expect(official.entries[i].dnf).toBe(true)
    }
  })

  // ALLDNF01B-15: save/reload preserva posição, DNF, CLASSIFIED/NC, lapsCompleted
  it('ALLDNF01B-15: save e reload preservam intactos os campos esportivos e de classificação da corrida All-DNF', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 41,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          // P1=40, P2=38, P3=36 (CLASSIFIED), P4=35 (NC)
          d.lap = idx === 0 ? 40 : idx === 1 ? 38 : idx === 2 ? 36 : 35
          d.raceTime = 3000 + idx * 10
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.officializeRace(finished)
    const saved = resultService.saveOfficialRaceResult(official, true)
    expect(saved).toBe(true)

    const loaded = resultService.loadOfficialResult(careerId, season, raceId)
    expect(loaded).not.toBeNull()
    expect(loaded!.entries.length).toBe(24)

    const p1 = loaded!.entries[0]
    expect(p1.finalPosition).toBe(1)
    expect(p1.lapsCompleted).toBe(40)
    expect(p1.classificationStatus).toBe('CLASSIFIED')
    expect(p1.status).toBe('dnf')

    const p3 = loaded!.entries[2]
    expect(p3.finalPosition).toBe(3)
    expect(p3.lapsCompleted).toBe(36)
    expect(p3.classificationStatus).toBe('CLASSIFIED')

    const p4 = loaded!.entries[3]
    expect(p4.finalPosition).toBe(4)
    expect(p4.lapsCompleted).toBe(35)
    expect(p4.classificationStatus).toBe('NOT_CLASSIFIED')
  })

  // ALLDNF01B-16: reconstruir a classificação para o mesmo estado final é determinístico e não altera a ordem
  it('ALLDNF01B-16: reconstrução da classificação oficial a partir do mesmo estado final é 100% determinística', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 41,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 40 - (idx % 8)
          d.raceTime = 3000 + idx * 15
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const result1 = resultService.createOfficialRaceResult(finished)
    const result2 = resultService.createOfficialRaceResult(finished)

    expect(result1.entries.length).toBe(result2.entries.length)
    for (let i = 0; i < result1.entries.length; i++) {
      const e1 = result1.entries[i]
      const e2 = result2.entries[i]
      expect(e1.driverId).toBe(e2.driverId)
      expect(e1.finalPosition).toBe(e2.finalPosition)
      expect(e1.lapsCompleted).toBe(e2.lapsCompleted)
      expect(e1.raceTime).toBe(e2.raceTime)
      expect(e1.status).toBe(e2.status)
      expect(e1.classificationStatus).toBe(e2.classificationStatus)
    }
  })
})
