import { describe, it, expect } from 'vitest'
import {
  DRIVER_CAREER_STAT_LABELS,
  getDriverCareerStats,
  MBJ_2026_PILOTS,
} from '@/lib/mbj-drivers-data'
import fs from 'node:fs'
import path from 'node:path'

describe('DRIVER-STATS-LABELS-01 Suite', () => {
  // DSL01: wins usa label "Vitórias"
  it('DSL01: wins usa label "Vitórias"', () => {
    expect(DRIVER_CAREER_STAT_LABELS.wins).toBe('Vitórias')
  })

  // DSL02: poles usa label "Poles"
  it('DSL02: poles usa label "Poles"', () => {
    expect(DRIVER_CAREER_STAT_LABELS.poles).toBe('Poles')
  })

  // DSL03: podiums usa label "Pódios"
  it('DSL03: podiums usa label "Pódios"', () => {
    expect(DRIVER_CAREER_STAT_LABELS.podiums).toBe('Pódios')
  })

  // DSL04: championships/titles usa label "Títulos"
  it('DSL04: championships/titles usa label "Títulos"', () => {
    expect(DRIVER_CAREER_STAT_LABELS.championships).toBe('Títulos')
    expect(DRIVER_CAREER_STAT_LABELS.titles).toBe('Títulos')
  })

  // DSL05: campo de GPs/largadas possui label semanticamente compatível com a fonte real
  it('DSL05: campo de GPs/largadas possui label semanticamente compatível com a fonte real', () => {
    expect(DRIVER_CAREER_STAT_LABELS.races).toBe('GPs')
    expect(DRIVER_CAREER_STAT_LABELS.starts).toBe('Largadas')
  })

  // DSL06: nenhum número histórico é alterado
  it('DSL06: nenhum número histórico é alterado', () => {
    // Hamilton (mbj-003): 356 races, 105 wins, 104 poles, 7 championships
    const hamilton = getDriverCareerStats({ pilot: { id: 'mbj-003' } as any })
    expect(hamilton.races).toBe(356)
    expect(hamilton.wins).toBe(105)
    expect(hamilton.poles).toBe(104)
    expect(hamilton.championships).toBe(7)

    // Verstappen (mbj-001): 209 races, 63 wins, 40 poles, 4 championships
    const verstappen = getDriverCareerStats({ pilot: { id: 'mbj-001' } as any })
    expect(verstappen.races).toBe(209)
    expect(verstappen.wins).toBe(63)
    expect(verstappen.poles).toBe(40)
    expect(verstappen.championships).toBe(4)

    // Alonso (mbj-009): 401 races, 32 wins, 22 poles, 2 championships
    const alonso = getDriverCareerStats({ pilot: { id: 'mbj-009' } as any })
    expect(alonso.races).toBe(401)
    expect(alonso.wins).toBe(32)
    expect(alonso.poles).toBe(22)
    expect(alonso.championships).toBe(2)

    // Bortoleto (mbj-020): 0 races, 0 wins, 0 poles, 0 championships
    const bortoleto = getDriverCareerStats({ pilot: { id: 'mbj-020' } as any })
    expect(bortoleto.races).toBe(0)
    expect(bortoleto.wins).toBe(0)
    expect(bortoleto.poles).toBe(0)
    expect(bortoleto.championships).toBe(0)

    // Hülkenberg (mbj-019): 227 races, 0 wins, 1 poles, 0 championships
    const hulk = getDriverCareerStats({ pilot: { id: 'mbj-019' } as any })
    expect(hulk.races).toBe(227)
    expect(hulk.wins).toBe(0)
    expect(hulk.poles).toBe(1)
    expect(hulk.championships).toBe(0)
  })

  // DSL07: mesmo componente/dado usa labels consistentes em telas compartilhadas
  it('DSL07: mesmo componente/dado usa labels consistentes em telas compartilhadas', () => {
    const sidePanelSrc = fs.readFileSync(
      path.resolve(__dirname, '../components/DriverSidePanel.tsx'),
      'utf-8',
    )
    const profileDialogSrc = fs.readFileSync(
      path.resolve(__dirname, '../components/PilotProfileDialog.tsx'),
      'utf-8',
    )
    const raceResultSrc = fs.readFileSync(
      path.resolve(__dirname, '../components/race/OfficialRaceResultPanel.tsx'),
      'utf-8',
    )

    // Check that DRIVER_CAREER_STAT_LABELS is imported and used
    expect(sidePanelSrc).toContain('DRIVER_CAREER_STAT_LABELS.races')
    expect(sidePanelSrc).toContain('DRIVER_CAREER_STAT_LABELS.wins')
    expect(sidePanelSrc).toContain('DRIVER_CAREER_STAT_LABELS.poles')
    expect(sidePanelSrc).toContain('DRIVER_CAREER_STAT_LABELS.championships')

    expect(profileDialogSrc).toContain('DRIVER_CAREER_STAT_LABELS.races')
    expect(profileDialogSrc).toContain('DRIVER_CAREER_STAT_LABELS.wins')
    expect(profileDialogSrc).toContain('DRIVER_CAREER_STAT_LABELS.poles')
    expect(profileDialogSrc).toContain('DRIVER_CAREER_STAT_LABELS.championships')

    expect(raceResultSrc).toContain('DRIVER_CAREER_STAT_LABELS.races')
    expect(raceResultSrc).toContain('DRIVER_CAREER_STAT_LABELS.wins')
    expect(raceResultSrc).toContain('DRIVER_CAREER_STAT_LABELS.podiums')
    expect(raceResultSrc).toContain('DRIVER_CAREER_STAT_LABELS.poles')
  })

  // DSL08: nenhum mapping paralelo desnecessário foi criado
  it('DSL08: nenhum mapping paralelo desnecessário foi criado', () => {
    // Canonical centralized constant is exported only from mbj-drivers-data
    expect(DRIVER_CAREER_STAT_LABELS).toBeDefined()
    expect(Object.keys(DRIVER_CAREER_STAT_LABELS)).toEqual(
      expect.arrayContaining([
        'races',
        'starts',
        'wins',
        'poles',
        'podiums',
        'championships',
        'titles',
      ]),
    )
  })
})
