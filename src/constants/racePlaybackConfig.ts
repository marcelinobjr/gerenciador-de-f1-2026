/**
 * RACE-CONTROL-COMPACT-01
 * Configuração centralizada e imutável da cadência de reprodução da UI do Race Control.
 *
 * REGRA ABSOLUTA:
 * Esta cadência afeta ESTRITAMENTE a orquestração temporal dos intervalos de tick da interface React (setInterval).
 * NÃO altera física, pace, tempos de volta, estratégia, pneus, clima, resultados, PRNG ou regras esportivas.
 *
 * BASELINE ANTERIOR:
 * 1x = 1.000 ms (1 segundo por volta na simulação da UI)
 * 2x = 500 ms
 * 4x = 250 ms
 *
 * NOVO BASELINE (50% mais lento / 2× tempo de exibição):
 * novo 1x = 2.000 ms (progressão que demorava T agora demora 2T)
 * novo 2x = 1.000 ms (2× novo baseline)
 * novo 4x = 500 ms (4× novo baseline)
 */

export const RACE_PLAYBACK_CONFIG = {
  /**
   * Intervalo base para velocidade 1x em milissegundos.
   * Cadência 50% mais lenta = 2.000 ms por volta.
   */
  BASE_INTERVAL_MS: 2000,

  /**
   * Fatores multiplicadores suportados.
   */
  SPEED_MULTIPLIERS: [1, 2, 4] as const,

  /**
   * Calcula o intervalo em milissegundos para uma dada velocidade (1, 2 ou 4).
   */
  resolveIntervalMs: (speed: 1 | 2 | 4): number => {
    return Math.round(RACE_PLAYBACK_CONFIG.BASE_INTERVAL_MS / speed)
  },
} as const

export type RacePlaybackSpeed = (typeof RACE_PLAYBACK_CONFIG.SPEED_MULTIPLIERS)[number]
