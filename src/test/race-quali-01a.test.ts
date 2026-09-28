import { describe, it, expect } from 'vitest'
import * as pure from '../lib/race/pureRaceEngine'

describe('inspect exports', () => {
  it('pureRaceEngine exports', () => {
    expect(pure.calculateQualifyingAttemptTime).toBeDefined()
  })
})
