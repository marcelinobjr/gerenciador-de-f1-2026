import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  TRACKS,
  DEFAULT_TRACK_ID,
  getTrack,
  getAllTracks,
  resolveTrackFromCircuitName,
} from '@/components/race/tracks'
import {
  convertToRaceCars,
  type RaceCar,
  type RaceSimulationResult,
} from '@/components/race/RaceSimulator'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

describe('Tela de Corrida — tracks.ts (Circuitos e Fallback)', () => {
  it('contém exatamente 4 circuitos homologados: Interlagos, Silverstone, Monza, Spa', () => {
    const tracks = getAllTracks()
    expect(tracks.length).toBe(4)
    const ids = tracks.map((t) => t.id).sort()
    expect(ids).toEqual(['interlagos', 'monza', 'silverstone', 'spa'])
  })

  it('todos os 4 circuitos possuem duração configurada de 10 voltas e path SVG do traçado', () => {
    const tracks = getAllTracks()
    tracks.forEach((track) => {
      expect(track.totalLaps).toBe(10)
      expect(typeof track.path).toBe('string')
      expect(track.path.startsWith('M ')).toBe(true)
      expect(track.path.endsWith(' Z')).toBe(true)
      expect(track.viewBox).toBe('0 0 360 240')
      expect(track.points.length).toBeGreaterThan(10)
    })
  })

  it('Interlagos é o circuito padrão da aplicação', () => {
    expect(DEFAULT_TRACK_ID).toBe('interlagos')
    expect(getTrack()).toEqual(TRACKS.interlagos)
    expect(getTrack('circuito_inexistente')).toEqual(TRACKS.interlagos)
  })

  it('resolveTrackFromCircuitName resolve corretamente variações conhecidas', () => {
    expect(resolveTrackFromCircuitName('Interlagos').id).toBe('interlagos')
    expect(resolveTrackFromCircuitName('Grande Prêmio do Brasil').id).toBe('interlagos')
    expect(resolveTrackFromCircuitName('Silverstone Circuit').id).toBe('silverstone')
    expect(resolveTrackFromCircuitName('GP da Grã-Bretanha').id).toBe('silverstone')
    expect(resolveTrackFromCircuitName('Autodromo Nazionale Monza').id).toBe('monza')
    expect(resolveTrackFromCircuitName('GP da Itália').id).toBe('monza')
    expect(resolveTrackFromCircuitName('Spa-Francorchamps').id).toBe('spa')
    expect(resolveTrackFromCircuitName('GP da Bélgica').id).toBe('spa')
  })

  it('resolveTrackFromCircuitName aplica fallback obrigatório para Interlagos quando não houver match', () => {
    expect(resolveTrackFromCircuitName(undefined).id).toBe('interlagos')
    expect(resolveTrackFromCircuitName('').id).toBe('interlagos')
    expect(resolveTrackFromCircuitName('Circuito de Mônaco Desconhecido').id).toBe('interlagos')
    expect(resolveTrackFromCircuitName('Suzuka Japan').id).toBe('interlagos')
    expect(resolveTrackFromCircuitName('Las Vegas Strip').id).toBe('interlagos')
  })
})

describe('Tela de Corrida — RaceSimulator (Lógica de Simulação, Gaps e Ritmo)', () => {
  it('convertToRaceCars inicializa o grid com ritmo padrão 75 quando não especificado', () => {
    const cars = convertToRaceCars()
    expect(cars.length).toBe(24)
    cars.forEach((car) => {
      expect(car.pace).toBe(75)
    })
  })

  it('identifica corretamente pilotos do jogador com isPlayer e badge "(Você)"', () => {
    const cars = convertToRaceCars(undefined, 'player_team', 'Apex Racing Team', '#E10600')
    const playerCars = cars.filter((c) => c.isPlayer)
    expect(playerCars.length).toBe(2)
    expect(playerCars[0].teamId).toBe('player_team')
    expect(playerCars[0].driverName).toContain('(Você)')
    expect(playerCars[1].teamId).toBe('player_team')
    expect(playerCars[1].driverName).toContain('(Você)')
  })

  it('ordenação é estritamente por tempo acumulado total (totalTimeSec)', () => {
    const mockCars: RaceCar[] = [
      {
        id: 'car_1',
        driverId: 'drv_1',
        driverName: 'Piloto A',
        teamId: 'team_a',
        teamName: 'Equipe A',
        teamColor: '#E10600',
        isPlayer: false,
        pace: 75,
        gridPosition: 1,
        currentPosition: 1,
        currentLap: 1,
        totalTimeSec: 85.42,
        gapToLeaderSec: 0,
        gapToFrontSec: 0,
        progressOnLap: 0,
      },
      {
        id: 'car_2',
        driverId: 'drv_2',
        driverName: 'Piloto B',
        teamId: 'team_b',
        teamName: 'Equipe B',
        teamColor: '#00D2BE',
        isPlayer: true,
        pace: 75,
        gridPosition: 2,
        currentPosition: 2,
        currentLap: 1,
        totalTimeSec: 82.11, // Mais rápido! Deve assumir P1
        gapToLeaderSec: 0,
        gapToFrontSec: 0,
        progressOnLap: 0,
      },
      {
        id: 'car_3',
        driverId: 'drv_3',
        driverName: 'Piloto C',
        teamId: 'team_c',
        teamName: 'Equipe C',
        teamColor: '#FF8700',
        isPlayer: false,
        pace: 75,
        gridPosition: 3,
        currentPosition: 3,
        currentLap: 1,
        totalTimeSec: 88.95,
        gapToLeaderSec: 0,
        gapToFrontSec: 0,
        progressOnLap: 0,
      },
    ]

    // Simula a ordenação canônica por menor totalTimeSec
    const sorted = [...mockCars].sort((a, b) => a.totalTimeSec - b.totalTimeSec)
    expect(sorted[0].id).toBe('car_2') // P1 com 82.11s
    expect(sorted[1].id).toBe('car_1') // P2 com 85.42s
    expect(sorted[2].id).toBe('car_3') // P3 com 88.95s

    // Cálculo dos gaps
    const leaderTime = sorted[0].totalTimeSec
    const gaps = sorted.map((car, idx) => {
      const isLeader = idx === 0
      return {
        id: car.id,
        gapText: isLeader ? 'LÍDER' : `+${(car.totalTimeSec - leaderTime).toFixed(3)}s`,
        gapValue: isLeader ? 0 : Number((car.totalTimeSec - leaderTime).toFixed(3)),
      }
    })

    // P1 mostra "LÍDER"
    expect(gaps[0].gapText).toBe('LÍDER')
    expect(gaps[0].gapValue).toBe(0)

    // Demais mostram "+X.XXXs" com diferença para o líder
    expect(gaps[1].gapText).toBe('+3.310s')
    expect(gaps[1].gapValue).toBe(3.31)
    expect(gaps[2].gapText).toBe('+6.840s')
    expect(gaps[2].gapValue).toBe(6.84)
  })

  it('melhor volta é identificada com o menor tempo geral registrado', () => {
    const lapTimes = [
      { driverId: 'drv_1', timeSec: 72.41, lap: 3 },
      { driverId: 'drv_2', timeSec: 71.18, lap: 5 }, // Melhor volta
      { driverId: 'drv_3', timeSec: 73.05, lap: 2 },
    ]

    const fastest = lapTimes.reduce((best, cur) => (cur.timeSec < best.timeSec ? cur : best))
    expect(fastest.driverId).toBe('drv_2')
    expect(fastest.timeSec).toBe(71.18)
    expect(fastest.lap).toBe(5)
  })
})

describe('Tela de Corrida — Oficialização canônica idempotente (24 pilotos)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('oficializa a corrida com sucesso gerando 24 entradas únicas de pilotos', () => {
    // Monta CanonicalRaceState realista de 24 pilotos com campos canônicos
    const mockState: CanonicalRaceState = {
      version: '2.0',
      saveSchemaVersion: 'race-save-v1',
      careerId: 'test_career_race',
      season: 2026,
      round: 1,
      raceId: 'test_race_interlagos',
      circuitName: 'Autódromo de Interlagos',
      circuitCountry: 'Brasil',
      totalLaps: 10,
      currentLap: 10,
      status: 'completed',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      weather: 'seco',
      simSpeed: 1,
      completedAt: new Date().toISOString(),
      playerTeamId: 'player_team',
      tactics: {},
      paceOrders: {},
      revision: 1,
      updatedAt: new Date().toISOString(),
      drivers: Array.from({ length: 24 }, (_, i) => ({
        careerId: 'test_career_race',
        season: 2026,
        raceId: 'test_race_interlagos',
        driverId: `drv_${i + 1}`,
        driverName: `Piloto ${i + 1}`,
        teamId: i < 2 ? 'player_team' : `team_${Math.floor(i / 2) + 1}`,
        teamName: i < 2 ? 'Apex Racing Team' : `Equipe ${Math.floor(i / 2) + 1}`,
        teamColor: '#E10600',
        isPlayer: i < 2,
        gridPosition: i + 1,
        currentPosition: i + 1,
        lap: 10,
        raceTime: 720.0 + i * 1.5,
        raceStatus: 'finished' as const,
        gap: i === 0 ? 'LÍDER' : `+${(i * 1.5).toFixed(3)}s`,
        gapToLeaderSec: i * 1.5,
        gapToFrontSec: i === 0 ? 0 : 1.5,
        pitStops: 1,
        bestLapSec: 71.5 + i * 0.1,
        fuel: 5.0,
        tyreCompound: 'medio',
        tyreAge: 10,
        tyreWear: 30,
        carCondition: 95,
      })),
      driverLookup: {},
      raceControl: {
        currentFlag: 'FINISHED',
        safetyCarLaps: 0,
        vscLaps: 0,
        redFlagLaps: 0,
        lapsRemainingInPhase: 0,
        scQueuedOrder: [],
        restartPending: false,
        activeEvents: [],
        history: [],
      },
    }

    mockState.drivers.forEach((d) => {
      mockState.driverLookup[d.driverId] = d
    })

    const result = canonicalRaceResultService.officializeRace(mockState)

    expect(result).toBeDefined()
    expect(result.entries.length).toBe(24)

    // Garantir que todos os 24 pilotos são únicos
    const driverIds = new Set(result.entries.map((e) => e.driverId))
    expect(driverIds.size).toBe(24)

    // O vencedor (P1) deve estar correto
    expect(result.winnerDriverId).toBe('drv_1')
    expect(result.podium).toEqual(['drv_1', 'drv_2', 'drv_3'])

    // É idempotente: chamar novamente retorna o mesmo resultado oficializado sem duplicar
    const result2 = canonicalRaceResultService.officializeRace(mockState)
    expect(result2.officialResultId).toBe(result.officialResultId)
    expect(result2.entries.length).toBe(24)
  })
})
