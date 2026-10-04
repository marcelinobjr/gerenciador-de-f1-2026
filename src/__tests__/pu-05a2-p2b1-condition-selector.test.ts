/**
 * pu-05a2-p2b1-condition-selector.test.ts
 *
 * Suíte de Homologação PU-05A2-P2b-1:
 * SELETOR DA CONDIÇÃO DA UNIDADE DE POTÊNCIA (Helper Puro)
 *
 * Testes executados diretamente contra a implementação real de
 * `selectParticipantPowerUnitCondition` (sem recriar o seletor nem mockar a saída).
 *
 * Contratos testados:
 * A. Participante com unidade válida retorna sua condição mesmo quando o agregado de referência é diferente.
 * B. IDs diferentes com condição equivalente retornam a mesma condição (ID não dá bônus).
 * C. Sessão legada conserva a seleção anterior (distinção de legado do P2a).
 * D. Vínculo inválido é rejeitado sem fallback silencioso (incluindo limite zero se for válido no contrato).
 */

import { describe, it, expect } from 'vitest'
import {
  selectParticipantPowerUnitCondition,
  type SelectPowerUnitConditionOptions,
} from '@/services/canonicalPowerUnitConditionSelector'
import type { CanonicalRaceDriverState } from '@/types/canonical-race-v2'

/**
 * Factory pura para criar instâncias de CanonicalRaceDriverState para os testes
 */
function createMockDriver(
  overrides: Partial<CanonicalRaceDriverState> = {},
): CanonicalRaceDriverState {
  return {
    careerId: 'test_career_pu_p2b1',
    season: 2026,
    raceId: 'test_race_round_1',
    driverId: 'driver_verstappen',
    teamId: 'redbull',
    gridPosition: 1,
    currentPosition: 1,
    lap: 0,
    raceTime: 0,
    gap: 'LÍDER',
    tyreCompound: 'medio',
    tyreAge: 0,
    fuel: 100,
    carCondition: 85, // Agregado mecânico padrão
    raceStatus: 'racing',
    pitStops: 0,
    driverName: 'Max Verstappen',
    teamName: 'Red Bull Racing',
    teamColor: '#1E41FF',
    isPlayer: true,
    carId: 'car1',
    ...overrides,
  }
}

describe('PU-05A2-P2b-1: Seletor da Condição da Unidade de Potência', () => {
  // =========================================================================
  // CONTRATO A: Condição individual isolada do agregado de referência
  // =========================================================================
  describe('Contrato A: Participante com unidade válida retorna sua condição individual', () => {
    it('A1: retorna a condição da unidade quando esta for substancialmente diferente do carCondition agregado', () => {
      // Exemplo: carCondition global é 95, mas a PU específica alocada está em 68%
      const driver = createMockDriver({
        carCondition: 95,
        powerUnitId: 2,
        powerUnitInitialCondition: 68,
      })

      const result = selectParticipantPowerUnitCondition(driver)
      expect(result.source).toBe('initial')
      expect(result.condition).toBe(68)
      expect(result.powerUnitId).toBe(2)
      expect(result.condition).not.toBe(driver.carCondition)
    })

    it('A2: retorna a condição individual mesmo se legacyFallbackCondition for fornecido nas opções', () => {
      // Se a sessão possui vínculo individual válido, as opções de fallback legado não podem sobrescrever
      const driver = createMockDriver({
        carCondition: 80,
        powerUnitId: 3,
        powerUnitInitialCondition: 72,
      })
      const options: SelectPowerUnitConditionOptions = {
        legacyFallbackCondition: 100,
      }

      const result = selectParticipantPowerUnitCondition(driver, options)
      expect(result.source).toBe('initial')
      expect(result.condition).toBe(72)
      expect(result.powerUnitId).toBe(3)
    })

    it('A3: prioriza powerUnitCondition (corrente da sessão) sobre powerUnitInitialCondition sem restaurar o valor inicial', () => {
      // Durante a prova, a unidade evoluiu/desgastou de 88% para 77%
      const driver = createMockDriver({
        carCondition: 82,
        powerUnitId: 1,
        powerUnitInitialCondition: 88,
        powerUnitCondition: 77,
      })

      const result = selectParticipantPowerUnitCondition(driver)
      expect(result.source).toBe('current')
      expect(result.condition).toBe(77) // Deve respeitar a condição corrente!
      expect(result.condition).not.toBe(88) // Não restaura a condição inicial
      expect(result.powerUnitId).toBe(1)
    })
  })

  // =========================================================================
  // CONTRATO B: IDs diferentes com condição equivalente retornam a mesma condição
  // =========================================================================
  describe('Contrato B: IDs diferentes com condição equivalente (ID não confere bônus)', () => {
    it('B1: PU-1 e PU-4 com a mesma condição (85%) retornam exatamente 85%', () => {
      const driverCar1 = createMockDriver({
        carId: 'car1',
        driverId: 'driver_c1',
        powerUnitId: 1,
        powerUnitInitialCondition: 85,
      })

      const driverCar2 = createMockDriver({
        carId: 'car2',
        driverId: 'driver_c2',
        powerUnitId: 4,
        powerUnitInitialCondition: 85,
      })

      const res1 = selectParticipantPowerUnitCondition(driverCar1)
      const res2 = selectParticipantPowerUnitCondition(driverCar2)

      expect(res1.condition).toBe(res2.condition)
      expect(res1.condition).toBe(85)
      expect(res1.powerUnitId).toBe(1)
      expect(res2.powerUnitId).toBe(4)
    })

    it('B2: Unidade excedente (ex: PU-5) com condição nova (100%) retorna rigorosamente 100%, idêntico a PU-1 nova (100%)', () => {
      const driverPU1 = createMockDriver({
        powerUnitId: 1,
        powerUnitInitialCondition: 100,
      })

      const driverPU5 = createMockDriver({
        powerUnitId: 5,
        powerUnitInitialCondition: 100,
      })

      const resPU1 = selectParticipantPowerUnitCondition(driverPU1)
      const resPU5 = selectParticipantPowerUnitCondition(driverPU5)

      expect(resPU1.condition).toBe(resPU5.condition)
      expect(resPU5.condition).toBe(100)
    })
  })

  // =========================================================================
  // CONTRATO C: Sessão legada conserva a seleção anterior
  // =========================================================================
  describe('Contrato C: Sessões legadas conservam a seleção anterior conforme o P2a', () => {
    it('C1: sessão legada sem campos de PU retorna o carCondition do piloto quando não há opções explícitas', () => {
      const legacyDriver = createMockDriver({
        carCondition: 92,
        powerUnitId: undefined,
        powerUnitInitialCondition: undefined,
        powerUnitCondition: undefined,
      })

      const result = selectParticipantPowerUnitCondition(legacyDriver)
      expect(result.source).toBe('legacy')
      expect(result.condition).toBe(92)
      expect(result.powerUnitId).toBeUndefined()
    })

    it('C2: sessão legada com legacyFallbackCondition fornecido respeita o fallback informado', () => {
      const legacyDriver = createMockDriver({
        carCondition: 90,
        powerUnitId: undefined,
        powerUnitInitialCondition: undefined,
        powerUnitCondition: undefined,
      })

      const result = selectParticipantPowerUnitCondition(legacyDriver, {
        legacyFallbackCondition: 88,
      })
      expect(result.source).toBe('legacy')
      expect(result.condition).toBe(88)
      expect(result.powerUnitId).toBeUndefined()
    })

    it('C3: sessão legada com legacyFallbackCondition=null retorna condition=null sem erro', () => {
      const legacyDriver = createMockDriver({
        powerUnitId: undefined,
        powerUnitInitialCondition: undefined,
        powerUnitCondition: undefined,
      })

      const result = selectParticipantPowerUnitCondition(legacyDriver, {
        legacyFallbackCondition: null,
      })
      expect(result.source).toBe('legacy')
      expect(result.condition).toBeNull()
      expect(result.powerUnitId).toBeUndefined()
    })
  })

  // =========================================================================
  // CONTRATO D: Rejeição estrita de vínculos inválidos (sem fallback silencioso)
  // =========================================================================
  describe('Contrato D: Vínculo incompleto ou inválido é rejeitado sem fallback silencioso', () => {
    it('D1: rejeita powerUnitId negativo ou zero', () => {
      const invalidIdZero = createMockDriver({
        powerUnitId: 0,
        powerUnitInitialCondition: 90,
      })

      expect(() => selectParticipantPowerUnitCondition(invalidIdZero)).toThrow(
        /powerUnitId.*deve ser um número inteiro positivo/,
      )

      const invalidIdNeg = createMockDriver({
        powerUnitId: -3,
        powerUnitInitialCondition: 90,
      })

      expect(() => selectParticipantPowerUnitCondition(invalidIdNeg)).toThrow(
        /powerUnitId.*deve ser um número inteiro positivo/,
      )
    })

    it('D2: rejeita powerUnitId não inteiro (ex: 2.5)', () => {
      const invalidFloat = createMockDriver({
        powerUnitId: 2.5,
        powerUnitInitialCondition: 80,
      })

      expect(() => selectParticipantPowerUnitCondition(invalidFloat)).toThrow(
        /powerUnitId.*deve ser um número inteiro positivo/,
      )
    })

    it('D3: rejeita powerUnitId presente sem nenhuma condição associada (vínculo incompleto)', () => {
      const incompleteDriver = createMockDriver({
        powerUnitId: 2,
        powerUnitInitialCondition: undefined,
        powerUnitCondition: undefined,
      })

      expect(() => selectParticipantPowerUnitCondition(incompleteDriver)).toThrow(
        /Vínculo incompleto para o piloto/,
      )
    })

    it('D4: rejeita condição fora do intervalo [0, 100] (ex: 105% ou -5%)', () => {
      const overDriver = createMockDriver({
        powerUnitId: 1,
        powerUnitInitialCondition: 105,
      })
      expect(() => selectParticipantPowerUnitCondition(overDriver)).toThrow(
        /powerUnitInitialCondition inválida/,
      )

      const underDriver = createMockDriver({
        powerUnitId: 1,
        powerUnitInitialCondition: -5,
      })
      expect(() => selectParticipantPowerUnitCondition(underDriver)).toThrow(
        /powerUnitInitialCondition inválida/,
      )

      const overCurrentDriver = createMockDriver({
        powerUnitId: 1,
        powerUnitInitialCondition: 90,
        powerUnitCondition: 100.5,
      })
      expect(() => selectParticipantPowerUnitCondition(overCurrentDriver)).toThrow(
        /powerUnitCondition inválida/,
      )
    })

    it('D5: rejeita condição não-numérica ou NaN sem assumir 100', () => {
      const nanDriver = createMockDriver({
        powerUnitId: 1,
        powerUnitInitialCondition: Number.NaN,
      })
      expect(() => selectParticipantPowerUnitCondition(nanDriver)).toThrow(
        /powerUnitInitialCondition inválida/,
      )

      const stringDriver = createMockDriver({
        powerUnitId: 1,
        // @ts-expect-error teste com tipo corrompido em runtime
        powerUnitInitialCondition: '85',
      })
      expect(() => selectParticipantPowerUnitCondition(stringDriver)).toThrow(
        /powerUnitInitialCondition inválida/,
      )
    })

    it('D6: condição zero (0%) é um limite válido e NÃO deve ser rejeitada nem tratada como falsy', () => {
      // Unidade no limite máximo de esgotamento mecânico: condição 0%
      const zeroInitialDriver = createMockDriver({
        powerUnitId: 3,
        powerUnitInitialCondition: 0,
      })

      const resZero = selectParticipantPowerUnitCondition(zeroInitialDriver)
      expect(resZero.source).toBe('initial')
      expect(resZero.condition).toBe(0) // 0 estrito, não null nem undefined nem 100
      expect(resZero.powerUnitId).toBe(3)

      const zeroCurrentDriver = createMockDriver({
        powerUnitId: 3,
        powerUnitInitialCondition: 50,
        powerUnitCondition: 0,
      })

      const resZeroCurrent = selectParticipantPowerUnitCondition(zeroCurrentDriver)
      expect(resZeroCurrent.source).toBe('current')
      expect(resZeroCurrent.condition).toBe(0)
      expect(resZeroCurrent.powerUnitId).toBe(3)
    })
  })
})
