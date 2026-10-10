/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook Server-side: Operação Atômica de Moral de Piloto
 * BUG-MORALE-01R-B2
 *
 * Garante que:
 * 1. A verificação do recibo (idempotência), o update da moral do piloto e a criação
 *    do recibo são executados de forma ATÔMICA dentro de uma transação no servidor.
 * 2. Proteção contra concorrência: duas chamadas simultâneas não duplicam o delta nem
 *    geram registros inconsistentes (UNIQUE INDEX em operation_key + txApp).
 * 3. Se a operação já foi aplicada, recupera e retorna o recibo existente sem reaplicar.
 * 4. Slugs e IDs reais são resolvidos para o ID real do PocketBase. A operation_key é
 *    sempre gerada com o ID real do piloto.
 * 5. Consultas a recibos antigos apenas informam se foi aplicado e trazem a evidência,
 *    nunca sobrescrevem a moral atual do piloto.
 */

routerAdd('POST', '/backend/v1/driver-morale/apply-atomic', (e) => {
  const reqData = e.requestInfo().body || {}
  const {
    careerId,
    season,
    round,
    sessionType,
    driverId,
    driverName,
    driverSlug,
    delta,
    beforeMorale,
    finalMorale,
    officializedAt,
  } = reqData

  if (!driverId) {
    throw new BadRequestError('driverId é obrigatório')
  }

  const s = Number(season) || 2026
  const r = Number(round) || 1
  const sess = sessionType || 'MAIN_RACE'
  const c = careerId || 'default'

  // Helper inline: resolver ID real do piloto
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
  const operationKey = `driver_morale_receipt_${c}_${s}_${r}${sessSuffix}_${realDriverId}`

  let responseData = null

  e.app.runInTransaction((txApp) => {
    const receiptsCol = txApp.findCollectionByNameOrId('canonical_driver_morale_receipts')

    // 1. Verificar se o recibo já existe dentro da transação
    let existingReceipt = null
    try {
      existingReceipt = txApp.findFirstRecordByData(
        'canonical_driver_morale_receipts',
        'operation_key',
        operationKey,
      )
    } catch (_) {
      existingReceipt = null
    }

    if (existingReceipt) {
      // Já aplicado anteriormente: retorna o recibo existente SEM reaplicar
      responseData = {
        status: 'already_applied',
        operationKey,
        careerId: c,
        season: s,
        round: r,
        sessionType: sess,
        driverId: realDriverId,
        driverSlug: existingReceipt.getString('driver_slug') || driverSlug || driverId,
        beforeMorale: existingReceipt.get('before_morale'),
        delta: existingReceipt.get('delta'),
        finalMorale: existingReceipt.get('final_morale'),
        appliedAt: existingReceipt.getString('applied_at'),
        currentDriverMorale: driverRecord.get('morale'),
        message: 'Operação já aplicada anteriormente. Recibo recuperado sem reaplicação.',
      }
      return
    }

    // 2. Se não existe, aplicar o PATCH na moral do piloto e salvar o recibo
    const rawBefore = beforeMorale !== undefined ? beforeMorale : reqData.before_morale
    const rawFinal = finalMorale !== undefined ? finalMorale : reqData.final_morale
    const rawDelta = delta !== undefined ? delta : reqData.delta

    const prevMorale =
      typeof rawBefore === 'number'
        ? rawBefore
        : typeof driverRecord.get('morale') === 'number'
          ? driverRecord.get('morale')
          : 80

    const targetMorale =
      typeof rawFinal === 'number'
        ? Math.max(0, Math.min(100, Math.round(rawFinal)))
        : typeof rawDelta === 'number'
          ? Math.max(0, Math.min(100, Math.round(prevMorale + rawDelta)))
          : prevMorale

    const actualDelta = typeof rawDelta === 'number' ? rawDelta : targetMorale - prevMorale

    // Atualiza a moral no registro do piloto
    driverRecord.set('morale', targetMorale)
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
    receipt.set('before_morale', prevMorale)
    receipt.set('delta', actualDelta)
    receipt.set('final_morale', targetMorale)
    receipt.set('applied_at', nowIso)
    receipt.set('payload', {
      driverName: driverRecord.getString('name'),
      appliedVia: 'apply-atomic',
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
      beforeMorale: prevMorale,
      delta: actualDelta,
      finalMorale: targetMorale,
      appliedAt: nowIso,
      currentDriverMorale: targetMorale,
      message: 'Moral e recibo aplicados atomicamente com sucesso.',
    }
  })

  return e.json(200, responseData)
})

routerAdd('GET', '/backend/v1/driver-morale/receipt', (e) => {
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

  // Resolver piloto para ID real inline
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
  const operationKey = `driver_morale_receipt_${careerId}_${season}_${round}${sessSuffix}_${realDriverId}`

  try {
    const receipt = e.app.findFirstRecordByData(
      'canonical_driver_morale_receipts',
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
      beforeMorale: receipt.get('before_morale'),
      delta: receipt.get('delta'),
      finalMorale: receipt.get('final_morale'),
      appliedAt: receipt.getString('applied_at'),
      currentDriverMorale: driverRecord ? driverRecord.get('morale') : undefined,
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
      currentDriverMorale: driverRecord ? driverRecord.get('morale') : undefined,
    })
  }
})
