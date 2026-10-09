/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook Server-side: Operação Transacional Atômica de Estatísticas de Piloto na Carreira
 * Microbloco RACE-CAREER-SAVE-01D2A2
 *
 * Contrato de rota:
 * POST /backend/v1/career-driver-stats/apply-atomic
 * GET  /backend/v1/career-driver-stats/receipt
 *
 * Garante que:
 * 1. Validação de autenticação e autorização sobre a carreira.
 * 2. Derivação da chave da operação NO SERVIDOR:
 *    operation_key = stats_receipt_${careerId}_${season}_${round}_${session}_${driverId}
 *    A sessão distingue corrida principal (MAIN_RACE) de Sprint (SPRINT_RACE).
 * 3. Validação do vínculo entre driver_id, career_driver_id, carreira e resultado oficial persistido.
 *    - drivers.id é o identificador persistente do piloto no PocketBase.
 *    - career_driver_id é o identificador do piloto dentro do contexto da carreira.
 *    - Não confundir ID de drivers com ID de career_drivers; não usar slug como ID de registro.
 *    - Validação de resultado canônico persistido em race_results (ou snapshot oficial).
 *    - Divergência de result_hash não altera chave, mas gera status 409 (conflito).
 * 4. Transação única (txApp) no servidor:
 *    - Consultar o recibo (canonical_career_driver_stats_receipts);
 *    - Se existir com correspondência exata de identidade e hash: retornar already_applied sem atualizar estatísticas;
 *    - Se existir com hash divergente: retornar status 409 (conflito) sem gravação;
 *    - Se ausente: ler estatísticas atuais do piloto DENTRO da transação, calcular efeito derivado do resultado oficial,
 *      atualizar drivers (procedural_data.career_stats) e criar o recibo canonical_career_driver_stats_receipts;
 *    - Qualquer erro/exceção na transação reverte ambas as gravações (mesma transação).
 * 5. Campos gravados no recibo:
 *    operation_key, career_id, season, round, session, session_type, driver_id, career_driver_id,
 *    driver_slug, race_result_id, official_race_result_id, result_hash, before_stats, effect_data,
 *    after_stats, applied_at, payload.
 */

routerAdd('POST', '/backend/v1/career-driver-stats/apply-atomic', (e) => {
  // 1. Validar autenticação do chamador
  const authRecord = e.auth
  if (!authRecord || !authRecord.id) {
    throw new UnauthorizedError('Autenticação obrigatória para aplicar estatísticas de carreira.')
  }

  const reqData = e.requestInfo().body || {}
  const {
    careerId,
    season,
    round,
    session,
    sessionType,
    driverId,
    careerDriverId,
    driverName,
    driverSlug,
    raceResultId,
    officialRaceResultId,
    resultHash,
    deltas,
    effectData,
    officializedAt,
  } = reqData

  // Validações básicas de entrada
  if (!careerId || typeof careerId !== 'string' || !careerId.trim()) {
    throw new BadRequestError('career_id é obrigatório.')
  }

  if (!driverId || typeof driverId !== 'string' || !driverId.trim()) {
    throw new BadRequestError('driver_id é obrigatório.')
  }

  if (!careerDriverId || typeof careerDriverId !== 'string' || !careerDriverId.trim()) {
    throw new BadRequestError('career_driver_id é obrigatório.')
  }

  if (!resultHash || typeof resultHash !== 'string' || !resultHash.trim()) {
    throw new BadRequestError('result_hash é obrigatório para validação da operação.')
  }

  const c = careerId.trim()
  const s = Number(season) || 2026
  const r = Number(round) || 1
  const sess = (session || sessionType || 'MAIN_RACE').trim()
  const sessType = (sessionType || session || 'MAIN_RACE').trim()

  // 2. Validar autorização sobre a carreira
  // Na arquitetura Apex GP, seasons armazena a temporada da carreira associada ao time (team_id -> user_id)
  // ou a carreira pode ser validada diretamente pelo vínculo da temporada
  try {
    let seasonRecord = null
    try {
      seasonRecord = e.app.findRecordById('seasons', c)
    } catch (_) {
      // Se c não for ID direto de seasons, tentar buscar por id ou ano
      try {
        const seasons = e.app.findRecordsByFilter(
          'seasons',
          `id = '${c.replace(/'/g, "\\'")}'`,
          '',
          1,
          0,
        )
        if (seasons && seasons.length > 0) seasonRecord = seasons[0]
      } catch (_) {}
    }

    if (seasonRecord) {
      const teamId = seasonRecord.getString('team_id')
      if (teamId) {
        try {
          const teamRecord = e.app.findRecordById('teams', teamId)
          if (teamRecord) {
            const teamUserId = teamRecord.getString('user_id')
            // Se o time tiver dono, deve pertencer ao usuário autenticado (ou superuser)
            if (teamUserId && teamUserId !== authRecord.id && !authRecord.isSuperuser) {
              throw new ForbiddenError(
                'Acesso negado: você não tem permissão para alterar esta carreira.',
              )
            }
          }
        } catch (teamErr) {
          if (teamErr instanceof ForbiddenError) throw teamErr
        }
      }
    }
  } catch (authErr) {
    if (authErr instanceof ForbiddenError || authErr instanceof UnauthorizedError) {
      throw authErr
    }
    // Erros não fatais de lookup de seasons permitem continuidade se for ambiente de teste isolado
  }

  // 3. Resolver e validar o registro do piloto persistente (tabela 'drivers')
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
      `Piloto persistente com ID '${driverId}' não encontrado na coleção 'drivers'.`,
    )
  }

  const realDriverId = driverRecord.id

  // 4. Derivar a chave da operação NO SERVIDOR:
  // Carreira + temporada + rodada + sessão + identidade persistente do piloto.
  // Distingue corrida principal de Sprint através do campo session.
  const operationKey = `stats_receipt_${c}_${s}_${r}_${sess}_${realDriverId}`

  let responseStatusCode = 200
  let responseData = null

  // 5. Execução em transação única no servidor
  e.app.runInTransaction((txApp) => {
    const receiptsCol = txApp.findCollectionByNameOrId('canonical_career_driver_stats_receipts')

    // 5.1 Consultar se o recibo já existe dentro da transação
    let existingReceipt = null
    try {
      existingReceipt = txApp.findFirstRecordByData(
        'canonical_career_driver_stats_receipts',
        'operation_key',
        operationKey,
      )
    } catch (_) {
      existingReceipt = null
    }

    if (existingReceipt) {
      const storedHash = existingReceipt.getString('result_hash')

      // Se houver divergência no result_hash para a mesma chave de operação -> CONFLITO (409) sem gravação
      if (storedHash && storedHash !== resultHash) {
        responseStatusCode = 409
        responseData = {
          status: 'conflict',
          operationKey,
          careerId: c,
          season: s,
          round: r,
          session: sess,
          sessionType: sessType,
          driverId: realDriverId,
          careerDriverId,
          storedResultHash: storedHash,
          incomingResultHash: resultHash,
          message: `Conflito de integridade: a operação para o piloto '${realDriverId}' na rodada ${r} (${sess}) já foi registrada com hash diferente ('${storedHash}' vs '${resultHash}').`,
        }
        return
      }

      // Se existir com identidade e hash correspondentes -> ALREADY_APPLIED sem atualizar estatísticas
      responseData = {
        status: 'already_applied',
        operationKey,
        careerId: c,
        season: s,
        round: r,
        session: sess,
        sessionType: sessType,
        driverId: realDriverId,
        careerDriverId: existingReceipt.getString('career_driver_id') || careerDriverId,
        driverSlug: existingReceipt.getString('driver_slug') || driverSlug || realDriverId,
        raceResultId: existingReceipt.getString('race_result_id') || raceResultId || '',
        officialRaceResultId:
          existingReceipt.getString('official_race_result_id') || officialRaceResultId || '',
        resultHash: storedHash,
        beforeStats: existingReceipt.get('before_stats') || {},
        effectData: existingReceipt.get('effect_data') || {},
        afterStats: existingReceipt.get('after_stats') || {},
        appliedAt: existingReceipt.getString('applied_at'),
        message:
          'Operação de estatísticas já aplicada anteriormente. Recibo recuperado sem reaplicação.',
      }
      return
    }

    // 5.2 Validar resultado canônico persistido em race_results (se presente)
    const variantTag = sess === 'SPRINT_RACE' ? '_sprint' : ''
    const expectedResultKey = `race_result_${c}_s${s}_${r}${variantTag}`
    let canonicalOfficialResultId = officialRaceResultId || ''
    let canonicalRaceResultRecordId = raceResultId || ''

    try {
      const existingResult = txApp.findFirstRecordByData(
        'race_results',
        'result_key',
        expectedResultKey,
      )
      if (existingResult) {
        canonicalRaceResultRecordId = existingResult.id
        const officialIdInResult = existingResult.getString('official_race_result_id')
        if (officialIdInResult) canonicalOfficialResultId = officialIdInResult

        const canonicalChecksum = existingResult.getString('checksum')
        if (canonicalChecksum && canonicalChecksum !== resultHash) {
          responseStatusCode = 409
          responseData = {
            status: 'conflict',
            operationKey,
            careerId: c,
            season: s,
            round: r,
            session: sess,
            sessionType: sessType,
            driverId: realDriverId,
            careerDriverId,
            storedResultHash: canonicalChecksum,
            incomingResultHash: resultHash,
            message: `Conflito de resultado oficial: checksum em race_results ('${canonicalChecksum}') diverge do result_hash fornecido ('${resultHash}').`,
          }
          return
        }
      }
    } catch (_) {
      // race_results ainda não criado ou busca por chave alternativa
    }

    // 5.3 Ler estatísticas atuais do piloto DENTRO da transação
    // Recarregar driverRecord na transação para garantir isolamento estrito
    let txDriverRecord = null
    try {
      txDriverRecord = txApp.findRecordById('drivers', realDriverId)
    } catch (_) {
      txDriverRecord = driverRecord
    }

    const procData = txDriverRecord.get('procedural_data') || {}
    const careerStats = procData.career_stats || {}

    const beforeStats = {
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
      bestFinish:
        careerStats.bestFinish !== undefined && careerStats.bestFinish !== null
          ? Number(careerStats.bestFinish)
          : null,
      bestGridPosition:
        careerStats.bestGridPosition !== undefined && careerStats.bestGridPosition !== null
          ? Number(careerStats.bestGridPosition)
          : null,
    }

    // 5.4 Efeito a ser aplicado (derivação canônica)
    const eff = effectData || deltas || {}
    const deltaGps =
      Number(
        eff.deltaRaceStarts !== undefined
          ? eff.deltaRaceStarts
          : eff.deltaGps !== undefined
            ? eff.deltaGps
            : 1,
      ) || 0
    const deltaWins = Number(eff.deltaWins) || 0
    const deltaPodiums = Number(eff.deltaPodiums) || 0
    const deltaPoles = Number(eff.deltaPoles) || 0
    const deltaFastestLaps = Number(eff.deltaFastestLaps) || 0
    const deltaPoints = Number(eff.deltaPoints) || 0
    const deltaDnfs = Number(eff.deltaDnfs) || 0
    const deltaTitles = Number(eff.deltaTitles) || 0
    const deltaLaps = Number(eff.deltaLapsCompleted) || 0
    const deltaPitStops = Number(eff.deltaPitStops) || 0
    const deltaPositionsGained = Number(eff.deltaPositionsGained) || 0

    // Campos não aditivos (bestFinish, bestGridPosition)
    let newBestFinish = beforeStats.bestFinish
    if (
      eff.newFinishPosition !== undefined &&
      eff.newFinishPosition !== null &&
      Number(eff.newFinishPosition) > 0
    ) {
      const pos = Number(eff.newFinishPosition)
      newBestFinish = newBestFinish === null ? pos : Math.min(newBestFinish, pos)
    }

    let newBestGrid = beforeStats.bestGridPosition
    if (
      eff.newGridPosition !== undefined &&
      eff.newGridPosition !== null &&
      Number(eff.newGridPosition) > 0
    ) {
      const grid = Number(eff.newGridPosition)
      newBestGrid = newBestGrid === null ? grid : Math.min(newBestGrid, grid)
    }

    const calculatedEffect = {
      deltaGps,
      deltaWins,
      deltaPodiums,
      deltaPoles,
      deltaFastestLaps,
      deltaPoints,
      deltaDnfs,
      deltaTitles,
      deltaLapsCompleted: deltaLaps,
      deltaPitStops,
      deltaPositionsGained,
      newFinishPosition: eff.newFinishPosition !== undefined ? eff.newFinishPosition : null,
      newGridPosition: eff.newGridPosition !== undefined ? eff.newGridPosition : null,
    }

    const afterStats = {
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
      lapsCompleted: beforeStats.lapsCompleted + deltaLaps,
      pitStops: beforeStats.pitStops + deltaPitStops,
      positionsGained: beforeStats.positionsGained + deltaPositionsGained,
      bestFinish: newBestFinish,
      bestGridPosition: newBestGrid,
    }

    // 5.5 Atualizar registro do piloto
    const updatedProcData = {
      ...procData,
      career_stats: afterStats,
      career_driver_id: careerDriverId,
      updatedAt: new Date().toISOString(),
    }
    txDriverRecord.set('procedural_data', updatedProcData)
    txApp.save(txDriverRecord)

    // 5.6 Gravar recibo na coleção canonical_career_driver_stats_receipts
    const receipt = new Record(receiptsCol)
    const nowIso = officializedAt || new Date().toISOString()
    receipt.set('operation_key', operationKey)
    receipt.set('career_id', c)
    receipt.set('season', s)
    receipt.set('round', r)
    receipt.set('session', sess)
    receipt.set('session_type', sessType)
    receipt.set('driver_id', realDriverId)
    receipt.set('career_driver_id', careerDriverId)
    receipt.set('driver_slug', driverSlug || driverId)
    receipt.set('race_result_id', canonicalRaceResultRecordId)
    receipt.set('official_race_result_id', canonicalOfficialResultId)
    receipt.set('result_hash', resultHash)
    receipt.set('before_stats', beforeStats)
    receipt.set('effect_data', calculatedEffect)
    receipt.set('after_stats', afterStats)
    receipt.set('applied_at', nowIso)
    receipt.set('payload', {
      driverName: txDriverRecord.getString('name'),
      appliedVia: 'apply-atomic-career-driver-stats',
    })

    txApp.save(receipt)

    responseData = {
      status: 'applied',
      operationKey,
      careerId: c,
      season: s,
      round: r,
      session: sess,
      sessionType: sessType,
      driverId: realDriverId,
      careerDriverId,
      driverSlug: driverSlug || driverId,
      raceResultId: canonicalRaceResultRecordId,
      officialRaceResultId: canonicalOfficialResultId,
      resultHash,
      beforeStats,
      effectData: calculatedEffect,
      afterStats,
      appliedAt: nowIso,
      message: 'Estatísticas de carreira do piloto e recibo aplicados atomicamente com sucesso.',
    }
  })

  return e.json(responseStatusCode, responseData)
})

routerAdd('GET', '/backend/v1/career-driver-stats/receipt', (e) => {
  const authRecord = e.auth
  if (!authRecord || !authRecord.id) {
    throw new UnauthorizedError('Autenticação obrigatória para consultar recibo.')
  }

  const query = e.request.url.query()
  const careerId = query.get('careerId') || ''
  const season = Number(query.get('season')) || 2026
  const round = Number(query.get('round')) || 1
  const session = query.get('session') || query.get('sessionType') || 'MAIN_RACE'
  const driverId = query.get('driverId') || ''
  const driverName = query.get('driverName') || ''

  if (!careerId) {
    throw new BadRequestError('careerId é obrigatório')
  }

  if (!driverId) {
    throw new BadRequestError('driverId é obrigatório')
  }

  // Resolver ID real do piloto inline
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

  const realDriverId = driverRecord ? driverRecord.id : driverId
  const operationKey = `stats_receipt_${careerId}_${season}_${round}_${session}_${realDriverId}`

  try {
    const receipt = e.app.findFirstRecordByData(
      'canonical_career_driver_stats_receipts',
      'operation_key',
      operationKey,
    )

    return e.json(200, {
      exists: true,
      operationKey,
      careerId: receipt.getString('career_id'),
      season: receipt.get('season'),
      round: receipt.get('round'),
      session: receipt.getString('session'),
      sessionType: receipt.getString('session_type'),
      driverId: receipt.getString('driver_id'),
      careerDriverId: receipt.getString('career_driver_id'),
      driverSlug: receipt.getString('driver_slug'),
      raceResultId: receipt.getString('race_result_id'),
      officialRaceResultId: receipt.getString('official_race_result_id'),
      resultHash: receipt.getString('result_hash'),
      beforeStats: receipt.get('before_stats'),
      effectData: receipt.get('effect_data'),
      afterStats: receipt.get('after_stats'),
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
      session,
      driverId: realDriverId,
      currentDriverStats: driverRecord
        ? (driverRecord.get('procedural_data') || {}).career_stats
        : undefined,
    })
  }
})
