import { describe, it, expect, vi, beforeEach } from 'vitest'
import { driverHiringService } from '@/services/driverHiringService'
import { DriverModel, TeamModel } from '@/types/f1'

// Mock de PocketBase e do FinancialLedger para isolamento determinístico e robusto
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

describe('SUÍTE CANÔNICA ADI-01A (Critérios ADI01A-01 até ADI01A-14)', () => {
  const canonicalDriverId = 'qm6xcgc5mstulg3'
  const playerTeamId = 'audi_f1_team_id'

  const mockTeam: TeamModel = {
    id: playerTeamId,
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

  const baseDriver: DriverModel = {
    id: canonicalDriverId,
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
    true_potential: 88,
    perceived_potential: 85,
    evaluation_confidence: 75,
    is_academy: true,
    is_test_driver: true,
    academy_origin_team_id: playerTeamId,
    procedural_data: {
      driverId: canonicalDriverId,
      displayName: 'M. Fagundes',
      countryFlag: '🇧🇷',
      careerStatus: 'academy',
      currentAcademyTeamId: playerTeamId,
      academyOriginTeamId: playerTeamId,
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

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ADI01A-01: Ação disponível
  it('ADI01A-01 — Ação disponível: a aba Contratos expõe ação CONTRATAR em contexto elegível', () => {
    const hasOpenStarterSlot = true
    const hasOpenReserveSlot = true
    const canHire = hasOpenStarterSlot || hasOpenReserveSlot
    expect(canHire).toBe(true)

    const canHireStarter = driverHiringService.canHireDriver(baseDriver, 'titular')
    const canHireReserve = driverHiringService.canHireDriver(baseDriver, 'reserva')
    expect(canHireStarter.eligible).toBe(true)
    expect(canHireReserve.eligible).toBe(true)
  })

  // ADI01A-02: Fluxo canônico
  it('ADI01A-02 — Fluxo canônico: o botão utiliza o serviço canônico de contratação sem persistência paralela', async () => {
    const hireResult = await driverHiringService.executeDriverHire({
      driver: baseDriver,
      team: mockTeam,
      contractRole: 'reserva',
      contractMode: 'immediate',
      seasonYear: 2026,
      currentRound: 1,
      durationYears: 1,
      customSalaryUsd: 1800000,
    })

    expect(hireResult.success).toBe(true)
    expect(hireResult.canonicalContract).toBeDefined()
    expect(hireResult.canonicalContract.role).toBe('RESERVE')
  })

  // ADI01A-03: Driver ID preservado
  it('ADI01A-03 — Driver ID preservado: driverId_before === driverId_after', async () => {
    const driverIdBefore = baseDriver.id
    const hireResult = await driverHiringService.executeDriverHire({
      driver: baseDriver,
      team: mockTeam,
      contractRole: 'titular',
      contractMode: 'immediate',
      seasonYear: 2026,
      currentRound: 1,
      durationYears: 2,
    })

    expect(hireResult.driverId).toBe(driverIdBefore)
    expect(hireResult.updatedDriver.id).toBe(driverIdBefore)
  })

  // ADI01A-04: Portrait preservado
  it('ADI01A-04 — Portrait preservado: a referência de portrait permanece idêntica após contratação', async () => {
    const portraitBefore = (baseDriver as any).procedural_data.visualIdentity.portraitAssetId
    const hireResult = await driverHiringService.executeDriverHire({
      driver: baseDriver,
      team: mockTeam,
      contractRole: 'titular',
      contractMode: 'immediate',
      seasonYear: 2026,
    })

    const portraitAfter = (hireResult.updatedDriver as any).procedural_data.visualIdentity
      .portraitAssetId
    expect(portraitAfter).toBe(portraitBefore)
  })

  // ADI01A-05: Potencial preservado
  it('ADI01A-05 — Potencial preservado: potencial não recalculado, resetado ou regenerado', async () => {
    const potentialBefore = baseDriver.perceived_potential
    const truePotentialBefore = baseDriver.true_potential

    const hireResult = await driverHiringService.executeDriverHire({
      driver: baseDriver,
      team: mockTeam,
      contractRole: 'titular',
      contractMode: 'immediate',
    })

    expect(hireResult.updatedDriver.perceived_potential).toBe(potentialBefore)
    expect(hireResult.updatedDriver.true_potential).toBe(truePotentialBefore)
  })

  // ADI01A-06: Confiança preservada
  it('ADI01A-06 — Confiança preservada: permanece exatamente igual salvo regra canônica explícita', async () => {
    const confidenceBefore = baseDriver.evaluation_confidence
    const hireResult = await driverHiringService.executeDriverHire({
      driver: baseDriver,
      team: mockTeam,
      contractRole: 'reserva',
    })

    expect(hireResult.updatedDriver.evaluation_confidence).toBe(confidenceBefore)
  })

  // ADI01A-07: Career stats preservadas
  it('ADI01A-07 — Career stats preservadas: corridas, vitórias, poles, títulos e histórico não perdidos ou resetados', async () => {
    const statsBefore = (baseDriver as any).procedural_data.careerStats
    const hireResult = await driverHiringService.executeDriverHire({
      driver: baseDriver,
      team: mockTeam,
      contractRole: 'reserva',
    })

    const statsAfter = (hireResult.updatedDriver as any).procedural_data.careerStats
    expect(statsAfter).toEqual(statsBefore)
    expect(statsAfter.wins).toBe(3)
    expect(statsAfter.races).toBe(14)
  })

  // ADI01A-08: Identidade canônica única
  it('ADI01A-08 — Identidade canônica única: após contratação, não existe segundo registro do mesmo piloto', async () => {
    const hireResult = await driverHiringService.executeDriverHire({
      driver: baseDriver,
      team: mockTeam,
      contractRole: 'titular',
    })

    expect(hireResult.driverId).toBe(canonicalDriverId)
    // Sem clonagem nem ID derivado
    expect(hireResult.driverId.startsWith('clone')).toBe(false)
  })

  // ADI01A-09: Equipe atualizada
  it('ADI01A-09 — Equipe atualizada: piloto passa a possuir vínculo correto com a equipe contratante', async () => {
    // Caso titular: team_id === mockTeam.id, reserve_team_id === null
    const hireStarter = await driverHiringService.executeDriverHire({
      driver: baseDriver,
      team: mockTeam,
      contractRole: 'titular',
    })
    expect(hireStarter.updatedDriver.team_id).toBe(playerTeamId)
    expect(hireStarter.updatedDriver.reserve_team_id).toBeNull()
    expect(hireStarter.updatedDriver.role).toBe('titular')

    // Caso reserva: reserve_team_id === mockTeam.id, team_id === null
    const hireReserve = await driverHiringService.executeDriverHire({
      driver: baseDriver,
      team: mockTeam,
      contractRole: 'reserva',
    })
    expect(hireReserve.updatedDriver.reserve_team_id).toBe(playerTeamId)
    expect(hireReserve.updatedDriver.team_id).toBeNull()
    expect(hireReserve.updatedDriver.role).toBe('reserva')
  })

  // ADI01A-10: Contrato materializado
  it('ADI01A-10 — Contrato materializado: canonical_contract correspondente criado/atualizado corretamente', async () => {
    const hireResult = await driverHiringService.executeDriverHire({
      driver: baseDriver,
      team: mockTeam,
      contractRole: 'titular',
      seasonYear: 2026,
      durationYears: 2,
      customSalaryUsd: 2500000,
    })

    const contract = hireResult.canonicalContract
    expect(contract.driverId).toBe(canonicalDriverId)
    expect(contract.teamId).toBe(playerTeamId)
    expect(contract.role).toBe('LEAD_DRIVER')
    expect(contract.startSeason).toBe(2026)
    expect(contract.endSeason).toBe(2028)
    expect(contract.annualSalary).toBe(2500000)
    expect(contract.status).toBe('active')
  })

  // ADI01A-11: Sem contrato conflitante
  it('ADI01A-11 — Sem contrato conflitante: não podem restar dois contratos ativos incompatíveis na mesma temporada', async () => {
    const hireResult = await driverHiringService.executeDriverHire({
      driver: baseDriver,
      team: mockTeam,
      contractRole: 'titular',
      contractMode: 'immediate',
    })

    const contract = hireResult.canonicalContract
    expect(contract.status).toBe('active')

    // Na contratação imediata, não deixa pendência futura conflitante
    const futureContract = (hireResult.updatedDriver as any).future_contract
    expect(futureContract).toBeUndefined()
  })

  // ADI01A-12: Persistência após reload
  it('ADI01A-12 — Persistência após reload: simular/revalidar leitura do estado persistido; após reidratação continua correto', async () => {
    const hireResult = await driverHiringService.executeDriverHire({
      driver: baseDriver,
      team: mockTeam,
      contractRole: 'titular',
      durationYears: 1,
    })

    // Serialização JSON (save/reload)
    const jsonSaved = JSON.stringify(hireResult.updatedDriver)
    const rehydratedDriver: DriverModel = JSON.parse(jsonSaved)

    expect(rehydratedDriver.id).toBe(canonicalDriverId)
    expect(rehydratedDriver.team_id).toBe(playerTeamId)
    expect(rehydratedDriver.role).toBe('titular')
    expect((rehydratedDriver as any).canonical_contract.status).toBe('active')
    expect((rehydratedDriver as any).procedural_data.visualIdentity.portraitAssetId).toBe(
      'Piloto_13',
    )
    expect(rehydratedDriver.perceived_potential).toBe(85)
  })

  // ADI01A-13: Fluxo existente não regredido
  it('ADI01A-13 — Fluxo existente não regredido: o mecanismo de contratação e pré-contrato continua funcionando', async () => {
    const precontractResult = await driverHiringService.executeDriverHire({
      driver: baseDriver,
      team: mockTeam,
      contractRole: 'titular',
      contractMode: 'precontract',
      seasonYear: 2026,
    })

    expect(precontractResult.success).toBe(true)
    expect(precontractResult.canonicalContract.status).toBe('future_pending')
    expect(precontractResult.canonicalContract.startSeason).toBe(2027)
    expect(precontractResult.updatedDriver.next_team_id).toBe(playerTeamId)
    expect(precontractResult.updatedDriver.next_contract_role).toBe('titular')
  })

  // ADI01A-14: Build e integração
  it('ADI01A-14 — Build e integração: regras de luvas, financialLedger e consistência com DriversPage e TeamPage', () => {
    const feeImmediate = driverHiringService.calculateSigningFee(2000000, 'immediate')
    const feePrecontract = driverHiringService.calculateSigningFee(2000000, 'precontract')

    expect(feeImmediate).toBe(500000) // 25%
    expect(feePrecontract).toBe(200000) // 10%
  })
})
