import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'
import {
  TIRE_SPECS,
  calculateTireCliffStatus,
  calculatePitStopDuration,
  type TrackWeatherState,
} from '@/lib/f1-tire-system'
import {
  calculateFreeLapPaceSec,
  evaluateOvertakeAttempt,
  getCircuitOvertakeFactor,
  formatLapTime,
  formatGap,
} from '@/lib/f1-race-sim-engine'
import { rollMechanicalFailures } from '@/lib/raceDrama'
import { carTechnicalService } from '@/services/carTechnicalService'
import type { SimDriverEntry } from '@/pages/race/types'
import type { LiveRaceEvent } from '@/types/race-events'
import type { LapRecord } from '@/components/race/LiveStandingsTable'
import type { TeamModel } from '@/types/f1'

export interface AdvanceOneLapParams {
  currentLap: number
  totalLaps: number
  grid: SimDriverEntry[]
  weather: TrackWeatherState
  round: number
  gpName: string
  circuitName: string
  tireAbrasiveness: number
  team: TeamModel | null
  playerCarTactics: Record<string, 'attack' | 'normal' | 'save_fuel'>
  playerPaceOrders: Record<string, 'normal' | 'empurrar' | 'segurar'>
  mechanicalIssues: Array<{
    driverId: string
    name: string
    severity: 'minor' | 'moderate' | 'severe'
    isDnf?: boolean
    pacePenaltySec?: number
  }>
  redFlagState: {
    active: boolean
    ticksFrozen: number
    usedThisRace: boolean
    safetyCarLapsRemaining: number
  }
  lapHistory: Record<string, LapRecord[]>
}

export interface AdvanceOneLapResult {
  nextLap: number
  nextGrid: SimDriverEntry[]
  nextEvents: LiveRaceEvent[]
  nextLapHistory: Record<string, LapRecord[]>
  nextMechanicalIssues: AdvanceOneLapParams['mechanicalIssues']
  nextRedFlagState: AdvanceOneLapParams['redFlagState']
  isCompleted: boolean
}

export function advanceCanonicalRaceLap(params: AdvanceOneLapParams): AdvanceOneLapResult {
  const {
    currentLap,
    totalLaps,
    grid,
    weather,
    round,
    gpName,
    circuitName,
    tireAbrasiveness,
    team,
    playerCarTactics,
    playerPaceOrders,
    mechanicalIssues,
    redFlagState,
    lapHistory,
  } = params

  let currentGrid = grid.map((c) => ({ ...c }))
  let nextLap = Math.min(totalLaps, currentLap + 1)
  const isCompleted = nextLap >= totalLaps
  const circuitProfile = resolveCircuitProfile({ round })
  const circuitOvertakeFactor = getCircuitOvertakeFactor(gpName, circuitName)
  const newEventsThisLap: LiveRaceEvent[] = []

  // 1. Resolução técnica do jogador
  const playerEnrichedTech = carTechnicalService.ensureTechnicalData(team)
  const playerTechAttributes = playerEnrichedTech.technical_attributes
  const playerChassisRating = playerEnrichedTech.calculated_overall || team?.strength || 75
  const playerPuSupplier = team?.engine_supplier || 'Audi'
  const playerPu = OFFICIAL_POWER_UNITS[playerPuSupplier] || OFFICIAL_POWER_UNITS.Audi
  const playerPuRating = Number(
    (playerPu.powerRating * 0.6 + playerPu.reliabilityRating * 0.4).toFixed(1),
  )
  const playerCarPerfRating = Number((playerChassisRating * 0.7 + playerPuRating * 0.3).toFixed(1))

  // 2. Falhas mecânicas via drama engine
  const dramaContexts = currentGrid.map((entry) => ({
    id: entry.driverId,
    name: entry.driverName,
    teamId: entry.teamId,
    position: entry.position || 99,
    accumulatedTimeSec: entry.accumulatedTimeSec || 0,
    gapToLeaderSec: 0,
    isPlayer: !!entry.isPlayer,
    dnf: !!entry.dnf,
    dnfReason: entry.dnfReason,
    carPartsHealth: entry.carPartsHealth,
    paceOrder: entry.isPlayer ? playerPaceOrders[entry.driverId] || 'normal' : 'normal',
    tacticalMode: entry.isPlayer ? playerCarTactics[entry.driverId] || 'normal' : 'normal',
    hasWingDamage: !!entry.hasWingDamage,
  }))

  const mechRoll = rollMechanicalFailures(dramaContexts, nextLap, {
    isWet: weather !== 'seco',
  })

  let updatedMechIssues = [...mechanicalIssues]
  if (mechRoll.issues && mechRoll.issues.length > 0) {
    const light = mechRoll.issues
      .filter((i) => !i.isDnf)
      .map((i) => {
        const sev: 'minor' | 'moderate' | 'severe' = i.severity === 'grave' ? 'severe' : 'minor'
        return {
          driverId: i.driverId,
          name: (i as any).name || (i as any).component || 'Problema Mecânico',
          severity: sev,
          isDnf: false,
          pacePenaltySec: i.pacePenaltySec || 0.5,
        }
      })
    updatedMechIssues = [...updatedMechIssues, ...light]
  }

  // DNFs novos
  if (mechRoll.newDnfs && mechRoll.newDnfs.length > 0) {
    mechRoll.newDnfs.forEach((nd) => {
      const car = currentGrid.find((g) => g.driverId === nd.driverId)
      if (car && !car.dnf) {
        car.dnf = true
        car.dnfLap = nextLap
        car.dnfReason = nd.reason
        newEventsThisLap.push({
          id: `ev_dnf_${nextLap}_${nd.driverId}`,
          lap: nextLap,
          type: 'incident',
          message: `🚨 ${nd.reason} — ${nd.driverName}`,
          driverName: nd.driverName,
          teamColor: car.teamColor,
          isPlayer: car.isPlayer,
          timestamp: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        })
      }
    })
  }

  const previousTrackOrder = [...currentGrid]
    .filter((c) => !c.dnf)
    .sort((a, b) => (a.position || 99) - (b.position || 99))

  // 3. Ritmo de volta livre e consumo
  const intermediateStates = currentGrid.map((entry) => {
    if (entry.dnf) return { entry, freeLapSec: 0, pitLossSec: 0 }

    const playerTactic = entry.isPlayer ? playerCarTactics[entry.driverId] || 'normal' : 'normal'
    const playerPace = entry.isPlayer ? playerPaceOrders[entry.driverId] || 'normal' : 'normal'

    const spec = TIRE_SPECS[entry.tireCompound || 'medio'] || TIRE_SPECS.medio
    const compoundWearRate = spec.wearFactor
    const driverMultiplier = entry.wearMultiplier ?? 1.0

    let tireWearMultiplier = 1.0
    if (playerTactic === 'attack') tireWearMultiplier = 1.3
    else if (playerTactic === 'save_fuel') tireWearMultiplier = 0.75

    if (playerPace === 'segurar') tireWearMultiplier *= 0.65
    else if (playerPace === 'empurrar') tireWearMultiplier *= 1.25

    const inc =
      ((compoundWearRate * (tireAbrasiveness / 5)) / 1.5) * driverMultiplier * tireWearMultiplier
    const currentWear = Math.min(100, Math.round((entry.tireWear || 5) + inc))

    let fuelBurnRate = 1.75
    if (playerTactic === 'attack' || playerPace === 'empurrar') fuelBurnRate = 2.15
    else if (playerTactic === 'save_fuel' || playerPace === 'segurar') fuelBurnRate = 1.4

    const updatedFuel = Math.max(0, (entry.fuelRemaining ?? 100) - fuelBurnRate)

    let pitLoss = 0
    // Parada programada simples de IA
    if (!entry.isPlayer && entry.pitLap === nextLap && (entry.pitStopsDone || 0) === 0) {
      pitLoss = 22.0
      entry.tireCompound = entry.secondCompound || 'duro'
      entry.lapsOnCurrentTire = 0
      entry.pitStopsDone = (entry.pitStopsDone || 0) + 1
      newEventsThisLap.push({
        id: `ev_pit_${nextLap}_${entry.driverId}`,
        lap: nextLap,
        type: 'pit_stop',
        message: `🔧 Box para ${entry.driverName} (${entry.teamName}) — Novos pneus`,
        driverName: entry.driverName,
        teamColor: entry.teamColor,
        isPlayer: false,
        timestamp: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      })
    }

    entry.tireWear = currentWear
    entry.fuelRemaining = updatedFuel
    entry.lapsOnCurrentTire = (entry.lapsOnCurrentTire || 0) + 1

    const cliffStatus = calculateTireCliffStatus({
      compound: entry.tireCompound || 'medio',
      lapsOnTire: entry.lapsOnCurrentTire || 0,
      wearPercent: currentWear,
      wearMultiplier: entry.wearMultiplier || 1.0,
      trackAbrasiveness: tireAbrasiveness,
      trackTemp: 35,
      isAttacking: playerTactic === 'attack',
    })
    entry.cliffStatus = cliffStatus

    const freeLap = calculateFreeLapPaceSec({
      teamStrength: entry.isPlayer ? playerChassisRating : 75,
      carLevel: entry.isPlayer ? playerChassisRating : 75,
      driver: {
        speed: entry.score,
        morale: entry.morale,
        physicalCondition: entry.physicalCondition,
      },
      weather,
      tireCompound: entry.tireCompound || 'medio',
      lapsOnTire: entry.lapsOnCurrentTire,
      wearPercent: currentWear,
      wearMultiplier: entry.wearMultiplier || 1.0,
      trackAbrasiveness: tireAbrasiveness,
      trackTemp: 35,
      hasWingDamage: !!entry.hasWingDamage,
      tacticalMode:
        playerTactic === 'attack'
          ? 'attack'
          : playerTactic === 'save_fuel'
            ? 'preserve'
            : undefined,
      technicalAttributes: entry.isPlayer ? playerTechAttributes : undefined,
      circuit: circuitProfile,
      chassisRating: entry.isPlayer ? playerChassisRating : 75,
      powerUnitRating: entry.isPlayer ? playerPuRating : 90,
      carPerformanceRating: entry.isPlayer ? playerCarPerfRating : 79.5,
    })

    return {
      entry,
      freeLapSec: freeLap.freeLapSec,
      pitLossSec: pitLoss,
    }
  })

  // 4. Ultrapassagens e disputas roda a roda
  const sortedPace = [...intermediateStates]
    .filter((s) => !s.entry.dnf)
    .sort((a, b) => {
      const timeA = (a.entry.accumulatedTimeSec || 0) + a.freeLapSec + a.pitLossSec
      const timeB = (b.entry.accumulatedTimeSec || 0) + b.freeLapSec + b.pitLossSec
      return timeA - timeB
    })

  for (let i = 1; i < sortedPace.length; i++) {
    const chasing = sortedPace[i].entry
    const defending = sortedPace[i - 1].entry

    const wasBehind =
      (previousTrackOrder.find((c) => c.driverId === chasing.driverId)?.position || 99) >
      (previousTrackOrder.find((c) => c.driverId === defending.driverId)?.position || 0)

    if (wasBehind) {
      const isAttacking = chasing.isPlayer && playerCarTactics[chasing.driverId] === 'attack'

      const attempt = evaluateOvertakeAttempt({
        attacker: {
          driverId: chasing.driverId,
          driverName: chasing.driverName || 'Piloto',
          teamId: chasing.teamId || 'team',
          teamName: chasing.teamName || 'Equipe',
          teamColor: chasing.teamColor || '#999',
          flag: (chasing as any).nationality || '🏁',
          position: chasing.position || i + 1,
          score: chasing.score || 75,
          accumulatedTimeSec: chasing.accumulatedTimeSec || 0,
          dnf: !!chasing.dnf,
          tireCompound: chasing.tireCompound || 'medio',
          tireWear: chasing.tireWear || 10,
          lapsOnCurrentTire: chasing.lapsOnCurrentTire || 1,
          isPlayer: !!chasing.isPlayer,
        },
        target: {
          driverId: defending.driverId,
          driverName: defending.driverName || 'Piloto',
          teamId: defending.teamId || 'team',
          teamName: defending.teamName || 'Equipe',
          teamColor: defending.teamColor || '#999',
          flag: (defending as any).nationality || '🏁',
          position: defending.position || i,
          score: defending.score || 75,
          accumulatedTimeSec: defending.accumulatedTimeSec || 0,
          dnf: !!defending.dnf,
          tireCompound: defending.tireCompound || 'medio',
          tireWear: defending.tireWear || 10,
          lapsOnCurrentTire: defending.lapsOnCurrentTire || 1,
          isPlayer: !!defending.isPlayer,
        },
        attackerFreePaceSec: sortedPace[i].freeLapSec,
        targetFreePaceSec: sortedPace[i - 1].freeLapSec,
        circuitOvertakeFactor,
        currentLap: nextLap,
        hasOvertakeEnergy: isAttacking,
      })

      if (!attempt.success) {
        sortedPace[i].freeLapSec += attempt.attackerTimePenaltySec || 0.4
      } else if (chasing.isPlayer || defending.isPlayer || i <= 5) {
        newEventsThisLap.push({
          id: `ev_otk_${nextLap}_${chasing.driverId}_${defending.driverId}`,
          lap: nextLap,
          type: 'overtake',
          message:
            attempt.narrativeMessage ||
            `🟢 ULTRAPASSAGEM! ${chasing.driverName} superou ${defending.driverName}!`,
          driverName: chasing.driverName,
          teamColor: chasing.teamColor,
          isPlayer: chasing.isPlayer,
          timestamp: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        })
      }
    }
  }

  // 5. Atualização dos tempos acumulados e histórico de voltas
  const updatedLapHistory: Record<string, LapRecord[]> = { ...lapHistory }

  intermediateStates.forEach((state) => {
    if (!state.entry.dnf) {
      const lapTotalSec = state.freeLapSec + state.pitLossSec
      state.entry.accumulatedTimeSec = (state.entry.accumulatedTimeSec || 0) + lapTotalSec
      state.entry.lastLapTimeSec = lapTotalSec
      state.entry.lastLapTime = formatLapTime(lapTotalSec)
      state.entry.lapsCompleted = nextLap

      if (!updatedLapHistory[state.entry.driverId]) {
        updatedLapHistory[state.entry.driverId] = []
      }
      updatedLapHistory[state.entry.driverId].push({
        lap: nextLap,
        driverId: state.entry.driverId,
        lapTimeSec: lapTotalSec,
        lapTimeFormatted: formatLapTime(lapTotalSec),
      })
    }
  })

  // 6. Ordenação final do grid
  const activeSorted = intermediateStates
    .filter((s) => !s.entry.dnf)
    .sort((a, b) => a.entry.accumulatedTimeSec - b.entry.accumulatedTimeSec)

  const leaderTime = activeSorted[0]?.entry.accumulatedTimeSec || 0

  activeSorted.forEach((item, idx) => {
    item.entry.position = idx + 1
    item.entry.gapToLeader =
      idx === 0 ? 'Líder' : formatGap(item.entry.accumulatedTimeSec - leaderTime)
    if (idx > 0) {
      const frontTime = activeSorted[idx - 1].entry.accumulatedTimeSec
      item.entry.gapToFront = formatGap(item.entry.accumulatedTimeSec - frontTime)
    } else {
      item.entry.gapToFront = '+0.000s'
    }
  })

  const dnfSorted = intermediateStates.filter((s) => s.entry.dnf)
  dnfSorted.forEach((item, idx) => {
    item.entry.position = activeSorted.length + idx + 1
    item.entry.gapToLeader = 'ABANDONO'
    item.entry.gapToFront = '-'
  })

  const nextGrid = [...activeSorted.map((s) => s.entry), ...dnfSorted.map((s) => s.entry)]

  // Volta mais rápida
  let bestLapSec = 9999
  let flDriverId = ''
  nextGrid.forEach((car) => {
    car.fastestLap = false
    if (!car.dnf && car.lastLapTimeSec && car.lastLapTimeSec < bestLapSec) {
      bestLapSec = car.lastLapTimeSec
      flDriverId = car.driverId
    }
  })
  const flCar = nextGrid.find((c) => c.driverId === flDriverId)
  if (flCar) flCar.fastestLap = true

  return {
    nextLap,
    nextGrid,
    nextEvents: newEventsThisLap,
    nextLapHistory: updatedLapHistory,
    nextMechanicalIssues: updatedMechIssues,
    nextRedFlagState: { ...redFlagState },
    isCompleted,
  }
}
