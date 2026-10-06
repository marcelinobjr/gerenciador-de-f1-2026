/**
 * bug-weekend-reset-generation-01.test.ts
 *
 * TAREFA: RESET-FIX-1 — Suíte dedicada de testes para geração/revision persistente por rodada.
 *
 * G1 — BASELINE: rodada sem generation anterior → getWeekendGeneration retorna baseline válido (1).
 * G2 — RESET INCREMENTA: ler N; resetWeekendForRound; ler novamente = próxima generation válida (N + 1).
 * G3 — RELOAD: criar nova instância/reler storage; generation pós-reset permanece a mesma.
 * G4 — ISOLAMENTO DE RODADA: resetar round A; round B não muda.
 * G5 — ISOLAMENTO DE CARREIRA: mesmo season/round em outra carreira não muda.
 * G6 — SEGUNDO RESET: resetar novamente; generation avança novamente sem colisão (N + 2).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getWeekendGeneration,
  getActiveWeekendGeneration,
  bumpWeekendGeneration,
  getWeekendGenerationStorageKey,
  resetWeekendForRound,
} from '@/services/weekendProgressionService'

describe('RESET-FIX-1 — Generation persistente por carreira, temporada e rodada (bug-weekend-reset-generation-01)', () => {
  const CAREER_A = 'career_alpha'
  const CAREER_B = 'career_beta'
  const SEASON_ID = 'season_2027_test'
  const ROUND_16 = 16
  const ROUND_17 = 17

  beforeEach(() => {
    localStorage.clear()
  })

  it('G1 — BASELINE: rodada sem generation anterior → getWeekendGeneration retorna baseline válido', () => {
    // Leitura via objeto de contexto
    const genContext = getWeekendGeneration({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_16,
    })
    expect(genContext).toBe(1)

    // Leitura via parâmetros posicionais
    const genPositional = getWeekendGeneration(SEASON_ID, ROUND_16, CAREER_A)
    expect(genPositional).toBe(1)

    // Alias getActiveWeekendGeneration
    const genActive = getActiveWeekendGeneration({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_16,
    })
    expect(genActive).toBe(1)
  })

  it('G2 — RESET INCREMENTA: ler N; resetWeekendForRound; ler novamente = próxima generation válida', () => {
    const context = { careerId: CAREER_A, seasonId: SEASON_ID, round: ROUND_16 }
    const initialGen = getWeekendGeneration(context)
    expect(initialGen).toBe(1)

    const resetResult = resetWeekendForRound({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_16,
    })

    expect(resetResult.success).toBe(true)
    expect(resetResult.newGeneration).toBe(initialGen + 1)

    const postResetGen = getWeekendGeneration(context)
    expect(postResetGen).toBe(initialGen + 1)
  })

  it('G3 — RELOAD: criar nova instância/reler storage; generation pós-reset permanece a mesma', () => {
    const context = { careerId: CAREER_A, seasonId: SEASON_ID, round: ROUND_16 }

    resetWeekendForRound({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_16,
    })

    const expectedGen = 2
    expect(getWeekendGeneration(context)).toBe(expectedGen)

    // Simulação de reload: chave no storage persistente
    const storageKey = getWeekendGenerationStorageKey(context)
    const storedValue = localStorage.getItem(storageKey)
    expect(storedValue).toBe(String(expectedGen))

    // Releitura a frio simulando nova montagem ou reload do navegador
    const reloadedGen = getWeekendGeneration({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_16,
    })
    expect(reloadedGen).toBe(expectedGen)
  })

  it('G4 — ISOLAMENTO DE RODADA: resetar round A; round B não muda', () => {
    const contextA = { careerId: CAREER_A, seasonId: SEASON_ID, round: ROUND_16 }
    const contextB = { careerId: CAREER_A, seasonId: SEASON_ID, round: ROUND_17 }

    // Ambos iniciam no baseline
    expect(getWeekendGeneration(contextA)).toBe(1)
    expect(getWeekendGeneration(contextB)).toBe(1)

    // Resetar apenas Round 16
    resetWeekendForRound({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_16,
    })

    // Round 16 avança para 2, Round 17 permanece intacto no baseline 1
    expect(getWeekendGeneration(contextA)).toBe(2)
    expect(getWeekendGeneration(contextB)).toBe(1)
  })

  it('G5 — ISOLAMENTO DE CARREIRA: mesmo season/round em outra carreira não muda', () => {
    const contextCareerA = { careerId: CAREER_A, seasonId: SEASON_ID, round: ROUND_16 }
    const contextCareerB = { careerId: CAREER_B, seasonId: SEASON_ID, round: ROUND_16 }

    // Ambas iniciam no baseline 1
    expect(getWeekendGeneration(contextCareerA)).toBe(1)
    expect(getWeekendGeneration(contextCareerB)).toBe(1)

    // Resetar Carreira A na Rodada 16
    resetWeekendForRound({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_16,
    })

    // Carreira A foi para geração 2; Carreira B continua isolada no baseline 1
    expect(getWeekendGeneration(contextCareerA)).toBe(2)
    expect(getWeekendGeneration(contextCareerB)).toBe(1)

    // Reset adicional de Carreira A não afeta Carreira B
    bumpWeekendGeneration(contextCareerA)
    expect(getWeekendGeneration(contextCareerA)).toBe(3)
    expect(getWeekendGeneration(contextCareerB)).toBe(1)
  })

  it('G6 — SEGUNDO RESET: resetar novamente; generation avança novamente sem colisão', () => {
    const context = { careerId: CAREER_A, seasonId: SEASON_ID, round: ROUND_16 }

    expect(getWeekendGeneration(context)).toBe(1)

    // Primeiro reset
    const res1 = resetWeekendForRound({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_16,
    })
    expect(res1.newGeneration).toBe(2)
    expect(getWeekendGeneration(context)).toBe(2)

    // Segundo reset
    const res2 = resetWeekendForRound({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_16,
    })
    expect(res2.newGeneration).toBe(3)
    expect(getWeekendGeneration(context)).toBe(3)

    // Terceiro reset
    const res3 = resetWeekendForRound({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_16,
    })
    expect(res3.newGeneration).toBe(4)
    expect(getWeekendGeneration(context)).toBe(4)
  })
})
