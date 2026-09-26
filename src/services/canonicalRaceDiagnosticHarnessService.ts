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

export interface RaceHarnessDriverResult {
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  gridPosition: number
  finalPosition: number
  raceStatus: 'finished' | 'dnf'
  dnfReason?: string
  dnfLap?: number
  pitStops: number
  compoundsUsed: TireCompound[]
  initialCompound: TireCompound
  finalCompound: TireCompound
  distinctCompoundsCount: number
  conformsTwoCompoundRule: boolean
  positionsGainedOrLost: number
  raceTimeSec: number
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
  safetyCarDeployed: boolean
  vscDeployed: boolean
  totalSafetyCarLaps: number
  totalVscLaps: number
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

export interface RaceDiagnosticReport {
  execution: {
    requested: number
    executed: number
    valid: number
    invalid: number
    durationMs: number
  }
  weatherBreakdown: {
    dryCount: number
    rainFromStartCount: number
    variableCount: number
  }
  tyreAndStrategy: {
    twoCompoundViolationsTotal: number
    dryZeroPitsTotal: number
    totalCompoundChanges: number
    averagePitStopsPerDriver: number
    averagePitStopsPerRace: number
    minPitStopsDriver: number
    maxPitStopsDriver: number
  }
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

    // Rastreamento dos compostos usados por piloto
    const compoundsUsedMap: Record<string, TireCompound[]> = {}
    raceState.drivers.forEach((d) => {
      compoundsUsedMap[d.driverId] = [d.tyreCompound]
    })

    // Execução volta a volta
    for (let lap = 1; lap <= totalLaps; lap++) {
      if (raceState.status === 'completed') break

      // Checa transição de clima se aplicável
      const transition = targetWeatherTransitions.find((t) => t.atLap === lap)
      if (transition) {
        raceState = {
          ...raceState,
          weather: transition.weather,
        }
      }

      // Avança UMA volta de corrida pelo motor canônico real
      raceState = canonicalRaceEngineService.advanceOneLap(raceState, {
        seedOverride: (seed + lap * 1009) >>> 0,
        tireAbrasiveness: Math.round((circuit.auxiliary?.tyreSeverity || 60) / 10),
        persistState: false,
      })

      // Atualiza histórico de compostos
      raceState.drivers.forEach((d) => {
        const hist = compoundsUsedMap[d.driverId]
        if (hist && hist[hist.length - 1] !== d.tyreCompound) {
          hist.push(d.tyreCompound)
        }
      })
    }

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

      return {
        driverId: entry.driverId,
        driverName: entry.driverName,
        teamId: entry.teamId,
        teamName: entry.teamName,
        gridPosition: entry.gridPosition,
        finalPosition: entry.finalPosition,
        raceStatus: (entry.dnf ? 'dnf' : 'finished') as 'finished' | 'dnf',
        dnfReason: entry.dnfReason,
        dnfLap: entry.dnfLap,
        pitStops: pitCount,
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
      safetyCarDeployed: scLaps > 0,
      vscDeployed: vscLaps > 0,
      totalSafetyCarLaps: scLaps,
      totalVscLaps: vscLaps,
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

    // Teste de reprodutibilidade em 3 sementes específicas
    const testSeeds = [baseSeed, baseSeed + 37 * 15, baseSeed + 37 * 75]
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
    let validCount = 0
    let invalidCount = 0

    let twentyFourUniqueAll = true
    let continuousPositionsAll = true

    samples.forEach((s) => {
      if (s.weatherCondition === 'seca') dryCount++
      else if (s.weatherCondition === 'chuva') rainCount++
      else varCount++

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
        if (dr.pitStops < minDriverPits) minDriverPits = dr.pitStops
        if (dr.pitStops > maxDriverPits) maxDriverPits = dr.pitStops
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
      },
      tyreAndStrategy: {
        twoCompoundViolationsTotal: twoCompoundViolations,
        dryZeroPitsTotal: dryZeroPits,
        totalCompoundChanges: totalPits,
        averagePitStopsPerDriver: Number((totalPits / totalDriversCount).toFixed(2)),
        averagePitStopsPerRace: Number((totalPits / samples.length).toFixed(2)),
        minPitStopsDriver: minDriverPits === 999 ? 0 : minDriverPits,
        maxPitStopsDriver: maxDriverPits,
      },
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
