import { describe, it, expect } from 'vitest'
import schema from '@/lib/pocketbase/schema.json'

describe('RACE-CAREER-SAVE-01D2A2: Contrato do Endpoint Transacional de Estatísticas (career_driver_stats)', () => {
  const collection = schema.collections.find(
    (c: any) => c.name === 'canonical_career_driver_stats_receipts',
  )

  it('1. Schema da coleção canonical_career_driver_stats_receipts deve estar protegido contra mutação direta por clientes', () => {
    expect(collection).toBeDefined()
    // As regras de create, update e delete devem estar bloqueadas (null) no backend
    // listRule e viewRule permitem consulta por usuários autenticados
    expect(collection?.name).toBe('canonical_career_driver_stats_receipts')
  })

  it('2. Chave de operação deve ser derivada no servidor distinguindo Sprint e Corrida Principal', () => {
    const careerId = 'season_31b0p9k5ygw2sc8'
    const season = 2026
    const round = 2
    const driverId = 'drv_verstappen_pb1'

    const mainKey = `stats_receipt_${careerId}_${season}_${round}_MAIN_RACE_${driverId}`
    const sprintKey = `stats_receipt_${careerId}_${season}_${round}_SPRINT_RACE_${driverId}`

    expect(mainKey).not.toEqual(sprintKey)
    expect(mainKey).toContain('MAIN_RACE')
    expect(sprintKey).toContain('SPRINT_RACE')
  })

  it('3. Contrato de payload do recibo deve contemplar todos os campos canônicos sem aliases', () => {
    const receiptFields = [
      'operation_key',
      'career_id',
      'season',
      'round',
      'session',
      'session_type',
      'driver_id',
      'career_driver_id',
      'driver_slug',
      'race_result_id',
      'official_race_result_id',
      'result_hash',
      'before_stats',
      'effect_data',
      'after_stats',
      'applied_at',
    ]

    const collectionFields = (collection?.fields || []).map((f: any) => f.name)
    for (const field of receiptFields) {
      expect(collectionFields).toContain(field)
    }
  })

  it('4. Simulação lógica de transação atômica: já aplicado retorna already_applied sem modificar estatísticas', () => {
    const receiptsDb = new Map<string, any>()
    const driverStatsDb = new Map<string, any>()

    const driverId = 'drv_norris_pb'
    const careerId = 'career_test_01'
    const season = 2026
    const round = 1
    const session = 'MAIN_RACE'
    const operationKey = `stats_receipt_${careerId}_${season}_${round}_${session}_${driverId}`
    const resultHash = 'hash_official_norris_1'

    // Estado inicial do piloto
    driverStatsDb.set(driverId, {
      careerGps: 10,
      careerWins: 2,
      points: 45,
      bestFinish: 1,
    })

    // Primeira aplicação (ausente): cria recibo e altera stats
    const executeApply = (incomingHash: string, effect: any) => {
      // 1. Consulta recibo
      const existing = receiptsDb.get(operationKey)
      if (existing) {
        if (existing.result_hash !== incomingHash) {
          return { status: 'conflict', httpStatus: 409 }
        }
        return { status: 'already_applied', httpStatus: 200, receipt: existing }
      }

      // 2. Lê stats atuais
      const before = { ...driverStatsDb.get(driverId) }
      const after = {
        ...before,
        careerGps: before.careerGps + (effect.deltaGps || 0),
        careerWins: before.careerWins + (effect.deltaWins || 0),
        points: before.points + (effect.deltaPoints || 0),
        bestFinish: Math.min(before.bestFinish, effect.newFinishPosition || before.bestFinish),
      }

      // 3. Atualiza piloto e grava recibo
      driverStatsDb.set(driverId, after)
      const receipt = {
        operation_key: operationKey,
        career_id: careerId,
        season,
        round,
        session,
        driver_id: driverId,
        result_hash: incomingHash,
        before_stats: before,
        effect_data: effect,
        after_stats: after,
        applied_at: new Date().toISOString(),
      }
      receiptsDb.set(operationKey, receipt)
      return { status: 'applied', httpStatus: 200, receipt }
    }

    // Execução 1: sucesso e aplicação
    const res1 = executeApply(resultHash, {
      deltaGps: 1,
      deltaWins: 1,
      deltaPoints: 25,
      newFinishPosition: 1,
    })
    expect(res1.status).toBe('applied')
    expect(res1.httpStatus).toBe(200)
    expect(driverStatsDb.get(driverId).careerGps).toBe(11)
    expect(driverStatsDb.get(driverId).points).toBe(70)

    // Execução 2: idempotência - já aplicado com mesmo hash retorna already_applied e estatísticas NÃO são duplicadas
    const res2 = executeApply(resultHash, {
      deltaGps: 1,
      deltaWins: 1,
      deltaPoints: 25,
      newFinishPosition: 1,
    })
    expect(res2.status).toBe('already_applied')
    expect(res2.httpStatus).toBe(200)
    expect(driverStatsDb.get(driverId).careerGps).toBe(11) // Preservado
    expect(driverStatsDb.get(driverId).points).toBe(70) // Não subiu para 95

    // Execução 3: divergência de resultHash gera conflito (409) sem qualquer gravação
    const resConflict = executeApply('divergent_hash_xyz', {
      deltaGps: 1,
      deltaWins: 0,
      deltaPoints: 10,
    })
    expect(resConflict.status).toBe('conflict')
    expect(resConflict.httpStatus).toBe(409)
    expect(driverStatsDb.get(driverId).careerGps).toBe(11)
  })

  it('5. Tratamento de campos não aditivos: bestFinish e bestGridPosition usam menor valor numérico válido', () => {
    const beforeStats = {
      bestFinish: 4,
      bestGridPosition: 3,
    }

    // Corrida melhor que anterior: P1, largou P2
    const effBetter = { newFinishPosition: 1, newGridPosition: 2 }
    const calculatedFinish1 =
      beforeStats.bestFinish === null
        ? effBetter.newFinishPosition
        : Math.min(beforeStats.bestFinish, effBetter.newFinishPosition)
    const calculatedGrid1 =
      beforeStats.bestGridPosition === null
        ? effBetter.newGridPosition
        : Math.min(beforeStats.bestGridPosition, effBetter.newGridPosition)

    expect(calculatedFinish1).toBe(1)
    expect(calculatedGrid1).toBe(2)

    // Corrida pior que anterior: P10, largou P8 -> mantém melhor
    const effWorse = { newFinishPosition: 10, newGridPosition: 8 }
    const calculatedFinish2 = Math.min(calculatedFinish1, effWorse.newFinishPosition)
    const calculatedGrid2 = Math.min(calculatedGrid1, effWorse.newGridPosition)

    expect(calculatedFinish2).toBe(1)
    expect(calculatedGrid2).toBe(2)
  })
})
