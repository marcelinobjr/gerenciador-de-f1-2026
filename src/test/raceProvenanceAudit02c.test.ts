import { describe, it, expect } from 'vitest'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import raceRegrasParametros from '@/assets/01raceregraseparametros-3c0c5.json'

describe('RACE-PROVENANCE-AUDIT-02A2-C: Número de voltas dos 24 GPs', () => {
  it('valida equivalência estrita 24/24 entre fonte canônica e motor atual', () => {
    // 1. Extrair os 24 circuitos da aba Pistas do JSON canônico (01raceregraseparametros)
    const rawData = raceRegrasParametros as any
    const tracksSheet = rawData.sheets?.tracks || rawData.tables?.tracks
    expect(tracksSheet).toBeDefined()
    expect(tracksSheet.rows).toHaveLength(24)

    // Mapa de voltas da fonte indexado por rodada (Coluna M: Rodada (jogo), Coluna C: Voltas)
    const sourceTracksByRound = new Map<number, { name: string; laps: number; round: number }>()
    for (const r of tracksSheet.rows) {
      const round = Number(r.values.M)
      const laps = Number(r.values.C)
      const name = String(r.values.N)
      sourceTracksByRound.set(round, { name, laps, round })
    }

    expect(sourceTracksByRound.size).toBe(24)

    // 2. Confrontar com F1_2026_CALENDAR consumido pelo motor
    expect(F1_2026_CALENDAR).toHaveLength(24)

    let matchCount = 0
    let divergentCount = 0
    let fallbackCount = 0
    let missingCount = 0

    const results: Array<{
      round: number
      gp: string
      sourceLaps: number
      engineLaps: number
      status: 'MATCH' | 'DIVERGENTE' | 'FALLBACK' | 'AUSENTE'
    }> = []

    for (let round = 1; round <= 24; round++) {
      const source = sourceTracksByRound.get(round)
      const engineGp = F1_2026_CALENDAR.find((g) => g.round === round)

      if (!source || !engineGp) {
        missingCount++
        results.push({
          round,
          gp: engineGp?.name || source?.name || 'DESCONHECIDO',
          sourceLaps: source?.laps ?? 0,
          engineLaps: engineGp?.laps ?? 0,
          status: 'AUSENTE',
        })
        continue
      }

      if (engineGp.laps === source.laps) {
        matchCount++
        results.push({
          round,
          gp: engineGp.name,
          sourceLaps: source.laps,
          engineLaps: engineGp.laps,
          status: 'MATCH',
        })
      } else {
        divergentCount++
        results.push({
          round,
          gp: engineGp.name,
          sourceLaps: source.laps,
          engineLaps: engineGp.laps,
          status: 'DIVERGENTE',
        })
      }
    }

    // Sanity checks específicos exigidos pelo enunciado
    const bahrain = F1_2026_CALENDAR.find((g) => g.round === 4)
    const abuDhabi = F1_2026_CALENDAR.find((g) => g.round === 24)
    expect(bahrain?.laps).toBe(57)
    expect(abuDhabi?.laps).toBe(58)

    // Invariantes C5..C9
    expect(results).toHaveLength(24)
    expect(matchCount).toBe(24)
    expect(divergentCount).toBe(0)
    expect(fallbackCount).toBe(0)
    expect(missingCount).toBe(0)
  })
})
