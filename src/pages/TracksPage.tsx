import React, { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import { useAuth } from '@/contexts/AuthContext'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import {
  resolveCircuitProfile,
  CircuitPerformanceProfile,
  CircuitTechnicalWeights,
} from '@/data/circuit-performance-profiles'
import { calculateTrackFit } from '@/lib/car-session-performance-engine'
import { carTechnicalService } from '@/services/carTechnicalService'
import { OFFICIAL_TEAMS_TECHNICAL_DATA } from '@/lib/car-technical-data'
import { TECHNICAL_ATTRIBUTE_METAS, TechnicalAttributeId } from '@/types/car-technical-model'
import { AmbientBackground } from '@/components/AmbientBackground'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Search,
  Flag,
  MapPin,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ChevronRight,
  Gauge,
  ShieldAlert,
  Flame,
  Award,
  TrendingUp,
  Sliders,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'

// Ordem canônica dos 12 atributos para exibição consistente
const CANONICAL_ATTRIBUTE_ORDER: TechnicalAttributeId[] = [
  'fastCorner',
  'slowCorner',
  'mediumCorner',
  'topSpeed',
  'acceleration',
  'braking',
  'traction',
  'tyreManagement',
  'aeroEfficiency',
  'cooling',
  'weight',
  'reliability',
]

/**
 * Interpretação esportiva e qualitativa pt-BR do Track Fit
 */
function getTrackFitVerdict(score: number): {
  label: string
  color: string
  description: string
} {
  if (score >= 85) {
    return {
      label: 'Adequação Excelente',
      color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
      description: 'O conceito aero-mecânico do seu carro extrai máxima vantagem deste circuito.',
    }
  }
  if (score >= 70) {
    return {
      label: 'Adequação Favorável',
      color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',
      description: 'O monoposto se adapta bem às principais exigências do traçado.',
    }
  }
  if (score >= 55) {
    return {
      label: 'Adequação Média',
      color: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
      description: 'Equilíbrio neutro entre pontos fortes e limitações do pacote técnico.',
    }
  }
  return {
    label: 'Pista Desafiadora',
    color: 'text-rose-400 border-rose-500/40 bg-rose-500/10',
    description: 'As demandas dominantes da pista expõem as deficiências do seu carro.',
  }
}

/**
 * Tradução pt-BR do trackType canônico
 */
function getTrackTypeLabel(type: string): string {
  switch (type) {
    case 'permanente':
      return 'Circuito Permanente'
    case 'urbana':
      return 'Circuito de Rua'
    case 'hibrida_urbana':
      return 'Híbrido / Semi-Urbano'
    default:
      return type
  }
}

/**
 * Derivação puramente matemática das 3 maiores exigências baseada nos pesos canônicos reais
 */
function getDominantDemands(weights: CircuitTechnicalWeights): {
  id: TechnicalAttributeId
  name: string
  weight: number
  category: string
}[] {
  const list = (Object.keys(weights) as TechnicalAttributeId[]).map((attr) => ({
    id: attr,
    name: TECHNICAL_ATTRIBUTE_METAS[attr]?.name || attr,
    weight: weights[attr],
    category: TECHNICAL_ATTRIBUTE_METAS[attr]?.category || 'geral',
  }))
  list.sort((a, b) => b.weight - a.weight)
  return list.slice(0, 3)
}

export default function TracksPage() {
  const { circuitId } = useParams<{ circuitId?: string }>()
  const navigate = useNavigate()
  const { team: authTeam, season: authSeason } = useAuth()
  const {
    season: unifiedSeason,
    team: unifiedTeam,
    raceResults,
    loading: seasonLoading,
    currentRound,
  } = useUnifiedSeason()

  const activeSeason = unifiedSeason || authSeason
  const activeTeam = unifiedTeam || authTeam

  // Estados de busca e filtro para a grade
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'disputados' | 'a_disputar'>('todos')

  // Resolução dos atributos técnicos do jogador via carTechnicalService canônico
  const playerTechData = useMemo(() => {
    if (!activeTeam) return null
    // Se o time não tem dados e nem team_key básica, sinaliza indisponibilidade
    if (!activeTeam.technical_attributes && !activeTeam.team_key && !activeTeam.strength) {
      return null
    }
    return carTechnicalService.ensureTechnicalData(activeTeam)
  }, [activeTeam])

  // Cálculo da média do grid dos rivais IA via getOrCreateTeamTechnicalData canônico
  const rivalGridAverageAttributes = useMemo(() => {
    const rivalKeys = Object.keys(OFFICIAL_TEAMS_TECHNICAL_DATA)
    if (rivalKeys.length === 0) return null

    const accum: Record<TechnicalAttributeId, number> = {
      slowCorner: 0,
      mediumCorner: 0,
      fastCorner: 0,
      topSpeed: 0,
      acceleration: 0,
      braking: 0,
      traction: 0,
      tyreManagement: 0,
      aeroEfficiency: 0,
      cooling: 0,
      weight: 0,
      reliability: 0,
    }

    let count = 0
    rivalKeys.forEach((key) => {
      // Exclui a própria equipe do jogador caso ela coincida com uma oficial
      if (activeTeam?.team_key && activeTeam.team_key.toLowerCase() === key.toLowerCase()) {
        return
      }
      const data = carTechnicalService.getOrCreateTeamTechnicalData(key)
      if (data?.attributes) {
        CANONICAL_ATTRIBUTE_ORDER.forEach((attr) => {
          accum[attr] += data.attributes[attr] ?? 50
        })
        count++
      }
    })

    if (count === 0) return null

    const averages: Record<TechnicalAttributeId, number> = {} as any
    CANONICAL_ATTRIBUTE_ORDER.forEach((attr) => {
      averages[attr] = Number((accum[attr] / count).toFixed(2))
    })
    return averages
  }, [activeTeam?.team_key])

  // Mapa de resultados agregados por rodada (para o histórico)
  const resultsByRound = useMemo(() => {
    const map = new Map<
      number,
      {
        playerResults: typeof raceResults
        allResults: typeof raceResults
        playerPoints: number
        bestPlayerPos: number | null
      }
    >()

    raceResults.forEach((res) => {
      const r = res.round
      if (!map.has(r)) {
        map.set(r, {
          playerResults: [],
          allResults: [],
          playerPoints: 0,
          bestPlayerPos: null,
        })
      }
      const entry = map.get(r)!
      entry.allResults.push(res)

      const isPlayer =
        res.team_id === activeTeam?.id ||
        (res.expand?.team_id && res.expand.team_id.name === activeTeam?.name)

      if (isPlayer) {
        entry.playerResults.push(res)
        entry.playerPoints += res.points || 0
        if (res.position && (entry.bestPlayerPos === null || res.position < entry.bestPlayerPos)) {
          entry.bestPlayerPos = res.position
        }
      }
    })

    return map
  }, [raceResults, activeTeam])

  // Se circuitId estiver presente na URL, resolve o circuito selecionado
  const selectedCircuit = useMemo(() => {
    if (!circuitId) return null
    // Tenta por id direto ou numérico (round)
    const numericRound = parseInt(circuitId, 10)
    try {
      if (!isNaN(numericRound)) {
        const cal = F1_2026_CALENDAR.find((c) => c.round === numericRound)
        const prof = resolveCircuitProfile({ round: numericRound })
        return { cal, prof, round: numericRound }
      }
      const prof = resolveCircuitProfile({ circuitId })
      const cal = F1_2026_CALENDAR.find((c) => c.round === prof.round)
      return { cal, prof, round: prof.round }
    } catch {
      return null
    }
  }, [circuitId])

  // Filtragem dos GPs na grade
  const filteredGPs = useMemo(() => {
    return F1_2026_CALENDAR.filter((gp) => {
      const matchesSearch =
        search.trim() === '' ||
        gp.name.toLowerCase().includes(search.toLowerCase().trim()) ||
        gp.circuit.toLowerCase().includes(search.toLowerCase().trim()) ||
        gp.country.toLowerCase().includes(search.toLowerCase().trim())

      const isCompleted = resultsByRound.has(gp.round) || gp.round < currentRound
      const matchesStatus =
        filterStatus === 'todos' ||
        (filterStatus === 'disputados' && isCompleted) ||
        (filterStatus === 'a_disputar' && !isCompleted)

      return matchesSearch && matchesStatus
    })
  }, [search, filterStatus, resultsByRound, currentRound])

  // Renderização de loading
  if (seasonLoading && !activeSeason) {
    return (
      <div className="relative z-10 space-y-6 animate-fade-in-up pb-10">
        <AmbientBackground />
        <Skeleton className="h-20 w-full bg-[#11161F] rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-64 w-full bg-[#11161F] rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // =========================================================================
  // NÍVEL B — FICHA DETALHADA DO CIRCUITO (/pistas/:circuitId)
  // =========================================================================
  if (selectedCircuit) {
    const { cal, prof, round } = selectedCircuit
    const roundResults = resultsByRound.get(round)
    const isCompleted = !!roundResults || round < currentRound
    const isNext = round === currentRound

    // Track Fit do jogador
    const playerTrackFit = playerTechData
      ? calculateTrackFit(playerTechData.technical_attributes, prof)
      : null

    // Track Fit médio dos rivais
    const rivalAverageTrackFit = rivalGridAverageAttributes
      ? calculateTrackFit(rivalGridAverageAttributes, prof)
      : null

    const verdict = playerTrackFit ? getTrackFitVerdict(playerTrackFit.trackFitScore) : null
    const dominantDemands = getDominantDemands(prof.weights)

    return (
      <div className="relative z-10 space-y-6 animate-fade-in-up pb-12">
        <AmbientBackground />

        {/* Barra superior de navegação de volta */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/pistas')}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#11161F] border border-[#1F2733] text-[#F5F7FA] hover:bg-[#161D29] hover:border-[#00A6FB] transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar para todas as pistas</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[#8B95A7]">
              Etapa {round} de {F1_2026_CALENDAR.length}
            </span>
            {isNext && (
              <Badge className="bg-[#E10600] text-white border-none font-mono text-[10px] font-bold uppercase tracking-wider animate-pulse">
                Próxima Corrida
              </Badge>
            )}
            {isCompleted && (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-mono text-[10px]">
                Disputado
              </Badge>
            )}
          </div>
        </div>

        {/* Cabeçalho da Ficha */}
        <div className="p-6 rounded-2xl bg-[#0D121A] border border-[#1C2533] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#00A6FB]/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <span
                  className="text-3xl leading-none"
                  role="img"
                  aria-label={cal?.country || prof.country}
                >
                  {cal?.flag || '🏁'}
                </span>
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-400">
                  {prof.country} // {prof.locationName}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono bg-[#141B26] border-[#222E40] text-[#94A3B8]"
                >
                  {getTrackTypeLabel(prof.trackType)}
                </Badge>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {prof.grandPrixName}
              </h1>
              <p className="text-xs sm:text-sm text-[#8B95A7] flex items-center gap-1.5 mt-1">
                <MapPin className="w-4 h-4 text-[#00A6FB] shrink-0" />
                <span className="font-medium text-[#CBD5E1]">{prof.circuitName}</span>
                <span className="text-[#475569]">•</span>
                <span className="font-mono text-[#94A3B8]">
                  {prof.startDate} – {prof.endDate}
                </span>
                {prof.hasSprint && (
                  <>
                    <span className="text-[#475569]">•</span>
                    <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[9px] font-mono uppercase">
                      Sprint F1
                    </Badge>
                  </>
                )}
              </p>
            </div>

            {/* Selo do Cluster Canônico */}
            <div className="flex flex-col items-start md:items-end justify-center shrink-0 p-3.5 rounded-xl bg-[#121824] border border-[#1F2B3D]">
              <span className="text-[10px] font-mono text-[#8B95A7] uppercase tracking-wider block">
                Cluster Técnico FIA
              </span>
              <span className="text-sm font-extrabold text-white mt-0.5">{prof.clusterLabel}</span>
              <span className="text-[10px] font-mono text-cyan-400/90 mt-0.5">
                Chave: {prof.cluster}
              </span>
            </div>
          </div>
        </div>

        {/* Grid Principal: 2 Colunas (Track Fit & Métricas / Perfil 12 Atributos) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna Esquerda (5 colunas): Track Fit do Carro + Características + Histórico */}
          <div className="lg:col-span-5 space-y-6">
            {/* Bloco: TRACK FIT CANÔNICO */}
            <Card className="bg-[#0D121A] border-[#1C2533] p-5 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#1A2433] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                    Track Fit do Seu Carro
                  </h3>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-[#64748B] hover:text-white transition-colors"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-[#141B26] border-[#222E40] text-xs max-w-xs text-[#CBD5E1]">
                      Calculado pela função canônica <code>calculateTrackFit()</code> ponderando os
                      12 atributos técnicos do seu monoposto contra os pesos do circuito (100%).
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {playerTrackFit && playerTechData ? (
                <div className="space-y-4">
                  {/* Score Grande + Veredito */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#121824] border border-[#1F2B3D]">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B95A7] block">
                        Índice de Adequação
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-3xl font-black font-mono text-white">
                          {playerTrackFit.trackFitScore.toFixed(1)}
                        </span>
                        <span className="text-xs font-mono text-[#64748B]">/ 100</span>
                      </div>
                    </div>
                    {verdict && (
                      <Badge
                        className={`px-2.5 py-1 text-xs font-mono font-bold border ${verdict.color}`}
                      >
                        {verdict.label}
                      </Badge>
                    )}
                  </div>

                  {verdict && (
                    <p className="text-xs text-[#94A3B8] leading-relaxed">{verdict.description}</p>
                  )}

                  {/* Comparativo leve: Jogador vs Média dos Rivais IA */}
                  {rivalAverageTrackFit && (
                    <div className="p-3.5 rounded-xl bg-[#090D14] border border-[#1A2333] space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[#8B95A7]">Seu Carro</span>
                        <span className="font-bold text-white">
                          {playerTrackFit.trackFitScore.toFixed(1)}
                        </span>
                      </div>
                      <Progress
                        value={playerTrackFit.trackFitScore}
                        className="h-1.5 bg-[#161D29]"
                      />

                      <div className="flex items-center justify-between text-xs font-mono pt-1">
                        <span className="text-[#8B95A7]">Média do Grid (IA)</span>
                        <span className="font-bold text-neutral-400">
                          {rivalAverageTrackFit.trackFitScore.toFixed(1)}
                        </span>
                      </div>
                      <Progress
                        value={rivalAverageTrackFit.trackFitScore}
                        className="h-1.5 bg-[#161D29]"
                      />

                      <div className="pt-1 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-[#64748B]">Diferencial Competitivo:</span>
                        <span
                          className={`font-bold ${
                            playerTrackFit.trackFitScore >= rivalAverageTrackFit.trackFitScore
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {playerTrackFit.trackFitScore >= rivalAverageTrackFit.trackFitScore
                            ? '+'
                            : ''}
                          {(
                            playerTrackFit.trackFitScore - rivalAverageTrackFit.trackFitScore
                          ).toFixed(1)}{' '}
                          pts
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Principal Vantagem Identificada pelo Engine */}
                  <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-800/30 flex items-start gap-2.5 text-xs">
                    <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-cyan-300 block">
                        Maior Alavancagem nesta Pista
                      </span>
                      <span className="text-[#94A3B8] text-[11px] mt-0.5 block">
                        <strong>
                          {TECHNICAL_ATTRIBUTE_METAS[playerTrackFit.topAttributeAdvantage.attribute]
                            ?.name || playerTrackFit.topAttributeAdvantage.attribute}
                        </strong>{' '}
                        (Peso {playerTrackFit.topAttributeAdvantage.weight}% • Nível do seu carro:{' '}
                        {playerTrackFit.topAttributeAdvantage.value.toFixed(0)})
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Caso o save não tenha technical_attributes */
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-600/30 text-center space-y-2">
                  <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                  <h4 className="text-xs font-mono font-bold text-amber-300 uppercase">
                    Dados técnicos não disponíveis
                  </h4>
                  <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                    Não foi possível carregar os atributos técnicos do carro para este save. Nenhum
                    valor simulado ou fictício foi injetado nesta interface.
                  </p>
                </div>
              )}
            </Card>

            {/* Bloco: CARACTERÍSTICAS & PARÂMETROS AUXILIARES CANÔNICOS */}
            <Card className="bg-[#0D121A] border-[#1C2533] p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-[#1A2433] pb-3">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  Características Canônicas
                </h3>
              </div>

              {/* Métricas do Calendário Oficial */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-[#121824] border border-[#1F2B3D]">
                  <span className="text-[10px] text-[#8B95A7] block uppercase">Nº de Voltas</span>
                  <span className="text-lg font-black text-white block mt-0.5">
                    {cal?.laps ? `${cal.laps} voltas` : '—'}
                  </span>
                  <span className="text-[10px] text-cyan-400/90 block mt-0.5">
                    {cal ? `~${Math.round(cal.laps * cal.circuitLengthKm)} km de prova` : '—'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#121824] border border-[#1F2B3D]">
                  <span className="text-[10px] text-[#8B95A7] block uppercase">Extensão</span>
                  <span className="text-lg font-black text-cyan-400 block mt-0.5">
                    {cal?.circuitLengthKm ? `${cal.circuitLengthKm.toFixed(3)} km` : '—'}
                  </span>
                  <span className="text-[10px] text-[#8B95A7] block mt-0.5">
                    {cal?.turns ? `${cal.turns} curvas homologadas` : '—'}
                  </span>
                </div>
              </div>

              {/* 4 Métricas do Auxiliary Canônico da Planilha */}
              <div className="grid grid-cols-2 gap-3 pt-1 text-xs font-mono">
                <div className="p-3 rounded-xl bg-[#121824] border border-[#1F2B3D]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#8B95A7] uppercase">Severidade Pneus</span>
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-base font-bold text-amber-400 block mt-1">
                    {prof.auxiliary.tyreSeverity} / 100
                  </span>
                  <Progress value={prof.auxiliary.tyreSeverity} className="h-1 bg-[#1A2433] mt-2" />
                </div>

                <div className="p-3 rounded-xl bg-[#121824] border border-[#1F2B3D]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#8B95A7] uppercase">Dif. Ultrapassagem</span>
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <span className="text-base font-bold text-rose-400 block mt-1">
                    {prof.auxiliary.overtakingDifficulty} / 100
                  </span>
                  <Progress
                    value={prof.auxiliary.overtakingDifficulty}
                    className="h-1 bg-[#1A2433] mt-2"
                  />
                </div>

                <div className="p-3 rounded-xl bg-[#121824] border border-[#1F2B3D]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#8B95A7] uppercase">Desafio Piloto</span>
                    <Award className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <span className="text-base font-bold text-cyan-400 block mt-1">
                    {prof.auxiliary.driverChallenge} / 100
                  </span>
                  <Progress
                    value={prof.auxiliary.driverChallenge}
                    className="h-1 bg-[#1A2433] mt-2"
                  />
                </div>

                <div className="p-3 rounded-xl bg-[#121824] border border-[#1F2B3D]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#8B95A7] uppercase">Prob. Safety Car</span>
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-base font-bold text-emerald-400 block mt-1">
                    {prof.auxiliary.safetyCarProbability}%
                  </span>
                  <Progress
                    value={prof.auxiliary.safetyCarProbability}
                    className="h-1 bg-[#1A2433] mt-2"
                  />
                </div>
              </div>

              {/* Característica textual do calendário */}
              {cal?.characteristic && (
                <div className="p-3 rounded-lg bg-[#090D14] border border-[#1A2333] text-xs">
                  <span className="text-[#8B95A7] font-mono text-[10px] uppercase block">
                    Diretriz Esportiva Canônica:
                  </span>
                  <p className="text-[#CBD5E1] font-medium mt-0.5 leading-relaxed">
                    {cal.characteristic}
                  </p>
                </div>
              )}
            </Card>

            {/* Bloco: HISTÓRICO NESTE SAVE */}
            <Card className="bg-[#0D121A] border-[#1C2533] p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#1A2433] pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                    Histórico Neste Save
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-[#8B95A7]">
                  Temporada {activeSeason?.year || 2026}
                </span>
              </div>

              {isCompleted && roundResults && roundResults.playerResults.length > 0 ? (
                <div className="space-y-2.5 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-[#121824] border border-[#1F2B3D] flex items-center justify-between">
                    <span className="text-[#8B95A7]">Melhor Resultado:</span>
                    <span className="font-bold text-emerald-400 text-sm">
                      {roundResults.bestPlayerPos ? `P${roundResults.bestPlayerPos}` : '—'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#121824] border border-[#1F2B3D] flex items-center justify-between">
                    <span className="text-[#8B95A7]">Pontos da Equipe:</span>
                    <span className="font-bold text-white text-sm">
                      {roundResults.playerPoints} pts
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#121824] border border-[#1F2B3D] flex items-center justify-between">
                    <span className="text-[#8B95A7]">Pilotos Classificados:</span>
                    <span className="font-bold text-cyan-400">
                      {roundResults.playerResults.length} piloto(s)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#090D14] border border-[#1A2333] text-center text-xs font-mono text-[#64748B]">
                  Nenhum resultado registrado para esta etapa neste save.
                  <span className="block text-white font-bold text-sm mt-1">—</span>
                </div>
              )}
            </Card>
          </div>

          {/* Coluna Direita (7 colunas): Perfil Canônico em Barras (12 Dimensões) + Exigências Dominantes */}
          <div className="lg:col-span-7 space-y-6">
            {/* Bloco: 3 EXIGÊNCIAS DOMINANTES (Top 3 pesos) */}
            <Card className="bg-[#0D121A] border-[#1C2533] p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#1A2433] pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                    Exigências Dominantes do Circuito
                  </h3>
                </div>
                <Badge
                  variant="outline"
                  className="text-[9px] font-mono bg-cyan-950/40 border-cyan-800/40 text-cyan-300"
                >
                  Top 3 Fatores Críticos
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {dominantDemands.map((demand, idx) => (
                  <div
                    key={demand.id}
                    className="p-3.5 rounded-xl bg-[#121824] border border-[#1F2B3D] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#8B95A7] uppercase">
                        <span>Fator #{idx + 1}</span>
                        <span className="text-cyan-400 font-bold">{demand.weight}% peso</span>
                      </div>
                      <h4 className="text-sm font-extrabold text-white mt-1">{demand.name}</h4>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] mt-2 leading-relaxed">
                      {TECHNICAL_ATTRIBUTE_METAS[demand.id]?.description || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Bloco: OS 12 PESOS TÉCNICOS CANÔNICOS EM BARRAS */}
            <Card className="bg-[#0D121A] border-[#1C2533] p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#1A2433] pb-3">
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                    Perfil Canônico da Pista (12 Dimensões)
                  </h3>
                  <span className="text-[10px] font-mono text-[#8B95A7] block mt-0.5">
                    Fonte: <code>resolveCircuitProfile({`{ round: ${round} }`})</code> • Soma = 100%
                  </span>
                </div>
                <Badge className="bg-[#141B26] border border-[#222E40] text-cyan-400 font-mono text-xs font-bold">
                  Σ = {Object.values(prof.weights).reduce((a, b) => a + b, 0)}%
                </Badge>
              </div>

              {/* Lista dos 12 atributos com barras normalizadas */}
              <div className="space-y-3 pt-1">
                {CANONICAL_ATTRIBUTE_ORDER.map((attrKey) => {
                  const meta = TECHNICAL_ATTRIBUTE_METAS[attrKey]
                  const weightVal = prof.weights[attrKey]
                  // Máximo peso na planilha é ~15%, normalizamos para 100% da barra relativa (peso / 15 * 100)
                  const barPercent = Math.min(100, (weightVal / 15) * 100)

                  // Cor dinâmica por peso: >10% muito alto (cyan), >7% médio-alto (azul), menor (neutro)
                  const isTopDemand = weightVal >= 10
                  const isMediumDemand = weightVal >= 8

                  return (
                    <div
                      key={attrKey}
                      className="p-2.5 rounded-lg bg-[#111722] border border-[#1A2333] hover:border-[#26354D] transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold ${
                              isTopDemand ? 'text-white' : 'text-[#CBD5E1]'
                            }`}
                          >
                            {meta?.name || attrKey}
                          </span>
                          {isTopDemand && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                              Dominante
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {playerTechData && (
                            <span className="text-[10px] text-[#64748B]">
                              Carro:{' '}
                              {playerTechData.technical_attributes[attrKey]?.toFixed(0) ?? '—'}
                            </span>
                          )}
                          <span
                            className={`font-bold ${
                              isTopDemand
                                ? 'text-cyan-400 font-mono'
                                : isMediumDemand
                                  ? 'text-blue-300 font-mono'
                                  : 'text-neutral-400 font-mono'
                            }`}
                          >
                            {weightVal}%
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-[#080B10] h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isTopDemand
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
                              : isMediumDemand
                                ? 'bg-blue-500/80'
                                : 'bg-slate-600'
                          }`}
                          style={{ width: `${barPercent}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Rodapé com notas de fonte canônica */}
              {prof.sourceNotes && (
                <div className="pt-2 border-t border-[#1A2433] text-[10px] font-mono text-[#64748B]">
                  Notas do Regulamento FIA: {prof.sourceNotes}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // NÍVEL A — GRADE DOS 24 CIRCUITOS (/pistas)
  // =========================================================================
  return (
    <div className="relative z-10 space-y-6 animate-fade-in-up pb-12">
      <AmbientBackground />

      {/* PageHeader oficial da Fundação Canônica */}
      <PageHeader
        eyebrow={`CALENDÁRIO & ENGENHARIA // F1 ${activeSeason?.year || 2026}`}
        title="Circuitos da Temporada"
        description="Os 24 circuitos oficiais do campeonato mundial de Fórmula 1. Perfis técnicos data-driven de 12 dimensões, exigências dinâmicas e cálculo de Track Fit do monoposto."
        badge={
          <span className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-[#11161F] border border-[#1F2733] text-cyan-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            Rodada {currentRound}/24
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-[#11161F] border border-[#1F2733] text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {Math.max(0, currentRound - 1)} Disputadas
            </span>
          </div>
        }
      />

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#11161F] border border-[#1F2733] p-3 rounded-xl text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A7]" />
          <input
            type="text"
            placeholder="Buscar por GP, circuito ou país..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0B0E14] border border-[#1F2733] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-cyan-500 placeholder:text-[#8B95A7]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#8B95A7] text-[11px] uppercase tracking-wider font-semibold shrink-0">
            Filtro:
          </span>
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0E131B] border border-[#1F2733]">
            {[
              { id: 'todos', label: 'Todos (24)' },
              { id: 'disputados', label: 'Disputados' },
              { id: 'a_disputar', label: 'A Disputar' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setFilterStatus(st.id as any)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  filterStatus === st.id
                    ? 'bg-[#161D29] text-white font-bold border border-[#1F2733] shadow-sm'
                    : 'text-[#8B95A7] hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grade com os 24 GPs (responsiva: 1 col mobile, 2 tablet, 3-4 desktop) */}
      {filteredGPs.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Nenhum circuito encontrado"
          description="Nenhuma pista corresponde aos filtros aplicados. Tente limpar os termos de busca."
          action={
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setFilterStatus('todos')
              }}
              className="text-xs text-cyan-400 hover:underline cursor-pointer font-medium"
            >
              Limpar filtros
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredGPs.map((gp) => {
            const isCurrent = gp.round === currentRound
            const roundResults = resultsByRound.get(gp.round)
            const isCompleted = !!roundResults || gp.round < currentRound

            // Resolução canônica do perfil do circuito
            const profile = resolveCircuitProfile({ round: gp.round })

            // Track Fit pré-calculado com o carro do jogador se disponível
            const trackFit = playerTechData
              ? calculateTrackFit(playerTechData.technical_attributes, profile)
              : null

            return (
              <div
                key={gp.round}
                onClick={() => navigate(`/pistas/${profile.id}`)}
                className={`group cursor-pointer rounded-xl border p-4 transition-all duration-200 flex flex-col justify-between hover:shadow-xl hover:-translate-y-0.5 ${
                  isCurrent
                    ? 'bg-[#121824] border-[#E10600] shadow-lg ring-1 ring-[#E10600]/40'
                    : isCompleted
                      ? 'bg-[#0E131C] border-[#1C2533] hover:border-[#2C3B52]'
                      : 'bg-[#0C1017] border-[#18212D] hover:border-[#253347]'
                }`}
              >
                <div>
                  {/* Topo do Card: Bandeira + Rodada + Selo de Status */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl leading-none" role="img" aria-label={gp.country}>
                        {gp.flag}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#8B95A7]">
                        R{gp.round.toString().padStart(2, '0')}/24
                      </span>
                    </div>

                    {isCurrent ? (
                      <Badge className="bg-[#E10600] text-white border-none font-mono text-[10px] font-black uppercase tracking-wider animate-pulse">
                        Próxima Corrida
                      </Badge>
                    ) : isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Disputado
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-[#64748B]">A Disputar</span>
                    )}
                  </div>

                  {/* Nome do GP e Circuito */}
                  <h3 className="text-base font-bold text-white tracking-tight group-hover:text-cyan-400 transition-colors line-clamp-1">
                    {gp.name}
                  </h3>
                  <p className="text-xs text-[#8B95A7] flex items-center gap-1 mt-0.5 line-clamp-1">
                    <MapPin className="w-3 h-3 shrink-0 text-cyan-500" />
                    <span>{gp.circuit}</span>
                  </p>

                  {/* Cluster e Características Físicas */}
                  <div className="mt-3 pt-3 border-t border-[#1C2533]/80 space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B] text-[11px]">Tipo de Pista:</span>
                      <span className="text-[#CBD5E1] font-medium text-[11px]">
                        {getTrackTypeLabel(profile.trackType)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B] text-[11px]">Voltas / Extensão:</span>
                      <span className="text-white font-medium text-[11px]">
                        {gp.laps}v • {gp.circuitLengthKm.toFixed(2)} km
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B] text-[11px]">Cluster FIA:</span>
                      <span className="text-cyan-400 font-medium text-[11px] truncate max-w-[130px] text-right">
                        {profile.clusterLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rodapé do Card: Track Fit do Carro do Jogador */}
                <div className="mt-4 pt-3 border-t border-[#1C2533]/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-wider text-[#8B95A7] block">
                        Track Fit do Monoposto
                      </span>
                      {trackFit ? (
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-base font-black font-mono text-white">
                            {trackFit.trackFitScore.toFixed(1)}
                          </span>
                          <span className="text-[10px] font-mono text-[#64748B]">/100</span>
                        </div>
                      ) : (
                        <span className="text-xs font-mono text-[#64748B] mt-0.5 block">—</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs font-medium text-cyan-400 group-hover:translate-x-0.5 transition-transform">
                      <span className="text-[11px]">Ver Ficha</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
