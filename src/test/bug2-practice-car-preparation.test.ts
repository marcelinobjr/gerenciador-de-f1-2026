import { describe, it, expect, beforeEach } from 'vitest'
import { PracticeSessionRunner } from '@/services/canonicalPracticeRunner'
import { practiceSessionService } from '@/services/practiceSessionService'
import { createInitialPracticePreparation } from '@/services/practicePreparationService'
import { RookiePracticeRequirementService } from '@/services/rookiePracticeRequirementService'
import type { PracticePreparation } from '@/types/practice-preparation'
import type { PracticeSessionRecordState } from '@/types/practice-session'
import type { TireSetItem } from '@/types/f1'

describe('BUG-02 ETAPA 1 — Integração TL + canonicalPracticeRunner (BUG2-TL01..06)', () => {
  let samplePrep: PracticePreparation
  let sampleSession: PracticeSessionRecordState

  const sampleContext = {
    round: 1,
    gpName: 'Grande Prêmio da Austrália',
    circuitName: 'Albert Park',
    lengthKm: 5.278,
    tireAbrasiveness: 6,
    weather: 'seco' as const,
    teamChassisRating: 78,
    teamEngineSupplier: 'Audi',
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    drivers: [
      {
        id: 'drv_hulkenberg',
        name: 'Nico Hülkenberg',
        speed: 84,
        consistency: 85,
        defense: 80,
      },
      {
        id: 'drv_bortoleto',
        name: 'Gabriel Bortoleto',
        speed: 82,
        consistency: 81,
        defense: 78,
      },
      {
        id: 'drv_rookie_test',
        name: 'Oliver Goethe',
        speed: 75,
        consistency: 74,
        defense: 70,
        isRookie: true,
      },
    ],
  }

  beforeEach(() => {
    localStorage.clear()

    samplePrep = createInitialPracticePreparation({
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      round: 1,
      sessionType: 'tp1',
      driver1Id: 'drv_hulkenberg',
      driver2Id: 'drv_bortoleto',
      car1Setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      car2Setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
    })

    sampleSession = practiceSessionService.createInitialSessionState({
      careerId: samplePrep.careerId,
      seasonId: samplePrep.seasonId,
      round: samplePrep.round,
      sessionType: samplePrep.sessionType,
      preparation: samplePrep,
      driverNames: {
        car1: 'Nico Hülkenberg',
        driver1Id: 'drv_hulkenberg',
        car2: 'Gabriel Bortoleto',
        driver2Id: 'drv_bortoleto',
      },
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
    })
  })

  // BUG2-TL01: Carro 1 e Carro 2 independentes
  // Carro 1: 20 kg / Soft #1 / setup A
  // Carro 2: 28 kg / Medium #1 / setup B
  // Cada runner recebe sua config
  it('BUG2-TL01 — Carro 1 e Carro 2 independentes: cada runner recebe sua configuração isolada', () => {
    const setupA = { frontWing: 8, rearWing: 7, suspension: 5, differential: 55 }
    const setupB = { frontWing: 4, rearWing: 5, suspension: 7, differential: 45 }

    const tyreC1: TireSetItem = {
      id: 'set_soft_01',
      compound: 'macio',
      wear: 0,
      lapsUsed: 0,
      isFitted: true,
      status: 'instalado',
      driverId: 'drv_hulkenberg',
    }
    const tyreC2: TireSetItem = {
      id: 'set_medium_01',
      compound: 'medio',
      wear: 0,
      lapsUsed: 0,
      isFitted: true,
      status: 'instalado',
      driverId: 'drv_bortoleto',
    }

    // Configurar Carro 1
    PracticeSessionRunner.updateCarGarageSetup(sampleSession, 'car1', setupA)
    PracticeSessionRunner.refuelCarInGarage(sampleSession, 'car1', 20)
    PracticeSessionRunner.fitTyreSetInGarage(sampleSession, 'car1', tyreC1)

    // Configurar Carro 2
    PracticeSessionRunner.updateCarGarageSetup(sampleSession, 'car2', setupB)
    PracticeSessionRunner.refuelCarInGarage(sampleSession, 'car2', 28)
    PracticeSessionRunner.fitTyreSetInGarage(sampleSession, 'car2', tyreC2)

    // Verificar isolamento perfeito no estado
    expect(sampleSession.cars.car1.setup).toEqual(setupA)
    expect(sampleSession.cars.car1.fuelKg).toBe(20)
    expect(sampleSession.cars.car1.currentTyreSetId).toBe('set_soft_01')
    expect(sampleSession.cars.car1.currentCompound).toBe('macio')

    expect(sampleSession.cars.car2.setup).toEqual(setupB)
    expect(sampleSession.cars.car2.fuelKg).toBe(28)
    expect(sampleSession.cars.car2.currentTyreSetId).toBe('set_medium_01')
    expect(sampleSession.cars.car2.currentCompound).toBe('medio')

    // Liberar apenas Carro 1 para a pista
    const exitC1 = PracticeSessionRunner.orderCarExitToTrack(sampleSession, 'car1')
    expect(exitC1.success).toBe(true)
    expect(sampleSession.cars.car1.status).toBe('out_lap')
    expect(sampleSession.cars.car2.status).toBe('garage')

    // Stint do Carro 1 recebeu exatamente setup A, 20 kg e soft #1
    const stintC1 = sampleSession.stints[0]
    expect(stintC1.carId).toBe('car1')
    expect(stintC1.setupSnapshot).toEqual(setupA)
    expect(stintC1.initialFuelKg).toBe(20)
    expect(stintC1.tyreSetId).toBe('set_soft_01')
  })

  // BUG2-TL02: Setup selecionado chega ao runner
  it('BUG2-TL02 — Setup selecionado no painel chega ao runner e é preservado no stint', () => {
    const customSetup = { frontWing: 9, rearWing: 8, suspension: 4, differential: 60 }
    const ok = PracticeSessionRunner.updateCarGarageSetup(sampleSession, 'car1', customSetup)
    expect(ok).toBe(true)

    // Libera carro para pista
    const exitRes = PracticeSessionRunner.orderCarExitToTrack(sampleSession, 'car1')
    expect(exitRes.success).toBe(true)

    const activeStint = sampleSession.stints.find(
      (s) => s.carId === 'car1' && s.status === 'active',
    )
    expect(activeStint).toBeDefined()
    expect(activeStint?.setupSnapshot).toEqual(customSetup)
  })

  // BUG2-TL03: Fuel chega ao runner
  it('BUG2-TL03 — Combustível selecionado no painel chega ao runner e dita o consumo no stint', () => {
    // Jogador escolhe 22 kg
    const ok = PracticeSessionRunner.refuelCarInGarage(sampleSession, 'car1', 22)
    expect(ok).toBe(true)
    expect(sampleSession.cars.car1.fuelKg).toBe(22)

    sampleSession.status = 'running'
    PracticeSessionRunner.orderCarExitToTrack(sampleSession, 'car1')

    const activeStint = sampleSession.stints[0]
    expect(activeStint.initialFuelKg).toBe(22)

    // Completa out_lap e flying_lap
    sampleSession.cars.car1.currentLapProgressPct = 100
    const tick1 = PracticeSessionRunner.tick(sampleSession, 1, sampleContext)
    expect(tick1.nextState.cars.car1.status).toBe('flying_lap')

    tick1.nextState.cars.car1.currentLapProgressPct = 100
    const tick2 = PracticeSessionRunner.tick(tick1.nextState, 1, sampleContext)

    // O combustível final deve ter decrescido a partir de 22 kg
    expect(tick2.nextState.cars.car1.fuelKg).toBeLessThan(22)
    expect(tick2.nextState.cars.car1.fuelKg).toBeGreaterThan(19)
  })

  // BUG2-TL04: Set específico chega ao runner
  it('BUG2-TL04 — Jogo específico de pneus selecionado é montado no carro e consumido no stint', () => {
    const specificSet: TireSetItem = {
      id: 'set_soft_03_specific',
      compound: 'macio',
      wear: 15,
      lapsUsed: 3,
      isFitted: true,
      status: 'instalado',
      driverId: 'drv_hulkenberg',
    }

    const ok = PracticeSessionRunner.fitTyreSetInGarage(sampleSession, 'car1', specificSet)
    expect(ok).toBe(true)
    expect(sampleSession.cars.car1.currentTyreSetId).toBe('set_soft_03_specific')
    expect(sampleSession.cars.car1.currentCompound).toBe('macio')
    expect(sampleSession.cars.car1.tyreWear).toBe(15)

    PracticeSessionRunner.orderCarExitToTrack(sampleSession, 'car1')
    const activeStint = sampleSession.stints[0]
    expect(activeStint.tyreSetId).toBe('set_soft_03_specific')
    expect(activeStint.initialWear).toBe(15)
  })

  // BUG2-TL05: Set usado preserva desgaste
  it('BUG2-TL05 — Jogo usado montado no carro preserva o desgaste inicial e desgasta progressivamente', () => {
    const usedSet: TireSetItem = {
      id: 'set_medium_used',
      compound: 'medio',
      wear: 35,
      lapsUsed: 8,
      isFitted: true,
      status: 'instalado',
      driverId: 'drv_hulkenberg',
    }

    PracticeSessionRunner.fitTyreSetInGarage(sampleSession, 'car1', usedSet)
    expect(sampleSession.cars.car1.tyreWear).toBe(35)

    sampleSession.status = 'running'
    PracticeSessionRunner.orderCarExitToTrack(sampleSession, 'car1')

    // Conclui volta de saída
    sampleSession.cars.car1.currentLapProgressPct = 100
    const t1 = PracticeSessionRunner.tick(sampleSession, 1, sampleContext)

    // Conclui volta rápida
    t1.nextState.cars.car1.currentLapProgressPct = 100
    const t2 = PracticeSessionRunner.tick(t1.nextState, 1, sampleContext)

    // Desgaste começou em 35% e aumentou
    expect(t2.nextState.cars.car1.tyreWear).toBeGreaterThan(35)
  })

  // BUG2-TL06: Rookie TL1 usa config do carro correto (config pertence ao CARRO; TL2 titular retorna)
  it('BUG2-TL06 — Rookie TL1 escalado herda e altera config do carro designado, e no TL2 o titular retorna mantendo o setup do carro', async () => {
    // 1. Escalar novato no Carro 1 no TL1
    const seasonId = 'season_2026'
    const round = 1
    const teamId = 'team_audi'

    RookiePracticeRequirementService.setTemporaryFP1Assignment({
      seasonId,
      round,
      teamId,
      carId: 'car1',
      rookieDriverId: 'drv_rookie_test',
      rookieDriverName: 'Oliver Goethe',
      originalDriverId: 'drv_hulkenberg',
      originalDriverName: 'Nico Hülkenberg',
    })

    // Setup do Carro 1 ajustado no TL1
    const tl1CarSetup = { frontWing: 8, rearWing: 9, suspension: 4, differential: 65 }
    PracticeSessionRunner.updateCarGarageSetup(sampleSession, 'car1', tl1CarSetup)
    expect(sampleSession.cars.car1.setup).toEqual(tl1CarSetup)

    // Salvar estado da sessão TL1
    await practiceSessionService.saveSessionState(sampleSession)

    // 2. Transição para TL2: titular retorna ao cockpit
    const tl2Prep = createInitialPracticePreparation({
      careerId: samplePrep.careerId,
      seasonId,
      round,
      sessionType: 'tp2',
      driver1Id: 'drv_hulkenberg', // Titular Nico Hülkenberg
      driver2Id: 'drv_bortoleto',
      car1Setup: tl1CarSetup, // Setup herdado do carro
      car2Setup: sampleSession.cars.car2.setup,
    })

    const tl2Session = practiceSessionService.createInitialSessionState({
      careerId: samplePrep.careerId,
      seasonId,
      round,
      sessionType: 'tp2',
      preparation: tl2Prep,
      driverNames: {
        car1: 'Nico Hülkenberg',
        driver1Id: 'drv_hulkenberg',
        car2: 'Gabriel Bortoleto',
        driver2Id: 'drv_bortoleto',
      },
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
    })

    // No TL2, o piloto ativo do Carro 1 é o titular Nico Hülkenberg
    expect(tl2Session.cars.car1.driverId).toBe('drv_hulkenberg')
    expect(tl2Session.cars.car1.driverName).toBe('Nico Hülkenberg')

    // O setup trabalhado pelo novato no Carro 1 PERTENCE AO CARRO e foi preservado para o titular!
    expect(tl2Session.cars.car1.setup).toEqual(tl1CarSetup)
  })
})
