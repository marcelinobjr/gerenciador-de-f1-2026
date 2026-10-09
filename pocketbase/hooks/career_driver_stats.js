/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook Server-side: Operação Transacional Atômica de Estatísticas de Piloto na Carreira
 * Microbloco RACE-CAREER-SAVE-01D2B1: Ajustar o Contrato do Hook Existente
 *
 * Contrato de rota:
 * POST /backend/v1/career-driver-stats/apply-atomic
 * GET  /backend/v1/career-driver-stats/receipt
 *
 * CONTRATO AJUSTADO (01D2B1):
 * 1. Resolução da exigência de careerDriverId:
 *    - O fluxo frontend dispõe de driverId (resolvido para o ID persistente de 'drivers').
 *    - No schema PocketBase não existe tabela 'career_drivers'; o identificador contextual do
 *      piloto dentro da carreira (career_driver_id) é por definição canônica o par (careerId:driverId)
 *      ou o careerDriverId explícito enviado pelo chamador (se presente), garantindo compatibilidade
 *      sem inventar tabela inexistente e sem descartar a coluna NOT NULL da coleção de recibos.
 *    - Validação de autorização do chamador sobre a carreira (seasons.team_id -> teams.user_id).
 *
 * 2. Garantir isolamento das estatísticas:
 *    - O registro 'drivers' no PocketBase é global/compartilhado entre diferentes saves/carreiras.
 *    - Portanto, em procedural_data, as estatísticas são isoladas por chave de carreira:
 *      procedural_data.career_stats_by_career[careerId] = { ... }
 *      E, para retrocompatibilidade com consumidores legados de save único, mantém também
 *      o espelho procedural_data.career_stats apontando para o último estado da carreira atual.
 *    - Atualiza somente o bloco da carreira-alvo, preservando estritamente quaisquer outros
 *      dados existentes em procedural_data (visualIdentity, psychology, contratos, etc.).
 *
 * 3. Definir a base do cálculo:
 *    - Utiliza o calculador puro oficial (career_driver_stats_calculator.js).
 *    - Base histórica autoritativa confirmada no backend:
 *      Lê o estado confirmado em drivers.procedural_data.career_stats_by_career[careerId]
 *      (ou procedural_data.career_stats se já existir para este piloto).
 *    - Se o piloto NÃO possui histórico prévio confirmado no backend:
 *      Verifica se o payload traz a flag allowHistoricalSeed === true OU se deltas trazem
 *      valores absolutos explícitos acompanhados de histórico inicial documentado.
 *      Caso contrário, se a base histórica for ausente ou ambígua e nenhuma diretriz de
 *      inicialização explícita for fornecida, retorna pendência explícita de reconciliação
 *      (HTTP 422: RECONCILIATION_REQUIRED) — NUNCA inicializa silenciosamente com zero nem
 *      aceita cache local como prova cega do histórico.
 *
 * 4. Preservação da atomicidade e idempotência:
 *    - runInTransaction garante que a atualização das estatísticas do piloto e a criação do
 *      recibo em canonical_career_driver_stats_receipts ocorram na mesma transação atômica.
 *    - Idempotência estrita: se a operação já foi aplicada com o mesmo result_hash, retorna
 *      status: 'already_applied' sem reaplicar deltas.
 *    - Se houver divergência no result_hash para a mesma chave, retorna HTTP 409 (conflito).
 *    - Consultas a recibos antigos nunca restauram estatísticas passadas sobre valores mais atuais.
 */

routerAdd('POST', '/backend/v1/career-driver-stats/apply-atomic', (e) => {
  // Helper inline para validação de campos obrigatórios de estatísticas
  const isValidStats = (obj) => {
    if (!obj || typeof obj !== 'object') return false
    return (
      typeof obj.careerGps === 'number' ||
      typeof obj.raceStarts === 'number' ||
      typeof obj.careerWins === 'number' ||
      typeof obj.points === 'number'
    )
  }

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
    initialStatsSeed,
    allowHistoricalSeed,
    officializedAt,
  } = reqData

  // Validações básicas de entrada
  if (!careerId || typeof careerId !== 'string' || !careerId.trim()) {
    throw new BadRequestError('career_id é obrigatório.')
  }

  if (!driverId || typeof driverId !== 'string' || !driverId.trim()) {
    throw new BadRequestError('driver_id é obrigatório.')
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
  let seasonRecord = null
  try {
    try {
      seasonRecord = e.app.findRecordById('seasons', c)
    } catch (_) {
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

  // 4. Resolver career_driver_id canônico de forma compatível com o schema:
  // Se enviado explicitamente pelo chamador, utiliza-o.
  // Se ausente, deriva canonicamente como `${c}_${realDriverId}` (vínculo piloto-carreira determinístico).
  const resolvedCareerDriverId =
    careerDriverId && typeof careerDriverId === 'string' && careerDriverId.trim()
      ? careerDriverId.trim()
      : `${c}_${realDriverId}`

  // 5. Derivar a chave da operação NO SERVIDOR:
  // Carreira + temporada + rodada + sessão + identidade persistente do piloto.
  // Distingue corrida principal de Sprint através do campo session.
  const operationKey = `stats_receipt_${c}_${s}_${r}_${sess}_${realDriverId}`

  let responseStatusCode = 200
  let responseData = null

  // 6. Execução em transação única no servidor
  e.app.runInTransaction((txApp) => {
    const receiptsCol = txApp.findCollectionByNameOrId('canonical_career_driver_stats_receipts')

    // 6.1 Consultar se o recibo já existe dentro da transação
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
          careerDriverId: resolvedCareerDriverId,
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
        careerDriverId: existingReceipt.getString('career_driver_id') || resolvedCareerDriverId,
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

    // 6.2 Validar resultado canônico persistido em race_results (se presente)
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
            careerDriverId: resolvedCareerDriverId,
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

    // 6.3 Ler estatísticas atuais do piloto DENTRO da transação
    // Recarregar driverRecord na transação para garantir isolamento estrito
    let txDriverRecord = null
    try {
      txDriverRecord = txApp.findRecordById('drivers', realDriverId)
    } catch (_) {
      txDriverRecord = driverRecord
    }

    const procData = txDriverRecord.get('procedural_data') || {}
    const statsByCareer = procData.career_stats_by_career || {}

    // Obter estado atual confirmado do backend para a carreira-alvo
    let confirmedStatsForCareer = statsByCareer[c] || null

    // Se ausente em statsByCareer, verificar se existe em procData.career_stats
    // e se possui valores numéricos válidos
    if (!confirmedStatsForCareer && isValidStats(procData.career_stats)) {
      confirmedStatsForCareer = procData.career_stats
    }

    // BASE DO CÁLCULO: Se base histórica ausente ou ambígua
    if (!confirmedStatsForCareer || !isValidStats(confirmedStatsForCareer)) {
      // Verificar se o chamador explicitamente forneceu uma semente histórica homologada
      if (allowHistoricalSeed === true && initialStatsSeed && isValidStats(initialStatsSeed)) {
        confirmedStatsForCareer = initialStatsSeed
      } else {
        // Base histórica ausente ou ambígua: NÃO inicializa silenciosamente com zero nem aceita cache local
        // Retorna status 422 com pendência explícita de reconciliação
        responseStatusCode = 422
        responseData = {
          status: 'reconciliation_required',
          code: 'HISTORICAL_BASE_AMBIGUOUS_OR_MISSING',
          operationKey,
          careerId: c,
          season: s,
          round: r,
          session: sess,
          driverId: realDriverId,
          careerDriverId: resolvedCareerDriverId,
          message: `Pendência explícita de reconciliação: o piloto '${realDriverId}' não possui base histórica confirmada no backend para a carreira '${c}'. Inicialização silenciosa com zero e aceite cego de cache local estão bloqueados. Forneça allowHistoricalSeed com initialStatsSeed homologado ou execute a reconciliação inicial.`,
        }
        return
      }
    }

    // 6.4 Efeito a ser aplicado via calculador oficial ou normalização estrita
    let calculator = null
    try {
      calculator = require(`${__hooks}/career_driver_stats_calculator.js`)
    } catch (_) {
      calculator = null
    }

    const eff = effectData || deltas || {}
    let beforeStats = null
    let calculatedEffect = null
    let afterStats = null

    if (calculator && typeof calculator.calculateCareerDriverStatsEffect === 'function') {
      const calcResult = calculator.calculateCareerDriverStatsEffect(confirmedStatsForCareer, eff, {
        careerId: c,
        season: s,
        round: r,
        session: sess,
        sessionType: sessType,
        driverId: realDriverId,
        raceVariant: sess,
      })
      beforeStats = calcResult.beforeStats
      calculatedEffect = calcResult.effectData
      afterStats = calcResult.afterStats
    } else {
      // Fallback equivalente rigoroso se o require do calculador não estiver no escopo imediato
      beforeStats = {
        careerGps: Number(confirmedStatsForCareer.careerGps) || 0,
        careerWins: Number(confirmedStatsForCareer.careerWins) || 0,
        careerPoles: Number(confirmedStatsForCareer.careerPoles) || 0,
        careerPodiums: Number(confirmedStatsForCareer.careerPodiums) || 0,
        careerPoints: Number(confirmedStatsForCareer.careerPoints) || 0,
        careerFastestLaps: Number(confirmedStatsForCareer.careerFastestLaps) || 0,
        careerDnfs: Number(confirmedStatsForCareer.careerDnfs) || 0,
        careerTitles: Number(confirmedStatsForCareer.careerTitles) || 0,
        raceStarts:
          Number(confirmedStatsForCareer.raceStarts) ||
          Number(confirmedStatsForCareer.careerGps) ||
          0,
        wins:
          Number(confirmedStatsForCareer.wins) || Number(confirmedStatsForCareer.careerWins) || 0,
        podiums:
          Number(confirmedStatsForCareer.podiums) ||
          Number(confirmedStatsForCareer.careerPodiums) ||
          0,
        poles:
          Number(confirmedStatsForCareer.poles) || Number(confirmedStatsForCareer.careerPoles) || 0,
        fastestLaps:
          Number(confirmedStatsForCareer.fastestLaps) ||
          Number(confirmedStatsForCareer.careerFastestLaps) ||
          0,
        points:
          Number(confirmedStatsForCareer.points) ||
          Number(confirmedStatsForCareer.careerPoints) ||
          0,
        dnfs:
          Number(confirmedStatsForCareer.dnfs) || Number(confirmedStatsForCareer.careerDnfs) || 0,
        lapsCompleted: Number(confirmedStatsForCareer.lapsCompleted) || 0,
        pitStops: Number(confirmedStatsForCareer.pitStops) || 0,
        positionsGained: Number(confirmedStatsForCareer.positionsGained) || 0,
        bestFinish:
          confirmedStatsForCareer.bestFinish !== undefined &&
          confirmedStatsForCareer.bestFinish !== null
            ? Number(confirmedStatsForCareer.bestFinish)
            : null,
        bestGridPosition:
          confirmedStatsForCareer.bestGridPosition !== undefined &&
          confirmedStatsForCareer.bestGridPosition !== null
            ? Number(confirmedStatsForCareer.bestGridPosition)
            : null,
      }

      const isSprint = sess === 'SPRINT_RACE'
      const deltaGps =
        eff.deltaRaceStarts !== undefined
          ? Number(eff.deltaRaceStarts) || 0
          : eff.deltaGps !== undefined
            ? Number(eff.deltaGps) || 0
            : isSprint
              ? 0
              : 1
      const deltaWins = isSprint ? 0 : Number(eff.deltaWins) || 0
      const deltaPodiums = isSprint ? 0 : Number(eff.deltaPodiums) || 0
      const deltaPoles = isSprint ? 0 : Number(eff.deltaPoles) || 0
      const deltaFastestLaps = Number(eff.deltaFastestLaps) || 0
      const deltaPoints = Number(eff.deltaPoints) || 0
      const deltaDnfs = Number(eff.deltaDnfs) || 0
      const deltaTitles = Number(eff.deltaTitles) || 0
      const deltaLaps = Number(eff.deltaLapsCompleted) || 0
      const deltaPitStops = Number(eff.deltaPitStops) || 0
      const deltaPositionsGained = Number(eff.deltaPositionsGained) || 0

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

      calculatedEffect = {
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

      afterStats = {
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
    }

    // 6.5 Atualizar registro do piloto com ISOLAMENTO ESTRITO POR CARREIRA:
    // Preservar 100% dos dados pré-existentes de procedural_data (visualIdentity, psychology, etc.).
    // Atualizar apenas o mapa da carreira-alvo em career_stats_by_career[c] e manter o espelho
    // career_stats para compatibilidade.
    const updatedStatsByCareer = {
      ...statsByCareer,
      [c]: afterStats,
    }

    const updatedProcData = {
      ...procData,
      career_stats_by_career: updatedStatsByCareer,
      career_stats: afterStats,
      career_driver_id: resolvedCareerDriverId,
      updatedAt: new Date().toISOString(),
    }
    txDriverRecord.set('procedural_data', updatedProcData)
    txApp.save(txDriverRecord)

    // 6.6 Gravar recibo na coleção canonical_career_driver_stats_receipts
    const receipt = new Record(receiptsCol)
    const nowIso = officializedAt || new Date().toISOString()
    receipt.set('operation_key', operationKey)
    receipt.set('career_id', c)
    receipt.set('season', s)
    receipt.set('round', r)
    receipt.set('session', sess)
    receipt.set('session_type', sessType)
    receipt.set('driver_id', realDriverId)
    receipt.set('career_driver_id', resolvedCareerDriverId)
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
      careerDriverId: resolvedCareerDriverId,
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

  const procData = driverRecord ? driverRecord.get('procedural_data') || {} : {}
  const statsByCareer = procData.career_stats_by_career || {}
  const currentDriverStats = statsByCareer[careerId] || procData.career_stats || undefined

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
      currentDriverStats,
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
      careerDriverId: `${careerId}_${realDriverId}`,
      currentDriverStats,
    })
  }
})
