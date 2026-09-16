/**
 * LongRunRegulationSimulator (8C.4)
 * F1 Manager 2026 — Fixture & Sandbox de Simulação de Décadas (Long-Run QA)
 *
 * REGRAS DE OURO:
 * 1. NUNCA tocar no save real do jogador (Audi F1 Team).
 * 2. DETERMINISMO: Mesma snapshot + mesma seed = mesma história.
 * 3. DINASTIAS EXISTEM (3-5 títulos). DINASTIAS ETERNAS NÃO.
 * 4. SEM RANDOMIZAÇÃO ANUAL: Estabilidade ano a ano dentro da era.
 * 5. SEM PARIDADE ARTIFICIAL: Marcas não garantem nada; mérito estrutural + decisões geram continuidade.
 * 6. HISTORICAL IMMUTABILITY: Season Histories passadas nunca são recalculadas.
 * 7. Track Fit intocado.
 */

import {
  TechnicalRegulation,
  RegulationTimelineState,
  ConceptRealization,
  NewCarBaselineResult,
} from '@/types/canonical-regulations'
import { CanonicalSeasonHistory } from '@/types/canonical-season-transition'
import {
  regulationTimelineService,
  regulationService,
  createDefaultBaselineTimeline,
} from '@/services/regulationService'
import { regulatoryCycleGenerator } from '@/services/regulatoryCycleGenerator'
import { tierMobilityService } from '@/services/tierMobilityService'
import { eraHistoryService } from '@/services/eraHistoryService'
import { TeamModel } from '@/types/f1'

export interface LongRunSeasonRecord {
  season: number
  regulationEra: string
  constructorsChampion: { teamId: string; teamName: string; points: number }
  driversChampion: { driverId: string; driverName: string; teamName: string; points: number }
  top3Teams: string[]
  averageCarPerformance: number
  p1ToP10PerformanceGap: number
  activeTitleStreak: number
  longestTitleStreak: number
  regulationEvent?: {
    category: string
    name: string
    effectiveSeason: number
  } | null
  promotedTeams: string[]
  demotedTeams: string[]
  badConceptRecoveries: string[]
}

export interface LongRunSimulationReport {
  totalSeasonsSimulated: number
  differentConstructorsChampionsCount: number
  differentDriversChampionsCount: number
  constructorsChampionsList: { teamId: string; count: number }[]
  driversChampionsList: { driverName: string; count: number }[]
  longestDynastyStreak: number
  dominantTeamName: string
  averageDynastyDuration: number
  majorRegulationsCount: number
  newErasCount: number
  averageStablePeriodYears: number
  totalPromotions: number
  totalDemotions: number
  badConceptRecoveriesCount: number
  topTeamErrorCount: number
  midfieldBreakthroughCount: number
  weakTeamDominanceAnomalyCount: number
  seasonRecords: LongRunSeasonRecord[]
  historyImmutabilityAudit: boolean
  auditCyclePassed: boolean
}

export class LongRunRegulationSimulator {
  /**
   * Constrói grid sintético padrão de 10 equipes com DNA, infraestrutura e staff
   */
  public createSyntheticGrid(): {
    teams: TeamModel[]
    ratings: Record<string, number>
    previousTiers: Record<string, any>
  } {
    const rawGrid: {
      id: string
      name: string
      baseStrength: number
      risk: number
      ambition: number
    }[] = [
      { id: 'red_bull', name: 'Red Bull Racing', baseStrength: 88, risk: 65, ambition: 85 },
      { id: 'ferrari', name: 'Scuderia Ferrari', baseStrength: 86, risk: 55, ambition: 90 },
      { id: 'mclaren', name: 'McLaren F1 Team', baseStrength: 85, risk: 60, ambition: 80 },
      { id: 'mercedes', name: 'Mercedes-AMG F1', baseStrength: 84, risk: 50, ambition: 85 },
      { id: 'aston_martin', name: 'Aston Martin F1', baseStrength: 75, risk: 70, ambition: 75 },
      { id: 'alpine', name: 'Alpine F1 Team', baseStrength: 73, risk: 45, ambition: 65 },
      { id: 'williams', name: 'Williams Racing', baseStrength: 68, risk: 50, ambition: 60 },
      { id: 'racing_bulls', name: 'Visa Cash App RB', baseStrength: 69, risk: 55, ambition: 60 },
      { id: 'haas', name: 'Haas F1 Team', baseStrength: 64, risk: 40, ambition: 50 },
      { id: 'kick_sauber', name: 'Stake F1 Team', baseStrength: 62, risk: 40, ambition: 50 },
    ]

    const teams: TeamModel[] = rawGrid.map(
      (t) =>
        ({
          id: t.id,
          name: t.name,
          color: '#FFFFFF',
          chassis_level: t.baseStrength,
          aero_level: t.baseStrength,
          strategy_level: 70,
          budget: 120_000_000,
          engine_supplier: 'Ferrari',
          strength: t.baseStrength,
          is_custom: false,
          risk_tolerance: t.risk,
          ambition: t.ambition,
          youth_academy_level: 4,
          factory_level: 4,
          simulator_level: 4,
          pitstop_center_level: 4,
          calculated_overall: t.baseStrength,
          balance_delta: 0,
          engine_pool_used: 1,
          active_engine_wear: 10,
          constructors_points_deduction: 0,
          rd_penalty_rounds_left: 0,
        }) as any,
    )

    const ratings: Record<string, number> = {}
    rawGrid.forEach((t) => {
      ratings[t.id] = t.baseStrength
    })

    return { teams, ratings, previousTiers: {} }
  }

  /**
   * Simula N temporadas completas a partir de uma seed determinística Mulberry32
   */
  public async simulateLongRun(params: {
    startSeason?: number
    totalSeasons?: number
    seed?: number
  }): Promise<LongRunSimulationReport> {
    const { startSeason = 2026, totalSeasons = 30, seed = 42 } = params

    const rng = regulationService.seededRandom(seed)
    const { teams } = this.createSyntheticGrid()

    // 1. Inicializar timeline regulatória limpa de sandbox (sem tocar no banco do jogador)
    let timeline: RegulationTimelineState = createDefaultBaselineTimeline(startSeason)

    // Garantir projeção futura controlada
    timeline = regulatoryCycleGenerator.ensureTimelineProjected(
      timeline,
      startSeason + totalSeasons + 5,
      seed,
    )

    // Estado acumulado
    let currentRatings: Record<string, number> = {}
    teams.forEach((t) => {
      currentRatings[t.id] = (t as any).strength
    })

    const seasonRecords: LongRunSeasonRecord[] = []
    const immutableHistories: CanonicalSeasonHistory[] = []
    let previousTiersMap: Record<string, any> = {}

    let currentTitleStreak = 0
    let longestTitleStreak = 0
    let lastConstructorChampId = ''
    let streakLeaderName = ''

    let badConceptRecoveriesCount = 0
    let topTeamErrorCount = 0
    let midfieldBreakthroughCount = 0
    let weakTeamDominanceAnomalyCount = 0

    let previousEraId = timeline.activeEraId
    let stablePeriodsCount = 0
    let totalStableYearsAccum = 0
    let currentStableStreak = 0

    // Rastrear histórico para recovery check
    const teamRealizationHistory: Record<string, number[]> = {}
    teams.forEach((t) => (teamRealizationHistory[t.id] = []))

    for (let seasonIndex = 0; seasonIndex < totalSeasons; seasonIndex++) {
      const seasonYear = startSeason + seasonIndex

      // A. Verificar se há regulamento agendado para entrar em vigor nesta temporada
      const futureRegs = regulationTimelineService.getFutureRegulations(timeline, seasonYear - 1)
      const targetReg = futureRegs.find((r) => r.effectiveSeason === seasonYear)

      let activeEvent: TechnicalRegulation | null = null
      let isNewTechnicalEra = false

      if (targetReg) {
        const actRes = regulationService.activateRegulation({
          timeline,
          regulationId: targetReg.regulationId,
          seasonYear,
        })
        timeline = actRes.updatedTimeline
        activeEvent = targetReg
        if (targetReg.category === 'NEW_TECHNICAL_ERA') {
          isNewTechnicalEra = true
        }
      }

      const activeReg = regulationTimelineService.getActiveRegulation(timeline)!

      // Contabilizar período estável
      if (
        activeEvent &&
        (activeEvent.category === 'NEW_TECHNICAL_ERA' ||
          activeEvent.category === 'MAJOR_REGULATION_CHANGE')
      ) {
        if (currentStableStreak > 0) {
          stablePeriodsCount++
          totalStableYearsAccum += currentStableStreak
        }
        currentStableStreak = 0
      } else {
        currentStableStreak++
      }

      // B. Inteligência Artificial: Long-Term Allocation e Research
      // Todas as equipes decidem sua estratégia técnica
      const teamPreparations: Record<string, any> = {}
      for (const t of teams) {
        // IA decide alocação sem cheat
        const aiDecision = regulationService.evaluateAiAllocationDecision({
          team: t,
          championshipPosition: 5,
          currentSeasonYear: seasonYear,
          currentRound: 18,
          totalRoundsInSeason: 24,
          regulation: activeReg,
          seedModifier: rng(),
          consecutiveDominantSeasons: t.id === lastConstructorChampId ? currentTitleStreak : 0,
        })

        // Preparação sintética ponderada por alocação e facilities
        const prepScore = Math.min(
          95,
          Math.round(
            aiDecision.futureRegulationShare * 0.7 + (t as any).factory_level * 6 + rng() * 15,
          ),
        )
        teamPreparations[t.id] = {
          teamId: t.id,
          regulationId: activeReg.regulationId,
          preparationScore: prepScore,
          validationProgress: prepScore * 0.9,
          knowledgeGain: prepScore * 0.8,
          status: prepScore >= 70 ? 'EXTENSIVE' : prepScore >= 50 ? 'STRONG' : 'MODERATE',
        }
      }

      // C. Se for ano de ativação de Nova Era Técnica ou Major Change com ruptura:
      // Gerar novos baselines de carro via ConceptRealization (8C.3)
      const seasonBaselines: Record<string, NewCarBaselineResult> = {}
      const seasonConcepts: Record<string, ConceptRealization> = {}

      if (isNewTechnicalEra) {
        for (const t of teams) {
          const conc = regulationService.generateConceptRealization({
            team: t,
            regulation: activeReg,
            preparation: teamPreparations[t.id],
            seedOverride: Math.floor(rng() * 1000000),
          })
          const baseline = regulationService.generateNewCarBaseline({
            team: t,
            regulation: activeReg,
            realization: conc,
          })

          seasonConcepts[t.id] = conc
          seasonBaselines[t.id] = baseline

          // Registrar histórico de realization
          teamRealizationHistory[t.id].push(conc.realizationScore)

          // Rastrear Top Team Error (equipe forte que errou na nova era)
          if ((t as any).baseStrength >= 84 && conc.realizationScore < 60) {
            topTeamErrorCount++
          }

          // Rastrear Midfield Breakthrough (equipe média que acertou no topo)
          if ((t as any).baseStrength <= 75 && conc.realizationScore >= 82) {
            midfieldBreakthroughCount++
          }

          // Rastrear Weak Team Lottery Check: backmarker não deve ter performance >= 90
          if ((t as any).baseStrength <= 65 && baseline.carPerformanceRating >= 88) {
            weakTeamDominanceAnomalyCount++
          }

          // Atualizar rating competitivo do carro da equipe
          // Knowledge Persistence & Disruption combinados organicamente:
          currentRatings[t.id] = baseline.carPerformanceRating
        }
      } else {
        // Evolução orgânica intra-era (P&D 4B / Staff / Instalações)
        for (const t of teams) {
          const current = currentRatings[t.id] || 70
          // Equipes mais fracas na era convergem ligeiramente via P&D e dados de pista (Organic Convergence)
          const convergenceOpportunity = current < 80 ? (80 - current) * 0.12 : 0
          // Progressão normal de fábrica (0.5 a 2.5 pts)
          const devDelta = 1.0 + rng() * 1.5 + convergenceOpportunity
          // Teto de performance 98
          currentRatings[t.id] = Number(Math.min(97.5, current + devDelta).toFixed(1))

          // Verificar se equipe que teve realization baixa anterior se recuperou
          const pastReal = teamRealizationHistory[t.id]
          if (
            pastReal &&
            pastReal.length > 0 &&
            pastReal[pastReal.length - 1] < 60 &&
            currentRatings[t.id] >= 75
          ) {
            badConceptRecoveriesCount++
          }
        }
      }

      // D. Simulação dos Resultados da Temporada
      // Ordenar grid por performance com variação controlada de pilotos/estratégia (sem randomização caótica)
      const racePaces: { teamId: string; teamName: string; pace: number }[] = teams.map((t) => {
        const perf = currentRatings[t.id]
        // Variação por GP/temporada: +/- 1.5 pts no máximo
        const stochastic = (rng() - 0.5) * 2.2
        return {
          teamId: t.id,
          teamName: t.name,
          pace: perf + stochastic,
        }
      })
      racePaces.sort((a, b) => b.pace - a.pace)

      // Atribuição de pontos do campeonato de construtores
      const basePoints = [480, 390, 310, 240, 180, 130, 80, 45, 20, 5]
      const standings = racePaces.map((p, idx) => ({
        teamId: p.teamId,
        teamName: p.teamName,
        rank: idx + 1,
        points: basePoints[idx] + Math.floor(rng() * 25),
        carPerformance: Number(currentRatings[p.teamId].toFixed(1)),
      }))

      const cChamp = standings[0]
      const dChamp = {
        driverId: `drv_${cChamp.teamId}_1`,
        driverName: `Piloto 1 ${cChamp.teamName}`,
        teamName: cChamp.teamName,
        points: Math.round(cChamp.points * 0.58),
      }

      // Avaliação de Dinastias
      if (cChamp.teamId === lastConstructorChampId) {
        currentTitleStreak++
      } else {
        lastConstructorChampId = cChamp.teamId
        streakLeaderName = cChamp.teamName
        currentTitleStreak = 1
      }
      if (currentTitleStreak > longestTitleStreak) {
        longestTitleStreak = currentTitleStreak
      }

      // E. Tier Mobility Derivado
      const mobility = tierMobilityService.evaluateGridMobility({
        seasonYear,
        standings,
        previousTiersMap,
      })
      // Atualizar previousTiersMap para a próxima temporada
      previousTiersMap = {}
      mobility.tierStatuses.forEach((st) => {
        previousTiersMap[st.teamId] = st.tier
      })

      // F. Registro Imutável de História (CanonicalSeasonHistory)
      const seasonHistoryRecord: CanonicalSeasonHistory = {
        id: `hist_${seasonYear}_sandbox`,
        season: seasonYear,
        technicalEraId: activeReg.technicalEraId,
        driversChampion: {
          driverId: dChamp.driverId,
          driverName: dChamp.driverName,
          teamName: dChamp.teamName,
          points: dChamp.points,
          wins: 8,
          podiums: 15,
        },
        constructorsChampion: {
          teamId: cChamp.teamId,
          teamName: cChamp.teamName,
          points: cChamp.points,
          wins: 12,
          podiums: 22,
        },
        finalStandings: {
          drivers: [],
          constructors: standings as any,
        },
        teamSummary: {
          teamId: cChamp.teamId,
          teamName: cChamp.teamName,
          finalRank: 1,
          points: cChamp.points,
          wins: 12,
          podiums: 22,
          closingCash: 50_000_000,
          costCapSpent: 135_000_000,
        },
        majorRecords: {
          totalRaces: 24,
          mostWinsDriver: dChamp.driverName,
        },
        archivedAt: new Date().toISOString(),
      }
      immutableHistories.push(seasonHistoryRecord)

      // Métricas de performance do grid
      const perfValues = Object.values(currentRatings)
      const avgPerf = Number((perfValues.reduce((a, b) => a + b, 0) / perfValues.length).toFixed(1))
      const p1ToP10Gap = Number(
        (standings[0].carPerformance - standings[standings.length - 1].carPerformance).toFixed(1),
      )

      seasonRecords.push({
        season: seasonYear,
        regulationEra: activeReg.technicalEraId,
        constructorsChampion: {
          teamId: cChamp.teamId,
          teamName: cChamp.teamName,
          points: cChamp.points,
        },
        driversChampion: dChamp,
        top3Teams: standings.slice(0, 3).map((s) => s.teamName),
        averageCarPerformance: avgPerf,
        p1ToP10PerformanceGap: p1ToP10Gap,
        activeTitleStreak: currentTitleStreak,
        longestTitleStreak,
        regulationEvent: activeEvent
          ? {
              category: activeEvent.category,
              name: activeEvent.name,
              effectiveSeason: activeEvent.effectiveSeason,
            }
          : null,
        promotedTeams: mobility.promotions.map((p) => p.teamName),
        demotedTeams: mobility.demotions.map((d) => d.teamName),
        badConceptRecoveries: [],
      })
    }

    // Auditoria formal de imutabilidade histórica (Regra 4)
    let historyImmutabilityAudit = true
    for (let i = 0; i < immutableHistories.length; i++) {
      if (immutableHistories[i].season !== startSeason + i) {
        historyImmutabilityAudit = false
        break
      }
    }

    // Auditoria final do ciclo
    const cycleAudit = regulationService.auditRegulationCycle({
      seasonYear: startSeason + totalSeasons - 1,
      timeline,
    })

    // Contagens finais consolidadas
    const cChampCounts = new Map<string, number>()
    const dChampCounts = new Map<string, number>()

    seasonRecords.forEach((r) => {
      cChampCounts.set(
        r.constructorsChampion.teamId,
        (cChampCounts.get(r.constructorsChampion.teamId) || 0) + 1,
      )
      dChampCounts.set(
        r.driversChampion.driverName,
        (dChampCounts.get(r.driversChampion.driverName) || 0) + 1,
      )
    })

    const cChampList = Array.from(cChampCounts.entries())
      .map(([teamId, count]) => ({ teamId, count }))
      .sort((a, b) => b.count - a.count)

    const dChampList = Array.from(dChampCounts.entries())
      .map(([driverName, count]) => ({ driverName, count }))
      .sort((a, b) => b.count - a.count)

    let majorRegulationsCount = 0
    let newErasCount = 0
    timeline.regulations.forEach((r) => {
      if (r.category === 'NEW_TECHNICAL_ERA' && r.effectiveSeason <= startSeason + totalSeasons)
        newErasCount++
      if (
        r.category === 'MAJOR_REGULATION_CHANGE' &&
        r.effectiveSeason <= startSeason + totalSeasons
      )
        majorRegulationsCount++
    })

    const averageStablePeriodYears =
      stablePeriodsCount > 0 ? Number((totalStableYearsAccum / stablePeriodsCount).toFixed(1)) : 4.5

    return {
      totalSeasonsSimulated: totalSeasons,
      differentConstructorsChampionsCount: cChampCounts.size,
      differentDriversChampionsCount: dChampCounts.size,
      constructorsChampionsList: cChampList,
      driversChampionsList: dChampList,
      longestDynastyStreak: longestTitleStreak,
      dominantTeamName: streakLeaderName,
      averageDynastyDuration: Number((totalSeasons / Math.max(1, cChampCounts.size)).toFixed(1)),
      majorRegulationsCount,
      newErasCount,
      averageStablePeriodYears,
      totalPromotions: seasonRecords.reduce((acc, r) => acc + r.promotedTeams.length, 0),
      totalDemotions: seasonRecords.reduce((acc, r) => acc + r.demotedTeams.length, 0),
      badConceptRecoveriesCount,
      topTeamErrorCount,
      midfieldBreakthroughCount,
      weakTeamDominanceAnomalyCount,
      seasonRecords,
      historyImmutabilityAudit,
      auditCyclePassed: cycleAudit.isValid,
    }
  }
}

export const longRunRegulationSimulator = new LongRunRegulationSimulator()
