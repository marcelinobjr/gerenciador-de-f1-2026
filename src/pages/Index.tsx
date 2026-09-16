import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { standingsService } from '@/services/standingsService'
import { regulationTimelineService } from '@/services/regulationService'
import type { TechnicalRegulation } from '@/types/canonical-regulations'
import pb from '@/lib/pocketbase/client'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { getCountryFlag } from '@/lib/country-flags'
import { formatCurrency } from '@/lib/formatters'
import { CARRO_POR_EQUIPE_MAP, IMAGEM_CARRO_PADRAO_FALLBACK } from '@/assets/carroPorEquipe'
import { CAR_MODEL_ASSETS } from '@/lib/lobby-assets'
import { TRACK_LAYOUTS } from '@/components/CircuitBlueprint'
import { CircuitTrackImage } from '@/components/CircuitTrackImage'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  Clock,
  Flag,
  Trophy,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Mail,
  Newspaper,
  CheckSquare,
  Shield,
  ShieldAlert,
  Gauge,
  Zap,
  Play,
  UserCheck,
  Loader2,
  ChevronDown,
} from 'lucide-react'
import defaultAustraliaMap from '@/assets/01-australia-aeace.jpg'

// Custos de aprimoramento de peças (compatível com Car.tsx)
const UPGRADE_COSTS: Record<number, number> = {
  1: 1500000,
  2: 2500000,
  3: 4000000,
  4: 6000000,
  5: 8500000,
  6: 11500000,
  7: 15000000,
  8: 19000000,
  9: 24000000,
  10: 30000000,
}
const getUpgradeCost = (currentLevel: number): number => {
  return UPGRADE_COSTS[currentLevel] || (currentLevel + 1) * 3000000
}
const COST_CAP_LIMIT = 215000000

export default function IndexPage() {
  const { user, team, season, refreshTeamAndSeason } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  // Estados locais
  const [loading, setLoading] = useState(true)
  const [drivers, setDrivers] = useState<any[]>([])
  const [parts, setParts] = useState<any[]>([])
  const [circuits, setCircuits] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [activeInboxTab, setActiveInboxTab] = useState<
    'todas' | 'diretoria' | 'equipe' | 'pilotos' | 'patrocinadores'
  >('todas')
  const [standingsTab, setStandingsTab] = useState<'construtores' | 'pilotos'>('construtores')
  const [driverPointsMap, setDriverPointsMap] = useState<Record<string, number>>({})
  const [constructorPoints, setConstructorPoints] = useState(0)
  const [constructorPosition, setConstructorPosition] = useState(1)
  const [totalGridTeams, setTotalGridTeams] = useState(11)
  const [allConstructorStandings, setAllConstructorStandings] = useState<any[]>([])
  const [allDriverStandings, setAllDriverStandings] = useState<any[]>([])
  const [upcomingAnnouncedRegulation, setUpcomingAnnouncedRegulation] =
    useState<TechnicalRegulation | null>(null)

  // Ações de desenvolvimento pendentes e adiadas
  const [deferredDecisions, setDeferredDecisions] = useState<Record<string, boolean>>({})
  const [cancelledDecisions, setCancelledDecisions] = useState<Record<string, boolean>>({})
  const [isProcessingDecision, setIsProcessingDecision] = useState(false)

  // Checklist de próximas ações completadas
  const [checkedActions, setCheckedActions] = useState<Record<string, boolean>>({})

  // Modal de edição do Hero
  const [heroModalOpen, setHeroModalOpen] = useState(false)
  const [editHeroTitle, setEditHeroTitle] = useState('')
  const [editHeroTagline, setEditHeroTagline] = useState('')
  const [editHeroCarModel, setEditHeroCarModel] = useState('')
  const [isSavingHero, setIsSavingHero] = useState(false)

  // Avanço de tempo
  const [isAdvancingTime, setIsAdvancingTime] = useState(false)

  // Carregar dados principais
  useEffect(() => {
    let mounted = true

    const loadDashboardData = async () => {
      if (!team?.id || !season?.id) {
        setLoading(false)
        return
      }

      try {
        const [drvList, partList, circList, notifList, evList, raceResults] = await Promise.all([
          f1Service.getTeamDrivers(team.id).catch(() => []),
          f1Service.getTeamParts(team.id).catch(() => []),
          f1Service.getAllCircuits().catch(() => []),
          user?.id ? f1Service.getNotifications(user.id).catch(() => []) : Promise.resolve([]),
          f1Service.getTeamEvents(team.id).catch(() => []),
          f1Service.getSeasonRaceResults(season.id).catch(() => []),
        ])

        if (!mounted) return

        setDrivers(drvList)
        setParts(partList)
        setCircuits(circList)
        setNotifications(notifList)
        setEvents(evList)

        // Calcular standings unificadas
        const standingsResult = standingsService.calculateStandings({
          raceResults,
          playerDrivers: drvList,
          team,
          season,
        })

        if (standingsResult) {
          setDriverPointsMap(standingsResult.driverPointsMap || {})
          setConstructorPoints(standingsResult.teamPoints || 0)
          setConstructorPosition(standingsResult.playerConstructorRank || 1)
          setTotalGridTeams(standingsResult.constructorStandings?.length || 11)
          setAllConstructorStandings(standingsResult.constructorStandings || [])
          setAllDriverStandings(standingsResult.driverStandings || [])
        }

        if (team?.id) {
          try {
            const tState = await regulationTimelineService.getTimeline(
              team.id,
              season?.year || 2026,
            )
            const futureRegs = regulationTimelineService.getFutureRegulations(
              tState,
              season?.year || 2026,
            )
            if (futureRegs.length > 0) {
              setUpcomingAnnouncedRegulation(futureRegs[0])
            }
          } catch {
            // tolerância
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadDashboardData()
    return () => {
      mounted = false
    }
  }, [team?.id, season?.id, user?.id])

  // Informações da Temporada e GP Atual
  const currentRound = season?.current_round || 1
  const totalRounds = season?.total_rounds || 24
  const seasonYear = season?.year || 2026

  const currentGP = useMemo(() => {
    return F1_2026_CALENDAR.find((gp) => gp.round === currentRound) || F1_2026_CALENDAR[0]
  }, [currentRound])

  // Circuito visual do PocketBase ou default
  const circuitPhotoUrl = useMemo(() => {
    const dbCircuit = circuits.find((c) => c.round === currentRound)
    if (dbCircuit?.photo) {
      return pb.files.getUrl(dbCircuit, dbCircuit.photo)
    }
    if (currentRound === 1) {
      return defaultAustraliaMap
    }
    return null
  }, [circuits, currentRound])

  const trackLayout = TRACK_LAYOUTS[currentRound] || TRACK_LAYOUTS[1]

  // Contagem regressiva ao vivo para a próxima corrida
  const targetDate = useMemo(() => {
    const base = new Date(seasonYear, 2, 15 + (currentRound - 1) * 14, 14, 0, 0)
    return base.getTime()
  }, [seasonYear, currentRound])

  const [countdown, setCountdown] = useState({ days: 5, hours: 12, mins: 34, secs: 21 })
  useEffect(() => {
    const update = () => {
      const now = Date.now()
      const diff = Math.max(0, targetDate - now)
      const totalSecs = Math.floor(diff / 1000)
      const days = Math.floor(totalSecs / 86400) % 14
      const hours = Math.floor((totalSecs % 86400) / 3600)
      const mins = Math.floor((totalSecs % 3600) / 60)
      const secs = totalSecs % 60
      setCountdown({ days, hours, mins, secs })
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  // Imagem do carro do Hero
  const heroCarImage = useMemo(() => {
    if (team?.hero_car_model) {
      const modelId = (team.hero_car_model || '').toLowerCase()
      const localCustom = `/carros/${modelId}.png`
      const modelMatch = CAR_MODEL_ASSETS.find(
        (m) => (m.id || '').toLowerCase() === modelId || m.id === team.hero_car_model,
      )
      if (modelMatch) return localCustom || modelMatch.dropboxUrl
      return `/carros/${team.hero_car_model}.png`
    }

    const normalizedTeamKey = (team?.team_key || '').toLowerCase().replace(/[^a-z0-9]/g, '')

    if (
      team?.team_key &&
      CARRO_POR_EQUIPE_MAP[team.team_key as keyof typeof CARRO_POR_EQUIPE_MAP]
    ) {
      return CARRO_POR_EQUIPE_MAP[team.team_key as keyof typeof CARRO_POR_EQUIPE_MAP]
    }
    if (
      normalizedTeamKey &&
      CARRO_POR_EQUIPE_MAP[normalizedTeamKey as keyof typeof CARRO_POR_EQUIPE_MAP]
    ) {
      return CARRO_POR_EQUIPE_MAP[normalizedTeamKey as keyof typeof CARRO_POR_EQUIPE_MAP]
    }

    if (team?.carImage) {
      return pb.files.getUrl(team, team.carImage)
    }

    if (normalizedTeamKey) {
      return `/equipes/${normalizedTeamKey}.png`
    }

    return IMAGEM_CARRO_PADRAO_FALLBACK
  }, [team])

  const [heroCarImgFailed, setHeroCarImgFailed] = useState(false)
  useEffect(() => {
    setHeroCarImgFailed(false)
  }, [heroCarImage])

  // Textos do Hero
  const heroTitle = team?.hero_title || team?.name || 'MAIS QUE RESULTADOS UM LEGADO'
  const heroTagline =
    team?.hero_tagline || 'Tecnologia. Pessoas. Performance. Um futuro mais rápido.'

  const handleOpenHeroModal = () => {
    setEditHeroTitle(team?.hero_title || heroTitle)
    setEditHeroTagline(team?.hero_tagline || heroTagline)
    setEditHeroCarModel(team?.hero_car_model || 'carro1')
    setHeroModalOpen(true)
  }

  const handleSaveHeroPreferences = async () => {
    if (!team?.id) return
    setIsSavingHero(true)
    try {
      await f1Service.updateHeroPreferences(team.id, {
        hero_title: editHeroTitle.trim() || undefined,
        hero_tagline: editHeroTagline.trim() || undefined,
        hero_car_model: editHeroCarModel || undefined,
      })
      toast({
        title: 'Identidade Atualizada!',
        description: 'As preferências visuais da sua escuderia foram salvas.',
      })
      setHeroModalOpen(false)
      await refreshTeamAndSeason()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: err?.message || 'Falha ao atualizar preferências.',
      })
    } finally {
      setIsSavingHero(false)
    }
  }

  // Pilotos Titulares
  const titularDrivers = useMemo(() => {
    return drivers.filter((d) => d.role === 'titular').slice(0, 2)
  }, [drivers])

  // Projetos de P&D em andamento (4 peças compactas)
  const rdProjects = useMemo(() => {
    if (!parts.length) return []
    return parts.slice(0, 4).map((p, idx) => {
      const progress = Math.min(100, Math.max(25, p.level * 10 + (p.condition % 20)))
      const daysLeft = Math.max(2, 28 - Math.round((progress / 100) * 24))
      return {
        id: p.id,
        name: p.name,
        level: p.level,
        condition: p.condition,
        progress,
        daysLeft,
        part: p,
      }
    })
  }, [parts])

  // Decisão em aberto mais urgente (peça pronta para fabricação ou upgrade crítico)
  const pendingDecision = useMemo(() => {
    if (!parts.length) return null
    const candidate = parts.find(
      (p) => !deferredDecisions[p.id] && !cancelledDecisions[p.id] && p.level < 10,
    )
    if (!candidate) return null

    const upgradeCost = getUpgradeCost(candidate.level)
    const nextLevel = candidate.level + 1

    return {
      part: candidate,
      title: `${candidate.name} (Spec ${nextLevel}.0)`,
      description:
        'A nova especificação está pronta para produção, mas exige horas extras na fábrica e pode impactar o orçamento.',
      cost: upgradeCost,
      impact: `+0,15s/volta`,
      risk: 'Médio',
      deadline: '2 dias restantes',
    }
  }, [parts, deferredDecisions, cancelledDecisions])

  const handleApproveDecision = async () => {
    if (!pendingDecision || !team) return
    const { part, cost } = pendingDecision

    if (team.budget < cost) {
      toast({
        variant: 'destructive',
        title: 'Orçamento Insuficiente',
        description: `Saldo atual de ${formatCurrency(team.budget)} não cobre o custo de ${formatCurrency(cost)}.`,
      })
      return
    }

    setIsProcessingDecision(true)
    try {
      const newLevel = part.level + 1
      const newBudget = team.budget - cost
      const newCostCap = (team.cost_cap_spent || 0) + cost

      await Promise.all([
        f1Service.updatePart(part.id, { level: newLevel }),
        f1Service.updateTeam(team.id, { budget: newBudget, cost_cap_spent: newCostCap }),
        f1Service.addEvent(
          team.id,
          `Decisão aprovada: ${part.name} evoluiu para Spec ${newLevel}.0 por ${formatCurrency(cost)}.`,
          'desenvolvimento',
        ),
      ])

      toast({
        title: 'Decisão Aprovada & Peça em Produção!',
        description: `${part.name} evoluiu para o Nível ${newLevel}/10 com sucesso.`,
      })

      await refreshTeamAndSeason()
      const updatedParts = await f1Service.getTeamParts(team.id)
      setParts(updatedParts)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao aprovar decisão',
        description: err?.message || 'Tente novamente.',
      })
    } finally {
      setIsProcessingDecision(false)
    }
  }

  const handleDeferDecision = () => {
    if (!pendingDecision) return
    setDeferredDecisions((prev) => ({ ...prev, [pendingDecision.part.id]: true }))
    toast({
      title: 'Decisão Adiada',
      description: `A produção de ${pendingDecision.part.name} foi postergada para o próximo GP.`,
    })
  }

  const handleCancelDecision = () => {
    if (!pendingDecision) return
    setCancelledDecisions((prev) => ({ ...prev, [pendingDecision.part.id]: true }))
    toast({
      title: 'Projeto Cancelado',
      description: `A decisão sobre ${pendingDecision.part.name} foi encerrada.`,
    })
  }

  // Radar Chart: Atributos do Carro do Jogador vs Média do Grid (SVG 6 eixos exatamente como no mockup)
  const radarAttributes = useMemo(() => {
    const aero = team?.aero_level || 62
    const chassis = team?.chassis_level || 58
    const engine = Math.max(30, 100 - (team?.active_engine_wear || 35))
    const strategy = team?.strategy_level || 64
    const overall = team?.strength || 58
    const tire = 60

    return [
      { label: 'Aerodinâmica', player: aero, grid: 65 },
      { label: 'Vel. Máxima', player: engine, grid: 68 },
      { label: 'Tração', player: chassis, grid: 62 },
      { label: 'Desgaste de Pneus', player: tire, grid: 60 },
      { label: 'Equilíbrio', player: overall, grid: 64 },
      { label: 'Confiabilidade', player: strategy, grid: 66 },
    ]
  }, [team])

  const radarSvgData = useMemo(() => {
    const size = 180
    const center = size / 2
    const radius = 55
    const total = radarAttributes.length
    const angleStep = (Math.PI * 2) / total

    const playerPoints = radarAttributes.map((attr, i) => {
      const angle = i * angleStep - Math.PI / 2
      const val = Math.max(15, Math.min(100, attr.player)) / 100
      const r = val * radius
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`
    })

    const gridPoints = radarAttributes.map((attr, i) => {
      const angle = i * angleStep - Math.PI / 2
      const val = Math.max(15, Math.min(100, attr.grid)) / 100
      const r = val * radius
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`
    })

    const labels = radarAttributes.map((attr, i) => {
      const angle = i * angleStep - Math.PI / 2
      const r = radius + 18
      return {
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
        label: attr.label,
      }
    })

    return {
      size,
      center,
      radius,
      playerPolygon: playerPoints.join(' '),
      gridPolygon: gridPoints.join(' '),
      labels,
    }
  }, [radarAttributes])

  // Top 5 Classificação de Construtores / Pilotos para o card do mockup
  const topConstructors = useMemo(() => {
    if (allConstructorStandings.length > 0) {
      return allConstructorStandings.slice(0, 5)
    }
    return [
      { position: 1, teamName: 'McLaren', points: 87, logo: '🟠' },
      { position: 2, teamName: 'Red Bull', points: 71, logo: '🐂' },
      { position: 3, teamName: team?.name || 'Audi', points: 65, logo: '🔴' },
      { position: 4, teamName: 'Ferrari', points: 61, logo: '🐎' },
      { position: 5, teamName: 'Mercedes', points: 58, logo: '⭐' },
    ]
  }, [allConstructorStandings, team?.name])

  const topDrivers = useMemo(() => {
    if (allDriverStandings.length > 0) {
      return allDriverStandings.slice(0, 5)
    }
    return [
      { position: 1, driverName: 'Max Verstappen', points: 51 },
      { position: 2, driverName: 'Lando Norris', points: 48 },
      { position: 3, driverName: 'Charles Leclerc', points: 39 },
      { position: 4, driverName: titularDrivers[0]?.name || 'Daniel Ricciardo', points: 35 },
      { position: 5, driverName: 'Oscar Piastri', points: 33 },
    ]
  }, [allDriverStandings, titularDrivers])

  // Filtragem da Caixa de Entrada
  const filteredNotifications = useMemo(() => {
    if (activeInboxTab === 'todas') return notifications.slice(0, 4)
    return notifications
      .filter((n) => {
        const type = (n.type || '').toLowerCase()
        if (activeInboxTab === 'pilotos') return type === 'piloto' || type === 'contrato'
        if (activeInboxTab === 'equipe') return type === 'equipe' || type === 'peca'
        if (activeInboxTab === 'diretoria') return type === 'diretoria' || type === 'sistema'
        if (activeInboxTab === 'patrocinadores') return type === 'patrocinio' || type === 'financas'
        return true
      })
      .slice(0, 4)
  }, [notifications, activeInboxTab])

  // Notícias do Paddock (feed de eventos reais)
  const paddockNews = useMemo(() => {
    if (!events.length) {
      return [
        {
          id: 'mock-1',
          title: `${team?.name || 'Audi'} traz atualização importante para Suzuka`,
          category: 'DESENVOLVIMENTO',
          timeAgo: 'Há 2 horas',
        },
        {
          id: 'mock-2',
          title: `${titularDrivers[1]?.name || 'Gabriel Bortoleto'} ganha destaque na imprensa internacional`,
          category: 'PILOTOS',
          timeAgo: 'Há 4 horas',
        },
        {
          id: 'mock-3',
          title: 'Nova diretiva técnica da FIA para motores de 2026',
          category: 'FIA',
          timeAgo: 'Há 7 horas',
        },
        {
          id: 'mock-4',
          title: 'McLaren segue favorita na abertura das sessões no Japão',
          category: 'PADDOCK',
          timeAgo: 'Há 9 horas',
        },
      ]
    }
    return events.slice(0, 4).map((ev) => {
      const createdTime = new Date(ev?.created || Date.now()).getTime()
      const diffHours = Math.max(1, Math.floor((Date.now() - createdTime) / 3600000))
      const timeAgo =
        diffHours < 24 ? `Há ${diffHours} horas` : `Há ${Math.floor(diffHours / 24)} dias`

      return {
        id: ev?.id,
        title: ev?.message || 'Atualização oficial do paddock',
        category: (ev?.type || '').toUpperCase() || 'PADDOCK',
        timeAgo,
      }
    })
  }, [events, team?.name, titularDrivers])

  // Checklist de Próximas Ações
  const pendingActionsList = useMemo(() => {
    const gpName = currentGP?.name || ''
    return [
      {
        id: 'action-setup',
        title: `Revisar estratégia para o GP do ${gpName.replace('GP do ', '').replace('GP da ', '')}`,
        deadline: 'Hoje',
      },
      {
        id: 'action-pu',
        title: 'Confirmar especificação do assoalho',
        deadline: '1 dia',
      },
      {
        id: 'action-sponsors',
        title: 'Avaliar propostas de patrocínio',
        deadline: '2 dias',
      },
      {
        id: 'action-briefing',
        title: 'Reunião com pilotos titulares',
        deadline: '2 dias',
      },
      {
        id: 'action-finance',
        title: 'Ver relatório financeiro mensal',
        deadline: '3 dias',
      },
    ]
  }, [currentGP?.name])

  const handleToggleAction = (id: string) => {
    setCheckedActions((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Avançar Tempo → (Direciona para o fim de semana da rodada ou avança rodada)
  const handleAdvanceTime = async () => {
    setIsAdvancingTime(true)
    try {
      toast({
        title: 'Preparando Garagem para o GP!',
        description: `Equipe mobilizada para a Rodada ${currentRound} em ${currentGP.circuit}.`,
      })
      navigate('/race')
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao avançar tempo',
        description: err?.message || 'Tente novamente.',
      })
    } finally {
      setIsAdvancingTime(false)
    }
  }

  return (
    <div className="space-y-3 pb-6 select-none text-[#F5F7FA] text-xs">
      {/* ========================================================================= */}
      {/* LINHA 1: HERO DA EQUIPE + PRÓXIMO GRANDE PRÊMIO (ESTILO MOCKUP DENSO)     */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* HERO COMPACTO (Col 8) */}
        <div className="lg:col-span-8 relative rounded-xl bg-gradient-to-r from-[#0E121A] via-[#121824] to-[#0A0D14] border border-[#1C2535] p-3.5 sm:p-4 shadow-xl flex items-center justify-between overflow-hidden min-h-[140px] sm:min-h-[160px]">
          <div className="absolute top-0 right-0 w-80 h-full bg-[#E10600]/10 rounded-full blur-[80px] pointer-events-none" />

          {/* Textos do Hero */}
          <div className="relative z-10 max-w-sm sm:max-w-md space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] animate-pulse" />
              <span className="text-[10px] font-mono font-bold tracking-wider text-[#8B95A7] uppercase">
                {team?.name || 'AUDI F1 TEAM'} • 2026
              </span>
              <button
                type="button"
                onClick={handleOpenHeroModal}
                className="p-1 rounded bg-[#161D29]/60 hover:bg-[#20293A] text-[#8B95A7] hover:text-white transition-all cursor-pointer"
                title="Editar Hero"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase leading-tight font-mono">
              {heroTitle}
            </h1>

            <p className="text-[11px] text-[#94A3B8] leading-snug font-medium line-clamp-2">
              {heroTagline}
            </p>
          </div>

          {/* Monoposto 3D / Imagem Lateral Compacta */}
          <div className="relative z-10 w-44 sm:w-64 md:w-80 h-28 sm:h-32 flex items-center justify-end shrink-0 pointer-events-none">
            {!heroCarImgFailed ? (
              <img
                src={heroCarImage}
                alt={`${team?.name || 'F1 Car'} 2026`}
                className="max-w-full max-h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)] hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  const currentImg = e.currentTarget as HTMLImageElement
                  if (
                    currentImg.src !== IMAGEM_CARRO_PADRAO_FALLBACK &&
                    !currentImg.src.includes('carro-lateral')
                  ) {
                    currentImg.src = IMAGEM_CARRO_PADRAO_FALLBACK
                  } else {
                    setHeroCarImgFailed(true)
                  }
                }}
              />
            ) : (
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center font-mono font-black text-xl shadow-xl border border-white/20"
                style={{ backgroundColor: team?.color || '#E10600', color: '#FFFFFF' }}
              >
                {(team?.name || 'F1')
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* PRÓXIMO GRANDE PRÊMIO (Col 4) */}
        <div className="lg:col-span-4 rounded-xl bg-[#0F141C] border border-[#1C2330] p-3 sm:p-3.5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-[#1C2330]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-black tracking-widest text-[#E10600] uppercase">
                  PRÓXIMO GRANDE PRÊMIO
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#8B95A7]">
                RODADA {currentRound} / {totalRounds}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl shrink-0">{currentGP?.flag || '🏁'}</span>
                  <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight truncate">
                    {(currentGP?.name || 'GP')
                      .replace('Grande Prêmio', 'GP')
                      .replace('GP do ', '')
                      .replace('GP da ', '')}
                  </h3>
                </div>
                <p className="text-[11px] font-mono text-[#8B95A7] truncate">
                  {currentGP?.circuit || ''}
                </p>
              </div>

              {/* Traçado vetorial em miniatura */}
              <div className="w-20 h-14 rounded bg-[#0A0D12] border border-[#1A222F] p-1 flex items-center justify-center shrink-0">
                {circuitPhotoUrl ? (
                  <CircuitTrackImage
                    src={circuitPhotoUrl}
                    alt={currentGP.circuit}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <svg viewBox={trackLayout.viewBox} className="w-full h-full">
                    <path
                      d={trackLayout.svgPath}
                      fill="none"
                      stroke="#475569"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                    <path
                      d={trackLayout.svgPath}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </div>
            </div>

            {/* Countdown de 4 blocos */}
            <div className="grid grid-cols-4 gap-1.5 mt-2.5 font-mono text-center">
              <div className="p-1 rounded bg-[#0A0D12] border border-[#1A222F]">
                <strong className="text-sm font-black text-white block">{countdown.days}</strong>
                <span className="text-[8px] text-[#64748B] uppercase block">DIAS</span>
              </div>
              <div className="p-1 rounded bg-[#0A0D12] border border-[#1A222F]">
                <strong className="text-sm font-black text-white block">{countdown.hours}</strong>
                <span className="text-[8px] text-[#64748B] uppercase block">HORAS</span>
              </div>
              <div className="p-1 rounded bg-[#0A0D12] border border-[#1A222F]">
                <strong className="text-sm font-black text-white block">{countdown.mins}</strong>
                <span className="text-[8px] text-[#64748B] uppercase block">MIN</span>
              </div>
              <div className="p-1 rounded bg-[#0A0D12] border border-[#1A222F]">
                <strong className="text-sm font-black text-[#E10600] block">
                  {countdown.secs}
                </strong>
                <span className="text-[8px] text-[#64748B] uppercase block">SEG</span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-[#1C2330] flex items-center justify-between text-[10px] font-mono">
            <div className="flex items-center gap-2 text-[#8B95A7]">
              <span>Pista: Alta</span>
              <span>•</span>
              <span>Chuva 60%</span>
              <span>•</span>
              <span>22 ºC</span>
            </div>
            <Link
              to="/race"
              className="text-[10px] font-mono font-bold text-white bg-[#E10600] hover:bg-[#FF1A1A] px-2.5 py-1 rounded transition-colors flex items-center gap-1"
            >
              <span>VER DETALHES DO GP</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* CARD DE ANÚNCIO DE NOVO REGULAMENTO TÉCNICO & PREPARAÇÃO 8C.2 */}
      {upcomingAnnouncedRegulation && (
        <section className="rounded-xl bg-gradient-to-r from-[#171206] via-[#1F1709] to-[#0E0C06] border border-amber-500/50 p-3.5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-black uppercase text-amber-400 tracking-wider">
                  REGULAMENTO {upcomingAnnouncedRegulation.effectiveSeason}
                </span>
                <span className="text-zinc-500">•</span>
                <span className="text-[10px] font-mono text-zinc-300">
                  Entrada: <strong>{upcomingAnnouncedRegulation.effectiveSeason}</strong>
                </span>
                <span className="text-zinc-500">•</span>
                <span className="text-[10px] font-mono text-amber-300">
                  Impacto: <strong>{upcomingAnnouncedRegulation.severity}</strong>
                </span>
                <span className="text-zinc-500">•</span>
                <span className="text-[10px] font-mono text-cyan-300">
                  Tempo Restante:{' '}
                  <strong>
                    {Math.max(
                      1,
                      (upcomingAnnouncedRegulation.effectiveSeason - seasonYear) * 24 -
                        (currentRound - 1),
                    )}{' '}
                    GPs
                  </strong>
                </span>
              </div>
              <h4 className="text-sm font-bold text-white leading-tight">
                {upcomingAnnouncedRegulation.name}
              </h4>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#94A3B8]">
                <span>
                  Alocação P&D:{' '}
                  <strong className="text-white">
                    {(team as any)?.regulation_development_allocation?.currentCarShare ?? 75}% Carro
                    /{' '}
                    {(team as any)?.regulation_development_allocation?.futureRegulationShare ?? 25}%
                    Futuro
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Preparação Técnica:{' '}
                  <strong className="text-amber-300">
                    {(team as any)?.regulation_preparations?.[
                      upcomingAnnouncedRegulation.regulationId
                    ]?.status || 'MINIMAL'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2 justify-end">
            <Link
              to="/car"
              className="text-xs font-mono font-bold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span>Gerenciar Alocação & Pesquisa</span>
              <span>→</span>
            </Link>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* LINHA 2: DECISÃO EM ABERTO + OBJETIVOS + SITUAÇÃO NO CAMPEONATO           */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* DECISÃO EM ABERTO (Col 5 - Card vermelho com ações) */}
        <div className="lg:col-span-5 rounded-xl bg-gradient-to-b from-[#180A0A] to-[#0E0606] border border-[#E10600]/60 p-3 sm:p-3.5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-[#E10600]/30 font-mono text-[10px]">
              <div className="flex items-center gap-1.5 text-[#E10600] font-black uppercase">
                <AlertTriangle className="w-3.5 h-3.5 text-[#E10600]" />
                <span>DECISÃO EM ABERTO</span>
              </div>
              <span className="text-[#94A3B8]">
                {pendingDecision?.deadline || '2 dias restantes'}
              </span>
            </div>

            {pendingDecision ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-lg bg-black/60 border border-[#E10600]/40 p-1 flex items-center justify-center shrink-0">
                    <Wrench className="w-7 h-7 text-[#E10600]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-white tracking-tight leading-tight">
                      {pendingDecision.title}
                    </h4>
                    <p className="text-[10px] text-[#CBD5E1] mt-0.5 leading-snug line-clamp-2">
                      {pendingDecision.description}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px] pt-1">
                  <div className="p-1 rounded bg-black/40 border border-white/5">
                    <span className="text-[8px] text-[#8B95A7] uppercase block">Custo</span>
                    <strong className="text-emerald-400 font-bold block">
                      {formatCurrency(pendingDecision.cost)}
                    </strong>
                  </div>
                  <div className="p-1 rounded bg-black/40 border border-white/5">
                    <span className="text-[8px] text-[#8B95A7] uppercase block">Impacto</span>
                    <strong className="text-cyan-400 font-bold block">
                      {pendingDecision.impact}
                    </strong>
                  </div>
                  <div className="p-1 rounded bg-black/40 border border-white/5">
                    <span className="text-[8px] text-[#8B95A7] uppercase block">Risco</span>
                    <strong className="text-amber-400 font-bold block">
                      {pendingDecision.risk}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="text-white font-bold text-xs">Nenhuma decisão pendente</p>
              </div>
            )}
          </div>

          {/* 3 Botões de Ação Exatamente como no Mockup */}
          {pendingDecision && (
            <div className="pt-2 mt-2 border-t border-[#E10600]/30 grid grid-cols-3 gap-1.5 font-mono text-[10px]">
              <button
                type="button"
                onClick={handleApproveDecision}
                disabled={isProcessingDecision}
                className="bg-[#E10600] hover:bg-[#FF1A1A] text-white font-bold py-1.5 px-1 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <CheckSquare className="w-3 h-3" />
                <span>Aprovar e iniciar</span>
              </button>
              <button
                type="button"
                onClick={handleDeferDecision}
                disabled={isProcessingDecision}
                className="bg-black/50 hover:bg-black/70 border border-[#E10600]/40 text-[#CBD5E1] font-medium py-1.5 px-1 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <Clock className="w-3 h-3" />
                <span>Adiar para o próximo GP</span>
              </button>
              <button
                type="button"
                onClick={handleCancelDecision}
                disabled={isProcessingDecision}
                className="bg-black/50 hover:bg-black/70 border border-[#E10600]/40 text-red-400 font-medium py-1.5 px-1 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <span>✕</span>
                <span>Cancelar projeto</span>
              </button>
            </div>
          )}
        </div>

        {/* OBJETIVOS DA TEMPORADA (Col 4) */}
        <div className="lg:col-span-4 rounded-xl bg-[#0F141C] border border-[#1C2330] p-3 sm:p-3.5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-[#1C2330]">
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-black uppercase text-white">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>OBJETIVOS DA TEMPORADA</span>
              </div>
              <Link
                to="/standings"
                className="text-[9px] font-mono text-[#8B95A7] hover:text-white"
              >
                Ver todos →
              </Link>
            </div>

            <div className="mt-2 space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between p-1.5 rounded bg-[#0A0D12] border border-[#1A222F]">
                <div className="flex items-center gap-2 truncate">
                  <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-[#CBD5E1] truncate">Terminar no Top 4 de Construtores</span>
                </div>
                <span className="text-[9px] text-emerald-400 font-bold shrink-0">Em andamento</span>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-[#0A0D12] border border-[#1A222F]">
                <div className="flex items-center gap-2 truncate">
                  <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-[#CBD5E1] truncate">
                    Respeitar o teto orçamentário da FIA
                  </span>
                </div>
                <span className="text-[9px] text-emerald-400 font-bold shrink-0">Em andamento</span>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-[#0A0D12] border border-[#1A222F]">
                <div className="flex items-center gap-2 truncate">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="text-[#CBD5E1] truncate">Desenvolver um piloto jovem</span>
                </div>
                <span className="text-[9px] text-emerald-400 font-bold shrink-0">Em andamento</span>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-[#0A0D12] border border-[#1A222F]">
                <div className="flex items-center gap-2 truncate">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-[#CBD5E1] truncate">
                    Expandir presença da marca no mercado asiático
                  </span>
                </div>
                <span className="text-[9px] text-emerald-400 font-bold shrink-0">Em andamento</span>
              </div>
            </div>
          </div>
        </div>

        {/* SITUAÇÃO NO CAMPEONATO (Col 3) */}
        <div className="lg:col-span-3 rounded-xl bg-[#0F141C] border border-[#1C2330] p-3 sm:p-3.5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-[#1C2330]">
              <span className="text-[10px] font-mono font-black uppercase text-white">
                SITUAÇÃO NO CAMPEONATO
              </span>
            </div>

            {/* Abas Construtores / Pilotos com pílula vermelha */}
            <div className="mt-2 flex items-center bg-[#090D14] p-0.5 rounded-lg border border-[#1A222F] font-mono text-[10px]">
              <button
                type="button"
                onClick={() => setStandingsTab('construtores')}
                className={`flex-1 py-1 rounded text-center font-bold cursor-pointer transition-all ${
                  standingsTab === 'construtores'
                    ? 'bg-[#E10600] text-white shadow'
                    : 'text-[#8B95A7] hover:text-white'
                }`}
              >
                Construtores
              </button>
              <button
                type="button"
                onClick={() => setStandingsTab('pilotos')}
                className={`flex-1 py-1 rounded text-center font-bold cursor-pointer transition-all ${
                  standingsTab === 'pilotos'
                    ? 'bg-[#E10600] text-white shadow'
                    : 'text-[#8B95A7] hover:text-white'
                }`}
              >
                Pilotos
              </button>
            </div>

            {/* Mini Tabela Top 5 */}
            <div className="mt-2 space-y-1 font-mono text-xs">
              {standingsTab === 'construtores'
                ? topConstructors.map((c: any, i: number) => {
                    const cName = c?.teamName || c?.name || ''
                    const isUser =
                      (cName || '').toLowerCase().includes('audi') ||
                      (team?.name && cName === team.name) ||
                      c?.position === constructorPosition
                    return (
                      <div
                        key={cName || c?.id || i}
                        className={`flex items-center justify-between py-1 px-2 rounded ${
                          isUser
                            ? 'bg-[#E10600]/20 border border-[#E10600]/40 text-white font-bold'
                            : 'text-[#CBD5E1]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-[#8B95A7] w-3 text-center text-[11px]">
                            {c?.position || i + 1}
                          </span>
                          <span className="truncate text-[11px]">{cName}</span>
                        </div>
                        <span className="text-white font-bold text-[11px]">{c?.points ?? 0}</span>
                      </div>
                    )
                  })
                : topDrivers.map((d: any, i: number) => {
                    const dName = d?.driverName || d?.name || ''
                    return (
                      <div
                        key={dName || d?.id || i}
                        className="flex items-center justify-between py-1 px-2 rounded text-[#CBD5E1]"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-[#8B95A7] w-3 text-center text-[11px]">
                            {d?.position || i + 1}
                          </span>
                          <span className="truncate text-[11px]">{dName}</span>
                        </div>
                        <span className="text-white font-bold text-[11px]">{d?.points ?? 0}</span>
                      </div>
                    )
                  })}
            </div>
          </div>

          <div className="pt-2 mt-1 border-t border-[#1C2330] text-center">
            <Link
              to="/standings"
              className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 font-semibold"
            >
              Ver classificação completa →
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* LINHA 3: PILOTOS TITULARES + DESENVOLVIMENTO + DESEMPENHO (RADAR)         */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* PILOTOS TITULARES (Col 4) */}
        <div className="lg:col-span-4 rounded-xl bg-[#0F141C] border border-[#1C2330] p-3 sm:p-3.5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-[#1C2330]">
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-black uppercase text-white">
                <span>PILOTOS TITULARES</span>
              </div>
              <Link to="/team" className="text-[9px] font-mono text-[#8B95A7] hover:text-white">
                Ver equipe →
              </Link>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              {titularDrivers.length === 0 ? (
                <div className="col-span-2 py-4">
                  <EmptyState
                    icon={UserCheck}
                    title="Sem pilotos titulares"
                    description="Contrate na aba Equipe"
                    compact
                  />
                </div>
              ) : (
                titularDrivers.map((driver, idx) => {
                  const flag = getCountryFlag(driver.nationality)
                  const physical = driver.physical_condition ?? 95
                  const morale = driver.morale ?? 78
                  const fatigue = driver.fatigue ?? 28
                  const gerScore = Math.round((driver.speed + driver.consistency) / 2) || 85

                  return (
                    <div
                      key={driver.id}
                      className="p-2 rounded-lg bg-[#0A0D12] border border-[#1A222F] space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative shrink-0">
                          <DriverPhotoAvatar
                            name={driver.name}
                            teamColor={team?.color}
                            size="md"
                            className="border"
                          />
                          <span className="absolute -bottom-1 -right-1 text-[10px]">{flag}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-white truncate leading-tight">
                            {driver.name}
                          </h4>
                          <div className="flex items-center justify-between text-[10px] font-mono pt-0.5">
                            <span className="text-[#8B95A7]">#{idx + 1}</span>
                            <span className="text-white font-black">{gerScore} GER</span>
                          </div>
                        </div>
                      </div>

                      {/* Barras Forma / Moral / Fadiga */}
                      <div className="space-y-1 font-mono text-[9px] pt-1 border-t border-[#1C2330]">
                        <div className="flex items-center justify-between">
                          <span className="text-[#8B95A7]">Forma</span>
                          <div className="flex items-center gap-1">
                            <div className="w-10 h-1 rounded-full bg-[#1C2330] overflow-hidden">
                              <div
                                className="h-full bg-emerald-400"
                                style={{ width: `${physical}%` }}
                              />
                            </div>
                            <span className="text-emerald-400 font-bold">{physical}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[#8B95A7]">Moral</span>
                          <div className="flex items-center gap-1">
                            <div className="w-10 h-1 rounded-full bg-[#1C2330] overflow-hidden">
                              <div
                                className="h-full bg-emerald-400"
                                style={{ width: `${morale}%` }}
                              />
                            </div>
                            <span className="text-emerald-400 font-bold">{morale}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[#8B95A7]">Fadiga</span>
                          <div className="flex items-center gap-1">
                            <div className="w-10 h-1 rounded-full bg-[#1C2330] overflow-hidden">
                              <div
                                className="h-full bg-amber-400"
                                style={{ width: `${fatigue}%` }}
                              />
                            </div>
                            <span className="text-amber-400 font-bold">{fatigue}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* DESENVOLVIMENTO EM ANDAMENTO (Col 4) */}
        <div className="lg:col-span-4 rounded-xl bg-[#0F141C] border border-[#1C2330] p-3 sm:p-3.5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-[#1C2330]">
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-black uppercase text-white">
                <span>DESENVOLVIMENTO EM ANDAMENTO</span>
              </div>
              <Link to="/car" className="text-[9px] font-mono text-[#8B95A7] hover:text-white">
                Ver P&D →
              </Link>
            </div>

            <div className="mt-2 space-y-2 font-mono text-[11px]">
              {rdProjects.map((proj) => (
                <div key={proj.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-white font-medium truncate">{proj.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-emerald-400 font-bold">{proj.progress}%</span>
                      <span className="text-[#64748B]">{proj.daysLeft} dias</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#0A0D12] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                      style={{ width: `${proj.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* DESEMPENHO DO CARRO // RADAR (Col 4) */}
        <div className="lg:col-span-4 rounded-xl bg-[#0F141C] border border-[#1C2330] p-3 sm:p-3.5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-[#1C2330]">
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-black uppercase text-white">
                <span>DESEMPENHO DO CARRO</span>
              </div>
              <Badge
                variant="outline"
                className="text-[8px] font-mono border-white/10 text-[#8B95A7]"
              >
                Comparativo
              </Badge>
            </div>

            {/* Radar SVG denso */}
            <div className="mt-1 flex items-center justify-center relative h-36">
              <svg
                viewBox={`0 0 ${radarSvgData.size} ${radarSvgData.size}`}
                className="w-full h-full overflow-visible"
              >
                {[0.33, 0.66, 1].map((scale, i) => (
                  <circle
                    key={i}
                    cx={radarSvgData.center}
                    cy={radarSvgData.center}
                    r={radarSvgData.radius * scale}
                    fill="none"
                    stroke="#1C2535"
                    strokeWidth="1"
                    strokeDasharray={i === 2 ? undefined : '2,2'}
                  />
                ))}

                {/* Polígono Média Grid */}
                <polygon
                  points={radarSvgData.gridPolygon}
                  fill="#64748B"
                  fillOpacity="0.15"
                  stroke="#64748B"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />

                {/* Polígono Jogador */}
                <polygon
                  points={radarSvgData.playerPolygon}
                  fill="#E10600"
                  fillOpacity="0.3"
                  stroke="#E10600"
                  strokeWidth="2"
                />

                {/* Labels de 6 pontas */}
                {radarSvgData.labels.map((lbl, i) => (
                  <text
                    key={i}
                    x={lbl.x}
                    y={lbl.y}
                    fill="#94A3B8"
                    fontSize="7"
                    fontFamily="monospace"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {lbl.label}
                  </text>
                ))}
              </svg>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 text-[9px] font-mono pt-1 text-[#8B95A7]">
            <span className="flex items-center gap-1 text-[#E10600]">
              <span className="w-2 h-2 rounded-full bg-[#E10600]" />
              {team?.name || 'Audi'}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#64748B]" />
              Média do Grid
            </span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* LINHA 4: CAIXA DE ENTRADA + NOTÍCIAS + PRÓXIMAS AÇÕES & AVANÇAR TEMPO     */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* CAIXA DE ENTRADA (Col 5) */}
        <div className="lg:col-span-5 rounded-xl bg-[#0F141C] border border-[#1C2330] p-3 sm:p-3.5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-[#1C2330]">
              <span className="text-[10px] font-mono font-black uppercase text-white">
                CAIXA DE ENTRADA
              </span>
            </div>

            {/* Abas Exatamente como no Mockup: Todas (4), Diretoria (1), Equipe (1), Pilotos (1), Patrocinadores (1) */}
            <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-1 text-[9px] font-mono">
              {[
                { id: 'todas', label: 'Todas (4)' },
                { id: 'diretoria', label: 'Diretoria (1)' },
                { id: 'equipe', label: 'Equipe (1)' },
                { id: 'pilotos', label: 'Pilotos (1)' },
                { id: 'patrocinadores', label: 'Patrocinadores (1)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveInboxTab(tab.id as any)}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors whitespace-nowrap ${
                    activeInboxTab === tab.id
                      ? 'bg-[#E10600] text-white font-bold'
                      : 'bg-[#090D14] text-[#8B95A7] hover:text-white border border-[#1A222F]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Lista de Mensagens */}
            <div className="mt-2 space-y-1.5 font-mono text-[10px]">
              {filteredNotifications.length === 0 ? (
                <div className="space-y-1 text-[#8B95A7]">
                  <div className="flex items-center justify-between p-1 rounded bg-[#0A0D12] border border-[#1A222F]">
                    <span className="text-white">Diretoria: Revisão de desempenho - Q1</span>
                    <span className="text-[#64748B]">Hoje 10:24</span>
                  </div>
                  <div className="flex items-center justify-between p-1 rounded bg-[#0A0D12] border border-[#1A222F]">
                    <span className="text-white">Patrocinador: Novo bônus por desempenho</span>
                    <span className="text-[#64748B]">Hoje 08:17</span>
                  </div>
                  <div className="flex items-center justify-between p-1 rounded bg-[#0A0D12] border border-[#1A222F]">
                    <span className="text-white">Piloto - Ricciardo: Feedback sobre o carro</span>
                    <span className="text-[#64748B]">Ontem 19:42</span>
                  </div>
                  <div className="flex items-center justify-between p-1 rounded bg-[#0A0D12] border border-[#1A222F]">
                    <span className="text-white">Imprensa: Expectativa para o GP do Japão</span>
                    <span className="text-[#64748B]">Ontem 16:03</span>
                  </div>
                </div>
              ) : (
                filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="flex items-center justify-between p-1 rounded bg-[#0A0D12] border border-[#1A222F] text-[10px]"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] shrink-0" />
                      <span className="text-white truncate">{notif.title}</span>
                    </div>
                    <span className="text-[#64748B] shrink-0">Hoje</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* NOTÍCIAS DO PADDOCK (Col 4) */}
        <div className="lg:col-span-4 rounded-xl bg-[#0F141C] border border-[#1C2330] p-3 sm:p-3.5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-[#1C2330]">
              <span className="text-[10px] font-mono font-black uppercase text-white">
                NOTÍCIAS DO PADDOCK
              </span>
              <Link
                to="/historico"
                className="text-[9px] font-mono text-[#8B95A7] hover:text-white"
              >
                Ver todas →
              </Link>
            </div>

            <div className="mt-2 space-y-1.5 font-mono text-[10px]">
              {paddockNews.map((news) => (
                <div
                  key={news.id}
                  className="flex items-center justify-between p-1 rounded bg-[#0A0D12] border border-[#1A222F]"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[#E10600] font-bold shrink-0">●</span>
                    <span className="text-white truncate text-[10px]">{news.title}</span>
                  </div>
                  <span className="text-[#64748B] shrink-0 text-[9px]">{news.timeAgo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PRÓXIMAS AÇÕES + BOTÃO AVANÇAR TEMPO (Col 3) */}
        <div className="lg:col-span-3 rounded-xl bg-[#0F141C] border border-[#1C2330] p-3 sm:p-3.5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-[#1C2330]">
              <span className="text-[10px] font-mono font-black uppercase text-white">
                PRÓXIMAS AÇÕES
              </span>
              <span className="text-[9px] font-mono text-[#8B95A7]">
                {Object.values(checkedActions).filter(Boolean).length}/5
              </span>
            </div>

            {/* Checklist compacto */}
            <div className="mt-2 space-y-1 font-mono text-[10px]">
              {pendingActionsList.map((action) => {
                const isChecked = !!checkedActions[action.id]
                return (
                  <div
                    key={action.id}
                    onClick={() => handleToggleAction(action.id)}
                    className="flex items-center justify-between p-1 rounded bg-[#0A0D12] border border-[#1A222F] cursor-pointer hover:border-[#2C3849]"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="accent-[#E10600] rounded cursor-pointer w-3 h-3"
                      />
                      <span
                        className={`truncate text-[10px] ${
                          isChecked ? 'line-through text-[#64748B]' : 'text-white'
                        }`}
                      >
                        {action.title}
                      </span>
                    </div>
                    <span className="text-[#8B95A7] text-[9px] shrink-0">{action.deadline}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* BOTÃO VERMELHO AVANÇAR TEMPO → */}
          <div className="pt-2 mt-2 border-t border-[#1C2330]">
            <button
              type="button"
              onClick={handleAdvanceTime}
              disabled={isAdvancingTime}
              className="w-full bg-[#E10600] hover:bg-[#FF1A1A] text-white font-black text-xs font-mono uppercase tracking-wider py-2 rounded-lg shadow-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              {isAdvancingTime ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Avançando...</span>
                </>
              ) : (
                <>
                  <span>AVANÇAR TEMPO</span>
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODAL: PERSONALIZAÇÃO DO HERO (NOME, FRASE E CARRO)                       */}
      {/* ========================================================================= */}
      <Dialog open={heroModalOpen} onOpenChange={setHeroModalOpen}>
        <DialogContent className="bg-[#0F141C] border-[#1F2733] text-[#F5F7FA] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-[#E10600]" />
              Personalizar Hero da Equipe
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 font-mono text-xs">
            <div>
              <label className="text-[11px] text-[#8B95A7] block mb-1 uppercase font-bold">
                Nome da Equipe no Painel
              </label>
              <Input
                value={editHeroTitle}
                onChange={(e) => setEditHeroTitle(e.target.value)}
                placeholder="Ex: AUDI F1 TEAM"
                className="bg-[#0A0D12] border-[#1F2733] text-white"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#8B95A7] block mb-1 uppercase font-bold">
                Frase de Efeito / Slogan Oficial
              </label>
              <Textarea
                value={editHeroTagline}
                onChange={(e) => setEditHeroTagline(e.target.value)}
                placeholder="Ex: Tecnologia. Pessoas. Performance. Um futuro mais rápido."
                rows={2}
                className="bg-[#0A0D12] border-[#1F2733] text-white"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#8B95A7] block mb-2 uppercase font-bold">
                Escolha o Modelo do Monoposto (Carro 1 ao 5)
              </label>
              <div className="grid grid-cols-5 gap-2">
                {CAR_MODEL_ASSETS.map((asset) => {
                  const isSelected = editHeroCarModel === asset.id
                  const localModelPath = `/carros/${(asset?.id || '').toLowerCase()}.png`
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setEditHeroCarModel(asset.id)}
                      className={`p-1 rounded-lg border text-center transition-all ${
                        isSelected
                          ? 'border-[#E10600] bg-[#E10600]/10 ring-1 ring-[#E10600]'
                          : 'border-[#1F2733] bg-[#0A0D12] hover:border-[#2C3849]'
                      }`}
                    >
                      <img
                        src={localModelPath}
                        alt={asset.name}
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement
                          if (target.src !== asset.dropboxUrl) {
                            target.src = asset.dropboxUrl
                          } else {
                            target.src = IMAGEM_CARRO_PADRAO_FALLBACK
                          }
                        }}
                        className="w-full h-8 object-contain"
                      />
                      <span className="text-[9px] text-[#CBD5E1] block mt-1 truncate">
                        {asset.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setHeroModalOpen(false)}
              className="bg-[#0B0E14] border-[#1F2733] text-[#8B95A7]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveHeroPreferences}
              disabled={isSavingHero}
              className="bg-[#E10600] hover:bg-[#FF1A1A] text-white font-bold"
            >
              {isSavingHero ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
