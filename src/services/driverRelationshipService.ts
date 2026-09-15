import {
  DriverPersonalityTraits,
  DriverEmotionalState,
  DriverRelationships,
  DriverMemoryEvent,
  DriverPromise,
  MemoryEventType,
  MemoryPersistenceClass,
  MemoryPolarity,
  DriverReactionAuditLog,
  DriverPsychologyAuditReport,
  DriverPreRaceContext,
  DriverDecisionContext,
} from '@/types/driver-psychology'
import {
  getDriverPersonalityTraits,
  createDefaultEmotionalState,
  createDefaultRelationships,
  deriveTeammateStatus,
  formatQualitativeState,
  clamp,
  DriverPsychologyDataBundle,
} from '@/lib/driver-psychology-utils'
import { managerEffectService } from '@/services/managerEffectService'
import { DriverModel, TeamModel } from '@/types/f1'

/**
 * DriverRelationshipService (Serviço Canônico Nº 6A)
 *
 * Implementa o ciclo:
 * PERSONALIDADE → EVENTO → INTERPRETAÇÃO → MEMÓRIA → RELAÇÃO → ESTADO EMOCIONAL → EXPECTATIVA → COMPORTAMENTO FUTURO.
 *
 * Anti-stacking, consolidação de memórias recorrentes, modulação por histórico e traços,
 * limites seguros (0-100), decay psicológico, explicabilidade total e regressão à baseline.
 */
export class DriverRelationshipService {
  // Cache em memória indexado por driverId
  private psychologyCache: Map<string, DriverPsychologyDataBundle> = new Map()

  /**
   * Obtém ou inicializa o pacote completo de psicologia para um piloto
   */
  public getOrCreatePsychologyBundle(
    driver: Partial<DriverModel> & { name?: string; procedural_data?: any },
    teamDrivers?: DriverModel[],
  ): DriverPsychologyDataBundle {
    const driverId = driver.id || 'unknown'
    if (this.psychologyCache.has(driverId)) {
      return this.psychologyCache.get(driverId)!
    }

    const traits = getDriverPersonalityTraits(driver)
    const emotionalState = createDefaultEmotionalState(traits, driver.morale)

    // Encontra companheiro de equipe se disponível
    let teammateObj: { id: string; name: string } | null = null
    if (driver.team_id && teamDrivers) {
      const tm = teamDrivers.find(
        (d) => d.id !== driver.id && d.team_id === driver.team_id && d.role === 'titular',
      )
      if (tm) {
        teammateObj = { id: tm.id, name: tm.name }
      }
    }

    const relationships = createDefaultRelationships(traits, teammateObj)

    const bundle: DriverPsychologyDataBundle = {
      driverId,
      traits,
      emotionalState,
      relationships,
      memories: [],
      promises: [],
    }

    this.psychologyCache.set(driverId, bundle)
    return bundle
  }

  /**
   * Registra um pacote vindo do banco/save sem perder consistência
   */
  public registerHydratedBundle(bundle: DriverPsychologyDataBundle): void {
    if (bundle && bundle.driverId) {
      this.psychologyCache.set(bundle.driverId, bundle)
    }
  }

  /**
   * Avalia um evento de domínio e processa a interpretação psicológica completa
   * (Idempotência garantida via sourceEventId)
   */
  public processDomainEvent(params: {
    driver: Partial<DriverModel> & { name?: string; procedural_data?: any }
    eventType: MemoryEventType
    season: number
    round: number
    circuitId?: string
    team?: Partial<TeamModel> | null
    teammate?: Partial<DriverModel> | null
    sourceEventId: string
    description: string
    eventContext?: {
      upgradeName?: string
      targetCarAssignment?: 'car1' | 'car2' | 'stock' | 'both_split'
      actualPosition?: number
      expectedPosition?: number
      isDnf?: boolean
      isMechanicalFailure?: boolean
      teammatePosition?: number
      teammateReceivedFirst?: boolean
      youngsterDriverName?: string
      youngsterLicense?: string
    }
  }): {
    memoryCreated: DriverMemoryEvent | null
    auditLog: DriverReactionAuditLog
  } {
    const bundle = this.getOrCreatePsychologyBundle(params.driver)
    const driverId = bundle.driverId

    // 1. Verificação de IDEMPOTÊNCIA rigorosa
    const existingMemory = bundle.memories.find((m) => m.sourceEventId === params.sourceEventId)
    if (existingMemory) {
      // Já foi processado — retorna log idempotente sem aplicar deltas novamente
      return {
        memoryCreated: existingMemory,
        auditLog: {
          driverId,
          driverName: params.driver.name || driverId,
          eventType: params.eventType,
          baseImpact: 0,
          traitModulations: [],
          historicalModulation: {
            factor: 'Idempotency',
            delta: 0,
            explanation: 'Evento já registrado',
          },
          managerModulation: { managerEffect: 'None', delta: 0, explanation: 'Idempotente' },
          finalRelationshipDeltas: {},
          finalStateDeltas: {},
          resultingSalience: existingMemory.salience,
          resultingPersistence: existingMemory.persistenceClass,
          telemetrySummary: `[IDEMPOTENT] Evento ${params.sourceEventId} já processado anteriormente.`,
        },
      }
    }

    // 2. Interpretação modulada por Personalidade e Contexto
    const traits = bundle.traits
    const ctx = params.eventContext || {}
    const traitModulations: DriverReactionAuditLog['traitModulations'] = []

    let baseImpact = 0 // Negativo = ruim; Positivo = bom
    let polarity: MemoryPolarity = 'neutral'
    let persistence: MemoryPersistenceClass = 'Relevant'
    let rawIntensity = 5

    // Deltas de Relação e Estado
    const stateDelta: Partial<DriverEmotionalState> = {}
    const tpDelta: Record<string, number> = {}
    const teamDelta: Record<string, number> = {}
    const tmDelta: Record<string, number> = {}

    // Contagem histórica de eventos similares para consolidação anti-stacking
    const similarMemories = bundle.memories.filter((m) => m.eventType === params.eventType)
    const similarCount = similarMemories.length

    // Modulação por Manager (ManagerEffectService)
    const managerEval = managerEffectService.evaluateManager(params.team)
    const peopleScore = managerEval.domainScores.peopleManagement
    // peopleManagement 85 = +0.04 (ameniza danos negativos e potencializa recuperação)
    const managerDampening = (peopleScore - 75) * 0.015

    switch (params.eventType) {
      case 'upgrade_received_priority': {
        polarity = 'positive'
        baseImpact = 6
        rawIntensity = 6
        persistence = 'Relevant'

        // Ego alto adora status; ambição alta vibra
        const egoBonus = ((traits.ego - 50) / 50) * 2.5
        const ambBonus = ((traits.ambition - 50) / 50) * 1.5
        traitModulations.push({
          trait: 'ego',
          value: traits.ego,
          delta: egoBonus,
          explanation: `Ego ${traits.ego} potencializa satisfação de ser prioridade técnica`,
        })

        const totalBoost = baseImpact + egoBonus + ambBonus
        stateDelta.satisfaction = Math.round(totalBoost)
        stateDelta.confidence = Math.round(totalBoost * 0.8)
        stateDelta.frustration = -Math.round(totalBoost * 0.7)
        tpDelta.trust = Math.round(totalBoost * 0.6)
        teamDelta.technicalTrust = Math.round(totalBoost * 0.8)
        teamDelta.satisfaction = Math.round(totalBoost * 0.7)
        break
      }

      case 'upgrade_denied_priority': {
        polarity = 'negative'
        baseImpact = -6
        rawIntensity = 6
        persistence = similarCount >= 2 ? 'Major' : 'Relevant'

        // Modulações por traits
        const egoPenalty = ((traits.ego - 50) / 50) * 3.5 // Ego alto sente forte golpe
        const ambPenalty = ((traits.ambition - 50) / 50) * 2.0 // Ambição alta odeia ser preterida
        const coopRelief = ((traits.cooperation - 50) / 50) * 2.2 // Cooperativo tolera melhor divisão
        const loyaltyRelief = ((traits.loyalty - 50) / 50) * 1.5 // Leal dá voto de confiança

        traitModulations.push(
          {
            trait: 'ego',
            value: traits.ego,
            delta: -egoPenalty,
            explanation: `Ego ${traits.ego} amplifica sensação de desrespeito`,
          },
          {
            trait: 'ambition',
            value: traits.ambition,
            delta: -ambPenalty,
            explanation: `Ambição ${traits.ambition} gera aversão a equipamento inferior`,
          },
          {
            trait: 'cooperation',
            value: traits.cooperation,
            delta: coopRelief,
            explanation: `Cooperação ${traits.cooperation} amortece a frustração`,
          },
        )

        // Verificação de PROMESSA de igualdade de equipamento
        const equalPromise = bundle.promises.find(
          (p) => p.type === 'equalEquipment' && (p.status === 'active' || p.status === 'accepted'),
        )
        let promisePenalty = 0
        if (equalPromise) {
          // Se já é o 2º ou 3º upgrade preterido, promessa é quebrada!
          if (similarCount >= 2) {
            equalPromise.status = 'broken'
            equalPromise.evaluationHistory.push({
              round: params.round,
              note: 'Companheiro recebeu múltiplas peças novas prioritárias.',
              complianceScore: 10,
            })
            promisePenalty = 5
            persistence = 'Major'
          } else {
            equalPromise.evaluationHistory.push({
              round: params.round,
              note: 'Companheiro recebeu peça única primeiro (em observação).',
              complianceScore: 60,
            })
            promisePenalty = 2
          }
        }

        // Histórico acumulado (consolidação anti-stacking: efeito diminui linearmente mas acumula gravidade)
        const historySeverity = Math.min(6, similarCount * 1.8)

        // Efeito Manager (atenua dano se excelente líder)
        const managerMitigation = Math.max(-3, Math.min(3, managerDampening * 3.5))

        let totalDmg =
          baseImpact -
          egoPenalty -
          ambPenalty +
          coopRelief +
          loyaltyRelief -
          promisePenalty -
          historySeverity +
          managerMitigation

        totalDmg = Math.min(-1, totalDmg) // Garante que é negativo

        stateDelta.frustration = Math.round(Math.abs(totalDmg) * 1.1)
        stateDelta.satisfaction = Math.round(totalDmg * 1.0)
        stateDelta.emotionalTension = Math.round(Math.abs(totalDmg) * 0.8)
        tpDelta.trust = Math.round(totalDmg * 0.9)
        teamDelta.technicalTrust = Math.round(totalDmg * 0.8)
        teamDelta.belonging = Math.round(totalDmg * 0.6)
        tmDelta.tension = Math.round(Math.abs(totalDmg) * 0.7)
        tmDelta.rivalry = Math.round(Math.abs(totalDmg) * 0.5)
        break
      }

      case 'upgrade_equal': {
        polarity = 'positive'
        baseImpact = 3
        rawIntensity = 3
        persistence = 'Minor'
        stateDelta.satisfaction = 3
        tpDelta.trust = 2
        teamDelta.technicalTrust = 3
        break
      }

      case 'race_win': {
        polarity = 'positive'
        baseImpact = 10
        rawIntensity = 9
        persistence = 'Major'
        stateDelta.confidence = 12
        stateDelta.motivation = 10
        stateDelta.satisfaction = 12
        stateDelta.frustration = -15
        stateDelta.pressure = -8
        tpDelta.respect = 8
        tpDelta.confidence = 10
        teamDelta.sportingTrust = 10
        teamDelta.desireToStay = 8
        break
      }

      case 'race_podium': {
        polarity = 'positive'
        baseImpact = 7
        rawIntensity = 7
        persistence = 'Relevant'
        stateDelta.confidence = 8
        stateDelta.satisfaction = 8
        stateDelta.frustration = -10
        tpDelta.trust = 5
        teamDelta.sportingTrust = 6
        break
      }

      case 'race_expected_met': {
        polarity = 'neutral'
        baseImpact = 2
        rawIntensity = 3
        persistence = 'Minor'
        stateDelta.satisfaction = 2
        stateDelta.confidence = 2
        break
      }

      case 'race_underperformance': {
        polarity = 'negative'
        baseImpact = -4
        rawIntensity = 5
        persistence = 'Relevant'

        // Tolerância à pressão modula a gravidade
        const pTolMod = ((traits.pressureTolerance - 50) / 50) * 2.5
        stateDelta.confidence = -Math.round(5 - pTolMod)
        stateDelta.frustration = Math.round(5 - pTolMod)
        stateDelta.pressure = Math.round(6 - pTolMod)
        break
      }

      case 'race_dnf_mechanical': {
        polarity = 'negative'
        baseImpact = -7
        rawIntensity = 7
        persistence = 'Relevant'
        stateDelta.frustration = 9
        stateDelta.satisfaction = -8
        teamDelta.technicalTrust = -8
        tpDelta.confidence = -5
        break
      }

      case 'contract_threat_academy': {
        // Jovem da academia testando ou subindo de nível
        polarity = 'negative'
        baseImpact = -3
        rawIntensity = 5
        persistence = 'Relevant'

        const contractEnd = params.driver.contract_end || 2026
        const currentYear = params.season || 2026
        const isExpiringSoon = contractEnd <= currentYear
        const currentSeatSecurity = params.driver.seat_security ?? 80

        // Se contrato for longo E seatSecurity alta, o titular quase não liga!
        if (!isExpiringSoon && currentSeatSecurity >= 75) {
          baseImpact = -1
          rawIntensity = 2
          persistence = 'Minor'
        } else if (isExpiringSoon && currentSeatSecurity < 50) {
          baseImpact = -8
          rawIntensity = 8
          persistence = 'Major'
        }

        // PressureTolerance protege contra pânico
        const tolProtection = ((traits.pressureTolerance - 50) / 50) * 3.0
        const effectivePressure = Math.max(
          1,
          Math.round(Math.abs(baseImpact) * 1.2 - tolProtection),
        )

        stateDelta.pressure = effectivePressure
        stateDelta.frustration = Math.round(effectivePressure * 0.7)
        tpDelta.trust = -Math.round(effectivePressure * 0.5)
        teamDelta.desireToStay = -Math.round(effectivePressure * 0.4)
        break
      }

      case 'promise_fulfilled': {
        polarity = 'positive'
        baseImpact = 8
        rawIntensity = 8
        persistence = 'Major'
        stateDelta.satisfaction = 10
        stateDelta.confidence = 8
        tpDelta.trust = 12
        tpDelta.personalLoyalty = 10
        teamDelta.desireToStay = 10
        break
      }

      case 'promise_broken': {
        polarity = 'negative'
        baseImpact = -10
        rawIntensity = 9
        persistence = 'Major'
        const loyaltyBuffer = ((traits.loyalty - 50) / 50) * 2.0
        const egoRage = ((traits.ego - 50) / 50) * 3.5

        const netBroken = Math.min(-5, baseImpact + loyaltyBuffer - egoRage)
        stateDelta.frustration = Math.round(Math.abs(netBroken) * 1.2)
        stateDelta.satisfaction = Math.round(netBroken)
        tpDelta.trust = Math.round(netBroken * 1.3)
        tpDelta.personalLoyalty = Math.round(netBroken * 1.1)
        teamDelta.desireToStay = Math.round(netBroken)
        break
      }

      case 'teammate_incident_collision': {
        polarity = 'negative'
        baseImpact = -6
        rawIntensity = 7
        persistence = 'Relevant'
        stateDelta.frustration = 8
        stateDelta.emotionalTension = 10
        tpDelta.confidence = -4
        tmDelta.tension = 12
        tmDelta.rivalry = 8
        tmDelta.respect = -6
        tmDelta.cooperation = -8
        break
      }

      case 'teammate_favoritism_felt': {
        polarity = 'negative'
        baseImpact = -7
        rawIntensity = 7
        persistence = 'Relevant'
        const egoFactor = ((traits.ego - 50) / 50) * 2.5
        stateDelta.frustration = Math.round(7 + egoFactor)
        stateDelta.satisfaction = -Math.round(6 + egoFactor)
        stateDelta.emotionalTension = 6
        tpDelta.trust = -Math.round(8 + egoFactor)
        teamDelta.belonging = -5
        tmDelta.tension = 8
        tmDelta.rivalry = 6
        break
      }

      case 'strategy_blunder_team': {
        polarity = 'negative'
        baseImpact = -8
        rawIntensity = 8
        persistence = 'Major'
        stateDelta.frustration = 10
        stateDelta.confidence = -5
        teamDelta.technicalTrust = -10
        teamDelta.sportingTrust = -12
        tpDelta.trust = -8
        break
      }

      case 'strategy_masterclass_team': {
        polarity = 'positive'
        baseImpact = 7
        rawIntensity = 7
        persistence = 'Relevant'
        stateDelta.satisfaction = 8
        stateDelta.confidence = 7
        teamDelta.sportingTrust = 10
        teamDelta.technicalTrust = 6
        tpDelta.respect = 8
        break
      }

      default: {
        polarity = 'neutral'
        baseImpact = 1
        rawIntensity = 3
        persistence = 'Minor'
        break
      }
    }

    // 3. Taxa de Decay psicológico inicial (modulado por Resiliência e Ego)
    // Alta resiliência decai memórias ruins mais depressa; Ego alto mantém memórias ruins por mais tempo
    let decayRate = 20 // 20% por rodada como padrão
    if (polarity === 'negative') {
      const resBonus = ((traits.resilience - 50) / 50) * 12 // recupera mais rápido
      const egoStickiness = ((traits.ego - 50) / 50) * 10 // guarda rancor
      decayRate = clamp(Math.round(decayRate + resBonus - egoStickiness), 8, 45)
    } else {
      decayRate = 25
    }

    const salience = clamp(rawIntensity * 10)

    // 4. Criação do Objeto de Memória
    const memoryEvent: DriverMemoryEvent = {
      memoryId: `mem_${driverId}_${params.season}_r${params.round}_${Date.now()}`,
      driverId,
      eventType: params.eventType,
      season: params.season,
      round: params.round,
      circuitId: params.circuitId,
      date: new Date().toISOString(),
      involvedEntityIds: [driverId, params.team?.id || '', params.teammate?.id || ''].filter(
        Boolean,
      ),
      polarity,
      intensity: rawIntensity,
      salience,
      decayRate,
      persistenceClass: persistence,
      tags: [params.eventType, polarity, persistence],
      relationshipEffects: {
        tpDelta,
        teamDelta,
        teammateDelta: tmDelta,
      },
      stateEffects: stateDelta,
      sourceEventId: params.sourceEventId,
      description: params.description,
      contextExplanation: `Impacto base ${baseImpact >= 0 ? '+' : ''}${baseImpact}. Modulado por Personalidade (Ego ${traits.ego}, Ambição ${traits.ambition}, Lealdade ${traits.loyalty}).`,
      isArchivedHistorical: false,
    }

    // Adiciona ao bundle
    bundle.memories.unshift(memoryEvent)

    // 5. Aplicação direta e auditável no estado e relações (Clamped 0-100)
    this.applyDeltasToBundle(bundle, stateDelta, tpDelta, teamDelta, tmDelta)

    // 6. Auditoria de explicabilidade
    const auditLog: DriverReactionAuditLog = {
      driverId,
      driverName: params.driver.name || driverId,
      eventType: params.eventType,
      baseImpact,
      traitModulations,
      historicalModulation: {
        factor: 'Similar memories',
        delta: -Math.min(6, similarCount * 1.8),
        explanation: `${similarCount} memórias prévias similares detectadas.`,
      },
      managerModulation: {
        managerEffect: `${managerEval.archetypeTitle} (People: ${peopleScore})`,
        delta: Number(((peopleScore - 75) * 0.05).toFixed(1)),
        explanation: `Amortecimento relacional aplicado: ${managerEval.archetypeTitle}.`,
      },
      finalRelationshipDeltas: { ...tpDelta, ...teamDelta },
      finalStateDeltas: stateDelta as Record<string, number>,
      resultingSalience: salience,
      resultingPersistence: persistence,
      telemetrySummary: this.formatReactionExplanation(
        params.driver.name || driverId,
        params.eventType,
        baseImpact,
        traitModulations,
        memoryEvent,
      ),
    }

    return {
      memoryCreated: memoryEvent,
      auditLog,
    }
  }

  /**
   * Aplica deltas aos objetos do bundle garantindo limites estritos de 0 a 100
   */
  private applyDeltasToBundle(
    bundle: DriverPsychologyDataBundle,
    stateDelta: Partial<DriverEmotionalState>,
    tpDelta: Record<string, number>,
    teamDelta: Record<string, number>,
    tmDelta: Record<string, number>,
  ): void {
    const es = bundle.emotionalState
    if (stateDelta.confidence !== undefined)
      es.confidence = clamp(es.confidence + stateDelta.confidence)
    if (stateDelta.motivation !== undefined)
      es.motivation = clamp(es.motivation + stateDelta.motivation)
    if (stateDelta.satisfaction !== undefined)
      es.satisfaction = clamp(es.satisfaction + stateDelta.satisfaction)
    if (stateDelta.frustration !== undefined)
      es.frustration = clamp(es.frustration + stateDelta.frustration)
    if (stateDelta.pressure !== undefined) es.pressure = clamp(es.pressure + stateDelta.pressure)
    if (stateDelta.teamTrust !== undefined)
      es.teamTrust = clamp(es.teamTrust + stateDelta.teamTrust)
    if (stateDelta.emotionalTension !== undefined)
      es.emotionalTension = clamp(es.emotionalTension + stateDelta.emotionalTension)

    const tp = bundle.relationships.teamPrincipal
    if (tpDelta.trust !== undefined) tp.trust = clamp(tp.trust + tpDelta.trust)
    if (tpDelta.respect !== undefined) tp.respect = clamp(tp.respect + tpDelta.respect)
    if (tpDelta.confidence !== undefined) tp.confidence = clamp(tp.confidence + tpDelta.confidence)
    if (tpDelta.personalLoyalty !== undefined)
      tp.personalLoyalty = clamp(tp.personalLoyalty + tpDelta.personalLoyalty)

    const tm = bundle.relationships.team
    if (teamDelta.belonging !== undefined) tm.belonging = clamp(tm.belonging + teamDelta.belonging)
    if (teamDelta.sportingTrust !== undefined)
      tm.sportingTrust = clamp(tm.sportingTrust + teamDelta.sportingTrust)
    if (teamDelta.technicalTrust !== undefined)
      tm.technicalTrust = clamp(tm.technicalTrust + teamDelta.technicalTrust)
    if (teamDelta.satisfaction !== undefined)
      tm.satisfaction = clamp(tm.satisfaction + teamDelta.satisfaction)
    if (teamDelta.desireToStay !== undefined)
      tm.desireToStay = clamp(tm.desireToStay + teamDelta.desireToStay)

    if (bundle.relationships.teammate && tmDelta) {
      const mate = bundle.relationships.teammate
      if (tmDelta.respect !== undefined) mate.respect = clamp(mate.respect + tmDelta.respect)
      if (tmDelta.cooperation !== undefined)
        mate.cooperation = clamp(mate.cooperation + tmDelta.cooperation)
      if (tmDelta.rivalry !== undefined) mate.rivalry = clamp(mate.rivalry + tmDelta.rivalry)
      if (tmDelta.tension !== undefined) mate.tension = clamp(mate.tension + tmDelta.tension)
      mate.status = deriveTeammateStatus(mate.respect, mate.cooperation, mate.rivalry, mate.tension)
    }
  }

  /**
   * Processa o DECAY das memórias ativas e a REGRESSÃO à baseline psicológica ao avançar uma rodada
   */
  public processRoundDecayAndBaselineRegression(driverId: string): void {
    const bundle = this.psychologyCache.get(driverId)
    if (!bundle) return

    const traits = bundle.traits

    // 1. Decaimento das memórias (saliência ativa)
    for (const mem of bundle.memories) {
      if (!mem.isArchivedHistorical && mem.salience > 0) {
        mem.salience = Math.max(0, mem.salience - mem.decayRate)
        if (mem.salience === 0) {
          mem.isArchivedHistorical = true // mantido no histórico, sem peso ativo
        }
      }
    }

    // 2. Regressão à baseline individual (modulado por resiliência)
    const recRate = clamp(Math.round(traits.resilience * 0.12), 4, 15)
    const es = bundle.emotionalState

    // Retorno suave da frustração para ~15
    if (es.frustration > 15) {
      es.frustration = Math.max(15, es.frustration - recRate)
    }
    // Retorno suave da tensão emocional para ~15
    if (es.emotionalTension > 15) {
      es.emotionalTension = Math.max(15, es.emotionalTension - recRate)
    }
    // Retorno suave da pressão para ~25
    if (es.pressure > 25) {
      es.pressure = Math.max(25, es.pressure - Math.round(recRate * 0.8))
    }
    // Recuperação suave de satisfação se muito baixa
    if (es.satisfaction < 70) {
      es.satisfaction = Math.min(70, es.satisfaction + Math.round(recRate * 0.6))
    }
  }

  /**
   * Criação de uma promessa formal com o piloto
   */
  public createPromise(
    driverId: string,
    type: DriverPromise['type'],
    season: number,
    round: number,
    description: string,
    targetRound?: number,
  ): DriverPromise {
    const bundle = this.psychologyCache.get(driverId)
    const promise: DriverPromise = {
      id: `prm_${driverId}_${type}_${Date.now()}`,
      driverId,
      type,
      status: 'active',
      createdRound: round,
      createdSeason: season,
      targetRound,
      description,
      evaluationHistory: [],
    }

    if (bundle) {
      bundle.promises.push(promise)
    }
    return promise
  }

  /**
   * Deriva a percepção subjetiva de equidade de tratamento do piloto (0-100)
   */
  public calculatePerceivedFairness(driverId: string): number {
    const bundle = this.psychologyCache.get(driverId)
    if (!bundle) return 75

    let score = 75
    const egoFactor = (bundle.traits.ego - 50) / 50

    // Avalia memórias ativas de prioridade de equipamento
    const priorityGot = bundle.memories.filter(
      (m) => m.eventType === 'upgrade_received_priority' && !m.isArchivedHistorical,
    ).length
    const priorityDenied = bundle.memories.filter(
      (m) => m.eventType === 'upgrade_denied_priority' && !m.isArchivedHistorical,
    ).length

    score += priorityGot * 6
    score -= priorityDenied * (7 + egoFactor * 3)

    // Promessas quebradas destroem equidade percebida
    const brokenPromises = bundle.promises.filter((p) => p.status === 'broken').length
    score -= brokenPromises * 15

    return clamp(score)
  }

  /**
   * Deriva a intenção do piloto de renovar/permanecer (desireToStay)
   */
  public deriveDesireToStay(driverId: string, carStrength = 70): number {
    const bundle = this.psychologyCache.get(driverId)
    if (!bundle) return 75

    const traits = bundle.traits
    const rel = bundle.relationships
    const es = bundle.emotionalState

    // Piloto altamente ambicioso exige carro forte
    const ambMismatch = traits.ambition > 85 && carStrength < 70 ? (85 - carStrength) * 0.8 : 0

    let desire =
      rel.teamPrincipal.trust * 0.25 +
      rel.team.satisfaction * 0.25 +
      rel.team.technicalTrust * 0.2 +
      es.satisfaction * 0.15 +
      traits.loyalty * 0.15 -
      ambMismatch

    return clamp(desire)
  }

  /**
   * Fornece o contexto do piloto antes da sessão (para preparação e Requisito 67)
   */
  public getDriverPreRaceContext(
    driverId: string,
    circuitId: string,
    round: number,
    season: number,
  ): DriverPreRaceContext {
    const bundle = this.psychologyCache.get(driverId) || {
      driverId,
      traits: getDriverPersonalityTraits({ id: driverId }),
      emotionalState: createDefaultEmotionalState(getDriverPersonalityTraits({ id: driverId })),
      relationships: createDefaultRelationships(getDriverPersonalityTraits({ id: driverId })),
      memories: [],
      promises: [],
    }

    const activeSalient = bundle.memories
      .filter((m) => !m.isArchivedHistorical && m.salience > 10)
      .slice(0, 5)

    const fairness = this.calculatePerceivedFairness(driverId)

    return {
      driverId,
      driverName: driverId,
      round,
      season,
      circuitId,
      expectedPositionRange: { min: 8, max: 12, target: 10 },
      expectedPositionReason: 'Baseado na média de ritmo do carro e calibragem do GP.',
      emotionalState: bundle.emotionalState,
      relationships: bundle.relationships,
      activeSalientMemories: activeSalient,
      activePromises: bundle.promises.filter((p) => p.status === 'active'),
      seatSecurity: 80,
      perceivedTreatmentFairness: fairness,
    }
  }

  /**
   * Fornece o contexto decisório do piloto para a corrida (Interface 6B)
   */
  public getDriverDecisionContext(driverId: string): DriverDecisionContext {
    const bundle = this.psychologyCache.get(driverId)
    if (!bundle) {
      return {
        driverId,
        teamTrust: 75,
        teammateRespect: 75,
        teammateRivalry: 50,
        cooperation: 75,
        ambition: 80,
        professionalism: 80,
        ego: 75,
        pressure: 25,
        relevantMemorySummary: [],
      }
    }

    const t = bundle.traits
    const mate = bundle.relationships.teammate

    return {
      driverId,
      teamTrust: bundle.relationships.teamPrincipal.trust,
      teammateRespect: mate ? mate.respect : 75,
      teammateRivalry: mate ? mate.rivalry : 50,
      cooperation: t.cooperation,
      ambition: t.ambition,
      professionalism: t.professionalism,
      ego: t.ego,
      pressure: bundle.emotionalState.pressure,
      relevantMemorySummary: bundle.memories.slice(0, 3).map((m) => m.description),
    }
  }

  /**
   * Auditoria completa da psicologia do piloto (auditDriverPsychology)
   */
  public auditDriverPsychology(
    driver: Partial<DriverModel> & { name?: string },
  ): DriverPsychologyAuditReport {
    const bundle = this.getOrCreatePsychologyBundle(driver)
    const es = bundle.emotionalState

    const qualMap: Record<keyof DriverEmotionalState, string> = {
      confidence: formatQualitativeState(es.confidence, 'confidence'),
      motivation: formatQualitativeState(es.motivation, 'motivation'),
      satisfaction: formatQualitativeState(es.satisfaction, 'satisfaction'),
      frustration: formatQualitativeState(es.frustration, 'frustration'),
      pressure: formatQualitativeState(es.pressure, 'pressure'),
      teamTrust: formatQualitativeState(es.teamTrust, 'trust'),
      emotionalTension: formatQualitativeState(es.emotionalTension, 'pressure'),
    }

    const activeMems = bundle.memories.filter((m) => !m.isArchivedHistorical && m.salience > 0)
    const histMems = bundle.memories.filter((m) => m.isArchivedHistorical || m.salience === 0)

    const integrityProblems: string[] = []
    if (es.frustration > 100 || es.frustration < 0)
      integrityProblems.push('Frustration fora do clamp 0-100')
    if (es.satisfaction > 100 || es.satisfaction < 0)
      integrityProblems.push('Satisfaction fora do clamp 0-100')

    return {
      driverId: bundle.driverId,
      driverName: driver.name || bundle.driverId,
      personalityTraits: bundle.traits,
      currentState: es,
      qualitativeState: qualMap,
      relationships: bundle.relationships,
      activeMemoriesCount: activeMems.length,
      historicalMemoriesCount: histMems.length,
      topActiveMemories: activeMems.slice(0, 5),
      promises: bundle.promises,
      seatSecurity: driver.seat_security ?? 80,
      perceivedFairness: this.calculatePerceivedFairness(bundle.driverId),
      derivedDesireToStay: this.deriveDesireToStay(bundle.driverId),
      integrityProblems,
    }
  }

  /**
   * Formata a string de telemetria explicativa para QA
   */
  private formatReactionExplanation(
    driverName: string,
    eventType: string,
    baseImpact: number,
    traitModulations: DriverReactionAuditLog['traitModulations'],
    memory: DriverMemoryEvent,
  ): string {
    const mods = traitModulations
      .map((m) => `${m.trait}: ${m.delta >= 0 ? '+' : ''}${m.delta.toFixed(1)}`)
      .join(' / ')
    return `[PSYCHOLOGY AUDIT] ${driverName.toUpperCase()} — ${eventType} / Base: ${baseImpact} / Traits: [${mods}] / Persistence: ${memory.persistenceClass} / Salience: ${memory.salience}`
  }

  /**
   * Lida com transferência de equipe: piloto mantém traços e memórias de ex-equipes,
   * enquanto inicializa relação limpa com a nova escuderia.
   */
  public handleTeamTransfer(driverId: string, oldTeamId: string, newTeamId: string): void {
    const bundle = this.psychologyCache.get(driverId)
    if (!bundle) return

    // Arquiva relação da ex-equipe
    if (!bundle.relationships.historicalTeams) {
      bundle.relationships.historicalTeams = {}
    }
    bundle.relationships.historicalTeams[oldTeamId] = { ...bundle.relationships.team }

    // Reinicia relação com a nova equipe
    const defaultNewRel = createDefaultRelationships(bundle.traits)
    bundle.relationships.teamPrincipal = defaultNewRel.teamPrincipal
    bundle.relationships.team = defaultNewRel.team
    bundle.relationships.teammate = undefined
  }
}

export const driverRelationshipService = new DriverRelationshipService()
