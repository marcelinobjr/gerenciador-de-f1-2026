import { describe, it, expect } from 'vitest'
import {
  getTeamReducedLogoUrl,
  getTeamReducedLogoDef,
  normalizeTeamIdentifier,
  TEAM_REDUCED_LOGOS_MANIFEST,
} from '@/lib/team-reduced-logo-resolver'

describe('team-reduced-logo-resolver', () => {
  it('contém exatamente 26 logos reduzidas da pasta do Google Drive', () => {
    const keys = Object.keys(TEAM_REDUCED_LOGOS_MANIFEST)
    expect(keys.length).toBe(26)
  })

  it('retorna a logo correta para as principais escuderias oficiais da F1', () => {
    // Williams
    const williamsDef = getTeamReducedLogoDef('Williams')
    expect(williamsDef).not.toBeNull()
    expect(williamsDef?.fileName).toBe('Williams.jpg')
    expect(williamsDef?.thumbnailUrl).toContain('1vK9yr_LWt5Yn0Jkr-Wl7u82EhzQS0tV2')

    // Ferrari
    const ferrariDef = getTeamReducedLogoDef('Ferrari')
    expect(ferrariDef).not.toBeNull()
    expect(ferrariDef?.fileName).toBe('Ferrari.jpg')
    expect(ferrariDef?.thumbnailUrl).toContain('1WNhKOWyf3B_clAbYkBnv9cSju3sBNtg6')

    // Mercedes
    const mercDef = getTeamReducedLogoDef('Mercedes-AMG Petronas')
    expect(mercDef).not.toBeNull()
    expect(mercDef?.fileName).toBe('Mercedes.jpg')

    // Audi
    const audiDef = getTeamReducedLogoDef('Audi Revolut F1 Team')
    expect(audiDef).not.toBeNull()
    expect(audiDef?.fileName).toBe('Audi.jpg')

    // McLaren
    const mclarenDef = getTeamReducedLogoDef('McLaren Formula 1')
    expect(mclarenDef).not.toBeNull()
    expect(mclarenDef?.fileName).toBe('McLaren.jpg')

    // Red Bull
    const redbullDef = getTeamReducedLogoDef('Oracle Red Bull Racing')
    expect(redbullDef).not.toBeNull()
    expect(redbullDef?.fileName).toBe('Red_Bull.jpg')
  })

  it('normaliza identificadores com prefixo de IA ou underscores', () => {
    expect(normalizeTeamIdentifier('ai_ferrari')).toBe('ferrari')
    expect(normalizeTeamIdentifier('ai_aston_martin')).toBe('astonmartin')
    expect(normalizeTeamIdentifier('ai_vcarb')).toBe('racingbulls')
  })

  it('retorna null seguro para equipes inexistentes para uso de fallback neutro', () => {
    const unknown = getTeamReducedLogoUrl('equipe_desconhecida_xyz')
    expect(unknown).toBeNull()
  })
})
