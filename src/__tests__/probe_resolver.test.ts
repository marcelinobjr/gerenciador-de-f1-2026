import { readFileSync } from 'fs'
import { resolve } from 'path'
import { it } from 'vitest'

it('debug read file', () => {
  const content = readFileSync(
    resolve(process.cwd(), 'src/services/weekendSlotViewModelResolver.ts'),
    'utf-8',
  )
  // throw error with slice so QA output displays it
  throw new Error('CONTENT:\n' + content)
})
