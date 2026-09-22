// BUG-02 COMMIT B — Suíte de validação canônica de preparação dos carros na qualificação
import { describe, it, expect, beforeEach } from 'vitest'
import {
  CanonicalQualifyingRunner,
  type QualifyingTickContext,
} from '@/services/canonicalQualifyingRunner'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import type { TireSetItem } from '@/types/f1'

describe('BUG-02 COMMIT B — Suíte de Qualificação e Preparação dos Carros (BUG2-Q01..09)', () => {
  const seasonId = 'season_2026'
  const round = 1
  const teamId = 'team_audi'

  const driver1 = {
    id: 'drv_hulkenberg',
    name: 'Nico Hülkenberg',
    speed: 84,
    consistency: 85,
    defense: 80,
    teamId,
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    carNumber: 27,
  }

  const driver2 = {
    id: 'drv_bortoleto',
    name: 'Gabriel Bortoleto',
    speed: 82,
    consistency: 81,
    defense: 78,
    teamId,
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    carNumber: 5,
  }

  // 22 rivais fixos para completar os 24 do grid
  const rivalDrivers = Array.from({ length: 22 }, (_, idx) => ({
    id: `drv_rival_${idx + 1}`,
    name: `Piloto Rival ${idx + 1}`,
    speed: 78 + (idx % 6),
    consistency: 80,
    defense: 76,
    teamId: `rival_team_${idx + 1}`,
    teamName: `Equipe Rival ${idx + 1}`,
    teamColor: '#64748B',
    carNumber: idx + 10,
  }))

  const sampleContext: QualifyingTickContext = {
    seasonId,
    round,
    gpName: 'Grande Prêmio da Austrália',
    circuitName: 'Albert Park',
    lengthKm: 5.278,
    tireAbrasiveness: 6,
    weather: 'seco',
    teamChassisRating: 78,
    teamEngineSupplier: 'Audi',
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    drivers: [driver1, driver2],
    rivalDrivers,
  }

  const defaultSetup = {
    frontWing: 6,
    rearWing: 6,
    suspension: 6,
    differential: 50,
  }

  beforeEach(() => {
    localStorage.clear()
  })

  // BUG2-Q01: qualifying no longer forces 15 kg (player choice of 9/12/18 kg reaches the runner state).
  it('BUG2-Q01: qualificação não força 15 kg — escolha do jogador (9, 12, 18 kg) é respeitada no estado inicial do runner', () => {
    const qState9 = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: {
        driverId: driver1.id,
        driverName: driver1.name,
        driverNumber: 27,
        tyreSetId: 'set_soft_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 9,
        setup: defaultSetup,
      },
      playerCar2: {
        driverId: driver2.id,
        driverName: driver2.name,
        driverNumber: 5,
        tyreSetId: 'set_soft_02',
        compound: 'macio',
        wear: 0,
        fuelKg: 12,
        setup: defaultSetup,
      },
      eligibleParticipants: [driver1, driver2, ...rivalDrivers],
    })

    expect(qState9.cars.car1.fuelKg).toBe(9)
    expect(qState9.cars.car2.fuelKg).toBe(12)

    // Outro teste com 18 kg
    localStorage.clear()
    const qState18 = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: {
        driverId: driver1.id,
        driverName: driver1.name,
        driverNumber: 27,
        tyreSetId: 'set_soft_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 18,
        setup: defaultSetup,
      },
      playerCar2: {
        driverId: driver2.id,
        driverName: driver2.name,
        driverNumber: 5,
        tyreSetId: 'set_soft_02',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: defaultSetup,
      },
      eligibleParticipants: [driver1, driver2, ...rivalDrivers],
    })

    expect(qState18.cars.car1.fuelKg).toBe(18)
    expect(qState18.cars.car2.fuelKg).toBe(15)
  })

  // BUG2-Q02: player can change fuel before the run.
  it('BUG2-Q02: jogador pode alterar a carga de combustível na garagem antes da tentativa', () => {
    const qState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: {
        driverId: driver1.id,
        driverName: driver1.name,
        driverNumber: 27,
        tyreSetId: 'set_soft_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: defaultSetup,
      },
      playerCar2: {
        driverId: driver2.id,
        driverName: driver2.name,
        driverNumber: 5,
        tyreSetId: 'set_soft_02',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: defaultSetup,
      },
      eligibleParticipants: [driver1, driver2, ...rivalDrivers],
    })

    expect(qState.cars.car1.fuelKg).toBe(15)

    // Jogador ajusta o slider de combustível para 11 kg antes de sair para a pista
    const ok = CanonicalQualifyingRunner.refuelCarInGarage(qState, 'car1', 11)
    expect(ok).toBe(true)
    expect(qState.cars.car1.fuelKg).toBe(11)

    // Carro sai para a pista com os 11 kg configurados
    const exitRes = CanonicalQualifyingRunner.orderCarExitToTrack(qState, 'car1')
    expect(exitRes.success).toBe(true)
    expect(qState.cars.car1.status).toBe('out_lap')
    expect(qState.cars.car1.fuelKg).toBe(11)
  })

  // BUG2-Q03: selected fuel reaches canonicalQualifyingRunner exactly.
  it('BUG2-Q03: combustível selecionado chega ao canonicalQualifyingRunner com precisão e dita o consumo na volta rápida', () => {
    const qState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: {
        driverId: driver1.id,
        driverName: driver1.name,
        driverNumber: 27,
        tyreSetId: 'set_soft_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 13,
        setup: defaultSetup,
      },
      playerCar2: {
        driverId: driver2.id,
        driverName: driver2.name,
        driverNumber: 5,
        tyreSetId: 'set_soft_02',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: defaultSetup,
      },
      eligibleParticipants: [driver1, driver2, ...rivalDrivers],
    })

    expect(qState.cars.car1.fuelKg).toBe(13)
    qState.status = 'running'
    CanonicalQualifyingRunner.orderCarExitToTrack(qState, 'car1')

    // Conclui out lap (avanço até 100%)
    qState.cars.car1.currentLapProgressPct = 100
    const tick1 = CanonicalQualifyingRunner.tick(qState, 1, sampleContext)
    expect(tick1.nextState.cars.car1.status).toBe('flying_lap')

    // Conclui flying lap
    tick1.nextState.cars.car1.currentLapProgressPct = 100
    const tick2 = CanonicalQualifyingRunner.tick(tick1.nextState, 1, sampleContext)

    // O combustível decresceu a partir de exatamente 13 kg
    expect(tick2.nextState.cars.car1.fuelKg).toBeLessThan(13)
    expect(tick2.nextState.cars.car1.fuelKg).toBeGreaterThan(10)
    // O lapRecord gravou o fuelRemainingKg consumido a partir de 13 kg
    const history = tick2.nextState.lapHistory[driver1.id]
    expect(history).toBeDefined()
    expect(history.length).toBe(1)
    expect(history[0].fuelRemainingKg).toBe(tick2.nextState.cars.car1.fuelKg)
  })

  // BUG2-Q04: insufficient fuel generates explicit validation (validateQualifyingFuel).
  it('BUG2-Q04: combustível insuficiente gera validação explícita impedindo a liberação do carro', () => {
    // 1. Validação unitária de validateQualifyingFuel
    const invalidCheck = CanonicalQualifyingRunner.validateQualifyingFuel(2)
    expect(invalidCheck.valid).toBe(false)
    expect(invalidCheck.warning).toContain('COMBUSTÍVEL INSUFICIENTE')

    const validCheck = CanonicalQualifyingRunner.validateQualifyingFuel(6)
    expect(validCheck.valid).toBe(true)

    // 2. Validação integrada ao tentar liberar para a pista com < 4 kg
    const qState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: {
        driverId: driver1.id,
        driverName: driver1.name,
        driverNumber: 27,
        tyreSetId: 'set_soft_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 3,
        setup: defaultSetup,
      },
      playerCar2: {
        driverId: driver2.id,
        driverName: driver2.name,
        driverNumber: 5,
        tyreSetId: 'set_soft_02',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: defaultSetup,
      },
      eligibleParticipants: [driver1, driver2, ...rivalDrivers],
    })

    const exitAttempt = CanonicalQualifyingRunner.orderCarExitToTrack(qState, 'car1')
    expect(exitAttempt.success).toBe(false)
    expect(exitAttempt.error).toContain('COMBUSTÍVEL INSUFICIENTE')
    // Carro permanece retido na garagem
    expect(qState.cars.car1.status).toBe('garage')
  })

  // BUG2-Q05: specific tyre set selectable from persistent inventory.
  it('BUG2-Q05: jogo específico de pneus é selecionável a partir do inventário persistente do fim de semana', () => {
    // Monta inventário persistente com 20 jogos para o piloto 1
    const invHulk: TireSetItem[] = [
      {
        id: `${seasonId}_${driver1.id}_s1`,
        compound: 'macio',
        wear: 0,
        lapsUsed: 0,
        isFitted: true,
        status: 'instalado',
        driverId: driver1.id,
      },
      {
        id: `${seasonId}_${driver1.id}_s4_target`,
        compound: 'macio',
        wear: 0,
        lapsUsed: 0,
        isFitted: false,
        status: 'disponivel',
        driverId: driver1.id,
      },
    ]

    canonicalWeekendTyrePersistence.updateDriverInventory(seasonId, round, driver1.id, invHulk)

    const qState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: {
        driverId: driver1.id,
        driverName: driver1.name,
        driverNumber: 27,
        tyreSetId: invHulk[0].id,
        compound: 'macio',
        wear: 0,
        fuelKg: 12,
        setup: defaultSetup,
      },
      playerCar2: {
        driverId: driver2.id,
        driverName: driver2.name,
        driverNumber: 5,
        tyreSetId: 'set_soft_c2',
        compound: 'macio',
        wear: 0,
        fuelKg: 12,
        setup: defaultSetup,
      },
      eligibleParticipants: [driver1, driver2, ...rivalDrivers],
    })

    // Jogador escolhe explicitamente o jogo 4
    const selectedSet = invHulk[1]
    const fitOk = CanonicalQualifyingRunner.fitTyreSetInGarage(qState, 'car1', {
      id: selectedSet.id,
      compound: selectedSet.compound,
      wear: selectedSet.wear,
    })

    expect(fitOk).toBe(true)
    expect(qState.cars.car1.currentTyreSetId).toBe(`${seasonId}_${driver1.id}_s4_target`)
  })

  // BUG2-Q06: chosen set identity (e.g. Soft #4) reaches the car — not "any available Soft".
  it('BUG2-Q06: identidade do jogo escolhido (Soft #4 com id específico) chega ao carro e é registrada no stint', () => {
    const qState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: {
        driverId: driver1.id,
        driverName: driver1.name,
        driverNumber: 27,
        tyreSetId: 'set_soft_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 12,
        setup: defaultSetup,
      },
      playerCar2: {
        driverId: driver2.id,
        driverName: driver2.name,
        driverNumber: 5,
        tyreSetId: 'set_soft_c2',
        compound: 'macio',
        wear: 0,
        fuelKg: 12,
        setup: defaultSetup,
      },
      eligibleParticipants: [driver1, driver2, ...rivalDrivers],
    })

    const specificTyreId = 'set_soft_04_audi_exclusive'
    CanonicalQualifyingRunner.fitTyreSetInGarage(qState, 'car1', {
      id: specificTyreId,
      compound: 'macio',
      wear: 10,
    })

    expect(qState.cars.car1.currentTyreSetId).toBe(specificTyreId)
    expect(qState.cars.car1.tyreWear).toBe(10)

    qState.status = 'running'
    CanonicalQualifyingRunner.orderCarExitToTrack(qState, 'car1')

    // Volta rápida concluída
    qState.cars.car1.currentLapProgressPct = 100
    const t1 = CanonicalQualifyingRunner.tick(qState, 1, sampleContext)
    t1.nextState.cars.car1.currentLapProgressPct = 100
    const t2 = CanonicalQualifyingRunner.tick(t1.nextState, 1, sampleContext)

    // O histórico e a tabela preservam a identidade exata do jogo montado
    const lap = t2.nextState.lapHistory[driver1.id][0]
    expect(lap.tyreSetId).toBe(specificTyreId)
    expect(t2.nextState.cars.car1.bestLapTyreSetId).toBe(specificTyreId)

    const lbEntry = t2.nextState.leaderboard.find((e) => e.driverId === driver1.id)
    expect(lbEntry?.tyreSetId).toBe(specificTyreId)
  })

  // BUG2-Q07: Carro 1 and Carro 2 use independent configurations.
  it('BUG2-Q07: Carro 1 e Carro 2 utilizam configurações completamente independentes (combustível, pneus e setups isolados)', () => {
    const setupC1 = { frontWing: 8, rearWing: 9, suspension: 4, differential: 65 }
    const setupC2 = { frontWing: 3, rearWing: 4, suspension: 8, differential: 40 }

    const qState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: {
        driverId: driver1.id,
        driverName: driver1.name,
        driverNumber: 27,
        tyreSetId: 'set_soft_c1',
        compound: 'macio',
        wear: 5,
        fuelKg: 10,
        setup: setupC1,
      },
      playerCar2: {
        driverId: driver2.id,
        driverName: driver2.name,
        driverNumber: 5,
        tyreSetId: 'set_medium_c2',
        compound: 'medio',
        wear: 15,
        fuelKg: 18,
        setup: setupC2,
      },
      eligibleParticipants: [driver1, driver2, ...rivalDrivers],
    })

    // Verificação de isolamento inicial
    expect(qState.cars.car1.fuelKg).toBe(10)
    expect(qState.cars.car1.currentCompound).toBe('macio')
    expect(qState.cars.car1.setup).toEqual(setupC1)

    expect(qState.cars.car2.fuelKg).toBe(18)
    expect(qState.cars.car2.currentCompound).toBe('medio')
    expect(qState.cars.car2.setup).toEqual(setupC2)

    // Alteração independente no Carro 1
    CanonicalQualifyingRunner.refuelCarInGarage(qState, 'car1', 8)
    expect(qState.cars.car1.fuelKg).toBe(8)
    expect(qState.cars.car2.fuelKg).toBe(18) // Carro 2 intacto

    // Liberar apenas Carro 1
    CanonicalQualifyingRunner.orderCarExitToTrack(qState, 'car1')
    expect(qState.cars.car1.status).toBe('out_lap')
    expect(qState.cars.car2.status).toBe('garage')
  })

  // BUG2-Q08: Parc Fermé blocks forbidden alteration AND surfaces the explicit reason.
  it('BUG2-Q08: regime de Parc Fermé bloqueia alteração mecânica e explicita o motivo regulamentar', () => {
    const qState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: {
        driverId: driver1.id,
        driverName: driver1.name,
        driverNumber: 27,
        tyreSetId: 'set_soft_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 12,
        setup: defaultSetup,
      },
      playerCar2: {
        driverId: driver2.id,
        driverName: driver2.name,
        driverNumber: 5,
        tyreSetId: 'set_soft_02',
        compound: 'macio',
        wear: 0,
        fuelKg: 12,
        setup: defaultSetup,
      },
      eligibleParticipants: [driver1, driver2, ...rivalDrivers],
    })

    // 1. Antes do regime de Parc Fermé ativo, setup editável conforme regra canônica
    expect(qState.parcFermeActive).toBe(false)
    const editableAttempt = CanonicalQualifyingRunner.updateCarGarageSetup(
      qState,
      'car1',
      { frontWing: 8 },
      { parcFermeActive: false },
    )
    expect(editableAttempt.success).toBe(true)
    expect(qState.cars.car1.setup.frontWing).toBe(8)

    // 2. Regime de Parc Fermé ativado via serviço canônico
    canonicalQualifyingPersistenceService.setParcFermeActive(seasonId, round, true)
    expect(canonicalQualifyingPersistenceService.isParcFermeActive(seasonId, round)).toBe(true)

    // Tentativa de alterar asas sob regime de Parc Fermé
    const attempt = CanonicalQualifyingRunner.updateCarGarageSetup(
      qState,
      'car1',
      { frontWing: 10 },
      { parcFermeActive: true },
    )

    expect(attempt.success).toBe(false)
    expect(attempt.error).toContain('PARC FERMÉ')
    expect(attempt.error).toContain(
      'Este ajuste não pode mais ser alterado após o início do regime de Parc Fermé',
    )
    // O setup do carro permanece inalterado com o valor anterior
    expect(qState.cars.car1.setup.frontWing).toBe(8)
  })

  // BUG2-Q09: inventory and wear persist Q1→Q2→Q3 (no reset to 100%).
  it('BUG2-Q09: estoque de pneus e desgaste persistem entre as fases Q1 → Q2 → Q3 sem reset', () => {
    const driverId = driver1.id
    const tyreSetId = `${seasonId}_${driverId}_soft_race_qual`

    // 1. Inicializa estoque oficial com o pneu novo (0% desgaste)
    const initialInventory: TireSetItem[] = [
      {
        id: tyreSetId,
        compound: 'macio',
        wear: 0,
        lapsUsed: 0,
        isFitted: true,
        status: 'instalado',
        driverId,
      },
    ]
    canonicalWeekendTyrePersistence.updateDriverInventory(
      seasonId,
      round,
      driverId,
      initialInventory,
    )

    // 2. Q1: Carro roda 2 voltas no pneu, acumulando desgaste
    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId,
      tyreSetId,
      lapsAdded: 2,
      finalWearPct: 18,
    })

    const storedQ1 = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)
    const invAfterQ1 = storedQ1?.inventoriesByDriver[driverId] || []
    const setAfterQ1 = invAfterQ1.find((t) => t.id === tyreSetId)
    expect(setAfterQ1?.wear).toBe(18)
    expect(setAfterQ1?.lapsUsed).toBe(2)

    // 3. Inicialização de Q2 herdando o mesmo pneu
    const q2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q2',
      seasonId,
      round,
      playerCar1: {
        driverId,
        driverName: driver1.name,
        driverNumber: 27,
        tyreSetId,
        compound: 'macio',
        wear: setAfterQ1!.wear,
        fuelKg: 12,
        setup: defaultSetup,
      },
      playerCar2: {
        driverId: driver2.id,
        driverName: driver2.name,
        driverNumber: 5,
        tyreSetId: 'set_c2_q2',
        compound: 'macio',
        wear: 0,
        fuelKg: 12,
        setup: defaultSetup,
      },
      eligibleParticipants: [driver1, driver2, ...rivalDrivers.slice(0, 16)],
    })

    // No Q2, o pneu inicia com exatamente 18% de desgaste (NÃO resetado para 0% nem 100% de integridade)
    expect(q2State.cars.car1.tyreWear).toBe(18)

    // 4. Q2: Carro roda mais voltas e desgaste atinge 36%
    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId,
      tyreSetId,
      lapsAdded: 2,
      finalWearPct: 36,
    })

    const storedQ2 = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)
    const invAfterQ2 = storedQ2?.inventoriesByDriver[driverId] || []
    const setAfterQ2 = invAfterQ2.find((t) => t.id === tyreSetId)
    expect(setAfterQ2?.wear).toBe(36)
    expect(setAfterQ2?.lapsUsed).toBe(4)

    // 5. Inicialização de Q3 herdando o pneu
    const q3State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q3',
      seasonId,
      round,
      playerCar1: {
        driverId,
        driverName: driver1.name,
        driverNumber: 27,
        tyreSetId,
        compound: 'macio',
        wear: setAfterQ2!.wear,
        fuelKg: 12,
        setup: defaultSetup,
      },
      playerCar2: {
        driverId: driver2.id,
        driverName: driver2.name,
        driverNumber: 5,
        tyreSetId: 'set_c2_q3',
        compound: 'macio',
        wear: 0,
        fuelKg: 12,
        setup: defaultSetup,
      },
      eligibleParticipants: [driver1, driver2, ...rivalDrivers.slice(0, 8)],
    })

    // No Q3, o pneu começa em 36%
    expect(q3State.cars.car1.tyreWear).toBe(36)
  })

  describe('Auditorias Obrigatórias do Commit B (Qualificação)', () => {
    it('Auditoria 1: Selecionar 12 kg -> runner recebe 12 kg (sem coerção para 15 kg)', () => {
      const qState = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: {
          driverId: driver1.id,
          driverName: driver1.name,
          driverNumber: 27,
          tyreSetId: 'set_soft_01',
          compound: 'macio',
          wear: 0,
          fuelKg: 12,
          setup: defaultSetup,
        },
        playerCar2: {
          driverId: driver2.id,
          driverName: driver2.name,
          driverNumber: 5,
          tyreSetId: 'set_soft_02',
          compound: 'macio',
          wear: 0,
          fuelKg: 17,
          setup: defaultSetup,
        },
        eligibleParticipants: [driver1, driver2, ...rivalDrivers],
      })

      expect(qState.cars.car1.fuelKg).toBe(12)
      expect(qState.cars.car2.fuelKg).toBe(17)

      // Teste adicional: alteração para 10 kg
      CanonicalQualifyingRunner.refuelCarInGarage(qState, 'car1', 10)
      expect(qState.cars.car1.fuelKg).toBe(10)
    })

    it('Auditoria 2: Tyre set real: setId específico preservado no runner e registrado no stint', () => {
      const specificSetId = 'set_soft_audi_exclusive_09'
      const qState = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: {
          driverId: driver1.id,
          driverName: driver1.name,
          driverNumber: 27,
          tyreSetId: specificSetId,
          compound: 'macio',
          wear: 5,
          fuelKg: 12,
          setup: defaultSetup,
        },
        playerCar2: {
          driverId: driver2.id,
          driverName: driver2.name,
          driverNumber: 5,
          tyreSetId: 'set_soft_02',
          compound: 'macio',
          wear: 0,
          fuelKg: 15,
          setup: defaultSetup,
        },
        eligibleParticipants: [driver1, driver2, ...rivalDrivers],
      })

      expect(qState.cars.car1.currentTyreSetId).toBe(specificSetId)
    })

    it('Auditoria 3: Parc Fermé: antes do regime, setup editável; depois, bloqueado com motivo canônico', () => {
      const qState = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q1',
        seasonId,
        round,
        playerCar1: {
          driverId: driver1.id,
          driverName: driver1.name,
          driverNumber: 27,
          tyreSetId: 'set_soft_01',
          compound: 'macio',
          wear: 0,
          fuelKg: 12,
          setup: defaultSetup,
        },
        playerCar2: {
          driverId: driver2.id,
          driverName: driver2.name,
          driverNumber: 5,
          tyreSetId: 'set_soft_02',
          compound: 'macio',
          wear: 0,
          fuelKg: 15,
          setup: defaultSetup,
        },
        eligibleParticipants: [driver1, driver2, ...rivalDrivers],
      })

      // Antes do regime
      expect(canonicalQualifyingPersistenceService.isParcFermeActive(seasonId, round)).toBe(false)
      const okBefore = CanonicalQualifyingRunner.updateCarGarageSetup(
        qState,
        'car1',
        { frontWing: 9 },
        { parcFermeActive: false },
      )
      expect(okBefore.success).toBe(true)
      expect(qState.cars.car1.setup.frontWing).toBe(9)

      // Ativar regime
      canonicalQualifyingPersistenceService.setParcFermeActive(seasonId, round, true)
      expect(canonicalQualifyingPersistenceService.isParcFermeActive(seasonId, round)).toBe(true)

      const blockedAfter = CanonicalQualifyingRunner.updateCarGarageSetup(
        qState,
        'car1',
        { frontWing: 10 },
        { parcFermeActive: true },
      )
      expect(blockedAfter.success).toBe(false)
      expect(blockedAfter.error).toContain('PARC FERMÉ')
      expect(qState.cars.car1.setup.frontWing).toBe(9)

      // Parc Fermé não impede troca de pneu nem combustível
      const refuelOk = CanonicalQualifyingRunner.refuelCarInGarage(qState, 'car1', 14)
      expect(refuelOk).toBe(true)
      expect(qState.cars.car1.fuelKg).toBe(14)
    })

    it('Auditoria 4: Q1->Q2->Q3 carros eliminados mantêm status esportivo de eliminação', () => {
      const qState = CanonicalQualifyingRunner.initializeStage({
        stageId: 'q2',
        seasonId,
        round,
        playerCar1: {
          driverId: driver1.id,
          driverName: driver1.name,
          driverNumber: 27,
          tyreSetId: 'set_soft_01',
          compound: 'macio',
          wear: 0,
          fuelKg: 12,
          setup: defaultSetup,
        },
        playerCar2: {
          driverId: driver2.id,
          driverName: driver2.name,
          driverNumber: 5,
          tyreSetId: 'set_soft_02',
          compound: 'macio',
          wear: 0,
          fuelKg: 15,
          setup: defaultSetup,
        },
        // Apenas driver1 é elegível para o Q2 (driver2 foi eliminado no Q1)
        eligibleParticipants: [driver1, ...rivalDrivers.slice(0, 17)],
      })

      expect(qState.cars.car1.isEliminated).toBe(false)
      expect(qState.cars.car1.status).toBe('garage')

      expect(qState.cars.car2.isEliminated).toBe(true)
      expect(qState.cars.car2.status).toBe('eliminated')

      // Tentativa de liberação do carro 2 eliminado deve falhar
      const exitRes = CanonicalQualifyingRunner.orderCarExitToTrack(qState, 'car2')
      expect(exitRes.success).toBe(false)
      expect(exitRes.error).toContain('eliminado')
    })
  })
})
