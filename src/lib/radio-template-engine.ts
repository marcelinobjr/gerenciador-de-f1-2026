/**
 * IMPLEMENTAÇÃO Nº 6B — TEMPLATES TEXTUAIS CANÔNICOS DE RÁDIO
 *
 * Mapeia (ReactionType, OrderType / RequestType, Personalidade, Tensão, Profissionalismo)
 * em frases realistas e autênticas de F1.
 *
 * Regra de Ouro:
 * - Sem caricaturas, sem humilhação, sem tom infantil.
 * - Profissionalismo alto = mensagens contidas e técnicas.
 * - Baixo profissionalismo + alta tensão = respostas secas e ríspidas.
 * - Lógica matemática e estruturada decide ANTES; o template apenas veste a fala.
 */

import {
  RaceReactionType,
  TeamOrderType,
  DriverRequestType,
  TeamOrderReason,
} from '@/types/race-interactions'
import { DriverPersonalityTraits, DriverEmotionalState } from '@/types/driver-psychology'

export interface RadioTextContext {
  driverName: string
  teammateName?: string
  lap: number
  traits: DriverPersonalityTraits
  emotionalState: DriverEmotionalState
  reactionType: RaceReactionType
  orderType?: TeamOrderType
  orderReason?: TeamOrderReason
  requestType?: DriverRequestType
  followUpText?: string
}

export class RadioTemplateEngine {
  /**
   * Gera a frase de resposta do piloto para uma ordem de equipe
   */
  public getOrderResponseText(ctx: RadioTextContext): string {
    const isHighProf = ctx.traits.professionalism >= 70
    const isHighEgo = ctx.traits.ego >= 70
    const isHighTension =
      ctx.emotionalState.emotionalTension >= 60 || ctx.emotionalState.frustration >= 60
    const mateName = ctx.teammateName ? ctx.teammateName.split(' ')[1] || ctx.teammateName : 'ele'

    switch (ctx.reactionType) {
      case 'ACCEPT': {
        if (ctx.orderType === 'LET_TEAMMATE_PASS') {
          if (isHighProf) {
            return `Entendido. Vou abrir caminho para ${mateName} na curva 4.`
          }
          return `Copiado. Deixando ${mateName} passar agora.`
        }

        if (ctx.orderType === 'HOLD_POSITION' || ctx.orderType === 'DO_NOT_FIGHT') {
          if (isHighProf) {
            return 'Entendido. Mantendo posição e cuidando do carro.'
          }
          return 'Ok, segurando a posição. Sem disputa.'
        }

        if (ctx.orderType === 'ATTACK' || ctx.orderType === 'PUSH') {
          return 'Vamos nessa! Modo de ataque ativado, indo pra cima.'
        }

        if (ctx.orderType === 'MANAGE_TYRES' || ctx.orderType === 'EXTEND_STINT') {
          return 'Entendido. Administrando a borracha e os deltas.'
        }

        if (ctx.orderType === 'BOX_THIS_LAP') {
          return 'Box nesta volta, confirmado. Preparem os pneus!'
        }

        if (ctx.orderType === 'STAY_OUT') {
          return 'Entendido, fico na pista. Gerenciando o ritmo.'
        }

        return 'Copiado. Ordem entendida, executando.'
      }

      case 'ACCEPT_RELUCTANTLY': {
        if (ctx.orderType === 'LET_TEAMMATE_PASS') {
          if (isHighProf) {
            return `Entendido... mas registrem que estou cedendo por ordem da equipe. Falamos depois da prova.`
          }
          if (isHighEgo || isHighTension) {
            return `Ok, vou deixar ${mateName} passar... mas não me peçam isso de novo.`
          }
          return `Entendido... não concordo com essa troca, mas vou executar.`
        }

        if (ctx.orderType === 'HOLD_POSITION' || ctx.orderType === 'DO_NOT_FIGHT') {
          if (isHighProf) {
            return `Copiado. Acho que poderíamos avançar, mas respeito a ordem de manter posição.`
          }
          return `Ok, mas eu tinha ritmo para atacar. Estamos jogando pontos fora.`
        }

        if (ctx.orderType === 'STAY_OUT') {
          return `Entendido... mas esses pneus estão no osso. Se perdermos tempo, estava avisado.`
        }

        if (ctx.orderType === 'BOX_THIS_LAP') {
          return `Entendido, entrando... mas o ritmo ainda estava bom na pista.`
        }

        return `Copiado... vou fazer, mas não acho que seja a decisão certa.`
      }

      case 'QUESTION': {
        if (ctx.orderType === 'LET_TEAMMATE_PASS') {
          if (isHighProf) {
            return `Qual é o motivo? Meu ritmo está sólido e estou abrindo gap.`
          }
          return `Por que deixar passar? Eu sou mais rápido que ${mateName} no setor 2!`
        }

        if (ctx.orderType === 'HOLD_POSITION') {
          return `Por que não posso ultrapassar? O carro à frente está vulnerável!`
        }

        if (ctx.orderType === 'BOX_THIS_LAP') {
          return `Box já? A borracha ainda tem aderência, podemos estender mais 3 voltas?`
        }

        if (ctx.orderType === 'STAY_OUT') {
          return `Ficar fora? O desgaste caiu muito na curva 8, tem certeza dos dados?`
        }

        return `Qual é a razão dessa ordem? Precisamos rever o plano.`
      }

      case 'RESIST': {
        if (ctx.orderType === 'LET_TEAMMATE_PASS') {
          if (isHighEgo || isHighTension) {
            return `Não faz sentido nenhum! Deixem a gente disputar na pista, eu não vou abrir de graça!`
          }
          return `Negativo, o ritmo dele não é melhor que o meu. Me deem mais 2 voltas para provar.`
        }

        if (ctx.orderType === 'HOLD_POSITION' || ctx.orderType === 'DO_NOT_FIGHT') {
          return `Estou muito mais rápido. Segurar aqui vai nos fazer perder contato com o pelotão!`
        }

        if (ctx.orderType === 'STAY_OUT') {
          return `O carro está inguiável! Se eu ficar mais uma volta, nós vamos bater ou furar pneu!`
        }

        return `Discordo totalmente. Essa ordem compromete a minha corrida.`
      }

      case 'REFUSE': {
        if (ctx.orderType === 'LET_TEAMMATE_PASS') {
          if (isHighProf) {
            return `Negativo, pit wall. Estou disputando a minha corrida e não vou abrir passagem.`
          }
          return `Não. Digam a ${mateName} para me passar na pista se ele for mais rápido.`
        }

        if (ctx.orderType === 'HOLD_POSITION') {
          return `Não vou segurar. A chance de ultrapassar é agora!`
        }

        return `Negativo. Não vou cumprir essa ordem.`
      }
    }
  }

  /**
   * Gera a frase com justificativa oficial do Pit Wall (usada na ordem inicial ou follow-up)
   */
  public getPitWallOrderText(
    orderType: TeamOrderType,
    reason: TeamOrderReason,
    driverName: string,
    teammateName?: string,
  ): string {
    const dName = driverName.split(' ')[0] || driverName
    const mName = teammateName ? teammateName.split(' ')[0] || teammateName : 'o companheiro'

    switch (orderType) {
      case 'LET_TEAMMATE_PASS': {
        if (reason === 'DIFFERENT_STRATEGY') {
          return `${dName}, rádio do box. ${mName} está em estratégia diferente e pneus novos. Abra passagem sem perder tempo na curva 4.`
        }
        if (reason === 'CHAMPIONSHIP_PRIORITY') {
          return `${dName}, prioridade do campeonato. ${mName} lidera a tabela de pontos. Precisamos trocar as posições.`
        }
        if (reason === 'FASTER_TEAMMATE') {
          return `${dName}, ${mName} tem delta 0.8s superior nesta fase. Troquem de posição para ele atacar à frente.`
        }
        if (reason === 'DAMAGE') {
          return `${dName}, seu carro tem dano aerodinâmico confirmado na telemetria. Deixe ${mName} passar.`
        }
        return `${dName}, ordem do pit wall: inverta a posição com ${mName} nesta volta.`
      }

      case 'HOLD_POSITION':
        return `${dName}, mantenha a posição atual. Não force disputa contra ${mName}. Precisamos do resultado da equipe.`

      case 'DO_NOT_FIGHT':
        return `${dName}, não disputem a freada com ${mName}. Espaço limpo e sem risco para os dois carros.`

      case 'ATTACK':
        return `${dName}, liberação total do pit wall. Modo ataque ativado, force o ritmo!`

      case 'PUSH':
        return `${dName}, volta de push! Reduza a distância para o carro à frente agora.`

      case 'MANAGE_TYRES':
        return `${dName}, gerencie os pneus no setor de média velocidade. Estamos acima da curva de desgaste.`

      case 'EXTEND_STINT':
        return `${dName}, estenda o stint em mais 4 voltas para abrir janela de pit stop limpa.`

      case 'BOX_THIS_LAP':
        return `Box nesta volta, ${dName}! Box, box, box!`

      case 'STAY_OUT':
        return `Fique na pista, ${dName}! Permaneça na pista, não entre nos boxes.`

      case 'CHANGE_STRATEGY':
        return `${dName}, mudando para o Plano B. Ajuste de estratégia pela telemetria.`
    }
  }

  /**
   * Gera a frase de um pedido espontâneo do piloto (Driver Request)
   */
  public getDriverRequestText(
    requestType: DriverRequestType,
    driverName: string,
    telemetrySummary: string,
    perceivedIssue?: string,
  ): string {
    switch (requestType) {
      case 'REQUEST_PIT':
        return `Pit wall, meus pneus estão mortos! Aderência despencou. Posso parar nesta volta?`

      case 'REQUEST_ATTACK':
        return `Estou colado nele e tenho mais tração. Me deem permissão para atacar!`

      case 'REQUEST_POSITION_SWAP':
        return `Estou preso atrás dele perdendo tempo de volta. Me deixem passar antes que o pelotão chegue!`

      case 'REPORT_TYRE_DROP':
        return `Aviso do cockpit: os pneus caíram de rendimento de repente. Sinto vibração severa.`

      case 'REPORT_DAMAGE':
        return `Sinto o carro puxando para a esquerda após aquele toque. Podem checar a telemetria?`

      case 'REPORT_BALANCE_ISSUE':
        return `Muita saída de frente nas curvas rápidas. O balanço do carro piorou bastante.`

      case 'REPORT_WEATHER_CHANGE':
        return `Gotas visíveis no visor na curva 10! A pista está molhando rapidamente.`

      case 'QUESTION_STRATEGY':
        return `Essa janela de parada não está fazendo sentido com nosso ritmo. Vamos rever o plano?`
    }
  }

  /**
   * Gera a frase de resposta do piloto após follow-up da equipe justificando uma ordem
   */
  public getFollowUpResponseText(ctx: RadioTextContext, acceptedAfterFollowUp: boolean): string {
    const mateName = ctx.teammateName ? ctx.teammateName.split(' ')[1] || ctx.teammateName : 'ele'

    if (acceptedAfterFollowUp) {
      if (ctx.traits.professionalism >= 70) {
        return `Entendido agora. Se o objetivo coletivo é esse, vou abrir passagem para ${mateName}.`
      }
      return `Ok, faz sentido pela estratégia dele. Deixando passar.`
    } else {
      if (ctx.traits.ego >= 75) {
        return `Mesmo assim não concordo! Estou rápido o suficiente e não vou facilitar.`
      }
      return `Ainda acho um erro, mas se insistirem eu seguro o ritmo.`
    }
  }

  /**
   * Gera as declarações pós-corrida (1 a 2 frases) coerentes com o resultado e tratamento
   */
  public getPostRaceStatement(
    driverName: string,
    finalPos: number,
    expectedPos: number,
    ordersImpact: 'none' | 'favored' | 'sacrificed' | 'refused',
    emotionalState: DriverEmotionalState,
  ): string {
    const dName = driverName.split(' ')[0] || driverName

    if (ordersImpact === 'sacrificed') {
      if (emotionalState.frustration >= 70) {
        return `"${dName}: Fiz o que me mandaram hoje, mas não entrei na Fórmula 1 para ser escudeiro. É difícil aceitar abrir mão de uma corrida assim."`
      }
      return `"${dName}: O resultado da equipe sempre vem em primeiro lugar, mesmo quando a ordem custa caro para a sua própria pontuação. É seguir em frente."`
    }

    if (ordersImpact === 'refused') {
      return `"${dName}: Naquele momento da prova, obedecer teria arruinado minha corrida inteira. Um piloto precisa saber o momento de se impor."`
    }

    if (finalPos === 1) {
      return `"${dName}: Um dia perfeito! O carro voou, a estratégia funcionou redonda e a equipe entregou tudo o que precisávamos."`
    }

    if (finalPos <= 3) {
      return `"${dName}: Pódio muito comemorado! Foi uma batalha intensa volta a volta e conseguimos maximizar os pontos da equipe."`
    }

    if (finalPos <= expectedPos) {
      return `"${dName}: Tiramos o máximo que o pacote nos dava hoje. Ritmo limpo e boa execução da garagem."`
    }

    return `"${dName}: Não foi o fim de semana que esperávamos. Faltou ritmo em momentos cruciais e agora é focar na análise dos dados para a próxima."`
  }
}

export const radioTemplateEngine = new RadioTemplateEngine()
