import { TireCompound, TireSetItem } from '@/types/f1'

export type TrackWeatherState = 'seco' | 'chuva_fraca' | 'chuva_forte'

export interface CompoundSpeedSpec {
  name: string
  label: string
  color: string
  deltaPerLapSec: number // Em relação ao Médio em pista seca (0.0s). Negativo = mais rápido
  wearFactor: number // Taxa de degradação
  drySuitability: number // 1.0 = ótimo, 0.2 = péssimo (chuva no seco)
  lightRainSuitability: number
  heavyRainSuitability: number
  description: string
}

export const TIRE_SPECS: Record<TireCompound, CompoundSpeedSpec> = {
  macio: {
    name: 'Macio (C4/C5)',
    label: 'Macio',
    color: '#EF4444',
    deltaPerLapSec: -0.75, // ~0.75s mais rápido que o médio
    wearFactor: 3.4,
    drySuitability: 1.0,
    lightRainSuitability: 0.15,
    heavyRainSuitability: 0.05,
    description: 'Mais rápido (~0.75s/volta vs médio), alto grip mecânico e degradação rápida.',
  },
  medio: {
    name: 'Médio (C3)',
    label: 'Médio',
    color: '#EAB308',
    deltaPerLapSec: 0.0, // Referência
    wearFactor: 2.2,
    drySuitability: 1.0,
    lightRainSuitability: 0.12,
    heavyRainSuitability: 0.04,
    description: 'Equilíbrio ideal entre ritmo de corrida e vida útil em pista seca.',
  },
  duro: {
    name: 'Duro (C1/C2)',
    label: 'Duro',
    color: '#F8FAFC',
    deltaPerLapSec: +0.6, // ~0.6s mais lento que o médio
    wearFactor: 1.4,
    drySuitability: 1.0,
    lightRainSuitability: 0.1,
    heavyRainSuitability: 0.03,
    description: 'Mais lento (~0.6s/volta vs médio), máxima durabilidade e consistência.',
  },
  intermediario: {
    name: 'Intermediário (Inters)',
    label: 'Intermediário',
    color: '#10B981',
    deltaPerLapSec: +3.8, // Em pista seca é muito lento (+3.8s) e sobreaquece
    wearFactor: 2.5,
    drySuitability: 0.25,
    lightRainSuitability: 1.0, // Perfeito em chuva fraca
    heavyRainSuitability: 0.45, // Risco em chuva forte / aquaplanagem
    description: 'Pneu com sulcos para chuva fraca e pista secando. Sobreaquece no seco.',
  },
  chuva_extrema: {
    name: 'Chuva Extrema (Wets)',
    label: 'Chuva Extrema',
    color: '#3B82F6',
    deltaPerLapSec: +6.5, // No seco é pesadíssimo (+6.5s)
    wearFactor: 2.8,
    drySuitability: 0.15,
    lightRainSuitability: 0.65, // Mais lento que intermediário em pouca água
    heavyRainSuitability: 1.0, // Indispensável em tempestade (drena 85L/s)
    description: 'Drena 85L/s de água. Obrigatório em chuva forte e poças profundas.',
  },
}

/**
 * Cria a alocação inicial completa de jogos de pneus individuais para o fim de semana.
 * Cada piloto tem: 2 duros / 3 médios / 3 macios / 4 intermediários / 3 chuva extrema
 */
export function createInitialTireInventory(): TireSetItem[] {
  const inventory: TireSetItem[] = []

  // 2 Duros
  for (let i = 1; i <= 2; i++) {
    inventory.push({ id: `duro_${i}`, compound: 'duro', wear: 0, lapsUsed: 0 })
  }
  // 3 Médios
  for (let i = 1; i <= 3; i++) {
    inventory.push({ id: `medio_${i}`, compound: 'medio', wear: 0, lapsUsed: 0 })
  }
  // 3 Macios
  for (let i = 1; i <= 3; i++) {
    inventory.push({ id: `macio_${i}`, compound: 'macio', wear: 0, lapsUsed: 0 })
  }
  // 4 Intermediários
  for (let i = 1; i <= 4; i++) {
    inventory.push({ id: `intermediario_${i}`, compound: 'intermediario', wear: 0, lapsUsed: 0 })
  }
  // 3 Chuva Extrema
  for (let i = 1; i <= 3; i++) {
    inventory.push({ id: `chuva_extrema_${i}`, compound: 'chuva_extrema', wear: 0, lapsUsed: 0 })
  }

  return inventory
}

/**
 * Calcula o tempo de pit stop detalhado para uma equipe/piloto:
 * Varia pela qualidade do pit crew, com 8% de chance de erro/parada lenta (porca presa, macaco escorregando: +4 a +8s)
 */
export interface PitStopTimingResult {
  durationSec: number
  isSlowPit: boolean
  slowReason?: string
  narrativeText: string
}

/**
 * Calcula o multiplicador de desgaste de pneus individual do piloto baseado em seus atributos.
 * - Alta consistência poupa pneu (desgasta menos).
 * - Alta velocidade / estilo agressivo desgasta mais.
 * - Condição física baixa desgasta mais (pilotagem errática com cansaço).
 * - Moral alta ajuda no foco e gerenciamento.
 * Retorna um multiplicador (ex: 0.82 a 1.25) e o perfil legível em PT-BR.
 */
export interface DriverTireWearProfile {
  multiplier: number // ex: 0.95 = gasta 5% menos; 1.15 = gasta 15% mais
  profileName: 'Muito Conservador' | 'Conservador' | 'Moderado' | 'Agressivo' | 'Muito Agressivo'
  badgeColor: string
  description: string
}

export function calculateDriverTireWearProfile(driver: {
  speed?: number
  consistency?: number
  physical_condition?: number
  morale?: number
  defense?: number
}): DriverTireWearProfile {
  const speed = driver.speed ?? 80
  const consistency = driver.consistency ?? 80
  const physical = driver.physical_condition ?? 90
  const morale = driver.morale ?? 80

  // Consistência reduz desgaste: cada 10 pts acima de 80 poupa ~4%
  const consistencyDelta = (consistency - 80) * -0.005
  // Velocidade/agressividade aumenta desgaste: cada 10 pts acima de 80 consome ~3.5%
  const speedDelta = (speed - 80) * 0.004
  // Cansaço físico prejudica a preservação da borracha
  const fitnessDelta = (85 - physical) * 0.003
  // Moral melhora o cuidado dos pneus
  const moraleDelta = (80 - morale) * 0.002

  let multiplier = 1.0 + consistencyDelta + speedDelta + fitnessDelta + moraleDelta
  // Clamp entre 0.78 e 1.28
  multiplier = Math.max(0.78, Math.min(1.28, Number(multiplier.toFixed(2))))

  let profileName: DriverTireWearProfile['profileName'] = 'Moderado'
  let badgeColor = 'text-amber-400 border-amber-500/40 bg-amber-500/10'
  let description = 'Equilíbrio padrão entre agressividade em volta rápida e conservação de pneus.'

  if (multiplier <= 0.86) {
    profileName = 'Muito Conservador'
    badgeColor = 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
    description = 'Mestre na gestão de borracha (estilo Perez/Button). Poupa até 20% do desgaste!'
  } else if (multiplier <= 0.95) {
    profileName = 'Conservador'
    badgeColor = 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10'
    description = 'Alta consistência, desgasta menos os pneus que a média do grid.'
  } else if (multiplier <= 1.06) {
    profileName = 'Moderado'
    badgeColor = 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10'
    description = 'Gestão equilibrada de desgaste em condições normais de corrida.'
  } else if (multiplier <= 1.16) {
    profileName = 'Agressivo'
    badgeColor = 'text-orange-400 border-orange-500/40 bg-orange-500/10'
    description = 'Ritmo forte e frenagens no limite. Consome mais borracha por volta.'
  } else {
    profileName = 'Muito Agressivo'
    badgeColor = 'text-rose-400 border-rose-500/40 bg-rose-500/10'
    description = 'Ataque extremo e derrapagens controladas. Alta degradação dos pneus!'
  }

  return { multiplier, profileName, badgeColor, description }
}

export function calculatePitStopDuration(
  teamName: string,
  driverName: string,
  isPlayer: boolean,
  teamStrength = 75,
): PitStopTimingResult {
  // Red Bull, Ferrari, McLaren têm mecânicos mais rápidos (~2.1s a 2.6s)
  // Equipes médias/novatas variam de 2.5s a 3.5s
  const baseRating = Math.max(50, Math.min(100, teamStrength))
  const efficiency = (baseRating - 50) / 50 // 0 a 1

  const bestBase = 2.1
  const variance = (1 - efficiency) * 0.8 + Math.random() * 0.5
  let duration = Number((bestBase + variance).toFixed(2))

  // Chance de erro / pit stop lento: ~7%
  const errorRoll = Math.random()
  const isSlowPit = errorRoll < 0.07

  let slowReason = ''
  if (isSlowPit) {
    const extra = 4.2 + Math.random() * 4.3 // +4.2s a +8.5s
    duration = Number((duration + extra).toFixed(2))
    const errorTypes = [
      'porca da roda traseira esquerda travou',
      'falha no macaco dianteiro no levantamento',
      'liberação atrasada pelo tráfego de pit lane',
      'ajuste manual de asa dianteira encavalou',
      'pistola pneumática falhou na troca da roda dianteira direita',
    ]
    slowReason = errorTypes[Math.floor(Math.random() * errorTypes.length)]
  }

  let narrativeText = ''
  if (isSlowPit) {
    narrativeText = `⚠️ PIT STOP LENTO! Problema nos boxes de ${driverName} (${teamName}): ${slowReason}! Parada dramática de ${duration}s!`
  } else if (duration <= 2.3) {
    narrativeText = `⚡ PIT STOP CIRÚRGICO! Parada perfeita de ${duration}s para ${driverName} (${teamName})! Troca relâmpago dos mecânicos!`
  } else {
    narrativeText = `🔧 Box de ${driverName} (${teamName}): Parada realizada em ${duration}s com troca limpa de pneus.`
  }

  return {
    durationSec: duration,
    isSlowPit,
    slowReason: isSlowPit ? slowReason : undefined,
    narrativeText,
  }
}

/**
 * Calcula o delta de pontuação/desempenho por volta de acordo com o composto e o clima atual.
 * Leva em consideração o desgaste percentual (pneu novo = 100% aderência; x% desgaste = perda de aderência).
 */
export function calculateLapPerformanceScoreDelta(
  compound: TireCompound,
  wearPercent: number,
  weather: TrackWeatherState,
): { scoreDelta: number; warning?: string; aquaplaningRisk: boolean } {
  const spec = TIRE_SPECS[compound] || TIRE_SPECS.medio
  let scoreDelta = 0
  let aquaplaningRisk = false
  let warning: string | undefined

  // 1. Delta base do composto em relação ao Médio seco
  // Cada 0.1s de delta equivale a ~1.8 pontos de score na simulação
  // Negativo = mais rápido (ganha pontos de ritmo)
  const compoundBasePoints = -spec.deltaPerLapSec * 18
  scoreDelta += compoundBasePoints

  // 2. Penalidade por desgaste % (pneu usado perde grip linear e acelerado após 65%)
  const wearPenalty =
    wearPercent < 30
      ? wearPercent * 0.15
      : wearPercent < 65
        ? 4.5 + (wearPercent - 30) * 0.35
        : 16.75 + (wearPercent - 65) * 0.95
  scoreDelta -= wearPenalty

  // 3. Adequação climática
  if (weather === 'seco') {
    if (compound === 'intermediario') {
      scoreDelta -= 45 // Pneu de chuva no seco perde muito ritmo e superaquece
      warning = 'Intermediários sobreaquecendo severamente no asfalto seco!'
    } else if (compound === 'chuva_extrema') {
      scoreDelta -= 75
      warning = 'Chuva Extrema destruindo a borracha no asfalto seco!'
    }
  } else if (weather === 'chuva_fraca') {
    if (compound === 'duro' || compound === 'medio' || compound === 'macio') {
      scoreDelta -= 65 // Slicks na chuva fraca
      warning = 'Pneus slick sem aderência na chuva fraca! Escorregando nas zebras.'
      aquaplaningRisk = Math.random() < 0.15
    } else if (compound === 'intermediario') {
      scoreDelta += 15 // Composto perfeito!
    } else if (compound === 'chuva_extrema') {
      scoreDelta -= 12 // Chuva extrema é pesada para pouca água
      warning = 'Chuva Extrema sofrendo com arrasto e desgaste em pista apenas úmida.'
    }
  } else if (weather === 'chuva_forte') {
    if (compound === 'duro' || compound === 'medio' || compound === 'macio') {
      scoreDelta -= 120 // Perda colossal
      warning = 'PERIGO: Pneus slick em pista inundada! Risco altíssimo de aquaplanagem!'
      aquaplaningRisk = true
    } else if (compound === 'intermediario') {
      scoreDelta -= 28 // Inters aquaplana em tempestade
      warning = 'Intermediários não drenam volume suficiente de água! Aquaplanando em poças.'
      aquaplaningRisk = Math.random() < 0.32
    } else if (compound === 'chuva_extrema') {
      scoreDelta += 25 // Composto perfeito para tempestade
    }
  }

  return { scoreDelta, warning, aquaplaningRisk }
}
