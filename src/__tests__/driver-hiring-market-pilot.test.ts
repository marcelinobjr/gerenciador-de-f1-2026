import { describe, it, expect, vi, beforeEach } from 'vitest'
import { driverHiringService } from '@/services/driverHiringService'
import { TeamModel } from '@/types/f1'

// Mock do PocketBase e FinancialLedger
const createdRecords: any[] = []
const updatedRecords: { id: string; data: any }[] = []
let idCounter = 100

vi.mock('@/lib/pocketbase/client', () => {
  const store = new Map<string, any>()
  return {
    default: {
      collection: (col: string) => ({
        getOne: vi.fn(async (id: string) => {
          if (store.has(id)) return store.get(id)
          throw new Error('Not found')
        }),
        getFirstListItem: vi.fn(async (filter: string) => {
          for (const item of store.values()) {
            if (filter.includes(`name = "${item.name}"`)) {
              return item
            }
          }
          throw new Error('Not found')
        }),
        create: vi.fn(async (data: any) => {
          const pbId = `recpb${String(idCounter++).padStart(10, '0')}`
          const rec = { id: pbId, ...data }
          store.set(pbId, rec)
          createdRecords.push(rec)
          return rec
        }),
        update: vi.fn(async (id: string, data: any) => {
          const current = store.get(id) || { id }
          const updated = { ...current, ...data }
          store.set(id, updated)
          updatedRecords.push({ id, data })
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

describe('Contratação de Piloto de Mercado (Logan Sargeant mbj-038)', () => {
  const mockTeam: TeamModel = {
    id: 'nn7kruxy4qlvgwr',
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

  const loganSargeantMarketDriver = {
    id: 'mbj-038',
    name: 'Logan Sargeant',
    nationality: 'Estados Unidos',
    age: 25,
    category: 'mercado',
    speed: 78,
    consistency: 76,
    rain: 78,
    defense: 77,
    salaryUsd: 1500000,
    salary: 1500000,
    contractYears: 0,
    potentialMin: 77,
    potentialMax: 82,
    f1RacesCompleted: 36,
    superlicensePoints: 40,
    photoFilename: 'sargeant.webp',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    createdRecords.length = 0
    updatedRecords.length = 0
  })

  it('Contratar Logan Sargeant (mbj-038) cria registro no PocketBase com career_status válido "reserve"', async () => {
    const hireResult = await driverHiringService.executeDriverHire({
      driver: loganSargeantMarketDriver,
      team: mockTeam,
      contractRole: 'reserva',
      contractMode: 'immediate',
      seasonYear: 2026,
      currentRound: 1,
      durationYears: 1, // 2026 + 1 = 2027
      customSalaryUsd: 1500000,
    })

    expect(hireResult.success).toBe(true)
    // O ID final retornado deve ser o ID gerado pelo PocketBase (não mbj-038)
    expect(hireResult.driverId).not.toBe('mbj-038')
    expect(hireResult.driverId).toMatch(/^recpb/)

    // Verifica o registro criado
    expect(createdRecords.length).toBe(1)
    const created = createdRecords[0]
    expect(created.name).toBe('Logan Sargeant')
    expect(created.career_status).toBe('reserve') // Enum válido ('active' era inválido!)
    expect(created.role).toBe('reserva')
    expect(created.contract_role).toBe('reserva')
    expect(created.reserve_team_id).toBe(mockTeam.id)
    expect(created.team_id).toBeNull()
    expect(created.salary).toBe(1500000)
    expect(created.contract_end).toBe(2027)

    // Contrato canônico
    expect(hireResult.canonicalContract).toBeDefined()
    expect(hireResult.canonicalContract.role).toBe('RESERVE')
    expect(hireResult.canonicalContract.status).toBe('active')
    expect(hireResult.canonicalContract.teamId).toBe(mockTeam.id)
    expect(hireResult.canonicalContract.driverId).toBe(hireResult.driverId)
  })

  it('Contratar piloto como titular define career_status como "f1_driver"', async () => {
    const hireResult = await driverHiringService.executeDriverHire({
      driver: {
        id: 'mbj-039',
        name: 'Nyck de Vries',
        nationality: 'Holanda',
        age: 31,
        salaryUsd: 2500000,
      },
      team: mockTeam,
      contractRole: 'titular',
      contractMode: 'immediate',
      seasonYear: 2026,
      currentRound: 1,
      durationYears: 2,
    })

    expect(hireResult.success).toBe(true)
    expect(hireResult.driverId).not.toBe('mbj-039')
    const created = createdRecords[0]
    expect(created.name).toBe('Nyck de Vries')
    expect(created.career_status).toBe('f1_driver')
    expect(created.role).toBe('titular')
    expect(created.contract_role).toBe('titular')
    expect(created.team_id).toBe(mockTeam.id)
    expect(created.reserve_team_id).toBeNull()
  })
})
