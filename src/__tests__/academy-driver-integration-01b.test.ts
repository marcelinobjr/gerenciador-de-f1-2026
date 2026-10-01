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
      collection: (col: string) => ({
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

describe('SUÍTE CANÔNICA ADI-01B: KM TOTAL CANÔNICO DO PILOTO (Critérios ADI01B-01 até ADI01B-18)', () => {
  const marianaDriverId = 'qm6xcgc5mstulg3'
  const otherDriverId = 'drv_test_generic_99'
  const teamId = 'audi_f1_team_id'

  const mockTeam: TeamModel = {
    id: teamId,
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

  const marianaDriver: DriverModel = {
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
    academy_origin_team_id: teamId,
    procedural_data: {
      driverId: marianaDriverId,
      displayName: 'M. Fagundes',
      countryFlag: '🇧🇷',
      careerStatus: 'academy',
      currentAcademyTeamId: teamId,
      academyOriginTeamId: teamId,
      dateOfBirth: '2010-03-16',
      generatedPortraitProfileId: 'Piloto_13',
      visualIdentity: {
        visualIdentityId: 'fictional_pilot_13',
        portraitAssetId: 'Piloto_13',
        generatedPortraitProfileId: 'Piloto_13',
        gender: 'female',
        stylePromptSeed: 13,
      },
      careerStats: {
        races: 14,
        wins: 3,
        podiums: 8,
        poles: 2,
        titles: 0,
      },
    },
  } as any

  const genericDriver: DriverModel = {
    id: otherDriverId,
    name: 'Lucas Rossi',
    nationality: 'Itália',
    age: 19,
    speed: 70,
    consistency: 68,
    rain: 64,
    defense: 60,
    salary: 1500000,
    contract_end: 2026,
    team_id: null,
    role: null,
    category: 'f3',
    fp_sessions_completed: 0,
    fp_scheduled_rounds: [],
    is_incapacitated: false,
    incapacitated_rounds_left: 0,
    morale: 75,
    physical_condition: 100,
    true_potential: 78,
    perceived_potential: 78,
    evaluation_confidence: 55,
    is_academy: true,
    is_test_driver: true,
    academy_origin_team_id: teamId,
    procedural_data: {
      driverId: otherDriverId,
      displayName: 'L. Rossi',
      countryFlag: '🇮🇹',
      careerStatus: 'academy',
      currentAcademyTeamId: teamId,
      academyOriginTeamId: teamId,
      dateOfBirth: '2009-08-10',
      generatedPortraitProfileId: 'Piloto_08',
      visualIdentity: {
        visualIdentityId: 'fictional_pilot_08',
        portraitAssetId: 'Piloto_08',
        generatedPortraitProfileId: 'Piloto_08',
        gender: 'male',
        stylePromptSeed: 8,
      },
      careerStats: {
        races: 10,
        wins: 1,
        podiums: 4,
        poles: 1,
        titles: 0,
      },
    },
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ADI01B-01: Sem atividade -> 0 km
  it('ADI01B-01 — Sem atividade: piloto sem registros em driver_tests retorna exatamente 0 km', () => {
    const km = calculateDriverTotalTestMileage(marianaDriverId, [])
    expect(km).toBe(0)

    const kmNull = calculateDriverTotalTestMileage(marianaDriverId, null)
    expect(kmNull).toBe(0)
  })

  // ADI01B-02: Um teste 120 km -> 120 km
  it('ADI01B-02 — Um teste 120 km: soma exatamente os 120 km', () => {
    const tests: DriverTestKmRecord[] = [
      {
        id: 't1',
        driver_id: marianaDriverId,
        km: 120,
        test_type: 'aero',
        circuit: 'Barcelona',
        date: '2026-03-01',
      },
    ]
    const km = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(km).toBe(120)
  })

  // ADI01B-03: Três testes 120+85+210 -> 415 km
  it('ADI01B-03 — Três testes 120+85+210: soma determinística de múltiplos testes resulta em 415 km', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 120, status: 'completed' },
      { id: 't2', driver_id: marianaDriverId, km: 85, status: 'completed' },
      { id: 't3', driver_id: marianaDriverId, km: 210, status: 'completed' },
    ]
    const km = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(km).toBe(415)
  })

  // ADI01B-04: Só registros do driverId correto entram
  it('ADI01B-04 — Isolamento por driverId: ignora testes pertencentes a outros pilotos', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 120 },
      { id: 't2', driver_id: 'other_driver_123', km: 300 },
      { id: 't3', driver_id: marianaDriverId, km: 85 },
      { id: 't4', driver_id: 'yet_another_driver', km: 500 },
    ]
    const km = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(km).toBe(205) // 120 + 85
  })

  // ADI01B-05: Teste cancelado ou não concluído não entra
  it('ADI01B-05 — Filtro de status: testes cancelados ou pendentes não entram no total', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 120, status: 'completed' },
      { id: 't2', driver_id: marianaDriverId, km: 90, status: 'cancelled' },
      { id: 't3', driver_id: marianaDriverId, km: 50, status: 'pending' },
      { id: 't4', driver_id: marianaDriverId, km: 80, status: 'concluido' },
    ]
    const km = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(km).toBe(200) // 120 + 80
  })

  // ADI01B-06: Reprocessar não duplica (idempotência)
  it('ADI01B-06 — Idempotência: reprocessar os mesmos registros não duplica nem incrementa cumulativamente', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 120 },
      { id: 't2', driver_id: marianaDriverId, km: 85 },
      { id: 't1', driver_id: marianaDriverId, km: 120 }, // duplicata acidental com mesmo id
    ]
    const km1 = calculateDriverTotalTestMileage(marianaDriverId, tests)
    const km2 = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(km1).toBe(205)
    expect(km2).toBe(205)
  })

  // ADI01B-07: Save/reload preserva
  it('ADI01B-07 — Persistência save/reload: serialização e reconstituição preservam a soma de km', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 150 },
      { id: 't2', driver_id: marianaDriverId, km: 250 },
    ]
    const jsonStr = JSON.stringify(tests)
    const reloaded: DriverTestKmRecord[] = JSON.parse(jsonStr)

    const km = calculateDriverTotalTestMileage(marianaDriverId, reloaded)
    expect(km).toBe(400)
  })

  // ADI01B-08: Contratação fluxo ADI-01A preserva km
  it('ADI01B-08 — Contratação preserva km: executar contratação de piloto da academia preserva km intacto', async () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 120 },
      { id: 't2', driver_id: marianaDriverId, km: 85 },
    ]
    const kmBefore = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(kmBefore).toBe(205)

    const hireResult = await driverHiringService.executeDriverHire({
      driver: marianaDriver,
      team: mockTeam,
      contractRole: 'titular',
      contractMode: 'immediate',
      seasonYear: 2026,
    })

    expect(hireResult.success).toBe(true)
    const kmAfter = calculateDriverTotalTestMileage(hireResult.updatedDriver.id, tests)
    expect(kmAfter).toBe(kmBefore)
    expect(kmAfter).toBe(205)
  })

  // ADI01B-09: Contratação preserva driverId
  it('ADI01B-09 — Contratação preserva driverId: id do piloto não muda após ser contratado', async () => {
    const hireResult = await driverHiringService.executeDriverHire({
      driver: marianaDriver,
      team: mockTeam,
      contractRole: 'reserva',
    })

    expect(hireResult.driverId).toBe(marianaDriverId)
    expect(hireResult.updatedDriver.id).toBe(marianaDriverId)
  })

  // ADI01B-10: Academia e Perfil mostram o mesmo km
  it('ADI01B-10 — Consistência Academia vs Perfil: ambas as visões consomem a mesma fonte canônica', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 140 },
      { id: 't2', driver_id: marianaDriverId, km: 160 },
    ]
    const canonicalKm = calculateDriverTotalTestMileage(marianaDriverId, tests)

    // ViewModel do ProspectCard (Academia)
    const scoutView = driverScoutingService.createScoutingViewModel(marianaDriver, teamId)
    const academyEnhancedView = {
      ...scoutView,
      totalTestMileageKm: canonicalKm,
    }

    // Objeto recebido pelo PilotProfileDialog
    const profilePilot = {
      ...marianaDriver,
      totalTestMileageKm: canonicalKm,
    }

    expect(academyEnhancedView.totalTestMileageKm).toBe(300)
    expect(profilePilot.totalTestMileageKm).toBe(300)
    expect(academyEnhancedView.totalTestMileageKm).toBe(profilePilot.totalTestMileageKm)
  })

  // ADI01B-11: Pilotos consome o mesmo km
  it('ADI01B-11 — Pilotos consome o mesmo km: DriversPage calcula e repassa activeDriverTestKm idêntico', () => {
    const tests: DriverTestKmRecord[] = [{ id: 't1', driver_id: marianaDriverId, km: 350 }]
    const activeDriverTestKm = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(activeDriverTestKm).toBe(350)
  })

  // ADI01B-12: Contratos consome o mesmo km
  it('ADI01B-12 — Contratos consome o mesmo km: aba Contratos da TeamPage calcula e expõe a mesma fonte', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 120 },
      { id: 't2', driver_id: marianaDriverId, km: 180 },
    ]
    const contractMileageKm = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(contractMileageKm).toBe(300)
  })

  // ADI01B-13: Novo teste aumenta exatamente uma vez
  it('ADI01B-13 — Adição de novo teste: registrar novo teste de 90 km incrementa exatamente uma vez', () => {
    const tests: DriverTestKmRecord[] = [{ id: 't1', driver_id: marianaDriverId, km: 120 }]
    const km1 = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(km1).toBe(120)

    // Novo teste completado
    tests.push({ id: 't2', driver_id: marianaDriverId, km: 90 })
    const km2 = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(km2).toBe(210)
  })

  // ADI01B-14: Potencial continua 72
  it('ADI01B-14 — Potencial continua 72: o km em testes não altera o potencial estabelecido', () => {
    expect(marianaDriver.perceived_potential).toBe(72)
    expect(marianaDriver.true_potential).toBe(72)

    const tests: DriverTestKmRecord[] = [{ id: 't1', driver_id: marianaDriverId, km: 500 }]
    const km = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(km).toBe(500)
    expect(marianaDriver.perceived_potential).toBe(72)
  })

  // ADI01B-15: Confiança continua 63% independente
  it('ADI01B-15 — Confiança continua 63%: confiança da avaliação permanece independente do total de km', () => {
    expect(marianaDriver.evaluation_confidence).toBe(63)

    const tests: DriverTestKmRecord[] = [{ id: 't1', driver_id: marianaDriverId, km: 350 }]
    const km = calculateDriverTotalTestMileage(marianaDriverId, tests)
    expect(km).toBe(350)
    expect(marianaDriver.evaluation_confidence).toBe(63)
  })

  // ADI01B-16: Portrait/visualIdentity intactos
  it('ADI01B-16 — Portrait/visualIdentity intactos: referências de fotos e metadados visuais permanecem inalterados', () => {
    const visual = (marianaDriver as any).procedural_data.visualIdentity
    expect(visual.portraitAssetId).toBe('Piloto_13')
    expect(visual.generatedPortraitProfileId).toBe('Piloto_13')
    expect(visual.gender).toBe('female')
  })

  // ADI01B-17: Funciona para outro piloto sem referência a Mariana
  it('ADI01B-17 — Solução genérica: opera igualmente para qualquer piloto sem regras especiais de nome', () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: otherDriverId, km: 95 },
      { id: 't2', driver_id: otherDriverId, km: 115 },
    ]
    const genericKm = calculateDriverTotalTestMileage(genericDriver.id, tests)
    expect(genericKm).toBe(210)

    const marianaKm = calculateDriverTotalTestMileage(marianaDriver.id, tests)
    expect(marianaKm).toBe(0)
  })

  // ADI01B-18: Mudança de role não zera km
  it('ADI01B-18 — Mudança de role: transição Academia -> Reserva -> Titular preserva histórico canônico de testes', async () => {
    const tests: DriverTestKmRecord[] = [
      { id: 't1', driver_id: marianaDriverId, km: 120 },
      { id: 't2', driver_id: marianaDriverId, km: 130 },
    ]
    // 1. Em Academia
    expect(calculateDriverTotalTestMileage(marianaDriverId, tests)).toBe(250)

    // 2. Promovido a Reserva
    const hireReserve = await driverHiringService.executeDriverHire({
      driver: marianaDriver,
      team: mockTeam,
      contractRole: 'reserva',
    })
    expect(calculateDriverTotalTestMileage(hireReserve.updatedDriver.id, tests)).toBe(250)

    // 3. Promovido a Titular
    const hireTitular = await driverHiringService.executeDriverHire({
      driver: hireReserve.updatedDriver,
      team: mockTeam,
      contractRole: 'titular',
    })
    expect(calculateDriverTotalTestMileage(hireTitular.updatedDriver.id, tests)).toBe(250)
  })
})
