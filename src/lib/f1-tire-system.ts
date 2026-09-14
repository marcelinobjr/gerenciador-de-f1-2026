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
  baseLapsLife: number // Vida útil nominal em voltas de referência
  cliffLapThreshold: number // A partir de quantas voltas o pneu entra na zona de cliff
  cliffDegradationPerLapSec: number // Perda abrupta por volta adicional pós-cliff (+s/volta)
  cliffMaxPenaltySec: number // Perda máxima acumulada no cliff
  thermalLockupRiskBase: number // Risco térmico base de travada de roda / erro na janela crítica (0-1)
}

export const TIRE_SPECS: Record<TireCompound, CompoundSpeedSpec> = {
  macio: {
    name: 'Macio (C4/C5)',
    label: 'Macio',
    color: '#EF4444',
    deltaPerLapSec: -0.65, // ~0.65s mais rápido que o médio no auge, mas com custo alto
    wearFactor: 4.4, // Degradação acelerada
    drySuitability: 1.0,
    lightRainSuitability: 0.15,
    heavyRainSuitability: 0.05,
    description:
      'Mais rápido no pico inicial (~0.65s vs médio), mas com janela extremamente curta (cliff em ~10-12 voltas), alta propensão a superaquecimento e perda abrupta (+2.4s a +5.5s/volta).',
    baseLapsLife: 13,
    cliffLapThreshold: 11, // Cliff mais cedo
    cliffDegradationPerLapSec: 2.45, // Mais íngreme
    cliffMaxPenaltySec: 5.6,
    thermalLockupRiskBase: 0.45,
  },
  medio: {
    name: 'Médio (C3)',
    label: 'Médio',
    color: '#EAB308',
    deltaPerLapSec: 0.0, // Referência
    wearFactor: 2.1,
    drySuitability: 1.0,
    lightRainSuitability: 0.12,
    heavyRainSuitability: 0.04,
    description:
      'Equilíbrio ideal entre ritmo de corrida e vida útil em pista seca, cliff consistente (~24-27 voltas).',
    baseLapsLife: 26,
    cliffLapThreshold: 24,
    cliffDegradationPerLapSec: 1.25,
    cliffMaxPenaltySec: 3.5,
    thermalLockupRiskBase: 0.18,
  },
  duro: {
    name: 'Duro (C1/C2)',
    label: 'Duro',
    color: '#F8FAFC',
    deltaPerLapSec: +0.55, // ~0.55s mais lento que o médio
    wearFactor: 1.3,
    drySuitability: 1.0,
    lightRainSuitability: 0.1,
    heavyRainSuitability: 0.03,
    description:
      'Mais consistente (~0.55s/volta vs médio), durabilidade máxima para 1 parada, cliff tardio e suave (~36-40 voltas).',
    baseLapsLife: 40,
    cliffLapThreshold: 38,
    cliffDegradationPerLapSec: 0.7,
    cliffMaxPenaltySec: 2.2,
    thermalLockupRiskBase: 0.08,
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
    baseLapsLife: 26,
    cliffLapThreshold: 24,
    cliffDegradationPerLapSec: 1.0,
    cliffMaxPenaltySec: 2.8,
    thermalLockupRiskBase: 0.15,
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
    baseLapsLife: 22,
    cliffLapThreshold: 20,
    cliffDegradationPerLapSec: 1.1,
    cliffMaxPenaltySec: 3.0,
    thermalLockupRiskBase: 0.12,
  },
}

/**
 * Cria a alocação oficial da FIA de 13 jogos de pneus 100% individual por piloto:
 * 2 Duros (Branco)
 * 3 Médios (Amarelo)
 * 3 Macios (Vermelho)
 * 4 Intermediários (Verde)
 * 3 Chuva Extrema (Azul)
 * Total: 13 jogos sem compartilhamento entre companheiros de equipe.
 */
export function createInitialTireInventory(driverId?: string): TireSetItem[] {
  const inventory: TireSetItem[] = []
  const pfx = driverId ? `${driverId}_` : ''

  // 2 Duros
  for (let i = 1; i <= 2; i++) {
    inventory.push({
      id: `${pfx}duro_${i}`,
      driverId,
      compound: 'duro',
      wear: 0,
      lapsUsed: 0,
      isFitted: false,
    })
  }
  // 3 Médios
  for (let i = 1; i <= 3; i++) {
    inventory.push({
      id: `${pfx}medio_${i}`,
      driverId,
      compound: 'medio',
      wear: 0,
      lapsUsed: 0,
      isFitted: false,
    })
  }
  // 3 Macios
  for (let i = 1; i <= 3; i++) {
    inventory.push({
      id: `${pfx}macio_${i}`,
      driverId,
      compound: 'macio',
      wear: 0,
      lapsUsed: 0,
      isFitted: false,
    })
  }
  // 4 Intermediários
  for (let i = 1; i <= 4; i++) {
    inventory.push({
      id: `${pfx}intermediario_${i}`,
      driverId,
      compound: 'intermediario',
      wear: 0,
      lapsUsed: 0,
      isFitted: false,
    })
  }
  // 3 Chuva Extrema
  for (let i = 1; i <= 3; i++) {
    inventory.push({
      id: `${pfx}chuva_extrema_${i}`,
      driverId,
      compound: 'chuva_extrema',
      wear: 0,
      lapsUsed: 0,
      isFitted: false,
    })
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

// Armazenamento em memória do nível ativo do Centro de Pit Stop do jogador para quando a chamada omitir o parâmetro
let activePlayerPitstopCenterLevel = 3

export function setActivePlayerPitstopCenterLevel(level: number) {
  if (typeof level === 'number' && !isNaN(level)) {
    activePlayerPitstopCenterLevel = Math.max(1, Math.min(5, Math.round(level)))
  }
}

export function getActivePlayerPitstopCenterLevel(): number {
  return activePlayerPitstopCenterLevel
}

export function calculatePitStopDuration(
  teamName: string,
  driverName: string,
  isPlayer: boolean,
  teamStrength = 75,
  pitstopCenterLevel?: number,
): PitStopTimingResult {
  // Se for o jogador e não foi fornecido explicitamente, herda o nível atual configurado
  const effectiveLevel =
    typeof pitstopCenterLevel === 'number'
      ? Math.max(1, Math.min(5, Math.round(pitstopCenterLevel)))
      : isPlayer
        ? activePlayerPitstopCenterLevel
        : 3

  // Red Bull, Ferrari, McLaren têm mecânicos mais rápidos (~2.1s a 2.6s)
  // Equipes médias/novatas variam de 2.5s a 3.5s
  const baseRating = Math.max(50, Math.min(100, teamStrength))
  const efficiency = (baseRating - 50) / 50 // 0 a 1

  // Efeito conservador do Centro de Treinamento de Pit Stop: 0,05s a 0,15s por nível (0.08s por nível acima do 1)
  const pitCenterBonus = Math.max(0, (effectiveLevel - 1) * 0.08)

  const bestBase = 2.1
  const variance = (1 - efficiency) * 0.8 + Math.random() * 0.5
  let duration = Math.max(1.85, Number((bestBase + variance - pitCenterBonus).toFixed(2)))

  // Chance de erro / pit stop lento: 7% base, reduzida conforme o nível do Centro de Testes (até ~3.5% no Nível 5)
  const errorProbability = Math.max(0.035, 0.07 - (effectiveLevel - 1) * 0.008)
  const errorRoll = Math.random()
  const isSlowPit = errorRoll < errorProbability

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
 * Resultado do cálculo de cliff de degradação térmica e mecânica do pneu.
 */
export interface TireOverheatStatus {
  isOverheating: boolean
  extraTimeSec: number
  warning?: string
}

export interface TireCliffStatus {
  isCliffReached: number // 0 = dentro da janela, > 0 = voltas além do cliff
  isCriticalWindow: boolean // Pneu perto ou após o cliff
  extraLapTimeSec: number // Perda abrupta em segundos adicionais por volta (1.5s - 3s+)
  cliffWearEquivalent: number // Desgaste efetivo ajustado
  thermalLockupRisk: number // Risco térmico de travada de roda / erro na volta
  isOverheating?: boolean // Superaquecimento por pista quente ou modo ataque
  overheatPenaltySec?: number // Penalidade por superaquecimento
  cliffWarning?: string // Aviso claro para rádio/UI
  cliffBadgeText?: string // Badge resumido para telemetria (ex: "CLIFF — pneu fora da janela, perda ~2.2s/volta")
}

/**
 * Calcula o cliff de degradação de acordo com composto, voltas no pneu, abrasividade e perfil do piloto.
 * - Ultrapassar a vida útil (especialmente macio) causa perda abrupta (1,5 a 3s/volta crescente).
 * - Macio: janela estreita (~14-16 voltas), cliff agressivo (+1.85s a +3.5s/volta).
 * - Médio: equilibrado (~26-28 voltas), cliff intermediário (+1.15s/volta).
 * - Duro: tardio e suave (~38-40 voltas), cliff moderado (+0.65s/volta).
 * - Multiplicado pelo perfil do piloto (agressivo desgasta mais e antecipa o cliff).
 */
export function calculateTireOverheat(params: {
  compound: TireCompound
  trackTemp?: number // Temperatura de pista em °C (ex: 35-50°C)
  isAttacking?: boolean // Piloto no modo de ataque elétrico / ritmo forte
  lapsOnTire?: number
}): TireOverheatStatus {
  const { compound, trackTemp = 35, isAttacking = false, lapsOnTire = 0 } = params

  // Pneus macios são os mais sensíveis ao superaquecimento
  if (compound === 'macio') {
    let overheatPenalty = 0
    let reasons: string[] = []

    // Pista quente (> 38°C) provoca bolhas/blistering no Soft
    if (trackTemp > 38) {
      const heatFactor = Math.min(1.2, (trackTemp - 38) * 0.08)
      overheatPenalty += heatFactor
      reasons.push(`asfalto a ${trackTemp}°C`)
    }

    // Modo de ataque empurra o composto para fora da janela térmica de trabalho
    if (isAttacking) {
      overheatPenalty += 0.55
      reasons.push('ritmo agressivo de ataque')
    }

    // A partir da 5ª volta consecutiva, o superaquecimento acumulado intensifica
    if (lapsOnTire > 5 && (trackTemp > 36 || isAttacking)) {
      overheatPenalty += 0.35
      reasons.push('calor retido na carcaça')
    }

    if (overheatPenalty > 0) {
      return {
        isOverheating: true,
        extraTimeSec: Number(Math.min(2.5, overheatPenalty).toFixed(2)),
        warning: `🔥 SUPERAQUECIMENTO NO MACIO! Pneus C4/C5 superaquecendo (${reasons.join(', ')}). Perda de +${overheatPenalty.toFixed(1)}s/volta e bolhas na banda!`,
      }
    }
  } else if (compound === 'intermediario' && trackTemp > 28) {
    // Intermediários no seco com pista quente
    return {
      isOverheating: true,
      extraTimeSec: 1.4,
      warning:
        '🔥 INTERMEDIÁRIOS SUPERAQUECENDO no asfalto quente sem água para resfriar os blocos!',
    }
  }

  return { isOverheating: false, extraTimeSec: 0 }
}

export function calculateTireCliffStatus(params: {
  compound: TireCompound
  lapsOnTire: number
  wearPercent?: number
  wearMultiplier?: number
  trackAbrasiveness?: number // 1-10 (padrão 6)
  trackTemp?: number
  isAttacking?: boolean
}): TireCliffStatus {
  const {
    compound,
    lapsOnTire,
    wearPercent = 0,
    wearMultiplier = 1.0,
    trackAbrasiveness = 6,
    trackTemp = 35,
    isAttacking = false,
  } = params

  const spec = TIRE_SPECS[compound] || TIRE_SPECS.medio
  const overheat = calculateTireOverheat({ compound, trackTemp, isAttacking, lapsOnTire })

  // Abrasividade da pista ajusta o limiar de voltas para o cliff:
  // Pista mais abrasiva (> 6) encurta a vida útil; pista lisa (< 5) estende
  const abrasivenessFactor = 1 + (trackAbrasiveness - 5) * 0.07

  // O perfil do piloto acelera ou retarda o alcance do cliff:
  // Piloto muito agressivo (ex: 1.25) atinge o cliff bem antes (limiar cai em 1 / 1.25)
  const driverFactor = Math.max(0.75, Math.min(1.35, wearMultiplier))

  // Limiar efetivo de voltas antes de despencar no cliff
  const effectiveCliffLap = Math.max(
    6,
    Math.round(spec.cliffLapThreshold / (driverFactor * abrasivenessFactor)),
  )

  const effectiveLifeLap = Math.max(
    8,
    Math.round(spec.baseLapsLife / (driverFactor * abrasivenessFactor)),
  )

  const lapsBeyondCliff = Math.max(0, lapsOnTire - effectiveCliffLap)
  const isCliffReached = lapsBeyondCliff
  const isCriticalWindow = lapsOnTire >= effectiveCliffLap - 2 || wearPercent >= 75

  let extraLapTimeSec = 0
  let cliffWarning: string | undefined
  let cliffBadgeText: string | undefined

  if (lapsBeyondCliff > 0) {
    // Crescimento abrupto e não linear:
    // Primeira volta além: base (~1.5s a 2s no macio)
    // Voltas subsequentes acumulam com expoente sutil (1.2) para punir stints longos
    const nonLinearFactor = Math.pow(lapsBeyondCliff, 1.2)
    const rawPenalty = spec.cliffDegradationPerLapSec * nonLinearFactor
    extraLapTimeSec = Number(Math.min(spec.cliffMaxPenaltySec, rawPenalty).toFixed(2))

    cliffBadgeText = `CLIFF — pneu fora da janela, perda ~${extraLapTimeSec.toFixed(1)}s/volta`

    if (compound === 'macio') {
      cliffWarning = `🚨 CLIFF CRÍTICO NO MACIO! Pneu C4/C5 ultrapassou ${effectiveCliffLap} voltas e despencou de rendimento (+${extraLapTimeSec.toFixed(1)}s/volta)! Faça o box imediatamente!`
    } else if (compound === 'medio') {
      cliffWarning = `⚠️ CLIFF DO MÉDIO: Pneu C3 fora da janela de rendimento ótimo (+${extraLapTimeSec.toFixed(1)}s/volta). Planeje a troca.`
    } else {
      cliffWarning = `⚠️ DEG. ELEVADA: Pneu duro além de ${effectiveCliffLap} voltas perdendo ritmo (+${extraLapTimeSec.toFixed(1)}s/volta).`
    }
  } else if (overheat.isOverheating) {
    extraLapTimeSec = Number((extraLapTimeSec + overheat.extraTimeSec).toFixed(2))
    cliffBadgeText = `SUPERAQUECIDO — bolhas (+${overheat.extraTimeSec.toFixed(1)}s)`
    cliffWarning = overheat.warning
  } else if (isCriticalWindow) {
    cliffBadgeText = `JANELA CRÍTICA — limite de vida (${lapsOnTire}/${effectiveCliffLap}v)`
  }

  // Risco térmico: macio sofre muito mais com travadas de roda e rajadas na janela crítica ou superaquecido
  let thermalLockupRisk = spec.thermalLockupRiskBase
  if (overheat.isOverheating) {
    thermalLockupRisk = Math.min(0.75, thermalLockupRisk + 0.25)
  }
  if (isCliffReached > 0) {
    thermalLockupRisk = Math.min(0.9, thermalLockupRisk + lapsBeyondCliff * 0.14)
  } else if (isCriticalWindow) {
    thermalLockupRisk = Math.min(0.55, thermalLockupRisk + 0.18)
  }

  return {
    isCliffReached,
    isCriticalWindow,
    extraLapTimeSec,
    cliffWearEquivalent: Math.min(100, wearPercent + lapsBeyondCliff * 6),
    thermalLockupRisk,
    isOverheating: overheat.isOverheating,
    overheatPenaltySec: overheat.extraTimeSec,
    cliffWarning,
    cliffBadgeText,
  }
}

/**
 * Calcula o delta de pontuação/desempenho por volta de acordo com o composto e o clima atual.
 * Leva em consideração o desgaste percentual e o cliff de degradação abrupta.
 */
/**
 * Verifica se o pneu atingiu o limiar de cliff considerando o perfil de desgaste do piloto e abrasividade da pista.
 * Retorna se está em cliff, voltas excedentes e penalidade por volta calculada (TIRE_SPECS).
 */
export function isTireInCliff(
  tireCompound: TireCompound,
  lapsOnTire: number,
  driverWearProfile?: number | { multiplier?: number },
  trackAbrasiveness: number = 6,
): { inCliff: boolean; lapsOver: number; penaltyPerLap: number } {
  const multiplier =
    typeof driverWearProfile === 'number'
      ? driverWearProfile
      : (driverWearProfile?.multiplier ?? 1.0)

  const status = calculateTireCliffStatus({
    compound: tireCompound,
    lapsOnTire,
    wearMultiplier: multiplier,
    trackAbrasiveness,
  })

  return {
    inCliff: status.isCliffReached > 0,
    lapsOver: status.isCliffReached,
    penaltyPerLap: status.extraLapTimeSec,
  }
}

export function calculateLapPerformanceScoreDelta(
  compound: TireCompound,
  wearPercent: number,
  weather: TrackWeatherState,
  lapsOnTire: number = 0,
  wearMultiplier: number = 1.0,
  trackAbrasiveness: number = 6,
  trackTemp: number = 35,
  isAttacking: boolean = false,
): {
  scoreDelta: number
  warning?: string
  aquaplaningRisk: boolean
  cliffStatus: TireCliffStatus
} {
  const spec = TIRE_SPECS[compound] || TIRE_SPECS.medio
  let scoreDelta = 0
  let aquaplaningRisk = false
  let warning: string | undefined

  // 1. Delta base do composto em relação ao Médio seco
  // Cada 0.1s de delta equivale a ~1.8 pontos de score na simulação
  // Negativo = mais rápido (ganha pontos de ritmo)
  const compoundBasePoints = -spec.deltaPerLapSec * 18
  scoreDelta += compoundBasePoints

  // 2. Penalidade padrão por desgaste %
  const wearPenalty = (wearPercent / 100) * 32.4
  scoreDelta -= wearPenalty

  // 3. Cliff de degradação abrupto pós-vida útil + Superaquecimento
  const cliffStatus = calculateTireCliffStatus({
    compound,
    lapsOnTire,
    wearPercent,
    wearMultiplier,
    trackAbrasiveness,
    trackTemp,
    isAttacking,
  })

  if (cliffStatus.extraLapTimeSec > 0) {
    // Cada 1.0s de perda por volta equivale a ~18 pontos a menos por volta
    const cliffScorePenalty = cliffStatus.extraLapTimeSec * 18
    scoreDelta -= cliffScorePenalty
    if (cliffStatus.cliffWarning) {
      warning = cliffStatus.cliffWarning
    }
  } else if (cliffStatus.isOverheating && cliffStatus.overheatPenaltySec) {
    scoreDelta -= cliffStatus.overheatPenaltySec * 18
    if (cliffStatus.cliffWarning) {
      warning = cliffStatus.cliffWarning
    }
  }

  // 4. Adequação climática
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

  return { scoreDelta, warning, aquaplaningRisk, cliffStatus }
}
