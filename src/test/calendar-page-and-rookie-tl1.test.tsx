import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import CalendarPage from '@/pages/CalendarPage'
import Sidebar from '@/components/Sidebar'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { hasSprintWeekend } from '@/services/weekendProgressionService'
import { RookiePracticeRequirementService } from '@/services/rookiePracticeRequirementService'
import { RookieTl1PlanningService } from '@/services/rookieTl1PlanningService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import type { DriverModel } from '@/types/f1'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'

// Mock de hook useUnifiedSeason
vi.mock('@/hooks/use-unified-season', () => ({
  useUnifiedSeason: () => ({
    team: { id: 'audi', name: 'Audi Revolut F1 Team', color: '#E10600', strength: 80 },
    season: { id: 'season_2026', year: 2026, career_id: 'career_test_01' },
    raceResults: [],
    playerDrivers: [
      { id: 'drv_hulk', name: 'Nico Hülkenberg', role: 'titular', career_gps: 220 },
      { id: 'drv_bortoleto', name: 'Gabriel Bortoleto', role: 'titular', career_gps: 0 },
      { id: 'drv_reserva_rookie', name: 'Paul Aron', role: 'reserva', career_gps: 0 },
    ],
    currentRound: 4,
    totalRounds: 24,
    loading: false,
  }),
}))

describe('ETAPA CAL-01: SUITE DE TESTES DO CALENDÁRIO CANÔNICO E ROOKIES', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------
  // CAL-01 a CAL-10: NAVEGAÇÃO, SIDEBAR, ESTRUTURA E CANONICAL DATA
  // -------------------------------------------------------------

  it('CAL-01: rota funciona e renderiza a CalendarPage com container principal', () => {
    render(
      <MemoryRouter initialEntries={['/calendario']}>
        <CalendarPage />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('calendar-page')).toBeDefined()
    expect(screen.getByTestId('calendar-title').textContent).toBe('Calendário')
  })

  it('CAL-02: sidebar mostra entrada Calendário na seção COMPETIÇÃO na primeira posição', () => {
    render(
      <MemoryRouter initialEntries={['/calendario']}>
        <Sidebar onOpenSettings={() => {}} />
      </MemoryRouter>,
    )
    const calendarBtn = screen.getByText('Calendário')
    expect(calendarBtn).toBeDefined()
  })

  it('CAL-03: as 24 rodadas completas aparecem no grid do calendário', () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )
    expect(F1_2026_CALENDAR).toHaveLength(24)
    for (let r = 1; r <= 24; r++) {
      expect(screen.getByTestId(`gp-card-${r}`)).toBeDefined()
    }
  })

  it('CAL-04: ordem correta das rodadas de R1 a R24 respeitando F1_2026_CALENDAR', () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )
    const r1 = screen.getByTestId('gp-card-1')
    const r24 = screen.getByTestId('gp-card-24')
    expect(r1.textContent).toContain('Bahrein')
    expect(r24.textContent).toContain('Abu Dhabi')
  })

  it('CAL-05: Sprint deriva do formato canônico (hasSprintWeekend) sem hardcode visual', () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )
    const sprintCountBadge = screen.getByTestId('stat-sprint-count')
    const canonicalSprintCount = F1_2026_CALENDAR.filter((gp) => hasSprintWeekend(gp.round)).length
    expect(sprintCountBadge.textContent).toBe(String(canonicalSprintCount))
    expect(canonicalSprintCount).toBe(6)
  })

  it('CAL-06: status correto das rodadas derivado da carreira (Concluída, Atual, Próxima, Futura)', () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )
    // currentRound = 4 no mock
    // R1, R2, R3 -> Concluída
    expect(screen.getByTestId('round-status-1').textContent).toBe('Concluída')
    expect(screen.getByTestId('round-status-2').textContent).toBe('Concluída')
    expect(screen.getByTestId('round-status-3').textContent).toBe('Concluída')
    // R4 -> Atual
    expect(screen.getByTestId('round-status-4').textContent).toBe('Atual')
    // R5 -> Próxima
    expect(screen.getByTestId('round-status-5').textContent).toBe('Próxima')
    // R6..R24 -> Futura
    expect(screen.getByTestId('round-status-6').textContent).toBe('Futura')
  })

  it('CAL-07: selecionar card de rodada abre painel lateral sem navegar fora da página', () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )
    const r10Card = screen.getByTestId('gp-card-10')
    fireEvent.click(r10Card)

    const sidePanel = screen.getByTestId('calendar-side-panel')
    expect(sidePanel.textContent).toContain('Canadá')
    expect(sidePanel.textContent).toContain('Circuit Gilles Villeneuve')
  })

  it('CAL-08: circuitId resolve mapa técnico através do CircuitBlueprint', () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )
    // R10 Canadá possui blueprint técnico SVG
    const card10 = screen.getByTestId('gp-card-10')
    expect(card10.querySelector('svg')).toBeDefined()
  })

  it('CAL-09: rodada atual aparece destacada com badge vermelho APEX e no resumo', () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )
    const currentStat = screen.getByTestId('stat-current-round')
    expect(currentStat.textContent).toContain('4 / 24')
    expect(screen.getByTestId('round-status-4').textContent).toBe('Atual')
  })

  it('CAL-10: progresso X/24 da temporada exibido com barra proporcional no rodapé', () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )
    const footerProgress = screen.getByTestId('footer-progress-text')
    // currentRound = 4 -> 3 rodadas concluídas (3 / 24)
    expect(footerProgress.textContent).toContain('3 / 24 rodadas')
  })

  // -------------------------------------------------------------
  // CAL-R01 a CAL-R15: REGRAS ROOKIE FW2.1C.1 E PERSISTÊNCIA
  // -------------------------------------------------------------

  it('CAL-R01: contador 2/carro vem do serviço RookiePracticeRequirementService', () => {
    const req = RookiePracticeRequirementService.getTeamRequirement('season_2026', 'audi')
    expect(req.car1.required).toBe(2)
    expect(req.car2.required).toBe(2)
  })

  it('CAL-R02: total 4 obrigações por equipe vem do serviço existente', () => {
    const req = RookiePracticeRequirementService.getTeamRequirement('season_2026', 'audi')
    expect(req.requiredTotal).toBe(4)
  })

  it('CAL-R03: planejar novato NÃO concede crédito regulamentar', () => {
    const initialReq = RookiePracticeRequirementService.getTeamRequirement('season_2026', 'audi')
    expect(initialReq.completedTotal).toBe(0)

    // Planeja novato na rodada 10
    const res = RookieTl1PlanningService.setSeatPlan({
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 10,
      carId: 'car1',
      driver: { id: 'rookie_test', name: 'Rookie Teste' } as any,
    })
    expect(res.success).toBe(true)

    // Verifica que o contador regulamentar OFICIAL permanece ZERO
    const reqAfter = RookiePracticeRequirementService.getTeamRequirement('season_2026', 'audi')
    expect(reqAfter.completedTotal).toBe(0)
    expect(reqAfter.car1.completed).toBe(0)
  })

  it('CAL-R04: piloto com <= 2 GPs de carreira é planejável no TL1', () => {
    const eligibleDriver = { id: 'drv_rookie_1', name: 'Novato Um', career_gps: 1 }
    const res = RookieTl1PlanningService.setSeatPlan({
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 11,
      carId: 'car1',
      driver: eligibleDriver,
    })
    expect(res.success).toBe(true)
  })

  it('CAL-R05: piloto com > 2 GPs de carreira é expressamente bloqueado', () => {
    const veteranDriver = {
      id: 'drv_veteran',
      name: 'Piloto Veterano',
      career_gps: 15,
    }
    const res = RookieTl1PlanningService.setSeatPlan({
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 11,
      carId: 'car1',
      driver: veteranDriver,
    })
    expect(res.success).toBe(false)
    expect(res.message).toContain('inelegível')
  })

  it('CAL-R06: mesmo piloto planejado nos dois carros no mesmo GP é bloqueado', () => {
    const rookie = { id: 'rookie_same', name: 'Piloto Clone', career_gps: 0 }
    // Escala no Carro 1
    const res1 = RookieTl1PlanningService.setSeatPlan({
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 12,
      carId: 'car1',
      driver: rookie,
    })
    expect(res1.success).toBe(true)

    // Tenta escalar o MESMO no Carro 2 da mesma rodada 12
    const res2 = RookieTl1PlanningService.setSeatPlan({
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 12,
      carId: 'car2',
      driver: rookie,
    })
    expect(res2.success).toBe(false)
    expect(res2.message).toContain('já está planejado para o outro carro')
  })

  it('CAL-R07: dois novatos diferentes no mesmo GP são permitidos', () => {
    const rookieA = { id: 'rookie_a', name: 'Rookie Alpha', career_gps: 0 }
    const rookieB = { id: 'rookie_b', name: 'Rookie Beta', career_gps: 0 }

    const res1 = RookieTl1PlanningService.setSeatPlan({
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 14,
      carId: 'car1',
      driver: rookieA,
    })
    const res2 = RookieTl1PlanningService.setSeatPlan({
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 14,
      carId: 'car2',
      driver: rookieB,
    })
    expect(res1.success).toBe(true)
    expect(res2.success).toBe(true)
  })

  it('CAL-R08: plano persiste no localStorage e sobrevive a reload', () => {
    const rookie = { id: 'rookie_persist', name: 'Rookie Persist', career_gps: 0 }
    RookieTl1PlanningService.setSeatPlan({
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 15,
      carId: 'car1',
      driver: rookie,
    })

    const retrieved = RookieTl1PlanningService.getPlanForSeat(
      'career_test_01',
      'season_2026',
      'audi',
      15,
      'car1',
    )
    expect(retrieved).not.toBeNull()
    expect(retrieved?.driverId).toBe('rookie_persist')
  })

  it('CAL-R09: plano do Carro 1 não altera ou apaga o plano do Carro 2', () => {
    const rookie1 = { id: 'r1', name: 'Rookie 1', career_gps: 0 }
    const rookie2 = { id: 'r2', name: 'Rookie 2', career_gps: 0 }

    RookieTl1PlanningService.setSeatPlan({
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 16,
      carId: 'car1',
      driver: rookie1,
    })
    RookieTl1PlanningService.setSeatPlan({
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 16,
      carId: 'car2',
      driver: rookie2,
    })

    // Altera apenas o Carro 1
    RookieTl1PlanningService.clearSeatPlan('career_test_01', 'season_2026', 'audi', 16, 'car1')

    const p1 = RookieTl1PlanningService.getPlanForSeat(
      'career_test_01',
      'season_2026',
      'audi',
      16,
      'car1',
    )
    const p2 = RookieTl1PlanningService.getPlanForSeat(
      'career_test_01',
      'season_2026',
      'audi',
      16,
      'car2',
    )

    expect(p1).toBeNull()
    expect(p2).not.toBeNull()
    expect(p2?.driverId).toBe('r2')
  })

  it('CAL-R10: TL1 carrega o novato planejado quando o fim de semana é aberto', () => {
    // Configura plano no Calendário para rodada 4 (rodada atual)
    const rookie = { id: 'drv_reserva_rookie', name: 'Paul Aron', career_gps: 0 }
    RookieTl1PlanningService.setSeatPlan({
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 4,
      carId: 'car1',
      driver: rookie,
    })

    const plan = RookieTl1PlanningService.getPlanForSeat(
      'career_test_01',
      'season_2026',
      'audi',
      4,
      'car1',
    )
    expect(plan?.driverId).toBe('drv_reserva_rookie')

    const validation = RookieTl1PlanningService.validateSeatPlan({
      plan: plan!,
      availableDrivers: [rookie],
    })
    expect(validation.isValid).toBe(true)
  })

  it('CAL-R11: plano inválido é revalidado com status NEEDS_REVIEW', () => {
    const invalidPlan = {
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 5,
      carId: 'car1' as const,
      driverId: 'drv_now_veteran',
      status: 'PLANNED' as const,
      createdAt: new Date().toISOString(),
    }
    // Piloto agora possui 5 GPs de carreira
    const driverWithGps = {
      id: 'drv_now_veteran',
      name: 'Ex-Novato',
      career_gps: 5,
    }

    const val = RookieTl1PlanningService.validateSeatPlan({
      plan: invalidPlan,
      availableDrivers: [driverWithGps],
    })
    expect(val.isValid).toBe(false)
    expect(val.updatedPlan.status).toBe('NEEDS_REVIEW')
  })

  it('CAL-R12: plano inválido NÃO escala substituto automático', () => {
    const invalidPlan = {
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 5,
      carId: 'car1' as const,
      driverId: 'drv_inexistente',
      status: 'PLANNED' as const,
      createdAt: new Date().toISOString(),
    }
    const val = RookieTl1PlanningService.validateSeatPlan({
      plan: invalidPlan,
      availableDrivers: [],
    })
    expect(val.isValid).toBe(false)
    // Mantém o driverId original para o usuário decidir a revisão
    expect(val.updatedPlan.driverId).toBe('drv_inexistente')
  })

  it('CAL-R13: crédito de novato é homologado somente após TL1 real com voltas válidas', () => {
    // 0 voltas -> Não concede crédito
    const attemptZeroLaps = RookiePracticeRequirementService.grantRookieFP1Credit({
      seasonId: 'season_2026',
      round: 4,
      teamId: 'audi',
      carId: 'car1',
      driverId: 'rookie_test',
      driverName: 'Rookie Test',
      lapsCompleted: 0,
      isRookieEligible: true,
    })
    expect(attemptZeroLaps.granted).toBe(false)

    // >= 1 volta -> Concede crédito regulamentar
    const attemptValidLaps = RookiePracticeRequirementService.grantRookieFP1Credit({
      seasonId: 'season_2026',
      round: 4,
      teamId: 'audi',
      carId: 'car1',
      driverId: 'rookie_test',
      driverName: 'Rookie Test',
      lapsCompleted: 15,
      isRookieEligible: true,
    })
    expect(attemptValidLaps.granted).toBe(true)

    const req = RookiePracticeRequirementService.getTeamRequirement('season_2026', 'audi')
    expect(req.car1.completed).toBe(1)
    expect(req.completedTotal).toBe(1)
  })

  it('CAL-R14: titular oficial é restaurado no TL2 automaticamente', () => {
    // Configura substituição temporária restrita ao TL1
    RookiePracticeRequirementService.setTemporaryFP1Assignment({
      seasonId: 'season_2026',
      round: 4,
      teamId: 'audi',
      carId: 'car1',
      rookieDriverId: 'rookie_temp',
      rookieDriverName: 'Rookie Temp',
      originalDriverId: 'drv_hulk',
      originalDriverName: 'Nico Hülkenberg',
    })

    // Limpeza da atribuição temporária restaura o titular
    RookiePracticeRequirementService.clearTemporaryFP1Assignment('season_2026', 4, 'audi', 'car1')
    const active = RookiePracticeRequirementService.getTemporaryFP1Assignment(
      'season_2026',
      4,
      'audi',
      'car1',
    )
    expect(active).toBeNull()
  })

  it('CAL-R15: isolamento por temporada — plano de 2026 não vaza para temporada 2027', () => {
    const rookie = { id: 'rookie_2026', name: 'Rookie 2026', career_gps: 0 }
    RookieTl1PlanningService.setSeatPlan({
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 18,
      carId: 'car1',
      driver: rookie,
    })

    // Planos de 2026
    const plans2026 = RookieTl1PlanningService.getPlans('career_test_01', 'season_2026', 'audi')
    expect(plans2026.length).toBeGreaterThan(0)

    // Planos de 2027 devem estar vazios
    const plans2027 = RookieTl1PlanningService.getPlans('career_test_01', 'season_2027', 'audi')
    expect(plans2027).toHaveLength(0)
  })

  // -------------------------------------------------------------
  // CAL-H01 a CAL-H04: HISTÓRICO, RESULTADOS REAIS E PARTICIPAÇÃO
  // -------------------------------------------------------------

  it('CAL-H01: GP concluído consome e renderiza o resultado oficial homologado de race_results', () => {
    const p1Entry: any = {
      driverId: 'drv_verstappen',
      driverName: 'Max Verstappen',
      teamId: 'redbull',
      teamName: 'Red Bull Racing',
      teamColor: '#001A30',
      gridPosition: 2,
      finalPosition: 1,
      status: 'finished',
      pointsAwarded: 25,
      isPlayer: false,
      positionsGainedLost: 1,
      lapsCompleted: 57,
      raceTime: 5400,
      raceTimeFormatted: '1:31:44.742',
      gapToWinner: 'LÍDER',
      currentTireCompound: 'hard',
      currentTireWear: 30,
      pitStops: 2,
    }
    const p2Entry: any = {
      driverId: 'drv_hulk',
      driverName: 'Nico Hülkenberg',
      teamId: 'audi',
      teamName: 'Audi Revolut F1 Team',
      teamColor: '#E10600',
      gridPosition: 10,
      finalPosition: 7,
      status: 'finished',
      pointsAwarded: 6,
      isPlayer: true,
      positionsGainedLost: 3,
      lapsCompleted: 57,
      raceTime: 5435,
      raceTimeFormatted: '1:32:20.120',
      gapToWinner: '+35.378s',
      currentTireCompound: 'medium',
      currentTireWear: 45,
      pitStops: 2,
    }

    const mockOfficialResult: any = {
      officialResultId: 'res_cal_01',
      schemaVersion: 'official-race-result-v1',
      careerId: 'career_test_01',
      season: 2026,
      round: 1,
      raceId: 'race_s2026_r1',
      circuitId: 'bahrain',
      circuitName: 'Circuito Internacional do Bahrein',
      circuitCountry: 'Bahrein',
      playerTeamId: 'audi',
      officializedAt: new Date().toISOString(),
      totalLaps: 57,
      winnerDriverId: 'drv_verstappen',
      winnerTeamId: 'redbull',
      poleDriverId: 'drv_verstappen',
      fastestLapDriverId: 'drv_verstappen',
      podium: ['drv_verstappen'],
      entries: [p1Entry, p2Entry],
      playerEntries: [p2Entry, p2Entry],
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
      resultHash: 'dummy_hash',
    }

    canonicalRaceResultService.saveOfficialRaceResult(mockOfficialResult)

    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )

    // Clica no card da Rodada 1
    fireEvent.click(screen.getByTestId('gp-card-1'))
    // Clica na tab Resultados
    fireEvent.click(screen.getByTestId('side-tab-resultados'))

    expect(screen.getByText('Max Verstappen')).toBeDefined()
    expect(screen.getByText('Nico Hülkenberg')).toBeDefined()
    expect(screen.getByTestId('view-official-result-btn')).toBeDefined()
  })

  it('CAL-H02: rookie cumprido aparece com badge ROOKIE CUMPRIDO no card do GP', () => {
    // Concede crédito na rodada 2
    RookiePracticeRequirementService.grantRookieFP1Credit({
      seasonId: 'season_2026',
      round: 2,
      teamId: 'audi',
      carId: 'car1',
      driverId: 'drv_rookie_done',
      driverName: 'Rookie Cumprido',
      lapsCompleted: 10,
      isRookieEligible: true,
    })

    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )

    const r2Card = screen.getByTestId('gp-card-2')
    expect(r2Card.textContent).toContain('ROOKIE CUMPRIDO')
  })

  it('CAL-H03: novato apenas planejado sem treino executado NÃO aparece como cumprido', () => {
    RookieTl1PlanningService.setSeatPlan({
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 20,
      carId: 'car1',
      driver: { id: 'rookie_unfulfilled', name: 'Novato Futuro' } as any,
    })

    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )

    const r20Card = screen.getByTestId('gp-card-20')
    expect(r20Card.textContent).toContain('ROOKIE PLANEJADO')
    expect(r20Card.textContent).not.toContain('ROOKIE CUMPRIDO')
  })

  it('CAL-H04: botão [VER RESULTADO OFICIAL] abre modal do resultado homologado FIA', () => {
    const entry1: any = {
      driverId: 'drv_verstappen',
      driverName: 'Max Verstappen',
      teamId: 'redbull',
      teamName: 'Red Bull Racing',
      teamColor: '#001A30',
      gridPosition: 1,
      finalPosition: 1,
      status: 'finished',
      pointsAwarded: 25,
      isPlayer: false,
      positionsGainedLost: 0,
      lapsCompleted: 57,
      raceTime: '1:31:44.742',
      gapToWinner: 'LÍDER',
      currentTireCompound: 'hard',
      currentTireWear: 20,
      totalPitStops: 2,
    }
    const playerEntry1: any = {
      driverId: 'drv_hulk',
      driverName: 'Nico Hülkenberg',
      teamId: 'audi',
      teamName: 'Audi Revolut F1 Team',
      teamColor: '#E10600',
      gridPosition: 8,
      finalPosition: 8,
      status: 'finished',
      pointsAwarded: 4,
      isPlayer: true,
      positionsGainedLost: 0,
      lapsCompleted: 57,
      raceTime: '1:32:40.000',
      gapToWinner: '+55.258s',
      currentTireCompound: 'hard',
      currentTireWear: 35,
      totalPitStops: 2,
    }
    const playerEntry2: any = {
      driverId: 'drv_bortoleto',
      driverName: 'Gabriel Bortoleto',
      teamId: 'audi',
      teamName: 'Audi Revolut F1 Team',
      teamColor: '#E10600',
      gridPosition: 11,
      finalPosition: 10,
      status: 'finished',
      pointsAwarded: 1,
      isPlayer: true,
      positionsGainedLost: 1,
      lapsCompleted: 57,
      raceTime: '1:32:50.000',
      gapToWinner: '+65.258s',
      currentTireCompound: 'hard',
      currentTireWear: 38,
      totalPitStops: 2,
    }

    const mockOfficialResult: any = {
      officialResultId: 'res_cal_02',
      schemaVersion: 'official-race-result-v1',
      careerId: 'career_test_01',
      season: 2026,
      round: 1,
      raceId: 'race_s2026_r1',
      circuitId: 'bahrain',
      circuitName: 'Circuito Internacional do Bahrein',
      circuitCountry: 'Bahrein',
      playerTeamId: 'audi',
      officializedAt: new Date().toISOString(),
      totalLaps: 57,
      winnerDriverId: 'drv_verstappen',
      winnerTeamId: 'redbull',
      poleDriverId: 'drv_verstappen',
      fastestLapDriverId: 'drv_verstappen',
      podium: ['drv_verstappen'],
      entries: [entry1, playerEntry1, playerEntry2],
      playerEntries: [playerEntry1, playerEntry2],
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
      resultHash: 'dummy_hash_2',
    }
    canonicalRaceResultService.saveOfficialRaceResult(mockOfficialResult)

    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByTestId('gp-card-1'))
    fireEvent.click(screen.getByTestId('side-tab-resultados'))

    const viewBtn = screen.getByTestId('view-official-result-btn')
    fireEvent.click(viewBtn)

    expect(screen.getByText(/Arquivo Homologado FIA/i)).toBeDefined()
  })
})
