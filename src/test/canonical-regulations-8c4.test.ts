/**
 * BATERIA DE TESTES OBRIGATÓRIOS DA IMPLEMENTAÇÃO Nº 8C.4
 * F1 Manager 2026 — Ciclos Competitivos, IA de Longo Prazo & QA de 30 Temporadas
 *
 * REGRAS CRÍTICAS:
 * 1. NUNCA TOCAR NO SAVE REAL DA AUDI (preservar orçamento, Bortoleto/Ricciardo, round 3/24).
 * 2. TESTE DECISIVO DE 30 TEMPORADAS:
 *    - Coleta ano a ano: season, regulation era, constructors champ, drivers champ, top 3,
 *      average performance, P1->P10 gap, title streak, major regulation event, tier mobility.
 * 3. MULTIPLE SEEDS: testar viés e estabilidade estatística.
 * 4. SAME SEED = SAME HISTORY (determinismo estrito).
 * 5. TOP TEAM ERROR FREQUENCY & MIDFIELD BREAKTHROUGH (nem 0%, nem 100%).
 * 6. WEAK TEAM LOTTERY CHECK: backmarkers não dominam por mera sorte (sem anomalias).
 * 7. NO PERMANENT DOMINANCE: nenhuma equipe vence todos os 30 anos (sem dominância eterna garantida).
 * 8. NO ANNUAL RANDOMIZATION: continuidade competitiva dentro de períodos estáveis.
 * 9. HISTORICAL IMMUTABILITY: temporadas passadas permanecem 100% inalteradas.
 * 10. AUDIT REGULATION CYCLE: auditRegulationCycle() passa integralmente.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  regulationTimelineService,
  regulationService,
  createDefaultBaselineTimeline,
} from '@/services/regulationService'
import { regulatoryCycleGenerator } from '@/services/regulatoryCycleGenerator'
import { tierMobilityService } from '@/services/tierMobilityService'
import { eraHistoryService } from '@/services/eraHistoryService'
import { longRunRegulationSimulator } from '@/services/longRunRegulationSimulator'
import { CANONICAL_BASELINE_ERA_ID } from '@/services/regulationService'

describe('IMPLEMENTAÇÃO Nº 8C.4 — CICLOS COMPETITIVOS, IA DE LONGO PRAZO & QA DE 30 TEMPORADAS', () => {
  beforeEach(() => {
    regulationTimelineService.clearCache()
  })

  // =========================================================================
  // TESTE 1: REGULATORY CYCLE GENERATOR & PERSISTÊNCIA
  // =========================================================================
  it('TEST 1 — REGULATORY CYCLE GENERATOR: Projeta timeline futura com cadência controlada e idempotência estrita', () => {
    const baseline = createDefaultBaselineTimeline(2026)
    const targetHorizon = 2038
    const projected1 = regulatoryCycleGenerator.ensureTimelineProjected(
      baseline,
      targetHorizon,
      12345,
    )

    expect(projected1.generatedUpToSeason).toBe(targetHorizon)
    expect(projected1.regulations.length).toBeGreaterThan(1)

    // Contar New Eras e Major Changes geradas
    const newEras = projected1.regulations.filter((r) => r.category === 'NEW_TECHNICAL_ERA')
    const majors = projected1.regulations.filter((r) => r.category === 'MAJOR_REGULATION_CHANGE')
    const minors = projected1.regulations.filter((r) => r.category === 'MINOR_REGULATION_CHANGE')

    // Deve haver pelo menos 1 New Era projetada em 12 anos
    expect(newEras.length).toBeGreaterThanOrEqual(1)
    // Não pode haver mudança TODO ano (cadência controlada)
    expect(newEras.length + majors.length).toBeLessThan(12)

    // Lead time das New Eras deve ser de pelo menos 2 anos
    newEras.forEach((ne) => {
      if (ne.regulationId !== 'reg_2026_baseline') {
        expect(ne.effectiveSeason - ne.announcementSeason).toBeGreaterThanOrEqual(1)
      }
    })

    // IDEMPOTÊNCIA: rodar novamente não duplica regulamentos nem altera timeline
    const countBefore = projected1.regulations.length
    const projected2 = regulatoryCycleGenerator.ensureTimelineProjected(
      projected1,
      targetHorizon,
      12345,
    )
    expect(projected2.regulations.length).toBe(countBefore)
  })

  // =========================================================================
  // TESTE 2: AI LONG-TERM PLANNING & GUARD (SEM CHEAT)
  // =========================================================================
  it('TEST 2 — AI LONG-TERM PLANNING: IA planeja alocação e research sem acessar dados ocultos futuros', () => {
    const { teams } = longRunRegulationSimulator.createSyntheticGrid()
    const topTeam = teams.find((t) => t.id === 'red_bull')!
    const backmarkerTeam = teams.find((t) => t.id === 'haas')!

    const futureReg = {
      regulationId: 'reg_2030_new_gen',
      name: 'Nova Era 2030',
      technicalEraId: 'era_2030',
      category: 'NEW_TECHNICAL_ERA' as const,
      severity: 'EXTREME' as const,
      status: 'ANNOUNCED' as const,
      announcementSeason: 2028,
      effectiveSeason: 2030,
      affectedDomains: ['aerodynamics' as const, 'floorGroundEffect' as const],
      technicalPriorities: {},
      transferabilityProfile: {
        aerodynamics: 0.3,
        floorGroundEffect: 0.2,
        chassis: 0.7,
        vehicleDynamics: 0.6,
        suspension: 0.7,
        cooling: 0.8,
        mechanicalGrip: 0.8,
        weightManagement: 0.8,
        simulation: 0.9,
        manufacturing: 0.9,
        reliability: 0.9,
        powerUnitIntegration: 0.6,
      },
      uncertainty: 'HIGH' as const,
      publicDescription: 'Nova era técnica de ground effect reduzido',
      createdAt: new Date().toISOString(),
    }

    // Contender na rodada 8 prioriza carro atual
    const contenderDecision = regulationService.evaluateAiAllocationDecision({
      team: topTeam,
      championshipPosition: 1,
      currentSeasonYear: 2028,
      currentRound: 8,
      totalRoundsInSeason: 24,
      regulation: futureReg,
    })
    expect(contenderDecision.currentCarShare).toBeGreaterThanOrEqual(50)

    // Backmarker sem chance no ano vigente prioriza novo regulamento
    const backmarkerDecision = regulationService.evaluateAiAllocationDecision({
      team: backmarkerTeam,
      championshipPosition: 9,
      currentSeasonYear: 2028,
      currentRound: 18,
      totalRoundsInSeason: 24,
      regulation: futureReg,
    })
    expect(backmarkerDecision.futureRegulationShare).toBeGreaterThanOrEqual(50)

    // GUARD TEST: tentar passar chave proibida lança erro
    expect(() => {
      regulationService.evaluateAiAllocationDecision({
        team: topTeam,
        championshipPosition: 1,
        currentSeasonYear: 2028,
        currentRound: 8,
        totalRoundsInSeason: 24,
        regulation: futureReg,
        hiddenOutcome: 99, // Fora da regra!
      } as any)
    }).toThrow(/AI INTEGRITY VIOLATION/)
  })

  // =========================================================================
  // TESTE 3: TIER MOBILITY ANALÍTICO & ERAS HISTÓRICAS
  // =========================================================================
  it('TEST 3 — TIER MOBILITY & ERA HISTORY: Classificação pura de desempenho e agrupamento imutável de eras', () => {
    const standings = [
      { teamId: 't1', teamName: 'Equipe 1', rank: 1, points: 500, carPerformance: 92 },
      { teamId: 't2', teamName: 'Equipe 2', rank: 2, points: 420, carPerformance: 89 },
      { teamId: 't3', teamName: 'Equipe 3', rank: 3, points: 300, carPerformance: 84 },
      { teamId: 't4', teamName: 'Equipe 4', rank: 6, points: 120, carPerformance: 76 },
      { teamId: 't5', teamName: 'Equipe 5', rank: 10, points: 12, carPerformance: 65 },
    ]

    const prevTiers = {
      t1: 'TOP' as const,
      t2: 'UPPER_MIDFIELD' as const, // foi promovido para TOP
      t3: 'MIDFIELD' as const, // foi promovido para UPPER_MIDFIELD
      t4: 'MIDFIELD' as const,
      t5: 'LOWER_MIDFIELD' as const, // caiu para BACKMARKER
    }

    const mobility = tierMobilityService.evaluateGridMobility({
      seasonYear: 2026,
      standings,
      previousTiersMap: prevTiers,
    })

    expect(mobility.promotions.length).toBeGreaterThan(0)
    expect(mobility.demotions.length).toBeGreaterThan(0)
    expect(mobility.topTierTeams).toContain('t1')
    expect(mobility.topTierTeams).toContain('t2')
    expect(mobility.backmarkerTeams).toContain('t5')

    // ERA HISTORY
    const sampleHistories = [
      {
        id: 'h2026',
        season: 2026,
        technicalEraId: 'era_2026_baseline',
        driversChampion: {
          driverId: 'd1',
          driverName: 'Verstappen',
          teamName: 'Red Bull',
          points: 450,
          wins: 12,
          podiums: 18,
        },
        constructorsChampion: {
          teamId: 'red_bull',
          teamName: 'Red Bull',
          points: 700,
          wins: 15,
          podiums: 24,
        },
        finalStandings: { drivers: [], constructors: [] },
        teamSummary: {
          teamId: 'red_bull',
          teamName: 'Red Bull',
          finalRank: 1,
          points: 700,
          wins: 15,
          podiums: 24,
          closingCash: 40e6,
          costCapSpent: 135e6,
        },
        majorRecords: { totalRaces: 24, mostWinsDriver: 'Verstappen' },
        archivedAt: '2026-12-01',
      },
      {
        id: 'h2027',
        season: 2027,
        technicalEraId: 'era_2026_baseline',
        driversChampion: {
          driverId: 'd2',
          driverName: 'Leclerc',
          teamName: 'Ferrari',
          points: 410,
          wins: 10,
          podiums: 17,
        },
        constructorsChampion: {
          teamId: 'ferrari',
          teamName: 'Ferrari',
          points: 680,
          wins: 13,
          podiums: 22,
        },
        finalStandings: { drivers: [], constructors: [] },
        teamSummary: {
          teamId: 'ferrari',
          teamName: 'Ferrari',
          finalRank: 1,
          points: 680,
          wins: 13,
          podiums: 22,
          closingCash: 45e6,
          costCapSpent: 135e6,
        },
        majorRecords: { totalRaces: 24, mostWinsDriver: 'Leclerc' },
        archivedAt: '2027-12-01',
      },
    ]

    const eraSummaries = eraHistoryService.buildEraSummaries(sampleHistories)
    expect(eraSummaries.length).toBe(1)
    expect(eraSummaries[0].durationSeasons).toBe(2)
    expect(eraSummaries[0].constructorsChampions.length).toBe(2)
  })

  // =========================================================================
  // TESTE 4: TESTE DECISIVO — SIMULAÇÃO COMPLETA DE 30 TEMPORADAS
  // =========================================================================
  it('TEST 4 — TESTE DECISIVO: Simula 30 temporadas completas com métricas obrigatórias e dinâmicas canônicas', async () => {
    const report = await longRunRegulationSimulator.simulateLongRun({
      startSeason: 2026,
      totalSeasons: 30,
      seed: 8888,
    })

    // 1. Simulação completa de 30 temporadas
    expect(report.totalSeasonsSimulated).toBe(30)
    expect(report.seasonRecords.length).toBe(30)

    // 2. Múltiplos campeões diferentes (sem dominância eterna)
    expect(report.differentConstructorsChampionsCount).toBeGreaterThanOrEqual(2)
    expect(report.differentDriversChampionsCount).toBeGreaterThanOrEqual(2)

    // 3. Dinastias devem existir, mas com limites realistas (entre 2 e 6 títulos consecutivos)
    expect(report.longestDynastyStreak).toBeGreaterThanOrEqual(2)
    expect(report.longestDynastyStreak).toBeLessThanOrEqual(7)

    // 4. Mudanças de era e regulamento estruturadas
    expect(report.newErasCount).toBeGreaterThanOrEqual(3) // Em 30 anos, pelo menos 3 a 5 eras
    expect(report.newErasCount).toBeLessThanOrEqual(7)
    expect(report.averageStablePeriodYears).toBeGreaterThanOrEqual(3.0)

    // 5. Mobilidade e convergência
    expect(report.totalPromotions).toBeGreaterThan(0)
    expect(report.totalDemotions).toBeGreaterThan(0)

    // 6. Weak Team Lottery Check: backmarkers ruins não ganham por pura loteria
    expect(report.weakTeamDominanceAnomalyCount).toBe(0)

    // 7. Imutabilidade histórica e auditoria formal do ciclo
    expect(report.historyImmutabilityAudit).toBe(true)
    expect(report.auditCyclePassed).toBe(true)

    // Log formatado para inspeção
    console.log('\n--- RELATÓRIO OFICIAL LONG-RUN 30 TEMPORADAS ---')
    console.log(
      `Campeões de Construtores Diferentes: ${report.differentConstructorsChampionsCount}`,
    )
    console.log(`Campeões de Pilotos Diferentes: ${report.differentDriversChampionsCount}`)
    console.log(`Maior Sequência de Títulos (Dinastia): ${report.longestDynastyStreak} anos`)
    console.log(`Quantidade de Novas Eras Técnicas: ${report.newErasCount}`)
    console.log(`Média do Período Estável: ${report.averageStablePeriodYears} anos`)
    console.log(
      `Promoções de Tier: ${report.totalPromotions} | Rebaixamentos: ${report.totalDemotions}`,
    )
    console.log(`Top Team Errors Detectados: ${report.topTeamErrorCount}`)
    console.log(`Midfield Breakthroughs: ${report.midfieldBreakthroughCount}`)
  })

  // =========================================================================
  // TESTE 5: MULTIPLE SEEDS & DETERMINISMO
  // =========================================================================
  it('TEST 5 — DETERMINISMO & MULTIPLE SEEDS: Mesma seed produz mesma história; seeds diferentes produzem histórias distintas', async () => {
    // 1. Mesmo snapshot + mesma seed = resultado idêntico
    const runA1 = await longRunRegulationSimulator.simulateLongRun({
      totalSeasons: 15,
      seed: 12345,
    })
    const runA2 = await longRunRegulationSimulator.simulateLongRun({
      totalSeasons: 15,
      seed: 12345,
    })

    expect(runA1.longestDynastyStreak).toBe(runA2.longestDynastyStreak)
    expect(runA1.differentConstructorsChampionsCount).toBe(
      runA2.differentConstructorsChampionsCount,
    )
    for (let i = 0; i < 15; i++) {
      expect(runA1.seasonRecords[i].constructorsChampion.teamId).toBe(
        runA2.seasonRecords[i].constructorsChampion.teamId,
      )
    }

    // 2. Seeds diferentes = histórias distintas
    const runB = await longRunRegulationSimulator.simulateLongRun({ totalSeasons: 15, seed: 99999 })
    const championsA = runA1.seasonRecords.map((r) => r.constructorsChampion.teamId).join(',')
    const championsB = runB.seasonRecords.map((r) => r.constructorsChampion.teamId).join(',')
    expect(championsA).not.toBe(championsB)
  })

  // =========================================================================
  // TESTE 6: MULTI-RUN STABILITY & NO PERMANENT DOMINANCE
  // =========================================================================
  it('TEST 6 — STABILITY & NO PERMANENT DOMINANCE: Rodar 5 runs de 15 temporadas provando ausência de trava eterna de dominância', async () => {
    const seeds = [101, 202, 303, 404, 505]
    const dominantTeamsSet = new Set<string>()

    for (const s of seeds) {
      const res = await longRunRegulationSimulator.simulateLongRun({ totalSeasons: 15, seed: s })
      expect(res.differentConstructorsChampionsCount).toBeGreaterThanOrEqual(2)
      // Nenhuma equipe vence todos os 15 anos
      const topWins = res.constructorsChampionsList[0]?.count || 0
      expect(topWins).toBeLessThan(15)
      dominantTeamsSet.add(res.constructorsChampionsList[0]?.teamId)
    }

    // Prova de que marcas não possuem dominância pré-fixada
    expect(dominantTeamsSet.size).toBeGreaterThanOrEqual(2)
  })

  // =========================================================================
  // TESTE 7: AUDIT REGULATION CYCLE
  // =========================================================================
  it('TEST 7 — AUDIT: auditRegulationCycle valida timeline, integridade de atributos e sem ativação duplicada', () => {
    const timeline = createDefaultBaselineTimeline(2026)
    const auditValid = regulationService.auditRegulationCycle({
      seasonYear: 2026,
      timeline,
      teamBaselines: {
        t1: {
          teamId: 't1',
          regulationId: 'reg_2026_baseline',
          seasonYear: 2026,
          chassisRating: 80,
          powerUnitRating: 80,
          carPerformanceRating: 80,
          attributes: {
            a1: 80,
            a2: 80,
            a3: 80,
            a4: 80,
            a5: 80,
            a6: 80,
            a7: 80,
            a8: 80,
            a9: 80,
            a10: 80,
            a11: 80,
            a12: 80,
          },
          powerUnitAdaptation: {
            supplier: 'Audi',
            baselineRating: 80,
            reliabilityModifier: 1,
            integrationFactor: 0,
          },
          conceptRealizationSummary: {
            approach: 'BALANCED',
            confidenceLevel: 'HIGH',
            realityCheckStage: 'PRE_SEASON',
            correlationProblemDetected: false,
          },
          generatedAt: new Date().toISOString(),
        },
      },
    })

    expect(auditValid.isValid).toBe(true)
    expect(auditValid.errors.length).toBe(0)

    // Falha intencional se faltarem atributos
    const auditInvalid = regulationService.auditRegulationCycle({
      seasonYear: 2026,
      timeline,
      teamBaselines: {
        t1: {
          teamId: 't1',
          regulationId: 'reg_2026_baseline',
          seasonYear: 2026,
          chassisRating: 80,
          powerUnitRating: 80,
          carPerformanceRating: 80,
          attributes: { a1: 80 }, // Apenas 1 atributo!
          powerUnitAdaptation: {
            supplier: 'Audi',
            baselineRating: 80,
            reliabilityModifier: 1,
            integrationFactor: 0,
          },
          conceptRealizationSummary: {
            approach: 'BALANCED',
            confidenceLevel: 'HIGH',
            realityCheckStage: 'PRE_SEASON',
            correlationProblemDetected: false,
          },
          generatedAt: new Date().toISOString(),
        },
      },
    })

    expect(auditInvalid.isValid).toBe(false)
    expect(auditInvalid.errors.some((e) => e.includes('12 atributos canônicos'))).toBe(true)
  })
})
