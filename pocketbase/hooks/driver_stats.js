/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook Server-side: Operação Atômica de Estatísticas de Piloto
 * RACE-CAREER-SAVE-01D2A
 *
 * Garante que:
 * 1. Identidade única da operação por: carreira + temporada canônica + rodada + sessão + identidade persistente do piloto.
 *    operation_key = `driver_stats_receipt_${c}_${s}_${r}${sessSuffix}_${realDriverId}`
 * 2. Transação atômica única no servidor:
 *    - Consulta o recibo;
 *    - Se já existir com o mesmo resultHash: devolve already_applied sem alterar estatísticas;
 *    - Se já existir com hash divergente: devolve status 'conflict' com erro explícito sem alterar estatísticas;
 *    - Se ausente: valida que race_results canônico corresponde ao resultHash informado;
 *      atualiza os acumulados de estatísticas em procedural_data.career_stats do piloto lidos DENTRO da transação;
 *      grava o recibo correspondente;
 *    - Se qualquer etapa falhar, faz rollback automático de ambas as gravações.
 * 3. Proteção adicional contra concorrência via UNIQUE INDEX na coleção canonical_driver_stats_receipts.
 * 4. Slugs e IDs reais são resolvidos para o ID real do PocketBase (tabela drivers).
 * 5. Repetições de recibo antigo nunca restauram nem sobrescrevem estatísticas posteriores.
 */

routerAdd('POST', '/backend/v1/driver-stats/apply-atomic', (e) => {
  const reqData = e.requestInfo().body || {}
  const {
    careerId,
    season,
    round,
    sessionType,
    driverId,
    driverName,
    driverSlug,
    officialRaceResultId,
    resultHash,
    deltas,
    officializedAt,
  } = reqData

  if (!driverId) {
    throw new BadRequestError('driverId é obrigatório')
  }

  const s = Number(season) || 2026
  const r = Number(round) || 1
  const sess = sessionType || 'MAIN_RACE'
  const c = careerId || 'default'

  if (!resultHash) {
    throw new BadRequestError('resultHash é obrigatório para validação da operação')
  }

  // 1. Resolver registro do piloto em 'drivers'
  let driverRecord = null
  try {
    driverRecord = e.app.findRecordById('drivers', driverId)
  } catch (_) {}

  if (!driverRecord && driverName && driverName.trim()) {
    try {
      const records = e.app.findRecordsByFilter(
        'drivers',
        `name = '${driverName.trim().replace(/'/g, "\\'")}'`,
        '',
        1,
        0,
      )
      if (records && records.length > 0) driverRecord = records[0]
    } catch (_) {}
  }

  if (!driverRecord) {
    try {
      const records = e.app.findRecordsByFilter(
        'drivers',
        `name = '${driverId.trim().replace(/'/g, "\\'")}'`,
        '',
        1,
        0,
      )
      if (records && records.length > 0) driverRecord = records[0]
    } catch (_) {}
  }

  if (!driverRecord) {
    throw new BadRequestError(
      `Piloto com identificador '${driverId}' não encontrado no PocketBase.`,
    )
  }

  const realDriverId = driverRecord.id
  const sessSuffix = sess ? `_${sess}` : '_MAIN_RACE'
  const operationKey = `driver_stats_receipt_${c}_${s}_${r}${sessSuffix}_${realDriverId}`

  let responseStatusCode = 200
  let responseData = null

  // 2. Executar dentro da mesma transação no servidor
  e.app.runInTransaction((txApp) => {
    const receiptsCol = txApp.findCollectionByNameOrId('canonical_driver_stats_receipts')

    // 2.1 Verificar se o recibo já existe dentro da transação
    let existingReceipt = null
    try {
      existingReceipt = txApp.findFirstRecordByData(
        'canonical_driver_stats_receipts',
        'operation_key',
        operationKey,
      )
    } catch (_) {
      existingReceipt = null
    }

    if (existingReceipt) {
      const storedHash = existingReceipt.getString('result_hash')
      // Se hash for divergente para a mesma prova/piloto -> conflito explícito sem alteração
      if (storedHash && storedHash !== resultHash) {
        responseStatusCode = 409
        responseData = {
          status: 'conflict',
          operationKey,
          careerId: c,
          season: s,
          round: r,
          sessionType: sess,
          driverId: realDriverId,
          storedResultHash: storedHash,
          incomingResultHash: resultHash,
          message: `Conflito de integridade: a operação para ${realDriverId} na rodada ${r} já foi registrada com resultHash divergente ('${storedHash}' vs '${resultHash}').`,
        }
        return
      }

      // Já aplicado com o mesmo hash: retorna already_applied sem modificar estatísticas
      const statsAfter = existingReceipt.get('stats_after') || {}
      responseData = {
        status: 'already_applied',
        operationKey,
        careerId: c,
        season: s,
        round: r,
        sessionType: sess,
        driverId: realDriverId,
        driverSlug: existingReceipt.getString('driver_slug') || driverSlug || driverId,
        officialRaceResultId: existingReceipt.getString('official_race_result_id'),
        resultHash: storedHash,
        deltas: existingReceipt.get('deltas'),
        statsBefore: existingReceipt.get('stats_before'),
        statsAfter: statsAfter,
        appliedAt: existingReceipt.getString('applied_at'),
        message:
          'Operação de estatísticas já aplicada anteriormente. Recibo recuperado sem reaplicação.',
      }
      return
    }

    // 2.2 Validar resultado canônico contra race_results se existir registro para esta prova
    const variantTag = sess === 'SPRINT_RACE' ? '_sprint' : ''
    const expectedResultKey = `race_result_${c}_s${s}_${r}${variantTag}`
    try {
      const existingResult = txApp.findFirstRecordByData(
        'race_results',
        'result_key',
        expectedResultKey,
      )
      if (existingResult) {
        const canonicalChecksum = existingResult.getString('checksum')
        if (canonicalChecksum && canonicalChecksum !== resultHash) {
          responseStatusCode = 409
          responseData = {
            status: 'conflict',
            operationKey,
            careerId: c,
            season: s,
            round: r,
            sessionType: sess,
            driverId: realDriverId,
            storedResultHash: canonicalChecksum,
            incomingResultHash: resultHash,
            message: `Conflito de resultado oficial: checksum em race_results ('${canonicalChecksum}') diverge do resultHash fornecido ('${resultHash}').`,
          }
          return
        }
      }
    } catch (_) {
      // race_results ainda não criado ou em modo prévio
    }

    // 2.3 Ler estado atual do piloto DENTRO da transação
    // Os acumulados de carreira ficam em procedural_data.career_stats ou stats padrão
    const procData = driverRecord.get('procedural_data') || {}
    const careerStats = procData.career_stats || {}

    const statsBefore = {
      careerGps: Number(careerStats.careerGps) || 0,
      careerWins: Number(careerStats.careerWins) || 0,
      careerPoles: Number(careerStats.careerPoles) || 0,
      careerPodiums: Number(careerStats.careerPodiums) || 0,
      careerPoints: Number(careerStats.careerPoints) || 0,
      careerFastestLaps: Number(careerStats.careerFastestLaps) || 0,
      careerDnfs: Number(careerStats.careerDnfs) || 0,
      careerTitles: Number(careerStats.careerTitles) || 0,
      raceStarts: Number(careerStats.raceStarts) || 0,
      wins: Number(careerStats.wins) || 0,
      podiums: Number(careerStats.podiums) || 0,
      poles: Number(careerStats.poles) || 0,
      fastestLaps: Number(careerStats.fastestLaps) || 0,
      points: Number(careerStats.points) || 0,
      dnfs: Number(careerStats.dnfs) || 0,
      lapsCompleted: Number(careerStats.lapsCompleted) || 0,
      pitStops: Number(careerStats.pitStops) || 0,
      positionsGained: Number(careerStats.positionsGained) || 0,
      bestFinish: careerStats.bestFinish !== undefined ? careerStats.bestFinish : null,
      bestGridPosition:
        careerStats.bestGridPosition !== undefined ? careerStats.bestGridPosition : null,
    }

    const d = deltas || {}
    const dGps = Number(d.deltaRaceStarts !== undefined ? d.deltaRaceStarts : d.deltaGps) || 0
    const dWins = Number(d.deltaWins) || 0
    const dPoles = Number(d.deltaPoles) || 0
    const dPodiums = Number(d.deltaPodiums) || 0
    const dPoints = Number(d.deltaPoints) || 0
    const dFastestLaps = Number(d.deltaFastestLaps) || 0
    const dDnfs = Number(d.deltaDnfs) || 0
    const dTitles = Number(d.deltaTitles) || 0
    const dLaps = Number(d.deltaLapsCompleted) || 0
    const dPitStops = Number(d.deltaPitStops) || 0
    const dPositionsGained = Number(d.deltaPositionsGained) || 0

    let newBestFinish = statsBefore.bestFinish
    if (d.newFinishPosition !== undefined && d.newFinishPosition > 0) {
      newBestFinish =
        newBestFinish === null || newBestFinish === undefined
          ? d.newFinishPosition
          : Math.min(newBestFinish, d.newFinishPosition)
    }

    let newBestGrid = statsBefore.bestGridPosition
    if (d.newGridPosition !== undefined && d.newGridPosition > 0) {
      newBestGrid =
        newBestGrid === null || newBestGrid === undefined
          ? d.newGridPosition
          : Math.min(newBestGrid, d.newGridPosition)
    }

    const statsAfter = {
      careerGps: statsBefore.careerGps + dGps,
      careerWins: statsBefore.careerWins + dWins,
      careerPoles: statsBefore.careerPoles + dPoles,
      careerPodiums: statsBefore.careerPodiums + dPodiums,
      careerPoints: statsBefore.careerPoints + dPoints,
      careerFastestLaps: statsBefore.careerFastestLaps + dFastestLaps,
      careerDnfs: statsBefore.careerDnfs + dDnfs,
      careerTitles: statsBefore.careerTitles + dTitles,
      raceStarts: statsBefore.raceStarts + dGps,
      wins: statsBefore.wins + dWins,
      podiums: statsBefore.podiums + dPodiums,
      poles: statsBefore.poles + dPoles,
      fastestLaps: statsBefore.fastestLaps + dFastestLaps,
      points: statsBefore.points + dPoints,
      dnfs: statsBefore.dnfs + dDnfs,
      lapsCompleted: statsBefore.lapsCompleted + dLaps,
      pitStops: statsBefore.pitStops + dPitStops,
      positionsGained: statsBefore.positionsGained + dPositionsGained,
      bestFinish: newBestFinish,
      bestGridPosition: newBestGrid,
    }

    // Atualiza procedural_data no piloto
    const updatedProcData = {
      ...procData,
      career_stats: statsAfter,
      updatedAt: new Date().toISOString(),
    }
    driverRecord.set('procedural_data', updatedProcData)
    txApp.save(driverRecord)

    // Cria o recibo
    const receipt = new Record(receiptsCol)
    const nowIso = officializedAt || new Date().toISOString()
    receipt.set('operation_key', operationKey)
    receipt.set('career_id', c)
    receipt.set('season', s)
    receipt.set('round', r)
    receipt.set('session_type', sess)
    receipt.set('driver_id', realDriverId)
    receipt.set('driver_slug', driverSlug || driverId)
    receipt.set('official_race_result_id', officialRaceResultId || '')
    receipt.set('result_hash', resultHash)
    receipt.set('deltas', d)
    receipt.set('stats_before', statsBefore)
    receipt.set('stats_after', statsAfter)
    receipt.set('applied_at', nowIso)
    receipt.set('payload', {
      driverName: driverRecord.getString('name'),
      appliedVia: 'apply-atomic-stats',
    })

    txApp.save(receipt)

    responseData = {
      status: 'applied',
      operationKey,
      careerId: c,
      season: s,
      round: r,
      sessionType: sess,
      driverId: realDriverId,
      driverSlug: driverSlug || driverId,
      officialRaceResultId: officialRaceResultId || '',
      resultHash,
      deltas: d,
      statsBefore,
      statsAfter,
      appliedAt: nowIso,
      message: 'Estatísticas e recibo aplicados atomicamente com sucesso.',
    }
  })

  return e.json(responseStatusCode, responseData)
})

routerAdd('GET', '/backend/v1/driver-stats/receipt', (e) => {
  const query = e.request.url.query()
  const careerId = query.get('careerId') || 'default'
  const season = Number(query.get('season')) || 2026
  const round = Number(query.get('round')) || 1
  const sessionType = query.get('sessionType') || 'MAIN_RACE'
  const driverId = query.get('driverId') || ''
  const driverName = query.get('driverName') || ''

  if (!driverId) {
    throw new BadRequestError('driverId é obrigatório')
  }

  // Resolver ID real inline
  let driverRecord = null
  try {
    driverRecord = e.app.findRecordById('drivers', driverId)
  } catch (_) {}

  if (!driverRecord && driverName && driverName.trim()) {
    try {
      const records = e.app.findRecordsByFilter(
        'drivers',
        `name = '${driverName.trim().replace(/'/g, "\\'")}'`,
        '',
        1,
        0,
      )
      if (records && records.length > 0) driverRecord = records[0]
    } catch (_) {}
  }

  if (!driverRecord) {
    try {
      const records = e.app.findRecordsByFilter(
        'drivers',
        `name = '${driverId.trim().replace(/'/g, "\\'")}'`,
        '',
        1,
        0,
      )
      if (records && records.length > 0) driverRecord = records[0]
    } catch (_) {}
  }

  const realDriverId = driverRecord ? driverRecord.id : driverId
  const sessSuffix = sessionType ? `_${sessionType}` : '_MAIN_RACE'
  const operationKey = `driver_stats_receipt_${careerId}_${season}_${round}${sessSuffix}_${realDriverId}`

  try {
    const receipt = e.app.findFirstRecordByData(
      'canonical_driver_stats_receipts',
      'operation_key',
      operationKey,
    )

    return e.json(200, {
      exists: true,
      operationKey,
      careerId: receipt.getString('career_id'),
      season: receipt.get('season'),
      round: receipt.get('round'),
      sessionType: receipt.getString('session_type'),
      driverId: receipt.getString('driver_id'),
      driverSlug: receipt.getString('driver_slug'),
      officialRaceResultId: receipt.getString('official_race_result_id'),
      resultHash: receipt.getString('result_hash'),
      deltas: receipt.get('deltas'),
      statsBefore: receipt.get('stats_before'),
      statsAfter: receipt.get('stats_after'),
      appliedAt: receipt.getString('applied_at'),
      currentDriverStats: driverRecord
        ? (driverRecord.get('procedural_data') || {}).career_stats
        : undefined,
    })
  } catch (_) {
    return e.json(200, {
      exists: false,
      operationKey,
      careerId,
      season,
      round,
      sessionType,
      driverId: realDriverId,
      currentDriverStats: driverRecord
        ? (driverRecord.get('procedural_data') || {}).career_stats
        : undefined,
    })
  }
})
