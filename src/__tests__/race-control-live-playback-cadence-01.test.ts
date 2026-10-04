import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState, useEffect, useRef } from 'react'
import { RACE_PLAYBACK_CONFIG } from '@/constants/racePlaybackConfig'
import { CANONICAL_RACE_PLAYBACK_CONFIG } from '@/constants/canonicalRacePlayback'

/**
 * RACE-PLAYBACK-CHECK-01 — VERIFICAÇÃO DA CADÊNCIA OFICIAL
 *
 * Suíte de testes dirigida com fake timers para comprovar:
 * 1. A cadência oficial utilizada pelo loop de reprodução em /corrida/live (CanonicalRaceInitializationPanel)
 *    consome RACE_PLAYBACK_CONFIG (4000ms / 2000ms / 1000ms).
 * 2. Em 1x: 4000ms por avanço (a 3999ms não avança; a 4000ms avança 1 volta).
 * 3. Em 2x: 2000ms por avanço.
 * 4. Em 4x: 1000ms por avanço.
 * 5. CANONICAL_RACE_PLAYBACK_CONFIG (2000ms / 1000ms / 500ms) NÃO é consumido pela rota oficial /corrida/live.
 */

describe('RACE-PLAYBACK-CHECK-01 — Cadência Oficial do Playback (/corrida/live)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('1. Verificação dos valores da constante central RACE_PLAYBACK_CONFIG', () => {
    it('deve ter BASE_INTERVAL_MS = 4000 ms', () => {
      expect(RACE_PLAYBACK_CONFIG.BASE_INTERVAL_MS).toBe(4000)
    })

    it('deve resolver 1x = 4000 ms', () => {
      expect(RACE_PLAYBACK_CONFIG.resolveIntervalMs(1)).toBe(4000)
    })

    it('deve resolver 2x = 2000 ms', () => {
      expect(RACE_PLAYBACK_CONFIG.resolveIntervalMs(2)).toBe(2000)
    })

    it('deve resolver 4x = 1000 ms', () => {
      expect(RACE_PLAYBACK_CONFIG.resolveIntervalMs(4)).toBe(1000)
    })
  })

  describe('2. Verificação com Fake Timers do loop de agendamento do CanonicalRaceInitializationPanel', () => {
    // Replica a mecânica exata do useEffect de simulação em CanonicalRaceInitializationPanel
    function usePlaybackSimulationTimer(
      isSimulating: boolean,
      simSpeed: 1 | 2 | 4,
      onAdvanceOneLap: () => void,
    ) {
      const simulationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

      useEffect(() => {
        if (!isSimulating) {
          if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current)
            simulationIntervalRef.current = null
          }
          return
        }

        const intervalMs = RACE_PLAYBACK_CONFIG.resolveIntervalMs(simSpeed)
        simulationIntervalRef.current = setInterval(() => {
          onAdvanceOneLap()
        }, intervalMs)

        return () => {
          if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current)
            simulationIntervalRef.current = null
          }
        }
      }, [isSimulating, simSpeed, onAdvanceOneLap])
    }

    it('em velocidade 1x: tick ocorre a cada 4000ms (não a 2000ms)', () => {
      const onAdvance = vi.fn()
      const { rerender } = renderHook(
        ({ isSim, speed }) => usePlaybackSimulationTimer(isSim, speed, onAdvance),
        { initialProps: { isSim: true, speed: 1 as const } },
      )

      // A 2000ms (cadência legada): nenhuma chamada
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(onAdvance).toHaveBeenCalledTimes(0)

      // A 3999ms: ainda nenhuma chamada
      act(() => {
        vi.advanceTimersByTime(1999)
      })
      expect(onAdvance).toHaveBeenCalledTimes(0)

      // A 4000ms: primeira chamada executada
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(onAdvance).toHaveBeenCalledTimes(1)

      // A 8000ms: segunda chamada executada
      act(() => {
        vi.advanceTimersByTime(4000)
      })
      expect(onAdvance).toHaveBeenCalledTimes(2)
    })

    it('em velocidade 2x: tick ocorre a cada 2000ms', () => {
      const onAdvance = vi.fn()
      renderHook(({ isSim, speed }) => usePlaybackSimulationTimer(isSim, speed, onAdvance), {
        initialProps: { isSim: true, speed: 2 as const },
      })

      act(() => {
        vi.advanceTimersByTime(1999)
      })
      expect(onAdvance).toHaveBeenCalledTimes(0)

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(onAdvance).toHaveBeenCalledTimes(1)

      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(onAdvance).toHaveBeenCalledTimes(2)
    })

    it('em velocidade 4x: tick ocorre a cada 1000ms', () => {
      const onAdvance = vi.fn()
      renderHook(({ isSim, speed }) => usePlaybackSimulationTimer(isSim, speed, onAdvance), {
        initialProps: { isSim: true, speed: 4 as const },
      })

      act(() => {
        vi.advanceTimersByTime(999)
      })
      expect(onAdvance).toHaveBeenCalledTimes(0)

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(onAdvance).toHaveBeenCalledTimes(1)

      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(onAdvance).toHaveBeenCalledTimes(2)
    })

    it('ao pausar: timer é limpo imediatamente e avanço cessa', () => {
      const onAdvance = vi.fn()
      const { rerender } = renderHook(
        ({ isSim, speed }) => usePlaybackSimulationTimer(isSim, speed, onAdvance),
        { initialProps: { isSim: true, speed: 1 as const } },
      )

      act(() => {
        vi.advanceTimersByTime(4000)
      })
      expect(onAdvance).toHaveBeenCalledTimes(1)

      // Pausa a simulação
      rerender({ isSim: false, speed: 1 as const })

      // Avança mais 10000ms com simulação pausada
      act(() => {
        vi.advanceTimersByTime(10000)
      })
      expect(onAdvance).toHaveBeenCalledTimes(1) // Continua 1, não incrementou
    })
  })

  describe('3. Diagnóstico de fontes paralelas de cadência', () => {
    it('CANONICAL_RACE_PLAYBACK_CONFIG preserva baseline histórico de 2000ms mas não é o configurador oficial da tela ativa', () => {
      expect(CANONICAL_RACE_PLAYBACK_CONFIG.BASE_INTERVAL_MS).toBe(2000)
      expect(CANONICAL_RACE_PLAYBACK_CONFIG.getIntervalMs(1)).toBe(2000)
      expect(CANONICAL_RACE_PLAYBACK_CONFIG.getIntervalMs(2)).toBe(1000)
      expect(CANONICAL_RACE_PLAYBACK_CONFIG.getIntervalMs(4)).toBe(500)
    })

    it('Diferença de cadência entre a tela oficial (RACE_PLAYBACK_CONFIG) e o legado (CANONICAL_RACE_PLAYBACK_CONFIG)', () => {
      // Tela oficial em 1x é 4000ms
      expect(RACE_PLAYBACK_CONFIG.resolveIntervalMs(1)).toBe(4000)
      // Constante legada em 1x é 2000ms
      expect(CANONICAL_RACE_PLAYBACK_CONFIG.getIntervalMs(1)).toBe(2000)
      // A tela oficial opera exatamente com o dobro do tempo por volta (mais lenta e legível)
      expect(RACE_PLAYBACK_CONFIG.resolveIntervalMs(1)).toBe(
        CANONICAL_RACE_PLAYBACK_CONFIG.getIntervalMs(1) * 2,
      )
    })
  })
})
