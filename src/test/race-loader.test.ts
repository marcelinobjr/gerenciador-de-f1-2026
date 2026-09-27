/**
 * src/test/race-loader.test.ts
 *
 * Teste unitário para validação e carga de configuração de corrida no Skip Cloud.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  validateRaceParameters,
  RaceConfigLoadError,
  loadVersionedRaceConfig,
  DEFAULT_RACE_DRAFT_VERSION,
} from '@/lib/race/loader'
import { DEFAULT_SOURCE_RACE_PARAMETERS } from '@/lib/race/pureRaceEngine'
import pb from '@/lib/pocketbase/client'

describe('RACE-SOURCE-01 — Config Loader & Validation', () => {
  it('validates a complete, healthy RaceParameters object', () => {
    expect(() => validateRaceParameters(DEFAULT_SOURCE_RACE_PARAMETERS)).not.toThrow()
  })

  it('rejects null or non-object parameters', () => {
    expect(() => validateRaceParameters(null)).toThrow(RaceConfigLoadError)
    expect(() => validateRaceParameters(123)).toThrow(RaceConfigLoadError)
  })

  it('rejects missing or NaN mandatory parameters', () => {
    const invalid = { ...DEFAULT_SOURCE_RACE_PARAMETERS, qualifying_noise_sd_ms: NaN }
    expect(() => validateRaceParameters(invalid)).toThrow(RaceConfigLoadError)

    const missingKey = { ...DEFAULT_SOURCE_RACE_PARAMETERS }
    delete (missingKey as any).fuel_max_kg
    expect(() => validateRaceParameters(missingKey)).toThrow(RaceConfigLoadError)
  })

  it('loads seeded versioned config from pocketbase', async () => {
    // Se o banco estiver conectado e mockado/ao vivo
    const mockRecord = {
      id: 'rec_race_test_1',
      version: DEFAULT_RACE_DRAFT_VERSION,
      sha256: '15e9e24a41300938f29cefdca68480db80c05988548bb2268798e4d35e1286ae',
      status: 'DRAFT',
      is_active: false,
      work_item: 'RACE-SOURCE-01A',
      delivery_version: 'RACE-SOURCE-01A-DRAFT-1.0.0',
      source_declared_version: 'v1',
      source_sha256: '0d02e79794f6defabfa3385d2854a4fc0bed7e5a17495c008075185d71f289a2',
      parameters: DEFAULT_SOURCE_RACE_PARAMETERS,
      tables: {},
      catalogs: {},
      metadata: {},
      created: '2026-09-27T00:00:00.000Z',
      updated: '2026-09-27T00:00:00.000Z',
    }

    const spy = vi
      .spyOn(pb.collection('race_versioned_configs'), 'getFirstListItem')
      .mockResolvedValueOnce(mockRecord as any)

    const cfg = await loadVersionedRaceConfig(DEFAULT_RACE_DRAFT_VERSION)

    expect(cfg.version).toBe(DEFAULT_RACE_DRAFT_VERSION)
    expect(cfg.status).toBe('DRAFT')
    expect(cfg.is_active).toBe(false)
    expect(cfg.parameters.grid_target_spread_ms).toBe(2500)

    spy.mockRestore()
  })

  it('rejects empty version string', async () => {
    await expect(loadVersionedRaceConfig('')).rejects.toThrow(RaceConfigLoadError)
  })
})
