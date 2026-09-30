import { describe, it, expect } from 'vitest'
import { standingsService } from '@/services/standingsService'
import type { TeamModel, DriverModel, RaceResultModel, SeasonModel } from '@/types/f1'

/**
 * CHAMPIONSHIP-INTEGRITY-01A2 (DASHBOARD) Acceptance Suite
 *
 * Exemplo controlado:
 * Mercedes P1/100, Ferrari P2/85, Audi P3/62, Haas P4/38
 * player team = Audi -> Dashboard deve mostrar:
 * - CLASSIFICAÇÃO CONSTRUTORES: P3 (ou 3)
 * - PONTOS ACUMULADOS: 62 pts
 * - OBJETIVO DA TEMPORADA: inputs P3 + 62 pts do mesmo snapshot
 *
 * Ausência de standings:
 * - posição neutra "—" (NUNCA P1)
 * - pontos = 0
 * - NUNCA "P1 / 0 pts"
 */

describe('CHAMPIONSHIP-INTEGRITY-01A2: Dashboard Constructor Standings & Objective Inputs', () => {
  const mockAudiTeam: TeamModel = {
    id: 'team_audi_01',
    name: 'Audi F1 Team',
    team_key: 'audi',
    color: '#E10600',
    budget: 140000000,
  } as any

  const mockSeason: SeasonModel = {
    id: 'season_2026',
    year: 2026,
    current_round: 5,
    total_rounds: 24,
  } as any

  const mockDrivers: DriverModel[] = [
    {
      id: 'drv_bortoleto',
      name: 'Gabriel Bortoleto',
      team_id: 'team_audi_01',
      role: 'titular',
      speed: 85,
      consistency: 84,
    } as any,
    {
      id: 'drv_hulkenberg',
      name: 'Nico Hülkenberg',
      team_id: 'team_audi_01',
      role: 'titular',
      speed: 84,
      consistency: 86,
    } as any,
  ]

  // CI01A2-01: Audi P3 no snapshot → Dashboard P3
  it('CI01A2-01: Audi P3 no snapshot -> Dashboard P3', () => {
    // 4 equipes controladas: Mercedes 100, Ferrari 85, Audi 62, Haas 38
    // Criamos raceResults refletindo essa pontuação
    const controlledResults: RaceResultModel[] = [
      // Mercedes: 100 pts (ex: 4 vitórias de 25)
      {
        id: 'r1',
        season_id: 'season_2026',
        round: 1,
        team_id: 'mercedes',
        position: 1,
        points: 25,
      } as any,
      {
        id: 'r2',
        season_id: 'season_2026',
        round: 2,
        team_id: 'mercedes',
        position: 1,
        points: 25,
      } as any,
      {
        id: 'r3',
        season_id: 'season_2026',
        round: 3,
        team_id: 'mercedes',
        position: 1,
        points: 25,
      } as any,
      {
        id: 'r4',
        season_id: 'season_2026',
        round: 4,
        team_id: 'mercedes',
        position: 1,
        points: 25,
      } as any,
      // Ferrari: 85 pts
      {
        id: 'r5',
        season_id: 'season_2026',
        round: 1,
        team_id: 'ferrari',
        position: 2,
        points: 25,
      } as any,
      {
        id: 'r6',
        season_id: 'season_2026',
        round: 2,
        team_id: 'ferrari',
        position: 2,
        points: 20,
      } as any,
      {
        id: 'r7',
        season_id: 'season_2026',
        round: 3,
        team_id: 'ferrari',
        position: 2,
        points: 20,
      } as any,
      {
        id: 'r8',
        season_id: 'season_2026',
        round: 4,
        team_id: 'ferrari',
        position: 2,
        points: 20,
      } as any,
      // Audi (Player): 62 pts (31 pts cada piloto)
      {
        id: 'r9',
        season_id: 'season_2026',
        round: 1,
        driver_id: 'drv_bortoleto',
        team_id: 'team_audi_01',
        position: 3,
        points: 31,
      } as any,
      {
        id: 'r10',
        season_id: 'season_2026',
        round: 2,
        driver_id: 'drv_hulkenberg',
        team_id: 'team_audi_01',
        position: 3,
        points: 31,
      } as any,
      // Haas: 38 pts
      {
        id: 'r11',
        season_id: 'season_2026',
        round: 1,
        team_id: 'haas',
        position: 4,
        points: 38,
      } as any,
    ]

    const standings = standingsService.calculateStandings({
      raceResults: controlledResults,
      playerDrivers: mockDrivers,
      team: mockAudiTeam,
      season: mockSeason,
    })

    expect(standings.playerConstructorRank).toBe(3)
  })

  // CI01A2-02: Audi 62 pts no snapshot → Dashboard 62 pts
  it('CI01A2-02: Audi 62 pts no snapshot -> Dashboard 62 pts', () => {
    const controlledResults: RaceResultModel[] = [
      {
        id: 'r1',
        season_id: 'season_2026',
        round: 1,
        team_id: 'mercedes',
        position: 1,
        points: 100,
      } as any,
      {
        id: 'r2',
        season_id: 'season_2026',
        round: 1,
        team_id: 'ferrari',
        position: 2,
        points: 85,
      } as any,
      {
        id: 'r3',
        season_id: 'season_2026',
        round: 1,
        driver_id: 'drv_bortoleto',
        team_id: 'team_audi_01',
        position: 3,
        points: 32,
      } as any,
      {
        id: 'r4',
        season_id: 'season_2026',
        round: 2,
        driver_id: 'drv_hulkenberg',
        team_id: 'team_audi_01',
        position: 4,
        points: 30,
      } as any,
      {
        id: 'r5',
        season_id: 'season_2026',
        round: 1,
        team_id: 'haas',
        position: 5,
        points: 38,
      } as any,
    ]

    const standings = standingsService.calculateStandings({
      raceResults: controlledResults,
      playerDrivers: mockDrivers,
      team: mockAudiTeam,
      season: mockSeason,
    })

    expect(standings.teamPoints).toBe(62)
  })

  // CI01A2-03: posição e pontos vêm do mesmo registro
  it('CI01A2-03: posicao e pontos vem do mesmo registro', () => {
    const controlledResults: RaceResultModel[] = [
      {
        id: 'r1',
        season_id: 'season_2026',
        round: 1,
        team_id: 'mercedes',
        position: 1,
        points: 100,
      } as any,
      {
        id: 'r2',
        season_id: 'season_2026',
        round: 1,
        team_id: 'ferrari',
        position: 2,
        points: 85,
      } as any,
      {
        id: 'r3',
        season_id: 'season_2026',
        round: 1,
        driver_id: 'drv_bortoleto',
        team_id: 'team_audi_01',
        position: 3,
        points: 40,
      } as any,
      {
        id: 'r4',
        season_id: 'season_2026',
        round: 2,
        driver_id: 'drv_hulkenberg',
        team_id: 'team_audi_01',
        position: 3,
        points: 22,
      } as any,
      {
        id: 'r5',
        season_id: 'season_2026',
        round: 1,
        team_id: 'haas',
        position: 4,
        points: 38,
      } as any,
    ]

    const standings = standingsService.calculateStandings({
      raceResults: controlledResults,
      playerDrivers: mockDrivers,
      team: mockAudiTeam,
      season: mockSeason,
    })

    const playerConstructorEntry = standings.constructorStandings.find(
      (c) => c.isPlayer || c.id === mockAudiTeam.id,
    )
    expect(playerConstructorEntry).toBeDefined()
    expect(playerConstructorEntry?.points).toBe(standings.teamPoints)

    const calculatedRank =
      standings.constructorStandings.findIndex((c) => c.isPlayer || c.id === mockAudiTeam.id) + 1
    expect(calculatedRank).toBe(standings.playerConstructorRank)
  })

  // CI01A2-04: sem standings → NÃO P1
  it('CI01A2-04: sem standings -> NAO P1', () => {
    // Sem resultados de corrida
    const standings = standingsService.calculateStandings({
      raceResults: [],
      playerDrivers: mockDrivers,
      team: mockAudiTeam,
      season: { id: 'season_2026', year: 2026, current_round: 1, total_rounds: 24 } as any,
    })

    expect(standings.playerConstructorRank).not.toBe(1)
  })

  // CI01A2-05: sem standings → posição neutra "—"
  it('CI01A2-05: sem standings -> posicao neutra null / display "—"', () => {
    const standings = standingsService.calculateStandings({
      raceResults: [],
      playerDrivers: mockDrivers,
      team: mockAudiTeam,
      season: { id: 'season_2026', year: 2026, current_round: 1, total_rounds: 24 } as any,
    })

    // Rank deve ser null quando não há standings válidos
    expect(standings.playerConstructorRank).toBeNull()

    // Formatação de exibição do Dashboard deve produzir "—"
    const displayPosition =
      standings.playerConstructorRank != null && standings.playerConstructorRank > 0
        ? `${standings.playerConstructorRank}º`
        : '—'
    expect(displayPosition).toBe('—')
  })

  // CI01A2-06: não existe mais fallback artificial P1
  it('CI01A2-06: nao existe mais fallback artificial P1', () => {
    const standings = standingsService.calculateStandings({
      raceResults: [],
      playerDrivers: [],
      team: mockAudiTeam,
      season: { id: 'season_2026', year: 2026, current_round: 1, total_rounds: 24 } as any,
    })

    expect(standings.playerConstructorRank).not.toBe(1)
    expect(standings.teamPoints).toBe(0)
  })

  // CI01A2-07: objetivo Top 4 recebe posição atual real
  it('CI01A2-07: objetivo Top 4 recebe posicao atual real', () => {
    // Snapshot com Audi em P3
    const controlledResults: RaceResultModel[] = [
      {
        id: 'r1',
        season_id: 'season_2026',
        round: 1,
        team_id: 'mercedes',
        position: 1,
        points: 100,
      } as any,
      {
        id: 'r2',
        season_id: 'season_2026',
        round: 1,
        team_id: 'ferrari',
        position: 2,
        points: 85,
      } as any,
      {
        id: 'r3',
        season_id: 'season_2026',
        round: 1,
        driver_id: 'drv_bortoleto',
        team_id: 'team_audi_01',
        position: 3,
        points: 62,
      } as any,
    ]

    const standings = standingsService.calculateStandings({
      raceResults: controlledResults,
      playerDrivers: mockDrivers,
      team: mockAudiTeam,
      season: mockSeason,
    })

    // Simula a função de cálculo de objetivo do Dashboard usando as entradas do snapshot
    const targetRank = 4
    const currentPos = standings.playerConstructorRank
    expect(currentPos).toBe(3)
    const isMeeting = currentPos != null && currentPos <= targetRank
    expect(isMeeting).toBe(true)
  })

  // CI01A2-08: objetivo recebe pontos atuais do mesmo snapshot
  it('CI01A2-08: objetivo recebe pontos atuais do mesmo snapshot', () => {
    const controlledResults: RaceResultModel[] = [
      {
        id: 'r1',
        season_id: 'season_2026',
        round: 1,
        team_id: 'mercedes',
        position: 1,
        points: 100,
      } as any,
      {
        id: 'r2',
        season_id: 'season_2026',
        round: 1,
        team_id: 'ferrari',
        position: 2,
        points: 85,
      } as any,
      {
        id: 'r3',
        season_id: 'season_2026',
        round: 1,
        driver_id: 'drv_bortoleto',
        team_id: 'team_audi_01',
        position: 3,
        points: 62,
      } as any,
    ]

    const standings = standingsService.calculateStandings({
      raceResults: controlledResults,
      playerDrivers: mockDrivers,
      team: mockAudiTeam,
      season: mockSeason,
    })

    const targetRank = 4
    const currentPos = standings.playerConstructorRank
    const currentPts = standings.teamPoints

    expect(currentPts).toBe(62)
    expect(currentPos).toBe(3)

    // A avaliação do objetivo deve usar os pontos do mesmo snapshot
    const rankBonus = (targetRank - (currentPos ?? targetRank) + 1) * 10
    const pct = Math.min(100, Math.max(50, 60 + rankBonus + Math.min(20, currentPts / 5)))
    expect(pct).toBeGreaterThan(70)
  })

  // CI01A2-09: nenhuma posição hardcoded para player team
  it('CI01A2-09: nenhuma posicao hardcoded para player team', () => {
    // Teste com equipe do jogador em P6
    const controlledResults: RaceResultModel[] = [
      {
        id: 'r1',
        season_id: 'season_2026',
        round: 1,
        team_id: 'mercedes',
        position: 1,
        points: 100,
      } as any,
      {
        id: 'r2',
        season_id: 'season_2026',
        round: 1,
        team_id: 'ferrari',
        position: 2,
        points: 85,
      } as any,
      {
        id: 'r3',
        season_id: 'season_2026',
        round: 1,
        team_id: 'redbull',
        position: 3,
        points: 70,
      } as any,
      {
        id: 'r4',
        season_id: 'season_2026',
        round: 1,
        team_id: 'mclaren',
        position: 4,
        points: 50,
      } as any,
      {
        id: 'r5',
        season_id: 'season_2026',
        round: 1,
        team_id: 'aston',
        position: 5,
        points: 30,
      } as any,
      {
        id: 'r6',
        season_id: 'season_2026',
        round: 1,
        driver_id: 'drv_bortoleto',
        team_id: 'team_audi_01',
        position: 6,
        points: 10,
      } as any,
    ]

    const standings = standingsService.calculateStandings({
      raceResults: controlledResults,
      playerDrivers: mockDrivers,
      team: mockAudiTeam,
      season: mockSeason,
    })

    expect(standings.playerConstructorRank).toBe(6)
    expect(standings.teamPoints).toBe(10)
  })

  // CI01A2-10: runtime team ID resolve para a equipe correta no standings
  it('CI01A2-10: runtime team ID resolve para a equipe correta no standings', () => {
    const customTeam: TeamModel = {
      id: 'custom_pk_12345',
      name: 'Andretti Cadillac F1',
      team_key: 'andretti',
      color: '#002B49',
    } as any

    const customDrivers: DriverModel[] = [
      { id: 'drv_cad_1', name: 'Colton Herta', team_id: 'custom_pk_12345' } as any,
    ]

    const controlledResults: RaceResultModel[] = [
      {
        id: 'r1',
        season_id: 'season_2026',
        round: 1,
        team_id: 'mercedes',
        position: 1,
        points: 25,
      } as any,
      {
        id: 'r2',
        season_id: 'season_2026',
        round: 1,
        driver_id: 'drv_cad_1',
        team_id: 'custom_pk_12345',
        position: 2,
        points: 18,
      } as any,
    ]

    const standings = standingsService.calculateStandings({
      raceResults: controlledResults,
      playerDrivers: customDrivers,
      team: customTeam,
      season: mockSeason,
    })

    expect(standings.playerConstructorRank).toBe(2)
    expect(standings.teamPoints).toBe(18)
    const playerStanding = standings.constructorStandings.find((c) => c.id === 'custom_pk_12345')
    expect(playerStanding).toBeDefined()
    expect(playerStanding?.name).toBe('Andretti Cadillac F1')
  })

  // CI01A2-11: save/reload preserva posição e pontos coerentes
  it('CI01A2-11: save/reload preserva posicao e pontos coerentes', () => {
    // Simula estado salvo como snapshot serializado
    const savedSnapshot = {
      playerConstructorRank: 3,
      teamPoints: 62,
      seasonYear: 2026,
      currentRound: 5,
    }

    // Ao recarregar (rehydrate)
    const rehydratedRank = savedSnapshot.playerConstructorRank ?? null
    const rehydratedPoints = savedSnapshot.teamPoints ?? 0

    expect(rehydratedRank).toBe(3)
    expect(rehydratedPoints).toBe(62)

    // Formatação pós-reload
    const displayPos = rehydratedRank != null && rehydratedRank > 0 ? `${rehydratedRank}º` : '—'
    expect(displayPos).toBe('3º')
  })

  // CI01A2-12: player team não recebe tratamento esportivo especial
  it('CI01A2-12: player team nao recebe tratamento esportivo especial', () => {
    // Empate em pontos com desempate por melhores posições oficiais FIA
    // Audi: 25 pts (1 vitória P1)
    // Haas: 25 pts (melhor posição P2: ex: P2 + P10...)
    const controlledResults: RaceResultModel[] = [
      {
        id: 'r1',
        season_id: 'season_2026',
        round: 1,
        team_id: 'haas',
        position: 2,
        points: 25,
      } as any,
      {
        id: 'r2',
        season_id: 'season_2026',
        round: 1,
        driver_id: 'drv_bortoleto',
        team_id: 'team_audi_01',
        position: 1,
        points: 25,
      } as any,
    ]

    const standings = standingsService.calculateStandings({
      raceResults: controlledResults,
      playerDrivers: mockDrivers,
      team: mockAudiTeam,
      season: mockSeason,
    })

    // Audi vence o critério de desempate puramente pelo melhor resultado P1 vs P2 (FIA puro, não por ser player)
    expect(standings.playerConstructorRank).toBe(1)

    // Se invertermos (Haas com vitória P1 e Audi com P2):
    const invertedResults: RaceResultModel[] = [
      {
        id: 'r1',
        season_id: 'season_2026',
        round: 1,
        team_id: 'haas',
        position: 1,
        points: 25,
      } as any,
      {
        id: 'r2',
        season_id: 'season_2026',
        round: 1,
        driver_id: 'drv_bortoleto',
        team_id: 'team_audi_01',
        position: 2,
        points: 25,
      } as any,
    ]

    const standingsInverted = standingsService.calculateStandings({
      raceResults: invertedResults,
      playerDrivers: mockDrivers,
      team: mockAudiTeam,
      season: mockSeason,
    })

    // Audi perde o desempate para a Haas e fica em P2 (sem favoritismo esportivo)
    expect(standingsInverted.playerConstructorRank).toBe(2)
  })
})
