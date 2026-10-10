/**
 * canonicalRaceSessionLoader.ts
 *
 * RACE-PAGE-01A — Resolvedor canônico do RaceSessionContext.
 *
 * Princípios e Invariantes:
 * 1. Não recalcula posições nem grid oficial. Consome exatamente o finalGrid P1–P24 persistido.
 * 2. Fonte preferencial: backend-first via readFinalGridPreferred (canonicalQualifyingPersistenceService).
 * 3. Inventário de pneus: backend-first via readWeekendTyresPreferred (canonicalWeekendTyrePersistence).
 *    NUNCA chama getOrCreateWeekendInventories na RacePage (evita regeneração de jogos novos).
 * 4. Resolve os 2 pilotos da equipe do jogador de forma consistente com a regra esportiva da FIA.
 * 5. Clima determinístico por seed vinculada a careerId + seasonYear + round (F5 não altera o clima).
 */

import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { resolveCanonicalCareerId } from '@/lib/canonical-career-id'
import { resolveCanonicalTeamKey } from '@/services/canonicalTeamIdentityService'
import { canonicalEventRegistrationService } from '@/services/canonicalEventRegistrationService'
import { teamRosterService } from '@/services/teamRosterService'
import {
  resolveDeterministicRaceWeather,
  CanonicalRaceInitialWeather,
} from '@/services/canonicalRaceWeatherService'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import type {
  CompleteQualifyingWeekendResult,
  FinalQualifyingGridEntry,
} from '@/types/canonical-qualifying-types'
import type { TireSetItem } from '@/types/f1'
import type { SeasonModel, TeamModel, DriverModel } from '@/types/f1'

export interface CanonicalRacePlayerDriver {
  driverId: string
  driverName: string
  carId: 'car1' | 'car2'
  carNumber: number
  gridPosition: number
  entry: FinalQualifyingGridEntry
  inventory: TireSetItem[]
  model?: DriverModel
}

export interface CanonicalRaceCircuitInfo {
  round: number
  name: string
  circuit: string
  country: string
  laps: number
  circuitLengthKm: number
}

export interface CanonicalRaceSessionContext {
  careerId: string
  seasonId: string
  seasonYear: number
  round: number
  variant: RaceVariantOption
  circuit: CanonicalRaceCircuitInfo
  totalLaps: number
  completeQualifyingResult: CompleteQualifyingWeekendResult
  finalGrid: FinalQualifyingGridEntry[]
  playerTeam: TeamModel
  resolvedTeamKey: string
  playerDrivers: [CanonicalRacePlayerDriver, CanonicalRacePlayerDriver]
  tyreInventories: Record<string, TireSetItem[]>
  weather: CanonicalRaceInitialWeather
  gridSource: 'backend' | 'local' | 'none'
  tyreSource: 'backend' | 'local' | 'local_migrated' | 'local_migration_failed' | 'none'
  raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE'
}

export type RaceSessionResolutionResult =
  | {
      status: 'ready'
      context: CanonicalRaceSessionContext
    }
  | {
      status: 'no_race'
      message: string
      round: number
    }
  | {
      status: 'error'
      message: string
      round: number
      diagnostics?: Record<string, any>
    }

// SPRINT-RACE-RESOLVE-01A
export type RaceVariantOption = 'MAIN_RACE' | 'SPRINT_RACE'

export async function loadCanonicalRaceSessionContext(params: {
  season: SeasonModel | null
  team: TeamModel | null
  round: number
  variant?: RaceVariantOption | string
  allPlayerDrivers?: DriverModel[]
}): Promise<RaceSessionResolutionResult> {
  const { season, team, round, variant = 'MAIN_RACE', allPlayerDrivers = [] } = params
  const raceVariant: RaceVariantOption =
    String(variant).toUpperCase() === 'SPRINT_RACE' || String(variant).toLowerCase() === 'sprint'
      ? 'SPRINT_RACE'
      : 'MAIN_RACE'

  if (!season || !team) {
    return {
      status: 'no_race',
      message: 'Nenhuma carreira ou temporada ativa identificada.',
      round,
    }
  }

  const seasonYear = season.year || 2026
  const careerId = resolveCanonicalCareerId(season, team)
  const resolvedTeamKey = resolveCanonicalTeamKey(team) || team.team_key || team.id

  // 1. Resolver informações do circuito
  const calItem = F1_2026_CALENDAR.find((c) => c.round === round)
  const baseLaps = calItem?.laps || 57
  const circuitLengthKm = calItem?.circuitLengthKm || 5.412
  // SPRINT-LAPS-UNIFY-01A: Unificação canônica 1/3 (números inteiros) das voltas da corrida normal (baseLaps)
  // Regra do usuário: Math.max(1, Math.floor(mainRaceLaps / 3))
  const sprintLaps = canonicalRaceInitializationService.getCanonicalSprintLaps(baseLaps)
  const totalLaps = raceVariant === 'SPRINT_RACE' ? sprintLaps : baseLaps

  const circuit: CanonicalRaceCircuitInfo = {
    round,
    name:
      raceVariant === 'SPRINT_RACE'
        ? `Sprint - ${calItem?.name || `Grande Prêmio da Rodada ${round}`}`
        : calItem?.name || `Grande Prêmio da Rodada ${round}`,
    circuit: calItem?.circuit || 'Circuito Internacional',
    country: calItem?.country || 'Internacional',
    laps: totalLaps,
    circuitLengthKm,
  }

  // 2. Leitura BACKEND-FIRST do Grid Final Oficial (P1–P24)
  // Backend vence local; não recalcula posições.
  let qualifyingResult: CompleteQualifyingWeekendResult | null = null
  let gridSource: CanonicalRaceSessionContext['gridSource'] = 'none'

  try {
    const outcome = await canonicalQualifyingPersistenceService.readFinalGridPreferred(
      season.id,
      round,
    )
    qualifyingResult = outcome.data
    gridSource = outcome.source
  } catch (err) {
    console.warn('[RaceSessionLoader] Falha ao ler grid final preferencial:', err)
  }

  if (
    !qualifyingResult ||
    !Array.isArray(qualifyingResult.finalGrid) ||
    qualifyingResult.finalGrid.length === 0
  ) {
    // Tentar fallback síncrono em memória/localStorage
    const localFallback = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
      season.id,
      round,
    )
    if (
      localFallback &&
      Array.isArray(localFallback.finalGrid) &&
      localFallback.finalGrid.length > 0
    ) {
      qualifyingResult = localFallback
      gridSource = 'local'
    }
  }

  if (
    !qualifyingResult ||
    !Array.isArray(qualifyingResult.finalGrid) ||
    qualifyingResult.finalGrid.length === 0
  ) {
    return {
      status: 'no_race',
      message:
        raceVariant === 'SPRINT_RACE'
          ? 'Nenhuma corrida sprint preparada para esta rodada. O grid da sprint ainda não foi formado.'
          : 'Nenhuma corrida preparada para esta rodada. O grid oficial ainda não foi formado.',
      round,
    }
  }

  const finalGrid = qualifyingResult.finalGrid

  // 3. Leitura BACKEND-FIRST do Inventário de Pneus (não regenera jogos)
  let tyreInventories: Record<string, TireSetItem[]> = {}
  let tyreSource: CanonicalRaceSessionContext['tyreSource'] = 'none'

  try {
    const tyreOutcome = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(
      season.id,
      round,
    )
    if (tyreOutcome.data?.inventoriesByDriver) {
      tyreInventories = tyreOutcome.data.inventoriesByDriver
      tyreSource = tyreOutcome.source
    }
  } catch (tErr) {
    console.warn('[RaceSessionLoader] Falha ao ler pneus backend-first:', tErr)
  }

  if (Object.keys(tyreInventories).length === 0) {
    // Fallback de continuidade de leitura (sem regenerar 20 jogos novos)
    const localTyres = canonicalWeekendTyrePersistence.readWeekendTireData(season.id, round)
    if (localTyres?.inventoriesByDriver) {
      tyreInventories = localTyres.inventoriesByDriver
      tyreSource = 'local'
    }
  }

  // 4. Resolução rigorosa dos 2 pilotos da equipe do jogador no grid oficial
  // B. IDENTIDADE DOS CARROS: Carro 1/Carro 2 vêm do vínculo oficial de assentos/inscrição
  // para esse fim de semana, NUNCA da ordem do grid (quem larga na frente não vira Carro 1).
  const normTeam = (resolvedTeamKey || '').trim().toLowerCase()
  let playerEntries = finalGrid.filter((e) => {
    const entryTeam = (e.teamId || '').trim().toLowerCase()
    return (
      entryTeam === normTeam ||
      (normTeam !== '' && (entryTeam === `team_${normTeam}` || normTeam === `team_${entryTeam}`))
    )
  })

  // Se match por teamKey não encontrou exatamente 2, tentar match por flag isPlayer
  if (playerEntries.length !== 2) {
    const byPlayerFlag = finalGrid.filter((e) => Boolean(e.isPlayer))
    if (byPlayerFlag.length === 2) {
      playerEntries = byPlayerFlag
    }
  }

  // Se ainda assim não encontrou exatamente 2, buscar pelos driverIds cadastrados no useUnifiedSeason/team
  if (playerEntries.length !== 2 && allPlayerDrivers.length >= 2) {
    const driverIdsSet = new Set(allPlayerDrivers.map((d) => d.id))
    const byDriverCatalog = finalGrid.filter((e) => driverIdsSet.has(e.driverId))
    if (byDriverCatalog.length === 2) {
      playerEntries = byDriverCatalog
    }
  }

  if (playerEntries.length < 2) {
    return {
      status: 'error',
      message: `Não foi possível identificar os dois pilotos da sua equipe no grid oficial (encontrados: ${playerEntries.length}).`,
      round,
      diagnostics: {
        resolvedTeamKey,
        teamId: team.id,
        matchedCount: playerEntries.length,
        totalGridLength: finalGrid.length,
      },
    }
  }

  // Identificar fonte oficial dos assentos (Carro 1 vs Carro 2)
  // Fonte 1: Snapshot oficial de inscrição do GP (EventRegistrationSnapshot)
  const regSnapshot = canonicalEventRegistrationService.readRegistrationSnapshot(season.id, round)
  let seat1DriverId: string | undefined = regSnapshot?.entriesByCar.playerCar1?.driverId
  let seat2DriverId: string | undefined = regSnapshot?.entriesByCar.playerCar2?.driverId

  // Fonte 2: Roster canônico da equipe do jogador (titular 1 = car1, titular 2 = car2)
  if (!seat1DriverId || !seat2DriverId) {
    const roster = teamRosterService.buildTeamRoster(team, allPlayerDrivers)
    if (roster.driver1 && roster.driver2) {
      if (!seat1DriverId) seat1DriverId = roster.driver1.id
      if (!seat2DriverId) seat2DriverId = roster.driver2.id
    }
  }

  // Fonte 3: Campo carId gravado nas próprias entradas do grid (se presente)
  if (!seat1DriverId) {
    const gridC1 = playerEntries.find((e) => e.carId === 'car1')
    if (gridC1) seat1DriverId = gridC1.driverId
  }
  if (!seat2DriverId) {
    const gridC2 = playerEntries.find((e) => e.carId === 'car2')
    if (gridC2) seat2DriverId = gridC2.driverId
  }

  // Atribuição canônica de pEntry1 e pEntry2 baseada em seat1DriverId e seat2DriverId
  let pEntry1: FinalQualifyingGridEntry
  let pEntry2: FinalQualifyingGridEntry

  if (seat1DriverId && seat2DriverId && seat1DriverId !== seat2DriverId) {
    const found1 = playerEntries.find((e) => e.driverId === seat1DriverId)
    const found2 = playerEntries.find((e) => e.driverId === seat2DriverId)
    if (found1 && found2) {
      pEntry1 = found1
      pEntry2 = found2
    } else if (found1) {
      pEntry1 = found1
      pEntry2 = playerEntries.find((e) => e.driverId !== seat1DriverId) || playerEntries[1]
    } else if (found2) {
      pEntry2 = found2
      pEntry1 = playerEntries.find((e) => e.driverId !== seat2DriverId) || playerEntries[0]
    } else {
      pEntry1 = playerEntries[0]
      pEntry2 = playerEntries[1]
    }
  } else if (seat1DriverId) {
    const found1 = playerEntries.find((e) => e.driverId === seat1DriverId)
    if (found1) {
      pEntry1 = found1
      pEntry2 = playerEntries.find((e) => e.driverId !== seat1DriverId) || playerEntries[1]
    } else {
      pEntry1 = playerEntries[0]
      pEntry2 = playerEntries[1]
    }
  } else {
    pEntry1 = playerEntries[0]
    pEntry2 = playerEntries[1]
  }

  const pModel1 = allPlayerDrivers.find((d) => d.id === pEntry1.driverId)
  const pModel2 = allPlayerDrivers.find((d) => d.id === pEntry2.driverId)

  const driver1: CanonicalRacePlayerDriver = {
    driverId: pEntry1.driverId,
    driverName: pEntry1.driverName,
    carId: 'car1',
    carNumber: 1,
    gridPosition: pEntry1.gridPosition,
    entry: pEntry1,
    inventory: tyreInventories[pEntry1.driverId] || [],
    model: pModel1,
  }

  const driver2: CanonicalRacePlayerDriver = {
    driverId: pEntry2.driverId,
    driverName: pEntry2.driverName,
    carId: 'car2',
    carNumber: 2,
    gridPosition: pEntry2.gridPosition,
    entry: pEntry2,
    inventory: tyreInventories[pEntry2.driverId] || [],
    model: pModel2,
  }

  // 5. Clima determinístico por seed persistente
  const weather = resolveDeterministicRaceWeather({
    careerId,
    seasonYear,
    round,
    circuitId: calItem?.circuit
      ? calItem.circuit.toLowerCase().replace(/\s+/g, '_')
      : `round_${round}`,
    circuitName: circuit.circuit,
    country: circuit.country,
    totalLaps,
  })

  return {
    status: 'ready',
    context: {
      careerId,
      seasonId: season.id,
      seasonYear,
      round,
      variant: raceVariant,
      circuit,
      totalLaps,
      completeQualifyingResult: qualifyingResult,
      finalGrid,
      playerTeam: team,
      resolvedTeamKey,
      playerDrivers: [driver1, driver2],
      tyreInventories,
      weather,
      gridSource,
      tyreSource,
    },
  }
}
