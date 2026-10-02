import { describe, it } from 'vitest'
import * as paceService from './services/canonicalPaceIntegrationService'
import * as fs from 'fs'

describe('inspect probe', () => {
  it('dump', () => {
    const keys = Object.keys(paceService)
    const err = new Error('PROBE_KEYS: ' + JSON.stringify(keys))
    throw err
  })
})
