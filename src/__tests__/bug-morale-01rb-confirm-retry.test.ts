import { describe, it, expect, vi, beforeEach } from 'vitest'
import { driverMoraleService } from '@/services/driverMoraleService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { f1Service } from '@/services/f1Service'

describe('BUG-MORALE-01R-B: Confirmação de Gravação, Resiliência a Falhas e Idempotência Protegida em Retries', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('1. save rejeitado -> sem marcador de processamento; demais pilotos continuam no lote', async () => {
    const savedDrivers: string[] = []
    const mockSave = vi.fn().mockImplementation(async (driverId: string) => {
      if (driverId === 'drv_reject') {
        throw new Error('PocketBase write failed for drv_reject')
      }
      savedDrivers.push(driverId)
      return true
    })

    const officialResult = {
      careerId: 'career_test_rb1',
      season: 2026,
      round: 1,
      entries: [
        {
          driverId: 'drv_reject',
          driverName: 'Rejected Driver',
          finalPosition: 5,
          gridPosition: 5,
          status: 'finished',
        },
        {
          driverId: 'drv_success',
          driverName: 'Success Driver',
          finalPosition: 2,
          gridPosition: 2,
          status: 'finished',
        },
      ],
    }

    const calcResults = await driverMoraleService.processOfficialRaceMorale({
      officialResult,
      driverCurrentMoraleMap: { drv_reject: 70, drv_success: 80 },
      onSaveDriverMorale: mockSave,
    })

    const batch = (calcResults as any).batchResult
    expect(batch).toBeDefined()
    expect(batch.allSucceeded).toBe(false)
    expect(batch.successCount).toBe(1)
    expect(batch.failedCount).toBe(1)
    expect(batch.totalEntries).toBe(2)

    // O piloto rejeitado NÃO deve ter marcador de processado
    const isRejectProcessed = driverMoraleService.isMoraleAlreadyProcessed({
      careerId: 'career_test_rb1',
      season: 2026,
      round: 1,
      driverId: 'drv_reject',
    })
    expect(isRejectProcessed).toBe(false)

    // O piloto com sucesso DEVE estar marcado
    const isSuccessProcessed = driverMoraleService.isMoraleAlreadyProcessed({
      careerId: 'career_test_rb1',
      season: 2026,
      round: 1,
      driverId: 'drv_success',
    })
    expect(isSuccessProcessed).toBe(true)
    expect(savedDrivers).toContain('drv_success')
  })

  it('2. nova tentativa após falha -> gravação e conclusão corretas sem reprocessar quem já foi concluído', async () => {
    let rejectAttempts = 0
    const saveCalls: { driverId: string; morale: number }[] = []

    const mockSave = vi.fn().mockImplementation(async (driverId: string, morale: number) => {
      if (driverId === 'drv_flaky') {
        rejectAttempts++
        if (rejectAttempts === 1) {
          throw new Error('Transient 503 Service Unavailable')
        }
      }
      saveCalls.push({ driverId, morale })
      return true
    })

    const officialResult = {
      careerId: 'career_test_rb2',
      season: 2026,
      round: 1,
      entries: [
        {
          driverId: 'drv_flaky',
          driverName: 'Flaky Driver',
          finalPosition: 1, // P1 -> bonus +3
          gridPosition: 1,
          status: 'finished',
        },
        {
          driverId: 'drv_solid',
          driverName: 'Solid Driver',
          finalPosition: 4,
          gridPosition: 4,
          status: 'finished',
        },
      ],
    }

    // 1ª Tentativa: drv_flaky falha, drv_solid passa
    const res1 = await driverMoraleService.processOfficialRaceMorale({
      officialResult,
      driverCurrentMoraleMap: { drv_flaky: 75, drv_solid: 80 },
      onSaveDriverMorale: mockSave,
    })

    expect(res1.batchResult?.allSucceeded).toBe(false)
    expect(res1.batchResult?.failedCount).toBe(1)
    expect(saveCalls).toHaveLength(1)
    expect(saveCalls[0].driverId).toBe('drv_solid')

    // 2ª Tentativa (Retry): drv_flaky agora tem sucesso, drv_solid já concluído é pulado
    const res2 = await driverMoraleService.processOfficialRaceMorale({
      officialResult,
      driverCurrentMoraleMap: { drv_flaky: 75, drv_solid: 80 },
      onSaveDriverMorale: mockSave,
    })

    expect(res2.batchResult?.allSucceeded).toBe(true)
    expect(res2.batchResult?.successCount).toBe(1)
    expect(res2.batchResult?.alreadyProcessedCount).toBe(1)
    expect(res2.batchResult?.failedCount).toBe(0)

    // Total de chamadas ao save deve ser 2: 1 drv_solid na 1ª tentativa + 1 drv_flaky na 2ª tentativa
    expect(saveCalls).toHaveLength(2)
    expect(saveCalls[1].driverId).toBe('drv_flaky')
    expect(saveCalls[1].morale).toBe(78) // 75 + 3 = 78

    // Agora ambos estão marcados
    expect(
      driverMoraleService.isMoraleAlreadyProcessed({
        careerId: 'career_test_rb2',
        season: 2026,
        round: 1,
        driverId: 'drv_flaky',
      }),
    ).toBe(true)
    expect(
      driverMoraleService.isMoraleAlreadyProcessed({
        careerId: 'career_test_rb2',
        season: 2026,
        round: 1,
        driverId: 'drv_solid',
      }),
    ).toBe(true)
  })

  it('3. save bem-sucedido seguido de falha na marcação -> retry sem segundo delta (preserva valor final persistido)', async () => {
    let saveCount = 0
    const savedValues: number[] = []

    const mockSave = vi.fn().mockImplementation(async (_driverId: string, morale: number) => {
      saveCount++
      savedValues.push(morale)
      return true
    })

    // Simula falha de quota na marcação oficial apenas na 1ª tentativa
    let markCalls = 0
    vi.spyOn(driverMoraleService, 'markMoraleProcessed').mockImplementation(() => {
      markCalls++
      if (markCalls === 1) {
        throw new Error('QuotaExceededError on localStorage markMoraleProcessed')
      }
    })

    const officialResult = {
      careerId: 'career_test_case_b',
      season: 2026,
      round: 1,
      entries: [
        {
          driverId: 'drv_b',
          driverName: 'Driver B',
          finalPosition: 1, // P1 venceu -> +3
          gridPosition: 1,
          status: 'finished',
        },
      ],
    }

    // 1ª Tentativa: save tem sucesso (70 + 3 = 73), mas markMoraleProcessed lança erro
    const res1 = await driverMoraleService.processOfficialRaceMorale({
      officialResult,
      driverCurrentMoraleMap: { drv_b: 70 },
      onSaveDriverMorale: mockSave,
    })

    // Na 1ª tentativa, status do item é failed devido à marcação, mas markMoralePersisted gravou a evidência
    expect(res1.batchResult?.failedCount).toBe(1)
    expect(saveCount).toBe(1)
    expect(savedValues[0]).toBe(73)

    // O registro persistido possui evidência da moral final aplicada (73)
    const storedBeforeRetry = driverMoraleService.getStoredMoraleRecord({
      careerId: 'career_test_case_b',
      season: 2026,
      round: 1,
      driverId: 'drv_b',
    })
    expect(storedBeforeRetry).not.toBeNull()
    expect(storedBeforeRetry?.after).toBe(73)
    expect(storedBeforeRetry?.isPersisted).toBe(true)
    expect(storedBeforeRetry?.isFullyProcessed).toBe(false)

    // 2ª Tentativa (Retry): O sistema reconhece a aplicação anterior via getStoredMoraleRecord.
    // Ele reconcilia a marcação com o valor final 73 SEM chamar onSaveDriverMorale novamente (SEM novo delta)!
    const res2 = await driverMoraleService.processOfficialRaceMorale({
      officialResult,
      // Mesmo se a memória ou mapa tiver mudado, NÃO soma delta de novo
      driverCurrentMoraleMap: { drv_b: 73 },
      onSaveDriverMorale: mockSave,
    })

    expect(res2.batchResult?.allSucceeded).toBe(true)
    expect(res2.batchResult?.successCount).toBe(1)

    // onSaveDriverMorale NÃO foi chamado uma segunda vez (continua 1)
    expect(saveCount).toBe(1)

    // Agora está totalmente processado
    const isNowDone = driverMoraleService.isMoraleAlreadyProcessed({
      careerId: 'career_test_case_b',
      season: 2026,
      round: 1,
      driverId: 'drv_b',
    })
    expect(isNowDone).toBe(true)
  })

  it('4. reinicialização do serviço / reload -> proteção mantida pelos dados persistidos em localStorage', async () => {
    // Simula uma gravação bem sucedida prévia em sessão anterior
    driverMoraleService.markMoralePersisted({
      careerId: 'career_persisted_reload',
      season: 2026,
      round: 2,
      sessionType: 'MAIN_RACE',
      driverId: 'drv_reloaded',
      finalMorale: 84,
      delta: 4,
      before: 80,
    })
    driverMoraleService.markMoraleProcessed(
      {
        careerId: 'career_persisted_reload',
        season: 2026,
        round: 2,
        sessionType: 'MAIN_RACE',
        driverId: 'drv_reloaded',
      },
      {
        before: 80,
        after: 84,
        delta: 4,
      },
    )

    // Instanciação de um novo DriverMoraleService simulando reload completo da página/código
    const { DriverMoraleService } = await import('@/services/driverMoraleService')
    const freshServiceInstance = new DriverMoraleService()

    const mockSave = vi.fn().mockResolvedValue(true)

    const officialResult = {
      careerId: 'career_persisted_reload',
      season: 2026,
      round: 2,
      sessionType: 'MAIN_RACE',
      entries: [
        {
          driverId: 'drv_reloaded',
          driverName: 'Reloaded Driver',
          finalPosition: 1,
          gridPosition: 5, // superou em 4 posições -> se reprocessasse ganharia +5
          status: 'finished',
        },
      ],
    }

    const res = await freshServiceInstance.processOfficialRaceMorale({
      officialResult,
      driverCurrentMoraleMap: { drv_reloaded: 84 },
      onSaveDriverMorale: mockSave,
    })

    // Deve reconhecer que já foi processado sem chamar save
    expect(res.batchResult?.alreadyProcessedCount).toBe(1)
    expect(res.batchResult?.allSucceeded).toBe(true)
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('5. piloto já concluído, consultado por slug ou ID real -> nenhum novo efeito ou reaplicação', async () => {
    const slugKey = 'mercedes_d1'
    const realDbId = 'rec_pb_russell_15c'

    // Piloto registrado e concluído sob o ID real com alias do slug
    driverMoraleService.markMoraleProcessed(
      {
        careerId: 'career_alias_test',
        season: 2026,
        round: 1,
        driverId: realDbId,
        driverAliases: [slugKey, realDbId],
      },
      {
        before: 70,
        after: 73,
        delta: 3,
      },
    )

    // Consulta pelo slug canônico
    const isProcessedBySlug = driverMoraleService.isMoraleAlreadyProcessed({
      careerId: 'career_alias_test',
      season: 2026,
      round: 1,
      driverId: slugKey,
      driverAliases: [realDbId],
    })
    expect(isProcessedBySlug).toBe(true)

    // Consulta pelo ID real
    const isProcessedByDbId = driverMoraleService.isMoraleAlreadyProcessed({
      careerId: 'career_alias_test',
      season: 2026,
      round: 1,
      driverId: realDbId,
      driverAliases: [slugKey],
    })
    expect(isProcessedByDbId).toBe(true)

    // Executar processOfficialRaceMorale passando o slug na entrada
    const mockSave = vi.fn().mockResolvedValue(true)
    const officialResult = {
      careerId: 'career_alias_test',
      season: 2026,
      round: 1,
      entries: [
        {
          driverId: slugKey,
          driverName: 'George Russell',
          finalPosition: 1,
          gridPosition: 1,
          status: 'finished',
          aliases: [slugKey, realDbId],
        },
      ],
    }

    const res = await driverMoraleService.processOfficialRaceMorale({
      officialResult,
      driverAliasesMap: {
        [slugKey]: [slugKey, realDbId],
      },
      driverCurrentMoraleMap: { [slugKey]: 73 },
      onSaveDriverMorale: mockSave,
    })

    expect(res.batchResult?.alreadyProcessedCount).toBe(1)
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('6. lote com falha individual em processOfficialMoraleDirect -> resultado parcial explícito, sem marcador global de sucesso', async () => {
    const mockDrivers = [
      { id: 'pb_driver_alpha', name: 'Alpha Driver', morale: 70 },
      { id: 'pb_driver_beta', name: 'Beta Driver', morale: 70 },
    ]

    vi.spyOn(f1Service, 'getAllDrivers').mockResolvedValue(mockDrivers as any)
    vi.spyOn(f1Service, 'getAllTeams').mockResolvedValue([] as any)

    // Piloto Alpha tem falha no banco; Piloto Beta tem sucesso
    const updateSpy = vi.spyOn(f1Service, 'updateDriver').mockImplementation(async (id) => {
      if (id === 'pb_driver_alpha') {
        throw new Error('Database connection reset during updateDriver')
      }
      return {} as any
    })

    const officialResult: any = {
      officialResultId: 'orr_partial_batch',
      schemaVersion: 'official-race-result-v1',
      raceVariant: 'MAIN_RACE',
      careerId: 'career_partial_batch',
      season: 2026,
      round: 3,
      officializedAt: new Date().toISOString(),
      entries: [
        {
          driverId: 'pb_driver_alpha',
          driverName: 'Alpha Driver',
          finalPosition: 1,
          gridPosition: 1,
          status: 'finished',
        },
        {
          driverId: 'pb_driver_beta',
          driverName: 'Beta Driver',
          finalPosition: 2,
          gridPosition: 2,
          status: 'finished',
        },
      ],
    }

    const batch = await canonicalRaceResultService.processOfficialMoraleDirect(officialResult)

    expect(batch).toBeDefined()
    expect(batch?.allSucceeded).toBe(false)
    expect(batch?.failedCount).toBe(1)
    expect(batch?.successCount).toBe(1)
    expect(batch?.totalEntries).toBe(2)

    const alphaItem = batch?.items.find((i) => i.driverId === 'pb_driver_alpha')
    const betaItem = batch?.items.find((i) => i.driverId === 'pb_driver_beta')

    expect(alphaItem?.status).toBe('failed')
    expect(alphaItem?.error).toContain('Database connection reset')
    expect(betaItem?.status).toBe('success')

    // Alpha NÃO é marcado como processado
    expect(
      driverMoraleService.isMoraleAlreadyProcessed({
        careerId: 'career_partial_batch',
        season: 2026,
        round: 3,
        driverId: 'pb_driver_alpha',
      }),
    ).toBe(false)

    // Beta É marcado como processado
    expect(
      driverMoraleService.isMoraleAlreadyProcessed({
        careerId: 'career_partial_batch',
        season: 2026,
        round: 3,
        driverId: 'pb_driver_beta',
      }),
    ).toBe(true)

    // Em retry da mesma corrida, Alpha é tentado novamente e Beta é pulado
    updateSpy.mockResolvedValue({} as any) // restaura conexão do banco

    const retryBatch = await canonicalRaceResultService.processOfficialMoraleDirect(officialResult)

    expect(retryBatch?.allSucceeded).toBe(true)
    expect(retryBatch?.successCount).toBe(1) // Alpha teve sucesso agora
    expect(retryBatch?.alreadyProcessedCount).toBe(1) // Beta foi pulado
    expect(retryBatch?.failedCount).toBe(0)
  })

  it('7. falha de resolução de identidade (slug desconhecido) propaga falha e mantém pendência explícita', async () => {
    vi.spyOn(f1Service, 'getAllDrivers').mockResolvedValue([] as any)
    vi.spyOn(f1Service, 'getAllTeams').mockResolvedValue([] as any)
    const updateSpy = vi.spyOn(f1Service, 'updateDriver').mockResolvedValue({} as any)

    const officialResult: any = {
      officialResultId: 'orr_unknown_driver',
      careerId: 'career_unknown_test',
      season: 2026,
      round: 1,
      entries: [
        {
          driverId: 'unresolvable_ghost_slug',
          driverName: 'Ghost Driver',
          finalPosition: 10,
          gridPosition: 10,
          status: 'finished',
        },
      ],
    }

    const batch = await canonicalRaceResultService.processOfficialMoraleDirect(officialResult)

    expect(batch?.allSucceeded).toBe(false)
    expect(batch?.failedCount).toBe(1)
    expect(batch?.items[0].status).toBe('failed')
    expect(batch?.items[0].error).toContain('could not be resolved')

    // Nenhuma gravação efetuada
    expect(updateSpy).not.toHaveBeenCalled()

    // Piloto continua pendente (não marcado como processado)
    expect(
      driverMoraleService.isMoraleAlreadyProcessed({
        careerId: 'career_unknown_test',
        season: 2026,
        round: 1,
        driverId: 'unresolvable_ghost_slug',
      }),
    ).toBe(false)
  })
})
