import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import {
  DriverModel,
  PartModel,
  SponsorModel,
  SessionSetupModel,
  TireCompound,
  TireAllotment,
} from '@/types/f1'
import { F1_2026_CALENDAR, getAICompetitors, ENGINE_SUPPLIERS } from '@/lib/f1-data'
import { formatCurrency } from '@/lib/formatters'
import { toast } from '@/hooks/use-toast'
import {
  Gauge,
  Play,
  CloudRain,
  Sun,
  Zap,
  Flag,
  Award,
  AlertCircle,
  TrendingUp,
  Layers,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Trophy,
  Sliders,
  Disc,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Flame,
  Activity,
  HeartPulse,
  Wrench,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'

export type WeekendSession = 'tp1' | 'tp2' | 'q1' | 'q2' | 'q3' | 'race'

interface SimDriverEntry {
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  teamColor: string
  isPlayer: boolean
  flag: string
  score: number
  position: number
  points: number
  fastestLap: boolean
  usedOvertake: boolean
  dnf: boolean
  dnfReason?: string
  totalTime: string
  tireCompound?: TireCompound
  secondCompound?: TireCompound
  pitLap?: number
  tireWear?: number // 0-100%
  driverFatigue?: number // 0-100%
}

interface SessionTimeResult {
  position: number
  driverName: string
  teamName: string
  teamColor: string
  lapTime: string
  gap: string
  tire: TireCompound
  isPlayer: boolean
}

// Initial tire allotment per weekend per driver
const INITIAL_ALLOTMENT: TireAllotment = {
  duro: 2,
  medio: 3,
  macio: 3,
  intermediario: 4,
  chuva_extrema: 3,
}

export default function RacePage() {
  const { team, season, refreshTeamAndSeason } = useAuth()
  const navigate = useNavigate()

  const [drivers, setDrivers] = useState<DriverModel[]>([])
  const [parts, setParts] = useState<PartModel[]>([])
  const [sponsors, setSponsors] = useState<SponsorModel[]>([])
  const [loading, setLoading] = useState(true)

  // Current session step in GP weekend
  const [activeSession, setActiveSession] = useState<WeekendSession>('tp1')
  const [completedSessions, setCompletedSessions] = useState<WeekendSession[]>([])

  // Setup per session
  const [setups, setSetups] = useState<Record<WeekendSession, SessionSetupModel>>({
    tp1: {
      team_id: '',
      season_id: '',
      round: 1,
      session: 'tp1',
      wing_level: 6,
      suspension_stiffness: 6,
      pu_electric_ratio: 50,
      tire_compound: 'medio',
    },
    tp2: {
      team_id: '',
      season_id: '',
      round: 1,
      session: 'tp2',
      wing_level: 6,
      suspension_stiffness: 6,
      pu_electric_ratio: 50,
      tire_compound: 'macio',
    },
    q1: {
      team_id: '',
      season_id: '',
      round: 1,
      session: 'q1',
      wing_level: 6,
      suspension_stiffness: 6,
      pu_electric_ratio: 50,
      tire_compound: 'macio',
    },
    q2: {
      team_id: '',
      season_id: '',
      round: 1,
      session: 'q2',
      wing_level: 6,
      suspension_stiffness: 6,
      pu_electric_ratio: 50,
      tire_compound: 'macio',
    },
    q3: {
      team_id: '',
      season_id: '',
      round: 1,
      session: 'q3',
      wing_level: 6,
      suspension_stiffness: 6,
      pu_electric_ratio: 50,
      tire_compound: 'macio',
    },
    race: {
      team_id: '',
      season_id: '',
      round: 1,
      session: 'race',
      wing_level: 6,
      suspension_stiffness: 6,
      pu_electric_ratio: 50,
      tire_compound: 'medio',
      target_pit_lap: 25,
      second_tire_compound: 'duro',
    },
  })

  // Tire inventory for the GP weekend
  const [tireStock, setTireStock] = useState<TireAllotment>({ ...INITIAL_ALLOTMENT })

  // Session results records
  const [sessionResults, setSessionResults] = useState<Record<string, SessionTimeResult[]>>({})

  // Simulation animation states
  const [isSimulatingSession, setIsSimulatingSession] = useState(false)
  const [simText, setSimText] = useState('')
  const [simProgress, setSimProgress] = useState(0)

  // Race final results
  const [raceResults, setRaceResults] = useState<SimDriverEntry[] | null>(null)
  const [isFinishing, setIsFinishing] = useState(false)
  const [seasonCompleted, setSeasonCompleted] = useState(false)

  // Incidents log during race
  const [raceIncidents, setRaceIncidents] = useState<string[]>([])
  const [safetyCarActive, setSafetyCarActive] = useState(false)

  // Weather: randomized once per round
  const [weather, setWeather] = useState<'seco' | 'chuva'>('seco')

  const currentRound = season?.current_round || 1
  const totalRounds = season?.total_rounds || 24
  const gpInfo = F1_2026_CALENDAR[Math.min(currentRound - 1, F1_2026_CALENDAR.length - 1)]

  // Initial load
  useEffect(() => {
    // 25% chance of rain
    const isRain = Math.random() < 0.25
    setWeather(isRain ? 'chuva' : 'seco')

    if (currentRound > totalRounds) {
      setSeasonCompleted(true)
    }
  }, [currentRound, totalRounds])

  const loadData = async () => {
    if (!team || !season) {
      setLoading(false)
      return
    }
    try {
      const [dList, pList, spList, savedSetups] = await Promise.all([
        f1Service.getTeamDrivers(team.id),
        f1Service.getTeamParts(team.id),
        f1Service.getTeamSponsors(team.id),
        f1Service.getSessionSetups(team.id, season.id, currentRound),
      ])
      setDrivers(dList)
      setParts(pList)
      setSponsors(spList)

      // Merge saved setups if any
      if (savedSetups.length > 0) {
        setSetups((prev) => {
          const next = { ...prev }
          savedSetups.forEach((s) => {
            if (s.session && next[s.session]) {
              next[s.session] = { ...next[s.session], ...s }
            }
          })
          return next
        })
      } else {
        // Defaults calibrated to track characteristics
        const idealWing = gpInfo.downforceIdeal || 6
        const idealSuspension = gpInfo.suspensionIdeal || 6
        setSetups((prev) => {
          const next = { ...prev }
          Object.keys(next).forEach((k) => {
            const key = k as WeekendSession
            next[key] = {
              ...next[key],
              wing_level: idealWing,
              suspension_stiffness: idealSuspension,
              target_pit_lap: Math.round(gpInfo.laps * 0.42),
            }
          })
          return next
        })
      }
    } catch (err) {
      console.error('Error loading race weekend data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [team?.id, season?.id, currentRound])

  useRealtime('drivers', () => {
    loadData()
  })

  // Engine Spec
  const currentEngine = useMemo(() => {
    const sName = team?.engine_supplier || 'Mercedes'
    return ENGINE_SUPPLIERS.find((s) => s.name === sName) || ENGINE_SUPPLIERS[1]
  }, [team?.engine_supplier])

  // Player Car Overall Level
  const playerCarLevel = useMemo(() => {
    if (parts.length === 0) return 75
    const sum = parts.reduce((acc, p) => acc + p.level, 0)
    const avg = (sum / parts.length) * 10
    const base = Math.round(avg * 0.6 + currentEngine.power * 0.4)
    return team?.reserve_setup_bonus ? Math.min(100, base + 2) : base
  }, [parts, currentEngine, team?.reserve_setup_bonus])

  // Aerodynamic parts rating
  const aeroPart = parts.find((p) => p.name.includes('Aerodinâmica') || p.name.includes('Asa'))
  const aeroRating = aeroPart
    ? aeroPart.level >= 8
      ? 'Excelente'
      : aeroPart.level >= 5
        ? 'Bom'
        : 'Em desenvolvimento'
    : 'Bom'

  // Update setup slider / compound for current session
  const updateCurrentSetup = (field: keyof SessionSetupModel, value: any) => {
    setSetups((prev) => ({
      ...prev,
      [activeSession]: {
        ...prev[activeSession],
        team_id: team?.id || '',
        season_id: season?.id || '',
        round: currentRound,
        session: activeSession,
        [field]: value,
      },
    }))
  }

  // Handle saving setup to PocketBase
  const handleSaveSetup = async () => {
    if (!team || !season) return
    const setupData = setups[activeSession]
    try {
      await f1Service.saveSessionSetup({
        ...setupData,
        team_id: team.id,
        season_id: season.id,
        round: currentRound,
        session: activeSession,
      })
      toast({
        title: `Setup de ${activeSession.toUpperCase()} Salvo`,
        description: 'As configurações de aerodinâmica, rigidez e trem de força foram registradas.',
      })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar setup',
        description: 'Não foi possível persistir a configuração da sessão.',
      })
    }
  }

  // Calculate setup penalty for a session (deviations from track ideal)
  const calculateSetupDelta = (sessionKey: WeekendSession) => {
    const current = setups[sessionKey]
    const idealWing = gpInfo.downforceIdeal || 6
    const idealSuspension = gpInfo.suspensionIdeal || 6

    const wingDiff = Math.abs(current.wing_level - idealWing)
    const suspDiff = Math.abs(current.suspension_stiffness - idealSuspension)
    // 50/50 balance deviation from 50
    const puDiff = Math.abs(current.pu_electric_ratio - 50) / 10

    // Total penalty: 0 to 6 seconds per lap score
    const penalty = wingDiff * 0.8 + suspDiff * 0.6 + puDiff * 0.4
    return penalty
  }

  // Helper for tire compound name in PT-BR
  const formatTireName = (c?: TireCompound) => {
    switch (c) {
      case 'duro':
        return 'Duro (Branco - C1/C2)'
      case 'medio':
        return 'Médio (Amarelo - C3)'
      case 'macio':
        return 'Macio (Vermelho - C4/C5)'
      case 'intermediario':
        return 'Intermediário (Verde)'
      case 'chuva_extrema':
        return 'Chuva Extrema (Azul)'
      default:
        return 'Médio (Amarelo)'
    }
  }

  // Run Free Practice (TP1 / TP2) or Qualifying (Q1 / Q2 / Q3)
  const handleRunSession = (sessionToRun: WeekendSession) => {
    const titulars = drivers.filter((d) => d.role !== 'reserva' && d.team_id === team?.id)
    const reserve = drivers.find(
      (d) => d.role === 'reserva' || (d.reserve_team_id === team?.id && d.team_id !== team?.id),
    )

    if (titulars.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Escalação Incompleta',
        description: 'Você precisa de 2 pilotos titulares contratados para participar das sessões.',
      })
      navigate('/team')
      return
    }

    // Decrement tire compound chosen from stock
    const chosenTire = setups[sessionToRun].tire_compound || 'medio'
    if (tireStock[chosenTire] <= 0) {
      toast({
        variant: 'destructive',
        title: 'Estoque de Pneus Esgotado!',
        description: `Você não possui mais jogos do pneu ${formatTireName(chosenTire)}. Selecione outro composto disponível.`,
      })
      return
    }

    // Consume 1 tire set
    setTireStock((prev) => ({
      ...prev,
      [chosenTire]: Math.max(0, prev[chosenTire] - 1),
    }))

    setIsSimulatingSession(true)
    setSimProgress(0)

    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const aiRivals = getAICompetitors(team?.team_key, isCustomTeam)
    const playerTeamStrength = team?.strength ?? (isCustomTeam ? 58 : 75)
    const penalty = calculateSetupDelta(sessionToRun)

    // Simulation steps text
    const sessionNames: Record<WeekendSession, string> = {
      tp1: 'Treino Livre 1 (TP1) — Reconhecimento de pista e coleta de downforce',
      tp2: 'Treino Livre 2 (TP2) — Simulação de ritmo de corrida e desgaste de pneus',
      q1: 'Classificação Q1 — 22 carros buscando o corte do Top 15',
      q2: 'Classificação Q2 — Disputa feroz pelo Top 10 e Pole Shootout',
      q3: 'Classificação Q3 — Volta rápida decisiva para a Pole Position!',
      race: 'Grande Prêmio 2026',
    }

    setSimText(`Iniciando ${sessionNames[sessionToRun]}...`)

    let step = 0
    const interval = setInterval(() => {
      step += 25
      setSimProgress(step)
      if (step === 50) {
        setSimText(
          `Telemetria ativa: Ajuste de asa nível ${setups[sessionToRun].wing_level} e MGU-K ${setups[sessionToRun].pu_electric_ratio}% elétrico...`,
        )
      } else if (step === 75) {
        setSimText(`Voltas cronometradas no circuito de ${gpInfo.circuit}!`)
      } else if (step >= 100) {
        clearInterval(interval)
        setIsSimulatingSession(false)

        // Build session times
        const sessionGrid: {
          name: string
          team: string
          color: string
          lapScore: number
          isPlayer: boolean
          tire: TireCompound
        }[] = []

        // Player drivers
        titulars.forEach((d) => {
          let skill = d.speed * 0.45 + d.consistency * 0.35 + d.defense * 0.2
          if (weather === 'chuva') skill = d.speed * 0.3 + d.rain * 0.5 + d.consistency * 0.2
          const carScore = playerCarLevel * 0.65 + playerTeamStrength * 0.35 - penalty
          const luck = (Math.random() - 0.5) * 8
          sessionGrid.push({
            name: d.name,
            team: team?.name || 'Sua Escuderia',
            color: team?.color || '#FF3B30',
            lapScore: skill * 0.45 + carScore * 0.55 + luck,
            isPlayer: true,
            tire: chosenTire,
          })
        })

        // AI drivers
        aiRivals.forEach((ai) => {
          const aiCar = ai.carLevel * 0.65 + ai.strength * 0.35
          let d1Skill =
            ai.driver1.speed * 0.45 + ai.driver1.consistency * 0.35 + ai.driver1.defense * 0.2
          let d2Skill =
            ai.driver2.speed * 0.45 + ai.driver2.consistency * 0.35 + ai.driver2.defense * 0.2
          if (weather === 'chuva') {
            d1Skill = ai.driver1.speed * 0.3 + ai.driver1.rain * 0.5 + ai.driver1.consistency * 0.2
            d2Skill = ai.driver2.speed * 0.3 + ai.driver2.rain * 0.5 + ai.driver2.consistency * 0.2
          }

          sessionGrid.push({
            name: ai.driver1.name,
            team: ai.name,
            color: ai.color,
            lapScore: d1Skill * 0.45 + aiCar * 0.55 + (Math.random() - 0.5) * 8,
            isPlayer: false,
            tire: weather === 'chuva' ? 'intermediario' : 'macio',
          })
          sessionGrid.push({
            name: ai.driver2.name,
            team: ai.name,
            color: ai.color,
            lapScore: d2Skill * 0.45 + aiCar * 0.55 + (Math.random() - 0.5) * 8,
            isPlayer: false,
            tire: weather === 'chuva' ? 'intermediario' : 'macio',
          })
        })

        // Sort descending lapScore
        sessionGrid.sort((a, b) => b.lapScore - a.lapScore)

        // Generate formatted times (e.g. 1:19.420)
        const baseMin = 1
        const baseSec = 17 + Math.random() * 2
        const bestScore = sessionGrid[0].lapScore

        const formattedResults: SessionTimeResult[] = sessionGrid.map((entry, idx) => {
          const gapSec = (bestScore - entry.lapScore) * 0.045
          const entrySec = baseSec + gapSec
          const minPart = baseMin + Math.floor(entrySec / 60)
          const secPart = (entrySec % 60).toFixed(3)
          const lapTime = `${minPart}:${secPart.padStart(6, '0')}`

          return {
            position: idx + 1,
            driverName: entry.name,
            teamName: entry.team,
            teamColor: entry.color,
            lapTime,
            gap: idx === 0 ? 'LÍDER' : `+${gapSec.toFixed(3)}s`,
            tire: entry.tire,
            isPlayer: entry.isPlayer,
          }
        })

        setSessionResults((prev) => ({
          ...prev,
          [sessionToRun]: formattedResults,
        }))

        // Mark session completed
        setCompletedSessions((prev) => [...new Set<WeekendSession>([...prev, sessionToRun])])

        // Advance tab to next session automatically
        const sessionSequence: WeekendSession[] = ['tp1', 'tp2', 'q1', 'q2', 'q3', 'race']
        const currentIdx = sessionSequence.indexOf(sessionToRun)
        if (currentIdx >= 0 && currentIdx < sessionSequence.length - 1) {
          setActiveSession(sessionSequence[currentIdx + 1])
        }

        toast({
          title: `${sessionToRun.toUpperCase()} Finalizado!`,
          description: `Tempos registrados. Penalidade de setup: ${penalty > 2 ? 'Alta (+0.3s)' : penalty > 1 ? 'Média (+0.1s)' : 'Mínima (Ótimo acerto!)'}.`,
        })
      }
    }, 450)
  }

  // START MAIN RACE SIMULATION
  const handleStartRace = () => {
    const titulars = drivers.filter((d) => d.role !== 'reserva' && d.team_id === team?.id)
    const reserve = drivers.find(
      (d) => d.role === 'reserva' || (d.reserve_team_id === team?.id && d.team_id !== team?.id),
    )

    if (titulars.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Escalação Incompleta',
        description: 'Você precisa de 2 pilotos titulares contratados para largar.',
      })
      navigate('/team')
      return
    }

    // Regulation check: 2 different compounds mandatory in dry race!
    const raceSetup = setups.race
    const startCompound = raceSetup.tire_compound || 'medio'
    const pitCompound = raceSetup.second_tire_compound || 'duro'

    if (weather === 'seco' && startCompound === pitCompound) {
      toast({
        variant: 'destructive',
        title: 'Regulamento FIA 2026 Violado!',
        description:
          'É OBRIGATÓRIO usar pelo menos dois compostos diferentes durante a corrida em pista seca (ex: Médio + Duro).',
      })
      return
    }

    // Check tire availability
    if (tireStock[startCompound] <= 0 || tireStock[pitCompound] <= 0) {
      toast({
        variant: 'destructive',
        title: 'Estoque Insuficiente de Pneus',
        description: 'Você não possui jogos suficientes dos compostos selecionados para a corrida.',
      })
      return
    }

    // Deduct tires
    setTireStock((prev) => ({
      ...prev,
      [startCompound]: Math.max(0, prev[startCompound] - 1),
      [pitCompound]: Math.max(0, prev[pitCompound] - 1),
    }))

    setIsSimulatingSession(true)
    setSimProgress(0)
    setRaceIncidents([])
    setSafetyCarActive(false)

    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const aiRivals = getAICompetitors(team?.team_key, isCustomTeam)
    const playerTeamStrength = team?.strength ?? (isCustomTeam ? 58 : 75)
    const setupPenalty = calculateSetupDelta('race')

    // Track abrasiveness impacts tire wear
    const abrasiveness = gpInfo.tireAbrasiveness || 6

    const grid: SimDriverEntry[] = []
    const incidents: string[] = []

    // 1. Player's drivers
    titulars.forEach((d) => {
      const isIncapacitated = !!d.is_incapacitated
      const activeDriver = isIncapacitated && reserve ? reserve : d
      const isSubstituted = isIncapacitated && !!reserve

      // Driver fatigue accumulates
      const driverFatigue = Math.min(
        100,
        (d.age > 35 ? 40 : 25) +
          (sessionResults.tp1 ? 10 : 0) +
          (sessionResults.tp2 ? 10 : 0) +
          (sessionResults.q3 ? 15 : 0),
      )

      let driverSkill =
        activeDriver.speed * 0.4 + activeDriver.consistency * 0.35 + activeDriver.defense * 0.25
      if (weather === 'chuva') {
        driverSkill =
          activeDriver.speed * 0.25 + activeDriver.rain * 0.45 + activeDriver.consistency * 0.3
      }

      // Penalize for fatigue & setup delta
      driverSkill = Math.max(45, driverSkill - driverFatigue * 0.08)

      const effectiveCarScore = playerCarLevel * 0.7 + playerTeamStrength * 0.3 - setupPenalty
      const luck = (Math.random() - 0.5) * 14

      // Wear rate calculated: abrasiveness + stiffness
      const tireWear = Math.min(
        100,
        abrasiveness * 8 + (raceSetup.suspension_stiffness > 7 ? 15 : 5),
      )

      // Reliability check (Mechanical failure) based on engine & parts
      const mechanicalRisk =
        100 - currentEngine.reliability + (raceSetup.pu_electric_ratio > 65 ? 8 : 0)
      const mechanicalFailure = Math.random() * 100 < mechanicalRisk

      // Crash / incident chance based on driver consistency, weather and wear
      const crashRisk =
        (100 - activeDriver.consistency) * 0.15 +
        (weather === 'chuva' ? 8 : 2) +
        (tireWear > 75 ? 6 : 0)
      const hadCrash = Math.random() * 100 < crashRisk

      const isDnf = mechanicalFailure || hadCrash
      let dnfReason: string | undefined = undefined

      if (mechanicalFailure) {
        dnfReason = 'Falha no inversor de 350kW do MGU-K'
        incidents.push(`⚠️ ABANDONO: ${activeDriver.name} sofreu quebra no motor elétrico!`)
      } else if (hadCrash) {
        dnfReason =
          weather === 'chuva'
            ? 'Aquaplanagem e colisão nas barreiras'
            : 'Rodada no tráfego e quebra de suspensão'
        incidents.push(
          `💥 ACIDENTE: ${activeDriver.name} bateu forte no setor 2! Safety Car acionado.`,
        )
      }

      grid.push({
        driverId: activeDriver.id,
        driverName: isSubstituted
          ? `${activeDriver.name} (Substituto de ${d.name})`
          : activeDriver.name,
        teamId: team?.id || 'player',
        teamName: team?.name || 'Sua Escuderia',
        teamColor: team?.color || '#FF3B30',
        isPlayer: true,
        flag: activeDriver.nationality === 'Brasil' ? '🇧🇷' : '🏁',
        score: driverSkill * 0.4 + effectiveCarScore * 0.5 + luck - (tireWear > 80 ? 4 : 0),
        position: 0,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        dnf: isDnf,
        dnfReason,
        totalTime: '',
        tireCompound: startCompound,
        secondCompound: pitCompound,
        pitLap: raceSetup.target_pit_lap || 25,
        tireWear,
        driverFatigue,
      })
    })

    // 2. AI Rival Drivers
    aiRivals.forEach((aiTeam) => {
      const sup = ENGINE_SUPPLIERS.find((s) => s.name === aiTeam.engine) || ENGINE_SUPPLIERS[0]
      const effectiveAiCar = aiTeam.carLevel * 0.6 + aiTeam.strength * 0.4

      // Driver 1
      let d1Skill =
        aiTeam.driver1.speed * 0.4 +
        aiTeam.driver1.consistency * 0.35 +
        aiTeam.driver1.defense * 0.25
      if (weather === 'chuva')
        d1Skill =
          aiTeam.driver1.speed * 0.25 +
          aiTeam.driver1.rain * 0.45 +
          aiTeam.driver1.consistency * 0.3
      const d1MechFailure = Math.random() * 100 > sup.reliability + 6
      const d1Crash = Math.random() * 100 < (weather === 'chuva' ? 7 : 3)
      const d1Dnf = d1MechFailure || d1Crash

      if (d1Crash)
        incidents.push(`💥 ACIDENTE: ${aiTeam.driver1.name} (${aiTeam.name}) colidiu e abandonou!`)

      grid.push({
        driverId: `${aiTeam.id}_d1`,
        driverName: aiTeam.driver1.name,
        teamId: aiTeam.id,
        teamName: aiTeam.name,
        teamColor: aiTeam.color,
        isPlayer: false,
        flag: aiTeam.driver1.flag,
        score: d1Skill * 0.4 + effectiveAiCar * 0.5 + (Math.random() - 0.5) * 14,
        position: 0,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        dnf: d1Dnf,
        dnfReason: d1MechFailure
          ? 'Superaquecimento na bateria 50/50'
          : d1Crash
            ? 'Colisão nas barreiras'
            : undefined,
        totalTime: '',
        tireCompound: weather === 'chuva' ? 'intermediario' : 'medio',
        secondCompound: weather === 'chuva' ? 'chuva_extrema' : 'duro',
        pitLap: Math.round(gpInfo.laps * 0.4),
        tireWear: 70 + Math.round(Math.random() * 15),
        driverFatigue: 35,
      })

      // Driver 2
      let d2Skill =
        aiTeam.driver2.speed * 0.4 +
        aiTeam.driver2.consistency * 0.35 +
        aiTeam.driver2.defense * 0.25
      if (weather === 'chuva')
        d2Skill =
          aiTeam.driver2.speed * 0.25 +
          aiTeam.driver2.rain * 0.45 +
          aiTeam.driver2.consistency * 0.3
      const d2MechFailure = Math.random() * 100 > sup.reliability + 6
      const d2Crash = Math.random() * 100 < (weather === 'chuva' ? 7 : 3)
      const d2Dnf = d2MechFailure || d2Crash

      grid.push({
        driverId: `${aiTeam.id}_d2`,
        driverName: aiTeam.driver2.name,
        teamId: aiTeam.id,
        teamName: aiTeam.name,
        teamColor: aiTeam.color,
        isPlayer: false,
        flag: aiTeam.driver2.flag,
        score: d2Skill * 0.4 + effectiveAiCar * 0.5 + (Math.random() - 0.5) * 14,
        position: 0,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        dnf: d2Dnf,
        dnfReason: d2MechFailure
          ? 'Perda de pressão hidráulica do câmbio'
          : d2Crash
            ? 'Incidente na curva 1'
            : undefined,
        totalTime: '',
        tireCompound: weather === 'chuva' ? 'intermediario' : 'macio',
        secondCompound: weather === 'chuva' ? 'chuva_extrema' : 'medio',
        pitLap: Math.round(gpInfo.laps * 0.45),
        tireWear: 72 + Math.round(Math.random() * 15),
        driverFatigue: 38,
      })
    })

    // Sort: non-DNF by score, then DNF
    grid.sort((a, b) => {
      if (a.dnf && !b.dnf) return 1
      if (!a.dnf && b.dnf) return -1
      return b.score - a.score
    })

    // Assign positions & points
    const pointsTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
    const baseMinutes = 78
    const baseSeconds = 14

    grid.forEach((entry, idx) => {
      entry.position = idx + 1
      if (!entry.dnf && idx < pointsTable.length) {
        entry.points = pointsTable[idx]
      }
      if (idx > 0 && !entry.dnf && Math.random() < 0.65) {
        entry.usedOvertake = true
      }
      if (entry.dnf) {
        entry.totalTime = 'ABANDONO (DNF)'
      } else if (idx === 0) {
        entry.totalTime = `1h ${baseMinutes}m ${baseSeconds.toFixed(3)}s`
      } else {
        const gap = (idx * 1.75 + Math.random() * 0.8).toFixed(3)
        entry.totalTime = `+${gap}s`
      }
    })

    // Fastest Lap
    const top10 = grid.filter((g) => !g.dnf && g.position <= 10)
    if (top10.length > 0) {
      const flIndex = Math.floor(Math.random() * top10.length)
      top10[flIndex].fastestLap = true
      top10[flIndex].points += 1
    }

    if (incidents.length > 0) {
      setSafetyCarActive(true)
    }
    setRaceIncidents(incidents)

    // Simulation steps
    const raceMessages = [
      'LARGADA! 22 carros arrancam com o torque elétrico imediato do MGU-K 350kW!',
      `Volta ${Math.round(gpInfo.laps * 0.25)}: Gestão de desgaste de pneus e bateria 50/50 em ritmo alto!`,
      `Volta ${raceSetup.target_pit_lap || 25}: JANELA DE PIT-STOP ABERTA! Troca obrigatória de pneus nos boxes!`,
      `Volta ${Math.round(gpInfo.laps * 0.75)}: Modo Overtake acionado a menos de 1s! Bateria descarrega potência total em reta!`,
      'BANDEIRA QUADRICULADA! Cruzando a linha de chegada!',
    ]

    let step = 0
    const interval = setInterval(() => {
      if (step < raceMessages.length) {
        setSimText(raceMessages[step])
        setSimProgress(Math.round(((step + 1) / raceMessages.length) * 100))
        step++
      } else {
        clearInterval(interval)
        setIsSimulatingSession(false)
        setRaceResults(grid)
        setCompletedSessions((prev) => [...new Set<WeekendSession>([...prev, 'race'])])
      }
    }, 600)
  }

  // ADVANCE ROUND & PERSIST RESULTS ROBUSTLY
  const handleAdvanceRound = async () => {
    if (!raceResults || !team || !season) return
    setIsFinishing(true)

    try {
      // 1. Idempotency: clean any previous partial results for this round
      await f1Service.deleteRaceResultsForRound(season.id, currentRound)

      // 2. Persist race_results with canonical ID resolution
      const resultsToSave = raceResults.filter((r) => r.isPlayer || r.position <= 10)

      let savedCount = 0
      for (const res of resultsToSave) {
        try {
          // Canonical resolution of driver and team
          const { canonicalDriverId, canonicalTeamId } = await f1Service.ensureDriverAndTeam(
            res.driverName,
            res.driverId,
            res.teamId,
            { name: res.teamName, color: res.teamColor },
            { role: 'titular' },
          )

          if (canonicalDriverId && canonicalTeamId) {
            await f1Service.createRaceResult({
              season_id: season.id,
              round: currentRound,
              driver_id: canonicalDriverId,
              team_id: canonicalTeamId,
              position: res.position,
              points: res.points ?? 0,
              fastest_lap: !!res.fastestLap,
            })
            savedCount++
          }
        } catch (resErr) {
          console.warn('Erro tolerado ao gravar resultado de um piloto:', res.driverName, resErr)
        }
      }

      // 3. Process Finances
      let totalSponsorIncome = 0
      for (const sp of sponsors) {
        if (sp.status === 'ativo') {
          totalSponsorIncome += sp.value_per_round
          if (sp.rounds_remaining && sp.rounds_remaining > 1) {
            await f1Service.updateSponsor(sp.id, { rounds_remaining: sp.rounds_remaining - 1 })
          } else if (sp.rounds_remaining === 1) {
            await f1Service.updateSponsor(sp.id, { rounds_remaining: 0, status: 'encerrado' })
          }
        }
      }

      const driversCost = drivers.reduce((sum, d) => sum + Math.round(d.salary / 24), 0)
      const engineCost = Math.round(currentEngine.costAnnual / 24)
      const netCashflow = totalSponsorIncome - driversCost - engineCost
      const updatedBudget = Math.max(0, team.budget + netCashflow)

      // 4. Update Driver fatigue, injuries & reserves
      const titulars = drivers.filter((d) => d.role !== 'reserva' && d.team_id === team.id)
      const reserve = drivers.find(
        (d) => d.role === 'reserva' || (d.reserve_team_id === team.id && d.team_id !== team.id),
      )

      for (const t of titulars) {
        if (t.is_incapacitated) {
          const roundsLeft = (t.incapacitated_rounds_left || 1) - 1
          if (roundsLeft <= 0) {
            await f1Service.updateDriver(t.id, {
              is_incapacitated: false,
              incapacitated_rounds_left: 0,
              incapacitated_reason: '',
            })
            await f1Service.addEvent(
              team.id,
              `Piloto ${t.name} foi liberado pelo departamento médico e retorna ao cockpit!`,
              'resultado',
            )
          } else {
            await f1Service.updateDriver(t.id, { incapacitated_rounds_left: roundsLeft })
          }
        } else {
          // Small chance of fatigue/injury
          const injuryRoll = Math.random() < 0.04
          if (injuryRoll && reserve) {
            const reasons = [
              'Lesão cervical por fadiga em alta velocidade',
              'Contratura muscular nas costas',
              'Intoxicação alimentar',
            ]
            const reason = reasons[Math.floor(Math.random() * reasons.length)]
            await f1Service.updateDriver(t.id, {
              is_incapacitated: true,
              incapacitated_rounds_left: 1,
              incapacitated_reason: reason,
            })
            await f1Service.addEvent(
              team.id,
              `ALERTA MÉDICO: ${t.name} sofreu "${reason}" e ficará fora da próxima etapa. O reserva ${reserve.name} assumirá o carro!`,
              'resultado',
            )
          }
        }
      }

      await f1Service.updateTeam(team.id, {
        budget: updatedBudget,
      })

      // 5. Register Event
      const playerWinner = raceResults.find((p) => p.isPlayer && p.position === 1)
      const bestPos = Math.min(...raceResults.filter((p) => p.isPlayer).map((p) => p.position))
      const eventMsg = playerWinner
        ? `VITÓRIA ESPETACULAR! ${playerWinner.driverName} venceu o ${gpInfo.name}!`
        : `Rodada ${currentRound} (${gpInfo.name}) concluída. Melhor posição da equipe: P${bestPos}. Fluxo financeiro: ${formatCurrency(netCashflow)}.`

      await f1Service.addEvent(team.id, eventMsg, 'resultado')

      // 6. Advance season round
      const nextRound = currentRound + 1
      await f1Service.updateSeason(season.id, { current_round: nextRound })

      toast({
        title: `Rodada ${currentRound} Concluída com Sucesso!`,
        description: `${savedCount} classificações registradas no campeonato oficial.`,
      })

      await refreshTeamAndSeason()

      if (nextRound > totalRounds) {
        setSeasonCompleted(true)
      } else {
        navigate('/')
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao avançar rodada',
        description: err?.message || 'Tente novamente.',
      })
    } finally {
      setIsFinishing(false)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F2733]/80">
        <div>
          <span className="text-xs font-mono font-bold tracking-widest text-[#E10600] uppercase">
            Fim de Semana de Grande Prêmio Oficial • Regulamento F1 2026
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FA] mt-1">
            {gpInfo.name} • Rodada {currentRound}/{totalRounds}
          </h1>
          <p className="text-sm font-mono text-[#00A6FB] mt-0.5">
            {gpInfo.circuit} • {gpInfo.country} {gpInfo.flag}
          </p>
        </div>

        {/* Global Weather & Abrasiveness Badge */}
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`font-mono text-xs px-3 py-1 flex items-center gap-1.5 ${
              weather === 'chuva'
                ? 'border-sky-400 text-sky-400 bg-sky-400/10'
                : 'border-amber-400 text-amber-400 bg-amber-400/10'
            }`}
          >
            {weather === 'chuva' ? <CloudRain className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {weather === 'chuva' ? 'Pista Molhada (Chuva)' : 'Pista Seca'}
          </Badge>

          <Badge variant="outline" className="border-[#1F2733] text-[#8B95A7] font-mono text-xs">
            Abrasividade: {gpInfo.tireAbrasiveness || 6}/10
          </Badge>
        </div>
      </div>

      {/* Season Completed Banner if R24 */}
      {seasonCompleted && (
        <Card className="bg-gradient-to-r from-[#11161F] via-[#1E2738] to-[#11161F] border-2 border-amber-500/60 p-6 shadow-2xl">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
              <Trophy className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7FA]">
                Temporada 2026 Finalizada!
              </h2>
              <p className="text-sm text-[#8B95A7] max-w-lg mx-auto mt-1">
                Todas as 24 etapas foram concluídas sob a nova era dos motores 50/50 e aerodinâmica
                ativa.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Button asChild className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                <a href="/standings">Ver Classificação Final de Campeões</a>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* TIRE ALLOTMENT STATUS BAR (FIA 2026 Regulation) */}
      <Card className="bg-[#11161F] border-[#1F2733] p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-[#F5F7FA] flex items-center gap-2">
              <Disc className="w-4 h-4 text-[#E10600]" />
              Estoque Oficial de Pneus do Piloto (Regulamento FIA)
            </h3>
            <p className="text-xs text-[#8B95A7] mt-0.5">
              Alocação limitada por GP. Pista seca exige uso obrigatório de 2 compostos na corrida!
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
            {/* Hard */}
            <div className="p-2 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-white ring-1 ring-slate-400" />
                <span className="text-[#8B95A7] text-[10px]">DURO (C1/C2)</span>
              </div>
              <strong
                className={`text-sm block mt-0.5 ${tireStock.duro === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
              >
                {tireStock.duro} jogos
              </strong>
            </div>

            {/* Medium */}
            <div className="p-2 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 ring-1 ring-yellow-500" />
                <span className="text-[#8B95A7] text-[10px]">MÉDIO (C3)</span>
              </div>
              <strong
                className={`text-sm block mt-0.5 ${tireStock.medio === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
              >
                {tireStock.medio} jogos
              </strong>
            </div>

            {/* Soft */}
            <div className="p-2 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 ring-1 ring-red-600" />
                <span className="text-[#8B95A7] text-[10px]">MACIO (C4/C5)</span>
              </div>
              <strong
                className={`text-sm block mt-0.5 ${tireStock.macio === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
              >
                {tireStock.macio} jogos
              </strong>
            </div>

            {/* Intermediate */}
            <div className="p-2 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1 ring-emerald-600" />
                <span className="text-[#8B95A7] text-[10px]">INTERMEDIÁRIO</span>
              </div>
              <strong
                className={`text-sm block mt-0.5 ${tireStock.intermediario === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
              >
                {tireStock.intermediario} jogos
              </strong>
            </div>

            {/* Wet */}
            <div className="p-2 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-center col-span-2 sm:col-span-1">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-1 ring-blue-600" />
                <span className="text-[#8B95A7] text-[10px]">CHUVA EXTREMA</span>
              </div>
              <strong
                className={`text-sm block mt-0.5 ${tireStock.chuva_extrema === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
              >
                {tireStock.chuva_extrema} jogos
              </strong>
            </div>
          </div>
        </div>
      </Card>

      {/* WEEKEND TABS: TP1, TP2, Q1, Q2, Q3, CORRIDA */}
      <Tabs
        value={activeSession}
        onValueChange={(v) => setActiveSession(v as WeekendSession)}
        className="w-full"
      >
        <TabsList className="bg-[#11161F] border border-[#1F2733] grid grid-cols-3 sm:grid-cols-6 h-auto p-1 gap-1">
          {(['tp1', 'tp2', 'q1', 'q2', 'q3', 'race'] as WeekendSession[]).map((sess) => {
            const isDone = completedSessions.includes(sess)
            const labelMap: Record<WeekendSession, string> = {
              tp1: 'Treino 1',
              tp2: 'Treino 2',
              q1: 'Q1',
              q2: 'Q2',
              q3: 'Q3',
              race: 'Corrida GP',
            }

            return (
              <TabsTrigger
                key={sess}
                value={sess}
                className="data-[state=active]:bg-[#E10600] data-[state=active]:text-white font-mono text-xs py-2 flex items-center justify-center gap-1"
              >
                {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {labelMap[sess]}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* Dynamic content for each session */}
        {(['tp1', 'tp2', 'q1', 'q2', 'q3', 'race'] as WeekendSession[]).map((sessKey) => {
          const currentSetup = setups[sessKey]
          const isRaceSession = sessKey === 'race'
          const isDone = completedSessions.includes(sessKey)
          const resultsForThis = sessionResults[sessKey]

          return (
            <TabsContent key={sessKey} value={sessKey} className="space-y-6 mt-4">
              {/* Setup Configuration Panel for this session */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sliders: Wing, Suspension, 50/50 Power */}
                <Card className="bg-[#11161F] border-[#1F2733] lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-[#E10600]" />
                        Configuração do Carro — {sessKey.toUpperCase()}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSaveSetup}
                        className="border-[#1F2733] text-xs h-8 text-[#00A6FB] hover:bg-[#1F2733]"
                      >
                        Salvar Setup
                      </Button>
                    </CardTitle>
                    <CardDescription className="text-xs text-[#8B95A7]">
                      Ajuste fino de aerodinâmica ativa, suspensão mecânica e gestão do trem de
                      força híbrido para {gpInfo.circuit}.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Slider 1: Wing Downforce */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-[#F5F7FA] font-bold flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-[#00A6FB]" /> Nível da Asa (Pressão
                          Aerodinâmica):
                        </span>
                        <Badge variant="outline" className="border-[#1F2733] text-[#00A6FB]">
                          Nível {currentSetup.wing_level}/10 •{' '}
                          {currentSetup.wing_level <= 3
                            ? 'Baixo Arrasto (Monza)'
                            : currentSetup.wing_level >= 8
                              ? 'Alta Carga (Mônaco)'
                              : 'Misto Médio'}
                        </Badge>
                      </div>
                      <Slider
                        value={[currentSetup.wing_level]}
                        min={1}
                        max={10}
                        step={1}
                        onValueChange={(val) => updateCurrentSetup('wing_level', val[0])}
                        className="py-2"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[#8B95A7]">
                        <span>1 (Mínimo arrasto em retas)</span>
                        <span>Ideal do circuito: {gpInfo.downforceIdeal || 6}</span>
                        <span>10 (Máxima aderência em curvas)</span>
                      </div>
                    </div>

                    {/* Slider 2: Suspension Stiffness */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-[#F5F7FA] font-bold flex items-center gap-1.5">
                          <Gauge className="w-4 h-4 text-emerald-400" /> Rigidez da Suspensão:
                        </span>
                        <Badge variant="outline" className="border-[#1F2733] text-emerald-400">
                          Nível {currentSetup.suspension_stiffness}/10 •{' '}
                          {currentSetup.suspension_stiffness <= 4
                            ? 'Macia (Absorve zebras)'
                            : currentSetup.suspension_stiffness >= 8
                              ? 'Rígida (Alta estabilidade)'
                              : 'Equilibrada'}
                        </Badge>
                      </div>
                      <Slider
                        value={[currentSetup.suspension_stiffness]}
                        min={1}
                        max={10}
                        step={1}
                        onValueChange={(val) => updateCurrentSetup('suspension_stiffness', val[0])}
                        className="py-2"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[#8B95A7]">
                        <span>1 (Macia / menos desgaste)</span>
                        <span>Ideal do circuito: {gpInfo.suspensionIdeal || 6}</span>
                        <span>10 (Rígida / mais resposta)</span>
                      </div>
                    </div>

                    {/* Slider 3: 50/50 Power Unit Balance */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-[#F5F7FA] font-bold flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-amber-400" /> Balanço de Potência 50/50
                          (Elétrico MGU-K vs Combustão V6):
                        </span>
                        <Badge variant="outline" className="border-[#1F2733] text-amber-400">
                          {currentSetup.pu_electric_ratio}% Elétrico /{' '}
                          {100 - currentSetup.pu_electric_ratio}% V6
                        </Badge>
                      </div>
                      <Slider
                        value={[currentSetup.pu_electric_ratio]}
                        min={20}
                        max={80}
                        step={5}
                        onValueChange={(val) => updateCurrentSetup('pu_electric_ratio', val[0])}
                        className="py-2"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[#8B95A7]">
                        <span>20% (Conservador / mais confiável)</span>
                        <span>50% (Padrão Oficial FIA 2026)</span>
                        <span>80% (Pico elétrico agressivo / risco térmico)</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tire & Pit Stop Strategy Choice */}
                <Card className="bg-[#11161F] border-[#1F2733] flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
                      <Disc className="w-5 h-5 text-yellow-400" />
                      Estratégia de Pneus & Boxes
                    </CardTitle>
                    <CardDescription className="text-xs text-[#8B95A7]">
                      {isRaceSession
                        ? 'Defina os 2 compostos obrigatórios e a volta prevista do pit stop.'
                        : 'Escolha o jogo de pneus para este stint de treino/classificação.'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Primary Tire Choice */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono text-[#8B95A7] block">
                        {isRaceSession ? 'Composto de Largada (Stint 1):' : 'Composto da Sessão:'}
                      </label>
                      <select
                        value={currentSetup.tire_compound || 'medio'}
                        onChange={(e) =>
                          updateCurrentSetup('tire_compound', e.target.value as TireCompound)
                        }
                        className="w-full bg-[#0B0E14] border border-[#1F2733] rounded-lg px-3 py-2 text-xs font-mono text-[#F5F7FA] focus:outline-none focus:border-[#00A6FB]"
                      >
                        <option value="macio">Macio (Vermelho) — Estoque: {tireStock.macio}</option>
                        <option value="medio">Médio (Amarelo) — Estoque: {tireStock.medio}</option>
                        <option value="duro">Duro (Branco) — Estoque: {tireStock.duro}</option>
                        <option value="intermediario">
                          Intermediário (Verde) — Estoque: {tireStock.intermediario}
                        </option>
                        <option value="chuva_extrema">
                          Chuva Extrema (Azul) — Estoque: {tireStock.chuva_extrema}
                        </option>
                      </select>
                    </div>

                    {/* Secondary Tire & Pit Lap (only for Race) */}
                    {isRaceSession && (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-xs font-mono text-[#8B95A7] block">
                            Segundo Composto (Stint 2 pós-pit):
                          </label>
                          <select
                            value={currentSetup.second_tire_compound || 'duro'}
                            onChange={(e) =>
                              updateCurrentSetup(
                                'second_tire_compound',
                                e.target.value as TireCompound,
                              )
                            }
                            className="w-full bg-[#0B0E14] border border-[#1F2733] rounded-lg px-3 py-2 text-xs font-mono text-[#F5F7FA] focus:outline-none focus:border-[#00A6FB]"
                          >
                            <option value="duro">Duro (Branco) — Estoque: {tireStock.duro}</option>
                            <option value="medio">
                              Médio (Amarelo) — Estoque: {tireStock.medio}
                            </option>
                            <option value="macio">
                              Macio (Vermelho) — Estoque: {tireStock.macio}
                            </option>
                            <option value="intermediario">
                              Intermediário (Verde) — Estoque: {tireStock.intermediario}
                            </option>
                            <option value="chuva_extrema">
                              Chuva Extrema (Azul) — Estoque: {tireStock.chuva_extrema}
                            </option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-[#8B95A7]">Volta-alvo de Pit Stop:</span>
                            <strong className="text-[#F5F7FA]">
                              Volta {currentSetup.target_pit_lap || 25} de {gpInfo.laps}
                            </strong>
                          </div>
                          <Slider
                            value={[currentSetup.target_pit_lap || 25]}
                            min={10}
                            max={Math.max(15, gpInfo.laps - 8)}
                            step={1}
                            onValueChange={(val) => updateCurrentSetup('target_pit_lap', val[0])}
                            className="py-1"
                          />
                        </div>
                      </>
                    )}

                    {/* Action button to execute session */}
                    <div className="pt-2">
                      {isRaceSession ? (
                        <Button
                          size="lg"
                          onClick={handleStartRace}
                          disabled={isSimulatingSession || isDone}
                          className="w-full bg-gradient-to-r from-[#E10600] to-[#FF6B35] hover:from-[#FF2E25] hover:to-[#FF7B48] text-white font-extrabold shadow-lg"
                        >
                          <Play className="w-4 h-4 mr-2 fill-current" />
                          {isDone ? 'Corrida Concluída' : 'Largada da Corrida (GP)'}
                        </Button>
                      ) : (
                        <Button
                          size="lg"
                          onClick={() => handleRunSession(sessKey)}
                          disabled={isSimulatingSession}
                          className="w-full bg-[#00A6FB] hover:bg-[#0092DC] text-[#0B0E14] font-bold shadow-md"
                        >
                          <Play className="w-4 h-4 mr-2 fill-current" />
                          {isDone
                            ? `Repetir Stint ${sessKey.toUpperCase()}`
                            : `Executar ${sessKey.toUpperCase()}`}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Simulation Animation Banner */}
              {isSimulatingSession && (
                <Card className="bg-[#11161F] border border-[#00A6FB]/60 p-6 text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#00A6FB]/20 text-[#00A6FB] animate-spin mx-auto">
                    <Gauge className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#F5F7FA]">{simText}</h3>
                    <Progress
                      value={simProgress}
                      className="h-2 max-w-md mx-auto mt-3 bg-[#0B0E14]"
                    />
                  </div>
                </Card>
              )}

              {/* Session Results Timesheet (TP1, TP2, Q1, Q2, Q3) */}
              {!isRaceSession && resultsForThis && resultsForThis.length > 0 && (
                <Card className="bg-[#11161F] border-[#1F2733]">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-400" />
                        Tabela de Tempos Oficiais — {sessKey.toUpperCase()}
                      </CardTitle>
                      <CardDescription className="text-xs text-[#8B95A7]">
                        Classificação após voltas rápidas completadas no {gpInfo.circuit}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-400 font-mono text-xs"
                    >
                      Sessão Finalizada
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-[#1F2733] text-[#8B95A7] uppercase tracking-wider">
                            <th className="py-2 px-3 w-12">Pos</th>
                            <th className="py-2 px-3">Piloto</th>
                            <th className="py-2 px-3">Escuderia</th>
                            <th className="py-2 px-3">Pneu</th>
                            <th className="py-2 px-3">Melhor Volta</th>
                            <th className="py-2 px-3 text-right">Diferença</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1F2733]/60">
                          {resultsForThis.slice(0, 15).map((row) => (
                            <tr
                              key={row.position}
                              className={`transition-colors ${
                                row.isPlayer
                                  ? 'bg-[#E10600]/10 font-bold border-l-4 border-l-[#E10600]'
                                  : 'hover:bg-[#161D29]/40'
                              }`}
                            >
                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold ${
                                    row.position === 1
                                      ? 'bg-amber-400 text-black'
                                      : row.position <= 3
                                        ? 'bg-slate-300 text-black'
                                        : 'text-[#8B95A7]'
                                  }`}
                                >
                                  {row.position}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={
                                    row.isPlayer ? 'text-[#F5F7FA] font-bold' : 'text-[#F5F7FA]'
                                  }
                                >
                                  {row.driverName}
                                </span>
                                {row.isPlayer && (
                                  <Badge className="ml-2 bg-[#E10600] text-white text-[9px] px-1 py-0 h-3.5">
                                    Sua Equipe
                                  </Badge>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <span style={{ color: row.teamColor }}>{row.teamName}</span>
                              </td>
                              <td className="py-2.5 px-3 text-capitalize text-[#8B95A7]">
                                {row.tire}
                              </td>
                              <td className="py-2.5 px-3 text-[#00A6FB]">{row.lapTime}</td>
                              <td className="py-2.5 px-3 text-right text-[#8B95A7]">{row.gap}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* RACE RESULTS (Only for race session) */}
              {isRaceSession && raceResults && (
                <div className="space-y-6">
                  {/* Safety Car / Incidents alert if occurred */}
                  {raceIncidents.length > 0 && (
                    <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-amber-400 text-xs font-mono uppercase">
                        <ShieldAlert className="w-4 h-4" /> Relatório de Incidentes & Bandeiras
                      </div>
                      <div className="space-y-1 text-xs text-[#F5F7FA] font-mono">
                        {raceIncidents.map((inc, i) => (
                          <div key={i}>{inc}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Classification Table */}
                  <Card className="bg-[#11161F] border-[#1F2733]">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
                      <div>
                        <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
                          <Award className="w-5 h-5 text-amber-400" />
                          Resultado Oficial do GP — {gpInfo.name}
                        </CardTitle>
                        <CardDescription className="text-xs text-[#8B95A7]">
                          Desgaste de pneus acumulado, paradas nos boxes e pontos FIA atribuídos.
                        </CardDescription>
                      </div>

                      {/* Advance Button */}
                      <Button
                        size="sm"
                        onClick={handleAdvanceRound}
                        disabled={isFinishing}
                        className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold px-6 shadow-lg"
                      >
                        {isFinishing ? 'Salvando dados...' : 'Avançar para Próxima Rodada'}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardHeader>

                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="border-b border-[#1F2733] text-[#8B95A7] uppercase tracking-wider">
                              <th className="py-2.5 px-3">Pos</th>
                              <th className="py-2.5 px-3">Piloto</th>
                              <th className="py-2.5 px-3">Equipe</th>
                              <th className="py-2.5 px-2 text-center">Pneus (1º/2º)</th>
                              <th className="py-2.5 px-2 text-center">Desgaste</th>
                              <th className="py-2.5 px-3">Tempo / Gap</th>
                              <th className="py-2.5 px-3 text-right">Pts</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1F2733]/60">
                            {raceResults.map((row) => (
                              <tr
                                key={row.driverId}
                                className={`transition-colors ${
                                  row.isPlayer
                                    ? 'bg-[#E10600]/10 font-bold border-l-4 border-l-[#E10600]'
                                    : 'hover:bg-[#161D29]/40'
                                }`}
                              >
                                <td className="py-3 px-3">
                                  <span
                                    className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold ${
                                      row.position === 1
                                        ? 'bg-amber-400 text-black'
                                        : row.position === 2
                                          ? 'bg-slate-300 text-black'
                                          : row.position === 3
                                            ? 'bg-amber-700 text-white'
                                            : 'text-[#8B95A7]'
                                    }`}
                                  >
                                    {row.dnf ? 'DNF' : row.position}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    <span>{row.flag}</span>
                                    <span
                                      className={
                                        row.isPlayer ? 'text-[#F5F7FA] font-bold' : 'text-[#F5F7FA]'
                                      }
                                    >
                                      {row.driverName}
                                    </span>
                                    {row.fastestLap && (
                                      <Badge className="bg-purple-600 text-white text-[9px] px-1 py-0 h-4">
                                        FL +1
                                      </Badge>
                                    )}
                                  </div>
                                  {row.dnfReason && (
                                    <span className="text-[10px] text-red-400 block mt-0.5 font-normal">
                                      {row.dnfReason}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  <span style={{ color: row.teamColor }}>{row.teamName}</span>
                                </td>
                                <td className="py-3 px-2 text-center text-[#8B95A7]">
                                  {row.tireCompound?.slice(0, 3)} /{' '}
                                  {row.secondCompound?.slice(0, 3)}
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <span
                                    className={`font-bold ${
                                      (row.tireWear || 0) > 85
                                        ? 'text-red-400'
                                        : (row.tireWear || 0) > 65
                                          ? 'text-amber-400'
                                          : 'text-emerald-400'
                                    }`}
                                  >
                                    {row.tireWear || 70}%
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-[#8B95A7]">{row.totalTime}</td>
                                <td className="py-3 px-3 text-right">
                                  {row.points > 0 ? (
                                    <strong className="text-emerald-400 font-bold text-sm">
                                      +{row.points}
                                    </strong>
                                  ) : (
                                    <span className="text-[#8B95A7]">0</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
