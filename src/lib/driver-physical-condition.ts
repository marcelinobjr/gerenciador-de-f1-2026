/**
 * driver-physical-condition.ts
 *
 * Módulo de modelagem de Condição Física dos Pilotos:
 *
 * 1. CUSTO FÍSICO POR CORRIDA (Rebalanceado):
 * Modulado pelas MESMAS condições da fórmula de desgaste de PU:
 * - Base: -5% em condições amenas;
 * - Calor de asfalto acima de 30°C aumenta o custo (até -8% total, ex: +0.15%/°C ou interpolação suave);
 * - Chuva fraca: -1% / Chuva forte: -2% (pilotagem fisicamente menos exigente em termos de forças G sustentadas);
 * - Intensidade (empurrar/modo ataque): +1% de desgaste adicional;
 * - Circuito fisicamente exigente (ex.: Singapura, Sepang, Interlagos): +2% de desgaste;
 * - Faixa alvo: corrida custa ~4-8% da condição física;
 * - Gera motivo legível explicativo (ex: "-7% — calor de 38°C, pilotagem agressiva, circuito exigente").
 *
 * 2. RECUPERAÇÃO ENTRE RODADAS:
 * - Titular que correu: +5% por rodada (antes +2%);
 * - Reserva sem correr: +8% por rodada (antes +6%);
 * - Piloto lesionado / afastado: +10% por rodada (antes +8%);
 * - Assim a física oscila em ~70-95% durante o campeonato e não desaba a zero!
 */

export interface CalculateDriverPhysicalCostParams {
  trackTemp?: number
  weather?: 'seco' | 'chuva_fraca' | 'chuva_forte' | string
  isDemandingCircuit?: boolean
  isAggressivePace?: boolean
  simulatorLevel?: number // Nível 1 a 5 do Simulador Dinâmico da equipe
}

export interface DriverPhysicalCostResult {
  cost: number // Ex: 6 (positivo, representa a quantidade gasta)
  delta: number // Ex: -6 (valor negativo para somar)
  reason: string // Ex: "-6% — base 5%, calor de 36°C (+1%), circuito exigente (+2%), chuva fraca (-1%)"
}

export function calculateDriverPhysicalCost(
  params: CalculateDriverPhysicalCostParams,
): DriverPhysicalCostResult {
  const baseCost = 5.0
  const reasons: string[] = []

  // 1. Calor de asfalto acima de 30°C: adiciona até +3% de custo (total base+calor máx 8%)
  const trackTemp =
    typeof params.trackTemp === 'number' && !isNaN(params.trackTemp) ? params.trackTemp : 28

  let heatExtra = 0
  if (trackTemp > 30) {
    // 30°C -> 0, 40°C -> +1.5, 50°C -> +3.0 (máx 3.0)
    heatExtra = Math.min(3.0, (trackTemp - 30) * 0.15)
  }

  // 2. Clima / Chuva: -1 fraca, -2 forte
  let rainMod = 0
  if (params.weather === 'chuva_forte') {
    rainMod = -2.0
  } else if (params.weather === 'chuva_fraca') {
    rainMod = -1.0
  }

  // 3. Intensidade (ataque / empurrar): +1%
  const paceMod = params.isAggressivePace ? 1.0 : 0.0

  // 4. Circuito fisicamente exigente: +2%
  const circuitMod = params.isDemandingCircuit ? 2.0 : 0.0

  // 5. Bônus conservador do Simulador da equipe: atenua fadiga em 0.5% por nível acima do Nível 1 (até -2%)
  const simLevel = params.simulatorLevel ?? 3
  const simDiscount = Math.max(0, (simLevel - 1) * 0.5)

  // Total raw antes de clampar
  const rawCost = baseCost + heatExtra + rainMod + paceMod + circuitMod - simDiscount

  // Clampar entre 4 e 10 (alvo normal 4-8%)
  const finalCost = Math.max(3, Math.min(10, Math.round(rawCost)))
  const delta = -finalCost

  // Montar justificativa legível
  if (heatExtra >= 0.5) {
    reasons.push(`calor de ${Math.round(trackTemp)}°C`)
  }
  if (params.isAggressivePace) {
    reasons.push('pilotagem agressiva')
  }
  if (params.isDemandingCircuit) {
    reasons.push('circuito exigente')
  }
  if (params.weather === 'chuva_forte') {
    reasons.push('chuva intensa')
  } else if (params.weather === 'chuva_fraca') {
    reasons.push('pista molhada')
  }
  if (simDiscount >= 0.5) {
    reasons.push(`preparo no simulador (-${simDiscount.toFixed(1)}%)`)
  }

  const reasonDetail = reasons.length > 0 ? reasons.join(', ') : 'condições amenas'
  const reason = `${delta}% — ${reasonDetail}`

  return {
    cost: finalCost,
    delta,
    reason,
  }
}

/**
 * Taxas de recuperação física entre etapas:
 * - Titular: +5%
 * - Reserva: +8%
 * - Lesionado: +10%
 */
export const PHYSICAL_RECOVERY = {
  TITULAR: 5,
  RESERVA: 8,
  INCAPACITATED: 10,
} as const
