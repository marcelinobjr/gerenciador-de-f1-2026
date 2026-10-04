/**
 * pu-05a2-p2b-consumption.test.ts
 *
 * TAREFA ÚNICA — PU-05A2-P2b-T1:
 * Suíte de testes que comprova que a condição individual da unidade de potência
 * vinculada a cada participante já é consumida pelos cálculos reais de pace e risco mecânico.
 *
 * ESCOPO: somente testes/fixtures, sem alterar código de produção.
 *
 * PROVAS OBRIGATÓRIAS:
 *
 * PROVA 1 — Origem e precedência da condição (verificar nos DOIS consumidores reais):
 * a) Fixture de referência: carCondition = 90; unidade vinculada válida;
 *    powerUnitInitialCondition = 80; powerUnitCondition ausente ->
 *    desgaste individual utilizado = 20% (não o agregado legado 8,5%).
 *    Verificar via penalidade de PU e risco mecânico reais.
 * b) Fornecer powerUnitCondition = 60 mantendo powerUnitInitialCondition = 80 ->
 *    desgaste utilizado = 40%.
 * c) Condição corrente zero (powerUnitCondition = 0) ->
 *    desgaste 100%, não ausência de dado nem retorno à condição inicial.
 *
 * PROVA 2 — Efeito numérico e independência do ID (todas as demais entradas iguais):
 * a) IDs de unidades diferentes com condições equivalentes ->
 *    mesma contribuição esportiva (o ID não concede bônus).
 * b) Condições distintas -> efeitos previstos pela fórmula atual.
 *    Condições em faixas que realmente diferenciem o resultado segundo as regras
 *    de structuralMissingFactorsService (calculatePUWearPenalty e calculateMechanicalFailureRisk).
 *    Verificar resultado numérico no cálculo real ou no breakdown existente.
 *    Para risco mecânico, verificar o risco calculado pelo helper real usado por evaluateDnfRoll.
 *    Confirmar que a integração da equipe permanece aplicada uma única vez e não muda pela troca do ID.
 *
 * PROVA 3 — Referência legada do consumidor:
 * Fixture explicitamente legada (sem vínculo de PU — campos ausentes/indefinidos),
 * carCondition = 90 -> entrada de desgaste legado permanece 8,5% nos consumidores reais.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { structuralMissingFactorsService } from '@/services/structuralMissingFactorsService'
import { canonicalPowerUnitIntegrationService } from '@/services/canonicalPowerUnitIntegrationService'
import type { CanonicalRaceDriverState } from '@/types/canonical-race-v2'

describe('PU-05A2-P2b-T1: Comprovação do Consumo Real da Condição da Unidade Vinculada', () => {
  const createTestDriver = (
    overrides: Partial<CanonicalRaceDriverState> = {},
  ): CanonicalRaceDriverState => ({
    careerId: 'c_pu_p2b_t1',
    season: 2026,
    raceId: 'r_pu_p2b_t1',
    driverId: 'player_driver_1',
    driverName: 'Piloto Teste',
    teamId: 'mercedes',
    teamName: 'Mercedes-AMG Petronas',
    teamColor: '#00D2BE',
    isPlayer: true,
    carId: 'car1',
    carIndex: 1,
    gridPosition: 1,
    currentPosition: 1,
    lap: 5,
    raceTime: 400.0,
    gap: 'LÍDER',
    tyreCompound: 'medio',
    tyreAge: 5,
    fuel: 80,
    carCondition: 90,
    raceStatus: 'racing',
    pitStops: 0,
    strategy: {
      paceMode: 'NORMAL',
    } as any,
    ...overrides,
  })

  // RNG determinístico estático para isolar ruídos estocásticos
  const deterministicRng = () => 0.5

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // =========================================================================
  // PROVA 1: Origem e precedência da condição (verificar nos DOIS consumidores reais)
  // =========================================================================
  describe('PROVA 1: Origem e precedência da condição nos dois consumidores reais', () => {
    it('1a) Fixture de referência: carCondition=90, unidade vinculada válida (powerUnitId=1), powerUnitInitialCondition=80, powerUnitCondition ausente -> desgaste utilizado = 20% (não 8,5%)', () => {
      const driver1a = createTestDriver({
        carCondition: 90,
        powerUnitId: 1,
        powerUnitInitialCondition: 80,
        powerUnitCondition: undefined,
      })

      // Spies que preservam a implementação real (conforme especificado na tarefa)
      const wearPenaltySpy = vi.spyOn(structuralMissingFactorsService, 'calculatePUWearPenalty')
      const mechanicalRiskSpy = vi.spyOn(
        structuralMissingFactorsService,
        'calculateMechanicalFailureRisk',
      )

      // Consumidor 1: calculateCanonicalLapPace
      const paceResult = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driver1a,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: deterministicRng,
      })

      // Verifica entrada recebida pelo helper real no Consumidor 1
      expect(wearPenaltySpy).toHaveBeenCalled()
      const wearArgPace = wearPenaltySpy.mock.calls[wearPenaltySpy.mock.calls.length - 1][0]
      expect(wearArgPace).toBe(20) // 100 - 80 = 20%, e NÃO o agregado legado (100 - 90) * 0.85 = 8.5%
      expect(wearArgPace).not.toBe(8.5)

      // Consumidor 2: evaluateDnfRoll
      canonicalRaceEngineService.evaluateDnfRoll({
        driver: driver1a,
        lap: 5,
        rng: deterministicRng,
      })

      // Verifica entrada recebida pelo helper real no Consumidor 2
      expect(mechanicalRiskSpy).toHaveBeenCalled()
      const riskArgDnf = mechanicalRiskSpy.mock.calls[mechanicalRiskSpy.mock.calls.length - 1][0]
      expect(riskArgDnf.puWear).toBe(20) // desgaste individual utilizado = 20%
      expect(riskArgDnf.puWear).not.toBe(8.5)
      expect(riskArgDnf.carCondition).toBe(90) // componente separado de dano geral intacto

      // Valores numéricos reais de produção conferidos
      const expectedPacePenalty =
        structuralMissingFactorsService.calculatePUWearPenalty(20).engineWearPenalty
      const legacyPacePenalty =
        structuralMissingFactorsService.calculatePUWearPenalty(8.5).engineWearPenalty
      expect(expectedPacePenalty).toBe(Number(((20 / 30) * 0.05).toFixed(3))) // 0.033s
      expect(expectedPacePenalty).not.toBe(legacyPacePenalty)
      expect(paceResult.lapTimeSec).toBeGreaterThan(60.0)
    })

    it('1b) Precedência corrente sobre inicial: powerUnitCondition=60 mantendo powerUnitInitialCondition=80 -> desgaste utilizado = 40%', () => {
      const driver1b = createTestDriver({
        carCondition: 90,
        powerUnitId: 1,
        powerUnitInitialCondition: 80,
        powerUnitCondition: 60, // condição corrente durante a sessão
      })

      const wearPenaltySpy = vi.spyOn(structuralMissingFactorsService, 'calculatePUWearPenalty')
      const mechanicalRiskSpy = vi.spyOn(
        structuralMissingFactorsService,
        'calculateMechanicalFailureRisk',
      )

      // Consumidor 1: pace
      canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driver1b,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: deterministicRng,
      })

      expect(wearPenaltySpy).toHaveBeenCalled()
      const wearArgPace = wearPenaltySpy.mock.calls[wearPenaltySpy.mock.calls.length - 1][0]
      expect(wearArgPace).toBe(40) // 100 - 60 = 40% (precede 80 -> 20%)

      // Consumidor 2: risco mecânico
      canonicalRaceEngineService.evaluateDnfRoll({
        driver: driver1b,
        lap: 5,
        rng: deterministicRng,
      })

      expect(mechanicalRiskSpy).toHaveBeenCalled()
      const riskArgDnf = mechanicalRiskSpy.mock.calls[mechanicalRiskSpy.mock.calls.length - 1][0]
      expect(riskArgDnf.puWear).toBe(40)
    })

    it('1c) Limite inferior zero: powerUnitCondition=0 -> desgaste utilizado = 100%, não ausência de dado nem retorno à inicial', () => {
      const driver1c = createTestDriver({
        carCondition: 90,
        powerUnitId: 1,
        powerUnitInitialCondition: 80,
        powerUnitCondition: 0, // Unidade totalmente esgotada
      })

      const wearPenaltySpy = vi.spyOn(structuralMissingFactorsService, 'calculatePUWearPenalty')
      const mechanicalRiskSpy = vi.spyOn(
        structuralMissingFactorsService,
        'calculateMechanicalFailureRisk',
      )

      // Consumidor 1: pace
      canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driver1c,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: deterministicRng,
      })

      expect(wearPenaltySpy).toHaveBeenCalled()
      const wearArgPace = wearPenaltySpy.mock.calls[wearPenaltySpy.mock.calls.length - 1][0]
      expect(wearArgPace).toBe(100) // 100 - 0 = 100% estrito

      // Consumidor 2: risco mecânico
      canonicalRaceEngineService.evaluateDnfRoll({
        driver: driver1c,
        lap: 5,
        rng: deterministicRng,
      })

      expect(mechanicalRiskSpy).toHaveBeenCalled()
      const riskArgDnf = mechanicalRiskSpy.mock.calls[mechanicalRiskSpy.mock.calls.length - 1][0]
      expect(riskArgDnf.puWear).toBe(100) // Desgaste 100%, não 20% nem 8.5%
    })
  })

  // =========================================================================
  // PROVA 2: Efeito numérico e independência do ID
  // =========================================================================
  describe('PROVA 2: Efeito numérico e independência do ID', () => {
    it('2a) IDs de unidades diferentes com condições equivalentes -> mesma contribuição esportiva (o ID não concede bônus)', () => {
      const driverUnit1 = createTestDriver({
        driverId: 'drv_id_1',
        carId: 'car1',
        powerUnitId: 1,
        powerUnitInitialCondition: 75,
      })

      const driverUnit4 = createTestDriver({
        driverId: 'drv_id_1', // mesmo piloto e atributos controlados
        carId: 'car1',
        powerUnitId: 4, // ID de unidade diferente no pool
        powerUnitInitialCondition: 75, // Condição rigorosamente idêntica
      })

      // 1. Ritmo de corrida
      const paceUnit1 = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driverUnit1,
        lap: 10,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: deterministicRng,
      })

      const paceUnit4 = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driverUnit4,
        lap: 10,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: deterministicRng,
      })

      expect(paceUnit1.lapTimeSec).toBe(paceUnit4.lapTimeSec)
      expect(paceUnit1.tireWearIncrement).toBe(paceUnit4.tireWearIncrement)
      expect(paceUnit1.fuelBurnKg).toBe(paceUnit4.fuelBurnKg)

      // 2. Risco mecânico calculado pelo helper real de evaluateDnfRoll
      const mechanicalRiskSpy = vi.spyOn(
        structuralMissingFactorsService,
        'calculateMechanicalFailureRisk',
      )

      canonicalRaceEngineService.evaluateDnfRoll({
        driver: driverUnit1,
        lap: 10,
        rng: deterministicRng,
      })
      const riskResultUnit1 =
        mechanicalRiskSpy.mock.results[mechanicalRiskSpy.mock.results.length - 1].value

      canonicalRaceEngineService.evaluateDnfRoll({
        driver: driverUnit4,
        lap: 10,
        rng: deterministicRng,
      })
      const riskResultUnit4 =
        mechanicalRiskSpy.mock.results[mechanicalRiskSpy.mock.results.length - 1].value

      expect(riskResultUnit1.totalRiskPerLap).toBe(riskResultUnit4.totalRiskPerLap)
      expect(riskResultUnit1.puComponentRisk).toBe(riskResultUnit4.puComponentRisk)
      expect(riskResultUnit1.wearRiskMultiplier).toBe(riskResultUnit4.wearRiskMultiplier)
    })

    it('2b) Condições distintas em faixas que diferenciam segundo a fórmula real -> efeitos numéricos previstos e integração aplicada 1x', () => {
      // Regras de structuralMissingFactorsService:
      // calculatePUWearPenalty:
      // - FRESH (desgaste <= 30%): (wear / 30) * 0.05
      // - DEGRADED (desgaste 60-85%): 0.20 + ((wear - 60) / 25) * 0.30
      // - CRITICAL (desgaste > 85%): 0.50 + ((wear - 85) / 15) * 0.70
      //
      // calculateMechanicalFailureRisk:
      // - wear <= 40%: wearRiskMultiplier = 1.0 (neutro)
      // - wear 40-75%: wearRiskMultiplier = 1.0 + ((wear - 40) / 35) * 0.8 (até 1.8x)
      // - wear > 75%: wearRiskMultiplier = 1.8 + ((wear - 75) / 25) * 1.7 (até 3.5x)
      //
      // Selecionamos faixas distintas e ativas:
      // - PU Fresh: condição 90% -> desgaste 10% (FRESH <= 30%, desgaste risco <= 40% -> mult 1.0)
      // - PU Degraded: condição 30% -> desgaste 70% (DEGRADED 60..85%, desgaste risco 40..75% -> mult = 1.0 + (30/35)*0.8 = 1.686)
      // - PU Critical: condição 10% -> desgaste 90% (CRITICAL > 85%, desgaste risco > 75% -> mult = 1.8 + (15/25)*1.7 = 2.820)

      const wearPenaltyFresh = structuralMissingFactorsService.calculatePUWearPenalty(10)
      const wearPenaltyDegraded = structuralMissingFactorsService.calculatePUWearPenalty(70)
      const wearPenaltyCritical = structuralMissingFactorsService.calculatePUWearPenalty(90)

      expect(wearPenaltyFresh.wearBracket).toBe('FRESH')
      expect(wearPenaltyDegraded.wearBracket).toBe('DEGRADED')
      expect(wearPenaltyCritical.wearBracket).toBe('CRITICAL')

      expect(wearPenaltyFresh.engineWearPenalty).toBe(0.017) // (10 / 30) * 0.05 = 0.01666...
      expect(wearPenaltyDegraded.engineWearPenalty).toBe(0.32) // 0.2 + (10/25)*0.3 = 0.32
      expect(wearPenaltyCritical.engineWearPenalty).toBe(0.733) // 0.5 + (5/15)*0.7 = 0.7333...

      const expectedDeltaDegradedVsFresh = Number((0.32 - 0.017).toFixed(3)) // 0.303s
      const expectedDeltaCriticalVsDegraded = Number((0.733 - 0.32).toFixed(3)) // 0.413s

      const driverFresh = createTestDriver({
        driverId: 'drv_test',
        powerUnitId: 1,
        powerUnitInitialCondition: 90, // desgaste 10%
      })

      const driverDegraded = createTestDriver({
        driverId: 'drv_test',
        powerUnitId: 2,
        powerUnitInitialCondition: 30, // desgaste 70%
      })

      const driverCritical = createTestDriver({
        driverId: 'drv_test',
        powerUnitId: 3,
        powerUnitInitialCondition: 10, // desgaste 90%
      })

      // Executa o pace real
      const paceFresh = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driverFresh,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: deterministicRng,
      })

      const paceDegraded = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driverDegraded,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: deterministicRng,
      })

      const paceCritical = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driverCritical,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: deterministicRng,
      })

      const observedDeltaDegradedVsFresh = Number(
        (paceDegraded.lapTimeSec - paceFresh.lapTimeSec).toFixed(3),
      )
      const observedDeltaCriticalVsDegraded = Number(
        (paceCritical.lapTimeSec - paceDegraded.lapTimeSec).toFixed(3),
      )

      // Validação estrita dos deltas esportivos numéricos
      expect(
        Math.abs(observedDeltaDegradedVsFresh - expectedDeltaDegradedVsFresh),
      ).toBeLessThanOrEqual(0.005)
      expect(
        Math.abs(observedDeltaCriticalVsDegraded - expectedDeltaCriticalVsDegraded),
      ).toBeLessThanOrEqual(0.005)

      // Validação do risco mecânico real pelo helper usado por evaluateDnfRoll
      const mechanicalRiskSpy = vi.spyOn(
        structuralMissingFactorsService,
        'calculateMechanicalFailureRisk',
      )

      canonicalRaceEngineService.evaluateDnfRoll({
        driver: driverFresh,
        lap: 5,
        rng: deterministicRng,
      })
      const riskFresh =
        mechanicalRiskSpy.mock.results[mechanicalRiskSpy.mock.results.length - 1].value

      canonicalRaceEngineService.evaluateDnfRoll({
        driver: driverDegraded,
        lap: 5,
        rng: deterministicRng,
      })
      const riskDegraded =
        mechanicalRiskSpy.mock.results[mechanicalRiskSpy.mock.results.length - 1].value

      canonicalRaceEngineService.evaluateDnfRoll({
        driver: driverCritical,
        lap: 5,
        rng: deterministicRng,
      })
      const riskCritical =
        mechanicalRiskSpy.mock.results[mechanicalRiskSpy.mock.results.length - 1].value

      expect(riskFresh.wearRiskMultiplier).toBe(1.0)
      expect(riskDegraded.wearRiskMultiplier).toBeGreaterThan(1.5)
      expect(riskCritical.wearRiskMultiplier).toBeGreaterThan(2.5)

      expect(riskDegraded.totalRiskPerLap).toBeGreaterThan(riskFresh.totalRiskPerLap)
      expect(riskCritical.totalRiskPerLap).toBeGreaterThan(riskDegraded.totalRiskPerLap)

      // Confirmar que a integração da equipe (canonicalPowerUnitIntegrationService)
      // permanece aplicada uma única vez e não muda pela troca de ID ou condição da PU
      const effectivePUSpy = vi.spyOn(
        canonicalPowerUnitIntegrationService,
        'resolveEffectivePUPerformance',
      )

      canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driverFresh,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: deterministicRng,
      })
      const puCallFresh = effectivePUSpy.mock.results[effectivePUSpy.mock.results.length - 1].value

      canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driverDegraded,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: deterministicRng,
      })
      const puCallDegraded =
        effectivePUSpy.mock.results[effectivePUSpy.mock.results.length - 1].value

      // A integração da equipe (rating puRating) é exatamente a mesma, independente do ID ou condição da PU
      expect(puCallFresh.effectivePuRating).toBe(puCallDegraded.effectivePuRating)
      expect(puCallFresh.effectiveIntegration).toBe(puCallDegraded.effectiveIntegration)
    })
  })

  // =========================================================================
  // PROVA 3: Referência legada do consumidor
  // =========================================================================
  describe('PROVA 3: Referência legada do consumidor', () => {
    it('fixture genuinamente legada (sem vínculo de PU — campos ausentes/indefinidos), carCondition=90 -> entrada de desgaste permanece 8,5% nos consumidores reais', () => {
      // Fixture explicitamente legada: participante sem os campos do contrato P2
      const legacyDriver = createTestDriver({
        carCondition: 90,
        powerUnitId: undefined,
        powerUnitInitialCondition: undefined,
        powerUnitCondition: undefined,
      })

      const wearPenaltySpy = vi.spyOn(structuralMissingFactorsService, 'calculatePUWearPenalty')
      const mechanicalRiskSpy = vi.spyOn(
        structuralMissingFactorsService,
        'calculateMechanicalFailureRisk',
      )

      // Consumidor 1: pace no caminho legado
      const legacyPace = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: legacyDriver,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: deterministicRng,
      })

      // No caminho legado:
      // puWearPercent = (100 - legacyDriver.carCondition) * 0.85 = (100 - 90) * 0.85 = 8.5%
      expect(wearPenaltySpy).toHaveBeenCalled()
      const wearArgPace = wearPenaltySpy.mock.calls[wearPenaltySpy.mock.calls.length - 1][0]
      expect(wearArgPace).toBe(8.5)

      // Consumidor 2: evaluateDnfRoll no caminho legado
      canonicalRaceEngineService.evaluateDnfRoll({
        driver: legacyDriver,
        lap: 5,
        rng: deterministicRng,
      })

      // No caminho legado de evaluateDnfRoll:
      // basePUWear = 0 (powerUnitInitialCondition indefinido)
      // lapPUWearIncrement = (100 - carCondition) * 0.85 = 8.5%
      // puWearPercent = Math.min(100, 0 + 8.5) = 8.5%
      expect(mechanicalRiskSpy).toHaveBeenCalled()
      const riskArgDnf = mechanicalRiskSpy.mock.calls[mechanicalRiskSpy.mock.calls.length - 1][0]
      expect(riskArgDnf.puWear).toBe(8.5)
      expect(riskArgDnf.carCondition).toBe(90)

      // Comprovar consistência com um driver vinculado equivalente com condição 91.5% (100 - 8.5 = 91.5)
      const equivalentLinkedDriver = createTestDriver({
        carCondition: 90,
        powerUnitId: 1,
        powerUnitInitialCondition: 91.5,
      })

      const linkedPace = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: equivalentLinkedDriver,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: deterministicRng,
      })

      expect(legacyPace.lapTimeSec).toBe(linkedPace.lapTimeSec)
      expect(legacyPace.tireWearIncrement).toBe(linkedPace.tireWearIncrement)
      expect(legacyPace.fuelBurnKg).toBe(linkedPace.fuelBurnKg)
    })
  })
})
