import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Play,
  Pause,
  RotateCcw,
  Trophy,
  Gauge,
  Clock,
  Flame,
  Zap,
  Flag,
  ChevronRight,
  Maximize2,
  Minimize2,
  Sparkles,
  Info,
} from 'lucide-react'
import { TRACKS, DEFAULT_TRACK_ID, getTrack, type TrackDefinition, type TrackPoint } from './tracks'
import { PodiumVisualCard } from './PodiumVisualCard'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'
import { formatLapTime, formatGap } from '@/lib/f1-race-sim-engine'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'
import { getTeamReducedLogoUrl } from '@/lib/team-reduced-logo-resolver'
import { Slider } from '@/components/ui/slider'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'

/**
 * Modelo de carro de corrida convertido / adaptado para a simulação
 */
export interface RaceCar {
  id: string
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  teamColor: string
  isPlayer: boolean
  carNumber?: number
  // Atributo de ritmo de 0 a 100 (default 75 quando ausente)
  pace: number
  // Posição no grid de largada
  gridPosition: number
  // Estado dinâmico da simulação
  currentPosition: number
  currentLap: number
  totalTimeSec: number
  lastLapTimeSec?: number
  bestLapTimeSec?: number
  gapToLeaderSec: number
  gapToFrontSec: number
  progressOnLap: number // 0 a 1 indicando a porcentagem percorrida na volta atual
}

export interface SimulationFastestLap {
  driverId: string
  driverName: string
  teamName: string
  teamColor: string
  timeSec: number
  lap: number
}

export interface RaceSimulationResult {
  track: TrackDefinition
  totalLaps: number
  winner: RaceCar
  podium: [RaceCar, RaceCar, RaceCar]
  cars: RaceCar[]
  fastestLap?: SimulationFastestLap
  playerCars: RaceCar[]
  finishedAt: string
}

export interface RaceSimulatorProps {
  // Dados de entrada opcionais (pilotos/carros reais do jogo ou mock)
  initialDrivers?: any[]
  playerTeamId?: string
  playerTeamName?: string
  playerTeamColor?: string
  defaultTrackId?: string
  totalLaps?: number
  // Callbacks
  onLap?: (leader: RaceCar, lapNumber: number, allCars: RaceCar[]) => void
  onFinish?: (result: RaceSimulationResult) => void
  onSaveResult?: (result: RaceSimulationResult) => void
  className?: string
  // Se fornecido, aciona a visualização embutida dentro de outra tela (ex: WeekendV2Page)
  embedded?: boolean
}

/**
 * Helper para interpolar ponto {x, y} ao longo da lista de pontos do traçado dado progress [0..1]
 */
function interpolateTrackPosition(points: TrackPoint[], progress: number): TrackPoint {
  if (!points || points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]

  // Normalizar progress entre 0 e 1
  const p = Math.max(0, Math.min(1, progress)) % 1
  const segmentCount = points.length
  const exactIndex = p * segmentCount
  const idx1 = Math.floor(exactIndex) % segmentCount
  const idx2 = (idx1 + 1) % segmentCount
  const subProgress = exactIndex - Math.floor(exactIndex)

  const pt1 = points[idx1]
  const pt2 = points[idx2]

  return {
    x: pt1.x + (pt2.x - pt1.x) * subProgress,
    y: pt1.y + (pt2.y - pt1.y) * subProgress,
  }
}

/**
 * Normaliza e constrói a lista inicial de RaceCars a partir de pilotos ou gera um grid de 24 carros F1 2026
 */
export function convertToRaceCars(
  inputDrivers?: any[],
  playerTeamId?: string,
  playerTeamName?: string,
  playerTeamColor?: string,
): RaceCar[] {
  // Se houver drivers fornecidos
  if (inputDrivers && inputDrivers.length > 0) {
    return inputDrivers.map((d, index) => {
      // Extrai ritmo 0-100: pode vir de rating, pace, speed, skill ou default 75
      const rawPace =
        d.pace ??
        d.rating ??
        d.speed ??
        d.attributes?.speed ??
        d.driverSkill ??
        d.chassisRating ??
        75
      const pace = Math.max(0, Math.min(100, Number(rawPace) || 75))

      const isPlayer =
        d.isPlayer === true ||
        (playerTeamId && d.team_id === playerTeamId) ||
        (playerTeamId && d.teamId === playerTeamId) ||
        false

      return {
        id: d.id || `car_${index + 1}`,
        driverId: d.driverId || d.id || `drv_${index + 1}`,
        driverName: d.name || d.driverName || `Piloto ${index + 1}`,
        teamId:
          d.team_id || d.teamId || (isPlayer ? playerTeamId || 'team_player' : `team_${index}`),
        teamName: d.teamName || (isPlayer ? playerTeamName || 'Sua Equipe' : d.team || 'Equipe F1'),
        teamColor: d.teamColor || (isPlayer ? playerTeamColor || '#E10600' : d.color || '#38BDF8'),
        isPlayer,
        carNumber: d.number || d.carNumber || index + 1,
        pace,
        gridPosition: d.gridPosition || index + 1,
        currentPosition: d.gridPosition || index + 1,
        currentLap: 0,
        totalTimeSec: 0,
        gapToLeaderSec: 0,
        gapToFrontSec: 0,
        progressOnLap: 0,
      }
    })
  }

  // Fallback canônico: 20 a 24 pilotos representativos F1 2026 com ritmos balanceados
  const DEFAULT_GRID_SEED = [
    { name: 'Max Verstappen', team: 'Red Bull Racing', color: '#3671C6', pace: 95, num: 1 },
    { name: 'Lando Norris', team: 'McLaren', color: '#FF8000', pace: 94, num: 4 },
    { name: 'Charles Leclerc', team: 'Ferrari', color: '#E80020', pace: 93, num: 16 },
    { name: 'Lewis Hamilton', team: 'Ferrari', color: '#E80020', pace: 92, num: 44 },
    { name: 'Oscar Piastri', team: 'McLaren', color: '#FF8000', pace: 91, num: 81 },
    { name: 'George Russell', team: 'Mercedes', color: '#27F4D2', pace: 90, num: 63 },
    { name: 'Kimi Antonelli', team: 'Mercedes', color: '#27F4D2', pace: 85, num: 12 },
    { name: 'Fernando Alonso', team: 'Aston Martin', color: '#229971', pace: 87, num: 14 },
    { name: 'Lance Stroll', team: 'Aston Martin', color: '#229971', pace: 78, num: 18 },
    { name: 'Alexander Albon', team: 'Williams', color: '#64C4FF', pace: 82, num: 23 },
    { name: 'Carlos Sainz', team: 'Williams', color: '#64C4FF', pace: 88, num: 55 },
    { name: 'Nico Hülkenberg', team: 'Audi F1 Team', color: '#00E5A3', pace: 81, num: 27 },
    { name: 'Gabriel Bortoleto', team: 'Audi F1 Team', color: '#00E5A3', pace: 80, num: 5 },
    { name: 'Yuki Tsunoda', team: 'Racing Bulls', color: '#6692FF', pace: 80, num: 22 },
    { name: 'Liam Lawson', team: 'Racing Bulls', color: '#6692FF', pace: 79, num: 30 },
    { name: 'Pierre Gasly', team: 'Alpine', color: '#FF87BC', pace: 80, num: 10 },
    { name: 'Jack Doohan', team: 'Alpine', color: '#FF87BC', pace: 76, num: 7 },
    { name: 'Esteban Ocon', team: 'Haas F1 Team', color: '#B6BABD', pace: 79, num: 31 },
    { name: 'Oliver Bearman', team: 'Haas F1 Team', color: '#B6BABD', pace: 78, num: 87 },
    // Carros do Jogador (se não informados)
    {
      name: 'Piloto 1 (Você)',
      team: playerTeamName || 'APEX GP',
      color: playerTeamColor || '#E10600',
      pace: 75,
      isPlayer: true,
      num: 98,
    },
    {
      name: 'Piloto 2 (Você)',
      team: playerTeamName || 'APEX GP',
      color: playerTeamColor || '#E10600',
      pace: 75,
      isPlayer: true,
      num: 99,
    },
  ]

  return DEFAULT_GRID_SEED.map((seed, idx) => ({
    id: `seed_car_${idx + 1}`,
    driverId: `seed_drv_${idx + 1}`,
    driverName: seed.name,
    teamId: seed.isPlayer ? playerTeamId || 'team_player' : `team_${idx + 1}`,
    teamName: seed.team,
    teamColor: seed.color,
    isPlayer: !!seed.isPlayer,
    carNumber: seed.num,
    pace: seed.pace,
    gridPosition: idx + 1,
    currentPosition: idx + 1,
    currentLap: 0,
    totalTimeSec: 0,
    gapToLeaderSec: 0,
    gapToFrontSec: 0,
    progressOnLap: 0,
  }))
}

export const RaceSimulator: React.FC<RaceSimulatorProps> = ({
  initialDrivers,
  playerTeamId,
  playerTeamName,
  playerTeamColor,
  defaultTrackId = DEFAULT_TRACK_ID,
  totalLaps = 10,
  onLap,
  onFinish,
  onSaveResult,
  className = '',
  embedded = false,
}) => {
  // Circuito Selecionado
  const [selectedTrackId, setSelectedTrackId] = useState<string>(defaultTrackId)
  const currentTrack = useMemo(() => getTrack(selectedTrackId), [selectedTrackId])

  // Controles de Simulação
  const [speed, setSpeed] = useState<1 | 2 | 4>(1)
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [isFinished, setIsFinished] = useState<boolean>(false)

  // Estado dos Carros
  const [cars, setCars] = useState<RaceCar[]>(() =>
    convertToRaceCars(initialDrivers, playerTeamId, playerTeamName, playerTeamColor),
  )

  // Volta Atual do Líder
  const [currentLap, setCurrentLap] = useState<number>(0)
  // Melhor Volta da Corrida
  const [fastestLap, setFastestLap] = useState<SimulationFastestLap | null>(null)
  // Resultado final da corrida
  const [simulationResult, setSimulationResult] = useState<RaceSimulationResult | null>(null)

  // UI Pit Wall Flutuante: expandido vs compacto
  const [isPitWallExpanded, setIsPitWallExpanded] = useState<boolean>(true)

  // Ref para animar os carros na pista SVG continuamente
  const animationFrameRef = useRef<number | null>(null)
  const lastTickTimeRef = useRef<number>(Date.now())

  // Resetar simulação quando o circuito ou pilotos mudarem
  const handleResetSimulation = useCallback(() => {
    setIsRunning(false)
    setIsFinished(false)
    setCurrentLap(0)
    setFastestLap(null)
    setSimulationResult(null)
    setCars(convertToRaceCars(initialDrivers, playerTeamId, playerTeamName, playerTeamColor))
  }, [initialDrivers, playerTeamId, playerTeamName, playerTeamColor])

  // Atualizar carros se initialDrivers mudarem externamente
  useEffect(() => {
    handleResetSimulation()
  }, [initialDrivers, handleResetSimulation])

  /**
   * Executa a simulação de uma volta completa para todos os carros.
   * Ordena estritamente por menor totalTimeSec (sem trapaças ou multiplicadores arbitrários).
   * O ritmo base 0-100 gera variação esportiva realista:
   * baseLapTime - (pace - 75) * 0.08s + leve variação mecânica por volta.
   */
  const simulateOneLap = useCallback(
    (
      previousCars: RaceCar[],
      nextLapNumber: number,
    ): { nextCars: RaceCar[]; nextFastest: SimulationFastestLap | null } => {
      let currentFastest = fastestLap

      // Calcula tempos de volta de cada carro nesta volta
      const updated = previousCars.map((car) => {
        // Cálculo do tempo de volta:
        // Ritmo 75 = tempo base do circuito
        // Ritmo 100 = ~2s mais rápido que o ritmo 75
        // Variação de consistência: pequena variação estocástica controlada (-0.2s a +0.2s)
        const effectivePace = paceOverridesRef.current[car.id] ?? car.pace ?? 75
        const paceDelta = (effectivePace - 75) * 0.08
        const randomFluctuation = Math.sin(nextLapNumber * 13 + car.gridPosition * 7) * 0.25
        const lapTime = Math.max(
          currentTrack.baseLapTimeSec * 0.75,
          currentTrack.baseLapTimeSec - paceDelta + randomFluctuation,
        )

        const newTotalTime = car.totalTimeSec + lapTime
        const newBestLap = car.bestLapTimeSec ? Math.min(car.bestLapTimeSec, lapTime) : lapTime

        // Verifica se é a volta mais rápida geral
        if (!currentFastest || lapTime < currentFastest.timeSec) {
          currentFastest = {
            driverId: car.driverId,
            driverName: car.driverName,
            teamName: car.teamName,
            teamColor: car.teamColor,
            timeSec: lapTime,
            lap: nextLapNumber,
          }
        }

        return {
          ...car,
          currentLap: nextLapNumber,
          totalTimeSec: newTotalTime,
          lastLapTimeSec: lapTime,
          bestLapTimeSec: newBestLap,
          progressOnLap: 1,
        }
      })

      // Ordenar estritamente por menor tempo acumulado total
      updated.sort((a, b) => a.totalTimeSec - b.totalTimeSec)

      const leaderTime = updated[0]?.totalTimeSec || 0

      // Atualiza posições e gaps em relação ao líder e ao carro da frente
      const rankedCars = updated.map((car, idx) => {
        const currentPosition = idx + 1
        const gapToLeaderSec = idx === 0 ? 0 : car.totalTimeSec - leaderTime
        const gapToFrontSec = idx === 0 ? 0 : car.totalTimeSec - updated[idx - 1].totalTimeSec

        return {
          ...car,
          currentPosition,
          gapToLeaderSec: Number(gapToLeaderSec.toFixed(3)),
          gapToFrontSec: Number(gapToFrontSec.toFixed(3)),
          progressOnLap: 0, // Reinicia progress para nova volta
        }
      })

      return { nextCars: rankedCars, nextFastest: currentFastest }
    },
    [currentTrack.baseLapTimeSec, fastestLap],
  )

  // Loop de simulação por tempo baseado no `speed` (1x = ~3s por volta, 2x = 1.5s, 4x = 0.75s)
  useEffect(() => {
    if (!isRunning || isFinished) return

    const lapDurationMs = 3000 / speed
    const interval = setInterval(() => {
      setCurrentLap((prevLap) => {
        const nextLap = prevLap + 1

        setCars((prevCars) => {
          const { nextCars, nextFastest } = simulateOneLap(prevCars, nextLap)
          if (nextFastest) {
            setFastestLap(nextFastest)
          }

          const leader = nextCars[0]
          // Notifica callback onLap a cada volta completada pelo líder
          if (onLap && leader) {
            onLap(leader, nextLap, nextCars)
          }

          // Se atingiu o total de voltas, encerra a corrida
          if (nextLap >= totalLaps) {
            setIsRunning(false)
            setIsFinished(true)

            const winner = nextCars[0]
            const podium: [RaceCar, RaceCar, RaceCar] = [
              nextCars[0],
              nextCars[1] || nextCars[0],
              nextCars[2] || nextCars[0],
            ]
            const playerCars = nextCars.filter((c) => c.isPlayer)

            const finalResult: RaceSimulationResult = {
              track: currentTrack,
              totalLaps,
              winner,
              podium,
              cars: nextCars,
              fastestLap: nextFastest || undefined,
              playerCars,
              finishedAt: new Date().toISOString(),
            }

            setSimulationResult(finalResult)

            if (onFinish) {
              onFinish(finalResult)
            }
            if (onSaveResult) {
              onSaveResult(finalResult)
            }
          }

          return nextCars
        })

        return nextLap
      })
    }, lapDurationMs)

    return () => clearInterval(interval)
  }, [
    isRunning,
    isFinished,
    speed,
    totalLaps,
    simulateOneLap,
    currentTrack,
    onLap,
    onFinish,
    onSaveResult,
  ])

  // Loop de Animação Contínua (60fps) para mover os carros suavemente ao longo do traçado SVG
  useEffect(() => {
    let active = true

    const animateLoop = () => {
      if (!active) return

      if (isRunning && !isFinished) {
        const now = Date.now()
        const deltaSec = (now - lastTickTimeRef.current) / 1000
        lastTickTimeRef.current = now

        // Velocidade base da volta em fração por segundo
        const lapDurationSec = 3.0 / speed
        const progressIncrement = deltaSec / lapDurationSec

        setCars((prevCars) =>
          prevCars.map((c) => ({
            ...c,
            // Adiciona pequeno offset baseado no gap relativo ao líder para separar os carros visualmente
            progressOnLap: (c.progressOnLap + progressIncrement) % 1,
          })),
        )
      } else {
        lastTickTimeRef.current = Date.now()
      }

      animationFrameRef.current = requestAnimationFrame(animateLoop)
    }

    animationFrameRef.current = requestAnimationFrame(animateLoop)

    return () => {
      active = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isRunning, isFinished, speed])

  // Carro Líder e Carros do Jogador
  const leaderCar = cars[0]
  const playerCars = useMemo(() => cars.filter((c) => c.isPlayer), [cars])

  // Ref com ritmo dinâmico dos carros para persistir durante a corrida mesmo em simulações
  const paceOverridesRef = useRef<Record<string, number>>({})

  // Handler para atualizar o ritmo de um piloto individual do jogador via slider
  const handlePaceChange = useCallback((carId: string, newPace: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newPace)))
    paceOverridesRef.current[carId] = clamped
    setCars((prev) => prev.map((c) => (c.id === carId ? { ...c, pace: clamped } : c)))
  }, [])

  // Oficialização do resultado via canonicalRaceResultService (idempotente com 24 pilotos únicos)
  const officialResultAdapter = useMemo<OfficialRaceResult | null>(() => {
    if (!simulationResult) return null

    // Assegura 24 carros únicos no grid e classificação
    const canonicalCars = simulationResult.cars.slice(0, 24)
    while (canonicalCars.length < 24) {
      const idx = canonicalCars.length + 1
      canonicalCars.push({
        id: `pad_car_${idx}`,
        driverId: `pad_drv_${idx}`,
        driverName: `Piloto Reserva ${idx}`,
        teamId: `pad_team_${idx}`,
        teamName: 'Grid F1 2026',
        teamColor: '#94A3B8',
        isPlayer: false,
        pace: 75,
        gridPosition: idx,
        currentPosition: idx,
        currentLap: simulationResult.totalLaps,
        totalTimeSec: (canonicalCars[canonicalCars.length - 1]?.totalTimeSec || 800) + 0.8,
        gapToLeaderSec: (canonicalCars[canonicalCars.length - 1]?.gapToLeaderSec || 10) + 0.8,
        gapToFrontSec: 0.8,
        progressOnLap: 1,
      })
    }

    const p1 = canonicalCars[0]
    const p2 = canonicalCars[1] || canonicalCars[0]
    const p3 = canonicalCars[2] || canonicalCars[0]

    // Localizar ou garantir os dois carros do jogador
    let playerCarsInList = canonicalCars.filter((c) => c.isPlayer)
    if (playerCarsInList.length === 0) {
      // Se não houver, marca os dois últimos ou intermediários como da equipe do jogador
      canonicalCars[canonicalCars.length - 2].isPlayer = true
      canonicalCars[canonicalCars.length - 1].isPlayer = true
      playerCarsInList = [
        canonicalCars[canonicalCars.length - 2],
        canonicalCars[canonicalCars.length - 1],
      ]
    } else if (playerCarsInList.length === 1) {
      const other = canonicalCars.find((c) => !c.isPlayer) || canonicalCars[1]
      other.isPlayer = true
      playerCarsInList.push(other)
    }

    const effectivePlayerTeamId = playerTeamId || playerCarsInList[0]?.teamId || 'player_team'

    // Montar CanonicalRaceState finalizado para chamar canonicalRaceResultService.officializeRace()
    const canonicalState: any = {
      version: '2.0',
      saveSchemaVersion: 'race-save-v1',
      careerId: 'apex_canonical_career',
      season: 2026,
      round: 1,
      raceId: `sim_race_${simulationResult.track.id}`,
      circuitName: simulationResult.track.name,
      circuitCountry: simulationResult.track.country,
      totalLaps: simulationResult.totalLaps,
      currentLap: simulationResult.totalLaps,
      status: 'completed',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      weather: { condition: 'dry', trackTemp: 32, airTemp: 24, rainIntensity: 0 },
      simSpeed: speed,
      completedAt: simulationResult.finishedAt,
      playerTeamId: effectivePlayerTeamId,
      tactics: {},
      paceOrders: {},
      revision: 1,
      updatedAt: simulationResult.finishedAt,
      fastestLap: simulationResult.fastestLap
        ? {
            driverId: simulationResult.fastestLap.driverId,
            driverName: simulationResult.fastestLap.driverName,
            lapTimeSec: simulationResult.fastestLap.timeSec,
            lapTimeFormatted: formatLapTime(simulationResult.fastestLap.timeSec),
            lap: simulationResult.fastestLap.lap,
          }
        : undefined,
      raceControl: {
        currentFlag: 'FINISHED',
        safetyCarLaps: 0,
        vscLaps: 0,
        redFlagLaps: 0,
        history: [],
      },
      drivers: canonicalCars.map((c, index) => ({
        driverId: c.driverId,
        driverName: c.driverName,
        teamId: c.isPlayer ? effectivePlayerTeamId : c.teamId,
        teamName: c.teamName,
        teamColor: c.teamColor,
        isPlayer: c.isPlayer,
        carId: c.isPlayer ? (index === 0 ? 'car1' : 'car2') : undefined,
        gridPosition: c.gridPosition,
        currentPosition: index + 1,
        lap: simulationResult.totalLaps,
        raceTime: c.totalTimeSec,
        raceStatus: 'finished',
        gap: index === 0 ? 'LÍDER' : `+${c.gapToLeaderSec.toFixed(3)}s`,
        gapToLeaderSec: c.gapToLeaderSec,
        gapToFrontSec: c.gapToFrontSec,
        pitStops: 1,
        bestLapSec: c.bestLapTimeSec,
        bestLapFormatted: c.bestLapTimeSec ? formatLapTime(c.bestLapTimeSec) : undefined,
        fuel: 5.0,
        tyreCompound: 'medio',
        tyreAge: simulationResult.totalLaps,
        tyreWear: 35,
      })),
      driverLookup: {},
    }

    // Criar lookup
    canonicalState.drivers.forEach((d: any) => {
      canonicalState.driverLookup[d.driverId] = d
    })

    try {
      // Oficialização canônica idempotente garantindo 24 pilotos e regras F1 2026
      return canonicalRaceResultService.officializeRace(canonicalState)
    } catch (err) {
      // Fallback seguro se storage não estiver acessível
      console.warn('[RaceSimulator] Oficialização via service com fallback:', err)
      return {
        officialResultId: `official_result_apex_${Date.now()}`,
        schemaVersion: 'official-race-result-v1',
        careerId: 'apex_canonical_career',
        season: 2026,
        round: 1,
        raceId: `sim_race_${simulationResult.track.id}`,
        circuitId: simulationResult.track.id,
        circuitName: simulationResult.track.name,
        circuitCountry: simulationResult.track.country,
        playerTeamId: effectivePlayerTeamId,
        officializedAt: simulationResult.finishedAt,
        totalLaps: simulationResult.totalLaps,
        winnerDriverId: p1.driverId,
        winnerTeamId: p1.teamId,
        poleDriverId: canonicalCars.find((c) => c.gridPosition === 1)?.driverId || p1.driverId,
        podium: [p1.driverId, p2.driverId, p3.driverId],
        fastestLapDriverId: simulationResult.fastestLap?.driverId,
        fastestLapSec: simulationResult.fastestLap?.timeSec,
        fastestLapFormatted: simulationResult.fastestLap
          ? formatLapTime(simulationResult.fastestLap.timeSec)
          : undefined,
        entries: canonicalCars.map((c, index) => ({
          driverId: c.driverId,
          teamId: c.teamId,
          driverName: c.driverName,
          teamName: c.teamName,
          teamColor: c.teamColor,
          isPlayer: c.isPlayer,
          gridPosition: c.gridPosition,
          finalPosition: index + 1,
          positionsGainedLost: c.gridPosition - (index + 1),
          lapsCompleted: simulationResult.totalLaps,
          raceTime: c.totalTimeSec,
          gapToWinner: index === 0 ? 'LÍDER' : `+${c.gapToLeaderSec.toFixed(3)}s`,
          status: 'finished' as const,
          dnf: false,
          pitStops: 1,
          bestLapSec: c.bestLapTimeSec,
          bestLapFormatted: c.bestLapTimeSec ? formatLapTime(c.bestLapTimeSec) : undefined,
          fastestLap: c.driverId === simulationResult.fastestLap?.driverId,
          pointsAwarded:
            index === 0 ? 25 : index === 1 ? 18 : index === 2 ? 15 : index < 10 ? 10 - index : 0,
        })),
        playerEntries: [playerCarsInList[0] as any, playerCarsInList[1] as any],
        eventsSummary: {
          safetyCarPeriods: 0,
          safetyCarLaps: 0,
          vscPeriods: 0,
          vscLaps: 0,
          redFlagPeriods: 0,
          dnfCount: 0,
          totalPitStops: 24,
          significantIncidents: [],
        },
        resultHash: `sha_apex_fallback_${Date.now()}`,
      }
    }
  }, [simulationResult, playerTeamId, speed])

  return (
    <TooltipProvider>
      <div className={`space-y-4 font-sans select-none relative ${className}`}>
        {/* Barra Superior de Controles do Simulador */}
        <Card className="bg-[#090D15] border border-[#1E293B] text-white shadow-xl rounded-2xl overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
            {/* Seletor de Circuito e Informações */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E10600] animate-pulse" />
                  <span className="text-xs font-black tracking-wider uppercase text-slate-300">
                    Circuito Oficial
                  </span>
                  {currentTrack.isDefault && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] uppercase font-bold">
                      Padrão
                    </Badge>
                  )}
                </div>

                <Select
                  value={selectedTrackId}
                  disabled={isRunning}
                  onValueChange={(val) => {
                    setSelectedTrackId(val)
                    handleResetSimulation()
                  }}
                >
                  <SelectTrigger className="w-[210px] h-9 bg-[#111827] border-slate-700 text-white font-bold text-xs">
                    <SelectValue placeholder="Selecione o circuito" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0B111E] border-slate-700 text-white">
                    {Object.values(TRACKS).map((t) => (
                      <SelectItem
                        key={t.id}
                        value={t.id}
                        className="text-xs font-medium cursor-pointer"
                      >
                        {t.name} ({t.country})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="hidden sm:block pl-3 border-l border-slate-800 text-xs">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Distância Total
                </span>
                <span className="font-mono text-cyan-400 font-bold">
                  {totalLaps} voltas • {(totalLaps * currentTrack.lapLengthKm).toFixed(1)} km
                </span>
              </div>
            </div>

            {/* Controles de Execução e Velocidade */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Botão Play / Pause */}
              {!isFinished ? (
                <Button
                  size="sm"
                  onClick={() => setIsRunning(!isRunning)}
                  className={`h-9 px-4 text-xs font-black uppercase tracking-wider gap-1.5 shadow-md transition-all ${
                    isRunning
                      ? 'bg-amber-500 hover:bg-amber-400 text-black'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      Pausar
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {currentLap === 0 ? 'Iniciar Corrida' : 'Continuar'}
                    </>
                  )}
                </Button>
              ) : (
                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black uppercase py-1 px-3">
                  🏁 Prova Concluída
                </Badge>
              )}

              {/* Controles de Velocidade (1× / 2× / 4×) */}
              <div className="flex items-center rounded-lg bg-[#111827] border border-slate-700 p-0.5">
                {([1, 2, 4] as const).map((spd) => (
                  <button
                    key={`speed_${spd}`}
                    type="button"
                    onClick={() => setSpeed(spd)}
                    className={`px-2.5 py-1 text-[11px] font-mono font-black rounded-md transition-all ${
                      speed === spd
                        ? 'bg-[#E10600] text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {spd}×
                  </button>
                ))}
              </div>

              {/* Botão Reiniciar */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetSimulation}
                className="h-9 px-2 text-slate-400 hover:text-white text-xs gap-1"
                title="Reiniciar Simulação"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reiniciar</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* =========================================================================
            BOX FLUTUANTE (PIT WALL) COM TRAÇADO SVG ANIMADO + CARROS
           ========================================================================= */}
        <div
          data-testid="floating-pitwall-box"
          className="relative rounded-2xl bg-gradient-to-br from-[#080E1A] via-[#0B1324] to-[#050912] border-2 border-cyan-500/40 shadow-[0_15px_40px_rgba(0,166,251,0.25)] overflow-hidden transition-all duration-300 backdrop-blur-md"
        >
          {/* Header do Box Flutuante (Pit Wall) */}
          <div className="bg-[#0B1628]/90 border-b border-cyan-500/30 px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
              </span>
              <span className="text-xs font-black tracking-widest text-cyan-300 uppercase font-mono">
                PIT WALL // AO VIVO • {currentTrack.name.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="bg-[#111C33] border border-cyan-500/40 text-cyan-300 font-mono text-[10px] font-bold">
                VOLTA {currentLap} / {totalLaps}
              </Badge>
              <button
                type="button"
                onClick={() => setIsPitWallExpanded(!isPitWallExpanded)}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded"
                title={isPitWallExpanded ? 'Minimizar traçado' : 'Expandir traçado'}
              >
                {isPitWallExpanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Conteúdo do Pit Wall */}
          <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            {/* Lado Esquerdo: Traçado SVG com Carros Animados */}
            <div
              className={`${
                isPitWallExpanded ? 'lg:col-span-7' : 'hidden lg:block lg:col-span-5'
              } relative flex flex-col items-center justify-center bg-[#050A14] rounded-xl border border-slate-800/80 p-3 min-h-[220px]`}
            >
              {/* Grade técnica de fundo */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, rgba(0, 166, 251, 0.15) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(0, 166, 251, 0.15) 1px, transparent 1px)
                  `,
                  backgroundSize: '16px 16px',
                }}
              />

              {/* SVG do Traçado + Carros */}
              <svg
                viewBox={currentTrack.viewBox}
                className="w-full h-auto max-h-[220px] drop-shadow-[0_0_20px_rgba(0,166,251,0.3)] relative z-10"
              >
                <defs>
                  <filter id="trackGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00A6FB" />
                    <stop offset="60%" stopColor="#38BDF8" />
                    <stop offset="100%" stopColor="#0284C7" />
                  </linearGradient>
                </defs>

                {/* Sombra / Asfalto da pista */}
                <path
                  d={currentTrack.path}
                  fill="none"
                  stroke="#08101E"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Linha guia de borda */}
                <path
                  d={currentTrack.path}
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Linha de corrida iluminada */}
                <path
                  d={currentTrack.path}
                  fill="none"
                  stroke="url(#trackGradient)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#trackGlow)"
                />

                {/* Linha de Chegada / Largada */}
                <g>
                  <circle
                    cx={currentTrack.startFinish.x}
                    cy={currentTrack.startFinish.y}
                    r="5"
                    fill="#E10600"
                  />
                  <circle
                    cx={currentTrack.startFinish.x}
                    cy={currentTrack.startFinish.y}
                    r="2"
                    fill="#FFFFFF"
                  />
                  <text
                    x={currentTrack.startFinish.x + 8}
                    y={currentTrack.startFinish.y + 4}
                    fill="#94A3B8"
                    fontSize="7"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    LARGADA
                  </text>
                </g>

                {/* Carros Animados ao Longo do Traçado */}
                {cars.map((car) => {
                  // Posição proporcional interpolada baseada no progresso da volta
                  // Carros à frente na volta ficam mais avançados na pista
                  const rankOffset = ((25 - car.currentPosition) / 25) * 0.08
                  const effectiveProgress = (car.progressOnLap + rankOffset) % 1
                  const pos = interpolateTrackPosition(currentTrack.points, effectiveProgress)

                  const isLeader = car.currentPosition === 1
                  const isPlayer = car.isPlayer

                  // Destaque visual: Líder dourado (#F59E0B), Jogador com anel pulsante, Demais discretos
                  const radius = isLeader ? 5.5 : isPlayer ? 5 : 3
                  const fillColor = isLeader
                    ? '#F59E0B'
                    : isPlayer
                      ? car.teamColor || '#E10600'
                      : car.teamColor || '#94A3B8'

                  return (
                    <g key={`track_car_${car.id}`} className="transition-transform duration-75">
                      {/* Halo / Anel de destaque para o Líder e Pilotos do Jogador */}
                      {isLeader && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r="9"
                          fill="none"
                          stroke="#F59E0B"
                          strokeWidth="1.5"
                          opacity="0.8"
                          className="animate-pulse"
                        />
                      )}
                      {isPlayer && !isLeader && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r="8"
                          fill="none"
                          stroke={car.teamColor || '#E10600'}
                          strokeWidth="1.5"
                          opacity="0.9"
                          className="animate-pulse"
                        />
                      )}

                      {/* Ponto / Carro */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={radius}
                        fill={fillColor}
                        stroke="#FFFFFF"
                        strokeWidth={isLeader || isPlayer ? 1.5 : 0.75}
                      />

                      {/* Rótulo de identificação para líder e jogadores */}
                      {(isLeader || isPlayer) && (
                        <text
                          x={pos.x + 8}
                          y={pos.y + 3}
                          fill={isLeader ? '#FCD34D' : '#FFFFFF'}
                          fontSize="7"
                          fontFamily="monospace"
                          fontWeight="bold"
                          stroke="#000000"
                          strokeWidth="0.4"
                        >
                          {isLeader
                            ? `👑 P1 ${car.driverName.split(' ')[0]}`
                            : `P${car.currentPosition} (Você)`}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>

              {/* Legenda visual da pista */}
              <div className="w-full flex items-center justify-between text-[10px] text-slate-400 font-mono mt-2 pt-2 border-t border-slate-800/80">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                  Líder (Dourado)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#E10600]" />
                  Pilotos do Jogador
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  Grid Adversário
                </span>
              </div>
            </div>

            {/* Lado Direito: Telemetria Essencial do Pit Wall */}
            <div className={`${isPitWallExpanded ? 'lg:col-span-5' : 'lg:col-span-7'} space-y-4`}>
              {/* Cards de Métricas Principais (Volta, Tempo do Líder, Melhor Volta) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                {/* Volta Atual */}
                <div className="p-3 rounded-xl bg-[#0F172A] border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Flag className="w-3 h-3 text-cyan-400" /> Volta
                  </span>
                  <div className="text-base font-black text-white mt-0.5">
                    {currentLap} <span className="text-xs text-slate-500">/ {totalLaps}</span>
                  </div>
                </div>

                {/* Tempo do Líder */}
                <div className="p-3 rounded-xl bg-[#0F172A] border border-slate-800">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" /> Tempo Líder
                  </span>
                  <div className="text-base font-black text-amber-300 mt-0.5">
                    {leaderCar ? formatLapTime(leaderCar.totalTimeSec) : '0:00.000'}
                  </div>
                </div>

                {/* Melhor Volta da Corrida */}
                <div className="p-3 rounded-xl bg-[#0F172A] border border-slate-800 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                    <Zap className="w-3 h-3 text-purple-400" /> Melhor Volta
                  </span>
                  <div className="text-base font-black text-purple-300 mt-0.5">
                    {fastestLap ? formatLapTime(fastestLap.timeSec) : '—'}
                  </div>
                  {fastestLap && (
                    <span className="text-[9px] text-slate-400 truncate block mt-0.5">
                      {fastestLap.driverName} (V{fastestLap.lap})
                    </span>
                  )}
                </div>
              </div>

              {/* DESTAQUE: LÍDER DA CORRIDA (Dourado) */}
              {leaderCar && (
                <div className="p-3 rounded-xl bg-gradient-to-r from-amber-950/40 via-[#1C1608] to-[#0E1526] border-2 border-amber-400/70 shadow-md">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-amber-400 text-black font-black flex items-center justify-center text-xs shadow-xs">
                        P1
                      </span>
                      <div>
                        <div className="font-extrabold text-amber-300 flex items-center gap-1.5 text-sm">
                          <Trophy className="w-3.5 h-3.5 text-amber-400 fill-current" />
                          {leaderCar.driverName}
                        </div>
                        <span className="text-[10px] text-slate-400 font-sans">
                          {leaderCar.teamName} • Ritmo {leaderCar.pace}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <Badge className="bg-amber-400 text-black font-black text-[10px]">
                        LÍDER
                      </Badge>
                      <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                        Últ:{' '}
                        {leaderCar.lastLapTimeSec ? formatLapTime(leaderCar.lastLapTimeSec) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* DESTAQUE: PILOTOS DO JOGADOR COM CONTROLE DE RITMO (SLIDER 0-100, DEFAULT 75), GAPS E TOOLTIP */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#E10600] inline-block animate-ping" />
                    Seus Pilotos na Pista (Você)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Ajuste o ritmo (0–100) • Passe o mouse para tempo total
                  </span>
                </div>

                {playerCars.length > 0 ? (
                  <div className="space-y-2.5">
                    {playerCars.map((car) => {
                      const isLeader = car.currentPosition === 1
                      const gapText = isLeader ? 'LÍDER' : `+${car.gapToLeaderSec.toFixed(3)}s`
                      const totalFormatted = formatLapTime(car.totalTimeSec)

                      return (
                        <div
                          key={`pitwall_player_${car.id}`}
                          className="p-3 rounded-xl bg-gradient-to-r from-red-950/30 to-[#111827] border border-red-500/50 hover:border-red-400 transition-all space-y-2.5"
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-between text-xs font-mono cursor-pointer">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-md bg-[#E10600] text-white font-black flex items-center justify-center text-xs shadow-xs">
                                    P{car.currentPosition}
                                  </span>
                                  <div>
                                    <div className="font-extrabold text-white text-sm flex items-center gap-1.5">
                                      {car.driverName}
                                      <Badge className="bg-[#E10600] text-white text-[9px] px-1 py-0 h-4 font-black">
                                        (Você)
                                      </Badge>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-sans">
                                      {car.teamName} • Ritmo Atual:{' '}
                                      <strong className="text-amber-300 font-mono">
                                        {car.pace}
                                      </strong>
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div
                                    className={`font-mono font-black text-sm ${
                                      isLeader ? 'text-amber-400' : 'text-cyan-300'
                                    }`}
                                  >
                                    {gapText}
                                  </div>
                                  <span className="text-[10px] text-slate-400 block font-mono">
                                    Últ:{' '}
                                    {car.lastLapTimeSec ? formatLapTime(car.lastLapTimeSec) : '—'}
                                  </span>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#090D15] border border-slate-700 text-white p-3 font-mono text-xs shadow-xl">
                              <div className="space-y-1">
                                <div className="font-bold text-amber-400 border-b border-slate-800 pb-1">
                                  {car.driverName} — Detalhes
                                </div>
                                <div>
                                  Tempo Total Acumulado:{' '}
                                  <strong className="text-white">{totalFormatted}</strong> (
                                  {car.totalTimeSec.toFixed(3)}s)
                                </div>
                                <div>
                                  Gap para Carro à Frente:{' '}
                                  <strong className="text-cyan-400">
                                    {car.currentPosition === 1
                                      ? '—'
                                      : `+${car.gapToFrontSec.toFixed(3)}s`}
                                  </strong>
                                </div>
                                <div>
                                  Melhor Volta Pessoal:{' '}
                                  <strong className="text-purple-400">
                                    {car.bestLapTimeSec ? formatLapTime(car.bestLapTimeSec) : '—'}
                                  </strong>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>

                          {/* Slider de Controle de Ritmo 0-100 (Default 75) */}
                          <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span className="text-slate-400 flex items-center gap-1 font-bold">
                                <Gauge className="w-3 h-3 text-amber-400" />
                                Ritmo do Piloto
                              </span>
                              <span className="font-bold text-amber-300 font-mono">
                                {car.pace} / 100
                              </span>
                            </div>
                            <Slider
                              value={[car.pace]}
                              min={0}
                              max={100}
                              step={1}
                              onValueChange={(val) => handlePaceChange(car.id, val[0])}
                              className="py-1 cursor-pointer"
                              aria-label={`Controle de ritmo para ${car.driverName}`}
                            />
                            <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                              <span>0 (Conservador)</span>
                              <span>75 (Padrão)</span>
                              <span>100 (Ataque Máximo)</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
                    Nenhum piloto do jogador identificado no grid.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            PÓDIO FINAL E RESULTADO (QUANDO A CORRIDA TERMINAR)
           ========================================================================= */}
        {isFinished && simulationResult && officialResultAdapter && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Visual do Pódio FIA Oficial */}
            <PodiumVisualCard result={officialResultAdapter} />

            {/* Ações pós-corrida */}
            <Card className="bg-[#090D15] border border-slate-800 text-white rounded-2xl">
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Grande Prêmio Oficializado
                  </h4>
                  <p className="text-xs text-slate-400">
                    O resultado oficial foi processado e salvo para a carreira e estatísticas da
                    temporada.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleResetSimulation}
                    className="border-slate-700 text-white text-xs gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Simular Novamente
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabela de Classificação Completa em Pista (24 pilotos) */}
        <Card className="bg-white border border-[#E2E8F0] shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="py-3 px-4 bg-[#F8FAFC] border-b border-[#F1F5F9] flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-[#0F172A] flex items-center gap-2">
              <Gauge className="w-4 h-4 text-emerald-600" />
              Classificação Geral em Pista ({cars.length} Carros)
            </CardTitle>
            <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
              {isFinished ? 'FINAL' : `VOLTA ${currentLap}/${totalLaps}`}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="sticky top-0 bg-[#F8FAFC] border-b border-[#E2E8F0] z-10">
                  <tr className="text-[#64748B] uppercase tracking-wider text-[10px]">
                    <th className="py-2 px-3 text-center w-12">Pos</th>
                    <th className="py-2 px-3 text-center w-12">Grid</th>
                    <th className="py-2 px-3">Piloto</th>
                    <th className="py-2 px-3">Equipe</th>
                    <th className="py-2 px-3 text-center">Ritmo</th>
                    <th className="py-2 px-3 text-center">Última Volta</th>
                    <th className="py-2 px-3 text-center">Melhor Volta</th>
                    <th className="py-2 px-3 text-center">Gap Líder</th>
                    <th className="py-2 px-3 text-center">Gap Frente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {cars.map((car) => {
                    const isLeader = car.currentPosition === 1
                    const logoUrl = getTeamReducedLogoUrl(car.teamName || car.teamId)
                    const posDelta = car.gridPosition - car.currentPosition

                    return (
                      <tr
                        key={`sim_table_row_${car.id}`}
                        className={`transition-colors ${
                          car.isPlayer
                            ? 'bg-red-50/80 font-bold border-l-4 border-l-[#E10600]'
                            : isLeader
                              ? 'bg-amber-50/50 font-bold'
                              : 'hover:bg-slate-50 text-[#0F172A]'
                        }`}
                      >
                        {/* Posição */}
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold text-[11px] ${
                              isLeader
                                ? 'bg-amber-400 text-black shadow-xs font-black'
                                : car.currentPosition <= 3
                                  ? 'bg-slate-200 text-[#0F172A]'
                                  : car.currentPosition <= 10
                                    ? 'bg-slate-100 text-[#334155]'
                                    : 'bg-slate-50 text-[#64748B]'
                            }`}
                          >
                            P{car.currentPosition}
                          </span>
                        </td>

                        {/* Grid */}
                        <td className="py-2 px-3 text-center text-[10px] text-slate-500">
                          <div className="flex items-center justify-center gap-1">
                            <span>P{car.gridPosition}</span>
                            {posDelta !== 0 && (
                              <span
                                className={`text-[9px] font-bold ${
                                  posDelta > 0 ? 'text-emerald-600' : 'text-red-500'
                                }`}
                              >
                                {posDelta > 0 ? `+${posDelta}` : posDelta}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Piloto */}
                        <td className="py-2 px-3 font-sans">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={
                                car.isPlayer
                                  ? 'text-[#0F172A] font-extrabold'
                                  : 'text-[#1E293B] font-medium'
                              }
                            >
                              {car.driverName}
                            </span>
                            {car.isPlayer && (
                              <Badge className="bg-[#E10600] text-white text-[9px] px-1 py-0 h-4 uppercase font-black">
                                Você
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* Equipe */}
                        <td className="py-2 px-3 font-sans">
                          <div className="flex items-center gap-2">
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt={car.teamName}
                                className="w-4 h-4 rounded-xs object-contain"
                              />
                            ) : (
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: car.teamColor || '#94A3B8' }}
                              />
                            )}
                            <span
                              className="truncate max-w-[120px] text-xs"
                              style={{ color: car.teamColor }}
                            >
                              {car.teamName}
                            </span>
                          </div>
                        </td>

                        {/* Ritmo */}
                        <td className="py-2 px-3 text-center text-slate-600 font-mono text-[11px]">
                          {car.pace}
                        </td>

                        {/* Última Volta */}
                        <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-700">
                          {car.lastLapTimeSec ? formatLapTime(car.lastLapTimeSec) : '—'}
                        </td>

                        {/* Melhor Volta */}
                        <td className="py-2 px-3 text-center font-mono text-[11px]">
                          {car.bestLapTimeSec ? (
                            car.driverId === fastestLap?.driverId ? (
                              <span className="inline-flex items-center gap-1 font-black px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                                <Zap className="w-2.5 h-2.5 fill-current" />
                                {formatLapTime(car.bestLapTimeSec)}
                              </span>
                            ) : (
                              <span className="text-slate-600 font-medium">
                                {formatLapTime(car.bestLapTimeSec)}
                              </span>
                            )
                          ) : (
                            '—'
                          )}
                        </td>

                        {/* Gap Líder */}
                        <td className="py-2 px-3 text-center font-mono font-bold">
                          {isLeader ? (
                            <span className="text-amber-600 font-black">LÍDER</span>
                          ) : (
                            <span className="text-slate-600">
                              +{car.gapToLeaderSec.toFixed(3)}s
                            </span>
                          )}
                        </td>

                        {/* Gap Frente */}
                        <td className="py-2 px-3 text-center font-mono text-slate-500 text-[11px]">
                          {isLeader ? '—' : `+${car.gapToFrontSec.toFixed(3)}s`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

export default RaceSimulator
