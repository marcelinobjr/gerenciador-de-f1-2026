import { getAICompetitors } from '@/lib/f1-data'
import { normalizeEntityName, getFiaPointsForPosition } from '@/lib/f1-standings-calculator'
import { resolveCountryFlag } from '@/lib/country-flag'
import { getActiveDriverTeamBinding } from '@/lib/canonical-driver-database'
import type { TeamModel, DriverModel, RaceResultModel, SeasonModel, PartModel } from '@/types/f1'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { canonicalChampionshipMigrationService } from '@/services/canonicalChampionshipMigrationService'
import { resolveCanonicalCareerId } from '@/lib/canonical-career-id'

export interface DriverStanding {
  id: string
  name: string
  nationality: string
  flag: string
  teamName: string
  teamColor: string
  points: number
  wins: number
  podiums: number
  bestPosition: number
  isPlayer: boolean
  secondPlaces?: number
  thirdPlaces?: number
  fourthPlaces?: number
  raceStarts?: number
  racesCounted?: number
  finishCounts?: Record<number, number>
  gapToLeader?: string
  positionDelta?: number
  positionDeltaText?: string
  totalPenaltiesSec?: number
  penaltiesCount?: number
}

export interface TeamStanding {
  id: string
  name: string
  color: string
  engine: string
  points: number
  wins: number
  podiums: number
  bestPosition: number
  isPlayer: boolean
  racesCounted?: number
  finishCounts?: Record<number, number>
  gapToLeader?: string
  positionDelta?: number
  positionDeltaText?: string
}

export interface FullStandingsResult {
  driverStandings: DriverStanding[]
  constructorStandings: TeamStanding[]
  driverPointsMap: Record<string, number>
  teamPoints: number
  playerConstructorRank: number | null
  playerWins: number
  playerPodiums: number
}

export interface CalculateStandingsParams {
  raceResults: RaceResultModel[]
  playerDrivers?: DriverModel[]
  team?: TeamModel | null
  season?: SeasonModel | null
}

export interface GetTeamMoraleParams {
  teamPoints: number
  constructorRank: number
  parts?: Array<{ level?: number }>
  managerMoraleBonus?: number
}
/**
 * Calcula os pontos FIA oficiais (25-18-15-12-10-8-6-4-2-1) sem bonificação de volta mais rápida.
 * Se o resultado persistido já possui `points > 0`, respeita o valor persistido.
 */
export function calculatePointsForResults(
  result: Pick<RaceResultModel, 'position' | 'points'>,
): number {
  if (typeof result.points === 'number' && result.points > 0) {
    return result.points
  }
  return getFiaPointsForPosition(result.position)
}

/**
 * Calcula a moral da equipe (0 a 100) baseada no nível médio das peças,
 * pontuação no campeonato de construtores e classificação atual.
 */
export function getTeamMorale(params: GetTeamMoraleParams): number {
  const { teamPoints, constructorRank, parts = [], managerMoraleBonus = 0 } = params
  const avgParts =
    parts.length > 0 ? parts.reduce((acc, p) => acc + (p.level || 5), 0) / parts.length : 5

  let calcMorale = Math.round(50 + (avgParts - 5) * 4 + Math.min(25, teamPoints / 3))
  if (constructorRank <= 3) {
    calcMorale += 10
  } else if (constructorRank <= 6) {
    calcMorale += 5
  }

  // Modificador de moral do Team Principal (peopleManagement: -4% a +8%)
  // Protege a moral da equipe em momentos difíceis e melhora coesão interna
  const clampedBonus = Math.max(-0.04, Math.min(0.08, managerMoraleBonus))
  if (clampedBonus !== 0) {
    calcMorale = Math.round(calcMorale * (1 + clampedBonus))
  }

  return Math.max(10, Math.min(100, calcMorale))
}

/**
 * Calcula a classificação unificada do campeonato (Pilotos e Construtores)
 * seguindo a fonte de verdade consolidada em Standings.tsx.
 */
export function calculateStandings(params: CalculateStandingsParams): FullStandingsResult {
  const { raceResults = [], playerDrivers = [], team, season } = params
  const currentRound = season?.current_round || 1
  const careerId = resolveCanonicalCareerId(season, team)
  const seasonYear = season?.year || 2026

  // Reconciliação sob demanda síncrona ANTES de consultar getEligibleOfficialRaceResults
  const legacyCandidateIds = [team?.id, (season as any)?.team_id].filter(
    (id): id is string => typeof id === 'string' && id.trim() !== '' && id !== careerId,
  )
  if (legacyCandidateIds.length > 0) {
    try {
      canonicalChampionshipMigrationService.reconcileLegacyCareerResults({
        canonicalCareerId: careerId,
        legacyCareerIds: legacyCandidateIds,
        seasonYear,
      })
    } catch {
      // tolerante a falha de reconciliação
    }
  }

  // FW2.1E-H: Se houver resultados oficiais ou carreira ativa, verificar se podemos consultar o serviço canônico
  // Verificamos se há corridas oficiais registradas para a carreira via canonicalChampionshipService
  const canonicalResults = canonicalChampionshipService.getEligibleOfficialRaceResults(
    careerId,
    seasonYear,
  )

  if (canonicalResults.length > 0) {
    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      seasonYear,
      undefined,
      team?.id,
    )

    // Converter driverStandings do snapshot para DriverStanding
    const driverStandings: DriverStanding[] = snap.driverStandings.map((d) => {
      const binding = getActiveDriverTeamBinding(d.driverId)
      const resolvedTeamName =
        binding?.isContracted && binding?.teamName
          ? binding.teamName
          : d.currentTeamName || 'Sem Equipe'
      const resolvedTeamColor = binding?.teamColor || d.currentTeamColor || '#71717A'

      return {
        id: d.driverId,
        name: d.driverName,
        nationality: d.nationality,
        flag: d.flag,
        teamName: resolvedTeamName,
        teamColor: resolvedTeamColor,
        points: d.points,
        wins: d.wins,
        secondPlaces: d.secondPlaces,
        thirdPlaces: d.thirdPlaces,
        fourthPlaces: d.fourthPlaces,
        podiums: d.podiums,
        bestPosition: d.position,
        isPlayer: !!d.isPlayer,
        raceStarts: d.raceStarts,
        racesCounted: d.racesCounted,
        finishCounts: d.finishCounts,
        gapToLeader: d.gapToLeader,
        positionDelta: d.positionDelta,
        positionDeltaText: d.positionDeltaText,
      }
    })

    // Converter constructorStandings do snapshot para TeamStanding
    const constructorStandings: TeamStanding[] = snap.constructorStandings.map((c) => ({
      id: c.teamId,
      name: c.teamName,
      color: c.teamColor,
      engine: 'F1 Power Unit',
      points: c.points,
      wins: c.wins,
      podiums: c.podiums,
      bestPosition: c.position,
      isPlayer: !!c.isPlayer,
      racesCounted: c.racesCounted,
      finishCounts: c.finishCounts,
      gapToLeader: c.gapToLeader,
      positionDelta: c.positionDelta,
      positionDeltaText: c.positionDeltaText,
    }))

    const playerTeamRank = constructorStandings.findIndex((c) => c.isPlayer) + 1
    const playerStanding = constructorStandings.find((c) => c.isPlayer)

    const driverPointsMap: Record<string, number> = {}
    playerDrivers.forEach((d) => {
      const match = driverStandings.find((sd) => sd.id === d.id || sd.name === d.name)
      driverPointsMap[d.id] = match?.points || 0
    })

    return {
      driverStandings,
      constructorStandings,
      driverPointsMap,
      teamPoints: playerStanding?.points ?? 0,
      playerConstructorRank: playerTeamRank > 0 ? playerTeamRank : null,
      playerWins: playerStanding?.wins || 0,
      playerPodiums: playerStanding?.podiums || 0,
    }
  }

  // Se não há resultados canônicos nem corridas oficiais, consultar grid canônico neutro
  const filteredResults = season?.id
    ? raceResults.filter((r) => !r.season_id || r.season_id === season.id)
    : raceResults

  const recordedRounds = new Set<number>()
  filteredResults.forEach((r) => {
    if (typeof r.round === 'number') {
      recordedRounds.add(r.round)
    }
  })
  const hasRecordedResults = recordedRounds.size > 0

  // Se não há corridas oficiais registradas em race_results nem no serviço canônico,
  // utilizar o grid canônico neutro (todas as 12 equipes oficiais participantes com 0 pontos)
  // sem simulação paralela ou inventar posições.
  if (!hasRecordedResults) {
    const neutral = canonicalChampionshipService.buildNeutralSeasonGrid(team?.id || team?.team_key)
    const neutralDriverStandings: DriverStanding[] = neutral.drivers.map((d) => ({
      id: d.driverId,
      name: d.driverName,
      nationality: d.nationality,
      flag: d.flag,
      teamName: d.currentTeamName || 'Sem Equipe',
      teamColor: d.currentTeamColor || '#71717A',
      points: 0,
      wins: 0,
      podiums: 0,
      bestPosition: d.position,
      isPlayer: !!d.isPlayer,
      racesCounted: 0,
      finishCounts: {},
      gapToLeader: '—',
      positionDelta: 0,
      positionDeltaText: '—',
    }))

    const neutralConstructorStandings: TeamStanding[] = neutral.constructors.map((c) => ({
      id: c.teamId,
      name: c.teamName,
      color: c.teamColor,
      engine: 'F1 Power Unit',
      points: 0,
      wins: 0,
      podiums: 0,
      bestPosition: c.position,
      isPlayer: !!c.isPlayer,
      racesCounted: 0,
      finishCounts: {},
      gapToLeader: '—',
      positionDelta: 0,
      positionDeltaText: '—',
    }))

    return {
      driverStandings: neutralDriverStandings,
      constructorStandings: neutralConstructorStandings,
      driverPointsMap: {},
      teamPoints: 0,
      playerConstructorRank: null,
      playerWins: 0,
      playerPodiums: 0,
    }
  }

  const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
  const aiGrid = getAICompetitors(team?.team_key, isCustomTeam)
  // 1. Mapa de pilotos
  const dMap: Record<string, DriverStanding> = {}

  // Inicializa pilotos do jogador
  playerDrivers.forEach((d) => {
    const binding = getActiveDriverTeamBinding(d.id)
    const resolvedTeamName =
      (binding?.isContracted && binding.teamName) || team?.name || 'Escuderia Brasil'
    const resolvedTeamColor =
      (binding?.isContracted && binding.teamColor) || team?.color || '#FF3B30'

    dMap[d.id] = {
      id: d.id,
      name: d.name,
      nationality: d.nationality,
      flag: resolveCountryFlag(d.nationality),
      teamName: resolvedTeamName,
      teamColor: resolvedTeamColor,
      points: 0,
      wins: 0,
      podiums: 0,
      bestPosition: 99,
      isPlayer: true,
    }
  })

  // Inicializa pilotos da IA
  aiGrid.forEach((aiTeam) => {
    const d1Key = `${aiTeam.id}_d1`
    const d2Key = `${aiTeam.id}_d2`

    const d1Binding = getActiveDriverTeamBinding((aiTeam.driver1 as any).id || aiTeam.driver1.name)
    const d1TeamName = (d1Binding?.isContracted && d1Binding.teamName) || aiTeam.name
    const d1TeamColor = (d1Binding?.isContracted && d1Binding.teamColor) || aiTeam.color

    dMap[d1Key] = {
      id: d1Key,
      name: aiTeam.driver1.name,
      nationality: aiTeam.driver1.nationality,
      flag: resolveCountryFlag(aiTeam.driver1.nationality || aiTeam.driver1.flag),
      teamName: d1TeamName,
      teamColor: d1TeamColor,
      points: 0,
      wins: 0,
      podiums: 0,
      bestPosition: 99,
      isPlayer: false,
    }

    const d2Binding = getActiveDriverTeamBinding((aiTeam.driver2 as any).id || aiTeam.driver2.name)
    const d2TeamName = (d2Binding?.isContracted && d2Binding.teamName) || aiTeam.name
    const d2TeamColor = (d2Binding?.isContracted && d2Binding.teamColor) || aiTeam.color

    dMap[d2Key] = {
      id: d2Key,
      name: aiTeam.driver2.name,
      nationality: aiTeam.driver2.nationality,
      flag: resolveCountryFlag(aiTeam.driver2.nationality || aiTeam.driver2.flag),
      teamName: d2TeamName,
      teamColor: d2TeamColor,
      points: 0,
      wins: 0,
      podiums: 0,
      bestPosition: 99,
      isPlayer: false,
    }
  })

  // Prepara índices de busca rápida por ID e por nome normalizado
  const driverLookupByName: Record<string, DriverStanding> = {}
  const driverLookupByNormalizedSimple: Record<string, DriverStanding> = {}

  Object.values(dMap).forEach((d) => {
    const norm1 = normalizeEntityName(d.name)
    const norm2 = d.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '')
    driverLookupByName[norm1] = d
    driverLookupByNormalizedSimple[norm2] = d
  })

  // 2. Processa race_results reais persistidos no banco
  // Rastreia se resultados da equipe do jogador foram contabilizados diretamente caso playerDrivers não tenha sido passado
  let fallbackPlayerPts = 0
  let fallbackPlayerWins = 0
  let fallbackPlayerPodiums = 0
  let fallbackPlayerBestPos = 99
  let fallbackPlayerFound = false

  filteredResults.forEach((res) => {
    let targetDriver = dMap[res.driver_id]

    // Expand do PocketBase
    if (!targetDriver && res.expand?.driver_id?.name) {
      const normExp = normalizeEntityName(res.expand.driver_id.name)
      const normExpSimple = res.expand.driver_id.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '')
      targetDriver = driverLookupByName[normExp] || driverLookupByNormalizedSimple[normExpSimple]
    }

    // driverName direto
    if (!targetDriver && (res as any).driverName) {
      const dName = (res as any).driverName
      const normDirect = normalizeEntityName(dName)
      const normDirectSimple = dName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '')
      targetDriver =
        driverLookupByName[normDirect] || driverLookupByNormalizedSimple[normDirectSimple]
    }

    // Busca por substring
    if (!targetDriver) {
      const allDrivers = Object.values(dMap)
      const expName = res.expand?.driver_id?.name?.toLowerCase().trim()
      if (expName) {
        targetDriver = allDrivers.find((d) => {
          const dn = d.name.toLowerCase().trim()
          return dn === expName || dn.includes(expName) || expName.includes(dn)
        })
      }
    }

    if (targetDriver) {
      const pts = calculatePointsForResults(res)
      targetDriver.points += pts

      if (res.position === 1) {
        targetDriver.wins += 1
        targetDriver.podiums += 1
      } else if (res.position <= 3) {
        targetDriver.podiums += 1
      }

      if (res.position < targetDriver.bestPosition) {
        targetDriver.bestPosition = res.position
      }

      // Penalidades de tempo acumuladas
      const penaltySec =
        (res as any).timePenaltySec ??
        (res as any).penalty_seconds ??
        (res as any).time_penalty_sec ??
        0
      if (penaltySec > 0) {
        targetDriver.totalPenaltiesSec = (targetDriver.totalPenaltiesSec || 0) + penaltySec
        targetDriver.penaltiesCount = (targetDriver.penaltiesCount || 0) + 1
      }
    } else {
      // Caso o piloto não esteja em dMap mas seja da equipe do jogador (ex: chamada sem playerDrivers)
      const isPlayerResult =
        res.team_id === team?.id ||
        res.expand?.team_id?.name === team?.name ||
        (team?.name && (res as any).teamName === team.name)

      if (isPlayerResult) {
        fallbackPlayerFound = true
        const pts = calculatePointsForResults(res)
        fallbackPlayerPts += pts
        if (res.position === 1) {
          fallbackPlayerWins += 1
          fallbackPlayerPodiums += 1
        } else if (res.position <= 3) {
          fallbackPlayerPodiums += 1
        }
        if (res.position < fallbackPlayerBestPos) {
          fallbackPlayerBestPos = res.position
        }
      }
    }
  })

  // Ordenação de pilotos: Pontos DESC > Vitórias DESC > Pódios DESC > Melhor Posição ASC > Nome ASC
  const sortedDrivers = Object.values(dMap).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.wins !== a.wins) return b.wins - a.wins
    if (b.podiums !== a.podiums) return b.podiums - a.podiums
    if (a.bestPosition !== b.bestPosition) return a.bestPosition - b.bestPosition
    return a.name.localeCompare(b.name)
  })

  // 3. Teams map (Construtores)
  const tMap: Record<string, TeamStanding> = {}

  // Helper para normalizar identificação e nome de equipe para correspondência resiliente
  const normalizeTeamKeyOrName = (str: string): string =>
    str
      .toLowerCase()
      .replace(/^ai_/, '')
      .replace(/f1|team|racing|scuderia|motorsport/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim()

  // Equipes da IA
  aiGrid.forEach((aiTeam) => {
    // 1. Pontos somados inicialmente via dMap dos slots de piloto da IA (se vinculados aos IDs d1/d2)
    const d1 = dMap[`${aiTeam.id}_d1`]
    const d2 = dMap[`${aiTeam.id}_d2`]
    let pts = (d1?.points || 0) + (d2?.points || 0)
    let w = (d1?.wins || 0) + (d2?.wins || 0)
    let pod = (d1?.podiums || 0) + (d2?.podiums || 0)
    let best = Math.min(d1?.bestPosition ?? 99, d2?.bestPosition ?? 99)

    // 2. Correspondência resiliente com race_results caso team_id venha com ID do PocketBase ou expand.team_id.name
    // Ex: team_id alfanumérico do PocketBase, ou ai_{team_key}, ou nome da equipe
    const aiCleanName = normalizeTeamKeyOrName(aiTeam.name)
    const aiCleanId = normalizeTeamKeyOrName(aiTeam.id)

    // Agregação a partir dos pilotos associados a esta equipe em dMap cujos nomes ou times casam
    const matchedDrivers = Object.values(dMap).filter((d) => {
      if (d.isPlayer) return false
      if (d.id === `${aiTeam.id}_d1` || d.id === `${aiTeam.id}_d2`) return false
      const dTeamNorm = normalizeTeamKeyOrName(d.teamName || '')
      return (
        dTeamNorm === aiCleanName ||
        dTeamNorm === aiCleanId ||
        d.teamName?.toLowerCase() === aiTeam.name.toLowerCase()
      )
    })

    if (matchedDrivers.length > 0) {
      matchedDrivers.forEach((md) => {
        pts += md.points
        w += md.wins
        pod += md.podiums
        if (md.bestPosition < best) {
          best = md.bestPosition
        }
      })
    }

    // 3. Se houver race_results gravando team_id ou expand.team_id.name que não casaram pilotos
    filteredResults.forEach((res) => {
      const isPlayerResult =
        res.team_id === team?.id ||
        res.expand?.team_id?.name === team?.name ||
        (team?.name && (res as any).teamName === team.name)
      if (isPlayerResult) return

      const resTeamName = res.expand?.team_id?.name || (res as any).teamName || ''
      const resTeamId = res.team_id || ''
      const cleanResName = normalizeTeamKeyOrName(resTeamName)
      const cleanResId = normalizeTeamKeyOrName(resTeamId)

      const matchesTeam =
        (cleanResName && (cleanResName === aiCleanName || cleanResName === aiCleanId)) ||
        (cleanResId && (cleanResId === aiCleanName || cleanResId === aiCleanId))

      // Se bate e o piloto NÃO foi computado em dMap
      if (matchesTeam && !dMap[res.driver_id]) {
        const p = calculatePointsForResults(res)
        pts += p
        if (res.position === 1) w += 1
        if (res.position <= 3) pod += 1
        if (res.position < best) best = res.position
      }
    })

    tMap[aiTeam.id] = {
      id: aiTeam.id,
      name: aiTeam.name,
      color: aiTeam.color,
      engine: aiTeam.engine,
      points: pts,
      wins: w,
      podiums: pod,
      bestPosition: best,
      isPlayer: false,
    }
  })

  // Equipe do jogador
  let playerTeamPts = 0
  let playerTeamWins = 0
  let playerTeamPodiums = 0
  let playerTeamBestPos = 99

  if (playerDrivers.length > 0) {
    playerDrivers.forEach((d) => {
      const standing = dMap[d.id]
      if (standing) {
        playerTeamPts += standing.points
        playerTeamWins += standing.wins
        playerTeamPodiums += standing.podiums
        if (standing.bestPosition < playerTeamBestPos) {
          playerTeamBestPos = standing.bestPosition
        }
      }
    })
  } else if (fallbackPlayerFound) {
    playerTeamPts = fallbackPlayerPts
    playerTeamWins = fallbackPlayerWins
    playerTeamPodiums = fallbackPlayerPodiums
    playerTeamBestPos = fallbackPlayerBestPos
  }
  // Dedução de pontos FIA por violação de teto de gastos
  const fiaDeduction = team?.constructors_points_deduction || 0
  const netPlayerTeamPts = Math.max(0, playerTeamPts - fiaDeduction)

  const playerTeamId = team?.id || 'player'
  tMap[playerTeamId] = {
    id: playerTeamId,
    name: team?.name || 'Escuderia Brasil',
    color: team?.color || '#FF3B30',
    engine: team?.engine_supplier || 'Mercedes',
    points: netPlayerTeamPts,
    wins: playerTeamWins,
    podiums: playerTeamPodiums,
    bestPosition: playerTeamBestPos,
    isPlayer: true,
  }

  // Ordenação de equipes: Pontos DESC > Vitórias DESC > Pódios DESC > Melhor Posição ASC > Nome ASC
  const sortedTeams = Object.values(tMap).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.wins !== a.wins) return b.wins - a.wins
    if (b.podiums !== a.podiums) return b.podiums - a.podiums
    if (a.bestPosition !== b.bestPosition) return a.bestPosition - b.bestPosition
    return a.name.localeCompare(b.name)
  })

  const playerTeamRank = sortedTeams.findIndex((t) => t.isPlayer) + 1
  const playerStanding = sortedTeams.find((t) => t.isPlayer)

  // Mapa de pontos dos pilotos do jogador
  const driverPointsMap: Record<string, number> = {}
  playerDrivers.forEach((d) => {
    driverPointsMap[d.id] = dMap[d.id]?.points || 0
  })

  // Se não houver corridas gravadas e pastRoundsToSimulate for 0 (início de temporada sem corridas oficiais),
  // e nenhum ponto registrado, verificar se standings são válidos
  const hasOfficialRaces = hasRecordedResults || (canonicalResults && canonicalResults.length > 0)
  const isStandingsValid = hasOfficialRaces || sortedTeams.some((t) => (t.points || 0) > 0)

  return {
    driverStandings: sortedDrivers,
    constructorStandings: sortedTeams,
    driverPointsMap,
    teamPoints: isStandingsValid ? (playerStanding?.points ?? netPlayerTeamPts ?? 0) : 0,
    playerConstructorRank: isStandingsValid && playerTeamRank > 0 ? playerTeamRank : null,
    playerWins: playerTeamWins,
    playerPodiums: playerTeamPodiums,
  }
}

/**
 * Retorna a tabela ordenada do campeonato de construtores.
 */
export function getConstructorsStandings(params: CalculateStandingsParams): TeamStanding[] {
  return calculateStandings(params).constructorStandings
}

/**
 * Retorna a tabela ordenada do campeonato de pilotos.
 */
export function getDriversStandings(params: CalculateStandingsParams): DriverStanding[] {
  return calculateStandings(params).driverStandings
}

/**
 * Formata a posição dos construtores para exibição na UI ("3º", "1º", ou "—" quando nulo/inválido).
 */
export function formatConstructorPosition(position: number | null | undefined): string {
  if (position != null && position > 0) {
    return `${position}º`
  }
  return '—'
}

export interface SeasonObjectiveInputs {
  position: number | null
  points: number
  targetRank?: number
  seasonYear?: number
  round?: number
}

export interface SeasonObjectiveProgress {
  percentage: number
  formattedPercentage: string
  isMeeting: boolean
  label: string
}

/**
 * Deriva de forma unificada o progresso do objetivo da temporada a partir dos inputs do snapshot atual.
 * Quando position é nulo (sem standings válidos), retorna estado neutro ("—").
 */
export function calculateSeasonObjectiveProgress(
  inputs: SeasonObjectiveInputs,
): SeasonObjectiveProgress {
  const { position, points = 0, targetRank = 4 } = inputs

  if (position == null || position <= 0) {
    return {
      percentage: 0,
      formattedPercentage: '—',
      isMeeting: false,
      label: '—',
    }
  }

  let pct = 0
  const isMeeting = position <= targetRank

  if (isMeeting) {
    const rankBonus = (targetRank - position + 1) * 10
    pct = Math.min(100, Math.max(50, 60 + rankBonus + Math.min(20, points / 5)))
  } else {
    const gap = position - targetRank
    pct = Math.max(0, Math.min(45, 50 - gap * 10 + Math.min(10, points / 10)))
  }

  const rounded = Math.round(pct)
  return {
    percentage: rounded,
    formattedPercentage: `${rounded}%`,
    isMeeting,
    label: `${rounded}% atingido`,
  }
}

export const standingsService = {
  calculatePointsForResults,
  getTeamMorale,
  calculateStandings,
  getConstructorsStandings,
  getDriversStandings,
  formatConstructorPosition,
  calculateSeasonObjectiveProgress,
}
