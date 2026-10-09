/**
 * career_driver_stats_calculator.js
 *
 * Microbloco: RACE-CAREER-SAVE-01D2A2-A — CÁLCULO DE ESTATÍSTICAS
 *
 * Módulo JavaScript puro e isolado para cálculo de estatísticas da carreira
 * acessível diretamente dentro do diretório de hooks do PocketBase (via require(`${__hooks}/career_driver_stats_calculator.js`)).
 */

function normalizeStats(rawStats) {
  var s = rawStats || {}
  return {
    careerGps: Number(s.careerGps) || 0,
    careerWins: Number(s.careerWins) || 0,
    careerPoles: Number(s.careerPoles) || 0,
    careerPodiums: Number(s.careerPodiums) || 0,
    careerPoints: Number(s.careerPoints) || 0,
    careerFastestLaps: Number(s.careerFastestLaps) || 0,
    careerDnfs: Number(s.careerDnfs) || 0,
    careerTitles: Number(s.careerTitles) || 0,
    raceStarts: Number(s.raceStarts) || Number(s.careerGps) || 0,
    wins: Number(s.wins) || Number(s.careerWins) || 0,
    podiums: Number(s.podiums) || Number(s.careerPodiums) || 0,
    poles: Number(s.poles) || Number(s.careerPoles) || 0,
    fastestLaps: Number(s.fastestLaps) || Number(s.careerFastestLaps) || 0,
    points: Number(s.points) || Number(s.careerPoints) || 0,
    dnfs: Number(s.dnfs) || Number(s.careerDnfs) || 0,
    lapsCompleted: Number(s.lapsCompleted) || 0,
    pitStops: Number(s.pitStops) || 0,
    positionsGained: Number(s.positionsGained) || 0,
    bestFinish: s.bestFinish !== undefined && s.bestFinish !== null ? Number(s.bestFinish) : null,
    bestGridPosition:
      s.bestGridPosition !== undefined && s.bestGridPosition !== null
        ? Number(s.bestGridPosition)
        : null,
  }
}

function calculateCareerDriverStatsEffect(currentStats, resultData, context) {
  var beforeStats = normalizeStats(currentStats)
  var ctx = context || {}
  var res = resultData || {}

  var sessionType =
    ctx.sessionType || ctx.session || ctx.raceVariant || res.raceVariant || 'MAIN_RACE'
  var isSprint =
    sessionType === 'SPRINT_RACE' || sessionType === 'sprint' || sessionType === 'SPRINT'

  var driverId = res.driverId || ctx.driverId || ''
  var poleDriverId = ctx.poleDriverId || ''
  var fastestLapDriverId = ctx.fastestLapDriverId || ''

  var statusStr = String(res.status || '').toLowerCase()
  var isDns = ctx.isDns !== undefined ? Boolean(ctx.isDns) : statusStr === 'dns'
  var isDnf = ctx.isDnf !== undefined ? Boolean(ctx.isDnf) : Boolean(res.dnf) || statusStr === 'dnf'

  var sourceDeltas = res.deltas || res

  var deltaGps = 0
  if (sourceDeltas.deltaRaceStarts !== undefined) {
    deltaGps = Number(sourceDeltas.deltaRaceStarts) || 0
  } else if (sourceDeltas.deltaGps !== undefined) {
    deltaGps = Number(sourceDeltas.deltaGps) || 0
  } else if (isSprint) {
    deltaGps = 0
  } else {
    deltaGps = isDns ? 0 : 1
  }

  var deltaWins = 0
  if (sourceDeltas.deltaWins !== undefined) {
    deltaWins = Number(sourceDeltas.deltaWins) || 0
  } else if (isSprint) {
    deltaWins = 0
  } else {
    deltaWins = res.finalPosition === 1 ? 1 : 0
  }

  var deltaPodiums = 0
  if (sourceDeltas.deltaPodiums !== undefined) {
    deltaPodiums = Number(sourceDeltas.deltaPodiums) || 0
  } else if (isSprint) {
    deltaPodiums = 0
  } else {
    deltaPodiums = res.finalPosition >= 1 && res.finalPosition <= 3 ? 1 : 0
  }

  var deltaPoles = 0
  if (sourceDeltas.deltaPoles !== undefined) {
    deltaPoles = Number(sourceDeltas.deltaPoles) || 0
  } else if (isSprint) {
    deltaPoles = 0
  } else {
    deltaPoles = poleDriverId && driverId && poleDriverId === driverId ? 1 : 0
  }

  var deltaFastestLaps = 0
  if (sourceDeltas.deltaFastestLaps !== undefined) {
    deltaFastestLaps = Number(sourceDeltas.deltaFastestLaps) || 0
  } else {
    deltaFastestLaps =
      (fastestLapDriverId && driverId && fastestLapDriverId === driverId) || Boolean(res.fastestLap)
        ? 1
        : 0
  }

  var deltaPoints = 0
  if (sourceDeltas.deltaPoints !== undefined) {
    deltaPoints = Number(sourceDeltas.deltaPoints) || 0
  } else if (res.pointsAwarded !== undefined) {
    deltaPoints = Number(res.pointsAwarded) || 0
  } else if (res.points !== undefined) {
    deltaPoints = Number(res.points) || 0
  }

  var deltaDnfs = 0
  if (sourceDeltas.deltaDnfs !== undefined) {
    deltaDnfs = Number(sourceDeltas.deltaDnfs) || 0
  } else {
    deltaDnfs = isDnf ? 1 : 0
  }

  var deltaTitles = Number(sourceDeltas.deltaTitles) || 0

  var deltaLapsCompleted = 0
  if (sourceDeltas.deltaLapsCompleted !== undefined) {
    deltaLapsCompleted = Number(sourceDeltas.deltaLapsCompleted) || 0
  } else if (res.lapsCompleted !== undefined) {
    deltaLapsCompleted = Number(res.lapsCompleted) || 0
  }

  var deltaPitStops = 0
  if (sourceDeltas.deltaPitStops !== undefined) {
    deltaPitStops = Number(sourceDeltas.deltaPitStops) || 0
  } else if (res.pitStops !== undefined) {
    deltaPitStops = Number(res.pitStops) || 0
  }

  var deltaPositionsGained = 0
  if (sourceDeltas.deltaPositionsGained !== undefined) {
    deltaPositionsGained = Number(sourceDeltas.deltaPositionsGained) || 0
  } else if (res.positionsGainedLost !== undefined) {
    deltaPositionsGained = Number(res.positionsGainedLost) || 0
  }

  var newFinishPosCandidate = null
  if (sourceDeltas.newFinishPosition !== undefined) {
    newFinishPosCandidate =
      sourceDeltas.newFinishPosition !== null ? Number(sourceDeltas.newFinishPosition) : null
  } else if (!isDnf && res.finalPosition !== undefined && Number(res.finalPosition) > 0) {
    newFinishPosCandidate = Number(res.finalPosition)
  }

  var afterBestFinish = beforeStats.bestFinish
  if (newFinishPosCandidate !== null && newFinishPosCandidate > 0) {
    afterBestFinish =
      afterBestFinish === null
        ? newFinishPosCandidate
        : Math.min(afterBestFinish, newFinishPosCandidate)
  }

  var newGridPosCandidate = null
  if (sourceDeltas.newGridPosition !== undefined) {
    newGridPosCandidate =
      sourceDeltas.newGridPosition !== null ? Number(sourceDeltas.newGridPosition) : null
  } else if (res.gridPosition !== undefined && Number(res.gridPosition) > 0) {
    newGridPosCandidate = Number(res.gridPosition)
  }

  var afterBestGrid = beforeStats.bestGridPosition
  if (newGridPosCandidate !== null && newGridPosCandidate > 0) {
    afterBestGrid =
      afterBestGrid === null ? newGridPosCandidate : Math.min(afterBestGrid, newGridPosCandidate)
  }

  var effectData = {
    deltaGps: deltaGps,
    deltaRaceStarts: deltaGps,
    deltaWins: deltaWins,
    deltaPodiums: deltaPodiums,
    deltaPoles: deltaPoles,
    deltaFastestLaps: deltaFastestLaps,
    deltaPoints: deltaPoints,
    deltaDnfs: deltaDnfs,
    deltaTitles: deltaTitles,
    deltaLapsCompleted: deltaLapsCompleted,
    deltaPitStops: deltaPitStops,
    deltaPositionsGained: deltaPositionsGained,
    newFinishPosition: newFinishPosCandidate,
    newGridPosition: newGridPosCandidate,
  }

  var afterStats = {
    careerGps: beforeStats.careerGps + deltaGps,
    careerWins: beforeStats.careerWins + deltaWins,
    careerPoles: beforeStats.careerPoles + deltaPoles,
    careerPodiums: beforeStats.careerPodiums + deltaPodiums,
    careerPoints: beforeStats.careerPoints + deltaPoints,
    careerFastestLaps: beforeStats.careerFastestLaps + deltaFastestLaps,
    careerDnfs: beforeStats.careerDnfs + deltaDnfs,
    careerTitles: beforeStats.careerTitles + deltaTitles,
    raceStarts: beforeStats.raceStarts + deltaGps,
    wins: beforeStats.wins + deltaWins,
    podiums: beforeStats.podiums + deltaPodiums,
    poles: beforeStats.poles + deltaPoles,
    fastestLaps: beforeStats.fastestLaps + deltaFastestLaps,
    points: beforeStats.points + deltaPoints,
    dnfs: beforeStats.dnfs + deltaDnfs,
    lapsCompleted: beforeStats.lapsCompleted + deltaLapsCompleted,
    pitStops: beforeStats.pitStops + deltaPitStops,
    positionsGained: beforeStats.positionsGained + deltaPositionsGained,
    bestFinish: afterBestFinish,
    bestGridPosition: afterBestGrid,
  }

  return {
    beforeStats: beforeStats,
    effectData: effectData,
    afterStats: afterStats,
  }
}

var moduleExports = {
  calculateCareerDriverStatsEffect: calculateCareerDriverStatsEffect,
  normalizeStats: normalizeStats,
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = moduleExports
}

export default moduleExports
export { calculateCareerDriverStatsEffect, normalizeStats }
