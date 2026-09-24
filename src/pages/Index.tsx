import React, { useState, useEffect, useMemo } from 'react'
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
import audiCarImg from '@/assets/audi-13288.png'
import audiGarageHeroImg from '@/assets/audi-e9cff.jpg'
import ricciardoBundledImg from '@/assets/3-danielricciardo-4d208.jpg'
import { resolveNewsIcon } from '@/lib/news-icon-catalog'
import { TRACK_LAYOUTS } from '@/components/CircuitBlueprint'
import { CircuitTrackImage } from '@/components/CircuitTrackImage'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  Wrench,
  ChevronRight,
  TrendingUp,
  CloudRain,
  Thermometer,
  Users,
  DollarSign,
  Briefcase,
  FileText,
  Shield,
  Loader2,
} from 'lucide-react'
import defaultAustraliaMap from '@/assets/01-australia-aeace.jpg'
import bortoletoBundledImg from '@/assets/05-gabrielbortoleto-ed602.png'

// Teto regulamentar FIA (R$ 215M)
const COST_CAP_LIMIT = 215000000

// Custos de aprimoramento de peças
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

export default function IndexPage() {
  const { user, team, season, refreshTeamAndSeason } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  // Estados locais
  const [loading, setLoading] = useState(true)
  const [drivers, setDrivers] = useState<any[]>([])
  const [parts, setParts] = useState<any[]>([])
  const [circuits, setCircuits] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [constructorPoints, setConstructorPoints] = useState(65)
  const [constructorPosition, setConstructorPosition] = useState(3)
  const [allConstructorStandings, setAllConstructorStandings] = useState<any[]>([])
  const [upcomingAnnouncedRegulation, setUpcomingAnnouncedRegulation] =
    useState<TechnicalRegulation | null>(null)

  // Ações de desenvolvimento pendentes e adiadas
  const [deferredDecisions, setDeferredDecisions] = useState<Record<string, boolean>>({})
  const [isProcessingDecision, setIsProcessingDecision] = useState(false)

  // Informações da Temporada e GP Atual
  const currentRound = season?.current_round || 1
  const totalRounds = season?.total_rounds || 24
  const seasonYear = season?.year || 2026

  // Carregar dados principais
  useEffect(() => {
    let mounted = true

    const loadDashboardData = async () => {
      if (!team?.id || !season?.id) {
        setLoading(false)
        return
      }

      try {
        const [drvList, partList, circList, evList, raceResults] = await Promise.all([
          f1Service.getTeamDrivers(team.id).catch(() => []),
          f1Service.getTeamParts(team.id).catch(() => []),
          f1Service.getAllCircuits().catch(() => []),
          f1Service.getTeamEvents(team.id).catch(() => []),
          f1Service.getSeasonRaceResults(season.id).catch(() => []),
        ])

        if (!mounted) return

        setDrivers(drvList)
        setParts(partList)
        setCircuits(circList)
        setEvents(evList)

        // Calcular standings unificadas
        const standingsResult = standingsService.calculateStandings({
          raceResults,
          playerDrivers: drvList,
          team,
          season,
        })

        if (standingsResult) {
          setConstructorPoints(standingsResult.teamPoints ?? 65)
          setConstructorPosition(standingsResult.playerConstructorRank ?? 3)
          setAllConstructorStandings(standingsResult.constructorStandings || [])
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

  // Imagem do carro do Hero (vista lateral audiCarImg para Audi)
  const heroCarImage = useMemo(() => {
    const normalizedTeamKey = (team?.team_key || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    if (normalizedTeamKey === 'audi' || !team?.team_key) {
      return audiCarImg
    }
    if (CARRO_POR_EQUIPE_MAP[normalizedTeamKey as keyof typeof CARRO_POR_EQUIPE_MAP]) {
      return CARRO_POR_EQUIPE_MAP[normalizedTeamKey as keyof typeof CARRO_POR_EQUIPE_MAP]
    }
    return audiCarImg || IMAGEM_CARRO_PADRAO_FALLBACK
  }, [team])

  // Pilotos Titulares
  const titularDrivers = useMemo(() => {
    const list = drivers.filter((d) => d.role === 'titular').slice(0, 2)
    if (list.length >= 2) return list

    // Fallbacks canônicos oficiais caso a carreira ainda não tenha pilotos contratados
    const defaults = [
      {
        id: 'driver-ricciardo',
        name: 'Daniel Ricciardo',
        nationality: 'Austrália',
        code: 'RIC',
        number: 3,
        speed: 84,
        consistency: 85,
        morale: 88,
        physical_condition: 92,
        bundledImg: ricciardoBundledImg,
      },
      {
        id: 'driver-bortoleto',
        name: 'Gabriel Bortoleto',
        nationality: 'Brasil',
        code: 'BOR',
        number: 5,
        speed: 82,
        consistency: 80,
        morale: 86,
        physical_condition: 96,
        bundledImg: bortoletoBundledImg,
      },
    ]

    if (list.length === 1) {
      return [list[0], defaults[1]]
    }
    return defaults
  }, [drivers])

  // Métricas do Carro
  const carMetrics = useMemo(() => {
    const aero = team?.aero_level || 74
    const reliability = team?.strategy_level || 82
    const engine = Math.max(40, 100 - (team?.active_engine_wear || 22))
    const development = Math.min(100, Math.round((aero + reliability + engine) / 3))
    return {
      performance: Math.round(aero * 0.95),
      reliability: reliability,
      development: development,
    }
  }, [team])

  // Finanças
  const budget = team?.budget ?? 142000000
  const costCapSpent = team?.cost_cap_spent ?? 68000000
  const costCapPct = Math.min(100, Math.round((costCapSpent / COST_CAP_LIMIT) * 100))
  const monthlyCost = 7800000
  const projectedRevenue = 185000000
  const endOfSeasonProjection = budget + 24000000

  // Decisão em aberto mais urgente
  const pendingDecision = useMemo(() => {
    if (!parts.length) {
      return {
        id: 'spec-aero-update',
        title: 'Aprovar pacote aerodinâmico para o próximo GP',
        description: 'Evolução de asas e assoalho pronta para fabricação em regime acelerado.',
        cost: 3500000,
        priority: 'high' as const,
        route: '/car',
      }
    }
    const candidate = parts.find((p) => !deferredDecisions[p.id] && p.level < 10)
    if (!candidate) return null

    const upgradeCost = getUpgradeCost(candidate.level)
    const nextLevel = candidate.level + 1

    return {
      id: candidate.id,
      title: `Aprovar atualização de ${candidate.name} (Spec ${nextLevel}.0)`,
      description: `Evolução pronta para fabricação imediata no CFD & Túnel de Vento.`,
      cost: upgradeCost,
      priority: 'high' as const,
      route: '/car',
    }
  }, [parts, deferredDecisions])

  // Lista da Mesa do Jogador ("O que eu preciso decidir agora?")
  const executiveDecisions = useMemo(() => {
    const list = []

    if (pendingDecision) {
      list.push({
        id: pendingDecision.id,
        priority: 'high' as const,
        priorityLabel: 'ALTA',
        title: pendingDecision.title,
        subtitle: `Custo estimado de <span className="font-mono tabular-nums">${formatCurrency(pendingDecision.cost)}</span> • Impacto imediato`,
        costFormatted: formatCurrency(pendingDecision.cost),
        actionLabel: 'Decidir',
        route: '/car',
      })
    } else {
      list.push({
        id: 'contract-renewal',
        priority: 'high' as const,
        priorityLabel: 'ALTA',
        title: `Renovação Contratual: ${titularDrivers[1]?.name || 'Gabriel Bortoleto'}`,
        subtitle: 'Abrir negociação de extensão antes do interesse de rivais no paddock',
        actionLabel: 'Negociar',
        route: '/pilotos',
      })
    }

    list.push({
      id: 'gp-strategy',
      priority: 'medium' as const,
      priorityLabel: 'MÉDIA',
      title: `Revisar estratégia para o ${currentGP?.name || 'Próximo GP'}`,
      subtitle: `Alocação de compostos e ritmo de corrida para ${currentGP?.circuit || 'Suzuka'}`,
      actionLabel: 'Revisar',
      route: '/corrida',
    })

    list.push({
      id: 'sponsor-offers',
      priority: 'low' as const,
      priorityLabel: 'BAIXA',
      title: 'Avaliar propostas comerciais de patrocinadores',
      subtitle: '2 marcas interessadas em novos espaços para o pacote asiático',
      actionLabel: 'Avaliar',
      route: '/sponsors',
    })

    return list
  }, [pendingDecision, titularDrivers, currentGP])

  // Notícias do Paddock
  const paddockNews = useMemo(() => {
    if (!events.length) {
      return [
        {
          id: 'news-1',
          title: `${team?.name || 'Audi'} traz atualização para Suzuka`,
          snippet: 'Novo assoalho com fluxo de ar revisado promete ganho de 0,18s por volta.',
          time: 'Há 2h',
          category: 'CAR',
          tag: 'CARRO',
        },
        {
          id: 'news-2',
          title: `${titularDrivers[1]?.name || 'Bortoleto'} impressiona nos treinos`,
          snippet: 'Desempenho consistente em ritmo de classificação chama atenção da imprensa.',
          time: 'Há 4h',
          category: 'DRIVER',
          tag: 'PILOTO',
        },
        {
          id: 'news-3',
          title: `${team?.name || 'Audi'} reforça programa de longo prazo`,
          snippet: 'Investimentos em infraestrutura avançam com nova bancada de testes.',
          time: 'Há 7h',
          category: 'TEAM',
          tag: 'EQUIPE',
        },
      ]
    }

    return events.slice(0, 3).map((ev, idx) => {
      const createdTime = new Date(ev?.created || Date.now()).getTime()
      const diffHours = Math.max(1, Math.floor((Date.now() - createdTime) / 3600000))
      const timeAgo = diffHours < 24 ? `Há ${diffHours}h` : `Há ${Math.floor(diffHours / 24)}d`
      const rawCategory = ev?.category || ev?.type || 'GENERAL'

      return {
        id: ev?.id || `ev-${idx}`,
        title: ev?.message || 'Atualização oficial do paddock',
        snippet: ev?.details || 'Comunicação executiva da equipe no paddock oficial.',
        time: timeAgo,
        category: rawCategory,
        tag: (ev?.type || ev?.category || 'PADDOCK').toUpperCase(),
      }
    })
  }, [events, team?.name, titularDrivers])

  // Classificação de Construtores
  const constructorStandingsList = useMemo(() => {
    if (allConstructorStandings.length > 0) {
      return allConstructorStandings.slice(0, 6)
    }
    return [
      { position: 1, teamName: 'McLaren', points: 87 },
      { position: 2, teamName: 'Red Bull', points: 71 },
      { position: 3, teamName: team?.name || 'Audi F1 Team', points: constructorPoints },
      { position: 4, teamName: 'Ferrari', points: 61 },
      { position: 5, teamName: 'Mercedes', points: 58 },
      { position: 6, teamName: 'Aston Martin', points: 42 },
    ]
  }, [allConstructorStandings, team?.name, constructorPoints])

  const handleApproveDecision = async () => {
    if (!pendingDecision || !team) return
    if (team.budget < pendingDecision.cost) {
      toast({
        variant: 'destructive',
        title: 'Orçamento Insuficiente',
        description: `Saldo atual não cobre o custo de ${formatCurrency(pendingDecision.cost)}.`,
      })
      return
    }

    setIsProcessingDecision(true)
    try {
      const { financialLedgerService } = await import('@/services/financialLedgerService')
      await financialLedgerService.postTransaction({
        teamId: team.id,
        seasonYear: seasonYear,
        round: currentRound,
        type: 'expense',
        category: 'development',
        subcategory: `paddock_upgrade_${pendingDecision.id}`,
        direction: 'outflow',
        amount: pendingDecision.cost,
        costCapClassification: 'included',
        sourceSystem: 'apex_central_decision',
        sourceEntityId: pendingDecision.id,
        idempotencyKey: `apex_decision_${team.id}_${pendingDecision.id}_${Date.now()}`,
        description: `Decisão Executiva Aprovada: ${pendingDecision.title}`,
      })

      toast({
        title: 'Decisão Aprovada & Em Produção!',
        description: `${pendingDecision.title} foi homologada pela engenharia.`,
      })

      await refreshTeamAndSeason()
      const updatedParts = await f1Service.getTeamParts(team.id)
      setParts(updatedParts)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao processar',
        description: err?.message || 'Tente novamente.',
      })
    } finally {
      setIsProcessingDecision(false)
    }
  }

  const teamName = team?.name || 'AUDI F1 TEAM'

  return (
    <div className="space-y-4 pb-8 text-[#1E293B] antialiased">
      {/* ========================================================================= */}
      {/* LINHA 1: HERO EQUIPE + PRÓXIMA CORRIDA                                    */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* HERO: EQUIPE (Col 8) */}
        <div className="lg:col-span-8 relative rounded-xl bg-[#0B0E14] border border-[#E2E8F0]/20 shadow-md overflow-hidden min-h-[220px] sm:min-h-[240px] flex flex-col justify-between text-white">
          {/* Imagem de Fundo Oficial da Garagem Audi Sport F1 Team */}
          <div
            className="absolute inset-0 bg-cover bg-center sm:bg-[center_right_10%] pointer-events-none opacity-85 transition-transform duration-700"
            style={{
              backgroundImage: `url(${audiGarageHeroImg})`,
            }}
          />

          {/* Gradiente escuro lateral da esquerda para a direita para legibilidade dos textos executivos */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#080B10] via-[#0B0E14]/90 sm:via-[#0B0E14]/80 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080B10]/90 via-transparent to-transparent pointer-events-none" />

          {/* Conteúdo sobreposto */}
          <div className="relative z-10 p-5 sm:p-6 space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#E10600]/20 border border-[#E10600]/40 text-[#FF4D4D] text-[11px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E10600]" />
              {seasonYear} FIA FORMULA 1 WORLD CHAMPIONSHIP
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white uppercase font-sans">
                {teamName}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-300 font-medium mt-0.5">
                Centro de Operações Executivas & Performance Esportiva
              </p>
            </div>

            {/* Poucos indicadores executivos de alto impacto */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-1 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase text-neutral-400 font-semibold block">
                  Classificação Construtores
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-extrabold text-white font-mono">
                    {constructorPosition}º
                  </span>
                  <span className="text-emerald-400 font-bold text-xs flex items-center">
                    <TrendingUp className="w-3 h-3 mr-0.5" /> +2 pos. vs. ano anterior
                  </span>
                </div>
              </div>

              <div className="h-8 w-[1px] bg-neutral-700/60 hidden sm:block" />

              <div className="space-y-0.5">
                <span className="text-[10px] uppercase text-neutral-400 font-semibold block">
                  Pontos Acumulados
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-white font-mono">
                  {constructorPoints}{' '}
                  <span className="text-xs font-normal text-neutral-400">pts</span>
                </span>
              </div>
            </div>
          </div>

          {/* Barra de Progresso do Objetivo de Temporada na base */}
          <div className="relative z-10 px-5 sm:px-6 py-3 bg-[#0B0E14]/85 border-t border-white/10 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-neutral-300">Objetivo da Temporada:</span>
              <span className="font-semibold text-white">Terminar no Top 4 de Construtores</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32 sm:w-44 h-2 rounded-full bg-neutral-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#E10600] to-emerald-500 w-[78%]" />
              </div>
              <span className="font-bold text-emerald-400 font-mono text-[11px]">78% atingido</span>
            </div>
          </div>
        </div>

        {/* PRÓXIMA CORRIDA (Col 4) */}
        <div className="lg:col-span-4 rounded-xl bg-white border border-[#E2E8F0] p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#E10600]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  Próxima Corrida
                </span>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-neutral-100 text-[#475569] font-mono">
                R{currentRound} / {totalRounds}
              </span>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-2xl inline-flex items-center justify-center"
                    aria-label="Japão"
                  >
                    {currentGP?.flag && currentGP.flag !== 'JP' ? currentGP.flag : '🇯🇵'}
                  </span>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#0F172A] leading-tight flex items-center gap-1.5">
                      <span>{currentGP?.name || 'Grande Prêmio do Japão'}</span>
                      <span className="align-middle text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-[#475569] border border-neutral-200 uppercase font-mono tracking-wider">
                        JPN
                      </span>
                    </h3>
                    <p className="text-xs text-[#64748B] font-medium mt-0.5">
                      {currentGP?.circuit || 'Suzuka International Racing Course'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Traçado Oficial Suzuka / Circuito */}
              <div className="w-20 h-16 rounded-lg bg-[#11161C] border border-[#334155] p-1.5 flex items-center justify-center shrink-0 shadow-inner">
                {circuitPhotoUrl ? (
                  <CircuitTrackImage
                    src={circuitPhotoUrl}
                    alt={currentGP?.circuit || 'Circuito'}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <svg viewBox={trackLayout.viewBox} className="w-full h-full">
                    <path
                      d={trackLayout.svgPath}
                      fill="none"
                      stroke="#334155"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                    <path
                      d={trackLayout.svgPath}
                      fill="none"
                      stroke="#CBD5E1"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </div>
            </div>

            {/* Informações Relevantes de Pista */}
            <div className="grid grid-cols-3 gap-2 pt-1 font-sans">
              <div className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-center">
                <span className="text-[10px] text-[#64748B] font-medium uppercase block">
                  Prazo
                </span>
                <strong className="text-xs sm:text-sm font-bold text-[#0F172A] block mt-0.5 font-mono">
                  4 dias
                </strong>
              </div>
              <div className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-[#64748B] font-medium uppercase">
                  <CloudRain className="w-3 h-3 text-cyan-600" />
                  <span>Chuva</span>
                </div>
                <strong className="text-xs sm:text-sm font-bold text-cyan-600 block mt-0.5 font-mono">
                  35%
                </strong>
              </div>
              <div className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-[#64748B] font-medium uppercase">
                  <Thermometer className="w-3 h-3 text-amber-500" />
                  <span>Temp.</span>
                </div>
                <strong className="text-xs sm:text-sm font-bold text-[#0F172A] block mt-0.5 font-mono">
                  22 ºC
                </strong>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#F1F5F9] text-[11px] text-[#475569] leading-snug">
              Exigência técnica da pista:{' '}
              <strong className="text-[#0F172A]">Alta pressão aerodinâmica</strong> e curvas rápidas
              em "S".
            </div>
          </div>

          {/* Botão Principal PREPARAR GP → */}
          <div className="pt-3 mt-3 border-t border-[#F1F5F9]">
            <Button
              type="button"
              onClick={() => navigate('/corrida')}
              className="w-full bg-[#E10600] hover:bg-[#C50500] text-white font-bold h-11 text-xs uppercase tracking-wider rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Preparar GP</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* AVISO DE REGULAMENTO TÉCNICO FUTURO (Se houver) */}
      {upcomingAnnouncedRegulation && (
        <section className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.2 rounded bg-amber-200/80 text-amber-800">
                  Novo Regulamento Técnico FIA
                </span>
                <span className="text-xs font-semibold text-amber-900">
                  Efetivo em {upcomingAnnouncedRegulation.effectiveSeason}
                </span>
              </div>
              <p className="text-xs text-amber-950 font-medium mt-0.5">
                {upcomingAnnouncedRegulation.name} • Impacto {upcomingAnnouncedRegulation.severity}
              </p>
            </div>
          </div>
          <Link
            to="/car"
            className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 shrink-0"
          >
            <span>Gerenciar Alocação de P&D</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </section>
      )}

      {/* ========================================================================= */}
      {/* LINHA 2: TRÊS CARDS PRINCIPAIS (CARRO, PILOTOS, FINANÇAS)                 */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* CARD 1: CARRO */}
        <div className="rounded-xl bg-white border border-[#E2E8F0] p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#E10600]" />
                <h3 className="text-sm font-bold uppercase tracking-tight text-[#0F172A]">Carro</h3>
              </div>
              <span className="text-[11px] font-semibold text-[#64748B] font-mono">
                Spec {seasonYear}
              </span>
            </div>

            {/* Imagem do carro com crop limpo (side view audiCarImg h-28 w-full object-contain) */}
            <div className="relative h-28 w-full rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] overflow-hidden flex items-center justify-center p-2">
              <img
                src={audiCarImg}
                alt="Carro Audi F1"
                className="h-28 w-full object-contain filter drop-shadow-sm transition-transform hover:scale-105 duration-300"
              />
            </div>

            {/* Indicadores Visuais em Barras */}
            <div className="space-y-2.5 pt-1 text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B] font-medium">Desempenho</span>
                  <span className="font-bold text-[#0F172A] font-mono">
                    {carMetrics.performance}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#E10600]"
                    style={{ width: `${carMetrics.performance}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B] font-medium">Confiabilidade</span>
                  <span className="font-bold text-emerald-600 font-mono">
                    {carMetrics.reliability}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${carMetrics.reliability}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B] font-medium">Desenvolvimento P&D</span>
                  <span className="font-bold text-cyan-600 font-mono">
                    {carMetrics.development}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyan-500"
                    style={{ width: `${carMetrics.development}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-[#F1F5F9]">
            <Link
              to="/car"
              className="text-xs font-bold text-[#E10600] hover:text-[#B30500] flex items-center justify-between group"
            >
              <span>Gerenciar Carro</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>

        {/* CARD 2: PILOTOS */}
        <div className="rounded-xl bg-white border border-[#E2E8F0] p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#E10600]" />
                <h3 className="text-sm font-bold uppercase tracking-tight text-[#0F172A]">
                  Pilotos
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-[#64748B]">2 Titulares</span>
            </div>

            {/* Dois Pilotos Lado a Lado (exclusivamente imagens fornecidas, simetria w-14 h-16) */}
            <div className="grid grid-cols-2 gap-3">
              {titularDrivers.map((driver, idx) => {
                const flag = getCountryFlag(driver.nationality)
                const gerScore = Math.round((driver.speed + driver.consistency) / 2) || 85
                const moralVal = driver.morale ?? 85
                const formaVal = driver.physical_condition ?? 92
                const consistVal = driver.consistency ?? 82

                return (
                  <div
                    key={driver.id || idx}
                    className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="relative shrink-0">
                          <DriverPhotoAvatar
                            name={driver.name}
                            driverId={driver.id}
                            visualIdentity={
                              (driver as any)?.procedural_data?.visualIdentity ||
                              (driver as any)?.visualIdentity ||
                              null
                            }
                            teamColor={team?.color}
                            className="w-14 h-16 rounded-lg overflow-hidden border border-[#CBD5E1]"
                            imgClassName={`w-full h-full object-cover ${
                              driver.name.toLowerCase().includes('ricciardo')
                                ? 'object-[50%_12%]'
                                : 'object-top'
                            }`}
                          />
                          <span className="absolute -bottom-1 -right-1 text-xs">{flag}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] text-[#64748B] font-mono block">
                            #{driver.number || idx + 1}
                          </span>
                          <h4 className="font-bold text-xs text-[#0F172A] truncate leading-tight">
                            {driver.name.split(' ').pop()}
                          </h4>
                          <span className="text-[10px] font-bold text-[#E10600] font-mono">
                            {gerScore} GER
                          </span>
                        </div>
                      </div>

                      {/* Barras de Moral, Forma e Consistência */}
                      <div className="space-y-1.5 pt-2 text-[10px]">
                        <div>
                          <div className="flex justify-between text-[#64748B] mb-0.5">
                            <span>Forma</span>
                            <span className="font-bold text-[#0F172A] font-mono">{formaVal}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${formaVal}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[#64748B] mb-0.5">
                            <span>Moral</span>
                            <span className="font-bold text-[#0F172A] font-mono">{moralVal}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-cyan-500"
                              style={{ width: `${moralVal}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[#64748B] mb-0.5">
                            <span>Consistência</span>
                            <span className="font-bold text-[#0F172A] font-mono">
                              {consistVal}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${consistVal}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-[#F1F5F9]">
            <Link
              to="/pilotos"
              className="text-xs font-bold text-[#E10600] hover:text-[#B30500] flex items-center justify-between group"
            >
              <span>Ver Pilotos</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>

        {/* CARD 3: FINANÇAS */}
        <div className="rounded-xl bg-white border border-[#E2E8F0] p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold uppercase tracking-tight text-[#0F172A]">
                  Finanças
                </h3>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                Superávit
              </span>
            </div>

            {/* Saldo e Receita Projetada */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[10px] text-[#64748B] font-medium uppercase block">
                  Saldo Disponível
                </span>
                <strong className="text-base sm:text-lg font-bold text-emerald-600 font-mono tabular-nums block mt-0.5">
                  US$ {(budget / 1000000).toFixed(1)}M
                </strong>
                <span className="text-[10px] text-[#64748B]">Liquidez imediata</span>
              </div>
              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[10px] text-[#64748B] font-medium uppercase block">
                  Receita Projetada
                </span>
                <strong className="text-base sm:text-lg font-bold text-[#0F172A] font-mono tabular-nums block mt-0.5">
                  US$ {(projectedRevenue / 1000000).toFixed(1)}M
                </strong>
                <span className="text-[10px] text-[#64748B]">Contratos & bônus</span>
              </div>
            </div>

            {/* Barra Horizontal de Uso do Teto de Gastos */}
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B] font-medium">Uso do Teto de Gastos (FIA)</span>
                <span className="font-bold text-[#0F172A] font-mono tabular-nums">
                  {costCapPct}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-500"
                  style={{ width: `${costCapPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#64748B] font-mono tabular-nums">
                <span>US$ {(costCapSpent / 1000000).toFixed(1)}M gastos</span>
                <span>Limite: US$ 215.0M</span>
              </div>
            </div>

            {/* Custo Mensal e Projeção de Fim de Temporada */}
            <div className="p-2.5 rounded-lg bg-[#F1F5F9] flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-[#64748B] uppercase block">Custo Mensal</span>
                <span className="font-bold text-[#0F172A] font-mono tabular-nums">
                  US$ {(monthlyCost / 1000000).toFixed(1)}M/mês
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#64748B] uppercase block">Fim de Temporada</span>
                <span className="font-bold text-emerald-600 font-mono tabular-nums">
                  +US$ {(endOfSeasonProjection / 1000000).toFixed(1)}M
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-[#F1F5F9]">
            <Link
              to="/sponsors"
              className="text-xs font-bold text-[#E10600] hover:text-[#B30500] flex items-center justify-between group"
            >
              <span>Gerenciar Finanças</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* LINHA 3: SUA MESA (DECISÕES DO JOGADOR) + NOTÍCIAS + CONSTRUTORES         */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* SUA MESA: O QUE PRECISO DECIDIR AGORA? (Col 5) */}
        <div className="lg:col-span-5 rounded-xl bg-white border border-[#E2E8F0] p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9] gap-2">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#E10600]" />
                <h3 className="text-sm font-bold uppercase tracking-tight text-[#0F172A]">
                  Sua Mesa
                </h3>
              </div>

              {/* Card Discreto de Manager / Team Principal */}
              <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-neutral-50 border border-[#E2E8F0] shrink-0">
                <div
                  className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-xs"
                  style={{ backgroundColor: team?.color || '#E10600' }}
                >
                  {(team?.manager_name || user?.name || 'Team Principal')
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p: string) => p[0])
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="flex flex-col text-left leading-none">
                  <span className="text-[11px] font-bold text-[#0F172A] truncate max-w-[110px]">
                    {team?.manager_name || user?.name || 'Team Principal'}
                  </span>
                  <span className="text-[9px] text-[#64748B] font-medium mt-0.5">
                    Team Principal & CEO
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-[#E10600] border border-red-200">
                {executiveDecisions.length} Decisões Pendentes
              </span>
            </div>
            <p className="text-xs text-[#64748B]">
              Ações executivas que exigem sua intervenção e direcionamento como Team Principal:
            </p>

            <div className="space-y-2">
              {executiveDecisions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(item.route)}
                  className="p-3 rounded-lg border border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC] transition-all cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                        item.priority === 'high'
                          ? 'bg-[#E10600]'
                          : item.priority === 'medium'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded font-mono ${
                            item.priority === 'high'
                              ? 'bg-red-100 text-red-700'
                              : item.priority === 'medium'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.priorityLabel}
                        </span>
                        <h4 className="font-bold text-xs text-[#0F172A] truncate group-hover:text-[#E10600] transition-colors">
                          {item.title}
                        </h4>
                      </div>
                      <p
                        className="text-[11px] text-[#64748B] mt-0.5 truncate"
                        dangerouslySetInnerHTML={{ __html: item.subtitle }}
                      />
                    </div>
                  </div>

                  <span className="text-xs font-bold text-[#E10600] shrink-0 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    <span>{item.actionLabel}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              ))}
            </div>
          </div>

          {pendingDecision && (
            <div className="pt-3 mt-4 border-t border-[#F1F5F9] flex items-center justify-between">
              <span className="text-[11px] text-[#64748B]">Aprovação rápida de produção:</span>
              <Button
                type="button"
                size="sm"
                onClick={handleApproveDecision}
                disabled={isProcessingDecision}
                className="bg-[#E10600] hover:bg-[#C50500] text-white text-xs font-semibold px-3 py-1.5 rounded h-8"
              >
                {isProcessingDecision ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    Aprovando...
                  </>
                ) : (
                  'Aprovar Atualização Imediata'
                )}
              </Button>
            </div>
          )}
        </div>

        {/* NOTÍCIAS DO PADDOCK (Col 4) */}
        <div className="lg:col-span-4 rounded-xl bg-white border border-[#E2E8F0] p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#E10600]" />
                <h3 className="text-sm font-bold uppercase tracking-tight text-[#0F172A]">
                  Notícias do Paddock
                </h3>
              </div>
              <Link
                to="/historico"
                className="text-xs font-medium text-[#64748B] hover:text-[#0F172A]"
              >
                Ver todas →
              </Link>
            </div>

            {/* Lista com Miniaturas Temáticas e Textos Curtos */}
            <div className="space-y-2.5">
              {paddockNews.map((news) => {
                const iconMeta = resolveNewsIcon(news.category || news.tag)
                const IconComponent = iconMeta.lucideIcon

                return (
                  <div
                    key={news.id}
                    className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-3 hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-md bg-[#0F172A] border border-[#CBD5E1] shrink-0 overflow-hidden flex items-center justify-center p-0 text-[#E10600]">
                      <IconComponent className="w-6 h-6" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-bold text-[#E10600] font-mono">
                          {news.tag}
                        </span>
                        <span className="text-[10px] text-[#94A3B8] font-mono">{news.time}</span>
                      </div>
                      <h4 className="font-bold text-xs text-[#0F172A] truncate leading-tight mt-0.5">
                        {news.title}
                      </h4>
                      <p className="text-[11px] text-[#64748B] truncate mt-0.5">{news.snippet}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-[#F1F5F9]">
            <Link
              to="/paddock"
              className="text-xs font-bold text-[#E10600] hover:text-[#B30500] flex items-center justify-between group"
            >
              <span>Acessar Paddock Completo</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>

        {/* CAMPEONATO DE CONSTRUTORES (Col 3) */}
        <div className="lg:col-span-3 rounded-xl bg-white border border-[#E2E8F0] p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <h3 className="text-sm font-bold uppercase tracking-tight text-[#0F172A]">
                Construtores
              </h3>
              <span className="text-xs font-semibold text-[#64748B] font-mono">Top 6</span>
            </div>

            {/* Tabela Compacta: POS | EQUIPE | PONTOS */}
            <div className="space-y-1 font-sans text-xs">
              <div className="grid grid-cols-12 px-2 py-1 text-[10px] uppercase font-bold text-[#64748B] border-b border-[#E2E8F0]">
                <span className="col-span-2">Pos</span>
                <span className="col-span-7">Equipe</span>
                <span className="col-span-3 text-right">Pts</span>
              </div>

              {constructorStandingsList.map((teamRow: any, idx: number) => {
                const tName = teamRow?.teamName || teamRow?.name || 'Equipe'
                const isUser =
                  (tName || '').toLowerCase().includes('audi') ||
                  (team?.name && tName === team.name) ||
                  teamRow?.position === constructorPosition

                return (
                  <div
                    key={teamRow.position || idx}
                    className={`grid grid-cols-12 items-center px-2 py-1.5 rounded-md transition-colors ${
                      isUser
                        ? 'bg-[#E10600]/10 border border-[#E10600]/30 font-bold text-[#0F172A]'
                        : 'text-[#334155] hover:bg-neutral-50'
                    }`}
                  >
                    <span className="col-span-2 font-mono text-[11px] font-bold text-[#64748B]">
                      {teamRow.position || idx + 1}º
                    </span>
                    <span className="col-span-7 truncate text-xs flex items-center gap-1.5">
                      {isUser && <span className="w-1.5 h-1.5 rounded-full bg-[#E10600]" />}
                      <span className="truncate">{tName}</span>
                    </span>
                    <span className="col-span-3 text-right font-mono font-bold text-xs">
                      {teamRow.points ?? 0}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-[#F1F5F9] text-center">
            <Link
              to="/standings"
              className="text-xs font-bold text-[#E10600] hover:text-[#B30500] inline-flex items-center gap-1"
            >
              <span>Ver Classificação Completa</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
