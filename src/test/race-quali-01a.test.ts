import { describe, it } from 'vitest'
import * as pure from '../lib/race/pureRaceEngine'

describe('inspect exports', () => {
  it('pureRaceEngine exports', () => {
    // console.log(Object.keys(pure))
    expect(pure.calculateQualifyingAttemptTime).toBeDefined()
  })
})
