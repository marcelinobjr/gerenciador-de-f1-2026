import { describe, it, expect, vi } from 'vitest'
import { teamRosterService } from '@/services/teamRosterService'
import { DriverModel, TeamModel } from '@/types/f1'
import { getTeamSideView } from '@/data/assets/teamAssets'
import { getCarroPorEquipeImage } from '@/assets/carroPorEquipe'
import { CAR_PARTS_CATALOG } from '@/components/car/CarPartsCatalog'
import { OFFICIAL_TEAMS_TECHNICAL_DATA } from '@/lib/car-technical-data'

describe('Meu Carro - Subabas Garagem e Área Técnica (Modelos e Lógica)', () => {
  const mockTeam: TeamModel = {
    id: 'audi_f1_team',
    name: 'Audi Sport F1 Team',
    team_key: 'audi',
    color: '#E10600',
    budget: 84040000,
    cost_cap_spent: 167700000,
    engine_pool_used: 2,
    active_engine_wear: 21,
    engine_supplier: 'Mercedes',
    created: '2026-01-01',
    updated: '2026-04-14',
  }

  const mockStarter1: DriverModel = {
    id: 'd1',
    name: 'Daniel Ricciardo',
    team_id: 'audi_f1_team',
    nationality: 'Australia',
    age: 36,
    speed: 85,
    consistency: 84,
    rain: 82,
    defense: 85,
    salary: 8000000,
    contract_end: 2027,
    role: 'titular',
  }

  const mockStarter2: DriverModel = {
    id: 'd2',
    name: 'Gabriel Bortoleto',
    team_id: 'audi_f1_team',
    nationality: 'Brasil',
    age: 21,
    speed: 82,
    consistency: 80,
    rain: 78,
    defense: 80,
    salary: 3000000,
    contract_end: 2028,
    role: 'titular',
  }

  const mockReserve: DriverModel = {
    id: 'd3',
    name: 'Reserva Teste',
    team_id: 'audi_f1_team',
    nationality: 'Brasil',
    age: 23,
    speed: 75,
    consistency: 74,
    rain: 72,
    defense: 75,
    salary: 1000000,
    contract_end: 2026,
    role: 'reserva',
  }

  it('1. Garante isolamento de pilotos nos cockpits: starter1 = Carro #1, starter2 = Carro #2, reserva fora', () => {
    const allDrivers: DriverModel[] = [mockStarter1, mockStarter2, mockReserve]
    const roster = teamRosterService.buildTeamRoster(mockTeam, allDrivers)

    expect(roster.driver1?.name).toBe('Daniel Ricciardo')
    expect(roster.driver2?.name).toBe('Gabriel Bortoleto')
    expect(roster.reserve?.name).toBe('Reserva Teste')
    // Reserva NUNCA entra nos cockpits titulares
    expect(roster.driver1?.name).not.toBe('Reserva Teste')
    expect(roster.driver2?.name).not.toBe('Reserva Teste')
  })

  it('2. Garante fallback limpo de imagens do monoposto para a equipe do save', () => {
    const audiSideView = getTeamSideView('audi')
    expect(audiSideView).toBeDefined()
    expect(audiSideView).toContain('audi')

    const fallbackImg = getCarroPorEquipeImage('audi', false)
    expect(fallbackImg).toBeDefined()

    // Para equipe customizada ou desconhecida, fallback seguro sem quebra
    const customCarImg = getCarroPorEquipeImage('equipe_desconhecida', true)
    expect(customCarImg).toBeDefined()
  })

  it('3. Catálogo de componentes homologados possui os 6 itens canônicos', () => {
    expect(CAR_PARTS_CATALOG).toHaveLength(6)
    const partIds = CAR_PARTS_CATALOG.map((p) => p.id)
    expect(partIds).toContain('frontWing')
    expect(partIds).toContain('rearWing')
    expect(partIds).toContain('floor')
    expect(partIds).toContain('sidepods')
    expect(partIds).toContain('engine')
    expect(partIds).toContain('suspension')
  })

  it('4. Competitividade do Grid e Média do Grid são calculadas das equipes reais do save', () => {
    const profiles = Object.values(OFFICIAL_TEAMS_TECHNICAL_DATA)
    expect(profiles.length).toBeGreaterThan(5)

    const avgMacro = profiles.reduce((acc, t) => acc + t.macroRating, 0) / profiles.length
    expect(avgMacro).toBeGreaterThan(30)
    expect(avgMacro).toBeLessThanOrEqual(100)

    const frontWingAvg =
      profiles.reduce((acc, t) => acc + t.initialComponents.frontWing, 0) / profiles.length
    expect(frontWingAvg).toBeGreaterThan(30)
    expect(frontWingAvg).toBeLessThanOrEqual(100)
  })

  it('5. Verificação de cockpit vago caso não haja starter atribuído', () => {
    const emptyTeam: TeamModel = {
      ...mockTeam,
      id: 'empty_team_id',
    }
    const roster = teamRosterService.buildTeamRoster(emptyTeam, [])
    expect(roster.driver1).toBeNull()
    expect(roster.driver2).toBeNull()
  })
})
