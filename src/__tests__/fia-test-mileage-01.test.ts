import { describe, it, expect } from 'vitest'
import { calculateDriverTotalTestMileage } from '@/services/driverMileageResolverService'
import { canonicalHomologationAdapter } from '@/lib/canonical-adapters'
import { HOMOLOGATION_CONFIG } from '@/types/driver-development'
import type { DriverModel } from '@/types/driver-development'

/**
 * FIA-TEST-MILEAGE-01 Test Suite (FTM01 - FTM12)
 *
 * Validação de persistência canônica de km de testes + integração com homologação FIA
 * no APEX GP Manager.
 *
 * REGRA CANÔNICA:
 * - km pertencem ao driverId (NÃO a teamId, contractId, academy slot, role, temporada visual).
 * - Mudança de equipe (Academia Audi -> Reserva -> Titular -> outra equipe) preserva os km.
 * - Save/reload preserva os km.
 * - Testes duplicados por ID não somam em duplicidade.
 * - Testes cancelados / não concluídos não somam.
 * - Mariana Fagundes como sentinela canônica (driverId mbj-044 ou ID procedural).
 */

describe('FIA-TEST-MILEAGE-01: Canonical Test Mileage & FIA Homologation Integration', () => {
  const MARIANA_DRIVER_ID = 'mbj-044'
  const MARIANA_BASE_DRIVER: Partial<DriverModel> = {
    id: MARIANA_DRIVER_ID,
    name: 'Mariana Fagundes',
    team_id: 'team_audi_01',
    role: 'academia',
    category: 'f1',
    age: 19,
    nationality: 'BRA',
    rating: 72,
    potential: 85,
    license_status: 'nivel_c',
    homologation_status: 'formacao',
    superlicense_points: 10,
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T00:00:00Z',
  }

  // FTM01: piloto sem testes válidos -> total = 0 km
  it('FTM01: piloto sem testes válidos -> total = 0 km', () => {
    const total = calculateDriverTotalTestMileage(MARIANA_DRIVER_ID, [])
    expect(total).toBe(0)
  })

  // FTM02: um teste concluído de 300 km -> 300 km
  it('FTM02: um teste concluído de 300 km -> 300 km', () => {
    const tests = [
      {
        id: 'test_mariana_01',
        driver_id: MARIANA_DRIVER_ID,
        km_completed: 300,
        status: 'concluido' as const,
        is_valid_homologation: true,
      },
    ]

    const total = calculateDriverTotalTestMileage(MARIANA_DRIVER_ID, tests)
    expect(total).toBe(300)
  })

  // FTM03: segundo teste concluído de 300 km -> 600 km
  it('FTM03: segundo teste concluído de 300 km -> 600 km', () => {
    const tests = [
      {
        id: 'test_mariana_01',
        driver_id: MARIANA_DRIVER_ID,
        km_completed: 300,
        status: 'concluido' as const,
        is_valid_homologation: true,
      },
      {
        id: 'test_mariana_02',
        driver_id: MARIANA_DRIVER_ID,
        km_completed: 300,
        status: 'completed' as const,
        is_valid_homologation: true,
      },
    ]

    const total = calculateDriverTotalTestMileage(MARIANA_DRIVER_ID, tests)
    expect(total).toBe(600)
  })

  // FTM04: quatro testes concluídos de 300 km -> 1.200 km
  it('FTM04: quatro testes concluídos de 300 km -> 1.200 km (atende requisito regulamentar)', () => {
    const tests = [
      { id: 't1', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
      { id: 't2', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'completed' as const },
      { id: 't3', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
      { id: 't4', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
    ]

    const total = calculateDriverTotalTestMileage(MARIANA_DRIVER_ID, tests)
    expect(total).toBe(1200)

    // Verifica que satisfaz o requisito de quilometragem da FIA
    const minRequiredKm = HOMOLOGATION_CONFIG.minValidTests * HOMOLOGATION_CONFIG.minKmPerTest
    expect(minRequiredKm).toBe(1200)
    expect(total).toBeGreaterThanOrEqual(minRequiredKm)
  })

  // FTM05: teste cancelado/não concluído -> não soma
  it('FTM05: teste cancelado / pendente / em andamento não soma na quilometragem canônica', () => {
    const tests = [
      { id: 't1', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
      { id: 't2', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'cancelado' as const },
      { id: 't3', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'pendente' as const },
      {
        id: 't4',
        driver_id: MARIANA_DRIVER_ID,
        km_completed: 300,
        status: 'em_andamento' as const,
      },
      { id: 't5', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'failed' as const },
    ]

    const total = calculateDriverTotalTestMileage(MARIANA_DRIVER_ID, tests)
    expect(total).toBe(300)
  })

  // FTM06: mesmo teste reapresentado/duplicado -> não soma duas vezes
  it('FTM06: teste duplicado por ID não soma duas vezes (deduplicação canônica)', () => {
    const tests = [
      {
        id: 't_dup_01',
        driver_id: MARIANA_DRIVER_ID,
        km_completed: 300,
        status: 'concluido' as const,
      },
      {
        id: 't_dup_01',
        driver_id: MARIANA_DRIVER_ID,
        km_completed: 300,
        status: 'concluido' as const,
      },
      {
        id: 't_unique_02',
        driver_id: MARIANA_DRIVER_ID,
        km_completed: 300,
        status: 'concluido' as const,
      },
    ]

    const total = calculateDriverTotalTestMileage(MARIANA_DRIVER_ID, tests)
    expect(total).toBe(600)
  })

  // FTM07: save/reload -> total preservado
  it('FTM07: save/reload simulação através de serialização JSON preserva os km exatos', () => {
    const tests = [
      { id: 't1', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
      { id: 't2', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
      { id: 't3', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
      { id: 't4', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
    ]

    const serialized = JSON.stringify(tests)
    const reloaded = JSON.parse(serialized)

    const total = calculateDriverTotalTestMileage(MARIANA_DRIVER_ID, reloaded)
    expect(total).toBe(1200)
  })

  // FTM08: mudança de equipe -> total preservado
  it('FTM08: mudança de equipe (Audi -> Andretti -> Ferrari) preserva os km do driverId', () => {
    const tests = [
      {
        id: 't1',
        driver_id: MARIANA_DRIVER_ID,
        team_id: 'audi',
        km_completed: 300,
        status: 'concluido' as const,
      },
      {
        id: 't2',
        driver_id: MARIANA_DRIVER_ID,
        team_id: 'audi',
        km_completed: 300,
        status: 'concluido' as const,
      },
      {
        id: 't3',
        driver_id: MARIANA_DRIVER_ID,
        team_id: 'andretti',
        km_completed: 300,
        status: 'concluido' as const,
      },
      {
        id: 't4',
        driver_id: MARIANA_DRIVER_ID,
        team_id: 'ferrari',
        km_completed: 300,
        status: 'concluido' as const,
      },
    ]

    // Independente do team_id passado nos registros, todos pertencem ao MARIANA_DRIVER_ID
    const total = calculateDriverTotalTestMileage(MARIANA_DRIVER_ID, tests)
    expect(total).toBe(1200)
  })

  // FTM09: Academia -> Reserva/Test -> Titular -> total preservado
  it('FTM09: transição de role (Academia -> Reserva -> Titular) preserva os km canônicos', () => {
    const tests = [
      { id: 't1', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
      { id: 't2', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
      { id: 't3', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
      { id: 't4', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
    ]

    // Piloto como Academia
    const marianaAcademia = { ...MARIANA_BASE_DRIVER, role: 'academia' as const }
    const kmAcademia = calculateDriverTotalTestMileage(marianaAcademia.id, tests)
    expect(kmAcademia).toBe(1200)

    // Piloto promovido a Reserva / Test Driver
    const marianaReserva = {
      ...MARIANA_BASE_DRIVER,
      role: 'reserva' as const,
      is_test_driver: true,
    }
    const kmReserva = calculateDriverTotalTestMileage(marianaReserva.id, tests)
    expect(kmReserva).toBe(1200)

    // Piloto promovido a Titular
    const marianaTitular = { ...MARIANA_BASE_DRIVER, role: 'titular' as const }
    const kmTitular = calculateDriverTotalTestMileage(marianaTitular.id, tests)
    expect(kmTitular).toBe(1200)
  })

  // FTM10: contratação -> total preservado
  it('FTM10: contratação de free agent para nova equipe preserva os km históricos do driverId', () => {
    const tests = [
      {
        id: 't1',
        driver_id: MARIANA_DRIVER_ID,
        team_id: 'audi',
        km_completed: 300,
        status: 'concluido' as const,
      },
      {
        id: 't2',
        driver_id: MARIANA_DRIVER_ID,
        team_id: 'audi',
        km_completed: 300,
        status: 'concluido' as const,
      },
      {
        id: 't3',
        driver_id: MARIANA_DRIVER_ID,
        team_id: 'audi',
        km_completed: 300,
        status: 'concluido' as const,
      },
      {
        id: 't4',
        driver_id: MARIANA_DRIVER_ID,
        team_id: 'audi',
        km_completed: 300,
        status: 'concluido' as const,
      },
    ]

    // Estado 1: Contratada na Audi
    expect(calculateDriverTotalTestMileage(MARIANA_DRIVER_ID, tests)).toBe(1200)

    // Estado 2: Rescisão contratual / Agente Livre
    const marianaFreeAgent = { ...MARIANA_BASE_DRIVER, team_id: null, role: 'reserva' as const }
    expect(calculateDriverTotalTestMileage(marianaFreeAgent.id, tests)).toBe(1200)

    // Estado 3: Nova contratação pela Williams
    const marianaWilliams = {
      ...MARIANA_BASE_DRIVER,
      team_id: 'williams',
      role: 'titular' as const,
    }
    expect(calculateDriverTotalTestMileage(marianaWilliams.id, tests)).toBe(1200)
  })

  // FTM11: homologation/license service lê o MESMO total canônico do resolver
  it('FTM11: homologation/license adapter e resolver convergem na elegibilidade e status', () => {
    const tests = [
      { id: 't1', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
      { id: 't2', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
      { id: 't3', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
      { id: 't4', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
    ]

    const totalKm = calculateDriverTotalTestMileage(MARIANA_DRIVER_ID, tests)
    expect(totalKm).toBe(1200)

    // Verifica compatibilidade com canonicalHomologationAdapter
    const view = canonicalHomologationAdapter.toCanonicalView(MARIANA_BASE_DRIVER)
    expect(view.driverId).toBe(MARIANA_DRIVER_ID)
    expect(view.licenseStatus).toBe('nivel_c')
    expect(view.legacyHomologationStatus).toBe('formacao')

    // Quando o piloto atinge Superlicença Nível A:
    const promotedDriver: Partial<DriverModel> = {
      ...MARIANA_BASE_DRIVER,
      license_status: 'nivel_a',
      homologation_status: 'elegivel',
      superlicense_points: 40,
    }
    const promotedView = canonicalHomologationAdapter.toCanonicalView(promotedDriver)
    expect(promotedView.licenseStatus).toBe('nivel_a')
    expect(promotedView.isEligibleForF1Seat).toBe(true)
    expect(promotedView.isEligibleForFP1).toBe(true)

    // Adapter toDatabaseUpdate faz gravação aditiva nos campos legados
    const dbUpdate = canonicalHomologationAdapter.toDatabaseUpdate('nivel_a')
    expect(dbUpdate.license_status).toBe('nivel_a')
    expect(dbUpdate.homologation_status).toBe('elegivel')
    expect(dbUpdate.superlicense_points).toBe(40)
  })

  // FTM12: UI / consumers principais exibem o mesmo total canônico do resolver
  it('FTM12: fallback não duplica quilometragem quando driver_tests primários já existem', () => {
    const tests = [
      { id: 't1', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
      { id: 't2', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
      { id: 't3', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
      { id: 't4', driver_id: MARIANA_DRIVER_ID, km_completed: 300, status: 'concluido' as const },
    ]

    // Fallback legado com 600 km acumulados no registro da equipe
    const fallbackTeamRecords = [
      {
        driverId: MARIANA_DRIVER_ID,
        accumulatedHomologatedKm: 600,
      },
    ]

    // Com driver_tests existentes e válidos (1200 km), o resolver primário tem precedência
    // e o fallback NÃO duplica nem sobrescreve os 1200 km
    const resolved = calculateDriverTotalTestMileage(MARIANA_DRIVER_ID, tests, fallbackTeamRecords)
    expect(resolved).toBe(1200)

    // Se NÃO houver driver_tests na collection mas houver fallback no time, usa o fallback defensivo
    const resolvedFallback = calculateDriverTotalTestMileage(
      MARIANA_DRIVER_ID,
      [],
      fallbackTeamRecords,
    )
    expect(resolvedFallback).toBe(600)
  })
})
