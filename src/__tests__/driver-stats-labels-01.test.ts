import { describe, it, expect } from 'vitest'
import { DRIVER_CAREER_STAT_LABELS } from '@/lib/mbj-drivers-data'
import { DRIVER_CAREER_STATS_2025 } from '@/data/driverCareerStats2025'

describe('DRIVER-STATS-LABELS-01 Suite', () => {
  // DSL01: wins deve ser exatamente "Vitórias"
  it('DSL01: wins label is exactly "Vitórias"', () => {
    expect(DRIVER_CAREER_STAT_LABELS.wins).toBe('Vitórias')
  })

  // DSL02: poles deve ser exatamente "Poles"
  it('DSL02: poles label is exactly "Poles"', () => {
    expect(DRIVER_CAREER_STAT_LABELS.poles).toBe('Poles')
  })

  // DSL03: podiums deve ser exatamente "Pódios"
  it('DSL03: podiums label is exactly "Pódios"', () => {
    expect(DRIVER_CAREER_STAT_LABELS.podiums).toBe('Pódios')
  })

  // DSL04: championships/titles deve ser exatamente "Títulos"
  it('DSL04: championships and titles labels are exactly "Títulos"', () => {
    expect(DRIVER_CAREER_STAT_LABELS.championships).toBe('Títulos')
    expect(DRIVER_CAREER_STAT_LABELS.titles).toBe('Títulos')
  })

  // DSL05: races/starts deve ser semanticamente correto (races="GPs", starts="Largadas")
  it('DSL05: races and starts labels are semantically correct (races="GPs", starts="Largadas")', () => {
    expect(DRIVER_CAREER_STAT_LABELS.races).toBe('GPs')
    expect(DRIVER_CAREER_STAT_LABELS.starts).toBe('Largadas')
    // Não trocar races com starts
    expect(DRIVER_CAREER_STAT_LABELS.races).not.toBe('Largadas')
    expect(DRIVER_CAREER_STAT_LABELS.starts).not.toBe('GPs')
  })

  // DSL06: nenhum número histórico alterado em DRIVER_CAREER_STATS_2025
  it('DSL06: historical driver career stats values remain intact and unchanged', () => {
    // Hamilton (mbj-001)
    const ham = DRIVER_CAREER_STATS_2025['mbj-001']
    expect(ham).toBeDefined()
    expect(ham.races).toBe(356)
    expect(ham.wins).toBe(105)
    expect(ham.poles).toBe(104)
    expect(ham.championships).toBe(7)

    // Verstappen (mbj-002)
    const ver = DRIVER_CAREER_STATS_2025['mbj-002']
    expect(ver).toBeDefined()
    expect(ver.races).toBe(209)
    expect(ver.wins).toBe(63)
    expect(ver.poles).toBe(40)
    expect(ver.championships).toBe(4)

    // Alonso (mbj-003)
    const alo = DRIVER_CAREER_STATS_2025['mbj-003']
    expect(alo).toBeDefined()
    expect(alo.races).toBe(401)
    expect(alo.wins).toBe(32)
    expect(alo.poles).toBe(22)
    expect(alo.championships).toBe(2)

    // Bortoleto (mbj-018)
    const bor = DRIVER_CAREER_STATS_2025['mbj-018']
    expect(bor).toBeDefined()
    expect(bor.races).toBe(0)
    expect(bor.wins).toBe(0)
    expect(bor.poles).toBe(0)
    expect(bor.championships).toBe(0)

    // Hülkenberg (mbj-019)
    const hul = DRIVER_CAREER_STATS_2025['mbj-019']
    expect(hul).toBeDefined()
    expect(hul.races).toBe(227)
    expect(hul.wins).toBe(0)
    expect(hul.poles).toBe(1)
    expect(hul.championships).toBe(0)

    // Kvyat (mbj-038)
    const kvy = DRIVER_CAREER_STATS_2025['mbj-038']
    expect(kvy).toBeDefined()
    expect(kvy.races).toBe(110)
    expect(kvy.wins).toBe(0)
    expect(kvy.poles).toBe(0)
    expect(kvy.championships).toBe(0)

    // Bourdais (mbj-075)
    const bou = DRIVER_CAREER_STATS_2025['mbj-075']
    expect(bou).toBeDefined()
    expect(bou.races).toBe(27)
    expect(bou.wins).toBe(0)
    expect(bou.poles).toBe(0)
    expect(bou.championships).toBe(0)

    // Mazepin (mbj-091)
    const maz = DRIVER_CAREER_STATS_2025['mbj-091']
    expect(maz).toBeDefined()
    expect(maz.races).toBe(21)
    expect(maz.wins).toBe(0)
    expect(maz.poles).toBe(0)
    expect(maz.championships).toBe(0)
  })

  // DSL07: labels consistentes entre telas compartilhadas
  it('DSL07: labels are consistent across shared surfaces', () => {
    // Verificar que DRIVER_CAREER_STAT_LABELS possui todas as chaves canônicas requeridas
    const requiredKeys = [
      'races',
      'starts',
      'wins',
      'poles',
      'podiums',
      'championships',
      'titles',
    ] as const
    for (const key of requiredKeys) {
      expect(DRIVER_CAREER_STAT_LABELS[key]).toBeDefined()
      expect(typeof DRIVER_CAREER_STAT_LABELS[key]).toBe('string')
      expect(DRIVER_CAREER_STAT_LABELS[key].length).toBeGreaterThan(0)
    }
  })

  // DSL08: nenhum mapping paralelo desnecessário
  it('DSL08: single source of truth for career stat labels without parallel redundant objects', () => {
    // DRIVER_CAREER_STAT_LABELS é a única fonte canônica
    expect(Object.keys(DRIVER_CAREER_STAT_LABELS).sort()).toEqual(
      ['championships', 'podiums', 'poles', 'races', 'starts', 'titles', 'wins'].sort(),
    )
  })
})
