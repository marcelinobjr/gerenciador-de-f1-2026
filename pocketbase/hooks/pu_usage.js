routerAdd('POST', '/backend/v1/pu-usage/apply-session', (e) => {
  // 1. Resolver usuário autenticado
  let authUser = null
  if (e.auth) {
    authUser = e.auth
  } else {
    const reqInfo = e.requestInfo ? e.requestInfo() : null
    if (reqInfo && reqInfo.authRecord) {
      authUser = reqInfo.authRecord
    }
  }

  if (!authUser || !authUser.id) {
    throw new UnauthorizedError('Autenticação obrigatória para aplicar uso de PU.')
  }

  const reqData = e.requestInfo().body || {}
  const projectionReport = reqData.projectionReport
  if (!projectionReport) {
    throw new BadRequestError('projectionReport é obrigatório')
  }

  const careerId = projectionReport.careerId || ''
  if (!careerId) {
    throw new BadRequestError('careerId é obrigatório')
  }

  // 2. Verificar autorização sobre a carreira
  let hasAccess = false
  if (authUser.isSuperuser && authUser.isSuperuser()) {
    hasAccess = true
  } else {
    const userId = authUser.id
    if (careerId === userId) {
      hasAccess = true
    } else {
      try {
        const teams = e.app.findRecordsByFilter(
          'teams',
          `user_id = '${userId}' && (id = '${careerId}' || team_key = '${careerId}')`,
          '',
          1,
          0,
        )
        if (teams && teams.length > 0) {
          hasAccess = true
        }
      } catch (_) {}

      if (!hasAccess) {
        try {
          const seasons = e.app.findRecordsByFilter(
            'seasons',
            `id = '${careerId}' && team_id.user_id = '${userId}'`,
            '',
            1,
            0,
          )
          if (seasons && seasons.length > 0) {
            hasAccess = true
          }
        } catch (_) {}
      }

      if (!hasAccess) {
        try {
          const userTeams = e.app.findRecordsByFilter('teams', `user_id = '${userId}'`, '', 10, 0)
          for (let i = 0; i < userTeams.length; i++) {
            const ut = userTeams[i]
            if (ut.id === careerId || ut.get('team_key') === careerId) {
              hasAccess = true
              break
            }
            try {
              const teamSeasons = e.app.findRecordsByFilter(
                'seasons',
                `team_id = '${ut.id}'`,
                '',
                10,
                0,
              )
              for (let s = 0; s < teamSeasons.length; s++) {
                if (teamSeasons[s].id === careerId) {
                  hasAccess = true
                  break
                }
              }
              if (hasAccess) break
            } catch (_) {}
          }
        } catch (_) {}
      }
    }
  }

  if (!hasAccess) {
    throw new ForbiddenError('Acesso não autorizado à carreira solicitada.')
  }

  const season = Number(projectionReport.season) || 0
  const round = Number(projectionReport.round) || 0
  const raceVariant = projectionReport.raceVariant || 'MAIN_RACE'
  const sessionKey = projectionReport.sessionKey || ''
  const variantSlug = raceVariant === 'SPRINT_RACE' ? 'sprint' : 'main'
  const journalKey = `apex_gp_pu_usage_journal_${careerId}_s${season}_r${round}_${variantSlug}`

  let resultPayload = null

  e.app.runInTransaction((txApp) => {
    const journalCollection = txApp.findCollectionByNameOrId('power_unit_usage_journals')

    let journalRecord = null
    try {
      journalRecord = txApp.findFirstRecordByData(
        'power_unit_usage_journals',
        'journal_key',
        journalKey,
      )
    } catch (_) {
      journalRecord = null
    }

    if (journalRecord && journalRecord.get('status') === 'COMPLETE') {
      // Conferir se o journal persistido de fato pertence à carreira solicitada
      if (journalRecord.get('career_id') !== careerId) {
        throw new ForbiddenError('Conflito de carreira no journal autoritativo.')
      }

      const storedResults = journalRecord.get('unit_results') || []
      resultPayload = {
        sessionKey,
        careerId,
        season,
        round,
        raceVariant,
        status: 'ALREADY_APPLIED',
        journal: {
          journalKey,
          careerId,
          season,
          round,
          raceVariant,
          sessionKey,
          status: 'COMPLETE',
          appliedUnitIds: journalRecord.get('applied_unit_ids') || [],
          appliedDriverIds: journalRecord.get('applied_driver_ids') || [],
          startedAt: journalRecord.getString('created'),
          completedAt: journalRecord.getString('updated'),
        },
        appliedCount: 0,
        alreadyAppliedCount: storedResults.length || projectionReport.projections.length,
        pendingOrUnlinkedCount: 0,
        failedCount: 0,
        unitResults:
          storedResults.length > 0
            ? storedResults
            : projectionReport.projections.map((p) => ({
                driverId: p.driverId,
                driverName: p.driverName,
                teamId: p.teamId,
                powerUnitId: p.powerUnitId,
                status: 'ALREADY_APPLIED',
                distanceKmAdded: 0,
                wearDebitApplied: 0,
                message: `Sessão ${sessionKey} e unidade PU-${p.powerUnitId} já aplicadas autoritativamente no backend.`,
              })),
      }
      return
    }

    if (!journalRecord) {
      journalRecord = new Record(journalCollection)
      journalRecord.set('journal_key', journalKey)
      journalRecord.set('career_id', careerId)
      journalRecord.set('season', season)
      journalRecord.set('round', round)
      journalRecord.set('race_variant', raceVariant)
      journalRecord.set('session_key', sessionKey)
      journalRecord.set('status', 'APPLYING')
      journalRecord.set('applied_unit_ids', [])
      journalRecord.set('applied_driver_ids', [])
      txApp.save(journalRecord)
    } else {
      journalRecord.set('status', 'APPLYING')
      txApp.save(journalRecord)
    }

    const appliedUnitIds = Array.isArray(journalRecord.get('applied_unit_ids'))
      ? [...journalRecord.get('applied_unit_ids')]
      : []
    const appliedDriverIds = Array.isArray(journalRecord.get('applied_driver_ids'))
      ? [...journalRecord.get('applied_driver_ids')]
      : []

    const appliedUnitSet = new Set(appliedUnitIds)
    const appliedDriverSet = new Set(appliedDriverIds)

    const existingUnitResults = Array.isArray(journalRecord.get('unit_results'))
      ? [...journalRecord.get('unit_results')]
      : []

    const unitResults = [...existingUnitResults]
    let appliedCount = 0
    let alreadyAppliedCount = 0
    let pendingOrUnlinkedCount = 0
    let failedCount = 0

    // Agrupar projeções por equipe para ler e atualizar atômico
    const projections = projectionReport.projections || []
    const projectionsByTeam = {}
    for (let i = 0; i < projections.length; i++) {
      const proj = projections[i]
      if (!projectionsByTeam[proj.teamId]) {
        projectionsByTeam[proj.teamId] = []
      }
      projectionsByTeam[proj.teamId].push(proj)
    }

    const teamIds = Object.keys(projectionsByTeam)
    for (let t = 0; t < teamIds.length; t++) {
      const teamId = teamIds[t]
      const teamProjections = projectionsByTeam[teamId]

      let teamRecord = null
      try {
        teamRecord = txApp.findRecordById('teams', teamId)
      } catch (_) {
        teamRecord = null
      }

      // Validar se a equipe solicitada pertence ao contexto do usuário autenticado
      if (teamRecord && !authUser.isSuperuser?.()) {
        const teamOwner = teamRecord.get('user_id')
        if (teamOwner && teamOwner !== authUser.id) {
          throw new ForbiddenError(`Equipe '${teamId}' não pertence ao usuário autenticado.`)
        }
      }

      for (let p = 0; p < teamProjections.length; p++) {
        const proj = teamProjections[p]

        if (!proj.hasValidLinkage || !proj.powerUnitId) {
          pendingOrUnlinkedCount++
          unitResults.push({
            driverId: proj.driverId,
            driverName: proj.driverName,
            teamId: proj.teamId,
            powerUnitId: undefined,
            status: 'NOT_APPLICABLE',
            distanceKmAdded: 0,
            wearDebitApplied: 0,
            message: `Participante sem vínculo individual de PU (${proj.wearDebitStatus}).`,
          })
          continue
        }

        if (
          proj.wearDebitStatus === 'PENDING_ENGINE_SESSION_EVOLUTION' ||
          proj.wearDebitStatus === 'LEGACY_UNLINKED'
        ) {
          pendingOrUnlinkedCount++
          unitResults.push({
            driverId: proj.driverId,
            driverName: proj.driverName,
            teamId: proj.teamId,
            powerUnitId: proj.powerUnitId,
            status: 'NOT_APPLICABLE',
            distanceKmAdded: 0,
            wearDebitApplied: 0,
            message: `Débito de desgaste não reconhecido (${proj.wearDebitStatus}): ${proj.pendingReason || 'desgaste pendente'}.`,
          })
          continue
        }

        const puId = Number(proj.powerUnitId)
        if (appliedUnitSet.has(puId)) {
          alreadyAppliedCount++
          unitResults.push({
            driverId: proj.driverId,
            driverName: proj.driverName,
            teamId: proj.teamId,
            powerUnitId: puId,
            status: 'ALREADY_APPLIED',
            distanceKmAdded: 0,
            wearDebitApplied: 0,
            message: `Unidade PU-${puId} já foi aplicada nesta sessão pelo Journal autoritativo.`,
          })
          continue
        }

        if (!teamRecord) {
          failedCount++
          unitResults.push({
            driverId: proj.driverId,
            driverName: proj.driverName,
            teamId: proj.teamId,
            powerUnitId: puId,
            status: 'FAILED_NOT_FOUND',
            distanceKmAdded: 0,
            wearDebitApplied: 0,
            message: `Equipe '${teamId}' não encontrada para aplicar unidade PU-${puId}.`,
          })
          continue
        }

        const history = Array.isArray(teamRecord.get('engine_history'))
          ? [...teamRecord.get('engine_history')]
          : []
        let unitIndex = -1
        for (let h = 0; h < history.length; h++) {
          if (Number(history[h].id) === puId) {
            unitIndex = h
            break
          }
        }

        if (unitIndex === -1) {
          failedCount++
          unitResults.push({
            driverId: proj.driverId,
            driverName: proj.driverName,
            teamId: proj.teamId,
            powerUnitId: puId,
            status: 'FAILED_NOT_FOUND',
            distanceKmAdded: 0,
            wearDebitApplied: 0,
            message: `Unidade PU-${puId} não encontrada no engine_history da equipe '${teamId}'.`,
          })
          continue
        }

        const existingUnit = history[unitIndex]

        // PU-4UNITS-01A3 ITEM 1: Guarda de integridade de piloto e temporada
        if (
          (existingUnit.driverId && proj.driverId && existingUnit.driverId !== proj.driverId) ||
          (existingUnit.seasonYear && proj.season && existingUnit.seasonYear !== proj.season)
        ) {
          failedCount++
          unitResults.push({
            driverId: proj.driverId,
            driverName: proj.driverName,
            teamId: proj.teamId,
            powerUnitId: puId,
            status: 'FAILED_NOT_FOUND',
            distanceKmAdded: 0,
            wearDebitApplied: 0,
            message: `Mismatch de integridade na unidade PU-${puId}: piloto ou temporada incompatíveis (unidade: piloto=${existingUnit.driverId || 'n/a'}, ano=${existingUnit.seasonYear || 'n/a'}; projeção: piloto=${proj.driverId}, ano=${proj.season}).`,
          })
          continue
        }

        const prevMileage =
          typeof existingUnit.mileage_km === 'number' ? existingUnit.mileage_km : 0
        const prevCond =
          typeof existingUnit.condition === 'number'
            ? existingUnit.condition
            : typeof existingUnit.wear === 'number'
              ? Math.max(0, 100 - existingUnit.wear)
              : 100
        const prevWear =
          typeof existingUnit.wear === 'number' ? existingUnit.wear : Math.max(0, 100 - prevCond)

        const addDistance = proj.distanceKm || 0
        const wearDebit = proj.wearDebit || 0

        const newMileage = Number((prevMileage + addDistance).toFixed(3))
        const newCond = Number(Math.max(0, Math.min(100, prevCond - wearDebit)).toFixed(2))
        const newWear = Number(Math.max(0, Math.min(100, 100 - newCond)).toFixed(2))

        history[unitIndex] = {
          ...existingUnit,
          mileage_km: newMileage,
          condition: newCond,
          wear: newWear,
        }

        teamRecord.set('engine_history', history)
        if (existingUnit.status === 'instalado' || !existingUnit.status) {
          // NOTA: active_engine_wear é APENAS espelho de compatibilidade, não fonte esportiva.
          // A fonte canônica é engine_history por instância.
          teamRecord.set('active_engine_wear', newWear)
        }
        txApp.save(teamRecord)

        appliedUnitSet.add(puId)
        appliedDriverSet.add(proj.driverId)
        appliedCount++

        unitResults.push({
          driverId: proj.driverId,
          driverName: proj.driverName,
          teamId: proj.teamId,
          powerUnitId: puId,
          status: wearDebit === 0 ? 'ZERO_WEAR_APPLIED' : 'APPLIED',
          distanceKmAdded: addDistance,
          wearDebitApplied: wearDebit,
          previousMileageKm: prevMileage,
          newMileageKm: newMileage,
          previousCondition: prevCond,
          newCondition: newCond,
          previousWear: prevWear,
          newWear: newWear,
        })
      }
    }

    const finalAppliedUnitIds = Array.from(appliedUnitSet)
    const finalAppliedDriverIds = Array.from(appliedDriverSet)

    journalRecord.set('applied_unit_ids', finalAppliedUnitIds)
    journalRecord.set('applied_driver_ids', finalAppliedDriverIds)
    journalRecord.set('unit_results', unitResults)

    const finalStatus =
      failedCount > 0
        ? 'PARTIAL'
        : appliedCount > 0 || alreadyAppliedCount > 0
          ? 'COMPLETE'
          : 'COMPLETE'

    journalRecord.set('status', finalStatus)
    journalRecord.set(
      'last_error',
      failedCount > 0 ? 'Falha em uma ou mais unidades durante aplicação' : '',
    )
    txApp.save(journalRecord)

    resultPayload = {
      sessionKey,
      careerId,
      season,
      round,
      raceVariant,
      status: failedCount > 0 ? 'PARTIAL' : 'SUCCESS',
      journal: {
        journalKey,
        careerId,
        season,
        round,
        raceVariant,
        sessionKey,
        status: finalStatus,
        appliedUnitIds: finalAppliedUnitIds,
        appliedDriverIds: finalAppliedDriverIds,
        startedAt: journalRecord.getString('created'),
        completedAt: journalRecord.getString('updated'),
      },
      appliedCount,
      alreadyAppliedCount,
      pendingOrUnlinkedCount,
      failedCount,
      unitResults,
    }
  })

  return e.json(200, resultPayload)
})

routerAdd('GET', '/backend/v1/pu-usage/journal', (e) => {
  // 1. Resolver usuário autenticado
  let authUser = null
  if (e.auth) {
    authUser = e.auth
  } else {
    const reqInfo = e.requestInfo ? e.requestInfo() : null
    if (reqInfo && reqInfo.authRecord) {
      authUser = reqInfo.authRecord
    }
  }

  if (!authUser || !authUser.id) {
    throw new UnauthorizedError('Autenticação obrigatória para consultar journal de PU.')
  }

  const careerId = e.request.url.query().get('careerId') || ''
  if (!careerId) {
    throw new BadRequestError('careerId é obrigatório')
  }

  // 2. Verificar autorização sobre a carreira
  let hasAccess = false
  if (authUser.isSuperuser && authUser.isSuperuser()) {
    hasAccess = true
  } else {
    const userId = authUser.id
    if (careerId === userId) {
      hasAccess = true
    } else {
      try {
        const teams = e.app.findRecordsByFilter(
          'teams',
          `user_id = '${userId}' && (id = '${careerId}' || team_key = '${careerId}')`,
          '',
          1,
          0,
        )
        if (teams && teams.length > 0) {
          hasAccess = true
        }
      } catch (_) {}

      if (!hasAccess) {
        try {
          const seasons = e.app.findRecordsByFilter(
            'seasons',
            `id = '${careerId}' && team_id.user_id = '${userId}'`,
            '',
            1,
            0,
          )
          if (seasons && seasons.length > 0) {
            hasAccess = true
          }
        } catch (_) {}
      }

      if (!hasAccess) {
        try {
          const userTeams = e.app.findRecordsByFilter('teams', `user_id = '${userId}'`, '', 10, 0)
          for (let i = 0; i < userTeams.length; i++) {
            const ut = userTeams[i]
            if (ut.id === careerId || ut.get('team_key') === careerId) {
              hasAccess = true
              break
            }
            try {
              const teamSeasons = e.app.findRecordsByFilter(
                'seasons',
                `team_id = '${ut.id}'`,
                '',
                10,
                0,
              )
              for (let s = 0; s < teamSeasons.length; s++) {
                if (teamSeasons[s].id === careerId) {
                  hasAccess = true
                  break
                }
              }
              if (hasAccess) break
            } catch (_) {}
          }
        } catch (_) {}
      }
    }
  }

  if (!hasAccess) {
    throw new ForbiddenError('Acesso não autorizado ao journal desta carreira.')
  }

  const season = Number(e.request.url.query().get('season')) || 0
  const round = Number(e.request.url.query().get('round')) || 0
  const raceVariant = e.request.url.query().get('raceVariant') || 'MAIN_RACE'
  const variantSlug = raceVariant === 'SPRINT_RACE' ? 'sprint' : 'main'
  const journalKey = `apex_gp_pu_usage_journal_${careerId}_s${season}_r${round}_${variantSlug}`

  try {
    const journalRecord = e.app.findFirstRecordByData(
      'power_unit_usage_journals',
      'journal_key',
      journalKey,
    )

    if (journalRecord.get('career_id') !== careerId) {
      throw new ForbiddenError('Conflito de carreira no journal consultado.')
    }

    return e.json(200, {
      journal: {
        journalKey,
        careerId,
        season,
        round,
        raceVariant,
        sessionKey: journalRecord.getString('session_key'),
        status: journalRecord.get('status'),
        appliedUnitIds: journalRecord.get('applied_unit_ids') || [],
        appliedDriverIds: journalRecord.get('applied_driver_ids') || [],
        startedAt: journalRecord.getString('created'),
        completedAt: journalRecord.getString('updated'),
        lastError: journalRecord.getString('last_error'),
      },
      unitResults: journalRecord.get('unit_results') || [],
    })
  } catch (err) {
    if (err instanceof ForbiddenError) {
      throw err
    }
    return e.json(404, { message: 'Journal não encontrado' })
  }
})
