import { GrandPrixInfo, SessionSetupModel } from '@/types/f1'

export interface SetupFeedbackResult {
  overallScore: number // 0-100% de adequação
  verdict: 'ideal' | 'bom' | 'desajustado' | 'critico'
  title: string
  summary: string
  wingFeedback: {
    status: 'ideal' | 'alto' | 'baixo'
    text: string
  }
  suspensionFeedback: {
    status: 'ideal' | 'rigida' | 'macia'
    text: string
  }
  puFeedback: {
    status: 'equilibrado' | 'agressivo' | 'conservador'
    text: string
  }
}

/**
 * Analisa as opções de asas, suspensão e divisão 50/50 em relação às características do GP.
 * Retorna uma leitura de engenharia realista com diagnóstico técnico.
 */
export function analyzeSetupEngineering(
  setup: SessionSetupModel,
  gpInfo: GrandPrixInfo,
): SetupFeedbackResult {
  const idealWing = gpInfo.downforceIdeal ?? 6
  const idealSuspension = gpInfo.suspensionIdeal ?? 6
  const currentWing = setup.wing_level ?? 6
  const currentSusp = setup.suspension_stiffness ?? 6
  const currentPU = setup.pu_electric_ratio ?? 50

  const wingDiff = currentWing - idealWing
  const suspDiff = currentSusp - idealSuspension
  const puDiff = currentPU - 50

  // 1. Wing feedback
  let wingStatus: 'ideal' | 'alto' | 'baixo' = 'ideal'
  let wingText = ''

  if (Math.abs(wingDiff) === 0) {
    wingStatus = 'ideal'
    wingText = `Asa no nível ${currentWing}: Carga aerodinâmica perfeitamente casada com ${gpInfo.circuit}. Excelente velocidade de reta sem comprometer o apoio em curvas.`
  } else if (wingDiff > 0) {
    wingStatus = 'alto'
    const dragLoss = (wingDiff * 4.2).toFixed(1)
    if (idealWing <= 3) {
      wingText = `Asa no nível ${currentWing} em ${gpInfo.name}: Excesso crítico de arrasto para uma pista de retas puras. Perda estimada de ~${dragLoss} km/h de velocidade máxima.`
    } else {
      wingText = `Asa no nível ${currentWing}: Muita sustentação negativa (+${wingDiff} acima do ideal). Boa aderência lenta, mas carro fica preso nas retas (-${dragLoss} km/h).`
    }
  } else {
    wingStatus = 'baixo'
    const gripLoss = Math.abs(wingDiff) * 3
    if (idealWing >= 8) {
      wingText = `Asa no nível ${currentWing} em ${gpInfo.name}: Asa perigosamente baixa para traçado sinuoso! Traseira instável, perda massiva de tração em saída de curvas lentas.`
    } else {
      wingText = `Asa no nível ${currentWing}: Baixo arrasto (+${Math.abs(wingDiff) * 3} km/h de reta), porém exige correções contínuas de direção e aumenta o desgaste térmico dos pneus.`
    }
  }

  // 2. Suspension feedback
  let suspStatus: 'ideal' | 'rigida' | 'macia' = 'ideal'
  let suspText = ''

  if (Math.abs(suspDiff) === 0) {
    suspStatus = 'ideal'
    suspText = `Suspensão ${currentSusp}/10: Altura de rodagem e amortecimento ideais. O assoalho sela o efeito solo sem rebote e absorve com perfeição as zebras da pista.`
  } else if (suspDiff > 0) {
    suspStatus = 'rigida'
    if (idealSuspension <= 4) {
      suspText = `Suspensão nível ${currentSusp}: Muito rígida para os kerbs agressivos de ${gpInfo.name}. O carro pula e perde contato com o asfalto nas chicanees e zebras altas.`
    } else {
      suspText = `Suspensão nível ${currentSusp}: Carro muito direto nas mudanças de direção, porém com risco de estresse estrutural e perda de tração em asfalto ondulado.`
    }
  } else {
    suspStatus = 'macia'
    if (idealSuspension >= 7) {
      suspText = `Suspensão nível ${currentSusp}: Excessivamente macia para curvas velozes de alta carga. A rolagem lateral de carroceria gera flutuação no fluxo de ar do difusor.`
    } else {
      suspText = `Suspensão nível ${currentSusp}: Confortável e poupa pneus, mas responde com leve atraso nas entradas de curva e frenagens fortes.`
    }
  }

  // 3. Power Unit 50/50 balance
  let puStatus: 'equilibrado' | 'agressivo' | 'conservador' = 'equilibrado'
  let puText = ''

  if (currentPU === 50) {
    puStatus = 'equilibrado'
    puText = `MGU-K 50% / V6 50%: Mapeamento padrão homologado FIA. Recuperação de energia simétrica e entrega de 350kW sem sobreaquecimento das células de bateria.`
  } else if (currentPU > 50) {
    puStatus = 'agressivo'
    const extraWear = Math.round((currentPU - 50) * 0.4)
    puText = `MGU-K em ${currentPU}% elétrico: Overdrive no motor elétrico! Retomadas explosivas, mas acelera o desgaste térmico do trem de força (+${extraWear}% de estresse na PU).`
  } else {
    puStatus = 'conservador'
    puText = `MGU-K em ${currentPU}% elétrico: Mapa conservador focado em proteger o motor V6 e a bateria. Menor taxa de degradação, mas entrega menos pico nas ultrapassagens.`
  }

  // Overall Score Calculation (100 is best)
  const penalty = Math.abs(wingDiff) * 8 + Math.abs(suspDiff) * 6 + Math.abs(puDiff) * 0.4
  const overallScore = Math.max(20, Math.min(100, Math.round(100 - penalty)))

  let verdict: 'ideal' | 'bom' | 'desajustado' | 'critico' = 'bom'
  let title = 'Setup Equilibrado'
  let summary = ''

  if (overallScore >= 92) {
    verdict = 'ideal'
    title = 'Excelente Correlação com a Pista'
    summary = `Os engenheiros de telemetria aprovaram o pacote para ${gpInfo.circuit}. Downforce, amortecimento e recuperação híbrida estão no ápice para buscar posições de ponta!`
  } else if (overallScore >= 75) {
    verdict = 'bom'
    title = 'Setup Competitivo com Ajustes Menores Possíveis'
    summary = `Configuração funcional para ${gpInfo.name}. Há pequenos ganhos marginais possíveis na asa ou suspensão para extrair décimos preciosos por volta.`
  } else if (overallScore >= 50) {
    verdict = 'desajustado'
    title = 'Compromisso Técnico Abaixo do Esperado'
    summary = `Desvio notável em relação às exigências de ${gpInfo.circuit}. O piloto reporta desequilíbrio e dificuldade para sustentar o ritmo de corrida.`
  } else {
    verdict = 'critico'
    title = 'Setup Crítico // Incompatível com o Circuito'
    summary = `Configuração amplamente contrária às características da pista! Risco de alto desgaste de pneus, perda severa de tempo por volta e estresse no motor.`
  }

  return {
    overallScore,
    verdict,
    title,
    summary,
    wingFeedback: { status: wingStatus, text: wingText },
    suspensionFeedback: { status: suspStatus, text: suspText },
    puFeedback: { status: puStatus, text: puText },
  }
}
