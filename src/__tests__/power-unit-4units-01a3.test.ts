/**
 * power-unit-4units-01a3.test.ts
 *
 * Microbloco POWER-UNIT-4UNITS-01A3: EXECUÇÃO, TROCA E INTEGRIDADE DE USO POR PU
 *
 * Casos Obrigatórios:
 * - A3.1: Uma PU instalada: Driver A com PU1 instalada, PU2–PU4 reserva.
 *         Aplicar 250 km e wearDebit conhecido -> só PU1 muda; PU2–PU4 byte-a-byte intactas nos campos mileage_km/condition/wear.
 * - A3.2: Troca entre sessões: Sessão 1 com PU1 (acumula km/desgaste); trocar para PU2 via switchDriverPowerUnit (mecanismo A2);
 *         Sessão 2 debita em PU2 exclusivamente; PU1 congelada no estado fim da Sessão 1; voltar para PU1 e confirmar estado exato anterior.
 * - A3.3: Dois pilotos: Driver A usa PU2, Driver B usa PU4, distâncias/desgastes diferentes.
 *         Cada unidade recebe somente o débito de seu piloto; as seis unidades em reserva intactas.
 * - A3.4: Runtime após troca: inicializar sessão com PU1, finalizar, trocar para PU3, inicializar nova sessão:
 *         powerUnitId da nova sessão = ID da PU3.
 * - A3.5: Mismatch de piloto: forçar powerUnitId da unidade do companheiro -> débito rejeitado, nenhuma unidade alterada.
 * - A3.6: Mismatch de temporada: ID legítimo do mesmo piloto mas seasonYear anterior -> rejeitado, inventário da temporada atual intacto.
 * - A3.7: Idempotência do journal: aplicar a mesma sessão duas vezes (power_unit_usage_journals, chave careerId + season + round + variant)
 *         -> km/desgaste debitados apenas uma vez.
 * - A3.8: Reserva não envelhece: múltiplas sessões usando PU1 -> PU2/PU3/PU4 permanecem idênticas nos campos de uso.
 *
 * Provas de Invariante:
 * - SEC-C2: Prova formal de que somente a PU efetivamente utilizada recebe desgaste/km.
 * - Revalidações:
 *   - SEC-A: Inventário não duplica.
 *   - SEC-B: Exatamente uma instalada por piloto.
 *   - SEC-C: Troca preserva estado.
 *   - SEC-F: Pilotos estritamente isolados.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { TeamModel } from '@/types/f1'
import type { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import {
  ensureSeasonTeamPowerUnitInventories,
  getDriverSeasonPowerUnits,
  getInstalledUnitsCountForDriver,
} from '@/services/canonicalPowerUnitInventoryService'
import { canonicalPowerUnitAllocationService } from '@/services/canonicalPowerUnitAllocationService'
import { canonicalPowerUnitUsageApplierService } from '@/services/canonicalPowerUnitUsageApplierService'
import {
  projectSessionPowerUnitUsage,
  type SessionPowerUnitUsageProjectionReport,
} from '@/services/canonicalPowerUnitUsageProjectionService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'

describe('POWER-UNIT-4UNITS-01A3 — Execução, Troca e Integridade de Uso PU1–PU4', () => {
  const CAREER_ID = 'career_a3_test'
  const DRIVER_A = 'drv_norris'
  const DRIVER_B = 'drv_piastri'
  const SEASON = 2026

  const createBaseTeamWithInventories = (): TeamModel => {
    const baseTeam: TeamModel = {
      id: 'team_apex_01',
      name: 'Apex GP Racing',
      color: '#00F0FF',
      chassis_level: 80,
      aero_level: 80,
      strategy_level: 80,
      budget: 150000000,
      cost_cap_spent: 0,
      engine_pool_used: 1,
      engine_supplier: 'Audi',
      active_engine_wear: 0,
      engine_history: [],
    }

    const history = ensureSeasonTeamPowerUnitInventories({
      team: baseTeam,
      driverIds: [DRIVER_A, DRIVER_B],
      seasonYear: SEASON,
      supplier: 'Audi',
      introducedRound: 1,
    })

    const teamWithHist: TeamModel = {
      ...baseTeam,
      engine_history: history,
    }

    // Inicializa alocações padrão (PU1 do piloto A para car1, PU1 do piloto B para car2)
    return canonicalPowerUnitAllocationService.ensureInitialDriverAllocations({
      team: teamWithHist,
      driver1Id: DRIVER_A,
      driver2Id: DRIVER_B,
      seasonYear: SEASON,
      careerId: CAREER_ID,
    })
  }

  const createMockQualifyingGrid = (teamId: string): FinalQualifyingGridEntry[] => {
    const entries: FinalQualifyingGridEntry[] = [
      {
        gridPosition: 1,
        driverId: DRIVER_A,
        driverName: 'Lando Norris',
        teamId,
        teamName: 'Apex GP Racing',
        teamColor: '#00F0FF',
        carId: 'car1',
        isPlayer: true,
        eliminationStage: 'Q3',
        bestLapSec: 80.0,
        bestLapTime: '1:20.000',
        bestLapCompound: 'macio',
      },
      {
        gridPosition: 2,
        driverId: DRIVER_B,
        driverName: 'Oscar Piastri',
        teamId,
        teamName: 'Apex GP Racing',
        teamColor: '#00F0FF',
        carId: 'car2',
        isPlayer: true,
        eliminationStage: 'Q3',
        bestLapSec: 80.2,
        bestLapTime: '1:20.200',
        bestLapCompound: 'macio',
      },
    ]

    for (let p = 3; p <= 24; p++) {
      entries.push({
        gridPosition: p,
        driverId: `rival_drv_${p}`,
        driverName: `Rival ${p}`,
        teamId: `rival_team_${Math.ceil(p / 2)}`,
        teamName: `Rival Team ${Math.ceil(p / 2)}`,
        teamColor: '#555555',
        carId: p % 2 === 1 ? 'car1' : 'car2',
        isPlayer: false,
        eliminationStage: p <= 10 ? 'Q3' : p <= 15 ? 'Q2' : 'Q1',
        bestLapSec: 80.0 + p * 0.1,
        bestLapTime: `1:20.${p}00`,
        bestLapCompound: 'medio',
      })
    }

    return entries
  }

  const createSyntheticProjectionReport = (params: {
    careerId?: string
    season?: number
    round: number
    raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE'
    teamId: string
    projections: Array<{
      driverId: string
      driverName: string
      powerUnitId: number
      distanceKm: number
      wearDebit: number
      lapsCompleted?: number
    }>
  }): SessionPowerUnitUsageProjectionReport => {
    const careerId = params.careerId || CAREER_ID
    const season = params.season ?? SEASON
    const round = params.round
    const raceVariant = params.raceVariant || 'MAIN_RACE'
    const variantSlug = raceVariant === 'SPRINT_RACE' ? 'sprint' : 'main'
    const sessionKey = `${careerId}_s${season}_r${round}_${variantSlug}`

    return {
      careerId,
      season,
      round,
      raceVariant,
      raceId: `race_${careerId}_s${season}_r${round}`,
      sessionKey,
      circuitName: 'Test Circuit',
      circuitLengthKm: 5.0,
      totalLapsScheduled: 50,
      sessionStatus: 'completed',
      totalParticipants: params.projections.length,
      linkedParticipantsCount: params.projections.length,
      unlinkedParticipantsCount: 0,
      projections: params.projections.map((p) => ({
        careerId,
        season,
        round,
        raceVariant,
        raceId: `race_${careerId}_s${season}_r${round}`,
        sessionKey,
        teamId: params.teamId,
        teamName: 'Apex GP Racing',
        driverId: p.driverId,
        driverName: p.driverName,
        isPlayer: true,
        hasValidLinkage: true,
        powerUnitId: p.powerUnitId,
        lapsCompleted: p.lapsCompleted ?? Math.round(p.distanceKm / 5.0),
        circuitLengthKm: 5.0,
        distanceKm: p.distanceKm,
        initialCondition: 100,
        finalCondition: 100 - p.wearDebit,
        wearDebit: p.wearDebit,
        wearDebitStatus: p.wearDebit === 0 ? 'ZERO_WEAR' : 'RECOGNIZED',
      })),
      unlinkedDriverIds: [],
      pendingWearDriverIds: [],
    }
  }

  beforeEach(() => {
    canonicalPowerUnitAllocationService.clearMemoryCache()
    canonicalPowerUnitUsageApplierService.clearJournalCache()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // =========================================================================
  // A3.1 — UMA PU INSTALADA
  // =========================================================================
  it('A3.1 — uma PU instalada: Driver A com PU1 instalada, PU2–PU4 reserva. Aplicar 250 km e wearDebit conhecido → só PU1 muda, PU2–PU4 intactas', async () => {
    const team = createBaseTeamWithInventories()
    const norrisUnitsBefore = getDriverSeasonPowerUnits(team, DRIVER_A, SEASON)
    const norrisPU1 = norrisUnitsBefore.find((u) => u.unitNumber === 1)!
    const norrisPU2_4Before = norrisUnitsBefore.filter((u) => u.unitNumber !== 1)

    // Snapshot das reservas PU2..PU4
    const reservesSnapshot = JSON.parse(JSON.stringify(norrisPU2_4Before))

    // Projeção de uso: 250 km e 12.5% de desgaste em PU1
    const report = createSyntheticProjectionReport({
      round: 1,
      teamId: team.id,
      projections: [
        {
          driverId: DRIVER_A,
          driverName: 'Lando Norris',
          powerUnitId: Number(norrisPU1.id),
          distanceKm: 250.0,
          wearDebit: 12.5,
        },
      ],
    })

    const result = await canonicalPowerUnitUsageApplierService.applySessionPowerUnitUsage(report, {
      teamOverrides: { [team.id]: team },
      dryRunOrLocalOnly: true,
    })

    expect(result.status).toBe('SUCCESS')
    expect(result.appliedCount).toBe(1)

    const norrisUnitsAfter = getDriverSeasonPowerUnits(team, DRIVER_A, SEASON)
    const pu1After = norrisUnitsAfter.find((u) => u.unitNumber === 1)!
    const reservesAfter = norrisUnitsAfter.filter((u) => u.unitNumber !== 1)

    // Apenas PU1 foi debitada
    expect(pu1After.mileage_km).toBe(250.0)
    expect(pu1After.condition).toBe(87.5)
    expect(pu1After.wear).toBe(12.5)

    // PU2–PU4 byte a byte intactas nos campos mileage_km / condition / wear
    expect(
      reservesAfter.map((u) => ({ id: u.id, km: u.mileage_km, cond: u.condition, wear: u.wear })),
    ).toEqual(
      reservesSnapshot.map((u: any) => ({
        id: u.id,
        km: u.mileage_km,
        cond: u.condition,
        wear: u.wear,
      })),
    )

    // Espelho de compatibilidade foi atualizado para active_engine_wear = 12.5
    expect(team.active_engine_wear).toBe(12.5)
  })

  // =========================================================================
  // A3.2 — TROCA ENTRE SESSÕES E PRESERVAÇÃO
  // =========================================================================
  it('A3.2 — troca entre sessões: Sessão 1 com PU1; trocar para PU2; Sessão 2 debita em PU2; PU1 congelada; voltar para PU1 com estado anterior exato', async () => {
    let team = createBaseTeamWithInventories()
    const norrisUnits = getDriverSeasonPowerUnits(team, DRIVER_A, SEASON)
    const norrisPU1 = norrisUnits.find((u) => u.unitNumber === 1)!
    const norrisPU2 = norrisUnits.find((u) => u.unitNumber === 2)!

    // 1. Sessão 1 (Round 1): usa PU1 (200 km, 10% wear)
    const reportS1 = createSyntheticProjectionReport({
      round: 1,
      teamId: team.id,
      projections: [
        {
          driverId: DRIVER_A,
          driverName: 'Lando Norris',
          powerUnitId: Number(norrisPU1.id),
          distanceKm: 200.0,
          wearDebit: 10.0,
        },
      ],
    })

    const resS1 = await canonicalPowerUnitUsageApplierService.applySessionPowerUnitUsage(reportS1, {
      teamOverrides: { [team.id]: team },
      dryRunOrLocalOnly: true,
    })
    expect(resS1.status).toBe('SUCCESS')

    const pu1AfterS1 = getDriverSeasonPowerUnits(team, DRIVER_A, SEASON).find(
      (u) => u.unitNumber === 1,
    )!
    expect(pu1AfterS1.mileage_km).toBe(200.0)
    expect(pu1AfterS1.condition).toBe(90.0)
    expect(pu1AfterS1.wear).toBe(10.0)

    // 2. Trocar Driver A para PU2 via switchDriverPowerUnit (mecanismo A2)
    team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
      team,
      driverId: DRIVER_A,
      seasonYear: SEASON,
      targetUnitNumber: 2,
      carSlot: 1,
      careerId: CAREER_ID,
    })

    // Confirmar que PU2 está instalada e PU1 virou reserva
    const norrisUnitsPostSwitch = getDriverSeasonPowerUnits(team, DRIVER_A, SEASON)
    expect(norrisUnitsPostSwitch.find((u) => u.unitNumber === 2)?.status).toBe('instalado')
    expect(norrisUnitsPostSwitch.find((u) => u.unitNumber === 1)?.status).toBe('reserva')

    // 3. Sessão 2 (Round 2): debita em PU2 exclusivamente (300 km, 15% wear)
    const reportS2 = createSyntheticProjectionReport({
      round: 2,
      teamId: team.id,
      projections: [
        {
          driverId: DRIVER_A,
          driverName: 'Lando Norris',
          powerUnitId: Number(norrisPU2.id),
          distanceKm: 300.0,
          wearDebit: 15.0,
        },
      ],
    })

    const resS2 = await canonicalPowerUnitUsageApplierService.applySessionPowerUnitUsage(reportS2, {
      teamOverrides: { [team.id]: team },
      dryRunOrLocalOnly: true,
    })
    expect(resS2.status).toBe('SUCCESS')

    const norrisUnitsPostS2 = getDriverSeasonPowerUnits(team, DRIVER_A, SEASON)
    const pu2AfterS2 = norrisUnitsPostS2.find((u) => u.unitNumber === 2)!
    const pu1AfterS2 = norrisUnitsPostS2.find((u) => u.unitNumber === 1)!

    // PU2 recebeu os débitos da Sessão 2
    expect(pu2AfterS2.mileage_km).toBe(300.0)
    expect(pu2AfterS2.condition).toBe(85.0)
    expect(pu2AfterS2.wear).toBe(15.0)

    // PU1 congelada exatamente no estado de término da Sessão 1!
    expect(pu1AfterS2.mileage_km).toBe(200.0)
    expect(pu1AfterS2.condition).toBe(90.0)
    expect(pu1AfterS2.wear).toBe(10.0)

    // 4. Voltar para PU1 via switchDriverPowerUnit e confirmar estado anterior exato
    team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
      team,
      driverId: DRIVER_A,
      seasonYear: SEASON,
      targetUnitNumber: 1,
      carSlot: 1,
      careerId: CAREER_ID,
    })

    const norrisUnitsReturn = getDriverSeasonPowerUnits(team, DRIVER_A, SEASON)
    const pu1Return = norrisUnitsReturn.find((u) => u.unitNumber === 1)!
    const pu2Return = norrisUnitsReturn.find((u) => u.unitNumber === 2)!

    expect(pu1Return.status).toBe('instalado')
    expect(pu1Return.mileage_km).toBe(200.0)
    expect(pu1Return.condition).toBe(90.0)
    expect(pu1Return.wear).toBe(10.0)

    expect(pu2Return.status).toBe('reserva')
    expect(pu2Return.mileage_km).toBe(300.0)
    expect(pu2Return.condition).toBe(85.0)
    expect(pu2Return.wear).toBe(15.0)
  })

  // =========================================================================
  // A3.3 — DOIS PILOTOS EM SESSÃO
  // =========================================================================
  it('A3.3 — dois pilotos: Driver A usa PU2, Driver B usa PU4, distâncias e desgastes diferentes → cada unidade recebe seu débito; as outras 6 intactas', async () => {
    let team = createBaseTeamWithInventories()

    // Trocar Driver A para PU2 e Driver B para PU4
    team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
      team,
      driverId: DRIVER_A,
      seasonYear: SEASON,
      targetUnitNumber: 2,
      carSlot: 1,
      careerId: CAREER_ID,
    })
    team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
      team,
      driverId: DRIVER_B,
      seasonYear: SEASON,
      targetUnitNumber: 4,
      carSlot: 2,
      careerId: CAREER_ID,
    })

    const norrisUnits = getDriverSeasonPowerUnits(team, DRIVER_A, SEASON)
    const piastriUnits = getDriverSeasonPowerUnits(team, DRIVER_B, SEASON)

    const norrisPU2 = norrisUnits.find((u) => u.unitNumber === 2)!
    const piastriPU4 = piastriUnits.find((u) => u.unitNumber === 4)!

    // As 6 reservas
    const inactiveUnitsBefore = (team.engine_history || []).filter(
      (u) => Number(u.id) !== Number(norrisPU2.id) && Number(u.id) !== Number(piastriPU4.id),
    )
    expect(inactiveUnitsBefore.length).toBe(6)
    const inactiveSnapshot = JSON.parse(JSON.stringify(inactiveUnitsBefore))

    // Projeção com distâncias e desgastes diferentes
    // Norris (PU2): 300 km, 14.2% wear
    // Piastri (PU4): 150 km, 7.8% wear (ex: DNF precoce)
    const report = createSyntheticProjectionReport({
      round: 3,
      teamId: team.id,
      projections: [
        {
          driverId: DRIVER_A,
          driverName: 'Lando Norris',
          powerUnitId: Number(norrisPU2.id),
          distanceKm: 300.0,
          wearDebit: 14.2,
        },
        {
          driverId: DRIVER_B,
          driverName: 'Oscar Piastri',
          powerUnitId: Number(piastriPU4.id),
          distanceKm: 150.0,
          wearDebit: 7.8,
        },
      ],
    })

    const result = await canonicalPowerUnitUsageApplierService.applySessionPowerUnitUsage(report, {
      teamOverrides: { [team.id]: team },
      dryRunOrLocalOnly: true,
    })

    expect(result.status).toBe('SUCCESS')
    expect(result.appliedCount).toBe(2)

    const norrisPU2After = (team.engine_history || []).find(
      (u) => Number(u.id) === Number(norrisPU2.id),
    )!
    const piastriPU4After = (team.engine_history || []).find(
      (u) => Number(u.id) === Number(piastriPU4.id),
    )!

    expect(norrisPU2After.mileage_km).toBe(300.0)
    expect(norrisPU2After.condition).toBe(85.8)
    expect(norrisPU2After.wear).toBe(14.2)

    expect(piastriPU4After.mileage_km).toBe(150.0)
    expect(piastriPU4After.condition).toBe(92.2)
    expect(piastriPU4After.wear).toBe(7.8)

    // As 6 unidades em reserva permanecem exatamente intactas
    const inactiveUnitsAfter = (team.engine_history || []).filter(
      (u) => Number(u.id) !== Number(norrisPU2.id) && Number(u.id) !== Number(piastriPU4.id),
    )
    expect(
      inactiveUnitsAfter.map((u) => ({
        id: u.id,
        km: u.mileage_km,
        cond: u.condition,
        wear: u.wear,
      })),
    ).toEqual(
      inactiveSnapshot.map((u: any) => ({
        id: u.id,
        km: u.mileage_km,
        cond: u.condition,
        wear: u.wear,
      })),
    )
  })

  // =========================================================================
  // A3.4 — RUNTIME APÓS TROCA
  // =========================================================================
  it('A3.4 — runtime após troca: inicializar sessão com PU1, finalizar, trocar para PU3, inicializar nova sessão → powerUnitId da nova sessão = ID da PU3', () => {
    let team = createBaseTeamWithInventories()
    const grid = createMockQualifyingGrid(team.id)

    const norrisUnits = getDriverSeasonPowerUnits(team, DRIVER_A, SEASON)
    const norrisPU1 = norrisUnits.find((u) => u.unitNumber === 1)!
    const norrisPU3 = norrisUnits.find((u) => u.unitNumber === 3)!

    // 1. Inicializar sessão 1 com PU1
    const session1 = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: CAREER_ID,
      season: SEASON,
      round: 1,
      circuitName: 'Circuito 1',
      circuitCountry: 'Bahrein',
      totalLaps: 10,
      playerTeamId: team.id,
      playerTeam: team,
      canonicalQualifyingGrid: grid,
      persistState: false,
    })

    const driverAInS1 = session1.drivers.find((d) => d.driverId === DRIVER_A)!
    expect(driverAInS1.powerUnitId).toBe(Number(norrisPU1.id))

    // 2. Trocar para PU3 via switchDriverPowerUnit
    team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
      team,
      driverId: DRIVER_A,
      seasonYear: SEASON,
      targetUnitNumber: 3,
      carSlot: 1,
      careerId: CAREER_ID,
    })

    // 3. Inicializar nova sessão (round 2)
    const session2 = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: CAREER_ID,
      season: SEASON,
      round: 2,
      circuitName: 'Circuito 2',
      circuitCountry: 'Arábia Saudita',
      totalLaps: 10,
      playerTeamId: team.id,
      playerTeam: team,
      canonicalQualifyingGrid: grid,
      persistState: false,
    })

    const driverAInS2 = session2.drivers.find((d) => d.driverId === DRIVER_A)!
    // powerUnitId da nova sessão é estritamente o ID da PU3!
    expect(driverAInS2.powerUnitId).toBe(Number(norrisPU3.id))
    expect(driverAInS2.powerUnitId).not.toBe(Number(norrisPU1.id))
  })

  // =========================================================================
  // A3.5 — MISMATCH DE PILOTO (ITEM 1: GUARDA DE INTEGRIDADE)
  // =========================================================================
  it('A3.5 — mismatch de piloto: forçar powerUnitId da unidade do companheiro → débito rejeitado, nenhuma unidade alterada', async () => {
    const team = createBaseTeamWithInventories()
    const historySnapshot = JSON.stringify(team.engine_history)

    const piastriUnits = getDriverSeasonPowerUnits(team, DRIVER_B, SEASON)
    const piastriPU1 = piastriUnits.find((u) => u.unitNumber === 1)!

    // Forçar projeção fraudulenta: atribuir a PU de Piastri ao Driver A (Norris)
    const fraudulentReport = createSyntheticProjectionReport({
      round: 4,
      teamId: team.id,
      projections: [
        {
          driverId: DRIVER_A, // Norris
          driverName: 'Lando Norris',
          powerUnitId: Number(piastriPU1.id), // ID da PU de Piastri!
          distanceKm: 250.0,
          wearDebit: 10.0,
        },
      ],
    })

    const result = await canonicalPowerUnitUsageApplierService.applySessionPowerUnitUsage(
      fraudulentReport,
      {
        teamOverrides: { [team.id]: team },
        dryRunOrLocalOnly: true,
      },
    )

    // Rejeição estrita com FAILED_NOT_FOUND
    expect(result.status).toBe('FAILED')
    expect(result.failedCount).toBe(1)
    expect(result.appliedCount).toBe(0)

    const unitResult = result.unitResults[0]
    expect(unitResult.status).toBe('FAILED_NOT_FOUND')
    expect(unitResult.message).toContain('Mismatch de integridade')
    expect(unitResult.message).toContain('piloto')

    // Nenhuma unidade do inventário foi alterada (nenhuma alteração parcial)
    expect(JSON.stringify(team.engine_history)).toBe(historySnapshot)
  })

  // =========================================================================
  // A3.6 — MISMATCH DE TEMPORADA (ITEM 1: GUARDA DE INTEGRIDADE)
  // =========================================================================
  it('A3.6 — mismatch de temporada: ID legítimo do mesmo piloto mas seasonYear anterior → rejeitado, inventário da temporada atual intacto', async () => {
    const team = createBaseTeamWithInventories()

    // Injetar uma unidade legada de 2025 pertencente ao mesmo piloto (Norris)
    const oldSeasonUnit = {
      id: 999,
      wear: 40,
      condition: 60,
      mileage_km: 1200,
      status: 'reserva' as const,
      supplier: 'Audi',
      introducedRound: 1,
      exceedsQuota: false,
      driverId: DRIVER_A,
      seasonYear: 2025, // Temporada anterior!
      unitNumber: 1,
    }
    team.engine_history = [...(team.engine_history || []), oldSeasonUnit]
    const historySnapshot = JSON.stringify(team.engine_history)

    // Projeção da temporada 2026 tentando aplicar uso na unidade de 2025
    const reportSeasonMismatch = createSyntheticProjectionReport({
      season: 2026,
      round: 5,
      teamId: team.id,
      projections: [
        {
          driverId: DRIVER_A,
          driverName: 'Lando Norris',
          powerUnitId: 999, // Unidade de 2025
          distanceKm: 250.0,
          wearDebit: 10.0,
        },
      ],
    })

    const result = await canonicalPowerUnitUsageApplierService.applySessionPowerUnitUsage(
      reportSeasonMismatch,
      {
        teamOverrides: { [team.id]: team },
        dryRunOrLocalOnly: true,
      },
    )

    expect(result.status).toBe('FAILED')
    expect(result.failedCount).toBe(1)
    expect(result.appliedCount).toBe(0)

    const unitResult = result.unitResults[0]
    expect(unitResult.status).toBe('FAILED_NOT_FOUND')
    expect(unitResult.message).toContain('Mismatch de integridade')
    expect(unitResult.message).toContain('temporada')

    // Inventário permaneceu 100% intacto
    expect(JSON.stringify(team.engine_history)).toBe(historySnapshot)
  })

  // =========================================================================
  // A3.7 — IDEMPOTÊNCIA DO JOURNAL
  // =========================================================================
  it('A3.7 — idempotência do journal: aplicar a mesma sessão duas vezes → km e desgaste debitados apenas uma vez', async () => {
    const team = createBaseTeamWithInventories()
    const norrisPU1 = getDriverSeasonPowerUnits(team, DRIVER_A, SEASON).find(
      (u) => u.unitNumber === 1,
    )!

    const report = createSyntheticProjectionReport({
      round: 6,
      raceVariant: 'MAIN_RACE',
      teamId: team.id,
      projections: [
        {
          driverId: DRIVER_A,
          driverName: 'Lando Norris',
          powerUnitId: Number(norrisPU1.id),
          distanceKm: 260.0,
          wearDebit: 13.0,
        },
      ],
    })

    // Primeira aplicação
    const firstResult = await canonicalPowerUnitUsageApplierService.applySessionPowerUnitUsage(
      report,
      {
        teamOverrides: { [team.id]: team },
        dryRunOrLocalOnly: true,
      },
    )
    expect(firstResult.status).toBe('SUCCESS')
    expect(firstResult.appliedCount).toBe(1)

    const pu1AfterFirst = (team.engine_history || []).find(
      (u) => Number(u.id) === Number(norrisPU1.id),
    )!
    expect(pu1AfterFirst.mileage_km).toBe(260.0)
    expect(pu1AfterFirst.condition).toBe(87.0)

    // Segunda aplicação da MESMA sessão
    const secondResult = await canonicalPowerUnitUsageApplierService.applySessionPowerUnitUsage(
      report,
      {
        teamOverrides: { [team.id]: team },
        dryRunOrLocalOnly: true,
      },
    )

    expect(secondResult.status).toBe('ALREADY_APPLIED')
    expect(secondResult.appliedCount).toBe(0)
    expect(secondResult.alreadyAppliedCount).toBe(1)

    // Valores mantidos sem duplicar
    const pu1AfterSecond = (team.engine_history || []).find(
      (u) => Number(u.id) === Number(norrisPU1.id),
    )!
    expect(pu1AfterSecond.mileage_km).toBe(260.0)
    expect(pu1AfterSecond.condition).toBe(87.0)
    expect(pu1AfterSecond.wear).toBe(13.0)
  })

  // =========================================================================
  // A3.8 — RESERVA NÃO ENVELHECE
  // =========================================================================
  it('A3.8 — reserva não envelhece: múltiplas sessões usando PU1 → PU2, PU3 e PU4 permanecem idênticas nos campos de uso', async () => {
    const team = createBaseTeamWithInventories()
    const norrisUnits = getDriverSeasonPowerUnits(team, DRIVER_A, SEASON)
    const norrisPU1 = norrisUnits.find((u) => u.unitNumber === 1)!
    const norrisReserves = norrisUnits.filter((u) => u.unitNumber !== 1)
    const reservesInitial = JSON.parse(JSON.stringify(norrisReserves))

    // Rodar 5 sessões consecutivas usando apenas PU1
    for (let round = 1; round <= 5; round++) {
      const report = createSyntheticProjectionReport({
        round,
        teamId: team.id,
        projections: [
          {
            driverId: DRIVER_A,
            driverName: 'Lando Norris',
            powerUnitId: Number(norrisPU1.id),
            distanceKm: 200.0,
            wearDebit: 10.0,
          },
        ],
      })

      const res = await canonicalPowerUnitUsageApplierService.applySessionPowerUnitUsage(report, {
        teamOverrides: { [team.id]: team },
        dryRunOrLocalOnly: true,
      })
      expect(res.status).toBe('SUCCESS')
    }

    const norrisUnitsFinal = getDriverSeasonPowerUnits(team, DRIVER_A, SEASON)
    const pu1Final = norrisUnitsFinal.find((u) => u.unitNumber === 1)!
    const reservesFinal = norrisUnitsFinal.filter((u) => u.unitNumber !== 1)

    // PU1 acumulou 5 * 200 = 1000 km e 5 * 10 = 50% wear
    expect(pu1Final.mileage_km).toBe(1000.0)
    expect(pu1Final.condition).toBe(50.0)
    expect(pu1Final.wear).toBe(50.0)

    // PU2, PU3 e PU4 não envelheceram: exatamente 0 km, 100% condition e 0% wear
    reservesFinal.forEach((resUnit) => {
      expect(resUnit.mileage_km).toBe(0)
      expect(resUnit.condition).toBe(100)
      expect(resUnit.wear).toBe(0)
      expect(resUnit.status).toBe('reserva')
    })
    expect(
      reservesFinal.map((u) => ({ id: u.id, km: u.mileage_km, cond: u.condition, wear: u.wear })),
    ).toEqual(
      reservesInitial.map((u: any) => ({
        id: u.id,
        km: u.mileage_km,
        cond: u.condition,
        wear: u.wear,
      })),
    )
  })

  // =========================================================================
  // PROVAS DE SEGURANÇA E INVARIANTES: SEC-C2, SEC-A, SEC-B, SEC-C, SEC-F
  // =========================================================================
  describe('Provas Formais de Segurança: SEC-C2, SEC-A, SEC-B, SEC-C, SEC-F', () => {
    // SEC-C2: Prova formal de que somente a PU efetivamente utilizada recebe desgaste/km
    it('SEC-C2 — prova formal de que apenas a PU efetivamente utilizada recebe desgaste e km', async () => {
      const team = createBaseTeamWithInventories()
      const allUnitsBefore = [...(team.engine_history || [])]
      const targetUnit = allUnitsBefore.find((u) => u.driverId === DRIVER_A && u.unitNumber === 1)!

      const report = createSyntheticProjectionReport({
        round: 10,
        teamId: team.id,
        projections: [
          {
            driverId: DRIVER_A,
            driverName: 'Lando Norris',
            powerUnitId: Number(targetUnit.id),
            distanceKm: 310.5,
            wearDebit: 15.3,
          },
        ],
      })

      await canonicalPowerUnitUsageApplierService.applySessionPowerUnitUsage(report, {
        teamOverrides: { [team.id]: team },
        dryRunOrLocalOnly: true,
      })

      const allUnitsAfter = [...(team.engine_history || [])]

      // Prova para cada unidade do histórico:
      allUnitsAfter.forEach((afterUnit) => {
        const beforeUnit = allUnitsBefore.find((u) => Number(u.id) === Number(afterUnit.id))!
        if (Number(afterUnit.id) === Number(targetUnit.id)) {
          // Unidade alvo: modificada
          expect(afterUnit.mileage_km).toBe(beforeUnit.mileage_km + 310.5)
          expect(afterUnit.condition).toBe(beforeUnit.condition - 15.3)
        } else {
          // Qualquer outra unidade: estritamente idêntica
          expect(afterUnit.mileage_km).toBe(beforeUnit.mileage_km)
          expect(afterUnit.condition).toBe(beforeUnit.condition)
          expect(afterUnit.wear).toBe(beforeUnit.wear)
        }
      })
    })

    // SEC-A: Inventário não duplica
    it('SEC-A — revalidação: inventário de 8 unidades por equipe não sofre duplicação', () => {
      let team = createBaseTeamWithInventories()
      expect(team.engine_history?.length).toBe(8)

      // Re-executa ensureSeasonTeamPowerUnitInventories
      const ensured = ensureSeasonTeamPowerUnitInventories({
        team,
        driverIds: [DRIVER_A, DRIVER_B],
        seasonYear: SEASON,
      })
      expect(ensured.length).toBe(8)
    })

    // SEC-B: Exatamente uma PU instalada por piloto
    it('SEC-B — revalidação: exatamente uma PU instalada por piloto', () => {
      const team = createBaseTeamWithInventories()
      expect(getInstalledUnitsCountForDriver(team, DRIVER_A, SEASON)).toBe(1)
      expect(getInstalledUnitsCountForDriver(team, DRIVER_B, SEASON)).toBe(1)
    })

    // SEC-C: Troca preserva estado integralmente
    it('SEC-C — revalidação: troca preserva estado de todas as unidades', () => {
      let team = createBaseTeamWithInventories()
      // Modifica PU1
      team.engine_history = (team.engine_history || []).map((u) =>
        u.driverId === DRIVER_A && u.unitNumber === 1
          ? { ...u, mileage_km: 450, condition: 78, wear: 22 }
          : u,
      )

      // Troca para PU2
      team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
        team,
        driverId: DRIVER_A,
        seasonYear: SEASON,
        targetUnitNumber: 2,
        carSlot: 1,
        careerId: CAREER_ID,
      })

      const pu1 = (team.engine_history || []).find(
        (u) => u.driverId === DRIVER_A && u.unitNumber === 1,
      )!
      expect(pu1.mileage_km).toBe(450)
      expect(pu1.condition).toBe(78)
      expect(pu1.wear).toBe(22)
      expect(pu1.status).toBe('reserva')
    })

    // SEC-F: Pilotos estritamente isolados
    it('SEC-F — revalidação: operações em Driver A não afetam alocação nem estado de Driver B', () => {
      let team = createBaseTeamWithInventories()
      const piastriBefore = getDriverSeasonPowerUnits(team, DRIVER_B, SEASON)

      // Várias trocas no Driver A
      team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
        team,
        driverId: DRIVER_A,
        seasonYear: SEASON,
        targetUnitNumber: 3,
        carSlot: 1,
        careerId: CAREER_ID,
      })
      team = canonicalPowerUnitAllocationService.switchDriverPowerUnit({
        team,
        driverId: DRIVER_A,
        seasonYear: SEASON,
        targetUnitNumber: 4,
        carSlot: 1,
        careerId: CAREER_ID,
      })

      const piastriAfter = getDriverSeasonPowerUnits(team, DRIVER_B, SEASON)
      expect(piastriAfter).toEqual(piastriBefore)
    })
  })
})
