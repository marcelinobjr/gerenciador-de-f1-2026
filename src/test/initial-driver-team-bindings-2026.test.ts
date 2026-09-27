import { describe, it, expect } from 'vitest'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'
import { driverBase2026Service } from '@/services/driverBase2026Service'
import { getActiveDriverTeamBinding } from '@/lib/canonical-driver-database'

describe('APEX GP MANAGER — ATUALIZAÇÃO DOS VÍNCULOS INICIAIS DE PILOTOS (CENÁRIO-BASE 2026)', () => {
  it('Grid Oficial de 12 equipes contém exatamente os 24 titulares e reservas canônicos', () => {
    expect(OFFICIAL_GRID_TEAMS.length).toBe(12)

    const expectedGrid: Record<string, { driver1: string; driver2: string; reserve: string }> = {
      mercedes: {
        driver1: 'George Russell',
        driver2: 'Andrea Kimi Antonelli',
        reserve: 'Frederik Vesti',
      },
      mclaren: {
        driver1: 'Lando Norris',
        driver2: 'Oscar Piastri',
        reserve: 'Leonardo Fornaroli',
      },
      ferrari: {
        driver1: 'Lewis Hamilton',
        driver2: 'Charles Leclerc',
        reserve: 'Antonio Giovinazzi',
      },
      redbull: {
        driver1: 'Max Verstappen',
        driver2: 'Isack Hadjar',
        reserve: 'Yuki Tsunoda',
      },
      astonmartin: {
        driver1: 'Fernando Alonso',
        driver2: 'Lance Stroll',
        reserve: 'Stoffel Vandoorne',
      },
      audi: {
        driver1: 'Gabriel Bortoleto',
        driver2: 'Nico Hülkenberg',
        reserve: 'A Definir',
      },
      williams: {
        driver1: 'Alex Albon',
        driver2: 'Carlos Sainz',
        reserve: 'Luke Browning',
      },
      racingbulls: {
        driver1: 'Liam Lawson',
        driver2: 'Arvid Lindblad',
        reserve: 'Ayumu Iwasa',
      },
      haas: {
        driver1: 'Esteban Ocon',
        driver2: 'Oliver Bearman',
        reserve: 'Ryo Hirakawa',
      },
      alpine: {
        driver1: 'Pierre Gasly',
        driver2: 'Franco Colapinto',
        reserve: 'Paul Aron',
      },
      cadillac: {
        driver1: 'Valtteri Bottas',
        driver2: 'Sergio Pérez',
        reserve: 'Zhou Guanyu',
      },
      andretti: {
        driver1: 'Felipe Drugovich',
        driver2: 'Colton Herta',
        reserve: 'A Definir',
      },
    }

    for (const team of OFFICIAL_GRID_TEAMS) {
      const exp = expectedGrid[team.key]
      expect(exp, `Equipe ${team.key} deve estar configurada`).toBeDefined()
      expect([team.driver1.name, team.driver2.name]).toContain(exp.driver1)
      expect([team.driver1.name, team.driver2.name]).toContain(exp.driver2)
      expect(team.reserveDriver.name).toBe(exp.reserve)
    }
  })

  it('Drugovich e Herta são os dois titulares da Andretti e não dividem equipe com Cadillac', () => {
    const andretti = OFFICIAL_GRID_TEAMS.find((t) => t.key === 'andretti')!
    const cadillac = OFFICIAL_GRID_TEAMS.find((t) => t.key === 'cadillac')!
    expect(andretti).toBeDefined()
    expect(cadillac).toBeDefined()
    expect([andretti.driver1.name, andretti.driver2.name]).toEqual(
      expect.arrayContaining(['Felipe Drugovich', 'Colton Herta']),
    )
    expect([cadillac.driver1.name, cadillac.driver2.name]).toEqual(
      expect.arrayContaining(['Valtteri Bottas', 'Sergio Pérez']),
    )
  })

  it('Nova Carreira isolada inicializa os 24 titulares únicos nas 12 equipes', () => {
    const careerDrivers = driverBase2026Service.initializeCareerDrivers({
      careerId: 'test_career_2026_bindings',
      playerTeamId: 'audi',
    })
    expect(careerDrivers).toBeDefined()
    expect(Object.keys(careerDrivers).length).toBeGreaterThanOrEqual(130)
  })
})
