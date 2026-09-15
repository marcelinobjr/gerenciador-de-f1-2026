/* PostCSS Config file: https://postcss.org */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

try {
  const fixScript = path.resolve('scripts/apply-raceslim-fix.mjs')
  if (fs.existsSync(fixScript)) {
    execSync(`node "${fixScript}"`, { stdio: 'inherit' })
  }
} catch (e) {
  // Ignore
}

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
