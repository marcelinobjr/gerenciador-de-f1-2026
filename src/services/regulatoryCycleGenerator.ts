/**
 * RegulatoryCycleGenerator (8C.4)
 * F1 Manager 2026 — Gerador Persistente & Controlado de Calendário Regulatório
 *
 * REGRAS DE OURO:
 * 1. PERSISTÊNCIA: Eventos futuros, uma vez gerados/anunciados, PERSISTEM. Reload não muda o calendário.
 * 2. DETERMINISMO: Baseado em Mulberry32 determinístico a partir de seed de universo/temporada.
 * 3. NÃO GERAR MUDANÇA TODO ANO: Intervalos controlados.
 *    - Technical Directives: Ocasionais (1 a cada 2-3 anos, 30% chance em anos sem Major/New Era).
 *    - Minor Changes: Relativamente comuns (1 a cada 2 anos se estável).
 *    - Major Changes: Espaçadas (normalmente 3 a 4 anos entre elas).
 *    - New Technical Eras: Raras (normalmente 5 a 7 anos de era técnica).
 * 4. LEAD TIME ADEQUADO:
 *    - New Technical Era: anunciada 2 anos antes (ex: anunciada em N-2 para entrar em vigor em N).
 *    - Major Change: anunciada 1 a 2 anos antes.
 *    - Minor Change: anunciada 1 ano antes.
 *    - Technical Directive: anunciada na mesma temporada ou 1 ano antes.
 * 5. PROPOSED vs ANNOUNCED:
 *    - PROPOSED pode eventualmente ser aprovada (virando ANNOUNCED) ou cancelada.
 *    - ANNOUNCED é estável e irreversível salvo caso excepcional.
 */

import {
  TechnicalRegulation,
  RegulationTimelineState,
  RegulationType,
  RegulationSeverity,
  RegulationUncertainty,
  TechnicalDomainId,
  CANONICAL_TECHNICAL_DOMAINS,
} from '@/types/canonical-regulations'
import {
  buildDefaultTransferabilityProfile,
  CANONICAL_BASELINE_ERA_ID,
  CANONICAL_BASELINE_REGULATION_ID,
} from '@/services/regulationService'

export interface RegulatoryCycleConfig {
  horizonYears: number // Quantos anos à frente projetar (default: 4-6)
  seed?: number
}

export class RegulatoryCycleGenerator {
  /**
   * Gerador pseudo-aleatório determinístico Mulberry32
   */
  private seededRng(seed: number): () => number {
    let t = (seed += 0x6d2b79f5)
    return () => {
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash)
  }

  /**
   * Garante que a timeline possui eventos projetados até (currentSeason + horizonYears).
   * Totalmente idempotente: se a temporada já possui regulamento ou já foi projetada,
   * NÃO regera nem altera o que já existe!
   */
  public ensureTimelineProjected(
    timeline: RegulationTimelineState,
    targetHorizonSeason: number,
    baseSeed = 42,
  ): RegulationTimelineState {
    const currentHorizon = timeline.generatedUpToSeason ?? timeline.currentSeason
    if (currentHorizon >= targetHorizonSeason) {
      return timeline
    }

    let updatedTimeline = { ...timeline, regulations: [...timeline.regulations] }

    for (let season = currentHorizon + 1; season <= targetHorizonSeason; season++) {
      updatedTimeline = this.generateSeasonRegulatoryProspects(updatedTimeline, season, baseSeed)
    }

    updatedTimeline.generatedUpToSeason = targetHorizonSeason
    updatedTimeline.version = updatedTimeline.version + 1
    return updatedTimeline
  }

  /**
   * Avalia e gera potenciais regulamentos para a temporada alvo `targetSeason`
   */
  private generateSeasonRegulatoryProspects(
    timeline: RegulationTimelineState,
    targetSeason: number,
    baseSeed: number,
  ): RegulationTimelineState {
    // 1. Verificar se já existe algum regulamento já cadastrado com effectiveSeason === targetSeason
    const existingForSeason = timeline.regulations.filter(
      (r) => r.effectiveSeason === targetSeason && r.status !== 'CANCELLED',
    )
    if (existingForSeason.length > 0) {
      // Já está coberto
      return timeline
    }

    // 2. Investigar histórico recente para manter cadência e períodos estáveis
    // Localizar a última New Era e a última Major Change
    let lastNewEraSeason = 2026
    let lastMajorSeason = 2026
    let lastMinorOrTdSeason = 2026

    for (const r of timeline.regulations) {
      if (r.status === 'CANCELLED') continue
      if (r.category === 'NEW_TECHNICAL_ERA' && r.effectiveSeason <= targetSeason) {
        if (r.effectiveSeason > lastNewEraSeason) lastNewEraSeason = r.effectiveSeason
      }
      if (r.category === 'MAJOR_REGULATION_CHANGE' && r.effectiveSeason <= targetSeason) {
        if (r.effectiveSeason > lastMajorSeason) lastMajorSeason = r.effectiveSeason
      }
      if (
        (r.category === 'MINOR_REGULATION_CHANGE' || r.category === 'TECHNICAL_DIRECTIVE') &&
        r.effectiveSeason <= targetSeason
      ) {
        if (r.effectiveSeason > lastMinorOrTdSeason) lastMinorOrTdSeason = r.effectiveSeason
      }
    }

    const yearsSinceLastNewEra = targetSeason - lastNewEraSeason
    const yearsSinceLastMajor = targetSeason - Math.max(lastNewEraSeason, lastMajorSeason)

    // Seed determinística por temporada alvo
    const rng = this.seededRng(baseSeed + targetSeason * 313)

    // Decisão do tipo de evento técnico:
    // - NEW_TECHNICAL_ERA:
    //   - Se yearsSinceLastNewEra < 5: 0% chance (período de era técnica garantido de pelo menos 5 anos).
    //   - Se yearsSinceLastNewEra === 5: 20% chance
    //   - Se yearsSinceLastNewEra === 6: 45% chance
    //   - Se yearsSinceLastNewEra >= 7: 80% chance (quase mandatário para evitar estagnação infinita)
    let chosenType: RegulationType | 'STABLE_SEASON' = 'STABLE_SEASON'

    const newEraRoll = rng()
    if (yearsSinceLastNewEra >= 7 && newEraRoll < 0.85) {
      chosenType = 'NEW_TECHNICAL_ERA'
    } else if (yearsSinceLastNewEra === 6 && newEraRoll < 0.45) {
      chosenType = 'NEW_TECHNICAL_ERA'
    } else if (yearsSinceLastNewEra === 5 && newEraRoll < 0.2) {
      chosenType = 'NEW_TECHNICAL_ERA'
    }

    // Se não for New Era, verificar Major Change:
    // - Major não pode ocorrer no ano imediatamente após uma New Era ou outra Major (mínimo 2 anos de gap, ideal 3-4)
    if (chosenType === 'STABLE_SEASON') {
      if (yearsSinceLastMajor >= 3 && yearsSinceLastNewEra < 5) {
        const majorRoll = rng()
        // 40% de chance aos 3 anos, 65% aos 4 anos
        const threshold = yearsSinceLastMajor >= 4 ? 0.65 : 0.4
        if (majorRoll < threshold) {
          chosenType = 'MAJOR_REGULATION_CHANGE'
        }
      }
    }

    // Se não for Major nem New Era, avaliar Minor Change ou Technical Directive:
    // - Ocorre em ~35% dos anos estáveis
    if (chosenType === 'STABLE_SEASON') {
      const minorRoll = rng()
      if (minorRoll < 0.25) {
        chosenType = 'MINOR_REGULATION_CHANGE'
      } else if (minorRoll < 0.38) {
        chosenType = 'TECHNICAL_DIRECTIVE'
      }
    }

    // Se a temporada for completamente estável (STABLE_SEASON), nada a criar
    if (chosenType === 'STABLE_SEASON') {
      return timeline
    }

    // Construir o novo regulamento canônico de acordo com o tipo
    const newReg = this.buildGeneratedRegulation({
      timeline,
      category: chosenType,
      targetSeason,
      rng,
    })

    const updatedRegulations = [...timeline.regulations, newReg]
    return {
      ...timeline,
      version: timeline.version + 1,
      regulations: updatedRegulations,
      historyLog: [
        ...timeline.historyLog,
        {
          timestamp: new Date().toISOString(),
          sourceEventId: `gen_cycle_${newReg.regulationId}`,
          eventType:
            newReg.status === 'ANNOUNCED'
              ? 'REGULATION_ANNOUNCED'
              : newReg.category === 'TECHNICAL_DIRECTIVE'
                ? 'TECHNICAL_DIRECTIVE_ISSUED'
                : 'PROPOSAL_CREATED',
          regulationId: newReg.regulationId,
          summary: `Planejamento regulatório FIA gerado para a temporada ${targetSeason} (${newReg.name}).`,
        },
      ],
    }
  }

  /**
   * Constrói o objeto TechnicalRegulation concreto
   */
  private buildGeneratedRegulation(params: {
    timeline: RegulationTimelineState
    category: RegulationType
    targetSeason: number
    rng: () => number
  }): TechnicalRegulation {
    const { category, targetSeason, rng } = params
    const regId = `reg_${targetSeason}_${category.toLowerCase()}`

    let name = ''
    let technicalEraId = params.timeline.activeEraId
    let severity: RegulationSeverity = 'MEDIUM'
    let uncertainty: RegulationUncertainty = 'MODERATE'
    let announcementLeadYears = 1
    let status: 'PROPOSED' | 'ANNOUNCED' = 'ANNOUNCED'
    let affectedDomains: TechnicalDomainId[] = []
    let publicDescription = ''

    switch (category) {
      case 'NEW_TECHNICAL_ERA': {
        name = `Nova Era Técnica FIA ${targetSeason} — Monopostos de Nova Geração`
        technicalEraId = `era_${targetSeason}_next_gen`
        severity = 'EXTREME'
        uncertainty = rng() > 0.5 ? 'VERY_HIGH' : 'HIGH'
        announcementLeadYears = 2 // 2 anos de antecedência (lead time obrigatório 8C.2)
        affectedDomains = [
          'aerodynamics',
          'floorGroundEffect',
          'chassis',
          'suspension',
          'cooling',
          'vehicleDynamics',
          'simulation',
          'manufacturing',
        ]
        publicDescription = `Marco regulatório histórico aprovado pelo Conselho Mundial da FIA para ${targetSeason}. Redefinição completa dos conceitos aerodinâmicos, arquitetura estrutural e dinâmica veicular.`
        break
      }
      case 'MAJOR_REGULATION_CHANGE': {
        const themes = [
          {
            name: `Revisão Estrutural de Efeito Solo & Assoalho ${targetSeason}`,
            domains: [
              'floorGroundEffect',
              'aerodynamics',
              'vehicleDynamics',
              'suspension',
            ] as TechnicalDomainId[],
            desc: `FIA impõe restrições severas à geometria dos túneis de Venturi e rigidez vertical de suspensão para limitar porpoising.`,
          },
          {
            name: `Revisão de Aerodinâmica Ativa & Vórtices Dianteiros ${targetSeason}`,
            domains: ['aerodynamics', 'cooling', 'simulation', 'chassis'] as TechnicalDomainId[],
            desc: `Redução drástica da área de asa dianteira e novas diretrizes de direcionamento de esteira de ar para favorecer ultrapassagens.`,
          },
          {
            name: `Revisão de Segurança Estrutural & Monocoque ${targetSeason}`,
            domains: [
              'chassis',
              'weightManagement',
              'suspension',
              'manufacturing',
            ] as TechnicalDomainId[],
            desc: `Elevação das cargas de impacto nos crash-tests laterais e frontal e novo arranjo de lastro mínimo obrigatório.`,
          },
        ]
        const pick = themes[Math.floor(rng() * themes.length)]
        name = pick.name
        technicalEraId = params.timeline.activeEraId
        severity = 'HIGH'
        uncertainty = rng() > 0.6 ? 'HIGH' : 'MODERATE'
        announcementLeadYears = rng() > 0.3 ? 2 : 1
        affectedDomains = pick.domains
        publicDescription = pick.desc
        break
      }
      case 'MINOR_REGULATION_CHANGE': {
        const minorThemes = [
          {
            name: `Ajuste Técnico Anual de Asas & Difusor ${targetSeason}`,
            domains: ['aerodynamics', 'floorGroundEffect'] as TechnicalDomainId[],
            desc: `Pequenas alterações dimensionais nos bordos de fuga das asas e tolerâncias de flexibilidade de difusor.`,
          },
          {
            name: `Ajuste de Arrefecimento & Refrigeração ${targetSeason}`,
            domains: ['cooling', 'powerUnitIntegration'] as TechnicalDomainId[],
            desc: `Padronização das saídas de exaustão térmica para melhor monitoramento térmico dos componentes elétricos.`,
          },
          {
            name: `Calibração Mecânica de Suspensão ${targetSeason}`,
            domains: ['suspension', 'mechanicalGrip'] as TechnicalDomainId[],
            desc: `Restrição menor na cinemática do terceiro elemento da suspensão traseira.`,
          },
        ]
        const pick = minorThemes[Math.floor(rng() * minorThemes.length)]
        name = pick.name
        technicalEraId = params.timeline.activeEraId
        severity = 'MEDIUM'
        uncertainty = 'LOW'
        announcementLeadYears = 1
        affectedDomains = pick.domains
        publicDescription = pick.desc
        break
      }
      case 'TECHNICAL_DIRECTIVE': {
        const tdThemes = [
          {
            name: `Diretiva Técnica TD-${targetSeason}/01 — Medição de Flexibilidade de Assoalho`,
            domains: ['floorGroundEffect'] as TechnicalDomainId[],
            desc: `Inserção de novos sensores ópticos de deflexão sob aceleração máxima lateral.`,
          },
          {
            name: `Diretiva Técnica TD-${targetSeason}/02 — Monitoramento de Pressão e Temperatura de Pneus`,
            domains: ['mechanicalGrip', 'vehicleDynamics'] as TechnicalDomainId[],
            desc: `Tolerâncias mais estreitas nas leituras dos sensores TPMS oficiais fornecidos pela FIA.`,
          },
        ]
        const pick = tdThemes[Math.floor(rng() * tdThemes.length)]
        name = pick.name
        technicalEraId = params.timeline.activeEraId
        severity = 'LOW'
        uncertainty = 'LOW'
        announcementLeadYears = 1
        affectedDomains = pick.domains
        publicDescription = pick.desc
        break
      }
    }

    const announcementSeason = Math.max(2026, targetSeason - announcementLeadYears)
    const transferabilityProfile = buildDefaultTransferabilityProfile(category, affectedDomains)

    return {
      regulationId: regId,
      name,
      technicalEraId,
      category,
      severity,
      status,
      announcementSeason,
      effectiveSeason: targetSeason,
      affectedDomains,
      technicalPriorities: {
        aerodynamics: 'HIGH',
        floorGroundEffect: 'CRITICAL',
        chassis: 'MEDIUM',
      },
      transferabilityProfile,
      uncertainty,
      publicDescription,
      seed: Math.floor(rng() * 1000000),
      createdAt: new Date().toISOString(),
    }
  }
}

export const regulatoryCycleGenerator = new RegulatoryCycleGenerator()
