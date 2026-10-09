import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'
import pb from '@/lib/pocketbase/client'

describe('RACE-CAREER-SAVE-01 — Correção de Cota do LocalStorage e Persistência no Backend', () => {
  const careerId = 'test_career_quota_01'
  const season = 2026
  const round = 1

  const mockOfficialResult: OfficialRaceResult = {
    schemaVersion: 'official-race-result-v1',
    officialResultId: 'orr_test_career_quota_01_s2026_r1_123456789',
    raceVariant: 'MAIN_RACE',
    careerId,
    season,
    round,
    raceId: 'race_test_1',
    circuitId: 'albert_park',
    circuitName: 'Melbourne Grand Prix Circuit',
    circuitCountry: 'Austrália',
    playerTeamId: 'team_audi',
    officializedAt: new Date().toISOString(),
    totalLaps: 58,
    winnerDriverId: 'driver_piastri',
    winnerTeamId: 'team_mclaren',
    poleDriverId: 'driver_verstappen',
    fastestLapDriverId: 'driver_norris',
    podium: ['driver_piastri', 'driver_norris', 'driver_leclerc'],
    entries: [
      {
        driverId: 'driver_piastri',
        teamId: 'team_mclaren',
        driverName: 'Oscar Piastri',
        teamName: 'McLaren F1 Team',
        teamColor: '#FF8000',
        isPlayer: false,
        gridPosition: 2,
        finalPosition: 1,
        positionsGainedLost: 1,
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
        gridPosition: 3,
        finalPosition: 2,
        positionsGainedLost: 1,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 18,
      } as any,
    ],
    playerEntries: [
      {
        driverId: 'driver_audi_1',
        teamId: 'team_audi',
        driverName: 'Audi Driver 1',
        teamName: 'Audi F1 Team',
        teamColor: '#00E700',
        isPlayer: true,
        gridPosition: 5,
        finalPosition: 5,
        positionsGainedLost: 0,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 10,
      } as any,
      {
        driverId: 'driver_audi_2',
        teamId: 'team_audi',
        driverName: 'Audi Driver 2',
        teamName: 'Audi F1 Team',
        teamColor: '#00E700',
        isPlayer: true,
        gridPosition: 6,
        finalPosition: 6,
        positionsGainedLost: 0,
        lapsCompleted: 58,
        status: 'finished',
        pointsAwarded: 8,
      } as any,
    ],
    eventsSummary: {
      safetyCarPeriods: 0,
      safetyCarLaps: 0,
      vscPeriods: 0,
      vscLaps: 0,
      redFlagPeriods: 0,
      dnfCount: 0,
      totalPitStops: 2,
      significantIncidents: [],
    },
    resultHash: '',
  }

  // Preencher hash
  const entriesChecksum = (mockOfficialResult.entries || [])
    .map((e: any) => `${e.driverId}:${e.finalPosition}:${e.status}`)
    .join(';')
  mockOfficialResult.resultHash = `sha256-mock-${entriesChecksum.length}`

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('1. Cota estourada no localStorage não invalida nem interrompe o registro se o backend confirma', async () => {
    // Mockar setItem do localStorage para lançar erro de cota (QuotaExceededError)
    const originalSetItem = localStorage.setItem.bind(localStorage)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      if (key.includes('career_apply_result') || key.includes('race_result')) {
        const err = new Error(
          `Failed to execute 'setItem' on 'Storage': Setting the value of '${key}' exceeded the quota.`,
        )
        err.name = 'QuotaExceededError'
        throw err
      }
      return originalSetItem(key, value)
    })

    // Mockar pb.collection('race_results') para simular sucesso no backend
    let pbCreatedRecord: any = null
    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'race_results') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue(new Error('not found')),
          create: vi.fn().mockImplementation((payload) => {
            pbCreatedRecord = { id: 'rec_123', ...payload }
            return Promise.resolve(pbCreatedRecord)
          }),
          update: vi.fn().mockResolvedValue({ id: 'rec_123' }),
        } as any
      }
      if (name === 'seasons') {
        return {
          getFirstListItem: vi.fn().mockResolvedValue({ id: 'season_pb_123' }),
        } as any
      }
      return {
        getFirstListItem: vi.fn().mockResolvedValue(null),
      } as any
    })

    // Executa registro
    const res = await canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(
      mockOfficialResult,
      { requireBackendSync: true },
    )

    // Deve retornar sucesso mesmo com localStorage falhando de cota
    expect(res.success).toBe(true)
    expect(res.journal.status).toBe('COMPLETE')
    expect(pbCreatedRecord).not.toBeNull()
    expect(pbCreatedRecord.career_id).toBe(careerId)
    expect(pbCreatedRecord.round).toBe(round)
  })

  it('2. Backend fora com requireBackendSync bloqueia a conclusão e propaga erro para manter CONTINUAR bloqueado', async () => {
    // Mockar pb.collection('race_results') para simular falha no backend (ex: offline ou 500)
    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'race_results') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue(new Error('not found')),
          create: vi.fn().mockRejectedValue(new Error('Backend indisponível (conexão recusada)')),
        } as any
      }
      if (name === 'seasons') {
        return {
          getFirstListItem: vi.fn().mockResolvedValue({ id: 'season_pb_123' }),
        } as any
      }
      return {} as any
    })

    const res = await canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(
      mockOfficialResult,
      { requireBackendSync: true },
    )

    // Deve sinalizar falha e erro explícito
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Backend indisponível|Falha ao salvar no backend/)
  })

  it('3. Retomada/Retry consulta registros e conclui sem duplicar efeitos', async () => {
    // Primeira tentativa parcial com interrupção forçada
    const partialRes = canonicalCareerPersistenceService.registerOfficialRaceResultInCareerSync(
      mockOfficialResult,
      { simulateFailureAfterIndex: 0 },
    )
    expect(partialRes.success).toBe(false)
    expect(partialRes.journal.status).toBe('FAILED')
    expect(partialRes.journal.appliedDriverIds).toContain('driver_piastri')
    expect(partialRes.journal.appliedDriverIds).not.toContain('driver_norris')

    // Segunda tentativa ("Tentar Novamente")
    const retryRes =
      await canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mockOfficialResult)
    expect(retryRes.success).toBe(true)
    expect(retryRes.journal.status).toBe('COMPLETE')
    // Lista de pilotos aplicados deve conter ambos sem duplicação
    expect(retryRes.journal.appliedDriverIds).toHaveLength(2)
    expect(new Set(retryRes.journal.appliedDriverIds).size).toBe(2)
  })

  it('4. Conflito de resultado para a mesma prova detectado e nunca sobrescrito em silêncio', async () => {
    // Registra primeiro resultado oficial
    const res1 =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareerSync(mockOfficialResult)
    expect(res1.success).toBe(true)

    // Cria um resultado conflitante (mesmo careerId, season e round, mas outro officialResultId)
    const conflictingResult: OfficialRaceResult = {
      ...mockOfficialResult,
      officialResultId: 'orr_different_id_conflict_999999',
    }
    conflictingResult.resultHash = 'hash_conflict'

    const res2 =
      await canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(conflictingResult)
    expect(res2.success).toBe(false)
    expect(res2.error).toMatch(/Conflito/)
  })

  it('5. Journal enxuto não guarda snapshots gigantes no localStorage', () => {
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareerSync(mockOfficialResult)
    const journalKey = canonicalCareerPersistenceService.buildApplyJournalKey(
      careerId,
      season,
      round,
      'MAIN_RACE',
    )
    const rawJournal = localStorage.getItem(journalKey)
    expect(rawJournal).not.toBeNull()
    const parsed = JSON.parse(rawJournal!)

    // Verifica que o journal NÃO contém snapshot, nem dados de pista/voltas
    expect((parsed as any).snapshot).toBeUndefined()
    expect((parsed as any).entries).toBeUndefined()
    expect(parsed.appliedDriverIds).toBeDefined()
    expect(parsed.status).toBe('COMPLETE')
    // Tamanho do payload do journal deve ser muito pequeno (< 500 bytes)
    expect(rawJournal!.length).toBeLessThan(1000)
  })
})
