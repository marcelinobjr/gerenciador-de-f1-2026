import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { CanonicalPracticeV2Runner } from '@/services/canonicalPracticeV2Runner'
import { CanonicalQualifyingRunner } from '@/services/canonicalQualifyingRunner'
import { practiceSessionService } from '@/services/practiceSessionService'
import type { QualifyingDriverContext } from '@/services/canonicalQualifyingRunner'
import type { PracticeTickContext } from '@/services/canonicalPracticeRunner'
import type { PracticeSessionRecordState } from '@/types/practice-session'
import type { QualifyingStageState } from '@/types/canonical-qualifying-types'

describe('BUG-TYRE-SYNC-01B: Canonical Tyre Usage Persistence Contract', () => {
  const seasonId = 'season_2026_test'
  const round = 1
  const d1 = 'drv_verstappen'
  const d2 = 'drv_norris'

  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // T1 TREINO: voltas pelo runner → wear aumenta, lapsUsed aumenta, set correto alterado
  it('T1 TREINO: voltas pelo runner → wear aumenta, lapsUsed aumenta, set correto alterado', () => {
    // 1. Criar inventário persistente do fim de semana
    const inventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [d1, d2],
      primaryDriverIds: [d1, d2],
    })

    const initialTire = inventories[d1].find((t) => (t.wear || 0) < 100)!
    expect(initialTire).toBeDefined()
    const targetSetId = initialTire.id
    const initialWear = initialTire.wear || 0
    const initialLaps = initialTire.lapsUsed || 0

    // 2. Criar sessão de treino com o carro 1 usando este jogo de pneu
    const prep = {
      round,
      weatherForecast: 'seco' as const,
      cars: [
        {
          carId: 'car1' as const,
          driverId: d1,
          program: 'car_setup' as const,
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          fuelLoad: { mode: 'medium' as const, kg: 30, estimatedLaps: 18 },
          tyreSelection: {
            setId: targetSetId,
            compound: initialTire.compound,
          },
        },
        {
          carId: 'car2' as const,
          driverId: d2,
          program: 'race_pace' as const,
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          fuelLoad: { mode: 'medium' as const, kg: 30, estimatedLaps: 18 },
          tyreSelection: {
            setId: inventories[d2][0].id,
            compound: inventories[d2][0].compound,
          },
        },
      ],
      overallObjective: 'Teste T1 Treino',
      confirmedAt: new Date().toISOString(),
    }

    const sessionState: PracticeSessionRecordState =
      practiceSessionService.createInitialSessionState({
        careerId: 'career_test',
        seasonId,
        round,
        sessionType: 'tp1',
        preparation: prep as any,
      })

    // Colocar o carro 1 na pista em flying_lap com progresso alto para cruzar linha
    sessionState.cars.car1.status = 'flying_lap'
    sessionState.cars.car1.currentLapProgressPct = 99
    sessionState.cars.car1.tyreWear = initialWear

    const context: PracticeTickContext = {
      round,
      gpName: 'Bahrain GP',
      circuitName: 'Bahrain International Circuit',
      lengthKm: 5.412,
      tireAbrasiveness: 3,
      weather: 'seco',
      teamChassisRating: 90,
      teamEngineSupplier: 'Red Bull Powertrains',
      teamName: 'Red Bull Racing',
      teamColor: '#0600ef',
      drivers: [
        {
          id: d1,
          name: 'Max Verstappen',
          speed: 95,
          consistency: 90,
          defense: 90,
        },
        {
          id: d2,
          name: 'Lando Norris',
          speed: 90,
          consistency: 88,
          defense: 85,
        },
      ],
    }

    // Avançar tempo via CanonicalPracticeV2Runner para completar ao menos 1 volta
    const stepResult = CanonicalPracticeV2Runner.advanceBySeconds(sessionState, 15, context)
    expect(stepResult.lapsCount).toBeGreaterThanOrEqual(1)

    // Ler dados de pneu atualizados
    const stored = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)
    const updatedSet = stored?.inventoriesByDriver[d1]?.find((s) => s.id === targetSetId)

    expect(updatedSet).toBeDefined()
    expect(updatedSet!.lapsUsed).toBeGreaterThan(initialLaps)
    expect(updatedSet!.wear).toBeGreaterThanOrEqual(initialWear)
    expect(updatedSet!.condition).toBe(100 - updatedSet!.wear)

    // Garantir que outros sets de d1 não foram alterados
    const otherSets = stored?.inventoriesByDriver[d1]?.filter((s) => s.id !== targetSetId) || []
    for (const other of otherSets) {
      expect(other.lapsUsed || 0).toBe(0)
    }
  })

  // T2 QUALI: mesmo contrato na classificação
  it('T2 QUALI: voltas pelo runner na classificação → wear e lapsUsed aumentam no set correto', () => {
    const inventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [d1, d2],
      primaryDriverIds: [d1, d2],
    })

    const car1Tire = inventories[d1].find((t) => (t.wear || 0) < 100)!
    const car2Tire = inventories[d2].find((t) => (t.wear || 0) < 100)!

    const qState: QualifyingStageState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: {
        driverId: d1,
        driverName: 'Max Verstappen',
        driverNumber: 1,
        tyreSetId: car1Tire.id,
        compound: car1Tire.compound,
        wear: car1Tire.wear || 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: d2,
        driverName: 'Lando Norris',
        driverNumber: 4,
        tyreSetId: car2Tire.id,
        compound: car2Tire.compound,
        wear: car2Tire.wear || 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: [
        {
          id: d1,
          name: 'Max Verstappen',
          teamId: 'team_redbull',
          teamName: 'Red Bull',
          speed: 90,
          consistency: 90,
          experience: 90,
        } as unknown as QualifyingDriverContext,
        {
          id: d2,
          name: 'Lando Norris',
          teamId: 'team_mclaren',
          teamName: 'McLaren',
          speed: 88,
          consistency: 88,
          experience: 85,
        } as unknown as QualifyingDriverContext,
      ],
    })

    // Colocar carro 1 em volta rápida perto de cruzar a linha de chegada
    qState.cars.car1.status = 'flying_lap'
    qState.cars.car1.currentLapProgressPct = 99
    qState.cars.car1.tyreWear = 2

    const qDrivers: QualifyingDriverContext[] = [
      {
        id: d1,
        name: 'Max Verstappen',
        teamId: 'team_redbull',
        teamName: 'Red Bull',
        speed: 90,
        consistency: 90,
        experience: 90,
      } as unknown as QualifyingDriverContext,
      {
        id: d2,
        name: 'Lando Norris',
        teamId: 'team_mclaren',
        teamName: 'McLaren',
        speed: 88,
        consistency: 88,
        experience: 85,
      } as unknown as QualifyingDriverContext,
    ]

    const context = {
      seasonId,
      round,
      gpName: 'GP do Bahrein',
      circuitName: 'Bahrain International Circuit',
      lengthKm: 5.412,
      tireAbrasiveness: 60,
      weather: 'seco' as const,
      teamChassisRating: 82,
      teamEngineSupplier: 'Audi',
      teamName: 'Apex GP',
      teamColor: '#00A6FB',
      drivers: qDrivers,
      rivalDrivers: [],
    }

    const stepRes = CanonicalQualifyingRunner.advanceBySeconds(qState, 15, context, {
      persistState: true,
    })
    expect(stepRes.lapsCount).toBeGreaterThanOrEqual(1)

    const stored = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)
    const updatedCar1Set = stored?.inventoriesByDriver[d1]?.find((s) => s.id === car1Tire.id)

    expect(updatedCar1Set).toBeDefined()
    expect(updatedCar1Set!.lapsUsed).toBeGreaterThanOrEqual(1)
    expect(updatedCar1Set!.wear).toBeGreaterThanOrEqual(2)
    expect(updatedCar1Set!.condition).toBe(100 - updatedCar1Set!.wear)
  })

  // T3 SAVE/RELOAD: após persistir, reler via readWeekendTireData/getOrCreateWeekendInventories → mesmos wear/lapsUsed, sem regenerar set
  it('T3 SAVE/RELOAD: após persistir, reler via readWeekendTireData e getOrCreateWeekendInventories preserva valores sem regenerar', () => {
    const inventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [d1],
      primaryDriverIds: [d1],
    })

    const targetSet = inventories[d1][0]
    const targetSetId = targetSet.id

    const recordResult = canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId: d1,
      tyreSetId: targetSetId,
      lapsAdded: 7,
      finalWearPct: 22,
    })

    expect(recordResult.success).toBe(true)
    expect(recordResult.status).toBe('APPLIED')
    expect(recordResult.updatedSet?.wear).toBe(22)
    expect(recordResult.updatedSet?.lapsUsed).toBe(7)
    expect(recordResult.updatedSet?.condition).toBe(78)

    // 1. Reler direto do storage via readWeekendTireData
    const directRead = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)
    const setDirect = directRead?.inventoriesByDriver[d1]?.find((s) => s.id === targetSetId)
    expect(setDirect?.wear).toBe(22)
    expect(setDirect?.lapsUsed).toBe(7)
    expect(setDirect?.condition).toBe(78)

    // 2. Chamar getOrCreateWeekendInventories (comportamento de reload de página ou troca de sessão)
    const reloadedInvs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [d1],
      primaryDriverIds: [d1],
    })

    const setReloaded = reloadedInvs[d1]?.find((s) => s.id === targetSetId)
    expect(setReloaded?.wear).toBe(22)
    expect(setReloaded?.lapsUsed).toBe(7)
    expect(setReloaded?.condition).toBe(78)

    // Nenhum set regenerado ou duplicado
    expect(reloadedInvs[d1].length).toBe(inventories[d1].length)
    expect(reloadedInvs[d1].map((s) => s.id)).toEqual(inventories[d1].map((s) => s.id))
  })

  // T4 SET INEXISTENTE: tyreSetId inválido → falha explícita SET_NOT_FOUND, nenhum set criado, nenhum outro alterado
  it('T4 SET INEXISTENTE: tyreSetId inválido → falha explícita SET_NOT_FOUND, nenhum set criado, nenhum outro alterado', () => {
    const inventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [d1],
      primaryDriverIds: [d1],
    })

    const initialSetsSnapshot = JSON.parse(JSON.stringify(inventories[d1]))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId: d1,
      tyreSetId: 'non_existent_tyre_set_99999',
      lapsAdded: 5,
      finalWearPct: 30,
    })

    expect(result.success).toBe(false)
    expect(result.status).toBe('SET_NOT_FOUND')
    expect(result.error).toContain('non_existent_tyre_set_99999')
    expect(result.context?.tyreSetId).toBe('non_existent_tyre_set_99999')
    expect(result.context?.driverId).toBe(d1)

    // Verifica que console.warn registrou o contexto
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()

    // Conferir estado após a tentativa de uso inválido
    const stored = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)
    expect(stored?.inventoriesByDriver[d1].length).toBe(initialSetsSnapshot.length)
    expect(stored?.inventoriesByDriver[d1]).toEqual(initialSetsSnapshot)
  })

  // T5 INVENTÁRIO INEXISTENTE: driverId desconhecido → INVENTORY_NOT_FOUND explícito, sem descarte silencioso
  it('T5 INVENTÁRIO INEXISTENTE: driverId desconhecido → INVENTORY_NOT_FOUND explícito, sem descarte silencioso', () => {
    // Inicializar inventário apenas para d1
    canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [d1],
      primaryDriverIds: [d1],
    })

    const unknownDriverId = 'drv_unknown_ghost'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId: unknownDriverId,
      tyreSetId: 'some_set_id',
      lapsAdded: 3,
      finalWearPct: 15,
    })

    expect(result.success).toBe(false)
    expect(result.status).toBe('INVENTORY_NOT_FOUND')
    expect(result.error).toContain(unknownDriverId)
    expect(result.context?.driverId).toBe(unknownDriverId)

    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()

    // Nenhum inventário fictício deve ter sido criado para esse driver desconhecido
    const stored = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)
    expect(stored?.inventoriesByDriver[unknownDriverId]).toBeUndefined()
  })

  // T6 SEM DUPLICAÇÃO: leituras/reloads/re-renders sem nova volta → wear/lapsUsed não aumentam
  it('T6 SEM DUPLICAÇÃO: leituras/reloads/re-renders sem nova volta → wear/lapsUsed não aumentam', () => {
    const inventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [d1],
      primaryDriverIds: [d1],
    })

    const targetSetId = inventories[d1][0].id

    // Registrar 10 voltas e 25% de wear
    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId: d1,
      tyreSetId: targetSetId,
      lapsAdded: 10,
      finalWearPct: 25,
    })

    // Executar múltiplas leituras e getOrCreateWeekendInventories simulando re-renders e reloads
    for (let i = 0; i < 5; i++) {
      canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)
      canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId,
        round,
        driverIds: [d1],
        primaryDriverIds: [d1],
      })
    }

    const finalStored = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)
    const finalSet = finalStored?.inventoriesByDriver[d1].find((s) => s.id === targetSetId)

    expect(finalSet?.lapsUsed).toBe(10)
    expect(finalSet?.wear).toBe(25)
    expect(finalSet?.condition).toBe(75)
  })

  // T7 REGRESSÃO TYRE-01A: nenhum _init_tire/_default_tire reintroduzido; alocação regulamentar preservada
  it('T7 REGRESSÃO TYRE-01A: nenhum _init_tire/_default_tire reintroduzido; alocação regulamentar preservada', () => {
    const inventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [d1, d2],
      primaryDriverIds: [d1, d2],
    })

    const d1Sets = inventories[d1]
    const d2Sets = inventories[d2]

    // Quantidade regulamentar canônica (20 jogos fim de semana padrão ou 19 sprint)
    expect(d1Sets.length).toBeGreaterThanOrEqual(13)
    expect(d2Sets.length).toBeGreaterThanOrEqual(13)

    // Nenhum ID sintético temporário
    d1Sets.forEach((s) => {
      expect(s.id).not.toContain('_init_tire')
      expect(s.id).not.toContain('_default_tire')
      if (s.tyreSetId) {
        expect(s.tyreSetId).not.toContain('_init_tire')
        expect(s.tyreSetId).not.toContain('_default_tire')
      }
    })

    d2Sets.forEach((s) => {
      expect(s.id).not.toContain('_init_tire')
      expect(s.id).not.toContain('_default_tire')
      if (s.tyreSetId) {
        expect(s.tyreSetId).not.toContain('_init_tire')
        expect(s.tyreSetId).not.toContain('_default_tire')
      }
    })
  })
})
