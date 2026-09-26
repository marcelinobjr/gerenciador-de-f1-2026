import React from 'react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HistoryPage from '@/pages/History'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { f1Service } from '@/services/f1Service'
import { raceReportService } from '@/services/raceReportService'
import * as AuthContextModule from '@/contexts/AuthContext'
import type { TeamModel, DriverModel, SeasonModel } from '@/types/f1'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'

// Mock do client PocketBase para garantir ausência no PB (sem records)
vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    authStore: {
      isValid: true,
      record: { id: 'usr-tester', email: 'tester@apex.com' },
      onChange: vi.fn(() => () => {}),
      clear: vi.fn(),
    },
    collection: vi.fn(() => ({
      getFullList: vi.fn().mockResolvedValue([]),
      getList: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
      getFirstListItem: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      subscribe: vi.fn(() => vi.fn()),
      unsubscribe: vi.fn(),
    })),
  },
}))

vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: vi.fn(),
}))

const createMockTeam = (id: string, name: string, color: string): TeamModel => ({
  id,
  name,
  team_key: id,
  color,
  budget: 100000000,
  cost_cap_spent: 30000000,
  engine_supplier: 'Ferrari',
  chassis_level: 80,
  aero_level: 80,
  strategy_level: 80,
})

const createMockSeason = (
  id: string,
  year: number,
  currentRound: number = 1,
  teamId: string = 'team_canonical_a',
): SeasonModel => ({
  id,
  year,
  current_round: currentRound,
  total_rounds: 24,
  team_id: teamId,
})

const createMockDrivers = (teamId: string): DriverModel[] => [
  {
    id: `drv-${teamId}-1`,
    name: `Piloto 1 ${teamId}`,
    team_id: teamId,
    nationality: 'Brasil',
    age: 24,
    speed: 85,
    consistency: 84,
    rain: 80,
    defense: 82,
    salary: 5000000,
    contract_end: 2027,
    role: 'titular',
    morale: 90,
    physical_condition: 95,
  },
  {
    id: `drv-${teamId}-2`,
    name: `Piloto 2 ${teamId}`,
    team_id: teamId,
    nationality: 'França',
    age: 26,
    speed: 83,
    consistency: 82,
    rain: 81,
    defense: 80,
    salary: 4000000,
    contract_end: 2026,
    role: 'titular',
    morale: 88,
    physical_condition: 90,
  },
]

describe('BUG-INTEGRIDADE-05D1A — Histórico de Resultados Canônicos', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  // =========================================================================
  // TESTE A:
  // Corrida concluída preparada pelo caminho canônico, sem registro no PocketBase
  // -> renderizar Histórico -> evento e resultado corretos aparecem
  // -> leitura repetida sem duplicação. Exercita leitura real do serviço.
  // =========================================================================
  it('TESTE A: resultado canônico persistido sem registro no PocketBase aparece no Histórico e leituras repetidas não duplicam', async () => {
    const careerTeam = createMockTeam('team_canonical_a', 'Scuderia Velocita', '#E10600')
    const season = createMockSeason('season_canonical_2026', 2026, 1)
    const drivers = createMockDrivers(careerTeam.id)
    const careerId = `career_${careerTeam.id}_${season.id}`

    // PocketBase retorna vazio para resultados e relatórios
    vi.spyOn(f1Service, 'getSeasonRaceResults').mockResolvedValue([])
    vi.spyOn(f1Service, 'getTeamDrivers').mockResolvedValue(drivers)
    vi.spyOn(raceReportService, 'getSeasonReports').mockResolvedValue([])

    // Preparar resultado canônico oficial para o round 1 na carreira ativa
    // Exercitando canonicalCareerPersistenceService e canonicalRaceResultService reais
    const entryP1 = {
      driverId: drivers[0].id,
      driverName: drivers[0].name,
      teamId: careerTeam.id,
      teamName: careerTeam.name,
      teamColor: careerTeam.color,
      isPlayer: true,
      gridPosition: 2,
      finalPosition: 1,
      positionsGainedLost: 1,
      raceTime: 5400.123,
      gapToWinner: 'Líder',
      lapsCompleted: 57,
      status: 'finished' as const,
      dnf: false,
      fastestLap: true,
      pitStops: 2,
      pointsAwarded: 26, // 25 + 1
    }

    const entryP3 = {
      driverId: drivers[1].id,
      driverName: drivers[1].name,
      teamId: careerTeam.id,
      teamName: careerTeam.name,
      teamColor: careerTeam.color,
      isPlayer: true,
      gridPosition: 4,
      finalPosition: 3,
      positionsGainedLost: 1,
      raceTime: 5415.89,
      gapToWinner: '+15.767s',
      lapsCompleted: 57,
      status: 'finished' as const,
      dnf: false,
      fastestLap: false,
      pitStops: 2,
      pointsAwarded: 15,
    }

    const entryP2 = {
      driverId: 'drv_rival_1',
      driverName: 'Rival Racer',
      teamId: 'team_rival_1',
      teamName: 'Rival GP',
      teamColor: '#2563EB',
      isPlayer: false,
      gridPosition: 1,
      finalPosition: 2,
      positionsGainedLost: -1,
      raceTime: 5408.2,
      gapToWinner: '+8.077s',
      lapsCompleted: 57,
      status: 'finished' as const,
      dnf: false,
      fastestLap: false,
      pitStops: 2,
      pointsAwarded: 18,
    }

    const canonicalResultRound1: OfficialRaceResult = {
      officialResultId: `official_${careerId}_s2026_r1`,
      schemaVersion: 'official-race-result-v1',
      raceId: `race_${careerId}_s2026_r1`,
      careerId,
      season: 2026,
      round: 1,
      circuitId: 'bahrain',
      circuitName: 'Sakhir International',
      circuitCountry: 'Bahrein',
      playerTeamId: careerTeam.id,
      officializedAt: '2026-03-15T16:00:00.000Z',
      totalLaps: 57,
      winnerDriverId: drivers[0].id,
      winnerTeamId: careerTeam.id,
      poleDriverId: 'drv_rival_1',
      fastestLapDriverId: drivers[0].id,
      podium: [drivers[0].id, 'drv_rival_1', drivers[1].id],
      entries: [entryP1, entryP2, entryP3],
      playerEntries: [entryP1, entryP3],
      eventsSummary: {
        safetyCarPeriods: 0,
        safetyCarLaps: 0,
        vscPeriods: 0,
        vscLaps: 0,
        redFlagPeriods: 0,
        dnfCount: 0,
        totalPitStops: 6,
        significantIncidents: [],
      },
      resultHash: 'hash_round_1',
    }

    // Persistir no serviço canônico real (sem mocks no retorno do persistence)
    canonicalRaceResultService.saveOfficialRaceResult(canonicalResultRound1)
    canonicalCareerPersistenceService.savePersistedRaceResult({
      id: `persisted_${careerId}_s2026_r1`,
      careerId,
      seasonId: 's2026',
      season: 2026,
      round: 1,
      eventId: `event_${careerId}_s2026_r1`,
      circuitId: 'bahrain',
      officialRaceResultId: canonicalResultRound1.officialResultId,
      checksum: canonicalResultRound1.resultHash,
      winnerDriverId: canonicalResultRound1.winnerDriverId,
      poleDriverId: canonicalResultRound1.poleDriverId,
      fastestLapDriverId: canonicalResultRound1.fastestLapDriverId,
      officializedAt: canonicalResultRound1.officializedAt,
      createdAt: '2026-03-15T16:05:00.000Z',
      entries: canonicalResultRound1.entries,
      playerEntries: canonicalResultRound1.playerEntries,
      snapshot: canonicalResultRound1,
    })

    // Verificar que a API canônica real recupera o dado persistido
    const retrieved = canonicalCareerPersistenceService.getPersistedRaceResult(careerId, 2026, 1)
    expect(retrieved).not.toBeNull()
    expect(retrieved?.snapshot.entries).toHaveLength(3)

    // Configurar AuthContext para esta carreira
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-tester', email: 'tester@apex.com' } as any,
      team: careerTeam,
      season,
      isLoading: false,
      careerPhase: 'career',
      refreshTeamAndSeason: vi.fn().mockResolvedValue(undefined),
      resetGame: vi.fn().mockResolvedValue(undefined),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      ensureValidSession: vi.fn().mockResolvedValue(true),
    })

    // Primeira renderização
    const { unmount } = render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )

    // Esperar carregar e verificar se os pontos somados (26 + 15 = 41 pts) aparecem
    await waitFor(() => {
      expect(screen.getByText(/41/)).toBeInTheDocument()
    })

    // Vitória P1 e Pódio P3
    expect(screen.getByText(/1V • 2P/)).toBeInTheDocument()

    // O status oficializado e o card da rodada 1 devem estar presentes
    expect(screen.getByText('Oficializado')).toBeInTheDocument()
    expect(screen.getByText(/P1/)).toBeInTheDocument()
    expect(screen.getByText(/P3/)).toBeInTheDocument()

    // Desmontar e renderizar novamente (leitura repetida sem efeitos colaterais)
    unmount()

    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/41/)).toBeInTheDocument()
    })

    // Confirmar que os pontos continuam sendo 41 e não duplicaram para 82
    expect(screen.getByText(/41/)).toBeInTheDocument()
    expect(screen.getByText(/1V • 2P/)).toBeInTheDocument()
  })

  // =========================================================================
  // TESTE B:
  // Resultados de duas carreiras distintas (mesma temporada e circuito)
  // -> Histórico da carreira A não mostra o da carreira B.
  // =========================================================================
  it('TESTE B: isolamento estrito entre carreiras distintas no mesmo ano e etapa', async () => {
    const teamA = createMockTeam('team_carreira_alpha', 'Alpha Racing', '#10B981')
    const seasonA = createMockSeason('season_alpha_2026', 2026, 1, teamA.id)
    const driversA = createMockDrivers(teamA.id)
    const careerIdA = `career_${teamA.id}_${seasonA.id}`

    const teamB = createMockTeam('team_carreira_beta', 'Beta Motorsport', '#F59E0B')
    const seasonB = createMockSeason('season_beta_2026', 2026, 1, teamB.id)
    const driversB = createMockDrivers(teamB.id)
    const careerIdB = `career_${teamB.id}_${seasonB.id}`

    vi.spyOn(f1Service, 'getSeasonRaceResults').mockResolvedValue([])
    vi.spyOn(f1Service, 'getTeamDrivers').mockImplementation(async (teamId) => {
      if (teamId === teamA.id) return driversA
      if (teamId === teamB.id) return driversB
      return []
    })
    vi.spyOn(raceReportService, 'getSeasonReports').mockResolvedValue([])

    // Persistir resultado canônico para Carreira A na R1: piloto da Alpha vence (25 pts)
    const entryA1 = {
      driverId: driversA[0].id,
      driverName: driversA[0].name,
      teamId: teamA.id,
      teamName: teamA.name,
      teamColor: teamA.color,
      isPlayer: true,
      gridPosition: 1,
      finalPosition: 1,
      positionsGainedLost: 0,
      raceTime: 5000,
      gapToWinner: 'Líder',
      lapsCompleted: 50,
      status: 'finished' as const,
      dnf: false,
      fastestLap: false,
      pitStops: 1,
      pointsAwarded: 25,
    }

    const entryA2 = {
      driverId: driversA[1].id,
      driverName: driversA[1].name,
      teamId: teamA.id,
      teamName: teamA.name,
      teamColor: teamA.color,
      isPlayer: true,
      gridPosition: 12,
      finalPosition: 12,
      positionsGainedLost: 0,
      raceTime: 5050,
      gapToWinner: '+50.0s',
      lapsCompleted: 50,
      status: 'finished' as const,
      dnf: false,
      fastestLap: false,
      pitStops: 1,
      pointsAwarded: 0,
    }

    const resultCareerA: OfficialRaceResult = {
      officialResultId: `official_${careerIdA}_s2026_r1`,
      schemaVersion: 'official-race-result-v1',
      raceId: `race_${careerIdA}_s2026_r1`,
      careerId: careerIdA,
      season: 2026,
      round: 1,
      circuitId: 'bahrain',
      circuitName: 'Sakhir International',
      circuitCountry: 'Bahrein',
      playerTeamId: teamA.id,
      officializedAt: '2026-03-15T16:00:00.000Z',
      totalLaps: 50,
      winnerDriverId: driversA[0].id,
      winnerTeamId: teamA.id,
      poleDriverId: driversA[0].id,
      fastestLapDriverId: driversA[0].id,
      podium: [driversA[0].id, 'drv_other_p2', 'drv_other_p3'],
      entries: [entryA1, entryA2],
      playerEntries: [entryA1, entryA2],
      eventsSummary: {
        safetyCarPeriods: 0,
        safetyCarLaps: 0,
        vscPeriods: 0,
        vscLaps: 0,
        redFlagPeriods: 0,
        dnfCount: 0,
        totalPitStops: 2,
        significantIncidents: [],
      },
      resultHash: 'chk_a',
    }

    // Persistir resultado canônico para Carreira B na R1: piloto da Beta marca 10 pts (P5)
    const entryB1 = {
      driverId: driversB[0].id,
      driverName: driversB[0].name,
      teamId: teamB.id,
      teamName: teamB.name,
      teamColor: teamB.color,
      isPlayer: true,
      gridPosition: 8,
      finalPosition: 5,
      positionsGainedLost: 3,
      raceTime: 5020,
      gapToWinner: '+20.0s',
      lapsCompleted: 50,
      status: 'finished' as const,
      dnf: false,
      fastestLap: false,
      pitStops: 1,
      pointsAwarded: 10,
    }

    const entryB2 = {
      driverId: driversB[1].id,
      driverName: driversB[1].name,
      teamId: teamB.id,
      teamName: teamB.name,
      teamColor: teamB.color,
      isPlayer: true,
      gridPosition: 14,
      finalPosition: 14,
      positionsGainedLost: 0,
      raceTime: 5060,
      gapToWinner: '+60.0s',
      lapsCompleted: 50,
      status: 'finished' as const,
      dnf: false,
      fastestLap: false,
      pitStops: 1,
      pointsAwarded: 0,
    }

    const resultCareerB: OfficialRaceResult = {
      officialResultId: `official_${careerIdB}_s2026_r1`,
      schemaVersion: 'official-race-result-v1',
      raceId: `race_${careerIdB}_s2026_r1`,
      careerId: careerIdB,
      season: 2026,
      round: 1,
      circuitId: 'bahrain',
      circuitName: 'Sakhir International',
      circuitCountry: 'Bahrein',
      playerTeamId: teamB.id,
      officializedAt: '2026-03-15T16:00:00.000Z',
      totalLaps: 50,
      winnerDriverId: 'drv_other',
      winnerTeamId: 'team_other',
      poleDriverId: 'drv_other',
      fastestLapDriverId: 'drv_other',
      podium: ['drv_other', 'drv_other_p2', 'drv_other_p3'],
      entries: [entryB1, entryB2],
      playerEntries: [entryB1, entryB2],
      eventsSummary: {
        safetyCarPeriods: 0,
        safetyCarLaps: 0,
        vscPeriods: 0,
        vscLaps: 0,
        redFlagPeriods: 0,
        dnfCount: 0,
        totalPitStops: 2,
        significantIncidents: [],
      },
      resultHash: 'chk_b',
    }

    canonicalRaceResultService.saveOfficialRaceResult(resultCareerA)
    canonicalCareerPersistenceService.savePersistedRaceResult({
      id: `persisted_${careerIdA}_s2026_r1`,
      careerId: careerIdA,
      seasonId: 's2026',
      season: 2026,
      round: 1,
      eventId: `event_${careerIdA}_s2026_r1`,
      circuitId: 'bahrain',
      officialRaceResultId: resultCareerA.officialResultId,
      checksum: resultCareerA.resultHash,
      winnerDriverId: resultCareerA.winnerDriverId,
      poleDriverId: resultCareerA.poleDriverId,
      fastestLapDriverId: resultCareerA.fastestLapDriverId,
      officializedAt: resultCareerA.officializedAt,
      createdAt: '2026-03-15T16:05:00.000Z',
      entries: resultCareerA.entries,
      playerEntries: resultCareerA.playerEntries,
      snapshot: resultCareerA,
    })

    canonicalRaceResultService.saveOfficialRaceResult(resultCareerB)
    canonicalCareerPersistenceService.savePersistedRaceResult({
      id: `persisted_${careerIdB}_s2026_r1`,
      careerId: careerIdB,
      seasonId: 's2026',
      season: 2026,
      round: 1,
      eventId: `event_${careerIdB}_s2026_r1`,
      circuitId: 'bahrain',
      officialRaceResultId: resultCareerB.officialResultId,
      checksum: resultCareerB.resultHash,
      winnerDriverId: resultCareerB.winnerDriverId,
      poleDriverId: resultCareerB.poleDriverId,
      fastestLapDriverId: resultCareerB.fastestLapDriverId,
      officializedAt: resultCareerB.officializedAt,
      createdAt: '2026-03-15T16:05:00.000Z',
      entries: resultCareerB.entries,
      playerEntries: resultCareerB.playerEntries,
      snapshot: resultCareerB,
    })

    // Autenticado na Carreira A
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-tester', email: 'tester@apex.com' } as any,
      team: teamA,
      season: seasonA,
      isLoading: false,
      careerPhase: 'career',
      refreshTeamAndSeason: vi.fn().mockResolvedValue(undefined),
      resetGame: vi.fn().mockResolvedValue(undefined),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      ensureValidSession: vi.fn().mockResolvedValue(true),
    })

    const { unmount } = render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )

    // Deve exibir apenas os 25 pts da Carreira A, e NÃO os 10 pts da Carreira B
    await waitFor(() => {
      expect(screen.getByText(/25/)).toBeInTheDocument()
    })

    expect(screen.queryByText(/Piloto 1 team_carreira_beta/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Beta Motorsport/)).not.toBeInTheDocument()

    unmount()

    // Agora simular visualização da Carreira B
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-tester', email: 'tester@apex.com' } as any,
      team: teamB,
      season: seasonB,
      isLoading: false,
      careerPhase: 'career',
      refreshTeamAndSeason: vi.fn().mockResolvedValue(undefined),
      resetGame: vi.fn().mockResolvedValue(undefined),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      ensureValidSession: vi.fn().mockResolvedValue(true),
    })

    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )

    // Deve exibir 10 pts da Carreira B, e NÃO os 25 pts da Carreira A
    await waitFor(() => {
      expect(screen.getByText(/10/)).toBeInTheDocument()
    })

    expect(screen.queryByText(/Piloto 1 team_carreira_alpha/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Alpha Racing/)).not.toBeInTheDocument()
  })
})
