/**
 * IMPLEMENTAÇÃO Nº 6B — SERVIÇO CENTRAL DE INTERAÇÃO NA CORRIDA
 * DriverRaceInteractionService
 *
 * Conecta:
 * 6A (Personalidade, Relações, Memória, Promessas, Seat Security)
 * ↔ Race Engine (Simular / Acompanhar / AI Pit Wall)
 * ↔ Rádio Estruturado
 * ↔ Manager Effects
 * ↔ Domain Events & Memórias persistentes
 */

import {
  RaceReactionType,
  TeamOrderType,
  TeamOrderReason,
  TeamOrderPayload,
  DriverRequestType,
  DriverRequestPayload,
  RaceInteractionContext,
  InteractionEvaluationResult,
  RaceInteractionTelemetryReport,
  SessionRadioLogEntry,
} from '@/types/race-interactions'
import { DriverPersonalityTraits, DriverEmotionalState } from '@/types/driver-psychology'
import { driverRelationshipService } from '@/services/driverRelationshipService'
import { radioTemplateEngine } from '@/lib/radio-template-engine'
import { managerEffectService } from '@/services/managerEffectService'
import { clamp } from '@/lib/driver-psychology-utils'
import { DriverModel, TeamModel } from '@/types/f1'

export interface AntiSpamCooldownEntry {
  lastLap: number
  countInSession: number
}

export class DriverRaceInteractionService {
  // Cooldowns de ordens para evitar spam de LET_TEAMMATE_PASS
  private orderCooldownMap: Map<string, AntiSpamCooldownEntry> = new Map()

  // Histórico de interações por ID estável para Idempotência rigorosa
  private interactionHistory: Map<string, InteractionEvaluationResult> = new Map()

  // Logs de rádio da sessão ativa
  private sessionRadioLogs: SessionRadioLogEntry[] = []

  // Rastreia se piloto pediu pit nesta corrida e se foi negado para avaliação futura
  private pendingDeniedPitRequests: Map<
    string,
    {
      lapDenied: number
      tireWearAtDenial: number
      driverName: string
    }
  > = new Map()

  /**
   * Limpa cache de sessão para nova prova
   */
  public resetSessionState(): void {
    this.orderCooldownMap.clear()
    this.interactionHistory.clear()
    this.sessionRadioLogs = []
    this.pendingDeniedPitRequests.clear()
  }

  /**
   * Avalia uma ordem de equipe enviada pelo jogador ou pela IA do Pit Wall
   */
  public evaluateTeamOrder(
    order: TeamOrderPayload,
    ctx: RaceInteractionContext,
    driver: Partial<DriverModel> & { name?: string; procedural_data?: any },
    team?: Partial<TeamModel> | null,
    teammate?: Partial<DriverModel> | null,
  ): InteractionEvaluationResult {
    const interactionId =
      order.orderId || `ord_${order.orderType}_${ctx.driverId}_${ctx.currentLap}`

    // 1. Verificação de Idempotência
    if (this.interactionHistory.has(interactionId)) {
      return this.interactionHistory.get(interactionId)!
    }

    // 2. Consulta 6A (Personalidade, Relações, Memória, Promessas, Seat Security)
    const bundle = driverRelationshipService.getOrCreatePsychologyBundle(driver)
    const traits = bundle.traits
    const emotional = bundle.emotionalState
    const rel = bundle.relationships
    const mateRel = rel.teammate

    // Anti-spam / Cooldown de ordens sensíveis
    const spamKey = `${ctx.driverId}_${order.orderType}`
    const previousCooldown = this.orderCooldownMap.get(spamKey)
    if (previousCooldown && ctx.currentLap - previousCooldown.lastLap < 3 && !order.isFollowUp) {
      // Bloqueio de spam: piloto resiste automaticamente se ordem repetida em menos de 3 voltas
      return this.buildSpamResistResult(interactionId, ctx, traits, emotional)
    }

    // Atualiza cooldown
    this.orderCooldownMap.set(spamKey, {
      lastLap: ctx.currentLap,
      countInSession: (previousCooldown?.countInSession || 0) + 1,
    })

    // 3. Modulação pelo Team Principal / Manager
    const managerEval = managerEffectService.evaluateManager(team)
    const managerRaceMgmt = ctx.managerRaceManagement ?? managerEval.domainScores.raceManagement
    const managerPeopleMgmt =
      ctx.managerPeopleManagement ?? managerEval.domainScores.peopleManagement

    // Bônus/penalidade do Manager:
    // Estrategista / raceManagement alto melhora clareza (+1 a +6)
    // Líder / peopleManagement alto amortece atrito relacional (+1 a +6)
    const managerScoreBonus = (managerRaceMgmt - 75) * 0.15 + (managerPeopleMgmt - 75) * 0.12

    // 4. Cálculo de Gravidade da Ordem (Severity) e Justificativa (Reason Bonus)
    let orderSeverity = 0
    let justificationBonus = 0

    switch (order.orderType) {
      case 'LET_TEAMMATE_PASS': {
        orderSeverity = 38 // A mais sensível psicologicamente!

        // Disputa de vitória ou pódio aumenta muito a gravidade
        if (ctx.position === 1) orderSeverity += 25
        else if (ctx.position <= 3) orderSeverity += 15
        else if (ctx.position <= 6) orderSeverity += 8

        // Avaliação da Justificativa
        if (order.reason === 'DIFFERENT_STRATEGY') {
          // Teammate em pneus novos ou estratégia comprovadamente diferente
          justificationBonus += 18
        } else if (order.reason === 'FASTER_TEAMMATE') {
          const gap = ctx.gapToTeammateSec ?? 0.8
          justificationBonus += gap < 1.0 ? 12 : 6
        } else if (order.reason === 'CHAMPIONSHIP_PRIORITY') {
          // Campeonato justifica muito se teammate briga por título e piloto não
          const ptsDiff =
            (ctx.championshipPointsTeammate || 0) - (ctx.championshipPointsDriver || 0)
          if (ptsDiff > 40 && ctx.round > 5) {
            justificationBonus += 22
          } else if (ptsDiff > 15) {
            justificationBonus += 12
          } else {
            // Empatados no campeonato recebendo ordem de favorecimento = revolta!
            orderSeverity += 12
          }
        } else if (order.reason === 'DAMAGE') {
          justificationBonus += 24 // Carro danificado = ordem lógica e justificada
        } else if (order.reason === 'TYRE_OFFSET') {
          justificationBonus += 15
        } else {
          // Ordem arbitrária sem justificativa clara
          justificationBonus -= 10
        }
        break
      }

      case 'HOLD_POSITION':
      case 'DO_NOT_FIGHT': {
        orderSeverity = 18
        if (ctx.position <= 3) orderSeverity += 10
        if (order.reason === 'TEAM_RESULT') justificationBonus += 12
        if (order.reason === 'CHAMPIONSHIP_PRIORITY') justificationBonus += 14
        break
      }

      case 'ATTACK':
      case 'PUSH': {
        orderSeverity = 5 // Geralmente aceita com empolgação
        justificationBonus = 15
        break
      }

      case 'MANAGE_TYRES':
      case 'EXTEND_STINT': {
        orderSeverity = 10
        justificationBonus = 12
        break
      }

      case 'BOX_THIS_LAP': {
        orderSeverity = 8
        if (ctx.isInCliff || ctx.tireWear > 70) {
          justificationBonus = 25 // Piloto já quer parar
        } else if (ctx.tireWear < 35) {
          // Parada cedo demais = questionamento natural
          orderSeverity += 15
        }
        break
      }

      case 'STAY_OUT': {
        orderSeverity = 15
        if (ctx.isInCliff || ctx.tireWear > 75) {
          // Mandar ficar fora com pneu no cliff = ordem muito arriscada e danosa
          orderSeverity += 25
        } else {
          justificationBonus = 10
        }
        break
      }

      case 'CHANGE_STRATEGY': {
        orderSeverity = 12
        justificationBonus = 10
        break
      }
    }

    // Se for follow-up da equipe justificando, ganha bônus de aceitação
    if (order.isFollowUp) {
      justificationBonus += 14
    }

    // 5. Pontuação de Traços (Traits Score)
    // Profissionalismo e Cooperação puxam para obediência
    // Ambição e Ego puxam para resistência/recusa
    const profBonus = ((traits.professionalism - 50) / 50) * 22
    const coopBonus = ((traits.cooperation - 50) / 50) * 20
    const loyaltyBonus = ((traits.loyalty - 50) / 50) * 12
    const ambPenalty = ((traits.ambition - 50) / 50) * 20
    const egoPenalty = ((traits.ego - 50) / 50) * 22

    const traitsScore = profBonus + coopBonus + loyaltyBonus - ambPenalty - egoPenalty

    // 6. Relações e Histórico (6A)
    const tpTrustBonus = ((rel.teamPrincipal.trust - 50) / 50) * 18
    const sportingTrustBonus = ((rel.team.sportingTrust - 50) / 50) * 14
    const mateRivalryPenalty = mateRel ? ((mateRel.rivalry - 50) / 50) * 16 : 0
    const mateTensionPenalty = mateRel ? ((mateRel.tension - 20) / 50) * 18 : 0
    const mateRespectBonus = mateRel ? ((mateRel.respect - 50) / 50) * 12 : 0

    const relationshipScore =
      tpTrustBonus + sportingTrustBonus + mateRespectBonus - mateRivalryPenalty - mateTensionPenalty

    // Verificação de Histórico e Promessas
    let historyScore = 0
    const recentNegativeMemories = bundle.memories.filter(
      (m) =>
        (m.eventType === 'teammate_favoritism_felt' ||
          m.eventType === 'strategy_blunder_team' ||
          m.eventType === 'upgrade_denied_priority') &&
        !m.isArchivedHistorical &&
        m.salience > 15,
    ).length

    // Histórico de favoritismo adverso reduz obediência
    historyScore -= recentNegativeMemories * 7

    // Promessa de status de primeiro piloto ou igualdade
    const numberOnePromise = bundle.promises.find(
      (p) => p.type === 'numberOneStatus' && p.status === 'active',
    )
    if (numberOnePromise && order.orderType === 'LET_TEAMMATE_PASS') {
      historyScore -= 25 // Prometeram status de nº 1 e pedem para ceder posição!
    }

    // Status de Primeiro Piloto ativado na temporada
    if (ctx.isNumberOneStatusActive && order.orderType === 'LET_TEAMMATE_PASS') {
      historyScore -= 20
    }

    // 7. Campeonato e Situação Geral
    let championshipBonus = 0
    if (ctx.isTeammateChampionshipContender && !ctx.isChampionshipContender) {
      championshipBonus += 15
    }

    // 8. Pontuação Final de Obediência Estruturada
    const baseObedienceScore = 65 // Padrão de piloto profissional
    const finalScore =
      baseObedienceScore -
      orderSeverity +
      justificationBonus +
      traitsScore +
      relationshipScore +
      historyScore +
      championshipBonus +
      managerScoreBonus

    // 9. Determinação do ReactionType via Limiares Estáveis
    // REFUSE: combinação muito rara (< 15 pontos)
    // RESIST: 15 a 35 pontos
    // QUESTION: 36 a 55 pontos
    // ACCEPT_RELUCTANTLY: 56 a 75 pontos (ou profissional alto mesmo com score menor)
    // ACCEPT: > 75 pontos
    let reactionType: RaceReactionType = 'ACCEPT'
    let actionApplied = true
    let executionLatencySectors = 0
    let followUpAllowed = false

    // REGRA DE OURO 2 & 6: Profissional alto mesmo frustrado aceita a contragosto (não recusa)
    const isAngryPro = traits.professionalism >= 72 && finalScore < 56

    if (finalScore < 16 && !isAngryPro) {
      reactionType = 'REFUSE'
      actionApplied = false // Recusa = ação NÃO aplicada
      executionLatencySectors = 0
      followUpAllowed = false
    } else if (finalScore < 36 && !isAngryPro) {
      reactionType = 'RESIST'
      actionApplied = true // Resiste, mas eventualmente executa se insistido
      executionLatencySectors = 2 // 2 setores de atraso
      followUpAllowed = true
    } else if (finalScore < 56 && !isAngryPro) {
      reactionType = 'QUESTION'
      actionApplied = true
      executionLatencySectors = 1 // 1 setor de hesitação enquanto pergunta
      followUpAllowed = true
    } else if (finalScore <= 75 || isAngryPro) {
      reactionType = 'ACCEPT_RELUCTANTLY'
      actionApplied = true
      executionLatencySectors = 0 // Executa na hora, mas com custo psicológico
      followUpAllowed = false
    } else {
      reactionType = 'ACCEPT'
      actionApplied = true
      executionLatencySectors = 0
      followUpAllowed = false
    }

    // 10. Consequências Psicológicas e Relacionais
    const {
      stateDeltas,
      tpRelationshipDeltas,
      teamRelationshipDeltas,
      teammateRelationshipDeltas,
    } = this.calculateOrderConsequences(order, reactionType, traits, managerPeopleMgmt)

    // 11. Geração de Memória (Regra de Ouro: memórias fortes apenas quando relevante)
    const memoryPayload = this.resolveOrderMemoryPayload(
      order,
      ctx,
      reactionType,
      stateDeltas,
      tpRelationshipDeltas,
      teamRelationshipDeltas,
      teammateRelationshipDeltas,
    )

    // Se gerar memória e o DriverRelationshipService for acionado
    let shouldGenerateMemory = false
    if (memoryPayload) {
      shouldGenerateMemory = true
      driverRelationshipService.processDomainEvent({
        driver,
        eventType: memoryPayload.eventType as any,
        season: ctx.season,
        round: ctx.round,
        circuitId: ctx.circuitId,
        team,
        teammate,
        sourceEventId: interactionId,
        description: memoryPayload.description,
      })
    }

    // 12. Obtenção do Texto de Rádio
    const radioMessageText = radioTemplateEngine.getOrderResponseText({
      driverName: ctx.driverName,
      teammateName: ctx.teammateName,
      lap: ctx.currentLap,
      traits,
      emotionalState: emotional,
      reactionType,
      orderType: order.orderType,
      orderReason: order.reason,
    })

    // Registrar no log da sessão
    this.sessionRadioLogs.push({
      id: `rad_log_${Date.now()}_${ctx.driverId}`,
      lap: ctx.currentLap,
      driverId: ctx.driverId,
      driverName: ctx.driverName,
      origin: 'driver',
      type: 'feedback',
      message: radioMessageText,
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      reactionType,
      orderType: order.orderType,
    })

    const result: InteractionEvaluationResult = {
      interactionId,
      driverId: ctx.driverId,
      reactionType,
      actionApplied,
      executionLatencySectors,
      radioMessageText,
      radioTone:
        reactionType === 'REFUSE'
          ? 'combative'
          : reactionType === 'RESIST'
            ? 'resistant'
            : reactionType === 'QUESTION'
              ? 'questioning'
              : reactionType === 'ACCEPT_RELUCTANTLY'
                ? 'reluctant'
                : 'obedient',
      followUpAllowed,
      followUpReasonPrompt: followUpAllowed ? order.reason : undefined,
      stateDeltas,
      tpRelationshipDeltas,
      teamRelationshipDeltas,
      teammateRelationshipDeltas,
      shouldGenerateMemory,
      memoryPayload,
      scoreBreakdown: {
        baseObedienceScore,
        orderSeverity,
        justificationBonus,
        traitsScore: Math.round(traitsScore),
        relationshipScore: Math.round(relationshipScore),
        historyScore: Math.round(historyScore),
        championshipBonus,
        managerBonus: Math.round(managerScoreBonus),
        finalScore: Math.round(finalScore),
        decisionThresholds: {
          refuseThreshold: 15,
          resistThreshold: 35,
          questionThreshold: 55,
          acceptReluctantThreshold: 75,
        },
      },
    }

    this.interactionHistory.set(interactionId, result)
    return result
  }

  /**
   * Avalia a resposta ao follow-up (equipe justifica após QUESTION ou RESIST)
   * Limite de NO MÁXIMO 1 follow-up garantido.
   */
  public evaluateFollowUp(
    order: TeamOrderPayload,
    ctx: RaceInteractionContext,
    driver: Partial<DriverModel>,
    team?: Partial<TeamModel> | null,
    teammate?: Partial<DriverModel> | null,
  ): InteractionEvaluationResult {
    const followUpOrder: TeamOrderPayload = {
      ...order,
      orderId: `${order.orderId}_followup`,
      isFollowUp: true,
    }

    const result = this.evaluateTeamOrder(followUpOrder, ctx, driver, team, teammate)
    // No follow-up adicional permitido
    result.followUpAllowed = false
    return result
  }

  /**
   * Piloto inicia interação espontânea (Driver Request)
   * Baseado em dados reais de telemetria + technicalFeedback + personalidade.
   */
  public generateDriverRequest(
    ctx: RaceInteractionContext,
    driver: Partial<DriverModel> & { name?: string },
  ): DriverRequestPayload | null {
    const techFeedback = driver.technical_feedback ?? 70
    const traits = driverRelationshipService.getOrCreatePsychologyBundle(driver).traits
    const emotional = driverRelationshipService.getOrCreatePsychologyBundle(driver).emotionalState

    // 1. Solicitação de PIT STOP
    // Se o pneu estiver desgastado (>65% ou no cliff)
    if (ctx.isInCliff || ctx.tireWear >= 65) {
      const accuracy = clamp(techFeedback + Math.round((Math.random() - 0.5) * 15))
      return {
        requestId: `req_pit_${ctx.driverId}_${ctx.currentLap}`,
        requestType: 'REQUEST_PIT',
        driverId: ctx.driverId,
        driverName: ctx.driverName,
        lap: ctx.currentLap,
        round: ctx.round,
        season: ctx.season,
        telemetryContext: {
          tireWear: ctx.tireWear,
          isInCliff: ctx.isInCliff,
          tyreCompound: ctx.tireCompound,
          position: ctx.position,
        },
        urgency: ctx.isInCliff || ctx.tireWear >= 80 ? 'critical' : 'high',
        accuracy,
        perceivedIssue: ctx.isInCliff
          ? 'Cliff severo de pneus, perda total de tração'
          : `Desgaste elevado (${ctx.tireWear}%)`,
      }
    }

    // 2. Solicitação de TROCA DE POSIÇÃO (Request Position Swap)
    // Piloto atrás do companheiro com ritmo visivelmente superior
    if (
      ctx.teammateId &&
      !ctx.isTeammateAhead &&
      ctx.gapToTeammateSec !== undefined &&
      ctx.gapToTeammateSec < 1.2 &&
      ctx.teammateTireWear &&
      ctx.tireWear < ctx.teammateTireWear - 15 &&
      traits.ambition >= 65
    ) {
      return {
        requestId: `req_swap_${ctx.driverId}_${ctx.currentLap}`,
        requestType: 'REQUEST_POSITION_SWAP',
        driverId: ctx.driverId,
        driverName: ctx.driverName,
        lap: ctx.currentLap,
        round: ctx.round,
        season: ctx.season,
        telemetryContext: {
          tireWear: ctx.tireWear,
          isInCliff: false,
          tyreCompound: ctx.tireCompound,
          gapFrontSec: ctx.gapToTeammateSec,
          position: ctx.position,
        },
        urgency: 'medium',
        accuracy: 90,
        perceivedIssue: 'Preso atrás do companheiro com delta de pneu superior',
      }
    }

    // 3. Alerta de DANO / ASA
    if (ctx.hasDamage) {
      return {
        requestId: `req_dmg_${ctx.driverId}_${ctx.currentLap}`,
        requestType: 'REPORT_DAMAGE',
        driverId: ctx.driverId,
        driverName: ctx.driverName,
        lap: ctx.currentLap,
        round: ctx.round,
        season: ctx.season,
        telemetryContext: {
          tireWear: ctx.tireWear,
          isInCliff: false,
          tyreCompound: ctx.tireCompound,
          hasWingDamage: true,
          position: ctx.position,
        },
        urgency: 'high',
        accuracy: clamp(techFeedback + 10),
        perceivedIssue: 'Instabilidade por contato e dano aerodinâmico',
      }
    }

    return null
  }

  /**
   * Resposta da Equipe ao Pedido do Piloto
   * REGRA DE OURO 5: Consequência depende do que aconteceu DEPOIS.
   */
  public respondToDriverRequest(
    req: DriverRequestPayload,
    response: 'ACCEPT_REQUEST' | 'DENY_REQUEST' | 'REQUEST_MORE_LAPS',
    ctx: RaceInteractionContext,
    driver: Partial<DriverModel> & { name?: string },
    team?: Partial<TeamModel> | null,
  ): {
    radioResponseText: string
    immediateEffects: Partial<DriverEmotionalState>
  } {
    const bundle = driverRelationshipService.getOrCreatePsychologyBundle(driver)
    const traits = bundle.traits

    if (response === 'ACCEPT_REQUEST') {
      // Pedido atendido prontamente
      bundle.emotionalState.satisfaction = clamp(bundle.emotionalState.satisfaction + 4)
      bundle.relationships.teamPrincipal.trust = clamp(bundle.relationships.teamPrincipal.trust + 3)
      bundle.relationships.team.technicalTrust = clamp(bundle.relationships.team.technicalTrust + 3)

      return {
        radioResponseText: `Box confirmado, ${ctx.driverName.split(' ')[0]}. Prepare-se para entrar nesta volta!`,
        immediateEffects: {
          satisfaction: 4,
          frustration: -3,
        },
      }
    }

    if (response === 'DENY_REQUEST' || response === 'REQUEST_MORE_LAPS') {
      // Registra pedido negado para posterior checagem do desfecho (Regra de Ouro 5)
      if (req.requestType === 'REQUEST_PIT') {
        this.pendingDeniedPitRequests.set(ctx.driverId, {
          lapDenied: ctx.currentLap,
          tireWearAtDenial: req.telemetryContext.tireWear,
          driverName: ctx.driverName,
        })
      }

      // Pequena frustração inicial proporcional ao Ego
      const frustrationBump = Math.round(3 + (traits.ego / 100) * 4)
      bundle.emotionalState.frustration = clamp(bundle.emotionalState.frustration + frustrationBump)

      return {
        radioResponseText: `Negativo, ${ctx.driverName.split(' ')[0]}. Fique na pista e estenda o stint. Confiamos na telemetria.`,
        immediateEffects: {
          frustration: frustrationBump,
        },
      }
    }

    return {
      radioResponseText: 'Copiado.',
      immediateEffects: {},
    }
  }

  /**
   * Avalia desfechos de pedidos no fim da corrida (Regra de Ouro 5)
   * Se o pedido de pit foi negado mas a estratégia foi vitoriosa/certa -> technicalTrust SUBIR!
   * Se negado e o pneu colapsou -> penalidade severa e memória negativa.
   */
  public evaluatePostRaceRequestOutcomes(
    driverId: string,
    finalPosition: number,
    finalTireWear: number,
    isInCliffAtEnd: boolean,
    driver: Partial<DriverModel> & { name?: string },
    round: number,
    season: number,
  ): void {
    const denied = this.pendingDeniedPitRequests.get(driverId)
    if (!denied) return

    const bundle = driverRelationshipService.getOrCreatePsychologyBundle(driver)

    if (isInCliffAtEnd || finalTireWear >= 85 || finalPosition > 10) {
      // Equipe errou feio ao negar o pit! Piloto tinha razão.
      driverRelationshipService.processDomainEvent({
        driver,
        eventType: 'strategy_blunder_team' as any,
        season,
        round,
        sourceEventId: `strat_blunder_${driverId}_r${round}`,
        description: `Pit stop pedido pelo piloto na volta ${denied.lapDenied} foi negado pela equipe e os pneus colapsaram.`,
      })
    } else if (finalPosition <= 8) {
      // Equipe acertou em segurar na pista! Confiança técnica sobe.
      bundle.relationships.team.technicalTrust = clamp(bundle.relationships.team.technicalTrust + 5)
      bundle.relationships.team.sportingTrust = clamp(bundle.relationships.team.sportingTrust + 5)
      bundle.emotionalState.confidence = clamp(bundle.emotionalState.confidence + 4)
    }

    this.pendingDeniedPitRequests.delete(driverId)
  }

  /**
   * Avalia incidente entre companheiros de equipe
   */
  public evaluateTeammateIncident(
    driverA: Partial<DriverModel> & { name?: string },
    driverB: Partial<DriverModel> & { name?: string },
    faultDriverId: string | 'disputed',
    lap: number,
    round: number,
    season: number,
    circuitId: string,
  ): void {
    const eventId = `tm_crash_${driverA.id}_${driverB.id}_r${round}_l${lap}`

    if (faultDriverId === 'disputed') {
      // Tensão sobe igualmente para ambos sem culpa confirmada
      driverRelationshipService.processDomainEvent({
        driver: driverA,
        teammate: driverB,
        eventType: 'teammate_incident_collision',
        season,
        round,
        circuitId,
        sourceEventId: `${eventId}_a`,
        description: `Toque controverso com o companheiro ${driverB.name} na volta ${lap}.`,
      })

      driverRelationshipService.processDomainEvent({
        driver: driverB,
        teammate: driverA,
        eventType: 'teammate_incident_collision',
        season,
        round,
        circuitId,
        sourceEventId: `${eventId}_b`,
        description: `Toque controverso com o companheiro ${driverA.name} na volta ${lap}.`,
      })
    } else {
      // Vítima sente forte quebra de respeito; causador sente culpa ou tensão
      const victim = faultDriverId === driverA.id ? driverB : driverA
      const culprit = faultDriverId === driverA.id ? driverA : driverB

      driverRelationshipService.processDomainEvent({
        driver: victim,
        teammate: culprit,
        eventType: 'teammate_incident_collision',
        season,
        round,
        circuitId,
        sourceEventId: `${eventId}_victim`,
        description: `Atingido pelo companheiro ${culprit.name} na volta ${lap}.`,
      })
    }
  }

  /**
   * Explicação para QA e Telemetria (explainRaceInteraction)
   */
  public explainRaceInteraction(interactionId: string): RaceInteractionTelemetryReport | null {
    const result = this.interactionHistory.get(interactionId)
    if (!result) return null

    const bundle = driverRelationshipService.getOrCreatePsychologyBundle({ id: result.driverId })

    return {
      interactionId,
      driverId: result.driverId,
      driverName: bundle.driverId,
      orderOrRequest: interactionId,
      contextSummary: `Score final ${result.scoreBreakdown.finalScore} resultou em ${result.reactionType}. Latência: ${result.executionLatencySectors} setores.`,
      traits: bundle.traits,
      emotionalStateBefore: bundle.emotionalState,
      relationshipsBefore: bundle.relationships,
      scoreBreakdown: result.scoreBreakdown,
      chosenReaction: result.reactionType,
      actionApplied: result.actionApplied,
      latencySectors: result.executionLatencySectors,
      radioMessageText: result.radioMessageText,
      effectsSummary: `Deltas de Estado: ${JSON.stringify(result.stateDeltas)} / TP: ${JSON.stringify(result.tpRelationshipDeltas)}`,
      memoryGenerated: result.shouldGenerateMemory
        ? bundle.memories.find((m) => m.sourceEventId === interactionId)
        : null,
    }
  }

  /**
   * Retorna os logs de rádio gravados durante a corrida
   */
  public getSessionRadioLogs(): SessionRadioLogEntry[] {
    return [...this.sessionRadioLogs]
  }

  // ============================================================================
  // MÉTODOS PRIVADOS AUXILIARES
  // ============================================================================

  private buildSpamResistResult(
    interactionId: string,
    ctx: RaceInteractionContext,
    traits: DriverPersonalityTraits,
    emotional: DriverEmotionalState,
  ): InteractionEvaluationResult {
    return {
      interactionId,
      driverId: ctx.driverId,
      reactionType: 'RESIST',
      actionApplied: false,
      executionLatencySectors: 2,
      radioMessageText: `Negativo, pit wall! Vocês já me pediram isso há duas voltas, deixem eu guiar!`,
      radioTone: 'resistant',
      followUpAllowed: false,
      stateDeltas: { frustration: 6, emotionalTension: 5 },
      tpRelationshipDeltas: { trust: -2 },
      teamRelationshipDeltas: {},
      shouldGenerateMemory: false,
      scoreBreakdown: {
        baseObedienceScore: 40,
        orderSeverity: 30,
        justificationBonus: 0,
        traitsScore: 0,
        relationshipScore: 0,
        historyScore: 0,
        championshipBonus: 0,
        managerBonus: 0,
        finalScore: 20,
        decisionThresholds: {
          refuseThreshold: 15,
          resistThreshold: 35,
          questionThreshold: 55,
          acceptReluctantThreshold: 75,
        },
      },
    }
  }

  private calculateOrderConsequences(
    order: TeamOrderPayload,
    reactionType: RaceReactionType,
    traits: DriverPersonalityTraits,
    managerPeopleMgmt: number,
  ) {
    const stateDeltas: Partial<DriverEmotionalState> = {}
    const tpRelationshipDeltas: Record<string, number> = {}
    const teamRelationshipDeltas: Record<string, number> = {}
    const teammateRelationshipDeltas: Record<string, number> = {}

    // People management amortece impacto negativo
    const managerDampening = Math.max(0, (managerPeopleMgmt - 75) * 0.05)

    if (order.orderType === 'LET_TEAMMATE_PASS') {
      if (reactionType === 'ACCEPT_RELUCTANTLY') {
        const frust = Math.max(1, Math.round(6 + (traits.ego / 100) * 5 - managerDampening))
        stateDeltas.frustration = frust
        stateDeltas.satisfaction = -Math.round(frust * 0.8)
        tpRelationshipDeltas.trust = -Math.round(frust * 0.6)
        teammateRelationshipDeltas.rivalry = 5
        teammateRelationshipDeltas.tension = 6
      } else if (reactionType === 'REFUSE') {
        stateDeltas.frustration = 10
        stateDeltas.emotionalTension = 12
        tpRelationshipDeltas.trust = -10
        tpRelationshipDeltas.respect = -5
        teammateRelationshipDeltas.tension = 15
        teammateRelationshipDeltas.cooperation = -10
      } else if (reactionType === 'ACCEPT') {
        stateDeltas.satisfaction = 1
        teammateRelationshipDeltas.cooperation = 4
      }
    } else if (order.orderType === 'HOLD_POSITION' && reactionType === 'ACCEPT_RELUCTANTLY') {
      stateDeltas.frustration = 4
      tpRelationshipDeltas.trust = -2
    }

    return {
      stateDeltas,
      tpRelationshipDeltas,
      teamRelationshipDeltas,
      teammateRelationshipDeltas,
    }
  }

  private resolveOrderMemoryPayload(
    order: TeamOrderPayload,
    ctx: RaceInteractionContext,
    reactionType: RaceReactionType,
    stateDeltas: Partial<DriverEmotionalState>,
    tpDeltas: Record<string, number>,
    teamDeltas: Record<string, number>,
    tmDeltas: Record<string, number>,
  ) {
    // Apenas ordens marcantes geram memórias permanentes
    if (order.orderType === 'LET_TEAMMATE_PASS') {
      if (reactionType === 'ACCEPT_RELUCTANTLY') {
        return {
          eventType: 'teammate_favoritism_felt',
          polarity: 'negative' as const,
          intensity: ctx.position <= 3 ? 8 : 6,
          description: `Ordem de ceder posição para ${ctx.teammateName || 'o companheiro'} cumprida a contragosto.`,
          contextExplanation: `Piloto abriu mão da disputa por determinação do pit wall na volta ${ctx.currentLap}.`,
          persistenceClass: ctx.position <= 3 ? ('Major' as const) : ('Relevant' as const),
        }
      }

      if (reactionType === 'REFUSE') {
        return {
          eventType: 'teammate_favoritism_felt',
          polarity: 'negative' as const,
          intensity: 9,
          description: `Piloto recusou terminantemente ordem de equipe para deixar ${ctx.teammateName || 'o companheiro'} passar.`,
          contextExplanation: `Conflito direto com o pit wall na volta ${ctx.currentLap}.`,
          persistenceClass: 'Career-defining' as const,
        }
      }
    }

    return null
  }
}

export const driverRaceInteractionService = new DriverRaceInteractionService()
