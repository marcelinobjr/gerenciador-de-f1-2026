/**
 * balance-equation-02a-v0-tests.test.ts
 *
 * Suíte de Testes V0-01 até V0-07
 * Homologação da Baseline Histórica Imutável V0
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { calculateStableChecksum, BASELINE_V0_DATA } from '@/data/balance-baseline-v0'

describe('V0-01 a V0-07: Homologação da Baseline Histórica V0', () => {
  const filePath = path.resolve(process.cwd(), 'src/data/balance-baseline-v0.json')

  // V0-01: Baseline existe no path canônico src/data/balance-baseline-v0.json
  it('V0-01: Baseline V0 existe no path canônico src/data/balance-baseline-v0.json', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const stat = fs.statSync(filePath)
    expect(stat.size).toBeGreaterThan(1000)
  })

  // V0-02: Baseline parseia perfeitamente e respeita schema
  it('V0-02: Baseline V0 parseia como JSON válido e respeita schema estrutural', () => {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed).toBeDefined()
    expect(parsed.schemaVersion).toBe('v0')
    expect(parsed.baselineId).toBe('balance_baseline_v0_2026')
    expect(parsed.totalTeamsCount).toBe(29)
    expect(typeof parsed.checksum).toBe('string')
    expect(parsed.checksum.startsWith('sha_v0_')).toBe(true)
    expect(parsed.immutable).toBe(true)
    expect(Object.keys(parsed.teams).length).toBe(29)
  })

  // V0-03: Checksum / hash é estável e reproduzível
  it('V0-03: Checksum da V0 é estável, determinístico e confere com os dados', () => {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    const { checksum, ...withoutChecksum } = parsed
    const expectedChecksum = calculateStableChecksum(withoutChecksum)
    expect(checksum).toBe(expectedChecksum)
    expect(BASELINE_V0_DATA.checksum).toBe(checksum)
  })

  // V0-04: Imutabilidade garantida — não é sobrescrita silenciosamente
  it('V0-04: Baseline V0 tem flag imutável e runtime não a recalcula ou sobrescreve', () => {
    const baseline = structuralStrengthService.getBaselineV0()
    expect(baseline.immutable).toBe(true)
    // Tentar mutar em memória não deve corromper nova leitura
    try {
      ;(baseline as any).schemaVersion = 'v1_hack'
    } catch {
      // caso Object.freeze
    }
    const fresh = structuralStrengthService.getBaselineV0()
    expect(fresh.immutable).toBe(true)
    expect(fresh.schemaVersion).toBe('v0')
  })

  // V0-05: restoreBalanceBaseline recupera valores canônicos da V0
  it('V0-05: restoreBalanceBaseline recupera parâmetros canônicos de balanceamento da V0', () => {
    const result = structuralStrengthService.restoreBalanceBaseline('v0')
    expect(result.success).toBe(true)
    expect(result.versionRestored).toBe('v0')
    expect(result.restoredTeamsCount).toBe(29)
    expect(result.checksum).toBe(BASELINE_V0_DATA.checksum)
  })

  // V0-06: restoreBalanceBaseline é idempotente
  it('V0-06: restoreBalanceBaseline é estritamente idempotente em chamadas repetidas', () => {
    const run1 = structuralStrengthService.restoreBalanceBaseline('v0')
    const run2 = structuralStrengthService.restoreBalanceBaseline('v0')
    const run3 = structuralStrengthService.restoreBalanceBaseline('v0')

    expect(run1).toEqual(run2)
    expect(run2).toEqual(run3)
  })

  // V0-07: restoreBalanceBaseline NÃO apaga/modifica save de carreira nem histórico
  it('V0-07: restoreBalanceBaseline não apaga saves, contratos, resultados ou histórico de carreira', () => {
    const mockSaveKey = 'f1_career_mock_save_data'
    const mockSavePayload = JSON.stringify({
      careerId: 'test_career_123',
      currentSeason: 2026,
      currentRound: 5,
      driverContracts: [{ id: 'mbj-001', salary: 30000000 }],
      championshipStandings: { leader: 'mercedes', points: 120 },
    })

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(mockSaveKey, mockSavePayload)
    }

    const restoreResult = structuralStrengthService.restoreBalanceBaseline('v0')
    expect(restoreResult.success).toBe(true)

    if (typeof window !== 'undefined' && window.localStorage) {
      const persisted = window.localStorage.getItem(mockSaveKey)
      expect(persisted).toBe(mockSavePayload)
      window.localStorage.removeItem(mockSaveKey)
    }
  })
})
