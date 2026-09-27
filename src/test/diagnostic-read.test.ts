import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

describe('Diagnostic inspector 2', () => {
  it('reads details', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'))
    let gitHead = ''
    try {
      gitHead = fs.readFileSync(path.resolve(process.cwd(), '.git/HEAD'), 'utf-8')
      if (gitHead.startsWith('ref:')) {
        const refPath = gitHead.replace('ref:', '').trim()
        const fullRef = path.resolve(process.cwd(), '.git', refPath)
        if (fs.existsSync(fullRef)) {
          gitHead += ' -> ' + fs.readFileSync(fullRef, 'utf-8').trim()
        }
      }
    } catch (e) {
      gitHead = 'ERR: ' + String(e)
    }
    // Fail intentionally to show stdout/message in QA output
    expect({
      version: pkg.version,
      head: gitHead.trim(),
    }).toEqual({ version: 'EXPECTED', head: 'EXPECTED' })
  })
})
