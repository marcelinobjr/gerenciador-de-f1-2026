/**
 * race-career-save-01c2b-async-checkpoints.test.ts
 *
 * Microbloco RACE-CAREER-SAVE-01C2B:
 * Checkpoints remotos aguardados no loop assíncrono de aplicação na carreira.
 *
 * TESTES FOCAIS (DADOS ISOLADOS):
 * 1. Checkpoint inicial rejeitado: nenhum efeito executado.
 * 2. Checkpoint de um piloto pendente / rejeitado: o próximo piloto não começa.
 * 3. Efeito concluído e checkpoint rejeitado: execução interrompida, sem COMPLETE e sem replay automático.
 * 4. LocalStorage indisponível: checkpoints continuam funcionando pelo backend.
 * 5. Confirmação final pendente ou rejeitada: aplicação não retorna sucesso.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  canonicalCareerPersistenceService,
  type CareerApplicationJournal,
} from '@/services/canonicalCareerPersistenceService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { driverBase2026Service } from '@/services/driverBase2026Service'
import { driverMoraleService } from '@/services/driverMoraleService'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'
import pb from '@/lib/pocketbase/client'

describe('RACE-CAREER-SAVE-01C2B — Checkpoints Remotos Aguardados no Loop', () => {
  const careerId = 'career_test_01c2b_isolated'
  const season = 2026
  const round = 1
  const raceVariant = 'MAIN_RACE'
  const journalKey = `career_apply_result_${careerId}_s2026_1_main`

  const mockOfficialResult: OfficialRaceResult = {
    schemaVersion: 'official-race-result-v1',
    officialResultId: `orr_${careerId}_s${season}_r${round}_991122`,
    raceVariant: 'MAIN_RACE',
    careerId,
    season,
    round,
    raceId: 'race_test_01c2b',
    circuitId: 'albert_park',
    circuitName: 'Albert Park Circuit',
    circuitCountry: 'Austrália',
    playerTeamId: 'team_audi_01c2b',
    officializedAt: '2026-03-15T06:00:00.000Z',
    totalLaps: 58,
    winnerDriverId: 'driver_piastri',
    winnerTeamId: 'team_mclaren',
    poleDriverId: 'driver_piastri',
    fastestLapDriverId: 'driver_piastri',
    podium: ['driver_piastri', 'driver_norris', 'driver_leclerc'],
    entries: [
      {
        driverId: 'driver_piastri',
        teamId: 'team_mclaren',
        driverName: 'Oscar Piastri',
        teamName: 'McLaren F1 Team',
        teamColor: '#FF8000',
        isPlayer: false,
        gridPosition: 1,
        finalPosition: 1,
        positionsGainedLost: 0,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 25,
      } as any,
      {
        driverId: 'driver_norris',
        teamId: 'team_mclaren',
        driverName: 'Lando Norris',
        teamName: 'McLaren F1 Team',
        teamColor: '#FF8000',
        isPlayer: false,
        gridPosition: 2,
        finalPosition: 2,
        positionsGainedLost: 0,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 18,
      } as any,
      {
        driverId: 'driver_leclerc',
        teamId: 'team_ferrari',
        driverName: 'Charles Leclerc',
        teamName: 'Ferrari',
        teamColor: '#E8002D',
        isPlayer: false,
        gridPosition: 3,
        finalPosition: 3,
        positionsGainedLost: 0,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 15,
      } as any,
    ],
    playerEntries: [] as any,
    eventsSummary: {
      safetyCarPeriods: 0,
      safetyCarLaps: 0,
      vscPeriods: 0,
      vscLaps: 0,
      redFlagPeriods: 0,
      dnfCount: 0,
      totalPitStops: 1,
      significantIncidents: [],
    },
    resultHash: 'sha256-mock-hash-01c2b',
  }

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(canonicalRaceResultService, 'verifyResultIntegrity').mockReturnValue(true)
    vi.spyOn(canonicalRaceResultService, 'saveOfficialRaceResultToBackend').mockResolvedValue({
      success: true,
      recordId: 'rec_official_race_res_pb',
    })
  })

  it('1. Checkpoint inicial rejeitado: nenhum efeito executado', async () => {
    const updateStatsSpy = vi.spyOn(driverBase2026Service, 'updateCareerDriverStats')
    const markMoraleSpy = vi.spyOn(driverMoraleService, 'markMoraleProcessed')

    // Mock pb.collection para simular falha no checkpoint inicial (saveApplicationJournalToBackend com status APPLYING)
    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_career_apply_journals') {
        return {
          getFullList: vi.fn().mockResolvedValue([]),
          getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }),
          create: vi
            .fn()
            .mockRejectedValue(new Error('Backend write failed: 503 Service Unavailable')),
        } as any
      }
      return {} as any
    })

    const res = await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
      mockOfficialResult,
      { requireBackendSync: true },
    )

    // A gravação do checkpoint inicial falhou
    expect(res.success).toBe(false)
    expect(res.error).toContain('Checkpoint Inicial Falhou')
    expect(res.journal.status).toBe('FAILED')

    // NENHUM efeito de piloto (stats ou moral) deve ter sido executado!
    expect(updateStatsSpy).not.toHaveBeenCalled()
    expect(markMoraleSpy).not.toHaveBeenCalled()
  })

  it('2. Checkpoint de um piloto rejeitado: o próximo piloto não começa', async () => {
    const processedDriverOrder: string[] = []

    vi.spyOn(driverBase2026Service, 'updateCareerDriverStats').mockImplementation((params) => {
      processedDriverOrder.push(params.driverId)
      return {} as any
    })

    let journalCreateCount = 0
    let existingRecordId: string | null = null

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_career_apply_journals') {
        return {
          getFullList: vi.fn().mockResolvedValue([]),
          getFirstListItem: vi.fn().mockImplementation(() => {
            if (existingRecordId) {
              return Promise.resolve({ id: existingRecordId, version: 1 })
            }
            return Promise.reject({ status: 404 })
          }),
          create: vi.fn().mockImplementation((payload) => {
            journalCreateCount++
            // Checkpoint inicial tem sucesso
            existingRecordId = 'rec_journal_01c2b'
            return Promise.resolve({ id: existingRecordId, ...payload })
          }),
          update: vi.fn().mockImplementation((id, payload) => {
            // Primeiro piloto (driver_piastri) tenta atualizar o journal remoto
            // Simular rejeição/falha no checkpoint do primeiro piloto!
            throw new Error('Falha de rede ao salvar checkpoint de driver_piastri')
          }),
        } as any
      }
      return {} as any
    })

    const res = await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
      mockOfficialResult,
      { requireBackendSync: true },
    )

    expect(res.success).toBe(false)
    expect(res.error).toContain('Checkpoint Piloto Falhou: driver_piastri')
    expect(res.journal.status).toBe('FAILED')

    // O primeiro piloto recebeu os efeitos locais, mas o checkpoint falhou -> o próximo piloto NÃO começou!
    expect(processedDriverOrder).toEqual(['driver_piastri'])
    expect(processedDriverOrder).not.toContain('driver_norris')
    expect(processedDriverOrder).not.toContain('driver_leclerc')
  })

  it('3. Efeito concluído e checkpoint rejeitado: execução interrompida, sem COMPLETE e sem replay automático', async () => {
    let checkpointAttempts = 0

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_career_apply_journals') {
        let currentRecord: any = null
        return {
          getFullList: vi.fn().mockResolvedValue([]),
          getFirstListItem: vi.fn().mockImplementation(() => {
            if (currentRecord) return Promise.resolve(currentRecord)
            return Promise.reject({ status: 404 })
          }),
          create: vi.fn().mockImplementation((payload) => {
            currentRecord = { id: 'rec_journal_1', ...payload }
            return Promise.resolve(currentRecord)
          }),
          update: vi.fn().mockImplementation((id, payload) => {
            checkpointAttempts++
            // O primeiro piloto passa (checkpoint 1)
            if (checkpointAttempts === 1) {
              currentRecord = { ...currentRecord, ...payload }
              return Promise.resolve(currentRecord)
            }
            // O segundo piloto (driver_norris) falha no checkpoint remoto (checkpoint 2)
            throw new Error('500 Internal Server Error no checkpoint remoto')
          }),
        } as any
      }
      return {} as any
    })

    const res = await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
      mockOfficialResult,
      { requireBackendSync: true },
    )

    // Interrupção sem COMPLETE
    expect(res.success).toBe(false)
    expect(res.journal.status).toBe('FAILED')
    expect(res.journal.status).not.toBe('COMPLETE')
    expect(res.error).toContain('Checkpoint Piloto Falhou: driver_norris')

    // Preservação do progresso confirmado (driver_piastri confirmado, driver_norris processado no momento da falha)
    expect(res.journal.appliedDriverIds).toContain('driver_piastri')

    // Não há retry/replay automático silencioso dentro da mesma chamada
    expect(checkpointAttempts).toBe(2)
  })

  it('4. LocalStorage indisponível: checkpoints continuam funcionando pelo backend', async () => {
    // Desabilitar completamente o localStorage
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('SecurityError: localStorage is disabled', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError: localStorage is disabled', 'SecurityError')
    })

    const remoteCheckpoints: any[] = []
    let currentJournalRec: any = null

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_career_apply_journals') {
        return {
          getFullList: vi.fn().mockResolvedValue([]),
          getFirstListItem: vi.fn().mockImplementation(() => {
            if (currentJournalRec) return Promise.resolve(currentJournalRec)
            return Promise.reject({ status: 404 })
          }),
          create: vi.fn().mockImplementation((payload) => {
            currentJournalRec = { id: 'rec_pb_journal_storage_offline', ...payload }
            remoteCheckpoints.push(JSON.parse(JSON.stringify(payload)))
            return Promise.resolve(currentJournalRec)
          }),
          update: vi.fn().mockImplementation((id, payload) => {
            currentJournalRec = { ...currentJournalRec, ...payload }
            remoteCheckpoints.push(JSON.parse(JSON.stringify(payload)))
            return Promise.resolve(currentJournalRec)
          }),
        } as any
      }
      if (name === 'race_results') {
        return {
          getFirstListItem: vi.fn().mockResolvedValue({ id: 'rec_race_res_offline' }),
          update: vi.fn().mockResolvedValue({ id: 'rec_race_res_offline' }),
        } as any
      }
      return {} as any
    })

    const res = await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
      mockOfficialResult,
      { requireBackendSync: true },
    )

    // Conclusão bem-sucedida autoritativa exclusivamente pelo backend
    expect(res.success).toBe(true)
    expect(res.journal.status).toBe('COMPLETE')
    expect(res.journal.appliedDriverIds).toEqual([
      'driver_piastri',
      'driver_norris',
      'driver_leclerc',
    ])

    // Checkpoints remotos registrados:
    // 1. Checkpoint inicial (status APPLYING, appliedDriverIds: [])
    expect(remoteCheckpoints[0].status).toBe('APPLYING')
    expect(remoteCheckpoints[0].applied_driver_ids).toEqual([])

    // 2. Checkpoint após driver_piastri
    expect(remoteCheckpoints[1].applied_driver_ids).toEqual(['driver_piastri'])

    // 3. Checkpoint após driver_norris
    expect(remoteCheckpoints[2].applied_driver_ids).toEqual(['driver_piastri', 'driver_norris'])

    // 4. Checkpoint após driver_leclerc
    expect(remoteCheckpoints[3].applied_driver_ids).toEqual([
      'driver_piastri',
      'driver_norris',
      'driver_leclerc',
    ])

    // 5. Checkpoint final (status COMPLETE)
    const finalCp = remoteCheckpoints[remoteCheckpoints.length - 1]
    expect(finalCp.status).toBe('COMPLETE')
  })

  it('5. Confirmação final pendente ou rejeitada: aplicação não retorna sucesso', async () => {
    let currentJournalRec: any = null
    let updateCount = 0

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_career_apply_journals') {
        return {
          getFullList: vi.fn().mockResolvedValue([]),
          getFirstListItem: vi.fn().mockImplementation(() => {
            if (currentJournalRec) return Promise.resolve(currentJournalRec)
            return Promise.reject({ status: 404 })
          }),
          create: vi.fn().mockImplementation((payload) => {
            currentJournalRec = { id: 'rec_pb_final_fail', ...payload }
            return Promise.resolve(currentJournalRec)
          }),
          update: vi.fn().mockImplementation((id, payload) => {
            updateCount++
            // Updates de pilotos (1 a 3) funcionam
            if (updateCount <= 3) {
              currentJournalRec = { ...currentJournalRec, ...payload }
              return Promise.resolve(currentJournalRec)
            }
            // Update final (COMPLETE) é rejeitado pelo backend!
            throw new Error('Falha catastrófica ao confirmar checkpoint final no backend')
          }),
        } as any
      }
      if (name === 'race_results') {
        return {
          getFirstListItem: vi.fn().mockResolvedValue({ id: 'rec_race_res_1' }),
          update: vi.fn().mockResolvedValue({ id: 'rec_race_res_1' }),
        } as any
      }
      return {} as any
    })

    const res = await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
      mockOfficialResult,
      { requireBackendSync: true },
    )

    // A gravação final falhou, logo a aplicação NÃO retorna sucesso
    expect(res.success).toBe(false)
    expect(res.error).toContain('Checkpoint Final Falhou')
    expect(res.journal.status).toBe('FAILED')
  })

  it('6. Falha secundária ao registrar FAILED não mascara o erro original', async () => {
    let journalCallCount = 0

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_career_apply_journals') {
        let currentRecord: any = null
        return {
          getFullList: vi.fn().mockResolvedValue([]),
          getFirstListItem: vi.fn().mockImplementation(() => {
            if (currentRecord) return Promise.resolve(currentRecord)
            return Promise.reject({ status: 404 })
          }),
          create: vi.fn().mockImplementation((payload) => {
            currentRecord = { id: 'rec_journal_mask_test', ...payload }
            return Promise.resolve(currentRecord)
          }),
          update: vi.fn().mockImplementation((id, payload) => {
            journalCallCount++
            if (journalCallCount === 1) {
              // Erro primário no piloto 1
              throw new Error('Erro original primário de timeout')
            }
            // Falha secundária na tentativa do saveApplicationJournalToBackend(FAILED)
            throw new Error('Erro secundário fatal no backend')
          }),
        } as any
      }
      return {} as any
    })

    const res = await canonicalCareerPersistenceService.registerOfficialRaceResultInCareerAsync(
      mockOfficialResult,
      { requireBackendSync: true },
    )

    expect(res.success).toBe(false)
    // O erro retornado DEVE ser o original primário de piloto, não o secundário!
    expect(res.error).toContain('Erro original primário de timeout')
    expect(res.error).not.toContain('Erro secundário fatal no backend')
  })
})
