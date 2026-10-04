import { describe, it, expect } from 'vitest'
import * as RaceEngine from '@/services/canonicalRaceEngineService'

describe('inspect exports', () => {
  it('check exports', () => {
    expect(Object.keys(RaceEngine)).toBeDefined()
  })
})
