import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { OFFICIAL_GRID_TEAMS, getAICompetitors, ENGINE_SUPPLIERS } from '@/lib/f1-data'
import { calculateCombinedPace } from '@/lib/f1-pace-model'
import {
  simulateAiGridFiaStandings,
  normalizeEntityName,
  getFiaPointsForPosition,
} from '@/lib/f1-standings-calculator'
import { getCountryFlag } from '@/lib/country-flags'
import { AmbientBackground } from '@/components/AmbientBackground'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { DataTable, DataTableColumn } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { RivalComparisonSection } from '@/components/RivalComparisonSection'
import { DriverModel, PartModel, RaceResultModel, TeamModel } from '@/types/f1'
import { formatCurrency } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import alpineImg from '@/assets/alpine-88dda.png'
import astonMartinImg from '@/assets/astonmartin-eee41.png'
import audiImg from '@/assets/audi-13288.png'
import {
  Shield,
  Zap,
  Users,
  Trophy,
  Flag,
  Flame,
  Search,
  Camera,
  Loader2,
  Table as TableIcon,
  LayoutGrid,
  ChevronRight,
  Gauge,
  TrendingDown,
} from 'lucide-react'

// Mapa de fotos estáticas oficiais de monopostos 2026 por team_key
const TEAM_CAR_IMAGES: Record<string, string> = {
  alpine: alpineImg,
  astonmartin: astonMartinImg,
  audi: audiImg,
}

// Informações calculadas de construtores
interface TeamStandingSummary {
  position: number
  points: number
  wins: number
}

export interface GridDisplayTeam {
  key: string
  name: string
  color: string
  engine: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford' | 'Audi'
  strengthRating: number
  carLevel: number
  strengthVerdict: string
  budget: number
  historySummary: string
  currentSituation: string
  isUserTeam: boolean
  teamRecord?: TeamModel
  position: number
  points: number
  wins: number
  paceCombined: number
  paceVerdict: string
  driver1: {
    name: string
    speed: number
    consistency: number
    nationality: string
    flag: string
    age: number
  }
  driver2: {
    name: string
    speed: number
    consistency: number
    nationality: string
    flag: string
    age: number
  }
  reserveDriver?: {
    name: string
    speed: number
    consistency: number
    nationality: string
    flag: string
    age: number
  }
}

export default function TeamsPage() {
  const { team, season, refreshTeamAndSeason } = useAuth()
  const { toast } = useToast()
  const [raceResults, setRaceResults] = useState<RaceResultModel[]>([])
  const [playerDrivers, setPlayerDrivers] = useState<DriverModel[]>([])
  const [allDbTeams, setAllDbTeams] = useState<TeamModel[]>([])
  const [playerParts, setPlayerParts] = useState<PartModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [engineFilter, setEngineFilter] = useState<string>('todos')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [selectedTeam, setSelectedTeam] = useState<GridDisplayTeam | null>(null)
  const [uploadingTeamId, setUploadingTeamId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeUploadTeamRef = useRef<{
    teamRecord?: TeamModel
    teamKey: string
    teamName: string
    teamColor: string
    engineSupplier: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford' | 'Audi'
    strength: number
  } | null>(null)

  const loadData = async () => {
    if (!season || !team) {
      setLoading(false)
      return
    }
    try {
      const [rList, dList, teamsList, partsList] = await Promise.all([
        f1Service.getSeasonRaceResults(season.id),
        f1Service.getTeamDrivers(team.id),
        f1Service.getAllTeams(),
        f1Service.getTeamParts(team.id),
      ])
      setRaceResults(rList)
      setPlayerDrivers(dList)
      setAllDbTeams(teamsList)
      setPlayerParts(partsList)
    } catch (err) {
      console.error('Erro ao carregar dados do paddock:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [season?.id, team?.id])

  useRealtime('teams', () => {
    loadData()
  })
  useRealtime('race_results', () => {
    loadData()
  })
  useRealtime('parts', () => {
    loadData()
  })

  // Upload handler para foto lateral do carro de qualquer equipe do grid
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const targetTeam = activeUploadTeamRef.current
    if (!file || !targetTeam) return

    // Validar tipo e tamanho (máx 2MB)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Formato inválido',
        description: 'Por favor selecione uma imagem em formato JPEG, PNG ou WEBP.',
      })
      return
    }

    if (file.size > 2097152) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo da foto é de 2MB.',
      })
      return
    }

    const teamIdentifier = targetTeam.teamRecord?.id || targetTeam.teamKey
    try {
      setUploadingTeamId(teamIdentifier)
      const formData = new FormData()
      formData.append('photo', file)

      let updated: TeamModel

      if (targetTeam.teamRecord?.id) {
        // Se o registro já existe no DB
        updated = await f1Service.updateTeam(targetTeam.teamRecord.id, formData)
      } else {
        // Se for uma equipe oficial que ainda não possui linha no DB, criar primeiro com a foto
        formData.append('name', targetTeam.teamName)
        formData.append('color', targetTeam.teamColor)
        formData.append('engine_supplier', targetTeam.engineSupplier)
        formData.append('team_key', targetTeam.teamKey)
        formData.append('strength', String(targetTeam.strength))
        formData.append('budget', '150000000')
        formData.append('chassis_level', '50')
        formData.append('aero_level', '50')
        formData.append('strategy_level', '50')
        formData.append('is_custom', 'false')

        updated = await pb.collection('teams').create<TeamModel>(formData)
      }

      if (team?.id && (team.id === updated.id || team.team_key === updated.team_key)) {
        await refreshTeamAndSeason()
      }

      setAllDbTeams((prev) => {
        const exists = prev.some((t) => t.id === updated.id)
        if (exists) {
          return prev.map((t) => (t.id === updated.id ? updated : t))
        }
        return [...prev, updated]
      })

      // Se a equipe selecionada no modal for a atualizada, atualizar também
      setSelectedTeam((prev) => (prev ? { ...prev, teamRecord: updated } : null))

      toast({
        title: 'Foto do carro atualizada!',
        description: `A foto lateral do monoposto 2026 da ${targetTeam.teamName} foi salva com sucesso.`,
      })
    } catch (err: any) {
      console.error('Erro no upload da foto do carro:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar foto',
        description: err?.message || 'Falha ao processar o upload da imagem.',
      })
    } finally {
      setUploadingTeamId(null)
      activeUploadTeamRef.current = null
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const triggerUploadForTeam = (teamInfo: {
    teamRecord?: TeamModel
    teamKey: string
    teamName: string
    teamColor: string
    engineSupplier: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford' | 'Audi'
    strength: number
  }) => {
    activeUploadTeamRef.current = teamInfo
    fileInputRef.current?.click()
  }

  // Calcula a tabela de construtores da temporada atual para sabermos posição e pontos de cada equipe
  const constructorStandingsMap = useMemo(() => {
    const currentRound = season?.current_round || 1
    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const aiGrid = getAICompetitors(team?.team_key, isCustomTeam)

    const recordedRounds = new Set<number>()
    raceResults.forEach((r) => {
      if (typeof r.round === 'number') recordedRounds.add(r.round)
    })
    const hasRecordedResults = recordedRounds.size > 0
    const pastRoundsToSimulate = hasRecordedResults ? 0 : Math.max(0, currentRound - 1)

    const { teamStandingsMap: aiTeamStats } = simulateAiGridFiaStandings(
      team?.team_key,
      isCustomTeam,
      pastRoundsToSimulate,
    )

    const standings: Record<
      string,
      { name: string; points: number; wins: number; isPlayer: boolean; bestPosition: number }
    > = {}

    // Equipes rivais da IA
    aiGrid.forEach((aiTeam) => {
      const stat = aiTeamStats[aiTeam.id] || { points: 0, wins: 0, podiums: 0, bestPos: 99 }
      standings[aiTeam.id] = {
        name: aiTeam.name,
        points: stat.points,
        wins: stat.wins,
        bestPosition: stat.bestPos,
        isPlayer: false,
      }
    })

    // Se temos resultados gravados na collection race_results, somar os pontos reais das equipes rivais!
    if (hasRecordedResults) {
      raceResults.forEach((r) => {
        const isPlayerResult =
          r.team_id === team?.id || (r.expand?.team_id && r.expand.team_id.name === team?.name)
        if (!isPlayerResult && r.team_id) {
          const expTeam = (r.expand as any)?.team_id
          const teamNameNorm = expTeam?.name ? normalizeEntityName(expTeam.name) : ''
          const matchedAiTeam = aiGrid.find(
            (t) =>
              t.id === r.team_id || (teamNameNorm && normalizeEntityName(t.name) === teamNameNorm),
          )
          const targetKey = matchedAiTeam ? matchedAiTeam.id : r.team_id
          const pts =
            typeof r.points === 'number' && r.points > 0
              ? r.points
              : getFiaPointsForPosition(r.position)

          if (!standings[targetKey]) {
            standings[targetKey] = {
              name: expTeam?.name || 'Equipe Rival',
              points: 0,
              wins: 0,
              bestPosition: 99,
              isPlayer: false,
            }
          }
          standings[targetKey].points += pts
          if (r.position === 1) standings[targetKey].wins += 1
          if (r.position < standings[targetKey].bestPosition) {
            standings[targetKey].bestPosition = r.position
          }
        }
      })
    }

    // Equipe do jogador
    let playerPoints = 0
    let playerWins = 0
    let playerBestPos = 99
    raceResults.forEach((r) => {
      const isPlayerResult =
        r.team_id === team?.id || (r.expand?.team_id && r.expand.team_id.name === team?.name)
      if (isPlayerResult || !r.team_id) {
        const pts =
          typeof r.points === 'number' && r.points > 0
            ? r.points
            : getFiaPointsForPosition(r.position)
        playerPoints += pts
        if (r.position === 1) playerWins += 1
        if (r.position < playerBestPos) playerBestPos = r.position
      }
    })

    const playerTeamId = team?.id || 'player'
    standings[playerTeamId] = {
      name: team?.name || 'Escuderia Brasil',
      points: playerPoints,
      wins: playerWins,
      bestPosition: playerBestPos,
      isPlayer: true,
    }

    // Ordenar para extrair a posição oficial segundo regulamento FIA
    const sorted = Object.entries(standings).sort(([, a], [, b]) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.wins !== a.wins) return b.wins - a.wins
      if (a.bestPosition !== b.bestPosition) return a.bestPosition - b.bestPosition
      return a.name.localeCompare(b.name)
    })

    const resultMap: Record<string, TeamStandingSummary> = {}
    sorted.forEach(([id, data], index) => {
      resultMap[id] = {
        position: index + 1,
        points: data.points,
        wins: data.wins,
      }
      resultMap[data.name.toLowerCase()] = {
        position: index + 1,
        points: data.points,
        wins: data.wins,
      }
      resultMap[normalizeEntityName(data.name)] = {
        position: index + 1,
        points: data.points,
        wins: data.wins,
      }
    })

    return resultMap
  }, [season, team, raceResults])

  // Titulares e reserva da equipe do jogador
  const playerTitular1 = playerDrivers.filter((d) => d.role !== 'reserva')[0]
  const playerTitular2 = playerDrivers.filter((d) => d.role !== 'reserva')[1]
  const playerReserve = playerDrivers.find((d) => d.role === 'reserva')

  const getFlag = (nat?: string) => getCountryFlag(nat)

  const currentEngine = useMemo(() => {
    const sName = team?.engine_supplier || 'Mercedes'
    return ENGINE_SUPPLIERS.find((s) => s.name === sName) || ENGINE_SUPPLIERS[1]
  }, [team?.engine_supplier])

  const playerCarLevel = useMemo(() => {
    if (playerParts.length === 0) return 75
    const sum = playerParts.reduce((acc, p) => acc + p.level, 0)
    const sumCond = playerParts.reduce((acc, p) => acc + (p.condition ?? 100), 0)
    const avg = (sum / playerParts.length) * 10
    const avgCond = Math.round(sumCond / playerParts.length)

    let base = Math.round(avg * 0.6 + currentEngine.power * 0.4)
    if (avgCond < 60) {
      const pacePenalty = Math.round((60 - avgCond) * 0.25)
      base = Math.max(20, base - pacePenalty)
    }

    return team?.reserve_setup_bonus ? Math.min(100, base + 2) : base
  }, [playerParts, currentEngine, team?.reserve_setup_bonus])

  const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'

  // Combina lista completa para exibição com posições e métricas de ritmo
  const allDisplayTeams = useMemo<GridDisplayTeam[]>(() => {
    const list: GridDisplayTeam[] = []

    // Equipe customizada do jogador
    if (isCustomTeam && team) {
      const paceD1 = calculateCombinedPace({
        teamStrength: team.strength || 58,
        carLevel: playerCarLevel,
        driver: {
          speed: playerTitular1?.speed || 80,
          consistency: playerTitular1?.consistency || 80,
        },
      })
      const paceD2 = calculateCombinedPace({
        teamStrength: team.strength || 58,
        carLevel: playerCarLevel,
        driver: {
          speed: playerTitular2?.speed || 79,
          consistency: playerTitular2?.consistency || 78,
        },
      })
      const avgPace = Number(
        ((paceD1.combinedPerformance + paceD2.combinedPerformance) / 2).toFixed(1),
      )

      const standing = (team.id ? constructorStandingsMap[team.id] : null) ||
        constructorStandingsMap[team.name.toLowerCase()] || {
          position: 0,
          points: 0,
          wins: 0,
        }

      list.push({
        key: 'user_custom',
        name: team.name,
        color: team.color || '#E10600',
        engine: (team.engine_supplier as any) || 'Mercedes',
        strengthRating: Number(((team.strength || 58) / 10).toFixed(1)),
        carLevel: playerCarLevel,
        strengthVerdict: 'Sua Escuderia Própria // 12ª Equipe do Grid',
        budget: team.budget,
        historySummary: 'Equipe estreante sob seu comando direto na Fórmula 1 2026.',
        currentSituation:
          'Desenvolvendo infraestrutura, pacote aerodinâmico e gestão de motores para alcançar os líderes.',
        isUserTeam: true,
        teamRecord: team,
        position: standing.position,
        points: standing.points,
        wins: standing.wins,
        paceCombined: avgPace,
        paceVerdict: paceD1.paceVerdict,
        driver1: {
          name: playerTitular1?.name || 'Piloto 1',
          speed: playerTitular1?.speed || 80,
          consistency: playerTitular1?.consistency || 80,
          nationality: playerTitular1?.nationality || 'Brasil',
          flag: getFlag(playerTitular1?.nationality || 'Brasil'),
          age: playerTitular1?.age || 24,
        },
        driver2: {
          name: playerTitular2?.name || 'Piloto 2',
          speed: playerTitular2?.speed || 79,
          consistency: playerTitular2?.consistency || 78,
          nationality: playerTitular2?.nationality || 'Brasil',
          flag: getFlag(playerTitular2?.nationality || 'Brasil'),
          age: playerTitular2?.age || 25,
        },
        reserveDriver: playerReserve
          ? {
              name: playerReserve.name,
              speed: playerReserve.speed,
              consistency: playerReserve.consistency,
              nationality: playerReserve.nationality,
              flag: getFlag(playerReserve.nationality),
              age: playerReserve.age,
            }
          : undefined,
      })
    }

    // Equipes oficiais
    OFFICIAL_GRID_TEAMS.forEach((official) => {
      const isThisUserTeam =
        !isCustomTeam &&
        ((team?.team_key && team.team_key === official.key) ||
          (team?.name && team.name.toLowerCase() === official.name.toLowerCase()))

      const matchedDbTeam = isThisUserTeam
        ? team
        : allDbTeams.find(
            (dbT) =>
              (dbT.team_key && dbT.team_key === official.key) ||
              dbT.name.toLowerCase() === official.name.toLowerCase(),
          )

      const effStrengthRating =
        isThisUserTeam && team?.strength
          ? Number((team.strength / 10).toFixed(1))
          : official.strengthRating
      const effCarLevel = isThisUserTeam ? playerCarLevel : official.carLevel

      const d1 =
        isThisUserTeam && playerTitular1
          ? {
              name: playerTitular1.name,
              speed: playerTitular1.speed,
              consistency: playerTitular1.consistency,
              nationality: playerTitular1.nationality,
              flag: getFlag(playerTitular1.nationality),
              age: playerTitular1.age,
            }
          : official.driver1

      const d2 =
        isThisUserTeam && playerTitular2
          ? {
              name: playerTitular2.name,
              speed: playerTitular2.speed,
              consistency: playerTitular2.consistency,
              nationality: playerTitular2.nationality,
              flag: getFlag(playerTitular2.nationality),
              age: playerTitular2.age,
            }
          : official.driver2

      const rD =
        isThisUserTeam && playerReserve
          ? {
              name: playerReserve.name,
              speed: playerReserve.speed,
              consistency: playerReserve.consistency,
              nationality: playerReserve.nationality,
              flag: getFlag(playerReserve.nationality),
              age: playerReserve.age,
            }
          : official.reserveDriver

      const paceD1 = calculateCombinedPace({
        teamStrength: effStrengthRating * 10,
        carLevel: effCarLevel,
        driver: { speed: d1.speed, consistency: d1.consistency },
      })
      const paceD2 = calculateCombinedPace({
        teamStrength: effStrengthRating * 10,
        carLevel: effCarLevel,
        driver: { speed: d2.speed, consistency: d2.consistency },
      })
      const avgPace = Number(
        ((paceD1.combinedPerformance + paceD2.combinedPerformance) / 2).toFixed(1),
      )

      const standing = (isThisUserTeam && team?.id ? constructorStandingsMap[team.id] : null) ||
        constructorStandingsMap[official.name.toLowerCase()] ||
        constructorStandingsMap[official.key] || {
          position: 0,
          points: 0,
          wins: 0,
        }

      list.push({
        key: official.key,
        name: isThisUserTeam ? team?.name || official.name : official.name,
        color: isThisUserTeam ? team?.color || official.color : official.color,
        engine: isThisUserTeam
          ? (team?.engine_supplier as any) || official.engine
          : official.engine,
        strengthRating: effStrengthRating,
        carLevel: effCarLevel,
        strengthVerdict: official.strengthVerdict,
        budget: isThisUserTeam ? (team?.budget ?? official.budget) : official.budget,
        historySummary: official.historySummary,
        currentSituation: official.currentSituation,
        isUserTeam: isThisUserTeam,
        teamRecord: matchedDbTeam || (isThisUserTeam ? team : undefined),
        position: standing.position,
        points: standing.points,
        wins: standing.wins,
        paceCombined: avgPace,
        paceVerdict: paceD1.paceVerdict,
        driver1: d1,
        driver2: d2,
        reserveDriver: rD,
      })
    })

    // Ordenar a lista por posição de construtores (se houver) ou força
    return list.sort((a, b) => {
      if (a.position > 0 && b.position > 0) return a.position - b.position
      if (a.position > 0) return -1
      if (b.position > 0) return 1
      return b.strengthRating - a.strengthRating
    })
  }, [
    team,
    isCustomTeam,
    allDbTeams,
    playerTitular1,
    playerTitular2,
    playerReserve,
    playerCarLevel,
    constructorStandingsMap,
  ])

  // Filtragem por busca e por fornecedor de motor
  const filteredTeams = useMemo(() => {
    return allDisplayTeams.filter((t) => {
      const term = search.toLowerCase().trim()
      const matchesSearch =
        term === '' ||
        t.name.toLowerCase().includes(term) ||
        t.driver1.name.toLowerCase().includes(term) ||
        t.driver2.name.toLowerCase().includes(term) ||
        t.engine.toLowerCase().includes(term) ||
        t.strengthVerdict.toLowerCase().includes(term)

      const matchesEngine = engineFilter === 'todos' || t.engine === engineFilter

      return matchesSearch && matchesEngine
    })
  }, [allDisplayTeams, search, engineFilter])

  // Métricas reais dos KPIs do topo
  const kpiData = useMemo(() => {
    const totalTeams = allDisplayTeams.length
    const userTeam = allDisplayTeams.find((t) => t.isUserTeam)
    const leaderTeam = allDisplayTeams[0]

    const userPos = userTeam?.position || 0
    const userPoints = userTeam?.points || 0
    const leaderPoints = leaderTeam?.points || 0
    const gapToLeader = Math.max(0, leaderPoints - userPoints)

    return {
      totalTeams,
      userPos,
      userPoints,
      gapToLeader,
      leaderName: leaderTeam?.name || '—',
    }
  }, [allDisplayTeams])

  // Colunas da DataTable de construtores
  const columns = useMemo<DataTableColumn<GridDisplayTeam>[]>(() => {
    return [
      {
        key: 'position',
        header: 'Pos',
        align: 'center',
        width: '56px',
        render: (t) => (
          <span className="font-num font-bold text-xs text-[#F5F7FA]">
            {t.position > 0 ? `${t.position}º` : '—'}
          </span>
        ),
      },
      {
        key: 'name',
        header: 'Construtor',
        render: (t) => {
          return (
            <div className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-[11px] text-white shrink-0 shadow-sm"
                style={{ backgroundColor: t.color }}
              >
                {t.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-[#F5F7FA] truncate">{t.name}</span>
                  {t.isUserTeam && (
                    <Badge className="text-[9px] font-bold px-1.5 py-0 bg-[#E10600]/20 text-red-300 border border-[#E10600]/40">
                      SUA EQUIPE
                    </Badge>
                  )}
                </div>
                <span className="text-[11px] text-[#8B95A7] block truncate">
                  {t.strengthVerdict}
                </span>
              </div>
            </div>
          )
        },
      },
      {
        key: 'drivers',
        header: 'Pilotos Titulares',
        render: (t) => (
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-[#F5F7FA]">
              <span className="text-xs" title={t.driver1.nationality}>
                {t.driver1.flag}
              </span>
              <span className="truncate max-w-[110px]">{t.driver1.name.split(' ').pop()}</span>
            </span>
            <span className="text-[#1F2733]">•</span>
            <span className="inline-flex items-center gap-1 text-[#F5F7FA]">
              <span className="text-xs" title={t.driver2.nationality}>
                {t.driver2.flag}
              </span>
              <span className="truncate max-w-[110px]">{t.driver2.name.split(' ').pop()}</span>
            </span>
          </div>
        ),
      },
      {
        key: 'engine',
        header: 'Unidade de Potência',
        render: (t) => (
          <Badge
            variant="outline"
            className="text-[10px] border-[#1F2733] bg-[#0E131B] text-cyan-400 font-medium"
          >
            {t.engine}
          </Badge>
        ),
      },
      {
        key: 'strengthRating',
        header: 'Força / Ritmo',
        align: 'center',
        render: (t) => (
          <div className="flex items-center justify-center gap-1 text-xs">
            <span className="font-num font-bold text-amber-400">{t.strengthRating.toFixed(1)}</span>
            <span className="text-[10px] text-[#8B95A7]">/10</span>
            <span className="text-[10px] text-[#8B95A7] ml-1">({t.paceCombined})</span>
          </div>
        ),
      },
      {
        key: 'wins',
        header: 'Vitórias',
        align: 'right',
        isNumeric: true,
        width: '80px',
        render: (t) => (
          <span className="font-num text-xs text-[#8B95A7] font-medium">{t.wins}</span>
        ),
      },
      {
        key: 'points',
        header: 'Pontos',
        align: 'right',
        isNumeric: true,
        width: '90px',
        render: (t) => (
          <span className="font-num font-bold text-xs text-[#F5F7FA]">{t.points} pts</span>
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        width: '40px',
        render: () => <ChevronRight className="w-4 h-4 text-[#8B95A7] ml-auto" />,
      },
    ]
  }, [])

  return (
    <div className="relative space-y-8 animate-fade-in-up">
      <AmbientBackground />

      {/* Input oculto para upload de foto de monoposto */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handlePhotoUpload}
        disabled={uploadingTeamId !== null}
      />

      {/* PageHeader padrão Race Operations */}
      <PageHeader
        eyebrow={`RACE OPERATIONS // GRID ${season?.year || 2026}`}
        title={`Grid da Temporada ${season?.year || 2026}`}
        description={`As 11 construtoras da temporada ${season?.year || 2026}, hierarquia técnica oficial da FIA, unidades de potência, elenco de pilotos e posição no Mundial de Construtores.`}
        badge={
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-[#1F2733] bg-[#161D29] text-[#F5F7FA] text-xs font-medium"
            >
              Rodada {season?.current_round || 1} de 24
            </Badge>
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium"
            >
              {allDisplayTeams.length} Escuderias
            </Badge>
          </div>
        }
        actions={
          <div className="flex items-center gap-1 p-1 bg-[#11161F] border border-[#1F2733] rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-[#161D29] text-white font-semibold shadow-sm'
                  : 'text-[#8B95A7] hover:text-[#F5F7FA]'
              }`}
              title="Visualização em Tabela"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tabela</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'cards'
                  ? 'bg-[#161D29] text-white font-semibold shadow-sm'
                  : 'text-[#8B95A7] hover:text-[#F5F7FA]'
              }`}
              title="Visualização em Cards Detalhados"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>
        }
      />

      {/* Comparativo com Rivais Diretos & Média do Grid */}
      <div className="relative z-10">
        <RivalComparisonSection allTeams={allDisplayTeams} playerTeam={team} />
      </div>

      {/* KPIs do topo com StatCard baseados em dados reais */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          eyebrow="TOTAL DE CONSTRUTORAS"
          value={`${kpiData.totalTeams}`}
          subtext={`${kpiData.totalTeams * 2} monopostos homologados`}
          icon={Shield}
          iconColor="text-cyan-400"
          accentColor="#00A6FB"
        />

        <StatCard
          eyebrow="SUA POSIÇÃO NO MUNDIAL"
          value={kpiData.userPos > 0 ? `${kpiData.userPos}º Lugar` : '—'}
          subtext={
            team?.name
              ? `${team.name} • ${kpiData.userPoints} pts somados`
              : 'Aguardando classificação'
          }
          icon={Trophy}
          iconColor={kpiData.userPos === 1 ? 'text-amber-400' : 'text-[#E10600]'}
          accentColor="#E10600"
        />

        <StatCard
          eyebrow="GAP PARA O LÍDER"
          value={
            kpiData.userPos === 1
              ? 'Líder'
              : kpiData.gapToLeader > 0
                ? `${kpiData.gapToLeader} pts`
                : '0 pts'
          }
          subtext={`Líder atual: ${kpiData.leaderName}`}
          icon={TrendingDown}
          iconColor="text-amber-400"
          accentColor="#F59E0B"
        />

        <StatCard
          eyebrow="FORNECEDORES DE MOTOR"
          value="5 Fabricantes"
          subtext="Mercedes • Ferrari • Honda • Ford • Audi"
          icon={Zap}
          iconColor="text-emerald-400"
          accentColor="#10B981"
        />
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#11161F] border border-[#1F2733] p-3 rounded-xl text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A7]" />
          <input
            type="text"
            placeholder="Buscar escuderia, piloto ou fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0B0E14] border border-[#1F2733] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#E10600] placeholder:text-[#8B95A7]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#8B95A7] shrink-0 text-xs font-medium">Motor:</span>
          <div className="flex items-center gap-1 flex-wrap">
            {['todos', 'Mercedes', 'Ferrari', 'Honda', 'Ford', 'Audi'].map((eng) => (
              <button
                key={eng}
                type="button"
                onClick={() => setEngineFilter(eng)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                  engineFilter === eng
                    ? 'bg-[#E10600] text-white font-semibold'
                    : 'bg-[#0B0E14] text-[#8B95A7] hover:text-[#F5F7FA] border border-[#1F2733]'
                }`}
              >
                {eng === 'todos' ? 'Todos' : eng}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Conteúdo: Tabela ou Cards */}
      <div className="relative z-10">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full bg-[#11161F] rounded-xl" />
            <Skeleton className="h-16 w-full bg-[#11161F] rounded-xl" />
            <Skeleton className="h-16 w-full bg-[#11161F] rounded-xl" />
          </div>
        ) : filteredTeams.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="Nenhuma construtora encontrada"
            description="Tente ajustar os termos da busca ou selecione outro fornecedor de unidade de potência."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setEngineFilter('todos')
                }}
                className="border-[#1F2733] text-[#8B95A7] hover:text-[#F5F7FA] text-xs"
              >
                Limpar filtros
              </Button>
            }
          />
        ) : viewMode === 'table' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#8B95A7] px-1">
              <span>Clique em qualquer linha para abrir a ficha técnica completa da equipe.</span>
              <span className="font-num">{filteredTeams.length} escuderias exibidas</span>
            </div>
            <DataTable
              keyExtractor={(t) => t.key}
              data={filteredTeams}
              columns={columns}
              playerRowPredicate={(t) => t.isUserTeam}
              playerRowTeamColor={team?.color || '#E10600'}
              playerBadgeLabel="SUA EQUIPE"
              onRowClick={(row) => setSelectedTeam(row)}
            />
          </div>
        ) : (
          /* Visualização alternativa em Cards */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredTeams.map((t) => {
              const uploadedUrl = t.teamRecord?.photo
                ? pb.files.getUrl(t.teamRecord, t.teamRecord.photo)
                : null
              const teamKeyNormalized = (t.teamRecord?.team_key || t.key || '').toLowerCase().trim()
              const staticCarImg = TEAM_CAR_IMAGES[teamKeyNormalized] || null
              const carBannerSrc = uploadedUrl || staticCarImg
              const isThisTeamUploading = uploadingTeamId === (t.teamRecord?.id || t.key)

              return (
                <div
                  key={t.key}
                  className={`rounded-xl border overflow-hidden transition-all duration-150 ${
                    t.isUserTeam
                      ? 'bg-[#141A24] border-[#E10600]/60 ring-1 ring-[#E10600]/30 shadow-lg'
                      : 'bg-[#11161F] border-[#1F2733] hover:border-[#2C3849]'
                  }`}
                >
                  <div className="h-1 w-full" style={{ backgroundColor: t.color }} />

                  {/* Banner do Carro */}
                  <div className="relative w-full aspect-[16/9] max-h-48 bg-[#080B10] overflow-hidden border-b border-[#1F2733]">
                    {carBannerSrc ? (
                      <>
                        <img
                          src={carBannerSrc}
                          alt={`Carro F1 2026 - ${t.name}`}
                          className="w-full h-full object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14]/80 via-transparent to-[#0B0E14]/30 pointer-events-none" />
                        <div className="absolute bottom-2 left-3 flex items-center gap-2 text-[10px] text-[#F5F7FA]">
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ backgroundColor: t.color }}
                          />
                          <span className="font-semibold tracking-wide">
                            {uploadedUrl ? 'FOTO HOMOLOGADA' : 'LIVERY 2026'} //{' '}
                            {t.name.toUpperCase()}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 relative bg-gradient-to-b from-[#0e131b] to-[#070a0e]">
                        <div
                          className="absolute inset-0 opacity-15 pointer-events-none"
                          style={{
                            backgroundImage: `linear-gradient(to right, ${t.color}40 1px, transparent 1px), linear-gradient(to bottom, ${t.color}40 1px, transparent 1px)`,
                            backgroundSize: '24px 24px',
                          }}
                        />
                        <div className="absolute bottom-2 left-3 flex items-center gap-2 text-[10px] text-[#8B95A7]">
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ backgroundColor: t.color }}
                          />
                          <span>
                            F1 {season?.year || 2026} SPEC // {t.name.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="absolute top-2.5 right-2.5 z-10">
                      <button
                        type="button"
                        onClick={() =>
                          triggerUploadForTeam({
                            teamRecord: t.teamRecord,
                            teamKey: t.key,
                            teamName: t.name,
                            teamColor: t.color,
                            engineSupplier: t.engine,
                            strength: Math.round(t.strengthRating * 10),
                          })
                        }
                        disabled={uploadingTeamId !== null}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-[#0B0E14]/85 hover:bg-[#0B0E14] text-[#F5F7FA] border border-[#1F2733] shadow-md transition-all hover:border-cyan-400 disabled:opacity-60 cursor-pointer"
                        title={`Enviar ou trocar foto lateral do carro - ${t.name}`}
                      >
                        {isThisTeamUploading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{t.teamRecord?.photo ? 'Trocar Foto' : 'Foto'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Detalhes do Card */}
                  <div className="p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0"
                          style={{ backgroundColor: t.color }}
                        >
                          {t.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base text-[#F5F7FA]">{t.name}</h3>
                            {t.isUserTeam && (
                              <Badge className="text-[9px] font-bold px-1.5 py-0 bg-[#E10600]/20 text-red-300 border border-[#E10600]/40">
                                SUA EQUIPE
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-[#8B95A7]">
                            Motor <strong className="text-cyan-400">{t.engine}</strong> •{' '}
                            {formatCurrency(t.budget)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="eyebrow text-[10px]">Força</div>
                        <div className="font-num text-lg font-bold text-amber-400">
                          {t.strengthRating.toFixed(1)}
                          <span className="text-[10px] text-[#8B95A7] font-normal">/10</span>
                        </div>
                      </div>
                    </div>

                    {/* Resumo da Posição */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-[#0E131B] border border-[#1F2733] text-center text-xs">
                      <div>
                        <span className="text-[#8B95A7] block text-[10px]">Posição</span>
                        <strong className="font-num text-xs text-[#F5F7FA]">
                          {t.position > 0 ? `${t.position}º` : '—'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#8B95A7] block text-[10px]">Pontos</span>
                        <strong className="font-num text-xs text-cyan-400">{t.points} pts</strong>
                      </div>
                      <div>
                        <span className="text-[#8B95A7] block text-[10px]">Vitórias</span>
                        <strong className="font-num text-xs text-amber-400">{t.wins}</strong>
                      </div>
                    </div>

                    {/* Pilotos */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-[#0E131B] border border-[#1F2733] space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-emerald-400 font-semibold">#1 Titular</span>
                          <span>{t.driver1.flag}</span>
                        </div>
                        <div className="font-bold text-[#F5F7FA] truncate text-xs">
                          {t.driver1.name}
                        </div>
                        <div className="text-[10px] text-[#8B95A7] font-num">
                          Vel {t.driver1.speed} • Cons {t.driver1.consistency}
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-[#0E131B] border border-[#1F2733] space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-emerald-400 font-semibold">#2 Titular</span>
                          <span>{t.driver2.flag}</span>
                        </div>
                        <div className="font-bold text-[#F5F7FA] truncate text-xs">
                          {t.driver2.name}
                        </div>
                        <div className="text-[10px] text-[#8B95A7] font-num">
                          Vel {t.driver2.speed} • Cons {t.driver2.consistency}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTeam(t)}
                      className="w-full border-[#1F2733] bg-[#161D29] hover:bg-[#1f2733] text-[#F5F7FA] text-xs h-8"
                    >
                      Ver Ficha Técnica Completa
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal / Painel Elevado Camada 2: Detalhes da Construtora */}
      <Dialog open={!!selectedTeam} onOpenChange={(open) => !open && setSelectedTeam(null)}>
        <DialogContent className="bg-[#11161F] border border-[#1F2733] text-[#F5F7FA] sm:max-w-[620px] max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
          {selectedTeam && (
            <div className="space-y-5">
              {/* Header com cor da equipe */}
              <DialogHeader className="space-y-2">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-md"
                    style={{ backgroundColor: selectedTeam.color }}
                  >
                    {selectedTeam.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="eyebrow text-[#8B95A7]">FICHA TÉCNICA // CONSTRUTORA</div>
                    <DialogTitle className="text-xl font-bold text-[#F5F7FA] flex items-center gap-2">
                      <span>{selectedTeam.name}</span>
                      {selectedTeam.isUserTeam && (
                        <Badge className="text-[9px] font-bold px-1.5 py-0 bg-[#E10600]/20 text-red-300 border border-[#E10600]/40">
                          SUA EQUIPE
                        </Badge>
                      )}
                    </DialogTitle>
                  </div>
                </div>
                <DialogDescription className="text-xs text-[#8B95A7]">
                  {selectedTeam.strengthVerdict}
                </DialogDescription>
              </DialogHeader>

              {/* Banner do Carro no Modal */}
              {(() => {
                const uploadedUrl = selectedTeam.teamRecord?.photo
                  ? pb.files.getUrl(selectedTeam.teamRecord, selectedTeam.teamRecord.photo)
                  : null
                const teamKeyNormalized = (
                  selectedTeam.teamRecord?.team_key ||
                  selectedTeam.key ||
                  ''
                )
                  .toLowerCase()
                  .trim()
                const staticCarImg = TEAM_CAR_IMAGES[teamKeyNormalized] || null
                const carBannerSrc = uploadedUrl || staticCarImg
                const isThisTeamUploading =
                  uploadingTeamId === (selectedTeam.teamRecord?.id || selectedTeam.key)

                return (
                  <div className="relative w-full aspect-[16/9] max-h-52 bg-[#080B10] rounded-xl overflow-hidden border border-[#1F2733]">
                    {carBannerSrc ? (
                      <>
                        <img
                          src={carBannerSrc}
                          alt={`Monoposto - ${selectedTeam.name}`}
                          className="w-full h-full object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14]/80 via-transparent to-[#0B0E14]/30 pointer-events-none" />
                        <div className="absolute bottom-2 left-3 flex items-center gap-2 text-[10px] text-[#F5F7FA]">
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ backgroundColor: selectedTeam.color }}
                          />
                          <span className="font-semibold tracking-wide">
                            {uploadedUrl ? 'FOTO HOMOLOGADA' : 'LIVERY 2026'} //{' '}
                            {selectedTeam.name.toUpperCase()}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 relative bg-gradient-to-b from-[#0e131b] to-[#070a0e]">
                        <div
                          className="absolute inset-0 opacity-15 pointer-events-none"
                          style={{
                            backgroundImage: `linear-gradient(to right, ${selectedTeam.color}40 1px, transparent 1px), linear-gradient(to bottom, ${selectedTeam.color}40 1px, transparent 1px)`,
                            backgroundSize: '24px 24px',
                          }}
                        />
                        <div className="absolute bottom-2 left-3 flex items-center gap-2 text-[10px] text-[#8B95A7]">
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ backgroundColor: selectedTeam.color }}
                          />
                          <span>F1 2026 SPEC BLUEPRINT // {selectedTeam.name.toUpperCase()}</span>
                        </div>
                      </div>
                    )}

                    <div className="absolute top-2.5 right-2.5 z-10">
                      <button
                        type="button"
                        onClick={() =>
                          triggerUploadForTeam({
                            teamRecord: selectedTeam.teamRecord,
                            teamKey: selectedTeam.key,
                            teamName: selectedTeam.name,
                            teamColor: selectedTeam.color,
                            engineSupplier: selectedTeam.engine,
                            strength: Math.round(selectedTeam.strengthRating * 10),
                          })
                        }
                        disabled={uploadingTeamId !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0B0E14]/85 hover:bg-[#0B0E14] text-[#F5F7FA] border border-[#1F2733] shadow-md transition-all hover:border-cyan-400 disabled:opacity-60 cursor-pointer"
                      >
                        {isThisTeamUploading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-3.5 h-3.5 text-cyan-400" />
                            <span>
                              {selectedTeam.teamRecord?.photo ? 'Trocar Foto' : 'Foto do Carro'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* Quadro de Métricas em Camada 2 (#161D29) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-[#161D29] border border-[#1F2733] space-y-1">
                  <div className="eyebrow text-[10px]">Posição 2026</div>
                  <div className="font-num text-lg font-bold text-[#F5F7FA]">
                    {selectedTeam.position > 0 ? `${selectedTeam.position}º Lugar` : '—'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#161D29] border border-[#1F2733] space-y-1">
                  <div className="eyebrow text-[10px]">Pontuação</div>
                  <div className="font-num text-lg font-bold text-cyan-400">
                    {selectedTeam.points} pts
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#161D29] border border-[#1F2733] space-y-1">
                  <div className="eyebrow text-[10px]">Força Geral</div>
                  <div className="font-num text-lg font-bold text-amber-400">
                    {selectedTeam.strengthRating.toFixed(1)}/10
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#161D29] border border-[#1F2733] space-y-1">
                  <div className="eyebrow text-[10px]">Ritmo Combinado</div>
                  <div className="font-num text-lg font-bold text-emerald-400">
                    {selectedTeam.paceCombined}/100
                  </div>
                </div>
              </div>

              {/* Informações Técnicas e Orçamentárias */}
              <div className="p-4 rounded-xl bg-[#161D29] border border-[#1F2733] space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-[#1F2733]">
                  <span className="text-[#8B95A7]">Fornecedor de Unidade de Potência:</span>
                  <Badge
                    variant="outline"
                    className="border-[#1F2733] bg-[#0E131B] text-cyan-400 font-medium"
                  >
                    {selectedTeam.engine}
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#1F2733]">
                  <span className="text-[#8B95A7]">Orçamento Operacional:</span>
                  <span className="font-num font-semibold text-[#F5F7FA]">
                    {formatCurrency(selectedTeam.budget)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#8B95A7]">Veredito de Ritmo:</span>
                  <span className="font-medium text-emerald-400">{selectedTeam.paceVerdict}</span>
                </div>
              </div>

              {/* Elenco de Pilotos */}
              <div className="space-y-2">
                <div className="eyebrow text-[#8B95A7]">ELENCO DE PILOTOS</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {/* Titular 1 */}
                  <div className="p-3 rounded-xl bg-[#161D29] border border-[#1F2733] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-emerald-400 font-semibold uppercase">
                        #1 Titular
                      </span>
                      <span>{selectedTeam.driver1.flag}</span>
                    </div>
                    <div className="font-bold text-[#F5F7FA] truncate">
                      {selectedTeam.driver1.name}
                    </div>
                    <div className="text-[11px] text-[#8B95A7]">
                      {selectedTeam.driver1.age} anos
                    </div>
                    <div className="flex justify-between text-[11px] pt-1 border-t border-[#1F2733] font-num">
                      <span className="text-[#E10600]">Vel {selectedTeam.driver1.speed}</span>
                      <span className="text-cyan-400">Cons {selectedTeam.driver1.consistency}</span>
                    </div>
                  </div>

                  {/* Titular 2 */}
                  <div className="p-3 rounded-xl bg-[#161D29] border border-[#1F2733] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-emerald-400 font-semibold uppercase">
                        #2 Titular
                      </span>
                      <span>{selectedTeam.driver2.flag}</span>
                    </div>
                    <div className="font-bold text-[#F5F7FA] truncate">
                      {selectedTeam.driver2.name}
                    </div>
                    <div className="text-[11px] text-[#8B95A7]">
                      {selectedTeam.driver2.age} anos
                    </div>
                    <div className="flex justify-between text-[11px] pt-1 border-t border-[#1F2733] font-num">
                      <span className="text-[#E10600]">Vel {selectedTeam.driver2.speed}</span>
                      <span className="text-cyan-400">Cons {selectedTeam.driver2.consistency}</span>
                    </div>
                  </div>

                  {/* Piloto Reserva */}
                  <div className="p-3 rounded-xl bg-[#161D29] border border-[#1F2733] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-amber-400 font-semibold uppercase">
                        Reserva
                      </span>
                      <span>
                        {selectedTeam.reserveDriver ? selectedTeam.reserveDriver.flag : '—'}
                      </span>
                    </div>
                    <div className="font-bold text-[#F5F7FA] truncate">
                      {selectedTeam.reserveDriver?.name || 'Reserva a definir'}
                    </div>
                    <div className="text-[11px] text-[#8B95A7]">
                      {selectedTeam.reserveDriver
                        ? `${selectedTeam.reserveDriver.age} anos`
                        : 'Disponível'}
                    </div>
                    <div className="flex justify-between text-[11px] pt-1 border-t border-[#1F2733] font-num">
                      <span className="text-[#E10600]">
                        Vel {selectedTeam.reserveDriver?.speed || '—'}
                      </span>
                      <span className="text-cyan-400">
                        Cons {selectedTeam.reserveDriver?.consistency || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Situação e Histórico */}
              <div className="p-3 rounded-xl bg-[#0E131B] border border-[#1F2733] text-xs text-[#8B95A7] space-y-1 leading-relaxed">
                <span className="eyebrow text-[#8B95A7] block">SITUAÇÃO ATUAL</span>
                <p>"{selectedTeam.currentSituation}"</p>
                {selectedTeam.historySummary && (
                  <p className="text-[11px] pt-1 border-t border-[#1F2733]/60 text-[#8B95A7]/80">
                    {selectedTeam.historySummary}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
