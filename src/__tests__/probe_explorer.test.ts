import { describe, it } from 'vitest'
import fs from 'node:fs'

describe('probe explorer', () => {
  it('reads directories and files', () => {
    const list = fs.readdirSync('src')
    fs.writeFileSync('probe_src_list.txt', JSON.stringify(list))
  })
})
