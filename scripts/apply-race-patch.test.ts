import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('raceslim fix check', () => {
  it('throws test error to inspect', () => {
    const filePath = path.resolve('src/pages/RaceSlim.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')
    throw new Error(
      `DEBUG: File length: ${content.length}, byteLength: ${Buffer.byteLength(content)}`,
    )
  })
})
