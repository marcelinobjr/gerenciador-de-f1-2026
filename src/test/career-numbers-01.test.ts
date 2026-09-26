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
    expect(hulkStats.races).toBe(229)
    expect(hulkStats.wins).toBe(0)
    expect(hulkStats.poles).toBe(1)
    expect(hulkStats.championships).toBe(0)

    // Nico Hülkenberg via ID canônico mbj-019
    const hulkCanonical = { id: 'mbj-019', name: 'Nico Hülkenberg' }
    const hulkCanStats = getDriverCareerStats({ pilot: hulkCanonical as any })
    expect(hulkCanStats.races).toBe(229)
    expect(hulkCanStats.wins).toBe(0)
    expect(hulkCanStats.poles).toBe(1)
    expect(hulkCanStats.championships).toBe(0)

    // Max Verstappen: 206 GPs, 63 vitórias, 40 poles, 4 títulos
    const maxRecord = { id: 'mbj-001' }
    const maxStats = getDriverCareerStats({ pilot: maxRecord as any })
    expect(maxStats.races).toBe(206)
    expect(maxStats.wins).toBe(63)
    expect(maxStats.poles).toBe(40)
    expect(maxStats.championships).toBe(4)

    // Lewis Hamilton: 356 GPs, 105 vitórias, 104 poles, 7 títulos
    const lewisStats = getDriverCareerStats({ pilot: { id: 'mbj-003' } as any })
    expect(lewisStats.races).toBe(356)
    expect(lewisStats.wins).toBe(105)
    expect(lewisStats.poles).toBe(104)
    expect(lewisStats.championships).toBe(7)

    // Fernando Alonso: 401 GPs, 32 vitórias, 22 poles, 2 títulos
    const alonsoStats = getDriverCareerStats({ pilot: { id: 'mbj-009' } as any })
    expect(alonsoStats.races).toBe(401)
    expect(alonsoStats.wins).toBe(32)
    expect(alonsoStats.poles).toBe(22)
    expect(alonsoStats.championships).toBe(2)

    // Gabriel Bortoleto / Andrea Kimi Antonelli (estreantes 2026): 0 legítimo
    const bortoletoStats = getDriverCareerStats({ pilot: { id: 'mbj-020' } as any })
    expect(bortoletoStats.races).toBe(0)
    expect(bortoletoStats.wins).toBe(0)
    expect(bortoletoStats.poles).toBe(0)
    expect(bortoletoStats.championships).toBe(0)

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

    // Baseline: 229 GPs, 0 vitórias, 1 pole, 0 títulos
    // Save: +3 GPs, +1 vitória, +2 poles, +2 títulos
    expect(stats.races).toBe(229 + 3)
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
})
