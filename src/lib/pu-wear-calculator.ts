/**
 * pu-wear-calculator.ts
 *
 * Módulo de cálculo do desgaste da Unidade de Potência (PU) da F1.
 * Especificação v0.0.118+:
 * - Base: 12.0%
 * - Calor de asfalto: +0.15%/°C para temperaturas acima de 30°C (máximo +4.0%)
 * - Clima / Chuva: pista molhada exige menos do motor a pleno regime (-2.0% para chuva fraca, -4.0% para forte, mantendo piso mínimo 8.0%)
 * - Intensidade (pilotagem / ataque): até +2.0%
 * - Setup agressivo de MGU (pu_electric_ratio > 65): +6.0%
 * - Modo "Preservar Carro": multiplicador de 0.85 (redução de 15%)
 * - Arredondamento final Math.round; faixa normal resultante: ~12-18%
 */

export interface CalculatePUWearParams {
  trackTemp?: number
  weather?: 'seco' | 'chuva_fraca' | 'chuva_forte' | string
  aggressiveMGU?: boolean
  aggressivePace?: boolean
  preserveCarUsed?: boolean
}

export interface PUWearResult {
  wearIncrement: number // Valor final arredondado
  baseWear: number
  heatModifier: number
  weatherModifier: number
  mguModifier: number
  paceModifier: number
  preserveMultiplier: number
  summary: string // Resumo legível (ex: "Consumiu 14%: base 12%, calor +2%, MGU +6%, preservado")
}

export function calculatePUWear(params: CalculatePUWearParams): PUWearResult {
  const baseWear = 12.0

  // 1. Calor de asfalto
  const trackTemp =
    typeof params.trackTemp === 'number' && !isNaN(params.trackTemp) ? params.trackTemp : 28
  let heatModifier = 0
  if (trackTemp > 30) {
    heatModifier = Math.min(4.0, Number(((trackTemp - 30) * 0.15).toFixed(2)))
  }

  // 2. Clima / Chuva
  let weatherModifier = 0
  if (params.weather === 'chuva_forte') {
    weatherModifier = -4.0
  } else if (params.weather === 'chuva_fraca') {
    weatherModifier = -2.0
  }

  // 3. Intensidade de pilotagem / ataque
  const paceModifier = params.aggressivePace ? 2.0 : 0.0

  // 4. MGU agressivo (pu_electric_ratio > 65%)
  const mguModifier = params.aggressiveMGU ? 6.0 : 0.0

  // Soma prévia com piso mínimo de 8.0 antes de aplicar preserve
  let rawWear = baseWear + heatModifier + weatherModifier + paceModifier + mguModifier
  rawWear = Math.max(8.0, rawWear)

  // 5. Redutor se usou modo "Preservar Carro"
  const preserveMultiplier = params.preserveCarUsed ? 0.85 : 1.0
  rawWear = rawWear * preserveMultiplier

  const finalWear = Math.max(5, Math.round(rawWear))

  // Gerar resumo legível e detalhado
  const factorParts: string[] = [`base ${baseWear}%`]

  if (heatModifier > 0) {
    factorParts.push(`calor +${heatModifier.toFixed(1)}% (${trackTemp}°C)`)
  }
  if (weatherModifier < 0) {
    factorParts.push(`chuva ${weatherModifier.toFixed(1)}%`)
  }
  if (paceModifier > 0) {
    factorParts.push('ataque +2%')
  }
  if (mguModifier > 0) {
    factorParts.push('MGU +6%')
  }
  if (params.preserveCarUsed) {
    factorParts.push('preservado (-15%)')
  }

  const summary = `Consumiu ${finalWear}%: ${factorParts.join(', ')}.`

  return {
    wearIncrement: finalWear,
    baseWear,
    heatModifier,
    weatherModifier,
    mguModifier,
    paceModifier,
    preserveMultiplier,
    summary,
  }
}
