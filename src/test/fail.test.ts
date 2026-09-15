import { describe, it } from 'vitest'

describe('failing test', () => {
  it('fails intentionally', () => {
    throw new Error('INTENTIONAL FAILURE')
  })
})
