import { ALL_GRID_TEAMS_DATABASE, OFFICIAL_2026_GRID_KEYS } from '@/lib/grid-teams-database'
import type { GridTeamDefinition } from '@/types/career-wizard'
import type { TeamModel, DriverModel } from '@/types/f1'
import type { SimDriverEntry } from '@/pages/race/types'
import { calculateCombinedPace } from '@/lib/f1-pace-model'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { carTechnicalService } from '@/services/carTechnicalService'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'

export interface CanonicalGridResolutionResult {
  success: boolean
  grid: SimDriverEntry[]
  teamsCount: number
  driversCount: number
  missingRequirements?: string[]
}

/**
 * Resolve as 12 equipes homologadas para o evento da carreira.
 * Regra canônica:
 * 1. Equipe do jogador (team.custom_grid_teams se existir, contendo as 12 equipes customizadas).
 * 2. Caso contrário, as 12 equipes consagradas de 2026 (OFFICIAL_2026_GRID_KEYS).
 * Se o jogador estiver assumindo uma equipe ou tiver equipe customizada, a equipe do jogador substitui
 * a respectiva vaga ou compõe o conjunto de 12.
 */
export function resolveEventParticipatingTeams(team: TeamModel): GridTeamDefinition[] {
  const customGrid = (team as any)?.custom_grid_teams
  if (Array.isArray(customGrid) && customGrid.length === 12) {
    const resolved: GridTeamDefinition[] = []
    for (const item of customGrid) {
      const key = item.key || item.id || item.name
      const found = ALL_GRID_TEAMS_DATABASE.find(
        (t) =>
          t.key.toLowerCase() === String(key).toLowerCase() ||
          t.name.toLowerCase() === String(item.name || '').toLowerCase(),
      )
      if (found) {
        resolved.push({
          ...found,
          ...(item.color ? { color: item.color } : {}),
          ...(item.engine ? { engine: item.engine } : {}),
        })
      } else {
        // Fallback estruturado a partir dos dados do custom_grid_teams se não estiver no DB
        resolved.push({
          key: String(key).toLowerCase(),
          name: item.name || String(key),
          shortName: item.shortName || item.name?.slice(0, 3)?.toUpperCase() || 'EQU',
          country: item.country || 'Internacional',
          flag: item.flag || '🏁',
          color: item.color || '#94A3B8',
          engine: item.engine || 'Audi',
          strengthRating: item.strength ? item.strength / 10 : 5.0,
          strength: item.strength || 50,
          carLevel: item.strength || 50,
          budget: 150000000,
          competitivenessVerdict: 'Equipe Homologada',
          boardPressure: 'Média',
          difficulty: 'Média',
          initialObjective: 'Pontuar com regularidade',
          infrastructureRating: 3,
          financesRating: 3,
          historySummary: '',
          currentSituation: '',
          driver1: item.driver1 || {
            name: 'Piloto 1',
            nationality: 'Internacional',
            flag: '🏁',
            age: 25,
            speed: 80,
            consistency: 80,
            rain: 80,
            defense: 80,
            salary: 5000000,
          },
          driver2: item.driver2 || {
            name: 'Piloto 2',
            nationality: 'Internacional',
            flag: '🏁',
            age: 24,
            speed: 80,
            consistency: 80,
            rain: 80,
            defense: 80,
            salary: 5000000,
          },
          reserveDriver: item.reserveDriver || {
            name: 'Reserva',
            nationality: 'Internacional',
            flag: '🏁',
            age: 22,
            speed: 75,
            consistency: 75,
            rain: 75,
            defense: 75,
            salary: 2000000,
          },
        })
      }
    }
    if (resolved.length === 12) {
      return resolved
    }
  }

  // Fallback canônico oficial de 2026 (12 equipes consagradas)
  const official12 = OFFICIAL_2026_GRID_KEYS.map((k) => {
    const t = ALL_GRID_TEAMS_DATABASE.find((item) => item.key === k)
    if (!t) throw new Error(`Equipe oficial 2026 não encontrada no catálogo: ${k}`)
    return t
  })

  // Se o jogador é uma equipe customizada não listada entre as 12 oficiais, substitui a 12ª oficial
  const playerKey = team.team_key?.toLowerCase()
  const playerInOfficial = official12.find(
    (t) => t.key.toLowerCase() === playerKey || t.name.toLowerCase() === team.name?.toLowerCase(),
  )

  if (!playerInOfficial && team.is_custom) {
    const listWithoutLast = official12.slice(0, 11)
    const customPlayerDef: GridTeamDefinition = {
      key: team.team_key || team.id,
      name: team.name,
      shortName: team.name.slice(0, 3).toUpperCase(),
      country: 'Brasil',
      flag: '🇧🇷',
      color: team.color || '#E10600',
      engine: (team.engine_supplier as any) || 'Audi',
      strengthRating: team.strength ? team.strength / 10 : 5.2,
      strength: team.strength || 52,
      carLevel: team.chassis_level || 52,
      budget: team.budget || 150000000,
      competitivenessVerdict: 'Escuderia do Jogador',
      boardPressure: 'Média',
      difficulty: 'Média',
      initialObjective: 'Consolidar-se no Top 8',
      infrastructureRating: 4,
      financesRating: 4,
      historySummary: 'Equipe do Jogador criada para o campeonato.',
      currentSituation: 'Disputando a temporada oficial.',
      driver1: {
        name: 'Piloto 1',
        nationality: 'Brasil',
        flag: '🇧🇷',
        age: 22,
        speed: 82,
        consistency: 82,
        rain: 82,
        defense: 80,
        salary: 8000000,
      },
      driver2: {
        name: 'Piloto 2',
        nationality: 'Brasil',
        flag: '🇧🇷',
        age: 25,
        speed: 82,
        consistency: 82,
        rain: 82,
        defense: 80,
        salary: 8000000,
      },
      reserveDriver: {
        name: 'Piloto Reserva',
        nationality: 'Brasil',
        flag: '🇧🇷',
        age: 20,
        speed: 76,
        consistency: 76,
        rain: 76,
        defense: 76,
        salary: 2000000,
      },
    }
    return [...listWithoutLast, customPlayerDef]
  }

  return official12
}

/**
 * Constrói o grid canônico completo para o evento.
 * Exatamente 12 equipes e 24 pilotos (2 por equipe).
 * A ordem de largada obedece à classificação canônica (calculada com calculateCombinedPace em modo isQualifying).
 */
export function buildCanonicalEventGrid(params: {
  team: TeamModel
  playerDrivers: DriverModel[]
  currentRound: number
  totalLaps: number
  gpName?: string
  circuitName?: string
  tireAbrasiveness?: number
}): CanonicalGridResolutionResult {
  const { team, playerDrivers, currentRound, totalLaps, tireAbrasiveness = 6 } = params

  const titulars = playerDrivers.filter(
    (d) => d.team_id === team.id && (d.role === 'titular' || !d.role),
  )

  const missingRequirements: string[] = []
  if (titulars.length < 2) {
    missingRequirements.push(
      `Equipe do jogador (${team.name}) possui ${titulars.length} piloto(s) titular(es) inscrito(s). Requer 2 titulares.`,
    )
  }

  const participatingTeams = resolveEventParticipatingTeams(team)
  if (participatingTeams.length !== 12) {
    missingRequirements.push(
      `Grid do evento requer 12 equipes homologadas, mas encontrou ${participatingTeams.length}.`,
    )
  }

  if (missingRequirements.length > 0) {
    return {
      success: false,
      grid: [],
      teamsCount: participatingTeams.length,
      driversCount: titulars.length,
      missingRequirements,
    }
  }

  const circuitProfile = resolveCircuitProfile({ round: currentRound })

  // Preparar os 24 inscritos antes da qualificação
  interface RawEntry {
    driverId: string
    driverName: string
    teamId: string
    teamName: string
    teamColor: string
    isPlayer: boolean
    score: number
    lapTimeSec: number
    morale: number
    physicalCondition: number
    playerDriverRef?: DriverModel
  }

  const rawEntries: RawEntry[] = []

  // 1. Inserir os 2 titulares da equipe do jogador
  const playerTech = carTechnicalService.ensureTechnicalData(team)
  const playerChassis = playerTech.calculated_overall || team.strength || 52
  const playerSupplier = team.engine_supplier || 'Audi'
  const playerPu = OFFICIAL_POWER_UNITS[playerSupplier] || OFFICIAL_POWER_UNITS.Audi
  const playerPuRating = Number(
    (playerPu.powerRating * 0.6 + playerPu.reliabilityRating * 0.4).toFixed(1),
  )
  const playerCarPerf = Number((playerChassis * 0.7 + playerPuRating * 0.3).toFixed(1))

  titulars.slice(0, 2).forEach((d) => {
    const pace = calculateCombinedPace({
      teamStrength: playerChassis,
      carLevel: team.chassis_level || playerChassis,
      driver: {
        speed: d.speed,
        consistency: d.consistency,
        defense: d.defense,
        rain: d.rain,
        morale: d.morale ?? 85,
        physicalCondition: d.physical_condition ?? 90,
      },
      weather: 'seco',
      tireCompound: 'macio',
      lapsOnTire: 0,
      wearPercent: 0,
      isQualifying: true,
      technicalAttributes: playerTech.technical_attributes,
      circuit: circuitProfile,
      chassisRating: playerChassis,
      powerUnitRating: playerPuRating,
      carPerformanceRating: playerCarPerf,
      trackAbrasiveness: tireAbrasiveness,
    })

    rawEntries.push({
      driverId: d.id,
      driverName: d.name,
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color || '#E10600',
      isPlayer: true,
      score: d.speed || 80,
      lapTimeSec: pace.lapTimeSec,
      morale: d.morale ?? 85,
      physicalCondition: d.physical_condition ?? 90,
      playerDriverRef: d,
    })
  })

  // 2. Inserir os pilotos das outras 11 equipes
  const isPlayerTeamMatch = (tDef: GridTeamDefinition) => {
    const playerKey = (team.team_key || team.id).toLowerCase()
    return (
      tDef.key.toLowerCase() === playerKey ||
      tDef.name.toLowerCase() === team.name.toLowerCase() ||
      tDef.shortName.toLowerCase() === (team.name || '').toLowerCase()
    )
  }

  const rivalTeams = participatingTeams.filter((t) => !isPlayerTeamMatch(t))

  rivalTeams.forEach((rival) => {
    const rivalTech = carTechnicalService.getOrCreateTeamTechnicalData(
      rival.key,
      rival.strengthRating || rival.strength || 75,
      rival.engine,
    )
    const rivalChassis = rivalTech.calculatedOverall
    const rivalSupplier = rival.engine || 'Ferrari'
    const rivalPu = OFFICIAL_POWER_UNITS[rivalSupplier] || OFFICIAL_POWER_UNITS.Ferrari
    const rivalPuRating = Number(
      (rivalPu.powerRating * 0.6 + rivalPu.reliabilityRating * 0.4).toFixed(1),
    )
    const rivalCarPerf = Number((rivalChassis * 0.7 + rivalPuRating * 0.3).toFixed(1))

    const d1Pace = calculateCombinedPace({
      teamStrength: rival.strengthRating,
      carLevel: rival.carLevel || rivalChassis,
      driver: {
        speed: rival.driver1.speed,
        consistency: rival.driver1.consistency,
        defense: rival.driver1.defense,
        rain: rival.driver1.rain,
        morale: 80,
        physicalCondition: 90,
      },
      weather: 'seco',
      tireCompound: 'macio',
      lapsOnTire: 0,
      wearPercent: 0,
      isQualifying: true,
      technicalAttributes: rivalTech.attributes,
      circuit: circuitProfile,
      chassisRating: rivalChassis,
      powerUnitRating: rivalPuRating,
      carPerformanceRating: rivalCarPerf,
      trackAbrasiveness: tireAbrasiveness,
    })

    const d2Pace = calculateCombinedPace({
      teamStrength: rival.strengthRating,
      carLevel: rival.carLevel || rivalChassis,
      driver: {
        speed: rival.driver2.speed,
        consistency: rival.driver2.consistency,
        defense: rival.driver2.defense,
        rain: rival.driver2.rain,
        morale: 80,
        physicalCondition: 90,
      },
      weather: 'seco',
      tireCompound: 'macio',
      lapsOnTire: 0,
      wearPercent: 0,
      isQualifying: true,
      technicalAttributes: rivalTech.attributes,
      circuit: circuitProfile,
      chassisRating: rivalChassis,
      powerUnitRating: rivalPuRating,
      carPerformanceRating: rivalCarPerf,
      trackAbrasiveness: tireAbrasiveness,
    })

    rawEntries.push({
      driverId: `${rival.key}_d1`,
      driverName: rival.driver1.name,
      teamId: `team_${rival.key}`,
      teamName: rival.name,
      teamColor: rival.color,
      isPlayer: false,
      score: rival.driver1.speed,
      lapTimeSec: d1Pace.lapTimeSec,
      morale: 80,
      physicalCondition: 90,
    })

    rawEntries.push({
      driverId: `${rival.key}_d2`,
      driverName: rival.driver2.name,
      teamId: `team_${rival.key}`,
      teamName: rival.name,
      teamColor: rival.color,
      isPlayer: false,
      score: rival.driver2.speed,
      lapTimeSec: d2Pace.lapTimeSec,
      morale: 80,
      physicalCondition: 90,
    })
  })

  // 3. Ordem de largada canônica da classificação: menor tempo de volta = Pole Position
  rawEntries.sort((a, b) => a.lapTimeSec - b.lapTimeSec)

  const poleTime = rawEntries[0].lapTimeSec

  const finalGrid: SimDriverEntry[] = rawEntries.map((entry, idx) => {
    const pos = idx + 1
    const deltaToPole = entry.lapTimeSec - poleTime
    const deltaToFront = idx === 0 ? 0 : entry.lapTimeSec - rawEntries[idx - 1].lapTimeSec

    return {
      position: pos,
      gridPosition: pos,
      driverId: entry.driverId,
      driverName: entry.driverName,
      teamId: entry.teamId,
      teamName: entry.teamName,
      teamColor: entry.teamColor,
      isPlayer: entry.isPlayer,
      score: entry.score,
      points: 0,
      fastestLap: false,
      usedOvertake: false,
      accumulatedTimeSec: 0,
      tireCompound: 'medio',
      pitLap: Math.round(totalLaps * 0.45),
      tireWear: 4,
      driverFatigue: 0,
      morale: entry.morale,
      physicalCondition: entry.physicalCondition,
      pitStopsDone: 0,
      hasWingDamage: false,
      fuelRemaining: 100,
      gapToLeader: idx === 0 ? 'Líder' : `+${deltaToPole.toFixed(3)}s`,
      gapToFront: idx === 0 ? '+0.000s' : `+${deltaToFront.toFixed(3)}s`,
    }
  })

  return {
    success: true,
    grid: finalGrid,
    teamsCount: participatingTeams.length,
    driversCount: finalGrid.length,
  }
}
