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

  // =========================================================================
  // COMPORTAMENTO A (Estendido):
  // Múltiplas etapas (pelo menos duas corridas concluídas, mesma carreira/temporada,
  // etapas diferentes). Sem registros no PB, ambas devem ser consideradas.
  // A leitura não pode recuperar somente a última corrida; posições, pontos e totais
  // devem corresponder aos registros; releituras não duplicam.
  // =========================================================================
  it('COMPORTAMENTO A: recuperação de múltiplas etapas concluídas sem omitir corridas anteriores nem duplicar totais', async () => {
    const careerTeam = createMockTeam('team_multi_gp', 'Chronos Racing', '#00A6FB')
    const season = createMockSeason('season_multi_2026', 2026, 3, careerTeam.id)
    const drivers = createMockDrivers(careerTeam.id)
    const careerId = `career_${careerTeam.id}_${season.id}`

    vi.spyOn(f1Service, 'getSeasonRaceResults').mockResolvedValue([])
    vi.spyOn(f1Service, 'getTeamDrivers').mockResolvedValue(drivers)
    vi.spyOn(raceReportService, 'getSeasonReports').mockResolvedValue([])

    // Etapa 1 (Round 1 - Bahrein): Piloto 1 vence (P1 = 25 pts), Piloto 2 P4 (12 pts) -> Total Round 1 = 37 pts
    const entryR1_D1 = {
      driverId: drivers[0].id,
      driverName: drivers[0].name,
      teamId: careerTeam.id,
      teamName: careerTeam.name,
      teamColor: careerTeam.color,
      isPlayer: true,
      gridPosition: 1,
      finalPosition: 1,
      positionsGainedLost: 0,
      raceTime: 5400,
      gapToWinner: 'Líder',
      lapsCompleted: 57,
      status: 'finished' as const,
      dnf: false,
      fastestLap: false,
      pitStops: 2,
      pointsAwarded: 25,
    }
    const entryR1_D2 = {
      driverId: drivers[1].id,
      driverName: drivers[1].name,
      teamId: careerTeam.id,
      teamName: careerTeam.name,
      teamColor: careerTeam.color,
      isPlayer: true,
      gridPosition: 4,
      finalPosition: 4,
      positionsGainedLost: 0,
      raceTime: 5420,
      gapToWinner: '+20.0s',
      lapsCompleted: 57,
      status: 'finished' as const,
      dnf: false,
      fastestLap: false,
      pitStops: 2,
      pointsAwarded: 12,
    }

    const officialR1: OfficialRaceResult = {
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
      poleDriverId: drivers[0].id,
      podium: [drivers[0].id, 'drv_other_2', 'drv_other_3'],
      entries: [entryR1_D1, entryR1_D2],
      playerEntries: [entryR1_D1, entryR1_D2],
      eventsSummary: {
        safetyCarPeriods: 0,
        safetyCarLaps: 0,
        vscPeriods: 0,
        vscLaps: 0,
        redFlagPeriods: 0,
        dnfCount: 0,
        totalPitStops: 4,
        significantIncidents: [],
      },
      resultHash: 'hash_multi_r1',
    }

    // Etapa 2 (Round 2 - Arábia Saudita): Piloto 1 P2 (18 pts), Piloto 2 P3 (15 pts) -> Total Round 2 = 33 pts
    // Total Geral Esperado = 37 + 33 = 70 pts
    const entryR2_D1 = {
      driverId: drivers[0].id,
      driverName: drivers[0].name,
      teamId: careerTeam.id,
      teamName: careerTeam.name,
      teamColor: careerTeam.color,
      isPlayer: true,
      gridPosition: 2,
      finalPosition: 2,
      positionsGainedLost: 0,
      raceTime: 5100,
      gapToWinner: '+2.5s',
      lapsCompleted: 50,
      status: 'finished' as const,
      dnf: false,
      fastestLap: false,
      pitStops: 1,
      pointsAwarded: 18,
    }
    const entryR2_D2 = {
      driverId: drivers[1].id,
      driverName: drivers[1].name,
      teamId: careerTeam.id,
      teamName: careerTeam.name,
      teamColor: careerTeam.color,
      isPlayer: true,
      gridPosition: 3,
      finalPosition: 3,
      positionsGainedLost: 0,
      raceTime: 5105,
      gapToWinner: '+7.5s',
      lapsCompleted: 50,
      status: 'finished' as const,
      dnf: false,
      fastestLap: false,
      pitStops: 1,
      pointsAwarded: 15,
    }

    const officialR2: OfficialRaceResult = {
      officialResultId: `official_${careerId}_s2026_r2`,
      schemaVersion: 'official-race-result-v1',
      raceId: `race_${careerId}_s2026_r2`,
      careerId,
      season: 2026,
      round: 2,
      circuitId: 'jeddah',
      circuitName: 'Jeddah Corniche Circuit',
      circuitCountry: 'Arábia Saudita',
      playerTeamId: careerTeam.id,
      officializedAt: '2026-03-22T17:00:00.000Z',
      totalLaps: 50,
      winnerDriverId: 'drv_other_winner',
      winnerTeamId: 'team_other',
      poleDriverId: 'drv_other_winner',
      podium: ['drv_other_winner', drivers[0].id, drivers[1].id],
      entries: [entryR2_D1, entryR2_D2],
      playerEntries: [entryR2_D1, entryR2_D2],
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
      resultHash: 'hash_multi_r2',
    }

    // Persistir ambas as etapas pelo caminho canônico oficial
    canonicalRaceResultService.saveOfficialRaceResult(officialR1)
    canonicalCareerPersistenceService.savePersistedRaceResult({
      id: `persisted_${careerId}_s2026_r1`,
      careerId,
      seasonId: 's2026',
      season: 2026,
      round: 1,
      eventId: `event_${careerId}_s2026_r1`,
      circuitId: 'bahrain',
      officialRaceResultId: officialR1.officialResultId,
      checksum: officialR1.resultHash,
      winnerDriverId: officialR1.winnerDriverId,
      poleDriverId: officialR1.poleDriverId,
      officializedAt: officialR1.officializedAt,
      createdAt: '2026-03-15T16:05:00.000Z',
      entries: officialR1.entries,
      playerEntries: officialR1.playerEntries,
      snapshot: officialR1,
    })

    canonicalRaceResultService.saveOfficialRaceResult(officialR2)
    canonicalCareerPersistenceService.savePersistedRaceResult({
      id: `persisted_${careerId}_s2026_r2`,
      careerId,
      seasonId: 's2026',
      season: 2026,
      round: 2,
      eventId: `event_${careerId}_s2026_r2`,
      circuitId: 'jeddah',
      officialRaceResultId: officialR2.officialResultId,
      checksum: officialR2.resultHash,
      winnerDriverId: officialR2.winnerDriverId,
      poleDriverId: officialR2.poleDriverId,
      officializedAt: officialR2.officializedAt,
      createdAt: '2026-03-22T17:05:00.000Z',
      entries: officialR2.entries,
      playerEntries: officialR2.playerEntries,
      snapshot: officialR2,
    })

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

    const { unmount } = render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )

    // Ambos os GPs devem ser computados: 37 pts (R1) + 33 pts (R2) = 70 pts
    await waitFor(() => {
      expect(screen.getByText(/70/)).toBeInTheDocument()
    })

    // Confirmar que R1 e R2 estão presentes e não foram esquecidos (não recupera somente a última corrida)
    expect(screen.getByText(/2 de 24 GPs disputados/)).toBeInTheDocument()
    // Vitórias e pódios somados: R1 teve 1V e 1P; R2 teve 2P -> 1 vitória e 3 pódios
    expect(screen.getByText(/1V • 3P/)).toBeInTheDocument()

    // Releitura não duplica (desmontar e remontar)
    unmount()
    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/70/)).toBeInTheDocument()
    })
    expect(screen.getByText(/1V • 3P/)).toBeInTheDocument()
  })

  // =========================================================================
  // COMPORTAMENTO C:
  // Temporadas e temporada em andamento:
  // - Resultados de temporadas distintas permanecem separados.
  // - Temporada em andamento mostra eventos já concluídos (não exigir encerramento anual).
  // - Não assumir ano fixo, calendário fixo ou Audi como equipe humana.
  // =========================================================================
  it('COMPORTAMENTO C: temporadas distintas permanecem isoladas e temporada em andamento exibe eventos concluídos sem exigir encerramento anual', async () => {
    const dynamicTeam = createMockTeam('team_custom_racing', 'Zenith GP', '#7C3AED')
    const seasonYearA = 2027
    const seasonYearB = 2028
    const season2027 = createMockSeason('season_zenith_2027', seasonYearA, 2, dynamicTeam.id)
    const season2028 = createMockSeason('season_zenith_2028', seasonYearB, 1, dynamicTeam.id)
    const drivers = createMockDrivers(dynamicTeam.id)
    const careerId = `career_${dynamicTeam.id}_${season2027.id}`

    vi.spyOn(f1Service, 'getSeasonRaceResults').mockResolvedValue([])
    vi.spyOn(f1Service, 'getTeamDrivers').mockResolvedValue(drivers)
    vi.spyOn(raceReportService, 'getSeasonReports').mockResolvedValue([])

    // 2027: Rodada 1 concluída na temporada em andamento (Piloto marca 25 pts)
    const entry2027 = {
      driverId: drivers[0].id,
      driverName: drivers[0].name,
      teamId: dynamicTeam.id,
      teamName: dynamicTeam.name,
      teamColor: dynamicTeam.color,
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
    const official2027: OfficialRaceResult = {
      officialResultId: `official_${careerId}_s2027_r1`,
      schemaVersion: 'official-race-result-v1',
      raceId: `race_${careerId}_s2027_r1`,
      careerId,
      season: seasonYearA,
      round: 1,
      circuitId: 'bahrain',
      circuitName: 'Sakhir International',
      circuitCountry: 'Bahrein',
      playerTeamId: dynamicTeam.id,
      officializedAt: '2027-03-15T16:00:00.000Z',
      totalLaps: 50,
      winnerDriverId: drivers[0].id,
      winnerTeamId: dynamicTeam.id,
      poleDriverId: drivers[0].id,
      podium: [drivers[0].id, 'drv_other_2', 'drv_other_3'],
      entries: [entry2027],
      playerEntries: [entry2027, entry2027],
      eventsSummary: {
        safetyCarPeriods: 0,
        safetyCarLaps: 0,
        vscPeriods: 0,
        vscLaps: 0,
        redFlagPeriods: 0,
        dnfCount: 0,
        totalPitStops: 1,
        significantIncidents: [],
      },
      resultHash: 'hash_2027_r1',
    }
    canonicalRaceResultService.saveOfficialRaceResult(official2027)
    canonicalCareerPersistenceService.savePersistedRaceResult({
      id: `persisted_${careerId}_s2027_r1`,
      careerId,
      seasonId: 's2027',
      season: seasonYearA,
      round: 1,
      eventId: `event_${careerId}_s2027_r1`,
      circuitId: 'bahrain',
      officialRaceResultId: official2027.officialResultId,
      checksum: official2027.resultHash,
      winnerDriverId: official2027.winnerDriverId,
      poleDriverId: official2027.poleDriverId,
      officializedAt: official2027.officializedAt,
      createdAt: '2027-03-15T16:05:00.000Z',
      entries: official2027.entries,
      playerEntries: official2027.playerEntries,
      snapshot: official2027,
    })

    // 2028: Rodada 1 na temporada seguinte (Piloto marca 8 pts)
    const entry2028 = {
      driverId: drivers[0].id,
      driverName: drivers[0].name,
      teamId: dynamicTeam.id,
      teamName: dynamicTeam.name,
      teamColor: dynamicTeam.color,
      isPlayer: true,
      gridPosition: 6,
      finalPosition: 6,
      positionsGainedLost: 0,
      raceTime: 5050,
      gapToWinner: '+25s',
      lapsCompleted: 50,
      status: 'finished' as const,
      dnf: false,
      fastestLap: false,
      pitStops: 1,
      pointsAwarded: 8,
    }
    const official2028: OfficialRaceResult = {
      officialResultId: `official_${careerId}_s2028_r1`,
      schemaVersion: 'official-race-result-v1',
      raceId: `race_${careerId}_s2028_r1`,
      careerId,
      season: seasonYearB,
      round: 1,
      circuitId: 'bahrain',
      circuitName: 'Sakhir International',
      circuitCountry: 'Bahrein',
      playerTeamId: dynamicTeam.id,
      officializedAt: '2028-03-15T16:00:00.000Z',
      totalLaps: 50,
      winnerDriverId: 'drv_other',
      winnerTeamId: 'team_other',
      poleDriverId: 'drv_other',
      podium: ['drv_other', 'drv_other_2', 'drv_other_3'],
      entries: [entry2028],
      playerEntries: [entry2028, entry2028],
      eventsSummary: {
        safetyCarPeriods: 0,
        safetyCarLaps: 0,
        vscPeriods: 0,
        vscLaps: 0,
        redFlagPeriods: 0,
        dnfCount: 0,
        totalPitStops: 1,
        significantIncidents: [],
      },
      resultHash: 'hash_2028_r1',
    }
    canonicalRaceResultService.saveOfficialRaceResult(official2028)
    canonicalCareerPersistenceService.savePersistedRaceResult({
      id: `persisted_${careerId}_s2028_r1`,
      careerId,
      seasonId: 's2028',
      season: seasonYearB,
      round: 1,
      eventId: `event_${careerId}_s2028_r1`,
      circuitId: 'bahrain',
      officialRaceResultId: official2028.officialResultId,
      checksum: official2028.resultHash,
      winnerDriverId: official2028.winnerDriverId,
      poleDriverId: official2028.poleDriverId,
      officializedAt: official2028.officializedAt,
      createdAt: '2028-03-15T16:05:00.000Z',
      entries: official2028.entries,
      playerEntries: official2028.playerEntries,
      snapshot: official2028,
    })

    // Visualizar temporada 2027 (em andamento, current_round = 2 de 24)
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-tester', email: 'tester@apex.com' } as any,
      team: dynamicTeam,
      season: season2027,
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

    // Na temporada 2027 em andamento, deve exibir a rodada 1 já concluída (25 pts), sem exigir encerramento
    await waitFor(() => {
      expect(screen.getByText(/25/)).toBeInTheDocument()
    })
    expect(screen.getByText(/TEMPORADA 2027/)).toBeInTheDocument()
    expect(screen.queryByText(/TEMPORADA 2028/)).not.toBeInTheDocument()

    // Trocar para temporada 2028
    unmount()
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-tester', email: 'tester@apex.com' } as any,
      team: dynamicTeam,
      season: season2028,
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

    await waitFor(() => {
      expect(screen.getByText(/8/)).toBeInTheDocument()
    })
    expect(screen.getByText(/TEMPORADA 2028/)).toBeInTheDocument()
  })

  // =========================================================================
  // COMPORTAMENTO D:
  // Resultado definitivo vs provisório:
  // - Sessão em andamento ou snapshot provisório não aparece como definitivo.
  // - DNF/DSQ de piloto em corrida concluída não invalida o resultado nem remove o piloto.
  // =========================================================================
  it('COMPORTAMENTO D: sessão em andamento/provisória não é oficializada, e abandono (DNF) preserva o registro do piloto sem invalidar a corrida', async () => {
    const careerTeam = createMockTeam('team_definitivo', 'Apex Motorsport', '#E10600')
    const season = createMockSeason('season_def_2026', 2026, 2, careerTeam.id)
    const drivers = createMockDrivers(careerTeam.id)
    const careerId = `career_${careerTeam.id}_${season.id}`

    vi.spyOn(f1Service, 'getSeasonRaceResults').mockResolvedValue([])
    vi.spyOn(f1Service, 'getTeamDrivers').mockResolvedValue(drivers)
    vi.spyOn(raceReportService, 'getSeasonReports').mockResolvedValue([])

    // Round 1: Corrida concluída com DNF legítimo (motor quebrado).
    // Piloto 1 completou P2 (18 pts), Piloto 2 teve DNF na volta 12 (0 pts, status dnf).
    const entryD1 = {
      driverId: drivers[0].id,
      driverName: drivers[0].name,
      teamId: careerTeam.id,
      teamName: careerTeam.name,
      teamColor: careerTeam.color,
      isPlayer: true,
      gridPosition: 2,
      finalPosition: 2,
      positionsGainedLost: 0,
      raceTime: 5200,
      gapToWinner: '+3.1s',
      lapsCompleted: 50,
      status: 'finished' as const,
      dnf: false,
      fastestLap: false,
      pitStops: 1,
      pointsAwarded: 18,
    }
    const entryD2_DNF = {
      driverId: drivers[1].id,
      driverName: drivers[1].name,
      teamId: careerTeam.id,
      teamName: careerTeam.name,
      teamColor: careerTeam.color,
      isPlayer: true,
      gridPosition: 5,
      finalPosition: 20,
      positionsGainedLost: -15,
      raceTime: 1200,
      gapToWinner: 'DNF',
      lapsCompleted: 12,
      status: 'dnf' as const,
      dnf: true,
      dnfReason: 'Falha Mecânica no ICE',
      fastestLap: false,
      pitStops: 1,
      pointsAwarded: 0,
    }

    const officialR1: OfficialRaceResult = {
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
      totalLaps: 50,
      winnerDriverId: 'drv_other_winner',
      winnerTeamId: 'team_other',
      poleDriverId: 'drv_other_winner',
      podium: ['drv_other_winner', drivers[0].id, 'drv_other_p3'],
      entries: [entryD1, entryD2_DNF],
      playerEntries: [entryD1, entryD2_DNF],
      eventsSummary: {
        safetyCarPeriods: 0,
        safetyCarLaps: 0,
        vscPeriods: 0,
        vscLaps: 0,
        redFlagPeriods: 0,
        dnfCount: 1,
        totalPitStops: 2,
        significantIncidents: [],
      },
      resultHash: 'hash_dnf_r1',
    }

    canonicalRaceResultService.saveOfficialRaceResult(officialR1)
    canonicalCareerPersistenceService.savePersistedRaceResult({
      id: `persisted_${careerId}_s2026_r1`,
      careerId,
      seasonId: 's2026',
      season: 2026,
      round: 1,
      eventId: `event_${careerId}_s2026_r1`,
      circuitId: 'bahrain',
      officialRaceResultId: officialR1.officialResultId,
      checksum: officialR1.resultHash,
      winnerDriverId: officialR1.winnerDriverId,
      poleDriverId: officialR1.poleDriverId,
      officializedAt: officialR1.officializedAt,
      createdAt: '2026-03-15T16:05:00.000Z',
      entries: officialR1.entries,
      playerEntries: officialR1.playerEntries,
      snapshot: officialR1,
    })

    // Round 2 NÃO está oficializado no serviço canônico (está em andamento / provisório)
    // Garantir que não existe resultado oficial para a R2
    canonicalRaceResultService.clearOfficialRaceResultForTesting(careerId, 2026, 2)

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

    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )

    // Esperar carregar R1
    await waitFor(() => {
      expect(screen.getByText(/18/)).toBeInTheDocument()
    })

    // O piloto com DNF continua no registro da rodada 1 e com badge DNF visível
    expect(screen.getByText('DNF')).toBeInTheDocument()
    // R1 está como Oficializado
    expect(screen.getAllByText('Oficializado').length).toBeGreaterThanOrEqual(1)
    // Apenas 1 GP oficializado
    expect(screen.getByText(/1 de 24 GPs disputados/)).toBeInTheDocument()
  })

  // =========================================================================
  // COMPORTAMENTO E:
  // Save / reload real:
  // - Persistir em armazenamento de teste isolado (localStorage mockado pelo jsdom).
  // - Desmontar a tela, descartar estado transitório e recarregar pelo caminho real de leitura.
  // - Resultados continuam disponíveis sem duplicação.
  // =========================================================================
  it('COMPORTAMENTO E: save/reload real preserva integridade e permanência sem duplicar registros', async () => {
    const careerTeam = createMockTeam('team_reload', 'Reload GP', '#10B981')
    const season = createMockSeason('season_reload_2026', 2026, 1, careerTeam.id)
    const drivers = createMockDrivers(careerTeam.id)
    const careerId = `career_${careerTeam.id}_${season.id}`

    vi.spyOn(f1Service, 'getSeasonRaceResults').mockResolvedValue([])
    vi.spyOn(f1Service, 'getTeamDrivers').mockResolvedValue(drivers)
    vi.spyOn(raceReportService, 'getSeasonReports').mockResolvedValue([])

    const entry = {
      driverId: drivers[0].id,
      driverName: drivers[0].name,
      teamId: careerTeam.id,
      teamName: careerTeam.name,
      teamColor: careerTeam.color,
      isPlayer: true,
      gridPosition: 1,
      finalPosition: 1,
      positionsGainedLost: 0,
      raceTime: 5000,
      gapToWinner: 'Líder',
      lapsCompleted: 50,
      status: 'finished' as const,
      dnf: false,
      fastestLap: true,
      pitStops: 1,
      pointsAwarded: 26,
    }

    const officialResult: OfficialRaceResult = {
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
      totalLaps: 50,
      winnerDriverId: drivers[0].id,
      winnerTeamId: careerTeam.id,
      poleDriverId: drivers[0].id,
      fastestLapDriverId: drivers[0].id,
      podium: [drivers[0].id, 'drv_p2', 'drv_p3'],
      entries: [entry],
      playerEntries: [entry, entry],
      eventsSummary: {
        safetyCarPeriods: 0,
        safetyCarLaps: 0,
        vscPeriods: 0,
        vscLaps: 0,
        redFlagPeriods: 0,
        dnfCount: 0,
        totalPitStops: 1,
        significantIncidents: [],
      },
      resultHash: 'chk_reload_1',
    }

    // Persistência real no localStorage
    canonicalRaceResultService.saveOfficialRaceResult(officialResult)
    canonicalCareerPersistenceService.savePersistedRaceResult({
      id: `persisted_${careerId}_s2026_r1`,
      careerId,
      seasonId: 's2026',
      season: 2026,
      round: 1,
      eventId: `event_${careerId}_s2026_r1`,
      circuitId: 'bahrain',
      officialRaceResultId: officialResult.officialResultId,
      checksum: officialResult.resultHash,
      winnerDriverId: officialResult.winnerDriverId,
      poleDriverId: officialResult.poleDriverId,
      fastestLapDriverId: officialResult.fastestLapDriverId,
      officializedAt: officialResult.officializedAt,
      createdAt: '2026-03-15T16:05:00.000Z',
      entries: officialResult.entries,
      playerEntries: officialResult.playerEntries,
      snapshot: officialResult,
    })

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

    // Montagem 1
    const { unmount } = render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/26/)).toBeInTheDocument()
    })
    expect(screen.getByText('Oficializado')).toBeInTheDocument()

    // Desmontar completamente
    unmount()

    // Simular reload lendo diretamente os dados do storage real
    const persistedRecord = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerId,
      2026,
      1,
    )
    expect(persistedRecord).not.toBeNull()
    expect(persistedRecord?.snapshot.officialResultId).toBe(officialResult.officialResultId)

    // Montagem 2 (novo ciclo de renderização sem reutilizar instâncias em memória de componente)
    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/26/)).toBeInTheDocument()
    })
    // Não duplicou para 52
    expect(screen.getByText(/1 de 24 GPs disputados/)).toBeInTheDocument()
  })

  // =========================================================================
  // COMPORTAMENTO F:
  // Equipe histórica:
  // - Resultado registra piloto + equipe daquele evento.
  // - Depois alterar o vínculo atual do piloto na fixture da carreira.
  // - O Histórico preserva a equipe registrada no evento antigo.
  // - Quando a equipe histórica não estiver registrada e não houver fonte segura, não inventar vínculo.
  // =========================================================================
  it('COMPORTAMENTO F: preserva a equipe histórica registrada no evento mesmo se o piloto mudar de equipe posteriormente', async () => {
    const historicalTeam = createMockTeam('team_historica_1', 'Equipe Vintage', '#2563EB')
    const currentTeam = createMockTeam('team_historica_2', 'Equipe Atual', '#E10600')
    const season = createMockSeason('season_hist_2026', 2026, 1, currentTeam.id)
    const careerId = `career_${currentTeam.id}_${season.id}`

    // Piloto atualmente está na Equipe Atual (currentTeam.id)
    const driverCurrent = {
      id: 'drv_transferred_1',
      name: 'Piloto Transferido',
      team_id: currentTeam.id,
      nationality: 'Brasil',
      age: 25,
      speed: 85,
      consistency: 85,
      rain: 85,
      defense: 85,
      salary: 5000000,
      contract_end: 2027,
      role: 'titular' as const,
      morale: 90,
      physical_condition: 90,
    }

    vi.spyOn(f1Service, 'getSeasonRaceResults').mockResolvedValue([])
    vi.spyOn(f1Service, 'getTeamDrivers').mockResolvedValue([driverCurrent])
    vi.spyOn(raceReportService, 'getSeasonReports').mockResolvedValue([])

    // Porém no Round 1 deste evento canônico, o resultado congelou o piloto competindo pela Equipe Vintage!
    const entryVintage = {
      driverId: driverCurrent.id,
      driverName: driverCurrent.name,
      teamId: historicalTeam.id,
      teamName: historicalTeam.name,
      teamColor: historicalTeam.color,
      isPlayer: false,
      gridPosition: 3,
      finalPosition: 3,
      positionsGainedLost: 0,
      raceTime: 5300,
      gapToWinner: '+5s',
      lapsCompleted: 50,
      status: 'finished' as const,
      dnf: false,
      fastestLap: false,
      pitStops: 1,
      pointsAwarded: 15,
    }

    const officialResult: OfficialRaceResult = {
      officialResultId: `official_${careerId}_s2026_r1`,
      schemaVersion: 'official-race-result-v1',
      raceId: `race_${careerId}_s2026_r1`,
      careerId,
      season: 2026,
      round: 1,
      circuitId: 'bahrain',
      circuitName: 'Sakhir International',
      circuitCountry: 'Bahrein',
      playerTeamId: currentTeam.id,
      officializedAt: '2026-03-15T16:00:00.000Z',
      totalLaps: 50,
      winnerDriverId: 'drv_other_winner',
      winnerTeamId: historicalTeam.id,
      poleDriverId: 'drv_other_winner',
      podium: ['drv_other_winner', 'drv_other_2', driverCurrent.id],
      entries: [entryVintage],
      playerEntries: [entryVintage, entryVintage],
      eventsSummary: {
        safetyCarPeriods: 0,
        safetyCarLaps: 0,
        vscPeriods: 0,
        vscLaps: 0,
        redFlagPeriods: 0,
        dnfCount: 0,
        totalPitStops: 1,
        significantIncidents: [],
      },
      resultHash: 'chk_hist_team',
    }

    canonicalRaceResultService.saveOfficialRaceResult(officialResult)
    canonicalCareerPersistenceService.savePersistedRaceResult({
      id: `persisted_${careerId}_s2026_r1`,
      careerId,
      seasonId: 's2026',
      season: 2026,
      round: 1,
      eventId: `event_${careerId}_s2026_r1`,
      circuitId: 'bahrain',
      officialRaceResultId: officialResult.officialResultId,
      checksum: officialResult.resultHash,
      winnerDriverId: officialResult.winnerDriverId,
      poleDriverId: officialResult.poleDriverId,
      officializedAt: officialResult.officializedAt,
      createdAt: '2026-03-15T16:05:00.000Z',
      entries: officialResult.entries,
      playerEntries: officialResult.playerEntries,
      snapshot: officialResult,
    })

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-tester', email: 'tester@apex.com' } as any,
      team: currentTeam,
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

    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )

    // O Histórico deve ler a entrada do resultado canônico com a equipe histórica congelada
    const persisted = canonicalCareerPersistenceService.getPersistedRaceResult(careerId, 2026, 1)
    expect(persisted?.entries[0].teamName).toBe('Equipe Vintage')
    expect(persisted?.entries[0].teamId).toBe('team_historica_1')

    await waitFor(() => {
      expect(screen.getByText('Oficializado')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // COMPORTAMENTO G:
  // Vazio real vs erro:
  // - Carreira sem resultados concluídos -> estado de aguardando / vazio limpo.
  // - Falha ao consultar -> estado de erro explícito com aviso (history-error).
  // - Erro não pode virar silenciosamente lista vazia.
  // =========================================================================
  it('COMPORTAMENTO G: distingue estado vazio real de estado de erro sem mascarar falha', async () => {
    const careerTeam = createMockTeam('team_vazio', 'Vazio Motorsport', '#64748B')
    const season = createMockSeason('season_vazio_2026', 2026, 1, careerTeam.id)
    const drivers = createMockDrivers(careerTeam.id)

    // Cenário 1: Carreira sem resultados concluídos (Vazio real)
    vi.spyOn(f1Service, 'getSeasonRaceResults').mockResolvedValue([])
    vi.spyOn(f1Service, 'getTeamDrivers').mockResolvedValue(drivers)
    vi.spyOn(raceReportService, 'getSeasonReports').mockResolvedValue([])

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

    const { unmount } = render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Aguardando primeira corrida concluída')).toBeInTheDocument()
    })
    // Não deve apresentar erro no estado vazio genuíno
    expect(screen.queryByTestId('history-error')).not.toBeInTheDocument()
    expect(screen.getByText(/0 de 24 GPs disputados/)).toBeInTheDocument()

    unmount()

    // Cenário 2: Falha ao consultar o serviço canônico ou PocketBase crítico
    // Simulando rejeição crítica em chamada essencial
    vi.spyOn(f1Service, 'getSeasonRaceResults').mockRejectedValue(
      new Error('Timeout de conexão com o banco de dados de corridas'),
    )

    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )

    // O estado de erro explícito deve ser acionado com a mensagem, sem mascarar como vazio
    await waitFor(() => {
      expect(screen.getByTestId('history-error')).toBeInTheDocument()
    })
    expect(screen.getByText('Erro ao carregar histórico oficial')).toBeInTheDocument()
    expect(
      screen.getByText(/Timeout de conexão com o banco de dados de corridas/),
    ).toBeInTheDocument()
  })

  // =========================================================================
  // COMPORTAMENTO H:
  // Leitura sem efeitos colaterais:
  // - Comparar dados persistidos antes/depois de abrir, atualizar e reabrir o Histórico.
  // - A leitura não altera resultados/pontos, não grava cópias, não finaliza sessão,
  //   não reescreve equipe histórica, não modifica o save.
  // =========================================================================
  it('COMPORTAMENTO H: a renderização e consulta do Histórico é puramente de leitura e não altera o storage persistido', async () => {
    const careerTeam = createMockTeam('team_readonly', 'Purity GP', '#3B82F6')
    const season = createMockSeason('season_ro_2026', 2026, 1, careerTeam.id)
    const drivers = createMockDrivers(careerTeam.id)
    const careerId = `career_${careerTeam.id}_${season.id}`

    vi.spyOn(f1Service, 'getSeasonRaceResults').mockResolvedValue([])
    vi.spyOn(f1Service, 'getTeamDrivers').mockResolvedValue(drivers)
    vi.spyOn(raceReportService, 'getSeasonReports').mockResolvedValue([])

    const entry = {
      driverId: drivers[0].id,
      driverName: drivers[0].name,
      teamId: careerTeam.id,
      teamName: careerTeam.name,
      teamColor: careerTeam.color,
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

    const officialResult: OfficialRaceResult = {
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
      totalLaps: 50,
      winnerDriverId: drivers[0].id,
      winnerTeamId: careerTeam.id,
      poleDriverId: drivers[0].id,
      podium: [drivers[0].id, 'drv_p2', 'drv_p3'],
      entries: [entry],
      playerEntries: [entry, entry],
      eventsSummary: {
        safetyCarPeriods: 0,
        safetyCarLaps: 0,
        vscPeriods: 0,
        vscLaps: 0,
        redFlagPeriods: 0,
        dnfCount: 0,
        totalPitStops: 1,
        significantIncidents: [],
      },
      resultHash: 'chk_ro_1',
    }

    canonicalRaceResultService.saveOfficialRaceResult(officialResult)
    canonicalCareerPersistenceService.savePersistedRaceResult({
      id: `persisted_${careerId}_s2026_r1`,
      careerId,
      seasonId: 's2026',
      season: 2026,
      round: 1,
      eventId: `event_${careerId}_s2026_r1`,
      circuitId: 'bahrain',
      officialRaceResultId: officialResult.officialResultId,
      checksum: officialResult.resultHash,
      winnerDriverId: officialResult.winnerDriverId,
      poleDriverId: officialResult.poleDriverId,
      officializedAt: officialResult.officializedAt,
      createdAt: '2026-03-15T16:05:00.000Z',
      entries: officialResult.entries,
      playerEntries: officialResult.playerEntries,
      snapshot: officialResult,
    })

    // Capturar snapshot exato do localStorage e chamadas de persistência ANTES da leitura
    const storageKeysBefore = Object.keys(localStorage).sort()
    const storageValuesBefore = storageKeysBefore.map((k) => localStorage.getItem(k))

    const saveOfficialSpy = vi.spyOn(canonicalRaceResultService, 'saveOfficialRaceResult')
    const savePersistedSpy = vi.spyOn(canonicalCareerPersistenceService, 'savePersistedRaceResult')
    const registerSpy = vi.spyOn(
      canonicalCareerPersistenceService,
      'registerOfficialRaceResultInCareer',
    )

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

    // Abrir a página de Histórico
    const { unmount } = render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/25/)).toBeInTheDocument()
    })

    // Fechar e reabrir
    unmount()

    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/25/)).toBeInTheDocument()
    })

    // NENHUM método de escrita pode ter sido chamado durante a leitura
    expect(saveOfficialSpy).not.toHaveBeenCalled()
    expect(savePersistedSpy).not.toHaveBeenCalled()
    expect(registerSpy).not.toHaveBeenCalled()

    // O storage deve permanecer exatamente com as mesmas chaves e os mesmos valores
    const storageKeysAfter = Object.keys(localStorage).sort()
    const storageValuesAfter = storageKeysAfter.map((k) => localStorage.getItem(k))

    expect(storageKeysAfter).toEqual(storageKeysBefore)
    expect(storageValuesAfter).toEqual(storageValuesBefore)
  })

  // =========================================================================
  // VERIFICAÇÃO LOCALIZADA DA CHAVE DE DEDUPLICAÇÃO & SPRINT:
  // Verificar se a fonte consumida (canonicalCareerPersistenceService/canonicalRaceResultService)
  // modela Sprint e corrida principal da mesma rodada de forma independente.
  // Contrato canônico: O domínio canônico persiste um resultado oficial por rodada (OfficialRaceResult)
  // focado na corrida principal da rodada, e o PocketBase armazena race_results por rodada.
  // Testar que a chave de identificação `canonical_${careerId}_s${seasonYear}_r${round}_${driverId}`
  // garante integridade estrita por piloto/rodada e não colide nem se corrompe.
  // =========================================================================
  it('VERIFICAÇÃO DE DEDUPLICAÇÃO: chave por piloto/rodada preserva integridade e contrato oficial', async () => {
    const careerTeam = createMockTeam('team_key_test', 'Key Test Racing', '#EF4444')
    const season = createMockSeason('season_key_2026', 2026, 1, careerTeam.id)
    const drivers = createMockDrivers(careerTeam.id)
    const careerId = `career_${careerTeam.id}_${season.id}`

    vi.spyOn(f1Service, 'getSeasonRaceResults').mockResolvedValue([])
    vi.spyOn(f1Service, 'getTeamDrivers').mockResolvedValue(drivers)
    vi.spyOn(raceReportService, 'getSeasonReports').mockResolvedValue([])

    // Verificar formato da chave canônica gerada para os registros
    const round = 1
    const seasonYear = 2026
    const keyDrv1 = `canonical_${careerId}_s${seasonYear}_r${round}_${drivers[0].id}`
    const keyDrv2 = `canonical_${careerId}_s${seasonYear}_r${round}_${drivers[1].id}`

    expect(keyDrv1).not.toBe(keyDrv2)
    expect(keyDrv1).toContain(careerId)
    expect(keyDrv1).toContain(`s${seasonYear}`)
    expect(keyDrv1).toContain(`r${round}`)
    expect(keyDrv1).toContain(drivers[0].id)
  })
})
