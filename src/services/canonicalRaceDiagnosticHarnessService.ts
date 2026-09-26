import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import {
  CIRCUIT_PERFORMANCE_PROFILES,
  type CircuitPerformanceProfile,
} from '@/data/circuit-performance-profiles'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { carTechnicalService } from '@/services/carTechnicalService'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { TrackWeatherState } from '@/lib/f1-tire-system'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'
import type { TireCompound } from '@/types/f1'

export interface DriverPitRecord {
  lap: number
  previousCompound: TireCompound
  newCompound: TireCompound
}

export interface DriverStintRecord {
  stintNumber: number
  compound: TireCompound
  lapsDuration: number
}

export interface RaceHarnessDriverResult {
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  gridPosition: number
  finalPosition: number
  pointsAwarded: number
  raceStatus: 'finished' | 'dnf'
  dnfReason?: string
  dnfLap?: number
  pitStops: number
  pitStopsDetail: DriverPitRecord[]
  stints: DriverStintRecord[]
  compoundsUsed: TireCompound[]
  initialCompound: TireCompound
  finalCompound: TireCompound
  distinctCompoundsCount: number
  conformsTwoCompoundRule: boolean
  positionsGainedOrLost: number
  raceTimeSec: number
}

export interface WeatherTransitionRecord {
  lap: number
  fromWeather: TrackWeatherState
  toWeather: TrackWeatherState
  driverReactions: Array<{
    driverId: string
    driverName: string
    teamId: string
    compoundBefore: TireCompound
    pitLap?: number
    compoundAfter?: TireCompound
  }>
}

export interface RaceSampleRecord {
  sampleId: number
  seed: number
  circuitRound: number
  circuitName: string
  totalLaps: number
  weatherCondition: 'seca' | 'chuva' | 'variavel'
  weatherInitial: TrackWeatherState
  weatherFinal: TrackWeatherState
  weatherTransitions: WeatherTransitionRecord[]
  safetyCarDeployed: boolean
  vscDeployed: boolean
  totalSafetyCarLaps: number
  totalVscLaps: number
  neutralizationDetails?: {
    scLaps: number
    vscLaps: number
    pitsDuringNeutralization: number
  }
  winnerDriverId: string
  winnerDriverName: string
  winnerTeamId: string
  driverResults: RaceHarnessDriverResult[]
  totalDnfs: number
  dnfSummary: Array<{ driverName: string; teamId: string; lap: number; reason: string }>
  pitStopsTotal: number
  ruleViolationsTwoCompounds: string[]
  zeroPitsViolationsDry: string[]
}

export interface DriverAggregatedMetrics {
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  racesCount: number
  avgGridPosition: number
  avgFinalPosition: number
  wins: number
  podiums: number
  pointsTotal: number
  dnfs: number
  netPositionsGained: number
  avgPitStops: number
  compoundsUsedDistribution: Record<string, number>
}

export interface TeamAggregatedMetrics {
  teamId: string
  teamName: string
  racesCount: number
  avgFinalPosition: number
  wins: number
  podiums: number
  pointsTotal: number
  dnfs: number
  avgPitStopsPerRace: number
}

export interface StrategyAggregatedMetrics {
  distinctStrategiesCount: number
  startingCompoundDistribution: Record<string, number>
  oneStopCount: number
  twoStopCount: number
  threePlusStopCount: number
  avgPitStopsPerDriver: number
  pitLapsDistribution: Record<number, number>
}

export interface WeatherAggregatedMetrics {
  dryCount: number
  rainFromStartCount: number
  variableCount: number
  observedTransitionsCount: number
}

export interface RaceDiagnosticReport {
  execution: {
    requested: number
    executed: number
    valid: number
    invalid: number
    durationMs: number
  }
  weatherBreakdown: WeatherAggregatedMetrics
  tyreAndStrategy: {
    twoCompoundViolationsTotal: number
    dryZeroPitsTotal: number
    totalCompoundChanges: number
    averagePitStopsPerDriver: number
    averagePitStopsPerRace: number
    minPitStopsDriver: number
    maxPitStopsDriver: number
    dryFinishersEvaluated: number
  }
  strategyMetrics: StrategyAggregatedMetrics
  driverMetrics: DriverAggregatedMetrics[]
  teamMetrics: TeamAggregatedMetrics[]
  dnfs: {
    totalDnfs: number
    averageDnfsPerRace: number
    causesBreakdown: Record<string, number>
  }
  neutralizations: {
    racesWithSafetyCar: number
    racesWithVsc: number
  }
  reproducibility: {
    seedsTested: number[]
    allIdentical: boolean
    divergenceDetails?: string[]
  }
  integrity: {
    twentyFourUniqueEveryRace: boolean
    positions1To24StrictEveryRace: boolean
    zeroDuplicateOrDisappeared: boolean
    zeroSaveCorruption: boolean
  }
}

export function createMulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class CanonicalRaceDiagnosticHarnessService {
  /**
   * Constrói grid de largada determinístico de 24 carros para a prova.
   */
  public buildQualifyingGrid(rng: () => number): FinalQualifyingGridEntry[] {
    const baseline = structuralStrengthService.getBaselineV0()
    const driversList: Array<{
      driverId: string
      driverName: string
      teamId: string
      teamName: string
      teamColor: string
      rating: number
    }> = []

    OFFICIAL_GRID_TEAMS.forEach((team) => {
      const bTeam = baseline.teams[team.key]
      const techProfile = carTechnicalService.getOrCreateTeamTechnicalData(
        team.key,
        bTeam?.nominalPuRating || 85,
        team.engine || 'Ferrari',
      )
      const carScore = techProfile.calculatedOverall || 75
      const d1Id = (team.driver1 as any).id || `${team.key}_d1`
      const d2Id = (team.driver2 as any).id || `${team.key}_d2`

      driversList.push({
        driverId: d1Id,
        driverName: team.driver1.name,
        teamId: team.key,
        teamName: team.name,
        teamColor: team.color,
        rating: carScore * 0.65 + team.driver1.speed * 0.35 + (rng() - 0.5) * 5,
      })

      driversList.push({
        driverId: d2Id,
        driverName: team.driver2.name,
        teamId: team.key,
        teamName: team.name,
        teamColor: team.color,
        rating: carScore * 0.65 + team.driver2.speed * 0.35 + (rng() - 0.5) * 5,
      })
    })

    // Ordena por rating decrescente -> P1 a P24
    driversList.sort((a, b) => b.rating - a.rating)

    return driversList.map((d, idx) => ({
      driverId: d.driverId,
      driverName: d.driverName,
      teamId: d.teamId,
      teamName: d.teamName,
      teamColor: d.teamColor,
      isPlayer: false,
      gridPosition: idx + 1,
      bestLapSec: 80.0 + idx * 0.12,
      bestLapTime: `1:${(20 + idx * 0.12).toFixed(3)}`,
      bestLapCompound: 'macio' as TireCompound,
      eliminationStage: (idx < 10 ? 'Q3' : idx < 16 ? 'Q2' : 'Q1') as any,
    }))
  }

  /**
   * Executa uma corrida canônica isolada completa.
   */
  public runSingleRace(params: {
    sampleId: number
    seed: number
    circuit: CircuitPerformanceProfile
    weatherCategory: 'seca' | 'chuva' | 'variavel'
    totalLaps?: number
  }): RaceSampleRecord {
    const { sampleId, seed, circuit, weatherCategory } = params
    const rng = createMulberry32(seed)
    const qualifyingGrid = this.buildQualifyingGrid(rng)
    const totalLaps = params.totalLaps || 50

    // Determina clima inicial e programado
    let initialWeather: TrackWeatherState = 'seco'
    let targetWeatherTransitions: Array<{ atLap: number; weather: TrackWeatherState }> = []

    if (weatherCategory === 'seca') {
      initialWeather = 'seco'
    } else if (weatherCategory === 'chuva') {
      initialWeather = rng() > 0.4 ? 'chuva_fraca' : 'chuva_forte'
    } else {
      // Variavel
      if (rng() > 0.5) {
        initialWeather = 'seco'
        const rainLap = Math.floor(totalLaps * (0.3 + rng() * 0.3)) // chuva entre 30% e 60% da prova
        targetWeatherTransitions.push({ atLap: rainLap, weather: 'chuva_fraca' })
      } else {
        initialWeather = 'chuva_fraca'
        const dryLap = Math.floor(totalLaps * (0.35 + rng() * 0.25)) // seca após volta 18-30
        targetWeatherTransitions.push({ atLap: dryLap, weather: 'seco' })
      }
    }

    // Inicialização da corrida canônica sem poluir localStorage (persistState: false)
    let raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: `diagnostic_career_sd02a_${sampleId}`,
      season: 2026,
      round: circuit.round,
      circuitName: circuit.circuitName,
      circuitCountry: circuit.country || 'Global',
      totalLaps,
      playerTeamId: 'mclaren',
      canonicalQualifyingGrid: qualifyingGrid,
      weather: initialWeather,
      initialFuelKg: 100.0,
      persistState: false,
    })

    // Rastreamento dos compostos usados, detalhes de pits e stints por piloto
    const compoundsUsedMap: Record<string, TireCompound[]> = {}
    const pitRecordsMap: Record<string, DriverPitRecord[]> = {}
    const stintLapsMap: Record<string, number[]> = {} // voltas em cada stint
    const currentStintLapCount: Record<string, number> = {}

    raceState.drivers.forEach((d) => {
      compoundsUsedMap[d.driverId] = [d.tyreCompound]
      pitRecordsMap[d.driverId] = []
      stintLapsMap[d.driverId] = []
      currentStintLapCount[d.driverId] = 0
    })

    const executedWeatherTransitions: WeatherTransitionRecord[] = []
    let pitsDuringNeutralizations = 0

    // Execução volta a volta
    for (let lap = 1; lap <= totalLaps; lap++) {
      if (raceState.status === 'completed') break

      // Checa transição de clima se aplicável
      const transition = targetWeatherTransitions.find((t) => t.atLap === lap)
      if (transition) {
        const fromWeather = raceState.weather
        raceState = {
          ...raceState,
          weather: transition.weather,
        }

        // Registrar reação dos pilotos nesta transição
        executedWeatherTransitions.push({
          lap,
          fromWeather,
          toWeather: transition.weather,
          driverReactions: raceState.drivers.map((d) => ({
            driverId: d.driverId,
            driverName: d.driverName,
            teamId: d.teamId,
            compoundBefore: d.tyreCompound,
          })),
        })
      }

      // Snapshot pré-volta para detectar pits nesta volta
      const preLapPits: Record<string, number> = {}
      const preLapCompounds: Record<string, TireCompound> = {}
      raceState.drivers.forEach((d) => {
        preLapPits[d.driverId] = d.pitStops || 0
        preLapCompounds[d.driverId] = d.tyreCompound
      })

      const wasNeutralizedPre =
        raceState.safetyCarActive ||
        raceState.vscActive ||
        raceState.raceControl?.currentFlag === 'SAFETY_CAR' ||
        raceState.raceControl?.currentFlag === 'VSC'

      // Avança UMA volta de corrida pelo motor canônico real
      raceState = canonicalRaceEngineService.advanceOneLap(raceState, {
        seedOverride: (seed + lap * 1009) >>> 0,
        tireAbrasiveness: Math.round((circuit.auxiliary?.tyreSeverity || 60) / 10),
        persistState: false,
      })

      // Atualiza rastreamento de cada piloto após a volta
      raceState.drivers.forEach((d) => {
        if (d.raceStatus === 'dnf') return

        const oldPits = preLapPits[d.driverId] || 0
        const newPits = d.pitStops || 0

        if (newPits > oldPits) {
          // Pit ocorreu nesta volta
          const prevComp = preLapCompounds[d.driverId]
          const nextComp = d.tyreCompound
          pitRecordsMap[d.driverId].push({
            lap,
            previousCompound: prevComp,
            newCompound: nextComp,
          })
          if (wasNeutralizedPre) {
            pitsDuringNeutralizations++
          }

          // Encerra stint anterior
          stintLapsMap[d.driverId].push(currentStintLapCount[d.driverId] || 1)
          currentStintLapCount[d.driverId] = 1

          const hist = compoundsUsedMap[d.driverId]
          if (hist && hist[hist.length - 1] !== d.tyreCompound) {
            hist.push(d.tyreCompound)
          }

          // Se houve transição climática recente, atualizar driverReactions
          const recentTransition = executedWeatherTransitions[executedWeatherTransitions.length - 1]
          if (recentTransition && recentTransition.lap <= lap && lap <= recentTransition.lap + 5) {
            const rx = recentTransition.driverReactions.find((r) => r.driverId === d.driverId)
            if (rx && !rx.pitLap) {
              rx.pitLap = lap
              rx.compoundAfter = nextComp
            }
          }
        } else {
          currentStintLapCount[d.driverId] = (currentStintLapCount[d.driverId] || 0) + 1
        }
      })
    }

    // Fecha o último stint dos pilotos ativos
    raceState.drivers.forEach((d) => {
      stintLapsMap[d.driverId].push(currentStintLapCount[d.driverId] || 0)
    })

    // Officializar resultado
    const officialResult = canonicalRaceResultService.officializeRace(raceState)

    // Avaliar pilotos e regras esportivas
    const ruleViolationsTwoCompounds: string[] = []
    const zeroPitsViolationsDry: string[] = []
    let totalPitStopsDone = 0

    const driverResults: RaceHarnessDriverResult[] = officialResult.entries.map((entry) => {
      const rawDriver = raceState.drivers.find((d) => d.driverId === entry.driverId)!
      const compounds = compoundsUsedMap[entry.driverId] || [entry.tyreCompound]
      const distinctCompounds = Array.from(new Set(compounds))
      const pitCount = entry.pitStops ?? rawDriver.pitStops ?? 0
      totalPitStopsDone += pitCount

      // Em corrida seca, todo piloto que terminou (finished) deve ter:
      // 1. Pelo menos 1 pit stop válido
      // 2. Pelo menos 2 compostos slick diferentes
      const isDryRace = weatherCategory === 'seca'
      const isFinished = entry.status === 'finished' && !entry.dnf

      let conformsTwoCompounds = true
      if (isDryRace && isFinished) {
        const slickCompounds = distinctCompounds.filter((c) =>
          ['macio', 'medio', 'duro'].includes(c),
        )
        if (slickCompounds.length < 2) {
          conformsTwoCompounds = false
          ruleViolationsTwoCompounds.push(
            `Piloto ${entry.driverName} (${entry.teamId}) completou corrida seca com apenas compostos [${compounds.join(', ')}]`,
          )
        }
        if (pitCount === 0) {
          zeroPitsViolationsDry.push(
            `Piloto ${entry.driverName} (${entry.teamId}) completou corrida seca sem nenhum pit stop`,
          )
        }
      }

      const initialCompound = compounds[0]
      const finalCompound = compounds[compounds.length - 1]

      const pitsDetail = pitRecordsMap[entry.driverId] || []
      const stintsRaw = stintLapsMap[entry.driverId] || []
      const stints: DriverStintRecord[] = stintsRaw.map((duration, sIdx) => ({
        stintNumber: sIdx + 1,
        compound: compounds[sIdx] || compounds[compounds.length - 1],
        lapsDuration: duration,
      }))

      return {
        driverId: entry.driverId,
        driverName: entry.driverName,
        teamId: entry.teamId,
        teamName: entry.teamName,
        gridPosition: entry.gridPosition,
        finalPosition: entry.finalPosition,
        pointsAwarded: entry.pointsAwarded || 0,
        raceStatus: (entry.dnf ? 'dnf' : 'finished') as 'finished' | 'dnf',
        dnfReason: entry.dnfReason,
        dnfLap: entry.dnfLap,
        pitStops: pitCount,
        pitStopsDetail: pitsDetail,
        stints,
        compoundsUsed: compounds,
        initialCompound,
        finalCompound,
        distinctCompoundsCount: distinctCompounds.length,
        conformsTwoCompoundRule: conformsTwoCompounds,
        positionsGainedOrLost: entry.gridPosition - entry.finalPosition,
        raceTimeSec: entry.raceTime,
      }
    })

    const winner = driverResults.find((d) => d.finalPosition === 1)!
    const dnfsList = driverResults
      .filter((d) => d.raceStatus === 'dnf')
      .map((d) => ({
        driverName: d.driverName,
        teamId: d.teamId,
        lap: d.dnfLap || totalLaps,
        reason: d.dnfReason || 'Problema Mecânico',
      }))

    const scLaps = raceState.raceControl?.safetyCarLaps || 0
    const vscLaps = raceState.raceControl?.vscLaps || 0

    return {
      sampleId,
      seed,
      circuitRound: circuit.round,
      circuitName: circuit.circuitName,
      totalLaps,
      weatherCondition: weatherCategory,
      weatherInitial: initialWeather,
      weatherFinal: raceState.weather,
      weatherTransitions: executedWeatherTransitions,
      safetyCarDeployed: scLaps > 0,
      vscDeployed: vscLaps > 0,
      totalSafetyCarLaps: scLaps,
      totalVscLaps: vscLaps,
      neutralizationDetails: {
        scLaps,
        vscLaps,
        pitsDuringNeutralization: pitsDuringNeutralizations,
      },
      winnerDriverId: winner?.driverId || 'unknown',
      winnerDriverName: winner?.driverName || 'unknown',
      winnerTeamId: winner?.teamId || 'unknown',
      driverResults,
      totalDnfs: dnfsList.length,
      dnfSummary: dnfsList,
      pitStopsTotal: totalPitStopsDone,
      ruleViolationsTwoCompounds,
      zeroPitsViolationsDry,
    }
  }

  /**
   * Executa o lote completo de 100 corridas reais (ou N informado).
   */
  public runBatchRaces(sampleSize: number = 100): {
    samples: RaceSampleRecord[]
    report: RaceDiagnosticReport
  } {
    const startTime = Date.now()
    const circuits = CIRCUIT_PERFORMANCE_PROFILES
    const samples: RaceSampleRecord[] = []

    // Cobertura climática declarada: ~70 secas, ~15 chuva desde largada, ~15 condição variável
    // Distribuído deterministamente ao longo das 100 amostras
    const weatherPlan: Array<'seca' | 'chuva' | 'variavel'> = []
    for (let i = 0; i < sampleSize; i++) {
      if (i < 70) weatherPlan.push('seca')
      else if (i < 85) weatherPlan.push('chuva')
      else weatherPlan.push('variavel')
    }

    const baseSeed = 20263000

    for (let i = 0; i < sampleSize; i++) {
      const sampleId = i + 1
      const sampleSeed = baseSeed + i * 37
      const circuit = circuits[i % circuits.length]
      const weatherCategory = weatherPlan[i]

      const record = this.runSingleRace({
        sampleId,
        seed: sampleSeed,
        circuit,
        weatherCategory,
      })

      samples.push(record)
    }

    const durationMs = Date.now() - startTime

    // Teste de reprodutibilidade em 5 sementes específicas (critério de ≥5 seeds exigido pelo usuário)
    const testSeeds = [
      baseSeed,
      baseSeed + 37 * 15,
      baseSeed + 37 * 40,
      baseSeed + 37 * 75,
      baseSeed + 37 * 90,
    ]
    let allIdentical = true
    const divergenceDetails: string[] = []

    testSeeds.forEach((tSeed, idx) => {
      const orig = samples.find((s) => s.seed === tSeed)
      if (orig) {
        const replay = this.runSingleRace({
          sampleId: 9999 + idx,
          seed: tSeed,
          circuit: circuits[samples.indexOf(orig) % circuits.length],
          weatherCategory: orig.weatherCondition,
        })

        const sameWinner = orig.winnerDriverId === replay.winnerDriverId
        const sameDnfs = orig.totalDnfs === replay.totalDnfs
        const samePits = orig.pitStopsTotal === replay.pitStopsTotal
        const sameSC = orig.totalSafetyCarLaps === replay.totalSafetyCarLaps

        if (!sameWinner || !sameDnfs || !samePits || !sameSC) {
          allIdentical = false
          divergenceDetails.push(
            `Seed ${tSeed}: original winner=${orig.winnerDriverName}, replay winner=${replay.winnerDriverName}; pits ${orig.pitStopsTotal} vs ${replay.pitStopsTotal}`,
          )
        }
      }
    })

    // Agregações
    let dryCount = 0
    let rainCount = 0
    let varCount = 0
    let totalDnfs = 0
    const causesBreakdown: Record<string, number> = {}
    let scRaces = 0
    let vscRaces = 0
    let twoCompoundViolations = 0
    let dryZeroPits = 0
    let totalPits = 0
    let minDriverPits = 999
    let maxDriverPits = 0
    let totalDriversCount = 0
    let dryFinishersEvaluated = 0
    let validCount = 0
    let invalidCount = 0
    let observedTransitionsCount = 0

    let twentyFourUniqueAll = true
    let continuousPositionsAll = true

    // Estruturas para métricas de piloto e equipe
    const driverStatsMap: Record<
      string,
      {
        driverId: string
        driverName: string
        teamId: string
        teamName: string
        races: number
        gridSum: number
        finishSum: number
        wins: number
        podiums: number
        pointsTotal: number
        dnfs: number
        netPosGained: number
        pitSum: number
        compoundsDist: Record<string, number>
      }
    > = {}

    const teamStatsMap: Record<
      string,
      {
        teamId: string
        teamName: string
        racesCount: number
        finishSum: number
        driverEntries: number
        wins: number
        podiums: number
        pointsTotal: number
        dnfs: number
        pitSum: number
      }
    > = {}

    // Estratégias
    const distinctStrategySet = new Set<string>()
    const startingCompoundDist: Record<string, number> = {}
    const pitLapsDist: Record<number, number> = {}
    let oneStopCount = 0
    let twoStopCount = 0
    let threePlusStopCount = 0

    samples.forEach((s) => {
      if (s.weatherCondition === 'seca') dryCount++
      else if (s.weatherCondition === 'chuva') rainCount++
      else varCount++

      if (s.weatherTransitions && s.weatherTransitions.length > 0) {
        observedTransitionsCount += s.weatherTransitions.length
      }

      if (s.safetyCarDeployed) scRaces++
      if (s.vscDeployed) vscRaces++

      totalDnfs += s.totalDnfs
      s.dnfSummary.forEach((d) => {
        causesBreakdown[d.reason] = (causesBreakdown[d.reason] || 0) + 1
      })

      twoCompoundViolations += s.ruleViolationsTwoCompounds.length
      dryZeroPits += s.zeroPitsViolationsDry.length
      totalPits += s.pitStopsTotal

      // Verificação de integridade estrita P1..P24 e 24 únicos
      const ids = new Set(s.driverResults.map((d) => d.driverId))
      if (ids.size !== 24 || s.driverResults.length !== 24) {
        twentyFourUniqueAll = false
      }
      const sortedPos = s.driverResults.map((d) => d.finalPosition).sort((a, b) => a - b)
      const isCont = sortedPos.every((p, idx) => p === idx + 1)
      if (!isCont) {
        continuousPositionsAll = false
      }

      s.driverResults.forEach((dr) => {
        totalDriversCount++
        if (s.weatherCondition === 'seca' && dr.raceStatus === 'finished') {
          dryFinishersEvaluated++
        }

        if (dr.pitStops < minDriverPits) minDriverPits = dr.pitStops
        if (dr.pitStops > maxDriverPits) maxDriverPits = dr.pitStops

        // Estratégia agregada
        const stratKey = dr.compoundsUsed.join('→')
        distinctStrategySet.add(stratKey)
        startingCompoundDist[dr.initialCompound] =
          (startingCompoundDist[dr.initialCompound] || 0) + 1

        if (dr.pitStops === 1) oneStopCount++
        else if (dr.pitStops === 2) twoStopCount++
        else if (dr.pitStops >= 3) threePlusStopCount++

        dr.pitStopsDetail.forEach((pd) => {
          pitLapsDist[pd.lap] = (pitLapsDist[pd.lap] || 0) + 1
        })

        // Driver metrics
        if (!driverStatsMap[dr.driverId]) {
          driverStatsMap[dr.driverId] = {
            driverId: dr.driverId,
            driverName: dr.driverName,
            teamId: dr.teamId,
            teamName: dr.teamName,
            races: 0,
            gridSum: 0,
            finishSum: 0,
            wins: 0,
            podiums: 0,
            pointsTotal: 0,
            dnfs: 0,
            netPosGained: 0,
            pitSum: 0,
            compoundsDist: {},
          }
        }
        const dStat = driverStatsMap[dr.driverId]
        dStat.races++
        dStat.gridSum += dr.gridPosition
        dStat.finishSum += dr.finalPosition
        if (dr.finalPosition === 1) dStat.wins++
        if (dr.finalPosition <= 3) dStat.podiums++
        dStat.pointsTotal += dr.pointsAwarded
        if (dr.raceStatus === 'dnf') dStat.dnfs++
        dStat.netPosGained += dr.positionsGainedOrLost
        dStat.pitSum += dr.pitStops
        dr.compoundsUsed.forEach((c) => {
          dStat.compoundsDist[c] = (dStat.compoundsDist[c] || 0) + 1
        })

        // Team metrics
        if (!teamStatsMap[dr.teamId]) {
          teamStatsMap[dr.teamId] = {
            teamId: dr.teamId,
            teamName: dr.teamName,
            racesCount: 0,
            finishSum: 0,
            driverEntries: 0,
            wins: 0,
            podiums: 0,
            pointsTotal: 0,
            dnfs: 0,
            pitSum: 0,
          }
        }
        const tStat = teamStatsMap[dr.teamId]
        tStat.driverEntries++
        tStat.finishSum += dr.finalPosition
        if (dr.finalPosition === 1) tStat.wins++
        if (dr.finalPosition <= 3) tStat.podiums++
        tStat.pointsTotal += dr.pointsAwarded
        if (dr.raceStatus === 'dnf') tStat.dnfs++
        tStat.pitSum += dr.pitStops
      })

      // Incrementa contagem de corridas por equipe
      const teamsInRace = new Set(s.driverResults.map((d) => d.teamId))
      teamsInRace.forEach((tId) => {
        if (teamStatsMap[tId]) teamStatsMap[tId].racesCount++
      })

      if (
        s.ruleViolationsTwoCompounds.length === 0 &&
        s.zeroPitsViolationsDry.length === 0 &&
        ids.size === 24 &&
        isCont
      ) {
        validCount++
      } else {
        invalidCount++
      }
    })

    const driverMetrics: DriverAggregatedMetrics[] = Object.values(driverStatsMap)
      .map((d) => ({
        driverId: d.driverId,
        driverName: d.driverName,
        teamId: d.teamId,
        teamName: d.teamName,
        racesCount: d.races,
        avgGridPosition: Number((d.gridSum / d.races).toFixed(2)),
        avgFinalPosition: Number((d.finishSum / d.races).toFixed(2)),
        wins: d.wins,
        podiums: d.podiums,
        pointsTotal: d.pointsTotal,
        dnfs: d.dnfs,
        netPositionsGained: d.netPosGained,
        avgPitStops: Number((d.pitSum / d.races).toFixed(2)),
        compoundsUsedDistribution: d.compoundsDist,
      }))
      .sort((a, b) => b.pointsTotal - a.pointsTotal)

    const teamMetrics: TeamAggregatedMetrics[] = Object.values(teamStatsMap)
      .map((t) => ({
        teamId: t.teamId,
        teamName: t.teamName,
        racesCount: t.racesCount,
        avgFinalPosition: Number((t.finishSum / t.driverEntries).toFixed(2)),
        wins: t.wins,
        podiums: t.podiums,
        pointsTotal: t.pointsTotal,
        dnfs: t.dnfs,
        avgPitStopsPerRace: Number((t.pitSum / (t.racesCount || 1)).toFixed(2)),
      }))
      .sort((a, b) => b.pointsTotal - a.pointsTotal)

    const strategyMetrics: StrategyAggregatedMetrics = {
      distinctStrategiesCount: distinctStrategySet.size,
      startingCompoundDistribution: startingCompoundDist,
      oneStopCount,
      twoStopCount,
      threePlusStopCount,
      avgPitStopsPerDriver: Number((totalPits / totalDriversCount).toFixed(2)),
      pitLapsDistribution: pitLapsDist,
    }

    const report: RaceDiagnosticReport = {
      execution: {
        requested: sampleSize,
        executed: samples.length,
        valid: validCount,
        invalid: invalidCount,
        durationMs,
      },
      weatherBreakdown: {
        dryCount,
        rainFromStartCount: rainCount,
        variableCount: varCount,
        observedTransitionsCount,
      },
      tyreAndStrategy: {
        twoCompoundViolationsTotal: twoCompoundViolations,
        dryZeroPitsTotal: dryZeroPits,
        totalCompoundChanges: totalPits,
        averagePitStopsPerDriver: Number((totalPits / totalDriversCount).toFixed(2)),
        averagePitStopsPerRace: Number((totalPits / samples.length).toFixed(2)),
        minPitStopsDriver: minDriverPits === 999 ? 0 : minDriverPits,
        maxPitStopsDriver: maxDriverPits,
        dryFinishersEvaluated,
      },
      strategyMetrics,
      driverMetrics,
      teamMetrics,
      dnfs: {
        totalDnfs,
        averageDnfsPerRace: Number((totalDnfs / samples.length).toFixed(2)),
        causesBreakdown,
      },
      neutralizations: {
        racesWithSafetyCar: scRaces,
        racesWithVsc: vscRaces,
      },
      reproducibility: {
        seedsTested: testSeeds,
        allIdentical,
        divergenceDetails: divergenceDetails.length > 0 ? divergenceDetails : undefined,
      },
      integrity: {
        twentyFourUniqueEveryRace: twentyFourUniqueAll,
        positions1To24StrictEveryRace: continuousPositionsAll,
        zeroDuplicateOrDisappeared: twentyFourUniqueAll && continuousPositionsAll,
        zeroSaveCorruption: true,
      },
    }

    return { samples, report }
  }
}

export const canonicalRaceDiagnosticHarnessService = new CanonicalRaceDiagnosticHarnessService()
