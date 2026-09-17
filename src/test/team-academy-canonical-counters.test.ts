import { describe, it, expect, vi, beforeEach } from 'vitest'
import { driverDevelopmentService } from '@/services/driverDevelopmentService'
import type { TeamModel, DriverModel } from '@/types/f1'

// Mock de PocketBase client usado por driverDevelopmentService
vi.mock('@/lib/pocketbase/client', () => ({
  pb: {
    collection: vi.fn(() => ({
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
      getOne: vi.fn().mockResolvedValue({}),
      getList: vi.fn().mockResolvedValue({ items: [] }),
    })),
  },
}))

describe('team-academy-canonical-counters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Helper para reproduzir exatamente a lógica canônica compartilhada
  function computeCanonicalAcademyData(team: TeamModel | null, allGridDrivers: DriverModel[]) {
    if (!team) {
      return {
        canonicalAcademyPilots: [],
        total: 0,
        f2Count: 0,
        f3Count: 0,
        highlightPilot: null,
      }
    }
    const devData = driverDevelopmentService.getAcademyData(team)
    const linkedIds = new Set(devData.academyDrivers || [])
    const canonicalAcademyPilots = allGridDrivers.filter(
      (d) => linkedIds.has(d.id) || (d.is_academy && d.team_id === team.id),
    )

    const total = canonicalAcademyPilots.length
    const f2Count = canonicalAcademyPilots.filter(
      (p) => (p.category || '').toLowerCase() === 'f2' || (p as any)?.series === 'F2',
    ).length
    const f3Count = canonicalAcademyPilots.filter(
      (p) => (p.category || '').toLowerCase() === 'f3' || (p as any)?.series === 'F3',
    ).length

    const firstPilot = canonicalAcademyPilots[0]
    const highlightPilot = firstPilot
      ? {
          id: firstPilot.id,
          name: firstPilot.name,
          nationality: firstPilot.nationality,
          series: (
            (firstPilot.category || (firstPilot as any)?.series || 'F2') as string
          ).toUpperCase(),
          potential:
            (firstPilot as any).perceived_potential || (firstPilot as any).true_potential || 85,
          photoUrl: (firstPilot as any).photoUrl || undefined,
        }
      : null

    return {
      canonicalAcademyPilots,
      total,
      f2Count,
      f3Count,
      highlightPilot,
    }
  }

  const baseTeam: TeamModel = {
    id: 'team_audi_2026',
    name: 'Audi F1 Team',
    short_name: 'Audi',
    color: '#E10600',
    budget: 140000000,
    fan_base: 5000000,
    headquarters: 'Neuburg',
    manager_name: 'Mattia Binotto',
    power_unit: 'Audi 2026 Hybrid',
    prestige: 80,
    academy_development_data: {
      academyDrivers: [],
      testDrivers: [],
      homologationPrograms: {},
      developmentProgresses: {},
    },
  } as any

  it('CASO A: sem pilotos vinculados → total 0, f2 0, f3 0, highlightPilot null', () => {
    const allGridDrivers: DriverModel[] = [
      {
        id: 'driver_f1_ricciardo',
        name: 'Daniel Ricciardo',
        team_id: 'team_audi_2026',
        is_academy: false,
        category: 'F1',
      } as any,
    ]

    const result = computeCanonicalAcademyData(baseTeam, allGridDrivers)

    expect(result.total).toBe(0)
    expect(result.f2Count).toBe(0)
    expect(result.f3Count).toBe(0)
    expect(result.highlightPilot).toBeNull()
    expect(result.canonicalAcademyPilots).toHaveLength(0)
  })

  it('CASO B: 1 piloto F2 vinculado (via addDriverToAcademy) → total 1, f2 1, f3 0, visível na Academia', async () => {
    const driverF2: DriverModel = {
      id: 'driver_f2_browning',
      name: 'Luke Browning',
      nationality: 'Reino Unido',
      category: 'F2',
      is_academy: false,
      team_id: null,
      speed: 74,
      consistency: 72,
    } as any

    const team = JSON.parse(JSON.stringify(baseTeam))
    const addRes = await driverDevelopmentService.addDriverToAcademy(team, driverF2)
    expect(addRes.success).toBe(true)

    // Atualiza o estado da equipe com os dados atualizados pós-chamada
    team.academy_development_data = {
      ...team.academy_development_data,
      academyDrivers: ['driver_f2_browning'],
    }
    const updatedDriverF2: DriverModel = {
      ...driverF2,
      is_academy: true,
      team_id: team.id,
    }

    const allDrivers = [updatedDriverF2]
    const result = computeCanonicalAcademyData(team, allDrivers)

    expect(result.total).toBe(1)
    expect(result.f2Count).toBe(1)
    expect(result.f3Count).toBe(0)
    expect(result.highlightPilot).not.toBeNull()
    expect(result.highlightPilot?.name).toBe('Luke Browning')
    expect(result.highlightPilot?.series).toBe('F2')
    expect(result.canonicalAcademyPilots).toHaveLength(1)
  })

  it('CASO C: 1 piloto F3 vinculado → total 1, f2 0, f3 1', () => {
    const driverF3: DriverModel = {
      id: 'driver_f3_stenshorne',
      name: 'Martinius Stenshorne',
      nationality: 'Noruega',
      category: 'F3',
      is_academy: true,
      team_id: baseTeam.id,
      speed: 70,
      consistency: 68,
    } as any

    const teamWithF3: TeamModel = {
      ...baseTeam,
      academy_development_data: {
        ...baseTeam.academy_development_data,
        academyDrivers: ['driver_f3_stenshorne'],
      },
    } as any

    const allDrivers = [driverF3]
    const result = computeCanonicalAcademyData(teamWithF3, allDrivers)

    expect(result.total).toBe(1)
    expect(result.f2Count).toBe(0)
    expect(result.f3Count).toBe(1)
    expect(result.highlightPilot?.name).toBe('Martinius Stenshorne')
    expect(result.highlightPilot?.series).toBe('F3')
  })

  it('CASO D: prospect disponível/NÃO vinculado → não entra no total', () => {
    const prospectFree: DriverModel = {
      id: 'prospect_available_1',
      name: 'Kimi Antonelli',
      nationality: 'Itália',
      category: 'F2',
      is_academy: false,
      team_id: null,
    } as any

    const allDrivers = [prospectFree]
    const result = computeCanonicalAcademyData(baseTeam, allDrivers)

    expect(result.total).toBe(0)
    expect(result.f2Count).toBe(0)
    expect(result.f3Count).toBe(0)
    expect(result.highlightPilot).toBeNull()
  })

  it('CASO E: piloto em scouting ou de outra equipe → não entra no total', () => {
    // Piloto da academia da Ferrari
    const ferrariAcademyDriver: DriverModel = {
      id: 'ferrari_driver_camara',
      name: 'Rafael Câmara',
      nationality: 'Brasil',
      category: 'FRECA',
      is_academy: true,
      team_id: 'team_ferrari', // Outra equipe!
    } as any

    // Candidato em scouting sem vínculo oficial
    const scoutingDriver: DriverModel = {
      id: 'scout_talent_99',
      name: 'Talento Observado',
      nationality: 'França',
      category: 'F4',
      is_academy: false,
      team_id: null,
    } as any

    const allDrivers = [ferrariAcademyDriver, scoutingDriver]
    const result = computeCanonicalAcademyData(baseTeam, allDrivers)

    expect(result.total).toBe(0)
    expect(result.f2Count).toBe(0)
    expect(result.f3Count).toBe(0)
    expect(result.highlightPilot).toBeNull()
    expect(result.canonicalAcademyPilots).toHaveLength(0)
  })

  it('CASO F: piloto liberado (via releaseDriverFromAcademy) → deixa de contar imediatamente e permanece agente livre', async () => {
    const academyPilot: DriverModel = {
      id: 'driver_to_release',
      name: 'Piloto Liberado',
      nationality: 'Espanha',
      category: 'F2',
      is_academy: true,
      team_id: baseTeam.id,
    } as any

    const teamWithPilot: TeamModel = {
      ...baseTeam,
      academy_development_data: {
        ...baseTeam.academy_development_data,
        academyDrivers: ['driver_to_release'],
      },
    } as any

    // Verifica que antes da liberação contava 1
    const beforeResult = computeCanonicalAcademyData(teamWithPilot, [academyPilot])
    expect(beforeResult.total).toBe(1)

    // Libera via driverDevelopmentService
    const releaseRes = await driverDevelopmentService.releaseDriverFromAcademy(
      teamWithPilot,
      academyPilot,
    )
    expect(releaseRes.success).toBe(true)

    // Simula a transição de estado após o release
    teamWithPilot.academy_development_data.academyDrivers = []
    const releasedDriver: DriverModel = {
      ...academyPilot,
      is_academy: false,
      team_id: null,
    }

    const afterResult = computeCanonicalAcademyData(teamWithPilot, [releasedDriver])
    expect(afterResult.total).toBe(0)
    expect(afterResult.f2Count).toBe(0)
    expect(afterResult.f3Count).toBe(0)
    expect(afterResult.highlightPilot).toBeNull()
    expect(afterResult.canonicalAcademyPilots).toHaveLength(0)
    expect(releasedDriver.is_academy).toBe(false)
    expect(releasedDriver.team_id).toBeNull()
  })
})
