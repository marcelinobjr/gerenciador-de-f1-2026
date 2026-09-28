import { describe, it, expect } from 'vitest'
import * as loader from './loader'

describe('Inspect loader exports', () => {
  it('should list exported loader keys', () => {
    expect(Object.keys(loader)).toBeDefined()
    console.log('LOADER KEYS:', Object.keys(loader))
  })
})
