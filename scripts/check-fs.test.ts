import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('check-fs', () => {
  it('checks if it can write to public', () => {
    const p = path.resolve(process.cwd(), 'public/hello.txt')
    fs.writeFileSync(p, 'hello world', 'utf8')
    expect(fs.existsSync(p)).toBe(true)
  })
})
