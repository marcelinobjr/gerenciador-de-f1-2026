import { TireCompound, TrackWeatherState } from '@/types/f1'
import { TireCliffStatus } from '@/lib/f1-tire-system'

export type RadioCategory =
  | 'cliff'
  | 'tire_critical'
  | 'tire_high'
  | 'weather'
  | 'rival_ahead'
  | 'rival_behind'
  | 'engine'
export type BossResponseType = 'box_now' | 'stay_out' | 'attack_mode' | 'preserve_car'

export interface DriverRadioMessage {
  id: string
  lap: number
  driverId: string
  driverName: string
  teamName: string
  teamColor: string
  isPlayer: boolean
  isUrgent: boolean // true = congela simulação e exige resposta/intervenção
  category: RadioCategory
  message: string
  personalityTag?: string
  driverFeedback?: string // resposta falada do piloto à decisão do chefe
  resolvedResponse?: BossResponseType
  timestamp: string
}

export interface DriverRadioContext {
  driverId: string
  driverName: string
  teamName: string
  teamColor: string
  isPlayer: boolean
  tireCompound: TireCompound
  tireWear: number // 0-100
  lapsOnCurrentTire: number
  cliffStatus?: TireCliffStatus
  isInCliff: boolean
  position: number
  gapToFront?: string
  gapBehindSec?: number
  gapFrontSec?: number
  engineWear?: number
  wearProfileName?: string // 'Muito Agressivo' | 'Agressivo' | 'Moderado' | 'Conservador' | 'Muito Conservador'
  morale?: number
  speed?: number
  defense?: number
}

// Histórico de disparos por piloto para respeitar cooldowns
export interface DriverRadioCooldowns {
  lastLapTireHigh?: number
  lastLapTireCrit?: number
  lastLapCliff?: number
  lastLapWeather?: number
  lastLapRivalAhead?: number
  lastLapRivalBehind?: number
  lastLapEngine?: number
  acknowledgedStayOutCliffLap?: number
}

// Variantes de frases ricas e realistas por categoria
export const RADIO_PHRASES: Record<
  RadioCategory,
  {
    aggressive: string[]
    conservative: string[]
    standard: string[]
  }
> = {
  cliff: {
    aggressive: [
      'BOX AGORA! Os pneus morreram de vez, perdi toda a tração na saída das curvas!',
      'Alô pit wall, pneu destruído! Não consigo nem frear sem travar reto. Preciso parar nesta volta!',
      'Perdi completamente a frente do carro! O cliff bateu violento, box box box!',
    ],
    conservative: [
      'Chegamos ao limite absoluto da borracha. O pneu entrou em cliff, o tempo de volta despencou.',
      'O ritmo caiu mais de 2 segundos nesta volta. Recomendo parada imediata nos boxes.',
      'Aderência zero nos eixos traseiro e dianteiro. É o cliff técnico, chamem o box agora.',
    ],
    standard: [
      'Os pneus morreram! Perdi tudo, preciso dos boxes AGORA!',
      'Alô equipe, o pneu acabou totalmente! Estou perdendo tempo demais por volta, box!',
      'Sem aderência! O carro está deslizando em quatro rodas, parada urgente necessária!',
    ],
  },
  tire_critical: {
    aggressive: [
      'Estou sem aderência nenhuma! A borracha tá no osso, preciso parar já!',
      'O carro está inguiável, deslizando em toda aceleração. Não dá para segurar!',
      'Desgaste crítico! Se eu continuar forçando vou rodar na próxima curva. Box!',
    ],
    conservative: [
      'Desgaste ultrapassou a margem de segurança. Os pneus estão no final de vida útil.',
      'Sinto muita vibração e perda progressiva de tração. Sugiro abrir a janela de box.',
      'Os pneus chegaram a um nível perigoso de desgaste. Vamos entrar para pneus novos?',
    ],
    standard: [
      'Estou sem aderência nenhuma! Pneus em estado crítico, preciso parar.',
      'Os pneus acabaram, a traseira quer sair em toda frenagem. Chamem o box!',
      'Muita derrapagem e vibração severa. Hora de pneus novos, equipe.',
    ],
  },
  tire_high: {
    aggressive: [
      'Os pneus estão abrindo granulação rápida. Sinto vibração na curva 9, mas ainda dá para tentar algo.',
      'Começou a escorregar na entrada das chicanes. A borracha está sumindo rápido!',
      'Pneu começou a degradar mais rápido do que o esperado. Fiquem atentos no muro.',
    ],
    conservative: [
      'Os pneus estão começando a degradar. Sinto perda sutil na curva 9, vou administrar o ritmo.',
      'Aderência caindo de forma consistente. Stint se aproximando da metade da vida.',
      'Temperatura dos pneus subindo um pouco. Sugiro poupar borracha se quisermos estender.',
    ],
    standard: [
      'Os pneus estão acabando, sinto vibração na curva 9 e perda de tração.',
      'Borracha está começando a superaquecer e escorregar nas frenagens fortes.',
      'Degradação perceptível nas curvas de média e alta. Vamos monitorar.',
    ],
  },
  weather: {
    aggressive: [
      'Gotas grandes no visor! A pista está molhando lá na frente, vamos arriscar ou calçar intermédios?',
      'Chuva na pista! O carro começou a flutuar nas poças, precisamos de estratégia rápida!',
      'Está secando rápido! Já vejo trilho seco surgindo, quero slicks para passar todo mundo!',
    ],
    conservative: [
      'Pista molhada com baixa drenagem. Risco de aquaplanagem alto, melhor mudar para pneus de chuva.',
      'Chuva constante aumentando. Pneu de pista seca não é seguro neste momento.',
      'O asfalto está clareando e secando. Se mantermos a linha, logo dará para colocar slicks com segurança.',
    ],
    standard: [
      'Está caindo chuva lá na frente, a pista está molhando visivelmente!',
      'Volume de água elevado, a visibilidade e a tração estão críticas. Precisamos de pneus adequados.',
      'A pista está secando, já há trilho seco se formando. Logo dá para ir para slicks.',
    ],
  },
  rival_ahead: {
    aggressive: [
      'Estou colado no carro da frente! Ele tá errando na tração, vou dar o bote com DRS!',
      'Ritmo excelente, alcancei o pelotão! Me dá potência máxima no rádio que eu passo!',
      'Estou muito mais rápido que ele. Abre o modo de ataque!',
    ],
    conservative: [
      'Aproximei do carro à frente com segurança. Estou dentro da janela de ataque sem gastar pneu.',
      'Estou na esteira de vácuo, monitorando os pontos fracos dele para passar limpo.',
      'Diferença menor que 1.5s. Posso pressionar se a equipe achar oportuno.',
    ],
    standard: [
      'Estou colando no carro da frente, consigo atacar!',
      'Diferença caiu para menos de 1.5s, o carro da frente está com ritmo instável.',
      'Estou na zona de ataque, pronto para manobra de ultrapassagem.',
    ],
  },
  rival_behind: {
    aggressive: [
      'Ele tá colado no meu difusor! Não vou dar nem um milímetro de espaço na curva!',
      'Pressão forte por trás! Estou defendendo com tudo o que tenho nas freadas!',
      'Ele abriu asa móvel, mas vou fechar a porta por dentro. Não passa!',
    ],
    conservative: [
      'O carro atrás está a menos de 1 segundo. Estou adotando linha defensiva sem arriscar contato.',
      'Pressão constante no retrovisor. Vou tentar manter tração limpa na saída.',
      'Carro de trás mais rápido na reta. Estou administrando para não queimar os pneus defendendo.',
    ],
    standard: [
      'Ele está me pressionando muito por trás, estou defendendo o máximo que posso!',
      'Gap para trás menor que 1 segundo, ele está tentando manobra por fora.',
      'Sob forte ataque do carro de trás. Tentando segurar a posição.',
    ],
  },
  engine: {
    aggressive: [
      "O motor tá cortando giro na reta e a temperatura d'água tá alta! Não posso perder potência agora!",
      'Alarme de confiabilidade no volante! O motor está passando dos limites!',
      'Potência instável no motor elétrico! Vamos resetar algo pelo volante?',
    ],
    conservative: [
      'Temperatura da unidade de potência um pouco acima do limite. Sugiro lift-and-coast.',
      'Aviso de desgaste de motor no painel. Devo suavizar o mapa de potência?',
      'Confiabilidade mecânica diminuindo. Vamos preservar para terminar a prova.',
    ],
    standard: [
      'O motor está passando dos limites, alertas de temperatura no painel!',
      'Pressão e temperatura do motor elevadas. Precisamos cuidar da unidade.',
      'Sinto pequena perda de potência na reta principal. Monitorando parâmetros.',
    ],
  },
}

// Respostas faladas do piloto de volta ao chefe de equipe
export const DRIVER_FEEDBACKS: Record<BossResponseType, string[]> = {
  box_now: [
    'Entendido, indo para os boxes nesta volta! Preparem os pneus!',
    'Confirmado, box nesta volta! Segurando na entrada do pit lane.',
    'Copiado, box box box! Mecânicos prontos!',
  ],
  stay_out: [
    'Entendido... vou segurar o que puder, mas o carro tá bem difícil.',
    'Copiado, fico na pista. Vou tentar administrar a borracha restante.',
    'Vou segurar o que der, mas não me deixem na pista muito tempo!',
  ],
  attack_mode: [
    'Vamos nessa! Modo de ataque ligado, indo pra cima!',
    'Copiado, pisando fundo! Vou caçar a posição na pista!',
    'Potência máxima liberada! Vamos buscar esse resultado!',
  ],
  preserve_car: [
    'Entendido, vou administrar e poupar equipamento.',
    'Copiado, aliviando frenagens e cuidando dos pneus e do motor.',
    'Modo preservação ativo, ritmo controlado até a bandeirada.',
  ],
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function getDriverTone(
  wearProfileName?: string,
): 'aggressive' | 'conservative' | 'standard' {
  if (!wearProfileName) return 'standard'
  const lower = wearProfileName.toLowerCase()
  if (lower.includes('muito agressivo') || lower.includes('agressivo')) return 'aggressive'
  if (lower.includes('conservador')) return 'conservative'
  return 'standard'
}

/**
 * Avalia se o piloto tem mensagem de rádio contextual para esta volta.
 * Retorna null se não houver disparos elegíveis ou se estiver em cooldown.
 */
export function evaluateDriverRadioTriggers(
  ctx: DriverRadioContext,
  currentLap: number,
  weatherState: TrackWeatherState,
  cooldowns: DriverRadioCooldowns,
): { message: DriverRadioMessage; updatedCooldowns: DriverRadioCooldowns } | null {
  const tone = getDriverTone(ctx.wearProfileName)
  const isAggressive = tone === 'aggressive'
  const isConservative = tone === 'conservative'
  const nowStr = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  // 1. GATILHO CLIFF (Urgente - Congela simulação!)
  // Dispara se o pneu atingiu cliff e ainda não foi avisado neste patamar ou se faz mais de 4 voltas
  const cliffCooldownOver = !cooldowns.lastLapCliff || currentLap - cooldowns.lastLapCliff >= 4
  const notAcknowledgedSameCliff =
    cooldowns.acknowledgedStayOutCliffLap === undefined ||
    currentLap - cooldowns.acknowledgedStayOutCliffLap >= 3

  if (ctx.isInCliff && cliffCooldownOver && notAcknowledgedSameCliff) {
    const text = pickRandom(RADIO_PHRASES.cliff[tone])
    return {
      message: {
        id: `radio_cliff_${ctx.driverId}_${currentLap}`,
        lap: currentLap,
        driverId: ctx.driverId,
        driverName: ctx.driverName,
        teamName: ctx.teamName,
        teamColor: ctx.teamColor,
        isPlayer: ctx.isPlayer,
        isUrgent: true,
        category: 'cliff',
        message: text,
        personalityTag: ctx.wearProfileName || 'Piloto',
        timestamp: nowStr,
      },
      updatedCooldowns: {
        ...cooldowns,
        lastLapCliff: currentLap,
      },
    }
  }

  // 2. GATILHO PNEUS CRÍTICOS (>70% ou >65% para agressivo) (Urgente - Congela simulação!)
  const critThreshold = isAggressive ? 66 : isConservative ? 75 : 70
  const critCooldownOver = !cooldowns.lastLapTireCrit || currentLap - cooldowns.lastLapTireCrit >= 5

  if (ctx.tireWear >= critThreshold && critCooldownOver && !ctx.isInCliff) {
    const text = pickRandom(RADIO_PHRASES.tire_critical[tone])
    return {
      message: {
        id: `radio_tirecrit_${ctx.driverId}_${currentLap}`,
        lap: currentLap,
        driverId: ctx.driverId,
        driverName: ctx.driverName,
        teamName: ctx.teamName,
        teamColor: ctx.teamColor,
        isPlayer: ctx.isPlayer,
        isUrgent: true,
        category: 'tire_critical',
        message: text,
        personalityTag: ctx.wearProfileName || 'Piloto',
        timestamp: nowStr,
      },
      updatedCooldowns: {
        ...cooldowns,
        lastLapTireCrit: currentLap,
      },
    }
  }

  // 3. GATILHO MOTOR CRÍTICO (>85% desgaste) (Urgente - Congela)
  const engineThreshold = 85
  const engineCooldownOver = !cooldowns.lastLapEngine || currentLap - cooldowns.lastLapEngine >= 8

  if (ctx.engineWear && ctx.engineWear >= engineThreshold && engineCooldownOver) {
    const text = pickRandom(RADIO_PHRASES.engine[tone])
    return {
      message: {
        id: `radio_engine_${ctx.driverId}_${currentLap}`,
        lap: currentLap,
        driverId: ctx.driverId,
        driverName: ctx.driverName,
        teamName: ctx.teamName,
        teamColor: ctx.teamColor,
        isPlayer: ctx.isPlayer,
        isUrgent: true,
        category: 'engine',
        message: text,
        personalityTag: ctx.wearProfileName || 'Piloto',
        timestamp: nowStr,
      },
      updatedCooldowns: {
        ...cooldowns,
        lastLapEngine: currentLap,
      },
    }
  }

  // 4. GATILHO PNEUS EM DESGASTE MÉDIO (>50% ou >45% para agressivo) (Informativo leve - Não congela)
  const highThreshold = isAggressive ? 46 : isConservative ? 56 : 50
  const highCooldownOver = !cooldowns.lastLapTireHigh || currentLap - cooldowns.lastLapTireHigh >= 6

  if (ctx.tireWear >= highThreshold && ctx.tireWear < critThreshold && highCooldownOver) {
    const text = pickRandom(RADIO_PHRASES.tire_high[tone])
    return {
      message: {
        id: `radio_tirehigh_${ctx.driverId}_${currentLap}`,
        lap: currentLap,
        driverId: ctx.driverId,
        driverName: ctx.driverName,
        teamName: ctx.teamName,
        teamColor: ctx.teamColor,
        isPlayer: ctx.isPlayer,
        isUrgent: false,
        category: 'tire_high',
        message: text,
        personalityTag: ctx.wearProfileName || 'Piloto',
        timestamp: nowStr,
      },
      updatedCooldowns: {
        ...cooldowns,
        lastLapTireHigh: currentLap,
      },
    }
  }

  // 5. GATILHO ADVERSÁRIO À FRENTE (Gap < 1.5s) (Informativo leve - Não congela)
  const aheadCooldownOver =
    !cooldowns.lastLapRivalAhead || currentLap - cooldowns.lastLapRivalAhead >= 5

  if (
    ctx.gapFrontSec !== undefined &&
    ctx.gapFrontSec > 0 &&
    ctx.gapFrontSec < 1.45 &&
    aheadCooldownOver &&
    Math.random() < 0.6
  ) {
    const text = pickRandom(RADIO_PHRASES.rival_ahead[tone])
    return {
      message: {
        id: `radio_ahead_${ctx.driverId}_${currentLap}`,
        lap: currentLap,
        driverId: ctx.driverId,
        driverName: ctx.driverName,
        teamName: ctx.teamName,
        teamColor: ctx.teamColor,
        isPlayer: ctx.isPlayer,
        isUrgent: false,
        category: 'rival_ahead',
        message: text,
        personalityTag: ctx.wearProfileName || 'Piloto',
        timestamp: nowStr,
      },
      updatedCooldowns: {
        ...cooldowns,
        lastLapRivalAhead: currentLap,
      },
    }
  }

  // 6. GATILHO ADVERSÁRIO PRESSIONANDO ATRÁS (Gap < 1.0s) (Informativo leve - Não congela)
  const behindCooldownOver =
    !cooldowns.lastLapRivalBehind || currentLap - cooldowns.lastLapRivalBehind >= 5

  if (
    ctx.gapBehindSec !== undefined &&
    ctx.gapBehindSec > 0 &&
    ctx.gapBehindSec < 0.95 &&
    behindCooldownOver &&
    Math.random() < 0.55
  ) {
    const text = pickRandom(RADIO_PHRASES.rival_behind[tone])
    return {
      message: {
        id: `radio_behind_${ctx.driverId}_${currentLap}`,
        lap: currentLap,
        driverId: ctx.driverId,
        driverName: ctx.driverName,
        teamName: ctx.teamName,
        teamColor: ctx.teamColor,
        isPlayer: ctx.isPlayer,
        isUrgent: false,
        category: 'rival_behind',
        message: text,
        personalityTag: ctx.wearProfileName || 'Piloto',
        timestamp: nowStr,
      },
      updatedCooldowns: {
        ...cooldowns,
        lastLapRivalBehind: currentLap,
      },
    }
  }

  // 7. GATILHO CLIMA INCOMPATÍVEL COM PNEU ATUAL (Urgente se slick na chuva ou inter no seco)
  const weatherCooldownOver =
    !cooldowns.lastLapWeather || currentLap - cooldowns.lastLapWeather >= 4

  const isSlickInRain =
    (weatherState === 'chuva_fraca' || weatherState === 'chuva_forte') &&
    (ctx.tireCompound === 'macio' || ctx.tireCompound === 'medio' || ctx.tireCompound === 'duro')

  const isRainInDry =
    weatherState === 'seco' &&
    (ctx.tireCompound === 'intermediario' || ctx.tireCompound === 'chuva_extrema')

  if ((isSlickInRain || isRainInDry) && weatherCooldownOver) {
    const text = pickRandom(RADIO_PHRASES.weather[tone])
    return {
      message: {
        id: `radio_weather_${ctx.driverId}_${currentLap}`,
        lap: currentLap,
        driverId: ctx.driverId,
        driverName: ctx.driverName,
        teamName: ctx.teamName,
        teamColor: ctx.teamColor,
        isPlayer: ctx.isPlayer,
        isUrgent: true,
        category: 'weather',
        message: text,
        personalityTag: ctx.wearProfileName || 'Piloto',
        timestamp: nowStr,
      },
      updatedCooldowns: {
        ...cooldowns,
        lastLapWeather: currentLap,
      },
    }
  }

  return null
}
