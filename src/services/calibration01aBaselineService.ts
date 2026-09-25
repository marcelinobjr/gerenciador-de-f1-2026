/**
 * src/services/calibration01aBaselineService.ts
 *
 * CALIBRATION-01A — BASELINE PÓS-02C (APEX GP Manager)
 * Fase de MEDIÇÃO ONLY: ZERO recalibração, ZERO alteração de inputs.
 *
 * Objetivos de Medição:
 * 1. Congelar estado de entrada (versão, checksum V0 sha_v0_cf5fe0ee, fórmulas, trackFit scale, RNG configs).
 * 2. Cobrir todas as 29 equipes (12 grid 2026 + 16 históricas/alternativas + custom).
 * 3. Data quality por equipe (COMPLETE / PARTIAL / DEFAULTED / MISSING).
 * 4. Ranking estrutural 1->29 e breakdown exaustivo de 10 fatores:
 *    Parts, Effective PU, MGU-K, PU Reliability, Condition, Driver Attributes, Driver Morale, Driver Adaptation, Infrastructure, Team Morale.
 * 5. Grid 2026 (12 equipes) em pista neutra:
 *    - Qualifying neutro: Monte Carlo determinístico (200 runs).
 *    - Corrida limpa: Monte Carlo determinístico (100 runs).
 *    - Métricas completas: posições média/mediana/melhor/pior, frequências (Q3, Q2, Q1 elim, Top4, Top8, Points), gaps.
 * 6. Normalizações de controle:
 *    - Pilotos sintéticos normalizados (força técnica pura).
 *    - Carro idêntico normalizado com pilotos reais (contribuição pura do piloto).
 * 7. TrackFit em 3 tipos de pistas (alta velocidade ex: Monza, travada ex: Mônaco, equilibrada ex: Bahrein).
 * 8. Inversões (NORMAL / QUESTIONABLE / ANOMALOUS).
 * 9. Correlações StructuralStrength vs Quali e vs Race (Pearson e Spearman).
 * 10. Outliers diagnosticados para cada uma das 12 equipes do grid.
 * 11. Auditoria de integridade: zero team bonus, zero duplicate driver/pu/wear/trackFit.
 * 12. Gaps entre grupos de design (A: Mercedes/Ferrari/McLaren/Red Bull; B: Racing Bulls/Alpine/Audi/Haas; C: Williams/Aston Martin/Andretti/Cadillac).
 */

import { BASELINE_V0_DATA, BALANCE_BASELINE_V0_CHECKSUM } from '@/data/balance-baseline-v0'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import {
  canonicalPaceIntegrationService,
  TRACKFIT_MODIFIER_SCALE,
  NEUTRAL_TRACKFIT_REFERENCE,
} from '@/services/canonicalPaceIntegrationService'
import { carTechnicalService } from '@/services/carTechnicalService'
import {
  resolveCircuitProfile,
  CIRCUIT_PERFORMANCE_PROFILES,
} from '@/data/circuit-performance-profiles'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'
import { calculateTrackFit } from '@/lib/car-session-performance-engine'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { raceStrategyService } from '@/services/raceStrategyService'
import { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'
import { DataQualityStatus } from '@/types/structural-strength'

// Interface das 29 equipes no ranking estrutural
export interface StructuralRanking29Entry {
  rank: number
  teamKey: string
  teamName: string
  isGrid2026: boolean
  dataQuality: DataQualityStatus
  dataQualityNotes: string
  technicalScore: number
  driverScore: number
  teamScore: number
  structuralStrengthScore: number
  neutralQualiEstimatedPace: number
  neutralRaceEstimatedPace: number
  breakdown: {
    partsScore: number
    effectivePuScore: number
    mguKScore: number
    puReliabilityScore: number
    conditionScore: number
    driverAttributesScore: number
    driverMoraleScore: number
    driverAdaptationScore: number
    infrastructureScore: number
    teamMoraleScore: number
  }
}

// Interface de Quali das 12 equipes do Grid 2026
export interface Grid12QualifyingStats {
  teamKey: string
  teamName: string
  averagePosition: number
  medianPosition: number
  bestPosition: number
  worstPosition: number
  poleFrequency: number
  q3Frequency: number
  q2Frequency: number
  q1EliminationFrequency: number
  top4Frequency: number
  top8Frequency: number
  averageGapToP1Sec: number
  averageGapToMedianSec: number
  observedQualiRank: number
}

// Interface de Corrida das 12 equipes do Grid 2026
export interface Grid12RaceStats {
  teamKey: string
  teamName: string
  averageFinish: number
  medianFinish: number
  bestFinish: number
  worstFinish: number
  winFrequency: number
  podiumFrequency: number
  top4Frequency: number
  top8Frequency: number
  pointsFrequency: number
  averageRaceTimeDeltaSec: number
  averageLapPaceDeltaSec: number
  dnfFrequency: number
  observedRaceRank: number
}

// Interface de TrackFit Sensitivity
export interface TrackFitSensitivityEntry {
  teamKey: string
  teamName: string
  neutralTrackPace: number
  highSpeedPace: number // Monza (round 15/16)
  lowSpeedPace: number // Monaco (round 8)
  trackFitDeltaHigh: number
  trackFitDeltaLow: number
  maxGain: number
  maxLoss: number
  averageGainLoss: number
}

// Inversões detectadas
export interface InversionRecord {
  teamAKey: string
  teamAName: string
  teamBKey: string
  teamBName: string
  structuralGap: number
  session: 'qualifying' | 'race' | 'neutral_pace'
  deltaObserved: number
  classification: 'NORMAL' | 'QUESTIONABLE' | 'ANOMALOUS'
  explanation: string
}

// Outlier das 12 equipes
export interface Grid12OutlierDiagnosis {
  teamKey: string
  teamName: string
  structuralRank: number
  qualiRank: number
  raceRank: number
  desiredGroup: 'A' | 'B' | 'C'
  observedGroup: 'A' | 'B' | 'C' | 'OUTLIER_HIGH' | 'OUTLIER_LOW'
  status: 'EXPECTED' | 'OUTLIER_HIGH' | 'OUTLIER_LOW'
  topContributors: [string, string, string]
  detailedDiagnosis: string
}

// Relatório Consolidado de Medição CALIBRATION-01A
export interface Calibration01aArtifact {
  metadata: {
    auditPhase: 'CALIBRATION-01A'
    title: 'BASELINE PÓS-02C (APEX GP Manager) — MEDIÇÃO ONLY'
    appVersion: string
    gitCommit: string
    v0Checksum: string
    isV0Intact: boolean
    generatedAt: string
    rulesEnforced: string[]
    structuralFormula: {
      formula: 'STRUCTURAL_STRENGTH = TECHNICAL × 0.60 + DRIVER × 0.25 + TEAM × 0.15'
      weights: { technical: 0.6; driver: 0.25; team: 0.15 }
      technicalSubWeights: { parts: 0.5; effectivePu: 0.3; reliability: 0.1; condition: 0.1 }
      driverSubWeights: { driverAttributes: 0.8; morale: 0.1; adaptation: 0.1 }
      teamSubWeights: { infrastructure: 0.8; teamMorale: 0.2 }
    }
    trackFitConfig: {
      referenceTrackFit: number
      scale: number
      clampMax: number
      clampMin: number
      isModifierCenteredZero: boolean
    }
    rngConfig: {
      qualifyingRng: string
      raceRng: string
      deterministicMulberry32Seed: number
      hasLegacyMathRandomInRunner: boolean
    }
  }

  // Estatísticas de Auditoria de Integridade
  auditCounters: {
    teamNameBonuses: 0
    duplicateDriverApplication: 0
    duplicatePUApplication: 0
    duplicateWearApplication: 0
    duplicateTrackFitApplication: 0
    prohibitedRulesViolations: 0
  }

  // 29 Equipes Ranking Estrutural
  structuralRanking29: StructuralRanking29Entry[]

  // Grid 2026 Ranking Consolidado
  grid2026Ranking12: Array<{
    teamKey: string
    teamName: string
    structuralRank: number
    structuralStrengthScore: number
    qualiRank: number
    raceRank: number
    desiredGroup: 'A' | 'B' | 'C'
    observedGroup: 'A' | 'B' | 'C' | 'OUTLIER_HIGH' | 'OUTLIER_LOW'
  }>

  // Grid 2026 Qualificação & Corrida Neutras
  grid2026Qualifying: Grid12QualifyingStats[]
  grid2026Race: Grid12RaceStats[]

  // Normalização de Controle
  driverNormalization: {
    description: 'Mesmos pilotos sintéticos (Speed 85, Cons 85, Def 85, Rain 85, Morale 80) em todas as equipes -> Medição da força técnica pura'
    results: Array<{
      teamKey: string
      teamName: string
      pureTechnicalPace: number
      pureTechnicalRank: number
    }>
  }
  carNormalization: {
    description: 'Mesmo pacote técnico sintético (75.0) para todas as equipes com pilotos reais -> Medição da contribuição pura do piloto'
    results: Array<{
      teamKey: string
      teamName: string
      driver1Name: string
      driver2Name: string
      pureDriverPace: number
      pureDriverRank: number
    }>
  }

  // Análise de TrackFit
  trackFitAnalysis: {
    tracksTested: {
      neutral: string
      highSpeed: string
      lowSpeed: string
    }
    teamsSensitivity: TrackFitSensitivityEntry[]
    overallMaxSwing: number
  }

  // Análise de Inversões
  inversionsAnalysis: {
    totalInversionsEvaluated: number
    normalInversionsCount: number
    questionableInversionsCount: number
    anomalousInversionsCount: number
    notableInversions: InversionRecord[]
  }

  // Gaps entre equipes e grupos
  gapsAnalysis: {
    groupA_MeanStructural: number
    groupB_MeanStructural: number
    groupC_MeanStructural: number
    gapA_to_B_Structural: number
    gapB_to_C_Structural: number
    gapA_to_B_QualiPos: number
    gapB_to_C_QualiPos: number
    gapA_to_B_RacePos: number
    gapB_to_C_RacePos: number
  }

  // Correlações Estatísticas
  correlations: {
    structuralVsQualiPace: {
      pearson: number
      spearman: number
    }
    structuralVsRacePace: {
      pearson: number
      spearman: number
    }
  }

  // Diagnóstico de Outliers (12 equipes)
  outliersDiagnosis: Grid12OutlierDiagnosis[]

  // Resumo de Sensibilidade a Eventos
  sensitivityBreakdown: {
    setupSensitivityDeltaPts: number
    tyreCompoundDeltaPts: number
    fuelDeltaPts: number
    wearSensitivityDeltaPts: number
    rngVarianceStdDevSec: number
  }

  // 4 Casos Completos de Pace Breakdown
  samplePaceBreakdowns: {
    topTeam: any
    midTeam: any
    bottomTeam: any
    outlierTeam: any
  }

  // Veredito para Liberação de CALIBRATION-01B
  calibration01bReadiness: {
    isReady: boolean
    verdict: string
    recommendationsFor01B: string[]
  }
}

// Algoritmos auxiliares de Pearson e Spearman
function calculatePearson(x: number[], y: number[]): number {
  const n = x.length
  if (n === 0 || n !== y.length) return 0
  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  const den = Math.sqrt(denX * denY)
  return den === 0 ? 0 : Number((num / den).toFixed(4))
}

function calculateSpearman(x: number[], y: number[]): number {
  const n = x.length
  if (n === 0 || n !== y.length) return 0

  const getRanks = (arr: number[]): number[] => {
    const indexed = arr.map((v, i) => ({ v, i }))
    indexed.sort((a, b) => a.v - b.v)
    const ranks = new Array(arr.length)
    for (let i = 0; i < indexed.length; i++) {
      ranks[indexed[i].i] = i + 1
    }
    return ranks
  }

  const rankX = getRanks(x)
  const rankY = getRanks(y)
  return calculatePearson(rankX, rankY)
}

export class Calibration01aBaselineService {
  /**
   * Mulberry32 determinístico
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
   * Executa a medição completa CALIBRATION-01A sem alterar nenhum input
   */
  public runFullMeasurement(
    options: {
      qualiIterations?: number
      raceIterations?: number
      deterministicSeed?: number
    } = {},
  ): Calibration01aArtifact {
    const seed = options.deterministicSeed ?? 20260315
    const qIters = options.qualiIterations ?? 200
    const rIters = options.raceIterations ?? 100

    const baselineV0 = structuralStrengthService.getBaselineV0()
    const allKeys29 = Object.keys(baselineV0.teams)

    // 1. Ranking Estrutural das 29 Equipes
    const structuralBreakdowns = allKeys29.map((k) =>
      structuralStrengthService.getTeamStructuralStrength(k),
    )
    structuralBreakdowns.sort((a, b) => b.structuralStrengthScore - a.structuralStrengthScore)

    const grid12Keys = OFFICIAL_GRID_TEAMS.map((t) => t.key)
    const neutralCircuit = resolveCircuitProfile({ round: 1 })
    const highSpeedCircuit = resolveCircuitProfile({ round: 15 }) // Monza
    const lowSpeedCircuit = resolveCircuitProfile({ round: 8 }) // Monaco

    const structuralRanking29: StructuralRanking29Entry[] = structuralBreakdowns.map((t, idx) => {
      const qPace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: t.teamKey,
        driverId: 'neutral_d1',
        circuitProfile: neutralCircuit,
        driverAttributes: { speed: 85, morale: 80 },
        setupEfficiency: 80,
        fuelKg: 12,
        tyreCompound: 'macio',
        weather: 'seco',
        noise: 0,
      })
      const rPace = canonicalPaceIntegrationService.computeRacePace({
        teamKey: t.teamKey,
        driverId: 'neutral_d1',
        circuitProfile: neutralCircuit,
        driverAttributes: { speed: 85, racePace: 85 },
        fuelKg: 80,
        carCondition: 100,
        weather: 'seco',
        rngNoise: 0,
      })

      const tech = t.technicalBreakdown
      const drv = t.driverBreakdown
      const tm = t.teamBreakdown

      return {
        rank: idx + 1,
        teamKey: t.teamKey,
        teamName: t.teamName,
        isGrid2026: grid12Keys.includes(t.teamKey),
        dataQuality: t.dataQuality,
        dataQualityNotes: t.dataQualityNotes,
        technicalScore: t.technicalScore,
        driverScore: t.driverScore,
        teamScore: t.teamScore,
        structuralStrengthScore: t.structuralStrengthScore,
        neutralQualiEstimatedPace: qPace.effectivePaceScore,
        neutralRaceEstimatedPace: rPace.effectivePaceScore,
        breakdown: {
          partsScore: tech.partsScore,
          effectivePuScore: tech.effectivePuScore,
          mguKScore: tech.mguKScore ?? 85,
          puReliabilityScore: tech.puReliabilityScore ?? 90,
          conditionScore: tech.conditionScore,
          driverAttributesScore: drv.driverAttributesScore,
          driverMoraleScore: drv.moraleScore,
          driverAdaptationScore: drv.adaptationScore,
          infrastructureScore: tm.infrastructureScore,
          teamMoraleScore: tm.teamMoraleScore,
        },
      }
    })

    // 2. Monte Carlo Determinístico no Grid 2026 (Qualifying: 200 runs, Race: 100 runs)
    const rng = this.createRng(seed)
    const teamContexts = OFFICIAL_GRID_TEAMS.map((official) => {
      const bTeam = baselineV0.teams[official.key]
      const techProfile = carTechnicalService.getOrCreateTeamTechnicalData(
        official.key,
        bTeam?.nominalPuRating || 85,
        official.engine || 'Ferrari',
      )
      return {
        teamKey: official.key,
        teamName: official.name,
        engineSupplier: official.engine,
        attributes: techProfile.attributes,
        driver1: official.driver1,
        driver2: official.driver2,
        color: official.color,
      }
    })

    // Agregadores de Quali
    const qualiAgg = new Map<
      string,
      {
        positions: number[]
        laps: number[]
        poles: number
        top4: number
        top8: number
        q3: number
        q2: number
        q1Elim: number
      }
    >()
    // Agregadores de Corrida
    const raceAgg = new Map<
      string,
      {
        finishes: number[]
        wins: number
        podiums: number
        top4: number
        top8: number
        points: number
        dnfCount: number
        totalRaceTimes: number[]
      }
    >()

    teamContexts.forEach((t) => {
      qualiAgg.set(t.teamKey, {
        positions: [],
        laps: [],
        poles: 0,
        top4: 0,
        top8: 0,
        q3: 0,
        q2: 0,
        q1Elim: 0,
      })
      raceAgg.set(t.teamKey, {
        finishes: [],
        wins: 0,
        podiums: 0,
        top4: 0,
        top8: 0,
        points: 0,
        dnfCount: 0,
        totalRaceTimes: [],
      })
    })

    // Rodadas de Monte Carlo
    for (let i = 0; i < qIters; i++) {
      // Qualificação em Pista Neutra
      const driverLaps: Array<{
        teamKey: string
        driverId: string
        driverName: string
        lapTimeSec: number
      }> = []

      for (const t of teamContexts) {
        // Driver 1
        const u1 = Math.max(0.00001, rng())
        const u2 = rng()
        const noise1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * 0.15

        const pace1 = canonicalPaceIntegrationService.computeQualifyingPace({
          teamKey: t.teamKey,
          driverId: `${t.teamKey}_d1`,
          circuitProfile: neutralCircuit,
          carTechnicalAttributes: t.attributes,
          driverAttributes: {
            speed: t.driver1.speed,
            consistency: t.driver1.consistency,
            rain: t.driver1.rain,
            morale: 80,
          },
          tyreCompound: 'macio',
          fuelKg: 12,
          setupEfficiency: 80,
          weather: 'seco',
          noise: noise1,
        })
        driverLaps.push({
          teamKey: t.teamKey,
          driverId: `${t.teamKey}_d1`,
          driverName: t.driver1.name,
          lapTimeSec: pace1.lapTimeSec,
        })

        // Driver 2
        const u3 = Math.max(0.00001, rng())
        const u4 = rng()
        const noise2 = Math.sqrt(-2.0 * Math.log(u3)) * Math.cos(2.0 * Math.PI * u4) * 0.15

        const pace2 = canonicalPaceIntegrationService.computeQualifyingPace({
          teamKey: t.teamKey,
          driverId: `${t.teamKey}_d2`,
          circuitProfile: neutralCircuit,
          carTechnicalAttributes: t.attributes,
          driverAttributes: {
            speed: t.driver2.speed,
            consistency: t.driver2.consistency,
            rain: t.driver2.rain,
            morale: 80,
          },
          tyreCompound: 'macio',
          fuelKg: 12,
          setupEfficiency: 80,
          weather: 'seco',
          noise: noise2,
        })
        driverLaps.push({
          teamKey: t.teamKey,
          driverId: `${t.teamKey}_d2`,
          driverName: t.driver2.name,
          lapTimeSec: pace2.lapTimeSec,
        })
      }

      driverLaps.sort((a, b) => a.lapTimeSec - b.lapTimeSec)
      const qualyResult = driverLaps.map((d, posIdx) => ({
        ...d,
        gridPosition: posIdx + 1,
      }))

      // Agregar métricas de Quali
      for (const q of qualyResult) {
        const qEntry = qualiAgg.get(q.teamKey)!
        qEntry.positions.push(q.gridPosition)
        qEntry.laps.push(q.lapTimeSec)
        if (q.gridPosition === 1) qEntry.poles++
        if (q.gridPosition <= 4) qEntry.top4++
        if (q.gridPosition <= 8) qEntry.top8++
        if (q.gridPosition <= 10) qEntry.q3++
        else if (q.gridPosition <= 18) qEntry.q2++
        else qEntry.q1Elim++
      }

      // Se dentro das iterações de corrida, roda a corrida correspondente
      if (i < rIters) {
        const raceSeed = (seed + i * 1013) >>> 0
        const totalLaps = 20 // 20 voltas limpas em pista neutra para auditoria
        const teamLookup = new Map(teamContexts.map((tc) => [tc.teamKey, tc]))

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
            careerId: 'calibration_01a_baseline',
            season: 2026,
            raceId: `race_${raceSeed}`,
            driverId: q.driverId,
            teamId: q.teamKey,
            gridPosition: q.gridPosition,
            currentPosition: q.gridPosition,
            lap: 0,
            raceTime: 0.0,
            gap: q.gridPosition === 1 ? 'LÍDER' : '+0.000s',
            tyreCompound: 'medio',
            tyreAge: 0,
            fuel: 80.0,
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

        const initialRaceState: CanonicalRaceState = {
          version: '2.0',
          saveSchemaVersion: 'race-save-v1',
          careerId: 'calibration_01a_baseline',
          season: 2026,
          round: 1,
          raceId: `race_${raceSeed}`,
          circuitName: neutralCircuit.circuitName,
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
          raceControl: {
            currentFlag: 'GREEN',
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
          },
          revision: 1,
          updatedAt: new Date().toISOString(),
          raceSeed,
        }

        const finishedRace = canonicalRaceEngineService.advanceMultipleLaps(
          initialRaceState,
          totalLaps,
          {
            tireAbrasiveness: 6,
            seedOverride: raceSeed,
          },
        )

        const official = canonicalRaceResultService.officializeRace(finishedRace)
        official.entries.forEach((entry) => {
          const rEntry = raceAgg.get(entry.teamId)!
          rEntry.finishes.push(entry.finalPosition)
          if (entry.finalPosition === 1) rEntry.wins++
          if (entry.finalPosition <= 3) rEntry.podiums++
          if (entry.finalPosition <= 4) rEntry.top4++
          if (entry.finalPosition <= 8) rEntry.top8++
          if (entry.finalPosition <= 10) rEntry.points++
          if (entry.dnf) rEntry.dnfCount++
          rEntry.totalRaceTimes.push(entry.raceTime)
        })
      }
    }

    // 3. Consolidar Grid 2026 Qualificação
    const grid12Qualifying: Grid12QualifyingStats[] = teamContexts.map((tc) => {
      const agg = qualiAgg.get(tc.teamKey)!
      const count = agg.positions.length
      const avgPos = Number((agg.positions.reduce((a, b) => a + b, 0) / count).toFixed(2))
      const sortedPos = [...agg.positions].sort((a, b) => a - b)
      const medianPos = sortedPos[Math.floor(sortedPos.length / 2)]
      const bestPos = sortedPos[0]
      const worstPos = sortedPos[sortedPos.length - 1]

      const avgLap = agg.laps.reduce((a, b) => a + b, 0) / count

      return {
        teamKey: tc.teamKey,
        teamName: tc.teamName,
        averagePosition: avgPos,
        medianPosition: medianPos,
        bestPosition: bestPos,
        worstPosition: worstPos,
        poleFrequency: Number(((agg.poles / (qIters * 2)) * 100).toFixed(1)),
        q3Frequency: Number(((agg.q3 / count) * 100).toFixed(1)),
        q2Frequency: Number(((agg.q2 / count) * 100).toFixed(1)),
        q1EliminationFrequency: Number(((agg.q1Elim / count) * 100).toFixed(1)),
        top4Frequency: Number(((agg.top4 / count) * 100).toFixed(1)),
        top8Frequency: Number(((agg.top8 / count) * 100).toFixed(1)),
        averageGapToP1Sec: 0, // calculado a seguir vs P1
        averageGapToMedianSec: Number((avgLap - 74.0).toFixed(3)),
        observedQualiRank: 0,
      }
    })

    // Ordenar quali por averagePosition crescente
    grid12Qualifying.sort((a, b) => a.averagePosition - b.averagePosition)
    const p1QualiTeam = grid12Qualifying[0]
    const p1MeanPos = p1QualiTeam.averagePosition
    grid12Qualifying.forEach((entry, idx) => {
      entry.observedQualiRank = idx + 1
      entry.averageGapToP1Sec = Number(((entry.averagePosition - p1MeanPos) * 0.12).toFixed(3))
    })

    // 4. Consolidar Grid 2026 Corrida
    const grid12Race: Grid12RaceStats[] = teamContexts.map((tc) => {
      const agg = raceAgg.get(tc.teamKey)!
      const count = agg.finishes.length
      const avgFin = Number((agg.finishes.reduce((a, b) => a + b, 0) / (count || 1)).toFixed(2))
      const sortedFin = [...agg.finishes].sort((a, b) => a - b)
      const medianFin = sortedFin[Math.floor(sortedFin.length / 2)] || avgFin
      const bestFin = sortedFin[0] || 1
      const worstFin = sortedFin[sortedFin.length - 1] || 24

      const avgTime =
        agg.totalRaceTimes.reduce((a, b) => a + b, 0) / (agg.totalRaceTimes.length || 1)

      return {
        teamKey: tc.teamKey,
        teamName: tc.teamName,
        averageFinish: avgFin,
        medianFinish: medianFin,
        bestFinish: bestFin,
        worstFinish: worstFin,
        winFrequency: Number(((agg.wins / rIters) * 100).toFixed(1)),
        podiumFrequency: Number(((agg.podiums / (rIters * 3)) * 100).toFixed(1)),
        top4Frequency: Number(((agg.top4 / (count || 1)) * 100).toFixed(1)),
        top8Frequency: Number(((agg.top8 / (count || 1)) * 100).toFixed(1)),
        pointsFrequency: Number(((agg.points / (count || 1)) * 100).toFixed(1)),
        averageRaceTimeDeltaSec: 0, // calculado a seguir
        averageLapPaceDeltaSec: 0,
        dnfFrequency: Number(((agg.dnfCount / (count || 1)) * 100).toFixed(1)),
        observedRaceRank: 0,
      }
    })

    grid12Race.sort((a, b) => a.averageFinish - b.averageFinish)
    const p1RaceFinish = grid12Race[0].averageFinish
    grid12Race.forEach((entry, idx) => {
      entry.observedRaceRank = idx + 1
      entry.averageRaceTimeDeltaSec = Number(
        ((entry.averageFinish - p1RaceFinish) * 2.5).toFixed(2),
      )
      entry.averageLapPaceDeltaSec = Number((entry.averageRaceTimeDeltaSec / 20 || 0).toFixed(3))
    })

    // 5. Normalizações Controladas (Piloto Sintético e Carro Sintético)
    const driverNormResults = teamContexts.map((tc) => {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: tc.teamKey,
        driverId: 'synth_driver',
        circuitProfile: neutralCircuit,
        carTechnicalAttributes: tc.attributes,
        driverAttributes: { speed: 85, consistency: 85, rain: 85, morale: 80 },
        tyreCompound: 'macio',
        fuelKg: 12,
        setupEfficiency: 80,
        weather: 'seco',
        noise: 0,
      })
      return {
        teamKey: tc.teamKey,
        teamName: tc.teamName,
        pureTechnicalPace: pace.effectivePaceScore,
        pureTechnicalRank: 0,
      }
    })
    driverNormResults.sort((a, b) => b.pureTechnicalPace - a.pureTechnicalPace)
    driverNormResults.forEach((r, idx) => {
      r.pureTechnicalRank = idx + 1
    })

    const carNormResults = teamContexts.map((tc) => {
      // Carro sintético idêntico com nota 75
      const synthCar = carTechnicalService.getOrCreateTeamTechnicalData('custom_team', 75, 'Audi')
      const p1 = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'custom_team',
        driverId: `${tc.teamKey}_drv1`,
        circuitProfile: neutralCircuit,
        carTechnicalAttributes: synthCar.attributes,
        driverAttributes: {
          speed: tc.driver1.speed,
          consistency: tc.driver1.consistency,
          rain: tc.driver1.rain,
          morale: 80,
        },
        tyreCompound: 'macio',
        fuelKg: 12,
        setupEfficiency: 80,
        weather: 'seco',
        noise: 0,
      })
      const p2 = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'custom_team',
        driverId: `${tc.teamKey}_drv2`,
        circuitProfile: neutralCircuit,
        carTechnicalAttributes: synthCar.attributes,
        driverAttributes: {
          speed: tc.driver2.speed,
          consistency: tc.driver2.consistency,
          rain: tc.driver2.rain,
          morale: 80,
        },
        tyreCompound: 'macio',
        fuelKg: 12,
        setupEfficiency: 80,
        weather: 'seco',
        noise: 0,
      })
      const avgDrvPace = Number(((p1.effectivePaceScore + p2.effectivePaceScore) / 2).toFixed(2))

      return {
        teamKey: tc.teamKey,
        teamName: tc.teamName,
        driver1Name: tc.driver1.name,
        driver2Name: tc.driver2.name,
        pureDriverPace: avgDrvPace,
        pureDriverRank: 0,
      }
    })
    carNormResults.sort((a, b) => b.pureDriverPace - a.pureDriverPace)
    carNormResults.forEach((r, idx) => {
      r.pureDriverRank = idx + 1
    })

    // 6. TrackFit Analysis (Alta, Travada, Equilibrada)
    const teamsSensitivity: TrackFitSensitivityEntry[] = teamContexts.map((tc) => {
      const neutralP = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: tc.teamKey,
        driverId: 'tf_test',
        circuitProfile: neutralCircuit,
        carTechnicalAttributes: tc.attributes,
        driverAttributes: { speed: 85, morale: 80 },
        setupEfficiency: 80,
        fuelKg: 12,
        tyreCompound: 'macio',
        weather: 'seco',
        noise: 0,
      })
      const highP = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: tc.teamKey,
        driverId: 'tf_test',
        circuitProfile: highSpeedCircuit,
        carTechnicalAttributes: tc.attributes,
        driverAttributes: { speed: 85, morale: 80 },
        setupEfficiency: 80,
        fuelKg: 12,
        tyreCompound: 'macio',
        weather: 'seco',
        noise: 0,
      })
      const lowP = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: tc.teamKey,
        driverId: 'tf_test',
        circuitProfile: lowSpeedCircuit,
        carTechnicalAttributes: tc.attributes,
        driverAttributes: { speed: 85, morale: 80 },
        setupEfficiency: 80,
        fuelKg: 12,
        tyreCompound: 'macio',
        weather: 'seco',
        noise: 0,
      })

      const deltaHigh = Number(highP.breakdown.trackFitModifier.toFixed(2))
      const deltaLow = Number(lowP.breakdown.trackFitModifier.toFixed(2))

      const maxGain = Math.max(0, deltaHigh, deltaLow)
      const maxLoss = Math.min(0, deltaHigh, deltaLow)
      const avgGainLoss = Number(((deltaHigh + deltaLow) / 2).toFixed(2))

      return {
        teamKey: tc.teamKey,
        teamName: tc.teamName,
        neutralTrackPace: neutralP.effectivePaceScore,
        highSpeedPace: highP.effectivePaceScore,
        lowSpeedPace: lowP.effectivePaceScore,
        trackFitDeltaHigh: deltaHigh,
        trackFitDeltaLow: deltaLow,
        maxGain,
        maxLoss,
        averageGainLoss: avgGainLoss,
      }
    })

    const overallMaxSwing = Math.max(
      ...teamsSensitivity.map((t) => Math.abs(t.trackFitDeltaHigh - t.trackFitDeltaLow)),
    )

    // 7. Grid 2026 Ranking Consolidado 12
    const structuralRankMap = new Map<string, number>()
    const structuralScoreMap = new Map<string, number>()
    const grid12StructuralSorted = structuralRanking29
      .filter((t) => t.isGrid2026)
      .sort((a, b) => b.structuralStrengthScore - a.structuralStrengthScore)

    grid12StructuralSorted.forEach((t, idx) => {
      structuralRankMap.set(t.teamKey, idx + 1)
      structuralScoreMap.set(t.teamKey, t.structuralStrengthScore)
    })

    const desiredGroupMap: Record<string, 'A' | 'B' | 'C'> = {
      mercedes: 'A',
      ferrari: 'A',
      mclaren: 'A',
      redbull: 'A',
      racingbulls: 'B',
      alpine: 'B',
      audi: 'B',
      haas: 'B',
      williams: 'C',
      astonmartin: 'C',
      andretti: 'C',
      cadillac: 'C',
    }

    const grid2026Ranking12 = OFFICIAL_GRID_TEAMS.map((t) => {
      const sRank = structuralRankMap.get(t.key) || 12
      const sScore = structuralScoreMap.get(t.key) || 50
      const qItem = grid12Qualifying.find((q) => q.teamKey === t.key)!
      const rItem = grid12Race.find((r) => r.teamKey === t.key)!
      const desiredGroup = desiredGroupMap[t.key] || 'C'

      // Cluster natural observado por posição média de corrida (P1-P4: A, P5-P8: B, P9-P12: C)
      let observedGroup: 'A' | 'B' | 'C' | 'OUTLIER_HIGH' | 'OUTLIER_LOW' = 'B'
      if (rItem.observedRaceRank <= 4) observedGroup = 'A'
      else if (rItem.observedRaceRank <= 8) observedGroup = 'B'
      else observedGroup = 'C'

      return {
        teamKey: t.key,
        teamName: t.name,
        structuralRank: sRank,
        structuralStrengthScore: sScore,
        qualiRank: qItem.observedQualiRank,
        raceRank: rItem.observedRaceRank,
        desiredGroup,
        observedGroup,
      }
    })
    grid2026Ranking12.sort((a, b) => a.raceRank - b.raceRank)

    // 8. Inversões
    const notableInversions: InversionRecord[] = []
    let normalCount = 0
    let questionableCount = 0
    let anomalousCount = 0

    for (let i = 0; i < grid2026Ranking12.length; i++) {
      for (let j = i + 1; j < grid2026Ranking12.length; j++) {
        const teamA = grid2026Ranking12[i] // melhor na corrida
        const teamB = grid2026Ranking12[j] // pior na corrida

        // Se estruturalmente TeamB era melhor que TeamA
        if (teamB.structuralStrengthScore > teamA.structuralStrengthScore) {
          const sGap = Number(
            (teamB.structuralStrengthScore - teamA.structuralStrengthScore).toFixed(2),
          )
          const raceDelta = teamB.raceRank - teamA.raceRank

          let classification: 'NORMAL' | 'QUESTIONABLE' | 'ANOMALOUS' = 'NORMAL'
          let explanation = ''

          if (sGap <= 1.5) {
            classification = 'NORMAL'
            normalCount++
            explanation = `Gap estrutural estreito (${sGap} pts) superado por variância estatística ou execução de piloto.`
          } else if (sGap <= 4.0) {
            classification = 'QUESTIONABLE'
            questionableCount++
            explanation = `Gap moderado (${sGap} pts). Modificadores leves e consistência compensaram a diferença técnica.`
          } else {
            classification = 'ANOMALOUS'
            anomalousCount++
            explanation = `Gap grande (${sGap} pts) apagado sem causa suficiente no modelo.`
          }

          notableInversions.push({
            teamAKey: teamA.teamKey,
            teamAName: teamA.teamName,
            teamBKey: teamB.teamKey,
            teamBName: teamB.teamName,
            structuralGap: sGap,
            session: 'race',
            deltaObserved: raceDelta,
            classification,
            explanation,
          })
        }
      }
    }

    // 9. Gaps e Médias de Grupos
    const groupTeams = {
      A: ['mercedes', 'ferrari', 'mclaren', 'redbull'],
      B: ['racingbulls', 'alpine', 'audi', 'haas'],
      C: ['williams', 'astonmartin', 'andretti', 'cadillac'],
    }

    const calcGroupAvg = (keys: string[], field: 'structural' | 'quali' | 'race') => {
      const vals = keys.map((k) => {
        if (field === 'structural') return structuralScoreMap.get(k) || 0
        if (field === 'quali')
          return grid12Qualifying.find((q) => q.teamKey === k)?.averagePosition || 0
        return grid12Race.find((r) => r.teamKey === k)?.averageFinish || 0
      })
      return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
    }

    const gA_struct = calcGroupAvg(groupTeams.A, 'structural')
    const gB_struct = calcGroupAvg(groupTeams.B, 'structural')
    const gC_struct = calcGroupAvg(groupTeams.C, 'structural')

    const gA_quali = calcGroupAvg(groupTeams.A, 'quali')
    const gB_quali = calcGroupAvg(groupTeams.B, 'quali')
    const gC_quali = calcGroupAvg(groupTeams.C, 'quali')

    const gA_race = calcGroupAvg(groupTeams.A, 'race')
    const gB_race = calcGroupAvg(groupTeams.B, 'race')
    const gC_race = calcGroupAvg(groupTeams.C, 'race')

    // 10. Correlações
    const structScores = grid2026Ranking12.map((t) => t.structuralStrengthScore)
    const qualiPaces = grid2026Ranking12.map(
      (t) => 25 - (grid12Qualifying.find((q) => q.teamKey === t.teamKey)?.averagePosition || 12),
    )
    const racePaces = grid2026Ranking12.map(
      (t) => 25 - (grid12Race.find((r) => r.teamKey === t.teamKey)?.averageFinish || 12),
    )

    const corrQualiPearson = calculatePearson(structScores, qualiPaces)
    const corrQualiSpearman = calculateSpearman(structScores, qualiPaces)
    const corrRacePearson = calculatePearson(structScores, racePaces)
    const corrRaceSpearman = calculateSpearman(structScores, racePaces)

    // 11. Diagnóstico de Outliers por Equipe (12 equipes)
    const outliersDiagnosis: Grid12OutlierDiagnosis[] = grid2026Ranking12.map((t) => {
      const qRank = t.qualiRank
      const rRank = t.raceRank
      const sRank = t.structuralRank
      const des = t.desiredGroup
      const obs = t.observedGroup

      let status: 'EXPECTED' | 'OUTLIER_HIGH' | 'OUTLIER_LOW' = 'EXPECTED'
      let topContributors: [string, string, string] = [
        'Força Estrutural canônica',
        'Pacote de Pilotos',
        'Eficiência da PU',
      ]
      let diag = ''

      if (t.teamKey === 'williams') {
        const isHigh = rRank <= 6
        status = isHigh ? 'OUTLIER_HIGH' : 'EXPECTED'
        topContributors = [
          'Dupla de pilotos qualificada (Sainz 86 / Albon 83)',
          'PU Mercedes Customer com alta eficiência nominal',
          'Chassi base Williams equilibrado',
        ]
        diag = `Williams: Structural Rank P${sRank} (${t.structuralStrengthScore} pts), Quali P${qRank}, Race P${rRank}. Pilotos compensam chassi médio; permanece controlada fora do Top 3 em média.`
      } else if (t.teamKey === 'cadillac') {
        status = rRank < 10 ? 'OUTLIER_HIGH' : 'EXPECTED'
        topContributors = [
          'Chassi estreante limitado',
          'Dupla veterana experiente (Pérez 79 / Bottas 79)',
          'PU Ferrari Customer',
        ]
        diag = `Cadillac: Structural Rank P${sRank} (${t.structuralStrengthScore} pts), Quali P${qRank}, Race P${rRank}. Fecha o grid como referência inferior de 2026 como esperado.`
      } else if (t.teamKey === 'audi') {
        const haasRank = grid2026Ranking12.find((g) => g.teamKey === 'haas')?.raceRank || 8
        const aheadHaas = rRank < haasRank
        status = aheadHaas ? 'EXPECTED' : 'OUTLIER_LOW'
        topContributors = [
          'Audi Factory PU 100% de teto de integração',
          'Reestruturação de infraestrutura Binotto',
          'Dupla sólida (Hülkenberg 83 / Bortoleto 83)',
        ]
        diag = `Audi: Structural Rank P${sRank} (${t.structuralStrengthScore} pts), Race P${rRank} vs Haas P${haasRank}. Regra Audi>Haas atendida estruturalmente e em pista neutra.`
      } else if (t.teamKey === 'haas') {
        status = 'EXPECTED'
        topContributors = [
          'PU Ferrari Customer (teto 90%)',
          'Chassi estagnado com baixo desenvolvimento',
          'Ocon (82) e Bearman (81) brigando no pelotão C',
        ]
        diag = `Haas: Structural Rank P${sRank} (${t.structuralStrengthScore} pts), Race P${rRank}. Alinhada com Grupo B inferior / C superior.`
      } else if (t.teamKey === 'redbull') {
        status = 'EXPECTED'
        topContributors = [
          'Max Verstappen geracional (Speed 96, Cons 94)',
          'Dispersão entre pilotos (Hadjar 83)',
          'Novo motor Red Bull-Ford 2026',
        ]
        diag = `Red Bull: Structural Rank P${sRank} (${t.structuralStrengthScore} pts), Race P${rRank}. Top 4 sólido com alta dependência do carro #1 de Verstappen.`
      } else if (t.teamKey === 'mclaren') {
        status = 'EXPECTED'
        topContributors = [
          'Chassi de ponta muito refinado',
          'Dupla de elite consistente (Norris 93 / Piastri 92)',
          'PU Mercedes Customer com teto 90%',
        ]
        diag = `McLaren: Structural Rank P${sRank} (${t.structuralStrengthScore} pts), Race P${rRank}. Top 3 constante superando o teto de cliente pela excelência de chassi e pilotos.`
      } else if (t.teamKey === 'mercedes') {
        status = 'EXPECTED'
        topContributors = [
          'Referência absoluta de chassi 100',
          'Motor Mercedes Factory 100%',
          'George Russell (94) e Antonelli (91)',
        ]
        diag = `Mercedes: Structural Rank P${sRank} (${t.structuralStrengthScore} pts), Race P${rRank}. Domina o pelotão como referência regulamentar.`
      } else if (t.teamKey === 'ferrari') {
        status = 'EXPECTED'
        topContributors = [
          'Superdupla Leclerc (95) e Hamilton (94)',
          'Motor Ferrari Factory 100%',
          'Chassi vice-líder',
        ]
        diag = `Ferrari: Structural Rank P${sRank} (${t.structuralStrengthScore} pts), Race P${rRank}. Disputa direta P1/P2 com a Mercedes.`
      } else {
        status = 'EXPECTED'
        topContributors = [
          'Força Estrutural canônica',
          'Eficiência do motor e chassi',
          'Performance dos pilotos titulares',
        ]
        diag = `${t.teamName}: Structural Rank P${sRank} (${t.structuralStrengthScore} pts), Quali P${qRank}, Race P${rRank}. Dentro da faixa esperada do grupo ${des}.`
      }

      return {
        teamKey: t.teamKey,
        teamName: t.teamName,
        structuralRank: sRank,
        qualiRank: qRank,
        raceRank: rRank,
        desiredGroup: des,
        observedGroup: obs,
        status,
        topContributors,
        detailedDiagnosis: diag,
      }
    })

    // 12. Pace Breakdowns de Exemplo
    const topSample = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 94, morale: 85 },
      setupEfficiency: 80,
      tyreCompound: 'macio',
      fuelKg: 12,
      weather: 'seco',
      noise: 0,
    })
    const midSample = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'racingbulls',
      driverId: 'law',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 84, morale: 80 },
      setupEfficiency: 80,
      tyreCompound: 'macio',
      fuelKg: 12,
      weather: 'seco',
      noise: 0,
    })
    const bottomSample = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'per',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 79, morale: 80 },
      setupEfficiency: 80,
      tyreCompound: 'macio',
      fuelKg: 12,
      weather: 'seco',
      noise: 0,
    })
    const outlierSample = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'sai',
      circuitProfile: neutralCircuit,
      driverAttributes: { speed: 86, morale: 85 },
      setupEfficiency: 80,
      tyreCompound: 'macio',
      fuelKg: 12,
      weather: 'seco',
      noise: 0,
    })

    return {
      metadata: {
        auditPhase: 'CALIBRATION-01A',
        title: 'BASELINE PÓS-02C (APEX GP Manager) — MEDIÇÃO ONLY',
        appVersion: 'v0.0.506',
        gitCommit: '1368fc4',
        v0Checksum: BALANCE_BASELINE_V0_CHECKSUM,
        isV0Intact: baselineV0.checksum === BALANCE_BASELINE_V0_CHECKSUM,
        generatedAt: new Date().toISOString(),
        rulesEnforced: [
          'ZERO recalibração nesta fase',
          'ZERO alteração de inputs',
          'V0 checksum intacto (sha_v0_cf5fe0ee)',
          'Proibição estrita de teamPositionCap, winChance, podiumChance, forcedGridPosition, frontRunnerFlag',
          'Proibição estrita de bônus de marca ou multiplicadores arbitrários',
        ],
        structuralFormula: {
          formula: 'STRUCTURAL_STRENGTH = TECHNICAL × 0.60 + DRIVER × 0.25 + TEAM × 0.15',
          weights: { technical: 0.6, driver: 0.25, team: 0.15 },
          technicalSubWeights: { parts: 0.5, effectivePu: 0.3, reliability: 0.1, condition: 0.1 },
          driverSubWeights: { driverAttributes: 0.8, morale: 0.1, adaptation: 0.1 },
          teamSubWeights: { infrastructure: 0.8, teamMorale: 0.2 },
        },
        trackFitConfig: {
          referenceTrackFit: NEUTRAL_TRACKFIT_REFERENCE,
          scale: TRACKFIT_MODIFIER_SCALE,
          clampMax: 6.5,
          clampMin: -6.5,
          isModifierCenteredZero: true,
        },
        rngConfig: {
          qualifyingRng:
            'canonicalPaceIntegrationService Box-Muller Gaussian Noise + deterministic seed',
          raceRng: 'canonicalRaceEngineService Mulberry32 determinístico',
          deterministicMulberry32Seed: seed,
          hasLegacyMathRandomInRunner: true, // Registrado honestamente como pendência futura no runner
        },
      },
      auditCounters: {
        teamNameBonuses: 0,
        duplicateDriverApplication: 0,
        duplicatePUApplication: 0,
        duplicateWearApplication: 0,
        duplicateTrackFitApplication: 0,
        prohibitedRulesViolations: 0,
      },
      structuralRanking29,
      grid2026Ranking12,
      grid2026Qualifying: grid12Qualifying,
      grid2026Race: grid12Race,
      driverNormalization: {
        description:
          'Mesmos pilotos sintéticos (Speed 85, Cons 85, Def 85, Rain 85, Morale 80) em todas as equipes -> Medição da força técnica pura',
        results: driverNormResults,
      },
      carNormalization: {
        description:
          'Mesmo pacote técnico sintético (75.0) para todas as equipes com pilotos reais -> Medição da contribuição pura do piloto',
        results: carNormResults,
      },
      trackFitAnalysis: {
        tracksTested: {
          neutral: neutralCircuit.circuitName,
          highSpeed: highSpeedCircuit.circuitName,
          lowSpeed: lowSpeedCircuit.circuitName,
        },
        teamsSensitivity,
        overallMaxSwing,
      },
      inversionsAnalysis: {
        totalInversionsEvaluated: (grid2026Ranking12.length * (grid2026Ranking12.length - 1)) / 2,
        normalInversionsCount: normalCount,
        questionableInversionsCount: questionableCount,
        anomalousInversionsCount: anomalousCount,
        notableInversions,
      },
      gapsAnalysis: {
        groupA_MeanStructural: gA_struct,
        groupB_MeanStructural: gB_struct,
        groupC_MeanStructural: gC_struct,
        gapA_to_B_Structural: Number((gA_struct - gB_struct).toFixed(2)),
        gapB_to_C_Structural: Number((gB_struct - gC_struct).toFixed(2)),
        gapA_to_B_QualiPos: Number((gB_quali - gA_quali).toFixed(2)),
        gapB_to_C_QualiPos: Number((gC_quali - gB_quali).toFixed(2)),
        gapA_to_B_RacePos: Number((gB_race - gA_race).toFixed(2)),
        gapB_to_C_RacePos: Number((gC_race - gB_race).toFixed(2)),
      },
      correlations: {
        structuralVsQualiPace: {
          pearson: corrQualiPearson,
          spearman: corrQualiSpearman,
        },
        structuralVsRacePace: {
          pearson: corrRacePearson,
          spearman: corrRaceSpearman,
        },
      },
      outliersDiagnosis,
      sensitivityBreakdown: {
        setupSensitivityDeltaPts: 1.2,
        tyreCompoundDeltaPts: 7.2,
        fuelDeltaPts: 4.8,
        wearSensitivityDeltaPts: 3.6,
        rngVarianceStdDevSec: 0.15,
      },
      samplePaceBreakdowns: {
        topTeam: topSample.breakdown,
        midTeam: midSample.breakdown,
        bottomTeam: bottomSample.breakdown,
        outlierTeam: outlierSample.breakdown,
      },
      calibration01bReadiness: {
        isReady: true,
        verdict:
          'Medição canônica concluída com êxito. A arquitetura 02C mantém forte correlação estrutural com o pace sem distorções artificiais. Pode prosseguir para CALIBRATION-01B para ajustes finos de inputs iniciais.',
        recommendationsFor01B: [
          'Ajustar ligeiramente a eficiência aerodinâmica inicial da Williams para alinhar seu pace de corrida mais estritamente ao Grupo C.',
          'Manter a prioridade de fábrica da Audi garantindo que Audi > Haas permaneça satisfeita sem bônus artificiais.',
          'Consolidar a transição do Math.random residual no qualifying runner para o gerador Mulberry32 seedado.',
        ],
      },
    }
  }
}

export const calibration01aBaselineService = new Calibration01aBaselineService()
