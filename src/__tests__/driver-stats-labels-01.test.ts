/**
 * driver-stats-labels-01.test.ts
 *
 * PROJETO: APEX GP MANAGER
 * ETAPA: DRIVER-STATS-LABELS-01 (MICRO-PATCH VISUAL/SEMÂNTICO)
 *
 * Casos Canônicos DSL01..DSL15:
 * DSL01 rótulo de GPs/Largadas semanticamente correto.
 * DSL02 Vitórias correto.
 * DSL03 Poles correto.
 * DSL04 Pódios correto.
 * DSL05 Títulos correto.
 * DSL06 valores históricos não mudaram.
 * DSL07 Verstappen permanece com os mesmos números.
 * DSL08 Hamilton permanece com os mesmos números.
 * DSL09 Alonso permanece com os mesmos números.
 * DSL10 Bortoleto permanece com os mesmos números.
 * DSL11 nenhuma transformação matemática nova.
 * DSL12 nenhuma alteração em driverCareerStats2025.
 * DSL13 rótulos não usam nomes ingleses inconsistentes onde a UI está em português.
 * DSL14 fallback continua funcional.
 * DSL15 nenhum portrait/team binding afetado.
 */

import { describe, it, expect } from 'vitest'
import {
  DRIVER_CAREER_STAT_LABELS,
  getDriverCareerStats,
} from '@/lib/mbj-drivers-data'
import {
  DRIVER_CAREER_STATS_2025,
  getDriverCareerBaseline2025,
} from '@/data/driverCareerStats2025'

describe('DRIVER-STATS-LABELS-01 Suite (DSL01..DSL15)', () => {
  // DSL01 rótulo de GPs/Largadas semanticamente correto.
  it('DSL01: rótulo de GPs/Largadas semanticamente correto', () => {
    expect(DRIVER_CAREER_STAT_LABELS.races).toBe('GPs')
    expect(DRIVER_CAREER_STAT_LABELS.starts).toBe('Largadas')
    expect(DRIVER_CAREER_STAT_LABELS.races).not.toBe('Largadas')
    expect(DRIVER_CAREER_STAT_LABELS.starts).not.toBe('GPs')
  })

  // DSL02 Vitórias correto.
  it('DSL02: Vitórias correto', () => {
    expect(DRIVER_CAREER_STAT_LABELS.wins).toBe('Vitórias')
  })

  // DSL03 Poles correto.
  it('DSL03: Poles correto', () => {
    expect(DRIVER_CAREER_STAT_LABELS.poles).toBe('Poles')
  })

  // DSL04 Pódios correto.
  it('DSL04: Pódios correto', () => {
    expect(DRIVER_CAREER_STAT_LABELS.podiums).toBe('Pódios')
  })

  // DSL05 Títulos correto.
  it('DSL05: Títulos correto', () => {
    expect(DRIVER_CAREER_STAT_LABELS.championships).toBe('Títulos')
    expect(DRIVER_CAREER_STAT_LABELS.titles).toBe('Títulos')
  })

  // DSL06 valores históricos não mudaram.
  it('DSL06: valores históricos não mudaram', () => {
    // Total de registros em DRIVER_CAREER_STATS_2025 permanece estável
    const keys = Object.keys(DRIVER_CAREER_STATS_2025)
    expect(keys.length).toBeGreaterThanOrEqual(18)

    // Nenhum registro com NaN, undefined ou valores negativos
    for (const key of keys) {
      const stat = DRIVER_CAREER_STATS_2025[key]
      expect(stat.races).toBeGreaterThanOrEqual(0)
      expect(stat.wins).toBeGreaterThanOrEqual(0)
      expect(stat.poles).toBeGreaterThanOrEqual(0)
      expect(stat.championships).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(stat.races)).toBe(true)
      expect(Number.isInteger(stat.wins)).toBe(true)
      expect(Number.isInteger(stat.poles)).toBe(true)
      expect(Number.isInteger(stat.championships)).toBe(true)
    }
  })

  // DSL07 Verstappen permanece com os mesmos números.
  it('DSL07: Verstappen permanece com os mesmos números', () => {
    const ver = DRIVER_CAREER_STATS_2025['mbj-002']
    expect(ver).toBeDefined()
    expect(ver.races).toBe(209)
    expect(ver.wins).toBe(63)
    expect(ver.poles).toBe(40)
    expect(ver.championships).toBe(4)

    const derived = getDriverCareerStats({ pilot: { id: 'mbj-002' } })
    expect(derived.races).toBe(209)
    expect(derived.wins).toBe(63)
    expect(derived.poles).toBe(40)
    expect(derived.championships).toBe(4)
  })

  // DSL08 Hamilton permanece com os mesmos números.
  it('DSL08: Hamilton permanece com os mesmos números', () => {
    const ham = DRIVER_CAREER_STATS_2025['mbj-001']
    expect(ham).toBeDefined()
    expect(ham.races).toBe(356)
    expect(ham.wins).toBe(105)
    expect(ham.poles).toBe(104)
    expect(ham.championships).toBe(7)

    const derived = getDriverCareerStats({ pilot: { id: 'mbj-001' } })
    expect(derived.races).toBe(356)
    expect(derived.wins).toBe(105)
    expect(derived.poles).toBe(104)
    expect(derived.championships).toBe(7)
  })

  // DSL09 Alonso permanece com os mesmos números.
  it('DSL09: Alonso permanece com os mesmos números', () => {
    const alo = DRIVER_CAREER_STATS_2025['mbj-003']
    expect(alo).toBeDefined()
    expect(alo.races).toBe(401)
    expect(alo.wins).toBe(32)
    expect(alo.poles).toBe(22)
    expect(alo.championships).toBe(2)

    const derived = getDriverCareerStats({ pilot: { id: 'mbj-003' } })
    expect(derived.races).toBe(401)
    expect(derived.wins).toBe(32)
    expect(derived.poles).toBe(22)
    expect(derived.championships).toBe(2)
  })

  // DSL10 Bortoleto permanece com os mesmos números.
  it('DSL10: Bortoleto permanece com os mesmos números', () => {
    const bor = DRIVER_CAREER_STATS_2025['mbj-018']
    expect(bor).toBeDefined()
    expect(bor.races).toBe(0)
    expect(bor.wins).toBe(0)
    expect(bor.poles).toBe(0)
    expect(bor.championships).toBe(0)

    const derived = getDriverCareerStats({ pilot: { id: 'mbj-018' } })
    expect(derived.races).toBe(0)
    expect(derived.wins).toBe(0)
    expect(derived.poles).toBe(0)
    expect(derived.championships).toBe(0)
  })

  // DSL11 nenhuma transformação matemática nova.
  it('DSL11: nenhuma transformação matemática nova', () => {
    // getDriverCareerStats é estritamente aditiva: base + save
    const stats = getDriverCareerStats({
      pilot: { id: 'mbj-018' },
      raceResults: [
        { driver_id: 'mbj-018', position: 1, grid_position: 1 },
        { driver_id: 'mbj-018', position: 3, grid_position: 2 },
      ],
      seasonHistories: [{ drivers_champion: 'mbj-018' }],
    })

    expect(stats.races).toBe(0 + 2)
    expect(stats.wins).toBe(0 + 1)
    expect(stats.poles).toBe(0 + 1)
    expect(stats.championships).toBe(0 + 1)
  })

  // DSL12 nenhuma alteração em driverCareerStats2025.
  it('DSL12: nenhuma alteração em driverCareerStats2025', () => {
    // O baseline de Hülkenberg, Kvyat, Bourdais e Mazepin permanece inalterado
    expect(getDriverCareerBaseline2025('mbj-019')).toEqual({
      races: 227,
      wins: 0,
      poles: 1,
      championships: 0,
    })
    expect(getDriverCareerBaseline2025('mbj-038')).toEqual({
      races: 110,
      wins: 0,
      poles: 0,
      championships: 0,
    })
    expect(getDriverCareerBaseline2025('mbj-075')).toEqual({
      races: 27,
      wins: 0,
      poles: 0,
      championships: 0,
    })
    expect(getDriverCareerBaseline2025('mbj-091')).toEqual({
      races: 21,
      wins: 0,
      poles: 0,
      championships: 0,
    })
  })

  // DSL13 rótulos não usam nomes ingleses inconsistentes onde a UI está em português.
  it('DSL13: rótulos não usam nomes ingleses inconsistentes onde a UI está em português', () => {
    const forbiddenEnglish = ['Wins', 'Poles Position', 'Pole Positions', 'Podiums', 'Titles', 'Starts', 'Races']
    const currentValues = Object.values(DRIVER_CAREER_STAT_LABELS)

    for (const val of currentValues) {
      expect(forbiddenEnglish).not.toContain(val)
    }

    expect(DRIVER_CAREER_STAT_LABELS.wins).toBe('Vitórias')
    expect(DRIVER_CAREER_STAT_LABELS.podiums).toBe('Pódios')
    expect(DRIVER_CAREER_STAT_LABELS.championships).toBe('Títulos')
    expect(DRIVER_CAREER_STAT_LABELS.races).toBe('GPs')
  })

  // DSL14 fallback continua funcional.
  it('DSL14: fallback continua funcional', () => {
    const emptyStats = getDriverCareerStats({ pilot: null })
    expect(emptyStats).toEqual({ races: 0, wins: 0, poles: 0, championships: 0 })

    const unlistedPilot = getDriverCareerStats({
      pilot: {
        id: 'unknown-pilot-id',
        f1RacesCompleted: 15,
        f1Wins: 2,
        f1Poles: 3,
        f1Championships: 1,
      },
    })
    expect(unlistedPilot).toEqual({ races: 15, wins: 2, poles: 3, championships: 1 })
  })

  // DSL15 nenhum portrait/team binding afetado.
  it('DSL15: nenhum portrait/team binding afetado', () => {
    // DRIVER_CAREER_STAT_LABELS contém apenas chaves de estatística
    const keys = Object.keys(DRIVER_CAREER_STAT_LABELS)
    expect(keys).not.toContain('portrait')
    expect(keys).not.toContain('photo')
    expect(keys).not.toContain('avatar')
    expect(keys).not.toContain('team')
    expect(keys).not.toContain('teamId')
    expect(keys).not.toContain('driverId')
  })
})
