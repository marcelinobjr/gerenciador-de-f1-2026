import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { calculateStableChecksum } from '@/data/balance-baseline-v0'
import baselineJson from '@/data/balance-baseline-v0.json'

describe('Structural Strength Baseline V0', () => {
  const jsonPath = path.resolve(process.cwd(), 'src/data/balance-baseline-v0.json')

  it('arquivo existe e parseia como JSON valido', () => {
    expect(fs.existsSync(jsonPath)).toBe(true)
    const raw = fs.readFileSync(jsonPath, 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed).toBeDefined()
    expect(parsed.schemaVersion).toBe('v0')
    expect(parsed.hasRuntimeRng).toBe(false)
  })

  it('contem exatamente 29 equipes declaradas e computadas', () => {
    const raw = fs.readFileSync(jsonPath, 'utf-8')
    const parsed = JSON.parse(raw)
    const teamKeys = Object.keys(parsed.teams)

    expect(parsed.totalTeamsCount).toBe(29)
    expect(teamKeys.length).toBe(29)
  })

  it('garante IDs unicos e canônicos para todas as 29 equipes', () => {
    const raw = fs.readFileSync(jsonPath, 'utf-8')
    const parsed = JSON.parse(raw)
    const teamKeys = Object.keys(parsed.teams)
    const uniqueKeys = new Set(teamKeys)

    expect(uniqueKeys.size).toBe(29)

    const expectedKeys = [
      // 12 Grid 2026
      'mercedes',
      'mclaren',
      'ferrari',
      'redbull',
      'astonmartin',
      'audi',
      'williams',
      'racingbulls',
      'haas',
      'alpine',
      'cadillac',
      'andretti',
      // 16 Historicas/Alternativas
      'porsche',
      'honda',
      'lamborghini',
      'byd',
      'penske',
      'lotus',
      'toyota',
      'benetton',
      'copersucar',
      'alfaromeo',
      'alphatauri',
      'fittipaldi',
      'jordan',
      'renault',
      'sauber',
      'toleman',
      // 1 Custom
      'custom_team',
    ]

    for (const key of expectedKeys) {
      expect(parsed.teams[key]).toBeDefined()
      expect(parsed.teams[key].teamKey).toBe(key)
    }
  })

  it('calcula e valida checksum estavel/reproduzivel', () => {
    const raw = fs.readFileSync(jsonPath, 'utf-8')
    const parsed = JSON.parse(raw)

    const { checksum, ...payloadWithoutChecksum } = parsed
    const expectedChecksum = calculateStableChecksum(payloadWithoutChecksum)

    // Lança erro caso o checksum no arquivo não bata com o esperado
    // Isso nos dará o hash exato na mensagem de falha se for diferente!
    expect(checksum).toBe(expectedChecksum)
  })})
