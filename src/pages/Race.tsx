import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { DriverModel, PartModel, RaceResultModel, SponsorModel } from '@/types/f1'
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
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

interface SimDriverEntry {
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  teamColor: string
  isPlayer: boolean
  flag: string
  // Stats
  score: number
  position: number
  points: number
  fastestLap: boolean
  usedOvertake: boolean // Modo Overtake acionado a <1s
  dnf: boolean
  dnfReason?: string
  totalTime: string
}

export default function RacePage() {
  const { team, season, refreshTeamAndSeason } = useAuth()
  const navigate = useNavigate()

  const [drivers, setDrivers] = useState<DriverModel[]>([])
  const [parts, setParts] = useState<PartModel[]>([])
  const [sponsors, setSponsors] = useState<SponsorModel[]>([])
  const [loading, setLoading] = useState(true)

  // Simulation state
  const [weather, setWeather] = useState<'seco' | 'chuva'>('seco')
  const [isSimulating, setIsSimulating] = useState(false)
  const [simLap, setSimLap] = useState(1)
  const [simText, setSimText] = useState('')
  const [simResults, setSimResults] = useState<SimDriverEntry[] | null>(null)
  const [completed, setCompleted] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)

  // Season end summary
  const [seasonCompleted, setSeasonCompleted] = useState(false)

  const currentRound = season?.current_round || 1
  const totalRounds = season?.total_rounds || 24
  const gpInfo = F1_2026_CALENDAR[Math.min(currentRound - 1, F1_2026_CALENDAR.length - 1)]

  // Initial load
  useEffect(() => {
    // Generate random weather once per round
    const isRain = Math.random() < 0.28 // 28% chance of rain
    setWeather(isRain ? 'chuva' : 'seco')

    if (currentRound > totalRounds) {
      setSeasonCompleted(true)
    }
  }, [currentRound, totalRounds])

  const loadData = async () => {
    if (!team) {
      setLoading(false)
      return
    }
    try {
      const [dList, pList, spList] = await Promise.all([
        f1Service.getTeamDrivers(team.id),
        f1Service.getTeamParts(team.id),
        f1Service.getTeamSponsors(team.id),
      ])
      setDrivers(dList)
      setParts(pList)
      setSponsors(spList)
    } catch (err) {
      console.error('Error loading race data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [team?.id])

  useRealtime('drivers', () => {
    loadData()
  })

  // Engine spec
  const currentEngine = useMemo(() => {
    const sName = team?.engine_supplier || 'Mercedes'
    return ENGINE_SUPPLIERS.find((s) => s.name === sName) || ENGINE_SUPPLIERS[1]
  }, [team?.engine_supplier])

  // Overall player car rating (with reserve FP setup bonus if active)
  const playerCarLevel = useMemo(() => {
    if (parts.length === 0) return 75
    const sum = parts.reduce((acc, p) => acc + p.level, 0)
    const avg = (sum / parts.length) * 10
    const base = Math.round(avg * 0.6 + currentEngine.power * 0.4)
    // +2 pts setup bonus if reserve participated in FP
    return team?.reserve_setup_bonus ? Math.min(100, base + 2) : base
  }, [parts, currentEngine, team?.reserve_setup_bonus])

  // Aerodynamics component level
  const aeroPart = parts.find((p) => p.name.includes('Aerodinâmica') || p.name.includes('Asa'))
  const aeroRating = aeroPart
    ? aeroPart.level >= 8
      ? 'Excelente'
      : aeroPart.level >= 5
        ? 'Bom'
        : 'Em desenvolvimento'
    : 'Bom'

  // Run Race Simulation
  const handleStartRace = () => {
    const titulars = drivers.filter((d) => d.role !== 'reserva' && d.team_id === team?.id)
    const reserve = drivers.find(
      (d) => d.role === 'reserva' || (d.reserve_team_id === team?.id && d.team_id !== team?.id),
    )

    if (titulars.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Escalação Incompleta',
        description: 'Você precisa de 2 pilotos titulares contratados para largar no GP.',
      })
      navigate('/team')
      return
    }

    setIsSimulating(true)
    setSimResults(null)
    setCompleted(false)

    // Build dynamic grid (Player 2 drivers + AI rivals)
    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const aiRivals = getAICompetitors(team?.team_key, isCustomTeam)

    const grid: SimDriverEntry[] = []

    // 1. Add Player's 2 drivers: if a starter is incapacitated, reserve steps in!
    const playerTeamStrength = team?.strength ?? (isCustomTeam ? 58 : 75)

    titulars.forEach((d) => {
      const isIncapacitated = !!d.is_incapacitated
      // If incapacitated and reserve exists, reserve drives!
      const activeDriver = isIncapacitated && reserve ? reserve : d
      const isSubstituted = isIncapacitated && !!reserve

      // Driver score calculation
      let driverSkill =
        activeDriver.speed * 0.4 + activeDriver.consistency * 0.35 + activeDriver.defense * 0.25
      if (weather === 'chuva') {
        driverSkill =
          activeDriver.speed * 0.25 + activeDriver.rain * 0.45 + activeDriver.consistency * 0.3
      }

      // If reserve is driving, slight penalty (-2 pts) for lack of race seat practice
      if (isSubstituted) {
        driverSkill = Math.max(50, driverSkill - 2)
      }

      // Total car performance combining car parts level + team strength rating
      const effectiveCarScore = playerCarLevel * 0.7 + playerTeamStrength * 0.3
      // Random race variability (-8 to +8)
      const luck = (Math.random() - 0.5) * 16

      // Reliability check (DNF chance)
      const reliabilityFailure = Math.random() * 100 > currentEngine.reliability + 5

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
        score: driverSkill * 0.4 + effectiveCarScore * 0.5 + luck,
        position: 0,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        dnf: reliabilityFailure,
        dnfReason: reliabilityFailure ? 'Falha no inversor do MGU-K 350kW' : undefined,
        totalTime: '',
      })
    })

    // 2. Add AI Grid Teams (using their strength + carLevel)
    aiRivals.forEach((aiTeam) => {
      const sup = ENGINE_SUPPLIERS.find((s) => s.name === aiTeam.engine) || ENGINE_SUPPLIERS[0]
      const effectiveAiCar = aiTeam.carLevel * 0.6 + aiTeam.strength * 0.4

      // Driver 1
      let d1Skill =
        aiTeam.driver1.speed * 0.4 +
        aiTeam.driver1.consistency * 0.35 +
        aiTeam.driver1.defense * 0.25
      if (weather === 'chuva') {
        d1Skill =
          aiTeam.driver1.speed * 0.25 +
          aiTeam.driver1.rain * 0.45 +
          aiTeam.driver1.consistency * 0.3
      }
      const d1Luck = (Math.random() - 0.5) * 16
      const d1Dnf = Math.random() * 100 > sup.reliability + 6

      grid.push({
        driverId: `${aiTeam.id}_d1`,
        driverName: aiTeam.driver1.name,
        teamId: aiTeam.id,
        teamName: aiTeam.name,
        teamColor: aiTeam.color,
        isPlayer: false,
        flag: aiTeam.driver1.flag,
        score: d1Skill * 0.4 + effectiveAiCar * 0.5 + d1Luck,
        position: 0,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        dnf: d1Dnf,
        dnfReason: d1Dnf ? 'Quebra no sistema elétrico 50/50' : undefined,
        totalTime: '',
      })

      // Driver 2
      let d2Skill =
        aiTeam.driver2.speed * 0.4 +
        aiTeam.driver2.consistency * 0.35 +
        aiTeam.driver2.defense * 0.25
      if (weather === 'chuva') {
        d2Skill =
          aiTeam.driver2.speed * 0.25 +
          aiTeam.driver2.rain * 0.45 +
          aiTeam.driver2.consistency * 0.3
      }
      const d2Luck = (Math.random() - 0.5) * 16
      const d2Dnf = Math.random() * 100 > sup.reliability + 6

      grid.push({
        driverId: `${aiTeam.id}_d2`,
        driverName: aiTeam.driver2.name,
        teamId: aiTeam.id,
        teamName: aiTeam.name,
        teamColor: aiTeam.color,
        isPlayer: false,
        flag: aiTeam.driver2.flag,
        score: d2Skill * 0.4 + effectiveAiCar * 0.5 + d2Luck,
        position: 0,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        dnf: d2Dnf,
        dnfReason: d2Dnf ? 'Problema na bateria 50/50' : undefined,
        totalTime: '',
      })
    })

    // Sort: non-DNF by score descending, then DNFs at the end
    grid.sort((a, b) => {
      if (a.dnf && !b.dnf) return 1
      if (!a.dnf && b.dnf) return -1
      return b.score - a.score
    })

    // Assign positions & points: 25-18-15-12-10-8-6-4-2-1
    const pointsTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
    let baseMinutes = 80
    let baseSeconds = 12

    grid.forEach((entry, idx) => {
      entry.position = idx + 1
      if (!entry.dnf && idx < pointsTable.length) {
        entry.points = pointsTable[idx]
      }

      // Check for Modo Overtake (<1s gap simulated)
      if (idx > 0 && !entry.dnf && Math.random() < 0.65) {
        entry.usedOvertake = true
      }

      // Formatted lap times
      if (entry.dnf) {
        entry.totalTime = 'ABANDONO (DNF)'
      } else if (idx === 0) {
        entry.totalTime = `1h ${baseMinutes}m ${baseSeconds.toFixed(3)}s`
      } else {
        const gap = (idx * 1.8 + Math.random() * 0.7).toFixed(3)
        entry.totalTime = `+${gap}s`
      }
    })

    // Fastest Lap: random among top 10 finishers
    const eligibleTop10 = grid.filter((g) => !g.dnf && g.position <= 10)
    if (eligibleTop10.length > 0) {
      const flIndex = Math.floor(Math.random() * eligibleTop10.length)
      eligibleTop10[flIndex].fastestLap = true
      eligibleTop10[flIndex].points += 1
    }

    // Animation 2.5s steps
    const simulationMessages = [
      'LARGADA! Luzes apagadas em Albert Park! Acoplamento perfeito do trem de força 50/50!',
      'Volta 15: Straight Mode ativado nas retas! Asas dianteiras e traseiras com arrasto reduzido!',
      'Volta 32: Janela de Pit-stops! Bateria 350kW em recarga plena na frenagem!',
      'Volta 45: Modo Overtake acionado a menos de 1s! Bateria descarrega potência máxima!',
      'BANDEIRA QUADRICULADA! Carros cruzando a linha de chegada!',
    ]

    let step = 0
    const interval = setInterval(() => {
      if (step < simulationMessages.length) {
        setSimText(simulationMessages[step])
        setSimLap(Math.round(((step + 1) / simulationMessages.length) * gpInfo.laps))
        step++
      } else {
        clearInterval(interval)
        setIsSimulating(false)
        setSimResults(grid)
        setCompleted(true)
      }
    }, 550)
  }

  // Advance to next round & commit results
  const handleAdvanceRound = async () => {
    if (!simResults || !team || !season) return
    setIsFinishing(true)

    try {
      // 1. Save race results for player drivers
      const playerResults = simResults.filter((r) => r.isPlayer)
      for (const pr of playerResults) {
        await f1Service.createRaceResult({
          season_id: season.id,
          round: currentRound,
          driver_id: pr.driverId,
          team_id: team.id,
          position: pr.position,
          points: pr.points,
          fastest_lap: pr.fastestLap,
        })
      }

      // 2. Process financial income & expenses
      // Sponsors revenue
      let totalSponsorIncome = 0
      for (const sp of sponsors) {
        if (sp.status === 'ativo') {
          // Check requirement evaluation
          let requirementMet = true
          if (sp.requirement.includes('Top 5') && playerResults.some((p) => p.position > 5)) {
            // lenient: constructor check
          }

          if (requirementMet) {
            totalSponsorIncome += sp.value_per_round
            // decrease remaining rounds if set
            if (sp.rounds_remaining && sp.rounds_remaining > 1) {
              await f1Service.updateSponsor(sp.id, {
                rounds_remaining: sp.rounds_remaining - 1,
              })
            } else if (sp.rounds_remaining === 1) {
              await f1Service.updateSponsor(sp.id, {
                rounds_remaining: 0,
                status: 'encerrado',
              })
            }
          }
        }
      }

      // Drivers salary fraction per round (annual / 24)
      const driversCost = drivers.reduce((sum, d) => sum + Math.round(d.salary / 24), 0)
      // Engine fee fraction per round
      const engineCost = Math.round(currentEngine.costAnnual / 24)

      const netCashflow = totalSponsorIncome - driversCost - engineCost
      const updatedBudget = Math.max(0, team.budget + netCashflow)

      // 3. Update drivers: handle incapacitated countdown, reserve FP training, and chance of new injury
      const titulars = drivers.filter((d) => d.role !== 'reserva' && d.team_id === team.id)
      const reserve = drivers.find(
        (d) => d.role === 'reserva' || (d.reserve_team_id === team.id && d.team_id !== team.id),
      )

      let setupBonusForNextRace = false

      // Check if reserve had FP scheduled for this round
      if (reserve && reserve.fp_scheduled_rounds?.includes(currentRound)) {
        const completedFp = (reserve.fp_sessions_completed || 0) + 1
        // Reserve gains XP from FP (+1 to speed, consistency or rain)
        const updatedSpeed = Math.min(92, reserve.speed + 1)
        const updatedConsistency = Math.min(90, reserve.consistency + 1)
        await f1Service.updateDriver(reserve.id, {
          fp_sessions_completed: completedFp,
          speed: updatedSpeed,
          consistency: updatedConsistency,
        })
        setupBonusForNextRace = true
        await f1Service.addEvent(
          team.id,
          `Treino Livre FP1 concluído por ${reserve.name}! Dados coletados garantem bônus de acerto (+2pts) e ganho de experiência (+1 Vel, +1 Cons) para o reserva.`,
          'desenvolvimento',
        )
      }

      // Decrement incapacitation or roll chance for new injury (5% chance per starter)
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
              `Piloto titular ${t.name} foi liberado pelos médicos e retorna ao cockpit no próximo GP!`,
              'resultado',
            )
          } else {
            await f1Service.updateDriver(t.id, {
              incapacitated_rounds_left: roundsLeft,
            })
          }
        } else {
          // 5% chance of getting injured/sick for 1 to 2 races
          const rollInjury = Math.random() < 0.05
          if (rollInjury && reserve) {
            const injuryDuration = Math.random() < 0.6 ? 1 : 2
            const reasons = [
              'Intoxicação alimentar severa',
              'Entorse no pulso durante treino de simulação',
              'Fratura na clavícula em treino de kart',
              'Problema muscular cervical (pescoço)',
            ]
            const reason = reasons[Math.floor(Math.random() * reasons.length)]
            await f1Service.updateDriver(t.id, {
              is_incapacitated: true,
              incapacitated_rounds_left: injuryDuration,
              incapacitated_reason: reason,
            })
            await f1Service.addEvent(
              team.id,
              `ALERTA MÉDICO: ${t.name} sofreu "${reason}" e está incapacitado por ${injuryDuration} corrida(s). O reserva ${reserve.name} assumirá o carro!`,
              'resultado',
            )
          }
        }
      }

      await f1Service.updateTeam(team.id, {
        budget: updatedBudget,
        reserve_setup_bonus: setupBonusForNextRace,
      })

      // 4. Register Event
      const playerWinner = playerResults.find((p) => p.position === 1)
      const bestPos = Math.min(...playerResults.map((p) => p.position))
      const eventMsg = playerWinner
        ? `VITÓRIA ESPETACULAR! ${playerWinner.driverName} vence o ${gpInfo.name}!`
        : `Rodada ${currentRound} (${gpInfo.name}) concluída. Melhor posição da equipe: P${bestPos}. Fluxo de caixa: ${formatCurrency(netCashflow)}.`

      await f1Service.addEvent(team.id, eventMsg, 'resultado')

      // 5. Increment season round
      const nextRound = currentRound + 1
      await f1Service.updateSeason(season.id, {
        current_round: nextRound,
      })

      toast({
        title: `Rodada ${currentRound} Concluída!`,
        description: `Resultados registrados no campeonato. Receita de patrocínios e custos de equipe processados.`,
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
        title: 'Erro ao registrar resultados',
        description: err?.message || 'Falha ao salvar a corrida.',
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
            Simulação de Pista & Telemetria Oficial
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FA] mt-1">
            {gpInfo.name} • Rodada {currentRound}/{totalRounds}
          </h1>
          <p className="text-sm font-mono text-[#00A6FB] mt-0.5">
            {gpInfo.circuit} • {gpInfo.country} {gpInfo.flag}
          </p>
        </div>

        {/* Action Button */}
        {!completed && !isSimulating && (
          <Button
            size="lg"
            onClick={handleStartRace}
            disabled={drivers.length < 2 || isSimulating}
            className="bg-gradient-to-r from-[#E10600] to-[#FF6B35] hover:from-[#FF2E25] hover:to-[#FF7B48] text-white font-extrabold px-8 shadow-xl shadow-[#E10600]/30 transition-all hover:scale-105"
          >
            <Play className="w-5 h-5 mr-2 fill-current" />
            Iniciar Corrida
          </Button>
        )}
      </div>

      {/* Season Completed Card if R24 finished */}
      {seasonCompleted && (
        <Card className="bg-gradient-to-r from-[#11161F] via-[#1E2738] to-[#11161F] border-2 border-amber-500/60 p-6 shadow-2xl">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
              <Trophy className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7FA]">
                Temporada 2026 Encerrada!
              </h2>
              <p className="text-sm text-[#8B95A7] max-w-lg mx-auto mt-1">
                Parabéns, Chefe de Equipe! As 24 rodadas do primeiro campeonato sob o novo
                regulamento híbrido 50/50 foram finalizadas com sucesso.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Button asChild className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                <a href="/standings">Ver Tabela Final de Campeões</a>
              </Button>
              <Button asChild variant="outline" className="border-[#1F2733] text-[#F5F7FA]">
                <a href="/">Ir ao Painel Principal</a>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Before Race State (Conditions & Tech Overview) */}
      {!completed && !isSimulating && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Weather & Circuit details */}
          <Card className="bg-[#11161F] border-[#1F2733]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
                {weather === 'chuva' ? (
                  <CloudRain className="w-5 h-5 text-sky-400" />
                ) : (
                  <Sun className="w-5 h-5 text-amber-400" />
                )}
                Condições Meteorológicas
              </CardTitle>
              <CardDescription className="text-xs text-[#8B95A7]">
                Sensoriamento de pista em tempo real
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1F2733] flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#8B95A7] uppercase font-mono block">
                    Clima Previsto
                  </span>
                  <strong className="text-lg font-bold text-[#F5F7FA] capitalize">
                    {weather === 'chuva' ? 'Pista Molhada (Chuva)' : 'Pista Seca (Céu Limpo)'}
                  </strong>
                </div>
                <Badge
                  variant="outline"
                  className={`font-mono text-xs ${
                    weather === 'chuva'
                      ? 'border-sky-400 text-sky-400 bg-sky-400/10'
                      : 'border-amber-400 text-amber-400 bg-amber-400/10'
                  }`}
                >
                  {weather === 'chuva' ? 'Pneus Intermediários' : 'Pneus Slick C3/C4'}
                </Badge>
              </div>

              <div className="space-y-2 text-xs font-mono text-[#8B95A7]">
                <div className="flex justify-between">
                  <span>Extensão do Circuito:</span>
                  <strong className="text-[#F5F7FA]">{gpInfo.circuitLengthKm} km</strong>
                </div>
                <div className="flex justify-between">
                  <span>Distância da Corrida:</span>
                  <strong className="text-[#F5F7FA]">{gpInfo.laps} voltas</strong>
                </div>
                <div className="flex justify-between">
                  <span>Característica Principal:</span>
                  <strong className="text-[#00A6FB]">{gpInfo.characteristic}</strong>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Player Drivers Ready */}
          <Card className="bg-[#11161F] border-[#1F2733] md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
                <Flag className="w-5 h-5 text-[#E10600]" />
                Escalação da {team?.name || 'Sua Escuderia'}
              </CardTitle>
              <CardDescription className="text-xs text-[#8B95A7]">
                Atributos calibrados para as características do {gpInfo.circuit}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full bg-[#1F2733]" />
                  <Skeleton className="h-16 w-full bg-[#1F2733]" />
                </div>
              ) : drivers.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-[#1F2733] rounded-lg text-xs text-[#8B95A7]">
                  Nenhum piloto escalado. Acesse a aba Equipe para contratar.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {drivers.map((d, idx) => (
                    <div
                      key={d.id}
                      className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-[#F5F7FA]">
                          #{idx + 1} {d.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-[#1F2733] text-[#8B95A7]"
                        >
                          {d.nationality}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-4 gap-1 text-[11px] font-mono text-center">
                        <div className="bg-[#11161F] p-1.5 rounded">
                          <span className="text-[#8B95A7] block text-[9px]">VEL</span>
                          <strong className="text-[#E10600]">{d.speed}</strong>
                        </div>
                        <div className="bg-[#11161F] p-1.5 rounded">
                          <span className="text-[#8B95A7] block text-[9px]">CONS</span>
                          <strong className="text-[#00A6FB]">{d.consistency}</strong>
                        </div>
                        <div className="bg-[#11161F] p-1.5 rounded">
                          <span className="text-[#8B95A7] block text-[9px]">CHUVA</span>
                          <strong className="text-sky-400">{d.rain}</strong>
                        </div>
                        <div className="bg-[#11161F] p-1.5 rounded">
                          <span className="text-[#8B95A7] block text-[9px]">DEF</span>
                          <strong className="text-amber-400">{d.defense}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Setup Bonus Banner if reserve practiced */}
              {team?.reserve_setup_bonus && (
                <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Bônus de Setup Ativo (+2pts Carro):</strong> Telemetria coletada pelo
                    piloto reserva no último treino livre aplicada com sucesso!
                  </span>
                </div>
              )}

              {/* Tech 2026 Reminder */}
              <div className="mt-4 p-3 rounded-lg bg-[#161D29]/60 border border-[#1F2733] text-xs font-mono text-[#8B95A7] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>
                  Motor: <strong className="text-[#00A6FB]">{currentEngine.name}</strong> (350kW
                  Elétrico + V6 Sustentável)
                </span>
                <span>
                  Nível do Carro: <strong className="text-[#F5F7FA]">{playerCarLevel}/100</strong>
                </span>
                <span>
                  Força da Equipe:{' '}
                  <strong className="text-amber-400">{team?.strength ?? 58}/100</strong>
                </span>
                <span>
                  Aerodinâmica: <strong className="text-emerald-400">{aeroRating}</strong>
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Simulation In Progress Animation (2-4 seconds) */}
      {isSimulating && (
        <Card className="bg-[#11161F] border border-[#E10600]/60 p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-red-600/5 via-transparent to-red-600/5 animate-pulse" />
          <div className="relative text-center space-y-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#E10600]/20 text-[#E10600] border border-[#E10600]/40 animate-spin">
              <Gauge className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#F5F7FA] tracking-tight">
                Simulando Volta {simLap} de {gpInfo.laps}...
              </h2>
              <p className="text-sm font-mono text-[#00A6FB] mt-2 animate-telemetry max-w-xl mx-auto">
                {simText}
              </p>
            </div>

            {/* Dynamic Progress Indicator */}
            <div className="max-w-md mx-auto space-y-2">
              <div className="h-2.5 w-full bg-[#0B0E14] rounded-full overflow-hidden border border-[#1F2733]">
                <div
                  className="h-full bg-gradient-to-r from-[#E10600] to-[#FF6B35] transition-all duration-300"
                  style={{ width: `${(simLap / gpInfo.laps) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-[#8B95A7]">
                <span>Grid Formado</span>
                <span>Regulamento F1 2026 Ativo</span>
                <span>Linha de Chegada</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Race Results Table & 2026 Performance Summary */}
      {completed && simResults && (
        <div className="space-y-6">
          {/* Summary Bars of 2026 Rules Performance */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#11161F] border border-[#1F2733] space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#8B95A7] flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-[#00A6FB]" /> Aerodinâmica Ativa:
                </span>
                <strong className="text-emerald-400">{aeroRating}</strong>
              </div>
              <div className="h-1.5 w-full bg-[#0B0E14] rounded-full overflow-hidden">
                <div className="h-full bg-[#00A6FB]" style={{ width: '85%' }} />
              </div>
              <p className="text-[10px] text-[#8B95A7]">Transição ágil Straight / Corner Mode</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#11161F] border border-[#1F2733] space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#8B95A7] flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-[#E10600]" /> Unidade 50/50:
                </span>
                <strong className="text-[#F5F7FA]">{currentEngine.power} Potência</strong>
              </div>
              <div className="h-1.5 w-full bg-[#0B0E14] rounded-full overflow-hidden">
                <div className="h-full bg-[#E10600]" style={{ width: `${currentEngine.power}%` }} />
              </div>
              <p className="text-[10px] text-[#8B95A7]">Recuperação de 350kW no eixo traseiro</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#11161F] border border-[#1F2733] space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#8B95A7] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Modo Overtake:
                </span>
                <strong className="text-amber-400">Ativado &lt;1s</strong>
              </div>
              <div className="h-1.5 w-full bg-[#0B0E14] rounded-full overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: '90%' }} />
              </div>
              <p className="text-[10px] text-[#8B95A7]">Energia extra liberada em retas</p>
            </div>
          </div>

          {/* Results Table */}
          <Card className="bg-[#11161F] border-[#1F2733]">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  Classificação Oficial da Corrida — {gpInfo.name}
                </CardTitle>
                <CardDescription className="text-xs text-[#8B95A7]">
                  Pontuação oficial FIA: 25-18-15-12-10-8-6-4-2-1 + 1 pt volta mais rápida
                </CardDescription>
              </div>

              {/* Botão Avançar para a próxima rodada */}
              <Button
                size="sm"
                onClick={handleAdvanceRound}
                disabled={isFinishing}
                className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold px-5 shadow-lg"
              >
                {isFinishing ? 'Salvando dados...' : 'Avançar para Próxima Rodada'}
                <ArrowRight className="w-4 h-4 ml-1" />
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
                      <th className="py-2.5 px-2 text-center" title="Modo Overtake acionado a <1s">
                        Overtake
                      </th>
                      <th className="py-2.5 px-3">Tempo / Gap</th>
                      <th className="py-2.5 px-3 text-right">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2733]/60">
                    {simResults.map((row) => (
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
                          <span className="text-xs" style={{ color: row.teamColor }}>
                            {row.teamName}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          {row.usedOvertake && !row.dnf ? (
                            <span
                              className="font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded text-[11px]"
                              title="Modo Overtake acionado"
                            >
                              X
                            </span>
                          ) : (
                            <span className="text-[#8B95A7]/40">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#8B95A7]">{row.totalTime}</td>
                        <td className="py-3 px-3 text-right">
                          {row.points > 0 ? (
                            <strong className="text-emerald-400 font-bold text-sm">
                              +{row.points}
                            </strong>
                          ) : (
                            <span className="text-[#8B95A7] font-normal">0</span>
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
    </div>
  )
}
