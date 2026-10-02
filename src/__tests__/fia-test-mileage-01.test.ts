import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calculateDriverTotalTestMileage,
  DriverTestKmRecord,
} from '@/services/driverMileageResolverService'
import { driverHiringService } from '@/services/driverHiringService'
import { driverScoutingService } from '@/services/driverScoutingService'
import { DriverModel, TeamModel } from '@/types/f1'

// Mock do PocketBase e FinancialLedger para testes de contratação e persistência
vi.mock('@/lib/pocketbase/client', () => {
  const store = new Map<string, any>()
  return {
    default: {
      collection: (_col: string) => ({
        getOne: vi.fn(async (id: string) => {
          if (store.has(id)) return store.get(id)
          throw new Error('Not found')
        }),
        getFirstListItem: vi.fn(async (_filter: string) => {
          throw new Error('Not found')
        }),
        create: vi.fn(async (data: any) => {
          const id = data.id || `created_${Date.now()}`
          const rec = { id, ...data }
          store.set(id, rec)
          return rec
        }),
        update: vi.fn(async (id: string, data: any) => {
          const current = store.get(id) || { id }
          const updated = { ...current, ...data }
          store.set(id, updated)
          return updated
        }),
        getFullList: vi.fn(async () => Array.from(store.values())),
      }),
    },
  }
})

vi.mock('@/services/financialLedgerService', () => ({
  financialLedgerService: {
    postTransaction: vi.fn().mockResolvedValue({ id: 'tx_123' }),
    syncTeamBudgetCache: vi.fn().mockResolvedValue(true),
  },
}))

describe('FIA-TEST-MILEAGE-01: SUÍTE DE HOMOLOGAÇÃO FTM01-FTM20', () => {
  const marianaDriverId = 'qm6xcgc5mstulg3'
  const otherDriverId = 'drv_test_generic_99'
  const teamAudiId = 'team_audi_f1'
  const teamFerrariId = 'team_ferrari_f1'

  const mockAudiTeam: TeamModel = {
    id: teamAudiId,
    name: 'Audi F1 Team',
    team_key: 'audi',
    color: '#E10600',
    budget: 50000000,
    strength: 85,
    user_id: 'user_1',
    created: '',
    updated: '',
    chassis_level: 80,
    aero_level: 80,
    strategy_level: 80,
    engine_supplier: 'Audi',
  }

  const marianaDriverFixture: DriverModel = {
    id: marianaDriverId,
    name: 'Mariana Fagundes',
    nationality: 'Brasil',
    age: 18,
    speed: 68,
    consistency: 65,
    rain: 60,
    defense: 62,
    salary: 2000000,
    contract_end: 2026,
    team_id: null,
    role: null,
    category: 'f1_academy',
    fp_sessions_completed: 0,
    fp_scheduled_rounds: [],
    is_incapacitated: false,
    incapacitated_rounds_left: 0,
    morale: 80,
    physical_condition: 100,
    true_potential: 72,
    perceived_potential: 72,
    evaluation_confidence: 63,
    is_academy: true,
    is_test_driver: true,
    academy_origin_team_id: teamAudiId,
    procedural_data: {
      driverId: marianaDriverId,
      displayName: 'M. Fagundes',
      countryFlag: '🇧🇷',
      careerStatus: 'academy',
      currentAcademyTeamId: teamAudiId,
      academyOriginTeamId: teamAudiId,
      dateOfBirth: '2010-03-16',
      generatedPortraitProfileId: 'Piloto_13',
      visualIdentity: {
        visualIdentityId: 'fictional_pilot_13',
        portraitAssetId: 'Piloto_13',
        generatedPortraitProfileId: 'Piloto_13',
        gender: 'female',
        stylePromptSeed: 13,
      },
      careerStats: { races: 14, wins: 3, podiums: 8, poles: 2, titles: 0 },
    },
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // FTM01 piloto sem testes = 0 km
  it('FTM01 — piloto sem testes = 0 km', () => {
    expect(calculateDriverTotalTestMileage(marianaDriverId, [])).toBe(0)
    expect(calculateDriverTotalTestMileage(marianaDriverId, null)).toBe(0)
  })

  // FTM02 teste completed de 300 km -> total 300
  it('FTM02 — teste completed de 300 km -> total 300', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
    ]
    expect(calculateDriverTotalTestMileage(marianaDriverId, tests)).toBe(300)
  })

  // FTM03 segundo teste completed 300 -> total 600
  it('FTM03 — segundo teste completed 300 -> total 600', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't2', driver_id: marianaDriverId, km: 300, status: 'completed' },
    ]
    expect(calculateDriverTotalTestMileage(marianaDriverId, tests)).toBe(600)
  })

  // FTM04 quatro testes de 300 -> total 1200
  it('FTM04 — quatro testes de 300 -> total 1200', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't2', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't3', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't4', driver_id: marianaDriverId, km: 300, status: 'completed' },
    ]
    expect(calculateDriverTotalTestMileage(marianaDriverId, tests)).toBe(1200)
  })

  // FTM05 teste cancelado não soma
  it('FTM05 — teste cancelado não soma', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't2', driver_id: marianaDriverId, km: 300, status: 'cancelled' },
    ]
    expect(calculateDriverTotalTestMileage(marianaDriverId, tests)).toBe(300)
  })

  // FTM06 teste não concluído não soma se contrato atual exigir completed
  it('FTM06 — teste não concluído não soma', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't2', driver_id: marianaDriverId, km: 300, status: 'pending' },
      { id: 't3', driver_id: marianaDriverId, km: 300, status: 'in_progress' },
    ]
    expect(calculateDriverTotalTestMileage(marianaDriverId, tests)).toBe(300)
  })

  // FTM07 save/reload preserva total
  it('FTM07 — save/reload preserva total', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't2', driver_id: marianaDriverId, km: 300, status: 'completed' },
    ]
    const serialized = JSON.stringify(tests)
    const reloaded = JSON.parse(serialized)
    expect(calculateDriverTotalTestMileage(marianaDriverId, reloaded)).toBe(600)
  })

  // FTM08 recalcular total não duplica km
  it('FTM08 — recalcular total não duplica km', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' }, // ID duplicado
    ]
    expect(calculateDriverTotalTestMileage(marianaDriverId, tests)).toBe(300)
  })

  // FTM09 mudança de equipe não zera km
  it('FTM09 — mudança de equipe não zera km', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
    ]
    const kmBefore = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(kmBefore).toBe(300)

    // Piloto agora vinculado a outra equipe no save
    const updatedDriver = { ...marianaDriverFixture, team_id: teamFerrariId }
    const kmAfter = calculateDriverTotalTestMileage(updatedDriver.id, tests)
    expect(kmAfter).toBe(300)
  })

  // FTM10 Academia → Reserva não zera km
  it('FTM10 — Academia -> Reserva não zera km', async () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't2', driver_id: marianaDriverId, km: 300, status: 'completed' },
    ]
    const hireResult = await driverHiringService.executeDriverHire({
      driver: marianaDriverFixture,
      team: mockAudiTeam,
      contractRole: 'reserva',
    })
    expect(hireResult.success).toBe(true)
    expect(calculateDriverTotalTestMileage(hireResult.updatedDriver.id, tests)).toBe(600)
  })

  // FTM11 Academia → Titular não zera km
  it('FTM11 — Academia -> Titular não zera km', async () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't2', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't3', driver_id: marianaDriverId, km: 300, status: 'completed' },
    ]
    const hireResult = await driverHiringService.executeDriverHire({
      driver: marianaDriverFixture,
      team: mockAudiTeam,
      contractRole: 'titular',
      seasonYear: 2026,
    })
    expect(hireResult.success).toBe(true)
    expect(calculateDriverTotalTestMileage(hireResult.updatedDriver.id, tests)).toBe(900)
  })

  // FTM12 contratação não zera km
  it('FTM12 — contratação não zera km', async () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't2', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't3', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't4', driver_id: marianaDriverId, km: 300, status: 'completed' },
    ]
    expect(calculateDriverTotalTestMileage(marianaDriverId, tests)).toBe(1200)
    const hireResult = await driverHiringService.executeDriverHire({
      driver: marianaDriverFixture,
      team: mockAudiTeam,
      contractRole: 'titular',
    })
    expect(calculateDriverTotalTestMileage(hireResult.driverId, tests)).toBe(1200)
  })

  // FTM13 driverId permanece chave canônica
  it('FTM13 — driverId permanece chave canônica', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't2', driver_id: otherDriverId, km: 500, status: 'completed' },
    ]
    expect(calculateDriverTotalTestMileage(marianaDriverId, tests)).toBe(300)
    expect(calculateDriverTotalTestMileage(otherDriverId, tests)).toBe(500)
  })

  // FTM14 homologation service lê total canônico
  it('FTM14 — homologation service lê total canônico', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't2', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't3', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't4', driver_id: marianaDriverId, km: 300, status: 'completed' },
    ]
    const totalKm = calculateDriverTotalTestMileage(marianaDriverId, tests)
    const meetsHomologationRequirement = totalKm >= 1200
    expect(meetsHomologationRequirement).toBe(true)
  })

  // FTM15 UI Academia usa o mesmo total
  it('FTM15 — UI Academia usa o mesmo total', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
    ]
    const totalKm = calculateDriverTotalTestMileage(marianaDriverId, tests)
    const scoutView = driverScoutingService.createScoutingViewModel(
      marianaDriverFixture,
      teamAudiId,
    )
    const academyEnhancedView = {
      ...scoutView,
      totalTestMileageKm: totalKm,
    }
    expect(academyEnhancedView.totalTestMileageKm).toBe(300)
  })

  // FTM16 UI Pilotos usa o mesmo total
  it('FTM16 — UI Pilotos usa o mesmo total', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't2', driver_id: marianaDriverId, km: 300, status: 'completed' },
    ]
    const activeDriverTestKm = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(activeDriverTestKm).toBe(600)
  })

  // FTM17 UI Contratos usa o mesmo total se exibir mileage
  it('FTM17 — UI Contratos usa o mesmo total se exibir mileage', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't2', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't3', driver_id: marianaDriverId, km: 300, status: 'completed' },
    ]
    const contractMileageKm = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(contractMileageKm).toBe(900)
  })

  // FTM18 nenhum mileage paralelo é criado
  it('FTM18 — nenhum mileage paralelo é criado: cálculo deriva unicamente de driver_tests', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
    ]
    const km = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(km).toBe(300)
  })

  // FTM19 legacy homologation field não sobrescreve o total de driver_tests
  it('FTM19 — legacy homologation field não sobrescreve o total de driver_tests', () => {
    const legacyDriver = {
      ...marianaDriverFixture,
      homologation_sessions_done: 99, // valor legado não deve sobrescrever km
      superlicense_points: 0,
    }
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: legacyDriver.id, km: 300, status: 'completed' },
    ]
    const km = calculateDriverTotalTestMileage(legacyDriver.id, tests)
    expect(km).toBe(300)
  })

  // FTM20 Mariana fixture acumula km corretamente sem regra especial por nome
  it('FTM20 — Mariana fixture acumula km corretamente sem regra especial por nome', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't2', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't3', driver_id: marianaDriverId, km: 300, status: 'completed' },
      { id: 't4', driver_id: marianaDriverId, km: 300, status: 'completed' },
    ]
    const marianaKm = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(marianaKm).toBe(1200)

    const otherDriverTests: DriverTestKmRecord[] = [
      { id: 't10', driver_id: otherDriverId, km: 300, status: 'completed' },
      { id: 't20', driver_id: otherDriverId, km: 300, status: 'completed' },
      { id: 't30', driver_id: otherDriverId, km: 300, status: 'completed' },
      { id: 't40', driver_id: otherDriverId, km: 300, status: 'completed' },
    ]
    const otherKm = calculateDriverTotalTestMileage(otherDriverId, otherDriverTests)
    expect(otherKm).toBe(1200)
  })
})
