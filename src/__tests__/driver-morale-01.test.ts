/**
 * DRIVER-MORALE-01 TEST SUITE
 * 20 critérios rastreáveis: DM01 a DM20
 *
 * - DM01: Expected P10 / Finish P6 → moral sobe.
 * - DM02: Expected P8 / Finish P8 → moral praticamente neutra.
 * - DM03: Expected P4 / Finish P9 → moral cai.
 * - DM04: Vitória gera bônus adicional moderado (+3).
 * - DM05: Pódio sem vitória gera bônus menor que vitória (+2).
 * - DM06: DNF mecânico não provoca penalidade forte (delta 0 ou máx -1).
 * - DM07: DNF por erro do piloto provoca penalidade maior (-3 a -5, ex: -4).
 * - DM08: DNF sem causa confiável usa penalidade conservadora (-1).
 * - DM09: Clamp superior — moral nunca passa de 100.
 * - DM10: Clamp inferior — moral nunca fica abaixo de 0.
 * - DM11: Delta por corrida nunca passa de +8.
 * - DM12: Delta por corrida nunca passa de -8.
 * - DM13: Mesma corrida processada duas vezes → moral altera apenas uma vez.
 * - DM14: Save/reload preserva moral atualizada.
 * - DM15: Dois pilotos da mesma equipe podem receber deltas diferentes.
 * - DM16: Nenhuma regra depende de teamName.
 * - DM17: Nenhuma regra depende de driverName.
 * - DM18: Driver Strength mantém exatamente Attributes 80% / Morale 10% / Adaptation 10%.
 * - DM19: Atualização só ocorre após resultado oficial.
 * - DM20: Resultado ainda não oficial não altera moral.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { driverMoraleService } from '@/services/driverMoraleService'
import { DRIVER_WEIGHTS, StructuralStrengthService } from '@/services/structuralStrengthService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'

describe('DRIVER-MORALE-01: Regras Canônicas de Moral de Piloto', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  // DM01: Expected P10 / Finish P6 → moral sobe
  it('DM01: Expected P10 / Finish P6 → performanceDelta +4 gera ganho de moral', () => {
    const res = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'drv_test_1',
      currentMorale: 70,
      finishPosition: 6,
      expectedPosition: 10,
    })

    expect(res.performanceDelta).toBe(4) // 10 - 6 = +4
    expect(res.baseDelta).toBe(2) // 2 a 4 posições -> +2
    expect(res.clampedRaceDelta).toBeGreaterThan(0)
    expect(res.afterMorale).toBe(72)
    expect(res.afterMorale).toBeGreaterThan(res.beforeMorale)
  })

  // DM02: Expected P8 / Finish P8 → moral praticamente neutra
  it('DM02: Expected P8 / Finish P8 → dentro de ±1 gera variação 0', () => {
    const res = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'drv_test_2',
      currentMorale: 75,
      finishPosition: 8,
      expectedPosition: 8,
    })

    expect(res.performanceDelta).toBe(0)
    expect(res.baseDelta).toBe(0)
    expect(res.clampedRaceDelta).toBe(0)
    expect(res.afterMorale).toBe(75)
  })

  // DM03: Expected P4 / Finish P9 → moral cai
  it('DM03: Expected P4 / Finish P9 → performanceDelta -5 gera queda de moral', () => {
    const res = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'drv_test_3',
      currentMorale: 80,
      finishPosition: 9,
      expectedPosition: 4,
    })

    expect(res.performanceDelta).toBe(-5) // 4 - 9 = -5
    expect(res.baseDelta).toBe(-4) // 5+ abaixo -> -4
    expect(res.clampedRaceDelta).toBeLessThan(0)
    expect(res.afterMorale).toBe(76)
    expect(res.afterMorale).toBeLessThan(res.beforeMorale)
  })

  // DM04: Vitória gera bônus adicional moderado (+3)
  it('DM04: Vitória (P1) gera bônus de vitória moderado (+3)', () => {
    const res = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'drv_winner',
      currentMorale: 80,
      finishPosition: 1,
      expectedPosition: 1, // performanceDelta = 0, baseDelta = 0
    })

    expect(res.specialBonus).toBe(3)
    expect(res.clampedRaceDelta).toBe(3)
    expect(res.afterMorale).toBe(83)
  })

  // DM05: Pódio sem vitória gera bônus menor que vitória (+2)
  it('DM05: Pódio sem vitória (P2 ou P3) gera bônus (+2), menor que vitória (+3)', () => {
    const resP2 = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'drv_p2',
      currentMorale: 80,
      finishPosition: 2,
      expectedPosition: 2,
    })

    const resP3 = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'drv_p3',
      currentMorale: 80,
      finishPosition: 3,
      expectedPosition: 3,
    })

    const resP1 = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'drv_p1',
      currentMorale: 80,
      finishPosition: 1,
      expectedPosition: 1,
    })

    expect(resP2.specialBonus).toBe(2)
    expect(resP3.specialBonus).toBe(2)
    expect(resP1.specialBonus).toBe(3)
    expect(resP2.specialBonus).toBeLessThan(resP1.specialBonus)
  })

  // DM06: DNF mecânico não provoca penalidade forte (delta 0 ou máx -1)
  it('DM06: DNF mecânico (motor, câmbio, hidráulica) não provoca penalidade forte (delta 0 ou máx -1)', () => {
    const resEngine = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'drv_dnf_eng',
      currentMorale: 80,
      finishPosition: 999,
      isDnf: true,
      dnfReason: 'Engine failure on lap 22',
    })

    const resHydraulics = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'drv_dnf_hyd',
      currentMorale: 80,
      finishPosition: 999,
      isDnf: true,
      dnfReason: 'Falha hidráulica de pressão',
    })

    expect(resEngine.dnfCategory).toBe('mechanical')
    expect(resEngine.clampedRaceDelta).toBeGreaterThanOrEqual(-1)
    expect(resEngine.clampedRaceDelta).toBeLessThanOrEqual(0)
    expect(resEngine.afterMorale).toBeGreaterThanOrEqual(79)

    expect(resHydraulics.dnfCategory).toBe('mechanical')
    expect(resHydraulics.clampedRaceDelta).toBeGreaterThanOrEqual(-1)
  })

  // DM07: DNF por erro do piloto provoca penalidade maior (-3 a -5)
  it('DM07: DNF por erro do piloto provoca penalidade maior (-3 a -5, no caso -4)', () => {
    const resSpin = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'drv_dnf_spin',
      currentMorale: 80,
      finishPosition: 999,
      isDnf: true,
      dnfReason: 'Driver error: spin and crash into barrier',
    })

    expect(resSpin.dnfCategory).toBe('driver_error')
    expect(resSpin.clampedRaceDelta).toBe(-4)
    expect(resSpin.clampedRaceDelta).toBeLessThan(-1)
    expect(resSpin.afterMorale).toBe(76)
  })

  // DM08: DNF sem causa confiável usa penalidade conservadora (-1)
  it('DM08: DNF sem causa confiável usa penalidade conservadora de -1 sem inferir culpa', () => {
    const resUnknown = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'drv_dnf_unk',
      currentMorale: 80,
      finishPosition: 999,
      isDnf: true,
      dnfReason: undefined,
    })

    expect(resUnknown.dnfCategory).toBe('unknown')
    expect(resUnknown.clampedRaceDelta).toBe(-1)
    expect(resUnknown.afterMorale).toBe(79)
  })

  // DM09: Clamp superior — moral nunca passa de 100
  it('DM09: Clamp superior — moral nunca excede 100', () => {
    const res = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'drv_max',
      currentMorale: 98,
      finishPosition: 1,
      expectedPosition: 10, // delta +9, clamp GP +8 -> 98 + 8 = 106 -> clamp 100
    })

    expect(res.afterMorale).toBe(100)
    expect(res.afterMorale).toBeLessThanOrEqual(100)
  })

  // DM10: Clamp inferior — moral nunca fica abaixo de 0
  it('DM10: Clamp inferior — moral nunca fica abaixo de 0', () => {
    const res = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'drv_min',
      currentMorale: 2,
      finishPosition: 999,
      isDnf: true,
      dnfReason: 'Driver error', // delta -4 -> 2 - 4 = -2 -> clamp 0
    })

    expect(res.afterMorale).toBe(0)
    expect(res.afterMorale).toBeGreaterThanOrEqual(0)
  })

  // DM11: Delta por corrida nunca passa de +8
  it('DM11: Delta por corrida clamped no máximo em +8', () => {
    // Expected P20, Finish P1 (+4 base + 3 bonus = 7, se base fosse maior nunca passa de +8)
    const res = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'drv_mega_win',
      currentMorale: 50,
      finishPosition: 1,
      expectedPosition: 20, // delta 19 -> base 4 + bonus 3 = 7
    })

    expect(res.clampedRaceDelta).toBeLessThanOrEqual(8)
    expect(res.clampedRaceDelta).toBe(7)
  })

  // DM12: Delta por corrida nunca passa de -8
  it('DM12: Delta por corrida clamped no mínimo em -8', () => {
    const res = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'drv_mega_loss',
      currentMorale: 50,
      finishPosition: 20,
      expectedPosition: 1, // -19 -> base -4
    })

    expect(res.clampedRaceDelta).toBeGreaterThanOrEqual(-8)
    expect(res.clampedRaceDelta).toBe(-4)
  })

  // DM13: Mesma corrida processada duas vezes → moral altera apenas uma vez
  it('DM13: Idempotência — mesma corrida processada duas vezes não duplica alteração', async () => {
    const driverId = 'drv_idemp_1'
    let persistedMorale = 70

    const mockOfficialResult = {
      careerId: 'career_alpha',
      season: 2026,
      round: 3,
      officializedAt: new Date().toISOString(),
      entries: [
        {
          driverId,
          finalPosition: 5,
          gridPosition: 9, // Expected P9, Finish P5 -> +4 posições -> +2 delta
        },
      ],
    }

    // Primeira execução
    const firstPass = await driverMoraleService.processOfficialRaceMorale({
      officialResult: mockOfficialResult,
      driverCurrentMoraleMap: { [driverId]: persistedMorale },
      onSaveDriverMorale: async (_id, val) => {
        persistedMorale = val
      },
    })

    expect(firstPass).toHaveLength(1)
    expect(firstPass[0].afterMorale).toBe(72)
    expect(persistedMorale).toBe(72)

    // Segunda execução idêntica
    const secondPass = await driverMoraleService.processOfficialRaceMorale({
      officialResult: mockOfficialResult,
      driverCurrentMoraleMap: { [driverId]: persistedMorale },
      onSaveDriverMorale: async (_id, val) => {
        persistedMorale = val
      },
    })

    // Como já foi processado para este round, não reprocessa nem reincrementa
    expect(secondPass).toHaveLength(0)
    expect(persistedMorale).toBe(72) // Permanece 72, nunca 74
  })

  // DM14: Save/reload preserva moral atualizada
  it('DM14: Save/reload preserva moral atualizada via idempotency storage', () => {
    const params = { careerId: 'car_1', season: 2026, round: 5, driverId: 'drv_p_1' }
    driverMoraleService.markMoraleProcessed(params, { before: 70, after: 74, delta: 4 })

    expect(driverMoraleService.isMoraleAlreadyProcessed(params)).toBe(true)

    // Simula reload (lendo do storage persistido)
    const stored = JSON.parse(
      localStorage.getItem(driverMoraleService.getIdempotencyKey(params)) || '{}',
    )
    expect(stored.after).toBe(74)
    expect(stored.delta).toBe(4)
  })

  // DM15: Dois pilotos da mesma equipe podem receber deltas diferentes
  it('DM15: Dois pilotos da mesma equipe recebem deltas individuais conforme suas expectativas', () => {
    // Piloto A: Expected P8, Finish P4 -> +4 posições -> sobe +2
    const resPilotA = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'pilot_a',
      teamId: 'team_ferrari',
      currentMorale: 70,
      finishPosition: 4,
      expectedPosition: 8,
    })

    // Piloto B: Expected P7, Finish P13 -> -6 posições -> cai -4
    const resPilotB = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'pilot_b',
      teamId: 'team_ferrari',
      currentMorale: 70,
      finishPosition: 13,
      expectedPosition: 7,
    })

    expect(resPilotA.clampedRaceDelta).toBe(2)
    expect(resPilotA.afterMorale).toBe(72)

    expect(resPilotB.clampedRaceDelta).toBe(-4)
    expect(resPilotB.afterMorale).toBe(66)

    expect(resPilotA.afterMorale).not.toBe(resPilotB.afterMorale)
  })

  // DM16: Nenhuma regra depende de teamName
  it('DM16: Totalmente agnóstico ao nome da equipe — sem hardcoding', () => {
    const resGeneric = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'd1',
      teamName: 'Custom Fictional Team',
      currentMorale: 75,
      finishPosition: 6,
      expectedPosition: 10,
    })

    const resFerrari = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'd2',
      teamName: 'Scuderia Ferrari',
      currentMorale: 75,
      finishPosition: 6,
      expectedPosition: 10,
    })

    expect(resGeneric.clampedRaceDelta).toBe(resFerrari.clampedRaceDelta)
    expect(resGeneric.afterMorale).toBe(resFerrari.afterMorale)
  })

  // DM17: Nenhuma regra depende de driverName
  it('DM17: Totalmente agnóstico ao nome do piloto — sem hardcoding', () => {
    const resVerstappen = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'd_max',
      driverName: 'Max Verstappen',
      currentMorale: 85,
      finishPosition: 1,
      expectedPosition: 1,
    })

    const resMariana = driverMoraleService.calculateDriverMoraleDelta({
      driverId: 'd_mariana',
      driverName: 'Mariana Fagundes',
      currentMorale: 85,
      finishPosition: 1,
      expectedPosition: 1,
    })

    expect(resVerstappen.clampedRaceDelta).toBe(resMariana.clampedRaceDelta)
    expect(resVerstappen.afterMorale).toBe(resMariana.afterMorale)
  })

  // DM18: Driver Strength mantém exatamente Attributes 80% / Morale 10% / Adaptation 10%
  it('DM18: DRIVER_WEIGHTS preserva estritamente Attributes 80%, Morale 10%, Adaptation 10%', () => {
    expect(DRIVER_WEIGHTS.driverAttributes).toBe(0.8)
    expect(DRIVER_WEIGHTS.morale).toBe(0.1)
    expect(DRIVER_WEIGHTS.adaptation).toBe(0.1)

    // Validação com cálculo real do StructuralStrengthService
    const service = new StructuralStrengthService()
    const breakdown = service.calculateDriverScore({
      drivers: [
        {
          name: 'Piloto Teste',
          role: 'driver1',
          overallRating: 80,
          speed: 80,
          consistency: 80,
          rain: 80,
          defense: 80,
          morale: 90,
        },
      ],
      adaptationOverride: 70,
    })

    // 80 * 0.8 + 90 * 0.1 + 70 * 0.1 = 64 + 9 + 7 = 80.0
    expect(breakdown.driverScore).toBe(80.0)
    expect(breakdown.weights.driverAttributes).toBe(0.8)
    expect(breakdown.weights.morale).toBe(0.1)
    expect(breakdown.weights.adaptation).toBe(0.1)
  })

  // DM19: Atualização só ocorre após resultado oficial
  it('DM19: Atualização de moral só ocorre após resultado oficial (officializeRace)', async () => {
    const mockRaceState: any = {
      careerId: 'car_dm19',
      season: 2026,
      round: 1,
      raceId: 'gp_bahrain',
      totalLaps: 57,
      status: 'completed',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      drivers: [
        {
          driverId: 'drv_official_1',
          driverName: 'Driver 1',
          teamId: 'team_1',
          position: 1,
          currentPosition: 1,
          gridPosition: 5,
          lap: 57,
          raceStatus: 'finished',
        },
      ],
    }

    const official = canonicalRaceResultService.officializeRace(mockRaceState)
    expect(official).toBeDefined()
    expect(official.officializedAt).toBeDefined()
    expect(official.entries).toHaveLength(1)
    expect(official.entries[0].finalPosition).toBe(1)

    // Invoca processamento oficial direto
    let persistedMorale = 75
    const results = await driverMoraleService.processOfficialRaceMorale({
      officialResult: {
        careerId: official.careerId,
        season: official.season,
        round: official.round,
        officializedAt: official.officializedAt,
        entries: official.entries.map((e) => ({
          driverId: e.driverId,
          teamId: e.teamId,
          finalPosition: e.finalPosition,
          gridPosition: e.gridPosition,
          status: e.status,
        })),
      },
      driverCurrentMoraleMap: { drv_official_1: persistedMorale },
      onSaveDriverMorale: async (_id, val) => {
        persistedMorale = val
      },
    })

    expect(results).toHaveLength(1)
    // Grid P5 -> Finish P1: delta posições +4 (base +2) + vitória (+3) = +5 -> 75 + 5 = 80
    expect(results[0].afterMorale).toBe(80)
    expect(persistedMorale).toBe(80)
    expect(
      driverMoraleService.isMoraleAlreadyProcessed({
        careerId: official.careerId,
        season: official.season,
        round: official.round,
        driverId: 'drv_official_1',
      }),
    ).toBe(true)
  })

  // DM20: Resultado ainda não oficial não altera moral
  it('DM20: Resultado ainda não oficial não altera moral (bloqueio de oficialização e checagem de estado)', () => {
    const unfinishedRaceState: any = {
      careerId: 'car_dm20',
      season: 2026,
      round: 2,
      status: 'racing',
      safetyCarActive: true, // safety car ativo impede oficialização
      drivers: [{ driverId: 'drv_unoff_1', position: 1 }],
    }

    // Tentativa de oficializar prova em andamento ou sob safety car falha
    expect(() => {
      canonicalRaceResultService.officializeRace(unfinishedRaceState)
    }).toThrow(/Cannot officialize race/)

    // Verifica que chave de moral para esta rodada não foi gravada/alterada
    const wasProcessed = driverMoraleService.isMoraleAlreadyProcessed({
      careerId: 'car_dm20',
      season: 2026,
      round: 2,
      driverId: 'drv_unoff_1',
    })
    expect(wasProcessed).toBe(false)
  })
})
