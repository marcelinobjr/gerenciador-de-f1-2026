import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { standingsService } from '@/services/standingsService'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { DriverModel, TeamModel, RaceResultModel, PartModel } from '@/types/f1'
import { ALL_GRID_TEAMS_DATABASE, OFFICIAL_2026_GRID_KEYS } from '@/lib/grid-teams-database'
import { getCountryFlag } from '@/lib/country-flags'
import { formatCurrency } from '@/lib/formatters'
import { getTeamLogoUrl } from '@/lib/lobby-assets'
import { getCarroPorEquipeImage } from '@/assets/carroPorEquipe'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'
import { AmbientBackground } from '@/components/AmbientBackground'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ProgressBar } from '@/components/ProgressBar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Users,
  Shield,
  Search,
  ArrowUpDown,
  Trophy,
  Flame,
  Zap,
  TrendingUp,
  DollarSign,
  Briefcase,
  GitCompare,
  ChevronRight,
  Info,
  CheckCircle2,
  Calendar,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'

export interface PaddockTeamItem {
  id: string
  key: string
  name: string
  shortName: string
  color: string
  engine: string
  country: string
  flag: string
  position: number
  points: number
  wins: number
  strengthRating: number
  budget: number
  historySummary: string
  currentSituation: string
  isUserTeam: boolean
  inCurrentGrid: boolean // true = no campeonato atual de 2026; false = fora do grid
  headquarters: string
  category: string
  difficulty: string
  boardPressure: string
  carRating: number
  engineeringRating: number
  infrastructureRating: number
  operationsRating: number
  financesRating: number
  prestigeRating: number
  cultureRating: number
  potentialRating: number
  specialTraits: string[]
  carImageUrl: string
  driver1?: {
    name: string
    flag: string
    speed: number
    consistency: number
    nationality: string
  }
  driver2?: {
    name: string
    flag: string
    speed: number
    consistency: number
    nationality: string
  }
  reserveDriver?: {
    name: string
    flag: string
    speed: number
    consistency: number
    nationality: string
  }
  logoUrl?: string
}

export interface PaddockDriverItem {
  id: string
  name: string
  nationality: string
  flag: string
  age: number
  role: 'titular' | 'reserva' | 'livre' | 'test_driver' | 'academia'
  teamName: string
  teamColor: string
  teamId?: string
  salary: number
  contractEnd?: string
  speed: number
  consistency: number
  morale: number
  physical: number
  points: number
  wins: number
  podiums: number
  position: number
  isUserDriver: boolean
  licenseStatus?: 'nivel_c' | 'nivel_b' | 'nivel_a'
  isAcademy?: boolean
  isTestDriver?: boolean
  homologationStatus?: string
  technicalFeedback?: number
  seatSecurity?: number
}

export default function PaddockPage() {
  const { team, season, refreshTeamAndSeason } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'equipes' | 'pilotos' | 'mercado' | 'comparacao'>(
    'equipes',
  )
  const [loading, setLoading] = useState(true)

  // Dados do DB
  const [dbDrivers, setDbDrivers] = useState<DriverModel[]>([])
  const [dbTeams, setDbTeams] = useState<TeamModel[]>([])
  const [dbRaceResults, setDbRaceResults] = useState<RaceResultModel[]>([])

  // Busca e Filtros - Filtros da Regra 13 do PDF:
  // Titular, Reserva, Piloto de Teste, Academia, Em Homologação, Licença Provisória, Super Licença, Agente Livre
  const [searchQuery, setSearchQuery] = useState('')
  const [engineFilter, setEngineFilter] = useState('todos')
  const [roleFilter, setRoleFilter] = useState<
    | 'todos'
    | 'titular'
    | 'reserva'
    | 'test_driver'
    | 'academia'
    | 'homologacao'
    | 'licenca_provisoria'
    | 'super_licenca'
    | 'livre'
  >('todos')

  // Modais de detalhe simples
  const [selectedTeamDetail, setSelectedTeamDetail] = useState<PaddockTeamItem | null>(null)
  const [selectedDriverDetail, setSelectedDriverDetail] = useState<PaddockDriverItem | null>(null)

  // Comparação
  const [compareType, setCompareType] = useState<'equipes' | 'pilotos'>('equipes')
  const [compareItemA, setCompareItemA] = useState<string>('')
  const [compareItemB, setCompareItemB] = useState<string>('')

  // Carregar dados reais do save
  const loadPaddockData = async () => {
    if (!season?.id) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const [allDrv, allTms, allRes] = await Promise.all([
        f1Service.getAllDrivers().catch(() => []),
        f1Service.getAllTeams().catch(() => []),
        f1Service.getSeasonRaceResults(season.id).catch(() => []),
      ])
      setDbDrivers(allDrv)
      setDbTeams(allTms)
      setDbRaceResults(allRes)
    } catch (err) {
      console.error('Erro ao carregar dados do Paddock:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPaddockData()
  }, [season?.id, team?.id])

  useRealtime('drivers', () => loadPaddockData())
  useRealtime('teams', () => loadPaddockData())
  useRealtime('race_results', () => loadPaddockData())

  // Cálculos de classificação da temporada
  const standingsCalculated = useMemo(() => {
    if (!season) return null
    return standingsService.calculateStandings({
      raceResults: dbRaceResults,
      playerDrivers: dbDrivers.filter(
        (d) => d.team_id === team?.id || d.reserve_team_id === team?.id,
      ),
      team,
      season,
    })
  }, [dbRaceResults, dbDrivers, team, season])

  // 1. Processar Lista de Equipes do Paddock
  // Base estruturada ALL_GRID_TEAMS_DATABASE + equipes criadas no DB pelo jogador
  const paddockTeams = useMemo<PaddockTeamItem[]>(() => {
    const list: PaddockTeamItem[] = []
    const constructorStandings = standingsCalculated?.constructorStandings || []

    // Map para lookup rápido de pontos/posição
    const standingByTeamName = new Map<string, { rank: number; points: number; wins: number }>()
    constructorStandings.forEach((c, index) => {
      standingByTeamName.set(c.name.toLowerCase().trim(), {
        rank: index + 1,
        points: c.points,
        wins: c.wins || 0,
      })
    })

    // Adiciona as 28 equipes da base estruturada oficial
    ALL_GRID_TEAMS_DATABASE.forEach((struct) => {
      const isPlayer =
        team?.team_key === struct.key ||
        team?.name?.toLowerCase().trim() === struct.name.toLowerCase().trim()

      const dbMatch = dbTeams.find(
        (t) =>
          t.team_key === struct.key ||
          t.name.toLowerCase().trim() === struct.name.toLowerCase().trim(),
      )

      // Determinação estruturada: participa do campeonato atual de 2026?
      // Uma equipe participa se:
      // 1. É a equipe do jogador (isPlayer)
      // 2. Existe no banco de dados vinculada à temporada ativa (dbMatch)
      // 3. Sua chave faz parte da lista oficial OFFICIAL_2026_GRID_KEYS (12 equipes de 2026)
      const inCurrentGrid = isPlayer || !!dbMatch || OFFICIAL_2026_GRID_KEYS.includes(struct.key)

      // Standings calculadas (válido apenas se estiver no grid atual)
      const standing = inCurrentGrid
        ? standingByTeamName.get(struct.name.toLowerCase().trim()) ||
          standingByTeamName.get(struct.shortName.toLowerCase().trim()) ||
          (isPlayer && team?.id
            ? standingByTeamName.get(team.name.toLowerCase().trim())
            : null) || {
            rank: 0,
            points: 0,
            wins: 0,
          }
        : { rank: 0, points: 0, wins: 0 }

      // Pilotos: APENAS para equipes ativas no campeonato atual
      // NUNCA associar pilotos a equipes fora do campeonato.
      let d1: PaddockTeamItem['driver1'] = undefined
      let d2: PaddockTeamItem['driver2'] = undefined
      let reserveData: PaddockTeamItem['reserveDriver'] = undefined

      if (inCurrentGrid) {
        const teamDrivers = isPlayer
          ? dbDrivers.filter((d) => d.team_id === team?.id && d.role === 'titular')
          : dbDrivers.filter((d) => d.team_id === dbMatch?.id && d.role === 'titular')

        // Piloto 1
        if (teamDrivers[0]) {
          d1 = {
            name: teamDrivers[0].name,
            flag: getCountryFlag(teamDrivers[0].nationality),
            speed: teamDrivers[0].speed,
            consistency: teamDrivers[0].consistency,
            nationality: teamDrivers[0].nationality,
          }
        } else if (struct.driver1) {
          d1 = {
            name: struct.driver1.name,
            flag: struct.driver1.flag,
            speed: struct.driver1.speed,
            consistency: struct.driver1.consistency,
            nationality: struct.driver1.nationality,
          }
        }

        // Piloto 2
        if (teamDrivers[1]) {
          d2 = {
            name: teamDrivers[1].name,
            flag: getCountryFlag(teamDrivers[1].nationality),
            speed: teamDrivers[1].speed,
            consistency: teamDrivers[1].consistency,
            nationality: teamDrivers[1].nationality,
          }
        } else if (struct.driver2) {
          d2 = {
            name: struct.driver2.name,
            flag: struct.driver2.flag,
            speed: struct.driver2.speed,
            consistency: struct.driver2.consistency,
            nationality: struct.driver2.nationality,
          }
        }

        // Piloto Reserva
        const reserveD = isPlayer
          ? dbDrivers.find(
              (d) =>
                (d.team_id === team?.id || d.reserve_team_id === team?.id) && d.role === 'reserva',
            )
          : dbDrivers.find((d) => d.team_id === dbMatch?.id && d.role === 'reserva')

        if (reserveD) {
          reserveData = {
            name: reserveD.name,
            flag: getCountryFlag(reserveD.nationality),
            speed: reserveD.speed,
            consistency: reserveD.consistency,
            nationality: reserveD.nationality,
          }
        } else if (struct.reserveDriver) {
          reserveData = {
            name: struct.reserveDriver.name,
            flag: struct.reserveDriver.flag,
            speed: struct.reserveDriver.speed,
            consistency: struct.reserveDriver.consistency,
            nationality: struct.reserveDriver.nationality,
          }
        }
      }

      // Imagem do carro pelo sistema de assets estruturado por teamKey
      const carImageUrl = getCarroPorEquipeImage(struct.key)

      // Logo url pelo sistema de assets oficial ou fallback
      const resolvedLogo = struct.logoUrl || getTeamLogoUrl(struct.key)

      list.push({
        id: dbMatch?.id || struct.key,
        key: struct.key,
        name: isPlayer ? team?.name || struct.name : struct.name,
        shortName: struct.shortName,
        color: isPlayer ? team?.color || struct.color : struct.color,
        engine: isPlayer ? (team?.engine_supplier as any) || struct.engine : struct.engine,
        country: struct.country,
        flag: struct.flag,
        position: inCurrentGrid ? standing.rank : 0,
        points: inCurrentGrid ? standing.points : 0,
        wins: inCurrentGrid ? standing.wins : 0,
        strengthRating:
          isPlayer && team?.strength
            ? Number((team.strength / 10).toFixed(1))
            : struct.strengthRating,
        budget: isPlayer ? (team?.budget ?? struct.budget) : struct.budget,
        historySummary: struct.historySummary,
        currentSituation: struct.currentSituation,
        isUserTeam: isPlayer,
        inCurrentGrid,
        headquarters: struct.headquarters || 'Sede institucional não cadastrada',
        category:
          struct.category || (inCurrentGrid ? 'Grid Oficial F1 2026' : 'Fora do grid atual'),
        difficulty: struct.difficulty || 'Média',
        boardPressure: struct.boardPressure || 'Média',
        carRating: struct.carRating ?? Math.round(struct.strengthRating * 10),
        engineeringRating: struct.engineeringRating ?? Math.round(struct.strengthRating * 10),
        infrastructureRating: struct.infrastructureRating || 3,
        operationsRating: struct.operationsRating ?? Math.round(struct.strengthRating * 10),
        financesRating: struct.financesRating || 3,
        prestigeRating: struct.prestigeRating ?? Math.round(struct.strengthRating * 10),
        cultureRating: struct.cultureRating ?? Math.round(struct.strengthRating * 10),
        potentialRating: struct.potentialRating ?? Math.round(struct.strengthRating * 10),
        specialTraits: struct.specialTraits || [struct.competitivenessVerdict],
        carImageUrl,
        driver1: d1,
        driver2: d2,
        reserveDriver: reserveData,
        logoUrl: resolvedLogo,
      })
    })

    // Adiciona equipes customizadas do banco que não existam na base de 28
    dbTeams.forEach((t) => {
      const alreadyIncluded = list.some(
        (item) =>
          item.key === t.team_key || item.name.toLowerCase().trim() === t.name.toLowerCase().trim(),
      )
      if (!alreadyIncluded && t.name) {
        const isPlayer = team?.id === t.id
        const standing = standingByTeamName.get(t.name.toLowerCase().trim()) || {
          rank: 0,
          points: 0,
          wins: 0,
        }
        const tDrivers = dbDrivers.filter((d) => d.team_id === t.id && d.role === 'titular')
        list.push({
          id: t.id,
          key: t.team_key || t.id,
          name: t.name,
          shortName: t.name.split(' ')[0],
          color: t.color || '#E10600',
          engine: t.engine_supplier || 'Audi',
          country: 'Brasil',
          flag: '🇧🇷',
          position: standing.rank,
          points: standing.points,
          wins: standing.wins,
          strengthRating: Number(((t.strength || 50) / 10).toFixed(1)),
          budget: t.budget || 150000000,
          historySummary: 'Equipe customizada ativa na temporada de 2026.',
          currentSituation: 'Competindo no grid mundial.',
          isUserTeam: isPlayer,
          inCurrentGrid: true,
          headquarters: 'São Paulo, Brasil',
          category: 'Equipe Customizada no Grid',
          difficulty: 'Média',
          boardPressure: 'Média',
          carRating: t.strength || 50,
          engineeringRating: t.strength || 50,
          infrastructureRating: 3,
          operationsRating: t.strength || 50,
          financesRating: 3,
          prestigeRating: t.strength || 50,
          cultureRating: 75,
          potentialRating: 80,
          specialTraits: ['Nova Equipe no Campeonato'],
          carImageUrl: getCarroPorEquipeImage(t.team_key || t.id, true),
          driver1: tDrivers[0]
            ? {
                name: tDrivers[0].name,
                flag: getCountryFlag(tDrivers[0].nationality || 'Brasil'),
                speed: tDrivers[0].speed || 80,
                consistency: tDrivers[0].consistency || 80,
                nationality: tDrivers[0].nationality || 'Brasil',
              }
            : undefined,
          driver2: tDrivers[1]
            ? {
                name: tDrivers[1].name,
                flag: getCountryFlag(tDrivers[1].nationality || 'Brasil'),
                speed: tDrivers[1].speed || 79,
                consistency: tDrivers[1].consistency || 78,
                nationality: tDrivers[1].nationality || 'Brasil',
              }
            : undefined,
          logoUrl: getTeamLogoUrl(t.team_key || t.id),
        })
      }
    })

    // Ordenação:
    // 1. Equipes do grid atual primeiro (ordenadas por pontos/posição no campeonato, depois força)
    // 2. Equipes fora do grid depois (ordenadas por força)
    return list.sort((a, b) => {
      if (a.inCurrentGrid && !b.inCurrentGrid) return -1
      if (!a.inCurrentGrid && b.inCurrentGrid) return 1
      if (a.inCurrentGrid && b.inCurrentGrid) {
        if (a.position > 0 && b.position > 0) return a.position - b.position
        if (a.position > 0) return -1
        if (b.position > 0) return 1
        return b.strengthRating - a.strengthRating
      }
      return b.strengthRating - a.strengthRating
    })
  }, [standingsCalculated, dbTeams, dbDrivers, team])

  // 2. Processar Pilotos do Paddock (Todos os do DB unificados)
  const paddockDrivers = useMemo<PaddockDriverItem[]>(() => {
    const list: PaddockDriverItem[] = []
    const driverStandings = standingsCalculated?.driverStandings || []

    const driverStatsById = new Map<
      string,
      { rank: number; points: number; wins: number; podiums: number }
    >()
    driverStandings.forEach((d, index) => {
      driverStatsById.set(d.id, {
        rank: index + 1,
        points: d.points,
        wins: d.wins || 0,
        podiums: d.podiums || 0,
      })
      driverStatsById.set(d.name.toLowerCase().trim(), {
        rank: index + 1,
        points: d.points,
        wins: d.wins || 0,
        podiums: d.podiums || 0,
      })
    })

    // Complementa com resultados de corrida para vitórias e pódios
    const raceAggMap = new Map<string, { wins: number; podiums: number; points: number }>()
    dbRaceResults.forEach((r) => {
      if (!r.driver_id) return
      const cur = raceAggMap.get(r.driver_id) || { wins: 0, podiums: 0, points: 0 }
      cur.points += r.points || 0
      if (r.position === 1) cur.wins += 1
      if (r.position >= 1 && r.position <= 3) cur.podiums += 1
      raceAggMap.set(r.driver_id, cur)
    })

    const teamsMap = new Map<string, TeamModel>()
    dbTeams.forEach((t) => teamsMap.set(t.id, t))

    dbDrivers.forEach((driver) => {
      const isUserDriver =
        team?.id && (driver.team_id === team.id || driver.reserve_team_id === team.id)
      const currentTeam = driver.team_id
        ? teamsMap.get(driver.team_id)
        : driver.reserve_team_id
          ? teamsMap.get(driver.reserve_team_id)
          : null

      const teamName =
        currentTeam?.name || (isUserDriver ? team?.name || 'Sua Equipe' : 'Agente Livre')
      const teamColor = currentTeam?.color || (isUserDriver ? team?.color || '#E10600' : '#475569')

      const stat = driverStatsById.get(driver.id) ||
        driverStatsById.get(driver.name.toLowerCase().trim()) || {
          rank: 0,
          points: raceAggMap.get(driver.id)?.points || 0,
          wins: raceAggMap.get(driver.id)?.wins || 0,
          podiums: raceAggMap.get(driver.id)?.podiums || 0,
        }

      let roleNormalized: 'titular' | 'reserva' | 'livre' | 'test_driver' | 'academia' =
        driver.role === 'titular' && (driver.team_id || isUserDriver)
          ? 'titular'
          : driver.role === 'reserva' || driver.reserve_team_id
            ? 'reserva'
            : driver.is_test_driver
              ? 'test_driver'
              : driver.is_academy
                ? 'academia'
                : 'livre'

      list.push({
        id: driver.id,
        name: driver.name,
        nationality: driver.nationality,
        flag: getCountryFlag(driver.nationality),
        age: driver.age,
        role: roleNormalized,
        teamName,
        teamColor,
        teamId: driver.team_id || driver.reserve_team_id,
        salary: driver.salary || 0,
        contractEnd: String(driver.contract_end || '2026'),
        speed: driver.speed,
        consistency: driver.consistency,
        morale: driver.morale ?? 75,
        physical: driver.physical_condition ?? 90,
        points: stat.points,
        wins: stat.wins,
        podiums: stat.podiums,
        position: stat.rank,
        isUserDriver: !!isUserDriver,
        licenseStatus: driver.license_status,
        isAcademy: driver.is_academy,
        isTestDriver: driver.is_test_driver,
        homologationStatus: driver.homologation_status,
        technicalFeedback: driver.technical_feedback,
        seatSecurity: driver.seat_security,
      })
    })

    // Ordenar por pontos / posição, depois por velocidade
    return list.sort((a, b) => {
      if (a.position > 0 && b.position > 0) return a.position - b.position
      if (a.position > 0) return -1
      if (b.position > 0) return 1
      return b.speed - a.speed
    })
  }, [dbDrivers, dbTeams, dbRaceResults, standingsCalculated, team])

  // Filtragem de Equipes
  const filteredTeams = useMemo(() => {
    return paddockTeams.filter((t) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        q === '' ||
        t.name.toLowerCase().includes(q) ||
        t.shortName.toLowerCase().includes(q) ||
        t.engine.toLowerCase().includes(q) ||
        (t.driver1 && t.driver1.name.toLowerCase().includes(q)) ||
        (t.driver2 && t.driver2.name.toLowerCase().includes(q)) ||
        t.country.toLowerCase().includes(q) ||
        (t.headquarters && t.headquarters.toLowerCase().includes(q))

      const matchesEngine =
        engineFilter === 'todos' || t.engine.toLowerCase() === engineFilter.toLowerCase()

      return matchesSearch && matchesEngine
    })
  }, [paddockTeams, searchQuery, engineFilter])

  // Filtragem de Pilotos
  const filteredDrivers = useMemo(() => {
    return paddockDrivers.filter((d) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        q === '' ||
        d.name.toLowerCase().includes(q) ||
        d.nationality.toLowerCase().includes(q) ||
        d.teamName.toLowerCase().includes(q)

      let matchesRole = true
      if (roleFilter === 'titular') matchesRole = d.role === 'titular'
      else if (roleFilter === 'reserva') matchesRole = d.role === 'reserva'
      else if (roleFilter === 'test_driver')
        matchesRole = !!d.isTestDriver || d.role === 'test_driver'
      else if (roleFilter === 'academia') matchesRole = !!d.isAcademy || d.role === 'academia'
      else if (roleFilter === 'homologacao') matchesRole = d.homologationStatus === 'homologacao'
      else if (roleFilter === 'licenca_provisoria') matchesRole = d.licenseStatus === 'nivel_b'
      else if (roleFilter === 'super_licenca') matchesRole = d.licenseStatus === 'nivel_a'
      else if (roleFilter === 'livre') matchesRole = d.role === 'livre'

      return matchesSearch && matchesRole
    })
  }, [paddockDrivers, searchQuery, roleFilter])

  // Pilotos do Mercado (Agentes livres + contratos encerrando em 2026)
  const marketDrivers = useMemo(() => {
    return paddockDrivers.filter((d) => d.role === 'livre' || d.contractEnd === '2026')
  }, [paddockDrivers])

  // Rumores do Paddock gerados a partir do estado real do save
  const marketRumors = useMemo(() => {
    const rumors: {
      id: string
      title: string
      category: string
      impact: string
      teamColor: string
    }[] = []

    const expiringTopDrivers = paddockDrivers
      .filter((d) => d.speed >= 85 && d.contractEnd === '2026')
      .slice(0, 3)
    expiringTopDrivers.forEach((d) => {
      rumors.push({
        id: `rumor-exp-${d.id}`,
        title: `${d.name} desperta interesse dos principais chefes de equipe para 2027`,
        category: 'MERCADO DE PILOTOS',
        impact: `Com contrato encerrando ao fim de ${d.contractEnd}, o piloto de ${d.age} anos avalia renovação ou mudança.`,
        teamColor: d.teamColor,
      })
    })

    // Rumores de motores
    rumors.push({
      id: 'rumor-pu-2026',
      title: 'FIA confirma congelamento de especificações elétricas 50/50 até o meio da temporada',
      category: 'REGULAMENTO TÉCNICO',
      impact:
        'Todas as 5 fornecedoras de UP trabalham em mapas de recuperação de energia no MGU-K.',
      teamColor: '#E10600',
    })

    // Rumor de jovens talentos
    const youngStars = paddockDrivers.filter((d) => d.age <= 22 && d.speed >= 80).slice(0, 2)
    if (youngStars.length > 0) {
      rumors.push({
        id: `rumor-young-${youngStars[0].id}`,
        title: `${youngStars[0].name} é cotado para testes oficiais de jovens pilotos`,
        category: 'ACADEMIA',
        impact: `Com velocidade avaliada em ${youngStars[0].speed}, o piloto ganha holofotes nos treinos livres.`,
        teamColor: youngStars[0].teamColor,
      })
    }

    return rumors
  }, [paddockDrivers])

  // Itens selecionados para comparação lado a lado
  useEffect(() => {
    if (compareType === 'equipes') {
      if (!compareItemA && paddockTeams.length > 0) {
        const userT = paddockTeams.find((t) => t.isUserTeam) || paddockTeams[0]
        setCompareItemA(userT.key)
      }
      if (!compareItemB && paddockTeams.length > 1) {
        const rivalT = paddockTeams.find((t) => !t.isUserTeam) || paddockTeams[1]
        setCompareItemB(rivalT.key)
      }
    } else {
      if (!compareItemA && paddockDrivers.length > 0) {
        const userD = paddockDrivers.find((d) => d.isUserDriver) || paddockDrivers[0]
        setCompareItemA(userD.id)
      }
      if (!compareItemB && paddockDrivers.length > 1) {
        const rivalD = paddockDrivers.find((d) => !d.isUserDriver) || paddockDrivers[1]
        setCompareItemB(rivalD.id)
      }
    }
  }, [compareType, paddockTeams, paddockDrivers])

  const teamComparisonA = useMemo(
    () => paddockTeams.find((t) => t.key === compareItemA) || paddockTeams[0],
    [paddockTeams, compareItemA],
  )
  const teamComparisonB = useMemo(
    () => paddockTeams.find((t) => t.key === compareItemB) || paddockTeams[1],
    [paddockTeams, compareItemB],
  )

  const driverComparisonA = useMemo(
    () => paddockDrivers.find((d) => d.id === compareItemA) || paddockDrivers[0],
    [paddockDrivers, compareItemA],
  )
  const driverComparisonB = useMemo(
    () => paddockDrivers.find((d) => d.id === compareItemB) || paddockDrivers[1],
    [paddockDrivers, compareItemB],
  )

  return (
    <div className="relative space-y-6 animate-fade-in-up pb-12 select-none text-[#F5F7FA]">
      <AmbientBackground />

      {/* PageHeader Oficial */}
      <PageHeader
        eyebrow={`COMPETIÇÃO // F1 ${season?.year || 2026} PADDOCK`}
        title="Paddock Oficial"
        description="Acesso integral ao universo da Fórmula 1: todas as 28 escuderias estruturadas, elenco completo de pilotos com fotos oficiais, movimentações de mercado e ferramentas de comparação direta."
        badge={
          <div className="flex items-center gap-2 font-mono text-xs">
            <Badge variant="outline" className="border-[#1F2733] bg-[#161D29] text-white">
              {paddockTeams.length} Construtoras
            </Badge>
            <Badge variant="outline" className="border-[#1F2733] bg-[#161D29] text-emerald-400">
              {paddockDrivers.length} Pilotos
            </Badge>
          </div>
        }
      />

      {/* Barra de Abas e Busca Integrada */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#0F141C] border border-[#1C2330] p-3 rounded-2xl shadow-lg">
        {/* Abas Principais */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-[#090D14] border border-[#1A222F] rounded-xl shrink-0">
          {[
            { id: 'equipes', label: 'Equipes do Grid', icon: Shield, count: paddockTeams.length },
            { id: 'pilotos', label: 'Pilotos', icon: Users, count: paddockDrivers.length },
            {
              id: 'mercado',
              label: 'Mercado & Rumores',
              icon: Briefcase,
              count: marketDrivers.length,
            },
            { id: 'comparacao', label: 'Comparação', icon: GitCompare },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as any)
                  setSearchQuery('')
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#E10600] text-white shadow-md'
                    : 'text-[#8B95A7] hover:text-white hover:bg-[#141B26]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      isActive ? 'bg-black/30 text-white' : 'bg-[#161D29] text-[#64748B]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Campo de Busca Rápida (ativo nas abas equipes/pilotos/mercado) */}
        {activeTab !== 'comparacao' && (
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A7]" />
            <input
              type="text"
              placeholder={
                activeTab === 'equipes'
                  ? 'Buscar construtora por nome, motor ou país...'
                  : 'Buscar piloto por nome, equipe ou país...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#090D14] border border-[#1A222F] text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#E10600] transition-colors font-mono"
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: EQUIPES (Grid com 26+ equipes da base oficial estruturada)          */}
      {/* ========================================================================= */}
      {activeTab === 'equipes' && (
        <div className="space-y-4">
          {/* Filtros de Motor */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
            <span className="text-[#8B95A7] text-[11px] shrink-0 font-bold uppercase">Motor:</span>
            {['todos', 'Mercedes', 'Ferrari', 'Honda', 'Ford', 'Audi'].map((eng) => (
              <button
                key={eng}
                type="button"
                onClick={() => setEngineFilter(eng)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  engineFilter === eng
                    ? 'bg-[#18202E] text-white border border-cyan-500/40 font-bold'
                    : 'bg-[#0E131B] text-[#8B95A7] hover:text-white border border-[#1C2330]'
                }`}
              >
                {eng === 'todos' ? 'Todos os Fornecedores' : eng}
              </button>
            ))}
            <span className="ml-auto text-xs text-[#8B95A7] font-mono shrink-0">
              {filteredTeams.length} equipes encontradas
            </span>
          </div>

          {/* Grid de Cards de Equipes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTeams.map((t) => {
              return (
                <div
                  key={t.key}
                  onClick={() => setSelectedTeamDetail(t)}
                  className={`group relative rounded-2xl border p-4 bg-[#0F141C] transition-all duration-200 cursor-pointer flex flex-col justify-between hover:scale-[1.01] hover:shadow-xl ${
                    t.isUserTeam
                      ? 'border-[#E10600] ring-1 ring-[#E10600]/40 shadow-lg bg-gradient-to-b from-[#161214] to-[#0F141C]'
                      : 'border-[#1C2330] hover:border-[#2C3849]'
                  }`}
                >
                  {/* Faixa superior com a cor da equipe */}
                  <div
                    className="absolute top-0 left-4 right-4 h-[2px] rounded-b-full transition-opacity opacity-80 group-hover:opacity-100"
                    style={{ backgroundColor: t.color }}
                  />

                  <div className="space-y-3">
                    {/* Topo do Card: Logo/Identidade + Nome + Badge de Status */}
                    <div className="flex items-start gap-3 pt-1">
                      {t.logoUrl ? (
                        <div className="w-11 h-11 rounded-xl bg-[#090D14] border border-[#1C2330] p-1 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                          <img
                            src={t.logoUrl}
                            alt={t.name}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              // Fallback gracioso se a imagem não carregar
                              e.currentTarget.style.display = 'none'
                              if (e.currentTarget.parentElement) {
                                e.currentTarget.parentElement.innerHTML = `<span class="font-mono font-black text-xs text-white">${t.shortName.substring(0, 2).toUpperCase()}</span>`
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0 shadow-md font-mono border"
                          style={{
                            backgroundColor:
                              t.key === 'cadillac'
                                ? '#1B170B'
                                : t.key === 'toyota'
                                  ? '#200709'
                                  : '#11161F',
                            borderColor:
                              t.key === 'cadillac'
                                ? '#D4AF37'
                                : t.key === 'toyota'
                                  ? '#EB0A1E'
                                  : t.color,
                            color:
                              t.key === 'cadillac'
                                ? '#D4AF37'
                                : t.key === 'toyota'
                                  ? '#EB0A1E'
                                  : '#FFFFFF',
                          }}
                        >
                          {t.shortName.substring(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm shrink-0">{t.flag}</span>
                            <h3 className="font-bold text-sm text-white truncate group-hover:text-cyan-400 transition-colors">
                              {t.name}
                            </h3>
                          </div>
                        </div>

                        {/* Status no campeonato atual */}
                        <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                          {t.inCurrentGrid ? (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-mono px-1.5 py-0">
                              No Grid 2026
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-800 text-slate-300 border border-slate-700 text-[9px] font-mono px-1.5 py-0">
                              Fora do grid atual
                            </Badge>
                          )}
                          {t.isUserTeam && (
                            <Badge className="bg-[#E10600] text-white text-[9px] font-mono px-1.5 py-0">
                              Sua Equipe
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-[#8B95A7]">
                          <span>
                            Motor <strong className="text-cyan-400">{t.engine}</strong>
                          </span>
                          <span>•</span>
                          <span>{t.country}</span>
                        </div>
                      </div>
                    </div>

                    {/* Resumo de Campeonato: Apenas se estiver no campeonato */}
                    {t.inCurrentGrid ? (
                      <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-[#090D14] border border-[#1A222F] text-center font-mono">
                        <div>
                          <span className="text-[9px] text-[#64748B] uppercase block">Posição</span>
                          <strong className="text-xs text-white font-bold">
                            {t.position > 0 ? `${t.position}º` : '—'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#64748B] uppercase block">Pontos</span>
                          <strong className="text-xs text-cyan-400 font-bold">
                            {t.points} pts
                          </strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#64748B] uppercase block">
                            Vitórias
                          </span>
                          <strong className="text-xs text-amber-400 font-bold">{t.wins}</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 rounded-xl bg-[#090D14]/70 border border-[#1A222F] text-center font-mono">
                        <span className="text-[10px] text-amber-400/90 font-medium block">
                          Sem participação no campeonato 2026
                        </span>
                        <span className="text-[9px] text-[#64748B] block">
                          {t.category || 'Escuderia Convidada / Reserva FIA'}
                        </span>
                      </div>
                    )}

                    {/* Pilotos Titulares: Apenas para equipes no campeonato */}
                    {t.inCurrentGrid ? (
                      <div className="space-y-1 font-mono text-xs">
                        <span className="text-[9px] text-[#64748B] uppercase block font-bold">
                          Pilotos Titulares
                        </span>
                        <div className="p-2 rounded-lg bg-[#090D14] border border-[#1A222F] space-y-1">
                          {t.driver1 ? (
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1 text-white truncate max-w-[130px]">
                                <span>{t.driver1.flag}</span>
                                <span className="truncate">{t.driver1.name}</span>
                              </span>
                              <span className="text-emerald-400 font-bold text-[10px]">
                                {t.driver1.speed} VEL
                              </span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-[#64748B] italic">Sem piloto 1</div>
                          )}
                          {t.driver2 ? (
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1 text-white truncate max-w-[130px]">
                                <span>{t.driver2.flag}</span>
                                <span className="truncate">{t.driver2.name}</span>
                              </span>
                              <span className="text-emerald-400 font-bold text-[10px]">
                                {t.driver2.speed} VEL
                              </span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-[#64748B] italic">Sem piloto 2</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-[#090D14]/50 border border-[#1A222F] text-[11px] font-mono text-[#64748B] italic text-center">
                        Sem pilotos vinculados à temporada
                      </div>
                    )}
                  </div>

                  {/* Rodapé com Botão Ver Detalhes */}
                  <div className="pt-3 mt-3 border-t border-[#1C2330] flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-1 text-amber-400">
                      <span className="text-[10px] text-[#8B95A7]">Força</span>
                      <strong className="font-bold">{t.strengthRating.toFixed(1)}/10</strong>
                    </div>

                    <span className="text-[11px] text-cyan-400 group-hover:text-cyan-300 font-semibold flex items-center gap-0.5">
                      <span>Ficha Técnica</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: PILOTOS (Grid completo de pilotos com fotos reais)                  */}
      {/* ========================================================================= */}
      {activeTab === 'pilotos' && (
        <div className="space-y-4">
          {/* Filtros de Papel & Licença (Regra 13 do PDF) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
            <span className="text-[#8B95A7] text-[11px] shrink-0 font-bold uppercase">Filtro:</span>
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'titular', label: 'Titular' },
              { id: 'reserva', label: 'Reserva' },
              { id: 'test_driver', label: 'Piloto de Teste' },
              { id: 'academia', label: 'Academia' },
              { id: 'homologacao', label: 'Em Homologação' },
              { id: 'licenca_provisoria', label: 'Licença Provisória' },
              { id: 'super_licenca', label: 'Super Licença' },
              { id: 'livre', label: 'Agente Livre' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRoleFilter(r.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  roleFilter === r.id
                    ? 'bg-[#18202E] text-white border border-cyan-500/40 font-bold'
                    : 'bg-[#0E131B] text-[#8B95A7] hover:text-white border border-[#1C2330]'
                }`}
              >
                {r.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-[#8B95A7] font-mono shrink-0 whitespace-nowrap">
              {filteredDrivers.length} pilotos
            </span>
          </div>

          {/* Grid de Pilotos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDrivers.map((d) => {
              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDriverDetail(d)}
                  className={`group relative rounded-2xl border p-4 bg-[#0F141C] transition-all duration-200 cursor-pointer flex flex-col justify-between hover:scale-[1.01] hover:shadow-xl ${
                    d.isUserDriver
                      ? 'border-[#E10600] ring-1 ring-[#E10600]/30 shadow-lg bg-gradient-to-b from-[#181113] to-[#0F141C]'
                      : 'border-[#1C2330] hover:border-[#2C3849]'
                  }`}
                >
                  <div
                    className="absolute top-0 left-4 right-4 h-[2px] rounded-b-full transition-opacity opacity-80 group-hover:opacity-100"
                    style={{ backgroundColor: d.teamColor }}
                  />

                  <div className="space-y-3">
                    {/* Topo: Foto do Piloto + Nome + Equipe */}
                    <div className="flex items-start gap-3 pt-1">
                      <div className="relative shrink-0">
                        <DriverPhotoAvatar
                          name={d.name}
                          teamColor={d.teamColor}
                          size="lg"
                          className="border-2 group-hover:border-white/40 transition-colors shrink-0"
                        />
                        <span className="absolute -bottom-1 -right-1 text-xs">{d.flag}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-sm text-white truncate group-hover:text-cyan-400 transition-colors">
                            {d.name}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: d.teamColor }}
                          />
                          <span className="text-[11px] font-mono text-[#8B95A7] truncate">
                            {d.teamName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1 font-mono text-[10px] flex-wrap">
                          <Badge
                            variant="outline"
                            className={`px-1.5 py-0 border ${
                              d.role === 'titular'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : d.role === 'reserva'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : d.role === 'test_driver'
                                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                                    : d.role === 'academia'
                                      ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                      : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                            }`}
                          >
                            {d.role === 'test_driver'
                              ? 'TEST DRIVER'
                              : d.role === 'academia'
                                ? 'ACADEMIA'
                                : d.role.toUpperCase()}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 border-[#2A3444] text-slate-300"
                          >
                            {d.licenseStatus === 'nivel_a'
                              ? 'Super Licença'
                              : d.licenseStatus === 'nivel_b'
                                ? 'Licença B'
                                : 'Licença C'}
                          </Badge>
                          <span className="text-[#64748B]">{d.age} anos</span>
                        </div>
                      </div>
                    </div>

                    {/* Barras Técnicas */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                      <ProgressBar
                        value={d.speed}
                        label="VELOCIDADE"
                        size="sm"
                        valueFormatter={(v) => `${v}`}
                      />
                      <ProgressBar
                        value={d.consistency}
                        label="CONSISTÊNCIA"
                        size="sm"
                        valueFormatter={(v) => `${v}`}
                      />
                    </div>
                  </div>

                  {/* Rodapé: Pontos + Posição no Campeonato */}
                  <div className="pt-3 mt-3 border-t border-[#1C2330] flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-white">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        <strong>{d.points}</strong> pts{' '}
                        {d.position > 0 && <span className="text-[#64748B]">({d.position}º)</span>}
                      </span>
                    </div>

                    <span className="text-[11px] text-cyan-400 group-hover:text-cyan-300 font-semibold flex items-center gap-0.5">
                      <span>Ficha</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: MERCADO & RUMORES (Contratos expirando e fofocas do paddock)       */}
      {/* ========================================================================= */}
      {activeTab === 'mercado' && (
        <div className="space-y-6">
          {/* Seção de Rumores */}
          <div className="rounded-2xl bg-[#0F141C] border border-[#1C2330] p-5 shadow-lg space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#1C2330]">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-mono font-black tracking-widest text-white uppercase">
                RADAR DE RUMORES & BASTIDORES DO PADDOCK
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {marketRumors.map((rumor) => (
                <div
                  key={rumor.id}
                  className="p-3.5 rounded-xl bg-[#090D14] border border-[#1A222F] space-y-1.5 hover:border-[#2C3849] transition-all"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-amber-400 font-bold uppercase">{rumor.category}</span>
                    <span className="text-[#64748B]">TEMPORADA {season?.year || 2026}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white leading-snug">{rumor.title}</h4>
                  <p className="text-xs text-[#8B95A7] leading-relaxed">{rumor.impact}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Lista de Contratos Expirando / Agentes Livres */}
          <div className="rounded-2xl bg-[#0F141C] border border-[#1C2330] p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#1C2330]">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-mono font-black tracking-widest text-white uppercase">
                  CONTRATOS EXPIRANDO EM {season?.year || 2026} & AGENTES LIVRES
                </h3>
              </div>
              <span className="text-xs font-mono text-[#8B95A7]">
                {marketDrivers.length} pilotos monitorados
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {marketDrivers.map((d) => (
                <div
                  key={d.id}
                  onClick={() => setSelectedDriverDetail(d)}
                  className="p-3.5 rounded-xl bg-[#090D14] border border-[#1A222F] hover:border-[#2C3849] transition-all cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <DriverPhotoAvatar
                      name={d.name}
                      teamColor={d.teamColor}
                      size="md"
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{d.flag}</span>
                        <h4 className="font-bold text-xs text-white truncate">{d.name}</h4>
                      </div>
                      <span className="text-[10px] font-mono text-[#8B95A7] block truncate">
                        {d.teamName} • {d.age} anos
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400 font-bold block">
                        Velocidade: {d.speed}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono">
                    <span className="text-[9px] text-[#64748B] block uppercase">Salário</span>
                    <strong className="text-xs text-emerald-400 block font-bold">
                      {d.salary > 0 ? formatCurrency(d.salary) : 'Livre'}
                    </strong>
                    <span className="text-[9px] text-amber-400 uppercase font-bold">
                      Fim: {d.contractEnd}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: COMPARAÇÃO (Comparar 2 equipes ou 2 pilotos lado a lado)             */}
      {/* ========================================================================= */}
      {activeTab === 'comparacao' && (
        <div className="space-y-6">
          {/* Seletor de Tipo de Comparação */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setCompareType('equipes')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                compareType === 'equipes'
                  ? 'bg-[#E10600] text-white shadow-lg'
                  : 'bg-[#0F141C] text-[#8B95A7] hover:text-white border border-[#1C2330]'
              }`}
            >
              Comparar Duas Equipes
            </button>
            <button
              type="button"
              onClick={() => setCompareType('pilotos')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                compareType === 'pilotos'
                  ? 'bg-[#E10600] text-white shadow-lg'
                  : 'bg-[#0F141C] text-[#8B95A7] hover:text-white border border-[#1C2330]'
              }`}
            >
              Comparar Dois Pilotos
            </button>
          </div>

          {/* Comparativo de Equipes */}
          {compareType === 'equipes' && (
            <div className="rounded-2xl bg-[#0F141C] border border-[#1C2330] p-5 shadow-xl space-y-6">
              {/* Seletores lado a lado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Equipe A */}
                <div className="p-3 rounded-xl bg-[#090D14] border border-[#1A222F] space-y-2">
                  <label className="text-[11px] font-mono text-[#8B95A7] uppercase font-bold block">
                    Selecione a Equipe A
                  </label>
                  <select
                    value={compareItemA}
                    onChange={(e) => setCompareItemA(e.target.value)}
                    className="w-full bg-[#11161F] border border-[#1F2733] text-white rounded-lg p-2 text-xs font-mono focus:outline-none"
                  >
                    {paddockTeams.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.name} ({t.engine})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Equipe B */}
                <div className="p-3 rounded-xl bg-[#090D14] border border-[#1A222F] space-y-2">
                  <label className="text-[11px] font-mono text-[#8B95A7] uppercase font-bold block">
                    Selecione a Equipe B
                  </label>
                  <select
                    value={compareItemB}
                    onChange={(e) => setCompareItemB(e.target.value)}
                    className="w-full bg-[#11161F] border border-[#1F2733] text-white rounded-lg p-2 text-xs font-mono focus:outline-none"
                  >
                    {paddockTeams.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.name} ({t.engine})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quadro Comparativo Lado a Lado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Lado A */}
                <div
                  className="p-5 rounded-2xl bg-[#090D14] border space-y-4"
                  style={{ borderColor: `${teamComparisonA.color}66` }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg text-white font-mono shadow-md"
                      style={{ backgroundColor: teamComparisonA.color }}
                    >
                      {teamComparisonA.shortName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white">{teamComparisonA.name}</h3>
                      <p className="text-xs font-mono text-cyan-400">
                        Motor {teamComparisonA.engine}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Posição Construtores:</span>
                      <strong className="text-white">
                        {teamComparisonA.position > 0 ? `${teamComparisonA.position}º Lugar` : '—'}
                      </strong>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Pontos no Mundial:</span>
                      <strong className="text-cyan-400">{teamComparisonA.points} pts</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Força Relativa:</span>
                      <strong className="text-amber-400">
                        {teamComparisonA.strengthRating.toFixed(1)}/10
                      </strong>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Orçamento Operacional:</span>
                      <strong className="text-emerald-400">
                        {formatCurrency(teamComparisonA.budget)}
                      </strong>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Status no Campeonato:</span>
                      <strong
                        className={
                          teamComparisonA.inCurrentGrid ? 'text-emerald-400' : 'text-amber-400'
                        }
                      >
                        {teamComparisonA.inCurrentGrid ? 'Grid F1 2026' : 'Fora do grid atual'}
                      </strong>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Piloto Titular #1:</span>
                      <strong className="text-white">
                        {teamComparisonA.driver1
                          ? `${teamComparisonA.driver1.name} (${teamComparisonA.driver1.speed})`
                          : 'Sem pilotos associados'}
                      </strong>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Piloto Titular #2:</span>
                      <strong className="text-white">
                        {teamComparisonA.driver2
                          ? `${teamComparisonA.driver2.name} (${teamComparisonA.driver2.speed})`
                          : 'Sem pilotos associados'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Lado B */}
                <div
                  className="p-5 rounded-2xl bg-[#090D14] border space-y-4"
                  style={{ borderColor: `${teamComparisonB.color}66` }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg text-white font-mono shadow-md"
                      style={{ backgroundColor: teamComparisonB.color }}
                    >
                      {teamComparisonB.shortName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white">{teamComparisonB.name}</h3>
                      <p className="text-xs font-mono text-cyan-400">
                        Motor {teamComparisonB.engine}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Posição Construtores:</span>
                      <strong className="text-white">
                        {teamComparisonB.position > 0 ? `${teamComparisonB.position}º Lugar` : '—'}
                      </strong>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Pontos no Mundial:</span>
                      <strong className="text-cyan-400">{teamComparisonB.points} pts</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Força Relativa:</span>
                      <strong className="text-amber-400">
                        {teamComparisonB.strengthRating.toFixed(1)}/10
                      </strong>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Orçamento Operacional:</span>
                      <strong className="text-emerald-400">
                        {formatCurrency(teamComparisonB.budget)}
                      </strong>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Status no Campeonato:</span>
                      <strong
                        className={
                          teamComparisonB.inCurrentGrid ? 'text-emerald-400' : 'text-amber-400'
                        }
                      >
                        {teamComparisonB.inCurrentGrid ? 'Grid F1 2026' : 'Fora do grid atual'}
                      </strong>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Piloto Titular #1:</span>
                      <strong className="text-white">
                        {teamComparisonB.driver1
                          ? `${teamComparisonB.driver1.name} (${teamComparisonB.driver1.speed})`
                          : 'Sem pilotos associados'}
                      </strong>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Piloto Titular #2:</span>
                      <strong className="text-white">
                        {teamComparisonB.driver2
                          ? `${teamComparisonB.driver2.name} (${teamComparisonB.driver2.speed})`
                          : 'Sem pilotos associados'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Comparativo de Pilotos */}
          {compareType === 'pilotos' && (
            <div className="rounded-2xl bg-[#0F141C] border border-[#1C2330] p-5 shadow-xl space-y-6">
              {/* Seletores lado a lado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-[#090D14] border border-[#1A222F] space-y-2">
                  <label className="text-[11px] font-mono text-[#8B95A7] uppercase font-bold block">
                    Selecione o Piloto A
                  </label>
                  <select
                    value={compareItemA}
                    onChange={(e) => setCompareItemA(e.target.value)}
                    className="w-full bg-[#11161F] border border-[#1F2733] text-white rounded-lg p-2 text-xs font-mono focus:outline-none"
                  >
                    {paddockDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.teamName})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-[#090D14] border border-[#1A222F] space-y-2">
                  <label className="text-[11px] font-mono text-[#8B95A7] uppercase font-bold block">
                    Selecione o Piloto B
                  </label>
                  <select
                    value={compareItemB}
                    onChange={(e) => setCompareItemB(e.target.value)}
                    className="w-full bg-[#11161F] border border-[#1F2733] text-white rounded-lg p-2 text-xs font-mono focus:outline-none"
                  >
                    {paddockDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.teamName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quadro Comparativo de Pilotos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Piloto A */}
                <div
                  className="p-5 rounded-2xl bg-[#090D14] border space-y-4"
                  style={{ borderColor: `${driverComparisonA.teamColor}66` }}
                >
                  <div className="flex items-center gap-3">
                    <DriverPhotoAvatar
                      name={driverComparisonA.name}
                      teamColor={driverComparisonA.teamColor}
                      size="xl"
                      className="border-2"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{driverComparisonA.flag}</span>
                        <h3 className="font-bold text-base text-white">{driverComparisonA.name}</h3>
                      </div>
                      <p className="text-xs font-mono text-[#8B95A7]">
                        {driverComparisonA.teamName}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    <ProgressBar
                      value={driverComparisonA.speed}
                      label="VELOCIDADE"
                      size="sm"
                      valueFormatter={(v) => `${v}`}
                    />
                    <ProgressBar
                      value={driverComparisonA.consistency}
                      label="CONSISTÊNCIA"
                      size="sm"
                      valueFormatter={(v) => `${v}`}
                    />
                    <ProgressBar
                      value={driverComparisonA.morale}
                      label="MORAL"
                      size="sm"
                      valueFormatter={(v) => `${v}%`}
                    />
                    <ProgressBar
                      value={driverComparisonA.physical}
                      label="CONDIÇÃO FÍSICA"
                      size="sm"
                      valueFormatter={(v) => `${v}%`}
                    />
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Pontos na Temporada:</span>
                      <strong className="text-cyan-400">{driverComparisonA.points} pts</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Salário Anual:</span>
                      <strong className="text-emerald-400">
                        {formatCurrency(driverComparisonA.salary)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Piloto B */}
                <div
                  className="p-5 rounded-2xl bg-[#090D14] border space-y-4"
                  style={{ borderColor: `${driverComparisonB.teamColor}66` }}
                >
                  <div className="flex items-center gap-3">
                    <DriverPhotoAvatar
                      name={driverComparisonB.name}
                      teamColor={driverComparisonB.teamColor}
                      size="xl"
                      className="border-2"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{driverComparisonB.flag}</span>
                        <h3 className="font-bold text-base text-white">{driverComparisonB.name}</h3>
                      </div>
                      <p className="text-xs font-mono text-[#8B95A7]">
                        {driverComparisonB.teamName}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    <ProgressBar
                      value={driverComparisonB.speed}
                      label="VELOCIDADE"
                      size="sm"
                      valueFormatter={(v) => `${v}`}
                    />
                    <ProgressBar
                      value={driverComparisonB.consistency}
                      label="CONSISTÊNCIA"
                      size="sm"
                      valueFormatter={(v) => `${v}`}
                    />
                    <ProgressBar
                      value={driverComparisonB.morale}
                      label="MORAL"
                      size="sm"
                      valueFormatter={(v) => `${v}%`}
                    />
                    <ProgressBar
                      value={driverComparisonB.physical}
                      label="CONDIÇÃO FÍSICA"
                      size="sm"
                      valueFormatter={(v) => `${v}%`}
                    />
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Pontos na Temporada:</span>
                      <strong className="text-cyan-400">{driverComparisonB.points} pts</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-[#11161F]">
                      <span className="text-[#8B95A7]">Salário Anual:</span>
                      <strong className="text-emerald-400">
                        {formatCurrency(driverComparisonB.salary)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL COMPLETO: FICHA TÉCNICA E INSTITUCIONAL DA EQUIPE                   */}
      {/* ========================================================================= */}
      <Dialog
        open={!!selectedTeamDetail}
        onOpenChange={(open) => !open && setSelectedTeamDetail(null)}
      >
        <DialogContent className="bg-[#0B0F17] border-[#1F2733] text-[#F5F7FA] max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
          {selectedTeamDetail && (
            <div className="space-y-6">
              {/* Header com Logo, Nome, Sede e Status */}
              <DialogHeader className="space-y-3 pb-3 border-b border-[#1C2330]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    {selectedTeamDetail.logoUrl ? (
                      <div className="w-14 h-14 rounded-2xl bg-[#090D14] border border-[#1F2733] p-1.5 flex items-center justify-center shrink-0 shadow-lg overflow-hidden">
                        <img
                          src={selectedTeamDetail.logoUrl}
                          alt={selectedTeamDetail.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            if (e.currentTarget.parentElement) {
                              e.currentTarget.parentElement.innerHTML = `<span class="font-mono font-black text-base text-white">${selectedTeamDetail.shortName.substring(0, 2).toUpperCase()}</span>`
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg text-white font-mono shrink-0 shadow-lg border"
                        style={{
                          backgroundColor:
                            selectedTeamDetail.key === 'cadillac'
                              ? '#1B170B'
                              : selectedTeamDetail.key === 'toyota'
                                ? '#200709'
                                : '#11161F',
                          borderColor:
                            selectedTeamDetail.key === 'cadillac'
                              ? '#D4AF37'
                              : selectedTeamDetail.key === 'toyota'
                                ? '#EB0A1E'
                                : selectedTeamDetail.color,
                          color:
                            selectedTeamDetail.key === 'cadillac'
                              ? '#D4AF37'
                              : selectedTeamDetail.key === 'toyota'
                                ? '#EB0A1E'
                                : '#FFFFFF',
                        }}
                      >
                        {selectedTeamDetail.shortName.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-[10px] font-mono text-[#8B95A7] uppercase font-bold tracking-wider">
                        FICHA TÉCNICA OFICIAL // CONSTRUTORA
                      </div>
                      <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
                        <span>{selectedTeamDetail.name}</span>
                        {selectedTeamDetail.isUserTeam && (
                          <Badge className="bg-[#E10600] text-white text-[9px] font-mono">
                            SUA EQUIPE
                          </Badge>
                        )}
                      </DialogTitle>
                      <div className="flex items-center gap-2 pt-0.5 text-xs text-[#8B95A7] font-mono">
                        <span>
                          {selectedTeamDetail.country} {selectedTeamDetail.flag}
                        </span>
                        <span>•</span>
                        <span className="text-cyan-400">{selectedTeamDetail.category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {selectedTeamDetail.inCurrentGrid ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-mono px-2 py-0.5">
                        No Grid 2026
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono px-2 py-0.5">
                        Fora do grid atual
                      </Badge>
                    )}
                  </div>
                </div>
              </DialogHeader>

              {/* Imagem do Carro Correspondente */}
              <div className="relative rounded-2xl bg-[#070A0F] border border-[#1A222F] p-4 overflow-hidden group">
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: selectedTeamDetail.color }}
                />
                <div className="flex items-center justify-between pb-2">
                  <span className="text-[10px] font-mono uppercase text-[#8B95A7] font-bold tracking-wider">
                    Carro Oficial 2026 // Aerodinâmica Regulamento Ativo
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400">
                    Motor {selectedTeamDetail.engine}
                  </span>
                </div>
                <div className="w-full h-44 sm:h-52 flex items-center justify-center p-2">
                  <img
                    src={selectedTeamDetail.carImageUrl}
                    alt={`Carro ${selectedTeamDetail.name}`}
                    className="max-h-full max-w-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              </div>

              {/* Informações Institucionais Primárias */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                <div className="p-3 rounded-xl bg-[#090D14] border border-[#1A222F]">
                  <span className="text-[10px] text-[#64748B] uppercase block">Motor</span>
                  <strong className="text-cyan-400 text-sm font-bold block truncate">
                    {selectedTeamDetail.engine}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-[#090D14] border border-[#1A222F]">
                  <span className="text-[10px] text-[#64748B] uppercase block">Força Geral</span>
                  <strong className="text-amber-400 text-sm font-bold block">
                    {selectedTeamDetail.strengthRating.toFixed(1)} / 10
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-[#090D14] border border-[#1A222F]">
                  <span className="text-[10px] text-[#64748B] uppercase block">Dificuldade</span>
                  <strong className="text-white text-sm font-bold block truncate">
                    {selectedTeamDetail.difficulty}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-[#090D14] border border-[#1A222F]">
                  <span className="text-[10px] text-[#64748B] uppercase block">
                    Orçamento / Caixa
                  </span>
                  <strong className="text-emerald-400 text-sm font-bold block truncate">
                    {formatCurrency(selectedTeamDetail.budget)}
                  </strong>
                </div>
              </div>

              {/* Sede e Categoria */}
              <div className="p-3 rounded-xl bg-[#090D14] border border-[#1A222F] text-xs font-mono space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                  <span className="text-[#8B95A7]">Sede da Fábrica:</span>
                  <strong className="text-white">{selectedTeamDetail.headquarters}</strong>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                  <span className="text-[#8B95A7]">Categoria da Equipe:</span>
                  <strong className="text-cyan-400">{selectedTeamDetail.category}</strong>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                  <span className="text-[#8B95A7]">Pressão da Diretoria:</span>
                  <strong className="text-amber-400">{selectedTeamDetail.boardPressure}</strong>
                </div>
              </div>

              {/* Barras de Atributos Técnicos e Institucionais */}
              <div className="p-4 rounded-xl bg-[#090D14] border border-[#1A222F] space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white font-bold uppercase tracking-wider text-[11px]">
                    Atributos Técnicos & Estruturais
                  </span>
                  <span className="text-[10px] text-[#64748B] font-mono">Índice 0 a 100</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <ProgressBar
                    value={selectedTeamDetail.carRating}
                    label="CARRO (DESEMPENHO)"
                    size="sm"
                    valueFormatter={(v) => `${v}`}
                  />
                  <ProgressBar
                    value={selectedTeamDetail.engineeringRating}
                    label="ENGENHARIA"
                    size="sm"
                    valueFormatter={(v) => `${v}`}
                  />
                  <ProgressBar
                    value={Math.round((selectedTeamDetail.infrastructureRating / 5) * 100)}
                    label="INFRAESTRUTURA"
                    size="sm"
                    valueFormatter={(v) => `${selectedTeamDetail.infrastructureRating}/5 (${v}%)`}
                  />
                  <ProgressBar
                    value={selectedTeamDetail.operationsRating}
                    label="OPERAÇÕES"
                    size="sm"
                    valueFormatter={(v) => `${v}`}
                  />
                  <ProgressBar
                    value={Math.round((selectedTeamDetail.financesRating / 5) * 100)}
                    label="FINANÇAS"
                    size="sm"
                    valueFormatter={(v) => `${selectedTeamDetail.financesRating}/5 (${v}%)`}
                  />
                  <ProgressBar
                    value={selectedTeamDetail.prestigeRating}
                    label="PRESTÍGIO"
                    size="sm"
                    valueFormatter={(v) => `${v}`}
                  />
                  <ProgressBar
                    value={selectedTeamDetail.cultureRating}
                    label="CULTURA"
                    size="sm"
                    valueFormatter={(v) => `${v}`}
                  />
                  <ProgressBar
                    value={selectedTeamDetail.potentialRating}
                    label="POTENCIAL"
                    size="sm"
                    valueFormatter={(v) => `${v}`}
                  />
                </div>
              </div>

              {/* Traços Especiais */}
              {selectedTeamDetail.specialTraits && selectedTeamDetail.specialTraits.length > 0 && (
                <div className="p-3.5 rounded-xl bg-[#090D14] border border-[#1A222F] space-y-2">
                  <span className="text-[10px] font-mono uppercase text-[#8B95A7] font-bold tracking-wider block">
                    Traços Especiais da Equipe
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTeamDetail.specialTraits.map((trait, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="bg-[#141B26] text-cyan-300 border-cyan-500/30 text-xs font-mono px-2 py-0.5"
                      >
                        {trait}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Seção Condicional do Campeonato: Posição, Pontos, Vitórias e Pilotos */}
              {selectedTeamDetail.inCurrentGrid ? (
                <div className="p-4 rounded-xl bg-[#090D14] border border-[#1A222F] space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-white font-bold uppercase tracking-wider text-[11px]">
                      Campeonato F1 {season?.year || 2026}
                    </span>
                    <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
                      Pontuação Ativa
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center font-mono">
                    <div className="p-2 rounded-lg bg-[#11161F]">
                      <span className="text-[9px] text-[#64748B] uppercase block">Posição</span>
                      <strong className="text-white text-sm font-bold">
                        {selectedTeamDetail.position > 0
                          ? `${selectedTeamDetail.position}º Lugar`
                          : '—'}
                      </strong>
                    </div>
                    <div className="p-2 rounded-lg bg-[#11161F]">
                      <span className="text-[9px] text-[#64748B] uppercase block">Pontos</span>
                      <strong className="text-cyan-400 text-sm font-bold">
                        {selectedTeamDetail.points} pts
                      </strong>
                    </div>
                    <div className="p-2 rounded-lg bg-[#11161F]">
                      <span className="text-[9px] text-[#64748B] uppercase block">Vitórias</span>
                      <strong className="text-amber-400 text-sm font-bold">
                        {selectedTeamDetail.wins}
                      </strong>
                    </div>
                  </div>

                  {/* Pilotos Titulares e Reserva do Campeonato */}
                  <div className="space-y-2 pt-1 font-mono text-xs">
                    <span className="text-[10px] text-[#8B95A7] uppercase font-bold block">
                      Pilotos Titulares Oficiais
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedTeamDetail.driver1 && (
                        <div className="p-2.5 rounded-lg bg-[#11161F] border border-[#1F2733] flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate">
                            <span>{selectedTeamDetail.driver1.flag}</span>
                            <span className="text-white font-bold truncate">
                              {selectedTeamDetail.driver1.name}
                            </span>
                          </div>
                          <span className="text-emerald-400 font-bold text-[11px] shrink-0">
                            {selectedTeamDetail.driver1.speed} VEL
                          </span>
                        </div>
                      )}
                      {selectedTeamDetail.driver2 && (
                        <div className="p-2.5 rounded-lg bg-[#11161F] border border-[#1F2733] flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate">
                            <span>{selectedTeamDetail.driver2.flag}</span>
                            <span className="text-white font-bold truncate">
                              {selectedTeamDetail.driver2.name}
                            </span>
                          </div>
                          <span className="text-emerald-400 font-bold text-[11px] shrink-0">
                            {selectedTeamDetail.driver2.speed} VEL
                          </span>
                        </div>
                      )}
                    </div>

                    {selectedTeamDetail.reserveDriver && (
                      <div className="pt-1">
                        <span className="text-[10px] text-[#8B95A7] uppercase font-bold block">
                          Piloto Reserva
                        </span>
                        <div className="p-2 rounded-lg bg-[#11161F] border border-[#1F2733] flex items-center justify-between mt-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span>{selectedTeamDetail.reserveDriver.flag}</span>
                            <span className="text-white truncate">
                              {selectedTeamDetail.reserveDriver.name}
                            </span>
                          </div>
                          <span className="text-amber-400 text-[11px] shrink-0">
                            {selectedTeamDetail.reserveDriver.speed} VEL
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#090D14]/70 border border-[#1A222F] text-xs font-mono space-y-1">
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="font-bold uppercase text-[11px]">
                      Status: Fora do grid atual
                    </span>
                  </div>
                  <p className="text-[#8B95A7] leading-relaxed text-[11px]">
                    Esta escuderia pertence ao acervo histórico/reserva da Fórmula 1 e não está
                    inscrita na temporada de 2026. Por isso, não pontua no campeonato e não possui
                    pilotos titulares associados.
                  </p>
                </div>
              )}

              {/* Situação Atual e Histórico */}
              <div className="p-3.5 rounded-xl bg-[#090D14] border border-[#1A222F] text-xs space-y-2">
                <span className="text-[10px] font-mono uppercase text-[#64748B] font-bold block">
                  Situação e Histórico
                </span>
                <p className="text-[#CBD5E1] leading-relaxed">
                  {selectedTeamDetail.currentSituation}
                </p>
                {selectedTeamDetail.historySummary && (
                  <p className="text-[11px] text-[#8B95A7] pt-2 border-t border-[#1C2330]">
                    {selectedTeamDetail.historySummary}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL SIMPLES: DETALHE DO PILOTO                                          */}
      {/* ========================================================================= */}
      <Dialog
        open={!!selectedDriverDetail}
        onOpenChange={(open) => !open && setSelectedDriverDetail(null)}
      >
        <DialogContent className="bg-[#0F141C] border-[#1F2733] text-[#F5F7FA] max-w-md">
          {selectedDriverDetail && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <DriverPhotoAvatar
                    name={selectedDriverDetail.name}
                    teamColor={selectedDriverDetail.teamColor}
                    size="lg"
                    className="border-2"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{selectedDriverDetail.flag}</span>
                      <DialogTitle className="text-lg font-bold text-white">
                        {selectedDriverDetail.name}
                      </DialogTitle>
                    </div>
                    <p className="text-xs font-mono text-[#8B95A7]">
                      {selectedDriverDetail.teamName} • {selectedDriverDetail.age} anos
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-[#090D14] border border-[#1A222F]">
                  <span className="text-[10px] text-[#64748B] block">Velocidade</span>
                  <strong className="text-cyan-400 text-sm">{selectedDriverDetail.speed}</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-[#090D14] border border-[#1A222F]">
                  <span className="text-[10px] text-[#64748B] block">Consistência</span>
                  <strong className="text-white text-sm">{selectedDriverDetail.consistency}</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-[#090D14] border border-[#1A222F]">
                  <span className="text-[10px] text-[#64748B] block">Pontos 2026</span>
                  <strong className="text-amber-400 text-sm">
                    {selectedDriverDetail.points} pts
                  </strong>
                </div>
                <div className="p-2.5 rounded-lg bg-[#090D14] border border-[#1A222F]">
                  <span className="text-[10px] text-[#64748B] block">Salário Anual</span>
                  <strong className="text-emerald-400 text-sm">
                    {selectedDriverDetail.salary > 0
                      ? formatCurrency(selectedDriverDetail.salary)
                      : 'Agente Livre'}
                  </strong>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#090D14] border border-[#1A222F] text-xs font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Condição Física:</span>
                  <span className="text-white font-bold">{selectedDriverDetail.physical}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Moral com a Equipe:</span>
                  <span className="text-white font-bold">{selectedDriverDetail.morale}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Vínculo Contratual:</span>
                  <span className="text-cyan-400 font-bold">
                    Até {selectedDriverDetail.contractEnd}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
