/**
 * careerDriverStatsCalculator.js
 *
 * Microbloco: RACE-CAREER-SAVE-01D2A2-A — CÁLCULO DE ESTATÍSTICAS
 *
 * Módulo JavaScript puro e isolado para calcular o efeito de estatísticas
 * de um piloto na carreira.
 *
 * Compatibilidade:
 * - CommonJS (module.exports / exports) para execução em hooks do PocketBase (Goja / pb_hooks via require).
 * - ES Module export default e named export para TypeScript / Vite / Vitest.
 *
 * Restrições e Garantias:
 * - Não consulta banco, não acessa localStorage, não cria recibos.
 * - Imutável: não altera (muta) os objetos recebidos (cópia profunda/superficial isolada).
 * - Determinístico: mesmas entradas -> mesma saída.
 * - Preserva rigorosamente todas as regras e campos de updateCareerDriverStats:
 *   pontos, vitórias, GPs/raceStarts, poles, pódios, voltas mais rápidas, DNFs, títulos,
 *   voltas completadas, pit stops, posições ganhas, bestFinish e bestGridPosition.
 * - Trata devidamente as diferenças entre Corrida Principal e Sprint (ex.: não contar GP para Sprint
 *   a menos que explicitamente indicado; no modelo canônico, a Sprint não pontua vitória de GP nem GP corrida).
 */

/**
 * Normaliza e sanitiza um objeto de estatísticas base.
 * @param {Object} rawStats
 * @returns {Object}
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

/**
 * Calcula o efeito das estatísticas do piloto com base no resultado da corrida.
 *
 * Assinatura:
 * calculateCareerDriverStatsEffect(currentStats, resultData, context)
 *
 * @param {Object} currentStats - Estatísticas atuais do piloto (objeto de entrada não mutado)
 * @param {Object} resultData - Dados canônicos do resultado da sessão/corrida para o piloto
 *                              Pode ser a entrada do piloto (OfficialRaceResultEntry / snapshot entry)
 *                              ou um conjunto de deltas pré-calculados.
 * @param {Object} context - Contexto explícito da sessão/temporada:
 *                           - session / sessionType / raceVariant: 'MAIN_RACE' | 'SPRINT_RACE' | string
 *                           - poleDriverId: string (piloto que fez pole na sessão)
 *                           - fastestLapDriverId: string (piloto da volta mais rápida)
 *                           - isDnf: boolean opcional
 *                           - isDns: boolean opcional
 *
 * @returns {{ beforeStats: Object, effectData: Object, afterStats: Object }}
 */
function calculateCareerDriverStatsEffect(currentStats, resultData, context) {
  var beforeStats = normalizeStats(currentStats)
  var ctx = context || {}
  var res = resultData || {}

  // Determinar variante de corrida / sessão
  var sessionType =
    ctx.sessionType || ctx.session || ctx.raceVariant || res.raceVariant || 'MAIN_RACE'
  var isSprint =
    sessionType === 'SPRINT_RACE' || sessionType === 'sprint' || sessionType === 'SPRINT'

  // Identificar se o piloto é o poleman ou fez a volta mais rápida
  var driverId = res.driverId || ctx.driverId || ''
  var poleDriverId = ctx.poleDriverId || ''
  var fastestLapDriverId = ctx.fastestLapDriverId || ''

  // Avaliação de status de abandono / não largada
  var statusStr = String(res.status || '').toLowerCase()
  var isDns = ctx.isDns !== undefined ? Boolean(ctx.isDns) : statusStr === 'dns'
  var isDnf = ctx.isDnf !== undefined ? Boolean(ctx.isDnf) : Boolean(res.dnf) || statusStr === 'dnf'

  // Deltas: se fornecidos diretamente em res (ou res.deltas), priorizá-los
  var sourceDeltas = res.deltas || res

  // 1. GPs / Race Starts:
  // - Na corrida principal, conta +1 largada se não for DNS.
  // - Na Sprint, a F1 oficial e o sistema canônico não contabilizam Grande Prêmio/GP iniciado
  //   (a não ser que deltaRaceStarts ou deltaGps seja explicitamente especificado na entrada).
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

  // 2. Vitórias (Wins):
  // - Na Sprint, vitória em Sprint Race não soma vitória de Grande Prêmio (GP) canônico.
  var deltaWins = 0
  if (sourceDeltas.deltaWins !== undefined) {
    deltaWins = Number(sourceDeltas.deltaWins) || 0
  } else if (isSprint) {
    deltaWins = 0
  } else {
    deltaWins = res.finalPosition === 1 ? 1 : 0
  }

  // 3. Pódios (Podiums):
  // - Na Sprint, top 3 em Sprint não soma pódio de Grande Prêmio canônico.
  var deltaPodiums = 0
  if (sourceDeltas.deltaPodiums !== undefined) {
    deltaPodiums = Number(sourceDeltas.deltaPodiums) || 0
  } else if (isSprint) {
    deltaPodiums = 0
  } else {
    deltaPodiums = res.finalPosition >= 1 && res.finalPosition <= 3 ? 1 : 0
  }

  // 4. Poles:
  // - Pole na corrida principal (ou explicitada)
  var deltaPoles = 0
  if (sourceDeltas.deltaPoles !== undefined) {
    deltaPoles = Number(sourceDeltas.deltaPoles) || 0
  } else if (isSprint) {
    deltaPoles = 0
  } else {
    deltaPoles = poleDriverId && driverId && poleDriverId === driverId ? 1 : 0
  }

  // 5. Voltas Mais Rápidas (Fastest Laps):
  var deltaFastestLaps = 0
  if (sourceDeltas.deltaFastestLaps !== undefined) {
    deltaFastestLaps = Number(sourceDeltas.deltaFastestLaps) || 0
  } else {
    deltaFastestLaps =
      (fastestLapDriverId && driverId && fastestLapDriverId === driverId) || Boolean(res.fastestLap)
        ? 1
        : 0
  }

  // 6. Pontos (Points):
  // Ambos (Sprint e Principal) atribuem pontos conforme definidos em pointsAwarded ou deltaPoints
  var deltaPoints = 0
  if (sourceDeltas.deltaPoints !== undefined) {
    deltaPoints = Number(sourceDeltas.deltaPoints) || 0
  } else if (res.pointsAwarded !== undefined) {
    deltaPoints = Number(res.pointsAwarded) || 0
  } else if (res.points !== undefined) {
    deltaPoints = Number(res.points) || 0
  }

  // 7. DNFs (Abandono):
  var deltaDnfs = 0
  if (sourceDeltas.deltaDnfs !== undefined) {
    deltaDnfs = Number(sourceDeltas.deltaDnfs) || 0
  } else {
    deltaDnfs = isDnf ? 1 : 0
  }

  // 8. Títulos:
  var deltaTitles = Number(sourceDeltas.deltaTitles) || 0

  // 9. Voltas completadas (Laps Completed):
  var deltaLapsCompleted = 0
  if (sourceDeltas.deltaLapsCompleted !== undefined) {
    deltaLapsCompleted = Number(sourceDeltas.deltaLapsCompleted) || 0
  } else if (res.lapsCompleted !== undefined) {
    deltaLapsCompleted = Number(res.lapsCompleted) || 0
  }

  // 10. Pit Stops:
  var deltaPitStops = 0
  if (sourceDeltas.deltaPitStops !== undefined) {
    deltaPitStops = Number(sourceDeltas.deltaPitStops) || 0
  } else if (res.pitStops !== undefined) {
    deltaPitStops = Number(res.pitStops) || 0
  }

  // 11. Posições Ganhas/Perdidas (Positions Gained):
  var deltaPositionsGained = 0
  if (sourceDeltas.deltaPositionsGained !== undefined) {
    deltaPositionsGained = Number(sourceDeltas.deltaPositionsGained) || 0
  } else if (res.positionsGainedLost !== undefined) {
    deltaPositionsGained = Number(res.positionsGainedLost) || 0
  }

  // 12. Atualizações não aditivas:
  // bestFinish: menor valor numérico > 0 (não contar DNF se abandonou)
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

  // bestGridPosition: menor valor numérico > 0
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

  // Montar effectData (cópia limpa dos deltas calculados)
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

  // Montar afterStats (sem mutação do objeto de entrada)
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

// Exportação universal (CommonJS / PocketBase goja hooks + ESM)
var moduleExports = {
  calculateCareerDriverStatsEffect: calculateCareerDriverStatsEffect,
  normalizeStats: normalizeStats,
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = moduleExports
}

// Suporte para ES Module import padrão
export default moduleExports
export { calculateCareerDriverStatsEffect, normalizeStats }
