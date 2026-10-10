/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // GRID-R2-RECOVER-01A: Gravar o grid oficial da Rodada 2 em canonical_qualifying_final_grids
    const careerId = '31b0p9k5ygw2sc8'
    const round = 2
    const gridKey = `apex_qualifying_final_grid_v2_${careerId}_r${round}`

    // 1. Verificar se o registro já existe
    try {
      const existing = app.findFirstRecordByData(
        'canonical_qualifying_final_grids',
        'grid_key',
        gridKey,
      )
      if (existing) return
    } catch (_) {}

    // 2. Buscar SQ1, SQ2 e SQ3 via SQL raw
    const getPayload = (stage) => {
      const row = new DynamicModel({ payload: '' })
      app
        .db()
        .newQuery(
          'SELECT payload FROM canonical_qualifying_stage_results WHERE career_id = {:career_id} AND round = {:round} AND stage = {:stage}',
        )
        .bind({ career_id: careerId, round: round, stage: stage })
        .one(row)
      return JSON.parse(row.payload)
    }

    const p1 = getPayload('sq1')
    const p2 = getPayload('sq2')
    const p3 = getPayload('sq3')

    const list1 = p1.entries || p1.classification || p1.results || []
    const list2 = p2.entries || p2.classification || p2.results || []
    const list3 = p3.entries || p3.classification || p3.results || []

    const top10 = list3.slice(0, 10).map((entry, idx) => {
      const sq1Entry = list1.find((e) => (e.driverId || e.id) === (entry.driverId || entry.id))
      const sq2Entry = list2.find((e) => (e.driverId || e.id) === (entry.driverId || entry.id))
      return {
        gridPosition: idx + 1,
        driverId: entry.driverId || entry.id,
        driverName: entry.driverName || entry.name,
        teamId: entry.teamId || entry.team,
        teamName: entry.teamName || '',
        teamColor: entry.teamColor || '#e10600',
        isPlayer: Boolean(entry.isPlayer),
        carId: entry.carId || undefined,
        eliminationStage: 'Q3',
        bestLapSec: typeof entry.bestLapSec === 'number' ? entry.bestLapSec : null,
        bestLapTime: entry.bestLapTime || entry.time || null,
        bestLapCompound: entry.compound || entry.bestLapCompound || entry.tyreCompound || 'macio',
        tyreSetId: entry.tyreSetId || undefined,
        q1LapTime: sq1Entry ? sq1Entry.bestLapTime || sq1Entry.time : entry.bestLapTime,
        q2LapTime: sq2Entry ? sq2Entry.bestLapTime || sq2Entry.time : entry.bestLapTime,
        q3LapTime: entry.bestLapTime || entry.time || null,
      }
    })

    const p11to18 = list2.slice(10, 18).map((entry, idx) => {
      const sq1Entry = list1.find((e) => (e.driverId || e.id) === (entry.driverId || entry.id))
      return {
        gridPosition: 11 + idx,
        driverId: entry.driverId || entry.id,
        driverName: entry.driverName || entry.name,
        teamId: entry.teamId || entry.team,
        teamName: entry.teamName || '',
        teamColor: entry.teamColor || '#e10600',
        isPlayer: Boolean(entry.isPlayer),
        carId: entry.carId || undefined,
        eliminationStage: 'Q2',
        bestLapSec: typeof entry.bestLapSec === 'number' ? entry.bestLapSec : null,
        bestLapTime: entry.bestLapTime || entry.time || null,
        bestLapCompound: entry.compound || entry.bestLapCompound || entry.tyreCompound || 'macio',
        tyreSetId: entry.tyreSetId || undefined,
        q1LapTime: sq1Entry ? sq1Entry.bestLapTime || sq1Entry.time : entry.bestLapTime,
        q2LapTime: entry.bestLapTime || entry.time || null,
        q3LapTime: undefined,
      }
    })

    const p19to24 = list1.slice(18, 24).map((entry, idx) => {
      return {
        gridPosition: 19 + idx,
        driverId: entry.driverId || entry.id,
        driverName: entry.driverName || entry.name,
        teamId: entry.teamId || entry.team,
        teamName: entry.teamName || '',
        teamColor: entry.teamColor || '#e10600',
        isPlayer: Boolean(entry.isPlayer),
        carId: entry.carId || undefined,
        eliminationStage: 'Q1',
        bestLapSec: typeof entry.bestLapSec === 'number' ? entry.bestLapSec : null,
        bestLapTime: entry.bestLapTime || entry.time || null,
        bestLapCompound: entry.compound || entry.bestLapCompound || entry.tyreCompound || 'macio',
        tyreSetId: entry.tyreSetId || undefined,
        q1LapTime: entry.bestLapTime || entry.time || null,
        q2LapTime: undefined,
        q3LapTime: undefined,
      }
    })

    const finalGrid = [...top10, ...p11to18, ...p19to24]
    const poleEntry = finalGrid[0]

    const completedAt = p3.completedAt || new Date().toISOString()
    const seasonYear = 2026

    const completeResult = {
      seasonId: careerId,
      round: round,
      completedAt: completedAt,
      poleDriverId: poleEntry.driverId,
      poleDriverName: poleEntry.driverName,
      poleLapTime: poleEntry.bestLapTime || '--:--.---',
      q1Result: p1,
      q2Result: p2,
      q3Result: p3,
      finalGrid: finalGrid,
    }

    const payloadJson = JSON.stringify(completeResult)
    const nowIso = new Date().toISOString()
    const nowDb = nowIso.replace('T', ' ').replace('Z', '')
    const randomId = $security.randomString(15)

    app
      .db()
      .newQuery(
        'INSERT OR REPLACE INTO canonical_qualifying_final_grids (id, created, updated, grid_key, career_id, season, round, payload) VALUES ({:id}, {:created}, {:updated}, {:grid_key}, {:career_id}, {:season}, {:round}, {:payload})',
      )
      .bind({
        id: randomId,
        created: nowDb,
        updated: nowDb,
        grid_key: gridKey,
        career_id: careerId,
        season: seasonYear,
        round: round,
        payload: payloadJson,
      })
      .execute()
  },
  (app) => {
    try {
      const careerId = '31b0p9k5ygw2sc8'
      const round = 2
      const gridKey = `apex_qualifying_final_grid_v2_${careerId}_r${round}`
      app
        .db()
        .newQuery('DELETE FROM canonical_qualifying_final_grids WHERE grid_key = {:grid_key}')
        .bind({ grid_key: gridKey })
        .execute()
    } catch (_) {}
  },
)
