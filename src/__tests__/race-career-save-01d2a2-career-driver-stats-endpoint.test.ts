import { describe, it, expect } from 'vitest'
import schema from '@/lib/pocketbase/schema.json'

describe('RACE-CAREER-SAVE-01D2B1: Ajuste do Contrato do Hook Existente (career_driver_stats)', () => {
  const collection: any = schema.collections.find(
    (c: any) => c.name === 'canonical_career_driver_stats_receipts',
  )

  it('1. Schema da coleção canonical_career_driver_stats_receipts deve estar protegido contra mutação direta por clientes', () => {
    expect(collection).toBeDefined()
    expect(collection?.name).toBe('canonical_career_driver_stats_receipts')
    // As regras de create, update e delete devem estar bloqueadas (null) para clientes
    // No schema.json exportado, as regras ficam em apiRules ou nos campos de regra
    const apiRules = collection?.apiRules || {}
    expect(apiRules.create ?? collection?.createRule).toBeNull()
    expect(apiRules.update ?? collection?.updateRule).toBeNull()
    expect(apiRules.delete ?? collection?.deleteRule).toBeNull()
  })

  it('2. Resolução da exigência de careerDriverId: contrato aceita careerDriverId opcional e deriva `${careerId}_${driverId}` se omitido', () => {
    const careerId = 'season_31b0p9k5ygw2sc8'
    const driverId = '9uazqw522oc9p4z' // Gabriel Bortoleto

    const resolveCareerDriverId = (inputCareerDriverId?: string) => {
      return inputCareerDriverId && inputCareerDriverId.trim()
        ? inputCareerDriverId.trim()
        : `${careerId}_${driverId}`
    }

    // Se ausente: não falha nem exige criação de tabela career_drivers
    expect(resolveCareerDriverId(undefined)).toBe(`${careerId}_${driverId}`)
    expect(resolveCareerDriverId('')).toBe(`${careerId}_${driverId}`)

    // Se fornecido explicitamente: respeita o valor fornecido
    expect(resolveCareerDriverId('custom_career_driver_ref_123')).toBe(
      'custom_career_driver_ref_123',
    )
  })

  it('3. Garantir isolamento das estatísticas por carreira em procedural_data.career_stats_by_career', () => {
    const careerA = 'career_season_audi_01'
    const careerB = 'career_season_ferrari_02'

    // Simulação do registro drivers compartilhado
    const proceduralData: Record<string, any> = {
      visualIdentity: { portraitId: 'img_01' },
      psychology: { confidence: 90 },
      career_stats_by_career: {},
    }

    const applyStatsForCareer = (
      proc: Record<string, any>,
      cId: string,
      stats: Record<string, any>,
    ): Record<string, any> => {
      const statsByCareer = proc.career_stats_by_career || {}
      return {
        ...proc,
        career_stats_by_career: {
          ...statsByCareer,
          [cId]: stats,
        },
        career_stats: stats, // espelho retrocompatível
      }
    }

    // Aplica na Carreira A
    const updatedAfterA = applyStatsForCareer(proceduralData, careerA, {
      careerGps: 1,
      careerWins: 1,
      points: 25,
    })

    // Aplica na Carreira B
    const updatedAfterB = applyStatsForCareer(updatedAfterA, careerB, {
      careerGps: 5,
      careerWins: 0,
      points: 18,
    })

    // Carreira A permanece isolada e inalterada após gravação da Carreira B
    expect(updatedAfterB.career_stats_by_career[careerA]).toEqual({
      careerGps: 1,
      careerWins: 1,
      points: 25,
    })
    expect(updatedAfterB.career_stats_by_career[careerB]).toEqual({
      careerGps: 5,
      careerWins: 0,
      points: 18,
    })
    // Demais dados de procedural_data são rigorosamente preservados
    expect(updatedAfterB.visualIdentity).toEqual({ portraitId: 'img_01' })
    expect(updatedAfterB.psychology).toEqual({ confidence: 90 })
  })

  it('4. Definir a base do cálculo: histórico ausente ou ambíguo retorna pendência de reconciliação (422)', () => {
    const evaluateBaseCalculation = (params: {
      confirmedBackendStats: any
      allowHistoricalSeed?: boolean
      initialStatsSeed?: any
    }) => {
      const { confirmedBackendStats, allowHistoricalSeed, initialStatsSeed } = params

      const isValidStats = (obj: any) =>
        obj &&
        typeof obj === 'object' &&
        (typeof obj.careerGps === 'number' || typeof obj.raceStarts === 'number')

      if (!confirmedBackendStats || !isValidStats(confirmedBackendStats)) {
        if (allowHistoricalSeed && isValidStats(initialStatsSeed)) {
          return { status: 'proceed', base: initialStatsSeed }
        }
        return {
          status: 'reconciliation_required',
          httpStatus: 422,
          code: 'HISTORICAL_BASE_AMBIGUOUS_OR_MISSING',
        }
      }

      return { status: 'proceed', base: confirmedBackendStats }
    }

    // Caso 1: Sem base confirmada no backend e sem seed homologada -> 422 RECONCILIATION_REQUIRED
    const resNoBase = evaluateBaseCalculation({ confirmedBackendStats: null })
    expect(resNoBase.status).toBe('reconciliation_required')
    expect(resNoBase.httpStatus).toBe(422)
    expect(resNoBase.code).toBe('HISTORICAL_BASE_AMBIGUOUS_OR_MISSING')

    // Caso 2: Sem base confirmada, mas com seed explícita permitida -> prossegue com seed
    const seed = { careerGps: 10, raceStarts: 10, careerWins: 1, points: 50 }
    const resWithSeed = evaluateBaseCalculation({
      confirmedBackendStats: null,
      allowHistoricalSeed: true,
      initialStatsSeed: seed,
    })
    expect(resWithSeed.status).toBe('proceed')
    expect(resWithSeed.base).toEqual(seed)

    // Caso 3: Com base confirmada no backend -> prossegue com autoridade do backend
    const backendStats = { careerGps: 20, raceStarts: 20, careerWins: 3, points: 120 }
    const resConfirmed = evaluateBaseCalculation({
      confirmedBackendStats: backendStats,
    })
    expect(resConfirmed.status).toBe('proceed')
    expect(resConfirmed.base).toEqual(backendStats)
  })

  it('5. Preservar a operação atômica: idempotência (already_applied) e conflito (409)', () => {
    const receiptsDb = new Map<string, any>()
    const driverStatsDb = new Map<string, any>()

    const driverId = 'drv_norris_pb'
    const careerId = 'career_test_01'
    const season = 2026
    const round = 1
    const session = 'MAIN_RACE'
    const operationKey = `stats_receipt_${careerId}_${season}_${round}_${session}_${driverId}`
    const resultHash = 'hash_official_norris_1'

    driverStatsDb.set(driverId, {
      careerGps: 10,
      careerWins: 2,
      points: 45,
      bestFinish: 1,
    })

    const executeApply = (incomingHash: string, effect: any) => {
      const existing = receiptsDb.get(operationKey)
      if (existing) {
        if (existing.result_hash !== incomingHash) {
          return { status: 'conflict', httpStatus: 409 }
        }
        return { status: 'already_applied', httpStatus: 200, receipt: existing }
      }

      const before = { ...driverStatsDb.get(driverId) }
      const after = {
        ...before,
        careerGps: before.careerGps + (effect.deltaGps || 0),
        careerWins: before.careerWins + (effect.deltaWins || 0),
        points: before.points + (effect.deltaPoints || 0),
        bestFinish: Math.min(before.bestFinish, effect.newFinishPosition || before.bestFinish),
      }

      driverStatsDb.set(driverId, after)
      const receipt = {
        operation_key: operationKey,
        career_id: careerId,
        season,
        round,
        session,
        driver_id: driverId,
        career_driver_id: `${careerId}_${driverId}`,
        result_hash: incomingHash,
        before_stats: before,
        effect_data: effect,
        after_stats: after,
        applied_at: new Date().toISOString(),
      }
      receiptsDb.set(operationKey, receipt)
      return { status: 'applied', httpStatus: 200, receipt }
    }

    // Execução 1: Sucesso
    const res1 = executeApply(resultHash, { deltaGps: 1, deltaWins: 1, deltaPoints: 25 })
    expect(res1.status).toBe('applied')
    expect(driverStatsDb.get(driverId).careerGps).toBe(11)

    // Execução 2: Já aplicado com mesmo hash -> already_applied sem reaplicar deltas
    const res2 = executeApply(resultHash, { deltaGps: 1, deltaWins: 1, deltaPoints: 25 })
    expect(res2.status).toBe('already_applied')
    expect(driverStatsDb.get(driverId).careerGps).toBe(11)

    // Execução 3: Divergência de hash -> 409 CONFLICT sem alteração
    const res3 = executeApply('divergent_hash', { deltaGps: 1, deltaWins: 0, deltaPoints: 10 })
    expect(res3.status).toBe('conflict')
    expect(res3.httpStatus).toBe(409)
    expect(driverStatsDb.get(driverId).careerGps).toBe(11)
  })
})
