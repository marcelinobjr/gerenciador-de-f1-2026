/**
 * canonicalSeasonHistoryService.test.ts — Verificação da reconstrução canônica de
 * agregação de temporada (SEASON-RESET-FIX-01B item 2c).
 * Usa linhas de race_results sintéticas (valores inventados) — não toca no banco real.
 */
import {
  rebuildSeasonHistoryFromRaceResults,
  validateSeasonHistoryAggregation,
} from '../canonicalSeasonHistoryService'

describe('canonicalSeasonHistoryService — rebuildSeasonHistoryFromRaceResults', () => {
  const mkRow = (
    round: number,
    driverId: string,
    teamId: string,
    position: number,
    points: number,
  ) => ({
    round,
    driver_id: driverId,
    team_id: teamId,
    position,
    points,
    expand: {
      driver_id: { name: driverId, nationality: 'Brasil' },
      team_id: {
        name: teamId,
        color: '#FF0000',
        engine_supplier: 'Ferrari',
        is_player: teamId === 'team_a',
      },
    },
  })

  it('acumula todas as rodadas corretamente (pilotos e equipes)', () => {
    const rows = [
      mkRow(1, 'd1', 'team_a', 1, 25),
      mkRow(1, 'd2', 'team_b', 2, 18),
      mkRow(2, 'd1', 'team_a', 3, 15),
      mkRow(2, 'd2', 'team_b', 1, 25),
    ]
    const hist = rebuildSeasonHistoryFromRaceResults(rows)
    expect(hist.totalRaces).toBe(2)
    expect(hist.driverStandings[0].driverId).toBe('d1')
    expect(hist.driverStandings[0].points).toBe(40)
    expect(hist.driverStandings[0].wins).toBe(1)
    expect(hist.driverStandings[0].podiums).toBe(2)
    expect(hist.driverStandings[1].driverId).toBe('d2')
    expect(hist.driverStandings[1].points).toBe(43)
    expect(hist.constructorStandings[0].teamId).toBe('team_b')
    expect(hist.constructorStandings[0].points).toBe(43)
  })

  it('descarta posições inválidas sem atribuir pontos fictícios', () => {
    const rows = [mkRow(1, 'd1', 'team_a', 1, 25), mkRow(1, 'd2', 'team_b', 0, 0)]
    const hist = rebuildSeasonHistoryFromRaceResults(rows)
    const d2 = hist.driverStandings.find((d) => d.driverId === 'd2')!
    expect(d2.points).toBe(0)
    expect(d2.wins).toBe(0)
    expect(d2.podiums).toBe(0)
  })

  it('valida que vitórias impossíveis (ex: 38 em 24 corridas) são detectadas', () => {
    const rows = [mkRow(1, 'd1', 'team_a', 1, 25), mkRow(1, 'd2', 'team_b', 2, 18)]
    const hist = rebuildSeasonHistoryFromRaceResults(rows)
    // Forçar vitória impossível para validar o detector
    const forced = {
      ...hist,
      driverStandings: [{ ...hist.driverStandings[0], wins: 38, podiums: 45 }],
    }
    const validation = validateSeasonHistoryAggregation(forced as any)
    expect(validation.isValid).toBe(false)
    expect(validation.errors.length).toBeGreaterThan(0)
  })

  it('agregação coerente passa na validação regulamentar', () => {
    const rows: any[] = []
    for (let r = 1; r <= 24; r++) {
      rows.push(mkRow(r, 'd1', 'team_a', 1, 25))
      rows.push(mkRow(r, 'd2', 'team_a', 4, 12))
      rows.push(mkRow(r, 'd3', 'team_b', 2, 18))
      rows.push(mkRow(r, 'd4', 'team_b', 3, 15))
    }
    const hist = rebuildSeasonHistoryFromRaceResults(rows)
    expect(hist.totalRaces).toBe(24)
    expect(hist.driverStandings[0].wins).toBe(24)
    const validation = validateSeasonHistoryAggregation(hist)
    expect(validation.isValid).toBe(true)
    expect(validation.errors).toEqual([])
  })
})
