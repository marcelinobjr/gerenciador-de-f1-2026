import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { canonicalQualifyingPersistenceService } from '../services/canonicalQualifyingPersistenceService'
import { CanonicalQualifyingRunner } from '../services/canonicalQualifyingRunner'
import { canonicalRaceInitializationService } from '../services/canonicalRaceInitializationService'
import { resolveEligibleQualifyingDrivers } from '../services/qualifyingParticipantResolver'
import type {
  QualifyingDriverContext,
  QualifyingTickContext,
} from '../services/canonicalQualifyingRunner'
import type {
  QualifyingStageResult,
  CompleteQualifyingWeekendResult,
} from '../types/canonical-qualifying-types'

// Fixture canônica determinística para 24 pilotos inscritos (F1 2026: 12 equipes x 2 pilotos)
function createDeterministic24Entries() {
  return Array.from({ length: 24 }, (_, i) => {
    const num = i + 1
    const teamIdx = Math.floor(i / 2) + 1
    return {
      driverId: `driver_${String(num).padStart(2, '0')}`,
      driverName: `Piloto ${String(num).padStart(2, '0')}`,
      carId: i === 0 ? ('car1' as const) : i === 1 ? ('car2' as const) : undefined,
      isPlayerTeam: i === 0 || i === 1,
      teamId: i < 2 ? 'team_player' : `team_${teamIdx}`,
      teamName: i < 2 ? 'Equipe Jogador' : `Equipe ${teamIdx}`,
      teamColor: i < 2 ? '#E10600' : '#334155',
      driverNumber: num,
    }
  })
}

function createDummyTickContext(
  seasonId: string,
  round: number,
  drivers: QualifyingDriverContext[],
): QualifyingTickContext {
  return {
    seasonId,
    round,
    gpName: 'Grande Prêmio de São Paulo Sprint',
    circuitName: 'Autódromo de Interlagos',
    lengthKm: 4.309,
    tireAbrasiveness: 3,
    weather: 'seco' as const,
    teamChassisRating: 80,
    teamEngineSupplier: 'Audi',
    teamName: 'Equipe Jogador',
    teamColor: '#E10600',
    teamId: 'team_player',
    drivers: drivers.slice(0, 2),
    rivalDrivers: drivers.slice(2),
  }
}

describe('SPRINT-GRID-01 — SQ3 → GRID FINAL DA CORRIDA SPRINT', () => {
  const TEST_SEASON_ID = 'season_sprint_grid_01'
  const TEST_ROUND = 5
  const TEST_CAREER_ID = 'career_sprint_grid_01'

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // -------------------------------------------------------------------------
  // 1. OBJETIVO & TESTE PRINCIPAL — SQ3 → GRID
  // Prova que SQ3 concluída -> buildSprintGridFromSQ3Result -> P1-P10 = ordem da SQ3
  // -------------------------------------------------------------------------
  it('1. SQ3 concluída -> buildSprintGridFromSQ3Result: P1–P10 exatamente iguais à classificação da SQ3 com IDs, ordem e tempos canônicos', () => {
    const rawEntries = createDeterministic24Entries()

    // 1. Simula SQ1 concluída com 24 pilotos (top 18 avançam, 6 eliminados: driver_19..24)
    const sq1Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    const sq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 01',
        driverNumber: 1,
        tyreSetId: 't1',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 02',
        driverNumber: 2,
        tyreSetId: 't2',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq1Participants,
      persistState: false,
    })

    // Tempos SQ1: driver_01 até driver_24 com tempos crescentes (driver_01 mais rápido)
    sq1State.leaderboard = sq1Participants.map((p, idx) => {
      const bestLapSec = 75.0 + idx * 0.1
      return {
        position: idx + 1,
        driverId: p.id,
        driverName: p.name,
        teamId: p.teamId || 'team',
        teamName: p.teamName || 'Equipe',
        teamColor: p.teamColor || '#334155',
        carNumber: p.carNumber || idx + 1,
        compound: 'macio' as const,
        laps: 2,
        bestLapSec,
        bestLapTime: `${Math.floor(bestLapSec / 60)}:${(bestLapSec % 60).toFixed(3).padStart(6, '0')}`,
        bestLapRecordedAtSec: idx * 5,
        gap: '+0.000',
        isPlayer: p.id === 'driver_01' || p.id === 'driver_02',
        carId:
          p.id === 'driver_01'
            ? ('car1' as const)
            : p.id === 'driver_02'
              ? ('car2' as const)
              : undefined,
        status: 'garage' as const,
        isEliminated: false,
      }
    })

    const tickCtx = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq1Participants)
    CanonicalQualifyingRunner.finalizeStage(sq1State, tickCtx, { persistState: true })

    // 2. Simula SQ2 concluída com 18 pilotos (top 10 avançam, 8 eliminados: driver_11..18)
    const sq2Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })
    expect(sq2Participants).toHaveLength(18)

    const sq2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 01',
        driverNumber: 1,
        tyreSetId: 't3',
        compound: 'macio',
        wear: 10,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 02',
        driverNumber: 2,
        tyreSetId: 't4',
        compound: 'macio',
        wear: 10,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq2Participants,
      persistState: false,
    })

    sq2State.leaderboard = sq2Participants.map((p, idx) => {
      const bestLapSec = 74.0 + idx * 0.1
      return {
        position: idx + 1,
        driverId: p.id,
        driverName: p.name,
        teamId: p.teamId || 'team',
        teamName: p.teamName || 'Equipe',
        teamColor: p.teamColor || '#334155',
        carNumber: p.carNumber || idx + 1,
        compound: 'macio' as const,
        laps: 2,
        bestLapSec,
        bestLapTime: `${Math.floor(bestLapSec / 60)}:${(bestLapSec % 60).toFixed(3).padStart(6, '0')}`,
        bestLapRecordedAtSec: idx * 5,
        gap: '+0.000',
        isPlayer: p.id === 'driver_01' || p.id === 'driver_02',
        carId:
          p.id === 'driver_01'
            ? ('car1' as const)
            : p.id === 'driver_02'
              ? ('car2' as const)
              : undefined,
        status: 'garage' as const,
        isEliminated: false,
      }
    })

    CanonicalQualifyingRunner.finalizeStage(sq2State, tickCtx, { persistState: true })

    // 3. Simula SQ3 com 10 participantes, mas com ordem final determinística específica:
    // driver_07 crava a pole (72.000s), seguido por driver_03, driver_01, driver_10, etc.
    const sq3Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })
    expect(sq3Participants).toHaveLength(10)

    const sq3State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 01',
        driverNumber: 1,
        tyreSetId: 't5',
        compound: 'macio',
        wear: 20,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 02',
        driverNumber: 2,
        tyreSetId: 't6',
        compound: 'macio',
        wear: 20,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq3Participants,
      persistState: false,
    })

    const sq3CustomOrder = [
      { id: 'driver_07', time: 72.0 },
      { id: 'driver_03', time: 72.2 },
      { id: 'driver_01', time: 72.3 },
      { id: 'driver_10', time: 72.4 },
      { id: 'driver_05', time: 72.5 },
      { id: 'driver_02', time: 72.6 },
      { id: 'driver_04', time: 72.7 },
      { id: 'driver_08', time: 72.8 },
      { id: 'driver_06', time: 72.9 },
      { id: 'driver_09', time: 73.0 },
    ]

    sq3State.leaderboard = sq3CustomOrder.map((item, idx) => {
      const p = sq3Participants.find((x) => x.id === item.id)!
      return {
        position: idx + 1,
        driverId: item.id,
        driverName: p.name,
        teamId: p.teamId || 'team',
        teamName: p.teamName || 'Equipe',
        teamColor: p.teamColor || '#334155',
        carNumber: p.carNumber || idx + 1,
        compound: 'macio' as const,
        laps: 2,
        bestLapSec: item.time,
        bestLapTime: `${Math.floor(item.time / 60)}:${(item.time % 60).toFixed(3).padStart(6, '0')}`,
        bestLapRecordedAtSec: idx * 10,
        gap: idx === 0 ? '+0.000' : `+${(item.time - 72.0).toFixed(3)}`,
        isPlayer: item.id === 'driver_01' || item.id === 'driver_02',
        carId:
          item.id === 'driver_01'
            ? ('car1' as const)
            : item.id === 'driver_02'
              ? ('car2' as const)
              : undefined,
        status: 'garage' as const,
        isEliminated: false,
      }
    })

    const sq3FinalResult = CanonicalQualifyingRunner.finalizeStage(sq3State, tickCtx, {
      persistState: true,
    })
    expect(sq3FinalResult.stageId).toBe('sq3')
    expect(sq3FinalResult.entries).toHaveLength(10)

    // 4. Executa a função canônica buildSprintGridFromSQ3Result
    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      TEST_SEASON_ID,
      TEST_ROUND,
    )

    expect(sprintGrid).not.toBeNull()
    expect(sprintGrid!.poleDriverId).toBe('driver_07')
    expect(sprintGrid!.poleDriverName).toBe('Piloto 07')
    expect(sprintGrid!.finalGrid).toHaveLength(24)

    // Validar explicitamente P1–P10 exatamente iguais à classificação da SQ3
    for (let pos = 1; pos <= 10; pos++) {
      const gridEntry = sprintGrid!.finalGrid[pos - 1]
      const expectedDriverId = sq3CustomOrder[pos - 1].id
      expect(gridEntry.gridPosition).toBe(pos)
      expect(gridEntry.driverId).toBe(expectedDriverId)
      expect(gridEntry.eliminationStage).toBe('Q3')
      expect(gridEntry.bestLapSec).toBe(sq3CustomOrder[pos - 1].time)
    }
  })

  // -------------------------------------------------------------------------
  // 4. GRID COMPLETO DA SPRINT
  // SQ3 define P1–P10, eliminados da SQ2 definem P11–P18, eliminados da SQ1 definem P19–P24
  // -------------------------------------------------------------------------
  it('2. Composição completa do grid da Sprint: P1–P10 (SQ3), P11–P18 (eliminados SQ2), P19–P24 (eliminados SQ1) sem duplicações nem faltas', () => {
    const rawEntries = createDeterministic24Entries()

    // Monta diretamente resultados canônicos para SQ1, SQ2, SQ3
    // SQ1: 24 pilotos. Eliminados: driver_19..driver_24
    const sq1Entries = rawEntries.map((e, idx) => ({
      position: idx + 1,
      driverId: e.driverId,
      driverName: e.driverName,
      teamId: e.teamId,
      teamName: e.teamName,
      teamColor: e.teamColor,
      carNumber: e.driverNumber,
      isPlayer: e.isPlayerTeam,
      carId: e.carId,
      compound: 'macio' as const,
      tyreSetId: `t_sq1_${idx}`,
      lapsCount: 2,
      bestLapSec: 75.0 + idx * 0.1,
      bestLapTime: `1:15.${idx}00`,
      bestLapRecordedAtSec: idx * 5,
      isEliminated: idx >= 18,
    }))
    const sq1Result: QualifyingStageResult = {
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: sq1Entries,
      advancingDriverIds: sq1Entries.slice(0, 18).map((e) => e.driverId),
      eliminatedDriverIds: sq1Entries.slice(18).map((e) => e.driverId),
    }
    canonicalQualifyingPersistenceService.saveStageResult(sq1Result)

    // SQ2: 18 pilotos (driver_01..18).
    // Ordem deliberadamente modificada nos eliminados para testar ordenação canônica por melhor tempo em SQ2
    // Eliminados: driver_11..driver_18, mas com driver_18 marcando tempo melhor que driver_11
    const sq2Entries = sq1Entries.slice(0, 18).map((e, idx) => {
      // Para os eliminados (idx 10..17), inverte os tempos: idx 17 (driver_18) tem tempo menor
      const bestLapSec = idx < 10 ? 73.0 + idx * 0.1 : 74.0 + (17 - idx) * 0.1
      return {
        ...e,
        bestLapSec,
        bestLapTime: `1:13.${idx}00`,
        isEliminated: idx >= 10,
      }
    })
    const sq2Result: QualifyingStageResult = {
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: sq2Entries,
      advancingDriverIds: sq2Entries.slice(0, 10).map((e) => e.driverId),
      eliminatedDriverIds: sq2Entries.slice(10).map((e) => e.driverId),
    }
    canonicalQualifyingPersistenceService.saveStageResult(sq2Result)

    // SQ3: 10 pilotos (driver_01..10).
    const sq3Entries = sq2Entries.slice(0, 10).map((e, idx) => ({
      ...e,
      bestLapSec: 71.0 + idx * 0.1,
      bestLapTime: `1:11.${idx}00`,
      isEliminated: false,
    }))
    const sq3Result: QualifyingStageResult = {
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: sq3Entries,
      advancingDriverIds: sq3Entries.map((e) => e.driverId),
      eliminatedDriverIds: [],
    }
    canonicalQualifyingPersistenceService.saveStageResult(sq3Result)

    // Executa buildSprintGridFromSQ3Result
    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      TEST_SEASON_ID,
      TEST_ROUND,
    )
    expect(sprintGrid).not.toBeNull()
    expect(sprintGrid!.finalGrid).toHaveLength(24)

    // Bijeção estrita: exatamente 24 pilotos únicos
    const driverIdsInGrid = sprintGrid!.finalGrid.map((e) => e.driverId)
    const uniqueDriverIds = new Set(driverIdsInGrid)
    expect(uniqueDriverIds.size).toBe(24)

    // Posições estritamente sequenciais de 1 a 24
    sprintGrid!.finalGrid.forEach((entry, idx) => {
      expect(entry.gridPosition).toBe(idx + 1)
    })

    // Bloco P1–P10 (SQ3)
    const p1To10 = sprintGrid!.finalGrid.slice(0, 10)
    p1To10.forEach((e) => {
      expect(e.eliminationStage).toBe('Q3')
      expect(sq3Result.advancingDriverIds).toContain(e.driverId)
    })

    // Bloco P11–P18 (Eliminados SQ2)
    const p11To18 = sprintGrid!.finalGrid.slice(10, 18)
    p11To18.forEach((e) => {
      expect(e.eliminationStage).toBe('Q2')
      expect(sq2Result.eliminatedDriverIds).toContain(e.driverId)
      // NENHUM piloto que foi para a SQ3 pode aparecer aqui
      expect(sq3Result.advancingDriverIds).not.toContain(e.driverId)
    })
    // Verifica que driver_18 (com tempo 74.0) ficou à frente de driver_11 (tempo 74.7)
    expect(p11To18[0].driverId).toBe('driver_18')
    expect(p11To18[7].driverId).toBe('driver_11')

    // Bloco P19–P24 (Eliminados SQ1)
    const p19To24 = sprintGrid!.finalGrid.slice(18, 24)
    p19To24.forEach((e) => {
      expect(e.eliminationStage).toBe('Q1')
      expect(sq1Result.eliminatedDriverIds).toContain(e.driverId)
      // NENHUM piloto que avançou para SQ2 ou SQ3 pode aparecer aqui
      expect(sq2Result.advancingDriverIds).not.toContain(e.driverId)
      expect(sq2Result.eliminatedDriverIds).not.toContain(e.driverId)
    })
  })

  // -------------------------------------------------------------------------
  // 5. ISOLAMENTO DA CORRIDA PRINCIPAL
  // SQ3 Sprint concluída -> grid Sprint atualizado -> grid da corrida principal inalterado
  // -------------------------------------------------------------------------
  it('3. Isolamento da corrida principal: SQ3 Sprint concluída não sobrescreve nem contamina o grid da corrida principal', () => {
    // 1. Salva grid canônico da corrida principal (ex: Q1..Q3 principal previamente finalizados)
    const mainQualifyingGrid: CompleteQualifyingWeekendResult = {
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      poleDriverId: 'main_pole_driver_99',
      poleDriverName: 'Poleman Principal',
      poleLapTime: '1:10.500',
      q1Result: {} as any,
      q2Result: {} as any,
      q3Result: {} as any,
      finalGrid: [
        {
          gridPosition: 1,
          driverId: 'main_pole_driver_99',
          driverName: 'Poleman Principal',
          teamId: 'team_ferrari',
          teamName: 'Ferrari',
          teamColor: '#FF0000',
          isPlayer: false,
          eliminationStage: 'Q3' as const,
          bestLapSec: 70.5,
          bestLapTime: '1:10.500',
          bestLapCompound: 'macio' as const,
        },
        {
          gridPosition: 2,
          driverId: 'main_p2_driver_88',
          driverName: 'Segundo Principal',
          teamId: 'team_redbull',
          teamName: 'Red Bull',
          teamColor: '#0000FF',
          isPlayer: false,
          eliminationStage: 'Q3' as const,
          bestLapSec: 70.7,
          bestLapTime: '1:10.700',
          bestLapCompound: 'macio' as const,
        },
      ],
    }
    canonicalQualifyingPersistenceService.saveCompleteQualifyingResult(mainQualifyingGrid)

    // 2. Agora simula a conclusão da Qualificação Sprint (SQ3)
    const sq3Entries = [
      {
        position: 1,
        driverId: 'sprint_pole_driver_11',
        driverName: 'Poleman Sprint',
        teamId: 'team_mclaren',
        teamName: 'McLaren',
        teamColor: '#FF8000',
        carNumber: 11,
        isPlayer: false,
        compound: 'macio' as const,
        lapsCount: 2,
        bestLapSec: 71.8,
        bestLapTime: '1:11.800',
        bestLapRecordedAtSec: 30,
        isEliminated: false,
      },
    ]
    const sq3Result: QualifyingStageResult = {
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: sq3Entries,
      advancingDriverIds: ['sprint_pole_driver_11'],
      eliminatedDriverIds: [],
    }
    canonicalQualifyingPersistenceService.saveStageResult(sq3Result)

    // 3. Monta o grid da Sprint via buildSprintGridFromSQ3Result
    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      TEST_SEASON_ID,
      TEST_ROUND,
    )
    expect(sprintGrid).not.toBeNull()
    expect(sprintGrid!.poleDriverId).toBe('sprint_pole_driver_11')

    // 4. Lê o grid da corrida principal via readCompleteQualifyingResult
    const mainGridRead = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
      TEST_SEASON_ID,
      TEST_ROUND,
    )

    // O grid da corrida principal deve permanecer 100% intacto e inalterado
    expect(mainGridRead).not.toBeNull()
    expect(mainGridRead!.poleDriverId).toBe('main_pole_driver_99')
    expect(mainGridRead!.poleDriverName).toBe('Poleman Principal')
    expect(mainGridRead!.finalGrid[0].driverId).toBe('main_pole_driver_99')
    expect(mainGridRead!.finalGrid[0].driverId).not.toBe(sprintGrid!.poleDriverId)
  })

  // -------------------------------------------------------------------------
  // 6. RELOAD / PERSISTÊNCIA
  // Após montar grid Sprint: persistir; recarregar estado; grid idêntico sem re-sorteio
  // -------------------------------------------------------------------------
  it('4. Reload / Persistência: o grid derivado da SQ3 é determinístico e idêntico após recarregamento', () => {
    const rawEntries = createDeterministic24Entries()
    const sq3Entries = rawEntries.slice(0, 10).map((e, idx) => ({
      position: idx + 1,
      driverId: e.driverId,
      driverName: e.driverName,
      teamId: e.teamId,
      teamName: e.teamName,
      teamColor: e.teamColor,
      carNumber: e.driverNumber,
      isPlayer: e.isPlayerTeam,
      carId: e.carId,
      compound: 'macio' as const,
      lapsCount: 2,
      bestLapSec: 72.0 + idx * 0.1,
      bestLapTime: `1:12.${idx}00`,
      bestLapRecordedAtSec: idx * 10,
      isEliminated: false,
    }))
    const sq3Result: QualifyingStageResult = {
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: '2026-05-10T14:30:00.000Z',
      entries: sq3Entries,
      advancingDriverIds: sq3Entries.map((e) => e.driverId),
      eliminatedDriverIds: [],
    }
    canonicalQualifyingPersistenceService.saveStageResult(sq3Result)

    // Leitura 1 (antes de reload)
    const gridBeforeReload = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      TEST_SEASON_ID,
      TEST_ROUND,
    )

    // Simula reload (lendo do storage após re-instanciação / re-chamada)
    const gridAfterReload = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      TEST_SEASON_ID,
      TEST_ROUND,
    )

    expect(gridBeforeReload).not.toBeNull()
    expect(gridAfterReload).not.toBeNull()
    expect(gridAfterReload!.poleDriverId).toBe(gridBeforeReload!.poleDriverId)
    expect(gridAfterReload!.completedAt).toBe(gridBeforeReload!.completedAt)
    expect(gridAfterReload!.finalGrid.map((e) => e.driverId)).toEqual(
      gridBeforeReload!.finalGrid.map((e) => e.driverId),
    )
    expect(gridAfterReload!.finalGrid.map((e) => e.bestLapSec)).toEqual(
      gridBeforeReload!.finalGrid.map((e) => e.bestLapSec),
    )
    expect(gridAfterReload!.finalGrid.map((e) => e.gridPosition)).toEqual(
      gridBeforeReload!.finalGrid.map((e) => e.gridPosition),
    )
  })

  // -------------------------------------------------------------------------
  // 7. INÍCIO REAL DA CORRIDA SPRINT
  // SQ3 terminou -> grid montado -> Sprint inicializa -> ordem de largada = grid montado
  // -------------------------------------------------------------------------
  it('5. Início real da corrida Sprint: initializeRaceFromCanonicalGrid larga exatamente com o grid construído a partir da SQ3', () => {
    const rawEntries = createDeterministic24Entries()

    // Monta SQ1, SQ2, SQ3 com P1 sendo driver_09
    const sq1Entries = rawEntries.map((e, idx) => ({
      position: idx + 1,
      driverId: e.driverId,
      driverName: e.driverName,
      teamId: e.teamId,
      teamName: e.teamName,
      teamColor: e.teamColor,
      carNumber: e.driverNumber,
      isPlayer: e.isPlayerTeam,
      carId: e.carId,
      compound: 'macio' as const,
      lapsCount: 2,
      bestLapSec: 75.0 + idx * 0.1,
      bestLapTime: `1:15.${idx}00`,
      bestLapRecordedAtSec: idx * 5,
      isEliminated: idx >= 18,
    }))
    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: sq1Entries,
      advancingDriverIds: sq1Entries.slice(0, 18).map((e) => e.driverId),
      eliminatedDriverIds: sq1Entries.slice(18).map((e) => e.driverId),
    })

    const sq2Entries = sq1Entries.slice(0, 18).map((e, idx) => ({
      ...e,
      bestLapSec: 73.0 + idx * 0.1,
      isEliminated: idx >= 10,
    }))
    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: sq2Entries,
      advancingDriverIds: sq2Entries.slice(0, 10).map((e) => e.driverId),
      eliminatedDriverIds: sq2Entries.slice(10).map((e) => e.driverId),
    })

    // Em SQ3, driver_09 faz 71.0s (Pole), driver_01 faz 71.5s
    const sq3Entries = sq2Entries.slice(0, 10).map((e, idx) => ({
      ...e,
      bestLapSec: e.driverId === 'driver_09' ? 71.0 : 72.0 + idx * 0.1,
      bestLapTime: e.driverId === 'driver_09' ? '1:11.000' : `1:12.${idx}00`,
      isEliminated: false,
    }))
    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: sq3Entries,
      advancingDriverIds: sq3Entries.map((e) => e.driverId),
      eliminatedDriverIds: [],
    })

    // 1. Obtém grid da Sprint
    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      TEST_SEASON_ID,
      TEST_ROUND,
    )
    expect(sprintGrid).not.toBeNull()
    expect(sprintGrid!.finalGrid[0].driverId).toBe('driver_09')

    // 2. Inicializa a Corrida Sprint exatamente como WeekendV2Page faz
    const totalSprintLaps = canonicalRaceInitializationService.calculateSprintLaps(4.309, 100, 71)
    const initializedSprintRace =
      canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        raceVariant: 'SPRINT_RACE',
        careerId: TEST_CAREER_ID,
        season: 2026,
        round: TEST_ROUND,
        circuitName: 'Autódromo de Interlagos',
        circuitCountry: 'Brasil',
        totalLaps: totalSprintLaps,
        playerTeamId: 'team_player',
        canonicalQualifyingGrid: sprintGrid!.finalGrid,
        persistState: true,
      })

    // 3. Prova que a corrida Sprint inicializou com a variante correta e com o grid derivado
    expect(initializedSprintRace.raceVariant).toBe('SPRINT_RACE')
    expect(initializedSprintRace.drivers).toHaveLength(24)
    expect(initializedSprintRace.drivers[0].driverId).toBe('driver_09')
    expect(initializedSprintRace.drivers[0].gridPosition).toBe(1)

    // Bijeção exata: ordem dos motoristas na corrida Sprint = ordem do grid construído
    const sprintDriverIdsInSession = initializedSprintRace.drivers.map((d) => d.driverId)
    const expectedGridDriverIds = sprintGrid!.finalGrid.map((g) => g.driverId)
    expect(sprintDriverIdsInSession).toEqual(expectedGridDriverIds)

    // 4. Simula reload da corrida em andamento
    const reloadedSprintRace = canonicalRaceInitializationService.readCanonicalRaceState(
      TEST_CAREER_ID,
      2026,
      TEST_ROUND,
      'SPRINT_RACE',
    )
    expect(reloadedSprintRace).not.toBeNull()
    expect(reloadedSprintRace!.raceVariant).toBe('SPRINT_RACE')
    expect(reloadedSprintRace!.drivers.map((d) => d.driverId)).toEqual(expectedGridDriverIds)
    expect(reloadedSprintRace!.drivers[0].driverId).toBe('driver_09')
  })

  // -------------------------------------------------------------------------
  // 8. CASOS DE INTEGRIDADE & AUSÊNCIA DE SQ3
  // Ausência de SQ3: não usar grid principal como fallback silencioso; retorna null / bloqueia
  // -------------------------------------------------------------------------
  it('6. Casos de integridade: ausência de SQ3 retorna null e NUNCA usa grid principal por fallback silencioso', () => {
    // 1. Simula que a qualificação principal já foi realizada e está salva no storage
    const mainQualifyingGrid: CompleteQualifyingWeekendResult = {
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      poleDriverId: 'driver_main_pole',
      poleDriverName: 'Pole Principal',
      poleLapTime: '1:10.000',
      q1Result: {} as any,
      q2Result: {} as any,
      q3Result: {} as any,
      finalGrid: [
        {
          gridPosition: 1,
          driverId: 'driver_main_pole',
          driverName: 'Pole Principal',
          teamId: 'team_player',
          teamName: 'Equipe Jogador',
          teamColor: '#E10600',
          isPlayer: true,
          eliminationStage: 'Q3' as const,
          bestLapSec: 70.0,
          bestLapTime: '1:10.000',
          bestLapCompound: 'macio' as const,
        },
      ],
    }
    canonicalQualifyingPersistenceService.saveCompleteQualifyingResult(mainQualifyingGrid)

    // Confirma que o grid principal existe no storage
    expect(
      canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
        TEST_SEASON_ID,
        TEST_ROUND,
      ),
    ).not.toBeNull()

    // 2. Consulta o grid da Sprint quando SQ3 AINDA NÃO EXISTE (nem SQ1/SQ2)
    const sprintGridWithoutSQ3 = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      TEST_SEASON_ID,
      TEST_ROUND,
    )

    // REGRA DE OURO: Ausência de SQ3 deve retornar null e NÃO cair no grid da corrida principal
    expect(sprintGridWithoutSQ3).toBeNull()

    // 3. Caso em que SQ3 existe mas entries é vazio:
    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: [],
      advancingDriverIds: [],
      eliminatedDriverIds: [],
    })

    const sprintGridEmptyEntries =
      canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(TEST_SEASON_ID, TEST_ROUND)
    expect(sprintGridEmptyEntries).toBeNull()
  })

  it('7. Casos de integridade: desempate determinístico em SQ3 por bestLapRecordedAtSec', () => {
    // Dois pilotos com tempos idênticos na SQ3: quem registrou primeiro deve ficar na frente
    const sq3Entries = [
      {
        position: 1,
        driverId: 'driver_tied_second',
        driverName: 'Piloto Gravou Depois',
        teamId: 'team_a',
        teamName: 'Team A',
        teamColor: '#111',
        carNumber: 1,
        isPlayer: false,
        compound: 'macio' as const,
        lapsCount: 2,
        bestLapSec: 72.5,
        bestLapTime: '1:12.500',
        bestLapRecordedAtSec: 450, // Registrou no segundo 450
        isEliminated: false,
      },
      {
        position: 2,
        driverId: 'driver_tied_first',
        driverName: 'Piloto Gravou Primeiro',
        teamId: 'team_b',
        teamName: 'Team B',
        teamColor: '#222',
        carNumber: 2,
        isPlayer: false,
        compound: 'macio' as const,
        lapsCount: 2,
        bestLapSec: 72.5,
        bestLapTime: '1:12.500',
        bestLapRecordedAtSec: 200, // Registrou no segundo 200
        isEliminated: false,
      },
    ]

    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: sq3Entries,
      advancingDriverIds: ['driver_tied_first', 'driver_tied_second'],
      eliminatedDriverIds: [],
    })

    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      TEST_SEASON_ID,
      TEST_ROUND,
    )

    expect(sprintGrid).not.toBeNull()
    expect(sprintGrid!.poleDriverId).toBe('driver_tied_first')
    expect(sprintGrid!.finalGrid[0].driverId).toBe('driver_tied_first')
    expect(sprintGrid!.finalGrid[1].driverId).toBe('driver_tied_second')
  })

  // -------------------------------------------------------------------------
  // 8. ISOLAMENTO TOTAL: QUALIFICAÇÃO PRINCIPAL NÃO AFETADA
  // Q1, Q2, Q3 principais continuam intactos e independentes de SQ1, SQ2, SQ3
  // -------------------------------------------------------------------------
  it('8. Isolamento de persistência de estágio: SQ1/SQ2/SQ3 e Q1/Q2/Q3 coexistem na mesma temporada e rodada sem colisão de chaves', () => {
    // 1. Salva Q1 principal
    const q1Result: QualifyingStageResult = {
      stageId: 'q1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: '2026-05-10T16:00:00.000Z',
      entries: [
        {
          position: 1,
          driverId: 'main_q1_p1',
          driverName: 'Q1 Principal P1',
          teamId: 'team_ferrari',
          teamName: 'Ferrari',
          teamColor: '#FF0000',
          bestLapSec: 71.0,
          bestLapTime: '1:11.000',
          bestLapRecordedAtSec: 100,
          compound: 'macio',
          lapsCount: 3,
          isPlayer: false,
          isEliminated: false,
        },
      ],
      advancingDriverIds: ['main_q1_p1'],
      eliminatedDriverIds: [],
    }
    canonicalQualifyingPersistenceService.saveStageResult(q1Result)

    // 2. Salva SQ1 sprint
    const sq1Result: QualifyingStageResult = {
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: '2026-05-09T10:00:00.000Z',
      entries: [
        {
          position: 1,
          driverId: 'sprint_sq1_p1',
          driverName: 'SQ1 Sprint P1',
          teamId: 'team_mclaren',
          teamName: 'McLaren',
          teamColor: '#FF8000',
          bestLapSec: 72.0,
          bestLapTime: '1:12.000',
          bestLapRecordedAtSec: 80,
          compound: 'macio',
          lapsCount: 2,
          isPlayer: false,
          isEliminated: false,
        },
      ],
      advancingDriverIds: ['sprint_sq1_p1'],
      eliminatedDriverIds: [],
    }
    canonicalQualifyingPersistenceService.saveStageResult(sq1Result)

    // 3. Lê ambos os resultados e comprova total independência
    const readQ1 = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    const readSQ1 = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq1',
    )

    expect(readQ1).not.toBeNull()
    expect(readSQ1).not.toBeNull()
    expect(readQ1!.entries[0].driverId).toBe('main_q1_p1')
    expect(readSQ1!.entries[0].driverId).toBe('sprint_sq1_p1')
    expect(readQ1!.completedAt).toBe('2026-05-10T16:00:00.000Z')
    expect(readSQ1!.completedAt).toBe('2026-05-09T10:00:00.000Z')
  })
})
