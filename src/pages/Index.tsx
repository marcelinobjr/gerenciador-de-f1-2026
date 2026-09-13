import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { standingsService } from '@/services/standingsService'
import pb from '@/lib/pocketbase/client'
import { F1_2026_CALENDAR, OfficialGridTeam, OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'
import { getCountryFlag } from '@/lib/country-flags'
import { formatCurrency } from '@/lib/formatters'
import { CARRO_POR_EQUIPE_MAP, IMAGEM_CARRO_PADRAO_FALLBACK } from '@/assets/carroPorEquipe'
import { CAR_MODEL_ASSETS } from '@/lib/lobby-assets'
import { TRACK_LAYOUTS } from '@/components/CircuitBlueprint'
import { CircuitTrackImage } from '@/components/CircuitTrackImage'
import { DriverHelmet } from '@/components/DriverHelmet'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  Calendar,
  Clock,
  Flag,
  Trophy,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Edit3,
  Mail,
  Newspaper,
  CheckSquare,
  Shield,
  Gauge,
  Zap,
  Play,
  RotateCcw,
  Sliders,
  DollarSign,
  UserCheck,
  Send,
  Loader2,
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
    'todas' | 'pilotos' | 'equipe' | 'patrocinadores' | 'imprensa'
  >('todas')
  const [driverPointsMap, setDriverPointsMap] = useState<Record<string, number>>({})
  const [constructorPoints, setConstructorPoints] = useState(0)
  const [constructorPosition, setConstructorPosition] = useState(1)
  const [totalGridTeams, setTotalGridTeams] = useState(11)

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
  // Calculamos a data fictícia oficial do próximo GP:
  const targetDate = useMemo(() => {
    const base = new Date(seasonYear, 2, 15 + (currentRound - 1) * 14, 14, 0, 0)
    return base.getTime()
  }, [seasonYear, currentRound])

  const [countdown, setCountdown] = useState({ days: 4, hours: 18, mins: 32, secs: 15 })
  useEffect(() => {
    const update = () => {
      const now = Date.now()
      // Para manter a animação viva e realista caso a data já tenha passado
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
  // Ordem de resolução:
  // 1. Se o jogador escolheu um modelo customizado no Hero (Carro1 a Carro5)
  // 2. Se a equipe tem imagem em public/equipes/<team_key>.png (com audi.png já integrada)
  // 3. Se a equipe tem imagem personalizada salva no backend (team.carImage)
  // 4. Imagem homologada da equipe em CARRO_POR_EQUIPE_MAP
  // 5. Fallback homologado
  const heroCarImage = useMemo(() => {
    // 1. Se o jogador escolheu um modelo customizado no Hero (Carro1 a Carro5)
    if (team?.hero_car_model) {
      const modelId = team.hero_car_model.toLowerCase()
      // Tenta modelo local em public/carros/ primeiro
      const localCustom = `/carros/${modelId}.png`
      const modelMatch = CAR_MODEL_ASSETS.find(
        (m) => m.id.toLowerCase() === modelId || m.id === team.hero_car_model,
      )
      if (modelMatch) return localCustom || modelMatch.dropboxUrl
      return `/carros/${team.hero_car_model}.png`
    }

    const normalizedTeamKey = (team?.team_key || '').toLowerCase().replace(/[^a-z0-9]/g, '')

    // 2. Audi da equipe do jogador no save atual: anexo oficial foto de garagem
    if (normalizedTeamKey === 'audi') {
      return '/equipes/audi.png'
    }

    // 3. Se a equipe tem imagem personalizada salva no backend (upload manual do jogador)
    if (team?.carImage) {
      return pb.files.getUrl(team, team.carImage)
    }

    // 4. Imagem homologada da equipe em CARRO_POR_EQUIPE_MAP
    if (team?.team_key && CARRO_POR_EQUIPE_MAP[team.team_key]) {
      return CARRO_POR_EQUIPE_MAP[team.team_key]
    }
    // 5. Tenta caminho padrão de equipe local
    if (normalizedTeamKey) {
      return `/equipes/${normalizedTeamKey}.png`
    }

    return IMAGEM_CARRO_PADRAO_FALLBACK
  }, [team])

  // Estado de erro para o Hero Car Image para exibir fallback estilizado caso o arquivo não exista
  const [heroCarImgFailed, setHeroCarImgFailed] = useState(false)

  // Reset do erro quando a equipe ou imagem mudar
  useEffect(() => {
    setHeroCarImgFailed(false)
  }, [heroCarImage])

  // Textos do Hero
  const heroTitle = team?.hero_title || team?.name || 'AUDI F1 TEAM'
  const heroTagline =
    team?.hero_tagline ||
    'Vorsprung durch Technik na era 50/50 híbrida com combustíveis 100% sustentáveis.'

  // Abrir modal de edição do Hero
  const handleOpenHeroModal = () => {
    setEditHeroTitle(team?.hero_title || team?.name || '')
    setEditHeroTagline(team?.hero_tagline || '')
    setEditHeroCarModel(team?.hero_car_model || 'carro1')
    setHeroModalOpen(true)
  }

  // Salvar preferências do Hero no backend (migration 0036 aditiva)
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
        description: 'As preferências visuais da sua escuderia foram salvas na nuvem.',
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

  // Projetos de P&D em andamento (3 a 4 peças mais evoluídas ou em desenvolvimento)
  const rdProjects = useMemo(() => {
    if (!parts.length) return []
    // Ordena por nível ou condição
    return parts.slice(0, 4).map((p, idx) => {
      // Progresso fictício proporcional ao nível para o dashboard
      const progress = Math.min(100, Math.max(15, p.level * 10 + (p.condition % 20)))
      const daysLeft = Math.max(2, 14 - Math.round((progress / 100) * 12))
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
    // Procura a primeira peça que não foi adiada nem cancelada
    const candidate = parts.find(
      (p) => !deferredDecisions[p.id] && !cancelledDecisions[p.id] && p.level < 10,
    )
    if (!candidate) return null

    const upgradeCost = getUpgradeCost(candidate.level)
    const nextLevel = candidate.level + 1
    const overCap = (team?.cost_cap_spent || 0) + upgradeCost > COST_CAP_LIMIT

    return {
      part: candidate,
      title: `Evolução de ${candidate.name} (Spec ${nextLevel}.0)`,
      description: `O departamento técnico concluiu as simulações em CFD. A nova especificação de ${candidate.name} está pronta para produção em autoclave e montagem imediata para o ${currentGP.name}.`,
      cost: upgradeCost,
      impact: `+${(nextLevel * 0.15).toFixed(2)}s por volta • Melhora de downforce e eficiência`,
      risk: overCap
        ? 'Alto (risco de penalidade FIA por estouro do teto)'
        : 'Baixo (tolerância dentro dos parâmetros)',
      deadline: '48 horas antes da inspeção de pesagem da FIA',
    }
  }, [parts, deferredDecisions, cancelledDecisions, team?.cost_cap_spent, currentGP.name])

  // Aprovar e pagar decisão de P&D
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
          `P&D Central: Decisão aprovada para ${part.name} (Nível ${newLevel}) por ${formatCurrency(cost)}.`,
          'desenvolvimento',
        ),
      ])

      toast({
        title: 'Decisão Aprovada & Peça em Produção!',
        description: `${part.name} evoluiu para o Nível ${newLevel}/10 com sucesso.`,
      })

      await refreshTeamAndSeason()
      // Atualiza peças
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

  // Adiar decisão
  const handleDeferDecision = () => {
    if (!pendingDecision) return
    setDeferredDecisions((prev) => ({ ...prev, [pendingDecision.part.id]: true }))
    toast({
      title: 'Decisão Adiada',
      description: `A produção de ${pendingDecision.part.name} foi postergada para reavaliação técnica.`,
    })
  }

  // Cancelar decisão
  const handleCancelDecision = () => {
    if (!pendingDecision) return
    setCancelledDecisions((prev) => ({ ...prev, [pendingDecision.part.id]: true }))
    toast({
      title: 'Projeto Cancelado',
      description: `Os recursos de engenharia para ${pendingDecision.part.name} foram liberados.`,
    })
  }

  // Radar Chart: Atributos do Carro do Jogador vs Média do Grid
  const radarAttributes = useMemo(() => {
    const aero = team?.aero_level || 50
    const chassis = team?.chassis_level || 50
    const engine = Math.max(30, 100 - (team?.active_engine_wear || 30))
    const strategy = team?.strategy_level || 50
    const overall = team?.strength || 52

    return [
      { label: 'AERODINÂMICA', player: aero, grid: 65 },
      { label: 'CHASSI & PESO', player: chassis, grid: 62 },
      { label: 'MOTOR & ERS', player: engine, grid: 70 },
      { label: 'ESTRATÉGIA', player: strategy, grid: 58 },
      { label: 'RITMO GERAL', player: overall, grid: 64 },
    ]
  }, [team])

  // Geração do Polígono SVG do Radar
  const radarSvgData = useMemo(() => {
    const size = 240
    const center = size / 2
    const radius = 80
    const total = radarAttributes.length
    const angleStep = (Math.PI * 2) / total

    // Pontos do Jogador
    const playerPoints = radarAttributes.map((attr, i) => {
      const angle = i * angleStep - Math.PI / 2
      const val = Math.max(10, Math.min(100, attr.player)) / 100
      const r = val * radius
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`
    })

    // Pontos da Média do Grid
    const gridPoints = radarAttributes.map((attr, i) => {
      const angle = i * angleStep - Math.PI / 2
      const val = Math.max(10, Math.min(100, attr.grid)) / 100
      const r = val * radius
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`
    })

    // Labels posições
    const labels = radarAttributes.map((attr, i) => {
      const angle = i * angleStep - Math.PI / 2
      const r = radius + 22
      return {
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
        label: attr.label,
        playerVal: attr.player,
        gridVal: attr.grid,
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

  // Filtragem da Caixa de Entrada
  const filteredNotifications = useMemo(() => {
    if (activeInboxTab === 'todas') return notifications.slice(0, 8)
    return notifications
      .filter((n) => {
        const type = (n.type || '').toLowerCase()
        if (activeInboxTab === 'pilotos') return type === 'piloto' || type === 'contrato'
        if (activeInboxTab === 'equipe')
          return type === 'equipe' || type === 'peca' || type === 'corrida'
        if (activeInboxTab === 'patrocinadores') return type === 'patrocinio' || type === 'financas'
        if (activeInboxTab === 'imprensa')
          return type === 'imprensa' || type === 'noticia' || type === 'sistema'
        return true
      })
      .slice(0, 8)
  }, [notifications, activeInboxTab])

  // Notícias do Paddock (feed de eventos reais)
  const paddockNews = useMemo(() => {
    if (!events.length) return []
    return events.slice(0, 6).map((ev) => {
      // Simula tempo relativo baseado na data de criação
      const createdTime = new Date(ev.created).getTime()
      const diffHours = Math.max(1, Math.floor((Date.now() - createdTime) / 3600000))
      const timeAgo =
        diffHours < 24 ? `${diffHours}h atrás` : `${Math.floor(diffHours / 24)}d atrás`

      return {
        id: ev.id,
        title: ev.message || 'Atualização oficial do paddock',
        category: ev.type?.toUpperCase() || 'PADDOCK',
        timeAgo,
      }
    })
  }, [events])

  // Checklist de Próximas Ações
  const pendingActionsList = useMemo(() => {
    return [
      {
        id: 'action-setup',
        title: 'Revisar Carga Aerodinâmica & Asas',
        deadline: 'Antes do TL1',
        link: '/car',
      },
      {
        id: 'action-pu',
        title: 'Avaliar Desgaste do Motor & Pool FIA',
        deadline: 'Sexta-feira',
        link: '/car',
      },
      {
        id: 'action-sponsors',
        title: 'Confirmar Metas de Corrida dos Patrocinadores',
        deadline: 'Sábado',
        link: '/sponsors',
      },
      {
        id: 'action-briefing',
        title: 'Briefing Estratégico com os Pilotos Titulares',
        deadline: 'Domingo (Pré-GP)',
        link: '/race',
      },
    ]
  }, [])

  // Toggle do checklist
  const handleToggleAction = (id: string) => {
    setCheckedActions((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Avançar Tempo → (Direciona para o fim de semana da rodada ou avança rodada)
  const handleAdvanceTime = async () => {
    setIsAdvancingTime(true)
    try {
      // Direciona diretamente para o GP da rodada atual
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

  // Auxiliares visuais para condições de pilotos
  const getStatColor = (val: number = 75) => {
    if (val >= 80) return 'bg-emerald-500 text-emerald-400'
    if (val >= 55) return 'bg-amber-500 text-amber-400'
    return 'bg-red-500 text-red-400'
  }

  return (
    <div className="space-y-6 pb-12 select-none text-[#F5F7FA]">
      {/* ============================================================== */}
      {/* 1. HERO COM CARRO DA EQUIPE + TÍTULO E FRASE EDITÁVEIS          */}
      {/* ============================================================== */}
      <section className="relative w-full rounded-2xl bg-gradient-to-r from-[#0C1017] via-[#101622] to-[#0A0D14] border border-[#1C2535] p-5 sm:p-7 shadow-2xl overflow-hidden">
        {/* Luz de fundo estilizada Audi vermelha */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#E10600]/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Lado Esquerdo: Identidade da Equipe e Frase de Efeito */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E10600] animate-pulse" />
              <span className="text-[11px] font-mono font-bold tracking-widest text-[#E10600] uppercase">
                CENTRAL DE OPERAÇÕES // TEMPORADA {seasonYear}
              </span>
              <button
                type="button"
                onClick={handleOpenHeroModal}
                className="ml-auto sm:ml-2 p-1.5 rounded-md bg-[#161D29] hover:bg-[#20293A] border border-[#263245] text-[#8B95A7] hover:text-white transition-all text-xs flex items-center gap-1"
                title="Personalizar Nome, Frase e Modelo do Carro"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-mono">Editar Hero</span>
              </button>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase leading-tight font-mono">
              {heroTitle}
            </h1>

            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed max-w-xl font-medium">
              {heroTagline}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded bg-[#141B26] border border-[#1E2738] text-white">
                Chassi: <strong className="text-cyan-400">Spec-2026</strong>
              </span>
              <span className="px-2.5 py-1 rounded bg-[#141B26] border border-[#1E2738] text-white">
                Fornecedor:{' '}
                <strong className="text-[#E10600]">{team?.engine_supplier || 'Audi'}</strong>
              </span>
              <span className="px-2.5 py-1 rounded bg-[#141B26] border border-[#1E2738] text-white">
                Piloto 1:{' '}
                <strong className="text-emerald-400">{titularDrivers[0]?.name || 'Definir'}</strong>
              </span>
            </div>
          </div>

          {/* Lado Direito: Monoposto de F1 em alta definição */}
          <div className="lg:col-span-6 relative flex items-center justify-center min-h-[180px] sm:min-h-[220px]">
            <div className="relative w-full max-w-[560px] aspect-[16/7] flex items-center justify-center">
              {!heroCarImgFailed ? (
                <img
                  src={heroCarImage}
                  alt={`${team?.name || 'F1 Car'} 2026`}
                  className="w-full h-full object-contain filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.85)] hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    const currentImg = e.currentTarget as HTMLImageElement
                    // Tenta o fallback homologado antes do fallback com iniciais
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
                /* Fallback estilizado com iniciais da equipe e efeito de chassi aerodinâmico */
                <div
                  className="w-full h-full rounded-2xl flex flex-col items-center justify-center p-6 border border-white/10 shadow-2xl relative overflow-hidden"
                  style={{
                    backgroundColor: `${team?.color || '#E10600'}15`,
                    borderColor: `${team?.color || '#E10600'}40`,
                  }}
                >
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse"
                    style={{ animationDuration: '3s' }}
                  />
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center font-mono font-black text-3xl shadow-xl border border-white/20 mb-2"
                    style={{
                      backgroundColor: team?.color || '#E10600',
                      color: '#FFFFFF',
                      textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                    }}
                  >
                    {(team?.name || 'F1')
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join('')
                      .toUpperCase()}
                  </div>
                  <span className="font-mono font-black tracking-widest text-sm text-white uppercase">
                    {team?.name || 'Equipe 2026'}
                  </span>
                  <span className="font-mono text-[10px] text-[#94A3B8] tracking-wider uppercase mt-1">
                    Monoposto Homologado FIA // Aguardando Foto Oficial
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 2 & 3. PRÓXIMO GP + DECISÃO EM ABERTO                           */}
      {/* ============================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card 2: PRÓXIMO GRANDE PRÊMIO */}
        <div className="lg:col-span-7 rounded-2xl bg-[#0F141C] border border-[#1C2330] p-5 sm:p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1C2330]">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-[#E10600]" />
                <span className="text-[11px] font-mono font-bold tracking-widest text-[#8B95A7] uppercase">
                  PRÓXIMO GRANDE PRÊMIO • R{currentRound}/{totalRounds}
                </span>
              </div>
              <Badge className="bg-[#E10600] text-white font-mono text-[10px] px-2 py-0.5">
                OFICIAL FIA
              </Badge>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{currentGP.flag}</span>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
                    {currentGP.name}
                  </h3>
                </div>
                <p className="text-xs font-mono text-cyan-400 font-semibold">{currentGP.circuit}</p>
                <p className="text-xs text-[#8B95A7] max-w-sm pt-1">{currentGP.characteristic}</p>
              </div>

              {/* Traçado vetorial ou Imagem do circuito */}
              <div className="w-36 h-24 sm:w-44 sm:h-28 rounded-lg bg-[#0A0D12] border border-[#1C2330] p-2 flex items-center justify-center shrink-0 overflow-hidden">
                {circuitPhotoUrl ? (
                  <CircuitTrackImage
                    src={circuitPhotoUrl}
                    alt={currentGP.circuit}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <svg
                    viewBox={trackLayout.viewBox}
                    className="w-full h-full drop-shadow-[0_0_6px_rgba(255,255,255,0.3)]"
                  >
                    <path
                      d={trackLayout.svgPath}
                      fill="none"
                      stroke="#334155"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                    <path
                      d={trackLayout.svgPath}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <circle
                      cx={trackLayout.startFinish.x}
                      cy={trackLayout.startFinish.y}
                      r="4"
                      fill="#E10600"
                    />
                  </svg>
                )}
              </div>
            </div>

            {/* Countdown ao vivo */}
            <div className="mt-5 p-3 rounded-xl bg-[#090C12] border border-[#1A222F]">
              <div className="flex items-center justify-between text-xs font-mono text-[#8B95A7] pb-2 border-b border-[#1A222F]">
                <span className="flex items-center gap-1.5 uppercase font-bold text-white">
                  <Clock className="w-3.5 h-3.5 text-[#E10600]" />
                  Contagem Regressiva para a Largada
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold">
                  Horário de Brasília
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-2.5 text-center font-mono">
                <div className="p-1.5 rounded-lg bg-[#111722] border border-[#1E2838]">
                  <span className="text-lg font-black text-white block">{countdown.days}</span>
                  <span className="text-[9px] text-[#64748B] uppercase">Dias</span>
                </div>
                <div className="p-1.5 rounded-lg bg-[#111722] border border-[#1E2838]">
                  <span className="text-lg font-black text-white block">{countdown.hours}</span>
                  <span className="text-[9px] text-[#64748B] uppercase">Horas</span>
                </div>
                <div className="p-1.5 rounded-lg bg-[#111722] border border-[#1E2838]">
                  <span className="text-lg font-black text-white block">{countdown.mins}</span>
                  <span className="text-[9px] text-[#64748B] uppercase">Min</span>
                </div>
                <div className="p-1.5 rounded-lg bg-[#111722] border border-[#1E2838]">
                  <span className="text-lg font-black text-[#E10600] block">{countdown.secs}</span>
                  <span className="text-[9px] text-[#64748B] uppercase">Seg</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-[#1C2330] flex items-center justify-between gap-3">
            <span className="text-xs font-mono text-[#8B95A7]">
              {currentGP.circuitLengthKm.toFixed(3)} km • {currentGP.laps} Voltas
            </span>
            <Button
              asChild
              className="bg-[#E10600] hover:bg-[#FF1A1A] text-white font-bold text-xs font-mono uppercase px-4 shadow-md"
            >
              <Link to="/race" className="flex items-center gap-1.5">
                <span>Ver Detalhes do GP</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Card 3: DECISÃO EM ABERTO (Card vermelho destacado) */}
        <div className="lg:col-span-5 rounded-2xl bg-gradient-to-b from-[#1E0B0B] to-[#120707] border-2 border-[#E10600]/80 p-5 sm:p-6 shadow-2xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#E10600]/20 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E10600]/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#E10600] animate-bounce" />
                <span className="text-[11px] font-mono font-black tracking-widest text-white uppercase">
                  DECISÃO EM ABERTO // P&D URGENTE
                </span>
              </div>
              <Badge className="bg-[#E10600] text-white text-[10px] font-mono font-bold animate-pulse">
                AÇÃO REQUERIDA
              </Badge>
            </div>

            {pendingDecision ? (
              <div className="mt-4 space-y-3">
                <div>
                  <h4 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {pendingDecision.title}
                  </h4>
                  <p className="text-xs text-[#CBD5E1] mt-1 leading-relaxed">
                    {pendingDecision.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2">
                  <div className="p-2 rounded bg-black/40 border border-[#E10600]/30">
                    <span className="text-[10px] text-[#94A3B8] block uppercase">
                      Custo de Produção
                    </span>
                    <strong className="text-sm text-emerald-400 font-bold">
                      {formatCurrency(pendingDecision.cost)}
                    </strong>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-[#E10600]/30">
                    <span className="text-[10px] text-[#94A3B8] block uppercase">
                      Prazo de Entrega
                    </span>
                    <strong className="text-xs text-white font-medium">
                      {pendingDecision.deadline}
                    </strong>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-black/40 border border-[#E10600]/30 text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[#94A3B8]">Impacto Esperado:</span>
                    <span className="text-cyan-400 font-bold">{pendingDecision.impact}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#94A3B8]">Risco Regulamentar:</span>
                    <span className="text-amber-400 font-semibold">{pendingDecision.risk}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 text-center space-y-3 py-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <div>
                  <h4 className="text-base font-bold text-white">Todas as Decisões em Dia</h4>
                  <p className="text-xs text-[#94A3B8] max-w-xs mx-auto mt-1">
                    Nenhum pacote de fabricação pendente no momento. Seus engenheiros continuam
                    trabalhando em novos conceitos.
                  </p>
                </div>
              </div>
            )}
          </div>

          {pendingDecision && (
            <div className="pt-4 mt-4 border-t border-[#E10600]/30 space-y-2">
              <Button
                type="button"
                onClick={handleApproveDecision}
                disabled={isProcessingDecision}
                className="w-full bg-[#E10600] hover:bg-[#FF1A1A] text-white font-black text-xs font-mono uppercase tracking-wider py-2.5 shadow-lg flex items-center justify-center gap-2"
              >
                {isProcessingDecision ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processando Aprovação...</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4" />
                    <span>Aprovar e Pagar Fabricação</span>
                  </>
                )}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDeferDecision}
                  disabled={isProcessingDecision}
                  className="bg-black/40 border-[#E10600]/40 text-[#CBD5E1] hover:text-white hover:bg-black/60 text-xs font-mono font-medium"
                >
                  Adiar Decisão
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelDecision}
                  disabled={isProcessingDecision}
                  className="bg-black/40 border-[#E10600]/40 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs font-mono font-medium"
                >
                  Cancelar Projeto
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ============================================================== */}
      {/* 4 & 5. OBJETIVOS DA TEMPORADA + PILOTOS TITULARES              */}
      {/* ============================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card 4: OBJETIVOS DA TEMPORADA */}
        <div className="lg:col-span-5 rounded-2xl bg-[#0F141C] border border-[#1C2330] p-5 sm:p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1C2330]">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-mono font-bold tracking-widest text-[#8B95A7] uppercase">
                  OBJETIVOS DA TEMPORADA {seasonYear}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-white">
                Meta: Top 5 Construtores
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 font-mono">
              <div className="p-3 rounded-xl bg-[#0A0D12] border border-[#1A222F]">
                <span className="text-[10px] text-[#8B95A7] uppercase block">Posição Atual</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-white">{constructorPosition}º</span>
                  <span className="text-xs text-[#64748B]">/ {totalGridTeams} equipes</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0A0D12] border border-[#1A222F]">
                <span className="text-[10px] text-[#8B95A7] uppercase block">Pontos Totais</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-[#E10600]">{constructorPoints}</span>
                  <span className="text-xs text-[#64748B]">pts FIA</span>
                </div>
              </div>
            </div>

            {/* Barra de Confiança da Diretoria */}
            <div className="mt-4 p-3 rounded-xl bg-[#0A0D12] border border-[#1A222F] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#8B95A7] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  Confiança do Conselho de Administração
                </span>
                <strong className="text-white font-bold">{team?.strength || 52}%</strong>
              </div>
              <div className="w-full h-2 rounded-full bg-[#1C2330] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${team?.strength || 52}%`,
                    backgroundColor:
                      (team?.strength || 52) >= 70
                        ? '#10B981'
                        : (team?.strength || 52) >= 45
                          ? '#F59E0B'
                          : '#EF4444',
                  }}
                />
              </div>
              <p className="text-[11px] text-[#64748B] font-mono">
                {(team?.strength || 52) >= 60
                  ? 'Diretoria satisfeita com os resultados e cumprimento do teto orçamentário.'
                  : 'Atenção aos próximos GPs para garantir a meta esportiva anual.'}
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#1C2330] flex items-center justify-between">
            <span className="text-xs font-mono text-[#8B95A7]">
              Orçamento livre: {formatCurrency(team?.budget || 0)}
            </span>
            <Link
              to="/standings"
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
            >
              <span>Ver Tabela Completa</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Card 5: PILOTOS TITULARES (Cards com fotos reais e barras de condição) */}
        <div className="lg:col-span-7 rounded-2xl bg-[#0F141C] border border-[#1C2330] p-5 sm:p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1C2330]">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px] font-mono font-bold tracking-widest text-[#8B95A7] uppercase">
                  PILOTOS TITULARES // MONOPOSTOS #1 & #2
                </span>
              </div>
              <Link
                to="/team"
                className="text-xs font-mono text-[#8B95A7] hover:text-white flex items-center gap-1"
              >
                <span>Gestão</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {titularDrivers.length === 0 ? (
                <div className="col-span-2 py-6">
                  <EmptyState
                    icon={UserCheck}
                    title="Nenhum piloto titular vinculado"
                    description="Contrate pilotos no Centro de Equipe para pontuar na temporada."
                    compact
                  />
                </div>
              ) : (
                titularDrivers.map((driver, idx) => {
                  const pts = driverPointsMap[driver.id] || 0
                  const flag = getCountryFlag(driver.nationality)
                  const physical = driver.physical_condition ?? 95
                  const morale = driver.morale ?? 65
                  const fatigue = driver.fatigue ?? 0

                  return (
                    <div
                      key={driver.id}
                      className="p-3.5 rounded-xl bg-[#0A0D12] border border-[#1A222F] hover:border-[#2C3849] transition-all space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        {/* Foto real ou avatar com capacete */}
                        <div className="relative shrink-0">
                          <DriverPhotoAvatar
                            name={driver.name}
                            teamColor={team?.color}
                            size="md"
                            className="rounded-xl border border-white/10"
                          />
                          <span className="absolute -bottom-1 -right-1 text-xs">{flag}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-[#E10600] font-black">
                              CARRO #{idx + 1}
                            </span>
                            <span className="text-xs font-mono font-bold text-white">
                              {pts} pts
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white truncate">{driver.name}</h4>
                          <span className="text-[10px] font-mono text-[#8B95A7]">
                            {driver.age} anos • {formatCurrency(driver.salary || 0)}/ano
                          </span>
                        </div>
                      </div>

                      {/* Barras de Forma / Moral / Fadiga */}
                      <div className="space-y-1.5 pt-2 border-t border-[#1C2330] font-mono text-[10px]">
                        {/* Forma Física */}
                        <div>
                          <div className="flex justify-between text-[#8B95A7] mb-0.5">
                            <span>Forma Física</span>
                            <span className="text-white font-bold">{physical}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[#1C2330] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                physical >= 80
                                  ? 'bg-emerald-500'
                                  : physical >= 60
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                              }`}
                              style={{ width: `${physical}%` }}
                            />
                          </div>
                        </div>

                        {/* Moral */}
                        <div>
                          <div className="flex justify-between text-[#8B95A7] mb-0.5">
                            <span>Moral</span>
                            <span className="text-white font-bold">{morale}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[#1C2330] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                morale >= 70
                                  ? 'bg-emerald-500'
                                  : morale >= 45
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                              }`}
                              style={{ width: `${morale}%` }}
                            />
                          </div>
                        </div>

                        {/* Fadiga */}
                        <div>
                          <div className="flex justify-between text-[#8B95A7] mb-0.5">
                            <span>Fadiga Acumulada</span>
                            <span className="text-white font-bold">{fatigue}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[#1C2330] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                fatigue > 50
                                  ? 'bg-red-500'
                                  : fatigue > 25
                                    ? 'bg-amber-500'
                                    : 'bg-cyan-500'
                              }`}
                              style={{ width: `${fatigue}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-[#1C2330] flex items-center justify-between text-xs font-mono text-[#8B95A7]">
            <span>Status dos Pilotos: Em regime de corrida</span>
            <Link to="/team" className="text-cyan-400 hover:text-cyan-300 font-bold">
              Ver Piloto Reserva →
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 6 & 7. DESENVOLVIMENTO P&D + RADAR DE DESEMPENHO               */}
      {/* ============================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card 6: PROJETOS DE P&D EM ANDAMENTO */}
        <div className="lg:col-span-6 rounded-2xl bg-[#0F141C] border border-[#1C2330] p-5 sm:p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1C2330]">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-cyan-400" />
                <span className="text-[11px] font-mono font-bold tracking-widest text-[#8B95A7] uppercase">
                  DESENVOLVIMENTO DE COMPONENTES // P&D
                </span>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] font-mono border-cyan-500/30 text-cyan-400"
              >
                FIA REG 2026
              </Badge>
            </div>

            <div className="mt-4 space-y-3 font-mono">
              {rdProjects.length === 0 ? (
                <EmptyState
                  icon={Wrench}
                  title="Nenhum projeto de P&D ativo"
                  description="Acesse o departamento de Carro e Peças para iniciar novas evoluções."
                  compact
                />
              ) : (
                rdProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-3 rounded-xl bg-[#0A0D12] border border-[#1A222F] space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <strong className="text-white font-bold">{proj.name}</strong>
                        <span className="text-[10px] text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/30">
                          Nível {proj.level}/10
                        </span>
                      </div>
                      <span className="text-[11px] text-[#8B95A7]">
                        {proj.daysLeft} dias restantes
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-[#1C2330] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-[#E10600] transition-all duration-300"
                        style={{ width: `${proj.progress}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-[#64748B]">
                      <span>Integridade da peça: {proj.condition}%</span>
                      <span>{proj.progress}% concluído</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#1C2330] flex items-center justify-between">
            <span className="text-xs font-mono text-[#8B95A7]">
              Instalações: Túnel de Vento Ativo
            </span>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-[#2C3849] bg-[#141B26] text-white hover:bg-[#1E2838] text-xs font-mono"
            >
              <Link to="/car">Gerenciar Peças & P&D</Link>
            </Button>
          </div>
        </div>

        {/* Card 7: DESEMPENHO DO CARRO (Radar Chart SVG) */}
        <div className="lg:col-span-6 rounded-2xl bg-[#0F141C] border border-[#1C2330] p-5 sm:p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1C2330]">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-[#E10600]" />
                <span className="text-[11px] font-mono font-bold tracking-widest text-[#8B95A7] uppercase">
                  DESEMPENHO DO CARRO // RADAR COMPARATIVO
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-[#E10600]">
                  <span className="w-2 h-2 rounded-full bg-[#E10600]" />
                  Seu Carro
                </span>
                <span className="flex items-center gap-1 text-[#8B95A7]">
                  <span className="w-2 h-2 rounded-full bg-[#64748B]" />
                  Média Grid
                </span>
              </div>
            </div>

            {/* Radar Chart SVG Interativo */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <div className="relative w-64 h-64 flex items-center justify-center">
                <svg
                  viewBox={`0 0 ${radarSvgData.size} ${radarSvgData.size}`}
                  className="w-full h-full overflow-visible"
                >
                  {/* Círculos concêntricos de escala */}
                  {[0.25, 0.5, 0.75, 1].map((scale, i) => (
                    <circle
                      key={i}
                      cx={radarSvgData.center}
                      cy={radarSvgData.center}
                      r={radarSvgData.radius * scale}
                      fill="none"
                      stroke="#1C2535"
                      strokeWidth="1"
                      strokeDasharray={i === 3 ? undefined : '2,2'}
                    />
                  ))}

                  {/* Eixos radiais */}
                  {radarSvgData.labels.map((lbl, i) => (
                    <line
                      key={i}
                      x1={radarSvgData.center}
                      y1={radarSvgData.center}
                      x2={lbl.x}
                      y2={lbl.y}
                      stroke="#1C2535"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Polígono da Média do Grid (Cinza) */}
                  <polygon
                    points={radarSvgData.gridPolygon}
                    fill="#64748B"
                    fillOpacity="0.2"
                    stroke="#64748B"
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                  />

                  {/* Polígono do Jogador (Vermelho Audi) */}
                  <polygon
                    points={radarSvgData.playerPolygon}
                    fill="#E10600"
                    fillOpacity="0.35"
                    stroke="#E10600"
                    strokeWidth="2.5"
                  />

                  {/* Vértices do Jogador */}
                  {radarSvgData.labels.map((lbl, i) => {
                    const angle = (i * Math.PI * 2) / radarSvgData.labels.length - Math.PI / 2
                    const val = Math.max(10, Math.min(100, lbl.playerVal)) / 100
                    const r = val * radarSvgData.radius
                    const cx = radarSvgData.center + r * Math.cos(angle)
                    const cy = radarSvgData.center + r * Math.sin(angle)
                    return (
                      <circle
                        key={i}
                        cx={cx}
                        cy={cy}
                        r="3.5"
                        fill="#FFFFFF"
                        stroke="#E10600"
                        strokeWidth="2"
                      />
                    )
                  })}

                  {/* Rótulos dos atributos */}
                  {radarSvgData.labels.map((lbl, i) => (
                    <text
                      key={i}
                      x={lbl.x}
                      y={lbl.y}
                      fill="#94A3B8"
                      fontSize="8"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {lbl.label}
                    </text>
                  ))}
                </svg>
              </div>

              {/* Tabela de Valores Comparativos */}
              <div className="w-full sm:w-48 space-y-2 font-mono text-xs">
                {radarAttributes.map((attr, idx) => {
                  const isBetter = attr.player >= attr.grid
                  return (
                    <div
                      key={idx}
                      className="p-1.5 px-2 rounded bg-[#0A0D12] border border-[#1A222F] flex items-center justify-between"
                    >
                      <span className="text-[10px] text-[#8B95A7] truncate">{attr.label}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <strong className="text-white">{attr.player}</strong>
                        <span className="text-[9px] text-[#64748B]">vs {attr.grid}</span>
                        {isBetter ? (
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-400" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#1C2330] flex items-center justify-between text-xs font-mono">
            <span className="text-[#8B95A7]">Força Relativa Geral:</span>
            <span className="text-cyan-400 font-bold">{team?.strength || 52}/100</span>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 8, 9 & 10. CAIXA DE ENTRADA, NOTÍCIAS DO PADDOCK & PRÓXIMAS AÇÕES */}
      {/* ============================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card 8: CAIXA DE ENTRADA (Tabs com mensagens reais) */}
        <div className="lg:col-span-5 rounded-2xl bg-[#0F141C] border border-[#1C2330] p-5 sm:p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1C2330]">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-cyan-400" />
                <span className="text-[11px] font-mono font-bold tracking-widest text-[#8B95A7] uppercase">
                  COMUNICAÇÃO // CAIXA DE ENTRADA
                </span>
              </div>
              <Badge className="bg-[#161D29] text-[#94A3B8] font-mono text-[10px] border border-[#232D3F]">
                {notifications.length} Mensagens
              </Badge>
            </div>

            {/* Tabs da Caixa de Entrada */}
            <div className="mt-3">
              <Tabs
                value={activeInboxTab}
                onValueChange={(val: any) => setActiveInboxTab(val)}
                className="w-full"
              >
                <TabsList className="w-full grid grid-cols-5 bg-[#0A0D12] p-0.5 border border-[#1A222F] h-8">
                  <TabsTrigger value="todas" className="text-[10px] font-mono py-1 px-1">
                    Todas
                  </TabsTrigger>
                  <TabsTrigger value="pilotos" className="text-[10px] font-mono py-1 px-1">
                    Pilotos
                  </TabsTrigger>
                  <TabsTrigger value="equipe" className="text-[10px] font-mono py-1 px-1">
                    Equipe
                  </TabsTrigger>
                  <TabsTrigger value="patrocinadores" className="text-[10px] font-mono py-1 px-1">
                    Patroc.
                  </TabsTrigger>
                  <TabsTrigger value="imprensa" className="text-[10px] font-mono py-1 px-1">
                    Mídia
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Lista de Mensagens com Ponto Vermelho para não lidas */}
            <div className="mt-3 space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {filteredNotifications.length === 0 ? (
                <EmptyState
                  icon={Mail}
                  title="Caixa de entrada limpa"
                  description="Nenhuma mensagem nesta categoria por enquanto."
                  compact
                />
              ) : (
                filteredNotifications.map((notif) => {
                  const isUnread = !notif.read
                  const time = new Date(notif.created).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <div
                      key={notif.id}
                      className="p-2.5 rounded-xl bg-[#0A0D12] border border-[#1A222F] hover:border-[#2C3849] transition-all flex items-start gap-2.5 text-xs font-mono"
                    >
                      <div className="pt-1 shrink-0">
                        {isUnread ? (
                          <span className="w-2 h-2 rounded-full bg-[#E10600] inline-block shadow-sm" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-[#334155] inline-block" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-white font-bold truncate text-[11px]">
                            {notif.title}
                          </strong>
                          <span className="text-[9px] text-[#64748B] shrink-0">{time}</span>
                        </div>
                        <p className="text-[11px] text-[#8B95A7] font-normal leading-relaxed line-clamp-2 mt-0.5">
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-[#1C2330] text-center">
            <span className="text-[10px] font-mono text-[#64748B]">
              Comunicações sincronizadas via Skip Cloud Realtime
            </span>
          </div>
        </div>

        {/* Card 9: NOTÍCIAS DO PADDOCK */}
        <div className="lg:col-span-4 rounded-2xl bg-[#0F141C] border border-[#1C2330] p-5 sm:p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1C2330]">
              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-mono font-bold tracking-widest text-[#8B95A7] uppercase">
                  NOTÍCIAS DO PADDOCK
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">● AO VIVO</span>
            </div>

            <div className="mt-4 space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {paddockNews.length === 0 ? (
                <EmptyState
                  icon={Newspaper}
                  title="Paddock em silêncio"
                  description="Os acontecimentos e manchetes da temporada serão registrados aqui."
                  compact
                />
              ) : (
                paddockNews.map((news) => (
                  <div
                    key={news.id}
                    className="p-2.5 rounded-xl bg-[#0A0D12] border border-[#1A222F] flex items-start gap-3 hover:border-[#2C3849] transition-all text-xs"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#161D29] border border-[#232D3F] flex items-center justify-center shrink-0 text-[#E10600]">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono font-bold text-amber-400 uppercase">
                          {news.category}
                        </span>
                        <span className="text-[9px] font-mono text-[#64748B]">{news.timeAgo}</span>
                      </div>
                      <p className="text-white text-xs font-semibold leading-snug mt-0.5 line-clamp-2">
                        {news.title}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-[#1C2330] text-center">
            <Link
              to="/historico"
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 font-bold"
            >
              Ver Histórico Completo de Notícias →
            </Link>
          </div>
        </div>

        {/* Card 10: PRÓXIMAS AÇÕES + BOTÃO AVANÇAR TEMPO */}
        <div className="lg:col-span-3 rounded-2xl bg-[#0F141C] border border-[#1C2330] p-5 sm:p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1C2330]">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-[#E10600]" />
                <span className="text-[11px] font-mono font-bold tracking-widest text-[#8B95A7] uppercase">
                  PRÓXIMAS AÇÕES
                </span>
              </div>
              <span className="text-[10px] font-mono text-white font-bold">
                {Object.values(checkedActions).filter(Boolean).length}/4
              </span>
            </div>

            {/* Checklist */}
            <div className="mt-4 space-y-2.5">
              {pendingActionsList.map((action) => {
                const isChecked = !!checkedActions[action.id]
                return (
                  <div
                    key={action.id}
                    onClick={() => handleToggleAction(action.id)}
                    className="p-2.5 rounded-xl bg-[#0A0D12] border border-[#1A222F] hover:border-[#2C3849] cursor-pointer transition-all flex items-start gap-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="mt-0.5 accent-[#E10600] rounded cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <span
                        className={`text-xs font-semibold block leading-tight ${
                          isChecked ? 'line-through text-[#64748B]' : 'text-white'
                        }`}
                      >
                        {action.title}
                      </span>
                      <span className="text-[9px] font-mono text-[#8B95A7] mt-0.5 block">
                        Prazo: {action.deadline}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* BOTÃO VERMELHO AVANÇAR TEMPO → */}
          <div className="pt-4 mt-4 border-t border-[#1C2330]">
            <Button
              type="button"
              onClick={handleAdvanceTime}
              disabled={isAdvancingTime}
              className="w-full bg-[#E10600] hover:bg-[#FF1A1A] text-white font-black text-sm font-mono uppercase tracking-wider py-5 rounded-xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {isAdvancingTime ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Avançando...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>AVANÇAR TEMPO →</span>
                </>
              )}
            </Button>
            <span className="text-[9px] font-mono text-[#64748B] text-center block mt-1.5 uppercase">
              Inicia o Fim de Semana do GP {currentRound}
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* MODAL: PERSONALIZAÇÃO DO HERO (NOME, FRASE E CARRO)            */}
      {/* ============================================================== */}
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
                placeholder="Ex: Vorsprung durch Technik na era 50/50 híbrida."
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
                  const localModelPath = `/carros/${asset.id.toLowerCase()}.png`
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
