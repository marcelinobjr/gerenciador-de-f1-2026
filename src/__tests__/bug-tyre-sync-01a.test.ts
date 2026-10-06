import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { CanonicalQualifyingRunner } from '@/services/canonicalQualifyingRunner'
import { practiceSessionService } from '@/services/practiceSessionService'
import { validateCarPreparation } from '@/services/practicePreparationService'
import type { QualifyingDriverContext } from '@/services/canonicalQualifyingRunner'
import type { PracticeCarPreparation } from '@/types/practice-session'

describe('BUG-TYRE-SYNC-01A: Tyre Sync & Inventory Integrity', () => {
  const seasonId = 'season_2026_test'
  const round = 1
  const d1 = 'drv_verstappen'
  const d2 = 'drv_norris'

  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  it('T1: quali com inventário válido → tyreSetId do carro existe no inventário canônico e sem ID sintético', () => {
    // Materializar inventário canônico
    const inventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [d1, d2],
      primaryDriverIds: [d1, d2],
    })

    const car1Tire = inventories[d1]?.find((t) => (t.wear || 0) < 100)
    const car2Tire = inventories[d2]?.find((t) => (t.wear || 0) < 100)

    expect(car1Tire).toBeDefined()
    expect(car2Tire).toBeDefined()
    expect(car1Tire?.id).not.toContain('_init_tire')
    expect(car2Tire?.id).not.toContain('_init_tire')

    // Inicializar quali
    const qState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: {
        driverId: d1,
        driverName: 'Max Verstappen',
        driverNumber: 1,
        tyreSetId: car1Tire!.id,
        compound: car1Tire!.compound || 'macio',
        wear: car1Tire!.wear || 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: d2,
        driverName: 'Lando Norris',
        driverNumber: 4,
        tyreSetId: car2Tire!.id,
        compound: car2Tire!.compound || 'macio',
        wear: car2Tire!.wear || 0,
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

    expect(qState.cars.car1.currentTyreSetId).toBe(car1Tire!.id)
    expect(qState.cars.car2.currentTyreSetId).toBe(car2Tire!.id)
    expect(inventories[d1].some((s) => s.id === qState.cars.car1.currentTyreSetId)).toBe(true)
    expect(inventories[d2].some((s) => s.id === qState.cars.car2.currentTyreSetId)).toBe(true)
    expect(qState.cars.car1.currentTyreSetId).not.toContain('_init_tire')
    expect(qState.cars.car2.currentTyreSetId).not.toContain('_init_tire')
  })

  it('T2: treino com inventário válido → tyreSetId do carro existe no inventário canônico e sem ID sintético', () => {
    const inventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [d1, d2],
      primaryDriverIds: [d1, d2],
    })

    const car1Tire = inventories[d1]?.find((t) => (t.wear || 0) < 100)
    const car2Tire = inventories[d2]?.find((t) => (t.wear || 0) < 100)

    const preparation = {
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
            setId: car1Tire!.id,
            compound: car1Tire!.compound,
          },
        },
        {
          carId: 'car2' as const,
          driverId: d2,
          program: 'race_pace' as const,
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          fuelLoad: { mode: 'medium' as const, kg: 30, estimatedLaps: 18 },
          tyreSelection: {
            setId: car2Tire!.id,
            compound: car2Tire!.compound,
          },
        },
      ],
      overallObjective: 'Teste de treino canônico',
      confirmedAt: new Date().toISOString(),
    }

    const session = practiceSessionService.createInitialSessionState({
      careerId: 'career_test',
      seasonId,
      round,
      sessionType: 'tp1',
      preparation: preparation as any,
    })

    expect(session.cars.car1.currentTyreSetId).toBe(car1Tire!.id)
    expect(session.cars.car2.currentTyreSetId).toBe(car2Tire!.id)
    expect(inventories[d1].some((s) => s.id === session.cars.car1.currentTyreSetId)).toBe(true)
    expect(inventories[d2].some((s) => s.id === session.cars.car2.currentTyreSetId)).toBe(true)
    expect(session.cars.car1.currentTyreSetId).not.toContain('_default_tire')
    expect(session.cars.car2.currentTyreSetId).not.toContain('_default_tire')
    expect(session.cars.car1.currentTyreSetId).not.toContain('_init_tire')
    expect(session.cars.car2.currentTyreSetId).not.toContain('_init_tire')
  })

  it('T3: inventário sem jogo elegível → sem sintético e bloqueio explícito via errors.tyres', () => {
    // Criar inventário onde todos os jogos estão 100% desgastados
    const inventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [d1],
      primaryDriverIds: [d1],
    })

    const wornOutSets = inventories[d1].map((s) => ({
      ...s,
      wear: 100,
      lapsUsed: 40,
      status: 'usado' as const,
    }))
    canonicalWeekendTyrePersistence.updateDriverInventory(seasonId, round, d1, wornOutSets)

    const updatedInvs =
      canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)?.inventoriesByDriver ||
      {}
    const eligibleTire = updatedInvs[d1]?.find((t) => (t.wear || 0) < 100)
    expect(eligibleTire).toBeUndefined()

    // Preparação sem pneu elegível (tyreSelection nulo)
    const prepCar: PracticeCarPreparation = {
      carId: 'car1',
      driverId: d1,
      program: 'car_setup',
      tyreSelection: null,
      fuelLoad: { kg: 30, estimatedLaps: 18 },
      setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
    }

    const validation = validateCarPreparation(prepCar, updatedInvs[d1])
    expect(validation.valid).toBe(false)
    expect(validation.errors.tyres).toBe('Nenhum jogo de pneus reservado para o treino.')

    // Inicialização da sessão de treino com seleção nula não gera sintético
    const session = practiceSessionService.createInitialSessionState({
      careerId: 'career_test',
      seasonId,
      round,
      sessionType: 'tp1',
      preparation: {
        round,
        cars: [prepCar, prepCar],
      } as any,
    })

    expect(session.cars.car1.currentTyreSetId).toBe('')
    expect(session.cars.car1.status).toBe('garage')
    expect(session.cars.car1.currentTyreSetId).not.toContain('_default_tire')
  })

  it('T4: sem inventário prévio → getOrCreateWeekendInventories materializa antes da seleção', () => {
    // Antes da chamada: storage vazio
    const preCheck = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)
    expect(preCheck).toBeNull()

    // Simulação do comportamento de WeekendV2Page: se não houver inventário, invoca getOrCreateWeekendInventories
    const materialized = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [d1, d2],
      primaryDriverIds: [d1, d2],
    })

    expect(materialized[d1]).toBeDefined()
    expect(materialized[d1].length).toBeGreaterThanOrEqual(13)
    expect(materialized[d2]).toBeDefined()
    expect(materialized[d2].length).toBeGreaterThanOrEqual(13)

    // Seleção subsequente encontra jogos reais
    const c1Tire = materialized[d1].find((t) => (t.wear || 0) < 100)
    expect(c1Tire).toBeDefined()
    expect(c1Tire?.id).toBeDefined()
    expect(c1Tire?.id).not.toContain('_init_tire')
  })

  it('T5: inventário parcialmente usado → wear e lapsUsed são preservados, nada é recriado', () => {
    // Criar inventário inicial
    const initialInvs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [d1],
      primaryDriverIds: [d1],
    })

    const targetSetId = initialInvs[d1][0].id
    // Simular uso canônico em TL1
    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId: d1,
      tyreSetId: targetSetId,
      lapsAdded: 15,
      finalWearPct: 35,
    })

    // Chamar getOrCreateWeekendInventories novamente (ex: recarregar página / entrar em sessão seguinte)
    const reloadedInvs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [d1],
      primaryDriverIds: [d1],
    })

    const inspectedSet = reloadedInvs[d1].find((s) => s.id === targetSetId)
    expect(inspectedSet).toBeDefined()
    expect(inspectedSet?.wear).toBe(35)
    expect(inspectedSet?.lapsUsed).toBe(15)
    expect(inspectedSet?.status).toBe('usado')

    // Garantir que a lista inteira de pneus não foi recriada (continua tendo os mesmos IDs)
    expect(reloadedInvs[d1].map((s) => s.id)).toEqual(initialInvs[d1].map((s) => s.id))
  })

  it('T6: regressão quali normal → inicialização e estrutura do estágio consistentes com sets reais', () => {
    const inventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [d1, d2],
      primaryDriverIds: [d1, d2],
    })

    const car1Tire = inventories[d1].find((t) => (t.wear || 0) < 100)!
    const car2Tire = inventories[d2].find((t) => (t.wear || 0) < 100)!

    const qState = CanonicalQualifyingRunner.initializeStage({
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

    expect(qState.status).toBe('ready')
    expect(qState.cars.car1.status).toBe('garage')
    expect(qState.cars.car2.status).toBe('garage')
    expect(qState.cars.car1.currentTyreSetId).toBe(car1Tire.id)
    expect(qState.cars.car2.currentTyreSetId).toBe(car2Tire.id)
    expect(qState.leaderboard.length).toBeGreaterThan(0)
    // Os carros do jogador têm status de garagem e tyres válidos do inventário real
    expect(inventories[d1].some((s) => s.id === qState.cars.car1.currentTyreSetId)).toBe(true)
    expect(inventories[d2].some((s) => s.id === qState.cars.car2.currentTyreSetId)).toBe(true)
  })
})
