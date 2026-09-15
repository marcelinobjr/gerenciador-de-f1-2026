/**
 * Serviço Canônico de Efeitos do Team Principal (ManagerEffectService)
 * F1 Manager 2026 — Implementação Nº 3
 *
 * PRINCÍPIOS ARQUITETURAIS:
 * 1. O Manager não cria velocidade diretamente nem altera diretamente a física do carro.
 *    PROIBIDO aplicar bônus diretos em carPerformanceRating, downforce, velocidade ou trackFit.
 * 2. Efeitos são perceptíveis mas balanceados (faixa recomendada de 1% a 8%, teto global estrito de 8%).
 * 3. Anti-Stacking e Anti-Duplicação: Atributos alimentam domínios -> Domínios geram modificadores -> Sistemas aplicam o modificador.
 *    Nenhum sistema consome atributos brutos individualmente para evitar bônus duplicados.
 * 4. Saves antigos ou sem manager_profile contam com fallback neutro transparente (baseline 75 / modificador 0%).
 * 5. Telemetria de auditoria em formato legível para QA e inspeção.
 */

import {
  ManagerDomainId,
  MANAGER_DOMAINS,
  MANAGER_ATTRIBUTE_DOMAIN_MAP,
  AttributeDomainMapping,
} from '@/lib/manager-attribute-domains'
import { MANAGER_PROFILES, getManagerProfileById } from '@/lib/manager-profiles'
import { TeamModel } from '@/types/f1'

/**
 * Baseline neutra de pontuação de domínio (75 = equipe de padrão médio na F1, sem bônus nem penalidade)
 */
export const NEUTRAL_DOMAIN_BASELINE = 75

/**
 * Teto global máximo de modificador do Manager (8.0%)
 */
export const MAX_MANAGER_MODIFIER = 0.08

/**
 * Piso mínimo de modificador (-5.0% para fraquezas acentuadas)
 */
export const MIN_MANAGER_MODIFIER = -0.05

export interface ManagerDomainScores {
  raceManagement: number // 0-100
  technicalManagement: number // 0-100
  peopleManagement: number // 0-100
  commercialManagement: number // 0-100
  politicalManagement: number // 0-100
  talentDevelopment: number // 0-100
}

export interface ManagerModifiers {
  /**
   * raceManagement:
   * Bônus em confiança de pit stop e reação a SC / undercut / chuva (ex.: +0.01 a +0.07)
   */
  strategyDecisionBonus: number

  /**
   * raceManagement:
   * Redução de chance de pit stop lento ou erro de procedimento de boxes (ex.: -0.01 a -0.04)
   */
  pitStopErrorReduction: number

  /**
   * peopleManagement:
   * Atenuação de perda de moral após abandono ou resultado negativo (ex.: +0.02 a +0.08)
   */
  moraleRecoveryBonus: number

  /**
   * peopleManagement:
   * Resistência a conflitos internos e segurança de assento de pilotos (ex.: +0.01 a +0.06)
   */
  internalStabilityBonus: number

  /**
   * commercialManagement:
   * Bônus no valor de receitas de patrocínio (ex.: +0.01 a +0.08)
   */
  sponsorValueBonus: number

  /**
   * commercialManagement:
   * Margem favorável na contratação e renegociação salarial (ex.: +0.01 a +0.05)
   */
  negotiationMarginBonus: number

  /**
   * talentDevelopment:
   * Multiplicador de ganho de adaptação à F1 e feedback técnico em testes (ex.: +0.02 a +0.08)
   */
  academyDevelopmentBonus: number

  /**
   * technicalManagement:
   * Redução de custo de oficina e melhoria de diagnóstico em revisões estruturais (ex.: +0.01 a +0.06)
   */
  workshopEfficiencyBonus: number

  /**
   * politicalManagement:
   * Suporte do conselho e tolerância da diretoria (ex.: +0.02 a +0.08)
   */
  boardTrustBonus: number
}

export interface ManagerTelemetryEntry {
  managerName: string
  archetype: string
  domain: ManagerDomainId
  domainScore: number
  baseline: number
  deltaScore: number
  rawModifierPercent: number
  clampedModifierPercent: number
  effectName: string
  explanation: string
}

export interface ManagerEvaluationResult {
  isNeutralFallback: boolean
  managerName: string
  archetypeId: string
  archetypeTitle: string
  specialty: string
  domainScores: ManagerDomainScores
  modifiers: ManagerModifiers
  telemetryLogs: ManagerTelemetryEntry[]
}

export class ManagerEffectService {
  /**
   * Extrai o perfil do manager a partir dos dados do time ou configurações de carreira.
   * Se os dados estiverem vazios ou forem de um save antigo sem profile,
   * retorna o fallback neutro consistente sem falhas.
   */
  public extractProfileFromTeam(team?: Partial<TeamModel> | null): {
    managerName: string
    profileId: string
    baseAttributes: Record<string, number>
    isFallback: boolean
  } {
    const managerName = team?.manager_name || 'Team Principal'

    if (!team || !team.manager_profile) {
      // Fallback neutro oficial para saves legados
      const defaultProfile = MANAGER_PROFILES[0]
      return {
        managerName,
        profileId: defaultProfile.id,
        baseAttributes: defaultProfile.baseAttributes,
        isFallback: true,
      }
    }

    const mp = team.manager_profile
    const profileId = mp.profileId || mp.id || mp.slug || 'estrategista'

    // Garante atributos base completos mesclando com o arquétipo canônico correspondente
    const canonicalProfile = getManagerProfileById(profileId)
    const baseAttributes: Record<string, number> = {
      ...canonicalProfile.baseAttributes,
      ...(mp.baseAttributes || {}),
    }

    return {
      managerName,
      profileId,
      baseAttributes,
      isFallback: false,
    }
  }

  /**
   * Calcula as pontuações consolidadas dos 6 domínios canônicos
   * a partir dos atributos do Manager, aplicando as regras de pesos primários e secundários.
   */
  public calculateDomainScores(
    baseAttributes: Record<string, number>,
    profileId?: string,
  ): ManagerDomainScores {
    const domainAccumulators: Record<ManagerDomainId, { sum: number; totalWeight: number }> = {
      raceManagement: { sum: 0, totalWeight: 0 },
      technicalManagement: { sum: 0, totalWeight: 0 },
      peopleManagement: { sum: 0, totalWeight: 0 },
      commercialManagement: { sum: 0, totalWeight: 0 },
      politicalManagement: { sum: 0, totalWeight: 0 },
      talentDevelopment: { sum: 0, totalWeight: 0 },
    }

    // Processa os 28 atributos mapeados
    for (const [attrKey, mappingItem] of Object.entries(MANAGER_ATTRIBUTE_DOMAIN_MAP)) {
      const mapping = mappingItem as AttributeDomainMapping
      const rawVal = baseAttributes[attrKey] ?? NEUTRAL_DOMAIN_BASELINE

      // Domínio Primário
      domainAccumulators[mapping.primaryDomain].sum += rawVal * mapping.primaryWeight
      domainAccumulators[mapping.primaryDomain].totalWeight += mapping.primaryWeight

      // Domínio Secundário (se houver)
      if (mapping.secondaryDomain && mapping.secondaryWeight) {
        domainAccumulators[mapping.secondaryDomain].sum += rawVal * mapping.secondaryWeight
        domainAccumulators[mapping.secondaryDomain].totalWeight += mapping.secondaryWeight
      }
    }

    // Calcula as médias ponderadas de cada domínio
    const scores: ManagerDomainScores = {
      raceManagement: Math.round(
        domainAccumulators.raceManagement.sum / domainAccumulators.raceManagement.totalWeight,
      ),
      technicalManagement: Math.round(
        domainAccumulators.technicalManagement.sum /
          domainAccumulators.technicalManagement.totalWeight,
      ),
      peopleManagement: Math.round(
        domainAccumulators.peopleManagement.sum / domainAccumulators.peopleManagement.totalWeight,
      ),
      commercialManagement: Math.round(
        domainAccumulators.commercialManagement.sum /
          domainAccumulators.commercialManagement.totalWeight,
      ),
      politicalManagement: Math.round(
        domainAccumulators.politicalManagement.sum /
          domainAccumulators.politicalManagement.totalWeight,
      ),
      talentDevelopment: Math.round(
        domainAccumulators.talentDevelopment.sum / domainAccumulators.talentDevelopment.totalWeight,
      ),
    }

    // Integração com as vantagens e fraquezas já definidas em manager-profiles.ts
    // (Aplica pequenos ajustes temáticos específicos de cada arquétipo nos domínios)
    if (profileId) {
      const canonical = getManagerProfileById(profileId)
      if (canonical) {
        // Estrategista: +3 raceManagement, -2 peopleManagement (foco frio em números)
        if (canonical.id === 'estrategista') {
          scores.raceManagement = Math.min(99, scores.raceManagement + 3)
          scores.peopleManagement = Math.max(45, scores.peopleManagement - 2)
        }
        // Competidor: +3 peopleManagement (motivação/pressão competitiva), -3 politicalManagement (diplomacia)
        else if (canonical.id === 'competidor') {
          scores.peopleManagement = Math.min(99, scores.peopleManagement + 2)
          scores.politicalManagement = Math.max(45, scores.politicalManagement - 3)
        }
        // Engenheiro: +3 technicalManagement, -2 peopleManagement (fricção com pilotos)
        else if (canonical.id === 'engenheiro') {
          scores.technicalManagement = Math.min(99, scores.technicalManagement + 3)
          scores.peopleManagement = Math.max(45, scores.peopleManagement - 2)
        }
        // Gestor: +3 peopleManagement, +2 technicalManagement, -2 raceManagement (aversão a riscos)
        else if (canonical.id === 'gestor') {
          scores.peopleManagement = Math.min(99, scores.peopleManagement + 3)
          scores.raceManagement = Math.max(45, scores.raceManagement - 2)
        }
        // Empresário: +4 commercialManagement, -3 technicalManagement (delega tecnologia)
        else if (canonical.id === 'empresario') {
          scores.commercialManagement = Math.min(99, scores.commercialManagement + 4)
          scores.technicalManagement = Math.max(45, scores.technicalManagement - 3)
        }
        // Líder: +3 talentDevelopment, +2 commercialManagement, -2 politicalManagement (baixa tolerância a lentidão)
        else if (canonical.id === 'lider') {
          scores.talentDevelopment = Math.min(99, scores.talentDevelopment + 3)
          scores.commercialManagement = Math.min(99, scores.commercialManagement + 2)
        }
      }
    }

    // Garante clamp de 0 a 100 para todos os domínios
    for (const key of Object.keys(scores) as ManagerDomainId[]) {
      scores[key] = Math.max(30, Math.min(100, scores[key]))
    }

    return scores
  }

  /**
   * Converte uma pontuação de domínio (30 a 100) em um modificador balanceado (geralmente entre -5% e +8%).
   * Baseline neutra = 75 (0%).
   * Domínio 95 = ~+6.5% a +8.0% (limitado pelo teto).
   * Domínio 55 = ~-4.5% a -5.0%.
   */
  public calculateClampedModifier(
    domainScore: number,
    sensitivity = 0.0035, // 0.35% por ponto acima/abaixo de 75
    customMax = MAX_MANAGER_MODIFIER,
    customMin = MIN_MANAGER_MODIFIER,
  ): number {
    const delta = domainScore - NEUTRAL_DOMAIN_BASELINE
    const rawMod = delta * sensitivity
    const clampedMod = Math.max(customMin, Math.min(customMax, rawMod))
    return Number(clampedMod.toFixed(4))
  }

  /**
   * Avalia a equipe e produz o pacote consolidado de domínios, modificadores e auditoria.
   */
  public evaluateManager(team?: Partial<TeamModel> | null): ManagerEvaluationResult {
    const { managerName, profileId, baseAttributes, isFallback } = this.extractProfileFromTeam(team)
    const profile = getManagerProfileById(profileId)
    const domainScores = this.calculateDomainScores(baseAttributes, profileId)

    // Modificadores calculados por domínio
    const strategyDecisionBonus = this.calculateClampedModifier(
      domainScores.raceManagement,
      0.003,
      0.06,
      -0.03,
    )
    const pitStopErrorReduction = this.calculateClampedModifier(
      domainScores.raceManagement,
      0.002,
      0.04,
      -0.02,
    )
    const moraleRecoveryBonus = this.calculateClampedModifier(
      domainScores.peopleManagement,
      0.004,
      0.08,
      -0.04,
    )
    const internalStabilityBonus = this.calculateClampedModifier(
      domainScores.peopleManagement,
      0.003,
      0.06,
      -0.03,
    )
    const sponsorValueBonus = this.calculateClampedModifier(
      domainScores.commercialManagement,
      0.004,
      0.08,
      -0.04,
    )
    const negotiationMarginBonus = this.calculateClampedModifier(
      domainScores.commercialManagement,
      0.0025,
      0.05,
      -0.03,
    )
    const academyDevelopmentBonus = this.calculateClampedModifier(
      domainScores.talentDevelopment,
      0.004,
      0.08,
      -0.03,
    )
    const workshopEfficiencyBonus = this.calculateClampedModifier(
      domainScores.technicalManagement,
      0.003,
      0.06,
      -0.04,
    )
    const boardTrustBonus = this.calculateClampedModifier(
      domainScores.politicalManagement,
      0.004,
      0.08,
      -0.05,
    )

    const modifiers: ManagerModifiers = {
      strategyDecisionBonus,
      pitStopErrorReduction,
      moraleRecoveryBonus,
      internalStabilityBonus,
      sponsorValueBonus,
      negotiationMarginBonus,
      academyDevelopmentBonus,
      workshopEfficiencyBonus,
      boardTrustBonus,
    }

    // Telemetria de auditoria para QA e debug
    const telemetryLogs: ManagerTelemetryEntry[] = [
      {
        managerName,
        archetype: profile.title,
        domain: 'raceManagement',
        domainScore: domainScores.raceManagement,
        baseline: NEUTRAL_DOMAIN_BASELINE,
        deltaScore: domainScores.raceManagement - NEUTRAL_DOMAIN_BASELINE,
        rawModifierPercent: Number(
          ((domainScores.raceManagement - NEUTRAL_DOMAIN_BASELINE) * 0.3).toFixed(1),
        ),
        clampedModifierPercent: Number((strategyDecisionBonus * 100).toFixed(2)),
        effectName: 'Confiança Estratégica em Pit Wall',
        explanation: `Modificador de ${strategyDecisionBonus >= 0 ? '+' : ''}${(
          strategyDecisionBonus * 100
        ).toFixed(1)}% em janelas de pit stop e reação sob Safety Car/Chuva.`,
      },
      {
        managerName,
        archetype: profile.title,
        domain: 'technicalManagement',
        domainScore: domainScores.technicalManagement,
        baseline: NEUTRAL_DOMAIN_BASELINE,
        deltaScore: domainScores.technicalManagement - NEUTRAL_DOMAIN_BASELINE,
        rawModifierPercent: Number(
          ((domainScores.technicalManagement - NEUTRAL_DOMAIN_BASELINE) * 0.3).toFixed(1),
        ),
        clampedModifierPercent: Number((workshopEfficiencyBonus * 100).toFixed(2)),
        effectName: 'Eficiência de Oficina e P&D',
        explanation: `Ajuste de ${(workshopEfficiencyBonus * 100).toFixed(
          1,
        )}% em custos e tolerância em revisões estruturais de peças.`,
      },
      {
        managerName,
        archetype: profile.title,
        domain: 'peopleManagement',
        domainScore: domainScores.peopleManagement,
        baseline: NEUTRAL_DOMAIN_BASELINE,
        deltaScore: domainScores.peopleManagement - NEUTRAL_DOMAIN_BASELINE,
        rawModifierPercent: Number(
          ((domainScores.peopleManagement - NEUTRAL_DOMAIN_BASELINE) * 0.4).toFixed(1),
        ),
        clampedModifierPercent: Number((moraleRecoveryBonus * 100).toFixed(2)),
        effectName: 'Amortecimento de Moral Pós-Corrida',
        explanation: `Proteção de ${moraleRecoveryBonus >= 0 ? '+' : ''}${(
          moraleRecoveryBonus * 100
        ).toFixed(1)}% na retenção de moral após contratempos esportivos.`,
      },
      {
        managerName,
        archetype: profile.title,
        domain: 'commercialManagement',
        domainScore: domainScores.commercialManagement,
        baseline: NEUTRAL_DOMAIN_BASELINE,
        deltaScore: domainScores.commercialManagement - NEUTRAL_DOMAIN_BASELINE,
        rawModifierPercent: Number(
          ((domainScores.commercialManagement - NEUTRAL_DOMAIN_BASELINE) * 0.4).toFixed(1),
        ),
        clampedModifierPercent: Number((sponsorValueBonus * 100).toFixed(2)),
        effectName: 'Eficiência de Captação e Patrocínios',
        explanation: `Multiplicador comercial de ${sponsorValueBonus >= 0 ? '+' : ''}${(
          sponsorValueBonus * 100
        ).toFixed(1)}% em contratos com multinacionais.`,
      },
      {
        managerName,
        archetype: profile.title,
        domain: 'politicalManagement',
        domainScore: domainScores.politicalManagement,
        baseline: NEUTRAL_DOMAIN_BASELINE,
        deltaScore: domainScores.politicalManagement - NEUTRAL_DOMAIN_BASELINE,
        rawModifierPercent: Number(
          ((domainScores.politicalManagement - NEUTRAL_DOMAIN_BASELINE) * 0.4).toFixed(1),
        ),
        clampedModifierPercent: Number((boardTrustBonus * 100).toFixed(2)),
        effectName: 'Confiança Institucional do Conselho',
        explanation: `Margem de ${boardTrustBonus >= 0 ? '+' : ''}${(boardTrustBonus * 100).toFixed(
          1,
        )}% na estabilidade com a diretoria da escuderia.`,
      },
      {
        managerName,
        archetype: profile.title,
        domain: 'talentDevelopment',
        domainScore: domainScores.talentDevelopment,
        baseline: NEUTRAL_DOMAIN_BASELINE,
        deltaScore: domainScores.talentDevelopment - NEUTRAL_DOMAIN_BASELINE,
        rawModifierPercent: Number(
          ((domainScores.talentDevelopment - NEUTRAL_DOMAIN_BASELINE) * 0.4).toFixed(1),
        ),
        clampedModifierPercent: Number((academyDevelopmentBonus * 100).toFixed(2)),
        effectName: 'Velocidade de Lapidação na Academia',
        explanation: `Aceleração de ${academyDevelopmentBonus >= 0 ? '+' : ''}${(
          academyDevelopmentBonus * 100
        ).toFixed(1)}% em testes oficiais de homologação de jovens.`,
      },
    ]

    return {
      isNeutralFallback: isFallback,
      managerName,
      archetypeId: profile.id,
      archetypeTitle: profile.title,
      specialty: profile.specialty,
      domainScores,
      modifiers,
      telemetryLogs,
    }
  }

  /**
   * Helper simplificado de consulta rápida para subsistemas que precisam de um modificador específico:
   * Mantém desacoplado e garante conformidade anti-duplicação.
   */
  public getStrategyModifier(team?: Partial<TeamModel> | null): number {
    return this.evaluateManager(team).modifiers.strategyDecisionBonus
  }

  public getMoraleRecoveryModifier(team?: Partial<TeamModel> | null): number {
    return this.evaluateManager(team).modifiers.moraleRecoveryBonus
  }

  public getSponsorModifier(team?: Partial<TeamModel> | null): number {
    return this.evaluateManager(team).modifiers.sponsorValueBonus
  }

  public getAcademyDevelopmentModifier(team?: Partial<TeamModel> | null): number {
    return this.evaluateManager(team).modifiers.academyDevelopmentBonus
  }

  public getWorkshopDiscountModifier(team?: Partial<TeamModel> | null): number {
    return this.evaluateManager(team).modifiers.workshopEfficiencyBonus
  }

  public getBoardTrustModifier(team?: Partial<TeamModel> | null): number {
    return this.evaluateManager(team).modifiers.boardTrustBonus
  }

  /**
   * Formata a telemetria de QA em string limpa conforme Requisito 14:
   * Ex: "Manager: O Estrategista / Race Management Domain: 91 / Pit Window Decision / Base: 68% / Mod: +4.8% / Final: 72.8%"
   */
  public formatDebugTelemetry(
    team: Partial<TeamModel> | null | undefined,
    domain: ManagerDomainId,
    actionContext: string,
    baseValue: number,
    modifierFraction: number,
  ): string {
    const evaluation = this.evaluateManager(team)
    const domainMeta = MANAGER_DOMAINS[domain]
    const domainScore = evaluation.domainScores[domain]
    const finalValue = Number((baseValue * (1 + modifierFraction)).toFixed(1))
    const sign = modifierFraction >= 0 ? '+' : ''
    const modPct = (modifierFraction * 100).toFixed(1)

    return `Manager: ${evaluation.archetypeTitle} / ${domainMeta.name} Domain: ${domainScore} / ${actionContext} / Base: ${baseValue}% / Manager modifier: ${sign}${modPct}% / Final: ${finalValue}%`
  }
}

export const managerEffectService = new ManagerEffectService()
