import { describe, it } from 'vitest'

describe('check backend url', () => {
  it('checks if backend url works', async () => {
    try {
      const res = await fetch('https://gerenciador-de-f1-2026-4bb0f.shrd00.internal.goskip.dev/api/health')
      console.log('HEALTH STATUS:', res.status)
    } catch (e: any) {
      console.log('HEALTH ERROR:', e?.message)
    }
  })
})
