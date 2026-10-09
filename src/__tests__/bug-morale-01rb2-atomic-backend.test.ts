import { describe, it, expect, vi, beforeEach } from 'vitest'
import { driverMoraleService } from '@/services/driverMoraleService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { f1Service } from '@/services/f1Service'
import pb from '@/lib/pocketbase/client'

/**
 * MICROBLOCO BUG-MORALE-01R-B2: EVIDÊNCIA DE APLICAÇÃO ATÔMICA NO BACKEND
 *
 * Verificação focada dos 5 cenários exigidos:
 * 1. Falha de gravação -> nenhuma aplicação parcial (nem moral sem recibo, nem recibo sem moral)
 * 2. Aplicação concluída com resposta perdida -> retry sem duplicação (recupera recibo e não reaplica)
 * 3. Nova instância sem armazenamento local -> reconhece a aplicação anterior via backend autoritativo
 * 4. Duas tentativas concorrentes -> um único efeito (chave única de operação / atomicidade transacional)
 * 5. Consulta de recibo antigo -> preserva mudanças posteriores de moral (recibo decide aplicar/não aplicar, não sobrescreve moral atual)
 */

describe('BUG-MORALE-01R-B2: Persistência Atômica de Moral e Recibo no Backend', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  // ---------------------------------------------------------------------------
  // Cenário 1: Falha de gravação -> Nenhuma aplicação parcial
  // ---------------------------------------------------------------------------
  it('1. falha de gravação no backend -> nenhuma aplicação parcial (rejeita sem gravar recibo nem moral parcial)', async () => {
    // Simula falha atômica no backend (ex: erro de transação / 500 no hook)
    vi.spyOn(pb, 'send').mockRejectedValue(new Error('Transaction rollback in apply-atomic'))

    const mockDrivers = [{ id: 'pb_drv_fail_1', name: 'Failed Driver', morale: 70 }]
    vi.spyOn(f1Service, 'getAllDrivers').mockResolvedValue(mockDrivers as any)
    vi.spyOn(f1Service, 'getAllTeams').mockResolvedValue([] as any)
    const updateSpy = vi.spyOn(f1Service, 'updateDriver').mockResolvedValue({} as any)

    const officialResult: any = {
      officialResultId: 'orr_fail_test',
      raceVariant: 'MAIN_RACE',
      careerId: 'career_fail_atomic',
      season: 2026,
      round: 1,
      entries: [
        {
          driverId: 'pb_drv_fail_1',
          driverName: 'Failed Driver',
          finalPosition: 1,
          gridPosition: 5,
          status: 'finished',
        },
      ],
    }

    const batch = await canonicalRaceResultService.processOfficialMoraleDirect(officialResult)

    expect(batch).toBeDefined()
    expect(batch?.allSucceeded).toBe(false)
    expect(batch?.failedCount).toBe(1)
    expect(batch?.items[0].status).toBe('failed')
    expect(batch?.items[0].error).toContain('Transaction rollback')

    // Nenhuma alteração foi persistida no fallback sem atomicidade
    expect(updateSpy).not.toHaveBeenCalled()

    // O piloto NÃO está marcado como processado no cache local
    expect(
      driverMoraleService.isMoraleAlreadyProcessed({
        careerId: 'career_fail_atomic',
        season: 2026,
        round: 1,
        driverId: 'pb_drv_fail_1',
      }),
    ).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // Cenário 2: Aplicação concluída com resposta perdida -> Retry sem duplicação
  // ---------------------------------------------------------------------------
  it('2. aplicação concluída no backend com resposta perdida -> retry sem duplicação (recupera recibo e pula reaplicação)', async () => {
    let callCount = 0

    // 1ª chamada ao backend: processa no servidor mas a conexão cai na resposta (timeout do cliente)
    // 2ª chamada (retry): o backend agora retorna 'already_applied' pois o recibo existe
    vi.spyOn(pb, 'send').mockImplementation(async (path: string, options?: any) => {
      if (path.includes('/backend/v1/driver-morale/apply-atomic')) {
        callCount++
        if (callCount === 1) {
          throw new Error('Network timeout waiting for response')
        }
        return {
          status: 'already_applied',
          operationKey: 'driver_morale_receipt_career_retry_2026_1_MAIN_RACE_drv_ack',
          driverId: 'drv_ack',
          beforeMorale: 70,
          delta: 4,
          finalMorale: 74,
          appliedAt: '2026-03-10T12:00:00Z',
        }
      }
      if (path.includes('/backend/v1/driver-morale/receipt')) {
        if (callCount >= 1) {
          return {
            exists: true,
            operationKey: 'driver_morale_receipt_career_retry_2026_1_MAIN_RACE_drv_ack',
            driverId: 'drv_ack',
            beforeMorale: 70,
            delta: 4,
            finalMorale: 74,
            appliedAt: '2026-03-10T12:00:00Z',
          }
        }
        return { exists: false }
      }
      return null as any
    })

    const mockDrivers = [{ id: 'drv_ack', name: 'Ack Driver', morale: 70 }]
    vi.spyOn(f1Service, 'getAllDrivers').mockResolvedValue(mockDrivers as any)
    vi.spyOn(f1Service, 'getAllTeams').mockResolvedValue([] as any)

    const officialResult: any = {
      officialResultId: 'orr_retry_test',
      raceVariant: 'MAIN_RACE',
      careerId: 'career_retry',
      season: 2026,
      round: 1,
      entries: [
        {
          driverId: 'drv_ack',
          driverName: 'Ack Driver',
          finalPosition: 1,
          gridPosition: 5, // superou em 4 -> delta +4 (base) + 3 (win) = +7
          status: 'finished',
        },
      ],
    }

    // 1ª Tentativa: falha na recepção da resposta
    const res1 = await canonicalRaceResultService.processOfficialMoraleDirect(officialResult)
    expect(res1?.allSucceeded).toBe(false)
    expect(res1?.failedCount).toBe(1)

    // 2ª Tentativa (Retry): consulta o backend que já tem o recibo gravado
    const res2 = await canonicalRaceResultService.processOfficialMoraleDirect(officialResult)
    expect(res2?.allSucceeded).toBe(true)
    expect(res2?.alreadyProcessedCount).toBe(1)
    expect(res2?.failedCount).toBe(0)

    // O status do item é already_processed com a moral final registrada (74)
    expect(res2?.items[0].status).toBe('already_processed')
    expect(res2?.items[0].savedMorale).toBe(74)
  })

  // ---------------------------------------------------------------------------
  // Cenário 3: Nova instância sem armazenamento local -> Reconhece a aplicação anterior
  // ---------------------------------------------------------------------------
  it('3. nova instância sem armazenamento local (localStorage limpo) -> reconhece a aplicação anterior via backend', async () => {
    // Garante que o localStorage está completamente limpo
    localStorage.clear()

    // O backend responde que o recibo já existe para esta rodada e piloto
    vi.spyOn(pb, 'send').mockImplementation(async (path: string) => {
      if (path.includes('/backend/v1/driver-morale/receipt')) {
        return {
          exists: true,
          operationKey: 'driver_morale_receipt_career_fresh_2026_2_MAIN_RACE_pb_fresh_1',
          driverId: 'pb_fresh_1',
          beforeMorale: 80,
          delta: 3,
          finalMorale: 83,
          appliedAt: '2026-03-10T14:00:00Z',
        }
      }
      return null as any
    })

    const mockSave = vi.fn().mockResolvedValue(true)

    const officialResult = {
      careerId: 'career_fresh',
      season: 2026,
      round: 2,
      sessionType: 'MAIN_RACE',
      entries: [
        {
          driverId: 'pb_fresh_1',
          driverName: 'Fresh Driver',
          finalPosition: 1,
          gridPosition: 1,
          status: 'finished',
        },
      ],
    }

    const calcResults = await driverMoraleService.processOfficialRaceMorale({
      officialResult,
      driverCurrentMoraleMap: { pb_fresh_1: 83 },
      onSaveDriverMorale: mockSave,
    })

    const batch = (calcResults as any).batchResult
    expect(batch).toBeDefined()
    expect(batch.allSucceeded).toBe(true)
    expect(batch.alreadyProcessedCount).toBe(1)
    expect(batch.items[0].status).toBe('already_processed')
    expect(batch.items[0].savedMorale).toBe(83)

    // onSaveDriverMorale NÃO é executado porque o backend já comprovou a aplicação
    expect(mockSave).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // Cenário 4: Duas tentativas concorrentes -> Um único efeito
  // ---------------------------------------------------------------------------
  it('4. duas tentativas concorrentes -> um único efeito aplicado via backend atômico', async () => {
    let executionTimes = 0

    // Simula o comportamento do hook atômico no servidor:
    // A 1ª chamada ganha o lock da transação e aplica.
    // A 2ª chamada encontra o recibo criado pela 1ª e retorna 'already_applied'.
    vi.spyOn(pb, 'send').mockImplementation(async (path: string, options?: any) => {
      if (path.includes('/backend/v1/driver-morale/apply-atomic')) {
        executionTimes++
        if (executionTimes === 1) {
          return {
            status: 'applied',
            operationKey: 'driver_morale_receipt_career_concurrent_2026_1_MAIN_RACE_drv_c',
            driverId: 'drv_c',
            beforeMorale: 70,
            delta: 3,
            finalMorale: 73,
            appliedAt: new Date().toISOString(),
          }
        }
        return {
          status: 'already_applied',
          operationKey: 'driver_morale_receipt_career_concurrent_2026_1_MAIN_RACE_drv_c',
          driverId: 'drv_c',
          beforeMorale: 70,
          delta: 3,
          finalMorale: 73,
          appliedAt: new Date().toISOString(),
        }
      }
      if (path.includes('/backend/v1/driver-morale/receipt')) {
        return { exists: false }
      }
      return null as any
    })

    const mockDrivers = [{ id: 'drv_c', name: 'Concurrent Driver', morale: 70 }]
    vi.spyOn(f1Service, 'getAllDrivers').mockResolvedValue(mockDrivers as any)
    vi.spyOn(f1Service, 'getAllTeams').mockResolvedValue([] as any)

    const officialResult: any = {
      officialResultId: 'orr_concurrent_test',
      raceVariant: 'MAIN_RACE',
      careerId: 'career_concurrent',
      season: 2026,
      round: 1,
      entries: [
        {
          driverId: 'drv_c',
          driverName: 'Concurrent Driver',
          finalPosition: 1,
          gridPosition: 1,
          status: 'finished',
        },
      ],
    }

    // Dispara duas operações simultâneas
    const [res1, res2] = await Promise.all([
      canonicalRaceResultService.processOfficialMoraleDirect(officialResult),
      canonicalRaceResultService.processOfficialMoraleDirect(officialResult),
    ])

    // Ambas concluem com sucesso para o chamador
    expect(res1?.allSucceeded).toBe(true)
    expect(res2?.allSucceeded).toBe(true)

    // Uma aplicou e a outra reconheceu como already_applied
    const totalApplied = (res1?.successCount || 0) + (res2?.successCount || 0)
    const totalAlreadyApplied =
      (res1?.alreadyProcessedCount || 0) + (res2?.alreadyProcessedCount || 0)

    expect(totalApplied).toBe(1)
    expect(totalAlreadyApplied).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // Cenário 5: Consulta de recibo antigo -> Preserva mudanças posteriores de moral
  // ---------------------------------------------------------------------------
  it('5. consulta de recibo antigo -> preserva mudanças posteriores de moral (não restaura finalMorale do recibo)', async () => {
    // Cenário:
    // O piloto correu o Round 1 -> recibo registrou finalMorale: 75.
    // Posteriormente, no Round 2 ou evento de mercado, a moral mudou para 90.
    // Agora consultamos a idempotência do Round 1.
    // O recibo deve reportar que o Round 1 já foi processado, MAS a moral atual (90)
    // NÃO pode ser sobrescrita pelo finalMorale do Round 1 (75).

    vi.spyOn(pb, 'send').mockImplementation(async (path: string) => {
      if (path.includes('/backend/v1/driver-morale/receipt')) {
        return {
          exists: true,
          operationKey: 'driver_morale_receipt_career_post_2026_1_MAIN_RACE_drv_evolved',
          driverId: 'drv_evolved',
          beforeMorale: 70,
          delta: 5,
          finalMorale: 75, // Moral no final do Round 1
          appliedAt: '2026-03-01T12:00:00Z',
          currentDriverMorale: 90, // Moral atual posterior
        }
      }
      return null as any
    })

    const mockSave = vi.fn().mockResolvedValue(true)

    const officialResultRound1 = {
      careerId: 'career_post',
      season: 2026,
      round: 1,
      sessionType: 'MAIN_RACE',
      entries: [
        {
          driverId: 'drv_evolved',
          driverName: 'Evolved Driver',
          finalPosition: 1,
          gridPosition: 6,
          status: 'finished',
        },
      ],
    }

    // Consulta e processamento para a rodada antiga (Round 1) com moral atual conhecida = 90
    const calcResults = await driverMoraleService.processOfficialRaceMorale({
      officialResult: officialResultRound1,
      driverCurrentMoraleMap: { drv_evolved: 90 },
      onSaveDriverMorale: mockSave,
    })

    const batch = (calcResults as any).batchResult
    expect(batch.allSucceeded).toBe(true)
    expect(batch.alreadyProcessedCount).toBe(1)

    // onSaveDriverMorale NUNCA deve ser chamado (não sobrescreve para 75)
    expect(mockSave).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // Cenário Bônus: Aliases (Slug canônico vs ID real do PocketBase)
  // ---------------------------------------------------------------------------
  it('6. slug canônico e ID real resolvem para a mesma operação única sem recibos duplicados', async () => {
    let capturedBody: any = null

    vi.spyOn(pb, 'send').mockImplementation(async (path: string, options?: any) => {
      if (path.includes('/backend/v1/driver-morale/apply-atomic')) {
        capturedBody = options?.body
        return {
          status: 'applied',
          operationKey: 'driver_morale_receipt_career_alias_2026_1_MAIN_RACE_pb_real_norris',
          driverId: 'pb_real_norris',
          driverSlug: 'mclaren_d1',
          beforeMorale: 85,
          delta: 2,
          finalMorale: 87,
          appliedAt: new Date().toISOString(),
        }
      }
      if (path.includes('/backend/v1/driver-morale/receipt')) {
        return { exists: false }
      }
      return null as any
    })

    const mockDrivers = [{ id: 'pb_real_norris', name: 'Lando Norris', morale: 85 }]
    vi.spyOn(f1Service, 'getAllDrivers').mockResolvedValue(mockDrivers as any)
    vi.spyOn(f1Service, 'getAllTeams').mockResolvedValue([] as any)

    const officialResult: any = {
      officialResultId: 'orr_alias_test',
      raceVariant: 'MAIN_RACE',
      careerId: 'career_alias',
      season: 2026,
      round: 1,
      entries: [
        {
          driverId: 'mclaren_d1', // Slug
          driverName: 'Lando Norris',
          finalPosition: 2,
          gridPosition: 2,
          status: 'finished',
        },
      ],
    }

    const batch = await canonicalRaceResultService.processOfficialMoraleDirect(officialResult)

    expect(batch?.allSucceeded).toBe(true)
    expect(batch?.successCount).toBe(1)

    // O corpo enviado para o hook foi resolvido para o ID real do PocketBase
    expect(capturedBody).toBeDefined()
    expect(capturedBody.driverId).toBe('pb_real_norris')
    expect(capturedBody.driverSlug).toBe('mclaren_d1')
  })
})
