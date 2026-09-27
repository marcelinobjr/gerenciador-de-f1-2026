import { describe, it } from 'vitest'
import * as pure from './pureRaceEngine'

describe('inspect pureRaceEngine', () => {
  it('dump keys', () => {
    const keys = Object.keys(pure)
    expect(keys.join(',')).toBe('DUMP:' + keys.join(','))
  })
})
