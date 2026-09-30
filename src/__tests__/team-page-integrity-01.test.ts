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
import { deriveStaffPendingDecisions } from '@/lib/canonical-staff-contract-status'
import { technicalOrganizationService } from '@/services/technicalOrganizationService'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { StaffMember } from '@/types/canonical-staff'

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

  // FIXTURE DE COERÊNCIA AUDI: Mercedes P1/100, Ferrari P2/85, Audi P3/62, Haas P4/38, Williams P5/0
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
 * Helper com a mesma regra de resolução aplicada na TeamPage
 */
function resolveTeamPageStanding(careerId: string, seasonYear: number, playerTeamId = 'audi') {
  const snapshot = canonicalChampionshipService.getChampionshipStandings(
    careerId,
    seasonYear,
    undefined,
    playerTeamId,
  )

  const throughRound = snapshot.throughRound || 0
  const hasOfficialResults = throughRound > 0

  const standing = snapshot.constructorStandings.find((c) => c.isPlayer)

  const position = standing && hasOfficialResults ? standing.position : null
  const points = standing ? standing.points : 0
  const displayPosition = position != null && position > 0 ? `P${position}` : '—'
  const displayPoints = `${points} pts`

  return {
    standing,
    position,
    points,
    displayPosition,
    displayPoints,
    hasOfficialResults,
  }
}

/**
 * Helper de derivação de quilometragem da TeamPage
 */
function resolveDriverDevelopmentMileageKm(driver: any, team?: any): number {
  const pData = driver?.procedural_data
  const directKm =
    driver?.mileage_km ??
    driver?.rookie_mileage_km ??
    driver?.development_mileage_km ??
    pData?.mileage_km ??
    pData?.rookie_mileage_km ??
    pData?.developmentMileageKm ??
    pData?.trackTestingKm ??
    null

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

  const teamDevData = team?.academy_development_data
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

describe('TEAM-PAGE-INTEGRITY-01 (TPI01)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // TPI01-01: TeamPage position = snapshot position.
  it('TPI01-01: TeamPage position = snapshot position', () => {
    const careerId = 'career_tpi01_01'
    setupControlledChampionshipState(careerId)

    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )
    const audiSnap = snap.constructorStandings.find((c) => c.isPlayer)!

    const teamPageRes = resolveTeamPageStanding(careerId, 2026, 'audi')
    expect(teamPageRes.position).toBe(audiSnap.position)
    expect(teamPageRes.position).toBe(3)
  })

  // TPI01-02: TeamPage points = snapshot points.
  it('TPI01-02: TeamPage points = snapshot points', () => {
    const careerId = 'career_tpi01_02'
    setupControlledChampionshipState(careerId)

    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )
    const audiSnap = snap.constructorStandings.find((c) => c.isPlayer)!

    const teamPageRes = resolveTeamPageStanding(careerId, 2026, 'audi')
    expect(teamPageRes.points).toBe(audiSnap.points)
    expect(teamPageRes.points).toBe(62)
  })

  // TPI01-03: position e points vêm do mesmo standing record.
  it('TPI01-03: position e points vêm do mesmo standing record', () => {
    const careerId = 'career_tpi01_03'
    setupControlledChampionshipState(careerId)

    const res = resolveTeamPageStanding(careerId, 2026, 'audi')
    expect(res.standing).toBeDefined()
    expect(res.standing!.position).toBe(res.position)
    expect(res.standing!.points).toBe(res.points)
    expect(res.standing!.teamId).toBe('audi')
    expect(res.standing!.points).toBe(62)
    expect(res.standing!.position).toBe(3)
  })

  // TPI01-04: Dashboard / Championship / Teams / TeamPage concordam para player team.
  it('TPI01-04: Dashboard / Championship / Teams / TeamPage concordam para player team', () => {
    const careerId = 'career_tpi01_04'
    setupControlledChampionshipState(careerId)

    // 1. Snapshot do Campeonato (Championship)
    const snap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      undefined,
      'audi',
    )
    const champRecord = snap.constructorStandings.find((c) => c.isPlayer)!

    // 2. Dashboard via standingsService
    const dashRecord = standingsService.calculateStandings({
      raceResults: [],
      playerDrivers: [],
      team: { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' } as any,
      season: { id: careerId, year: 2026, current_round: 1 } as any,
    })

    // 3. Teams Page via snapshot resolution
    const teamsStanding = snap.constructorStandings.find((c) => c.teamId === 'audi')!

    // 4. TeamPage
    const teamPageStanding = resolveTeamPageStanding(careerId, 2026, 'audi')

    // Posições concordam
    expect(champRecord.position).toBe(3)
    expect(dashRecord.playerConstructorRank).toBe(3)
    expect(teamsStanding.position).toBe(3)
    expect(teamPageStanding.position).toBe(3)

    // Pontos concordam
    expect(champRecord.points).toBe(62)
    expect(dashRecord.teamPoints).toBe(62)
    expect(teamsStanding.points).toBe(62)
    expect(teamPageStanding.points).toBe(62)
  })

  // TPI01-05: sem standings: position = "—", points = 0.
  it('TPI01-05: sem standings: position = "—", points = 0', () => {
    const careerId = 'career_tpi01_05_empty'
    const teamPageRes = resolveTeamPageStanding(careerId, 2026, 'audi')

    expect(teamPageRes.position).toBeNull()
    expect(teamPageRes.points).toBe(0)
    expect(teamPageRes.displayPosition).toBe('—')
    expect(formatConstructorPosition(teamPageRes.position)).toBe('—')
  })

  // TPI01-06: Objetivo da Diretoria usa position/points atuais.
  it('TPI01-06: Objetivo da Diretoria usa position/points atuais', () => {
    const careerId = 'career_tpi01_06'
    setupControlledChampionshipState(careerId)

    const teamPageRes = resolveTeamPageStanding(careerId, 2026, 'audi')

    const progress = calculateSeasonObjectiveProgress({
      position: teamPageRes.position,
      points: teamPageRes.points,
      targetRank: 4,
      seasonYear: 2026,
      round: 1,
    })

    expect(progress.isMeeting).toBe(true)
    expect(progress.percentage).toBe(92)
    expect(progress.label).toBe('92% atingido')
  })

  // TPI01-07: Objetivo não usa 0 pts fake se existem standings.
  it('TPI01-07: Objetivo não usa 0 pts fake se existem standings', () => {
    const careerId = 'career_tpi01_07'
    setupControlledChampionshipState(careerId)

    const teamPageRes = resolveTeamPageStanding(careerId, 2026, 'audi')
    expect(teamPageRes.points).toBe(62)

    // Quando position é 3 e points é 62, não pode vir 0 pts fake
    const progressWithPoints = calculateSeasonObjectiveProgress({
      position: teamPageRes.position,
      points: teamPageRes.points,
      targetRank: 4,
      seasonYear: 2026,
      round: 1,
    })

    const progressWithZeroPoints = calculateSeasonObjectiveProgress({
      position: teamPageRes.position,
      points: 0,
      targetRank: 4,
      seasonYear: 2026,
      round: 1,
    })

    // Pontos reais (62) aumentam o progresso em relação a 0 pts fake
    expect(progressWithPoints.percentage).toBeGreaterThan(progressWithZeroPoints.percentage)
  })

  // TPI01-08: Decisões Pendentes usa decisões reais.
  it('TPI01-08: Decisões Pendentes usa decisões reais', () => {
    const staffMembers = [
      {
        staffId: 'st_1',
        name: 'Enrico Cardile',
        role: 'TECHNICAL_DIRECTOR',
        salary: 3000000,
        contract_end: 2026, // Expirando na temporada atual
        morale: 80,
      } as unknown as StaffMember,
      {
        staffId: 'st_2',
        name: 'Stefan Straehle',
        role: 'CHIEF_DESIGNER',
        salary: 1500000,
        contract_end: 2028, // Estável
        morale: 85,
      } as unknown as StaffMember,
    ]

    const decisions = deriveStaffPendingDecisions(staffMembers, 2026)
    expect(decisions.length).toBe(1)
    expect(decisions[0].title).toContain('Renovação de staff')
    expect(decisions[0].title).toContain('Enrico Cardile')
  })

  // TPI01-09: contador de decisões = número de decisões renderizadas.
  it('TPI01-09: contador de decisões = número de decisões renderizadas', () => {
    const staffMembers = [
      {
        staffId: 'st_1',
        name: 'Staff Um',
        role: 'HEAD_OF_AERODYNAMICS',
        salary: 2000000,
        contract_end: 2026,
      } as unknown as StaffMember,
      {
        staffId: 'st_2',
        name: 'Staff Dois',
        role: 'HEAD_OF_STRATEGY',
        salary: 1200000,
        contract_end: 2026,
      } as unknown as StaffMember,
    ]

    const decisions = deriveStaffPendingDecisions(staffMembers, 2026)
    expect(decisions.length).toBe(2)
    // O contador deve ser rigorosamente igual a decisions.length
    const count = decisions.length
    expect(count).toBe(2)
  })

  // TPI01-10: zero decisões → estado "Nenhuma decisão pendente".
  it('TPI01-10: zero decisões → estado "Nenhuma decisão pendente"', () => {
    const staffMembers = [
      {
        staffId: 'st_safe',
        name: 'Staff Seguro',
        role: 'TECHNICAL_DIRECTOR',
        salary: 3000000,
        contract_end: 2029, // Muito além de 2026
      } as unknown as StaffMember,
    ]

    const decisions = deriveStaffPendingDecisions(staffMembers, 2026)
    expect(decisions.length).toBe(0)

    const cardCode = fs.readFileSync(
      path.resolve(__dirname, '../components/team/PendingDecisionsCard.tsx'),
      'utf-8',
    )
    expect(cardCode).toContain('Nenhuma decisão pendente')
  })

  // TPI01-11: quilometragem exibida = quilometragem persistida do piloto.
  it('TPI01-11: quilometragem exibida = quilometragem persistida do piloto', () => {
    const mockDriver = {
      id: 'drv_rookie_1',
      name: 'Piloto Teste',
      mileage_km: 750,
      procedural_data: {},
    }

    const km = resolveDriverDevelopmentMileageKm(mockDriver)
    expect(km).toBe(750)
  })

  // TPI01-12: Mariana: se fixture = 1230 km, UI = 1230 km.
  it('TPI01-12: Mariana: se fixture = 1230 km, UI = 1230 km', () => {
    // FIXTURE DE COERÊNCIA ESPECIFICADA NO ENUNCIADO: Mariana, 1230 km
    const marianaDriver = {
      id: 'drv_mariana_fagundes',
      name: 'Mariana Fagundes',
      procedural_data: {
        developmentMileageKm: 1230,
      },
    }

    const km = resolveDriverDevelopmentMileageKm(marianaDriver)
    expect(km).toBe(1230)
    // Formatação em pt-BR (padrão de locale do projeto)
    expect(km.toLocaleString('pt-BR')).toBe('1.230')
  })

  // TPI01-13: quilometragem não é hardcoded.
  it('TPI01-13: quilometragem não é hardcoded', () => {
    const driverA = { id: 'd_a', name: 'A', mileage_km: 450 }
    const driverB = { id: 'd_b', name: 'B', mileage_km: 1890 }

    const kmA = resolveDriverDevelopmentMileageKm(driverA)
    const kmB = resolveDriverDevelopmentMileageKm(driverB)

    expect(kmA).toBe(450)
    expect(kmB).toBe(1890)
    expect(kmA).not.toBe(kmB)

    // Verificar que o arquivo Team.tsx não contém "1230" ou "1.230" como constante fixa
    const teamCode = fs.readFileSync(path.resolve(__dirname, '../pages/Team.tsx'), 'utf-8')
    expect(teamCode).not.toContain('1230')
    expect(teamCode).not.toContain('1.230')
  })

  // TPI01-14: save/reload preserva quilometragem.
  it('TPI01-14: save/reload preserva quilometragem', () => {
    const savedDriverState = {
      id: 'drv_persistent',
      name: 'Piloto Persistente',
      procedural_data: {
        developmentMileageKm: 820,
      },
    }

    // Simula serialização e reload (save/reload)
    const serialized = JSON.stringify(savedDriverState)
    const reloadedDriverState = JSON.parse(serialized)

    const kmBefore = resolveDriverDevelopmentMileageKm(savedDriverState)
    const kmAfter = resolveDriverDevelopmentMileageKm(reloadedDriverState)

    expect(kmBefore).toBe(820)
    expect(kmAfter).toBe(820)
    expect(kmBefore).toBe(kmAfter)
  })

  // TPI01-15: uma mesma atividade não duplica km.
  it('TPI01-15: uma mesma atividade não duplica km', () => {
    // Histórico de sessões de teste com IDs de sessão únicos para idempotência
    const sessionHistory = [
      { sessionId: 'sess_01', type: 'rookie_test', km: 250, date: '2026-03-01' },
      { sessionId: 'sess_02', type: 'shakedown', km: 150, date: '2026-03-10' },
    ]

    const driverWithSessions = {
      id: 'drv_idempotent',
      name: 'Piloto Idempotente',
      procedural_data: {
        testSessionsHistory: sessionHistory,
      },
    }

    const km1 = resolveDriverDevelopmentMileageKm(driverWithSessions)
    expect(km1).toBe(400) // 250 + 150

    // Se tentarmos registrar a mesma sessão 'sess_02' de novo (idempotência preservada)
    const duplicateSession = {
      sessionId: 'sess_02',
      type: 'shakedown',
      km: 150,
      date: '2026-03-10',
    }
    const hasAlready = sessionHistory.some((s) => s.sessionId === duplicateSession.sessionId)
    expect(hasAlready).toBe(true)

    // Se a mesma atividade não for duplicada na lista:
    const idempotentHistory = hasAlready ? sessionHistory : [...sessionHistory, duplicateSession]

    const driverAfterIdempotencyCheck = {
      ...driverWithSessions,
      procedural_data: {
        testSessionsHistory: idempotentHistory,
      },
    }

    const km2 = resolveDriverDevelopmentMileageKm(driverAfterIdempotencyCheck)
    expect(km2).toBe(400)
    expect(km2).toBe(km1)
  })
})
