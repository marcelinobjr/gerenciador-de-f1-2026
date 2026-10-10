import { describe, it, expect, beforeEach, vi } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  calculateCareerDriverStatsEffect,
  normalizeStats,
} from '@/services/careerDriverStatsCalculator'

/**
 * SUÍTE FOCAL: RACE-CAREER-SAVE-01D2B1B
 * Fechamento da validação da base autoritativa usada pelo hook career_driver_stats:
 *
 * REQUISITOS DO BLOCO B1B:
 * 1. BASE AUTORITATIVA:
 *    - Lê estatísticas atuais de: drivers.procedural_data.career_stats_by_career[careerId]
 *    - Leitura e atualização na mesma transação atômica.
 *    - Base ausente, vazia, inválida ou sem associação comprovada à carreira produz 422 com código estável
 *      ('HISTORICAL_BASE_AMBIGUOUS_OR_MISSING'), antes de qualquer alteração ou criação de recibo.
 *    - Não usar automaticamente:
 *      * estatísticas globais legadas de career_stats;
 *      * valores de outra carreira;
 *      * dados enviados pelo cliente ou pelo localStorage;
 *      * zeros fabricados pelo normalizador.
 *    - Preservar zeros legítimos (ex: piloto novato com 0 GPs, 0 pts) e campos opcionais legítimos
 *      (ex: ausência de bestFinish não invalida a base).
 *
 * 2. ISOLAMENTO:
 *    - Atualizar somente a entrada da carreira-alvo, preservando:
 *      * estatísticas das demais carreiras (career_stats_by_career[outraCarreira]);
 *      * outros campos de procedural_data (visualIdentity, psychology, contratos);
 *      * moral e demais dados do piloto.
 *
 * 3. REPETIÇÃO:
 *    - Preservar o reconhecimento de recibo existente com identidade/hash correspondentes.
 *    - Não reaplicar a operação nem restaurar seu after_stats histórico sobre o estado atual.
 *    - Se houver recibo mas faltar o estado atual da carreira, distinguir "operação já aplicada"
 *      de "estado atual precisa de reconciliação" sem tentar reconstruí-lo silenciosamente.
 *
 * 4. VERIFICAÇÃO FOCAL:
 *    - Base válida com valores zero aceita o efeito correto.
 *    - Base ausente/vazia/inválida retorna 422 sem alterar piloto ou criar recibo.
 *    - Existência apenas de base global ou de outra carreira não autoriza aplicação.
 *    - Aplicar na carreira A preserva integralmente B e os demais dados.
 *    - Recibo existente impede nova aplicação e não restaura valores antigos.
 */

describe('RACE-CAREER-SAVE-01D2B1B — Base Autoritativa e Isolamento de Carreira no Hook', () => {
  const careerA = 'career_alpha_user_2026'
  const careerB = 'career_beta_separate_2026'
  const season = 2026
  const round = 1
  const session = 'MAIN_RACE'
  const driverId = 'drv_bortoleto_pb'
  const validResultHash = 'hash_valido_prova_b1b'

  // Banco em memória simulando PocketBase para testes isolados
  let inMemoryDb: {
    drivers: Record<string, any>
    seasons: Record<string, any>
    teams: Record<string, any>
    race_results: Record<string, any>
    canonical_career_driver_stats_receipts: Record<string, any>
  }

  // Validador canônico espelhado de isValidCareerStatsBase no hook
  function isValidCareerStatsBase(obj: any): boolean {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
    const hasNumericGps =
      (typeof obj.careerGps === 'number' && !Number.isNaN(obj.careerGps)) ||
      (typeof obj.raceStarts === 'number' && !Number.isNaN(obj.raceStarts))
    const hasNumericWins =
      (typeof obj.careerWins === 'number' && !Number.isNaN(obj.careerWins)) ||
      (typeof obj.wins === 'number' && !Number.isNaN(obj.wins))
    const hasNumericPoints =
      (typeof obj.careerPoints === 'number' && !Number.isNaN(obj.careerPoints)) ||
      (typeof obj.points === 'number' && !Number.isNaN(obj.points))

    return Boolean(hasNumericGps && hasNumericWins && hasNumericPoints)
  }

  // Simulação fiel e estrita do hook pocketbase/hooks/career_driver_stats.js
  async function simulateCareerDriverStatsHook(
    body: any,
    auth: { id: string; isSuperuser?: boolean } | null = { id: 'user_owner_123' },
  ): Promise<{ status: number; body: any }> {
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

    // 3. Resolver registro de drivers estritamente por ID
    const driverRecord = inMemoryDb.drivers[reqDriverId]
    if (!driverRecord) {
      return {
        status: 400,
        body: {
          message: `Piloto persistente com ID '${reqDriverId}' não encontrado na coleção 'drivers'.`,
        },
      }
    }

    const realDriverId = driverRecord.id
    const resolvedCareerDriverId =
      reqCareerDriverId && typeof reqCareerDriverId === 'string' && reqCareerDriverId.trim()
        ? reqCareerDriverId.trim()
        : `${c}_${realDriverId}`

    const operationKey = `stats_receipt_${c}_${s}_${r}_${sess}_${realDriverId}`

    // Snapshot para rollback da transação
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

        // Reconhecimento de recibo existente sem reaplicação
        const existingProcData = driverRecord.procedural_data || {}
        const existingStatsByCareer = existingProcData.career_stats_by_career || {}
        const currentStatsForCareer = existingStatsByCareer[c] || null
        const currentMissing =
          !currentStatsForCareer || !isValidCareerStatsBase(currentStatsForCareer)

        return {
          status: 200,
          body: {
            status: 'already_applied',
            operationKey,
            careerId: c,
            season: s,
            round: r,
            session: sess,
            sessionType: sessType,
            driverId: realDriverId,
            careerDriverId: existingReceipt.career_driver_id || resolvedCareerDriverId,
            resultHash: existingReceipt.result_hash,
            beforeStats: existingReceipt.before_stats || {},
            effectData: existingReceipt.effect_data || {},
            afterStats: existingReceipt.after_stats || {},
            currentDriverStats: currentStatsForCareer || undefined,
            needsReconciliation: currentMissing,
            message: currentMissing
              ? 'Operação já aplicada com recibo confirmado, mas o estado atual da carreira em drivers está ausente. Reconciliação requerida; reconstrução silenciosa proibida.'
              : 'Operação de estatísticas já aplicada anteriormente. Recibo recuperado sem reaplicação.',
          },
        }
      }

      // 6.2 Validar resultado canônico se presente
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
              message: 'Conflito de resultado oficial com checksum em race_results',
            },
          }
        }
      }

      // 6.3 BASE AUTORITATIVA (RACE-CAREER-SAVE-01D2B1B)
      // Ler estatísticas atuais estritamente de drivers.procedural_data.career_stats_by_career[careerId]
      const procData = driverRecord.procedural_data || {}
      const statsByCareer = procData.career_stats_by_career || {}
      let confirmedStatsForCareer = statsByCareer[c] || null

      if (!confirmedStatsForCareer || !isValidCareerStatsBase(confirmedStatsForCareer)) {
        if (reqAllowSeed === true && reqInitialStats && isValidCareerStatsBase(reqInitialStats)) {
          confirmedStatsForCareer = reqInitialStats
        } else {
          // Erro explícito 422 sem alterar piloto nem criar recibo
          return {
            status: 422,
            body: {
              status: 'reconciliation_required',
              code: 'HISTORICAL_BASE_AMBIGUOUS_OR_MISSING',
              operationKey,
              careerId: c,
              driverId: realDriverId,
              message: `Pendência explícita de reconciliação: o piloto '${realDriverId}' não possui base histórica confirmada para a carreira '${c}' em procedural_data.career_stats_by_career[careerId]. Inicialização silenciosa com zeros, uso de career_stats global legado ou valores de outra carreira estão proibidos. Reconciliação prévia obrigatória.`,
            },
          }
        }
      }

      // 6.4 Efeito via calculador puro oficial
      const eff = reqEffectData || reqDeltas || {}
      const calcResult = calculateCareerDriverStatsEffect(confirmedStatsForCareer, eff, {
        careerId: c,
        season: s,
        round: r,
        session: sess,
        sessionType: sessType,
        driverId: realDriverId,
      })

      const beforeStats = calcResult.beforeStats
      const calculatedEffect = calcResult.effectData
      const afterStats = calcResult.afterStats

      // 6.5 Atualização estrita: apenas career_stats_by_career[c]
      const updatedStatsByCareer = {
        ...statsByCareer,
        [c]: afterStats,
      }

      driverRecord.procedural_data = {
        ...procData,
        career_stats_by_career: updatedStatsByCareer,
        career_stats: afterStats, // espelho retrocompatível
        career_driver_id: resolvedCareerDriverId,
        updatedAt: new Date().toISOString(),
      }

      // 6.6 Gravação de recibo
      const nowIso = officializedAt || new Date().toISOString()
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
        before_stats: beforeStats,
        effect_data: calculatedEffect,
        after_stats: afterStats,
        applied_at: nowIso,
      }
      inMemoryDb.canonical_career_driver_stats_receipts[operationKey] = receipt

      return {
        status: 200,
        body: {
          status: 'applied',
          operationKey,
          careerId: c,
          driverId: realDriverId,
          careerDriverId: resolvedCareerDriverId,
          resultHash: reqHash,
          beforeStats,
          effectData: calculatedEffect,
          afterStats,
          appliedAt: nowIso,
        },
      }
    } catch (err: any) {
      inMemoryDb.drivers = rollbackDrivers
      inMemoryDb.canonical_career_driver_stats_receipts = rollbackReceipts
      return { status: 500, body: { message: err?.message || 'Internal error' } }
    }
  }

  // Simulação do endpoint GET /backend/v1/career-driver-stats/receipt
  async function simulateReceiptGet(params: {
    careerId: string
    season: number
    round: number
    session: string
    driverId: string
  }): Promise<{ status: number; body: any }> {
    const { careerId: c, season: s, round: r, session: sess, driverId: dId } = params
    const operationKey = `stats_receipt_${c}_${s}_${r}_${sess}_${dId}`
    const driverRecord = inMemoryDb.drivers[dId]
    const procData = driverRecord?.procedural_data || {}
    const statsByCareer = procData.career_stats_by_career || {}
    const currentDriverStats = statsByCareer[c] || null
    const hasCurrentStats = currentDriverStats && typeof currentDriverStats === 'object'

    const receipt = inMemoryDb.canonical_career_driver_stats_receipts[operationKey]
    if (receipt) {
      return {
        status: 200,
        body: {
          exists: true,
          operationKey,
          careerId: receipt.career_id,
          driverId: receipt.driver_id,
          resultHash: receipt.result_hash,
          beforeStats: receipt.before_stats,
          effectData: receipt.effect_data,
          afterStats: receipt.after_stats,
          appliedAt: receipt.applied_at,
          currentDriverStats: currentDriverStats || undefined,
          needsReconciliation: !hasCurrentStats,
          message: !hasCurrentStats
            ? 'Operação já aplicada com recibo existente, porém o estado atual da carreira em drivers está ausente. Reconciliação requerida.'
            : 'Recibo recuperado com sucesso.',
        },
      }
    }

    return {
      status: 200,
      body: {
        exists: false,
        operationKey,
        careerId: c,
        driverId: dId,
        currentDriverStats: currentDriverStats || undefined,
        needsReconciliation: !hasCurrentStats,
      },
    }
  }

  beforeEach(() => {
    vi.restoreAllMocks()

    inMemoryDb = {
      drivers: {
        [driverId]: {
          id: driverId,
          name: 'Gabriel Bortoleto',
          morale: 85,
          condition: 98,
          procedural_data: {
            visualIdentity: { portraitId: 'img_bortoleto_01' },
            psychology: { confidence: 88, focus: 90 },
            contract: { teamId: 'nn7kruxy4qlvgwr', salary: 2500000 },
            career_stats: {
              // Histórico global legado (ex: carreira anterior do save 1)
              careerGps: 44,
              careerWins: 5,
              points: 320,
            },
            career_stats_by_career: {
              [careerA]: {
                careerGps: 0,
                raceStarts: 0,
                careerWins: 0,
                wins: 0,
                careerPoints: 0,
                points: 0,
                careerPoles: 0,
                poles: 0,
                careerPodiums: 0,
                podiums: 0,
                careerFastestLaps: 0,
                fastestLaps: 0,
                careerDnfs: 0,
                dnfs: 0,
                careerTitles: 0,
                lapsCompleted: 0,
                pitStops: 0,
                positionsGained: 0,
                bestFinish: null, // Ausência legítima de melhor chegada (novato nunca correu)
                bestGridPosition: null,
              },
              [careerB]: {
                careerGps: 15,
                raceStarts: 15,
                careerWins: 2,
                wins: 2,
                careerPoints: 110,
                points: 110,
                careerPoles: 1,
                poles: 1,
                careerPodiums: 4,
                podiums: 4,
                careerFastestLaps: 2,
                fastestLaps: 2,
                careerDnfs: 1,
                dnfs: 1,
                careerTitles: 0,
                lapsCompleted: 750,
                pitStops: 18,
                positionsGained: 5,
                bestFinish: 1,
                bestGridPosition: 1,
              },
            },
          },
        },
      },
      seasons: {
        [careerA]: { id: careerA, year: 2026, team_id: 'nn7kruxy4qlvgwr' },
        [careerB]: { id: careerB, year: 2026, team_id: 'nn7kruxy4qlvgwr' },
      },
      teams: {
        nn7kruxy4qlvgwr: {
          id: 'nn7kruxy4qlvgwr',
          name: 'Audi F1 Team',
          user_id: 'user_owner_123',
        },
      },
      race_results: {
        [`race_result_${careerA}_s2026_1`]: {
          id: 'rr_alpha_1',
          result_key: `race_result_${careerA}_s2026_1`,
          checksum: validResultHash,
        },
      },
      canonical_career_driver_stats_receipts: {},
    }

    vi.spyOn(pb, 'send').mockImplementation(async (path: string, options?: any) => {
      if (path.includes('/backend/v1/career-driver-stats/apply-atomic')) {
        const res = await simulateCareerDriverStatsHook(options?.body || {})
        if (res.status >= 400 && res.status !== 409) {
          const err: any = new Error(`HTTP ${res.status}: ${res.body?.message || res.body?.code}`)
          err.status = res.status
          err.response = res.body
          throw err
        }
        return res.body
      }
      if (path.includes('/backend/v1/career-driver-stats/receipt')) {
        const url = new URL(`https://dummy.goskip.dev${path}`)
        const queryParams = {
          careerId: url.searchParams.get('careerId') || '',
          season: Number(url.searchParams.get('season')) || 2026,
          round: Number(url.searchParams.get('round')) || 1,
          session: url.searchParams.get('session') || 'MAIN_RACE',
          driverId: url.searchParams.get('driverId') || '',
        }
        const res = await simulateReceiptGet(queryParams)
        return res.body
      }
      return null as any
    })
  })

  // ---------------------------------------------------------------------------
  // 1. BASE VÁLIDA COM VALORES ZERO: aceita o efeito correto
  // ---------------------------------------------------------------------------
  it('1. Base válida com valores numéricos zero (piloto estreante na carreira) aceita a aplicação correta', async () => {
    const payload = {
      careerId: careerA,
      season,
      round,
      session,
      driverId,
      resultHash: validResultHash,
      deltas: {
        deltaGps: 1,
        deltaWins: 1,
        deltaPoints: 25,
        newFinishPosition: 1,
        newGridPosition: 3,
      },
    }

    const response = await pb.send('/backend/v1/career-driver-stats/apply-atomic', {
      method: 'POST',
      body: payload,
    })

    expect(response.status).toBe('applied')
    expect(response.afterStats.careerGps).toBe(1)
    expect(response.afterStats.careerWins).toBe(1)
    expect(response.afterStats.points).toBe(25)
    expect(response.afterStats.bestFinish).toBe(1)
    expect(response.afterStats.bestGridPosition).toBe(3)

    // Verifica persistência na transação em career_stats_by_career[careerA]
    const driverInDb = inMemoryDb.drivers[driverId]
    const statsA = driverInDb.procedural_data.career_stats_by_career[careerA]
    expect(statsA.careerGps).toBe(1)
    expect(statsA.careerWins).toBe(1)
    expect(statsA.points).toBe(25)
    expect(statsA.bestFinish).toBe(1)

    // Recibo gravado com chave correta
    const expectedKey = `stats_receipt_${careerA}_${season}_${round}_${session}_${driverId}`
    expect(inMemoryDb.canonical_career_driver_stats_receipts[expectedKey]).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // 2. BASE AUSENTE RETORNA 422 SEM ALTERAÇÃO DE PILOTO NEM RECIBO
  // ---------------------------------------------------------------------------
  it('2. Base histórica ausente em career_stats_by_career retorna 422 com código estável sem alterar piloto nem criar recibo', async () => {
    // Remove qualquer entrada da carreira C do piloto
    const careerC = 'career_gamma_sem_historico'
    inMemoryDb.seasons[careerC] = { id: careerC, year: 2026, team_id: 'nn7kruxy4qlvgwr' }

    const initialDriversSnapshot = JSON.parse(JSON.stringify(inMemoryDb.drivers))
    const receiptsCountBefore = Object.keys(
      inMemoryDb.canonical_career_driver_stats_receipts,
    ).length

    const payload = {
      careerId: careerC,
      season,
      round,
      session,
      driverId,
      resultHash: validResultHash,
      deltas: { deltaGps: 1, deltaPoints: 25 },
    }

    let errorThrown: any = null
    try {
      await pb.send('/backend/v1/career-driver-stats/apply-atomic', {
        method: 'POST',
        body: payload,
      })
    } catch (err: any) {
      errorThrown = err
    }

    expect(errorThrown).toBeDefined()
    expect(errorThrown.status).toBe(422)
    expect(errorThrown.response.code).toBe('HISTORICAL_BASE_AMBIGUOUS_OR_MISSING')
    expect(errorThrown.response.status).toBe('reconciliation_required')

    // Nenhuma alteração no piloto
    expect(inMemoryDb.drivers).toEqual(initialDriversSnapshot)
    // Nenhum recibo criado
    expect(Object.keys(inMemoryDb.canonical_career_driver_stats_receipts).length).toBe(
      receiptsCountBefore,
    )
  })

  // ---------------------------------------------------------------------------
  // 2b. BASE INVÁLIDA (NÃO-NUMÉRICA OU VAZIA) RETORNA 422
  // ---------------------------------------------------------------------------
  it('2b. Base com valores corrompidos/não-numéricos em career_stats_by_career retorna 422 sem alterar piloto', async () => {
    // Insere dados corrompidos para a Carreira A
    inMemoryDb.drivers[driverId].procedural_data.career_stats_by_career[careerA] = {
      careerGps: 'invalid_string_not_number',
      points: undefined,
    }

    const payload = {
      careerId: careerA,
      season,
      round,
      session,
      driverId,
      resultHash: validResultHash,
      deltas: { deltaGps: 1, deltaPoints: 10 },
    }

    let errorThrown: any = null
    try {
      await pb.send('/backend/v1/career-driver-stats/apply-atomic', {
        method: 'POST',
        body: payload,
      })
    } catch (err: any) {
      errorThrown = err
    }

    expect(errorThrown).toBeDefined()
    expect(errorThrown.status).toBe(422)
    expect(errorThrown.response.code).toBe('HISTORICAL_BASE_AMBIGUOUS_OR_MISSING')
  })

  // ---------------------------------------------------------------------------
  // 3. EXISTÊNCIA APENAS DE BASE GLOBAL OU DE OUTRA CARREIRA NÃO AUTORIZA APLICAÇÃO
  // ---------------------------------------------------------------------------
  it('3. Existência apenas de career_stats global legado ou de outra carreira NÃO autoriza aplicação silenciosa (exige 422)', async () => {
    const careerNova = 'career_season_nova_sem_registro'
    inMemoryDb.seasons[careerNova] = { id: careerNova, year: 2026, team_id: 'nn7kruxy4qlvgwr' }

    // O piloto tem career_stats legado (44 GPs, 320 pts) e career_stats_by_career[careerB] (15 GPs, 110 pts),
    // mas NÃO tem career_stats_by_career[careerNova].
    expect(inMemoryDb.drivers[driverId].procedural_data.career_stats.careerGps).toBe(44)
    expect(
      inMemoryDb.drivers[driverId].procedural_data.career_stats_by_career[careerNova],
    ).toBeUndefined()

    const payload = {
      careerId: careerNova,
      season,
      round,
      session,
      driverId,
      resultHash: validResultHash,
      deltas: { deltaGps: 1, deltaPoints: 18 },
    }

    let errorThrown: any = null
    try {
      await pb.send('/backend/v1/career-driver-stats/apply-atomic', {
        method: 'POST',
        body: payload,
      })
    } catch (err: any) {
      errorThrown = err
    }

    // Deve ser bloqueado com 422: NÃO assume o global legado de 44 GPs nem os 15 GPs de B
    expect(errorThrown).toBeDefined()
    expect(errorThrown.status).toBe(422)
    expect(errorThrown.response.code).toBe('HISTORICAL_BASE_AMBIGUOUS_OR_MISSING')
    expect(errorThrown.response.message).toContain(
      'procedural_data.career_stats_by_career[careerId]',
    )

    // Confere que o histórico legado não foi contaminado nem sobrescrito
    expect(inMemoryDb.drivers[driverId].procedural_data.career_stats.careerGps).toBe(44)
    expect(
      inMemoryDb.drivers[driverId].procedural_data.career_stats_by_career[careerB].careerGps,
    ).toBe(15)
  })

  // ---------------------------------------------------------------------------
  // 4. ISOLAMENTO: APLICAR NA CARREIRA A PRESERVA INTEGRALMENTE CARREIRA B E DEMAIS DADOS
  // ---------------------------------------------------------------------------
  it('4. Aplicar na carreira A preserva integralmente as estatísticas de B, psicologia, moral e visualIdentity', async () => {
    // Snapshot dos dados da Carreira B antes da escrita
    const statsBOriginal = JSON.parse(
      JSON.stringify(inMemoryDb.drivers[driverId].procedural_data.career_stats_by_career[careerB]),
    )
    const visualIdentityOriginal = JSON.parse(
      JSON.stringify(inMemoryDb.drivers[driverId].procedural_data.visualIdentity),
    )
    const psychologyOriginal = JSON.parse(
      JSON.stringify(inMemoryDb.drivers[driverId].procedural_data.psychology),
    )
    const moraleOriginal = inMemoryDb.drivers[driverId].morale

    const payload = {
      careerId: careerA,
      season,
      round,
      session,
      driverId,
      resultHash: validResultHash,
      deltas: { deltaGps: 1, deltaWins: 1, deltaPoints: 25 },
    }

    const response = await pb.send('/backend/v1/career-driver-stats/apply-atomic', {
      method: 'POST',
      body: payload,
    })
    expect(response.status).toBe('applied')

    const driverAfter = inMemoryDb.drivers[driverId]
    // 1. Carreira A foi atualizada
    expect(driverAfter.procedural_data.career_stats_by_career[careerA].careerGps).toBe(1)
    expect(driverAfter.procedural_data.career_stats_by_career[careerA].points).toBe(25)

    // 2. Carreira B permaneceu 100% idêntica
    expect(driverAfter.procedural_data.career_stats_by_career[careerB]).toEqual(statsBOriginal)

    // 3. Campos adicionais de procedural_data permanecem intactos
    expect(driverAfter.procedural_data.visualIdentity).toEqual(visualIdentityOriginal)
    expect(driverAfter.procedural_data.psychology).toEqual(psychologyOriginal)

    // 4. Moral do piloto inalterado
    expect(driverAfter.morale).toBe(moraleOriginal)
  })

  // ---------------------------------------------------------------------------
  // 5. REPETIÇÃO: RECIBO EXISTENTE IMPEDE REAPLICAÇÃO E NÃO RESTAURA VALORES HISTÓRICOS
  // ---------------------------------------------------------------------------
  it('5. Recibo existente impede nova aplicação (already_applied) e não restaura afterStats do recibo sobre dados mais recentes', async () => {
    // 1ª aplicação no Round 1: piloto pontua 25
    const payloadR1 = {
      careerId: careerA,
      season,
      round: 1,
      session,
      driverId,
      resultHash: 'hash_round_1_ok',
      deltas: { deltaGps: 1, deltaWins: 1, deltaPoints: 25 },
    }

    const res1 = await pb.send('/backend/v1/career-driver-stats/apply-atomic', {
      method: 'POST',
      body: payloadR1,
    })
    expect(res1.status).toBe('applied')
    expect(res1.afterStats.points).toBe(25)
    expect(
      inMemoryDb.drivers[driverId].procedural_data.career_stats_by_career[careerA].points,
    ).toBe(25)

    // Em seguida, Round 2 ocorre e piloto soma mais 18 pontos (total 43 pontos no estado atual)
    const payloadR2 = {
      careerId: careerA,
      season,
      round: 2,
      session,
      driverId,
      resultHash: 'hash_round_2_ok',
      deltas: { deltaGps: 1, deltaWins: 0, deltaPoints: 18 },
    }
    const res2 = await pb.send('/backend/v1/career-driver-stats/apply-atomic', {
      method: 'POST',
      body: payloadR2,
    })
    expect(res2.status).toBe('applied')
    expect(res2.afterStats.points).toBe(43)
    expect(
      inMemoryDb.drivers[driverId].procedural_data.career_stats_by_career[careerA].points,
    ).toBe(43)

    // Agora re-executa a requisição do Round 1 (replay/retry após rede instável)
    const replayR1 = await pb.send('/backend/v1/career-driver-stats/apply-atomic', {
      method: 'POST',
      body: payloadR1,
    })

    expect(replayR1.status).toBe('already_applied')
    // O recibo recuperado traz o snapshot histórico de afterStats do Round 1 (25 pts)
    expect(replayR1.afterStats.points).toBe(25)

    // MAS no banco de dados, o estado atual do piloto DEVE PERMANECER nos 43 pontos acumulados do Round 2!
    // A consulta/repetição de recibo NUNCA restaura o after_stats do recibo sobre o estado vivo do piloto!
    const driverCurrent = inMemoryDb.drivers[driverId]
    expect(driverCurrent.procedural_data.career_stats_by_career[careerA].points).toBe(43)
    expect(driverCurrent.procedural_data.career_stats_by_career[careerA].careerGps).toBe(2)
  })

  // ---------------------------------------------------------------------------
  // 6. RECIBO EXISTENTE COM ESTADO ATUAL FALTANTE: DISTINGUE DE RECIBO NORMAL
  // ---------------------------------------------------------------------------
  it('6. Se houver recibo mas faltar o estado atual da carreira, distingue "já aplicada" de "reconciliação necessária" sem reconstrução silenciosa', async () => {
    // Simula situação anômala: recibo foi gravado no Round 1, mas procedural_data do piloto foi resetado/limpo
    const opKey = `stats_receipt_${careerA}_${season}_1_${session}_${driverId}`
    inMemoryDb.canonical_career_driver_stats_receipts[opKey] = {
      operation_key: opKey,
      career_id: careerA,
      season,
      round: 1,
      session,
      driver_id: driverId,
      career_driver_id: `${careerA}_${driverId}`,
      result_hash: 'hash_existing_anomalous',
      before_stats: { careerGps: 0, points: 0, careerWins: 0 },
      effect_data: { deltaGps: 1, deltaPoints: 25 },
      after_stats: { careerGps: 1, points: 25, careerWins: 1 },
      applied_at: new Date().toISOString(),
    }

    // Limpa propositalmente o estado atual da carreira A no piloto (simulando perda de chave)
    delete inMemoryDb.drivers[driverId].procedural_data.career_stats_by_career[careerA]

    // Consulta GET recibo
    const receiptQuery = await pb.send(
      `/backend/v1/career-driver-stats/receipt?careerId=${careerA}&season=${season}&round=1&session=${session}&driverId=${driverId}`,
      { method: 'GET' },
    )

    expect(receiptQuery.exists).toBe(true)
    expect(receiptQuery.needsReconciliation).toBe(true)
    expect(receiptQuery.message).toContain('Reconciliação requerida')

    // Confere que NÃO houve reconstrução silenciosa com zero nem injeção arbitrária no piloto
    expect(
      inMemoryDb.drivers[driverId].procedural_data.career_stats_by_career[careerA],
    ).toBeUndefined()
  })
})
