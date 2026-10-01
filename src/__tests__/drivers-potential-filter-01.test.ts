import { describe, it, expect } from 'vitest'
import {
  getDriverCanonicalPotential,
  filterByPotential,
  UnifiedDriverItem,
} from '@/pages/DriversPage'

describe('DRIVERS-POTENTIAL-FILTER-01: Filtro por Potencial Canônico na página /pilotos', () => {
  // Piloto base para testes
  const baseDriver: UnifiedDriverItem = {
    id: 'test-driver-1',
    name: 'Piloto Teste',
    nationality: 'Brasil',
    age: 22,
    speed: 80,
    consistency: 80,
    rain: 80,
    defense: 80,
    salaryUsd: 1000000,
    contractEnd: 2026,
    category: 'f1',
    potentialMin: 80,
    potentialMax: 80,
    potential: 80,
    f1RacesCompleted: 10,
    superlicensePoints: 40,
    isAcademyProspect: false,
    isPlayerDriver: false,
  }

  // DPF01: Todos mantém a listagem original
  it('DPF01: Todos mantém a listagem original', () => {
    const list: Partial<UnifiedDriverItem>[] = [
      { id: '1', potentialMin: 95, potentialMax: 95, potential: 95 },
      { id: '2', potentialMin: 72, potentialMax: 72, potential: 72 },
      { id: '3', potentialMin: 50, potentialMax: 50, potential: 50 },
      { id: '4' }, // sem potencial
    ]

    const filtered = list.filter((d) => filterByPotential(d, 'all'))
    expect(filtered.length).toBe(list.length)
    expect(filtered.map((d) => d.id)).toEqual(['1', '2', '3', '4'])
  })

  // DPF02: potencial 95 → 90–100
  it('DPF02: potencial 95 → 90–100', () => {
    const driver: Partial<UnifiedDriverItem> = {
      ...baseDriver,
      potential: 95,
      potentialMin: 95,
      potentialMax: 95,
    }

    expect(filterByPotential(driver, '90_100')).toBe(true)
    expect(filterByPotential(driver, '80_89')).toBe(false)
    expect(filterByPotential(driver, '70_79')).toBe(false)
    expect(filterByPotential(driver, '60_69')).toBe(false)
    expect(filterByPotential(driver, 'below_60')).toBe(false)
  })

  // DPF03: potencial 84 → 80–89
  it('DPF03: potencial 84 → 80–89', () => {
    const driver: Partial<UnifiedDriverItem> = {
      ...baseDriver,
      potential: 84,
      potentialMin: 84,
      potentialMax: 84,
    }

    expect(filterByPotential(driver, '90_100')).toBe(false)
    expect(filterByPotential(driver, '80_89')).toBe(true)
    expect(filterByPotential(driver, '70_79')).toBe(false)
    expect(filterByPotential(driver, '60_69')).toBe(false)
    expect(filterByPotential(driver, 'below_60')).toBe(false)
  })

  // DPF04: potencial 72 → 70–79
  it('DPF04: potencial 72 → 70–79', () => {
    const driver: Partial<UnifiedDriverItem> = {
      ...baseDriver,
      potential: 72,
      potentialMin: 72,
      potentialMax: 72,
    }

    expect(filterByPotential(driver, '90_100')).toBe(false)
    expect(filterByPotential(driver, '80_89')).toBe(false)
    expect(filterByPotential(driver, '70_79')).toBe(true)
    expect(filterByPotential(driver, '60_69')).toBe(false)
    expect(filterByPotential(driver, 'below_60')).toBe(false)
  })

  // DPF05: Mariana (72) → 70–79
  it('DPF05: Mariana (72) → 70–79', () => {
    const mariana: Partial<UnifiedDriverItem> = {
      id: 'qm6xcgc5mstulg3',
      name: 'Mariana Fagundes',
      rawDbRecord: {
        id: 'qm6xcgc5mstulg3',
        name: 'Mariana Fagundes',
        perceived_potential: 72,
        evaluation_confidence: 63,
        true_potential: 71,
      } as any,
      potential: 72,
      confidence: 63,
    }

    const pot = getDriverCanonicalPotential(mariana)
    expect(pot).toBe(72)
    expect(filterByPotential(mariana, '70_79')).toBe(true)
  })

  // DPF06: Mariana NÃO em 60–69 (confiança 63% não vaza)
  it('DPF06: Mariana NÃO em 60–69 (confiança 63% não vaza)', () => {
    const mariana: Partial<UnifiedDriverItem> = {
      id: 'qm6xcgc5mstulg3',
      name: 'Mariana Fagundes',
      rawDbRecord: {
        id: 'qm6xcgc5mstulg3',
        name: 'Mariana Fagundes',
        perceived_potential: 72,
        evaluation_confidence: 63,
        true_potential: 71,
      } as any,
      potential: 72,
      confidence: 63,
    }

    // Mesmo que confidence seja 63, o potencial é 72, logo NÃO deve aparecer em 60–69
    expect(filterByPotential(mariana, '60_69')).toBe(false)
  })

  // DPF07: 65 → 60–69
  it('DPF07: 65 → 60–69', () => {
    const driver: Partial<UnifiedDriverItem> = {
      ...baseDriver,
      potential: 65,
      potentialMin: 65,
      potentialMax: 65,
    }

    expect(filterByPotential(driver, '90_100')).toBe(false)
    expect(filterByPotential(driver, '80_89')).toBe(false)
    expect(filterByPotential(driver, '70_79')).toBe(false)
    expect(filterByPotential(driver, '60_69')).toBe(true)
    expect(filterByPotential(driver, 'below_60')).toBe(false)
  })

  // DPF08: 58 → Abaixo de 60
  it('DPF08: 58 → Abaixo de 60', () => {
    const driver: Partial<UnifiedDriverItem> = {
      ...baseDriver,
      potential: 58,
      potentialMin: 58,
      potentialMax: 58,
    }

    expect(filterByPotential(driver, '90_100')).toBe(false)
    expect(filterByPotential(driver, '80_89')).toBe(false)
    expect(filterByPotential(driver, '70_79')).toBe(false)
    expect(filterByPotential(driver, '60_69')).toBe(false)
    expect(filterByPotential(driver, 'below_60')).toBe(true)
  })

  // DPF09: exatamente 90 só em 90–100
  it('DPF09: exatamente 90 só em 90–100', () => {
    const driver: Partial<UnifiedDriverItem> = {
      ...baseDriver,
      potential: 90,
      potentialMin: 90,
      potentialMax: 90,
    }

    expect(filterByPotential(driver, '90_100')).toBe(true)
    expect(filterByPotential(driver, '80_89')).toBe(false)
    expect(filterByPotential(driver, '70_79')).toBe(false)
    expect(filterByPotential(driver, '60_69')).toBe(false)
    expect(filterByPotential(driver, 'below_60')).toBe(false)
  })

  // DPF10: exatamente 80 só em 80–89
  it('DPF10: exatamente 80 só em 80–89', () => {
    const driver: Partial<UnifiedDriverItem> = {
      ...baseDriver,
      potential: 80,
      potentialMin: 80,
      potentialMax: 80,
    }

    expect(filterByPotential(driver, '90_100')).toBe(false)
    expect(filterByPotential(driver, '80_89')).toBe(true)
    expect(filterByPotential(driver, '70_79')).toBe(false)
    expect(filterByPotential(driver, '60_69')).toBe(false)
    expect(filterByPotential(driver, 'below_60')).toBe(false)
  })

  // DPF11: exatamente 70 só em 70–79
  it('DPF11: exatamente 70 só em 70–79', () => {
    const driver: Partial<UnifiedDriverItem> = {
      ...baseDriver,
      potential: 70,
      potentialMin: 70,
      potentialMax: 70,
    }

    expect(filterByPotential(driver, '90_100')).toBe(false)
    expect(filterByPotential(driver, '80_89')).toBe(false)
    expect(filterByPotential(driver, '70_79')).toBe(true)
    expect(filterByPotential(driver, '60_69')).toBe(false)
    expect(filterByPotential(driver, 'below_60')).toBe(false)
  })

  // DPF12: exatamente 60 só em 60–69
  it('DPF12: exatamente 60 só em 60–69', () => {
    const driver: Partial<UnifiedDriverItem> = {
      ...baseDriver,
      potential: 60,
      potentialMin: 60,
      potentialMax: 60,
    }

    expect(filterByPotential(driver, '90_100')).toBe(false)
    expect(filterByPotential(driver, '80_89')).toBe(false)
    expect(filterByPotential(driver, '70_79')).toBe(false)
    expect(filterByPotential(driver, '60_69')).toBe(true)
    expect(filterByPotential(driver, 'below_60')).toBe(false)
  })

  // DPF13: sem potencial: Todos sim, faixas não
  it('DPF13: sem potencial: Todos sim, faixas não', () => {
    const driverNoPotential: Partial<UnifiedDriverItem> = {
      id: 'no-pot',
      name: 'Sem Potencial',
    }

    expect(filterByPotential(driverNoPotential, 'all')).toBe(true)
    expect(filterByPotential(driverNoPotential, '90_100')).toBe(false)
    expect(filterByPotential(driverNoPotential, '80_89')).toBe(false)
    expect(filterByPotential(driverNoPotential, '70_79')).toBe(false)
    expect(filterByPotential(driverNoPotential, '60_69')).toBe(false)
    expect(filterByPotential(driverNoPotential, 'below_60')).toBe(false)
  })

  // DPF14: potencial + filtro de equipe
  it('DPF14: potencial + filtro de equipe (combinação AND)', () => {
    const drivers: Partial<UnifiedDriverItem>[] = [
      { id: '1', name: 'Piloto A', teamKey: 'ferrari', potential: 92 },
      { id: '2', name: 'Piloto B', teamKey: 'mclaren', potential: 91 },
      { id: '3', name: 'Piloto C', teamKey: 'ferrari', potential: 82 },
    ]

    const selectedTeam = 'ferrari'
    const selectedPotential = '90_100'

    const filtered = drivers.filter(
      (d) => d.teamKey === selectedTeam && filterByPotential(d, selectedPotential),
    )

    expect(filtered.length).toBe(1)
    expect(filtered[0].id).toBe('1')
  })

  // DPF15: potencial + busca por nome
  it('DPF15: potencial + busca por nome (combinação AND)', () => {
    const drivers: Partial<UnifiedDriverItem>[] = [
      { id: '1', name: 'Mariana Fagundes', potential: 72 },
      { id: '2', name: 'Gabriel Bortoleto', potential: 86 },
      { id: '3', name: 'Mariana Souza', potential: 85 },
    ]

    const searchQuery = 'Mariana'
    const selectedPotential = '70_79'

    const filtered = drivers.filter(
      (d) =>
        d.name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        filterByPotential(d, selectedPotential),
    )

    expect(filtered.length).toBe(1)
    expect(filtered[0].name).toBe('Mariana Fagundes')
  })
})
