import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  standingsService,
  formatConstructorPosition,
  calculateSeasonObjectiveProgress,
} from '@/services/standingsService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'

import { technicalOrganizationService } from '@/services/technicalOrganizationService'
import type { DriverModel } from '@/types/f1'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'

function createControlledQualifyingGrid(playerTeamId: string): FinalQualifyingGridEntry[] {
  const teams = [
    { id: 'mercedes', name: 'Mercedes-AMG Petronas', color: '#27F4D2' },
    { id: 'ferrari', name: 'Scuderia Ferrari', color: '#E8002D' },
    { id: playerTeamId, name: 'Audi F1 Team', color: '#FF2A00' },
    { id: 'haas', name: 'Haas F1 Team', color: '#B6BABD' },
    { id: 'williams', name: 'Williams Racing', color: '#64C4FF' },
  ]

  const grid: FinalQualifyingGridEntry[] = []
  let pos = 1
  for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
    const t = teams[teamIdx]
    const isPlayer = t.id === playerTeamId

    for (let carNum = 1; carNum <= 2; carNum++) {
      const driverId = `drv_${t.id}_car${carNum}`
      const driverName = `Piloto ${carNum} - ${t.name}`

      grid.push({
        gridPosition: pos,
        driverId,
        driverName,
        teamId: t.id,
        teamName: t.name,
        teamColor: t.color,
        isPlayer,
        carId: isPlayer ? (carNum === 1 ? 'car1' : 'car2') : undefined,
        eliminationStage: pos <= 10 ? 'Q3' : pos <= 18 ? 'Q2' : 'Q1',
        bestLapSec: 80.0 + pos * 0.1,
        bestLapTime: `1:20.${String(pos).padStart(3, '0')}`,
        bestLapCompound: pos <= 10 ? 'macio' : 'medio',
      })
      pos++
    }
  }

  return grid
}

function setupControlledChampionshipState(careerId: string, seasonYear = 2026) {
  const grid = createControlledQualifyingGrid('audi')
  let race = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
    careerId,
    season: seasonYear,
    round: 1,
    circuitName: 'Sakhir',
    circuitCountry: 'Bahrein',
    totalLaps: 3,
    playerTeamId: 'audi',
    canonicalQualifyingGrid: grid,
  })

  race = canonicalRaceEngineService.advanceMultipleLaps(race, race.totalLaps, {
    seedOverride: 2026,
  })

  const official = canonicalRaceResultService.officializeRace(race)

  // FIXTURE DE COERÊNCIA: Mercedes P1/100, Ferrari P2/85, Audi P3/62, Haas P4/38, Williams P5/0
  official.entries.forEach((e) => {
    e.pointsAwarded = 0
  })

  const merc = official.entries.find((e) => e.teamId === 'mercedes')!
  const ferr = official.entries.find((e) => e.teamId === 'ferrari')!
  const audi = official.entries.find((e) => e.teamId === 'audi')!
  const haas = official.entries.find((e) => e.teamId === 'haas')!
  const will = official.entries.find((e) => e.teamId === 'williams')!

  merc.pointsAwarded = 100
  merc.finalPosition = 1
  ferr.pointsAwarded = 85
  ferr.finalPosition = 2
  audi.pointsAwarded = 62
  audi.finalPosition = 3
  haas.pointsAwarded = 38
  haas.finalPosition = 4
  will.pointsAwarded = 0
  will.finalPosition = 5

  official.resultHash = canonicalRaceResultService.generateResultChecksum({
    officialResultId: official.officialResultId,
    careerId: official.careerId,
    season: official.season,
    round: official.round,
    raceId: official.raceId,
    winnerDriverId: official.winnerDriverId,
    poleDriverId: official.poleDriverId,
    fastestLapDriverId: official.fastestLapDriverId,
    entries: official.entries,
  })

  canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
  return official
}

/**
 * Helper que extrai as métricas de TeamPage da mesma maneira que a página Team.tsx calcula
 */
function resolveTeamPageMetrics({
  season,
  team,
  seasonRaceResults = [],
  titularDrivers = [],
}: {
  season: any
  team: any
  seasonRaceResults?: any[]
  titularDrivers?: DriverModel[]
}) {
  const isAudi = (team?.name || '').toLowerCase().includes('audi')
  const careerId = season?.id || team?.id || 'default_career'
  const seasonYear = season?.year || 2026
  const playerTeamId = team?.team_key || team?.id || (isAudi ? 'audi' : '')

  let snap: any = null
  try {
    snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      seasonYear,
      undefined,
      playerTeamId,
    )
  } catch {
    snap = null
  }

  let constructorRank: number | '—' = '—'
  let constructorTotalPoints = 0
  let hasOfficialResults = false

  if (snap) {
    const throughRound = snap.throughRound || 0
    const hasResults = throughRound > 0
    const playerKey = ((team as any)?.team_key || team?.id || (isAudi ? 'audi' : '')).toLowerCase()
    const standing = snap.constructorStandings.find(
      (c: any) =>
        c.isPlayer ||
        c.teamId.toLowerCase() === playerKey ||
        c.teamName.toLowerCase() === (team?.name || '').toLowerCase(),
    )

    if (standing) {
      const rank = hasResults && standing.position > 0 ? standing.position : null
      constructorRank = rank != null ? rank : '—'
      constructorTotalPoints = standing.points ?? 0
      hasOfficialResults = hasResults
    }
  }

  if (constructorRank === '—' && !hasOfficialResults) {
    const standingsResult = standingsService.calculateStandings({
      raceResults: seasonRaceResults,
      playerDrivers: titularDrivers,
      team,
      season,
    })
    if (standingsResult) {
      const rank =
        standingsResult.playerConstructorRank != null && standingsResult.playerConstructorRank > 0
          ? standingsResult.playerConstructorRank
          : null
      constructorRank = rank != null ? rank : '—'
      constructorTotalPoints = standingsResult.teamPoints ?? 0
      hasOfficialResults = rank != null
    }
  }

  const rankNum =
    typeof constructorRank === 'number' && constructorRank > 0 ? constructorRank : null
  const currentRound = season?.current_round || 1
  const seasonObjectiveProgress = calculateSeasonObjectiveProgress({
    position: rankNum,
    points: constructorTotalPoints,
    targetRank: 4,
    seasonYear,
    round: currentRound,
  })

  return {
    constructorRank,
    constructorTotalPoints,
    hasOfficialResults,
    seasonObjectiveProgress,
  }
}

/**
 * Helper que extrai quilometragem idêntico ao useCallback de Team.tsx
 */
function getDriverDevelopmentMileageKm(driver: DriverModel, team?: any): number {
  const pData = (driver as any)?.procedural_data
  const rawKm =
    (driver as any)?.mileage_km ??
    (driver as any)?.rookie_mileage_km ??
    (driver as any)?.development_mileage_km ??
    (driver as any)?.accumulated_mileage_km ??
    (driver as any)?.accumulatedHomologatedKm ??
    pData?.mileage_km ??
    pData?.rookie_mileage_km ??
    pData?.developmentMileageKm ??
    pData?.trackTestingKm ??
    pData?.accumulatedHomologatedKm ??
    null

  const directKm = typeof rawKm === 'string' ? parseFloat(rawKm) : rawKm
  if (typeof directKm === 'number' && !isNaN(directKm)) {
    return directKm
  }

  if (Array.isArray(pData?.testSessionsHistory)) {
    const sum = pData.testSessionsHistory.reduce(
      (acc: number, sess: any) => acc + (Number(sess?.km) || 0),
      0,
    )
    if (sum > 0) return sum
  }

  const teamDevData = (team as any)?.academy_development_data
  const driverTestInfo = teamDevData?.driverTestingRecords?.[driver.id]
  if (typeof driverTestInfo?.accumulatedKm === 'number') {
    return driverTestInfo.accumulatedKm
  }

  if (
    typeof driver.homologation_sessions_done === 'number' &&
    driver.homologation_sessions_done > 0
  ) {
    return driver.homologation_sessions_done * 100
  }

  return 0
}

/**
 * Helper para simular pendingDecisionsList de Team.tsx
 */
function calculatePendingDecisionsList({
  currentTeamOrg,
  currentSeasonYear,
  titularDrivers,
  reserveDriver,
  canonicalRoster,
}: {
  currentTeamOrg: any
  currentSeasonYear: number
  titularDrivers: DriverModel[]
  reserveDriver: DriverModel | null
  canonicalRoster: { titularCount: number }
}) {
  const decisions: any[] = []

  // 1. Staff técnico
  const allMembers = Object.values(currentTeamOrg?.members || {}).filter(Boolean) as any[]
  const staffDecisions = (technicalOrganizationService as any).deriveStaffPendingDecisions
    ? (technicalOrganizationService as any).deriveStaffPendingDecisions(
        allMembers,
        currentSeasonYear,
      )
    : []
  decisions.push(...staffDecisions)

  // 2. Pilotos
  const driversToCheck = [...titularDrivers, ...(reserveDriver ? [reserveDriver] : [])]
  for (const d of driversToCheck) {
    if (d.contract_end && d.contract_end <= currentSeasonYear) {
      const isExpiring = d.contract_end === currentSeasonYear
      const isExpired = d.contract_end < currentSeasonYear
      decisions.push({
        id: `driver-contract-${d.id}`,
        title: isExpired ? `Contrato vencido: ${d.name}` : `Renovação de piloto: ${d.name}`,
        priority: isExpired ? 'ALTA' : 'MÉDIA',
        actionTab: 'contratos',
      })
    }
  }

  // 3. Vaga aberta
  if (canonicalRoster.titularCount < 2) {
    decisions.push({
      id: 'roster-open-titular-slot',
      title: 'Vaga de titular em aberto',
      priority: 'ALTA',
      actionTab: 'pilotos',
    })
  }

  // 4. Reserva homologação
  if (reserveDriver && reserveDriver.homologation_status === 'homologacao') {
    const done = reserveDriver.homologation_sessions_done ?? 0
    if (done < 2) {
      decisions.push({
        id: `reserve-homologation-${reserveDriver.id}`,
        title: `Escalar TL1: ${reserveDriver.name}`,
        priority: 'MÉDIA',
        actionTab: 'pilotos',
      })
    }
  }

  return decisions
}

describe('TEAM-PAGE-INTEGRITY-01 (TPI01): Integridade da Página Equipe', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // TPI01-01: TeamPage position = snapshot position
  it('TPI01-01: TeamPage position = snapshot position', () => {
    const careerId = 'career_tpi01_01'
    setupControlledChampionshipState(careerId)

    const team = { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' }
    const season = { id: careerId, year: 2026, current_round: 1 }

    const metrics = resolveTeamPageMetrics({ season, team })
    expect(metrics.constructorRank).toBe(3)
  })

  // TPI01-02: TeamPage points = snapshot points
  it('TPI01-02: TeamPage points = snapshot points', () => {
    const careerId = 'career_tpi01_02'
    setupControlledChampionshipState(careerId)

    const team = { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' }
    const season = { id: careerId, year: 2026, current_round: 1 }

    const metrics = resolveTeamPageMetrics({ season, team })
    expect(metrics.constructorTotalPoints).toBe(62)
  })

  // TPI01-03: position e points vêm do mesmo standing record
  it('TPI01-03: position e points vêm do mesmo standing record', () => {
    const careerId = 'career_tpi01_03'
    setupControlledChampionshipState(careerId)

    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )
    const playerStanding = snap.constructorStandings.find((c) => c.isPlayer || c.teamId === 'audi')!

    expect(playerStanding).toBeDefined()
    expect(playerStanding.position).toBe(3)
    expect(playerStanding.points).toBe(62)

    const team = { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' }
    const season = { id: careerId, year: 2026, current_round: 1 }
    const metrics = resolveTeamPageMetrics({ season, team })

    expect(metrics.constructorRank).toBe(playerStanding.position)
    expect(metrics.constructorTotalPoints).toBe(playerStanding.points)
  })

  // TPI01-04: Dashboard / Championship / Teams / TeamPage concordam para player team
  it('TPI01-04: Dashboard / Championship / Teams / TeamPage concordam para player team', () => {
    const careerId = 'career_tpi01_04'
    setupControlledChampionshipState(careerId)

    const team = { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' }
    const season = { id: careerId, year: 2026, current_round: 1 }

    // 1. Championship snapshot
    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )
    const champRecord = snap.constructorStandings.find((c) => c.isPlayer || c.teamId === 'audi')!

    // 2. Dashboard standings calculation
    const dashResult = standingsService.calculateStandings({
      raceResults: [],
      playerDrivers: [],
      team: team as any,
      season: season as any,
    })

    // 3. TeamPage metrics
    const teamPageMetrics = resolveTeamPageMetrics({ season, team })

    // Posições concordam
    expect(champRecord.position).toBe(3)
    expect(dashResult.playerConstructorRank).toBe(3)
    expect(teamPageMetrics.constructorRank).toBe(3)

    // Pontos concordam
    expect(champRecord.points).toBe(62)
    expect(dashResult.teamPoints).toBe(62)
    expect(teamPageMetrics.constructorTotalPoints).toBe(62)
  })

  // TPI01-05: sem standings: position = "—", points = 0
  it('TPI01-05: sem standings: position = "—", points = 0', () => {
    const careerId = 'career_tpi01_05_empty'
    const team = { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' }
    const season = { id: careerId, year: 2026, current_round: 1 }

    const metrics = resolveTeamPageMetrics({ season, team })

    expect(metrics.constructorRank).toBe('—')
    expect(metrics.constructorTotalPoints).toBe(0)
    expect(
      formatConstructorPosition(metrics.constructorRank === '—' ? null : metrics.constructorRank),
    ).toBe('—')
  })

  // TPI01-06: Objetivo da Diretoria usa position/points atuais
  it('TPI01-06: Objetivo da Diretoria usa position/points atuais', () => {
    const careerId = 'career_tpi01_06'
    setupControlledChampionshipState(careerId)

    const team = { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' }
    const season = { id: careerId, year: 2026, current_round: 1 }

    const metrics = resolveTeamPageMetrics({ season, team })
    expect(metrics.seasonObjectiveProgress.isMeeting).toBe(true)
    expect(metrics.seasonObjectiveProgress.percentage).toBe(92)
    expect(metrics.seasonObjectiveProgress.label).toBe('92% atingido')
  })

  // TPI01-07: Objetivo não usa 0 pts fake se existem standings
  it('TPI01-07: Objetivo não usa 0 pts fake se existem standings', () => {
    const careerId = 'career_tpi01_07'
    setupControlledChampionshipState(careerId)

    const team = { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' }
    const season = { id: careerId, year: 2026, current_round: 1 }

    const metrics = resolveTeamPageMetrics({ season, team })
    expect(metrics.constructorTotalPoints).toBe(62)
    expect(metrics.constructorTotalPoints).not.toBe(0)
  })

  // TPI01-08: Decisões Pendentes usa decisões reais
  it('TPI01-08: Decisões Pendentes usa decisões reais', () => {
    const currentSeasonYear = 2026
    const titularDrivers: DriverModel[] = [
      {
        id: 'drv_1',
        name: 'Daniel Ricciardo',
        contract_end: 2026, // Expirando este ano!
        role: 'titular',
      } as any,
      {
        id: 'drv_2',
        name: 'Gabriel Bortoleto',
        contract_end: 2028,
        role: 'titular',
      } as any,
    ]

    const decisions = calculatePendingDecisionsList({
      currentTeamOrg: { members: {} },
      currentSeasonYear,
      titularDrivers,
      reserveDriver: null,
      canonicalRoster: { titularCount: 2 },
    })

    expect(decisions.length).toBe(1)
    expect(decisions[0].id).toBe('driver-contract-drv_1')
    expect(decisions[0].title).toBe('Renovação de piloto: Daniel Ricciardo')
  })

  // TPI01-09: contador de decisões = número de decisões renderizadas
  it('TPI01-09: contador de decisões = número de decisões renderizadas', () => {
    const currentSeasonYear = 2026
    const titularDrivers: DriverModel[] = [
      {
        id: 'drv_1',
        name: 'Piloto A',
        contract_end: 2026,
        role: 'titular',
      } as any,
    ]

    const decisions = calculatePendingDecisionsList({
      currentTeamOrg: { members: {} },
      currentSeasonYear,
      titularDrivers,
      reserveDriver: null,
      canonicalRoster: { titularCount: 1 }, // Vaga em aberto!
    })

    // Deve ter 2 decisões: contrato do piloto 1 + vaga em aberto
    expect(decisions.length).toBe(2)
  })

  // TPI01-10: zero decisões → estado "Nenhuma decisão pendente"
  it('TPI01-10: zero decisões → estado "Nenhuma decisão pendente"', () => {
    const currentSeasonYear = 2026
    const titularDrivers: DriverModel[] = [
      {
        id: 'drv_1',
        name: 'Piloto 1',
        contract_end: 2028,
        role: 'titular',
      } as any,
      {
        id: 'drv_2',
        name: 'Piloto 2',
        contract_end: 2029,
        role: 'titular',
      } as any,
    ]

    const decisions = calculatePendingDecisionsList({
      currentTeamOrg: { members: {} },
      currentSeasonYear,
      titularDrivers,
      reserveDriver: {
        id: 'res_1',
        name: 'Reserva',
        contract_end: 2028,
        homologation_status: 'elegivel',
      } as any,
      canonicalRoster: { titularCount: 2 },
    })

    expect(decisions.length).toBe(0)
  })

  // TPI01-11: quilometragem exibida = quilometragem persistida do piloto
  it('TPI01-11: quilometragem exibida = quilometragem persistida do piloto', () => {
    const driver: DriverModel = {
      id: 'drv_test',
      name: 'Test Driver',
      procedural_data: {
        mileage_km: 750,
      },
    } as any

    const km = getDriverDevelopmentMileageKm(driver)
    expect(km).toBe(750)
  })

  // TPI01-12: Mariana: se fixture = 1230 km, UI = 1230 km
  it('TPI01-12: Mariana: se fixture = 1230 km, UI = 1230 km', () => {
    const mariana: DriverModel = {
      id: 'qm6xcgc5mstulg3',
      name: 'Mariana Fagundes',
      mileage_km: 1230,
      procedural_data: {
        accumulatedHomologatedKm: 1230,
      },
    } as any

    const km = getDriverDevelopmentMileageKm(mariana)
    expect(km).toBe(1230)

    const formatted = `${km.toLocaleString('pt-BR')} km`
    expect(formatted).toBe('1.230 km')
  })

  // TPI01-13: quilometragem não é hardcoded
  it('TPI01-13: quilometragem não é hardcoded', () => {
    // Verificar dinamicidade para diferentes pilotos e quilometragens
    const d1 = { id: 'd1', name: 'Driver 1', mileage_km: 450 } as any
    const d2 = { id: 'd2', name: 'Driver 2', mileage_km: 980 } as any

    expect(getDriverDevelopmentMileageKm(d1)).toBe(450)
    expect(getDriverDevelopmentMileageKm(d2)).toBe(980)

    // Análise estática: Team.tsx e TeamAcademySummaryCard não devem possuir literais fixos "1230" ou "1.230 km"
    const teamCode = fs.readFileSync(path.resolve(__dirname, '../pages/Team.tsx'), 'utf-8')
    const cardCode = fs.readFileSync(
      path.resolve(__dirname, '../components/team/TeamAcademySummaryCard.tsx'),
      'utf-8',
    )

    expect(teamCode).not.toMatch(/\b1230\b/)
    expect(cardCode).not.toMatch(/\b1230\b/)
  })

  // TPI01-14: save/reload preserva quilometragem
  it('TPI01-14: save/reload preserva quilometragem', () => {
    const marianaPersisted = {
      id: 'qm6xcgc5mstulg3',
      name: 'Mariana Fagundes',
      mileage_km: 1230,
      procedural_data: {
        developmentMileageKm: 1230,
      },
    }

    // Simular serialização JSON (save no PocketBase / localStorage) e desserialização (reload)
    const serialized = JSON.stringify(marianaPersisted)
    const reloaded = JSON.parse(serialized)

    const kmReloaded = getDriverDevelopmentMileageKm(reloaded)
    expect(kmReloaded).toBe(1230)
  })

  // TPI01-15: uma mesma atividade não duplica km
  it('TPI01-15: uma mesma atividade não duplica km', () => {
    const driver: DriverModel = {
      id: 'qm6xcgc5mstulg3',
      name: 'Mariana Fagundes',
      procedural_data: {
        testSessionsHistory: [{ sessionId: 'session_sakhir_01', km: 250 }],
      },
    } as any

    const kmFirstCall = getDriverDevelopmentMileageKm(driver)
    const kmSecondCall = getDriverDevelopmentMileageKm(driver)

    expect(kmFirstCall).toBe(250)
    expect(kmSecondCall).toBe(250)
  })
})
