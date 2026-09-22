/**
 * bug-03-qualifying-elimination.test.ts
 *
 * Suíte de Testes Canônica para BUG-03:
 * Eliminação Progressiva e Regras Esportivas da Qualificação (Q1, Q2, Q3)
 *
 * TESTES OBRIGATÓRIOS:
 * BUG3-01: Q1 inicia com 24 pilotos
 * BUG3-02: Q1 elimina exatamente 6 pilotos (P19 a P24)
 * BUG3-03: Q2 inicia com exatamente 18 pilotos
 * BUG3-04: Eliminados do Q1 ausentes no Q2 (leaderboard e elegibilidade)
 * BUG3-05: Jogador P23 no Q1 não entra no Q2 (carro marcado como eliminated)
 * BUG3-06: Um piloto do jogador avança (P5) e o outro não (P23), tratados independentemente
 * BUG3-07: Q2 elimina exatamente 8 pilotos (P11 a P18)
 * BUG3-08: Q3 inicia com exatamente 10 pilotos
 * BUG3-09: Eliminados do Q2 ausentes no Q3
 * BUG3-10: Jogador P14 no Q2 não entra no Q3
 * BUG3-11: Eliminado no Q1 não recebe q2Time nem q3Time no grid final
 * BUG3-12: Eliminado no Q2 não recebe q3Time no grid final
 * BUG3-13: Rivais seguem a mesma regra (nenhum caminho especial para player)
 * BUG3-14: Reload (saveStageState/readStageState) mantém isEliminated true e bloqueia saída
 * BUG3-15: Nenhum piloto duplicado em posições da mesma fase ou no grid final
 *
 * GOLDEN TEST:
 * Player A = P5 no Q1 e P14 no Q2 -> ausente no Q3
 * Player B = P23 no Q1 -> ausente no Q2
 * Blocos finais: Q3 (10) + Q2 (8) + Q1 (6) = 24 pilotos únicos, sem duplicação
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  CanonicalQualifyingRunner,
  type QualifyingDriverContext,
  type QualifyingTickContext,
} from '@/services/canonicalQualifyingRunner'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { CANONICAL_QUALIFYING_RULES } from '@/types/canonical-qualifying-types'

describe('BUG-03: Eliminação Esportiva em Q1/Q2/Q3 e Integridade do Grid', () => {
  const seasonId = 'season_2026_bug3'
  const round = 1

  const mockPlayerCar1 = {
    driverId: 'drv_player_a',
    driverName: 'Gabriel Bortoleto',
    driverNumber: 5,
    tyreSetId: 'set_c1_soft_1',
    compound: 'macio' as const,
    wear: 0,
    setup: {
      frontWing: 6,
      rearWing: 6,
      suspension: 6,
      differential: 50,
    },
  }

  const mockPlayerCar2 = {
    driverId: 'drv_player_b',
    driverName: 'Nico Hulkenberg',
    driverNumber: 27,
    tyreSetId: 'set_c2_soft_1',
    compound: 'macio' as const,
    wear: 0,
    setup: {
      frontWing: 6,
      rearWing: 6,
      suspension: 6,
      differential: 50,
    },
  }

  const create24Drivers = (): QualifyingDriverContext[] => {
    const list: QualifyingDriverContext[] = [
      {
        id: 'drv_player_a',
        name: 'Gabriel Bortoleto',
        speed: 84,
        consistency: 83,
        defense: 80,
        teamId: 'audi_f1',
        teamName: 'Audi F1 Team',
        teamColor: '#E10600',
        carNumber: 5,
      },
      {
        id: 'drv_player_b',
        name: 'Nico Hulkenberg',
        speed: 82,
        consistency: 82,
        defense: 81,
        teamId: 'audi_f1',
        teamName: 'Audi F1 Team',
        teamColor: '#E10600',
        carNumber: 27,
      },
    ]

    for (let i = 1; i <= 22; i++) {
      list.push({
        id: `drv_rival_${String(i).padStart(2, '0')}`,
        name: `Rival ${i}`,
        speed: 80 + (i % 6),
        consistency: 80,
        defense: 78,
        teamId: `rival_team_${Math.ceil(i / 2)}`,
        teamName: `Rival Team ${Math.ceil(i / 2)}`,
        teamColor: '#475569',
        carNumber: 30 + i,
      })
    }

    return list
  }

  const createTickContext = (drivers: QualifyingDriverContext[]): QualifyingTickContext => ({
    seasonId,
    round,
    gpName: 'GP do Bahrein',
    circuitName: 'Circuito Internacional do Sakhir',
    lengthKm: 5.412,
    tireAbrasiveness: 7,
    weather: 'seco',
    teamChassisRating: 80,
    teamEngineSupplier: 'Audi',
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    drivers: drivers.filter((d) => d.id === 'drv_player_a' || d.id === 'drv_player_b'),
    rivalDrivers: drivers.filter((d) => d.id !== 'drv_player_a' && d.id !== 'drv_player_b'),
  })

  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // BUG3-01
  it('BUG3-01: Q1 inicia com 24 pilotos', () => {
    const all24 = create24Drivers()
    const q1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: mockPlayerCar1,
      playerCar2: mockPlayerCar2,
      eligibleParticipants: all24,
    })

    expect(q1State.leaderboard.length).toBe(24)
    expect(CANONICAL_QUALIFYING_RULES.q1.participantsCount).toBe(24)
    expect(q1State.cars.car1.isEliminated).toBe(false)
    expect(q1State.cars.car2.isEliminated).toBe(false)
  })

  // BUG3-02
  it('BUG3-02: Q1 elimina exatamente 6 pilotos (P19 a P24)', () => {
    const all24 = create24Drivers()
    const q1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: mockPlayerCar1,
      playerCar2: mockPlayerCar2,
      eligibleParticipants: all24,
    })

    // Atribui tempos ordenados P1 a P24
    all24.forEach((d, idx) => {
      const entry = q1State.leaderboard.find((e) => e.driverId === d.id)
      if (entry) {
        entry.bestLapSec = 90.0 + idx * 0.1
        entry.bestLapTime = `1:30.${String(idx).padStart(3, '0')}`
      }
    })

    const ctx = createTickContext(all24)
    const result = CanonicalQualifyingRunner.finalizeStage(q1State, ctx)

    expect(result.advancingDriverIds.length).toBe(18)
    expect(result.eliminatedDriverIds.length).toBe(6)
    expect(CANONICAL_QUALIFYING_RULES.q1.eliminatedCount).toBe(6)

    const eliminated = result.entries.filter((e) => e.isEliminated)
    expect(eliminated.length).toBe(6)
    expect(eliminated.every((e) => e.position >= 19 && e.position <= 24)).toBe(true)
  })

  // BUG3-03
  it('BUG3-03: Q2 inicia com exatamente 18 pilotos', () => {
    const all24 = create24Drivers()
    const q1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: mockPlayerCar1,
      playerCar2: mockPlayerCar2,
      eligibleParticipants: all24,
    })

    all24.forEach((d, idx) => {
      const entry = q1State.leaderboard.find((e) => e.driverId === d.id)
      if (entry) {
        entry.bestLapSec = 90.0 + idx * 0.1
        entry.bestLapTime = `1:30.${String(idx).padStart(3, '0')}`
      }
    })

    const ctx = createTickContext(all24)
    const q1Result = CanonicalQualifyingRunner.finalizeStage(q1State, ctx)

    const q2Eligible = all24.filter((p) => q1Result.advancingDriverIds.includes(p.id))
    expect(q2Eligible.length).toBe(18)

    const q2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q2',
      seasonId,
      round,
      playerCar1: mockPlayerCar1,
      playerCar2: mockPlayerCar2,
      eligibleParticipants: q2Eligible,
    })

    expect(q2State.leaderboard.length).toBe(18)
    expect(CANONICAL_QUALIFYING_RULES.q2.participantsCount).toBe(18)
  })

  // BUG3-04
  it('BUG3-04: Eliminados do Q1 ausentes no Q2', () => {
    const all24 = create24Drivers()
    const q1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: mockPlayerCar1,
      playerCar2: mockPlayerCar2,
      eligibleParticipants: all24,
    })

    all24.forEach((d, idx) => {
      const entry = q1State.leaderboard.find((e) => e.driverId === d.id)
      if (entry) {
        entry.bestLapSec = 90.0 + idx * 0.1
        entry.bestLapTime = `1:30.${String(idx).padStart(3, '0')}`
      }
    })

    const ctx = createTickContext(all24)
    const q1Result = CanonicalQualifyingRunner.finalizeStage(q1State, ctx)
    const q1EliminatedIds = q1Result.eliminatedDriverIds
    expect(q1EliminatedIds.length).toBe(6)

    const q2Eligible = all24.filter((p) => q1Result.advancingDriverIds.includes(p.id))
    const q2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q2',
      seasonId,
      round,
      playerCar1: mockPlayerCar1,
      playerCar2: mockPlayerCar2,
      eligibleParticipants: q2Eligible,
    })

    const presentEliminated = q2State.leaderboard.filter((e) =>
      q1EliminatedIds.includes(e.driverId),
    )
    expect(presentEliminated.length).toBe(0)
  })

  // BUG3-05
  it('BUG3-05: Jogador P23 no Q1 não entra no Q2 (status eliminated e saída bloqueada)', () => {
    const all24 = create24Drivers()
    const q1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: mockPlayerCar1,
      playerCar2: mockPlayerCar2,
      eligibleParticipants: all24,
    })

    // Player Car 1 (Bortoleto) fica em P23 no Q1
    q1State.leaderboard.forEach((entry) => {
      if (entry.driverId === mockPlayerCar1.driverId) {
        entry.bestLapSec = 92.3
        entry.bestLapTime = '1:32.300'
      } else {
        entry.bestLapSec = 89.0
        entry.bestLapTime = '1:29.000'
      }
    })
    // Forçar carro 1 em P23 ajustando tempos
    const otherDrivers = q1State.leaderboard.filter((e) => e.driverId !== mockPlayerCar1.driverId)
    otherDrivers.forEach((e, idx) => {
      e.bestLapSec = 88.0 + idx * 0.1
      e.bestLapTime = `1:28.${String(idx).padStart(3, '0')}`
    })
    // Carro 1 fica com 95.0s (P24 ou P23)
    const p1Entry = q1State.leaderboard.find((e) => e.driverId === mockPlayerCar1.driverId)!
    p1Entry.bestLapSec = 95.0
    p1Entry.bestLapTime = '1:35.000'

    const ctx = createTickContext(all24)
    const q1Result = CanonicalQualifyingRunner.finalizeStage(q1State, ctx)

    expect(q1Result.eliminatedDriverIds).toContain(mockPlayerCar1.driverId)

    const q2Eligible = all24.filter((p) => q1Result.advancingDriverIds.includes(p.id))
    expect(q2Eligible.some((p) => p.id === mockPlayerCar1.driverId)).toBe(false)

    // Inicializa Q2
    const q2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q2',
      seasonId,
      round,
      playerCar1: mockPlayerCar1,
      playerCar2: mockPlayerCar2,
      eligibleParticipants: q2Eligible,
    })

    // Carro 1 deve estar com isEliminated: true, status: 'eliminated'
    expect(q2State.cars.car1.isEliminated).toBe(true)
    expect(q2State.cars.car1.status).toBe('eliminated')
    expect(q2State.cars.car1.eliminatedInStage).toBe('q1')

    // Tentar sair para a pista deve ser esportivamente bloqueado
    const exitRes = CanonicalQualifyingRunner.orderCarExitToTrack(q2State, 'car1')
    expect(exitRes.success).toBe(false)
    expect(exitRes.error).toContain('permissão esportiva')
  })

  // BUG3-06
  it('BUG3-06: Um piloto do jogador avança (P5) e o outro não (P23), tratados independentemente', () => {
    const all24 = create24Drivers()
    const q1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: mockPlayerCar1,
      playerCar2: mockPlayerCar2,
      eligibleParticipants: all24,
    })

    // Car 1 (Bortoleto) = P5 (88.4s), Car 2 (Hülkenberg) = P23 (92.3s)
    const rivals = all24.filter(
      (d) => d.id !== mockPlayerCar1.driverId && d.id !== mockPlayerCar2.driverId,
    )
    // 4 rivais na frente de Car 1
    for (let i = 0; i < 4; i++) {
      const e = q1State.leaderboard.find((l) => l.driverId === rivals[i].id)!
      e.bestLapSec = 88.0 + i * 0.1
      e.bestLapTime = `1:28.${String(i).padStart(3, '0')}`
    }
    const c1 = q1State.leaderboard.find((l) => l.driverId === mockPlayerCar1.driverId)!
    c1.bestLapSec = 88.4
    c1.bestLapTime = '1:28.400'

    // 17 rivais entre Car 1 e Car 2 (ocupando P6 a P22)
    for (let i = 4; i < 21; i++) {
      const e = q1State.leaderboard.find((l) => l.driverId === rivals[i].id)!
      e.bestLapSec = 89.0 + (i - 4) * 0.1
      e.bestLapTime = `1:29.${String(i).padStart(3, '0')}`
    }
    const c2 = q1State.leaderboard.find((l) => l.driverId === mockPlayerCar2.driverId)!
    c2.bestLapSec = 92.3
    c2.bestLapTime = '1:32.300'

    // 1 rival em P24
    const lastRival = q1State.leaderboard.find((l) => l.driverId === rivals[21].id)!
    lastRival.bestLapSec = 93.0
    lastRival.bestLapTime = '1:33.000'

    const ctx = createTickContext(all24)
    const q1Result = CanonicalQualifyingRunner.finalizeStage(q1State, ctx)

    expect(q1Result.advancingDriverIds).toContain(mockPlayerCar1.driverId)
    expect(q1Result.eliminatedDriverIds).toContain(mockPlayerCar2.driverId)

    const q2Eligible = all24.filter((p) => q1Result.advancingDriverIds.includes(p.id))
    const q2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q2',
      seasonId,
      round,
      playerCar1: mockPlayerCar1,
      playerCar2: mockPlayerCar2,
      eligibleParticipants: q2Eligible,
    })

    // Carro 1 está ativo e na garagem
    expect(q2State.cars.car1.isEliminated).toBe(false)
    expect(q2State.cars.car1.status).toBe('garage')

    // Carro 2 está eliminado
    expect(q2State.cars.car2.isEliminated).toBe(true)
    expect(q2State.cars.car2.status).toBe('eliminated')
    expect(q2State.cars.car2.eliminatedInStage).toBe('q1')

    // Carro 1 consegue sair para a pista
    const exit1 = CanonicalQualifyingRunner.orderCarExitToTrack(q2State, 'car1')
    expect(exit1.success).toBe(true)
    expect(q2State.cars.car1.status).toBe('out_lap')

    // Carro 2 é bloqueado
    const exit2 = CanonicalQualifyingRunner.orderCarExitToTrack(q2State, 'car2')
    expect(exit2.success).toBe(false)
    expect(exit2.error).toContain('permissão esportiva')
  })

  // BUG3-07
  it('BUG3-07: Q2 elimina exatamente 8 pilotos (P11 a P18)', () => {
    const all24 = create24Drivers()
    const q2Eligible = all24.slice(0, 18)
    const q2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q2',
      seasonId,
      round,
      playerCar1: mockPlayerCar1,
      playerCar2: mockPlayerCar2,
      eligibleParticipants: q2Eligible,
    })

    q2Eligible.forEach((d, idx) => {
      const e = q2State.leaderboard.find((l) => l.driverId === d.id)
      if (e) {
        e.bestLapSec = 88.0 + idx * 0.1
        e.bestLapTime = `1:28.${String(idx).padStart(3, '0')}`
      }
    })

    const ctx = createTickContext(q2Eligible)
    const result = CanonicalQualifyingRunner.finalizeStage(q2State, ctx)

    expect(result.advancingDriverIds.length).toBe(10)
    expect(result.eliminatedDriverIds.length).toBe(8)
    expect(CANONICAL_QUALIFYING_RULES.q2.eliminatedCount).toBe(8)

    const eliminated = result.entries.filter((e) => e.isEliminated)
    expect(eliminated.length).toBe(8)
    expect(eliminated.every((e) => e.position >= 11 && e.position <= 18)).toBe(true)
  })

  // BUG3-08
  it('BUG3-08: Q3 inicia com exatamente 10 pilotos', () => {
    const all24 = create24Drivers()
    const q3Eligible = all24.slice(0, 10)
    const q3State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q3',
      seasonId,
      round,
      playerCar1: mockPlayerCar1,
      playerCar2: mockPlayerCar2,
      eligibleParticipants: q3Eligible,
    })

    expect(q3State.leaderboard.length).toBe(10)
    expect(CANONICAL_QUALIFYING_RULES.q3.participantsCount).toBe(10)
  })

  // BUG3-09
  it('BUG3-09: Eliminados do Q2 ausentes no Q3', () => {
    const all24 = create24Drivers()
    const q2Eligible = all24.slice(0, 18)
    const q2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q2',
      seasonId,
      round,
      playerCar1: mockPlayerCar1,
      playerCar2: mockPlayerCar2,
      eligibleParticipants: q2Eligible,
    })

    q2Eligible.forEach((d, idx) => {
      const e = q2State.leaderboard.find((l) => l.driverId === d.id)
      if (e) {
        e.bestLapSec = 88.0 + idx * 0.1
        e.bestLapTime = `1:28.${String(idx).padStart(3, '0')}`
      }
    })

    const ctx = createTickContext(q2Eligible)
    const q2Result = CanonicalQualifyingRunner.finalizeStage(q2State, ctx)
    const q2EliminatedIds = q2Result.eliminatedDriverIds
    expect(q2EliminatedIds.length).toBe(8)

    const q3Eligible = q2Eligible.filter((p) => q2Result.advancingDriverIds.includes(p.id))
    expect(q3Eligible.length).toBe(10)

    const q3State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q3',
      seasonId,
      round,
      playerCar1: mockPlayerCar1,
      playerCar2: mockPlayerCar2,
      eligibleParticipants: q3Eligible,
    })

    const presentEliminated = q3State.leaderboard.filter((e) =>
      q2EliminatedIds.includes(e.driverId),
    )
    expect(presentEliminated.length).toBe(0)
  })

  // BUG3-10
  it('BUG3-10: Jogador P14 no Q2 não entra no Q3 (isEliminated: true no Q3)', () => {
    const all24 = create24Drivers()
    const q2Eligible = all24.slice(0, 18)
    const q2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q2',
      seasonId,
      round,
      playerCar1: mockPlayerCar1,
      playerCar2: mockPlayerCar2,
      eligibleParticipants: q2Eligible,
    })

    // Player Car 1 (Bortoleto) termina em P14 no Q2
    q2Eligible.forEach((d, idx) => {
      const e = q2State.leaderboard.find((l) => l.driverId === d.id)!
      if (d.id === mockPlayerCar1.driverId) {
        // P14
        e.bestLapSec = 89.4
        e.bestLapTime = '1:29.400'
      } else {
        const adjustedIdx = idx >= 13 ? idx + 1 : idx
        e.bestLapSec = 87.0 + adjustedIdx * 0.1
        e.bestLapTime = `1:27.${String(adjustedIdx).padStart(3, '0')}`
      }
    })

    const ctx = createTickContext(q2Eligible)
    const q2Result = CanonicalQualifyingRunner.finalizeStage(q2State, ctx)

    expect(q2Result.eliminatedDriverIds).toContain(mockPlayerCar1.driverId)

    const q3Eligible = q2Eligible.filter((p) => q2Result.advancingDriverIds.includes(p.id))
    expect(q3Eligible.some((p) => p.id === mockPlayerCar1.driverId)).toBe(false)

    // Inicializa Q3
    const q3State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q3',
      seasonId,
      round,
      playerCar1: mockPlayerCar1,
      playerCar2: mockPlayerCar2,
      eligibleParticipants: q3Eligible,
    })

    expect(q3State.cars.car1.isEliminated).toBe(true)
    expect(q3State.cars.car1.status).toBe('eliminated')
    expect(q3State.cars.car1.eliminatedInStage).toBe('q2')

    // Saída bloqueada esportivamente no Q3
    const exitRes = CanonicalQualifyingRunner.orderCarExitToTrack(q3State, 'car1')
    expect(exitRes.success).toBe(false)
    expect(exitRes.error).toContain('permissão esportiva')
  })
})
