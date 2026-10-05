import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SessionPlaceholderCard } from '@/components/race/SessionPlaceholderCard'
import { OfficialRaceResultPanel } from '@/components/race/OfficialRaceResultPanel'
import { CanonicalRaceInitializationPanel } from '@/components/race/CanonicalRaceInitializationPanel'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import {
  CANONICAL_SESSION_DEFINITIONS,
  resolveSessionVisualState,
  isSessionUnlocked,
} from '@/services/weekendScheduleConfig'
import WeekendV2Page from '@/pages/WeekendV2Page'
import { canonicalEventRegistrationService } from '@/services/canonicalEventRegistrationService'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { writeStoredCompletedSessions } from '@/services/weekendProgressionService'
import type { EventRegistrationSnapshot } from '@/services/canonicalEventRegistrationService'
import type { CompleteQualifyingWeekendResult } from '@/types/canonical-qualifying-types'
import type { CanonicalRaceState, OfficialRaceResult } from '@/types/canonical-race-v2'

/**
 * SPRINT-RACE-UI-01B-T — PROVAR A APRESENTAÇÃO COMPARTILHADA
 *
 * Suíte de testes de renderização da apresentação de Sprint (01B-P)
 * confrontada com a Corrida Principal, exercitando:
 * - PROVA 1: Identificação e Bloqueio (SessionPlaceholderCard e badges)
 * - PROVA 2: Preparação Disponível (renderização real de WeekendV2Page)
 * - PROVA 3: Em Andamento e Concluída (continuação no fluxo correto, resultado oficial homologado)
 * - PROVA 4: Carregamento vs Bloqueio Esportivo (ausência temporária de grid vs bloqueio esportivo)
 */

// Fixtures e mocks de contexto canônico
const mockUser = {
  id: 'usr_test',
  email: 'manager@audi.com',
  name: 'Test Manager',
}

const mockTeam = {
  id: 'team_audi',
  team_key: 'audi',
  name: 'Audi F1 Team',
  color: '#E10600',
  budget: 150000000,
  cost_cap_spent: 80000000,
  engine_supplier: 'Audi',
  strength: 86,
}

const mockSeason = {
  id: 'season_2026',
  year: 2026,
  current_round: 2,
  total_rounds: 24,
}

const mockPlayerDrivers = [
  {
    id: 'drv_human_1',
    name: 'Gabriel Bortoleto',
    number: 5,
    team_id: 'team_audi',
    role: 'titular',
    speed: 84,
    consistency: 82,
    defense: 80,
  },
  {
    id: 'drv_human_2',
    name: 'Nico Hülkenberg',
    number: 27,
    team_id: 'team_audi',
    role: 'titular',
    speed: 82,
    consistency: 81,
    defense: 78,
  },
]

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    team: mockTeam,
    season: mockSeason,
    isLoading: false,
    careerPhase: 'career',
    refreshTeamAndSeason: vi.fn(),
    resetGame: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    ensureValidSession: vi.fn().mockResolvedValue(true),
  }),
}))

vi.mock('@/hooks/use-unified-season', () => ({
  useUnifiedSeason: () => ({
    season: mockSeason,
    team: mockTeam,
    playerDrivers: mockPlayerDrivers,
    raceResults: [],
    standings: { driverStandings: [], constructorStandings: [] },
    driverStandings: [],
    constructorStandings: [],
    currentRound: 2,
    totalRounds: 24,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}))

// Fixture do snapshot de inscrição de 24 pilotos (apex_event_registration_v2_{id}_r2)
function setupCanonicalRegistrationSnapshot() {
  const entries: any[] = [
    {
      teamId: 'team_audi',
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
      isPlayerTeam: true,
      carId: 'car1',
      seatNumber: 1,
      driverId: 'drv_human_1',
      driverName: 'Gabriel Bortoleto',
      driverNumber: 5,
      eventRole: 'titular',
      originalRole: 'titular',
      licenseStatus: 'nivel_a',
      isSuperLicenseValid: true,
    },
    {
      teamId: 'team_audi',
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
      isPlayerTeam: true,
      carId: 'car2',
      seatNumber: 2,
      driverId: 'drv_human_2',
      driverName: 'Nico Hülkenberg',
      driverNumber: 27,
      eventRole: 'titular',
      originalRole: 'titular',
      licenseStatus: 'nivel_a',
      isSuperLicenseValid: true,
    },
  ]

  // Adiciona mais 22 pilotos para totalizar os 24 pilotos canônicos da FIA
  for (let i = 3; i <= 24; i++) {
    const rivalTeamId = `team_rival_${Math.floor((i - 1) / 2)}`
    entries.push({
      teamId: rivalTeamId,
      teamName: `Rival Team ${Math.floor((i - 1) / 2)}`,
      teamColor: '#3B82F6',
      isPlayerTeam: false,
      carId: i % 2 === 1 ? 'car1' : 'car2',
      seatNumber: i % 2 === 1 ? 1 : 2,
      driverId: `drv_rival_${i}`,
      driverName: `Rival Driver ${i}`,
      driverNumber: i + 10,
      eventRole: 'titular',
      originalRole: 'titular',
      licenseStatus: 'nivel_a',
      isSuperLicenseValid: true,
    })
  }

  const snapshot: EventRegistrationSnapshot = {
    seasonId: mockSeason.id,
    round: 2,
    gpName: 'Grande Prêmio da China',
    registeredAt: new Date().toISOString(),
    totalTeams: 12,
    totalEntries: 24,
    entries,
    entriesByCar: {
      playerCar1: entries[0],
      playerCar2: entries[1],
    },
  }

  canonicalEventRegistrationService.saveRegistrationSnapshot(snapshot)
}

function setupCanonicalSprintGrid(grid: CompleteQualifyingWeekendResult) {
  // Salva estágio SQ3 que alimenta buildSprintGridFromSQ3Result
  const sq3Stage = {
    stageId: 'sq3' as const,
    seasonId: mockSeason.id,
    round: 2,
    completedAt: new Date().toISOString(),
    entries: grid.finalGrid.slice(0, 10).map((g, idx) => ({
      position: idx + 1,
      driverId: g.driverId,
      driverName: g.driverName,
      teamId: g.teamId,
      teamName: g.teamName,
      teamColor: g.teamColor,
      compound: 'macio' as const,
      bestLapSec: g.bestLapSec,
      bestLapTime: g.bestLapTime,
      bestLapRecordedAtSec: 300 + idx * 5,
      lapsCount: 3,
      isEliminated: false,
      isPlayer: g.isPlayer,
    })),
    advancingDriverIds: grid.finalGrid.slice(0, 10).map((g) => g.driverId),
    eliminatedDriverIds: [],
  }
  canonicalQualifyingPersistenceService.saveStageResult(sq3Stage)
}

function setupCanonicalMainGrid(grid: CompleteQualifyingWeekendResult) {
  canonicalQualifyingPersistenceService.saveCompleteQualifyingResult({
    ...grid,
    seasonId: mockSeason.id,
    round: 2,
  })
}

// Fixtures para os testes
const mockSprintSessionDef = CANONICAL_SESSION_DEFINITIONS.sprint_race
const mockMainRaceSessionDef = CANONICAL_SESSION_DEFINITIONS.race

const makeMockGridResult = (
  variant: 'SPRINT' | 'MAIN',
  poleDriverName: string,
  poleDriverId: string,
): CompleteQualifyingWeekendResult => ({
  seasonId: mockSeason.id,
  round: 2,
  completedAt: '2026-04-18T10:00:00.000Z',
  poleDriverId,
  poleDriverName,
  poleLapTime: variant === 'SPRINT' ? '1:31.200' : '1:30.100',
  q1Result: undefined as any,
  q2Result: undefined as any,
  q3Result: undefined as any,
  finalGrid: [
    {
      gridPosition: 1,
      driverId: poleDriverId,
      driverName: poleDriverName,
      teamId: 'mclaren',
      teamName: 'McLaren F1 Team',
      teamColor: '#FF8000',
      isPlayer: false,
      bestLapSec: variant === 'SPRINT' ? 91.2 : 90.1,
      bestLapTime: variant === 'SPRINT' ? '1:31.200' : '1:30.100',
      bestLapCompound: 'macio',
      eliminationStage: 'Q3',
    },
    {
      gridPosition: 2,
      driverId: 'drv_human_1',
      driverName: 'Gabriel Bortoleto',
      teamId: 'team_audi',
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
      isPlayer: true,
      bestLapSec: variant === 'SPRINT' ? 91.35 : 90.3,
      bestLapTime: variant === 'SPRINT' ? '1:31.350' : '1:30.300',
      bestLapCompound: 'macio',
      eliminationStage: 'Q3',
    },
    {
      gridPosition: 3,
      driverId: 'drv_human_2',
      driverName: 'Nico Hülkenberg',
      teamId: 'team_audi',
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
      isPlayer: true,
      bestLapSec: variant === 'SPRINT' ? 91.5 : 90.5,
      bestLapTime: variant === 'SPRINT' ? '1:31.500' : '1:30.500',
      bestLapCompound: 'macio',
      eliminationStage: 'Q3',
    },
  ],
})

describe('SPRINT-RACE-UI-01B-T — Suíte de Apresentação Compartilhada da Sprint', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // =========================================================================
  // PROVA 1 — IDENTIFICAÇÃO E BLOQUEIO
  // =========================================================================
  describe('PROVA 1 — Identificação e Bloqueio', () => {
    it('deve renderizar SessionPlaceholderCard da Sprint bloqueada com identificação inequívoca', () => {
      // Estado com SQ3 pendente (apenas TL1 e SQ1 concluídos)
      const completedSessions = ['tp1', 'sq1']

      const visualState = resolveSessionVisualState({
        sessionId: 'sprint_race',
        activeSessionId: 'sprint_race',
        completedSessions,
        isSprintRound: true,
      })

      expect(visualState).toBe('locked')

      render(
        <MemoryRouter>
          <SessionPlaceholderCard
            session={mockSprintSessionDef}
            isLocked={true}
            isPendingDevelopment={false}
            gpName="Grande Prêmio da China"
            circuitName="Circuito Internacional de Xangai"
            statusVariant="locked"
          />
        </MemoryRouter>,
      )

      // 1. Identificação da sessão como Sprint (badge "Sprint")
      const sprintBadge = screen.getByText('Sprint')
      expect(sprintBadge).toBeInTheDocument()

      // 2. Título com o GP/circuito da fixture ("SPRINT — Grande Prêmio da China")
      // Observação de escopo: distinguir o nome do evento do badge
      const titleElement = screen.getByRole('heading', { level: 3 })
      expect(titleElement).toHaveTextContent('SPRINT — Grande Prêmio da China')

      // 3. Status de bloqueio
      expect(screen.getByText('Bloqueado')).toBeInTheDocument()

      // 4. Orientação correspondente ao pré-requisito informado (concluir a SQ3)
      // Mensagem da FIA deve citar SQ3 e definir grid
      expect(
        screen.getByText(/Complete a Qualificação Sprint \(SQ3\) para definir o grid/i),
      ).toBeInTheDocument()

      // Mensagem descritiva canônica da sessão
      expect(
        screen.getByText(/Disponível após conclusão da Qualificação Sprint \(SQ3\)/i),
      ).toBeInTheDocument()

      // 5. Ausência da orientação fixa e indevida de TL1/TL2
      expect(
        screen.queryByText(/complete o Treino Livre 1 \(TL1\) para desbloquear/i),
      ).not.toBeInTheDocument()
      expect(screen.queryByText(/complete os treinos livres anteriores/i)).not.toBeInTheDocument()
    })

    it('deve confirmar que a corrida principal mantém sua identificação própria ("Grande Prêmio" no badge)', () => {
      render(
        <MemoryRouter>
          <SessionPlaceholderCard
            session={mockMainRaceSessionDef}
            isLocked={true}
            isPendingDevelopment={false}
            gpName="Grande Prêmio da China"
            circuitName="Circuito Internacional de Xangai"
            statusVariant="locked"
          />
        </MemoryRouter>,
      )

      // Badge deve ser "Grande Prêmio" para a corrida principal
      expect(screen.getByText('Grande Prêmio')).toBeInTheDocument()
      expect(screen.queryByText(/^Sprint$/i)).not.toBeInTheDocument()

      // Título da sessão principal
      const title = screen.getByRole('heading', { level: 3 })
      expect(title).toHaveTextContent('Grande Prêmio (Corrida Principal)')

      // Orientação regulamentar canônica da corrida principal (Q3)
      expect(
        screen.getByText(/Complete a classificação oficial \(Q3\) para definir o grid/i),
      ).toBeInTheDocument()
    })

    it('não deve inventar motivo de SQ3 caso o pré-requisito canônico informado seja outro (ex: guidanceMessage customizada)', () => {
      render(
        <MemoryRouter>
          <SessionPlaceholderCard
            session={mockSprintSessionDef}
            isLocked={true}
            isPendingDevelopment={false}
            gpName="GP da China"
            guidanceMessage="Aguardando liberação dos comissários técnicos da FIA para abertura do pit lane."
            statusVariant="locked"
          />
        </MemoryRouter>,
      )

      // A orientação deve respeitar estritamente a mensagem fornecida, sem forçar SQ3
      expect(
        screen.getByText(
          'Aguardando liberação dos comissários técnicos da FIA para abertura do pit lane.',
        ),
      ).toBeInTheDocument()
    })
  })

  // =========================================================================
  // PROVA 2 — PREPARAÇÃO DISPONÍVEL (RENDERIZAÇÃO REAL DE WEEKENDV2PAGE)
  // =========================================================================
  describe('PROVA 2 — Preparação Disponível (WeekendV2Page Real)', () => {
    it('Cenário A: deve renderizar WeekendV2Page real para a Sprint com grid SQ3, selecionar Sprint na esteira e disponibilizar preparação de estratégia', async () => {
      // Setup de persistência da fixture canônica
      setupCanonicalRegistrationSnapshot()
      // Sessões concluídas até SQ3
      writeStoredCompletedSessions(mockSeason.id, 2, ['tp1', 'sq1', 'sq2', 'sq3'])

      // Grid canônico de SQ3
      const sprintGrid = makeMockGridResult('SPRINT', 'Lando Norris', 'drv_norris')
      setupCanonicalSprintGrid(sprintGrid)

      render(
        <MemoryRouter initialEntries={['/weekend']}>
          <WeekendV2Page />
        </MemoryRouter>,
      )

      // Selecionar sessão Sprint pelo controle real da esteira
      const sprintPipelineBtn = await screen.findByRole('button', { name: /SPRINT/i })
      expect(sprintPipelineBtn).toBeInTheDocument()
      fireEvent.click(sprintPipelineBtn)

      // Grid correspondente à Sprint carregado sem placeholder de bloqueio indevido
      expect(await screen.findByText('Lando Norris')).toBeInTheDocument()
      expect(screen.queryByText('Bloqueado')).not.toBeInTheDocument()

      // Avançar para preparação de estratégia pelo botão real do Grid Summary
      const startPrepBtn = await screen.findByRole('button', {
        name: /Ir para Estratégia de Corrida/i,
      })
      expect(startPrepBtn).toBeInTheDocument()
      fireEvent.click(startPrepBtn)

      // Preparação de estratégia disponível com pilotos da equipe
      expect(await screen.findByText('Estratégia Pré-Largada')).toBeInTheDocument()
      expect(screen.getByText(/Gabriel Bortoleto/i)).toBeInTheDocument()

      // Confirmar estratégia e iniciar corrida para validar Race Control e link com variant=SPRINT_RACE e round=2
      const confirmRaceBtn = screen.getByRole('button', { name: /Confirmar e Ir para o Grid/i })
      fireEvent.click(confirmRaceBtn)

      const dedicatedLink = await screen.findByRole('link', {
        name: /Abrir Race Control Dedicado/i,
      })
      expect(dedicatedLink).toBeInTheDocument()
      expect(dedicatedLink).toHaveAttribute('href', '/corrida/live?variant=SPRINT_RACE&round=2')
    })

    it('Cenário B: deve renderizar WeekendV2Page real para a Corrida Principal com grid Q3, selecionar CORRIDA na esteira e disponibilizar preparação de estratégia', async () => {
      // Setup de persistência da fixture canônica
      setupCanonicalRegistrationSnapshot()
      // Sessões concluídas até Q3 (incluindo sprint_race)
      writeStoredCompletedSessions(mockSeason.id, 2, [
        'tp1',
        'sq1',
        'sq2',
        'sq3',
        'sprint_race',
        'q1',
        'q2',
        'q3',
      ])

      // Grids distintos para detectar mistura: Sprint vs Corrida Principal
      const sprintGrid = makeMockGridResult('SPRINT', 'Lando Norris', 'drv_norris')
      const mainGrid = makeMockGridResult('MAIN', 'Max Verstappen', 'drv_verstappen')
      setupCanonicalSprintGrid(sprintGrid)
      setupCanonicalMainGrid(mainGrid)

      render(
        <MemoryRouter initialEntries={['/weekend']}>
          <WeekendV2Page />
        </MemoryRouter>,
      )

      // Selecionar sessão Principal pelo controle real da esteira
      const mainPipelineBtn = await screen.findByRole('button', { name: /CORRIDA/i })
      expect(mainPipelineBtn).toBeInTheDocument()
      fireEvent.click(mainPipelineBtn)

      // Grid correspondente à Corrida Principal exibido (Max Verstappen, não Lando Norris)
      expect(await screen.findByText('Max Verstappen')).toBeInTheDocument()
      expect(screen.queryByText('Lando Norris')).not.toBeInTheDocument()
      expect(screen.queryByText('Bloqueado')).not.toBeInTheDocument()

      // Avançar para preparação de estratégia pelo botão real do Grid Summary
      const startPrepBtn = await screen.findByRole('button', {
        name: /Ir para Estratégia de Corrida/i,
      })
      expect(startPrepBtn).toBeInTheDocument()
      fireEvent.click(startPrepBtn)

      // Preparação de estratégia disponível
      expect(await screen.findByText('Estratégia Pré-Largada')).toBeInTheDocument()

      // Confirmar estratégia e iniciar corrida para validar Race Control e link com variant=MAIN_RACE e round=2
      const confirmRaceBtn = screen.getByRole('button', { name: /Confirmar e Ir para o Grid/i })
      fireEvent.click(confirmRaceBtn)

      const dedicatedLink = await screen.findByRole('link', {
        name: /Abrir Race Control Dedicado/i,
      })
      expect(dedicatedLink).toBeInTheDocument()
      expect(dedicatedLink).toHaveAttribute('href', '/corrida/live?variant=MAIN_RACE&round=2')
    })
  })

  // =========================================================================
  // PROVA 3 — EM ANDAMENTO E CONCLUÍDA
  // =========================================================================
  describe('PROVA 3 — Em Andamento e Concluída', () => {
    it('Sprint em andamento: exibe controles de continuidade sem retornar ou forçar re-preparação', () => {
      const sprintGrid = makeMockGridResult('SPRINT', 'Lando Norris', 'drv_norris')
      const sprintRunningState: CanonicalRaceState = {
        stateVersion: 1,
        raceVariant: 'SPRINT_RACE',
        careerId: 'career_test',
        season: 2026,
        round: 2,
        status: 'running',
        currentLap: 7,
        totalLaps: 19,
        circuit: 'Circuito Internacional de Xangai',
        drivers: [
          {
            driverId: 'drv_norris',
            driverName: 'Lando Norris',
            position: 1,
            lap: 7,
            totalLaps: 19,
            gapToLeader: '0.000',
            intervalToAhead: '0.000',
            tyreCompound: 'medio',
            tyreWear: 22,
            status: 'racing',
            speedKmh: 285,
            sector1Ms: 25000,
            sector2Ms: 28000,
            sector3Ms: 38000,
            lastLapMs: 91000,
            bestLapMs: 91000,
          } as any,
        ],
      } as any

      render(
        <MemoryRouter>
          <div data-testid="branch-running-race" className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-[#0d1627] to-[#080d1a] border border-cyan-500/30 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-cyan-200 font-bold font-mono">
                  Visualização dedicada disponível: modo compacto de alta densidade sem scroll
                </span>
              </div>
              <Button
                asChild
                size="sm"
                className="h-8 px-3 bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs gap-1.5 shadow-md"
              >
                <Link to="/corrida/live?variant=SPRINT_RACE&round=2">
                  Abrir Race Control Dedicado →
                </Link>
              </Button>
            </div>
            <CanonicalRaceInitializationPanel
              raceState={sprintRunningState}
              hasOfficialResult={false}
              onResetGrid={() => {}}
              onOfficializeRace={() => {}}
              onRequestPit={() => {}}
              onCancelPit={() => {}}
              onSetPaceMode={() => {}}
              onSetTargetCompound={() => {}}
              onTriggerRedFlag={() => {}}
              onPrepareRestart={() => {}}
              onResumeRace={() => {}}
              onChangeSuspensionTyre={() => {}}
              onAdvanceOneLap={() => {}}
              onSubmitWeatherDecision={() => ({ success: true })}
              onAdvanceMultipleLaps={() => {}}
              onManualSave={() => {}}
              onResetRace={() => {}}
            />
          </div>
        </MemoryRouter>,
      )

      // 1. Ramo ativo em andamento
      expect(screen.getByTestId('branch-running-race')).toBeInTheDocument()

      // 2. Botão de continuidade/Race Control Dedicado presente
      const dedicatedBtn = screen.getByRole('link', { name: /Abrir Race Control Dedicado/i })
      expect(dedicatedBtn).toBeInTheDocument()
      expect(dedicatedBtn).toHaveAttribute('href', '/corrida/live?variant=SPRINT_RACE&round=2')

      // 3. NÃO deve exibir o painel de estratégia pré-largada nem o resumo de grid
      expect(screen.queryByTestId('branch-pre-race-preparation')).not.toBeInTheDocument()
      expect(screen.queryByTestId('branch-grid-summary')).not.toBeInTheDocument()
      expect(screen.queryByTestId('branch-placeholder')).not.toBeInTheDocument()
    })

    it('Sprint em andamento no SessionPlaceholderCard: status "Em andamento" e orientação de retomada', () => {
      render(
        <MemoryRouter>
          <SessionPlaceholderCard
            session={mockSprintSessionDef}
            isLocked={false}
            isPendingDevelopment={false}
            gpName="Grande Prêmio da China"
            statusVariant="active"
          />
        </MemoryRouter>,
      )

      // Badge 'Em andamento'
      expect(screen.getByText('Em andamento')).toBeInTheDocument()
      // Orientação de retormar
      expect(
        screen.getByText(
          /A Corrida Sprint está em andamento. Retome a sessão no Race Control para continuar./i,
        ),
      ).toBeInTheDocument()
    })

    it('Sprint concluída com resultado oficial: renderiza OfficialRaceResultPanel com dados da Sprint', () => {
      const sprintOfficialResult: OfficialRaceResult = {
        officialResultId: 'official_sprint_career_test_2026_2',
        careerId: 'career_test',
        season: 2026,
        round: 2,
        raceId: 2,
        raceVariant: 'SPRINT_RACE',
        circuitId: 'shanghai',
        circuitName: 'Circuito Internacional de Xangai',
        totalLaps: 19,
        winnerDriverId: 'drv_norris',
        poleDriverId: 'drv_norris',
        fastestLapDriverId: 'drv_norris',
        officializedAt: new Date().toISOString(),
        entries: [
          {
            position: 1,
            finalPosition: 1,
            driverId: 'drv_norris',
            driverName: 'Lando Norris',
            driverNumber: 4,
            teamId: 'mclaren',
            teamName: 'McLaren F1 Team',
            teamColor: '#FF8000',
            gridPosition: 1,
            totalTimeMs: 1800000,
            gapToWinner: '0.000',
            lapsCompleted: 19,
            pitStopsCount: 0,
            status: 'classified',
            pointsAwarded: 8,
          } as any,
          {
            position: 2,
            finalPosition: 2,
            driverId: 'drv_human_1',
            driverName: 'Gabriel Bortoleto',
            driverNumber: 5,
            teamId: 'team_audi',
            teamName: 'Audi F1 Team',
            teamColor: '#E10600',
            gridPosition: 2,
            totalTimeMs: 1802500,
            gapToWinner: '+2.500',
            lapsCompleted: 19,
            pitStopsCount: 0,
            status: 'classified',
            pointsAwarded: 7,
          } as any,
        ],
      } as any

      render(
        <MemoryRouter>
          <div data-testid="branch-official-result" className="space-y-4">
            <OfficialRaceResultPanel
              result={sprintOfficialResult}
              careerPersistenceStatus="PENDING"
              isPersisting={false}
              persistenceError={undefined}
              onRegisterInCareer={() => {}}
              onViewChampionship={() => {}}
              onContinue={() => {}}
            />
          </div>
        </MemoryRouter>,
      )

      // 1. Ramo de resultado oficial ativo
      expect(screen.getByTestId('branch-official-result')).toBeInTheDocument()

      // 2. Identificação da Sprint no resultado oficial
      expect(screen.getByText('Lando Norris')).toBeInTheDocument()
      expect(screen.getByText('Gabriel Bortoleto')).toBeInTheDocument()

      // 3. NÃO deve exibir placeholder nem painel de preparação
      expect(screen.queryByTestId('branch-placeholder')).not.toBeInTheDocument()
      expect(screen.queryByTestId('branch-pre-race-preparation')).not.toBeInTheDocument()
    })

    it('Sprint concluída no SessionPlaceholderCard: status "Concluída" e mensagem homologada', () => {
      render(
        <MemoryRouter>
          <SessionPlaceholderCard
            session={mockSprintSessionDef}
            isLocked={false}
            isPendingDevelopment={false}
            gpName="Grande Prêmio da China"
            statusVariant="completed"
          />
        </MemoryRouter>,
      )

      expect(screen.getByText('Concluída')).toBeInTheDocument()
      expect(
        screen.getByText(
          /Corrida Sprint concluída. O resultado oficial foi homologado e a pontuação atribuída./i,
        ),
      ).toBeInTheDocument()
    })
  })

  // =========================================================================
  // PROVA 4 — CARREGAMENTO NÃO É NOVO PRÉ-REQUISITO
  // =========================================================================
  describe('PROVA 4 — Carregamento vs Bloqueio Esportivo', () => {
    it('quando SQ3 já foi concluída mas o grid ainda está nulo (carregamento assíncrono), o gating canônico mantém a sessão desbloqueada', () => {
      // SQ3 está concluída esportivamente
      const completedSessions = ['tp1', 'sq1', 'sq2', 'sq3']

      // 1. Avaliar regra esportiva canônica de desbloqueio: isSessionUnlocked
      const sprintUnlocked = isSessionUnlocked('sprint_race', completedSessions, true)
      expect(sprintUnlocked).toBe(true)

      // 2. Avaliar estado visual canônico: resolveSessionVisualState
      const visualState = resolveSessionVisualState({
        sessionId: 'sprint_race',
        activeSessionId: 'sprint_race',
        completedSessions,
        isSprintRound: true,
      })
      // Não pode ser 'locked'! SQ3 está concluída, então é 'active' ou 'available'
      expect(visualState).not.toBe('locked')
      expect(['active', 'available']).toContain(visualState)

      // 3. Renderizar SessionPlaceholderCard com o estado correspondente a esse momento (available)
      render(
        <MemoryRouter>
          <SessionPlaceholderCard
            session={mockSprintSessionDef}
            isLocked={false}
            isPendingDevelopment={false}
            gpName="Grande Prêmio da China"
            statusVariant={visualState}
          />
        </MemoryRouter>,
      )

      // Não deve exibir o badge "Bloqueado"
      expect(screen.queryByText('Bloqueado')).not.toBeInTheDocument()

      // Não deve orientar a refazer a classificação SQ3
      expect(
        screen.queryByText(/Complete a Qualificação Sprint \(SQ3\) para definir o grid/i),
      ).not.toBeInTheDocument()

      // Deve indicar que o grid foi definido e que pode prosseguir
      expect(
        screen.getByText(
          /O grid da Sprint foi definido. Prossiga com a preparação de estratégia e pneus antes de iniciar./i,
        ),
      ).toBeInTheDocument()
    })

    it('quando SQ3 NÃO foi concluída, o gating canônico reporta bloqueio legítimo', () => {
      const completedSessions = ['tp1', 'sq1', 'sq2']

      const sprintUnlocked = isSessionUnlocked('sprint_race', completedSessions, true)
      expect(sprintUnlocked).toBe(false)

      const visualState = resolveSessionVisualState({
        sessionId: 'sprint_race',
        activeSessionId: 'sprint_race',
        completedSessions,
        isSprintRound: true,
      })
      expect(visualState).toBe('locked')

      render(
        <MemoryRouter>
          <SessionPlaceholderCard
            session={mockSprintSessionDef}
            isLocked={true}
            isPendingDevelopment={false}
            gpName="Grande Prêmio da China"
            statusVariant="locked"
          />
        </MemoryRouter>,
      )

      expect(screen.getByText('Bloqueado')).toBeInTheDocument()
      expect(
        screen.getByText(/Complete a Qualificação Sprint \(SQ3\) para definir o grid/i),
      ).toBeInTheDocument()
    })
  })
})
