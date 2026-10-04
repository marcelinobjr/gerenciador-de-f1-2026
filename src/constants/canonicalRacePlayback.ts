/**
 * CANONICAL RACE PLAYBACK CONFIGURATION
 * 
 * Centraliza estritamente os intervalos temporais da cadência de UI da corrida (Race Control).
 * REGRA ABSOLUTA: Velocidade de reprodução de UI, NÃO velocidade esportiva dos carros.
 * Zero alteração em lap time, pace, degradação, consumo, gaps ou PRNG.
 * 
 * Nova relação (RACE-CONTROL-COMPACT-01):
 * - Baseline anterior: 1000ms no 1x.
 * - Novo 1x: 50% da velocidade atual (progressão que demorava T agora demora ~2T no 1x) => 2000ms.
 * - 2x: 2 × novo baseline (1000ms).
 * - 4x: 4 × novo baseline (500ms).
 */

export const CANONICAL_RACE_PLAYBACK_CONFIG = {
  /**
   * Intervalo base de reprodução em milissegundos para velocidade 1x.
   * Anterior: 1000ms -> Novo: 2000ms (50% mais lento visualmente).
   */
  BASE_INTERVAL_MS: 2000,
  /**
   * Fatores de aceleração suportados pela UI do Race Control.
   */
  SPEED_FACTORS: [1, 2, 4] as const,
  /**
   * Retorna o intervalo em milissegundos para a velocidade solicitada.
   */
  getIntervalMs: (speed: 1 | 2 | 4): number => {
    return Math.round(CANONICAL_RACE_PLAYBACK_CONFIG.BASE_INTERVAL_MS / speed)
  },
} as const

export type CanonicalRaceSpeed = typeof CANONICAL_RACE_PLAYBACK_CONFIG.SPEED_FACTORS[number]
