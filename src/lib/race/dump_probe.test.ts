import { describe, it, expect } from 'vitest'
import * as pure from './pureRaceEngine'

describe('inspect pureRaceEngine', () => {
  it('dump keys', () => {
    const keys = Object.keys(pure)
    throw new Error('DUMP_KEYS: ' + keys.join(','))
  })
})
