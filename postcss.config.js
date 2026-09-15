/* PostCSS Config file: https://postcss.org */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

// One-off migration script already applied

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
