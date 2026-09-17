import { describe, it } from 'vitest'
import fs from 'fs'

describe('test local write in test', () => {
  it('writes to local disk', () => {
    fs.writeFileSync('public/test-run-write.txt', 'test write')
    console.log('EXISTS:', fs.existsSync('public/test-run-write.txt'))
  })
})
