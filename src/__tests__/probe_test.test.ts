import { describe, it, expect } from 'vitest'
import { runTeamProbe } from './probe_runner'

describe('Team Probe', () => {
  it('runs probe and checks team create capability', async () => {
    const res = await runTeamProbe()
    console.log('HOOK_PROBE_RESPONSE:', JSON.stringify(res, null, 2))
    expect(res.saveErr).toBeNull()
  })
})
