import { describe, it, expect } from 'vitest'
import { teamReplacementService } from '@/services/teamReplacementService'
import { ALL_GRID_TEAMS_DATABASE, OFFICIAL_2026_GRID_KEYS } from '@/lib/grid-teams-database'

describe('FIX-ELIGIBLE-TEAMS-01A — Universo de Equipes Elegíveis para Substituição', () => {
  it('deve listar exatamente as 15 equipes fora do campeonato quando o grid de 2026 oficial estiver ativo', () => {
    // Grid oficial de 2026 (11 equipes padrão + Andretti P12)
    const currentGrid = [...OFFICIAL_2026_GRID_KEYS, 'andretti']

    const candidates = teamReplacementService.getEligibleReplacementTeams(currentGrid)

    // Deve retornar exatamente 15 equipes fora do grid
    expect(candidates).toHaveLength(15)

    const candidateKeys = candidates.map((c) => c.key)
    const candidateNames = candidates.map((c) => c.name)

    // Verificar as 15 equipes solicitadas
    const expectedKeys = [
      'alfaromeo',
      'benetton',
      'byd',
      'copersucar',
      'fittipaldi',
      'honda',
      'jordan',
      'lamborghini',
      'porsche',
      'renault',
      'sauber',
      'alphatauri',
      'lotus',
      'penske',
      'toleman',
    ]

    for (const key of expectedKeys) {
      expect(candidateKeys).toContain(key)
    }

    // Verificar nomes completos fiéis
    expect(candidateNames).toContain('Alfa Romeo F1 Team')
    expect(candidateNames).toContain('Benetton Formula')
    expect(candidateNames).toContain('BYD Formula E-Tech')
    expect(candidateNames).toContain('Copersucar Fittipaldi')
    expect(candidateNames).toContain('Fittipaldi Racing Team')
    expect(candidateNames).toContain('Honda HRC F1 Team')
    expect(candidateNames).toContain('Jordan Grand Prix')
    expect(candidateNames).toContain('Lamborghini Squadra Corse')
    expect(candidateNames).toContain('Porsche Motorsport')
    expect(candidateNames).toContain('Renault F1 Team')
    expect(candidateNames).toContain('Sauber Motorsport')
    expect(candidateNames).toContain('Scuderia AlphaTauri')
    expect(candidateNames).toContain('Team Lotus Classic')
    expect(candidateNames).toContain('Team Penske F1')
    expect(candidateNames).toContain('Toleman Motorsport')

    // Nenhuma equipe do grid atual deve estar nos candidatos
    for (const gridKey of currentGrid) {
      expect(candidateKeys).not.toContain(gridKey.toLowerCase())
    }
  })

  it('não deve retornar lista vazia mesmo se os IDs forem passados como IDs do PocketBase ou nomes completos', () => {
    const mixedGrid = [
      'Mercedes-AMG PETRONAS',
      'Scuderia Ferrari',
      'Oracle Red Bull Racing',
      'McLaren F1 Team',
      'Aston Martin Aramco',
      'Alpine F1 Team',
      'Williams Racing',
      'Racing Bulls F1 Team',
      'MoneyGram Haas F1 Team',
      'Audi F1 Team',
      'Cadillac F1 Team',
      'Andretti Global',
    ]

    const candidates = teamReplacementService.getEligibleReplacementTeams(mixedGrid)
    expect(candidates).toHaveLength(15)
  })

  it('aplica a substituição 1 por 1 mantendo a contagem total de equipes no grid', () => {
    const currentGrid = [
      'mercedes',
      'ferrari',
      'redbull',
      'mclaren',
      'astonmartin',
      'alpine',
      'williams',
      'racingbulls',
      'haas',
      'audi',
      'cadillac',
      'andretti',
    ]

    const result = teamReplacementService.applyGridReplacement({
      currentGridKeys: currentGrid,
      lastPlaceTeamKey: 'andretti',
      replacementTeamKey: 'porsche',
    })

    expect(result.success).toBe(true)
    expect(result.updatedGridKeys).toHaveLength(12)
    expect(result.updatedGridKeys).toContain('porsche')
    expect(result.updatedGridKeys).not.toContain('andretti')
  })
})
