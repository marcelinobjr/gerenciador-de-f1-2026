import { TireCompound } from '@/types/f1'
import {
  TIRE_SPECS,
  calculateTireCliffStatus,
  TrackWeatherState,
  TireCliffStatus,
} from './f1-tire-system'
import { calculateCombinedPace } from './f1-pace-model'

/**
 * Fator de facilidade de ultrapassagem por circuito (especificação 2026):
 * - Retas longas (Monza, Spa, Baku, Las Vegas, Red Bull Ring): 0.75 - 0.90
 * - Médios (Interlagos, Silverstone, Bahrein, Montreal, Miami, COTA, Jeddah, etc.): 0.55 - 0.65
 * - Travados (Mônaco, Hungaroring, Zandvoort, Marina Bay): 0.15 - 0.25
 */
export function getCircuitOvertakeFactor(circuitName: string, circuitTrack?: string): number {
  const cName = (circuitName + ' ' + (circuitTrack || '')).toLowerCase()

  // Travados (0.15 - 0.25)
  if (cName.includes('mônaco') || cName.includes('monaco') || cName.includes('monte carlo')) {
    return 0.15
  }
  if (cName.includes('hungaroring') || cName.includes('budapeste') || cName.includes('budapest')) {
    return 0.2
  }
  if (cName.includes('zandvoort') || cName.includes('holanda') || cName.includes('netherlands')) {
    return 0.22
  }
  if (cName.includes('marina bay') || cName.includes('singapura') || cName.includes('singapore')) {
    return 0.24
  }

  // Retas longas (0.75 - 0.90)
  if (cName.includes('monza')) {
    return 0.9
  }
  if (cName.includes('baku') || cName.includes('azerbaijão') || cName.includes('azerbaijan')) {
    return 0.88
  }
  if (cName.includes('spa') || cName.includes('francorchamps')) {
    return 0.85
  }
  if (cName.includes('las vegas')) {
    return 0.82
  }
  if (cName.includes('red bull ring') || cName.includes('spielberg')) {
    return 0.78
  }

  // Médios / Alta velocidade com retas médias (0.55 - 0.65)
  if (
    cName.includes('interlagos') ||
    cName.includes('josé carlos pace') ||
    cName.includes('brasil')
  ) {
    return 0.62
  }
  if (cName.includes('silverstone')) {
    return 0.6
  }
  if (cName.includes('bahrein') || cName.includes('bahrain') || cName.includes('sakhir')) {
    return 0.65
  }
  if (cName.includes('montreal') || cName.includes('gilles villeneuve')) {
    return 0.65
  }
  if (cName.includes('jeddah') || cName.includes('corniche')) {
    return 0.6
  }
  if (cName.includes('austin') || cName.includes('américas') || cName.includes('americas')) {
    return 0.58
  }
  if (cName.includes('miami')) {
    return 0.58
  }

  // Padrão geral para outros circuitos (Catalunha, Suzuka, Lusail, Yas Marina, Melbourne, etc.)
  return 0.55
}

export interface SimDriverLapState {
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  teamColor: string
  isPlayer: boolean
  flag: string
  position: number
  score: number
  accumulatedTimeSec: number
  dnf: boolean
  dnfLap?: number
  dnfReason?: string
  lastLapTime?: string
  lastLapTimeSec?: number
  gapToLeader?: string
  gapToFront?: string
  tireCompound?: TireCompound
  secondCompound?: TireCompound
  tireWear?: number
  lapsOnCurrentTire?: number
  pitStopsDone?: number
  pitLap?: number
  hasWingDamage?: boolean
  wearMultiplier?: number
  wearProfileName?: string
  strategyPlan?: { lap: number; compound: TireCompound }[]
  cliffStatus?: TireCliffStatus
  aiStrategyProfile?: {
    type: 'conservadora' | 'equilibrada' | 'agressiva' | 'reativa'
    label: string
    color: string
    badgeBg: string
    description: string
  }
  driverFatigue?: number
  morale?: number
  physicalCondition?: number
  oldMorale?: number
  newMorale?: number
  moraleDelta?: number
  oldPhysical?: number
  newPhysical?: number
  physicalDelta?: number
  points?: number
  fastestLap?: boolean
  usedOvertake?: boolean
  totalTime?: string
  // Rastreamento para Dirty Air e tráfego
  lapsInDirtyAir?: number
  carStrength?: number
  driverSkill?: number
}

export interface FreePaceParams {
  teamStrength: number
  carLevel: number
  driver: {
    speed: number
    consistency?: number
    defense?: number
    rain?: number
    morale?: number
    physicalCondition?: number
  }
  weather: TrackWeatherState
  tireCompound: TireCompound
  lapsOnTire: number
  wearPercent: number
  wearMultiplier: number
  trackAbrasiveness: number
  setupPenalty?: number
  engineWearPenalty?: number
  poolPenalty?: number
  hasWingDamage?: boolean
  tacticalMode?: 'attack' | 'preserve' | 'stay_out'
  trackTemp?: number
  noise?: number // ±0.15s
}

/**
 * Calcula o ritmo livre (sem tráfego) do piloto numa volta em segundos.
 */
export function calculateFreeLapPaceSec(params: FreePaceParams): {
  freeLapSec: number
  cliffStatus: TireCliffStatus
} {
  const {
    teamStrength,
    carLevel,
    driver,
    weather,
    tireCompound,
    lapsOnTire,
    wearPercent,
    wearMultiplier,
    trackAbrasiveness,
    setupPenalty = 0,
    engineWearPenalty = 0,
    poolPenalty = 0,
    hasWingDamage = false,
    tacticalMode,
    trackTemp = 35,
    noise = (Math.random() - 0.5) * 0.3, // ±0.15s
  } = params

  const paceResult = calculateCombinedPace({
    teamStrength,
    carLevel,
    driver,
    weather,
    tireCompound,
    lapsOnTire,
    wearPercent,
    wearMultiplier,
    trackAbrasiveness,
    setupPenalty,
    engineWearPenalty,
    poolPenalty,
    noise,
  })

  let lapSec = paceResult.lapTimeSec

  // Cliff Status refinado com temperatura e ataque
  const isAttacking = tacticalMode === 'attack'
  const refinedCliff = calculateTireCliffStatus({
    compound: tireCompound,
    lapsOnTire,
    wearPercent,
    wearMultiplier,
    trackAbrasiveness,
    trackTemp,
    isAttacking,
  })

  // Penalidade de asa dianteira quebrada (+2.4s a +3.2s)
  if (hasWingDamage) {
    lapSec += 2.6
  }

  // Modificadores táticos
  if (tacticalMode === 'attack') {
    lapSec *= 0.97 // +3% de ritmo
  } else if (tacticalMode === 'preserve') {
    lapSec *= 1.015 // -1.5% de ritmo
  }

  return {
    freeLapSec: Number(lapSec.toFixed(3)),
    cliffStatus: refinedCliff,
  }
}

export interface OvertakeAttemptResult {
  attempted: boolean
  success: boolean
  attackerAdvantageSec: number
  probability: number
  narrativeMessage?: string
  attackerTimePenaltySec?: number
  attackerExtraWearPct?: number
}

/**
 * Avalia tentativa de ultrapassagem discreta quando perseguidor está colado (gap <= 1.0s)
 * e possui ritmo livre superior.
 */
export function evaluateOvertakeAttempt(options: {
  attacker: SimDriverLapState
  target: SimDriverLapState
  attackerFreePaceSec: number
  targetFreePaceSec: number
  circuitOvertakeFactor: number // 0.15 a 0.90
  currentLap: number
  hasOvertakeEnergy: boolean // Modo overtake 2026 MGU-K disponível
}): OvertakeAttemptResult {
  const {
    attacker,
    target,
    attackerFreePaceSec,
    targetFreePaceSec,
    circuitOvertakeFactor,
    currentLap,
    hasOvertakeEnergy,
  } = options

  // Vantagem de ritmo do atacante (positivo significa que atacante é mais rápido)
  const paceAdvantage = targetFreePaceSec - attackerFreePaceSec

  // Se não tem vantagem real de ritmo, não há tentativa com alta probabilidade
  if (paceAdvantage <= 0.05) {
    return {
      attempted: false,
      success: false,
      attackerAdvantageSec: paceAdvantage,
      probability: 0,
    }
  }

  // Base da probabilidade: 15% para cada 0.3s de vantagem de ritmo
  let baseProb = (paceAdvantage / 0.3) * 0.15

  // Modificador de circuito: circuito com retas longas (0.85) eleva probabilidade; travado (0.20) reduz fortemente
  baseProb *= circuitOvertakeFactor / 0.55

  // Modo overtake 2026 MGU-K (+25%)
  if (hasOvertakeEnergy) {
    baseProb += 0.25
  }

  // Pneus do alvo no cliff ou >75% desgastados vs pneu novo/melhor do atacante (+30%)
  const targetTireWear = target.tireWear || 0
  const targetInCliff = (target.cliffStatus?.isCliffReached ?? 0) > 0 || targetTireWear >= 75
  const attackerTireWear = attacker.tireWear || 0
  if (targetInCliff && attackerTireWear < 60) {
    baseProb += 0.3
  }

  // Defesa do piloto da frente vs velocidade do atacante
  const targetDefense = target.driverSkill || 80
  const attackerSkill = attacker.driverSkill || 80
  const skillDelta = (attackerSkill - targetDefense) * 0.005
  baseProb += skillDelta

  // Limite da probabilidade entre 5% e 92%
  const finalProbability = Math.max(0.05, Math.min(0.92, baseProb))

  const roll = Math.random()
  const success = roll < finalProbability

  if (success) {
    const narrativeMessage = `🟢 ULTRAPASSAGEM! ${attacker.driverName} superou ${target.driverName} na volta ${currentLap}!`
    return {
      attempted: true,
      success: true,
      attackerAdvantageSec: paceAdvantage,
      probability: finalProbability,
      narrativeMessage,
    }
  } else {
    // Falha: atacante perde entre 0.4s e 0.7s na volta por tentar por fora/espalhar, e desgasta +1.5% o pneu
    const penalty = 0.4 + Math.random() * 0.3
    const narrativeMessage = `🛡️ DEFESA DE POSIÇÃO: ${target.driverName} segurou o ataque de ${attacker.driverName} na volta ${currentLap}!`
    return {
      attempted: true,
      success: false,
      attackerAdvantageSec: paceAdvantage,
      probability: finalProbability,
      narrativeMessage,
      attackerTimePenaltySec: penalty,
      attackerExtraWearPct: 1.5,
    }
  }
}

/**
 * Converte segundos de tempo de volta para string "M:SS.mmm"
 */
export function formatLapTime(timeSec: number): string {
  if (!timeSec || isNaN(timeSec) || timeSec <= 0) return '1:18.420'
  const min = Math.floor(timeSec / 60)
  const remSec = (timeSec % 60).toFixed(3)
  const remSecNum = parseFloat(remSec)
  return `${min}:${remSecNum < 10 ? '0' : ''}${remSec}`
}

/**
 * Converte diferença de segundos para string "+X.XXXs" ou "LÍDER" ou "-"
 */
export function formatGap(gapSec: number, isLeader: boolean = false): string {
  if (isLeader) return 'LÍDER'
  if (gapSec <= 0.0005) return '+0.000s'
  return `+${gapSec.toFixed(3)}s`
}
