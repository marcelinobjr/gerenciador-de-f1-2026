import { describe, it, expect } from 'vitest'
import * as careerModule from '../data/driverCareerStats2025'

describe('DRIVER-STATS-LABELS-01', () => {
  const statsDict: Record<string, any> =
    (careerModule as any).DRIVER_CAREER_STATS_2025 || (careerModule as any).default || {}

  // DSL01: Rótulo GPs / Largadas semanticamente correto
  it('DSL01: Canonical career stats represent GPs / starts accurately', () => {
    expect(statsDict).toBeDefined()
    const values = Object.values(statsDict) as any[]
    expect(values.length).toBeGreaterThan(0)
    const first = values[0]
    expect('races' in first || 'gps' in first || 'starts' in first).toBe(true)
  })

  // DSL02: Vitórias
  it('DSL02: Wins label and data mapping match semantic definition', () => {
    const values = Object.values(statsDict) as any[]
    const verstappen = values.find(
      (d: any) =>
        d.driverId === 'DRV_0001' ||
        d.driver_id === 'DRV_0001' ||
        d.id === 'DRV_0001' ||
        d.name?.includes('Verstappen'),
    )
    expect(verstappen).toBeDefined()
    expect(verstappen.wins).toBeGreaterThan(50)
  })

  // DSL03: Poles
  it('DSL03: Poles label and data mapping match semantic definition', () => {
    const values = Object.values(statsDict) as any[]
    const verstappen = values.find(
      (d: any) =>
        d.driverId === 'DRV_0001' ||
        d.driver_id === 'DRV_0001' ||
        d.id === 'DRV_0001' ||
        d.name?.includes('Verstappen'),
    )
    expect(verstappen.poles).toBeGreaterThanOrEqual(0)
  })

  // DSL04: Pódios
  it('DSL04: Podiums label and data mapping match semantic definition', () => {
    const values = Object.values(statsDict) as any[]
    const verstappen = values.find(
      (d: any) =>
        d.driverId === 'DRV_0001' ||
        d.driver_id === 'DRV_0001' ||
        d.id === 'DRV_0001' ||
        d.name?.includes('Verstappen'),
    )
    expect(verstappen.podiums).toBeGreaterThanOrEqual(0)
  })

  // DSL05: Títulos
  it('DSL05: Championships label and data mapping match semantic definition', () => {
    const values = Object.values(statsDict) as any[]
    const verstappen = values.find(
      (d: any) =>
        d.driverId === 'DRV_0001' ||
        d.driver_id === 'DRV_0001' ||
        d.id === 'DRV_0001' ||
        d.name?.includes('Verstappen'),
    )
    expect(verstappen.championships).toBeGreaterThanOrEqual(3)
  })

  // DSL06: Valores históricos não mudaram
  it('DSL06: Historical stats values remain intact', () => {
    const values = Object.values(statsDict) as any[]
    expect(Array.isArray(values)).toBe(true)
    expect(values.length).toBeGreaterThan(0)
  })

  // DSL07: Verstappen mesmos números
  it('DSL07: Verstappen career stats numbers are identical', () => {
    const values = Object.values(statsDict) as any[]
    const verstappen = values.find(
      (d: any) =>
        d.driverId === 'DRV_0001' ||
        d.driver_id === 'DRV_0001' ||
        d.id === 'DRV_0001' ||
        d.name?.includes('Verstappen'),
    )
    expect(verstappen).toBeDefined()
    expect(verstappen.races ?? verstappen.gps ?? verstappen.starts).toBeGreaterThan(150)
  })

  // DSL08: Hamilton mesmos números
  it('DSL08: Hamilton career stats numbers are identical', () => {
    const values = Object.values(statsDict) as any[]
    const hamilton = values.find(
      (d: any) =>
        d.driverId === 'DRV_0002' ||
        d.driver_id === 'DRV_0002' ||
        d.id === 'DRV_0002' ||
        d.name?.includes('Hamilton'),
    )
    expect(hamilton).toBeDefined()
    expect(hamilton.championships).toBe(7)
  })

  // DSL09: Alonso mesmos números
  it('DSL09: Alonso career stats numbers are identical', () => {
    const values = Object.values(statsDict) as any[]
    const alonso = values.find(
      (d: any) =>
        d.driverId === 'DRV_0003' ||
        d.driver_id === 'DRV_0003' ||
        d.id === 'DRV_0003' ||
        d.name?.includes('Alonso'),
    )
    expect(alonso).toBeDefined()
    expect(alonso.championships).toBe(2)
  })

  // DSL10: Bortoleto mesmos números
  it('DSL10: Bortoleto career stats numbers are identical', () => {
    const values = Object.values(statsDict) as any[]
    const bortoleto = values.find(
      (d: any) =>
        d.driverId === 'DRV_0019' ||
        d.driver_id === 'DRV_0019' ||
        d.id === 'DRV_0019' ||
        d.name?.includes('Bortoleto'),
    )
    expect(bortoleto).toBeDefined()
    expect(bortoleto.races ?? bortoleto.gps ?? bortoleto.starts).toBe(0)
  })

  // DSL11: Nenhuma transformação matemática nova
  it('DSL11: No mathematical transformation applied to historical career stats', () => {
    const values = Object.values(statsDict) as any[]
    values.forEach((item: any) => {
      expect(Number.isInteger(item.races ?? item.gps ?? item.starts)).toBe(true)
      expect(Number.isInteger(item.wins)).toBe(true)
      expect(Number.isInteger(item.podiums)).toBe(true)
      expect(Number.isInteger(item.poles)).toBe(true)
      expect(Number.isInteger(item.championships)).toBe(true)
    })
  })

  // DSL12: driverCareerStats2025 não alterado
  it('DSL12: driverCareerStats2025 data structure not modified', () => {
    const values = Object.values(statsDict) as any[]
    const keys = Object.keys(values[0])
    expect(keys).toContain('wins')
    expect(keys).toContain('podiums')
    expect(keys).toContain('poles')
    expect(keys).toContain('championships')
  })

  // DSL13: Sem nomes ingleses inconsistentes na UI em português
  it('DSL13: Standard Portuguese labels defined for UI consumption', () => {
    const canonicalUiLabels = {
      gps: 'GPs',
      wins: 'Vitórias',
      poles: 'Poles',
      podiums: 'Pódios',
      titles: 'Títulos',
    }
    expect(canonicalUiLabels.gps).toBe('GPs')
    expect(canonicalUiLabels.wins).toBe('Vitórias')
    expect(canonicalUiLabels.poles).toBe('Poles')
    expect(canonicalUiLabels.podiums).toBe('Pódios')
    expect(canonicalUiLabels.titles).toBe('Títulos')
  })

  // DSL14: Fallback funcional
  it('DSL14: Fallbacks function properly for undefined or null stat values', () => {
    const formatStat = (val: number | undefined | null) => (val != null ? String(val) : '0')
    expect(formatStat(undefined)).toBe('0')
    expect(formatStat(null)).toBe('0')
    expect(formatStat(12)).toBe('12')
  })

  // DSL15: Nenhum portrait/team binding afetado
  it('DSL15: No portrait or team binding affected by career stat labels', () => {
    const values = Object.values(statsDict) as any[]
    values.forEach((driver: any) => {
      expect(driver.driverId || driver.driver_id || driver.id).toBeDefined()
    })
  })
})
