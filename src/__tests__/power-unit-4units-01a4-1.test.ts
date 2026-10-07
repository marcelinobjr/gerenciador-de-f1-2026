/**
 * power-unit-4units-01a4-1.test.ts
 *
 * PROVA AUTOMATIZADA DO RESOLVER DE COTA POR PILOTO
 * POWER-UNIT-4UNITS-01A4.1-T
 *
 * Prova que a cota de Power Unit é resolvida exclusivamente por:
 * driverId + seasonYear
 * independentemente de:
 * - companheiro;
 * - IDs físicos;
 * - ordem do array;
 * - histórico antigo;
 * - temporadas anteriores.
 *
 * Cenários T1 a T13 cobertos de forma exaustiva e pura.
 */

import { describe, it, expect } from 'vitest'
import type { PowerUnitHistoryEntry } from '@/types/f1'
import {
  resolveDriverPowerUnitQuota,
  FIRST_EXCESS_GRID_PENALTY,
  SUBSEQUENT_EXCESS_GRID_PENALTY,
} from '@/services/canonicalPowerUnitInventoryService'

describe('POWER-UNIT-4UNITS-01A4.1-T — Prova Automatizada do Resolver de Cota por Piloto', () => {
  // Helper para criar entradas com tipagem consistente sem poluir os testes
  const createEntry = (
    id: number,
    driverId?: string,
    seasonYear?: number,
    unitNumber?: number,
    overrides: Partial<PowerUnitHistoryEntry> = {},
  ): PowerUnitHistoryEntry => ({
    id,
    wear: 0,
    condition: 100,
    mileage_km: 0,
    status: 'reserva',
    supplier: 'Audi',
    introducedRound: 1,
    exceedsQuota: false,
    driverId,
    seasonYear,
    unitNumber,
    ...overrides,
  })

  // T1 — INVENTÁRIO VAZIO
  // Para determinado piloto/temporada sem unidades modernas:
  // esperado: nextUnitNumber = 1, exceedsQuota = false, gridPenaltyPositions = 0
  describe('T1 — INVENTÁRIO VAZIO', () => {
    it('deve retornar nextUnitNumber = 1, exceedsQuota = false e gridPenaltyPositions = 0 para inventário vazio ou nulo', () => {
      // Array vazio
      const resEmpty = resolveDriverPowerUnitQuota([], 'drv_leclerc', 2026)
      expect(resEmpty).toEqual({
        nextUnitNumber: 1,
        exceedsQuota: false,
        gridPenaltyPositions: 0,
      })

      // Null / undefined
      const resNull = resolveDriverPowerUnitQuota(null, 'drv_leclerc', 2026)
      expect(resNull).toEqual({
        nextUnitNumber: 1,
        exceedsQuota: false,
        gridPenaltyPositions: 0,
      })

      const resUndefined = resolveDriverPowerUnitQuota(undefined, 'drv_leclerc', 2026)
      expect(resUndefined).toEqual({
        nextUnitNumber: 1,
        exceedsQuota: false,
        gridPenaltyPositions: 0,
      })
    })
  })

  // T2 — DENTRO DA COTA
  // Testar progressivamente:
  // - possui PU1 → próxima PU2
  // - possui PU1–PU2 → próxima PU3
  // - possui PU1–PU3 → próxima PU4
  // Em todos: exceedsQuota = false, penalidade = 0. Não inferir pelo tamanho global do array.
  describe('T2 — DENTRO DA COTA', () => {
    it('possui PU1 → próxima PU2 com penalidade 0 e sem exceder cota', () => {
      const history: PowerUnitHistoryEntry[] = [createEntry(1, 'drv_norris', 2026, 1)]
      const res = resolveDriverPowerUnitQuota(history, 'drv_norris', 2026)
      expect(res.nextUnitNumber).toBe(2)
      expect(res.exceedsQuota).toBe(false)
      expect(res.gridPenaltyPositions).toBe(0)
    })

    it('possui PU1–PU2 → próxima PU3 com penalidade 0 e sem exceder cota', () => {
      const history: PowerUnitHistoryEntry[] = [
        createEntry(1, 'drv_norris', 2026, 1),
        createEntry(2, 'drv_norris', 2026, 2),
      ]
      const res = resolveDriverPowerUnitQuota(history, 'drv_norris', 2026)
      expect(res.nextUnitNumber).toBe(3)
      expect(res.exceedsQuota).toBe(false)
      expect(res.gridPenaltyPositions).toBe(0)
    })

    it('possui PU1–PU3 → próxima PU4 com penalidade 0 e sem exceder cota', () => {
      const history: PowerUnitHistoryEntry[] = [
        createEntry(1, 'drv_norris', 2026, 1),
        createEntry(2, 'drv_norris', 2026, 2),
        createEntry(3, 'drv_norris', 2026, 3),
      ]
      const res = resolveDriverPowerUnitQuota(history, 'drv_norris', 2026)
      expect(res.nextUnitNumber).toBe(4)
      expect(res.exceedsQuota).toBe(false)
      expect(res.gridPenaltyPositions).toBe(0)
    })
  })

  // T3 — PRIMEIRA EXCEDENTE
  // Piloto possui PU1, PU2, PU3, PU4.
  // esperado: nextUnitNumber = 5, exceedsQuota = true, gridPenaltyPositions = FIRST_EXCESS_GRID_PENALTY
  // O teste consome a constante exportada FIRST_EXCESS_GRID_PENALTY.
  describe('T3 — PRIMEIRA EXCEDENTE', () => {
    it('piloto com PU1..PU4 resulta em PU5 com exceedsQuota = true e penalidade FIRST_EXCESS_GRID_PENALTY', () => {
      const history: PowerUnitHistoryEntry[] = [
        createEntry(10, 'drv_piastri', 2026, 1),
        createEntry(11, 'drv_piastri', 2026, 2),
        createEntry(12, 'drv_piastri', 2026, 3),
        createEntry(13, 'drv_piastri', 2026, 4),
      ]
      const res = resolveDriverPowerUnitQuota(history, 'drv_piastri', 2026)
      expect(res.nextUnitNumber).toBe(5)
      expect(res.exceedsQuota).toBe(true)
      expect(res.gridPenaltyPositions).toBe(FIRST_EXCESS_GRID_PENALTY)
    })
  })

  // T4 — EXCEDENTES SUBSEQUENTES
  // Piloto possui PU1–PU5.
  // esperado: próxima = PU6, excede cota, penalidade = SUBSEQUENT_EXCESS_GRID_PENALTY.
  // Repetir com inventário até PU7 ou PU8 para provar que PU6+ continua usando a penalidade subsequente.
  describe('T4 — EXCEDENTES SUBSEQUENTES', () => {
    it('piloto com PU1..PU5 resulta em PU6 com penalidade SUBSEQUENT_EXCESS_GRID_PENALTY', () => {
      const history: PowerUnitHistoryEntry[] = [
        createEntry(1, 'drv_hamilton', 2026, 1),
        createEntry(2, 'drv_hamilton', 2026, 2),
        createEntry(3, 'drv_hamilton', 2026, 3),
        createEntry(4, 'drv_hamilton', 2026, 4),
        createEntry(5, 'drv_hamilton', 2026, 5),
      ]
      const res = resolveDriverPowerUnitQuota(history, 'drv_hamilton', 2026)
      expect(res.nextUnitNumber).toBe(6)
      expect(res.exceedsQuota).toBe(true)
      expect(res.gridPenaltyPositions).toBe(SUBSEQUENT_EXCESS_GRID_PENALTY)
    })

    it('piloto com PU1..PU7 resulta em PU8 com penalidade SUBSEQUENT_EXCESS_GRID_PENALTY', () => {
      const history: PowerUnitHistoryEntry[] = [1, 2, 3, 4, 5, 6, 7].map((num) =>
        createEntry(num, 'drv_hamilton', 2026, num),
      )
      const res = resolveDriverPowerUnitQuota(history, 'drv_hamilton', 2026)
      expect(res.nextUnitNumber).toBe(8)
      expect(res.exceedsQuota).toBe(true)
      expect(res.gridPenaltyPositions).toBe(SUBSEQUENT_EXCESS_GRID_PENALTY)
    })
  })

  // T5 — ISOLAMENTO ENTRE PILOTOS
  // Mesma equipe e temporada:
  // Driver A: PU1–PU6
  // Driver B: PU1–PU2
  // esperado:
  // A: próxima PU7, excedente, penalidade subsequente.
  // B: próxima PU3, não excedente, penalidade 0.
  // As unidades de A não podem aumentar o contador de B.
  describe('T5 — ISOLAMENTO ENTRE PILOTOS', () => {
    it('unidades do Piloto A não aumentam nem interferem na contagem ou penalidade do Piloto B', () => {
      const history: PowerUnitHistoryEntry[] = [
        // Driver A: PU1..PU6
        createEntry(1, 'drv_A', 2026, 1),
        createEntry(2, 'drv_A', 2026, 2),
        createEntry(3, 'drv_A', 2026, 3),
        createEntry(4, 'drv_A', 2026, 4),
        createEntry(5, 'drv_A', 2026, 5),
        createEntry(6, 'drv_A', 2026, 6),
        // Driver B: PU1..PU2
        createEntry(7, 'drv_B', 2026, 1),
        createEntry(8, 'drv_B', 2026, 2),
      ]

      const resA = resolveDriverPowerUnitQuota(history, 'drv_A', 2026)
      expect(resA.nextUnitNumber).toBe(7)
      expect(resA.exceedsQuota).toBe(true)
      expect(resA.gridPenaltyPositions).toBe(SUBSEQUENT_EXCESS_GRID_PENALTY)

      const resB = resolveDriverPowerUnitQuota(history, 'drv_B', 2026)
      expect(resB.nextUnitNumber).toBe(3)
      expect(resB.exceedsQuota).toBe(false)
      expect(resB.gridPenaltyPositions).toBe(0)
    })
  })

  // T6 — ISOLAMENTO ENTRE TEMPORADAS
  // Mesmo piloto:
  // 2026: PU1–PU7
  // 2027: PU1–PU4
  // Resolver 2027.
  // esperado: próxima = PU5, primeira excedente, penalidade de primeira excedente.
  // O histórico 2026 não pode produzir PU8 em 2027.
  describe('T6 — ISOLAMENTO ENTRE TEMPORADAS', () => {
    it('histórico da temporada anterior (2026) não vaza nem afeta a temporada atual (2027)', () => {
      const history: PowerUnitHistoryEntry[] = [
        // 2026: 7 unidades
        createEntry(1, 'drv_verstappen', 2026, 1),
        createEntry(2, 'drv_verstappen', 2026, 2),
        createEntry(3, 'drv_verstappen', 2026, 3),
        createEntry(4, 'drv_verstappen', 2026, 4),
        createEntry(5, 'drv_verstappen', 2026, 5),
        createEntry(6, 'drv_verstappen', 2026, 6),
        createEntry(7, 'drv_verstappen', 2026, 7),
        // 2027: 4 unidades
        createEntry(8, 'drv_verstappen', 2027, 1),
        createEntry(9, 'drv_verstappen', 2027, 2),
        createEntry(10, 'drv_verstappen', 2027, 3),
        createEntry(11, 'drv_verstappen', 2027, 4),
      ]

      const res2027 = resolveDriverPowerUnitQuota(history, 'drv_verstappen', 2027)
      expect(res2027.nextUnitNumber).toBe(5)
      expect(res2027.exceedsQuota).toBe(true)
      expect(res2027.gridPenaltyPositions).toBe(FIRST_EXCESS_GRID_PENALTY)
    })
  })

  // T7 — ID FÍSICO NÃO INTERFERE
  // Criar entradas com IDs físicos propositalmente fora de sequência:
  // - ID 91 → unitNumber 1
  // - ID 3 → unitNumber 2
  // - ID 450 → unitNumber 3
  // - ID 17 → unitNumber 4
  // esperado: próxima = PU5.
  // Prova que engine_history[].id nunca é usado como contador regulamentar.
  describe('T7 — ID FÍSICO NÃO INTERFERE', () => {
    it('IDs físicos arbitrários e fora de ordem (91, 3, 450, 17) não afetam unitNumber regulamentar', () => {
      const history: PowerUnitHistoryEntry[] = [
        createEntry(91, 'drv_alonso', 2026, 1),
        createEntry(3, 'drv_alonso', 2026, 2),
        createEntry(450, 'drv_alonso', 2026, 3),
        createEntry(17, 'drv_alonso', 2026, 4),
      ]

      const res = resolveDriverPowerUnitQuota(history, 'drv_alonso', 2026)
      expect(res.nextUnitNumber).toBe(5)
      expect(res.exceedsQuota).toBe(true)
      expect(res.gridPenaltyPositions).toBe(FIRST_EXCESS_GRID_PENALTY)
    })
  })

  // T8 — ORDEM DO ARRAY NÃO INTERFERE
  // Fornecer: PU4, PU1, PU3, PU2 em ordem embaralhada.
  // esperado: próxima = PU5.
  // O cálculo deve vir de max(unitNumber) + 1 e não da última entrada.
  describe('T8 — ORDEM DO ARRAY NÃO INTERFERE', () => {
    it('ordem aleatória dos elementos do array não altera a resolução baseada em max(unitNumber) + 1', () => {
      const historyShuffled: PowerUnitHistoryEntry[] = [
        createEntry(4, 'drv_russell', 2026, 4),
        createEntry(1, 'drv_russell', 2026, 1),
        createEntry(3, 'drv_russell', 2026, 3),
        createEntry(2, 'drv_russell', 2026, 2),
      ]

      const res = resolveDriverPowerUnitQuota(historyShuffled, 'drv_russell', 2026)
      expect(res.nextUnitNumber).toBe(5)
      expect(res.exceedsQuota).toBe(true)
      expect(res.gridPenaltyPositions).toBe(FIRST_EXCESS_GRID_PENALTY)
    })
  })

  // T9 — UNIDADE FALTANTE
  // Cenário: PU1, PU2, PU4.
  // Conforme o contrato implementado em A4.1 (max + 1):
  // esperado: nextUnitNumber = 5 e não PU3.
  // Congela a semântica do helper: resolve próxima unidade regulamentar introduzida, não "buraco".
  describe('T9 — UNIDADE FALTANTE', () => {
    it('quando existem PU1, PU2, PU4, resolve max(unitNumber) + 1 = 5 (não preenche buraco PU3)', () => {
      const historyWithGap: PowerUnitHistoryEntry[] = [
        createEntry(1, 'drv_sainz', 2026, 1),
        createEntry(2, 'drv_sainz', 2026, 2),
        createEntry(4, 'drv_sainz', 2026, 4),
      ]

      const res = resolveDriverPowerUnitQuota(historyWithGap, 'drv_sainz', 2026)
      expect(res.nextUnitNumber).toBe(5)
      expect(res.exceedsQuota).toBe(true)
      expect(res.gridPenaltyPositions).toBe(FIRST_EXCESS_GRID_PENALTY)
    })
  })

  // T10 — LEGADO IGNORADO
  // Misturar entradas antigas sem: driverId, seasonYear, unitNumber com unidades modernas.
  // esperado: o legado não interfere no contador.
  describe('T10 — LEGADO IGNORADO', () => {
    it('entradas legadas (sem driverId, sem seasonYear ou sem unitNumber) são sumariamente ignoradas', () => {
      const historyWithLegacy: PowerUnitHistoryEntry[] = [
        // Legado puro (sem campos modernos)
        {
          id: 999,
          wear: 50,
          condition: 50,
          mileage_km: 3000,
          status: 'reserva',
          supplier: 'Ferrari',
          introducedRound: 1,
          exceedsQuota: false,
        },
        // Legado parcial (sem driverId)
        {
          id: 998,
          wear: 40,
          condition: 60,
          mileage_km: 2000,
          status: 'reserva',
          supplier: 'Ferrari',
          introducedRound: 1,
          exceedsQuota: false,
          seasonYear: 2026,
          unitNumber: 10,
        },
        // Legado parcial (sem unitNumber)
        {
          id: 997,
          wear: 10,
          condition: 90,
          mileage_km: 500,
          status: 'reserva',
          supplier: 'Ferrari',
          introducedRound: 1,
          exceedsQuota: false,
          driverId: 'drv_tsunoda',
          seasonYear: 2026,
        },
        // Entrada moderna válida
        createEntry(1, 'drv_tsunoda', 2026, 1),
      ]

      const res = resolveDriverPowerUnitQuota(historyWithLegacy, 'drv_tsunoda', 2026)
      expect(res.nextUnitNumber).toBe(2)
      expect(res.exceedsQuota).toBe(false)
      expect(res.gridPenaltyPositions).toBe(0)
    })
  })

  // T11 — OUTRO PILOTO / OUTRA TEMPORADA NO MESMO ARRAY
  // Criar um único engineHistory contendo simultaneamente:
  // - muitas unidades de Driver A/2026
  // - unidades de Driver B/2026
  // - unidades de Driver A/2027
  // - legado
  // Resolver cada combinação separadamente.
  // esperado: cada resultado depende exclusivamente do filtro driverId + seasonYear.
  describe('T11 — OUTRO PILOTO / OUTRA TEMPORADA NO MESMO ARRAY', () => {
    it('múltiplos pilotos, múltiplas temporadas e legados no mesmo array são estritamente isolados', () => {
      const combinedHistory: PowerUnitHistoryEntry[] = [
        // Driver A - 2026 (PU1..PU5)
        createEntry(1, 'drv_A', 2026, 1),
        createEntry(2, 'drv_A', 2026, 2),
        createEntry(3, 'drv_A', 2026, 3),
        createEntry(4, 'drv_A', 2026, 4),
        createEntry(5, 'drv_A', 2026, 5),

        // Driver B - 2026 (PU1..PU3)
        createEntry(6, 'drv_B', 2026, 1),
        createEntry(7, 'drv_B', 2026, 2),
        createEntry(8, 'drv_B', 2026, 3),

        // Driver A - 2027 (PU1)
        createEntry(9, 'drv_A', 2027, 1),

        // Legado genérico
        {
          id: 500,
          wear: 20,
          condition: 80,
          mileage_km: 1000,
          status: 'reserva',
          supplier: 'Audi',
          introducedRound: 1,
          exceedsQuota: false,
        },
      ]

      // Driver A / 2026 -> próxima PU6 (subsequente)
      const resA2026 = resolveDriverPowerUnitQuota(combinedHistory, 'drv_A', 2026)
      expect(resA2026.nextUnitNumber).toBe(6)
      expect(resA2026.exceedsQuota).toBe(true)
      expect(resA2026.gridPenaltyPositions).toBe(SUBSEQUENT_EXCESS_GRID_PENALTY)

      // Driver B / 2026 -> próxima PU4 (dentro da cota)
      const resB2026 = resolveDriverPowerUnitQuota(combinedHistory, 'drv_B', 2026)
      expect(resB2026.nextUnitNumber).toBe(4)
      expect(resB2026.exceedsQuota).toBe(false)
      expect(resB2026.gridPenaltyPositions).toBe(0)

      // Driver A / 2027 -> próxima PU2 (dentro da cota)
      const resA2027 = resolveDriverPowerUnitQuota(combinedHistory, 'drv_A', 2027)
      expect(resA2027.nextUnitNumber).toBe(2)
      expect(resA2027.exceedsQuota).toBe(false)
      expect(resA2027.gridPenaltyPositions).toBe(0)

      // Driver B / 2027 -> não tem unidades -> próxima PU1
      const resB2027 = resolveDriverPowerUnitQuota(combinedHistory, 'drv_B', 2027)
      expect(resB2027.nextUnitNumber).toBe(1)
      expect(resB2027.exceedsQuota).toBe(false)
      expect(resB2027.gridPenaltyPositions).toBe(0)
    })
  })

  // T12 — PUREZA / IDEMPOTÊNCIA
  // Capturar snapshot profundo de engineHistory.
  // Executar o helper múltiplas vezes.
  // esperado:
  // - mesmo retorno em todas as chamadas;
  // - engineHistory permanece byte-a-byte equivalente;
  // - nenhuma ordenação/mutação;
  // - nenhum status alterado;
  // - nenhum novo objeto inserido.
  describe('T12 — PUREZA / IDEMPOTÊNCIA', () => {
    it('execuções repetidas não mutam o array de entrada nem seus objetos de forma alguma', () => {
      const originalHistory: PowerUnitHistoryEntry[] = [
        createEntry(30, 'drv_norris', 2026, 3),
        createEntry(10, 'drv_norris', 2026, 1),
        createEntry(20, 'drv_norris', 2026, 2),
      ]

      const snapshotBefore = JSON.stringify(originalHistory)

      // 10 chamadas repetidas
      for (let i = 0; i < 10; i++) {
        const res = resolveDriverPowerUnitQuota(originalHistory, 'drv_norris', 2026)
        expect(res.nextUnitNumber).toBe(4)
        expect(res.exceedsQuota).toBe(false)
        expect(res.gridPenaltyPositions).toBe(0)
      }

      const snapshotAfter = JSON.stringify(originalHistory)
      expect(snapshotAfter).toBe(snapshotBefore)
      expect(originalHistory.length).toBe(3)
      expect(originalHistory[0].id).toBe(30)
      expect(originalHistory[1].id).toBe(10)
      expect(originalHistory[2].id).toBe(20)
    })
  })

  // T13 — CONSTANTES 10/5
  // Provar explicitamente que o helper usa:
  // - FIRST_EXCESS_GRID_PENALTY
  // - SUBSEQUENT_EXCESS_GRID_PENALTY
  // nas transições corretas: PU5 → primeira excedente, PU6+ → subsequente.
  describe('T13 — CONSTANTES 10/5 E TRANSIÇÕES', () => {
    it('transição PU4 -> PU5 usa FIRST_EXCESS_GRID_PENALTY e PU5 -> PU6 usa SUBSEQUENT_EXCESS_GRID_PENALTY', () => {
      // Provar valores das constantes exportadas
      expect(FIRST_EXCESS_GRID_PENALTY).toBe(10)
      expect(SUBSEQUENT_EXCESS_GRID_PENALTY).toBe(5)

      // Piloto com 4 unidades: próxima é PU5 (1ª excedente)
      const h4: PowerUnitHistoryEntry[] = [1, 2, 3, 4].map((n) =>
        createEntry(n, 'drv_gasly', 2026, n),
      )
      const res5 = resolveDriverPowerUnitQuota(h4, 'drv_gasly', 2026)
      expect(res5.nextUnitNumber).toBe(5)
      expect(res5.exceedsQuota).toBe(true)
      expect(res5.gridPenaltyPositions).toBe(FIRST_EXCESS_GRID_PENALTY)

      // Piloto com 5 unidades: próxima é PU6 (subsequente)
      const h5: PowerUnitHistoryEntry[] = [...h4, createEntry(5, 'drv_gasly', 2026, 5)]
      const res6 = resolveDriverPowerUnitQuota(h5, 'drv_gasly', 2026)
      expect(res6.nextUnitNumber).toBe(6)
      expect(res6.exceedsQuota).toBe(true)
      expect(res6.gridPenaltyPositions).toBe(SUBSEQUENT_EXCESS_GRID_PENALTY)

      // Piloto com 6 unidades: próxima é PU7 (subsequente)
      const h6: PowerUnitHistoryEntry[] = [...h5, createEntry(6, 'drv_gasly', 2026, 6)]
      const res7 = resolveDriverPowerUnitQuota(h6, 'drv_gasly', 2026)
      expect(res7.nextUnitNumber).toBe(7)
      expect(res7.exceedsQuota).toBe(true)
      expect(res7.gridPenaltyPositions).toBe(SUBSEQUENT_EXCESS_GRID_PENALTY)
    })
  })
})
