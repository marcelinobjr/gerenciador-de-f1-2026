import { describe, it, expect } from 'vitest'
import { getTeamAsset, getTeamSideView, getTeamLogo } from '@/data/assets/teamAssets'
import { getDriverImage } from '@/data/assets/driverAssets'
import { getStaffImage } from '@/data/assets/staffAssets'
import { getCircuitImage } from '@/data/assets/circuitAssets'
import { teamRosterService } from '@/services/teamRosterService'
import { technicalOrganizationService } from '@/services/technicalOrganizationService'
import { DriverModel, TeamModel } from '@/types/f1'

describe('MICRO-PATCH v0.0.271 — FRENTE A & B: Manifests, Lookups de Assets e Fallback Limpo', () => {
  it('lookup Audi retorna Audi_VL.jpg com caminho padronizado', () => {
    const audiSideView = getTeamSideView('audi')
    expect(audiSideView).toBe('/assets/teams/sideviews/Audi_VL.jpg')

    const audiAsset = getTeamAsset('audi-sport')
    expect(audiAsset).not.toBeNull()
    expect(audiAsset?.sideViewFileName).toBe('Audi_VL.jpg')
  })

  it('manifest resolve grafias irregulares e aliases de equipes corretamente', () => {
    // Red Bull
    expect(getTeamSideView('red_bull')).toBe('/assets/teams/sideviews/REd_Bull_VL.jpg')
    expect(getTeamSideView('rbr')).toBe('/assets/teams/sideviews/REd_Bull_VL.jpg')
    // McLaren
    expect(getTeamSideView('mclaren')).toBe('/assets/teams/sideviews/MCLaren_VL.jpg')
    expect(getTeamSideView('mcl')).toBe('/assets/teams/sideviews/MCLaren_VL.jpg')
    // Porsche
    expect(getTeamSideView('porsche')).toBe('/assets/teams/sideviews/Porshe_VL.jpg')
    expect(getTeamSideView('porshe')).toBe('/assets/teams/sideviews/Porshe_VL.jpg')
    // Cadillac
    expect(getTeamSideView('cadillac')).toBe('/assets/teams/sideviews/Cadilac_VL.jpg')
    expect(getTeamSideView('cadilac')).toBe('/assets/teams/sideviews/Cadilac_VL.jpg')
    // Renault / Alpine
    expect(getTeamSideView('renault')).toBe('/assets/teams/sideviews/Renaut_VL.jpg')
    expect(getTeamSideView('alpine')).toBe('/assets/teams/sideviews/Renaut_VL.jpg')
    // Lamborghini
    expect(getTeamSideView('lamborghini')).toBe('/assets/teams/sideviews/Lamborguini_VL.jpg')
    expect(getTeamSideView('lamborguini')).toBe('/assets/teams/sideviews/Lamborguini_VL.jpg')
  })

  it('asset ausente ou equipe desconhecida retorna fallback limpo sem quebra ou erro', () => {
    expect(getTeamSideView('equipe_desconhecida_xyz')).toBeNull()
    expect(getTeamLogo('equipe_desconhecida_xyz')).toBeNull()
    expect(getDriverImage('piloto_fantasma_xyz')).toBeNull()
    expect(getStaffImage('engenheiro_inexistente')).toBeNull()
    expect(getCircuitImage('circuito_marte')).toBeNull()
  })

  it('driver assets resolve caminhos locais e fallback de fotos do drive', () => {
    const bortoletoImg = getDriverImage('Gabriel Bortoleto')
    expect(bortoletoImg).toBe('/assets/drivers/05-Gabriel_Bortoleto.jpg')

    const norrisImg = getDriverImage('Lando Norris')
    expect(norrisImg).toBe('/assets/drivers/4-Lando_Noris.jpg')

    const palmowskiImg = getDriverImage('Alisha Palmowski')
    expect(palmowskiImg).toBe('/assets/drivers/Alisha_Palmowski.jpg')
  })

  it('staff assets e circuit assets funcionam com normalização canônica', () => {
    expect(getStaffImage('Enrico Cardile')).toBe('/assets/staff/Enrico_Cardile.jpg')
    expect(getStaffImage('Mattia Binotto')).toBe('/assets/staff/Mattia_Binotto.jpg')
    expect(getCircuitImage('interlagos')).toBe('/assets/circuits/interlagos_map.png')
    expect(getCircuitImage('monaco')).toBe('/assets/circuits/monaco_map.png')
  })
})

describe('MICRO-PATCH v0.0.271 — FRENTE C: Roster Canônico 2+1+2 e Constraints', () => {
  const mockTeam: TeamModel = {
    id: 'team_audi_2026',
    name: 'Audi Revolut F1 Team',
    color: '#E10600',
    budget: 100000000,
    created: '2026-01-01',
    updated: '2026-01-01',
    academy_development_data: {
      academyDrivers: ['d_acad_1', 'd_acad_2'],
    },
  } as any

  const d1: DriverModel = {
    id: 'd1',
    name: 'Gabriel Bortoleto',
    team_id: 'team_audi_2026',
    role: 'titular',
    age: 21,
    superlicense_points: 45,
    license_status: 'nivel_a',
  } as any

  const d2: DriverModel = {
    id: 'd2',
    name: 'Nico Hulkenberg',
    team_id: 'team_audi_2026',
    role: 'titular',
    age: 38,
    superlicense_points: 50,
    license_status: 'nivel_a',
  } as any

  const d3_extra: DriverModel = {
    id: 'd3_extra',
    name: 'Alisha Palmowski',
    team_id: 'team_audi_2026',
    role: 'titular',
    age: 19,
    superlicense_points: 15,
    license_status: 'nivel_b',
  } as any

  const d_reserve: DriverModel = {
    id: 'd_reserve',
    name: 'Daniel Ricciardo',
    team_id: '',
    reserve_team_id: 'team_audi_2026',
    role: 'reserva',
    age: 36,
    superlicense_points: 50,
    license_status: 'nivel_a',
  } as any

  const d_acad1: DriverModel = {
    id: 'd_acad_1',
    name: 'Jovem Talento 1',
    team_id: '',
    role: 'academia',
    is_academy: true,
  } as any

  const d_acad2: DriverModel = {
    id: 'd_acad_2',
    name: 'Jovem Talento 2',
    team_id: '',
    role: 'academia',
    is_academy: true,
  } as any

  it('roster canônico respeita rigorosamente 2 titulares + 1 reserva + 2 academia (elimina Titular #3/#4)', () => {
    // Passamos 3 titulares com team_id da Audi (incluindo Alisha Palmowski que causava Titular #3)
    const drivers = [d1, d2, d3_extra, d_reserve, d_acad1, d_acad2]
    const roster = teamRosterService.buildTeamRoster(mockTeam, drivers)

    // O roster canônico corta estritamente no teto regulamentar de 2 titulares
    expect(roster.titularCount).toBe(2)
    expect(roster.titulars.length).toBe(2)
    expect(roster.driver1?.id).toBe('d1')
    expect(roster.driver2?.id).toBe('d2')
    expect(roster.titulars.some((t) => t.id === 'd3_extra')).toBe(false) // Titular #3 barrado na fonte

    // Reserva limitado a exatamente 1
    expect(roster.reserveCount).toBe(1)
    expect(roster.reserve?.id).toBe('d_reserve')

    // Academia limitada a 2
    expect(roster.academyCount).toBe(2)
    expect(roster.academyDrivers.length).toBe(2)
  })

  it('terceiro titular é bloqueado por constraint no serviço', () => {
    const drivers = [d1, d2]
    const roster = teamRosterService.buildTeamRoster(mockTeam, drivers)
    const validation = teamRosterService.validateRoleAssignment(roster, d3_extra, 'titular')

    expect(validation.valid).toBe(false)
    expect(validation.error).toBeDefined()
  })

  it('titular sem Superlicença válida é bloqueado mesmo se houver vaga livre', () => {
    const driversWithOneSlot = [d1] // Apenas 1 titular ativo
    const roster = teamRosterService.buildTeamRoster(mockTeam, driversWithOneSlot)
    expect(roster.titularCount).toBe(1)

    // Tentar promover piloto sem superlicença
    const rookieWithoutLicense: DriverModel = {
      id: 'rookie',
      name: 'Rookie Inexperiente',
      team_id: '',
      role: '',
      age: 18,
      superlicense_points: 10,
      homologation_sessions_done: 0,
    } as any

    const validation = teamRosterService.validateRoleAssignment(
      roster,
      rookieWithoutLicense,
      'titular',
    )
    expect(validation.valid).toBe(false)
    expect(validation.error).toContain('Superlicença FIA')
  })

  it('reserva elegível FIA é permitido se slot estiver vago e segundo reserva é bloqueado', () => {
    const driversWithoutReserve = [d1, d2]
    const roster = teamRosterService.buildTeamRoster(mockTeam, driversWithoutReserve)
    expect(roster.reserveCount).toBe(0)

    // Adição de reserva elegível
    const validReserveValidation = teamRosterService.validateRoleAssignment(
      roster,
      d_reserve,
      'reserva',
    )
    expect(validReserveValidation.valid).toBe(true)

    // Se já tiver reserva, segundo reserva é bloqueado
    const rosterWithReserve = teamRosterService.buildTeamRoster(mockTeam, [d1, d2, d_reserve])
    const secondReserve: DriverModel = {
      id: 'reserve_2',
      name: 'Segundo Reserva',
      superlicense_points: 30,
      age: 24,
    } as any
    const blockSecondReserve = teamRosterService.validateRoleAssignment(
      rosterWithReserve,
      secondReserve,
      'reserva',
    )
    expect(blockSecondReserve.valid).toBe(false)
    expect(blockSecondReserve.error).toContain('já possui 1 piloto reserva')
  })

  it('exclusividade de papel impede que o mesmo piloto ocupe dois slots simultaneamente', () => {
    const duplicatedDriver: DriverModel = {
      id: 'd1',
      name: 'Gabriel Bortoleto',
      team_id: 'team_audi_2026',
      reserve_team_id: 'team_audi_2026', // erroneamente nos dois
      role: 'titular',
    } as any

    const roster = teamRosterService.buildTeamRoster(mockTeam, [duplicatedDriver])
    // Não pode aparecer como titular e reserva ao mesmo tempo
    expect(roster.titulars.map((d) => d.id)).toContain('d1')
    expect(roster.reserves.map((d) => d.id)).not.toContain('d1')
    expect(roster.allLinkedDrivers.filter((d) => d.id === 'd1').length).toBe(1)
  })
})

describe('MICRO-PATCH v0.0.271 — FRENTE D & E: Rescisões Canônicas de Piloto e Staff', () => {
  it('cálculo canônico de multa rescisória de staff retorna valor correto ou zero quando vencido', () => {
    // Caso 1: Contrato futuro (2 anos restantes em relação a 2026 => contract_end = 2028)
    const staffActive = {
      salary: 1200000,
      contract_end: 2028,
    }
    const penaltyMultiYear = technicalOrganizationService.calculateStaffTerminationFee(
      staffActive,
      2026,
    )
    // 1.200.000 * 0.5 * 2 = 1.200.000
    expect(penaltyMultiYear).toBe(1200000)

    // Caso 2: Contrato vencendo no ano atual (2026) => 25% de multa
    const staffCurrentYear = {
      salary: 1000000,
      contract_end: 2026,
    }
    const penaltyCurrent = technicalOrganizationService.calculateStaffTerminationFee(
      staffCurrentYear,
      2026,
    )
    expect(penaltyCurrent).toBe(250000)

    // Caso 3: Contrato já vencido (contract_end = 2025 < 2026) => multa = 0
    const staffExpired = {
      salary: 1000000,
      contract_end: 2025,
    }
    const penaltyZero = technicalOrganizationService.calculateStaffTerminationFee(
      staffExpired,
      2026,
    )
    expect(penaltyZero).toBe(0)
  })

  it('dispensa de staff deixa o cargo formalmente vago na organização técnica sem mock fictício', () => {
    const mockOrg = technicalOrganizationService.createDefaultOrganization('team_audi_2026', 'audi')
    expect(mockOrg.members.technical_director).not.toBeNull()

    const result = technicalOrganizationService.dismissStaffMember(
      mockOrg,
      'technical_director',
      2026,
      1,
    )

    // Cargo vago
    expect(result.updatedOrg.members.technical_director).toBeNull()
    // Titular desvinculado e retornado como agente livre
    expect(result.departedStaff).not.toBeNull()
    expect(result.departedStaff?.currentTeamId).toBeNull()
    // Multa calculada
    expect(result.terminationFee).toBeGreaterThanOrEqual(0)
  })

  it('demissão repetida ou em cargo já vago lança erro controlado sem duplicar multas', () => {
    const mockOrg = technicalOrganizationService.createDefaultOrganization('team_audi_2026', 'audi')
    const firstDismissal = technicalOrganizationService.dismissStaffMember(
      mockOrg,
      'technical_director',
      2026,
      1,
    )

    expect(() => {
      technicalOrganizationService.dismissStaffMember(
        firstDismissal.updatedOrg,
        'technical_director',
        2026,
        1,
      )
    }).toThrow('Membro de staff não encontrado ou já desligado da equipe.')
  })
})
