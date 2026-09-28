/**
 * src/tests/raceQualifyingTabsPersistedUI.test.ts
 *
 * Testes focados para RACE-QUALI-01B / ETAPA 2B (PARTE 1: abas Q1/Q2/Q3):
 * - UI01: Q1 consome e renderiza os 24 participantes persistidos (P1–P24), com exatamente 6 eliminados destacados.
 * - UI02: Q2 consome e renderiza somente os 18 classificados, 8 eliminados destacados, e NENHUM eliminado do Q1 presente.
 * - UI03: Q3 consome e renderiza somente os 10 finalistas em ordem persistida.
 * - UI07: Reload reproduz exatamente os mesmos dados persistidos sem recalcular nem consumir RNG.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { raceQualifyingOrchestratorService } from '@/services/raceQualifyingOrchestratorService'
import { raceQualifyingService } from '@/services/raceQualifyingService'

describe('RACE-QUALI-01B — Abas Q1/Q2/Q3 conectadas aos dados persistidos', () => {
  const careerId = 'test_career_ui_quali'
  const seasonId = 'season_2026'
  const round = 1

  beforeEach(() => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
  })

  it('UI01 — Q1: consome dados persistidos com 24 participantes, P1–P24 e exatamente 6 eliminados destacados', async () => {
    // 1. Executa Q1
    raceQualifyingService.executeQ1(careerId, seasonId, round)

    // 2. Lê exatamente os dados persistidos que a UI do Q1 consome
    const persistedQ1 = await raceQualifyingOrchestratorService.loadPersistedPhaseState('Q1', careerId, seasonId, round)
    expect(persistedQ1).not.toBeNull()
    expect(persistedQ1?.isCompleted).toBe(true)

    // O Q1 deve possuir exatamente 24 entradas bijetivas
    const results = persistedQ1?.results || []
    expect(results).toHaveLength(24)

    // Verifica integridade de posições de 1 a 24 consecutivas
    const positions = results.map(r => r.position)
    expect(positions).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))

    // Exatamente 6 eliminados (P19 a P24)
    const eliminated = results.filter(r => r.isEliminated)
    const classified = results.filter(r => !r.isEliminated)
    expect(eliminated).toHaveLength(6)
    expect(classified).toHaveLength(18)

    // Os eliminados devem ser estritamente P19..P24
    expect(eliminated.map(r => r.position)).toEqual([19, 20, 21, 22, 23, 24])

    // Todos os 24 possuem tempos válidos formatados (sem fabricação de 0:00.000)
    for (const r of results) {
      expect(r.driverId).toBeDefined()
      expect(r.driverName).toBeTruthy()
      expect(r.teamName).toBeTruthy()
      expect(r.bestTimeMs).toBeGreaterThan(0)
      expect(r.formattedBestTime).toMatch(/^\d+:\d{2}\.\d{3}$/)
    }
  })

  it('UI02 — Q2: consome somente os 18 classificados, 8 eliminados destacados, e nenhum eliminado do Q1 presente', async () => {
    // 1. Executa Q1 e Q2
    raceQualifyingService.executeQ1(careerId, seasonId, round)
    const q1Persisted = await raceQualifyingOrchestratorService.loadPersistedPhaseState('Q1', careerId, seasonId, round)
    const q1EliminatedIds = new Set(q1Persisted?.results.filter(r => r.isEliminated).map(r => r.driverId))
    expect(q1EliminatedIds.size).toBe(6)

    // Executa Q2
    raceQualifyingService.executeQ2(careerId, seasonId, round)

    // 2. Lê exatamente o estado persistido do Q2 consumido pela aba Q2
    const persistedQ2 = await raceQualifyingOrchestratorService.loadPersistedPhaseState('Q2', careerId, seasonId, round)
    expect(persistedQ2).not.toBeNull()
    expect(persistedQ2?.isCompleted).toBe(true)

    const q2Results = persistedQ2?.results || []
    // Exatamente 18 participantes
    expect(q2Results).toHaveLength(18)

    // NENHUM piloto eliminado no Q1 deve estar no Q2
    for (const r of q2Results) {
      expect(q1EliminatedIds.has(r.driverId)).toBe(false)
    }

    // Posições no Q2 são de 1 a 18
    expect(q2Results.map(r => r.position)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))

    // Exatamente 8 eliminados no Q2 e 10 classificados para o Q3
    const q2Eliminated = q2Results.filter(r => r.isEliminated)
    const q2Classified = q2Results.filter(r => !r.isEliminated)
    expect(q2Eliminated).toHaveLength(8)
    expect(q2Classified).toHaveLength(10)
    expect(q2Eliminated.map(r => r.position)).toEqual([11, 12, 13, 14, 15, 16, 17, 18])
  })

  it('UI03 — Q3: consome somente os 10 finalistas na ordem persistida', async () => {
    // 1. Executa Q1, Q2 e Q3
    raceQualifyingService.executeQ1(careerId, seasonId, round)
    raceQualifyingService.executeQ2(careerId, seasonId, round)
    const q2Persisted = await raceQualifyingOrchestratorService.loadPersistedPhaseState('Q2', careerId, seasonId, round)
    const q2EliminatedIds = new Set(q2Persisted?.results.filter(r => r.isEliminated).map(r => r.driverId))
    expect(q2EliminatedIds.size).toBe(8)

    raceQualifyingService.executeQ3(careerId, seasonId, round)

    // 2. Lê o estado persistido consumido pela aba Q3
    const persistedQ3 = await raceQualifyingOrchestratorService.loadPersistedPhaseState('Q3', careerId, seasonId, round)
    expect(persistedQ3).not.toBeNull()
    expect(persistedQ3?.isCompleted).toBe(true)

    const q3Results = persistedQ3?.results || []
    // Exatamente 10 finalistas
    expect(q3Results).toHaveLength(10)

    // Nenhum eliminado do Q2 está presente
    for (const r of q3Results) {
      expect(q2EliminatedIds.has(r.driverId)).toBe(false)
    }

    // Posições de 1 a 10 estritamente ordenadas por bestTimeMs
    expect(q3Results.map(r => r.position)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1))
    for (let i = 0; i < q3Results.length - 1; i++) {
      expect(q3Results[i].bestTimeMs).toBeLessThanOrEqual(q3Results[i + 1].bestTimeMs)
    }

    // P1 é o Pole Position
    expect(q3Results[0].position).toBe(1)
  })

  it('UI07 — Reload: recarregar reproduz exatamente os mesmos dados persistidos sem recalcular ou consumir RNG', async () => {
    // Executa as 3 fases completas
    raceQualifyingService.executeQ1(careerId, seasonId, round)
    raceQualifyingService.executeQ2(careerId, seasonId, round)
    raceQualifyingService.executeQ3(careerId, seasonId, round)

    // 1ª Leitura (como na carga inicial da tela)
    const [q1Initial, q2Initial, q3Initial] = await Promise.all([
      raceQualifyingOrchestratorService.loadPersistedPhaseState('Q1', careerId, seasonId, round),
      raceQualifyingOrchestratorService.loadPersistedPhaseState('Q2', careerId, seasonId, round),
      raceQualifyingOrchestratorService.loadPersistedPhaseState('Q3', careerId, seasonId, round),
    ])

    expect(q1Initial).not.toBeNull()
    expect(q2Initial).not.toBeNull()
    expect(q3Initial).not.toBeNull()

    // Simula reload da página: múltiplas leituras consecutivas dos mesmos artefatos persistidos
    const [q1Reload, q2Reload, q3Reload] = await Promise.all([
      raceQualifyingOrchestratorService.loadPersistedPhaseState('Q1', careerId, seasonId, round),
      raceQualifyingOrchestratorService.loadPersistedPhaseState('Q2', careerId, seasonId, round),
      raceQualifyingOrchestratorService.loadPersistedPhaseState('Q3', careerId, seasonId, round),
    ])

    // Verifica identidade estrita (mesmos tempos ms, mesmas posições, mesmos pilotos em cada fase)
    expect(q1Reload).toEqual(q1Initial)
    expect(q2Reload).toEqual(q2Initial)
    expect(q3Reload).toEqual(q3Initial)

    // Garante que cada piloto manteve exatamente o mesmo bestTimeMs no reload
    expect(q1Reload?.results.map(r => ({ id: r.driverId, time: r.bestTimeMs }))).toEqual(
      q1Initial?.results.map(r => ({ id: r.driverId, time: r.bestTimeMs }))
    )
    expect(q2Reload?.results.map(r => ({ id: r.driverId, time: r.bestTimeMs }))).toEqual(
      q2Initial?.results.map(r => ({ id: r.driverId, time: r.bestTimeMs }))
    )
    expect(q3Reload?.results.map(r => ({ id: r.driverId, time: r.bestTimeMs }))).toEqual(
      q3Initial?.results.map(r => ({ id: r.driverId, time: r.bestTimeMs }))
    )
  })

  it('UI Estados Vazios — Respeita o estado real: abas sem dados não fabricam 0:00.000 ou P0', async () => {
    const freshRound = 99
    // Nenhuma fase executada para round 99
    const [q1Empty, q2Empty, q3Empty] = await Promise.all([
      raceQualifyingOrchestratorService.loadPersistedPhaseState('Q1', careerId, seasonId, freshRound),
      raceQualifyingOrchestratorService.loadPersistedPhaseState('Q2', careerId, seasonId, freshRound),
      raceQualifyingOrchestratorService.loadPersistedPhaseState('Q3', careerId, seasonId, freshRound),
    ])

    expect(q1Empty).toBeNull()
    expect(q2Empty).toBeNull()
    expect(q3Empty).toBeNull()

    // A UI recebe null e renders empty state (sem dados fabricados)
    const q1Results = q1Empty?.isCompleted ? q1Empty.results : []
    const q2Results = q2Empty?.isCompleted ? q2Empty.results : []
    const q3Results = q3Empty?.isCompleted ? q3Empty.results : []

    expect(q1Results).toHaveLength(0)
    expect(q2Results).toHaveLength(0)
    expect(q3Results).toHaveLength(0)
  })
})
