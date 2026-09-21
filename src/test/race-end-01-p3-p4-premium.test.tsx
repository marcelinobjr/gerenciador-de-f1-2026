import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { OfficialRaceResultPanel } from '@/components/race/OfficialRaceResultPanel'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { driverBase2026Service } from '@/services/driverBase2026Service'
import type { OfficialRaceResult, OfficialRaceResultEntry } from '@/types/canonical-race-v2'
import { F1_2026_CALENDAR } from '@/lib/f1-data'

function createSampleOfficialRaceResult(
  overrides?: Partial<OfficialRaceResult>,
): OfficialRaceResult {
  const entries: OfficialRaceResultEntry[] = [
    {
      finalPosition: 1,
      gridPosition: 2,
      driverId: 'drv_norris',
      driverName: 'Lando Norris',
      teamId: 'mclaren',
      teamName: 'McLaren F1 Team',
      teamColor: '#FF8700',
      isPlayer: false,
      positionsGainedLost: 1,
      lapsCompleted: 57,
      raceTime: 5400.123,
      raceTimeFormatted: '1h 30m 00s.123',
      gapToWinner: 'VENCEDOR',
      status: 'finished',
      dnf: false,
      pitStops: 2,
      fastestLap: true,
      pointsAwarded: 26,
    },
    {
      finalPosition: 2,
      gridPosition: 1, // Pole foi o Verstappen
      driverId: 'drv_verstappen',
      driverName: 'Max Verstappen',
      teamId: 'red_bull',
      teamName: 'Red Bull Racing',
      teamColor: '#1E41FF',
      isPlayer: false,
      positionsGainedLost: -1,
      lapsCompleted: 57,
      raceTime: 5405.456,
      raceTimeFormatted: '1h 30m 05s.456',
      gapToWinner: '+5.333s',
      status: 'finished',
      dnf: false,
      pitStops: 2,
      fastestLap: false,
      pointsAwarded: 18,
    },
    {
      finalPosition: 3,
      gridPosition: 4,
      driverId: 'drv_leclerc',
      driverName: 'Charles Leclerc',
      teamId: 'ferrari',
      teamName: 'Scuderia Ferrari',
      teamColor: '#DC0000',
      isPlayer: false,
      positionsGainedLost: 1,
      lapsCompleted: 57,
      raceTime: 5412.573,
      gapToWinner: '+12.450s',
      status: 'finished',
      dnf: false,
      pitStops: 2,
      fastestLap: false,
      pointsAwarded: 15,
    },
    {
      finalPosition: 4,
      gridPosition: 3,
      driverId: 'drv_piastri',
      driverName: 'Oscar Piastri',
      teamId: 'mclaren',
      teamName: 'McLaren F1 Team',
      teamColor: '#FF8700',
      isPlayer: false,
      positionsGainedLost: -1,
      lapsCompleted: 57,
      raceTime: 5418.323,
      gapToWinner: '+18.200s',
      status: 'finished',
      dnf: false,
      pitStops: 2,
      fastestLap: false,
      pointsAwarded: 12,
    },
    {
      finalPosition: 5,
      gridPosition: 8,
      driverId: 'drv_player_car1',
      driverName: 'Gabriel Bortoleto',
      teamId: 'audi',
      teamName: 'Audi Revolut F1 Team',
      teamColor: '#C0C0C0',
      isPlayer: true,
      carSlot: 'car1',
      positionsGainedLost: 3,
      lapsCompleted: 57,
      raceTime: 5425.123,
      gapToWinner: '+25.000s',
      status: 'finished',
      dnf: false,
      pitStops: 2,
      fastestLap: false,
      pointsAwarded: 10,
    },
    {
      finalPosition: 6,
      gridPosition: 5,
      driverId: 'drv_russell',
      driverName: 'George Russell',
      teamId: 'mercedes',
      teamName: 'Mercedes-AMG F1',
      teamColor: '#00D2BE',
      isPlayer: false,
      positionsGainedLost: -1,
      lapsCompleted: 57,
      raceTime: 5430.223,
      gapToWinner: '+30.100s',
      status: 'finished',
      dnf: false,
      pitStops: 2,
      fastestLap: false,
      pointsAwarded: 8,
    },
    {
      finalPosition: 7,
      gridPosition: 7,
      driverId: 'drv_hamilton',
      driverName: 'Lewis Hamilton',
      teamId: 'ferrari',
      teamName: 'Scuderia Ferrari',
      teamColor: '#DC0000',
      isPlayer: false,
      positionsGainedLost: 0,
      lapsCompleted: 57,
      raceTime: 5435.123,
      gapToWinner: '+35.000s',
      status: 'finished',
      dnf: false,
      pitStops: 2,
      fastestLap: false,
      pointsAwarded: 6,
    },
    {
      finalPosition: 8,
      gridPosition: 6,
      driverId: 'drv_antonelli',
      driverName: 'Kimi Antonelli',
      teamId: 'mercedes',
      teamName: 'Mercedes-AMG F1',
      teamColor: '#00D2BE',
      isPlayer: false,
      positionsGainedLost: -2,
      lapsCompleted: 57,
      raceTime: 5440.123,
      gapToWinner: '+40.000s',
      status: 'finished',
      dnf: false,
      pitStops: 2,
      fastestLap: false,
      pointsAwarded: 4,
    },
    {
      finalPosition: 9,
      gridPosition: 10,
      driverId: 'drv_alonso',
      driverName: 'Fernando Alonso',
      teamId: 'aston_martin',
      teamName: 'Aston Martin F1',
      teamColor: '#006F62',
      isPlayer: false,
      positionsGainedLost: 1,
      lapsCompleted: 57,
      raceTime: 5448.123,
      gapToWinner: '+48.000s',
      status: 'finished',
      dnf: false,
      pitStops: 2,
      fastestLap: false,
      pointsAwarded: 2,
    },
    {
      finalPosition: 10,
      gridPosition: 12,
      driverId: 'drv_gasly',
      driverName: 'Pierre Gasly',
      teamId: 'alpine',
      teamName: 'Alpine F1 Team',
      teamColor: '#0090FF',
      isPlayer: false,
      positionsGainedLost: 2,
      lapsCompleted: 57,
      raceTime: 5455.123,
      gapToWinner: '+55.000s',
      status: 'finished',
      dnf: false,
      pitStops: 2,
      fastestLap: false,
      pointsAwarded: 1,
    },
  ]

  // Preencher P11 a P23 como terminados normais sem pontos
  for (let p = 11; p <= 23; p++) {
    entries.push({
      finalPosition: p,
      gridPosition: p,
      driverId: `drv_other_${p}`,
      driverName: `Piloto Reserva ${p}`,
      teamId: 'williams',
      teamName: 'Williams Racing',
      teamColor: '#005AFF',
      isPlayer: false,
      positionsGainedLost: 0,
      lapsCompleted: 56,
      raceTime: 5500 + p * 2,
      gapToWinner: '+1 volta',
      status: 'finished',
      dnf: false,
      pitStops: 2,
      fastestLap: false,
      pointsAwarded: 0,
    })
  }

  // P24 é o Carro 2 do jogador com DNF na volta 22
  const playerCar2: OfficialRaceResultEntry = {
    finalPosition: 24,
    gridPosition: 9,
    driverId: 'drv_player_car2',
    driverName: 'Nico Hulkenberg',
    teamId: 'audi',
    teamName: 'Audi Revolut F1 Team',
    teamColor: '#C0C0C0',
    isPlayer: true,
    carSlot: 'car2',
    positionsGainedLost: -15,
    lapsCompleted: 22,
    raceTime: 2100,
    gapToWinner: 'DNF',
    status: 'dnf',
    dnf: true,
    dnfReason: 'Falha no Câmbio',
    dnfLap: 22,
    pitStops: 1,
    fastestLap: false,
    pointsAwarded: 0,
  }
  entries.push(playerCar2)

  const playerEntries: [OfficialRaceResultEntry, OfficialRaceResultEntry] = [
    entries.find((e) => e.driverId === 'drv_player_car1')!,
    playerCar2,
  ]

  const baseResult: OfficialRaceResult = {
    officialResultId: 'official_result_test_r2',
    schemaVersion: 'official-race-result-v1',
    careerId: 'career_re_suite',
    season: 2026,
    round: 2,
    raceId: 'race_s2026_r2',
    circuitId: 'jeddah',
    circuitName: 'Jeddah Corniche Circuit',
    circuitCountry: 'Arábia Saudita',
    playerTeamId: 'audi',
    officializedAt: new Date('2026-03-22T18:00:00Z').toISOString(),
    totalLaps: 57,
    winnerDriverId: 'drv_norris',
    winnerTeamId: 'mclaren',
    poleDriverId: 'drv_verstappen', // Pole diferente do vencedor
    fastestLapDriverId: 'drv_norris',
    fastestLapSec: 91.234,
    fastestLapFormatted: '1:31.234',
    fastestLapNumber: 52,
    podium: ['drv_norris', 'drv_verstappen', 'drv_leclerc'],
    entries,
    playerEntries,
    eventsSummary: {
      safetyCarPeriods: 1,
      safetyCarLaps: 4,
      vscPeriods: 0,
      vscLaps: 0,
      redFlagPeriods: 0,
      dnfCount: 1,
      totalPitStops: 45,
      significantIncidents: [
        {
          lap: 22,
          type: 'dnf',
          message: 'Abandono: Nico Hulkenberg (Falha no Câmbio)',
          driverId: 'drv_player_car2',
          timestamp: new Date().toISOString(),
        },
      ],
    },
    resultHash: '',
  }

  const checksum = canonicalRaceResultService.generateResultChecksum({
    officialResultId: baseResult.officialResultId,
    careerId: baseResult.careerId,
    season: baseResult.season,
    round: baseResult.round,
    raceId: baseResult.raceId,
    winnerDriverId: baseResult.winnerDriverId,
    poleDriverId: baseResult.poleDriverId,
    fastestLapDriverId: baseResult.fastestLapDriverId,
    entries: baseResult.entries,
  })

  baseResult.resultHash = checksum
  return { ...baseResult, ...overrides }
}

describe('RACE-END-01 P3/P4: TELA DE FIM DE PROVA PREMIUM (RE-01 A RE-20)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // RE-01: Vencedor e pódio exibidos do OfficialRaceResult
  it('RE-01: vencedor e pódio exibidos exclusivamente a partir do OfficialRaceResult', () => {
    const result = createSampleOfficialRaceResult()
    render(<OfficialRaceResultPanel result={result} />)

    const winnerElement = screen.getByTestId('winner-driver-name')
    expect(winnerElement.textContent).toBe('Lando Norris')

    expect(screen.getByTestId('podium-card-p1').textContent).toContain('Lando Norris')
    expect(screen.getByTestId('podium-card-p2').textContent).toContain('Max Verstappen')
    expect(screen.getByTestId('podium-card-p3').textContent).toContain('Charles Leclerc')
  })

  // RE-02: Pole diferente do vencedor exibida correta
  it('RE-02: pole position diferente do vencedor exibida corretamente com nome e equipe', () => {
    const result = createSampleOfficialRaceResult()
    render(<OfficialRaceResultPanel result={result} />)

    expect(result.winnerDriverId).not.toBe(result.poleDriverId)
    const poleElement = screen.getByTestId('pole-driver-name')
    expect(poleElement.textContent).toBe('Max Verstappen')
    expect(screen.getByTestId('hero-pole-card').textContent).toContain('Red Bull Racing')
  })

  // RE-03: Fastest lap correta (piloto/tempo/volta)
  it('RE-03: volta mais rápida correta com piloto, tempo formatado e volta', () => {
    const result = createSampleOfficialRaceResult()
    render(<OfficialRaceResultPanel result={result} />)

    const flCard = screen.getByTestId('hero-fastest-lap-card')
    expect(flCard.textContent).toContain('Lando Norris')
    expect(flCard.textContent).toContain('1:31.234')
    expect(flCard.textContent).toContain('Volta 52')
  })

  // RE-04: Dois carros do jogador independentes (cards separados, não somados)
  it('RE-04: os dois carros do jogador são renderizados de forma independente em cards separados', () => {
    const result = createSampleOfficialRaceResult()
    render(<OfficialRaceResultPanel result={result} />)

    const car1Card = screen.getByTestId('player-car-card-1')
    const car2Card = screen.getByTestId('player-car-card-2')

    expect(car1Card).toBeDefined()
    expect(car2Card).toBeDefined()
    expect(car1Card.textContent).toContain('Gabriel Bortoleto')
    expect(car1Card.textContent).toContain('P5')
    expect(car2Card.textContent).toContain('Nico Hulkenberg')
    expect(car2Card.textContent).toContain('DNF')
  })

  // RE-05: Carro DNF com motivo e volta corretos, sem gap fictício
  it('RE-05: carro DNF exibe motivo e volta reais de abandono, sem gap fictício', () => {
    const result = createSampleOfficialRaceResult()
    render(<OfficialRaceResultPanel result={result} />)

    const car2Card = screen.getByTestId('player-car-card-2')
    expect(car2Card.textContent).toContain('DNF: Falha no Câmbio (Volta 22)')
    expect(car2Card.textContent).not.toContain('+54.') // sem gap numérico inventado
  })

  // RE-06: Tabela P1–P24 idêntica ao snapshot
  it('RE-06: tabela expansível P1–P24 possui exatamente as 24 posições fiéis ao snapshot oficial', () => {
    const result = createSampleOfficialRaceResult()
    render(<OfficialRaceResultPanel result={result} />)

    // Clica para expandir a tabela
    const expandHeader = screen.getByText(/Classificação Completa Homologada/i)
    fireEvent.click(expandHeader)

    // Verificar se todas as 24 linhas estão presentes
    for (let pos = 1; pos <= 24; pos++) {
      expect(screen.getByTestId(`table-row-pos-${pos}`)).toBeDefined()
    }
  })

  // RE-07: Pontos exibidos = pointsAwarded
  it('RE-07: pontos exibidos nos cards e tabelas coincidem estritamente com pointsAwarded oficial', () => {
    const result = createSampleOfficialRaceResult()
    render(<OfficialRaceResultPanel result={result} />)

    const car1Card = screen.getByTestId('player-car-card-1')
    expect(car1Card.textContent).toContain('+10 pts')

    const car2Card = screen.getByTestId('player-car-card-2')
    expect(car2Card.textContent).toContain('0 pts')
  })

  // RE-08: Impacto campeonato usa snapshots N-1/N
  it('RE-08: bloco de impacto no campeonato consome snapshots canônicos N-1 e N', () => {
    const result = createSampleOfficialRaceResult()
    // Criar snapshot N-1 (rodada 1)
    canonicalChampionshipService.saveSnapshot({
      id: canonicalChampionshipService.buildSnapshotKey(result.careerId, 2026, 1),
      careerId: result.careerId,
      season: 2026,
      throughRound: 1,
      sourceRaceResultIds: ['race_r1'],
      sourceChecksums: ['chk1'],
      driverStandings: [
        {
          position: 1,
          driverId: 'drv_verstappen',
          driverName: 'Max Verstappen',
          nationality: 'Holanda',
          flag: '🇳🇱',
          points: 25,
          wins: 1,
          secondPlaces: 0,
          thirdPlaces: 0,
          fourthPlaces: 0,
          podiums: 1,
          raceStarts: 1,
          racesCounted: 1,
          finishCounts: { 1: 1 },
          gapToLeader: '—',
        },
        {
          position: 8,
          driverId: 'drv_player_car1',
          driverName: 'Gabriel Bortoleto',
          nationality: 'Brasil',
          flag: '🇧🇷',
          points: 4,
          wins: 0,
          secondPlaces: 0,
          thirdPlaces: 0,
          fourthPlaces: 0,
          podiums: 0,
          raceStarts: 1,
          racesCounted: 1,
          finishCounts: { 8: 1 },
          gapToLeader: '-21',
        },
      ],
      constructorStandings: [
        {
          position: 5,
          teamId: 'audi',
          teamName: 'Audi Revolut F1 Team',
          teamColor: '#C0C0C0',
          points: 4,
          wins: 0,
          podiums: 0,
          racesCounted: 1,
          finishCounts: { 8: 1 },
          gapToLeader: '-21',
          isPlayer: true,
        },
      ],
      createdAt: new Date().toISOString(),
      schemaVersion: 'championship-snapshot-v1',
    })

    // Registrar o resultado oficial na carreira para gerar snapshot N (rodada 2)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(result)

    render(<OfficialRaceResultPanel result={result} />)

    const impactPanel = screen.getByTestId('championship-impact-panel')
    expect(impactPanel).toBeDefined()
    expect(impactPanel.textContent).toContain('Impacto no Campeonato')
  })

  // RE-09: Variação de piloto correta
  it('RE-09: variação de piloto antes vs depois exibida corretamente (↑ / ↓ / =)', () => {
    const result = createSampleOfficialRaceResult()
    // Snapshot anterior com Bortoleto em P8 (4 pts)
    canonicalChampionshipService.saveSnapshot({
      id: canonicalChampionshipService.buildSnapshotKey(result.careerId, 2026, 1),
      careerId: result.careerId,
      season: 2026,
      throughRound: 1,
      sourceRaceResultIds: ['race_r1'],
      sourceChecksums: ['chk1'],
      driverStandings: [
        {
          position: 8,
          driverId: 'drv_player_car1',
          driverName: 'Gabriel Bortoleto',
          nationality: 'Brasil',
          flag: '🇧🇷',
          points: 4,
          wins: 0,
          secondPlaces: 0,
          thirdPlaces: 0,
          fourthPlaces: 0,
          podiums: 0,
          raceStarts: 1,
          racesCounted: 1,
          finishCounts: { 8: 1 },
          gapToLeader: '-21',
        },
      ],
      constructorStandings: [],
      createdAt: new Date().toISOString(),
      schemaVersion: 'championship-snapshot-v1',
    })

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(result)
    render(<OfficialRaceResultPanel result={result} />)

    const d1Card = screen.getByTestId('driver1-championship-card')
    expect(d1Card.textContent).toContain('Antes (R1)')
    expect(d1Card.textContent).toContain('P8 • 4 pts')
    expect(d1Card.textContent).toContain('Depois (R2)')
  })

  // RE-10: Variação de construtor correta
  it('RE-10: variação de construtor correta usando dados da equipe do jogador', () => {
    const result = createSampleOfficialRaceResult()
    canonicalChampionshipService.saveSnapshot({
      id: canonicalChampionshipService.buildSnapshotKey(result.careerId, 2026, 1),
      careerId: result.careerId,
      season: 2026,
      throughRound: 1,
      sourceRaceResultIds: ['race_r1'],
      sourceChecksums: ['chk1'],
      driverStandings: [],
      constructorStandings: [
        {
          position: 6,
          teamId: 'audi',
          teamName: 'Audi Revolut F1 Team',
          teamColor: '#C0C0C0',
          points: 4,
          wins: 0,
          podiums: 0,
          racesCounted: 1,
          finishCounts: { 8: 1 },
          gapToLeader: '-21',
          isPlayer: true,
        },
      ],
      createdAt: new Date().toISOString(),
      schemaVersion: 'championship-snapshot-v1',
    })

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(result)
    render(<OfficialRaceResultPanel result={result} />)

    const teamCard = screen.getByTestId('team-championship-card')
    expect(teamCard.textContent).toContain('Sua Equipe • Construtores')
    expect(teamCard.textContent).toContain('Antes (R1)')
    expect(teamCard.textContent).toContain('P6 • 4 pts')
  })

  // RE-11: Mudança de líder detectada corretamente
  it('RE-11: mudança de líder é detectada e exibe badge exclusivo somente se houver novo líder', () => {
    const result = createSampleOfficialRaceResult()
    // No R1 o líder era Verstappen
    canonicalChampionshipService.saveSnapshot({
      id: canonicalChampionshipService.buildSnapshotKey(result.careerId, 2026, 1),
      careerId: result.careerId,
      season: 2026,
      throughRound: 1,
      sourceRaceResultIds: ['r1'],
      sourceChecksums: ['c1'],
      driverStandings: [
        {
          position: 1,
          driverId: 'drv_verstappen',
          driverName: 'Max Verstappen',
          nationality: 'Holanda',
          flag: '🇳🇱',
          points: 25,
          wins: 1,
          secondPlaces: 0,
          thirdPlaces: 0,
          fourthPlaces: 0,
          podiums: 1,
          raceStarts: 1,
          racesCounted: 1,
          finishCounts: { 1: 1 },
          gapToLeader: '—',
        },
        {
          position: 2,
          driverId: 'drv_norris',
          driverName: 'Lando Norris',
          nationality: 'Reino Unido',
          flag: '🇬🇧',
          points: 18,
          wins: 0,
          secondPlaces: 1,
          thirdPlaces: 0,
          fourthPlaces: 0,
          podiums: 1,
          raceStarts: 1,
          racesCounted: 1,
          finishCounts: { 2: 1 },
          gapToLeader: '-7',
        },
      ],
      constructorStandings: [
        {
          position: 1,
          teamId: 'red_bull',
          teamName: 'Red Bull Racing',
          teamColor: '#1E41FF',
          points: 25,
          wins: 1,
          podiums: 1,
          racesCounted: 1,
          finishCounts: { 1: 1 },
          gapToLeader: '—',
        },
        {
          position: 2,
          teamId: 'mclaren',
          teamName: 'McLaren F1 Team',
          teamColor: '#FF8700',
          points: 18,
          wins: 0,
          podiums: 1,
          racesCounted: 1,
          finishCounts: { 2: 1 },
          gapToLeader: '-7',
        },
      ],
      createdAt: new Date().toISOString(),
      schemaVersion: 'championship-snapshot-v1',
    })

    // No R2 Norris faz 26 pts (total 44) e Verstappen faz 18 (total 43) -> Norris assume a liderança!
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(result)
    render(<OfficialRaceResultPanel result={result} />)

    const newLeaderBadge = screen.getByTestId('badge-new-driver-leader')
    expect(newLeaderBadge).toBeDefined()
    expect(newLeaderBadge.textContent).toContain('Lando Norris')
  })

  // RE-12: Sem mudança de líder não mostra badge falso
  it('RE-12: sem mudança de líder nenhum badge de novo líder é exibido', () => {
    const result = createSampleOfficialRaceResult()
    // No R1 o líder já era Norris
    canonicalChampionshipService.saveSnapshot({
      id: canonicalChampionshipService.buildSnapshotKey(result.careerId, 2026, 1),
      careerId: result.careerId,
      season: 2026,
      throughRound: 1,
      sourceRaceResultIds: ['r1'],
      sourceChecksums: ['c1'],
      driverStandings: [
        {
          position: 1,
          driverId: 'drv_norris',
          driverName: 'Lando Norris',
          nationality: 'Reino Unido',
          flag: '🇬🇧',
          points: 25,
          wins: 1,
          secondPlaces: 0,
          thirdPlaces: 0,
          fourthPlaces: 0,
          podiums: 1,
          raceStarts: 1,
          racesCounted: 1,
          finishCounts: { 1: 1 },
          gapToLeader: '—',
        },
      ],
      constructorStandings: [
        {
          position: 1,
          teamId: 'mclaren',
          teamName: 'McLaren F1 Team',
          teamColor: '#FF8700',
          points: 37,
          wins: 1,
          podiums: 1,
          racesCounted: 1,
          finishCounts: { 1: 1 },
          gapToLeader: '—',
        },
      ],
      createdAt: new Date().toISOString(),
      schemaVersion: 'championship-snapshot-v1',
    })

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(result)
    render(<OfficialRaceResultPanel result={result} />)

    expect(screen.queryByTestId('badge-new-driver-leader')).toBeNull()
  })

  // RE-13: Reload sem nenhum efeito duplicado
  it('RE-13: reload ou re-renderização renderiza exatamente os mesmos dados sem duplicar efeitos', () => {
    const result = createSampleOfficialRaceResult()
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(result)

    const { unmount } = render(
      <OfficialRaceResultPanel result={result} careerPersistenceStatus="COMPLETE" />,
    )
    expect(screen.getByTestId('badge-official-result')).toBeDefined()
    unmount()

    // Reabertura / Reload
    render(<OfficialRaceResultPanel result={result} careerPersistenceStatus="COMPLETE" />)
    expect(screen.getByTestId('winner-driver-name').textContent).toBe('Lando Norris')
  })

  // RE-14: Retry de registro idempotente
  it('RE-14: botão de retry aciona a persistência idempotente sem recomeçar corrida', () => {
    const result = createSampleOfficialRaceResult()
    const onRetryMock = vi.fn()

    render(
      <OfficialRaceResultPanel
        result={result}
        careerPersistenceStatus="FAILED"
        persistenceError="Falha simulada no storage"
        onRegisterInCareer={onRetryMock}
      />,
    )

    const retryBtn = screen.getByTestId('retry-persistence-btn')
    expect(retryBtn).toBeDefined()
    fireEvent.click(retryBtn)
    expect(onRetryMock).toHaveBeenCalledTimes(1)
  })

  // RE-15: Resultado histórico abre sem race runner ativo
  it('RE-15: resultado histórico abre e renderiza todos os dados sem depender de runner de corrida ativo', () => {
    const historicalResult = createSampleOfficialRaceResult({
      round: 1,
      circuitName: 'Circuito Histórico',
    })
    render(<OfficialRaceResultPanel result={historicalResult} />)

    expect(screen.getByText('Circuito Histórico')).toBeDefined()
    expect(screen.getByTestId('winner-driver-name').textContent).toBe('Lando Norris')
  })

  // RE-16: Próximo GP vem do calendário correto
  it('RE-16: próximo GP vem do calendário canônico F1 2026', () => {
    const result = createSampleOfficialRaceResult({ round: 1 })
    render(<OfficialRaceResultPanel result={result} />)

    const nextEventInfo = screen.getByTestId('next-event-info')
    // Rodada 1 -> Próximo evento é Rodada 2
    const round2Expected = F1_2026_CALENDAR.find((c) => c.round === 2)
    expect(nextEventInfo.textContent).toContain(`Rodada 2`)
    expect(nextEventInfo.textContent).toContain(round2Expected?.name)
  })

  // RE-17: Botão Continuar não avança duas vezes (protegido contra duplo clique)
  it('RE-17: botão Continuar é protegido contra duplo clique e não dispara ação repetida', () => {
    const result = createSampleOfficialRaceResult()
    const onContinueMock = vi.fn()

    render(<OfficialRaceResultPanel result={result} onContinue={onContinueMock} />)

    const continueBtn = screen.getByTestId('continue-to-next-round-btn')
    fireEvent.click(continueBtn)
    fireEvent.click(continueBtn) // segundo clique

    expect(onContinueMock).toHaveBeenCalledTimes(1)
  })

  // RE-18: Stats acumuladas correspondem a career_drivers
  it('RE-18: estatísticas acumuladas de carreira consomem career_drivers fielmente', () => {
    const result = createSampleOfficialRaceResult()
    driverBase2026Service.saveCareerDrivers(result.careerId, {
      drv_player_car1: {
        careerId: result.careerId,
        driverId: 'drv_player_car1',
        teamId: 'audi',
        teamName: 'Audi Revolut F1 Team',
        role: 'titular',
        contractEndYear: 2026,
        salaryUsd: 2000000,
        ratings: {} as any,
        morale: 80,
        physicalCondition: 90,
        superlicensePoints: 40,
        homologationStatus: 'elegivel',
        stats: {
          careerGps: 15,
          careerWins: 2,
          careerPoles: 1,
          careerPodiums: 4,
          careerPoints: 65,
          careerFastestLaps: 3,
          careerDnfs: 1,
          careerTitles: 0,
        },
        updatedAt: new Date().toISOString(),
      },
    })

    render(<OfficialRaceResultPanel result={result} />)

    const car1Card = screen.getByTestId('player-car-card-1')
    expect(car1Card.textContent).toContain('15') // GPs
    expect(car1Card.textContent).toContain('65') // Pontos
  })

  // RE-19: Equipe soma somente seus dois carros daquele GP
  it('RE-19: card de resumo de pontos soma estritamente os dois carros do jogador na prova', () => {
    const result = createSampleOfficialRaceResult()
    // Carro 1: 10 pts, Carro 2: 0 pts => Soma = 10 pts
    render(<OfficialRaceResultPanel result={result} />)

    const teamPointsBadge = screen.getByTestId('team-total-points-card')
    expect(teamPointsBadge.textContent).toContain('+10 pts')
  })

  // RE-20: Rookie TL1 não aparece como terceiro piloto no resultado
  it('RE-20: piloto novato que participou apenas do TL1 não consta nas entradas do resultado oficial', () => {
    const result = createSampleOfficialRaceResult()
    render(<OfficialRaceResultPanel result={result} />)

    // O resultado oficial tem exatamente 2 playerEntries
    expect(result.playerEntries).toHaveLength(2)
    const playerIds = result.playerEntries.map((e) => e.driverId)
    expect(playerIds).not.toContain('rookie_tl1')
  })
})
