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
  carPerfRating: number
  targetGroup: 'A' | 'B' | 'C' | 'D'
  // Métricas de Qualificação
  avgGridPosition: number
  poleCount: number
  polePercentage: number
  top3GridCount: number
  top3GridPercentage: number
  top10GridCount: number
  top10GridPercentage: number
  // Métricas de Corrida
  avgFinishPosition: number
  winCount: number
  winPercentage: number
  podiumCount: number
  podiumPercentage: number
  top10FinishCount: number
  top10FinishPercentage: number
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
  phase: 'FASE_A_BEFORE'
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
    const carPerf = Number((chassis * 0.7 + puRating * 0.3).toFixed(1))
    const targetGroup = this.resolveTargetGroup(officialTeam.key)

    return {
      teamKey: officialTeam.key,
      teamName: officialTeam.name,
      engineSupplier: supplier,
      chassisRating: chassis,
      puRating,
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
        powerUnitRating: t.puRating,
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
        powerUnitRating: t.puRating,
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

    const rng = this.createRng(seed)
    const circuitProfile = resolveCircuitProfile({ round: currentRound })

    // Resolver os 12 times oficiais de 2026
    const teams = OFFICIAL_GRID_TEAMS.map((t) => this.resolveTeamContext(t))

    // Estruturas de agregação por equipe
    const teamAggregates = new Map<
      string,
      {
        gridPositionsSum: number
        poleCount: number
        top3GridCount: number
        top10GridCount: number
        // Corrida
        finishPositionsSum: number
        winCount: number
        podiumCount: number
        top10FinishCount: number
        totalPoints: number
        dnfCount: number
      }
    >()

    teams.forEach((t) => {
      teamAggregates.set(t.teamKey, {
        gridPositionsSum: 0,
        poleCount: 0,
        top3GridCount: 0,
        top10GridCount: 0,
        finishPositionsSum: 0,
        winCount: 0,
        podiumCount: 0,
        top10FinishCount: 0,
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

        for (const rEntry of rResult) {
          const agg = teamAggregates.get(rEntry.teamKey)!
          agg.finishPositionsSum += rEntry.finishPosition
          agg.totalPoints += rEntry.points
          if (rEntry.finishPosition === 1) agg.winCount += 1
          if (rEntry.finishPosition <= 3) agg.podiumCount += 1
          if (rEntry.finishPosition <= 10) agg.top10FinishCount += 1
          if (rEntry.isDnf) agg.dnfCount += 1
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
      const polePercentage = Number(((agg.poleCount / qIters) * 100).toFixed(2))
      const top3GridPercentage = Number(((agg.top3GridCount / (qIters * 3)) * 100).toFixed(2))
      const top10GridPercentage = Number(((agg.top10GridCount / (qIters * 10)) * 100).toFixed(2))

      const avgFinishPosition = Number((agg.finishPositionsSum / rEntriesPerTeam).toFixed(2))
      const winPercentage = Number(((agg.winCount / rIters) * 100).toFixed(2))
      const podiumPercentage = Number(((agg.podiumCount / (rIters * 3)) * 100).toFixed(2))
      const top10FinishPercentage = Number(
        ((agg.top10FinishCount / (rIters * 10)) * 100).toFixed(2),
      )
      const avgPointsPerRace = Number((agg.totalPoints / rIters).toFixed(2))
      const dnfPercentage = Number(((agg.dnfCount / rEntriesPerTeam) * 100).toFixed(2))

      return {
        teamKey: t.teamKey,
        teamName: t.teamName,
        engineSupplier: t.engineSupplier,
        chassisRating: t.chassisRating,
        puRating: t.puRating,
        carPerfRating: t.carPerfRating,
        targetGroup: t.targetGroup,
        avgGridPosition,
        poleCount: agg.poleCount,
        polePercentage,
        top3GridCount: agg.top3GridCount,
        top3GridPercentage,
        top10GridCount: agg.top10GridCount,
        top10GridPercentage,
        avgFinishPosition,
        winCount: agg.winCount,
        winPercentage,
        podiumCount: agg.podiumCount,
        podiumPercentage,
        top10FinishCount: agg.top10FinishCount,
        top10FinishPercentage,
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
    findings.push({
      rule: 'HIERARQUIA: Grupo B (Racing Bulls, Alpine, Audi) no pelotão intermediário superior',
      status: groupBAvgRank >= 4.0 && groupBAvgRank <= 8.5 ? 'SATISFIED' : 'DIVERGENT',
      actualValue: `Ranks do Grupo B: ${groupBRanks.map((g) => `${g.key} P${g.rank}`).join(', ')} (Média: ${groupBAvgRank.toFixed(1)})`,
      expectedTarget: 'Ranks entre 5º e 8º construtor',
      detail:
        groupBAvgRank >= 4.0 && groupBAvgRank <= 8.5
          ? 'Grupo B situado adequadamente no pelotão intermediário.'
          : 'DIVERGÊNCIA: Deslocamento no pelotão intermediário do Grupo B.',
    })

    // Regra 7: Posição média do Grupo C (Haas, Williams, Aston Martin)
    const groupCKeys = ['haas', 'williams', 'astonmartin']
    const groupCRanks = teamsStats
      .map((t, idx) => ({ key: t.teamKey, rank: idx + 1 }))
      .filter((t) => groupCKeys.includes(t.key))
    const groupCAvgRank =
      groupCRanks.reduce((acc, cur) => acc + cur.rank, 0) / (groupCRanks.length || 1)
    findings.push({
      rule: 'HIERARQUIA: Grupo C (Haas, Williams, Aston Martin) no pelotão intermediário inferior',
      status: groupCAvgRank >= 7.0 && groupCAvgRank <= 11.0 ? 'SATISFIED' : 'DIVERGENT',
      actualValue: `Ranks do Grupo C: ${groupCRanks.map((g) => `${g.key} P${g.rank}`).join(', ')} (Média: ${groupCAvgRank.toFixed(1)})`,
      expectedTarget: 'Ranks entre 7º e 10º construtor',
      detail:
        groupCAvgRank >= 7.0 && groupCAvgRank <= 11.0
          ? 'Grupo C situado adequadamente no pelotão intermediário inferior.'
          : 'DIVERGÊNCIA: Deslocamento no pelotão do Grupo C.',
    })

    const summaryText =
      `FC02D FASE A — Relatório BEFORE de Baseline de Desempenho 2026\n` +
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
      phase: 'FASE_A_BEFORE',
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

export const teamPerformanceBaselineAuditService = new TeamPerformanceBaselineAuditService()

export function auditTeamPerformanceBaseline(
  options?: RunBaselineAuditOptions,
): TeamPerformanceBaselineReport {
  return teamPerformanceBaselineAuditService.runBaselineAudit(options)
}
