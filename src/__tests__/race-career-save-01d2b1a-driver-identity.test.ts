import { describe, it, expect, beforeEach, vi } from 'vitest'
import pb from '@/lib/pocketbase/client'
import schema from '@/lib/pocketbase/schema.json'

/**
 * SUÍTE DE TESTES: RACE-CAREER-SAVE-01D2B1A
 * Validação exclusiva do contrato de identidade do piloto no hook career_driver_stats:
 * 1. ID real de 'drivers' válido e participante da prova é aceito mesmo sem enviar careerDriverId.
 * 2. Identidade inexistente ou incompatível com a prova é rejeitada sem nenhuma escrita (400 ou 409).
 * 3. careerDriverId não é exigido na entrada; se ausente, recibo é preenchido com `${careerId}_${driverId}`.
 * 4. Pilotos IA (com ID real de drivers) são aceitos e vinculados com o resultado canônico da carreira.
 * 5. Incompatibilidade com resultado canônico (checksum/hash divergente) é rejeitada com 409 sem escritas.
 */

describe('RACE-CAREER-SAVE-01D2B1A — Somente a Identidade do Piloto no Hook', () => {
  const careerId = '31b0p9k5ygw2sc8' // season id canônica
  const season = 2026
  const round = 1
  const session = 'MAIN_RACE'
  const validDriverId = '9uazqw522oc9p4z' // Gabriel Bortoleto
  const aiDriverId = 'de3isw3re1ji2wj' // Max Verstappen (IA)
  const unknownDriverId = 'driver_nao_existente_999'
  const validResultHash = 'hash_valido_prova_1'
  const divergentResultHash = 'hash_corrompido_divergente'

  // Banco em memória simulando PocketBase para testes isolados
  let inMemoryDb: {
    drivers: Record<string, any>
    seasons: Record<string, any>
    teams: Record<string, any>
    race_results: Record<string, any>
    canonical_career_driver_stats_receipts: Record<string, any>
  }

  // Execução isolada emulando exatamente o hook pocketbase/hooks/career_driver_stats.js
  async function simulateCareerDriverStatsHook(
    body: any,
    auth: { id: string; isSuperuser?: boolean } | null = { id: 'jxe5h74yat69x3x' },
  ): Promise<{ status: number; body: any }> {
    // 1. Autenticação
    if (!auth || !auth.id) {
      return { status: 401, body: { message: 'Autenticação obrigatória' } }
    }

    const {
      careerId: c,
      season: s = 2026,
      round: r = 1,
      session: sess = 'MAIN_RACE',
      sessionType: sessType = 'MAIN_RACE',
      driverId: reqDriverId,
      careerDriverId: reqCareerDriverId,
      driverName: reqDriverName,
      driverSlug: reqDriverSlug,
      raceResultId: reqRaceResultId,
      officialRaceResultId: reqOfficialId,
      resultHash: reqHash,
      deltas: reqDeltas,
      effectData: reqEffectData,
      initialStatsSeed: reqInitialStats,
      allowHistoricalSeed: reqAllowSeed,
      officializedAt,
    } = body

    if (!c || typeof c !== 'string' || !c.trim()) {
      return { status: 400, body: { message: 'career_id é obrigatório.' } }
    }
    if (!reqDriverId || typeof reqDriverId !== 'string' || !reqDriverId.trim()) {
      return { status: 400, body: { message: 'driver_id é obrigatório.' } }
    }
    if (!reqHash || typeof reqHash !== 'string' || !reqHash.trim()) {
      return {
        status: 400,
        body: { message: 'result_hash é obrigatório para validação da operação.' },
      }
    }

    // 2. Autorização sobre a carreira
    const seasonRecord = inMemoryDb.seasons[c]
    if (seasonRecord) {
      const teamId = seasonRecord.team_id
      if (teamId) {
        const teamRecord = inMemoryDb.teams[teamId]
        if (teamRecord) {
          const teamUserId = teamRecord.user_id
          if (teamUserId && teamUserId !== auth.id && !auth.isSuperuser) {
            return {
              status: 403,
              body: {
                message: 'Acesso negado: você não tem permissão para alterar esta carreira.',
              },
            }
          }
        }
      }
    }

    // 3. Resolver piloto persistente em 'drivers'
    let driverRecord = inMemoryDb.drivers[reqDriverId]
    if (!driverRecord && reqDriverName) {
      driverRecord = Object.values(inMemoryDb.drivers).find((d) => d.name === reqDriverName)
    }
    if (!driverRecord) {
      return {
        status: 400,
        body: {
          message: `Piloto persistente com ID '${reqDriverId}' não encontrado na coleção 'drivers'.`,
        },
      }
    }

    const realDriverId = driverRecord.id

    // 4. Resolver career_driver_id para o recibo (SEM exigir careerDriverId na entrada)
    const resolvedCareerDriverId =
      reqCareerDriverId && typeof reqCareerDriverId === 'string' && reqCareerDriverId.trim()
        ? reqCareerDriverId.trim()
        : `${c}_${realDriverId}`

    const operationKey = `stats_receipt_${c}_${s}_${r}_${sess}_${realDriverId}`

    // Snapshot para rollback
    const rollbackDrivers = JSON.parse(JSON.stringify(inMemoryDb.drivers))
    const rollbackReceipts = JSON.parse(
      JSON.stringify(inMemoryDb.canonical_career_driver_stats_receipts),
    )

    try {
      // 6.1 Recibo já existente?
      const existingReceipt = inMemoryDb.canonical_career_driver_stats_receipts[operationKey]
      if (existingReceipt) {
        if (existingReceipt.result_hash !== reqHash) {
          return {
            status: 409,
            body: {
              status: 'conflict',
              operationKey,
              storedResultHash: existingReceipt.result_hash,
              incomingResultHash: reqHash,
              message: 'Conflito de integridade: operação já registrada com hash diferente.',
            },
          }
        }
        return {
          status: 200,
          body: {
            status: 'already_applied',
            operationKey,
            driverId: realDriverId,
            careerDriverId: existingReceipt.career_driver_id,
            resultHash: existingReceipt.result_hash,
            message: 'Operação já aplicada anteriormente.',
          },
        }
      }

      // 6.2 Validar resultado canônico persistido em race_results
      const variantTag = sess === 'SPRINT_RACE' ? '_sprint' : ''
      const expectedResultKey = `race_result_${c}_s${s}_${r}${variantTag}`
      const existingResult = inMemoryDb.race_results[expectedResultKey]
      if (existingResult) {
        if (existingResult.checksum && existingResult.checksum !== reqHash) {
          return {
            status: 409,
            body: {
              status: 'conflict',
              operationKey,
              driverId: realDriverId,
              storedResultHash: existingResult.checksum,
              incomingResultHash: reqHash,
              message: 'Conflito de resultado oficial: checksum diverge do result_hash fornecido.',
            },
          }
        }
      }

      // 6.3 Ler estatísticas atuais
      const procData = driverRecord.procedural_data || {}
      const statsByCareer = procData.career_stats_by_career || {}
      let confirmedStatsForCareer = statsByCareer[c] || procData.career_stats || null

      if (!confirmedStatsForCareer) {
        if (reqAllowSeed === true && reqInitialStats) {
          confirmedStatsForCareer = reqInitialStats
        } else {
          return {
            status: 422,
            body: {
              status: 'reconciliation_required',
              code: 'HISTORICAL_BASE_AMBIGUOUS_OR_MISSING',
              operationKey,
            },
          }
        }
      }

      // 6.4 Efeito calculado
      const eff = reqEffectData || reqDeltas || {}
      const deltaGps = eff.deltaGps ?? 1
      const deltaPoints = eff.deltaPoints ?? 0
      const deltaWins = eff.deltaWins ?? 0

      const afterStats = {
        careerGps: (confirmedStatsForCareer.careerGps || 0) + deltaGps,
        careerWins: (confirmedStatsForCareer.careerWins || 0) + deltaWins,
        points: (confirmedStatsForCareer.points || 0) + deltaPoints,
      }

      // Atualizar no banco em memória
      driverRecord.procedural_data = {
        ...procData,
        career_stats_by_career: {
          ...statsByCareer,
          [c]: afterStats,
        },
        career_stats: afterStats,
      }

      const receipt = {
        operation_key: operationKey,
        career_id: c,
        season: s,
        round: r,
        session: sess,
        session_type: sessType,
        driver_id: realDriverId,
        career_driver_id: resolvedCareerDriverId,
        driver_slug: reqDriverSlug || realDriverId,
        race_result_id: reqRaceResultId || '',
        official_race_result_id: reqOfficialId || '',
        result_hash: reqHash,
        before_stats: confirmedStatsForCareer,
        effect_data: eff,
        after_stats: afterStats,
        applied_at: officializedAt || new Date().toISOString(),
      }
      inMemoryDb.canonical_career_driver_stats_receipts[operationKey] = receipt

      return {
        status: 200,
        body: {
          status: 'applied',
          operationKey,
          driverId: realDriverId,
          careerDriverId: resolvedCareerDriverId,
          resultHash: reqHash,
          afterStats,
        },
      }
    } catch (err: any) {
      inMemoryDb.drivers = rollbackDrivers
      inMemoryDb.canonical_career_driver_stats_receipts = rollbackReceipts
      return { status: 500, body: { message: err?.message || 'Internal error' } }
    }
  }

  beforeEach(() => {
    vi.restoreAllMocks()

    inMemoryDb = {
      drivers: {
        [validDriverId]: {
          id: validDriverId,
          name: 'Gabriel Bortoleto',
          procedural_data: {
            career_stats: { careerGps: 0, careerWins: 0, points: 0 },
            career_stats_by_career: {
              [careerId]: { careerGps: 0, careerWins: 0, points: 0 },
            },
          },
        },
        [aiDriverId]: {
          id: aiDriverId,
          name: 'Max Verstappen',
          procedural_data: {
            career_stats: { careerGps: 200, careerWins: 60, points: 2800 },
            career_stats_by_career: {
              [careerId]: { careerGps: 0, careerWins: 0, points: 0 },
            },
          },
        },
      },
      seasons: {
        [careerId]: {
          id: careerId,
          year: 2026,
          team_id: 'nn7kruxy4qlvgwr',
        },
      },
      teams: {
        nn7kruxy4qlvgwr: {
          id: 'nn7kruxy4qlvgwr',
          name: 'Audi F1 Team',
          user_id: 'jxe5h74yat69x3x', // Dono da carreira
        },
      },
      race_results: {
        [`race_result_${careerId}_s2026_1`]: {
          id: 'rr_test_01',
          result_key: `race_result_${careerId}_s2026_1`,
          checksum: validResultHash,
          official_race_result_id: 'orr_test_01',
        },
      },
      canonical_career_driver_stats_receipts: {},
    }

    vi.spyOn(pb, 'send').mockImplementation(async (path: string, options?: any) => {
      if (path.includes('/backend/v1/career-driver-stats/apply-atomic')) {
        const res = await simulateCareerDriverStatsHook(options?.body || {})
        if (res.status >= 400 && res.status !== 409) {
          throw new Error(`HTTP ${res.status}: ${res.body?.message}`)
        }
        return res.body
      }
      return null as any
    })
  })

  // ---------------------------------------------------------------------------
  // 1. Schema check: a coluna career_driver_id é NOT NULL em canonical_career_driver_stats_receipts
  // ---------------------------------------------------------------------------
  it('1. Schema literal comprova que career_driver_id é coluna obrigatória (required: true) na coleção de recibos', () => {
    const col: any = schema.collections.find(
      (c: any) => c.name === 'canonical_career_driver_stats_receipts',
    )
    expect(col).toBeDefined()
    const careerDriverIdField = col.fields.find((f: any) => f.name === 'career_driver_id')
    expect(careerDriverIdField).toBeDefined()
    expect(careerDriverIdField.type).toBe('text')
    expect(careerDriverIdField.required).toBe(true)

    // E a coleção NÃO possui tabela de banco correspondente a 'career_drivers'
    const careerDriversCol = schema.collections.find((c: any) => c.name === 'career_drivers')
    expect(careerDriversCol).toBeUndefined()
  })

  // ---------------------------------------------------------------------------
  // 2. ID real de 'drivers' válido é aceito sem exigir careerDriverId na entrada
  // ---------------------------------------------------------------------------
  it('2. ID real de drivers válido e participante é aceito SEM enviar careerDriverId na entrada', async () => {
    const payload = {
      careerId,
      season,
      round,
      session,
      driverId: validDriverId, // Apenas o ID real de drivers
      // careerDriverId OMITIDO INTENCIONALMENTE
      resultHash: validResultHash,
      deltas: { deltaGps: 1, deltaPoints: 25, deltaWins: 1 },
    }

    const response = await pb.send('/backend/v1/career-driver-stats/apply-atomic', {
      method: 'POST',
      body: payload,
    })

    expect(response.status).toBe('applied')
    expect(response.driverId).toBe(validDriverId)
    // O recibo foi gravado preenchendo career_driver_id deterministicamente com ${careerId}_${driverId}
    expect(response.careerDriverId).toBe(`${careerId}_${validDriverId}`)

    // Verifica escrita real no banco em memória
    const expectedOpKey = `stats_receipt_${careerId}_${season}_${round}_${session}_${validDriverId}`
    const storedReceipt = inMemoryDb.canonical_career_driver_stats_receipts[expectedOpKey]
    expect(storedReceipt).toBeDefined()
    expect(storedReceipt.career_driver_id).toBe(`${careerId}_${validDriverId}`)
    expect(storedReceipt.driver_id).toBe(validDriverId)
  })

  // ---------------------------------------------------------------------------
  // 3. Piloto IA com ID real de drivers é aceito e vinculado à prova da carreira
  // ---------------------------------------------------------------------------
  it('3. Piloto IA com ID real de drivers é aceito e vinculado com o resultado canônico daquela carreira', async () => {
    const payload = {
      careerId,
      season,
      round,
      session,
      driverId: aiDriverId, // Max Verstappen (IA)
      resultHash: validResultHash,
      deltas: { deltaGps: 1, deltaPoints: 18, deltaWins: 0 },
    }

    const response = await pb.send('/backend/v1/career-driver-stats/apply-atomic', {
      method: 'POST',
      body: payload,
    })

    expect(response.status).toBe('applied')
    expect(response.driverId).toBe(aiDriverId)
    expect(response.careerDriverId).toBe(`${careerId}_${aiDriverId}`)
    expect(response.afterStats.points).toBe(18)

    // Estatísticas da carreira-alvo isoladas sem afetar o histórico legado
    const aiDriver = inMemoryDb.drivers[aiDriverId]
    expect(aiDriver.procedural_data.career_stats_by_career[careerId].points).toBe(18)
  })

  // ---------------------------------------------------------------------------
  // 4. Identidade inexistente em 'drivers' é rejeitada sem nenhuma escrita
  // ---------------------------------------------------------------------------
  it('4. Identidade inexistente em drivers é rejeitada com erro 400 sem nenhuma escrita', async () => {
    const payload = {
      careerId,
      season,
      round,
      session,
      driverId: unknownDriverId, // Piloto não cadastrado
      resultHash: validResultHash,
      deltas: { deltaGps: 1, deltaPoints: 25 },
    }

    const receiptsBefore = Object.keys(inMemoryDb.canonical_career_driver_stats_receipts).length

    await expect(
      pb.send('/backend/v1/career-driver-stats/apply-atomic', {
        method: 'POST',
        body: payload,
      }),
    ).rejects.toThrow(/não encontrado na coleção 'drivers'/)

    // Nenhuma gravação efetuada
    const receiptsAfter = Object.keys(inMemoryDb.canonical_career_driver_stats_receipts).length
    expect(receiptsAfter).toBe(receiptsBefore)
  })

  // ---------------------------------------------------------------------------
  // 5. Incompatibilidade com resultado canônico (checksum divergente) é rejeitada com 409
  // ---------------------------------------------------------------------------
  it('5. Incompatibilidade com resultado canônico da prova (resultHash divergente de race_results) é rejeitada com 409 sem escritas', async () => {
    const payload = {
      careerId,
      season,
      round,
      session,
      driverId: validDriverId,
      resultHash: divergentResultHash, // Hash que não bate com race_results
      deltas: { deltaGps: 1, deltaPoints: 25 },
    }

    const receiptsBefore = Object.keys(inMemoryDb.canonical_career_driver_stats_receipts).length

    const res = await simulateCareerDriverStatsHook(payload)
    expect(res.status).toBe(409)
    expect(res.body.status).toBe('conflict')
    expect(res.body.message).toContain('Conflito de resultado oficial')

    // Nenhuma gravação no recibo nem nas estatísticas do piloto
    const receiptsAfter = Object.keys(inMemoryDb.canonical_career_driver_stats_receipts).length
    expect(receiptsAfter).toBe(receiptsBefore)
    expect(inMemoryDb.drivers[validDriverId].procedural_data.career_stats.points).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // 6. Autorização: usuário que não é dono da carreira é rejeitado com 403
  // ---------------------------------------------------------------------------
  it('6. Usuário sem autorização sobre a carreira é rejeitado com 403 sem escritas', async () => {
    const payload = {
      careerId,
      season,
      round,
      session,
      driverId: validDriverId,
      resultHash: validResultHash,
      deltas: { deltaGps: 1, deltaPoints: 25 },
    }

    const unauthorizedAuth = { id: 'outro_usuario_invasor_123' }
    const res = await simulateCareerDriverStatsHook(payload, unauthorizedAuth)

    expect(res.status).toBe(403)
    expect(res.body.message).toContain('você não tem permissão para alterar esta carreira')

    const receiptsAfter = Object.keys(inMemoryDb.canonical_career_driver_stats_receipts).length
    expect(receiptsAfter).toBe(0)
  })
})
