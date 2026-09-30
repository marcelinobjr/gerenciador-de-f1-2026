import fs from 'node:fs'

const files = [
  'src/data/baseline-2026-v1.ts',
  'src/data/balance-baseline-v0.ts',
  'src/services/structuralStrengthService.ts',
  'src/services/canonicalQualifyingRunner.ts',
  'src/services/qualifyingPaceIntegrationService.ts',
  'src/__tests__/quali-team-breakdown-audit-01.test.ts',
]

for (const f of files) {
  if (fs.existsSync(f)) {
    console.log(`=== FILE: ${f} (${fs.statSync(f).size} bytes) ===`)
    console.log(fs.readFileSync(f, 'utf-8').slice(0, 1000))
  } else {
    console.log(`=== MISSING: ${f} ===`)
  }
}
