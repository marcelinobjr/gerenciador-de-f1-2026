/**
 * canonical-stint-intervals.ts
 *
 * Helper canônico para cálculo e formatação de intervalos de stints.
 *
 * Convenção do motor e da FIA:
 * Se targetPitLap do stint 1 for 24 numa corrida de 58 voltas:
 * - Stint 1: voltas 1–24 (parada ao final da volta 24)
 * - Stint 2: voltas 25–58 (inicia na volta 25 e vai até a volta final da corrida)
 *
 * Em estratégias de 2 ou mais paradas (ex: pits na volta 18 e 38 em 58 voltas):
 * - Stint 1: voltas 1–18
 * - Stint 2: voltas 19–38
 * - Stint 3: voltas 39–58
 */

export interface StintIntervalInfo {
  stintIndex: number
  startLap: number
  endLap: number
  isFirst: boolean
  isLast: boolean
  formattedLabel: string
}

export function computeStintIntervals(
  stints: Array<{ targetPitLap: number }>,
  totalLaps: number,
): StintIntervalInfo[] {
  const safeTotal = Math.max(1, totalLaps || 58)
  const count = stints.length

  if (count === 0) {
    return [
      {
        stintIndex: 0,
        startLap: 1,
        endLap: safeTotal,
        isFirst: true,
        isLast: true,
        formattedLabel: `Voltas 1–${safeTotal}`,
      },
    ]
  }

  let currentStart = 1
  return stints.map((stint, idx) => {
    const isFirst = idx === 0
    const isLast = idx === count - 1

    let endLap: number
    if (isLast) {
      endLap = safeTotal
    } else {
      endLap = Math.max(currentStart, Math.min(safeTotal, stint.targetPitLap))
    }

    const startLap = currentStart
    const formattedLabel =
      startLap === endLap
        ? `Volta ${startLap}`
        : isLast
          ? `Voltas ${startLap}–${endLap}`
          : `Voltas ${startLap}–${endLap}`

    // Próximo stint inicia na volta seguinte à parada
    currentStart = endLap + 1

    return {
      stintIndex: idx,
      startLap,
      endLap,
      isFirst,
      isLast,
      formattedLabel,
    }
  })
}
