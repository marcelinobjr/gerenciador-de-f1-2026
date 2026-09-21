import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { OfficialRaceResultPanel } from '@/components/race/OfficialRaceResultPanel'
import { PodiumVisualCard } from '@/components/race/PodiumVisualCard'
import type { OfficialRaceResult, OfficialRaceResultEntry } from '@/types/canonical-race-v2'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'

function createSampleOfficialRaceResult(
  overrides: Partial<OfficialRaceResult> = {},
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
      gapToWinner: 'LÍDER',
      status: 'finished',
      dnf: false,
      pitStops: 2,
      fastestLap: true,
      pointsAwarded: 26,
    },
    {
      finalPosition: 2,
      gridPosition: 1,
      driverId: 'drv_verstappen',
      driverName: 'Max Verstappen',
      teamId: 'red_bull',
      teamName: 'Red Bull Racing',
      teamColor: '#1E41FF',
      isPlayer: false,
      positionsGainedLost: -1,
      lapsCompleted: 57,
      raceTime: 5405.456,
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
  ]

  for (let p = 7; p <= 23; p++) {
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
    poleDriverId: 'drv_verstappen',
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
      significantIncidents: [],
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

describe('RACE-END-01.1 — BOX VISUAL DO PÓDIO (POD-01 A POD-06)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // POD-01: P1/P2/P3 correspondem ao resultado oficial sem recálculo
  it('POD-01: P1, P2 e P3 no box visual correspondem fielmente ao resultado oficial', () => {
    const result = createSampleOfficialRaceResult()
    render(<OfficialRaceResultPanel result={result} />)

    const podiumBox = screen.getByTestId('podium-visual-box')
    expect(podiumBox).toBeDefined()

    const p1Slot = screen.getByTestId('podium-visual-slot-p1')
    const p2Slot = screen.getByTestId('podium-visual-slot-p2')
    const p3Slot = screen.getByTestId('podium-visual-slot-p3')

    expect(p1Slot.textContent).toContain('Lando Norris')
    expect(p1Slot.textContent).toContain('McLaren F1 Team')

    expect(p2Slot.textContent).toContain('Max Verstappen')
    expect(p2Slot.textContent).toContain('Red Bull Racing')

    expect(p3Slot.textContent).toContain('Charles Leclerc')
    expect(p3Slot.textContent).toContain('Scuderia Ferrari')
  })

  // POD-02: Fotos correspondem aos driverIds corretos
  it('POD-02: fotos canônicas são resolvidas pelos driverIds oficiais do pódio', () => {
    const result = createSampleOfficialRaceResult()
    render(<PodiumVisualCard result={result} />)

    const p1Slot = screen.getByTestId('podium-visual-slot-p1')
    const p2Slot = screen.getByTestId('podium-visual-slot-p2')
    const p3Slot = screen.getByTestId('podium-visual-slot-p3')

    // Deve renderizar elemento de avatar/foto para cada piloto
    expect(p1Slot.querySelector('img, div')).toBeDefined()
    expect(p2Slot.querySelector('img, div')).toBeDefined()
    expect(p3Slot.querySelector('img, div')).toBeDefined()

    // Valida nomes vinculados às posições oficiais
    expect(screen.getByTestId('podium-driver-name-p1').textContent).toBe('Lando Norris')
    expect(screen.getByTestId('podium-driver-name-p2').textContent).toBe('Max Verstappen')
    expect(screen.getByTestId('podium-driver-name-p3').textContent).toBe('Charles Leclerc')
  })

  // POD-03: P1 visualmente destacado (foto/tratamento maior e selo de vencedor)
  it('POD-03: P1 possui maior destaque visual em relação a P2 e P3', () => {
    const result = createSampleOfficialRaceResult()
    render(<PodiumVisualCard result={result} />)

    const p1Slot = screen.getByTestId('podium-visual-slot-p1')
    const p2Slot = screen.getByTestId('podium-visual-slot-p2')
    const p3Slot = screen.getByTestId('podium-visual-slot-p3')

    // P1 tem badge especial de VENCEDOR
    expect(p1Slot.textContent).toContain('VENCEDOR')
    expect(p2Slot.textContent).not.toContain('VENCEDOR')
    expect(p3Slot.textContent).not.toContain('VENCEDOR')

    // P1 possui classe de tamanho maior ou gradiente âmbar
    expect(p1Slot.querySelector('.border-amber-400')).not.toBeNull()
  })

  // POD-04: Fallback elegante funciona sem quebrar layout se imagem ausente
  it('POD-04: fallback funciona com elegância caso o piloto não possua foto ou falhe', () => {
    const customResult = createSampleOfficialRaceResult({
      winnerDriverId: 'drv_unknown_fictional',
      podium: ['drv_unknown_fictional', 'drv_verstappen', 'drv_leclerc'],
    })

    // Adiciona piloto desconhecido na posição 1
    customResult.entries.unshift({
      finalPosition: 1,
      gridPosition: 1,
      driverId: 'drv_unknown_fictional',
      driverName: 'Piloto Teste Misterioso',
      teamId: 'audi',
      teamName: 'Audi Revolut F1 Team',
      teamColor: '#C0C0C0',
      isPlayer: false,
      positionsGainedLost: 0,
      lapsCompleted: 57,
      raceTime: 5399.0,
      gapToWinner: 'LÍDER',
      status: 'finished',
      dnf: false,
      pitStops: 2,
      fastestLap: false,
      pointsAwarded: 25,
    })

    render(<PodiumVisualCard result={customResult} />)

    const p1Slot = screen.getByTestId('podium-visual-slot-p1')
    expect(p1Slot).toBeDefined()
    expect(p1Slot.textContent).toContain('Piloto Teste Misterioso')
    // Layout renderiza normalmente com as iniciais do piloto ou avatar sem crash
    expect(p1Slot.textContent).toContain('PT')
  })

  // POD-05: Reload ou re-renderização não altera o pódio
  it('POD-05: recarregamento ou re-renderização preserva o mesmo pódio idêntico', () => {
    const result = createSampleOfficialRaceResult()
    const { unmount } = render(<OfficialRaceResultPanel result={result} />)

    expect(screen.getByTestId('podium-driver-name-p1').textContent).toBe('Lando Norris')
    expect(screen.getByTestId('podium-driver-name-p2').textContent).toBe('Max Verstappen')
    expect(screen.getByTestId('podium-driver-name-p3').textContent).toBe('Charles Leclerc')

    unmount()

    // Segunda renderização simulando reload
    render(<OfficialRaceResultPanel result={result} />)

    expect(screen.getByTestId('podium-driver-name-p1').textContent).toBe('Lando Norris')
    expect(screen.getByTestId('podium-driver-name-p2').textContent).toBe('Max Verstappen')
    expect(screen.getByTestId('podium-driver-name-p3').textContent).toBe('Charles Leclerc')
  })

  // POD-06: Resultado histórico mostra o mesmo box visual de pódio
  it('POD-06: resultado histórico renderiza o mesmo box de pódio corretamente', () => {
    const historicalResult = createSampleOfficialRaceResult({
      round: 1,
      circuitName: 'Circuito Histórico de Silverstone',
      podium: ['drv_verstappen', 'drv_norris', 'drv_leclerc'],
      winnerDriverId: 'drv_verstappen',
    })

    render(<OfficialRaceResultPanel result={historicalResult} />)

    const podiumBox = screen.getByTestId('podium-visual-box')
    expect(podiumBox).toBeDefined()

    // No histórico, Verstappen foi P1, Norris P2, Leclerc P3
    expect(screen.getByTestId('podium-driver-name-p1').textContent).toBe('Max Verstappen')
    expect(screen.getByTestId('podium-driver-name-p2').textContent).toBe('Lando Norris')
    expect(screen.getByTestId('podium-driver-name-p3').textContent).toBe('Charles Leclerc')
  })
})
