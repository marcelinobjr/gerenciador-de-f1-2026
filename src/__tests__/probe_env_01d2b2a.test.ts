import { describe, it } from 'vitest'

describe('probe environment', () => {
  it('probe', () => {
    console.log('ENV:', Object.keys(process.env).sort())
    console.log('NODE_VERSION:', process.version)
    console.log('PLATFORM:', process.platform, process.arch)
  })
})
