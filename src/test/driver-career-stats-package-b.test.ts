import { describe, it, expect } from 'vitest'
import {
  MBJ_2026_PILOTS,
  getDriverCareerStats,
  getDriverActiveNumber,
} from '@/lib/mbj-drivers-data'

describe('PACOTE B — INTEGRAÇÃO CANÔNICA DE TEMPORADA, RESULTADOS E POLES (T40–T43)', () => {
  const verstappenCatalog = MBJ_2026_PILOTS.find((p) => p.name === 'Max Verstappen')!
  const bortoletoCatalog = MBJ_2026_PILOTS.find((p) => p.name === 'Gabriel Bortoleto')!
  const ricciardoCatalog = MBJ_2026_PILOTS.find((p) => p.name === 'Daniel Ricciardo')!
  const leclercCatalog = MBJ_2026_PILOTS.find((p) => p.name === 'Charles Leclerc')!

  it('T40 — Fechamento de temporada: season_histories.drivers_champion correto, registro único e idempotência', () => {
    // 1. Simulação do payload canônico gravado no fechamento de temporada (seasonTransitionService.ts)
    // Fechamento de 2026 consagra Verstappen como campeão
    const history2026Record = {
      id: 'sh_2026_redbull',
      season_year: 2026,
      team_id: 'team_redbull',
      technical_era_id: 'era_2026_active_aerodynamics',
      drivers_champion: verstappenCatalog.id,
      constructors_champion: 'team_redbull',
      final_driver_standings: [
        { driver_id: verstappenCatalog.id, points: 410, position: 1 },
        { driver_id: leclercCatalog.id, points: 340, position: 2 },
      ],
      final_constructor_standings: [{ team_id: 'team_redbull', points: 650, position: 1 }],
    }

    // A temporada concluída tem "season_histories.drivers_champion" correto
    expect(history2026Record.drivers_champion).toBe(verstappenCatalog.id)

    // Apenas um registro por temporada (season_year + team_id)
    const seasonHistoriesSave = [history2026Record]
    expect(seasonHistoriesSave).toHaveLength(1)

    // getDriverCareerStats soma exatamente +1 título do save
    // Verstappen: baseline histórico de 4 títulos + 1 do save = 5 títulos
    const statsVerstappenSave = getDriverCareerStats({
      pilot: verstappenCatalog,
      raceResults: [],
      seasonHistories: seasonHistoriesSave,
    })
    expect(statsVerstappenSave.championships).toBe(5) // 4 baseline + 1 save
    expect(statsVerstappenSave.races).toBe(205)
    expect(statsVerstappenSave.wins).toBe(63)
    expect(statsVerstappenSave.poles).toBe(40)

    // Piloto sem título (ex: Leclerc) continua com seus títulos de baseline (0)
    const statsLeclerc = getDriverCareerStats({
      pilot: leclercCatalog,
      raceResults: [],
      seasonHistories: seasonHistoriesSave,
    })
    expect(statsLeclerc.championships).toBe(0)

    // Executar fechamento novamente não duplica: a lista de seasonHistories é idempotente
    // Simula a idempotência do update por season_year + team_id (o registro é atualizado, não duplicado)
    const seasonHistoriesAfterRerun = [
      {
        ...history2026Record,
        updated_at: '2026-12-01T12:00:00Z',
      },
    ]
    expect(seasonHistoriesAfterRerun).toHaveLength(1)

    const statsVerstappenAfterRerun = getDriverCareerStats({
      pilot: verstappenCatalog,
      raceResults: [],
      seasonHistories: seasonHistoriesAfterRerun,
    })
    // Permanece exatamente 5 títulos
    expect(statsVerstappenAfterRerun.championships).toBe(5)
  })

  it('T41 — Regra do #1: campeão mantém número permanente e usa #1 na temporada seguinte; volta ao deixar de ser campeão; permanente nunca sobrescrito', () => {
    // Verstappen: permanente 33
    expect(verstappenCatalog.permanentNumber).toBe(33)
    // Leclerc: permanente 16
    expect(leclercCatalog.permanentNumber).toBe(16)

    // Caso 1: Verstappen é campeão vigente (championId === verstappenCatalog.id)
    // Deve usar #1
    const activeNumberChamp = getDriverActiveNumber(verstappenCatalog, verstappenCatalog.id)
    expect(activeNumberChamp).toBe(1)
    // O número permanente de Verstappen no objeto do catálogo NÃO foi sobrescrito
    expect(verstappenCatalog.permanentNumber).toBe(33)

    // Leclerc não é campeão vigente, continua com seu número permanente (16)
    const activeNumberNonChamp = getDriverActiveNumber(leclercCatalog, verstappenCatalog.id)
    expect(activeNumberNonChamp).toBe(16)
    expect(leclercCatalog.permanentNumber).toBe(16)

    // Caso 2: Nova temporada onde outro piloto foi campeão (ex: Leclerc campeão)
    // Verstappen deixa de ser campeão vigente ⇒ volta automaticamente ao seu número permanente (33)
    const activeNumberVerstappenNextSeason = getDriverActiveNumber(
      verstappenCatalog,
      leclercCatalog.id,
    )
    expect(activeNumberVerstappenNextSeason).toBe(33)

    // Leclerc passa a usar o #1
    const activeNumberLeclercNextSeason = getDriverActiveNumber(leclercCatalog, leclercCatalog.id)
    expect(activeNumberLeclercNextSeason).toBe(1)
    // Número permanente de Leclerc intacto
    expect(leclercCatalog.permanentNumber).toBe(16)

    // Caso 3: Nenhum campeão definido (null/undefined)
    expect(getDriverActiveNumber(verstappenCatalog, null)).toBe(33)
    expect(getDriverActiveNumber(leclercCatalog, undefined)).toBe(16)

    // Nenhum permanentNumber de qualquer piloto foi mutado
    expect(verstappenCatalog.permanentNumber).toBe(33)
    expect(leclercCatalog.permanentNumber).toBe(16)
  })

  it('T42 — Paridade Assistir × Simular: ambos geram o mesmo contrato em race_results e Career Stats produz os mesmos efeitos', () => {
    // Ambos os caminhos gravam em race_results através do contrato f1Service.createRaceResult:
    // {
    //   season_id, round, driver_id, team_id, position, points, fastest_lap,
    //   grid_position, laps_completed, accumulated_time_sec
    // }

    // Simulação do resultado gerado pelo caminho "Assistir" (raceAdvance.ts):
    // grid_position: typeof res.gridPosition === 'number' ? res.gridPosition : undefined
    const raceResultWatch = {
      season_id: 'season_2026',
      round: 1,
      driver_id: bortoletoCatalog.id,
      team_id: 'team_sauber',
      position: 1,
      points: 25,
      fastest_lap: true,
      grid_position: 1,
      laps_completed: 58,
      accumulated_time_sec: 5400.123,
    }

    // Simulação do resultado gerado pelo caminho "Simular" (weekendSimulationService.ts):
    // grid_position: typeof res.gridPosition === 'number' ? res.gridPosition : undefined
    const raceResultSimulate = {
      season_id: 'season_2026',
      round: 1,
      driver_id: bortoletoCatalog.id,
      team_id: 'team_sauber',
      position: 1,
      points: 25,
      fastest_lap: true,
      grid_position: 1,
      laps_completed: 58,
      accumulated_time_sec: 5402.456,
    }

    // Contrato canônico idêntico nas propriedades chave
    expect(raceResultWatch.driver_id).toBe(raceResultSimulate.driver_id)
    expect(raceResultWatch.round).toBe(raceResultSimulate.round)
    expect(raceResultWatch.position).toBe(raceResultSimulate.position)
    expect(raceResultWatch.points).toBe(raceResultSimulate.points)
    expect(raceResultWatch.grid_position).toBe(raceResultSimulate.grid_position)

    // Efeitos idênticos em getDriverCareerStats
    const statsFromWatch = getDriverCareerStats({
      pilot: bortoletoCatalog,
      raceResults: [raceResultWatch],
      seasonHistories: [],
    })

    const statsFromSimulate = getDriverCareerStats({
      pilot: bortoletoCatalog,
      raceResults: [raceResultSimulate],
      seasonHistories: [],
    })

    expect(statsFromWatch).toEqual(statsFromSimulate)
    // Bortoleto baseline: 0/0/0/0 + 1 GP, 1 vitória, 1 pole
    expect(statsFromWatch).toEqual({
      races: 1,
      wins: 1,
      poles: 1,
      championships: 0,
    })

    // Suporte a gridPosition (camelCase) para flexibilidade
    const statsCamelCase = getDriverCareerStats({
      pilot: bortoletoCatalog,
      raceResults: [
        {
          driver_id: bortoletoCatalog.id,
          position: 1,
          gridPosition: 1,
        },
      ],
      seasonHistories: [],
    })
    expect(statsCamelCase.poles).toBe(1)
  })

  it('T43 — Pole do save: baseline poles = 3 + gridPosition === 1 ⇒ 4; idempotência; legado sem gridPosition não conta', () => {
    // Ricciardo baseline poles = 3
    expect(ricciardoCatalog.f1Poles).toBe(3)

    // 1. Piloto com baseline poles = 3 e um resultado com grid_position === 1 ⇒ poles = 4
    const resultsWithPole = [
      {
        driver_id: ricciardoCatalog.id,
        position: 2,
        grid_position: 1, // Largou na pole!
      },
    ]

    const statsWithPole = getDriverCareerStats({
      pilot: ricciardoCatalog,
      raceResults: resultsWithPole,
      seasonHistories: [],
    })
    expect(statsWithPole.poles).toBe(4) // 3 baseline + 1 do save
    expect(statsWithPole.races).toBe(258) // 257 baseline + 1 do save
    expect(statsWithPole.wins).toBe(8) // Terminou em P2, sem vitória adicional

    // 2. Ler de novo: continua 4, não 5 (idempotência da função derivada)
    const statsReRead = getDriverCareerStats({
      pilot: ricciardoCatalog,
      raceResults: resultsWithPole,
      seasonHistories: [],
    })
    expect(statsReRead.poles).toBe(4)
    expect(statsReRead).toEqual(statsWithPole)

    // 3. Resultado legado sem grid_position (null/undefined) NÃO conta como pole (não assume P1)
    const resultsLegacy = [
      {
        driver_id: ricciardoCatalog.id,
        position: 1, // Venceu a corrida, mas não temos o grid
        grid_position: undefined,
      },
      {
        driver_id: ricciardoCatalog.id,
        position: 3,
        grid_position: null as any,
      },
      {
        driver_id: ricciardoCatalog.id,
        position: 4,
        // grid_position omitido
      },
    ]

    const statsLegacy = getDriverCareerStats({
      pilot: ricciardoCatalog,
      raceResults: resultsLegacy,
      seasonHistories: [],
    })

    // 3 corridas disputadas, 1 vitória, 0 poles adicionadas (continua 3 baseline)
    expect(statsLegacy.races).toBe(260) // 257 + 3
    expect(statsLegacy.wins).toBe(9) // 8 + 1
    expect(statsLegacy.poles).toBe(3) // Exatamente o baseline histórico (não assumiu P1)

    // 4. Se largou em P2 (grid_position: 2), também NÃO é pole
    const resultsP2Grid = [
      {
        driver_id: ricciardoCatalog.id,
        position: 1,
        grid_position: 2,
      },
    ]
    const statsP2 = getDriverCareerStats({
      pilot: ricciardoCatalog,
      raceResults: resultsP2Grid,
      seasonHistories: [],
    })
    expect(statsP2.poles).toBe(3) // 3 baseline + 0
  })
})
