import { TireCompound } from '@/types/f1'
import { TrackWeatherState } from './f1-tire-system'

export type AIStrategyType = 'conservadora' | 'equilibrada' | 'agressiva' | 'reativa'

export interface AIPitPlan {
  lap: number
  compound: TireCompound
}

export interface AIStrategyProfile {
  type: AIStrategyType
  label: string
  color: string
  badgeBg: string
  description: string
  startCompound: TireCompound
  pitStops: AIPitPlan[]
  isUndercutSeeker: boolean // Busca antecipar janela para passar no box
  isCoveringPlayer: boolean // Cobre pit stop do jogador se estiver perto
  reactiveThresholdWear: number // Limiar de desgaste para reavaliar
}

export interface GenerateAIStrategyParams {
  teamStrength: number // 30 a 100
  driverSpeed: number // 70 a 98
  driverConsistency: number // 70 a 98
  totalLaps: number
  weather: TrackWeatherState
  gridPosition?: number
  driverSeed?: number // Para consistência por piloto dentro da corrida
}

/**
 * Gera um perfil de estratégia tática variado para pilotos de IA.
 * Garante distribuição realista no grid:
 * - Conservadora: Pneu Duro na largada (ou Médio longo), 1 parada tardia para Médio/Duro.
 * - Equilibrada: Pneu Médio na largada, 1–2 paradas convencionais (Médio -> Duro ou Médio -> Duro -> Médio).
 * - Agressiva: Pneu Macio na 1ª stint (alta velocidade inicial) + parada cedo (undercut) para Duro/Médio.
 * - Reativa: Avalia a cada evento, pode largar de Médio ou Macio e estender/encurtar conforme Safety Car, tráfego e clima.
 */
export function generateAIStrategyProfile(params: GenerateAIStrategyParams): AIStrategyProfile {
  const {
    teamStrength,
    driverSpeed,
    driverConsistency,
    totalLaps,
    weather,
    gridPosition = 12,
    driverSeed = Math.random(),
  } = params

  // 1. Em piso molhado, a escolha prioritária é climática
  if (weather === 'chuva_forte') {
    const pitLap = Math.max(12, Math.round(totalLaps * 0.48))
    return {
      type: 'reativa',
      label: 'Reativa (Chuva)',
      color: 'text-blue-400',
      badgeBg: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
      description: 'Largada com Chuva Extrema e reavaliação constante das poças d’água.',
      startCompound: 'chuva_extrema',
      pitStops: [{ lap: pitLap, compound: 'intermediario' }],
      isUndercutSeeker: false,
      isCoveringPlayer: true,
      reactiveThresholdWear: 68,
    }
  }

  if (weather === 'chuva_fraca') {
    const pitLap = Math.max(10, Math.round(totalLaps * 0.42))
    return {
      type: 'reativa',
      label: 'Reativa (Úmido)',
      color: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
      description: 'Largada com Intermediários e acompanhamento de trilho seco para slicks.',
      startCompound: 'intermediario',
      pitStops: [{ lap: pitLap, compound: 'chuva_extrema' }],
      isUndercutSeeker: false,
      isCoveringPlayer: true,
      reactiveThresholdWear: 70,
    }
  }

  // 2. Pista Seca: calcular peso de agressividade
  // Piloto rápido + equipe forte = mais propenso a agressiva (ataque) ou equilibrada
  // Piloto muito consistente / largando do fundo = mais propenso a conservadora (1 stop longo)
  // Pilotos do meio do grid = reativa ou agressiva para tentar ganhar posições no undercut
  let aggressiveWeight = (driverSpeed - 75) * 1.2 + (teamStrength - 50) * 0.5
  let conservativeWeight = (driverConsistency - 75) * 1.5 + (gridPosition > 14 ? 18 : 0)
  let reactiveWeight = 20 + Math.abs(gridPosition - 10) * 1.5

  // Sorteio ponderado determinístico por driverSeed
  const randomRoll = driverSeed * 100

  // Distribuição equilibrada no grid:
  // ~25% Conservadora, ~35% Equilibrada, ~25% Agressiva, ~15% Reativa
  let chosenType: AIStrategyType = 'equilibrada'

  if (randomRoll < 26) {
    chosenType = 'conservadora'
  } else if (randomRoll < 58) {
    chosenType = 'equilibrada'
  } else if (randomRoll < 84) {
    chosenType = 'agressiva'
  } else {
    chosenType = 'reativa'
  }

  // Refinamento de compostos e voltas de box conforme o tipo
  switch (chosenType) {
    case 'conservadora': {
      // 1 Stop: Duro (longo) -> Médio ou Médio -> Duro longo
      const startWithHard = randomRoll % 2 === 0
      const startCompound: TireCompound = startWithHard ? 'duro' : 'medio'
      const secondCompound: TireCompound = startWithHard ? 'medio' : 'duro'
      const pitLap = startWithHard ? Math.round(totalLaps * 0.58) : Math.round(totalLaps * 0.46)

      return {
        type: 'conservadora',
        label: 'Conservadora (1 Stop)',
        color: 'text-slate-300',
        badgeBg: 'bg-slate-500/15 border-slate-400/30 text-slate-200',
        description: `Estratégia longa de 1 parada (${startCompound.toUpperCase()} ➔ ${secondCompound.toUpperCase()}). Foco em esticar o stint e economizar tempo de box.`,
        startCompound,
        pitStops: [{ lap: pitLap, compound: secondCompound }],
        isUndercutSeeker: false,
        isCoveringPlayer: false,
        reactiveThresholdWear: 84,
      }
    }

    case 'agressiva': {
      // Macio na 1ª stint + undercut rápido
      const firstPitLap = Math.max(8, Math.round(totalLaps * 0.22))
      const secondPitLap = Math.round(totalLaps * 0.6)
      const isTwoStopper = totalLaps >= 42

      const pitStops: AIPitPlan[] = isTwoStopper
        ? [
            { lap: firstPitLap, compound: 'medio' },
            { lap: secondPitLap, compound: 'macio' },
          ]
        : [{ lap: firstPitLap, compound: 'duro' }]

      return {
        type: 'agressiva',
        label: 'Agressiva (Soft + Undercut)',
        color: 'text-rose-400',
        badgeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
        description: `Largada no ataque com pneu MACIO e parada antecipada na volta ${firstPitLap} para undercut agressivo. Risco de superaquecimento e tráfego na volta de saída!`,
        startCompound: 'macio',
        pitStops,
        isUndercutSeeker: true,
        isCoveringPlayer: true,
        reactiveThresholdWear: 72,
      }
    }

    case 'reativa': {
      // Médio com flexibilidade: reavalia se houver SC ou oportunidade de undercut defensivo
      const defaultPitLap = Math.round(totalLaps * 0.42)
      return {
        type: 'reativa',
        label: 'Reativa / Flexível',
        color: 'text-cyan-400',
        badgeBg: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
        description: `Ritmo equilibrado de Médio adaptável. Antecipa parada se o rival direto parar (undercut defensivo) ou estende se a pista abrir espaço.`,
        startCompound: 'medio',
        pitStops: [{ lap: defaultPitLap, compound: 'duro' }],
        isUndercutSeeker: false,
        isCoveringPlayer: true,
        reactiveThresholdWear: 76,
      }
    }

    case 'equilibrada':
    default: {
      // Padrão clássico de Médio -> Duro
      const pitLap = Math.round(totalLaps * 0.38)
      return {
        type: 'equilibrada',
        label: 'Equilibrada (Medium)',
        color: 'text-amber-400',
        badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
        description: `Estratégia sólida com MÉDIO na largada e transição limpa para DURO na volta ${pitLap}. Baixo risco de cliff.`,
        startCompound: 'medio',
        pitStops: [{ lap: pitLap, compound: 'duro' }],
        isUndercutSeeker: false,
        isCoveringPlayer: false,
        reactiveThresholdWear: 80,
      }
    }
  }
}
