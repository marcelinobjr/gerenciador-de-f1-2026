/**
 * teamPerformanceBaselineAuditService.ts
 *
 * Módulo de Auditoria Canônica do Baseline de Desempenho 2026 (FC02D — FASE A).
 * Executa simulações Monte Carlo (Qualificação e Corrida) consumindo a engine canônica existente
 * (calculateCombinedPace, canonicalRaceEngineService, carTechnicalService, resolveCircuitProfile, Mulberry32 determinístico)
 * SEM mockar dados, SEM alterar ratings nem comportamento do RNG, e SEM introduzir scripts arbitrários.
 *
 * Hierarquia Alvo 2026:
 * - Grupo A: Mercedes, Ferrari, McLaren, Red Bull
 * - Grupo B: Racing Bulls, Alpine, Audi
 * - Grupo C: Haas, Williams, Aston Martin
 * - Grupo D: Cadillac, Andretti
 *
 * Regra do Usuário: Audi > Haas (em ritmo médio).
 * Williams e Andretti não podem ter ritmo médio de top-3.
 */

import { OFFICIAL_GRID_TEAMS, OfficialGridTeam } from '@/lib/f1-data'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'
import { calculateCombinedPace } from '@/lib/f1-pace-model'
import { carTechnicalService } from '@/services/carTechnicalService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { raceStrategyService } from '@/services/raceStrategyService'
import { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'

export interface TeamBaselineStats {
  teamKey: string
  teamName: string
  engineSupplier: string
  chassisRating: number
  puRating: number
  effectivePuRating?: number
  effectiveIntegration?: number
  puRelationshipType?: string
  carPerfRating: number
  targetGroup: 'A' | 'B' | 'C' | 'D'
  // Métricas de Qualificação
  avgGridPosition: number
  medianGridPosition?: number
  poleCount: number
  polePercentage: number
  top3GridCount: number
  top3GridPercentage: number
  top10GridCount: number
  top10GridPercentage: number
  q3Rate?: number // alias/percentual de Q3 (top10 grid)
  // Métricas de Corrida
  avgFinishPosition: number
  medianFinishPosition?: number
  winCount: number
  winPercentage: number
  podiumCount: number
  podiumPercentage: number
  top10FinishCount: number
  top10FinishPercentage: number
  pointsRate?: number // percentual de corridas pontuando
  avgPointsPerRace: number
  totalPoints: number
  dnfCount: number
  dnfPercentage: number
}

export interface TargetHierarchyFinding {
  rule: string
  status: 'SATISFIED' | 'DIVERGENT'
  actualValue: string
  expectedTarget: string
  detail: string
}

export interface TeamPerformanceBaselineReport {
  generatedAt: string
  phase: 'FASE_A_BEFORE' | 'FASE_B_AFTER'
  seed: number
  totalQualifyingSimulations: number
  totalRaceSimulations: number
  teamsCount: number
  totalDriversCount: number
  targetHierarchy: {
    groupA: string[]
    groupB: string[]
    groupC: string[]
    groupD: string[]
    specialRules: string[]
  }
  teamsStats: TeamBaselineStats[]
  findings: TargetHierarchyFinding[]
  summaryText: string
}

export interface RunBaselineAuditOptions {
  seed?: number
  qualifyingIterations?: number
  raceIterations?: number
  circuitRound?: number
  totalRaceLaps?: number
  phase?: 'FASE_A_BEFORE' | 'FASE_B_AFTER'
}

export interface AudiHaasCircuitAudit {
  circuitName: string
  circuitType: 'power' | 'technical' | 'balanced'
  audiAheadQualyRate: number
  audiAheadRaceRate: number
  avgQualyDeltaSec: number // positivo se Audi mais rápida (lapTime Haas - lapTime Audi)
  avgRaceDeltaSec: number
}

export interface AudiHaasIsolationAudit {
  normalizedDrivers: {
    audiAheadQualyRate: number
    audiAheadRaceRate: number
    avgQualyDeltaSec: number
    avgRaceDeltaSec: number
  }
  normalizedCars: {
    audiAheadQualyRate: number
    audiAheadRaceRate: number
    avgQualyDeltaSec: number
    avgRaceDeltaSec: number
  }
}

export interface AudiHaasBalanceAuditReport {
  simulations: number
  seed: number
  audiAheadRate: number // percentual em corridas
  haasAheadRate: number // percentual em corridas
  audiAheadQualyRate: number // percentual em quali
  haasAheadQualyRate: number // percentual em quali
  avgRaceDeltaSec: number // positivo: Audi chega à frente / menor raceTime
  avgQualifyingDeltaSec: number // positivo: Audi qualifica com menor lapTime (Haas - Audi)
  avgRaceTimeDeltaPerLapSec: number // delta médio por volta em segundos
  carPerformanceDelta: number // carPerformance Audi - carPerformance Haas
  chassisDelta: number // chassisRating Audi - chassisRating Haas
  effectivePUDelta: number // effective PU Audi - effective PU Haas
  driverCompositeDelta: number // composite Audi drivers - composite Haas drivers
  directTeamBonuses: 0
  duplicatePUMultipliers: 0
  rngOverrides: 0
  qualyDistribution: {
    audiMeanPosition: number
    haasMeanPosition: number
    audiMedianPosition: number
    haasMedianPosition: number
    audiP10: number
    audiP50: number
    audiP90: number
    haasP10: number
    haasP50: number
    haasP90: number
  }
  raceDistribution: {
    audiMeanPosition: number
    haasMeanPosition: number
    audiMedianPosition: number
    haasMedianPosition: number
    audiP10: number
    audiP50: number
    audiP90: number
    haasP10: number
    haasP50: number
    haasP90: number
  }
  inversionFrequency: number // Haas ahead rate (sobreposição probabilística)
  circuits?: AudiHaasCircuitAudit[]
  isolation?: AudiHaasIsolationAudit
}

export class TeamPerformanceBaselineAuditService {
  /**
   * Mulberry32 determinístico e seedável
   */
  public createRng(seed: number): () => number {
    let t = (seed += 0x6d2b79f5)
    return () => {
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  /**
   * Resolução do contexto técnico canônico de cada equipe oficial
   */
  public resolveTeamContext(officialTeam: OfficialGridTeam) {
    const techData = carTechnicalService.getOrCreateTeamTechnicalData(
      officialTeam.key,
      officialTeam.strengthRating || officialTeam.strength,
      officialTeam.engine,
    )
    const chassis = techData.calculatedOverall
    const supplier = officialTeam.engine || 'Ferrari'
    const pu = OFFICIAL_POWER_UNITS[supplier] || OFFICIAL_POWER_UNITS.Ferrari
    const puRating = Number((pu.powerRating * 0.6 + pu.reliabilityRating * 0.4).toFixed(1))
    // PU-INTEGRATION: PU efetiva canônica via canonicalPowerUnitIntegrationService
    // Audi+Audi = FACTORY (teto 1.00); Haas = Ferrari CUSTOMER (teto 0.90)
    const puState = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId: 'baseline_audit_career',
      seasonYear: 2026,
      teamId: officialTeam.key,
      supplierId: supplier as any,
    })
    const effectivePU = canonicalPowerUnitIntegrationService.resolveEffectivePUPerformance({
      supplierId: supplier as any,
      effectiveIntegration: puState.effectiveIntegration,
      relationshipType: puState.relationshipType,
    })
    // Car performance usa PU efetiva
    const carPerf = Number((chassis * 0.7 + effectivePU.effectivePuRating * 0.3).toFixed(1))
    const targetGroup = this.resolveTargetGroup(officialTeam.key)

    return {
      teamKey: officialTeam.key,
      teamName: officialTeam.name,
      engineSupplier: supplier,
      chassisRating: chassis,
      puRating,
      effectivePuRating: effectivePU.effectivePuRating,
      effectiveIntegration: puState.effectiveIntegration,
      puRelationshipType: puState.relationshipType,
      carPerfRating: carPerf,
      targetGroup,
      attributes: techData.attributes,
      reliability: techData.attributes?.reliability ?? 80,
      driver1: officialTeam.driver1,
      driver2: officialTeam.driver2,
      color: officialTeam.color,
    }
  }

  public resolveTargetGroup(teamKey: string): 'A' | 'B' | 'C' | 'D' {
    if (['mercedes', 'ferrari', 'mclaren', 'redbull'].includes(teamKey)) return 'A'
    if (['racingbulls', 'alpine', 'audi'].includes(teamKey)) return 'B'
    if (['haas', 'williams', 'astonmartin'].includes(teamKey)) return 'C'
    return 'D'
  }

  /**
   * Executa uma qualificação canônica completa com os 24 pilotos oficiais
   */
  public simulateOneQualifying(params: {
    teams: Array<ReturnType<TeamPerformanceBaselineAuditService['resolveTeamContext']>>
    circuitProfile: any
    rng: () => number
  }): Array<{
    teamKey: string
    driverName: string
    driverId: string
    gridPosition: number
    lapTimeSec: number
  }> {
    const { teams, circuitProfile, rng } = params

    // Montar os 24 pilotos com pace canônico modulado pelo RNG (noise Box-Muller)
    const driverLaps: Array<{
      teamKey: string
      driverName: string
      driverId: string
      lapTimeSec: number
    }> = []

    for (const t of teams) {
      // Driver 1
      const u1 = Math.max(0.00001, rng())
      const u2 = rng()
      const noise1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * 0.2

      const pace1 = calculateCombinedPace({
        teamStrength: t.chassisRating,
        carLevel: t.chassisRating,
        driver: {
          speed: t.driver1.speed,
          consistency: t.driver1.consistency,
          defense: t.driver1.defense,
          rain: t.driver1.rain,
          morale: 80,
          physicalCondition: 90,
        },
        weather: 'seco',
        tireCompound: 'macio',
        lapsOnTire: 0,
        wearPercent: 0,
        isQualifying: true,
        technicalAttributes: t.attributes,
        circuit: circuitProfile,
        chassisRating: t.chassisRating,
        powerUnitRating: t.effectivePuRating ?? t.puRating,
        carPerformanceRating: t.carPerfRating,
        trackAbrasiveness: 6,
        noise: noise1,
      })

      driverLaps.push({
        teamKey: t.teamKey,
        driverName: t.driver1.name,
        driverId: `${t.teamKey}_d1`,
        lapTimeSec: pace1.lapTimeSec,
      })

      // Driver 2
      const u3 = Math.max(0.00001, rng())
      const u4 = rng()
      const noise2 = Math.sqrt(-2.0 * Math.log(u3)) * Math.cos(2.0 * Math.PI * u4) * 0.2

      const pace2 = calculateCombinedPace({
        teamStrength: t.chassisRating,
        carLevel: t.chassisRating,
        driver: {
          speed: t.driver2.speed,
          consistency: t.driver2.consistency,
          defense: t.driver2.defense,
          rain: t.driver2.rain,
          morale: 80,
          physicalCondition: 90,
        },
        weather: 'seco',
        tireCompound: 'macio',
        lapsOnTire: 0,
        wearPercent: 0,
        isQualifying: true,
        technicalAttributes: t.attributes,
        circuit: circuitProfile,
        chassisRating: t.chassisRating,
        powerUnitRating: t.effectivePuRating ?? t.puRating,
        carPerformanceRating: t.carPerfRating,
        trackAbrasiveness: 6,
        noise: noise2,
      })

      driverLaps.push({
        teamKey: t.teamKey,
        driverName: t.driver2.name,
        driverId: `${t.teamKey}_d2`,
        lapTimeSec: pace2.lapTimeSec,
      })
    }

    // Ordenar estritamente por menor lapTimeSec (P1 a P24)
    driverLaps.sort((a, b) => a.lapTimeSec - b.lapTimeSec)

    return driverLaps.map((d, idx) => ({
      ...d,
      gridPosition: idx + 1,
    }))
  }

  /**
   * Executa uma corrida canônica completa consumindo canonicalRaceEngineService.advanceMultipleLaps
   */
  public simulateOneRace(params: {
    teams: Array<ReturnType<TeamPerformanceBaselineAuditService['resolveTeamContext']>>
    qualyResult: Array<{
      teamKey: string
      driverName: string
      driverId: string
      gridPosition: number
      lapTimeSec: number
    }>
    circuitProfile: any
    totalLaps: number
    seed: number
  }): Array<{
    teamKey: string
    driverName: string
    driverId: string
    gridPosition: number
    finishPosition: number
    points: number
    isDnf: boolean
    dnfReason?: string
  }> {
    const { teams, qualyResult, circuitProfile, totalLaps, seed } = params

    // Montar o estado inicial da corrida canônica CanonicalRaceState
    const teamLookup = new Map(teams.map((t) => [t.teamKey, t]))

    const drivers: CanonicalRaceDriverState[] = qualyResult.map((q) => {
      const t = teamLookup.get(q.teamKey)!
      const carSlot = q.driverId.endsWith('_d1') ? 'car1' : 'car2'
      const strat = raceStrategyService.createDefaultDriverStrategy({
        driverId: q.driverId,
        startingCompound: 'medio',
        totalLaps,
        carSlot,
        stintPlanOffset: carSlot === 'car2' ? 6 : 0,
      })

      return {
        careerId: 'baseline_audit_career',
        season: 2026,
        raceId: `baseline_race_${seed}`,
        driverId: q.driverId,
        teamId: q.teamKey,
        gridPosition: q.gridPosition,
        currentPosition: q.gridPosition,
        lap: 0,
        raceTime: 0.0,
        gap: q.gridPosition === 1 ? 'LÍDER' : '+0.000s',
        tyreCompound: 'medio',
        tyreAge: 0,
        fuel: 100.0,
        carCondition: 100,
        raceStatus: 'racing',
        pitStops: 0,
        driverName: q.driverName,
        teamName: t.teamName,
        teamColor: t.color,
        isPlayer: false,
        carId: carSlot,
        bestLapSec: q.lapTimeSec,
        strategy: strat,
      }
    })

    const driverLookup: Record<string, CanonicalRaceDriverState> = {}
    drivers.forEach((d) => {
      driverLookup[d.driverId] = d
    })

    const initialRaceControl = {
      currentFlag: 'GREEN' as const,
      previousFlag: undefined,
      lapsRemainingInPhase: 0,
      activeSector: undefined,
      safetyCarLaps: 0,
      vscLaps: 0,
      redFlagLaps: 0,
      scQueuedOrder: [],
      restartPending: false,
      activeEvents: [],
      history: [],
      lastIncidentReason: undefined,
    }

    const initialRaceState: CanonicalRaceState = {
      version: '2.0',
      saveSchemaVersion: 'race-save-v1',
      careerId: 'baseline_audit_career',
      season: 2026,
      round: circuitProfile.round || 1,
      raceId: `baseline_race_${seed}`,
      circuitName: circuitProfile.circuitName || 'Circuito Neutro',
      circuitCountry: 'Internacional',
      totalLaps,
      currentLap: 1,
      status: 'not_started',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      weather: 'seco',
      simSpeed: 1,
      startedAt: undefined,
      completedAt: undefined,
      drivers,
      driverLookup,
      playerTeamId: 'mercedes',
      tactics: {},
      paceOrders: {},
      driverStrategies: {},
      raceControl: initialRaceControl,
      revision: 1,
      updatedAt: new Date().toISOString(),
      raceSeed: seed,
    }

    // Avançar todas as voltas via engine canônica
    const finishedState = canonicalRaceEngineService.advanceMultipleLaps(
      initialRaceState,
      totalLaps,
      {
        tireAbrasiveness: 6,
        seedOverride: seed,
      },
    )

    // Oficializar resultado via canonicalRaceResultService
    const officialResult = canonicalRaceResultService.officializeRace(finishedState)

    // Mapear resultado para cada piloto a partir de officialResult.entries
    return officialResult.entries.map((entry) => {
      const q = qualyResult.find((dr) => dr.driverId === entry.driverId)
      return {
        teamKey: entry.teamId,
        driverName: entry.driverName,
        driverId: entry.driverId,
        gridPosition: q?.gridPosition ?? entry.gridPosition,
        finishPosition: entry.finalPosition,
        points: entry.pointsAwarded,
        isDnf: entry.dnf,
        dnfReason: entry.dnfReason,
      }
    })
  }

  /**
   * Executa a auditoria Monte Carlo completa (Fase A)
   */
  public runBaselineAudit(options: RunBaselineAuditOptions = {}): TeamPerformanceBaselineReport {
    const seed = options.seed ?? 20260315
    const qIters = options.qualifyingIterations ?? 1000
    const rIters = options.raceIterations ?? 1000
    const currentRound = options.circuitRound ?? 1
    const totalRaceLaps = options.totalRaceLaps ?? 30 // laps suficientes para estratégia de pit e degradação física
    const phase = options.phase ?? 'FASE_A_BEFORE'

    const rng = this.createRng(seed)
    const circuitProfile = resolveCircuitProfile({ round: currentRound })

    // Resolver os 12 times oficiais de 2026
    const teams = OFFICIAL_GRID_TEAMS.map((t) => this.resolveTeamContext(t))

    // Estruturas de agregação por equipe
    const teamAggregates = new Map<
      string,
      {
        gridPositionsSum: number
        gridPositionsList: number[]
        poleCount: number
        top3GridCount: number
        top10GridCount: number
        // Corrida
        finishPositionsSum: number
        finishPositionsList: number[]
        winCount: number
        podiumCount: number
        top10FinishCount: number
        pointsRacesCount: number
        totalPoints: number
        dnfCount: number
      }
    >()

    teams.forEach((t) => {
      teamAggregates.set(t.teamKey, {
        gridPositionsSum: 0,
        gridPositionsList: [],
        poleCount: 0,
        top3GridCount: 0,
        top10GridCount: 0,
        finishPositionsSum: 0,
        finishPositionsList: [],
        winCount: 0,
        podiumCount: 0,
        top10FinishCount: 0,
        pointsRacesCount: 0,
        totalPoints: 0,
        dnfCount: 0,
      })
    })

    // 1. Monte Carlo: Simular Qualificações e Corridas
    // Para manter correlação natural qualificação -> corrida, cada iteração R roda após ou em conjunto com Q
    const maxIters = Math.max(qIters, rIters)

    for (let i = 0; i < maxIters; i++) {
      const qResult = this.simulateOneQualifying({
        teams,
        circuitProfile,
        rng,
      })

      // Contabilizar métricas de qualificação se ainda dentro do limite de qIters
      if (i < qIters) {
        for (const qEntry of qResult) {
          const agg = teamAggregates.get(qEntry.teamKey)!
          agg.gridPositionsSum += qEntry.gridPosition
          agg.gridPositionsList.push(qEntry.gridPosition)
          if (qEntry.gridPosition === 1) agg.poleCount += 1
          if (qEntry.gridPosition <= 3) agg.top3GridCount += 1
          if (qEntry.gridPosition <= 10) agg.top10GridCount += 1
        }
      }

      // Contabilizar métricas de corrida se ainda dentro do limite de rIters
      if (i < rIters) {
        const iterSeed = (seed + i * 1009) >>> 0
        const rResult = this.simulateOneRace({
          teams,
          qualyResult: qResult,
          circuitProfile,
          totalLaps: totalRaceLaps,
          seed: iterSeed,
        })

        // Rastrear se a equipe pontuou nesta corrida
        const raceTeamPoints = new Map<string, number>()

        for (const rEntry of rResult) {
          const agg = teamAggregates.get(rEntry.teamKey)!
          agg.finishPositionsSum += rEntry.finishPosition
          agg.finishPositionsList.push(rEntry.finishPosition)
          agg.totalPoints += rEntry.points
          if (rEntry.finishPosition === 1) agg.winCount += 1
          if (rEntry.finishPosition <= 3) agg.podiumCount += 1
          if (rEntry.finishPosition <= 10) agg.top10FinishCount += 1
          if (rEntry.isDnf) agg.dnfCount += 1

          const currentP = raceTeamPoints.get(rEntry.teamKey) || 0
          raceTeamPoints.set(rEntry.teamKey, currentP + rEntry.points)
        }

        for (const [tKey, pts] of raceTeamPoints.entries()) {
          if (pts > 0) {
            teamAggregates.get(tKey)!.pointsRacesCount += 1
          }
        }
      }
    }

    // 2. Consolidar estatísticas por equipe
    // Cada equipe tem 2 carros no grid!
    // Total de entradas da equipe = iterações * 2 pilotos
    const qEntriesPerTeam = qIters * 2
    const rEntriesPerTeam = rIters * 2

    const teamsStats: TeamBaselineStats[] = teams.map((t) => {
      const agg = teamAggregates.get(t.teamKey)!

      const avgGridPosition = Number((agg.gridPositionsSum / qEntriesPerTeam).toFixed(2))
      const sortedGrids = [...agg.gridPositionsList].sort((a, b) => a - b)
      const medianGridPosition =
        sortedGrids.length > 0
          ? sortedGrids.length % 2 === 0
            ? Number(
                (
                  (sortedGrids[sortedGrids.length / 2 - 1] + sortedGrids[sortedGrids.length / 2]) /
                  2
                ).toFixed(2),
              )
            : sortedGrids[Math.floor(sortedGrids.length / 2)]
          : avgGridPosition

      const polePercentage = Number(((agg.poleCount / qIters) * 100).toFixed(2))
      const top3GridPercentage = Number(((agg.top3GridCount / (qIters * 3)) * 100).toFixed(2))
      const top10GridPercentage = Number(((agg.top10GridCount / (qIters * 10)) * 100).toFixed(2))
      // Q3 rate: taxa de participações de carros no top 10 do grid (relativo ao total de carros da equipe)
      const q3Rate = Number(((agg.top10GridCount / qEntriesPerTeam) * 100).toFixed(2))

      const avgFinishPosition = Number((agg.finishPositionsSum / rEntriesPerTeam).toFixed(2))
      const sortedFinishes = [...agg.finishPositionsList].sort((a, b) => a - b)
      const medianFinishPosition =
        sortedFinishes.length > 0
          ? sortedFinishes.length % 2 === 0
            ? Number(
                (
                  (sortedFinishes[sortedFinishes.length / 2 - 1] +
                    sortedFinishes[sortedFinishes.length / 2]) /
                  2
                ).toFixed(2),
              )
            : sortedFinishes[Math.floor(sortedFinishes.length / 2)]
          : avgFinishPosition

      const winPercentage = Number(((agg.winCount / rIters) * 100).toFixed(2))
      const podiumPercentage = Number(((agg.podiumCount / (rIters * 3)) * 100).toFixed(2))
      const top10FinishPercentage = Number(
        ((agg.top10FinishCount / (rIters * 10)) * 100).toFixed(2),
      )
      const pointsRate = Number(((agg.pointsRacesCount / rIters) * 100).toFixed(2))
      const avgPointsPerRace = Number((agg.totalPoints / rIters).toFixed(2))
      const dnfPercentage = Number(((agg.dnfCount / rEntriesPerTeam) * 100).toFixed(2))

      return {
        teamKey: t.teamKey,
        teamName: t.teamName,
        engineSupplier: t.engineSupplier,
        chassisRating: t.chassisRating,
        puRating: t.puRating,
        effectivePuRating: t.effectivePuRating,
        effectiveIntegration: t.effectiveIntegration,
        puRelationshipType: t.puRelationshipType,
        carPerfRating: t.carPerfRating,
        targetGroup: t.targetGroup,
        avgGridPosition,
        medianGridPosition,
        poleCount: agg.poleCount,
        polePercentage,
        top3GridCount: agg.top3GridCount,
        top3GridPercentage,
        top10GridCount: agg.top10GridCount,
        top10GridPercentage,
        q3Rate,
        avgFinishPosition,
        medianFinishPosition,
        winCount: agg.winCount,
        winPercentage,
        podiumCount: agg.podiumCount,
        podiumPercentage,
        top10FinishCount: agg.top10FinishCount,
        top10FinishPercentage,
        pointsRate,
        avgPointsPerRace,
        totalPoints: agg.totalPoints,
        dnfCount: agg.dnfCount,
        dnfPercentage,
      }
    })

    // Ordenar tabela pela média de posição de corrida (menor é melhor)
    teamsStats.sort((a, b) => a.avgFinishPosition - b.avgFinishPosition)

    // 3. Avaliar Hierarquia Alvo e Regras Especiais (APENAS MEDIR e REPORTAR)
    const findings: TargetHierarchyFinding[] = []

    const audiStats = teamsStats.find((t) => t.teamKey === 'audi')!
    const haasStats = teamsStats.find((t) => t.teamKey === 'haas')!
    const williamsStats = teamsStats.find((t) => t.teamKey === 'williams')!
    const andrettiStats = teamsStats.find((t) => t.teamKey === 'andretti')!

    // Regra 1: Audi > Haas (média de corrida)
    // Menor posição = melhor ritmo
    const audiFasterThanHaas = audiStats.avgFinishPosition < haasStats.avgFinishPosition
    findings.push({
      rule: 'REGRA USUÁRIO: Audi > Haas em ritmo médio de corrida',
      status: audiFasterThanHaas ? 'SATISFIED' : 'DIVERGENT',
      actualValue: `Audi P${audiStats.avgFinishPosition} vs Haas P${haasStats.avgFinishPosition}`,
      expectedTarget: 'Audi avgFinishPosition < Haas avgFinishPosition',
      detail: audiFasterThanHaas
        ? `Audi supera Haas por delta de ${(haasStats.avgFinishPosition - audiStats.avgFinishPosition).toFixed(2)} posições.`
        : `DIVERGÊNCIA: Haas está à frente da Audi por delta de ${(audiStats.avgFinishPosition - haasStats.avgFinishPosition).toFixed(2)} posições no estado atual.`,
    })

    // Regra 2: Williams não pode ter ritmo médio de top-3
    const williamsIsTop3 = williamsStats.avgFinishPosition <= 6.0 // correspondente aos 3 primeiros construtores (6 pilotos)
    findings.push({
      rule: 'RESTRIÇÃO: Williams NÃO pode ter ritmo médio de top-3',
      status: !williamsIsTop3 ? 'SATISFIED' : 'DIVERGENT',
      actualValue: `Williams média P${williamsStats.avgFinishPosition} (Rank ${teamsStats.findIndex((t) => t.teamKey === 'williams') + 1}º construtor)`,
      expectedTarget: 'avgFinishPosition > 6.0 (Fora do Top-3 de equipes)',
      detail: !williamsIsTop3
        ? 'Williams está no pelotão C/D, em conformidade com o regulamento.'
        : 'DIVERGÊNCIA: Williams apresenta ritmo médio incompatível no top-3.',
    })

    // Regra 3: Andretti não pode ter ritmo médio de top-3
    const andrettiIsTop3 = andrettiStats.avgFinishPosition <= 6.0
    findings.push({
      rule: 'RESTRIÇÃO: Andretti NÃO pode ter ritmo médio de top-3',
      status: !andrettiIsTop3 ? 'SATISFIED' : 'DIVERGENT',
      actualValue: `Andretti média P${andrettiStats.avgFinishPosition} (Rank ${teamsStats.findIndex((t) => t.teamKey === 'andretti') + 1}º construtor)`,
      expectedTarget: 'avgFinishPosition > 6.0 (Fora do Top-3 de equipes)',
      detail: !andrettiIsTop3
        ? 'Andretti está no pelotão C/D, em conformidade com o regulamento.'
        : 'DIVERGÊNCIA: Andretti apresenta ritmo médio incompatível no top-3.',
    })

    // Regra 4: Grupo A (Mercedes, Ferrari, McLaren, Red Bull) deve dominar o topo
    const top4TeamKeys = teamsStats.slice(0, 4).map((t) => t.teamKey)
    const expectedGroupA = ['mercedes', 'ferrari', 'mclaren', 'redbull']
    const groupAInTop4 = expectedGroupA.every((k) => top4TeamKeys.includes(k))
    findings.push({
      rule: 'HIERARQUIA: Grupo A (Mercedes, Ferrari, McLaren, Red Bull) no Top-4',
      status: groupAInTop4 ? 'SATISFIED' : 'DIVERGENT',
      actualValue: `Top-4 atual: ${top4TeamKeys.join(', ')}`,
      expectedTarget: 'Mercedes, Ferrari, McLaren, Red Bull',
      detail: groupAInTop4
        ? 'Grupo A consolidado no topo do grid.'
        : `DIVERGÊNCIA: Pelo menos uma equipe do Grupo A não está no Top-4.`,
    })

    // Regra 5: Grupo D (Cadillac, Andretti) no fundo do grid
    const bottom2TeamKeys = teamsStats.slice(-2).map((t) => t.teamKey)
    const expectedGroupD = ['cadillac', 'andretti']
    const groupDInBottom = expectedGroupD.every((k) => bottom2TeamKeys.includes(k))
    findings.push({
      rule: 'HIERARQUIA: Grupo D (Cadillac, Andretti) nas duas últimas posições médias',
      status: groupDInBottom ? 'SATISFIED' : 'DIVERGENT',
      actualValue: `Fundo atual (P11-P12): ${bottom2TeamKeys.join(', ')}`,
      expectedTarget: 'Cadillac, Andretti',
      detail: groupDInBottom
        ? 'Grupo D nas posições de fechamento do grid.'
        : `DIVERGÊNCIA: As duas últimas posições médias divergem do Grupo D esperado.`,
    })

    // Regra 6: Posição média do Grupo B (Racing Bulls, Alpine, Audi) deve ser intermediária
    const groupBKeys = ['racingbulls', 'alpine', 'audi']
    const groupBRanks = teamsStats
      .map((t, idx) => ({ key: t.teamKey, rank: idx + 1 }))
      .filter((t) => groupBKeys.includes(t.key))
    const groupBAvgRank =
      groupBRanks.reduce((acc, cur) => acc + cur.rank, 0) / (groupBRanks.length || 1)
    const audiRank = teamsStats.findIndex((t) => t.teamKey === 'audi') + 1
    const haasRank = teamsStats.findIndex((t) => t.teamKey === 'haas') + 1
    const groupBExpected = groupBAvgRank >= 4.0 && groupBAvgRank <= 8.5 && audiRank <= haasRank
    findings.push({
      rule: 'HIERARQUIA: Grupo B (Racing Bulls, Alpine, Audi) no pelotão intermediário superior',
      status: groupBExpected ? 'SATISFIED' : 'DIVERGENT',
      actualValue: `Ranks do Grupo B: ${groupBRanks.map((g) => `${g.key} P${g.rank}`).join(', ')} (Média: ${groupBAvgRank.toFixed(1)})`,
      expectedTarget: 'Ranks entre 5º e 8º construtor e à frente da Haas',
      detail:
        groupBExpected
          ? 'Grupo B situado adequadamente no pelotão intermediário com Audi à frente da Haas.'
          : 'DIVERGÊNCIA: Deslocamento no pelotão intermediário do Grupo B.',
    })

    // Regra 7: Posição média do Grupo C (Haas, Williams, Aston Martin)
    const groupCKeys = ['haas', 'williams', 'astonmartin']
    const groupCRanks = teamsStats
      .map((t, idx) => ({ key: t.teamKey, rank: idx + 1 }))
      .filter((t) => groupCKeys.includes(t.key))
    const groupCAvgRank =
      groupCRanks.reduce((acc, cur) => acc + cur.rank, 0) / (groupCRanks.length || 1)
    const groupCExpected = groupCAvgRank >= 7.0 && groupCAvgRank <= 11.0 && haasRank >= audiRank
    findings.push({
      rule: 'HIERARQUIA: Grupo C (Haas, Williams, Aston Martin) no pelotão intermediário inferior',
      status: groupCExpected ? 'SATISFIED' : 'DIVERGENT',
      actualValue: `Ranks do Grupo C: ${groupCRanks.map((g) => `${g.key} P${g.rank}`).join(', ')} (Média: ${groupCAvgRank.toFixed(1)})`,
      expectedTarget: 'Ranks entre 7º e 10º construtor',
      detail:
        groupCExpected
          ? 'Grupo C situado adequadamente no pelotão intermediário inferior.'
          : 'DIVERGÊNCIA: Deslocamento no pelotão do Grupo C.',
    })

    const summaryTitle =
      phase === 'FASE_B_AFTER'
        ? `FC02D FASE B — Relatório AFTER de Baseline de Desempenho 2026 (Audi Calibrada)`
        : `FC02D FASE A — Relatório BEFORE de Baseline de Desempenho 2026`

    const summaryText =
      `${summaryTitle}\n` +
      `Simulações: ${qIters} Qualificações | ${rIters} Corridas (${totalRaceLaps} voltas) | Seed: ${seed}\n` +
      `Ordem Média de Chegada (P1 a P12 equipes):\n` +
      teamsStats
        .map(
          (t, i) =>
            `${(i + 1).toString().padStart(2)}. ${t.teamName.padEnd(22)} | Grupo ${t.targetGroup} | Grid Méd: P${t.avgGridPosition.toFixed(2).padEnd(5)} | Corrida Méd: P${t.avgFinishPosition.toFixed(2).padEnd(5)} | Vitórias: ${t.winPercentage.toFixed(1)}% | Pódios: ${t.podiumPercentage.toFixed(1)}% | Pontos/GP: ${t.avgPointsPerRace.toFixed(1)}`,
        )
        .join('\n')

    return {
      generatedAt: new Date().toISOString(),
      phase,
      seed,
      totalQualifyingSimulations: qIters,
      totalRaceSimulations: rIters,
      teamsCount: teamsStats.length,
      totalDriversCount: teamsStats.length * 2,
      targetHierarchy: {
        groupA: ['Mercedes', 'Ferrari', 'McLaren', 'Red Bull'],
        groupB: ['Racing Bulls', 'Alpine', 'Audi'],
        groupC: ['Haas', 'Williams', 'Aston Martin'],
        groupD: ['Cadillac', 'Andretti'],
        specialRules: [
          'Audi > Haas (ritmo médio)',
          'Williams e Andretti NÃO podem ter ritmo médio de top-3',
          'Proibido: teamPositionCap, winChance, podiumChance, forcedGridPosition, frontRunnerFlag',
        ],
      },
      teamsStats,
      findings,
      summaryText,
    }
  }
}

  /**
   * PASSO 9 & PASSO 3-6: Auditoria Estatística Focada Audi vs Haas
   * Mede diretamente a vantagem estrutural da Audi sobre a Haas sem aplicar scripts arbitrários.
   */
  public auditAudiHaasBalance(options: {
    seed?: number
    simulations?: number
    totalLaps?: number
    includeCircuits?: boolean
    includeIsolation?: boolean
  } = {}): AudiHaasBalanceAuditReport {
    const seed = options.seed ?? 20260315
    const sims = options.simulations ?? 1000
    const totalLaps = options.totalLaps ?? 30

    const rng = this.createRng(seed)

    // Contexto das equipes canônicas
    const audiOfficial = OFFICIAL_GRID_TEAMS.find((t) => t.key === 'audi')!
    const haasOfficial = OFFICIAL_GRID_TEAMS.find((t) => t.key === 'haas')!

    const audiCtx = this.resolveTeamContext(audiOfficial)
    const haasCtx = this.resolveTeamContext(haasOfficial)

    // Drivers composite ratings (speed, consistency, rain, defense)
    const audiD1Comp = (audiCtx.driver1.speed + audiCtx.driver1.consistency + audiCtx.driver1.defense + audiCtx.driver1.rain) / 4
    const audiD2Comp = (audiCtx.driver2.speed + audiCtx.driver2.consistency + audiCtx.driver2.defense + audiCtx.driver2.rain) / 4
    const audiDriverComposite = Number(((audiD1Comp + audiD2Comp) / 2).toFixed(2))

    const haasD1Comp = (haasCtx.driver1.speed + haasCtx.driver1.consistency + haasCtx.driver1.defense + haasCtx.driver1.rain) / 4
    const haasD2Comp = (haasCtx.driver2.speed + haasCtx.driver2.consistency + haasCtx.driver2.defense + haasCtx.driver2.rain) / 4
    const haasDriverComposite = Number(((haasD1Comp + haasD2Comp) / 2).toFixed(2))

    const driverCompositeDelta = Number((audiDriverComposite - haasDriverComposite).toFixed(2))

    const chassisDelta = Number((audiCtx.chassisRating - haasCtx.chassisRating).toFixed(2))
    const effectivePUDelta = Number((audiCtx.effectivePuRating - haasCtx.effectivePuRating).toFixed(2))
    const carPerformanceDelta = Number((audiCtx.carPerfRating - haasCtx.carPerfRating).toFixed(2))

    // Listas para coletar posições e deltas
    const audiQualyPositions: number[] = []
    const haasQualyPositions: number[] = []
    const qualyDeltasSec: number[] = [] // haasBestLap - audiBestLap (positivo => Audi na frente)
    let audiAheadQualyCount = 0

    const audiRacePositions: number[] = []
    const haasRacePositions: number[] = []
    const raceDeltasSec: number[] = [] // aprox delta de tempo de corrida baseado no ritmo
    let audiAheadRaceCount = 0

    const allTeams = OFFICIAL_GRID_TEAMS.map((t) => this.resolveTeamContext(t))
    const defaultCircuit = resolveCircuitProfile({ round: 1 })

    for (let i = 0; i < sims; i++) {
      const qRes = this.simulateOneQualifying({
        teams: allTeams,
        circuitProfile: defaultCircuit,
        rng,
      })

      const audiEntries = qRes.filter((e) => e.teamKey === 'audi')
      const haasEntries = qRes.filter((e) => e.teamKey === 'haas')

      const audiBestGrid = Math.min(...audiEntries.map((e) => e.gridPosition))
      const haasBestGrid = Math.min(...haasEntries.map((e) => e.gridPosition))

      const audiBestLap = Math.min(...audiEntries.map((e) => e.lapTimeSec))
      const haasBestLap = Math.min(...haasEntries.map((e) => e.lapTimeSec))

      audiEntries.forEach((e) => audiQualyPositions.push(e.gridPosition))
      haasEntries.forEach((e) => haasQualyPositions.push(e.gridPosition))

      qualyDeltasSec.push(haasBestLap - audiBestLap)
      if (audiBestGrid < haasBestGrid) {
        audiAheadQualyCount++
      }

      // Corrida
      const iterSeed = (seed + i * 1009) >>> 0
      const rRes = this.simulateOneRace({
        teams: allTeams,
        qualyResult: qRes,
        circuitProfile: defaultCircuit,
        totalLaps,
        seed: iterSeed,
      })

      const audiRaceEntries = rRes.filter((e) => e.teamKey === 'audi')
      const haasRaceEntries = rRes.filter((e) => e.teamKey === 'haas')

      const audiBestFinish = Math.min(...audiRaceEntries.map((e) => e.finishPosition))
      const haasBestFinish = Math.min(...haasRaceEntries.map((e) => e.finishPosition))

      audiRaceEntries.forEach((e) => audiRacePositions.push(e.finishPosition))
      haasRaceEntries.forEach((e) => haasRacePositions.push(e.finishPosition))

      // Estimativa do delta de corrida: voltas * delta em segundos por volta
      const lapDelta = haasBestLap - audiBestLap
      const raceDeltaEst = lapDelta * totalLaps
      raceDeltasSec.push(raceDeltaEst)

      if (audiBestFinish < haasBestFinish) {
        audiAheadRaceCount++
      }
    }

    const audiAheadRate = Number(((audiAheadRaceCount / sims) * 100).toFixed(2))
    const haasAheadRate = Number((((sims - audiAheadRaceCount) / sims) * 100).toFixed(2))
    const audiAheadQualyRate = Number(((audiAheadQualyCount / sims) * 100).toFixed(2))
    const haasAheadQualyRate = Number((((sims - audiAheadQualyCount) / sims) * 100).toFixed(2))

    const avgQualifyingDeltaSec = Number(
      (qualyDeltasSec.reduce((a, b) => a + b, 0) / (sims || 1)).toFixed(3),
    )
    const avgRaceDeltaSec = Number(
      (raceDeltasSec.reduce((a, b) => a + b, 0) / (sims || 1)).toFixed(2),
    )
    const avgRaceTimeDeltaPerLapSec = Number(
      (avgRaceDeltaSec / totalLaps).toFixed(3),
    )

    // Estatísticas de distribuição
    const percentile = (arr: number[], p: number) => {
      const sorted = [...arr].sort((a, b) => a - b)
      const idx = Math.floor(sorted.length * p)
      return sorted[Math.min(idx, sorted.length - 1)]
    }

    const mean = (arr: number[]) =>
      Number((arr.reduce((a, b) => a + b, 0) / (arr.length || 1)).toFixed(2))

    const qualyDistribution = {
      audiMeanPosition: mean(audiQualyPositions),
      haasMeanPosition: mean(haasQualyPositions),
      audiMedianPosition: percentile(audiQualyPositions, 0.5),
      haasMedianPosition: percentile(haasQualyPositions, 0.5),
      audiP10: percentile(audiQualyPositions, 0.1),
      audiP50: percentile(audiQualyPositions, 0.5),
      audiP90: percentile(audiQualyPositions, 0.9),
      haasP10: percentile(haasQualyPositions, 0.1),
      haasP50: percentile(haasQualyPositions, 0.5),
      haasP90: percentile(haasQualyPositions, 0.9),
    }

    const raceDistribution = {
      audiMeanPosition: mean(audiRacePositions),
      haasMeanPosition: mean(haasRacePositions),
      audiMedianPosition: percentile(audiRacePositions, 0.5),
      haasMedianPosition: percentile(haasRacePositions, 0.5),
      audiP10: percentile(audiRacePositions, 0.1),
      audiP50: percentile(audiRacePositions, 0.5),
      audiP90: percentile(audiRacePositions, 0.9),
      haasP10: percentile(haasRacePositions, 0.1),
      haasP50: percentile(haasRacePositions, 0.5),
      haasP90: percentile(haasRacePositions, 0.9),
    }

    // Circuitos específicos (alta, travada, equilibrada) se solicitados
    let circuits: AudiHaasCircuitAudit[] | undefined
    if (options.includeCircuits) {
      circuits = []
      // 1. Alta velocidade / Retas / Monza ou Baku (ex: round 16 Monza ou round 8 Baku)
      const powerCirc = resolveCircuitProfile({ round: 16 })
      // 2. Travado / Chassi / Mônaco ou Hungaroring (ex: round 8 Mônaco ou round 14 Hungaroring)
      const techCirc = resolveCircuitProfile({ round: 8 })
      // 3. Equilibrado / Barcelona ou Silverstone
      const balCirc = resolveCircuitProfile({ round: 1 })

      const testCircs: Array<{ name: string; type: 'power' | 'technical' | 'balanced'; prof: any }> = [
        { name: powerCirc.circuitName || 'Monza (Alta)', type: 'power', prof: powerCirc },
        { name: techCirc.circuitName || 'Mônaco (Travada)', type: 'technical', prof: techCirc },
        { name: balCirc.circuitName || 'Bahrein (Equilibrada)', type: 'balanced', prof: balCirc },
      ]

      for (const c of testCircs) {
        const cRng = this.createRng(seed + 77)
        let cAheadQ = 0
        let cAheadR = 0
        const cQDeltas: number[] = []
        const cRDeltas: number[] = []
        const cSims = Math.min(200, sims)

        for (let i = 0; i < cSims; i++) {
          const qR = this.simulateOneQualifying({ teams: allTeams, circuitProfile: c.prof, rng: cRng })
          const aQ = qR.filter((e) => e.teamKey === 'audi')
          const hQ = qR.filter((e) => e.teamKey === 'haas')
          const aBestQ = Math.min(...aQ.map((e) => e.gridPosition))
          const hBestQ = Math.min(...hQ.map((e) => e.gridPosition))
          const aBestLap = Math.min(...aQ.map((e) => e.lapTimeSec))
          const hBestLap = Math.min(...hQ.map((e) => e.lapTimeSec))
          if (aBestQ < hBestQ) cAheadQ++
          cQDeltas.push(hBestLap - aBestLap)

          const rR = this.simulateOneRace({
            teams: allTeams,
            qualyResult: qR,
            circuitProfile: c.prof,
            totalLaps: 20,
            seed: (seed + i * 2011) >>> 0,
          })
          const aR = rR.filter((e) => e.teamKey === 'audi')
          const hR = rR.filter((e) => e.teamKey === 'haas')
          const aBestR = Math.min(...aR.map((e) => e.finishPosition))
          const hBestR = Math.min(...hR.map((e) => e.finishPosition))
          if (aBestR < hBestR) cAheadR++
          cRDeltas.push((hBestLap - aBestLap) * 20)
        }

        circuits.push({
          circuitName: c.name,
          circuitType: c.type,
          audiAheadQualyRate: Number(((cAheadQ / cSims) * 100).toFixed(1)),
          audiAheadRaceRate: Number(((cAheadR / cSims) * 100).toFixed(1)),
          avgQualyDeltaSec: Number((cQDeltas.reduce((a, b) => a + b, 0) / cSims).toFixed(3)),
          avgRaceDeltaSec: Number((cRDeltas.reduce((a, b) => a + b, 0) / cSims).toFixed(2)),
        })
      }
    }

    // Isolamento se solicitado
    let isolation: AudiHaasIsolationAudit | undefined
    if (options.includeIsolation) {
      // 1. Pilotos normalizados (todos com rating 82 idêntico)
      const normDriverRng = this.createRng(seed + 999)
      const normalizedDriverTeams = allTeams.map((t) => {
        if (t.teamKey === 'audi' || t.teamKey === 'haas') {
          return {
            ...t,
            driver1: { ...t.driver1, speed: 82, consistency: 82, rain: 82, defense: 82 },
            driver2: { ...t.driver2, speed: 82, consistency: 82, rain: 82, defense: 82 },
          }
        }
        return t
      })

      const isoSims = Math.min(200, sims)
      let dAheadQ = 0
      let dAheadR = 0
      const dQDeltas: number[] = []
      const dRDeltas: number[] = []

      for (let i = 0; i < isoSims; i++) {
        const qR = this.simulateOneQualifying({
          teams: normalizedDriverTeams,
          circuitProfile: defaultCircuit,
          rng: normDriverRng,
        })
        const aQ = qR.filter((e) => e.teamKey === 'audi')
        const hQ = qR.filter((e) => e.teamKey === 'haas')
        const aBestQ = Math.min(...aQ.map((e) => e.gridPosition))
        const hBestQ = Math.min(...hQ.map((e) => e.gridPosition))
        const aBestLap = Math.min(...aQ.map((e) => e.lapTimeSec))
        const hBestLap = Math.min(...hQ.map((e) => e.lapTimeSec))
        if (aBestQ < hBestQ) dAheadQ++
        dQDeltas.push(hBestLap - aBestLap)

        const rR = this.simulateOneRace({
          teams: normalizedDriverTeams,
          qualyResult: qR,
          circuitProfile: defaultCircuit,
          totalLaps: 20,
          seed: (seed + i * 3001) >>> 0,
        })
        const aR = rR.filter((e) => e.teamKey === 'audi')
        const hR = rR.filter((e) => e.teamKey === 'haas')
        if (Math.min(...aR.map((e) => e.finishPosition)) < Math.min(...hR.map((e) => e.finishPosition))) {
          dAheadR++
        }
        dRDeltas.push((hBestLap - aBestLap) * 20)
      }

      // 2. Carros normalizados (ratings de chassi e motor iguais a 50, pilotos reais)
      const normCarRng = this.createRng(seed + 1999)
      const normalizedCarTeams = allTeams.map((t) => {
        if (t.teamKey === 'audi' || t.teamKey === 'haas') {
          return {
            ...t,
            chassisRating: 50,
            puRating: 90,
            carPerfRating: 62,
          }
        }
        return t
      })

      let cAheadQ = 0
      let cAheadR = 0
      const cQDeltas: number[] = []
      const cRDeltas: number[] = []

      for (let i = 0; i < isoSims; i++) {
        const qR = this.simulateOneQualifying({
          teams: normalizedCarTeams,
          circuitProfile: defaultCircuit,
          rng: normCarRng,
        })
        const aQ = qR.filter((e) => e.teamKey === 'audi')
        const hQ = qR.filter((e) => e.teamKey === 'haas')
        const aBestQ = Math.min(...aQ.map((e) => e.gridPosition))
        const hBestQ = Math.min(...hQ.map((e) => e.gridPosition))
        const aBestLap = Math.min(...aQ.map((e) => e.lapTimeSec))
        const hBestLap = Math.min(...hQ.map((e) => e.lapTimeSec))
        if (aBestQ < hBestQ) cAheadQ++
        cQDeltas.push(hBestLap - aBestLap)

        const rR = this.simulateOneRace({
          teams: normalizedCarTeams,
          qualyResult: qR,
          circuitProfile: defaultCircuit,
          totalLaps: 20,
          seed: (seed + i * 4001) >>> 0,
        })
        const aR = rR.filter((e) => e.teamKey === 'audi')
        const hR = rR.filter((e) => e.teamKey === 'haas')
        if (Math.min(...aR.map((e) => e.finishPosition)) < Math.min(...hR.map((e) => e.finishPosition))) {
          cAheadR++
        }
        cRDeltas.push((hBestLap - aBestLap) * 20)
      }

      isolation = {
        normalizedDrivers: {
          audiAheadQualyRate: Number(((dAheadQ / isoSims) * 100).toFixed(1)),
          audiAheadRaceRate: Number(((dAheadR / isoSims) * 100).toFixed(1)),
          avgQualyDeltaSec: Number((dQDeltas.reduce((a, b) => a + b, 0) / isoSims).toFixed(3)),
          avgRaceDeltaSec: Number((dRDeltas.reduce((a, b) => a + b, 0) / isoSims).toFixed(2)),
        },
        normalizedCars: {
          audiAheadQualyRate: Number(((cAheadQ / isoSims) * 100).toFixed(1)),
          audiAheadRaceRate: Number(((cAheadR / isoSims) * 100).toFixed(1)),
          avgQualyDeltaSec: Number((cQDeltas.reduce((a, b) => a + b, 0) / isoSims).toFixed(3)),
          avgRaceDeltaSec: Number((cRDeltas.reduce((a, b) => a + b, 0) / isoSims).toFixed(2)),
        },
      }
    }

    return {
      simulations: sims,
      seed,
      audiAheadRate,
      haasAheadRate,
      audiAheadQualyRate,
      haasAheadQualyRate,
      avgRaceDeltaSec,
      avgQualifyingDeltaSec,
      avgRaceTimeDeltaPerLapSec,
      carPerformanceDelta,
      chassisDelta,
      effectivePUDelta,
      driverCompositeDelta,
      directTeamBonuses: 0,
      duplicatePUMultipliers: 0,
      rngOverrides: 0,
      qualyDistribution,
      raceDistribution,
      inversionFrequency: haasAheadRate,
      circuits,
      isolation,
    }
  }
}

export const teamPerformanceBaselineAuditService = new TeamPerformanceBaselineAuditService()

export function auditTeamPerformanceBaseline(
  options?: RunBaselineAuditOptions,
): TeamPerformanceBaselineReport {
  return teamPerformanceBaselineAuditService.runBaselineAudit(options)
}

export function auditAudiHaasBalance(options?: {
  seed?: number
  simulations?: number
  totalLaps?: number
  includeCircuits?: boolean
  includeIsolation?: boolean
}): AudiHaasBalanceAuditReport {
  return teamPerformanceBaselineAuditService.auditAudiHaasBalance(options)
}
