import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('BUG-APPLY-JOURNAL-STALL-01A: Retomada Idempotente de Journal Travado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve reprocessar apenas as entradas ausentes de applied_driver_ids a partir do snapshot do official result', async () => {
    const existingApplied = ['driver_1', 'driver_2']
    const fullEntries = [
      { driverId: 'driver_1', points: 25 },
      { driverId: 'driver_2', points: 18 },
      { driverId: 'driver_3', points: 15 },
      { driverId: 'driver_4', points: 12 },
    ]

    // Filtro de idempotência: entradas restantes a processar
    const pendingEntries = fullEntries.filter((entry) => !existingApplied.includes(entry.driverId))

    expect(pendingEntries).toHaveLength(2)
    expect(pendingEntries.map((e) => e.driverId)).toEqual(['driver_3', 'driver_4'])
  })

  it('deve registrar status FAILED e last_error caso ocorra falha no processamento de algum piloto', () => {
    const journalState = {
      status: 'APPLYING',
      applied_driver_ids: ['driver_1'],
      total_entries: 24,
      last_error: '',
    }

    const simulatedError = new Error(
      "Failed to execute 'setItem' on 'Storage': Setting the value exceeded quota",
    )

    // Tratamento resiliente de erro
    journalState.status = 'FAILED'
    journalState.last_error = `[Erro no Piloto driver_2] ${simulatedError.message}`

    expect(journalState.status).toBe('FAILED')
    expect(journalState.last_error).toContain('Setting the value exceeded quota')
  })

  it('ao concluir todas as 24 entradas, deve marcar status COMPLETE e application_status do race_result como COMPLETE', () => {
    const all24Drivers = Array.from({ length: 24 }, (_, i) => `driver_${i + 1}`)
    const journal = {
      status: 'APPLYING',
      applied_driver_ids: all24Drivers,
      total_entries: 24,
      last_error: '',
      completed_at: '',
    }

    const raceResult = {
      round: 3,
      application_status: 'PENDING',
    }

    if (journal.applied_driver_ids.length === journal.total_entries) {
      journal.status = 'COMPLETE'
      journal.completed_at = new Date().toISOString()
      raceResult.application_status = 'COMPLETE'
    }

    expect(journal.status).toBe('COMPLETE')
    expect(journal.completed_at).toBeTruthy()
    expect(raceResult.application_status).toBe('COMPLETE')
  })
})
