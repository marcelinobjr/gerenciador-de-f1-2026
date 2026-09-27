import { describe, it, expect } from 'vitest'
import { getDriverCareerStats } from '@/lib/mbj-drivers-data'
import { getDriverCareerBaseline2025, DRIVER_CAREER_STATS_2025 } from '@/data/driverCareerStats2025'

describe('CAREER-NUMBERS-01: Números reais de carreira e integração canônica', () => {
  it('CN-01: Piloto com histórico real 2025 exibe baseline correto via ID canônico e alias runtime', () => {
    // Nico Hülkenberg via runtime ID do PocketBase
    const hulkenbergRuntime = {
      id: '0mow8vmzk0y4z9s',
      name: 'Nico Hülkenberg',
      // Repare: sem f1RacesCompleted, f1Wins, f1Poles, f1Championships no record do PocketBase!
    }
    const hulkStats = getDriverCareerStats({ pilot: hulkenbergRuntime as any })
    expect(hulkStats.races).toBe(250)
    expect(hulkStats.wins).toBe(0)
    expect(hulkStats.poles).toBe(1)
    expect(hulkStats.championships).toBe(0)

    // Nico Hülkenberg via ID canônico mbj-019
    const hulkCanonical = { id: 'mbj-019', name: 'Nico Hülkenberg' }
    const hulkCanStats = getDriverCareerStats({ pilot: hulkCanonical as any })
    expect(hulkCanStats.races).toBe(250)
    expect(hulkCanStats.wins).toBe(0)
    expect(hulkCanStats.poles).toBe(1)
    expect(hulkCanStats.championships).toBe(0)

    // Max Verstappen: 233 largadas, 71 vitórias, 48 poles, 4 títulos
    const maxRecord = { id: 'mbj-001' }
    const maxStats = getDriverCareerStats({ pilot: maxRecord as any })
    expect(maxStats.races).toBe(233)
    expect(maxStats.wins).toBe(71)
    expect(maxStats.poles).toBe(48)
    expect(maxStats.championships).toBe(4)

    // Lewis Hamilton: 380 largadas, 105 vitórias, 104 poles, 7 títulos
    const lewisStats = getDriverCareerStats({ pilot: { id: 'mbj-003' } as any })
    expect(lewisStats.races).toBe(380)
    expect(lewisStats.wins).toBe(105)
    expect(lewisStats.poles).toBe(104)
    expect(lewisStats.championships).toBe(7)

    // Fernando Alonso: 425 largadas, 32 vitórias, 22 poles, 2 títulos
    const alonsoStats = getDriverCareerStats({ pilot: { id: 'mbj-009' } as any })
    expect(alonsoStats.races).toBe(425)
    expect(alonsoStats.wins).toBe(32)
    expect(alonsoStats.poles).toBe(22)
    expect(alonsoStats.championships).toBe(2)

    // Gabriel Bortoleto: 24 largadas até 31/12/2025
    const bortoletoStats = getDriverCareerStats({ pilot: { id: 'mbj-020' } as any })
    expect(bortoletoStats.races).toBe(24)
    expect(bortoletoStats.wins).toBe(0)
    expect(bortoletoStats.poles).toBe(0)
    expect(bortoletoStats.championships).toBe(0)

    // Andrea Kimi Antonelli: 24 largadas até 31/12/2025
    const antonelliStats = getDriverCareerStats({ pilot: { id: 'mbj-008' } as any })
    expect(antonelliStats.races).toBe(24)
    expect(antonelliStats.wins).toBe(0)
    expect(antonelliStats.poles).toBe(0)
    expect(antonelliStats.championships).toBe(0)

    // Isack Hadjar: 23 largadas até 31/12/2025
    const hadjarStats = getDriverCareerStats({ pilot: { id: 'mbj-016' } as any })
    expect(hadjarStats.races).toBe(23)
    expect(hadjarStats.wins).toBe(0)
    expect(hadjarStats.poles).toBe(0)
    expect(hadjarStats.championships).toBe(0)

    // Piloto desconhecido / sem histórico: 0 legítimo
    const unknownStats = getDriverCareerStats({ pilot: { id: 'driver_fictional_999' } as any })
    expect(unknownStats.races).toBe(0)
    expect(unknownStats.wins).toBe(0)
    expect(unknownStats.poles).toBe(0)
    expect(unknownStats.championships).toBe(0)
  })

  it('CN-02: Soma baseline histórico 2025 com resultados persistidos do save atual', () => {
    // Nico Hülkenberg disputa 3 corridas no save, vence 1 largando da pole, e é campeão na season_histories
    const pilot = { id: '0mow8vmzk0y4z9s' } // runtime id
    const raceResults = [
      { driver_id: '0mow8vmzk0y4z9s', position: 1, grid_position: 1 }, // vitória da pole
      { driver_id: '0mow8vmzk0y4z9s', position: 4, grid_position: 3 }, // P4 largando de P3
      { driver_id: '0mow8vmzk0y4z9s', position: 2, gridPosition: 1 }, // P2 largando da pole (gridPosition camelCase)
      { driver_id: 'other_driver_123', position: 1, grid_position: 2 }, // outro piloto não afeta
    ]
    const seasonHistories = [
      { drivers_champion: '0mow8vmzk0y4z9s' },
      { drivers_champion: { id: '0mow8vmzk0y4z9s' } },
    ]

    const stats = getDriverCareerStats({
      pilot: pilot as any,
      raceResults: raceResults as any,
      seasonHistories: seasonHistories as any,
    })

    // Baseline: 250 GPs, 0 vitórias, 1 pole, 0 títulos
    // Save: +3 GPs, +1 vitória, +2 poles, +2 títulos
    expect(stats.races).toBe(250 + 3)
    expect(stats.wins).toBe(0 + 1)
    expect(stats.poles).toBe(1 + 2)
    expect(stats.championships).toBe(0 + 2)
  })

  it('CN-03: Zero regressão na cadeia 05A/05B e preservação do contrato legado se campos diretos forem passados', () => {
    // Se o piloto não tiver match no baseline 2025, preserva f1RacesCompleted / f1Wins / f1Poles / f1Championships passados
    const customPilot = {
      id: 'custom_prospect_999',
      f1RacesCompleted: 15,
      f1Wins: 2,
      f1Poles: 3,
      f1Championships: 1,
    }
    const stats = getDriverCareerStats({ pilot: customPilot as any })
    expect(stats.races).toBe(15)
    expect(stats.wins).toBe(2)
    expect(stats.poles).toBe(3)
    expect(stats.championships).toBe(1)

    // getDriverCareerBaseline2025 é seguro contra null/undefined
    expect(getDriverCareerBaseline2025(null)).toBeNull()
    expect(getDriverCareerBaseline2025(undefined)).toBeNull()
    expect(getDriverCareerBaseline2025('unknown_id_xyz')).toBeNull()
  })

  // Classe A: Validação independente com constantes literais hardcoded dos 7 registros
  it('CN-04 (Classe A): Verificação numérica independente dos sete registros históricos corrigidos', () => {
    // Valores esperados NÃO vêm de DRIVER_CAREER_STATS_2025 nem de getDriverCareerBaseline2025
    const INDEPENDENT_AUDIT = [
      {
        id: 'mbj-019',
        name: 'Hülkenberg',
        expectedRaces: 250,
        expectedWins: 0,
        expectedPoles: 1,
        expectedTitles: 0,
      },
      {
        id: 'mbj-001',
        name: 'Verstappen',
        expectedRaces: 233,
        expectedWins: 71,
        expectedPoles: 48,
        expectedTitles: 4,
      },
      {
        id: 'mbj-003',
        name: 'Hamilton',
        expectedRaces: 380,
        expectedWins: 105,
        expectedPoles: 104,
        expectedTitles: 7,
      },
      {
        id: 'mbj-009',
        name: 'Alonso',
        expectedRaces: 425,
        expectedWins: 32,
        expectedPoles: 22,
        expectedTitles: 2,
      },
      {
        id: 'mbj-020',
        name: 'Bortoleto',
        expectedRaces: 24,
        expectedWins: 0,
        expectedPoles: 0,
        expectedTitles: 0,
      },
      {
        id: 'mbj-016',
        name: 'Hadjar',
        expectedRaces: 23,
        expectedWins: 0,
        expectedPoles: 0,
        expectedTitles: 0,
      },
      {
        id: 'mbj-008',
        name: 'Antonelli',
        expectedRaces: 24,
        expectedWins: 0,
        expectedPoles: 0,
        expectedTitles: 0,
      },
    ]

    for (const record of INDEPENDENT_AUDIT) {
      const stats = getDriverCareerStats({ pilot: { id: record.id } as any })
      expect(stats.races, `${record.name} largadas incorretas`).toBe(record.expectedRaces)
      expect(stats.wins, `${record.name} vitórias incorretas`).toBe(record.expectedWins)
      expect(stats.poles, `${record.name} poles incorretas`).toBe(record.expectedPoles)
      expect(stats.championships, `${record.name} títulos incorretos`).toBe(record.expectedTitles)
    }
  })

  // Classe B: Regras específicas de agregação de largadas (DNS vs DNF, isolamento, idempotência)
  it('CN-05 (Classe B): Agregação - Hülkenberg sem eventos = 250, com duas largadas únicas = 252', () => {
    // Hülkenberg sem eventos = 250
    const baseStats = getDriverCareerStats({
      pilot: { id: 'mbj-019' } as any,
      raceResults: [],
      seasonHistories: [],
    })
    expect(baseStats.races).toBe(250)

    // Com duas largadas oficiais únicas = 252
    const twoRaces = [
      { id: 'ev-1', driver_id: 'mbj-019', position: 7 },
      { id: 'ev-2', driver_id: 'mbj-019', position: 10 },
    ]
    const statsWithTwo = getDriverCareerStats({
      pilot: { id: 'mbj-019' } as any,
      raceResults: twoRaces as any,
      seasonHistories: [],
    })
    expect(statsWithTwo.races).toBe(252)
  })

  it('CN-06 (Classe B): DNF conta como largada oficial disputada no save', () => {
    // DNF depois de largar aumenta largadas (o piloto participou do grid oficial)
    const dnfResult = [{ id: 'ev-dnf', driver_id: 'mbj-019', position: 18, status: 'DNF' }]
    const stats = getDriverCareerStats({
      pilot: { id: 'mbj-019' } as any,
      raceResults: dnfResult as any,
      seasonHistories: [],
    })
    expect(stats.races).toBe(251) // 250 baseline + 1 largada (mesmo DNF)
  })

  it('CN-07 (Classe B): DNS não aumenta largadas quando o evento não gera race_result de largada', () => {
    // DNS é ausência no grid de largada. Critério do patch: apenas largadas oficiais contam no histórico de GPs.
    // Resultados de outros pilotos não afetam Hülkenberg
    const raceWithoutHulk = [{ id: 'ev-other', driver_id: 'mbj-001', position: 1 }]
    const stats = getDriverCareerStats({
      pilot: { id: 'mbj-019' } as any,
      raceResults: raceWithoutHulk as any,
      seasonHistories: [],
    })
    expect(stats.races).toBe(250)
  })

  it('CN-08 (Classe B): Isolamento entre pilotos e sem contaminação entre chamadas subsequentes', () => {
    // Chamada do Verstappen (233)
    const statsVerstappen = getDriverCareerStats({ pilot: { id: 'mbj-001' } as any })
    expect(statsVerstappen.races).toBe(233)
    expect(statsVerstappen.wins).toBe(71)

    // Chamada imediatamente seguinte de Hülkenberg (250) - zero contaminação de historicalFound ou totais
    const statsHulk = getDriverCareerStats({ pilot: { id: 'mbj-019' } as any })
    expect(statsHulk.races).toBe(250)
    expect(statsHulk.wins).toBe(0)

    // Chamada seguinte de um piloto desconhecido sem baseline 2025
    const statsUnknown = getDriverCareerStats({ pilot: { id: 'novato_sem_registro' } as any })
    expect(statsUnknown.races).toBe(0)
    expect(statsUnknown.wins).toBe(0)

    // Retorno sem ReferenceError no caminho corrigido
    expect(() => getDriverCareerStats({ pilot: { id: 'mbj-001' } as any })).not.toThrow()
    expect(() => getDriverCareerStats({ pilot: { id: 'desconhecido' } as any })).not.toThrow()
  })

  it('CN-09 (Classe B): Reabrir consulta não duplica totais nem muta objetos de entrada', () => {
    const results = [{ driver_id: 'mbj-020', position: 5 }]
    const firstCall = getDriverCareerStats({
      pilot: { id: 'mbj-020' } as any,
      raceResults: results as any,
    })
    const secondCall = getDriverCareerStats({
      pilot: { id: 'mbj-020' } as any,
      raceResults: results as any,
    })

    expect(firstCall.races).toBe(25) // 24 + 1
    expect(secondCall.races).toBe(25)
    expect(firstCall).toEqual(secondCall)
  })
})
