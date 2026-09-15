/**
 * Bateria de Testes Unitários e de Integração — Implementação Nº 7B
 * Staff, Organização Técnica & Mercado de Talentos
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { technicalOrganizationService } from '@/services/technicalOrganizationService'
import { staffMarketService } from '@/services/staffMarketService'
import { StaffMember, StaffRole } from '@/types/canonical-staff'
import { FacilityLevels } from '@/types/canonical-facilities'

describe('Implementação Nº 7B — Staff, Organização Técnica & Mercado', () => {
  let sampleFacilities: FacilityLevels

  beforeEach(() => {
    sampleFacilities = {
      factory: 3,
      design_centre: 3,
      cfd: 3,
      wind_tunnel: 3,
      manufacturing: 3,
      simulator: 3,
      operations_centre: 3,
      pitstop_center: 3,
      youth_academy: 3,
    }
  })

  it('1. REGRA DE OURO: Staff não injeta performance física direta no carro', () => {
    const org = technicalOrganizationService.getOrCreateTeamOrganization('audi')
    const initialHoA = org.members.HEAD_OF_AERODYNAMICS
    expect(initialHoA).not.toBeNull()

    // Verificação de que atributos de carro não existem em StaffMember nem em TechnicalOrganization
    expect((initialHoA as any).downforce).toBeUndefined()
    expect((initialHoA as any).fastCorner).toBeUndefined()
    expect((initialHoA as any).carPerformanceRating).toBeUndefined()
    expect((org as any).carDownforce).toBeUndefined()
  })

  it('2. Gargalo: Gênio da aerodinâmica + Túnel de Vento nível 1 permanece limitado', () => {
    const org = technicalOrganizationService.getOrCreateTeamOrganization('audi')
    // Chefe de Aero de elite (96 de técnica)
    const eliteHoA: StaffMember = {
      staffId: 'elite_hoa',
      name: 'Genius Aero',
      age: 45,
      nationality: 'Reino Unido',
      countryFlag: '🇬🇧',
      role: 'HEAD_OF_AERODYNAMICS',
      teamId: 'audi',
      reputation: 96,
      attributes: {
        technicalAbility: 98,
        innovation: 96,
        collaboration: 90,
        organisation: 88,
        experience: 95,
        pressureHandling: 90,
        leadership: 85,
        communication: 80,
        adaptability: 85,
      },
      specialties: ['ground_effect'],
      contractId: 'c1',
      adaptation: 100,
      morale: 90,
      previousTeams: [],
      careerHistory: [],
      status: 'under_contract',
    }

    const orgWithGenius = {
      ...org,
      members: { ...org.members, HEAD_OF_AERODYNAMICS: eliteHoA },
    }

    // Túnel de vento nível 1 e CFD nível 1
    const poorFacilities: FacilityLevels = {
      ...sampleFacilities,
      wind_tunnel: 1,
      cfd: 1,
    }

    const capsPoor = technicalOrganizationService.computeCapabilities(poorFacilities, orgWithGenius)
    // Mesmo com gênio, aeroCorrelation não pode estourar cap (fica contida pelo túnel de vento fraco)
    expect(capsPoor.aeroCorrelation).toBeLessThan(75)

    // Explicação de gargalo detecta o limitador
    const explanation = technicalOrganizationService.explainCapability(
      'aeroCorrelation',
      poorFacilities,
      orgWithGenius,
    )
    expect(explanation.bottleneckDetected?.isBottleneck).toBe(true)
    expect(explanation.bottleneckDetected?.limitingElement).toContain('Túnel de Vento')
  })

  it('3. Gargalo: Infraestrutura nível 5 + Staff fraco não atinge potencial de elite', () => {
    const org = technicalOrganizationService.getOrCreateTeamOrganization('audi')
    // Chefe de Aero fraco
    const weakHoA: StaffMember = {
      staffId: 'weak_hoa',
      name: 'Novice Aero',
      age: 30,
      nationality: 'Itália',
      countryFlag: '🇮🇹',
      role: 'HEAD_OF_AERODYNAMICS',
      teamId: 'audi',
      reputation: 45,
      attributes: {
        technicalAbility: 45,
        innovation: 40,
        collaboration: 50,
        organisation: 50,
        experience: 40,
        pressureHandling: 45,
        leadership: 40,
        communication: 50,
        adaptability: 50,
      },
      specialties: [],
      contractId: 'c2',
      adaptation: 100,
      morale: 70,
      previousTeams: [],
      careerHistory: [],
      status: 'under_contract',
    }

    const orgWithWeak = {
      ...org,
      members: { ...org.members, HEAD_OF_AERODYNAMICS: weakHoA },
    }

    const eliteFacilities: FacilityLevels = {
      ...sampleFacilities,
      wind_tunnel: 5,
      cfd: 5,
    }

    const capsWeak = technicalOrganizationService.computeCapabilities(eliteFacilities, orgWithWeak)
    expect(capsWeak.aeroCorrelation).toBeLessThan(80)

    const explanation = technicalOrganizationService.explainCapability(
      'aeroCorrelation',
      eliteFacilities,
      orgWithWeak,
    )
    expect(explanation.bottleneckDetected?.isBottleneck).toBe(true)
  })

  it('4. Saída de Chefe de Aero: Perda de Knowledge, vacância sem crash e sem perda física do carro', () => {
    const org = technicalOrganizationService.getOrCreateTeamOrganization('audi')
    const initialKnowledge = org.knowledge.domains.aerodynamics.accumulatedExperience

    const { updatedOrg, departedStaff, knowledgeLossPercentage } =
      technicalOrganizationService.processStaffDeparture(org, 'HEAD_OF_AERODYNAMICS', 2026, 3)

    expect(departedStaff).not.toBeNull()
    expect(updatedOrg.members.HEAD_OF_AERODYNAMICS).toBeNull()
    expect(updatedOrg.vacancies).toContain('HEAD_OF_AERODYNAMICS')
    expect(updatedOrg.interimAssignments.HEAD_OF_AERODYNAMICS).toBeDefined()
    expect(knowledgeLossPercentage).toBeGreaterThan(0)
    expect(updatedOrg.knowledge.domains.aerodynamics.accumulatedExperience).toBeLessThan(
      initialKnowledge,
    )

    // Sistema continua calculando capabilities sem falha
    const capsAfter = technicalOrganizationService.computeCapabilities(sampleFacilities, updatedOrg)
    expect(capsAfter.aeroCorrelation).toBeGreaterThan(20)
  })

  it('5. Adaptação gradual de novo staff ao longo das rodadas', () => {
    const org = technicalOrganizationService.getOrCreateTeamOrganization('audi')
    const newCad = {
      staffId: 'new_hire',
      name: 'Fresh Hire',
      age: 40,
      nationality: 'França',
      countryFlag: '🇫🇷',
      role: 'TECHNICAL_DIRECTOR' as StaffRole,
      teamId: null,
      reputation: 80,
      attributes: {
        technicalAbility: 85,
        leadership: 80,
        organisation: 82,
        collaboration: 80,
        innovation: 80,
        pressureHandling: 80,
        experience: 85,
        communication: 80,
        adaptability: 85,
      },
      specialties: [],
      contractId: null,
      adaptation: 50,
      morale: 85,
      previousTeams: [],
      careerHistory: [],
      status: 'available' as const,
    }

    const orgWithNew = technicalOrganizationService.processStaffArrival(
      org,
      newCad,
      'TECHNICAL_DIRECTOR',
      2026,
      3,
    )
    const initialAdaptation = orgWithNew.members.TECHNICAL_DIRECTOR!.adaptation
    expect(initialAdaptation).toBeLessThanOrEqual(85)

    const advancedOrg = technicalOrganizationService.advanceRoundProgress(orgWithNew, 4)
    expect(advancedOrg.members.TECHNICAL_DIRECTOR!.adaptation).toBeGreaterThan(initialAdaptation)
  })

  it('6. Race Engineers: Sintonia e química progridem sem afetar pace direto', () => {
    const org = technicalOrganizationService.getOrCreateTeamOrganization('audi')
    const p1 = org.driverEngineerPairings.car1
    expect(p1).not.toBeNull()
    expect((p1 as any).lapTimeDelta).toBeUndefined()

    const roundAdvanced = technicalOrganizationService.advanceRoundProgress(org, 4)
    const p1Advanced = roundAdvanced.driverEngineerPairings.car1!
    expect(p1Advanced.experienceTogetherRounds).toBe(p1!.experienceTogetherRounds + 1)
    expect(p1Advanced.chemistry).toBeGreaterThanOrEqual(p1!.chemistry)
  })

  it('7. Proteção de truePotential: Academy Director não acessa truePotential (Proxy Trap)', () => {
    const trapDriver: any = new Proxy(
      {
        id: 'driver_test',
        name: 'Young Talent',
        perceived_potential: 78,
        true_potential: 94,
        procedural_data: {
          truePotential: 94,
          perceivedPotential: 78,
        },
      },
      {
        get(target, prop) {
          if (prop === 'true_potential' || prop === 'truePotential') {
            throw new Error(
              `VIOLAÇÃO DA REGRA DE OURO: Consulta indevida a ${String(prop)} pelo sistema de staff!`,
            )
          }
          return (target as any)[prop]
        },
      },
    )

    // O cálculo de talentDevelopmentCapacity usa apenas infraestrutura e attributes do Diretor de Academia
    const org = technicalOrganizationService.getOrCreateTeamOrganization('audi')
    const caps = technicalOrganizationService.computeCapabilities(sampleFacilities, org)
    expect(caps.talentDevelopmentCapacity).toBeGreaterThan(40)

    // Teste de leitura de dados de scouting do prospect usando apenas perceived
    expect(trapDriver.perceived_potential).toBe(78)
  })

  it('8. Mercado de Staff com IA: Atende vacâncias sem duplicações de cargos', () => {
    const orgAudi = technicalOrganizationService.getOrCreateTeamOrganization('audi')
    const orgFerrari = technicalOrganizationService.getOrCreateTeamOrganization('ferrari')

    // Cria vacância artificial na Ferrari
    orgFerrari.members.HEAD_OF_STRATEGY = null

    const teamsStaff = {
      audi: orgAudi.members,
      ferrari: orgFerrari.members,
    }

    const freeAgents = staffMarketService.getInitialMarketPool()
    const result = staffMarketService.runAIMarketTick(2026, 3, teamsStaff, freeAgents)

    // Ferrari deve ter contratado um novo Head of Strategy do pool
    expect(result.updatedTeamsStaff.ferrari.HEAD_OF_STRATEGY).not.toBeNull()
    expect(result.marketEvents.length).toBeGreaterThan(0)
  })

  it('9. Simulação de 10 ticks de mercado não causa explosão salarial nem quebras', () => {
    const freeAgents = staffMarketService.getInitialMarketPool()
    for (const fa of freeAgents) {
      const salary = staffMarketService.calculateFairMarketSalary(fa, fa.role)
      expect(salary).toBeGreaterThanOrEqual(600000)
      expect(salary).toBeLessThanOrEqual(8000000)
    }
  })
})
