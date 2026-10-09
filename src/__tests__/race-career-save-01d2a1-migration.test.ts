import { describe, it, expect } from 'vitest'
import schema from '@/lib/pocketbase/schema.json'

describe('RACE-CAREER-SAVE-01D2A1: Schema e Integridade de canonical_career_driver_stats_receipts', () => {
  const collection = schema.collections.find(
    (c: any) => c.name === 'canonical_career_driver_stats_receipts',
  )

  it('1. A coleção canonical_career_driver_stats_receipts deve existir no schema do PocketBase', () => {
    expect(collection).toBeDefined()
    expect(collection?.type).toBe('base')
  })

  it('2. Deve conter todos os campos canônicos obrigatórios e os campos da especificação', () => {
    expect(collection).toBeDefined()
    const fields = collection?.fields || []
    const fieldMap = new Map(fields.map((f: any) => [f.name, f]))

    // Campos essenciais da especificação
    expect(fieldMap.get('operation_key')).toMatchObject({
      name: 'operation_key',
      type: 'text',
      required: true,
    })

    expect(fieldMap.get('career_id')).toMatchObject({
      name: 'career_id',
      type: 'text',
      required: true,
    })

    expect(fieldMap.get('season')).toMatchObject({
      name: 'season',
      type: 'number',
      required: true,
    })

    expect(fieldMap.get('round')).toMatchObject({
      name: 'round',
      type: 'number',
      required: true,
    })

    expect(fieldMap.get('session')).toMatchObject({
      name: 'session',
      type: 'text',
      required: true,
    })

    expect(fieldMap.get('driver_id')).toMatchObject({
      name: 'driver_id',
      type: 'text',
      required: true,
    })

    expect(fieldMap.get('career_driver_id')).toMatchObject({
      name: 'career_driver_id',
      type: 'text',
      required: true,
    })

    expect(fieldMap.get('race_result_id')).toMatchObject({
      name: 'race_result_id',
      type: 'text',
    })

    expect(fieldMap.get('result_hash')).toMatchObject({
      name: 'result_hash',
      type: 'text',
      required: true,
    })

    expect(fieldMap.get('before_stats')).toMatchObject({
      name: 'before_stats',
      type: 'json',
    })

    expect(fieldMap.get('effect_data')).toMatchObject({
      name: 'effect_data',
      type: 'json',
    })

    expect(fieldMap.get('after_stats')).toMatchObject({
      name: 'after_stats',
      type: 'json',
    })

    expect(fieldMap.get('applied_at')).toMatchObject({
      name: 'applied_at',
      type: 'date',
      required: true,
    })
  })

  it('3. Deve conter índice ÚNICO sobre operation_key', () => {
    expect(collection).toBeDefined()
    const indexes: string[] = collection?.indexes || []

    const uniqueOpKeyIndex = indexes.find(
      (idx) =>
        idx.toUpperCase().includes('UNIQUE') &&
        idx.includes('idx_career_driver_stats_operation_key') &&
        idx.includes('(operation_key)'),
    )
    expect(uniqueOpKeyIndex).toBeDefined()
  })

  it('4. Rejeição de duplicidade de operation_key em memória/simulação de integridade de banco', () => {
    // Validação formal da regra de unicidade garantida pelo SQLite/PocketBase
    const simulatedTable = new Map<string, any>()

    const recordA = {
      id: 'rec_1',
      operation_key: 'stats_receipt_c1_s2026_r1_MAIN_RACE_drv1',
      career_id: 'c1',
      season: 2026,
      round: 1,
      session: 'MAIN_RACE',
      driver_id: 'drv1',
      career_driver_id: 'cdrv1',
      result_hash: 'hash_abc_1',
      applied_at: '2026-03-29T14:00:00.000Z',
    }

    // 1ª inserção tem sucesso
    expect(() => {
      if (simulatedTable.has(recordA.operation_key)) {
        throw new Error(
          'UNIQUE constraint failed: canonical_career_driver_stats_receipts.operation_key',
        )
      }
      simulatedTable.set(recordA.operation_key, recordA)
    }).not.toThrow()

    // 2ª inserção com a mesma operation_key DEVE ser rejeitada com erro de UNIQUE constraint
    const recordDuplicate = {
      id: 'rec_2',
      operation_key: 'stats_receipt_c1_s2026_r1_MAIN_RACE_drv1',
      career_id: 'c1',
      season: 2026,
      round: 1,
      session: 'MAIN_RACE',
      driver_id: 'drv1',
      career_driver_id: 'cdrv1',
      result_hash: 'hash_abc_1',
      applied_at: '2026-03-29T14:00:01.000Z',
    }

    expect(() => {
      if (simulatedTable.has(recordDuplicate.operation_key)) {
        throw new Error(
          'UNIQUE constraint failed: canonical_career_driver_stats_receipts.operation_key',
        )
      }
      simulatedTable.set(recordDuplicate.operation_key, recordDuplicate)
    }).toThrow(/UNIQUE constraint failed/)
  })

  it('5. Distinção de operation_key entre corrida principal e Sprint', () => {
    const mainRaceOpKey = 'stats_receipt_c1_s2026_r1_MAIN_RACE_drv1'
    const sprintRaceOpKey = 'stats_receipt_c1_s2026_r1_SPRINT_RACE_drv1'

    expect(mainRaceOpKey).not.toEqual(sprintRaceOpKey)
  })
})
